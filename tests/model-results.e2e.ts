import { expect, test, type Locator, type Page } from '@playwright/test';
import type { PersistedAppState } from '../src/types/state';
import {
	deleteEnvelope,
	downgradeEnvelope,
	interceptResultReads,
	seedTrainedModel
} from './helpers/seed-results';

function results(page: Page): Locator {
	return page.locator('app-model-results');
}

function storedModel(page: Page) {
	return page.evaluate(() => {
		const state = JSON.parse(localStorage.getItem('samata-ml:state')!) as PersistedAppState;
		return state.models[0]!;
	});
}

async function waitForResults(page: Page): Promise<void> {
	await expect(results(page).locator('app-results-summary')).toBeVisible({ timeout: 15_000 });
	await settled(page);
}

/** Awaits the builder's route settling, which includes the results and their charts. */
function settled(page: Page): Promise<void> {
	return page
		.locator('app-model-builder-view')
		.evaluate((builder) =>
			(builder as unknown as { whenSettled(): Promise<void> }).whenSettled()
		);
}

/** Sequence of the shared blocks inside Section 6, in DOM order. */
function blocks(page: Page): Promise<string[]> {
	return results(page).evaluate((host) =>
		[
			...host.shadowRoot!.querySelectorAll(
				'section.block > h3, section.block > [class], section.block > app-results-summary, section.block > app-fold-strip, section.block > app-confusion-flowchart, section.block > app-classee-strips, section.block > app-confusion-matrix, section.block > app-class-metrics-table, section.block > app-threshold-explorer, section.block > app-reliability-diagram'
			)
		].map((node) =>
			node.tagName === 'H3' ? `h3:${node.textContent!.trim()}` : node.tagName.toLowerCase()
		)
	);
}

test.describe('Section 6 shared results', () => {
	test('WML-P4-UI-10: a seeded binary model shows every shared section in order', async ({
		page
	}) => {
		await seedTrainedModel(page, 'breast-cancer');
		await waitForResults(page);
		expect(await blocks(page)).toEqual([
			'h3:Scores on held-out rows',
			'app-results-summary',
			'h3:Score on the test split',
			'app-fold-strip',
			'h3:Where the model makes mistakes',
			'app-confusion-flowchart',
			'app-confusion-matrix',
			'app-class-metrics-table',
			'h3:Probability threshold',
			'app-threshold-explorer',
			'h3:Calibration',
			'app-reliability-diagram'
		]);
		await expect(page.locator('.train-step[aria-current="step"] h2')).toHaveText(
			'6. Model Results'
		);
		await expect(results(page).locator('app-results-summary')).toContainText(
			'Balanced accuracy on held-out rows'
		);
	});

	test('WML-P4-UI-10: a seeded multiclass model uses Classee strips and no threshold explorer', async ({
		page
	}) => {
		await seedTrainedModel(page, 'iris');
		await waitForResults(page);
		expect(await blocks(page)).toEqual([
			'h3:Scores on held-out rows',
			'app-results-summary',
			'h3:Scores across folds',
			'app-fold-strip',
			'h3:Where the model makes mistakes',
			'app-classee-strips',
			'app-confusion-matrix',
			'app-class-metrics-table',
			'h3:Calibration',
			'app-reliability-diagram'
		]);
		await expect(results(page).locator('app-threshold-explorer')).toHaveCount(0);
		await expect(results(page).locator('app-results-summary')).toContainText('5-fold');
	});

	test('WML-P4-UI-10: a model without probabilities explains each unavailable section', async ({
		page
	}) => {
		await seedTrainedModel(page, 'svc-no-probabilities');
		await waitForResults(page);
		await expect(results(page).locator('app-threshold-explorer')).toContainText(
			'Log loss and the threshold explorer are unavailable because this Logistic Regression was trained without probability estimates.'
		);
		await expect(results(page).locator('app-reliability-diagram')).toContainText(
			'The reliability diagram is unavailable'
		);
		await expect(results(page).getByRole('slider')).toHaveCount(0);
	});

	test('WML-P4-UI-10: a valid version 1 envelope opens Section 6 with the legacy message and Models link', async ({
		page
	}) => {
		await seedTrainedModel(page, 'iris');
		await waitForResults(page);
		await downgradeEnvelope(page);
		await page.reload();
		await expect(page.locator('.train-step[aria-current="step"] h2')).toHaveText(
			'6. Model Results'
		);
		await expect(results(page)).toContainText(
			'This model was trained before detailed results were saved.'
		);
		await expect(results(page).getByRole('link', { name: /Train New Model/ })).toHaveAttribute(
			'href',
			'/models'
		);
		await expect(results(page).locator('app-results-summary')).toHaveCount(0);
		expect((await storedModel(page)).status).toBe('trained');
		expect((await storedModel(page)).metrics).toBeNull();
	});

	test('WML-P4-UI-10: a result missing before startup returns to Training Setup with the configuration intact', async ({
		page
	}) => {
		await seedTrainedModel(page, 'breast-cancer');
		await waitForResults(page);
		const before = await storedModel(page);
		await deleteEnvelope(page);
		await page.reload();
		await expect(page.locator('.train-step[aria-current="step"] h2')).toHaveText(/^\s*4\./);
		const after = await storedModel(page);
		expect(after.status).toBe('draft');
		expect(after.error?.message).toBe('Stored model results were lost');
		expect(after.features).toEqual(before.features);
		expect(after.hyperparameters).toEqual(before.hyperparameters);
		expect(after.completedSteps).toContain('configure-model');
		expect(after.completedSteps).not.toContain('results');
		await expect(results(page)).toHaveCount(0);
	});

	test('WML-P4-UI-10: a result deleted after View Results shows the lost state', async ({
		page
	}) => {
		await seedTrainedModel(page, 'breast-cancer', { acknowledge: false });
		await interceptResultReads(page, { outcome: 'missing', after: 1 });
		await page
			.getByTestId('training-step')
			.getByRole('button', { name: 'View Results' })
			.click();
		await expect(results(page)).toContainText('no longer available in this browser');
		await expect(results(page).getByRole('link', { name: /Train New Model/ })).toBeVisible();
		await expect(results(page).locator('app-results-summary')).toHaveCount(0);
	});

	test('WML-P4-UI-10: a read error shows an alert and Retry recovers', async ({ page }) => {
		await seedTrainedModel(page, 'breast-cancer', { acknowledge: false });
		await interceptResultReads(page, { outcome: 'fail', after: 1 });
		await page
			.getByTestId('training-step')
			.getByRole('button', { name: 'View Results' })
			.click();
		const alert = results(page).getByRole('alert');
		await expect(alert).toContainText('could not be read from this browser');
		await results(page).getByRole('button', { name: 'Retry' }).click();
		await expect(results(page).locator('app-results-summary')).toBeVisible({ timeout: 15_000 });
		await expect(results(page).getByRole('alert')).toHaveCount(0);
	});

	test('WML-P4-UI-11: the threshold and More metrics state survive reload', async ({ page }) => {
		await seedTrainedModel(page, 'breast-cancer');
		await waitForResults(page);
		await results(page).getByRole('slider', { name: 'Probability threshold' }).fill('70');
		await results(page).locator('app-results-summary summary').click();
		await expect
			.poll(async () => (await storedModel(page)).ui.results)
			.toEqual({ thresholdIndex: 70, moreMetricsOpen: true });
		await page.reload();
		await waitForResults(page);
		await expect(
			results(page).getByRole('slider', { name: 'Probability threshold' })
		).toHaveValue('70');
		await expect(results(page).locator('app-results-summary details')).toHaveJSProperty(
			'open',
			true
		);
		await expect(
			results(page).locator('app-threshold-explorer .readout dd').first()
		).toHaveText('70%');
	});

	test('WML-P4-UI-11: the class filter survives reload and whenSettled resolves after the charts draw', async ({
		page
	}) => {
		await seedTrainedModel(page, 'many-classes');
		await waitForResults(page);
		const matrix = results(page).locator('app-confusion-matrix');
		await matrix.getByLabel('Show true class').selectOption({ label: 'Class 7' });
		await expect(matrix.locator('tbody tr')).toHaveCount(1);
		await expect
			.poll(async () => (await storedModel(page)).ui.results)
			.toEqual({ classFilter: 6 });
		await page.reload();
		await settled(page);
		const drawn = await results(page)
			.locator('app-classee-strips')
			.evaluate((strips) => strips.shadowRoot!.querySelectorAll('svg rect').length);
		expect(drawn).toBeGreaterThan(0);
		await expect(matrix.getByLabel('Show true class')).toHaveValue('6');
		await expect(matrix.locator('tbody tr')).toHaveCount(1);
	});

	test('WML-P4-UI-11: scroll restoration lands on the same Section 6 block after reload', async ({
		page
	}) => {
		await seedTrainedModel(page, 'breast-cancer');
		await waitForResults(page);
		const explorer = results(page).locator('app-threshold-explorer');
		const savedTop = await explorer.evaluate((element) => {
			const top = Math.round(element.getBoundingClientRect().top + window.scrollY);
			window.scrollTo({ top, behavior: 'instant' });
			return Math.round(window.scrollY);
		});
		expect(savedTop).toBeGreaterThan(0);
		await expect
			.poll(() =>
				page.evaluate(() => {
					const raw = localStorage.getItem('samata-ml:scroll');
					const snapshot = raw
						? (JSON.parse(raw) as { snapshots: Record<string, { top: number }> })
								.snapshots['models/1']
						: undefined;
					return snapshot ? Math.round(snapshot.top) : null;
				})
			)
			.toBe(savedTop);
		await page.reload();
		await waitForResults(page);
		await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(savedTop);
	});

	test('WML-P4-UI-12: Section 6 has no horizontal overflow at 320 px', async ({ page }) => {
		await seedTrainedModel(page, 'many-classes');
		await waitForResults(page);
		await page.setViewportSize({ width: 320, height: 800 });
		await page.waitForTimeout(300);
		await settled(page);
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(overflow).toBeLessThanOrEqual(0);
	});

	test('WML-P4-UI-12: the threshold is keyboard operable in DOM order', async ({
		page,
		browserName
	}) => {
		test.skip(
			browserName === 'webkit',
			'Playwright WebKit does not move Tab focus onto range inputs; the slider is keyboard-tested after focus in WML-P4-UI-7'
		);
		await seedTrainedModel(page, 'breast-cancer');
		await waitForResults(page);
		const order: string[] = [];
		const active = () =>
			page.evaluate(() => {
				let node: Element | null = document.activeElement;
				while (node?.shadowRoot?.activeElement) node = node.shadowRoot.activeElement;
				return node
					? `${node.tagName.toLowerCase()}:${(node.getAttribute('aria-label') ?? node.textContent ?? '').trim().slice(0, 40)}`
					: '';
			});
		await results(page).locator('app-results-summary summary').focus();
		for (let step = 0; step < 40; step += 1) {
			order.push(await active());
			if (order.at(-1)!.startsWith('input:')) break;
			await page.keyboard.press('Tab');
		}
		expect(order.at(-1)!.startsWith('input:')).toBe(true);
		expect(order[0]).toContain('summary:More metrics');
		const before = Number(
			await results(page)
				.getByRole('slider')
				.evaluate((input) => (input as HTMLInputElement).value)
		);
		await page.keyboard.press('ArrowRight');
		await expect(results(page).getByRole('slider')).toHaveValue(String(before + 1));
	});

	test('WML-P4-UI-12: tables carry the chart values in forced colours', async ({
		page,
		browserName
	}) => {
		test.skip(browserName === 'webkit', 'WebKit does not emulate forced-colors in Playwright');
		await page.emulateMedia({ forcedColors: 'active' });
		await seedTrainedModel(page, 'breast-cancer');
		await waitForResults(page);
		for (const tag of ['app-fold-strip', 'app-threshold-explorer', 'app-reliability-diagram']) {
			const element = results(page).locator(tag);
			await element.locator('summary').click();
			await expect(element.locator('table')).toBeVisible();
			await expect(element.locator('tbody tr').first()).toBeVisible();
		}
		await expect(results(page).locator('app-confusion-flowchart .outcomes li')).toHaveCount(4);
		await expect(results(page).locator('app-confusion-flowchart .icon').first()).toBeVisible();
	});
});
