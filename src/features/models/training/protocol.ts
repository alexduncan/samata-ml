import type { TrainingErrorCode } from 'web-ml';
import type {
	TrainingLogMessage,
	TrainingResultPayload,
	TrainingRunIdentity
} from '../../../types/model-result';
import {
	FIXED_ONE_SHOT_TEST_RATIO,
	FIXED_TRAINING_RANDOM_STATE,
	MAX_CV_FOLDS,
	MIN_CV_FOLDS,
	type TrainingProgress,
	type ValidationMethodology
} from '../../../types/state';
import { isClassifierId } from '../model-catalogue';
import type { ClassifierConfiguration } from './classifier-adapters';
import {
	isTrainingLogMessage,
	isTrainingProgress,
	isTrainingResultPayload,
	isTrainingRunIdentity,
	sameTrainingRun
} from './result-validation';
import type { ClassificationErrorCode } from './types';

/** Captured options and identifiers for the app worker's single attempt. */
export type TrainingStartRequest = {
	kind: 'start';
	identity: TrainingRunIdentity;
	classifier: ClassifierConfiguration;
	features: readonly string[];
	setup: ValidationMethodology;
};

/** Commands accepted by the single-attempt app worker. */
export type TrainingWorkerRequest = TrainingStartRequest | { kind: 'cancel'; runId: string };

/** Safe categories suitable for localised training errors. */
export type TrainingFailureCode = TrainingErrorCode | ClassificationErrorCode | 'training-failed';

/** Replies from the dedicated training worker. */
export type TrainingWorkerReply = { identity: TrainingRunIdentity } & (
	| { kind: 'progress'; progress: TrainingProgress; note?: TrainingLogMessage }
	| { kind: 'success'; result: TrainingResultPayload }
	| { kind: 'failed'; code: TrainingFailureCode }
	| { kind: 'cancelled' }
);

const failureCodes: readonly TrainingFailureCode[] = [
	'invalid-request',
	'unsupported-algorithm',
	'environment-not-supported',
	'worker-startup-failed',
	'worker-crashed',
	'worker-protocol-error',
	'numerical-failure',
	'wasm-out-of-memory',
	'worker-timeout',
	'storage-unavailable',
	'dataset-unavailable',
	'metadata-mismatch',
	'row-type-mismatch',
	'invalid-dimensions',
	'invalid-options',
	'contract-error',
	'training-failed'
];

function record(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): boolean {
	return typeof value === 'number' && Number.isFinite(value);
}

function validOptions(value: unknown): boolean {
	return (
		record(value) &&
		!['__proto__', 'constructor', 'prototype'].some((key) => Object.hasOwn(value, key)) &&
		Object.values(value).every(
			(option) =>
				option === null ||
				typeof option === 'string' ||
				typeof option === 'boolean' ||
				finiteNumber(option) ||
				(Array.isArray(option) && option.every(finiteNumber))
		)
	);
}

function validSetup(value: unknown): boolean {
	if (!record(value) || value.randomState !== FIXED_TRAINING_RANDOM_STATE) return false;
	if (value.type === 'one_shot') return value.testRatio === FIXED_ONE_SHOT_TEST_RATIO;
	return (
		value.type === 'nested_cv' &&
		typeof value.outerFolds === 'number' &&
		Number.isInteger(value.outerFolds) &&
		value.outerFolds >= MIN_CV_FOLDS &&
		value.outerFolds <= MAX_CV_FOLDS &&
		value.innerFolds === value.outerFolds
	);
}

/** Validates the untrusted message at the app worker boundary. */
export function decodeTrainingWorkerRequest(value: unknown): TrainingWorkerRequest | null {
	if (!record(value)) return null;
	if (value.kind === 'cancel') {
		return typeof value.runId === 'string' && value.runId.length > 0
			? { kind: 'cancel', runId: value.runId }
			: null;
	}
	if (
		value.kind !== 'start' ||
		!isTrainingRunIdentity(value.identity) ||
		!record(value.classifier) ||
		typeof value.classifier.algorithm !== 'string' ||
		!isClassifierId(value.classifier.algorithm) ||
		!validOptions(value.classifier.options) ||
		!Array.isArray(value.features) ||
		value.features.length === 0 ||
		!value.features.every(
			(feature: unknown) => typeof feature === 'string' && feature.length > 0
		) ||
		new Set(value.features).size !== value.features.length ||
		value.features.includes(value.identity.target) ||
		!validSetup(value.setup)
	)
		return null;
	return value as TrainingStartRequest;
}

/** Narrows a failure to its public category without returning arbitrary library text. */
export function safeTrainingFailureCode(value: unknown): TrainingFailureCode {
	return failureCodes.find((code) => code === value) ?? 'training-failed';
}

/** Validates a reply before it can update progress or settle the attempt. */
export function decodeTrainingWorkerReply(value: unknown): TrainingWorkerReply | null {
	if (!record(value) || !isTrainingRunIdentity(value.identity)) return null;
	const identity = value.identity;
	switch (value.kind) {
		case 'cancelled':
			return { kind: value.kind, identity };
		case 'failed': {
			const code = failureCodes.find((candidate) => candidate === value.code);
			return code ? { kind: value.kind, identity, code } : null;
		}
		case 'progress':
			return isTrainingProgress(value.progress) &&
				value.progress.stage !== 'saving' &&
				(value.progress.percent === null || value.progress.percent <= 85) &&
				(value.note === undefined || isTrainingLogMessage(value.note))
				? { kind: value.kind, identity, progress: value.progress, note: value.note }
				: null;
		case 'success':
			return isTrainingResultPayload(value.result)
				? { kind: value.kind, identity, result: value.result }
				: null;
		default:
			return null;
	}
}

/** Allows only validated replies for the captured attempt and only its first terminal reply. */
export function createTrainingReplyGuard(identity: TrainingRunIdentity) {
	let settled = false;
	return {
		accept(value: unknown): TrainingWorkerReply | null {
			if (settled) return null;
			const reply = decodeTrainingWorkerReply(value);
			if (!reply || !sameTrainingRun(reply.identity, identity)) return null;
			if (reply.kind !== 'progress') settled = true;
			return reply;
		},
		close(): void {
			settled = true;
		}
	};
}
