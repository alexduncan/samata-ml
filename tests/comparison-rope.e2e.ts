import { expect, test } from '@playwright/test';
import type { AppRopeBar } from '../src/features/results/app-rope-bar';
import { bundleResultsFixture, mountResultsFixture } from './helpers/mount-results-fixture';

const bundle = bundleResultsFixture('tests/fixtures/results/comparison-rope.browser.ts');
test.afterAll(() => bundle.dispose());
test.beforeEach(async ({ page }) => {
	await mountResultsFixture(page, bundle, 'summaryFixture');
});

test('WML-P5-UI-7: rounded probabilities total 100 and invalid widths show feedback', async ({
	page
}) => {
	await page.evaluate(() => {
		(window as unknown as { widths: number[] }).widths = [];
		document
			.querySelector('app-rope-bar')!
			.addEventListener('app-rope-width-change', (event) => {
				(window as unknown as { widths: number[] }).widths.push(
					(event as CustomEvent<{ ropeWidth: number }>).detail.ropeWidth
				);
			});
	});
	const rope = page.locator('app-rope-bar');
	await rope.getByText('Show data table').click();
	const table = rope.getByRole('table');
	await expect(table.getByRole('cell', { name: '34%' })).toHaveCount(1);
	await expect(table.getByRole('cell', { name: '33%' })).toHaveCount(2);
	const values = await table.locator('tbody tr td:nth-child(2)').allTextContents();
	expect(
		values.map((value) => Number.parseInt(value, 10)).reduce((sum, value) => sum + value, 0)
	).toBe(100);
	const input = rope.getByLabel('Equivalence width');
	await input.fill('10.1');
	await expect(input).toHaveAttribute('aria-invalid', 'true');
	await expect(input).toHaveAttribute('aria-describedby', 'width-error');
	await expect(rope.getByText('Enter a value from 0.1 to 10.')).toBeVisible();
	expect(await page.evaluate(() => (window as unknown as { widths: number[] }).widths)).toEqual(
		[]
	);
	await input.fill('2');
	await expect(input).toHaveAttribute('aria-invalid', 'false');
	expect(await page.evaluate(() => (window as unknown as { widths: number[] }).widths)).toEqual([
		0.02
	]);
});

test('WML-P5-UI-8: unavailable and error states omit the bar', async ({ page }) => {
	const rope = page.locator('app-rope-bar');
	await expect(
		rope.getByText('Model A and Model B compared within 0.01.', { exact: true })
	).toBeVisible();
	await rope.evaluate((element) => {
		(element as AppRopeBar).status = 'unavailable';
	});
	await expect(
		rope.getByText('Cross-validation folds are required.', { exact: true })
	).toBeVisible();
	await expect(rope.locator('svg')).toHaveCount(0);
	await rope.evaluate((element) => {
		(element as AppRopeBar).status = 'error';
	});
	await expect(rope.getByText('Analysis failed.', { exact: true })).toBeVisible();
	await expect(rope.getByRole('button', { name: 'Retry' })).toBeVisible();
	await expect(rope.locator('svg')).toHaveCount(0);
});

test('WML-P5-UI-9: agreement includes every bucket and hard-case count', async ({ page }) => {
	const agreement = page.locator('app-instance-agreement');
	await expect(agreement.getByText('4 cases were missed by every model.')).toBeVisible();
	await agreement.getByText('Show data table').click();
	await expect(agreement.getByRole('rowheader')).toHaveCount(4);
	const values = await agreement.locator('tbody tr td:nth-child(2)').allTextContents();
	expect(values.map(Number).reduce((sum, value) => sum + value, 0)).toBe(50);
	await expect(agreement.locator('svg rect')).toHaveCount(4);
});

test('CHT-COMP-4: model identity and zero-width outcome remain in the legend and table', async ({
	page
}) => {
	const rope = page.locator('app-rope-bar');
	await rope.evaluate((element) => {
		(element as AppRopeBar).result = {
			probabilityHigher: 0.51,
			probabilityEquivalent: 0,
			probabilityLower: 0.49
		};
	});
	await expect(rope.locator('.chart-legend li')).toHaveCount(3);
	await expect(rope.locator('.chart-legend .swatch-amber')).toHaveCount(1);
	await expect(rope.locator('.chart-legend .swatch-sky')).toHaveCount(1);
	await expect(rope.locator('.chart-legend')).toContainText('0 in 100');
	await rope.getByText('Show data table').click();
	await expect(rope.getByRole('cell', { name: '0%', exact: true })).toBeVisible();
	await expect(rope.locator('p[aria-live="polite"]')).toBeAttached();
});
