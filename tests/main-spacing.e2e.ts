import { expect, test, type Page } from '@playwright/test';
import { dismissWelcomeModal } from './journeys/helpers';
import { seedTrainedModel } from './helpers/seed-results';

const ROUTES = ['/data', '/target', '/models', '/models/new', '/results'] as const;

/** Reads `main`, the active page header and the first content wrapper, light or shadow DOM. */
function spacing(page: Page) {
	return page.evaluate(() => {
		const find = (selector: string): Element | null => {
			const light = document.querySelector(`#content > ${selector}`);
			if (light) return light;
			for (const host of document.querySelectorAll('#content > *')) {
				const found = host.shadowRoot?.querySelector(selector);
				if (found) return found;
			}
			return null;
		};
		const main = document.querySelector('main')!;
		const header = find('.page-header');
		const body = find('.page-body');
		const box = (element: Element | null) => {
			if (!element) return null;
			const rect = element.getBoundingClientRect();
			const style = getComputedStyle(element);
			return {
				left: rect.left,
				right: rect.right,
				padding: style.padding,
				boxSizing: style.boxSizing,
				margin: style.margin
			};
		};
		const nested = [...document.querySelectorAll('#content *')].some((element) =>
			(element.shadowRoot ?? element).querySelector('.page-body .page-body')
		);
		return {
			main: box(main),
			header: box(header),
			body: box(body),
			nested,
			overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
		};
	});
}

test.describe('Main spacing (D28)', () => {
	for (const viewport of [
		{ width: 1440, height: 900 },
		{ width: 375, height: 800 }
	]) {
		for (const dir of ['ltr', 'rtl'] as const) {
			test(`MAIN-AC-1: children own spacing at ${viewport.width}px (${dir})`, async ({
				page
			}) => {
				await page.setViewportSize(viewport);
				for (const route of ROUTES) {
					await page.goto(route);
					await dismissWelcomeModal(page);
					await expect(page.locator('#content h1').first()).toBeAttached();
					await page.evaluate((direction) => {
						document.documentElement.dir = direction;
					}, dir);
					const result = await spacing(page);
					const { main, header, body } = result;
					expect(main!.padding, route).toBe('0px');
					expect(header, route).not.toBeNull();
					expect(header!.padding, route).toBe('24px 32px');
					expect(header!.boxSizing, route).toBe('border-box');
					expect(header!.left, route).toBeCloseTo(main!.left, 1);
					expect(header!.right, route).toBeCloseTo(main!.right, 1);
					expect(body, route).not.toBeNull();
					expect(body!.left - main!.left, route).toBeCloseTo(32, 1);
					expect(main!.right - body!.right, route).toBeCloseTo(32, 1);
					expect(result.nested, route).toBe(false);
					expect(result.overflow, route).toBeLessThanOrEqual(0);
				}
			});
		}
	}

	test('MAIN-AC-2: the target alert starts 32px in when models exist', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await seedTrainedModel(page, 'iris', { acknowledge: false });
		await page.goto('/target');
		const alert = page.locator('app-target-view .notification-alert[role="alert"]');
		await expect(alert).toBeVisible();
		const { alertLeft, mainLeft, bodyLeft, nested } = await page.evaluate(() => {
			const view = document.querySelector('app-target-view')!.shadowRoot!;
			return {
				alertLeft: view.querySelector('.notification-alert')!.getBoundingClientRect().left,
				mainLeft: document.querySelector('main')!.getBoundingClientRect().left,
				bodyLeft: view.querySelector('.page-body')!.getBoundingClientRect().left,
				nested: view.querySelector('.page-body .page-body') !== null
			};
		});
		expect(alertLeft - mainLeft).toBeCloseTo(32, 1);
		expect(bodyLeft - mainLeft).toBeCloseTo(32, 1);
		expect(nested).toBe(false);
	});
});
