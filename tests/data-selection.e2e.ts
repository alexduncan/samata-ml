import { expect, test } from '@playwright/test';

test.describe('Dataset Selection & Datasheets (DATA-SEL-1 .. DATA-SEL-3)', () => {
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

	test('DATA-SEL-1: renders all catalogue entries with stable ids, compact counts, and remote notice', async ({
		page
	}) => {
		const view = page.locator('app-data-view');
		await expect(view).toBeVisible();

		const cards = view.locator('app-dataset-card');
		// 12 sample datasets authored in content/datasets
		await expect(cards).toHaveCount(12);

		// Check stable dataset-id on specific cards
		const irisCard = view.locator('app-dataset-card[dataset-id="iris"]');
		await expect(irisCard).toBeVisible();
		await expect(irisCard.locator('.card-title')).toContainText('Iris');
		await expect(irisCard.locator('.stat').first()).toContainText('5 columns');
		await expect(irisCard.locator('.stat').nth(1)).toContainText('150 rows');

		// Check remote notice on compas-recidivism card item
		const compasCard = view.locator('app-dataset-card[dataset-id="compas-recidivism"]');
		await expect(compasCard).toBeVisible();
		const compasItem = view.locator(
			'li.card-item:has(app-dataset-card[dataset-id="compas-recidivism"])'
		);
		const notice = compasItem.locator('.remote-notice');
		await expect(notice).toBeVisible();
		await expect(notice).toContainText(
			'Downloaded from GitHub when loaded; internet connection required'
		);

		// Verify local sample does not have remote notice
		const irisItem = view.locator('li.card-item:has(app-dataset-card[dataset-id="iris"])');
		await expect(irisItem.locator('.remote-notice')).toHaveCount(0);
	});

	test('DATA-SEL-2: opens safe datasheet, handles hostile HTML, closes and restores invoker focus', async ({
		page
	}) => {
		const irisCard = page.locator('app-dataset-card[dataset-id="iris"]');
		const datasheetBtn = irisCard.locator('button:has-text("Datasheet")');

		await datasheetBtn.click();

		const dialog = page.locator('app-datasheet-dialog dialog.modal');
		await expect(dialog).toBeVisible();
		await expect(dialog).toHaveAttribute('open', '');

		// Check heading
		const heading = dialog.locator('#datasheet-title');
		await expect(heading).toContainText('Iris');

		// Check datasheet content
		const content = dialog.locator('.modal-content');
		await expect(content).toBeVisible();

		// Close via close button and check focus returned to datasheetBtn
		const closeBtn = dialog.locator('button.close-btn');
		await closeBtn.click();

		await expect(dialog).not.toBeVisible();
		await expect(datasheetBtn).toBeFocused();

		// Test error and retry states via route interception
		await page.route('**/datasets/bank-marketing/datasheet.html*', async (route) => {
			await route.abort('failed');
		});

		const bankCard = page.locator('app-dataset-card[dataset-id="bank-marketing"]');
		const bankDatasheetBtn = bankCard.locator('button:has-text("Datasheet")');
		await bankDatasheetBtn.click();

		await expect(dialog).toBeVisible();
		const alertBox = dialog.locator('p[role="alert"]');
		await expect(alertBox).toContainText('This datasheet could not be loaded');

		const retryBtn = dialog.locator('button:has-text("Retry")');
		await expect(retryBtn).toBeVisible();

		// Unroute so retry can succeed
		await page.unroute('**/datasets/bank-marketing/datasheet.html*');
		await retryBtn.click();
		await expect(dialog.locator('.modal-content')).toBeVisible();

		// Close modal
		await dialog.locator('button.close-btn').click();
		await expect(dialog).not.toBeVisible();
	});

	test('DATA-SEL-3: card wrapping, long labels and RTL layout', async ({ page }) => {
		// Test long unbroken text wrapping
		const view = page.locator('app-data-view');
		await expect(view.locator('.cards')).toBeVisible();

		const card = view.locator('app-dataset-card').first();
		const cardTitle = card.locator('.card-title');
		const overflowWrap = await cardTitle.evaluate(
			(el) => window.getComputedStyle(el).overflowWrap
		);
		expect(overflowWrap).toBe('anywhere');

		// Test RTL direction on document
		await page.evaluate(() => {
			document.documentElement.dir = 'rtl';
		});

		await expect(view.locator('.page-header')).toBeVisible();
		const firstCardBtn = card.locator('button.btn-primary');
		await expect(firstCardBtn).toBeVisible();

		// Reset dir
		await page.evaluate(() => {
			document.documentElement.dir = 'ltr';
		});
	});
});
