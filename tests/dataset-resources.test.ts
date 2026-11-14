import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { $locale, $format, i18n } from '../src/i18n';
import { $appState, clearDataset } from '../src/stores/app.store';
import {
	$datasetLoad,
	$datasetResources,
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
import type { StorageClient } from '../src/features/data/ingestion/storage-client';
import { INITIAL_APP_STATE, type ModelRecord, type ModelStatus } from '../src/types/state';
import { resetSampleDatasetCache } from '../src/features/data/sample-datasets';

function createMockModel(num = 1, status: ModelStatus = 'draft'): ModelRecord {
	return {
		num,
		createdAt: Date.now(),
		modelId: 'logreg',
		modelOptions: {},
		hyperparameters: { mode: 'manual', values: {} },
		features: ['feature_1'],
		multiclass: 'native',
		trainingSetup: { type: 'k_fold_cv', folds: 5 },
		completedSteps: ['choose-model', 'select-features'],
		status,
		progress: null,
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
		expect(res.descriptor?.id).toBe('iris');
		expect(res.error).toBeNull();
	});

	it('treats missing descriptor as a non-fatal advisory while missing metadata is an error', async () => {
		const meta = createMockMetadata('ds-upload', null);

		const mockClient: StorageClient = {
			ingest: async () => meta,
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
	beforeEach(() => {
		$appState.set(structuredClone(INITIAL_APP_STATE));
		$datasetLoad.set({ busy: false, progress: null, errorCode: null });
		clearDatasetResources();
	});

	afterEach(() => {
		setStorageClientForTesting(null);
		$datasetLoad.set({ busy: false, progress: null, errorCode: null });
		clearDatasetResources();
		$appState.set(structuredClone(INITIAL_APP_STATE));
	});

	it('rejects changeDataset when any model is training or ingestion is busy', async () => {
		// Training model present
		$appState.set({
			...$appState.get(),
			models: [createMockModel(1, 'training')]
		});

		await expect(changeDataset()).rejects.toThrow('Cannot change dataset while training');

		// Ingestion busy
		$appState.set(structuredClone(INITIAL_APP_STATE));
		$datasetLoad.set({ busy: true, progress: null, errorCode: null });

		await expect(changeDataset()).rejects.toThrow('Cannot change dataset while training');
	});

	it('leaves app state intact if storage deletion fails', async () => {
		const priorState = {
			...$appState.get(),
			dataset: {
				id: 'ds-1',
				name: 'Iris',
				source: 'sample' as const,
				sampleId: 'iris',
				rowCount: 150,
				columns: [{ name: 'f1', type: 'numeric' as const, missingCount: 0 }]
			},
			target: 'species',
			models: [createMockModel(1, 'draft')]
		};
		$appState.set(priorState);

		const mockClient: StorageClient = {
			ingest: async () => createMockMetadata('ds-1'),
			getMetadata: async () => null,
			fetchRows: async () => [],
			deleteDatasetsExcept: async () => {
				throw new IngestionError('STORAGE_FAILED', 'Disk full');
			},
			dispose: () => {}
		};
		setStorageClientForTesting(mockClient);

		await expect(changeDataset()).rejects.toThrow();
		expect($appState.get()).toEqual(priorState);
	});

	it('successfully removes dataset, resets downstream state, preserves onboarding and non-data scroll', async () => {
		let deletedWithKeepId: string | null | undefined;
		const mockClient: StorageClient = {
			ingest: async () => createMockMetadata('ds-1'),
			getMetadata: async () => null,
			fetchRows: async () => [],
			deleteDatasetsExcept: async (keepId) => {
				deletedWithKeepId = keepId;
			},
			dispose: () => {}
		};
		setStorageClientForTesting(mockClient);

		$appState.set({
			...$appState.get(),
			onboarding: { welcomeDismissed: true },
			dataset: {
				id: 'ds-1',
				name: 'Iris',
				source: 'sample',
				sampleId: 'iris',
				rowCount: 150,
				columns: [{ name: 'f1', type: 'numeric', missingCount: 0 }]
			},
			data: { mode: 'preview', selectedColumn: 'f1' },
			target: 'species',
			models: [createMockModel(1, 'draft')],
			nextModelNum: 2
		});

		recordScroll('data:table', { top: 100, savedAt: Date.now(), viewportWidth: 1024 });
		recordScroll('models', { top: 200, savedAt: Date.now(), viewportWidth: 1024 });

		const result = await changeDataset();
		expect(result).toBe(true);
		expect(deletedWithKeepId).toBeNull();

		const state = $appState.get();
		expect(state.dataset).toBeNull();
		expect(state.data).toEqual({ mode: 'select', selectedColumn: null });
		expect(state.target).toBeNull();
		expect(state.models).toEqual([]);
		expect(state.nextModelNum).toBe(1);
		expect(state.onboarding.welcomeDismissed).toBe(true);

		// Check non-data scroll cleared while data:table preserved
		const snapshots = $scrollState.get().snapshots;
		expect(snapshots['data:table']).toBeDefined();
		expect(snapshots['models']).toBeUndefined();
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
			getMetadata: async () => null,
			fetchRows: async () => [],
			deleteDatasetsExcept: async () => {},
			dispose: () => {}
		};
		setStorageClientForTesting(mockClient);

		const fakeFile = new File(['a,b\n1,2'], 'data.csv', { type: 'text/csv' });
		const startPromise = startDatasetLoad({ kind: 'file', file: fakeFile });

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
});
