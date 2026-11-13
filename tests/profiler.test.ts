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
			type: 'datetime',
			format: { kind: 'date', order: 'DMY', orderAssumed: false }
		});
		const assumed = profile(['05/03/2024', '06/03/2024'], 'date');
		expect(assumed).toMatchObject({
			type: 'datetime',
			format: { kind: 'date', order: 'DMY', orderAssumed: true }
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
