import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import type { AppColumnDetails } from '../src/features/data/app-column-details';
import type { PersistedAppState } from '../src/types/state';
import { waitForPublishedPreview } from './helpers/dataset-ready';
import { waitForPersistedAppState } from './helpers/e2e-settlement';
import { dismissWelcomeModal } from './journeys/helpers';

async function loadIrisPreview(page: Page): Promise<void> {
	await page.goto('/data');
	await dismissWelcomeModal(page);
	await page
		.locator('app-dataset-card[dataset-id="iris"]')
		.getByRole('button', { name: 'Load Dataset' })
		.click();
	await waitForPublishedPreview(page);
	await expect(page.locator('app-dataset-preview h1')).toHaveText(/^Iris.* Preview$/);
}

test('BETA-DATA-1 / BETA-DATA-2: change dataset after preview reload fetches the catalogue and Cancel preserves the project', async ({
	page
}) => {
	await loadIrisPreview(page);
	await page.goto('/target');
	await page.locator('app-target-view tbody tr:has(th:has-text("class")) button').click();
	await expect(
		page.locator('app-target-view tbody tr:has(th:has-text("class")) button')
	).toHaveText('Current Target');
	await page.goto('/models');
	await page.locator('app-models-view').getByRole('link', { name: 'Train New Model' }).click();
	await expect(page).toHaveURL('/models/new');
	await expect(page.locator('app-model-builder-view h1')).toHaveText('Model 1');
	await page.goto('/data');
	await page.reload();
	const preview = page.locator('app-dataset-preview');
	await expect(preview.locator('h1')).toHaveText(/^Iris.* Preview$/);
	const change = preview.getByRole('button', { name: 'Change Dataset', exact: true });
	const dialog = page.getByRole('dialog', { name: 'Change Dataset' });
	const project = () =>
		page.evaluate(() => {
			const state = JSON.parse(localStorage.getItem('samata-ml:state')!) as PersistedAppState;
			return [state.dataset?.id, state.target, state.models.map(({ num }) => num)];
		});
	const before = await project();
	expect(before[1]).toBe('class');
	expect(before[2]).toEqual([1]);
	await change.click();
	await page.mouse.click(2, 2);
	await expect(dialog).toBeVisible();
	await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
	await expect(dialog).toBeHidden();
	await expect(preview).toBeVisible();
	expect(await project()).toEqual(before);

	await change.focus();
	await change.press('Enter');
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(change).toBeFocused();
	expect(await project()).toEqual(before);

	await change.click();
	await dialog.getByRole('button', { name: 'Change Dataset', exact: true }).click();
	await expect(page).toHaveURL('/data');
	await expect(page.locator('app-data-view .cards')).toBeVisible();
	await page
		.locator('app-dataset-card[dataset-id="breast-cancer-wisconsin"]')
		.getByRole('button', { name: 'Load Dataset' })
		.click();
	await expect(preview.locator('h1')).toHaveText(/^Breast Cancer.* Preview$/);
});

test('BETA-DATA-3: a failed replacement catalogue request shows an alert and Retry reloads it', async ({
	page
}) => {
	await page.goto('/data');
	await dismissWelcomeModal(page);
	await page.getByRole('button', { name: 'Upload Dataset', exact: true }).click();
	await page.locator('app-upload-dataset-dialog input[type=file]').setInputFiles({
		name: 'catalogue-retry.csv',
		mimeType: 'text/csv',
		buffer: Buffer.from('Length,Class\n1,Plant\n2,Animal\n3,Plant\n4,Animal\n')
	});
	await waitForPublishedPreview(page);
	const preview = page.locator('app-dataset-preview');
	// Uploaded data has no sample descriptor to prime the catalogue before selection.
	await page.reload();
	await expect(preview).toBeVisible();
	let requests = 0;
	await page.route(
		(url) => url.pathname === '/datasets/index.json',
		(route) => (++requests === 1 ? route.fulfill({ status: 503 }) : route.continue())
	);
	await preview.getByRole('button', { name: 'Change Dataset', exact: true }).click();
	await page
		.getByRole('dialog', { name: 'Change Dataset' })
		.getByRole('button', { name: 'Change Dataset', exact: true })
		.click();
	const status = page
		.getByRole('alert')
		.filter({ hasText: 'Could not load sample dataset catalogue.' });
	await expect(status).toBeVisible();
	await status.getByRole('button', { name: 'Retry', exact: true }).click();
	await expect(page.locator('app-data-view .cards')).toBeVisible();
	await expect(status).toBeHidden();
	expect(requests).toBe(2);
});

test('TERM-AC-2: the categorical frequency header expands only abbreviated labels', async ({
	page
}) => {
	await page.goto('/data');
	await page.locator('app-welcome-modal button.btn-primary').click();
	await page.evaluate(() => {
		const inspector = document.createElement('app-column-details');
		inspector.rowCount = 3;
		inspector.column = {
			name: 'Species',
			type: 'categorical',
			missingCount: 0,
			missingTokens: {},
			invalidCount: 0,
			invalidExamples: [],
			distinctCount: 2,
			categoryCounts: { '<b>Literal value</b>': 2, Other: 1 }
		};
		document.body.append(inspector);
	});

	const inspector = page.locator('body > app-column-details');
	const header = inspector.getByRole('columnheader', { name: 'Frequency', exact: true });
	await expect(header).toHaveAttribute('scope', 'col');
	await expect(header.locator('abbr')).toHaveText('Freq.');
	await expect(header.locator('abbr')).toHaveAttribute('title', 'Frequency');
	await expect(inspector.getByRole('cell', { name: '<b>Literal value</b>' })).toBeVisible();
	await expect(inspector.locator('td b')).toHaveCount(0);

	await inspector.evaluate((node) => {
		const element = node as AppColumnDetails;
		element.labels = { ...element.labels, frequency: 'Anzahl' };
	});
	await expect(inspector.getByRole('columnheader', { name: 'Anzahl' })).toHaveText('Anzahl');
	await expect(inspector.locator('abbr')).toHaveCount(0);

	await inspector.evaluate((node) => {
		const element = node as AppColumnDetails;
		element.labels = {
			...element.labels,
			frequency: 'Häuf.',
			frequencyExpansion: 'Häufigkeit'
		};
	});
	const localised = inspector.getByRole('columnheader', { name: 'Häufigkeit' });
	await expect(localised).toHaveText('Häuf.');
	await expect(localised.locator('abbr')).toHaveAttribute('title', 'Häufigkeit');

	await inspector.evaluate((node) => {
		const element = node as AppColumnDetails;
		element.labels = { ...element.labels, frequency: '' };
	});
	await expect(header.locator('abbr')).toHaveAttribute('title', 'Frequency');

	await inspector.evaluate((node) => {
		const element = node as AppColumnDetails;
		element.column = {
			name: 'Accepted',
			type: 'boolean',
			missingCount: 0,
			missingTokens: {},
			invalidCount: 0,
			invalidExamples: [],
			trueCount: 2,
			falseCount: 1,
			lexicon: ['true', 'false']
		};
	});
	await expect(inspector.getByRole('columnheader', { name: 'Count' })).toHaveText('Count');
	await expect(inspector.getByRole('columnheader', { name: '%' })).toHaveText('%');
	await expect(inspector.locator('abbr')).toHaveCount(0);
});

test.describe('Dataset Preview & Column Inspector (DATA-PRE-1 .. DATA-PRE-3)', () => {
	test.describe.configure({ mode: 'serial' });

	test.beforeEach(async ({ page }) => {
		await page.goto('/data');
		await dismissWelcomeModal(page);
	});

	test('DATA-PRE-1: bounded requests, no segment controls or Go to row, grouping decimals', async ({
		page
	}) => {
		const irisCard = page.locator('app-dataset-card[dataset-id="iris"]');
		await irisCard.waitFor({ state: 'visible', timeout: 5000 });
		await irisCard.locator('button.btn-primary').click();

		await waitForPublishedPreview(page);
		const preview = page.locator('app-dataset-preview');

		// Check header title and stats
		const h1 = preview.locator('.page-header h1');
		await expect(h1).toHaveText(/^Iris.* Preview$/);

		const headerP = preview.locator('.page-header p');
		await expect(headerP).toContainText('150 rows');
		await expect(headerP).toContainText('5 columns');

		// Check virtual table
		const table = preview.locator('ui-virtual-table');
		await expect(table).toBeVisible();

		// Check column headers
		const headers = table.locator('.table-header-cell');
		await expect(headers).toHaveCount(5);
		await expect(headers.first()).toContainText('sepal length');
		await expect(headers.nth(4)).toContainText('class');

		// Verify table rows rendered with formatted values
		const rows = table.locator('.table-row');
		await expect(rows.first()).toBeVisible();
		const firstRowCells = rows.first().locator('.table-cell');
		await expect(firstRowCells.first()).toContainText('5.1');
		await expect(firstRowCells.nth(4)).toContainText('Iris-setosa');

		// The document scrolls the whole table: no segment controls, Go to row or status box
		await expect(preview.locator('.controls-bar')).toHaveCount(0);
		await expect(preview.locator('.segment-controls')).toHaveCount(0);
		await expect(preview.locator('input#row-number')).toHaveCount(0);
		await expect(preview.locator('.status-box')).toHaveCount(0);

		// No row-limit notice for a 150-row dataset
		await expect(preview.locator('.page-body')).toHaveCount(0);
	});

	test('DATA-PRE-2: column inspector stats, distributions, close button and persistence', async ({
		page
	}) => {
		const irisCard = page.locator('app-dataset-card[dataset-id="iris"]');
		await irisCard.waitFor({ state: 'visible', timeout: 5000 });
		await irisCard.locator('button.btn-primary').click();

		await waitForPublishedPreview(page);
		const preview = page.locator('app-dataset-preview');

		const table = preview.locator('ui-virtual-table');
		await expect(table).toBeVisible();

		// 1. Select numeric column "sepal length"
		const sepalLengthBtn = table.locator('.header-btn[data-col-key="sepal length"]');
		await sepalLengthBtn.click();

		const aside = page.locator('app-column-details aside.overlay');
		await expect(aside).toBeVisible();
		await expect(aside.locator('.overlay-title h4')).toContainText('sepal length');
		await expect(aside.locator('code.type-tag')).toContainText('numeric');

		// Check numeric stats: Min, Max, Mean, Median
		const summaryTable = aside.locator('table.table').first();
		await expect(summaryTable).toContainText('Min');
		await expect(summaryTable).toContainText('4.3');
		await expect(summaryTable).toContainText('Max');
		await expect(summaryTable).toContainText('7.9');

		// Check histogram table
		const histogramTable = aside.locator('table.table:has(th:has-text("Range"))');
		await expect(histogramTable).toBeVisible();
		await expect(histogramTable.locator('th:has-text("Count")')).toBeVisible();

		// 2. Test close button and invoker focus restoration
		const closeBtn = aside.locator('.btn-icon[aria-label="Close"]');
		await closeBtn.click();

		await expect(aside).not.toBeVisible();
		await expect(sepalLengthBtn).toBeFocused();

		// 3. Select categorical column "class"
		const speciesBtn = table.locator('.header-btn[data-col-key="class"]');
		await speciesBtn.click();

		await expect(aside).toBeVisible();
		await expect(aside.locator('.overlay-title h4')).toContainText('class');
		await expect(aside.locator('code.type-tag')).toContainText('categorical');

		// Check categorical distribution table
		const catTable = aside.locator('table.table:has(th:has-text("Category"))');
		await expect(catTable).toBeVisible();
		await expect(catTable.getByRole('columnheader', { name: 'Frequency' })).toHaveText('Freq.');
		await expect(catTable.locator('tbody tr')).toHaveCount(3);
		await expect(catTable).toContainText('Iris-setosa');
		await expect(catTable).toContainText('50');

		// Close panel
		await aside.locator('.btn-icon[aria-label="Close"]').click();
		await expect(aside).not.toBeVisible();

		// 4. Persistence across reload: select "petal length", reload, verify panel reopens
		const petalLengthBtn = table.locator('.header-btn[data-col-key="petal length"]');
		await petalLengthBtn.click();
		await expect(aside).toBeVisible();
		await expect(aside.locator('.overlay-title h4')).toContainText('petal length');
		// The selection is persisted through the guarded (asynchronous) state write, so wait for it
		// to reach storage before reloading.
		const datasetId = await page.evaluate(() => window.__appState!.get().dataset?.id);
		expect(datasetId).toBeTruthy();
		await waitForPersistedAppState(page, (state) => {
			const { data, dataset, onboarding } = state as Partial<PersistedAppState>;
			return (
				onboarding?.welcomeDismissed === true &&
				dataset?.sampleId === 'iris' &&
				dataset.id === datasetId &&
				data?.mode === 'preview' &&
				data.selectedColumn === 'petal length'
			);
		});

		await page.reload();

		const reloadedAside = page.locator('app-column-details aside.overlay');
		await expect(reloadedAside).toBeVisible();
		await expect(reloadedAside.locator('.overlay-title h4')).toContainText('petal length');
	});
});

/** Uploads a generated CSV through the Upload dialog and waits for the table. */
async function uploadCsv(page: Page, name: string, rows: number, columns: number): Promise<void> {
	const header = Array.from({ length: columns }, (_, index) => `col_${index}`).join(',');
	const lines = [header];
	for (let row = 0; row < rows; row++) {
		lines.push(
			Array.from({ length: columns }, (_, index) =>
				index === 0 ? row : (row + index) % 97
			).join(',')
		);
	}
	await page.getByRole('button', { name: 'Upload Dataset', exact: true }).click();
	await page.locator('app-upload-dataset-dialog input[type=file]').setInputFiles({
		name,
		mimeType: 'text/csv',
		buffer: Buffer.from(`${lines.join('\n')}\n`)
	});
	await waitForPublishedPreview(page);
}

async function loadIris(page: Page): Promise<void> {
	await page
		.locator('app-dataset-card[dataset-id="iris"]')
		.getByRole('button', { name: 'Load Dataset' })
		.click();
	await waitForPublishedPreview(page);
}

/** Document-level geometry of the preview, `main` and the sticky headers. */
function previewGeometry(page: Page) {
	return page.evaluate(() => {
		const preview = document
			.querySelector('app-data-view')!
			.shadowRoot!.querySelector('app-dataset-preview')!;
		const header = preview.shadowRoot!.querySelector('.page-header')!;
		const table = preview.shadowRoot!.querySelector('ui-virtual-table')!;
		const tableHeader = table.shadowRoot!.querySelector('.table-header')!;
		const main = document.querySelector('main')!;
		const sidebarWidth = parseFloat(
			getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width')
		);
		return {
			scrollX: window.scrollX,
			scrollY: window.scrollY,
			scrollWidth: document.scrollingElement!.scrollWidth,
			clientWidth: document.scrollingElement!.clientWidth,
			mainOverflowY: getComputedStyle(main).overflowY,
			mainOverflowX: getComputedStyle(main).overflowX,
			headerLeft: header.getBoundingClientRect().left,
			headerTop: header.getBoundingClientRect().top,
			headerBottom: header.getBoundingClientRect().bottom,
			headerPosition: getComputedStyle(header).position,
			tableHeaderTop: tableHeader.getBoundingClientRect().top,
			sidebarPx:
				sidebarWidth * parseFloat(getComputedStyle(document.documentElement).fontSize)
		};
	});
}

test.describe('Preview layout (PREV-AC-1 .. PREV-AC-8)', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/data');
		const getStarted = page.locator('app-welcome-modal button.btn-primary');
		try {
			await getStarted.waitFor({ state: 'visible', timeout: 3000 });
			await getStarted.click();
			await page
				.locator('app-welcome-modal dialog')
				.waitFor({ state: 'hidden', timeout: 3000 });
		} catch {
			// Already dismissed
		}
	});

	test('PREV-AC-1: the header names the dataset and offers Datasheet only for samples', async ({
		page
	}) => {
		await loadIris(page);
		const preview = page.locator('app-dataset-preview');
		await expect(preview.locator('h1')).toHaveText('Iris Flower Species Preview');
		const actions = preview.locator('.page-actions button');
		await expect(actions).toHaveText(['Datasheet', 'Change Dataset']);
		await expect(actions.nth(1)).toHaveClass(/btn-red/);
		await actions.first().click();
		const dialog = page.locator('app-datasheet-dialog dialog');
		await expect(dialog).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();
		await expect(actions.first()).toBeFocused();

		await actions.nth(1).click();
		await page
			.getByRole('dialog', { name: 'Change Dataset' })
			.getByRole('button', { name: 'Change Dataset', exact: true })
			.click();
		await expect(page.locator('app-data-view .cards')).toBeVisible();
		await uploadCsv(page, 'prev-ac-1.csv', 20, 4);
		await expect(preview.locator('h1')).toHaveText('prev-ac-1 Preview');
		await expect(preview.locator('.page-actions button')).toHaveText(['Change Dataset']);
	});

	test('PREV-AC-2: the document scrolls both ways and both headers stick', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await uploadCsv(page, 'prev-ac-2.csv', 300, 53);
		const origin = await previewGeometry(page);
		expect(origin.scrollWidth).toBeGreaterThan(origin.clientWidth);
		expect(origin.mainOverflowX).toBe('visible');
		expect(origin.mainOverflowY).toBe('visible');
		await page.evaluate(() => window.scrollTo(400, 500));
		await expect.poll(() => page.evaluate(() => [scrollX, scrollY])).toEqual([400, 500]);
		const scrolled = await previewGeometry(page);
		expect(scrolled.headerLeft).toBeCloseTo(scrolled.sidebarPx, 0);
		expect(scrolled.headerTop).toBe(0);
		expect(scrolled.tableHeaderTop).toBeCloseTo(scrolled.headerBottom, 0);

		await page.setViewportSize({ width: 1280, height: 400 });
		await page.evaluate(() => window.scrollTo(400, 500));
		await expect
			.poll(async () => {
				const short = await previewGeometry(page);
				return [short.headerPosition, short.headerBottom < 0, short.tableHeaderTop];
			})
			.toEqual(['static', true, 0]);

		await page.setViewportSize({ width: 640, height: 800 });
		await page.evaluate(() => window.scrollTo(300, 900));
		await expect.poll(() => page.evaluate(() => scrollX)).toBe(300);
		const narrow = await previewGeometry(page);
		expect(narrow.headerLeft).toBeCloseTo(0, 0);
	});

	test('PREV-AC-3: reload prepares without an empty flash, and failures offer Retry', async ({
		page
	}) => {
		await loadIris(page);
		await page.addInitScript(() => {
			(window as unknown as { __emptySeen: boolean }).__emptySeen = false;
			const scan = (root: ParentNode): boolean => {
				for (const element of root.querySelectorAll('*')) {
					if (element.shadowRoot && scan(element.shadowRoot)) return true;
					if (
						element.children.length === 0 &&
						element.textContent?.includes('No rows to preview.')
					) {
						return true;
					}
				}
				return false;
			};
			setInterval(() => {
				if (scan(document))
					(window as unknown as { __emptySeen: boolean }).__emptySeen = true;
			}, 5);
		});
		await page.reload();
		const preview = page.locator('app-dataset-preview');
		await expect(preview.locator('ui-virtual-table .table-row').first()).toBeAttached();
		expect(
			await page.evaluate(() => (window as unknown as { __emptySeen: boolean }).__emptySeen)
		).toBe(false);
		await expect(preview.locator('.status-box, .controls-bar')).toHaveCount(0);

		// Metadata failure shows an alert with Retry that reloads and recovers.
		await page.evaluate(() => {
			const store = (
				window as never as { __datasetResources: { get(): object; set(v: object): void } }
			).__datasetResources;
			store.set({
				...store.get(),
				status: 'error',
				metadata: null,
				error: 'Controlled failure'
			});
		});
		const alert = preview.locator('.notification-alert[role="alert"]');
		await expect(alert).toContainText('The preview could not be loaded.');
		await expect(preview.locator('ui-virtual-table')).toHaveCount(0);
		await alert.getByRole('button', { name: 'Retry' }).click();
		await expect(alert).toHaveCount(0);
		await expect(preview.locator('ui-virtual-table .table-row').first()).toBeAttached();

		// An empty dataset shows the empty message and no table.
		await page.evaluate(() => {
			const store = (
				window as never as {
					__datasetResources: { get(): { metadata: object }; set(v: object): void };
				}
			).__datasetResources;
			const current = store.get();
			store.set({ ...current, metadata: { ...current.metadata, rowCount: 0 } });
		});
		await expect(preview.getByText('No rows to preview.')).toBeVisible();
		await expect(preview.locator('ui-virtual-table')).toHaveCount(0);
	});

	test('PREV-AC-4: a 20,000-row preview restores its document offset', async ({ page }) => {
		test.setTimeout(120_000);
		await page.setViewportSize({ width: 1280, height: 800 });
		await uploadCsv(page, 'prev-ac-4.csv', 20_000, 30);
		const rowHeight = await page
			.locator('ui-virtual-table')
			.evaluate(
				(table) =>
					table.shadowRoot!.querySelector('.table-row')!.getBoundingClientRect().height
			);
		await page.locator('ui-virtual-table').evaluate((table, height) => {
			const body = table.shadowRoot!.querySelector('.table-body')!;
			window.scrollTo(
				25,
				body.getBoundingClientRect().top + window.scrollY + 15_000 * height
			);
		}, rowHeight);
		await expect.poll(() => page.evaluate(() => scrollX)).toBe(25);
		const saved = await page.evaluate(() => scrollY);
		await expect
			.poll(() =>
				page.evaluate(
					() =>
						JSON.parse(localStorage.getItem('samata-ml:scroll') ?? '{}').snapshots?.[
							'data:preview'
						]?.top
				)
			)
			.toBeGreaterThan(0);
		const restored = async () => {
			await expect
				.poll(() => page.evaluate((y) => Math.abs(scrollY - y), saved))
				.toBeLessThanOrEqual(rowHeight);
			expect(await page.evaluate(() => scrollX)).toBe(25);
			const row = page.locator('ui-virtual-table [aria-rowindex="15002"]');
			await expect(row).toBeInViewport();
		};
		await page.reload();
		await restored();

		await page.locator('app-sidebar a[href="/target"]').click();
		await expect(page.locator('#content h1')).toHaveText('Set Target');
		await page.goBack();
		await restored();

		await page.setViewportSize({ width: 1100, height: 800 });
		await page.reload();
		await expect(page.locator('ui-virtual-table .table-row').first()).toBeAttached();
		await expect.poll(() => page.evaluate(() => [scrollX, scrollY])).toEqual([0, 0]);

		await page
			.locator('app-dataset-preview')
			.getByRole('button', { name: 'Change Dataset', exact: true })
			.click();
		await page
			.getByRole('dialog', { name: 'Change Dataset' })
			.getByRole('button', { name: 'Change Dataset', exact: true })
			.click();
		await expect(page.locator('app-data-view .cards')).toBeVisible();
		await expect
			.poll(() =>
				page.evaluate(
					() =>
						'data:preview' in
						(JSON.parse(localStorage.getItem('samata-ml:scroll') ?? '{}').snapshots ??
							{})
				)
			)
			.toBe(false);
	});

	test('PREV-AC-5: the column panel shows display and column names for samples only', async ({
		page
	}) => {
		await loadIris(page);
		const preview = page.locator('app-dataset-preview');
		const button = preview.locator('.header-btn[data-col-key="sepal length"]');
		await button.click();
		const title = page.locator('app-column-details .overlay-title h4');
		await expect(title).toContainText('Sepal Length');
		await expect(title.locator('.col-name')).toHaveText('sepal length');
		await page.locator('app-column-details .btn-icon[aria-label="Close"]').click();
		await expect(button).toBeFocused();

		await preview.getByRole('button', { name: 'Change Dataset', exact: true }).click();
		await page
			.getByRole('dialog', { name: 'Change Dataset' })
			.getByRole('button', { name: 'Change Dataset', exact: true })
			.click();
		await expect(page.locator('app-data-view .cards')).toBeVisible();
		await uploadCsv(page, 'prev-ac-5.csv', 10, 3);
		await preview.locator('.header-btn[data-col-key="col_1"]').click();
		await expect(title).toHaveText('col_1');
		await expect(title.locator('.col-name')).toHaveCount(0);
	});

	test('PREV-AC-6: header actions stay operable at 320px and 400% text, and axe passes', async ({
		page
	}) => {
		await page.setViewportSize({ width: 320, height: 640 });
		await loadIris(page);
		await page.addStyleTag({ content: 'html { font-size: 400%; }' });
		const preview = page.locator('app-dataset-preview');
		for (const name of ['Datasheet', 'Change Dataset']) {
			const control = preview.getByRole('button', { name, exact: true });
			await control.scrollIntoViewIfNeeded();
			await expect(control).toBeVisible();
			const box = (await control.boundingBox())!;
			expect(box.width).toBeGreaterThan(0);
			expect(box.x + box.width).toBeLessThanOrEqual(640 + 1);
		}
		await page.addStyleTag({ content: 'html { font-size: 100%; }' });
		const results = await new AxeBuilder({ page })
			.include('app-data-view')
			.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
			.analyze();
		expect(results.violations).toEqual([]);
	});

	test('PREV-AC-7: whenSettled waits for the dataset resources and the table geometry', async ({
		page
	}) => {
		await loadIris(page);
		const result = await page.locator('app-data-view').evaluate(async (view) => {
			const store = (
				window as never as {
					__datasetResources: { get(): object; set(v: object): void };
				}
			).__datasetResources;
			const ready = store.get();
			store.set({ ...ready, status: 'loading', metadata: null });
			let resolved = false;
			const settled = (view as HTMLElementTagNameMap['app-data-view'])
				.whenSettled()
				.then(() => (resolved = true));
			await new Promise((done) => setTimeout(done, 300));
			const early = resolved;
			store.set(ready);
			await settled;
			const preview = view.shadowRoot!.querySelector('app-dataset-preview')!;
			const body = preview
				.shadowRoot!.querySelector('ui-virtual-table')!
				.shadowRoot!.querySelector('.table-body')!;
			return {
				early,
				scrollHeight: document.scrollingElement!.scrollHeight,
				bodyBottom: body.getBoundingClientRect().bottom + window.scrollY
			};
		});
		expect(result.early).toBe(false);
		expect(result.scrollHeight).toBeGreaterThanOrEqual(Math.floor(result.bodyBottom));
	});

	test('PREV-AC-8: the table is full bleed while notices keep the 32px page inset', async ({
		page
	}) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await loadIris(page);
		await page.evaluate(() => {
			const store = (
				window as never as { __datasetResources: { get(): object; set(v: object): void } }
			).__datasetResources;
			store.set({ ...store.get(), error: 'Controlled failure' });
		});
		const preview = page.locator('app-dataset-preview');
		await expect(preview.locator('.notification-alert')).toBeVisible();
		const geometry = await preview.evaluate((element) => ({
			main: document.querySelector('main')!.getBoundingClientRect().left,
			alert: element.shadowRoot!.querySelector('.notification-alert')!.getBoundingClientRect()
				.left,
			table: element.shadowRoot!.querySelector('ui-virtual-table')!.getBoundingClientRect()
				.left
		}));
		expect(geometry.table).toBeCloseTo(geometry.main, 1);
		expect(geometry.alert - geometry.main).toBeCloseTo(32, 1);
	});
});
