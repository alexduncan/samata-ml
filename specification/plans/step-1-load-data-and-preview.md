# Step 1: Load Data & Dataset Preview

**Status:** draft | **Updated:** 2026-11-13T10:05:02Z

## Goal

**Current behaviour:** `/data` renders a static placeholder in `src/app.ts` (`renderWorkflowView`). The app has no dataset selection cards, datasheet modal, local CSV upload dialog, dataset preview or column details panel. `src/config/datasets.ts` is an unused malformed array slated for deletion by `specification/plans/data-ingestion-and-storage.md` (T8). Shared style modules exist in `src/styles/` (`button.styles.ts`, `card.styles.ts`, `chiclet.styles.ts`, `dialog.styles.ts`), while `src/i18n.ts` (`COMPONENTS.md` §8) and `src/components/` custom elements do not exist yet. Related prerequisites remain `draft` in `data-ingestion-and-storage.md`, `state-navigation-conformance.md` and `virtual-table-component.md`.

**Target behaviour:** `/data` lets a learner choose a bundled sample dataset from the generated manifest or upload a local `.csv` file, inspect a sample's datasheet, view a virtualised row preview with a selected-column details `<aside>`, and return to dataset selection according to the approved state contract. Row storage, parsing, profiling and statistics remain in the worker/storage layer; UI components consume `SampleDatasetManifest`, `SampleDatasetDescriptor`, `DatasetMetadata` and bounded `fetchRows` windows through declared component and store boundaries.

**Why:** Step 1 makes a verified, profiled dataset available for target selection and model training while letting learners inspect the data before proceeding.

## Scope

**In scope**

- Replace the `/data` placeholder in `src/app.ts` with dynamically imported Step 1 views (`app-data-view` and child components).
- Render sample datasets from `loadSampleCatalogue()` (`src/features/data/sample-datasets.ts`) using `<app-dataset-card>` and show sample datasheets via `loadSampleDescriptor(id)` and its compiled `files.datasheet` HTML.
- Provide a native local CSV upload dialog (file input + keyboard-accessible drop target) invoking `loadDataset({ kind: 'file', file }, { signal, onProgress })`, mapping `IngestionProgress` and `IngestionError` codes to component i18n copy.
- Compose `<ui-virtual-table>` with a bounded row-window loader and render a selected-column details `<aside>` from `DatasetMetadata.columns`, including `datetime` UTC display.
- Wire `whenSettled()`, `ScrollSnapshot.regions['data-table']`, dataset-change discard confirmation when `models.length > 0` (`app-state-and-navigation.md` §6.4), preview exit action (pending TODO-13), and the Step 1 sidebar summary.
- Add real-browser Playwright acceptance, accessibility, token and visual-parity tests.

**Out of scope**

- Implementing CSV parsing, type inference, statistics, histograms, IndexedDB or the storage worker; those belong to `data-ingestion-and-storage.md`.
- Designing or implementing `<ui-virtual-table>`; that belongs to `virtual-table-component.md`.
- Fixing pre-existing shell/sidebar visual drift (`KNOWN_DRIFT` files); that belongs to `scaffolding-visual-remediation` (Known gap 13).
- Remote URL dataset loading (removed by `state-and-storage.md` §10 #7; mockup `01-3` URL field excluded per TODO-37).
- Editing `specification/mockups/**` or building Storybook stories (Storybook is not installed; `COMPONENTS.md` §10).

**Constraints and invariants**

- Route stays `/data`; `data.mode` (`'select' | 'preview'`) and `data.selectedColumn` live in `$appState` via store actions (`setDataMode`, `setSelectedColumn`, `loadDatasetSucceeded`). No component may import `idb`, open workers, read IndexedDB directly, or call `localStorage` (`COMPONENTS.md` §5).
- `app-data-view` exposes `whenSettled(): Promise<void>` (`COMPONENTS.md` §5, `app-state-and-navigation.md` §5.5) so `restoreScroll` waits until layout height (catalogue or dataset metadata + table rail) is stable.
- `datetime` column values are epoch milliseconds in UTC and MUST be displayed with `timeZone: 'UTC'` (`data-ingestion-and-storage.md` Web guidance).
- All CSS uses tokens from `css/root.css` with no fallbacks and no literal colours (`visual-design.md` §2), logical properties (`COMPONENTS.md` §6.3), and `@media (prefers-reduced-motion: no-preference)` around transitions/animations.
- Every visible string, `aria-label`, `title` and `alt` uses `@nanostores/i18n` (`src/i18n.ts`, `COMPONENTS.md` §8); numbers and counts use the shared i18n formatter.
- Accessibility: WCAG 2.2 AA, native `<dialog>` via `showModal()`, keyboard operation, 320 CSS px, 200% zoom, `dir="rtl"`, forced colours, and no information conveyed by colour alone.

## Required reading

The implementer reads only these, plus each task's likely files. Everything else is optional.

- `specification/workflow-steps.md` §1 — authoritative user-facing Step 1 behaviour and copy.
- `specification/app-state-and-navigation.md` §4.3, §5.4–§5.6, §6.1, §6.4, §8.3–§8.4 — modal, focus, `/data` mode, discard confirmation, `whenSettled()` and `data-table` scroll-region contracts (read alongside `specification/plans/state-navigation-conformance.md`).
- `specification/state-and-storage.md` §2–§5, §10 — `DatasetSummary`, `data.mode`, `data.selectedColumn`, `ScrollSnapshot.regions` and UI state persistence rules.
- `specification/plans/data-ingestion-and-storage.md` _Interfaces and behaviour_ and D1, D3, D8, D10–D12 — `SampleDatasetManifest`, `SampleDatasetDescriptor`, `DatasetMetadata`, `ColumnStats`, `loadSampleCatalogue()`, `loadSampleDescriptor()`, `loadDataset()`, `getStorageClient()`, `IngestionProgress` and `IngestionError` codes.
- `specification/preview-dataset.md` — preview layout and row-window goals (obsolete `Pipeline.state` / `dataset_stats` sections superseded per TODO-48).
- `specification/components/card.md` §§1–§11 — `<app-dataset-card>` closed API, `cardStyles`, a11y (`aria-describedby`), i18n and acceptance criteria.
- `specification/components/virtual-table.md` — consume only after `virtual-table-component.md` updates and resolves it.
- `specification/components/sidepanel.md` — currently a stub; do not implement `app-column-details` until specified.
- `specification/COMPONENTS.md` §§1–§9 — Lit 3 standard decorators (`accessor` required), closed public APIs, single-file controllers, `StoreController`, i18n and Playwright test rules.
- `specification/visual-design.md` §§1–§6 — tokens, shared style adoption, translation rules, A11Y/SEM deviation registers and parity checks.
- `specification/standards-and-documentation.md` — TSDoc requirements for exported TypeScript.
- `specification/mockups/ui-scaffold/01-1_select-data.html` — CSS: `specification/mockups/ui-scaffold/css/base.css`, `card.css`, `button.css`; selectors: `header.page-header`, `header.page-header > h1`, `header.page-header > p`, `header.page-header > button.btn-primary`, `section.cards`, `.card`, `.card-title`, `.card-text`, `.card-stats`, `.card-actions`, `.btn`.
- `specification/mockups/ui-scaffold/01-2_dataset-card.html` — CSS: `specification/mockups/ui-scaffold/css/modal.css`, `card.css`; selectors: `dialog.modal`, `.modal-header`, `.modal-header > span`, `.modal-header > h1`, `.modal-header > button`, `.modal-content`, `.card-stats`, `.stat`.
- `specification/mockups/ui-scaffold/01-3_upload-dataset.html` — CSS: `specification/mockups/ui-scaffold/css/modal.css`, `dropzone.css`, `base.css`; selectors: `dialog.modal`, `.modal-header`, `.dropzone`, `.file-picker`, `.file-picker-button`, `input[type="file"]` (exclude the obsolete URL `<input>` per TODO-37).
- `specification/mockups/ui-scaffold/01-4_preview-dataset.html` — CSS: `specification/mockups/ui-scaffold/css/base.css`, `table.css`, `button.css`, `steps.css`, `badges.css`; selectors: `header.page-header`, `header.page-header > h1`, `header.page-header > p`, `.btn-red`, `.step-chiclets` (table markup is only `{Virtual Table Component}` placeholder).
- `css/root.css` — canonical closed token vocabulary.

## Codebase context

- **Relevant implementation:**
    - `src/app.ts` renders `/data` synchronously in `renderWorkflowView()` and runs `renderAppShell()` on `$route`. Currently in `tests/style-tokens.test.ts` `KNOWN_DRIFT`.
    - `src/stores/app.store.ts` exports `loadDatasetSucceeded`, `setDataMode`, `setSelectedColumn`, `confirmDiscardModels`.
    - `src/types/state.ts` defines `PersistedAppState.data` (`mode`, `selectedColumn`), `DatasetSummary`, `ScrollSnapshot.regions`.
    - `src/styles/card.styles.ts` and `src/styles/dialog.styles.ts` already exist (`cardStyles` is shadow-root only and excludes `.cards` grid; `dialogStyles` styles `dialog` and `dialog::backdrop` only and omits `.modal-header`). `src/styles/global.ts` adopts `buttonStyles`, `chicletStyles`, `dialogStyles`.
    - `src/features/navigation/app-sidebar.ts` already renders a `.step-summary` block for `state.dataset` (currently in `KNOWN_DRIFT`).
    - `src/i18n.ts` does **not** exist yet (`COMPONENTS.md` §3, §8).
- **Tests and commands:**
    - Baseline verified 2026-11-13: `bun run check` passes (0 type errors, 52 tests across 6 files); `bun run plans:check` passes on this plan; `bun run test:e2e --list` discovers 54 tests across `a11y.e2e.ts`, `app-shell.test.ts` and `visual-parity.e2e.ts`.
    - `tests/style-tokens.test.ts` (`TOK-1`–`TOK-4`) fails any new `.ts` file using unknown tokens, literal colours (even inside `var()` fallbacks), or `<style>` in `html` templates.
    - `tests/visual-parity.e2e.ts` currently navigates directly to `entry.appRoute` with fresh state and asserts immediately; it has no mechanism to open a modal (`01-2`, `01-3`) or hydrate preview mode (`01-4`).
    - `tests/a11y.e2e.ts` currently scans only initial `/data` (welcome modal open/dismissed).
- **Web guidance:** `capture-location-agnostic-data` (verified via `data-ingestion-and-storage.md`): format UTC epoch-ms dates with `timeZone: 'UTC'` to prevent local timezone off-by-one-day shifts. **Unverified in this session:** running `bunx modern-web-guidance` for `dialog`, `forms`, `responsive-table` and dropzone failed offline inside the sandbox (`DNSResolveFailed`); retrieve those guides before marking this plan `ready`.
- **Visual reference:**
    - `01-1_select-data.html`: `base.css`, `card.css`, `button.css` (`header.page-header*`, `section.cards`, `.card*`, `.btn`); deviations: `A11Y-01` (`.btn` text `--stone-700`), `A11Y-05` (`.card-text` `--stone-900`), `A11Y-10` (focus outline).
    - `01-2_dataset-card.html`: `modal.css`, `card.css` (`dialog.modal`, `.modal-header*`, `.modal-content`, `.card-stats`, `.stat`); deviations: `SEM-04` (`aria-labelledby` + `<h2>` heading), `SEM-08` (close icon button `aria-label` + `aria-hidden="true"` SVG), `dialogStyles` token `--surface` (`visual-design.md` §2).
    - `01-3_upload-dataset.html`: `modal.css`, `dropzone.css`, `base.css` (`dialog.modal`, `.modal-header`, `.dropzone`, `.file-picker*`, `input[type="file"]`); deviations: `A11Y-03` (`.file-picker-button` text `--stone-700`), `A11Y-08` (focus ring `--focus-ring`), `SEM-04`, `SEM-05`, `SEM-08`, URL input removed (TODO-37).
    - `01-4_preview-dataset.html`: `base.css`, `table.css`, `button.css` (`header.page-header*`, `.btn-red`, `.table`); deviations: `.btn-red` triggers unresolved `TODO-28`; mockup has placeholder title `"Pen"` and no column inspector `<aside>` (TODO-39).
    - Note: Only `01-4_preview-dataset.html` was visually opened on the scaffold server; `01-1`–`01-3` and CSS files were inspected in source.
- **Lit skills:** implementers use `lit-implementer` for T1–T4.
- **Known gaps decided:**
    - **Gap 13:** New Step 1 files must not be added to `KNOWN_DRIFT` and must obey `css/root.css` tokens and A11Y/SEM registers; `app-sidebar.ts` and `src/app.ts` shell styles remain governed by `scaffolding-visual-remediation`.
    - **Gap 14:** Follow `state-navigation-conformance.md` for `$appState`, `reconcileStartupState` (with v2 IndexedDB adapter from `data-ingestion-and-storage.md` T10) and `scroll-restorer.ts`.
    - **Gap 17:** Place Playwright acceptance suites in `tests/data-*.e2e.ts` to match `playwright.config.ts` (`/.*(\.e2e|app-shell\.test)\.ts/`), not co-located `src/components/*.test.ts`.
- **Assumptions requiring verification:**
    - `data-ingestion-and-storage.md` (`draft`), `state-navigation-conformance.md` (`draft`) and `virtual-table-component.md` (`draft`) ship their exported contracts unchanged before Step 1 tasks start.
    - `src/i18n.ts` (`@nanostores/i18n`, `COMPONENTS.md` §8) is provided by a prerequisite i18n setup or T0 before `app-dataset-card` and Step 1 views can be built.
    - Playwright browser binaries (Chromium, Firefox, WebKit) are installed on the implementation machine (only `--list` was verified).

## Technical decisions

| Decision                                     | Chosen approach and rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Rejected alternative / trade-off                                                                                                               |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Sample catalogue source                      | Consume `loadSampleCatalogue()` (`SampleDatasetManifest`) and `loadSampleDescriptor(id)` (`SampleDatasetDescriptor`) from `src/features/data/sample-datasets.ts` (`data-ingestion-and-storage.md` D10). Pass `summary.tagline` to `<app-dataset-card .description>`.                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Reading `src/config/datasets.ts` (deleted in `data-ingestion-and-storage.md` T8) or duplicating metadata in `src/`.                            |
| Card selection identity (`card.md` conflict) | **Blocking:** `card.md` §3 and §11 forbid an `id` property on `<app-dataset-card>` and emit only `{ name: string }`, while `COMPONENTS.md` §4 forbids arrow-function wrappers in `@event` listeners (`@event=${() => ...}`). Decide whether to extend `card.md` with `sampleId?: string` (or `datasetId`) or pass `data-sample-id` on the host for `e.currentTarget` lookup.                                                                                                                                                                                                                                                                                                                                            | Inferring ID from display `name` (fragile and banned by invariants) or violating `COMPONENTS.md` §4 with inline arrow wrappers.                |
| Component tiers & file layout                | One element per file (`COMPONENTS.md` §4): `src/components/app-dataset-card.ts` (Tier 2 presentational, per `card.md`), `src/features/data/app-data-view.ts` (Tier 3 connected route view), `src/features/data/app-datasheet-dialog.ts` (Tier 2 presentational), `src/features/data/app-upload-dataset-dialog.ts` (Tier 2 presentational), `src/features/data/app-dataset-preview.ts` (Tier 2 presentational), `src/features/data/app-column-details.ts` (Tier 2 presentational). Row-window fetching lives inside `app-data-view.ts` (or a private controller inside `app-dataset-preview.ts` if Tier 3) — **no** separate `row-window-controller.ts` file (`COMPONENTS.md` §3 forbids single-use shared controllers). | Splitting a standalone `row-window-controller.ts` before 3 spec'd call sites exist (`COMPONENTS.md` §3).                                       |
| Styles & CSS module placement                | Reuse `buttonStyles`, `cardStyles` (`app-dataset-card` only) and `dialogStyles`. Put `.cards` grid and preview layout in `app-data-view.ts` `static styles`; put `.dropzone` and `.file-picker` (from `base.css` + `dropzone.css`, with `A11Y-03`/`A11Y-08`) in `app-upload-dataset-dialog.ts` `static styles` (or a shared module only if `TODO-35` defines one). Do not duplicate `dialogStyles`'s `rgb(30 25 22 / 55%)` backdrop outside `dialog.styles.ts` (`TOK-2` guard).                                                                                                                                                                                                                                         | Importing `src/styles/card.styles.ts` into `app-data-view` (it lacks `.cards`) or creating unspec'd shared style modules (`COMPONENTS.md` §3). |
| Dataset-change guard & exit action           | Guard sample selection and file upload with `app-state-and-navigation.md` §6.4 confirmation when `$appState.get().models.length > 0` (pending TODO-17), before calling `loadDataset()` (which calls `loadDatasetSucceeded`). Preview exit action (Change Dataset vs Delete Dataset) is **blocking** pending TODO-13 and TODO-28 (`.btn-red`).                                                                                                                                                                                                                                                                                                                                                                           | Silently discarding trained models or inventing a dataset deletion button not approved in `button.md` / `TODO-13`.                             |
| Upload validation, progress & errors         | Drop remote URL input (TODO-37). Map `loadDataset` `IngestionProgress` (`download`, `parse`, `typing`, `statistics`) and `IngestionError.code` (`FILE_TOO_LARGE`, `TOO_MANY_COLUMNS`, `INSUFFICIENT_STORAGE`, `EMPTY_FILE`, `NO_DATA_ROWS`, `READ_FAILED`, `STORAGE_FAILED`, `CANCELLED`, `BUSY`, etc.) from `data-ingestion-and-storage.md` D11–D12 to i18n UI strings. **Blocking:** exact copy, cancellation UI and malformed/skipped/invalid-cell notice rules (UI part of TODO-09).                                                                                                                                                                                                                                | Re-implementing CSV size/parsing checks in the UI or displaying raw worker developer messages.                                                 |
| Column details panel (`<aside>`)             | Consumes `ColumnStats` (`numeric`, `categorical`, `boolean`, `datetime`, `text`) from `DatasetMetadata`, formatting `datetime` values with `timeZone: 'UTC'`. **Blocking:** `specification/components/sidepanel.md` is a stub and TODO-10 leaves histogram rendering, high-cardinality categories and text-column summaries undecided.                                                                                                                                                                                                                                                                                                                                                                                  | Inventing chart libraries, truncation limits or sidepanel APIs during implementation.                                                          |
| i18n foundation                              | **Blocking:** `src/i18n.ts` (`@nanostores/i18n`, `COMPONENTS.md` §8) does not exist yet and `card.md` §10 lists it as an unmet dependency. Decide whether a dedicated i18n setup plan/task (`T0`) creates `src/i18n.ts` first.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Hard-coding English literals in components (`COMPONENTS.md` §8 violation).                                                                     |
| Parity & a11y test harness                   | Extend `tests/visual-parity.e2e.ts` (e.g. optional setup hook on `ParityEntry` to open a dialog or seed preview state) and `tests/a11y.e2e.ts` so `01-2`, `01-3` and `01-4` are genuinely audited rather than only initial `/data`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Leaving `tests/visual-parity.e2e.ts` unable to reach modals or preview state while claiming parity passes.                                     |

### Interfaces and behaviour

**State placement (`COMPONENTS.md` §5, `state-and-storage.md` §5):**

- **Persisted (`$appState`):** `dataset` (`DatasetSummary | null`), `data.mode` (`'select' | 'preview'`), `data.selectedColumn` (`string | null`), `models` (checked for discard confirmation before dataset replacement). Mutated only by `loadDatasetSucceeded`, `setDataMode`, `setSelectedColumn`, `confirmDiscardModels`.
- **Persisted (`$scrollState`):** window scroll keys `data:select` and `data:preview`, plus `ScrollSnapshot.regions['data-table']` (`{ top, left }`) on preview (`state-and-storage.md` §5, `NAV-E2E-7`).
- **IndexedDB (via `getStorageClient()`, never imported by presentational components):** `getMetadata(datasetId)` → `DatasetMetadata | null`; `fetchRows(datasetId, offset, limit)` → `RawRecord[]`.
- **Transient component `@state` (`app-data-view`, never persisted per `app-state-and-navigation.md` §9.4):** loaded `SampleDatasetSummary[]` catalogue state, open Datasheet dialog + loaded `SampleDatasetDescriptor` / datasheet HTML fragment, open Upload dialog, active `AbortController`, `IngestionProgress | null`, `IngestionError | null`, pending discard-confirmation state.

**Component boundaries and public API contracts (provisional until blocking specs close):**

- **`<app-dataset-card>` (`src/components/app-dataset-card.ts`, Tier 2):** closed API defined in `specification/components/card.md` §3 (`name`, `description`, `columns`, `rows`; events `app-dataset-datasheet-open`, `app-dataset-select` with `CustomEvent<{ name: string }>`, `bubbles: false`, `composed: false`; pending resolution of the `sampleId` vs `name` decision above and `card.md` Q4–Q12).
- **`<app-data-view>` (`src/features/data/app-data-view.ts`, Tier 3 connected):**
    - Properties / methods: `whenSettled(): Promise<void>` (public method required by `app-state-and-navigation.md` §5.5 and `scroll-restorer.ts`; resolves once catalogue fetch or `getMetadata` + table height initialisation settles).
    - Events / slots / parts / CSS custom properties: None (route root view).
    - Owns strings (`i18n('app-data-view', ...)`): page titles, descriptions, Upload Dataset button, loading/error alerts, discard confirmation copy (pending human sign-off).
- **`<app-datasheet-dialog>` (`src/features/data/app-datasheet-dialog.ts`, Tier 2 presentational):**
    - Exact properties (`open`, `descriptor`, `datasheetHtml` or `datasheetUrl` — note `COMPONENTS.md` §4 forbids `unsafeHTML`, so rendering compiled `datasheet.html` requires a safe DOM/sanitisation decision!), events (`app-datasheet-dialog-close`, `bubbles: false`, `composed: false`), slots and strings remain **blocking** on `TODO-12` and `TODO-34`.
    - Uses native `<dialog>` via `showModal()`, `aria-labelledby` pointing at its `<h2>` (`SEM-04`), visible close button (`SEM-08`), and returns focus to invoker on close.
- **`<app-upload-dataset-dialog>` (`src/features/data/app-upload-dataset-dialog.ts`, Tier 2 presentational):**
    - Exact properties (`open`, `progress`, `error`, `busy`), events (`app-upload-file-select` `{ file: File }`, `app-upload-cancel` `{}`, `app-upload-close` `{}`; `bubbles: false`, `composed: false`) and strings remain **blocking** on `TODO-09` (UI copy/progress/warnings) and `TODO-34`/`TODO-35`.
    - Native `<input type="file" accept=".csv,text/csv">` with visible `<label>` (`SEM-05`), keyboard-operable drop target, no URL `<input>` (`TODO-37`), single in-flight run (`BUSY` prevention).
- **`<app-dataset-preview>` (`src/features/data/app-dataset-preview.ts`, Tier 2 presentational) & `<app-column-details>` (`src/features/data/app-column-details.ts`, Tier 2 presentational):**
    - Public APIs, `ui-virtual-table` property/event bindings, exit button (`Change Dataset` / `Delete Dataset`) and column-inspector contract remain **blocking** on `virtual-table-component.md`, `TODO-10`, `TODO-13`, `TODO-28` and `specification/components/sidepanel.md`.

## Specification changes

What `specification/` must say once this plan is implemented. The final task applies these items and ticks each one; `task_gate.py --check-complete` refuses to close the plan while any is unticked.

- [ ] `specification/workflow-steps.md` §1 — specify implemented sample cards (mapped from `SampleDatasetManifest`), datasheet dialog, local CSV upload limits/progress/errors, preview, exit action and column inspector; update status for Step 1 (`partial` → `implemented` only for delivered scope).
- [ ] `specification/app-state-and-navigation.md` §6.1, §12 — record the approved preview exit action (TODO-13) and dataset-change confirmation behaviour; keep status governed by `state-navigation-conformance.md`.
- [ ] `specification/state-and-storage.md` §5, §6 — record `data-table` scroll-region persistence and UI integration with `loadDataset`/`getMetadata`/`fetchRows`.
- [ ] `specification/preview-dataset.md` — replace obsolete `Pipeline.state`, `SelectDataView`, `dataset_stats`, `integer`/`float` and storage claims with the implemented stores, `getStorageClient()` window loader and `<ui-virtual-table>` consumer contract (TODO-48, Known gap 16).
- [ ] `specification/components/card.md` §§1–§12 — record answered Q4–Q12, any `sampleId` amendment, test path alignment (Known gap 17), and update status honestly for `app-dataset-card`.
- [ ] `specification/components/sidepanel.md` — replace stub with the approved column-details panel specification and status `implemented` once built.
- [ ] `specification/visual-design.md` §3, §5 — record where `dropzone.css` / upload / preview / datasheet styles live and any approved register entries applied (`A11Y-01`, `A11Y-03`, `A11Y-08`, `A11Y-10`, `SEM-04`, `SEM-05`, `SEM-08`, and `TODO-28` decision).
- [ ] `specification/README.md` Known gaps 16 & 17 — mark Known gap 16 resolved (`preview-dataset.md`) and reconcile Known gap 17 for Step 1 Playwright paths.
- [ ] `specification/TODO.md` — remove or narrow TODO-09 (UI parts), TODO-10, TODO-12 (UI layout), TODO-13, TODO-28, TODO-29, TODO-30, TODO-34 (datasheet/upload dialogs), TODO-35 (dropzone/modal), TODO-37, TODO-39 and TODO-48 where settled and shipped.

## Implementation tasks

### T1 — Sample catalogue view, `<app-dataset-card>` and datasheet dialog

- **Depends on:** `data-ingestion-and-storage.md` implemented (`sample-datasets.ts`, `loadDataset`); `src/i18n.ts` available; human answers to TODO-12 (datasheet layout/sanitisation), TODO-29, TODO-30 and the `sampleId` card-selection decision.
- **Risk:** needs care — `card.md` has open questions (Q4–Q12), `src/i18n.ts` does not exist yet, and compiled `datasheet.html` must be rendered without `unsafeHTML` (`COMPONENTS.md` §4).
- **Likely files:** `src/app.ts` (dynamic `/data` import), `src/components/app-dataset-card.ts`, `src/features/data/app-data-view.ts`, `src/features/data/app-datasheet-dialog.ts`, `tests/data-selection.e2e.ts`, `tests/visual-parity/map.ts`, `tests/visual-parity.e2e.ts`, `tests/a11y.e2e.ts`.
- **Must not touch:** `src/features/data/ingestion/**`, `src/common/storage/**`, `src/styles/card.styles.ts` (already matches `card.md` §5.4), `specification/mockups/**`.
- **Implementation:** Dynamically import `app-data-view` on `/data`, implement `whenSettled()`, load sample summaries via `loadSampleCatalogue()`, render `<app-dataset-card>` items inside `<ul class="cards"><li>` under `<h2>` (`card.md` §4), route card datasheet/select intents using stable `sample.id` (never inferred from `name`), open `<app-datasheet-dialog>` with `showModal()`, `aria-labelledby` (`SEM-04`) and focus restoration, and invoke `loadDataset({ kind: 'sample', sampleId })` (with §6.4 discard confirmation if `models.length > 0`). Update `visual-parity.e2e.ts` and `a11y.e2e.ts` to cover `01-1` and `01-2`.
- **Acceptance criteria:**
    - [ ] `DATA-SEL-AC-1` — `/data` selection mode shows all `SampleDatasetManifest.datasets` items with `name`, `tagline` and compact-formatted counts via `app-dataset-card`; `src/config/datasets.ts` is not used.
    - [ ] `DATA-SEL-AC-2` — activating a card's Datasheet button opens `<app-datasheet-dialog>` with approved descriptor fields and datasheet content; closing via button or `Esc` restores focus to the invoker.
    - [ ] `DATA-SEL-AC-3` — selecting a sample invokes `loadDataset({ kind: 'sample', sampleId })` once with the stable `id`, handles loading/error states, and asks confirmation before discarding existing models if `models.length > 0`.
    - [ ] `DATA-SEL-AC-4` — `CARD-AC-*` for `app-dataset-card`, `01-1`/`01-2` visual parity, `style-tokens.test.ts` and axe WCAG 2.2 AA scans pass at 1440×900, 320px, 200% zoom and `dir="rtl"`.
- **Verification:** `bun run check`; `bun run test:e2e tests/data-selection.e2e.ts tests/visual-parity.e2e.ts tests/a11y.e2e.ts`; `bun run format <changed-files>`.
- **Progress:** [ ] Not started

### T2 — Local CSV upload dialog

- **Depends on:** `data-ingestion-and-storage.md` implemented (`loadDataset`, `IngestionProgress`, `IngestionError`); `src/i18n.ts` available; answers to TODO-09 (UI copy/progress/skipped-row notices) and TODO-34/TODO-35 (dialog & dropzone specs).
- **Risk:** needs care — drag/drop vs keyboard file input parity, cancellation via `AbortController`, and `A11Y-03`/`A11Y-08`/`SEM-05` compliance.
- **Likely files:** `src/features/data/app-upload-dataset-dialog.ts`, `src/features/data/app-data-view.ts`, `tests/data-upload.e2e.ts`, `tests/visual-parity/map.ts`, `tests/visual-parity.e2e.ts`, `tests/a11y.e2e.ts`.
- **Must not touch:** `src/features/data/ingestion/**`, `src/common/storage/**`, `specification/mockups/**`.
- **Implementation:** Implement `<app-upload-dataset-dialog>` using native `<dialog>` (`showModal()`, `SEM-04`), `dialogStyles`, `buttonStyles`, and dropzone/file-picker styles (`A11Y-03`, `A11Y-08`, `SEM-05`, no literal colours). Exclude the obsolete URL input (TODO-37). Support native `<input type="file" accept=".csv,text/csv">` and drag/drop through one validation/submission path to `loadDataset({ kind: 'file', file }, { signal, onProgress })` (checking §6.4 discard confirmation if `models.length > 0`), render `IngestionProgress` and mapped `IngestionError` messages, and prevent concurrent ingestion (`BUSY`).
- **Acceptance criteria:**
    - [ ] `DATA-UP-AC-1` — opening Upload Dataset, selecting a `.csv` file via the labelled file input, and starting ingestion displays phase progress and commits preview on success.
    - [ ] `DATA-UP-AC-2` — drag/drop and file-picker selection share one path; non-CSV or rejected files (`FILE_TOO_LARGE`, `EMPTY_FILE`, `NO_DATA_ROWS`, `TOO_MANY_COLUMNS`, etc.) surface mapped i18n errors without changing `$appState.dataset`.
    - [ ] `DATA-UP-AC-3` — cancelling an in-flight upload aborts cleanly (`CANCELLED`) and leaves prior state/dataset intact; duplicate concurrent starts are blocked.
    - [ ] `DATA-UP-AC-4` — `Esc`/close focus return, keyboard dropzone activation, 320px/200% zoom/RTL, `style-tokens.test.ts`, axe WCAG 2.2 AA and `01-3` parity pass.
- **Verification:** `bun run check`; `bun run test:e2e tests/data-upload.e2e.ts tests/visual-parity.e2e.ts tests/a11y.e2e.ts`; `bun run format <changed-files>`.
- **Progress:** [ ] Not started

### T3 — Dataset preview, row-window loading and column details `<aside>`

- **Depends on:** `virtual-table-component.md` implemented (`ui-virtual-table`); `data-ingestion-and-storage.md` implemented (`getStorageClient`, `DatasetMetadata`); `specification/components/sidepanel.md` specified; answers to TODO-10, TODO-13, TODO-28 and TODO-39.
- **Risk:** needs care — bounded memory window cache, `datetime` UTC display, table/region scroll restoration (`data-table`), and sidepanel accessibility.
- **Likely files:** `src/features/data/app-dataset-preview.ts`, `src/features/data/app-column-details.ts`, `src/features/data/app-data-view.ts`, `tests/data-preview.e2e.ts`, `tests/visual-parity/map.ts`, `tests/visual-parity.e2e.ts`, `tests/a11y.e2e.ts`.
- **Must not touch:** `src/components/ui-virtual-table.ts` (owned by `virtual-table-component.md`), `src/features/data/ingestion/**`, `specification/mockups/**`, or a separate `row-window-controller.ts` file (`COMPONENTS.md` §3).
- **Implementation:** Load `DatasetMetadata` via `getStorageClient().getMetadata(datasetId)` in `app-data-view`, resolve `whenSettled()`, and feed `<ui-virtual-table>` via bounded `fetchRows(datasetId, offset, limit)` slices. Render `datetime` cells and bounds with `timeZone: 'UTC'`. Wire column selection to `setSelectedColumn(name | null)` and render `<app-column-details>` for `NumericColumnStats`, `CategoricalColumnStats`, `BooleanColumnStats`, `DatetimeColumnStats` and `TextColumnStats` per the approved `sidepanel.md` spec. Implement the approved preview exit action (TODO-13 / TODO-28).
- **Acceptance criteria:**
    - [ ] `DATA-PRE-AC-1` — preview shows dataset name, row/column counts, and rows fetched via `fetchRows` windows without holding the full dataset in component memory; `datetime` values format in UTC.
    - [ ] `DATA-PRE-AC-2` — scrolling requests bounded windows, handles end-of-file/missing-metadata/storage-error states cleanly, and persists/restores `ScrollSnapshot.regions['data-table']`.
    - [ ] `DATA-PRE-AC-3` — selecting a column calls `setSelectedColumn` and displays its approved `ColumnStats` details; reload preserves `data.selectedColumn`; closing resets it to `null`.
    - [ ] `DATA-PRE-AC-4` — keyboard navigation, RTL, long column/cell labels, 320px/200% zoom, `style-tokens.test.ts`, axe WCAG 2.2 AA and `01-4` parity pass.
- **Verification:** `bun run check`; `bun run test:e2e tests/data-preview.e2e.ts tests/visual-parity.e2e.ts tests/a11y.e2e.ts`; `bun run format <changed-files>`.
- **Progress:** [ ] Not started

### T4 — Route, mode, scroll-restoration and Step 1 sidebar integration

- **Depends on:** T1, T2, T3; `state-navigation-conformance.md` implemented; answer to TODO-13.
- **Risk:** needs care — `whenSettled()` timing with `restoreScroll`, `app-sidebar.ts` is in `KNOWN_DRIFT` (`TOK-4`), and dataset change must stay consistent across reload and history navigation.
- **Likely files:** `src/app.ts`, `src/features/data/app-data-view.ts`, `src/features/navigation/app-sidebar.ts`, `tests/data-flow.e2e.ts`.
- **Must not touch:** other workflow step views (`/target`, `/models`, `/results`), `src/stores/reconciler.ts` (owned by `state-navigation-conformance.md` and `data-ingestion-and-storage.md` T10), `app-sidebar.ts` visual remediation styles (`scaffolding-visual-remediation`).
- **Implementation:** Pass `app-data-view`'s `whenSettled()` promise to `restoreScroll` in `src/app.ts` (`state-navigation-conformance.md` T8 / `app-state-and-navigation.md` §8.4), verify `data:select` vs `data:preview` and `regions['data-table']` persistence across reload and Back/Forward, keep `app-sidebar` Step 1 summary (`state.dataset`) synchronised without adding token drift, and verify failed/cancelled ingestion leaves previous dataset and `$appState` untouched.
- **Acceptance criteria:**
    - [ ] `DATA-FLOW-AC-1` — initial `/data` renders picker mode; successful sample or upload ingestion switches to preview and survives reload with exact `data.mode`, `data.selectedColumn`, `data:preview` and `regions['data-table']` offsets (`NAV-E2E-7`).
    - [ ] `DATA-FLOW-AC-2` — failed or cancelled ingestion leaves `$appState.dataset`, `$appState.data.mode` and IndexedDB previous dataset intact.
    - [ ] `DATA-FLOW-AC-3` — the approved preview exit action (TODO-13) transitions state and `/data` view as specified, and survives reload and browser Back/Forward.
    - [ ] `DATA-FLOW-AC-4` — `app-sidebar` Step 1 summary reflects `$appState.dataset` after load, reload, failure and exit without introducing new token/drift violations.
- **Verification:** `bun run check`; `bun run build`; `bun run test:e2e tests/data-flow.e2e.ts tests/app-shell.test.ts`; `bun run format <changed-files>`.
- **Progress:** [ ] Not started

### T5 — Sync specification

- **Depends on:** T1, T2, T3, T4.
- **Risk:** needs care — multiple specs overlap, and `preview-dataset.md` currently documents a removed prototype.
- **Likely files:** `specification/workflow-steps.md`, `specification/app-state-and-navigation.md`, `specification/state-and-storage.md`, `specification/preview-dataset.md`, `specification/components/card.md`, `specification/components/sidepanel.md`, `specification/visual-design.md`, `specification/README.md`, `specification/TODO.md`.
- **Must not touch:** product code, tests and `specification/mockups/**`.
- **Implementation:** Apply every checked item under _Specification changes_ in present tense with no plan history (`specification/README.md` "Writing specs"), update spec statuses and `specification/README.md` index rows honestly, and resolve/narrow only covered Known gaps and TODO items.
- **Acceptance criteria:**
    - [ ] Every item under _Specification changes_ is applied and ticked.
    - [ ] No changed spec contradicts shipped code or another spec, or narrates this plan's history.
    - [ ] `bun run plans:check` passes with no spec index mismatch.
- **Verification:** `bun run plans:check`; inspect `git diff specification/` against _Specification changes_.
- **Progress:** [ ] Not started

## Verification and definition of done

- [ ] All task acceptance criteria met (`DATA-SEL-AC-*`, `DATA-UP-AC-*`, `DATA-PRE-AC-*`, `DATA-FLOW-AC-*`) in Chromium, Firefox and WebKit.
- [ ] `bun run check` passes with 0 type errors and no regressions vs baseline (52 passing unit tests across 6 files).
- [ ] `bun run build` passes.
- [ ] `bun test tests/style-tokens.test.ts`, `bun run test:e2e tests/visual-parity.e2e.ts` and `bun run test:e2e tests/a11y.e2e.ts` pass for selection, dialogs and preview.
- [ ] Manual keyboard, VoiceOver/NVDA, 200% zoom, 320px, `dir="rtl"`, `prefers-reduced-motion` and `forced-colors` checks recorded in the implementation log.
- [ ] Every item under _Specification changes_ is ticked, specs match shipped code, and `bun run format <files>` ran on all edited files.

## Risks and open questions

- **Blocking (human decisions needed before `ready`):**
    1. **`app-dataset-card` sample ID vs `card.md` §3/§11 (`CARD`):** `card.md` forbids an `id` property and emits `{ name: string }`, while `COMPONENTS.md` §4 forbids inline arrow wrappers in `@event` listeners. Approve adding `sampleId?: string` (and `detail.sampleId`) to `<app-dataset-card>` or `data-sample-id` lookup on `e.currentTarget`?
    2. **Dataset card copy & open questions (`TODO-29`, `TODO-30`):** resolve `card.md` Q4–Q12 (notably `Select Dataset` vs `Load Dataset`, compact count rounding `61K` vs full count, `tasks` display, `overflow-wrap`).
    3. **Preview exit action (`TODO-13`, `TODO-28`):** decide between **Change Dataset** (`setDataMode('select')`), **Delete Dataset**, or both; if a red button (`.btn-red` in `01-4_preview-dataset.html`) is kept, approve adding a danger variant to `components/button.md`.
    4. **Discard confirmation on dataset change (`TODO-17`):** confirm whether picking/uploading a new dataset while `models.length > 0` uses confirm-and-discard (`app-state-and-navigation.md` §6.4) before calling `loadDataset`.
    5. **Column details `<aside>` (`TODO-10`, `components/sidepanel.md`):** specify tier, public API, histogram rendering, high-cardinality categorical truncation and text-column display.
    6. **Datasheet dialog layout & safe HTML (`TODO-12`, `TODO-34`, `TODO-18`):** specify how `SampleDatasetDescriptor` metadata and compiled `files.datasheet` HTML combine (without `unsafeHTML`), and confirm `TODO-34` dialog spec.
    7. **Upload UI copy & notices (`TODO-09` UI parts, `TODO-34`, `TODO-35`):** approve progress/cancellation UI, human error copy per `IngestionError.code`, and how `paddedRowCount`, `skippedRows`, `missingTokens` and `invalidCount` warnings are presented.
    8. **`src/i18n.ts` dependency:** approve creating `src/i18n.ts` (`@nanostores/i18n`) via a prerequisite plan/task before T1.
- **Blocking (prerequisite `draft` plans & offline checks):**
    - `data-ingestion-and-storage.md` (`draft`), `state-navigation-conformance.md` (`draft`) and `virtual-table-component.md` (`draft`) must be approved/implemented (or their contracts frozen) before dependent tasks execute.
    - `bunx modern-web-guidance` searches for `dialog`, `forms`, `responsive-table` and dropzone could not run offline in the sandbox and must be retrieved before `ready`.
- **Non-blocking:** Mockups `01-1`–`01-4` have stale/placeholder details (URL field, `"Pen"` title, absent inspector); they remain unedited references while app output obeys `visual-design.md`.

## Implementation and verification log

| When (UTC) | Task | Outcome / commands / evidence |
| ---------- | ---- | ----------------------------- |
| —          | —    | Not started                   |

## Change log

| When (UTC)           | Change               | Reason                                                                                                                                                                                                                                                                                                                                      |
| -------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-13T09:56:12Z | Initial draft        | Expanded the existing Step 1 outline into a plan.                                                                                                                                                                                                                                                                                           |
| 2026-11-13T10:05:02Z | Plan review revision | Aligned contracts with `data-ingestion-and-storage.md` and `state-navigation-conformance.md`; removed stale `src/config/datasets.ts` and `row-window-controller.ts`; added `lit-architecture` tiers/state placement, `whenSettled()`, `datetime` UTC rule, A11Y/SEM deviations and test-harness gaps; isolated concrete blocking questions. |
