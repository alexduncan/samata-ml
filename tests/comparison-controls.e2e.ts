import { expect, test } from '@playwright/test';
import { bundleResultsFixture, mountResultsFixture } from './helpers/mount-results-fixture';
import type { AppModelPairPicker } from '../src/features/results/app-model-pair-picker';
import type { AppComparisonTable } from '../src/features/results/app-comparison-table';

const bundle = bundleResultsFixture('tests/fixtures/results/comparison-controls.browser.ts');
test.afterAll(() => bundle.dispose());

test.beforeEach(async ({ page }) => {
	await mountResultsFixture(page, bundle, 'summaryFixture', { width: '320px' });
});

test('WML-P5-UI-1: sorting cycles and keeps baselines fixed', async ({ page }) => {
	await page.evaluate(() => {
		(window as unknown as { sortEvents: unknown[] }).sortEvents = [];
		document
			.querySelector('app-comparison-table')!
			.addEventListener('app-comparison-sort-change', (event) => {
				(window as unknown as { sortEvents: unknown[] }).sortEvents.push(
					(event as CustomEvent).detail
				);
			});
	});
	const table = page.locator('app-comparison-table');
	const button = table.getByRole('button', { name: 'Balanced accuracy' });
	const header = table.getByRole('columnheader', { name: 'Balanced accuracy' });
	await button.focus();
	await button.click();
	await expect(header).toHaveAttribute('aria-sort', 'ascending');
	await expect(button).toBeFocused();
	await expect(table.locator('tbody').last().getByRole('rowheader')).toContainText(
		'Most frequent'
	);
	await button.click();
	await expect(header).toHaveAttribute('aria-sort', 'descending');
	await button.click();
	await expect(header).not.toHaveAttribute('aria-sort');
	await expect(table.locator('[aria-sort]')).toHaveCount(0);
	expect(
		await page.evaluate(() => (window as unknown as { sortEvents: unknown[] }).sortEvents)
	).toEqual([
		{ sort: { column: 'balancedAccuracy', direction: 'ascending' } },
		{ sort: { column: 'balancedAccuracy', direction: 'descending' } },
		{ sort: null }
	]);
});

test('WML-P5-UI-2: selection limit and keyboard pair swap', async ({ page, browserName }) => {
	const controls = page.locator('app-comparison-controls');
	const ninth = controls.getByRole('checkbox', { name: 'Model 9' });
	await expect(ninth).toBeDisabled();
	await expect(ninth).toHaveAttribute('aria-describedby', 'limit');
	await controls.getByRole('checkbox', { name: 'Model 8' }).uncheck();
	await expect(ninth).toBeEnabled();
	await expect(
		controls.getByRole('option', { name: 'One-Shot, 1 model: another model is needed' })
	).toBeDisabled();
	await expect(
		controls.getByRole('option', { name: 'Cross-validation, 2 models: inconsistent data' })
	).toBeDisabled();

	const pair = page.locator('app-model-pair-picker');
	await page.evaluate(() => {
		(window as unknown as { pairEvents: unknown[] }).pairEvents = [];
		document
			.querySelector('app-model-pair-picker')!
			.addEventListener('app-model-pair-change', (event) => {
				(window as unknown as { pairEvents: unknown[] }).pairEvents.push(
					(event as CustomEvent).detail
				);
			});
	});
	const swap = pair.getByRole('button', { name: 'Swap models A and B' });
	await pair.getByLabel('Model B').focus();
	await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
	await expect(swap).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(pair.getByLabel('Model A')).toHaveValue('2');
	await expect(pair.getByLabel('Model B')).toHaveValue('1');
	await expect(pair.getByRole('status')).toContainText('Model A is Model 2; Model B is Model 1.');
	await expect(swap).toBeFocused();
	await page.keyboard.press('Space');
	await expect(pair.getByLabel('Model A')).toHaveValue('1');
	await expect(pair.getByLabel('Model B')).toHaveValue('2');
	await expect(swap).toBeFocused();
	expect(
		await page.evaluate(() => (window as unknown as { pairEvents: unknown[] }).pairEvents)
	).toEqual([
		{ pairA: 2, pairB: 1 },
		{ pairA: 1, pairB: 2 }
	]);
	await pair.evaluate((element) => {
		(element as AppModelPairPicker).pairB = 1;
	});
	await expect(swap).toBeDisabled();
	expect(
		await page.evaluate(() => (window as unknown as { pairEvents: unknown[] }).pairEvents)
	).toHaveLength(2);
});

test('WML-P5-UI-3: values remain text and decorative bars are hidden', async ({ page }) => {
	const table = page.locator('app-comparison-table');
	await expect(table.getByText('80%')).toBeVisible();
	await expect(table.getByText('Unavailable')).toBeVisible();
	await expect(table.locator('.bar:not([aria-hidden="true"])')).toHaveCount(0);
	await expect(table.getByText(/winner|best/i)).toHaveCount(0);
	await table.evaluate((element) => {
		const tableElement = element as AppComparisonTable;
		tableElement.rows = [
			{
				...tableElement.rows[0]!,
				label: 'A classifier with an exceptionally long descriptive model name that must wrap within the available space'
			},
			tableElement.rows[1]!
		];
	});
	const header = table.getByRole('rowheader', { name: /exceptionally long/ });
	expect(await header.evaluate((element) => element.getBoundingClientRect().width)).toBeLessThan(
		320
	);
	expect(
		await header.evaluate((element) => element.getBoundingClientRect().height)
	).toBeGreaterThan(50);
});
