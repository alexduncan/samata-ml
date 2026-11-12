import { describe, expect, it, beforeEach } from 'bun:test';
import {
	$appState,
	chooseModel,
	createModel,
	completeSection,
	reopenSection,
	setFeatures,
	startTraining,
	updateTrainingProgress,
	trainingSucceeded,
	trainingFailed,
	cancelTraining,
	confirmDiscardModels,
	loadDatasetSucceeded,
	setTarget,
	setDataMode,
	setSelectedColumn,
	dismissWelcome,
	setResumePath
} from '../src/stores/app.store';
import {
	$hasDataset,
	$hasTarget,
	$trainedModels,
	$canCompare,
	blockedReason
} from '../src/stores/predicates';
import { initPersister, stopPersister, flushNow, MemoryStorage } from '../src/stores/persister';
import { reconcileStartupState, type IndexedDBAdapter } from '../src/stores/reconciler';
import {
	INITIAL_APP_STATE,
	STATE_STORAGE_KEY,
	STORAGE_VERSION,
	type DatasetSummary,
	type PersistedAppState
} from '../src/types/state';

const sampleDataset: DatasetSummary = {
	id: 'dataset-123',
	name: 'Iris Flower Dataset',
	source: 'sample',
	rowCount: 150,
	columns: [
		{ name: 'sepal_length', type: 'numeric', missingCount: 0 },
		{ name: 'sepal_width', type: 'numeric', missingCount: 0 },
		{ name: 'petal_length', type: 'numeric', missingCount: 0 },
		{ name: 'species', type: 'categorical', missingCount: 0 },
		{ name: 'notes', type: 'text', missingCount: 0 }
	]
};

describe('State & Persistence (NAV-AC-3 through NAV-AC-10)', () => {
	beforeEach(() => {
		stopPersister();
		$appState.set({ ...INITIAL_APP_STATE });
	});

	describe('NAV-AC-3: Availability predicates and blockedReason', () => {
		it('computes correct boolean predicates across state transitions', () => {
			// Initially empty
			expect($hasDataset.get()).toBe(false);
			expect($hasTarget.get()).toBe(false);
			expect($canCompare.get()).toBe(false);
			expect($trainedModels.get()).toEqual([]);

			// Load dataset
			loadDatasetSucceeded(sampleDataset);
			expect($hasDataset.get()).toBe(true);
			expect($hasTarget.get()).toBe(false);

			// Set target
			setTarget('species');
			expect($hasTarget.get()).toBe(true);
			expect($canCompare.get()).toBe(false);

			// Create two models and mark them trained
			createModel();
			chooseModel(1, 'logreg');
			createModel();
			chooseModel(2, 'knn');
			completeSection(1, 'choose-model');
			setFeatures(1, ['sepal_length', 'sepal_width']);
			completeSection(1, 'select-features');
			completeSection(1, 'configure-model');
			completeSection(1, 'configure-training');
			startTraining(1);
			trainingSucceeded(1, { metrics: { accuracy: 0.95 } });

			expect($trainedModels.get().length).toBe(1);
			expect($canCompare.get()).toBe(false);

			completeSection(2, 'choose-model');
			setFeatures(2, ['petal_length']);
			completeSection(2, 'select-features');
			completeSection(2, 'configure-model');
			completeSection(2, 'configure-training');
			startTraining(2);
			trainingSucceeded(2, { metrics: { accuracy: 0.92 } });

			expect($trainedModels.get().length).toBe(2);
			expect($canCompare.get()).toBe(true);
		});

		it('returns accurate blockedReason for each route according to prerequisites', () => {
			const emptyState = { ...INITIAL_APP_STATE };
			expect(blockedReason('/data', emptyState)).toBeNull();

			// Target blocked without dataset
			const targetBlocked = blockedReason('/target', emptyState);
			expect(targetBlocked).toBe('DATASET_REQUIRED');

			// Models blocked without dataset
			const modelsNoData = blockedReason('/models', emptyState);
			expect(modelsNoData).toBe('DATASET_REQUIRED');

			// Models blocked with dataset but without target
			const stateWithData: PersistedAppState = { ...emptyState, dataset: sampleDataset };
			const modelsNoTarget = blockedReason('/models', stateWithData);
			expect(modelsNoTarget).toBe('TARGET_REQUIRED');

			// Model num blocked when nonexistent
			const modelNotFound = blockedReason('/models/99', stateWithData);
			expect(modelNotFound).toBe('TARGET_REQUIRED'); // missing target checked before model_not_found

			const stateWithTarget: PersistedAppState = { ...stateWithData, target: 'species' };
			const modelNotFoundWithTarget = blockedReason('/models/99', stateWithTarget);
			expect(modelNotFoundWithTarget).toBe('MODEL_NOT_FOUND');

			// Compare results blocked with fewer than 2 trained models
			const compareBlocked = blockedReason('/results', stateWithTarget);
			expect(compareBlocked).toBe('TWO_TRAINED_MODELS_REQUIRED');
		});
	});

	describe('NAV-AC-5: Dataset change reconciliation', () => {
		it('preserves downstream state when identical dataset schema is reloaded', () => {
			loadDatasetSucceeded(sampleDataset);
			setTarget('species');
			createModel();
			expect($appState.get().models.length).toBe(1);
			expect($appState.get().target).toBe('species');

			const identicalDataset: DatasetSummary = {
				...sampleDataset,
				rowCount: 200 // Row count changed but schema and ID remain
			};
			loadDatasetSucceeded(identicalDataset);

			expect($appState.get().target).toBe('species');
			expect($appState.get().models.length).toBe(1);
		});

		it('clears target and models when a different dataset is loaded', () => {
			loadDatasetSucceeded(sampleDataset);
			setTarget('species');
			createModel();

			const differentDataset: DatasetSummary = {
				id: 'dataset-456',
				name: 'Different Dataset',
				source: 'upload',
				rowCount: 50,
				columns: [{ name: 'feature_a', type: 'numeric', missingCount: 0 }]
			};
			loadDatasetSucceeded(differentDataset);

			expect($appState.get().dataset?.id).toBe('dataset-456');
			expect($appState.get().target).toBeNull();
			expect($appState.get().models).toEqual([]);
			expect($appState.get().nextModelNum).toBe(1);
		});
	});

	describe('NAV-AC-6: setTarget rejection with existing models', () => {
		it('rejects target change when models exist until confirmDiscardModels', () => {
			loadDatasetSucceeded(sampleDataset);
			setTarget('species');
			createModel();
			expect($appState.get().models.length).toBe(1);

			// Attempt change without confirmation
			const rejected = setTarget('sepal_length');
			expect(rejected).toBe(false);
			expect($appState.get().target).toBe('species');
			expect($appState.get().models.length).toBe(1);

			// Confirm discard of models
			confirmDiscardModels();
			expect($appState.get().models).toEqual([]);
			expect($appState.get().nextModelNum).toBe(1);

			// Now target change succeeds
			const confirmed = setTarget('sepal_length');
			expect(confirmed).toBe(true);
			expect($appState.get().target).toBe('sepal_length');
		});
	});

	describe('NAV-AC-7: Model lifecycle transition table', () => {
		it('transitions correctly through draft -> training -> trained lifecycle', () => {
			loadDatasetSucceeded(sampleDataset);
			setTarget('species');
			const modelNum = createModel();
			expect(typeof modelNum).toBe('number');
			expect($appState.get().models[0]?.status).toBe('draft');

			// Cannot start training before completing sections 1–4
			expect(startTraining(1)).toBe(false);

			completeSection(1, 'choose-model');
			setFeatures(1, ['sepal_length']);
			completeSection(1, 'select-features');
			completeSection(1, 'configure-model');
			completeSection(1, 'configure-training');

			// Now training can start
			expect(startTraining(1)).toBe(true);
			expect($appState.get().models[0]?.status).toBe('training');
			expect($appState.get().models[0]?.progress?.percent).toBe(0);

			// Update progress
			updateTrainingProgress(1, { percent: 50, statusMessage: 'Optimizing weights...' });
			expect($appState.get().models[0]?.progress?.percent).toBe(50);

			// Training success
			trainingSucceeded(1, { metrics: { f1: 0.91 } });
			const trainedModel = $appState.get().models[0];
			expect(trainedModel?.status).toBe('trained');
			expect(trainedModel?.progress).toBeNull();
			expect(trainedModel?.metrics).toEqual({ f1: 0.91 });
			expect(trainedModel?.completedSteps).toContain('training');
		});

		it('handles training failure and cancellation transitions', () => {
			loadDatasetSucceeded(sampleDataset);
			setTarget('species');
			createModel();
			completeSection(1, 'choose-model');
			setFeatures(1, ['sepal_length']);
			completeSection(1, 'select-features');
			completeSection(1, 'configure-model');
			completeSection(1, 'configure-training');

			startTraining(1);
			trainingFailed(1, 'Matrix not positive definite');
			let m = $appState.get().models[0];
			expect(m?.status).toBe('draft');
			expect(m?.error?.code).toBe('TRAINING_FAILED');
			expect(m?.error?.message).toBe('Matrix not positive definite');

			startTraining(1);
			cancelTraining(1);
			m = $appState.get().models[0];
			expect(m?.status).toBe('draft');
			expect(m?.error?.code).toBe('TRAINING_CANCELLED');
		});
	});

	describe('NAV-AC-8: Re-opening and editing sections', () => {
		it('invalidates only downstream sections when an earlier section is reopened', () => {
			loadDatasetSucceeded(sampleDataset);
			setTarget('species');
			createModel();
			completeSection(1, 'choose-model');
			setFeatures(1, ['sepal_length']);
			completeSection(1, 'select-features');
			completeSection(1, 'configure-model');
			completeSection(1, 'configure-training');

			expect($appState.get().models[0]?.completedSteps).toEqual([
				'choose-model',
				'select-features',
				'configure-model',
				'configure-training'
			]);

			// Re-open select-features (step 2)
			reopenSection(1, 'select-features');

			// choose-model remains completed; select-features and later are invalidated
			expect($appState.get().models[0]?.completedSteps).toEqual(['choose-model']);
		});
	});

	describe('NAV-AC-9: Interrupted training recovery on hydrate', () => {
		it('recovers interrupted model to draft with TRAINING_INTERRUPTED_BY_RELOAD when lock acquired', async () => {
			const storage = new MemoryStorage();
			const stateWithTraining: PersistedAppState = {
				...INITIAL_APP_STATE,
				dataset: sampleDataset,
				target: 'species',
				models: [
					{
						num: 1,
						createdAt: Date.now(),
						modelId: 'logreg',
						modelOptions: {},
						hyperparameters: { mode: 'manual', values: {} },
						features: ['sepal_length'],
						multiclass: 'native',
						trainingSetup: { type: 'k_fold_cv', folds: 5 },
						completedSteps: [
							'choose-model',
							'select-features',
							'configure-model',
							'configure-training',
							'training'
						],
						status: 'training',
						progress: { percent: 45, statusMessage: 'Training...' },
						error: null,
						timings: null,
						durationMs: null,
						metrics: null,
						ui: {}
					}
				],
				nextModelNum: 2
			};
			storage.setItem(STATE_STORAGE_KEY, JSON.stringify(stateWithTraining));

			const mockIdb: IndexedDBAdapter = {
				async hasMetadata() {
					return true;
				},
				async deleteOrphanDatasets() {},
				async hasModelResults() {
					return false;
				}
			};

			const reconciled = await reconcileStartupState(storage, mockIdb);
			const recoveredModel = reconciled.models[0];

			expect(recoveredModel?.status).toBe('draft');
			expect(recoveredModel?.progress).toBeNull();
			expect(recoveredModel?.error?.code).toBe('TRAINING_INTERRUPTED_BY_RELOAD');
			expect(recoveredModel?.completedSteps).not.toContain('training');
		});

		it('leaves model as training if another tab holds the Web Lock', async () => {
			const storage = new MemoryStorage();
			const stateWithTraining: PersistedAppState = {
				...INITIAL_APP_STATE,
				dataset: sampleDataset,
				target: 'species',
				models: [
					{
						num: 1,
						createdAt: Date.now(),
						modelId: 'logreg',
						modelOptions: {},
						hyperparameters: { mode: 'manual', values: {} },
						features: ['sepal_length'],
						multiclass: 'native',
						trainingSetup: { type: 'k_fold_cv', folds: 5 },
						completedSteps: [
							'choose-model',
							'select-features',
							'configure-model',
							'configure-training',
							'training'
						],
						status: 'training',
						progress: { percent: 70, statusMessage: 'Training...' },
						error: null,
						timings: null,
						durationMs: null,
						metrics: null,
						ui: {}
					}
				],
				nextModelNum: 2
			};
			storage.setItem(STATE_STORAGE_KEY, JSON.stringify(stateWithTraining));

			const mockIdb: IndexedDBAdapter = {
				async hasMetadata() {
					return true;
				},
				async deleteOrphanDatasets() {},
				async hasModelResults() {
					return false;
				}
			};

			// Simulate another tab holding the lock
			const releaseLock = (globalThis.navigator.locks as any)._holdLock(
				'samata-ml:training:1'
			);

			try {
				const reconciled = await reconcileStartupState(storage, mockIdb);
				const model = reconciled.models[0];
				expect(model?.status).toBe('training');
				expect(model?.progress?.percent).toBe(70);
			} finally {
				releaseLock();
			}
		});
	});

	describe('NAV-AC-10: Corrupt JSON, wrong shape, and unsupported version handling', () => {
		const mockIdb: IndexedDBAdapter = {
			async hasMetadata() {
				return true;
			},
			async deleteOrphanDatasets() {},
			async hasModelResults() {
				return true;
			}
		};

		it('cleanly recovers to defaults when storage has corrupt JSON', async () => {
			const storage = new MemoryStorage();
			storage.setItem(STATE_STORAGE_KEY, '{ invalid json syntax !!!');

			const reconciled = await reconcileStartupState(storage, mockIdb);
			expect(reconciled.version).toBe(STORAGE_VERSION);
			expect(reconciled.dataset).toBeNull();
			expect(reconciled.models).toEqual([]);
			expect(reconciled.resumePath).toBe('/data');
		});

		it('cleanly recovers to defaults when version is unsupported', async () => {
			const storage = new MemoryStorage();
			storage.setItem(
				STATE_STORAGE_KEY,
				JSON.stringify({ ...INITIAL_APP_STATE, version: 999 })
			);

			const reconciled = await reconcileStartupState(storage, mockIdb);
			expect(reconciled.version).toBe(STORAGE_VERSION);
		});

		it('cleanly recovers to defaults when shape is malformed', async () => {
			const storage = new MemoryStorage();
			storage.setItem(
				STATE_STORAGE_KEY,
				JSON.stringify({ version: STORAGE_VERSION, models: 'not-an-array' })
			);

			const reconciled = await reconcileStartupState(storage, mockIdb);
			expect(reconciled.models).toEqual([]);
			expect(reconciled.data.mode).toBe('select');
		});

		it('initializes to defaults when storage is empty', async () => {
			const storage = new MemoryStorage();
			const reconciled = await reconcileStartupState(storage, mockIdb);
			expect(reconciled).toEqual(INITIAL_APP_STATE);
		});
	});
});
