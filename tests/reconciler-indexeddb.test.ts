import { afterEach, describe, expect, it } from 'bun:test';
import {
	INGESTION_LOCK,
	datasetRowRange,
	getMetadata,
	openSamataDb,
	putMetadata
} from '../src/common/storage/db';
import { parseRoute } from '../src/router/route-parser';
import { $appState, setTrainingSetup } from '../src/stores/app.store';
import {
	flushNow,
	initPersister,
	MemoryStorage,
	persistNow,
	stopPersister
} from '../src/stores/persister';
import { createDefaultIndexedDBAdapter, reconcileStartupState } from '../src/stores/reconciler';
import {
	INITIAL_APP_STATE,
	INITIAL_SCROLL_STATE,
	SCROLL_STORAGE_KEY,
	STATE_STORAGE_KEY,
	type ModelRecord,
	type ModelSectionId,
	type PersistedAppState
} from '../src/types/state';
import type { DatasetMetadata, RawRecord } from '../src/types/dataset';
import { installFakeIndexedDB } from './helpers/fake-indexeddb';

let restoreIndexedDB: (() => void) | undefined;
let db: Awaited<ReturnType<typeof openSamataDb>> | undefined;

function metadata(id: string): DatasetMetadata {
	return {
		id,
		name: id,
		source: 'upload',
		sampleId: null,
		rowCount: 1,
		byteLength: 8,
		createdAt: 1,
		delimiter: ',',
		columns: [],
		paddedRowCount: 0,
		skippedRows: { count: 0, rowNumbers: [] }
	};
}

function row(datasetId: string): RawRecord {
	return { datasetId, rowIndex: 0, values: ['value'] };
}

function storageFor(id: string, target: string | null = null): MemoryStorage {
	const storage = new MemoryStorage();
	const state: PersistedAppState = {
		...INITIAL_APP_STATE,
		dataset: {
			id,
			name: id,
			source: 'upload',
			rowCount: 1,
			columns: [{ name: 'species', type: 'categorical', missingCount: 0 }]
		},
		target,
		data: { mode: 'preview', selectedColumn: null }
	};
	storage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
	return storage;
}

async function installDatabase(): Promise<void> {
	restoreIndexedDB = installFakeIndexedDB();
	db = await openSamataDb();
}

type V1ModelRecord = Omit<ModelRecord, 'trainingSetup'> & { trainingSetup: unknown };
type V1AppState = Omit<PersistedAppState, 'models' | 'version'> & {
	version: 1;
	models: V1ModelRecord[];
};

function modelRecord(overrides: Partial<ModelRecord>): ModelRecord {
	return {
		num: 1,
		createdAt: 1,
		status: 'draft',
		completedSteps: [],
		modelId: null,
		features: [],
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
		ui: {},
		...overrides
	};
}

function storageWithModels(models: V1ModelRecord[]): MemoryStorage {
	const storage = new MemoryStorage();
	const state: V1AppState = {
		...INITIAL_APP_STATE,
		dataset: {
			id: 'a',
			name: 'a',
			source: 'upload',
			rowCount: 10,
			columns: [
				{ name: 'species', type: 'categorical', missingCount: 0 },
				{ name: 'size', type: 'numeric', missingCount: 0 }
			]
		},
		target: 'species',
		resumePath: '/models/1',
		models,
		nextModelNum: models.length + 5,
		data: { mode: 'preview', selectedColumn: null }
	};
	storage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
	return storage;
}

afterEach(() => {
	stopPersister();
	db?.close();
	db = undefined;
	restoreIndexedDB?.();
	restoreIndexedDB = undefined;
});

describe('IndexedDB-backed startup reconciliation', () => {
	it('deletes orphan datasets while keeping the active dataset', async () => {
		await installDatabase();
		await putMetadata(db!, metadata('a'));
		await putMetadata(db!, metadata('b'));
		await db!.put('raw_records', row('a'));
		await db!.put('raw_records', row('b'));

		await reconcileStartupState(storageFor('a'), createDefaultIndexedDBAdapter());
		expect(await getMetadata(db!, 'a')).toBeDefined();
		expect(await getMetadata(db!, 'b')).toBeUndefined();
		expect(await db!.count('raw_records', datasetRowRange('a'))).toBe(1);
		expect(await db!.count('raw_records', datasetRowRange('b'))).toBe(0);
	});

	it('keeps a partial dataset while ingestion is locked, then deletes it after release', async () => {
		await installDatabase();
		await putMetadata(db!, metadata('a'));
		await db!.put('raw_records', row('c'));
		const storage = storageFor('a');
		const release = (
			navigator.locks as LockManager & { _holdLock(name: string): () => void }
		)._holdLock(INGESTION_LOCK);
		try {
			await reconcileStartupState(storage, createDefaultIndexedDBAdapter());
			expect(await db!.count('raw_records', datasetRowRange('c'))).toBe(1);
		} finally {
			release();
		}
		await reconcileStartupState(storage, createDefaultIndexedDBAdapter());
		expect(await db!.count('raw_records', datasetRowRange('c'))).toBe(0);
	});

	it('resets persisted dataset state when its metadata is missing', async () => {
		await installDatabase();
		await db!.put('raw_records', row('a'));
		const result = await reconcileStartupState(
			storageFor('a', 'species'),
			createDefaultIndexedDBAdapter()
		);
		expect(result.dataset).toBeNull();
		expect(result.target).toBeNull();
		expect(result.data.mode).toBe('select');
		expect(await getMetadata(db!, 'a')).toBeUndefined();
		expect(await db!.count('raw_records')).toBe(0);
	});

	describe('WML-P1-REC-1: unavailable persisted models', () => {
		it('resets a model whose modelId is no longer in the catalogue', async () => {
			await installDatabase();
			await putMetadata(db!, metadata('a'));
			const storage = storageWithModels([
				modelRecord({
					modelId: 'linear-regression',
					completedSteps: ['choose-model', 'select-features'],
					features: ['size'],
					hyperparameters: { mode: 'manual', values: { fitIntercept: false } },
					multiclass: 'one-vs-rest'
				})
			]);
			const result = await reconcileStartupState(storage, createDefaultIndexedDBAdapter());
			const [model] = result.models;
			expect(model?.modelId).toBeNull();
			expect(model?.completedSteps).toEqual([]);
			expect(model?.hyperparameters).toEqual({ mode: 'manual', values: {} });
			expect(model?.multiclass).toBeNull();
			expect(model?.features).toEqual(['size']);
		});

		it('keeps classifier models and models without an id unchanged', async () => {
			await installDatabase();
			await putMetadata(db!, metadata('a'));
			const classifier = modelRecord({
				num: 1,
				modelId: 'logistic-regression',
				completedSteps: ['choose-model'],
				hyperparameters: { mode: 'manual', values: { C: 2 } }
			});
			const blank = modelRecord({ num: 2 });
			const result = await reconcileStartupState(
				storageWithModels([classifier, blank]),
				createDefaultIndexedDBAdapter()
			);
			expect(result.models).toEqual([classifier, blank]);
		});
	});
});

const earlierSteps: ModelSectionId[] = ['choose-model', 'select-features', 'configure-model'];
const setupSteps: ModelSectionId[] = [...earlierSteps, 'configure-training'];
const trainingSteps: ModelSectionId[] = [...setupSteps, 'training', 'results'];
const validOneShotWire = { type: 'train_test_split', testRatio: 0.2 };
const expectedOneShot = { type: 'one_shot', testRatio: 0.2, randomState: 42 } as const;

const staleTrainingFields = {
	progress: { percent: 65, stage: 'fitting' as const, phase: null, statusMessage: 'Training' },
	resultRevision: null,
	timings: { steps: [{ label: 'Fit', durationMs: 20 }], totalMs: 20 },
	durationMs: 20,
	metrics: { accuracy: 0.9 }
};

async function seedDatasetAndResults(...modelNums: number[]): Promise<void> {
	await installDatabase();
	await putMetadata(db!, metadata('a'));
	await db!.put('raw_records', row('a'));
	for (const modelNum of modelNums) {
		await db!.put('model_results', { datasetId: 'a', modelNum, accuracy: 0.9 });
	}
}

async function expectActiveDatasetAndResults(...modelNums: number[]): Promise<void> {
	expect(await getMetadata(db!, 'a')).toEqual(metadata('a'));
	expect(await db!.get('raw_records', ['a', 0])).toEqual(row('a'));
	for (const modelNum of modelNums) {
		expect(await db!.get('model_results', ['a', modelNum])).toEqual({
			datasetId: 'a',
			modelNum,
			accuracy: 0.9
		});
	}
}

function readWireState(storage: MemoryStorage): V1AppState {
	return JSON.parse(storage.getItem(STATE_STORAGE_KEY)!);
}

describe('Phase 2 training setup persistence', () => {
	it('WML-P2-STATE-1: upgrades historical setups and keeps valid state on repeat hydration', async () => {
		await seedDatasetAndResults();
		const setups = [
			null,
			validOneShotWire,
			{ type: 'k_fold_cv', folds: 2 },
			{ type: 'k_fold_cv', folds: 10 },
			{ type: 'nested_cv', outerFolds: 7, innerFolds: 7, obsolete: 'ignored' }
		];
		const models = setups.map((trainingSetup, index) => ({
			...modelRecord({
				num: index + 1,
				modelId: 'logistic-regression',
				features: ['size'],
				completedSteps: index === 0 ? earlierSteps : setupSteps
			}),
			trainingSetup
		}));
		const storage = storageWithModels(models);
		const scroll = {
			...INITIAL_SCROLL_STATE,
			snapshots: { 'models:1': { viewportWidth: 1280, top: 200, savedAt: 1 } }
		};
		storage.setItem(SCROLL_STORAGE_KEY, JSON.stringify(scroll));
		const adapter = createDefaultIndexedDBAdapter();
		const nestedSetups = [2, 10, 7].map(
			(folds) =>
				({
					type: 'nested_cv',
					outerFolds: folds,
					innerFolds: folds,
					randomState: 42
				}) as const
		);
		const expectedDomainSetups = [null, expectedOneShot, ...nestedSetups];
		const expectedWireSetups = [
			null,
			{ ...validOneShotWire, randomState: 42 },
			...nestedSetups
		];

		const upgraded = await reconcileStartupState(storage, adapter);
		expect(upgraded.models.map((model) => model.trainingSetup)).toEqual(expectedDomainSetups);
		expect(upgraded.models.map((model) => model.completedSteps)).toEqual(
			models.map((model) => model.completedSteps)
		);
		expect(upgraded.models[0]).toEqual({ ...models[0]!, trainingSetup: null });
		expect(upgraded.nextModelNum).toBe(10);
		expect(upgraded.target).toBe('species');
		expect(upgraded.resumePath).toBe('/models/1');
		expect(readWireState(storage).models.map((model) => model.trainingSetup)).toEqual(
			expectedWireSetups
		);
		expect(storage.getItem(SCROLL_STORAGE_KEY)).toBe(JSON.stringify(scroll));

		for (let reload = 0; reload < 2; reload++) {
			expect(await reconcileStartupState(storage, adapter)).toEqual(upgraded);
			expect(storage.getItem(SCROLL_STORAGE_KEY)).toBe(JSON.stringify(scroll));
			expect(readWireState(storage).models.map((model) => model.trainingSetup)).toEqual(
				expectedWireSetups
			);
			await expectActiveDatasetAndResults();
		}
	});

	const unusableSetups = [
		'{"type":"nested_cv","outerFolds":5,"innerFolds":5,"__proto__":{}}',
		'{"type":"train_test_split","testRatio":0.2,"constructor":{}}',
		'{"type":"k_fold_cv","folds":5,"prototype":{}}',
		'{"type":"nested_cv","outerFolds":5}',
		'{"type":"nested_cv","outerFolds":5,"innerFolds":4}',
		'{"type":"k_fold_cv","folds":1}',
		'{"type":"k_fold_cv","folds":11}',
		'{"type":"k_fold_cv","folds":3.5}',
		'{"type":"k_fold_cv","folds":1e999}',
		'{"type":"train_test_split","testRatio":0.3}',
		'{"type":"train_test_split"}',
		'{"type":"future_strategy"}',
		'{"type":"k_fold_cv","folds":5,"randomState":13}',
		'[]'
	];

	it.each(unusableSetups)(
		'WML-P2-STATE-2: recovers a draft with setup %s in isolation',
		async (rawSetup) => {
			await seedDatasetAndResults(2);
			const affected = modelRecord({
				modelId: 'logistic-regression',
				features: ['size'],
				hyperparameters: { mode: 'manual', values: { C: 2 } },
				multiclass: 'native',
				ui: { selectedTab: 'settings' },
				completedSteps: trainingSteps,
				...staleTrainingFields,
				error: { code: 'TRAINING_CANCELLED', message: 'Cancelled', timestamp: 7 }
			});
			const sibling = {
				...modelRecord({ num: 2, status: 'trained', completedSteps: trainingSteps }),
				trainingSetup: { type: 'k_fold_cv', folds: 5 }
			};
			const storage = storageWithModels([
				{ ...affected, trainingSetup: 'RAW_SETUP' },
				sibling
			]);
			storage.setItem(
				STATE_STORAGE_KEY,
				storage.getItem(STATE_STORAGE_KEY)!.replace('"RAW_SETUP"', rawSetup)
			);

			const repaired = await reconcileStartupState(storage, createDefaultIndexedDBAdapter());
			expect(repaired.dataset?.id).toBe('a');
			expect(repaired.models).toEqual([
				{
					...affected,
					completedSteps: earlierSteps,
					progress: null,
					resultRevision: null,
					timings: null,
					durationMs: null,
					metrics: null,
					error: null
				},
				{
					...sibling,
					trainingSetup: {
						type: 'nested_cv',
						outerFolds: 5,
						innerFolds: 5,
						randomState: 42
					}
				}
			]);
			await expectActiveDatasetAndResults(2);
		}
	);

	it('WML-P2-STATE-2: applies setup recovery after checking results and training locks', async () => {
		await seedDatasetAndResults(1);
		const stored = [
			modelRecord({
				num: 1,
				status: 'trained',
				completedSteps: trainingSteps,
				...staleTrainingFields
			}),
			modelRecord({
				num: 2,
				status: 'training',
				completedSteps: trainingSteps,
				...staleTrainingFields
			}),
			modelRecord({
				num: 3,
				status: 'training',
				completedSteps: trainingSteps,
				...staleTrainingFields
			})
		];
		const storage = storageWithModels(
			stored.map((model) => ({ ...model, trainingSetup: 'unusable' }))
		);
		const release = (
			navigator.locks as LockManager & { _holdLock(name: string): () => void }
		)._holdLock('samata-ml:training:2');
		try {
			const adapter = createDefaultIndexedDBAdapter();
			const reconciled = await reconcileStartupState(storage, adapter);
			expect(reconciled.models.slice(0, 2)).toEqual(stored.slice(0, 2));
			const interrupted = reconciled.models[2];
			expect(interrupted).toMatchObject({
				status: 'draft',
				completedSteps: earlierSteps,
				trainingSetup: null,
				progress: null,
				resultRevision: null,
				timings: null,
				durationMs: null,
				metrics: null,
				error: { code: 'TRAINING_INTERRUPTED_BY_RELOAD' }
			});
			expect((await reconcileStartupState(storage, adapter)).models[2]).toEqual(interrupted);
			await expectActiveDatasetAndResults(1);
		} finally {
			release();
		}
	});

	it('WML-P2-STATE-2: a future v1 envelope is read-only and keeps its bytes', async () => {
		const storage = storageWithModels([modelRecord({})]);
		const raw = JSON.stringify({ ...readWireState(storage), version: 2 }, null, 2);
		storage.setItem(STATE_STORAGE_KEY, raw);
		expect(await reconcileStartupState(storage)).toEqual(INITIAL_APP_STATE);
		persistNow(storage);
		expect(storage.getItem(STATE_STORAGE_KEY)).toBe(raw);
	});

	it('WML-P2-STATE-3: both writers use v1 tags and preserve the active dataset across rollback', async () => {
		await seedDatasetAndResults(3);
		await putMetadata(db!, metadata('orphan'));
		await db!.put('raw_records', row('orphan'));
		const storage = storageWithModels([
			{
				...modelRecord({ num: 1, completedSteps: setupSteps }),
				trainingSetup: validOneShotWire
			},
			{
				...modelRecord({ num: 2, completedSteps: setupSteps }),
				trainingSetup: { type: 'k_fold_cv', folds: 5 }
			},
			{
				...modelRecord({ num: 3, status: 'trained', completedSteps: trainingSteps }),
				trainingSetup: validOneShotWire
			}
		]);
		const adapter = createDefaultIndexedDBAdapter();
		const oldWriterPayload = storage.getItem(STATE_STORAGE_KEY)!;
		expect(validatePreviousV1AppState(JSON.parse(oldWriterPayload)).valid).toBe(true);
		const upgraded = await reconcileStartupState(storage, adapter);
		expect(upgraded.models[0]?.trainingSetup).toEqual(expectedOneShot);
		expect(upgraded.models[1]?.trainingSetup).toEqual({
			type: 'nested_cv',
			outerFolds: 5,
			innerFolds: 5,
			randomState: 42
		});
		initPersister(storage, { debounceFieldMs: 10_000 });

		const threeFolds = {
			type: 'nested_cv',
			outerFolds: 3,
			innerFolds: 3,
			randomState: 42
		} as const;
		const fourFolds = { ...threeFolds, outerFolds: 4, innerFolds: 4 };
		expect(setTrainingSetup(1, threeFolds)).toBe(true);
		expect(readWireState(storage).models[0]?.trainingSetup).toEqual(threeFolds);
		expect(setTrainingSetup(1, fourFolds)).toBe(true);
		expect(readWireState(storage).models[0]?.trainingSetup).toEqual(threeFolds);
		flushNow();
		expect(readWireState(storage).models[0]?.trainingSetup).toEqual(fourFolds);

		expect(setTrainingSetup(2, expectedOneShot)).toBe(true);
		const synchronous = readWireState(storage);
		expect(synchronous.models[1]?.trainingSetup).toEqual({
			...validOneShotWire,
			randomState: 42
		});
		expect(validatePreviousV1AppState(synchronous).valid).toBe(true);
		const inMemory = $appState.get();
		expect(inMemory.models.map((model) => model.trainingSetup?.type)).toEqual([
			'nested_cv',
			'one_shot',
			'one_shot'
		]);

		stopPersister();
		storage.removeItem(STATE_STORAGE_KEY);
		persistNow(storage);
		const wire = readWireState(storage);
		expect(wire).toEqual(synchronous);
		expect(wire).not.toHaveProperty('trainingSetupDecodeOutcomes');
		expect($appState.get()).toBe(inMemory);
		const rollback = validatePreviousV1AppState(wire);
		expect(rollback.valid).toBe(true);
		if (!rollback.valid) throw new Error('Previous v1 reader rejected the setup');
		expect(rollback.state.dataset?.id).toBe('a');
		expect(
			validatePreviousV1AppState({
				...wire,
				models: wire.models.map((model, index) =>
					index === 1 ? { ...model, trainingSetup: expectedOneShot } : model
				)
			}).valid
		).toBe(false);

		await putMetadata(db!, metadata('orphan'));
		await db!.put('raw_records', row('orphan'));
		await adapter.deleteOrphanDatasets(rollback.state.dataset?.id ?? null);
		expect(await getMetadata(db!, 'orphan')).toBeUndefined();
		expect(await db!.get('raw_records', ['orphan', 0])).toBeUndefined();
		await expectActiveDatasetAndResults(3);
		storage.setItem(STATE_STORAGE_KEY, JSON.stringify(rollback.state));
		expect(await reconcileStartupState(storage, adapter)).toEqual(inMemory);
		await expectActiveDatasetAndResults(3);
	});

	it.each([null, { type: 'nested_cv', outerFolds: 4, innerFolds: 5 }])(
		'WML-P2-STATE-5: result loss preserves the newly assigned diagnostic with setup %j',
		async (trainingSetup) => {
			await seedDatasetAndResults(2);
			const original = {
				...modelRecord({
					status: 'trained',
					completedSteps: trainingSteps,
					...staleTrainingFields
				}),
				trainingSetup
			};
			const sibling = {
				...modelRecord({ num: 2, status: 'trained', completedSteps: trainingSteps }),
				trainingSetup: validOneShotWire
			};
			const staleDraft = {
				...modelRecord({
					num: 3,
					completedSteps: trainingSteps,
					...staleTrainingFields,
					error: {
						code: 'TRAINING_FAILED',
						message: 'Stored model results were lost',
						timestamp: 1
					}
				}),
				trainingSetup: 'unusable'
			};
			const storage = storageWithModels([original, sibling, staleDraft]);
			const adapter = createDefaultIndexedDBAdapter();
			const repaired = await reconcileStartupState(storage, adapter);
			const [demoted, unaffected, cleaned] = repaired.models;
			expect(demoted).toMatchObject({
				status: 'draft',
				completedSteps: earlierSteps,
				trainingSetup: null,
				progress: null,
				resultRevision: null,
				timings: null,
				durationMs: null,
				metrics: null,
				error: {
					code: 'TRAINING_FAILED',
					message: 'Stored model results were lost',
					timestamp: expect.any(Number)
				}
			});
			expect(unaffected).toEqual({ ...sibling, trainingSetup: expectedOneShot });
			expect(cleaned?.error).toBeNull();
			expect(cleaned?.completedSteps).toEqual(earlierSteps);
			expect(await reconcileStartupState(storage, adapter)).toEqual(repaired);
			await expectActiveDatasetAndResults(2);
		}
	);
});

// Frozen app-state validation from the previous v1 persister at d565ca19.
// Keep the accepted wire tags independent of the current decoder.
const V1_STORAGE_VERSION = 1;

const VALID_COLUMN_TYPES = new Set<string>([
	'numeric',
	'categorical',
	'boolean',
	'date',
	'time',
	'datetime',
	'text'
]);

const VALID_MODEL_STATUSES = new Set<string>(['draft', 'training', 'trained']);

const VALID_MODEL_SECTION_IDS = new Set<string>([
	'choose-model',
	'select-features',
	'configure-model',
	'configure-training',
	'training',
	'results'
]);

const VALID_MULTICLASS_STRATEGIES = new Set<string>(['native', 'one-vs-rest', 'one-vs-one']);

const VALID_TRAINING_SETUP_TYPES = new Set<string>(['nested_cv', 'k_fold_cv', 'train_test_split']);

const VALID_ERROR_CODES = new Set<string>([
	'TRAINING_FAILED',
	'TRAINING_CANCELLED',
	'TRAINING_INTERRUPTED_BY_RELOAD'
]);

function isPlainObject(val: unknown): val is Record<string, unknown> {
	return typeof val === 'object' && val !== null && !Array.isArray(val);
}

const FORBIDDEN_VALUE_KEYS = ['__proto__', 'constructor', 'prototype'] as const;

/** Reports whether a persisted hyperparameter value is a finite number, string, boolean, null or number array. */
function isHyperparameterValue(val: unknown): boolean {
	if (val === null || typeof val === 'string' || typeof val === 'boolean') return true;
	if (typeof val === 'number') return Number.isFinite(val);
	return (
		Array.isArray(val) && val.every((item) => typeof item === 'number' && Number.isFinite(item))
	);
}

/** Reports whether persisted hyperparameter `values` is a plain object of valid values without prototype keys. */
function isHyperparameterValues(val: unknown): boolean {
	if (!isPlainObject(val)) return false;
	if (FORBIDDEN_VALUE_KEYS.some((key) => Object.hasOwn(val, key))) return false;
	return Object.values(val).every(isHyperparameterValue);
}

function validatePreviousV1AppState(
	val: unknown
): { valid: true; state: V1AppState } | { valid: false; isNewer: boolean } {
	if (!isPlainObject(val)) {
		return { valid: false, isNewer: false };
	}

	if (typeof val.version === 'number' && val.version > V1_STORAGE_VERSION) {
		return { valid: false, isNewer: true };
	}

	if (val.version !== V1_STORAGE_VERSION) {
		return { valid: false, isNewer: false };
	}

	if (typeof val.updatedAt !== 'number' || !Number.isFinite(val.updatedAt)) {
		return { valid: false, isNewer: false };
	}

	if (!isPlainObject(val.onboarding) || typeof val.onboarding.welcomeDismissed !== 'boolean') {
		return { valid: false, isNewer: false };
	}

	if (typeof val.resumePath !== 'string' || parseRoute(val.resumePath).kind !== 'workflow') {
		return { valid: false, isNewer: false };
	}

	if (
		typeof val.nextModelNum !== 'number' ||
		!Number.isInteger(val.nextModelNum) ||
		val.nextModelNum < 1
	) {
		return { valid: false, isNewer: false };
	}

	if (!isPlainObject(val.results) || !isPlainObject(val.results.ui)) {
		return { valid: false, isNewer: false };
	}

	if (val.dataset !== null) {
		if (!isPlainObject(val.dataset)) {
			return { valid: false, isNewer: false };
		}
		if (typeof val.dataset.id !== 'string' || typeof val.dataset.name !== 'string') {
			return { valid: false, isNewer: false };
		}
		if (val.dataset.source !== 'sample' && val.dataset.source !== 'upload') {
			return { valid: false, isNewer: false };
		}
		if (
			val.dataset.sampleId !== undefined &&
			(typeof val.dataset.sampleId !== 'string' || val.dataset.sampleId.length === 0)
		) {
			return { valid: false, isNewer: false };
		}
		if (
			typeof val.dataset.rowCount !== 'number' ||
			!Number.isInteger(val.dataset.rowCount) ||
			val.dataset.rowCount < 0
		) {
			return { valid: false, isNewer: false };
		}
		if (!Array.isArray(val.dataset.columns)) {
			return { valid: false, isNewer: false };
		}
		for (const col of val.dataset.columns) {
			if (!isPlainObject(col)) {
				return { valid: false, isNewer: false };
			}
			if (typeof col.name !== 'string' || typeof col.type !== 'string') {
				return { valid: false, isNewer: false };
			}
			if (!VALID_COLUMN_TYPES.has(col.type)) {
				return { valid: false, isNewer: false };
			}
			if (
				typeof col.missingCount !== 'number' ||
				!Number.isInteger(col.missingCount) ||
				col.missingCount < 0
			) {
				return { valid: false, isNewer: false };
			}
		}
	}

	if (!isPlainObject(val.data)) {
		return { valid: false, isNewer: false };
	}
	if (val.data.mode !== 'select' && val.data.mode !== 'preview') {
		return { valid: false, isNewer: false };
	}
	if (val.data.selectedColumn !== null && typeof val.data.selectedColumn !== 'string') {
		return { valid: false, isNewer: false };
	}

	if (val.target !== null && typeof val.target !== 'string') {
		return { valid: false, isNewer: false };
	}

	if (!Array.isArray(val.models)) {
		return { valid: false, isNewer: false };
	}
	for (const m of val.models) {
		if (!isPlainObject(m)) {
			return { valid: false, isNewer: false };
		}
		if (typeof m.num !== 'number' || !Number.isInteger(m.num) || m.num < 1) {
			return { valid: false, isNewer: false };
		}
		if (typeof m.createdAt !== 'number' || !Number.isFinite(m.createdAt)) {
			return { valid: false, isNewer: false };
		}
		if (typeof m.status !== 'string' || !VALID_MODEL_STATUSES.has(m.status)) {
			return { valid: false, isNewer: false };
		}
		if (!Array.isArray(m.completedSteps)) {
			return { valid: false, isNewer: false };
		}
		for (const step of m.completedSteps) {
			if (typeof step !== 'string' || !VALID_MODEL_SECTION_IDS.has(step)) {
				return { valid: false, isNewer: false };
			}
		}
		if (m.modelId !== null && typeof m.modelId !== 'string') {
			return { valid: false, isNewer: false };
		}
		if (!Array.isArray(m.features) || !m.features.every((f) => typeof f === 'string')) {
			return { valid: false, isNewer: false };
		}
		if (!isPlainObject(m.modelOptions) || !isPlainObject(m.ui)) {
			return { valid: false, isNewer: false };
		}
		if (!isPlainObject(m.hyperparameters)) {
			return { valid: false, isNewer: false };
		}
		if (m.hyperparameters.mode !== 'manual' && m.hyperparameters.mode !== 'tuning') {
			return { valid: false, isNewer: false };
		}
		if (!isHyperparameterValues(m.hyperparameters.values)) {
			return { valid: false, isNewer: false };
		}
		if (
			m.hyperparameters.tuningSearchSpace !== undefined &&
			!isPlainObject(m.hyperparameters.tuningSearchSpace)
		) {
			return { valid: false, isNewer: false };
		}
		if (
			m.multiclass !== null &&
			(typeof m.multiclass !== 'string' || !VALID_MULTICLASS_STRATEGIES.has(m.multiclass))
		) {
			return { valid: false, isNewer: false };
		}
		if (m.trainingSetup !== null) {
			if (!isPlainObject(m.trainingSetup)) {
				return { valid: false, isNewer: false };
			}
			if (
				typeof m.trainingSetup.type !== 'string' ||
				!VALID_TRAINING_SETUP_TYPES.has(m.trainingSetup.type)
			) {
				return { valid: false, isNewer: false };
			}
		}
		if (m.progress !== null) {
			if (!isPlainObject(m.progress)) {
				return { valid: false, isNewer: false };
			}
			if (
				typeof m.progress.percent !== 'number' ||
				!Number.isFinite(m.progress.percent) ||
				typeof m.progress.statusMessage !== 'string'
			) {
				return { valid: false, isNewer: false };
			}
		}
		if (m.error !== null) {
			if (!isPlainObject(m.error)) {
				return { valid: false, isNewer: false };
			}
			if (typeof m.error.code !== 'string' || !VALID_ERROR_CODES.has(m.error.code)) {
				return { valid: false, isNewer: false };
			}
			if (
				typeof m.error.message !== 'string' ||
				typeof m.error.timestamp !== 'number' ||
				!Number.isFinite(m.error.timestamp)
			) {
				return { valid: false, isNewer: false };
			}
		}
		if (m.timings !== null && !isPlainObject(m.timings)) {
			return { valid: false, isNewer: false };
		}
		if (
			m.durationMs !== null &&
			(typeof m.durationMs !== 'number' || !Number.isFinite(m.durationMs))
		) {
			return { valid: false, isNewer: false };
		}
		if (m.metrics !== null && !isPlainObject(m.metrics)) {
			return { valid: false, isNewer: false };
		}
	}

	return { valid: true, state: val as unknown as V1AppState };
}
