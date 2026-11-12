# Application State Persistence

> **Source of truth:** [workflow-steps.md](../workflow-steps.md). Navigation, routing, step behaviour and scroll memory are specified in [finite-state-machine.md](./finite-state-machine.md) (now the hybrid router + store design). This document specifies **how state is stored**: keys, schema, write scheduling, IndexedDB reconciliation, multi-tab behaviour, versioning.
>
> The README links a `state-and-storage.md` that does not exist yet. Once this document is approved it should be promoted to `specification/state-and-storage.md` (see [§11](#11-open-questions)).

## 1. Purpose

Persisted state exists so that **reloading the tab, or opening the base URL in a new tab, shows exactly the UI the user last saw** (finite-state-machine.md goal G3), without keeping dataset rows in reactive application memory.

It stores *what the user has done and chosen*. *Where the user is* comes from the URL; the one exception is `resumePath`, which is what `/` resolves to.

## 2. Storage Split

| Data | Where | Why |
| :--- | :--- | :--- |
| Workflow state, UI selections, model records, headline metrics | `localStorage` key `samata-ml:state` | Small, needed synchronously at startup before first render and before routing |
| Scroll snapshots | `localStorage` key `samata-ml:scroll` | Written far more often than the rest; separate key keeps writes small and lets multi-tab sync ignore it |
| Dataset rows | IndexedDB `samata-db` → `raw_records` | Large, streamed in slices ([data-ingestion-and-storage-pipeline.md](./data-ingestion-and-storage-pipeline.md)) |
| Column statistics (histograms, category counts, median) | IndexedDB `samata-db` → `metadata` | Unbounded (up to 100 bins × columns, arbitrary category counts) |
| Detailed training results (confusion matrices, curves, predictions, feature importances) | IndexedDB `samata-db` → `model_results`, key `[datasetId, modelNum]` | Large and only needed on the results screens |

`localStorage` is synchronous and quota-limited (~5 MB); it MUST NOT hold dataset rows, column statistics or per-row results. A `localStorage` write failure MUST NOT break the app (§4.3).

## 3. Persisted Schema

```typescript
export const STATE_STORAGE_KEY = 'samata-ml:state';
export const SCROLL_STORAGE_KEY = 'samata-ml:scroll';
export const STORAGE_VERSION = 1;

/** Canonical column vocabulary for UI and state (see §10, inconsistency 4). */
export type ColumnType = 'numeric' | 'categorical' | 'boolean' | 'text';

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
  rowCount: number;
  columns: ColumnSummary[];
}

export type WorkflowPath =
  | '/data' | '/target' | '/models' | `/models/${number}` | '/results';

export type ModelSectionId =
  | 'choose-model'
  | 'select-features'
  | 'configure-model'
  | 'configure-training'
  | 'training'
  | 'results';

export type HyperparameterValue = number | string | boolean | number[];

export interface HyperparameterConfig {
  mode: 'manual' | 'tuning';
  values: Record<string, HyperparameterValue>;
  tuningSearchSpace?: Record<string, HyperparameterValue[]>;
}

/** Placeholder until workflow-steps "Configure Training" is specified. */
export type ValidationMethodology =
  | { type: 'nested_cv'; outerFolds: number; innerFolds: number }
  | { type: 'k_fold_cv'; folds: number }
  | { type: 'train_test_split'; testRatio: number };

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
  /** Section 4 – Configure Training. */
  trainingSetup: ValidationMethodology | null;

  /** Section 5 – Training. */
  progress: TrainingProgress | null;
  error: TrainingError | null;
  timings: TrainingTimings | null;
  durationMs: number | null;

  /** Headline metrics for the /models table and /results; full results live in IndexedDB. */
  metrics: Record<string, number> | null;

  /** Section 6 – per-model UI selections (chart tab etc.). Shape defined with the results spec. */
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

## 4. Write Scheduling

A single **persister** subscribes to the stores and is the only code that touches `localStorage`. Components and actions never call `setItem`.

### 4.1 Triggers

| Change | Write |
| :--- | :--- |
| `resumePath` (any workflow navigation), dataset, target, model created, section completed/re-opened, `status` change, error set, `welcomeDismissed`, `data.mode` | **Synchronous**, within the same task as the action |
| Discrete UI selections (checkbox, card select, `data.selectedColumn`) | Synchronous |
| Free-form field edits (hyperparameter numbers/text) | Debounced ~300 ms, plus flushed on `change`; only **committed, valid** values are stored |
| Training `progress` ticks | At most about one write per second; entry into and exit from `training` are synchronous |
| Scroll snapshots (`samata-ml:scroll`) | Debounced ~150 ms; flushed before router navigation, on `visibilitychange` → `hidden` and on `pagehide` |

`flushNow()` is exported for those lifecycle hooks. `beforeunload` MUST NOT be relied on.

### 4.2 Rules

- Reducers/actions are pure and produce new object references; the persister serialises the resulting snapshot. In-place mutation is forbidden (COMPONENTS.md §5, finite-state-machine.md §1.3).
- Writes go through an injectable `Storage` interface (browser: `localStorage`; tests: in-memory mock).
- Every write serialises `{ version, …, updatedAt: Date.now() }`.

### 4.3 Failure handling

`setItem` can throw `QuotaExceededError`, or `SecurityError` when storage is blocked (private modes, disabled site data). The persister MUST catch it, keep the app running from memory, and raise one non-blocking notification per document ("Progress can't be saved in this browser"). It MUST NOT retry in a tight loop. If the quota is exceeded the persister first drops `scroll` data (cheapest to lose) and retries once.

## 5. UI State Persistence Rule

> Any user-controlled UI state that is not a transient overlay MUST be persisted, and MUST live in a store with an action, not in a component's private `@state`.

This is what makes "exact same UI" enforceable as the app grows. Each new feature spec MUST add its UI state to the registry below or state why it is transient.

| UI state | Persisted as | Notes |
| :--- | :--- | :--- |
| Welcome modal dismissed | `onboarding.welcomeDismissed` | |
| `/data` picker vs preview | `data.mode` | |
| Open column-details aside | `data.selectedColumn` | |
| Virtual table scroll offsets | `ScrollSnapshot.regions['data-table']` | |
| Page scroll, per step | `PersistedScroll.snapshots[key]` | Ignored if viewport width differs |
| Per-model section completion | `ModelRecord.completedSteps` | Drives `.train-step-complete` and the check icon |
| Chosen model, features, options, hyperparameters, multiclass, training setup | `ModelRecord.*` | Committed values |
| Per-model results view | `ModelRecord.ui` | Defined by the section 6 spec |
| Compare Results view | `results.ui` | Defined by the section 4 spec |
| Location | URL, plus `resumePath` for `/` | |

**Transient (never persisted):** reserved-route modals (`/about`, `/privacy`, `/help`; these are restored only because the URL says so), Datasheet, Upload and Model Description dialogs, focus, hover, uncommitted field text, in-flight ingestion state, upload validation errors, live training progress between throttled writes.

Presentational components MUST NOT import stores (COMPONENTS.md §2). They receive the value as a property and emit an event; a connected component calls the action.

## 6. IndexedDB Reconciliation

`localStorage` and IndexedDB are separate stores that can diverge (partial "clear site data", eviction under storage pressure, an upload interrupted by reload, a second tab replacing the dataset). After reading persisted state and **before the first render**, the hydrator runs these checks in order. A failed check repairs the *smallest* affected piece and cascades downward; it never silently invents data.

1. **Dataset present.** If `dataset !== null` but `metadata` for `dataset.id` is missing from IndexedDB, treat as `dataset = null`: clear `target`, `models`, `data.selectedColumn`, set `data.mode = 'select'`, clear non-`/data` scroll keys, and queue a notification.
2. **Orphans.** Delete IndexedDB rows/metadata for any dataset id other than `dataset.id`. A partial upload (rows written, no `metadata`) is an orphan by definition.
3. **Target valid.** `target` must name an eligible column in `dataset.columns` (type ≠ `text`); otherwise `target = null` and `models = []`.
4. **Models valid.** For each model: `features ⊆ dataset.columns` (eligible, ≠ target); drop unknown features and un-complete `select-features` onward if any were dropped. A `trained` model whose `model_results` entry is missing reverts to `draft` with a `TRAINING_FAILED` error whose message explains the stored results were lost.
5. **Counters.** `nextModelNum = max(nextModelNum, max(models.num) + 1)`.
6. **Selections valid.** `data.selectedColumn` must exist in `dataset.columns`. `resumePath` is **not** corrected when it names a page that cannot currently display (for example `/models/3` after model 3 was discarded): `/` resumes there and the page shows its notification, because state never blocks navigation (finite-state-machine.md §4).
7. **Interrupted training.** For each model with `status === 'training'`, try `navigator.locks.request('samata-ml:training:{num}', { ifAvailable: true }, …)`. Lock acquired ⇒ nobody is training it ⇒ `recoverInterrupted` (status `draft`, `progress = null`, `TRAINING_INTERRUPTED_BY_RELOAD`). Lock unavailable ⇒ another tab is training it; leave it `training` and treat it as read-only. If the Web Locks API is missing, fall back to treating it as interrupted.
8. Persist the repaired state immediately.

**Ingestion ordering requirement.** To make check 1 and 2 safe, ingestion MUST write the new dataset under a **new** `datasetId` and delete the previous dataset only after `metadata` for the new one is written. The "clear old stores first" behaviour in the earlier preview-dataset design would destroy the user's current dataset if an upload is interrupted.

## 7. Multi-Tab Behaviour

- **Shared:** `localStorage`, IndexedDB, and (by design) `resumePath`. Opening `/` in a second tab resumes whichever workflow page was last visited in any tab.
- **Per tab:** the URL, mounted view, scroll in progress, in-flight ingestion and the training worker.
- **`storage` event on `samata-ml:state`:** other tabs re-hydrate domain state (dataset, target, models, data settings) into their stores and re-run reconciliation steps 3–6. They MUST NOT navigate because of it. If the page on screen can no longer display (the dataset changed or the model on screen was removed) it re-renders in place into the matching `.notification` of finite-state-machine.md §4.3. `resumePath` changes from other tabs are ignored by the receiving tab's router. `samata-ml:scroll` events are ignored.
- **Training:** a tab that starts training holds the Web Lock `samata-ml:training:{num}` for the run (§6, check 7), so a second tab loading during training does not mark it interrupted. A model training in another tab is displayed read-only with "Training in another tab".
- **Dataset replacement** in one tab invalidates the other tab's models through the `storage` event; no cross-tab locking of data is attempted.
- Last writer wins for everything else.

## 8. Versioning & Validation

- Every persisted blob has `version`. `STORAGE_VERSION` starts at `1`; the earlier `ml_app_fsm_state_v1` key and the `Pipeline` proxy design were never implemented and need no migration.
- Reads are wrapped in `try/catch`. JSON that fails to parse, fails the runtime shape check, or has a version below current without a migration, is discarded wholesale (fresh defaults). A hand-written type guard is used; no new dependency is introduced for this.
- A version **higher** than the running code understands (a stale tab after a deploy) puts the persister into **read-only mode** for that blob: the tab runs from memory and never overwrites newer data.
- Migrations are an ordered array of pure `(old) => new` functions with tests.

## 9. Design Rationale

**Why is the dataset not in `localStorage`?** Datasets can be large and `localStorage` is synchronous, size-limited and unsuitable for streaming or slice reads. Only a summary (id, name, size, column names/types/missing counts) is stored so the sidebar and blocked-state logic work at startup without touching IndexedDB.

**Why store `data.mode` instead of deriving it?** The old rule (`datasetId !== null && modelType === null`) conflated "dataset exists" with "user is looking at the preview". The new workflow lets the user have a dataset *and* return to the picker, and a reload must show the same one.

**Why a separate scroll key?** Scroll updates are frequent and low-value; isolating them keeps the main blob small, avoids rewriting model data on every scroll tick, and lets multi-tab sync ignore them.

**Why store `status: 'training'` when it cannot be resumed?** It is needed to detect an interrupted run and to let a second tab know training is happening elsewhere. The old design excluded `trainingStatus` entirely, which made both impossible and meant a reload during training showed a normal-looking form with no explanation.

**Why hydrate before routing?** The router's blocked-state and resume logic must evaluate against hydrated state; otherwise a reloaded session would look empty and flash the wrong page.

**Why not a `Proxy`-based auto-persisting object?** It only observes top-level assignments, so deep edits (`models[2].features.push(...)`) would not persist, and it conflicts with the nanostores/immutable-action rule in COMPONENTS.md §5.

## 10. Inconsistencies Found and How They Are Resolved

| # | Where | Inconsistency | Resolution |
| :--- | :--- | :--- | :--- |
| 1 | Old store plan | Persisted `currentStep`, global `modelType`/`hyperparameters`/`selectedFeatures` | URL replaces `currentStep`; per-model `ModelRecord` replaces globals (workflow-steps §3) |
| 2 | Old store plan | Route guards **redirect** a reloaded session to the first step | Navigation is never blocked or redirected by state; pages that cannot display show a `.notification` (finite-state-machine.md §4) |
| 3 | Old store plan | `trainingStatus`, `resultsId` not persisted | Status is persisted so interruption is detectable; results are persisted in IndexedDB |
| 4 | Column type vocabularies | workflow-steps: `numeric\|categorical\|boolean`; old FSM: `+datetime\|text`; data-ingestion: `numeric\|categorical\|text\|unknown`; preview-dataset: `text\|integer\|float\|boolean`; `datasets.ts`: `string\|number\|boolean` | Canonical UI/state type is `numeric \| categorical \| boolean \| text`. The ingestion layer's finer types (integer/float, unknown) map onto it at the boundary; `datetime` is deferred and maps to `text`. data-ingestion and preview-dataset need aligning. |
| 5 | preview-dataset vs data-ingestion | Single active dataset, stores `dataset`/`metadata`, key `dataset_stats`, clear-on-upload **vs** `samata-db`, `metadata`/`raw_records`, compound `[datasetId,rowIndex]` | data-ingestion is canonical; "one *active* dataset" is a policy enforced after a successful upload (§6) |
| 6 | Old store plan | `Pipeline.initialize()` singleton with `Proxy` state | Nanostores + actions + persister (§9) |
| 7 | Old FSM plan | URL-paste dataset source | Removed; workflow-steps has samples + upload only. (Sample datasets are still fetched by URL internally.) |
| 8 | preview-dataset | Preview shown when `datasetId !== null && modelType === null` | `data.mode` (§9) |
| 9 | README / COMPONENTS | `state-and-storage.md` is referenced but does not exist | See §11 |

## 11. Open Questions

1. Promote this file to `specification/state-and-storage.md` (and fix the README link)? Rename `finite-state-machine.md` to `app-state-and-navigation.md`?
2. Detailed results storage: is a `model_results` store in `samata-db` acceptable, or should results be a separate database?
3. Should upload content be identified by a content hash so re-uploading the same file keeps downstream state? (Currently each upload gets a new `id`, so it counts as a different dataset.)
4. `datasets.ts` has no stable `id`/slug and uses `name`/`shape`, while workflow-steps refers to `title`/`num_records`/`num_columns`. Which is canonical?
5. Is Web Locks acceptable against the Baseline Widely available target? (It is expected to be; verify before implementation.)
