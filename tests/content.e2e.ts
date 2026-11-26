import { expect, test } from '@playwright/test';

test.describe('Static Content Modal E2E (CNT-E2E-1 .. CNT-E2E-4)', () => {
	test.describe('Help term definitions', () => {
		test.use({ hasTouch: true });

		test('TERM-AC-1: Help definitions are available by keyboard and touch', async ({
			page
		}) => {
			await page.goto('/data');
			await page.locator('app-welcome-modal button.btn-primary').click();
			const help = page
				.locator('app-sidebar')
				.getByRole('link', { name: 'help', exact: true });
			const dialog = page.getByRole('dialog', { name: 'Help & Guide' });
			const article = dialog.locator('.modal-content');

			await help.focus();
			await page.keyboard.press('Enter');
			await expect(
				dialog.getByRole('heading', { name: 'Data and model choices' })
			).toBeVisible();
			for (const term of [
				'Comma-separated values (CSV)',
				'Coordinated Universal Time (UTC)',
				'Target leakage'
			]) {
				await expect(article).toContainText(term);
			}
			await page.keyboard.press('Escape');
			await expect(dialog).toBeHidden();
			await expect(help).toBeFocused();

			await help.tap();
			await expect(dialog).toBeVisible();
			await dialog.getByRole('button', { name: 'Close' }).tap();
			await expect(dialog).toBeHidden();
		});
	});

	test('CNT-E2E-1: /privacy renders heading, accessible name, lang/dir, and markdown body', async ({
		page
	}) => {
		await page.goto('/privacy');

		const modal = page.locator('app-content-modal dialog');
		await expect(modal).toBeVisible();

		const heading = modal.locator('h2');
		await expect(heading).toHaveText('Privacy Policy');
		await expect(heading).toHaveAttribute('lang', 'en');
		await expect(heading).toHaveAttribute('dir', 'ltr');
		await expect(modal).toHaveAccessibleName('Privacy Policy');

		const body = modal.locator('.modal-content');
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
		await expect(
			modal.getByRole('heading', { name: 'Help & Guide', exact: true })
		).toBeVisible();

		const items = modal.locator('.modal-content ol > li');
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

		await modal.locator('button.btn-icon').click();
		await expect(modal).not.toBeVisible();
		await expect(page).toHaveURL(/\/data$/);

		const welcomeBtn = page.locator('app-welcome-modal button.btn-primary');
		await expect(welcomeBtn).toBeVisible();
		await welcomeBtn.click();
		await expect(welcomeBtn).not.toBeVisible();

		await page.locator('app-sidebar footer a[href="/about"]').click();
		await expect(modal).toBeVisible();
		const externalLink = modal.locator('.modal-content a[href="https://example.org"]');
		await expect(externalLink).toHaveAttribute('target', '_blank');
		await expect(externalLink).toHaveAttribute('rel', 'noopener noreferrer');
	});

	test('CNT-E2E-3: index 404 shows alert and close button returns to underlay URL', async ({
		page
	}) => {
		await page.goto('/models');
		const welcomeBtn = page.locator('app-welcome-modal button.btn-primary');
		await expect(welcomeBtn).toBeVisible();
		await welcomeBtn.click();
		await expect(welcomeBtn).not.toBeVisible();

		await page.route('**/content/en/pages/index.json*', (route) =>
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

		await modal.locator('button.btn-icon').click();
		await expect(modal).not.toBeVisible();
		await expect(page).toHaveURL(/\/models$/);
		await expect(page.locator('#content h1')).toHaveText('Train Models');
	});

	test('WML-P2-ROUTE-2: Training Setup Help preserves the Model 1 underlay', async ({ page }) => {
		await page.goto('/data');
		await page.locator('app-welcome-modal button.btn-primary').click();
		await page.locator('app-dataset-card[dataset-id="iris"] button.btn-primary').click();
		await expect(page.locator('app-dataset-preview')).toBeAttached();

		await page.goto('/target');
		const targetView = page.locator('app-target-view');
		await expect(targetView.getByTestId('target-ready')).toBeVisible({ timeout: 10_000 });
		const target = targetView.locator('tbody tr:has(th:has-text("class")) button');
		await target.click();
		await expect(target).toHaveText('Current Target');

		await page.goto('/models');
		await page
			.locator('app-models-view')
			.getByRole('link', { name: 'Train New Model' })
			.click();
		await expect(page).toHaveURL('/models/new');
		const builder = page.locator('app-model-builder-view');
		await expect(builder.getByTestId('model-builder')).toBeVisible();
		const originalBuilder = await builder.elementHandle();

		await builder.locator('.page-header').evaluate((header) => {
			const anchor = document.createElement('a');
			anchor.href = '/help/training-setup';
			anchor.textContent = 'Open training setup help';
			header.append(anchor);
		});
		await page.getByRole('link', { name: 'Open training setup help' }).click();
		await expect(page).toHaveURL('/help/training-setup');
		await expect(page).toHaveTitle('samatā.ml | Training Setup');
		const modal = page.locator('app-content-modal dialog');
		await expect(modal).toBeVisible();
		await expect(modal.getByRole('heading', { name: 'One-Shot Training' })).toBeVisible();
		expect(
			await builder.evaluate((element, original) => element === original, originalBuilder)
		).toBe(true);
		expect(await page.evaluate(() => window.__appState!.get().resumePath)).toBe('/models/new');

		await modal.getByRole('button', { name: 'Close' }).click();
		await expect(modal).toBeHidden();
		await expect(page).toHaveURL('/models/new');
		await expect(page).toHaveTitle('samatā.ml | Model 1');
		expect(
			await builder.evaluate((element, original) => element === original, originalBuilder)
		).toBe(true);
	});

	test('WML-P2-ROUTE-2: Training Setup heading is present while loading and after a 404', async ({
		page
	}) => {
		const { promise, resolve } = Promise.withResolvers<void>();
		await page.route('**/content/en/pages/training-setup.html*', async (route) => {
			await promise;
			await route.fulfill({ status: 404 });
		});
		const modal = page.locator('app-content-modal dialog');
		const heading = modal.getByRole('heading', { name: 'Training Setup', exact: true });
		try {
			await page.goto('/help/training-setup');
			await expect(heading).toBeVisible();
			await expect(modal.getByRole('alert')).toHaveCount(0);
		} finally {
			resolve();
		}
		await expect(heading).toBeVisible();
		await expect(modal.getByRole('alert')).toHaveText(
			'This content could not be loaded. Check your connection, then close this dialog and try again.'
		);
	});

	test('WML-P2-HELP-1: the compiled article explains both strategies and the fold limits', async ({
		page
	}) => {
		await page.goto('/help/training-setup');
		const modal = page.getByRole('dialog', { name: 'Training Setup' });
		await expect(modal.getByRole('heading', { name: 'One-Shot Training' })).toBeVisible();
		await expect(
			modal.getByRole('heading', { name: 'Cross-Validation', exact: true })
		).toBeVisible();
		const article = modal.locator('.modal-content');
		for (const text of [
			'80% for training and 20% for testing',
			'stratified',
			'fixed random seed of 42',
			'test rows are held out during training',
			'each fold takes one turn as the validation set',
			'which can take longer',
			'percentages illustrate the proportions for equal-sized folds',
			'Actual row assignments and group sizes depend on your data',
			'smallest class limits the number of folds',
			'Training may still reject a setup when a class is very small',
			'four rows in the smallest class allow four manual folds',
			'three rows from that class, too few for four inner folds'
		]) {
			await expect(article).toContainText(text);
		}
		await expect(article).not.toContainText(/\bphase\s+\d+\b/i);
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
		await expect(welcomeBtn).toBeVisible();
		await welcomeBtn.click();
		await expect(welcomeBtn).not.toBeVisible();

		// Open /about (delayed), then quickly close and navigate to /privacy
		await page.locator('app-sidebar footer a[href="/about"]').click();
		await page.locator('app-content-modal dialog button.btn-icon').click();
		await expect(page).toHaveURL(/\/data$/);
		await page.locator('app-sidebar footer a[href="/privacy"]').click();

		const modal = page.locator('app-content-modal dialog');
		await expect(modal).toBeVisible();
		await expect(modal.locator('h2')).toHaveText('Privacy Policy');
		await expect(modal.locator('.modal-content')).toContainText(
			'Complete privacy is the only option.'
		);

		// Wait past the delayed /about response to confirm it does not overwrite /privacy
		await page.waitForTimeout(450);
		await expect(modal.locator('h2')).toHaveText('Privacy Policy');
		await expect(modal.locator('.modal-content')).not.toContainText(
			'browser-first machine learning pipeline'
		);

		// Rapid Back / Forward history transitions between /about and /privacy
		await page.goto('/about');
		await page.goto('/privacy');
		await expect(modal).toBeVisible();
		await expect(modal.locator('h2')).toHaveText('Privacy Policy');

		delayAbout = true;
		await page.goBack(); // back to /about (about.html fetch delayed)
		await page.goForward(); // immediately forward to /privacy
		await page.waitForTimeout(450);
		await expect(modal).toBeVisible();
		await expect(modal.locator('h2')).toHaveText('Privacy Policy');
		await expect(modal.locator('.modal-content')).toContainText(
			'Complete privacy is the only option.'
		);
		await expect(modal.locator('.modal-content')).not.toContainText(
			'browser-first machine learning pipeline'
		);

		delayAbout = false;
		await page.goBack(); // back to /about settles cleanly
		await expect(modal).toBeVisible();
		await expect(modal.locator('h2')).toHaveText('About samatā.ml');
		await expect(modal.locator('.modal-content')).toContainText(
			'browser-first machine learning pipeline'
		);
	});
});
