import { foldSummary } from '../../common/evaluation/fold-statistics';
import { shownClassIndices } from './results-view-model';
import type {
	MetricUnavailableReason,
	StoredEvaluation,
	StoredMetric,
	StoredReport
} from '../../types/model-evaluation';
import type { ComparisonColumn, ModelColor } from '../../types/state';

/** A model and its current saved evaluation. */
export interface ComparisonModel {
	num: number;
	label: string;
	modelColor: ModelColor;
	evaluation: StoredEvaluation;
}

/** One group of models evaluated on the same partitions. */
export interface ComparisonGroup {
	fingerprint: string;
	protocol: StoredEvaluation['protocol']['kind'];
	models: readonly ComparisonModel[];
	disabled: boolean;
	reason: 'single-model' | 'inconsistent' | null;
}

/** A numeric value or an upstream reason for its absence. */
export interface ComparisonMetricCell {
	value: number | null;
	unavailableReason?: MetricUnavailableReason;
}

/** A model or fixed baseline row. */
export interface ComparisonTableRow {
	id: string;
	label: string;
	num?: number;
	modelColor?: ModelColor;
	kind: 'model' | 'baseline';
	metrics: Readonly<Partial<Record<ComparisonColumn, ComparisonMetricCell>>>;
}

function equalArray(a: ArrayLike<unknown>, b: ArrayLike<unknown>): boolean {
	return a.length === b.length && Array.from(a).every((value, index) => value === b[index]);
}

function consistent(a: StoredEvaluation, b: StoredEvaluation): boolean {
	const partitions = (e: StoredEvaluation) => [...e.partitions].sort((x, y) => x.index - y.index);
	const left = partitions(a);
	const right = partitions(b);
	return (
		a.protocol.kind === b.protocol.kind &&
		a.positiveClassIndex === b.positiveClassIndex &&
		equalArray(a.classLabels, b.classLabels) &&
		left.length === right.length &&
		left.every(
			(p, i) =>
				p.index === right[i]?.index &&
				p.trainSampleCount === right[i]?.trainSampleCount &&
				p.testSampleCount === right[i]?.testSampleCount
		) &&
		equalArray(a.outputs.sourceRowIndex, b.outputs.sourceRowIndex) &&
		equalArray(a.outputs.trueIndex, b.outputs.trueIndex) &&
		equalArray(a.outputs.partitionIndex, b.outputs.partitionIndex)
	);
}

/** Groups evaluations and withholds inconsistent or singleton groups. */
export function groupComparisons(models: readonly ComparisonModel[]): ComparisonGroup[] {
	const groups = new Map<string, ComparisonModel[]>();
	for (const model of [...models].sort((a, b) => a.num - b.num)) {
		const key = model.evaluation.partitionFingerprint;
		groups.set(key, [...(groups.get(key) ?? []), model]);
	}
	return [...groups.entries()]
		.map(([fingerprint, members]) => {
			const first = members[0]!;
			const reason = members.some((model) => !consistent(first.evaluation, model.evaluation))
				? 'inconsistent'
				: members.length < 2
					? 'single-model'
					: null;
			return {
				fingerprint,
				protocol: first.evaluation.protocol.kind,
				models: members,
				disabled: reason !== null,
				reason
			} as ComparisonGroup;
		})
		.sort((a, b) => b.models.length - a.models.length || a.models[0]!.num - b.models[0]!.num);
}

function metric(value: number | null): ComparisonMetricCell {
	return { value };
}

function stored(value: StoredMetric): ComparisonMetricCell {
	return value.available ? metric(value.value) : { value: null, unavailableReason: value.reason };
}

function reportMetrics(
	report: StoredReport,
	positive: number | null
): Partial<Record<ComparisonColumn, ComparisonMetricCell>> {
	const n = report.support.length;
	let diagonal = 0;
	for (let i = 0; i < n; i++) diagonal += report.confusionMatrix[i * n + i]!;
	const result: Partial<Record<ComparisonColumn, ComparisonMetricCell>> = {
		balancedAccuracy: metric(report.balancedAccuracy),
		macroF1: metric(report.macroF1),
		accuracy: metric(report.accuracy),
		mcc: stored(report.mcc),
		rocAuc: stored(report.rocAuc),
		averagePrecision: stored(report.averagePrecision),
		logLoss: stored(report.logLoss),
		brier: stored(report.brier),
		errors: metric(report.sampleCount - diagonal)
	};
	if (n === 2 && positive !== null) {
		const negative = 1 - positive;
		result.falsePositives = metric(report.confusionMatrix[negative * n + positive]!);
		result.falseNegatives = metric(report.confusionMatrix[positive * n + negative]!);
	}
	return result;
}

/** Projects an upstream pooled report and its fold summaries into a comparison row. */
export function comparisonTableRow(model: ComparisonModel): ComparisonTableRow {
	const e = model.evaluation;
	const scores = e.partitions.map((p) => p.test.balancedAccuracy);
	const summary = foldSummary(scores);
	const gap =
		e.partitions.reduce(
			(sum, p) => sum + p.train.balancedAccuracy - p.test.balancedAccuracy,
			0
		) / e.partitions.length;
	return {
		id: String(model.num),
		label: model.label,
		num: model.num,
		modelColor: model.modelColor,
		kind: 'model',
		metrics: {
			...reportMetrics(e.pooled.test, e.positiveClassIndex),
			ece: e.curves.calibration
				? metric(e.curves.calibration.expectedCalibrationError)
				: { value: null, unavailableReason: 'not-requested' },
			sd: metric(summary.sd),
			iqr: metric(summary.iqr),
			gap: metric(gap),
			fitDuration: metric(e.partitions.reduce((sum, p) => sum + p.durationMs, 0))
		}
	};
}

/** Sorts model rows by raw values, keeping unavailable entries last and ties in model order. */
export function sortComparisonRows(
	rows: readonly ComparisonTableRow[],
	sort: { column: ComparisonColumn; direction: 'ascending' | 'descending' } | null
): ComparisonTableRow[] {
	return [...rows].sort((a, b) => {
		const tie = Number(a.id) - Number(b.id);
		if (!sort) return tie;
		const left = a.metrics[sort.column]?.value ?? null;
		const right = b.metrics[sort.column]?.value ?? null;
		if (left === null) return right === null ? tie : 1;
		if (right === null) return -1;
		return (sort.direction === 'ascending' ? left - right : right - left) || tie;
	});
}

function reportEqual(a: StoredReport, b: StoredReport): boolean {
	return Object.keys(a).every((key) => {
		const x = a[key as keyof StoredReport],
			y = b[key as keyof StoredReport];
		return ArrayBuffer.isView(x) && ArrayBuffer.isView(y)
			? equalArray(x as unknown as ArrayLike<unknown>, y as unknown as ArrayLike<unknown>)
			: JSON.stringify(x) === JSON.stringify(y);
	});
}

/** Returns independently agreed pooled baseline rows, in fixed order. */
export function comparisonBaselines(models: readonly ComparisonModel[]): {
	rows: ComparisonTableRow[];
	mismatched: ('mostFrequent' | 'stratified')[];
} {
	const sorted = [...models].sort((a, b) => a.num - b.num);
	const first = sorted[0];
	const rows: ComparisonTableRow[] = [];
	const mismatched: ('mostFrequent' | 'stratified')[] = [];
	if (!first) return { rows, mismatched };
	for (const key of ['mostFrequent', 'stratified'] as const) {
		const report = first.evaluation.pooled.baselines[key];
		if (sorted.some((model) => !reportEqual(report, model.evaluation.pooled.baselines[key]))) {
			mismatched.push(key);
			continue;
		}
		rows.push({
			id: key,
			label: key,
			kind: 'baseline',
			metrics: reportMetrics(report, first.evaluation.positiveClassIndex)
		});
	}
	return { rows, mismatched };
}

/** Counts evaluated rows by the number of selected models predicting correctly. */
export function agreementCounts(models: readonly ComparisonModel[]): number[] {
	const counts = Array.from({ length: models.length + 1 }, () => 0);
	const first = models[0];
	if (!first || models.some((model) => !consistent(first.evaluation, model.evaluation)))
		return counts;
	for (let i = 0; i < first.evaluation.outputs.trueIndex.length; i++) {
		const correct = models.filter(
			(model) =>
				model.evaluation.outputs.predictedIndex[i] === first.evaluation.outputs.trueIndex[i]
		).length;
		counts[correct]!++;
	}
	return counts;
}

/** Computes A minus B on a validated shared class axis. */
export function confusionDelta(a: ComparisonModel, b: ComparisonModel): number[] | null {
	if (!consistent(a.evaluation, b.evaluation)) return null;
	return Array.from(
		a.evaluation.pooled.test.confusionMatrix,
		(value, i) => value - b.evaluation.pooled.test.confusionMatrix[i]!
	);
}

/** Projects a validated confusion difference with its class axis and largest off-diagonal change. */
export function comparisonConfusionView(
	a: ComparisonModel,
	b: ComparisonModel,
	classFilter: number | null
) {
	const counts = confusionDelta(a, b);
	if (!counts) return null;
	const labels = a.evaluation.classLabels.map(String);
	let largest: { trueIndex: number; predictedIndex: number; count: number } | null = null;
	for (let row = 0; row < labels.length; row++) {
		for (let column = 0; column < labels.length; column++) {
			const count = counts[row * labels.length + column]!;
			if (
				row !== column &&
				count !== 0 &&
				(!largest || Math.abs(count) > Math.abs(largest.count))
			) {
				largest = { trueIndex: row, predictedIndex: column, count };
			}
		}
	}
	return {
		labelA: a.label,
		labelB: b.label,
		labels,
		counts,
		shownClassIndices: shownClassIndices(a.evaluation, classFilter),
		largest
	};
}

/** Projects pooled recall into per-class error rates without recomputing metrics. */
export function classErrorRows(models: readonly ComparisonModel[]) {
	const first = models[0];
	if (!first || models.some((model) => !consistent(first.evaluation, model.evaluation)))
		return [];
	return first.evaluation.classLabels.map((label, classIndex) => ({
		classIndex,
		label: String(label),
		models: models.map((model) => ({
			num: model.num,
			label: model.label,
			modelColor: model.modelColor,
			support: model.evaluation.pooled.test.support[classIndex] ?? null,
			errorCount:
				model.evaluation.pooled.test.support[classIndex] === undefined
					? null
					: model.evaluation.pooled.test.support[classIndex]! -
						model.evaluation.pooled.test.confusionMatrix[
							classIndex * first.evaluation.classLabels.length + classIndex
						]!,
			errorRate: model.evaluation.pooled.test.support[classIndex]
				? 1 - model.evaluation.pooled.test.recallPerClass[classIndex]!
				: null
		}))
	}));
}
