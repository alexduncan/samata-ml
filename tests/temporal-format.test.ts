import { describe, expect, it } from 'bun:test';
import { formatTemporalValue } from '../src/features/data/temporal-format';
import type { DateColumnStats, DatetimeColumnStats, TimeColumnStats } from '../src/types/dataset';

const shared = {
	name: 'c',
	missingCount: 0,
	missingTokens: {},
	invalidCount: 0,
	invalidExamples: [],
	count: 1,
	min: 0,
	max: 0
};
const dateStats: DateColumnStats = {
	...shared,
	type: 'date',
	format: { kind: 'date', order: 'ISO', orderAssumed: false }
};
const time = (precision: TimeColumnStats['precision']): TimeColumnStats => ({
	...shared,
	type: 'time',
	precision
});
const datetime = (precision?: DatetimeColumnStats['precision']): DatetimeColumnStats => ({
	...shared,
	type: 'datetime',
	...(precision ? { precision } : {}),
	format: { kind: 'epoch', unit: 'ms' }
});

describe('formatTemporalValue', () => {
	it('TEMP-AC-13: formats dates, times and datetimes by precision from UTC fields', () => {
		expect(formatTemporalValue(Date.UTC(2013, 7, 14), dateStats)).toBe('2013-08-14');
		expect(formatTemporalValue(34_200_000, time('minute'))).toBe('09:30');
		expect(formatTemporalValue(63_910_000, time('second'))).toBe('17:45:10');
		expect(formatTemporalValue(86_399_999, time('millisecond'))).toBe('23:59:59.999');
		const instant = Date.UTC(2013, 7, 13, 6, 3, 42);
		expect(formatTemporalValue(instant, datetime('second'))).toBe('2013-08-13T06:03:42Z');
		expect(formatTemporalValue(instant, datetime('minute'))).toBe('2013-08-13T06:03Z');
		expect(formatTemporalValue(instant + 5, datetime('millisecond'))).toBe(
			'2013-08-13T06:03:42.005Z'
		);
		expect(formatTemporalValue(instant, datetime())).toBe('2013-08-13T06:03:42.000Z');
	});
});
