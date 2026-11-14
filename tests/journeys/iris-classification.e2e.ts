import { expect, test } from '@playwright/test';
import { loadSampleDataset } from './helpers';

test.describe('Reference Journey: Iris Classification (JOURNEY-IRIS-DATA)', () => {
	test.describe.configure({ mode: 'serial' });

	test('JOURNEY-IRIS-DATA: load sample dataset, preview contents, inspect columns, and resume on reload', async ({
		page
	}) => {
		await page.goto('/data');

		// 1. Load Iris sample dataset
		await loadSampleDataset(page, 'iris');

		const preview = page.locator('app-dataset-preview');
		await expect(preview).toBeVisible();

		// 2. Verify preview header and summary
		await expect(preview.locator('.page-header h1')).toHaveText(
			'Preview Dataset: Iris Flower Species'
		);
		await expect(preview.locator('.page-header p')).toContainText('150 rows | 5 columns');

		// 3. Verify sidebar reflects loaded dataset
		const sidebarItem = page.locator('app-sidebar a[href="/data"]');
		await expect(sidebarItem).toBeVisible();
		await expect(page.locator('app-sidebar')).toContainText(
			'Iris Flower Species (150 rows, 5 cols)'
		);

		// 4. Verify virtual table column headers
		const table = preview.locator('ui-virtual-table');
		const expectedColumns = [
			'sepal length',
			'sepal width',
			'petal length',
			'petal width',
			'class'
		];
		for (const col of expectedColumns) {
			await expect(table.locator(`.header-btn[data-col-key="${col}"]`)).toBeVisible();
		}

		// 5. Inspect numeric column (sepal length)
		const sepalLengthBtn = table.locator('.header-btn[data-col-key="sepal length"]');
		await sepalLengthBtn.click();
		const aside = page.locator('app-column-details aside.overlay');
		await expect(aside).toBeVisible();
		await expect(aside.locator('.overlay-title h4')).toHaveText('sepal length');
		await expect(aside.locator('code.type-tag')).toHaveText('numeric');
		await expect(aside.locator('table.table').first()).toBeVisible();

		// Close inspector
		await aside.locator('.btn-icon[aria-label="Close"]').click();
		await expect(aside).not.toBeVisible();

		// 6. Inspect categorical column (class)
		const classBtn = table.locator('.header-btn[data-col-key="class"]');
		await classBtn.click();
		await expect(aside).toBeVisible();
		await expect(aside.locator('.overlay-title h4')).toHaveText('class');
		await expect(aside.locator('code.type-tag')).toHaveText('categorical');
		await expect(aside.locator('table.table').first()).toBeVisible();

		// Close inspector
		await aside.locator('.btn-icon[aria-label="Close"]').click();
		await expect(aside).not.toBeVisible();

		// 7. Verify first row content
		const firstRowCells = table.locator('.table-row').first().locator('.table-cell');
		await expect(firstRowCells.last()).toHaveText('Iris-setosa');

		// 8. Reload page and verify state resumes cleanly
		await page.reload();
		await expect(preview).toBeVisible();
		await expect(preview.locator('.page-header h1')).toHaveText(
			'Preview Dataset: Iris Flower Species'
		);
		await expect(preview.locator('.page-header p')).toContainText('150 rows | 5 columns');
		await expect(page.locator('app-sidebar')).toContainText(
			'Iris Flower Species (150 rows, 5 cols)'
		);
		await expect(
			preview.locator('.table-row').first().locator('.table-cell').last()
		).toHaveText('Iris-setosa');
	});

	test('JOURNEY-IRIS-TARGET: navigate to /target, select class target, and resume on reload', async ({
		page
	}) => {
		await page.goto('/data');
		await loadSampleDataset(page, 'iris');

		// 1. Navigate to /target via sidebar
		await page.locator('app-sidebar a[href="/target"]').click();
		await expect(page).toHaveURL(/\/target/);

		const targetView = page.locator('app-target-view');
		await expect(targetView).toBeVisible();
		const readySection = targetView.locator('[data-testid="target-ready"]');
		await expect(readySection).toBeVisible({ timeout: 10000 });

		// 2. Select class target
		const classRow = readySection.locator('tbody tr:has(th:has-text("class"))');
		const classBtn = classRow.locator('button');
		await expect(classBtn).toHaveText('Set as Target');
		await classBtn.click();

		// 3. Verify class is now current target and continue link is visible
		await expect(classBtn).toHaveText('Current Target');
		await expect(classBtn).toBeDisabled();
		const continueLink = targetView.locator('header a[href="/models"]');
		await expect(continueLink).toBeVisible();

		// 4. Reload and verify state resumes cleanly
		await page.reload();
		await expect(page).toHaveURL(/\/target/);
		await expect(readySection).toBeVisible({ timeout: 10000 });
		await expect(classRow.locator('button')).toHaveText('Current Target');
		await expect(classRow.locator('button')).toBeDisabled();
		await expect(continueLink).toBeVisible();
	});
});
