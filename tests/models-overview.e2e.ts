import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];

test.describe('Models Overview (MOD-HUB-1, MOD-HUB-2)', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/data');
		// Dismiss welcome modal if open
		const getStartedBtn = page.locator('app-welcome-modal button.btn-primary');
		try {
			await getStartedBtn.waitFor({ state: 'visible', timeout: 2000 });
			await getStartedBtn.click();
			await page
				.locator('app-welcome-modal dialog')
				.waitFor({ state: 'hidden', timeout: 2000 });
		} catch {
			// Already dismissed
		}
	});

	test('WML-P2-UI-9 / MOD-HUB-1: overview guards, model links and persisted training setup summaries', async ({
		page
	}) => {
		// 1. Guard: No dataset loaded -> /models is blocked
		await page.goto('/models');
		const overview = page.locator('app-models-view');
		await expect(overview.locator('[data-testid="models-blocked"]')).toBeVisible();
		await expect(overview.locator('.notification-alert')).toContainText(
			'Load a dataset and choose a target'
		);
		await expect(overview.locator('.notification-alert a[href="/data"]')).toBeVisible();

		// Buttons disabled in blocked state
		await expect(overview.locator('button:has-text("Train New Model")')).toBeDisabled();
		await expect(overview.locator('button:has-text("Compare Results")')).toBeDisabled();

		// 2. Guard: Dataset loaded but target missing -> blocked for target
		await page.goto('/data');
		const irisCard = page.locator('app-dataset-card[dataset-id="iris"]');
		await irisCard.waitFor({ state: 'visible', timeout: 5000 });
		await irisCard.locator('button.btn-primary').click();
		await page.locator('app-dataset-preview').waitFor({ state: 'attached', timeout: 5000 });

		await page.goto('/models');
		await expect(overview.locator('[data-testid="models-blocked"]')).toBeVisible();
		await expect(overview.locator('.notification-alert')).toContainText(
			'Choose a target before training a model'
		);
		await expect(overview.locator('.notification-alert a[href="/target"]')).toBeVisible();
		await expect(overview.locator('button:has-text("Train New Model")')).toBeDisabled();

		// 3. Ready state: Set target
		await page.goto('/target');
		const targetView = page.locator('app-target-view');
		await expect(targetView.locator('[data-testid="target-ready"]')).toBeVisible({
			timeout: 10000
		});
		const classRow = targetView.locator('tbody tr:has(th:has-text("class"))');
		await classRow.locator('button').click();

		// Navigate to /models -> should show empty state
		await page.goto('/models');
		await expect(overview.locator('[data-testid="models-empty"]')).toBeVisible();
		await expect(overview.locator('.empty-message')).toContainText(
			'No models yet. Train a new model to get started.'
		);
		const trainNewBtn = overview.locator('button:has-text("Train New Model")');
		await expect(trainNewBtn).toBeEnabled();

		// 4. Create Model 1: click Train New Model -> navigates to /models/1
		await trainNewBtn.click();
		await expect(page).toHaveURL(/\/models\/1$/);

		// Return to /models overview
		await page.goto('/models');
		await expect(overview.locator('[data-testid="models-list"]')).toBeVisible();
		const table = overview.locator('table.table');
		await expect(table.locator('caption')).toContainText('Models for Iris');

		let rows = table.locator('tbody tr');
		await expect(rows).toHaveCount(1);
		await expect(rows.nth(0).locator('th[scope="row"]')).toHaveText('Model 1');
		await expect(rows.nth(0).locator('td').nth(0)).toHaveText('Not selected'); // Features
		await expect(rows.nth(0).locator('td').nth(1)).toHaveText('Not configured'); // Configuration
		await expect(rows.nth(0).locator('td').nth(2)).toHaveText('Not configured'); // Training Setup
		await expect(rows.nth(0).locator('td').nth(3)).toHaveText('Not trained'); // Duration
		const actionLink1 = rows.nth(0).locator('td').nth(4).locator('a');
		await expect(actionLink1).toHaveText('Continue');
		await expect(actionLink1).toHaveAttribute('href', '/models/1');

		// 5. Create Model 2: click Train New Model -> navigates to /models/2
		await overview.locator('button:has-text("Train New Model")').click();
		await expect(page).toHaveURL(/\/models\/2$/);

		// Return to /models overview
		await page.goto('/models');
		rows = table.locator('tbody tr');
		await expect(rows).toHaveCount(2);
		await expect(rows.nth(0).locator('th[scope="row"]')).toHaveText('Model 1');
		await expect(rows.nth(1).locator('th[scope="row"]')).toHaveText('Model 2');
		const actionLink2 = rows.nth(1).locator('td').nth(4).locator('a');
		await expect(actionLink2).toHaveText('Continue');
		await expect(actionLink2).toHaveAttribute('href', '/models/2');

		// 6. Test populated row with model selection and features
		await page.evaluate(() => {
			const s = window.__appState!.get();
			window.__appState!.set({
				...s,
				models: [
					{
						...s.models[0]!,
						modelId: 'logistic-regression',
						features: ['sepal width', 'sepal length'],
						completedSteps: ['choose-model', 'select-features']
					},
					s.models[1]!
				]
			});
		});

		// Model 1 displays library name and features in dataset order
		await expect(rows.nth(0).locator('th[scope="row"]')).toHaveText(
			'Model 1 — Logistic Regression'
		);
		// In Iris dataset, 'sepal length' comes before 'sepal width'
		await expect(rows.nth(0).locator('td').nth(0)).toHaveText('sepal length, sepal width');

		// 7. Check no rename, delete or duplicate controls exist
		await expect(table.locator('button:has-text("Delete")')).toHaveCount(0);
		await expect(table.locator('button:has-text("Rename")')).toHaveCount(0);
		await expect(table.locator('button:has-text("Duplicate")')).toHaveCount(0);
		await expect(table.locator('input')).toHaveCount(0);

		// Axe check
		const axeResults = await new AxeBuilder({ page })
			.withTags(AXE_TAGS)
			.include('app-models-view')
			.analyze();
		const unexpectedViolations = axeResults.violations.filter((v) => v.id !== 'color-contrast');
		expect(unexpectedViolations).toEqual([]);

		await page.evaluate(() => {
			const store = window.__appState!;
			const state = store.get();
			const [first, second] = state.models;
			const completedSteps = [
				'choose-model',
				'select-features',
				'configure-model',
				'configure-training'
			] as const;
			store.set({
				...state,
				models: [
					{
						...first!,
						completedSteps: [...completedSteps],
						trainingSetup: { type: 'one_shot', testRatio: 0.2, randomState: 42 }
					},
					{
						...second!,
						modelId: 'logistic-regression',
						features: first!.features,
						completedSteps: [...completedSteps],
						trainingSetup: {
							type: 'nested_cv',
							outerFolds: 7,
							innerFolds: 7,
							randomState: 42
						}
					},
					{ ...second!, num: 3 }
				],
				nextModelNum: 4
			});
		});
		const setups = table.locator('tbody tr td:nth-child(4)');
		const summaries = ['One-Shot (80% / 20%)', 'Cross-Validation (7 folds)', 'Not configured'];
		await expect(setups).toHaveText(summaries);
		await page.reload();
		await expect(setups).toHaveText(summaries);

		// Read a trained record with an unusable v1 setup and a surviving IndexedDB result.
		const historicalState = await page.evaluate(async () => {
			const datasetId = window.__appState!.get().dataset!.id;
			const db = await new Promise<IDBDatabase>((resolve, reject) => {
				const request = indexedDB.open('samata-db');
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});
			try {
				await new Promise<void>((resolve, reject) => {
					const transaction = db.transaction('model_results', 'readwrite');
					transaction.oncomplete = () => resolve();
					transaction.onabort = () => reject(transaction.error);
					transaction.objectStore('model_results').put({ datasetId, modelNum: 4 });
				});
			} finally {
				db.close();
			}
			const stateKey = 'samata-ml:state';
			const wire = JSON.parse(localStorage.getItem(stateKey)!);
			wire.models.push({
				...wire.models[0],
				num: 4,
				status: 'trained',
				completedSteps: [...wire.models[0].completedSteps, 'training', 'results'],
				trainingSetup: { type: 'nested_cv', outerFolds: 3, innerFolds: 2 }
			});
			return JSON.stringify({ ...wire, nextModelNum: 5 });
		});
		// Seed after the previous document's pagehide persistence and before startup reconciliation.
		await page.addInitScript(
			(state) => localStorage.setItem('samata-ml:state', state),
			historicalState
		);
		await page.reload();
		await expect(setups).toHaveText([...summaries, 'Not configured']);
		await expect(rows.last().getByRole('link', { name: 'View Results' })).toHaveAttribute(
			'href',
			'/models/4'
		);
		expect(await page.evaluate(() => window.__appState!.get().models[3]?.status)).toBe(
			'trained'
		);
	});

	test('MOD-HUB-2: Compare disabled until two trained models; view results link when trained', async ({
		page
	}) => {
		// Seed dataset, target and 2 models
		await page.goto('/data');
		const irisCard = page.locator('app-dataset-card[dataset-id="iris"]');
		await irisCard.waitFor({ state: 'visible', timeout: 5000 });
		await irisCard.locator('button.btn-primary').click();
		await page.locator('app-dataset-preview').waitFor({ state: 'attached', timeout: 5000 });

		await page.goto('/target');
		const targetView = page.locator('app-target-view');
		await expect(targetView.locator('[data-testid="target-ready"]')).toBeVisible({
			timeout: 10000
		});
		await targetView.locator('tbody tr:has(th:has-text("class")) button').click();

		// Seed 2 draft models
		await page.evaluate(() => {
			const s = window.__appState!.get();
			window.__appState!.set({
				...s,
				models: [
					{
						num: 1,
						createdAt: Date.now(),
						status: 'draft',
						completedSteps: ['choose-model', 'select-features'],
						modelId: 'logistic-regression',
						features: ['sepal length'],
						modelOptions: {},
						hyperparameters: { mode: 'manual', values: {} },
						multiclass: null,
						trainingSetup: null,
						progress: null,
						resultRevision: null,
						error: null,
						timings: null,
						durationMs: null,
						metrics: null,
						ui: {}
					},
					{
						num: 2,
						createdAt: Date.now() + 100,
						status: 'draft',
						completedSteps: ['choose-model', 'select-features'],
						modelId: 'decision-tree-classifier',
						features: ['sepal width'],
						modelOptions: {},
						hyperparameters: { mode: 'manual', values: {} },
						multiclass: null,
						trainingSetup: null,
						progress: null,
						resultRevision: null,
						error: null,
						timings: null,
						durationMs: null,
						metrics: null,
						ui: {}
					}
				],
				nextModelNum: 3
			});
		});

		await page.goto('/models');
		const overview = page.locator('app-models-view');
		await expect(overview.locator('[data-testid="models-list"]')).toBeVisible();

		// With 0 trained models: Compare Results is disabled and hint is visible
		const compareDisabled = overview.locator('button:has-text("Compare Results")');
		await expect(compareDisabled).toBeDisabled();
		const compareHint = overview.locator('.compare-hint');
		await expect(compareHint).toContainText('Train at least two models to compare results.');

		// Train 1 model: duration formatted, status trained
		await page.evaluate(() => {
			const s = window.__appState!.get();
			window.__appState!.set({
				...s,
				models: [
					{
						...s.models[0]!,
						status: 'trained',
						durationMs: 3420,
						completedSteps: [
							'choose-model',
							'select-features',
							'configure-model',
							'configure-training',
							'training',
							'results'
						]
					},
					s.models[1]!
				]
			});
		});

		// Model 1 now shows '3.4s' duration and 'View Results' action
		const rows = overview.locator('table.table tbody tr');
		await expect(rows.nth(0).locator('td').nth(3)).toHaveText('3.4s');
		await expect(rows.nth(0).locator('td').nth(4).locator('a')).toHaveText('View Results');

		// Compare Results still disabled with 1 trained model
		await expect(compareDisabled).toBeDisabled();
		await expect(compareHint).toBeVisible();

		// Train Model 2
		await page.evaluate(() => {
			const s = window.__appState!.get();
			window.__appState!.set({
				...s,
				models: [
					s.models[0]!,
					{
						...s.models[1]!,
						status: 'trained',
						durationMs: 1250,
						completedSteps: [
							'choose-model',
							'select-features',
							'configure-model',
							'configure-training',
							'training',
							'results'
						]
					}
				]
			});
		});

		// Now 2 models are trained: Compare Results becomes an active link to /results
		const compareLink = overview.locator('a.btn:has-text("Compare Results")');
		await expect(compareLink).toBeVisible();
		await expect(compareLink).toHaveAttribute('href', '/results');
		// Compare hint disappears
		await expect(compareHint).toHaveCount(0);
	});
});
