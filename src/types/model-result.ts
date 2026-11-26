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
import type { StoredEvaluation } from './model-evaluation';

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

type PayloadBase = {
	readonly webMlRevision: string;
	readonly excludedTargetRows: number;
	readonly sourceRowIndices: readonly number[];
	readonly featureNamesOut: readonly string[];
	readonly classLabels: readonly ClassificationLabel[];
	readonly modelJson: Record<string, unknown>;
	readonly preprocessorJson: FittedTabularPreprocessorState;
};

type CrossValidationPayload = {
	readonly folds: readonly CrossValidationFoldResult[];
	readonly diagnostics: ClassificationDiagnostics;
	readonly meanScore: number;
	readonly standardDeviation: number;
};

/** Phase 3 payload kept readable: no stored evaluation, One-Shot report from the library. */
export type LegacyTrainingResultPayload = PayloadBase &
	(
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
				readonly crossValidation: CrossValidationPayload;
		  }
	);

/**
 * Payload copied from the training worker before model disposal. The One-Shot report lives in
 * `evaluation.partitions[0].test`; both index arrays are relative to the retained rows.
 */
export type TrainingResultPayload = PayloadBase & {
	readonly evaluation: StoredEvaluation;
} & (
		| {
				readonly strategy: 'one_shot';
				readonly holdout: {
					readonly trainIndices: Uint32Array;
					readonly testIndices: Uint32Array;
				};
		  }
		| {
				readonly strategy: 'cross_validation';
				readonly crossValidation: CrossValidationPayload;
		  }
	);

type EnvelopeBase = TrainingRunIdentity & {
	readonly algorithm: import('../features/models/model-catalogue').ClassifierId;
	readonly durationMs: number;
	readonly logEntries: readonly TrainingLogEntry[];
};

/** A Phase 3 durable result: still readable, with no evaluation detail. */
export type ResultEnvelopeV1 = LegacyTrainingResultPayload &
	EnvelopeBase & { readonly schemaVersion: 1 };

/** The durable result stored under the dataset and model number, with its evaluation. */
export type ResultEnvelopeV2 = TrainingResultPayload &
	EnvelopeBase & {
		readonly schemaVersion: 2;
		/** Optional app presentation label. It is never part of the worker payload. */
		readonly modelLabel?: string | null;
	};

/** Either durable result version. */
export type ResultEnvelope = ResultEnvelopeV1 | ResultEnvelopeV2;
