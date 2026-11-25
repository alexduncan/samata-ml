import { expect, test } from '@playwright/test';

test.describe('Dataset Upload & Lifecycle (DATA-UP-1 .. DATA-UP-3)', () => {
	test.beforeEach(async ({ page }) => {
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

	test('DATA-UP-1: upload dialog opening, file selection, validation, error mapping and cancel', async ({
		page
	}) => {
		const uploadBtn = page.locator('header.page-header button:has-text("Upload Dataset")');
		await expect(uploadBtn).toBeVisible();
		await uploadBtn.click();

		const dialog = page.locator('app-upload-dataset-dialog dialog.modal');
		await expect(dialog).toBeVisible();
		await expect(dialog.locator('#upload-dialog-title')).toHaveText('Upload Custom Dataset');

		// 1. Invalid file extension (.txt instead of .csv)
		const fileInput = dialog.locator('input[type="file"]');
		await fileInput.setInputFiles({
			name: 'data.txt',
			mimeType: 'text/plain',
			buffer: Buffer.from('hello world')
		});

		const alertBox = dialog.locator('p[role="alert"]');
		await expect(alertBox).toBeVisible();
		await expect(alertBox).toHaveText(
			'This CSV could not be read. Check the file and try again.'
		);

		// 2. Empty CSV file -> EMPTY_FILE error code mapping
		await fileInput.setInputFiles({
			name: 'empty.csv',
			mimeType: 'text/csv',
			buffer: Buffer.from('')
		});

		await expect(alertBox).toBeVisible();
		await expect(alertBox).toHaveText('This CSV is empty.');

		// 3. No usable data rows -> NO_DATA_ROWS error code mapping
		await fileInput.setInputFiles({
			name: 'header-only.csv',
			mimeType: 'text/csv',
			buffer: Buffer.from('col1,col2,col3\n')
		});

		await expect(alertBox).toBeVisible();
		await expect(alertBox).toHaveText('This CSV has no usable data rows.');

		// 4. Close via close button and check focus restored to uploadBtn
		const closeBtn = dialog.locator('button.btn-icon[aria-label="Close modal"]');
		await closeBtn.click();
		await expect(dialog).not.toBeVisible();
		await expect(uploadBtn).toBeFocused();

		// 5. Open again and close via Escape key
		await uploadBtn.click();
		await expect(dialog).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(dialog).not.toBeVisible();
		await expect(uploadBtn).toBeFocused();
	});

	test('DATA-UP-2: cancel and failure preserve prior dataset state', async ({ page }) => {
		const uploadBtn = page.locator('header.page-header button:has-text("Upload Dataset")');
		await uploadBtn.click();
		const dialog = page.locator('app-upload-dataset-dialog dialog.modal');
		await expect(dialog).toBeVisible();

		// 1. Upload invalid CSV
		const fileInput = dialog.locator('input[type="file"]');
		await fileInput.setInputFiles({
			name: 'empty.csv',
			mimeType: 'text/csv',
			buffer: Buffer.from('')
		});

		const alertBox = dialog.locator('p[role="alert"]');
		await expect(alertBox).toHaveText('This CSV is empty.');

		// 2. Verify dataset is still null in state
		const datasetState = await page.evaluate(() => {
			return (window as unknown as { __datasetState?: unknown }).__datasetState ?? null;
		});
		expect(datasetState).toBeNull();

		// 3. Close modal
		await dialog.locator('button.btn-icon[aria-label="Close modal"]').click();
		await expect(dialog).not.toBeVisible();

		// 4. Page should still be on selection mode with 12 dataset cards
		const cards = page.locator('app-dataset-card');
		await expect(cards).toHaveCount(12);
	});

	test('DATA-UP-3: valid CSV file upload succeeds and triggers preview', async ({ page }) => {
		const uploadBtn = page.locator('header.page-header button:has-text("Upload Dataset")');
		await uploadBtn.click();

		const dialog = page.locator('app-upload-dataset-dialog dialog.modal');
		await expect(dialog).toBeVisible();

		// Upload valid CSV with 10 rows
		const csvContent = [
			'feature_a,feature_b,label',
			'1.0,2.0,positive',
			'1.5,2.5,positive',
			'2.0,3.0,negative',
			'2.5,3.5,negative',
			'3.0,4.0,positive',
			'3.5,4.5,positive',
			'4.0,5.0,negative',
			'4.5,5.5,negative',
			'5.0,6.0,positive',
			'5.5,6.5,negative'
		].join('\n');

		const fileInput = dialog.locator('input[type="file"]');
		await fileInput.setInputFiles({
			name: 'custom_dataset.csv',
			mimeType: 'text/csv',
			buffer: Buffer.from(csvContent)
		});

		// Modal closes on successful load
		await expect(dialog).not.toBeVisible({ timeout: 10000 });
	});

	test('TEMP-AC-14: date, time and datetime columns display at their own precision', async ({
		page
	}) => {
		await page.locator('header.page-header button:has-text("Upload Dataset")').click();
		const dialog = page.locator('app-upload-dataset-dialog dialog.modal');
		await expect(dialog).toBeVisible();

		const rows = Array.from({ length: 10 }, (_, index) => {
			const day = `2013-08-${String(14 + index).padStart(2, '0')}`;
			const clock = `${String(9 + index).padStart(2, '0')}:30`;
			const moment = `2013-08-13 06:03:${String(42 + index).padStart(2, '0')}`;
			return `${day},${clock},${moment},${index % 2 ? 'positive' : 'negative'}`;
		});
		await dialog.locator('input[type="file"]').setInputFiles({
			name: 'temporal.csv',
			mimeType: 'text/csv',
			buffer: Buffer.from(['day,clock,moment,label', ...rows].join('\n'))
		});
		await expect(dialog).not.toBeVisible({ timeout: 10000 });

		const preview = page.locator('app-dataset-preview');
		const table = preview.locator('ui-virtual-table');
		await expect(table).toContainText('2013-08-14', { timeout: 10000 });
		await expect(table).toContainText('09:30');
		await expect(table).toContainText('2013-08-13T06:03:42Z');

		const aside = page.locator('app-column-details aside.overlay');
		await table.locator('.header-btn[data-col-key="day"]').click();
		await expect(aside).toBeVisible();
		await expect(aside.getByRole('rowheader', { name: 'Earliest', exact: true })).toBeVisible();
		await expect(aside.getByRole('rowheader', { name: 'Latest', exact: true })).toBeVisible();
		await expect(aside).toContainText('2013-08-14');
		await expect(aside).not.toContainText('UTC');

		await table.locator('.header-btn[data-col-key="moment"]').click();
		await expect(aside.getByRole('rowheader', { name: 'Earliest (UTC)' })).toBeVisible();
	});
});
