import { openSamataDb } from '../../../common/storage/db';
import type { TrainingResultPayload } from '../../../types/model-result';
import {
	buildClassificationRequest,
	snapshotCrossValidationResult,
	snapshotHoldoutResult
} from './classifier-adapters';
import { FIXED_TRAINING_RANDOM_STATE } from '../../../types/state';
import { evaluationTransferables } from './evaluation-mapper';
import { prepareClassification } from './prepare-classification';
import { isTrainingResultPayload } from './result-validation';
import { createTrainingProgressMapper, type TrainingUpdate } from './progress';
import {
	decodeTrainingWorkerRequest,
	safeTrainingFailureCode,
	type TrainingStartRequest,
	type TrainingWorkerReply
} from './protocol';
import { ClassificationError } from './types';

type WebMlRuntime = typeof import('web-ml');

/** The portion of the dedicated worker global scope used by training. */
export interface TrainingWorkerScope {
	crossOriginIsolated: boolean;
	onmessage: ((event: MessageEvent<unknown>) => void) | null;
	postMessage(reply: TrainingWorkerReply, transfer?: Transferable[]): void;
}

async function consumeEvents<Event>(
	events: AsyncIterable<Event>,
	map: (event: Event) => TrainingUpdate | null,
	send: (update: TrainingUpdate) => void
): Promise<void> {
	for await (const event of events) {
		const update = map(event);
		if (update) send(update);
	}
}

async function execute(
	request: TrainingStartRequest,
	runtime: WebMlRuntime,
	webMlRevision: string,
	signal: AbortSignal,
	send: (update: TrainingUpdate) => void
): Promise<TrainingResultPayload> {
	const db = await openSamataDb();
	const prepared = await prepareClassification(
		db,
		runtime,
		{
			datasetId: request.identity.datasetId,
			target: request.identity.target,
			features: request.features
		},
		signal
	).finally(() => db.close());
	signal.throwIfAborted();
	const execution = buildClassificationRequest(request.classifier, prepared, request.setup);
	const captured = {
		webMlRevision,
		excludedTargetRows: prepared.excludedTargetRows,
		sourceRowIndices: prepared.sourceRowIndices
	};
	const mapper = createTrainingProgressMapper(
		execution.strategy === 'cross_validation' ? execution.request.folds : null
	);
	const context = {
		datasetId: request.identity.datasetId,
		sourceRowIndices: prepared.sourceRowIndices
	};

	if (execution.strategy === 'one_shot') {
		const run = runtime.holdoutValidate(execution.request, { signal });
		const protocol = {
			kind: 'one_shot',
			testRatio: execution.request.testRatio,
			randomState: execution.request.randomState ?? FIXED_TRAINING_RANDOM_STATE
		} as const;
		const [snapshot] = await settleAll([
			run.result.then((result) =>
				snapshotHoldoutResult(runtime, result, { ...context, protocol })
			),
			run.trainingMetrics,
			consumeEvents(
				run.events,
				(event) => (event.type === 'fold-progress' ? mapper.training(event.event) : null),
				send
			)
		]);
		return { ...snapshot, ...captured, strategy: execution.strategy };
	}
	const run = runtime.crossValidate(execution.request, { signal });
	const protocol = {
		kind: 'cross_validation',
		folds: execution.request.folds,
		randomState: execution.request.randomState ?? FIXED_TRAINING_RANDOM_STATE
	} as const;
	const [snapshot] = await settleAll([
		run.result.then((result) =>
			snapshotCrossValidationResult(runtime, result, { ...context, protocol })
		),
		run.trainingMetrics,
		consumeEvents(run.events, mapper.crossValidation, send)
	]);
	return { ...snapshot, ...captured, strategy: execution.strategy };
}

/**
 * Waits for every promise, including the library's own terminal handling after a failure or
 * cancellation, then rethrows the first rejection.
 */
async function settleAll<T extends readonly unknown[]>(promises: {
	[K in keyof T]: Promise<T[K]>;
}): Promise<T> {
	const outcomes = await Promise.allSettled(promises);
	for (const outcome of outcomes) if (outcome.status === 'rejected') throw outcome.reason;
	return outcomes.map(
		(outcome) => (outcome as PromiseFulfilledResult<unknown>).value
	) as unknown as T;
}

/** Installs the request handler for a worker that owns exactly one training attempt. */
export function installTrainingWorker(
	scope: TrainingWorkerScope,
	loadRuntime: () => Promise<WebMlRuntime>,
	webMlRevision: string
): void {
	let active: { identity: TrainingStartRequest['identity']; controller: AbortController } | null =
		null;
	let settled = false;
	scope.onmessage = ({ data }) => {
		const request = decodeTrainingWorkerRequest(data);
		if (!request || settled) return;
		if (request.kind === 'cancel') {
			if (active?.identity.runId === request.runId) active.controller.abort();
			return;
		}
		if (active) return;

		const controller = new AbortController();
		const { identity } = request;
		active = { identity, controller };
		function send(reply: TrainingWorkerReply, transfer?: Transferable[]): void {
			if (settled || (reply.kind === 'progress' && controller.signal.aborted)) return;
			if (reply.kind !== 'progress') settled = true;
			scope.postMessage(reply, transfer);
		}

		if (!scope.crossOriginIsolated) {
			send({ kind: 'failed', identity, code: 'environment-not-supported' });
			return;
		}
		send({
			kind: 'progress',
			identity,
			progress: {
				percent: null,
				stage: 'preparing',
				phase: null,
				statusMessage: 'preparing'
			},
			note: { key: 'preparing' }
		});
		void loadRuntime()
			.then((runtime) => {
				controller.signal.throwIfAborted();
				return execute(request, runtime, webMlRevision, controller.signal, (update) => {
					send({ kind: 'progress', identity, ...update });
				});
			})
			.then((result) => {
				controller.signal.throwIfAborted();
				if (!isTrainingResultPayload(result))
					throw new ClassificationError('contract-error');
				send(
					{ kind: 'success', identity, result },
					evaluationTransferables(result.evaluation)
				);
			})
			.catch((error: unknown) => {
				if (controller.signal.aborted) {
					send({ kind: 'cancelled', identity });
					return;
				}
				const category =
					error instanceof ClassificationError
						? error.code
						: error instanceof DOMException
							? 'storage-unavailable'
							: error instanceof Error && 'code' in error
								? error.code
								: 'training-failed';
				send({ kind: 'failed', identity, code: safeTrainingFailureCode(category) });
			});
	};
}
