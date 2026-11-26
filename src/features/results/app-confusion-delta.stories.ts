import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { ConfusionDeltaView } from './app-confusion-delta';
import './app-confusion-delta';

interface Args {
	delta: ConfusionDeltaView;
	takeaway: string;
	dir?: 'ltr' | 'rtl';
}
const delta: ConfusionDeltaView = {
	labelA: 'Model 1',
	labelB: 'Model 2',
	labels: ['Adélie', 'Gentoo'],
	counts: [0, 1234, -1234, 0],
	shownClassIndices: [0, 1],
	largest: { trueIndex: 0, predictedIndex: 1, count: 1234 }
};
const many: ConfusionDeltaView = {
	...delta,
	labels: Array.from({ length: 25 }, (_, index) => `Class ${index + 1}`),
	counts: Array(625).fill(0),
	shownClassIndices: Array.from({ length: 20 }, (_, index) => index),
	largest: null
};
const meta = {
	title: 'Results/Confusion differences',
	component: 'app-confusion-delta',
	tags: ['autodocs'],
	parameters: {
		a11y: { test: 'error' },
		docs: {
			description: {
				component:
					'Do read signed differences with the class labels. Do not infer direction from colour alone.'
			}
		}
	},
	render: (args: Args) => {
		const wrapper = document.createElement('div');
		wrapper.dir = args.dir ?? 'ltr';
		const element = document.createElement('app-confusion-delta');
		element.delta = args.delta;
		element.labels = {
			caption: 'Confusion differences',
			filter: 'True class',
			allClasses: 'Default classes',
			trueClass: 'True class',
			predictedClass: 'Predicted class',
			correct: 'correct',
			takeaway: args.takeaway,
			filterStatus: (label) => `Showing ${label ?? 'all classes'}.`
		};
		element.formatSignedCount = (value) =>
			new Intl.NumberFormat('en-GB', {
				signDisplay: 'exceptZero',
				maximumFractionDigits: 0,
				useGrouping: true
			}).format(value);
		wrapper.append(element);
		return wrapper;
	}
} satisfies Meta<Args>;
export default meta;
type Story = StoryObj<Args>;
/** Signed differences. */ export const Signed: Story = {
	args: { delta, takeaway: 'Adélie predicted as Gentoo: +1,234.' }
};
/** Equal matrices. */ export const Equal: Story = {
	args: { delta: { ...delta, counts: [0, 0, 0, 0], largest: null }, takeaway: 'No differences' }
};
/** Filter for many classes. */ export const ManyClasses: Story = {
	args: { delta: many, takeaway: 'No differences' }
};
/** Long labels. */ export const LongLabel: Story = {
	args: {
		delta: {
			...delta,
			labels: ['A particularly long true class name', 'Another long predicted class name']
		},
		takeaway: 'Differences are shown.'
	}
};
/** Right-to-left layout. */ export const RTL: Story = {
	args: { delta, takeaway: 'Differences are shown.', dir: 'rtl' }
};
