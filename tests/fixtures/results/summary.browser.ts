import '../../../src/features/results/app-class-metrics-table';
import '../../../src/features/results/app-confusion-matrix';
import '../../../src/features/results/app-fold-strip';
import '../../../src/features/results/app-results-summary';
import type { AppClassMetricsTable } from '../../../src/features/results/app-class-metrics-table';
import type { AppConfusionMatrix } from '../../../src/features/results/app-confusion-matrix';
import type { AppFoldStrip } from '../../../src/features/results/app-fold-strip';
import type { AppResultsSummary } from '../../../src/features/results/app-results-summary';
import {
	buildClassMetricsRows,
	buildConfusionMatrixView,
	buildFoldStripView,
	buildSummaryView,
	createResultsFormatters
} from '../../../src/features/results/results-view-model';
import type { StoredEvaluation } from '../../../src/types/model-evaluation';
import {
	englishClassMetricsLabels,
	englishConfusionMatrixLabels,
	englishFoldStripLabels,
	englishSummaryLabels,
	sampleCaption
} from './labels';
import {
	breastCancerOneShot,
	irisCrossValidation,
	manyClasses,
	svcBinaryNoProbabilities
} from './evaluations';

/** Names of the hand-written evaluations a browser test can mount. */
export type EvaluationName = 'iris' | 'breast-cancer' | 'svc-no-probabilities' | 'many-classes';

/** What a browser test chooses to mount. */
export interface MountSpec {
	readonly element: 'summary' | 'fold-strip' | 'class-table' | 'confusion-matrix';
	readonly evaluation: EvaluationName;
	/** Replaces every partition's training balanced accuracy with held-out plus this gap. */
	readonly gap?: number;
	readonly moreOpen?: boolean;
	readonly classFilter?: number | null;
	/** Gives every class a very long name. */
	readonly longLabels?: boolean;
}

/** A custom event recorded from a mounted element. */
export interface RecordedEvent {
	readonly type: string;
	readonly detail: unknown;
	readonly bubbles: boolean;
	readonly composed: boolean;
}

/** Test API exposed on `window.resultsFixture`. */
export interface ResultsFixture {
	mount(spec: MountSpec): Promise<void>;
	readonly events: RecordedEvent[];
}

declare global {
	interface Window {
		resultsFixture: ResultsFixture;
	}
}

const evaluations: Record<EvaluationName, () => StoredEvaluation> = {
	iris: irisCrossValidation,
	'breast-cancer': breastCancerOneShot,
	'svc-no-probabilities': svcBinaryNoProbabilities,
	'many-classes': manyClasses
};

const format = createResultsFormatters({
	number: (value, options) => new Intl.NumberFormat('en-GB', options).format(value)
});

function load(spec: MountSpec): StoredEvaluation {
	let evaluation = evaluations[spec.evaluation]();
	if (spec.gap !== undefined) {
		const gap = spec.gap;
		evaluation = {
			...evaluation,
			partitions: evaluation.partitions.map((part) => ({
				...part,
				train: { ...part.train, balancedAccuracy: part.test.balancedAccuracy + gap }
			}))
		};
	}
	if (spec.longLabels) {
		evaluation = {
			...evaluation,
			classLabels: evaluation.classLabels.map(
				(label, index) =>
					`${String(label)} with an exceptionally long descriptive class name ${index}`
			)
		};
	}
	return evaluation;
}

const events: RecordedEvent[] = [];

function record(element: HTMLElement, types: readonly string[]): void {
	for (const type of types) {
		element.addEventListener(type, (event) => {
			events.push({
				type,
				detail: (event as CustomEvent).detail,
				bubbles: event.bubbles,
				composed: event.composed
			});
		});
	}
}

async function mount(spec: MountSpec): Promise<void> {
	const column = document.getElementById('column')!;
	column.replaceChildren();
	const evaluation = load(spec);
	const names = { modelName: 'Logistic Regression', datasetName: 'Sample', target: 'Outcome' };
	if (spec.element === 'summary') {
		const element = document.createElement('app-results-summary') as AppResultsSummary;
		element.labels = englishSummaryLabels;
		element.summary = buildSummaryView(evaluation, names, format);
		element.moreOpen = spec.moreOpen ?? false;
		record(element, ['app-results-more-toggle']);
		column.append(element);
		await element.updateComplete;
	} else if (spec.element === 'fold-strip') {
		const element = document.createElement('app-fold-strip') as AppFoldStrip;
		const view = buildFoldStripView(
			evaluation,
			{
				series: 'Logistic Regression',
				mostFrequent: 'Most frequent class',
				stratified: 'Random by class share'
			},
			format
		);
		element.labels = englishFoldStripLabels;
		element.series = view.series;
		element.baselines = view.baselines;
		element.caption = sampleCaption;
		element.formatPercent = format.percent;
		column.append(element);
		await element.whenSettled();
	} else if (spec.element === 'class-table') {
		const element = document.createElement('app-class-metrics-table') as AppClassMetricsTable;
		element.labels = englishClassMetricsLabels;
		element.rows = buildClassMetricsRows(evaluation, format);
		column.append(element);
		await element.updateComplete;
	} else {
		const element = document.createElement('app-confusion-matrix') as AppConfusionMatrix;
		element.labels = englishConfusionMatrixLabels;
		let filter = spec.classFilter ?? null;
		const apply = () => {
			element.classFilter = filter;
			element.matrix = buildConfusionMatrixView(evaluation, filter, format);
		};
		// The connected parent owns the filter; mimic it by rebuilding the view on each event.
		element.addEventListener('app-confusion-filter-change', (event) => {
			filter = (event as CustomEvent<{ classFilter: number | null }>).detail.classFilter;
			apply();
		});
		record(element, ['app-confusion-filter-change']);
		apply();
		column.append(element);
		await element.updateComplete;
	}
}

window.resultsFixture = { mount, events };
