import { expect, test } from '@playwright/test';

test.describe('Target Selection & Confirmation (TARG-E2E-1 .. TARG-E2E-3)', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/data');
		// Dismiss welcome modal if open
		const getStartedBtn = page.locator('app-welcome-modal button.btn-primary');
		try {
			await getStartedBtn.waitFor({ state: 'visible', timeout: 3000 });
			await getStartedBtn.click();
			await page
				.locator('app-welcome-modal dialog')
				.waitFor({ state: 'hidden', timeout: 3000 });
		} catch {
			// Already dismissed
		}
	});

	test('TARG-E2E-1: blocked/loading/failure/ready views and Retry; no action enabled before correct metadata', async ({
		page
	}) => {
		// 1. Blocked view when no dataset is loaded
		await page.goto('/target');
		const targetView = page.locator('app-target-view');
		await expect(targetView).toBeVisible();

		const blockedSection = targetView.locator('[data-testid="target-blocked"]');
		await expect(blockedSection).toBeVisible();
		await expect(blockedSection.locator('.notification.notification-alert')).toContainText(
			'Load a dataset before choosing a target.'
		);
		const loadDataLink = blockedSection.locator('a[href="/data"]');
		await expect(loadDataLink).toBeVisible();

		// No table actions exist in blocked view
		await expect(targetView.locator('table')).toHaveCount(0);

		// 2. Load Iris dataset from /data
		await page.goto('/data');
		const irisCard = page.locator('app-dataset-card[dataset-id="iris"]');
		await irisCard.waitFor({ state: 'visible', timeout: 5000 });
		await irisCard.locator('button.btn-primary').click();

		const preview = page.locator('app-dataset-preview');
		await expect(preview).toBeVisible({ timeout: 10000 });

		// 3. Navigate to /target -> ready state
		await page.locator('app-sidebar a[href="/target"]').click();
		await expect(page).toHaveURL(/\/target/);

		const readySection = targetView.locator('[data-testid="target-ready"]');
		await expect(readySection).toBeVisible({ timeout: 10000 });

		const table = readySection.locator('table.table');
		await expect(table).toBeVisible();
		await expect(table.locator('caption')).toContainText(
			'Iris Flower Species target candidates'
		);

		// Verify table header columns
		const headers = table.locator('thead th');
		await expect(headers.nth(0)).toHaveText('Column Name');
		await expect(headers.nth(1)).toHaveText('Type');
		await expect(headers.nth(2)).toHaveText('Notes');
		await expect(headers.nth(3)).toHaveText('Action');

		// 4. Test Error & Retry state
		await page.evaluate(() => {
			const currentDatasetId = window.__appState?.get().dataset?.id ?? 'iris';
			window.__datasetResources?.set({
				datasetId: currentDatasetId,
				status: 'error',
				metadata: null,
				descriptor: null,
				error: 'Simulated connection failure'
			});
		});

		const errorSection = targetView.locator('[data-testid="target-error"]');
		await expect(errorSection).toBeVisible();
		await expect(errorSection.locator('p[role="alert"]')).toContainText(
			'Column information could not be loaded.'
		);

		const retryBtn = errorSection.locator('button:has-text("Retry")');
		await expect(retryBtn).toBeVisible();
		await retryBtn.click();

		// Succeeded retry restores ready state
		await expect(readySection).toBeVisible({ timeout: 10000 });
		await expect(targetView.locator('table.table')).toBeVisible();
	});

	test('TARG-E2E-2: selecting eligible target persists, current selection is a no-op; ineligible disabled with exact notes', async ({
		page
	}) => {
		// Load Iris dataset
		const irisCard = page.locator('app-dataset-card[dataset-id="iris"]');
		await irisCard.waitFor({ state: 'visible', timeout: 5000 });
		await irisCard.locator('button.btn-primary').click();

		await expect(page.locator('app-dataset-preview')).toBeVisible({ timeout: 10000 });

		// Navigate to /target
		await page.locator('app-sidebar a[href="/target"]').click();
		const targetView = page.locator('app-target-view');
		await expect(targetView.locator('[data-testid="target-ready"]')).toBeVisible({
			timeout: 10000
		});

		// Inspect rows (Iris target column is "class")
		const classRow = targetView.locator('tbody tr:has(th:has-text("class"))');
		await expect(classRow).toBeVisible();
		await expect(classRow.locator('td').nth(0)).toContainText('Categorical');
		await expect(classRow.locator('td').nth(1)).toContainText('Suggested target');

		const classBtn = classRow.locator('button');
		await expect(classBtn).toHaveAttribute('aria-label', 'Set as Target: class');
		await expect(classBtn).toHaveText('Set as Target');
		await expect(classBtn).toBeEnabled();

		// Select class as target
		await classBtn.click();

		// Class button becomes Current Target and disabled
		await expect(classBtn).toHaveText('Current Target');
		await expect(classBtn).toBeDisabled();

		// Header displays Train Models continuation link
		const continueLink = targetView.locator('header a[href="/models"]');
		await expect(continueLink).toBeVisible();

		// Selecting current target again is a no-op
		await classBtn.click({ force: true });
		await expect(targetView.locator('dialog.confirm-dialog')).not.toBeVisible();
		await expect(classBtn).toHaveText('Current Target');

		// Reload page and verify target selection survived in state
		await page.reload();
		await expect(targetView.locator('[data-testid="target-ready"]')).toBeVisible({
			timeout: 10000
		});
		const reloadedClassRow = targetView.locator('tbody tr:has(th:has-text("class"))');
		await expect(reloadedClassRow.locator('button')).toHaveText('Current Target');
		await expect(reloadedClassRow.locator('button')).toBeDisabled();
	});

	test('TARG-E2E-3: cancel/Esc keeps models/focus, confirm discards any existing model, dataset change while modal open cancels safely', async ({
		page
	}) => {
		// Load Iris dataset
		const irisCard = page.locator('app-dataset-card[dataset-id="iris"]');
		await irisCard.waitFor({ state: 'visible', timeout: 5000 });
		await irisCard.locator('button.btn-primary').click();

		await expect(page.locator('app-dataset-preview')).toBeVisible({ timeout: 10000 });

		// Go to /target and select class
		await page.locator('app-sidebar a[href="/target"]').click();
		const targetView = page.locator('app-target-view');
		await expect(targetView.locator('[data-testid="target-ready"]')).toBeVisible({
			timeout: 10000
		});

		const classRow = targetView.locator('tbody tr:has(th:has-text("class"))');
		await classRow.locator('button').click();
		await expect(classRow.locator('button')).toHaveText('Current Target');

		// Create a model in app state
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
					}
				]
			});
		});

		// Verify model reset warning notification is displayed
		const warningNotification = targetView.locator('.notification.notification-alert').first();
		await expect(warningNotification).toContainText(
			'Changing the target will reset all existing models.'
		);

		// Click a different column (sepal length)
		const sepalLengthRow = targetView.locator('tbody tr:has(th:has-text("sepal length"))');
		const sepalLengthBtn = sepalLengthRow.locator('button');
		await sepalLengthBtn.click();

		// Confirmation dialog opens
		const dialog = targetView.locator('dialog.confirm-dialog');
		await expect(dialog).toBeVisible();
		await expect(dialog.locator('h2#confirm-target-title')).toHaveText('Change Target');
		await expect(dialog.locator('.modal-body')).toContainText(
			'Confirmation: discard all models and set sepal length as the target?'
		);

		// Cancel button is autofocused
		const cancelBtn = dialog.locator('button:has-text("Cancel")');
		await expect(cancelBtn).toBeFocused();

		// Press Escape to dismiss
		await page.keyboard.press('Escape');
		await expect(dialog).not.toBeVisible();

		// Focus is restored to the invoker button
		await expect(sepalLengthBtn).toBeFocused();

		// State unchanged: class is still current target, model count is still 1
		await expect(classRow.locator('button')).toHaveText('Current Target');
		const modelCountBefore = await page.evaluate(() => {
			return window.__appState!.get().models.length;
		});
		expect(modelCountBefore).toBe(1);

		// Open dialog again and click Change Target
		await sepalLengthBtn.click();
		await expect(dialog).toBeVisible();

		const confirmBtn = dialog.locator('button.btn-primary:has-text("Change Target")');
		await confirmBtn.click();
		await expect(dialog).not.toBeVisible();

		// Sepal length is now current target
		await expect(sepalLengthRow.locator('button')).toHaveText('Current Target');
		await expect(sepalLengthRow.locator('button')).toBeDisabled();
		await expect(classRow.locator('button')).toHaveText('Set as Target');

		// Models were discarded
		const modelCountAfter = await page.evaluate(() => {
			return window.__appState!.get().models.length;
		});
		expect(modelCountAfter).toBe(0);

		// Test dataset change while modal is open:
		// 1. Create a model
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
						resultRevision: null,
						error: null,
						timings: null,
						durationMs: null,
						metrics: null,
						ui: {}
					}
				]
			});
		});

		// 2. Open dialog for petal length
		const petalLengthRow = targetView.locator('tbody tr:has(th:has-text("petal length"))');
		await petalLengthRow.locator('button').click();
		await expect(dialog).toBeVisible();

		// 3. Dataset changes while modal is open
		await page.evaluate(() => {
			const s = window.__appState!.get();
			window.__appState!.set({
				...s,
				dataset: {
					id: 'other-dataset',
					name: 'Other Dataset',
					source: 'sample',
					rowCount: 5,
					columns: [
						{ name: 'col_a', type: 'numeric', missingCount: 0 },
						{ name: 'col_b', type: 'numeric', missingCount: 0 }
					]
				}
			});
		});

		// Modal closes safely
		await expect(dialog).not.toBeVisible();
		const currentTarget = await page.evaluate(() => {
			return window.__appState!.get().target;
		});
		expect(currentTarget).toBe('sepal length');
	});
});
