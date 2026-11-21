import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect } from 'storybook/test';
import {
	breastCancerOneShot,
	irisCrossValidation,
	svcBinaryNoProbabilities
} from '../../../tests/fixtures/results/evaluations';
import { englishSummaryLabels } from '../../../tests/fixtures/results/labels';
import type { StoredEvaluation } from '../../types/model-evaluation';
import type { AppResultsSummary } from './app-results-summary';
import './app-results-summary';
import {
	buildSummaryView,
	createResultsFormatters,
	type ResultsRunNames
} from './results-view-model';

const format = createResultsFormatters({
	number: (value, options) => new Intl.NumberFormat('en-GB', options).format(value)
});
const names: ResultsRunNames = {
	modelName: 'Logistic Regression',
	datasetName: 'Sample data',
	target: 'Outcome'
};

interface SummaryArgs {
	evaluation: StoredEvaluation;
	names?: ResultsRunNames;
	moreOpen?: boolean;
	dir?: 'ltr' | 'rtl';
}

function withGap(evaluation: StoredEvaluation, gap: number): StoredEvaluation {
	return {
		...evaluation,
		partitions: evaluation.partitions.map((part) => ({
			...part,
			train: { ...part.train, balancedAccuracy: part.test.balancedAccuracy + gap }
		}))
	};
}

const meta = {
	title: 'Results/Summary',
	component: 'app-results-summary',
	tags: ['autodocs'],
	parameters: {
		a11y: { test: 'error' },
		docs: {
			description: {
				component:
					'Do read balanced accuracy first: it treats every class equally. Do show spread for cross-validation and say plainly when one test split has none. Don’t compare against training scores; only held-out rows are results. The training score appears only in the gap warning.'
			}
		}
	},
	argTypes: { evaluation: { control: false }, names: { control: false } },
	render: ({
		evaluation,
		names: runNames = names,
		moreOpen = false,
		dir = 'ltr'
	}: SummaryArgs) => {
		const wrapper = document.createElement('div');
		wrapper.dir = dir;
		const element = document.createElement('app-results-summary');
		element.labels = englishSummaryLabels;
		element.summary = buildSummaryView(evaluation, runNames, format);
		element.moreOpen = moreOpen;
		wrapper.append(element);
		return wrapper;
	}
} satisfies Meta<SummaryArgs>;
export default meta;
type Story = StoryObj<SummaryArgs>;

/** Five folds: mean with standard deviation and interquartile range. */
export const CrossValidation: Story = {
	args: { evaluation: irisCrossValidation() },
	play: async ({ canvasElement }) => {
		const element = canvasElement.querySelector<AppResultsSummary>('app-results-summary')!;
		await element.updateComplete;
		expect(element.shadowRoot!.querySelector('.primary')!.textContent).toContain('±');
	}
};
/** One test split: a single value and the no-spread sentence. */
export const OneShot: Story = { args: { evaluation: breastCancerOneShot() } };
/** The model scores at least ten points higher on training rows than on held-out rows. */
export const GapWarning: Story = {
	args: { evaluation: withGap(breastCancerOneShot(), 0.12) },
	play: async ({ canvasElement }) => {
		const element = canvasElement.querySelector<AppResultsSummary>('app-results-summary')!;
		await element.updateComplete;
		expect(element.shadowRoot!.querySelector('.notification')).not.toBeNull();
	}
};
/** A model without probability estimates gives each missing metric a reason. */
export const MetricsUnavailable: Story = {
	args: { evaluation: svcBinaryNoProbabilities(), moreOpen: true }
};
/** Long model, dataset and target names wrap instead of clipping. */
export const LongLabel: Story = {
	args: {
		evaluation: irisCrossValidation(),
		names: {
			modelName: 'Support Vector Classifier with a radial basis function kernel',
			datasetName: 'A dataset with an exceptionally long descriptive title',
			target: 'The outcome column with a very long header name'
		}
	}
};
/** Logical layout under right-to-left direction. */
export const RTL: Story = { args: { evaluation: irisCrossValidation(), dir: 'rtl' } };
