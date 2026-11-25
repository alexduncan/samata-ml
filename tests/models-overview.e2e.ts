import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { configureDraft, openSetup } from './fixtures/training/browser';
import { dismissWelcomeModal } from './journeys/helpers';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];

test.describe('Models Overview (MOD-HUB-1, MOD-HUB-2)', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/data');
		await dismissWelcomeModal(page);
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
		await expect(classRow.locator('button')).toHaveText('Current Target');

		// Navigate to /models -> should show empty state
		await page.goto('/models');
		await expect(overview.locator('[data-testid="models-empty"]')).toBeVisible();
		await expect(overview.locator('.empty-message')).toContainText(
			'No models yet. Train a new model to get started.'
		);
		const trainNewBtn = overview.getByRole('link', { name: 'Train New Model' });
		await expect(trainNewBtn).toBeEnabled();

		// The new URL binds Model 1 after the protected save.
		await trainNewBtn.click();
		await expect(page).toHaveURL('/models/new');
		await expect(page.locator('app-model-builder-view h1')).toHaveText('Model 1');

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
		await expect(actionLink1).toHaveAttribute('href', '/models/new');

		await actionLink1.click();
		await expect(page).toHaveURL('/models/new');
		await expect(page.locator('app-model-builder-view')).toHaveAttribute('model-num', '1');
		await page.reload();
		await expect(page.locator('app-model-builder-view')).toHaveAttribute('model-num', '1');
		await page.goto('/models');
		await trainNewBtn.click();
		await expect(page.locator('app-model-builder-view')).toHaveAttribute('model-num', '1');
		await page.goto('/models');
		await expect(rows).toHaveCount(1);

		// Historic projects may also have legacy numbered drafts.
		const legacyDrafts = await page.evaluate(() => {
			const state = JSON.parse(localStorage.getItem('samata-ml:state')!) as ReturnType<
				NonNullable<Window['__appState']>['get']
			>;
			const first = state.models[0]!;
			return JSON.stringify({
				...state,
				models: [
					...state.models,
					{ ...first, num: 2, createdAt: first.createdAt + 1 },
					{ ...first, num: 3, createdAt: first.createdAt + 2 }
				],
				nextModelNum: 4
			});
		});
		await page.addInitScript((drafts) => {
			if (sessionStorage.getItem('legacy-models-initialised')) return;
			localStorage.setItem('samata-ml:state', drafts);
			sessionStorage.setItem('legacy-models-initialised', 'yes');
		}, legacyDrafts);
		await page.reload();
		await expect(rows).toHaveCount(3);
		await expect(rows.nth(1).getByRole('link', { name: 'Continue' })).toHaveAttribute(
			'href',
			'/models/2'
		);

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
					...s.models.slice(1)
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
			const [first, second, third] = state.models;
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
					third!
				]
			});
		});
		const setups = table.locator('tbody tr td:nth-child(4)');
		const summaries = ['One-Shot (80% / 20%)', 'Cross-Validation (7 folds)', 'Not configured'];
		await expect(setups).toHaveText(summaries);
		await expect
			.poll(() =>
				page.evaluate(
					() =>
						JSON.parse(localStorage.getItem('samata-ml:state')!).models[1]
							?.trainingSetup?.outerFolds
				)
			)
			.toBe(7);
		await page.reload();
		await expect(setups).toHaveText(summaries);

		// A historical key-only row does not provide a recoverable result.
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
		await expect(rows.last().getByRole('link', { name: 'Continue' })).toHaveAttribute(
			'href',
			'/models/4'
		);
		expect(await page.evaluate(() => window.__appState!.get().models[3]?.status)).toBe('draft');
	});

	test('MOD-HUB-2: comparison and result links follow acknowledged training', async ({
		page
	}) => {
		const setup = await openSetup(page);
		const sidebar = page.locator('app-sidebar a[href="/models"]');
		const overview = page.locator('app-models-view');
		const rows = overview.locator('table.table tbody tr');
		const compareDisabled = overview.getByRole('button', { name: 'Compare Results' });
		const compareHint = overview.locator('.compare-hint');
		await setup.getByRole('button', { name: 'Train Model' }).click();
		await expect(page.getByRole('button', { name: 'View Results' })).toBeEnabled({
			timeout: 45_000
		});

		await sidebar.click();
		const firstResults = rows.first().getByRole('link', { name: 'View Results' });
		await expect(firstResults).toHaveAttribute('href', '/models/1');
		await expect(rows.first().locator('td:nth-child(5)')).toHaveText(/^\d+(?:\.\d+)?s$/);
		await expect(compareDisabled).toBeDisabled();
		await expect(compareHint).toBeVisible();
		await firstResults.click();
		await expect(page.getByRole('heading', { name: 'Model 1 Results' })).toBeFocused();
		await expect(page.locator('app-model-results')).toBeVisible();
		await sidebar.click();

		const second = await configureDraft(page, 2);
		await second.getByRole('button', { name: 'Train Model' }).click();
		await expect(page.getByRole('button', { name: 'View Results' })).toBeEnabled({
			timeout: 45_000
		});
		await sidebar.click();
		await expect(rows.getByRole('link', { name: 'View Results' })).toHaveCount(2);
		await expect(overview.getByRole('link', { name: 'Compare Results' })).toHaveAttribute(
			'href',
			'/results'
		);
		await expect(compareHint).toHaveCount(0);
	});
});
