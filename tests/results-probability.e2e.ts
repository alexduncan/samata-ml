import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type {
	ProbabilityFixture,
	ProbabilityMountSpec
} from './fixtures/results/probability.browser';
import { breastCancerOneShot } from './fixtures/results/evaluations';
import {
	bundleResultsFixture,
	mountResultsFixture,
	type MountOptions,
	type ResultsFixtureBundle
} from './helpers/mount-results-fixture';

declare global {
	interface Window {
		probabilityFixture: ProbabilityFixture;
	}
}

const number = (value: number, options?: Intl.NumberFormatOptions) =>
	new Intl.NumberFormat('en-GB', options).format(value);
const percent = (value: number) => number(value, { style: 'percent', maximumFractionDigits: 1 });

test.describe('Section 6 probability views', () => {
	let bundle: ResultsFixtureBundle;
	test.beforeAll(() => {
		bundle = bundleResultsFixture('tests/fixtures/results/probability.browser.ts');
	});
	test.afterAll(() => bundle?.dispose());

	async function mount(
		page: Page,
		spec: ProbabilityMountSpec,
		options?: MountOptions
	): Promise<void> {
		await mountResultsFixture(page, bundle, 'probabilityFixture', options);
		await page.evaluate((value) => window.probabilityFixture.mount(value), spec);
	}

	const events = (page: Page) => page.evaluate(() => window.probabilityFixture.events);

	function readoutAt(index: number) {
		const sweep = breastCancerOneShot().curves.thresholdSweep!;
		return {
			threshold: percent(sweep.thresholds[index]!),
			tp: number(sweep.tp[index]!),
			fp: number(sweep.fp[index]!),
			tn: number(sweep.tn[index]!),
			fn: number(sweep.fn[index]!),
			tpr: `${percent(sweep.tpr[index]!)} (${number(sweep.tp[index]!)} of ${number(sweep.tp[index]! + sweep.fn[index]!)})`,
			fpr: `${percent(sweep.fpr[index]!)} (${number(sweep.fp[index]!)} of ${number(sweep.fp[index]! + sweep.tn[index]!)})`
		};
	}

	async function readout(page: Page) {
		const values = await page.locator('app-threshold-explorer .readout dd').allTextContents();
		const [threshold, tp, fp, tn, fn, tpr, fpr] = values.map((value) => value.trim());
		return { threshold, tp, fp, tn, fn, tpr, fpr };
	}

	async function ruleX(page: Page): Promise<number> {
		return page.locator('app-threshold-explorer').evaluate((host) => {
			const rule = [...host.shadowRoot!.querySelectorAll('svg line')].find(
				(line) =>
					getComputedStyle(line).strokeWidth === '2px' && line.getAttribute('y1') !== null
			);
			return rule!.getBoundingClientRect().x;
		});
	}

	test('WML-P4-UI-7: arrow keys move the threshold by 0.01, Home and End reach 0 and 1', async ({
		page
	}) => {
		await mount(page, { element: 'threshold', evaluation: 'breast-cancer' });
		const slider = page.getByRole('slider', { name: 'Probability threshold' });
		await slider.focus();
		await expect(slider).toHaveValue('50');
		const settle = async (count: number) => {
			await expect.poll(async () => (await events(page)).length).toBe(count);
		};
		await page.keyboard.press('ArrowRight');
		await expect(slider).toHaveValue('51');
		await expect(slider).toHaveAttribute(
			'aria-valuetext',
			'Predict Malignant at 51% or higher'
		);
		await settle(1);
		await page.keyboard.press('ArrowLeft');
		await settle(2);
		await page.keyboard.press('ArrowLeft');
		await expect(slider).toHaveValue('49');
		await settle(3);
		await page.keyboard.press('Home');
		await expect(slider).toHaveValue('0');
		await expect(slider).toHaveAttribute('aria-valuetext', 'Predict Malignant at 0% or higher');
		await settle(4);
		await page.keyboard.press('End');
		await expect(slider).toHaveValue('100');
		await settle(5);
		expect(
			(await events(page)).map((event) => (event.detail as { index: number }).index)
		).toEqual([51, 50, 49, 0, 100]);
		for (const event of await events(page)) {
			expect(event.type).toBe('app-threshold-change');
			expect(event.bubbles && event.composed).toBe(true);
		}
	});

	test('WML-P4-UI-7: counts and rates equal the stored sweep at the index', async ({ page }) => {
		await mount(page, { element: 'threshold', evaluation: 'breast-cancer' });
		expect(await readout(page)).toEqual(readoutAt(50));
		const slider = page.getByRole('slider', { name: 'Probability threshold' });
		for (const index of [0, 13, 87, 100]) {
			await slider.fill(String(index));
			await expect.poll(() => readout(page)).toEqual(readoutAt(index));
		}
	});

	test('WML-P4-UI-7: several inputs in one frame emit a single event with the last value', async ({
		page
	}) => {
		await mount(page, { element: 'threshold', evaluation: 'breast-cancer', echo: false });
		await page.locator('app-threshold-explorer').evaluate(async (host) => {
			const input = host.shadowRoot!.querySelector('input')!;
			for (const value of [10, 20, 30, 40, 55]) {
				input.value = String(value);
				input.dispatchEvent(new Event('input', { bubbles: true }));
			}
			await new Promise((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(resolve))
			);
		});
		const recorded = await events(page);
		expect(recorded).toHaveLength(1);
		expect(recorded[0]!.detail).toEqual({ index: 55 });
		// The readout follows the slider even though the parent ignored the event.
		expect((await readout(page)).threshold).toBe('55%');
	});

	test('WML-P4-UI-7: the rule moves with the threshold', async ({ page }) => {
		await mount(page, { element: 'threshold', evaluation: 'breast-cancer' });
		const slider = page.getByRole('slider', { name: 'Probability threshold' });
		const positions: number[] = [];
		for (const index of [0, 50, 100]) {
			await slider.fill(String(index));
			await page
				.locator('app-threshold-explorer')
				.evaluate((host) =>
					(host as unknown as { whenSettled(): Promise<void> }).whenSettled()
				);
			await expect.poll(() => ruleX(page)).not.toBeNaN();
			positions.push(await ruleX(page));
		}
		await expect
			.poll(async () => {
				await slider.fill('0');
				await slider.fill('100');
				return (await ruleX(page)) > positions[1]!;
			})
			.toBe(true);
		expect(positions[0]).toBeLessThan(positions[1]!);
		expect(Math.abs(positions[1]! - (positions[0]! + positions[2]!) / 2)).toBeLessThan(40);
	});

	test('WML-P4-UI-7: the data table lists every histogram bin from the stored counts', async ({
		page
	}) => {
		await mount(page, { element: 'threshold', evaluation: 'breast-cancer' });
		const explorer = page.locator('app-threshold-explorer');
		await explorer.locator('summary').click();
		await expect(explorer.locator('tbody tr')).toHaveCount(20);
		const sweep = breastCancerOneShot().curves.thresholdSweep!;
		const first = await explorer.locator('tbody tr').first().locator('td').allTextContents();
		expect(first.map((text) => text.trim())).toEqual([
			number(sweep.fp[0]! - sweep.fp[5]!),
			number(sweep.tp[0]! - sweep.tp[5]!)
		]);
		const last = await explorer.locator('tbody tr').last().locator('td').allTextContents();
		expect(last.map((text) => text.trim())).toEqual([
			number(sweep.fp[95]!),
			number(sweep.tp[95]!)
		]);
	});

	test('WML-P4-UI-8: without probabilities both elements render the unavailable sentence and no slider', async ({
		page
	}) => {
		await mount(page, { element: 'threshold', evaluation: 'svc-no-probabilities' });
		await expect(page.locator('app-threshold-explorer')).toContainText(
			'unavailable because this model was trained without probability estimates'
		);
		await expect(page.getByRole('slider')).toHaveCount(0);
		await mount(page, { element: 'reliability', evaluation: 'svc-no-probabilities' });
		await expect(page.locator('app-reliability-diagram')).toContainText(
			'unavailable because this model was trained without probability estimates'
		);
		await expect(page.locator('app-reliability-diagram svg')).toHaveCount(0);
	});

	test('WML-P4-UI-8: multiclass reliability uses top-label bins with ECE in the caption', async ({
		page
	}) => {
		await mount(page, { element: 'reliability', evaluation: 'iris' });
		const diagram = page.locator('app-reliability-diagram');
		await expect(diagram.locator('figcaption')).toContainText(
			'Expected calibration error is 3%'
		);
		await expect(diagram.locator('.chart > svg:not([data-plot-probe])')).toHaveCount(2);
		await diagram.locator('summary').click();
		await expect(diagram.locator('tbody tr')).toHaveCount(10);
	});

	test('WML-P4-UI-8: lines break at empty bins and the table keeps them', async ({ page }) => {
		const strokes = (spec: ProbabilityMountSpec) =>
			mount(page, spec).then(() =>
				page
					.locator('app-reliability-diagram')
					.evaluate(
						(host) =>
							[...host.shadowRoot!.querySelectorAll('svg path')].filter(
								(path) => getComputedStyle(path).stroke === 'rgb(29, 78, 216)'
							).length
					)
			);
		expect(await strokes({ element: 'reliability', evaluation: 'breast-cancer' })).toBe(1);
		expect(
			await strokes({ element: 'reliability', evaluation: 'breast-cancer-empty-bin' })
		).toBe(2);
		const diagram = page.locator('app-reliability-diagram');
		await diagram.locator('summary').click();
		await expect(diagram.locator('tbody tr')).toHaveCount(10);
		await expect(diagram.locator('tbody tr').nth(4)).toContainText('No rows');
		await expect(diagram.locator('tbody tr').nth(4)).toContainText('0');
	});

	test('WML-P4-UI-8: the count histogram aligns with the reliability plot', async ({ page }) => {
		await mount(page, { element: 'reliability', evaluation: 'breast-cancer' });
		const origins = await page.locator('app-reliability-diagram').evaluate((host) =>
			[...host.shadowRoot!.querySelectorAll('.chart > svg:not([data-plot-probe])')].map(
				(svg) => {
					// The x axis is the lowest row of tick labels; the y axis repeats "0%" at the side.
					const lowest = (label: string) =>
						[...svg.querySelectorAll('text')]
							.filter((text) => text.textContent === label)
							.sort(
								(a, b) =>
									b.getBoundingClientRect().top - a.getBoundingClientRect().top
							)[0]!;
					const centre = (text: Element) => {
						const box = text.getBoundingClientRect();
						return box.left + box.width / 2;
					};
					return [centre(lowest('0%')), centre(lowest('100%'))];
				}
			)
		);
		expect(origins).toHaveLength(2);
		expect(Math.abs(origins[0]![0]! - origins[1]![0]!)).toBeLessThan(1.5);
		expect(Math.abs(origins[0]![1]! - origins[1]![1]!)).toBeLessThan(1.5);
	});

	test('WML-P4-UI-9: the stored-scores sentence is always visible next to the slider', async ({
		page
	}) => {
		await mount(page, { element: 'threshold', evaluation: 'breast-cancer' });
		const notice = page
			.locator('app-threshold-explorer')
			.getByText('does not change the stored scores');
		await expect(notice).toBeVisible();
		const slider = page.getByRole('slider');
		for (const key of ['Home', 'End', 'ArrowRight']) {
			await slider.focus();
			await page.keyboard.press(key);
			await expect(notice).toBeVisible();
		}
		const [noticeBox, sliderBox] = await Promise.all([
			notice.boundingBox(),
			slider.boundingBox()
		]);
		expect(Math.abs(noticeBox!.y - sliderBox!.y)).toBeLessThan(80);
		const announcement = page.locator('app-threshold-explorer [aria-live="polite"]');
		await expect(announcement).toContainText(' of ');
	});

	test('CHT-PROB-1: calibration preserves stored rates and totals without invented numerators', async ({
		page
	}) => {
		for (const evaluation of ['breast-cancer', 'iris'] as const) {
			await mount(page, { element: 'reliability', evaluation });
			const diagram = page.locator('app-reliability-diagram');
			await diagram.evaluate(async (host) => {
				const element =
					host as import('../src/features/results/app-reliability-diagram').AppReliabilityDiagram;
				const bins = element.calibration!.bins.map((bin, index) =>
					index === 0
						? { ...bin, count: 3, meanPredicted: 0.5, observed: 0.51 }
						: index === 1
							? { ...bin, count: 0, meanPredicted: null, observed: null }
							: bin
				);
				element.calibration = { ...element.calibration!, bins };
				await element.whenSettled();
			});
			const plot = diagram.locator('.reliability > svg:not([data-plot-probe])');
			await expect(plot).toHaveAttribute('role', 'img');
			const dimensions = await plot.evaluate((svg) => [
				svg.getAttribute('width'),
				svg.getAttribute('height')
			]);
			expect(dimensions[0]).toBe(dimensions[1]);
			await expect(diagram.locator('.counts > svg:not([data-plot-probe])')).toHaveAttribute(
				'aria-describedby',
				'counts-description'
			);
			await diagram.locator('summary').click();
			await expect(diagram.locator('thead')).toContainText(
				evaluation === 'iris' ? 'Correct prediction rate' : 'Observed positive rate'
			);
			const row = diagram.locator('tbody tr').first();
			await expect(row).toContainText('51%');
			await expect(row.locator('td').first()).toHaveText('3');
			await expect(row).not.toContainText('2 of 3');
			await expect(diagram.locator('tbody tr').nth(1)).toContainText('No rows');
		}
	});

	test('CHT-PROB-2: slider announces the final value after idle and labels its cutoff', async ({
		page
	}) => {
		await mount(page, { element: 'threshold', evaluation: 'breast-cancer' });
		const explorer = page.locator('app-threshold-explorer');
		const slider = page.getByRole('slider');
		await slider.fill('0');
		await slider.fill('100');
		await expect(explorer.locator('[aria-live="polite"]')).toContainText(' of ');
		await expect(explorer.locator('.chart > svg:not([data-plot-probe])')).toContainText(
			'Cutoff 100%'
		);
		await expect(explorer.locator('figure details')).toHaveCount(1);
		await expect(explorer.locator('figcaption')).toContainText(' of ');
		await page.setViewportSize({ width: 320, height: 800 });
		await page.addStyleTag({ content: 'html { font-size: 200% }' });
		for (const value of ['0', '100']) {
			await slider.fill(value);
			await expect
				.poll(() =>
					explorer.evaluate((host) => {
						const svg = host.shadowRoot!.querySelector(
							'.chart > svg:not([data-plot-probe])'
						)!;
						const rect = svg.getBoundingClientRect();
						return [...svg.querySelectorAll('text')]
							.filter((text) => text.textContent?.startsWith('Cutoff'))
							.every((text) => {
								const box = text.getBoundingClientRect();
								return box.left >= rect.left - 1 && box.right <= rect.right + 1;
							});
					})
				)
				.toBe(true);
		}
	});

	test('CHT-PROB-1/2: probability axis and annotation text stays within chart bounds at 200%', async ({
		page
	}) => {
		await page.setViewportSize({ width: 320, height: 800 });
		for (const element of ['reliability', 'threshold'] as const) {
			await mount(page, { element, evaluation: 'breast-cancer' }, { width: '100%' });
			await page.addStyleTag({ content: 'html { font-size: 200% }' });
			const host = page.locator(
				element === 'reliability' ? 'app-reliability-diagram' : 'app-threshold-explorer'
			);
			await expect
				.poll(() =>
					host.evaluate((element) =>
						[
							...element.shadowRoot!.querySelectorAll(
								'.chart > svg:not([data-plot-probe])'
							)
						].flatMap((svg) => {
							const box = svg.getBoundingClientRect();
							return [...svg.querySelectorAll('text')]
								.filter((text) => {
									const rect = text.getBoundingClientRect();
									return rect.left < box.left - 1 || rect.right > box.right + 1;
								})
								.map((text) => text.textContent);
						})
					)
				)
				.toEqual([]);
		}
	});

	test('WML-P4-UI-9: reduced motion leaves no transitions or animations', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await mount(page, { element: 'threshold', evaluation: 'breast-cancer' });
		const motion = await page
			.locator('app-threshold-explorer')
			.evaluate(
				(host) =>
					[...host.shadowRoot!.querySelectorAll('*')]
						.map((node) => getComputedStyle(node))
						.filter(
							(style) =>
								style.transitionDuration
									.split(',')
									.some((value) => parseFloat(value) > 0) ||
								style.animationName !== 'none'
						).length
			);
		expect(motion).toBe(0);
	});

	for (const dir of ['ltr', 'rtl'] as const) {
		for (const element of ['threshold', 'reliability'] as const) {
			test(`WML-P4-UI-8: ${element} with long labels reflows at 320 px (${dir}) and passes axe`, async ({
				page
			}) => {
				await page.setViewportSize({ width: 320, height: 800 });
				await mount(
					page,
					{ element, evaluation: 'breast-cancer', longLabels: true },
					{ dir, width: '100%' }
				);
				const tag =
					element === 'threshold' ? 'app-threshold-explorer' : 'app-reliability-diagram';
				await page.locator(`${tag} summary`).click();
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
