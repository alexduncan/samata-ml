import { expect, type Locator, type Page } from '@playwright/test';
import type { SampleDatasetIndex } from '../../src/types/sample-dataset';

/** Waits for a reserved content dialog to hide and history to restore the underlay URL. */
export async function expectReservedModalClosed(
	page: Page,
	modal: Locator,
	underlayUrl: RegExp | string
): Promise<void> {
	await expect(modal).toBeHidden();
	await expect(page).toHaveURL(underlayUrl);
}

/** Waits until the persisted application state satisfies a predicate evaluated in Node. */
export async function waitForPersistedAppState(
	page: Page,
	predicate: (state: Record<string, unknown>) => boolean
): Promise<void> {
	await expect
		.poll(async () => {
			const raw = await page.evaluate(() => localStorage.getItem('samata-ml:state'));
			if (raw === null) return false;
			const state: unknown = JSON.parse(raw);
			if (typeof state !== 'object' || state === null || Array.isArray(state)) return false;
			return predicate(state as Record<string, unknown>);
		})
		.toBe(true);
}

/** Returns the number of entries in the current checkout's served sample catalogue. */
export async function fetchSampleDatasetCount(page: Page): Promise<number> {
	const response = await page.request.get('/datasets/index.json');
	await expect(response).toBeOK();
	const catalogue = (await response.json()) as SampleDatasetIndex;
	return catalogue.entries.length;
}
