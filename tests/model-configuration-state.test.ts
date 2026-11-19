import { beforeEach, describe, expect, it } from 'bun:test';
import {
	$appState,
	chooseModel,
	completeSection,
	createModel,
	loadDatasetSucceeded,
	setHyperparameters,
	setTarget
} from '../src/stores/app.store';
import { stopPersister } from '../src/stores/persister';
import { $scrollState } from '../src/stores/scroll.store';
import {
	INITIAL_APP_STATE,
	INITIAL_SCROLL_STATE,
	type DatasetSummary,
	type HyperparameterConfig
} from '../src/types/state';

const dataset: DatasetSummary = {
	id: 'dataset-1',
	name: 'Iris',
	source: 'sample',
	rowCount: 150,
	columns: [
		{ name: 'petal', type: 'numeric', missingCount: 0 },
		{ name: 'species', type: 'categorical', missingCount: 0 }
	]
};

describe('setHyperparameters with widened values (WML-P1-STATE-2)', () => {
	beforeEach(() => {
		stopPersister();
		$appState.set({ ...INITIAL_APP_STATE });
		$scrollState.set({ ...INITIAL_SCROLL_STATE });
		loadDatasetSucceeded(dataset);
		setTarget('species');
		createModel();
		chooseModel(1, 'decision-tree-classifier');
	});

	const config: HyperparameterConfig = {
		mode: 'manual',
		values: { maxDepth: null, hiddenLayerSizes: [64, 32], C: 0.5 }
	};

	it('WML-P1-STATE-2: a jsonEqual config is a no-op that keeps the same state reference', () => {
		expect(setHyperparameters(1, config)).toBe(true);
		completeSection(1, 'configure-model');
		const before = $appState.get();
		// updateState returns true for an unchanged transform result (shared setter behaviour)
		const result = setHyperparameters(1, {
			mode: 'manual',
			values: { maxDepth: null, hiddenLayerSizes: [64, 32], C: 0.5 }
		});
		expect(result).toBe(true);
		expect($appState.get()).toBe(before);
		expect($appState.get().models[0]?.completedSteps).toContain('configure-model');
	});

	it('WML-P1-STATE-2: a changed config replaces the state and invalidates later sections', () => {
		setHyperparameters(1, config);
		completeSection(1, 'configure-model');
		completeSection(1, 'configure-training');
		const before = $appState.get();
		expect(
			setHyperparameters(1, { mode: 'manual', values: { ...config.values, maxDepth: 5 } })
		).toBe(true);
		const after = $appState.get();
		expect(after).not.toBe(before);
		expect(after.models[0]?.hyperparameters.values.maxDepth).toBe(5);
		const steps = after.models[0]?.completedSteps ?? [];
		expect(steps).toContain('configure-model');
		expect(steps).not.toContain('configure-training');
	});

	it('WML-P1-STATE-2: null and number[] entries compare by value', () => {
		setHyperparameters(1, config);
		const before = $appState.get();
		setHyperparameters(1, {
			mode: 'manual',
			values: { maxDepth: null, hiddenLayerSizes: [64, 33], C: 0.5 }
		});
		expect($appState.get()).not.toBe(before);
	});
});
