import { expect, test, type Page } from '@playwright/test';
import { dismissWelcomeModal } from './journeys/helpers';
import { openSetup } from './fixtures/training/browser';
import { seedTrainedModel } from './helpers/seed-results';

/**
 * Makes the document taller than the viewport. The view host is stretched too, because a sticky
 * header only sticks within its view's block (real routes get this from their content).
 */
const TALL_CONTENT = '#content, #content > * { min-block-size: 300vh !important; }';
/** WebKit only tabs to links and some controls with Alt held, as in the shell suites. */
const tabKey = (browserName: string, shift = false): string =>
	`${browserName === 'webkit' ? 'Alt+' : ''}${shift ? 'Shift+' : ''}Tab`;

const ROUTES = ['/data', '/target', '/models', '/results'] as const;

/** Resolves the colour `--stone-50` computes to, so assertions follow the token. */
function stoneFifty(page: Page): Promise<string> {
	return page.evaluate(() => {
		const probe = document.createElement('div');
		probe.style.backgroundColor = 'var(--stone-50)';
		document.body.append(probe);
		const colour = getComputedStyle(probe).backgroundColor;
		probe.remove();
		return colour;
	});
}

async function openRoute(page: Page, route: string): Promise<void> {
	await page.goto(route);
	await dismissWelcomeModal(page);
	await expect(page.locator('#content h1').first()).toBeVisible();
	await page.addStyleTag({ content: TALL_CONTENT });
	await expect
		.poll(() => page.evaluate(() => document.documentElement.scrollHeight - innerHeight))
		.toBeGreaterThan(600);
}

/** Geometry of the active page header and the root block-size property. */
function headerState(page: Page) {
	return page.evaluate(() => {
		const header = document.querySelector('#content .page-header')
			? document.querySelector('#content .page-header')!
			: (() => {
					for (const host of document.querySelectorAll('#content > *')) {
						const found = host.shadowRoot?.querySelector('.page-header');
						if (found) return found;
					}
					return null;
				})();
		if (!header) throw new Error('No page header');
		const rect = header.getBoundingClientRect();
		const style = getComputedStyle(header);
		return {
			top: rect.top,
			bottom: rect.bottom,
			height: rect.height,
			position: style.position,
			zIndex: style.zIndex,
			background: style.backgroundColor,
			property: getComputedStyle(document.documentElement)
				.getPropertyValue('--page-header-block-size')
				.trim(),
			scrollTop: document.scrollingElement!.scrollTop,
			mainScrollTop: document.querySelector('main')!.scrollTop,
			mainOverflowX: getComputedStyle(document.querySelector('main')!).overflowX,
			mainOverflowY: getComputedStyle(document.querySelector('main')!).overflowY
		};
	});
}

test.describe('Sticky page headers (document scrolling)', () => {
	test('STICKY-AC-1: the document scrolls and every route header sticks at the top', async ({
		page
	}) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		for (const route of ROUTES) {
			await openRoute(page, route);
			const background = await stoneFifty(page);
			await page.evaluate(() => window.scrollTo(0, 600));
			await expect
				.poll(() => page.evaluate(() => document.scrollingElement!.scrollTop), route)
				.toBe(600);
			const state = await headerState(page);
			expect(state.mainScrollTop, route).toBe(0);
			expect(state.mainOverflowX, route).toBe('visible');
			expect(state.mainOverflowY, route).toBe('visible');
			expect(state.top, route).toBe(0);
			expect(state.position, route).toBe('sticky');
			expect(state.background, route).toBe(background);
			expect(state.zIndex, route).toBe('10');
		}
	});

	test('STICKY-AC-1: the bound wizard and trained results headers stick', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await seedTrainedModel(page, 'iris', { acknowledge: false });
		const background = await stoneFifty(page);
		await page.addStyleTag({ content: TALL_CONTENT });
		await page.evaluate(() => window.scrollTo(0, 600));
		await expect
			.poll(() => page.evaluate(() => document.scrollingElement!.scrollTop))
			.toBe(600);
		let state = await headerState(page);
		expect(state).toMatchObject({ top: 0, position: 'sticky', zIndex: '10', background });
		expect(state.mainScrollTop).toBe(0);

		await page
			.getByTestId('training-step')
			.getByRole('button', { name: 'View Results' })
			.click();
		await expect(page).toHaveURL('/models/1');
		await expect(page.getByTestId('results-step')).toBeVisible();
		await page.addStyleTag({ content: TALL_CONTENT });
		await page.evaluate(() => window.scrollTo(0, 600));
		await expect
			.poll(() => page.evaluate(() => document.scrollingElement!.scrollTop))
			.toBe(600);
		state = await headerState(page);
		expect(state).toMatchObject({ top: 0, position: 'sticky', zIndex: '10', background });
	});

	test('STICKY-AC-2: below a 30rem viewport height headers are static', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 400 });
		for (const route of ROUTES) {
			await openRoute(page, route);
			await page.evaluate(() => window.scrollTo(0, 600));
			await expect
				.poll(() => page.evaluate(() => document.scrollingElement!.scrollTop), route)
				.toBe(600);
			const state = await headerState(page);
			expect(state.position, route).toBe('static');
			expect(state.bottom, route).toBeLessThan(0);
			expect(state.property, route).toBe('0px');
		}
	});

	test('STICKY-AC-3: focus is not hidden under the header and the property tracks wrapping', async ({
		page,
		browserName
	}) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await openRoute(page, '/target');
		const link = page.locator('app-target-view [data-testid="target-blocked"] a');
		await page.evaluate(() => {
			const tail = document.createElement('button');
			tail.id = 'tail';
			tail.textContent = 'Tail';
			document.querySelector('#content')!.append(tail);
		});
		await link.evaluate((el) => (el as HTMLElement).focus({ preventScroll: true }));
		await page.keyboard.press(tabKey(browserName));
		await expect(page.locator('#tail')).toBeFocused();
		await page.evaluate(() => {
			const link = document
				.querySelector('app-target-view')!
				.shadowRoot!.querySelector('[data-testid="target-blocked"] a')!;
			window.scrollTo(0, link.getBoundingClientRect().top + window.scrollY - 20);
		});
		await page.keyboard.press(tabKey(browserName, true));
		await expect(link).toBeFocused();
		const gap = await page.evaluate(() => {
			const view = document.querySelector('app-target-view')!;
			const header = view.shadowRoot!.querySelector('.page-header')!;
			const link = view.shadowRoot!.querySelector('[data-testid="target-blocked"] a')!;
			return link.getBoundingClientRect().top - header.getBoundingClientRect().bottom;
		});
		expect(gap).toBeGreaterThanOrEqual(-0.5);

		for (const width of [1280, 400]) {
			await page.setViewportSize({ width, height: 800 });
			await expect
				.poll(async () => {
					const state = await headerState(page);
					return Math.abs(Number.parseFloat(state.property) - state.height);
				})
				.toBeLessThanOrEqual(1);
		}
	});

	test('STICKY-AC-3: bound wizard focus stays clear of the header', async ({
		page,
		browserName
	}) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await openSetup(page, false);
		await page.addStyleTag({ content: TALL_CONTENT });
		const wizard = page.locator('app-model-builder-view [data-testid="model-builder"]');
		const focusable = wizard.locator(
			'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled])'
		);
		const first = focusable.first();
		await first.evaluate((el) => (el as HTMLElement).focus({ preventScroll: true }));
		await page.keyboard.press(tabKey(browserName));
		await first.evaluate((el) => {
			window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 20);
		});
		await page.keyboard.press(tabKey(browserName, true));
		await expect(first).toBeFocused();
		const gap = await page.evaluate(() => {
			const view = document.querySelector('app-model-builder-view')!;
			const header = view.shadowRoot!.querySelector('.page-header')!;
			const active = view.shadowRoot!.activeElement!;
			return active.getBoundingClientRect().top - header.getBoundingClientRect().bottom;
		});
		expect(gap).toBeGreaterThanOrEqual(-0.5);
		const state = await headerState(page);
		expect(Math.abs(Number.parseFloat(state.property) - state.height)).toBeLessThanOrEqual(1);
	});

	test('STICKY-AC-4: the property follows the active route and RTL wraps without overflow', async ({
		page
	}) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await openRoute(page, '/data');
		const matches = async () => {
			await expect
				.poll(async () => {
					const state = await headerState(page);
					return Math.abs(Number.parseFloat(state.property) - state.height);
				})
				.toBeLessThanOrEqual(1);
		};
		await matches();
		await page.locator('app-sidebar a[href="/target"]').click();
		await expect(page.locator('app-target-view h1')).toBeVisible();
		await matches();
		await page.locator('app-sidebar a[href="/data"]').click();
		await expect(page.locator('app-data-view h1')).toBeVisible();
		await matches();

		await page.evaluate(() => {
			document.documentElement.dir = 'rtl';
			const h1 = document.querySelector('app-data-view')!.shadowRoot!.querySelector('h1')!;
			h1.textContent = 'Select data '.repeat(20);
		});
		await page.setViewportSize({ width: 600, height: 800 });
		await page.evaluate(() => window.scrollTo(0, 800));
		await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(800);
		const overflow = await page.evaluate(() => {
			const header = document
				.querySelector('app-data-view')!
				.shadowRoot!.querySelector('.page-header')!;
			return {
				position: getComputedStyle(header).position,
				top: header.getBoundingClientRect().top,
				overflowing: header.scrollWidth > header.clientWidth
			};
		});
		expect(overflow).toEqual({ position: 'sticky', top: 0, overflowing: false });
	});

	test('STICKY-AC-5: the unbound placeholder and startup recovery headers publish their size', async ({
		page
	}) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/models/new');
		await dismissWelcomeModal(page);
		await expect(page.locator('#content > .page-header > h1')).toBeVisible();
		await expect
			.poll(async () => {
				const state = await headerState(page);
				return Math.abs(Number.parseFloat(state.property) - state.height);
			})
			.toBeLessThanOrEqual(1);
		const state = await headerState(page);
		expect(state.height).toBeGreaterThan(0);
		expect(state.position).toBe('sticky');
	});

	test('STICKY-AC-5: startup recovery keeps Retry clear of the header at 320px and 200% text', async ({
		page,
		browserName
	}) => {
		await page.addInitScript(() => {
			Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true });
		});
		await page.setViewportSize({ width: 320, height: 640 });
		await page.goto('/data');
		await expect(page.locator('#content > .page-header > h1')).toHaveText('Restore saved work');
		await page.addStyleTag({
			content: 'html { font-size: 200%; } #content { min-block-size: 300vh !important; }'
		});
		await expect
			.poll(async () => {
				const state = await headerState(page);
				return Math.abs(Number.parseFloat(state.property) - state.height);
			})
			.toBeLessThanOrEqual(1);
		await page.evaluate(() => window.scrollTo(0, 0));
		await page.keyboard.press(tabKey(browserName));
		const retry = page.getByRole('button', { name: 'Retry saving' });
		for (
			let index = 0;
			index < 8 && !(await retry.evaluate((el) => el === document.activeElement));
			index++
		) {
			await page.keyboard.press(tabKey(browserName));
		}
		await expect(retry).toBeFocused();
		const gap = await page.evaluate(() => {
			const header = document.querySelector('#content > .page-header')!;
			const retry = document.activeElement!;
			return retry.getBoundingClientRect().top - header.getBoundingClientRect().bottom;
		});
		expect(gap).toBeGreaterThanOrEqual(-0.5);
	});

	test('STICKY-AC-6: a content modal locks scrolling and restores it on close', async ({
		page
	}) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await openRoute(page, '/target');
		await page.evaluate(() => window.scrollTo(0, 600));
		await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(600);
		await page.locator('app-sidebar footer a[href="/help"]').click();
		const modal = page.locator('app-content-modal dialog');
		await expect(modal).toBeVisible();
		await expect(page.locator('html')).toHaveCSS('overflow-y', 'hidden');
		await page.mouse.move(2, 2);
		await page.mouse.wheel(0, 300);
		expect(await page.evaluate(() => window.scrollY)).toBe(600);
		await modal.locator('button.btn-icon').click();
		await expect(modal).not.toBeVisible();
		await expect(page.locator('html')).toHaveCSS('overflow-y', 'scroll');
		expect(await page.evaluate(() => window.scrollY)).toBe(600);
		await page.mouse.move(790, 500);
		await page.mouse.wheel(0, 200);
		await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(600);
	});
});
