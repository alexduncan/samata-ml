import type { ComparisonModel } from '../../../src/features/results/comparison-model';
import { breastCancerOneShot, irisCrossValidation } from './evaluations';

/** Evaluations with shared and distinct partition identities for comparison tests. */
export function comparisonFixtures(): {
	iris: ComparisonModel[];
	oneShot: ComparisonModel;
	differentSeed: ComparisonModel;
	binary: ComparisonModel[];
} {
	const evaluation = irisCrossValidation();
	const iris = [1, 2, 3].map((num) => ({
		num,
		label: `Model ${num}`,
		evaluation: irisCrossValidation()
	}));
	const partition = evaluation.partitions[0]!;
	const positions = Array.from(evaluation.outputs.partitionIndex, (value, index) =>
		value === partition.index ? index : -1
	).filter((index) => index >= 0);
	const oneShot = {
		...evaluation,
		protocol: { kind: 'one_shot' as const, testRatio: 0.2, randomState: 42 },
		partitionFingerprint: 'b'.repeat(64),
		partitions: [
			{ ...partition, kind: 'holdout-test' as const, timing: 'holdout-fit' as const }
		],
		pooled: { test: partition.test, baselines: partition.baselines },
		outputs: {
			...evaluation.outputs,
			sourceRowIndex: Uint32Array.from(
				positions,
				(index) => evaluation.outputs.sourceRowIndex[index]!
			),
			partitionIndex: Uint16Array.from(positions, () => 0),
			trueIndex: Uint16Array.from(positions, (index) => evaluation.outputs.trueIndex[index]!),
			predictedIndex: Uint16Array.from(
				positions,
				(index) => evaluation.outputs.predictedIndex[index]!
			),
			probabilities: null,
			probabilitySource: null,
			positiveScores: null,
			rankingScoreSource: null
		}
	};
	return {
		iris,
		oneShot: { num: 4, label: 'Model 4', evaluation: oneShot },
		differentSeed: {
			num: 5,
			label: 'Model 5',
			evaluation: {
				...evaluation,
				partitionFingerprint: 'c'.repeat(64),
				protocol: { kind: 'cross_validation', folds: 5, randomState: 7 }
			}
		},
		binary: [6, 7].map((num) => ({
			num,
			label: `Model ${num}`,
			evaluation: breastCancerOneShot()
		}))
	};
}
