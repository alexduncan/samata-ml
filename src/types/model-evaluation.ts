/** Class labels exactly as the target column stores them. */
export type StoredClassLabel = string | number | boolean;

/** Why an upstream metric has no value; spellings follow the public `web-ml` contract. */
export type MetricUnavailableReason =
	| 'not-requested'
	| 'probabilities-unavailable'
	| 'unseen-validation-labels'
	| 'undefined-for-validation-classes'
	| 'all-targets-zero'
	| 'negative-targets'
	| 'not-applicable'
	| 'insufficient-degrees-of-freedom'
	| 'single-class';

/** A metric value reported by `web-ml`, or the reason it is unavailable. */
export type StoredMetric =
	| { readonly available: true; readonly value: number }
	| { readonly available: false; readonly reason: MetricUnavailableReason };

/** Classification report for one set of rows, copied from `web-ml`. */
export interface StoredReport {
	readonly sampleCount: number;
	readonly accuracy: number;
	/** Macro recall. */
	readonly balancedAccuracy: number;
	readonly macroF1: number;
	readonly mcc: StoredMetric;
	readonly rocAuc: StoredMetric;
	readonly averagePrecision: StoredMetric;
	readonly logLoss: StoredMetric;
	readonly brier: StoredMetric;
	/** Each length K, `classLabels` order. */
	readonly precisionPerClass: Float32Array;
	readonly recallPerClass: Float32Array;
	readonly f1PerClass: Float32Array;
	readonly support: Uint32Array;
	readonly predictedCount: Uint32Array;
	/** Row-major K × K; rows = true class, columns = predicted class. */
	readonly confusionMatrix: Uint32Array;
}

/** One evaluated partition: the One-Shot test split or one outer fold. */
export interface StoredPartition {
	readonly index: number;
	readonly kind: 'holdout-test' | 'outer-fold';
	readonly trainSampleCount: number;
	readonly testSampleCount: number;
	readonly durationMs: number;
	readonly timing: 'holdout-fit' | 'fold-fit-and-score';
	readonly test: StoredReport;
	/** Training-partition report (WR-4). */
	readonly train: StoredReport;
	readonly baselines: { readonly mostFrequent: StoredReport; readonly stratified: StoredReport };
}

/** Per-row outputs for every evaluated row, aligned by position. */
export interface StoredOutputs {
	/** Ascending dataset row indices of every evaluated row. */
	readonly sourceRowIndex: Uint32Array;
	readonly partitionIndex: Uint16Array;
	readonly trueIndex: Uint16Array;
	readonly predictedIndex: Uint16Array;
	/** rowCount × K, `classLabels` order; null when the model has no probabilities. */
	readonly probabilities: Float64Array | null;
	readonly probabilitySource:
		| 'native'
		| 'leaf-frequency'
		| 'neighbor-vote'
		| 'network-output'
		| 'platt'
		| null;
	readonly positiveScores: Float64Array | null;
	readonly rankingScoreSource: 'probability' | 'decision-function' | null;
}

/** Curves reported by `web-ml` over the pooled held-out rows. */
export interface StoredCurves {
	/** 101 cutoffs 0.00…1.00 on the positive-class probability; binary with probabilities only. */
	readonly thresholdSweep: {
		readonly thresholds: Float64Array;
		readonly tp: Uint32Array;
		readonly fp: Uint32Array;
		readonly tn: Uint32Array;
		readonly fn: Uint32Array;
		readonly tpr: Float64Array;
		readonly fpr: Float64Array;
	} | null;
	/** Ten uniform bins: binary = positive class; multiclass = top-label confidence vs correctness. */
	readonly calibration: {
		readonly meanPredicted: readonly (number | null)[];
		readonly observed: readonly (number | null)[];
		readonly count: Uint32Array;
		readonly expectedCalibrationError: number;
	} | null;
	/** One entry for the positive binary class, otherwise entries in class-axis order. */
	readonly ranking:
		| readonly {
				readonly classIndex: number;
				readonly roc: { readonly fpr: Float64Array; readonly tpr: Float64Array } | null;
				readonly precisionRecall: {
					readonly recall: Float64Array;
					readonly precision: Float64Array;
				} | null;
		  }[]
		| null;
}

/**
 * Versioned evaluation record owned by samata-ml and retained in the result envelope.
 * Every number comes from `web-ml`; Phases 5-7 add optional fields and bump `schemaVersion`.
 */
export interface StoredEvaluation {
	readonly schemaVersion: 1;
	readonly protocol:
		| { readonly kind: 'one_shot'; readonly testRatio: number; readonly randomState: number }
		| {
				readonly kind: 'cross_validation';
				readonly folds: number;
				readonly randomState: number;
		  };
	readonly classLabels: readonly StoredClassLabel[];
	/** Index of the explicit positive label supplied for binary evaluations. */
	readonly positiveClassIndex: number | null;
	readonly partitionFingerprint: string;
	readonly partitions: readonly StoredPartition[];
	/** Pooled over every partition's test rows. */
	readonly pooled: {
		readonly test: StoredReport;
		readonly baselines: StoredPartition['baselines'];
	};
	readonly outputs: StoredOutputs;
	readonly curves: StoredCurves;
}
