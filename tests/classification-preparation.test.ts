import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { encodeTabularFeatures, stratifiedTrainTestSplit } from 'web-ml';
import { openSamataDb } from '../src/common/storage/db';
import { runIngestion } from '../src/features/data/ingestion/pipeline';
import { prepareClassification } from '../src/features/models/training/prepare-classification';
import { installFakeIndexedDB } from './helpers/fake-indexeddb';

const id = 'training-data';
const runtime = { encodeTabularFeatures };
const selection = { datasetId: id, target: 'target', features: ['group', 'flag', 'value'] };
let db: Awaited<ReturnType<typeof openSamataDb>>;
let restoreIndexedDB: () => void;
let blobDescriptor: PropertyDescriptor | undefined;

beforeEach(async () => {
	blobDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'Blob');
	Object.defineProperty(globalThis, 'Blob', { configurable: true, value: window.Blob });
	restoreIndexedDB = installFakeIndexedDB();
	db = await openSamataDb();
});

afterEach(() => {
	db.close();
	restoreIndexedDB();
	if (blobDescriptor) Object.defineProperty(globalThis, 'Blob', blobDescriptor);
	else Reflect.deleteProperty(globalThis, 'Blob');
});

async function ingest(csv: string) {
	const file = new window.File([csv], 'training.csv', { type: 'text/csv' }) as unknown as File;
	return runIngestion({ kind: 'file', file }, { db, uuid: () => id, now: () => 1 });
}

describe('classification transport', () => {
	test('WML-P3-DATA-1: pages mixed data, preserves order and excludes only missing targets', async () => {
		const lines = Array.from({ length: 518 }, (_, i) => {
			const target = i === 1 || i === 511 ? '' : i % 2 === 0 ? 'false' : 'true';
			const category = i === 515 ? 'late-only' : i % 2 === 0 ? 'Group A' : 'group a';
			return `${i === 2 ? '' : i},${i % 2 === 0 ? 'yes' : 'no'},${category},${target}`;
		});
		await ingest(['value,flag,group,target', ...lines].join('\n'));

		let encodings = 0;
		const prepared = await prepareClassification(
			db,
			{
				encodeTabularFeatures(rows, columns) {
					encodings++;
					return encodeTabularFeatures(rows, columns);
				}
			},
			selection
		);
		expect(encodings).toBe(1);
		expect(prepared.columns.map(({ name, kind }) => ({ name, kind }))).toEqual([
			{ name: 'group', kind: 'categorical' },
			{ name: 'flag', kind: 'categorical' },
			{ name: 'value', kind: 'numeric' }
		]);
		expect(prepared.excludedTargetRows).toBe(2);
		expect(prepared.classLabels).toEqual([false, true]);
		expect(prepared.sourceRowIndices).toEqual(
			Array.from({ length: 518 }, (_, i) => i).filter((i) => i !== 1 && i !== 511)
		);
		expect(prepared.features[1 * 3 + 2]).toBeNaN();
		for (const [index, source] of prepared.sourceRowIndices.entries()) {
			expect(prepared.targetCodes[index]).toBe(source % 2);
		}
		const [group, flag] = prepared.columns;
		if (group?.kind !== 'categorical' || flag?.kind !== 'categorical')
			throw new Error('Missing dictionaries');
		expect(group.categories).toEqual(
			expect.arrayContaining(['Group A', 'group a', 'late-only'])
		);
		expect(flag.categories).toEqual(expect.arrayContaining(['true', 'false']));
		const retained = prepared.sourceRowIndices.indexOf(515);
		expect(group.categories[prepared.features[retained * 3]!]).toBe('late-only');
		expect(flag.categories[prepared.features[retained * 3 + 1]!]).toBe('false');
		expect(prepared.features[retained * 3 + 2]).toBe(515);

		const split = () =>
			stratifiedTrainTestSplit(prepared.targetCodes, { testRatio: 0.2, randomState: 42 });
		const { trainIndices, testIndices } = split();
		expect(split()).toEqual({ trainIndices, testIndices });
		const partitionSourceRows = [...trainIndices, ...testIndices].map(
			(index) => prepared.sourceRowIndices[index]
		);
		expect(new Set(partitionSourceRows)).toEqual(new Set(prepared.sourceRowIndices));
		expect(partitionSourceRows).toHaveLength(prepared.sourceRowIndices.length);
	});

	test('WML-P3-DATA-1: preserves the first-seen categorical axis on a real sample', async () => {
		const csv = await Bun.file(
			new URL('../content/datasets/iris/data.csv', import.meta.url)
		).text();
		const metadata = await ingest(csv);
		const target = metadata.columns.at(-1)!;
		const prepared = await prepareClassification(db, runtime, {
			datasetId: id,
			target: target.name,
			features: [metadata.columns[2]!.name, metadata.columns[0]!.name]
		});
		expect(prepared.sourceRowIndices).toHaveLength(150);
		expect(prepared.excludedTargetRows).toBe(0);
		expect(prepared.classLabels).toHaveLength(3);
		const first = await db.get('raw_records', [id, 0]);
		const label = first?.values.at(-1);
		const sepal = first?.values[0];
		const petal = first?.values[2];
		if (typeof label !== 'string' || typeof sepal !== 'number' || typeof petal !== 'number') {
			throw new Error('Unexpected typed Iris row');
		}
		expect(prepared.classLabels[0]).toBe(label);
		expect([...prepared.features.slice(0, 2)]).toEqual([petal, sepal]);
	});

	test('WML-P3-DATA-3: rejects row and metadata mismatches before encoding', async () => {
		await ingest(
			'value,flag,group,target\n1,yes,Group A,true\n2,no,group a,false\n3,no,Group A,true\n4,yes,group a,false\n5,yes,Group A,true\n6,no,group a,false'
		);
		await expect(
			prepareClassification(db, runtime, { ...selection, features: ['target'] })
		).rejects.toMatchObject({ code: 'metadata-mismatch' });
		await db.put('raw_records', {
			datasetId: id,
			rowIndex: 0,
			values: ['incorrect', true, 'A', true]
		});
		await expect(prepareClassification(db, runtime, selection)).rejects.toMatchObject({
			code: 'row-type-mismatch'
		});
		await db.delete('raw_records', [id, 0]);
		await expect(prepareClassification(db, runtime, selection)).rejects.toMatchObject({
			code: 'metadata-mismatch'
		});
	});

	test('WML-P3-DATA-2: observes an abort during the metadata read', async () => {
		const controller = new AbortController();
		const pending = prepareClassification(db, runtime, selection, controller.signal);
		controller.abort();
		await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
	});
});
