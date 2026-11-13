# Content & Internationalisation (i18n)

**Status:** partial — the Markdown content pipeline (locales configuration, build compiler, per-locale/domain JSON indexes, content loader, safe `DocumentFragment` rendering and reserved-route pages) is implemented. `@nanostores/i18n`, the locale store, language switcher UI and additional locales beyond `en` remain target.

## Localisation Store

- Supported locales (`LOCALES` mapping BCP 47 codes to `{ dir: 'ltr' | 'rtl' }`) and `BASE_LOCALE` (`'en'`) are declared in `src/config/locales.ts`.
- All UI text must be routed through `@nanostores/i18n`.
- Lit components must subscribe to the translation store to enable instant, refresh-free language toggling.

## Static Content

- **Source layout:** Authored prose lives in `content/{locale}/{domain}/{id}.md` for the domains `pages`, `models` and `glossary`, using lowercase kebab-case `id` filenames. `en` is the default, complete base locale. Translations in other supported locales are optional. Locale-neutral sample dataset directories (`descriptor.ts`, `datasheet.md`, and either bundled `data.csv` or a remote source) live in `content/datasets/{id}/`; see [sample-datasets.md](sample-datasets.md).
- **Validation and fallback:** Every locale directory under `content/` (other than `datasets`) must appear in `LOCALES`. A translation file whose `id` is missing from the base locale fails the build. At build time, every supported locale receives a complete per-domain index: entries missing in a locale fall back to the base-locale fragment URL and record `lang: BASE_LOCALE` on the entry.
- **Front matter:** Parsed strictly per domain:
    - Common optional fields: `title` (string), `description` (string).
    - `pages`: optional `updated` (`YYYY-MM-DD` string).
    - `models`: optional `order` (integer; defaults to `1000`).
    - `glossary`: optional `related` (array of base-locale glossary `id` strings; allowed in the base locale only).
    - Unknown keys or invalid field values fail the build.
- **Markdown and fragment rules:**
    - A single leading `# H1` supplies `title` if omitted from front matter and is stripped from the fragment body. Additional `# H1` headings, headings at depth > 6, raw HTML tags, unsafe link schemes (`javascript:`, `data:`, `vbscript:`, `file:`) and unknown tags or attributes fail the build.
    - Subheadings (`h2`–`h6`) receive Unicode-safe kebab-case slug `id`s (with duplicate suffixes `-2`, `-3`, …). Level-2 and level-3 headings are extracted into each entry's `headings` list.
    - Links: same-origin paths (root-absolute paths other than `/content/*` and `/datasets/*`), internal `#hash` anchors, and external `http:`/`https:` URLs (assigned `target="_blank"` and `rel="noopener noreferrer"`) are permitted.
    - Images: only same-origin `/assets/...` paths with non-empty `alt` text are permitted.
    - Both the build compiler (`scripts/markdown.ts`) and runtime sanitiser (`src/common/content/sanitise-fragment.ts`) enforce the allow-list in `src/common/content/fragment-policy.ts`.
- **Build output:** `scripts/build-content.ts` writes compiled wrapper-free HTML fragments to `{outDir}/content/{locale}/{domain}/{id}.html` and one versioned index per locale and domain to `{outDir}/content/{locale}/{domain}/index.json` (`{ version: 1, locale, domain, entries }`, with `url` carrying `?v={12 hex}` content hash). Generated files never live in the source tree.
- **Content loader and rendering:** `src/common/content/content-loader.ts` provides `loadContentIndex(domain, opts?)` and `loadContentEntry(domain, id, opts?)` (defaulting `locale` to `BASE_LOCALE`, supporting `AbortSignal` and caching indexes per locale/domain). Consumers parse and sanitise fetched fragments into a `DocumentFragment` and render that node directly—never using `unsafeHTML`, `innerHTML` or string templates—setting `lang` from `entry.lang` and `dir` from `LOCALES[entry.lang].dir`.
