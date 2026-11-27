import { expect, type Page } from '@playwright/test';

/**
 * Waits until a dataset load has finished and the preview shows its table.
 *
 * `app-dataset-preview` is rendered while a load is still running, so the bare element is not a
 * publication signal. A preview with no `progress` element and an attached table row means the
 * load stage is back to `idle`, the dataset is published and `$appState.dataset` is set. Use this
 * instead of waiting for the element whenever a test then navigates, reloads, reads stored state
 * or interacts as if a dataset exists (virtual-table-improvements D27).
 *
 * @param page - The page showing the data route.
 */
export async function waitForPublishedPreview(page: Page): Promise<void> {
	const preview = page.locator('app-dataset-preview');
	await expect(preview).toBeAttached({ timeout: 60_000 });
	await expect(preview.locator('progress')).toHaveCount(0, { timeout: 60_000 });
	await expect(preview.locator('ui-virtual-table .table-row').first()).toBeAttached({
		timeout: 60_000
	});
}
