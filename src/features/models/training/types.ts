import type { ClassificationLabel, TabularColumn } from 'web-ml';

/** Identifies the columns selected for one classification run. */
export interface ClassificationSelection {
	readonly datasetId: string;
	readonly target: string;
	readonly features: readonly string[];
}

/** Row-major transport with codes in the same order as the retained source rows. */
export interface PreparedClassification {
	readonly features: Float64Array;
	readonly columns: readonly TabularColumn[];
	readonly targetCodes: Float64Array;
	readonly classLabels: readonly ClassificationLabel[];
	readonly sourceRowIndices: readonly number[];
	readonly excludedTargetRows: number;
}

/** Safe categories for input or public-library contract errors. */
export type ClassificationErrorCode =
	| 'dataset-unavailable'
	| 'metadata-mismatch'
	| 'row-type-mismatch'
	| 'invalid-dimensions'
	| 'invalid-options'
	| 'contract-error';

/** A failure whose code can be reported without exposing dataset values. */
export class ClassificationError extends Error {
	constructor(readonly code: ClassificationErrorCode) {
		super(code);
		this.name = 'ClassificationError';
	}
}
