# Phase 3: Execute model training with progress bar and expandable log

**Status:** draft | **Updated:** 2026-11-19T08:47:35Z
**Authors:** Google Antigravity (Gemini 4 Argon High), Claude Code (claude-opus-5-5) | **Created:** 2026-11-17T21:23:45Z
**Verified by:** — | **Verified:** — | **Verification:** pending
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour:** `src/features/models/app-model-builder-view.ts` (L1097–1103) renders Section 5 (`5. Train Model`) as `<p class="pending-notice">Not available yet.</p>`. `scripts/build-assets.ts` does not deploy `web-ml`'s precompiled worker/WASM graph (`node_modules/web-ml/dist/`), and `scripts/server.ts` and `scripts/static-server.ts` do not send COOP/COEP/CORP headers or `application/wasm` MIME types. `src/stores/app.store.ts` exposes `startTraining`, `updateTrainingProgress`, `trainingSucceeded`, `trainingFailed`, `cancelTraining`, and `recoverInterrupted`, but no training worker or service exists.

**Target behaviour:** Clicking `Train Model` in Section 4 opens Section 5 (`5. Train Model`), prepares the dataset, and executes model training using the public exported functions from `web-ml` (`createTrainingClient().train()` for one-shot training and `nestedCrossValidate()` for nested cross-validation) inside an integration Web Worker. Section 5 renders a single native `<progress>` bar with an expandable message log below inside `<details>` and `<summary>` elements so the user can view either only the latest status in `<summary>` or expand `<details>` to inspect the complete training log. Completed runs persist their result envelope to IndexedDB (`model_results`) and mark the model `trained` ready for Phase 4.

**Why:** Deliver real local model training, cancellation, cross-tab lock safety, and an accessible single-progress-bar + `<details>`/`<summary>` log experience without mixing in Phase 4–6 result views or Phase 7 hyperparameter tuning UI.

## Scope

**In scope**

- Deploying `web-ml`'s precompiled `dist/` worker and WASM asset graph to `/vendor/web-ml/<revision>/` and adding COOP `same-origin`, COEP `require-corp`, CORP `same-origin`, and `application/wasm` headers to `scripts/server.ts` and `scripts/static-server.ts`.
- Dataset preparation and partitioning in `src/features/models/training/prepare-classification.ts` and `src/features/models/training/partition-provider.ts` (`PartitionDatasetProvider implements DatasetProvider`), fitting imputation and one-hot encoding strictly on training rows.
- Executing training in `src/features/models/training/training.worker.ts` using public `web-ml` exports (`createTrainingClient().train` and `nestedCrossValidate`, plus `accuracyScore`, `f1Score`, `logLoss`) and persisting results in IndexedDB `model_results` (`src/features/models/training/result-repository.ts`) before calling `trainingSucceeded`.
- Training orchestration, cancellation, `samata-ml:ingestion` (shared) + `samata-ml:training:{num}` (exclusive) Web Locks, and target-change / dataset-change cleanup across `src/features/models/training/training-service.ts`, `src/features/target/app-target-view.ts`, `src/features/data/app-data-view.ts`, and `src/stores/reconciler.ts`.
- Presentational `<app-training-progress>` (`src/features/models/app-training-progress.ts`) rendering a single `<progress>` bar and a `<details>` + `<summary>` message log, wired into Section 5 of `<app-model-builder-view>`, with co-located Storybook stories and three-browser Playwright E2E tests.

**Out of scope**

- Rendering Section 6 (`6. Model Results`) and `/results` comparison tables (moved to Phases 4–6: `specification/plans/web-ml-phase-4-single-model-results.md`, `specification/plans/web-ml-phase-5-model-comparison.md`, `specification/plans/web-ml-phase-6-model-specific-results.md`).
- User-configured hyperparameter tuning search spaces in Section 3 (moved to Phase 7: `specification/plans/web-ml-phase-7-hyperparameter-tuning.md`).

**Constraints and invariants**

- Dataset rows, labels, predictions, and trained models never leave the browser.
- Strict TypeScript, Bun only, TSDoc on all exported symbols (`specification/standards-and-documentation.md`).
- Native `<progress>`, `<details>`, and `<summary>` elements, WCAG 2.2 AA, British English, and `@nanostores/i18n` localisation (`specification/COMPONENTS.md` §1, §7, §8).
- Never read `../web-ml/src/**` or `../web-ml/specification/internals/`; never modify `../web-ml`, `node_modules/`, or `bun.lock`.

## Required reading

- `specification/COMPONENTS.md` §3–§10; `specification/visual-design.md` §1.1, §3–§6 — Lit component, token, draft styling, and Storybook rules for T5.
- `specification/workflow-steps.md` §3.5; `specification/state-and-storage.md` §4–§7; `specification/app-state-and-navigation.md` §6–§7 — training lifecycle, progress throttling, locks, and reload recovery.
- `../web-ml/specification/public-api/current-limitations.md` L9–55, L269–339 (worker/WASM graph deployment, non-isolated fallback, nested CV limitations).
- `../web-ml/specification/public-api/metrics.md` L11–89; `../web-ml/specification/public-api/timing.md` L11–41.
- `node_modules/web-ml/dist/src/training/types.d.ts` L22–37 (`DatasetProvider`), L50–155 (`TrainingRequest`), L303–330 (`TrainingMetrics`), L484–545 (`TrainingEvent`, `TrainingPhase`, `TrainingErrorCode`, `TrainingRun`), L610 (`TrainingClient.train`).
- `node_modules/web-ml/dist/src/training/training-client.d.ts` L15 (`createTrainingClient`).
- `node_modules/web-ml/dist/src/training/cross-validation.d.ts` L1–174 (`nestedCrossValidate`, `NestedCrossValidationRequest`, `NestedCVEvent`, `NestedCrossValidationResult`).
- `node_modules/web-ml/dist/src/types.d.ts` L66–142 (`Classifier`: `classes_`, `predict`, `predictProba`, `toJSON`); `node_modules/web-ml/dist/src/metrics/classification.d.ts` (`accuracyScore`, `f1Score`, `logLoss`).
- `specification/mockups/ui-scaffold/drafts/03-6_train-models-5-train.html` — updated in T5 to include the single `<progress>` bar and `<details>`/`<summary>` message log.

## Codebase context

- **Relevant specifications:** `specification/machine-learning-orchestrator.md` (stub), `specification/workflow-steps.md` §3.5, `specification/state-and-storage.md` §4–§7, `specification/data-ingestion.md` §6.
- **Relevant implementation:** `scripts/build-assets.ts`, `scripts/server.ts`, `scripts/static-server.ts`, `public/_headers`, `src/common/storage/db.ts` (`model_results` L32), `src/common/storage/indexeddb-dataset-provider.ts`, `src/stores/app.store.ts`, `src/stores/reconciler.ts`, `src/stores/dataset.store.ts`, `src/features/data/load-dataset.ts`, `src/features/data/app-data-view.ts`, `src/features/target/app-target-view.ts`, `src/features/models/app-model-builder-view.ts`.
- **Verified `web-ml@0.1.0` contracts and contradictions affecting Phase 3:**
    1. **`nestedCrossValidate` requires `searchSpace` & `strategy` (`dist/src/training/cross-validation.d.ts` L43–84), while Hyperparameter Tuning is in Phase 7:** `NestedCrossValidationRequest<A>` has required fields `searchSpace: TuningSearchSpace<A>` and `strategy: TuningStrategy`. Without a `web-ml` change (making `searchSpace` optional or adding a non-tuning `crossValidate` export), Phase 3 must either synthesise a 1-trial single-point `searchSpace` from the fixed `options` or gate Nested CV until Phase 7.
    2. **`nestedCrossValidate` runs its outer loop on the calling thread and returns NO fitted model (`current-limitations.md` L301–302, `cross-validation.d.ts` L103–116):** Calling `nestedCrossValidate` on the UI thread would block the browser during synchronous outer-fold scoring; therefore, Phase 3 must invoke `nestedCrossValidate` inside `samata-ml`'s integration worker. Furthermore, because `nestedCrossValidate` discards all fitted fold models and returns `NestedCrossValidationResult<A>` (`folds`, `meanScore`, `standardDeviation`, `metrics`) instead of a `Classifier`, Phase 3's stored `ResultEnvelope` must distinguish `'one_shot'` results (which include `modelJson: toJSON()`, test confusion matrix, and estimator diagnostics) from `'nested_cv'` results (or perform an explicit final refit on full data after `nestedCrossValidate`).
    3. **Different event streams (`TrainingEvent` vs `NestedCVEvent`):** `createTrainingClient().train()` yields `TrainingEvent` (`phase`, `progress`, `tuning-progress`, `warning`, `completed`, `cancelled`, `failed`), whereas `nestedCrossValidate()` yields `NestedCVEvent` (`outer-fold-start`, `inner-progress` wrapping `TrainingEvent`, `outer-fold-complete`, `completed`, `cancelled`, `failed`). Both must be normalised into a single monotonic percentage (`0..100` or `null` indeterminate) for the `<progress>` bar and timestamped entries for the `<details>`/`<summary>` message log.
    4. **Storage of message log vs `localStorage` quota (`state-and-storage.md` §2, §4.1):** `localStorage` only stores compact `TrainingProgress` (`percent: number | null`, `statusMessage: string`, `stage`, `phase`); the full message log array lives in the in-memory `$trainingSession` store during training (bounded to $\le 250$ milestone/coalesced entries) and is persisted to IndexedDB `model_results` upon completion.
    5. **Per-view confirmation handlers (`app-target-view.ts` and `app-data-view.ts`):** No shared confirmation service exists; target change (`src/features/target/app-target-view.ts` L230–298) and Change Dataset (`src/features/data/app-data-view.ts` L456–487) each own a `<dialog>` and must abort local training, check `samata-ml:training:{num}` across tabs, and delete `model_results` before discarding state.
- **Tests and commands:** Baseline `bun run check` passes 220 tests across 31 files. `tests/storage-db.test.ts` (L43), `tests/state-and-storage.test.ts` (L342, L563–813, L901), and `tests/column-eligibility.test.ts` (L7–70) must be updated in the tasks that touch `TrainingProgress`, `ModelRecord`, and `IndexedDBAdapter`.
- **Web guidance:** `progress`, `accessibility` — native `<progress>` (omit `value` when indeterminate), native `<details>` and `<summary>` where `<summary>` shows the latest status message and expanding `<details>` reveals an ordered `<ol>` of log messages; `role="status" aria-live="polite"` announces milestone transitions only (never every epoch tick or `<details>` toggle).
- **Visual reference:** `specification/mockups/ui-scaffold/03-3_train-models-2-select-features.html` — `src/styles/train-model.styles.ts`; inner content follows updated `specification/mockups/ui-scaffold/drafts/03-6_train-models-5-train.html` (draft-only under `visual-design.md` §1.1).
- **Domain skills:** `lit-component-implementer` for T5.
- **Assumptions requiring verification:** Resolution of how `nestedCrossValidate` runs in Phase 3 before Phase 7 tuning exists (see _Risks and open questions_).

## Technical decisions

| Decision                                             | Chosen approach and rationale                                                                                                                                                                                                                                                                                                                        | Rejected alternative / trade-off                                                                                                      |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| D1 Runtime delivery                                  | Copy `node_modules/web-ml/dist/` unchanged to `/vendor/web-ml/<revision>/` and dynamically import `/vendor/web-ml/<revision>/index.js` inside the integration worker; serve COOP/COEP/CORP and `application/wasm` in dev and production (`current-limitations.md` L325–332).                                                                         | Bundling `web-ml` into `app.js` breaks relative worker and WASM URLs inside `web-ml`.                                                 |
| D2 Single `<progress>` + `<details>`/`<summary>` log | Render one `<progress>` element above a `<details>` element whose `<summary>` displays the latest localised status message and whose body renders `<ol class="training-log">` of all milestone/phase/fold/warning/completion messages.                                                                                                               | Multiple progress bars or separate status/warning panels clutter Section 5 and do not provide a chronological training log.           |
| D3 Log state placement                               | Keep `ModelRecord.progress` in `localStorage` compact (`{ percent: number \| null; statusMessage: string; stage: TrainingStage; phase: TrainingPhase \| null }`); store `logEntries: readonly TrainingLogEntry[]` in `$trainingSession` (`src/stores/training.store.ts`) during training and in IndexedDB `ResultEnvelope.logEntries` on completion. | Writing an growing array of log messages to `localStorage` on every tick risks quota errors and jank.                                 |
| D4 Worker execution for both modes                   | Run both `createTrainingClient().train()` and `nestedCrossValidate()` inside `src/features/models/training/training.worker.ts` so `nestedCrossValidate`'s outer-fold loop and test evaluation never block the main UI thread.                                                                                                                        | Calling `nestedCrossValidate()` on the main thread blocks UI rendering during outer-fold scoring (`current-limitations.md` L301–302). |
| D5 Locks and durability                              | Acquire `samata-ml:ingestion` (`shared`) then `samata-ml:training:{num}` (`exclusive`, `ifAvailable: true`); write the validated `ResultEnvelope` to IndexedDB `model_results` before calling `trainingSucceeded`.                                                                                                                                   | Marking `trained` before IndexedDB persistence completes leaves broken state on write failure or tab close.                           |

### Interfaces and behaviour

#### A. Progress and message log contract

```ts
export type TrainingStage = 'preparing' | 'fit' | 'nested-cv' | 'evaluating' | 'saving';

export interface TrainingLogEntry {
	id: number;
	timestampMs: number;
	level: 'info' | 'warning' | 'error';
	message: string;
}

export interface TrainingProgress {
	percent: number | null;
	stage: TrainingStage;
	phase: TrainingPhase | null;
	statusMessage: string;
}
```

- `src/features/models/training/progress.ts` normalises both `TrainingEvent` (one-shot) and `NestedCVEvent` (nested CV) into `{ progress: TrainingProgress; logEntry?: TrainingLogEntry }`:
    - Phase transitions (`queued`, `loading-data`, `initializing`, `training`, `finalizing`), outer-fold starts/completions (`outer-fold-start`, `outer-fold-complete`), warnings (`reduced-performance-mode`, `worker-retried`), and terminal states append a new `TrainingLogEntry` and update `statusMessage`.
    - High-frequency `progress` epoch ticks update `percent` (`0..100`, monotonic within a run) and update the latest `statusMessage` without appending thousands of duplicate log lines (milestone ticks at 25%, 50%, 75%, 100% append log entries).

#### B. Lit component API (`<app-training-progress>`)

- **Tier:** 2 (Presentational), `src/features/models/app-training-progress.ts`, tag `app-training-progress`.
- **Properties (`attribute: false`):** `progress: TrainingProgress | null = null`, `logEntries: readonly TrainingLogEntry[] = []`, `logOpen = false`, `status: 'idle' | 'running' | 'cancelling' | 'failed' | 'cancelled' | 'complete' = 'idle'`, `durationMs: number | null = null`, `error = ''`, `labels: ProgressLabels = DEFAULT_PROGRESS_LABELS`.
- **Events (`bubbles: true, composed: true`):**
    - `app-training-cancel`: `detail: Record<string, never>`
    - `app-training-log-toggle`: `detail: { open: boolean }`
    - `app-training-view-results`: `detail: Record<string, never>`
- **DOM structure:**
    - Single `<progress>` element (`value=${progress.percent}` when determinate `number`, omitted `value` attribute when `percent === null`).
    - Live region `<p class="visually-hidden" role="status" aria-live="polite">` announcing milestone messages once; `<p role="alert">` on failure.
    - `<details ?open=${this.logOpen} @toggle=${this.handleLogToggle}>` with `<summary>${latestStatusMessage}</summary>` and `<ol class="training-log">` listing `logEntries` in chronological order.
    - Action buttons: `Cancel Training` while `running`; `View Results` (enabled when `status === 'complete'`, completing Section 5 and advancing to Section 6 for Phases 4–6).
- **Stories (`src/features/models/app-training-progress.stories.ts`, `src/features/models/app-model-builder-view.stories.ts`):** `Queued`, `RunningCollapsedLog`, `RunningExpandedLog`, `NestedCvProgress`, `Cancelling`, `Failed`, `Cancelled`, `Complete`, `LongLabel`, `RTL`; builder `Training`.

## Specification changes

- [ ] `specification/machine-learning-orchestrator.md` — Document runtime deployment, worker protocol, `PartitionDatasetProvider`, `createTrainingClient().train` and `nestedCrossValidate` invocation, lock order, progress/log normalisation, and `ResultEnvelope` storage; status stub → implemented.
- [ ] `specification/workflow-steps.md` §3.5 — Single `<progress>` bar with `<details>`/`<summary>` expandable message log, cancellation, and `View Results` transition; status remains partial.
- [ ] `specification/state-and-storage.md` §3–§7 — Updated `TrainingProgress`, `ResultEnvelope` validation in reconciler, and shared `samata-ml:ingestion` lock during training; status remains draft.
- [ ] `specification/ARCHITECTURE.md` — Precompiled `web-ml` worker/WASM graph delivery and COOP/COEP/CORP headers across dev and production; status remains partial.
- [ ] `specification/components/training-progress.md` (new) & `specification/README.md` — Closed API, events, `<details>`/`<summary>` log semantics, stories, and accessibility rules for `app-training-progress`; status implemented.
- [ ] `specification/TODO.md`, `specification/HUMAN.md` — Resolve TODO-04, TODO-21, TODO-33, TODO-50, TODO-51.

## Implementation tasks

### T1 — Deploy prebuilt `web-ml` worker/WASM graph and isolation headers

- **Depends on:** None
- **Risk:** needs care — relocating `node_modules/web-ml/dist/` must preserve relative worker and WASM URLs across all three browsers.
- **Likely files:** `scripts/build-model-assets.ts`, `scripts/build-assets.ts`, `scripts/server.ts`, `scripts/static-server.ts`, `public/_headers`, `tests/fixtures/training/runtime.worker.ts`, `tests/model-assets.test.ts`, `tests/training-runtime.e2e.ts`
- **Must not touch:** `node_modules/`, `bun.lock`, `src/`
- **Implementation:** Extend `scripts/build-model-assets.ts` to copy `node_modules/web-ml/dist/` (`*.js`, `wasm/libsvm.js`, `wasm/libsvm.wasm`, `wasm/LIBSVM-COPYRIGHT`) to `/vendor/web-ml/<revision>/` and record `runtimeUrl` in `/models/index.json`. Add COOP `same-origin`, COEP `require-corp`, CORP `same-origin`, and `application/wasm` MIME support to `scripts/server.ts` and `scripts/static-server.ts`. Verify worker training and cancellation in Chromium, Firefox, and WebKit.
- **Acceptance criteria:**
    - [ ] `WML-P3-ASSET-1` — Dev and production builds serve `/vendor/web-ml/<revision>/index.js` and adjacent workers/WASM with `text/javascript` and `application/wasm` MIME types and COOP/COEP/CORP headers; `.d.ts` and package source files are excluded.
    - [ ] `WML-P3-ASSET-2` — In Chromium, Firefox, and WebKit, a module worker dynamically imports `runtimeUrl` and completes and cancels `createTrainingClient().train()` runs.
- **Verification:** `bun test tests/model-assets.test.ts`; `bun run test:e2e tests/training-runtime.e2e.ts`; `bun run check`; `bun run build`.
- **Progress:** [ ] Not started

### T2 — Implement dataset preparation, train-fitted preprocessing, and `PartitionDatasetProvider`

- **Depends on:** T1
- **Risk:** needs care — imputation and one-hot vocabularies must be fitted on training rows only to prevent data leakage.
- **Likely files:** `src/features/models/training/prepare-classification.ts`, `src/features/models/training/partition-provider.ts`, `src/features/models/training/types.ts`, `tests/classification-preparation.test.ts`, `tests/partition-provider.test.ts`
- **Must not touch:** `src/common/storage/indexeddb-dataset-provider.ts`, `tests/dataset-provider.test.ts`, `src/features/data/ingestion/`
- **Implementation:** Implement paged row reading from IndexedDB `raw_records`, missing-target row exclusion, stratified 80/20 splitting for `one_shot` (and full-dataset provider for `nested_cv`), train-fitted mean imputation and one-hot encoding, and `PartitionDatasetProvider implements DatasetProvider`.
- **Acceptance criteria:**
    - [ ] `WML-P3-DATA-1` — Stratified splits are disjoint and deterministic for a fixed seed; missing targets are dropped and counted; held-out test values never influence training means or one-hot categories.
    - [ ] `WML-P3-DATA-2` — `PartitionDatasetProvider.load` populates caller-allocated `Float64Array` buffers of length `sampleCount * featureCount` and `sampleCount * targetCount`, honours `AbortSignal`, and reports monotonic `onProgress`.
- **Verification:** `bun test tests/classification-preparation.test.ts tests/partition-provider.test.ts tests/dataset-provider.test.ts`; `bun run check`.
- **Progress:** [ ] Not started

### T3 — Normalise `TrainingEvent` and `NestedCVEvent` into progress and `<details>` log entries, and define `ResultEnvelope` storage

- **Depends on:** T2
- **Risk:** needs care — must unify two distinct `web-ml` event schemas (`TrainingEvent` and `NestedCVEvent`) and update all typechecked test fixtures touching `TrainingProgress`, `ModelRecord`, and `StoredModelResult`.
- **Likely files:** `src/types/state.ts`, `src/types/model-result.ts`, `src/common/storage/db.ts`, `src/stores/app.store.ts`, `src/stores/persister.ts`, `src/stores/training.store.ts`, `src/features/models/training/progress.ts`, `src/features/models/training/protocol.ts`, `src/features/models/training/result-repository.ts`, `tests/training-progress.test.ts`, `tests/training-protocol.test.ts`, `tests/model-results.test.ts`, `tests/storage-db.test.ts`, `tests/state-and-storage.test.ts`, `tests/dataset-resources.test.ts`, `tests/column-eligibility.test.ts`, `tests/visual-parity/fixtures.ts`, `tests/visual-parity.e2e.ts`, `tests/a11y.e2e.ts`, `tests/models-overview.e2e.ts`, `tests/target-selection.e2e.ts`
- **Must not touch:** `src/router/`, `src/features/data/ingestion/`
- **Implementation:** Update `TrainingProgress` and `ModelRecord` (`configurationRevision`, `resultRevision`) in `src/types/state.ts` (updating all 8 test/fixture files that construct `ModelRecord` or `TrainingProgress`), define `ResultEnvelope` (`src/types/model-result.ts`) and `result-repository.ts` (updating `tests/storage-db.test.ts`), create `$trainingSession` (`src/stores/training.store.ts`), and implement the event/log normaliser and worker protocol guards.
- **Acceptance criteria:**
    - [ ] `WML-P3-EVENT-1` — Every `TrainingEvent` and `NestedCVEvent` variant produces a valid `TrainingProgress` snapshot (`percent: 0..100 | null`, `statusMessage`) and bounded chronological `TrainingLogEntry` items; every `TrainingErrorCode` maps to a localised message key.
    - [ ] `WML-P3-EVENT-2` — `ResultEnvelope` records (`one_shot` and `nested_cv`) round-trip in IndexedDB `model_results` with `logEntries` preserved; `bun run check` passes across all unit and E2E test fixtures.
- **Verification:** `bun test tests/training-progress.test.ts tests/training-protocol.test.ts tests/model-results.test.ts tests/storage-db.test.ts tests/state-and-storage.test.ts`; `bun run check`.
- **Progress:** [ ] Not started

### T4 — Execute `createTrainingClient().train()` and `nestedCrossValidate()` in the integration worker and wire service locks

- **Depends on:** T1, T2, T3
- **Risk:** needs care — cross-tab locks (`samata-ml:ingestion` shared + `samata-ml:training:{num}` exclusive), cancellation, and per-view discard handlers (`app-target-view.ts`, `app-data-view.ts`) must coordinate without deadlocks.
- **Likely files:** `src/features/models/training/training.worker.ts`, `src/features/models/training/classifier-adapters.ts`, `src/features/models/training/training-service.ts`, `src/stores/reconciler.ts`, `src/stores/dataset.store.ts`, `src/features/data/load-dataset.ts`, `src/features/data/app-data-view.ts`, `src/features/target/app-target-view.ts`, `scripts/build-assets.ts`, `tests/classifier-adapters.test.ts`, `tests/training-service.test.ts`, `tests/reconciler-indexeddb.test.ts`, `tests/state-and-storage.test.ts`, `tests/column-eligibility.test.ts`, `tests/classification-training.e2e.ts`
- **Must not touch:** `node_modules/`, `src/router/`, `src/features/data/ingestion/`
- **Implementation:** Implement `training.worker.ts` and `classifier-adapters.ts` invoking `createTrainingClient().train()` (with `accuracyScore`, `f1Score`, `logLoss` evaluation on the held-out test split) and `nestedCrossValidate()`. Implement `training-service.ts` (`startModelTraining`, `cancelModelTraining`, `invalidateModelResults`), update `reconciler.ts` to validate `ResultEnvelope`, and wire target-change (`app-target-view.ts`) and dataset-change (`app-data-view.ts`) confirmation dialogs to abort local training, check cross-tab training locks, and delete `model_results`.
- **Acceptance criteria:**
    - [ ] `WML-P3-TRAIN-1` — All classifiers complete one-shot training and evaluation in the worker using options from Phase 1 and setup from Phase 2; `ResultEnvelope` is written to IndexedDB before `trainingSucceeded` marks the model `trained`.
    - [ ] `WML-P3-TRAIN-2` — Cancelling a run aborts the worker, releases both Web Locks, writes no result, and returns the model to `draft`; target-change and Change Dataset abort local runs or display `"Training in another tab"` when locked by another tab.
- **Verification:** `bun test tests/classifier-adapters.test.ts tests/training-service.test.ts tests/reconciler-indexeddb.test.ts tests/state-and-storage.test.ts tests/column-eligibility.test.ts`; `bun run test:e2e tests/classification-training.e2e.ts`; `bun run check`; `bun run build`.
- **Progress:** [ ] Not started

### T5 — Render `<app-training-progress>` with single `<progress>` bar and `<details>`/`<summary>` log in Section 5

- **Depends on:** T3, T4
- **Risk:** needs care — live-region announcements must not spam screen readers when `<details>` toggles or epoch progress updates.
- **Likely files:** `src/features/models/app-training-progress.ts`, `src/features/models/app-training-progress.stories.ts`, `src/features/models/app-model-builder-view.ts`, `src/features/models/app-model-builder-view.stories.ts`, `src/features/models/app-models-view.ts`, `specification/mockups/ui-scaffold/drafts/03-6_train-models-5-train.html`, `tests/training-panels.e2e.ts`
- **Must not touch:** `css/root.css`, `src/features/models/app-model-card.ts`
- **Implementation:** Update draft `03-6_train-models-5-train.html` to show a single `<progress>` element and `<details>`/`<summary>` message log. Implement `<app-training-progress>`, wire it into Section 5 of `<app-model-builder-view>`, persist `<details>` open state in `model.ui.trainingLogOpen`, and add co-located Storybook stories and three-browser E2E tests.
- **Acceptance criteria:**
    - [ ] `WML-P3-UI-1` — Section 5 displays a single native `<progress>` bar and a `<details>`/`<summary>` element whose `<summary>` shows the latest status message and whose expanded body shows the complete chronological training log.
    - [ ] `WML-P3-UI-2` — Once training completes, `<progress value="100" max="100">` is complete, total duration is displayed, and `View Results` enables and completes Section 5 on click; RTL, long-label, keyboard, 320 px, 200% zoom, forced-colours, and reduced-motion checks pass.
    - [ ] `WML-P3-UI-3` — Co-located `app-training-progress.stories.ts` and updated `app-model-builder-view.stories.ts` pass `bun run test:stories` (axe) in Chromium, Firefox, and WebKit.
- **Verification:** `bun run test:e2e tests/training-panels.e2e.ts tests/visual-parity.e2e.ts tests/a11y.e2e.ts`; `bun test tests/style-tokens.test.ts`; `bun run test:stories`; `bun run check`.
- **Progress:** [ ] Not started

### T6 — Sync specifications for Phase 3

- **Depends on:** T1, T2, T3, T4, T5
- **Risk:** routine
- **Likely files:** `specification/machine-learning-orchestrator.md`, `specification/workflow-steps.md`, `specification/state-and-storage.md`, `specification/ARCHITECTURE.md`, `specification/components/training-progress.md`, `specification/COMPONENTS.md`, `specification/README.md`, `specification/TODO.md`, `specification/HUMAN.md`, `specification/plans/README.md`, `specification/plans/web-ml-phase-3-model-training.md`
- **Must not touch:** `src/`, `tests/`, `specification/mockups/`
- **Implementation:** Apply every item under _Specification changes_ and verify with `bun run plans:check`.
- **Acceptance criteria:**
    - [ ] Every item under _Specification changes_ is applied and ticked.
    - [ ] `bun run plans:check` and `bun run plans:task specification/plans/web-ml-phase-3-model-training.md --check-complete` pass.
- **Verification:** `bun run plans:check specification/plans/web-ml-phase-3-model-training.md`; `bun run plans:task specification/plans/web-ml-phase-3-model-training.md --check-complete`; `bun run check`.
- **Progress:** [ ] Not started

## Verification and definition of done

- [ ] All task acceptance criteria met with test names starting with `WML-P3-*`.
- [ ] `bun run check`, `bun run build`, `bun run test:stories`, and Playwright E2E tests pass in Chromium, Firefox, and WebKit.
- [ ] `bun run format <changed files>` run on all edited files.
- [ ] Every _Specification changes_ item is ticked and synced.

## Risks and open questions

- **Blocking:** Resolve two dependencies before transitioning Phase 3 to `ready-for-review`: (1) Land the upstream `web-ml` `crossValidate` export (recommended over mutating `nestedCrossValidate`) so Phase 3 can execute fixed-hyperparameter $k$-fold cross-validation (`folds: trainingSetup.outerFolds`) when `hyperparameters.mode === 'manual'`, reserving `nestedCrossValidate` for Phase 7 when `hyperparameters.mode === 'tuning'`. (2) _Resolved by the user on 2026-11-19:_ `web-ml` runs every evaluation fold; `samata-ml` never orchestrates folds or computes metrics. This plan must therefore be revised once `web-ml` publishes WR-7 (per-fold preprocessing pipeline, replacing T2's `samata-ml`-fitted imputation and one-hot encoding so preprocessing is fitted inside every fold) and WR-10 (One-Shot stratified split helper) from the [umbrella ledger](web-ml-classification-integration.md#scope); `ResultEnvelope` gains a required `evaluation` field in Phase 4 T3, and Phase 4–6 consume WR-1…WR-6 and WR-8 through the same worker.
- **Non-blocking:** Confirmed resolutions adopted in this plan: (1) One-Shot Training uses the fixed 80% train / 20% test stratified holdout split (`testRatio: 0.2, randomState: 42`) with imputation and one-hot encoding fitted strictly on the 80% training partition; (2) `localStorage` persists only compact `{ percent, statusMessage, stage, phase }` while the bounded chronological `logEntries` array for `<details>`/`<summary>` lives in `$trainingSession` during training and in IndexedDB `ResultEnvelope.logEntries` on completion, with `role="status" aria-live="polite"` announcing milestone transitions only.
- **Non-blocking:** If `web-ml` rejects non-isolated worker training despite `current-limitations.md` L325–326, T1 records an Escalation; `samata-ml` ships COOP/COEP/CORP headers in both dev and production.
- **Non-blocking:** Draft `03-6_train-models-5-train.html` awaits human visual styling and promotion (`specification/HUMAN.md`).

## Escalations

None.

## Review fixes

None.

## Implementation and verification log

| When (UTC)           | Task | Agent (model)                            | Outcome / commands / evidence                                                                                                                                                  |
| -------------------- | ---- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-11-17T21:23:45Z | —    | Google Antigravity (Gemini 4 Argon High) | Split Phase 3 from `web-ml-classification-integration.md`; scout-verified `createTrainingClient().train`, `nestedCrossValidate`, event contracts, and lock/confirmation seams. |
| 2026-11-18T08:34:14Z | —    | Google Antigravity (Gemini 4 Argon High) | Adopted `crossValidate` recommendation, fixed 80/20 `one_shot` split, and `<details>`/`<summary>` message-log storage/live-region policy.                                      |

## Plan review history

| Reviewed (UTC) | Agent (model) | Decision | Findings |
| -------------- | ------------- | -------- | -------- |

## Change log

| When (UTC)           | Change                                                        | Reason                                                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-17T21:23:45Z | Initial draft                                                 | Created Phase 3 plan (model training execution with a single `<progress>` bar and `<details>`/`<summary>` message log) from the multi-phase split of `web-ml-classification-integration.md`. |
| 2026-11-18T08:34:14Z | Adopt split, log, and `crossValidate` API                     | User confirmed one-shot split policy, `<details>`/`<summary>` log persistence/a11y policy, and requested an upstream `web-ml` plan for non-tuning CV (`crossValidate`).                      |
| 2026-11-19T08:47:35Z | Recorded fold-ownership decision; renumbered cross-references | User decided `web-ml` runs folds (umbrella WR ledger); results split into Phases 4–6 and tuning renumbered to Phase 7. Blocking item (2) resolved; tasks T2/T4 await WR-7/WR-10.             |
