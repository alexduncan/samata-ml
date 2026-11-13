import type { DatasetMetadata, RawRecord } from '../../../types/dataset';
import { IngestionError } from './errors';
import type { SerializedIngestionError, StorageRequest, StorageResponse } from './protocol';
import type { IngestionProgress, IngestionSource } from './pipeline';

/** Optional local callbacks for one ingestion request. */
export interface IngestOptions {
	signal?: AbortSignal;
	onProgress?: (progress: IngestionProgress) => void;
}

/** Public client methods backed by the storage worker. */
export interface StorageClient {
	ingest(source: IngestionSource, options?: IngestOptions): Promise<DatasetMetadata>;
	getMetadata(datasetId: string): Promise<DatasetMetadata | null>;
	fetchRows(datasetId: string, offset: number, limit: number): Promise<RawRecord[]>;
	deleteDatasetsExcept(keepId: string | null): Promise<void>;
	dispose(): void;
}

type ClientPort = Pick<Worker, 'postMessage' | 'addEventListener' | 'removeEventListener'> & {
	close?: () => void;
	terminate?: () => void;
	start?: () => void;
};

interface PendingRequest {
	resolve(value: unknown): void;
	reject(error: Error): void;
	onProgress?: (progress: IngestionProgress) => void;
	signal?: AbortSignal;
	onAbort?: () => void;
}

function deserialiseError(error: SerializedIngestionError): IngestionError {
	return new IngestionError(error.code, error.message, {
		status: error.status,
		details: error.details
	});
}

function makeCancelledError(): IngestionError {
	return new IngestionError('CANCELLED', 'Dataset loading was cancelled.');
}

class StorageClientImpl implements StorageClient {
	private nextRequestId = 1;
	private readonly pending = new Map<number, PendingRequest>();
	private disposed = false;
	private readonly onDispose?: () => void;
	private readonly onMessage: EventListener;

	constructor(
		private readonly port: ClientPort,
		onDispose?: () => void
	) {
		this.onDispose = onDispose;
		this.onMessage = (event) =>
			this.handleMessage((event as MessageEvent<StorageResponse>).data);
		this.port.addEventListener('message', this.onMessage);
		this.port.start?.();
	}

	ingest(source: IngestionSource, options: IngestOptions = {}): Promise<DatasetMetadata> {
		const requestId = this.nextRequestId++;
		return this.send<DatasetMetadata>(
			{ requestId, type: 'ingest', source },
			{ signal: options.signal, onProgress: options.onProgress }
		);
	}

	getMetadata(datasetId: string): Promise<DatasetMetadata | null> {
		return this.send({ requestId: this.nextRequestId++, type: 'getMetadata', datasetId });
	}

	fetchRows(datasetId: string, offset: number, limit: number): Promise<RawRecord[]> {
		return this.send({
			requestId: this.nextRequestId++,
			type: 'getRows',
			datasetId,
			offset,
			limit
		});
	}

	deleteDatasetsExcept(keepId: string | null): Promise<void> {
		return this.send({ requestId: this.nextRequestId++, type: 'deleteDatasetsExcept', keepId });
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.port.removeEventListener('message', this.onMessage);
		for (const [requestId, pending] of this.pending) {
			this.finish(requestId);
			pending.reject(makeCancelledError());
		}
		this.port.close?.();
		this.port.terminate?.();
		this.onDispose?.();
	}

	private send<T>(
		request: StorageRequest,
		options: Pick<IngestOptions, 'signal' | 'onProgress'> = {}
	): Promise<T> {
		if (this.disposed) return Promise.reject(makeCancelledError());
		if (options.signal?.aborted) return Promise.reject(makeCancelledError());
		return new Promise<T>((resolve, reject) => {
			const pending: PendingRequest = {
				resolve: (value) => resolve(value as T),
				reject,
				onProgress: options.onProgress,
				signal: options.signal
			};
			if (options.signal) {
				pending.onAbort = () => {
					try {
						this.port.postMessage({
							requestId: request.requestId,
							type: 'cancel',
							targetRequestId: request.requestId
						} satisfies StorageRequest);
					} catch {
						this.finish(request.requestId);
						pending.reject(makeCancelledError());
					}
				};
				options.signal.addEventListener('abort', pending.onAbort, { once: true });
			}
			this.pending.set(request.requestId, pending);
			try {
				this.port.postMessage(request);
			} catch (error) {
				this.finish(request.requestId);
				reject(
					error instanceof Error
						? error
						: new Error('The worker request could not be sent.')
				);
			}
		});
	}

	private handleMessage(response: StorageResponse): void {
		const pending = this.pending.get(response.requestId);
		if (!pending) return;
		if (response.type === 'progress') {
			try {
				pending.onProgress?.(response.progress);
			} catch {
				// Progress observers are separate from the worker operation result.
			}
			return;
		}
		this.finish(response.requestId);
		if (response.type === 'error') pending.reject(deserialiseError(response.error));
		else pending.resolve(response.value);
	}

	private finish(requestId: number): void {
		const pending = this.pending.get(requestId);
		if (!pending) return;
		if (pending.signal && pending.onAbort) {
			pending.signal.removeEventListener('abort', pending.onAbort);
		}
		this.pending.delete(requestId);
	}
}

/** Creates a correlated request client over a worker or MessagePort. */
export function createStorageClient(port: MessagePort | Worker): StorageClient {
	return new StorageClientImpl(port);
}

let singleton: StorageClientImpl | undefined;

/** Gets the lazily-created storage worker client for the current application tab. */
export function getStorageClient(): StorageClient {
	if (singleton) return singleton;
	let client!: StorageClientImpl;
	client = new StorageClientImpl(new Worker('/storage.worker.js', { type: 'module' }), () => {
		if (singleton === client) singleton = undefined;
	});
	singleton = client;
	return client;
}
