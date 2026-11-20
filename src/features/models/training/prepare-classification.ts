import type { IDBPDatabase } from 'idb';
import type { ClassificationLabel, TabularColumnInput } from 'web-ml';
import { getMetadata, getRows, type SamataDBSchema } from '../../../common/storage/db';
import type { CellValue, ColumnStats } from '../../../types/dataset';
import {
	ClassificationError,
	type ClassificationSelection,
	type PreparedClassification
} from './types';

const ROW_PAGE_SIZE = 512;

type EligibleType = 'numeric' | 'boolean' | 'categorical';
type SelectedColumn = { index: number; type: EligibleType; name: string };

function resolveColumn(columns: readonly ColumnStats[], name: string): SelectedColumn {
	const index = columns.findIndex((column) => column.name === name);
	const type = columns[index]?.type;
	if (type !== 'numeric' && type !== 'boolean' && type !== 'categorical') {
		throw new ClassificationError('metadata-mismatch');
	}
	return { index, type, name };
}

function readCell(values: readonly CellValue[], column: SelectedColumn): CellValue {
	const value = values[column.index];
	if (value === null) return null;
	if (column.type === 'numeric' && typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}
	if (column.type === 'boolean' && typeof value === 'boolean') return value;
	if (column.type === 'categorical' && typeof value === 'string') return value;
	throw new ClassificationError('row-type-mismatch');
}

/**
 * Loads typed rows in index order and creates one web-ml transport dictionary. The library
 * fits its preprocessing separately for each evaluation partition.
 */
export async function prepareClassification(
	db: IDBPDatabase<SamataDBSchema>,
	runtime: Pick<typeof import('web-ml'), 'encodeTabularFeatures'>,
	selection: ClassificationSelection,
	signal?: AbortSignal
): Promise<PreparedClassification> {
	signal?.throwIfAborted();
	const metadata = await getMetadata(db, selection.datasetId);
	signal?.throwIfAborted();
	if (!metadata) throw new ClassificationError('dataset-unavailable');
	if (
		metadata.id !== selection.datasetId ||
		!Number.isSafeInteger(metadata.rowCount) ||
		metadata.rowCount < 1 ||
		!Array.isArray(metadata.columns) ||
		metadata.columns.some((column) => !column || typeof column.name !== 'string') ||
		new Set(metadata.columns.map((column) => column.name)).size !== metadata.columns.length ||
		selection.features.length === 0 ||
		new Set([selection.target, ...selection.features]).size !== selection.features.length + 1
	) {
		throw new ClassificationError('metadata-mismatch');
	}
	const target = resolveColumn(metadata.columns, selection.target);
	if (target.type === 'numeric') throw new ClassificationError('metadata-mismatch');
	const features = selection.features.map((name) => resolveColumn(metadata.columns, name));
	const columns: TabularColumnInput[] = features.map(({ name, type }) => ({
		name,
		kind: type === 'numeric' ? 'numeric' : 'categorical'
	}));

	const rows: CellValue[][] = [];
	const labelCodes = new Map<ClassificationLabel, number>();
	const codes: number[] = [];
	const sourceRowIndices: number[] = [];
	let excludedTargetRows = 0;
	for (let offset = 0; offset <= metadata.rowCount; offset += ROW_PAGE_SIZE) {
		signal?.throwIfAborted();
		const page = await getRows(db, selection.datasetId, offset, ROW_PAGE_SIZE);
		signal?.throwIfAborted();
		if (page.length !== Math.min(ROW_PAGE_SIZE, metadata.rowCount - offset)) {
			throw new ClassificationError('metadata-mismatch');
		}
		for (const [index, row] of page.entries()) {
			if (
				row.datasetId !== selection.datasetId ||
				row.rowIndex !== offset + index ||
				!Array.isArray(row.values) ||
				row.values.length !== metadata.columns.length
			) {
				throw new ClassificationError('metadata-mismatch');
			}
			const label = readCell(row.values, target);
			const values = features.map((column) => {
				const value = readCell(row.values, column);
				return typeof value === 'boolean' ? String(value) : value;
			});
			if (label === null) {
				excludedTargetRows++;
				continue;
			}
			if (!labelCodes.has(label)) labelCodes.set(label, labelCodes.size);
			codes.push(labelCodes.get(label)!);
			rows.push(values);
			sourceRowIndices.push(row.rowIndex);
		}
		if (page.length < ROW_PAGE_SIZE) break;
	}
	if (rows.length === 0) throw new ClassificationError('invalid-dimensions');

	const encoded = runtime.encodeTabularFeatures(rows, columns);
	signal?.throwIfAborted();
	return {
		features: encoded.features,
		columns: encoded.columns,
		targetCodes: new Float64Array(codes),
		classLabels: [...labelCodes.keys()],
		sourceRowIndices,
		excludedTargetRows
	};
}
