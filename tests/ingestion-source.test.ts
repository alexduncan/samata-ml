import { describe, expect, it } from 'bun:test';
import { MAX_COLUMNS, MAX_FILE_BYTES } from '../src/features/data/ingestion/limits';
import { IngestionError } from '../src/features/data/ingestion/errors';
import { streamCsv } from '../src/features/data/ingestion/csv-stream';
import {
	checkFileSize,
	checkStorageQuota,
	fetchWithRetry
} from '../src/features/data/ingestion/fetch-source';

describe('ingestion source helpers', () => {
	it('retries transient HTTP and network failures with the specified delays', async () => {
		let attempts = 0;
		const delays: number[] = [];
		const blob = await fetchWithRetry('/dataset.csv', {
			fetchImpl: async () => {
				attempts++;
				return attempts < 3 ? new Response('', { status: 503 }) : new Response('ok');
			},
			sleep: async (milliseconds) => {
				delays.push(milliseconds);
			}
		});
		expect(await blob.text()).toBe('ok');
		expect(attempts).toBe(3);
		expect(delays).toEqual([500, 1000]);

		attempts = 0;
		await expect(
			fetchWithRetry('/dataset.csv', {
				fetchImpl: async () => {
					attempts++;
					return new Response('', { status: 503 });
				},
				sleep: async () => undefined
			})
		).rejects.toMatchObject({ code: 'HTTP_ERROR', status: 503 });
		expect(attempts).toBe(3);

		attempts = 0;
		await expect(
			fetchWithRetry('/missing.csv', {
				fetchImpl: async () => {
					attempts++;
					return new Response('', { status: 404 });
				},
				sleep: async () => undefined
			})
		).rejects.toMatchObject({ code: 'HTTP_ERROR', status: 404 });
		expect(attempts).toBe(1);

		attempts = 0;
		const recovered = await fetchWithRetry('/dataset.csv', {
			fetchImpl: async () => {
				attempts++;
				if (attempts === 1) throw new TypeError('network unavailable');
				return new Response('recovered');
			},
			sleep: async () => undefined
		});
		expect(await recovered.text()).toBe('recovered');
		expect(attempts).toBe(2);
	});

	it('preserves privacy options on each retry', async () => {
		const requests: RequestInit[] = [];
		await fetchWithRetry('https://example.org/data.csv', {
			request: { credentials: 'omit', referrerPolicy: 'no-referrer' },
			sleep: async () => {},
			fetchImpl: async (_url, init) => {
				requests.push(init!);
				return new Response('', { status: requests.length < 3 ? 503 : 200 });
			}
		});
		expect(requests).toHaveLength(3);
		for (const request of requests)
			expect(request).toMatchObject({ credentials: 'omit', referrerPolicy: 'no-referrer' });
	});

	it('maps cancellation, rejects oversized sources and checks available quota', async () => {
		const controller = new AbortController();
		controller.abort();
		await expect(
			fetchWithRetry('/dataset.csv', { signal: controller.signal })
		).rejects.toMatchObject({
			code: 'CANCELLED'
		});
		const inFlightController = new AbortController();
		const inFlight = fetchWithRetry('/dataset.csv', {
			signal: inFlightController.signal,
			fetchImpl: (_input, init) =>
				new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener(
						'abort',
						() => reject(new DOMException('Aborted', 'AbortError')),
						{ once: true }
					);
				})
		});
		inFlightController.abort();
		await expect(inFlight).rejects.toMatchObject({ code: 'CANCELLED' });
		expect(() => checkFileSize(MAX_FILE_BYTES + 1)).toThrow(
			new IngestionError('FILE_TOO_LARGE', 'The source exceeds the 200 MB limit.')
		);
		await expect(
			fetchWithRetry('/large.csv', {
				fetchImpl: async () =>
					new Response('', { headers: { 'content-length': String(MAX_FILE_BYTES + 1) } })
			})
		).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });

		await expect(
			checkStorageQuota(100, async () => ({ quota: 1000, usage: 701 }))
		).rejects.toMatchObject({
			code: 'INSUFFICIENT_STORAGE'
		});
		await expect(
			checkStorageQuota(100, async () => ({ quota: 1000, usage: 700 }))
		).resolves.toBeUndefined();
		await expect(checkStorageQuota(100, undefined)).resolves.toBeUndefined();
	});

	it('enforces the streamed response byte limit while reading chunks', async () => {
		const chunk = new Uint8Array(1024 * 1024);
		let produced = 0;
		const body = new ReadableStream<Uint8Array>({
			pull(controller) {
				produced++;
				if (produced > 201) controller.close();
				else controller.enqueue(chunk);
			}
		});
		await expect(
			fetchWithRetry('/stream.csv', {
				fetchImpl: async () => new Response(body),
				sleep: async () => undefined
			})
		).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });
	});

	it('auto-detects semicolons and tabs and normalises line endings consistently', async () => {
		const cases: [string, string[], string[][]][] = [
			['left;right\n1;2\n', ['left', 'right'], [['1', '2']]],
			['left\tright\n1\t2\n', ['left', 'right'], [['1', '2']]],
			['left,right\r\n1,2\r\n', ['left', 'right'], [['1', '2']]],
			['left,right\n1,2\n', ['left', 'right'], [['1', '2']]]
		];
		for (const [source, expectedHeader, expectedRows] of cases) {
			const headers: string[][] = [];
			const rows: string[][] = [];
			await streamCsv(source, {
				onHeader: (cells) => headers.push(cells),
				onRows: async (chunk) => {
					rows.push(...chunk);
				}
			});
			expect(headers).toEqual([expectedHeader]);
			expect(rows).toEqual(expectedRows);
		}
	});

	it('reports malformed quote rows, requires a header and checks column limits', async () => {
		const rows: string[][] = [];
		const quoteErrors: number[] = [];
		await streamCsv('a,b\n1,2\n3,"unfinished', {
			onHeader: () => undefined,
			onRows: async (batch, errors) => {
				rows.push(...batch);
				quoteErrors.push(...errors);
			}
		});
		expect(rows).toContainEqual(['3', 'unfinished']);
		expect(quoteErrors).toEqual([2]);
		await expect(
			streamCsv('', { onHeader: () => undefined, onRows: async () => undefined })
		).rejects.toMatchObject({
			code: 'EMPTY_FILE'
		});

		const tooMany = Array.from({ length: MAX_COLUMNS + 1 }, (_, index) => `c${index}`).join(
			','
		);
		await expect(
			streamCsv(tooMany, { onHeader: () => undefined, onRows: async () => undefined })
		).rejects.toMatchObject({ code: 'TOO_MANY_COLUMNS' });
	});

	it('cancels while a chunk consumer is still pending', async () => {
		const controller = new AbortController();
		let markStarted!: () => void;
		const started = new Promise<void>((resolve) => {
			markStarted = resolve;
		});
		const pending = streamCsv(
			'a,b\n1,2\n',
			{
				onHeader: () => undefined,
				onRows: async () => {
					markStarted();
					await new Promise<void>(() => undefined);
				}
			},
			controller.signal
		);
		await started;
		controller.abort();
		await expect(pending).rejects.toMatchObject({ code: 'CANCELLED' });
	});

	it('waits for each 3 MiB input chunk before delivering the next one', async () => {
		const input = 'left,right\n' + 'value,value\n'.repeat(280_000);
		let calls = 0;
		let active = 0;
		let maximumActive = 0;
		await streamCsv(input, {
			onHeader: () => undefined,
			onRows: async () => {
				calls++;
				active++;
				maximumActive = Math.max(maximumActive, active);
				await new Promise((resolve) => setTimeout(resolve, 1));
				active--;
			}
		});
		expect(new TextEncoder().encode(input).byteLength).toBeGreaterThan(3 * 1024 * 1024);
		expect(calls).toBeGreaterThan(1);
		expect(maximumActive).toBe(1);
	});
});
