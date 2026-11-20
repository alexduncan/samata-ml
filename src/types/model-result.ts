import type {
	BinaryClassificationMetrics,
	ClassificationDiagnostics,
	ClassificationLabel,
	CrossValidationFoldResult,
	FittedTabularPreprocessorState,
	MulticlassClassificationMetrics,
	TrainingEvent,
	TrainingPhase
} from 'web-ml';

/** Immutable identity for a single attempt at a captured configuration. */
export interface TrainingRunIdentity {
	readonly datasetId: string;
	readonly target: string;
	readonly modelNum: number;
	readonly modelCreatedAt: number;
	readonly configurationKey: string;
	readonly runId: string;
}

/** Warning codes from the public training event contract. */
export type TrainingWarningCode = Extract<TrainingEvent, { type: 'warning' }>['code'];

/** Localisable training events containing only safe categories and counts. */
export type TrainingLogMessage =
	| { key: 'phase'; phase: TrainingPhase }
	| { key: 'fold-start'; fold: number; folds: number }
	| { key: 'fold-complete'; fold: number }
	| { key: 'warning'; code: TrainingWarningCode }
	| {
			key:
				| 'preparing'
				| 'refit-start'
				| 'refit-complete'
				| 'saving'
				| 'completed'
				| 'cancelled'
				| 'failed';
	  };

/** One ordered, safe entry in the training log for a single attempt. */
export interface TrainingLogEntry {
	readonly id: number;
	readonly timestamp: number;
	readonly level: 'status' | 'warning' | 'error';
	readonly message: TrainingLogMessage;
}

/** Both library reports that single-target classification may return. */
export type HoldoutReport = BinaryClassificationMetrics | MulticlassClassificationMetrics;

/** Version-independent payload copied from the training worker before model disposal. */
export type TrainingResultPayload = {
	readonly webMlRevision: string;
	readonly excludedTargetRows: number;
	readonly sourceRowIndices: readonly number[];
	readonly featureNamesOut: readonly string[];
	readonly classLabels: readonly ClassificationLabel[];
	readonly modelJson: Record<string, unknown>;
	readonly preprocessorJson: FittedTabularPreprocessorState;
} & (
	| {
			readonly strategy: 'one_shot';
			readonly holdout: {
				readonly trainIndices: Uint32Array;
				readonly testIndices: Uint32Array;
				readonly report: HoldoutReport;
			};
	  }
	| {
			readonly strategy: 'cross_validation';
			readonly crossValidation: {
				readonly folds: readonly CrossValidationFoldResult[];
				readonly diagnostics: ClassificationDiagnostics;
				readonly meanScore: number;
				readonly standardDeviation: number;
			};
	  }
);

/** The durable v1 result stored under the dataset and model number. */
export type ResultEnvelope = TrainingResultPayload &
	TrainingRunIdentity & {
		readonly schemaVersion: 1;
		readonly algorithm: import('../features/models/model-catalogue').ClassifierId;
		readonly durationMs: number;
		readonly logEntries: readonly TrainingLogEntry[];
	};
