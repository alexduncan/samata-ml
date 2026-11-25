import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import Papa from 'papaparse';
import { compileMarkdownFragment } from './markdown';
import { acquireSource, prepareSource, validateSource } from './dataset-source';
import { DatasetProfiler } from '../src/common/storage/profiler';
import type { ElectedColumn } from '../src/common/storage/profiler';
import { isTemporalColumnType } from '../src/types/state';
import type {
	AuthoredDatasetDescriptor,
	AuthoredColumn,
	ComputedDatasetStats,
	SampleDatasetDescriptor,
	SampleDatasetIndex,
	SampleDatasetSummary,
	TaskType
} from '../src/types/sample-dataset';

const ROOT = path.resolve(import.meta.dir, '..');
const DEFAULT_CONTENT_DIR = path.join(ROOT, 'content/datasets');
const DEFAULT_CACHE_DIR = path.join(ROOT, 'node_modules/.cache/samata-ml/dataset-profiles');
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ALLOWED_LICENSES = new Set(['CC0-1.0', 'CC-BY-4.0', 'PDDL-1.0', 'ODbL-1.0']);
const DEFAULT_REMOTE_CACHE_DIR = path.join(ROOT, 'node_modules/.cache/samata-ml/remote-datasets');
const PROFILE_SOURCE_FILES = [
	path.join(ROOT, 'src/common/storage/profiler.ts'),
	path.join(ROOT, 'src/common/storage/cells.ts'),
	path.join(ROOT, 'src/features/data/ingestion/limits.ts')
];
let descriptorLoadSequence = 0;
type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** Build report separating newly profiled datasets from cache hits. */
export interface SampleDatasetBuildReport {
	built: string[];
	profiled: string[];
	cached: string[];
}

interface ProfileCache {
	key: string;
	profile: ReturnType<typeof profileCsv>;
}

function sha256(bytes: Uint8Array): string {
	return new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
}

function json(value: unknown): string {
	return JSON.stringify(value, null, '\t') + '\n';
}

function cacheJson(value: unknown): string {
	return JSON.stringify(value, (_key, item: unknown) =>
		item instanceof Map ? { __sampleDatasetMap: [...item.entries()] } : item
	);
}

function parseCache(source: string): ProfileCache {
	return JSON.parse(source, (_key, item: unknown) => {
		if (item && typeof item === 'object' && '__sampleDatasetMap' in item) {
			return new Map((item as { __sampleDatasetMap: [string, number][] }).__sampleDatasetMap);
		}
		return item;
	}) as ProfileCache;
}

function addError(errors: string[], id: string, message: string): void {
	errors.push(`${id}: ${message}`);
}

function getCategories(column: ElectedColumn): Record<string, number> {
	return Object.fromEntries(column.distinctValues ?? []);
}

function profileCsv(text: string, descriptor: AuthoredDatasetDescriptor) {
	const parsed = Papa.parse<string[]>(text, {
		header: false,
		dynamicTyping: false,
		skipEmptyLines: 'greedy',
		delimiter: '',
		delimitersToGuess: [',', '\t', ';', '|'],
		worker: false
	});
	const errors = parsed.errors.map((error) => `${error.code}: ${error.message}`);
	const rows = parsed.data;
	const rawHeader = rows[0] ?? [];
	if (rawHeader.length === 0) {
		return {
			errors: [...errors, 'CSV header row is required'],
			rawHeader,
			header: [],
			columns: [],
			rowCount: 0,
			skipped: 0,
			padded: 0
		};
	}
	const implicitMissing = Object.fromEntries(
		descriptor.columns
			.filter((column) => column.implicitMissingValues)
			.map((column) => [column.name, column.implicitMissingValues!])
	);
	const profiler = new DatasetProfiler(rawHeader, {
		missingValueTokens: descriptor.missingValueTokens,
		implicitMissing
	});
	for (const row of rows.slice(1)) profiler.addRow(row);
	return {
		errors,
		rawHeader,
		header: profiler.header,
		columns: profiler.elect(),
		rowCount: profiler.rowCount,
		skipped: profiler.skippedRows.count,
		padded: profiler.paddedRowCount
	};
}

function profileKey(
	csvHash: string,
	descriptor: AuthoredDatasetDescriptor,
	sourceHash: string
): string {
	return sha256(
		new TextEncoder().encode(
			JSON.stringify({
				csvHash,
				missingValueTokens: descriptor.missingValueTokens ?? null,
				columns: descriptor.columns.map(({ name, dataType, implicitMissingValues }) => ({
					name,
					dataType,
					implicitMissingValues: implicitMissingValues ?? null
				})),
				sourceHash
			})
		)
	);
}

async function getProfile(
	id: string,
	text: string,
	csvHash: string,
	descriptor: AuthoredDatasetDescriptor,
	cacheDir: string
): Promise<{ profile: ReturnType<typeof profileCsv>; cached: boolean }> {
	const sourceHash = sha256(
		new TextEncoder().encode(
			(await Promise.all(PROFILE_SOURCE_FILES.map((f) => readFile(f, 'utf8')))).join('\n')
		)
	);
	const key = profileKey(csvHash, descriptor, sourceHash);
	const cachePath = path.join(cacheDir, `${id}.json`);
	try {
		const cache = parseCache(await readFile(cachePath, 'utf8'));
		if (
			cache.key === key &&
			cache.profile &&
			Array.isArray(cache.profile.header) &&
			Array.isArray(cache.profile.columns) &&
			cache.profile.columns.every(
				(column) => column.distinctValues === null || column.distinctValues instanceof Map
			)
		) {
			return { profile: cache.profile, cached: true };
		}
	} catch {
		// A missing or corrupt cache is rebuilt from the source CSV.
	}
	const profile = profileCsv(text, descriptor);
	await mkdir(cacheDir, { recursive: true });
	await writeFile(cachePath, cacheJson({ key, profile } satisfies ProfileCache));
	return { profile, cached: false };
}

function validateDescriptor(
	id: string,
	directory: string,
	descriptor: AuthoredDatasetDescriptor,
	profile: ReturnType<typeof profileCsv>,
	files: string[],
	isRemote: boolean
): string[] {
	const errors: string[] = [];
	if (!ID_PATTERN.test(descriptor.id) || descriptor.id !== id)
		addError(errors, id, 'id must be kebab-case and match its directory');
	if (files.includes('metadata.json'))
		addError(errors, id, 'metadata.json is not allowed; use descriptor.ts');
	if (!files.includes('descriptor.ts')) addError(errors, id, 'descriptor.ts is required');
	if (
		[
			files.includes('data.csv'),
			Boolean(descriptor.remoteSource),
			Boolean(descriptor.buildSource)
		].filter(Boolean).length !== 1
	)
		addError(errors, id, 'exactly one of data.csv, buildSource or remoteSource is required');
	if (!files.includes('datasheet.md')) addError(errors, id, 'datasheet.md is required');
	if (profile.errors.length)
		for (const error of profile.errors) addError(errors, id, `CSV parse: ${error}`);
	if (!isRemote && profile.rawHeader.join('\u0000') !== profile.header.join('\u0000'))
		addError(errors, id, 'CSV header needs normalisation');
	if (
		profile.header.join('\u0000') !==
		descriptor.columns.map((column) => column.name).join('\u0000')
	) {
		addError(errors, id, 'CSV header does not match columns in order');
	}
	if (profile.skipped || profile.padded)
		addError(errors, id, 'CSV contains ragged or skipped rows');
	if (profile.rowCount === 0) addError(errors, id, 'CSV has no data rows');
	const columnMap = new Map(profile.columns.map((column) => [column.name, column]));
	for (const column of descriptor.columns) {
		const elected = columnMap.get(column.name);
		if (!elected) continue;
		const overrideAllowed =
			column.dataType === 'text' ||
			(column.dataType === 'categorical' &&
				(elected.type === 'numeric' || elected.type === 'boolean'));
		if (column.dataType !== elected.type && !overrideAllowed)
			addError(
				errors,
				id,
				`column ${column.name} has infeasible dataType ${column.dataType}`
			);
		if (column.dataType !== elected.type && elected.invalidCount !== 0)
			addError(errors, id, `column ${column.name} override has invalid values`);
		if (
			column.implicitMissingValues?.length &&
			column.dataType !== 'numeric' &&
			column.dataType !== 'categorical'
		) {
			addError(
				errors,
				id,
				`column ${column.name} implicitMissingValues require numeric or categorical dataType`
			);
		}
		if (column.valueLabels) {
			const categories = getCategories(elected);
			for (const value of Object.keys(column.valueLabels)) {
				if (column.implicitMissingValues?.some((missing) => String(missing) === value)) {
					addError(
						errors,
						id,
						`column ${column.name} value ${value} is both labelled and implicitly missing`
					);
					continue;
				}
				if (!(value in categories))
					addError(
						errors,
						id,
						`column ${column.name} valueLabels reference unknown value ${value}`
					);
			}
		}
	}
	const byName = new Map(descriptor.columns.map((column) => [column.name, column]));
	const candidates = descriptor.modeling?.targetCandidates ?? [];
	const candidateNames = new Set(candidates.map((candidate) => candidate.column));
	if (!candidateNames.has(descriptor.modeling?.defaultTarget ?? ''))
		addError(errors, id, 'defaultTarget must be a targetCandidates entry');
	for (const candidate of candidates) {
		const authored = byName.get(candidate.column);
		const elected = columnMap.get(candidate.column);
		if (!authored || !elected) {
			addError(errors, id, `target candidate references unknown column ${candidate.column}`);
			continue;
		}
		if (
			authored.role === 'identifier' ||
			elected.identifierHint ||
			authored.dataType === 'text' ||
			isTemporalColumnType(authored.dataType)
		)
			addError(errors, id, `target ${candidate.column} is not eligible`);
		for (const leaky of candidate.leakyColumns ?? []) {
			if (!byName.has(leaky.column))
				addError(errors, id, `leakyColumns reference unknown column ${leaky.column}`);
			if (leaky.column === candidate.column)
				addError(errors, id, `leaky column ${leaky.column} cannot be the target`);
		}
		const categoryCount = elected.distinctCount ?? 0;
		if (
			candidate.taskType === 'binary-classification' &&
			(authored.dataType !== 'categorical' ||
				categoryCount !== 2 ||
				!candidate.positiveClass ||
				!(candidate.positiveClass in getCategories(elected)))
		) {
			addError(
				errors,
				id,
				`target ${candidate.column} does not satisfy binary-classification`
			);
		}
		if (
			candidate.taskType === 'multiclass-classification' &&
			(authored.dataType !== 'categorical' || categoryCount < 3)
		) {
			addError(
				errors,
				id,
				`target ${candidate.column} does not satisfy multiclass-classification`
			);
		}
		if (candidate.taskType === 'regression' && authored.dataType !== 'numeric')
			addError(errors, id, `target ${candidate.column} does not satisfy regression`);
	}
	if (
		descriptor.provenance?.license === 'NOASSERTION'
			? !isRemote
			: descriptor.provenance?.license === 'LicenseRef-Public-Domain'
				? !(
						id === 'titanic-inquiry' &&
						descriptor.buildSource?.transform === 'titanic-inquiry-counts' &&
						descriptor.provenance.licenseUrl ===
							'https://www.nationalarchives.gov.uk/terms-and-conditions/copyright/copyright-and-related-rights/'
					)
				: !ALLOWED_LICENSES.has(descriptor.provenance?.license)
	)
		addError(errors, id, 'licence is outside the allow-list');
	return errors;
}

function buildStats(
	profile: ReturnType<typeof profileCsv>,
	descriptor: AuthoredDatasetDescriptor,
	byteLength: number,
	csvHash: string
): ComputedDatasetStats {
	const stats: ComputedDatasetStats = {
		rowCount: profile.rowCount,
		columnCount: descriptor.columns.length,
		fileSizeBytes: byteLength,
		sha256: csvHash,
		hasMissingValues: profile.columns.some(
			(column) => column.missingCount > 0 || column.invalidCount > 0
		)
	};
	const target = profile.columns.find(
		(column) => column.name === descriptor.modeling.defaultTarget
	);
	if (
		target &&
		descriptor.columns.find((column) => column.name === target.name)?.dataType === 'categorical'
	) {
		stats.defaultTargetDistribution = getCategories(target);
	}
	return stats;
}

function buildSummary(
	descriptor: SampleDatasetDescriptor,
	descriptorUrl: string
): SampleDatasetSummary {
	const taskTypes = [
		...new Set(descriptor.modeling.targetCandidates.map((candidate) => candidate.taskType))
	] as TaskType[];
	return {
		id: descriptor.id,
		name: descriptor.name,
		tagline: descriptor.tagline,
		domain: descriptor.domain,
		difficulty: descriptor.difficulty,
		tags: descriptor.tags,
		taskTypes,
		license: descriptor.provenance.license,
		csvOrigin: descriptor.files.csvOrigin,
		stats: descriptor.stats,
		descriptorUrl
	};
}

/**
 * Validates authored sample datasets and writes the deterministic runtime catalogue.
 *
 * @param outDir - Build output directory receiving `datasets/` files.
 * @param options - Internal fixture and subset controls used by generator tests.
 * @returns Dataset ids built and separated by cache outcome.
 */
export async function generateSampleDatasets(
	outDir: string,
	options: {
		contentDir?: string;
		cacheDir?: string;
		ids?: string[];
		remoteCacheDir?: string;
		fetchImpl?: FetchImpl;
	} = {}
): Promise<SampleDatasetBuildReport> {
	const contentDir = options.contentDir ?? DEFAULT_CONTENT_DIR;
	const cacheDir = options.cacheDir ?? DEFAULT_CACHE_DIR;
	const remoteCacheDir = options.remoteCacheDir ?? DEFAULT_REMOTE_CACHE_DIR;
	const fetchImpl = options.fetchImpl ?? fetch;
	const directories = (await readdir(contentDir, { withFileTypes: true }))
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();
	const selected = options.ids
		? directories.filter((id) => options.ids!.includes(id))
		: directories;
	const errors: string[] = [];
	const report: SampleDatasetBuildReport = { built: [], profiled: [], cached: [] };
	const summaries: SampleDatasetSummary[] = [];
	for (const id of selected) {
		const directory = path.join(contentDir, id);
		const names = await readdir(directory);
		let descriptor: AuthoredDatasetDescriptor | undefined;
		if (names.includes('descriptor.ts')) {
			try {
				const module = await import(
					`${pathToFileURL(path.join(directory, 'descriptor.ts')).href}?build=${++descriptorLoadSequence}`
				);
				descriptor = module.default as AuthoredDatasetDescriptor;
			} catch (error) {
				addError(errors, id, `descriptor.ts could not be loaded: ${String(error)}`);
			}
		}
		if (!descriptor) {
			addError(
				errors,
				id,
				names.includes('metadata.json')
					? 'metadata.json is not allowed; descriptor.ts is required'
					: 'descriptor.ts is required'
			);
			continue;
		}
		const isRemote = Boolean(descriptor.remoteSource);
		const source = descriptor.buildSource ?? descriptor.remoteSource;
		if (
			[
				names.includes('data.csv'),
				Boolean(descriptor.remoteSource),
				Boolean(descriptor.buildSource)
			].filter(Boolean).length !== 1
		) {
			addError(
				errors,
				id,
				'exactly one of data.csv or remoteSource or buildSource is required'
			);
			continue;
		}
		if (
			descriptor.buildSource &&
			!ALLOWED_LICENSES.has(descriptor.provenance.license) &&
			!(
				descriptor.provenance.license === 'LicenseRef-Public-Domain' &&
				id === 'titanic-inquiry' &&
				descriptor.buildSource.transform === 'titanic-inquiry-counts' &&
				descriptor.provenance.licenseUrl ===
					'https://www.nationalarchives.gov.uk/terms-and-conditions/copyright/copyright-and-related-rights/'
			)
		) {
			addError(errors, id, 'licence is outside the allow-list');
			continue;
		}
		if (descriptor.provenance.license === 'NOASSERTION' && !isRemote) {
			addError(errors, id, 'licence is outside the allow-list');
			continue;
		}
		let bytes: Uint8Array;
		try {
			if (source) {
				validateSource(id, source, Boolean(descriptor.buildSource));
				bytes = await acquireSource(id, source, remoteCacheDir, fetchImpl);
				if (descriptor.buildSource) bytes = prepareSource(id, bytes, descriptor);
			} else bytes = await readFile(path.join(directory, 'data.csv'));
		} catch (error) {
			addError(errors, id, String(error));
			continue;
		}

		let text: string;
		try {
			text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
		} catch {
			addError(errors, id, 'data.csv must be valid UTF-8');
			continue;
		}
		const csvHash = sha256(bytes);
		const result = await getProfile(id, text, csvHash, descriptor, cacheDir);
		const profile = result.profile;
		const dsErrors = validateDescriptor(id, directory, descriptor, profile, names, isRemote);
		errors.push(...dsErrors);
		if (!names.includes('datasheet.md')) continue;
		let datasheetSource = '';
		try {
			datasheetSource = await readFile(path.join(directory, 'datasheet.md'), 'utf8');
		} catch {
			/* reported below */
		}
		if (!datasheetSource.trim()) addError(errors, id, 'datasheet.md is missing or empty');
		const compiled = await compileMarkdownFragment(datasheetSource, {
			sourcePath: `${id}/datasheet.md`,
			outDir,
			locale: 'en'
		});
		for (const error of compiled.errors) addError(errors, id, error);
		if (dsErrors.length || compiled.errors.length) continue;
		const stats = buildStats(profile, descriptor, bytes.byteLength, csvHash);
		const { buildSource: _buildSource, ...runtimeDescriptor } = descriptor;
		const outputDescriptor: SampleDatasetDescriptor = {
			...runtimeDescriptor,
			columns: descriptor.columns.map((column: AuthoredColumn) => ({
				...column,
				missingCount:
					profile.columns.find((elected) => elected.name === column.name)?.missingCount ??
					0
			})),
			stats,
			files: {
				csv: descriptor.remoteSource
					? descriptor.remoteSource.url
					: `/datasets/${id}/data.csv?v=${csvHash.slice(0, 12)}`,
				datasheet: `/datasets/${id}/datasheet.html?v=${sha256(new TextEncoder().encode(compiled.html)).slice(0, 12)}`,
				csvOrigin: isRemote ? 'remote' : 'bundled'
			}
		};
		const dir = path.join(outDir, 'datasets', id);
		await mkdir(dir, { recursive: true });
		const descriptorJson = json(outputDescriptor);
		await writeFile(path.join(dir, 'descriptor.json'), descriptorJson);
		await writeFile(path.join(dir, 'datasheet.html'), compiled.html);
		if (!isRemote) await writeFile(path.join(dir, 'data.csv'), bytes);
		const summary = buildSummary(
			outputDescriptor,
			`/datasets/${id}/descriptor.json?v=${sha256(new TextEncoder().encode(descriptorJson)).slice(0, 12)}`
		);
		summaries.push(summary);
		report.built.push(id);
		(result.cached ? report.cached : report.profiled).push(id);
	}
	if (errors.length) {
		for (const error of errors) console.error(error);
		throw new Error(`Sample dataset build failed: ${errors.length} error(s)`);
	}
	summaries.sort((a, b) => {
		const difficulty = ['beginner', 'intermediate', 'advanced'];
		return (
			difficulty.indexOf(a.difficulty) - difficulty.indexOf(b.difficulty) ||
			a.name.localeCompare(b.name, 'en-GB')
		);
	});
	const index: SampleDatasetIndex = { version: 1, entries: summaries };
	await mkdir(path.join(outDir, 'datasets'), { recursive: true });
	await writeFile(path.join(outDir, 'datasets', 'index.json'), json(index));
	return report;
}
