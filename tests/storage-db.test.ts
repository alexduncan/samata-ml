import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { openDB } from 'idb';
import {
	DB_NAME,
	DB_VERSION,
	deleteDataset,
	deleteDatasetsExcept,
	getMetadata,
	getRows,
	hasModelResults,
	openSamataDb,
	putMetadata
} from '../src/common/storage/db';
import { toDatasetSummary, type DatasetMetadata, type RawRecord } from '../src/types/dataset';
import { installFakeIndexedDB } from './helpers/fake-indexeddb';

let restore: (() => void) | undefined;
let db: Awaited<ReturnType<typeof openSamataDb>> | undefined;

function metadata(id: string): DatasetMetadata {
	return {
		id,
		name: id,
		source: 'upload',
		sampleId: null,
		rowCount: 0,
		byteLength: 0,
		createdAt: 0,
		delimiter: ',',
		columns: [],
		paddedRowCount: 0,
		skippedRows: { count: 0, rowNumbers: [] }
	};
}

function row(datasetId: string, rowIndex: number): RawRecord {
	return { datasetId, rowIndex, values: [rowIndex] };
}

async function seedDataset(id: string, rowCount = 1): Promise<void> {
	await putMetadata(db!, metadata(id));
	for (let index = 0; index < rowCount; index++) await db!.put('raw_records', row(id, index));
	await db!.put('model_results', { datasetId: id, modelNum: 1, result: {} });
}

beforeEach(() => {
	restore = installFakeIndexedDB();
});

afterEach(() => {
	db?.close();
	db = undefined;
	restore?.();
	restore = undefined;
});

describe('samata-db v2', () => {
	it('creates all stores with their compound or inline key paths', async () => {
		db = await openSamataDb();

		expect(db.version).toBe(DB_VERSION);
		expect([...db.objectStoreNames].sort()).toEqual([
			'metadata',
			'model_results',
			'raw_records'
		]);
		const tx = db.transaction(['metadata', 'raw_records', 'model_results']);
		expect(tx.objectStore('metadata').keyPath).toBe('id');
		expect(tx.objectStore('raw_records').keyPath).toEqual(['datasetId', 'rowIndex']);
		expect(tx.objectStore('model_results').keyPath).toEqual(['datasetId', 'modelNum']);
		await tx.done;
	});

	it('replaces legacy v1 out-of-line stores during upgrade', async () => {
		const legacy = await openDB(DB_NAME, 1, {
			upgrade(database) {
				database.createObjectStore('metadata');
				database.createObjectStore('raw_records');
				database.createObjectStore('model_results');
			}
		});
		legacy.close();

		db = await openSamataDb();
		const tx = db.transaction(['metadata', 'raw_records', 'model_results']);

		expect(db.version).toBe(2);
		expect(tx.objectStore('metadata').keyPath).toBe('id');
		expect(tx.objectStore('raw_records').keyPath).toEqual(['datasetId', 'rowIndex']);
		expect(tx.objectStore('model_results').keyPath).toEqual(['datasetId', 'modelNum']);
		await tx.done;
	});

	it('pages rows by dataset and hides rows until metadata exists', async () => {
		db = await openSamataDb();
		await seedDataset('a', 6);
		await seedDataset('b', 2);
		await db.put('raw_records', row('unpublished', 0));

		expect((await getRows(db, 'a', 2, 3)).map((record) => record.rowIndex)).toEqual([2, 3, 4]);
		expect((await getRows(db, 'unpublished', 0, 10)).map((record) => record.datasetId)).toEqual(
			[]
		);
		expect(await getMetadata(db, 'a')).toEqual(metadata('a'));
		expect(await hasModelResults(db, 'a', 1)).toBe(true);
		expect(await hasModelResults(db, 'a', 2)).toBe(false);
	});

	it('deletes one dataset, all except one, or all datasets', async () => {
		db = await openSamataDb();
		await seedDataset('a');
		await seedDataset('b');

		await deleteDataset(db, 'a');
		expect(await db.getAllKeys('metadata')).toEqual(['b']);
		expect((await db.getAll('raw_records')).map((record) => record.datasetId)).toEqual(['b']);
		expect((await db.getAll('model_results')).map((result) => result.datasetId)).toEqual(['b']);

		await seedDataset('a');
		await seedDataset('c');
		await db.put('raw_records', row('orphan', 0));
		await deleteDatasetsExcept(db, 'b');
		expect(await db.getAllKeys('metadata')).toEqual(['b']);
		expect((await db.getAll('raw_records')).map((record) => record.datasetId)).toEqual(['b']);
		expect((await db.getAll('model_results')).map((result) => result.datasetId)).toEqual(['b']);

		await deleteDatasetsExcept(db, null);
		expect(await db.getAll('metadata')).toEqual([]);
		expect(await db.getAll('raw_records')).toEqual([]);
		expect(await db.getAll('model_results')).toEqual([]);
	});

	it('omits nullable sample identifiers and restores absent IndexedDB globals', async () => {
		db = await openSamataDb();
		const before = typeof indexedDB;
		const restoreNow = restore;
		restore = undefined;
		db.close();
		db = undefined;
		restoreNow?.();

		expect(before).toBe('object');
		expect(typeof indexedDB).toBe('undefined');
	});

	it('builds an exact lightweight summary from metadata', () => {
		const summary = toDatasetSummary({
			...metadata('sample-1'),
			source: 'sample',
			sampleId: 'iris',
			rowCount: 12,
			columns: [
				{
					name: 'species',
					type: 'text',
					missingCount: 2,
					missingTokens: { na: 2 },
					invalidCount: 3,
					invalidExamples: ['?'],
					distinctCount: 4,
					identifierHint: false
				}
			]
		});

		expect(summary).toEqual({
			id: 'sample-1',
			name: 'sample-1',
			source: 'sample',
			sampleId: 'iris',
			rowCount: 12,
			columns: [{ name: 'species', type: 'text', missingCount: 5 }]
		});
		expect('sampleId' in toDatasetSummary(metadata('upload-1'))).toBe(false);
	});
});
