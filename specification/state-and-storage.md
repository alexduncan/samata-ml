# Application State Persistence

**Status:** draft — open questions in §11 (§11.5 is answered: Web Locks is Baseline Widely available). Implemented: §3 schema, §4 persister (including synchronous discrete triggers and progress throttle, except save-failure notification), §6 checks 1–8, §8 validation and read-only mode. Target: §7 multi-tab sync, §8 migrations, and ingestion ordering. Code that differs from this spec is listed in [Known gap](README.md#known-gaps) 14.

> **Source of truth:** [workflow-steps.md](workflow-steps.md). Navigation, routing, step behaviour and scroll memory are specified in [app-state-and-navigation.md](app-state-and-navigation.md) (now the hybrid router + store design). This document specifies **how state is stored**: keys, schema, write scheduling, IndexedDB reconciliation, multi-tab behaviour, versioning.
>
> Formerly `plans/store-pipline-state.md`; moved here 2026-11-12. Still a draft until the open questions in [§11](#11-open-questions) are answered.

## 1. Purpose

Persisted state exists so that **reloading the tab, or opening the base URL in a new tab, shows exactly the UI the user last saw** (app-state-and-navigation.md goal G3), without keeping dataset rows in reactive application memory.

It stores _what the user has done and chosen_. _Where the user is_ comes from the URL; the one exception is `resumePath`, which is what `/` resolves to.

## 2. Storage Split

| Data                                                                                     | Where                                                                | Why                                                                                                     |
| :--------------------------------------------------------------------------------------- | :------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------ |
| Workflow state, UI selections, model records, headline metrics                           | `localStorage` key `samata-ml:state`                                 | Small, needed synchronously at startup before first render and before routing                           |
| Scroll snapshots                                                                         | `localStorage` key `samata-ml:scroll`                                | Written far more often than the rest; separate key keeps writes small and lets multi-tab sync ignore it |
| Dataset rows                                                                             | IndexedDB `samata-db` → `raw_records`                                | Large, streamed in slices ([data-ingestion.md](data-ingestion.md))                                      |
| Column statistics (histograms, category counts, median)                                  | IndexedDB `samata-db` → `metadata`                                   | Unbounded (up to 100 bins × columns, arbitrary category counts)                                         |
| Detailed training results (confusion matrices, curves, predictions, feature importances) | IndexedDB `samata-db` → `model_results`, key `[datasetId, modelNum]` | Large and only needed on the results screens                                                            |

`localStorage` is synchronous and quota-limited (~5 MB); it MUST NOT hold dataset rows, column statistics or per-row results. A `localStorage` write failure MUST NOT break the app (§4.3).

## 3. Persisted Schema

```typescript
export const STATE_STORAGE_KEY = 'samata-ml:state';
export const SCROLL_STORAGE_KEY = 'samata-ml:scroll';
export const STORAGE_VERSION = 1;

/** Canonical column vocabulary for UI and state; inference details live in data-ingestion.md. */
export type ColumnType = 'numeric' | 'categorical' | 'boolean' | 'datetime' | 'text';

export interface ColumnSummary {
	name: string;
	type: ColumnType;
	missingCount: number;
}

/** Lightweight dataset identity. Rows and statistics live in IndexedDB. */
export interface DatasetSummary {
	id: string;
	name: string;
	source: 'sample' | 'upload';
	/** Catalogue id for a sample dataset; uploads omit this property. */
	sampleId?: string;
	rowCount: number;
	columns: ColumnSummary[];
}

export type WorkflowPath = '/data' | '/target' | '/models' | `/models/${number}` | '/results';

export type ModelSectionId =
	| 'choose-model'
	| 'select-features'
	| 'configure-model'
	| 'configure-training'
	| 'training'
	| 'results';

export type HyperparameterValue = number | string | boolean | number[] | null;

export interface HyperparameterConfig {
	mode: 'manual' | 'tuning';
	/** Sparse canonical overrides: only options that differ from the default; inactive ones are kept. */
	values: Record<string, HyperparameterValue>;
	tuningSearchSpace?: Record<string, HyperparameterValue[]>;
}

/** Canonical training setup in memory. The two CV fold counts are equal. */
export type ValidationMethodology =
	| { type: 'one_shot'; testRatio: 0.2; randomState: 42 }
	| { type: 'nested_cv'; outerFolds: number; innerFolds: number; randomState: 42 };

export type MulticlassStrategy = 'native' | 'one-vs-rest' | 'one-vs-one';

export interface TrainingProgress {
	percent: number;
	currentFold?: number;
	totalFolds?: number;
	statusMessage: string;
}

export interface TrainingError {
	code: 'TRAINING_FAILED' | 'TRAINING_CANCELLED' | 'TRAINING_INTERRUPTED_BY_RELOAD';
	message: string;
	timestamp: number;
	details?: string;
}

export interface TrainingTimings {
	/** Per-step rows for nested CV / hyperparameter tuning, plus a total. */
	steps: { label: string; durationMs: number }[];
	totalMs: number;
}

export type ModelStatus = 'draft' | 'training' | 'trained';

/** One entry per model; `num` is the `{num}` in `/models/{num}`. */
export interface ModelRecord {
	num: number;
	createdAt: number;
	status: ModelStatus;
	completedSteps: ModelSectionId[];

	/** Section 1 – Choose Model. `web-ml` model id. */
	modelId: string | null;
	/** Section 2 – Select Features. Never contains the target. */
	features: string[];
	/** Section 2 – model-specific extras, e.g. one-hot encoding, regularisation. */
	modelOptions: Record<string, HyperparameterValue>;
	/** Section 3 – Configure Model. */
	hyperparameters: HyperparameterConfig;
	multiclass: MulticlassStrategy | null;
	/** Section 4 – Training Setup. */
	trainingSetup: ValidationMethodology | null;

	/** Section 5 – Training. */
	progress: TrainingProgress | null;
	error: TrainingError | null;
	timings: TrainingTimings | null;
	durationMs: number | null;

	/** Headline metrics for the /models table and /results; full results live in IndexedDB. */
	metrics: Record<string, number> | null;

	/**
	 * Per-model UI selections (e.g. `featureSelectionInitialised: boolean`, chart tabs).
	 * `featureSelectionInitialised` tracks whether initial eligible features were populated once
	 * on Choose Model completion, ensuring intentional user toggles (including empty selections)
	 * survive reload and reopening. Results shapes defined with the results spec.
	 */
	ui: Record<string, unknown>;
}

export interface PersistedAppState {
	version: typeof STORAGE_VERSION;
	updatedAt: number;

	onboarding: { welcomeDismissed: boolean };

	/** What `/` resolves to. Always a workflow path, never a reserved path. */
	resumePath: WorkflowPath;

	dataset: DatasetSummary | null;
	data: {
		/** Picker or preview on /data. A stored value, not derived. */
		mode: 'select' | 'preview';
		/** Column whose details <aside> is open. */
		selectedColumn: string | null;
	};

	/** Target column name. Meaningful only when `dataset !== null`. */
	target: string | null;

	models: ModelRecord[];
	/** Next `num` to allocate. Monotonic; numbers are never reused. */
	nextModelNum: number;

	/** UI selections for /results. Shape defined with the results spec. */
	results: { ui: Record<string, unknown> };
}

export interface ScrollSnapshot {
	/** window.innerWidth (CSS px) when saved. */
	viewportWidth: number;
	top: number;
	regions?: Record<string, { top: number; left: number }>;
	savedAt: number;
}

export interface PersistedScroll {
	version: typeof STORAGE_VERSION;
	/** Keys: `data:select`, `data:preview`, `target`, `models`, `models/{num}`, `results`. */
	snapshots: Record<string, ScrollSnapshot>;
}
```

Defaults on first load: `welcomeDismissed: false`, `resumePath: '/data'`, `dataset: null`, `data: { mode: 'select', selectedColumn: null }`, `target: null`, `models: []`, `nextModelNum: 1`, no scroll snapshots.

### Training Setup on the v1 wire

| In memory                                                              | JSON written to v1                                              |
| :--------------------------------------------------------------------- | :-------------------------------------------------------------- |
| `null`                                                                 | `null` (unset)                                                  |
| `{ type: 'one_shot', testRatio: 0.2, randomState: 42 }`                | `{ type: 'train_test_split', testRatio: 0.2, randomState: 42 }` |
| `{ type: 'nested_cv', outerFolds: n, innerFolds: n, randomState: 42 }` | The same `nested_cv` fields                                     |

A private codec produces fresh canonical objects on read. It supplies seed 42 for seedless historical forms and upgrades legacy `k_fold_cv` with `folds: n` to equal inner and outer counts. It accepts historical `train_test_split` only at ratio 0.2 and historical `nested_cv` only with equal counts. Counts must be finite integers from 2 through 10. Required fields must be own properties of a plain record. A supplied seed other than 42, unsafe own keys (`__proto__`, `constructor`, `prototype`), an unknown tag, or a missing or invalid shape records a malformed outcome for the owning model. Explicit `null` records an unset outcome. Both read as `null` in memory and are distinguished during reconciliation (§6).

## 4. Write Scheduling

A single **persister** subscribes to the stores and is the only code that touches `localStorage`, including startup reading and reconciliation via `readPersistedState` and `persistNow`. Components, reconcilers and actions never call `setItem`, `getItem` or `removeItem` directly.

### 4.1 Triggers

| Change                                                                                                                                                           | Write                                                                                                            |
| :--------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------- |
| `resumePath` (any workflow navigation), dataset, target, model created, section completed/re-opened, `status` change, error set, `welcomeDismissed`, `data.mode` | **Synchronous**, within the same task as the action                                                              |
| Discrete UI selections (checkbox, card select, `data.selectedColumn`, `features`, `multiclass`, `hyperparameters.mode`, `trainingSetup?.type`)                   | Synchronous                                                                                                      |
| Valid fold-count edits and free-form hyperparameter value edits                                                                                                  | Debounced ~300 ms                                                                                                |
| Training `progress` ticks                                                                                                                                        | Throttled (at most one write per second without starvation); entry into and exit from `training` are synchronous |
| Scroll snapshots (`samata-ml:scroll`)                                                                                                                            | Debounced ~150 ms; flushed before router navigation, on `visibilitychange` → `hidden` and on `pagehide`          |

The persister flushes pending valid fold edits through `flushNow()` when the document becomes hidden or on `pagehide`. The router can flush before navigation. `beforeunload` MUST NOT be relied on.

### 4.2 Rules

- Reducers/actions are pure and produce new object references; the persister serialises the resulting snapshot. In-place mutation is forbidden (COMPONENTS.md §5, app-state-and-navigation.md §1.3).
- Writes go through an injectable `Storage` interface (browser: `localStorage`; tests: in-memory mock).
- Both `writeAppStateNow` (subscription and flush) and `persistNow` (immediate write after reconciliation) use the same private v1 encoder. Encoding leaves the in-memory shape and references intact.
- Every write serialises `{ version, …, updatedAt: Date.now() }`.

### 4.3 Failure handling

`setItem` can throw `QuotaExceededError`, or `SecurityError` when storage is blocked (private modes, disabled site data). The persister MUST catch it, keep the app running from memory, and raise one non-blocking notification per document ("Progress can't be saved in this browser"). It MUST NOT retry in a tight loop. If the quota is exceeded the persister first drops `scroll` data (cheapest to lose) and retries once.

## 5. UI State Persistence Rule

> Any user-controlled UI state that is not a transient overlay MUST be persisted, and MUST live in a store with an action, not in a component's private `@state`.

This is what makes "exact same UI" enforceable as the app grows. Each new feature spec MUST add its UI state to the registry below or state why it is transient.

| UI state                                                                     | Persisted as                                 | Notes                                            |
| :--------------------------------------------------------------------------- | :------------------------------------------- | :----------------------------------------------- |
| Welcome modal dismissed                                                      | `onboarding.welcomeDismissed`                |                                                  |
| `/data` picker vs preview                                                    | `data.mode`                                  |                                                  |
| Open column-details aside                                                    | `data.selectedColumn`                        |                                                  |
| Virtual table scroll offsets                                                 | `ScrollSnapshot.regions['data-table']`       |                                                  |
| Page scroll, per step                                                        | `PersistedScroll.snapshots[key]`             | Ignored if viewport width differs                |
| Per-model section completion                                                 | `ModelRecord.completedSteps`                 | Drives `.train-step-complete` and the check icon |
| Feature initialisation state                                                 | `ModelRecord.ui.featureSelectionInitialised` | Tracks one-time population on model continue     |
| Chosen model, features, options, hyperparameters, multiclass, training setup | `ModelRecord.*`                              | Committed values                                 |
| Per-model results view                                                       | `ModelRecord.ui`                             | Defined by the section 6 spec                    |
| Compare Results view                                                         | `results.ui`                                 | Defined by the section 4 spec                    |
| Location                                                                     | URL, plus `resumePath` for `/`               |                                                  |

**Transient (never persisted):** reserved-route modals (including `/help/training-setup`; these are restored only because the URL says so), Datasheet, Upload and Model Description dialogs, focus, hover, uncommitted field text (including empty, out-of-range and native invalid fold drafts), fold errors and their live announcements, in-flight ingestion state, upload validation errors, live training progress between throttled writes.

Presentational components MUST NOT import stores (COMPONENTS.md §2). They receive the value as a property and emit an event; a connected component calls the action.

## 6. IndexedDB Reconciliation

`localStorage` and IndexedDB are separate stores that can diverge (partial "clear site data", eviction under storage pressure, an upload interrupted by reload, a second tab replacing the dataset). After reading persisted state and **before the first render**, the hydrator runs these checks in order. A failed check repairs the _smallest_ affected piece and cascades downward; it never silently invents data.

1. **Dataset present.** If `dataset !== null` but `metadata` for `dataset.id` is missing from IndexedDB, treat as `dataset = null`: clear `target`, `models`, `data.selectedColumn`, set `data.mode = 'select'`, clear non-`/data` scroll keys, and queue a notification.
2. **Orphans.** Delete IndexedDB rows, metadata and model results for any dataset id other than `dataset.id`. A partial upload (rows written, no `metadata`) is an orphan by definition.
3. **Target valid.** `target` must name an eligible column in `dataset.columns` (type ≠ `text`); otherwise `target = null` and `models = []`.
4. **Models valid.** For each model: `features ⊆ dataset.columns` (eligible, ≠ target); drop unknown features and un-complete `select-features` onward if any were dropped. A `trained` model whose `model_results` entry is missing reverts to `draft` with a `TRAINING_FAILED` error whose message explains the stored results were lost.
5. **Counters.** `nextModelNum = max(nextModelNum, max(models.num) + 1)`.
6. **Selections valid.** `data.selectedColumn` must exist in `dataset.columns`. `resumePath` is **not** corrected when it names a page that cannot currently display (for example `/models/3` after model 3 was discarded): `/` resumes there and the page shows its notification, because state never blocks navigation (app-state-and-navigation.md §4).
7. **Interrupted training.** For each model with `status === 'training'`, try `navigator.locks.request('samata-ml:training:{num}', { ifAvailable: true }, …)`. Lock acquired ⇒ nobody is training it ⇒ `recoverInterrupted` (status `draft`, `progress = null`, `TRAINING_INTERRUPTED_BY_RELOAD`; un-completes `configure-training`, `training` and `results`, returning section 4 to active). Lock unavailable ⇒ another tab is training it; leave it `training` and treat it as read-only. If the Web Locks API is missing, fall back to treating it as interrupted.
8. **Training Setup recovery.** Capture each model's decode outcome, original status and Section 4–6 completions from the decoded envelope before any repairs. Apply setup repairs after the result and lock checks. A draft with a malformed setup, or explicit `null` with a stale original Section 4–6 completion, reopens Section 4. Clear the affected completions, progress, timings, duration, metrics and stale error. Keep the error just created when trained results were lost, or the interrupted-training error. On subsequent hydration the losses and interruptions retain their diagnostics and timestamps. An original draft with malformed setup and a stale failure clears its failure even if the message matches the loss explanation. A trained model with an existing result and a training model with an active lock keep their status, completions and results, and remain read-only. A model-local malformed setup does not discard the active dataset, its row chunks or unaffected siblings and their results.
9. Persist the repaired state immediately.

**Ingestion ordering requirement.** To make check 1 and 2 safe, ingestion MUST write the new dataset under a **new** `datasetId` and delete the previous dataset only after `metadata` for the new one is written. The "clear old stores first" behaviour in the earlier preview-dataset design would destroy the user's current dataset if an upload is interrupted.

## 7. Multi-Tab Behaviour

- **Shared:** `localStorage`, IndexedDB, and (by design) `resumePath`. Opening `/` in a second tab resumes whichever workflow page was last visited in any tab.
- **Per tab:** the URL, mounted view, scroll in progress, in-flight ingestion and the training worker.
- **`storage` event on `samata-ml:state`:** other tabs re-hydrate domain state (dataset, target, models, data settings) into their stores and re-run reconciliation steps 3–6. They MUST NOT navigate because of it. If the page on screen can no longer display (the dataset changed or the model on screen was removed) it re-renders in place into the matching `.notification` of app-state-and-navigation.md §4.3. `resumePath` changes from other tabs are ignored by the receiving tab's router. `samata-ml:scroll` events are ignored.
- **Training:** a tab that starts training holds the Web Lock `samata-ml:training:{num}` for the run (§6, check 7), so a second tab loading during training does not mark it interrupted. A model training in another tab is displayed read-only with "Training in another tab".
- **Dataset replacement** in one tab invalidates the other tab's models through the `storage` event; no cross-tab locking of data is attempted.
- Last writer wins for everything else.

## 8. Versioning & Validation

- Every persisted blob has `version`. `STORAGE_VERSION` starts at `1`; the earlier `ml_app_fsm_state_v1` key and the `Pipeline` proxy design were never implemented and need no migration.
- `STORAGE_VERSION` stays `1` for Phase 1: `HyperparameterValue` only gains `null`, and no earlier release wrote option values because Section 3 never rendered, so no persisted blob changes shape. A bump would discard every user's state, because no migration exists.
- Persisted `hyperparameters.values` are validated: numbers must be finite, values are `null`, string, boolean, number or finite number array, and prototype keys (`__proto__`, `constructor`, `prototype`) are rejected; a state that fails is discarded wholesale like any other shape failure.
- Reads use a hand-written runtime shape check. JSON that fails to parse, fails envelope validation, or has a version below current without a migration falls back to fresh defaults. Training Setup decoding is a model-local exception to envelope rejection (§3, §6). The v1 wire remains compatible with the previous reader.
- A version **higher** than the running code understands (a stale tab after a deploy) yields fresh defaults in memory and puts the persister into **read-only mode** for that key for the lifetime of the document: the tab runs from memory and never overwrites newer data.
- Migrations are an ordered array of pure `(old) => new` functions with tests.

## 9. Design Rationale

**Why is the dataset not in `localStorage`?** Datasets can be large and `localStorage` is synchronous, size-limited and unsuitable for streaming or slice reads. Only a summary (id, name, size, column names/types/missing counts) is stored so the sidebar and blocked-state logic work at startup without touching IndexedDB.

**Why store `data.mode` instead of deriving it?** The old rule (`datasetId !== null && modelType === null`) conflated "dataset exists" with "user is looking at the preview". The new workflow lets the user have a dataset _and_ return to the picker, and a reload must show the same one.

**Why a separate scroll key?** Scroll updates are frequent and low-value; isolating them keeps the main blob small, avoids rewriting model data on every scroll tick, and lets multi-tab sync ignore them.

**Why store `status: 'training'` when it cannot be resumed?** It is needed to detect an interrupted run and to let a second tab know training is happening elsewhere. The old design excluded `trainingStatus` entirely, which made both impossible and meant a reload during training showed a normal-looking form with no explanation.

**Why hydrate before routing?** The router's blocked-state and resume logic must evaluate against hydrated state; otherwise a reloaded session would look empty and flash the wrong page.

**Why not a `Proxy`-based auto-persisting object?** It only observes top-level assignments, so deep edits (`models[2].features.push(...)`) would not persist, and it conflicts with the nanostores/immutable-action rule in COMPONENTS.md §5.

## 10. Inconsistencies Found and How They Are Resolved

| #   | Where                             | Inconsistency                                                                                                                                                          | Resolution                                                                                                                                                                                                                                                                                                                                          |
| :-- | :-------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Old store plan                    | Persisted `currentStep`, global `modelType`/`hyperparameters`/`selectedFeatures`                                                                                       | URL replaces `currentStep`; per-model `ModelRecord` replaces globals (workflow-steps §3)                                                                                                                                                                                                                                                            |
| 2   | Old store plan                    | Route guards **redirect** a reloaded session to the first step                                                                                                         | Navigation is never blocked or redirected by state; pages that cannot display show a `.notification` (app-state-and-navigation.md §4)                                                                                                                                                                                                               |
| 3   | Old store plan                    | `trainingStatus`, `resultsId` not persisted                                                                                                                            | Status is persisted so interruption is detectable; results are persisted in IndexedDB                                                                                                                                                                                                                                                               |
| 4   | Column type vocabularies          | Earlier specifications used different vocabularies for workflow, inference and dataset metadata.                                                                       | `src/types/state.ts` defines the canonical `ColumnType`: `numeric \| categorical \| boolean \| datetime \| text`. Inference and persisted dataset metadata use the same union; numeric integer-ness and datetime representation are statistics, not separate types. Dataset sample metadata is defined in [sample-datasets.md](sample-datasets.md). |
| 5   | preview-dataset vs data-ingestion | Single active dataset, stores `dataset`/`metadata`, key `dataset_stats`, clear-on-upload **vs** `samata-db`, `metadata`/`raw_records`, compound `[datasetId,rowIndex]` | data-ingestion is canonical; "one _active_ dataset" is a policy enforced after a successful upload (§6)                                                                                                                                                                                                                                             |
| 6   | Old store plan                    | `Pipeline.initialize()` singleton with `Proxy` state                                                                                                                   | Nanostores + actions + persister (§9)                                                                                                                                                                                                                                                                                                               |
| 7   | Old FSM plan                      | URL-paste dataset source                                                                                                                                               | Removed; workflow-steps has samples + upload only. (Sample datasets are still fetched by URL internally.)                                                                                                                                                                                                                                           |
| 8   | preview-dataset                   | Preview shown when `datasetId !== null && modelType === null`                                                                                                          | `data.mode` (§9)                                                                                                                                                                                                                                                                                                                                    |
| 9   | README / COMPONENTS               | `state-and-storage.md` was referenced but did not exist                                                                                                                | Resolved 2026-11-12: this file moved here                                                                                                                                                                                                                                                                                                           |

## 11. Open Questions

1. ~~Promote this file and rename the navigation spec~~ — done 2026-11-12.
2. Should upload content be identified by a content hash so re-uploading the same file keeps downstream state? (Currently each upload gets a new `id`, so it counts as a different dataset.)
