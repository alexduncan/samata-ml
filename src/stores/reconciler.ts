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
import { isClassifierId } from '../features/models/model-catalogue';
import { getTrainingConfigurationKey } from '../features/models/training/training-service';
import { readModelResult } from '../features/models/training/result-repository';
import type { ResultEnvelope } from '../types/model-result';
import { $appState, reduceDatasetReplacement } from './app.store';
import {
	commitProtectedTrainingChange,
	getActiveStorage,
	persistNow,
	publishAcknowledgedAppSnapshot,
	readGuardedTrainingSnapshot,
	readPersistedState,
	withTrainingStateLock,
	type PersistenceAck,
	type StorageAdapter,
	type TrainingPersistenceOptions
} from './persister';
import { createTrainingSession, setTrainingSessionStatus } from './training.store';
import { $scrollState } from './scroll.store';

function isTrainingSetupOrLater(step: ModelSectionId): boolean {
	return step === 'configure-training' || step === 'training' || step === 'results';
}

function protectedDomain(state: PersistedAppState) {
	const { dataset, data, target, models, nextModelNum } = state;
	return { dataset, data, target, models, nextModelNum };
}

function restoreModelDomain(
	state: PersistedAppState,
	model: ModelRecord,
	badSetup: boolean,
	envelope: ResultEnvelope | null
): ModelRecord {
	const columns = state.dataset?.columns ?? [];
	const features = model.features.filter(
		(feature) =>
			feature !== state.target &&
			columns.some(
				(column) => column.name === feature && isModelEligibleColumnType(column.type)
			)
	);
	const available = model.modelId === null || isClassifierId(model.modelId);
	const changedFeatures = features.length !== model.features.length;
	const completedSteps = !available
		? []
		: changedFeatures
			? model.completedSteps.filter((section) => section === 'choose-model')
			: model.completedSteps;
	const repaired: ModelRecord = {
		...model,
		features,
		completedSteps,
		...(!available && {
			modelId: null,
			multiclass: null,
			hyperparameters: { mode: 'manual', values: {} }
		})
	};
	if (model.status !== 'draft') {
		if (envelope && !badSetup && available && !changedFeatures) {
			return {
				...repaired,
				status: 'trained',
				progress: null,
				error: null,
				metrics: null,
				timings: null,
				durationMs: envelope.durationMs,
				completedSteps: completedSteps.includes('training')
					? completedSteps
					: [...completedSteps, 'training']
			};
		}
		const interrupted = model.status === 'training';
		return {
			...repaired,
			status: 'draft',
			trainingSetup: badSetup ? null : model.trainingSetup,
			progress: null,
			resultRevision: null,
			timings: null,
			metrics: null,
			durationMs: null,
			completedSteps: completedSteps.filter((section) => !isTrainingSetupOrLater(section)),
			error: {
				code: interrupted ? 'TRAINING_INTERRUPTED_BY_RELOAD' : 'TRAINING_FAILED',
				message: interrupted
					? 'Training was interrupted by a page reload'
					: 'Stored model results were lost',
				timestamp: Date.now()
			}
		};
	}
	if (!badSetup) return repaired;
	return {
		...repaired,
		trainingSetup: null,
		completedSteps: completedSteps.filter((section) => !isTrainingSetupOrLater(section)),
		progress: null,
		resultRevision: null,
		timings: null,
		metrics: null,
		durationMs: null
	};
}

/** Replays committed state first, then repairs validated resources under their locks. */
export async function reconcileProtectedStartup(
	options: TrainingPersistenceOptions = {},
	locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
): Promise<PersistenceAck> {
	if (!locks) return { ok: false, reason: 'unavailable' };
	const persistence = {
		...options,
		withStateLock:
			options.withStateLock ??
			(<Value>(operation: () => Promise<Value>) =>
				locks.request('samata-ml:training-state', operation))
	};
	const first = await withTrainingStateLock(readGuardedTrainingSnapshot, persistence);
	if (!first.ok) return first;
	const priorScroll = readPersistedState(options.storage).scroll;
	$scrollState.set(priorScroll);

	function recovery(state: PersistedAppState) {
		return {
			pending: {
				operationId: crypto.randomUUID(),
				kind: 'recover' as const,
				domain: protectedDomain(state)
			},
			mutation: { type: 'none' as const }
		};
	}

	try {
		const repaired = await locks.request(
			INGESTION_LOCK,
			{ mode: 'shared' },
			async (): Promise<PersistenceAck> => {
				let modelNumbers: number[] = [];
				let datasetId: string | null = null;
				const dataset = await commitProtectedTrainingChange(async ({ state }, { db }) => {
					if (!state) return recovery(INITIAL_APP_STATE);
					if (state.dataset && !(await getMetadata(db, state.dataset.id))) {
						return recovery(reduceDatasetReplacement(state, null));
					}
					datasetId = state.dataset?.id ?? null;
					const validTarget =
						state.target !== null &&
						state.dataset?.columns.some(
							(column) =>
								column.name === state.target &&
								isModelEligibleColumnType(column.type)
						);
					const nextModelNum = Math.max(
						state.nextModelNum,
						1,
						...state.models.map((model) => model.num + 1)
					);
					const selectedColumn =
						state.data.selectedColumn !== null &&
						state.dataset?.columns.some(
							(column) => column.name === state.data.selectedColumn
						)
							? state.data.selectedColumn
							: null;
					modelNumbers = validTarget ? state.models.map((model) => model.num) : [];
					if (
						(!validTarget && (state.target !== null || state.models.length > 0)) ||
						nextModelNum !== state.nextModelNum ||
						selectedColumn !== state.data.selectedColumn
					) {
						return recovery({
							...state,
							nextModelNum,
							data: { ...state.data, selectedColumn },
							...(!validTarget && { target: null, models: [] })
						});
					}
					return null;
				}, persistence);
				if (!dataset.ok) return dataset;

				for (const num of modelNumbers) {
					const model = await locks.request(
						`samata-ml:training:${num}`,
						{ ifAvailable: true },
						async (lock): Promise<PersistenceAck> => {
							if (!lock) return dataset;
							const restored: { result: ResultEnvelope | null } = { result: null };
							const repairedModel = await commitProtectedTrainingChange(
								async ({ state, trainingSetupDecodeOutcomes }, { db }) => {
									if (!state || state.dataset?.id !== datasetId) return null;
									const index = state.models.findIndex(
										(candidate) => candidate.num === num
									);
									const current = state.models[index];
									if (!current) return null;
									const detail = trainingSetupDecodeOutcomes[index];
									const badSetup =
										detail === 'unusable' ||
										(detail === 'explicit-null' &&
											current.completedSteps.some(isTrainingSetupOrLater));
									if (
										current.status !== 'draft' &&
										current.resultRevision !== null
									) {
										const configurationKey = getTrainingConfigurationKey(
											current,
											state.dataset!.rowCount
										);
										if (state.target && configurationKey) {
											restored.result = await readModelResult(
												db,
												datasetId!,
												num,
												{
													datasetId: datasetId!,
													target: state.target,
													modelNum: num,
													modelCreatedAt: current.createdAt,
													configurationKey,
													runId: current.resultRevision
												}
											);
										}
									}
									const next = restoreModelDomain(
										state,
										current,
										badSetup,
										restored.result
									);
									if (next.status !== 'trained') restored.result = null;
									if (JSON.stringify(next) === JSON.stringify(current))
										return null;
									return recovery({
										...state,
										models: state.models.map((entry) =>
											entry === current ? next : entry
										)
									});
								},
								persistence
							);
							if (repairedModel.ok && restored.result) {
								const saved = restored.result;
								createTrainingSession(saved);
								setTrainingSessionStatus(saved, 'complete', saved.logEntries);
							}
							return repairedModel;
						}
					);
					if (!model.ok) return model;
				}
				return withTrainingStateLock(async (context): Promise<PersistenceAck> => {
					const authoritative = await readGuardedTrainingSnapshot(context);
					if (!authoritative.ok) return authoritative;
					if (!authoritative.state) return { ok: false, reason: 'conflict' };
					publishAcknowledgedAppSnapshot(authoritative.state);
					return { ok: true, generation: authoritative.generation };
				}, persistence);
			}
		);
		if (!repaired.ok) return repaired;

		await locks.request(
			INGESTION_LOCK,
			{ ifAvailable: true, mode: 'exclusive' },
			async (lock) => {
				if (!lock) return;
				await withTrainingStateLock(async (context) => {
					const read = await readGuardedTrainingSnapshot(context);
					if (read.ok && read.state && !read.replayed) {
						await deleteDatasetsExcept(context.db, read.state.dataset?.id ?? null);
					}
				}, persistence);
			}
		);
		return repaired;
	} catch {
		return { ok: false, reason: 'unavailable' };
	}
}

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
	const trainingSetupRepairs: boolean[] = [];
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
		for (const [index, persistedModel] of state.models.entries()) {
			const outcome = persisted.trainingSetupDecodeOutcomes[index];
			trainingSetupRepairs.push(
				outcome === 'unusable' ||
					(outcome === 'explicit-null' &&
						persistedModel.completedSteps.some(isTrainingSetupOrLater))
			);

			// A persisted model whose id is no longer in the catalogue returns to Section 1
			const model: ModelRecord =
				persistedModel.modelId !== null && !isClassifierId(persistedModel.modelId)
					? {
							...persistedModel,
							modelId: null,
							completedSteps: [],
							hyperparameters: { mode: 'manual', values: {} },
							multiclass: null
						}
					: persistedModel;
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
				completedSteps: model.completedSteps.filter((step) => !isTrainingSetupOrLater(step))
			});
		} else {
			modelsWithTrainingRecovery.push(model);
		}
	}
	state = {
		...state,
		models: modelsWithTrainingRecovery.map((model, index) => {
			if (model.status !== 'draft' || !trainingSetupRepairs[index]) return model;
			const wasDemoted = persisted.state.models[index]?.status !== 'draft';
			return {
				...model,
				trainingSetup: null,
				completedSteps: model.completedSteps.filter(
					(step) => !isTrainingSetupOrLater(step)
				),
				progress: null,
				timings: null,
				durationMs: null,
				metrics: null,
				error:
					wasDemoted || model.error?.code === 'TRAINING_INTERRUPTED_BY_RELOAD'
						? model.error
						: null
			};
		})
	};

	// 8. Persist the repaired state immediately
	$appState.set(state);
	persistNow(storage);

	return state;
}
