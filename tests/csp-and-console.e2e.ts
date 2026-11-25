import { expect, test } from '@playwright/test';
import { DIST_URL } from '../scripts/ports';
import type { ClassifierId } from '../src/features/models/model-catalogue';
import type { AppConfusionFlowchart } from '../src/features/results/app-confusion-flowchart';
import { configureOpenDraft } from './fixtures/training/browser';
import { dismissWelcomeModal, loadSampleDataset } from './journeys/helpers';

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
	await dismissWelcomeModal(page);
	await loadSampleDataset(page, 'iris');
	await page.reload();
	const preview = page.locator('app-dataset-preview');
	await expect(preview.locator('h1')).toContainText('Preview Dataset: Iris');

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
	await expect(preview.locator('h1')).toContainText('Preview Dataset: Iris');
	await change.click();
	await confirm.getByRole('button', { name: 'Change Dataset', exact: true }).click();
	await loadSampleDataset(page, 'breast-cancer-wisconsin');
	await expect(preview.locator('h1')).toContainText('Breast Cancer Wisconsin');

	const table = preview.locator('ui-virtual-table');
	const row = preview.locator('input#row-number');
	await row.fill('300');
	await row.press('Enter');
	await expect(table.locator('[aria-rowindex="301"]')).toBeInViewport();
	for (const end of ['top', 'bottom']) {
		const spacer = table.locator(`.rail-spacer-${end}`);
		expect(
			await spacer.evaluate((element) => element.getBoundingClientRect().height)
		).toBeGreaterThan(0);
	}

	await page.locator('app-sidebar a[href="/target"]').click();
	const target = page.getByRole('button', { name: 'Set as Target: Diagnosis' });
	await target.click();
	await expect(page.getByRole('button', { name: 'Current Target', exact: true })).toBeVisible();
	const modelStep = page.locator('app-sidebar a[href="/models"]');
	await modelStep.click();
	const overview = page.locator('app-models-view');
	const modelNumbers: number[] = [];
	for (const classifier of ['logistic-regression', 'gaussian-nb'] satisfies ClassifierId[]) {
		await overview.getByRole('link', { name: 'Train New Model' }).click();
		await expect(page).toHaveURL('/models/new');
		const builder = page.locator('app-model-builder-view');
		await expect(builder).toHaveAttribute('model-num', /^[1-9]\d*$/);
		const number = Number(await builder.getAttribute('model-num'));
		modelNumbers.push(number);

		const setup = await configureOpenDraft(page, number, { classifier });
		await setup.getByRole('button', { name: 'Train Model' }).click();
		await expect(
			page.getByTestId('training-step').getByRole('button', { name: 'View Results' })
		).toBeEnabled({ timeout: 45_000 });
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
	const nonzeroBars = await comparison.locator('.bar').evaluateAll((bars) =>
		bars.flatMap((element) => {
			const bar = element as HTMLElement;
			const fraction = Number.parseFloat(bar.style.inlineSize) / 100;
			if (!(fraction > 0)) return [];
			const cell = bar.parentElement!;
			const style = getComputedStyle(cell);
			const contentWidth =
				cell.clientWidth -
				Number.parseFloat(style.paddingInlineStart) -
				Number.parseFloat(style.paddingInlineEnd);
			return [
				{ width: bar.getBoundingClientRect().width, expected: contentWidth * fraction }
			];
		})
	);
	expect(nonzeroBars.length).toBeGreaterThan(0);
	for (const { width, expected } of nonzeroBars) {
		expect(width).toBeGreaterThan(0);
		expect(Math.abs(width - expected)).toBeLessThan(2);
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
