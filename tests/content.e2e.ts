import { expect, test, type Request } from '@playwright/test';
import type { ContentIndex } from '../src/types/content';
import type { PersistedAppState } from '../src/types/state';
import {
	expectFixturePage,
	fixtureFragmentPath,
	mockReservedPages
} from './helpers/content-fixtures';
import { expectReservedModalClosed, waitForPersistedAppState } from './helpers/e2e-settlement';
import { dismissWelcomeModal, loadSampleDataset } from './journeys/helpers';

test.describe('Static Content Modal E2E (CNT-E2E-1 .. CNT-E2E-4)', () => {
	test.describe('Help term definitions', () => {
		test.use({ hasTouch: true });

		test('TERM-AC-1: Help definitions are available by keyboard and touch', async ({
			page
		}) => {
			await mockReservedPages(page);
			await page.goto('/data');
			await dismissWelcomeModal(page);
			const help = page.locator('app-sidebar a[href="/help"]');
			const dialog = page.locator('app-content-modal dialog');

			await help.focus();
			await page.keyboard.press('Enter');
			await expectFixturePage(dialog, 'help');
			await page.keyboard.press('Escape');
			await expectReservedModalClosed(page, dialog, /\/data$/);
			await expect(help).toBeFocused();

			await help.tap();
			await expectFixturePage(dialog, 'help');
			await dialog.getByRole('button', { name: 'Close' }).tap();
			await expectReservedModalClosed(page, dialog, /\/data$/);
		});
	});

	test('CNT-E2E-1: /privacy renders the compiled article with its name, language and direction', async ({
		page
	}) => {
		const indexResponse = await page.request.get('/content/en/pages/index.json');
		await expect(indexResponse).toBeOK();
		const index = (await indexResponse.json()) as ContentIndex<'pages'>;
		expect(index.version).toBe(1);
		const entry = index.entries.find(({ id }) => id === 'privacy-policy');
		if (!entry) throw new Error('The compiled page index is missing the Privacy entry.');
		const fragmentUrl = new URL(entry.url, indexResponse.url()).href;
		const [fragmentResponse] = await Promise.all([
			page.waitForResponse(fragmentUrl),
			page.goto('/privacy')
		]);
		expect(fragmentResponse.ok()).toBe(true);

		const modal = page.locator('app-content-modal dialog');
		await expect(modal).toBeVisible();
		const heading = modal.locator('#content-dialog-title');
		await expect(heading).toHaveText(entry.title);
		await expect(heading).toHaveAttribute('lang', entry.lang);
		await expect(heading).toHaveAttribute('dir', 'ltr');
		await expect(modal).toHaveAttribute('aria-labelledby', 'content-dialog-title');
		await expect(modal).toHaveAccessibleName(entry.title);

		const body = modal.locator('.modal-content');
		await expect(body).toBeVisible();
		await expect(body).toHaveAttribute('aria-busy', 'false');
		await expect(body).toHaveAttribute('lang', entry.lang);
		await expect(body).toHaveAttribute('dir', 'ltr');
		await expect(body).toHaveText(/\S/);
	});

	test('CNT-E2E-2: /help shows an ordered list and external links enforce target and rel', async ({
		page
	}) => {
		await mockReservedPages(page);
		await page.goto('/help');
		const modal = page.locator('app-content-modal dialog');
		await expectFixturePage(modal, 'help');
		await expect(modal.locator('.modal-content ol > li')).toHaveText([
			'Choose input',
			'Choose an outcome',
			'Fit a classifier',
			'Read the scores'
		]);

		await modal.getByRole('button', { name: 'Close' }).click();
		await expectReservedModalClosed(page, modal, /\/data$/);
		await dismissWelcomeModal(page);

		await page.locator('app-sidebar footer a[href="/about"]').click();
		await expectFixturePage(modal, 'about');
		await expect(modal.locator('.modal-content #fixture-about-detail')).toBeVisible();
		const externalLink = modal.locator('.modal-content a[href="https://example.org"]');
		await expect(externalLink).toHaveAttribute('target', '_blank');
		await expect(externalLink).toHaveAttribute('rel', 'noopener noreferrer');
	});

	test('CNT-E2E-3: index 404 shows alert and close button returns to underlay URL', async ({
		page
	}) => {
		await mockReservedPages(page);
		await page.route('**/content/en/pages/index.json*', (route) =>
			route.fulfill({ status: 404 })
		);
		await page.goto('/models');
		await dismissWelcomeModal(page);

		await page.locator('app-sidebar footer a[href="/about"]').click();
		await expect(page).toHaveURL('/about');
		const modal = page.locator('app-content-modal dialog');
		await expect(modal).toBeVisible();
		await expect(modal.getByRole('alert')).toHaveText(
			'This content could not be loaded. Check your connection, then close this dialog and try again.'
		);

		await modal.getByRole('button', { name: 'Close' }).click();
		await expectReservedModalClosed(page, modal, /\/models$/);
		await expect(page.locator('#content h1')).toHaveText('Train Models');
	});

	test('WML-P2-ROUTE-2: Training Setup Help preserves the Model 1 underlay', async ({ page }) => {
		await mockReservedPages(page);
		await page.goto('/data');
		await loadSampleDataset(page, 'iris');
		const datasetId = await page.evaluate(() => window.__appState!.get().dataset?.id);
		expect(datasetId).toBeTruthy();
		await waitForPersistedAppState(page, (state) => {
			const { dataset, onboarding } = state as Partial<PersistedAppState>;
			return (
				onboarding?.welcomeDismissed === true &&
				dataset?.sampleId === 'iris' &&
				dataset.id === datasetId
			);
		});

		await page.goto('/target');
		const targetView = page.locator('app-target-view');
		await expect(targetView.getByTestId('target-ready')).toBeVisible({ timeout: 10_000 });
		const target = targetView.locator('tbody tr:has(th:has-text("class")) button');
		await target.click();
		await expect(target).toHaveText('Current Target');
		await waitForPersistedAppState(page, (state) => state.target === 'class');

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
		await expectFixturePage(modal, 'training-setup');
		expect(
			await builder.evaluate((element, original) => element === original, originalBuilder)
		).toBe(true);
		expect(await page.evaluate(() => window.__appState!.get().resumePath)).toBe('/models/new');

		await modal.getByRole('button', { name: 'Close' }).click();
		await expectReservedModalClosed(page, modal, /\/models\/new$/);
		await expect(page).toHaveTitle('samatā.ml | Model 1');
		expect(
			await builder.evaluate((element, original) => element === original, originalBuilder)
		).toBe(true);
	});

	test('WML-P2-ROUTE-2: Training Setup heading is present while loading and after a 404', async ({
		page
	}) => {
		await mockReservedPages(page);
		const { promise, resolve } = Promise.withResolvers<void>();
		await page.route('**/content/en/pages/training-setup.html*', async (route) => {
			await promise;
			await route.fulfill({ status: 404 });
		});
		const modal = page.locator('app-content-modal dialog');
		const heading = modal.locator('#content-dialog-title');
		try {
			await page.goto('/help/training-setup');
			await expect(heading).toHaveText('Training Setup');
			await expect(modal).toHaveAccessibleName('Training Setup');
			await expect(modal.locator('.modal-content')).toHaveAttribute('aria-busy', 'true');
			await expect(modal.getByRole('alert')).toHaveCount(0);
		} finally {
			resolve();
		}
		await expect(heading).toHaveText('Training Setup');
		await expect(modal.getByRole('alert')).toHaveText(
			'This content could not be loaded. Check your connection, then close this dialog and try again.'
		);
	});

	test('WML-P2-HELP-1: the Training Setup route renders article headings and a semantic table', async ({
		page
	}) => {
		await mockReservedPages(page);
		await page.goto('/help/training-setup');
		const modal = page.locator('app-content-modal dialog');
		await expectFixturePage(modal, 'training-setup');
		await expect(modal.getByRole('heading', { name: 'Example strategies' })).toBeVisible();
		const table = modal.getByRole('table');
		await expect(table.getByRole('columnheader')).toHaveText([
			'Strategy',
			'Benefits',
			'Drawbacks'
		]);
		await expect(table.getByRole('rowheader')).toHaveText(['One split', 'Several folds']);
	});

	test('CNT-E2E-4: rapid /about to /privacy navigation and back/forward never shows stale body', async ({
		page
	}) => {
		await mockReservedPages(page);
		const observed = Promise.withResolvers<Request>();
		const release = Promise.withResolvers<void>();
		await page.route(
			(url) =>
				url.origin === new URL(page.url()).origin &&
				url.pathname === fixtureFragmentPath('about'),
			async (route) => {
				observed.resolve(route.request());
				await release.promise;
				await route.fallback();
			},
			{ times: 1 }
		);

		await page.goto('/data');
		await dismissWelcomeModal(page);
		const documentStarted = await page.evaluate(() => performance.timeOrigin);
		const modal = page.locator('app-content-modal dialog');
		const about = page.locator('app-sidebar footer a[href="/about"]');
		const privacy = page.locator('app-sidebar footer a[href="/privacy"]');
		try {
			await about.click();
			const request = await observed.promise;
			const response = request.response();
			await expect(modal.locator('.modal-content')).toHaveAttribute('aria-busy', 'true');

			// The open About dialog makes the sidebar inert to pointer input.
			await privacy.evaluate((link: HTMLAnchorElement) => link.click());
			await expect(page).toHaveURL('/privacy');
			await expectFixturePage(modal, 'privacy-policy');
			release.resolve();
			const settledResponse = await response;
			if (settledResponse) await settledResponse.finished();
			else expect(request.failure()).not.toBeNull();
			await expectFixturePage(modal, 'privacy-policy');
			await expect(modal.locator('#fixture-about')).toHaveCount(0);
		} finally {
			release.resolve();
		}

		// Opening one overlay from another replaces its history entry. Open each from
		// a separate workflow entry to exercise both preserved entries in this document.
		await modal.getByRole('button', { name: 'Close' }).click();
		await expectReservedModalClosed(page, modal, /\/data$/);
		await about.click();
		await expectFixturePage(modal, 'about');
		await page
			.locator('app-sidebar a[href="/models"]')
			.evaluate((link: HTMLAnchorElement) => link.click());
		await expect(page).toHaveURL('/models');
		await expect(modal).toBeHidden();
		await privacy.click();
		await expectFixturePage(modal, 'privacy-policy');

		await page.goBack();
		await expectReservedModalClosed(page, modal, /\/models$/);
		await page.goBack();
		await expect(page).toHaveURL('/about');
		await expectFixturePage(modal, 'about');
		await expect(modal.locator('#fixture-privacy-policy')).toHaveCount(0);
		await page.goForward();
		await expectReservedModalClosed(page, modal, /\/models$/);
		await page.goForward();
		await expect(page).toHaveURL('/privacy');
		await expectFixturePage(modal, 'privacy-policy');
		await expect(modal.locator('#fixture-about')).toHaveCount(0);
		expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentStarted);
	});
});
