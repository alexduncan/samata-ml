import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './app-instance-agreement';

interface Args {
	counts: number[];
	dir?: 'ltr' | 'rtl';
	long?: boolean;
}
const meta = {
	title: 'Results/Instance agreement',
	component: 'app-instance-agreement',
	tags: ['autodocs'],
	parameters: {
		a11y: { test: 'error' },
		docs: {
			description: {
				component:
					'Do examine the cases all models miss. Do not infer a winner from agreement alone.'
			}
		}
	},
	render: (args: Args) => {
		const wrapper = document.createElement('div');
		wrapper.dir = args.dir ?? 'ltr';
		const element = document.createElement('app-instance-agreement');
		element.counts = { counts: args.counts };
		element.caption = {
			title: 'Instance agreement',
			takeaway: `${args.counts[0]} cases were missed by every model.`
		};
		element.labels = {
			correctModels: 'Correct models',
			rowCount: 'Rows',
			showData: 'Show data table',
			xAxis: (n) => `Models correct (out of ${n})`,
			yAxis: 'Rows',
			shareHeading: 'Share (%)',
			description: (counts) => `Agreement counts: ${counts.join(', ')}.`,
			bucket: (count) =>
				args.long
					? `${count} of the compared models predicted this row correctly`
					: `${count} correct`
		};
		element.formatCount = (value) => new Intl.NumberFormat('en-GB').format(value);
		wrapper.append(element);
		return wrapper;
	}
} satisfies Meta<Args>;
export default meta;
type Story = StoryObj<Args>;
/** Three models and hard cases. */ export const ThreeModels: Story = {
	args: { counts: [4, 7, 12, 27] }
};
/** No hard cases. */ export const NoHardCases: Story = { args: { counts: [0, 7, 12, 31] } };
/** Small counts use distinct integer ticks. */ export const SmallCounts: Story = {
	args: { counts: [0, 1, 2, 3] }
};
/** Long labels. */ export const LongLabel: Story = {
	args: { counts: [4, 7, 12, 27], long: true }
};
/** Right-to-left layout. */ export const RTL: Story = {
	args: { counts: [4, 7, 12, 27], dir: 'rtl' }
};
