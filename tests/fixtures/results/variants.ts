import type { StoredEvaluation } from '../../../src/types/model-evaluation';
import { reportFromConfusion } from './evaluations';

/** Replaces the pooled held-out report with one built from the given confusion matrix. */
export function withPooledConfusion(
	evaluation: StoredEvaluation,
	cells: readonly number[]
): StoredEvaluation {
	const report = reportFromConfusion(evaluation.classLabels.length, cells);
	return { ...evaluation, pooled: { ...evaluation.pooled, test: report } };
}

/** Gives every class a very long descriptive name. */
export function withLongLabels(evaluation: StoredEvaluation): StoredEvaluation {
	return {
		...evaluation,
		classLabels: evaluation.classLabels.map(
			(label, index) => `${String(label)} with an exceptionally long class name ${index}`
		)
	};
}
