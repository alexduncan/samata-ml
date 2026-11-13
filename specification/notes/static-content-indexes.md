### 1. Proposed Output Location for JSON Indexes

Output all four generated JSON indexes into a dedicated **`/public/indexes/`** directory:

```text
/public/
├── indexes/
│   ├── datasets.json             # Single-fetch catalog index for all sample datasets
│   ├── models.json               # Index of model cards (e.g., card.md or per-algorithm cards)
│   ├── pages.json                # Index of static app pages (about, privacy, methodology)
│   └── help.json                 # Index of contextual <dialog> help topics
├── fragments/
│   ├── models/*.html             # Compiled HTML fragments from ./content/models/*.md
│   ├── pages/*.html              # Compiled HTML fragments from ./content/pages/*.md
│   └── help/*.html               # Compiled HTML fragments from ./content/help/*.md
└── datasets/
    └── {id}/
        ├── data.csv
        ├── metadata.json
        ├── datasheet.md
        └── datasheet.html        # Compiled HTML fragment co-located with dataset assets

```

#### Why `/public/indexes/` is the optimal location

* **Uniform Client Fetch Contract:** The frontend needs only one typed helper (`fetch('/indexes/${type}.json')`) rather than knowing different paths per content domain.
* **Clean Separation of Concerns:** `/public/datasets/` remains strictly per-dataset asset bundles, `/public/fragments/` holds only compiled HTML partials, and `/public/indexes/` holds only machine-readable catalog indexes.


* **Single HTTP Header Rule:** A single `/indexes/*` rule in `public/_headers` applies `X-Robots-Tag: noindex, nofollow` and `Cache-Control` policies across every index file simultaneously.
* **Reconciliation with `sample-dataset-specification.md`:** Standardize on `/public/indexes/datasets.json` as the canonical dataset catalog index (replacing `/public/datasets/manifest.json`, or emitting `/public/datasets/manifest.json` as an alias only if existing components still reference it).



---

### 2. Proposed Fields for Each Index Type

#### A. `datasets.json` (`/public/indexes/datasets.json`)

Built by joining each dataset's `/public/datasets/{id}/metadata.json` with its compiled `datasheet.html` content hash:

| Field | Type | Source | Purpose |
| --- | --- | --- | --- |
| `id` | `string` | `metadata.id` | Unique kebab-case slug and route/dialog key.

 |
| `title` | `string` | `metadata.name` | Human-readable title displayed in catalog cards and table views.

 |
| `shortDescription` | `string` | `metadata.tagline` | One-line summary (~90 chars) for catalog cards and list rows.

 |
| `rows` | `number` | `metadata.stats.rowCount` | Total observation count (`data.csv` rows).

 |
| `columns` | `number` | `metadata.stats.columnCount` | Total column count (`data.csv` columns).

 |
| `domain` | `string` | `metadata.domain` | Filter badge (`biology`, `healthcare`, `finance`, etc.).

 |
| `difficulty` | `string` | `metadata.difficulty` | Complexity badge (`beginner`, `intermediate`, `advanced`).

 |
| `taskType` | `string` | `metadata.modeling.targetCandidates` | Default classification type (`binary-classification` or `multiclass-classification`).

 |
| `defaultTarget` | `string` | `metadata.modeling.defaultTarget` | Default target column name shown in preview summaries.

 |
| `hasMissingValues` | `boolean` | `metadata.stats.hasMissingValues` | Indicator badge for datasets containing missing data.

 |
| `fileSizeBytes` | `number` | `metadata.stats.fileSizeBytes` | Formatted file size badge before downloading the CSV.

 |
| `tags` | `string[]` | `metadata.tags` | Search and filter keywords.

 |
| `csvUrl` | `string` | Derived (`/datasets/{id}/data.csv`) | Direct fetch path for the client-side CSV worker.

 |
| `datasheetUrl` | `string` | Derived (`/datasets/{id}/datasheet.html`) | Direct fetch path for the Dataset Card `<dialog>`.

 |
| `hash` | `string` | SHA-256 (8-char prefix) | Cache-busting token (`?v=<hash>`) when `datasheet.html` changes. |

#### B. `models.json` (`/public/indexes/models.json`)

Built from `./content/models/*.md` (supports a single `./content/models/card.md` overview with multiple `##` sections as well as individual per-model files):

| Field | Type | Source | Purpose |
| --- | --- | --- | --- |
| `id` | `string` | Filename slug (e.g., `"card"`) | Identifier passed to the `<dialog>` loader. |
| `title` | `string` | Frontmatter `title` or first `# H1` | Dialog header title. |
| `shortDescription` | `string` | Frontmatter `description` or lead text | Summary blurb for model selector cards. |
| `category` | `string?` | Frontmatter `category` | Optional grouping (`overview`, `linear`, `tree`, `instance-based`, `kernel`). |
| `headings` | `{ id: string; text: string; level: number }[]` | Extracted from compiled HTML | Allows jumping directly to `#section-id` inside a multi-model `card.md` dialog. |
| `fragmentUrl` | `string` | Derived (`/fragments/models/{id}.html`) | Fetch URL for the HTML fragment. |
| `order` | `number` | Frontmatter `order` (default `999`) | Deterministic display ordering. |
| `hash` | `string` | SHA-256 (8-char prefix) | Cache-busting token for the compiled HTML fragment. |

#### C. `pages.json` (`/public/indexes/pages.json`)

Built from `./content/pages/*.md` (e.g., `about.md`, `privacy.md`, `methodology.md`):

| Field | Type | Source | Purpose |
| --- | --- | --- | --- |
| `id` | `string` | Filename slug (e.g., `"privacy"`) | Identifier passed to the `<dialog>` loader. |
| `title` | `string` | Frontmatter `title` or first `# H1` | Navigation button label and `<dialog>` title. |
| `shortDescription` | `string` | Frontmatter `description` | Accessible `aria-description` or subtitle. |
| `navGroup` | `'header' | 'footer' | 'hidden'` | Frontmatter `navGroup` (default `'footer'`) | Controls where navigation buttons render automatically. |
| `fragmentUrl` | `string` | Derived (`/fragments/pages/{id}.html`) | Fetch URL for the HTML fragment. |
| `order` | `number` | Frontmatter `order` (default `999`) | Sort order in navigation menus. |
| `lastUpdated` | `string?` | Frontmatter `lastUpdated` | Optional ISO date string displayed in the dialog footer. |
| `hash` | `string` | SHA-256 (8-char prefix) | Cache-busting token. |

#### D. `help.json` (`/public/indexes/help.json`)

Built from `./content/help/*.md` (e.g., `roc-auc.md`, `target-leakage.md`, `implicit-missing.md`):

| Field | Type | Source | Purpose |
| --- | --- | --- | --- |
| `id` | `string` | Filename slug (e.g., `"roc-auc"`) | Key referenced by `data-help-id="roc-auc"` trigger buttons. |
| `title` | `string` | Frontmatter `title` or first `# H1` | `<dialog>` heading and glossary search title. |
| `shortDescription` | `string` | Frontmatter `description` | Concise 1-sentence definition for inline hover tooltips or search results. |
| `topic` | `string` | Frontmatter `topic` (default `'general'`) | Category grouping (`metrics`, `preprocessing`, `algorithms`, `fairness`). |
| `relatedIds` | `string[]` | Frontmatter `related` (default `[]`) | Renders "Related topics" buttons inside the `<dialog>`. |
| `fragmentUrl` | `string` | Derived (`/fragments/help/{id}.html`) | Fetch URL for the HTML fragment. |
| `hash` | `string` | SHA-256 (8-char prefix) | Cache-busting token. |

---

### 3. Coding-Agent Specification (`./specification/static-content-build.md`)

Save the following specification to `./specification/static-content-build.md` for your coding agent:

```markdown
# Static Content Build & `<dialog>` Loader Specification

## 1. Overview & Goals

Implement a Bun-native build pipeline (`scripts/build-content.ts`) and a client-side content service (`src/services/content-loader.ts`) that:
1. Compiles authored Markdown documentation into **HTML fragments** (inner markup only, no `<html>` or `<body>` wrappers) suitable for fetching and rendering inside native `<dialog>` elements.
2. Emits **per-type JSON index files** in `/public/indexes/` so the web application can fetch a single JSON file per content domain to render catalog views, navigation menus, and searchable help glossaries.
3. Prevents standalone search-engine indexing of raw HTML fragments and JSON indexes while preserving in-app state when users open external links.

---

## 2. Source-to-Output Mapping

| Content Type | Source Pattern | Compiled HTML Fragment Output | Generated JSON Index |
| :--- | :--- | :--- | :--- |
| **Datasets** | `./public/datasets/*/datasheet.md` (paired with `metadata.json`) | `./public/datasets/{id}/datasheet.html` | `./public/indexes/datasets.json` |
| **Models** | `./content/models/*.md` | `./public/fragments/models/{slug}.html` | `./public/indexes/models.json` |
| **Pages** | `./content/pages/*.md` | `./public/fragments/pages/{slug}.html` | `./public/indexes/pages.json` |
| **Help** | `./content/help/*.md` | `./public/fragments/help/{slug}.html` | `./public/indexes/help.json` |

**Git Ignore Rule:** Add `/public/indexes/`, `/public/fragments/`, and `/public/datasets/*/datasheet.html` to `.gitignore`. These files are deterministic build outputs generated prior to dev/production builds.

---

## 3. TypeScript Index Contracts (`src/types/content-index.ts`)

Create `src/types/content-index.ts` as the shared contract between `scripts/build-content.ts` and the frontend UI components:

```typescript
export type ContentDomain = 'datasets' | 'models' | 'pages' | 'help';

export interface HeadingAnchor {
  id: string;
  text: string;
  level: number;
}

export interface DatasetIndexEntry {
  id: string;
  title: string;
  shortDescription: string;
  rows: number;
  columns: number;
  domain: 'biology' | 'healthcare' | 'finance' | 'criminal-justice' | 'social-science' | 'marketing';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  taskType: 'binary-classification' | 'multiclass-classification';
  defaultTarget: string;
  hasMissingValues: boolean;
  fileSizeBytes: number;
  tags: string[];
  csvUrl: string;
  datasheetUrl: string;
  hash: string;
}

export interface ModelIndexEntry {
  id: string;
  title: string;
  shortDescription: string;
  category?: string;
  headings: HeadingAnchor[];
  fragmentUrl: string;
  order: number;
  hash: string;
}

export interface PageIndexEntry {
  id: string;
  title: string;
  shortDescription: string;
  navGroup: 'header' | 'footer' | 'hidden';
  fragmentUrl: string;
  order: number;
  lastUpdated?: string;
  hash: string;
}

export interface HelpIndexEntry {
  id: string;
  title: string;
  shortDescription: string;
  topic: string;
  relatedIds: string[];
  fragmentUrl: string;
  hash: string;
}

export interface ContentIndexMap {
  datasets: DatasetIndexEntry[];
  models: ModelIndexEntry[];
  pages: PageIndexEntry[];
  help: HelpIndexEntry[];
}

```

---

## 4. Bun Build Script Requirements (`scripts/build-content.ts`)

### 4.1 Package Scripts

Add the following scripts to `package.json` and wire `build:content` into `predev` and `prebuild`:

```json
{
  "scripts": {
    "build:content": "bun run scripts/build-content.ts",
    "watch:content": "bun run scripts/build-content.ts --watch"
  }
}

```

### 4.2 Processing Pipeline Rules

1. **Clean Stale Artifacts:** On a full build, clear `/public/fragments/` and `/public/indexes/` before writing new outputs so deleted `.md` files do not leave orphaned `.html` files or stale index entries.
2. **YAML Frontmatter Extraction:**
* Parse and strip leading `--- ... ---` YAML frontmatter before compiling Markdown to HTML so frontmatter keys never render as raw text inside `<dialog>` elements.
* Extract `title` (fallback to the first `# H1` heading in the Markdown, or title-cased filename slug), `description` (fallback to the first non-heading paragraph truncated to 160 chars), `order`, `category`/`topic`/`navGroup`, `related`, and `lastUpdated`.


3. **HTML Fragment Compilation:**
* Output **HTML fragments only** (no `<!DOCTYPE html>`, `<html>`, `<head>`, or `<body>` tags).
* Enable GitHub Flavored Markdown (tables, task lists, fenced code blocks).
* Generate deterministic, URL-safe `id` attributes on all headings (`<h1>`–`<h4>`) and record them in `headings[]` for index entries.
* Rewrite all external links (`href^="http://"` or `href^="https://"`) to include `target="_blank" rel="noopener noreferrer"` so clicking citations inside a `<dialog>` never navigates away from the active browser tab and destroys in-memory Web Worker state.


4. **Dataset Index Joining (`datasets.json`):**
* For each directory in `./public/datasets/{id}/`, read and validate `metadata.json` alongside `datasheet.md`.
* Fail the build with a descriptive error if `metadata.json` is missing, invalid, or contains a `'regression'` task type.
* Map `metadata.name` -> `title`, `metadata.id` -> `id`, `metadata.tagline` -> `shortDescription`, `metadata.stats.rowCount` -> `rows`, and `metadata.stats.columnCount` -> `columns`.
* Sort `datasets.json` deterministically by `difficulty` (`beginner` -> `intermediate` -> `advanced`), then alphabetically by `title`.


5. **Broken Internal Link Validation:**
* Scan all compiled HTML fragments for internal `href` and `src` paths starting with `/` or `./`.
* Verify each target file exists under `./public/` (or corresponds to a valid `#anchor-id` in the same fragment). Fail the build if any broken internal link is found.


6. **Deterministic Hashing & Watch Mode:**
* Compute an 8-character SHA-256 hex digest (`Bun.CryptoHasher("sha256")`) of each compiled HTML fragment and store it in `entry.hash`.
* When `--watch` is passed, use `fs.watch` (`recursive: true`) on `./content` and `./public/datasets` (ignoring `.html` writes to prevent infinite rebuild loops) with a 100ms debounce.



---

## 5. Crawler Non-Indexability & Caching Configuration

Because HTML fragments have no `<head>` element for `<meta name="robots">`, enforce non-indexability at the HTTP response and DOM trigger layers:

### 5.1 HTTP Response Headers (`public/_headers`)

Add the following rules to `public/_headers` (for Cloudflare Pages / static hosts):

```text
/fragments/*
  X-Robots-Tag: noindex, nofollow
  Cache-Control: public, max-age=3600

/datasets/*/datasheet.html
  X-Robots-Tag: noindex, nofollow
  Cache-Control: public, max-age=3600

/indexes/*
  X-Robots-Tag: noindex, nofollow
  Cache-Control: public, max-age=0, must-revalidate

```

### 5.2 `robots.txt` Rule

* **Do NOT add `Disallow: /fragments/` or `Disallow: /datasets/` to `public/robots.txt`.** Blocking those paths prevents search crawlers from reading the `X-Robots-Tag: noindex` HTTP header if an external page links directly to a fragment URL.

### 5.3 Accessible `<button>` Triggers (No `<a href>` Crawler Traps)

* Trigger `<dialog>` content using `<button type="button">` elements (e.g., `<button type="button" data-dialog-domain="help" data-dialog-id="roc-auc">`) rather than `<a href="/fragments/help/roc-auc.html">`. Crawlers do not follow `data-*` attributes on buttons, preventing standalone fragment discovery while allowing the main application shell to remain indexable.

---

## 6. Client-Side Index & `<dialog>` Loader (`src/services/content-loader.ts`)

Implement a lightweight typed loader consumed by Lit `<dialog>` components:

1. **Single-Fetch Index Cache:** Cache fetched index arrays in a module-level `Map<ContentDomain, Promise<unknown>>` so opening the dataset catalog, help glossary, or footer navigation fetches `/indexes/{domain}.json` at most once per page session.
2. **Hash-Busted Fragment Fetching:** Look up the target entry in the cached index to resolve `fragmentUrl` and `hash`, then fetch `${entry.fragmentUrl}?v=${entry.hash}` and cache the resulting HTML string in memory.
3. **Anchor Scrolling inside `<dialog>`:** If an optional `sectionId` (e.g., `"logistic-regression"` inside `models/card.html`) is passed when opening a dialog, call `dialogElement.querySelector(`#${CSS.escape(sectionId)}`)?.scrollIntoView({ behavior: 'smooth' })` immediately after `dialogElement.showModal()`.

---

## 7. Definition of Done

* [ ] `bun run build:content` compiles all Markdown files in `./public/datasets/*/datasheet.md` and `./content/{models,pages,help}/*.md` into valid HTML fragments without `<html>`/`<body>` wrappers.
* [ ] `/public/indexes/datasets.json`, `models.json`, `pages.json`, and `help.json` are generated and conform strictly to `src/types/content-index.ts`.
* [ ] Every object in `/public/indexes/datasets.json` contains accurate `title`, `id`, `shortDescription`, `rows`, and `columns` values matching its `metadata.json`.
* [ ] All external `http(s)` links inside compiled fragments carry `target="_blank" rel="noopener noreferrer"`, and broken internal links fail the build.
* [ ] `public/_headers` serves `X-Robots-Tag: noindex, nofollow` on `/fragments/*`, `/datasets/*/datasheet.html`, and `/indexes/*`.
* [ ] `--watch` mode rebuilds modified Markdown files and updates affected JSON indexes cleanly without infinite file-watcher loops.

```

```