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
		await expect(page.locator('app-sidebar')).toContainText(
			'Palmer Archipelago Penguins (344 rows, 8 cols)'
		);

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
		await expect(page.locator('app-sidebar')).toContainText(
			'Palmer Archipelago Penguins (344 rows, 8 cols)'
		);
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
});
