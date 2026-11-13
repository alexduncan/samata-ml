import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { DatasetMetadata, RawRecord } from '../../types/dataset';

/** IndexedDB database name shared by ingestion and reconciliation. */
export const DB_NAME = 'samata-db';

/** Current IndexedDB schema version. */
export const DB_VERSION = 2;

/** Exclusive Web Lock held while dataset rows are being ingested. */
export const INGESTION_LOCK = 'samata-ml:ingestion';

type StoredModelResult = { datasetId: string; modelNum: number } & Record<string, unknown>;

/** Typed object-store schema for the application database. */
export interface SamataDBSchema extends DBSchema {
	metadata: { key: string; value: DatasetMetadata };
	raw_records: { key: [string, number]; value: RawRecord };
	model_results: { key: [string, number]; value: StoredModelResult };
}

/** Opens the database, replacing the legacy v1 stores with the v2 key-path schema. */
export function openSamataDb(): Promise<IDBPDatabase<SamataDBSchema>> {
	return openDB<SamataDBSchema>(DB_NAME, DB_VERSION, {
		upgrade(db, oldVersion) {
			if (oldVersion < DB_VERSION) {
				for (const storeName of ['metadata', 'raw_records', 'model_results'] as const) {
					if (db.objectStoreNames.contains(storeName)) db.deleteObjectStore(storeName);
				}
				db.createObjectStore('metadata', { keyPath: 'id' });
				db.createObjectStore('raw_records', { keyPath: ['datasetId', 'rowIndex'] });
				db.createObjectStore('model_results', { keyPath: ['datasetId', 'modelNum'] });
			}
		}
	});
}

/**
 * Creates a key range containing rows for one dataset from a given row index onward.
 *
 * @param id - Dataset identifier.
 * @param from - Inclusive zero-based row index.
 * @returns A compound-key range restricted to the requested dataset.
 */
export function datasetRowRange(id: string, from = 0): IDBKeyRange {
	return IDBKeyRange.bound([id, from], [id, Infinity]);
}

/** Reads the completed metadata for a dataset. */
export function getMetadata(
	db: IDBPDatabase<SamataDBSchema>,
	id: string
): Promise<DatasetMetadata | undefined> {
	return db.get('metadata', id);
}

/** Stores completed metadata for a dataset. */
export async function putMetadata(
	db: IDBPDatabase<SamataDBSchema>,
	metadata: DatasetMetadata
): Promise<void> {
	await db.put('metadata', metadata);
}

/**
 * Reads a page of rows for a completed dataset.
 *
 * @param db - Open application database.
 * @param id - Dataset identifier.
 * @param offset - Inclusive zero-based row offset.
 * @param limit - Maximum number of rows to return.
 * @returns Rows in row-index order, or an empty list if metadata is absent.
 */
export async function getRows(
	db: IDBPDatabase<SamataDBSchema>,
	id: string,
	offset: number,
	limit: number
): Promise<RawRecord[]> {
	if (!(await db.get('metadata', id))) return [];
	return db.getAll('raw_records', datasetRowRange(id, offset), limit);
}

/** Deletes a dataset's metadata, rows and model results in one transaction. */
export async function deleteDataset(db: IDBPDatabase<SamataDBSchema>, id: string): Promise<void> {
	const tx = db.transaction(['metadata', 'raw_records', 'model_results'], 'readwrite');
	await Promise.all([
		tx.objectStore('metadata').delete(id),
		tx.objectStore('raw_records').delete(datasetRowRange(id)),
		tx.objectStore('model_results').delete(IDBKeyRange.bound([id, -Infinity], [id, Infinity]))
	]);
	await tx.done;
}

/** Deletes all datasets except the requested ID, or clears the stores when it is null. */
export async function deleteDatasetsExcept(
	db: IDBPDatabase<SamataDBSchema>,
	keepId: string | null
): Promise<void> {
	const tx = db.transaction(['metadata', 'raw_records', 'model_results'], 'readwrite');
	if (keepId === null) {
		await Promise.all([
			tx.objectStore('metadata').clear(),
			tx.objectStore('raw_records').clear(),
			tx.objectStore('model_results').clear()
		]);
	} else {
		const metadataKeys = await tx.objectStore('metadata').getAllKeys();
		await Promise.all([
			...metadataKeys
				.filter((key) => key !== keepId)
				.map((key) => tx.objectStore('metadata').delete(key)),
			tx.objectStore('raw_records').delete(IDBKeyRange.upperBound([keepId, -Infinity], true)),
			tx.objectStore('raw_records').delete(IDBKeyRange.lowerBound([keepId, Infinity], true)),
			tx
				.objectStore('model_results')
				.delete(IDBKeyRange.upperBound([keepId, -Infinity], true)),
			tx.objectStore('model_results').delete(IDBKeyRange.lowerBound([keepId, Infinity], true))
		]);
	}
	await tx.done;
}

/** Checks whether a result record exists for a dataset and model number. */
export async function hasModelResults(
	db: IDBPDatabase<SamataDBSchema>,
	datasetId: string,
	modelNum: number
): Promise<boolean> {
	return (await db.get('model_results', [datasetId, modelNum])) !== undefined;
}
