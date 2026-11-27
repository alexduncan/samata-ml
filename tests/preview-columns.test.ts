import { describe, expect, test } from 'bun:test';
import { buildPreviewColumns, formatPreviewValue } from '../src/features/data/preview-columns';
import type { ColumnStats } from '../src/types/dataset';

const base = { missingCount: 0, missingTokens: {}, invalidCount: 0, invalidExamples: [] };
const format = (value: unknown, column: ColumnStats | undefined) =>
	formatPreviewValue(value as never, column, (n) => String(n));

const numeric = (
	name: string,
	min: number,
	max: number,
	mean: number,
	median: number
): ColumnStats => ({
	...base,
	name,
	type: 'numeric',
	count: 10,
	min,
	max,
	mean,
	median,
	integer: false,
	identifierHint: false,
	format: { prefix: '', suffix: '', thousandsSeparator: false },
	histogram: { start: 0, width: 1, counts: [] }
});

const stats: ColumnStats[] = [
	numeric('score', -1234.5, 7, 1.25, 0),
	{
		...base,
		name: 'species',
		type: 'categorical',
		distinctCount: 2,
		categoryCounts: { Adelie: 3, 'Chinstrap penguin': 1 }
	},
	{ ...base, name: 'flag', type: 'boolean', trueCount: 1, falseCount: 1, lexicon: ['yes', 'no'] },
	{
		...base,
		name: 'day',
		type: 'date',
		count: 2,
		min: 0,
		max: 86_400_000,
		format: { kind: 'date', order: 'ISO', orderAssumed: false }
	},
	{ ...base, name: 'clock', type: 'time', count: 2, min: 0, max: 3_600_000, precision: 'minute' },
	{
		...base,
		name: 'moment',
		type: 'datetime',
		count: 2,
		min: 0,
		max: 60_000,
		precision: 'minute',
		format: { kind: 'epoch', unit: 'ms' }
	},
	{ ...base, name: 'notes', type: 'text', distinctCount: null, identifierHint: false }
];

describe('buildPreviewColumns (PREV-COL-1)', () => {
	const columns = buildPreviewColumns(stats, [], format);
	const byKey = Object.fromEntries(columns.map((column) => [column.key, column]));

	test('assigns kinds and unsupported flags by type', () => {
		expect(columns.map((column) => [column.key, column.kind, column.unsupported])).toEqual([
			['score', 'numeric', false],
			['species', 'categorical', false],
			['flag', 'boolean', false],
			['day', 'temporal', true],
			['clock', 'temporal', true],
			['moment', 'temporal', true],
			['notes', 'text', true]
		]);
	});

	test('derives content widths from the formatted statistics', () => {
		expect(byKey.score?.contentChars).toBe('-1234.5'.length);
		expect(byKey.species?.contentChars).toBe('Chinstrap penguin'.length);
		expect(byKey.flag?.contentChars).toBe('false'.length);
		expect(byKey.day?.contentChars).toBe('1970-01-02'.length);
		expect(byKey.clock?.contentChars).toBe('01:00'.length);
		expect(byKey.moment?.contentChars).toBe('1970-01-01T00:01Z'.length);
		expect(byKey.notes?.contentChars).toBeUndefined();
	});

	test('uses the column name alone without descriptor columns', () => {
		expect(byKey.score).toMatchObject({ label: 'score' });
		expect(byKey.score).not.toHaveProperty('sublabel');
	});

	test('sample columns show the display name with the raw name as sublabel', () => {
		const described = buildPreviewColumns(
			stats,
			[
				{ name: 'score', displayName: 'Test score' },
				{ name: 'flag', displayName: 'flag' }
			],
			format
		);
		expect(described[0]).toMatchObject({ label: 'Test score', sublabel: 'score' });
		expect(described[2]).toMatchObject({ label: 'flag' });
		expect(described[2]).not.toHaveProperty('sublabel');
	});
});

describe('formatPreviewValue', () => {
	test('formats missing, boolean, temporal and numeric cells', () => {
		expect(format(null, undefined)).toBe('—');
		expect(format(true, undefined)).toBe('true');
		expect(format(86_400_000, stats[3])).toBe('1970-01-02');
		expect(format(3, stats[0])).toBe('3');
		expect(format('abc', undefined)).toBe('abc');
	});
});
