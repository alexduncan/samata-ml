import { stat } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { Marked, type Token, type Tokens } from 'marked';
import {
	FRAGMENT_POLICY,
	isAllowedAttribute,
	isAllowedHref,
	isAllowedImageSrc,
	isExternalHref
} from '../src/common/content/fragment-policy';

const MAX_DESCRIPTION_CODE_POINTS = 160;
const LANGUAGE_CLASS_TOKEN_PATTERN = /^[a-z0-9-]+$/;

/** Options for {@link compileMarkdownFragment}. */
export interface CompileOptions {
	/** Source file path used as the prefix on every reported error. */
	sourcePath: string;
	/** Asset directory root against which root-absolute image paths are verified. */
	outDir: string;
	/** BCP 47 locale tag driving `Intl.Segmenter` word boundaries for description summaries. */
	locale: string;
}

/** Result of compiling one Markdown file into a validated HTML fragment. */
export interface CompiledFragment {
	/** Compiled HTML fragment with leading `# H1` removed and link/table/code rules applied. */
	html: string;
	/** Parsed YAML front matter object. */
	data: Record<string, unknown>;
	/** Plain text of a leading `# H1` heading if present as the first content block. */
	leadingTitle?: string;
	/** Plain text of the first paragraph, cut to at most 160 code points on a word boundary. */
	firstParagraph?: string;
	/** Headings (`h2`–`h6`) in document order with their generated slug identifiers. */
	headings: { id: string; text: string; level: number }[];
	/** Compilation errors collected for this file, each prefixed with `sourcePath`. */
	errors: string[];
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function plainTextFromTokens(tokens: Token[] | undefined): string {
	if (!tokens || tokens.length === 0) {
		return '';
	}
	let result = '';
	for (const token of tokens) {
		switch (token.type) {
			case 'text': {
				const textToken = token as Tokens.Text;
				result += textToken.tokens ? plainTextFromTokens(textToken.tokens) : textToken.text;
				break;
			}
			case 'escape':
			case 'codespan': {
				result += (token as Tokens.Codespan | Tokens.Escape).text;
				break;
			}
			case 'strong':
			case 'em':
			case 'del':
			case 'link': {
				const parentToken = token as Tokens.Strong | Tokens.Em | Tokens.Del | Tokens.Link;
				result += parentToken.tokens
					? plainTextFromTokens(parentToken.tokens)
					: parentToken.text;
				break;
			}
			case 'image': {
				const imgToken = token as Tokens.Image;
				result += imgToken.tokens ? plainTextFromTokens(imgToken.tokens) : imgToken.text;
				break;
			}
			case 'br': {
				result += ' ';
				break;
			}
			default: {
				if ('tokens' in token && Array.isArray(token.tokens)) {
					result += plainTextFromTokens(token.tokens);
				}
				break;
			}
		}
	}
	return result;
}

/**
 * Computes a Unicode-safe slug identifier from heading plain text and ensures uniqueness within one fragment.
 */
function createSlugger(): (text: string) => string {
	const used = new Set<string>();
	return (text: string): string => {
		const normalised = text
			.normalize('NFC')
			.toLowerCase()
			.replace(/[^\p{L}\p{M}\p{N}\s-]/gu, '')
			.trim()
			.replace(/\s+/g, '-')
			.replace(/-+/g, '-')
			.replace(/^-+|-+$/g, '');
		const base = normalised || 'section';
		if (!used.has(base)) {
			used.add(base);
			return base;
		}
		let suffix = 2;
		while (used.has(`${base}-${suffix}`)) {
			suffix++;
		}
		const unique = `${base}-${suffix}`;
		used.add(unique);
		return unique;
	};
}

function truncateDescription(text: string, locale: string): string | undefined {
	const collapsed = text.replace(/\s+/g, ' ').trim();
	if (!collapsed) {
		return undefined;
	}
	const codePoints = Array.from(collapsed);
	if (codePoints.length <= MAX_DESCRIPTION_CODE_POINTS) {
		return collapsed;
	}

	const maxPrefixCodePoints = MAX_DESCRIPTION_CODE_POINTS - 1; // reserve 1 for '…'
	const segmenter = new Intl.Segmenter(locale, { granularity: 'word' });
	let prefixCodePoints = 0;
	let lastWordEndCodeUnits = 0;

	for (const segment of segmenter.segment(collapsed)) {
		const segLength = Array.from(segment.segment).length;
		if (prefixCodePoints + segLength > maxPrefixCodePoints) {
			break;
		}
		prefixCodePoints += segLength;
		if (segment.isWordLike) {
			lastWordEndCodeUnits = segment.index + segment.segment.length;
		}
	}

	const prefix =
		lastWordEndCodeUnits > 0
			? collapsed.slice(0, lastWordEndCodeUnits).trimEnd()
			: codePoints.slice(0, maxPrefixCodePoints).join('').trimEnd();

	return `${prefix}…`;
}

async function fileExistsUnderOutDir(outDir: string, src: string): Promise<boolean> {
	let pathname: string;
	try {
		pathname = new URL(src, 'https://local.invalid').pathname;
	} catch {
		return false;
	}
	const resolvedRoot = path.resolve(outDir);
	const targetPath = path.resolve(resolvedRoot, `.${pathname}`);
	if (!targetPath.startsWith(resolvedRoot + path.sep)) {
		return false;
	}
	try {
		const info = await stat(targetPath);
		return info.isFile();
	} catch {
		return false;
	}
}

function validateRenderedHtml(html: string, sourcePath: string, errors: string[]): void {
	if (/<!doctype\b/i.test(html)) {
		errors.push(`${sourcePath}: output must not contain a doctype`);
	}
	const rewriter = new HTMLRewriter()
		.onDocument({
			doctype() {
				errors.push(`${sourcePath}: output must not contain a doctype`);
			}
		})
		.on('*', {
			element(el) {
				const tag = el.tagName.toLowerCase();
				if (!FRAGMENT_POLICY.elements.has(tag)) {
					errors.push(`${sourcePath}: disallowed HTML element <${tag}>`);
					return;
				}
				for (const [name, value] of el.attributes) {
					if (!isAllowedAttribute(tag, name, value)) {
						errors.push(
							`${sourcePath}: disallowed attribute ${name}="${value}" on <${tag}>`
						);
					}
				}
			}
		});
	rewriter.transform(html);
}

/**
 * Compiles a Markdown document into a validated HTML fragment without touching the global `marked` instance.
 * Collects all front-matter, token, link, image and allow-list errors into `errors` rather than throwing.
 *
 * @param source - Raw Markdown source text, optionally starting with YAML front matter.
 * @param options - Compilation options specifying `sourcePath`, `outDir` and `locale`.
 * @returns The compiled HTML fragment, extracted metadata, headings and collected errors.
 */
export async function compileMarkdownFragment(
	source: string,
	options: CompileOptions
): Promise<CompiledFragment> {
	const { sourcePath, outDir, locale } = options;
	const errors: string[] = [];

	let data: Record<string, unknown> = {};
	let markdownBody = source;
	try {
		const parsed = matter(source);
		if (parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data)) {
			data = parsed.data as Record<string, unknown>;
		} else if (parsed.data !== undefined && parsed.data !== null) {
			errors.push(`${sourcePath}: front matter must be a YAML mapping`);
		}
		markdownBody = parsed.content;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		errors.push(`${sourcePath}: invalid front matter (${message})`);
	}

	const headingIds = new WeakMap<Tokens.Heading, string>();
	const headingIdSet = new Set<string>();
	const headings: { id: string; text: string; level: number }[] = [];
	const slugFor = createSlugger();

	const instance = new Marked({ gfm: true });
	instance.use({
		renderer: {
			heading(headingToken): string {
				const id =
					headingIds.get(headingToken) ??
					slugFor(plainTextFromTokens(headingToken.tokens));
				return `<h${headingToken.depth} id="${escapeHtml(id)}">${this.parser.parseInline(headingToken.tokens)}</h${headingToken.depth}>\n`;
			},
			link({ href, title, text, tokens, autolink }): string {
				const inner = autolink ? escapeHtml(text) : this.parser.parseInline(tokens);
				if (!isAllowedHref(href)) {
					return inner;
				}
				const trimmedHref = href.trim();
				const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
				const externalAttrs = isExternalHref(trimmedHref)
					? ' target="_blank" rel="noopener noreferrer"'
					: '';
				return `<a href="${escapeHtml(trimmedHref)}"${titleAttr}${externalAttrs}>${inner}</a>`;
			},
			image({ href, title, text, tokens }): string {
				const alt = (tokens ? plainTextFromTokens(tokens) : text).trim();
				if (!alt || !isAllowedImageSrc(href)) {
					return '';
				}
				const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
				return `<img src="${escapeHtml(href.trim())}" alt="${escapeHtml(alt)}"${titleAttr}>`;
			},
			tablecell(cell): string {
				const tag = cell.header ? 'th' : 'td';
				return `<${tag}>${this.parser.parseInline(cell.tokens)}</${tag}>\n`;
			},
			code({ text, lang, escaped }): string {
				const rawLang = (lang ?? '').trim().match(/^\S+/)?.[0]?.toLowerCase() ?? '';
				const codeBody = text ? `${text.replace(/\n$/, '')}\n` : '';
				const renderedCode = escaped ? codeBody : escapeHtml(codeBody);
				if (rawLang && LANGUAGE_CLASS_TOKEN_PATTERN.test(rawLang)) {
					return `<pre><code class="language-${rawLang}">${renderedCode}</code></pre>\n`;
				}
				return `<pre><code>${renderedCode}</code></pre>\n`;
			},
			html(): string {
				return '';
			},
			checkbox(): string {
				return '';
			}
		}
	});

	const tokens = instance.lexer(markdownBody);

	let leadingTitle: string | undefined;
	const firstContentIndex = tokens.findIndex((token) => token.type !== 'space');
	if (firstContentIndex !== -1) {
		const firstToken = tokens[firstContentIndex];
		if (
			firstToken &&
			firstToken.type === 'heading' &&
			(firstToken as Tokens.Heading).depth === 1
		) {
			const extracted = plainTextFromTokens((firstToken as Tokens.Heading).tokens).trim();
			if (extracted) {
				leadingTitle = extracted;
			}
			tokens.splice(firstContentIndex, 1);
		}
	}

	const firstParagraphToken = tokens.find(
		(token): token is Tokens.Paragraph => token.type === 'paragraph'
	);
	const firstParagraph = firstParagraphToken
		? truncateDescription(plainTextFromTokens(firstParagraphToken.tokens), locale)
		: undefined;

	const linksToCheck: string[] = [];
	const imagesToCheck: { src: string; alt: string }[] = [];

	instance.walkTokens(tokens, (token) => {
		if (token.type === 'html') {
			errors.push(`${sourcePath}: raw HTML is not allowed`);
			return;
		}
		if (token.type === 'list_item' && (token as Tokens.ListItem).task) {
			errors.push(`${sourcePath}: task-list items are not allowed`);
			return;
		}
		if (token.type === 'heading') {
			const headingToken = token as Tokens.Heading;
			if (headingToken.depth === 1) {
				errors.push(
					`${sourcePath}: body depth-1 heading (# H1) is not allowed outside leading title`
				);
				return;
			}
			const text = plainTextFromTokens(headingToken.tokens).trim();
			const id = slugFor(text);
			headingIds.set(headingToken, id);
			headingIdSet.add(id);
			headings.push({ id, text, level: headingToken.depth });
			return;
		}
		if (token.type === 'link') {
			linksToCheck.push((token as Tokens.Link).href);
			return;
		}
		if (token.type === 'image') {
			const imageToken = token as Tokens.Image;
			const alt = (
				imageToken.tokens ? plainTextFromTokens(imageToken.tokens) : imageToken.text
			).trim();
			imagesToCheck.push({ src: imageToken.href, alt });
		}
	});

	for (const href of linksToCheck) {
		const trimmed = href.trim();
		if (!isAllowedHref(trimmed)) {
			errors.push(`${sourcePath}: disallowed link target "${href}"`);
			continue;
		}
		if (trimmed.startsWith('#')) {
			const targetId = trimmed.slice(1);
			if (!headingIdSet.has(targetId)) {
				errors.push(`${sourcePath}: broken same-fragment anchor "${trimmed}"`);
			}
		}
	}

	for (const { src, alt } of imagesToCheck) {
		if (!alt) {
			errors.push(`${sourcePath}: image "${src}" must have non-empty alt text`);
		}
		if (!isAllowedImageSrc(src)) {
			errors.push(`${sourcePath}: image source "${src}" must be a root-absolute path`);
		} else if (!(await fileExistsUnderOutDir(outDir, src))) {
			errors.push(`${sourcePath}: image "${src}" does not exist under the asset root`);
		}
	}

	const html = instance.parser(tokens);
	validateRenderedHtml(html, sourcePath, errors);

	return {
		html,
		data,
		...(leadingTitle !== undefined ? { leadingTitle } : {}),
		...(firstParagraph !== undefined ? { firstParagraph } : {}),
		headings,
		errors
	};
}
