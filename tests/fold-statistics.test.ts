import { describe, expect, test } from 'bun:test';
import { foldSummary } from '../src/common/evaluation/fold-statistics';

describe('foldSummary', () => {
	test('WML-P4-EVAL-2: matches hand-computed values for three folds', () => {
		const summary = foldSummary([0.8, 0.9, 1]);
		expect(summary.mean).toBeCloseTo(0.9, 12);
		expect(summary.sd).toBeCloseTo(0.1, 12);
		expect(summary.q1).toBeCloseTo(0.85, 12);
		expect(summary.median).toBeCloseTo(0.9, 12);
		expect(summary.q3).toBeCloseTo(0.95, 12);
		expect(summary.iqr).toBeCloseTo(0.1, 12);
	});

	test('WML-P4-EVAL-2: matches a hand-computed five-value case', () => {
		// Sorted 1 2 4 8 16: mean 6.2, squared deviations sum 148.8, sample SD sqrt(37.2), Q1 2, Q3 8.
		const summary = foldSummary([16, 1, 8, 2, 4]);
		expect(summary.mean).toBeCloseTo(6.2, 12);
		expect(summary.sd).toBeCloseTo(Math.sqrt(37.2), 12);
		expect(summary.q1).toBe(2);
		expect(summary.median).toBe(4);
		expect(summary.q3).toBe(8);
		expect(summary.iqr).toBe(6);
	});

	test('WML-P4-EVAL-2: one value has no spread', () => {
		expect(foldSummary([0.75])).toEqual({
			mean: 0.75,
			sd: null,
			q1: null,
			median: 0.75,
			q3: null,
			iqr: null
		});
	});

	test('WML-P4-EVAL-2: empty and non-finite inputs throw', () => {
		expect(() => foldSummary([])).toThrow();
		expect(() => foldSummary([0.5, Number.NaN])).toThrow();
		expect(() => foldSummary([0.5, Infinity])).toThrow();
	});
});
