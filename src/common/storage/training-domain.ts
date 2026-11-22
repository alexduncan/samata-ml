import type { IDBPDatabase } from 'idb';
import type { ResultEnvelope } from '../../types/model-result';
import {
	DEFAULT_ONE_SHOT_SETUP,
	FIXED_ONE_SHOT_TEST_RATIO,
	FIXED_TRAINING_RANDOM_STATE,
	MAX_CV_FOLDS,
	MIN_CV_FOLDS,
	sanitiseModelResultsUi,
	TRAINING_DOMAIN_DATASET_ID,
	type ModelRecord,
	type PersistedAppState,
	type TrainingProgress,
	type TrainingStage,
	type ValidationMethodology
} from '../../types/state';
import { datasetRowRange, TRAINING_DOMAIN_KEY, type SamataDBSchema } from './db';

/** Outcome used to preserve model-local Phase 2 setup recovery. */
export type TrainingSetupDecodeOutcome = 'valid' | 'explicit-null' | 'unusable';

/** Dataset, models and selection needed to replay a committed domain update. */
export type ProtectedDomainSnapshot = Pick<
	PersistedAppState,
	'dataset' | 'target' | 'models' | 'nextModelNum' | 'data' | 'comparisonContextEpoch'
>;

const VALID_COLUMN_TYPES = new Set<string>([
	'numeric',
	'categorical',
	'boolean',
	'datetime',
	'text'
]);

const VALID_MODEL_STATUSES = new Set<string>(['draft', 'training', 'trained']);

const VALID_MODEL_SECTION_IDS = new Set<string>([
	'choose-model',
	'select-features',
	'configure-model',
	'configure-training',
	'training',
	'results'
]);

const VALID_MULTICLASS_STRATEGIES = new Set<string>(['native', 'one-vs-rest', 'one-vs-one']);

const VALID_ERROR_CODES = new Set<string>([
	'TRAINING_FAILED',
	'TRAINING_CANCELLED',
	'TRAINING_INTERRUPTED_BY_RELOAD'
]);

function isPlainObject(val: unknown): val is Record<string, unknown> {
	return typeof val === 'object' && val !== null && !Array.isArray(val);
}

const FORBIDDEN_VALUE_KEYS = ['__proto__', 'constructor', 'prototype'] as const;

function isStoredFoldCount(value: unknown): value is number {
	return (
		typeof value === 'number' &&
		Number.isInteger(value) &&
		value >= MIN_CV_FOLDS &&
		value <= MAX_CV_FOLDS
	);
}

/** Decodes a v1 setup from validated own fields, allowing an omitted historical seed. */
function decodeTrainingSetup(
	value: unknown,
	storedCheckpoint: boolean
): ValidationMethodology | null {
	if (
		!isPlainObject(value) ||
		!Object.hasOwn(value, 'type') ||
		FORBIDDEN_VALUE_KEYS.some((key) => Object.hasOwn(value, key)) ||
		(Object.hasOwn(value, 'randomState') && value.randomState !== FIXED_TRAINING_RANDOM_STATE)
	) {
		return null;
	}

	if (value.type === (storedCheckpoint ? 'one_shot' : 'train_test_split')) {
		return Object.hasOwn(value, 'testRatio') && value.testRatio === FIXED_ONE_SHOT_TEST_RATIO
			? { ...DEFAULT_ONE_SHOT_SETUP }
			: null;
	}

	let folds: unknown;
	if (!storedCheckpoint && value.type === 'k_fold_cv' && Object.hasOwn(value, 'folds')) {
		folds = value.folds;
	} else if (
		value.type === 'nested_cv' &&
		Object.hasOwn(value, 'outerFolds') &&
		Object.hasOwn(value, 'innerFolds') &&
		value.outerFolds === value.innerFolds
	) {
		folds = value.outerFolds;
	}

	return isStoredFoldCount(folds)
		? {
				type: 'nested_cv',
				outerFolds: folds,
				innerFolds: folds,
				randomState: FIXED_TRAINING_RANDOM_STATE
			}
		: null;
}

/** Reports whether a persisted hyperparameter value is a finite number, string, boolean, null or number array. */
function isHyperparameterValue(val: unknown): boolean {
	if (val === null || typeof val === 'string' || typeof val === 'boolean') return true;
	if (typeof val === 'number') return Number.isFinite(val);
	return (
		Array.isArray(val) && val.every((item) => typeof item === 'number' && Number.isFinite(item))
	);
}

/** Reports whether persisted hyperparameter `values` is a plain object of valid values without prototype keys. */
function isHyperparameterValues(val: unknown): boolean {
	if (!isPlainObject(val)) return false;
	if (FORBIDDEN_VALUE_KEYS.some((key) => Object.hasOwn(val, key))) return false;
	return Object.values(val).every(isHyperparameterValue);
}

const trainingStages: readonly TrainingStage[] = [
	'preparing',
	'fitting',
	'cross-validation',
	'evaluating',
	'refitting',
	'saving'
];

function decodeProgress(value: unknown): TrainingProgress | null | undefined {
	if (value === null) return null;
	if (!isPlainObject(value) || typeof value.statusMessage !== 'string') return undefined;
	const percent = value.percent;
	if (percent !== null && (typeof percent !== 'number' || !Number.isFinite(percent)))
		return undefined;
	const stage = trainingStages.find((candidate) => candidate === value.stage);
	return {
		percent: percent === null ? null : Math.max(0, Math.min(100, percent)),
		stage: stage ?? (typeof value.currentFold === 'number' ? 'cross-validation' : 'fitting'),
		phase: typeof value.phase === 'string' ? value.phase : null,
		statusMessage: value.statusMessage
	};
}

/** Validates shared domain fields and decodes historical v1 setup/progress at the wire boundary. */
export function decodeProtectedDomain(
	val: unknown,
	storedCheckpoint = false
): {
	domain: ProtectedDomainSnapshot;
	trainingSetupDecodeOutcomes: readonly TrainingSetupDecodeOutcome[];
} | null {
	if (!isPlainObject(val) || !nonnegativeInteger(val.nextModelNum) || val.nextModelNum < 1)
		return null;
	if (
		storedCheckpoint &&
		val.comparisonContextEpoch !== undefined &&
		!nonnegativeInteger(val.comparisonContextEpoch)
	)
		return null;

	if (val.dataset !== null) {
		if (!isPlainObject(val.dataset)) {
			return null;
		}
		if (
			typeof val.dataset.id !== 'string' ||
			val.dataset.id === TRAINING_DOMAIN_DATASET_ID ||
			typeof val.dataset.name !== 'string'
		) {
			return null;
		}
		if (val.dataset.source !== 'sample' && val.dataset.source !== 'upload') {
			return null;
		}
		if (
			val.dataset.sampleId !== undefined &&
			(typeof val.dataset.sampleId !== 'string' || val.dataset.sampleId.length === 0)
		) {
			return null;
		}
		if (
			typeof val.dataset.rowCount !== 'number' ||
			!Number.isInteger(val.dataset.rowCount) ||
			val.dataset.rowCount < 0
		) {
			return null;
		}
		if (!Array.isArray(val.dataset.columns)) {
			return null;
		}
		for (const col of val.dataset.columns) {
			if (!isPlainObject(col)) {
				return null;
			}
			if (typeof col.name !== 'string' || typeof col.type !== 'string') {
				return null;
			}
			if (!VALID_COLUMN_TYPES.has(col.type)) {
				return null;
			}
			if (
				typeof col.missingCount !== 'number' ||
				!Number.isInteger(col.missingCount) ||
				col.missingCount < 0
			) {
				return null;
			}
		}
	}

	if (!isPlainObject(val.data)) {
		return null;
	}
	if (val.data.mode !== 'select' && val.data.mode !== 'preview') {
		return null;
	}
	if (val.data.selectedColumn !== null && typeof val.data.selectedColumn !== 'string') {
		return null;
	}

	if (val.target !== null && typeof val.target !== 'string') {
		return null;
	}

	if (!Array.isArray(val.models)) {
		return null;
	}
	const trainingSetupDecodeOutcomes: TrainingSetupDecodeOutcome[] = [];
	const models: ModelRecord[] = [];
	for (const m of val.models) {
		if (!isPlainObject(m)) {
			return null;
		}
		if (typeof m.num !== 'number' || !Number.isInteger(m.num) || m.num < 1) {
			return null;
		}
		if (typeof m.createdAt !== 'number' || !Number.isFinite(m.createdAt)) {
			return null;
		}
		if (typeof m.status !== 'string' || !VALID_MODEL_STATUSES.has(m.status)) {
			return null;
		}
		if (!Array.isArray(m.completedSteps)) {
			return null;
		}
		for (const step of m.completedSteps) {
			if (typeof step !== 'string' || !VALID_MODEL_SECTION_IDS.has(step)) {
				return null;
			}
		}
		if (m.modelId !== null && typeof m.modelId !== 'string') {
			return null;
		}
		if (!Array.isArray(m.features) || !m.features.every((f) => typeof f === 'string')) {
			return null;
		}
		if (!isPlainObject(m.modelOptions) || !isPlainObject(m.ui)) {
			return null;
		}
		if (!isPlainObject(m.hyperparameters)) {
			return null;
		}
		if (m.hyperparameters.mode !== 'manual' && m.hyperparameters.mode !== 'tuning') {
			return null;
		}
		if (!isHyperparameterValues(m.hyperparameters.values)) {
			return null;
		}
		if (
			m.hyperparameters.tuningSearchSpace !== undefined &&
			!isPlainObject(m.hyperparameters.tuningSearchSpace)
		) {
			return null;
		}
		if (
			m.multiclass !== null &&
			(typeof m.multiclass !== 'string' || !VALID_MULTICLASS_STRATEGIES.has(m.multiclass))
		) {
			return null;
		}
		const progress = decodeProgress(m.progress);
		if (progress === undefined) return null;
		if (m.error !== null) {
			if (!isPlainObject(m.error)) {
				return null;
			}
			if (typeof m.error.code !== 'string' || !VALID_ERROR_CODES.has(m.error.code)) {
				return null;
			}
			if (
				typeof m.error.message !== 'string' ||
				typeof m.error.timestamp !== 'number' ||
				!Number.isFinite(m.error.timestamp)
			) {
				return null;
			}
		}
		if (m.timings !== null && !isPlainObject(m.timings)) {
			return null;
		}
		if (
			m.durationMs !== null &&
			(typeof m.durationMs !== 'number' || !Number.isFinite(m.durationMs))
		) {
			return null;
		}
		if (m.metrics !== null && !isPlainObject(m.metrics)) {
			return null;
		}

		const rawSetup = Object.hasOwn(m, 'trainingSetup') ? m.trainingSetup : undefined;
		const setup = decodeTrainingSetup(rawSetup, storedCheckpoint);
		if (storedCheckpoint && rawSetup !== null && setup === null) return null;
		trainingSetupDecodeOutcomes.push(
			setup ? 'valid' : rawSetup === null ? 'explicit-null' : 'unusable'
		);
		models.push({
			...m,
			trainingSetup: setup,
			progress,
			resultRevision:
				typeof m.resultRevision === 'string' && m.resultRevision.length > 0
					? m.resultRevision
					: null,
			ui: decodeModelUi(m.ui)
		} as ModelRecord);
	}

	return {
		domain: {
			dataset: val.dataset as ProtectedDomainSnapshot['dataset'],
			target: val.target,
			models,
			nextModelNum: val.nextModelNum,
			comparisonContextEpoch: nonnegativeInteger(val.comparisonContextEpoch)
				? val.comparisonContextEpoch
				: 0,
			data: { mode: val.data.mode, selectedColumn: val.data.selectedColumn }
		},
		trainingSetupDecodeOutcomes
	};
}

/** Normalises known preference keys and leaves every other key untouched. */
function decodeModelUi(ui: Record<string, unknown>): Record<string, unknown> {
	const decoded = { ...ui };
	if (Object.hasOwn(decoded, 'trainingLogOpen')) {
		decoded.trainingLogOpen = decoded.trainingLogOpen === true;
	}
	if (Object.hasOwn(decoded, 'results')) {
		const results = sanitiseModelResultsUi(decoded.results);
		if (Object.keys(results).length > 0) decoded.results = results;
		else delete decoded.results;
	}
	return decoded;
}

function nonnegativeInteger(value: unknown): value is number {
	return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/** Failure categories shared by the durable checkpoint and browser-state writer. */
export type PersistenceFailure = {
	ok: false;
	reason: 'quota' | 'security' | 'read-only' | 'unavailable' | 'conflict';
};

/** Maps browser exceptions to a safe persistence acknowledgement. */
export function storageFailure(error: unknown): PersistenceFailure {
	if (error instanceof Error || error instanceof DOMException) {
		if (error.name === 'SecurityError') return { ok: false, reason: 'security' };
		if (
			error.name === 'QuotaExceededError' ||
			error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
			error.message.toLowerCase().includes('quota')
		) {
			return { ok: false, reason: 'quota' };
		}
	}
	return { ok: false, reason: 'unavailable' };
}

const operationKinds = ['start', 'finish', 'cancel', 'recover', 'discard', 'replace'] as const;

/** Committed operation retained until the matching localStorage write is acknowledged. */
export type PendingTrainingDomain = {
	operationId: string;
	kind: (typeof operationKinds)[number];
	domain: ProtectedDomainSnapshot;
};

/** Versioned coordination row sharing the database's existing result store. */
export type TrainingDomainCheckpoint = {
	kind: 'training-domain-checkpoint';
	schemaVersion: 1;
	datasetId: typeof TRAINING_DOMAIN_DATASET_ID;
	modelNum: 0;
	generation: number;
	pending: PendingTrainingDomain | null;
};

/** Resource change committed in the same transaction as the domain candidate. */
export type TrainingDomainMutation =
	| { type: 'none' }
	| { type: 'insert-result'; result: ResultEnvelope }
	| { type: 'delete-results'; datasetId: string }
	| { type: 'delete-dataset'; datasetId: string }
	| { type: 'publish-replacement'; datasetId: string };

type CheckpointRead =
	| { ok: true; checkpoint: TrainingDomainCheckpoint | null }
	| PersistenceFailure;

/** Decodes the coordination row and rejects invalid or newer versions before any mutation. */
export function decodeTrainingCheckpoint(value: unknown): CheckpointRead {
	if (value === undefined) return { ok: true, checkpoint: null };
	if (
		isPlainObject(value) &&
		typeof value.schemaVersion === 'number' &&
		value.schemaVersion > 1
	) {
		return { ok: false, reason: 'read-only' };
	}
	if (
		!isPlainObject(value) ||
		value.kind !== 'training-domain-checkpoint' ||
		value.schemaVersion !== 1 ||
		value.datasetId !== TRAINING_DOMAIN_DATASET_ID ||
		value.modelNum !== 0 ||
		!nonnegativeInteger(value.generation)
	) {
		return { ok: false, reason: 'unavailable' };
	}

	let pending: PendingTrainingDomain | null = null;
	if (value.pending !== null) {
		const source = value.pending;
		if (
			!isPlainObject(source) ||
			typeof source.operationId !== 'string' ||
			source.operationId.length === 0
		) {
			return { ok: false, reason: 'unavailable' };
		}
		const kind = operationKinds.find((candidate) => candidate === source.kind);
		const decoded = decodeProtectedDomain(source.domain, true);
		if (!kind || !decoded || value.generation === 0)
			return { ok: false, reason: 'unavailable' };
		pending = { operationId: source.operationId, kind, domain: decoded.domain };
	}
	return {
		ok: true,
		checkpoint: {
			kind: 'training-domain-checkpoint',
			schemaVersion: 1,
			datasetId: TRAINING_DOMAIN_DATASET_ID,
			modelNum: 0,
			generation: value.generation,
			pending
		}
	};
}

/** Reads the retained fence without treating a failed read as a missing row. */
export async function readTrainingCheckpoint(
	db: IDBPDatabase<SamataDBSchema>
): Promise<CheckpointRead> {
	try {
		return decodeTrainingCheckpoint(await db.get('model_results', TRAINING_DOMAIN_KEY));
	} catch (error) {
		return storageFailure(error);
	}
}

function realDataset(id: string): boolean {
	return id.length > 0 && id !== TRAINING_DOMAIN_DATASET_ID;
}

function validMutation(mutation: TrainingDomainMutation, domain: ProtectedDomainSnapshot): boolean {
	switch (mutation.type) {
		case 'none':
			return true;
		case 'insert-result': {
			const { result } = mutation;
			return (
				realDataset(result.datasetId) &&
				domain.dataset?.id === result.datasetId &&
				domain.target === result.target &&
				domain.models.some(
					(model) =>
						model.num === result.modelNum &&
						model.createdAt === result.modelCreatedAt &&
						model.resultRevision === result.runId &&
						model.status === 'trained'
				)
			);
		}
		case 'publish-replacement':
			return realDataset(mutation.datasetId) && domain.dataset?.id === mutation.datasetId;
		case 'delete-results':
		case 'delete-dataset':
			return realDataset(mutation.datasetId);
	}
}

/** Commits one protected generation and its resource mutation atomically. */
export async function commitTrainingCheckpoint(
	db: IDBPDatabase<SamataDBSchema>,
	expectedGeneration: number,
	pending: PendingTrainingDomain,
	mutation: TrainingDomainMutation
): Promise<{ ok: true; checkpoint: TrainingDomainCheckpoint } | PersistenceFailure> {
	let abort: (() => void) | undefined;
	let done: Promise<unknown> | undefined;
	try {
		const candidate = decodeTrainingCheckpoint({
			kind: 'training-domain-checkpoint',
			schemaVersion: 1,
			datasetId: TRAINING_DOMAIN_DATASET_ID,
			modelNum: 0,
			generation: expectedGeneration + 1,
			pending
		});
		if (
			!nonnegativeInteger(expectedGeneration) ||
			!candidate.ok ||
			!candidate.checkpoint?.pending
		) {
			return { ok: false, reason: 'unavailable' };
		}
		if (!validMutation(mutation, candidate.checkpoint.pending.domain))
			return { ok: false, reason: 'conflict' };

		const tx = db.transaction(['metadata', 'raw_records', 'model_results'], 'readwrite');
		abort = () => tx.abort();
		done = tx.done;
		void done.catch(() => {});
		const results = tx.objectStore('model_results');
		const current = decodeTrainingCheckpoint(await results.get(TRAINING_DOMAIN_KEY));
		if (
			!current.ok ||
			current.checkpoint?.pending ||
			(current.checkpoint?.generation ?? 0) !== expectedGeneration
		) {
			await done;
			return current.ok ? { ok: false, reason: 'conflict' } : current;
		}

		switch (mutation.type) {
			case 'none':
				break;
			case 'insert-result':
				await results.put({ ...mutation.result });
				break;
			case 'publish-replacement':
				if (!(await tx.objectStore('metadata').get(mutation.datasetId))) {
					await done;
					return { ok: false, reason: 'conflict' };
				}
				break;
			case 'delete-dataset':
				await Promise.all([
					tx.objectStore('metadata').delete(mutation.datasetId),
					tx.objectStore('raw_records').delete(datasetRowRange(mutation.datasetId))
				]);
				// The dataset's real results are removed by the same transaction.
				await results.delete(
					IDBKeyRange.bound([mutation.datasetId, 1], [mutation.datasetId, Infinity])
				);
				break;
			case 'delete-results':
				await results.delete(
					IDBKeyRange.bound([mutation.datasetId, 1], [mutation.datasetId, Infinity])
				);
				break;
		}
		await results.put(candidate.checkpoint);
		await done;
		return { ok: true, checkpoint: candidate.checkpoint };
	} catch (error) {
		try {
			abort?.();
		} catch {
			/* The browser may already have aborted the transaction. */
		}
		await done?.catch(() => {});
		return storageFailure(error);
	}
}

/** Clears only the acknowledged candidate and retains its monotonic generation fence. */
export async function clearPendingTrainingCheckpoint(
	db: IDBPDatabase<SamataDBSchema>,
	generation: number,
	operationId: string
): Promise<{ ok: true; generation: number } | PersistenceFailure> {
	try {
		const tx = db.transaction('model_results', 'readwrite');
		const done = tx.done;
		void done.catch(() => {});
		const current = decodeTrainingCheckpoint(await tx.store.get(TRAINING_DOMAIN_KEY));
		if (!current.ok) return current;
		const checkpoint = current.checkpoint;
		if (
			!checkpoint ||
			checkpoint.generation !== generation ||
			(checkpoint.pending && checkpoint.pending.operationId !== operationId)
		) {
			return { ok: false, reason: 'conflict' };
		}
		if (checkpoint.pending) await tx.store.put({ ...checkpoint, pending: null });
		await done;
		return { ok: true, generation };
	} catch (error) {
		return storageFailure(error);
	}
}
