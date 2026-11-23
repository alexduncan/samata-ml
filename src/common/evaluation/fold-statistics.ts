/** Presentation summary of one score across outer folds. */
export interface FoldSummary {
	mean: number;
	/** Sample standard deviation (n - 1); null for fewer than two values. */
	sd: number | null;
	q1: number | null;
	median: number;
	q3: number | null;
	/** Interquartile range; null for fewer than two values. */
	iqr: number | null;
}

/** Linear-interpolated (type 7) quantile of an ascending array. */
function quantile(sorted: readonly number[], p: number): number {
	const position = (sorted.length - 1) * p;
	const lower = Math.floor(position);
	const upper = Math.ceil(position);
	return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (position - lower);
}

/**
 * Summarises per-fold scores for display: unweighted mean, sample SD (n - 1) and type-7
 * quartiles. The values themselves come from `web-ml`.
 *
 * @throws {RangeError} For an empty array or a non-finite value.
 */
export function foldSummary(values: readonly number[]): FoldSummary {
	if (values.length === 0) throw new RangeError('foldSummary needs at least one value');
	if (values.some((value) => !Number.isFinite(value))) {
		throw new RangeError('foldSummary needs finite values');
	}
	const sorted = [...values].sort((a, b) => a - b);
	const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
	const median = quantile(sorted, 0.5);
	if (values.length < 2) return { mean, sd: null, q1: null, median, q3: null, iqr: null };
	const variance =
		values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
	const q1 = quantile(sorted, 0.25);
	const q3 = quantile(sorted, 0.75);
	return { mean, sd: Math.sqrt(variance), q1, median, q3, iqr: q3 - q1 };
}
