import { describe, expect, it } from 'bun:test';
import { readFile } from 'node:fs/promises';
import {
	BOOLEAN_LEXICON_PAIRS,
	coerceCell,
	headerSuggestsTime,
	matchBoolean,
	normaliseMissing,
	parseDate,
	parseEpoch,
	parseNumber,
	toEpochMs
} from '../src/common/storage/cells';
import {
	CHECKPOINT_ROWS,
	DATETIME_FIRST_CHECKPOINT,
	FINE_BINS,
	HISTOGRAM_MAX_BINS,
	MAX_COLUMNS,
	MAX_FILE_BYTES,
	MAX_INVALID_EXAMPLES,
	MAX_SKIPPED_ROW_NUMBERS,
	MAX_TRACKED_DISTINCT,
	MEDIAN_COLLECT_LIMIT,
	PARSE_CHUNK_BYTES,
	PASS_BATCH_ROWS,
	STORAGE_HEADROOM_FACTOR,
	TYPE_MATCH_THRESHOLD
} from '../src/features/data/ingestion/limits';

describe('cell detectors', () => {
	it('parses supported numbers and rejects malformed numeric spellings', () => {
		expect(parseNumber('3.5')?.value).toBe(3.5);
		expect(parseNumber('-1e3')?.value).toBe(-1000);
		expect(parseNumber('.5')?.value).toBe(0.5);
		expect(parseNumber('$1,234.50')).toEqual({
			value: 1234.5,
			prefix: '$',
			suffix: '',
			grouped: true
		});
		expect(parseNumber('45%')).toEqual({ value: 45, prefix: '', suffix: '%', grouped: false });
		expect(parseNumber('0')?.value).toBe(0);
		expect(parseNumber('0.5')?.value).toBe(0.5);
		for (const value of ['01', '007', '1,23', 'Infinity', '0x1F', '$-', '1.2.3']) {
			expect(parseNumber(value)).toBeNull();
		}
	});

	it('matches boolean tokens as five true/false lexicon pairs', () => {
		expect(BOOLEAN_LEXICON_PAIRS[2]).toEqual(['yes', 'no']);
		expect(Math.floor(matchBoolean('Yes') / 2)).toBe(2);
		expect(Math.floor(matchBoolean('no') / 2)).toBe(2);
		expect(BOOLEAN_LEXICON_PAIRS[Math.floor(matchBoolean('1.0') / 2)]).toEqual(['1', '0']);
		expect(matchBoolean('maybe')).toBe(-1);
	});

	it('parses epoch timestamps only in the supported unit and date window', () => {
		expect(parseEpoch('1700000000')).toEqual({ ms: 1_700_000_000_000, unit: 's' });
		expect(parseEpoch('1700000000000')).toEqual({ ms: 1_700_000_000_000, unit: 'ms' });
		expect(parseEpoch('1700000000000000')).toEqual({ ms: 1_700_000_000_000, unit: 'us' });
		for (const value of ['0315532800', '99999', '315532799', '2524608000', '1700000000.5']) {
			expect(parseEpoch(value)).toBeNull();
		}
	});

	it('parses ISO, numeric and named dates with explicit calendar and time bounds', () => {
		expect(parseDate('2024-02-29')?.form).toBe('iso');
		expect(parseDate('2023-02-29')).toBeNull();
		expect(toEpochMs(parseDate('2024-01-15T10:30:00+01:00')!, 'ISO')).toBe(
			Date.UTC(2024, 0, 15, 9, 30)
		);
		expect(parseDate('15/01/2024')?.firstPart).toBe(15);
		expect(parseDate('3 March 2024')?.form).toBe('named');
		expect(parseDate('Mar 3, 2024')?.form).toBe('named');
		expect(parseDate('Model 2024')).toBeNull();
		expect(parseDate('10-2')).toBeNull();
		expect(parseDate('10/02/24')?.y).toBe(2024);
		expect(parseDate('10/02/75')?.y).toBe(1975);
	});

	it('preserves date detail, ordinals, offsets and calendar validation', () => {
		expect(parseDate('2024-01-15T10:30:00.5Z')).toMatchObject({ ms: 500, offsetMin: 0 });
		expect(parseDate('2024-01-15T10:30+0530')?.offsetMin).toBe(330);
		for (const value of ['2024-01-15T24:00', '2024-01-15Z', '2024/01-15']) {
			expect(parseDate(value)).toBeNull();
		}
		expect(parseDate('2024/1/5')).toMatchObject({ form: 'numeric', m: 1, d: 5 });
		expect(parseDate('3rd Sept. 2024')?.m).toBe(9);
		expect(parseDate('3 Marchember 2024')).toBeNull();
		expect(parseDate('15/01/2024 09:05')?.hasTime).toBe(true);
		expect(parseDate('13/13/2024')).toBeNull();
		expect(parseDate('31/04/2024')).toBeNull();
	});

	it('converts ambiguous dates according to the selected order', () => {
		const ambiguous = parseDate('05/03/2024')!;
		expect(toEpochMs(ambiguous, 'DMY')).toBe(Date.UTC(2024, 2, 5));
		expect(toEpochMs(ambiguous, 'MDY')).toBe(Date.UTC(2024, 4, 3));
		expect(toEpochMs(parseDate('25/03/2024')!, 'MDY')).toBeNull();
		expect(toEpochMs(ambiguous, 'ISO')).toBeNull();
		expect(toEpochMs(parseDate('2024-01-15')!, 'MDY')).toBe(Date.UTC(2024, 0, 15));
	});

	it('uses whole timestamp words for the header gate', () => {
		for (const name of ['created_at', 'eventTime', 'ts', 'Date']) {
			expect(headerSuggestsTime(name)).toBe(true);
		}
		for (const name of ['counts', 'overtime', 'posts']) {
			expect(headerSuggestsTime(name)).toBe(false);
		}
	});

	it('normalises default, replacement and implicit missing values', () => {
		expect(normaliseMissing(' NA ')).toEqual({ value: null, missingToken: 'na' });
		expect(normaliseMissing(' Not Available ', ['not available'])).toEqual({
			value: null,
			missingToken: 'not available'
		});
		expect(normaliseMissing('null', ['not available'])).toEqual({
			value: 'null',
			missingToken: null
		});
		expect(normaliseMissing('   ', ['not available'])).toEqual({
			value: null,
			missingToken: ''
		});
		expect(normaliseMissing('0', [], [0])).toEqual({ value: null, missingToken: '0' });
		expect(normaliseMissing('0.0', [], [0])).toEqual({ value: null, missingToken: '0.0' });
	});

	it('coerces supported typed values using their selected formats', () => {
		expect(
			coerceCell('2,500', 'numeric', { prefix: '', suffix: '', thousandsSeparator: true })
		).toBe(2500);
		expect(coerceCell('Yes', 'boolean', ['yes', 'no'])).toBe(true);
		expect(
			coerceCell('2024-01-15', 'datetime', {
				kind: 'date',
				order: 'ISO',
				orderAssumed: false,
				hasTime: false
			})
		).toBe(Date.UTC(2024, 0, 15));
		expect(coerceCell('note', 'text')).toBe('note');
		expect(
			coerceCell('bad', 'datetime', {
				kind: 'date',
				order: 'ISO',
				orderAssumed: false,
				hasTime: false
			})
		).toBeNull();
	});

	it('exports the approved ingestion limits', () => {
		expect(MAX_FILE_BYTES).toBe(200 * 1024 * 1024);
		expect(MAX_COLUMNS).toBe(200);
		expect(PARSE_CHUNK_BYTES).toBe(1024 * 1024);
		expect(PASS_BATCH_ROWS).toBe(5000);
		expect(MAX_TRACKED_DISTINCT).toBe(500);
		expect(DATETIME_FIRST_CHECKPOINT).toBe(1000);
		expect(CHECKPOINT_ROWS).toBe(50_000);
		expect(TYPE_MATCH_THRESHOLD).toBe(0.98);
		expect(HISTOGRAM_MAX_BINS).toBe(100);
		expect(FINE_BINS).toBe(2048);
		expect(MEDIAN_COLLECT_LIMIT).toBe(1_000_000);
		expect(MAX_SKIPPED_ROW_NUMBERS).toBe(10);
		expect(MAX_INVALID_EXAMPLES).toBe(5);
		expect(STORAGE_HEADROOM_FACTOR).toBe(3);
	});

	it('avoids implementation-dependent date parsing APIs', async () => {
		const source = await readFile(
			new URL('../src/common/storage/cells.ts', import.meta.url),
			'utf8'
		);
		expect(source).not.toContain('Date.parse');
		expect(source).not.toContain('Temporal');
		expect(source.match(/new Date\(/g)).toHaveLength(1);
		expect(source).toContain('new Date(Date.UTC(');
	});
});
