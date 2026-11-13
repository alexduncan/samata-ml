import type { IngestionErrorCode } from './errors';
import type { IngestionProgress, IngestionSource } from './pipeline';

/** Dataset source accepted by the worker's ingest request. */
export type IngestSource = IngestionSource;

/** Request sent from the application thread to the storage worker. */
export type StorageRequest =
	| { requestId: number; type: 'ingest'; source: IngestSource }
	| { requestId: number; type: 'cancel'; targetRequestId: number }
	| { requestId: number; type: 'getMetadata'; datasetId: string }
	| { requestId: number; type: 'getRows'; datasetId: string; offset: number; limit: number }
	| { requestId: number; type: 'deleteDatasetsExcept'; keepId: string | null };

/** Serializable ingestion error sent across the worker boundary. */
export interface SerializedIngestionError {
	code: IngestionErrorCode;
	message: string;
	status?: number;
	details?: unknown;
}

/** Response sent from the storage worker to the application thread. */
export type StorageResponse =
	| { requestId: number; type: 'progress'; progress: IngestionProgress }
	| { requestId: number; type: 'result'; value: unknown }
	| { requestId: number; type: 'error'; error: SerializedIngestionError };
