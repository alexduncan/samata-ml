import type { StoredEvaluation } from '../../types/model-evaluation';
import { foldSummary } from './fold-statistics';

/**
 * Headline numbers kept on `ModelRecord.metrics`: the pooled held-out scores reported by
 * `web-ml`, plus the sample SD of per-fold balanced accuracy when there are two or more
 * partitions. Publication and startup reconciliation share this projection.
 */
export function headlineMetrics(evaluation: StoredEvaluation): Record<string, number> {
	const { balancedAccuracy, accuracy, macroF1 } = evaluation.pooled.test;
	const metrics: Record<string, number> = { balancedAccuracy, accuracy, macroF1 };
	if (evaluation.partitions.length >= 2) {
		const sd = foldSummary(
			evaluation.partitions.map((partition) => partition.test.balancedAccuracy)
		).sd;
		if (sd !== null) metrics.balancedAccuracySd = sd;
	}
	return metrics;
}
