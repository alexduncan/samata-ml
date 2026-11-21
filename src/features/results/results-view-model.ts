import { foldSummary } from '../../common/evaluation/fold-statistics';
import type {
	MetricUnavailableReason,
	StoredEvaluation,
	StoredMetric,
	StoredReport
} from '../../types/model-evaluation';

/** Minimal number formatter, satisfied by the i18n `$format` store value. */
export interface NumberFormatter {
	number(value: number, options?: Intl.NumberFormatOptions): string;
}

/** Locale-aware formatters used to preformat every number shown in Section 6. */
export interface ResultsFormatters {
	/** A fraction from 0 to 1 as a percentage. */
	percent(value: number): string;
	/** A whole count. */
	count(value: number): string;
	/** Elapsed milliseconds as seconds. */
	seconds(milliseconds: number): string;
	/** A fraction difference as unsigned percentage points. */
	points(value: number): string;
	/** A fraction difference as signed percentage points. */
	signedPoints(value: number): string;
	/** A probability-based score such as ROC-AUC or log loss, to three decimal places. */
	decimal(value: number): string;
}

/** Builds the Section 6 formatters from the application number formatter. */
export function createResultsFormatters(format: NumberFormatter): ResultsFormatters {
	return {
		percent: (value) => format.number(value, { style: 'percent', maximumFractionDigits: 1 }),
		count: (value) => format.number(value, { maximumFractionDigits: 0 }),
		seconds: (milliseconds) =>
			format.number(milliseconds / 1000, {
				style: 'unit',
				unit: 'second',
				maximumFractionDigits: 1
			}),
		points: (value) => format.number(value * 100, { maximumFractionDigits: 1 }),
		signedPoints: (value) =>
			format.number(value * 100, { maximumFractionDigits: 1, signDisplay: 'exceptZero' }),
		decimal: (value) => format.number(value, { maximumFractionDigits: 3 })
	};
}

/** A chart title with a one-sentence takeaway, built by the connected component. */
export interface ChartCaption {
	readonly title: string;
	readonly takeaway: string;
}

/** Minimum paired training minus held-out balanced accuracy that raises the diagnostic card. */
export const GAP_THRESHOLD = 0.1;
const GAP_TOLERANCE = 1e-12;

/** Identifies one row of the "More metrics" disclosure. */
export type MoreMetricId =
	| 'macroF1'
	| 'mcc'
	| 'rocAuc'
	| 'averagePrecision'
	| 'logLoss'
	| 'brier'
	| 'ece';

/** One "More metrics" row: a formatted value or the reason it is unavailable. */
export interface MetricRowView {
	readonly id: MoreMetricId;
	readonly value: string | null;
	readonly reason: MetricUnavailableReason | null;
}

/** Names of the run shown above the headline. */
export interface ResultsRunNames {
	readonly modelName: string;
	readonly datasetName: string;
	readonly target: string;
}

/** Preformatted view of the run line, headline, gap card and "More metrics". */
export interface ResultsSummaryView extends ResultsRunNames {
	readonly protocol: 'one_shot' | 'cross_validation';
	/** Number of held-out partitions (one for One-Shot). */
	readonly partitions: number;
	readonly classCount: number;
	/** Evaluated rows, formatted. */
	readonly rows: string;
	/** One-Shot fit time or the cross-validation fit-and-scoring total, formatted. */
	readonly time: string;
	/** Headline balanced accuracy: the fold mean for cross-validation. */
	readonly balancedAccuracy: string;
	/** Fold spread; null when the run has one test split. */
	readonly spread: { readonly sd: string; readonly iqr: string } | null;
	readonly accuracy: string;
	readonly baselineAccuracy: string;
	/** Signed percentage points above the most-frequent baseline. */
	readonly accuracyDelta: string;
	readonly accuracyDirection: 'above' | 'level' | 'below';
	/** Macro-F1 for the multiclass headline; null for binary, where it sits in More metrics. */
	readonly macroF1: string | null;
	/** Present when the training score exceeds the held-out score by at least ten points. */
	readonly gap: {
		readonly fitted: string;
		readonly heldOut: string;
		readonly points: string;
	} | null;
	readonly more: readonly MetricRowView[];
}

function metricRow(
	id: MoreMetricId,
	metric: StoredMetric,
	format: (value: number) => string
): MetricRowView {
	return metric.available
		? { id, value: format(metric.value), reason: null }
		: { id, value: null, reason: metric.reason };
}

function mean(values: readonly number[]): number {
	return values.reduce((total, value) => total + value, 0) / values.length;
}

/** Mean paired training minus held-out balanced accuracy across partitions. */
export function trainTestGap(evaluation: StoredEvaluation): {
	readonly fitted: number;
	readonly heldOut: number;
	readonly gap: number;
} {
	const fitted = mean(evaluation.partitions.map((part) => part.train.balancedAccuracy));
	const heldOut = mean(evaluation.partitions.map((part) => part.test.balancedAccuracy));
	return {
		fitted,
		heldOut,
		gap: mean(
			evaluation.partitions.map(
				(part) => part.train.balancedAccuracy - part.test.balancedAccuracy
			)
		)
	};
}

/** Builds the summary view from a stored evaluation. No metric is computed here. */
export function buildSummaryView(
	evaluation: StoredEvaluation,
	names: ResultsRunNames,
	format: ResultsFormatters
): ResultsSummaryView {
	const pooled = evaluation.pooled.test;
	const crossValidation = evaluation.protocol.kind === 'cross_validation';
	const scores = evaluation.partitions.map((part) => part.test.balancedAccuracy);
	const fold = foldSummary(scores);
	const binary = evaluation.classLabels.length === 2;
	const delta = pooled.accuracy - evaluation.pooled.baselines.mostFrequent.accuracy;
	const gap = trainTestGap(evaluation);
	const calibration = evaluation.curves.calibration;
	const eceReason: MetricUnavailableReason =
		evaluation.outputs.probabilities === null ? 'probabilities-unavailable' : 'not-applicable';
	const more: MetricRowView[] = [];
	if (binary) {
		more.push({ id: 'macroF1', value: format.percent(pooled.macroF1), reason: null });
	}
	more.push(
		metricRow('mcc', pooled.mcc, format.decimal),
		metricRow('rocAuc', pooled.rocAuc, format.decimal),
		metricRow('averagePrecision', pooled.averagePrecision, format.decimal),
		metricRow('logLoss', pooled.logLoss, format.decimal),
		metricRow('brier', pooled.brier, format.decimal),
		calibration
			? {
					id: 'ece',
					value: format.decimal(calibration.expectedCalibrationError),
					reason: null
				}
			: { id: 'ece', value: null, reason: eceReason }
	);
	const durations = evaluation.partitions.map((part) => part.durationMs);
	return {
		...names,
		protocol: evaluation.protocol.kind,
		partitions: evaluation.partitions.length,
		classCount: evaluation.classLabels.length,
		rows: format.count(pooled.sampleCount),
		time: format.seconds(
			crossValidation ? durations.reduce((a, b) => a + b, 0) : durations[0]!
		),
		balancedAccuracy: format.percent(fold.mean),
		spread:
			fold.sd !== null && fold.iqr !== null
				? { sd: format.points(fold.sd), iqr: format.points(fold.iqr) }
				: null,
		accuracy: format.percent(pooled.accuracy),
		baselineAccuracy: format.percent(evaluation.pooled.baselines.mostFrequent.accuracy),
		accuracyDelta: format.signedPoints(delta),
		accuracyDirection: Math.abs(delta) < 5e-4 ? 'level' : delta > 0 ? 'above' : 'below',
		macroF1: binary ? null : format.percent(pooled.macroF1),
		gap:
			gap.gap >= GAP_THRESHOLD - GAP_TOLERANCE
				? {
						fitted: format.percent(gap.fitted),
						heldOut: format.percent(gap.heldOut),
						points: format.points(gap.gap)
					}
				: null,
		more
	};
}

/** One plotted dot: a held-out partition score and its preformatted timing. */
export interface FoldValue {
	readonly score: number;
	readonly timingLabel: string;
}

/** A row of dots on the fold strip. */
export interface FoldSeries {
	readonly id: string;
	readonly label: string;
	readonly values: readonly FoldValue[];
	readonly mean: number;
	/** Sample SD of the scores; null for a single score. */
	readonly sd: number | null;
}

/** A labelled dashed baseline rule. */
export interface BaselineMark {
	readonly id: string;
	readonly label: string;
	readonly value: number;
}

/** Everything the fold strip draws. */
export interface FoldStripView {
	readonly series: readonly FoldSeries[];
	readonly baselines: readonly BaselineMark[];
}

/** Display names for the fold strip rows. */
export interface FoldStripNames {
	readonly series: string;
	readonly mostFrequent: string;
	readonly stratified: string;
}

/** Builds the fold-strip data; baselines use the mean of each baseline's partition scores. */
export function buildFoldStripView(
	evaluation: StoredEvaluation,
	names: FoldStripNames,
	format: ResultsFormatters
): FoldStripView {
	const scores = evaluation.partitions.map((part) => part.test.balancedAccuracy);
	const summary = foldSummary(scores);
	return {
		series: [
			{
				id: 'model',
				label: names.series,
				values: evaluation.partitions.map((part) => ({
					score: part.test.balancedAccuracy,
					timingLabel: format.seconds(part.durationMs)
				})),
				mean: summary.mean,
				sd: summary.sd
			}
		],
		baselines: [
			{
				id: 'most-frequent',
				label: names.mostFrequent,
				value: mean(
					evaluation.partitions.map(
						(part) => part.baselines.mostFrequent.balancedAccuracy
					)
				)
			},
			{
				id: 'stratified',
				label: names.stratified,
				value: mean(
					evaluation.partitions.map((part) => part.baselines.stratified.balancedAccuracy)
				)
			}
		]
	};
}

/** One row of the per-class table, preformatted. */
export interface ClassMetricsRow {
	readonly index: number;
	readonly label: string;
	readonly support: string;
	readonly precision: string;
	readonly recall: string;
	readonly f1: string;
}

/** Renders a stored class label as text. */
export function classText(label: StoredEvaluation['classLabels'][number]): string {
	return String(label);
}

/** Builds the pooled per-class precision, recall and F1 rows in class-axis order. */
export function buildClassMetricsRows(
	evaluation: StoredEvaluation,
	format: ResultsFormatters
): readonly ClassMetricsRow[] {
	const report: StoredReport = evaluation.pooled.test;
	return evaluation.classLabels.map((label, index) => ({
		index,
		label: classText(label),
		support: format.count(report.support[index]!),
		precision: format.percent(report.precisionPerClass[index]!),
		recall: format.percent(report.recallPerClass[index]!),
		f1: format.percent(report.f1PerClass[index]!)
	}));
}

/** Class count above which the error views offer a class filter. */
export const MANY_CLASSES = 20;

/** One cell of the confusion matrix. */
export interface ConfusionCellView {
	readonly count: number;
	readonly text: string;
	readonly correct: boolean;
}

/** One shown row (true class) of the confusion matrix. */
export interface ConfusionRowView {
	readonly index: number;
	readonly label: string;
	readonly support: string;
	readonly cells: readonly ConfusionCellView[];
}

/** The confusion matrix with the D11 many-class row selection applied. */
export interface ConfusionMatrixView {
	/** `test` for a single test split, `held-out` when pooled over folds. */
	readonly scope: 'test' | 'held-out';
	readonly classCount: number;
	readonly filterable: boolean;
	/** The chosen true class, or null for the default selection. */
	readonly selected: number | null;
	/** Every class, in axis order, for the filter. */
	readonly options: readonly { readonly index: number; readonly label: string }[];
	readonly columns: readonly { readonly index: number; readonly label: string }[];
	readonly rows: readonly ConfusionRowView[];
}

/**
 * Chooses the true classes shown in an error view (D11). With more than twenty classes the
 * default is the twenty largest supports (ties by class index), otherwise every class; a valid
 * `classFilter` shows only that class. Rows keep the original axis order.
 */
export function shownClassIndices(
	evaluation: StoredEvaluation,
	classFilter: number | null
): readonly number[] {
	const count = evaluation.classLabels.length;
	if (count <= MANY_CLASSES) return Array.from({ length: count }, (_, index) => index);
	if (classFilter !== null && classFilter >= 0 && classFilter < count) return [classFilter];
	const support = evaluation.pooled.test.support;
	return Array.from({ length: count }, (_, index) => index)
		.sort((a, b) => support[b]! - support[a]! || a - b)
		.slice(0, MANY_CLASSES)
		.sort((a, b) => a - b);
}

/** Builds the confusion-matrix view from the pooled held-out report. */
export function buildConfusionMatrixView(
	evaluation: StoredEvaluation,
	classFilter: number | null,
	format: ResultsFormatters
): ConfusionMatrixView {
	const count = evaluation.classLabels.length;
	const report = evaluation.pooled.test;
	const filterable = count > MANY_CLASSES;
	const shown = shownClassIndices(evaluation, classFilter);
	const labels = evaluation.classLabels.map(classText);
	return {
		scope: evaluation.protocol.kind === 'one_shot' ? 'test' : 'held-out',
		classCount: count,
		filterable,
		selected: filterable && shown.length === 1 ? shown[0]! : null,
		options: labels.map((label, index) => ({ index, label })),
		columns: labels.map((label, index) => ({ index, label })),
		rows: shown.map((row) => ({
			index: row,
			label: labels[row]!,
			support: format.count(report.support[row]!),
			cells: labels.map((_, column) => {
				const cell = report.confusionMatrix[row * count + column]!;
				return { count: cell, text: format.count(cell), correct: row === column };
			})
		}))
	};
}

/** One predicted outcome of an actual class in the binary flowchart. */
export interface FlowOutcome {
	readonly predictedIndex: number;
	readonly predicted: string;
	readonly count: number;
	readonly text: string;
	/** Fraction of the actual class's held-out rows; sets the bar width. */
	readonly share: number;
	readonly correct: boolean;
}

/** One actual class of the binary flowchart and its two outcomes. */
export interface FlowRow {
	readonly actualIndex: number;
	readonly actual: string;
	readonly total: number;
	readonly totalText: string;
	readonly outcomes: readonly FlowOutcome[];
}

/** Held-out rows of each actual class split by the predicted class. */
export interface BinaryFlowView {
	readonly target: string;
	readonly rows: readonly FlowRow[];
}

/** Builds the binary flowchart from the pooled confusion matrix; null unless there are two classes. */
export function buildBinaryFlowView(
	evaluation: StoredEvaluation,
	target: string,
	format: ResultsFormatters
): BinaryFlowView | null {
	if (evaluation.classLabels.length !== 2) return null;
	const report = evaluation.pooled.test;
	const labels = evaluation.classLabels.map(classText);
	return {
		target,
		rows: labels.map((actual, actualIndex) => {
			const counts = [0, 1].map(
				(column) => report.confusionMatrix[actualIndex * 2 + column]!
			);
			const total = counts[0]! + counts[1]!;
			return {
				actualIndex,
				actual,
				total,
				totalText: format.count(total),
				outcomes: counts.map((count, predictedIndex) => ({
					predictedIndex,
					predicted: labels[predictedIndex]!,
					count,
					text: format.count(count),
					share: total === 0 ? 0 : count / total,
					correct: predictedIndex === actualIndex
				}))
			};
		})
	};
}

/** A stack segment of wrongly predicted rows, or the correct run. */
export interface ClasseeSegment {
	readonly predictedIndex: number;
	readonly predicted: string;
	readonly count: number;
	readonly text: string;
}

/** One true class of the multiclass error strips. */
export interface ClasseeRow {
	readonly classIndex: number;
	readonly label: string;
	readonly correct: ClasseeSegment;
	/** Non-zero errors in predicted-class order, stacked leftwards from zero. */
	readonly errors: readonly ClasseeSegment[];
	readonly errorCount: number;
	readonly errorText: string;
}

/** Per-class correct and wrong counts for the multiclass strips. */
export interface ClasseeView {
	readonly classCount: number;
	readonly rows: readonly ClasseeRow[];
	readonly maxCorrect: number;
	readonly maxErrors: number;
	readonly totalErrors: number;
}

/** Builds the Classee strips for the shown true classes; null for fewer than three classes. */
export function buildClasseeView(
	evaluation: StoredEvaluation,
	classFilter: number | null,
	format: ResultsFormatters
): ClasseeView | null {
	const count = evaluation.classLabels.length;
	if (count < 3) return null;
	const report = evaluation.pooled.test;
	const labels = evaluation.classLabels.map(classText);
	const rows = shownClassIndices(evaluation, classFilter).map((row): ClasseeRow => {
		const cell = (column: number) => report.confusionMatrix[row * count + column]!;
		const errors = labels.flatMap((predicted, column) =>
			column !== row && cell(column) > 0
				? [
						{
							predictedIndex: column,
							predicted,
							count: cell(column),
							text: format.count(cell(column))
						}
					]
				: []
		);
		const errorCount = errors.reduce((total, segment) => total + segment.count, 0);
		return {
			classIndex: row,
			label: labels[row]!,
			correct: {
				predictedIndex: row,
				predicted: labels[row]!,
				count: cell(row),
				text: format.count(cell(row))
			},
			errors,
			errorCount,
			errorText: format.count(errorCount)
		};
	});
	return {
		classCount: count,
		rows,
		maxCorrect: Math.max(0, ...rows.map((row) => row.correct.count)),
		maxErrors: Math.max(0, ...rows.map((row) => row.errorCount)),
		totalErrors: rows.reduce((total, row) => total + row.errorCount, 0)
	};
}

/** Number of display bins in the threshold histogram. */
export const HISTOGRAM_BINS = 20;

/** One 5-percentage-point bin of positive-class probabilities, counted by true class. */
export interface ProbabilityBin {
	readonly lower: number;
	readonly upper: number;
	/** Held-out rows of the negative class in this bin. */
	readonly negative: number;
	/** Held-out rows of the positive class in this bin. */
	readonly positive: number;
}

/** Counts and rates the probability-threshold explorer shows at one cutoff. */
export interface ThresholdReadout {
	readonly threshold: number;
	readonly tp: number;
	readonly fp: number;
	readonly tn: number;
	readonly fn: number;
	readonly tpr: number;
	readonly fpr: number;
}

/** The stored threshold sweep with the class names it needs. Binary targets with probabilities only. */
export interface ThresholdView {
	readonly target: string;
	readonly positive: string;
	readonly negative: string;
	/** Largest stored cutoff index (100). */
	readonly lastIndex: number;
	readonly bins: readonly ProbabilityBin[];
	readonly maxBinCount: number;
	readonly readouts: readonly ThresholdReadout[];
}

/**
 * Builds the explorer data from `curves.thresholdSweep`; null unless the target is binary and
 * the model reported probabilities. Histogram bins are differences of adjacent cumulative
 * sweep counts, so every number is a stored `web-ml` count.
 */
export function buildThresholdView(
	evaluation: StoredEvaluation,
	target: string
): ThresholdView | null {
	const sweep = evaluation.curves.thresholdSweep;
	const positiveIndex = evaluation.positiveClassIndex;
	if (!sweep || positiveIndex === null || evaluation.classLabels.length !== 2) return null;
	const step = (sweep.thresholds.length - 1) / HISTOGRAM_BINS;
	const bins: ProbabilityBin[] = [];
	for (let bin = 0; bin < HISTOGRAM_BINS; bin += 1) {
		const from = bin * step;
		const to = from + step;
		const last = bin === HISTOGRAM_BINS - 1;
		bins.push({
			lower: sweep.thresholds[from]!,
			upper: last ? 1 : sweep.thresholds[to]!,
			negative: last ? sweep.fp[from]! : sweep.fp[from]! - sweep.fp[to]!,
			positive: last ? sweep.tp[from]! : sweep.tp[from]! - sweep.tp[to]!
		});
	}
	return {
		target,
		positive: classText(evaluation.classLabels[positiveIndex]!),
		negative: classText(evaluation.classLabels[1 - positiveIndex]!),
		lastIndex: sweep.thresholds.length - 1,
		bins,
		maxBinCount: Math.max(1, ...bins.map((bin) => Math.max(bin.negative, bin.positive))),
		readouts: Array.from(sweep.thresholds, (threshold, index) => ({
			threshold,
			tp: sweep.tp[index]!,
			fp: sweep.fp[index]!,
			tn: sweep.tn[index]!,
			fn: sweep.fn[index]!,
			tpr: sweep.tpr[index]!,
			fpr: sweep.fpr[index]!
		}))
	};
}

/** One of the ten uniform calibration bins. */
export interface CalibrationBin {
	readonly lower: number;
	readonly upper: number;
	readonly count: number;
	/** Mean predicted probability; null for an empty bin. */
	readonly meanPredicted: number | null;
	/** Observed positive rate (or top-label accuracy); null for an empty bin. */
	readonly observed: number | null;
}

/** Calibration bins and expected calibration error. */
export interface CalibrationView {
	/** `binary` plots the positive class; `top-label` plots confidence against correctness. */
	readonly mode: 'binary' | 'top-label';
	readonly bins: readonly CalibrationBin[];
	readonly ece: number;
	/** ECE formatted for captions. */
	readonly eceText: string;
}

/** Builds the reliability data from `curves.calibration`; null when probabilities are unavailable. */
export function buildCalibrationView(
	evaluation: StoredEvaluation,
	format: ResultsFormatters
): CalibrationView | null {
	const calibration = evaluation.curves.calibration;
	if (!calibration) return null;
	const count = calibration.count.length;
	return {
		mode: evaluation.classLabels.length === 2 ? 'binary' : 'top-label',
		bins: Array.from(calibration.count, (binCount, index) => ({
			lower: index / count,
			upper: (index + 1) / count,
			count: binCount,
			meanPredicted: calibration.meanPredicted[index] ?? null,
			observed: calibration.observed[index] ?? null
		})),
		ece: calibration.expectedCalibrationError,
		eceText: format.decimal(calibration.expectedCalibrationError)
	};
}
