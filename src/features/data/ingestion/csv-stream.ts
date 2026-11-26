import Papa from 'papaparse';
import { MAX_COLUMNS, MAX_FILE_BYTES, PARSE_CHUNK_BYTES } from './limits';
import { IngestionError } from './errors';
import { checkFileSize } from './fetch-source';

/** Receives the header and sequential batches from a streamed CSV source. */
export interface CsvStreamHandlers {
	/** Receives the raw header cells once. */
	onHeader(cells: string[]): void;
	/** Receives raw rows and absolute one-based quote-error data-row numbers. */
	onRows(rows: string[][], quoteErrorRowNumbers: number[]): Promise<void>;
	/** Receives the source byte count once it is known. */
	onBytes?(bytes: number): void;
	/** Receives the approximate bytes consumed after each chunk's rows have been handled. */
	onChunkProcessed?(bytesProcessed: number): void;
	/** Receives PapaParse's detected delimiter once, when available. */
	onDelimiter?(delimiter: string): void;
}

function inputBytes(input: Blob | string): number {
	return typeof input === 'string' ? new TextEncoder().encode(input).byteLength : input.size;
}

function isAbort(error: unknown, signal?: AbortSignal): boolean {
	return (
		signal?.aborted === true || (error instanceof DOMException && error.name === 'AbortError')
	);
}

/** Parses a CSV in bounded PapaParse chunks while awaiting each consumer batch. */
export function streamCsv(
	input: Blob | string,
	handlers: CsvStreamHandlers,
	signal?: AbortSignal
): Promise<void> {
	return new Promise((resolve, reject) => {
		const totalBytes = inputBytes(input);
		let headerSeen = false;
		let finished = false;
		let dataRowsSeen = 0;
		let delimiterReported = false;
		let chunksSeen = 0;
		let parserRef: Papa.Parser | undefined;

		const fail = (error: unknown) => {
			if (finished) return;
			finished = true;
			signal?.removeEventListener('abort', onAbort);
			parserRef?.abort();
			if (error instanceof IngestionError) reject(error);
			else if (isAbort(error, signal))
				reject(new IngestionError('CANCELLED', 'CSV parsing was cancelled.'));
			else
				reject(
					new IngestionError('READ_FAILED', 'The CSV could not be parsed.', {
						details: error
					})
				);
		};
		const onAbort = () => fail(new IngestionError('CANCELLED', 'CSV parsing was cancelled.'));

		if (signal?.aborted) {
			fail(new IngestionError('CANCELLED', 'CSV parsing was cancelled.'));
			return;
		}
		signal?.addEventListener('abort', onAbort, { once: true });

		try {
			checkFileSize(totalBytes);
			handlers.onBytes?.(totalBytes);
		} catch (error) {
			fail(error);
			return;
		}

		Papa.parse<string[]>(input as File, {
			header: false,
			skipEmptyLines: 'greedy',
			delimiter: '',
			delimitersToGuess: [',', '\t', ';', '|'],
			dynamicTyping: false,
			encoding: 'utf-8',
			chunkSize: PARSE_CHUNK_BYTES,
			chunk: (result, parser) => {
				if (finished) return;
				parserRef = parser;
				parser.pause();
				if (!delimiterReported && result.meta.delimiter) {
					delimiterReported = true;
					try {
						handlers.onDelimiter?.(result.meta.delimiter);
					} catch (error) {
						fail(error);
						return;
					}
				}
				const rows = result.data;
				const errors = result.errors.filter((error) => error.type === 'Quotes');
				const headerOffset = headerSeen ? 0 : 1;
				let dataRows = rows;
				if (!headerSeen && rows.length > 0) {
					const header = rows[0]!.map((cell) => String(cell));
					if (header.length > MAX_COLUMNS) {
						fail(
							new IngestionError(
								'TOO_MANY_COLUMNS',
								`The CSV has more than ${MAX_COLUMNS} columns.`
							)
						);
						return;
					}
					headerSeen = true;
					try {
						handlers.onHeader(header);
					} catch (error) {
						fail(error);
						return;
					}
					dataRows = rows.slice(1);
				}
				const rowOffset = dataRowsSeen;
				const quoteErrorRowNumbers = errors
					.map((error) => error.row)
					.filter((row): row is number => typeof row === 'number' && row >= headerOffset)
					.map((row) => rowOffset + row - headerOffset + 1);
				dataRowsSeen += dataRows.length;

				void Promise.resolve()
					.then(() =>
						handlers.onRows(
							dataRows.map((row) => row.map((cell) => String(cell))),
							quoteErrorRowNumbers
						)
					)
					.then(() => {
						if (finished) return;
						chunksSeen++;
						handlers.onChunkProcessed?.(
							Math.min(totalBytes, chunksSeen * PARSE_CHUNK_BYTES)
						);
						if (signal?.aborted) {
							fail(new IngestionError('CANCELLED', 'CSV parsing was cancelled.'));
							return;
						}
						parser.resume();
					})
					.catch(fail);
			},
			complete: () => {
				if (finished) return;
				finished = true;
				signal?.removeEventListener('abort', onAbort);
				if (!headerSeen)
					reject(new IngestionError('EMPTY_FILE', 'The CSV has no header row.'));
				else resolve();
			},
			error: (error) => fail(error)
		});
	});
}
