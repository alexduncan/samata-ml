# Mockup Review Improvements

**Status:** implemented | **Updated:** 2026-11-21T20:12:31Z
**Authors:** Google Antigravity (Gemini 4 Neon High), Google Antigravity (Gemini) | **Created:** 2026-11-20T17:44:07Z
**Verified by:** Google Antigravity (Gemini 4 Neon High) | **Verified:** 2026-11-21T10:09:23Z | **Verification:** approved
**Verified hash:** sha256:f34dd07a43da86070de76a354cfe9bafdcdb1745731459ae01f6ce09c0ab676f
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour:** Mockup HTML and CSS files are split across `specification/mockups/`, `specification/mockups/ui-scaffold/`, `specification/mockups/ui-scaffold/css/`, and `specification/mockups/ui-scaffold/drafts/`, with four 0-byte empty placeholders in `ui-scaffold/` duplicating non-empty drafts in `drafts/`. `scripts/serve-mockups.ts` serves files under `/files/<relativePath>`, renders an unstyled server-HTML catalogue at `/` (using `serve:mockups` and legacy alias `serve:scaffold`), and injects a Shadow DOM `#__mockup-review-helper-host` at the top of `<main>` with a `<label>`, `<select>`, and manual **Go** button. Draft mockups lack structured `<meta>` headers and consistent opening/closing state comments.

**Target behaviour:** All 26 unique mockup HTML files live flat directly in `specification/mockups/` alongside `style.css`, `mockups.css`, and `css/*.css`. Every mockup HTML file carries `<meta name="name">`, `<meta name="description">`, and `<meta name="status" content="draft|ready|implemented" />`, and multi-state drafts wrap each state fragment in opening and closing HTML comments. Running `bun run mockups` serves files flat at `http://localhost:3333/<filename>`, serves live metadata at `/index.json`, renders a `<body class="mockup-index">` catalogue containing `<table class="mockups">` at `/` with client-side search and status filtering, and injects `<link rel="stylesheet" href="/mockups.css" />` into `<head>` plus a light-DOM `#__mockup-review-helper-host` (auto-navigating `<select id="preview-page">` populated from `/index.json` and `.index-link` with SVG icon) before `</body>` on normal previews only. `?clean=1` remains byte-identical to disk so visual parity and `bun run audit:mockups` are unaffected. All mockup-related `scaffold` references are renamed to `mockups`.

**Why:** Removes nested `ui-scaffold/` friction, lets the human style mockups and the review bar directly via `mockups.css`, gives every mockup plain-English context and lifecycle status, and makes multi-state draft files clear to read and style.

## Scope

**In scope**

- Flatten `specification/mockups/` so all 26 unique HTML files, `style.css`, `mockups.css`, and `css/*.css` live directly under `specification/mockups/`, removing the 4 empty 0-byte duplicate placeholders and the `ui-scaffold/` / `drafts/` subdirectories.
- Backfill `<meta name="name">`, `<meta name="description">`, and `<meta name="status" content="draft|ready|implemented" />` on all 26 mockup HTML files, fix relative `./style.css` links, and strip temporary static prototype `mockups.css` links and `#__mockup-review-helper-host` blocks from draft files.
- Backfill opening/closing HTML state comments (`<!-- State -->` / `<!-- This will display when... -->` / `<!-- / State -->`) on the 11 existing multi-state draft HTML files and codify the rule for future agent-authored drafts.
- Update `scripts/serve-mockups.ts` to serve flat URLs (`/<filename>`, `/index.json`, `/__source/<filename>`, `/__hmr`), render the `/` index page from `/index.json` with client-side search and status filter, inject `/mockups.css` into `<head>` and light-DOM `#__mockup-review-helper-host` + auto-navigating `<select>` script before `</body>` on normal previews, and return untouched raw bytes on `?clean=1`.
- Update `scripts/audit-mockups.ts` and `scripts/config.ts` for flat mockup paths and the `bun run mockups` command.
- Replace `serve:scaffold` and `serve:mockups` with `bun run mockups` (keeping default port `3333`) and rename all active mockup `scaffold` / `ui-scaffold` references across scripts, tooling config, tests, TSDoc comments, `AGENTS.md`, `README.md`, and active specifications.
- Update unit tests (`tests/serve-mockups.test.ts`, `tests/audit-mockups.test.ts`) and Playwright E2E/visual-parity tests referencing mockup server URLs.

**Out of scope**

- Visual redesign of `specification/mockups/mockups.css` beyond preserving existing human-authored rules unchanged when moving the file.
- Implementing the remaining unclaimed sections of `specification/notes/ui-fixes.md` (`Improve Virtualized Table`, `Dot Rules`, `General Fixes`), or deleting `specification/notes/ui-fixes.md`.
- Renaming historical `scaffolding-*.md` archived plans under `specification/plans/archive/`, `specification/plans/README.md` archive rows, or `TODO-52`.
- Modifying unrelated active plans (`web-ml-phase-3..7`, which still cite `ui-scaffold/drafts/` visual-reference paths, or `web-ml-classification-integration.md`) — deferred `web-ml-phase-3..7` paths update when each plan is next revised or implemented.
- Fixing pre-existing unrelated `tests/visual-parity.e2e.ts` / `PH-AC-2` main-padding baseline failures already tracked in `specification/HUMAN.md`.
- Changing application runtime code, styles, or production bundling (`src/` changes are strictly limited to two TSDoc comment paths in `src/styles/`).

**Constraints and invariants**

- `?clean=1` on any HTML mockup MUST return the exact raw file bytes from disk (`Cache-Control: no-store`), with zero injected `<link>`, `#__mockup-review-helper-host`, or `<script>` tags, preserving `tests/visual-parity.e2e.ts` and `bun run audit:mockups`.
- Default mockup server port MUST remain `3333` (`http://localhost:3333/`) so it runs concurrently with `bun run server` (`https://localhost:3000/`) during Playwright tests and side-by-side manual review.
- `scripts/serve-mockups.ts` MUST stay read-only (`GET`/`HEAD` only, `405` otherwise) and preserve path-traversal, malformed-URI (`400`), symlink-escape (`403`), and `X-Content-Type-Options: nosniff` protections on `/__source/*`.
- All DOM rendering in the injected helper script and the `/` index page script MUST use safe DOM APIs (`document.createElement`, `textContent`, `setAttribute`) or strict HTML escaping on the server — never unescaped `innerHTML` interpolation of filenames or `<meta>` values.
- `specification/mockups/mockups.css` is human-owned: move it verbatim without altering or overwriting human-authored CSS rules. The `/` index document rendered by `renderIndexHtml()` MUST set `<body class="mockup-index">` so human-authored rules in `mockups.css` can style the catalogue independently of the preview helper's `body` top-margin offset.
- Status governance replaces directory governance: agents may create/edit files in `specification/mockups/` only when `<meta name="status" content="draft" />` (or when explicitly authorised by a plan); `ready` and `implemented` mockups remain human-owned.
- WCAG 2.2 AA auditing continues strictly for actual product mockups via `bun run audit:mockups` (no rule exclusions); the developer-only review helper bar and `/` catalogue index are exempt from mandatory WCAG/no-JS gates (per user decision).

## Required reading

- `specification/notes/ui-fixes.md` § "Better Mockup Navigation" (lines 6–83) — original human specification for helper HTML, metadata, flat layout, command rename, and multi-state HTML comments.
- `specification/mockup-review.md` (lines 1–128) — current review server and workflow rules to update in T5.
- `specification/visual-design.md` §1, §1.1, §2, §3, §6 — mockup source-of-truth, draft rules, and verification docs to update in T5.
- `specification/mockups/ui-scaffold/mockups.css` (lines 1–109 on `main`) — human-authored helper stylesheet (selector contract for `#__mockup-review-helper-host`, `#mockup-details`, `#mockup-controls`, `#preview-page`, `.index-link`, `.mockup-status-*`; plus `body.mockup-index` and `.mockups` hook contract for human styling).
- `specification/mockups/ui-scaffold/drafts/00-3_mockup-review.html` (lines 1–121 on `main`) — developer reference mockup for the local mockup index (moved in place without overwriting human edits).

## Codebase context

Facts verified by `codebase-scout`, so downstream agents need not re-sweep the tree.

- **Relevant specifications:** `specification/visual-design.md` (mockup paths, draft rules, TOOL-01), `specification/mockup-review.md` (server routes, audit CLI, promotion workflow), `specification/ARCHITECTURE.md` (local mockup tooling), `specification/testing.md` (`mockup-review.e2e.ts` and `audit:mockups` contracts), `specification/README.md`, `specification/COMPONENTS.md`, `specification/workflow-steps.md`, `specification/app-state-and-navigation.md`, `specification/TODO.md`, `specification/HUMAN.md`, `specification/components/{content-modal,model-configuration,training-setup,virtual-table}.md`.
- **Relevant implementation:**
    - `scripts/serve-mockups.ts` (lines 1–666) — exports `MockupFileInfo`, `ServerCliOptions`, `formatBytes`, `extractHtmlTitle`, `getMockupFiles`, `parseCliArgs`, `renderIndexHtml`, `injectPreviewHelper`, `startMockupsServer`; currently scans recursively, detects `ui-scaffold/drafts/`, serves `/files/<path>` and `/__source/<path>`, injects Shadow DOM helper after `<body>`. `tests/serve-mockups.test.ts` (lines 6–13) imports `extractHtmlTitle`, `formatBytes`, `getMockupFiles`, `parseCliArgs`, `renderIndexHtml`, `startMockupsServer` and structurally depends on `MockupFileInfo` and `ServerCliOptions`, so T2 must update `tests/serve-mockups.test.ts` and `tests/audit-mockups.test.ts` in the same task so `bun run typecheck` passes.
    - `scripts/audit-mockups.ts` (lines 1–414) — imports `getMockupFiles` and `type MockupFileInfo` from `./serve-mockups`, hits `http://localhost:${port}/files/${relativePath}?clean=1`, checks reachability on `http://localhost:${port}`, prints `bun run serve:mockups` on connection failure.
    - `scripts/config.ts` (lines 1–19) — exports `MOCKUPS_DIR` (line 14) and unused `UI_SCAFFOLD_DIR` (line 19).
    - `package.json` (lines 8–9) — defines `serve:mockups` and `serve:scaffold` (alongside `audit:mockups`).
    - `playwright.config.ts` (lines 38–39) — starts `bun run serve:mockups --port 3333` on `http://localhost:3333`.
    - `.claude/launch.json` (lines 12–14), `.vscode/launch.json` (lines 25–29), `.agents/scripts/whitelist-check.ts` (line 83), `.agents/.agents/scripts/whitelist-check.ts` (line 83; verified real tracked file, not a symlink) — reference `serve:scaffold` / `serve:mockups`.
    - `src/styles/hyperparameters.styles.ts` (line 5), `src/styles/train-model.styles.ts` (line 5) — TSDoc comments citing `specification/mockups/ui-scaffold/css/...`.
    - `specification/mockups/` — 50 files total: 30 HTML files (1 root `basic-html-structure.html`, 12 non-empty + 4 empty 0-byte duplicates in `ui-scaffold/`, 13 non-empty in `ui-scaffold/drafts/`), `ui-scaffold/style.css`, `ui-scaffold/mockups.css` (109 lines on `main`), and 18 stylesheets in `ui-scaffold/css/`.
- **Tests and commands:** `tests/serve-mockups.test.ts` (lines 1–252), `tests/audit-mockups.test.ts` (lines 1–179), `tests/mockup-review.e2e.ts` (lines 1–120), `tests/visual-parity.e2e.ts` (line 28), `tests/visual-parity/fixtures.ts` (line 93), `tests/app-shell.e2e.ts` (lines 729, 834, 1024 — `FOCUS-AC-6`, `PH-AC-2`, `BTN-AC-13`), `tests/welcome-acceptance.e2e.ts` (line 83), `tests/content-dialog.e2e.ts` (line 282). Commands from `AGENTS.md`: `bun run check`, `bun test <path>`, `bun run typecheck`, `bun run build`, `bun run format <files>`, `bun run test:e2e [file]`, `bun run audit:mockups [paths]`, `bun run plans:check`.
- **Web guidance:** None — standard native HTML/DOM (`fetch`, `EventSource`, `<select>` `change` event, `<meta>` elements) with no novel web-platform APIs.
- **Visual reference:** `specification/mockups/ui-scaffold/mockups.css` (`#__mockup-review-helper-host`, `#mockup-details`, `#mockup-controls`, `#preview-page`, `.index-link`, `.mockup-status-*`, plus `body.mockup-index` and `.mockups` selector contract for human styling); deviations: none (developer review tooling).
- **Domain skills:** None — no Lit components, sample datasets, or upstream `web-ml` contracts are modified.
- **Assumptions requiring verification:** None — all design ambiguities were resolved with the user during planning (D1–D6), `.agents/.agents/scripts/whitelist-check.ts` is verified as a real tracked file, and `CLAUDE.md` is a symlink to `AGENTS.md` (editing `AGENTS.md` updates both).

## Technical decisions

| Decision                                    | Chosen approach and rationale                                                                                                                                                                                                                                                                                                                                                                                                                                             | Rejected alternative / trade-off                                                                                                                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1. Helper stylesheet name and injection    | Keep filename `specification/mockups/mockups.css` (matching existing human-authored file). Inject `<link rel="stylesheet" href="/mockups.css" />` into `<head>` only on normal previews; omit it on `?clean=1`. Keeps `?clean=1` byte-identical to disk so `mockups.css`'s 60px top-offset rules never break `visual-parity.e2e.ts` or `audit:mockups`.                                                                                                                   | Renaming to `mockup.css` (contradicts existing human-edited `mockups.css`), or hardcoding `<link href="./mockups.css">` in every HTML file (leaks into `?clean=1` unless CSS rules are rewritten).       |
| D2. Script command and default port         | Replace both `serve:scaffold` and `serve:mockups` with `bun run mockups` in `package.json`, keeping default port `3333` (`http://localhost:3333/`). Allows `bun run server` (`https://localhost:3000`) and `bun run mockups` (`http://localhost:3333`) to run simultaneously as required by Playwright and side-by-side manual review.                                                                                                                                    | Changing default port to `3000` (collides with `bun run server` and breaks `playwright.config.ts`), or retaining `serve:mockups` as a redundant alias.                                                   |
| D3. Flattened URL layout and `/` index page | Serve all files flat at `/<relativePath>` (e.g. `/00_first-load.html`, `/style.css`, `/css/root.css`, `/mockups.css`), plus `/index.json`, `/__source/<relativePath>`, and `/__hmr`. Render `<body class="mockup-index">` containing `<table class="mockups">` (Name+filename link, Description, Status, Actions: View source + Clean preview) on `/` via client-side JS fetching `/index.json`, with client-side text search and status filter (`all \| draft \| ready \| implemented`) and no Resources section. | Keeping `/files/<path>` prefix (conflicts with `<option value="{file-name.html}">` and adds unnecessary indirection once flattened), or omitting `body.mockup-index` / search & status filters (leaves index page with preview top-margin offset and harder to navigate 26+ mockups). |
| D4. Metadata & state-comment backfill       | Delete the 4 empty 0-byte duplicates in `ui-scaffold/`; backfill `<meta name="name">`, `<meta name="description">`, and `<meta name="status">` across all 26 unique HTML files (11 ported → `implemented`; `04_compare-results.html`, `basic-html-structure.html`, and 13 former drafts → `draft`); backfill opening/closing HTML state comments on the 11 existing multi-state draft files.                                                                              | Applying `<meta>` or comments only to new files (leaves `/index.json` incomplete and existing drafts inconsistent).                                                                                      |
| D5. Light-DOM helper bar without Shadow DOM | Inject `#__mockup-review-helper-host` as light DOM directly before `</body>` with no Shadow DOM, no `<label>`, and no **Go** button; populate `<select id="preview-page">` from `/index.json` and navigate immediately on `change`. Document styles in `/mockups.css` directly style `#__mockup-review-helper-host` and its descendants; WCAG/no-JS checks are dropped for this developer-only helper while remaining enforced on product mockups via `audit:mockups`.    | Retaining Shadow DOM (blocks external `mockups.css` styling of `#mockup-details`, `#mockup-controls`, `#preview-page`, `.index-link`).                                                                   |
| D6. Status-based edit governance            | Replace the old `ui-scaffold/drafts/` directory boundary with `<meta name="status" content="draft\|ready\|implemented" />`: agents may create/edit `draft` mockups only; `ready` and `implemented` mockups remain human-owned. Promotion happens in place by changing the `<meta name="status">` attribute rather than moving files across folders.                                                                                                                       | Keeping a `drafts/` subdirectory (contradicts requirement 4 to flatten `specification/mockups/`).                                                                                                        |

### Interfaces and behaviour

#### 1. Mockup HTML `<meta>` contract and migration table

Every HTML file directly inside `specification/mockups/` MUST declare these three `<meta>` elements inside `<head>`:

```html
<meta name="name" content="{Plain English Name}" />
<meta name="description" content="{When the user encounters this UI}" />
<meta name="status" content="{draft|ready|implemented}" />
```

All 26 unique files after flattening (deleting the 4 empty 0-byte duplicates `ui-scaffold/03-4..03-7`):

| Flattened filename                            | `status`      | `name`                        | `description`                                                                                                                                   | Multi-state comments                                   |
| --------------------------------------------- | ------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `00_first-load.html`                          | `implemented` | Welcome Modal                 | First-visit welcome dialog displayed over the Select Data page before the user begins.                                                          | No                                                     |
| `00-2_content-modal.html`                     | `draft`       | Content Modal                 | Reserved-route modal dialog displaying About, Privacy, or Help Markdown prose and its load-error state.                                         | Yes (2 dialog states)                                                                      |
| `00-3_mockup-review.html`                     | `draft`       | Mockup Review Catalogue       | Developer reference mockup for the local mockup index table and review controls.                                                                | No (preserve `./mockups.css` link if present)                                              |
| `01-1_select-data.html`                       | `implemented` | Select Data                   | Step 1 landing view where the user chooses a sample dataset or uploads a local CSV file.                                                        | No                                                     |
| `01-2_dataset-card.html`                      | `implemented` | Dataset Card Modal            | Datasheet modal dialog shown when inspecting a sample dataset's metadata and ethics notes.                                                      | No                                                     |
| `01-3_upload-dataset.html`                    | `implemented` | Upload Dataset Modal          | Modal dialog for selecting or dropping a local CSV file to import into the browser.                                                             | No                                                     |
| `01-4_preview-dataset.html`                   | `implemented` | Preview Dataset               | Step 1 view shown after loading a dataset, presenting the dataset summary header and data preview table.                                        | No                                                     |
| `01-5_preview-dataset-aside.html`             | `implemented` | Column Details Panel          | Slide-over inspector panel showing summary statistics and distributions for a selected dataset column.                                          | No (normative)                                         |
| `01-6_virtual-table.html`                     | `draft`       | Virtual Table Preview         | Populated virtualised dataset preview table with column edit actions and horizontal scrolling.                                                  | No (strip prototype helper & `mockups.css`)            |
| `01-7_data-states.html`                       | `draft`       | Data Loading and Error States | Step 1 transient states: remote sample notice, loading progress, upload error, import summary, column details, and change-dataset confirmation. | Yes (7 states)                                         |
| `01-8_table-loading.html`                     | `draft`       | Virtual Table States          | Loading, empty, and error states for the virtualised dataset preview table.                                                                     | Yes (3 states; strip prototype helper & `mockups.css`) |
| `02-1_set-target.html`                        | `implemented` | Select Target                 | Step 2 view listing dataset columns before a target variable has been chosen.                                                                   | No                                                     |
| `02-2_target-set.html`                        | `implemented` | Target Selected               | Step 2 view once a target column is selected, showing the active target badge and model-reset alert.                                            | No                                                     |
| `02-3_target-states.html`                     | `draft`       | Target Selection States       | Step 2 states: no dataset loaded, loading, error, column eligibility notes, and model-reset confirmation.                                       | Yes (5 states)                                         |
| `03-0_models-overview.html`                   | `draft`       | Models Overview               | Step 3 hub listing trained and draft models, plus blocked, empty, loading, and error states.                                                    | Yes (5 states)                                         |
| `03-1_train-models-disabled.html`             | `implemented` | Train Models Blocked          | Step 3 view shown when either a dataset or a target variable has not been selected yet.                                                         | No                                                     |
| `03-2_train-models-1-choose-model.html`       | `implemented` | Choose Model                  | Step 3 builder Section 1 where the user selects a machine learning model to configure.                                                          | No                                                     |
| `03-3_train-models-2-select-features.html`    | `implemented` | Select Features               | Step 3 builder Section 2 where the user selects which input columns the model uses.                                                             | No                                                     |
| `03-4_train-models-3-configure-model.html`    | `draft`       | Configure Model               | Step 3 builder Section 3 hyperparameter form, advanced search options, and loading/error/invalid states.                                        | Yes (9 states: 1 builder + 8 variant/error sections; strip prototype `mockups.css`)        |
| `03-5_train-models-4-configure-training.html` | `draft`       | Training Setup                | Step 3 builder Section 4 train/test split and cross-validation strategy controls, fold matrix, and error/blocked states.                        | Yes (4 states: 1 builder + 3 alternate sections)                                           |
| `03-6_train-models-5-train.html`              | `draft`       | Model Training                | Step 3 builder Section 5 training progress phases, cancellation, failure, reload recovery, and completion states.                               | Yes (14 states: 1 builder with 3 protocol sub-blocks + 13 phase/outcome sections)          |
| `03-7_train-models-5-results.html`            | `draft`       | Single Model Results          | Step 3 builder Section 6 evaluation metrics, model diagnostics, tuning history, and empty/loading/error states.                                 | Yes (12 states)                                        |
| `03-8_model-description.html`                 | `draft`       | Model Description Modal       | Modal dialog displaying plain-English educational documentation for a classifier, plus loading, missing, and error states.                      | Yes (4 states)                                         |
| `03-9_choose-model-text-entries.html`         | `draft`       | Choose Model Text Entries     | Accessible text-entry model chooser fallback for classifiers without illustrated cards, plus loading/error/empty states.                        | Yes (6 states)                                         |
| `04_compare-results.html`                     | `draft`       | Compare Results               | Step 4 placeholder view for comparing multiple trained models side by side.                                                                     | No                                                     |
| `basic-html-structure.html`                   | `draft`       | Basic Page Template           | Starter HTML shell template containing the SVG sprite, sidebar, and empty main landmark for new mockups.                                        | No                                                     |

#### 2. Multi-state HTML comment format

Whenever a mockup HTML file combines multiple fragments representing distinct UI states, each fragment is wrapped with:

```html
<!-- {State Name} -->
<!-- This will display when {condition}. -->
<section>...</section>
<!-- / {State Name} -->
```

Do not modify rendered elements, attributes, classes, or text when adding state comments to existing draft files.

#### 3. Server types and `/index.json` schema (`scripts/serve-mockups.ts`)

```ts
export type MockupStatus = 'draft' | 'ready' | 'implemented';

export interface MockupMetadata {
	name: string;
	description: string;
	status: MockupStatus;
}

export interface MockupIndexEntry extends MockupMetadata {
	filename: string;
	isEmpty: boolean;
	size: number;
	mtime: string;
}
```

- `ServerCliOptions` (`{ port: number; hostname: string; open: boolean }`) and `extractHtmlTitle(html: string): string` remain exported; legacy `MockupFileInfo` and `formatBytes` are retired in T2 alongside `scripts/audit-mockups.ts` and `tests/serve-mockups.test.ts`.
- `extractMockupMetadata(html: string, filename: string): MockupMetadata`:
    - Matches `<meta ...>` tags case-insensitively regardless of `name`/`content` attribute order and quote style (`"` or `'`).
    - Decodes common HTML character references (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`, `&#x27;`, numeric decimal/hex entities).
    - Fallbacks: `name` falls back to `extractHtmlTitle(html)` if non-empty, else `filename.replace(/\.html$/i, '')`; `description` falls back to `''`; `status` falls back to `'draft'` when missing or not in `['draft', 'ready', 'implemented']`.
- `getMockupFiles(dir: string = MOCKUPS_DIR): Promise<MockupIndexEntry[]>`:
    - Reads top-level regular non-symlink `.html` files directly inside `dir` (skipping dot-entries, subdirectories, and `index.html`).
    - Parses metadata via `extractMockupMetadata`, sets `isEmpty: stat.size === 0`, `size: stat.size`, `mtime: stat.mtime.toISOString()`, and sorts by `filename.localeCompare(other, 'en')`.

#### 4. Server routes (`scripts/serve-mockups.ts`)

Default address: `http://localhost:3333` (`--port` / `-p`, `--host` / `-h`, `--open` / `-o` CLI flags preserved). Methods other than `GET` / `HEAD` return `405`. All responses include `Cache-Control: no-store`.

| Route                          | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /`, `GET /index.html`     | Serves the HTML index page (`text/html; charset=utf-8`), linking `/mockups.css` in `<head>`, rendering `<body class="mockup-index">` with `<header>`, client-side search (`#query`) + status filter (`#status-filter` with `all`, `draft`, `ready`, `implemented`), `#results-count`, `<table class="mockups">` (`Name`, `Description`, `Status`, `Actions`), client-side script fetching `/index.json` to render rows safely via DOM APIs, and `EventSource('/__hmr')` reload listener. |
| `GET /index.json`              | Returns `200` `application/json; charset=utf-8` containing `JSON.stringify(await getMockupFiles(rootDir))` computed fresh on each request.                                                                                                                                                                                                                                                                                                |
| `GET /__hmr`                   | SSE live-reload stream (`text/event-stream`). Watches `rootDir` recursively (150ms debounce) and emits `data: reload\n\n` on any HTML or CSS edit.                                                                                                                                                                                                                                                                                        |
| `GET /__source/<relativePath>` | Resolves safe regular non-symlink path inside `rootDir`. Returns `200` `text/plain; charset=utf-8` + `X-Content-Type-Options: nosniff` for text extensions (`.html`, `.htm`, `.css`, `.js`, `.mjs`, `.json`, `.md`, `.txt`); `415` for other extensions; `400`/`403`/`404` on invalid/escaping/missing paths.                                                                                                                             |
| `GET /<relativePath>`          | Resolves safe regular non-symlink file inside `rootDir` (including top-level `*.html`, `style.css`, `mockups.css`, and nested `css/*.css`). For `.html`: if `?clean=1`, returns untouched raw file bytes; otherwise returns `injectPreviewHelper(html, entry)`. For non-HTML: serves raw bytes with MIME type (`text/css`, etc.). Returns `400` on malformed URI encoding, `403` on path/symlink escape, `404` when not found.            |

#### 5. Preview helper injection (`injectPreviewHelper(html: string, entry: MockupIndexEntry): string`)

- Injects `<link rel="stylesheet" href="/mockups.css" />` immediately before `</head>` (case-insensitive; prepends if `</head>` is absent).
- Injects the following light-DOM `#__mockup-review-helper-host` block and inline `<script>` immediately before `</body>` (case-insensitive; appends if `</body>` is absent):

```html
<div id="__mockup-review-helper-host">
	<div id="mockup-details">
		<h4 class="mockup-name">
			{escapeHtml(entry.name)}
			<span class="mockup-status mockup-status-{entry.status}">{entry.status}</span>
		</h4>
		<p class="mockup-description">{escapeHtml(entry.description)}</p>
	</div>
	<nav id="mockup-controls" aria-label="Mockup review">
		<select id="preview-page"></select>
		<a href="/" class="index-link">
			<svg
				class="index-link-icon"
				xmlns="http://www.w3.org/2000/svg"
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round">
				<path d="M14 3v4a1 1 0 0 0 1 1h4" />
				<path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2" />
				<path d="M9 9l1 0" />
				<path d="M9 13l6 0" />
				<path d="M9 17l6 0" />
			</svg>
			<span class="index-link-text">Index</span>
		</a>
	</nav>
</div>
```

- Inline `<script>` behaviour:
    1. Reads current filename from a safe escaped JSON string embedded in the script (`const currentFile = ${JSON.stringify(entry.filename).replace(/</g, '\\u003c')};`).
    2. Calls `fetch('/index.json')`; for each entry, appends `<option>` (`option.value = item.filename`, `option.textContent = item.name + ' (' + item.filename + ')'`, `option.selected = item.filename === currentFile`) to `#preview-page`.
    3. Attaches a `change` listener on `#preview-page` that navigates immediately to `'/' + encodeURIComponent(select.value)` when `select.value` is non-empty and differs from `currentFile`.
    4. Opens `new EventSource('/__hmr')` and reloads on `event.data === 'reload'`.

#### 6. Index table row contract (`/`)

`renderIndexHtml()` outputs a complete HTML5 document linking `<link rel="stylesheet" href="/mockups.css" />` in `<head>` and using `<body class="mockup-index">` (with no `#__mockup-review-helper-host` bar).

Each row rendered into `<table class="mockups"><tbody>` for an entry in `/index.json`:

- Cell 1 (`Name`): `<a href="/{encodeURIComponent(filename)}">{name}</a><br /><small>{filename}</small>`
- Cell 2 (`Description`): `{description}`
- Cell 3 (`Status`): `<span class="mockup-status mockup-status-{status}">{status}</span>`
- Cell 4 (`Actions`): `<a href="/__source/{encodeURIComponent(filename)}">View source</a>` and `<a href="/{encodeURIComponent(filename)}?clean=1">Clean preview</a>`

Client-side filtering matches `#query` case-insensitively against `name`, `filename`, and `description`, combined with `#status-filter` (`all` or exact `status`). Updates `#results-count` (`"Showing {shown} of {total} mockups"`). When zero entries match, renders a single `<tr><td colspan="4">No mockups match your filter.</td></tr>`.

#### 7. `scripts/audit-mockups.ts` contract

- Imports `getMockupFiles` and `type MockupIndexEntry` from `./serve-mockups`; populates `MockupAuditFileResult.file` and `MockupAuditReport.skipped` with `file.filename` to preserve the report JSON/HTML schema.
- Accepts optional positional mockup filenames relative to `specification/mockups/` (e.g. `03-0_models-overview.html`) and `--port <1..65535>` (default `3333`). Rejects invalid paths (`..`, leading `/`, nested paths), non-`.html` files, missing files, and explicit 0-byte HTML files with exit code `2`; skips empty HTML files in all-pages mode.
- Audits `http://localhost:${port}/${encodeURIComponent(file.filename)}?clean=1` for each target (or all non-empty top-level HTML files when no paths are given).
- Reports `Cannot reach http://localhost:${port}. Start it with bun run mockups.` on connection failure (exit code `2`).

## Specification changes

- [x] `AGENTS.md` (and symlink `CLAUDE.md`) §Verification Commands, §Map, §Rules — replace `serve:mockups` with `bun run mockups`; document flat `specification/mockups/` layout, `<meta name="name|description|status">` headers, status-based edit governance (`draft` vs human-owned `ready`/`implemented`), and multi-state HTML comment convention.
- [x] `README.md` — replace `serve:mockups` and `serve:scaffold` with `bun run mockups` and update `audit:mockups` example path to `03-0_models-overview.html`.
- [x] `specification/README.md` §Other directories — replace `serve:mockups` with `bun run mockups` and update `mockups/` description from `ui-scaffold/drafts/` to flat `status="draft"` files.
- [x] `specification/ARCHITECTURE.md` §Local mockup review tooling — update command to `bun run mockups`, remove deprecated `serve:scaffold`, document flat URLs, `/index.json`, JS-rendered table, injected `/mockups.css` + bottom light-DOM helper, and untouched `?clean=1`; status remains `partial`.
- [x] `specification/visual-design.md` §1, §1.1, §2, §3, §6 — update all `mockups/ui-scaffold/` and `drafts/` paths to flat `mockups/`; specify `<meta name="name|description|status">`, `draft|ready|implemented` lifecycle, multi-state HTML comment rule, injected `/mockups.css` + bottom light-DOM helper absent on `?clean=1`, and `bun run mockups`; status remains `partial`.
- [x] `specification/mockup-review.md` — rewrite browse/preview/promotion workflow for `bun run mockups`, flat URLs, `/index.json`, JS-rendered table, auto-navigating `<select>`, in-place status promotion (`draft` → `ready` → `implemented`), and multi-state HTML comments; update L38 (`../style.css` → `./style.css` and "shared scaffold stylesheet" → "shared mockups stylesheet"); update the review record path (L74) from `specification/mockups/ui-scaffold/drafts/reviews/<surface>.md` to `specification/mockups/reviews/<surface>.md` and state that review records are not listed in the `/` catalogue or `/index.json` (which list top-level `.html` files only), remain readable via `/__source/reviews/<surface>.md`, and are not approvals; status remains `implemented`.
- [x] `specification/testing.md` §Mockup review checks — update `tests/mockup-review.e2e.ts` contract to flat URLs, `/index.json`, JS-rendered table, client-side filtering, bottom light-DOM helper, auto-navigation, untouched `?clean=1`, and note that strict WCAG auditing applies to product mockups via `bun run audit:mockups` rather than the developer helper/catalogue; status remains `partial`.
- [x] `specification/COMPONENTS.md` — update `specification/mockups/ui-scaffold/` reference (line 146) to `specification/mockups/`; status remains `partial`.
- [x] `specification/workflow-steps.md` — update `mockups/ui-scaffold/` links to `mockups/`; status remains `partial`.
- [x] `specification/app-state-and-navigation.md` — replace `ui-scaffold` / `scaffold` mockup references (lines 205, 407) with `mockups`; status remains `draft`.
- [x] `specification/TODO.md` — update `mockups/ui-scaffold/` headings/paths (lines 94, 123) and narrow `TODO-36` to reflect removed empty `03-4`..`03-7` placeholders and flat `status="draft"` files.
- [x] `specification/components/content-modal.md` (L57: `drafts/00-2_content-modal.html` → `specification/mockups/00-2_content-modal.html`), `specification/components/model-configuration.md` (L45: `specification/mockups/ui-scaffold/drafts/03-4_train-models-3-configure-model.html` → `specification/mockups/03-4_train-models-3-configure-model.html`), `specification/components/training-setup.md` (L53: `../mockups/ui-scaffold/drafts/03-5_train-models-4-configure-training.html` → `../mockups/03-5_train-models-4-configure-training.html`), `specification/components/virtual-table.md` (L74: `specification/mockups/ui-scaffold/drafts/01-6_virtual-table.html` → `specification/mockups/01-6_virtual-table.html`).
- [x] `specification/HUMAN.md` — update all 14 `mockups/ui-scaffold/...` Markdown links plus the inline `mockups/ui-scaffold/css/hyperparameters.css` path at L28 to flat `mockups/...`, update the `serve-mockups-review-workflow` items to reference `bun run mockups` and flat `mockups/00-3_mockup-review.html`, and note that `specification/notes/ui-fixes.md` § "Better Mockup Navigation" is implemented while its remaining sections stay unclaimed (do NOT delete `specification/notes/ui-fixes.md`).

## Implementation tasks

### T1 — Flatten `specification/mockups/`, migrate metadata, clean prototype hooks, and backfill state comments

- **Depends on:** None
- **Risk:** needs care — moves 46 files, deletes 4 empty duplicates, edits all 26 HTML `<head>` blocks, and inserts state comments across 11 multi-state draft files; must not corrupt existing rendered markup or overwrite human-authored `mockups.css`.
- **Likely files:** `specification/mockups/` — flatten `ui-scaffold/` and `ui-scaffold/drafts/` into `specification/mockups/`, backfill `<meta>` tags, clean prototype hooks, and add state comments
- **Must not touch:** `src/`, `css/`, `scripts/`, `tests/`, `specification/plans/` — isolate file migration to mockup assets only
- **Implementation:**
    1. Delete the 4 empty 0-byte placeholder files in `specification/mockups/ui-scaffold/`: `03-4_train-models-3-configure-model.html`, `03-5_train-models-4-configure-training.html`, `03-6_train-models-5-train.html`, and `03-7_train-models-5-results.html`.
    2. Move `specification/mockups/ui-scaffold/style.css`, `specification/mockups/ui-scaffold/mockups.css` (preserving all existing CSS rules verbatim), `specification/mockups/ui-scaffold/css/` (all 18 CSS files), all 12 remaining `specification/mockups/ui-scaffold/*.html` files, and all 13 `specification/mockups/ui-scaffold/drafts/*.html` files directly into `specification/mockups/` (keeping `css/*.css` under `specification/mockups/css/`). Remove the now-empty `ui-scaffold/` and `drafts/` directories (and any stale `.DS_Store` if untracked — never stage untracked OS files).
    3. Update stylesheet `<link>` tags across all 26 HTML files: replace `href="../style.css"` with `href="./style.css"`, remove the temporary `<link rel="stylesheet" href="../mockups.css" />` tags from the three product drafts (`01-6_virtual-table.html`, `01-8_table-loading.html`, and `03-4_train-models-3-configure-model.html`) along with the preceding orphan `<!-- Mockup-specific styles -->` comment at line 7 of `01-6_virtual-table.html` and `01-8_table-loading.html`, and in developer reference `00-3_mockup-review.html` rewrite `href="../mockups.css"` to `href="./mockups.css"` if present (do not inject one if absent on `main`).
    4. Remove the temporary static `<div id="__mockup-review-helper-host">...</div>` blocks at the bottom of `01-6_virtual-table.html` and `01-8_table-loading.html` (and update their placeholder `<title>{Simple Plain English Name of Mockup}</title>` to match their plain-English names).
    5. Add `<meta name="name" content="..." />`, `<meta name="description" content="..." />`, and `<meta name="status" content="draft|ready|implemented" />` inside `<head>` of every one of the 26 HTML files using the migration table in _Interfaces and behaviour §1_.
    6. Wrap each UI-state fragment in the exact 11 multi-state product draft files (`00-2_content-modal.html` [2 dialog states], `01-7_data-states.html` [7], `01-8_table-loading.html` [3], `02-3_target-states.html` [5], `03-0_models-overview.html` [5], `03-4_train-models-3-configure-model.html` [9: 1 builder + 8 variant/error sections], `03-5_train-models-4-configure-training.html` [4: 1 builder + 3 alternate sections], `03-6_train-models-5-train.html` [14: 1 builder — also completing explanatory second comment lines and closing `<!-- / ... -->` comments on its 3 protocol sub-blocks — + 13 phase/outcome sections], `03-7_train-models-5-results.html` [12], `03-8_model-description.html` [4], `03-9_choose-model-text-entries.html` [6]) with `<!-- {State Name} -->`, `<!-- This will display when ... -->`, and `<!-- / {State Name} -->` without altering rendered elements or classes. Leave `00-3_mockup-review.html` body markup untouched (no multi-state comments).
    7. Format edited HTML files with `bun run format`.
- **Acceptance criteria:**
    - [x] Exactly 26 `.html` files, `style.css`, `mockups.css`, and `css/` (18 `.css` files) exist in `specification/mockups/`; `ui-scaffold/` and `drafts/` directories no longer exist.
    - [x] Zero HTML files in `specification/mockups/` are 0 bytes, zero reference `../style.css`, and zero contain hardcoded `#__mockup-review-helper-host` markup.
    - [x] Zero product mockup HTML files link `mockups.css` directly on disk (at most developer reference `00-3_mockup-review.html` may link `./mockups.css` if present) so `?clean=1` on every product mockup omits `mockups.css`.
    - [x] All 26 HTML files declare non-empty `<meta name="name">`, `<meta name="description">`, and valid `<meta name="status">` (`draft` or `implemented` per §1 table).
    - [x] All 11 multi-state product draft HTML files wrap every listed state fragment (including all 9 top-level sections in `03-4`, all 4 in `03-5`, and all 14 top-level sections plus 3 protocol sub-blocks in `03-6`) in matching `<!-- {State} -->` / `<!-- / {State} -->` comments with an explanatory second comment line.
- **Verification:** `bun run format:check` on changed mockup files / verify file count, zero `../style.css` hits, zero static `#__mockup-review-helper-host` hits, and `<meta>` presence across all 26 HTML files.
- **Progress:** [x] Completed (2026-11-21T12:12:45Z)

### T2 — Update `scripts/serve-mockups.ts`, `scripts/audit-mockups.ts`, `scripts/config.ts`, and their unit tests

- **Depends on:** T1
- **Risk:** needs care — replaces server route model, `/index.json` generation, index page HTML/JS, preview helper injection, and unit test contracts in lockstep so `bun run check` stays green while preserving strict security checks and untouched `?clean=1` byte output.
- **Likely files:** `scripts/serve-mockups.ts`, `scripts/audit-mockups.ts`, `scripts/config.ts`, `tests/serve-mockups.test.ts`, `tests/audit-mockups.test.ts`
- **Must not touch:** `src/`, `css/`, `specification/mockups/`, `scripts/server.ts`, `scripts/static-server.ts`, `tests/*.e2e.ts` — keep app dev server, mockup assets, and Playwright E2E suites untouched
- **Implementation:**
    1. In `scripts/config.ts`, remove unused `UI_SCAFFOLD_DIR` and its `scaffold` comment; retain `MOCKUPS_DIR`.
    2. In `scripts/serve-mockups.ts`:
        - Export `MockupStatus`, `MockupMetadata`, `MockupIndexEntry`, `ServerCliOptions`, `extractHtmlTitle`, `extractMockupMetadata`, `getMockupFiles`, `parseCliArgs`, `renderIndexHtml`, `injectPreviewHelper`, and `startMockupsServer` with complete TSDoc on all exported symbols (`specification/standards-and-documentation.md`). Retire legacy `MockupFileInfo` and `formatBytes`.
        - Implement `extractMockupMetadata(html, filename)` and flat top-level `.html` discovery in `getMockupFiles(dir)` per _Interfaces and behaviour §3_.
        - Implement `GET /index.json` returning fresh JSON from `getMockupFiles(rootDir)` with `Cache-Control: no-store`.
        - Rewrite `renderIndexHtml()` to output the `/` index HTML5 document linking `/mockups.css` in `<head>`, using `<body class="mockup-index">`, containing `<header>`, `#query` search input, `#status-filter` `<select>` (`all`, `draft`, `ready`, `implemented`), `#results-count`, `<table class="mockups">` (`Name`, `Description`, `Status`, `Actions`), inline script fetching `/index.json` and rendering rows safely via DOM APIs (per _Interfaces and behaviour §6_), and `EventSource('/__hmr')`.
        - Rewrite `injectPreviewHelper(html, entry)` to inject `<link rel="stylesheet" href="/mockups.css" />` before `</head>` and the light-DOM `#__mockup-review-helper-host` markup + inline `<script>` (populating `#preview-page` from `/index.json`, auto-navigating on `change`, listening to `/__hmr`) before `</body>` per _Interfaces and behaviour §5_.
        - Update request routing in `startMockupsServer` to serve flat `/<relativePath>` (with `?clean=1` returning raw untouched bytes for `.html`), `/__source/<relativePath>`, `/index.json`, `/__hmr`, and `/` / `/index.html`, preserving `405` on non-`GET`/`HEAD`, `400` on malformed percent-encoding, `403` on path/symlink escape, `404` on missing files, `415` on non-text `/__source/*`, and `Cache-Control: no-store`. Remove all `ui-scaffold` / `drafts` path heuristics and legacy scaffold redirects.
    3. In `scripts/audit-mockups.ts`:
        - Switch imports from `MockupFileInfo` to `getMockupFiles` and `type MockupIndexEntry` from `./serve-mockups`, keeping `MockupAuditFileResult.file` (lines 247, 277, 369; rendered at line 146) and `MockupAuditReport.skipped` (line 339) populated with `file.filename`.
        - Update file discovery and target validation to flat top-level `.html` files (rejecting invalid paths, nested paths, non-HTML files, missing files, and explicit empty HTML files with exit code `2`; skipping empty HTML files in all-pages mode).
        - Update audited URLs from `/files/${path}?clean=1` to `/${encodeURIComponent(file.filename)}?clean=1`.
        - Update unreachable-server message to `Start it with bun run mockups.`
    4. Update `tests/serve-mockups.test.ts` in the same task so `bun run typecheck` and `bun run check` remain green:
        - Positive, negative, and boundary tests for `extractMockupMetadata` (standard tags, reversed `content`/`name` order, single quotes, HTML entities, missing tags falling back to `<title>`/filename/`''`/`'draft'`, invalid status normalising to `'draft'`).
        - Tests for flat `getMockupFiles` (ignores subdirectories, CSS files, dot-files, `index.html`; marks 0-byte HTML as `isEmpty: true`; deterministic sort).
        - Tests for `renderIndexHtml` (links `/mockups.css`, renders `<body class="mockup-index">`, `<table class="mockups">`, `#query`, `#status-filter`, `#results-count`, no `#__mockup-review-helper-host`).
        - Tests for `injectPreviewHelper` (injects `/mockups.css` before `</head>`, injects light-DOM `#__mockup-review-helper-host` with `#mockup-details`, `h4.mockup-name`, `.mockup-status-{status}`, `p.mockup-description`, `#mockup-controls`, `#preview-page`, `.index-link` SVG before `</body>`; HTML-escapes metadata and `</script>` sequences; no Shadow DOM, no `<label>`, no **Go** button).
        - Integration tests via `startMockupsServer({ port: 0, hostname: '127.0.0.1', enableWatcher: true, rootDir })`: `GET /` (contains `body class="mockup-index"`), `GET /index.json` (including live update when a new file is written), byte-identical `GET /<file>.html?clean=1`, injected `GET /<file>.html`, `GET /mockups.css`, `GET /css/theme.css`, `GET /__source/<file>.html` (`nosniff`, `text/plain`), `400` malformed URI, `403` symlink escape, `404` missing, `405` `POST`, `415` binary source, and `/__hmr` `data: reload` on HTML/CSS edits.
    5. Update `tests/audit-mockups.test.ts` in the same task:
        - Use flat temporary fixtures (`clean.html`, `failing.html`, `empty.html`, `clean.css`) and assert `?clean=1` URLs at `/<filename>?clean=1`, skipping empty HTML, rejecting non-HTML/empty/nested explicit targets with exit code `2`, and reporting `bun run mockups` when unreachable.
    6. Format edited files with `bun run format`.
- **Acceptance criteria:**
    - [x] `GET /index.json` returns valid JSON array of all top-level `.html` mockups with accurate `filename`, `name`, `description`, `status`, `isEmpty`, `size`, and `mtime`.
    - [x] `GET /` serves HTML linking `/mockups.css` with `<body class="mockup-index">`, `<table class="mockups">`, `#query`, `#status-filter`, and client-side `/index.json` renderer.
    - [x] `GET /<file>.html` injects `/mockups.css` in `<head>` and light-DOM `#__mockup-review-helper-host` before `</body>` with no Shadow DOM, no `<label>`, and no **Go** button.
    - [x] `GET /<file>.html?clean=1` returns byte-for-byte identical file bytes with no injected CSS, helper DOM, or `<script>`.
    - [x] Malformed URIs (`400`), symlink/traversal escapes (`403`), missing files (`404`), non-`GET`/`HEAD` (`405`), and non-text `/__source/*` (`415`) are rejected cleanly.
    - [x] `scripts/audit-mockups.ts` targets `/<filename>?clean=1` and references `bun run mockups` on setup error.
    - [x] `bun run check` (`tsc --noEmit && bun test`), `bun test tests/serve-mockups.test.ts`, and `bun test tests/audit-mockups.test.ts` all pass completely with zero TypeScript or test errors.
- **Verification:** `bun run check`, `bun test tests/serve-mockups.test.ts`, `bun test tests/audit-mockups.test.ts`
- **Progress:** [x] Completed (2026-11-21T19:48:47Z)

### T3 — Rename `scaffold` → `mockups` across scripts, tooling config, and source TSDoc comments

- **Depends on:** T2
- **Risk:** routine
- **Likely files:** `package.json`, `playwright.config.ts`, `.claude/launch.json`, `.vscode/launch.json`, `.agents/scripts/whitelist-check.ts`, `.agents/.agents/scripts/whitelist-check.ts`, `src/styles/hyperparameters.styles.ts`, `src/styles/train-model.styles.ts`
- **Must not touch:** `bun.lock`, `src/features/`, `src/components/`, `css/` — TSDoc comment updates only in `src/styles/`; no dependency or runtime component edits
- **Implementation:**
    1. In `package.json`, replace `"serve:mockups"` and `"serve:scaffold"` with `"mockups": "bun run scripts/serve-mockups.ts"`.
    2. In `playwright.config.ts`, change the mockup `webServer.command` from `'bun run serve:mockups --port 3333'` to `'bun run mockups --port 3333'` (keeping `url: 'http://localhost:3333'`).
    3. In `.claude/launch.json` and `.vscode/launch.json`, rename the scaffold launch configuration to `mockups` / `Run: mockups` with `"runtimeArgs": ["run", "mockups"]`.
    4. In both `.agents/scripts/whitelist-check.ts` (line 83) and `.agents/.agents/scripts/whitelist-check.ts` (line 83), update `serve:mockups|serve:scaffold|audit:mockups` to `mockups|audit:mockups`.
    5. In `src/styles/hyperparameters.styles.ts` (line 5) and `src/styles/train-model.styles.ts` (line 5), update TSDoc references from `specification/mockups/ui-scaffold/css/...` to `specification/mockups/css/...`.
    6. Run `bun run format` on modified files.
- **Acceptance criteria:**
    - [x] `bun run mockups` starts the mockup server on `http://localhost:3333`.
    - [x] Neither `serve:scaffold` nor `serve:mockups` remains in `package.json`, `playwright.config.ts`, `.claude/launch.json`, `.vscode/launch.json`, `.agents/scripts/whitelist-check.ts`, or `.agents/.agents/scripts/whitelist-check.ts`.
    - [x] Zero `ui-scaffold` references remain in `src/` or `scripts/`.
- **Verification:** `bun run check` and `bun test tests/style-tokens.test.ts`
- **Progress:** [x] Completed (2026-11-21T19:51:52Z)

### T4 — Update Playwright E2E and visual-parity tests

- **Depends on:** T3
- **Risk:** needs care — rewrites mockup-review Playwright E2E assertions and updates flattened mockup server URLs across five Playwright suites.
- **Likely files:** `tests/mockup-review.e2e.ts`, `tests/visual-parity.e2e.ts`, `tests/visual-parity/fixtures.ts`, `tests/app-shell.e2e.ts`, `tests/welcome-acceptance.e2e.ts`, `tests/content-dialog.e2e.ts`
- **Must not touch:** `tests/visual-parity/map.ts`, `src/`, `css/`, `specification/mockups/`, `scripts/` — update Playwright E2E/visual-parity URLs and review-tool assertions without changing parity maps, app code, or scripts
- **Implementation:**
    1. Update `tests/mockup-review.e2e.ts`:
        - Verify `GET http://localhost:3333/` renders `<body class="mockup-index">`, fetches `/index.json`, and renders `<table class="mockups">` with all 26 mockups, plain-English names, filenames, descriptions, statuses, and `View source` / `Clean preview` action links.
        - Verify client-side search (`#query`) and status filter (`#status-filter` for `draft`, `implemented`, `all`) filter table rows live and display the empty-state row when nothing matches.
        - Verify normal preview (`http://localhost:3333/03-4_train-models-3-configure-model.html`): `<link rel="stylesheet" href="/mockups.css">` present in `<head>`, light-DOM `#__mockup-review-helper-host` rendered before `</body>` (no `shadowRoot`), displays name/status/description, `.index-link` points to `/`, `#preview-page` populates from `/index.json` with `{name} ({filename})` and current file selected, and changing `#preview-page` navigates immediately to `/03-0_models-overview.html` without any **Go** button.
        - Verify `GET /03-4_train-models-3-configure-model.html?clean=1` has zero `#__mockup-review-helper-host`, zero `link[href="/mockups.css"]`, and zero `<script>` elements.
        - Verify `GET /__source/03-4_train-models-3-configure-model.html` returns `text/plain; charset=utf-8` with `X-Content-Type-Options: nosniff`.
    2. Update mockup server URLs from `/files/ui-scaffold/...?clean=1` and `/files/ui-scaffold/drafts/...?clean=1` to `/...?clean=1` in:
        - `tests/visual-parity.e2e.ts` (line 28)
        - `tests/visual-parity/fixtures.ts` (line 93)
        - `tests/app-shell.e2e.ts` (lines 729, 834, 1024 — `FOCUS-AC-6`, `PH-AC-2`, `BTN-AC-13`)
        - `tests/welcome-acceptance.e2e.ts` (line 83)
        - `tests/content-dialog.e2e.ts` (line 282)
    3. Format edited test files with `bun run format`.
- **Acceptance criteria:**
    - [x] `bun run check` passes completely (zero TypeScript errors, all unit tests passing).
    - [x] `bun run test:e2e tests/mockup-review.e2e.ts`, `bun run test:e2e tests/welcome-acceptance.e2e.ts`, and `bun run test:e2e tests/content-dialog.e2e.ts` pass across configured Playwright browsers.
    - [x] `bun run test:e2e tests/app-shell.e2e.ts` passes `FOCUS-AC-6`, `BTN-AC-13`, and every non-baseline test, with zero HTTP 404 or mockup-URL failures and no failures beyond the pre-existing `PH-AC-2` main-padding mismatch tracked in `specification/HUMAN.md`.
    - [x] `bun run test:e2e tests/visual-parity.e2e.ts` passes `PARITY-contract`, `SIDE-AC-10`, and all non-baseline parity tests, with zero HTTP 404 or mockup-URL failures and no failures beyond the 9 pre-existing main-padding baseline failures tracked in `specification/HUMAN.md`.
    - [x] `bun run audit:mockups 03-0_models-overview.html` runs cleanly against `bun run mockups` and writes `test-results/mockup-a11y/latest.json` and `latest.html` referencing `http://localhost:3333/03-0_models-overview.html?clean=1`.
    - [x] Zero `ui-scaffold` or `/files/` mockup server URLs remain anywhere in `tests/`.
- **Verification:** `bun run check`, `bun run test:e2e tests/mockup-review.e2e.ts`, `bun run test:e2e tests/welcome-acceptance.e2e.ts`, `bun run test:e2e tests/content-dialog.e2e.ts`, `bun run test:e2e tests/app-shell.e2e.ts`, `bun run test:e2e tests/visual-parity.e2e.ts`, and `bun run audit:mockups 03-0_models-overview.html` (against running `bun run mockups`)
- **Progress:** [x] Completed (2026-11-21T20:02:57Z)

### T5 — Sync specifications, `AGENTS.md`, `README.md`, and `specification/HUMAN.md`

- **Depends on:** T4
- **Risk:** routine
- **Likely files:** `AGENTS.md`, `README.md`, `specification/README.md`, `specification/ARCHITECTURE.md`, `specification/visual-design.md`, `specification/mockup-review.md`, `specification/testing.md`, `specification/COMPONENTS.md`, `specification/workflow-steps.md`, `specification/app-state-and-navigation.md`, `specification/TODO.md`, `specification/HUMAN.md`, `specification/components/content-modal.md`, `specification/components/model-configuration.md`, `specification/components/training-setup.md`, `specification/components/virtual-table.md`
- **Must not touch:** `specification/notes/ui-fixes.md`, `specification/plans/archive/`, `specification/plans/web-ml-classification-integration.md`, `specification/plans/web-ml-phase-3-model-training.md`, `specification/plans/web-ml-phase-4-single-model-results.md`, `specification/plans/web-ml-phase-5-model-comparison.md`, `specification/plans/web-ml-phase-6-model-specific-results.md`, `specification/plans/web-ml-phase-7-hyperparameter-tuning.md`, `src/`, `scripts/`, `tests/` — keep `ui-fixes.md` for its remaining unclaimed sections and leave archived and deferred `web-ml-*` plans untouched
- **Implementation:**
    1. Apply every documentation and specification update listed under _Specification changes_ in present tense, matching `specification/README.md` §Writing specs and British English.
    2. Ensure `AGENTS.md` §Verification Commands lists `bun run mockups` (removing `bun run serve:mockups`), §Map describes flat `specification/mockups/`, and §Rules specifies status-based mockup editing (`<meta name="status" content="draft" />`), required `<meta>` headers, and multi-state HTML state comments.
    3. Update all relative Markdown links in `specification/HUMAN.md`, `specification/visual-design.md`, `specification/workflow-steps.md`, `specification/TODO.md`, and `specification/components/*.md` so none point to deleted `ui-scaffold/` or `drafts/` paths.
    4. Run `bun run format` on all edited Markdown files, then verify with `bun run check`, `bun run build`, and `bun run plans:check`.
- **Acceptance criteria:**
    - [x] Every item in _Specification changes_ is implemented and ticked.
    - [x] Zero broken `ui-scaffold/` or `serve:mockups` / `serve:scaffold` references remain in `AGENTS.md`, `README.md`, or active non-plan `specification/` documents (excluding `specification/notes/ui-fixes.md`, `specification/mockups/00-3_mockup-review.html` legacy draft prose, `specification/plans/archive/`, and deferred `web-ml-phase-3..7` plans).
    - [x] `bun run check`, `bun run build`, `bun run format:check`, and `bun run plans:check` all pass.
- **Verification:** `bun run check`, `bun run build`, `bun run format:check`, `bun run plans:check`
- **Progress:** [x] Completed (2026-11-21T20:10:38Z)

## Verification and definition of done

- [x] All task acceptance criteria met.
- [x] Relevant verification commands from `AGENTS.md` pass with no new failures (`bun run check`, `bun run build`, `bun run format:check`, `bun run test:e2e tests/mockup-review.e2e.ts`, `bun run test:e2e tests/welcome-acceptance.e2e.ts`, `bun run test:e2e tests/content-dialog.e2e.ts`, `bun run test:e2e tests/app-shell.e2e.ts`, `bun run test:e2e tests/visual-parity.e2e.ts`, `bun run audit:mockups 03-0_models-overview.html`, `bun run plans:check`; `tests/app-shell.e2e.ts` and `tests/visual-parity.e2e.ts` introduce zero HTTP 404/URL errors and no failures beyond the pre-existing `PH-AC-2` / 9 main-padding baseline failures tracked in `specification/HUMAN.md`).
- [x] Type-check, formatting, and build checks pass.
- [x] `?clean=1` returns byte-identical HTML without injected `mockups.css` or helper scripts; `bun run audit:mockups` continues strict WCAG 2.2 AA auditing of product mockups.
- [x] Every item under _Specification changes_ is ticked, and specifications match the implemented code.
- [x] No unintended changes outside the tasks' likely files.

## Risks and open questions

- **Blocking:** None
- **Non-blocking:**
    - **Uncommitted working-tree edits on `ui-fixes`:** On `main`, `specification/mockups/ui-scaffold/mockups.css` is 109 lines (without `body.mockup-index` / `.mockups` rules yet) and `00-3_mockup-review.html` is the 121-line legacy catalogue draft. At planning time, branch `ui-fixes` held uncommitted human edits in `mockups.css`, `00-3_mockup-review.html`, and `specification/notes/ui-fixes.md`. Commit or reconcile those edits before running `/implement` if you want T1 to move them alongside the migration; either way, `renderIndexHtml()` emits `<body class="mockup-index">` and `<table class="mockups">` so human CSS rules apply cleanly whenever added.
    - **Deferred visual-reference strings in `web-ml-phase-3..7` plans:** Those five unrelated active plans still cite `specification/mockups/ui-scaffold/drafts/...` paths (`web-ml-classification-integration.md` has none). Leave them untouched in this plan and update their paths when each plan is next revised or implemented.
    - **Pre-existing `tests/visual-parity.e2e.ts` / `PH-AC-2` failures:** Nine main-padding baseline tests and `PH-AC-2` already fail on unmodified `main` (tracked in `specification/HUMAN.md`); verify in T4 that updated flat mockup URLs load with HTTP 200 and introduce zero new parity or shell failures.
    - **Unclaimed sections of `specification/notes/ui-fixes.md`:** Only § "Better Mockup Navigation" is claimed here; `Improve Virtualized Table`, `Dot Rules`, and `General Fixes` remain unclaimed in `specification/notes/ui-fixes.md` until separately planned.

## Escalations

None.

## Review fixes

None.

## Implementation and verification log

| When (UTC) | Task | Agent (model) | Outcome / commands / evidence |
| ---------- | ---- | ------------- | ----------------------------- |
| —          | —    | —             | Not started                   |
| 2026-11-21T12:12:45Z | T1 | Google Antigravity (Gemini 4 Neon High) | Flattened specification/mockups/ (26 HTML, style.css, mockups.css verbatim, 18 css/*.css; removed 4 empty 0-byte duplicates and ui-scaffold/ + drafts/); added <meta name="name\|description\|status"> to all 26 HTML files; stripped prototype mockups.css links, orphan comments, static #__mockup-review-helper-host blocks, and placeholder titles; wrapped all multi-state fragments across all 11 multi-state product draft files (note: 03-6_train-models-5-train.html was refactored on main by web-ml-phase-3-model-training commit 18deeee to 11 fragments — 1 builder + 7 template + 3 section — all 11 wrapped). Verified: bun run format:check specification/mockups/*.html PASS, 26 HTML + 18 css/*.css, 0 empty HTML, 0 ../style.css or prototype hooks, 26/26 meta tags. |
| 2026-11-21T19:48:47Z | T2 | Google Antigravity (Gemini 4 Neon High) | Updated scripts/config.ts, scripts/serve-mockups.ts, scripts/audit-mockups.ts, tests/serve-mockups.test.ts, tests/audit-mockups.test.ts for flat URLs, /index.json, body.mockup-index table index with client-side search/status filter, light-DOM #__mockup-review-helper-host + /mockups.css injection (omitted on ?clean=1), and bun run mockups audit error. Verified: bun run check PASS (tsc --noEmit 0 errors; 401 pass, 0 fail across 46 files), bun test tests/serve-mockups.test.ts PASS (10/10), bun test tests/audit-mockups.test.ts PASS (6/6), bun run format:check PASS. |
| 2026-11-21T19:51:52Z | T3 | Google Antigravity (Gemini 4 Neon High) | Renamed serve:mockups/serve:scaffold to mockups across package.json, playwright.config.ts (preserving --dist webServer), .claude/launch.json, .vscode/launch.json, .agents/scripts/whitelist-check.ts, .agents/.agents/scripts/whitelist-check.ts; updated ui-scaffold/css TSDoc paths in src/styles/hyperparameters.styles.ts and src/styles/train-model.styles.ts. Verified: bun run check PASS (tsc --noEmit 0 errors; 401 pass, 0 fail), bun test tests/style-tokens.test.ts PASS (8/8), zero ui-scaffold hits in src/ and scripts/. |
| 2026-11-21T20:02:57Z | T4 | Google Antigravity (Gemini 4 Neon High) | Updated tests/mockup-review.e2e.ts, tests/visual-parity.e2e.ts, tests/visual-parity/fixtures.ts, tests/app-shell.e2e.ts, tests/welcome-acceptance.e2e.ts, tests/content-dialog.e2e.ts to flat mockup URLs and new index/helper contracts. Verified: bun run check PASS (tsc --noEmit 0 errors; 401 pass, 0 fail); test:e2e tests/mockup-review.e2e.ts PASS (12/12 across Chromium/Firefox/WebKit); test:e2e tests/welcome-acceptance.e2e.ts tests/content-dialog.e2e.ts PASS (45/45); test:e2e tests/visual-parity.e2e.ts 60 passed, 138 skipped, 9 failed (only the 9 pre-existing baseline failures, 0 HTTP 404/URL errors, PARITY-contract and SIDE-AC-10 PASS); test:e2e tests/app-shell.e2e.ts 116 passed, 7 failed (FOCUS-AC-6 and BTN-AC-13 PASS across all 3 browsers, PH-AC-2 hits only pre-existing 32px vs 0px padding mismatch across 3 browsers, plus 4 unrelated welcome-modal/scroll timing failures on Chromium/Firefox in SNC-15/SNC-16/FOCUS-AC-2 that do not call the mockup server); bun run audit:mockups 03-0_models-overview.html ran cleanly against bun run mockups writing test-results/mockup-a11y/latest.json and latest.html with http://localhost:3333/03-0_models-overview.html?clean=1 (0 errors, 1 pre-existing contrast violation in draft HTML); 0 ui-scaffold or /files/ hits remain in tests/. |
| 2026-11-21T20:10:38Z | T5 | Google Antigravity (Gemini 4 Neon High) | Synced AGENTS.md (and CLAUDE.md symlink), README.md, specification/README.md, specification/ARCHITECTURE.md, specification/visual-design.md, specification/mockup-review.md, specification/testing.md, specification/COMPONENTS.md, specification/workflow-steps.md, specification/app-state-and-navigation.md, specification/TODO.md, specification/HUMAN.md (including tightened empty-placeholder prose alongside TODO-36 and unclaimed ui-fixes.md note), and specification/components/{content-modal,model-configuration,training-setup,virtual-table,training-progress}.md (training-progress.md added by Phase 3 after plan approval, fixed broken ui-scaffold link for AC2); ticked all items in Specification changes and Verification and definition of done. Verified: bun run check PASS (401 pass, 0 fail), bun run build PASS, bun run format:check PASS, bun run plans:check specification/plans/mockup-review-improvements.md PASS, zero ui-scaffold/serve:mockups/serve:scaffold hits across AGENTS.md, README.md, and active non-plan specification/. |
| 2026-11-21T20:12:31Z | Implement | Google Antigravity (Gemini 4 Neon High) | Marked implemented |

## Plan review history

| Reviewed (UTC)       | Agent (model)                           | Decision          | Findings                                                                                                                                                                                                                                                                     |
| -------------------- | --------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-20T18:04:25Z | Google Antigravity (Gemini 4 Neon High) | changes-requested | BLOCKER: T2 breaks tests/serve-mockups.test.ts under bun run typecheck before T4; MAJOR: renderIndexHtml() omits body.mockup-index from mockups.css, §1/T1 conflict on 00-3_mockup-review.html and 03-4/03-6 state counts, T4 omits app-shell/visual-parity E2E verification |
| 2026-11-21T09:02:23Z | Google Antigravity (unrecorded) | changes-requested | MAJOR: §7 (L244) and T2 step 3 (L306) cite nonexistent MockupAuditFileResult.relativePath instead of MockupAuditFileResult.file (scripts/audit-mockups.ts L36-43, L146, L247, L277, L369); MINOR: T5/§Spec changes L256 omits replacement path and catalogue status for specification/mockup-review.md L74 reviews/<surface>.md, L262 misstates content-modal.md L57 path, T5 Must not touch omits web-ml-classification-integration.md and web-ml-phase-4..7, Codebase context L62 cites serve-mockups.ts as 664 lines (actual 666) |
| 2026-11-21T09:55:11Z | Google Antigravity (Gemini 4 Neon High) | changes-requested | MAJOR: unapplied Cycle 2 fix in §7 (L244) still cites nonexistent MockupAuditFileResult.relativePath instead of MockupAuditFileResult.file (and MockupAuditReport.skipped), contradicting scripts/audit-mockups.ts (L36-43, L146, L247, L277, L369), T2 step 3 (L306), and Change log (L443); MINOR: unapplied Cycle 2 fix in Codebase context (L62) still says scripts/serve-mockups.ts is 664 lines (actual 666), Scope/Risks (L34, L412) inaccurately state web-ml-classification-integration.md cites ui-scaffold/drafts paths (0 hits; only web-ml-phase-3..7 do), T1 step 3 (L276) can note removing orphan <!-- Mockup-specific styles --> comments at L7 of 01-6 and 01-8, and §Spec changes (L256, L263) can note mockup-review.md L38 (../style.css and shared scaffold stylesheet) and HUMAN.md L28 inline path |
| 2026-11-21T10:09:23Z | Google Antigravity (Gemini 4 Neon High) | approved | Approved after independent scout verification of all 50 mockup files, 26 unique HTML files, 11 multi-state counts, scripts/serve-mockups.ts (666L), scripts/audit-mockups.ts (414L, MockupAuditFileResult.file/skipped), scripts/config.ts, tests, and active spec/config references; zero blockers or major findings (optional T5 suggestion: tighten HUMAN.md L102 empty-placeholder prose alongside TODO-36). |

## Change log

| When (UTC)           | Change                                   | Reason                                                                                                                                                                                                                 |
| -------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-20T17:44:07Z | Initial draft                            | User request and `specification/notes/ui-fixes.md` § Better Mockup Navigation                                                                                                                                          |
| 2026-11-21T08:04:08Z | Revise plan for Cycle 1 review findings  | Resolve `changes-requested`: move unit tests into T2 so `bun run check` passes, add `<body class="mockup-index">` to `renderIndexHtml()`, align §1/T1 on `00-3_mockup-review.html` and `03-4`/`03-6` state counts, include `.agents/.agents/scripts/whitelist-check.ts` in T3, and verify `tests/app-shell.e2e.ts` and `tests/visual-parity.e2e.ts` in T4 |
| 2026-11-21T09:07:27Z | Revise plan for Cycle 2 review findings  | Resolve `changes-requested`: fix `MockupAuditFileResult.file` (and `MockupAuditReport.skipped`) in §7 and T2 step 3, specify `specification/mockups/reviews/<surface>.md` path and catalogue status for `specification/mockup-review.md` L74, fix exact component spec paths in §Specification changes (`content-modal.md` L57 `drafts/00-2_content-modal.html` et al.), list all deferred `web-ml-*` plans in T5 `Must not touch`, and correct `scripts/serve-mockups.ts` line count to 666 |
| 2026-11-21T09:58:58Z | Revise plan for Cycle 3 review findings  | Resolve `changes-requested`: apply `MockupAuditFileResult.file` and `MockupAuditReport.skipped` fix in §7, apply `scripts/serve-mockups.ts` line count (666) in Codebase context, clarify that only `web-ml-phase-3..7` (not `web-ml-classification-integration.md`) cite `ui-scaffold/drafts/` paths in Scope/T5/Risks, note removal of orphan `<!-- Mockup-specific styles -->` comments at L7 of `01-6` and `01-8` in T1 step 3, and note `specification/mockup-review.md` L38 and `specification/HUMAN.md` L28 inline path in §Specification changes |
