import type { StoredEvaluation, StoredPartition } from '../../../src/types/model-evaluation';
import type { ResultEnvelopeV2 } from '../../../src/types/model-result';
import { reportFromConfusion } from '../results/evaluations';
import { fixtureLegacyTrainingResult } from './results';

const unavailable = { available: false, reason: 'probabilities-unavailable' } as const;
const noScores = {
	rocAuc: unavailable,
	averagePrecision: unavailable,
	logLoss: unavailable,
	brier: unavailable
};

/** Most-frequent baseline cells: every row predicted as the first class. */
function allFirstClass(cells: readonly number[]): number[] {
	return [cells[0]! + cells[1]!, 0, cells[2]! + cells[3]!, 0];
}

function partitionFixture(
	index: number,
	kind: StoredPartition['kind'],
	test: readonly number[],
	train: readonly number[]
): StoredPartition {
	const testReport = reportFromConfusion(2, test, noScores);
	const trainReport = reportFromConfusion(2, train, noScores);
	return {
		index,
		kind,
		trainSampleCount: trainReport.sampleCount,
		testSampleCount: testReport.sampleCount,
		durationMs: 5 + index,
		timing: kind === 'holdout-test' ? 'holdout-fit' : 'fold-fit-and-score',
		test: testReport,
		train: trainReport,
		baselines: {
			mostFrequent: reportFromConfusion(2, allFirstClass(test), noScores),
			stratified: reportFromConfusion(2, test, noScores)
		}
	};
}

function evaluationFixture(
	strategy: ResultEnvelopeV2['strategy'],
	rows: { sourceRowIndex: number[]; partitionIndex: number[]; trueIndex: number[] },
	partitions: StoredPartition[],
	pooled: readonly number[]
): StoredEvaluation {
	return {
		schemaVersion: 1,
		protocol:
			strategy === 'one_shot'
				? { kind: 'one_shot', testRatio: 0.2, randomState: 42 }
				: { kind: 'cross_validation', folds: 2, randomState: 42 },
		classLabels: [true, false],
		positiveClassIndex: 1,
		partitionFingerprint: 'b'.repeat(64),
		partitions,
		pooled: {
			test: reportFromConfusion(2, pooled, noScores),
			baselines: {
				mostFrequent: reportFromConfusion(2, allFirstClass(pooled), noScores),
				stratified: reportFromConfusion(2, pooled, noScores)
			}
		},
		outputs: {
			sourceRowIndex: Uint32Array.from(rows.sourceRowIndex),
			partitionIndex: Uint16Array.from(rows.partitionIndex),
			trueIndex: Uint16Array.from(rows.trueIndex),
			predictedIndex: Uint16Array.from(rows.trueIndex),
			probabilities: null,
			probabilitySource: null,
			positiveScores: null,
			rankingScoreSource: null
		},
		curves: { thresholdSweep: null, calibration: null, ranking: null }
	};
}

/** Builds a valid small version 2 result whose evaluation matches its retained rows. */
export function fixtureTrainingResult(
	strategy: ResultEnvelopeV2['strategy'] = 'one_shot'
): ResultEnvelopeV2 {
	const legacy = fixtureLegacyTrainingResult(strategy);
	const shared = {
		datasetId: legacy.datasetId,
		target: legacy.target,
		modelNum: legacy.modelNum,
		modelCreatedAt: legacy.modelCreatedAt,
		configurationKey: legacy.configurationKey,
		runId: legacy.runId,
		algorithm: legacy.algorithm,
		webMlRevision: legacy.webMlRevision,
		durationMs: legacy.durationMs,
		excludedTargetRows: legacy.excludedTargetRows,
		sourceRowIndices: legacy.sourceRowIndices,
		featureNamesOut: legacy.featureNamesOut,
		classLabels: legacy.classLabels,
		modelJson: legacy.modelJson,
		preprocessorJson: legacy.preprocessorJson,
		logEntries: legacy.logEntries,
		schemaVersion: 2
	} as const;
	if (legacy.strategy === 'one_shot') {
		// Retained rows 2 and 5 are original rows 3 and 7.
		return {
			...shared,
			strategy: 'one_shot',
			holdout: {
				trainIndices: legacy.holdout.trainIndices,
				testIndices: legacy.holdout.testIndices
			},
			evaluation: evaluationFixture(
				'one_shot',
				{ sourceRowIndex: [3, 7], partitionIndex: [0, 0], trueIndex: [0, 1] },
				[partitionFixture(0, 'holdout-test', [1, 0, 0, 1], [2, 0, 0, 2])],
				[1, 0, 0, 1]
			)
		};
	}
	return {
		...shared,
		strategy: 'cross_validation',
		crossValidation: legacy.crossValidation,
		evaluation: evaluationFixture(
			'cross_validation',
			{
				sourceRowIndex: [0, 1, 3, 4, 5, 7],
				partitionIndex: [0, 1, 0, 1, 0, 1],
				trueIndex: [0, 1, 0, 1, 0, 1]
			},
			[
				partitionFixture(0, 'outer-fold', [2, 0, 0, 1], [1, 0, 0, 2]),
				partitionFixture(1, 'outer-fold', [1, 0, 0, 2], [2, 0, 0, 1])
			],
			[3, 0, 0, 3]
		)
	};
}
