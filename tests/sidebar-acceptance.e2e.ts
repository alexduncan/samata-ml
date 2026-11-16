import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createSidebarFixture, prepareSidebarFixture } from './visual-parity/fixtures';

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
			await expect(
				page.locator('app-sidebar .step-link[aria-current="page"]')
			).toHaveAttribute('href', path);
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

	test('SIDE-AC-4: status has accessible text alongside the decorative training dot and trained check', async ({
		page
	}) => {
		await prepareSidebarFixture(page, 'models');
		await expect(
			page.getByRole('link', { name: 'Model 2 training', exact: true })
		).toBeVisible();
		await expect(
			page.getByRole('link', { name: 'Model 3 trained', exact: true })
		).toBeVisible();
		await expect(page.locator('app-sidebar .dot')).toHaveAttribute('aria-hidden', 'true');
		await expect(page.locator('app-sidebar .trained')).toHaveAttribute('aria-hidden', 'true');
	});

	test('SIDE-AC-5: four valid list items contain sibling model links without interactive nesting', async ({
		page
	}) => {
		await prepareSidebarFixture(page, 'models');
		await expect(page.locator('app-sidebar ol.steps > li')).toHaveCount(4);
		await expect(page.locator('app-sidebar ol.steps > :not(li)')).toHaveCount(0);
		await expect(page.locator('app-sidebar .step:nth-child(3) > a + ul > li')).toHaveCount(3);
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
		}
		await page.setViewportSize({ width: 1440, height: 900 });
		await expect(page.locator('app-sidebar')).toHaveCSS('position', 'fixed');
		const sidebar = await page.locator('app-sidebar').boundingBox();
		expect(sidebar!.x + sidebar!.width).toBe(1440);
	});

	test('SIDE-AC-8: reduced motion retains a visible static training core without transitions', async ({
		page
	}) => {
		await prepareSidebarFixture(page, 'models');
		const core = await page.locator('app-sidebar .dot').evaluate((dot) => {
			const style = getComputedStyle(dot, '::before');
			return {
				content: style.content,
				background: style.backgroundColor,
				animation: style.animationName,
				width: dot.getBoundingClientRect().width
			};
		});
		expect(core.content).toBe('""');
		expect(core.background).not.toBe('rgba(0, 0, 0, 0)');
		expect(core.animation).toBe('none');
		expect(core.width).toBe(10);
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
