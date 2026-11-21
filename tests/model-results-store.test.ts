import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { openSamataDb } from '../src/common/storage/db';
import { $appState } from '../src/stores/app.store';
import {
	$modelResults,
	loadModelResults,
	retryModelResults
} from '../src/stores/model-results.store';
import { getTrainingConfigurationKey } from '../src/features/models/training/training-service';
import {
	DEFAULT_ONE_SHOT_SETUP,
	INITIAL_APP_STATE,
	type ModelRecord,
	type PersistedAppState
} from '../src/types/state';
import { installFakeIndexedDB } from './helpers/fake-indexeddb';
import { fixtureLegacyTrainingResult, fixtureTrainingResult } from './fixtures/training/results';

const ROW_COUNT = 40;

function trainedModel(overrides: Partial<ModelRecord> = {}): ModelRecord {
	return {
		num: 1,
		createdAt: 10,
		status: 'trained',
		completedSteps: ['choose-model', 'select-features', 'configure-model', 'train'],
		modelId: 'gaussian-nb',
		features: ['measurement'],
		modelOptions: {},
		hyperparameters: { mode: 'manual', values: {} },
		multiclass: null,
		trainingSetup: DEFAULT_ONE_SHOT_SETUP,
		progress: null,
		resultRevision: 'saved-attempt',
		error: null,
		timings: null,
		durationMs: 250,
		metrics: null,
		ui: {},
		...overrides
	} as ModelRecord;
}

function stateWith(model: ModelRecord, datasetId = 'iris-fixture'): PersistedAppState {
	return {
		...INITIAL_APP_STATE,
		dataset: {
			id: datasetId,
			name: datasetId,
			source: 'upload',
			rowCount: ROW_COUNT,
			columns: []
		},
		target: 'species',
		models: [model],
		nextModelNum: 2
	} as PersistedAppState;
}

const configurationKey = getTrainingConfigurationKey(trainedModel(), ROW_COUNT)!;

async function save(row: object): Promise<void> {
	const db = await openSamataDb();
	try {
		await db.put('model_results', {
			...row,
			configurationKey,
			datasetId: 'iris-fixture',
			modelNum: 1
		} as never);
	} finally {
		db.close();
	}
}

let restore: (() => void) | undefined;

beforeEach(() => {
	restore = installFakeIndexedDB();
	$modelResults.set({});
	$appState.set(stateWith(trainedModel()));
});

afterEach(() => {
	restore?.();
	$modelResults.set({});
	$appState.set({ ...INITIAL_APP_STATE });
});

describe('model results store', () => {
	test('WML-P4-STATE-2: loading moves idle to loading to ready', async () => {
		await save(fixtureTrainingResult());
		expect($modelResults.get()[1]).toBeUndefined();
		const pending = loadModelResults(1);
		expect($modelResults.get()[1]?.status).toBe('loading');
		await pending;
		const entry = $modelResults.get()[1]!;
		expect(entry.status).toBe('ready');
		expect(entry.evaluation?.schemaVersion).toBe(1);
		expect(entry.identity).toMatchObject({
			modelNum: 1,
			runId: 'saved-attempt',
			configurationKey
		});
	});

	test('WML-P4-STATE-2: a valid Phase 3 result is legacy and a missing row is lost', async () => {
		await save(fixtureLegacyTrainingResult());
		await loadModelResults(1);
		expect($modelResults.get()[1]).toMatchObject({ status: 'legacy', evaluation: null });

		$modelResults.set({});
		const db = await openSamataDb();
		await db.delete('model_results', ['iris-fixture', 1]);
		db.close();
		await loadModelResults(1);
		expect($modelResults.get()[1]).toMatchObject({ status: 'lost', evaluation: null });
	});

	test('WML-P4-STATE-2: a mismatched stored run is lost, not shown', async () => {
		await save({ ...fixtureTrainingResult(), runId: 'another-attempt' });
		await loadModelResults(1);
		expect($modelResults.get()[1]?.status).toBe('lost');
	});

	test('WML-P4-STATE-2: loading is idempotent and reuses terminal entries', async () => {
		await save(fixtureTrainingResult());
		const first = loadModelResults(1);
		const loading = $modelResults.get()[1];
		const second = loadModelResults(1);
		expect($modelResults.get()[1]).toBe(loading);
		await Promise.all([first, second]);
		const ready = $modelResults.get()[1];
		await loadModelResults(1);
		expect($modelResults.get()[1]).toBe(ready);
	});

	test('WML-P4-STATE-2: an access failure is an error and retry replaces it', async () => {
		restore?.();
		restore = undefined;
		const original = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
		Object.defineProperty(globalThis, 'indexedDB', {
			configurable: true,
			value: {
				open() {
					throw new Error('storage denied');
				}
			}
		});
		await loadModelResults(1);
		const failed = $modelResults.get()[1]!;
		expect(failed.status).toBe('error');
		expect(failed.error).not.toContain('denied');
		await loadModelResults(1);
		expect($modelResults.get()[1]).toBe(failed);

		if (original) Object.defineProperty(globalThis, 'indexedDB', original);
		else Reflect.deleteProperty(globalThis, 'indexedDB');
		restore = installFakeIndexedDB();
		await save(fixtureTrainingResult());
		await retryModelResults(1);
		expect($modelResults.get()[1]).toMatchObject({ status: 'ready', error: '' });
	});

	test('WML-P4-STATE-2: a superseded run, even with a reused model number, is ignored', async () => {
		await save(fixtureTrainingResult());
		const pending = loadModelResults(1);
		$appState.set(stateWith(trainedModel({ createdAt: 11, resultRevision: 'newer-attempt' })));
		await pending;
		expect($modelResults.get()[1]).toBeUndefined();
	});

	test('WML-P4-STATE-2: a changed dataset clears the cache and ignores the late read', async () => {
		await save(fixtureTrainingResult());
		await loadModelResults(1);
		expect($modelResults.get()[1]?.status).toBe('ready');
		$appState.set(stateWith(trainedModel(), 'another-dataset'));
		expect($modelResults.get()[1]).toBeUndefined();
	});

	test('WML-P4-STATE-2: an untrained model has no entry', async () => {
		$appState.set(stateWith(trainedModel({ status: 'draft', resultRevision: null })));
		await loadModelResults(1);
		expect($modelResults.get()[1]).toBeUndefined();
	});
});
