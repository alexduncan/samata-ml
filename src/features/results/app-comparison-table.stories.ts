import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { ComparisonColumnView, ComparisonRowView } from './app-comparison-table';
import type { ComparisonUi } from '../../types/state';
import './app-comparison-table';

interface Args {
	rows: ComparisonRowView[];
	columns: ComparisonColumnView[];
	sort?: ComparisonUi['sort'];
	dir?: 'ltr' | 'rtl';
}
const columns: ComparisonColumnView[] = [
	{ id: 'balancedAccuracy', label: 'Balanced accuracy', lowerIsBetter: false },
	{ id: 'errors', label: 'Errors (lower is better)', lowerIsBetter: true }
];
const binaryColumns: ComparisonColumnView[] = [
	...columns,
	{ id: 'falsePositives', label: 'False positives (lower is better)', lowerIsBetter: true },
	{ id: 'falseNegatives', label: 'False negatives (lower is better)', lowerIsBetter: true }
];
const rows: ComparisonRowView[] = [
	{
		id: '1',
		label: 'Model 1',
		kind: 'model',
		metrics: { balancedAccuracy: { value: 0.8, text: '80%' }, errors: { value: 4, text: '4' } }
	},
	{
		id: '2',
		label: 'Model 2',
		kind: 'model',
		metrics: { balancedAccuracy: { value: 0.7, text: '70%' }, errors: { value: 6, text: '6' } }
	}
];
const meta = {
	title: 'Results/Comparison table',
	component: 'app-comparison-table',
	tags: ['autodocs'],
	parameters: {
		a11y: { test: 'error' },
		docs: {
			description: {
				component:
					'Do compare against the baselines. Do not read the top row as the winner.'
			}
		}
	},
	render: (args: Args) => {
		const wrapper = document.createElement('div');
		wrapper.dir = args.dir ?? 'ltr';
		const element = document.createElement('app-comparison-table');
		element.rows = args.rows;
		element.columns = args.columns;
		element.sort = args.sort ?? null;
		element.baselines = [
			{
				id: 'baseline',
				label: 'Most frequent',
				kind: 'baseline',
				metrics: {
					balancedAccuracy: { value: 0.5, text: '50%' },
					errors: { value: null, text: 'Unavailable' }
				}
			}
		];
		element.labels = {
			caption: 'Comparison of models',
			model: 'Model',
			baseline: 'Baseline',
			unavailable: 'Unavailable'
		};
		wrapper.append(element);
		return wrapper;
	}
} satisfies Meta<Args>;
export default meta;
type Story = StoryObj<Args>;
/** Binary measures. */ export const Binary: Story = { args: { rows, columns: binaryColumns } };
/** Multiclass measures. */ export const Multiclass: Story = { args: { rows, columns } };
/** Active sort. */ export const Sorted: Story = {
	args: {
		rows: [...rows].reverse(),
		columns,
		sort: { column: 'balancedAccuracy', direction: 'ascending' }
	}
};
/** Long labels wrap. */ export const LongLabel: Story = {
	args: {
		rows: [
			{
				...rows[0]!,
				label: 'A classifier with an exceptionally long descriptive model name'
			},
			rows[1]!
		],
		columns
	}
};
/** Right-to-left layout. */ export const RTL: Story = { args: { rows, columns, dir: 'rtl' } };
