import { expect, test } from 'bun:test';
import { headlineMetrics } from '../src/common/evaluation/headline-metrics';
import { foldSummary } from '../src/common/evaluation/fold-statistics';
import { breastCancerOneShot, irisCrossValidation } from './fixtures/results/evaluations';

test('WML-P4-EVAL-5: headline metrics come from the pooled held-out report', () => {
	const evaluation = breastCancerOneShot();
	const { test: pooled } = evaluation.pooled;
	expect(headlineMetrics(evaluation)).toEqual({
		balancedAccuracy: pooled.balancedAccuracy,
		accuracy: pooled.accuracy,
		macroF1: pooled.macroF1
	});
});

test('WML-P4-EVAL-5: cross-validation adds the sample SD of per-fold balanced accuracy', () => {
	const evaluation = irisCrossValidation();
	const expected = foldSummary(evaluation.partitions.map((part) => part.test.balancedAccuracy));
	const metrics = headlineMetrics(evaluation);
	expect(metrics.balancedAccuracySd).toBe(expected.sd!);
	expect(metrics.balancedAccuracySd).toBeGreaterThan(0);
	expect(metrics.balancedAccuracy).toBe(evaluation.pooled.test.balancedAccuracy);
});
