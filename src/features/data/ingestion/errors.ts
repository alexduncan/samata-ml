import { MAX_COLUMNS } from './limits';

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

/** User-displayable error strings mapped from machine-readable ingestion error codes. */
export const INGESTION_ERROR_MESSAGES: Record<IngestionErrorCode, string> = {
	NETWORK_ERROR: 'The dataset could not be downloaded. Check your connection and try again.',
	HTTP_ERROR: 'The dataset could not be downloaded. Check your connection and try again.',
	FILE_TOO_LARGE: 'This file exceeds the supported size limit.',
	TOO_MANY_COLUMNS: `CSV files may contain at most ${MAX_COLUMNS} columns.`,
	INSUFFICIENT_STORAGE: 'There is not enough browser storage. Free space and try again.',
	EMPTY_FILE: 'This CSV is empty.',
	NO_DATA_ROWS: 'This CSV has no usable data rows.',
	READ_FAILED: 'This CSV could not be read. Check the file and try again.',
	SAMPLE_NOT_FOUND: 'This sample is unavailable or has changed. Reload and try again.',
	DESCRIPTOR_MISMATCH: 'This sample is unavailable or has changed. Reload and try again.',
	STORAGE_FAILED: 'The dataset could not be saved in browser storage.',
	BUSY: 'Another dataset is loading. Wait or cancel it.',
	CANCELLED: 'Loading cancelled',
	UNKNOWN: 'The dataset could not be loaded. Try again.'
};

/** User-displayable phase labels for progressive ingestion. */
export const INGESTION_PHASE_LABELS: Record<
	'download' | 'parse' | 'typing' | 'statistics',
	string
> = {
	download: 'Downloading dataset',
	parse: 'Reading CSV',
	typing: 'Detecting column types',
	statistics: 'Calculating statistics'
};
