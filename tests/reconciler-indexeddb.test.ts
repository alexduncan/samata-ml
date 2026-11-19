import { afterEach, describe, expect, it } from 'bun:test';
import {
	INGESTION_LOCK,
	datasetRowRange,
	getMetadata,
	openSamataDb,
	putMetadata
} from '../src/common/storage/db';
import { MemoryStorage } from '../src/stores/persister';
import { createDefaultIndexedDBAdapter, reconcileStartupState } from '../src/stores/reconciler';
import {
	INITIAL_APP_STATE,
	STATE_STORAGE_KEY,
	type ModelRecord,
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

afterEach(() => {
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
				error: null,
				timings: null,
				durationMs: null,
				metrics: null,
				ui: {},
				...overrides
			};
		}

		function storageWithModels(models: ModelRecord[]): MemoryStorage {
			const storage = new MemoryStorage();
			const state: PersistedAppState = {
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
				models,
				nextModelNum: models.length + 1,
				data: { mode: 'preview', selectedColumn: null }
			};
			storage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
			return storage;
		}

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
