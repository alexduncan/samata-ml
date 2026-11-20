import { expect, test } from 'bun:test';
import { stratifiedTrainTestSplit } from 'web-ml';
import type { ClassifierId } from '../src/features/models/model-catalogue';
import {
	buildClassificationRequest,
	configureClassifier
} from '../src/features/models/training/classifier-adapters';
import { PartitionDatasetProvider } from '../src/features/models/training/partition-provider';
import type { PreparedClassification } from '../src/features/models/training/types';
import { createCrossValidationSetup } from '../src/features/models/training-setup';
import { DEFAULT_ONE_SHOT_SETUP, type HyperparameterValue } from '../src/types/state';

const runtime = { stratifiedTrainTestSplit };
const targetCodes = Float64Array.from({ length: 12 }, (_, index) => index % 2);
const prepared: PreparedClassification = {
	features: Float64Array.from({ length: 12 }, (_, index) => index * 2),
	columns: [{ name: 'measurement', kind: 'numeric' }],
	targetCodes,
	classLabels: [false, true],
	sourceRowIndices: Array.from({ length: 12 }, (_, index) => index + 1),
	excludedTargetRows: 1
};
const context = { rowCount: 12, classCount: 2 };
const cases: [ClassifierId, Record<string, HyperparameterValue>][] = [
	['bernoulli-nb', { binarize: null }],
	['decision-tree-classifier', { maxDepth: 4 }],
	['gaussian-nb', { varSmoothing: 0.001 }],
	['k-neighbors-classifier', { nNeighbors: 2 }],
	['logistic-regression', { fitIntercept: false }],
	['mlp-classifier', { hiddenLayerSizes: [3, 2] }],
	['multinomial-nb', { alpha: 0.25 }],
	['support-vector-classifier', { kernel: 'linear' }]
];

test.each(cases)('WML-P3-DATA-3: adapts %s in both strategies', async (algorithm, overrides) => {
	const { classifier } = configureClassifier(algorithm, overrides, context);
	const oneShot = buildClassificationRequest(
		runtime,
		classifier,
		prepared,
		DEFAULT_ONE_SHOT_SETUP
	);
	const cv = buildClassificationRequest(
		runtime,
		classifier,
		prepared,
		createCrossValidationSetup(3)
	);
	if (oneShot.strategy !== 'one_shot' || cv.strategy !== 'cross_validation') {
		throw new Error('Training request did not preserve its strategy');
	}

	for (const request of [oneShot.request, cv.request]) {
		expect(request).toMatchObject({
			algorithm,
			options: overrides,
			classLabels: [false, true],
			preprocessing: { columns: prepared.columns, standardize: false }
		});
		expect(request.options).toEqual(overrides);
		expect(request.data).toBeInstanceOf(PartitionDatasetProvider);
	}

	const { data: trainProvider, validation } = oneShot.request;
	expect(validation?.data).toBeInstanceOf(PartitionDatasetProvider);
	expect(oneShot.trainIndices.length + oneShot.testIndices.length).toBe(targetCodes.length);
	expect(trainProvider).toMatchObject({ sampleCount: oneShot.trainIndices.length });
	const heldOut = validation?.data;
	if (!(heldOut instanceof PartitionDatasetProvider)) throw new Error('Missing holdout provider');
	const testFeatures = new Float64Array(oneShot.testIndices.length);
	const testTargets = new Float64Array(oneShot.testIndices.length);
	await heldOut.load(testFeatures, testTargets);
	expect([...testFeatures]).toEqual(
		[...oneShot.testIndices].map((index) => prepared.features[index]!)
	);
	expect([...testTargets]).toEqual([...oneShot.testIndices].map((index) => targetCodes[index]!));

	expect(cv.request).toMatchObject({
		folds: 3,
		randomState: 42,
		scoring: 'accuracy',
		refit: true,
		data: { sampleCount: 12 }
	});
	expect(cv.request).not.toHaveProperty('includeMetrics');
});

test('WML-P3-DATA-3: respects hidden, fixed and inactive option policy', () => {
	expect(
		configureClassifier(
			'logistic-regression',
			{ threshold: 0.3, multiLabel: true, fitIntercept: false },
			context
		).classifier.options
	).toEqual({ fitIntercept: false });
	expect(
		configureClassifier(
			'support-vector-classifier',
			{ kernel: 'linear', degree: 5, gamma: 0.4 },
			context
		).classifier.options
	).toEqual({ kernel: 'linear' });
	expect(
		configureClassifier('support-vector-classifier', { probability: true }, context).classifier
			.options
	).toEqual({ probability: true });
});

test('WML-P3-DATA-3: invalid option normalisation produces a typed error', () => {
	expect(() =>
		configureClassifier('k-neighbors-classifier', { nNeighbors: 13 }, context)
	).toThrow('invalid-options');
	expect(() =>
		configureClassifier('logistic-regression', { solver: 'lbfgs', penalty: 'l1' }, context)
	).toThrow('invalid-options');
});
