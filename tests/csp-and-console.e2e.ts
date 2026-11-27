import { expect, test } from '@playwright/test';
import { DIST_URL } from '../scripts/ports';
import type { AppConfusionFlowchart } from '../src/features/results/app-confusion-flowchart';
import { configureOpenDraft, openSidebarDraft } from './fixtures/training/browser';
import { loadSampleDataset, viewNumberedTrainingResult } from './journeys/helpers';

interface CspProbeWindow extends Window {
	reportCspViolation(directive: string, blocked: string): Promise<void>;
}

test.use({ baseURL: DIST_URL });

test('BETA-ERR-5: production data, training, results and dialogs stay clean under CSP', async ({
	page
}) => {
	test.setTimeout(120_000);
	const consoleIssues: string[] = [];
	const pageErrors: string[] = [];
	const cspViolations: string[] = [];
	const policies: string[] = [];
	page.on('console', (message) => {
		const text = message.text();
		if (
			message.type() === 'error' ||
			/lit\.dev\/msg|Lit is in dev mode|change-in-update/i.test(text)
		) {
			consoleIssues.push(text);
		}
	});
	page.on('pageerror', (error) => pageErrors.push(error.message));
	page.on('response', (response) => {
		if (
			response.request().isNavigationRequest() &&
			response.request().frame() === page.mainFrame()
		) {
			policies.push(response.headers()['content-security-policy'] ?? '');
		}
	});
	await page.exposeBinding(
		'reportCspViolation',
		(_source, directive: string, blocked: string) => {
			cspViolations.push(`${directive}: ${blocked}`);
		}
	);
	await page.addInitScript(() => {
		document.addEventListener('securitypolicyviolation', (event) => {
			void (window as unknown as CspProbeWindow).reportCspViolation(
				event.effectiveDirective,
				event.blockedURI
			);
		});
	});

	await page.goto('/data');
	await loadSampleDataset(page, 'iris');
	await page.reload();
	const preview = page.locator('app-dataset-preview');
	await expect(preview.locator('h1')).toHaveText(/^Iris.* Preview$/);

	await page.locator('app-sidebar footer a[href="/about"]').click();
	const content = page.locator('app-content-modal dialog.modal');
	await expect(content).toBeVisible();
	await page.mouse.click(2, 2);
	await expect(content).toBeHidden();
	await expect(page).toHaveURL('/data');

	const change = preview.getByRole('button', { name: 'Change Dataset', exact: true });
	const confirm = page.getByRole('dialog', { name: 'Change Dataset' });
	await change.click();
	await page.mouse.click(2, 2);
	await expect(confirm).toBeVisible();
	await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();
	await expect(confirm).toBeHidden();
	await expect(preview.locator('h1')).toHaveText(/^Iris.* Preview$/);
	await change.click();
	await confirm.getByRole('button', { name: 'Change Dataset', exact: true }).click();
	await loadSampleDataset(page, 'breast-cancer-wisconsin');
	await expect(preview.locator('h1')).toContainText('Breast Cancer Wisconsin');

	const table = preview.locator('ui-virtual-table');
	// The document now scrolls the table: let the load and any scroll restoration settle first.
	await expect(table.locator('.table-cell').first()).not.toHaveText('');
	await expect(preview.locator('.status-box')).toHaveCount(0);
	// Firefox can ignore a window.scrollTo issued straight after Playwright's own scroll into
	// view, so repeat the whole scroll step until the row is shown.
	await expect(async () => {
		await table.evaluate((element) => {
			const root = element.shadowRoot!;
			const body = root.querySelector('.table-body')!;
			const rowHeight = root.querySelector('.table-row')!.getBoundingClientRect().height;
			window.scrollTo(0, body.getBoundingClientRect().top + window.scrollY + 300 * rowHeight);
		});
		await expect(table.locator('[aria-rowindex="302"]')).toBeInViewport({ timeout: 1500 });
	}).toPass({ timeout: 15_000 });
	// Geometry is set through the CSSOM: the rail has the rows' height and rows are translated.
	const geometry = await table.evaluate((element) => {
		const root = element.shadowRoot!;
		const body = root.querySelector<HTMLElement>('.table-body')!;
		const row = root.querySelector<HTMLElement>('.table-row')!;
		return {
			rail: body.getBoundingClientRect().height,
			rowHeight: row.getBoundingClientRect().height,
			transform: getComputedStyle(row).transform
		};
	});
	expect(geometry.rail).toBeGreaterThan(geometry.rowHeight * 100);
	expect(geometry.transform).toMatch(/^matrix\(1, 0, 0, 1, 0, [\d.]+\)$/);

	await page.locator('app-sidebar a[href="/target"]').click();
	const target = page.getByRole('button', { name: 'Set as Target: Diagnosis' });
	await target.click();
	await expect(page.getByRole('button', { name: 'Current Target', exact: true })).toBeVisible();
	const modelStep = page.locator('app-sidebar a[href="/models"]');
	await modelStep.click();
	const overview = page.locator('app-models-view');
	const modelNumbers: number[] = [];
	for (const [classifier, name, link] of [
		['logistic-regression', 'Logistic Regression', 'Train New Model'],
		['gaussian-nb', 'Gaussian Naive Bayes', 'Train Another Model']
	] as const) {
		const number = await openSidebarDraft(page, link);
		const builder = page.locator('app-model-builder-view');
		modelNumbers.push(number);

		const setup = await configureOpenDraft(page, number, { classifier });
		await expect(builder.locator('#step-1-title')).toHaveText(`1. ${name}`);
		await setup.getByRole('button', { name: 'Train Model' }).click();
		await viewNumberedTrainingResult(page, number, name);
		await modelStep.click();
		await expect(
			overview.locator(`a[href="/models/${number}"]`, { hasText: 'View Results' })
		).toBeVisible();
	}
	expect(new Set(modelNumbers).size).toBe(2);

	for (const number of modelNumbers) {
		await overview.locator(`a[href="/models/${number}"]`, { hasText: 'View Results' }).click();
		const flowchart = page.locator('app-confusion-flowchart');
		await expect(flowchart.locator('.rows > li')).toHaveCount(2);
		const sizes = await flowchart.evaluate((host: AppConfusionFlowchart) =>
			Array.from(host.shadowRoot!.querySelectorAll('.rows > li'), (row, index) => {
				const barWidth = row.querySelector('.bar')!.getBoundingClientRect().width;
				const expected = host.flow!.rows[index]!.outcomes.filter(({ count }) => count > 0);
				return Array.from(row.querySelectorAll('.segment'), (segment, position) => ({
					width: segment.getBoundingClientRect().width,
					expected: barWidth * expected[position]!.share
				}));
			})
		);
		for (const segments of sizes) {
			expect(segments.length).toBeGreaterThan(0);
			for (const { width, expected } of segments) {
				expect(width).toBeGreaterThan(0);
				expect(Math.abs(width - expected)).toBeLessThan(1);
			}
		}
		await modelStep.click();
	}

	await overview.getByRole('link', { name: 'Compare Results' }).click();
	await expect(page).toHaveURL('/results');
	const comparison = page.locator('app-comparison-table');
	await expect(comparison).toBeVisible();
	await expect(comparison.locator('.bar')).toHaveCount(0);
	const modelRows = comparison.locator('tbody').first().locator('tr');
	await expect(modelRows).toHaveCount(2);
	for (const [index, name] of ['Logistic Regression', 'Gaussian Naive Bayes'].entries()) {
		const modelRow = modelRows.filter({ hasText: name });
		await expect(modelRow).toHaveCount(1);
		await expect(modelRow.locator('.swatch')).toHaveText(String(modelNumbers[index]));
		await expect(modelRow.locator('td.number').first()).toHaveText(/^\s*\d+(?:\.\d+)?%\s*$/);
	}

	await page.evaluate(
		() =>
			new Promise<void>((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
			)
	);
	expect(policies.length).toBeGreaterThanOrEqual(2);
	for (const policy of policies) {
		const directives = policy.split(';').map((directive) => directive.trim());
		expect(directives).toEqual(
			expect.arrayContaining([
				"default-src 'none'",
				"script-src 'self' 'wasm-unsafe-eval'",
				"script-src-attr 'none'",
				"style-src-attr 'none'",
				"worker-src 'self'"
			])
		);
	}
	expect(cspViolations).toEqual([]);
	expect(pageErrors).toEqual([]);
	expect(consoleIssues).toEqual([]);
});
