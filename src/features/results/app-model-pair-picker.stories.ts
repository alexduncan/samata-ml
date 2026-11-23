import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { ModelOptionView } from './app-comparison-controls';
import './app-model-pair-picker';

interface Args {
	models: ModelOptionView[];
	pairA: number | null;
	pairB: number | null;
	dir?: 'ltr' | 'rtl';
}
const models = [
	{ num: 1, label: 'Model 1' },
	{ num: 2, label: 'Model 2' }
];
const meta = {
	title: 'Results/Model pair',
	component: 'app-model-pair-picker',
	tags: ['autodocs'],
	parameters: {
		a11y: { test: 'error' },
		docs: {
			description: {
				component: 'Do compare either ordering. Do not select the same model twice.'
			}
		}
	},
	render: (args: Args) => {
		const wrapper = document.createElement('div');
		wrapper.dir = args.dir ?? 'ltr';
		const element = document.createElement('app-model-pair-picker');
		element.models = args.models;
		element.pairA = args.pairA;
		element.pairB = args.pairB;
		element.labels = {
			modelA: 'Model A',
			modelB: 'Model B',
			swap: 'Swap models A and B',
			order: 'Model A is Model 1; Model B is Model 2.'
		};
		wrapper.append(element);
		return wrapper;
	}
} satisfies Meta<Args>;
export default meta;
type Story = StoryObj<Args>;
/** Two models with an enabled swap. */ export const TwoModels: Story = {
	args: { models, pairA: 1, pairB: 2 }
};
/** An incomplete pair cannot be swapped. */ export const Invalid: Story = {
	args: { models, pairA: null, pairB: null }
};
/** Long labels wrap. */ export const LongLabel: Story = {
	args: {
		models: [
			{ num: 1, label: 'A classifier with a very long descriptive model name' },
			models[1]!
		],
		pairA: 1,
		pairB: 2
	}
};
/** Right-to-left layout. */ export const RTL: Story = {
	args: { models, pairA: 1, pairB: 2, dir: 'rtl' }
};
