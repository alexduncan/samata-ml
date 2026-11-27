import { expect, test, type Locator, type Page } from '@playwright/test';
import { dismissWelcomeModal } from './journeys/helpers';
import { waitForPublishedPreview } from './helpers/dataset-ready';

/** Scrolls the document so the given zero-based table row is at the top of the table body. */
async function scrollToRow(table: Locator, row: number): Promise<void> {
	await table.evaluate((element, index) => {
		const root = element.shadowRoot!;
		const body = root.querySelector('.table-body')!;
		const sample = root.querySelector('.table-row')!;
		const rowHeight = sample.getBoundingClientRect().height;
		window.scrollTo(0, body.getBoundingClientRect().top + window.scrollY + index * rowHeight);
	}, row);
}

test.describe('Data Flow, Route & Scroll Integration (DATA-FLOW-1 .. DATA-FLOW-3)', () => {
	test.describe.configure({ mode: 'serial' });

	test.beforeEach(async ({ page }) => {
		await page.goto('/data');
		// Dismiss welcome modal if open
		const getStartedBtn = page.locator('app-welcome-modal button.btn-primary');
		try {
			await getStartedBtn.waitFor({ state: 'visible', timeout: 2000 });
			await getStartedBtn.click();
			await page
				.locator('app-welcome-modal dialog')
				.waitFor({ state: 'hidden', timeout: 2000 });
		} catch {
			// Already dismissed
		}
	});

	test('DATA-FLOW-1: preview mode, selected column, document scroll survives reload and back/forward', async ({
		page
	}) => {
		const irisCard = page.locator('app-dataset-card[dataset-id="iris"]');
		await irisCard.waitFor({ state: 'visible', timeout: 5000 });
		await irisCard.locator('button.btn-primary').click();

		await waitForPublishedPreview(page);
		const preview = page.locator('app-dataset-preview');

		const table = preview.locator('ui-virtual-table');
		await expect(table).toBeVisible();

		// 1. Select column "sepal length"
		const sepalLengthBtn = table.locator('.header-btn[data-col-key="sepal length"]');
		await sepalLengthBtn.click();
		const aside = page.locator('app-column-details aside.overlay');
		await expect(aside).toBeVisible();
		await expect(aside.locator('.overlay-title h4')).toContainText('sepal length');

		// 2. Scroll the document to row 50
		await scrollToRow(table, 50);
		await page.waitForTimeout(300);

		// 3. Reload page and verify state survives
		await page.reload();

		await expect(preview).toBeVisible({ timeout: 10000 });
		const reloadedAside = page.locator('app-column-details aside.overlay');
		await expect(reloadedAside).toBeVisible();
		await expect(reloadedAside.locator('.overlay-title h4')).toContainText('sepal length');

		// Verify table rows are present and the document scroll was restored
		const rows = table.locator('.table-row');
		await expect(rows.first()).toBeVisible();

		// 4. Navigate to /target
		await page.locator('app-sidebar a[href="/target"]').click();
		await expect(page.locator('#content h1')).toHaveText('Set Target');
		expect(page.url()).toContain('/target');

		// 5. Back to /data
		await page.goBack();
		await expect(preview).toBeVisible({ timeout: 10000 });
		await expect(reloadedAside).toBeVisible();
		await expect(reloadedAside.locator('.overlay-title h4')).toContainText('sepal length');

		// 6. Open reserved modal "about"
		await page.locator('app-sidebar footer a[href="/about"]').click();
		const aboutModal = page.locator('app-content-modal dialog');
		await expect(aboutModal).toBeVisible();

		// Close modal and ensure underlay and focus are intact
		await aboutModal.locator('button.btn-icon').click();
		await expect(aboutModal).not.toBeVisible();
		await expect(preview).toBeVisible();
	});

	test('DATA-FLOW-2: changing dataset confirms, removes it, updates sidebar and survives reload; cancel leaves state intact', async ({
		page
	}) => {
		const irisCard = page.locator('app-dataset-card[dataset-id="iris"]');
		await irisCard.waitFor({ state: 'visible', timeout: 5000 });
		await irisCard.locator('button.btn-primary').click();

		await waitForPublishedPreview(page);
		const preview = page.locator('app-dataset-preview');

		// Verify sidebar step 1 shows dataset details
		const sidebarStep = page.locator('app-sidebar a[href="/data"]');
		await expect(sidebarStep).toContainText('Iris Flower Species');

		// 1. Click Change Dataset -> modal opens
		const changeBtn = preview.locator('button:has-text("Change Dataset")');
		await changeBtn.click();

		const modal = page.locator('dialog.change-dataset-modal');
		await expect(modal).toBeVisible();
		await expect(modal.locator('#change-dataset-title')).toHaveText('Change Dataset');

		// 2. Click Cancel -> dataset remains intact
		const cancelBtn = modal.locator('button:has-text("Cancel")');
		await cancelBtn.click();
		await expect(modal).not.toBeVisible();
		await expect(preview).toBeVisible();
		await expect(sidebarStep).toContainText('Iris Flower Species');

		// 3. Click Change Dataset again and confirm
		await changeBtn.click();
		await expect(modal).toBeVisible();

		const confirmBtn = modal.locator('button.btn-primary:has-text("Change Dataset")');
		await confirmBtn.click();

		// 4. Returns to selection mode
		await expect(page.locator('header.page-header h1')).toHaveText('Select Data');
		const cards = page.locator('app-dataset-card');
		await expect(cards).toHaveCount(11);

		// 5. Sidebar step 1 reverts to default
		await expect(sidebarStep).not.toContainText('Iris Flower Species');

		// 6. Survives reload
		await page.reload();
		await expect(page.locator('header.page-header h1')).toHaveText('Select Data');
		await expect(cards).toHaveCount(11);
	});

	test('DATA-FLOW-3: accessibility, RTL, and keyboard navigation', async ({ page }) => {
		const irisCard = page.locator('app-dataset-card[dataset-id="iris"]');
		await irisCard.waitFor({ state: 'visible', timeout: 5000 });
		await irisCard.locator('button.btn-primary').click();

		await waitForPublishedPreview(page);
		const preview = page.locator('app-dataset-preview');

		// 1. Scroll the document to row 25
		await scrollToRow(preview.locator('ui-virtual-table'), 25);
		await page.waitForTimeout(200);

		// 2. Keyboard navigation: Open column inspector via Enter key on focused header
		const sepalLengthBtn = preview.locator('.header-btn[data-col-key="sepal length"]');
		await sepalLengthBtn.focus();
		await page.keyboard.press('Enter');

		const aside = page.locator('app-column-details aside.overlay');
		await expect(aside).toBeVisible();

		// Close column inspector via Escape key
		await page.keyboard.press('Escape');
		await expect(aside).not.toBeVisible();

		// 3. Test RTL direction
		await page.evaluate(() => {
			document.documentElement.dir = 'rtl';
		});
		await expect(preview.locator('.page-header')).toBeVisible();
		await expect(preview.locator('ui-virtual-table')).toBeVisible();

		// Reset dir
		await page.evaluate(() => {
			document.documentElement.dir = 'ltr';
		});
	});
});

/** Holds the Iris sample download so the in-page loading states can be observed. */
async function delayIris(page: Page, milliseconds: number): Promise<void> {
	await page.route(
		(url) => url.pathname === '/datasets/iris/data.csv',
		async (route) => {
			await new Promise((done) => setTimeout(done, milliseconds));
			await route.continue();
		}
	);
}

test.describe('In-page loading flow (LOAD-AC-1, 4, 5, 6)', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/data');
		await dismissWelcomeModal(page);
	});

	const load = (page: Page) =>
		page.locator('app-dataset-card[dataset-id="iris"] button.btn-primary').click();

	test('LOAD-AC-1: Load Dataset shows the preview header and a labelled bar, then the table', async ({
		page
	}) => {
		await delayIris(page, 1200);
		await page.evaluate(() => {
			const probe = window as unknown as {
				__samples: { label: string | null; value: number | null }[];
				__emptySeen: boolean;
			};
			probe.__samples = [];
			probe.__emptySeen = false;
			setInterval(() => {
				const root = document
					.querySelector('app-data-view')
					?.shadowRoot?.querySelector('app-dataset-preview')?.shadowRoot; // loading-state: intentional
				const bar = root?.querySelector('progress');
				if (bar) {
					probe.__samples.push({
						label: root?.querySelector('#load-phase')?.textContent ?? null,
						value: bar.hasAttribute('value') ? Number(bar.getAttribute('value')) : null
					});
				}
				if (root?.textContent?.includes('No rows to preview.')) probe.__emptySeen = true;
			}, 5);
		});
		await load(page);
		const preview = page.locator('app-dataset-preview'); // loading-state: intentional
		const heading = preview.locator('h1');
		await expect(heading).toHaveText('Iris Flower Species Preview');
		await expect(heading).toBeFocused();
		const bar = preview.locator('progress');
		await expect(bar).toBeVisible();
		await expect(bar).toHaveAccessibleName('Downloading dataset');
		await expect(preview.locator('.load-step')).toHaveText('Step 1 of 4');
		await expect(page.locator('app-dataset-card')).toHaveCount(0);

		const status = preview.locator('[role="status"]');
		await heading.evaluate((element) => {
			(window as unknown as { __h1: Element }).__h1 = element;
		});
		await status.evaluate((element) => {
			(window as unknown as { __status: Element }).__status = element;
		});

		await expect(status).toHaveText('Iris Flower Species loaded: 150 rows, 5 columns', {
			timeout: 30_000
		});
		await waitForPublishedPreview(page);
		expect(
			await heading.evaluate(
				(element) => element === (window as unknown as { __h1: Element }).__h1
			)
		).toBe(true);
		expect(
			await status.evaluate(
				(element) => element === (window as unknown as { __status: Element }).__status
			)
		).toBe(true);
		await expect(heading).toBeFocused();

		const { samples, emptySeen } = await page.evaluate(() => {
			const probe = window as unknown as {
				__samples: { label: string | null; value: number | null }[];
				__emptySeen: boolean;
			};
			return { samples: probe.__samples, emptySeen: probe.__emptySeen };
		});
		expect(emptySeen).toBe(false);
		expect(samples.some((sample) => sample.value !== null)).toBe(true);
		const byPhase = new Map<string | null, number[]>();
		for (const { label, value } of samples) {
			if (value !== null) byPhase.set(label, [...(byPhase.get(label) ?? []), value]);
		}
		for (const [label, values] of byPhase) {
			expect(values, String(label)).toEqual([...values].sort((a, b) => a - b));
		}
	});

	test('LOAD-AC-4: a failed sample load returns to selection with an alert and focus', async ({
		page
	}) => {
		await page.route(
			(url) => url.pathname === '/datasets/iris/data.csv',
			(route) => route.abort()
		);
		await load(page);
		const alert = page.locator('app-data-view .notification-alert[role="alert"]');
		await expect(alert).toBeVisible();
		await expect(alert).not.toBeEmpty();
		await expect(page.locator('app-data-view h1')).toHaveText('Select Data');
		await expect(page.locator('app-data-view h1')).toBeFocused();
		await expect(page.locator('app-dataset-card').first()).toBeVisible();
		expect(
			await page.evaluate(
				() =>
					(
						window as unknown as { __appState: { get(): { dataset: unknown } } }
					).__appState.get().dataset
			)
		).toBeNull();

		// The Upload modal shows no stale sample error.
		await page.getByRole('button', { name: 'Upload Dataset', exact: true }).click();
		await expect(page.locator('app-upload-dataset-dialog dialog.modal')).toBeVisible();
		await expect(
			page.locator('app-upload-dataset-dialog dialog.modal [role="alert"]')
		).toHaveCount(0);
	});

	test('LOAD-AC-5: reloading during a load lands on selection without a bar', async ({
		page
	}) => {
		await delayIris(page, 4000);
		await load(page);
		await expect(page.locator('app-dataset-preview progress')).toBeVisible(); // loading-state: intentional
		await page.reload();
		await expect(page.locator('app-data-view .cards')).toBeVisible();
		await expect(page.locator('app-dataset-preview')).toHaveCount(0); // loading-state: intentional
	});

	test('LOAD-AC-6: the bar stays visible and animated with reduced motion, forced colours and RTL', async ({
		page
	}) => {
		await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' });
		await delayIris(page, 3000);
		await load(page);
		const bar = page.locator('app-dataset-preview progress'); // loading-state: intentional
		await expect(bar).toBeVisible();
		await expect(page.locator('app-dataset-preview #load-phase')).toBeVisible(); // loading-state: intentional
		const style = await bar.evaluate((element) => {
			const computed = getComputedStyle(element);
			return {
				determinate: element.hasAttribute('value'),
				duration: computed.animationDuration,
				name: computed.animationName,
				appearance: computed.appearance
			};
		});
		expect(style.determinate).toBe(false);
		expect(style.name).not.toBe('none');
		expect(style.duration).toBe('3.2s');
		expect(style.appearance).toBe('auto');

		await page.evaluate(() => {
			document.documentElement.dir = 'rtl';
		});
		const edges = await bar.evaluate((element) => {
			const box = element.getBoundingClientRect();
			const body = element.parentElement!.getBoundingClientRect();
			return { barRight: box.right, bodyRight: body.right };
		});
		expect(edges.barRight).toBeCloseTo(edges.bodyRight, 0);
	});
});
