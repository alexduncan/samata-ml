import { MAX_FILE_BYTES, STORAGE_HEADROOM_FACTOR } from './limits';
import { IngestionError } from './errors';

/** Options for retryable same-origin source fetching. */
export interface FetchWithRetryOptions {
	/** Cancels fetch or body streaming. */
	signal?: AbortSignal;
	/** Injectable Fetch implementation, mainly for deterministic tests. */
	fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
	/** Injectable retry delay, mainly for deterministic tests. */
	sleep?: (milliseconds: number) => Promise<void>;
}

/** Storage quota values used by the preflight check. */
export interface StorageEstimate {
	quota?: number;
	usage?: number;
}

/** Checks a known file or response size against the ingestion limit. */
export function checkFileSize(size: number): void {
	if (!Number.isFinite(size) || size < 0) {
		throw new IngestionError('READ_FAILED', 'The source has an invalid size.');
	}
	if (size > MAX_FILE_BYTES) {
		throw new IngestionError('FILE_TOO_LARGE', 'The source exceeds the 200 MB limit.');
	}
}

function defaultStorageEstimate(): (() => Promise<StorageEstimate>) | undefined {
	if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return undefined;
	return navigator.storage.estimate.bind(navigator.storage);
}

/** Rejects an ingestion when available storage cannot provide the required headroom. */
export async function checkStorageQuota(
	fileBytes: number,
	estimate: (() => Promise<StorageEstimate>) | undefined = defaultStorageEstimate()
): Promise<void> {
	if (!estimate) return;
	const storage = await estimate();
	if (storage.quota === undefined || storage.usage === undefined) return;
	if (storage.quota - storage.usage < STORAGE_HEADROOM_FACTOR * fileBytes) {
		throw new IngestionError(
			'INSUFFICIENT_STORAGE',
			'There is not enough browser storage available for this dataset.'
		);
	}
}

function sourceUrl(url: string | URL): URL {
	const base = typeof self !== 'undefined' ? self.location.href : 'http://localhost/';
	return new URL(url, base);
}

function isAbort(error: unknown, signal?: AbortSignal): boolean {
	return (
		signal?.aborted === true || (error instanceof DOMException && error.name === 'AbortError')
	);
}

function abortError(): IngestionError {
	return new IngestionError('CANCELLED', 'Dataset loading was cancelled.');
}

async function readResponseBody(response: Response, signal?: AbortSignal): Promise<Blob> {
	const contentLength = response.headers.get('content-length');
	if (contentLength !== null && /^\d+$/.test(contentLength)) checkFileSize(Number(contentLength));
	if (!response.body) {
		const blob = await response.blob();
		checkFileSize(blob.size);
		return blob;
	}

	const reader = response.body.getReader();
	const chunks: ArrayBuffer[] = [];
	let bytesRead = 0;
	try {
		while (true) {
			if (signal?.aborted) throw abortError();
			const { done, value } = await reader.read();
			if (done) break;
			bytesRead += value.byteLength;
			checkFileSize(bytesRead);
			chunks.push(
				value.buffer.slice(
					value.byteOffset,
					value.byteOffset + value.byteLength
				) as ArrayBuffer
			);
		}
	} catch (error) {
		await reader.cancel().catch(() => undefined);
		if (error instanceof IngestionError) throw error;
		if (isAbort(error, signal)) throw abortError();
		throw error;
	}
	return new Blob(chunks, { type: response.headers.get('content-type') ?? '' });
}

/** Fetches a URL with bounded retries and returns its size-checked response body. */
export async function fetchWithRetry(
	url: string | URL,
	options: FetchWithRetryOptions = {}
): Promise<Blob> {
	const fetchImpl = options.fetchImpl ?? fetch;
	const sleep =
		options.sleep ??
		((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
	const resolvedUrl = sourceUrl(url);
	let lastError: unknown;

	for (let attempt = 0; attempt < 3; attempt++) {
		if (options.signal?.aborted) throw abortError();
		let response: Response;
		try {
			response = await fetchImpl(resolvedUrl, { signal: options.signal });
		} catch (error) {
			if (isAbort(error, options.signal)) throw abortError();
			if (!(error instanceof TypeError)) {
				throw new IngestionError('NETWORK_ERROR', 'The source could not be read.', {
					details: error
				});
			}
			lastError = error;
			if (attempt < 2) {
				await sleep(attempt === 0 ? 500 : 1000);
				continue;
			}
			throw new IngestionError('NETWORK_ERROR', 'The source could not be reached.', {
				details: error
			});
		}

		if (response.ok) {
			try {
				return await readResponseBody(response, options.signal);
			} catch (error) {
				if (error instanceof IngestionError || isAbort(error, options.signal)) {
					if (isAbort(error, options.signal) && !(error instanceof IngestionError))
						throw abortError();
					throw error;
				}
				if (error instanceof TypeError && attempt < 2) {
					lastError = error;
					await sleep(attempt === 0 ? 500 : 1000);
					continue;
				}
				throw new IngestionError('READ_FAILED', 'The source response could not be read.', {
					details: error
				});
			}
		}

		if (response.status >= 500 && attempt < 2) {
			await sleep(attempt === 0 ? 500 : 1000);
			continue;
		}
		throw new IngestionError('HTTP_ERROR', `The source returned HTTP ${response.status}.`, {
			status: response.status
		});
	}

	throw new IngestionError('NETWORK_ERROR', 'The source could not be reached.', {
		details: lastError
	});
}
