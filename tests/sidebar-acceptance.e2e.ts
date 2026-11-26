import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createSidebarFixture, prepareSidebarFixture } from './visual-parity/fixtures';
import { dismissWelcomeModal, loadSampleDataset } from './journeys/helpers';
import { INGESTION_LOCK } from '../src/common/storage/db';

test.describe('Sidebar acceptance', () => {
	for (const [path, key] of [
		['/data', 'data'],
		['/target', 'target'],
		['/models', 'models'],
		['/results', 'results']
	] as const) {
		test(`SIDE-AC-1: ${key} is the only exact current workflow page`, async ({ page }) => {
			await prepareSidebarFixture(page, 'empty');
			await page.locator(`app-sidebar a[href="${path}"]`).click();
			await expect(page.locator('app-sidebar a[aria-current="page"]')).toHaveAttribute(
				'href',
				path
			);
			await expect(page.locator('app-sidebar [aria-current]')).toHaveCount(1);
		});
	}

	test('SIDE-AC-2: model detail has a current page and current parent, reserved routes have neither', async ({
		page
	}) => {
		await prepareSidebarFixture(page, 'models');
		await expect(page.locator('app-sidebar a[href="/models"]')).toHaveAttribute(
			'aria-current',
			'true'
		);
		await expect(page.locator('app-sidebar a[href="/models/2"]')).toHaveAttribute(
			'aria-current',
			'page'
		);
		await expect(page.locator('app-sidebar li[aria-current]')).toHaveCount(0);
		await page.locator('app-sidebar a[href="/about"]').click();
		await expect(page.locator('app-sidebar [aria-current]')).toHaveCount(0);
	});

	test('SIDE-AC-3: every workflow, model and footer link is reachable by Tab with a 2px outline', async ({
		page,
		browserName
	}) => {
		await prepareSidebarFixture(page, 'models');
		const links = page.locator('app-sidebar a');
		await links.first().focus();
		const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
		const reverseTab = browserName === 'webkit' ? 'Alt+Shift+Tab' : 'Shift+Tab';
		await page.keyboard.press(tab);
		await page.keyboard.press(reverseTab);
		for (let i = 0; i < (await links.count()); i++) {
			await expect(links.nth(i)).toBeFocused();
			await expect(links.nth(i)).toHaveCSS('outline-width', '2px');
			await expect(links.nth(i)).toHaveCSS('outline-style', 'solid');
			await page.keyboard.press(tab);
		}
	});

	test('SIDE-AC-4 / MW-MODEL-1: training status and trained models have accessible names and numbers', async ({
		page
	}) => {
		await prepareSidebarFixture(page, 'provisional');
		const sidebar = page.locator('app-sidebar');
		await expect(sidebar.locator('a[href="/models/1"]')).toHaveAccessibleName(
			/1 Logistic Regression 1 feature trained/
		);
		await expect(sidebar.locator('a[href="/models/2"]')).toHaveAccessibleName(
			/2 Decision Tree 2 features trained/
		);
		const training = sidebar.getByText('Training New Model…', { exact: true });
		await expect(training).toHaveAttribute('aria-current', 'page');
		await expect(sidebar.locator('a[href="/models/new"], .dot')).toHaveCount(0);
		for (const check of await sidebar.locator('.trained').all())
			await expect(check).toHaveAttribute('aria-hidden', 'true');
		await sidebar.getByRole('link', { name: 'help', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Close', exact: true })).toBeVisible();
		await expect(training).toBeVisible();
		await expect(sidebar.locator('[aria-current]')).toHaveCount(0);
	});

	test('MW-MODEL-1: no trained models expose the dedicated Train New Model anchor', async ({
		page
	}) => {
		await prepareSidebarFixture(page, 'dataset');
		const sidebar = page.locator('app-sidebar');
		const step = sidebar.locator('ol.steps > li').nth(2);
		const overview = step.locator('a[href="/models"]');
		await expect(overview).toHaveClass('step-link');
		await expect(overview.locator('.step-label')).toHaveText('Train Models');
		await expect(step.locator('a[href="/models/new"]')).toHaveCount(0);

		await page.evaluate(() => {
			const state = window.__appState!;
			state.set({ ...state.get(), target: 'species' });
		});
		await expect(overview).toHaveClass('step-link-small');
		await expect(overview).toHaveText('All Trained Models');
		const train = step.locator('ul.step-models > li.step-model > a.step-train-new');
		await expect(train).toHaveAccessibleName('Train New Model');
		await expect(train).toHaveAttribute('href', '/models/new');
		await expect(train).toHaveAccessibleDescription('Suggested next step');
		await expect(train.locator('.dot')).toBeVisible();
		await expect(step.locator('a.step-model-link[href="/models/new"]')).toHaveCount(0);
	});

	test('SIDE-AC-5: four valid list items contain sibling model links without interactive nesting', async ({
		page
	}) => {
		await prepareSidebarFixture(page, 'models');
		await expect(page.locator('app-sidebar ol.steps > li')).toHaveCount(4);
		await expect(page.locator('app-sidebar ol.steps > :not(li)')).toHaveCount(0);
		await expect(
			page.locator('app-sidebar .step:nth-child(3) .step-link-small + ul > li')
		).toHaveCount(3);
		await expect(
			page.locator('app-sidebar a.step-model-link[href="/models/new"]')
		).toHaveAccessibleName('Train Another Model');
		await expect(page.locator('app-sidebar a a, app-sidebar a button')).toHaveCount(0);
	});

	test('SIDE-AC-6: the sidebar project is an h2 and the route owns the page h1', async ({
		page
	}) => {
		await prepareSidebarFixture(page, 'empty');
		await expect(page.locator('app-sidebar h1')).toHaveCount(0);
		await expect(page.locator('app-sidebar h2')).toHaveText('Project');
		await expect(
			page.locator('app-sidebar').getByRole('region', { name: 'Project', exact: true })
		).toBeVisible();
		await expect(page.locator('#content h1')).toHaveCount(1);
	});

	test('SIDE-AC-7: long values reflow at 320px in both directions with a static sidebar above main', async ({
		page
	}) => {
		await page.setViewportSize({ width: 320, height: 900 });
		await prepareSidebarFixture(page, 'long');
		const modelLink = page.locator('app-sidebar a[href="/models/2"]');
		const modelName = modelLink.locator('.step-model-name');
		await expect(modelLink).toHaveAccessibleName(
			/Long trained model label with UnbrokenModelNameThatMustWrap/
		);
		for (const dir of ['ltr', 'rtl']) {
			await page.evaluate((direction) => (document.documentElement.dir = direction), dir);
			await expect(page.locator('app-sidebar')).toHaveCSS('position', 'static');
			const sidebar = await page.locator('app-sidebar').boundingBox();
			const main = await page.locator('main').boundingBox();
			expect(main!.y).toBeGreaterThanOrEqual(sidebar!.y + sidebar!.height);
			expect(
				await page.evaluate(() => document.documentElement.scrollWidth)
			).toBeLessThanOrEqual(320);
			const measurements = await page
				.locator('app-sidebar')
				.evaluate((host) => ({ width: host.clientWidth, content: host.scrollWidth }));
			expect(measurements.content).toBeLessThanOrEqual(measurements.width);
			await expect(page.locator('app-sidebar .step-value').first()).toHaveCSS(
				'overflow-wrap',
				'anywhere'
			);
			await expect(modelName).toHaveCSS('white-space', 'nowrap');
			await expect(modelName).toHaveCSS('text-overflow', 'ellipsis');
			expect(await modelName.evaluate((name) => name.scrollWidth > name.clientWidth)).toBe(
				true
			);
		}
		await page.setViewportSize({ width: 1440, height: 900 });
		await expect(page.locator('app-sidebar')).toHaveCSS('position', 'fixed');
		const sidebar = await page.locator('app-sidebar').boundingBox();
		expect(sidebar!.x + sidebar!.width).toBe(1440);
	});

	test('SIDE-AC-8: reduced motion retains visible training text without transitions', async ({
		page
	}) => {
		await prepareSidebarFixture(page, 'provisional');
		const training = page.locator('app-sidebar').getByText('Training New Model…');
		await expect(training).toBeVisible();
		await expect(training).toHaveCSS('animation-name', 'none');
		await expect(page.locator('app-sidebar .step-model-link').first()).toHaveCSS(
			'transition-duration',
			'0s'
		);
	});

	test('SIDE-AC-9: forced-colours keeps an inset native focus outline', async ({
		page,
		browserName
	}) => {
		await page.emulateMedia({ forcedColors: 'active' });
		await prepareSidebarFixture(page, 'models');
		const link = page.locator('app-sidebar a').first();
		await link.focus();
		await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
		await page.keyboard.press(browserName === 'webkit' ? 'Alt+Shift+Tab' : 'Shift+Tab');
		await expect(link).toHaveCSS('outline-width', '2px');
		await expect(link).toHaveCSS('outline-style', 'solid');
		await expect(link).toHaveCSS('outline-offset', '-2px');
	});

	test('SIDE-AC-10: grouped row counts keep numeric plural selection and sidebar axe is strict', async ({
		page
	}) => {
		await prepareSidebarFixture(page, 'long');
		await expect(page.locator('app-sidebar .chiclet').first()).toHaveText('1,234,567 rows');
		await page.evaluate(() => {
			const state = window.__appState!.get();
			window.__appState!.set({
				...state,
				dataset: {
					...state.dataset!,
					rowCount: 1,
					columns: state.dataset!.columns.slice(0, 1)
				}
			});
		});
		await expect(page.locator('app-sidebar .chiclet').nth(0)).toHaveText('1 row');
		await expect(page.locator('app-sidebar .chiclet').nth(1)).toHaveText('1 column');
		const results = await new AxeBuilder({ page })
			.include('app-sidebar')
			.withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
			.analyze();
		expect(results.violations).toEqual([]);
	});

	test('SIDE-AC-12: keyed model insertion/reordering preserves link identity and focus; duplicate activation preserves history and scroll', async ({
		page
	}) => {
		await prepareSidebarFixture(page, 'models');
		const link = page.locator('app-sidebar a[href="/models/2"]');
		await link.focus();
		const original = await link.elementHandle();
		const added = createSidebarFixture('models').models[0]!;
		await page.evaluate((model) => {
			const state = window.__appState!.get();
			window.__appState!.set({
				...state,
				models: [
					state.models[2]!,
					{ ...model, num: 4 },
					state.models[0]!,
					state.models[1]!
				],
				nextModelNum: 5
			});
		}, added);
		await expect(page.locator('app-sidebar .step-model-link')).toHaveCount(4);
		expect(await link.evaluate((element, previous) => element === previous, original)).toBe(
			true
		);
		await expect(link).toBeFocused();
		await page.evaluate(() => scrollTo(0, 100));
		const before = await page.evaluate(() => ({
			history: history.length,
			entry: history.state,
			y: scrollY
		}));
		await page.keyboard.press('Enter');
		expect(
			await page.evaluate(() => ({
				history: history.length,
				entry: history.state,
				y: scrollY
			}))
		).toEqual(before);
		await expect(link).toBeFocused();
	});
});

test('DOT-AC-1: prerequisites follow actual workflow and historical Help underlays', async ({
	page
}) => {
	await page.goto('/data');
	await dismissWelcomeModal(page);
	const sidebar = page.locator('app-sidebar');
	const data = sidebar.locator('a[href="/data"]');
	const target = sidebar.locator('a[href="/target"]');
	const help = sidebar.getByRole('link', { name: 'help', exact: true });
	const close = page.getByRole('button', { name: 'Close', exact: true });
	await expect(sidebar.locator('.dot')).toHaveCount(0);
	await target.click();
	await expect(data.locator('.dot')).toBeVisible();
	const original = await data.locator('.dot').elementHandle();
	await help.click();
	await expect(close).toBeVisible();
	expect(
		await data.locator('.dot').evaluate((element, before) => element === before, original)
	).toBe(true);
	await close.click();
	await expect(page).toHaveURL('/target');
	expect(
		await data.locator('.dot').evaluate((element, before) => element === before, original)
	).toBe(true);
	await page.goForward();
	await expect(close).toBeVisible();
	await page.evaluate(() => history.go(-2));
	await expect(page).toHaveURL('/data');
	await expect(sidebar.locator('.dot')).toHaveCount(0);
	await loadSampleDataset(page, 'iris');
	await expect(target.locator('.dot')).toBeVisible();
	await expect(page).toHaveURL('/data');
	await page.evaluate(() => history.go(2));
	await expect(page).toHaveURL('/help');
	await expect(close).toBeVisible();
	await expect(sidebar.locator('.dot')).toHaveCount(0);
	await close.click();
	await expect(page).toHaveURL('/target');
	await expect(sidebar.locator('.dot')).toHaveCount(0);
	await data.click();
	await expect(target.locator('.dot')).toBeVisible();
});

test('DOT-AC-2: acknowledged target and confirmed wizard departure suggest the first model', async ({
	page
}) => {
	await page.goto('/data');
	await loadSampleDataset(page, 'iris');
	const sidebar = page.locator('app-sidebar');
	const target = sidebar.locator('a[href="/target"]');
	const first = sidebar.locator('a.step-train-new[href="/models/new"]');
	const choose = page.getByRole('button', { name: 'Set as Target: class', exact: true });
	await target.click();
	await expect(choose).toBeEnabled();
	await page.evaluate(
		(name) =>
			new Promise<void>((ready) => {
				void navigator.locks.request(
					name,
					() =>
						new Promise<void>((release) => {
							window.addEventListener('release-target-fixture', () => release(), {
								once: true
							});
							ready();
						})
				);
			}),
		INGESTION_LOCK
	);
	try {
		await choose.click();
		await expect(page.locator('app-target-view').getByRole('alert')).toHaveText(
			'The dataset is busy. Try again.'
		);
		await expect(sidebar.locator('.dot')).toHaveCount(0);
		await expect(first).toHaveCount(0);
	} finally {
		await page.evaluate(() => window.dispatchEvent(new Event('release-target-fixture')));
	}
	await expect
		.poll(() =>
			page.evaluate(
				async (name) =>
					(await navigator.locks.query()).held?.some((lock) => lock.name === name),
				INGESTION_LOCK
			)
		)
		.toBe(false);
	await choose.click();
	await expect(first.locator('.dot')).toBeVisible();
	await expect(first).toHaveAccessibleDescription('Suggested next step');
	await expect(page).toHaveURL('/target');
	await first.press('Enter');
	await expect(page.locator('app-model-builder-view')).toBeVisible();
	await expect(page).toHaveURL('/models/new');
	await expect(sidebar.locator('.dot')).toHaveCount(0);
	const dialog = page.getByRole('dialog', { name: 'Leave this model?' });
	await target.click();
	await dialog.getByRole('button', { name: 'Stay', exact: true }).click();
	await expect(dialog).toBeHidden();
	await expect(page).toHaveURL('/models/new');
	await expect(sidebar.locator('.dot')).toHaveCount(0);
	await target.click();
	await dialog.getByRole('button', { name: 'Leave', exact: true }).click();
	await expect(page).toHaveURL('/target');
	await expect(first.locator('.dot')).toBeVisible();
	await page.reload();
	await expect(first).toBeVisible();
	await expect(sidebar.locator('.dot')).toHaveCount(0);
});

test('DOT-AC-3: live loss retires a training cue and a zero-to-two publication suggests comparison', async ({
	page
}) => {
	await prepareSidebarFixture(page, 'target');
	const sidebar = page.locator('app-sidebar');
	const models = createSidebarFixture('models').models.slice(0, 2);
	const publishModels = (records: typeof models, reset = false) =>
		page.evaluate(
			({ records, reset }) => {
				const store = window.__appState!;
				const state = store.get();
				store.set({
					...state,
					models: records,
					comparisonContextEpoch: state.comparisonContextEpoch + Number(reset)
				});
			},
			{ records, reset }
		);
	await publishModels(models.slice(0, 1));
	await expect(sidebar.locator('a.step-model-link[href="/models/new"] .dot')).toBeVisible();
	await publishModels([]);
	await expect(sidebar.locator('a.step-train-new')).toBeVisible();
	await expect(sidebar.locator('.dot')).toHaveCount(0);
	await sidebar.locator('a[href="/models"]').click();
	await expect(page).toHaveURL('/models');
	await expect(sidebar.locator('.dot')).toHaveCount(0);
	await publishModels(models.slice(0, 1));
	await expect(sidebar.locator('a.step-model-link[href="/models/new"]')).toBeVisible();
	await expect(sidebar.locator('.dot')).toHaveCount(0);
	await publishModels([], true);
	await expect(sidebar.locator('a.step-train-new')).toBeVisible();
	await publishModels(models);
	await expect(sidebar.locator('a[href="/results"] .dot')).toBeVisible();
	await expect(sidebar.locator('.dot')).toHaveCount(1);
});

test('DOT-AC-4: the suggested native link keeps its name, focus and current workflow', async ({
	page
}) => {
	await prepareSidebarFixture(page, 'target');
	const sidebar = page.locator('app-sidebar');
	const compare = sidebar.locator('a[href="/results"]');
	await compare.focus();
	const before = await compare.getAttribute('aria-current');
	await page.evaluate(
		(models) => {
			const store = window.__appState!;
			store.set({ ...store.get(), models });
		},
		createSidebarFixture('models').models.slice(0, 2)
	);
	await expect(compare).toHaveAccessibleName('4 Compare Results');
	await expect(compare).toHaveAccessibleDescription('Suggested next step');
	await expect(compare).toBeFocused();
	await expect(compare.locator('span.dot')).toHaveAttribute('aria-hidden', 'true');
	await expect(sidebar.locator('.dot')).toHaveCount(1);
	expect(await compare.getAttribute('aria-current')).toBe(before);
	await expect(page).toHaveURL('/target');
});

test('DOT-AC-5: one centred body burst paints beyond the sidebar and ends at two seconds', async ({
	page
}) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await prepareSidebarFixture(page, 'empty', 'no-preference');
	const sidebar = page.locator('app-sidebar');
	const core = sidebar.locator('a[href="/data"] > .dot');
	const burst = page.locator('body > .workflow-dot-burst');
	await sidebar.locator('a[href="/target"]').click();
	await expect(core).toBeVisible();
	await expect(burst).toHaveCount(1);
	await expect(burst).toHaveAttribute('aria-hidden', 'true');
	const measured = await burst.evaluate((element) => {
		const host = document.querySelector('app-sidebar')!;
		const dot = host.shadowRoot!.querySelector('.dot')!;
		const [animation] = element.getAnimations();
		const effect = animation!.effect as KeyframeEffect;
		animation!.pause();
		animation!.currentTime = 0;
		const { x, y, width, height } = dot.getBoundingClientRect();
		const centred = element.getBoundingClientRect();
		const style = getComputedStyle(element);
		const { position, pointerEvents } = style;
		const frames = effect.getKeyframes().map(({ opacity, transform }) => ({
			opacity: Number(opacity),
			scale: new DOMMatrix(transform as string).a
		}));
		animation!.currentTime = 1_000;
		return {
			centres: [
				centred.x + centred.width / 2 - (x + width / 2),
				centred.y + centred.height / 2 - (y + height / 2)
			],
			width: centred.width,
			position,
			pointerEvents,
			frames,
			duration: effect.getComputedTiming().duration,
			outside: element.getBoundingClientRect().right > host.getBoundingClientRect().right
		};
	});
	for (const difference of measured.centres) expect(Math.abs(difference)).toBeLessThanOrEqual(1);
	expect(measured.width).toBeGreaterThan(0);
	expect(measured).toMatchObject({
		position: 'fixed',
		pointerEvents: 'none',
		frames: [
			{ opacity: 1, scale: 1 },
			{ opacity: 0, scale: 30 }
		],
		duration: 2_000,
		outside: true
	});
	await burst.evaluate((element) => element.getAnimations()[0]!.finish());
	await expect(burst).toHaveCount(0);
	await expect(core).toBeVisible();
});

test('DOT-AC-6: navigation before the pending frame prevents a burst', async ({ page }) => {
	await prepareSidebarFixture(page, 'empty', 'no-preference');
	const sawCue = await page
		.locator('app-sidebar')
		.evaluate(async (host: HTMLElementTagNameMap['app-sidebar']) => {
			const queued = new Map<number, FrameRequestCallback>();
			const frame = window.requestAnimationFrame;
			const cancel = window.cancelAnimationFrame;
			let frameId = 0;
			window.requestAnimationFrame = (callback) => {
				queued.set(++frameId, callback);
				return frameId;
			};
			window.cancelAnimationFrame = (id) => {
				queued.delete(id);
			};
			try {
				host.shadowRoot!.querySelector<HTMLAnchorElement>('a[href="/target"]')!.click();
				await host.updateComplete;
				const pendingCue =
					host.shadowRoot!.querySelector('.dot') !== null && queued.size > 0;
				host.shadowRoot!.querySelector<HTMLAnchorElement>('a[href="/data"]')!.click();
				await host.updateComplete;
				return pendingCue;
			} finally {
				window.requestAnimationFrame = frame;
				window.cancelAnimationFrame = cancel;
				for (const callback of queued.values()) frame(callback);
			}
		});
	expect(sawCue).toBe(true);
	await expect(page).toHaveURL('/data');
	await expect(page.locator('app-sidebar .dot')).toHaveCount(0);
	await page.evaluate(
		() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
	);
	await expect(page.locator('body > .workflow-dot-burst')).toHaveCount(0);
});

test('DOT-AC-6: updates preserve the arrival while replacement, navigation and disconnect remove it', async ({
	page
}) => {
	await prepareSidebarFixture(page, 'empty', 'no-preference');
	const sidebar = page.locator('app-sidebar');
	const bursts = page.locator('body > .workflow-dot-burst');
	const first = sidebar.locator('a[href="/data"] .dot');
	const second = sidebar.locator('a[href="/target"] .dot');
	await sidebar.locator('a[href="/models"]').click();
	await expect(first).toBeVisible();
	await expect(bursts).toHaveCount(1);
	await bursts.evaluate((element) => element.getAnimations()[0]!.pause());
	const arrival = await bursts.elementHandle();
	const dot = await first.elementHandle();
	await sidebar.evaluate(async (host: HTMLElementTagNameMap['app-sidebar']) => {
		const app = window.__appState!;
		app.set({ ...app.get() });
		await host.updateComplete;
		await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
	});
	expect(await bursts.evaluate((element, prior) => element === prior, arrival)).toBe(true);
	expect(await first.evaluate((element, prior) => element === prior, dot)).toBe(true);
	await page.evaluate((state) => window.__appState!.set(state), createSidebarFixture('dataset'));
	await expect(second).toBeVisible();
	await expect.poll(() => arrival!.evaluate((element) => element.isConnected)).toBe(false);
	await expect(bursts).toHaveCount(1);
	await sidebar.locator('a[href="/target"]').click();
	await expect(bursts).toHaveCount(0);
	await sidebar.locator('a[href="/data"]').click();
	await expect(bursts).toHaveCount(1);
	await sidebar.evaluate((element) => element.remove());
	await expect(bursts).toHaveCount(0);
});

test('DOT-AC-6: reduced motion cancels the active burst and leaves a static cue on later visits', async ({
	page
}) => {
	await prepareSidebarFixture(page, 'empty', 'no-preference');
	const sidebar = page.locator('app-sidebar');
	const bursts = page.locator('body > .workflow-dot-burst');
	const data = sidebar.locator('a[href="/data"]');
	const target = sidebar.locator('a[href="/target"]');
	await target.click();
	await expect(bursts).toHaveCount(1);
	await bursts.evaluate((element) => element.getAnimations()[0]!.pause());
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await expect(bursts).toHaveCount(0);
	await expect(data.locator('.dot')).toBeVisible();
	await expect(data.locator('.dot')).toHaveCSS('animation-name', 'none');
	await data.click();
	await target.click();
	await expect(data.locator('.dot')).toBeVisible();
	await page.evaluate(
		() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
	);
	await expect(bursts).toHaveCount(0);
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	await expect(bursts).toHaveCount(0);
});

test('DOT-AC-7: wide labels and a forced-colours cue preserve keyboard focus at 320px in both directions', async ({
	page,
	browserName
}) => {
	await page.setViewportSize({ width: 320, height: 900 });
	await page.emulateMedia({ forcedColors: 'active' });
	await prepareSidebarFixture(page, 'long');
	const sidebar = page.locator('app-sidebar');
	const target = sidebar.locator('a[href="/target"]');
	await page.evaluate(() => {
		const store = window.__appState!;
		store.set({ ...store.get(), target: null, models: [] });
	});
	const testsForcedColours =
		browserName !== 'webkit' ||
		(await page.evaluate(() => CSS.supports('forced-color-adjust', 'none')));
	if (testsForcedColours) {
		expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
	} else {
		test.info().annotations.push({
			type: 'browser capability',
			description:
				'This WebKit build does not support forced-color-adjust. Static cue, keyboard and reflow remain asserted.'
		});
	}
	for (const dir of ['ltr', 'rtl'] as const) {
		await page.evaluate((value) => (document.documentElement.dir = value), dir);
		const core = target.locator('.dot');
		await expect(core).toBeVisible();
		if (testsForcedColours) {
			await expect(core).toHaveCSS('forced-color-adjust', 'none');
			await expect(core).toHaveCSS(
				'background-color',
				await target.evaluate((link) => getComputedStyle(link).color)
			);
		} else {
			await expect(core).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
		}
		const linkBox = (await target.boundingBox())!;
		const dotBox = (await core.boundingBox())!;
		const label = (await target.locator('.step-label').boundingBox())!;
		const margin =
			dir === 'ltr'
				? linkBox.x + linkBox.width - dotBox.x - dotBox.width
				: dotBox.x - linkBox.x;
		expect(margin).toBeGreaterThanOrEqual(12);
		expect(
			dir === 'ltr' ? dotBox.x - label.x - label.width : label.x - dotBox.x - dotBox.width
		).toBeGreaterThan(0);
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
			320
		);
		await target.focus();
		await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
		await page.keyboard.press(browserName === 'webkit' ? 'Alt+Shift+Tab' : 'Shift+Tab');
		await expect(target).toBeFocused();
		await expect(target).toHaveCSS('outline-width', '2px');
		await expect(target).toHaveCSS('outline-offset', '-2px');
	}
	await target.press('Enter');
	await expect(page).toHaveURL('/target');
	await expect(sidebar.locator('.dot')).toHaveCount(0);
});
