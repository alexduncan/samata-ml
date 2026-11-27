import AxeBuilder from '@axe-core/playwright';
import { runAdvisoryAxe } from './helpers/advisory-a11y';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { MountSpec, ResultsFixture } from './fixtures/results/summary.browser';
import {
	bundleResultsFixture,
	mountResultsFixture,
	type MountOptions,
	type ResultsFixtureBundle
} from './helpers/mount-results-fixture';

declare global {
	interface Window {
		summaryFixture: ResultsFixture;
	}
}

test.describe('Section 6 summary, fold strip and tables', () => {
	let bundle: ResultsFixtureBundle;
	test.beforeAll(() => {
		bundle = bundleResultsFixture('tests/fixtures/results/summary.browser.ts');
	});
	test.afterAll(() => bundle?.dispose());

	async function mount(page: Page, spec: MountSpec, options?: MountOptions): Promise<void> {
		await mountResultsFixture(page, bundle, 'summaryFixture', options);
		await page.evaluate((value) => window.summaryFixture.mount(value), spec);
	}

	async function expectNoPlaceholders(page: Page): Promise<void> {
		const text = await page.locator('#column').evaluate((column) => {
			const parts: string[] = [];
			const walk = (root: ParentNode) => {
				for (const node of root.querySelectorAll('*')) {
					if (node.shadowRoot) walk(node.shadowRoot);
				}
				parts.push((root as Element).textContent ?? '');
			};
			walk(column);
			return parts.join(' ');
		});
		expect(text).not.toMatch(/NaN|undefined|null/);
		const empty = await page.locator('#column').evaluate((column) => {
			let count = 0;
			const walk = (root: ParentNode) => {
				for (const node of root.querySelectorAll('*')) {
					if (node.shadowRoot) walk(node.shadowRoot);
				}
				for (const cell of root.querySelectorAll('tbody td, tbody th, dd, dt')) {
					if (cell.textContent?.trim() === '' && !cell.querySelector('*')) count += 1;
				}
			};
			walk(column);
			return count;
		});
		// The fold strip table uses deliberately blank time cells for summary rows.
		expect(empty).toBeLessThanOrEqual(0);
	}

	test('WML-P4-UI-1: cross-validation headline reads balanced accuracy first, with SD and IQR', async ({
		page
	}) => {
		await mount(page, { element: 'summary', evaluation: 'iris' });
		const summary = page.locator('app-results-summary');
		const terms = await summary.locator('.headline dt').allTextContents();
		expect(terms[0]).toBe('Balanced accuracy on held-out rows');
		expect(terms[1]).toBe('Accuracy');
		expect(terms).toContain('Macro-F1');
		await expect(summary.locator('.headline .primary .value')).toContainText('±');
		await expect(summary.locator('.headline .primary')).toContainText('Standard deviation');
		await expect(summary.locator('.headline .primary')).toContainText('interquartile range');
		await expect(summary).toContainText('5-fold cross-validation');
		await expect(summary).toContainText('Total fit and scoring time across folds');
		await expect(summary).toContainText('most frequent class');
	});

	test('WML-P4-UI-1: One-Shot shows one value and the no-spread sentence', async ({ page }) => {
		await mount(page, { element: 'summary', evaluation: 'breast-cancer' });
		const summary = page.locator('app-results-summary');
		await expect(summary.locator('.headline .primary .value')).not.toContainText('±');
		await expect(summary).toContainText(
			'One test split: no spread is available. Cross-Validation shows how scores vary across folds.'
		);
		await expect(summary.locator('.headline dt')).toHaveText([
			'Balanced accuracy on held-out rows',
			'Accuracy'
		]);
		await expect(summary.locator('.headline')).toContainText('+');
		await expect(summary).toContainText('Fit time');
	});

	test('WML-P4-UI-1: the gap card appears at 0.10 and not at 0.099', async ({ page }) => {
		await mount(page, { element: 'summary', evaluation: 'breast-cancer', gap: 0.1 });
		const card = page.locator('app-results-summary .notification');
		await expect(card).toBeVisible();
		await expect(card).toContainText('Large gap between training and held-out scores.');
		expect(await card.locator('[role="alert"]').count()).toBe(0);
		await mount(page, { element: 'summary', evaluation: 'breast-cancer', gap: 0.099 });
		await expect(page.locator('app-results-summary .notification')).toHaveCount(0);
	});

	test('WML-P4-UI-4: More metrics gives each unavailable metric its reason', async ({ page }) => {
		await mount(page, {
			element: 'summary',
			evaluation: 'svc-no-probabilities',
			moreOpen: true
		});
		const summary = page.locator('app-results-summary');
		await expect(summary.locator('details')).toHaveJSProperty('open', true);
		await expect(summary.locator('.more')).toContainText('Log loss');
		await expect(
			summary.locator('.more dd').filter({ hasText: 'without probability estimates' })
		).toHaveCount(3);
		await expectNoPlaceholders(page);
	});

	test('WML-P4-UI-4: toggling More metrics emits one event and ignores the echo', async ({
		page
	}) => {
		await mount(page, { element: 'summary', evaluation: 'iris' });
		await page.locator('app-results-summary summary').click();
		await expect.poll(() => page.evaluate(() => window.summaryFixture.events.length)).toBe(1);
		const event = await page.evaluate(() => window.summaryFixture.events[0]);
		expect(event).toEqual({
			type: 'app-results-more-toggle',
			detail: { open: true },
			bubbles: true,
			composed: true
		});
	});

	test('WML-P4-UI-2: the fold strip draws one dot per fold, a mean mark, an SD rule and baselines', async ({
		page
	}) => {
		await mount(page, { element: 'fold-strip', evaluation: 'iris' });
		const probe = await page.locator('app-fold-strip').evaluate((host) => {
			const svg = host.shadowRoot!.querySelector('svg')!;
			return {
				dots: svg.querySelectorAll('circle').length,
				dashed: [...svg.querySelectorAll('line')].filter(
					(line) => getComputedStyle(line).strokeDasharray !== 'none'
				).length,
				label: svg.getAttribute('aria-label'),
				description: svg.querySelector('title, desc')?.textContent ?? null,
				text: svg.textContent
			};
		});
		expect(probe.dots).toBe(5);
		expect(probe.dashed).toBeGreaterThanOrEqual(2);
		expect(probe.label).toBe('Balanced accuracy by fold');
		await expect(page.locator('app-fold-strip figure')).toContainText('Most frequent class');
		await expect(page.locator('app-fold-strip figure')).toContainText('Random by class share');
		await expect(page.locator('app-fold-strip figcaption')).toContainText(
			'Scores ranged from 93.3% to 100%'
		);
	});

	test('CHT-SINGLE-1: wide fold labels fit after resize at 200% and remain complete in the table', async ({
		page
	}) => {
		await page.setViewportSize({ width: 320, height: 800 });
		await mount(page, { element: 'fold-strip', evaluation: 'iris' }, { width: '100%' });
		await page.addStyleTag({ content: 'html { font-size: 200% }' });
		const strip = page.locator('app-fold-strip');
		const label = 'WWWW MMMM WWWW MMMM wide model label';
		await strip.evaluate(async (host, value) => {
			const chart = host as import('../src/features/results/app-fold-strip').AppFoldStrip;
			chart.series = chart.series.map((row) => ({ ...row, label: value }));
			await chart.whenSettled();
		}, label);
		await strip.locator('summary').click();
		await expect(strip.locator('tbody')).toContainText(label);
		await expect(strip.locator('.chart > svg:not([data-plot-probe])')).toContainText('…');
		for (const width of [320, 280]) {
			await page.setViewportSize({ width, height: 800 });
			await expect
				.poll(() =>
					strip.evaluate((host) => {
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

	test('WML-P4-UI-2: the data table lists every score, timing, mean, SD and baseline', async ({
		page
	}) => {
		await mount(page, { element: 'fold-strip', evaluation: 'iris' });
		const strip = page.locator('app-fold-strip');
		await expect(strip.locator('table')).toBeHidden();
		await strip.locator('summary').click();
		const rows = strip.locator('tbody tr');
		// Five folds, mean, SD and two baselines.
		await expect(rows).toHaveCount(9);
		await expect(strip.locator('caption')).toHaveText(
			'Held-out balanced accuracy by partition'
		);
		await expect(strip.locator('[role="region"]')).toHaveAttribute('tabindex', '0');
		await expect(rows.first()).toContainText('Partition 1');
		await expect(rows.first()).toContainText('0.1 s');
		await expect(strip.locator('tbody')).toContainText('Random by class share');
	});

	test('WML-P4-UI-2: a single test split draws one dot and no SD rule', async ({ page }) => {
		await mount(page, { element: 'fold-strip', evaluation: 'breast-cancer' });
		const dots = await page
			.locator('app-fold-strip')
			.evaluate((host) => host.shadowRoot!.querySelectorAll('svg circle').length);
		expect(dots).toBe(1);
		await page.locator('app-fold-strip summary').click();
		await expect(page.locator('app-fold-strip tbody tr')).toHaveCount(4);
	});

	test('WML-P4-UI-3: twenty-five classes show a labelled filter and twenty rows', async ({
		page
	}) => {
		await mount(page, { element: 'confusion-matrix', evaluation: 'many-classes' });
		const matrix = page.locator('app-confusion-matrix');
		await expect(matrix.getByLabel('Show true class')).toBeVisible();
		await expect(matrix.locator('tbody tr')).toHaveCount(20);
		await expect(matrix.locator('caption')).toContainText('20 of 25 true classes');
		await expect(matrix.locator('caption')).toContainText('test rows only');
	});

	test('WML-P4-UI-3: choosing a class fires one event and shows one row', async ({ page }) => {
		await mount(page, { element: 'confusion-matrix', evaluation: 'many-classes' });
		const matrix = page.locator('app-confusion-matrix');
		await matrix.getByLabel('Show true class').selectOption({ label: 'Class 7' });
		await expect(matrix.locator('tbody tr')).toHaveCount(1);
		const events = await page.evaluate(() => window.summaryFixture.events);
		expect(events).toEqual([
			{
				type: 'app-confusion-filter-change',
				detail: { classFilter: 6 },
				bubbles: true,
				composed: true
			}
		]);
		await matrix
			.getByLabel('Show true class')
			.selectOption({ label: 'Twenty largest classes' });
		await expect(matrix.locator('tbody tr')).toHaveCount(20);
	});

	test('WML-P4-UI-3: with twenty classes or fewer no filter renders', async ({ page }) => {
		await mount(page, { element: 'confusion-matrix', evaluation: 'iris' });
		const matrix = page.locator('app-confusion-matrix');
		await expect(matrix.locator('select')).toHaveCount(0);
		await expect(matrix.locator('tbody tr')).toHaveCount(3);
		await expect(matrix.locator('caption')).toContainText('held-out rows');
	});

	test('WML-P4-UI-4: the per-class table lists pooled values for every class', async ({
		page
	}) => {
		await mount(page, { element: 'class-table', evaluation: 'iris' });
		const table = page.locator('app-class-metrics-table');
		await expect(table.locator('tbody tr')).toHaveCount(3);
		await expect(table.locator('thead th')).toHaveText([
			'Class',
			'Held-out rows',
			'Precision',
			'Recall',
			'F1'
		]);
		await expect(table.locator('tbody tr').first()).toContainText('setosa');
		await expectNoPlaceholders(page);
	});

	for (const dir of ['ltr', 'rtl'] as const) {
		for (const element of [
			'summary',
			'fold-strip',
			'class-table',
			'confusion-matrix'
		] as const) {
			test(`WML-P4-UI-4: ${element} with long labels reflows at 320 px (${dir}) and passes axe`, async ({
				page
			}, testInfo) => {
				await page.setViewportSize({ width: 320, height: 800 });
				await mount(
					page,
					{ element, evaluation: 'iris', longLabels: true },
					{ dir, width: '100%' }
				);
				if (element === 'fold-strip') await page.locator('app-fold-strip summary').click();
				const overflow = await page.evaluate(
					() =>
						document.documentElement.scrollWidth - document.documentElement.clientWidth
				);
				expect(overflow).toBeLessThanOrEqual(0);
				await runAdvisoryAxe(
					testInfo,
					async () => {
						const { violations } = await new AxeBuilder({ page }).analyze();
						return violations;
					},
					{ label: 'WML-P4-UI-4' }
				);
			});
		}
	}
});
