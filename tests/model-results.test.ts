import { afterEach, beforeEach, expect, test } from 'bun:test';
import { openSamataDb, TRAINING_DOMAIN_KEY } from '../src/common/storage/db';
import { readModelResult } from '../src/features/models/training/result-repository';
import { decodeResultEnvelope } from '../src/features/models/training/result-validation';
import { fixtureTrainingResult, resultIdentity } from './fixtures/training/results';
import { installFakeIndexedDB } from './helpers/fake-indexeddb';

let db: Awaited<ReturnType<typeof openSamataDb>>;
let restore: () => void;
beforeEach(async () => {
	restore = installFakeIndexedDB();
	db = await openSamataDb();
});
afterEach(() => {
	db.close();
	restore();
});

test.each(['one_shot', 'cross_validation'] as const)(
	'WML-P3-EVENT-2: round-trips %s with its own label axes',
	async (strategy) => {
		const seed = fixtureTrainingResult(strategy);
		await db.put('model_results', { ...seed });
		const stored = await readModelResult(db, seed.datasetId, seed.modelNum, resultIdentity);
		expect(stored).toEqual(seed);
		expect(stored?.classLabels).toEqual([true, false]);
		if (stored?.strategy === 'one_shot') {
			expect(stored.holdout.report.labels).toEqual([false, true]);
			expect(stored.holdout.report.logLoss).toEqual({
				available: false,
				reason: 'probabilities-unavailable'
			});
		} else if (stored?.strategy === 'cross_validation') {
			expect(stored.crossValidation.diagnostics.labels).toEqual([false, true]);
		}
		expect(
			await readModelResult(db, seed.datasetId, seed.modelNum, {
				...resultIdentity,
				runId: 'stale'
			})
		).toBeNull();
		expect(
			await readModelResult(db, seed.datasetId, seed.modelNum, {
				...resultIdentity,
				modelCreatedAt: 20
			})
		).toBeNull();
	}
);

test('WML-P3-EVENT-2: rejects obsolete versions, mismatched shapes and legacy key-only records', async () => {
	const seed = fixtureTrainingResult();
	expect(decodeResultEnvelope({ ...seed, schemaVersion: 2 })).toBeNull();
	expect(decodeResultEnvelope({ ...seed, durationMs: NaN })).toBeNull();
	expect(decodeResultEnvelope({ ...seed, sourceRowIndices: [0, 0] })).toBeNull();
	expect(
		decodeResultEnvelope({
			...seed,
			preprocessorJson: { ...seed.preprocessorJson, columns: [] }
		})
	).toBeNull();
	expect(decodeResultEnvelope({ ...seed, modelJson: {} })).toBeNull();
	expect(decodeResultEnvelope({ ...seed, holdout: { report: {} } })).toBeNull();
	await db.put('model_results', { datasetId: seed.datasetId, modelNum: seed.modelNum });
	expect(await readModelResult(db, seed.datasetId, seed.modelNum)).toBeNull();
	expect(await readModelResult(db, ...TRAINING_DOMAIN_KEY)).toBeNull();
	db.close();
	await expect(readModelResult(db, seed.datasetId, seed.modelNum)).rejects.toBeDefined();
});
