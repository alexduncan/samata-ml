import { expect, test } from '@playwright/test';
import { loadSampleDataset } from './helpers';

test.describe('Reference Journey: Palmer Penguins Classification (JOURNEY-PENGUINS-DATA)', () => {
	test.describe.configure({ mode: 'serial' });

	test('JOURNEY-PENGUINS-DATA: load sample dataset, preview contents, inspect columns, and resume on reload', async ({
		page
	}) => {
		await page.goto('/data');

		// 1. Load Palmer Penguins sample dataset
		await loadSampleDataset(page, 'palmer-penguins');

		const preview = page.locator('app-dataset-preview');
		await expect(preview).toBeVisible();

		// 2. Verify preview header and summary
		await expect(preview.locator('.page-header h1')).toHaveText(
			'Preview Dataset: Palmer Archipelago Penguins'
		);
		await expect(preview.locator('.page-header p')).toContainText('344 rows | 8 columns');

		// 3. Verify sidebar reflects loaded dataset
		const sidebarItem = page.locator('app-sidebar a[href="/data"]');
		await expect(sidebarItem).toBeVisible();
		await expect(sidebarItem.locator('.step-value')).toHaveText('Palmer Archipelago Penguins');
		await expect(sidebarItem.locator('.chiclet')).toHaveText(['344 rows', '8 columns']);

		// 4. Verify virtual table column headers
		const table = preview.locator('ui-virtual-table');
		const expectedColumns = [
			'species',
			'island',
			'bill_length_mm',
			'bill_depth_mm',
			'flipper_length_mm',
			'body_mass_g',
			'sex',
			'year'
		];
		for (const col of expectedColumns) {
			await expect(table.locator(`.header-btn[data-col-key="${col}"]`)).toBeVisible();
		}

		// 5. Inspect categorical column (species)
		const speciesBtn = table.locator('.header-btn[data-col-key="species"]');
		await speciesBtn.click();
		const aside = page.locator('app-column-details aside.overlay');
		await expect(aside).toBeVisible();
		await expect(aside.locator('.overlay-title h4')).toHaveText('species');
		await expect(aside.locator('code.type-tag')).toHaveText('categorical');
		await expect(aside.locator('table.table').first()).toBeVisible();

		// Close inspector
		await aside.locator('.btn-icon[aria-label="Close"]').click();
		await expect(aside).not.toBeVisible();

		// 6. Inspect numeric column with missing values (bill_length_mm)
		const billLengthBtn = table.locator('.header-btn[data-col-key="bill_length_mm"]');
		await billLengthBtn.click();
		await expect(aside).toBeVisible();
		await expect(aside.locator('.overlay-title h4')).toHaveText('bill_length_mm');
		await expect(aside.locator('code.type-tag')).toHaveText('numeric');
		await expect(aside.locator('table.table').first()).toBeVisible();

		// Close inspector
		await aside.locator('.btn-icon[aria-label="Close"]').click();
		await expect(aside).not.toBeVisible();

		// 7. Verify first row content has Adelie
		const firstRowCells = table.locator('.table-row').first().locator('.table-cell');
		await expect(firstRowCells.first()).toHaveText('Adelie');

		// 8. Reload page and verify state resumes cleanly
		await page.reload();
		await expect(preview).toBeVisible();
		await expect(preview.locator('.page-header h1')).toHaveText(
			'Preview Dataset: Palmer Archipelago Penguins'
		);
		await expect(preview.locator('.page-header p')).toContainText('344 rows | 8 columns');
		await expect(sidebarItem.locator('.step-value')).toHaveText('Palmer Archipelago Penguins');
		await expect(sidebarItem.locator('.chiclet')).toHaveText(['344 rows', '8 columns']);
		await expect(
			preview.locator('.table-row').first().locator('.table-cell').first()
		).toHaveText('Adelie');
	});

	test('JOURNEY-PENGUINS-TARGET: navigate to /target, select species target, and resume on reload', async ({
		page
	}) => {
		await page.goto('/data');
		await loadSampleDataset(page, 'palmer-penguins');

		// 1. Navigate to /target via sidebar
		await page.locator('app-sidebar a[href="/target"]').click();
		await expect(page).toHaveURL(/\/target/);

		const targetView = page.locator('app-target-view');
		await expect(targetView).toBeVisible();
		const readySection = targetView.locator('[data-testid="target-ready"]');
		await expect(readySection).toBeVisible({ timeout: 10000 });

		// 2. Select species target
		const speciesRow = readySection.locator('tbody tr:has(th:has-text("species"))');
		const speciesBtn = speciesRow.locator('button');
		await expect(speciesBtn).toHaveText('Set as Target');
		await speciesBtn.click();

		// 3. Verify species is now current target and continue link is visible
		await expect(speciesBtn).toHaveText('Current Target');
		await expect(speciesBtn).toBeDisabled();
		const continueLink = targetView.locator('header a[href="/models"]');
		await expect(continueLink).toBeVisible();

		// 4. Reload and verify state resumes cleanly
		await page.reload();
		await expect(page).toHaveURL(/\/target/);
		await expect(readySection).toBeVisible({ timeout: 10000 });
		await expect(speciesRow.locator('button')).toHaveText('Current Target');
		await expect(speciesRow.locator('button')).toBeDisabled();
		await expect(continueLink).toBeVisible();
	});

	test('JOURNEY-PENGUINS-SETUP: navigate to /models, train new model, select logistic regression and features on penguins, verify resume on reload', async ({
		page
	}) => {
		await page.goto('/data');
		await loadSampleDataset(page, 'palmer-penguins');

		// 1. Navigate to /target and select species
		await page.locator('app-sidebar a[href="/target"]').click();
		await expect(page).toHaveURL(/\/target/);
		const targetView = page.locator('app-target-view');
		const readySection = targetView.locator('[data-testid="target-ready"]');
		await expect(readySection).toBeVisible({ timeout: 10000 });
		const speciesRow = readySection.locator('tbody tr:has(th:has-text("species"))');
		await speciesRow.locator('button').click();
		await expect(speciesRow.locator('button')).toHaveText('Current Target');

		// 2. Navigate to /models via target continue link
		const continueToModels = targetView.locator('header a[href="/models"]');
		await expect(continueToModels).toBeVisible();
		await continueToModels.click();
		await expect(page).toHaveURL(/\/models$/);

		const modelsView = page.locator('app-models-view');
		await expect(modelsView).toBeVisible();

		// 3. Train New Model -> navigates to /models/1
		const trainNewBtn = modelsView.locator('button.btn-primary:has-text("Train New Model")');
		await expect(trainNewBtn).toBeVisible();
		await trainNewBtn.click();
		await expect(page).toHaveURL(/\/models\/1$/);

		const builder = page.locator('app-model-builder-view');
		await expect(builder).toBeVisible();

		// 4. Section 1 (Choose Model) is active
		const step1 = builder.locator('.train-step').nth(0);
		await expect(step1).toHaveAttribute('aria-current', 'step');

		// Select Logistic Regression
		const lrCard = step1.locator('app-model-card[model-id="logistic-regression"]');
		await expect(lrCard).toBeVisible();
		await lrCard.locator('button.btn-primary').click();

		// Click Continue in Section 1
		const continueStep1Btn = step1.locator('.section-actions button:has-text("Continue")');
		await continueStep1Btn.click();

		// 5. Section 2 (Select Features) is now active
		const step2 = builder.locator('.train-step').nth(1);
		await expect(step2).toHaveAttribute('aria-current', 'step');

		// Verify target species is excluded (has Target chiclet and no checkbox)
		const targetRow = step2.locator('tbody tr:has(th:has-text("species"))');
		await expect(targetRow.locator('.chiclet')).toHaveText('Target');
		await expect(targetRow.locator('input[type="checkbox"]')).toHaveCount(0);

		// Click Continue in Section 2
		const continueStep2Btn = step2.locator('.section-actions button:has-text("Continue")');
		await expect(continueStep2Btn).toBeEnabled();
		await continueStep2Btn.click();

		// 6. Section 2 is now completed; Section 3 is active and pending
		await expect(step2).not.toHaveAttribute('aria-current', 'step');
		const step3 = builder.locator('.train-step').nth(2);
		await expect(step3).toHaveAttribute('aria-current', 'step');
		await expect(step3.locator('.pending-notice')).toHaveText('Not available yet.');

		// 7. Reload page and verify state resumes cleanly
		await page.reload();
		await expect(page).toHaveURL(/\/models\/1$/);
		await expect(builder).toBeVisible();
		await expect(step1).toContainText('Selected model: Logistic Regression');
		await expect(step3).toHaveAttribute('aria-current', 'step');
		await expect(step3.locator('.pending-notice')).toHaveText('Not available yet.');

		// 8. Navigate back to /models via sidebar
		await page.locator('app-sidebar a[href="/models"]').click();
		await expect(page).toHaveURL(/\/models$/);
		await expect(modelsView).toBeVisible();
		const table = modelsView.locator('table.table');
		await expect(table).toBeVisible();
		await expect(table.locator('tbody tr')).toHaveCount(1);
		await expect(table).toContainText('Model 1 — Logistic Regression');
	});
});
