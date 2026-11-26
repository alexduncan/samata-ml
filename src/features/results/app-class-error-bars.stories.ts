import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { ClassErrorRowView } from './app-class-error-bars';
import './app-class-error-bars';

interface Args {
	rows: ClassErrorRowView[];
	dir?: 'ltr' | 'rtl';
}
const rows: ClassErrorRowView[] = [
	{
		classIndex: 0,
		label: 'Adélie',
		models: [
			{
				num: 1,
				label: 'Model 1',
				modelColor: 'amber',
				errorRate: 0.1,
				errorCount: 1,
				support: 10
			},
			{
				num: 2,
				label: 'Model 2',
				modelColor: 'sky',
				errorRate: 0.2,
				errorCount: 2,
				support: 10
			}
		]
	},
	{
		classIndex: 1,
		label: 'Gentoo',
		models: [
			{
				num: 1,
				label: 'Model 1',
				modelColor: 'amber',
				errorRate: 0.15,
				errorCount: 3,
				support: 20
			},
			{
				num: 2,
				label: 'Model 2',
				modelColor: 'sky',
				errorRate: null,
				errorCount: null,
				support: null
			}
		]
	}
];
const meta = {
	title: 'Results/Class error bars',
	component: 'app-class-error-bars',
	tags: ['autodocs'],
	parameters: {
		a11y: { test: 'error' },
		docs: {
			description: {
				component:
					'Do compare class errors with their data table. Do not rely on colour alone.'
			}
		}
	},
	render: (args: Args) => {
		const wrapper = document.createElement('div');
		wrapper.dir = args.dir ?? 'ltr';
		const element = document.createElement('app-class-error-bars');
		element.rows = args.rows;
		element.caption = { title: 'Class errors', takeaway: 'Errors differ by class.' };
		element.labels = {
			class: 'Class',
			model: 'Model',
			errorRate: 'Error rate',
			unavailable: 'Unavailable',
			showData: 'Show data table',
			xAxis: 'Error rate (%, lower is better)',
			yAxis: 'Class and model',
			errorCountHeading: 'Errors',
			errorCountCell: (errors, total) => `${errors} of ${total}`,
			legendLabel: 'Models',
			description: () => 'Class error rates and counts.'
		};
		element.formatPercent = (value) =>
			new Intl.NumberFormat('en-GB', { style: 'percent' }).format(value);
		wrapper.append(element);
		return wrapper;
	}
} satisfies Meta<Args>;
export default meta;
type Story = StoryObj<Args>;
/** Per-class comparison. */ export const Comparison: Story = { args: { rows } };
/** Longer labels. */ export const LongLabel: Story = {
	args: { rows: [{ ...rows[0]!, label: 'A long class label for a rare observation' }, rows[1]!] }
};
/** Right-to-left layout. */ export const RTL: Story = { args: { rows, dir: 'rtl' } };
