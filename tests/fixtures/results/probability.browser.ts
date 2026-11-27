import '../../../src/features/results/app-reliability-diagram';
import '../../../src/features/results/app-threshold-explorer';
import type { AppReliabilityDiagram } from '../../../src/features/results/app-reliability-diagram';
import type { AppThresholdExplorer } from '../../../src/features/results/app-threshold-explorer';
import {
	buildCalibrationView,
	buildThresholdView,
	createResultsFormatters
} from '../../../src/features/results/results-view-model';
import type { StoredEvaluation } from '../../../src/types/model-evaluation';
import { breastCancerOneShot, irisCrossValidation, svcBinaryNoProbabilities } from './evaluations';
import { englishReliabilityLabels, englishThresholdLabels } from './labels';
import { withEmptyCalibrationBin, withLongLabels } from './variants';

/** Hand-written evaluations a browser test can mount for the probability views. */
export type ProbabilityEvaluationName =
	| 'breast-cancer'
	| 'breast-cancer-empty-bin'
	| 'svc-no-probabilities'
	| 'iris';

/** What a browser test chooses to mount. */
export interface ProbabilityMountSpec {
	readonly element: 'threshold' | 'reliability';
	readonly evaluation: ProbabilityEvaluationName;
	readonly thresholdIndex?: number;
	/** When false the fixture never writes the index back, like a parent that ignores events. */
	readonly echo?: boolean;
	readonly longLabels?: boolean;
}

/** A custom event recorded from a mounted element. */
export interface RecordedProbabilityEvent {
	readonly type: string;
	readonly detail: unknown;
	readonly bubbles: boolean;
	readonly composed: boolean;
}

/** Test API exposed on `window.probabilityFixture`. */
export interface ProbabilityFixture {
	mount(spec: ProbabilityMountSpec): Promise<void>;
	readonly events: RecordedProbabilityEvent[];
}

declare global {
	interface Window {
		probabilityFixture: ProbabilityFixture;
	}
}

const evaluations: Record<ProbabilityEvaluationName, () => StoredEvaluation> = {
	'breast-cancer': breastCancerOneShot,
	'breast-cancer-empty-bin': () => withEmptyCalibrationBin(breastCancerOneShot(), 4),
	'svc-no-probabilities': svcBinaryNoProbabilities,
	iris: irisCrossValidation
};

const format = createResultsFormatters({
	number: (value, options) => new Intl.NumberFormat('en-GB', options).format(value)
});

const events: RecordedProbabilityEvent[] = [];

async function mount(spec: ProbabilityMountSpec): Promise<void> {
	const column = document.getElementById('column')!;
	column.replaceChildren();
	let evaluation = evaluations[spec.evaluation]();
	if (spec.longLabels) evaluation = withLongLabels(evaluation);
	if (spec.element === 'threshold') {
		const element = document.createElement('app-threshold-explorer') as AppThresholdExplorer;
		element.explorer = buildThresholdView(evaluation, 'diagnosis');
		element.labels = {
			...englishThresholdLabels,
			xAxis: `Predicted probability of ${element.explorer?.positive ?? ''} (%)`
		};
		element.thresholdIndex = spec.thresholdIndex ?? 50;
		element.caption = {
			title: 'Predicted probabilities by true class',
			takeaway: 'Most Benign rows score below 50%, most Malignant rows above.'
		};
		element.formatPercent = format.percent;
		element.formatCount = format.count;
		element.addEventListener('app-threshold-change', (event) => {
			events.push({
				type: event.type,
				detail: (event as CustomEvent).detail,
				bubbles: event.bubbles,
				composed: event.composed
			});
			if (spec.echo !== false) {
				element.thresholdIndex = (event as CustomEvent<{ index: number }>).detail.index;
			}
		});
		column.append(element);
		await element.whenSettled();
	} else {
		const element = document.createElement('app-reliability-diagram') as AppReliabilityDiagram;
		element.calibration = buildCalibrationView(evaluation, format);
		element.labels = {
			...englishReliabilityLabels,
			observedHeading:
				element.calibration?.mode === 'top-label'
					? 'Correct prediction rate'
					: 'Observed positive rate'
		};
		element.caption = {
			title: 'Reliability of predicted probabilities',
			takeaway: `Expected calibration error is ${element.calibration?.eceText ?? ''}.`
		};
		element.formatPercent = format.percent;
		element.formatCount = format.count;
		column.append(element);
		await element.whenSettled();
	}
}

window.probabilityFixture = { mount, events };
