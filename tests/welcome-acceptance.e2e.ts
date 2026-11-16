import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { STATE_STORAGE_KEY } from '../src/types/state';

interface WelcomeTestWindow extends Window {
	__welcomeDismissalWrites: number;
}

test.beforeEach(async ({ page }) => {
	await page.addInitScript((key) => {
		const target = window as unknown as WelcomeTestWindow;
		target.__welcomeDismissalWrites = 0;
		const original = Storage.prototype.setItem;
		Storage.prototype.setItem = function (name, value) {
			if (name === key && JSON.parse(value).onboarding.welcomeDismissed)
				target.__welcomeDismissalWrites++;
			return original.call(this, name, value);
		};
	}, STATE_STORAGE_KEY);
});

async function expectDismissedOnce(page: Page): Promise<void> {
	await expect(page.locator('app-welcome-modal dialog')).not.toBeVisible();
	await page.evaluate(
		() =>
			new Promise<void>((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
			)
	);
	// A repeated dismissal changes only updatedAt, which the persister debounces. Its
	// pagehide listener flushes that pending write, so a duplicate is counted here.
	await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
	expect(
		await page.evaluate(() => (window as unknown as WelcomeTestWindow).__welcomeDismissalWrites)
	).toBe(1);
	expect(await page.evaluate(() => window.__appState!.get().onboarding.welcomeDismissed)).toBe(
		true
	);
}

test('WEL-AC-1: Get Started persists dismissal once, including its queued native close', async ({
	page
}) => {
	await page.goto('/data');
	await page.getByRole('button', { name: 'Get Started', exact: true }).click();
	await expectDismissedOnce(page);
});

test('WEL-AC-2: native Esc persists once and unrelated state renders do not reopen onboarding', async ({
	page
}) => {
	await page.goto('/data');
	await expect(page.locator('app-welcome-modal dialog')).toBeVisible();
	await page.keyboard.press('Escape');
	await expectDismissedOnce(page);
	await page.evaluate(() => {
		const state = window.__appState!.get();
		window.__appState!.set({ ...state, data: { ...state.data } });
	});
	await expect(page.locator('app-welcome-modal dialog')).not.toBeVisible();
	await page.locator('app-sidebar a[href="/target"]').click();
	await expect(page.locator('app-welcome-modal dialog')).not.toBeVisible();
});

test('WEL-AC-3: native welcome has reference geometry and semantic names', async ({
	page,
	context
}, testInfo) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto('/data');
	const dialog = page.getByRole('dialog', { name: 'samatā.ml beta', exact: true });
	await expect(dialog).toBeVisible();
	await expect(dialog.getByRole('heading', { level: 2 })).toHaveText('samatā.ml beta');
	await expect(dialog.locator('h1')).toHaveCount(0);
	await expect(dialog.locator('p.lead')).toHaveText(
		'train machine learning models inside your browser.'
	);
	await expect(dialog.getByRole('button', { name: 'Get Started', exact: true })).toBeVisible();
	await expect(dialog).not.toHaveAttribute('role');
	await expect(dialog).not.toHaveAttribute('aria-modal');
	const reference = await context.newPage();
	await reference.setViewportSize({ width: 1440, height: 900 });
	await reference.goto('http://localhost:3333/files/ui-scaffold/00_first-load.html?clean=1');
	await reference.screenshot({ path: testInfo.outputPath('welcome-reference.png') });
	await page.screenshot({ path: testInfo.outputPath('welcome-app.png') });
	const actualBox = await dialog.boundingBox();
	const referenceBox = await reference.locator('dialog').boundingBox();
	for (const key of ['x', 'y', 'width', 'height'] as const)
		expect(Math.abs(actualBox![key] - referenceBox![key])).toBeLessThanOrEqual(1);
	const button = await dialog.locator('button').boundingBox();
	expect(button!.width).toBe(actualBox!.width - 50);
	const audit = await new AxeBuilder({ page })
		.include('app-welcome-modal')
		.withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
		.analyze();
	expect(audit.violations).toEqual([]);
	await reference.close();
});

test('WEL-AC-4: reload preserves explicit onboarding dismissal', async ({ page }) => {
	await page.goto('/data');
	await page.getByRole('button', { name: 'Get Started', exact: true }).click();
	await expectDismissedOnce(page);
	await page.reload();
	await expect(page.locator('app-data-view')).toBeVisible();
	await expect(page.locator('app-welcome-modal dialog')).not.toBeVisible();
	expect(await page.evaluate(() => window.__appState!.get().onboarding.welcomeDismissed)).toBe(
		true
	);
});

test('WEL-AC-5: reserved-route hiding does not persist dismissal and returning reopens onboarding', async ({
	page
}) => {
	await page.goto('/data');
	await expect(page.locator('app-welcome-modal dialog')).toBeVisible();
	// A route change can arrive while the modal makes pointer targets inert.
	await page
		.locator('app-sidebar a[href="/about"]')
		.evaluate((link: HTMLAnchorElement) => link.click());
	await expect(page.locator('app-content-modal dialog')).toBeVisible();
	await expect(page.locator('app-welcome-modal dialog')).not.toBeVisible();
	await page.evaluate(
		() =>
			new Promise<void>((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
			)
	);
	expect(await page.evaluate(() => window.__appState!.get().onboarding.welcomeDismissed)).toBe(
		false
	);
	expect(
		await page.evaluate(() => (window as unknown as WelcomeTestWindow).__welcomeDismissalWrites)
	).toBe(0);
	await page.keyboard.press('Escape');
	await expect(page.locator('app-welcome-modal dialog')).toBeVisible();
	expect(await page.evaluate(() => window.__appState!.get().onboarding.welcomeDismissed)).toBe(
		false
	);
	await page.getByRole('button', { name: 'Get Started', exact: true }).click();
	await expectDismissedOnce(page);
});

test('WEL-AC-5: direct reserved load leaves onboarding untouched until its workflow is shown', async ({
	page
}) => {
	await page.goto('/about');
	await expect(page.locator('app-content-modal dialog')).toBeVisible();
	await expect(page.locator('app-welcome-modal dialog')).not.toBeVisible();
	expect(await page.evaluate(() => window.__appState!.get().onboarding.welcomeDismissed)).toBe(
		false
	);
	await page.keyboard.press('Escape');
	await expect(page.locator('app-welcome-modal dialog')).toBeVisible();
	expect(
		await page.evaluate(() => (window as unknown as WelcomeTestWindow).__welcomeDismissalWrites)
	).toBe(0);
});
