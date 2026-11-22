import { afterEach, beforeEach, expect, test } from 'bun:test';
import { INGESTION_LOCK, deleteDatasetsExcept, openSamataDb } from '../src/common/storage/db';
import {
	clearPendingTrainingCheckpoint,
	commitTrainingCheckpoint,
	readTrainingCheckpoint
} from '../src/common/storage/training-domain';
import type { ClassifierId } from '../src/features/models/model-catalogue';
import {
	$publicationPending,
	createTrainingService,
	getTrainingConfigurationKey
} from '../src/features/models/training/training-service';
import type {
	TrainingWorkerReply,
	TrainingWorkerRequest
} from '../src/features/models/training/protocol';
import {
	$appState,
	dismissWelcome,
	reduceCreateModel,
	reduceTrainingStart,
	setHyperparameters,
	setResumePath,
	setTrainingLogOpen,
	setModelResultsUi,
	setComparisonUi
} from '../src/stores/app.store';
import {
	$storageSaveNotice,
	MemoryStorage,
	flushNow,
	initPersister,
	readAppSnapshot,
	readGuardedTrainingSnapshot,
	refreshTrainingSnapshot,
	stopPersister,
	TRAINING_STATE_LOCK,
	withTrainingStateLock
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
import { headlineMetrics } from '../src/common/evaluation/headline-metrics';
import { fixtureLegacyTrainingResult, fixtureTrainingResult } from './fixtures/training/results';
import { installFakeIndexedDB } from './helpers/fake-indexeddb';
import { createTrainingTestLocks } from './helpers/training-locks';
import { comparisonOwner } from '../src/stores/comparison-preferences';
import { $comparison, loadComparisonResults } from '../src/stores/comparison.store';
import { $modelResults } from '../src/stores/model-results.store';

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
	$storageSaveNotice.set(null);
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

test('WML-P5-STATE-2: a stale ordinary write cannot overwrite a reused context', async () => {
	const initial = seed(2);
	initPersister(storage, { trainingPersistence: guardedPersistence() });
	const owner = comparisonOwner(initial)!;
	setComparisonUi(owner, {
		fingerprint: 'a'.repeat(64),
		selected: [1, 2],
		sort: { column: 'accuracy', direction: 'descending' },
		pairA: 2,
		pairB: 1,
		ropeWidth: 0.02,
		classFilter: 4
	});
	const replacement = {
		...initial,
		trainingDomainGeneration: 1,
		comparisonContextEpoch: initial.comparisonContextEpoch + 2,
		results: {
			owner: { ...owner, epoch: initial.comparisonContextEpoch + 2 },
			ui: {
				...initial.results.ui,
				fingerprint: 'b'.repeat(64),
				selected: [1],
				ropeWidth: 0.03
			}
		}
	};
	const { dataset, target, data, models, nextModelNum, comparisonContextEpoch } = replacement;
	const committed = await commitTrainingCheckpoint(
		db,
		0,
		{
			operationId: 'foreign',
			kind: 'recover',
			domain: { dataset, target, data, models, nextModelNum, comparisonContextEpoch }
		},
		{ type: 'none' }
	);
	expect(committed.ok).toBe(true);
	expect((await clearPendingTrainingCheckpoint(db, 1, 'foreign')).ok).toBe(true);
	storage.setItem(
		STATE_STORAGE_KEY,
		JSON.stringify({
			...replacement,
			models: models.map((model) => ({
				...model,
				trainingSetup: { ...DEFAULT_ONE_SHOT_SETUP, type: 'train_test_split' }
			}))
		})
	);
	flushNow();
	await locks.request(TRAINING_STATE_LOCK, () => {});
	expect(storedState().results).toEqual(replacement.results);
	stopPersister();
});

function blockFinishCleanup(generation = 2) {
	const put = IDBObjectStore.prototype.put;
	let denied = true;
	IDBObjectStore.prototype.put = function (value, key) {
		if (
			denied &&
			this.name === 'model_results' &&
			value?.kind === 'training-domain-checkpoint' &&
			value.generation === generation &&
			value.pending === null
		) {
			throw new DOMException('Test marker cleanup failure', 'SecurityError');
		}
		return put.call(this, value, key);
	};
	return {
		allow: () => (denied = false),
		restore: () => (IDBObjectStore.prototype.put = put)
	};
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

test('WML-P5-MODEL-1: comparison loads current runs and reports unavailable results', async () => {
	seed(2);
	const first = service.start(1);
	const firstWorker = await workerAt(0);
	firstWorker.succeed();
	expect(await first).toMatchObject({ ok: true });
	const second = service.start(2);
	const secondWorker = await workerAt(1);
	secondWorker.succeed();
	expect(await second).toMatchObject({ ok: true });
	await loadComparisonResults();
	expect($comparison.get().groups[0]?.models.map((model) => model.num)).toEqual([1, 2]);
	expect($comparison.get().selected).toEqual([1, 2]);
	const resource = $modelResults.get()[2]!;
	$modelResults.setKey(2, { ...resource, status: 'lost', evaluation: null });
	expect($comparison.get().unavailableModels).toContainEqual({ num: 2, reason: 'lost' });
	expect($comparison.get().groups[0]?.reason).toBe('single-model');
	$modelResults.set({});
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

test.each([
	[
		'k-neighbors-classifier',
		[
			['algorithm', 'brute'],
			['metric', 'minkowski'],
			['nNeighbors', 5],
			['p', 2],
			['weights', 'uniform']
		]
	],
	[
		'mlp-classifier',
		[
			['activation', 'relu'],
			['hiddenLayerSizes', [100]],
			['learningRate', 0.001],
			['maxIter', 200],
			['randomState', null],
			['solver', 'adam'],
			['tol', 0.000001]
		]
	]
] as const)(
	'keeps the saved configuration key for %s after upgrading web-ml',
	(algorithm, options) => {
		const { models } = seed(1, algorithm);
		expect(getTrainingConfigurationKey(models[0]!, metadata.rowCount)).toBe(
			JSON.stringify([algorithm, ['measurement'], options, 'native', ['one_shot', 0.2, 42]])
		);
	}
);

test.each(['one_shot'] as const)(
	'WML-P4-EVAL-5: publishes the %s headline metrics and restores them on reload',
	async (strategy) => {
		seed(1);
		const run = service.start(1);
		const worker = await workerAt(0);
		const result = fixtureTrainingResult(strategy);
		worker.succeed(result);
		expect(await run).toMatchObject({ ok: true });
		const published = $appState.get().models[0]!.metrics;
		expect(published).toEqual(headlineMetrics(result.evaluation));
		expect(published).toMatchObject({ balancedAccuracy: expect.any(Number) });
		expect(Object.hasOwn(published ?? {}, 'balancedAccuracySd')).toBe(false);
		const stored = await db.get('model_results', [metadata.id, 1]);
		expect(stored).toMatchObject({ schemaVersion: 2, strategy });

		$appState.set(INITIAL_APP_STATE);
		expect(await reconcileProtectedStartup({ storage }, locks)).toMatchObject({ ok: true });
		expect($appState.get().models[0]).toMatchObject({ status: 'trained', metrics: published });
	}
);

test('WML-P4-EVAL-6: a valid version 1 result stays trained with no metrics through startup', async () => {
	seed(1);
	const run = service.start(1);
	const worker = await workerAt(0);
	worker.succeed();
	expect(await run).toMatchObject({ ok: true });
	const identity = worker.identity;
	const legacy = fixtureLegacyTrainingResult();
	await db.put('model_results', {
		...legacy,
		...identity,
		algorithm: 'gaussian-nb',
		durationMs: 10,
		logEntries: []
	});
	expect(await reconcileProtectedStartup({ storage }, locks)).toMatchObject({ ok: true });
	expect($appState.get().models[0]).toMatchObject({ status: 'trained', metrics: null });
	await loadComparisonResults();
	expect($comparison.get().unavailableModels).toContainEqual({ num: 1, reason: 'legacy' });
});

test('WML-P4-EVAL-6: a corrupt result envelope follows result-loss recovery with its configuration intact', async () => {
	seed(1);
	const run = service.start(1);
	const worker = await workerAt(0);
	worker.succeed();
	expect(await run).toMatchObject({ ok: true });
	const before = $appState.get().models[0]!;
	const stored = await db.get('model_results', [metadata.id, 1]);
	await db.put('model_results', { ...stored, evaluation: { schemaVersion: 1 } } as never);
	expect(await reconcileProtectedStartup({ storage }, locks)).toMatchObject({ ok: true });
	expect($appState.get().models[0]).toMatchObject({
		status: 'draft',
		metrics: null,
		resultRevision: null,
		modelId: before.modelId,
		features: before.features,
		trainingSetup: before.trainingSetup
	});
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

test('WML-P3-UI-1: a disclosure changed during publication failure survives retry and reload', async () => {
	seed();
	initPersister(storage, {
		trainingPersistence: {
			withStateLock: (operation) => locks.request(TRAINING_STATE_LOCK, operation)
		}
	});
	let runId: string;
	try {
		const run = service.start(1);
		const worker = await workerAt(0);
		runId = worker.identity.runId;
		storage.reject = (state) => state.models[0]?.status === 'trained';
		worker.succeed();
		expect(await run).toMatchObject({ ok: false, reason: 'security', pending: 'finish' });

		expect(setTrainingLogOpen(1, true)).toBe(true);
		flushNow();
		await locks.request(TRAINING_STATE_LOCK, () => {});
		expect($appState.get().models[0]?.ui.trainingLogOpen).toBe(true);
		expect(await readTrainingCheckpoint(db)).toMatchObject({
			checkpoint: { generation: 2, pending: { kind: 'finish' } }
		});

		storage.reject = () => false;
		expect(await service.retry(worker.identity)).toMatchObject({ ok: true });
		expect($appState.get().models[0]).toMatchObject({
			status: 'trained',
			resultRevision: runId,
			ui: { trainingLogOpen: true }
		});
	} finally {
		stopPersister();
		await locks.request(TRAINING_STATE_LOCK, () => {});
	}

	$appState.set(INITIAL_APP_STATE);
	$trainingSession.set(new Map());
	expect(await reconcileProtectedStartup({ storage }, locks)).toMatchObject({
		ok: true,
		generation: 2
	});
	expect($appState.get().models[0]).toMatchObject({
		status: 'trained',
		resultRevision: runId,
		ui: { trainingLogOpen: true }
	});
	expect(workers).toHaveLength(1);
});

test.each([false, true])(
	'WML-P3-UI-1: retry preserves the disclosure after checkpoint cleanup fails (preference write denied: %s)',
	async (denyPreferenceWrite) => {
		seed();
		initPersister(storage, {
			trainingPersistence: {
				withStateLock: (operation) => locks.request(TRAINING_STATE_LOCK, operation)
			}
		});
		const cleanup = blockFinishCleanup();
		const savedState = () =>
			JSON.parse(storage.getItem(STATE_STORAGE_KEY)!) as PersistedAppState;
		let runId: string;
		try {
			const run = service.start(1);
			const worker = await workerAt(0);
			runId = worker.identity.runId;
			worker.succeed();
			expect(await run).toMatchObject({ ok: false, reason: 'security', pending: 'finish' });
			expect(savedState()).toMatchObject({
				trainingDomainGeneration: 2,
				models: [
					{ status: 'trained', resultRevision: runId, ui: { trainingLogOpen: false } }
				]
			});

			expect(setTrainingLogOpen(1, true)).toBe(true);
			flushNow();
			await locks.request(TRAINING_STATE_LOCK, () => {});
			expect($appState.get().models[0]?.ui.trainingLogOpen).toBe(true);
			expect(await readTrainingCheckpoint(db)).toMatchObject({
				checkpoint: { generation: 2, pending: { kind: 'finish' } }
			});

			cleanup.allow();
			let preferenceWrites = 0;
			storage.reject = (state) => {
				if (!state.models[0]?.ui.trainingLogOpen) return false;
				preferenceWrites++;
				return denyPreferenceWrite;
			};
			expect(await service.retry(worker.identity)).toMatchObject({ ok: true });
			expect(preferenceWrites).toBe(1);
			expect(await readTrainingCheckpoint(db)).toMatchObject({
				checkpoint: { generation: 2, pending: null }
			});
			expect($appState.get().models[0]).toMatchObject({
				status: 'trained',
				resultRevision: runId,
				ui: { trainingLogOpen: true }
			});
			expect(savedState().models[0]).toMatchObject({
				status: 'trained',
				resultRevision: runId,
				ui: { trainingLogOpen: !denyPreferenceWrite }
			});
		} finally {
			cleanup.restore();
			stopPersister();
			await locks.request(TRAINING_STATE_LOCK, () => {});
		}

		$appState.set(INITIAL_APP_STATE);
		$trainingSession.set(new Map());
		expect(await reconcileProtectedStartup({ storage }, locks)).toMatchObject({
			ok: true,
			generation: 2
		});
		expect($appState.get().models[0]).toMatchObject({
			status: 'trained',
			resultRevision: runId,
			ui: { trainingLogOpen: !denyPreferenceWrite }
		});
		expect(workers).toHaveLength(1);
		expect(workers[0]?.posted.map(({ kind }) => kind)).toEqual(['start']);
	}
);

test.each([
	'untouched',
	'no-op local choice',
	'unsaved local edit',
	'previously saved local edit'
] as const)(
	'WML-P3-UI-1: finish retry preserves the cross-tab disclosure (%s)',
	async (localChoice) => {
		seed();
		initPersister(storage, {
			trainingPersistence: {
				withStateLock: (operation) => locks.request(TRAINING_STATE_LOCK, operation)
			}
		});
		const cleanup = blockFinishCleanup();
		const savedState = () =>
			JSON.parse(storage.getItem(STATE_STORAGE_KEY)!) as PersistedAppState;
		let runId: string;
		try {
			const run = service.start(1);
			const worker = await workerAt(0);
			runId = worker.identity.runId;
			const previouslySaved = localChoice === 'previously saved local edit';
			const remotelySavedOpen = !previouslySaved;
			if (previouslySaved) {
				expect(setTrainingLogOpen(1, true)).toBe(true);
				flushNow();
				await locks.request(TRAINING_STATE_LOCK, () => {});
				expect(savedState().models[0]?.ui.trainingLogOpen).toBe(true);
			}

			// A same-generation preference write in another tab does not replace live memory.
			await locks.request(TRAINING_STATE_LOCK, () => {
				const state = savedState();
				expect(state.trainingDomainGeneration).toBe(1);
				state.models[0]!.ui.trainingLogOpen = remotelySavedOpen;
				storage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
			});
			worker.succeed();
			expect(await run).toMatchObject({ ok: false, reason: 'security', pending: 'finish' });
			expect(savedState()).toMatchObject({
				trainingDomainGeneration: 2,
				models: [
					{
						status: 'trained',
						resultRevision: runId,
						ui: { trainingLogOpen: remotelySavedOpen }
					}
				]
			});
			expect($appState.get().models[0]?.ui.trainingLogOpen).toBe(previouslySaved);

			// Queue an ordinary write while cleanup is still denied. In the edit case the
			// latest local choice is closed, even though the tab started out closed.
			if (localChoice === 'unsaved local edit') {
				expect(setTrainingLogOpen(1, true)).toBe(true);
				expect(setTrainingLogOpen(1, false)).toBe(true);
			}
			if (localChoice === 'no-op local choice')
				expect(setTrainingLogOpen(1, false)).toBe(true);
			expect(setResumePath('/target')).toBe(true);
			flushNow();
			expect(await service.retry(worker.identity)).toMatchObject({
				ok: false,
				reason: 'security',
				pending: 'finish'
			});
			expect(savedState().models[0]?.ui.trainingLogOpen).toBe(remotelySavedOpen);
			cleanup.allow();
			const retry = service.retry(worker.identity);
			// Let a queued ordinary write also run after replay has changed what is visible.
			expect(setResumePath('/models/1')).toBe(true);
			expect(await retry).toMatchObject({ ok: true });
			await locks.request(TRAINING_STATE_LOCK, () => {});
			expect(await readTrainingCheckpoint(db)).toMatchObject({
				checkpoint: { generation: 2, pending: null }
			});
			for (const state of [$appState.get(), savedState()]) {
				expect(state).toMatchObject({
					trainingDomainGeneration: 2,
					models: [
						{
							status: 'trained',
							resultRevision: runId,
							ui: {
								trainingLogOpen:
									remotelySavedOpen && localChoice !== 'unsaved local edit'
							}
						}
					]
				});
			}
		} finally {
			cleanup.restore();
			stopPersister();
			await locks.request(TRAINING_STATE_LOCK, () => {});
		}

		$appState.set(INITIAL_APP_STATE);
		$trainingSession.set(new Map());
		expect(await reconcileProtectedStartup({ storage }, locks)).toMatchObject({
			ok: true,
			generation: 2
		});
		expect($appState.get().models[0]).toMatchObject({
			status: 'trained',
			resultRevision: runId,
			ui: {
				trainingLogOpen: localChoice === 'untouched' || localChoice === 'no-op local choice'
			}
		});
		expect(workers).toHaveLength(1);
		expect(workers[0]?.posted.map(({ kind }) => kind)).toEqual(['start']);
	}
);

function guardedPersistence() {
	return {
		storage,
		withStateLock: <T>(operation: () => Promise<T>) =>
			locks.request(TRAINING_STATE_LOCK, operation)
	};
}

function storedState(): PersistedAppState {
	const saved = readAppSnapshot(storage);
	if (!saved.ok || !saved.state) throw new Error('Missing saved state');
	return saved.state;
}

function clearCheckpointFromAnotherTab(kind: 'cancel' | 'finish' | 'recover' = 'finish') {
	return locks.request(TRAINING_STATE_LOCK, async () => {
		const marker = await readTrainingCheckpoint(db);
		if (!marker.ok || marker.checkpoint?.pending?.kind !== kind)
			throw new Error(`Missing ${kind} marker`);
		return clearPendingTrainingCheckpoint(
			db,
			marker.checkpoint.generation,
			marker.checkpoint.pending.operationId
		);
	});
}

test.each(['untouched', 'unsaved', 'denied', 'remote', 'acknowledged'] as const)(
	'WML-P3-TRAIN-5: owner recovers after foreign finish cleanup (%s disclosure)',
	async (choice) => {
		seed();
		const persistence = guardedPersistence();
		initPersister(storage, { trainingPersistence: persistence });
		const cleanup = blockFinishCleanup();
		const localEdit = choice === 'unsaved' || choice === 'denied';
		const savedOpen = choice === 'unsaved' || choice === 'remote';
		let revision: string;
		try {
			const run = service.start(1);
			const worker = await workerAt(0);
			revision = worker.identity.runId;
			if (choice === 'acknowledged') {
				expect(setTrainingLogOpen(1, true)).toBe(true);
				flushNow();
				await locks.request(TRAINING_STATE_LOCK, () => {});
				expect(storedState().models[0]?.ui.trainingLogOpen).toBe(true);
			}
			if (choice === 'remote' || choice === 'acknowledged') {
				await locks.request(TRAINING_STATE_LOCK, () => {
					const wire = JSON.parse(
						storage.getItem(STATE_STORAGE_KEY)!
					) as PersistedAppState;
					wire.models[0]!.ui.trainingLogOpen = choice === 'remote';
					storage.setItem(STATE_STORAGE_KEY, JSON.stringify(wire));
				});
			}
			worker.succeed();
			expect(await run).toMatchObject({ ok: false, reason: 'security', pending: 'finish' });
			expect(storedState().models[0]?.ui.trainingLogOpen).toBe(choice === 'remote');
			if (localEdit) expect(setTrainingLogOpen(1, true)).toBe(true);
			expect(setResumePath('/models/1')).toBe(true);
			expect(dismissWelcome()).toBe(true);
			$appState.set({
				...$appState.get(),
				results: {
					owner: {
						datasetId: metadata.id,
						target: $appState.get().target!,
						epoch: $appState.get().comparisonContextEpoch
					},
					ui: { ...$appState.get().results.ui, ropeWidth: 0.02 }
				}
			});
			flushNow();
			await locks.request(TRAINING_STATE_LOCK, () => {});
			expect($storageSaveNotice.get()).toMatchObject({ ok: false, reason: 'security' });
			const localSettings = $appState.get();
			const savedSettings = storedState();
			expect(localSettings.resumePath).not.toBe(savedSettings.resumePath);
			expect(localSettings.onboarding).not.toEqual(savedSettings.onboarding);
			expect(localSettings.results).not.toEqual(savedSettings.results);
			const original = await db.get('model_results', [metadata.id, 1]);
			expect(original).toMatchObject({ runId: revision });
			cleanup.allow();
			expect(await clearCheckpointFromAnotherTab()).toMatchObject({ ok: true });
			expect($appState.get().trainingDomainGeneration).toBe(1);
			expect($appState.get().models[0]?.status).toBe('training');
			expect(getTrainingSession(worker.identity)?.status).toBe('publication-pending');

			$storageSaveNotice.set(null);
			let writes = 0;
			storage.reject = () => {
				writes++;
				return choice === 'denied';
			};
			const duringPublication: Promise<LockManagerSnapshot>[] = [];
			const unlisten = $appState.listen(() => duringPublication.push(locks.query()));
			try {
				const outcomes = await Promise.all([
					service.retry(worker.identity),
					service.retry(worker.identity)
				]);
				expect(outcomes).toEqual([
					{ ok: true, value: undefined },
					{ ok: true, value: undefined }
				]);
			} finally {
				unlisten();
			}
			expect(duringPublication).toHaveLength(1);
			expect((await duringPublication[0]!).held).toContainEqual({
				name: TRAINING_STATE_LOCK,
				mode: 'exclusive',
				clientId: 'fixture'
			});
			expect(writes).toBe(localEdit ? 1 : 0);
			expect($storageSaveNotice.get()).toEqual(
				choice === 'denied' ? { ok: false, reason: 'security' } : null
			);
			expect($publicationPending.get()).toBeNull();
			expect(getTrainingSession(worker.identity)).toMatchObject({
				status: 'complete',
				progress: { percent: 100 }
			});
			for (const [state, settings, open] of [
				[$appState.get(), localSettings, savedOpen || choice === 'denied'],
				[storedState(), savedSettings, savedOpen]
			] as const) {
				expect(state).toMatchObject({
					trainingDomainGeneration: 2,
					resumePath: settings.resumePath,
					onboarding: settings.onboarding,
					results: settings.results,
					models: [
						{
							status: 'trained',
							resultRevision: revision,
							ui: { trainingLogOpen: open }
						}
					]
				});
			}
			expect(await readTrainingCheckpoint(db)).toMatchObject({
				checkpoint: { generation: 2, pending: null }
			});
			expect(await db.get('model_results', [metadata.id, 1])).toEqual(original);
		} finally {
			cleanup.restore();
			stopPersister();
			await locks.request(TRAINING_STATE_LOCK, () => {});
		}
		$appState.set(INITIAL_APP_STATE);
		$trainingSession.set(new Map());
		expect(await reconcileProtectedStartup({ storage }, locks)).toMatchObject({
			ok: true,
			generation: 2
		});
		expect($appState.get().models[0]).toMatchObject({
			status: 'trained',
			resultRevision: revision,
			ui: { trainingLogOpen: savedOpen }
		});
		expect(workers).toHaveLength(1);
		expect(workers[0]?.posted.map(({ kind }) => kind)).toEqual(['start']);
	}
);

test.each(['add model', 'replace model', 'replace target', 'replace revision'] as const)(
	'WML-P3-TRAIN-5: finish retry checks the current domain after an intervening change (%s)',
	async (change) => {
		const initial = seed().models[0]!;
		initPersister(storage, { trainingPersistence: guardedPersistence() });
		const cleanup = blockFinishCleanup();
		try {
			const run = service.start(1);
			const worker = await workerAt(0);
			worker.succeed();
			expect(await run).toMatchObject({ ok: false, pending: 'finish' });
			expect(setTrainingLogOpen(1, true)).toBe(true);
			flushNow();
			await locks.request(TRAINING_STATE_LOCK, () => {});
			cleanup.allow();
			expect(await clearCheckpointFromAnotherTab()).toMatchObject({ ok: true });
			const current = storedState();
			const matching = change === 'add model';
			const next = matching
				? reduceCreateModel(current, 20)
				: {
						...current,
						target: change === 'replace target' ? 'measurement' : current.target,
						models: [
							change === 'replace revision'
								? { ...current.models[0]!, resultRevision: 'replacement-run' }
								: {
										...initial,
										createdAt:
											change === 'replace model' ? 20 : initial.createdAt
									}
						]
					};
			if (!next) throw new Error('Could not advance the remote model domain');
			const { dataset, target, data, models, nextModelNum } = next;
			const operationId = 'remote-advance-before-retry';
			const advance = locks.request(TRAINING_STATE_LOCK, async () => {
				expect(
					await commitTrainingCheckpoint(
						db,
						2,
						{
							operationId,
							kind: 'recover',
							domain: {
								dataset,
								target,
								data,
								models,
								nextModelNum,
								comparisonContextEpoch: next.comparisonContextEpoch
							}
						},
						{ type: 'none' }
					)
				).toMatchObject({ ok: true });
				storage.setItem(
					STATE_STORAGE_KEY,
					JSON.stringify({
						...next,
						trainingDomainGeneration: 3,
						models: models.map((model) => ({
							...model,
							trainingSetup: model.trainingSetup && {
								...model.trainingSetup,
								type: 'train_test_split'
							}
						}))
					})
				);
				expect(await clearPendingTrainingCheckpoint(db, 3, operationId)).toMatchObject({
					ok: true
				});
			});
			const retry = service.retry(worker.identity);
			await advance;
			if (matching) {
				expect(await retry).toMatchObject({ ok: true });
				expect($appState.get()).toMatchObject({
					trainingDomainGeneration: 3,
					nextModelNum
				});
				expect($appState.get().models[0]?.resultRevision).toBe(worker.identity.runId);
				expect(getTrainingSession(worker.identity)?.status).toBe('complete');
			} else {
				expect(await retry).toMatchObject({ ok: false, code: 'conflict' });
				expect(getTrainingSession(worker.identity)?.status).toBe('publication-pending');
				expect(await refreshTrainingSnapshot(guardedPersistence())).toMatchObject({
					ok: true
				});
				expect($appState.get().models[0]?.ui.trainingLogOpen).toBe(
					change === 'replace revision'
				);
			}
			expect(storedState().trainingDomainGeneration).toBe(3);
			expect(storedState().models[0]?.ui.trainingLogOpen).toBe(matching);
			expect(storedState().models[0]?.resultRevision).toBe(models[0]?.resultRevision);
			expect(await db.get('model_results', [metadata.id, 1])).toMatchObject({
				runId: worker.identity.runId
			});
			expect(workers).toHaveLength(1);
		} finally {
			cleanup.restore();
			stopPersister();
			await locks.request(TRAINING_STATE_LOCK, () => {});
		}
	}
);

test.each([
	{ tab: 'owner', queued: 'before', open: true, choice: 'toggle' },
	{ tab: 'owner', queued: 'after', open: false, choice: 'toggle' },
	{ tab: 'foreign', queued: 'before', open: true, choice: 'toggle' },
	{ tab: 'foreign', queued: 'after', open: false, choice: 'toggle' },
	{ tab: 'foreign', queued: 'before', open: false, choice: 'denied toggle' },
	{ tab: 'foreign', queued: 'after', open: true, choice: 'denied toggle' },
	{ tab: 'owner', queued: 'after', open: true, choice: 'untouched' },
	{ tab: 'foreign', queued: 'before', open: true, choice: 'untouched' },
	{ tab: 'foreign', queued: 'after', open: true, choice: 'no-op' },
	{ tab: 'owner', queued: 'before', open: false, choice: 'acknowledged' },
	{ tab: 'foreign', queued: 'after', open: false, choice: 'acknowledged' }
] as const)(
	'WML-P3-UI-1: keeps the correct disclosure around finish marker clearance %o',
	async ({ tab, queued, open, choice }) => {
		seed();
		const persistence = guardedPersistence();
		initPersister(storage, { trainingPersistence: persistence });
		const cleanup = blockFinishCleanup();
		let runId: string;
		const denyWrite = choice === 'denied toggle';
		const localToggle = choice === 'toggle' || denyWrite;
		const savedOpen = denyWrite ? !open : open;
		try {
			expect(setTrainingLogOpen(1, !open)).toBe(true);
			flushNow();
			const run = service.start(1);
			const worker = await workerAt(0);
			runId = worker.identity.runId;
			if (!localToggle) {
				await locks.request(TRAINING_STATE_LOCK, () => {
					const wire = JSON.parse(
						storage.getItem(STATE_STORAGE_KEY)!
					) as PersistedAppState;
					wire.models[0]!.ui.trainingLogOpen = open;
					storage.setItem(STATE_STORAGE_KEY, JSON.stringify(wire));
				});
			}
			worker.succeed();
			expect(await run).toMatchObject({ ok: false, reason: 'security', pending: 'finish' });
			expect(storedState().models[0]?.ui.trainingLogOpen).toBe(localToggle ? !open : open);
			expect($appState.get().trainingDomainGeneration).toBe(1);
			cleanup.allow();
			storage.reject = (state) => denyWrite && state.models[0]?.ui.trainingLogOpen === open;
			const finish =
				tab === 'owner' ? service.retry(worker.identity) : clearCheckpointFromAnotherTab();
			if (queued === 'after') expect(await finish).toMatchObject({ ok: true });
			const refresh =
				tab === 'foreign' && queued === 'before'
					? refreshTrainingSnapshot(persistence)
					: undefined;
			if (localToggle) expect(setTrainingLogOpen(1, open)).toBe(true);
			if (choice === 'no-op') expect(setTrainingLogOpen(1, !open)).toBe(true);
			expect(setResumePath('/models/1')).toBe(true);
			flushNow();
			expect(await finish).toMatchObject({ ok: true });
			expect(await (refresh ?? refreshTrainingSnapshot(persistence))).toMatchObject({
				ok: true,
				generation: 2
			});
			await locks.request(TRAINING_STATE_LOCK, () => {});
			expect(await service.retry(worker.identity)).toMatchObject({ ok: true });
			expect(await readTrainingCheckpoint(db)).toMatchObject({
				checkpoint: { generation: 2, pending: null }
			});
			for (const [state, preference] of [
				[$appState.get(), open],
				[storedState(), savedOpen]
			] as const) {
				expect(state).toMatchObject({
					trainingDomainGeneration: 2,
					models: [
						{
							status: 'trained',
							resultRevision: runId,
							ui: { trainingLogOpen: preference }
						}
					]
				});
			}
			if (denyWrite)
				expect($storageSaveNotice.get()).toMatchObject({ ok: false, reason: 'security' });
		} finally {
			cleanup.restore();
			stopPersister();
			await locks.request(TRAINING_STATE_LOCK, () => {});
		}
		$appState.set(INITIAL_APP_STATE);
		$trainingSession.set(new Map());
		expect(await reconcileProtectedStartup({ storage }, locks)).toMatchObject({
			ok: true,
			generation: 2
		});
		expect($appState.get().models[0]).toMatchObject({
			status: 'trained',
			resultRevision: runId,
			ui: { trainingLogOpen: savedOpen }
		});
		expect(workers).toHaveLength(1);
		expect(workers[0]?.posted.map(({ kind }) => kind)).toEqual(['start']);
	}
);

test.each([
	{ refreshFirst: true, change: 'create model' },
	{ refreshFirst: false, change: 'create model' },
	{ refreshFirst: true, change: 'replace dataset' },
	{ refreshFirst: false, change: 'replace target' },
	{ refreshFirst: true, change: 'replace model' }
] as const)(
	'WML-P3-UI-1: carries an unsaved disclosure only through a matching model refresh %o',
	async ({ refreshFirst, change }) => {
		const initialDraft = seed().models[0]!;
		const persistence = guardedPersistence();
		initPersister(storage, { trainingPersistence: persistence });
		try {
			const run = service.start(1);
			const worker = await workerAt(0);
			worker.succeed();
			expect(await run).toMatchObject({ ok: true });
			// Publish a protected generation directly, as another realm with no local edits.
			const newModel = change === 'create model';
			const remote = locks.request(TRAINING_STATE_LOCK, async () => {
				const state = storedState();
				const next = newModel
					? reduceCreateModel(state, 20)!
					: {
							...state,
							dataset:
								change === 'replace dataset'
									? { ...state.dataset!, id: 'replacement' }
									: state.dataset,
							target: change === 'replace target' ? 'replacement' : state.target,
							models: [
								change === 'replace model'
									? { ...initialDraft, createdAt: 30 }
									: initialDraft
							]
						};
				if (!next) throw new Error('Could not advance the remote model domain');
				const { dataset, data, target, models, nextModelNum } = next;
				const operationId = 'remote-advance';
				const committed = await commitTrainingCheckpoint(
					db,
					2,
					{
						operationId,
						kind: 'recover',
						domain: {
							dataset,
							data,
							target,
							models,
							nextModelNum,
							comparisonContextEpoch: next.comparisonContextEpoch
						}
					},
					{ type: 'none' }
				);
				expect(committed).toMatchObject({ ok: true, checkpoint: { generation: 3 } });
				storage.setItem(
					STATE_STORAGE_KEY,
					JSON.stringify({
						...next,
						trainingDomainGeneration: 3,
						models: models.map((model) =>
							model.trainingSetup
								? {
										...model,
										trainingSetup: {
											...model.trainingSetup,
											type: 'train_test_split'
										}
									}
								: model
						)
					})
				);
				expect(await clearPendingTrainingCheckpoint(db, 3, operationId)).toMatchObject({
					ok: true
				});
			});
			const refresh = refreshFirst ? refreshTrainingSnapshot(persistence) : undefined;
			expect(setTrainingLogOpen(1, true)).toBe(true);
			flushNow();
			await remote;
			expect(await (refresh ?? refreshTrainingSnapshot(persistence))).toMatchObject({
				ok: true,
				generation: 3
			});
			await locks.request(TRAINING_STATE_LOCK, () => {});
			for (const state of [$appState.get(), storedState()]) {
				expect(state.trainingDomainGeneration).toBe(3);
				expect(state.models).toHaveLength(newModel ? 2 : 1);
				expect(state.models[0]?.ui.trainingLogOpen).toBe(newModel);
				expect(state.models[0]).toMatchObject(
					newModel
						? { status: 'trained', resultRevision: worker.identity.runId }
						: { status: 'draft', resultRevision: null }
				);
			}
			expect(workers).toHaveLength(1);
			expect(workers[0]?.posted.map(({ kind }) => kind)).toEqual(['start']);
		} finally {
			stopPersister();
			await locks.request(TRAINING_STATE_LOCK, () => {});
		}
	}
);

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

for (const outcome of ['invalid-request', 'worker-crashed', 'cancelled'] as const) {
	for (const denial of ['acknowledgement', 'cleanup'] as const) {
		test.each(['owner', 'other tab'] as const)(
			`WML-P3-TRAIN-5/6: ${outcome} after ${denial} denial and recovery by %s`,
			async (tab) => {
				seed();
				const run = service.start(1);
				const worker = await workerAt(0);
				const owner = $appState.get();
				const cancelled = outcome === 'cancelled';
				const kind = cancelled ? 'cancel' : 'finish';
				const status = cancelled ? 'cancelled' : 'failed';
				const cleanup = denial === 'cleanup' ? blockFinishCleanup() : null;
				storage.reject = (state) =>
					denial === 'acknowledgement' && state.models[0]?.status === 'draft';
				try {
					worker.reply(
						cancelled
							? { kind: 'cancelled', identity: worker.identity }
							: { kind: 'failed', code: outcome, identity: worker.identity }
					);
					expect(await run).toMatchObject({
						ok: false,
						pending: kind,
						reason: 'security'
					});
					const committed = await readTrainingCheckpoint(db);
					const pending = committed.ok && committed.checkpoint?.pending;
					if (!pending) throw new Error('Missing stopped checkpoint');
					const originalError = pending.domain.models[0]?.error;
					expect(originalError).toMatchObject({
						code: cancelled ? 'TRAINING_CANCELLED' : 'TRAINING_FAILED',
						details: outcome
					});
					expect(getTrainingSession(worker.identity)?.status).toBe('stopped-pending');
					expect(await service.retry(worker.identity)).toMatchObject({
						ok: false,
						pending: kind,
						reason: 'security'
					});
					storage.reject = () => false;
					cleanup?.allow();
					if (tab === 'other tab') {
						if (denial === 'acknowledgement') {
							expect(
								await withTrainingStateLock(
									readGuardedTrainingSnapshot,
									guardedPersistence()
								)
							).toMatchObject({ ok: true, replayed: true });
							// The test services share a store. Restore the owner's view without a storage event.
							$appState.set(owner);
						} else {
							expect(await clearCheckpointFromAnotherTab(kind)).toMatchObject({
								ok: true
							});
						}
					}
					expect($appState.get().models[0]?.status).toBe('training');
					const retries = await Promise.all([
						service.retry(worker.identity),
						service.retry(worker.identity)
					]);
					expect(retries).toEqual([
						{ ok: true, value: undefined },
						{ ok: true, value: undefined }
					]);
					for (const state of [$appState.get(), storedState()]) {
						expect(state.trainingDomainGeneration).toBe(2);
						expect(state.models[0]).toMatchObject({
							status: 'draft',
							resultRevision: null,
							error: originalError
						});
					}
					expect(await readTrainingCheckpoint(db)).toMatchObject({
						checkpoint: { generation: 2, pending: null }
					});
					expect($publicationPending.get()).toBeNull();
					const session = getTrainingSession(worker.identity);
					expect(session?.status).toBe(status);
					expect(
						session?.logEntries.filter(({ message }) => message.key === status)
					).toHaveLength(1);
					expect(await db.get('model_results', [metadata.id, 1])).toBeUndefined();
					expect(workers).toEqual([worker]);
					expect(worker.terminations).toBe(1);
				} finally {
					cleanup?.restore();
				}
			}
		);
	}
}

test.each(['automatic recovery first', 'manual retry first'] as const)(
	'WML-P3-TRAIN-6: foreign cleanup of a committed stop repair is idempotent with %s',
	async (order) => {
		seed();
		const run = service.start(1);
		const worker = await workerAt(0);
		storage.denyRead = true;
		worker.reply({ kind: 'failed', code: 'worker-crashed', identity: worker.identity });
		expect(await run).toMatchObject({ ok: false, pending: 'recover', reason: 'security' });
		storage.denyRead = false;
		const cleanup = blockFinishCleanup();
		try {
			expect(await service.retry(worker.identity)).toMatchObject({
				ok: false,
				pending: 'recover'
			});
			cleanup.allow();
			expect(await clearCheckpointFromAnotherTab('recover')).toMatchObject({ ok: true });
			const refresh = () => refreshTrainingSnapshot(guardedPersistence());
			const recover = async () => {
				expect(await service.recoverStoppedPublication()).toMatchObject({ ok: true });
			};
			const retry = async () => {
				expect(await service.retry(worker.identity)).toMatchObject({ ok: true });
			};
			const automaticFirst = order === 'automatic recovery first';
			if (automaticFirst) expect(await refresh()).toMatchObject({ ok: true });
			const barrier = Promise.withResolvers<void>();
			const block = locks.request(TRAINING_STATE_LOCK, () => barrier.promise);
			const first = automaticFirst ? recover() : retry();
			let second: Promise<void>;
			try {
				for (let index = 0; index < 10; index++) {
					if (
						(await locks.query()).pending?.some(
							({ name }) => name === TRAINING_STATE_LOCK
						)
					)
						break;
				}
				expect((await locks.query()).pending?.map(({ name }) => name)).toContain(
					TRAINING_STATE_LOCK
				);
				second = automaticFirst ? retry() : refresh().then(recover);
			} finally {
				barrier.resolve();
			}
			await Promise.all([block, first, second]);
			expect($appState.get()).toEqual(storedState());
			expect($appState.get().models[0]?.error?.details).toBe('worker-crashed');
			expect($publicationPending.get()).toBeNull();
			expect(getTrainingSession(worker.identity)).toMatchObject({
				status: 'failed',
				logEntries: [{ message: { key: 'failed' } }]
			});
			expect(await db.get('model_results', [metadata.id, 1])).toBeUndefined();
			expect(workers).toEqual([worker]);
		} finally {
			cleanup.restore();
		}
	}
);

test('WML-P3-TRAIN-6: an ordinary writer that replays a committed stop settles the original session', async () => {
	seed();
	initPersister(storage, { trainingPersistence: guardedPersistence() });
	const stopObserving = service.observePublishedStops();
	const settled = Promise.withResolvers<void>();
	const unlisten = $publicationPending.listen((pending) => {
		if (!pending) settled.resolve();
	});
	try {
		const run = service.start(1);
		const worker = await workerAt(0);
		storage.reject = (state) => state.models[0]?.status === 'draft';
		worker.reply({ kind: 'failed', code: 'invalid-request', identity: worker.identity });
		expect(await run).toMatchObject({ ok: false, pending: 'finish', reason: 'security' });
		expect(getTrainingSession(worker.identity)?.status).toBe('stopped-pending');
		storage.reject = () => false;
		expect(setTrainingLogOpen(1, true)).toBe(true);
		flushNow();
		await settled.promise;
		for (const state of [$appState.get(), storedState()]) {
			expect(state.models[0]).toMatchObject({
				status: 'draft',
				resultRevision: null,
				error: { details: 'invalid-request' },
				ui: { trainingLogOpen: true }
			});
		}
		expect(getTrainingSession(worker.identity)).toMatchObject({
			status: 'failed',
			logEntries: [{ message: { key: 'failed' } }]
		});
		expect(await readTrainingCheckpoint(db)).toMatchObject({
			checkpoint: { generation: 2, pending: null }
		});
		expect(await db.get('model_results', [metadata.id, 1])).toBeUndefined();
		expect(workers).toEqual([worker]);
	} finally {
		unlisten();
		stopObserving();
		stopPersister();
		await locks.request(TRAINING_STATE_LOCK, () => {});
	}
});

test.each(['foreign marker cleanup', 'checkpoint replay by the next stop'] as const)(
	'WML-P3-TRAIN-5/6: two committed stops keep their original sessions after %s',
	async (ordering) => {
		seed(2);
		const foreignCleanup = ordering === 'foreign marker cleanup';
		const stopObserving = foreignCleanup ? undefined : service.observePublishedStops();
		const cleanup = foreignCleanup ? blockFinishCleanup(3) : undefined;
		try {
			const first = service.start(1);
			const one = await workerAt(0);
			const second = service.start(2);
			const two = await workerAt(1);
			storage.reject = (state) => !foreignCleanup && state.models[0]?.status === 'draft';
			one.reply({ kind: 'cancelled', identity: one.identity });
			expect(await first).toMatchObject({ ok: false, pending: 'cancel', reason: 'security' });
			expect(getTrainingSession(one.identity)?.status).toBe('stopped-pending');
			const cancelled = await readTrainingCheckpoint(db);
			const originalError =
				cancelled.ok && cancelled.checkpoint?.pending?.domain.models[0]?.error;
			expect(originalError).toMatchObject({
				code: 'TRAINING_CANCELLED',
				details: 'cancelled'
			});
			if (foreignCleanup) {
				cleanup?.allow();
				expect(await clearCheckpointFromAnotherTab('cancel')).toMatchObject({ ok: true });
			}
			expect($appState.get().models[0]?.status).toBe('training');

			storage.reject = (state) => state.models[1]?.status === 'draft';
			two.reply({ kind: 'failed', code: 'invalid-request', identity: two.identity });
			expect(await second).toMatchObject({
				ok: false,
				pending: 'finish',
				reason: 'security'
			});
			const failed = await readTrainingCheckpoint(db);
			const failureError = failed.ok && failed.checkpoint?.pending?.domain.models[1]?.error;
			expect(failureError).toMatchObject({
				code: 'TRAINING_FAILED',
				details: 'invalid-request'
			});
			const newerNotice = $publicationPending.get();
			expect(newerNotice?.identity).toEqual(two.identity);
			expect(getTrainingSession(two.identity)?.status).toBe('stopped-pending');

			if (!foreignCleanup) {
				// Wait behind the observer's model lock while the later acknowledgement is denied.
				await locks.request('samata-ml:training:1', () => {});
				expect(getTrainingSession(one.identity)?.status).toBe('cancelled');
				expect($publicationPending.get()).toBe(newerNotice);
			} else {
				expect(getTrainingSession(one.identity)?.status).toBe('stopped-pending');
			}

			storage.reject = () => false;
			const expected = foreignCleanup ? one.identity : two.identity;
			expect(await service.retry(expected)).toMatchObject({ ok: true });
			for (const [worker, status] of [
				[one, 'cancelled'],
				[two, 'failed']
			] as const) {
				const settled = getTrainingSession(worker.identity);
				expect(settled).toMatchObject({
					status,
					logEntries: [{ message: { key: status } }]
				});
				expect(await service.retry(worker.identity)).toMatchObject({ ok: true });
				expect(getTrainingSession(worker.identity)).toBe(settled);
				expect(
					await db.get('model_results', [metadata.id, worker.identity.modelNum])
				).toBeUndefined();
				expect(worker.posted.map(({ kind }) => kind)).toEqual(['start']);
				expect(worker.terminations).toBe(1);
			}
			for (const state of [$appState.get(), storedState()]) {
				expect(state.trainingDomainGeneration).toBe(4);
				expect(state.models).toMatchObject([
					{ status: 'draft', resultRevision: null, error: originalError },
					{ status: 'draft', resultRevision: null, error: failureError }
				]);
			}
			expect(await readTrainingCheckpoint(db)).toMatchObject({
				checkpoint: { generation: 4, pending: null }
			});
			expect($publicationPending.get()).toBeNull();
			expect(workers).toEqual([one, two]);
		} finally {
			stopObserving?.();
			cleanup?.restore();
			await locks.request(TRAINING_STATE_LOCK, () => {});
		}
	}
);

test.each([
	'add model',
	'replace dataset',
	'replace target',
	'replace model',
	'edit configuration',
	'restart',
	'stop a newer run'
] as const)(
	'WML-P3-TRAIN-5: stopped retry checks the authoritative state after %s',
	async (change) => {
		seed();
		const run = service.start(1);
		const worker = await workerAt(0);
		const cleanup = blockFinishCleanup();
		try {
			worker.reply({ kind: 'failed', code: 'invalid-request', identity: worker.identity });
			expect(await run).toMatchObject({ ok: false, pending: 'finish' });
			cleanup.allow();
			expect(await clearCheckpointFromAnotherTab()).toMatchObject({ ok: true });
			const state = storedState();
			const stopped = state.models[0]!;
			const restarted = reduceTrainingStart(state, {
				...worker.identity,
				runId: 'new-remote-run'
			});
			const next =
				change === 'add model'
					? reduceCreateModel(state, 20)
					: change === 'restart'
						? restarted
						: {
								...state,
								dataset:
									change === 'replace dataset'
										? { ...state.dataset!, id: 'new-dataset' }
										: state.dataset,
								target: change === 'replace target' ? 'measurement' : state.target,
								models: [
									{
										...stopped,
										createdAt:
											change === 'replace model' ? 20 : stopped.createdAt,
										features:
											change === 'edit configuration'
												? ['other-feature']
												: stopped.features,
										error:
											change === 'stop a newer run'
												? {
														...stopped.error!,
														timestamp: stopped.error!.timestamp + 1
													}
												: stopped.error
									}
								]
							};
			if (!next) throw new Error('Missing revised state');
			const { dataset, data, target, models, nextModelNum } = next;
			const remote = locks.request(TRAINING_STATE_LOCK, async () => {
				expect(
					await commitTrainingCheckpoint(
						db,
						2,
						{
							operationId: 'remote-change',
							kind: 'recover',
							domain: {
								dataset,
								data,
								target,
								models,
								nextModelNum,
								comparisonContextEpoch: next.comparisonContextEpoch
							}
						},
						{ type: 'none' }
					)
				).toMatchObject({ ok: true });
			});
			const retry = service.retry(worker.identity);
			await remote;
			if (change === 'add model') {
				expect(await retry).toMatchObject({ ok: true });
				expect(getTrainingSession(worker.identity)?.status).toBe('failed');
			} else {
				expect(await retry).toMatchObject({ ok: true });
				expect(getTrainingSession(worker.identity)?.status).toBe('stopped-pending');
			}
			expect($publicationPending.get()).toBeNull();
			expect(storedState()).toMatchObject({
				dataset,
				target,
				models,
				nextModelNum,
				trainingDomainGeneration: 3
			});
			expect($appState.get()).toEqual(storedState());
			expect(await db.get('model_results', [metadata.id, 1])).toBeUndefined();
			expect(workers).toEqual([worker]);
		} finally {
			cleanup.restore();
		}
	}
);

test('WML-P3-TRAIN-5: a new failure with the same reason and clock tick supersedes an older stop', async () => {
	seed();
	const run = service.start(1);
	const worker = await workerAt(0);
	const owner = $appState.get();
	const cleanup = blockFinishCleanup();
	try {
		worker.reply({ kind: 'failed', code: 'invalid-request', identity: worker.identity });
		expect(await run).toMatchObject({ ok: false, pending: 'finish' });
		cleanup.allow();
		expect(await clearCheckpointFromAnotherTab()).toMatchObject({ ok: true });
		const prior = storedState();
		const firstTimestamp = prior.models[0]!.error!.timestamp;
		// Simulate a separate tab that already sees the first draft and starts a new run.
		$appState.set(prior);
		const other = createTrainingService({
			locks,
			persistence: { storage },
			now: () => firstTimestamp,
			isIsolated: () => true,
			createWorker: () => {
				const worker = new ScriptedWorker();
				workers.push(worker);
				return worker;
			}
		});
		const restart = other.start(1);
		const nextWorker = await workerAt(1);
		nextWorker.reply({
			kind: 'failed',
			code: 'invalid-request',
			identity: nextWorker.identity
		});
		expect(await restart).toMatchObject({ ok: false, code: 'invalid-request' });
		const latest = storedState();
		expect(latest.models[0]?.error).toMatchObject({
			details: 'invalid-request',
			timestamp: firstTimestamp + 1
		});
		$appState.set(owner);
		expect(await service.retry(worker.identity)).toMatchObject({ ok: true });
		expect($appState.get()).toEqual(latest);
		expect(getTrainingSession(worker.identity)?.status).toBe('stopped-pending');
		expect(getTrainingSession(nextWorker.identity)?.status).toBe('failed');
		expect($publicationPending.get()).toBeNull();
		expect(await db.get('model_results', [metadata.id, 1])).toBeUndefined();
		expect(workers.map(({ terminations }) => terminations)).toEqual([1, 1]);
	} finally {
		cleanup.restore();
	}
});

test('WML-P3-TRAIN-6: retry of a newer local stop repairs it after a superseded cancellation', async () => {
	seed();
	const run = service.start(1);
	const worker = await workerAt(0);
	const cleanup = blockFinishCleanup();
	try {
		worker.reply({ kind: 'cancelled', identity: worker.identity });
		expect(await run).toMatchObject({ ok: false, pending: 'cancel' });
		cleanup.allow();
		expect(await clearCheckpointFromAnotherTab('cancel')).toMatchObject({ ok: true });
		expect(await refreshTrainingSnapshot(guardedPersistence())).toMatchObject({ ok: true });
		const restart = service.start(1);
		const second = await workerAt(1);
		storage.denyRead = true;
		second.reply({ kind: 'failed', code: 'invalid-request', identity: second.identity });
		expect(await restart).toMatchObject({ ok: false, pending: 'recover', reason: 'security' });
		storage.denyRead = false;
		expect(await service.retry(second.identity)).toMatchObject({ ok: true });
		expect($appState.get().models[0]?.error?.details).toBe('invalid-request');
		expect(getTrainingSession(second.identity)?.status).toBe('failed');
		expect($publicationPending.get()).toBeNull();
		expect(await readTrainingCheckpoint(db)).toMatchObject({
			checkpoint: { generation: 4, pending: null }
		});
		expect(await db.get('model_results', [metadata.id, 1])).toBeUndefined();
		expect(workers.map(({ terminations }) => terminations)).toEqual([1, 1]);
	} finally {
		cleanup.restore();
	}
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

test('WML-P4-STATE-1: a stale preference write merges field by field with another tab and skips a newer run', async () => {
	seed();
	initPersister(storage, {
		trainingPersistence: {
			withStateLock: (operation) => locks.request(TRAINING_STATE_LOCK, operation)
		}
	});
	const savedModel = () =>
		(JSON.parse(storage.getItem(STATE_STORAGE_KEY)!) as PersistedAppState).models[0]!;
	const editStored = (change: (model: Record<string, unknown>) => void) => {
		const state = JSON.parse(storage.getItem(STATE_STORAGE_KEY)!);
		change(state.models[0]);
		MemoryStorage.prototype.setItem.call(storage, STATE_STORAGE_KEY, JSON.stringify(state));
	};
	try {
		const run = service.start(1);
		const worker = await workerAt(0);
		worker.succeed();
		expect(await run).toMatchObject({ ok: true });
		const { resultRevision } = savedModel();

		// Another tab saved a different preference of the same run; this tab edits another field.
		editStored((model) => {
			(model.ui as Record<string, unknown>).results = { moreMetricsOpen: true };
		});
		expect(setModelResultsUi(1, { thresholdIndex: 70 })).toBe(true);
		flushNow();
		await locks.request(TRAINING_STATE_LOCK, () => {});
		expect(savedModel().resultRevision).toBe(resultRevision);
		expect(savedModel().ui.results).toEqual({ moreMetricsOpen: true, thresholdIndex: 70 });

		// Another tab already owns a newer run; this tab's stale preference must not land on it.
		editStored((model) => {
			model.resultRevision = 'newer-run';
			(model.ui as Record<string, unknown>).results = { thresholdIndex: 10 };
		});
		expect(setModelResultsUi(1, { thresholdIndex: 90 })).toBe(true);
		flushNow();
		await locks.request(TRAINING_STATE_LOCK, () => {});
		expect(savedModel().resultRevision).toBe('newer-run');
		expect(savedModel().ui.results).toEqual({ thresholdIndex: 10 });
	} finally {
		stopPersister();
		await locks.request(TRAINING_STATE_LOCK, () => {});
	}
});
