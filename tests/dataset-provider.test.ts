import { afterEach, describe, expect, it } from 'bun:test';
import { openSamataDb, putMetadata } from '../src/common/storage/db';
import {
	DatasetProviderError,
	IndexedDBDatasetProvider,
	type IndexedDBDatasetProviderOptions
} from '../src/common/storage/indexeddb-dataset-provider';
import type {
	CategoricalColumnStats,
	DatasetMetadata,
	NumericColumnStats,
	RawRecord,
	TextColumnStats,
	DatetimeColumnStats
} from '../src/types/dataset';
import { installFakeIndexedDB } from './helpers/fake-indexeddb';

let restoreIndexedDB: (() => void) | undefined;
let db: Awaited<ReturnType<typeof openSamataDb>> | undefined;

function numeric(name: string, options: Partial<NumericColumnStats> = {}): NumericColumnStats {
	return {
		name,
		type: 'numeric',
		missingCount: 0,
		missingTokens: {},
		invalidCount: 0,
		invalidExamples: [],
		count: 5,
		min: 1,
		max: 5,
		mean: 3,
		median: 3,
		integer: true,
		identifierHint: false,
		format: { prefix: '', suffix: '', thousandsSeparator: false },
		histogram: { start: 0.5, width: 1, counts: [1, 1, 1, 1, 1] },
		...options
	};
}

function categorical(
	name: string,
	values: string[],
	options: Partial<CategoricalColumnStats> = {}
): CategoricalColumnStats {
	return {
		name,
		type: 'categorical',
		missingCount: 0,
		missingTokens: {},
		invalidCount: 0,
		invalidExamples: [],
		distinctCount: values.length,
		categoryCounts: Object.fromEntries(values.map((value) => [value, 1])),
		...options
	};
}

function metadata(
	columns: DatasetMetadata['columns'],
	rowCount: number,
	id = 'dataset'
): DatasetMetadata {
	return {
		id,
		name: id,
		source: 'upload',
		sampleId: null,
		rowCount,
		byteLength: rowCount,
		createdAt: 1,
		delimiter: ',',
		columns,
		paddedRowCount: 0,
		skippedRows: { count: 0, rowNumbers: [] }
	};
}

async function setUp(meta: DatasetMetadata, rows: RawRecord[]): Promise<void> {
	restoreIndexedDB = installFakeIndexedDB();
	db = await openSamataDb();
	await putMetadata(db, meta);
	for (const row of rows) await db.put('raw_records', row);
}

function row(datasetId: string, rowIndex: number, values: RawRecord['values']): RawRecord {
	return { datasetId, rowIndex, values };
}

async function create(
	meta: DatasetMetadata,
	rows: RawRecord[],
	extra: Partial<Omit<IndexedDBDatasetProviderOptions, 'db' | 'datasetId'>> = {}
): Promise<IndexedDBDatasetProvider> {
	await setUp(meta, rows);
	return IndexedDBDatasetProvider.create({
		db: db!,
		datasetId: meta.id,
		featureColumns: [],
		...extra
	});
}

afterEach(() => {
	db?.close();
	db = undefined;
	restoreIndexedDB?.();
	restoreIndexedDB = undefined;
});

describe('IndexedDBDatasetProvider', () => {
	it('writes Iris-like numeric features row-major and encodes sorted target categories', async () => {
		const columns = [
			numeric('a'),
			numeric('b'),
			numeric('c'),
			numeric('d'),
			categorical('species', ['virginica', 'setosa', 'versicolor'])
		];
		const rows = [
			row('iris', 0, [1, 2, 3, 4, 'versicolor']),
			row('iris', 1, [5, 6, 7, 8, 'setosa']),
			row('iris', 2, [9, 10, 11, 12, 'virginica'])
		];
		const provider = await create(metadata(columns, rows.length, 'iris'), rows, {
			featureColumns: ['a', 'b', 'c', 'd'],
			targetColumns: ['species']
		});
		const features = new Float64Array(12);
		const targets = new Float64Array(3);
		await provider.load(features, targets);
		expect(provider.targetCategories).toEqual(['setosa', 'versicolor', 'virginica']);
		expect([...features]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
		expect([...targets]).toEqual([1, 0, 2]);
	});

	it('one-hot encodes categories in sorted column order', async () => {
		const columns = [
			numeric('bill_length_mm'),
			categorical('island', ['Torgersen', 'Biscoe', 'Dream'])
		];
		const rows = [
			row('islands', 0, [39, 'Biscoe']),
			row('islands', 1, [40, 'Dream']),
			row('islands', 2, [41, 'Torgersen'])
		];
		const provider = await create(metadata(columns, rows.length, 'islands'), rows, {
			featureColumns: ['bill_length_mm', 'island'],
			preprocessing: [{ column: 'island', method: 'one-hot' }]
		});
		const features = new Float64Array(12);
		await provider.load(features);
		expect(provider.featureNames).toEqual([
			'bill_length_mm',
			'island=Biscoe',
			'island=Dream',
			'island=Torgersen'
		]);
		expect([...features]).toEqual([39, 1, 0, 0, 40, 0, 1, 0, 41, 0, 0, 1]);
	});

	it('uses metadata median to impute and identifies unhandled missing values by column and row', async () => {
		const col = numeric('mass', { missingCount: 1, median: 4 });
		const rows = [row('missing', 0, [2]), row('missing', 1, [null]), row('missing', 2, [6])];
		const meta = metadata([col], rows.length, 'missing');
		const imputed = await create(meta, rows, {
			featureColumns: ['mass'],
			preprocessing: [{ column: 'mass', method: 'impute', strategy: 'median' }]
		});
		const values = new Float64Array(3);
		await imputed.load(values);
		expect([...values]).toEqual([2, 4, 6]);

		const without = await IndexedDBDatasetProvider.create({
			db: db!,
			datasetId: 'missing',
			featureColumns: ['mass']
		});
		await expect(without.load(new Float64Array(3))).rejects.toMatchObject({
			code: 'MISSING_VALUE',
			message: expect.stringContaining('mass, row 2')
		});
	});

	it('rejects unsupported columns, missing categorical preprocessing and undersized buffers', async () => {
		const textColumn: TextColumnStats = {
			name: 'notes',
			type: 'text',
			missingCount: 0,
			missingTokens: {},
			invalidCount: 0,
			invalidExamples: [],
			distinctCount: 1,
			identifierHint: false
		};
		const datetimeColumn: DatetimeColumnStats = {
			name: 'when',
			type: 'datetime',
			missingCount: 0,
			missingTokens: {},
			invalidCount: 0,
			invalidExamples: [],
			count: 1,
			min: 1,
			max: 1,
			format: { kind: 'epoch', unit: 'ms' }
		};
		const meta = metadata(
			[textColumn, datetimeColumn, categorical('kind', ['a', 'b']), numeric('value')],
			1
		);
		await setUp(meta, [row('dataset', 0, ['x', 1, 'a', 1])]);
		await expect(
			IndexedDBDatasetProvider.create({
				db: db!,
				datasetId: 'missing',
				featureColumns: ['value']
			})
		).rejects.toMatchObject({ code: 'DATASET_NOT_FOUND' });
		await expect(
			IndexedDBDatasetProvider.create({
				db: db!,
				datasetId: 'dataset',
				featureColumns: ['unknown']
			})
		).rejects.toMatchObject({ code: 'UNKNOWN_COLUMN' });
		await expect(
			IndexedDBDatasetProvider.create({
				db: db!,
				datasetId: 'dataset',
				featureColumns: ['notes']
			})
		).rejects.toMatchObject({ code: 'UNSUPPORTED_COLUMN' });
		await expect(
			IndexedDBDatasetProvider.create({
				db: db!,
				datasetId: 'dataset',
				featureColumns: ['when']
			})
		).rejects.toMatchObject({ code: 'UNSUPPORTED_COLUMN' });
		await expect(
			IndexedDBDatasetProvider.create({
				db: db!,
				datasetId: 'dataset',
				featureColumns: ['kind']
			})
		).rejects.toMatchObject({ code: 'MISSING_PREPROCESSING' });
		const provider = await IndexedDBDatasetProvider.create({
			db: db!,
			datasetId: 'dataset',
			featureColumns: ['value']
		});
		await expect(provider.load(new Float64Array(0))).rejects.toMatchObject({
			code: 'BUFFER_TOO_SMALL'
		});
	});

	it('honours abort signals and reports progress after each fetched batch', async () => {
		const values = Array.from({ length: 5 }, (_, index) => row('batch', index, [index + 1]));
		const provider = await create(metadata([numeric('x')], values.length, 'batch'), values, {
			featureColumns: ['x'],
			batchSize: 2
		});
		const progress: number[] = [];
		await provider.load(new Float64Array(5), undefined, undefined, (fraction) =>
			progress.push(fraction)
		);
		expect(progress).toEqual([0.4, 0.8, 1]);
		const controller = new AbortController();
		await expect(
			provider.load(new Float64Array(5), undefined, controller.signal, (fraction) => {
				if (fraction >= 0.4) controller.abort();
			})
		).rejects.toMatchObject({ code: 'ABORTED' });
	});

	it('contains no Float64Array allocations in the provider source', async () => {
		const source = await Bun.file(
			new URL('../src/common/storage/indexeddb-dataset-provider.ts', import.meta.url)
		).text();
		expect(source).not.toContain('new Float64Array');
	});
});
