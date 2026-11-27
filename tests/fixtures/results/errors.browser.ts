import '../../../src/features/results/app-classee-strips';
import '../../../src/features/results/app-confusion-flowchart';
import type { AppClasseeStrips } from '../../../src/features/results/app-classee-strips';
import type { AppConfusionFlowchart } from '../../../src/features/results/app-confusion-flowchart';
import {
	buildBinaryFlowView,
	buildClasseeView,
	createResultsFormatters
} from '../../../src/features/results/results-view-model';
import type { StoredEvaluation } from '../../../src/types/model-evaluation';
import { breastCancerOneShot, irisCrossValidation, manyClasses } from './evaluations';
import { englishClasseeLabels, englishFlowchartLabels } from './labels';
import { withLongLabels, withPooledConfusion } from './variants';

/** Hand-written evaluations a browser test can mount for the error views. */
export type ErrorEvaluationName =
	| 'breast-cancer'
	| 'breast-cancer-perfect'
	| 'breast-cancer-one-class'
	| 'iris'
	| 'iris-perfect'
	| 'many-classes';

/** What a browser test chooses to mount. */
export interface ErrorMountSpec {
	readonly element: 'flowchart' | 'classee';
	readonly evaluation: ErrorEvaluationName;
	readonly classFilter?: number | null;
	readonly longLabels?: boolean;
}

/** Test API exposed on `window.resultsFixture`. */
export interface ErrorsFixture {
	mount(spec: ErrorMountSpec): Promise<void>;
}

declare global {
	interface Window {
		errorsFixture: ErrorsFixture;
	}
}

const evaluations: Record<ErrorEvaluationName, () => StoredEvaluation> = {
	'breast-cancer': breastCancerOneShot,
	'breast-cancer-perfect': () => withPooledConfusion(breastCancerOneShot(), [71, 0, 0, 43]),
	'breast-cancer-one-class': () => withPooledConfusion(breastCancerOneShot(), [71, 0, 43, 0]),
	iris: irisCrossValidation,
	'iris-perfect': () =>
		withPooledConfusion(irisCrossValidation(), [50, 0, 0, 0, 50, 0, 0, 0, 50]),
	'many-classes': manyClasses
};

const format = createResultsFormatters({
	number: (value, options) => new Intl.NumberFormat('en-GB', options).format(value)
});

async function mount(spec: ErrorMountSpec): Promise<void> {
	const column = document.getElementById('column')!;
	column.replaceChildren();
	let evaluation = evaluations[spec.evaluation]();
	if (spec.longLabels) evaluation = withLongLabels(evaluation);
	if (spec.element === 'flowchart') {
		const element = document.createElement('app-confusion-flowchart') as AppConfusionFlowchart;
		element.labels = englishFlowchartLabels;
		element.caption = {
			title: 'Held-out outcomes',
			takeaway: 'Correct and incorrect predictions'
		};
		element.flow = buildBinaryFlowView(evaluation, 'diagnosis', format);
		column.append(element);
		await element.updateComplete;
	} else {
		const element = document.createElement('app-classee-strips') as AppClasseeStrips;
		element.labels = englishClasseeLabels;
		element.strips = buildClasseeView(evaluation, spec.classFilter ?? null, format);
		element.caption = {
			title: 'Held-out errors by true class',
			takeaway: 'Most errors confuse versicolor with virginica.'
		};
		element.formatCount = format.count;
		column.append(element);
		await element.whenSettled();
	}
}

window.errorsFixture = { mount };
