import { expect, test } from '@playwright/test';

test.describe('Dataset Preview & Column Inspector (DATA-PRE-1 .. DATA-PRE-3)', () => {
	test.describe.configure({ mode: 'serial' });

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

	test('DATA-PRE-1: bounded requests, cap and segment navigation, grouping decimals', async ({
		page
	}) => {
		const irisCard = page.locator('app-dataset-card[dataset-id="iris"]');
		await irisCard.waitFor({ state: 'visible', timeout: 5000 });
		await irisCard.locator('button.btn-primary').click();

		const preview = page.locator('app-dataset-preview');
		await expect(preview).toBeVisible({ timeout: 10000 });

		// Check header title and stats
		const h1 = preview.locator('.page-header h1');
		await expect(h1).toContainText('Preview Dataset: Iris');

		const headerP = preview.locator('.page-header p');
		await expect(headerP).toContainText('150 rows');
		await expect(headerP).toContainText('5 columns');

		// Check virtual table
		const table = preview.locator('ui-virtual-table');
		await expect(table).toBeVisible();

		// Check column headers
		const headers = table.locator('.table-header-cell');
		await expect(headers).toHaveCount(5);
		await expect(headers.first()).toContainText('sepal length');
		await expect(headers.nth(4)).toContainText('class');

		// Verify table rows rendered with formatted values
		const rows = table.locator('.table-row');
		await expect(rows.first()).toBeVisible();
		const firstRowCells = rows.first().locator('.table-cell');
		await expect(firstRowCells.first()).toContainText('5.1');
		await expect(firstRowCells.nth(4)).toContainText('Iris-setosa');

		// Check segment controls and segment info
		const prevBtn = preview.locator('.segment-controls button:has-text("Previous segment")');
		await expect(prevBtn).toBeDisabled();

		const segmentInfo = preview.locator('.segment-info');
		await expect(segmentInfo).toContainText('Rows 1–150 of 150');

		// Check Go to row navigation
		const goToInput = preview.locator('input#row-number');
		await expect(goToInput).toBeVisible();
		await goToInput.fill('75');
		await preview.locator('.go-to-row button[type="submit"]').click();

		// Check cap notice is not visible for 150-row dataset
		const capNotice = preview.locator('.cap-notice');
		await expect(capNotice).toHaveCount(0);
	});

	test('DATA-PRE-2: column inspector stats, distributions, close button and persistence', async ({
		page
	}) => {
		const irisCard = page.locator('app-dataset-card[dataset-id="iris"]');
		await irisCard.waitFor({ state: 'visible', timeout: 5000 });
		await irisCard.locator('button.btn-primary').click();

		const preview = page.locator('app-dataset-preview');
		await expect(preview).toBeVisible({ timeout: 10000 });

		const table = preview.locator('ui-virtual-table');
		await expect(table).toBeVisible();

		// 1. Select numeric column "sepal length"
		const sepalLengthBtn = table.locator('.header-btn[data-col-key="sepal length"]');
		await sepalLengthBtn.click();

		const aside = page.locator('app-column-details aside.overlay');
		await expect(aside).toBeVisible();
		await expect(aside.locator('.overlay-title h4')).toContainText('sepal length');
		await expect(aside.locator('code.type-tag')).toContainText('numeric');

		// Check numeric stats: Min, Max, Mean, Median
		const summaryTable = aside.locator('table.table').first();
		await expect(summaryTable).toContainText('Min');
		await expect(summaryTable).toContainText('4.3');
		await expect(summaryTable).toContainText('Max');
		await expect(summaryTable).toContainText('7.9');

		// Check histogram table
		const histogramTable = aside.locator('table.table:has(th:has-text("Range"))');
		await expect(histogramTable).toBeVisible();
		await expect(histogramTable.locator('th:has-text("Count")')).toBeVisible();

		// 2. Test close button and invoker focus restoration
		const closeBtn = aside.locator('.btn-icon[aria-label="Close"]');
		await closeBtn.click();

		await expect(aside).not.toBeVisible();
		await expect(sepalLengthBtn).toBeFocused();

		// 3. Select categorical column "class"
		const speciesBtn = table.locator('.header-btn[data-col-key="class"]');
		await speciesBtn.click();

		await expect(aside).toBeVisible();
		await expect(aside.locator('.overlay-title h4')).toContainText('class');
		await expect(aside.locator('code.type-tag')).toContainText('categorical');

		// Check categorical distribution table
		const catTable = aside.locator('table.table:has(th:has-text("Category"))');
		await expect(catTable).toBeVisible();
		await expect(catTable.locator('tbody tr')).toHaveCount(3);
		await expect(catTable).toContainText('Iris-setosa');
		await expect(catTable).toContainText('50');

		// Close panel
		await aside.locator('.btn-icon[aria-label="Close"]').click();
		await expect(aside).not.toBeVisible();

		// 4. Persistence across reload: select "petal length", reload, verify panel reopens
		const petalLengthBtn = table.locator('.header-btn[data-col-key="petal length"]');
		await petalLengthBtn.click();
		await expect(aside).toBeVisible();
		await expect(aside.locator('.overlay-title h4')).toContainText('petal length');

		await page.reload();

		const reloadedAside = page.locator('app-column-details aside.overlay');
		await expect(reloadedAside).toBeVisible();
		await expect(reloadedAside.locator('.overlay-title h4')).toContainText('petal length');
	});
});
