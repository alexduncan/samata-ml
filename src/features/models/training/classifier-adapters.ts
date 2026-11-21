import type {
	ClassificationLabel,
	CrossValidationRequest,
	CrossValidationResult,
	FittedTabularPreprocessorState,
	HoldoutValidationRequest,
	HoldoutValidationResult,
	TrainingOptionsFor
} from 'web-ml';
import {
	FIXED_ONE_SHOT_TEST_RATIO,
	FIXED_TRAINING_RANDOM_STATE,
	type HyperparameterValue,
	type ValidationMethodology
} from '../../../types/state';
import type { StoredEvaluation } from '../../../types/model-evaluation';
import type { ClassifierId } from '../model-catalogue';
import { getModelDocument } from '../model-documents';
import { normaliseModelOptions, type ModelOptionContext } from '../model-options';
import { mapEvaluation, type CurveRuntime } from './evaluation-mapper';
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

type ClassifierHoldoutRequest = {
	[A in ClassifierId]: HoldoutValidationRequest<A>;
}[ClassifierId];

/** Fully prepared library request, discriminated by the app's evaluation strategy. */
export type ClassificationRequest =
	| { strategy: 'one_shot'; request: ClassifierHoldoutRequest }
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

/**
 * Packages every retained row for one public library call that stratifies, preprocesses per
 * partition, fits, evaluates and returns the fitted artefacts. The explicit positive label is
 * the second class of the request axis; multiclass runs omit it.
 */
export function buildClassificationRequest(
	classifier: ClassifierConfiguration,
	prepared: PreparedClassification,
	setup: ValidationMethodology
): ClassificationRequest {
	const common = {
		...classifier,
		classLabels: prepared.classLabels,
		preprocessing: { columns: prepared.columns, standardize: false },
		data: new PartitionDatasetProvider(
			prepared,
			prepared.targetCodes.map((_code, index) => index)
		),
		evaluation: {
			outputs: true,
			reports: true,
			trainingReports: true,
			baselines: ['most-frequent', 'stratified'] as const,
			...(prepared.classLabels.length === 2 && { positiveLabel: prepared.classLabels[1]! })
		}
	};
	if (setup.type === 'one_shot') {
		return {
			strategy: 'one_shot',
			request: {
				...common,
				testRatio: FIXED_ONE_SHOT_TEST_RATIO,
				randomState: FIXED_TRAINING_RANDOM_STATE,
				returnFit: true
			}
		};
	}
	return {
		strategy: 'cross_validation',
		request: {
			...common,
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

type DisposableFit = {
	model: { classes_: readonly ClassificationLabel[]; toJSON(): unknown };
	preprocessor?: { toJSON(): FittedTabularPreprocessorState };
	featureNamesOut?: readonly string[];
};

/**
 * Copies the fitted artefacts. `classLabels` is the request axis returned with the evaluation,
 * not `model.classes_`: the library may order the fitted classes differently (sorted), and the
 * stored evaluation indexes the request axis.
 */
function copyFit(fit: DisposableFit, classLabels: readonly ClassificationLabel[]): FittedArtefacts {
	const { model, preprocessor, featureNamesOut } = fit;
	if (!preprocessor || !featureNamesOut) throw new ClassificationError('contract-error');
	return {
		classLabels: [...classLabels],
		featureNamesOut: [...featureNamesOut],
		modelJson: structuredClone(model.toJSON() as Record<string, unknown>),
		preprocessorJson: structuredClone(preprocessor.toJSON())
	};
}

/** Disposes a caller-owned native model exactly once, whatever happened after it was returned. */
function disposeModel(model: object): void {
	if ('dispose' in model && typeof model.dispose === 'function') model.dispose();
}

/**
 * Copies the model fitted on the training partition and the mapped evaluation from one holdout
 * call. The caller-owned model is disposed once even if validation, copying or mapping fails.
 */
export async function snapshotHoldoutResult(
	runtime: CurveRuntime,
	result: HoldoutValidationResult<ClassifierId>,
	context: {
		datasetId: string;
		sourceRowIndices: readonly number[];
		protocol: Extract<StoredEvaluation['protocol'], { kind: 'one_shot' }>;
	}
) {
	const fit = result.fit;
	if (!fit) throw new ClassificationError('contract-error');
	try {
		if (!result.evaluation) throw new ClassificationError('contract-error');
		const artefacts = copyFit(fit, result.evaluation.classLabels);
		const evaluation = await mapEvaluation(runtime, {
			datasetId: context.datasetId,
			protocol: context.protocol,
			sourceRowIndices: context.sourceRowIndices,
			evaluation: result.evaluation,
			partitions: [
				{
					trainSampleCount: result.trainIndices.length,
					testSampleCount: result.validationIndices.length,
					durationMs: fit.durationMs
				}
			]
		});
		return {
			...artefacts,
			evaluation,
			holdout: {
				trainIndices: result.trainIndices.slice(),
				testIndices: result.validationIndices.slice()
			}
		};
	} finally {
		disposeModel(fit.model);
	}
}

/**
 * Copies out-of-sample diagnostics, the mapped evaluation and the separate full-data refit.
 * The refit model is disposed once even if validation, copying or mapping fails.
 */
export async function snapshotCrossValidationResult(
	runtime: CurveRuntime,
	result: CrossValidationResult<ClassifierId>,
	context: {
		datasetId: string;
		sourceRowIndices: readonly number[];
		protocol: Extract<StoredEvaluation['protocol'], { kind: 'cross_validation' }>;
	}
) {
	const refit = result.refit;
	if (!refit) throw new ClassificationError('contract-error');
	try {
		if (!result.evaluation || result.folds.some((fold, index) => fold.foldIndex !== index)) {
			throw new ClassificationError('contract-error');
		}
		const artefacts = copyFit(refit, result.evaluation.classLabels);
		const total = context.sourceRowIndices.length;
		const evaluation = await mapEvaluation(runtime, {
			datasetId: context.datasetId,
			protocol: context.protocol,
			sourceRowIndices: context.sourceRowIndices,
			evaluation: result.evaluation,
			partitions: result.folds.map((fold) => ({
				trainSampleCount: total - fold.validationSampleCount,
				testSampleCount: fold.validationSampleCount,
				durationMs: fold.durationMs
			}))
		});
		const { folds, diagnostics, meanScore, standardDeviation } = result;
		return {
			...artefacts,
			evaluation,
			crossValidation: structuredClone({ folds, diagnostics, meanScore, standardDeviation })
		};
	} finally {
		disposeModel(refit.model);
	}
}
