import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, waitFor } from 'storybook/test';
import { irisCrossValidation, manyClasses } from '../../../tests/fixtures/results/evaluations';
import { englishClasseeLabels } from '../../../tests/fixtures/results/labels';
import { withLongLabels, withPooledConfusion } from '../../../tests/fixtures/results/variants';
import type { StoredEvaluation } from '../../types/model-evaluation';
import type { AppClasseeStrips } from './app-classee-strips';
import './app-classee-strips';
import { buildClasseeView, createResultsFormatters } from './results-view-model';

const format = createResultsFormatters({
	number: (value, options) => new Intl.NumberFormat('en-GB', options).format(value)
});

interface ClasseeArgs {
	evaluation: StoredEvaluation;
	classFilter?: number | null;
	dir?: 'ltr' | 'rtl';
}

const meta = {
	title: 'Results/Classee strips',
	component: 'app-classee-strips',
	tags: ['autodocs'],
	parameters: {
		a11y: { test: 'error' },
		docs: {
			description: {
				component:
					'Do read each row from zero: correct predictions extend right, errors extend left and are stacked by the class they were mistaken for. Do use the data table for exact counts. Don’t compare bar lengths between classes without noting that classes have different numbers of rows.'
			}
		}
	},
	argTypes: { evaluation: { control: false } },
	render: ({ evaluation, classFilter = null, dir = 'ltr' }: ClasseeArgs) => {
		const wrapper = document.createElement('div');
		wrapper.dir = dir;
		const element = document.createElement('app-classee-strips');
		element.labels = englishClasseeLabels;
		element.strips = buildClasseeView(evaluation, classFilter, format);
		element.caption = {
			title: 'Held-out errors by true class',
			takeaway: 'Most errors confuse versicolor with virginica.'
		};
		element.formatCount = format.count;
		wrapper.append(element);
		return wrapper;
	}
} satisfies Meta<ClasseeArgs>;
export default meta;
type Story = StoryObj<ClasseeArgs>;

/** Three classes pooled over five folds. */
export const Multiclass: Story = {
	args: { evaluation: irisCrossValidation() },
	play: async ({ canvasElement }) => {
		const element = canvasElement.querySelector<AppClasseeStrips>('app-classee-strips')!;
		await element.whenSettled();
		await waitFor(() =>
			expect(element.shadowRoot!.querySelectorAll('.chart > svg rect').length).toBe(5)
		);
	}
};
/** No errors: a note replaces the empty left side. */
export const PerfectModel: Story = {
	args: {
		evaluation: withPooledConfusion(irisCrossValidation(), [50, 0, 0, 0, 50, 0, 0, 0, 50])
	}
};
/** Twenty-five classes show the twenty largest by default. */
export const ManyClasses: Story = { args: { evaluation: manyClasses() } };
/** Long class names are shortened on the axis and complete in the table. */
export const LongLabel: Story = { args: { evaluation: withLongLabels(irisCrossValidation()) } };
/** Logical layout under right-to-left direction. */
export const RTL: Story = { args: { evaluation: irisCrossValidation(), dir: 'rtl' } };
