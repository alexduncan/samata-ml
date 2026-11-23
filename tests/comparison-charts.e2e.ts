import { expect, test } from '@playwright/test';
import type { AppConfusionDelta } from '../src/features/results/app-confusion-delta';
import { bundleResultsFixture, mountResultsFixture } from './helpers/mount-results-fixture';

const bundle = bundleResultsFixture('tests/fixtures/results/comparison-charts.browser.ts');
test.afterAll(() => bundle.dispose());
test.beforeEach(async ({ page }) => {
	await mountResultsFixture(page, bundle, 'summaryFixture');
});

test('WML-P5-UI-4: paired fold strip draws one line per aligned partition', async ({ page }) => {
	const fold = page.locator('app-fold-strip');
	await expect(fold.locator('svg [stroke-opacity="0.6"] path')).toHaveCount(5);
	await expect(fold.locator('svg circle')).toHaveCount(10);
});

test('WML-P5-UI-5: class error bars retain labels and data in forced colours', async ({ page }) => {
	await page.emulateMedia({ forcedColors: 'active' });
	const bars = page.locator('app-class-error-bars');
	await expect(bars.locator('svg rect')).toHaveCount(2);
	await expect(bars.locator('svg').getByText('Adélie · Model 1')).toBeVisible();
	await bars.getByText('Show data table').click();
	await expect(bars.getByRole('table').getByText('Model 1')).toBeVisible();
	await expect(bars.getByRole('table').getByText('20%')).toBeVisible();
});

test('WML-P5-UI-6: signed counts and takeaway follow the active locale', async ({ page }) => {
	const delta = page.locator('app-confusion-delta');
	const formatted: string[] = [];
	for (const locale of ['en-GB', 'de-DE']) {
		await page.evaluate(
			(value) =>
				(
					window as unknown as { summaryFixture: { setLocale(value: string): void } }
				).summaryFixture.setLocale(value),
			locale
		);
		const expected = await page.evaluate(
			(value) =>
				[1234, -1234, 0].map((number) =>
					new Intl.NumberFormat(value, {
						signDisplay: 'exceptZero',
						maximumFractionDigits: 0,
						useGrouping: true
					}).format(number)
				),
			locale
		);
		formatted.push(expected[0]!);
		await expect(delta.getByRole('cell', { name: expected[0], exact: true })).toBeVisible();
		await expect(delta.getByRole('cell', { name: expected[1], exact: true })).toBeVisible();
		await expect(delta.getByText(`Adélie as Gentoo: ${expected[0]}`)).toBeVisible();
		await expect(
			delta.getByRole('cell', { name: new RegExp(`^${expected[2]}.*correct`) })
		).toHaveCount(2);
	}
	expect(formatted[0]).not.toBe(formatted[1]);
	await delta.evaluate((element) => {
		const target = element as AppConfusionDelta;
		target.delta = {
			labelA: 'A',
			labelB: 'B',
			labels: Array.from({ length: 25 }, (_, index) => `Class ${index + 1}`),
			counts: Array(625).fill(0),
			shownClassIndices: Array.from({ length: 20 }, (_, index) => index),
			largest: null
		};
		target.labels = { ...target.labels, takeaway: 'No differences' };
		target.addEventListener('app-confusion-delta-filter-change', (event) => {
			const index = (event as CustomEvent<{ classFilter: number | null }>).detail.classFilter;
			target.classFilter = index;
			target.delta = {
				...target.delta!,
				shownClassIndices:
					index === null ? Array.from({ length: 20 }, (_, i) => i) : [index]
			};
		});
	});
	await expect(delta.getByText('No differences')).toBeVisible();
	await expect(delta.getByRole('combobox', { name: 'True class' })).toBeVisible();
	await expect(delta.getByRole('region', { name: 'Confusion differences' })).toHaveAttribute(
		'tabindex',
		'0'
	);
	await expect(delta.getByRole('columnheader')).toHaveCount(26);
	await delta.getByRole('combobox', { name: 'True class' }).selectOption('22');
	await expect(delta.getByRole('rowheader', { name: 'Class 23' })).toBeVisible();
	await expect(delta.getByRole('rowheader')).toHaveCount(1);
});
