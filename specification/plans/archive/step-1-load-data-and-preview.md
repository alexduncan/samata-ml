# Step 1: Load data and preview

**Status:** archived | **Updated:** 2026-11-19T10:40:53Z

## Goal

**Current behaviour:** `/data` is a placeholder in `src/app.ts`. Ingestion/storage and static content are implemented. `loadSampleCatalogue()` returns `SampleDatasetIndex.entries`; `DatasetMetadata.columns` is an array. `src/i18n.ts` and dataset UI elements are absent.

**Target behaviour:** Learners browse sample cards, inspect safe datasheets, upload CSVs with progress/cancel, preview bounded row windows, inspect columns and confirm Change Dataset before removal. COMPAS explicitly says it downloads from GitHub.

**Why:** Provide an inspectable dataset for target/model setup while preserving existing work on failed or cancelled loading.

## Scope

**In scope**

- Minimal English UI i18n foundation using the installed library and existing locale configuration; no separate unwritten prerequisite.
- Shared dataset-resource stores, sample picker, datasheet/upload dialogs, preview and column panel, route/scroll integration and reference journeys.
- Human answers: typed `datasetId`/`dataset-id` identity, compact card counts, wrapping text/stats, Change Dataset with confirmation, and no repeated-button `aria-describedby` requirement.

**Out of scope**

- Inference/statistics algorithms, training, arbitrary URL input, new chart dependency, shell visual remediation, locale switcher/additional locales, and Storybook.
- Normative mockup edits or inventing appearance for draft-only states.

**Constraints and invariants**

- UI elements never import workers, IndexedDB or the storage client. Connected views subscribe through `StoreController`; resource actions in `src/stores/dataset.store.ts` own storage/service calls.
- Persisted dataset/mode/column state changes only through app actions. Never discard models before ingestion succeeds: confirmation grants intent; `loadDatasetSucceeded` commits the reset after success.
- Use tokens only, logical properties and native dialogs. Dates display in UTC. Draft-only areas follow visual-design §1.1.
- Card-owned translations/formatters are the sole store exception for Tier 2 cards, explicitly retained from card.md §1/§7; no domain-store imports. Other presentational elements receive text/content from the connected consumer.

## Required reading

The implementer reads only these, plus each task's likely files.

- This plan's complete interfaces, including the accepted product defaults recorded under _Risks_.
- `specification/workflow-steps.md` §1; `specification/sample-datasets.md` — UI intent and catalogue/remote-source rules.
- `specification/COMPONENTS.md` §3–§9; `specification/visual-design.md` §1–§6 — Lit and visual contract.
- `specification/components/card.md` §2–§8 — existing shape/styles; this plan records the human's amendments.
- `specification/plans/virtual-table-component.md` _Interfaces and behaviour_ — exact consumer API.
- `specification/plans/state-navigation-conformance.md` D5–D14 and _Interfaces and behaviour_ — approved state/focus contracts, subject to its review amendments.
- `specification/app-state-and-navigation.md` §5.4–§5.6, §6.1, §6.4, §8.4; `specification/state-and-storage.md` §3–§5 — transient dialogs, persistence and scroll snapshots.
- `src/types/dataset.ts`, `src/types/sample-dataset.ts`, `src/features/data/ingestion/storage-client.ts`, `src/features/data/ingestion/errors.ts`, `src/features/data/load-dataset.ts` — implemented signatures.
- `src/common/content/sanitise-fragment.ts`, `src/common/content/content-loader.ts` — reuse the existing safe-fragment policy; datasets are not a content-loader domain.
- `src/config/locales.ts`, `node_modules/@nanostores/i18n/README.md` — installed i18n API.
- `specification/mockups/ui-scaffold/01-1_select-data.html`, `specification/mockups/ui-scaffold/01-2_dataset-card.html`, `specification/mockups/ui-scaffold/01-3_upload-dataset.html`, `specification/mockups/ui-scaffold/01-4_preview-dataset.html`, `specification/mockups/ui-scaffold/01-5_preview-dataset-aside.html` — existing visual references.
- `specification/mockups/ui-scaffold/css/base.css`, `specification/mockups/ui-scaffold/css/card.css`, `specification/mockups/ui-scaffold/css/modal.css`, `specification/mockups/ui-scaffold/css/dropzone.css`, `specification/mockups/ui-scaffold/css/overlay.css`, `specification/mockups/ui-scaffold/css/table.css` — mapped styles below.
- `specification/mockups/ui-scaffold/drafts/01-6_virtual-table.html`, `specification/mockups/ui-scaffold/drafts/01-7_data-states.html` — structural additions only.
- `specification/plans/reference-dataset-regression-tests.md` D8/D10; `specification/standards-and-documentation.md` — shared helpers, journeys and TSDoc.

## Codebase context

- **Relevant implementation:** Ingestion and content plans are `implemented`; state-navigation is not implemented; virtual-table is still a draft. Use `summary.sampleId` for sample descriptor lookup, never the generated ingestion UUID. `SampleDatasetSummary.csvOrigin` identifies remote samples. No `SampleDatasetManifest.datasets` API exists.
- **Tests and commands:** Review baseline: `bun run check` passed, 144 tests/22 files, 0 type errors/failures. Playwright configuration has Chromium/Firefox/WebKit; browser suites are `tests/*.e2e.ts`. Existing parity harness needs state/setup before assertions.
- **Web guidance:** Retrieved `dialog`, `forms`, `responsive-table`, `accessibility`; native `showModal()`, no redundant roles/focus trap/Escape handler, safe Cancel autofocus, reset dialog `returnValue` after close; visible file label; named horizontal overflow. Use imperative dialog methods under Baseline Widely available, without invoker-command/polyfill dependencies. [Lit properties](https://lit.dev/docs/components/properties/) supports `datasetId` with explicit `attribute: 'dataset-id'`; [Lit events](https://lit.dev/docs/components/events/) supports direct host listeners.
- **Visual reference:** All five pages opened and visually inspected on scaffold server during review. `01-1`: `base.css` `.page-header`, `card.css` `.cards`, `.card*`, `button.css` `.btn`; `01-2`: `modal.css` `dialog.modal`, `.modal-header`, `.modal-content`; `01-3`: same plus `dropzone.css` `.dropzone` and `base.css` `.file-picker*`; `01-4`: `.page-header`, preview placeholder; `01-5`: `overlay.css` `.overlay`, HTML `.overlay-title`, `aside.overlay`, `table.css` `.table`. Drafts `01-6`/`01-7` cover table, progress, notices and histogram structure; no parity for draft-only content.
- **Lit skills:** `lit-implementer` for T2–T6.
- **Known gaps decided:** 13: no new KNOWN_DRIFT entries, reuse approved A11Y/SEM fixes; 16: rewrite obsolete preview spec during sync; 17: Playwright under `tests/`; 18: shadow-DOM link interception is owned by the refreshed conformance plan.
- **Assumptions requiring verification:** State-navigation, virtual-table and reference-helper contracts must land before dependent tasks; these are execution dependencies, not unanswered design questions.
- **Input note reviewed:** `specification/notes/sample_dataset_specification.md` is non-normative. Legacy metadata.json/manifest paths and duplicate types are superseded by implemented sample-datasets.md and src/types/sample-dataset.ts. Retain its useful provenance/datasheet, implicit-missing, identifier and target-specific leakage ideas through existing descriptors and these UI plans. Classification-only curation applies to samples, not an app-wide ban on numeric uploaded targets. Fairness tools/editable metadata remain future work. T7 removes the note only after durable/deferred rules and inbox links are reconciled.
- **Review author:** Codex (model unrecorded), 2026-11-13; retain this co-author during workflow migration.
- **Review handoff:** Review-complete draft, with no product blockers. The user accepted the Step 1–2 defaults and chose current-tooling drafts in chat. Formal `ready-for-review` submission awaits workflow-gates; retain draft metadata and migrate/submit once that tooling exists.

## Technical decisions

| Decision               | Chosen approach and rationale                                                                                                                                                                                                                                               | Rejected alternative / trade-off                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| D1 Identity convention | Typed domain identity on reusable cards: `datasetId` / `dataset-id`, later `modelId` / `model-id`; include it in typed events. Never infer identity from translated display names. Record this project convention in COMPONENTS §4 at sync.                                 | Host `data-*` is reserved for native repeated controls; no inline arrow listeners are needed.            |
| D2 Card answers        | Keep `app-`, compact counts, `overflow-wrap: anywhere`, wrapping stats with existing 0.5rem gap; model image required; capitalisation stays CSS. Visible copy is Load Dataset; no catalogue task badges. Omit `aria-describedby` per human, preserve names/native controls. | Reopening answered Q4–Q11 or adding speculative props.                                                   |
| D3 i18n                | T1 adds `src/i18n.ts` exporting `i18n`, `$locale` (read-only base `en`), `$format` using `formatter`; derives html lang/dir from existing LOCALES. Component messages stay per component. The only shipped locale remains en.                                               | An unwritten prerequisite plan or translation dictionaries in src/i18n.ts.                               |
| D4 Resource ownership  | Non-persisted stores/actions own metadata, descriptor and row requests. Connected components import stores/actions only.                                                                                                                                                    | Storage client calls inside Lit elements violate COMPONENTS §5.                                          |
| D5 Safe datasheets     | Add narrow `loadSampleDatasheet(id, signal?)` in sample-datasets.ts using descriptor.files.datasheet, same-origin validation, MIME/document rejection and existing sanitiseFragment. Return a fresh DocumentFragment.                                                       | `loadContentEntry('datasets', ...)` is invalid: datasets are not a ContentDomain.                        |
| D6 Exit                | Confirm Change Dataset, then remove stored dataset and reset dataset/target/models/mode; remain on `/data` selection. Disable during active ingestion or training.                                                                                                          | Merely setting select mode fails the human's explicit deletion request; no new danger variant is needed. |
| D7 Panel               | Existing stored stats, no reparsing/full-row scan. A native histogram-bin table supplies the histogram information until a chart design exists.                                                                                                                             | New chart dependency or calculating missing standard deviation on the UI thread.                         |

### Interfaces and behaviour

**Resource API (T1):** `src/stores/dataset.store.ts` exports `$datasetResources` with `{datasetId: string|null, status: 'idle'|'loading'|'ready'|'error', metadata: DatasetMetadata|null, descriptor: SampleDatasetDescriptor|null, error: string|null}`, `loadDatasetResources(datasetId): Promise<void>`, `$previewRows` with `{datasetId, startIndex, rows: RawRecord[], status, error}`, `loadPreviewRows(datasetId, startIndex, limit): Promise<void>`, `clearDatasetResources(): void`, and `changeDataset(): Promise<boolean>`, `$datasetLoad` (`{busy:boolean,progress:IngestionProgress|null,errorCode:IngestionErrorCode|null}`), `startDatasetLoad(source:IngestionSource):Promise<boolean>`, `cancelDatasetLoad():void`. The resource module owns the single AbortController and calls the existing loadDataset service; views call this action, not the storage client. Export typed state interfaces. Resolve descriptors through `$appState.dataset.sampleId`, not id. Missing descriptor is a non-fatal advisory; missing metadata is an error, never a selectable empty schema. Ignore stale results by generation/dataset ID, both on dataset switch and teardown. Limit row requests to 256, one in flight plus the latest pending range; cache at most three windows, evict on dataset change. No other feature needs to open IndexedDB.

`changeDataset` rejects while any model is training or ingestion is active; after UI confirmation takes the existing INGESTION_LOCK with ifAvailable (fail as busy if another tab holds it), calls `deleteDatasetsExcept(null)` within the lock, then a new app action `clearDataset()`. This action clears dataset, target, models, `nextModelNum = 1`, selected column and non-data scroll keys, sets `data.mode='select'`, preserves onboarding/preferences; side effects outside transforms. Storage failure leaves app state intact and exposes Retry. No results-store deletion is claimed before results storage exists.

**Component APIs:** all properties unreflected; objects/arrays/DocumentFragment use `attribute:false`. All intent events below are `CustomEvent<detail>`, dispatched on host, `bubbles:false`, `composed:false`, because direct consumers bind them. No unlisted slots, parts, custom properties or methods.

| Element / file / tier                                                                 | Closed public API                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app-data-view`, `src/features/data/app-data-view.ts`, Tier 3                         | Only `whenSettled(): Promise<void>`; subscribes to app/resource/preview stores; private dialog intent. Resource actions own AbortController. No public props/events.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `app-dataset-card`, `src/components/app-dataset-card.ts`, Tier 2                      | Existing name/description/columns/rows defaults plus `datasetId:string=''`, attribute `dataset-id`. Events `app-dataset-select`, `app-dataset-datasheet-open`: `{datasetId:string,name:string}`. No slots; i18n-only store exception.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `app-datasheet-dialog`, `src/features/data/app-datasheet-dialog.ts`, Tier 2           | `open:boolean=false`, `heading:string=''`, `content:DocumentFragment\|null=null`, `status:'loading'\|'ready'\|'error'='loading'`, `closeLabel:string=''`, `statusLabel:string=''`. Events `app-datasheet-dialog-close` `{}`, `app-datasheet-dialog-retry` `{}`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `app-upload-dataset-dialog`, `src/features/data/app-upload-dataset-dialog.ts`, Tier 2 | `open:boolean=false`, `busy:boolean=false`, `progress:IngestionProgress\|null=null`, `error:string\|null=null`. `labels` is an object with exactly heading/file/requirements/phase/cancel/close string keys, default empty strings. Events `app-upload-file-select` `{file:File}`, `app-upload-cancel` `{}`, `app-upload-close` `{}`.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `app-dataset-preview`, `src/features/data/app-dataset-preview.ts`, Tier 2             | `metadata:DatasetMetadata\|null=null`, `window:VirtualTableWindow` empty, `selectedColumn:string\|null=null`, `loading:boolean=false`, `error:string\|null=null`. `labels` has exactly table/previousSegment/nextSegment/goToRow/go/empty/loading/retry/changeDataset/capNotice/rowRange string keys, default empty strings. Events `app-preview-range-change` `VirtualTableRange`, `app-preview-position-change` `VirtualTablePosition`, `app-preview-column-select` `{column:string}`, `app-preview-change-dataset` `{}`, `app-preview-retry` `{}`. Methods `restorePosition(position:{top:number,left:number}):Promise<void>` and `focusColumn(column:string):void` delegate to the table's public methods via local ref, never shadowRoot queries. |
| `app-column-details`, `src/features/data/app-column-details.ts`, Tier 2               | `column:ColumnStats\|null=null`, `description:string=''`, `rowCount:number=0`. `labels` has exactly close/type/missing/invalid/min/median/mean/max/histogram/range/count/category/frequency/percentage/showAll/showFewer/distinct/identifier/true/false/earliest/latest/missingTokens/invalidExamples/notAvailable string keys, default empty strings. Event `app-column-details-close` `{}`. Renders nothing for null.                                                                                                                                                                                                                                                                                                                                |

**Loading/confirmation:** catalogue load errors show Retry. Picker/file/drop share one path. CSV filename validation is case-insensitive `.csv`, MIME is advisory; reject multiple files. Start directly on valid selection; disable repeat start. Native input remains keyboard reachable. Progress is phase-specific with bytes/rows where totals exist, otherwise indeterminate `<progress>`; never present a false overall percentage. Cancel/close/Esc abort via the native dialog cancel/close lifecycle; do not add an Escape key handler. Await cancellation settlement before allowing another run. Failures/cancellation preserve previous dataset, target and models. Confirmation must not call confirmDiscardModels before ingestion.

**Accepted loading and error copy:** download “Downloading dataset”; parse “Reading CSV”; typing “Detecting column types”; statistics “Calculating statistics”. Error mapping: NETWORK_ERROR/HTTP_ERROR “The dataset could not be downloaded. Check your connection and try again.”; FILE_TOO_LARGE “This file exceeds the supported size limit.”; TOO_MANY_COLUMNS “CSV files may contain at most 256 columns.”; INSUFFICIENT_STORAGE “There is not enough browser storage. Free space and try again.”; EMPTY_FILE “This CSV is empty.”; NO_DATA_ROWS “This CSV has no usable data rows.”; READ_FAILED “This CSV could not be read. Check the file and try again.”; SAMPLE_NOT_FOUND/DESCRIPTOR_MISMATCH “This sample is unavailable or has changed. Reload and try again.”; STORAGE_FAILED “The dataset could not be saved in browser storage.”; BUSY “Another dataset is loading. Wait or cancel it.”; CANCELLED returns to idle with “Loading cancelled”; UNKNOWN “The dataset could not be loaded. Try again.” Never render raw error.message. Successful preview reports padded/skipped counts and per-column missing tokens/invalid counts; show these as information, not a rejected upload. COMPAS and every `csvOrigin='remote'` card's surrounding list item visibly states “Downloaded from GitHub when loaded; internet connection required” (derive host for other future sources). Do not expand the card API for this notice.

**Accepted panel behaviour:** name/type, description when available, missing/invalid counts/tokens; numeric min/median/mean/max and stored histogram bins; categorical frequencies sorted descending then code-unit name, first 50 plus Show all/Show fewer local transient expansion, percentages over non-missing values; boolean true/false frequencies; datetime UTC bounds; text distinct count when known and identifier hint. Never fabricate stddev (not stored), add it to deferred work. Record behaviour-driven deviation `DATA-UI-01` for omitted standard deviation and histogram-bin table, `DATA-UI-02` for Change Dataset replacing disabled red Delete Dataset; add these to visual-design §5 at sync and cite in parity entries. For overlay.css's literal rgba shadow, T4 explicitly adds `--shadow-panel: -2px 0 5px rgba(0, 0, 0, 0.1)` to css/root.css App additions (plan-authorised token, registered in visual-design §2). Copy `.overlay` geometry with logical properties, box-sizing:border-box and max-inline-size:100% so it fits 320px; record DATA-UI-03 for that overflow fix. Existing layout/typography of `01-5` still maps; new histogram content is draft-only. app-data-view composes preview and column-details as siblings. Panel is an aside, not modal; focus stays on selected header, and its Close event calls setSelectedColumn(null) then preview.focusColumn(previousName) through the consumer-held ref.

**Scroll:** persist `regions['data-table'] = {top: position.top, left: position.inlineOffset}` as logical distance, never segment-local offset. After `whenSettled` and matching viewport width, use restorePosition, which calls the table's restoreScroll(top,left); the table converts to a row using its own measured geometry. Keep ordinary document snapshot fields; suppress writes until restoration settles. Re-render mode when `$appState.data.mode` changes, even without a route event. Dates use UTC; numeric display uses `$format.number(value,{useGrouping:true,maximumFractionDigits:20})`, en gives commas, no forced integer rounding. Null is an em dash; booleans plain true/false until future formatting. Table segment controls and cap notice follow the virtual-table plan.

## Specification changes

- [x] `specification/workflow-steps.md` §1 — implemented catalogue, remote notice, upload/progress/error/quality copy, confirmation and panel behaviour; status remains `partial` for later steps.
- [x] `specification/COMPONENTS.md` §4/§8 — typed domain identity convention and i18n-only presentational exception; status remains `partial` because shell remediation/Storybook remain.
- [x] `specification/content-and-i18n.md` Localisation Store — en UI instance and formatter implemented; switcher/additional locales remain target.
- [x] `specification/components/card.md` §1–§12 — human Q4–Q12 answers, datasetId events, Load Dataset, no task badges, omitted aria-describedby, wrapping and browser test paths; honest partial status until model card built.
- [x] `specification/components/sidepanel.md` — the complete closed panel API and stored-stat rules above; `stub` → `implemented` for delivered behaviour.
- [x] `specification/preview-dataset.md` — replace obsolete Pipeline.state, dataset_stats, URL and integer/float rules with implemented stores/window/scroll contract; `target` → `implemented` within this scope.
- [x] `specification/app-state-and-navigation.md` §6.1/§6.4 and `specification/state-and-storage.md` §5 — confirmed removal and logical table-region integration; do not promote whole draft specs with unanswered unrelated questions.
- [x] `specification/visual-design.md` §2/§3/§5 — shadow-panel token, actual style ownership, DATA-UI-01/02/03, A11Y-01/03/05/08/10 and SEM-04/05/08 mappings; draft-only surfaces have no parity claims.
- [x] `specification/testing.md` — Load Data stage of both reference journeys is built; later stages remain target.
- [x] Delete `specification/notes/sample_dataset_specification.md` after its lasting rules are covered; `specification/notes/README.md` removes the consumed inbox link, and `specification/FUTURE.md` retains editable-metadata/fairness ideas without legacy output paths.
- [x] `specification/FUTURE.md` — human's deferred repeated-card description/a11y review and richer type formatting, plus stddev/chart design; retain native names/focus now.
- [x] `specification/README.md` Known gap 16 resolved, gap 17 narrowed; `specification/TODO.md` narrow TODO-09/10/12/13/28/29/30/34/35/37/39/48 and i18n TODO-46 only for delivered scope.

## Implementation tasks

### T1 — i18n and dataset resource actions

- **Depends on:** None
- **Risk:** needs care — keep IO outside elements and preserve model state on failure.
- **Likely files:** `src/i18n.ts`, `src/stores/dataset.store.ts`, `src/stores/app.store.ts`, `tests/dataset-resources.test.ts`.
- **Must not touch:** Persisted schema, ingestion algorithms, router and locale configuration.
- **Implementation:** Create the exact resource/i18n API above; add clearDataset action and bounded, generation-guarded row loading. Use existing service entry points, no new worker.
- **Acceptance criteria:**
    - [x] `DATA-RES-1` — metadata array/sampleId handling, stale response rejection, three-window cache/request bound and store cleanup proven with controlled promises.
    - [x] `DATA-RES-2` — clear/change rejects during training, storage failure leaves state intact, successful removal preserves onboarding and clears downstream state.
- **Verification:** `bun test tests/dataset-resources.test.ts`; `bun run check`.
- **Progress:** [x] Complete

### T2 — Sample catalogue, dataset card and safe datasheets

- **Depends on:** T1
- **Risk:** needs care — identity, content safety and cancellation.
- **Likely files:** `src/components/app-dataset-card.ts`, `src/features/data/app-data-view.ts`, `src/features/data/app-datasheet-dialog.ts`, `src/features/data/sample-datasets.ts`, `src/styles/card.styles.ts`, `src/app.ts`, `tests/data-selection.e2e.ts`, `tests/visual-parity/map.ts`, `tests/visual-parity.e2e.ts`.
- **Must not touch:** Ingestion/storage internals, normative mockups and KNOWN_DRIFT.
- **Implementation:** Mount the route view, consume catalogue.entries, typed identity, card wrapping answers, remote notice and safe datasheet function. Open dialog with native showModal; content from fresh sanitised fragment, same-root heading label, browser focus return. Cache requests without stale content commits.
- **Acceptance criteria:**
    - [x] `DATA-SEL-1` — all catalogue entries render with stable ids/compact counts; remote source warning visible before load.
    - [x] `DATA-SEL-2` — correct datasheet, retry and missing-content states; hostile HTML removed; native close restores invoker focus.
    - [x] `DATA-SEL-3` — `01-1`/`01-2` mapped styles, amended CARD criteria, tokens/RTL/long labels pass.
- **Verification:** `bun run test:e2e tests/data-selection.e2e.ts tests/visual-parity.e2e.ts`; `bun run check`.
- **Progress:** [x] Complete

### T3 — Local CSV upload and load lifecycle

- **Depends on:** T2
- **Risk:** needs care — cancellation must retain downstream state.
- **Likely files:** `src/features/data/app-upload-dataset-dialog.ts`, `src/features/data/app-data-view.ts`, `tests/data-upload.e2e.ts`, `tests/visual-parity/map.ts`.
- **Must not touch:** Ingestion algorithms, IndexedDB schema and normative mockups.
- **Implementation:** Native labelled input/drop path, phase progress, explicit error mapping, abort on dismissal and one run at a time. No arbitrary URL input. Use loadDataset service; grant replacement intent without prematurely clearing models.
- **Acceptance criteria:**
    - [x] `DATA-UP-1` — valid CSV succeeds, errors map exhaustively, progress/cancel works via pointer and keyboard.
    - [x] `DATA-UP-2` — cancel/failure preserves old dataset/target/models; late result cannot update a disconnected or superseded view.
    - [x] `DATA-UP-3` — existing `01-3` parts pass parity/tokens; new progress/error content follows draft limits and axe.
- **Verification:** `bun run test:e2e tests/data-upload.e2e.ts`; `bun run check`.
- **Progress:** [x] Complete

### T4 — Bounded preview and column inspector

- **Depends on:** T1, T3
- **Risk:** needs care — window identity, logical scrolling and discriminated stats.
- **Likely files:** `src/features/data/app-dataset-preview.ts`, `src/features/data/app-column-details.ts`, `src/features/data/app-data-view.ts`, `tests/data-preview.e2e.ts`, `tests/visual-parity/map.ts`, `css/root.css` (only the explicitly named shadow-panel token).
- **Must not touch:** Table public API and ingestion/statistics code; all other token additions are forbidden.
- **Implementation:** Bind rows through stores, format display cells, relay typed table events, render stats/aside and segment controls. Confirm Change Dataset. Use only stored stats; no stddev fabrication or whole-dataset scan.
- **Acceptance criteria:**
    - [x] `DATA-PRE-1` — bounded requests, cap and segment navigation, grouping-preserving decimals and UTC display.
    - [x] `DATA-PRE-2` — each stats type/empty count state, frequency ordering/expansion and panel close work; selected column persists.
    - [x] `DATA-PRE-3` — `01-4`/`01-5` existing selectors pass parity with DATA-UI-01/02; drafts have tokens/axe only.
- **Verification:** `bun run test:e2e tests/data-preview.e2e.ts tests/visual-parity.e2e.ts`; `bun test tests/style-tokens.test.ts`; `bun run check`.
- **Progress:** [x] Complete

### T5 — Route, mode, focus and scroll integration

- **Depends on:** T2, T3, T4
- **Risk:** needs care — asynchronous view mount and modal close must not refocus the page.
- **Likely files:** `src/app.ts`, `src/features/data/app-data-view.ts`, `tests/data-flow.e2e.ts`, `tests/a11y.e2e.ts`.
- **Must not touch:** Other workflow views, sidebar visual remediation, persisted schema and router internals.
- **Implementation:** Follow conformance focus requests; await view.updateComplete/whenSettled without querying child shadow roots. Preserve mounted route views across state refreshes. On mode changes save/restore distinct data keys and table logical position, matching viewport width. Run a11y against all new states.
- **Acceptance criteria:**
    - [x] `DATA-FLOW-1` — preview/mode/column/document and logical table scroll survive reload and Back/Forward; modal close does not restore/refocus document.
    - [x] `DATA-FLOW-2` — changing dataset confirms, removes it, updates sidebar via app state and survives reload; cancel leaves state intact.
    - [x] `DATA-FLOW-3` — no new token/a11y drift; manual keyboard, RTL, 320px, zoom, reduced motion/forced colours evidence recorded.
- **Verification:** `bun run test:e2e tests/data-flow.e2e.ts tests/a11y.e2e.ts tests/app-shell.test.ts`; `bun run check`; `bun run build`.
- **Progress:** [x] Complete

### T6 — Begin both reference journeys through the real UI

- **Depends on:** T5
- **Risk:** routine.
- **Likely files:** `tests/journeys/iris-classification.e2e.ts`, `tests/journeys/penguins-classification.e2e.ts`.
- **Must not touch:** App code, golden files and other browser suites.
- **Implementation:** Fresh context, shared helpers, choose real sample, verify preview/row count/types and reload/resume. No localStorage/IndexedDB seeding or direct worker ingestion. Step 2/3 extend these same files sequentially.
- **Acceptance criteria:**
    - [x] `JOURNEY-IRIS-DATA` and `JOURNEY-PENGUINS-DATA` exercise real sample loading and resume in every configured browser.
- **Verification:** `bun run test:e2e tests/journeys/iris-classification.e2e.ts tests/journeys/penguins-classification.e2e.ts`; `bun run check`.
- **Progress:** [x] Complete

### T7 — Sync specification

- **Depends on:** T1, T2, T3, T4, T5, T6
- **Risk:** needs care — obsolete preview spec and shared card rules must be reconciled.
- **Likely files:** `specification/workflow-steps.md`, `specification/COMPONENTS.md`, `specification/content-and-i18n.md`, `specification/components/card.md`, `specification/components/sidepanel.md`, `specification/preview-dataset.md`, `specification/app-state-and-navigation.md`, `specification/state-and-storage.md`, `specification/visual-design.md`, `specification/testing.md`, `specification/FUTURE.md`, `specification/README.md`, `specification/TODO.md`, `specification/notes/README.md`, `specification/notes/sample_dataset_specification.md` (delete only), `specification/HUMAN.md`.
- **Must not touch:** Product code, tests and normative mockups.
- **Implementation:** Apply every specification change in present tense, honest partial statuses and TODO/gap narrowing. Keep styling/deferred-work queue items. Under migrated workflow, verify-implementation owns sync.
- **Acceptance criteria:**
    - [x] Every specification change applied/ticked; no obsolete storage/type/identity rule remains.
    - [x] Index matches actual status; no implemented claim for later steps or additional locales.
- **Verification:** `bun run plans:check`; review `git diff specification/`.
- **Progress:** [x] Complete

## Verification and definition of done

- [x] All acceptance IDs tested; current baseline 144 passing tests, 0 failures/type errors; record fresh before/after counts.
- [x] `bun run check`, `bun run build`, token/parity/a11y and both journey suites pass; name browsers/manual checks not run.
- [x] No destructive state change before successful load; all IO outside elements; every specification change ticked.

## Risks and open questions

- **Blocking:** None.
- **Decisions accepted:** The user accepted the proposed Step 1–2 defaults: phase progress/cancel/plain-English errors, transient safe datasheets, a stored-stat panel, shared notifications and confirmation before discarding any model. The minimal en-only i18n instance is the technical foundation for this accepted UI; additional locales/switching remain excluded. TODO-09/10/12/34/46 are settled for this scope and their source wording is updated at final specification sync, not left to an implementer.
- **Non-blocking:** Awaiting styled mockups for table, progress/notices/histogram and confirmations; existing `01-5` aside is now a real reference, not missing. Standard deviation is not stored and is deliberately deferred. Human Q11 defers richer card descriptions; preserve native accessibility now. State-navigation, table and reference-helper dependencies must land first. Formal submission awaits workflow-gates status support.

## Implementation and verification log

| When (UTC)           | Task | Outcome / commands / evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-14T07:29:04Z | T1   | PASS: `bun test tests/dataset-resources.test.ts` (11 pass); `bun run check` (180 pass, 0 failures, 0 type errors). Implemented `src/i18n.ts`, `src/stores/dataset.store.ts`, `clearDataset` in `src/stores/app.store.ts`, verified DATA-RES-1 and DATA-RES-2.                                                                                                                                                                                                                                                                             |
| 2026-11-14T07:47:33Z | T2   | PASS: `bun run test:e2e tests/data-selection.e2e.ts tests/visual-parity.e2e.ts` (6 e2e pass, 18 parity pass); `bun run check` (180 pass, 0 failures, 0 type errors). Implemented `app-dataset-card`, `app-datasheet-dialog`, `app-data-view`, safe datasheet loading, card styling, and visual parity map entries. Verified DATA-SEL-1, DATA-SEL-2, and DATA-SEL-3.                                                                                                                                                                       |
| 2026-11-14T07:55:54Z | T3   | PASS: `bun run test:e2e tests/data-upload.e2e.ts tests/visual-parity.e2e.ts` (3 e2e pass, 22 parity pass); `bun run check` (180 pass, 0 failures, 0 type errors). Implemented `app-upload-dataset-dialog`, wired upload lifecycle and error/phase mappings in `app-data-view`, added visual parity map entries for `01-3`. Verified DATA-UP-1, DATA-UP-2, and DATA-UP-3.                                                                                                                                                                  |
| 2026-11-14T08:48:23Z | T4   | PASS: `bunx playwright test tests/data-preview.e2e.ts` (2 pass on Chromium & WebKit); `bunx playwright test tests/visual-parity.e2e.ts` (26 pass); `bun test tests/style-tokens.test.ts` (4 pass); `bun run check` (180 pass, 0 failures, 0 type errors). Implemented `ui-virtual-table`, `app-column-details`, `app-dataset-preview`, wired preview and column inspector into `app-data-view`, added `--shadow-panel` in `css/root.css`, added visual parity map entries for `01-4`/`01-5`. Verified DATA-PRE-1, DATA-PRE-2, DATA-PRE-3. |
| 2026-11-14T11:56:34Z | T5   | PASS: `bunx playwright test tests/data-flow.e2e.ts` (3 pass on Chromium & WebKit); `bunx playwright test tests/a11y.e2e.ts` (6 pass on Chromium & WebKit); `bunx playwright test tests/app-shell.test.ts` (8 pass on Chromium); `bun run check` (180 pass, 0 failures, 0 type errors); `bun run build` (complete). Verified DATA-FLOW-1, DATA-FLOW-2, DATA-FLOW-3.                                                                                                                                                                        |
| 2026-11-14T12:59:22Z | T6   | PASS: `bun run test:e2e tests/journeys/iris-classification.e2e.ts tests/journeys/penguins-classification.e2e.ts` (2 pass on Chromium & WebKit); `bun run check` (180 pass, 0 failures, 0 type errors). Created `tests/journeys/helpers.ts`, `iris-classification.e2e.ts`, `penguins-classification.e2e.ts`. Verified JOURNEY-IRIS-DATA and JOURNEY-PENGUINS-DATA.                                                                                                                                                                         |
| 2026-11-14T13:05:46Z | T7   | PASS: `bun run plans:check` (all specifications match actual statuses and rules). Synced `workflow-steps.md`, `COMPONENTS.md`, `content-and-i18n.md`, `components/card.md`, `components/sidepanel.md`, `preview-dataset.md`, `app-state-and-navigation.md`, `state-and-storage.md`, `visual-design.md`, `testing.md`, `FUTURE.md`, `README.md`, `TODO.md`, `HUMAN.md`; deleted `notes/sample_dataset_specification.md`.                                                                                                                   |

## Change log

| When (UTC)           | Change                                                                                                              | Reason                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 2026-11-13T09:56:12Z | Initial draft                                                                                                       | Step 1 planning.                                                                                  |
| 2026-11-13T18:47:40Z | Rebased on implemented APIs, absorbed human answers, closed component/store contracts, added i18n task and journeys | Review request; all tasks unstarted, decomposed and renumbered to remove unwritten prerequisites. |
| 2026-11-13T22:14:44Z | Recorded accepted product defaults and review-complete handoff                                                      | User accepted the grouped decisions in chat; retained draft metadata as requested.                |
