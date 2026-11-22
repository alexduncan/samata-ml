import { describe, expect, test } from 'bun:test';
import { decodeStoredEvaluation } from '../src/features/results/evaluation-decoder';
import type { StoredEvaluation } from '../src/types/model-evaluation';
import {
	breastCancerOneShot,
	irisCrossValidation,
	manyClasses,
	svcBinaryNoProbabilities
} from './fixtures/results/evaluations';

type Mutable = Record<string, any>;

const fixtures = {
	irisCrossValidation,
	breastCancerOneShot,
	svcBinaryNoProbabilities,
	manyClasses
};

/** Copies a fixture, preserving typed arrays, so a test can corrupt it freely. */
function copy(build: () => StoredEvaluation): Mutable {
	return structuredClone(build()) as unknown as Mutable;
}

/**
 * Moves one count from `fall` to `rise` on a plateau of `rise`, keeping every row sum and class
 * total consistent while making `rise` increase with the threshold.
 */
function shiftSweep(e: Mutable, rise: 'tp' | 'fp', fall: 'fn' | 'tn'): void {
	const sweep = e.curves.thresholdSweep;
	let i = 1;
	while (
		i < sweep[rise].length &&
		!(sweep[rise][i] === sweep[rise][i - 1] && sweep[fall][i] > 0)
	) {
		i += 1;
	}
	if (i === sweep[rise].length) throw new Error('fixture has no plateau to corrupt');
	sweep[rise][i] += 1;
	sweep[fall][i] -= 1;
}

const corruptions: [string, () => StoredEvaluation | Mutable, (e: Mutable) => void][] = [
	['unknown schema version', () => copy(breastCancerOneShot), (e) => (e.schemaVersion = 2)],
	['invalid protocol tag', () => copy(breastCancerOneShot), (e) => (e.protocol.kind = 'holdout')],
	['too few folds', () => copy(irisCrossValidation), (e) => (e.protocol.folds = 1)],
	['class count below two', () => copy(breastCancerOneShot), (e) => (e.classLabels = ['a'])],
	[
		'class count above 65,535',
		() => copy(breastCancerOneShot),
		(e) => (e.classLabels = Array.from({ length: 65_536 }, (_, i) => i))
	],
	['invalid label', () => copy(breastCancerOneShot), (e) => (e.classLabels = ['a', Number.NaN])],
	['duplicate label', () => copy(breastCancerOneShot), (e) => (e.classLabels = ['a', 'a'])],
	['positive index not 1', () => copy(breastCancerOneShot), (e) => (e.positiveClassIndex = 0)],
	[
		'multiclass positive index',
		() => copy(irisCrossValidation),
		(e) => (e.positiveClassIndex = 1)
	],
	[
		'fingerprint case',
		() => copy(breastCancerOneShot),
		(e) => (e.partitionFingerprint = 'A'.repeat(64))
	],
	[
		'fingerprint length',
		() => copy(breastCancerOneShot),
		(e) => (e.partitionFingerprint = 'a'.repeat(63))
	],
	['partition count', () => copy(irisCrossValidation), (e) => e.partitions.pop()],
	[
		'partition order',
		() => copy(irisCrossValidation),
		(e) => ([e.partitions[0], e.partitions[1]] = [e.partitions[1], e.partitions[0]])
	],
	[
		'partition kind',
		() => copy(irisCrossValidation),
		(e) => (e.partitions[2].kind = 'holdout-test')
	],
	[
		'partition timing',
		() => copy(breastCancerOneShot),
		(e) => (e.partitions[0].timing = 'fold-fit-and-score')
	],
	[
		'report count mismatch',
		() => copy(breastCancerOneShot),
		(e) => (e.partitions[0].testSampleCount = 113)
	],
	[
		'confusion matrix type',
		() => copy(breastCancerOneShot),
		(e) => (e.pooled.test.confusionMatrix = Float32Array.from(e.pooled.test.confusionMatrix))
	],
	[
		'confusion matrix length',
		() => copy(breastCancerOneShot),
		(e) => (e.pooled.test.confusionMatrix = new Uint32Array(3))
	],
	[
		'confusion matrix total',
		() => copy(breastCancerOneShot),
		(e) => (e.pooled.test.confusionMatrix[0] += 1)
	],
	[
		'support disagrees with matrix',
		() => copy(breastCancerOneShot),
		(e) => (e.partitions[0].test.support[0] += 1)
	],
	['accuracy above one', () => copy(breastCancerOneShot), (e) => (e.pooled.test.accuracy = 1.5)],
	['NaN macro F1', () => copy(breastCancerOneShot), (e) => (e.pooled.test.macroF1 = Number.NaN)],
	[
		'precision out of range',
		() => copy(breastCancerOneShot),
		(e) => (e.pooled.test.precisionPerClass[0] = 2)
	],
	[
		'unknown unavailable reason',
		() => copy(breastCancerOneShot),
		(e) => (e.pooled.test.mcc = { available: false, reason: 'because' })
	],
	[
		'available metric without value',
		() => copy(breastCancerOneShot),
		(e) => (e.pooled.test.brier = { available: true })
	],
	[
		'negative log loss',
		() => copy(breastCancerOneShot),
		(e) => (e.pooled.test.logLoss = { available: true, value: -1 })
	],
	[
		'pooled sample count',
		() => copy(irisCrossValidation),
		(e) => (e.pooled.test.sampleCount = 149)
	],
	[
		'baseline sample count',
		() => copy(breastCancerOneShot),
		(e) => (e.pooled.baselines.stratified.sampleCount = 113)
	],
	[
		'duplicate source row',
		() => copy(breastCancerOneShot),
		(e) => (e.outputs.sourceRowIndex[5] = e.outputs.sourceRowIndex[4])
	],
	[
		'unsorted source rows',
		() => copy(breastCancerOneShot),
		(e) => (e.outputs.sourceRowIndex[5] = 0)
	],
	[
		'source row type',
		() => copy(breastCancerOneShot),
		(e) => (e.outputs.sourceRowIndex = Float64Array.from(e.outputs.sourceRowIndex))
	],
	[
		'output length',
		() => copy(breastCancerOneShot),
		(e) => (e.outputs.trueIndex = new Uint16Array(10))
	],
	['true index off axis', () => copy(breastCancerOneShot), (e) => (e.outputs.trueIndex[0] = 2)],
	[
		'predicted index off axis',
		() => copy(breastCancerOneShot),
		(e) => (e.outputs.predictedIndex[0] = 9)
	],
	[
		'partition index off range',
		() => copy(breastCancerOneShot),
		(e) => (e.outputs.partitionIndex[0] = 1)
	],
	[
		'partition row counts',
		() => copy(irisCrossValidation),
		(e) => (e.outputs.partitionIndex[0] = 1)
	],
	[
		'probabilities without source',
		() => copy(breastCancerOneShot),
		(e) => (e.outputs.probabilitySource = null)
	],
	[
		'source without probabilities',
		() => copy(svcBinaryNoProbabilities),
		(e) => (e.outputs.probabilitySource = 'native')
	],
	[
		'unknown probability source',
		() => copy(breastCancerOneShot),
		(e) => (e.outputs.probabilitySource = 'magic')
	],
	[
		'probability out of range',
		() => copy(breastCancerOneShot),
		(e) => (e.outputs.probabilities[3] = 1.2)
	],
	[
		'probability length',
		() => copy(breastCancerOneShot),
		(e) => (e.outputs.probabilities = new Float64Array(5))
	],
	[
		'scores without source',
		() => copy(breastCancerOneShot),
		(e) => (e.outputs.rankingScoreSource = null)
	],
	[
		'scores on multiclass',
		() => copy(irisCrossValidation),
		(e) => {
			e.outputs.positiveScores = new Float64Array(150);
			e.outputs.rankingScoreSource = 'probability';
		}
	],
	[
		'sweep without probabilities',
		() => copy(svcBinaryNoProbabilities),
		(e) => (e.curves.thresholdSweep = copy(breastCancerOneShot).curves.thresholdSweep)
	],
	['sweep counts', () => copy(breastCancerOneShot), (e) => (e.curves.thresholdSweep.tp[10] += 1)],
	[
		'sweep tp that increases with the threshold',
		() => copy(breastCancerOneShot),
		(e) => shiftSweep(e, 'tp', 'fn')
	],
	[
		'sweep fp that increases with the threshold',
		() => copy(breastCancerOneShot),
		(e) => shiftSweep(e, 'fp', 'tn')
	],
	[
		'sweep thresholds',
		() => copy(breastCancerOneShot),
		(e) => (e.curves.thresholdSweep.thresholds[3] = 0.5)
	],
	[
		'calibration without probabilities',
		() => copy(svcBinaryNoProbabilities),
		(e) => (e.curves.calibration = copy(breastCancerOneShot).curves.calibration)
	],
	[
		'calibration counts',
		() => copy(breastCancerOneShot),
		(e) => (e.curves.calibration.count[0] += 1)
	],
	[
		'calibration mean in empty bin',
		() => copy(irisCrossValidation),
		(e) => (e.curves.calibration.meanPredicted[0] = 0.1)
	],
	[
		'calibration null in non-empty bin',
		() => copy(irisCrossValidation),
		(e) => (e.curves.calibration.observed[7] = null)
	],
	[
		'calibration error out of range',
		() => copy(breastCancerOneShot),
		(e) => (e.curves.calibration.expectedCalibrationError = 2)
	],
	['ranking entry count', () => copy(irisCrossValidation), (e) => e.curves.ranking.pop()],
	[
		'ranking class order',
		() => copy(irisCrossValidation),
		(e) => (e.curves.ranking[0].classIndex = 1)
	],
	[
		'ranking without scores',
		() => copy(svcBinaryNoProbabilities),
		(e) => {
			e.outputs.positiveScores = null;
			e.outputs.rankingScoreSource = null;
		}
	],
	[
		'ranking coordinates',
		() => copy(irisCrossValidation),
		(e) => (e.curves.ranking[1].roc.tpr = new Float64Array(5))
	]
];

describe('decodeStoredEvaluation', () => {
	test.each(Object.entries(fixtures))('WML-P4-EVAL-1: decodes %s', (_, build) => {
		const decoded = decodeStoredEvaluation(build());
		expect(decoded).not.toBeNull();
		expect(decoded!.pooled.test.sampleCount).toBe(
			decoded!.partitions.reduce((sum, part) => sum + part.testSampleCount, 0)
		);
	});

	test('WML-P4-EVAL-1: fixtures cover the planned shapes', () => {
		const iris = decodeStoredEvaluation(irisCrossValidation())!;
		expect(iris.partitions).toHaveLength(5);
		expect(iris.classLabels).toHaveLength(3);
		const cancer = decodeStoredEvaluation(breastCancerOneShot())!;
		expect(cancer.curves.thresholdSweep).not.toBeNull();
		const svc = decodeStoredEvaluation(svcBinaryNoProbabilities())!;
		expect(svc.outputs.probabilities).toBeNull();
		expect(svc.curves.thresholdSweep).toBeNull();
		expect(svc.curves.calibration).toBeNull();
		expect(svc.curves.ranking).not.toBeNull();
		expect(svc.pooled.test.logLoss).toEqual({
			available: false,
			reason: 'probabilities-unavailable'
		});
		expect(decodeStoredEvaluation(manyClasses())!.classLabels).toHaveLength(25);
	});

	test.each(corruptions)('WML-P4-EVAL-1: rejects %s', (_, build, corrupt) => {
		const value = build() as Mutable;
		corrupt(value);
		expect(decodeStoredEvaluation(value)).toBeNull();
	});

	test('WML-P4-EVAL-1: rejects values that are not evaluations', () => {
		for (const value of [null, undefined, 3, 'text', [], {}]) {
			expect(decodeStoredEvaluation(value)).toBeNull();
		}
	});

	test('WML-P4-EVAL-1: an empty calibration bin keeps null means and its neighbours', () => {
		const decoded = decodeStoredEvaluation(irisCrossValidation())!;
		const calibration = decoded.curves.calibration!;
		expect(calibration.count[5]).toBe(0);
		expect(calibration.meanPredicted[5]).toBeNull();
		expect(calibration.observed[5]).toBeNull();
		expect(calibration.meanPredicted[6]).toBe(0.65);
		expect(calibration.observed[6]).toBe(0.6);
	});

	test('WML-P4-EVAL-1: retains upstream metric reasons exactly', () => {
		const decoded = decodeStoredEvaluation(manyClasses())!;
		expect(decoded.pooled.test.rocAuc).toEqual({
			available: false,
			reason: 'probabilities-unavailable'
		});
	});
});
