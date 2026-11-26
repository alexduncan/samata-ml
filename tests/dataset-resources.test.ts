import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { $locale, $format, i18n } from '../src/i18n';
import { $appState, clearDataset } from '../src/stores/app.store';
import {
	$datasetLoad,
	$datasetResources,
	type DatasetLoadState,
	$previewRows,
	cancelDatasetLoad,
	changeDataset,
	clearDatasetResources,
	loadDatasetResources,
	loadPreviewRows,
	setStorageClientForTesting,
	startDatasetLoad
} from '../src/stores/dataset.store';
import { $scrollState, recordScroll } from '../src/stores/scroll.store';
import type { DatasetMetadata, RawRecord } from '../src/types/dataset';
import { IngestionError } from '../src/features/data/ingestion/errors';
import { buildFeatureRows } from '../src/features/models/feature-eligibility';
import type { StorageClient } from '../src/features/data/ingestion/storage-client';
import { INITIAL_APP_STATE, type ModelRecord, type ModelStatus } from '../src/types/state';
import { resetSampleDatasetCache } from '../src/features/data/sample-datasets';
import { INGESTION_LOCK, openSamataDb } from '../src/common/storage/db';
import {
	createTrainingService,
	setTrainingServiceForTesting
} from '../src/features/models/training/training-service';
import { MemoryStorage } from '../src/stores/persister';
import { STATE_STORAGE_KEY } from '../src/types/state';
import { installFakeIndexedDB } from './helpers/fake-indexeddb';
import { createTrainingTestLocks } from './helpers/training-locks';

const IDLE_LOAD: DatasetLoadState = {
	busy: false,
	progress: null,
	errorCode: null,
	stage: 'idle',
	name: '',
	errorStage: null
};

function createMockModel(num = 1, status: ModelStatus = 'draft'): ModelRecord {
	return {
		num,
		createdAt: Date.now(),
		modelId: 'logreg',
		modelOptions: {},
		hyperparameters: { mode: 'manual', values: {} },
		features: ['feature_1'],
		multiclass: 'native',
		trainingSetup: { type: 'nested_cv', outerFolds: 5, innerFolds: 5, randomState: 42 },
		completedSteps: ['choose-model', 'select-features'],
		status,
		progress: null,
		resultRevision: null,
		error: null,
		timings: null,
		durationMs: null,
		metrics: null,
		ui: {}
	};
}

function createMockMetadata(id: string, sampleId: string | null = null): DatasetMetadata {
	return {
		id,
		name: `Dataset ${id}`,
		source: sampleId ? 'sample' : 'upload',
		sampleId,
		rowCount: 100,
		byteLength: 2048,
		createdAt: Date.now(),
		delimiter: ',',
		columns: [
			{
				name: 'feature_1',
				type: 'numeric',
				missingCount: 0,
				missingTokens: {},
				invalidCount: 0,
				invalidExamples: [],
				count: 100,
				min: 1,
				max: 10,
				mean: 5.5,
				median: 5.5,
				integer: true,
				identifierHint: false,
				format: { prefix: '', suffix: '', thousandsSeparator: false },
				histogram: { start: 1, width: 1, counts: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10] }
			}
		],
		paddedRowCount: 0,
		skippedRows: { count: 0, rowNumbers: [] }
	};
}

function createMockRows(datasetId: string, start: number, count: number): RawRecord[] {
	return Array.from({ length: count }, (_, i) => ({
		datasetId,
		rowIndex: start + i,
		values: [start + i]
	}));
}

describe('i18n foundation (D3)', () => {
	it('exports $locale fixed to base en and $format formatter', () => {
		expect($locale.get()).toBe('en');
		const formatterInstance = $format.get();
		expect(typeof formatterInstance.number).toBe('function');
		expect(typeof formatterInstance.time).toBe('function');
		expect(formatterInstance.number(12345.67)).toBe('12,345.67');
	});

	it('creates component-level translation messages via i18n', () => {
		const messages = i18n('testComponent', {
			greeting: 'Hello world',
			count: (n: number) => `${n} items`
		});
		expect(messages.get().greeting).toBe('Hello world');
		expect(messages.get().count(3)).toBe('3 items');
	});
});

describe('dataset resource actions (DATA-RES-1)', () => {
	let originalFetch: typeof globalThis.fetch;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		$appState.set(structuredClone(INITIAL_APP_STATE));
		clearDatasetResources();
		resetSampleDatasetCache();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		setStorageClientForTesting(null);
		clearDatasetResources();
		$appState.set(structuredClone(INITIAL_APP_STATE));
	});

	it('loads metadata and resolves sample descriptor via sampleId', async () => {
		const meta = createMockMetadata('ds-iris', 'iris');
		$appState.set({
			...$appState.get(),
			dataset: {
				id: 'ds-iris',
				name: 'Iris',
				source: 'sample',
				sampleId: 'iris',
				rowCount: 150,
				columns: [{ name: 'feature_1', type: 'numeric', missingCount: 0 }]
			}
		});

		const mockClient: StorageClient = {
			ingest: async () => meta,
			validate: async () => ({ rowCount: 0, columnCount: 0 }),
			getMetadata: async (id) => (id === 'ds-iris' ? meta : null),
			fetchRows: async () => [],
			deleteDatasetsExcept: async () => {},
			dispose: () => {}
		};
		setStorageClientForTesting(mockClient);

		globalThis.fetch = (async (url: string | URL | Request) => {
			const urlStr = url.toString();
			if (urlStr.endsWith('/datasets/index.json')) {
				return new Response(
					JSON.stringify({
						version: 1,
						entries: [
							{
								id: 'iris',
								name: 'Iris',
								tagline: 'Flowers',
								domain: 'biology',
								difficulty: 'beginner',
								tags: ['multiclass'],
								taskTypes: ['multiclass-classification'],
								license: 'CC0-1.0',
								csvOrigin: 'bundled',
								stats: {
									rowCount: 150,
									columnCount: 5,
									fileSizeBytes: 1000,
									sha256: 'abc'
								},
								descriptorUrl: '/datasets/iris/descriptor.json?v=1234567890ab'
							}
						]
					})
				);
			}
			if (urlStr.includes('/datasets/iris/descriptor.json')) {
				return new Response(
					JSON.stringify({
						id: 'iris',
						name: 'Iris Flower Dataset',
						columns: []
					})
				);
			}
			return new Response('Not found', { status: 404 });
		}) as typeof globalThis.fetch;

		const loadPromise = loadDatasetResources('ds-iris');
		expect($datasetResources.get().status).toBe('loading');
		expect($datasetResources.get().datasetId).toBe('ds-iris');

		await loadPromise;

		const res = $datasetResources.get();
		expect(res.status).toBe('ready');
		expect(res.metadata).toEqual(meta);
		expect(res.descriptor).toMatchObject({ columns: [] });
		expect(res.error).toBeNull();
	});

	it('retains retired guidance from authoritative metadata without a request', async () => {
		for (const sampleId of ['pima-diabetes', 'titanic']) {
			const meta = createMockMetadata('ds-retired', sampleId);
			const client: StorageClient = {
				ingest: async () => meta,
				validate: async () => ({ rowCount: 0, columnCount: 0 }),
				getMetadata: async () => meta,
				fetchRows: async () => createMockRows('ds-retired', 0, 1),
				deleteDatasetsExcept: async () => {},
				dispose: () => {}
			};
			setStorageClientForTesting(client);
			$appState.set({
				...$appState.get(),
				dataset: {
					id: 'ds-retired',
					name: 'Stale',
					source: 'sample',
					sampleId: 'iris',
					rowCount: 100,
					columns: []
				}
			});
			let requests = 0;
			globalThis.fetch = (async () => {
				requests++;
				throw new Error('unexpected request');
			}) as unknown as typeof fetch;
			await loadDatasetResources('ds-retired');
			const guidance = $datasetResources.get().descriptor;
			expect(guidance?.modeling.defaultTarget).toBe(
				sampleId === 'titanic' ? 'survived' : 'class'
			);
			expect(
				guidance?.columns.some(
					(column) => column.name === (sampleId === 'titanic' ? 'alive' : 'plas')
				)
			).toBe(true);
			if (sampleId === 'titanic') {
				const stats = (name: string) => ({
					name,
					type: 'categorical' as const,
					missingCount: 0,
					missingTokens: {},
					invalidCount: 0,
					invalidExamples: [],
					distinctCount: 2,
					categoryCounts: { no: 50, yes: 50 }
				});
				const rows = buildFeatureRows(
					{ ...meta, columns: [stats('survived'), stats('alive')] },
					'survived',
					guidance
				);
				expect(rows.find((row) => row.name === 'alive')).toMatchObject({
					initiallySelected: false,
					reasonCodes: expect.arrayContaining(['LEAKY'])
				});
			}
			await loadPreviewRows('ds-retired', 0, 1);
			expect($previewRows.get().rows).toHaveLength(1);
			expect(requests).toBe(0);
		}
	});

	it('treats missing descriptor as a non-fatal advisory while missing metadata is an error', async () => {
		const meta = createMockMetadata('ds-upload', null);

		const mockClient: StorageClient = {
			ingest: async () => meta,
			validate: async () => ({ rowCount: 0, columnCount: 0 }),
			getMetadata: async (id) => (id === 'ds-upload' ? meta : null),
			fetchRows: async () => [],
			deleteDatasetsExcept: async () => {},
			dispose: () => {}
		};
		setStorageClientForTesting(mockClient);

		await loadDatasetResources('ds-upload');
		expect($datasetResources.get().status).toBe('ready');
		expect($datasetResources.get().descriptor).toBeNull();
		expect($datasetResources.get().metadata).toEqual(meta);

		// Missing metadata error
		await loadDatasetResources('missing-id');
		expect($datasetResources.get().status).toBe('error');
		expect($datasetResources.get().metadata).toBeNull();
		expect($datasetResources.get().error).toContain('could not be found');
	});

	it('rejects stale metadata responses and teardown overwrites using controlled promises', async () => {
		let resolveFirst!: (value: DatasetMetadata | null) => void;
		const firstPromise = new Promise<DatasetMetadata | null>((resolve) => {
			resolveFirst = resolve;
		});

		let resolveSecond!: (value: DatasetMetadata | null) => void;
		const secondPromise = new Promise<DatasetMetadata | null>((resolve) => {
			resolveSecond = resolve;
		});

		const mockClient: StorageClient = {
			ingest: async () => createMockMetadata('ds-1'),
			validate: async () => ({ rowCount: 0, columnCount: 0 }),
			getMetadata: async (id) => (id === 'ds-1' ? firstPromise : secondPromise),
			fetchRows: async () => [],
			deleteDatasetsExcept: async () => {},
			dispose: () => {}
		};
		setStorageClientForTesting(mockClient);

		const p1 = loadDatasetResources('ds-1');
		const p2 = loadDatasetResources('ds-2');

		// Resolve first response late
		resolveFirst(createMockMetadata('ds-1'));
		await p1;
		// Since ds-2 was requested after ds-1, ds-1 result must be ignored
		expect($datasetResources.get().datasetId).toBe('ds-2');
		expect($datasetResources.get().status).toBe('loading');

		// Resolve second response
		resolveSecond(createMockMetadata('ds-2'));
		await p2;
		expect($datasetResources.get().datasetId).toBe('ds-2');
		expect($datasetResources.get().status).toBe('ready');
		expect($datasetResources.get().metadata?.id).toBe('ds-2');

		// Teardown ignores late resolution
		let resolveThird!: (value: DatasetMetadata | null) => void;
		const thirdPromise = new Promise<DatasetMetadata | null>((resolve) => {
			resolveThird = resolve;
		});
		mockClient.getMetadata = async () => thirdPromise;

		const p3 = loadDatasetResources('ds-3');
		clearDatasetResources();
		expect($datasetResources.get().status).toBe('idle');
		expect($datasetResources.get().datasetId).toBeNull();

		resolveThird(createMockMetadata('ds-3'));
		await p3;
		expect($datasetResources.get().status).toBe('idle');
		expect($datasetResources.get().datasetId).toBeNull();
	});

	it('maintains a 3-window cache and evicts on dataset change', async () => {
		let fetchCount = 0;
		const mockClient: StorageClient = {
			ingest: async () => createMockMetadata('ds-1'),
			validate: async () => ({ rowCount: 0, columnCount: 0 }),
			getMetadata: async () => null,
			fetchRows: async (datasetId, offset, limit) => {
				fetchCount++;
				return createMockRows(datasetId, offset, limit);
			},
			deleteDatasetsExcept: async () => {},
			dispose: () => {}
		};
		setStorageClientForTesting(mockClient);

		// Window 1: 0..50
		await loadPreviewRows('ds-1', 0, 50);
		expect(fetchCount).toBe(1);
		expect($previewRows.get().rows.length).toBe(50);
		expect($previewRows.get().startIndex).toBe(0);

		// Window 2: 50..50
		await loadPreviewRows('ds-1', 50, 50);
		expect(fetchCount).toBe(2);

		// Window 3: 100..50
		await loadPreviewRows('ds-1', 100, 50);
		expect(fetchCount).toBe(3);

		// Window 1 hit from cache
		await loadPreviewRows('ds-1', 0, 50);
		expect(fetchCount).toBe(3); // Cache hit!

		// Window 4: 150..50 (evicts oldest cached window, which is Window 1: 0..50)
		await loadPreviewRows('ds-1', 150, 50);
		expect(fetchCount).toBe(4);

		// Window 1 should now fetch again because it was evicted
		await loadPreviewRows('ds-1', 0, 50);
		expect(fetchCount).toBe(5);

		// Switch dataset clears all cache
		await loadPreviewRows('ds-2', 0, 50);
		expect(fetchCount).toBe(6);
		expect($previewRows.get().datasetId).toBe('ds-2');

		// Back to ds-1 must fetch again
		await loadPreviewRows('ds-1', 0, 50);
		expect(fetchCount).toBe(7);
	});

	it('clamps row limit to 256 and handles one in-flight request plus latest pending range', async () => {
		let requestedLimits: number[] = [];
		let resolveFirst!: (rows: RawRecord[]) => void;
		const firstPromise = new Promise<RawRecord[]>((resolve) => {
			resolveFirst = resolve;
		});

		const mockClient: StorageClient = {
			ingest: async () => createMockMetadata('ds-1'),
			validate: async () => ({ rowCount: 0, columnCount: 0 }),
			getMetadata: async () => null,
			fetchRows: async (datasetId, offset, limit) => {
				requestedLimits.push(limit);
				if (requestedLimits.length === 1) return firstPromise;
				return createMockRows(datasetId, offset, limit);
			},
			deleteDatasetsExcept: async () => {},
			dispose: () => {}
		};
		setStorageClientForTesting(mockClient);

		// Request 1: limit > 256 gets clamped to 256
		const p1 = loadPreviewRows('ds-1', 0, 500);
		expect(requestedLimits).toEqual([256]);
		expect($previewRows.get().status).toBe('loading');

		// While Request 1 is in-flight, make Request 2 and Request 3
		const p2 = loadPreviewRows('ds-1', 10, 10);
		const p3 = loadPreviewRows('ds-1', 20, 20);

		// Resolve Request 1
		resolveFirst(createMockRows('ds-1', 0, 256));
		await p1;
		await p2;
		await p3;

		// Request 2 (10, 10) was superseded by Request 3 (20, 20), so fetchRows was only called twice in total
		expect(requestedLimits).toEqual([256, 20]);
		expect($previewRows.get().startIndex).toBe(20);
		expect($previewRows.get().rows.length).toBe(20);
		expect($previewRows.get().status).toBe('ready');
	});
});

describe('clear and change dataset actions (DATA-RES-2)', () => {
	let restore: () => void;
	let db: Awaited<ReturnType<typeof openSamataDb>>;
	let storage: MemoryStorage;
	let locks: LockManager;
	beforeEach(async () => {
		$appState.set(structuredClone(INITIAL_APP_STATE));
		$datasetLoad.set(IDLE_LOAD);
		clearDatasetResources();
		restore = installFakeIndexedDB();
		db = await openSamataDb();
		storage = new MemoryStorage();
		locks = createTrainingTestLocks();
		setTrainingServiceForTesting(createTrainingService({ locks, persistence: { storage } }));
	});

	afterEach(() => {
		setStorageClientForTesting(null);
		setTrainingServiceForTesting();
		$datasetLoad.set(IDLE_LOAD);
		clearDatasetResources();
		$appState.set(structuredClone(INITIAL_APP_STATE));
		db.close();
		restore();
	});

	async function seed() {
		const state = {
			...INITIAL_APP_STATE,
			onboarding: { welcomeDismissed: true, betaTelemetryAccepted: false },
			dataset: {
				id: 'ds-1',
				name: 'Iris',
				source: 'sample' as const,
				sampleId: 'iris',
				rowCount: 150,
				columns: [{ name: 'f1', type: 'numeric' as const, missingCount: 0 }]
			},
			data: { mode: 'preview' as const, selectedColumn: 'f1' },
			target: 'species',
			models: [createMockModel(1)],
			nextModelNum: 2
		};
		await db.put('metadata', createMockMetadata('ds-1'));
		storage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
		$appState.set(state);
		return state;
	}

	it('reports another tab’s shared training lock and keeps the captured dataset', async () => {
		await seed();
		let release!: () => void;
		let entered!: () => void;
		const started = new Promise<void>((resolve) => {
			entered = resolve;
		});
		const held = locks.request(
			INGESTION_LOCK,
			{ mode: 'shared' },
			() =>
				new Promise<void>((resolve) => {
					release = resolve;
					entered();
				})
		);
		await started;
		try {
			expect(await changeDataset()).toEqual({ ok: false, code: 'remote-training' });
			expect(await db.get('metadata', 'ds-1')).toBeDefined();
		} finally {
			release();
			await held;
		}
		$datasetLoad.set({ ...IDLE_LOAD, busy: true });
		expect(await changeDataset()).toEqual({ ok: false, code: 'busy' });
	});

	it('leaves app state intact if the protected deletion fails', async () => {
		const priorState = await seed();
		const original = IDBObjectStore.prototype.delete;
		IDBObjectStore.prototype.delete = function (query) {
			if (this.name === 'metadata')
				throw new DOMException('Test quota', 'QuotaExceededError');
			return original.call(this, query);
		};
		try {
			expect(await changeDataset()).toMatchObject({ ok: false, reason: 'quota' });
			expect($appState.get()).toEqual(priorState);
			expect(await db.get('metadata', 'ds-1')).toBeDefined();
		} finally {
			IDBObjectStore.prototype.delete = original;
		}
	});

	it('successfully removes dataset and resets downstream state after acknowledgement', async () => {
		await seed();
		recordScroll('data:select', { top: 100, savedAt: Date.now(), viewportWidth: 1024 });
		recordScroll('models', { top: 200, savedAt: Date.now(), viewportWidth: 1024 });
		expect(await changeDataset()).toEqual({ ok: true, value: undefined });
		expect(await db.get('metadata', 'ds-1')).toBeUndefined();
		const state = $appState.get();
		expect(state.dataset).toBeNull();
		expect(state.data).toEqual({ mode: 'select', selectedColumn: null });
		expect(state.target).toBeNull();
		expect(state.models).toEqual([]);
		expect(state.nextModelNum).toBe(1);
		expect(state.onboarding.welcomeDismissed).toBe(true);
		expect($scrollState.get().snapshots['data:select']).toBeDefined();
		expect($scrollState.get().snapshots.models).toBeUndefined();
	});

	it('startDatasetLoad tracks progress and cancellation via cancelDatasetLoad', async () => {
		let abortTriggered = false;
		let rejectIngest!: (err: Error) => void;
		const ingestPromise = new Promise<DatasetMetadata>((_resolve, reject) => {
			rejectIngest = reject;
		});

		const mockClient: StorageClient = {
			ingest: async (source, options) => {
				options?.signal?.addEventListener('abort', () => {
					abortTriggered = true;
					rejectIngest(new IngestionError('CANCELLED', 'Dataset loading was cancelled.'));
				});
				options?.onProgress?.({
					phase: 'parse',
					bytesProcessed: 100,
					totalBytes: 500,
					rowsProcessed: 10,
					totalRows: 50
				});
				return ingestPromise;
			},
			validate: async () => ({ rowCount: 0, columnCount: 0 }),
			getMetadata: async () => null,
			fetchRows: async () => [],
			deleteDatasetsExcept: async () => {},
			dispose: () => {}
		};
		setStorageClientForTesting(mockClient);

		const startPromise = startDatasetLoad({ kind: 'sample', sampleId: 'iris' });

		expect($datasetLoad.get().busy).toBe(true);
		expect($datasetLoad.get().progress?.phase).toBe('parse');

		// Cancel load
		cancelDatasetLoad();
		expect(abortTriggered).toBe(true);
		const outcome = await startPromise;
		expect(outcome).toBe(false);
		expect($datasetLoad.get().busy).toBe(false);
		expect($datasetLoad.get().errorCode).toBe('CANCELLED');
	});

	function stagedClient(overrides: Partial<StorageClient>): {
		client: StorageClient;
		stages: string[];
	} {
		const stages: string[] = [];
		const client: StorageClient = {
			ingest: async () => {
				stages.push(`ingest:${$datasetLoad.get().stage}`);
				await db.put('metadata', createMockMetadata('ds-new'));
				return createMockMetadata('ds-new');
			},
			validate: async () => {
				stages.push(`validate:${$datasetLoad.get().stage}`);
				return { rowCount: 1, columnCount: 1 };
			},
			getMetadata: async () => null,
			fetchRows: async () => [],
			deleteDatasetsExcept: async () => {},
			dispose: () => {},
			...overrides
		};
		return { client, stages };
	}

	it('LOAD-ST-1: a file load validates, then ingests, then returns to idle', async () => {
		const { client, stages } = stagedClient({});
		setStorageClientForTesting(client);
		const file = new File(['a,b\n1,2'], 'my_data.csv', { type: 'text/csv' });
		const start = startDatasetLoad({ kind: 'file', file });
		expect($datasetLoad.get()).toMatchObject({ stage: 'validating', name: 'my_data' });
		expect(await start).toBe(true);
		expect(stages).toEqual(['validate:validating', 'ingest:ingesting']);
		expect($datasetLoad.get()).toEqual(IDLE_LOAD);
	});

	it('LOAD-ST-1: a validation error never ingests and leaves the dataset unchanged', async () => {
		const prior = await seed();
		let ingested = false;
		const { client } = stagedClient({
			validate: async () => {
				throw new IngestionError('NO_DATA_ROWS', 'no rows');
			},
			ingest: async () => {
				ingested = true;
				return createMockMetadata('ds-new');
			}
		});
		setStorageClientForTesting(client);
		const file = new File(['a'], 'x.csv', { type: 'text/csv' });
		expect(await startDatasetLoad({ kind: 'file', file })).toBe(false);
		expect(ingested).toBe(false);
		expect($datasetLoad.get()).toEqual({
			...IDLE_LOAD,
			errorCode: 'NO_DATA_ROWS',
			errorStage: 'validating'
		});
		expect($appState.get()).toEqual(prior);
		expect(await db.get('metadata', 'ds-1')).toBeDefined();
	});

	it('LOAD-ST-1: a pass-2 failure sets errorStage to ingesting', async () => {
		const { client } = stagedClient({
			ingest: async () => {
				throw new IngestionError('STORAGE_FAILED', 'quota');
			}
		});
		setStorageClientForTesting(client);
		const file = new File(['a'], 'x.csv', { type: 'text/csv' });
		expect(await startDatasetLoad({ kind: 'file', file })).toBe(false);
		expect($datasetLoad.get()).toMatchObject({
			errorCode: 'STORAGE_FAILED',
			errorStage: 'ingesting',
			stage: 'idle'
		});
	});

	it('LOAD-ST-2: a sample load never validates, blocks a second load and clears errors on restart', async () => {
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		let validated = false;
		const { client } = stagedClient({
			validate: async () => {
				validated = true;
				return { rowCount: 1, columnCount: 1 };
			},
			ingest: async () => {
				await gate;
				throw new IngestionError('HTTP_ERROR', 'offline');
			}
		});
		setStorageClientForTesting(client);
		const first = startDatasetLoad({ kind: 'sample', sampleId: 'iris' }, { name: 'Iris' });
		expect($datasetLoad.get()).toMatchObject({ stage: 'ingesting', name: 'Iris' });
		expect(await startDatasetLoad({ kind: 'sample', sampleId: 'iris' })).toBe(false);
		release();
		expect(await first).toBe(false);
		expect(validated).toBe(false);
		expect($datasetLoad.get()).toMatchObject({
			errorCode: 'HTTP_ERROR',
			errorStage: 'ingesting'
		});

		const { client: next } = stagedClient({
			ingest: (_source, options) =>
				new Promise((_resolve, reject) => {
					options?.signal?.addEventListener('abort', () =>
						reject(new IngestionError('CANCELLED', 'cancelled'))
					);
				})
		});
		setStorageClientForTesting(next);
		const second = startDatasetLoad({ kind: 'sample', sampleId: 'iris' });
		expect($datasetLoad.get()).toMatchObject({ errorCode: null, errorStage: null });
		cancelDatasetLoad();
		expect(await second).toBe(false);
	});
});
