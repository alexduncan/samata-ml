import type {
	BinaryClassificationMetrics,
	ClassificationLabel,
	CrossValidationRequest,
	CrossValidationResult,
	FittedRun,
	FittedTabularPreprocessorState,
	MulticlassClassificationMetrics,
	TrainingOptionsFor,
	TrainingRequestFor
} from 'web-ml';
import {
	FIXED_ONE_SHOT_TEST_RATIO,
	FIXED_TRAINING_RANDOM_STATE,
	type HyperparameterValue,
	type ValidationMethodology
} from '../../../types/state';
import type { ClassifierId } from '../model-catalogue';
import { getModelDocument } from '../model-documents';
import { normaliseModelOptions, type ModelOptionContext } from '../model-options';
import { PartitionDatasetProvider } from './partition-provider';
import { ClassificationError, type PreparedClassification } from './types';

type ClassifierOptions<A extends ClassifierId> = {
	readonly algorithm: A;
	readonly options: TrainingOptionsFor<A>;
};

/** Connects each classifier ID to the matching public options type. */
export type ClassifierConfiguration = {
	[A in ClassifierId]: ClassifierOptions<A>;
}[ClassifierId];

type ClassifierCrossValidationRequest = {
	[A in ClassifierId]: CrossValidationRequest<A>;
}[ClassifierId];

type HoldoutIndices = { trainIndices: Uint32Array; testIndices: Uint32Array };

/** Fully prepared library request, discriminated by the app's evaluation strategy. */
export type ClassificationRequest =
	| ({ strategy: 'one_shot'; request: TrainingRequestFor<ClassifierId> } & HoldoutIndices)
	| { strategy: 'cross_validation'; request: ClassifierCrossValidationRequest };

type ConfiguredModel = {
	classifier: ClassifierConfiguration;
	effectiveOptions: Readonly<Record<string, HyperparameterValue | undefined>>;
};

function adaptOptions(
	algorithm: ClassifierId,
	options: Readonly<Record<string, HyperparameterValue>>
): ClassifierConfiguration {
	// The Phase 1 policy has already checked the active values against this ID's catalogue.
	switch (algorithm) {
		case 'bernoulli-nb':
			return { algorithm, options };
		case 'decision-tree-classifier':
			return { algorithm, options };
		case 'gaussian-nb':
			return { algorithm, options };
		case 'k-neighbors-classifier':
			return { algorithm, options };
		case 'logistic-regression':
			return { algorithm, options };
		case 'mlp-classifier':
			return { algorithm, options };
		case 'multinomial-nb':
			return { algorithm, options };
		case 'support-vector-classifier':
			return { algorithm, options };
	}
}

/** Validates persisted options and exposes the active overrides and effective identity values. */
export function configureClassifier(
	algorithm: ClassifierId,
	values: Readonly<Record<string, HyperparameterValue>>,
	context: ModelOptionContext
): ConfiguredModel {
	const { requestOptions, effective, issues } = normaliseModelOptions(
		getModelDocument(algorithm),
		values,
		context
	);
	if (issues.length > 0) throw new ClassificationError('invalid-options');
	return { classifier: adaptOptions(algorithm, requestOptions), effectiveOptions: effective };
}

/** Packages the retained rows for library stratification, per-partition preprocessing and fit. */
export function buildClassificationRequest(
	runtime: Pick<typeof import('web-ml'), 'stratifiedTrainTestSplit'>,
	classifier: ClassifierConfiguration,
	prepared: PreparedClassification,
	setup: ValidationMethodology
): ClassificationRequest {
	const common = {
		...classifier,
		classLabels: prepared.classLabels,
		preprocessing: { columns: prepared.columns, standardize: false }
	};
	if (setup.type === 'one_shot') {
		const { trainIndices, testIndices } = runtime.stratifiedTrainTestSplit(
			prepared.targetCodes,
			{
				testRatio: FIXED_ONE_SHOT_TEST_RATIO,
				randomState: FIXED_TRAINING_RANDOM_STATE
			}
		);
		return {
			strategy: 'one_shot',
			trainIndices,
			testIndices,
			request: {
				...common,
				data: new PartitionDatasetProvider(prepared, trainIndices),
				validation: { data: new PartitionDatasetProvider(prepared, testIndices) }
			}
		};
	}

	return {
		strategy: 'cross_validation',
		request: {
			...common,
			data: new PartitionDatasetProvider(
				prepared,
				prepared.targetCodes.map((_code, index) => index)
			),
			folds: setup.outerFolds,
			randomState: FIXED_TRAINING_RANDOM_STATE,
			scoring: 'accuracy',
			refit: true
		}
	};
}

type FittedArtefacts = {
	classLabels: readonly ClassificationLabel[];
	featureNamesOut: readonly string[];
	modelJson: Record<string, unknown>;
	preprocessorJson: FittedTabularPreprocessorState;
};

function copyFit(
	fit: Pick<FittedRun<ClassifierId>, 'model' | 'preprocessor' | 'featureNamesOut'>
): FittedArtefacts {
	const { model, preprocessor, featureNamesOut } = fit;
	try {
		if (!preprocessor || !featureNamesOut) throw new ClassificationError('contract-error');
		return {
			classLabels: [...model.classes_],
			featureNamesOut: [...featureNamesOut],
			modelJson: structuredClone(model.toJSON()),
			preprocessorJson: structuredClone(preprocessor.toJSON())
		};
	} finally {
		if ('dispose' in model && typeof model.dispose === 'function') model.dispose();
	}
}

/** A single-target report evaluated on the held-out partition. */
export type HoldoutReport = BinaryClassificationMetrics | MulticlassClassificationMetrics;

/** Copies the model fitted on the train partition and the independent holdout report. */
export function snapshotHoldoutResult(result: FittedRun<ClassifierId>, indices: HoldoutIndices) {
	const artefacts = copyFit(result);
	const report = result.metrics;
	if (report?.task !== 'binary' && report?.task !== 'multiclass') {
		throw new ClassificationError('contract-error');
	}
	return { ...artefacts, holdout: structuredClone({ ...indices, report }) };
}

/** Copies out-of-sample scores and diagnostics and the separate full-data refit. */
export function snapshotCrossValidationResult(result: CrossValidationResult<ClassifierId>) {
	if (!result.refit) throw new ClassificationError('contract-error');
	const artefacts = copyFit(result.refit);
	const { folds, diagnostics, meanScore, standardDeviation } = result;
	return {
		...artefacts,
		crossValidation: structuredClone({ folds, diagnostics, meanScore, standardDeviation })
	};
}
