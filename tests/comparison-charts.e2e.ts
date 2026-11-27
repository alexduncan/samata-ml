import { expect, test } from '@playwright/test';
import type { AppConfusionDelta } from '../src/features/results/app-confusion-delta';
import type { AppClassErrorBars } from '../src/features/results/app-class-error-bars';
import type { AppFoldStrip } from '../src/features/results/app-fold-strip';
import { bundleResultsFixture, mountResultsFixture } from './helpers/mount-results-fixture';

const bundle = bundleResultsFixture('tests/fixtures/results/comparison-charts.browser.ts');
test.afterAll(() => bundle.dispose());
test.beforeEach(async ({ page }) => {
	await mountResultsFixture(page, bundle, 'summaryFixture');
});

test('CHT-SINGLE-1: model folds have distinct symbols without connecting lines', async ({
	page
}) => {
	const fold = page.locator('app-fold-strip');
	await expect(fold.locator('.chart svg [stroke-opacity="0.6"] path')).toHaveCount(0);
	await expect(fold.locator('.chart-legend li')).toHaveCount(2);
	await expect(fold).toContainText('Balanced accuracy (%, higher is better)');
	await expect(fold.locator('.chart svg:not([data-plot-probe])')).toContainText('Mean ± 1 SD');
});

test('CHT-FOUND-2: amber fold interval and mean have dark outlines', async ({ page }) => {
	const fold = page.locator('app-fold-strip');
	await fold.evaluate((element) => (element as AppFoldStrip).whenSettled());
	const { lines, amber, blue, dark } = await fold.evaluate((element) => {
		const root = element.shadowRoot!;
		const sample = document.createElement('span');
		root.append(sample);
		const colour = (name: string) => {
			sample.style.color = `var(${name})`;
			return getComputedStyle(sample).color;
		};
		const amber = colour('--amber-500');
		const blue = colour('--blue-700');
		const dark = colour('--stone-900');
		sample.remove();
		const lines = Array.from(
			root.querySelectorAll('.chart > svg[role="img"] line'),
			(line) => ({
				stroke: getComputedStyle(line).stroke,
				width: parseFloat(getComputedStyle(line).strokeWidth),
				coordinates: ['x1', 'y1', 'x2', 'y2'].map((name) => line.getAttribute(name))
			})
		);
		return { lines, amber, blue, dark };
	});
	const amberRules = lines.filter((line) => line.stroke === amber);
	const blueRules = lines.filter((line) => line.stroke === blue);
	const outlines = lines.filter((line) => line.stroke === dark);
	expect(amberRules.map((line) => line.width)).toEqual([3, 4]);
	expect(blueRules.map((line) => line.width)).toEqual([3, 4]);
	expect(outlines).toEqual(
		amberRules.map((line) => ({ ...line, stroke: dark, width: line.width + 3 }))
	);
	for (const [index, outline] of outlines.entries()) {
		expect(lines.indexOf(outline)).toBeLessThan(lines.indexOf(amberRules[index]!));
	}
});

test('WML-P5-UI-5: class error bars retain labels and data in forced colours', async ({ page }) => {
	await page.emulateMedia({ forcedColors: 'active' });
	const bars = page.locator('app-class-error-bars');
	await expect(bars.locator('svg rect')).toHaveCount(2);
	await expect(bars.locator('svg').getByText('1 · Adélie · Model 1')).toBeVisible();
	await bars.getByText('Show data table').click();
	await expect(bars.getByRole('table').getByText('Model 1')).toBeVisible();
	await expect(bars.getByRole('table').getByText('20%')).toBeVisible();
});

test('CHT-COMP-3: wide labels fit at 200% through resize and stay complete in the table', async ({
	page
}) => {
	await page.setViewportSize({ width: 320, height: 800 });
	await page.addStyleTag({ content: 'html { font-size: 200% }' });
	const bars = page.locator('app-class-error-bars');
	const full = 'WWWWMMMMWWWWMMMM wide class label';
	await bars.evaluate((element, label) => {
		const chart = element as AppClassErrorBars;
		chart.rows = chart.rows.map((row) => ({ ...row, label }));
	}, full);
	for (const width of [320, 280, 320]) {
		await page.setViewportSize({ width, height: 800 });
		await bars.evaluate(async (element) => (element as AppClassErrorBars).whenSettled());
		const svg = bars.locator('.chart > svg:not([data-plot-probe])');
		await expect(svg.getByText('…', { exact: false }).first()).toBeVisible();
		await expect
			.poll(() =>
				svg.evaluate((element) => {
					const bounds = element.getBoundingClientRect();
					return [...element.querySelectorAll('text')]
						.filter((text) => {
							const box = text.getBoundingClientRect();
							return box.left < bounds.left - 1 || box.right > bounds.right + 1;
						})
						.map((text) => text.textContent);
				})
			)
			.toEqual([]);
	}
	await bars.getByText('Show data table').click();
	await expect(bars.getByRole('rowheader', { name: full })).toHaveCount(2);
	await expect(bars.getByRole('rowheader', { name: full }).first()).toBeVisible();
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
