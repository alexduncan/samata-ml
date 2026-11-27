import '../../../src/features/results/app-comparison-controls';
import '../../../src/features/results/app-comparison-table';
import '../../../src/features/results/app-model-pair-picker';

const root = document.getElementById('column')!;
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
const controls = document.createElement('app-comparison-controls');
controls.groups = [
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
	},
	{
		fingerprint: 'c'.repeat(64),
		protocol: 'cross_validation',
		modelCount: 2,
		disabled: true,
		reason: 'inconsistent',
		text: 'Cross-validation, 2 models: inconsistent data'
	}
];
controls.fingerprint = 'a'.repeat(64);
controls.models = models;
controls.selected = [1, 2, 3, 4, 5, 6, 7, 8];
controls.labels = {
	group: 'Evaluation group',
	models: 'Models to compare',
	limit: 'Select up to eight models.'
};
controls.addEventListener('app-comparison-selection-change', (event) => {
	controls.selected = (event as CustomEvent<{ selected: number[] }>).detail.selected;
});

const pair = document.createElement('app-model-pair-picker');
pair.models = models.slice(0, 2);
pair.pairA = 1;
pair.pairB = 2;
pair.labels = {
	modelA: 'Model A',
	modelB: 'Model B',
	swap: 'Swap models A and B',
	order: 'Model A is Model 1; Model B is Model 2.'
};
pair.addEventListener('app-model-pair-change', (event) => {
	const detail = (event as CustomEvent<{ pairA: number; pairB: number }>).detail;
	pair.pairA = detail.pairA;
	pair.pairB = detail.pairB;
	pair.labels = {
		...pair.labels,
		order: `Model A is Model ${detail.pairA}; Model B is Model ${detail.pairB}.`
	};
});

const table = document.createElement('app-comparison-table');
table.labels = {
	caption: 'Comparison of models',
	model: 'Model',
	baseline: 'Baseline',
	unavailable: 'Unavailable'
};
table.columns = [{ id: 'balancedAccuracy', label: 'Balanced accuracy', lowerIsBetter: false }];
table.rows = [
	{
		id: '1',
		label: 'Model 1',
		kind: 'model',
		metrics: { balancedAccuracy: { value: 0.8, text: '80%' } }
	},
	{
		id: '2',
		label: 'Model 2',
		kind: 'model',
		metrics: { balancedAccuracy: { value: 0.7, text: '70%' } }
	}
];
table.baselines = [
	{
		id: 'base',
		label: 'Most frequent',
		kind: 'baseline',
		metrics: { balancedAccuracy: { value: null, text: 'Unavailable' } }
	}
];
table.addEventListener('app-comparison-sort-change', (event) => {
	table.sort = (event as CustomEvent<{ sort: typeof table.sort }>).detail.sort;
	table.rows =
		table.sort?.direction === 'ascending'
			? [...table.rows].sort((a, b) => a.id.localeCompare(b.id)).reverse()
			: [...table.rows].sort((a, b) => a.id.localeCompare(b.id));
});
root.append(controls, pair, table);
Object.assign(window, { summaryFixture: true });
