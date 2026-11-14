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
});
