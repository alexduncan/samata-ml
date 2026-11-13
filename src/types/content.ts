import type { Locale } from '../config/locales';

/** Authored prose content domains built into `/content/{locale}/{domain}/`. */
export type ContentDomain = 'pages' | 'models' | 'glossary';

/** Heading metadata extracted from a compiled Markdown fragment for outline navigation. */
export interface ContentHeading {
	/** Unicode-safe slug identifier matching the rendered heading element's `id`. */
	id: string;
	/** Plain-text heading label. */
	text: string;
	/** Heading level inside the fragment (`h2` or `h3`). */
	level: 2 | 3;
}

/** Fields shared by all compiled content index entries. */
interface ContentEntryBase {
	/** Kebab-case file name without extension, unique within its domain across all locales. */
	id: string;
	/** Language the fragment is written in (the base locale when falling back). */
	lang: Locale;
	/** Display title from front matter or the leading `# H1`. */
	title: string;
	/** Plain-text summary from front matter or the truncated first paragraph. */
	description: string;
	/** Root-absolute, cache-busted fragment URL (`/content/{lang}/{domain}/{id}.html?v={12 hex}`). */
	url: string;
	/** Level-2 and level-3 headings in document order. */
	headings: ContentHeading[];
}

/** Index entry for the `pages` domain. */
export interface PageEntry extends ContentEntryBase {
	/** Optional ISO calendar date (`YYYY-MM-DD`) indicating when the page was last updated. */
	updated?: string;
}

/** Index entry for the `models` domain. */
export interface ModelEntry extends ContentEntryBase {
	/** Display sort order (integer, defaults to `1000`). */
	order: number;
}

/** Index entry for the `glossary` domain. */
export interface GlossaryEntry extends ContentEntryBase {
	/** Identifiers of related glossary entries. */
	related: string[];
}

/** Mapping from each {@link ContentDomain} to its typed index entry interface. */
export interface ContentEntryMap {
	pages: PageEntry;
	models: ModelEntry;
	glossary: GlossaryEntry;
}

/** Versioned JSON index written alongside compiled fragments for one locale and domain. */
export interface ContentIndex<D extends ContentDomain> {
	/** Index schema version. */
	version: 1;
	/** Locale this index was built for. */
	locale: Locale;
	/** Content domain represented by this index. */
	domain: D;
	/** Sorted list of entries available in this locale (including base-locale fallbacks). */
	entries: ContentEntryMap[D][];
}
