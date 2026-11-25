/**
 * Application state and persistence schemas.
 * Follows specification/state-and-storage.md §3 and specification/COMPONENTS.md §5.
 */

/** Storage key for domain application state in localStorage. */
export const STATE_STORAGE_KEY = 'samata-ml:state';

/** Storage key for scroll snapshots in localStorage. */
export const SCROLL_STORAGE_KEY = 'samata-ml:scroll';

/** Storage schema version. */
export const STORAGE_VERSION = 1;

/** Canonical column type vocabulary across UI, worker, and state. */
export type ColumnType =
	| 'numeric'
	| 'categorical'
	| 'boolean'
	| 'date'
	| 'time'
	| 'datetime'
	| 'text';

/** Column types that hold calendar dates, times of day or instants. */
export const TEMPORAL_COLUMN_TYPES = [
	'date',
	'time',
	'datetime'
] as const satisfies readonly ColumnType[];

/** Temporal subset of {@link ColumnType}. */
export type TemporalColumnType = (typeof TEMPORAL_COLUMN_TYPES)[number];

/**
 * Checks whether a column type is one of the temporal types.
 *
 * @param type - Canonical column type to check.
 * @returns Whether the type is `date`, `time` or `datetime`.
 */
export function isTemporalColumnType(type: ColumnType): type is TemporalColumnType {
	return (TEMPORAL_COLUMN_TYPES as readonly ColumnType[]).includes(type);
}

/** Column types that can be used as a model target or feature. */
export const MODEL_ELIGIBLE_COLUMN_TYPES = ['numeric', 'categorical', 'boolean'] as const;

/**
 * Checks whether a column type can be used as a model target or feature.
 *
 * @param type - Canonical column type to check.
 * @returns Whether the column type is supported by the current modelling workflow.
 */
export function isModelEligibleColumnType(type: ColumnType): boolean {
	return (MODEL_ELIGIBLE_COLUMN_TYPES as readonly ColumnType[]).includes(type);
}

/** Summary metadata for a single column. */
export interface ColumnSummary {
	/** Column header name. */
	name: string;
	/** Inferred or validated column type. */
	type: ColumnType;
	/** Count of null, undefined or empty values. */
	missingCount: number;
}

/** Lightweight dataset summary stored in reactive state and localStorage. */
export interface DatasetSummary {
	/** Unique dataset identifier. */
	id: string;
	/** Display name. */
	name: string;
	/** Origin of dataset: built-in sample or user upload. */
	source: 'sample' | 'upload';
	/** Sample catalogue ID; absent for uploaded datasets and older persisted state. */
	sampleId?: string;
	/** Total number of rows. */
	rowCount: number;
	/** Column summaries. */
	columns: ColumnSummary[];
}

/** Valid workflow navigation paths. */
export type WorkflowPath = '/data' | '/target' | '/models' | `/models/${number}` | '/results';

/** Identifier for each step in configuring and training a model. */
export type ModelSectionId =
	| 'choose-model'
	| 'select-features'
	| 'configure-model'
	| 'configure-training'
	| 'training'
	| 'results';

/** Primitive, `null` and number-array hyperparameter values. `null` means an explicit "no limit" or "disabled" option such as `maxDepth`. */
export type HyperparameterValue = number | string | boolean | null | number[];

/** Hyperparameter configuration for manual settings or tuning search space. */
export interface HyperparameterConfig {
	mode: 'manual' | 'tuning';
	values: Record<string, HyperparameterValue>;
	tuningSearchSpace?: Record<string, HyperparameterValue[]>;
}

/** Test partition ratio requested by One-Shot. */
export const FIXED_ONE_SHOT_TEST_RATIO = 0.2 as const;

/** Reproducible random seed for both training strategies. */
export const FIXED_TRAINING_RANDOM_STATE = 42 as const;

/** Smallest selectable cross-validation fold count. */
export const MIN_CV_FOLDS = 2;

/** Largest selectable cross-validation fold count. */
export const MAX_CV_FOLDS = 10;

/** Initial cross-validation fold count before applying target class limits. */
export const DEFAULT_CV_FOLDS = 5;

/** Methodology used for model training and validation. */
export type ValidationMethodology =
	| {
			type: 'one_shot';
			testRatio: typeof FIXED_ONE_SHOT_TEST_RATIO;
			randomState: typeof FIXED_TRAINING_RANDOM_STATE;
	  }
	| {
			type: 'nested_cv';
			outerFolds: number;
			innerFolds: number;
			randomState: typeof FIXED_TRAINING_RANDOM_STATE;
	  };

/** Default setup for a model with no saved strategy. */
export const DEFAULT_ONE_SHOT_SETUP: ValidationMethodology = {
	type: 'one_shot',
	testRatio: FIXED_ONE_SHOT_TEST_RATIO,
	randomState: FIXED_TRAINING_RANDOM_STATE
};

/** Multi-class classification strategy. */
export type MulticlassStrategy = 'native' | 'one-vs-rest' | 'one-vs-one';

/** Stages reported across the two training strategies. */
export type TrainingStage =
	| 'preparing'
	| 'fitting'
	| 'cross-validation'
	| 'refitting'
	| 'evaluating'
	| 'saving';

/** Training progress snapshot emitted during training execution. */
export interface TrainingProgress {
	percent: number | null;
	stage: TrainingStage;
	phase: string | null;
	statusMessage: string;
}

/** Error details recorded when training fails, cancels, or is interrupted. */
export interface TrainingError {
	code: 'TRAINING_FAILED' | 'TRAINING_CANCELLED' | 'TRAINING_INTERRUPTED_BY_RELOAD';
	message: string;
	timestamp: number;
	details?: string;
}

/** Step duration timings captured during model training. */
export interface TrainingTimings {
	steps: { label: string; durationMs: number }[];
	totalMs: number;
}

/** Execution status of a configured model. */
export type ModelStatus = 'draft' | 'training' | 'trained';

/** Record representing a single configured or trained machine learning model. */
export interface ModelRecord {
	/** Sequential integer model number (e.g. 1 in /models/1). */
	num: number;
	/** Creation timestamp in milliseconds. */
	createdAt: number;
	/** Current model lifecycle status. */
	status: ModelStatus;
	/** Sections completed in the model training workflow. */
	completedSteps: ModelSectionId[];

	/** Section 1: Selected model identifier from web-ml. */
	modelId: string | null;
	/** Section 2: Selected feature column names (never contains target). */
	features: string[];
	/** Section 2: Model-specific preprocessing/encoding options. */
	modelOptions: Record<string, HyperparameterValue>;
	/** Section 3: Hyperparameter configuration. */
	hyperparameters: HyperparameterConfig;
	/** Section 3: Multiclass classification strategy. */
	multiclass: MulticlassStrategy | null;
	/** Section 4: Training validation setup. */
	trainingSetup: ValidationMethodology | null;

	/** Section 5: Transient or current progress. */
	progress: TrainingProgress | null;
	/** Current run identity during training and after its result has been saved. */
	resultRevision: string | null;
	/** Section 5: Error information if training ended in failure. */
	error: TrainingError | null;
	/** Section 5: Timing breakdown. */
	timings: TrainingTimings | null;
	/** Total training duration in milliseconds. */
	durationMs: number | null;

	/** Headline metrics summary (full detailed results live in IndexedDB). */
	metrics: Record<string, number> | null;

	/** Section 6: UI selections (chart tab, etc.). */
	ui: Record<string, unknown> & { trainingLogOpen?: boolean; results?: Partial<ModelResultsUi> };
}

/** Per-model display preferences for Section 6. Absent fields use `DEFAULT_MODEL_RESULTS_UI`. */
export interface ModelResultsUi {
	/** Index into `thresholdSweep.thresholds`; default 50 (0.50). */
	thresholdIndex: number;
	/** Selected true-class index for more than 20 classes, or null. */
	classFilter: number | null;
	/** Whether the "More metrics" disclosure is open. */
	moreMetricsOpen: boolean;
}

/** Display preferences used when a model has stored none. */
export const DEFAULT_MODEL_RESULTS_UI: Readonly<ModelResultsUi> = {
	thresholdIndex: 50,
	classFilter: null,
	moreMetricsOpen: false
};

/**
 * Keeps only the valid fields of a stored or requested preference object. Invalid fields
 * are dropped so they fall back to defaults; the model itself is never discarded.
 */
export function sanitiseModelResultsUi(value: unknown): Partial<ModelResultsUi> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
	const source = value as Record<string, unknown>;
	const result: Partial<ModelResultsUi> = {};
	const { thresholdIndex, classFilter, moreMetricsOpen } = source;
	if (
		typeof thresholdIndex === 'number' &&
		Number.isInteger(thresholdIndex) &&
		thresholdIndex >= 0 &&
		thresholdIndex <= 100
	) {
		result.thresholdIndex = thresholdIndex;
	}
	if (
		classFilter === null ||
		(typeof classFilter === 'number' && Number.isInteger(classFilter) && classFilter >= 0)
	) {
		result.classFilter = classFilter;
	}
	if (typeof moreMetricsOpen === 'boolean') result.moreMetricsOpen = moreMetricsOpen;
	return result;
}

/** Result-store dataset ID reserved for the training domain checkpoint. */
export const TRAINING_DOMAIN_DATASET_ID = 'samata-ml:training-domain';

/** Measures available for sorting the comparison table. */
export type ComparisonColumn =
	| 'balancedAccuracy'
	| 'macroF1'
	| 'mcc'
	| 'accuracy'
	| 'rocAuc'
	| 'averagePrecision'
	| 'logLoss'
	| 'brier'
	| 'ece'
	| 'gap'
	| 'sd'
	| 'iqr'
	| 'falsePositives'
	| 'falseNegatives'
	| 'errors'
	| 'fitDuration';

/** Identifies the protected context owning comparison choices. */
export interface ComparisonOwner {
	datasetId: string;
	target: string;
	epoch: number;
}

/** Persisted comparison display choices. */
export interface ComparisonUi {
	fingerprint: string | null;
	selected: number[];
	sort: { column: ComparisonColumn; direction: 'ascending' | 'descending' } | null;
	pairA: number | null;
	pairB: number | null;
	ropeWidth: number;
	classFilter: number | null;
}

/** Default comparison choices before a group is selected. */
export const DEFAULT_COMPARISON_UI: Readonly<ComparisonUi> = {
	fingerprint: null,
	selected: [],
	sort: null,
	pairA: null,
	pairB: null,
	ropeWidth: 0.01,
	classFilter: null
};

/** Persisted application state structure saved to localStorage. */
export interface PersistedAppState {
	version: typeof STORAGE_VERSION;
	updatedAt: number;
	/** Last acknowledged protected generation. Historic v1 snapshots decode to zero. */
	trainingDomainGeneration: number;
	/** Monotonic identity for the current comparison context. */
	comparisonContextEpoch: number;

	onboarding: { welcomeDismissed: boolean; betaTelemetryAccepted: boolean };

	/** Path resolved when navigating to /. Always a workflow path. */
	resumePath: WorkflowPath;

	dataset: DatasetSummary | null;
	data: {
		/** Selection mode on /data: 'select' (picker) or 'preview'. */
		mode: 'select' | 'preview';
		/** Name of column currently inspected in details panel. */
		selectedColumn: string | null;
	};

	/** Target column name. Meaningful only when dataset !== null. */
	target: string | null;

	models: ModelRecord[];
	/** Monotonic counter for allocating unique model numbers. */
	nextModelNum: number;

	/** UI selections for /results page. */
	results: { owner: ComparisonOwner | null; ui: ComparisonUi };
}

/** Scroll offset and viewport snapshot for a view. */
export interface ScrollSnapshot {
	/** window.innerWidth in CSS px when saved. */
	viewportWidth: number;
	/** Document scroll top offset in CSS px. */
	top: number;
	/** Named internal scrollable region offsets. */
	regions?: Record<string, { top: number; left: number }>;
	/** Timestamp in milliseconds when snapshot was recorded. */
	savedAt: number;
}

/** Persisted scroll state structure saved to localStorage. */
export interface PersistedScroll {
	version: typeof STORAGE_VERSION;
	/** Map of route/view keys to scroll snapshots. */
	snapshots: Record<string, ScrollSnapshot>;
}

/** Initial default application state before any dataset is loaded. */
export const INITIAL_APP_STATE: PersistedAppState = {
	version: STORAGE_VERSION,
	updatedAt: Date.now(),
	trainingDomainGeneration: 0,
	comparisonContextEpoch: 0,
	onboarding: { welcomeDismissed: false, betaTelemetryAccepted: false },
	resumePath: '/data',
	dataset: null,
	data: { mode: 'select', selectedColumn: null },
	target: null,
	models: [],
	nextModelNum: 1,
	results: { owner: null, ui: { ...DEFAULT_COMPARISON_UI, selected: [] } }
};

/** Initial default scroll state with empty snapshot map. */
export const INITIAL_SCROLL_STATE: PersistedScroll = {
	version: STORAGE_VERSION,
	snapshots: {}
};
