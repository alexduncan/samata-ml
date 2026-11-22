import { openSamataDb } from '../../../common/storage/db';
import type { TrainingResultPayload } from '../../../types/model-result';
import {
	buildClassificationRequest,
	snapshotCrossValidationResult,
	snapshotHoldoutResult
} from './classifier-adapters';
import { prepareClassification } from './prepare-classification';
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
	postMessage(reply: TrainingWorkerReply): void;
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
	const execution = buildClassificationRequest(
		runtime,
		request.classifier,
		prepared,
		request.setup
	);
	const captured = {
		webMlRevision,
		excludedTargetRows: prepared.excludedTargetRows,
		sourceRowIndices: prepared.sourceRowIndices
	};
	const mapper = createTrainingProgressMapper(
		execution.strategy === 'cross_validation' ? execution.request.folds : null
	);

	if (execution.strategy === 'one_shot') {
		const run = runtime.createTrainingClient().train(execution.request, { signal });
		const [snapshot] = await Promise.all([
			run.result.then((fit) =>
				snapshotHoldoutResult(fit, {
					trainIndices: execution.trainIndices,
					testIndices: execution.testIndices
				})
			),
			run.trainingMetrics,
			consumeEvents(run.events, mapper.training, send)
		]);
		return { ...snapshot, ...captured, strategy: execution.strategy };
	}
	const run = runtime.crossValidate(execution.request, { signal });
	const [snapshot] = await Promise.all([
		run.result.then(snapshotCrossValidationResult),
		run.trainingMetrics,
		consumeEvents(run.events, mapper.crossValidation, send)
	]);
	return { ...snapshot, ...captured, strategy: execution.strategy };
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
		function send(reply: TrainingWorkerReply): void {
			if (settled || (reply.kind === 'progress' && controller.signal.aborted)) return;
			if (reply.kind !== 'progress') settled = true;
			scope.postMessage(reply);
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
				send({ kind: 'success', identity, result });
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
