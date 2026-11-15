import { describe, expect, it, beforeEach } from 'bun:test';
import {
	$appState,
	chooseModel,
	createModel,
	completeSection,
	reopenSection,
	setFeatures,
	initialiseFeatureSelection,
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
	setResumePath,
	toggleFeature,
	setModelOptions,
	setMulticlassStrategy,
	setHyperparameters,
	setTrainingSetup,
	recoverInterrupted
} from '../src/stores/app.store';
import {
	$hasDataset,
	$hasTarget,
	$trainedModels,
	$canCompare,
	blockedReason
} from '../src/stores/predicates';
import {
	initPersister,
	stopPersister,
	flushNow,
	MemoryStorage,
	type StorageAdapter
} from '../src/stores/persister';
import { reconcileStartupState, type IndexedDBAdapter } from '../src/stores/reconciler';
import { $scrollState } from '../src/stores/scroll.store';
import {
	INITIAL_APP_STATE,
	INITIAL_SCROLL_STATE,
	STATE_STORAGE_KEY,
	STORAGE_VERSION,
	type DatasetSummary,
	type PersistedAppState,
	type ScrollSnapshot
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
		$scrollState.set({ ...INITIAL_SCROLL_STATE });
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
			setTrainingSetup(1, { type: 'k_fold_cv', folds: 5 });
			startTraining(1);
			trainingSucceeded(1, { metrics: { accuracy: 0.95 } });

			expect($trainedModels.get().length).toBe(1);
			expect($canCompare.get()).toBe(false);

			completeSection(2, 'choose-model');
			setFeatures(2, ['petal_length']);
			completeSection(2, 'select-features');
			completeSection(2, 'configure-model');
			setTrainingSetup(2, { type: 'k_fold_cv', folds: 5 });
			startTraining(2);
			trainingSucceeded(2, { metrics: { accuracy: 0.92 } });

			expect($trainedModels.get().length).toBe(2);
			expect($canCompare.get()).toBe(true);
		});

		it('returns accurate blockedReason for each route according to prerequisites (NAV-AC-3b)', () => {
			const emptyState = { ...INITIAL_APP_STATE };
			expect(blockedReason('/data', emptyState)).toBeNull();

			// Target blocked without dataset
			expect(blockedReason('/target', emptyState)).toBe('DATASET_REQUIRED');

			// Models blocked without dataset
			expect(blockedReason('/models', emptyState)).toBe('DATASET_REQUIRED');

			// /models/{num} returns MODEL_NOT_FOUND if nonexistent (even with no dataset/target per D5)
			expect(blockedReason('/models/99', emptyState)).toBe('MODEL_NOT_FOUND');

			// /results returns TWO_TRAINED_MODELS_REQUIRED (even with no dataset/target per D5)
			expect(blockedReason('/results', emptyState)).toBe('TWO_TRAINED_MODELS_REQUIRED');

			// State with dataset, no target
			const stateWithData: PersistedAppState = { ...emptyState, dataset: sampleDataset };
			expect(blockedReason('/data', stateWithData)).toBeNull();
			expect(blockedReason('/target', stateWithData)).toBeNull();
			expect(blockedReason('/models', stateWithData)).toBe('TARGET_REQUIRED');
			expect(blockedReason('/models/99', stateWithData)).toBe('MODEL_NOT_FOUND');
			expect(blockedReason('/results', stateWithData)).toBe('TWO_TRAINED_MODELS_REQUIRED');

			// State with dataset and target
			const stateWithTarget: PersistedAppState = { ...stateWithData, target: 'species' };
			expect(blockedReason('/data', stateWithTarget)).toBeNull();
			expect(blockedReason('/target', stateWithTarget)).toBeNull();
			expect(blockedReason('/models', stateWithTarget)).toBeNull();
			expect(blockedReason('/models/99', stateWithTarget)).toBe('MODEL_NOT_FOUND');
			expect(blockedReason('/results', stateWithTarget)).toBe('TWO_TRAINED_MODELS_REQUIRED');

			// With 1 model (draft)
			const mockModel1 = {
				num: 1,
				createdAt: Date.now(),
				status: 'draft' as const,
				completedSteps: [],
				modelId: 'logreg',
				features: ['sepal_length'],
				modelOptions: {},
				hyperparameters: { mode: 'manual' as const, values: {} },
				multiclass: null,
				trainingSetup: null,
				progress: null,
				error: null,
				timings: null,
				durationMs: null,
				metrics: null,
				ui: {}
			};
			const stateWithModel1: PersistedAppState = { ...stateWithTarget, models: [mockModel1] };
			expect(blockedReason('/models/1', stateWithModel1)).toBeNull();
			expect(blockedReason('/models/2', stateWithModel1)).toBe('MODEL_NOT_FOUND');
			expect(blockedReason('/results', stateWithModel1)).toBe('TWO_TRAINED_MODELS_REQUIRED');

			// With 1 trained model
			const trainedModel1 = { ...mockModel1, status: 'trained' as const };
			const stateWith1Trained: PersistedAppState = {
				...stateWithTarget,
				models: [trainedModel1]
			};
			expect(blockedReason('/models/1', stateWith1Trained)).toBeNull();
			expect(blockedReason('/results', stateWith1Trained)).toBe(
				'TWO_TRAINED_MODELS_REQUIRED'
			);

			// With 2 trained models
			const trainedModel2 = { ...mockModel1, num: 2, status: 'trained' as const };
			const stateWith2Trained: PersistedAppState = {
				...stateWithTarget,
				models: [trainedModel1, trainedModel2]
			};
			expect(blockedReason('/models/1', stateWith2Trained)).toBeNull();
			expect(blockedReason('/models/2', stateWith2Trained)).toBeNull();
			expect(blockedReason('/results', stateWith2Trained)).toBeNull();
		});
	});

	describe('NAV-AC-5: Dataset change reconciliation', () => {
		it('preserves downstream state when identical dataset schema is reloaded and sets data.mode to preview', () => {
			loadDatasetSucceeded(sampleDataset);
			setDataMode('select');
			setSelectedColumn('sepal_length');
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
			expect($appState.get().data.mode).toBe('preview');
			expect($appState.get().data.selectedColumn).toBeNull();
		});

		it('clears target and models and non-data scroll snapshots when a different dataset is loaded', () => {
			loadDatasetSucceeded(sampleDataset);
			setTarget('species');
			createModel();

			const snap: ScrollSnapshot = { viewportWidth: 1024, top: 100, savedAt: Date.now() };
			$scrollState.set({
				version: STORAGE_VERSION,
				snapshots: {
					'data:select': snap,
					'data:preview': snap,
					target: snap,
					models: snap,
					'models/3': snap,
					results: snap
				}
			});

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

			const snapshots = $scrollState.get().snapshots;
			expect(snapshots['data:select']).toBeDefined();
			expect(snapshots['data:preview']).toBeDefined();
			expect(snapshots['target']).toBeUndefined();
			expect(snapshots['models']).toBeUndefined();
			expect(snapshots['models/3']).toBeUndefined();
			expect(snapshots['results']).toBeUndefined();
		});
	});

	describe('NAV-AC-6: setTarget rejection with existing models', () => {
		it('rejects target change when models exist until confirmDiscardModels, clearing only model/results scroll', () => {
			loadDatasetSucceeded(sampleDataset);
			setTarget('species');
			createModel();
			expect($appState.get().models.length).toBe(1);

			const snap: ScrollSnapshot = { viewportWidth: 1024, top: 100, savedAt: Date.now() };
			$scrollState.set({
				version: STORAGE_VERSION,
				snapshots: {
					target: snap,
					models: snap,
					'models/1': snap,
					'models/2': snap,
					results: snap
				}
			});

			// Attempt change without confirmation
			const rejected = setTarget('sepal_length');
			expect(rejected).toBe(false);
			expect($appState.get().target).toBe('species');
			expect($appState.get().models.length).toBe(1);

			// Confirm discard of models
			confirmDiscardModels();
			expect($appState.get().models).toEqual([]);
			expect($appState.get().nextModelNum).toBe(1);
			expect($appState.get().target).toBe('species');

			const snapshots = $scrollState.get().snapshots;
			expect(snapshots['target']).toBeDefined();
			expect(snapshots['models']).toBeUndefined();
			expect(snapshots['models/1']).toBeUndefined();
			expect(snapshots['models/2']).toBeUndefined();
			expect(snapshots['results']).toBeUndefined();

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

			// Cannot start training before completing sections 1–3 and choosing setup
			expect(startTraining(1)).toBe(false);

			completeSection(1, 'choose-model');
			setFeatures(1, ['sepal_length']);
			completeSection(1, 'select-features');

			// Sections 1-2 complete, but configure-model not complete and no setup
			expect(startTraining(1)).toBe(false);

			completeSection(1, 'configure-model');
			// Sections 1-3 complete, but trainingSetup is still null
			expect(startTraining(1)).toBe(false);

			// Set training setup
			setTrainingSetup(1, { type: 'k_fold_cv', folds: 5 });

			// Now training can start and completes configure-training per D8
			expect(startTraining(1)).toBe(true);
			expect($appState.get().models[0]?.status).toBe('training');
			expect($appState.get().models[0]?.progress?.percent).toBe(0);
			expect($appState.get().models[0]?.completedSteps).toContain('configure-training');

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

		it('handles training failure, cancellation, and reload interruption transitions', () => {
			loadDatasetSucceeded(sampleDataset);
			setTarget('species');
			createModel();
			completeSection(1, 'choose-model');
			setFeatures(1, ['sepal_length']);
			completeSection(1, 'select-features');
			completeSection(1, 'configure-model');
			setTrainingSetup(1, { type: 'k_fold_cv', folds: 5 });

			// 1. Training failed re-opens configure-training
			startTraining(1);
			expect($appState.get().models[0]?.completedSteps).toContain('configure-training');
			trainingFailed(1, 'Matrix not positive definite');
			let m = $appState.get().models[0];
			expect(m?.status).toBe('draft');
			expect(m?.error?.code).toBe('TRAINING_FAILED');
			expect(m?.error?.message).toBe('Matrix not positive definite');
			expect(m?.completedSteps).not.toContain('configure-training');
			expect(m?.completedSteps).not.toContain('training');
			expect(m?.completedSteps).not.toContain('results');

			// 2. Cancellation re-opens configure-training
			startTraining(1);
			expect($appState.get().models[0]?.completedSteps).toContain('configure-training');
			cancelTraining(1);
			m = $appState.get().models[0];
			expect(m?.status).toBe('draft');
			expect(m?.error?.code).toBe('TRAINING_CANCELLED');
			expect(m?.completedSteps).not.toContain('configure-training');
			expect(m?.completedSteps).not.toContain('training');
			expect(m?.completedSteps).not.toContain('results');

			// 3. Reload interruption re-opens configure-training
			startTraining(1);
			expect($appState.get().models[0]?.completedSteps).toContain('configure-training');
			recoverInterrupted(1);
			m = $appState.get().models[0];
			expect(m?.status).toBe('draft');
			expect(m?.error?.code).toBe('TRAINING_INTERRUPTED_BY_RELOAD');
			expect(m?.completedSteps).not.toContain('configure-training');
			expect(m?.completedSteps).not.toContain('training');
			expect(m?.completedSteps).not.toContain('results');
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

		it('setFeatures with same set in different order returns true without changing state reference', () => {
			loadDatasetSucceeded(sampleDataset);
			setTarget('species');
			createModel();
			setFeatures(1, ['sepal_length', 'sepal_width']);

			const stateRefBefore = $appState.get();
			const result = setFeatures(1, ['sepal_width', 'sepal_length']);
			expect(result).toBe(true);
			expect($appState.get()).toBe(stateRefBefore);
		});

		it('changed setHyperparameters on model with sections 1-4 complete leaves sections 1-3 complete', () => {
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

			setHyperparameters(1, { mode: 'manual', values: { C: 5.0 } });
			expect($appState.get().models[0]?.completedSteps).toEqual([
				'choose-model',
				'select-features',
				'configure-model'
			]);
		});

		it('chooseModel with different model resets options, hyperparameters and multiclass, and keeps features', () => {
			loadDatasetSucceeded(sampleDataset);
			setTarget('species');
			createModel();
			chooseModel(1, 'logreg');
			setFeatures(1, ['sepal_length', 'sepal_width']);
			setModelOptions(1, { penalty: 'l2' });
			setHyperparameters(1, { mode: 'manual', values: { C: 1.0 } });
			setMulticlassStrategy(1, 'one-vs-rest');

			chooseModel(1, 'knn');
			const m = $appState.get().models[0]!;
			expect(m.modelId).toBe('knn');
			expect(m.features).toEqual(['sepal_length', 'sepal_width']);
			expect(m.modelOptions).toEqual({});
			expect(m.hyperparameters).toEqual({ mode: 'manual', values: {} });
			expect(m.multiclass).toBeNull();
		});
	});

	describe('SNC-6: validation in setFeatures and setSelectedColumn', () => {
		it('rejects invalid column selections in setFeatures without mutation', () => {
			const datasetWithDate: DatasetSummary = {
				...sampleDataset,
				columns: [
					...sampleDataset.columns,
					{ name: 'created_at', type: 'datetime', missingCount: 0 }
				]
			};
			loadDatasetSucceeded(datasetWithDate);
			setTarget('species');
			createModel();
			setFeatures(1, ['sepal_length']);

			const stateBefore = $appState.get();

			// 1. Unknown column
			expect(setFeatures(1, ['unknown_col'])).toBe(false);
			expect($appState.get()).toBe(stateBefore);

			// 2. Text column (notes)
			expect(setFeatures(1, ['notes'])).toBe(false);
			expect($appState.get()).toBe(stateBefore);

			// 3. Datetime column (created_at)
			expect(setFeatures(1, ['created_at'])).toBe(false);
			expect($appState.get()).toBe(stateBefore);

			// 4. Target column (species)
			expect(setFeatures(1, ['species'])).toBe(false);
			expect($appState.get()).toBe(stateBefore);

			// 5. Duplicate column
			expect(setFeatures(1, ['sepal_length', 'sepal_length'])).toBe(false);
			expect($appState.get()).toBe(stateBefore);
		});

		it('setSelectedColumn rejects non-existent column name with false', () => {
			loadDatasetSucceeded(sampleDataset);
			expect(setSelectedColumn('nope')).toBe(false);
			expect($appState.get().data.selectedColumn).toBeNull();
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
			expect(recoveredModel?.completedSteps).not.toContain('configure-training');
			expect(recoveredModel?.completedSteps).not.toContain('training');
			expect(recoveredModel?.completedSteps).not.toContain('results');
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

		it('cleanly recovers to defaults when version is older than supported', async () => {
			const storage = new MemoryStorage();
			storage.setItem(
				STATE_STORAGE_KEY,
				JSON.stringify({ ...INITIAL_APP_STATE, version: 0 })
			);

			const reconciled = await reconcileStartupState(storage, mockIdb);
			expect(reconciled.version).toBe(STORAGE_VERSION);
			expect(reconciled.dataset).toBeNull();
		});

		it('cleanly recovers to defaults and enters read-only mode when version is newer than supported', async () => {
			const storage = new MemoryStorage();
			const newerBlob = JSON.stringify({ ...INITIAL_APP_STATE, version: 999 });
			storage.setItem(STATE_STORAGE_KEY, newerBlob);

			const reconciled = await reconcileStartupState(storage, mockIdb);
			expect(reconciled.version).toBe(STORAGE_VERSION);
			expect(reconciled.dataset).toBeNull();
			expect(storage.getItem(STATE_STORAGE_KEY)).toBe(newerBlob);

			initPersister(storage);
			dismissWelcome();
			flushNow();
			expect(storage.getItem(STATE_STORAGE_KEY)).toBe(newerBlob);
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

	describe('SNC-1: full defaults on single invalid field', () => {
		const mockIdb: IndexedDBAdapter = {
			async hasMetadata() {
				return true;
			},
			async deleteOrphanDatasets() {},
			async hasModelResults() {
				return true;
			}
		};

		it('yields full defaults when resumePath is not a workflow route', async () => {
			const storage = new MemoryStorage();
			storage.setItem(
				STATE_STORAGE_KEY,
				JSON.stringify({ ...INITIAL_APP_STATE, resumePath: '/about' })
			);
			const reconciled = await reconcileStartupState(storage, mockIdb);
			expect(reconciled).toEqual(INITIAL_APP_STATE);
		});

		it('yields full defaults when a model has invalid status', async () => {
			const storage = new MemoryStorage();
			const invalidModel = {
				num: 1,
				createdAt: Date.now(),
				status: 'done',
				completedSteps: [],
				modelId: null,
				features: [],
				modelOptions: {},
				hyperparameters: { mode: 'manual', values: {} },
				multiclass: null,
				trainingSetup: null,
				progress: null,
				error: null,
				timings: null,
				durationMs: null,
				metrics: null,
				ui: {}
			};
			storage.setItem(
				STATE_STORAGE_KEY,
				JSON.stringify({ ...INITIAL_APP_STATE, models: [invalidModel] })
			);
			const reconciled = await reconcileStartupState(storage, mockIdb);
			expect(reconciled).toEqual(INITIAL_APP_STATE);
		});

		it('yields full defaults when a column has invalid type', async () => {
			const storage = new MemoryStorage();
			const invalidDataset = {
				...sampleDataset,
				columns: [{ name: 'col1', type: 'date', missingCount: 0 }]
			};
			storage.setItem(
				STATE_STORAGE_KEY,
				JSON.stringify({ ...INITIAL_APP_STATE, dataset: invalidDataset })
			);
			const reconciled = await reconcileStartupState(storage, mockIdb);
			expect(reconciled).toEqual(INITIAL_APP_STATE);
		});

		it('yields full defaults when nextModelNum is 0', async () => {
			const storage = new MemoryStorage();
			storage.setItem(
				STATE_STORAGE_KEY,
				JSON.stringify({ ...INITIAL_APP_STATE, nextModelNum: 0 })
			);
			const reconciled = await reconcileStartupState(storage, mockIdb);
			expect(reconciled).toEqual(INITIAL_APP_STATE);
		});
	});

	describe('SNC-2: reconciler performs no setItem other than through the persister', () => {
		it('calls setItem only through persister methods during reconcileStartupState', async () => {
			const calls: { method: string; key: string }[] = [];
			const recordingStorage: StorageAdapter = {
				getItem(key: string) {
					calls.push({ method: 'getItem', key });
					return null;
				},
				setItem(key: string, value: string) {
					calls.push({ method: 'setItem', key });
				},
				removeItem(key: string) {
					calls.push({ method: 'removeItem', key });
				}
			};

			const mockIdb: IndexedDBAdapter = {
				async hasMetadata() {
					return true;
				},
				async deleteOrphanDatasets() {},
				async hasModelResults() {
					return true;
				}
			};

			await reconcileStartupState(recordingStorage, mockIdb);
			const setCalls = calls.filter((c) => c.method === 'setItem');
			expect(setCalls).toEqual([
				{ method: 'setItem', key: STATE_STORAGE_KEY },
				{ method: 'setItem', key: 'samata-ml:scroll' }
			]);
		});
	});

	describe('SNC-3: discrete selections are synchronous', () => {
		it('synchronously persists toggleFeature, setMulticlassStrategy, hyperparameter mode change, and trainingSetup type change', () => {
			const storage = new MemoryStorage();
			initPersister(storage, { debounceFieldMs: 10_000 });

			loadDatasetSucceeded(sampleDataset);
			setTarget('species');
			createModel();

			// 1. toggleFeature
			toggleFeature(1, 'sepal_length');
			let stored = JSON.parse(storage.getItem(STATE_STORAGE_KEY)!);
			expect(stored.models[0].features).toEqual(['sepal_length']);

			// 2. setMulticlassStrategy
			setMulticlassStrategy(1, 'one-vs-rest');
			stored = JSON.parse(storage.getItem(STATE_STORAGE_KEY)!);
			expect(stored.models[0].multiclass).toBe('one-vs-rest');

			// 3. setHyperparameters that changes mode
			setHyperparameters(1, { mode: 'tuning', values: {} });
			stored = JSON.parse(storage.getItem(STATE_STORAGE_KEY)!);
			expect(stored.models[0].hyperparameters.mode).toBe('tuning');

			// 4. setTrainingSetup that changes type
			setTrainingSetup(1, { type: 'k_fold_cv', folds: 5 });
			stored = JSON.parse(storage.getItem(STATE_STORAGE_KEY)!);
			expect(stored.models[0].trainingSetup.type).toBe('k_fold_cv');
		});
	});

	describe('SNC-4: hyperparameters changing only values is debounced', () => {
		it('does not write before debounce and writes after debounce', async () => {
			const storage = new MemoryStorage();
			initPersister(storage, { debounceFieldMs: 50 });

			loadDatasetSucceeded(sampleDataset);
			setTarget('species');
			createModel();
			flushNow();

			const beforeCall = JSON.parse(storage.getItem(STATE_STORAGE_KEY)!);
			expect(beforeCall.models[0].hyperparameters.values).toEqual({});

			// Change only values, mode remains manual
			setHyperparameters(1, { mode: 'manual', values: { C: 0.5 } });

			// Immediately after call: not yet written
			const immediately = JSON.parse(storage.getItem(STATE_STORAGE_KEY)!);
			expect(immediately.models[0].hyperparameters.values).toEqual({});

			// After debounce
			await new Promise((resolve) => setTimeout(resolve, 80));
			const afterDebounce = JSON.parse(storage.getItem(STATE_STORAGE_KEY)!);
			expect(afterDebounce.models[0].hyperparameters.values).toEqual({ C: 0.5 });
		});
	});

	describe('SNC-5: training progress is throttled', () => {
		it('throttles progress updates and stores the final tick', async () => {
			const storage = new MemoryStorage();
			initPersister(storage, { throttleProgressMs: 50, debounceFieldMs: 10_000 });

			loadDatasetSucceeded(sampleDataset);
			setTarget('species');
			createModel();
			chooseModel(1, 'logreg');
			setFeatures(1, ['sepal_length', 'sepal_width']);
			completeSection(1, 'choose-model');
			completeSection(1, 'select-features');
			completeSection(1, 'configure-model');
			setTrainingSetup(1, { type: 'k_fold_cv', folds: 5 });
			startTraining(1);
			flushNow();

			// 10 calls 10 ms apart
			for (let i = 1; i <= 10; i++) {
				updateTrainingProgress(1, { percent: i * 10, statusMessage: `Step ${i}` });
				if (i === 5) {
					// After 5 calls (approx 50ms): wait to verify first write produced within 60ms
					await new Promise((resolve) => setTimeout(resolve, 20));
					const midState = JSON.parse(storage.getItem(STATE_STORAGE_KEY)!);
					expect(midState.models[0].progress.percent).toBeGreaterThanOrEqual(10);
				} else {
					await new Promise((resolve) => setTimeout(resolve, 10));
				}
			}

			// Wait up to 50ms after final call
			await new Promise((resolve) => setTimeout(resolve, 60));
			const finalState = JSON.parse(storage.getItem(STATE_STORAGE_KEY)!);
			expect(finalState.models[0].progress.percent).toBe(100);
			expect(finalState.models[0].progress.statusMessage).toBe('Step 10');
		});
	});

	describe('MOD-FEAT-2: initialiseFeatureSelection atomic and idempotent', () => {
		it('sets features and ui.featureSelectionInitialised atomically, and is idempotent', () => {
			loadDatasetSucceeded(sampleDataset);
			setTarget('species');
			createModel();

			const beforeModel = $appState.get().models[0]!;
			expect(beforeModel.ui.featureSelectionInitialised).toBeUndefined();
			expect(beforeModel.features).toEqual([]);

			// Initialise features
			const res1 = initialiseFeatureSelection(1, ['sepal_length', 'sepal_width']);
			expect(res1).toBe(true);

			const modelAfterFirst = $appState.get().models[0]!;
			expect(modelAfterFirst.ui.featureSelectionInitialised).toBe(true);
			expect(modelAfterFirst.features).toEqual(['sepal_length', 'sepal_width']);

			// Calling initialiseFeatureSelection again returns true without mutating even if new names provided
			const res2 = initialiseFeatureSelection(1, ['petal_length']);
			expect(res2).toBe(true);
			const modelAfterSecond = $appState.get().models[0]!;
			expect(modelAfterSecond.features).toEqual(['sepal_length', 'sepal_width']);

			// Deliberately empty feature selection survives reload / reopen and is not overwritten
			setFeatures(1, []);
			expect($appState.get().models[0]!.features).toEqual([]);
			const res3 = initialiseFeatureSelection(1, ['sepal_length']);
			expect(res3).toBe(true);
			expect($appState.get().models[0]!.features).toEqual([]);

			// Invalid inputs do not mutate state and return false
			expect(initialiseFeatureSelection(999, ['sepal_length'])).toBe(false);
			expect(initialiseFeatureSelection(1, ['non_existent_column'])).toBe(false);
			expect(initialiseFeatureSelection(1, ['species'])).toBe(false); // target column rejected
			expect(initialiseFeatureSelection(1, ['sepal_length', 'sepal_length'])).toBe(false); // duplicates rejected
		});
	});
});
