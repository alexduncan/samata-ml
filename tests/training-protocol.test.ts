import { expect, test } from 'bun:test';
import { DEFAULT_ONE_SHOT_SETUP } from '../src/types/state';
import { fixtureLegacyTrainingResult, fixtureTrainingResult } from './fixtures/training/results';
import {
	createTrainingReplyGuard,
	decodeTrainingWorkerReply,
	decodeTrainingWorkerRequest,
	safeTrainingFailureCode,
	type TrainingStartRequest,
	type TrainingWorkerReply
} from '../src/features/models/training/protocol';
import {
	installTrainingWorker,
	type TrainingWorkerScope
} from '../src/features/models/training/training-worker';

const start: TrainingStartRequest = {
	kind: 'start',
	identity: {
		datasetId: 'dataset',
		target: 'label',
		modelNum: 1,
		modelCreatedAt: 100,
		configurationKey: 'model-configuration',
		runId: 'attempt'
	},
	classifier: { algorithm: 'gaussian-nb', options: {} },
	features: ['feature'],
	setup: DEFAULT_ONE_SHOT_SETUP
};

test('WML-P3-EVENT-1: start and cancel messages validate their payloads', () => {
	expect(decodeTrainingWorkerRequest(start)).toEqual(start);
	expect(decodeTrainingWorkerRequest({ kind: 'cancel', runId: 'attempt' })).toEqual({
		kind: 'cancel',
		runId: 'attempt'
	});
	for (const rejected of [
		{ ...start, features: ['label'] },
		{ ...start, features: ['feature', 'feature'] },
		{ ...start, classifier: { algorithm: 'unknown', options: {} } },
		{ ...start, setup: { ...start.setup, randomState: 8 } },
		{ ...start, identity: { ...start.identity, modelNum: 0 } },
		{ kind: 'cancel', runId: 10 }
	])
		expect(decodeTrainingWorkerRequest(rejected)).toBeNull();
});

test('WML-P3-EVENT-1: replies with invalid or stale identities cannot settle and the first terminal wins', () => {
	const guard = createTrainingReplyGuard(start.identity);
	const progress = {
		kind: 'progress',
		identity: start.identity,
		progress: { percent: 20, stage: 'fitting', phase: 'training', statusMessage: 'training' }
	};
	const terminal = { kind: 'cancelled', identity: start.identity } as const;
	expect(
		guard.accept({ ...terminal, identity: { ...start.identity, modelCreatedAt: 3 } })
	).toBeNull();
	expect(
		guard.accept({ ...terminal, identity: { ...start.identity, runId: 'previous' } })
	).toBeNull();
	expect(
		guard.accept({ ...progress, progress: { ...progress.progress, percent: 100 } })
	).toBeNull();
	expect(guard.accept({ kind: 'success', identity: start.identity, result: {} })).toBeNull();
	expect(guard.accept(progress)).toMatchObject(progress);
	expect(guard.accept(terminal)).toEqual(terminal);
	expect(guard.accept(progress)).toBeNull();
	expect(guard.accept(terminal)).toBeNull();
	expect(
		decodeTrainingWorkerReply({ kind: 'failed', identity: start.identity, code: 'raw failure' })
	).toBeNull();
	expect(safeTrainingFailureCode('raw failure')).toBe('training-failed');
});

test.each(['one_shot', 'cross_validation'] as const)(
	'WML-P4-EVAL-4: a new %s success needs a matching stored evaluation',
	(strategy) => {
		const {
			datasetId: _d,
			target: _t,
			modelNum: _m,
			modelCreatedAt: _c,
			configurationKey: _k,
			runId: _r,
			schemaVersion: _s,
			algorithm: _a,
			durationMs: _du,
			logEntries: _l,
			...result
		} = fixtureTrainingResult(strategy);
		const reply = { kind: 'success', identity: start.identity, result };
		expect(decodeTrainingWorkerReply(reply)).toMatchObject({ kind: 'success' });
		const { evaluation: _evaluation, ...withoutEvaluation } = result;
		expect(decodeTrainingWorkerReply({ ...reply, result: withoutEvaluation })).toBeNull();
		const legacy = fixtureLegacyTrainingResult(strategy);
		expect(decodeTrainingWorkerReply({ ...reply, result: legacy })).toBeNull();
		expect(
			decodeTrainingWorkerReply({
				...reply,
				result: {
					...result,
					evaluation: { ...result.evaluation, protocol: { kind: 'one_shot' } }
				}
			})
		).toBeNull();
	}
);

test('WML-P3-EVENT-1: a non-isolated worker settles once before any runtime load', () => {
	const replies: TrainingWorkerReply[] = [];
	const scope: TrainingWorkerScope = {
		crossOriginIsolated: false,
		onmessage: null,
		postMessage: (reply) => replies.push(reply)
	};
	let loads = 0;
	installTrainingWorker(
		scope,
		async () => {
			loads++;
			return import('web-ml');
		},
		'revision'
	);
	scope.onmessage?.(new MessageEvent('message', { data: start }));
	scope.onmessage?.(new MessageEvent('message', { data: start }));
	expect(loads).toBe(0);
	expect(replies).toEqual([
		{ kind: 'failed', identity: start.identity, code: 'environment-not-supported' }
	]);
});
