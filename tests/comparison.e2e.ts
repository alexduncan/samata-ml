import { expect, test } from '@playwright/test';
import { seedComparableGroups, seedComparablePair } from './helpers/seed-results';

// These journeys train two models before exercising comparison; allow for slower browser workers.
test.setTimeout(60_000);

test('CHT-SINGLE-1A: comparison owner supplies the fold chart labels and data description', async ({
	page
}) => {
	await seedComparablePair(page);
	await page.goto('/results');
	const fold = page.locator('app-results-view app-fold-strip');
	await expect(fold.locator('.chart > svg:not([data-plot-probe])')).toBeVisible();
	await expect(fold).toContainText('Balanced accuracy (%, higher is better)');
	await expect(fold.locator('.chart > svg:not([data-plot-probe])')).toContainText('Mean ± 1 SD');
	await expect(fold.locator('figcaption')).toContainText('unconnected dot');
	const description = await fold.evaluate((host) => {
		const svg = host.shadowRoot!.querySelector('.chart > svg')!;
		return host.shadowRoot!.getElementById(svg.getAttribute('aria-describedby')!)?.textContent;
	});
	expect(description?.match(/Logistic Regression/g)).toHaveLength(2);
	expect(description).toContain('Most frequent class');
	expect(description).toContain('33.3%');
	expect(description).toMatch(/\d+\.\d%/);
});

test('CHT-COMP-1: comparison sections and model identities are exposed', async ({ page }) => {
	await seedComparablePair(page);
	await page.goto('/results');
	const view = page.locator('app-results-view');
	await expect(view.getByRole('heading', { level: 2 })).toHaveCount(6);
	await expect(view.locator('app-comparison-controls .swatch')).toHaveCount(2);
	await expect(view.locator('app-comparison-table .swatch')).toHaveCount(2);
	await expect(view.locator('app-model-pair-picker .swatch')).toHaveCount(2);
	await expect(view.locator('app-comparison-table .bar')).toHaveCount(0);
	await expect(view.locator('p[aria-live="polite"]').first()).toBeAttached();
});

test('CHT-COMP-1: charts distinguish two models with the same label', async ({ page }) => {
	await seedComparablePair(page);
	await page.goto('/results');
	const view = page.locator('app-results-view');
	const fold = view.locator('app-fold-strip');
	const classErrors = view.locator('app-class-error-bars');
	const rope = view.locator('app-rope-bar');
	const modelName = 'Logistic Regression';
	const modelA = `1 ${modelName}`;
	const modelB = `2 ${modelName}`;
	const bothModels = new RegExp(`${modelA}.*${modelB}`);

	for (const chart of [fold, classErrors, rope]) {
		const legend = chart.locator('.chart-legend');
		await expect(legend.locator('.swatch')).toHaveText(['1', '2']);
		await expect(legend.getByRole('listitem').first()).toMatchAriaSnapshot(
			`- listitem: /1 ${modelName}/`
		);
		await expect(legend.getByRole('listitem').last()).toMatchAriaSnapshot(
			`- listitem: /2 ${modelName}/`
		);
		await expect(chart.getByRole('img')).toHaveAccessibleDescription(bothModels);
		await chart.getByText('Show data table', { exact: true }).click();
	}

	const foldImage = fold.locator('.chart > svg[role="img"]');
	for (const num of [1, 2]) {
		await expect(foldImage.getByText(new RegExp(`^${num} Logistic`))).toBeVisible();
		await expect(
			fold.getByRole('rowheader', { name: `${num} ${modelName}: Mean`, exact: true })
		).toBeVisible();
		await expect(
			classErrors.getByRole('cell', { name: `${num} ${modelName}`, exact: true }).first()
		).toBeVisible();
		await expect(
			rope.getByRole('rowheader', { name: `${num} ${modelName} higher`, exact: true })
		).toBeVisible();
	}

	await view.getByRole('button', { name: 'Swap models A and B' }).click();
	await expect(rope.locator('.chart-legend .swatch')).toHaveText(['2', '1']);
	await expect(rope.getByRole('img')).toHaveAccessibleDescription(
		new RegExp(`${modelB}.*${modelA}`)
	);
	await rope.getByText('Show data table', { exact: true }).click();
	await expect(rope.getByRole('rowheader').first()).toHaveAccessibleName(`${modelB} higher`);
});

test('CHT-COMP-2: comparison values update on a reused row without truncated bars', async ({
	page
}) => {
	await seedComparablePair(page);
	await page.goto('/results');
	await expect(page.locator('app-results-view app-comparison-table')).toBeVisible();
	await page.evaluate(async () => {
		const table = document.createElement('app-comparison-table');
		table.id = 'comparison-bar-fixture';
		table.labels = {
			caption: 'Bar dimensions',
			model: 'Model',
			baseline: 'Baseline',
			unavailable: 'Unavailable'
		};
		table.columns = [
			{ id: 'balancedAccuracy', label: 'Balanced accuracy', lowerIsBetter: false }
		];
		table.rows = [
			{
				id: 'minimum',
				label: 'Minimum',
				kind: 'model',
				metrics: { balancedAccuracy: { value: 0, text: '0%' } }
			},
			{
				id: 'middle',
				label: 'Middle',
				kind: 'model',
				metrics: { balancedAccuracy: { value: 0.5, text: '50%' } }
			},
			{
				id: 'maximum',
				label: 'Maximum',
				kind: 'model',
				metrics: { balancedAccuracy: { value: 1, text: '100%' } }
			}
		];
		document.body.append(table);
		await table.updateComplete;
	});
	const table = page.locator('app-comparison-table#comparison-bar-fixture');
	const row = table.getByRole('row').filter({ hasText: 'Middle' });
	await expect(row).toContainText('50%');
	await expect(table.locator('.bar')).toHaveCount(0);
	await table.evaluate(async (element) => {
		const table = element as HTMLElementTagNameMap['app-comparison-table'];
		table.rows = table.rows.map((row) =>
			row.id === 'middle'
				? { ...row, metrics: { balancedAccuracy: { value: 0.75, text: '75%' } } }
				: row
		);
		await table.updateComplete;
	});
	await expect(row).toContainText('75%');
	await expect(table.locator('.bar')).toHaveCount(0);
});

test('TERM-AC-7: comparison terms explain pooled scores and the paired fold gap', async ({
	page
}) => {
	await seedComparablePair(page, 'divergent-binary-cv');
	await page.goto('/results');
	const view = page.locator('app-results-view');
	const table = view.locator('app-comparison-table');
	const disclosure = view.locator('app-comparison-table + details.terms-disclosure');
	const summary = disclosure.locator('summary');
	await expect(disclosure).toHaveCount(1);
	await expect(disclosure).toHaveJSProperty('open', false);

	const model = table.getByRole('row').filter({
		has: page.getByRole('rowheader', { name: '1 Logistic Regression', exact: true })
	});
	const balancedAccuracy = table.getByRole('columnheader', {
		name: 'Balanced accuracy',
		exact: true
	});
	const gap = table.getByRole('columnheader', { name: 'Train–test gap', exact: true });
	const indexOf = (header: typeof gap) =>
		header.evaluate((cell) => (cell as HTMLTableCellElement).cellIndex - 1);
	await expect(model.getByRole('cell').nth(await indexOf(balancedAccuracy))).toHaveText('83.3%');
	await expect(model.getByRole('cell').nth(await indexOf(gap))).toHaveText('25%');

	await summary.press('Enter');
	await expect(summary).toBeFocused();
	await expect(
		disclosure.getByText(
			'Put the held-out predictions together, then calculate one score from the combined predictions.',
			{ exact: true }
		)
	).toBeVisible();
	await expect(
		disclosure.getByText(
			'Training balanced accuracy minus held-out balanced accuracy for the same split. For Cross-Validation, average those differences across folds.',
			{ exact: true }
		)
	).toBeVisible();
	await expect(disclosure.getByText('Equivalence width', { exact: true })).toBeVisible();
	await expect(disclosure.getByText('Mean across folds', { exact: true })).toHaveCount(0);
	await expect(disclosure.locator('abbr')).toHaveCount(3);
	for (const [acronym, expansion] of [
		['MCC', 'Matthews correlation coefficient'],
		['ROC-AUC', 'Area under the receiver operating characteristic curve'],
		['ECE', 'Expected calibration error']
	] as const) {
		const term = disclosure.locator('abbr').filter({ hasText: new RegExp(`^${acronym}$`) });
		await expect(term).toHaveAttribute('title', expansion);
		await term.evaluate((element) => element.removeAttribute('title'));
		await expect(disclosure.locator('dd').filter({ hasText: expansion })).toBeVisible();
	}

	await balancedAccuracy.getByRole('button', { name: 'Balanced accuracy' }).click();
	await expect(balancedAccuracy).toHaveAttribute('aria-sort', 'ascending');
	await view.getByRole('spinbutton', { name: 'Equivalence width' }).fill('0.02');
	await expect(view.getByRole('spinbutton', { name: 'Equivalence width' })).toHaveValue('0.02');
	await expect(disclosure).toHaveJSProperty('open', true);

	const modelTwo = view
		.locator('app-comparison-controls')
		.getByRole('checkbox', { name: 'Logistic Regression' })
		.nth(1);
	await modelTwo.uncheck();
	await expect(disclosure).toHaveCount(0);
	await modelTwo.check();
	await expect(disclosure).toHaveJSProperty('open', false);
});

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
	await expect(
		view
			.locator('app-comparison-controls')
			.getByRole('checkbox', { name: 'Logistic Regression' })
			.nth(0)
	).toBeChecked();
	await expect(
		view
			.locator('app-comparison-controls')
			.getByRole('checkbox', { name: 'Logistic Regression' })
			.nth(1)
	).toBeChecked();
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
	const first = controls.getByRole('checkbox', { name: 'Logistic Regression' }).nth(0);
	const second = controls.getByRole('checkbox', { name: 'Logistic Regression' }).nth(1);
	await expect(first).toBeChecked();
	await first.focus();
	await first.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
	await expect(second).toBeFocused();
	await second.press('Space');
	await expect(view).toContainText('Select at least two models to compare.');
	await second.press('Space');
	await expect(view.locator('app-comparison-table')).toBeVisible();
	const disclosure = view.locator('details.terms-disclosure');
	await disclosure.locator('summary').press('Enter');
	await expect(disclosure.locator('dl')).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
		true
	);
});

test('TERM-AC-9: WML-P5-UI-12 comparison reflows at simulated 200% zoom with terms open', async ({
	page,
	browserName
}) => {
	await seedComparablePair(page);
	await page.setViewportSize({ width: 640, height: 900 });
	await page.goto('/results');
	await page.evaluate(() => {
		document.documentElement.dir = 'rtl';
		document.documentElement.style.zoom = '2';
	});
	if (browserName !== 'webkit') await page.emulateMedia({ forcedColors: 'active' });
	const disclosure = page.locator('app-results-view details.terms-disclosure');
	const summary = disclosure.locator('summary');
	await summary.press('Enter');
	if (browserName === 'firefox') {
		await page.keyboard.press('Shift+Tab');
		await page.keyboard.press('Tab');
	}
	await expect(summary).toBeFocused();
	await expect(disclosure.locator('dl')).toBeVisible();
	const size = await summary.evaluate((element) => ({
		width: element.clientWidth,
		height: element.clientHeight,
		outline: getComputedStyle(element).outlineStyle
	}));
	expect(size.width).toBeGreaterThanOrEqual(24);
	expect(size.height).toBeGreaterThanOrEqual(24);
	expect(size.outline).toBe('solid');
	await expect(page.locator('app-results-view app-comparison-table')).toBeVisible();
	await expect(
		page
			.locator('app-comparison-controls')
			.getByRole('checkbox', { name: 'Logistic Regression' })
			.nth(0)
	).toBeVisible();
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
	await view
		.locator('app-comparison-controls')
		.getByRole('checkbox', { name: 'Logistic Regression' })
		.nth(0)
		.focus();
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
	await page.addInitScript(() => {
		const NativeWorker = window.Worker;
		window.Worker = new Proxy(NativeWorker, {
			construct(target, args, newTarget) {
				if (!String(args[0]).endsWith('/analysis.worker.js'))
					return Reflect.construct(target, args, newTarget);
				let requests = 0;
				const worker = {
					onmessage: null as ((event: MessageEvent) => void) | null,
					onerror: null,
					onmessageerror: null,
					postMessage(request: { id: number }) {
						const deliver = () =>
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
						if (++requests === 1) setTimeout(deliver, 0);
						else
							(
								window as Window & { releaseSwapAnalysis?: () => void }
							).releaseSwapAnalysis = deliver;
					},
					terminate() {}
				};
				return worker;
			}
		});
	});
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
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					typeof (window as Window & { releaseSwapAnalysis?: () => void })
						.releaseSwapAnalysis
			)
		)
		.toBe('function');
	await page.evaluate(() =>
		(window as Window & { releaseSwapAnalysis?: () => void }).releaseSwapAnalysis!()
	);
	await expect(rope).toHaveJSProperty('status', 'ready');
	await expect(rope.locator('figure')).toBeVisible({ timeout: 45_000 });
	await expect(
		view
			.locator('app-comparison-controls')
			.getByRole('checkbox', { name: 'Logistic Regression' })
			.nth(0)
	).toBeChecked();
	await expect(
		view
			.locator('app-comparison-controls')
			.getByRole('checkbox', { name: 'Logistic Regression' })
			.nth(1)
	).toBeChecked();
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
	await width.fill('2');
	await expect
		.poll(() =>
			page.evaluate(
				() => JSON.parse(localStorage.getItem('samata-ml:state')!).results.ui.ropeWidth
			)
		)
		.toBe(0.02);
	await page.reload();
	await expect(width).toHaveValue('2');
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
	await expect(
		controls.getByRole('checkbox', { name: 'Logistic Regression' }).nth(0)
	).toBeChecked();
	await controls.getByRole('checkbox', { name: 'Logistic Regression' }).nth(1).uncheck();
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
	await expect(
		controls.getByRole('checkbox', { name: 'Logistic Regression' }).nth(0)
	).toBeChecked();
	await expect(
		controls.getByRole('checkbox', { name: 'Logistic Regression' }).nth(1)
	).not.toBeChecked();
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

test('BETA-ERR-3 / WML-P5-UI-11: initial settlement waits for the paired analysis without a Lit lifecycle warning', async ({
	page
}) => {
	const warnings: string[] = [];
	page.on('console', (message) => {
		const text = message.text();
		if (text.includes('app-results-view') && text.includes('change-in-update'))
			warnings.push(text);
	});
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
	expect(warnings).toEqual([]);
});

test('BETA-ERR-3b / WML-P5-UI-11: a superseded pair releases the previous settlement', async ({
	page
}) => {
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
