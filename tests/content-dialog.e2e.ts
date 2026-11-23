import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
	AppContentDialog,
	ContentDialogCloseDetail
} from '../src/features/shell/app-content-dialog';
import { MOCKUPS_URL } from '../scripts/ports';

interface ContentTestWindow extends Window {
	__contentSource: DocumentFragment;
	__contentEvents: { detail: ContentDialogCloseDetail; bubbles: boolean; composed: boolean }[];
}

test.describe('Presentational content dialog', () => {
	let directory: string;
	let bundle: string;
	test.beforeAll(() => {
		directory = mkdtempSync(join(tmpdir(), 'content-dialog-'));
		const output = join(directory, 'dialog.js');
		execFileSync('bun', [
			'build',
			'src/features/shell/app-content-dialog.ts',
			'--target=browser',
			'--outfile',
			output
		]);
		bundle = readFileSync(output, 'utf8');
	});
	test.afterAll(() => {
		if (directory) rmSync(directory, { recursive: true, force: true });
	});
	test.beforeEach(async ({ page }) => {
		await page.setContent(
			`<html lang="en"><head><title>Content dialog acceptance</title><style>${readFileSync('css/root.css', 'utf8')}</style></head><body><main><h1>Content dialog acceptance</h1><button type="button" id="invoker">Open content</button><app-content-dialog></app-content-dialog></main></body></html>`
		);
		await page.addScriptTag({ type: 'module', content: bundle });
		await page.evaluate(async () => {
			await customElements.whenDefined('app-content-dialog');
			const target = window as unknown as ContentTestWindow;
			const element = document.querySelector('app-content-dialog')!;
			const fragment = document.createDocumentFragment();
			const p = document.createElement('p');
			p.textContent = 'Safe content retained.';
			const link = document.createElement('a');
			link.href = '/data';
			link.textContent = 'Load Data';
			fragment.append(p, link);
			target.__contentSource = fragment;
			target.__contentEvents = [];
			element.heading = 'Privacy information';
			element.status = 'ready';
			element.content = fragment;
			element.contentLang = 'en';
			element.contentDir = 'ltr';
			element.addEventListener('app-content-dialog-close', (event) => {
				const intent = event as CustomEvent<ContentDialogCloseDetail>;
				target.__contentEvents.push({
					detail: intent.detail,
					bubbles: intent.bubbles,
					composed: intent.composed
				});
			});
			document.getElementById('invoker')!.addEventListener('click', () => {
				element.open = true;
			});
			await element.updateComplete;
		});
		await page.getByRole('button', { name: 'Open content', exact: true }).focus();
	});

	test('CDLG-AC-1: the native icon closes once with a typed, non-bubbling intent and no loading-update reopening', async ({
		page
	}) => {
		await page.getByRole('button', { name: 'Open content', exact: true }).press('Enter');
		await page.getByRole('button', { name: 'Close', exact: true }).click();
		await expect(page.getByRole('dialog')).not.toBeVisible();
		await expect
			.poll(() =>
				page.evaluate(() => (window as unknown as ContentTestWindow).__contentEvents)
			)
			.toEqual([{ detail: {}, bubbles: false, composed: false }]);
		await page.locator('app-content-dialog').evaluate(async (element: AppContentDialog) => {
			element.heading = 'Updated heading';
			element.status = 'loading';
			await element.updateComplete;
		});
		await expect(page.getByRole('dialog')).not.toBeVisible();
		await expect(page.getByRole('button', { name: 'Open content', exact: true })).toBeFocused();
	});

	test('CDLG-AC-2: native Esc emits one user intent and returns focus', async ({ page }) => {
		await page.getByRole('button', { name: 'Open content', exact: true }).press('Enter');
		await page.keyboard.press('Escape');
		await expect(page.getByRole('dialog')).not.toBeVisible();
		await expect
			.poll(() =>
				page.evaluate(() => (window as unknown as ContentTestWindow).__contentEvents.length)
			)
			.toBe(1);
		await expect(page.getByRole('button', { name: 'Open content', exact: true })).toBeFocused();
	});

	test('CDLG-AC-3: h2 names the native dialog and the named icon has decorative SVG, without public-attribute reflection', async ({
		page
	}) => {
		await page.getByRole('button', { name: 'Open content', exact: true }).click();
		const dialog = page.getByRole('dialog', { name: 'Privacy information', exact: true });
		await expect(dialog.getByRole('heading', { level: 2 })).toHaveText('Privacy information');
		await expect(dialog.locator('h1')).toHaveCount(0);
		await expect(dialog).not.toHaveAttribute('role');
		await expect(dialog).not.toHaveAttribute('aria-modal');
		await expect(
			dialog.getByRole('button', { name: 'Close', exact: true }).locator('svg')
		).toHaveAttribute('aria-hidden', 'true');
		await expect(page.locator('app-content-dialog')).not.toHaveAttribute('open');
		const result = await new AxeBuilder({ page })
			.withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
			.analyze();
		expect(result.violations).toEqual([]);
	});

	test('CDLG-AC-4: language and direction apply to heading and body only while ready', async ({
		page
	}) => {
		await page.getByRole('button', { name: 'Open content', exact: true }).click();
		const content = page.locator('app-content-dialog');
		await content.evaluate(async (element: AppContentDialog) => {
			element.status = 'loading';
			element.contentLang = 'ar';
			element.contentDir = 'rtl';
			await element.updateComplete;
		});
		for (const selector of ['h2', '.modal-body']) {
			await expect(content.locator(selector)).not.toHaveAttribute('lang');
			await expect(content.locator(selector)).not.toHaveAttribute('dir');
		}
		await expect(content.locator('.modal-body')).toHaveAttribute('aria-busy', 'true');
		await content.evaluate(async (element: AppContentDialog) => {
			element.status = 'ready';
			await element.updateComplete;
		});
		for (const selector of ['h2', '.modal-body']) {
			await expect(content.locator(selector)).toHaveAttribute('lang', 'ar');
			await expect(content.locator(selector)).toHaveAttribute('dir', 'rtl');
		}
		await expect(content.locator('.modal-body')).toHaveAttribute('aria-busy', 'false');
		await content.evaluate(async (element: AppContentDialog) => {
			element.status = 'error';
			await element.updateComplete;
		});
		for (const selector of ['h2', '.modal-body']) {
			await expect(content.locator(selector)).not.toHaveAttribute('lang');
			await expect(content.locator(selector)).not.toHaveAttribute('dir');
		}
	});

	test('CDLG-AC-5: the same source fragment survives unrelated renders and repeated loading-ready transitions', async ({
		page
	}) => {
		await page.getByRole('button', { name: 'Open content', exact: true }).click();
		const content = page.locator('app-content-dialog');
		for (const status of ['ready', 'loading', 'ready', 'loading', 'ready'] as const) {
			await content.evaluate(async (element: AppContentDialog, next) => {
				element.status = next;
				element.heading = 'Privacy information';
				await element.updateComplete;
			}, status);
			expect(
				await page.evaluate(
					() => (window as unknown as ContentTestWindow).__contentSource.childNodes.length
				)
			).toBe(2);
			if (status === 'ready') {
				await expect(content.locator('.modal-body p')).toHaveText('Safe content retained.');
				await expect(content.locator('.modal-body a')).toHaveAttribute('href', '/data');
				expect(
					await content.evaluate(
						(element) =>
							element.shadowRoot!.querySelector('.modal-body p') !==
							(window as unknown as ContentTestWindow).__contentSource.firstChild
					)
				).toBe(true);
			} else await expect(content.locator('.modal-body p')).toHaveCount(0);
		}
	});

	test('CDLG-AC-6: error renders one consumer-labelled alert and preserves supplied control text', async ({
		page
	}) => {
		await page.locator('app-content-dialog').evaluate(async (element: AppContentDialog) => {
			element.labels = {
				close: 'Dismiss content',
				loadError: 'The requested page is unavailable.'
			};
			element.status = 'error';
			element.open = true;
			await element.updateComplete;
		});
		await expect(page.getByRole('alert')).toHaveCount(1);
		await expect(page.getByRole('alert')).toHaveText('The requested page is unavailable.');
		await expect(
			page.getByRole('button', { name: 'Dismiss content', exact: true })
		).toBeVisible();
	});

	test('CDLG-AC-7: property-driven close and immediate reopening suppress the queued native close intent', async ({
		page
	}) => {
		await page.getByRole('button', { name: 'Open content', exact: true }).click();
		await page.locator('app-content-dialog').evaluate(async (element: AppContentDialog) => {
			element.open = false;
			await element.updateComplete;
			element.open = true;
			await element.updateComplete;
			await new Promise<void>((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
			);
		});
		await expect(page.getByRole('dialog')).toBeVisible();
		expect(
			await page.evaluate(() => (window as unknown as ContentTestWindow).__contentEvents)
		).toEqual([]);
		await page.locator('app-content-dialog').evaluate(async (element: AppContentDialog) => {
			element.open = false;
			await element.updateComplete;
		});
		await expect(page.getByRole('dialog')).not.toBeVisible();
	});
});

test('CDLG-AC-8: a new reserved route survives the queued close from a Back transition', async ({
	page
}) => {
	await page.goto('/data');
	await page.getByRole('button', { name: 'Get Started', exact: true }).click();
	await page.locator('app-sidebar a[href="/about"]').click();
	await expect(page.locator('app-content-modal h2')).toHaveText('About samatā.ml');
	await page.evaluate(
		() =>
			new Promise<void>((resolve) => {
				window.addEventListener(
					'popstate',
					() => {
						const sidebar = document.querySelector('app-sidebar')!;
						(
							sidebar.shadowRoot!.querySelector(
								'a[href="/privacy"]'
							) as HTMLAnchorElement
						).click();
						resolve();
					},
					{ once: true }
				);
				history.back();
			})
	);
	await expect(page).toHaveURL(/\/privacy$/);
	await expect(page.locator('app-content-modal h2')).toHaveText('Privacy Policy');
	await expect(page.locator('app-content-modal .modal-body')).toContainText(
		'Complete privacy is the only option.'
	);
	await page.locator('app-content-modal .btn-icon').click();
	await expect(page).toHaveURL(/\/data$/);
	await expect(page.locator('app-content-modal dialog')).not.toBeVisible();
});

test('CDLG-AC-3: loaded content uses the existing draft structure', async ({
	page,
	context
}, testInfo) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto('/privacy');
	await expect(page.locator('app-content-modal .modal-body')).toContainText(
		'Complete privacy is the only option.'
	);
	const reference = await context.newPage();
	await reference.setViewportSize({ width: 1440, height: 900 });
	await reference.goto(`${MOCKUPS_URL}/00-2_content-modal.html?clean=1`);
	await reference.screenshot({ path: testInfo.outputPath('content-draft.png') });
	await page.screenshot({ path: testInfo.outputPath('content-app.png') });
	await reference.close();
});
