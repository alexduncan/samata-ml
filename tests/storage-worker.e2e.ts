import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	await page.goto('/datasets/index.json');
	await page.evaluate(
		() =>
			new Promise<void>((resolve, reject) => {
				const request = indexedDB.deleteDatabase('samata-db');
				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error);
				request.onblocked = () => reject(new Error('samata-db deletion was blocked'));
			})
	);
	await page.goto('/data');
});

test('storage worker builds the catalogue and ingests sample and in-page files', async ({
	page
}) => {
	const result = await page.evaluate(async () => {
		const indexResponse = await fetch('/datasets/index.json');
		if (!indexResponse.ok) throw new Error(`Catalogue fetch failed: ${indexResponse.status}`);
		const index = (await indexResponse.json()) as {
			entries: { id: string; csvOrigin: 'bundled' | 'remote' }[];
		};
		const worker = new Worker('/storage.worker.js', { type: 'module' });
		let requestId = 0;
		const send = <T>(type: string, payload: Record<string, unknown>): Promise<T> =>
			new Promise<T>((resolve, reject) => {
				const id = ++requestId;
				const onMessage = (event: MessageEvent) => {
					if (event.data.requestId !== id || event.data.type === 'progress') return;
					worker.removeEventListener('message', onMessage);
					if (event.data.type === 'error') reject(event.data.error);
					else resolve(event.data.value as T);
				};
				worker.addEventListener('message', onMessage);
				worker.postMessage({ requestId: id, type, ...payload });
			});
		const deleteDatabase = async (keepId: string | null) =>
			send<null>('deleteDatasetsExcept', { keepId });
		const getRows = (datasetId: string, offset: number, limit: number) =>
			send<{ datasetId: string; rowIndex: number; values: unknown[] }[]>('getRows', {
				datasetId,
				offset,
				limit
			});
		const getMetadata = (datasetId: string) =>
			send<{
				id: string;
				sampleId: string | null;
				rowCount: number;
				paddedRowCount: number;
				skippedRows: { count: number; rowNumbers: number[] };
				columns: {
					name: string;
					type: string;
					missingCount: number;
					count?: number;
					histogram?: { counts: number[] };
					identifierHint?: boolean;
				}[];
			}>('getMetadata', { datasetId });
		const countRawRows = async (datasetId: string): Promise<number> => {
			const db = await new Promise<IDBDatabase>((resolve, reject) => {
				const request = indexedDB.open('samata-db');
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});
			try {
				return await new Promise<number>((resolve, reject) => {
					const store = db
						.transaction('raw_records', 'readonly')
						.objectStore('raw_records');
					const range = IDBKeyRange.bound(
						[datasetId, 0],
						[datasetId, Number.MAX_SAFE_INTEGER]
					);
					const request = store.count(range);
					request.onsuccess = () => resolve(request.result);
					request.onerror = () => reject(request.error);
				});
			} finally {
				db.close();
			}
		};

		const sample = await send<{
			id: string;
			sampleId: string | null;
			rowCount: number;
			columns: {
				name: string;
				type: string;
				missingCount: number;
				count?: number;
				histogram?: { counts: number[] };
			}[];
		}>('ingest', { source: { kind: 'sample', sampleId: 'palmer-penguins' } });
		const sampleRows = await getRows(sample.id, 0, 3);
		const sampleStoredRows = await countRawRows(sample.id);

		const irregularFile = new File(
			[
				'number,partial,flag\n' +
					'1,bad,yes\n2,2,yes\n3,3,yes\n4,bad,yes\n5,5,yes\n6,6,yes\n7,bad,yes\n8,8,yes\n9,9,yes\n10,10,yes\n11,11\n12,12,yes,extra\n'
			],
			'irregular.csv',
			{ type: 'text/csv' }
		);
		const irregular = await send<{ id: string }>('ingest', {
			source: { kind: 'file', file: irregularFile }
		});
		const irregularMetadata = await getMetadata(irregular.id);

		const identifierFile = new File(
			[
				'rowid,value\n' +
					Array.from({ length: 20 }, (_, index) => `${index + 1},${index * 2}`).join('\n')
			],
			'identifier.csv',
			{ type: 'text/csv' }
		);
		const identifier = await send<{ id: string }>('ingest', {
			source: { kind: 'file', file: identifierFile }
		});
		const identifierMetadata = await getMetadata(identifier.id);
		await deleteDatabase(null);
		worker.terminate();
		return {
			datasetIds: index.entries.map(({ id }) => id).sort(),
			compasOrigin: index.entries.find(({ id }) => id === 'compas-recidivism')?.csvOrigin,
			sample,
			sampleRows,
			sampleStoredRows,
			irregularMetadata,
			identifierMetadata
		};
	});

	expect(result.datasetIds).toHaveLength(12);
	expect(result.compasOrigin).toBe('remote');
	expect(result.datasetIds).toContain('compas-recidivism');
	expect(result.sample).toMatchObject({ sampleId: 'palmer-penguins', rowCount: 344 });
	expect(result.sample.columns).toHaveLength(8);
	for (const name of ['species', 'island', 'sex', 'year']) {
		expect(result.sample.columns.find((column) => column.name === name)?.type).toBe(
			'categorical'
		);
	}
	expect(result.sample.columns.find((column) => column.name === 'bill_length_mm')).toMatchObject({
		type: 'numeric',
		missingCount: 2
	});
	const bodyMass = result.sample.columns.find((column) => column.name === 'body_mass_g');
	expect(bodyMass).toMatchObject({ type: 'numeric', missingCount: 2, count: 342 });
	expect(bodyMass?.histogram?.counts.reduce((sum, count) => sum + count, 0)).toBe(342);
	expect(result.sampleRows).toHaveLength(3);
	expect(typeof result.sampleRows[0]?.values[2]).toBe('number');
	expect(result.sampleStoredRows).toBe(344);
	expect(result.irregularMetadata).toMatchObject({
		rowCount: 11,
		paddedRowCount: 1,
		skippedRows: { count: 1 }
	});
	expect(
		result.irregularMetadata?.columns.find((column) => column.name === 'partial')?.type
	).not.toBe('numeric');
	expect(
		result.identifierMetadata?.columns.find((column) => column.name === 'rowid')
	).toMatchObject({ type: 'numeric', identifierHint: true });
});
