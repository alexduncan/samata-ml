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
