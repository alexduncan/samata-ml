import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, fn, userEvent, waitFor } from 'storybook/test';
import {
	breastCancerOneShot,
	irisCrossValidation,
	manyClasses
} from '../../../tests/fixtures/results/evaluations';
import { englishConfusionMatrixLabels } from '../../../tests/fixtures/results/labels';
import type { StoredEvaluation } from '../../types/model-evaluation';
import type { AppConfusionMatrix } from './app-confusion-matrix';
import './app-confusion-matrix';
import { buildConfusionMatrixView, createResultsFormatters } from './results-view-model';

const format = createResultsFormatters({
	number: (value, options) => new Intl.NumberFormat('en-GB', options).format(value)
});

interface MatrixArgs {
	evaluation: StoredEvaluation;
	longLabels?: boolean;
	dir?: 'ltr' | 'rtl';
	onFilter?: (event: Event) => void;
}

const meta = {
	title: 'Results/Confusion matrix',
	component: 'app-confusion-matrix',
	tags: ['autodocs'],
	parameters: {
		a11y: { test: 'error' },
		docs: {
			description: {
				component:
					'Do read each row as the real class and each column as the prediction; the bold diagonal counts correct predictions. Do use the filter when there are many classes. Don’t read the counts as rates: classes have different numbers of rows.'
			}
		}
	},
	argTypes: { evaluation: { control: false }, onFilter: { control: false } },
	render: ({ evaluation, longLabels = false, dir = 'ltr', onFilter }: MatrixArgs) => {
		const wrapper = document.createElement('div');
		wrapper.dir = dir;
		const source = longLabels
			? {
					...evaluation,
					classLabels: evaluation.classLabels.map(
						(label) => `${String(label)} with an exceptionally long class name`
					)
				}
			: evaluation;
		const element = document.createElement('app-confusion-matrix');
		element.labels = englishConfusionMatrixLabels;
		element.matrix = buildConfusionMatrixView(source, null, format);
		// Like the connected parent, rebuild the view when the filter changes.
		element.addEventListener('app-confusion-filter-change', (event) => {
			onFilter?.(event);
			const { classFilter } = (event as CustomEvent<{ classFilter: number | null }>).detail;
			element.classFilter = classFilter;
			element.matrix = buildConfusionMatrixView(source, classFilter, format);
		});
		wrapper.append(element);
		return wrapper;
	}
} satisfies Meta<MatrixArgs>;
export default meta;
type Story = StoryObj<MatrixArgs>;

/** Two classes, one test split. */
export const Binary: Story = { args: { evaluation: breastCancerOneShot() } };
/** Three classes pooled over five folds. */
export const Multiclass: Story = { args: { evaluation: irisCrossValidation() } };
/** Twenty-five classes: the filter picks one true class from twenty shown by default. */
export const ManyClasses: Story = {
	args: { evaluation: manyClasses(), onFilter: fn() },
	play: async ({ canvasElement, args }) => {
		const element = canvasElement.querySelector<AppConfusionMatrix>('app-confusion-matrix')!;
		await element.updateComplete;
		const rows = () => element.shadowRoot!.querySelectorAll('tbody tr').length;
		expect(rows()).toBe(20);
		const select = element.shadowRoot!.querySelector('select')!;
		await userEvent.selectOptions(select, '6');
		await waitFor(() => expect(rows()).toBe(1));
		expect(args.onFilter).toHaveBeenCalledTimes(1);
	}
};
/** Long class names wrap in headings and rows. */
export const LongLabel: Story = { args: { evaluation: irisCrossValidation(), longLabels: true } };
/** Logical layout under right-to-left direction. */
export const RTL: Story = { args: { evaluation: irisCrossValidation(), dir: 'rtl' } };
