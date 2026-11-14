import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const MOCKUP_SERVER = 'http://localhost:3333';
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const draftPath = 'ui-scaffold/drafts/03-4_train-models-3-configure-model.html';

test.describe('Mockup review catalogue and previews', () => {
	test('catalogue groups the full inventory and passes axe without exclusions', async ({
		page
	}) => {
		await page.goto(MOCKUP_SERVER);
		await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
		await expect(page.getByRole('search')).toBeVisible();
		await expect(page.locator('#needs-styling')).toContainText('Draft — needs styling');
		await expect(page.locator('#resources')).toContainText('CSS resource');
		await expect(page.locator('#catalogue')).toContainText('of');

		const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
		expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
	});

	test('GET search and filters preserve values and support Back and empty results', async ({
		page
	}) => {
		await page.goto(MOCKUP_SERVER);
		await page.getByLabel('Search paths and titles').fill('03-4_train-models');
		await page.getByRole('button', { name: 'Apply filters' }).click();
		await expect(page).toHaveURL(/q=03-4_train-models/);
		await expect(page).toHaveURL(/filter=all/);
		await expect(page.locator('#needs-styling')).toContainText(draftPath);
		await expect(
			page.locator('#catalogue section:not(#needs-styling):not(#resources) li')
		).toHaveCount(1);
		await page.goBack();
		await expect(page).toHaveURL(MOCKUP_SERVER + '/');
		await expect(page.getByLabel('Show files')).toHaveValue('all');
		await page.goForward();
		await expect(page).toHaveURL(/filter=all/);

		await page.goto(MOCKUP_SERVER + '/');
		await page.getByLabel('Search paths and titles').fill('03-4_train-models');
		await page.getByLabel('Show files').selectOption('needs-styling');
		await page.getByRole('button', { name: 'Apply filters' }).click();
		await expect(page).toHaveURL(/filter=needs-styling/);
		await expect(
			page.locator('#catalogue section:not(#needs-styling):not(#resources) li')
		).toHaveCount(0);

		await page.getByLabel('Search paths and titles').fill('no matching mockup path');
		await page.getByRole('button', { name: 'Apply filters' }).click();
		await expect(page.getByText('No files match these filters.')).toBeVisible();
		await page.getByRole('link', { name: 'Reset filters' }).first().click();
		await expect(page).toHaveURL(MOCKUP_SERVER + '/');
	});

	test('catalogue search still works with JavaScript disabled', async ({ browser }) => {
		const context = await browser.newContext({ javaScriptEnabled: false });
		const page = await context.newPage();
		await page.goto(MOCKUP_SERVER + '/?filter=needs-styling');
		await expect(page.locator('#needs-styling')).toContainText('03-0_models-overview.html');
		await page.getByLabel('Search paths and titles').fill('03-0_models-overview');
		await page.getByRole('button', { name: 'Apply filters' }).click();
		await expect(page).toHaveURL(/q=03-0_models-overview/);
		await context.close();
	});

	test('catalogue reflows at 320px and keeps native keyboard focus visible', async ({
		page
	}, testInfo) => {
		await page.setViewportSize({ width: 320, height: 800 });
		await page.goto(MOCKUP_SERVER);
		const dimensions = await page.evaluate(() => ({
			viewport: document.documentElement.clientWidth,
			document: document.documentElement.scrollWidth
		}));
		expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
		await page.keyboard.press('Tab');
		expect(await page.evaluate(() => (document.activeElement as HTMLElement).id)).toBe('query');
		await page.emulateMedia({ forcedColors: 'active' });
		expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
		await testInfo.attach('mockup-review-catalogue-320px.png', {
			body: await page.screenshot({ fullPage: true }),
			contentType: 'image/png'
		});
	});

	test('source links return plain text and clean previews omit all injected code', async ({
		page
	}) => {
		const sourceResponse = await page.request.get(MOCKUP_SERVER + '/__source/' + draftPath);
		expect(sourceResponse.status()).toBe(200);
		expect(sourceResponse.headers()['content-type']).toBe('text/plain; charset=utf-8');
		expect(sourceResponse.headers()['x-content-type-options']).toBe('nosniff');
		expect(await sourceResponse.text()).toContain('<!doctype html>');

		await page.goto(MOCKUP_SERVER + '/files/' + draftPath + '?clean=1');
		await expect(page.locator('#__mockup-review-helper-host')).toHaveCount(0);
		await expect(page.locator('script')).toHaveCount(0);
		await expect(page.locator('body')).toContainText('Configure Model');
	});

	test('preview helper identifies the full path and navigates only after Go', async ({
		page
	}) => {
		page.setDefaultTimeout(5000);
		await page.goto(MOCKUP_SERVER + '/files/' + draftPath);
		const controls = page.locator('#__mockup-review-helper-host #preview-controls');
		await expect(controls).toContainText(draftPath);
		await expect(controls).toContainText('Draft — needs styling');
		await expect(page.locator('main > #__mockup-review-helper-host')).toHaveCount(1);
		const selector = page.getByLabel('Preview HTML file');
		await selector.selectOption('/files/ui-scaffold/drafts/03-0_models-overview.html');
		await expect(page).toHaveURL(MOCKUP_SERVER + '/files/' + draftPath);
		await page.getByRole('button', { name: 'Go' }).click();
		await expect(page).toHaveURL(
			MOCKUP_SERVER + '/files/ui-scaffold/drafts/03-0_models-overview.html'
		);
	});
});
