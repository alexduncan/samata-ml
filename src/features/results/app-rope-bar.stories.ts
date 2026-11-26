import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { RopeView } from './analysis-protocol';
import './app-rope-bar';

interface Args {
	result: RopeView | null;
	status: 'idle' | 'loading' | 'ready' | 'error' | 'unavailable';
	dir?: 'ltr' | 'rtl';
	long?: boolean;
}
const meta = {
	title: 'Results/Practical equivalence',
	component: 'app-rope-bar',
	tags: ['autodocs'],
	parameters: {
		a11y: { test: 'error' },
		docs: {
			description: {
				component:
					'Do interpret all three probabilities together. Do not call the posterior a significance test.'
			}
		}
	},
	render: (args: Args) => {
		const wrapper = document.createElement('div');
		wrapper.dir = args.dir ?? 'ltr';
		const element = document.createElement('app-rope-bar');
		element.result = args.result;
		element.modelA = { num: 1, label: 'Model 1', modelColor: 'amber' };
		element.modelB = { num: 2, label: 'Model 2', modelColor: 'sky' };
		element.status = args.status;
		element.caption = {
			title: 'Practical equivalence',
			takeaway: args.long
				? 'The probability compares a very long model name with another long model name within a width of 0.01.'
				: 'Model 1 and Model 2 compared within 0.01.'
		};
		element.labels = {
			width: 'Equivalence width',
			invalidWidth: 'Enter a value from 0.1 to 10.',
			aHigher: 'A higher',
			equivalent: 'Equivalent',
			bHigher: 'B higher',
			loading: 'Analysing',
			unavailable: 'Cross-validation folds are required.',
			error: 'Analysis failed.',
			retry: 'Retry',
			outcome: 'Outcome',
			probability: 'Probability',
			showData: 'Show data table',
			xAxis: 'Posterior probability (%)',
			frequencyHeading: 'Frequency',
			inHundred: (count) => `${count} in 100`,
			description: (a, b, ap, eq, bp) => `${a} and ${b}: ${ap}, ${eq}, ${bp}.`,
			liveStatus: (status, summary) => `${status}: ${summary}`,
			modelHigher: (label) => `${label} higher`
		};
		element.formatPercent = (value) =>
			new Intl.NumberFormat('en-GB', { style: 'percent' }).format(value);
		wrapper.append(element);
		return wrapper;
	}
} satisfies Meta<Args>;
export default meta;
type Story = StoryObj<Args>;
/** Model A has a high posterior probability. */ export const AClearlyBetter: Story = {
	args: {
		result: { probabilityLower: 0.02, probabilityEquivalent: 0.03, probabilityHigher: 0.95 },
		status: 'ready'
	}
};
/** Practical equivalence is likely. */ export const Equivalent: Story = {
	args: {
		result: { probabilityLower: 0.1, probabilityEquivalent: 0.8, probabilityHigher: 0.1 },
		status: 'ready'
	}
};
/** The outcome is uncertain. */ export const Uncertain: Story = {
	args: {
		result: { probabilityLower: 0.333, probabilityEquivalent: 0.333, probabilityHigher: 0.334 },
		status: 'ready'
	}
};
/** Amber and dark outcomes can meet with no equivalence segment. */
export const ZeroEquivalent: Story = {
	args: {
		result: { probabilityLower: 0.49, probabilityEquivalent: 0, probabilityHigher: 0.51 },
		status: 'ready'
	}
};
/** A narrow outcome keeps its value in the legend. */
export const NarrowOutcome: Story = {
	args: {
		result: { probabilityLower: 0.01, probabilityEquivalent: 0.49, probabilityHigher: 0.5 },
		status: 'ready'
	}
};
/** Pending analysis. */ export const Loading: Story = {
	args: { result: null, status: 'loading' }
};
/** Analysis has not started. */ export const Idle: Story = {
	args: { result: null, status: 'idle' }
};
/** No cross-validation folds. */ export const Unavailable: Story = {
	args: { result: null, status: 'unavailable' }
};
/** Failed analysis. */ export const Error: Story = { args: { result: null, status: 'error' } };
/** Longer names. */ export const LongLabel: Story = {
	args: {
		result: { probabilityLower: 0.2, probabilityEquivalent: 0.3, probabilityHigher: 0.5 },
		status: 'ready',
		long: true
	}
};
/** Right-to-left layout. */ export const RTL: Story = {
	args: {
		result: { probabilityLower: 0.2, probabilityEquivalent: 0.3, probabilityHigher: 0.5 },
		status: 'ready',
		dir: 'rtl'
	}
};
