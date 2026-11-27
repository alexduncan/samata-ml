import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { expectHistogramTicksToFit } from './helpers/calibration-histogram-geometry';
import {
	seedComparableFour,
	seedComparablePair,
	seedTrainedModel,
	type SeedName
} from './helpers/seed-results';

test.setTimeout(90_000);

async function openTables(page: Page): Promise<void> {
	await page.evaluate(() => {
		const open = (root: ParentNode) => {
			for (const element of root.querySelectorAll('*')) {
				if (element instanceof HTMLDetailsElement) element.open = true;
				if (element.shadowRoot) open(element.shadowRoot);
			}
		};
		open(document);
	});
}

async function checkCharts(page: Page, container: string): Promise<void> {
	await page.locator(container).evaluate(async (element) => {
		await (element as HTMLElement & { whenSettled(): Promise<void> }).whenSettled();
	});
	const charts = page.locator(`${container} svg[role="img"]`);
	await expect(charts.first()).toBeVisible();
	for (const chart of await charts.all()) {
		const result = await chart.evaluate((svg) => {
			const id = svg.getAttribute('aria-describedby');
			const root = svg.getRootNode() as ShadowRoot;
			const description = id ? root.getElementById(id)?.textContent?.trim() : '';
			return {
				label: svg.getAttribute('aria-label'),
				description,
				descendantLabels: svg.querySelectorAll('[aria-label]').length,
				unhiddenGroups: svg.querySelectorAll('g:not([aria-hidden="true"])').length,
				fontSizes: Array.from(svg.querySelectorAll('text'), (text) =>
					Number.parseFloat(getComputedStyle(text).fontSize)
				)
			};
		});
		expect(result.label).toBeTruthy();
		expect(result.description).toBeTruthy();
		expect(result.descendantLabels).toBe(0);
		expect(result.unhiddenGroups).toBe(0);
		expect(result.fontSizes.every((size) => size >= 12)).toBe(true);
	}
}

for (const [seed, kind] of [
	['breast-cancer', 'binary'],
	['iris', 'multiclass']
] as const satisfies readonly (readonly [SeedName, string])[]) {
	test(`CHT-A11Y-1: ${kind} results expose described charts and open tables without axe violations`, async ({
		page
	}) => {
		await seedTrainedModel(page, seed);
		await expect(page.locator('app-model-results')).toBeVisible();
		await openTables(page);
		await checkCharts(page, 'app-model-results');
		const audit = await new AxeBuilder({ page })
			.include('app-model-builder-view')
			.withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
			.analyze();
		expect(audit.violations).toEqual([]);
	});
}

test('CHT-A11Y-1: comparison exposes described charts and open tables without axe violations', async ({
	page
}) => {
	await seedComparableFour(page);
	await page.goto('/results');
	await expect(page.locator('app-results-view app-comparison-table')).toBeVisible();
	await page.evaluate(() => {
		const store = window.__appState!;
		const state = store.get();
		const colours = ['amber', 'sky', 'olive', 'neutral'] as const;
		store.set({
			...state,
			models: state.models.map((model) => ({
				...model,
				modelColor: colours[model.num - 1] ?? model.modelColor
			}))
		});
	});
	const view = page.locator('app-results-view');
	for (const colour of ['amber', 'sky', 'olive', 'neutral']) {
		await expect(view.locator(`app-comparison-controls .swatch-${colour}`)).toHaveCount(1);
		await expect(
			view.locator(`app-class-error-bars .chart-legend .swatch-${colour}`)
		).toHaveCount(1);
	}
	const symbols = view.locator('app-fold-strip .chart-legend li svg path');
	await expect(symbols).toHaveCount(4);
	const encodings = await symbols.evaluateAll((paths) =>
		paths.map((path) => ({
			shape: path.getAttribute('d'),
			fill: path.getAttribute('fill'),
			stroke: path.getAttribute('stroke'),
			width: path.getAttribute('stroke-width')
		}))
	);
	expect(new Set(encodings.map(({ shape }) => shape)).size).toBe(4);
	expect(encodings[0]).toMatchObject({ stroke: 'var(--stone-900)', width: '1.5' });
	expect(encodings[2]).toMatchObject({ fill: 'none', stroke: 'var(--olive-700)', width: '2' });
	expect(encodings[3]).toMatchObject({ fill: 'none', stroke: 'var(--neutral-600)', width: '2' });
	await openTables(page);
	await checkCharts(page, 'app-results-view');
	const audit = await new AxeBuilder({ page })
		.include('app-results-view')
		.withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
		.analyze();
	expect(audit.violations).toEqual([]);
});

for (const route of ['binary', 'multiclass', 'comparison'] as const) {
	test(`CHT-A11Y-1: ${route} charts reflow at 320px with enlarged text and RTL`, async ({
		page
	}) => {
		await page.setViewportSize({ width: 320, height: 800 });
		if (route === 'comparison') {
			await seedComparablePair(page);
			await page.goto('/results');
			await expect(page.locator('app-results-view app-comparison-table')).toBeVisible();
		} else {
			await seedTrainedModel(page, route === 'binary' ? 'breast-cancer' : 'iris');
		}
		await page.addStyleTag({ content: 'html { font-size: 32px }' });
		await page.evaluate(() => (document.documentElement.dir = 'rtl'));
		await expect
			.poll(() =>
				page.evaluate(
					() =>
						document.documentElement.scrollWidth <= document.documentElement.clientWidth
				)
			)
			.toBe(true);
		const container = route === 'comparison' ? 'app-results-view' : 'app-model-results';
		const charts = page.locator(`${container} svg[role="img"]`);
		await expect(charts.first()).toBeVisible();
		for (const svg of await charts.all()) {
			await expect
				.poll(() =>
					svg.evaluate((chart) => {
						const bounds = chart.getBoundingClientRect();
						return Array.from(chart.querySelectorAll('text'))
							.filter((text) => {
								const rect = text.getBoundingClientRect();
								return (
									rect.width > 0 &&
									(rect.left < bounds.left - 1 || rect.right > bounds.right + 1)
								);
							})
							.map((text) => text.textContent);
					})
				)
				.toEqual([]);
		}
		for (const target of await page
			.locator(
				`${container} summary, ${container} button, ${container} input, ${container} select`
			)
			.all()) {
			if (!(await target.isVisible())) continue;
			const size = await target.evaluate((element) => {
				const rect = element.getBoundingClientRect();
				if (element instanceof HTMLInputElement && element.type === 'checkbox') {
					return (
						Array.from(element.labels ?? []).some((label) => {
							const box = label.getBoundingClientRect();
							return box.width >= 24 && box.height >= 24;
						}) ||
						(rect.width >= 24 && rect.height >= 24)
					);
				}
				return rect.width >= 24 && rect.height >= 24;
			});
			expect(size).toBe(true);
		}
		for (const dir of ['ltr', 'rtl'] as const) {
			await page.evaluate((direction) => {
				document.documentElement.dir = direction;
			}, dir);
			for (const width of [320, 360]) {
				await page.setViewportSize({ width, height: 800 });
				await page.locator(container).evaluate(async (element) => {
					await (element as HTMLElement & { whenSettled(): Promise<void> }).whenSettled();
				});
				if (route !== 'comparison') {
					await expectHistogramTicksToFit(
						page.locator(
							`${container} app-reliability-diagram .counts > svg[role="img"]`
						)
					);
				}
				for (const svg of await charts.all()) {
					await expect
						.poll(() =>
							svg.evaluate((chart) => {
								const bounds = chart.getBoundingClientRect();
								return Array.from(chart.querySelectorAll('text'))
									.filter((text) => {
										const rect = text.getBoundingClientRect();
										return (
											rect.width > 0 &&
											(rect.left < bounds.left - 1 ||
												rect.right > bounds.right + 1)
										);
									})
									.map((text) => text.textContent);
							})
						)
						.toEqual([]);
				}
			}
		}
	});
}

test('CHT-A11Y-1: forced colours retain chart marks and keyboard focus', async ({
	page,
	browserName
}) => {
	await page.emulateMedia({ forcedColors: 'active' });
	await seedTrainedModel(page, 'breast-cancer');
	const host = page.locator('app-threshold-explorer');
	const slider = host.getByRole('slider');
	for (
		let index = 0;
		index < 100 && !(await slider.evaluate((element) => element.matches(':focus')));
		index++
	) {
		await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
	}
	await expect(slider).toBeFocused();
	const outline = await slider.evaluate((element) => {
		const style = getComputedStyle(element);
		return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) };
	});
	expect(outline.style).not.toBe('none');
	expect(outline.width).toBeGreaterThan(0);
	const marks = host.locator('svg[role="img"] rect');
	await expect(marks.first()).toBeVisible();
	const fill = await marks.first().evaluate((element) => getComputedStyle(element).fill);
	expect(fill).not.toBe('none');
});

test('CHT-A11Y-1: threshold updates a polite announcement', async ({ page }) => {
	await seedTrainedModel(page, 'breast-cancer');
	const threshold = page.locator('app-threshold-explorer');
	await threshold.getByRole('slider').fill('75');
	await expect(threshold.locator('[aria-live="polite"]')).not.toBeEmpty();
});

test('CHT-A11Y-1: comparison class filter updates a polite announcement', async ({ page }) => {
	await seedComparablePair(page, 'many-classes');
	await page.goto('/results');
	const view = page.locator('app-results-view');
	const delta = view.locator('app-confusion-delta');
	await delta.locator('select').selectOption('3');
	await expect(delta.locator('[aria-live="polite"]')).not.toBeEmpty();
});

test('CHT-A11Y-1: comparison ROPE and selection update polite announcements', async ({ page }) => {
	await seedComparablePair(page);
	await page.goto('/results');
	const view = page.locator('app-results-view');
	const rope = view.locator('app-rope-bar');
	await expect(rope.getByRole('spinbutton')).toBeVisible();
	const ropeStatus = rope.locator('[aria-live="polite"]');
	const previous = await ropeStatus.textContent();
	await rope.getByRole('spinbutton').fill('2');
	await expect.poll(() => ropeStatus.textContent()).not.toBe(previous);
	await view.locator('app-comparison-controls input[type="checkbox"]').first().uncheck();
	await expect(view.locator('section.page-body > [aria-live="polite"]')).not.toBeEmpty();
});
