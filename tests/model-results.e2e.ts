import { expect, test, type Locator, type Page } from '@playwright/test';
import type { PersistedAppState } from '../src/types/state';
import { divergentBinaryCrossValidation } from './fixtures/results/evaluations';
import {
	deleteEnvelope,
	downgradeEnvelope,
	interceptResultReads,
	payloadFor,
	replyWithEvaluation,
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
	test('BETA-ERR-3: saved results settle after navigation without a Lit lifecycle warning', async ({
		page
	}) => {
		const warnings: string[] = [];
		page.on('console', (message) => {
			const text = message.text();
			if (text.includes('app-model-results') && text.includes('change-in-update'))
				warnings.push(text);
		});
		await seedTrainedModel(page, 'iris');
		await settled(page);
		await expect(results(page).locator('app-results-summary')).toBeVisible();

		await page.locator('app-sidebar a[href="/models"]').click();
		await page.goBack();
		await settled(page);
		await expect(results(page).locator('app-results-summary')).toBeVisible();
		await page.reload();
		await settled(page);
		await expect(results(page).locator('app-results-summary')).toBeVisible();
		expect(warnings).toEqual([]);
	});

	test.describe('Result terms', () => {
		test.use({ hasTouch: true });

		test('TERM-AC-6: One-Shot and cross-validation have one native terms disclosure', async ({
			page
		}) => {
			await seedTrainedModel(page, 'breast-cancer');
			await waitForResults(page);
			const host = results(page);
			const disclosure = host.locator('details.terms-disclosure');
			const summary = disclosure.locator('summary');
			await expect(disclosure).toHaveCount(1);
			await expect(summary).toHaveText('What do these results terms mean?');
			await expect(disclosure).toHaveJSProperty('open', false);
			await expect(
				host.locator('app-results-summary + details.terms-disclosure')
			).toHaveCount(1);
			await summary.focus();
			await summary.click();
			await expect(disclosure).toHaveJSProperty('open', true);
			await summary.press('Space');
			await expect(disclosure).toHaveJSProperty('open', false);
			await expect(summary).toBeFocused();
			await summary.tap();
			await expect(disclosure).toHaveJSProperty('open', true);
			await summary.tap();
			await expect(disclosure).toHaveJSProperty('open', false);
			await summary.press('Enter');
			await expect(summary).toBeFocused();
			await expect(
				disclosure.getByText(
					'Rows left out of training for the model that made those predictions.',
					{ exact: true }
				)
			).toBeVisible();
			await expect(
				disclosure.getByText(
					'Find the share of rows correctly predicted within each class, then average those shares so each class counts equally.',
					{ exact: true }
				)
			).toBeVisible();
			await expect(
				disclosure.locator('dfn').filter({ hasText: 'Probability threshold' })
			).toBeVisible();
			await expect(disclosure.getByText('Mean across folds', { exact: true })).toHaveCount(0);
		});
	});

	test('TERM-AC-6: the CV headline and train–test gap retain the fold mean', async ({ page }) => {
		const payload = payloadFor(divergentBinaryCrossValidation());
		expect(payload).toMatchObject({
			strategy: 'cross_validation',
			crossValidation: {
				folds: [{ score: 2 / 3 }, { score: 1 }],
				diagnostics: { precision: 0.875, recall: expect.closeTo(5 / 6, 7) },
				meanScore: expect.closeTo(5 / 6, 12),
				standardDeviation: expect.closeTo(1 / 6, 12)
			}
		});
		await seedTrainedModel(page, 'divergent-binary-cv');
		await waitForResults(page);
		const host = results(page);
		const scores = host.locator('app-results-summary');
		await expect(scores.locator('.headline .primary .value')).toHaveText(/^75%/);
		await expect(scores.locator('.notification')).toContainText('25 percentage points lower');
		const disclosure = host.locator('details.terms-disclosure');
		await expect(disclosure).toHaveJSProperty('open', false);
		await disclosure.locator('summary').click();
		await expect(disclosure.getByText('Mean across folds', { exact: true })).toBeVisible();
		await expect(disclosure.getByText('Probability threshold', { exact: true })).toBeVisible();
		await expect(disclosure.getByText('Pooled held-out score', { exact: true })).toHaveCount(0);
	});

	test('TERM-AC-8: expansions are visible independently of More metrics and chart tables', async ({
		page
	}) => {
		await seedTrainedModel(page, 'svc-no-probabilities');
		await waitForResults(page);
		const host = results(page);
		const disclosure = host.locator('details.terms-disclosure');
		const more = host.locator('app-results-summary details');
		const chartTable = host.locator('app-fold-strip details');
		await disclosure.locator('summary').click();
		await expect(more).toHaveJSProperty('open', false);
		await expect(chartTable).toHaveJSProperty('open', false);
		for (const [term, expansion] of [
			['MCC', 'Matthews correlation coefficient'],
			['ROC-AUC', 'Area under the receiver operating characteristic curve'],
			['ECE', 'Expected calibration error']
		] as const) {
			const acronym = disclosure.locator('abbr').filter({ hasText: new RegExp(`^${term}$`) });
			await expect(acronym).toHaveAttribute('title', expansion);
			await acronym.evaluate((element) => element.removeAttribute('title'));
			await expect(disclosure.locator('dd').filter({ hasText: expansion })).toBeVisible();
		}
		await expect(disclosure.locator('abbr')).toHaveCount(3);
		await more.locator('summary').click();
		await expect(more).toContainText(
			'Unavailable because this model was trained without probability estimates.'
		);
		await chartTable.locator('summary').click();
		await expect(chartTable.getByRole('table')).toBeVisible();
		await expect(disclosure).toHaveJSProperty('open', true);
		await page.reload();
		await waitForResults(page);
		await expect(disclosure).toHaveJSProperty('open', false);
		await expect(more).toHaveJSProperty('open', true);
	});

	test('WML-P4-UI-10: a seeded binary model shows every shared section in order', async ({
		page
	}) => {
		await seedTrainedModel(page, 'breast-cancer');
		await waitForResults(page);
		expect(await blocks(page)).toEqual([
			'h3:Scores on held-out rows',
			'app-results-summary',
			'details',
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
		await expect(
			page.getByRole('heading', { level: 1, name: 'Model 1 Results' })
		).toBeVisible();
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
			'details',
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
		await expect(
			results(page)
				.locator('.terms-disclosure')
				.getByText('Probability threshold', { exact: true })
		).toHaveCount(0);
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

	test('WML-P4-UI-10: a valid version 1 envelope opens numbered results with the legacy message and Models link', async ({
		page
	}) => {
		await seedTrainedModel(page, 'iris');
		await waitForResults(page);
		await downgradeEnvelope(page);
		await page.reload();
		await expect(
			page.getByRole('heading', { level: 1, name: 'Model 1 Results' })
		).toBeVisible();
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
		await interceptResultReads(page, { outcome: 'missing', after: 2 });
		await page
			.getByTestId('training-step')
			.getByRole('button', { name: 'View Results' })
			.click();
		await expect(results(page)).toContainText('no longer available in this browser');
		await expect(results(page).getByRole('link', { name: /Train New Model/ })).toBeVisible();
		await expect(results(page).locator('app-results-summary')).toHaveCount(0);
	});

	test('MW-ROUTE-2: a lost provisional result cannot route to a later numbered rerun', async ({
		page
	}) => {
		await seedTrainedModel(page, 'breast-cancer', { acknowledge: false });
		await expect(page).toHaveURL('/models/new');
		const original = (await storedModel(page)).resultRevision;
		expect(original).toBeTruthy();
		expect((await storedModel(page)).provisionalCompletedRunId).toBe(original);
		await deleteEnvelope(page);
		await page.reload();
		const recovery = page.getByTestId('provisional-route');
		await expect(recovery.getByRole('link', { name: 'Back to Models' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'View Results' })).toHaveCount(0);

		await recovery.getByRole('link', { name: 'Back to Models' }).click();
		await page.locator('app-models-view').getByRole('link', { name: 'Continue' }).click();
		await expect(page).toHaveURL('/models/1');
		await page.getByRole('button', { name: 'Train Model' }).press('Enter');
		await expect
			.poll(() =>
				page.evaluate(
					() =>
						window.__trainingFixture!.requests.filter(({ kind }) => kind === 'start')
							.length
				)
			)
			.toBe(1);
		await replyWithEvaluation(page, 'breast-cancer');
		await waitForResults(page);
		const rerun = await storedModel(page);
		expect(rerun.resultRevision).not.toBe(original);
		expect(rerun.provisionalCompletedRunId).toBe(original);

		await page.goBack();
		await page.goBack();
		await expect(page).toHaveURL('/models/new');
		await expect(recovery.getByRole('link', { name: 'Back to Models' })).toBeVisible();
		await page.locator('app-sidebar a[href="/help"]').click();
		await page.reload();
		await page.getByRole('button', { name: 'Close', exact: true }).click();
		await expect(page).toHaveURL('/models/new');
		await expect(recovery.getByRole('link', { name: 'Back to Models' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'View Results' })).toHaveCount(0);
	});

	test('WML-P4-UI-10: a read error shows an alert and Retry recovers', async ({ page }) => {
		await seedTrainedModel(page, 'breast-cancer', { acknowledge: false });
		await interceptResultReads(page, { outcome: 'fail', after: 2 });
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

	test('TERM-AC-9: WML-P4-UI-12 Section 6 reflows with the terms disclosure open', async ({
		page,
		browserName
	}) => {
		await seedTrainedModel(page, 'many-classes');
		await waitForResults(page);
		await page.setViewportSize({ width: 320, height: 800 });
		const disclosure = results(page).locator('details.terms-disclosure');
		const summary = disclosure.locator('summary');
		await summary.press('Enter');
		await settled(page);
		await expect(disclosure.locator('dl')).toBeVisible();
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(overflow).toBeLessThanOrEqual(0);
		await page.setViewportSize({ width: 640, height: 800 });
		await page.evaluate(() => {
			document.documentElement.dir = 'rtl';
			document.documentElement.style.zoom = '2';
		});
		if (browserName !== 'webkit') await page.emulateMedia({ forcedColors: 'active' });
		if (browserName === 'firefox') {
			await page.keyboard.press('Shift+Tab');
			await page.keyboard.press('Tab');
		}
		await expect(summary).toBeFocused();
		const target = await summary.evaluate((element) => ({
			inline: element.clientWidth,
			block: element.clientHeight,
			overflow: element.scrollWidth - element.clientWidth,
			outline: getComputedStyle(element).outlineStyle
		}));
		expect(target.inline).toBeGreaterThanOrEqual(24);
		expect(target.block).toBeGreaterThanOrEqual(24);
		expect(target.overflow).toBeLessThanOrEqual(1);
		expect(target.outline).toBe('solid');
		await expect(disclosure.locator('dl')).toBeVisible();
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth
			)
		).toBeLessThanOrEqual(1);
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
