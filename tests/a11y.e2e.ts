import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Known accessibility violations to be fixed by the follow-up
 * remediation plan (scaffolding-visual-remediation).
 */
export const KNOWN_A11Y_DRIFT: string[] = ['color-contrast'];

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];

async function assertNoUnexpectedViolations(page: import('@playwright/test').Page) {
	const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();

	const unexpectedViolations = results.violations.filter((v) => !KNOWN_A11Y_DRIFT.includes(v.id));
	const knownViolations = results.violations.filter((v) => KNOWN_A11Y_DRIFT.includes(v.id));

	if (KNOWN_A11Y_DRIFT.length > 0 && knownViolations.length > 0) {
		expect(knownViolations.length).toBeGreaterThan(0);
	}

	expect(
		unexpectedViolations,
		`Unexpected a11y violations found: ${JSON.stringify(unexpectedViolations, null, 2)}`
	).toEqual([]);
}

test.describe('Accessibility Audits (WCAG 2.2 AA)', () => {
	test.describe.configure({ mode: 'serial' });

	test('A11Y-E2E-1: Initial route /data with welcome modal open', async ({ page }) => {
		await page.goto('/data');
		await page.locator('app-welcome-modal dialog[open]').waitFor({ timeout: 5000 });
		await assertNoUnexpectedViolations(page);
	});

	test('A11Y-E2E-2: Route /data with welcome modal dismissed', async ({ page }) => {
		await page.goto('/data');
		const getStartedBtn = page.locator('app-welcome-modal button.btn-primary');
		await getStartedBtn.waitFor({ timeout: 5000 });
		await getStartedBtn.click();
		await page.locator('app-welcome-modal dialog').waitFor({ state: 'hidden', timeout: 5000 });
		await assertNoUnexpectedViolations(page);
	});

	test('A11Y-E2E-3: Route /data in preview mode', async ({ page }) => {
		await page.goto('/data');
		const getStartedBtn = page.locator('app-welcome-modal button.btn-primary');
		try {
			await getStartedBtn.waitFor({ state: 'visible', timeout: 2000 });
			await getStartedBtn.click();
			await page
				.locator('app-welcome-modal dialog')
				.waitFor({ state: 'hidden', timeout: 2000 });
		} catch {}

		const irisCard = page.locator('app-dataset-card[dataset-id="iris"]');
		await irisCard.waitFor({ state: 'visible', timeout: 5000 });
		await irisCard.locator('button.btn-primary').click();

		const preview = page.locator('app-dataset-preview');
		await expect(preview).toBeVisible({ timeout: 10000 });

		await assertNoUnexpectedViolations(page);
	});

	test('A11Y-E2E-4: Route /data with column inspector open', async ({ page }) => {
		await page.goto('/data');
		const getStartedBtn = page.locator('app-welcome-modal button.btn-primary');
		try {
			await getStartedBtn.waitFor({ state: 'visible', timeout: 2000 });
			await getStartedBtn.click();
			await page
				.locator('app-welcome-modal dialog')
				.waitFor({ state: 'hidden', timeout: 2000 });
		} catch {}

		const irisCard = page.locator('app-dataset-card[dataset-id="iris"]');
		await irisCard.waitFor({ state: 'visible', timeout: 5000 });
		await irisCard.locator('button.btn-primary').click();

		const preview = page.locator('app-dataset-preview');
		await expect(preview).toBeVisible({ timeout: 10000 });

		const sepalLengthBtn = preview.locator('.header-btn[data-col-key="sepal length"]');
		await sepalLengthBtn.click();

		const aside = page.locator('app-column-details aside.overlay');
		await expect(aside).toBeVisible();

		await assertNoUnexpectedViolations(page);
	});

	test('A11Y-E2E-5: Route /data with datasheet modal open', async ({ page }) => {
		await page.goto('/data');
		const getStartedBtn = page.locator('app-welcome-modal button.btn-primary');
		try {
			await getStartedBtn.waitFor({ state: 'visible', timeout: 2000 });
			await getStartedBtn.click();
			await page
				.locator('app-welcome-modal dialog')
				.waitFor({ state: 'hidden', timeout: 2000 });
		} catch {}

		const changeBtn = page.locator('app-dataset-preview button:has-text("Change Dataset")');
		if (await changeBtn.isVisible()) {
			await changeBtn.click();
			await page.locator('dialog.change-dataset-modal button.btn-danger').click();
		}

		const irisCard = page.locator('app-dataset-card[dataset-id="iris"]');
		await irisCard.waitFor({ state: 'visible', timeout: 5000 });
		await irisCard.locator('button:has-text("Datasheet")').click();

		const dialog = page.locator('app-datasheet-dialog dialog[open]');
		await expect(dialog).toBeVisible();

		await assertNoUnexpectedViolations(page);
	});

	test('A11Y-E2E-6: Route /data with upload modal open', async ({ page }) => {
		await page.goto('/data');
		const getStartedBtn = page.locator('app-welcome-modal button.btn-primary');
		try {
			await getStartedBtn.waitFor({ state: 'visible', timeout: 2000 });
			await getStartedBtn.click();
			await page
				.locator('app-welcome-modal dialog')
				.waitFor({ state: 'hidden', timeout: 2000 });
		} catch {}

		const uploadBtn = page.locator('header.page-header button:has-text("Upload Dataset")');
		await uploadBtn.waitFor({ state: 'visible', timeout: 5000 });
		await uploadBtn.click();

		const dialog = page.locator('app-upload-dataset-dialog dialog[open]');
		await expect(dialog).toBeVisible();

		await assertNoUnexpectedViolations(page);
	});

	test('A11Y-E2E-7: Route /target in blocked state', async ({ page }) => {
		await page.goto('/target');
		const getStartedBtn = page.locator('app-welcome-modal button.btn-primary');
		try {
			await getStartedBtn.waitFor({ state: 'visible', timeout: 2000 });
			await getStartedBtn.click();
			await page
				.locator('app-welcome-modal dialog')
				.waitFor({ state: 'hidden', timeout: 2000 });
		} catch {}

		await expect(page.locator('app-target-view [data-testid="target-blocked"]')).toBeVisible();
		await assertNoUnexpectedViolations(page);
	});

	test('A11Y-E2E-8: Route /target in ready state', async ({ page }) => {
		await page.goto('/data');
		const getStartedBtn = page.locator('app-welcome-modal button.btn-primary');
		try {
			await getStartedBtn.waitFor({ state: 'visible', timeout: 2000 });
			await getStartedBtn.click();
			await page
				.locator('app-welcome-modal dialog')
				.waitFor({ state: 'hidden', timeout: 2000 });
		} catch {}

		const irisCard = page.locator('app-dataset-card[dataset-id="iris"]');
		await irisCard.waitFor({ state: 'visible', timeout: 5000 });
		await irisCard.locator('button.btn-primary').click();
		await page.locator('app-dataset-preview').waitFor({ state: 'attached', timeout: 5000 });

		await page.locator('app-sidebar a[href="/target"]').click();
		await expect(page.locator('app-target-view [data-testid="target-ready"]')).toBeVisible({
			timeout: 10000
		});
		await assertNoUnexpectedViolations(page);
	});

	test('A11Y-E2E-9: Route /target with model warning and confirm modal open', async ({
		page
	}) => {
		await page.goto('/data');
		const getStartedBtn = page.locator('app-welcome-modal button.btn-primary');
		try {
			await getStartedBtn.waitFor({ state: 'visible', timeout: 2000 });
			await getStartedBtn.click();
			await page
				.locator('app-welcome-modal dialog')
				.waitFor({ state: 'hidden', timeout: 2000 });
		} catch {}

		const irisCard = page.locator('app-dataset-card[dataset-id="iris"]');
		await irisCard.waitFor({ state: 'visible', timeout: 5000 });
		await irisCard.locator('button.btn-primary').click();
		await page.locator('app-dataset-preview').waitFor({ state: 'attached', timeout: 5000 });

		await page.goto('/target');
		const targetView = page.locator('app-target-view');
		await expect(targetView.locator('[data-testid="target-ready"]')).toBeVisible({
			timeout: 10000
		});

		// Set initial target
		const classRow = targetView.locator('tbody tr:has(th:has-text("class"))');
		await classRow.locator('button').click();

		// Seed a model
		await page.evaluate(() => {
			const s = window.__appState!.get();
			window.__appState!.set({
				...s,
				models: [
					{
						num: 1,
						createdAt: Date.now(),
						status: 'draft',
						completedSteps: [],
						modelId: null,
						features: ['sepal width'],
						modelOptions: {},
						hyperparameters: { mode: 'manual', values: {} },
						multiclass: null,
						trainingSetup: null,
						progress: null,
						error: null,
						timings: null,
						durationMs: null,
						metrics: null,
						ui: {}
					}
				]
			});
		});

		// Click different target to open confirm dialog
		const sepalLengthRow = targetView.locator('tbody tr:has(th:has-text("sepal length"))');
		await sepalLengthRow.locator('button').click();
		const dialog = targetView.locator('dialog.confirm-dialog[open]');
		await expect(dialog).toBeVisible();

		await assertNoUnexpectedViolations(page);
	});

	test('A11Y-E2E-10: Route /models in blocked state', async ({ page }) => {
		await page.goto('/models');
		const getStartedBtn = page.locator('app-welcome-modal button.btn-primary');
		try {
			await getStartedBtn.waitFor({ state: 'visible', timeout: 2000 });
			await getStartedBtn.click();
			await page
				.locator('app-welcome-modal dialog')
				.waitFor({ state: 'hidden', timeout: 2000 });
		} catch {}

		await expect(page.locator('app-models-view [data-testid="models-blocked"]')).toBeVisible();
		await assertNoUnexpectedViolations(page);
	});

	test('A11Y-E2E-11: Route /models in empty state', async ({ page }) => {
		await page.goto('/data');
		const getStartedBtn = page.locator('app-welcome-modal button.btn-primary');
		try {
			await getStartedBtn.waitFor({ state: 'visible', timeout: 2000 });
			await getStartedBtn.click();
			await page
				.locator('app-welcome-modal dialog')
				.waitFor({ state: 'hidden', timeout: 2000 });
		} catch {}

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

		await page.goto('/models');
		const modelsView = page.locator('app-models-view');
		await expect(modelsView.locator('[data-testid="models-empty"]')).toBeVisible({
			timeout: 10000
		});
		await expect(modelsView).toContainText('No models yet. Train a new model to get started.');

		await assertNoUnexpectedViolations(page);
	});

	test('A11Y-E2E-12: Route /models in populated state', async ({ page }) => {
		await page.goto('/data');
		const getStartedBtn = page.locator('app-welcome-modal button.btn-primary');
		try {
			await getStartedBtn.waitFor({ state: 'visible', timeout: 2000 });
			await getStartedBtn.click();
			await page
				.locator('app-welcome-modal dialog')
				.waitFor({ state: 'hidden', timeout: 2000 });
		} catch {}

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
						features: ['sepal length', 'sepal width'],
						modelOptions: {},
						hyperparameters: { mode: 'manual', values: {} },
						multiclass: null,
						trainingSetup: null,
						progress: null,
						error: null,
						timings: null,
						durationMs: null,
						metrics: null,
						ui: { featureSelectionInitialised: true }
					}
				]
			});
		});

		await page.goto('/models');
		const modelsView = page.locator('app-models-view');
		await expect(modelsView.locator('table.table')).toBeVisible({ timeout: 10000 });

		await assertNoUnexpectedViolations(page);
	});

	test('A11Y-E2E-13: Route /models/:num in Choose Model active state', async ({ page }) => {
		await page.goto('/data');
		const getStartedBtn = page.locator('app-welcome-modal button.btn-primary');
		try {
			await getStartedBtn.waitFor({ state: 'visible', timeout: 2000 });
			await getStartedBtn.click();
			await page
				.locator('app-welcome-modal dialog')
				.waitFor({ state: 'hidden', timeout: 2000 });
		} catch {}

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

		await page.evaluate(() => {
			const s = window.__appState!.get();
			window.__appState!.set({
				...s,
				models: [
					{
						num: 1,
						createdAt: Date.now(),
						status: 'draft',
						completedSteps: [],
						modelId: null,
						features: [],
						modelOptions: {},
						hyperparameters: { mode: 'manual', values: {} },
						multiclass: null,
						trainingSetup: null,
						progress: null,
						error: null,
						timings: null,
						durationMs: null,
						metrics: null,
						ui: {}
					}
				]
			});
		});

		await page.goto('/models/1');
		const builder = page.locator('app-model-builder-view');
		await expect(builder.locator('.train-step[aria-current="step"]')).toBeVisible({
			timeout: 10000
		});

		await assertNoUnexpectedViolations(page);
	});

	test('A11Y-E2E-14: Route /models/:num in Select Features active state', async ({ page }) => {
		await page.goto('/data');
		const getStartedBtn = page.locator('app-welcome-modal button.btn-primary');
		try {
			await getStartedBtn.waitFor({ state: 'visible', timeout: 2000 });
			await getStartedBtn.click();
			await page
				.locator('app-welcome-modal dialog')
				.waitFor({ state: 'hidden', timeout: 2000 });
		} catch {}

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

		await page.evaluate(() => {
			const s = window.__appState!.get();
			window.__appState!.set({
				...s,
				models: [
					{
						num: 1,
						createdAt: Date.now(),
						status: 'draft',
						completedSteps: ['choose-model'],
						modelId: 'logistic-regression',
						features: ['sepal length', 'sepal width', 'petal length', 'petal width'],
						modelOptions: {},
						hyperparameters: { mode: 'manual', values: {} },
						multiclass: null,
						trainingSetup: null,
						progress: null,
						error: null,
						timings: null,
						durationMs: null,
						metrics: null,
						ui: { featureSelectionInitialised: true }
					}
				]
			});
		});

		await page.goto('/models/1');
		const builder = page.locator('app-model-builder-view');
		await expect(builder.locator('table.table')).toBeVisible({ timeout: 10000 });

		await assertNoUnexpectedViolations(page);
	});

	test('A11Y-E2E-15: Route /models/:num with model description dialog open', async ({ page }) => {
		await page.goto('/data');
		const getStartedBtn = page.locator('app-welcome-modal button.btn-primary');
		try {
			await getStartedBtn.waitFor({ state: 'visible', timeout: 2000 });
			await getStartedBtn.click();
			await page
				.locator('app-welcome-modal dialog')
				.waitFor({ state: 'hidden', timeout: 2000 });
		} catch {}

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

		await page.evaluate(() => {
			const s = window.__appState!.get();
			window.__appState!.set({
				...s,
				models: [
					{
						num: 1,
						createdAt: Date.now(),
						status: 'draft',
						completedSteps: [],
						modelId: null,
						features: [],
						modelOptions: {},
						hyperparameters: { mode: 'manual', values: {} },
						multiclass: null,
						trainingSetup: null,
						progress: null,
						error: null,
						timings: null,
						durationMs: null,
						metrics: null,
						ui: {}
					}
				]
			});
		});

		await page.goto('/models/1');
		const builder = page.locator('app-model-builder-view');
		const descBtn = builder.locator('app-model-card button:has-text("Model Description")');
		await expect(descBtn).toBeVisible({ timeout: 10000 });
		await descBtn.click();

		const dialog = builder.locator('app-model-description-dialog dialog[open]');
		await expect(dialog).toBeVisible({ timeout: 5000 });

		await assertNoUnexpectedViolations(page);
	});
});
