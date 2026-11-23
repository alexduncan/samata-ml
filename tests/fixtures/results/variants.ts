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

/** Empties one calibration bin: zero rows and null means, as `web-ml` reports it. */
export function withEmptyCalibrationBin(
	evaluation: StoredEvaluation,
	bin: number
): StoredEvaluation {
	const calibration = evaluation.curves.calibration!;
	const count = Uint32Array.from(calibration.count);
	count[bin] = 0;
	return {
		...evaluation,
		curves: {
			...evaluation.curves,
			calibration: {
				...calibration,
				count,
				meanPredicted: calibration.meanPredicted.map((value, index) =>
					index === bin ? null : value
				),
				observed: calibration.observed.map((value, index) => (index === bin ? null : value))
			}
		}
	};
}
