# Application State Persistence

**Status:** draft — schema, ordinary persistence, acknowledged protected commits, startup reconciliation and cross-tab training coordination are implemented. General multi-tab preferences and future migrations remain target. See [Known gap 14](README.md#known-gaps).

> **Source of truth:** [workflow-steps.md](workflow-steps.md). Navigation, routing, step behaviour and scroll memory are specified in [app-state-and-navigation.md](app-state-and-navigation.md) (now the hybrid router + store design). This document specifies **how state is stored**: keys, schema, write scheduling, IndexedDB reconciliation, multi-tab behaviour, versioning.
>
> Formerly `plans/store-pipline-state.md`; moved here 2026-11-12. Still a draft until the open questions in [§11](#11-open-questions) are answered.

## 1. Purpose

Persisted state exists so that **reloading the tab, or opening the base URL in a new tab, shows exactly the UI the user last saw** (app-state-and-navigation.md goal G3), without keeping dataset rows in reactive application memory.

It stores _what the user has done and chosen_. _Where the user is_ comes from the URL; the one exception is `resumePath`, which is what `/` resolves to.

## 2. Storage Split

| Data                                                           | Where                                                                           | Why                                                                                                     |
| :------------------------------------------------------------- | :------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------ |
| Workflow state, UI selections, model records, headline metrics | `localStorage` key `samata-ml:state`                                            | Small, needed synchronously at startup before first render and before routing                           |
| Scroll snapshots                                               | `localStorage` key `samata-ml:scroll`                                           | Written far more often than the rest; separate key keeps writes small and lets multi-tab sync ignore it |
| Dataset rows                                                   | IndexedDB `samata-db` → `raw_records`                                           | Large, streamed in slices ([data-ingestion.md](data-ingestion.md))                                      |
| Column statistics (histograms, category counts, median)        | IndexedDB `samata-db` → `metadata`                                              | Unbounded (up to 100 bins × columns, arbitrary category counts)                                         |
| Detailed classification results and completed training logs    | IndexedDB `samata-db` → `model_results`, key `[datasetId, modelNum]`            | Large and read on demand for Section 5 and later results views                                          |
| Training domain checkpoint                                     | IndexedDB `samata-db` → `model_results`, key `["samata-ml:training-domain", 0]` | Retained generation and pending protected publication                                                   |

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

export type TrainingStage =
	| 'preparing'
	| 'fitting'
	| 'cross-validation'
	| 'refitting'
	| 'evaluating'
	| 'saving';

export interface TrainingProgress {
	percent: number | null;
	stage: TrainingStage;
	phase: string | null;
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
	resultRevision: string | null; // Current run ID while training or trained.
	error: TrainingError | null;
	timings: TrainingTimings | null;
	durationMs: number | null;

	/**
	 * Headline metrics for the /models table and /results; full results live in IndexedDB.
	 * `{ balancedAccuracy, accuracy, macroF1 }` from the pooled held-out report, plus
	 * `balancedAccuracySd` when there are at least two partitions. Null for a model that is
	 * not trained or whose saved result is a Phase 3 (version 1) result.
	 */
	metrics: Record<string, number> | null;

	/**
	 * Per-model UI selections (e.g. `featureSelectionInitialised: boolean`, `trainingLogOpen`).
	 * `featureSelectionInitialised` tracks whether initial eligible features were populated once
	 * on Choose Model completion, ensuring intentional user toggles (including empty selections)
	 * survive reload and reopening. `results` holds the Section 6 preferences below.
	 */
	ui: Record<string, unknown> & { results?: Partial<ModelResultsUi> };
}

/** Section 6 display preferences. Absent fields use the defaults shown. */
export interface ModelResultsUi {
	/** Index into the 101 stored threshold cutoffs; default 50 (0.50). */
	thresholdIndex: number;
	/** Selected true-class index for more than 20 classes; default null (the twenty largest). */
	classFilter: number | null;
	/** Whether the "More metrics" disclosure is open; default false. */
	moreMetricsOpen: boolean;
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
	trainingDomainGeneration: number; // Zero for legacy v1 state.

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

Defaults on first load: `welcomeDismissed: false`, `resumePath: '/data'`, `dataset: null`, `data: { mode: 'select', selectedColumn: null }`, `target: null`, `models: []`, `nextModelNum: 1`, `trainingDomainGeneration: 0` and no scroll snapshots.

### Training Setup on the v1 wire

| In memory                                                              | JSON written to v1                                              |
| :--------------------------------------------------------------------- | :-------------------------------------------------------------- |
| `null`                                                                 | `null` (unset)                                                  |
| `{ type: 'one_shot', testRatio: 0.2, randomState: 42 }`                | `{ type: 'train_test_split', testRatio: 0.2, randomState: 42 }` |
| `{ type: 'nested_cv', outerFolds: n, innerFolds: n, randomState: 42 }` | The same `nested_cv` fields                                     |

A private codec produces fresh canonical objects on read. It supplies seed 42 for seedless historical forms and upgrades legacy `k_fold_cv` with `folds: n` to equal inner and outer counts. It accepts historical `train_test_split` only at ratio 0.2 and historical `nested_cv` only with equal counts. Counts must be finite integers from 2 through 10. Required fields must be own properties of a plain record. A supplied seed other than 42, unsafe own keys (`__proto__`, `constructor`, `prototype`), an unknown tag, or a missing or invalid shape records a malformed outcome for the owning model. Explicit `null` records an unset outcome. Both read as `null` in memory and are distinguished during reconciliation (§6).

## 4. Write Scheduling

The persister encodes v1 state and coordinates normal browser writes with the protected journal. The training service and startup reconciliation use acknowledged persistence for lifecycle operations. Ordinary changes update in-memory state immediately. Their writer merges eligible changes under the state lock against the latest published generation and retains the protected dataset pointer, target, model membership and lifecycle.

### 4.1 Triggers

| Change                                                                                                                     | Persistence                                                             |
| -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Dataset publication, target changes and discard, model creation, training entry and exit, View Results and startup repairs | Acknowledged protected commit                                           |
| Resume path, onboarding, UI selections, section changes and discrete draft edits                                           | Prompt best-effort write                                                |
| Fold-count and free-form hyperparameter edits                                                                              | Debounced about 300 ms                                                  |
| Compact training progress                                                                                                  | Throttled to at most one write per second                               |
| Log disclosure                                                                                                             | Best-effort immediate flush                                             |
| Scroll snapshots                                                                                                           | Debounced about 150 ms, with navigation and document visibility flushes |

The persister requests a flush on `pagehide` and when the document becomes hidden. A form submission is checked against the persisted draft and can acknowledge the captured eligible edit before starting the protected attempt.

### 4.2 Protected commits

The protected writer uses `samata-ml:training-state` to validate the current generation, publish already committed recovery work and serialise each new operation. It stages the next protected domain and increments the generation in IndexedDB. Result insertion and resource deletion join the same transaction as the pending journal row. After the transaction commits, the persister writes the candidate v1 snapshot with that generation and clears the exact pending entry. The checkpoint row retains the generation even after publication. The state write and journal clear acknowledge the operation before normal workflow progression.

The reserved result-store row has a distinct checkpoint tag and a v1 schema. Its pending entry carries the operation ID, kind and protected domain snapshot. Rows under the reservation are excluded from result lookup, dataset deletion and orphan cleanup.

### 4.3 Failure handling

Ordinary edits continue in memory when `localStorage` throws. The persister shows a save-failure notice and can reclaim scroll snapshots before retrying a quota failure. Protected operations surface an explicit response for an unavailable read, a conflicting generation, a read-only version or a failed write. A failure before the IndexedDB commit leaves the prior published resources and domain intact. An unavailable read provides no evidence of missing data.

After the IndexedDB commit, failures retain the pending candidate in the durable checkpoint. Further protected mutations wait on successful publication. Retry saving and startup replay the same operation and generation. A saved result stays at 95% until publication and a committed discard keeps the confirmation in recovery. The app shell withholds unreconciled workflow views until saved work can be restored.

## 5. UI State Persistence Rule

> Any user-controlled UI state that is not a transient overlay MUST be persisted, and MUST live in a store with an action, not in a component's private `@state`.

This is what makes "exact same UI" enforceable as the app grows. Each new feature spec MUST add its UI state to the registry below or state why it is transient.

| UI state                                                                     | Persisted as                                 | Notes                                                                                                                              |
| :--------------------------------------------------------------------------- | :------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------- |
| Welcome modal dismissed                                                      | `onboarding.welcomeDismissed`                |                                                                                                                                    |
| `/data` picker vs preview                                                    | `data.mode`                                  |                                                                                                                                    |
| Open column-details aside                                                    | `data.selectedColumn`                        |                                                                                                                                    |
| Virtual table scroll offsets                                                 | `ScrollSnapshot.regions['data-table']`       |                                                                                                                                    |
| Page scroll, per step                                                        | `PersistedScroll.snapshots[key]`             | Ignored if viewport width differs                                                                                                  |
| Per-model section completion                                                 | `ModelRecord.completedSteps`                 | Drives section selection and completion checks                                                                                     |
| Feature initialisation state                                                 | `ModelRecord.ui.featureSelectionInitialised` | Tracks one-time population on model continue                                                                                       |
| Chosen model, features, options, hyperparameters, multiclass, training setup | `ModelRecord.*`                              | Committed values                                                                                                                   |
| Training log disclosure                                                      | `ModelRecord.ui.trainingLogOpen`             | Boolean, defaults to closed when absent                                                                                            |
| Section 6 threshold, class filter and More metrics                           | `ModelRecord.ui.results`                     | `setModelResultsUi`; invalid fields drop to defaults without discarding the model. The "Show data table" disclosures are transient |
| Compare Results view                                                         | `results.ui`                                 | Defined by the section 4 spec                                                                                                      |
| Location                                                                     | URL, plus `resumePath` for `/`               |                                                                                                                                    |

**Transient (never persisted):** reserved-route modals (including `/help/training-setup`; these are restored only because the URL says so), Datasheet, Upload and Model Description dialogs, focus, hover, uncommitted field text (including empty, out-of-range and native invalid fold drafts), fold errors and their live announcements, in-flight ingestion state, upload validation errors, live training progress between throttled writes.

Presentational components MUST NOT import stores (COMPONENTS.md §2). They receive the value as a property and emit an event; a connected component calls the action.

## 6. IndexedDB Reconciliation

Startup reads v1 storage and the IndexedDB checkpoint under the state lock. It replays any pending committed operation before exposing workflow views. A storage access failure enters recovery. Available but missing or invalid dataset metadata or results are handled separately.

1. Validate the active dataset and eligible target. Confirmed resource loss clears the dependent state and scroll keys. Valid resources remain available when an unrelated record needs repair.
2. Validate model identifiers, features and counters. A trained model requires a valid envelope with the same dataset, target, model creation identity, effective configuration and result revision. Version 2 envelopes carry a `StoredEvaluation` that must agree with the retained rows, class axis and strategy; the headline `metrics` are projected from it, the same way as when the result is first published. A valid version 1 envelope from Phase 3 stays trained with `metrics: null` and opens Section 6 with the legacy message. A missing or invalid envelope reopens the draft with a result-loss notice.

    Section 6 reads the envelope on demand through `$modelResults` (session-only, never persisted), keyed by model number and the full run identity. A result that goes missing after View Results shows the lost state rather than reopening the draft until the next startup.

3. For a training model, probe the exclusive per-model lock. Preserve a live run owned in another tab. When no owner remains, acknowledge an interrupted draft with its setup retained and Section 4 open.
4. Apply model-local Training Setup decoding outcomes after result and lock checks. A malformed draft setup, or an unset setup with stale Section 4–6 markers, reopens Section 4. Keep the diagnostic created by result-loss or interruption recovery.
5. Publish any protected repair before orphan cleanup. Under the exclusive ingestion lock, reread the acknowledged pointer and journal, and clean unpublished or superseded data while retaining the active dataset, its result rows and the checkpoint. When the lock is busy or publication is unresolved, defer cleanup.

Ingestion stages rows and metadata under a fresh dataset ID. After ingestion, the replacement queues its exclusive hand-off, checks that the staged metadata still exists and publishes the new pointer before cleaning the previous dataset. If startup removes a staged upload before it has a replacement checkpoint, the hand-off rejects that upload with the current dataset preserved. A pending or acknowledged replacement is protected from orphan cleanup.

## 7. Multi-Tab Behaviour

IndexedDB and the v1 state key are shared. Tabs keep their own URL, active view, focus and local workers. On a state storage event, a tab validates the generation under the state lock and applies newer acknowledged protected state in place. The receiving tab keeps its local resume route and workflow focus. Scroll-key changes and general ordinary preference sync are outside this contract.

An unsaved training log disclosure edit stays visible during refresh and can still be saved after a generation advance when the dataset, target, model number and model creation time match. A saved edit stops participating in later merges. A replaced identity drops its pending edit. Checkpoint replay keeps an existing saved disclosure unless a matching local edit is pending.

Training takes the shared `samata-ml:ingestion` lock and the exclusive `samata-ml:training:{num}` lock through settlement. A confirmation cancels local attempts and waits for settlement before trying the exclusive ingestion lock. When another tab owns a shared training lock, keep the confirmation open with a remote-training notice. A different tab can replay a pending publication under the state lock. After that tab clears a finish checkpoint, the owning tab's **Retry saving** can adopt the guarded snapshot without waiting for a storage event. The owner verifies the original result and tries to save a matching unsaved disclosure before completing the session. The same recovery applies when a later storage event prompts the owner to load the result first. A denied preference write leaves the disclosure visible in memory with the save-failure notice.

For a committed worker failure or cancellation, **Retry saving** restores the guarded draft and settles the original stopped session. The owner checks the committed generation, captured dataset, target, model creation, configuration and safe error under the resource and state locks. A matching draft can be restored after another tab acknowledges the checkpoint, even when no further storage event arrives. If a guarded write or storage refresh publishes the draft first, the owner can settle the stop automatically. Each committed stop remains recoverable by its original run when another model advances the shared checkpoint. The restored draft retains the original safe reason and can be edited or trained again through Section 4. If the model has since been replaced or restarted, the owner applies the current protected state and retires the older publication notice.

## 8. Versioning & Validation

- Every persisted blob has `version`. `STORAGE_VERSION` starts at `1`; the earlier `ml_app_fsm_state_v1` key and the `Pipeline` proxy design were never implemented and need no migration.
- `STORAGE_VERSION` stays `1` for Phase 1: `HyperparameterValue` only gains `null`, and no earlier release wrote option values because Section 3 never rendered, so no persisted blob changes shape. A bump would discard every user's state, because no migration exists.
- Persisted `hyperparameters.values` are validated: numbers must be finite, values are `null`, string, boolean, number or finite number array, and prototype keys (`__proto__`, `constructor`, `prototype`) are rejected; a state that fails is discarded wholesale like any other shape failure.
- Reads use a hand-written runtime shape check. JSON that fails to parse, fails envelope validation, or has a version below current without a migration falls back to fresh defaults. Training Setup decoding is a model-local exception to envelope rejection (§3, §6). The v1 wire remains compatible with the previous reader.
- A version **higher** than the running code understands (a stale tab after a deploy) yields fresh defaults in memory and puts the persister into **read-only mode** for that key for the lifetime of the document: the tab runs from memory and never overwrites newer data.
- Phase 3 keeps localStorage at v1 and IndexedDB at v2. Missing generation, revision and disclosure fields use their historical defaults. A versioned result envelope is validated before reuse. An old key-only result is treated as unavailable for that model. The checkpoint is validated separately. Advanced version migrations remain target.

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
