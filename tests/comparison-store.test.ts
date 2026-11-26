import { afterEach, expect, test } from 'bun:test';
import { $appState } from '../src/stores/app.store';
import { $comparison } from '../src/stores/comparison.store';
import { $modelResults, currentResultIdentity } from '../src/stores/model-results.store';
import { DEFAULT_ONE_SHOT_SETUP, INITIAL_APP_STATE, type ModelRecord } from '../src/types/state';
import { breastCancerOneShot } from './fixtures/results/evaluations';

afterEach(() => {
	$modelResults.set({});
	$appState.set({ ...INITIAL_APP_STATE });
});

test('CHT-MODEL-2: resolves labels and legacy colours in model-number order', () => {
	const model = (
		num: number,
		modelLabel: string | null,
		modelId: string,
		modelColor: ModelRecord['modelColor']
	): ModelRecord =>
		({
			num,
			createdAt: num,
			status: 'trained',
			completedSteps: ['choose-model', 'select-features', 'configure-model', 'train'],
			modelId,
			modelLabel,
			modelColor,
			features: ['measurement'],
			modelOptions: {},
			hyperparameters: { mode: 'manual', values: {} },
			multiclass: null,
			trainingSetup: DEFAULT_ONE_SHOT_SETUP,
			progress: null,
			resultRevision: `run-${num}`,
			error: null,
			timings: null,
			durationMs: 250,
			metrics: null,
			ui: {}
		}) as ModelRecord;
	const models = [
		model(3, 'Custom name', 'gaussian-nb', 'red'),
		model(2, '  ', 'gaussian-nb', undefined),
		model(1, null, 'gaussian-nb', undefined)
	];
	$appState.set({
		...INITIAL_APP_STATE,
		dataset: { id: 'd', name: 'd', source: 'upload', rowCount: 40, columns: [] },
		target: 'species',
		models,
		nextModelNum: 4,
		nextModelColorIndex: 1
	});
	for (const entry of models) {
		const identity = currentResultIdentity(entry.num)!;
		expect(identity).not.toBeNull();
		$modelResults.setKey(entry.num, {
			identity,
			status: 'ready',
			evaluation: breastCancerOneShot(),
			error: ''
		});
	}
	const projected = $comparison.get().groups[0]!.models;
	expect(projected.map(({ num }) => num)).toEqual([1, 2, 3]);
	expect(projected[0]!.label).toBe('Gaussian Naive Bayes');
	expect(projected[1]!.label).toBe('Gaussian Naive Bayes');
	expect(projected[2]!.label).toBe('Custom name');
	expect(projected.map(({ modelColor }) => modelColor)).toEqual(['blue', 'teal', 'red']);
});
