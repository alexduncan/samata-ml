import type { Meta, StoryObj } from '@storybook/web-components-vite';
import {
	breastCancerOneShot,
	irisCrossValidation,
	manyClasses
} from '../../../tests/fixtures/results/evaluations';
import { englishClassMetricsLabels } from '../../../tests/fixtures/results/labels';
import type { StoredEvaluation } from '../../types/model-evaluation';
import './app-class-metrics-table';
import { buildClassMetricsRows, createResultsFormatters } from './results-view-model';

const format = createResultsFormatters({
	number: (value, options) => new Intl.NumberFormat('en-GB', options).format(value)
});

interface TableArgs {
	evaluation: StoredEvaluation;
	longLabels?: boolean;
	dir?: 'ltr' | 'rtl';
}

const meta = {
	title: 'Results/Class metrics table',
	component: 'app-class-metrics-table',
	tags: ['autodocs'],
	parameters: {
		a11y: { test: 'error' },
		docs: {
			description: {
				component:
					'Do read precision and recall together: precision asks how many predictions of a class were right, recall how many real members were found. Don’t read a class with very few held-out rows as a stable score.'
			}
		}
	},
	argTypes: { evaluation: { control: false } },
	render: ({ evaluation, longLabels = false, dir = 'ltr' }: TableArgs) => {
		const wrapper = document.createElement('div');
		wrapper.dir = dir;
		const element = document.createElement('app-class-metrics-table');
		element.labels = englishClassMetricsLabels;
		const source = longLabels
			? {
					...evaluation,
					classLabels: evaluation.classLabels.map(
						(label) => `${String(label)} with an exceptionally long class name`
					)
				}
			: evaluation;
		element.rows = buildClassMetricsRows(source, format);
		wrapper.append(element);
		return wrapper;
	}
} satisfies Meta<TableArgs>;
export default meta;
type Story = StoryObj<TableArgs>;

/** Two classes. */
export const Binary: Story = { args: { evaluation: breastCancerOneShot() } };
/** Three classes pooled over five folds. */
export const Multiclass: Story = { args: { evaluation: irisCrossValidation() } };
/** Twenty-five classes scroll inside a named, keyboard-focusable region. */
export const ManyClasses: Story = { args: { evaluation: manyClasses() } };
/** Long class names wrap. */
export const LongLabel: Story = { args: { evaluation: irisCrossValidation(), longLabels: true } };
/** Logical layout under right-to-left direction. */
export const RTL: Story = { args: { evaluation: irisCrossValidation(), dir: 'rtl' } };
