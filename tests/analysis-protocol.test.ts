import { expect, test } from 'bun:test';
import {
	onWorkerFailure,
	resetWorkerFailuresForTests,
	type WorkerFailureCode
} from '../src/common/release/worker-failures';
import { AnalysisClient } from '../src/features/results/analysis-client';
import { isRopeReply, isRopeRequest } from '../src/features/results/analysis-protocol';
import { $appState, reduceCreateModel, setComparisonUi } from '../src/stores/app.store';
import {
	$comparison,
	$ropeAnalysis,
	clearRopeAnalysis,
	requestComparisonAnalysis
} from '../src/stores/comparison.store';
import { comparisonOwner } from '../src/stores/comparison-preferences';
import { $modelResults, currentResultIdentity } from '../src/stores/model-results.store';
import { INITIAL_APP_STATE } from '../src/types/state';
import { breastCancerOneShot, irisCrossValidation } from './fixtures/results/evaluations';

const request = {
	id: 1,
	type: 'rope',
	scoresA: [0.8, 0.9],
	scoresB: [0.7, 0.8],
	rope: 0.01,
	testFraction: 0.5
};

test('WML-P5-ROPE-1: protocol rejects invalid inputs and malformed probabilities', () => {
	expect(isRopeRequest(request)).toBe(true);
	for (const invalid of [
		{ ...request, id: 0 },
		{ ...request, scoresA: [1] },
		{ ...request, scoresB: [1, NaN] },
		{ ...request, rope: 0 },
		{ ...request, testFraction: 1 },
		{ ...request, type: 'other' }
	])
		expect(isRopeRequest(invalid)).toBe(false);
	expect(
		isRopeReply({
			id: 1,
			type: 'rope-result',
			result: { probabilityLower: 0.2, probabilityEquivalent: 0.3, probabilityHigher: 0.5 }
		})
	).toBe(true);
	expect(
		isRopeReply({
			id: 1,
			type: 'rope-result',
			result: { probabilityLower: 0.2, probabilityEquivalent: 0.3, probabilityHigher: 0.6 }
		})
	).toBe(false);
});

test('WML-P5-ROPE-2: aborted and malformed replies settle once and failure creates a new worker', async () => {
	class FakeWorker {
		onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
		onerror: (() => void) | null = null;
		onmessageerror: (() => void) | null = null;
		sent: unknown[] = [];
		postMessage(message: unknown) {
			this.sent.push(message);
		}
		terminate() {}
	}
	const workers: FakeWorker[] = [];
	const client = new AnalysisClient(() => {
		const worker = new FakeWorker();
		workers.push(worker);
		return worker as unknown as Worker;
	});
	const { id: _id, type: _type, ...input } = request;
	const controller = new AbortController();
	const aborted = client.requestRope(input, controller.signal);
	controller.abort();
	await expect(aborted).rejects.toBeDefined();
	const invalid = client.requestRope(input, new AbortController().signal);
	workers[0]!.onmessage?.({ data: { id: 2, type: 'rope-result', result: {} } } as MessageEvent);
	await expect(invalid).rejects.toThrow('Invalid analysis reply');
	const failed = client.requestRope(input, new AbortController().signal);
	workers[0]!.onerror?.();
	await expect(failed).rejects.toThrow('Analysis worker failed');
	const next = client.requestRope(input, new AbortController().signal);
	expect(workers).toHaveLength(2);
	workers[1]!.onmessage?.({
		data: {
			id: 4,
			type: 'rope-result',
			result: { probabilityLower: 0.2, probabilityEquivalent: 0.3, probabilityHigher: 0.5 }
		}
	} as MessageEvent);
	expect(await next).toEqual({
		probabilityLower: 0.2,
		probabilityEquivalent: 0.3,
		probabilityHigher: 0.5
	});
	client.dispose();
});

test('WML-P5-ROPE-2: width debounce and invalidation suppress late worker replies', async () => {
	class FakeWorker {
		static instances: FakeWorker[] = [];
		onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
		onerror: (() => void) | null = null;
		onmessageerror: (() => void) | null = null;
		sent: unknown[] = [];
		constructor() {
			FakeWorker.instances.push(this);
		}
		postMessage(message: unknown) {
			this.sent.push(message);
		}
		terminate() {}
	}
	const previous = globalThis.Worker;
	Object.defineProperty(globalThis, 'Worker', { configurable: true, value: FakeWorker });
	try {
		let state = {
			...INITIAL_APP_STATE,
			dataset: {
				id: 'iris',
				name: 'Iris',
				source: 'sample' as const,
				rowCount: 150,
				columns: []
			},
			target: 'species'
		};
		state = reduceCreateModel(state, 1)! as typeof state;
		state = reduceCreateModel(state, 2)! as typeof state;
		state = {
			...state,
			models: state.models.map((model) => ({
				...model,
				status: 'trained' as const,
				modelId: 'gaussian-nb',
				features: ['x'],
				completedSteps: ['choose-model', 'select-features', 'configure-model'],
				trainingSetup: { type: 'nested_cv', outerFolds: 5, innerFolds: 5, randomState: 42 },
				resultRevision: `run-${model.num}`
			}))
		} as typeof state;
		$appState.set(state);
		for (const num of [1, 2]) {
			const identity = currentResultIdentity(num)!;
			$modelResults.setKey(num, {
				identity,
				status: 'ready',
				evaluation: irisCrossValidation(),
				error: ''
			});
		}
		expect($comparison.get().selected).toEqual([1, 2]);
		requestComparisonAnalysis();
		const owner = comparisonOwner($appState.get())!;
		for (const width of [0.011, 0.012, 0.013, 0.014, 0.015])
			setComparisonUi(owner, { ropeWidth: width });
		await new Promise((resolve) => setTimeout(resolve, 300));
		expect(FakeWorker.instances).toHaveLength(1);
		expect(FakeWorker.instances[0]!.sent).toHaveLength(1);
		expect(FakeWorker.instances[0]!.sent[0]).toMatchObject({ rope: 0.015, testFraction: 0.2 });
		const firstRequest = FakeWorker.instances[0]!.sent[0];
		if (!isRopeRequest(firstRequest)) throw new Error('Expected a ROPE request');
		const requestId = firstRequest.id;
		setComparisonUi(owner, {
			fingerprint: 'a'.repeat(64),
			selected: [1, 2],
			pairA: 2,
			pairB: 1
		});
		FakeWorker.instances[0]!.onmessage?.({
			data: {
				id: requestId,
				type: 'rope-result',
				result: {
					probabilityLower: 0.2,
					probabilityEquivalent: 0.3,
					probabilityHigher: 0.5
				}
			}
		} as MessageEvent);
		await Promise.resolve();
		expect($ropeAnalysis.get().status).toBe('loading');
		await new Promise((resolve) => setTimeout(resolve, 300));
		expect(FakeWorker.instances[0]!.sent).toHaveLength(2);
		const secondRequest = FakeWorker.instances[0]!.sent[1];
		if (!isRopeRequest(secondRequest)) throw new Error('Expected a ROPE request');
		const secondId = secondRequest.id;
		$appState.set({
			...$appState.get(),
			models: $appState
				.get()
				.models.map((model) =>
					model.num === 1 ? { ...model, resultRevision: 'new-run' } : model
				)
		});
		FakeWorker.instances[0]!.onmessage?.({
			data: {
				id: secondId,
				type: 'rope-result',
				result: {
					probabilityLower: 0.2,
					probabilityEquivalent: 0.3,
					probabilityHigher: 0.5
				}
			}
		} as MessageEvent);
		await Promise.resolve();
		expect($ropeAnalysis.get().status).toBe('unavailable');
		$appState.set(state);
		for (const num of [1, 2]) {
			const identity = currentResultIdentity(num)!;
			$modelResults.setKey(num, {
				identity,
				status: 'ready',
				evaluation: breastCancerOneShot(),
				error: ''
			});
		}
		requestComparisonAnalysis();
		await new Promise((resolve) => setTimeout(resolve, 300));
		expect(FakeWorker.instances[0]!.sent).toHaveLength(2);
		$appState.set({ ...$appState.get(), dataset: null, target: null });
		expect($ropeAnalysis.get().status).toBe('unavailable');
		clearRopeAnalysis();
		expect($ropeAnalysis.get().status).toBe('idle');
	} finally {
		clearRopeAnalysis();
		$modelResults.set({});
		$appState.set(INITIAL_APP_STATE);
		Object.defineProperty(globalThis, 'Worker', { configurable: true, value: previous });
	}
});

test('REL-STALE-1: reports analysis-worker-failed on worker errors but never on dispose', async () => {
	class FakeWorker {
		onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
		onerror: (() => void) | null = null;
		onmessageerror: (() => void) | null = null;
		postMessage() {}
		terminate() {}
	}
	const reported: WorkerFailureCode[] = [];
	const unsubscribe = onWorkerFailure((code) => reported.push(code));
	try {
		const workers: FakeWorker[] = [];
		const client = new AnalysisClient(() => {
			const worker = new FakeWorker();
			workers.push(worker);
			return worker as unknown as Worker;
		});
		const { id: _id, type: _type, ...input } = request;

		const first = client.requestRope(input, new AbortController().signal);
		workers[0]!.onerror?.();
		await expect(first).rejects.toThrow('Analysis worker failed');

		const second = client.requestRope(input, new AbortController().signal);
		workers[1]!.onmessageerror?.();
		await expect(second).rejects.toThrow('Analysis worker failed');

		const third = client.requestRope(input, new AbortController().signal);
		client.dispose();
		await expect(third).rejects.toThrow('Analysis worker failed');

		expect(reported).toEqual(['analysis-worker-failed', 'analysis-worker-failed']);
	} finally {
		unsubscribe();
		resetWorkerFailuresForTests();
	}
});
