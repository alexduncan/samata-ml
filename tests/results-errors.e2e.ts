import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { ErrorMountSpec, ErrorsFixture } from './fixtures/results/errors.browser';
import {
	bundleResultsFixture,
	mountResultsFixture,
	type MountOptions,
	type ResultsFixtureBundle
} from './helpers/mount-results-fixture';

declare global {
	interface Window {
		errorsFixture: ErrorsFixture;
	}
}

test.describe('Section 6 error views', () => {
	let bundle: ResultsFixtureBundle;
	test.beforeAll(() => {
		bundle = bundleResultsFixture('tests/fixtures/results/errors.browser.ts');
	});
	test.afterAll(() => bundle?.dispose());

	async function mount(page: Page, spec: ErrorMountSpec, options?: MountOptions): Promise<void> {
		await mountResultsFixture(page, bundle, 'errorsFixture', options);
		await page.evaluate((value) => window.errorsFixture.mount(value), spec);
	}

	test('WML-P4-UI-5: the flowchart has two actual-class rows with the matrix counts in sentences', async ({
		page
	}) => {
		await mount(page, { element: 'flowchart', evaluation: 'breast-cancer' });
		const flowchart = page.locator('app-confusion-flowchart');
		await expect(flowchart.locator('figure figcaption')).toContainText('Held-out outcomes');
		await expect(flowchart.locator('.rows > li')).toHaveCount(2);
		await expect(flowchart.locator('.outcomes li')).toHaveText([
			'✓ 68 of 71 rows with diagnosis Benign were predicted Benign (correct; 95.8%)',
			'✗ 3 of 71 rows with diagnosis Benign were predicted Malignant (incorrect; 4.2%)',
			'✗ 4 of 43 rows with diagnosis Malignant were predicted Benign (incorrect; 9.3%)',
			'✓ 39 of 43 rows with diagnosis Malignant were predicted Malignant (correct; 90.7%)'
		]);
		await expect(flowchart.locator('.heading').first()).toHaveText(
			'Rows with diagnosis Benign: 71'
		);
	});

	test('CHT-SINGLE-2: wide class labels fit after resize and remain complete in the table', async ({
		page
	}) => {
		await page.setViewportSize({ width: 320, height: 800 });
		await mount(page, { element: 'classee', evaluation: 'iris' }, { width: '100%' });
		await page.addStyleTag({ content: 'html { font-size: 200% }' });
		const strips = page.locator('app-classee-strips');
		const label = 'WWWW MMMM WWWW MMMM wide class label';
		await strips.evaluate(async (host, value) => {
			const chart =
				host as import('../src/features/results/app-classee-strips').AppClasseeStrips;
			chart.strips = {
				...chart.strips!,
				rows: chart.strips!.rows.map((row, i) => (i ? row : { ...row, label: value }))
			};
			await chart.whenSettled();
		}, label);
		await strips.locator('summary').click();
		await expect(strips.locator('tbody')).toContainText(label);
		await expect(strips.locator('.chart > svg:not([data-plot-probe])')).toContainText('…');
		for (const width of [320, 280]) {
			await page.setViewportSize({ width, height: 800 });
			await expect
				.poll(() =>
					strips.evaluate((host) => {
						const svg = host.shadowRoot!.querySelector('.chart > svg')!;
						const bounds = svg.getBoundingClientRect();
						return [...svg.querySelectorAll('text')]
							.filter((node) => {
								const rect = node.getBoundingClientRect();
								return rect.left < bounds.left - 1 || rect.right > bounds.right + 1;
							})
							.map((node) => node.textContent);
					})
				)
				.toEqual([]);
		}
	});

	test('BETA-ERR-2b / WML-P4-UI-5: outcome bar widths are proportional to the counts', async ({
		page
	}) => {
		await mount(page, { element: 'flowchart', evaluation: 'breast-cancer' });
		const rows = await page.locator('app-confusion-flowchart').evaluate((host) =>
			[...host.shadowRoot!.querySelectorAll('.rows > li')].map((row) => {
				const bar = row.querySelector('.bar')!.getBoundingClientRect().width;
				return [...row.querySelectorAll('.segment')].map(
					(segment) => segment.getBoundingClientRect().width / bar
				);
			})
		);
		const expected = [
			[68 / 71, 3 / 71],
			[4 / 43, 39 / 43]
		];
		rows.forEach((row, index) => {
			expect(row).toHaveLength(2);
			row.forEach((share, position) => {
				expect(Math.abs(share / expected[index]![position]! - 1)).toBeLessThan(0.02);
			});
		});
	});

	test('WML-P4-UI-5: zero outcomes keep their sentence and consume no bar width', async ({
		page
	}) => {
		await mount(page, { element: 'flowchart', evaluation: 'breast-cancer-perfect' });
		const flowchart = page.locator('app-confusion-flowchart');
		await expect(flowchart.locator('.segment')).toHaveCount(2);
		await expect(flowchart.locator('.outcomes li').nth(1)).toContainText(
			'0 of 71 rows with diagnosis Benign were predicted Malignant (incorrect; 0%)'
		);
	});

	test('WML-P4-UI-5: a model that predicts one class shows a full-width error bar', async ({
		page
	}) => {
		await mount(page, { element: 'flowchart', evaluation: 'breast-cancer-one-class' });
		const flowchart = page.locator('app-confusion-flowchart');
		await expect(flowchart.locator('.segment.wrong')).toHaveCount(1);
		await expect(flowchart.locator('.segment.correct')).toHaveCount(1);
		const widths = await flowchart.evaluate((host) => {
			const row = host.shadowRoot!.querySelectorAll('.rows > li')[1]!;
			return [
				row.querySelector('.segment')!.getBoundingClientRect().width,
				row.querySelector('.bar')!.getBoundingClientRect().width
			];
		});
		expect(widths[0]).toBeCloseTo(widths[1]!, 0);
	});

	test('WML-P4-UI-5: forced colours keep every sentence and icon, and outlines separate outcomes', async ({
		page,
		browserName
	}) => {
		test.skip(browserName === 'webkit', 'WebKit does not emulate forced-colors in Playwright');
		await page.emulateMedia({ forcedColors: 'active' });
		await mount(page, { element: 'flowchart', evaluation: 'breast-cancer' });
		const flowchart = page.locator('app-confusion-flowchart');
		await expect(flowchart.locator('.outcomes li')).toHaveCount(4);
		for (const item of await flowchart.locator('.outcomes li').all()) {
			await expect(item).toBeVisible();
			await expect(item.locator('.icon')).toBeVisible();
		}
		const borders = await flowchart.evaluate((host) =>
			[...host.shadowRoot!.querySelectorAll('.segment')].map((segment) => {
				const style = getComputedStyle(segment);
				return [style.borderTopStyle, style.borderTopWidth];
			})
		);
		expect(borders.map(([style]) => style)).toEqual(['solid', 'dashed', 'dashed', 'solid']);
		for (const [, width] of borders) expect(parseFloat(width!)).toBeGreaterThanOrEqual(2);
	});

	test('WML-P4-UI-6: the Classee chart has three rows, correct right of zero and errors left', async ({
		page
	}) => {
		await mount(page, { element: 'classee', evaluation: 'iris' });
		const geometry = await page.locator('app-classee-strips').evaluate((host) => {
			const rects = [...host.shadowRoot!.querySelectorAll('.chart > svg rect')].map(
				(rect) => ({
					x: Number(rect.getAttribute('x')),
					width: Number(rect.getAttribute('width')),
					y: rect.getAttribute('y'),
					fill: getComputedStyle(rect).fill
				})
			);
			return rects;
		});
		const neutral = geometry.filter((rect) => rect.fill === 'rgb(136, 123, 113)');
		const errors = geometry.filter((rect) => rect.fill !== 'rgb(136, 123, 113)');
		expect(new Set(geometry.map((rect) => rect.y)).size).toBe(3);
		expect(neutral).toHaveLength(3);
		expect(errors).toHaveLength(2);
		const zero = neutral[0]!.x;
		for (const rect of neutral) expect(rect.x).toBeCloseTo(zero, 1);
		for (const rect of errors) expect(rect.x + rect.width).toBeLessThanOrEqual(zero + 0.5);
	});

	test('WML-P4-UI-6: the data table reproduces every non-zero off-diagonal cell', async ({
		page
	}) => {
		await mount(page, { element: 'classee', evaluation: 'iris' });
		const strips = page.locator('app-classee-strips');
		await strips.locator('summary').click();
		const errors = strips.locator('tbody tr').filter({ hasText: 'Error' });
		await expect(errors).toHaveCount(2);
		await expect(errors.nth(0)).toContainText('versicolor');
		await expect(errors.nth(0)).toContainText('virginica');
		await expect(errors.nth(0)).toContainText('4');
		await expect(errors.nth(1)).toContainText('2');
		// Three correct runs plus two error cells.
		await expect(strips.locator('tbody tr')).toHaveCount(5);
		await expect(strips.locator('figcaption')).toContainText('Held-out errors by true class');
	});

	test('WML-P4-UI-6: a perfect model shows No errors text instead of an empty left side', async ({
		page
	}) => {
		await mount(page, { element: 'classee', evaluation: 'iris-perfect' });
		const strips = page.locator('app-classee-strips');
		await expect(strips).toContainText('No errors');
		const probe = await strips.evaluate((host) => {
			const rects = [...host.shadowRoot!.querySelectorAll('.chart > svg rect')];
			const fills = new Set(rects.map((rect) => getComputedStyle(rect).fill));
			const text = host.shadowRoot!.querySelector('svg')!.textContent!;
			return { fills: [...fills], hasErrorsSide: text.includes('Errors') };
		});
		expect(probe.fills).toEqual(['rgb(136, 123, 113)']);
		expect(probe.hasErrorsSide).toBe(false);
	});

	test('WML-P4-UI-6: twenty-five classes show twenty rows and a selected class shows one', async ({
		page
	}) => {
		await mount(page, { element: 'classee', evaluation: 'many-classes' });
		const rows = () =>
			page
				.locator('app-classee-strips')
				.evaluate(
					(host) =>
						new Set(
							[...host.shadowRoot!.querySelectorAll('.chart > svg rect')].map(
								(rect) => rect.getAttribute('y')
							)
						).size
				);
		expect(await rows()).toBe(20);
		await mount(page, { element: 'classee', evaluation: 'many-classes', classFilter: 4 });
		expect(await rows()).toBe(1);
	});

	for (const dir of ['ltr', 'rtl'] as const) {
		for (const spec of [
			{ element: 'flowchart', evaluation: 'breast-cancer' },
			{ element: 'classee', evaluation: 'iris' },
			{ element: 'classee', evaluation: 'many-classes' }
		] as const) {
			test(`WML-P4-UI-5: ${spec.element} (${spec.evaluation}) with long labels reflows at 320 px (${dir}) and passes axe`, async ({
				page
			}) => {
				await page.setViewportSize({ width: 320, height: 800 });
				await mount(page, { ...spec, longLabels: true }, { dir, width: '100%' });
				if (spec.element === 'classee') {
					await page.locator('app-classee-strips summary').click();
				}
				const overflow = await page.evaluate(
					() =>
						document.documentElement.scrollWidth - document.documentElement.clientWidth
				);
				expect(overflow).toBeLessThanOrEqual(0);
				const results = await new AxeBuilder({ page }).analyze();
				expect(results.violations.map((violation) => violation.id)).toEqual([]);
			});
		}
	}
});
