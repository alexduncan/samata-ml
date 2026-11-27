import type { VirtualTableColumn, VirtualTableColumnKind } from '../../components/ui-virtual-table';
import type { CellValue, ColumnStats } from '../../types/dataset';
import { isModelEligibleColumnType, isTemporalColumnType } from '../../types/state';
import type { AuthoredColumn } from '../../types/sample-dataset';
import { formatTemporalValue, type TemporalColumnStats } from './temporal-format';

/** Formats one stored cell for display; `column` is absent when metadata has not loaded. */
export type PreviewValueFormatter = (
	value: CellValue | undefined,
	column: ColumnStats | undefined
) => string;

/** Shows a missing value as an em dash, as the preview always has. */
const MISSING = '—';

/**
 * Formats a stored cell for the preview table.
 *
 * Numbers use the supplied locale formatter, temporal values use their column's stored
 * representation, booleans read `true` or `false` and everything else is stringified.
 *
 * @param value - The stored cell value.
 * @param column - Statistics of the cell's column, when known.
 * @param formatNumber - Locale number formatter (the caller owns the locale).
 * @returns The display text.
 */
export function formatPreviewValue(
	value: CellValue | undefined,
	column: ColumnStats | undefined,
	formatNumber: (value: number) => string
): string {
	if (value === null || value === undefined) return MISSING;
	if (column && isTemporalColumnType(column.type) && typeof value === 'number') {
		return formatTemporalValue(value, column as TemporalColumnStats);
	}
	if (typeof value === 'number') return formatNumber(value);
	if (typeof value === 'boolean') return value ? 'true' : 'false';
	return String(value);
}

function kindOf(column: ColumnStats): VirtualTableColumnKind {
	switch (column.type) {
		case 'numeric':
			return 'numeric';
		case 'date':
		case 'time':
		case 'datetime':
			return 'temporal';
		case 'boolean':
			return 'boolean';
		case 'categorical':
			return 'categorical';
		case 'text':
			return 'text';
	}
}

function longest(texts: readonly string[]): number | undefined {
	return texts.length === 0 ? undefined : Math.max(...texts.map((text) => [...text].length));
}

/** Longest rendering among the values a column's statistics can produce (D12). */
function contentChars(column: ColumnStats, format: PreviewValueFormatter): number | undefined {
	switch (column.type) {
		case 'numeric':
			return longest(
				[column.min, column.max, column.mean, column.median]
					.filter((value) => Number.isFinite(value))
					.map((value) => format(value, column))
			);
		case 'categorical':
			return longest(Object.keys(column.categoryCounts));
		case 'boolean':
			return longest([...column.lexicon, 'true', 'false']);
		case 'date':
		case 'time':
		case 'datetime':
			return longest(
				[column.min, column.max]
					.filter((value) => Number.isFinite(value))
					.map((value) => format(value, column))
			);
		case 'text':
			return undefined;
	}
}

/**
 * Builds the virtual table's column definitions from stored statistics.
 *
 * Kinds drive alignment, `unsupported` marks columns the modelling workflow cannot use, and
 * `contentChars` sizes each track. A sample column with a display name shows it as the label
 * with the raw column name as the sublabel; otherwise only the column name is shown.
 *
 * @param stats - Column statistics from the dataset metadata.
 * @param descriptorColumns - Authored sample columns, or an empty list (uploads, failed descriptor).
 * @param formatValue - The cell formatter used for width hints.
 * @returns One table column per statistics entry, in dataset order.
 */
export function buildPreviewColumns(
	stats: readonly ColumnStats[],
	descriptorColumns: readonly Pick<AuthoredColumn, 'name' | 'displayName'>[],
	formatValue: PreviewValueFormatter
): VirtualTableColumn[] {
	const displayNames = new Map(
		descriptorColumns.map((column) => [column.name, column.displayName])
	);
	return stats.map((column) => {
		const displayName = displayNames.get(column.name)?.trim();
		const hasDisplayName =
			displayName !== undefined && displayName !== '' && displayName !== column.name;
		const chars = contentChars(column, formatValue);
		return {
			key: column.name,
			label: hasDisplayName ? displayName : column.name,
			...(hasDisplayName && { sublabel: column.name }),
			kind: kindOf(column),
			unsupported: !isModelEligibleColumnType(column.type),
			...(chars !== undefined && { contentChars: chars })
		};
	});
}
