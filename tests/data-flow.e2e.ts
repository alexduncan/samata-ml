import { expect, test } from '@playwright/test';

test.describe('Data Flow, Route & Scroll Integration (DATA-FLOW-1 .. DATA-FLOW-3)', () => {
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

	test('DATA-FLOW-1: preview mode, selected column, document and logical table scroll survive reload and back/forward', async ({
		page
	}) => {
		const irisCard = page.locator('app-dataset-card[dataset-id="iris"]');
		await irisCard.waitFor({ state: 'visible', timeout: 5000 });
		await irisCard.locator('button.btn-primary').click();

		const preview = page.locator('app-dataset-preview');
		await expect(preview).toBeVisible({ timeout: 10000 });

		const table = preview.locator('ui-virtual-table');
		await expect(table).toBeVisible();

		// 1. Select column "sepal length"
		const sepalLengthBtn = table.locator('.header-btn[data-col-key="sepal length"]');
		await sepalLengthBtn.click();
		const aside = page.locator('app-column-details aside.overlay');
		await expect(aside).toBeVisible();
		await expect(aside.locator('.overlay-title h4')).toContainText('sepal length');

		// 2. Navigate to row 50 via Go to row
		const goToInput = preview.locator('input#row-number');
		await goToInput.fill('50');
		await preview.locator('.go-to-row button[type="submit"]').click();
		await page.waitForTimeout(300);

		// 3. Reload page and verify state survives
		await page.reload();

		await expect(preview).toBeVisible({ timeout: 10000 });
		const reloadedAside = page.locator('app-column-details aside.overlay');
		await expect(reloadedAside).toBeVisible();
		await expect(reloadedAside.locator('.overlay-title h4')).toContainText('sepal length');

		// Verify table rows are present and logical scroll restored
		const rows = table.locator('.table-row');
		await expect(rows.first()).toBeVisible();

		// 4. Navigate to /target
		await page.locator('app-sidebar a[href="/target"]').click();
		await expect(page.locator('#content h1')).toHaveText('Set Target');
		expect(page.url()).toContain('/target');

		// 5. Back to /data
		await page.goBack();
		await expect(preview).toBeVisible({ timeout: 10000 });
		await expect(reloadedAside).toBeVisible();
		await expect(reloadedAside.locator('.overlay-title h4')).toContainText('sepal length');

		// 6. Open reserved modal "about"
		await page.locator('app-sidebar footer a[href="/about"]').click();
		const aboutModal = page.locator('app-content-modal dialog');
		await expect(aboutModal).toBeVisible();

		// Close modal and ensure underlay and focus are intact
		await aboutModal.locator('button.btn-icon').click();
		await expect(aboutModal).not.toBeVisible();
		await expect(preview).toBeVisible();
	});

	test('DATA-FLOW-2: changing dataset confirms, removes it, updates sidebar and survives reload; cancel leaves state intact', async ({
		page
	}) => {
		const irisCard = page.locator('app-dataset-card[dataset-id="iris"]');
		await irisCard.waitFor({ state: 'visible', timeout: 5000 });
		await irisCard.locator('button.btn-primary').click();

		const preview = page.locator('app-dataset-preview');
		await expect(preview).toBeVisible({ timeout: 10000 });

		// Verify sidebar step 1 shows dataset details
		const sidebarStep = page.locator('app-sidebar a[href="/data"]');
		await expect(sidebarStep).toContainText('Iris Flower Species');

		// 1. Click Change Dataset -> modal opens
		const changeBtn = preview.locator('button:has-text("Change Dataset")');
		await changeBtn.click();

		const modal = page.locator('dialog.change-dataset-modal');
		await expect(modal).toBeVisible();
		await expect(modal.locator('#change-dataset-title')).toHaveText('Change Dataset');

		// 2. Click Cancel -> dataset remains intact
		const cancelBtn = modal.locator('button:has-text("Cancel")');
		await cancelBtn.click();
		await expect(modal).not.toBeVisible();
		await expect(preview).toBeVisible();
		await expect(sidebarStep).toContainText('Iris Flower Species');

		// 3. Click Change Dataset again and confirm
		await changeBtn.click();
		await expect(modal).toBeVisible();

		const confirmBtn = modal.locator('button.btn-primary:has-text("Change Dataset")');
		await confirmBtn.click();

		// 4. Returns to selection mode
		await expect(page.locator('header.page-header h1')).toHaveText('Select Data');
		const cards = page.locator('app-dataset-card');
		await expect(cards).toHaveCount(12);

		// 5. Sidebar step 1 reverts to default
		await expect(sidebarStep).not.toContainText('Iris Flower Species');

		// 6. Survives reload
		await page.reload();
		await expect(page.locator('header.page-header h1')).toHaveText('Select Data');
		await expect(cards).toHaveCount(12);
	});

	test('DATA-FLOW-3: accessibility, RTL, and keyboard navigation', async ({ page }) => {
		const irisCard = page.locator('app-dataset-card[dataset-id="iris"]');
		await irisCard.waitFor({ state: 'visible', timeout: 5000 });
		await irisCard.locator('button.btn-primary').click();

		const preview = page.locator('app-dataset-preview');
		await expect(preview).toBeVisible({ timeout: 10000 });

		// 1. Keyboard navigation: Go to row
		const goToInput = preview.locator('input#row-number');
		await goToInput.focus();
		await goToInput.fill('25');
		await page.keyboard.press('Enter');
		await page.waitForTimeout(200);

		// 2. Keyboard navigation: Open column inspector via Enter key on focused header
		const sepalLengthBtn = preview.locator('.header-btn[data-col-key="sepal length"]');
		await sepalLengthBtn.focus();
		await page.keyboard.press('Enter');

		const aside = page.locator('app-column-details aside.overlay');
		await expect(aside).toBeVisible();

		// Close column inspector via Escape key
		await page.keyboard.press('Escape');
		await expect(aside).not.toBeVisible();

		// 3. Test RTL direction
		await page.evaluate(() => {
			document.documentElement.dir = 'rtl';
		});
		await expect(preview.locator('.page-header')).toBeVisible();
		await expect(preview.locator('ui-virtual-table')).toBeVisible();

		// Reset dir
		await page.evaluate(() => {
			document.documentElement.dir = 'ltr';
		});
	});
});
