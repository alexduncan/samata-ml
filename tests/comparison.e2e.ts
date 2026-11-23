import { expect, test } from '@playwright/test';
import { seedComparablePair } from './helpers/seed-results';

test('WML-P5-UI-10 / WML-P5-UI-11: compare saved models and retain the pair on reload', async ({
	page
}) => {
	await seedComparablePair(page);
	await page.goto('/results');
	const view = page.locator('app-results-view');
	await expect(view.locator('app-comparison-table')).toBeVisible();
	await expect(view.locator('app-fold-strip')).toBeVisible();
	await expect(view.locator('app-class-error-bars')).toBeVisible();
	await expect(view.locator('app-confusion-delta')).toBeVisible();
	await expect(view.locator('app-instance-agreement')).toBeVisible();
	const picker = view.locator('app-model-pair-picker');
	await expect(picker.getByLabel('Model A')).toHaveValue('1');
	await picker.getByRole('button', { name: 'Swap models A and B' }).click();
	await expect(picker.getByLabel('Model A')).toHaveValue('2');
	await expect(view.locator('app-comparison-controls').getByLabel('Model 1')).toBeChecked();
	await expect(view.locator('app-comparison-controls').getByLabel('Model 2')).toBeChecked();
	await expect
		.poll(() =>
			page.evaluate(
				() => JSON.parse(localStorage.getItem('samata-ml:state')!).results.ui.pairA
			)
		)
		.toBe(2);
	await page.reload();
	await expect(picker.getByLabel('Model A')).toHaveValue('2');
	await expect(picker.getByLabel('Model B')).toHaveValue('1');
});

test('WML-P5-UI-12: comparison controls reflow and remain keyboard accessible at 320 px', async ({
	page,
	browserName
}) => {
	await seedComparablePair(page);
	await page.setViewportSize({ width: 320, height: 800 });
	await page.goto('/results');
	const view = page.locator('app-results-view');
	const controls = view.locator('app-comparison-controls');
	const first = controls.getByLabel('Model 1');
	const second = controls.getByLabel('Model 2');
	await expect(first).toBeChecked();
	await first.focus();
	await first.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
	await expect(second).toBeFocused();
	await second.press('Space');
	await expect(view).toContainText('Select at least two models to compare.');
	await second.press('Space');
	await expect(view.locator('app-comparison-table')).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
		true
	);
});
