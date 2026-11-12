import { expect, test } from '@playwright/test';

test.describe('App Shell & Navigation E2E (NAV-E2E-1, 2, 3, 9)', () => {
	test.beforeEach(async ({ page }) => {
		// Start with clean state
		await page.goto('/data');
		// Dismiss welcome modal if open
		const getStartedBtn = page.locator('app-welcome-modal button.btn-primary');
		if (await getStartedBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
			await getStartedBtn.click();
		}
	});

	test('NAV-E2E-1: Data -> Target -> Models workflow navigation and back/forward history', async ({
		page
	}) => {
		await expect(page.locator('#content h1')).toHaveText('Load Data');
		expect(page.url()).toContain('/data');

		// Click step 2: Set Target
		await page.locator('app-sidebar a[href="/target"]').click();
		await expect(page.locator('#content h1')).toHaveText('Set Target');
		expect(page.url()).toContain('/target');

		// Click step 3: Train Models
		await page.locator('app-sidebar a[href="/models"]').click();
		await expect(page.locator('#content h1')).toHaveText('Train Models');
		expect(page.url()).toContain('/models');

		// Browser Back -> /target
		await page.goBack();
		await expect(page.locator('#content h1')).toHaveText('Set Target');
		expect(page.url()).toContain('/target');

		// Browser Back -> /data
		await page.goBack();
		await expect(page.locator('#content h1')).toHaveText('Load Data');
		expect(page.url()).toContain('/data');

		// Browser Forward -> /target
		await page.goForward();
		await expect(page.locator('#content h1')).toHaveText('Set Target');
		expect(page.url()).toContain('/target');
	});

	test('NAV-E2E-2: Root URL resumes last visited workflow path, unknown URL redirects', async ({
		page
	}) => {
		// Navigate to /target
		await page.locator('app-sidebar a[href="/target"]').click();
		await expect(page.locator('#content h1')).toHaveText('Set Target');

		// Visiting root / should resolve to resumePath (/target)
		await page.goto('/');
		await expect(page.locator('#content h1')).toHaveText('Set Target');
		expect(page.url()).toContain('/target');

		// Visiting an unknown path should replace to resumePath
		await page.goto('/unknown-random-route');
		await expect(page.locator('#content h1')).toHaveText('Set Target');
		expect(page.url()).toContain('/target');
	});

	test('NAV-E2E-3: Opening and closing reserved route modal leaves underlay intact', async ({
		page
	}) => {
		// Go to /models
		await page.locator('app-sidebar a[href="/models"]').click();
		await expect(page.locator('#content h1')).toHaveText('Train Models');

		// Open about modal via footer
		await page.locator('app-sidebar footer a[href="/about"]').click();
		expect(page.url()).toContain('/about');

		const modal = page.locator('app-content-modal dialog');
		await expect(modal).toBeVisible();
		await expect(modal.locator('h2')).toHaveText('About samatā.ml');

		// Underlay content is still mounted underneath
		await expect(page.locator('#content h1')).toHaveText('Train Models');

		// Close modal via close button
		await modal.locator('button.close-btn').click();
		await expect(modal).not.toBeVisible();
		expect(page.url()).toContain('/models');
		await expect(page.locator('#content h1')).toHaveText('Train Models');
	});

	test('NAV-E2E-9: Deep link to /models/1 loads cleanly with root-absolute assets', async ({
		page
	}) => {
		const failedRequests: string[] = [];
		page.on('requestfailed', (req) => {
			failedRequests.push(req.url());
		});

		await page.goto('/models/1');

		// Check heading
		await expect(page.locator('#content h1')).toHaveText('Model 1');

		// Sidebar should render steps
		await expect(page.locator('app-sidebar nav.steps')).toBeVisible();

		// No stylesheet or script asset requests should have failed
		const assetFailures = failedRequests.filter(
			(url) => url.endsWith('.css') || url.endsWith('.js')
		);
		expect(assetFailures).toEqual([]);
	});
});
