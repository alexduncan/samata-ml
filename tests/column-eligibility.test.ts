import { beforeEach, describe, expect, it } from 'bun:test';
import { $appState, setTarget } from '../src/stores/app.store';
import { reconcileStartupState, type IndexedDBAdapter } from '../src/stores/reconciler';
import { MemoryStorage } from '../src/stores/persister';
import { INITIAL_APP_STATE, STATE_STORAGE_KEY, type PersistedAppState } from '../src/types/state';

const idb: IndexedDBAdapter = {
	async hasMetadata() {
		return true;
	},
	async deleteOrphanDatasets() {},
	async hasModelResults() {
		return true;
	}
};

const dataset = {
	id: 'dataset-1',
	name: 'Test dataset',
	source: 'sample' as const,
	rowCount: 2,
	columns: [
		{ name: 'number', type: 'numeric' as const, missingCount: 0 },
		{ name: 'category', type: 'categorical' as const, missingCount: 0 },
		{ name: 'flag', type: 'boolean' as const, missingCount: 0 },
		{ name: 'date', type: 'datetime' as const, missingCount: 0 },
		{ name: 'notes', type: 'text' as const, missingCount: 0 }
	]
};

describe('column eligibility', () => {
	beforeEach(() => {
		$appState.set({ ...INITIAL_APP_STATE });
	});

	it('accepts numeric, categorical and boolean targets, and rejects datetime and text', () => {
		$appState.set({ ...INITIAL_APP_STATE, dataset });

		expect(setTarget('number')).toBe(true);
		expect(setTarget('category')).toBe(true);
		expect(setTarget('flag')).toBe(true);
		expect(setTarget('date')).toBe(false);
		expect(setTarget('notes')).toBe(false);
	});

	it('drops a datetime target and feature during reconciliation', async () => {
		const storage = new MemoryStorage();
		const state: PersistedAppState = {
			...INITIAL_APP_STATE,
			dataset,
			target: 'date',
			models: [
				{
					num: 1,
					createdAt: 1,
					status: 'draft',
					completedSteps: [],
					modelId: null,
					features: ['date'],
					modelOptions: {},
					hyperparameters: { mode: 'manual', values: {} },
					multiclass: null,
					trainingSetup: null,
					progress: null,
					resultRevision: null,
					error: null,
					timings: null,
					durationMs: null,
					metrics: null,
					ui: {}
				}
			]
		};
		storage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));

		const reconciled = await reconcileStartupState(storage, idb);

		expect(reconciled.target).toBeNull();
		expect(reconciled.models).toEqual([]);

		storage.setItem(STATE_STORAGE_KEY, JSON.stringify({ ...state, target: 'category' }));
		const reconciledFeature = await reconcileStartupState(storage, idb);
		expect(reconciledFeature.target).toBe('category');
		expect(reconciledFeature.models[0]?.features).toEqual([]);
	});

	it('preserves an optional sampleId through reconciliation', async () => {
		const storage = new MemoryStorage();
		const state: PersistedAppState = {
			...INITIAL_APP_STATE,
			dataset: { ...dataset, sampleId: 'sample-1' }
		};
		storage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));

		const withSampleId = await reconcileStartupState(storage, idb);
		expect(withSampleId.dataset?.sampleId).toBe('sample-1');

		storage.setItem(STATE_STORAGE_KEY, JSON.stringify({ ...state, dataset }));
		const withoutSampleId = await reconcileStartupState(storage, idb);
		expect(withoutSampleId.dataset).toEqual(dataset);
	});
});
