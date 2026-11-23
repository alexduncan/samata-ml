import type { CrossValidationFoldResult, TrainingPhase } from 'web-ml';
import { decodeStoredEvaluation } from '../../results/evaluation-decoder';
import type { StoredEvaluation } from '../../../types/model-evaluation';
import type {
	LegacyTrainingResultPayload,
	ResultEnvelope,
	TrainingLogEntry,
	TrainingLogMessage,
	TrainingResultPayload,
	TrainingRunIdentity
} from '../../../types/model-result';
import {
	TRAINING_DOMAIN_DATASET_ID,
	type TrainingProgress,
	type TrainingStage
} from '../../../types/state';
import { isClassifierId } from '../model-catalogue';

const phases = new Set<TrainingPhase>([
	'queued',
	'loading-data',
	'initializing',
	'training',
	'transforming',
	'tuning',
	'evaluating',
	'finalizing'
]);
const stages = new Set<TrainingStage>([
	'preparing',
	'fitting',
	'cross-validation',
	'refitting',
	'evaluating',
	'saving'
]);
const metricReasons = new Set([
	'not-requested',
	'probabilities-unavailable',
	'unseen-validation-labels',
	'undefined-for-validation-classes',
	'all-targets-zero',
	'negative-targets',
	'not-applicable',
	'insufficient-degrees-of-freedom'
]);

function record(value: unknown): value is Record<string, unknown> {
	if (typeof value !== 'object' || value === null) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === null || prototype === Object.prototype;
}

function finite(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

function nonnegative(value: unknown): value is number {
	return finite(value) && value >= 0;
}

function count(value: unknown): value is number {
	return nonnegative(value) && Number.isSafeInteger(value);
}

function nonempty(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0;
}

function strings(value: unknown): value is string[] {
	return Array.isArray(value) && value.every(nonempty);
}

function label(value: unknown): boolean {
	return typeof value === 'string' || typeof value === 'boolean' || finite(value);
}

function labels(value: unknown): value is readonly (string | number | boolean)[] {
	return Array.isArray(value) && value.every(label) && new Set(value).size === value.length;
}

/** Validates the immutable identity used by both worker messages and result rows. */
export function isTrainingRunIdentity(value: unknown): value is TrainingRunIdentity {
	return (
		record(value) &&
		nonempty(value.datasetId) &&
		value.datasetId !== TRAINING_DOMAIN_DATASET_ID &&
		nonempty(value.target) &&
		count(value.modelNum) &&
		value.modelNum > 0 &&
		nonnegative(value.modelCreatedAt) &&
		nonempty(value.configurationKey) &&
		nonempty(value.runId)
	);
}

/** Compares all identity fields, including creation time when a model number is reused. */
export function sameTrainingRun(left: TrainingRunIdentity, right: TrainingRunIdentity): boolean {
	return (
		left.datasetId === right.datasetId &&
		left.target === right.target &&
		left.modelNum === right.modelNum &&
		left.modelCreatedAt === right.modelCreatedAt &&
		left.configurationKey === right.configurationKey &&
		left.runId === right.runId
	);
}

/** Narrows a progress snapshot received across the worker boundary. */
export function isTrainingProgress(value: unknown): value is TrainingProgress {
	return (
		record(value) &&
		(value.percent === null || (nonnegative(value.percent) && value.percent <= 100)) &&
		stages.has(value.stage as TrainingStage) &&
		(value.phase === null || typeof value.phase === 'string') &&
		nonempty(value.statusMessage)
	);
}

/** Recognises the safe, localisable payloads used by the in-memory and durable logs. */
export function isTrainingLogMessage(value: unknown): value is TrainingLogMessage {
	if (!record(value)) return false;
	switch (value.key) {
		case 'phase':
			return phases.has(value.phase as TrainingPhase);
		case 'fold-start':
			return (
				count(value.fold) &&
				value.fold > 0 &&
				count(value.folds) &&
				value.folds >= value.fold
			);
		case 'fold-complete':
			return count(value.fold) && value.fold > 0;
		case 'warning':
			return value.code === 'reduced-performance-mode' || value.code === 'worker-retried';
		case 'preparing':
		case 'refit-start':
		case 'refit-complete':
		case 'saving':
		case 'completed':
		case 'cancelled':
		case 'failed':
			return true;
		default:
			return false;
	}
}

function hasLog(value: unknown): value is readonly TrainingLogEntry[] {
	if (!Array.isArray(value) || value.length > 250) return false;
	let lastId = 0;
	let lastTime = 0;
	for (const entry of value as unknown[]) {
		if (
			!record(entry) ||
			!count(entry.id) ||
			entry.id <= lastId ||
			!nonnegative(entry.timestamp) ||
			entry.timestamp < lastTime ||
			(entry.level !== 'status' && entry.level !== 'warning' && entry.level !== 'error') ||
			!isTrainingLogMessage(entry.message)
		)
			return false;
		lastId = entry.id;
		lastTime = entry.timestamp;
	}
	return true;
}

function hasPreprocessor(value: unknown): boolean {
	if (
		!record(value) ||
		value.version !== 1 ||
		typeof value.standardize !== 'boolean' ||
		!Array.isArray(value.columns) ||
		value.columns.length === 0
	)
		return false;
	return (value.columns as unknown[]).every((column) => {
		if (!record(column) || !nonempty(column.name)) return false;
		if (column.kind === 'numeric') {
			return finite(column.mean) && finite(column.scale) && column.scale > 0;
		}
		return column.kind === 'categorical' && labels(column.categories) && label(column.mode);
	});
}

function counts(value: unknown, length: number): boolean {
	return value instanceof Uint32Array && value.length === length;
}

function rates(value: unknown, length: number): boolean {
	return value instanceof Float32Array && value.length === length && value.every(finite);
}

function metric(value: unknown, check: (candidate: unknown) => boolean): boolean {
	if (!record(value)) return false;
	return value.available === true
		? check(value.value)
		: value.available === false &&
				typeof value.reason === 'string' &&
				metricReasons.has(value.reason);
}

const summaryRates = ['accuracy', 'precision', 'recall', 'f1'] as const;
const confusionRates = [
	'truePositiveRate',
	'falsePositiveRate',
	'trueNegativeRate',
	'falseNegativeRate'
] as const;
const perClassRates = ['precisionPerClass', 'recallPerClass', 'f1PerClass'] as const;

function reportSize(value: Record<string, unknown>, sampleCount: number): number | null {
	if (value.sampleCount !== sampleCount || !labels(value.labels) || value.labels.length < 2)
		return null;
	const size = value.labels.length;
	return counts(value.confusionMatrix, size * size) &&
		counts(value.support, size) &&
		summaryRates.every((key) => finite(value[key]))
		? size
		: null;
}

function hasHoldoutReport(value: unknown, sampleCount: number): boolean {
	if (!record(value)) return false;
	const size = reportSize(value, sampleCount);
	if (
		size === null ||
		!labels(value.classes) ||
		!labels(value.unseenLabels) ||
		!finite(value.matthewsCorrelation) ||
		!['logLoss', 'brierScore', 'rocAuc', 'averagePrecision'].every((key) =>
			metric(value[key], finite)
		)
	) {
		return false;
	}
	if (value.task === 'binary') {
		return label(value.positiveLabel) && confusionRates.every((key) => finite(value[key]));
	}
	return (
		value.task === 'multiclass' &&
		[...perClassRates, ...confusionRates].every((key) => rates(value[key], size)) &&
		['rocAucPerClass', 'averagePrecisionPerClass'].every((key) =>
			metric(value[key], (item) => rates(item, size))
		)
	);
}

function hasDiagnostics(value: unknown, sampleCount: number): boolean {
	if (!record(value) || value.task !== 'classification') return false;
	const size = reportSize(value, sampleCount);
	return (
		size !== null &&
		counts(value.predictedCount, size) &&
		perClassRates.every((key) => rates(value[key], size))
	);
}

function addPartition(value: unknown, seen: Uint8Array): value is Uint32Array {
	if (!(value instanceof Uint32Array) || value.length === 0) return false;
	for (const index of value) {
		if (index >= seen.length || seen[index]) return false;
		seen[index] = 1;
	}
	return true;
}

function hasHoldout(value: unknown, sampleCount: number, withReport: boolean): boolean {
	if (!record(value)) return false;
	if (!withReport && Object.hasOwn(value, 'report')) return false;
	const seen = new Uint8Array(sampleCount);
	return (
		addPartition(value.trainIndices, seen) &&
		addPartition(value.testIndices, seen) &&
		value.trainIndices.length + value.testIndices.length === sampleCount &&
		(!withReport || hasHoldoutReport(value.report, value.testIndices.length))
	);
}

function hasCrossValidation(value: unknown, sampleCount: number): boolean {
	if (
		!record(value) ||
		!finite(value.meanScore) ||
		!nonnegative(value.standardDeviation) ||
		!Array.isArray(value.folds) ||
		value.folds.length < 2 ||
		!hasDiagnostics(value.diagnostics, sampleCount)
	) {
		return false;
	}
	const seen = new Uint8Array(sampleCount);
	const folds = new Set<number>();
	let validated = 0;
	for (const fold of value.folds as unknown[]) {
		if (
			!record(fold) ||
			!count(fold.foldIndex) ||
			folds.has(fold.foldIndex) ||
			!finite(fold.score) ||
			!nonnegative(fold.durationMs) ||
			!addPartition(fold.validationIndices, seen) ||
			fold.validationSampleCount !== fold.validationIndices.length ||
			(fold.featureNamesOut !== undefined && !strings(fold.featureNamesOut))
		)
			return false;
		folds.add(fold.foldIndex);
		validated += fold.validationIndices.length;
	}
	return validated === sampleCount;
}

/** Validates the fields both payload versions share; returns the retained row count or null. */
function payloadSampleCount(value: unknown): number | null {
	if (
		!record(value) ||
		!nonempty(value.webMlRevision) ||
		!count(value.excludedTargetRows) ||
		!strings(value.featureNamesOut) ||
		value.featureNamesOut.length === 0 ||
		!labels(value.classLabels) ||
		value.classLabels.length < 2 ||
		!record(value.modelJson) ||
		Object.keys(value.modelJson).length === 0 ||
		!hasPreprocessor(value.preprocessorJson) ||
		!Array.isArray(value.sourceRowIndices) ||
		value.sourceRowIndices.length < 2
	)
		return null;
	let previous = -1;
	for (const sourceIndex of value.sourceRowIndices as unknown[]) {
		if (!count(sourceIndex) || sourceIndex <= previous) return null;
		previous = sourceIndex;
	}
	return value.sourceRowIndices.length;
}

/** Checks a Phase 3 payload so stored version 1 results stay readable. */
export function isLegacyTrainingResultPayload(
	value: unknown
): value is LegacyTrainingResultPayload {
	const sampleCount = payloadSampleCount(value);
	if (sampleCount === null || !record(value)) return false;
	return value.strategy === 'one_shot'
		? hasHoldout(value.holdout, sampleCount, true)
		: value.strategy === 'cross_validation' &&
				hasCrossValidation(value.crossValidation, sampleCount);
}

function sameLabels(left: readonly unknown[], right: readonly unknown[]): boolean {
	return left.length === right.length && left.every((entry, index) => entry === right[index]);
}

/** The stored evaluation must describe exactly the rows and axis of the enclosing payload. */
function evaluationMatchesPayload(
	evaluation: StoredEvaluation,
	value: Record<string, unknown>,
	sourceRowIndices: readonly number[]
): boolean {
	const { outputs, partitions, protocol } = evaluation;
	if (!sameLabels(evaluation.classLabels, value.classLabels as unknown[])) return false;
	if (value.strategy === 'one_shot') {
		const holdout = value.holdout as { trainIndices: Uint32Array; testIndices: Uint32Array };
		if (protocol.kind !== 'one_shot' || partitions.length !== 1) return false;
		if (
			partitions[0]!.trainSampleCount !== holdout.trainIndices.length ||
			partitions[0]!.testSampleCount !== holdout.testIndices.length
		)
			return false;
		const expected = Array.from(holdout.testIndices, (index) => sourceRowIndices[index]!).sort(
			(a, b) => a - b
		);
		return sameLabels(Array.from(outputs.sourceRowIndex), expected);
	}
	const cv = value.crossValidation as { folds: readonly CrossValidationFoldResult[] };
	if (protocol.kind !== 'cross_validation' || partitions.length !== cv.folds.length) return false;
	if (!sameLabels(Array.from(outputs.sourceRowIndex), sourceRowIndices)) return false;
	return cv.folds.every(
		(fold, position) =>
			fold.foldIndex === position &&
			partitions[position]!.testSampleCount === fold.validationSampleCount &&
			Array.from(fold.validationIndices).every(
				(retained) => outputs.partitionIndex[retained] === position
			)
	);
}

/**
 * Checks a worker success or version 2 payload: the shared fields, the stored evaluation and
 * the agreement between that evaluation and the retained rows, class axis and strategy.
 */
export function isTrainingResultPayload(value: unknown): value is TrainingResultPayload {
	const sampleCount = payloadSampleCount(value);
	if (sampleCount === null || !record(value)) return false;
	const evaluation = decodeStoredEvaluation(value.evaluation);
	if (!evaluation) return false;
	const strategyValid =
		value.strategy === 'one_shot'
			? hasHoldout(value.holdout, sampleCount, false)
			: value.strategy === 'cross_validation' &&
				hasCrossValidation(value.crossValidation, sampleCount);
	return (
		strategyValid &&
		evaluationMatchesPayload(evaluation, value, value.sourceRowIndices as number[])
	);
}

/** Rejects obsolete, malformed or mismatched durable result rows. */
export function decodeResultEnvelope(
	value: unknown,
	identity?: TrainingRunIdentity
): ResultEnvelope | null {
	if (!record(value)) return null;
	const { schemaVersion, algorithm, durationMs, logEntries } = value;
	if (
		typeof algorithm !== 'string' ||
		!isClassifierId(algorithm) ||
		!nonnegative(durationMs) ||
		!hasLog(logEntries) ||
		!isTrainingRunIdentity(value) ||
		(identity && !sameTrainingRun(value, identity))
	)
		return null;
	if (schemaVersion === 1 && isLegacyTrainingResultPayload(value)) {
		return { ...value, schemaVersion, algorithm, durationMs, logEntries };
	}
	if (schemaVersion === 2 && isTrainingResultPayload(value)) {
		return { ...value, schemaVersion, algorithm, durationMs, logEntries };
	}
	return null;
}
