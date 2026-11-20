import { describe, expect, it } from 'bun:test';
import {
	computeTrainingSetupBounds,
	createCrossValidationSetup,
	formatTrainingSetupSummary,
	validateFoldCount
} from '../src/features/models/training-setup';
import type { CategoricalColumnStats } from '../src/types/dataset';
import { DEFAULT_ONE_SHOT_SETUP } from '../src/types/state';

const baseStats = {
	name: 'target',
	missingCount: 0,
	missingTokens: {},
	invalidCount: 0,
	invalidExamples: []
};

function categorical(categoryCounts: Record<string, number>): CategoricalColumnStats {
	return {
		...baseStats,
		type: 'categorical',
		distinctCount: Object.keys(categoryCounts).length,
		categoryCounts
	};
}

describe('Training setup rules', () => {
	it('WML-P2-UTIL-1: limits folds by the smallest observed class and the UI maximum', () => {
		for (const [count, maxFolds] of [
			[2, 2],
			[4, 4],
			[50, 10]
		] as const) {
			expect(
				computeTrainingSetupBounds(
					categorical({ majority: 100, minority: count, unobserved: 0 })
				)
			).toEqual({ maxFolds, minClassCount: count, blocked: false });
		}
		expect(
			computeTrainingSetupBounds({
				...baseStats,
				type: 'boolean',
				trueCount: 6,
				falseCount: 3,
				lexicon: ['true', 'false']
			})
		).toEqual({ maxFolds: 3, minClassCount: 3, blocked: false });
	});

	it('WML-P2-UTIL-1: blocks a single observed class and a singleton minority', () => {
		expect(computeTrainingSetupBounds(categorical({ observed: 100, unobserved: 0 }))).toEqual({
			maxFolds: 0,
			minClassCount: 0,
			blocked: true
		});
		expect(computeTrainingSetupBounds(categorical({ majority: 100, minority: 1 }))).toEqual({
			maxFolds: 0,
			minClassCount: 1,
			blocked: true
		});
	});

	it('WML-P2-UTIL-1: treats unavailable, unsupported and malformed counts as unknown', () => {
		const unavailable = { maxFolds: 0, minClassCount: null, blocked: true };
		expect(computeTrainingSetupBounds(null)).toEqual(unavailable);
		expect(
			computeTrainingSetupBounds({
				...baseStats,
				type: 'text',
				distinctCount: 2,
				identifierHint: false
			})
		).toEqual(unavailable);
		for (const count of [-1, 1.5, Infinity, NaN]) {
			expect(
				computeTrainingSetupBounds(categorical({ majority: 100, minority: count }))
			).toEqual(unavailable);
		}
		expect(
			computeTrainingSetupBounds({
				...categorical({}),
				// Exercise persisted counts that do not match the declared metadata type.
				categoryCounts: JSON.parse('[100, 4]')
			})
		).toEqual(unavailable);
	});

	it('WML-P2-UTIL-2: distinguishes invalid numbers from numbers outside the fold range', () => {
		const maxFolds = 5;
		for (const folds of [NaN, Infinity]) {
			expect(validateFoldCount(folds, maxFolds)).toBe('invalid-number');
		}
		for (const folds of [1, 3.5, maxFolds + 1]) {
			expect(validateFoldCount(folds, maxFolds)).toBe('out-of-range');
		}
		expect(validateFoldCount(2, maxFolds)).toBeNull();
		expect(validateFoldCount(maxFolds, maxFolds)).toBeNull();
	});

	it('WML-P2-UTIL-2: creates equal fold counts and formats both saved strategies', () => {
		const labels = {
			oneShot: 'One-Shot (80% / 20%)',
			crossValidation: (folds: number) => `Cross-Validation (${folds} folds)`
		};
		const setup = createCrossValidationSetup(7);
		expect(setup).toEqual({ type: 'nested_cv', outerFolds: 7, innerFolds: 7, randomState: 42 });
		expect(formatTrainingSetupSummary(DEFAULT_ONE_SHOT_SETUP, labels)).toBe(
			'One-Shot (80% / 20%)'
		);
		expect(formatTrainingSetupSummary(createCrossValidationSetup(5), labels)).toBe(
			'Cross-Validation (5 folds)'
		);
	});
});
