import { afterEach, beforeEach, expect, test } from 'bun:test';
import { INGESTION_LOCK, deleteDatasetsExcept, openSamataDb } from '../src/common/storage/db';
import { readTrainingCheckpoint } from '../src/common/storage/training-domain';
import type { ClassifierId } from '../src/features/models/model-catalogue';
import {
	$publicationPending,
	createTrainingService
} from '../src/features/models/training/training-service';
import type {
	TrainingWorkerReply,
	TrainingWorkerRequest
} from '../src/features/models/training/protocol';
import { $appState, reduceCreateModel, setHyperparameters } from '../src/stores/app.store';
import {
	MemoryStorage,
	initPersister,
	stopPersister,
	TRAINING_STATE_LOCK
} from '../src/stores/persister';
import { reconcileProtectedStartup } from '../src/stores/reconciler';
import {
	$trainingSession,
	getTrainingSession,
	type TrainingSession
} from '../src/stores/training.store';
import type { DatasetMetadata } from '../src/types/dataset';
import { toDatasetSummary } from '../src/types/dataset';
import {
	DEFAULT_ONE_SHOT_SETUP,
	INITIAL_APP_STATE,
	STATE_STORAGE_KEY,
	type PersistedAppState
} from '../src/types/state';
import { fixtureTrainingResult } from './fixtures/training/results';
import { installFakeIndexedDB } from './helpers/fake-indexeddb';
import { createTrainingTestLocks } from './helpers/training-locks';

const metadata: DatasetMetadata = {
	id: 'training-dataset',
	name: 'Training dataset',
	source: 'upload',
	sampleId: null,
	rowCount: 6,
	byteLength: 30,
	createdAt: 1,
	delimiter: ',',
	paddedRowCount: 0,
	skippedRows: { count: 0, rowNumbers: [] },
	columns: [
		{
			name: 'measurement',
			type: 'numeric',
			missingCount: 0,
			missingTokens: {},
			invalidCount: 0,
			invalidExamples: [],
			count: 6,
			min: 1,
			max: 6,
			mean: 3.5,
			median: 3.5,
			integer: true,
			identifierHint: false,
			format: { prefix: '', suffix: '', thousandsSeparator: false },
			histogram: { start: 1, width: 3, counts: [3, 3] }
		},
		{
			name: 'species',
			type: 'categorical',
			missingCount: 0,
			missingTokens: {},
			invalidCount: 0,
			invalidExamples: [],
			distinctCount: 2,
			categoryCounts: { first: 3, second: 3 }
		}
	]
};

class TestStorage extends MemoryStorage {
	reject: (state: PersistedAppState) => boolean = () => false;
	denyRead = false;

	override getItem(key: string): string | null {
		if (key === STATE_STORAGE_KEY && this.denyRead) {
			throw new DOMException('Test storage failure', 'SecurityError');
		}
		return super.getItem(key);
	}

	override setItem(key: string, value: string): void {
		if (key === STATE_STORAGE_KEY && this.reject(JSON.parse(value))) {
			throw new DOMException('Test storage failure', 'SecurityError');
		}
		super.setItem(key, value);
	}
}

class ScriptedWorker {
	onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
	onmessageerror: Worker['onmessageerror'] = null;
	onerror: Worker['onerror'] = null;
	posted: TrainingWorkerRequest[] = [];
	terminations = 0;

	postMessage(request: TrainingWorkerRequest): void {
		this.posted.push(request);
		if (request.kind === 'cancel') this.reply({ kind: 'cancelled', identity: this.identity });
	}

	get identity() {
		const request = this.posted[0];
		if (request?.kind !== 'start') throw new Error('Expected worker start');
		return request.identity;
	}

	reply(reply: TrainingWorkerReply): void {
		this.onmessage?.(new MessageEvent('message', { data: reply }));
	}

	succeed(result = fixtureTrainingResult()): void {
		this.reply({ kind: 'success', identity: this.identity, result });
	}

	terminate(): void {
		this.terminations++;
	}
}

let db: Awaited<ReturnType<typeof openSamataDb>>;
let restore: () => void;
let storage: TestStorage;
let workers: ScriptedWorker[];
let service: ReturnType<typeof createTrainingService>;
let locks: LockManager;

beforeEach(async () => {
	restore = installFakeIndexedDB();
	db = await openSamataDb();
	await db.put('metadata', metadata);
	storage = new TestStorage();
	locks = createTrainingTestLocks();
	workers = [];
	$trainingSession.set(new Map());
	$publicationPending.set(null);
	service = createTrainingService({
		locks,
		persistence: { storage },
		isIsolated: () => true,
		createWorker: () => {
			const worker = new ScriptedWorker();
			workers.push(worker);
			return worker;
		}
	});
});

afterEach(() => {
	db.close();
	restore();
	$appState.set(INITIAL_APP_STATE);
});

function seed(count = 1, modelId: ClassifierId = 'gaussian-nb'): PersistedAppState {
	let state: PersistedAppState = {
		...INITIAL_APP_STATE,
		dataset: toDatasetSummary(metadata),
		target: 'species',
		data: { mode: 'preview', selectedColumn: null }
	};
	for (let index = 0; index < count; index++) {
		const next = reduceCreateModel(state, 10 + index);
		if (!next) throw new Error('Missing fixture domain');
		state = next;
	}
	state = {
		...state,
		models: state.models.map((model) => ({
			...model,
			modelId,
			features: ['measurement'],
			trainingSetup: DEFAULT_ONE_SHOT_SETUP,
			completedSteps: ['choose-model', 'select-features', 'configure-model']
		}))
	};
	$appState.set(state);
	storage.setItem(
		STATE_STORAGE_KEY,
		JSON.stringify({
			...state,
			models: state.models.map((model) => ({
				...model,
				trainingSetup: { ...DEFAULT_ONE_SHOT_SETUP, type: 'train_test_split' }
			}))
		})
	);
	return state;
}

async function workerAt(index: number): Promise<ScriptedWorker> {
	for (let attempt = 0; attempt < 150; attempt++) {
		const worker = workers[index];
		if (worker?.posted.length) return worker;
		await new Promise<void>((resolve) => setTimeout(resolve, 2));
	}
	throw new Error('Training worker did not start');
}

test('WML-P3-TRAIN-1: rejects non-isolation and duplicate starts while preserving concurrent model outcomes', async () => {
	seed(2);
	const blocked = createTrainingService({ isIsolated: () => false, persistence: { storage } });
	expect(await blocked.start(1)).toEqual({ ok: false, code: 'environment-not-supported' });
	expect(await readTrainingCheckpoint(db)).toEqual({ ok: true, checkpoint: null });
	const first = service.start(1);
	expect(await service.start(1)).toEqual({ ok: false, code: 'busy' });
	const one = await workerAt(0);
	expect($appState.get().models[0]?.status).toBe('training');
	const second = service.start(2);
	const two = await workerAt(1);
	two.succeed();
	expect(await second).toMatchObject({ ok: true });
	one.succeed();
	expect(await first).toMatchObject({ ok: true });
	expect($appState.get().models.map((model) => model.status)).toEqual(['trained', 'trained']);
	expect(getTrainingSession(one.identity)?.progress.percent).toBe(100);
	expect((await db.getAll('model_results')).filter((entry) => entry.modelNum > 0)).toHaveLength(
		2
	);
});

test('WML-P3-TRAIN-2: releases cancelled attempt locks before discarding its captured dataset', async () => {
	seed();
	const attempt = service.start(1);
	const worker = await workerAt(0);
	const discard = service.discardDataset(metadata.id, 'species');
	expect(await attempt).toMatchObject({ ok: false, code: 'cancelled' });
	expect(await discard).toMatchObject({ ok: true });
	expect(worker.posted.at(-1)).toEqual({ kind: 'cancel', runId: worker.identity.runId });
	expect(worker.terminations).toBe(1);
	expect((await locks.query()).held).toEqual([]);
	expect(await db.get('metadata', metadata.id)).toBeUndefined();
	expect(await db.get('model_results', [metadata.id, 1])).toBeUndefined();
});

test('WML-P3-TRAIN-2: a save racing confirmation is included in the destructive commit', async () => {
	seed();
	const attempt = service.start(1);
	const worker = await workerAt(0);
	worker.succeed();
	await Promise.resolve();
	const discard = service.discardDataset(metadata.id, 'species');
	expect(await attempt).toMatchObject({ ok: true });
	expect(await discard).toMatchObject({ ok: true });
	expect(await db.get('model_results', [metadata.id, 1])).toBeUndefined();
	expect($appState.get().dataset).toBeNull();
});

test('WML-P3-TRAIN-3: lost results demote only the matching trained model during reload', async () => {
	seed(2);
	const run = service.start(1);
	const worker = await workerAt(0);
	worker.succeed();
	expect(await run).toMatchObject({ ok: true });
	const second = $appState.get().models[1];
	await db.delete('model_results', [metadata.id, 1]);
	expect(await reconcileProtectedStartup({ storage }, locks)).toMatchObject({ ok: true });
	expect($appState.get().models[0]).toMatchObject({
		status: 'draft',
		resultRevision: null,
		durationMs: null
	});
	expect($appState.get().models[1]).toEqual(second);
});

test.each(['target', 'dataset'] as const)(
	'WML-P3-TRAIN-3: restored sessions hold only identity and display data before discarding the %s',
	async (discard) => {
		seed(1, 'k-neighbors-classifier');
		const run = service.start(1);
		const worker = await workerAt(0);
		const fitted = { type: 'KNeighborsClassifier', trainingRows: [[1], [2], [3], [4]] };
		worker.succeed({ ...fixtureTrainingResult(), modelJson: fitted });
		expect(await run).toMatchObject({ ok: true });
		const saved = await service.loadCompletedResult(1);
		if (!saved) throw new Error('Expected a saved result');
		expect(saved.modelJson).toEqual(fitted);
		expect(saved.logEntries.at(-1)?.message).toEqual({ key: 'completed' });
		const expectedSession: TrainingSession = {
			identity: worker.identity,
			status: 'complete',
			progress: { percent: 100, stage: 'saving', phase: null, statusMessage: 'completed' },
			logEntries: saved.logEntries,
			warnings: []
		};

		$trainingSession.set(new Map());
		expect(await reconcileProtectedStartup({ storage }, locks)).toMatchObject({ ok: true });
		expect(getTrainingSession(worker.identity)).toEqual(expectedSession);

		$trainingSession.set(new Map());
		expect(await service.loadCompletedResult(1)).toEqual(saved);
		expect(getTrainingSession(worker.identity)).toEqual(expectedSession);

		const discarded =
			discard === 'target'
				? await service.discardTarget(metadata.id, 'species', 'measurement')
				: await service.discardDataset(metadata.id, 'species');
		expect(discarded).toMatchObject({ ok: true });
		expect(await db.get('model_results', [metadata.id, 1])).toBeUndefined();
		expect(await service.loadCompletedResult(1)).toBeNull();
	}
);

test('WML-P3-TRAIN-4: remote training holds back confirmation without deleting anything', async () => {
	const prior = seed();
	let entered!: () => void;
	let release!: () => void;
	const locked = new Promise<void>((resolve) => {
		entered = resolve;
	});
	const held = locks.request(
		INGESTION_LOCK,
		{ mode: 'shared' },
		() =>
			new Promise<void>((resolve) => {
				release = resolve;
				entered();
			})
	);
	await locked;
	try {
		expect(await service.discardTarget(metadata.id, 'species', 'measurement')).toEqual({
			ok: false,
			code: 'remote-training'
		});
		expect(await service.discardDataset(metadata.id, 'species')).toEqual({
			ok: false,
			code: 'remote-training'
		});
		expect($appState.get()).toEqual(prior);
		expect(await db.get('metadata', metadata.id)).toBeDefined();
	} finally {
		release();
		await held;
	}
});

test('WML-P3-TRAIN-5: failed start publication launches no worker and is repaired before retry', async () => {
	seed();
	storage.reject = (state) => state.models[0]?.status === 'training';
	expect(await service.start(1)).toMatchObject({
		ok: false,
		pending: 'start',
		reason: 'security'
	});
	expect(workers).toHaveLength(0);
	expect($appState.get().models[0]?.status).toBe('draft');
	expect(await readTrainingCheckpoint(db)).toMatchObject({
		checkpoint: { pending: { kind: 'start' } }
	});
	storage.reject = () => false;
	expect(await service.retry()).toMatchObject({ ok: true });
	expect($appState.get().models[0]).toMatchObject({ status: 'draft', resultRevision: null });
	expect(workers).toHaveLength(0);
});

test('WML-P3-TRAIN-6: persistent result pending recovers after reload without retraining', async () => {
	seed();
	const run = service.start(1);
	const worker = await workerAt(0);
	storage.reject = (state) => state.models[0]?.status === 'trained';
	worker.succeed();
	expect(await run).toMatchObject({ ok: false, reason: 'security', pending: 'finish' });
	expect($appState.get().models[0]?.status).toBe('training');
	expect(getTrainingSession(worker.identity)?.progress.percent).toBe(95);
	expect(await db.get('model_results', [metadata.id, 1])).toMatchObject({
		runId: worker.identity.runId
	});
	expect(await reconcileProtectedStartup({ storage }, locks)).toEqual({
		ok: false,
		reason: 'security'
	});
	storage.reject = () => false;
	expect(await reconcileProtectedStartup({ storage }, locks)).toMatchObject({ ok: true });
	expect($appState.get().models[0]).toMatchObject({
		status: 'trained',
		resultRevision: worker.identity.runId
	});
	expect(await readTrainingCheckpoint(db)).toMatchObject({ checkpoint: { pending: null } });
	expect(workers).toHaveLength(1);
});

test('WML-P3-TRAIN-5: separate stop repairs preserve the original reason for each run', async () => {
	seed(2);
	const first = service.start(1);
	const one = await workerAt(0);
	const second = service.start(2);
	const two = await workerAt(1);
	storage.denyRead = true;
	one.reply({ kind: 'cancelled', identity: one.identity });
	two.reply({ kind: 'failed', identity: two.identity, code: 'invalid-request' });
	for (const result of await Promise.all([first, second])) {
		expect(result).toMatchObject({ ok: false, pending: 'recover', reason: 'security' });
	}
	expect(await readTrainingCheckpoint(db)).toMatchObject({
		checkpoint: { generation: 2, pending: null }
	});

	storage.denyRead = false;
	expect(await service.retry(one.identity)).toMatchObject({ ok: true });
	expect($appState.get().models[0]).toMatchObject({
		status: 'draft',
		resultRevision: null,
		error: { code: 'TRAINING_CANCELLED', details: 'cancelled' }
	});
	expect($appState.get().models[1]?.status).toBe('training');
	expect(await service.retry(two.identity)).toMatchObject({ ok: true });
	expect($appState.get().models[1]).toMatchObject({
		status: 'draft',
		resultRevision: null,
		error: { code: 'TRAINING_FAILED', details: 'invalid-request' }
	});
	expect(getTrainingSession(one.identity)?.logEntries.at(-1)?.message).toEqual({
		key: 'cancelled'
	});
	expect(getTrainingSession(two.identity)?.logEntries.at(-1)?.message).toEqual({ key: 'failed' });
	expect(workers.map(({ terminations }) => terminations)).toEqual([1, 1]);
});

test('WML-P3-TRAIN-6: a committed stop repair is acknowledged without applying it twice', async () => {
	seed();
	const run = service.start(1);
	const worker = await workerAt(0);
	storage.denyRead = true;
	worker.reply({ kind: 'failed', identity: worker.identity, code: 'invalid-request' });
	expect(await run).toMatchObject({ ok: false, pending: 'recover', reason: 'security' });

	storage.denyRead = false;
	storage.reject = (state) => state.models[0]?.status === 'draft';
	expect(await service.retry(worker.identity)).toMatchObject({
		ok: false,
		pending: 'recover',
		reason: 'security'
	});
	expect(await readTrainingCheckpoint(db)).toMatchObject({
		checkpoint: { generation: 2, pending: { kind: 'recover' } }
	});
	expect($appState.get().models[0]?.status).toBe('training');

	storage.reject = () => false;
	expect(await service.retry(worker.identity)).toMatchObject({ ok: true });
	expect(await readTrainingCheckpoint(db)).toMatchObject({
		checkpoint: { generation: 2, pending: null }
	});
	expect($appState.get().models[0]).toMatchObject({
		status: 'draft',
		resultRevision: null,
		error: { details: 'invalid-request' }
	});
	expect(getTrainingSession(worker.identity)?.status).toBe('failed');
	expect(workers.map(({ terminations }) => terminations)).toEqual([1]);
});

test('WML-P3-TRAIN-7: allocates concurrent models while merging the latest counter and rejects a stale start', async () => {
	const prior = seed();
	const results = await Promise.all([service.createModel(), service.createModel()]);
	expect(results).toEqual([
		{ ok: true, value: 2 },
		{ ok: true, value: 3 }
	]);
	expect($appState.get().nextModelNum).toBe(4);
	expect($appState.get().trainingDomainGeneration).toBe(2);
	expect(await service.discardDataset(metadata.id, 'species')).toMatchObject({ ok: true });
	$appState.set(prior);
	expect(await service.start(1)).toMatchObject({ ok: false });
	expect(workers).toHaveLength(0);
	expect(await db.get('metadata', metadata.id)).toBeUndefined();
});

test('WML-P3-TRAIN-7: unrelated publication preserves an in-memory debounced draft edit', async () => {
	seed(2);
	initPersister(storage, {
		debounceFieldMs: 60_000,
		trainingPersistence: {
			withStateLock: (operation) => locks.request(TRAINING_STATE_LOCK, operation)
		}
	});
	try {
		const run = service.start(1);
		const worker = await workerAt(0);
		setHyperparameters(2, { mode: 'manual', values: { varSmoothing: 0.01 } });
		expect(
			JSON.parse(storage.getItem(STATE_STORAGE_KEY)!).models[1].hyperparameters.values
		).toEqual({});
		worker.succeed();
		expect(await run).toMatchObject({ ok: true });
		expect($appState.get().models[0]?.status).toBe('trained');
		expect($appState.get().models[1]?.hyperparameters.values).toEqual({ varSmoothing: 0.01 });
		expect(
			JSON.parse(storage.getItem(STATE_STORAGE_KEY)!).models[1].hyperparameters.values
		).toEqual({ varSmoothing: 0.01 });
	} finally {
		stopPersister();
		await locks.request(TRAINING_STATE_LOCK, () => {});
	}
});

test('WML-P3-TRAIN-4: a missing staged hand-off fails before commit and preserves active resources', async () => {
	const prior = seed();
	const staged = { ...metadata, id: 'staged-dataset' };
	await db.put('metadata', staged);
	// Simulate startup cleanup winning the worker-to-main lock hand-off.
	await locks.request(INGESTION_LOCK, () => deleteDatasetsExcept(db, metadata.id));
	expect(
		await service.publishDataset(toDatasetSummary(staged), metadata.id, async () => {
			throw new Error('Cleanup should not run after a rejected hand-off');
		})
	).toMatchObject({ ok: false, reason: 'conflict' });
	expect($appState.get()).toEqual(prior);
	expect(await db.get('metadata', metadata.id)).toEqual(metadata);
	expect(await readTrainingCheckpoint(db)).toEqual({ ok: true, checkpoint: null });
});
