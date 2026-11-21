import type { ReliabilityDiagramLabels } from '../../../src/features/results/app-reliability-diagram';
import type { ThresholdExplorerLabels } from '../../../src/features/results/app-threshold-explorer';
import type { ClasseeStripsLabels } from '../../../src/features/results/app-classee-strips';
import type { ConfusionFlowchartLabels } from '../../../src/features/results/app-confusion-flowchart';
import type { ChartCaption } from '../../../src/features/results/results-view-model';
import type { ClassMetricsTableLabels } from '../../../src/features/results/app-class-metrics-table';
import type { ConfusionMatrixLabels } from '../../../src/features/results/app-confusion-matrix';
import type { FoldStripLabels } from '../../../src/features/results/app-fold-strip';
import type { ResultsSummaryLabels } from '../../../src/features/results/app-results-summary';

/*
 * English label sets for stories and browser tests. The connected results view owns the real
 * i18n messages; presentational elements only ever receive text through `labels`.
 */

/** English labels for `app-results-summary`. */
export const englishSummaryLabels: ResultsSummaryLabels = {
	runLine: (view) =>
		`${view.modelName} on ${view.datasetName}, predicting ${view.target}. ` +
		(view.protocol === 'one_shot'
			? 'One test split'
			: `${view.partitions}-fold cross-validation`) +
		`, ${view.rows} held-out rows scored.`,
	timeLine: (view) =>
		view.protocol === 'one_shot'
			? `Fit time: ${view.time}`
			: `Total fit and scoring time across folds: ${view.time}`,
	balancedAccuracy: 'Balanced accuracy on held-out rows',
	balancedAccuracyValue: (view) =>
		view.spread ? `${view.balancedAccuracy} ± ${view.spread.sd} points` : view.balancedAccuracy,
	spreadLine: (view) =>
		view.spread
			? `Standard deviation ${view.spread.sd} points; interquartile range ${view.spread.iqr} points across ${view.partitions} folds.`
			: 'One test split: no spread is available. Cross-Validation shows how scores vary across folds.',
	accuracy: 'Accuracy',
	baselineLine: (view) =>
		`Always predicting the most frequent class scores ${view.baselineAccuracy}; the difference is ${view.accuracyDelta} percentage points.`,
	macroF1: 'Macro-F1',
	moreMetrics: 'More metrics',
	metricNames: {
		macroF1: 'Macro-F1',
		mcc: 'Matthews correlation coefficient (MCC)',
		rocAuc: 'ROC-AUC',
		averagePrecision: 'Average precision',
		logLoss: 'Log loss',
		brier: 'Brier score',
		ece: 'Expected calibration error (ECE)'
	},
	reasons: {
		'not-requested': 'Not requested for this run.',
		'probabilities-unavailable':
			'Unavailable because this model was trained without probability estimates.',
		'unseen-validation-labels': 'Unavailable because held-out rows contain unseen classes.',
		'undefined-for-validation-classes':
			'Unavailable because the held-out rows do not contain every class.',
		'all-targets-zero': 'Unavailable because every target is zero.',
		'negative-targets': 'Unavailable because a target is negative.',
		'not-applicable': 'Not applicable to this model.',
		'insufficient-degrees-of-freedom': 'Unavailable because there are too few rows.',
		'single-class': 'Unavailable because the held-out rows contain one class.'
	},
	gapTitle: 'Large gap between training and held-out scores.',
	gapText: (gap) =>
		`The model scored ${gap.fitted} on the rows it learned from but ${gap.heldOut} on held-out rows, ${gap.points} percentage points lower.`
};

/** English labels for `app-fold-strip`. */
export const englishFoldStripLabels: FoldStripLabels = {
	showTable: 'Show data table',
	tableCaption: 'Held-out balanced accuracy by partition',
	series: 'Series',
	partition: (index) => `Partition ${index}`,
	score: 'Balanced accuracy',
	time: 'Fit and scoring time',
	mean: 'Mean',
	standardDeviation: 'Standard deviation'
};

/** English labels for `app-class-metrics-table`. */
export const englishClassMetricsLabels: ClassMetricsTableLabels = {
	caption: 'Precision, recall and F1 for each class on held-out rows',
	class: 'Class',
	support: 'Held-out rows',
	precision: 'Precision',
	recall: 'Recall',
	f1: 'F1'
};

/** English labels for `app-confusion-matrix`. */
export const englishConfusionMatrixLabels: ConfusionMatrixLabels = {
	caption: (view) =>
		`Confusion matrix, ${view.rows.length} of ${view.classCount} true classes, ${
			view.scope === 'test' ? 'test rows only' : 'held-out rows'
		}`,
	trueClass: 'True class',
	predictedClass: 'Predicted class',
	support: 'Rows',
	filter: 'Show true class',
	defaultFilter: 'Twenty largest classes'
};

/** A caption for tests and stories. */
export const sampleCaption: ChartCaption = {
	title: 'Balanced accuracy by fold',
	takeaway: 'Scores ranged from 93.3% to 100%, around a mean of 96.7%.'
};

/** English labels for `app-confusion-flowchart`. */
export const englishFlowchartLabels: ConfusionFlowchartLabels = {
	rowHeading: (row, flow) => `Rows with ${flow.target} ${row.actual}: ${row.totalText}`,
	outcome: (outcome, row, flow) =>
		`${outcome.text} rows with ${flow.target} ${row.actual} were predicted ${outcome.predicted} (${
			outcome.correct ? 'correct' : 'incorrect'
		})`
};

/** English labels for `app-classee-strips`. */
export const englishClasseeLabels: ClasseeStripsLabels = {
	showTable: 'Show data table',
	tableCaption: 'Held-out rows by true class and predicted class',
	trueClass: 'True class',
	predictedClass: 'Predicted class',
	count: 'Rows',
	outcome: 'Outcome',
	correct: 'Correct',
	error: 'Error',
	noErrors: 'No errors: every held-out row was predicted correctly.',
	errorsSide: 'Errors',
	correctSide: 'Correct'
};

/** English labels for `app-threshold-explorer`. */
export const englishThresholdLabels: ThresholdExplorerLabels = {
	unavailable:
		'The threshold explorer is unavailable because this model was trained without probability estimates.',
	slider: 'Probability threshold',
	valueText: (threshold, view) => `Predict ${view.positive} at ${threshold} or higher`,
	notice: 'Exploring thresholds is for understanding only: it does not change the stored scores.',
	threshold: 'Threshold',
	truePositives: (view) => `${view.positive} rows predicted ${view.positive}`,
	falsePositives: (view) => `${view.negative} rows predicted ${view.positive}`,
	trueNegatives: (view) => `${view.negative} rows predicted ${view.negative}`,
	falseNegatives: (view) => `${view.positive} rows predicted ${view.negative}`,
	truePositiveRate: (view) => `Share of ${view.positive} rows found`,
	falsePositiveRate: (view) => `Share of ${view.negative} rows wrongly flagged`,
	trueClass: (label) => `True class ${label}`,
	xAxis: 'Predicted probability',
	yAxis: 'Rows',
	showTable: 'Show data table',
	tableCaption: 'Held-out rows by predicted probability and true class',
	rangeHeading: 'Probability range',
	range: (lower, upper) => `${lower} to ${upper}`
};

/** English labels for `app-reliability-diagram`. */
export const englishReliabilityLabels: ReliabilityDiagramLabels = {
	unavailable:
		'The reliability diagram is unavailable because this model was trained without probability estimates.',
	xAxis: 'Mean predicted probability',
	yAxis: 'Observed rate',
	countsTitle: 'Rows in each probability bin',
	countsAxis: 'Rows',
	diagonal: 'Perfect calibration',
	showTable: 'Show data table',
	tableCaption: 'Calibration by probability bin',
	binHeading: 'Probability bin',
	meanPredicted: 'Mean predicted',
	observed: 'Observed',
	count: 'Rows',
	range: (lower, upper) => `${lower} to ${upper}`,
	emptyBin: 'No rows'
};
