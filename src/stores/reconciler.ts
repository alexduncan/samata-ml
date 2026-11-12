import { openDB } from 'idb';
import {
	INITIAL_APP_STATE,
	SCROLL_STORAGE_KEY,
	STATE_STORAGE_KEY,
	STORAGE_VERSION,
	type ModelRecord,
	type ModelSectionId,
	type PersistedAppState,
	type ScrollSnapshot
} from '../types/state';
import { $appState } from './app.store';
import { getActiveStorage, type StorageAdapter } from './persister';
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
	const DB_NAME = 'samata-db';
	const DB_VERSION = 1;

	async function getDB() {
		return openDB(DB_NAME, DB_VERSION, {
			upgrade(db) {
				if (!db.objectStoreNames.contains('metadata')) {
					db.createObjectStore('metadata');
				}
				if (!db.objectStoreNames.contains('raw_records')) {
					db.createObjectStore('raw_records');
				}
				if (!db.objectStoreNames.contains('model_results')) {
					db.createObjectStore('model_results');
				}
			}
		});
	}

	return {
		async hasMetadata(datasetId: string): Promise<boolean> {
			if (typeof indexedDB === 'undefined') return true;
			try {
				const db = await getDB();
				const record = await db.get('metadata', datasetId);
				return record !== undefined;
			} catch {
				return false;
			}
		},

		async deleteOrphanDatasets(activeDatasetId: string | null): Promise<void> {
			if (typeof indexedDB === 'undefined') return;
			try {
				const db = await getDB();
				const metaKeys = await db.getAllKeys('metadata');
				for (const key of metaKeys) {
					if (key !== activeDatasetId) {
						await db.delete('metadata', key);
					}
				}
				const rawKeys = await db.getAllKeys('raw_records');
				for (const key of rawKeys) {
					if (typeof key === 'string' && key !== activeDatasetId) {
						await db.delete('raw_records', key);
					}
				}
			} catch {
				// Non-fatal cleanup failure
			}
		},

		async hasModelResults(datasetId: string, modelNum: number): Promise<boolean> {
			if (typeof indexedDB === 'undefined') return true;
			try {
				const db = await getDB();
				const key = `${datasetId}:${modelNum}`;
				const res =
					(await db.get('model_results', key)) ??
					(await db.get('model_results', [datasetId, modelNum]));
				return res !== undefined;
			} catch {
				return false;
			}
		}
	};
}

/**
 * Validates and parses raw JSON from storage into a PersistedAppState, falling back to defaults on corruption.
 */
function parseAppState(raw: string | null): PersistedAppState {
	if (!raw) return { ...INITIAL_APP_STATE };
	try {
		const parsed = JSON.parse(raw);
		if (
			!parsed ||
			typeof parsed !== 'object' ||
			parsed.version !== STORAGE_VERSION ||
			typeof parsed.nextModelNum !== 'number' ||
			!Array.isArray(parsed.models) ||
			!parsed.data ||
			!parsed.onboarding
		) {
			return { ...INITIAL_APP_STATE };
		}
		return parsed as PersistedAppState;
	} catch {
		return { ...INITIAL_APP_STATE };
	}
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
	// Parse initial state from storage
	let state = parseAppState(storage.getItem(STATE_STORAGE_KEY));

	// Load scroll state from storage if present
	const scrollRaw = storage.getItem(SCROLL_STORAGE_KEY);
	if (scrollRaw) {
		try {
			const parsedScroll = JSON.parse(scrollRaw);
			if (
				parsedScroll &&
				parsedScroll.version === STORAGE_VERSION &&
				parsedScroll.snapshots &&
				typeof parsedScroll.snapshots === 'object'
			) {
				$scrollState.set(parsedScroll);
			}
		} catch {
			// Ignore corrupted scroll data
		}
	}

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
			try {
				storage.setItem(SCROLL_STORAGE_KEY, JSON.stringify($scrollState.get()));
			} catch {
				// Ignore quota error on scroll write
			}
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

	// 3. Target valid: ensure target column exists in dataset.columns and is not 'text'
	if (state.target !== null) {
		if (!state.dataset) {
			state = {
				...state,
				target: null,
				models: []
			};
		} else {
			const targetCol = state.dataset.columns.find((c) => c.name === state.target);
			if (!targetCol || targetCol.type === 'text') {
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
				.filter((c) => c.name !== state.target && c.type !== 'text')
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
					(s) => s !== 'training' && s !== 'results'
				)
			});
		} else {
			modelsWithTrainingRecovery.push(model);
		}
	}
	state = { ...state, models: modelsWithTrainingRecovery };

	// 8. Persist the repaired state immediately
	$appState.set(state);
	try {
		storage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
	} catch (err) {
		console.error('Failed to persist reconciled startup state:', err);
	}

	return state;
}
