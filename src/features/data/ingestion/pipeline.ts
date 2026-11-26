import type { IDBPDatabase } from 'idb';
import { coerceCell } from '../../../common/storage/cells';
import {
	datasetRowRange,
	deleteDataset,
	putMetadata,
	type SamataDBSchema
} from '../../../common/storage/db';
import {
	DatasetProfiler,
	type ElectedColumn,
	type ProfileOptions
} from '../../../common/storage/profiler';
import type {
	BooleanColumnStats,
	CellValue,
	CategoricalColumnStats,
	ColumnStats,
	DatasetMetadata,
	DateColumnStats,
	DatetimeColumnStats,
	NumericColumnStats,
	RawRecord,
	TextColumnStats,
	TimeColumnStats
} from '../../../types/dataset';
import { isTemporalColumnType, type ColumnType } from '../../../types/state';
import { checkFileSize, checkStorageQuota, fetchWithRetry } from './fetch-source';
import { streamCsv } from './csv-stream';
import { uploadDatasetName } from './dataset-name';
import { IngestionError } from './errors';
import { PASS_BATCH_ROWS } from './limits';
import {
	addToDisplayHistogram,
	createDisplayHistogram,
	exactMedian,
	FineHistogram
} from './order-statistics';

/** A sample descriptor subset needed to load and validate its data file. */
export interface IngestionSampleDescriptor {
	id: string;
	name: string;
	missingValueTokens?: string[];
	columns: { name: string; dataType: ColumnType; implicitMissingValues?: (string | number)[] }[];
	stats: { sha256: string };
	files: { csv: string; csvOrigin: 'bundled' | 'remote' };
}

/** Source accepted by the ingestion pipeline. */
export type IngestionSource = { kind: 'sample'; sampleId: string } | { kind: 'file'; file: File };

/** Progress phases and counters emitted by a running ingestion. */
export interface IngestionProgress {
	phase: 'download' | 'parse' | 'typing' | 'statistics';
	bytesProcessed: number;
	totalBytes: number | null;
	rowsProcessed: number;
	totalRows: number | null;
	/** Numeric columns whose statistics are complete; populated only during `statistics`. */
	columnsProcessed?: number;
	/** Numeric columns with at least one value; populated only during `statistics`. */
	columnsTotal?: number;
}

/** Options and test seams for a single dataset ingestion. */
export interface RunIngestionOptions {
	db: IDBPDatabase<SamataDBSchema>;
	signal?: AbortSignal;
	onProgress?: (progress: IngestionProgress) => void;
	now?: () => number;
	uuid?: () => string;
	fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
	sleep?: (milliseconds: number) => Promise<void>;
	estimateStorage?: () => Promise<{ quota?: number; usage?: number }>;
}

/** Options and test seams for a validate-only pass (no IndexedDB access). */
export interface RunValidationOptions {
	signal?: AbortSignal;
	onProgress?: (progress: IngestionProgress) => void;
	now?: () => number;
	fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
	sleep?: (milliseconds: number) => Promise<void>;
	estimateStorage?: () => Promise<{ quota?: number; usage?: number }>;
}

/** Counts returned by a successful validate-only pass. */
export interface ValidationResult {
	rowCount: number;
	columnCount: number;
}

type ProgressUpdate = Partial<IngestionProgress> & Pick<IngestionProgress, 'phase'>;
type ProgressReporter = (update: ProgressUpdate, force?: boolean) => void;

interface ResolvedSource {
	blob: Blob;
	name: string;
	source: 'sample' | 'upload';
	sampleId: string | null;
	profileOptions: ProfileOptions;
	expectedHeader?: string[];
}

interface NumericAccumulator {
	count: number;
	min: number;
	max: number;
	mean: number;
	integer: boolean;
	fine: FineHistogram;
}

function cancelled(): IngestionError {
	return new IngestionError('CANCELLED', 'Dataset loading was cancelled.');
}

function throwIfCancelled(signal?: AbortSignal): void {
	if (signal?.aborted) throw cancelled();
}

function normaliseFailure(error: unknown, signal?: AbortSignal): Error {
	if (error instanceof IngestionError) return error;
	if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
		return cancelled();
	}
	if (error instanceof DOMException) {
		return new IngestionError(
			'STORAGE_FAILED',
			'Browser storage could not complete the ingestion.',
			{
				details: error
			}
		);
	}
	return new IngestionError('UNKNOWN', 'The dataset could not be loaded.', { details: error });
}

async function resolveSource(
	source: IngestionSource,
	options: Pick<RunIngestionOptions, 'signal' | 'fetchImpl' | 'sleep'>,
	report: ProgressReporter
): Promise<ResolvedSource> {
	if (source.kind === 'file') {
		return {
			blob: source.file,
			name: uploadDatasetName(source.file.name),
			source: 'upload',
			sampleId: null,
			profileOptions: {}
		};
	}

	report({
		phase: 'download',
		bytesProcessed: 0,
		totalBytes: null,
		rowsProcessed: 0,
		totalRows: null
	});
	let descriptorBlob: Blob;
	try {
		descriptorBlob = await fetchWithRetry(
			`/datasets/${encodeURIComponent(source.sampleId)}/descriptor.json`,
			{
				signal: options.signal,
				fetchImpl: options.fetchImpl,
				sleep: options.sleep
			}
		);
	} catch (error) {
		if (
			error instanceof IngestionError &&
			error.code === 'HTTP_ERROR' &&
			error.status === 404
		) {
			throw new IngestionError(
				'SAMPLE_NOT_FOUND',
				'The selected sample dataset could not be found.'
			);
		}
		throw error;
	}

	let descriptor: IngestionSampleDescriptor;
	try {
		descriptor = JSON.parse(await descriptorBlob.text()) as IngestionSampleDescriptor;
	} catch (error) {
		throw new IngestionError('READ_FAILED', 'The sample descriptor is not valid JSON.', {
			details: error
		});
	}
	if (
		descriptor.id !== source.sampleId ||
		!descriptor.name ||
		!Array.isArray(descriptor.columns) ||
		!descriptor.files?.csv ||
		!descriptor.files.csvOrigin ||
		!descriptor.stats?.sha256
	) {
		throw new IngestionError('READ_FAILED', 'The sample descriptor is incomplete.');
	}

	const overrides = Object.fromEntries(
		descriptor.columns.map((column) => [column.name, column.dataType])
	);
	const implicitMissing = Object.fromEntries(
		descriptor.columns
			.filter((column) => column.implicitMissingValues?.length)
			.map((column) => [column.name, column.implicitMissingValues!])
	);
	const blob = await fetchWithRetry(descriptor.files.csv, {
		request:
			descriptor.files.csvOrigin === 'remote'
				? { credentials: 'omit', referrerPolicy: 'no-referrer' }
				: undefined,
		signal: options.signal,
		fetchImpl: options.fetchImpl,
		sleep: options.sleep
	});
	if (descriptor.files.csvOrigin === 'remote') {
		const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
		const actualHash = Array.from(new Uint8Array(digest), (byte) =>
			byte.toString(16).padStart(2, '0')
		).join('');
		if (actualHash !== descriptor.stats.sha256)
			throw new IngestionError(
				'DESCRIPTOR_MISMATCH',
				'The remote sample CSV does not match its descriptor.'
			);
	}
	return {
		blob,
		name: descriptor.name,
		source: 'sample',
		sampleId: source.sampleId,
		profileOptions: {
			missingValueTokens: descriptor.missingValueTokens,
			overrides,
			implicitMissing
		},
		expectedHeader: descriptor.columns.map((column) => column.name)
	};
}

function makeColumnStats(elected: ElectedColumn): ColumnStats {
	const shared = {
		name: elected.name,
		type: elected.type,
		missingCount: elected.missingCount,
		missingTokens: elected.missingTokens,
		invalidCount: elected.invalidCount,
		invalidExamples: elected.invalidExamples
	};
	switch (elected.type) {
		case 'numeric':
			return {
				...shared,
				type: 'numeric',
				count: 0,
				min: 0,
				max: 0,
				mean: 0,
				median: 0,
				integer: true,
				identifierHint: elected.identifierHint,
				format: (elected.format as NumericColumnStats['format'] | null) ?? {
					prefix: '',
					suffix: '',
					thousandsSeparator: false
				},
				histogram: { start: 0, width: 1, counts: [] }
			};
		case 'categorical':
			return {
				...shared,
				type: 'categorical',
				distinctCount: 0,
				categoryCounts: Object.create(null) as Record<string, number>
			};
		case 'boolean':
			return {
				...shared,
				type: 'boolean',
				trueCount: 0,
				falseCount: 0,
				lexicon: elected.lexicon ?? ['true', 'false']
			};
		case 'datetime':
			return {
				...shared,
				type: 'datetime',
				count: 0,
				min: 0,
				max: 0,
				format: (elected.format as DatetimeColumnStats['format'] | null) ?? {
					kind: 'date',
					order: 'ISO',
					orderAssumed: false
				}
			};
		case 'date':
			return {
				...shared,
				type: 'date',
				count: 0,
				min: 0,
				max: 0,
				format: (elected.format as DateColumnStats['format'] | null) ?? {
					kind: 'date',
					order: 'ISO',
					orderAssumed: false
				}
			};
		case 'time':
			return { ...shared, type: 'time', count: 0, min: 0, max: 0, precision: 'minute' };
		case 'text':
			return {
				...shared,
				type: 'text',
				distinctCount: elected.distinctCount,
				identifierHint: elected.identifierHint
			};
	}
}

function incrementNumeric(stats: NumericColumnStats, value: number): void {
	stats.count++;
	stats.min = stats.count === 1 ? value : Math.min(stats.min, value);
	stats.max = stats.count === 1 ? value : Math.max(stats.max, value);
	stats.mean += (value - stats.mean) / stats.count;
	stats.integer &&= Number.isInteger(value);
}

async function writeRawRows(db: IDBPDatabase<SamataDBSchema>, records: RawRecord[]): Promise<void> {
	if (records.length === 0) return;
	const tx = db.transaction('raw_records', 'readwrite');
	try {
		await Promise.all(records.map((record) => tx.store.put(record)));
		await tx.done;
	} catch (error) {
		await tx.done.catch(() => undefined);
		throw error;
	}
}

async function scanNumericColumn(
	db: IDBPDatabase<SamataDBSchema>,
	datasetId: string,
	columnIndex: number,
	visit: (value: number) => void,
	signal?: AbortSignal,
	onRows?: (rows: number) => void
): Promise<void> {
	const tx = db.transaction('raw_records', 'readonly');
	let cursor = await tx.store.openCursor(datasetRowRange(datasetId));
	let rows = 0;
	try {
		while (cursor) {
			rows++;
			if (rows % 1000 === 0) {
				throwIfCancelled(signal);
				onRows?.(rows);
			}
			const value = cursor.value.values[columnIndex];
			if (typeof value === 'number') visit(value);
			cursor = await cursor.continue();
		}
		await tx.done;
	} catch (error) {
		await tx.done.catch(() => undefined);
		throw error;
	}
}

function createReporter(
	now: () => number,
	onProgress?: (progress: IngestionProgress) => void
): ProgressReporter {
	let progress: IngestionProgress = {
		phase: 'download',
		bytesProcessed: 0,
		totalBytes: null,
		rowsProcessed: 0,
		totalRows: null
	};
	let lastProgressAt = -Infinity;
	return (update, force = false) => {
		const next = { ...progress, ...update };
		const phaseChanged = next.phase !== progress.phase;
		const currentTime = now();
		progress = next;
		if (force || phaseChanged || currentTime - lastProgressAt >= 100) {
			lastProgressAt = currentTime;
			onProgress?.({ ...progress });
		}
	};
}

interface ParsedSource {
	profiler: DatasetProfiler;
	delimiter: string;
}

/**
 * Streams and profiles the CSV. With a `db` each kept row is written to `raw_records`; without
 * one (validation) nothing is stored.
 */
async function parseAndProfile(
	resolved: ResolvedSource,
	byteLength: number,
	datasetId: string | null,
	db: IDBPDatabase<SamataDBSchema> | null,
	signal: AbortSignal | undefined,
	report: ProgressReporter
): Promise<ParsedSource> {
	let profiler: DatasetProfiler | undefined;
	let rowsParsed = 0;
	let delimiter = ',';
	report({
		phase: 'parse',
		bytesProcessed: 0,
		totalBytes: byteLength,
		rowsProcessed: 0,
		totalRows: null
	});
	await streamCsv(
		resolved.blob,
		{
			onBytes: (bytes) => report({ phase: 'parse', totalBytes: bytes }),
			onChunkProcessed: (bytesProcessed) => report({ phase: 'parse', bytesProcessed }),
			onDelimiter: (value) => {
				delimiter = value;
			},
			onHeader: (rawHeader) => {
				profiler = new DatasetProfiler(rawHeader, resolved.profileOptions);
				if (
					resolved.expectedHeader &&
					(profiler.header.length !== resolved.expectedHeader.length ||
						profiler.header.some(
							(name, index) => name !== resolved.expectedHeader![index]
						))
				) {
					throw new IngestionError(
						'DESCRIPTOR_MISMATCH',
						'The sample CSV header does not match its descriptor.'
					);
				}
			},
			onRows: async (rows, quoteErrors) => {
				throwIfCancelled(signal);
				if (!profiler) throw new IngestionError('EMPTY_FILE', 'The CSV has no header row.');
				const quoteErrorRows = new Set(quoteErrors);
				const records: RawRecord[] = [];
				for (let index = 0; index < rows.length; index++) {
					const row = rows[index]!;
					const rowNumber = rowsParsed + index + 1;
					const result = quoteErrorRows.has(rowNumber)
						? profiler.addRow([...row, '__quote_error__'])
						: profiler.addRow(row);
					if (result.kept && datasetId) {
						records.push({
							datasetId,
							rowIndex: profiler.rowCount - 1,
							values: result.values as CellValue[]
						});
					}
				}
				rowsParsed += rows.length;
				if (db) await writeRawRows(db, records);
				report({ phase: 'parse', rowsProcessed: rowsParsed });
			}
		},
		signal
	);
	if (!profiler) throw new IngestionError('EMPTY_FILE', 'The CSV has no header row.');
	if (profiler.rowCount === 0) {
		throw new IngestionError('NO_DATA_ROWS', 'The CSV has no usable data rows.');
	}
	report({ phase: 'parse', bytesProcessed: byteLength, rowsProcessed: rowsParsed }, true);
	return { profiler, delimiter };
}

/**
 * Validates a source without writing to IndexedDB: size and quota checks, then the full parse,
 * profile and type election. Raises the same error codes as {@link runIngestion} for those steps.
 */
export async function runValidation(
	source: IngestionSource,
	options: RunValidationOptions = {}
): Promise<ValidationResult> {
	const report = createReporter(options.now ?? Date.now, options.onProgress);
	try {
		throwIfCancelled(options.signal);
		const resolved = await resolveSource(source, options, report);
		const byteLength = resolved.blob.size;
		checkFileSize(byteLength);
		await checkStorageQuota(byteLength, options.estimateStorage);
		throwIfCancelled(options.signal);
		const { profiler } = await parseAndProfile(
			resolved,
			byteLength,
			null,
			null,
			options.signal,
			report
		);
		const elected = profiler.elect();
		throwIfCancelled(options.signal);
		return { rowCount: profiler.rowCount, columnCount: elected.length };
	} catch (error) {
		throw normaliseFailure(error, options.signal);
	}
}

/** Runs the complete lossless, typed, and statistics passes for one dataset source. */
export async function runIngestion(
	source: IngestionSource,
	options: RunIngestionOptions
): Promise<DatasetMetadata> {
	const now = options.now ?? Date.now;
	const uuid = options.uuid ?? (() => crypto.randomUUID());
	const report = createReporter(now, options.onProgress);

	let datasetId: string | undefined;
	try {
		throwIfCancelled(options.signal);
		const resolved = await resolveSource(source, options, report);
		const byteLength = resolved.blob.size;
		checkFileSize(byteLength);
		await checkStorageQuota(byteLength, options.estimateStorage);
		throwIfCancelled(options.signal);
		datasetId = uuid();
		const { profiler, delimiter } = await parseAndProfile(
			resolved,
			byteLength,
			datasetId,
			options.db,
			options.signal,
			report
		);

		const elected = profiler.elect();
		const columns = elected.map(makeColumnStats);
		const numericAccumulators = new Map<number, NumericAccumulator>();
		const precisionFlags = new Map<number, { millisecond: boolean; second: boolean }>();
		for (let index = 0; index < columns.length; index++) {
			const stats = columns[index]!;
			if (stats.type === 'time' || stats.type === 'datetime') {
				precisionFlags.set(index, { millisecond: false, second: false });
			}
			if (stats.type === 'numeric') {
				const range = elected[index]!.supersetRange;
				const min = range.min ?? 0;
				const max = range.max ?? min;
				numericAccumulators.set(index, {
					count: 0,
					min: 0,
					max: 0,
					mean: 0,
					integer: true,
					fine: new FineHistogram(min, max)
				});
			}
		}

		report({
			phase: 'typing',
			bytesProcessed: byteLength,
			rowsProcessed: 0,
			totalRows: profiler.rowCount
		});
		let offset = 0;
		let processedRows = 0;
		while (offset < profiler.rowCount) {
			throwIfCancelled(options.signal);
			const tx = options.db.transaction('raw_records', 'readwrite');
			let records: RawRecord[];
			try {
				records = await tx.store.getAll(
					datasetRowRange(datasetId, offset),
					PASS_BATCH_ROWS
				);
				for (const record of records) {
					const typedValues: CellValue[] = [];
					for (let columnIndex = 0; columnIndex < elected.length; columnIndex++) {
						const raw = record.values[columnIndex];
						const column = elected[columnIndex]!;
						if (raw === null || typeof raw !== 'string') {
							typedValues.push(raw ?? null);
							continue;
						}
						const format =
							column.type === 'boolean'
								? (column.lexicon ?? undefined)
								: (column.format ?? undefined);
						const value = coerceCell(raw, column.type, format);
						typedValues.push(value);
						if (value === null) continue;
						const stats = columns[columnIndex]!;
						if (stats.type === 'numeric' && typeof value === 'number') {
							incrementNumeric(stats, value);
							numericAccumulators.get(columnIndex)!.fine.add(value);
						} else if (stats.type === 'boolean' && typeof value === 'boolean') {
							if (value) stats.trueCount++;
							else stats.falseCount++;
						} else if (isTemporalColumnType(stats.type) && typeof value === 'number') {
							const temporal = stats as
								| DateColumnStats
								| TimeColumnStats
								| DatetimeColumnStats;
							const flags = precisionFlags.get(columnIndex);
							if (flags) {
								if (value % 1000 !== 0) flags.millisecond = true;
								if (value % 60_000 !== 0) flags.second = true;
							}
							temporal.count++;
							temporal.min =
								temporal.count === 1 ? value : Math.min(temporal.min, value);
							temporal.max =
								temporal.count === 1 ? value : Math.max(temporal.max, value);
						} else if (stats.type === 'categorical' && typeof value === 'string') {
							stats.categoryCounts[value] = (stats.categoryCounts[value] ?? 0) + 1;
						}
					}
					record.values = typedValues;
					await tx.store.put(record);
					processedRows++;
				}
				await tx.done;
			} catch (error) {
				await tx.done.catch(() => undefined);
				throw error;
			}
			if (records.length === 0) break;
			offset += records.length;
			report(
				{ phase: 'typing', rowsProcessed: processedRows, totalRows: profiler.rowCount },
				offset >= profiler.rowCount
			);
		}

		for (const stats of columns) {
			if (stats.type === 'categorical')
				stats.distinctCount = Object.keys(stats.categoryCounts).length;
		}
		for (const [columnIndex, flags] of precisionFlags) {
			const stats = columns[columnIndex] as TimeColumnStats | DatetimeColumnStats;
			stats.precision = flags.millisecond
				? 'millisecond'
				: flags.second
					? 'second'
					: 'minute';
		}
		const columnsTotal = columns.filter(
			(stats) => stats.type === 'numeric' && stats.count > 0
		).length;
		let columnsProcessed = 0;
		report({
			phase: 'statistics',
			bytesProcessed: byteLength,
			rowsProcessed: 0,
			totalRows: profiler.rowCount,
			columnsProcessed,
			columnsTotal
		});
		for (let columnIndex = 0; columnIndex < columns.length; columnIndex++) {
			const stats = columns[columnIndex]!;
			if (stats.type !== 'numeric' || stats.count === 0) continue;
			const display = createDisplayHistogram(
				stats.count,
				stats.min,
				stats.max,
				stats.integer
			);
			const scanValues = async (visit: (value: number) => void) => {
				await scanNumericColumn(
					options.db,
					datasetId!,
					columnIndex,
					visit,
					options.signal,
					(rows) =>
						report({
							phase: 'statistics',
							rowsProcessed: rows,
							totalRows: profiler.rowCount,
							columnsProcessed,
							columnsTotal
						})
				);
			};
			await scanNumericColumn(
				options.db,
				datasetId,
				columnIndex,
				(value) => addToDisplayHistogram(display, value),
				options.signal
			);
			stats.histogram = display;
			stats.median = await exactMedian(
				numericAccumulators.get(columnIndex)!.fine,
				scanValues
			);
			columnsProcessed++;
			report(
				{
					phase: 'statistics',
					rowsProcessed: profiler.rowCount,
					totalRows: profiler.rowCount,
					columnsProcessed,
					columnsTotal
				},
				columnsProcessed === columnsTotal
			);
		}

		throwIfCancelled(options.signal);
		const metadata: DatasetMetadata = {
			id: datasetId,
			name: resolved.name,
			source: resolved.source,
			sampleId: resolved.sampleId,
			rowCount: profiler.rowCount,
			byteLength,
			createdAt: now(),
			delimiter,
			columns,
			paddedRowCount: profiler.paddedRowCount,
			skippedRows: profiler.skippedRows
		};
		await putMetadata(options.db, metadata);
		return metadata;
	} catch (error) {
		if (datasetId) {
			try {
				await deleteDataset(options.db, datasetId);
			} catch {
				// Cleanup is best-effort; preserve the ingestion failure.
			}
		}
		throw normaliseFailure(error, options.signal);
	}
}
