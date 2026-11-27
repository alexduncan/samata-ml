import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, waitFor } from 'storybook/test';
import {
	breastCancerOneShot,
	irisCrossValidation
} from '../../../tests/fixtures/results/evaluations';
import { englishFoldStripLabels, sampleCaption } from '../../../tests/fixtures/results/labels';
import type { StoredEvaluation } from '../../types/model-evaluation';
import type { AppFoldStrip } from './app-fold-strip';
import './app-fold-strip';
import { buildFoldStripView, createResultsFormatters } from './results-view-model';

const format = createResultsFormatters({
	number: (value, options) => new Intl.NumberFormat('en-GB', options).format(value)
});

interface FoldStripArgs {
	evaluation: StoredEvaluation;
	seriesName?: string;
	dir?: 'ltr' | 'rtl';
	multiModel?: boolean;
	clamped?: boolean;
}

const meta = {
	title: 'Results/Fold strip',
	component: 'app-fold-strip',
	tags: ['autodocs'],
	parameters: {
		a11y: { test: 'error' },
		docs: {
			description: {
				component:
					'Do show every held-out score as a dot with the mean, the spread and the baselines on a fixed 0 to 100% scale. Do keep the data table. Don’t draw a spread for a single test split, and don’t rely on colour: baselines and the model are labelled.'
			}
		}
	},
	argTypes: { evaluation: { control: false } },
	render: ({
		evaluation,
		seriesName = 'Logistic Regression',
		dir = 'ltr',
		multiModel = false,
		clamped = false
	}: FoldStripArgs) => {
		const wrapper = document.createElement('div');
		wrapper.dir = dir;
		const view = buildFoldStripView(
			evaluation,
			{
				series: seriesName,
				mostFrequent: 'Most frequent class',
				stratified: 'Random by class share'
			},
			format
		);
		const element = document.createElement('app-fold-strip');
		element.labels = englishFoldStripLabels;
		element.series = multiModel
			? [
					{ ...view.series[0]!, num: 1, color: 'amber' },
					{ ...view.series[0]!, id: 'second', num: 2, color: 'blue' }
				]
			: clamped
				? view.series.map((row) => ({ ...row, mean: 0.95, sd: 0.1 }))
				: view.series;
		element.baselines = view.baselines;
		element.caption = sampleCaption;
		element.formatPercent = format.percent;
		wrapper.append(element);
		return wrapper;
	}
} satisfies Meta<FoldStripArgs>;
export default meta;
type Story = StoryObj<FoldStripArgs>;

/** Five folds with a mean mark and a standard-deviation rule. */
export const CrossValidation: Story = {
	args: { evaluation: irisCrossValidation() },
	play: async ({ canvasElement }) => {
		const element = canvasElement.querySelector<AppFoldStrip>('app-fold-strip')!;
		await element.whenSettled();
		await waitFor(() =>
			expect(element.shadowRoot!.querySelectorAll('svg circle')).toHaveLength(5)
		);
	}
};
/** One test split draws a single dot and no spread. */
export const OneShot: Story = { args: { evaluation: breastCancerOneShot() } };
/** Equally named models retain distinct numbers, symbols and colours. */
export const MultipleModels: Story = {
	args: { evaluation: irisCrossValidation(), multiModel: true }
};
/** A spread extending beyond the score range is described explicitly. */
export const ClampedSpread: Story = { args: { evaluation: irisCrossValidation(), clamped: true } };
/** A long series name wraps in the chart and in the table. */
export const LongLabel: Story = {
	args: {
		evaluation: irisCrossValidation(),
		seriesName: 'Support Vector Classifier with a radial basis function kernel'
	}
};
/** Logical layout under right-to-left direction. */
export const RTL: Story = { args: { evaluation: irisCrossValidation(), dir: 'rtl' } };
