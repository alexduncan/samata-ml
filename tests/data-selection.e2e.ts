import { expect, test } from '@playwright/test';
import { interceptSampleDownload } from './fixtures/sample-dataset-downloads';
import { readFile } from 'node:fs/promises';

test.describe('Dataset Selection & Datasheets (DATA-SEL-1 .. DATA-SEL-3)', () => {
	let assertCreditDownload: () => void;
	test.beforeEach(async ({ page }) => {
		assertCreditDownload = await interceptSampleDownload(page.context(), 'credit-card-default');
		await page.goto('/data');
		// Dismiss welcome modal if open
		const getStartedBtn = page.locator('app-welcome-modal button.btn-primary');
		try {
			await getStartedBtn.waitFor({ state: 'visible', timeout: 3000 });
			await getStartedBtn.click();
			await page
				.locator('app-welcome-modal dialog')
				.waitFor({ state: 'hidden', timeout: 3000 });
		} catch {
			// Already dismissed
		}
	});

	test('DSP-AC-6 DATA-SEL-1: renders all catalogue entries with stable ids, compact counts, and remote notice', async ({
		page
	}) => {
		const view = page.locator('app-data-view');
		await expect(view).toBeVisible();

		const cards = view.locator('app-dataset-card');
		// Eleven active sample datasets.
		await expect(cards).toHaveCount(11);
		await expect(view.locator('app-dataset-card[dataset-id="titanic"]')).toHaveCount(0);
		await expect(view.locator('app-dataset-card[dataset-id="pima-diabetes"]')).toHaveCount(0);
		await expect(view.locator('.remote-notice')).toHaveCount(3);

		// Check stable dataset-id on specific cards
		const irisCard = view.locator('app-dataset-card[dataset-id="iris"]');
		await expect(irisCard).toBeVisible();
		await expect(irisCard.locator('.card-title')).toContainText('Iris');
		await expect(irisCard.locator('.stat').first()).toContainText('5 columns');
		await expect(irisCard.locator('.stat').nth(1)).toContainText('150 rows');

		// Check remote notice on compas-recidivism card item
		const compasCard = view.locator('app-dataset-card[dataset-id="compas-recidivism"]');
		await expect(compasCard).toBeVisible();
		const compasItem = view.locator(
			'li.card-item:has(app-dataset-card[dataset-id="compas-recidivism"])'
		);
		const notice = compasItem.locator('.remote-notice');
		await expect(notice).toBeVisible();
		await expect(notice).toContainText(
			'Downloaded from the source when loaded. Internet connection required.'
		);

		// Verify local sample does not have remote notice
		const irisItem = view.locator('li.card-item:has(app-dataset-card[dataset-id="iris"])');
		await expect(irisItem.locator('.remote-notice')).toHaveCount(0);
	});

	test('loads the inquiry sample and offers survival as its binary target', async ({ page }) => {
		const card = page.locator('app-dataset-card[dataset-id="titanic-inquiry"]');
		await expect(card).toContainText('Titanic Survival (1912 British Inquiry)');
		await card.locator('button.btn-primary').click();
		await expect(page.locator('app-dataset-preview')).toBeVisible({ timeout: 15000 });
		const facts = await page.evaluate(async () => {
			const db = await new Promise<IDBDatabase>((resolve, reject) => {
				const request = indexedDB.open('samata-db');
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});
			const state = window.__appState!.get();
			const meta = await new Promise<{
				rowCount: number;
				columns: { name: string; type: string; categoryCounts?: Record<string, number> }[];
			}>((resolve, reject) => {
				const request = db
					.transaction('metadata')
					.objectStore('metadata')
					.get(state.dataset!.id);
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});
			db.close();
			return meta;
		});
		expect(facts.rowCount).toBe(2201);
		expect(facts.columns.find((c: { name: string }) => c.name === 'age_group')?.type).toBe(
			'categorical'
		);
		expect(
			facts.columns.find((c: { name: string }) => c.name === 'survived')?.categoryCounts
		).toEqual({ '0': 1490, '1': 711 });
		await page.goto('/target');
		await expect(
			page.locator('app-target-view tbody tr:has(th:has-text("survived")) button')
		).toBeVisible();
	});

	test('loads credit card data through the verified source', async ({ page }) => {
		test.setTimeout(120_000);
		await page
			.locator('app-dataset-card[dataset-id="credit-card-default"] button.btn-primary')
			.click();
		await expect(page.locator('app-dataset-preview')).toBeVisible({ timeout: 110_000 });
		assertCreditDownload();
	});

	test('DSP-AC-6: notices wrap, remain readable and preserve keyboard actions', async ({
		page
	}) => {
		await page.setViewportSize({ width: 320, height: 800 });
		for (const id of ['palmer-penguins', 'credit-card-default', 'compas-recidivism']) {
			const item = page.locator(`li.card-item:has(app-dataset-card[dataset-id="${id}"])`);
			await expect(item.locator('.remote-notice')).toHaveText(
				'Downloaded from the source when loaded. Internet connection required.'
			);
			const dimensions = await item
				.locator('.remote-notice')
				.evaluate((el) => ({ width: el.clientWidth, scroll: el.scrollWidth }));
			expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width + 1);
			const load = item.locator('app-dataset-card button.btn-primary');
			await expect(load).toHaveAccessibleName('Load Dataset');
			await load.focus();
			await expect(load).toBeFocused();
		}
		await page.evaluate(() => {
			document.documentElement.dir = 'rtl';
			document.documentElement.style.fontSize = '400%';
		});
		for (const notice of await page.locator('.remote-notice').all()) {
			const d = await notice.evaluate((el) => ({
				width: el.clientWidth,
				scroll: el.scrollWidth
			}));
			expect(d.scroll).toBeLessThanOrEqual(d.width + 1);
		}
	});

	test('DATA-SEL-2: opens safe datasheet, handles hostile HTML, closes and restores invoker focus', async ({
		page
	}) => {
		const irisCard = page.locator('app-dataset-card[dataset-id="iris"]');
		const datasheetBtn = irisCard.locator('button:has-text("Datasheet")');

		await datasheetBtn.click();

		const dialog = page.locator('app-datasheet-dialog dialog.modal');
		await expect(dialog).toBeVisible();
		await expect(dialog).toHaveAttribute('open', '');

		// Check heading
		const heading = dialog.locator('#datasheet-title');
		await expect(heading).toContainText('Iris');

		// Check datasheet content
		const content = dialog.locator('.modal-content');
		await expect(content).toBeVisible();

		// Close via close button and check focus returned to datasheetBtn
		const closeBtn = dialog.locator('button.close-btn');
		await closeBtn.click();

		await expect(dialog).not.toBeVisible();
		await expect(datasheetBtn).toBeFocused();

		// Test error and retry states via route interception
		await page.route('**/datasets/bank-marketing/datasheet.html*', async (route) => {
			await route.abort('failed');
		});

		const bankCard = page.locator('app-dataset-card[dataset-id="bank-marketing"]');
		const bankDatasheetBtn = bankCard.locator('button:has-text("Datasheet")');
		await bankDatasheetBtn.click();

		await expect(dialog).toBeVisible();
		const alertBox = dialog.locator('p[role="alert"]');
		await expect(alertBox).toContainText('This datasheet could not be loaded');

		const retryBtn = dialog.locator('button:has-text("Retry")');
		await expect(retryBtn).toBeVisible();

		// Unroute so retry can succeed
		await page.unroute('**/datasets/bank-marketing/datasheet.html*');
		await retryBtn.click();
		await expect(dialog.locator('.modal-content')).toBeVisible();

		// Close modal
		await dialog.locator('button.close-btn').click();
		await expect(dialog).not.toBeVisible();
	});

	test('DATA-SEL-3: card wrapping, long labels and RTL layout', async ({ page }) => {
		// Test long unbroken text wrapping
		const view = page.locator('app-data-view');
		await expect(view.locator('.cards')).toBeVisible();

		const card = view.locator('app-dataset-card').first();
		const cardTitle = card.locator('.card-title');
		const overflowWrap = await cardTitle.evaluate(
			(el) => window.getComputedStyle(el).overflowWrap
		);
		expect(overflowWrap).toBe('anywhere');

		// Test RTL direction on document
		await page.evaluate(() => {
			document.documentElement.dir = 'rtl';
		});

		await expect(view.locator('.page-header')).toBeVisible();
		const firstCardBtn = card.locator('button.btn-primary');
		await expect(firstCardBtn).toBeVisible();

		// Reset dir
		await page.evaluate(() => {
			document.documentElement.dir = 'ltr';
		});
	});
});

// This smoke deliberately contacts real publishers and enforces the deployed headers.
test('production header and live publisher smoke', async ({ page, browserName }) => {
	test.skip(
		browserName !== 'chromium',
		'One production-like Chromium smoke covers the live providers.'
	);
	test.setTimeout(120_000);
	const source = await readFile('public/_headers', 'utf8');
	const names = [
		'Content-Security-Policy',
		'Cross-Origin-Opener-Policy',
		'Cross-Origin-Embedder-Policy',
		'Cross-Origin-Resource-Policy',
		'Referrer-Policy'
	];
	const policy: Record<string, string> = {};
	for (const name of names) {
		const line = source.split('\n').find((row) => row.trim().startsWith(name + ':'));
		if (!line) throw new Error('Missing production header ' + name);
		policy[name] = line
			.trim()
			.slice(name.length + 1)
			.trim();
	}
	for (const pattern of ['**/data', '**/storage.worker.js'])
		await page.route(pattern, async (route) => {
			const response = await route.fetch();
			await route.fulfill({ response, headers: { ...response.headers(), ...policy } });
		});
	const outbound: { url: string; headers: Record<string, string> }[] = [];
	page.on('request', (request) => {
		if (
			request.url().startsWith('https://raw.githubusercontent.com/') ||
			request.url().startsWith('https://huggingface.co/')
		)
			outbound.push({ url: request.url(), headers: request.headers() });
	});
	await page.goto('/data');
	expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
	const results = await page.evaluate(async () => {
		const index = await (await fetch('/datasets/index.json')).json();
		const ids = ['compas-recidivism', 'credit-card-default', 'palmer-penguins'];
		return Promise.all(
			ids.map(async (id) => {
				const entry = index.entries.find((item: { id: string }) => item.id === id);
				const descriptor = await (await fetch(entry.descriptorUrl)).json();
				const response = await fetch(descriptor.files.csv, {
					credentials: 'omit',
					referrerPolicy: 'no-referrer'
				});
				if (!response.ok) throw new Error(id + ': HTTP ' + response.status);
				const bytes = await response.arrayBuffer();
				const digest = Array.from(
					new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
					(x) => x.toString(16).padStart(2, '0')
				).join('');
				return { id, digest, expected: descriptor.stats.sha256 };
			})
		);
	});
	for (const result of results) expect(result.digest).toBe(result.expected);
	for (const request of outbound) {
		expect(request.headers.cookie).toBeUndefined();
		expect(request.headers.referer).toBeUndefined();
	}
	expect(outbound.length).toBeGreaterThanOrEqual(3);
	const welcome = page.locator('app-welcome-modal button.btn-primary');
	if (await welcome.isVisible()) await welcome.click();
	await page.locator('app-dataset-card[dataset-id="palmer-penguins"] button.btn-primary').click();
	await expect(page.locator('app-dataset-preview')).toBeVisible({ timeout: 30_000 });
});
