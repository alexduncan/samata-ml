import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { BASE_LOCALE, LOCALES, type Locale } from '../src/config/locales';
import { RESERVED_CONTENT } from '../src/router/reserved-content';
import type {
	ContentDomain,
	ContentEntryMap,
	ContentHeading,
	ContentIndex,
	GlossaryEntry,
	ModelEntry,
	PageEntry
} from '../src/types/content';
import { ROOT_DIR } from './config';
import { compileMarkdownFragment } from './markdown';

const DOMAINS: readonly ContentDomain[] = ['pages', 'models', 'glossary'];
const VALID_ID_FILENAME = /^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_MODEL_ORDER = 1000;

const ALLOWED_FRONT_MATTER: Readonly<Record<ContentDomain, ReadonlySet<string>>> = {
	pages: new Set(['title', 'description', 'updated']),
	models: new Set(['title', 'description', 'order']),
	glossary: new Set(['title', 'description', 'related'])
};

/** Options for {@link buildContent}. */
export interface BuildContentOptions {
	/**
	 * @internal Override the authored content root directory for tests.
	 */
	contentDir?: string;
	/**
	 * @internal Override the supported locale list (base locale first) for tests.
	 */
	locales?: readonly string[];
	/** Prepare and validate content without writing fragments or indexes. */
	validateOnly?: boolean;
	/** Root for authored image paths. Defaults to the build output directory. */
	assetRoot?: string;
}

/** Per-domain entry counts returned inside {@link ContentBuildReport}. */
export interface DomainBuildCount {
	/** Total number of entries listed in the domain's `index.json`. */
	total: number;
	/** Number of entries served via build-time fallback to the base locale. */
	fallbacks: number;
}

/** Summary report returned by {@link buildContent}. */
export interface ContentBuildReport {
	/** Entry and fallback counts grouped by locale and domain. */
	locales: Record<string, Record<ContentDomain, DomainBuildCount>>;
}

/** The source diagnostics collected by a failed content build. */
export class ContentValidationError extends Error {
	constructor(readonly diagnostics: readonly string[]) {
		super(`Content build failed: ${diagnostics.length} error(s)`);
	}
}

interface PendingFragment {
	outPath: string;
	html: string;
}

function hashFragment(html: string): string {
	return new Bun.CryptoHasher('sha256').update(html).digest('hex').slice(0, 12);
}

function parseIsoCalendarDate(value: unknown): string | null {
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
	}
	if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) {
		return null;
	}
	const [yearStr, monthStr, dayStr] = value.split('-');
	const year = Number(yearStr);
	const month = Number(monthStr);
	const day = Number(dayStr);
	const check = new Date(Date.UTC(year, month - 1, day));
	if (
		check.getUTCFullYear() !== year ||
		check.getUTCMonth() !== month - 1 ||
		check.getUTCDate() !== day
	) {
		return null;
	}
	return value;
}

async function readDirSafe(dirPath: string) {
	try {
		return await readdir(dirPath, { withFileTypes: true });
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return null;
		}
		throw error;
	}
}

function toContentHeadings(
	headings: { id: string; text: string; level: number }[]
): ContentHeading[] {
	return headings
		.filter(
			(h): h is { id: string; text: string; level: 2 | 3 } => h.level === 2 || h.level === 3
		)
		.map((h) => ({ id: h.id, text: h.text, level: h.level }));
}

function validateNonEmptyString(
	value: unknown,
	key: string,
	sourcePath: string,
	errors: string[]
): string | undefined {
	if (value === undefined) {
		return undefined;
	}
	if (typeof value !== 'string' || value.trim().length === 0) {
		errors.push(`${sourcePath}: front matter '${key}' must be a non-empty string`);
		return undefined;
	}
	return value.trim();
}

function resolveSupportedLocales(options?: BuildContentOptions): string[] {
	if (options?.locales) {
		return [...options.locales];
	}
	return [BASE_LOCALE, ...Object.keys(LOCALES).filter((l) => l !== BASE_LOCALE)];
}

function sortEntries<D extends ContentDomain>(
	domain: D,
	entries: ContentEntryMap[D][],
	locale: string
): ContentEntryMap[D][] {
	return [...entries].sort((a, b) => {
		if (domain === 'models') {
			const orderDiff = (a as ModelEntry).order - (b as ModelEntry).order;
			if (orderDiff !== 0) {
				return orderDiff;
			}
		}
		const titleDiff = a.title.localeCompare(b.title, locale);
		if (titleDiff !== 0) {
			return titleDiff;
		}
		return a.id.localeCompare(b.id, 'en');
	});
}

async function scanDomainFiles(
	domainDir: string,
	contentDir: string,
	errors: string[]
): Promise<{ id: string; filePath: string }[]> {
	const entries = await readDirSafe(domainDir);
	if (!entries) {
		return [];
	}

	const files: { id: string; filePath: string }[] = [];
	for (const entry of [...entries].sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
		if (entry.name === '.DS_Store') {
			continue;
		}
		const fullPath = path.join(domainDir, entry.name);
		const sourcePath = path.relative(contentDir, fullPath);
		if (entry.isDirectory()) {
			errors.push(`${sourcePath}: subdirectories are not allowed inside content domains`);
			continue;
		}
		if (!entry.isFile() || !VALID_ID_FILENAME.test(entry.name)) {
			errors.push(
				`${sourcePath}: invalid content filename "${entry.name}" (expected kebab-case .md)`
			);
			continue;
		}
		files.push({ id: entry.name.slice(0, -3), filePath: fullPath });
	}
	return files;
}

async function compileDomainEntry<D extends ContentDomain>(params: {
	domain: D;
	id: string;
	filePath: string;
	contentDir: string;
	outDir: string;
	assetRoot: string;
	locale: string;
	baseLocale: string;
	baseEntry?: ContentEntryMap[D];
	pendingFragments: PendingFragment[];
	errors: string[];
}): Promise<ContentEntryMap[D]> {
	const {
		domain,
		id,
		filePath,
		contentDir,
		outDir,
		assetRoot,
		locale,
		baseLocale,
		baseEntry,
		pendingFragments,
		errors
	} = params;
	const isBase = baseEntry === undefined;
	const sourcePath = path.relative(contentDir, filePath);
	const raw = await readFile(filePath, 'utf8');
	const compiled = await compileMarkdownFragment(raw, { sourcePath, outDir: assetRoot, locale });
	errors.push(...compiled.errors);

	const allowedKeys = ALLOWED_FRONT_MATTER[domain];
	for (const key of Object.keys(compiled.data)) {
		if (!allowedKeys.has(key)) {
			errors.push(`${sourcePath}: unknown front matter key '${key}' for domain '${domain}'`);
		}
	}

	if (!isBase) {
		if (compiled.data.order !== undefined) {
			errors.push(
				`${sourcePath}: front matter 'order' is locale-neutral and only allowed in '${baseLocale}'`
			);
		}
		if (compiled.data.related !== undefined) {
			errors.push(
				`${sourcePath}: front matter 'related' is locale-neutral and only allowed in '${baseLocale}'`
			);
		}
	}

	const fmTitle = validateNonEmptyString(compiled.data.title, 'title', sourcePath, errors);
	const title = fmTitle ?? compiled.leadingTitle;
	if (!title) {
		errors.push(
			`${sourcePath}: missing title (provide front matter 'title' or leading '# H1')`
		);
	}

	const fmDescription = validateNonEmptyString(
		compiled.data.description,
		'description',
		sourcePath,
		errors
	);
	if (domain === 'glossary' && !fmDescription) {
		errors.push(`${sourcePath}: glossary entries require front matter 'description'`);
	}

	const description = fmDescription ?? compiled.firstParagraph ?? '';
	const hash = hashFragment(compiled.html);
	const url = `/content/${locale}/${domain}/${id}.html?v=${hash}`;
	const headings = toContentHeadings(compiled.headings);

	pendingFragments.push({
		outPath: path.join(outDir, 'content', locale, domain, `${id}.html`),
		html: compiled.html
	});

	const baseFields = {
		id,
		lang: locale as Locale,
		title: title ?? id,
		description,
		url,
		headings
	};

	if (domain === 'pages') {
		let updated: string | undefined;
		if (compiled.data.updated !== undefined) {
			const parsedDate = parseIsoCalendarDate(compiled.data.updated);
			if (!parsedDate) {
				errors.push(
					`${sourcePath}: front matter 'updated' must be a valid ISO calendar date (YYYY-MM-DD)`
				);
			} else {
				updated = parsedDate;
			}
		}
		const entry: PageEntry = {
			...baseFields,
			...(updated !== undefined ? { updated } : {})
		};
		return entry as ContentEntryMap[D];
	}

	if (domain === 'models') {
		let order = isBase ? DEFAULT_MODEL_ORDER : (baseEntry as ModelEntry).order;
		if (isBase && compiled.data.order !== undefined) {
			if (typeof compiled.data.order !== 'number' || !Number.isInteger(compiled.data.order)) {
				errors.push(`${sourcePath}: front matter 'order' must be an integer`);
			} else {
				order = compiled.data.order;
			}
		}
		const entry: ModelEntry = { ...baseFields, order };
		return entry as ContentEntryMap[D];
	}

	let related: string[] = isBase ? [] : [...(baseEntry as GlossaryEntry).related];
	if (isBase && compiled.data.related !== undefined) {
		if (
			!Array.isArray(compiled.data.related) ||
			!compiled.data.related.every(
				(item): item is string => typeof item === 'string' && item.trim().length > 0
			)
		) {
			errors.push(
				`${sourcePath}: front matter 'related' must be an array of glossary entry ids`
			);
		} else {
			related = compiled.data.related.map((item) => item.trim());
		}
	}
	const entry: GlossaryEntry = { ...baseFields, related };
	return entry as ContentEntryMap[D];
}

function validateDirectoryLayout(
	contentDir: string,
	locales: readonly string[],
	errors: string[]
): Promise<void>[] {
	const checks: Promise<void>[] = [];
	const allowedRootDirs = new Set(['datasets', ...locales]);

	checks.push(
		readDirSafe(contentDir).then((entries) => {
			if (!entries) {
				return;
			}
			for (const entry of [...entries].sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
				if (entry.name === '.DS_Store') {
					continue;
				}
				if (!entry.isDirectory() || !allowedRootDirs.has(entry.name)) {
					errors.push(`${entry.name}: unexpected entry under content root`);
				}
			}
		})
	);

	const allowedDomains = new Set<string>(DOMAINS);
	for (const locale of locales) {
		const localeDir = path.join(contentDir, locale);
		checks.push(
			readDirSafe(localeDir).then((entries) => {
				if (!entries) {
					return;
				}
				for (const entry of [...entries].sort((a, b) =>
					a.name.localeCompare(b.name, 'en')
				)) {
					if (entry.name === '.DS_Store') {
						continue;
					}
					if (!entry.isDirectory() || !allowedDomains.has(entry.name)) {
						errors.push(
							`${path.join(locale, entry.name)}: unexpected entry under content/${locale}`
						);
					}
				}
			})
		);
	}

	return checks;
}

async function compileDomainIntoMap<D extends ContentDomain>(params: {
	domain: D;
	domainDir: string;
	contentDir: string;
	outDir: string;
	assetRoot: string;
	locale: string;
	baseLocale: string;
	baseMap?: Map<string, ContentEntryMap[D]>;
	targetMap: Map<string, ContentEntryMap[D]>;
	pendingFragments: PendingFragment[];
	errors: string[];
}): Promise<void> {
	const {
		domain,
		domainDir,
		contentDir,
		outDir,
		assetRoot,
		locale,
		baseLocale,
		baseMap,
		targetMap,
		pendingFragments,
		errors
	} = params;
	const files = await scanDomainFiles(domainDir, contentDir, errors);
	for (const { id, filePath } of files) {
		let baseEntry: ContentEntryMap[D] | undefined;
		if (baseMap) {
			baseEntry = baseMap.get(id);
			if (!baseEntry) {
				const sourcePath = path.relative(contentDir, filePath);
				errors.push(
					`${sourcePath}: translation '${id}' has no matching base-locale (${baseLocale}) entry`
				);
				continue;
			}
		}
		const entry = await compileDomainEntry({
			domain,
			id,
			filePath,
			contentDir,
			outDir,
			assetRoot,
			locale,
			baseLocale,
			baseEntry,
			pendingFragments,
			errors
		});
		targetMap.set(id, entry);
	}
}

/**
 * Validates and compiles all authored Markdown content into HTML fragments and versioned JSON indexes
 * under `outDir/content/{locale}/{domain}/`.
 *
 * @param outDir - Build output directory (`dev/` or `dist/`).
 * @param options - Content discovery, asset validation and emission options.
 * @returns Per-locale, per-domain entry and fallback counts.
 * @throws Error listing a summary count when any validation or compilation error occurs.
 */
export async function buildContent(
	outDir: string,
	options?: BuildContentOptions
): Promise<ContentBuildReport> {
	const contentDir = path.resolve(options?.contentDir ?? path.join(ROOT_DIR, 'content'));
	const assetRoot = options?.assetRoot ?? outDir;
	const locales = resolveSupportedLocales(options);
	const baseLocale = locales[0];
	if (!baseLocale) {
		throw new Error('Content build failed: no locales configured');
	}

	const errors: string[] = [];
	await Promise.all(validateDirectoryLayout(contentDir, locales, errors));

	const pendingFragments: PendingFragment[] = [];
	const baseMaps: { [D in ContentDomain]: Map<string, ContentEntryMap[D]> } = {
		pages: new Map(),
		models: new Map(),
		glossary: new Map()
	};

	for (const domain of DOMAINS) {
		await compileDomainIntoMap({
			domain,
			domainDir: path.join(contentDir, baseLocale, domain),
			contentDir,
			outDir,
			assetRoot,
			locale: baseLocale,
			baseLocale,
			targetMap: baseMaps[domain],
			pendingFragments,
			errors
		});
	}

	for (const entry of baseMaps.glossary.values()) {
		const sourcePath = path.join(baseLocale, 'glossary', `${entry.id}.md`);
		for (const relatedId of entry.related) {
			if (relatedId === entry.id) {
				errors.push(
					`${sourcePath}: glossary 'related' cannot reference itself ('${relatedId}')`
				);
			} else if (!baseMaps.glossary.has(relatedId)) {
				errors.push(
					`${sourcePath}: glossary 'related' references unknown entry '${relatedId}'`
				);
			}
		}
	}

	for (const [routePath, pageId] of Object.entries(RESERVED_CONTENT)) {
		if (!baseMaps.pages.has(pageId)) {
			errors.push(
				`${baseLocale}/pages/${pageId}.md: missing base-locale (${baseLocale}) page '${pageId}' required by RESERVED_CONTENT['${routePath}']`
			);
		}
	}

	const localeEntryMaps: Record<
		string,
		{ [D in ContentDomain]: Map<string, ContentEntryMap[D]> }
	> = { [baseLocale]: baseMaps };

	for (const locale of locales.slice(1)) {
		const translatedMaps: { [D in ContentDomain]: Map<string, ContentEntryMap[D]> } = {
			pages: new Map(baseMaps.pages),
			models: new Map(baseMaps.models),
			glossary: new Map(baseMaps.glossary)
		};

		for (const domain of DOMAINS) {
			await compileDomainIntoMap({
				domain,
				domainDir: path.join(contentDir, locale, domain),
				contentDir,
				outDir,
				assetRoot,
				locale,
				baseLocale,
				baseMap: baseMaps[domain],
				targetMap: translatedMaps[domain],
				pendingFragments,
				errors
			});
		}

		localeEntryMaps[locale] = translatedMaps;
	}

	if (errors.length > 0) {
		errors.sort();
		if (!options?.validateOnly) {
			for (const message of errors) console.error(message);
		}
		throw new ContentValidationError(errors);
	}

	if (!options?.validateOnly) {
		for (const fragment of pendingFragments) {
			await mkdir(path.dirname(fragment.outPath), { recursive: true });
			await writeFile(fragment.outPath, fragment.html, 'utf8');
		}
	}

	const report: ContentBuildReport = { locales: {} };

	for (const locale of locales) {
		const domainCounts = {} as Record<ContentDomain, DomainBuildCount>;
		for (const domain of DOMAINS) {
			const entriesMap = localeEntryMaps[locale]![domain];
			const sortedEntries = sortEntries(domain, [...entriesMap.values()], locale);
			const index: ContentIndex<typeof domain> = {
				version: 1,
				locale: locale as Locale,
				domain,
				entries: sortedEntries
			};

			const indexPath = path.join(outDir, 'content', locale, domain, 'index.json');
			if (!options?.validateOnly) {
				await mkdir(path.dirname(indexPath), { recursive: true });
				await writeFile(indexPath, `${JSON.stringify(index, null, '\t')}\n`, 'utf8');
			}

			domainCounts[domain] = {
				total: sortedEntries.length,
				fallbacks: sortedEntries.filter((entry) => entry.lang !== locale).length
			};
		}
		report.locales[locale] = domainCounts;
	}

	return report;
}
