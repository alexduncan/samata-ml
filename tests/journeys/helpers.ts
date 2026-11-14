import { expect, type Page } from '@playwright/test';

/**
 * Dismisses the welcome modal if displayed.
 */
export async function dismissWelcomeModal(page: Page): Promise<void> {
	const getStartedBtn = page.locator('app-welcome-modal button.btn-primary');
	try {
		await getStartedBtn.waitFor({ state: 'visible', timeout: 2000 });
		await getStartedBtn.click();
		await page.locator('app-welcome-modal dialog').waitFor({ state: 'hidden', timeout: 2000 });
	} catch {
		// Already dismissed or not displayed
	}
}

/**
 * Selects and loads a sample dataset from the catalogue by clicking its "Load" button.
 */
export async function loadSampleDataset(page: Page, datasetId: string): Promise<void> {
	await dismissWelcomeModal(page);
	const card = page.locator(`app-dataset-card[dataset-id="${datasetId}"]`);
	await card.waitFor({ state: 'visible', timeout: 5000 });
	await card.locator('button.btn-primary').click();

	const preview = page.locator('app-dataset-preview');
	await expect(preview).toBeVisible({ timeout: 10000 });

	const table = preview.locator('ui-virtual-table');
	await expect(table).toBeVisible({ timeout: 10000 });
}
