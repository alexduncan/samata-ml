import type {
	ResultEnvelopeV1,
	ResultEnvelopeV2,
	TrainingRunIdentity
} from '../../../src/types/model-result';
import type { StoredEvaluation, StoredPartition } from '../../../src/types/model-evaluation';
import { reportFromConfusion } from '../results/evaluations';

/** Captured identity for durable-result fixtures. */
export const resultIdentity: TrainingRunIdentity = {
	datasetId: 'iris-fixture',
	target: 'species',
	modelNum: 1,
	modelCreatedAt: 10,
	configurationKey: 'fitted-options',
	runId: 'saved-attempt'
};

const unavailable = { available: false, reason: 'probabilities-unavailable' } as const;
const base = {
	...resultIdentity,
	schemaVersion: 1,
	algorithm: 'gaussian-nb',
	webMlRevision: 'fixture-revision',
	durationMs: 250.5,
	excludedTargetRows: 2,
	sourceRowIndices: [0, 1, 3, 4, 5, 7],
	featureNamesOut: ['measurement'],
	classLabels: [true, false],
	modelJson: { type: 'GaussianNB', means: [1, 4] },
	preprocessorJson: {
		version: 1,
		standardize: false,
		columns: [{ name: 'measurement', kind: 'numeric', mean: 2, scale: 1 }]
	},
	logEntries: [{ id: 1, timestamp: 42, level: 'status', message: { key: 'completed' } }]
} as const;

/** Builds a valid small Phase 3 (version 1) result with independent fitter and evaluation axes. */
export function fixtureLegacyTrainingResult(
	strategy: ResultEnvelopeV1['strategy'] = 'one_shot'
): ResultEnvelopeV1 {
	if (strategy === 'one_shot') {
		return {
			...base,
			strategy,
			holdout: {
				trainIndices: Uint32Array.of(0, 1, 3, 4),
				testIndices: Uint32Array.of(2, 5),
				report: {
					task: 'binary',
					sampleCount: 2,
					classes: [true, false],
					labels: [false, true],
					positiveLabel: false,
					unseenLabels: [],
					confusionMatrix: Uint32Array.of(1, 0, 0, 1),
					support: Uint32Array.of(1, 1),
					accuracy: 1,
					precision: 1,
					recall: 1,
					f1: 1,
					matthewsCorrelation: 1,
					truePositiveRate: 1,
					falsePositiveRate: 0,
					trueNegativeRate: 1,
					falseNegativeRate: 0,
					logLoss: unavailable,
					brierScore: unavailable,
					rocAuc: unavailable,
					averagePrecision: unavailable
				}
			}
		};
	}
	return {
		...base,
		strategy,
		crossValidation: {
			folds: [
				{
					foldIndex: 0,
					score: 1,
					durationMs: 1,
					validationSampleCount: 3,
					validationIndices: Uint32Array.of(0, 2, 4)
				},
				{
					foldIndex: 1,
					score: 1,
					durationMs: 2,
					validationSampleCount: 3,
					validationIndices: Uint32Array.of(1, 3, 5)
				}
			],
			diagnostics: {
				task: 'classification',
				sampleCount: 6,
				labels: [false, true],
				confusionMatrix: Uint32Array.of(3, 0, 0, 3),
				support: Uint32Array.of(3, 3),
				predictedCount: Uint32Array.of(3, 3),
				accuracy: 1,
				precision: 1,
				recall: 1,
				f1: 1,
				precisionPerClass: Float32Array.of(1, 1),
				recallPerClass: Float32Array.of(1, 1),
				f1PerClass: Float32Array.of(1, 1)
			},
			meanScore: 1,
			standardDeviation: 0
		}
	};
}

export { fixtureTrainingResult } from './results-v2';
