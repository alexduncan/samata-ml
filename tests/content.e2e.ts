import { expect, test } from '@playwright/test';

test.describe('Static Content Modal E2E (CNT-E2E-1 .. CNT-E2E-4)', () => {
	test('CNT-E2E-1: /privacy renders heading, accessible name, lang/dir, and markdown body', async ({
		page
	}) => {
		await page.goto('/privacy');

		const modal = page.locator('app-content-modal dialog');
		await expect(modal).toBeVisible();

		const heading = modal.locator('h1');
		await expect(heading).toHaveText('Privacy Policy');
		await expect(heading).toHaveAttribute('lang', 'en');
		await expect(heading).toHaveAttribute('dir', 'ltr');
		await expect(modal).toHaveAccessibleName('Privacy Policy');

		const body = modal.locator('.modal-body');
		await expect(body).toHaveAttribute('lang', 'en');
		await expect(body).toHaveAttribute('dir', 'ltr');
		await expect(body).toContainText('Complete privacy is the only option.');
		await expect(body).toContainText('never leaves your machine');
	});

	test('CNT-E2E-2: /help shows ordered list and external links enforce target and rel', async ({
		page
	}) => {
		await page.goto('/help');

		const modal = page.locator('app-content-modal dialog');
		await expect(modal).toBeVisible();
		await expect(modal.locator('h1')).toHaveText('Help & Guide');

		const items = modal.locator('.modal-body ol > li');
		await expect(items).toHaveCount(4);
		await expect(items.nth(0)).toContainText('Load Data:');
		await expect(items.nth(1)).toContainText('Set Target:');
		await expect(items.nth(2)).toContainText('Train Models:');
		await expect(items.nth(3)).toContainText('Compare Results:');

		// Verify external links in opened fragments always carry target="_blank" and rel="noopener noreferrer"
		await page.route('**/content/en/pages/about.html*', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'text/html; charset=utf-8',
				body: '<p>See <a href="https://example.org">external docs</a>.</p>'
			});
		});

		await modal.locator('button.close-btn').click();
		await expect(modal).not.toBeVisible();

		const welcomeBtn = page.locator('app-welcome-modal button.btn-primary');
		if (await welcomeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
			await welcomeBtn.click();
		}

		await page.locator('app-sidebar footer a[href="/about"]').click();
		await expect(modal).toBeVisible();
		const externalLink = modal.locator('.modal-body a[href="https://example.org"]');
		await expect(externalLink).toHaveAttribute('target', '_blank');
		await expect(externalLink).toHaveAttribute('rel', 'noopener noreferrer');
	});

	test('CNT-E2E-3: index 404 shows alert and close button returns to underlay URL', async ({
		page
	}) => {
		await page.goto('/models');
		const welcomeBtn = page.locator('app-welcome-modal button.btn-primary');
		if (await welcomeBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
			await welcomeBtn.click();
		}

		await page.route('**/content/en/pages/index.json', (route) =>
			route.fulfill({ status: 404 })
		);

		await page.locator('app-sidebar footer a[href="/about"]').click();
		expect(page.url()).toContain('/about');

		const modal = page.locator('app-content-modal dialog');
		await expect(modal).toBeVisible();

		const alert = modal.locator('[role="alert"]');
		await expect(alert).toHaveText(
			'This content could not be loaded. Check your connection, then close this dialog and try again.'
		);

		await modal.locator('button.close-btn').click();
		await expect(modal).not.toBeVisible();
		expect(page.url()).toContain('/models');
		await expect(page.locator('#content h1')).toHaveText('Train Models');
	});

	test('CNT-E2E-4: rapid /about to /privacy navigation and back/forward never shows stale body', async ({
		page
	}) => {
		let delayAbout = true;
		await page.route('**/content/en/pages/about.html*', async (route) => {
			if (delayAbout) {
				await new Promise((resolve) => setTimeout(resolve, 350));
			}
			await route.continue();
		});

		await page.goto('/data');
		const welcomeBtn = page.locator('app-welcome-modal button.btn-primary');
		if (await welcomeBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
			await welcomeBtn.click();
		}

		// Open /about (delayed), then quickly close and navigate to /privacy
		await page.locator('app-sidebar footer a[href="/about"]').click();
		await page.locator('app-content-modal dialog button.close-btn').click();
		await page.locator('app-sidebar footer a[href="/privacy"]').click();

		const modal = page.locator('app-content-modal dialog');
		await expect(modal).toBeVisible();
		await expect(modal.locator('h1')).toHaveText('Privacy Policy');
		await expect(modal.locator('.modal-body')).toContainText(
			'Complete privacy is the only option.'
		);

		// Wait past the delayed /about response to confirm it does not overwrite /privacy
		await page.waitForTimeout(450);
		await expect(modal.locator('h1')).toHaveText('Privacy Policy');
		await expect(modal.locator('.modal-body')).not.toContainText(
			'browser-first machine learning pipeline'
		);

		// Rapid Back / Forward history transitions between /about and /privacy
		await page.goto('/about');
		await page.goto('/privacy');
		await expect(modal).toBeVisible();
		await expect(modal.locator('h1')).toHaveText('Privacy Policy');

		delayAbout = true;
		await page.goBack(); // back to /about (about.html fetch delayed)
		await page.goForward(); // immediately forward to /privacy
		await page.waitForTimeout(450);
		await expect(modal).toBeVisible();
		await expect(modal.locator('h1')).toHaveText('Privacy Policy');
		await expect(modal.locator('.modal-body')).toContainText(
			'Complete privacy is the only option.'
		);
		await expect(modal.locator('.modal-body')).not.toContainText(
			'browser-first machine learning pipeline'
		);

		delayAbout = false;
		await page.goBack(); // back to /about settles cleanly
		await expect(modal).toBeVisible();
		await expect(modal.locator('h1')).toHaveText('About samatā.ml');
		await expect(modal.locator('.modal-body')).toContainText(
			'browser-first machine learning pipeline'
		);
	});
});
