import { afterEach, beforeEach, expect, test } from 'bun:test';
import { openSamataDb, TRAINING_DOMAIN_KEY } from '../src/common/storage/db';
import { readModelResult } from '../src/features/models/training/result-repository';
import { decodeResultEnvelope } from '../src/features/models/training/result-validation';
import {
	fixtureLegacyTrainingResult,
	fixtureTrainingResult,
	resultIdentity
} from './fixtures/training/results';
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
		expect(stored?.schemaVersion).toBe(2);
		if (stored?.schemaVersion === 2) {
			expect(stored.evaluation.classLabels).toEqual([true, false]);
			expect(stored.evaluation.partitions).toHaveLength(strategy === 'one_shot' ? 1 : 2);
			expect(stored.evaluation.pooled.test.logLoss).toEqual({
				available: false,
				reason: 'probabilities-unavailable'
			});
			if (stored.strategy === 'one_shot') expect(stored.holdout).not.toHaveProperty('report');
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

test.each(['one_shot', 'cross_validation'] as const)(
	'WML-P4-EVAL-6: a valid version 1 %s envelope stays readable without a migration',
	async (strategy) => {
		const seed = fixtureLegacyTrainingResult(strategy);
		await db.put('model_results', { ...seed });
		const stored = await readModelResult(db, seed.datasetId, seed.modelNum, resultIdentity);
		expect(stored).toEqual(seed);
		expect(stored?.schemaVersion).toBe(1);
		if (stored?.schemaVersion === 1 && stored.strategy === 'one_shot') {
			expect(stored.holdout.report.labels).toEqual([false, true]);
		} else if (stored?.strategy === 'cross_validation') {
			expect(stored.crossValidation.diagnostics.labels).toEqual([false, true]);
		}
		expect(
			(await db.get('model_results', [seed.datasetId, seed.modelNum]))?.schemaVersion
		).toBe(1);
	}
);

test('WML-P4-EVAL-6: rejects a version 2 envelope whose evaluation is missing or disagrees', () => {
	const legacy = fixtureLegacyTrainingResult();
	expect(decodeResultEnvelope({ ...legacy, schemaVersion: 2 })).toBeNull();
	for (const strategy of ['one_shot', 'cross_validation'] as const) {
		const seed = fixtureTrainingResult(strategy);
		expect(decodeResultEnvelope(seed)).not.toBeNull();
		const { evaluation, ...withoutEvaluation } = seed;
		expect(evaluation).toBeDefined();
		expect(decodeResultEnvelope(withoutEvaluation)).toBeNull();
		expect(
			decodeResultEnvelope({ ...seed, evaluation: { ...seed.evaluation, schemaVersion: 9 } })
		).toBeNull();
		// Class axis, strategy and evaluated rows must agree with the enclosing payload.
		expect(decodeResultEnvelope({ ...seed, classLabels: [false, true] })).toBeNull();
		const other = fixtureTrainingResult(
			strategy === 'one_shot' ? 'cross_validation' : 'one_shot'
		);
		expect(decodeResultEnvelope({ ...seed, evaluation: other.evaluation })).toBeNull();
		expect(
			decodeResultEnvelope({
				...seed,
				evaluation: {
					...seed.evaluation,
					outputs: {
						...seed.evaluation.outputs,
						sourceRowIndex: Uint32Array.from(
							seed.evaluation.outputs.sourceRowIndex,
							(row) => row + 1
						)
					}
				}
			})
		).toBeNull();
	}
	const oneShot = fixtureTrainingResult('one_shot');
	if (oneShot.strategy === 'one_shot') {
		expect(
			decodeResultEnvelope({
				...oneShot,
				holdout: {
					...oneShot.holdout,
					report: legacy.strategy === 'one_shot' ? legacy.holdout.report : {}
				}
			})
		).toBeNull();
	}
});

test('WML-P3-EVENT-2: rejects obsolete versions, mismatched shapes and legacy key-only records', async () => {
	const seed = fixtureLegacyTrainingResult();
	expect(decodeResultEnvelope({ ...seed, schemaVersion: 3 })).toBeNull();
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
