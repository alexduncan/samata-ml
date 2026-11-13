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
export type ColumnType = 'numeric' | 'categorical' | 'boolean' | 'datetime' | 'text';

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

/** Primitive and array hyperparameter values. */
export type HyperparameterValue = number | string | boolean | number[];

/** Hyperparameter configuration for manual settings or tuning search space. */
export interface HyperparameterConfig {
	mode: 'manual' | 'tuning';
	values: Record<string, HyperparameterValue>;
	tuningSearchSpace?: Record<string, HyperparameterValue[]>;
}

/** Methodology used for model training and validation. */
export type ValidationMethodology =
	| { type: 'nested_cv'; outerFolds: number; innerFolds: number }
	| { type: 'k_fold_cv'; folds: number }
	| { type: 'train_test_split'; testRatio: number };

/** Multi-class classification strategy. */
export type MulticlassStrategy = 'native' | 'one-vs-rest' | 'one-vs-one';

/** Training progress snapshot emitted during training execution. */
export interface TrainingProgress {
	percent: number;
	currentFold?: number;
	totalFolds?: number;
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
	/** Section 5: Error information if training ended in failure. */
	error: TrainingError | null;
	/** Section 5: Timing breakdown. */
	timings: TrainingTimings | null;
	/** Total training duration in milliseconds. */
	durationMs: number | null;

	/** Headline metrics summary (full detailed results live in IndexedDB). */
	metrics: Record<string, number> | null;

	/** Section 6: UI selections (chart tab, etc.). */
	ui: Record<string, unknown>;
}

/** Persisted application state structure saved to localStorage. */
export interface PersistedAppState {
	version: typeof STORAGE_VERSION;
	updatedAt: number;

	onboarding: { welcomeDismissed: boolean };

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
	results: { ui: Record<string, unknown> };
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
	onboarding: { welcomeDismissed: false },
	resumePath: '/data',
	dataset: null,
	data: { mode: 'select', selectedColumn: null },
	target: null,
	models: [],
	nextModelNum: 1,
	results: { ui: {} }
};

/** Initial default scroll state with empty snapshot map. */
export const INITIAL_SCROLL_STATE: PersistedScroll = {
	version: STORAGE_VERSION,
	snapshots: {}
};
