import { expect, test, type Page } from '@playwright/test';
import { workerUrl } from './fixtures/release-assets';
import type { TrainingRunIdentity } from '../src/types/model-result';
import type {
	TrainingStartRequest,
	TrainingWorkerReply
} from '../src/features/models/training/protocol';
import type { ClassifierId } from '../src/features/models/model-catalogue';
import { configureDraft } from './fixtures/training/browser';
import type { StoredEvaluation } from '../src/types/model-evaluation';
import { dismissWelcomeModal, loadSampleDataset } from './journeys/helpers';
import { DIST_URL } from '../scripts/ports';
import { waitForPublishedPreview } from './helpers/dataset-ready';

const holdout = { type: 'one_shot', testRatio: 0.2, randomState: 42 } as const;
const crossValidation = {
	type: 'nested_cv',
	outerFolds: 3,
	innerFolds: 3,
	randomState: 42
} as const;
const classifiers = [
	'bernoulli-nb',
	'decision-tree-classifier',
	'gaussian-nb',
	'k-neighbors-classifier',
	'logistic-regression',
	'mlp-classifier',
	'multinomial-nb',
	'support-vector-classifier'
] as const satisfies readonly ClassifierId[];
const rows = Array.from({ length: 60 }, (_, index) => {
	const high = index % 2 === 0;
	return [
		index + (high ? 80 : 1),
		(index % 7) + (high ? 12 : 1),
		index % 3 ? 'sand' : 'stone',
		high ? 'high' : 'low'
	] as const;
});

async function upload(
	page: Page,
	data: readonly (readonly (string | number)[])[]
): Promise<string> {
	await page.goto('/data');
	await dismissWelcomeModal(page);
	const change = page.getByRole('button', { name: 'Change Dataset' });
	if (await change.isVisible()) {
		await change.click();
		await page
			.getByRole('dialog', { name: 'Change Dataset' })
			.getByRole('button', { name: 'Change Dataset' })
			.click();
	}
	await page.getByRole('button', { name: 'Upload Dataset' }).click();
	await page.locator('app-upload-dataset-dialog input[type="file"]').setInputFiles({
		name: 'training-fixture.csv',
		mimeType: 'text/csv',
		buffer: Buffer.from(
			['first,second,habitat,label', ...data.map((row) => row.join(','))].join('\n')
		)
	});
	await waitForPublishedPreview(page);
	return page.evaluate(() => window.__appState!.get().dataset!.id);
}

async function run(
	page: Page,
	datasetId: string,
	classifier: TrainingStartRequest['classifier'],
	setup: TrainingStartRequest['setup'],
	features = ['first', 'second'],
	target = 'label'
) {
	const identity: TrainingRunIdentity = {
		datasetId,
		target,
		modelNum: 1,
		modelCreatedAt: 1,
		configurationKey: 'real-worker-fixture',
		runId: crypto.randomUUID()
	};
	const request: TrainingStartRequest = { kind: 'start', identity, classifier, setup, features };
	const trainingWorkerUrl = await workerUrl(page, 'training');
	return page
		.evaluate(
			async ({ request, trainingWorkerUrl }) => {
				const replies = await new Promise<TrainingWorkerReply[]>((resolve, reject) => {
					const worker = new Worker(trainingWorkerUrl, { type: 'module' });
					const events: TrainingWorkerReply[] = [];
					const timer = window.setTimeout(() => {
						worker.terminate();
						reject(new Error('Training worker did not reach a terminal state'));
					}, 25_000);
					worker.onerror = (error) => {
						clearTimeout(timer);
						worker.terminate();
						reject(new Error(error.message));
					};
					worker.onmessage = ({ data }: MessageEvent<TrainingWorkerReply>) => {
						events.push(data);
						if (data.kind === 'progress') return;
						clearTimeout(timer);
						worker.terminate();
						resolve(events);
					};
					worker.postMessage(request);
				});
				// Transfer typed arrays between the browser worker and page unchanged. The structured
				// clone representation below is only for Playwright's Node-side assertions.
				return JSON.stringify(replies, (_key, value: unknown) =>
					ArrayBuffer.isView(value) ? Array.from(value as Uint32Array) : value
				);
			},
			{ request, trainingWorkerUrl }
		)
		.then((value) => JSON.parse(value) as TrainingWorkerReply[]);
}

test.describe('Deployed Chromium classification worker', () => {
	test.use({ baseURL: DIST_URL });
	test.skip(
		({ browserName }) => browserName !== 'chromium',
		'Full classifier matrix runs in Chromium'
	);

	for (const algorithm of classifiers) {
		test(`${algorithm} completes stratified One-Shot and fixed three-fold CV`, async ({
			page
		}) => {
			const datasetId = await upload(page, rows);
			const oneShot = (await run(page, datasetId, { algorithm, options: {} }, holdout)).at(
				-1
			);
			expect(oneShot?.kind === 'success' ? oneShot.result.strategy : oneShot).toBe(
				'one_shot'
			);
			if (oneShot?.kind !== 'success' || oneShot.result.strategy !== 'one_shot') return;
			expect(oneShot.result.preprocessorJson.version).toBe(2);
			const { testIndices, trainIndices } = oneShot.result.holdout;
			const report = oneShot.result.evaluation.partitions[0]!.test;
			expect(trainIndices.length).toBe(48);
			expect(testIndices.length).toBe(12);
			expect(new Set([...trainIndices, ...testIndices]).size).toBe(60);
			expect(report.sampleCount).toBe(testIndices.length);
			expect([...report.confusionMatrix].reduce((sum, value) => sum + value, 0)).toBe(12);
			expect([...report.support]).toEqual([6, 6]);

			const events = await run(page, datasetId, { algorithm, options: {} }, crossValidation);
			const cv = events.at(-1);
			expect(cv?.kind === 'success' ? cv.result.strategy : cv).toBe('cross_validation');
			if (cv?.kind !== 'success' || cv.result.strategy !== 'cross_validation') return;
			expect(cv.result.preprocessorJson.version).toBe(2);
			expect(cv.result.crossValidation.folds).toHaveLength(3);
			expect(cv.result.crossValidation.diagnostics.sampleCount).toBe(60);
			const validated = cv.result.crossValidation.folds.flatMap((fold) => [
				...fold.validationIndices
			]);
			expect(validated).toHaveLength(60);
			expect(new Set(validated).size).toBe(60);
			expect(
				events.some(
					(event) => event.kind === 'progress' && event.note?.key === 'refit-complete'
				)
			).toBe(true);
			expect(cv.result.modelJson).toBeTruthy();
		});
	}

	test('WML-P4-EVAL-5: Iris five-fold Logistic Regression persists five partitions and probabilities', async ({
		page
	}) => {
		await page.goto('/data');
		await loadSampleDataset(page, 'iris');
		const datasetId = await page.evaluate(() => window.__appState!.get().dataset!.id);
		const features = ['sepal length', 'sepal width', 'petal length', 'petal width'];
		const fiveFold = {
			type: 'nested_cv',
			outerFolds: 5,
			innerFolds: 5,
			randomState: 42
		} as const;
		const final = (
			await run(
				page,
				datasetId,
				{ algorithm: 'logistic-regression', options: {} },
				fiveFold,
				features,
				'class'
			)
		).at(-1);
		expect(final?.kind).toBe('success');
		if (final?.kind !== 'success' || final.result.strategy !== 'cross_validation') return;
		const { evaluation, crossValidation, modelJson, preprocessorJson } = final.result;
		expect(evaluation.protocol).toEqual({
			kind: 'cross_validation',
			folds: 5,
			randomState: 42
		});
		expect(evaluation.partitions).toHaveLength(5);
		expect(crossValidation.folds).toHaveLength(5);
		expect(evaluation.classLabels).toHaveLength(3);
		expect(evaluation.positiveClassIndex).toBeNull();
		expect(evaluation.outputs.probabilities).not.toBeNull();
		expect(evaluation.outputs.probabilitySource).toBe('native');
		expect(evaluation.curves.thresholdSweep).toBeNull();
		expect(evaluation.curves.ranking).toHaveLength(3);
		expect(evaluation.outputs.sourceRowIndex).toHaveLength(150);
		expect(evaluation.partitionFingerprint).toMatch(/^[0-9a-f]{64}$/);
		expect(modelJson).toBeTruthy();
		expect(preprocessorJson.columns).toHaveLength(4);
	});

	test('WML-P4-EVAL-5: breast-cancer One-Shot persists one partition; only SVC lacks probabilities', async ({
		page
	}) => {
		await page.goto('/data');
		await loadSampleDataset(page, 'breast-cancer-wisconsin');
		const datasetId = await page.evaluate(() => window.__appState!.get().dataset!.id);
		const features = ['radius1', 'texture1'];
		const outcomes = [] as { algorithm: string; evaluation: StoredEvaluation }[];
		for (const algorithm of ['gaussian-nb', 'support-vector-classifier'] as const) {
			const final = (
				await run(
					page,
					datasetId,
					{ algorithm, options: {} },
					holdout,
					features,
					'Diagnosis'
				)
			).at(-1);
			expect(final?.kind).toBe('success');
			if (final?.kind !== 'success' || final.result.strategy !== 'one_shot') return;
			outcomes.push({ algorithm, evaluation: final.result.evaluation });
			expect(final.result.evaluation.partitions).toHaveLength(1);
			expect(final.result.evaluation.positiveClassIndex).toBe(1);
			expect(final.result.holdout).not.toHaveProperty('report');
			expect(final.result.modelJson).toBeTruthy();
		}
		const [bayes, svc] = outcomes;
		expect(bayes!.evaluation.outputs.probabilities).not.toBeNull();
		expect(bayes!.evaluation.curves.thresholdSweep?.thresholds).toHaveLength(101);
		expect(bayes!.evaluation.curves.calibration).not.toBeNull();
		expect(svc!.evaluation.outputs.probabilities).toBeNull();
		expect(svc!.evaluation.outputs.probabilitySource).toBeNull();
		expect(svc!.evaluation.curves.thresholdSweep).toBeNull();
		expect(svc!.evaluation.curves.calibration).toBeNull();
		expect(svc!.evaluation.outputs.rankingScoreSource).toBe('decision-function');
		expect(svc!.evaluation.curves.ranking?.[0]?.roc).not.toBeNull();
		expect(svc!.evaluation.pooled.test.logLoss).toEqual({
			available: false,
			reason: 'probabilities-unavailable'
		});
		expect(svc!.evaluation.pooled.test.rocAuc.available).toBe(true);
	});

	test('rejects an infeasible partition and an out-of-domain Multinomial NB fit with safe reasons', async ({
		page
	}) => {
		const infeasible = await upload(
			page,
			rows.map((row, index) => [...row.slice(0, 3), index === 0 ? 'high' : 'low'])
		);
		const partition = (
			await run(page, infeasible, { algorithm: 'gaussian-nb', options: {} }, holdout)
		).at(-1);
		expect(partition).toMatchObject({ kind: 'failed', code: 'invalid-request' });

		const outOfDomain = await upload(
			page,
			rows.map(([first, ...rest]) => [-Number(first), ...rest])
		);
		const domain = (
			await run(page, outOfDomain, { algorithm: 'multinomial-nb', options: {} }, holdout)
		).at(-1);
		expect(domain).toMatchObject({
			kind: 'failed',
			code: expect.stringMatching(/^(invalid-request|numerical-failure)$/)
		});
		expect(Object.keys(domain!).sort()).toEqual(['code', 'identity', 'kind']);
	});

	test('keeps a validation-only category and outlier out of the fitted preprocessing', async ({
		page
	}) => {
		const datasetId = await upload(page, rows);
		const classifier = { algorithm: 'gaussian-nb', options: {} } as const;
		const first = (await run(page, datasetId, classifier, holdout, ['first', 'habitat'])).at(
			-1
		);
		expect(first?.kind).toBe('success');
		if (first?.kind !== 'success' || first.result.strategy !== 'one_shot') return;
		const validationRow = first.result.sourceRowIndices[first.result.holdout.testIndices[0]!]!;
		const updated = rows.map((row, index) =>
			index === validationRow ? [1_000_000, row[1], 'validation-only', row[3]] : row
		);
		const secondDatasetId = await upload(page, updated);
		const second = (
			await run(page, secondDatasetId, classifier, holdout, ['first', 'habitat'])
		).at(-1);
		expect(second?.kind).toBe('success');
		if (second?.kind !== 'success' || second.result.strategy !== 'one_shot') return;
		expect(second.result.holdout.testIndices).toEqual(first.result.holdout.testIndices);
		expect(second.result.preprocessorJson).toEqual(first.result.preprocessorJson);
		expect(second.result.featureNamesOut.join(' ')).not.toContain('validation-only');
	});

	test('an authoritative holdout partition rejection can reopen Training Setup from the stopped panel', async ({
		page
	}) => {
		const labels = ['cedar', 'maple', 'beech', 'ash'];
		await upload(
			page,
			rows
				.slice(0, 15)
				.map((row, index) => [...row.slice(0, 3), labels[index % labels.length]!])
		);
		await page.locator('app-sidebar a[href="/target"]').click();
		await page.getByRole('button', { name: 'Set as Target: label' }).click();
		await page.locator('app-target-view header a[href="/models"]').click();
		const setup = await configureDraft(page, 1);
		await setup.getByRole('button', { name: 'Train Model' }).click();
		const stopped = page.getByTestId('training-step');
		await expect(stopped.getByRole('heading', { name: '5. Training Stopped' })).toBeVisible();
		await expect(stopped.getByText(/The training library rejected this setup/)).toBeVisible();
		await stopped.getByRole('button', { name: 'Edit Training Setup' }).click();
		await expect(setup.getByRole('button', { name: 'Train Model' })).toBeEnabled();
		const model = await page.evaluate(() => window.__appState!.get().models[0]);
		expect(model).toMatchObject({
			status: 'draft',
			resultRevision: null,
			error: { code: 'TRAINING_FAILED', details: 'invalid-request' }
		});
	});
});
