import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { $appState } from '../src/stores/app.store';
import { INITIAL_APP_STATE } from '../src/types/state';
import type { DatasetMetadata } from '../src/types/dataset';
import { openSamataDb } from '../src/common/storage/db';
import { IngestionError } from '../src/features/data/ingestion/errors';
import { loadDataset } from '../src/features/data/load-dataset';
import {
	createStorageClient,
	type StorageClient
} from '../src/features/data/ingestion/storage-client';
import {
	installWorkerHandler,
	type WorkerHandlerOptions
} from '../src/features/data/ingestion/worker-handler';
import { installFakeIndexedDB } from './helpers/fake-indexeddb';

let restore: (() => void) | undefined;
let db: Awaited<ReturnType<typeof openSamataDb>> | undefined;
let blobDescriptor: PropertyDescriptor | undefined;
let clients: StorageClient[] = [];
let cleanups: (() => void)[] = [];

class InMemoryPort extends EventTarget {
	peer: InMemoryPort | undefined;
	closed = false;

	postMessage(message: unknown): void {
		if (this.closed || !this.peer || this.peer.closed) return;
		const event = new Event('message');
		Object.defineProperty(event, 'data', { value: message });
		queueMicrotask(() => this.peer?.dispatchEvent(event));
	}

	start(): void {}

	close(): void {
		this.closed = true;
	}
}

function createMemoryPortPair(): [InMemoryPort, InMemoryPort] {
	const first = new InMemoryPort();
	const second = new InMemoryPort();
	first.peer = second;
	second.peer = first;
	return [first, second];
}

function file(source: string, name = 'worker-test.csv'): File {
	return new window.File([source], name, { type: 'text/csv' }) as unknown as File;
}

function connectWorker(options: WorkerHandlerOptions = {}): StorageClient {
	const [clientPort, workerPort] = createMemoryPortPair();
	const cleanup = installWorkerHandler(workerPort, options);
	const client = createStorageClient(clientPort as unknown as MessagePort);
	clients.push(client);
	cleanups.push(cleanup);
	return client;
}

function metadata(id: string, sampleId: string | null = null): DatasetMetadata {
	return {
		id,
		name: id,
		source: sampleId ? 'sample' : 'upload',
		sampleId,
		rowCount: 3,
		byteLength: 12,
		createdAt: 123,
		delimiter: ',',
		columns: [
			{
				name: 'value',
				type: 'numeric',
				missingCount: 0,
				missingTokens: {},
				invalidCount: 0,
				invalidExamples: [],
				count: 3,
				min: 1,
				max: 3,
				mean: 2,
				median: 2,
				integer: true,
				identifierHint: false,
				format: { prefix: '', suffix: '', thousandsSeparator: false },
				histogram: { start: 0.5, width: 1, counts: [1, 1, 1] }
			}
		],
		paddedRowCount: 0,
		skippedRows: { count: 0, rowNumbers: [] }
	};
}

beforeEach(async () => {
	blobDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'Blob');
	Object.defineProperty(globalThis, 'Blob', {
		configurable: true,
		writable: true,
		value: window.Blob
	});
	restore = installFakeIndexedDB();
	db = await openSamataDb();
	$appState.set(INITIAL_APP_STATE);
});

afterEach(() => {
	for (const client of clients) client.dispose();
	for (const cleanup of cleanups) cleanup();
	clients = [];
	cleanups = [];
	db?.close();
	db = undefined;
	restore?.();
	restore = undefined;
	if (blobDescriptor) Object.defineProperty(globalThis, 'Blob', blobDescriptor);
	else Reflect.deleteProperty(globalThis, 'Blob');
	blobDescriptor = undefined;
	$appState.set(INITIAL_APP_STATE);
});

describe('storage worker client and dataset service', () => {
	it('ingests through an in-memory port pair, reports phases, and pages typed rows', async () => {
		const client = connectWorker();
		const phases: string[] = [];
		const result = await client.ingest(
			{ kind: 'file', file: file('value\n1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n') },
			{ onProgress: ({ phase }) => phases.push(phase) }
		);
		expect(phases).toContain('parse');
		expect(phases).toContain('typing');
		expect(phases).toContain('statistics');
		expect((await client.fetchRows(result.id, 0, 5)).map((row) => row.values)).toEqual([
			[1],
			[2],
			[3],
			[4],
			[5]
		]);
		expect((await client.fetchRows(result.id, 8, 5)).map((row) => row.values)).toEqual([
			[9],
			[10]
		]);
		expect(await client.fetchRows('unknown', 0, 5)).toEqual([]);
		expect((await client.getMetadata(result.id))?.rowCount).toBe(10);
		expect(await client.getMetadata('unknown')).toBeNull();
	});

	it('returns BUSY for a second request, then cancels the active request', async () => {
		let markStarted!: () => void;
		const started = new Promise<void>((resolve) => {
			markStarted = resolve;
		});
		const handler = connectWorker({
			ingest: async (_source, options) => {
				markStarted();
				await new Promise<void>((resolve) => {
					options.signal?.addEventListener('abort', () => resolve(), { once: true });
				});
				throw new IngestionError('CANCELLED', 'Dataset loading was cancelled.');
			}
		});
		const controller = new AbortController();
		const first = handler.ingest(
			{ kind: 'file', file: file('value\n1\n') },
			{ signal: controller.signal }
		);
		await started;
		await expect(
			handler.ingest({ kind: 'file', file: file('value\n2\n') })
		).rejects.toMatchObject({ code: 'BUSY' });
		controller.abort();
		await expect(first).rejects.toMatchObject({ code: 'CANCELLED' });
	});

	it('aborts a real ingestion through the protocol and leaves no partial rows', async () => {
		const client = connectWorker();
		const controller = new AbortController();
		await expect(
			client.ingest(
				{
					kind: 'file',
					file: file(
						['value', ...Array.from({ length: 40 }, (_, index) => index + 1)].join('\n')
					)
				},
				{
					signal: controller.signal,
					onProgress: ({ phase }) => {
						if (phase === 'typing') controller.abort();
					}
				}
			)
		).rejects.toMatchObject({ code: 'CANCELLED' });
		expect(await db!.getAll('metadata')).toEqual([]);
		expect(await db!.getAll('raw_records')).toEqual([]);
	});

	it('holds and releases the cross-tab ingestion lock around the complete run', async () => {
		const client = connectWorker();
		let checkHeld!: (held: boolean) => void;
		const heldPromise = new Promise<boolean>((resolve) => {
			checkHeld = resolve;
		});
		await client.ingest(
			{ kind: 'file', file: file('value\n1\n2\n') },
			{
				onProgress: ({ phase }) => {
					if (phase === 'parse') {
						void navigator.locks
							.query()
							.then(({ held }) =>
								checkHeld(
									held?.some((lock) => lock.name === 'samata-ml:ingestion') ??
										false
								)
							);
					}
				}
			}
		);
		expect(await heldPromise).toBe(true);
		expect((await navigator.locks.query()).held).toEqual([]);
	});

	it('updates state after success, carries sample IDs, and removes older datasets', async () => {
		await db!.put('metadata', metadata('old'));
		await db!.put('raw_records', { datasetId: 'old', rowIndex: 0, values: [99] });
		const client = connectWorker();
		const summary = await loadDataset(
			{ kind: 'file', file: file('value\n1\n2\n3\n') },
			{ client }
		);
		expect($appState.get().dataset).toEqual(summary);
		expect($appState.get().data.mode).toBe('preview');
		expect(await db!.get('metadata', 'old')).toBeUndefined();
		expect((await client.fetchRows(summary.id, 0, 10)).map((row) => row.values)).toEqual([
			[1],
			[2],
			[3]
		]);

		const sampleClient = {
			ingest: async () => metadata('sample-loaded', 'penguins'),
			getMetadata: async () => null,
			fetchRows: async () => [],
			deleteDatasetsExcept: async () => undefined,
			dispose: () => undefined
		} satisfies StorageClient;
		const sampleSummary = await loadDataset(
			{ kind: 'sample', sampleId: 'penguins' },
			{ client: sampleClient }
		);
		expect(sampleSummary.sampleId).toBe('penguins');
		expect($appState.get().dataset?.sampleId).toBe('penguins');
	});

	it('leaves the prior application state untouched when ingestion fails', async () => {
		const prior = {
			...INITIAL_APP_STATE,
			dataset: {
				id: 'prior',
				name: 'Prior',
				source: 'upload' as const,
				rowCount: 1,
				columns: []
			}
		};
		$appState.set(prior);
		await db!.put('metadata', metadata('prior'));
		await db!.put('raw_records', { datasetId: 'prior', rowIndex: 0, values: [42] });
		const client = {
			ingest: async () => {
				throw new IngestionError('READ_FAILED', 'broken CSV');
			},
			getMetadata: async () => null,
			fetchRows: async () => [],
			deleteDatasetsExcept: async () => undefined,
			dispose: () => undefined
		} satisfies StorageClient;
		await expect(
			loadDataset({ kind: 'file', file: file('broken') }, { client })
		).rejects.toMatchObject({ code: 'READ_FAILED' });
		expect($appState.get()).toEqual(prior);
		expect(await db!.get('metadata', 'prior')).toEqual(metadata('prior'));
		expect(await db!.get('raw_records', ['prior', 0])).toEqual({
			datasetId: 'prior',
			rowIndex: 0,
			values: [42]
		});
	});

	it('keeps worker and shared storage modules independent of UI frameworks and stores', async () => {
		const roots = [
			path.resolve('src/features/data/ingestion'),
			path.resolve('src/common/storage')
		];
		const files: string[] = [];
		const walk = async (directory: string) => {
			for (const entry of await readdir(directory, { withFileTypes: true })) {
				const entryPath = path.join(directory, entry.name);
				if (entry.isDirectory()) await walk(entryPath);
				else if (entry.name.endsWith('.ts')) files.push(entryPath);
			}
		};
		for (const root of roots) await walk(root);
		for (const filePath of files) {
			const contents = await readFile(filePath, 'utf8');
			expect(contents).not.toMatch(/from\s+['"](?:lit|nanostores|[^'"]*\/stores\/)/);
		}
	});
});
