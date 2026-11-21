import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect } from 'storybook/test';
import { breastCancerOneShot } from '../../../tests/fixtures/results/evaluations';
import { englishFlowchartLabels } from '../../../tests/fixtures/results/labels';
import { withLongLabels, withPooledConfusion } from '../../../tests/fixtures/results/variants';
import type { StoredEvaluation } from '../../types/model-evaluation';
import type { AppConfusionFlowchart } from './app-confusion-flowchart';
import './app-confusion-flowchart';
import { buildBinaryFlowView, createResultsFormatters } from './results-view-model';

const format = createResultsFormatters({
	number: (value, options) => new Intl.NumberFormat('en-GB', options).format(value)
});

interface FlowchartArgs {
	evaluation: StoredEvaluation;
	target?: string;
	dir?: 'ltr' | 'rtl';
}

const meta = {
	title: 'Results/Confusion flowchart',
	component: 'app-confusion-flowchart',
	tags: ['autodocs'],
	parameters: {
		a11y: { test: 'error' },
		docs: {
			description: {
				component:
					'Do read the sentences: each says how many rows of one real class were predicted as which class. Do notice that solid bars are correct and dashed striped bars are errors. Don’t rely on colour to tell them apart.'
			}
		}
	},
	argTypes: { evaluation: { control: false } },
	render: ({ evaluation, target = 'diagnosis', dir = 'ltr' }: FlowchartArgs) => {
		const wrapper = document.createElement('div');
		wrapper.dir = dir;
		const element = document.createElement('app-confusion-flowchart');
		element.labels = englishFlowchartLabels;
		element.flow = buildBinaryFlowView(evaluation, target, format);
		wrapper.append(element);
		return wrapper;
	}
} satisfies Meta<FlowchartArgs>;
export default meta;
type Story = StoryObj<FlowchartArgs>;

/** Mostly correct, with a few errors in each direction. */
export const Binary: Story = {
	args: { evaluation: breastCancerOneShot() },
	play: async ({ canvasElement }) => {
		const element =
			canvasElement.querySelector<AppConfusionFlowchart>('app-confusion-flowchart')!;
		await element.updateComplete;
		expect(element.shadowRoot!.querySelectorAll('.outcomes li')).toHaveLength(4);
	}
};
/** No errors: the zero outcomes keep their sentences and take no bar width. */
export const PerfectModel: Story = {
	args: { evaluation: withPooledConfusion(breastCancerOneShot(), [71, 0, 0, 43]) }
};
/** A model that predicts a single class for every row. */
export const AllOneClass: Story = {
	args: { evaluation: withPooledConfusion(breastCancerOneShot(), [71, 0, 43, 0]) }
};
/** Long class and target names wrap in the sentences. */
export const LongLabel: Story = {
	args: {
		evaluation: withLongLabels(breastCancerOneShot()),
		target: 'the diagnosis recorded by the clinic'
	}
};
/** Logical layout under right-to-left direction. */
export const RTL: Story = { args: { evaluation: breastCancerOneShot(), dir: 'rtl' } };
