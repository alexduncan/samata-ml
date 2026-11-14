import { expect, test } from '@playwright/test';

test.describe('App Shell & Navigation E2E (NAV-E2E-1, 2, 3, 9)', () => {
	test.beforeEach(async ({ page }) => {
		// Start with clean state
		await page.goto('/data');
		// Dismiss welcome modal if open
		const getStartedBtn = page.locator('app-welcome-modal button.btn-primary');
		try {
			await getStartedBtn.waitFor({ state: 'visible', timeout: 5000 });
			await getStartedBtn.click();
			await page
				.locator('app-welcome-modal dialog')
				.waitFor({ state: 'hidden', timeout: 5000 });
		} catch {
			// Welcome modal already dismissed or not present
		}
	});

	test('NAV-E2E-1: Data -> Target -> Models workflow navigation and back/forward history', async ({
		page
	}) => {
		await expect(page.locator('#content h1')).toHaveText(/^(Load|Select) Data$/);
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
		await expect(page.locator('#content h1')).toHaveText(/^(Load|Select) Data$/);
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
		await expect(modal.locator('h1')).toHaveText('About samatā.ml');

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

	test('NAV-E2E-2d: Sidebar link aria-current conforms to SEM-03', async ({ page }) => {
		for (const path of ['/data', '/target', '/models', '/results']) {
			await page.goto(path);
			// Exactly one a[aria-current="page"] exists and matches path
			const currentLinks = page.locator('app-sidebar a[aria-current="page"]');
			await expect(currentLinks).toHaveCount(1);
			expect(await currentLinks.getAttribute('href')).toBe(path);

			// No li[aria-current] exists
			const currentLis = page.locator('app-sidebar li[aria-current]');
			await expect(currentLis).toHaveCount(0);

			// No empty aria-current attribute exists anywhere in app-sidebar
			const emptyAriaCurrent = page.locator('app-sidebar [aria-current=""]');
			await expect(emptyAriaCurrent).toHaveCount(0);

			// Activating the current link adds no history entry and keeps focus on link
			const initialLength = await page.evaluate(() => window.history.length);
			await currentLinks.click();
			const afterLength = await page.evaluate(() => window.history.length);
			expect(afterLength).toBe(initialLength);
		}
	});

	test('SNC-14: Focus management on reload, user navigation, and modal dismiss', async ({
		page
	}) => {
		// 1. Reload on /target: activeElement is not <h1>
		await page.goto('/target');
		const activeTagOnLoad = await page.evaluate(() => document.activeElement?.tagName);
		expect(activeTagOnLoad).not.toBe('H1');

		// 2. Click sidebar link to /models: activeElement is #content h1
		await page.locator('app-sidebar a[href="/models"]').click();
		await expect(page.locator('#content h1')).toHaveText('Train Models');
		const activeTagAfterNav = await page.evaluate(
			() => document.activeElement === document.querySelector('#content h1')
		);
		expect(activeTagAfterNav).toBe(true);

		// 3. /target -> open /about -> Esc: focus is not on <h1>
		await page.locator('app-sidebar a[href="/target"]').click();
		await page.locator('app-sidebar footer a[href="/about"]').click();
		const modal = page.locator('app-content-modal dialog');
		await expect(modal).toBeVisible();

		await page.keyboard.press('Escape');
		await expect(modal).not.toBeVisible();
		const activeAfterEsc = await page.evaluate(
			() => document.activeElement === document.querySelector('#content h1')
		);
		expect(activeAfterEsc).toBe(false);
	});

	test('SNC-15: Scroll restoration across navigation and modal open/close', async ({ page }) => {
		await page.goto('/target');
		await page.addStyleTag({ content: '#content { min-height: 300vh !important; }' });

		// Scroll down /target
		await page.evaluate(() => window.scrollTo(0, 600));
		await page.waitForTimeout(200); // Allow scroll event and debounce

		// Click to /models
		await page.locator('app-sidebar a[href="/models"]').click();
		await expect(page.locator('#content h1')).toHaveText('Train Models');

		// Back to /target
		await page.goBack();
		await expect(page.locator('#content h1')).toHaveText('Set Target');
		await page.waitForTimeout(100);

		const scrollYOnReturn = await page.evaluate(() => window.scrollY);
		expect(Math.abs(scrollYOnReturn - 600)).toBeLessThanOrEqual(2);

		// Open /about
		await page.locator('app-sidebar footer a[href="/about"]').click();
		const modal = page.locator('app-content-modal dialog');
		await expect(modal).toBeVisible();

		// Close /about
		await modal.locator('button.close-btn').click();
		await expect(modal).not.toBeVisible();

		const scrollYAfterModal = await page.evaluate(() => window.scrollY);
		expect(scrollYAfterModal).toBe(scrollYOnReturn);
	});

	test('SNC-16: Link clicks in sidebar and reserved dialog trigger client-side navigation without page reload', async ({
		page
	}) => {
		await page.goto('/data');

		// Set a marker on the window object. If a full page reload occurs, this property is lost.
		await page.evaluate(() => {
			(window as any).__spaMarker = 'persists-across-client-navigation';
		});

		let documentNavigationRequests = 0;
		page.on('request', (req) => {
			if (req.isNavigationRequest() && req.frame() === page.mainFrame()) {
				documentNavigationRequests++;
			}
		});

		// 1. Sidebar link click
		await page.locator('app-sidebar a[href="/target"]').click();
		await expect(page.locator('#content h1')).toHaveText('Set Target');
		expect(page.url()).toContain('/target');
		expect(await page.evaluate(() => (window as any).__spaMarker)).toBe(
			'persists-across-client-navigation'
		);

		// 2. Footer reserved link click
		await page.locator('app-sidebar footer a[href="/about"]').click();
		const modal = page.locator('app-content-modal dialog');
		await expect(modal).toBeVisible();
		expect(page.url()).toContain('/about');
		expect(await page.evaluate(() => (window as any).__spaMarker)).toBe(
			'persists-across-client-navigation'
		);

		// Zero document navigation requests occurred
		expect(documentNavigationRequests).toBe(0);
	});
});
