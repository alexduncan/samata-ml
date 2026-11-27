import { expect, test } from '@playwright/test';
import type { StorageRequest, StorageResponse } from '../src/features/data/ingestion/protocol';
import { INGESTION_ERROR_MESSAGES } from '../src/features/data/ingestion/errors';
import { PARSE_CHUNK_BYTES } from '../src/features/data/ingestion/limits';
import { waitForPublishedPreview } from './helpers/dataset-ready';
import { fetchSampleDatasetCount } from './helpers/e2e-settlement';
import { dismissWelcomeModal } from './journeys/helpers';

interface UploadTestWindow extends Window {
	uploadCloseProbe: { closes: number; progressCancels: number; aborts: number; ingests: number };
}

test.describe('Dataset Upload & Lifecycle (DATA-UP-1 .. DATA-UP-3)', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/data');
		await dismissWelcomeModal(page);
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

	test('DLG-BACKDROP-1: upload user close aborts the owned operation once and progress Cancel leaves it open', async ({
		page
	}) => {
		const component = page.locator('app-upload-dataset-dialog');
		await component.waitFor({ state: 'attached' });
		await component.evaluate((element) => {
			const probe = { closes: 0, progressCancels: 0, aborts: 0, ingests: 0 };
			(window as unknown as UploadTestWindow).uploadCloseProbe = probe;
			let heldRequest: number | undefined;
			const abort = AbortController.prototype.abort;
			const send = Worker.prototype.postMessage;
			AbortController.prototype.abort = function (reason?: unknown) {
				if (heldRequest !== undefined) probe.aborts++;
				return abort.call(this, reason);
			};
			Worker.prototype.postMessage = function (
				request: StorageRequest,
				transfer?: Transferable[] | StructuredSerializeOptions
			) {
				// Pass 1 of an upload is the `validate` request; it is held so the dialog stays busy.
				if (request.type === 'validate' && request.source.kind === 'file') {
					heldRequest = request.requestId;
					return;
				}
				if (request.type === 'ingest') probe.ingests++;
				if (
					heldRequest !== undefined &&
					request.type === 'cancel' &&
					request.targetRequestId === heldRequest
				) {
					queueMicrotask(() => {
						heldRequest = undefined;
						this.dispatchEvent(
							new MessageEvent('message', {
								data: {
									requestId: request.targetRequestId,
									type: 'error',
									error: {
										code: 'CANCELLED',
										message: 'Fixture acknowledges cancellation'
									}
								} satisfies StorageResponse
							})
						);
					});
					return;
				}
				Reflect.apply(send, this, transfer === undefined ? [request] : [request, transfer]);
			};
			element.addEventListener('app-upload-close', () => probe.closes++);
			element.addEventListener('app-upload-cancel', () => probe.progressCancels++);
		});

		const invoker = page.getByRole('button', { name: 'Upload Dataset', exact: true });
		const dialog = component.locator('dialog.modal');
		const cancel = dialog.getByRole('button', { name: 'Cancel', exact: true });
		const probe = () =>
			page.evaluate(() => (window as unknown as UploadTestWindow).uploadCloseProbe);
		const open = async () => {
			await invoker.focus();
			await invoker.press('Enter');
			await expect(dialog).toBeVisible();
		};
		const holdUpload = async () => {
			await dialog.locator('input[type=file]').setInputFiles({
				name: 'held.csv',
				mimeType: 'text/csv',
				buffer: Buffer.from('Length,Class\n1,Plant\n2,Animal\n')
			});
			await expect(cancel).toBeVisible();
		};
		await open();
		await page.mouse.click(2, 2);
		await expect(dialog).toBeHidden();
		await expect(invoker).toBeFocused();
		await expect.poll(probe).toEqual({ closes: 1, progressCancels: 0, aborts: 0, ingests: 0 });

		await open();
		await holdUpload();
		await cancel.click();
		await expect(cancel).toBeHidden();
		await expect(dialog).toBeVisible();
		expect(await probe()).toEqual({ closes: 1, progressCancels: 1, aborts: 1, ingests: 0 });

		const userCloses = [
			() => dialog.getByRole('button', { name: 'Close modal' }).click(),
			() => page.keyboard.press('Escape'),
			() => page.mouse.click(2, 2)
		];
		for (const [index, close] of userCloses.entries()) {
			if (index > 0) await open();
			await holdUpload();
			await close();
			await expect(dialog).toBeHidden();
			await expect(invoker).toBeFocused();
			await expect
				.poll(probe)
				.toEqual({ closes: index + 2, progressCancels: 1, aborts: index + 2, ingests: 0 });
		}

		await open();
		await holdUpload();
		await component.evaluate(async (node) => {
			const element = node as HTMLElementTagNameMap['app-upload-dataset-dialog'];
			element.open = false;
			await element.updateComplete;
		});
		await expect(dialog).toBeHidden();
		await component.evaluate(async (node) => {
			const element = node as HTMLElementTagNameMap['app-upload-dataset-dialog'];
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
			element.open = true;
			await element.updateComplete;
			element.remove();
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
		});
		expect(await probe()).toEqual({ closes: 4, progressCancels: 1, aborts: 4, ingests: 0 });
		// Closing, backdrop dismissal and Cancel all leave the prior (empty) project untouched.
		expect(
			await page.evaluate(() => {
				const state = (
					window as unknown as {
						__appState: {
							get(): { dataset: unknown; target: unknown; models: unknown[] };
						};
					}
				).__appState.get();
				return [state.dataset, state.target, state.models.length];
			})
		).toEqual([null, null, 0]);
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

		// 4. Selection mode still shows the full sample catalogue.
		const cards = page.locator('app-dataset-card');
		const expectedCount = await fetchSampleDatasetCount(page);
		expect(expectedCount).toBeGreaterThan(0);
		await expect(cards).toHaveCount(expectedCount);
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

		await waitForPublishedPreview(page);
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

	test.describe('Two-pass upload (LOAD-AC-2, 3, 7)', () => {
		test('LOAD-AC-2 / LOAD-AC-7: the modal checks the file, then the page shows the load', async ({
			page
		}) => {
			// Hold each pass so the intermediate states can be observed.
			await page.addInitScript(() => {
				const send = Worker.prototype.postMessage;
				Worker.prototype.postMessage = function (
					request: { type?: string },
					transfer?: Transferable[] | StructuredSerializeOptions
				) {
					const delay =
						request?.type === 'validate' ? 800 : request?.type === 'ingest' ? 1800 : 0;
					const forward = () =>
						Reflect.apply(
							send,
							this,
							transfer === undefined ? [request] : [request, transfer]
						);
					if (delay) setTimeout(forward, delay);
					else forward();
				};
			});
			await page.reload();
			await dismissWelcomeModal(page);
			await page.getByRole('button', { name: 'Upload Dataset', exact: true }).click();
			const dialog = page.locator('app-upload-dataset-dialog dialog.modal');
			await expect(dialog).toBeVisible();
			await dialog.locator('input[type=file]').setInputFiles({
				name: 'two-pass.csv',
				mimeType: 'text/csv',
				buffer: Buffer.from('Length,Class\n1,Plant\n2,Animal\n3,Plant\n')
			});
			await expect(dialog.getByText('Checking file')).toBeVisible();

			// Pass 1 done: the dialog is gone and the page shows the in-page load.
			const preview = page.locator('app-dataset-preview'); // loading-state: intentional
			const heading = preview.locator('h1');
			await expect(heading).toHaveText('two-pass Preview');
			await expect(heading).toBeFocused();
			await expect(preview.locator('#load-phase')).toHaveText('Reading CSV');
			await expect(preview.locator('.load-step')).toHaveText('Step 1 of 3');
			await expect(page.locator('app-upload-dataset-dialog')).toHaveCount(0);
			expect(await page.evaluate(() => document.querySelector(':modal'))).toBeNull();
			await expect(page.locator('html')).toHaveCSS('overflow-y', 'scroll');

			// The ingest is not aborted: it completes into the preview.
			await waitForPublishedPreview(page);
			await expect(heading).toBeFocused();
			await expect(preview.locator('ui-virtual-table')).toContainText('Plant');
		});

		test('LOAD-AC-3: a failure raised after the last chunk stays in the modal and writes nothing', async ({
			page
		}) => {
			// Lines of only delimiters yield no data rows, so NO_DATA_ROWS is raised at the end.
			const blank = ',\n'.repeat(Math.ceil((2.5 * PARSE_CHUNK_BYTES) / 2));
			await page.getByRole('button', { name: 'Upload Dataset', exact: true }).click();
			const dialog = page.locator('app-upload-dataset-dialog dialog.modal');
			await dialog.locator('input[type=file]').setInputFiles({
				name: 'late-failure.csv',
				mimeType: 'text/csv',
				buffer: Buffer.from(`a,b\n${blank}`)
			});
			await expect(dialog.getByRole('alert')).toHaveText(
				INGESTION_ERROR_MESSAGES.NO_DATA_ROWS,
				{
					timeout: 30_000
				}
			);
			await expect(dialog).toBeVisible();
			await expect(page.locator('app-dataset-preview')).toHaveCount(0); // loading-state: intentional
			const written = await page.evaluate(async () => {
				const state = (
					window as unknown as { __appState: { get(): { dataset: unknown } } }
				).__appState.get();
				const db = await new Promise<IDBDatabase>((resolve, reject) => {
					const request = indexedDB.open('samata-db');
					request.onsuccess = () => resolve(request.result);
					request.onerror = () => reject(request.error);
				});
				try {
					const count = await new Promise<number>((resolve, reject) => {
						const request = db
							.transaction('raw_records')
							.objectStore('raw_records')
							.count();
						request.onsuccess = () => resolve(request.result);
						request.onerror = () => reject(request.error);
					});
					return { dataset: state.dataset, count };
				} finally {
					db.close();
				}
			});
			expect(written).toEqual({ dataset: null, count: 0 });
		});
	});
});
