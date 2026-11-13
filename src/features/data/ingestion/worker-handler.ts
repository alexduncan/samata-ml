import {
	deleteDatasetsExcept,
	getMetadata,
	getRows,
	INGESTION_LOCK,
	openSamataDb
} from '../../../common/storage/db';
import { IngestionError } from './errors';
import type { SerializedIngestionError, StorageRequest, StorageResponse } from './protocol';
import { runIngestion, type IngestionSource } from './pipeline';
import type { DatasetMetadata } from '../../../types/dataset';
import type { IDBPDatabase } from 'idb';
import type { SamataDBSchema } from '../../../common/storage/db';

/** Minimal worker or message-port surface used by the storage request handler. */
export interface WorkerMessageEndpoint {
	addEventListener: EventTarget['addEventListener'];
	removeEventListener: EventTarget['removeEventListener'];
	postMessage(message: unknown): void;
	start?(): void;
}

/** Dependencies injectable by in-process protocol tests. */
export interface WorkerHandlerOptions {
	/** Opens a fresh application database connection for each operation. */
	openDatabase?: () => Promise<IDBPDatabase<SamataDBSchema>>;
	/** Runs ingestion for a request; defaults to the production pipeline. */
	ingest?: typeof runIngestion;
}

interface ActiveIngestion {
	requestId: number;
	controller: AbortController;
}

function serialiseError(error: unknown): SerializedIngestionError {
	if (error instanceof IngestionError) {
		return {
			code: error.code,
			message: error.message,
			...(error.status === undefined ? {} : { status: error.status }),
			...(error.details === undefined ? {} : { details: error.details })
		};
	}
	return {
		code: 'UNKNOWN',
		message: error instanceof Error ? error.message : 'The worker request failed.'
	};
}

function postResult(port: WorkerMessageEndpoint, requestId: number, value: unknown): void {
	port.postMessage({ requestId, type: 'result', value } satisfies StorageResponse);
}

function postError(port: WorkerMessageEndpoint, requestId: number, error: unknown): void {
	port.postMessage({
		requestId,
		type: 'error',
		error: serialiseError(error)
	} satisfies StorageResponse);
}

async function withDatabase<T>(
	openDatabase: () => Promise<IDBPDatabase<SamataDBSchema>>,
	operation: (db: IDBPDatabase<SamataDBSchema>) => Promise<T>
): Promise<T> {
	const db = await openDatabase();
	try {
		return await operation(db);
	} finally {
		db.close();
	}
}

/** Installs the storage worker request handler and returns a cleanup function. */
export function installWorkerHandler(
	port: WorkerMessageEndpoint,
	options: WorkerHandlerOptions = {}
): () => void {
	const openDatabase = options.openDatabase ?? openSamataDb;
	const ingest = options.ingest ?? runIngestion;
	let active: ActiveIngestion | undefined;
	let disposed = false;

	const handleRequest = async (request: StorageRequest): Promise<void> => {
		if (request.type === 'cancel') {
			if (active?.requestId === request.targetRequestId) active.controller.abort();
			return;
		}
		if (request.type === 'ingest') {
			if (active) {
				postError(
					port,
					request.requestId,
					new IngestionError('BUSY', 'Another dataset is loading.')
				);
				return;
			}
			const controller = new AbortController();
			active = { requestId: request.requestId, controller };
			const operation = async (): Promise<DatasetMetadata> =>
				withDatabase(openDatabase, (db) =>
					ingest(request.source as IngestionSource, {
						db,
						signal: controller.signal,
						onProgress: (progress) => {
							if (!disposed) {
								port.postMessage({
									requestId: request.requestId,
									type: 'progress',
									progress
								} satisfies StorageResponse);
							}
						}
					})
				);
			try {
				const lockManager = typeof navigator === 'undefined' ? undefined : navigator.locks;
				let metadata: DatasetMetadata;
				if (lockManager) {
					metadata = await lockManager.request(
						INGESTION_LOCK,
						{ ifAvailable: true },
						(lock) => {
							if (!lock)
								throw new IngestionError(
									'BUSY',
									'Another tab is loading a dataset.'
								);
							return operation();
						}
					);
				} else {
					metadata = await operation();
				}
				if (!disposed) postResult(port, request.requestId, metadata);
			} catch (error) {
				if (!disposed) postError(port, request.requestId, error);
			} finally {
				if (active?.requestId === request.requestId) active = undefined;
			}
			return;
		}

		try {
			const value = await withDatabase(openDatabase, async (db) => {
				switch (request.type) {
					case 'getMetadata':
						return (await getMetadata(db, request.datasetId)) ?? null;
					case 'getRows':
						return getRows(db, request.datasetId, request.offset, request.limit);
					case 'deleteDatasetsExcept':
						await deleteDatasetsExcept(db, request.keepId);
						return null;
				}
			});
			if (!disposed) postResult(port, request.requestId, value);
		} catch (error) {
			if (!disposed) postError(port, request.requestId, error);
		}
	};

	const onMessage: EventListener = (event) => {
		const request = (event as MessageEvent<StorageRequest>).data;
		void handleRequest(request);
	};
	port.addEventListener('message', onMessage);
	port.start?.();

	return () => {
		disposed = true;
		port.removeEventListener('message', onMessage);
		active?.controller.abort();
	};
}
