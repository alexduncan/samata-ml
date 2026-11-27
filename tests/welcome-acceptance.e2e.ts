import { expect, test, type Page } from '@playwright/test';
import { runAdvisoryAxe } from './helpers/advisory-a11y';
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

test('DLG-BACKDROP-1: non-beta welcome backdrop dismissal persists once', async ({ page }) => {
	await page.goto('/data');
	await expect(page.locator('app-welcome-modal dialog.modal')).toBeVisible();
	await page.mouse.click(2, 2);
	await expectDismissedOnce(page);
});

test('WEL-AC-3: native welcome is named, fits and keeps its action keyboard reachable', async ({
	page,
	browserName
}, testInfo) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto('/data');
	const dialog = page.locator('app-welcome-modal').getByRole('dialog');
	const heading = dialog.getByRole('heading', { level: 2 });
	const lead = dialog.locator('p.lead');
	const body = dialog.locator('.body');
	const action = dialog.getByRole('button', { name: /\S/ });
	await expect(dialog).toBeVisible();
	await expect(heading).toHaveText(/\S/);
	await expect(heading).toHaveAttribute('id', 'welcome-title');
	await expect(dialog).toHaveAttribute('aria-labelledby', 'welcome-title');
	const title = (await heading.textContent())?.replace(/\s+/g, ' ').trim() ?? '';
	await expect(dialog).toHaveAccessibleName(title);
	await expect(dialog.locator('h1')).toHaveCount(0);
	await expect(lead).toBeVisible();
	await expect(lead).toHaveText(/\S/);
	await expect(body).toBeVisible();
	await expect(body).toHaveText(/\S/);
	await expect(action).toBeVisible();
	await expect(action).toHaveClass(/\bbtn-primary\b/);
	await expect(dialog).not.toHaveAttribute('role');
	await expect(dialog).not.toHaveAttribute('aria-modal');
	await runAdvisoryAxe(
		testInfo,
		async () => {
			const { violations } = await new AxeBuilder({ page })
				.include('app-welcome-modal')
				.withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
				.analyze();
			return violations;
		},
		{ label: 'WEL-AC-3' }
	);

	const tab = browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab';
	for (const viewport of [
		{ width: 1440, height: 900 },
		{ width: 320, height: 540 }
	]) {
		await page.setViewportSize(viewport);
		await expect(dialog).toBeInViewport({ ratio: 0.98 });
		const dimensions = await dialog.evaluate((node) => ({
			inlineOverflow: node.scrollWidth - node.clientWidth,
			blockOverflow: node.scrollHeight - node.clientHeight
		}));
		expect(dimensions.inlineOverflow).toBeLessThanOrEqual(1);
		if (dimensions.blockOverflow > 0) {
			await dialog.evaluate((node) => (node.scrollTop = 0));
			await expect(lead).toBeInViewport();
			await action.scrollIntoViewIfNeeded();
			await expect.poll(() => dialog.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
		}
		await action.press(`Shift+${tab}`);
		await expect(action).not.toBeFocused();
		await page.keyboard.press(tab);
		await expect(action).toBeFocused();
		await expect(action).toBeInViewport();
	}
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
