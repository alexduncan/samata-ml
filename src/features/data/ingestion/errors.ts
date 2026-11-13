/** Machine-readable failures emitted by the dataset ingestion pipeline. */
export type IngestionErrorCode =
	| 'NETWORK_ERROR'
	| 'HTTP_ERROR'
	| 'FILE_TOO_LARGE'
	| 'TOO_MANY_COLUMNS'
	| 'INSUFFICIENT_STORAGE'
	| 'EMPTY_FILE'
	| 'NO_DATA_ROWS'
	| 'READ_FAILED'
	| 'SAMPLE_NOT_FOUND'
	| 'DESCRIPTOR_MISMATCH'
	| 'STORAGE_FAILED'
	| 'CANCELLED'
	| 'BUSY'
	| 'UNKNOWN';

/** An expected, user-displayable failure during dataset ingestion. */
export class IngestionError extends Error {
	/** Stable machine-readable error category. */
	readonly code: IngestionErrorCode;
	/** HTTP status for a failed response, when available. */
	readonly status?: number;
	/** Optional structured context for logs and diagnostics. */
	readonly details?: unknown;

	/** Creates a typed ingestion error. */
	constructor(
		code: IngestionErrorCode,
		message: string,
		options: { status?: number; details?: unknown } = {}
	) {
		super(message);
		this.name = 'IngestionError';
		this.code = code;
		if (options.status !== undefined) this.status = options.status;
		if (options.details !== undefined) this.details = options.details;
	}
}
