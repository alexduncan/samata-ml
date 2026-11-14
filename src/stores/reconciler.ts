import {
	INGESTION_LOCK,
	deleteDatasetsExcept,
	hasModelResults as hasStoredModelResults,
	openSamataDb,
	getMetadata
} from '../common/storage/db';
import {
	INITIAL_APP_STATE,
	isModelEligibleColumnType,
	type ModelRecord,
	type ModelSectionId,
	type PersistedAppState,
	type ScrollSnapshot
} from '../types/state';
import { $appState } from './app.store';
import { getActiveStorage, persistNow, readPersistedState, type StorageAdapter } from './persister';
import { $scrollState } from './scroll.store';

/**
 * Adapter interface for IndexedDB queries and cleanup during reconciliation.
 */
export interface IndexedDBAdapter {
	/** Checks whether dataset metadata exists in the IndexedDB 'metadata' store. */
	hasMetadata(datasetId: string): Promise<boolean>;
	/** Removes stored dataset rows and metadata for dataset IDs other than the active dataset. */
	deleteOrphanDatasets(activeDatasetId: string | null): Promise<void>;
	/** Checks whether trained model results exist in the IndexedDB 'model_results' store. */
	hasModelResults(datasetId: string, modelNum: number): Promise<boolean>;
}

/**
 * Creates a default IndexedDBAdapter connecting to the application's 'samata-db' database.
 */
export function createDefaultIndexedDBAdapter(): IndexedDBAdapter {
	return {
		async hasMetadata(datasetId: string): Promise<boolean> {
			if (typeof indexedDB === 'undefined') return true;
			const db = await openSamataDb();
			try {
				return (await getMetadata(db, datasetId)) !== undefined;
			} finally {
				db.close();
			}
		},

		async deleteOrphanDatasets(activeDatasetId: string | null): Promise<void> {
			if (typeof indexedDB === 'undefined') return;
			const clean = async () => {
				const db = await openSamataDb();
				try {
					await deleteDatasetsExcept(db, activeDatasetId);
				} finally {
					db.close();
				}
			};
			const lockManager = typeof navigator === 'undefined' ? undefined : navigator.locks;
			if (lockManager && typeof lockManager.request === 'function') {
				await lockManager.request(INGESTION_LOCK, { ifAvailable: true }, async (lock) => {
					if (lock) await clean();
				});
			} else {
				await clean();
			}
		},

		async hasModelResults(datasetId: string, modelNum: number): Promise<boolean> {
			if (typeof indexedDB === 'undefined') return true;
			const db = await openSamataDb();
			try {
				return await hasStoredModelResults(db, datasetId, modelNum);
			} finally {
				db.close();
			}
		}
	};
}

/**
 * Reconciles startup state across localStorage and IndexedDB before initial render.
 * Executes checks 1–7 per specification/state-and-storage.md §6 and immediately persists repaired state.
 *
 * @param storage - StorageAdapter instance (defaults to currently active persister storage).
 * @param idb - IndexedDBAdapter instance (defaults to browser IndexedDB if available).
 * @returns Reconciled and persisted application state.
 */
export async function reconcileStartupState(
	storage: StorageAdapter = getActiveStorage(),
	idb?: IndexedDBAdapter
): Promise<PersistedAppState> {
	// Parse initial state and scroll snapshots from persister
	const persisted = readPersistedState(storage);
	let state = persisted.state;
	$scrollState.set(persisted.scroll);

	// 1. Dataset present: check IDB metadata; if missing, reset dataset and downstream state
	if (state.dataset !== null && idb) {
		let metaExists = false;
		try {
			metaExists = await idb.hasMetadata(state.dataset.id);
		} catch {
			metaExists = false;
		}

		if (!metaExists) {
			state = {
				...state,
				dataset: null,
				target: null,
				models: [],
				data: {
					mode: 'select',
					selectedColumn: null
				}
			};

			// Clear non-/data scroll keys
			const currentScroll = $scrollState.get();
			const filteredSnapshots: Record<string, ScrollSnapshot> = {};
			for (const [key, snap] of Object.entries(currentScroll.snapshots)) {
				if (key.startsWith('data:')) {
					filteredSnapshots[key] = snap;
				}
			}
			$scrollState.set({
				...currentScroll,
				snapshots: filteredSnapshots
			});
		}
	}

	// 2. Orphans: delete IndexedDB records for other dataset IDs
	if (idb) {
		try {
			await idb.deleteOrphanDatasets(state.dataset ? state.dataset.id : null);
		} catch (err) {
			console.warn('Failed to clean orphan datasets from IndexedDB:', err);
		}
	}

	// 3. Target valid: ensure target column exists in dataset.columns and is model-eligible
	if (state.target !== null) {
		if (!state.dataset) {
			state = {
				...state,
				target: null,
				models: []
			};
		} else {
			const targetCol = state.dataset.columns.find((c) => c.name === state.target);
			if (!targetCol || !isModelEligibleColumnType(targetCol.type)) {
				state = {
					...state,
					target: null,
					models: []
				};
			}
		}
	}

	// 4. Models valid: ensure features exist in dataset; revert trained models with missing results
	if (state.dataset === null || state.target === null) {
		if (state.models.length > 0) {
			state = { ...state, models: [] };
		}
	} else {
		const eligibleColumns = new Set(
			state.dataset.columns
				.filter((c) => c.name !== state.target && isModelEligibleColumnType(c.type))
				.map((c) => c.name)
		);

		const updatedModels: ModelRecord[] = [];
		for (const model of state.models) {
			let droppedAnyFeature = false;
			const validFeatures: string[] = [];

			for (const f of model.features) {
				if (eligibleColumns.has(f)) {
					validFeatures.push(f);
				} else {
					droppedAnyFeature = true;
				}
			}

			let completedSteps = [...model.completedSteps];
			if (droppedAnyFeature) {
				const downstreamSteps: ModelSectionId[] = [
					'select-features',
					'configure-model',
					'configure-training',
					'training',
					'results'
				];
				completedSteps = completedSteps.filter((s) => !downstreamSteps.includes(s));
			}

			let status = model.status;
			let error = model.error;
			let progress = model.progress;
			let metrics = model.metrics;

			if (status === 'trained' && idb) {
				let hasResults = false;
				try {
					hasResults = await idb.hasModelResults(state.dataset.id, model.num);
				} catch {
					hasResults = false;
				}

				if (!hasResults) {
					status = 'draft';
					progress = null;
					metrics = null;
					error = {
						code: 'TRAINING_FAILED',
						message: 'Stored model results were lost',
						timestamp: Date.now()
					};
					completedSteps = completedSteps.filter(
						(s) => s !== 'training' && s !== 'results'
					);
				}
			}

			updatedModels.push({
				...model,
				features: validFeatures,
				completedSteps,
				status,
				error,
				progress,
				metrics
			});
		}
		state = { ...state, models: updatedModels };
	}

	// 5. Counters: ensure monotonic nextModelNum
	let maxModelNum = 0;
	for (const m of state.models) {
		if (m.num > maxModelNum) {
			maxModelNum = m.num;
		}
	}
	const nextModelNum = Math.max(state.nextModelNum ?? 1, maxModelNum + 1, 1);
	state = { ...state, nextModelNum };

	// 6. Selections valid: verify selectedColumn and resumePath
	if (state.data.selectedColumn !== null) {
		const colExists =
			state.dataset !== null &&
			state.dataset.columns.some((c) => c.name === state.data.selectedColumn);
		if (!colExists) {
			state = {
				...state,
				data: {
					...state.data,
					selectedColumn: null
				}
			};
		}
	}

	// 7. Interrupted training: request Web Lock samata-ml:training:{num} with { ifAvailable: true }
	const modelsWithTrainingRecovery: ModelRecord[] = [];
	for (const model of state.models) {
		if (model.status !== 'training') {
			modelsWithTrainingRecovery.push(model);
			continue;
		}

		let isAnotherTabTraining = false;

		if (
			typeof navigator !== 'undefined' &&
			navigator.locks &&
			typeof navigator.locks.request === 'function'
		) {
			try {
				await navigator.locks.request(
					`samata-ml:training:${model.num}`,
					{ ifAvailable: true },
					async (lock) => {
						if (!lock) {
							// Lock was already held by another tab
							isAnotherTabTraining = true;
						}
					}
				);
			} catch {
				isAnotherTabTraining = false;
			}
		} else {
			// Web Locks API missing -> treat as interrupted
			isAnotherTabTraining = false;
		}

		if (!isAnotherTabTraining) {
			modelsWithTrainingRecovery.push({
				...model,
				status: 'draft',
				progress: null,
				error: {
					code: 'TRAINING_INTERRUPTED_BY_RELOAD',
					message: 'Training was interrupted by a page reload',
					timestamp: Date.now()
				},
				completedSteps: model.completedSteps.filter(
					(s) => s !== 'configure-training' && s !== 'training' && s !== 'results'
				)
			});
		} else {
			modelsWithTrainingRecovery.push(model);
		}
	}
	state = { ...state, models: modelsWithTrainingRecovery };

	// 8. Persist the repaired state immediately
	$appState.set(state);
	persistNow(storage);

	return state;
}
