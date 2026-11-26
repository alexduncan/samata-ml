import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { GroupOptionView, ModelOptionView } from './app-comparison-controls';
import './app-comparison-controls';

interface Args {
	models: ModelOptionView[];
	selected: number[];
	groups: GroupOptionView[];
	dir?: 'ltr' | 'rtl';
}
const colors = [
	'amber',
	'sky',
	'olive',
	'neutral',
	'blue',
	'teal',
	'purple',
	'red',
	'green'
] as const;
const models = Array.from({ length: 9 }, (_, index) => ({
	num: index + 1,
	label: `Model ${index + 1}`,
	color: colors[index]!
}));
const groups: GroupOptionView[] = [
	{
		fingerprint: 'a'.repeat(64),
		protocol: 'cross_validation',
		modelCount: 3,
		disabled: false,
		reason: null,
		text: 'Cross-validation, 3 models'
	},
	{
		fingerprint: 'b'.repeat(64),
		protocol: 'one_shot',
		modelCount: 1,
		disabled: true,
		reason: 'single-model',
		text: 'One-Shot, 1 model: another model is needed'
	}
];
const meta = {
	title: 'Results/Comparison controls',
	component: 'app-comparison-controls',
	tags: ['autodocs'],
	parameters: {
		a11y: { test: 'error' },
		docs: {
			description: {
				component:
					'Do compare models evaluated on the same rows. Do not select more than eight models.'
			}
		}
	},
	render: (args: Args) => {
		const wrapper = document.createElement('div');
		wrapper.dir = args.dir ?? 'ltr';
		const element = document.createElement('app-comparison-controls');
		element.groups = args.groups;
		element.fingerprint = groups[0]!.fingerprint;
		element.models = args.models;
		element.selected = args.selected;
		element.labels = {
			group: 'Evaluation group',
			models: 'Models to compare',
			limit: 'Select up to eight models.'
		};
		wrapper.append(element);
		return wrapper;
	}
} satisfies Meta<Args>;
export default meta;
type Story = StoryObj<Args>;
/** Two models. */ export const TwoModels: Story = {
	args: { models: models.slice(0, 2), selected: [1, 2], groups: groups.slice(0, 1) }
};
/** Eight models. */ export const EightModels: Story = {
	args: { models: models.slice(0, 8), selected: [1, 2, 3, 4, 5, 6, 7, 8], groups }
};
/** A ninth choice is disabled. */ export const LimitReached: Story = {
	args: { models, selected: [1, 2, 3, 4, 5, 6, 7, 8], groups }
};
/** Multiple evaluation groups. */ export const MultipleGroups: Story = {
	args: { models, selected: [1, 2], groups }
};
/** Long labels wrap. */ export const LongLabel: Story = {
	args: {
		models: [
			{
				num: 1,
				label: 'A classifier with an exceptionally long descriptive model name',
				color: 'amber'
			}
		],
		selected: [1],
		groups
	}
};
/** Right-to-left layout. */ export const RTL: Story = {
	args: { models: models.slice(0, 2), selected: [1, 2], groups, dir: 'rtl' }
};
