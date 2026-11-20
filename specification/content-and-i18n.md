# Content & Internationalisation (i18n)

**Status:** partial — the Markdown content pipeline and base-locale UI i18n (`src/i18n.ts` with `$locale` and `$format`) are implemented. Language switcher UI, runtime persistence and additional locales beyond `en` remain target.

## Localisation Store

- Supported locales (`LOCALES` mapping BCP 47 codes to `{ dir: 'ltr' | 'rtl' }`) and `BASE_LOCALE` (`'en'`) are declared in `src/config/locales.ts`.
- The base UI i18n instance is implemented in `src/i18n.ts`:
    - Exports the existing writable `$locale` atom initialised to `BASE_LOCALE` (`'en'`); no new setter or persistence contract.
    - Exports `$format`, the library formatter store for localised numbers, dates, times and lists, and the shared `i18n` instance for base-locale component dictionaries.
    - Connected views consume `$format` for display formatting; presentational components receive pre-translated strings via typed `labels` property dictionaries with explicit default fallbacks.
- Language switcher UI, locale persistence across reload, and translation catalogs for additional locales beyond `en` remain target.
- Connected shell elements own their dictionaries: sidebar navigation/summaries/status, welcome copy/action, and reserved-route fallback titles/close/error. They subscribe through `StoreController`. Sidebar plural messages compose `params(count(...))`, receiving formatted parameters first and the raw numeric count second, so grouped display numbers never choose plural forms. `app-content-dialog` owns no subscriptions and receives typed `ContentDialogLabels`; loaded article titles retain consumer text. The cards retain only their explicitly documented i18n exception.
- `$locale` drives the document's `lang` and `dir`. The shipped supported locale remains English; RTL story fixtures exercise layout without adding a locale or language switcher.

## Static Content

- **Reserved help pages.** The base locale requires `content/en/pages/configure-model.md` for `/help/configure-model` and `content/en/pages/training-setup.md` for `/help/training-setup`. Training Setup opens from the Section 4 heading and form Help links. The [route table](app-state-and-navigation.md#3-route-table) lists the fixed mappings.
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

### Model Descriptions and Dialog Fallback

The model description modal (`app-model-description-dialog`) retrieves articles using `loadContentEntry('models', modelId)`:

- **Authored prose:** When an article exists (e.g. `content/en/models/logistic-regression.md`), the sanitized `DocumentFragment` renders with recorded `lang` and `dir` attributes.
- **Missing prose fallback:** When prose is not yet authored for a model, `loadContentEntry` throws `ContentLoadError` with code `NOT_FOUND`. The dialog sets its status to `missing`, displaying the library JSON plain-text description alongside a clear notice (_"Detailed description is not yet available for this model."_). It does not block the workflow or claim unauthored prose exists.
- **Network errors:** Transport failures set status to `error`, showing an alert message and an accessible "Retry" action. Closing or cancelling the dialog returns focus cleanly to the invoking element.
