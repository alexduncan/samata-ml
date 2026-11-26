import { describe, expect, it } from 'bun:test';
import { DatasetProfiler, normaliseHeaders } from '../src/common/storage/profiler';

function profile(values: string[], name = 'value') {
	const profiler = new DatasetProfiler([name]);
	for (const value of values) profiler.addRow([value]);
	return profiler.elect()[0]!;
}

describe('DatasetProfiler', () => {
	it('elects from the whole file and reports tolerated invalid values', () => {
		const noisy = new DatasetProfiler(['value']);
		for (let index = 0; index < 5000; index++) noisy.addRow([String(index)]);
		for (let index = 0; index < 200; index++) noisy.addRow(['abc']);
		expect(noisy.elect()[0]!.type).not.toBe('numeric');

		const tolerant = new DatasetProfiler(['value']);
		for (let index = 0; index < 5000; index++) tolerant.addRow([String(index)]);
		for (let index = 0; index < 50; index++) tolerant.addRow(['abc']);
		expect(tolerant.elect()[0]).toMatchObject({
			type: 'numeric',
			invalidCount: 50,
			invalidExamples: ['abc']
		});
	});

	it('keeps short binary digit columns numeric unless the 1/0 election qualifies', () => {
		expect(profile(Array(10).fill('0')).type).toBe('numeric');
		expect(profile(Array(25).fill('0')).type).toBe('boolean');
		expect(profile(['0', '1', '0', '1', '0', '1', '0', '1', '0', '1']).type).toBe('boolean');
		expect(profile(['0', '1', '2']).type).toBe('numeric');
	});

	it('elects date order from forcing dates and marks an assumed DMY order', () => {
		const forced = profile(['05/03/2024', '25/03/2024'], 'date');
		expect(forced).toMatchObject({
			type: 'date',
			format: { kind: 'date', order: 'DMY', orderAssumed: false }
		});
		const assumed = profile(['05/03/2024', '06/03/2024'], 'date');
		expect(assumed).toMatchObject({
			type: 'date',
			format: { kind: 'date', order: 'DMY', orderAssumed: true }
		});
	});

	describe('temporal election', () => {
		const repeat = (value: string, count: number): string[] => Array(count).fill(value);

		it('TEMP-AC-8: elects date, datetime, time or neither from the worked examples', () => {
			expect(profile(repeat('2013-08-14', 100))).toMatchObject({
				type: 'date',
				invalidCount: 0
			});
			expect(profile(repeat('2013-08-14 00:00:00', 100))).toMatchObject({
				type: 'date',
				invalidCount: 0
			});
			expect(profile([...repeat('2013-08-14', 99), '2013-08-13 06:03:42'])).toMatchObject({
				type: 'date',
				invalidCount: 1,
				invalidExamples: ['2013-08-13 06:03:42']
			});
			expect(profile([...repeat('2013-08-14', 99), 'banana'])).toMatchObject({
				type: 'date',
				invalidCount: 1,
				invalidExamples: ['banana']
			});
			expect(
				profile([...repeat('2013-08-14', 97), ...repeat('2013-08-13 06:03:42', 3)])
			).toMatchObject({
				type: 'datetime',
				format: { kind: 'date', order: 'ISO' },
				invalidCount: 0
			});
			expect(['categorical', 'text']).toContain(
				profile([...repeat('2013-08-14', 95), ...repeat('banana', 5)]).type
			);
			expect(
				profile(Array.from({ length: 100 }, (_, i) => (i % 2 ? '09:30' : '17:45:10')))
			).toMatchObject({
				type: 'time',
				invalidCount: 0
			});
			expect(['categorical', 'text']).toContain(
				profile([...repeat('2013-08-14', 50), ...repeat('09:30', 50)]).type
			);
			expect(
				profile(['999999000', '999999731', '1000000417', '1000086400'], 'value')
			).toMatchObject({
				type: 'datetime',
				format: { kind: 'epoch', unit: 's' },
				invalidCount: 0
			});
			expect(
				profile(Array.from({ length: 50 }, (_, i) => String(1_000_000_000 + i)))
			).toMatchObject({ type: 'numeric', identifierHint: true });
			expect(
				profile(Array.from({ length: 50 }, (_, i) => String(10_000_000_000 + i * 7)))
			).toMatchObject({ type: 'numeric' });
		});

		it('TEMP-AC-9: year-last date order decides between date and datetime', () => {
			const dateOnly = Array.from({ length: 100 }, (_, i) => `${14 + (i % 10)}/08/2013`);
			expect(profile(dateOnly)).toMatchObject({
				type: 'date',
				format: { kind: 'date', order: 'DMY' }
			});
			const withTimes = dateOnly.map((value, i) => (i % 20 === 0 ? `${value} 10:00` : value));
			expect(profile(withTimes)).toMatchObject({
				type: 'datetime',
				format: { kind: 'date', order: 'DMY' }
			});
		});

		it('TEMP-AC-10: time and epoch latches switch off after a bad first 1,000 rows', () => {
			const times = [...repeat('abc', 30), ...repeat('09:30', 970), ...repeat('09:30', 4000)];
			expect(profile(times).type).not.toBe('time');
			expect(profile([...repeat('abc', 30), ...repeat('09:30', 970)]).type).not.toBe('time');
			const epochs = [
				...repeat('abc', 30),
				...Array.from({ length: 4970 }, (_, i) => String(1_700_000_000 + i * 7))
			];
			expect(profile(epochs).type).not.toBe('datetime');
		});

		it('TEMP-AC-12: a descriptor override to date uses the date-only counters', () => {
			const profiler = new DatasetProfiler(['d'], { overrides: { d: 'date' } });
			for (const value of ['14/08/2013', '05/03/2013', '20/01/2013'])
				profiler.addRow([value]);
			expect(profiler.elect()[0]).toMatchObject({
				type: 'date',
				format: { kind: 'date', order: 'DMY', orderAssumed: false },
				invalidCount: 0
			});
		});
	});

	it('applies the categorical thresholds and reports distinct overflow', () => {
		expect(
			profile(
				Array.from(
					{ length: 150 },
					(_, index) => ['Adelie', 'Chinstrap', 'Gentoo'][index % 3]!
				)
			).type
		).toBe('categorical');
		expect(profile(Array.from({ length: 45 }, (_, index) => `name-${index}`)).type).toBe(
			'text'
		);
		expect(profile(Array.from({ length: 600 }, (_, index) => `code-${index}`))).toMatchObject({
			type: 'text',
			distinctCount: null,
			distinctValues: null
		});
	});

	it('detects increasing numeric identifiers and counts missing tokens', () => {
		const profiler = new DatasetProfiler(['rowid']);
		for (let index = 1; index <= 30; index++) profiler.addRow([String(index)]);
		profiler.addRow(['NA']);
		expect(profiler.elect()[0]).toMatchObject({
			type: 'numeric',
			identifierHint: true,
			missingTokens: { na: 1 }
		});
	});

	it('normalises headers and handles ragged rows', () => {
		expect(normaliseHeaders(['\uFEFFid', '', 'id', 'id_1'])).toEqual([
			'id',
			'column_1',
			'id_2',
			'id_1'
		]);
		const profiler = new DatasetProfiler(['a', 'b']);
		expect(profiler.addRow(['one'])).toEqual({
			kept: true,
			padded: true,
			values: ['one', null]
		});
		expect(profiler.addRow(['one', 'two', 'three'])).toEqual({
			kept: false,
			padded: false,
			values: []
		});
		expect(profiler.rowCount).toBe(1);
		expect(profiler.paddedRowCount).toBe(1);
		expect(profiler.skippedRows).toEqual({ count: 1, rowNumbers: [2] });
	});

	it('applies descriptor type overrides', () => {
		const profiler = new DatasetProfiler(['pclass'], { overrides: { pclass: 'categorical' } });
		for (const value of ['1', '2', '3', '1']) profiler.addRow([value]);
		expect(profiler.elect()[0]!.type).toBe('categorical');
	});
});
