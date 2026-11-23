import { afterEach, beforeEach, expect, test } from 'bun:test';
import { openSamataDb, TRAINING_DOMAIN_KEY } from '../src/common/storage/db';
import {
	clearPendingTrainingCheckpoint,
	commitTrainingCheckpoint,
	decodeTrainingCheckpoint,
	readTrainingCheckpoint,
	type PendingTrainingDomain,
	type ProtectedDomainSnapshot
} from '../src/common/storage/training-domain';
import { $appState } from '../src/stores/app.store';
import {
	commitProtectedTrainingChange,
	MemoryStorage,
	readAppSnapshot,
	retryTrainingPublication,
	type TrainingPersistenceOptions
} from '../src/stores/persister';
import {
	DEFAULT_ONE_SHOT_SETUP,
	INITIAL_APP_STATE,
	SCROLL_STORAGE_KEY,
	STATE_STORAGE_KEY
} from '../src/types/state';
import { fixtureTrainingResult, resultIdentity } from './fixtures/training/results';
import { installFakeIndexedDB } from './helpers/fake-indexeddb';

const emptyDomain: ProtectedDomainSnapshot = {
	comparisonContextEpoch: 0,
	dataset: null,
	target: null,
	models: [],
	nextModelNum: 1,
	data: { mode: 'select', selectedColumn: null }
};

test('WML-P5-STATE-3: legacy pending snapshots default the context epoch and reject invalid epochs', () => {
	const { comparisonContextEpoch: _epoch, ...legacy } = emptyDomain;
	const wire = {
		kind: 'training-domain-checkpoint',
		schemaVersion: 1,
		datasetId: 'samata-ml:training-domain',
		modelNum: 0,
		generation: 1,
		pending: { operationId: 'legacy', kind: 'recover', domain: legacy }
	};
	const decoded = decodeTrainingCheckpoint(wire);
	expect(decoded.ok && decoded.checkpoint?.pending?.domain.comparisonContextEpoch).toBe(0);
	expect(
		decodeTrainingCheckpoint({
			...wire,
			pending: { ...wire.pending, domain: { ...legacy, comparisonContextEpoch: -1 } }
		})
	).toMatchObject({ ok: false });
});
const dataset = {
	id: resultIdentity.datasetId,
	name: 'Fixture',
	source: 'upload',
	rowCount: 6,
	columns: [{ name: 'species', type: 'categorical', missingCount: 0 }]
} as const;

function trained(): ProtectedDomainSnapshot {
	return {
		comparisonContextEpoch: 0,
		dataset: { ...dataset, columns: [...dataset.columns] },
		target: resultIdentity.target,
		nextModelNum: 2,
		data: { mode: 'preview', selectedColumn: null },
		models: [
			{
				num: 1,
				createdAt: resultIdentity.modelCreatedAt,
				status: 'trained',
				completedSteps: [
					'choose-model',
					'select-features',
					'configure-model',
					'configure-training',
					'training'
				],
				modelId: 'gaussian-nb',
				features: ['measurement'],
				modelOptions: {},
				hyperparameters: { mode: 'manual', values: {} },
				multiclass: 'native',
				trainingSetup: DEFAULT_ONE_SHOT_SETUP,
				progress: null,
				resultRevision: resultIdentity.runId,
				error: null,
				timings: null,
				durationMs: 250.5,
				metrics: null,
				ui: { trainingLogOpen: false }
			}
		]
	};
}

const replace: PendingTrainingDomain = {
	operationId: 'replace-1',
	kind: 'replace',
	domain: emptyDomain
};
const finish = (): PendingTrainingDomain => ({
	operationId: 'finish-1',
	kind: 'finish',
	domain: trained()
});
let db: Awaited<ReturnType<typeof openSamataDb>>;
let restoreIDB: () => void;

beforeEach(async () => {
	restoreIDB = installFakeIndexedDB();
	db = await openSamataDb();
	$appState.set(INITIAL_APP_STATE);
});

afterEach(() => {
	db.close();
	restoreIDB();
});

class FailingStorage extends MemoryStorage {
	readError: DOMException | null = null;
	writeError: DOMException | null = null;
	rejectWrites = 0;
	stateWriteCount = 0;
	scrollPurges = 0;

	override getItem(key: string): string | null {
		if (key === STATE_STORAGE_KEY && this.readError) throw this.readError;
		return super.getItem(key);
	}

	override setItem(key: string, value: string): void {
		if (key === STATE_STORAGE_KEY) {
			this.stateWriteCount++;
			if (this.writeError && this.rejectWrites > 0) {
				this.rejectWrites--;
				throw this.writeError;
			}
		}
		super.setItem(key, value);
	}

	override removeItem(key: string): void {
		if (key === SCROLL_STORAGE_KEY) this.scrollPurges++;
		super.removeItem(key);
	}
}

function options(storage: MemoryStorage): TrainingPersistenceOptions {
	return { storage, withStateLock: (operation) => operation() };
}

test('WML-P3-EVENT-4: atomically inserts the result and keeps the fence after clearing pending', async () => {
	const result = fixtureTrainingResult();
	expect(
		await commitTrainingCheckpoint(db, 0, finish(), { type: 'insert-result', result })
	).toMatchObject({
		ok: true,
		checkpoint: { generation: 1, pending: { operationId: 'finish-1' } }
	});
	expect(await db.get('model_results', [result.datasetId, result.modelNum])).toEqual({
		...result
	});
	expect(await clearPendingTrainingCheckpoint(db, 1, 'different-operation')).toEqual({
		ok: false,
		reason: 'conflict'
	});
	expect(await clearPendingTrainingCheckpoint(db, 1, 'finish-1')).toEqual({
		ok: true,
		generation: 1
	});
	expect(await readTrainingCheckpoint(db)).toMatchObject({
		ok: true,
		checkpoint: { generation: 1, pending: null }
	});
	expect(await commitTrainingCheckpoint(db, 0, replace, { type: 'none' })).toEqual({
		ok: false,
		reason: 'conflict'
	});
});

test('WML-P3-EVENT-4: aborts a result write and a destructive deletion when the checkpoint cannot be written', async () => {
	const result = fixtureTrainingResult();
	const rawPut = IDBObjectStore.prototype.put;
	IDBObjectStore.prototype.put = function (value: unknown, key?: IDBValidKey) {
		if (
			typeof value === 'object' &&
			value !== null &&
			'kind' in value &&
			value.kind === 'training-domain-checkpoint'
		) {
			throw new DOMException('Test quota', 'QuotaExceededError');
		}
		return rawPut.call(this, value, key);
	};
	try {
		expect(
			await commitTrainingCheckpoint(db, 0, finish(), { type: 'insert-result', result })
		).toEqual({ ok: false, reason: 'quota' });
		expect(await db.get('model_results', [result.datasetId, result.modelNum])).toBeUndefined();
		expect(await db.get('model_results', TRAINING_DOMAIN_KEY)).toBeUndefined();
		await db.put('model_results', { ...result });
		await db.put('raw_records', { datasetId: result.datasetId, rowIndex: 0, values: [0] });
		expect(
			await commitTrainingCheckpoint(db, 0, replace, {
				type: 'delete-dataset',
				datasetId: result.datasetId
			})
		).toEqual({ ok: false, reason: 'quota' });
		expect(await db.get('raw_records', [result.datasetId, 0])).toBeDefined();
		expect(await db.get('model_results', [result.datasetId, result.modelNum])).toEqual({
			...result
		});
		expect(await db.get('model_results', TRAINING_DOMAIN_KEY)).toBeUndefined();
	} finally {
		IDBObjectStore.prototype.put = rawPut;
	}
});

test('WML-P3-EVENT-4: commits captured deletion with its candidate and checks replacement metadata', async () => {
	const result = fixtureTrainingResult();
	await db.put('model_results', { ...result });
	await db.put('raw_records', { datasetId: result.datasetId, rowIndex: 0, values: [0] });
	expect(
		await commitTrainingCheckpoint(
			db,
			0,
			{ ...replace, domain: trained() },
			{
				type: 'publish-replacement',
				datasetId: result.datasetId
			}
		)
	).toEqual({ ok: false, reason: 'conflict' });
	expect(
		await commitTrainingCheckpoint(db, 0, replace, {
			type: 'delete-dataset',
			datasetId: result.datasetId
		})
	).toMatchObject({ ok: true, checkpoint: { generation: 1 } });
	expect(await db.get('model_results', [result.datasetId, result.modelNum])).toBeUndefined();
	expect(await db.get('raw_records', [result.datasetId, 0])).toBeUndefined();
	expect(await readTrainingCheckpoint(db)).toMatchObject({
		ok: true,
		checkpoint: { generation: 1, pending: replace }
	});
});

test('WML-P3-EVENT-3: future checkpoints fail closed and absent wire generations decode to zero', async () => {
	const storage = new MemoryStorage();
	const { trainingDomainGeneration: _generation, ...historic } = INITIAL_APP_STATE;
	storage.setItem(STATE_STORAGE_KEY, JSON.stringify(historic));
	expect(readAppSnapshot(storage)).toMatchObject({
		ok: true,
		state: { trainingDomainGeneration: 0 }
	});
	expect(decodeTrainingCheckpoint({ schemaVersion: 2 })).toEqual({
		ok: false,
		reason: 'read-only'
	});
	await db.put('model_results', {
		kind: 'training-domain-checkpoint',
		schemaVersion: 2,
		datasetId: TRAINING_DOMAIN_KEY[0],
		modelNum: 0,
		generation: 7,
		pending: null
	});
	expect(await commitTrainingCheckpoint(db, 7, replace, { type: 'none' })).toEqual({
		ok: false,
		reason: 'read-only'
	});
	expect(await readTrainingCheckpoint(db)).toEqual({ ok: false, reason: 'read-only' });
});

test('WML-P3-EVENT-3: upgrades historical progress and preserves the draft and v1 setup', () => {
	const storage = new MemoryStorage();
	const domain = trained();
	const { resultRevision: _revision, ...model } = domain.models[0]!;
	storage.setItem(
		STATE_STORAGE_KEY,
		JSON.stringify({
			...INITIAL_APP_STATE,
			...domain,
			models: [
				{
					...model,
					status: 'draft',
					trainingSetup: { type: 'k_fold_cv', folds: 3 },
					progress: {
						percent: 45,
						currentFold: 1,
						totalFolds: 3,
						statusMessage: 'Training...'
					},
					ui: { otherChoice: 'kept', trainingLogOpen: 'invalid' }
				}
			]
		})
	);
	const decoded = readAppSnapshot(storage);
	expect(decoded).toMatchObject({
		ok: true,
		state: {
			models: [
				{
					status: 'draft',
					resultRevision: null,
					trainingSetup: {
						type: 'nested_cv',
						outerFolds: 3,
						innerFolds: 3,
						randomState: 42
					},
					progress: {
						percent: 45,
						stage: 'cross-validation',
						phase: null,
						statusMessage: 'Training...'
					},
					ui: { otherChoice: 'kept', trainingLogOpen: false }
				}
			]
		}
	});
});

test('WML-P3-EVENT-4: read failures and future snapshots prevent a protected mutation', async () => {
	const storage = new FailingStorage();
	storage.readError = new DOMException('Test security', 'SecurityError');
	const launch = () => ({ pending: replace, mutation: { type: 'none' as const } });
	expect(await commitProtectedTrainingChange(launch, options(storage))).toEqual({
		ok: false,
		reason: 'security'
	});
	expect(await readTrainingCheckpoint(db)).toEqual({ ok: true, checkpoint: null });
	storage.readError = null;
	const future = JSON.stringify({ ...INITIAL_APP_STATE, version: 99 });
	storage.setItem(STATE_STORAGE_KEY, future);
	expect(await commitProtectedTrainingChange(launch, options(storage))).toEqual({
		ok: false,
		reason: 'read-only'
	});
	expect(storage.getItem(STATE_STORAGE_KEY)).toBe(future);
	expect(await readTrainingCheckpoint(db)).toEqual({ ok: true, checkpoint: null });
	const closed = options(new MemoryStorage());
	closed.openDb = async () => {
		const handle = await openSamataDb();
		handle.close();
		return handle;
	};
	expect(await commitProtectedTrainingChange(launch, closed)).toEqual({
		ok: false,
		reason: 'unavailable'
	});
});

test('WML-P3-EVENT-4: preserves pending when localStorage fails and retries publication without repeating work', async () => {
	const storage = new FailingStorage();
	storage.writeError = new DOMException('Test security', 'SecurityError');
	storage.rejectWrites = 1;
	const result = fixtureTrainingResult();
	expect(
		await commitProtectedTrainingChange(
			() => ({
				pending: finish(),
				mutation: { type: 'insert-result', result }
			}),
			options(storage)
		)
	).toEqual({ ok: false, reason: 'security' });
	expect(storage.getItem(STATE_STORAGE_KEY)).toBeNull();
	expect($appState.get().models).toEqual([]);
	expect(await db.get('model_results', [result.datasetId, result.modelNum])).toBeDefined();
	expect(await readTrainingCheckpoint(db)).toMatchObject({
		ok: true,
		checkpoint: { generation: 1, pending: { operationId: 'finish-1' } }
	});
	expect(await retryTrainingPublication(options(storage))).toEqual({ ok: true, generation: 1 });
	expect($appState.get().models[0]?.resultRevision).toBe(result.runId);
	expect(storage.getItem(STATE_STORAGE_KEY)).not.toContain('logEntries');
	expect(await readTrainingCheckpoint(db)).toMatchObject({
		ok: true,
		checkpoint: { generation: 1, pending: null }
	});
	expect(await retryTrainingPublication(options(storage))).toEqual({ ok: true, generation: 1 });
	expect(storage.stateWriteCount).toBe(2);
});

test('WML-P5-STATE-3: replacement replay clears stale choices without advancing the captured epoch twice', async () => {
	const storage = new FailingStorage();
	const domain = trained();
	const owner = { datasetId: domain.dataset!.id, target: domain.target!, epoch: 0 };
	const original = {
		...INITIAL_APP_STATE,
		...domain,
		onboarding: { welcomeDismissed: true },
		results: {
			owner,
			ui: {
				...INITIAL_APP_STATE.results.ui,
				fingerprint: 'a'.repeat(64),
				selected: [1],
				ropeWidth: 0.02
			}
		}
	};
	storage.setItem(
		STATE_STORAGE_KEY,
		JSON.stringify({
			...original,
			models: original.models.map((model) => ({
				...model,
				trainingSetup: model.trainingSetup && {
					...model.trainingSetup,
					type: 'train_test_split'
				}
			}))
		})
	);
	storage.writeError = new DOMException('Test security', 'SecurityError');
	storage.rejectWrites = 1;
	const next = { ...domain, comparisonContextEpoch: 1 };
	expect(
		await commitProtectedTrainingChange(
			() => ({
				pending: { operationId: 'replace-context', kind: 'replace', domain: next },
				mutation: { type: 'none' }
			}),
			options(storage)
		)
	).toMatchObject({ ok: false, reason: 'security' });
	expect(await retryTrainingPublication(options(storage))).toEqual({ ok: true, generation: 1 });
	const saved = readAppSnapshot(storage);
	expect(saved.ok && saved.state).toMatchObject({
		comparisonContextEpoch: 1,
		onboarding: { welcomeDismissed: true },
		results: { owner: null, ui: { fingerprint: null, selected: [], ropeWidth: 0.01 } }
	});
	expect(await retryTrainingPublication(options(storage))).toEqual({ ok: true, generation: 1 });
	expect($appState.get().comparisonContextEpoch).toBe(1);
});

test('WML-P3-EVENT-4: retries quota once after purging only scroll data', async () => {
	const storage = new FailingStorage();
	storage.setItem(SCROLL_STORAGE_KEY, 'scroll');
	storage.setItem('unrelated', 'keep');
	storage.writeError = new DOMException('Test quota', 'QuotaExceededError');
	storage.rejectWrites = 3;
	expect(
		await commitProtectedTrainingChange(
			() => ({ pending: replace, mutation: { type: 'none' } }),
			options(storage)
		)
	).toEqual({ ok: false, reason: 'quota' });
	expect(storage.stateWriteCount).toBe(2);
	expect(storage.scrollPurges).toBe(1);
	expect(storage.getItem(SCROLL_STORAGE_KEY)).toBeNull();
	expect(storage.getItem('unrelated')).toBe('keep');
	expect(await retryTrainingPublication(options(storage))).toEqual({ ok: true, generation: 1 });
	expect(storage.stateWriteCount).toBe(4);
});
