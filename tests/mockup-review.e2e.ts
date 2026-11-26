import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { MOCKUPS_URL } from '../scripts/ports';

const MOCKUP_DIR = fileURLToPath(new URL('../specification/mockups/', import.meta.url));
/** Status of every top-level mockup the catalogue lists (mirrors `scripts/serve-mockups.ts`). */
const MOCKUP_STATUSES = readdirSync(MOCKUP_DIR, { withFileTypes: true })
	.filter(
		(entry) =>
			entry.isFile() &&
			entry.name.toLowerCase().endsWith('.html') &&
			entry.name.toLowerCase() !== 'index.html'
	)
	.map(
		(entry) =>
			/<meta\s+name="status"\s+content="([a-z]+)"/.exec(
				readFileSync(`${MOCKUP_DIR}${entry.name}`, 'utf8')
			)?.[1] ?? 'draft'
	);
const TOTAL = MOCKUP_STATUSES.length;
const IMPLEMENTED = MOCKUP_STATUSES.filter((status) => status === 'implemented').length;
const DRAFT = MOCKUP_STATUSES.filter((status) => status === 'draft').length;

const MOCKUP_SERVER = MOCKUPS_URL;
const DRAFT_FILE = '03-4_train-models-3-configure-model.html';
const OVERVIEW_FILE = '03-0_models-overview.html';

test.describe('Mockup review catalogue and previews', () => {
	test('catalogue renders mockup-index table from /index.json with every mockup', async ({
		page
	}) => {
		const indexResponse = await page.request.get(`${MOCKUP_SERVER}/index.json`);
		expect(indexResponse.status()).toBe(200);
		expect(indexResponse.headers()['content-type']).toBe('application/json; charset=utf-8');
		const entries = (await indexResponse.json()) as Array<{
			filename: string;
			name: string;
			description: string;
			status: string;
		}>;
		expect(entries).toHaveLength(TOTAL);

		await page.goto(MOCKUP_SERVER);
		await expect(page.locator('body.mockup-index')).toHaveCount(1);
		await expect(page.locator('head link[rel="stylesheet"][href="/mockups.css"]')).toHaveCount(
			1
		);
		await expect(page.locator('#__mockup-review-helper-host')).toHaveCount(0);

		const rows = page.locator('table.mockups tbody tr');
		await expect(rows).toHaveCount(TOTAL);
		await expect(page.locator('#results-count')).toHaveText(
			`Showing ${TOTAL} of ${TOTAL} mockups`
		);

		const configureRow = rows.filter({ hasText: DRAFT_FILE });
		await expect(configureRow).toHaveCount(1);
		await expect(configureRow).toContainText('Configure Model');
		await expect(configureRow).toContainText('hyperparameter form');
		await expect(configureRow.locator('.mockup-status-draft')).toHaveText('draft');
		await expect(configureRow.getByRole('link', { name: 'Configure Model' })).toHaveAttribute(
			'href',
			`/${DRAFT_FILE}`
		);
		await expect(configureRow.getByRole('link', { name: 'View source' })).toHaveAttribute(
			'href',
			`/__source/${DRAFT_FILE}`
		);
		await expect(configureRow.getByRole('link', { name: 'Clean preview' })).toHaveAttribute(
			'href',
			`/${DRAFT_FILE}?clean=1`
		);
	});

	test('client-side search and status filter update rows live and show empty state', async ({
		page
	}) => {
		await page.goto(MOCKUP_SERVER);
		const rows = page.locator('table.mockups tbody tr');
		await expect(rows).toHaveCount(TOTAL);

		await page.locator('#status-filter').selectOption('implemented');
		await expect(rows).toHaveCount(IMPLEMENTED);
		await expect(page.locator('#results-count')).toHaveText(
			`Showing ${IMPLEMENTED} of ${TOTAL} mockups`
		);
		await expect(rows.locator('.mockup-status-draft')).toHaveCount(0);

		await page.locator('#status-filter').selectOption('draft');
		await expect(rows).toHaveCount(DRAFT);
		await expect(page.locator('#results-count')).toHaveText(
			`Showing ${DRAFT} of ${TOTAL} mockups`
		);

		await page.locator('#query').fill('models-overview');
		await expect(rows).toHaveCount(1);
		await expect(rows.first()).toContainText('Models Overview');
		await expect(page.locator('#results-count')).toHaveText(`Showing 1 of ${TOTAL} mockups`);

		await page.locator('#query').fill('definitely-no-such-mockup-xyz');
		await expect(rows).toHaveCount(1);
		await expect(rows.first()).toContainText('No mockups match your filter.');
		await expect(page.locator('#results-count')).toHaveText(`Showing 0 of ${TOTAL} mockups`);

		await page.locator('#query').fill('');
		await page.locator('#status-filter').selectOption('all');
		await expect(rows).toHaveCount(TOTAL);
	});

	test('normal preview injects /mockups.css, light-DOM helper, and auto-navigating selector', async ({
		page
	}) => {
		await page.goto(`${MOCKUP_SERVER}/${DRAFT_FILE}`);
		await expect(page.locator('head link[rel="stylesheet"][href="/mockups.css"]')).toHaveCount(
			1
		);

		const host = page.locator('body > #__mockup-review-helper-host');
		await expect(host).toHaveCount(1);
		expect(await host.evaluate((el) => el.shadowRoot === null)).toBe(true);
		expect(
			await page.evaluate(() => {
				const main = document.querySelector('main');
				const helper = document.getElementById('__mockup-review-helper-host');
				return (
					main !== null &&
					helper !== null &&
					Boolean(main.compareDocumentPosition(helper) & Node.DOCUMENT_POSITION_FOLLOWING)
				);
			})
		).toBe(true);

		await expect(host.locator('#mockup-details .mockup-name')).toContainText('Configure Model');
		await expect(host.locator('.mockup-status-draft')).toHaveText('draft');
		await expect(host.locator('#mockup-details .mockup-description')).toContainText(
			'hyperparameter form'
		);
		await expect(host.locator('#mockup-controls a.index-link')).toHaveAttribute('href', '/');
		await expect(host.locator('label')).toHaveCount(0);
		await expect(host.getByRole('button', { name: 'Go' })).toHaveCount(0);

		const select = host.locator('#preview-page');
		await expect(select.locator('option')).toHaveCount(TOTAL);
		await expect(select).toHaveValue(DRAFT_FILE);
		await expect(select.locator(`option[value="${DRAFT_FILE}"]`)).toHaveText(
			`Configure Model (${DRAFT_FILE})`
		);

		await Promise.all([
			page.waitForURL(`${MOCKUP_SERVER}/${OVERVIEW_FILE}`),
			select.selectOption(OVERVIEW_FILE)
		]);
		await expect(page.locator('#mockup-details .mockup-name')).toContainText('Models Overview');
	});

	test('clean previews omit all injected markup and source endpoint serves safe plain text', async ({
		page
	}) => {
		const sourceResponse = await page.request.get(`${MOCKUP_SERVER}/__source/${DRAFT_FILE}`);
		expect(sourceResponse.status()).toBe(200);
		expect(sourceResponse.headers()['content-type']).toBe('text/plain; charset=utf-8');
		expect(sourceResponse.headers()['x-content-type-options']).toBe('nosniff');
		expect(await sourceResponse.text()).toContain('<!doctype html>');

		await page.goto(`${MOCKUP_SERVER}/${DRAFT_FILE}?clean=1`);
		await expect(page.locator('#__mockup-review-helper-host')).toHaveCount(0);
		await expect(page.locator('link[href="/mockups.css"]')).toHaveCount(0);
		await expect(page.locator('script')).toHaveCount(0);
		await expect(page.locator('body')).toContainText('Configure Model');
	});
});
