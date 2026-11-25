import { expect, test, type Page } from '@playwright/test';
import type { AppColumnDetails } from '../src/features/data/app-column-details';
import type { PersistedAppState } from '../src/types/state';
import { dismissWelcomeModal } from './journeys/helpers';

async function loadIrisPreview(page: Page): Promise<void> {
	await page.goto('/data');
	await dismissWelcomeModal(page);
	await page
		.locator('app-dataset-card[dataset-id="iris"]')
		.getByRole('button', { name: 'Load Dataset' })
		.click();
	await expect(page.locator('app-dataset-preview h1')).toContainText('Preview Dataset: Iris');
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
	await page.getByRole('button', { name: 'Train New Model' }).click();
	await expect(page).toHaveURL('/models/1');
	await page.goto('/data');
	await page.reload();
	const preview = page.locator('app-dataset-preview');
	await expect(preview.locator('h1')).toContainText('Preview Dataset: Iris');
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
	await expect(preview.locator('h1')).toContainText('Preview Dataset: Breast Cancer');
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
	const preview = page.locator('app-dataset-preview');
	await expect(preview).toBeVisible();
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

	test('DATA-PRE-1: bounded requests, cap and segment navigation, grouping decimals', async ({
		page
	}) => {
		const irisCard = page.locator('app-dataset-card[dataset-id="iris"]');
		await irisCard.waitFor({ state: 'visible', timeout: 5000 });
		await irisCard.locator('button.btn-primary').click();

		const preview = page.locator('app-dataset-preview');
		await expect(preview).toBeVisible({ timeout: 10000 });

		// Check header title and stats
		const h1 = preview.locator('.page-header h1');
		await expect(h1).toContainText('Preview Dataset: Iris');

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

		// Check segment controls and segment info
		const prevBtn = preview.locator('.segment-controls button:has-text("Previous segment")');
		await expect(prevBtn).toBeDisabled();

		const segmentInfo = preview.locator('.segment-info');
		await expect(segmentInfo).toContainText('Rows 1–150 of 150');

		// Check Go to row navigation
		const goToInput = preview.locator('input#row-number');
		await expect(goToInput).toBeVisible();
		await goToInput.fill('75');
		await preview.locator('.go-to-row button[type="submit"]').click();

		// Check cap notice is not visible for 150-row dataset
		const capNotice = preview.locator('.cap-notice');
		await expect(capNotice).toHaveCount(0);
	});

	test('DATA-PRE-2: column inspector stats, distributions, close button and persistence', async ({
		page
	}) => {
		const irisCard = page.locator('app-dataset-card[dataset-id="iris"]');
		await irisCard.waitFor({ state: 'visible', timeout: 5000 });
		await irisCard.locator('button.btn-primary').click();

		const preview = page.locator('app-dataset-preview');
		await expect(preview).toBeVisible({ timeout: 10000 });

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

		await page.reload();

		const reloadedAside = page.locator('app-column-details aside.overlay');
		await expect(reloadedAside).toBeVisible();
		await expect(reloadedAside.locator('.overlay-title h4')).toContainText('petal length');
	});
});
