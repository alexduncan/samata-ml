import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, fn, waitFor } from 'storybook/test';
import {
	breastCancerOneShot,
	svcBinaryNoProbabilities
} from '../../../tests/fixtures/results/evaluations';
import { englishThresholdLabels } from '../../../tests/fixtures/results/labels';
import { withLongLabels } from '../../../tests/fixtures/results/variants';
import type { StoredEvaluation } from '../../types/model-evaluation';
import type { AppThresholdExplorer } from './app-threshold-explorer';
import './app-threshold-explorer';
import { buildThresholdView, createResultsFormatters } from './results-view-model';

const format = createResultsFormatters({
	number: (value, options) => new Intl.NumberFormat('en-GB', options).format(value)
});

interface ExplorerArgs {
	evaluation: StoredEvaluation;
	thresholdIndex?: number;
	smallCounts?: boolean;
	dir?: 'ltr' | 'rtl';
	onChange?: (event: Event) => void;
}

const meta = {
	title: 'Results/Threshold explorer',
	component: 'app-threshold-explorer',
	tags: ['autodocs'],
	parameters: {
		a11y: { test: 'error' },
		docs: {
			description: {
				component:
					'Do use the slider to see how a stricter or looser cutoff trades missed rows against false alarms. Do keep the stored scores in mind: the model’s own prediction rule produced them. Don’t treat the explorer as a new model or pick a threshold from it without considering the cost of each kind of mistake.'
			}
		}
	},
	argTypes: { evaluation: { control: false }, onChange: { control: false } },
	render: ({
		evaluation,
		thresholdIndex = 50,
		smallCounts = false,
		dir = 'ltr',
		onChange
	}: ExplorerArgs) => {
		const wrapper = document.createElement('div');
		wrapper.dir = dir;
		const element = document.createElement('app-threshold-explorer');
		const view = buildThresholdView(evaluation, 'diagnosis');
		element.explorer =
			smallCounts && view
				? {
						...view,
						maxBinCount: 2,
						bins: view.bins.map((bin) => ({
							...bin,
							positive: Math.min(2, bin.positive),
							negative: Math.min(2, bin.negative)
						}))
					}
				: view;
		element.labels = {
			...englishThresholdLabels,
			xAxis: `Predicted probability of ${view?.positive ?? ''} (%)`
		};
		element.thresholdIndex = thresholdIndex;
		element.caption = {
			title: 'Predicted probabilities by true class',
			takeaway: 'Most Benign rows score below 50%, most Malignant rows above.'
		};
		element.formatPercent = format.percent;
		element.formatCount = format.count;
		// Like the connected parent, write the index back.
		element.addEventListener('app-threshold-change', (event) => {
			onChange?.(event);
			element.thresholdIndex = (event as CustomEvent<{ index: number }>).detail.index;
		});
		wrapper.append(element);
		return wrapper;
	}
} satisfies Meta<ExplorerArgs>;
export default meta;
type Story = StoryObj<ExplorerArgs>;

/** The default cutoff of 50%; moving the slider emits one change per frame. */
export const Binary: Story = {
	args: { evaluation: breastCancerOneShot(), onChange: fn() },
	play: async ({ canvasElement, args }) => {
		const element =
			canvasElement.querySelector<AppThresholdExplorer>('app-threshold-explorer')!;
		await element.whenSettled();
		const slider = element.shadowRoot!.querySelector('input')!;
		// The Playwright suite covers real arrow keys; here the input event stands in for them.
		slider.value = '51';
		slider.dispatchEvent(new Event('input', { bubbles: true }));
		await waitFor(() => expect(args.onChange).toHaveBeenCalledTimes(1));
		expect(slider.value).toBe('51');
	}
};
/** The ends of the range: every row flagged positive, or none. */
export const ExtremeThresholds: Story = {
	args: { evaluation: breastCancerOneShot(), thresholdIndex: 100 }
};
/** The other extreme flags every row. */
export const ZeroThreshold: Story = {
	args: { evaluation: breastCancerOneShot(), thresholdIndex: 0 }
};
/** Small bins use unique whole-number ticks. */
export const SmallCounts: Story = {
	args: { evaluation: breastCancerOneShot(), smallCounts: true }
};
/** A model without probability estimates has no explorer. */
export const NoProbabilities: Story = {
	args: { evaluation: svcBinaryNoProbabilities() }
};
/** Long class and facet names wrap and remain complete. */
export const LongLabel: Story = { args: { evaluation: withLongLabels(breastCancerOneShot()) } };
/** Logical layout under right-to-left direction. */
export const RTL: Story = { args: { evaluation: breastCancerOneShot(), dir: 'rtl' } };

/** Long labels in right-to-left layout. */
export const LongLabelRTL: Story = {
	args: { evaluation: withLongLabels(breastCancerOneShot()), dir: 'rtl' }
};
