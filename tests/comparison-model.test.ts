import { describe, expect, test } from 'bun:test';
import {
	agreementCounts,
	comparisonBaselines,
	comparisonConfusionView,
	comparisonTableRow,
	confusionDelta,
	groupComparisons
} from '../src/features/results/comparison-model';
import { breastCancerOneShot, irisCrossValidation } from './fixtures/results/evaluations';
import { comparisonFixtures } from './fixtures/results/comparison';

describe('comparison projections', () => {
	test('WML-P5-MODEL-1: groups compatible models and rejects a mismatching axis', () => {
		const fixture = comparisonFixtures();
		expect(
			groupComparisons([...fixture.iris, fixture.oneShot, fixture.differentSeed]).map(
				(group) => group.models.length
			)
		).toEqual([3, 1, 1]);
		const evaluation = irisCrossValidation();
		const first = { num: 1, label: 'One', evaluation };
		const second = { num: 2, label: 'Two', evaluation };
		const single = {
			num: 3,
			label: 'Three',
			evaluation: { ...evaluation, partitionFingerprint: 'b'.repeat(64) }
		};
		expect(
			groupComparisons([single, second, first]).map((group) => [
				group.models.length,
				group.reason
			])
		).toEqual([
			[2, null],
			[1, 'single-model']
		]);
		const bad = { ...second, evaluation: { ...evaluation, classLabels: ['different'] } };
		expect(groupComparisons([first, bad])[0]?.reason).toBe('inconsistent');
	});

	test('WML-P5-MODEL-2: preserves pooled values and derives binary counts', () => {
		const evaluation = breastCancerOneShot();
		const row = comparisonTableRow({ num: 1, label: 'One', evaluation });
		expect(row.metrics.balancedAccuracy?.value).toBe(evaluation.pooled.test.balancedAccuracy);
		expect(row.metrics.falsePositives?.value).toBe(3);
		expect(row.metrics.falseNegatives?.value).toBe(4);
		expect(row.metrics.errors?.value).toBe(7);
		expect(row.metrics.sd?.value).toBeNull();
	});

	test('WML-P5-MODEL-2: baseline disagreement is detected independently', () => {
		const evaluation = irisCrossValidation();
		const first = { num: 1, label: 'One', evaluation };
		const second = {
			num: 2,
			label: 'Two',
			evaluation: {
				...evaluation,
				pooled: {
					...evaluation.pooled,
					baselines: {
						...evaluation.pooled.baselines,
						mostFrequent: {
							...evaluation.pooled.baselines.mostFrequent,
							accuracy: 0.123
						}
					}
				}
			}
		};
		const result = comparisonBaselines([second, first]);
		expect(result.mismatched).toEqual(['mostFrequent']);
		expect(result.rows.map((row) => row.id)).toEqual(['stratified']);
	});

	test('WML-P5-MODEL-2: fold spread and gap use aligned partition values', () => {
		const evaluation = irisCrossValidation();
		const row = comparisonTableRow({ num: 1, label: 'One', evaluation });
		const gap =
			evaluation.partitions.reduce(
				(total, part) => total + part.train.balancedAccuracy - part.test.balancedAccuracy,
				0
			) / 5;
		expect(row.metrics.gap?.value).toBeCloseTo(gap, 12);
		expect(row.metrics.sd?.value).toBeGreaterThan(0);
		expect(row.metrics.iqr?.value).toBeGreaterThanOrEqual(0);
		expect(row.metrics.falsePositives).toBeUndefined();
	});

	test('WML-P5-MODEL-3: counts agreement and differences on validated axes', () => {
		const evaluation = breastCancerOneShot();
		const first = { num: 1, label: 'One', evaluation };
		const predictions = evaluation.outputs.predictedIndex.slice();
		predictions[0] = 1;
		const matrix = Uint32Array.of(67, 4, 5, 38);
		const second = {
			num: 2,
			label: 'Two',
			evaluation: {
				...evaluation,
				outputs: { ...evaluation.outputs, predictedIndex: predictions },
				pooled: {
					...evaluation.pooled,
					test: { ...evaluation.pooled.test, confusionMatrix: matrix }
				}
			}
		};
		expect(agreementCounts([first, second])).toEqual([0, 1, 113]);
		expect(confusionDelta(first, second)).toEqual([1, -1, -1, 1]);
		expect(comparisonConfusionView(first, second, null)?.largest).toEqual({
			trueIndex: 0,
			predictedIndex: 1,
			count: -1
		});
		expect(comparisonBaselines([first, second]).rows).toHaveLength(2);
		const bad = {
			...second,
			evaluation: {
				...second.evaluation,
				outputs: { ...second.evaluation.outputs, sourceRowIndex: Uint32Array.of(999) }
			}
		};
		expect(confusionDelta(first, bad)).toBeNull();
		const wrongPartition = {
			...second,
			evaluation: {
				...second.evaluation,
				outputs: { ...second.evaluation.outputs, partitionIndex: Uint16Array.of(2) }
			}
		};
		const wrongClass = {
			...second,
			evaluation: { ...second.evaluation, positiveClassIndex: 0 }
		};
		expect(groupComparisons([first, wrongPartition])[0]?.reason).toBe('inconsistent');
		expect(groupComparisons([first, wrongClass])[0]?.reason).toBe('inconsistent');
	});
});
