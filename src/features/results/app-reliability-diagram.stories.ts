import type { Meta, StoryObj } from '@storybook/web-components-vite';
import {
	breastCancerOneShot,
	irisCrossValidation,
	svcBinaryNoProbabilities
} from '../../../tests/fixtures/results/evaluations';
import { englishReliabilityLabels } from '../../../tests/fixtures/results/labels';
import { withEmptyCalibrationBin, withLongLabels } from '../../../tests/fixtures/results/variants';
import type { StoredEvaluation } from '../../types/model-evaluation';
import './app-reliability-diagram';
import { buildCalibrationView, createResultsFormatters } from './results-view-model';

const format = createResultsFormatters({
	number: (value, options) => new Intl.NumberFormat('en-GB', options).format(value)
});

interface ReliabilityArgs {
	evaluation: StoredEvaluation;
	dir?: 'ltr' | 'rtl';
}

const meta = {
	title: 'Results/Reliability diagram',
	component: 'app-reliability-diagram',
	tags: ['autodocs'],
	parameters: {
		a11y: { test: 'error' },
		docs: {
			description: {
				component:
					'Do compare the line with the dashed diagonal: points on it mean a predicted 70% really happens about 70% of the time. Do check the histogram below, because a bin with few rows is noisy. Don’t read a gap in the line as a failure: it marks a bin with no rows.'
			}
		}
	},
	argTypes: { evaluation: { control: false } },
	render: ({ evaluation, dir = 'ltr' }: ReliabilityArgs) => {
		const wrapper = document.createElement('div');
		wrapper.dir = dir;
		const element = document.createElement('app-reliability-diagram');
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
		wrapper.append(element);
		return wrapper;
	}
} satisfies Meta<ReliabilityArgs>;
export default meta;
type Story = StoryObj<ReliabilityArgs>;

/** Positive-class probabilities from a binary model. */
export const Binary: Story = { args: { evaluation: breastCancerOneShot() } };
/** An empty bin breaks the line and reads “No rows” in the table. */
export const EmptyBin: Story = {
	args: { evaluation: withEmptyCalibrationBin(breastCancerOneShot(), 4) }
};
/** A model without probability estimates has no diagram. */
export const NoProbabilities: Story = { args: { evaluation: svcBinaryNoProbabilities() } };
/** Multiclass targets plot top-label confidence against accuracy. */
export const Multiclass: Story = { args: { evaluation: irisCrossValidation() } };
/** Long class names do not affect the chart. */
export const LongLabel: Story = { args: { evaluation: withLongLabels(breastCancerOneShot()) } };
/** Logical layout under right-to-left direction. */
export const RTL: Story = { args: { evaluation: breastCancerOneShot(), dir: 'rtl' } };
