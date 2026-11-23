import { atom } from 'nanostores';
import { headlineMetrics } from '../../../common/evaluation/headline-metrics';
import { INGESTION_LOCK, deleteDataset, getMetadata } from '../../../common/storage/db';
import {
	readTrainingCheckpoint,
	type PendingTrainingDomain,
	type PersistenceFailure,
	type ProtectedDomainSnapshot,
	type TrainingDomainMutation
} from '../../../common/storage/training-domain';
import {
	$appState,
	reduceCreateModel,
	reduceDatasetReplacement,
	reduceTargetChange,
	reduceTrainingOutcome,
	reduceTrainingStart,
	reduceViewResults,
	updateTrainingProgress,
	type TrainingOutcome
} from '../../../stores/app.store';
import {
	commitProtectedTrainingChange,
	flushSubmittedDraft,
	publishNewerTrainingSnapshot,
	publishRecoveredTrainingSnapshot,
	readGuardedTrainingSnapshot,
	retryTrainingPublication,
	withTrainingStateLock,
	TRAINING_STATE_LOCK,
	type GuardedSnapshot,
	type PersistenceAck,
	type ProtectedTrainingChange,
	type TrainingPersistenceOptions,
	type TrainingStateContext
} from '../../../stores/persister';
import { $scrollState, clearScroll } from '../../../stores/scroll.store';
import {
	appendTrainingLog,
	applyTrainingSessionUpdate,
	createTrainingSession,
	getTrainingSession,
	setTrainingSessionStatus
} from '../../../stores/training.store';
import type {
	ResultEnvelope,
	ResultEnvelopeV2,
	TrainingRunIdentity
} from '../../../types/model-result';
import type { DatasetMetadata } from '../../../types/dataset';
import {
	INITIAL_APP_STATE,
	type DatasetSummary,
	type ModelRecord,
	type PersistedAppState,
	type TrainingError
} from '../../../types/state';
import { buildFeatureRows } from '../feature-eligibility';
import { isClassifierId } from '../model-catalogue';
import { MULTICLASS_STRATEGY } from '../model-presentation-policy';
import { computeTrainingSetupBounds, validateFoldCount } from '../training-setup';
import { configureClassifier } from './classifier-adapters';
import {
	createTrainingReplyGuard,
	type TrainingFailureCode,
	type TrainingStartRequest,
	type TrainingWorkerReply
} from './protocol';
import { readModelResult } from './result-repository';
import { isTrainingRunIdentity, sameTrainingRun } from './result-validation';
import { ClassificationError } from './types';

/** Failure returned by an acknowledged training-domain command. */
export type TrainingCommandFailure = {
	ok: false;
	code:
		| TrainingFailureCode
		| 'busy'
		| 'remote-training'
		| 'conflict'
		| 'saving-failed'
		| 'cancelled';
	reason?: PersistenceFailure['reason'];
	pending?: PendingTrainingDomain['kind'];
};

/** Result of a training or protected state operation, after its storage acknowledgement. */
export type TrainingCommandResult<Value = undefined> =
	| { ok: true; value: Value }
	| TrainingCommandFailure;

type StopPublication = {
	identity: TrainingRunIdentity;
	stoppedStatus: 'cancelled' | 'failed';
	stop: { error: TrainingError; generation: number };
};

/** An operation whose IndexedDB mutation committed and whose publication needs retry. */
export type PublicationPending = {
	operationId: string;
	kind: PendingTrainingDomain['kind'];
} & Partial<StopPublication>;

type CommittedStop = PublicationPending & StopPublication;

/** Route-independent notification for an operation whose state still needs to be published. */
export const $publicationPending = atom<PublicationPending | null>(null);

type WorkerPort = Pick<
	Worker,
	'onmessage' | 'onmessageerror' | 'onerror' | 'postMessage' | 'terminate'
>;
type WorkerTerminal = Exclude<TrainingWorkerReply, { kind: 'progress' }>;

/** Injectable browser resources for deterministic command and race tests. */
export interface TrainingServiceOptions {
	locks?: Pick<LockManager, 'request' | 'query'>;
	persistence?: TrainingPersistenceOptions;
	createWorker?: () => WorkerPort;
	isIsolated?: () => boolean;
	newId?: () => string;
	now?: () => number;
	elapsedTime?: () => number;
}

type ActiveAttempt = {
	request: TrainingStartRequest;
	done: Promise<TrainingCommandResult>;
	cancelled: boolean;
	saving: boolean;
	port: WorkerPort | null;
	previousErrorTimestamp?: number;
};

type StoppedRepair = {
	identity: TrainingRunIdentity;
	status: 'cancelled' | 'failed';
	outcome: Extract<TrainingOutcome, { kind: 'stopped' }>;
};

const conflict = { ok: false, reason: 'conflict' } as const;

function modelIn(
	state: ProtectedDomainSnapshot,
	identity: TrainingRunIdentity
): ModelRecord | undefined {
	if (state.dataset?.id !== identity.datasetId || state.target !== identity.target)
		return undefined;
	return state.models.find(
		(model) => model.num === identity.modelNum && model.createdAt === identity.modelCreatedAt
	);
}

function configuration(model: ModelRecord, rowCount: number) {
	if (
		!model.modelId ||
		!isClassifierId(model.modelId) ||
		model.hyperparameters.mode !== 'manual' ||
		!model.trainingSetup ||
		model.features.length === 0 ||
		!(['choose-model', 'select-features', 'configure-model'] as const).every((section) =>
			model.completedSteps.includes(section)
		)
	)
		return null;
	const { classifier, effectiveOptions } = configureClassifier(
		model.modelId,
		model.hyperparameters.values,
		{
			rowCount,
			classCount: 0
		}
	);
	// Keep saved result keys compatible with releases before these library-only options appeared.
	const identityOptions = Object.entries(effectiveOptions)
		.filter(
			([name]) =>
				!(classifier.algorithm === 'k-neighbors-classifier' && name === 'leafSize') &&
				!(classifier.algorithm === 'mlp-classifier' && name === 'validationFraction')
		)
		.sort(([left], [right]) => left.localeCompare(right, 'en'));
	const configurationKey = JSON.stringify([
		classifier.algorithm,
		model.features,
		identityOptions,
		model.multiclass ?? MULTICLASS_STRATEGY[classifier.algorithm],
		model.trainingSetup.type === 'one_shot'
			? [
					model.trainingSetup.type,
					model.trainingSetup.testRatio,
					model.trainingSetup.randomState
				]
			: [
					model.trainingSetup.type,
					model.trainingSetup.outerFolds,
					model.trainingSetup.randomState
				]
	]);
	return { classifier, configurationKey, setup: model.trainingSetup };
}

/** Reconstructs the exact configuration identity for an existing model. */
export function getTrainingConfigurationKey(model: ModelRecord, rowCount: number): string | null {
	try {
		return configuration(model, rowCount)?.configurationKey ?? null;
	} catch {
		return null;
	}
}

function stoppedDraft(state: ProtectedDomainSnapshot, publication: CommittedStop) {
	const model = modelIn(state, publication.identity);
	const error = model?.error;
	const original = publication.stop.error;
	if (
		state.dataset &&
		model?.status === 'draft' &&
		model.resultRevision === null &&
		error &&
		error.code === original.code &&
		error.message === original.message &&
		error.timestamp === original.timestamp &&
		error.details === original.details &&
		getTrainingConfigurationKey(model, state.dataset.rowCount) ===
			publication.identity.configurationKey
	)
		return model;
	return undefined;
}

function metadataAllows(metadata: DatasetMetadata, request: TrainingStartRequest): boolean {
	const target = metadata.columns.find((column) => column.name === request.identity.target);
	const bounds = computeTrainingSetupBounds(target ?? null);
	if (bounds.blocked) return false;
	if (
		request.setup.type === 'nested_cv' &&
		validateFoldCount(request.setup.outerFolds, bounds.maxFolds)
	) {
		return false;
	}
	const eligible = buildFeatureRows(metadata, request.identity.target, null);
	return request.features.every((name) =>
		eligible.some((column) => column.name === name && column.eligible)
	);
}

function notice(
	ack: PersistenceFailure,
	pending?: PendingTrainingDomain['kind']
): TrainingCommandFailure {
	return {
		ok: false,
		code: ack.reason === 'conflict' ? 'conflict' : 'storage-unavailable',
		reason: ack.reason,
		pending
	};
}

function stoppedOutcome(
	code: TrainingCommandFailure['code'],
	now: number
): StoppedRepair['outcome'] {
	const cancelled = code === 'cancelled';
	const message = cancelled
		? 'Training was cancelled'
		: code === 'invalid-request'
			? 'The library rejected this training setup'
			: code === 'saving-failed'
				? 'The result could not be saved'
				: 'Training could not finish';
	return {
		kind: 'stopped',
		error: {
			code: cancelled ? 'TRAINING_CANCELLED' : 'TRAINING_FAILED',
			message,
			timestamp: now,
			details: code
		}
	};
}

function domain(state: PersistedAppState) {
	const { dataset, target, data, models, nextModelNum, comparisonContextEpoch } = state;
	return { dataset, target, data, models, nextModelNum, comparisonContextEpoch };
}

/** Creates the route-independent service that owns resource locks and worker settlement. */
export function createTrainingService(options: TrainingServiceOptions = {}) {
	const active = new Map<number, ActiveAttempt>();
	const stoppedRepairs = new Map<string, StoppedRepair>();
	const committedStops = new Map<string, CommittedStop>();
	const exclusiveIntents = new Set<string>();
	let pendingDatasetCleanup: { id: string; cleanup: () => Promise<void> } | null = null;
	const newId = options.newId ?? (() => crypto.randomUUID());
	const now = options.now ?? Date.now;
	const elapsed = options.elapsedTime ?? (() => performance.now());
	const makeWorker =
		options.createWorker ?? (() => new Worker(TRAINING_WORKER_URL, { type: 'module' }));
	const isIsolated =
		options.isIsolated ?? (() => typeof window !== 'undefined' && window.crossOriginIsolated);
	const getLocks = () =>
		options.locks ?? (typeof navigator !== 'undefined' ? navigator.locks : undefined);
	const persistence: TrainingPersistenceOptions = {
		...options.persistence,
		...(options.locks &&
			!options.persistence?.withStateLock && {
				withStateLock: <T>(operation: () => Promise<T>) =>
					options.locks!.request(TRAINING_STATE_LOCK, operation)
			})
	};

	async function checkpoint(
		kind: PendingTrainingDomain['kind'],
		prepare: (
			current: GuardedSnapshot,
			context: TrainingStateContext
		) =>
			| { state: PersistedAppState; mutation: TrainingDomainMutation }
			| PersistenceFailure
			| Promise<
					| { state: PersistedAppState; mutation: TrainingDomainMutation }
					| PersistenceFailure
			  >,
		identity?: TrainingRunIdentity,
		stopped?: StoppedRepair
	): Promise<{ ack: PersistenceAck; committed: boolean }> {
		const operationId = newId();
		let committedGeneration: number | undefined;
		const ack = await commitProtectedTrainingChange(
			async (current, context): Promise<ProtectedTrainingChange | PersistenceFailure> => {
				const candidate = await prepare(current, context);
				if ('ok' in candidate) return candidate;
				return {
					pending: { operationId, kind, domain: domain(candidate.state) },
					mutation: candidate.mutation
				};
			},
			{
				...persistence,
				onCommitted: (checkpoint) => {
					committedGeneration = checkpoint.generation;
				}
			}
		);
		if (!ack.ok && committedGeneration !== undefined) {
			if (stopped) {
				const publication = {
					operationId,
					kind,
					identity: stopped.identity,
					stoppedStatus: stopped.status,
					stop: { error: stopped.outcome.error, generation: committedGeneration }
				};
				committedStops.set(stopped.identity.runId, publication);
				$publicationPending.set(publication);
			} else {
				$publicationPending.set({ operationId, kind, identity });
			}
		} else if (ack.ok && $publicationPending.get()?.operationId === operationId) {
			$publicationPending.set(null);
		}
		return { ack, committed: committedGeneration !== undefined };
	}

	async function withResource<Value>(
		name: string,
		mode: LockMode,
		ifAvailable: boolean,
		operation: () => Promise<TrainingCommandResult<Value>>
	): Promise<TrainingCommandResult<Value>> {
		const locks = getLocks();
		if (!locks) return { ok: false, code: 'storage-unavailable', reason: 'unavailable' };
		try {
			return await locks.request(name, { mode, ifAvailable }, async (lock) => {
				if (lock) return operation();
				const snapshot = await locks.query();
				const remote =
					name === INGESTION_LOCK &&
					snapshot.held?.some(
						(entry) => entry.name === INGESTION_LOCK && entry.mode === 'shared'
					);
				return { ok: false, code: remote ? 'remote-training' : 'busy' };
			});
		} catch {
			return { ok: false, code: 'storage-unavailable', reason: 'unavailable' };
		}
	}

	function cancel(attempt: ActiveAttempt): void {
		if (attempt.saving || attempt.cancelled) return;
		attempt.cancelled = true;
		setTrainingSessionStatus(attempt.request.identity, 'cancelling');
		attempt.port?.postMessage({ kind: 'cancel', runId: attempt.request.identity.runId });
	}

	async function cancelDataset(datasetId: string): Promise<void> {
		const attempts = [...active.values()].filter(
			(attempt) => attempt.request.identity.datasetId === datasetId
		);
		for (const attempt of attempts) cancel(attempt);
		await Promise.all(attempts.map((attempt) => attempt.done));
	}

	function runWorker(attempt: ActiveAttempt): Promise<WorkerTerminal> {
		const { identity } = attempt.request;
		return new Promise((resolve) => {
			const guard = createTrainingReplyGuard(identity);
			let done = false;
			function settle(reply: WorkerTerminal): void {
				if (done) return;
				done = true;
				guard.close();
				attempt.port?.terminate();
				attempt.port = null;
				resolve(reply);
			}
			try {
				const port = makeWorker();
				attempt.port = port;
				port.onmessage = ({ data }) => {
					const reply = guard.accept(data);
					if (!reply) {
						if (
							typeof data === 'object' &&
							data !== null &&
							'identity' in data &&
							isTrainingRunIdentity(data.identity) &&
							sameTrainingRun(data.identity, identity)
						) {
							settle({ kind: 'failed', identity, code: 'worker-protocol-error' });
						}
						return;
					}
					if (reply.kind === 'progress') {
						if (!attempt.cancelled && applyTrainingSessionUpdate(identity, reply)) {
							updateTrainingProgress(identity, reply.progress);
						}
						return;
					}
					settle(reply);
				};
				port.onerror = () => settle({ kind: 'failed', identity, code: 'worker-crashed' });
				port.onmessageerror = () =>
					settle({ kind: 'failed', identity, code: 'worker-protocol-error' });
				port.postMessage(attempt.request);
			} catch {
				settle({ kind: 'failed', identity, code: 'worker-startup-failed' });
			}
		});
	}

	function finishStoppedSession(identity: TrainingRunIdentity, status: StoppedRepair['status']) {
		const entries = appendTrainingLog(
			getTrainingSession(identity)?.logEntries ?? [],
			{ key: status },
			now()
		);
		setTrainingSessionStatus(identity, status, entries);
	}

	async function repairStopped(
		repair: StoppedRepair,
		kind: 'cancel' | 'finish' | 'recover'
	): Promise<TrainingCommandResult> {
		const { identity, status, outcome } = repair;
		const { ack, committed } = await checkpoint(
			kind,
			({ state }) => {
				const next = state && reduceTrainingOutcome(state, identity, outcome);
				return next ? { state: next, mutation: { type: 'none' } } : conflict;
			},
			identity,
			repair
		);
		// After commit the checkpoint owns replay, including when its publication fails.
		if (committed || ack.ok) stoppedRepairs.delete(identity.runId);
		else stoppedRepairs.set(identity.runId, repair);
		if (!ack.ok) {
			setTrainingSessionStatus(identity, 'stopped-pending');
			return notice(ack, committed ? kind : 'recover');
		}
		finishStoppedSession(identity, status);
		return { ok: true, value: undefined };
	}

	async function settleStopped(
		attempt: ActiveAttempt,
		code: TrainingCommandFailure['code']
	): Promise<TrainingCommandResult> {
		const status = code === 'cancelled' ? 'cancelled' : 'failed';
		// A stopped draft no longer has a run ID. Keep successive stop evidence distinct even if the clock stalls.
		const timestamp = Math.max(now(), (attempt.previousErrorTimestamp ?? -1) + 1);
		const result = await repairStopped(
			{
				identity: attempt.request.identity,
				status,
				outcome: stoppedOutcome(code, timestamp)
			},
			status === 'cancelled' ? 'cancel' : 'finish'
		);
		return result.ok ? { ok: false, code } : result;
	}

	async function train(
		attempt: ActiveAttempt,
		captured: PersistedAppState,
		model: ModelRecord
	): Promise<TrainingCommandResult> {
		const { identity } = attempt.request;
		const startedAt = elapsed();
		let invalidRequest = false;
		const { ack, committed } = await checkpoint(
			'start',
			async ({ state }, context) => {
				if (!state || attempt.cancelled) return conflict;
				const metadata = await getMetadata(context.db, identity.datasetId);
				if (!metadata || !metadataAllows(metadata, attempt.request)) {
					invalidRequest = true;
					return conflict;
				}
				const flushed = flushSubmittedDraft(context, state, captured, model);
				if (!flushed.ok) return flushed;
				const stored = modelIn(flushed.state, identity);
				if (
					!stored ||
					configuration(stored, metadata.rowCount)?.configurationKey !==
						identity.configurationKey
				)
					return conflict;
				attempt.previousErrorTimestamp = stored.error?.timestamp;
				const next = reduceTrainingStart(flushed.state, identity);
				return next ? { state: next, mutation: { type: 'none' } } : conflict;
			},
			identity
		);
		if (!ack.ok) {
			setTrainingSessionStatus(identity, committed ? 'publication-pending' : 'failed');
			return invalidRequest
				? { ok: false, code: 'invalid-request' }
				: attempt.cancelled && !committed
					? { ok: false, code: 'cancelled' }
					: notice(ack, committed ? 'start' : undefined);
		}
		if (attempt.cancelled) return settleStopped(attempt, 'cancelled');
		setTrainingSessionStatus(identity, 'running');
		const reply = await runWorker(attempt);
		if (attempt.cancelled || reply.kind === 'cancelled')
			return settleStopped(attempt, 'cancelled');
		if (reply.kind === 'failed') return settleStopped(attempt, reply.code);
		const expectedStrategy =
			attempt.request.setup.type === 'one_shot' ? 'one_shot' : 'cross_validation';
		if (reply.result.strategy !== expectedStrategy)
			return settleStopped(attempt, 'worker-protocol-error');

		attempt.saving = true;
		const durationMs = Math.max(0, elapsed() - startedAt);
		setTrainingSessionStatus(identity, 'saving');
		const entries = appendTrainingLog(
			appendTrainingLog(
				getTrainingSession(identity)?.logEntries ?? [],
				{ key: 'saving' },
				now()
			),
			{ key: 'completed' },
			now()
		);
		const envelope: ResultEnvelopeV2 = {
			...reply.result,
			...identity,
			schemaVersion: 2,
			algorithm: attempt.request.classifier.algorithm,
			durationMs,
			logEntries: entries
		};
		const finish = await checkpoint(
			'finish',
			({ state }) => {
				const stored = state && modelIn(state, identity);
				if (
					!state ||
					!stored ||
					configuration(stored, state.dataset!.rowCount)?.configurationKey !==
						identity.configurationKey
				)
					return conflict;
				const next = reduceTrainingOutcome(state, identity, {
					kind: 'success',
					durationMs,
					metrics: headlineMetrics(envelope.evaluation)
				});
				return next
					? { state: next, mutation: { type: 'insert-result', result: envelope } }
					: conflict;
			},
			identity
		);
		if (!finish.ack.ok) {
			if (!finish.committed) return settleStopped(attempt, 'saving-failed');
			setTrainingSessionStatus(identity, 'publication-pending');
			return notice(finish.ack, 'finish');
		}
		setTrainingSessionStatus(identity, 'complete', entries);
		return { ok: true, value: undefined };
	}

	async function start(modelNum: number): Promise<TrainingCommandResult> {
		const captured = $appState.get();
		const model = captured.models.find((entry) => entry.num === modelNum);
		if (!isIsolated()) return { ok: false, code: 'environment-not-supported' };
		if (!captured.dataset || !captured.target || !model || model.status !== 'draft')
			return { ok: false, code: 'invalid-request' };
		if (active.has(modelNum) || exclusiveIntents.has(captured.dataset.id))
			return { ok: false, code: 'busy' };
		let config;
		try {
			config = configuration(model, captured.dataset.rowCount);
		} catch (error) {
			return {
				ok: false,
				code: error instanceof ClassificationError ? error.code : 'invalid-options'
			};
		}
		if (!config) return { ok: false, code: 'invalid-request' };
		const identity: TrainingRunIdentity = {
			datasetId: captured.dataset.id,
			target: captured.target,
			modelNum,
			modelCreatedAt: model.createdAt,
			configurationKey: config.configurationKey,
			runId: newId()
		};
		const attempt: ActiveAttempt = {
			request: {
				kind: 'start',
				identity,
				classifier: config.classifier,
				features: [...model.features],
				setup: config.setup
			},
			done: Promise.resolve({ ok: false, code: 'cancelled' }),
			cancelled: false,
			saving: false,
			port: null
		};
		active.set(modelNum, attempt);
		createTrainingSession(identity);
		attempt.done = withResource(INGESTION_LOCK, 'shared', true, () =>
			withResource(`samata-ml:training:${modelNum}`, 'exclusive', true, () =>
				train(attempt, captured, model)
			)
		);
		try {
			const result = await attempt.done;
			if (!result.ok && getTrainingSession(identity)?.status === 'pending')
				setTrainingSessionStatus(identity, 'failed');
			return result;
		} finally {
			active.delete(modelNum);
		}
	}

	async function retry(expected?: TrainingRunIdentity): Promise<TrainingCommandResult> {
		const pending = $publicationPending.get();
		const identity = pending?.identity;
		const expectedStop = expected && committedStops.get(expected.runId);
		const matchingStop =
			expectedStop && expected && sameTrainingRun(expected, expectedStop.identity)
				? expectedStop
				: undefined;
		if (identity && pending?.stop) {
			const expectedRepair = expected && stoppedRepairs.get(expected.runId);
			const hasExpectedRepair =
				expected && expectedRepair && sameTrainingRun(expected, expectedRepair.identity);
			if (
				expected?.modelNum === identity.modelNum &&
				!sameTrainingRun(expected, identity) &&
				!hasExpectedRepair &&
				!matchingStop
			)
				return notice(conflict, pending.kind);
			const stopped = await recoverStoppedPublication(currentCommittedStop(pending));
			if (!stopped.ok) return stopped;
		} else if (identity && pending?.kind === 'finish') {
			const finished = await recoverCompletedResult(
				identity.modelNum,
				identity,
				pending.operationId
			);
			if (!finished.ok) return finished;
		} else {
			const ack = await retryTrainingPublication(persistence);
			if (!ack.ok) {
				const pendingStop = expected
					? stoppedRepairs.has(expected.runId)
					: stoppedRepairs.size > 0;
				return notice(ack, pending?.kind ?? (pendingStop ? 'recover' : undefined));
			}
		}
		if (identity && pending?.kind === 'start') {
			stoppedRepairs.set(identity.runId, {
				identity,
				status: 'failed',
				outcome: {
					kind: 'stopped',
					error: {
						code: 'TRAINING_INTERRUPTED_BY_RELOAD',
						message: 'Training was interrupted',
						timestamp: now()
					}
				}
			});
			setTrainingSessionStatus(identity, 'stopped-pending');
		}
		if (pending?.kind === 'replace' && pendingDatasetCleanup) {
			const cleanup = pendingDatasetCleanup;
			pendingDatasetCleanup = null;
			await withResource(INGESTION_LOCK, 'exclusive', false, async () => {
				const state = await withTrainingStateLock(readGuardedTrainingSnapshot, persistence);
				if (state.ok && !state.replayed && state.state?.dataset?.id === cleanup.id) {
					try {
						await cleanup.cleanup();
					} catch {
						/* Startup cleanup retries older data. */
					}
				}
				return { ok: true, value: undefined };
			});
		}
		if (pending && $publicationPending.get()?.operationId === pending.operationId)
			$publicationPending.set(null);

		const stop =
			matchingStop ??
			(!pending && !expected ? committedStops.values().next().value : undefined);
		if (stop && stop.operationId !== pending?.operationId) {
			const stopped = await recoverStoppedPublication(stop);
			if (!stopped.ok) return stopped;
		}

		const repairIdentity = expected ?? (pending?.kind === 'start' ? identity : undefined);
		const repair = repairIdentity
			? stoppedRepairs.get(repairIdentity.runId)
			: pending
				? undefined
				: stoppedRepairs.values().next().value;
		if (repair && (!repairIdentity || sameTrainingRun(repair.identity, repairIdentity))) {
			return withResource(INGESTION_LOCK, 'shared', true, () =>
				withResource(
					`samata-ml:training:${repair.identity.modelNum}`,
					'exclusive',
					true,
					async () =>
						stoppedRepairs.get(repair.identity.runId) === repair
							? repairStopped(repair, 'recover')
							: { ok: true, value: undefined }
				)
			);
		}
		return { ok: true, value: undefined };
	}

	function currentCommittedStop(pending = $publicationPending.get()): CommittedStop | undefined {
		const stop = pending?.identity && committedStops.get(pending.identity.runId);
		return stop?.operationId === pending?.operationId ? stop : undefined;
	}

	/** Settles an acknowledged stop, including after another tab has cleared its checkpoint. */
	function recoverStoppedPublication(
		publication = currentCommittedStop(),
		automatic = false
	): Promise<TrainingCommandResult> {
		const done = { ok: true, value: undefined } as const;
		if (!publication) return Promise.resolve(done);
		const { identity, operationId, kind, stop, stoppedStatus } = publication;
		return withResource(INGESTION_LOCK, 'shared', false, () =>
			withResource(`samata-ml:training:${identity.modelNum}`, 'shared', false, async () => {
				const recovered = await withTrainingStateLock(async (context) => {
					if (committedStops.get(identity.runId) !== publication) return done;
					const snapshot = await readGuardedTrainingSnapshot(context);
					let matches: boolean;
					if (snapshot.ok) {
						const state = snapshot.state;
						if (
							!state ||
							snapshot.generation < stop.generation ||
							$appState.get().trainingDomainGeneration > snapshot.generation
						)
							return conflict;
						const model = stoppedDraft(state, publication);
						matches = Boolean(model);
						if (!snapshot.replayed) {
							if (model) publishRecoveredTrainingSnapshot(context, state, model);
							else publishNewerTrainingSnapshot(state);
						}
					} else {
						if (!automatic) return snapshot;
						// A later denied publication can still carry a stop already visible in this tab.
						const stored = await readTrainingCheckpoint(context.db);
						const checkpoint = stored.ok && stored.checkpoint;
						const visible = $appState.get();
						if (
							!checkpoint ||
							!checkpoint.pending ||
							checkpoint.generation <= visible.trainingDomainGeneration ||
							visible.trainingDomainGeneration < stop.generation ||
							!stoppedDraft(visible, publication) ||
							!stoppedDraft(checkpoint.pending.domain, publication)
						)
							return snapshot;
						matches = true;
					}
					committedStops.delete(identity.runId);
					if (matches) finishStoppedSession(identity, stoppedStatus);
					if ($publicationPending.get()?.operationId === operationId)
						$publicationPending.set(null);
					return done;
				}, persistence);
				return recovered.ok ? recovered : notice(recovered, kind);
			})
		);
	}

	/** Settles committed stops when this tab advances through a guarded write or refresh. */
	function observePublishedStops(): () => void {
		const recovering = new Set<CommittedStop>();
		let observing = true;
		const recover = () => {
			const generation = $appState.get().trainingDomainGeneration;
			for (const publication of committedStops.values()) {
				if (recovering.has(publication) || generation < publication.stop.generation)
					continue;
				recovering.add(publication);
				void recoverStoppedPublication(publication, true).finally(() => {
					recovering.delete(publication);
					if (observing && $appState.get().trainingDomainGeneration > generation)
						recover();
				});
			}
		};
		const unlistenState = $appState.listen((state, previous) => {
			if (state.trainingDomainGeneration !== previous?.trainingDomainGeneration) recover();
		});
		const unlistenPending = $publicationPending.listen(recover);
		recover();
		return () => {
			observing = false;
			unlistenState();
			unlistenPending();
		};
	}

	function recoverCompletedResult(
		modelNum: number,
		expected?: TrainingRunIdentity,
		finishOperationId?: string
	): Promise<TrainingCommandResult<ResultEnvelope | null>> {
		return withResource(INGESTION_LOCK, 'shared', false, () =>
			withResource(
				`samata-ml:training:${modelNum}`,
				'shared',
				false,
				async (): Promise<TrainingCommandResult<ResultEnvelope | null>> => {
					const fetched = await withTrainingStateLock(async (context) => {
						if (
							finishOperationId &&
							$publicationPending.get()?.operationId !== finishOperationId
						) {
							return { ok: true as const, value: null };
						}
						const snapshot = await readGuardedTrainingSnapshot(context);
						if (!snapshot.ok) return snapshot;
						const state = snapshot.state;
						const model = state?.models.find((entry) => entry.num === modelNum);
						const result =
							state?.dataset &&
							state.target &&
							model?.status === 'trained' &&
							model.resultRevision
								? await readModelResult(
										context.db,
										state.dataset.id,
										modelNum,
										expected
									)
								: null;
						if (
							!state?.dataset ||
							!model ||
							!result ||
							result.target !== state.target ||
							result.modelCreatedAt !== model.createdAt ||
							result.runId !== model.resultRevision ||
							result.configurationKey !==
								getTrainingConfigurationKey(model, state.dataset.rowCount)
						) {
							return finishOperationId
								? conflict
								: { ok: true as const, value: null };
						}
						const pending = $publicationPending.get();
						if (finishOperationId && pending?.operationId !== finishOperationId) {
							return { ok: true as const, value: null };
						}
						const matchingFinish =
							pending?.kind === 'finish' &&
							!pending.stop &&
							pending.identity &&
							sameTrainingRun(pending.identity, result);
						if (matchingFinish) {
							if ($appState.get().trainingDomainGeneration > snapshot.generation)
								return conflict;
							if (!snapshot.replayed)
								publishRecoveredTrainingSnapshot(context, state, model);
						}
						createTrainingSession(result);
						setTrainingSessionStatus(result, 'complete', result.logEntries);
						if (
							matchingFinish &&
							$publicationPending.get()?.operationId === pending.operationId
						) {
							$publicationPending.set(null);
						}
						return { ok: true as const, value: result };
					}, persistence);
					return fetched.ok
						? fetched
						: notice(fetched, finishOperationId ? 'finish' : undefined);
				}
			)
		);
	}

	async function loadCompletedResult(
		modelNum: number,
		expected?: TrainingRunIdentity
	): Promise<ResultEnvelope | null> {
		const outcome = await recoverCompletedResult(modelNum, expected);
		return outcome.ok ? outcome.value : null;
	}

	async function destructive(
		datasetId: string,
		capturedTarget: string | null,
		newTarget: string | null
	): Promise<TrainingCommandResult> {
		if (exclusiveIntents.has(datasetId)) return { ok: false, code: 'busy' };
		exclusiveIntents.add(datasetId);
		try {
			await cancelDataset(datasetId);
			return await withResource(INGESTION_LOCK, 'exclusive', true, async () => {
				const { ack, committed } = await checkpoint('discard', ({ state }) => {
					if (
						!state ||
						state.dataset?.id !== datasetId ||
						state.target !== capturedTarget
					)
						return conflict;
					const next =
						newTarget === null
							? reduceDatasetReplacement(state, null)
							: reduceTargetChange(state, newTarget, true);
					return next
						? {
								state: next,
								mutation: {
									type: newTarget === null ? 'delete-dataset' : 'delete-results',
									datasetId
								}
							}
						: conflict;
				});
				if (!ack.ok) return notice(ack, committed ? 'discard' : undefined);
				clearScroll(
					Object.keys($scrollState.get().snapshots).filter(
						(key) => !key.startsWith('data:')
					)
				);
				return { ok: true, value: undefined };
			});
		} finally {
			exclusiveIntents.delete(datasetId);
		}
	}

	return {
		start,
		loadCompletedResult,
		activeIdentity(modelNum: number): TrainingRunIdentity | undefined {
			return active.get(modelNum)?.request.identity;
		},
		async cancel(modelNum: number): Promise<void> {
			const attempt = active.get(modelNum);
			if (!attempt) return;
			cancel(attempt);
			await attempt.done;
		},
		retry,
		observePublishedStops,
		recoverStoppedPublication,
		async createModel(): Promise<TrainingCommandResult<number>> {
			const captured = $appState.get();
			let num = 0;
			const { ack, committed } = await checkpoint('recover', ({ state }) => {
				if (
					!state ||
					state.dataset?.id !== captured.dataset?.id ||
					state.target !== captured.target
				)
					return conflict;
				const next = reduceCreateModel(state, now());
				if (!next) return conflict;
				num = state.nextModelNum;
				return { state: next, mutation: { type: 'none' } };
			});
			return ack.ok
				? { ok: true, value: num }
				: notice(ack, committed ? 'recover' : undefined);
		},
		async chooseTarget(column: string): Promise<TrainingCommandResult> {
			const captured = $appState.get();
			if (captured.target === column) return { ok: true, value: undefined };
			return withResource(INGESTION_LOCK, 'exclusive', true, async () => {
				const { ack, committed } = await checkpoint('discard', ({ state }) => {
					if (
						!state ||
						state.dataset?.id !== captured.dataset?.id ||
						state.target !== captured.target
					)
						return conflict;
					const next = reduceTargetChange(state, column, false);
					return next ? { state: next, mutation: { type: 'none' } } : conflict;
				});
				return ack.ok
					? { ok: true, value: undefined }
					: notice(ack, committed ? 'discard' : undefined);
			});
		},
		discardTarget(datasetId: string, capturedTarget: string | null, target: string) {
			return destructive(datasetId, capturedTarget, target);
		},
		discardDataset(datasetId: string, capturedTarget: string | null) {
			return destructive(datasetId, capturedTarget, null);
		},
		async publishDataset(
			dataset: DatasetSummary,
			previousDataset: string | null,
			cleanup: () => Promise<void>
		): Promise<TrainingCommandResult> {
			return withResource(INGESTION_LOCK, 'exclusive', false, async () => {
				const result = await checkpoint('replace', ({ state, generation }) => {
					const previous = state ?? (generation === 0 ? INITIAL_APP_STATE : null);
					if (!previous) return conflict;
					if ((previous.dataset?.id ?? null) !== previousDataset) return conflict;
					return {
						state: reduceDatasetReplacement(previous, dataset),
						mutation: { type: 'publish-replacement', datasetId: dataset.id }
					};
				});
				if (!result.ack.ok) {
					if (result.committed) pendingDatasetCleanup = { id: dataset.id, cleanup };
					if (!result.committed && result.ack.reason === 'conflict') {
						await withTrainingStateLock(async (context) => {
							const latest = await readGuardedTrainingSnapshot(context);
							if (latest.ok && latest.state?.dataset?.id !== dataset.id) {
								await deleteDataset(context.db, dataset.id);
							}
						}, persistence);
					}
					return notice(result.ack, result.committed ? 'replace' : undefined);
				}
				if (previousDataset !== dataset.id)
					clearScroll(
						Object.keys($scrollState.get().snapshots).filter(
							(key) => !key.startsWith('data:')
						)
					);
				try {
					await cleanup();
				} catch {
					/* Startup cleanup can retry orphaned dataset records. */
				}
				return { ok: true, value: undefined };
			});
		},
		async viewResults(identity: TrainingRunIdentity): Promise<TrainingCommandResult> {
			return withResource(INGESTION_LOCK, 'shared', true, () =>
				withResource(
					`samata-ml:training:${identity.modelNum}`,
					'shared',
					true,
					async () => {
						const { ack, committed } = await checkpoint(
							'recover',
							async ({ state }, { db }) => {
								const model = state && modelIn(state, identity);
								if (
									!state ||
									model?.resultRevision !== identity.runId ||
									model.status !== 'trained' ||
									!(await readModelResult(
										db,
										identity.datasetId,
										identity.modelNum,
										identity
									))
								)
									return conflict;
								const next = reduceViewResults(state, identity.modelNum);
								return next
									? { state: next, mutation: { type: 'none' } }
									: conflict;
							}
						);
						return ack.ok
							? { ok: true, value: undefined }
							: notice(ack, committed ? 'recover' : undefined);
					}
				)
			);
		}
	};
}

/** Service type used by connected views and isolated stories. */
export type TrainingService = ReturnType<typeof createTrainingService>;

const defaultService = createTrainingService();
let serviceOverride: TrainingService | undefined;

/** Returns the app service without importing an actual worker into a connected component. */
export function getTrainingService(): TrainingService {
	return serviceOverride ?? defaultService;
}

/** Provides an isolated service seam for connected story fixtures. */
export function setTrainingServiceForTesting(service?: TrainingService): void {
	serviceOverride = service;
}
