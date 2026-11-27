import { expect, type Locator, type Page } from '@playwright/test';
import type { StoredEvaluation } from '../../src/types/model-evaluation';
import type { TrainingResultPayload } from '../../src/types/model-result';
import {
	breastCancerOneShot,
	divergentBinaryCrossValidation,
	irisCrossValidation,
	manyClasses,
	svcBinaryNoProbabilities
} from '../fixtures/results/evaluations';
import { withPooledConfusion } from '../fixtures/results/variants';
import { configureDraft, controlTraining, openSetup } from '../fixtures/training/browser';

/** Hand-written evaluations that can be saved as the result of a trained model. */
export type SeedName =
	| 'iris'
	| 'breast-cancer'
	| 'svc-no-probabilities'
	| 'many-classes'
	| 'divergent-binary-cv';

const evaluations: Record<SeedName, () => StoredEvaluation> = {
	iris: irisCrossValidation,
	'breast-cancer': breastCancerOneShot,
	'svc-no-probabilities': svcBinaryNoProbabilities,
	'many-classes': manyClasses,
	'divergent-binary-cv': divergentBinaryCrossValidation
};

async function selectEvaluationSetup(setup: Locator, evaluation: StoredEvaluation): Promise<void> {
	if (evaluation.protocol.kind !== 'cross_validation') return;
	await setup.getByRole('combobox', { name: 'Training Strategy' }).selectOption('nested_cv');
	const folds = setup.getByRole('spinbutton');
	await folds.fill(String(evaluation.protocol.folds));
	await folds.blur();
	await expect(folds).toHaveValue(String(evaluation.protocol.folds));
}

/**
 * Builds the worker success payload for a stored evaluation. The retained rows are every row
 * the evaluation covers plus, for One-Shot, the training rows, so the payload agrees with the
 * evaluation exactly as a real run does.
 */
export function payloadFor(evaluation: StoredEvaluation): TrainingResultPayload {
	const { outputs, partitions, pooled } = evaluation;
	const base = {
		webMlRevision: 'seeded-fixture',
		excludedTargetRows: 0,
		featureNamesOut: ['petal length'],
		classLabels: evaluation.classLabels,
		modelJson: { type: 'SeededFixture' },
		preprocessorJson: {
			version: 1 as const,
			standardize: false,
			columns: [{ name: 'petal length', kind: 'numeric' as const, mean: 0, scale: 1 }]
		},
		evaluation
	};
	if (evaluation.protocol.kind === 'one_shot') {
		const part = partitions[0]!;
		const total = part.trainSampleCount + part.testSampleCount;
		const sourceRowIndices = Array.from({ length: total }, (_, index) => index);
		const testIndices = Uint32Array.from(outputs.sourceRowIndex);
		const tested = new Set(testIndices);
		return {
			...base,
			sourceRowIndices,
			strategy: 'one_shot',
			holdout: {
				trainIndices: Uint32Array.from(
					sourceRowIndices.filter((index) => !tested.has(index))
				),
				testIndices
			}
		};
	}
	const report = pooled.test;
	const folds = partitions.map((part) => {
		const validationIndices = Uint32Array.from(
			Array.from(outputs.partitionIndex, (partition, row) => [partition, row] as const)
				.filter(([partition]) => partition === part.index)
				.map(([, row]) => row)
		);
		return {
			foldIndex: part.index,
			score: part.test.accuracy,
			durationMs: part.durationMs,
			validationSampleCount: validationIndices.length,
			validationIndices
		};
	});
	const meanScore = folds.reduce((sum, fold) => sum + fold.score, 0) / folds.length;
	// The fixture describes the full set of supplied folds, using population spread.
	const variance =
		folds.reduce((sum, fold) => sum + (fold.score - meanScore) ** 2, 0) / folds.length;
	const macroPrecision =
		report.precisionPerClass.reduce((sum, value) => sum + value, 0) /
		report.precisionPerClass.length;
	return {
		...base,
		sourceRowIndices: Array.from(outputs.sourceRowIndex),
		strategy: 'cross_validation',
		crossValidation: {
			folds,
			diagnostics: {
				task: 'classification' as const,
				sampleCount: outputs.sourceRowIndex.length,
				labels: evaluation.classLabels,
				confusionMatrix: report.confusionMatrix,
				support: report.support,
				predictedCount: report.predictedCount,
				accuracy: report.accuracy,
				precision: macroPrecision,
				recall: report.balancedAccuracy,
				f1: report.macroF1,
				precisionPerClass: report.precisionPerClass,
				recallPerClass: report.recallPerClass,
				f1PerClass: report.f1PerClass
			},
			meanScore,
			standardDeviation: Math.sqrt(variance)
		}
	} as TrainingResultPayload;
}

const TYPED = ['Uint16Array', 'Uint32Array', 'Float32Array', 'Float64Array'] as const;

function encode(payload: TrainingResultPayload): string {
	return JSON.stringify(payload, (_key, value: unknown) => {
		if (ArrayBuffer.isView(value)) {
			const name = value.constructor.name;
			if (!TYPED.includes(name as (typeof TYPED)[number]))
				throw new Error(`Unsupported ${name}`);
			return { __typed: name, data: Array.from(value as unknown as ArrayLike<number>) };
		}
		return value;
	});
}

/** Options for seeding one trained model. */
export interface SeedOptions {
	/** Click View Results so Section 6 is shown. Default true. */
	readonly acknowledge?: boolean;
}

/**
 * Trains Model 1 on the Iris draft through the ordinary UI with a controlled worker, then
 * replies with the chosen evaluation as its result. Storage, locks and publication are real.
 */
export async function seedTrainedModel(
	page: Page,
	name: SeedName,
	options: SeedOptions = {}
): Promise<void> {
	const evaluation = evaluations[name]();
	await controlTraining(page);
	const setup = await openSetup(page);
	await selectEvaluationSetup(setup, evaluation);
	await setup.getByRole('button', { name: 'Train Model' }).click();
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					window.__trainingFixture!.requests.filter(({ kind }) => kind === 'start').length
			)
		)
		.toBe(1);
	await replyWithEvaluation(page, name);
	const training = page.getByTestId('training-step');
	const viewResults = training.getByRole('button', { name: 'View Results' });
	await expect(viewResults).toBeEnabled({ timeout: 15_000 });
	if (options.acknowledge === false) return;
	await viewResults.click();
	await expect(page).toHaveURL('/models/1');
	await expect(page.getByRole('heading', { level: 1, name: /Results$/ })).toBeFocused();
}

/** Completes the currently owned worker attempt with a matching fixture evaluation. */
export async function replyWithEvaluation(page: Page, name: SeedName): Promise<void> {
	await page.evaluate(
		(json) => {
			const result = JSON.parse(json, (_key, value) => {
				if (value && typeof value === 'object' && '__typed' in value) {
					const constructors = { Uint16Array, Uint32Array, Float32Array, Float64Array };
					return constructors[value.__typed as keyof typeof constructors].from(
						value.data
					);
				}
				return value;
			});
			window.__trainingFixture!.reply({ kind: 'success', result });
		},
		encode(payloadFor(evaluations[name]()))
	);
}

/** Reads the stored result envelope of Model 1, or null when none exists. */
export function readEnvelope(page: Page): Promise<Record<string, unknown> | null> {
	return page.evaluate(async () => {
		const state = window.__appState!.get();
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open('samata-db');
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		try {
			return await new Promise<Record<string, unknown> | null>((resolve, reject) => {
				const get = db
					.transaction('model_results')
					.objectStore('model_results')
					.get([state.dataset!.id, 1]);
				get.onsuccess = () => resolve(get.result ?? null);
				get.onerror = () => reject(get.error);
			});
		} finally {
			db.close();
		}
	});
}

/** Publishes two matching evaluations through the ordinary durable training workflow. */
export async function seedComparablePair(
	page: Page,
	name: SeedName = 'iris',
	variant: 'same' | 'different-confusion' | 'different-group' = 'same'
): Promise<void> {
	await seedTrainedModel(page, name);
	let evaluation = evaluations[name]();
	if (variant === 'different-confusion') {
		evaluation = withPooledConfusion(evaluation, [49, 1, 0, 0, 45, 5, 0, 2, 48]);
	} else if (variant === 'different-group') {
		evaluation = { ...evaluation, partitionFingerprint: 'b'.repeat(64) };
	}
	await seedAdditionalModel(page, 2, evaluation);
}

async function seedAdditionalModel(
	page: Page,
	num: number,
	evaluation: StoredEvaluation
): Promise<void> {
	await page.locator('app-sidebar a[href="/models"]').click();
	const setup = await configureDraft(page, num);
	await selectEvaluationSetup(setup, evaluation);
	await setup.getByRole('button', { name: 'Train Model' }).click();
	await expect
		.poll(
			() =>
				page.evaluate(
					() =>
						window.__trainingFixture!.requests.filter(({ kind }) => kind === 'start')
							.length
				),
			{ timeout: 20_000 }
		)
		.toBe(num);
	await page.evaluate(
		({ json, modelNum }) => {
			const result = JSON.parse(json, (_key, value) => {
				if (value && typeof value === 'object' && '__typed' in value) {
					const constructors = { Uint16Array, Uint32Array, Float32Array, Float64Array };
					return constructors[value.__typed as keyof typeof constructors].from(
						value.data
					);
				}
				return value;
			});
			window.__trainingFixture!.reply({ kind: 'success', result }, modelNum);
		},
		{ json: encode(payloadFor(evaluation)), modelNum: num }
	);
	const viewResults = page
		.getByTestId('training-step')
		.getByRole('button', { name: 'View Results' });
	await expect(viewResults).toBeEnabled({ timeout: 15_000 });
	await viewResults.click();
}

/** Publishes two separately comparable groups with two models each. */
export async function seedComparableGroups(page: Page): Promise<void> {
	await seedComparablePair(page);
	const evaluation = { ...irisCrossValidation(), partitionFingerprint: 'b'.repeat(64) };
	await seedAdditionalModel(page, 3, evaluation);
	await seedAdditionalModel(page, 4, evaluation);
}

/** Publishes four comparable cross-validation models through the training workflow. */
export async function seedComparableFour(page: Page): Promise<void> {
	await seedComparablePair(page);
	const evaluation = irisCrossValidation();
	await seedAdditionalModel(page, 3, evaluation);
	await seedAdditionalModel(page, 4, evaluation);
}

/** Removes the stored result envelope of Model 1. */
export function deleteEnvelope(page: Page): Promise<void> {
	return page.evaluate(async () => {
		const state = window.__appState!.get();
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open('samata-db');
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		try {
			await new Promise<void>((resolve, reject) => {
				const transaction = db.transaction('model_results', 'readwrite');
				transaction.objectStore('model_results').delete([state.dataset!.id, 1]);
				transaction.oncomplete = () => resolve();
				transaction.onerror = () => reject(transaction.error);
			});
		} finally {
			db.close();
		}
	});
}

/** Rewrites the stored Model 1 envelope as a Phase 3 (version 1) result. Cross-validation only. */
export function downgradeEnvelope(page: Page): Promise<void> {
	return page.evaluate(async () => {
		const state = window.__appState!.get();
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open('samata-db');
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		try {
			await new Promise<void>((resolve, reject) => {
				const transaction = db.transaction('model_results', 'readwrite');
				const store = transaction.objectStore('model_results');
				const get = store.get([state.dataset!.id, 1]);
				get.onsuccess = () => {
					const { evaluation: _evaluation, ...rest } = get.result;
					store.put({ ...rest, schemaVersion: 1 });
				};
				transaction.oncomplete = () => resolve();
				transaction.onerror = () => reject(transaction.error);
			});
		} finally {
			db.close();
		}
	});
}

/**
 * Installs a hook on result reads for Model 1. After `after` reads succeed, the next read either
 * finds no envelope (as if it had been deleted in between) or fails. Call before View Results
 * to count its separate verification and acknowledgement reads.
 */
export function interceptResultReads(
	page: Page,
	mode: { readonly outcome: 'missing' | 'fail'; readonly after: number }
): Promise<void> {
	return page.evaluate((mode) => {
		const get = IDBObjectStore.prototype.get;
		let seen = 0;
		const isResultKey = (key: unknown) =>
			Array.isArray(key) && key[1] === 1 && key[0] !== 'samata-ml:training-domain';
		IDBObjectStore.prototype.get = function (key) {
			if (this.name === 'model_results' && isResultKey(key)) {
				seen += 1;
				if (seen === mode.after + 1) {
					if (mode.outcome === 'fail') {
						throw new DOMException('Fixture blocked result read', 'SecurityError');
					}
					return get.call(this, ['samata-ml:no-such-dataset', 1]);
				}
			}
			return get.call(this, key);
		};
	}, mode);
}
