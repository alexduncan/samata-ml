import type { ColumnType, DatasetSummary } from './state';

/** A stored cell after type inference and coercion. */
export type CellValue = number | boolean | string | null;

/** One row stored under a dataset and zero-based row index. */
export interface RawRecord {
	datasetId: string;
	rowIndex: number;
	values: CellValue[];
}

/** Shared statistics stored for every inferred column. */
export interface BaseColumnStats {
	name: string;
	type: ColumnType;
	missingCount: number;
	missingTokens: Record<string, number>;
	invalidCount: number;
	invalidExamples: string[];
}

/** Statistics and display metadata for a numeric column. */
export interface NumericColumnStats extends BaseColumnStats {
	type: 'numeric';
	count: number;
	min: number;
	max: number;
	mean: number;
	median: number;
	integer: boolean;
	identifierHint: boolean;
	format: {
		prefix: '' | '$' | '€' | '£';
		suffix: '' | '%';
		thousandsSeparator: boolean;
	};
	histogram: { start: number; width: number; counts: number[] };
}

/** Statistics for a categorical column. */
export interface CategoricalColumnStats extends BaseColumnStats {
	type: 'categorical';
	distinctCount: number;
	categoryCounts: Record<string, number>;
}

/** Statistics and the observed token pair for a boolean column. */
export interface BooleanColumnStats extends BaseColumnStats {
	type: 'boolean';
	trueCount: number;
	falseCount: number;
	lexicon: [string, string];
}

/** Finest non-zero unit in a column's stored values. */
export type TimePrecision = 'minute' | 'second' | 'millisecond';

/** Date-string format shared by date and datetime columns. */
export interface DateStringFormat {
	kind: 'date';
	order: 'ISO' | 'DMY' | 'MDY';
	orderAssumed: boolean;
}

/** Statistics and the detected format of a calendar-date column. */
export interface DateColumnStats extends BaseColumnStats {
	type: 'date';
	count: number;
	/** Earliest value, as epoch milliseconds at UTC midnight. */
	min: number;
	/** Latest value, as epoch milliseconds at UTC midnight. */
	max: number;
	format: DateStringFormat;
}

/** Statistics for a time-of-day column. */
export interface TimeColumnStats extends BaseColumnStats {
	type: 'time';
	count: number;
	/** Earliest value, as milliseconds since midnight. */
	min: number;
	/** Latest value, as milliseconds since midnight. */
	max: number;
	precision: TimePrecision;
}

/** Statistics and the detected representation of a datetime column. */
export interface DatetimeColumnStats extends BaseColumnStats {
	type: 'datetime';
	count: number;
	min: number;
	max: number;
	/** Absent only on metadata stored before the date and time types existed. */
	precision?: TimePrecision;
	format:
		| { kind: 'epoch'; unit: 's' | 'ms' | 'us' }
		| (DateStringFormat & {
				/** @deprecated Legacy stored metadata only; never written. */
				hasTime?: boolean;
		  });
}

/** Statistics and an optional identifier hint for a text column. */
export interface TextColumnStats extends BaseColumnStats {
	type: 'text';
	distinctCount: number | null;
	identifierHint: boolean;
}

/** Statistics for one inferred dataset column. */
export type ColumnStats =
	| NumericColumnStats
	| CategoricalColumnStats
	| BooleanColumnStats
	| DateColumnStats
	| TimeColumnStats
	| DatetimeColumnStats
	| TextColumnStats;

/** Complete ingestion metadata stored after all rows have been processed. */
export interface DatasetMetadata {
	id: string;
	name: string;
	source: 'sample' | 'upload';
	sampleId: string | null;
	rowCount: number;
	byteLength: number;
	createdAt: number;
	delimiter: string;
	columns: ColumnStats[];
	paddedRowCount: number;
	skippedRows: { count: number; rowNumbers: number[] };
}

/**
 * Converts complete ingestion metadata to the lightweight persisted application summary.
 *
 * Invalid values have already been stored as null, so they count as missing in the summary.
 *
 * @param meta - Complete metadata from a finished ingestion.
 * @returns A summary with no statistics or ingestion-only fields.
 */
export function toDatasetSummary(meta: DatasetMetadata): DatasetSummary {
	const summary: DatasetSummary = {
		id: meta.id,
		name: meta.name,
		source: meta.source,
		rowCount: meta.rowCount,
		columns: meta.columns.map((column) => ({
			name: column.name,
			type: column.type,
			missingCount: column.missingCount + column.invalidCount
		}))
	};

	if (meta.sampleId !== null) summary.sampleId = meta.sampleId;
	return summary;
}
