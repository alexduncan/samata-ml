# Static content pipeline: Markdown fragments, content indexes and the content loader

**Status:** implemented | **Updated:** 2026-11-13T15:02:20Z

## Goal

**Current behaviour:**

- `content/pages/{about,privacy-policy,terms-and-conditions}.md` and `content/models/logistic-regression.md` exist. `scripts/generate-pages.ts` compiles them with `gray-matter` and the global `marked` instance into TypeScript modules in the git-ignored `src/generated/` (`pages/*.ts`, `routes.ts`). Nothing in `src/` imports them. `scripts/build.ts` and `scripts/server.ts` call `generateStaticPages()` before every build.
- `src/features/navigation/app-content-modal.ts` hard-codes the copy for `/about`, `/privacy` and `/help` in Lit templates. The Markdown says "WebML"; the modal says "samatā.ml".
- 12 sample datasets were committed to `public/datasets/{id}/` (`metadata.json`, `data.csv`, `datasheet.md`). `copyDirContents(PUBLIC_DIR, …)` in `scripts/build-assets.ts` copies all of `public/` verbatim, so every authoring file (Markdown and authoring JSON) ships to production.
- The draft plan [data-ingestion-and-storage](data-ingestion-and-storage.md) D10/R1 already decided that sample datasets are authored in `content/datasets/{id}/` and that the build writes `/datasets/manifest.json`, `descriptor.json`, `datasheet.html` and `data.csv` into the output. The committed files contradict it.
- `public/_headers` sets security headers for `/*` only. `scripts/static-server.ts` serves `.json` and `.csv` as `application/octet-stream`.
- Specs disagree with the code: [content-and-i18n.md](../content-and-i18n.md) says `/content-src/<locale>/` compiled to TypeScript in `src/content-compiled/`, and ARCHITECTURE lists `/content-src/` ([Known gap](../README.md#known-gaps) 4).

**Target behaviour:**

- All authored content lives under `content/`. Prose is localised: `content/{locale}/{domain}/{id}.md` for the domains `pages`, `models` and `glossary`, with English (`en`) as the first, default and base locale, and the only one shipped now. Sample datasets are locale-neutral data in `content/datasets/{id}/`. `public/` holds only files that are served unchanged.
- The build compiles each Markdown file into an **HTML fragment** (no document wrapper) and one versioned **`index.json` per locale and domain**, written straight into the build output (`dev/` or `dist/`), never into the source tree. Nothing generated is committed or git-ignored in the source tree. Every supported locale gets a complete index: an entry with no translation falls back, at build time, to the base-locale fragment, and the entry says which language it is in.
- The output URL layout is `/content/{locale}/{domain}/{id}.html` with `/content/{locale}/{domain}/index.json` beside it. Sample datasets keep their own tree, `/datasets/` (owned by data-ingestion-and-storage), with `/datasets/{id}/datasheet.html` compiled by the same Markdown compiler and the catalogue at `/datasets/index.json`.
- The build fails, listing every error, on invalid front matter, raw HTML, a body `# H1` other than a leading title, task lists, broken same-fragment anchors, disallowed link schemes, missing or external images, unknown related ids and reserved routes without a page.
- A framework-free content loader fetches each index once per session, fetches fragments by id, parses them inertly, enforces the same element and attribute allow-list the build checked, and returns a `DocumentFragment`. No component uses `unsafeHTML` or `innerHTML`.
- `<app-content-modal>` renders `/about`, `/privacy` and `/help` from `content/en/pages/` through the loader.
- Production responses under `/content/*` and `/datasets/*` carry `X-Robots-Tag: noindex, nofollow`.

**Why:** content becomes editable without touching TypeScript, one safe pipeline serves every dialog that shows prose (reserved routes now; datasheets, model descriptions and glossary later), source files stop shipping to production, and Known gap 4 closes.

## Scope

**In scope**

- Directory rules for authored content; moving `public/datasets/` to `content/datasets/` unchanged.
- A shared Markdown-to-fragment compiler (`scripts/markdown.ts`) that data-ingestion-and-storage's dataset generator will call for datasheets.
- The content build for `pages`, `models` and `glossary`: fragments, `index.json`, validation, integration into the dev and production builds; retiring `scripts/generate-pages.ts` and `src/generated/`.
- Shared index types, the fragment allow-list, the reserved-route → page map and the supported-locale list (`src/config/locales.ts`, `en` only).
- Locale-aware content: the `content/{locale}/` layout, build-time fallback to the base locale, Unicode-safe heading ids and descriptions, a `locale` option on the loader, and `lang`/`dir` on rendered content.
- The runtime content loader and fragment sanitiser.
- Rewiring `<app-content-modal>` to render pages from the loader; creating `content/en/pages/help.md` from the copy the modal shows today.
- `X-Robots-Tag` rules in `public/_headers`; `.json` and `.csv` content types in the dev server.
- An unstyled draft mockup of the content dialog body (written by this plan: `specification/mockups/ui-scaffold/drafts/00-2_content-modal.html`).

**Out of scope**

- Sample-dataset validation, profiling, `descriptor.json`, the dataset catalogue fields and copying `data.csv` into the output: all owned by [data-ingestion-and-storage](data-ingestion-and-storage.md) (D10, T8). This plan fixes only where those files live and which compiler renders datasheets.
- The datasheet dialog (step-1 plan), Model Description dialog (step-3 plan), glossary UI and help triggers (TODO-40 has no spec).
- The rest of localisation (TODO-46): which further locales ship, translations, the locale store (`src/i18n.ts`, COMPONENTS §8), the language switcher, detecting stale translations, and localising UI strings or datasheets. The content modal uses the base locale until the locale store exists.
- Long-lived `Cache-Control` for content and service-worker precaching (TODO-45). Responses keep the host's default revalidation.
- Styling prose inside dialogs (awaiting a styled mockup), the modal's existing fallback tokens (Known gap 13, `scaffolding-visual-remediation`), and the router's shadow-DOM link interception (see _Risks_).
- A `robots.txt` file. None is added, and content paths must never be `Disallow`ed.

**Constraints and invariants**

- CSP in `public/_headers` stays unchanged: `script-src 'self'`, `script-src-attr 'none'`, `img-src 'self' data: blob:`, `connect-src 'self'`. Fragments therefore contain no scripts, no event-handler attributes and no third-party images.
- Reserved routes stay real history entries reached by `<a href="/about">` etc. and are never persisted (app-state-and-navigation §3, §5.4). Fragment and index URLs never appear in an `href`; anything that opens a dialog without a URL uses a `<button type="button">`.
- The reserved-route → page mapping lives in router configuration, not in content front matter (app-state-and-navigation §3).
- `bun run build` and `bun run server` behave as now apart from the new outputs; the dev server's existing watcher (which already watches `content/` and ignores `dev/`) triggers rebuilds. No second watcher.
- No new dependencies: `marked@18.1.1` and `gray-matter@4.0.3` are installed; Bun's built-in `HTMLRewriter` and `Bun.CryptoHasher` cover parsing and hashing.

## Required reading

The implementer reads only these, plus each task's likely files. Everything else is optional.

- This plan's _Technical decisions_ and _Interfaces and behaviour_ — the whole contract.
- `specification/app-state-and-navigation.md` §3 (route table and the "mapping lives in the router" rule), §5.4 (reserved routes as modals) — T1, T6.
- `specification/COMPONENTS.md` §3–§9 — T6 (Lit). Note §4 "Do not use `unsafeHTML`".
- `specification/content-and-i18n.md` (short; superseded by D12 where they differ) and `specification/COMPONENTS.md` §8 — T1 (locale codes), T6 (`lang`/`dir`).
- `specification/visual-design.md` §1.1 "Building against a draft" — T6 styling limits.
- `specification/mockups/ui-scaffold/drafts/00-2_content-modal.html` — T6 structure and copy (draft, unstyled).
- `scripts/build-assets.ts` (whole file), `scripts/build.ts`, `scripts/server.ts` lines 150–215 and 285–330 — T4 integration points.
- `src/router/route-parser.ts` — pure; T1 imports `ReservedPath` only.
- `tests/setup.ts` — happy-dom is preloaded for `bun test` (T5); `bunfig.toml` excludes `tests/app-shell.test.ts` from `bun test`.
- `tests/app-shell.test.ts` lines 64–87 (NAV-E2E-3) — T6 changes one assertion.
- `specification/plans/data-ingestion-and-storage.md` rows D10 and D16 — T3/T4 coordination only; do not implement anything from it.

## Codebase context

Facts the planner verified, so the implementer need not re-check them.

- **Relevant implementation:**
    - `scripts/generate-pages.ts` — to be deleted; called from `scripts/build.ts:10` and `scripts/server.ts` (`buildInitial`, `rebuildNow`).
    - `scripts/build-assets.ts` — `buildDevBundle()` and `buildProductionBundle()` both `resetDir(out)` then `copyDirContents(PUBLIC_DIR, out)`. Because the output is reset each build, stale fragments cannot linger; no separate clean step is needed.
    - `scripts/server.ts` — watches `src/`, `css/`, `public/`, `content/`; ignores events under `dev/`, `dist/`, `.cert/`; debounces 250 ms and rebuilds everything.
    - `scripts/static-server.ts` `contentTypeFromPath` — lacks `.json` and `.csv`.
    - `src/features/navigation/app-content-modal.ts` — connected component (`StoreController` on `$route`), `<dialog aria-labelledby="content-modal-title">`, heading `<h2>`, close button `.close-btn`; listed in `KNOWN_DRIFT` in `tests/style-tokens.test.ts` (TOK-4 requires every drift file to keep failing a guard: do not remove its fallbacks in this plan).
    - `src/router/router.ts:220-245` `handleClick` uses `(event.target as Element).closest('a')`. At a `document` listener, a click inside a shadow root is retargeted to the host, so links inside shadow DOM (the sidebar's, and any inside a dialog) are not intercepted and cause a full page load. Out of scope here (see _Risks_).
    - `content/*/*.md` front matter uses `title` and `short_title`; each body starts with `# <title>`. Dataset `datasheet.md` files use Hugging Face-style front matter (`pretty_name`, `license`, …) and start with `# <name>` after it. No content file contains raw HTML in its body (the only `<` characters are inside YAML front matter, e.g. `"10K<n<100K"`). No content file contains relative links or images.
    - `public/datasets/` holds 12 folders; the largest CSV is 4.4 MB (`bank-marketing`).
    - `wrangler.jsonc` serves `./dist` as Workers static assets with `not_found_handling: "single-page-application"`: a request for a missing file can be answered with `index.html` and status 200, so the loader must not trust a 200 alone.
- **Tests and commands:** baseline from `AGENTS.md`: `bun run check` passes (0 type errors, 52 tests); `bun run build` passes. Playwright runs `tests/*.e2e.ts` and `tests/app-shell.test.ts` via `bun run test:e2e` and starts the dev server itself.
- **Web guidance:** `sanitize-untrusted-html` — the Sanitizer API (`setHTML`, `Document.parseHTML`) is "Limited availability" (no Safari), so it is not used; the guide's rule "move the resulting nodes into the page rather than serializing them to a string and re-parsing" is adopted (no `innerHTML` round trip). `trusted-types` — Baseline Newly available (2026-02-24), so CSP enforcement is not added; the loader writes to no HTML sink, so a later `require-trusted-types-for 'script'` needs no change here. `dialog` — consulted; §5.4 of the navigation spec already encodes its rules and this plan does not change dialog behaviour.
- **Visual reference:** draft: `specification/mockups/ui-scaffold/drafts/00-2_content-modal.html` (unstyled; visual-design §1.1). Existing patterns it reuses: `.modal`, `.modal-header`, `.modal-header h1`, `.modal-content` in `specification/mockups/ui-scaffold/css/modal.css`. No parity entries for prose (draft-only).
- **Lit skills:** implementers use `lit-implementer` for T6.
- **Locales today:** `index.html` has `<html lang="en">`. `@nanostores/i18n@0.10.0` is installed but unused; its `browser({ available, fallback })` matches `navigator.languages` exactly and defaults `fallback` to `'en'`. COMPONENTS §8 says the future locale store drives `lang` and `dir` on `<html>`; `src/i18n.ts` does not exist. content-and-i18n.md's example locale codes are `en` and `es`.
- **Known gaps decided:** Known gap 4 — `content/{locale}/` (no `-src`; locale codes as in content-and-i18n.md, base `en`), compiled to HTML fragments and JSON indexes in the build output, not TypeScript. Reserved-route copy moves out of `app-content-modal.ts`.
- **TODOs decided by approval:** TODO-20 (first half): create `content/en/pages/help.md`, from the help copy the modal shows today. `terms-and-conditions.md` stays a page with no route (second half stays open). TODO-46 (part): the content layout, fallback and loader contract for localisation, with `en` as the base locale; which other locales ship stays open.
- **Assumptions requiring verification:** Cloudflare's `_headers` merges headers from every matching rule and joins duplicate header names with commas. This plan therefore sets each header in only one rule per path. T4 verifies the rule syntax against the built `dist/_headers`; production behaviour is checked manually after deploy.

### Review of the input notes

[build-static-content.md](../notes/build-static-content.md) (B) and [static-content-indexes.md](../notes/static-content-indexes.md) (I). What this plan keeps, changes and drops, and why.

| #   | Note says                                                                                   | Assessment                                                                                                                                                                                                                | Decision                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| N1  | Keep authored Markdown separate from build output (B §1)                                    | Right, but B and I then put `datasheet.md`, `metadata.json` and the compiled `datasheet.html` in `public/datasets/`, which ships sources and mixes authored with generated files: the note contradicts its own rule.      | Kept, applied consistently: every authored file lives in `content/`, including datasets (D1).                                                                                        |
| N2  | Write fragments and indexes into `public/fragments/`, `public/indexes/` and git-ignore them | Generated files in a watched source directory need git-ignore globs and cause rebuild loops (I §4.2.6 has to work around this), and a "clean stale artefacts" step.                                                       | Write straight into the build output, which every build already resets (D2). No git-ignore entries, no loop, no clean step.                                                          |
| N3  | Separate `/fragments/{domain}/` and `/indexes/{domain}.json` trees                          | Splits each domain across two trees and needs three header rules. A single fetch contract is just as easy with the index beside its fragments.                                                                            | `/content/{locale}/{domain}/index.json` beside `/content/{locale}/{domain}/{id}.html` (D3); one `X-Robots-Tag` rule.                                                                 |
| N4  | Emit fragments, not documents; external links open in a new tab with `noopener noreferrer`  | Right. The new-tab rule protects in-memory worker state.                                                                                                                                                                  | Kept (D5).                                                                                                                                                                           |
| N5  | "Fragments inherit your application's typography" automatically                             | Not inside shadow DOM: only inherited properties (font, colour) cross the boundary; margins, lists and tables need styles in the component.                                                                               | Prose styling is awaiting a styled mockup (draft written). Until then the dialog uses inherited text styles only (visual-design §1.1).                                               |
| N6  | Heading ids via `marked-gfm-heading-id`                                                     | A new dependency for ~20 lines of slug code.                                                                                                                                                                              | In-house slugger in the compiler (D5).                                                                                                                                               |
| N7  | `X-Robots-Tag: noindex, nofollow`; never `Disallow` fragments in `robots.txt`               | Right.                                                                                                                                                                                                                    | Kept (D8). Applied to `/content/*` and `/datasets/*` (CSV and JSON are not useful search results either).                                                                            |
| N8  | Trigger dialogs with `<button data-…>`, never `<a href>`                                    | Right for fragment URLs and transient dialogs, but reserved routes (`/about`, `/privacy`, `/help`) are real history entries and must stay `<a href>` (navigation spec §3, §5.4). The app-shell URL is not a fragment URL. | Kept with that distinction (constraint above).                                                                                                                                       |
| N9  | `Cache-Control: max-age=3600` on fragments; `?v=<hash>` cache busting; 8-character hash     | A fixed `max-age` on a mutable URL can serve stale content for an hour, and the same header in overlapping `_headers` rules is comma-joined. Hashes elsewhere in the repo use 10–12 characters.                           | No `Cache-Control` changes (TODO-45 owns caching). Index URLs carry `?v=<12-hex SHA-256>`, matching data-ingestion D10, so a later immutable policy needs only a header change (D7). |
| N10 | Separate `--watch` mode with its own `fs.watch`                                             | `bun run server` already watches `content/` with debounce and duplicate-event filtering.                                                                                                                                  | Dropped; the content build runs inside the existing dev rebuild (D2).                                                                                                                |
| N11 | `predev`/`prebuild` package hooks                                                           | There is no `dev` script, and hooks run separately from the build that resets the output directory.                                                                                                                       | The build functions call `buildContent(outDir)` directly (D2).                                                                                                                       |
| N12 | `datasets.json` fields mapped from `metadata.json` (`taskType` from `targetCandidates`, …)  | Owned by data-ingestion-and-storage (`SampleDatasetSummary`); `taskType` cannot come from an array of candidates. Duplicating that contract here would create two sources of truth.                                       | Dropped from this plan; only the file name and location are aligned (D3, _Risks_).                                                                                                   |
| N13 | `pages.json` `navGroup` and `order` drive navigation from front matter                      | Contradicts navigation spec §3 ("the mapping lives in the router configuration, not in the content"); the footer links are fixed by the route table.                                                                      | Dropped. `src/router/reserved-content.ts` maps routes to page ids (D6).                                                                                                              |
| N14 | Models as one `card.md` with sections, or per-model files                                   | One file per model gives one dialog per model and one index entry per model id.                                                                                                                                           | One file per model, id = file name (`logistic-regression`). Ids must later match the `web-ml` model ids (_Risks_).                                                                   |
| N15 | A `help` domain for contextual help                                                         | Clashes with the reserved `/help` page (`content/en/pages/help.md`). The examples (`roc-auc`, `target-leakage`) are term definitions, matching VISION §4's glossary.                                                      | Domain named `glossary` (D4). Its UI waits for TODO-40; the build and index support it now.                                                                                          |
| N16 | Title fallback to the title-cased file name; description fallback to first paragraph        | A silent file-name fallback hides a missing title.                                                                                                                                                                        | Title from front matter or a leading `# H1`, otherwise a build error. Description fallback kept (D4).                                                                                |
| N17 | Link validation: relative links must exist under `public/`                                  | Must also cover heading anchors, schemes and images (CSP blocks third-party images). Links to app routes inside shadow DOM currently bypass the router (see _Codebase context_).                                          | Stricter rule set (D5); app-route links rejected for now.                                                                                                                            |
| N18 | Nothing on HTML safety                                                                      | Lit forbids `unsafeHTML` here (COMPONENTS §4), and `marked` passes raw HTML through. A first-party pipeline still needs a guard against accidental markup.                                                                | No raw HTML in Markdown; build-time allow-list check; runtime inert parse and the same allow-list (D9).                                                                              |

## Technical decisions

| Decision                       | Chosen approach and rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Rejected alternative / trade-off                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 Authored content location   | Prose: `content/{locale}/{domain}/{id}.md`, i.e. `content/en/pages/{id}.md`, `content/en/models/{id}.md`, `content/en/glossary/{id}.md` (D12). Data: `content/datasets/{id}/` (the 12 folders moved unchanged from `public/datasets/`; locale-neutral). The only other entries allowed directly under `content/` are supported locale codes. `public/` keeps only files served unchanged (`_headers`, `assets/`). Matches data-ingestion D10/R1.                                                                                                                                                                                                                                                                                                                                                                                                               | `public/datasets/` (the notes): ships sources, mixes generated and authored files. `content-src/<locale>/` (current spec): `-src` adds nothing. `content/{domain}/{id}.{locale}.md` suffixes: the base file's language is implicit, and a translator cannot work in one tree.                                                                                          |
| D2 Where output is written     | `scripts/build-content.ts` exports `buildContent(outDir: string)`, which resolves to a `ContentBuildReport`. `buildDevBundle()` and `buildProductionBundle()` call it right after `copyDirContents(PUBLIC_DIR, outDir)` (so image checks see `public/assets`). Output never touches the source tree. `generate-pages.ts`, its calls and the `/src/generated/` ignore line are removed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `public/fragments/` + git-ignore (notes). Generated TypeScript in `src/` (current code): content changes rebuild JS, git-ignored imports break `tsc` on a fresh clone, and HTML still needs injecting.                                                                                                                                                                 |
| D3 Output URL layout           | `/content/{locale}/{domain}/{id}.html` and `/content/{locale}/{domain}/index.json`. Sample datasets: `/datasets/{id}/datasheet.html` and the catalogue at **`/datasets/index.json`** (renamed from data-ingestion's `manifest.json`): one name for every index, and no confusion with the planned web app manifest. Every supported locale gets an index for every domain; a domain with no base-locale directory gets `entries: []`.                                                                                                                                                                                                                                                                                                                                                                                                                          | `/fragments/` + `/indexes/` (notes): two trees per domain. `/content/datasets/{id}.html`: splits a dataset's files across trees. `/content/{domain}/{locale}/`: a locale's files would be spread over three trees.                                                                                                                                                     |
| D4 Domains and front matter    | Domains `pages`, `models`, `glossary`. Front matter is strict: unknown keys fail. `pages`: `title?`, `description?`, `updated?` (ISO calendar date, e.g. `2026-11-13`). `models`: `title?`, `description?`, `order?` (integer, default 1000). `glossary`: `title?`, `description` (required; it is the short definition), `related?` (glossary ids). `order` and `related` are locale-neutral: set only in the base locale, and an error in a translation. Title = `title`, else the leading `# H1`; neither is an error. Description = `description`, else the first paragraph's plain text cut to ≤ 160 code points at a word boundary found with `Intl.Segmenter(locale, { granularity: 'word' })`, with `…` appended when cut.                                                                                                                             | Per-domain extras from the notes (`category`, `topic`, `navGroup`, `lastUpdated`): no spec or UI uses them. Cutting at the last space: fails for scripts without spaces.                                                                                                                                                                                               |
| D5 Markdown compiler           | `scripts/markdown.ts` exports `compileMarkdownFragment(source, options)`. A private `new Marked({ gfm: true })` instance (never the global). Front matter via `gray-matter`, stripped before rendering. A leading `# H1` is removed and returned as `leadingTitle`; any other H1 is an error. Headings h2–h6 get Unicode-safe slug ids (compiler rule 4), so translated headings keep usable anchors. External `http(s)` links get `target="_blank" rel="noopener noreferrer"`. Table cells get no `align`. Code blocks keep only `class="language-…"`. Errors are collected, not thrown one by one.                                                                                                                                                                                                                                                           | `marked-gfm-heading-id` and a sanitiser library: new dependencies. ASCII-only slugs: every heading in a non-Latin script would become `section`, `section-2`, …. Allowing raw HTML: needs a full sanitiser and a design decision per element.                                                                                                                          |
| D6 Reserved-route map          | `src/router/reserved-content.ts` exports `RESERVED_CONTENT` (a read-only record keyed by every `ReservedPath`) `= { '/about': 'about', '/privacy': 'privacy-policy', '/help': 'help' }`. The build fails if any value has no `content/{base locale}/pages/{id}.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `navGroup` front matter (N13). Renaming `privacy-policy.md` to `privacy.md`: the map makes it unnecessary.                                                                                                                                                                                                                                                             |
| D7 Index shape and versioning  | Each `index.json` is `{ "version": 1, "locale": "<locale>", "domain": "<domain>", "entries": [...] }`, and each entry carries `lang`, the locale its fragment is written in. Every entry's `url` is root-absolute with `?v=<first 12 hex of SHA-256 of the fragment>` (as data-ingestion D10 does for files). No separate `hash` field. Output is deterministic: entries sorted, `JSON.stringify(…, null, '\t')`, no timestamps.                                                                                                                                                                                                                                                                                                                                                                                                                               | Bare arrays (notes): no room for a version check. Separate `hash` field: duplicates the URL.                                                                                                                                                                                                                                                                           |
| D8 Crawler and caching headers | `public/_headers` gains `/content/*` and `/datasets/*` rules, each setting only `X-Robots-Tag: noindex, nofollow`. No `Cache-Control` (host default revalidation; TODO-45). No `robots.txt`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Per-path `Cache-Control` (notes): overlapping rules comma-join, and caching policy belongs to TODO-45.                                                                                                                                                                                                                                                                 |
| D9 Safe rendering              | **Build:** reject raw HTML tokens and task lists; check the rendered fragment with Bun's `HTMLRewriter` against `FRAGMENT_POLICY`. **Runtime:** `sanitiseFragment(html)` parses with `new DOMParser().parseFromString(html, 'text/html')` (inert: no scripts run, no images load), walks `body`, removes any element not in the policy together with its content, removes any attribute not allowed, re-applies the link rules, and moves the nodes into a `DocumentFragment` (no string round trip). Components render that node; never `unsafeHTML` or `innerHTML`.                                                                                                                                                                                                                                                                                          | `unsafeHTML` with trusted first-party HTML: breaks COMPONENTS §4 and has no guard against a bad commit. Sanitizer API: not in Safari. DOMPurify: a dependency for a first-party allow-list. A JSON AST rendered by Lit templates: safest, but a custom format and renderer for every Markdown construct; reconsider if the content ever accepts outside contributions. |
| D10 Content loader             | `src/common/content/content-loader.ts`: framework-free, takes an optional `locale` (default `BASE_LOCALE`), one module-level `Map` of index promises keyed by locale and domain (one fetch per locale and domain per page load; a failed fetch is evicted so a retry can succeed) and one of sanitised template fragments keyed by URL. Callers get a fresh `cloneNode(true)` each time. Used by the content modal now and by the datasheet, model description and glossary dialogs later (three specified call sites, COMPONENTS §3).                                                                                                                                                                                                                                                                                                                         | Fetching in each component: duplicates the cache and safety rules.                                                                                                                                                                                                                                                                                                     |
| D11 Dialog title and headings  | The dialog heading is the entry's `title`, rendered as `<h1>` in the modal header (as `.modal-header h1` in the mockups). Fragment bodies start at `<h2>`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Keeping `<h2>` for the title: body `##` headings would be siblings of the title. Shifting body headings down a level: surprises authors.                                                                                                                                                                                                                               |
| D12 Localisation               | `src/config/locales.ts` is the one list of supported locales: `LOCALES = { en: { dir: 'ltr' } }`, `type Locale = keyof typeof LOCALES`, `BASE_LOCALE = 'en'`. Codes are BCP 47 language tags as in content-and-i18n.md and `<html lang="en">`; prose is British English by house style. The base locale is complete and the source of truth: a translation with no base file is an error, and a base entry with no translation is copied into that locale's index unchanged (its `url` points at `/content/en/…` and its `lang` is `en`), so every locale's index lists the same ids. The future locale store (`src/i18n.ts`) imports this list; adding a locale is a new `LOCALES` key plus a `content/{code}/` tree. Rendered content carries `lang` and `dir` from its entry, so a fallback page inside a translated UI is announced in the right language. | Runtime fallback (the loader tries the user's locale, then `en`): two requests and a 404 per missing translation, and `not_found_handling` may return 200 (see _Codebase context_). `en-GB` as the code: `browser()` matches exactly, so `en-US` users would still get the fallback, and the spec and `index.html` already use `en`.                                   |

### Interfaces and behaviour

**Types (`src/types/content.ts`)**

**Locales (`src/config/locales.ts`, pure data)**

```ts
export const LOCALES = { en: { dir: 'ltr' } } as const satisfies Readonly<
	Record<string, { readonly dir: 'ltr' | 'rtl' }>
>;
export type Locale = keyof typeof LOCALES;
export const BASE_LOCALE: Locale = 'en';
export function isLocale(value: string): value is Locale;
```

**Types (`src/types/content.ts`)**

```ts
import type { Locale } from '../config/locales';
export type ContentDomain = 'pages' | 'models' | 'glossary';
export interface ContentHeading {
	id: string;
	text: string;
	level: 2 | 3;
}
interface ContentEntryBase {
	id: string; // kebab-case file name, unique in its domain, the same in every locale
	lang: Locale; // the language the fragment is written in (the base locale for a fallback)
	title: string;
	description: string;
	url: string; // '/content/{lang}/{domain}/{id}.html?v={12 hex}'
	headings: ContentHeading[]; // h2 and h3 only, in document order
}
export interface PageEntry extends ContentEntryBase {
	updated?: string;
} // ISO calendar date, e.g. '2026-11-13'
export interface ModelEntry extends ContentEntryBase {
	order: number;
}
export interface GlossaryEntry extends ContentEntryBase {
	related: string[];
}
export interface ContentEntryMap {
	pages: PageEntry;
	models: ModelEntry;
	glossary: GlossaryEntry;
}
export interface ContentIndex<D extends ContentDomain> {
	version: 1;
	locale: Locale; // the locale this index was built for
	domain: D;
	entries: ContentEntryMap[D][];
}
```

Every export has TSDoc. Sorting, per index: `pages` and `glossary` by `title` with `localeCompare(…, locale)`; `models` by `order`, then `title`.

**Fragment policy (`src/common/content/fragment-policy.ts`, pure data and predicates, no DOM)**

- Elements: `p h2 h3 h4 h5 h6 ul ol li a strong em del code pre blockquote hr br table thead tbody tr th td img`.
- Attributes: `id` on `h2`–`h6`; `href`, `title`, `target`, `rel` on `a`; `src`, `alt`, `title` on `img`; `class` on `code` only when it matches `^language-[a-z0-9-]+$`; `start` on `ol`.
- `isExternalHref(href)`: `https:` or `http:`. `isAllowedHref(href)`: external, `mailto:`, or `#<id>`. External links must carry exactly `target="_blank"` and `rel="noopener noreferrer"` (the sanitiser sets them; the build checks them).
- `isAllowedImageSrc(src)`: root-absolute path (`/…`, not `//…`).

**Compiler (`scripts/markdown.ts`)**

```ts
export interface CompileOptions {
	sourcePath: string;
	outDir: string; // for image existence checks
	locale: string; // BCP 47 tag; drives Intl.Segmenter for the description
}
export interface CompiledFragment {
	html: string;
	data: Record<string, unknown>; // parsed front matter
	leadingTitle?: string;
	firstParagraph?: string; // plain text
	headings: { id: string; text: string; level: number }[];
	errors: string[]; // each prefixed with sourcePath
}
export function compileMarkdownFragment(
	source: string,
	options: CompileOptions
): Promise<CompiledFragment>;
```

Rules (each failure appends to `errors`; compilation continues):

1. Raw HTML tokens (`html` block or inline) → error "raw HTML is not allowed".
2. Task-list items → error.
3. A first token `heading` of depth 1 is removed and becomes `leadingTitle`; any other depth-1 heading → error.
4. Heading ids: plain text of the heading, NFC-normalised, `toLowerCase()`; remove every character that is not a letter, mark, number, whitespace or `-` (`/[^\p{L}\p{M}\p{N}\s-]/gu`); whitespace runs → `-`; collapse and trim `-`; empty → `section`; duplicates in one fragment get `-2`, `-3`, …. Letters with diacritics and non-Latin scripts are kept.
5. Links: external → new-tab attributes; `mailto:` → unchanged; `#id` → must match a heading id in the same fragment; anything else (relative, root-relative, `//`, `javascript:`, `data:`) → error. Root-relative app-route links are rejected until the router intercepts links inside shadow roots (_Risks_).
6. Images: `src` must be root-absolute and exist under `outDir`; `alt` must be non-empty.
7. The rendered HTML is walked with `HTMLRewriter`; any element or attribute outside `FRAGMENT_POLICY` → error. The output must not contain `<html`, `<head`, `<body` or a doctype.

**Content build (`scripts/build-content.ts`)**

- `buildContent(outDir, options?)`; `options.contentDir` (default `content`) and `options.locales` (default `Object.keys(LOCALES)`, base first) exist so tests can use fixtures and a second locale. The base locale is `options.locales[0]`.
- Entries directly under the content directory must be `datasets` or a locale in `options.locales`; anything else → error. A supported locale with no directory is allowed (its indexes are all fallbacks).
- Base locale, for each domain: read `content/{base}/{domain}/*.md` (a missing directory = no entries; a subdirectory or a file name not matching `^[a-z0-9]+(?:-[a-z0-9]+)*\.md$` → error). Validate front matter per D4; check `related` ids exist in `glossary` and are not the entry itself; compile with `locale: base`; write `outDir/content/{base}/{domain}/{id}.html`.
- Each other locale, for each domain: the same file-name rules; a file whose id has no base file → error; `order` or `related` in front matter → error (D4); compile with that locale and write `outDir/content/{locale}/{domain}/{id}.html`, `lang` = that locale, `order` and `related` copied from the base entry. Base entries with no translation are copied into the index unchanged (D12).
- Then write `outDir/content/{locale}/{domain}/index.json` for every locale and domain.
- Check `RESERVED_CONTENT` values all exist in the base locale's `pages`.
- Collect every error from every file; if any, print them all and throw `Error('Content build failed: <n> error(s)')` before writing any index.
- Return a `ContentBuildReport` `{ locales }` holding, per locale and `ContentDomain`, the entry count and how many are fallbacks, for the build log.
- `content/datasets/` is not read by this script (data-ingestion's generator owns it and calls `compileMarkdownFragment` for each `datasheet.md`).

**Loader (`src/common/content/content-loader.ts`)**

```ts
export type ContentLoadErrorCode = 'NETWORK' | 'NOT_FOUND' | 'INVALID_INDEX' | 'INVALID_FRAGMENT';
export class ContentLoadError extends Error {
	readonly code: ContentLoadErrorCode;
}
export interface ContentLoadInit {
	locale?: Locale; // default BASE_LOCALE
	signal?: AbortSignal;
}
export function loadContentIndex<D extends ContentDomain>(
	domain: D,
	init?: ContentLoadInit
): Promise<ContentIndex<D>>;
export function loadContentEntry<D extends ContentDomain>(
	domain: D,
	id: string,
	init?: ContentLoadInit
): Promise<{ entry: ContentEntryMap[D]; content: DocumentFragment }>;
```

- Index: `fetch('/content/{locale}/{domain}/index.json')`; non-OK → `NOT_FOUND`; fetch rejection → `NETWORK`; `version !== 1`, `locale` or `domain` mismatch, no `entries` array, or an entry whose `lang` is not a supported locale → `INVALID_INDEX`. Fragments are cached by URL, so fallback entries in several locales share one fetch.
- Entry: unknown `id` → `NOT_FOUND`. Fragment fetch: non-OK → `NOT_FOUND`; a `Content-Type` other than `text/html` or a body that starts (after whitespace) with `<!doctype` or contains `<html` (the host's single-page fallback) → `NOT_FOUND`.
- `sanitiseFragment(html): DocumentFragment` lives in `src/common/content/sanitise-fragment.ts` and is exported for tests and the datasheet dialog.
- An aborted signal rejects with the abort reason and caches nothing.

**`<app-content-modal>` (connected, `src/features/navigation/app-content-modal.ts`)**

- Public API unchanged (no properties, slots, events or parts).
- Private state: `@state() private accessor status: 'idle' | 'loading' | 'loaded' | 'error'`, `@state() private accessor entry: PageEntry | undefined`, `@state() private accessor body: DocumentFragment | undefined`.
- When `$route` becomes `{ kind: 'reserved', path }` (checked in `updated()`), it aborts any in-flight load, then calls `loadContentEntry('pages', RESERVED_CONTENT[path], { locale: BASE_LOCALE, signal })`. Results for a superseded path are ignored. (When the locale store exists, a later plan passes its locale and reloads on change.)
- Render: `<dialog aria-labelledby="content-modal-title">` → `.modal-header` with `<h1 id="content-modal-title">` (the entry title; while loading, the fixed fallback title for the path: "About", "Privacy", "Help", matching `router.ts`'s document titles) and the existing `.close-btn`; then `.modal-body` containing `${this.body}` when loaded, nothing while loading, or `<p role="alert">This content could not be loaded. Check your connection, then close this dialog and try again.</p>` on error. When loaded, the `<h1>` and `.modal-body` carry `lang="${entry.lang}"` and `dir="${LOCALES[entry.lang].dir}"`. Opening, closing and `closeReserved()` behaviour stay exactly as now.
- Strings are hard-coded English, as in the existing component, because `src/i18n.ts` does not exist (COMPONENTS §8; same exception as today).
- Styles: keep the existing `static styles` (including fallbacks; TOK-4) and rename the `h2` selector to `h1`. Add nothing else (visual-design §1.1).
- A11y: the dialog stays named by its heading; the error uses `role="alert"`; external links in the body show the platform's new-tab behaviour (no extra icon until a styled mockup decides one).

## Specification changes

What `specification/` must say once this plan is implemented. The final task applies these items and ticks each one; `task_gate.py --check-complete` refuses to close the plan while any is unticked.

- [x] `specification/content-and-i18n.md` "Static Content" — replace the Markdown-to-TS section with: authored prose in `content/{locale}/{pages,models,glossary}/{id}.md` and locale-neutral data in `content/datasets/{id}/`; supported locales in `src/config/locales.ts`, base `en`; base locale complete, translations optional, build-time fallback with `lang` on each entry; strict front matter per domain (`order`, `related` base-only); the fragment rules (no raw HTML, leading H1 as title, headings from h2 with Unicode slug ids, link and image rules, allow-list); output `/content/{locale}/{domain}/{id}.html` and versioned `/content/{locale}/{domain}/index.json` written into the build output; the content loader (`locale` option) and the rule that fragments are rendered only as the loader's `DocumentFragment`, with `lang`/`dir` from the entry; status target → partial (localisation store, switcher and further locales still target).
- [x] `specification/ARCHITECTURE.md` Directory Structure — `/content/{locale}/` and `/content/datasets/` replace `/content-src/`; `/public/` holds only files served unchanged. Delivery and Caching — `/content/*` and `/datasets/*` carry `X-Robots-Tag: noindex, nofollow`, are never `Disallow`ed, and are never linked with `<a href>`; fragments contain no scripts or third-party images (CSP). Status line drops "Markdown-driven reserved routes" and "`/content-src/`" from the target list.
- [x] `specification/app-state-and-navigation.md` §3 — the reserved-route → page map is `RESERVED_CONTENT` in `src/router/reserved-content.ts` (`/about` → `about`, `/privacy` → `privacy-policy`, `/help` → `help`); §5.4 — the dialog heading is the page title as `<h1>`; load failure shows an alert in the dialog body and keeps the close button.
- [x] `specification/COMPONENTS.md` §4 Rendering — "First-party content is rendered only from the `DocumentFragment` returned by the content loader (`src/common/content/`); never with `unsafeHTML`, `innerHTML` or string templates."
- [x] Known gap 4 — _Resolved._
- [x] `specification/TODO.md` TODO-20 — narrowed to "Give `terms-and-conditions.md` a route?"; TODO-46 — narrowed to "Which locales ship after `en`, the language switcher, the locale store and the translation workflow (including stale translations)?"
- [x] `specification/COMPONENTS.md` §8 — the locale store takes its supported locales and base locale from `src/config/locales.ts`.
- [x] `specification/HUMAN.md` — keep the draft-styling item until the human promotes the draft, and the data-ingestion alignment item until that plan is revised.
- [x] Delete `specification/notes/build-static-content.md` and `specification/notes/static-content-indexes.md`.

## Implementation tasks

### T1 — Locales, content types, fragment policy and reserved-route map

- **Depends on:** None
- **Risk:** routine
- **Likely files:** `src/config/locales.ts`, `src/types/content.ts`, `src/common/content/fragment-policy.ts`, `src/router/reserved-content.ts`, `tests/content-policy.test.ts`
- **Must not touch:** `src/router/router.ts`, `src/router/route-parser.ts`, `src/types/routes.ts` (import `ReservedPath` only); `index.html`; `src/i18n.ts` (not created here)
- **Implementation:** Write the locales module, types, policy and map exactly as _Interfaces and behaviour_, D6 and D12 state, with TSDoc on every export. The policy module exports `FRAGMENT_POLICY` (`elements: ReadonlySet<string>`, `attributes: Readonly<Record<string, ReadonlySet<string>>>`), `isAllowedAttribute(element, name, value)`, `isExternalHref`, `isAllowedHref`, `isAllowedImageSrc`. No DOM, no Lit, no Bun APIs (it runs in the browser and in Bun).
- **Acceptance criteria:**
    - [x] CNT-P-1: `isAllowedHref` accepts `https://x.org/a`, `http://x.org`, `mailto:a@b.c`, `#intro`; rejects `/about`, `./a`, `//x.org`, `javascript:alert(1)`, `data:text/html,x`, `JAVASCRIPT:alert(1)`.
    - [x] CNT-P-2: `isAllowedAttribute('code', 'class', 'language-ts')` is true; `('code','class','evil')`, `('p','class','x')`, `('a','onclick','x')`, `('img','srcset','x')` are false.
    - [x] CNT-P-3: `RESERVED_CONTENT` has exactly the three `ReservedPath` keys (type-checked with `satisfies`).
    - [x] CNT-P-4: `BASE_LOCALE` is `'en'` and a key of `LOCALES`; `isLocale('en')` is true; `isLocale('fr')`, `isLocale('EN')` and `isLocale('datasets')` are false.
- **Verification:** `bun test tests/content-policy.test.ts`; `bun run typecheck`
- **Progress:** [x] Complete

### T2 — Markdown fragment compiler

- **Depends on:** T1
- **Risk:** needs care — `marked@18` renderer and `walkTokens` APIs are token-based; heading ids must match between the rendered HTML, the `headings` list and anchor checks.
- **Likely files:** `scripts/markdown.ts`, `tests/content-markdown.test.ts`
- **Must not touch:** `scripts/generate-pages.ts` (deleted in T4), the global `marked` instance (`marked.use` is forbidden: use `new Marked(...)`)
- **Implementation:** Implement `compileMarkdownFragment` per the compiler rules in _Interfaces and behaviour_. Use `gray-matter` for front matter, a private `Marked` instance with GFM, renderer overrides for `heading`, `link`, `tablecell` and `code`, `walkTokens` for the token checks, and `HTMLRewriter` (Bun global) over the output for the allow-list check. Return every error; never throw for content errors.
- **Acceptance criteria:**
    - [x] CNT-M-1: `---\ntitle: T\n---\n# T\n\nHello [x](https://e.org)\n\n## A b\n\n## A b` → `leadingTitle` `T`; `html` has no `---`, no `<h1>`, `<a href="https://e.org" target="_blank" rel="noopener noreferrer">`, `id="a-b"` and `id="a-b-2"`; `headings` lists both; `errors` empty.
    - [x] CNT-M-2: each of these produces an error naming the file and rule: `<div>x</div>`, inline `<span>`, `- [ ] task`, a second `# H1`, `[a](./b.md)`, `[a](/about)`, `[a](#missing)`, `![](/assets/linear-regression.svg)` (empty alt), `![x](https://e.org/i.png)`, `![x](/nope.png)`. A file with two problems reports both.
    - [x] CNT-M-3: `![Chart](/assets/x.svg)` passes when `outDir/assets/x.svg` exists; a GFM table renders without `align` attributes; a fenced ` ```ts ` block renders `<code class="language-ts">`.
    - [x] CNT-M-4: `## Café déjà vu` gets `id="café-déjà-vu"`; `## データの準備` gets `id="データの準備"`; `## Step 1: Load data!` gets `id="step-1-load-data"`; `## ???` gets `id="section"`; `[x](#café-déjà-vu)` passes the anchor check.
    - [x] CNT-M-5: with no `description`, a 300-character first paragraph yields `firstParagraph` cut to ≤ 160 code points at a word boundary ending in `…`; a short paragraph is returned whole without `…`; with `locale: 'ja'` a Japanese paragraph with no spaces is still cut at a word boundary.
- **Verification:** `bun test tests/content-markdown.test.ts`; `bun run check`
- **Progress:** [x] Complete

### T3 — Move and normalise authored content

- **Depends on:** None
- **Risk:** routine
- **Likely files:** `content/pages/` → `content/en/pages/` (move: `about.md`, `privacy-policy.md`, `terms-and-conditions.md`), `content/en/pages/help.md` (new), `content/models/` → `content/en/models/` (move: `logistic-regression.md`), `public/datasets/` → `content/datasets/` (move)
- **Must not touch:** the contents of any file under `content/datasets/` after the move; `src/features/navigation/app-content-modal.ts` (T6)
- **Implementation:**
    - Move the folders with plain `mv` (do not `git add` or commit): `mkdir content/en`, `mv content/pages content/en/pages`, `mv content/models content/en/models`, `mv public/datasets content/datasets`. Delete any `.DS_Store` files inside them.
    - In every `content/en/pages/*.md` and `content/en/models/*.md`: remove `short_title` from front matter; keep the leading `# …` heading (the compiler uses it); replace "WebML" with "samatā.ml" (UI name, Known gap 10). Set `about.md`'s `title` and leading heading to `About samatā.ml`. Otherwise keep the existing Markdown copy as it is: it replaces the modal's hard-coded copy, and all copy is reviewed later.
    - Create `content/en/pages/help.md` with `title: Help & Guide` and the paragraph and four-item ordered list that `app-content-modal.ts` shows for `/help` today, converted to Markdown word for word (there is no Markdown help copy yet).
    - Do not write any other new copy.
- **Acceptance criteria:**
    - [x] `public/` contains only `_headers` and `assets/`; `content/` contains only `en/` and `datasets/`; `content/datasets/` contains the same 12 folders with byte-identical files (`shasum` before and after match).
    - [x] No `content/en/pages` or `content/en/models` file contains `short_title` or `WebML`; apart from those edits and the about title, the moved files are unchanged (compare each with `git show HEAD:content/pages/<file>` or `HEAD:content/models/<file>`); `help.md` matches the current modal copy.
- **Verification:** `ls public content content/en content/datasets`; `grep -rn "short_title\|WebML" content/en` returns nothing; `shasum -a 256` listing of the datasets compared before and after the move
- **Progress:** [x] Complete

### T4 — Content build, build integration, headers and dev content types

- **Depends on:** T1, T2, T3
- **Risk:** needs care — must collect every error before failing, write deterministic output, and remove the old pipeline without breaking `bun run server`.
- **Likely files:** `scripts/build-content.ts`, `scripts/build-assets.ts`, `scripts/build.ts`, `scripts/server.ts`, `scripts/static-server.ts`, `scripts/generate-pages.ts` (delete), `public/_headers`, `.gitignore`, `tests/build-content.test.ts`, `tests/fixtures/content/` (valid and invalid fixture trees)
- **Must not touch:** the `/*` rule in `public/_headers` (CSP and security headers); the watcher logic in `scripts/server.ts` beyond removing `generateStaticPages`; `content/datasets/` (owned by data-ingestion-and-storage)
- **Implementation:**
    - Write `buildContent(outDir, options?)` per _Content build_. `options` (`contentDir`, `locales`) is for tests; mark it `@internal` in TSDoc. Production and dev builds pass no options.
    - In `build-assets.ts`, call `await buildContent(outdir)` in both bundle functions after `copyDirContents(PUBLIC_DIR, …)`, and log the entry counts. Remove `generateStaticPages` imports and calls from `build.ts` and `server.ts`; delete `scripts/generate-pages.ts`; remove `/src/generated/` from `.gitignore` and delete the local `src/generated/` directory.
    - Append to `public/_headers`:

        ```text
        /content/*
          X-Robots-Tag: noindex, nofollow

        /datasets/*
          X-Robots-Tag: noindex, nofollow
        ```

    - Add `.json` (`application/json; charset=utf-8`) and `.csv` (`text/csv; charset=utf-8`) to `contentTypeFromPath`.

- **Acceptance criteria:**
    - [x] CNT-B-1: on a valid `en`-only fixture, `buildContent` writes `content/en/{pages,models,glossary}/index.json` (glossary with `entries: []` when its directory is absent), each with `locale: "en"`, and one `.html` per Markdown file; every entry has `lang: "en"`; each entry's `url` ends `?v=` + 12 hex characters equal to the SHA-256 prefix of the written file; a second run produces byte-identical output.
    - [x] CNT-B-2: invalid fixtures fail with all errors listed: unknown front-matter key, `order: "x"`, `updated: 13/11/2026`, a glossary entry without `description`, `related` naming a missing id or itself, an upper-case file name, a subdirectory, a missing reserved page (fixture without `privacy-policy.md`), an unknown directory under the content root (`content/xx/`); no `index.json` is written when any error occurs.
    - [x] CNT-B-3: `bun run build` succeeds and `dist/content/en/pages/index.json` lists `about`, `help`, `privacy-policy`, `terms-and-conditions` with titles from the Markdown; `dist/content/en/models/index.json` lists `logistic-regression`; `dist/_headers` contains both new rules; `src/generated/` is not recreated.
    - [x] CNT-B-4: with `bun run server` running, editing `content/en/pages/about.md` triggers one rebuild and a browser reload, and `https://localhost:3000/content/en/pages/index.json` is served as `application/json`.
    - [x] CNT-B-5: with `locales: ['en', 'fr']` and a fixture where `fr/pages/about.md` exists but `fr/pages/help.md` does not, `content/fr/pages/index.json` has `locale: "fr"`, lists the same ids as the `en` index, gives `about` `lang: "fr"` and a `/content/fr/…` URL, and gives `help` `lang: "en"` and the same URL as the `en` index. `fr/pages/extra.md` with no `en` file, and `order` in `fr/models/*.md`, each fail the build. With `locales: ['en', 'fr']` and no `fr/` directory, the build succeeds with every `fr` entry a fallback.
- **Verification:** `bun test tests/build-content.test.ts`; `bun run build`; `bun run check`; manual CNT-B-4 (record the log lines)
- **Progress:** [x] Complete

### T5 — Runtime content loader and fragment sanitiser

- **Depends on:** T1
- **Risk:** needs care — the sanitiser is the runtime security boundary; it must remove disallowed elements with their content and never re-serialise.
- **Likely files:** `src/common/content/sanitise-fragment.ts`, `src/common/content/content-loader.ts`, `tests/content-loader.test.ts`
- **Must not touch:** any Lit component; `src/stores/` (the loader holds no application state)
- **Implementation:** Implement `sanitiseFragment` and the loader per D9, D10 and _Loader_. Use `DOMParser`, a recursive walk that removes disallowed elements (`element.remove()`), attributes and hrefs, and forces `target`/`rel` on external links; then `fragment.append(...doc.body.childNodes)`. Tests run under the preloaded happy-dom (`tests/setup.ts`); stub `globalThis.fetch` per test and reset the loader's caches through an exported `resetContentCache()` marked `@internal` in TSDoc.
- **Acceptance criteria:**
    - [x] CNT-L-1: `sanitiseFragment('<p onclick="x">a<script>b</script><img src="https://e.org/i.png" alt="i"><a href="javascript:x">c</a><a href="https://e.org">d</a></p>')` yields one `<p>` with no attributes, text `a`, no `script`, no `img`, the `javascript:` link removed with its text, and the external link with `target="_blank" rel="noopener noreferrer"`.
    - [x] CNT-L-2: two `loadContentEntry('pages','about')` calls fetch the index once and the fragment once, and return distinct `DocumentFragment` objects with equal markup.
    - [x] CNT-L-3: index 404 → `NOT_FOUND`; fetch rejection → `NETWORK`, and a later call fetches again; `{ version: 2 }` → `INVALID_INDEX`; an index whose `locale` differs from the requested one → `INVALID_INDEX`; unknown id → `NOT_FOUND`; a fragment response of `<!doctype html><html>…` with status 200 → `NOT_FOUND`; an aborted signal rejects and caches nothing.
    - [x] CNT-L-4: with no `locale`, the loader requests `/content/en/pages/index.json`; the returned `entry.lang` is the index's value.
- **Verification:** `bun test tests/content-loader.test.ts`; `bun run check`
- **Progress:** [x] Complete

### T6 — Render reserved-route pages from content

- **Depends on:** T4, T5
- **Risk:** needs care — Lit lifecycle (load in `updated()`, never set state in `render()`), stale-response races, and not regressing NAV-E2E-3 or TOK-4.
- **Likely files:** `src/features/navigation/app-content-modal.ts`, `tests/content.e2e.ts` (new), `tests/app-shell.test.ts` (NAV-E2E-3 heading assertion only)
- **Must not touch:** `src/router/router.ts`, `src/app.ts`, `src/features/navigation/app-sidebar.ts`; the component's existing fallback tokens (TOK-4); `tests/style-tokens.test.ts`
- **Implementation:** Follow `<app-content-modal>` in _Interfaces and behaviour_ and the draft mockup's structure. Delete the hard-coded `renderContent` copy. Keep `handleDialogClose`, `handleCloseButtonClick` and the `showModal()` logic unchanged. In NAV-E2E-3 change `modal.locator('h2')` to `modal.locator('h1')` (text stays `About samatā.ml`).
- **Acceptance criteria:**
    - [x] CNT-E2E-1: visiting `/privacy` opens the dialog with `<h1>` "Privacy Policy" and body text from `content/en/pages/privacy-policy.md`; the dialog's accessible name equals the heading; the `<h1>` and the body have `lang="en"` and `dir="ltr"`.
    - [x] CNT-E2E-2: `/help` shows the ordered list from `help.md`; every external link in an opened fragment has `target="_blank"` and `rel="noopener noreferrer"`.
    - [x] CNT-E2E-3: with `page.route('**/content/en/pages/index.json', r => r.fulfill({ status: 404 }))`, `/about` shows the alert text and the close button still closes the dialog and returns to the underlay URL.
    - [x] CNT-E2E-4: moving from `/about` to `/privacy` quickly (Back/Forward) never shows the about body under the privacy heading.
    - [x] NAV-E2E-3 passes with the `h1` assertion; `bun run test:e2e tests/a11y.e2e.ts` reports no new violations; `bun test tests/style-tokens.test.ts` passes.
- **Verification:** `bun run test:e2e tests/content.e2e.ts tests/app-shell.test.ts tests/a11y.e2e.ts`; `bun test tests/style-tokens.test.ts`; `bun run check`. Record any browser (Chromium, Firefox, WebKit) not run, with the reason.
- **Progress:** [x] Complete

### T7 — Sync specification

- **Depends on:** T1, T2, T3, T4, T5, T6
- **Risk:** needs care — specs must describe what was built, not what was planned
- **Likely files:** `specification/content-and-i18n.md`, `specification/ARCHITECTURE.md`, `specification/app-state-and-navigation.md`, `specification/COMPONENTS.md`, `specification/README.md`, `specification/TODO.md`, `specification/HUMAN.md`, `specification/notes/build-static-content.md` (delete), `specification/notes/static-content-indexes.md` (delete)
- **Must not touch:** Product code, tests and `specification/mockups/`; `specification/plans/data-ingestion-and-storage.md`
- **Implementation:** Apply every item under _Specification changes_, following "Writing specs" in `specification/README.md`. Where the log records a deviation from the plan, document the deviation, not the plan. Update each changed spec's status line and its row in the index, and resolve Known gap 4.
- **Acceptance criteria:**
    - [x] Every item under _Specification changes_ is applied and ticked.
    - [x] No changed spec contradicts the code or another spec, or mentions this plan, its tasks or the history of the change; no spec still mentions `/content-src/`, `src/content-compiled/` or `src/generated/`.
    - [x] `bun run plans:check` reports no spec index mismatch.
- **Verification:** `bun run plans:check`; `git diff specification/` reviewed against _Specification changes_
- **Progress:** [x] Complete

## Verification and definition of done

- [x] All task acceptance criteria met.
- [x] `bun run check` introduces no new failures compared with the baseline (0 type errors, 52 tests); report the new test count.
- [x] `bun run build` passes and `dist/` contains `content/en/{pages,models,glossary}/index.json`, the page and model fragments, and no `.md` file under `dist/content/`.
- [x] Token and accessibility tests pass for the modal change (no parity entries: draft-only prose).
- [x] Security: no `unsafeHTML`, `innerHTML`, `outerHTML` or `insertAdjacentHTML` in `src/` (`grep -rn` recorded); CSP unchanged; every fetch is same-origin.
- [x] Every item under _Specification changes_ is ticked, and the specs describe the code as built.
- [x] No unintended changes outside the tasks' likely files.

## Risks and open questions

- **Blocking:** None.
- **Decided by the user (2026-11-13):**
    1. **Datasets move out of `public/` (D1).** The 12 datasets move unchanged from `public/datasets/` to `content/datasets/`, as data-ingestion D10 already decided, so that `datasheet.md` and authoring metadata stop shipping. Until data-ingestion T8 runs, the CSVs are not served (nothing uses them yet). Decision: accept.
    2. **Index name and place (D3).** `/content/{locale}/{domain}/index.json` for prose, `/datasets/index.json` for the dataset catalogue (data-ingestion currently says `manifest.json`). Decision: accept.
    3. **Safe rendering (D9, COMPONENTS §4 addition).** First-party fragments are rendered as a sanitised `DocumentFragment`, not with `unsafeHTML`. Raw HTML in Markdown is forbidden. Decision: accept.
    4. **TODO-20 (first half).** `content/en/pages/help.md` is created from today's modal copy. Decision: accept.
    5. **Dialog title as `<h1>` (D11)**, matching `.modal-header h1` in the mockups. Decision: accept.
    6. **Copy.** The existing Markdown copy replaces the modal's hard-coded copy, changed only for the product name and the about title (T3); all copy is reviewed later.
    7. **Localisation.** Consider localisation now, with English first and default. Applied as D12 and the locale changes to D1, D3, D4, D5, D7, D10, the interfaces and T1–T6.
- **Localisation choices (D12), approved by the user on 2026-11-13 at 14:13 UTC:**
    1. **Locale code `en`**, not `en-GB` (D12). The prose stays British English. Decision: accept.
    2. **Locale-first layout** `content/en/{domain}/` and `/content/en/{domain}/`, with `content/datasets/` locale-neutral (D1, D3). Decision: accept.
    3. **Build-time fallback**: every locale's index lists every base id, and untranslated entries point at the English fragment with `lang: "en"` (D12). Decision: accept.
    4. **Unicode heading ids**: `## Café déjà vu` → `café-déjà-vu` (was `cafe-deja-vu`), so headings in any script keep anchors (D5, CNT-M-4). Decision: accept.
- **Non-blocking:**
    - **data-ingestion-and-storage must be aligned.** When it is next revised (it is also waiting on `sample_dataset_specification.md`, whose `/public/datasets/` paths and `manifest.json` name this plan supersedes): read datasets from the moved `content/datasets/{id}/` files, compile datasheets with `compileMarkdownFragment` (so they follow D5 and D9, with `locale: 'en'`), write the catalogue to `/datasets/index.json`, and rely on this plan's `/datasets/*` header rule. Owner: planner, via HUMAN.md. Decision (user): profiling results are cached by file hash, and a dataset is re-profiled only when its hash changes; that plan specifies the cache.
    - **Router misses links inside shadow DOM** (Known gap 18). `handleClick` (`src/router/router.ts:233`) uses `event.target.closest('a')`, which is retargeted to the shadow host, so sidebar links (and any app-route link in a dialog) do a full page load instead of a history navigation. This plan forbids app-route links in content until it is fixed (use `event.composedPath()` to find the anchor). Decision (user): future work, recorded as Known gap 18; no plan owns it yet.
    - **Draft mockup awaiting styling.** `drafts/00-2_content-modal.html`: prose (headings, lists, tables, code, block quotes, links) inside the dialog has no styled mockup, so it renders with inherited text styles only. Once styled, a follow-up task ports the styles and adds parity entries.
    - **Model ids.** `content/en/models/{id}.md` ids must match the `web-ml` model ids once the orchestrator spec exists (TODO-33). Rename files then, in every locale; the index changes with them.
    - **Rest of localisation (TODO-46).** Which locales ship after `en`, the locale store and switcher, and detecting translations that are older than their English source stay open. Adding a locale needs a `LOCALES` key and a `content/{code}/` tree; no loader or build change. Datasheets stay English-only until data-ingestion decides otherwise. A right-to-left locale will also need the prose styles (draft mockup) to use logical properties, which COMPONENTS §7 already requires.
    - **Caching (TODO-45).** No long-lived caching yet; the versioned index URLs make a later `immutable` policy a header-only change. The production `_headers` merge behaviour is an assumption, checked manually after deploy.
    - **Conflict with the ready conformance plan.** T6 edits `tests/app-shell.test.ts` (one assertion) and `app-content-modal.ts`; the conformance plan edits the same test file. Run T6 after that plan's T8, or rebase the one-line change.

## Implementation and verification log

| When (UTC)           | Task | Outcome / commands / evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-13T14:46:43Z | T1   | Complete. Added `src/config/locales.ts`, `src/types/content.ts`, `src/common/content/fragment-policy.ts`, `src/router/reserved-content.ts`, `tests/content-policy.test.ts`. `bun test tests/content-policy.test.ts` (5 pass, 0 fail); `bun run check` (0 type errors, 66 pass, 0 fail). Note: `task_gate.py` rejected T3's `Depends on: None (parallel-safe with T1, T2)` format; T1 preflight verified manually.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-11-13T14:49:18Z | T2   | Complete. Added `scripts/markdown.ts`, `tests/content-markdown.test.ts`. `bun test tests/content-markdown.test.ts` (5 pass, 0 fail); `bun test` (82 pass, 0 fail); `tsc --noEmit` reported 2 unrelated errors in pre-existing parallel `tests/cells.test.ts` only (0 errors in T2 files).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-11-13T14:50:07Z | T3   | Complete. Moved `content/{pages,models}` to `content/en/{pages,models}` and `public/datasets` to `content/datasets` (36 dataset files byte-identical by `shasum -a 256`). Removed `short_title` and replaced `WebML` with `samatā.ml` in moved files; updated `about.md` title/heading; added `content/en/pages/help.md`. Normalised T3 `Depends on:` to `None` (was `None (parallel-safe with T1, T2)`) so `task_gate.py` parses cleanly.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-11-13T14:54:51Z | T4   | Complete. Added `scripts/build-content.ts`, `tests/build-content.test.ts`, `tests/fixtures/content/`; integrated `buildContent` in `scripts/build-assets.ts`; removed `scripts/generate-pages.ts`, `src/generated/`, `.gitignore` entry and `generateStaticPages` calls in `scripts/build.ts` and `scripts/server.ts`; added `.json`/`.csv` types in `scripts/static-server.ts` and `/content/*` + `/datasets/*` `X-Robots-Tag` rules in `public/_headers`. Checks: `bun test tests/build-content.test.ts` (4 pass), `bun run build` (`Built static content: en [pages:4, models:1, glossary:0]`), `bun run check` (0 type errors, 86 pass, 0 fail). Dev server watch verified: `Change detected: change .../content/en/pages/about.md` → `Built static content: en [pages:4, models:1, glossary:0]` → `Rebuild finished in 24ms.` → `Browser reload sent to 0 client(s).` `serveStaticFile` returned `application/json; charset=utf-8` (direct `fetch` to `https://localhost:3000` blocked by sandbox TCP restriction `ECONNREFUSED`/`EPERM`). |
| 2026-11-13T14:56:14Z | T5   | Complete. Added `src/common/content/sanitise-fragment.ts`, `src/common/content/content-loader.ts`, `tests/content-loader.test.ts`. `bun test tests/content-loader.test.ts` (5 pass, 0 fail); `bun run check` (0 type errors, 91 pass, 0 fail).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-11-13T15:00:41Z | T6   | Complete. Rewrote `src/features/navigation/app-content-modal.ts` to load reserved-route pages via `loadContentEntry('pages', RESERVED_CONTENT[path], { locale: BASE_LOCALE, signal })` with fallback titles, `<h1>`, `.modal-body` fragment rendering, `lang`/`dir`, and alert error UI; updated `tests/app-shell.test.ts` NAV-E2E-3 (`h1`); added `tests/content.e2e.ts` (CNT-E2E-1..4). `bun test tests/style-tokens.test.ts` (4 pass, 0 fail); `bun test` (91 pass, 0 fail); `tsc --noEmit` reported 0 errors in T6 files (3 unrelated errors in pre-existing parallel `src/common/storage/profiler.ts`); `bun run build` passed; `bun run test:e2e tests/content.e2e.ts tests/app-shell.test.ts tests/a11y.e2e.ts` passed 20/20 across Chromium (10/10) and WebKit (10/10) — Firefox (`firefox-1572`) failed to launch (`Could not find profile folder`), so Firefox could not run.                                                                                                                                                         |
| 2026-11-13T15:02:20Z | T7   | Complete. Updated `specification/content-and-i18n.md` (status `target` → `partial`), `specification/ARCHITECTURE.md`, `specification/app-state-and-navigation.md` (§3, §5.4), `specification/COMPONENTS.md` (§4, §8), `specification/README.md` (status `partial`, Known gap 1 & Known gap 4 `_Resolved._`), `specification/TODO.md` (narrowed TODO-20 & TODO-46, updated `content/en/models/logistic-regression.md`); preserved `specification/HUMAN.md` items; deleted `specification/notes/build-static-content.md` and `specification/notes/static-content-indexes.md`. Verified `grep -rnE "content-src\|content-compiled\|src/generated\|generate-pages" specification/` returned 0 matches; `grep -rn "unsafeHTML\|innerHTML\|outerHTML\|insertAdjacentHTML" src/` returned 0 matches; `bun run build` passed with `dist/content/en/{pages,models,glossary}/index.json` and 0 `.md` files in `dist/content/`.                                                                                                                            |

## Change log

| When (UTC)           | Change                                                            | Reason                                                                                                                                                                                                                                                                                                             |
| -------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-11-13T11:29:52Z | Initial draft                                                     | User request: review the two static-content notes and plan content locations, output HTML and JSON indexes.                                                                                                                                                                                                        |
| 2026-11-13T13:36:11Z | Approved; status `ready`                                          | User approved the five decisions as written.                                                                                                                                                                                                                                                                       |
| 2026-11-13T14:05:01Z | Back to `draft`: localisation (D12) and the user's risk decisions | User decisions in _Risks_: localisation with `en` as the base locale (D12; locale changes to D1, D3, D4, D5, D7, D10, interfaces, T1–T6; Unicode heading ids change CNT-M-4); dataset profiling cached by file hash (data-ingestion); router shadow-DOM bug recorded as Known gap 18; existing Markdown copy kept. |
| 2026-11-13T14:13:11Z | Re-approved; status `ready`                                       | User approved the four localisation choices (D12) as written.                                                                                                                                                                                                                                                      |
