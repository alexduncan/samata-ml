import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { openSamataDb } from '../src/common/storage/db';
import type { DatasetMetadata, RawRecord } from '../src/types/dataset';
import { runIngestion } from '../src/features/data/ingestion/pipeline';
import { installFakeIndexedDB } from './helpers/fake-indexeddb';

let restore: (() => void) | undefined;
let db: Awaited<ReturnType<typeof openSamataDb>> | undefined;
let blobDescriptor: PropertyDescriptor | undefined;

function file(source: string, name = 'example.csv'): File {
	return new window.File([source], name, { type: 'text/csv' }) as unknown as File;
}

function metadata(id: string): DatasetMetadata {
	return {
		id,
		name: id,
		source: 'upload',
		sampleId: null,
		rowCount: 1,
		byteLength: 1,
		createdAt: 0,
		delimiter: ',',
		columns: [],
		paddedRowCount: 0,
		skippedRows: { count: 0, rowNumbers: [] }
	};
}

async function seedExistingDataset(id: string): Promise<void> {
	await db!.put('metadata', metadata(id));
	await db!.put('raw_records', { datasetId: id, rowIndex: 0, values: ['existing'] });
}

beforeEach(async () => {
	blobDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'Blob');
	Object.defineProperty(globalThis, 'Blob', {
		configurable: true,
		writable: true,
		value: window.Blob
	});
	restore = installFakeIndexedDB();
	db = await openSamataDb();
});

afterEach(() => {
	db?.close();
	db = undefined;
	restore?.();
	restore = undefined;
	if (blobDescriptor) Object.defineProperty(globalThis, 'Blob', blobDescriptor);
	else Reflect.deleteProperty(globalThis, 'Blob');
	blobDescriptor = undefined;
});

describe('runIngestion', () => {
	it('stores typed rows and exact numeric, boolean, category, and datetime statistics', async () => {
		const rows = [
			'num,flag,category,event_date,notes',
			'1,yes,A,2024-01-01,note-1',
			'2,no,B,2024-01-02,note-2',
			'3,yes,A,2024-01-03,note-3',
			'4,no,B,2024-01-04,note-4',
			'5,yes,A,2024-01-05,note-5',
			'6,no,B,2024-01-06,note-6'
		].join('\n');
		const progress: string[] = [];
		const result = await runIngestion(
			{ kind: 'file', file: file(rows, 'training-data.csv') },
			{
				db: db!,
				uuid: () => 'ingested',
				now: () => 1234,
				onProgress: (value) => progress.push(value.phase)
			}
		);

		expect(result).toMatchObject({
			id: 'ingested',
			name: 'training-data',
			source: 'upload',
			rowCount: 6,
			createdAt: 1234,
			delimiter: ',',
			paddedRowCount: 0,
			skippedRows: { count: 0, rowNumbers: [] }
		});
		expect(result.columns.map((column) => column.type)).toEqual([
			'numeric',
			'boolean',
			'categorical',
			'date',
			'text'
		]);
		expect(result.columns[0]).toMatchObject({
			count: 6,
			min: 1,
			max: 6,
			mean: 3.5,
			median: 3.5,
			integer: true,
			histogram: { start: 0.5, width: 1, counts: [1, 1, 1, 1, 1, 1] }
		});
		expect(result.columns[1]).toMatchObject({
			trueCount: 3,
			falseCount: 3,
			lexicon: ['yes', 'no']
		});
		expect(result.columns[2]).toMatchObject({
			distinctCount: 2,
			categoryCounts: { A: 3, B: 3 }
		});
		expect(result.columns[3]).toMatchObject({
			count: 6,
			min: Date.UTC(2024, 0, 1),
			max: Date.UTC(2024, 0, 6)
		});
		expect(progress).toContain('parse');
		expect(progress).toContain('typing');
		expect(progress).toContain('statistics');

		const stored = (await db!.getAll('raw_records')) as RawRecord[];
		expect(stored.map((row) => row.rowIndex)).toEqual([0, 1, 2, 3, 4, 5]);
		expect(stored[0]!.values).toEqual([1, true, 'A', Date.UTC(2024, 0, 1), 'note-1']);
	});

	it('TEMP-AC-11: stores temporal values and computes precision', async () => {
		const header = 'day,clock,moment,epoch';
		const rows = Array.from({ length: 100 }, (_, i) => {
			const day =
				i === 0
					? '2013-08-13 06:03:42'
					: `2013-08-${String(10 + (i % 10)).padStart(2, '0')}`;
			const clock = i % 2 ? '09:00' : '17:30';
			const moment = `2013-08-13 06:0${i % 10}:${String(i % 60).padStart(2, '0')}`;
			return `${day},${clock},${moment},${1_700_000_000_000 + i * 1000 + (i % 7)}`;
		});
		const result = await runIngestion(
			{ kind: 'file', file: file([header, ...rows].join('\n')) },
			{ db: db!, uuid: () => 'temporal' }
		);
		const [day, clock, moment, epoch] = result.columns;
		expect(day).toMatchObject({
			type: 'date',
			invalidCount: 1,
			count: 99,
			min: Date.UTC(2013, 7, 10),
			max: Date.UTC(2013, 7, 19)
		});
		expect(clock).toMatchObject({ type: 'time', precision: 'minute', min: 32_400_000 });
		expect(moment).toMatchObject({ type: 'datetime', precision: 'second' });
		expect(epoch).toMatchObject({ type: 'datetime', precision: 'millisecond' });
		const stored = (await db!.getAll('raw_records')) as RawRecord[];
		expect(stored[0]!.values[0]).toBeNull();
		expect(stored[1]!.values[0]).toBe(Date.UTC(2013, 7, 11));
	});

	it('pads short rows and skips long rows while keeping contiguous row indexes', async () => {
		const result = await runIngestion(
			{ kind: 'file', file: file('value,note\n1,first\n2\n3,third,extra\n4,fourth\n') },
			{ db: db!, uuid: () => 'ragged' }
		);
		expect(result.rowCount).toBe(3);
		expect(result.paddedRowCount).toBe(1);
		expect(result.skippedRows).toEqual({ count: 1, rowNumbers: [3] });
		const stored = (await db!.getAll('raw_records')) as RawRecord[];
		expect(stored.map(({ rowIndex, values }) => [rowIndex, values])).toEqual([
			[0, [1, 'first']],
			[1, [2, null]],
			[2, [4, 'fourth']]
		]);
	});

	it('stores invalid typed cells as null and counts them in the elected metadata', async () => {
		const source = [
			'value',
			...Array.from({ length: 50 }, (_, index) => String(index + 1)),
			'bad'
		].join('\n');
		const result = await runIngestion(
			{ kind: 'file', file: file(source) },
			{ db: db!, uuid: () => 'invalid' }
		);
		expect(result.columns[0]).toMatchObject({
			type: 'numeric',
			invalidCount: 1,
			invalidExamples: ['bad']
		});
		const stored = (await db!.getAll('raw_records')) as RawRecord[];
		expect(stored.at(-1)!.values).toEqual([null]);
	});

	it('skips and reports rows with quote errors', async () => {
		const result = await runIngestion(
			{ kind: 'file', file: file('value,note\n1,first\n2,"unfinished') },
			{ db: db!, uuid: () => 'quote-error' }
		);
		expect(result.rowCount).toBe(1);
		expect(result.skippedRows).toEqual({ count: 1, rowNumbers: [2] });
		expect((await db!.getAll('raw_records')).map((row) => row.rowIndex)).toEqual([0]);
	});

	it('rejects a header-only file and aborts Pass 2 without removing the prior dataset', async () => {
		await seedExistingDataset('previous');
		await expect(
			runIngestion(
				{ kind: 'file', file: file('only_header') },
				{ db: db!, uuid: () => 'empty' }
			)
		).rejects.toMatchObject({ code: 'NO_DATA_ROWS' });
		expect(await db!.get('metadata', 'empty')).toBeUndefined();
		expect(await db!.get('raw_records', ['empty', 0])).toBeUndefined();

		const controller = new AbortController();
		await expect(
			runIngestion(
				{
					kind: 'file',
					file: file(
						[
							'number',
							...Array.from({ length: 30 }, (_, index) => String(index + 1))
						].join('\n')
					)
				},
				{
					db: db!,
					uuid: () => 'aborted',
					signal: controller.signal,
					onProgress: ({ phase }) => {
						if (phase === 'typing') controller.abort();
					}
				}
			)
		).rejects.toMatchObject({ code: 'CANCELLED' });
		expect(await db!.get('metadata', 'aborted')).toBeUndefined();
		expect(await db!.get('raw_records', ['aborted', 0])).toBeUndefined();
		expect(await db!.get('metadata', 'previous')).toEqual(metadata('previous'));
		expect(await db!.get('raw_records', ['previous', 0])).toEqual({
			datasetId: 'previous',
			rowIndex: 0,
			values: ['existing']
		});
	});

	it('validates sample headers and applies descriptor type overrides', async () => {
		const descriptor = {
			id: 'sample',
			name: 'Sample Dataset',
			columns: [{ name: 'pclass', dataType: 'categorical' }],
			stats: { sha256: '0'.repeat(64) },
			files: { csv: '/datasets/sample/data.csv', csvOrigin: 'bundled' }
		};
		let csv = 'wrong\n1\n2\n';
		const fetchImpl = async (input: RequestInfo | URL) => {
			const url = new URL(String(input));
			return url.pathname.endsWith('descriptor.json')
				? new Response(JSON.stringify(descriptor), {
						headers: { 'content-type': 'application/json' }
					})
				: new Response(csv, { headers: { 'content-type': 'text/csv' } });
		};
		await expect(
			runIngestion(
				{ kind: 'sample', sampleId: 'sample' },
				{ db: db!, uuid: () => 'mismatch', fetchImpl }
			)
		).rejects.toMatchObject({ code: 'DESCRIPTOR_MISMATCH' });
		expect(await db!.get('metadata', 'mismatch')).toBeUndefined();

		csv = 'pclass\n1\n2\n1\n';
		const result = await runIngestion(
			{ kind: 'sample', sampleId: 'sample' },
			{ db: db!, uuid: () => 'sample-good', fetchImpl }
		);
		expect(result).toMatchObject({
			source: 'sample',
			sampleId: 'sample',
			name: 'Sample Dataset'
		});
		expect(result.columns[0]!.type).toBe('categorical');
		expect((await db!.get('raw_records', ['sample-good', 0]))?.values).toEqual(['1']);
	});

	it('hash-checks remote samples before writing any rows or metadata', async () => {
		const csv = 'feature,target\n1,yes\n2,no\n3,yes\n';
		const bytes = new TextEncoder().encode(csv);
		const sha256 = new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
		let expectedHash = sha256;
		const descriptor = {
			id: 'remote-sample',
			name: 'Remote sample',
			columns: [
				{ name: 'feature', dataType: 'numeric' },
				{ name: 'target', dataType: 'categorical' }
			],
			stats: { sha256: expectedHash },
			files: {
				csv: 'https://raw.githubusercontent.com/propublica/compas-analysis/commit/data.csv',
				csvOrigin: 'remote'
			}
		};
		const requests: { url: string; init?: RequestInit }[] = [];
		const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
			requests.push({ url: String(input), init });
			if (String(input).endsWith('descriptor.json')) {
				descriptor.stats.sha256 = expectedHash;
				return new Response(JSON.stringify(descriptor), {
					headers: { 'content-type': 'application/json' }
				});
			}
			return new Response(bytes, { headers: { 'content-type': 'text/csv' } });
		};
		const result = await runIngestion(
			{ kind: 'sample', sampleId: 'remote-sample' },
			{ db: db!, uuid: () => 'remote-match', fetchImpl }
		);
		expect(result.sampleId).toBe('remote-sample');
		expect(requests[0]?.init?.credentials).toBeUndefined();
		expect(requests[1]?.init).toMatchObject({
			credentials: 'omit',
			referrerPolicy: 'no-referrer'
		});
		expect(await db!.count('raw_records')).toBe(3);

		expectedHash = '0'.repeat(64);
		await expect(
			runIngestion(
				{ kind: 'sample', sampleId: 'remote-sample' },
				{ db: db!, uuid: () => 'remote-mismatch', fetchImpl }
			)
		).rejects.toMatchObject({
			code: 'DESCRIPTOR_MISMATCH',
			message: 'The remote sample CSV does not match its descriptor.'
		});
		expect(await db!.get('metadata', 'remote-mismatch')).toBeUndefined();
		expect(await db!.get('raw_records', ['remote-mismatch', 0])).toBeUndefined();
	});

	it('rejects each retired ID before fetching a source', async () => {
		for (const sampleId of ['pima-diabetes', 'titanic']) {
			const requests: string[] = [];
			await expect(
				runIngestion(
					{ kind: 'sample', sampleId },
					{
						db: db!,
						fetchImpl: async (url) => {
							requests.push(String(url));
							return new Response('', { status: 404 });
						}
					}
				)
			).rejects.toMatchObject({ code: 'SAMPLE_NOT_FOUND' });
			expect(requests).toHaveLength(1);
			expect(requests[0]).toContain('/datasets/' + sampleId + '/descriptor.json');
		}
	});

	it('maps descriptor 404s to SAMPLE_NOT_FOUND', async () => {
		await expect(
			runIngestion(
				{ kind: 'sample', sampleId: 'missing' },
				{
					db: db!,
					fetchImpl: async () => new Response('', { status: 404 }),
					sleep: async () => undefined
				}
			)
		).rejects.toMatchObject({ code: 'SAMPLE_NOT_FOUND' });
	});
});
