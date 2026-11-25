import { count, params } from '@nanostores/i18n';
import { StoreController } from '@nanostores/lit';
import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { $format, i18n } from '../../i18n';
import {
	$modelResults,
	currentResultIdentity,
	loadModelResults,
	retryModelResults
} from '../../stores/model-results.store';
import { $appState, setModelResultsUi } from '../../stores/app.store';
import { flushNow } from '../../stores/persister';
import { buttonStyles } from '../../styles/button.styles';
import { notificationStyles } from '../../styles/notification.styles';
import { resultsStyles } from '../../styles/results.styles';
import type { MetricUnavailableReason, StoredEvaluation } from '../../types/model-evaluation';
import { DEFAULT_MODEL_RESULTS_UI, type ModelRecord } from '../../types/state';
import { savedModelName } from '../models/model-catalogue';
import { sameTrainingRun } from '../models/training/result-validation';
import type { ClasseeStripsLabels } from './app-classee-strips';
import type { ClassMetricsTableLabels } from './app-class-metrics-table';
import type { ConfusionFlowchartLabels } from './app-confusion-flowchart';
import type { ConfusionMatrixLabels } from './app-confusion-matrix';
import type { FoldStripLabels } from './app-fold-strip';
import type { ReliabilityDiagramLabels } from './app-reliability-diagram';
import type { ResultsSummaryLabels } from './app-results-summary';
import type { ThresholdExplorerLabels } from './app-threshold-explorer';
import './app-class-metrics-table';
import './app-classee-strips';
import './app-confusion-flowchart';
import './app-confusion-matrix';
import './app-fold-strip';
import './app-reliability-diagram';
import './app-results-summary';
import './app-threshold-explorer';
import {
	buildBinaryFlowView,
	buildCalibrationView,
	buildClasseeView,
	buildClassMetricsRows,
	buildConfusionMatrixView,
	buildFoldStripView,
	buildSummaryView,
	buildThresholdView,
	createResultsFormatters,
	type BinaryFlowView,
	type CalibrationView,
	type ChartCaption,
	type ClasseeView,
	type ClassMetricsRow,
	type ConfusionMatrixView,
	type FoldStripView,
	type ResultsFormatters,
	type ResultsSummaryView,
	type ThresholdView
} from './results-view-model';
import { RESULT_TERM_COPY } from './result-term-copy';

const resultTerms = Object.entries(RESULT_TERM_COPY).filter(
	([, term]) => term.surface !== 'comparison'
);
const resultTermMessages: Record<`term.${string}`, string> = {};
for (const [id, term] of resultTerms) {
	resultTermMessages[`term.${id}.name`] = term.term;
	resultTermMessages[`term.${id}.definition`] = term.definition;
	if ('expansion' in term) resultTermMessages[`term.${id}.expansion`] = term.expansion;
}

const messages = i18n('app-model-results', {
	...resultTermMessages,
	resultTermsSummary: 'What do these results terms mean?',
	trainingDetails: 'Training Details',
	detailModel: 'Model',
	detailTarget: 'Target',
	detailFeatures: 'Features',
	detailFeatureCount: params<{ formatted: string }>(
		count({ one: '{formatted} feature', many: '{formatted} features' })
	),
	detailStrategy: 'Evaluation strategy',
	detailOneShot: 'One-Shot',
	detailCrossValidation: 'Cross-Validation',
	detailTrainingRows: 'Training rows',
	detailHeldOutRows: 'Held-out rows',
	detailFold: params<{ fold: string; rows: string }>('Fold {fold}: {rows}'),
	detailOverlap: 'Training folds overlap.',
	detailUnavailable: 'Unavailable',
	loading: 'Loading results…',
	empty: 'Train this model to see its results.',
	legacy: 'This model was trained before detailed results were saved. Train it again to see them.',
	lost: 'The saved results for this model are no longer available in this browser. Train the model again to see them.',
	modelsLink: 'Open Models and choose Train New Model',
	readError: 'The saved results could not be read from this browser.',
	retry: 'Retry',
	summaryHeading: 'Scores on held-out rows',
	foldHeadingCv: 'Scores across folds',
	foldHeadingOneShot: 'Score on the test split',
	errorsHeading: 'Where the model makes mistakes',
	thresholdHeading: 'Probability threshold',
	reliabilityHeading: 'Calibration',
	runLine: params<{
		model: string;
		dataset: string;
		target: string;
		protocol: string;
		rows: string;
	}>('{model} on {dataset}, predicting {target}. {protocol}. Held-out rows scored: {rows}.'),
	protocolOneShot: 'One test split',
	protocolCrossValidation: params<{ folds: number }>('{folds}-fold cross-validation'),
	timeOneShot: params<{ time: string }>('Fit time: {time}'),
	timeCrossValidation: params<{ time: string }>(
		'Total fit and scoring time across folds: {time}'
	),
	balancedAccuracy: 'Balanced accuracy on held-out rows',
	balancedAccuracySpread: params<{ mean: string; sd: string }>('{mean} ± {sd} points'),
	spreadCrossValidation: params<{ sd: string; iqr: string; folds: number }>(
		'Standard deviation {sd} points; interquartile range {iqr} points across {folds} folds.'
	),
	spreadOneShot:
		'One test split: no spread is available. Cross-Validation shows how scores vary across folds.',
	accuracy: 'Accuracy',
	baselineLine: params<{ baseline: string; delta: string }>(
		'Always predicting the most frequent class scores {baseline}; the difference is {delta} percentage points.'
	),
	macroF1: 'Macro-F1',
	moreMetrics: 'More metrics',
	metricMcc: 'Matthews correlation coefficient (MCC)',
	metricRocAuc: 'ROC-AUC',
	metricAveragePrecision: 'Average precision',
	metricLogLoss: 'Log loss',
	metricBrier: 'Brier score',
	metricEce: 'Expected calibration error (ECE)',
	reasonNotRequested: 'This metric was not requested for this run.',
	reasonProbabilities:
		'Unavailable because this model was trained without probability estimates.',
	reasonUnseenLabels:
		'Unavailable because the held-out rows include classes the model never saw.',
	reasonMissingClasses: 'Unavailable because the held-out rows do not include every class.',
	reasonAllZero: 'Unavailable because every target value is zero.',
	reasonNegative: 'Unavailable because a target value is negative.',
	reasonNotApplicable: 'Not applicable to this model or target.',
	reasonFewRows: 'Unavailable because there are too few rows.',
	reasonSingleClass: 'Unavailable because the held-out rows contain only one class.',
	gapTitle: 'Large gap between training and held-out scores.',
	gapText: params<{ fitted: string; heldOut: string; points: string }>(
		'The model scored {fitted} on the rows it learned from but {heldOut} on held-out rows, {points} percentage points lower. This can mean it has memorised its training data.'
	),
	foldCaptionTitleCrossValidation: 'Balanced accuracy across folds',
	foldCaptionTitleOneShot: 'Balanced accuracy on the test split',
	foldTakeawayCrossValidation: params<{ low: string; high: string; mean: string; folds: number }>(
		'Fold scores ranged from {low} to {high} across {folds} folds, with a mean of {mean}.'
	),
	foldTakeawayOneShot: params<{ score: string }>(
		'The model scored {score} on the held-out test rows.'
	),
	foldTableCaption: 'Held-out balanced accuracy by partition',
	foldSeries: 'Series',
	foldPartition: params<{ number: number }>('Fold {number}'),
	foldPartitionOneShot: 'Test split',
	foldScore: 'Balanced accuracy',
	foldTimeCrossValidation: 'Fit and scoring time',
	foldTimeOneShot: 'Fit time',
	foldMean: 'Mean',
	foldSd: 'Standard deviation',
	baselineMostFrequent: 'Always the most frequent class',
	baselineStratified: 'Random guesses by class share',
	showTable: 'Show data table',
	classTableCaption: 'Precision, recall and F1 for each class on held-out rows',
	classHeading: 'Class',
	supportHeading: 'Held-out rows',
	precisionHeading: 'Precision',
	recallHeading: 'Recall',
	f1Heading: 'F1',
	matrixCaptionTest: params<{ shown: number; total: number }>(
		'Confusion matrix: {shown} of {total} true classes, test rows only'
	),
	matrixCaptionHeldOut: params<{ shown: number; total: number }>(
		'Confusion matrix: {shown} of {total} true classes, pooled held-out rows'
	),
	trueClass: 'True class',
	predictedClass: 'Predicted class',
	matrixRows: 'Rows',
	matrixFilter: 'Show true class',
	matrixFilterDefault: 'The twenty largest classes',
	flowRowHeading: params<{ target: string; actual: string; total: string }>(
		'Rows with {target} {actual}: {total}'
	),
	flowOutcomeCorrect: params<{
		text: string;
		target: string;
		actual: string;
		predicted: string;
	}>(
		count({
			one: '{text} row with {target} {actual} was predicted {predicted} (correct)',
			many: '{text} rows with {target} {actual} were predicted {predicted} (correct)'
		})
	),
	flowOutcomeIncorrect: params<{
		text: string;
		target: string;
		actual: string;
		predicted: string;
	}>(
		count({
			one: '{text} row with {target} {actual} was predicted {predicted} (incorrect)',
			many: '{text} rows with {target} {actual} were predicted {predicted} (incorrect)'
		})
	),
	classeeTitle: 'Held-out errors by true class',
	classeeTakeawayNone: 'Every held-out row was predicted correctly.',
	classeeTakeaway: params<{
		errors: string;
		rows: string;
		count: string;
		actual: string;
		predicted: string;
	}>(
		'{errors} of {rows} held-out rows were predicted wrongly. The most common mistake was {actual} predicted as {predicted}, {count} times.'
	),
	classeeTableCaption: 'Held-out rows by true class and predicted class',
	classeeCount: 'Rows',
	classeeOutcome: 'Outcome',
	classeeCorrect: 'Correct',
	classeeError: 'Error',
	classeeNoErrors: 'No errors: every held-out row was predicted correctly.',
	classeeErrorsSide: 'Errors',
	classeeCorrectSide: 'Correct',
	thresholdTitle: 'Predicted probabilities by true class',
	thresholdTakeaway: params<{ positive: string }>(
		'Each bar counts held-out rows whose predicted probability of {positive} falls in a five-point range; the line marks the chosen threshold.'
	),
	thresholdSlider: 'Probability threshold',
	thresholdValueText: params<{ positive: string; threshold: string }>(
		'Predict {positive} at {threshold} or higher'
	),
	thresholdNotice:
		'Exploring thresholds is for understanding only: it does not change the stored scores.',
	thresholdLabel: 'Threshold',
	thresholdTp: params<{ positive: string }>('{positive} rows predicted {positive}'),
	thresholdFp: params<{ positive: string; negative: string }>(
		'{negative} rows predicted {positive}'
	),
	thresholdTn: params<{ negative: string }>('{negative} rows predicted {negative}'),
	thresholdFn: params<{ positive: string; negative: string }>(
		'{positive} rows predicted {negative}'
	),
	thresholdTpr: params<{ positive: string }>('Share of {positive} rows found'),
	thresholdFpr: params<{ negative: string }>('Share of {negative} rows wrongly flagged'),
	thresholdTrueClass: params<{ label: string }>('True class {label}'),
	thresholdXAxis: 'Predicted probability',
	thresholdYAxis: 'Rows',
	thresholdTableCaption: 'Held-out rows by predicted probability and true class',
	thresholdRangeHeading: 'Probability range',
	range: params<{ lower: string; upper: string }>('{lower} to {upper}'),
	thresholdUnavailableProbabilities: params<{ model: string }>(
		'Log loss and the threshold explorer are unavailable because this {model} was trained without probability estimates.'
	),
	thresholdUnavailableSingleClass:
		'The threshold explorer is unavailable because the held-out rows contain only one class.',
	reliabilityTitleBinary: 'Reliability of predicted probabilities',
	reliabilityTitleTopLabel: 'Reliability of the top predicted class',
	reliabilityTakeaway: params<{ ece: string }>(
		'Expected calibration error is {ece}. Lower is better; zero means predicted probabilities match observed rates.'
	),
	reliabilityXAxis: 'Mean predicted probability',
	reliabilityXAxisTopLabel: 'Mean confidence in the top class',
	reliabilityYAxis: 'Observed rate',
	reliabilityYAxisTopLabel: 'Observed accuracy',
	reliabilityCountsTitle: 'Rows in each probability bin',
	reliabilityCountsAxis: 'Rows',
	reliabilityDiagonal: 'Perfect calibration',
	reliabilityTableCaption: 'Calibration by probability bin',
	reliabilityBin: 'Probability bin',
	reliabilityMeanPredicted: 'Mean predicted',
	reliabilityObserved: 'Observed',
	reliabilityEmptyBin: 'No rows',
	reliabilityUnavailableProbabilities: params<{ model: string }>(
		'The reliability diagram is unavailable because this {model} was trained without probability estimates.'
	),
	reliabilityUnavailableSingleClass:
		'The reliability diagram is unavailable because the held-out rows contain only one class.'
});

type Messages = ReturnType<typeof messages.get>;

interface ElementLabels {
	readonly summary: ResultsSummaryLabels;
	readonly foldStrip: FoldStripLabels;
	readonly classTable: ClassMetricsTableLabels;
	readonly matrix: ConfusionMatrixLabels;
	readonly flowchart: ConfusionFlowchartLabels;
	readonly classee: ClasseeStripsLabels;
	readonly threshold: ThresholdExplorerLabels;
	readonly reliability: ReliabilityDiagramLabels;
}

function buildLabels(
	t: Messages,
	evaluation: StoredEvaluation,
	model: string,
	unavailableReason: 'probabilities' | 'single-class'
): ElementLabels {
	const oneShot = evaluation.protocol.kind === 'one_shot';
	const topLabel = evaluation.classLabels.length > 2;
	const reasons: Record<MetricUnavailableReason, string> = {
		'not-requested': t.reasonNotRequested,
		'probabilities-unavailable': t.reasonProbabilities,
		'unseen-validation-labels': t.reasonUnseenLabels,
		'undefined-for-validation-classes': t.reasonMissingClasses,
		'all-targets-zero': t.reasonAllZero,
		'negative-targets': t.reasonNegative,
		'not-applicable': t.reasonNotApplicable,
		'insufficient-degrees-of-freedom': t.reasonFewRows,
		'single-class': t.reasonSingleClass
	};
	const probabilities = unavailableReason === 'probabilities';
	return {
		summary: {
			runLine: (view) =>
				t.runLine({
					model: view.modelName,
					dataset: view.datasetName,
					target: view.target,
					protocol:
						view.protocol === 'one_shot'
							? t.protocolOneShot
							: t.protocolCrossValidation({ folds: view.partitions }),
					rows: view.rows
				}),
			timeLine: (view) =>
				view.protocol === 'one_shot'
					? t.timeOneShot({ time: view.time })
					: t.timeCrossValidation({ time: view.time }),
			balancedAccuracy: t.balancedAccuracy,
			balancedAccuracyValue: (view) =>
				view.spread
					? t.balancedAccuracySpread({ mean: view.balancedAccuracy, sd: view.spread.sd })
					: view.balancedAccuracy,
			spreadLine: (view) =>
				view.spread
					? t.spreadCrossValidation({
							sd: view.spread.sd,
							iqr: view.spread.iqr,
							folds: view.partitions
						})
					: t.spreadOneShot,
			accuracy: t.accuracy,
			baselineLine: (view) =>
				t.baselineLine({ baseline: view.baselineAccuracy, delta: view.accuracyDelta }),
			macroF1: t.macroF1,
			moreMetrics: t.moreMetrics,
			metricNames: {
				macroF1: t.macroF1,
				mcc: t.metricMcc,
				rocAuc: t.metricRocAuc,
				averagePrecision: t.metricAveragePrecision,
				logLoss: t.metricLogLoss,
				brier: t.metricBrier,
				ece: t.metricEce
			},
			reasons,
			gapTitle: t.gapTitle,
			gapText: (gap) => t.gapText(gap)
		},
		foldStrip: {
			showTable: t.showTable,
			tableCaption: t.foldTableCaption,
			series: t.foldSeries,
			partition: (index) =>
				oneShot ? t.foldPartitionOneShot : t.foldPartition({ number: index }),
			score: t.foldScore,
			time: oneShot ? t.foldTimeOneShot : t.foldTimeCrossValidation,
			mean: t.foldMean,
			standardDeviation: t.foldSd
		},
		classTable: {
			caption: t.classTableCaption,
			class: t.classHeading,
			support: t.supportHeading,
			precision: t.precisionHeading,
			recall: t.recallHeading,
			f1: t.f1Heading
		},
		matrix: {
			caption: (view) =>
				view.scope === 'test'
					? t.matrixCaptionTest({ shown: view.rows.length, total: view.classCount })
					: t.matrixCaptionHeldOut({ shown: view.rows.length, total: view.classCount }),
			trueClass: t.trueClass,
			predictedClass: t.predictedClass,
			support: t.matrixRows,
			filter: t.matrixFilter,
			defaultFilter: t.matrixFilterDefault
		},
		flowchart: {
			rowHeading: (row, flow) =>
				t.flowRowHeading({ target: flow.target, actual: row.actual, total: row.totalText }),
			outcome: (outcome, row, flow) => {
				const values = {
					text: outcome.text,
					target: flow.target,
					actual: row.actual,
					predicted: outcome.predicted
				};
				return outcome.correct
					? t.flowOutcomeCorrect(values)(outcome.count)
					: t.flowOutcomeIncorrect(values)(outcome.count);
			}
		},
		classee: {
			showTable: t.showTable,
			tableCaption: t.classeeTableCaption,
			trueClass: t.trueClass,
			predictedClass: t.predictedClass,
			count: t.classeeCount,
			outcome: t.classeeOutcome,
			correct: t.classeeCorrect,
			error: t.classeeError,
			noErrors: t.classeeNoErrors,
			errorsSide: t.classeeErrorsSide,
			correctSide: t.classeeCorrectSide
		},
		threshold: {
			unavailable: probabilities
				? t.thresholdUnavailableProbabilities({ model })
				: t.thresholdUnavailableSingleClass,
			slider: t.thresholdSlider,
			valueText: (threshold, view) =>
				t.thresholdValueText({ positive: view.positive, threshold }),
			notice: t.thresholdNotice,
			threshold: t.thresholdLabel,
			truePositives: (view) => t.thresholdTp({ positive: view.positive }),
			falsePositives: (view) =>
				t.thresholdFp({ positive: view.positive, negative: view.negative }),
			trueNegatives: (view) => t.thresholdTn({ negative: view.negative }),
			falseNegatives: (view) =>
				t.thresholdFn({ positive: view.positive, negative: view.negative }),
			truePositiveRate: (view) => t.thresholdTpr({ positive: view.positive }),
			falsePositiveRate: (view) => t.thresholdFpr({ negative: view.negative }),
			trueClass: (label) => t.thresholdTrueClass({ label }),
			xAxis: t.thresholdXAxis,
			yAxis: t.thresholdYAxis,
			showTable: t.showTable,
			tableCaption: t.thresholdTableCaption,
			rangeHeading: t.thresholdRangeHeading,
			range: (lower, upper) => t.range({ lower, upper })
		},
		reliability: {
			unavailable: probabilities
				? t.reliabilityUnavailableProbabilities({ model })
				: t.reliabilityUnavailableSingleClass,
			xAxis: topLabel ? t.reliabilityXAxisTopLabel : t.reliabilityXAxis,
			yAxis: topLabel ? t.reliabilityYAxisTopLabel : t.reliabilityYAxis,
			countsTitle: t.reliabilityCountsTitle,
			countsAxis: t.reliabilityCountsAxis,
			diagonal: t.reliabilityDiagonal,
			showTable: t.showTable,
			tableCaption: t.reliabilityTableCaption,
			binHeading: t.reliabilityBin,
			meanPredicted: t.reliabilityMeanPredicted,
			observed: t.reliabilityObserved,
			count: t.matrixRows,
			range: (lower, upper) => t.range({ lower, upper }),
			emptyBin: t.reliabilityEmptyBin
		}
	};
}

interface ChartElement extends HTMLElement {
	whenSettled(): Promise<void>;
}

/** The per-model data every Section 6 block reads, rebuilt only when its inputs change. */
interface ResultsViews {
	readonly summary: ResultsSummaryView;
	readonly foldStrip: FoldStripView;
	readonly foldCaption: ChartCaption;
	readonly classRows: readonly ClassMetricsRow[];
	readonly flow: BinaryFlowView | null;
	readonly classee: ClasseeView | null;
	readonly classeeCaption: ChartCaption | null;
	readonly matrix: ConfusionMatrixView;
	readonly threshold: ThresholdView | null;
	readonly thresholdCaption: ChartCaption | null;
	readonly calibration: CalibrationView | null;
	readonly reliabilityCaption: ChartCaption | null;
	readonly labels: ElementLabels;
}

/**
 * Connected Section 6: reads the saved evaluation of one trained model and composes the shared
 * single-model results. Display preferences persist through `setModelResultsUi`.
 */
@customElement('app-model-results')
export class AppModelResults extends LitElement {
	static override styles = [
		buttonStyles,
		notificationStyles,
		resultsStyles,
		css`
			:host {
				display: block;
			}

			:host([hidden]) {
				display: none;
			}

			progress {
				display: block;
				inline-size: 100%;
			}

			.block {
				margin-block-end: 2rem;
			}

			.training-summary {
				margin-block-end: 2rem;
				overflow-wrap: anywhere;
			}

			.training-summary summary {
				cursor: pointer;
				color: var(--stone-800);
				font-weight: 600;
			}

			.training-summary summary:focus-visible {
				outline: 2px solid var(--focus-ring);
				outline-offset: 2px;
			}

			.training-summary table {
				margin-block-start: 0.75rem;
				border-collapse: collapse;
				inline-size: 100%;
			}

			.training-summary :is(th, td) {
				vertical-align: top;
				border-block-end: 1px solid var(--stone-200);
				padding-inline: 0.375rem;
				padding-block: 0.375rem;
				text-align: start;
			}

			.training-summary th {
				inline-size: 30%;
			}

			.training-summary ul {
				margin-block: 0.25rem 0;
				padding-inline-start: 1.25rem;
			}

			.block :is(h2, h3) {
				margin-block: 0 0.75rem;
				font-size: 1.125rem;
			}

			.block > * + * {
				margin-block-start: 1rem;
			}

			.block p {
				margin: 0;
			}
		`
	];

	/** Number of the model whose results are shown. */
	@property({ type: Number, attribute: 'model-num', reflect: true }) accessor modelNum = 0;

	/** Heading level of the results panels within the surrounding workflow. */
	@property({ attribute: false }) accessor headingLevel: 2 | 3 = 3;

	private readonly appState = new StoreController(this, $appState);
	private readonly resources = new StoreController(this, $modelResults);
	private readonly format = new StoreController(this, $format);
	private readonly text = new StoreController(this, messages);
	private views: ResultsViews | null = null;
	private viewKey: readonly unknown[] = [];
	private waiters = new Set<() => void>();
	private pendingEffect: Promise<void> | null = null;

	private get model(): ModelRecord | undefined {
		return this.appState.value.models.find((entry) => entry.num === this.modelNum);
	}

	private get viewed(): boolean {
		return this.model?.status === 'trained';
	}

	/**
	 * Resolves after the saved results reach a terminal state for the current run and the visible
	 * charts have drawn. Resolves at once without an active trained run, and when the run is
	 * superseded or the element is removed while waiting.
	 */
	async whenSettled(): Promise<void> {
		await this.updateComplete;
		const num = this.modelNum;
		const initial = currentResultIdentity(num);
		if (!initial || !this.viewed || !this.isConnected) return;
		const current = () => {
			const identity = currentResultIdentity(num);
			return (
				this.isConnected &&
				this.modelNum === num &&
				this.viewed &&
				identity !== null &&
				sameTrainingRun(initial, identity)
			);
		};
		await this.pendingEffect;
		await this.updateComplete;
		if (!current()) return;
		await new Promise<void>((resolve) => {
			const stops: (() => void)[] = [];
			const done = () => {
				for (const stop of stops) stop();
				this.waiters.delete(check);
				resolve();
			};
			const check = () => {
				const entry = $modelResults.get()[num];
				if (
					!current() ||
					(entry &&
						sameTrainingRun(entry.identity, initial) &&
						entry.status !== 'idle' &&
						entry.status !== 'loading')
				) {
					done();
				}
			};
			this.waiters.add(check);
			stops.push($modelResults.listen(check), $appState.listen(check));
			check();
		});
		await this.updateComplete;
		if (!current()) return;
		const charts = this.renderRoot.querySelectorAll<ChartElement>(
			'app-fold-strip, app-classee-strips, app-threshold-explorer, app-reliability-diagram'
		);
		await Promise.all(Array.from(charts, (chart) => chart.whenSettled()));
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		this.pendingEffect = null;
		for (const check of [...this.waiters]) check();
	}

	override updated(): void {
		const num = this.modelNum;
		const identity = this.viewed ? currentResultIdentity(num) : null;
		const effect = Promise.resolve().then(() => {
			if (this.pendingEffect !== effect) return;
			this.pendingEffect = null;
			const active = currentResultIdentity(num);
			if (
				this.isConnected &&
				this.modelNum === num &&
				this.viewed &&
				identity &&
				active &&
				sameTrainingRun(identity, active)
			) {
				void loadModelResults(num);
			}
			for (const check of [...this.waiters]) check();
		});
		this.pendingEffect = effect;
	}

	private preferences() {
		return { ...DEFAULT_MODEL_RESULTS_UI, ...this.model?.ui.results };
	}

	private modelName(model: ModelRecord): string {
		return savedModelName(model) ?? model.modelId ?? '';
	}

	/** Builds the views for the current evaluation; reuses the previous ones when nothing changed. */
	private buildViews(model: ModelRecord, evaluation: StoredEvaluation): ResultsViews {
		const state = this.appState.value;
		const name = this.modelName(model);
		const datasetName = state.dataset?.name ?? '';
		const target = state.target ?? '';
		const { classFilter } = this.preferences();
		const key = [
			evaluation,
			this.format.value,
			this.text.value,
			name,
			datasetName,
			target,
			classFilter
		];
		if (this.views && key.every((value, index) => value === this.viewKey[index]))
			return this.views;
		const t = this.text.value;
		const format: ResultsFormatters = createResultsFormatters(this.format.value);
		const binary = evaluation.classLabels.length === 2;
		const oneShot = evaluation.protocol.kind === 'one_shot';
		const labels = buildLabels(
			t,
			evaluation,
			name,
			evaluation.outputs.probabilities === null ? 'probabilities' : 'single-class'
		);
		const foldStrip = buildFoldStripView(
			evaluation,
			{
				series: name,
				mostFrequent: t.baselineMostFrequent,
				stratified: t.baselineStratified
			},
			format
		);
		const scores = foldStrip.series[0]!.values.map((value) => value.score);
		const classee = buildClasseeView(evaluation, classFilter, format);
		const threshold = buildThresholdView(evaluation, target);
		const calibration = buildCalibrationView(evaluation, format);
		let worst: { count: number; actual: string; predicted: string; text: string } | null = null;
		for (const row of classee?.rows ?? []) {
			for (const segment of row.errors) {
				if (!worst || segment.count > worst.count) {
					worst = {
						count: segment.count,
						actual: row.label,
						predicted: segment.predicted,
						text: segment.text
					};
				}
			}
		}
		this.viewKey = key;
		this.views = {
			summary: buildSummaryView(evaluation, { modelName: name, datasetName, target }, format),
			foldStrip,
			foldCaption: {
				title: oneShot ? t.foldCaptionTitleOneShot : t.foldCaptionTitleCrossValidation,
				takeaway: oneShot
					? t.foldTakeawayOneShot({ score: format.percent(scores[0]!) })
					: t.foldTakeawayCrossValidation({
							low: format.percent(Math.min(...scores)),
							high: format.percent(Math.max(...scores)),
							mean: format.percent(foldStrip.series[0]!.mean),
							folds: scores.length
						})
			},
			classRows: buildClassMetricsRows(evaluation, format),
			flow: binary ? buildBinaryFlowView(evaluation, target, format) : null,
			classee,
			classeeCaption: classee
				? {
						title: t.classeeTitle,
						takeaway: worst
							? t.classeeTakeaway({
									errors: format.count(classee.totalErrors),
									rows: format.count(
										classee.rows.reduce(
											(total, row) =>
												total + row.correct.count + row.errorCount,
											0
										)
									),
									count: worst.text,
									actual: worst.actual,
									predicted: worst.predicted
								})
							: t.classeeTakeawayNone
					}
				: null,
			matrix: buildConfusionMatrixView(evaluation, classFilter, format),
			threshold,
			thresholdCaption: threshold
				? {
						title: t.thresholdTitle,
						takeaway: t.thresholdTakeaway({ positive: threshold.positive })
					}
				: null,
			calibration,
			reliabilityCaption: calibration
				? {
						title: binary ? t.reliabilityTitleBinary : t.reliabilityTitleTopLabel,
						takeaway: t.reliabilityTakeaway({ ece: calibration.eceText })
					}
				: null,
			labels
		};
		return this.views;
	}

	private handleMoreToggle(event: CustomEvent<{ readonly open: boolean }>): void {
		if (setModelResultsUi(this.modelNum, { moreMetricsOpen: event.detail.open })) flushNow();
	}

	private handleFilter(event: CustomEvent<{ readonly classFilter: number | null }>): void {
		if (setModelResultsUi(this.modelNum, { classFilter: event.detail.classFilter })) flushNow();
	}

	private handleThreshold(event: CustomEvent<{ readonly index: number }>): void {
		setModelResultsUi(this.modelNum, { thresholdIndex: event.detail.index });
	}

	private handleRetry(): void {
		void retryModelResults(this.modelNum);
	}

	private renderModelsLink(message: string): TemplateResult {
		const t = this.text.value;
		return html`
			<p>${message}</p>
			<p><a href="/models">${t.modelsLink}</a></p>
		`;
	}

	private renderTerms(oneShot: boolean, binary: boolean): TemplateResult {
		const text = this.text.value as Messages & typeof resultTermMessages;
		const terms = resultTerms.filter(
			([, term]) =>
				(term.surface !== 'cross-validation' || !oneShot) &&
				(term.surface !== 'binary' || binary)
		);
		return html`
			<details class="terms-disclosure">
				<summary>${text.resultTermsSummary}</summary>
				<dl>
					${repeat(
						terms,
						([id]) => id,
						([id, term]) => {
							const label = text[`term.${id}.name`];
							const expansion =
								'expansion' in term ? text[`term.${id}.expansion`] : undefined;
							return html`
								<dt>
									${expansion
										? html`<abbr title=${expansion}>${label}</abbr>`
										: id === 'f1'
											? label
											: html`<dfn>${label}</dfn>`}
								</dt>
								<dd>
									${expansion ? html`${expansion}. ` : nothing}${text[
										`term.${id}.definition`
									]}
								</dd>
							`;
						}
					)}
				</dl>
			</details>
		`;
	}

	private renderTrainingDetails(
		model: ModelRecord,
		target: string,
		evaluation?: StoredEvaluation
	): TemplateResult {
		const t = this.text.value;
		const number = this.format.value.number;
		const strategy = evaluation?.protocol.kind ?? model.trainingSetup?.type;
		const oneShot = strategy === 'one_shot';
		const crossValidation = strategy === 'cross_validation' || strategy === 'nested_cv';
		const partition = evaluation?.partitions[0];
		const features = model.features ?? [];
		const trainRows =
			crossValidation && evaluation?.partitions.length
				? html`
						<ul>
							${evaluation.partitions.map(
								(fold) =>
									html`<li>
										${t.detailFold({
											fold: number(fold.index + 1),
											rows: number(fold.trainSampleCount)
										})}
									</li>`
							)}
						</ul>
						<p>${t.detailOverlap}</p>
					`
				: oneShot && partition
					? number(partition.trainSampleCount)
					: t.detailUnavailable;
		const heldOutRows = oneShot
			? partition?.testSampleCount
			: evaluation?.pooled.test.sampleCount;
		return html`
			<details class="training-summary">
				<summary id="training-details-label">${t.trainingDetails}</summary>
				<table aria-labelledby="training-details-label">
					<tbody>
						<tr>
							<th scope="row">${t.detailModel}</th>
							<td>${this.modelName(model) || t.detailUnavailable}</td>
						</tr>
						<tr>
							<th scope="row">${t.detailTarget}</th>
							<td>${target}</td>
						</tr>
						<tr>
							<th scope="row">${t.detailFeatures}</th>
							<td>
								${features.length
									? html` ${t.detailFeatureCount({
												formatted: number(features.length)
											})(features.length)}
											<ul>
												${features.map(
													(feature) => html`<li>${feature}</li>`
												)}
											</ul>`
									: t.detailUnavailable}
							</td>
						</tr>
						<tr>
							<th scope="row">${t.detailStrategy}</th>
							<td>
								${oneShot
									? t.detailOneShot
									: crossValidation
										? t.detailCrossValidation
										: t.detailUnavailable}
							</td>
						</tr>
						<tr>
							<th scope="row">${t.detailTrainingRows}</th>
							<td>${trainRows}</td>
						</tr>
						<tr>
							<th scope="row">${t.detailHeldOutRows}</th>
							<td>
								${heldOutRows === undefined
									? t.detailUnavailable
									: number(heldOutRows)}
							</td>
						</tr>
					</tbody>
				</table>
			</details>
		`;
	}

	private panelHeading(id: string, label: string): TemplateResult {
		return this.headingLevel === 2
			? html`<h2 id=${id}>${label}</h2>`
			: html`<h3 id=${id}>${label}</h3>`;
	}

	override render() {
		const t = this.text.value;
		const model = this.model;
		if (!model || !this.viewed) return html`<p>${t.empty}</p>`;
		const expected = currentResultIdentity(this.modelNum);
		if (!expected) return this.renderModelsLink(t.lost);
		const resource = $modelResults.get()[this.modelNum] ?? this.resources.value[this.modelNum];
		if (
			!resource ||
			!sameTrainingRun(expected, resource.identity) ||
			resource.status === 'idle' ||
			resource.status === 'loading'
		) {
			return html`<progress aria-label=${t.loading}></progress>`;
		}
		if (resource.status === 'legacy')
			return html`
				${this.renderTrainingDetails(model, resource.identity.target)}
				${this.renderModelsLink(t.legacy)}
			`;
		if (resource.status === 'lost') return this.renderModelsLink(t.lost);
		if (resource.status === 'error' || !resource.evaluation) {
			return html`
				<div class="notification notification-alert">
					<p class="notification-text" role="alert">${t.readError}</p>
					<button type="button" class="btn" @click=${this.handleRetry}>${t.retry}</button>
				</div>
			`;
		}
		const evaluation = resource.evaluation;
		const views = this.buildViews(model, evaluation);
		const { labels } = views;
		const preferences = this.preferences();
		const formatter = createResultsFormatters(this.format.value);
		const oneShot = evaluation.protocol.kind === 'one_shot';
		const binary = evaluation.classLabels.length === 2;
		return html`
			${this.renderTrainingDetails(model, resource.identity.target, evaluation)}
			<section class="block" aria-labelledby="summary-heading">
				${this.panelHeading('summary-heading', t.summaryHeading)}
				<app-results-summary
					.summary=${views.summary}
					.moreOpen=${preferences.moreMetricsOpen}
					.labels=${labels.summary}
					@app-results-more-toggle=${this.handleMoreToggle}></app-results-summary>
				${this.renderTerms(oneShot, binary)}
			</section>
			<section class="block" aria-labelledby="folds-heading">
				${this.panelHeading(
					'folds-heading',
					oneShot ? t.foldHeadingOneShot : t.foldHeadingCv
				)}
				<app-fold-strip
					.series=${views.foldStrip.series}
					.baselines=${views.foldStrip.baselines}
					.caption=${views.foldCaption}
					.formatPercent=${formatter.percent}
					.labels=${labels.foldStrip}></app-fold-strip>
			</section>
			<section class="block" aria-labelledby="errors-heading">
				${this.panelHeading('errors-heading', t.errorsHeading)}
				${binary
					? html`<app-confusion-flowchart
							.flow=${views.flow}
							.labels=${labels.flowchart}></app-confusion-flowchart>`
					: html`<app-classee-strips
							.strips=${views.classee}
							.caption=${views.classeeCaption}
							.formatCount=${formatter.count}
							.labels=${labels.classee}></app-classee-strips>`}
				<app-confusion-matrix
					.matrix=${views.matrix}
					.classFilter=${preferences.classFilter}
					.labels=${labels.matrix}
					@app-confusion-filter-change=${this.handleFilter}></app-confusion-matrix>
				<app-class-metrics-table
					.rows=${views.classRows}
					.labels=${labels.classTable}></app-class-metrics-table>
			</section>
			${binary
				? html`
						<section class="block" aria-labelledby="threshold-heading">
							${this.panelHeading('threshold-heading', t.thresholdHeading)}
							<app-threshold-explorer
								.explorer=${views.threshold}
								.thresholdIndex=${preferences.thresholdIndex}
								.caption=${views.thresholdCaption}
								.formatPercent=${formatter.percent}
								.formatCount=${formatter.count}
								.labels=${labels.threshold}
								@app-threshold-change=${this
									.handleThreshold}></app-threshold-explorer>
						</section>
					`
				: nothing}
			<section class="block" aria-labelledby="reliability-heading">
				${this.panelHeading('reliability-heading', t.reliabilityHeading)}
				<app-reliability-diagram
					.calibration=${views.calibration}
					.caption=${views.reliabilityCaption}
					.formatPercent=${formatter.percent}
					.formatCount=${formatter.count}
					.labels=${labels.reliability}></app-reliability-diagram>
			</section>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'app-model-results': AppModelResults;
	}
}
