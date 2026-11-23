import { expect, test } from '@playwright/test';
import { seedComparableGroups, seedComparablePair } from './helpers/seed-results';

for (const [fixture, label] of [
	['iris', 'Fit + score across folds (lower is better)'],
	['breast-cancer', 'Fit time (lower is better)']
] as const) {
	test(`WML-P5-UI-10: ${fixture} timing header identifies lower as better`, async ({ page }) => {
		await seedComparablePair(page, fixture);
		await page.goto('/results');
		await expect(
			page.locator('app-comparison-table').getByRole('columnheader', { name: label })
		).toBeVisible();
	});
}

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

test('WML-P5-UI-12: comparison reflows at simulated 200% zoom', async ({ page }) => {
	await seedComparablePair(page);
	await page.setViewportSize({ width: 640, height: 900 });
	await page.goto('/results');
	await page.evaluate(() => {
		document.documentElement.style.zoom = '2';
	});
	await expect(page.locator('app-results-view app-comparison-table')).toBeVisible();
	await expect(page.locator('app-comparison-controls').getByLabel('Model 1')).toBeVisible();
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= document.documentElement.clientWidth
		)
	).toBe(true);
});

test('WML-P5-UI-12: keyboard reaches comparison controls in visual order', async ({
	page,
	browserName
}) => {
	await seedComparablePair(page);
	await page.goto('/results');
	const view = page.locator('app-results-view');
	await expect(view.locator('app-rope-bar figure')).toBeVisible({ timeout: 45_000 });
	await view.locator('app-comparison-controls').getByLabel('Model 1').focus();
	const visited: string[] = [];
	for (let i = 0; i < 50; i++) {
		const focus = await page.evaluate(() => {
			let active: Element | null = document.activeElement;
			while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
			if (!active) return '';
			return (
				active.id || (active as HTMLButtonElement).value || active.textContent?.trim() || ''
			);
		});
		visited.push(focus);
		if (focus === 'width') break;
		await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
	}
	const expected = [
		'model-1',
		'model-2',
		'balancedAccuracy',
		'pair-a',
		'pair-b',
		'Swap models A and B',
		'width'
	];
	const positions = expected.map((item) => visited.indexOf(item));
	expect(positions, visited.join(' → ')).toEqual([...positions].sort((a, b) => a - b));
	expect(
		positions.every((position) => position >= 0),
		visited.join(' → ')
	).toBe(true);
});

test('WML-P5-UI-10: swapping reverses nonzero confusion differences and refreshes analysis', async ({
	page
}) => {
	await seedComparablePair(page, 'iris', 'different-confusion');
	await page.goto('/results');
	const view = page.locator('app-results-view');
	const matrix = view.locator('app-confusion-delta tbody td');
	await expect(matrix.first()).toContainText('+1');
	const rope = view.locator('app-rope-bar');
	await expect(rope.locator('figure')).toBeVisible({ timeout: 45_000 });
	await view
		.locator('app-model-pair-picker')
		.getByRole('button', { name: 'Swap models A and B' })
		.click();
	await expect(matrix.first()).toContainText('-1');
	await expect(rope).toHaveJSProperty('status', 'loading');
	await expect(rope.locator('figure')).toBeVisible({ timeout: 45_000 });
	await expect(view.locator('app-comparison-controls').getByLabel('Model 1')).toBeChecked();
	await expect(view.locator('app-comparison-controls').getByLabel('Model 2')).toBeChecked();
});

test('WML-P5-UI-11: a many-class confusion filter survives reload', async ({ page }) => {
	await seedComparablePair(page, 'many-classes');
	await page.goto('/results');
	const view = page.locator('app-results-view');
	const filter = view.locator('app-confusion-delta').getByLabel('True class');
	await filter.selectOption('3');
	await expect
		.poll(() =>
			page.evaluate(
				() => JSON.parse(localStorage.getItem('samata-ml:state')!).results.ui.classFilter
			)
		)
		.toBe(3);
	await page.reload();
	await expect(filter).toHaveValue('3');
	await expect(view.locator('app-confusion-delta tbody tr')).toHaveCount(1);
});

test('WML-P5-UI-10: incompatible evaluation groups are listed separately', async ({ page }) => {
	await seedComparablePair(page, 'iris', 'different-group');
	await page.goto('/results');
	const view = page.locator('app-results-view');
	await expect(view).toContainText('These models were evaluated on different rows');
	await expect(view.locator('ul li')).toHaveCount(2);
	await expect(view.locator('app-comparison-table')).toHaveCount(0);
});

test('WML-P5-UI-11: sorting and equivalence width survive reload', async ({ page }) => {
	await seedComparablePair(page);
	await page.goto('/results');
	const view = page.locator('app-results-view');
	const table = view.locator('app-comparison-table');
	await table.getByRole('button', { name: 'Balanced accuracy' }).click();
	const sortedHeader = table.locator('th:has(button[value="balancedAccuracy"])');
	await expect(sortedHeader).toHaveAttribute('aria-sort', 'ascending');
	const width = view.locator('app-rope-bar').getByLabel('Equivalence width');
	await width.fill('0.02');
	await expect
		.poll(() =>
			page.evaluate(
				() => JSON.parse(localStorage.getItem('samata-ml:state')!).results.ui.ropeWidth
			)
		)
		.toBe(0.02);
	await page.reload();
	await expect(width).toHaveValue('0.02');
	await expect(sortedHeader).toHaveAttribute('aria-sort', 'ascending');
});

test('WML-P5-UI-11: the chosen group and single-model selection survive reload', async ({
	page
}) => {
	test.setTimeout(60_000);
	await seedComparableGroups(page);
	await page.goto('/results');
	const view = page.locator('app-results-view');
	const controls = view.locator('app-comparison-controls');
	const group = controls.getByLabel('Evaluation group');
	await group.selectOption('b'.repeat(64));
	await expect(controls.getByLabel('Model 3')).toBeChecked();
	await controls.getByLabel('Model 4').uncheck();
	await expect(view).toContainText('Select at least two models to compare.');
	await expect
		.poll(() =>
			page.evaluate(
				() => JSON.parse(localStorage.getItem('samata-ml:state')!).results.ui.selected
			)
		)
		.toEqual([3]);
	await page.reload();
	await expect(group).toHaveValue('b'.repeat(64));
	await expect(controls.getByLabel('Model 3')).toBeChecked();
	await expect(controls.getByLabel('Model 4')).not.toBeChecked();
	await expect(view.locator('app-comparison-table')).toHaveCount(0);
});

test('WML-P5-UI-11: settlement waits for visible charts and releases on disconnection', async ({
	page
}) => {
	await seedComparablePair(page);
	await page.goto('/results');
	await expect(page.locator('app-results-view app-rope-bar figure')).toBeVisible({
		timeout: 45_000
	});
	const result = await page.locator('app-results-view').evaluate(async (element) => {
		const view = element as HTMLElement & { whenSettled(): Promise<void> };
		const chart = view.shadowRoot!.querySelector('app-fold-strip') as HTMLElement & {
			whenSettled(): Promise<void>;
		};
		chart.whenSettled = () => new Promise<void>(() => {});
		let completed = false;
		const settling = view.whenSettled().then(() => {
			completed = true;
		});
		await new Promise((resolve) => setTimeout(resolve, 100));
		const waitedForChart = !completed;
		view.remove();
		const released = await Promise.race([
			settling.then(() => true),
			new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1000))
		]);
		return { waitedForChart, released };
	});
	expect(result).toEqual({ waitedForChart: true, released: true });
});

test('WML-P5-UI-11: initial settlement waits for the paired analysis', async ({ page }) => {
	await seedComparablePair(page);
	await page.addInitScript(() => {
		const NativeWorker = window.Worker;
		window.Worker = new Proxy(NativeWorker, {
			construct(target, args, newTarget) {
				if (!String(args[0]).endsWith('/analysis.worker.js'))
					return Reflect.construct(target, args, newTarget);
				const worker = {
					onmessage: null as ((event: MessageEvent) => void) | null,
					onerror: null,
					onmessageerror: null,
					postMessage(request: { id: number }) {
						(window as Window & { releaseAnalysis?: () => void }).releaseAnalysis =
							() =>
								worker.onmessage?.(
									new MessageEvent('message', {
										data: {
											type: 'rope-result',
											id: request.id,
											result: {
												probabilityLower: 0.2,
												probabilityEquivalent: 0.3,
												probabilityHigher: 0.5
											}
										}
									})
								);
					},
					terminate() {}
				};
				return worker;
			}
		});
	});
	await page.goto('/results');
	await expect(page.locator('app-rope-bar')).toHaveJSProperty('status', 'loading');
	await expect
		.poll(() =>
			page.evaluate(
				() => typeof (window as Window & { releaseAnalysis?: () => void }).releaseAnalysis
			)
		)
		.toBe('function');
	await page.locator('app-results-view').evaluate((element) => {
		const view = element as HTMLElement & { whenSettled(): Promise<void> };
		view.dataset.settled = 'no';
		void view.whenSettled().then(() => {
			view.dataset.settled = 'yes';
		});
	});
	await expect(page.locator('app-results-view')).toHaveAttribute('data-settled', 'no');
	await page.evaluate(() =>
		(window as Window & { releaseAnalysis?: () => void }).releaseAnalysis!()
	);
	await expect(page.locator('app-results-view')).toHaveAttribute('data-settled', 'yes');
});

test('WML-P5-UI-11: a superseded pair releases the previous settlement', async ({ page }) => {
	await seedComparablePair(page);
	await page.goto('/results');
	await expect(page.locator('app-rope-bar figure')).toBeVisible({ timeout: 45_000 });
	const view = page.locator('app-results-view');
	await view.evaluate((element) => {
		const host = element as HTMLElement & { whenSettled(): Promise<void> };
		const chart = host.shadowRoot!.querySelector('app-fold-strip') as HTMLElement & {
			whenSettled(): Promise<void>;
		};
		chart.whenSettled = () => new Promise<void>(() => {});
		host.dataset.settled = 'no';
		void host.whenSettled().then(() => {
			host.dataset.settled = 'yes';
		});
	});
	await expect(view).toHaveAttribute('data-settled', 'no');
	await view
		.locator('app-model-pair-picker')
		.getByRole('button', { name: 'Swap models A and B' })
		.click();
	await expect(view).toHaveAttribute('data-settled', 'yes');
});

test('WML-P5-UI-11: comparison scroll position returns after navigation', async ({ page }) => {
	await seedComparablePair(page);
	await page.goto('/results');
	await expect(page.locator('app-results-view app-rope-bar figure')).toBeVisible({
		timeout: 45_000
	});
	await page.evaluate(() => window.scrollTo(0, 500));
	await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(450);
	await page.waitForTimeout(300);
	await page.locator('app-sidebar a[href="/models"]').click();
	await page.goBack();
	await expect
		.poll(() => page.evaluate(() => Math.abs(window.scrollY - 500)), { timeout: 10_000 })
		.toBeLessThanOrEqual(2);
});
