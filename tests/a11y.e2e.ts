import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { featureA11yFindings } from './a11y-feature-findings';
import { loadSampleDataset } from './journeys/helpers';
import { controlTraining, openSetup } from './fixtures/training/browser';
import { seedComparablePair, seedTrainedModel, type SeedName } from './helpers/seed-results';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];

test('TERM-AC-9: WML-P5-UI-12 populated comparison and open terms have no unexpected findings', async ({
	page
}) => {
	await seedComparablePair(page);
	await page.goto('/results');
	await expect(page.locator('app-results-view app-comparison-table')).toBeVisible();
	const terms = page.locator('app-results-view details.terms-disclosure');
	await terms.locator('summary').press('Enter');
	await expect(terms.locator('dl')).toBeVisible();
	await assertNoUnexpectedViolations(page);
});

async function createDraftForAxe(page: Page) {
	await page.goto('/data');
	await loadSampleDataset(page, 'iris');
	await page.locator('app-sidebar a[href="/target"]').click();
	const target = page.locator('app-target-view');
	await expect(target.getByTestId('target-ready')).toBeVisible();
	await target.locator('tbody tr:has(th:has-text("class")) button').click();
	await target.locator('header a[href="/models"]').click();
	await page.locator('app-models-view').getByRole('link', { name: 'Train New Model' }).click();
	await expect(page).toHaveURL('/models/new');
	return page.locator('app-model-builder-view');
}

async function openTrainingSetupForAxe(page: Page) {
	const builder = await createDraftForAxe(page);
	await builder
		.locator('app-model-card[model-id="logistic-regression"]')
		.getByRole('button', { name: 'Select Model: Logistic Regression', exact: true })
		.click();
	for (const step of [0, 1]) {
		await builder
			.locator('.train-step')
			.nth(step)
			.getByRole('button', { name: 'Continue', exact: true })
			.click();
	}
	await builder.getByRole('button', { name: 'Save & Continue' }).click();
	await expect(builder.locator('app-training-setup')).toBeVisible();
	return builder;
}

function trainingPanel(step: 4 | 5): string {
	return `section[aria-labelledby="step-${step}-title"]`;
}

async function assertTrainingPanelAccessibility(page: Page, steps: (4 | 5)[]) {
	const scoped = new AxeBuilder({ page });
	for (const step of steps) {
		scoped.include({ fromShadowDom: ['app-model-builder-view', trainingPanel(step)] });
	}
	const results = await scoped
		.options({
			runOnly: { type: 'tag', values: [...AXE_TAGS, 'wcag21a'] },
			rules: {
				'color-contrast': { enabled: true },
				'label-content-name-mismatch': { enabled: true }
			}
		})
		.analyze();
	expect(results.violations).toEqual([]);
	const checked = [...results.passes, ...results.incomplete, ...results.inapplicable].map(
		(result) => result.id
	);
	expect(checked).toContain('color-contrast');
	expect(checked).toContain('label-content-name-mismatch');
}

async function assertNoUnexpectedViolations(page: import('@playwright/test').Page) {
	const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
	const unexpected = [];
	for (const violation of results.violations) {
		for (const node of violation.nodes) {
			const known = featureA11yFindings.find(
				(finding) =>
					finding.rule === violation.id &&
					(JSON.stringify(finding.target) === JSON.stringify(node.target) ||
						finding.alternateTargets?.some(
							(target) => JSON.stringify(target) === JSON.stringify(node.target)
						))
			);
			if (known) {
				const canonical = page.locator(known.target[0]!.join(' '));
				await expect(canonical, known.owner).toHaveCount(1);
				const reportedPath = node.target[0];
				if (Array.isArray(reportedPath)) {
					// Firefox's axe selector can omit a qualifying attribute and match
					// several cells. Bind its exact HTML snapshot to the unique canonical
					// element rather than allowing every match of that selector.
					expect(
						await canonical.evaluate(
							(element, selector) => element.matches(selector),
							reportedPath.at(-1)!
						),
						known.owner
					).toBe(true);
					const actual = (await canonical.evaluate((element) => element.outerHTML))
						.replace(/<!--[\s\S]*?-->/g, '')
						.replace(/\s+/g, ' ')
						.trim();
					const reported = node.html
						.replace(/<!--[\s\S]*?-->/g, '')
						.replace(/\s+/g, ' ')
						.trim();
					expect(actual, known.owner).toBe(reported);
				}
				expect(
					node.any.find((check) => check.id === known.rule)?.data,
					known.owner
				).toMatchObject(known.data);
			} else
				unexpected.push({
					rule: violation.id,
					target: node.target,
					summary: node.failureSummary
				});
		}
	}

	expect(
		unexpected,
		`Unexpected accessibility violations found: ${JSON.stringify(unexpected, null, 2)}`
	).toEqual([]);
}

test('A11Y-E2E-CONTENT: the ready reserved-route dialog passes scoped WCAG checks including contrast', async ({
	page
}) => {
	await page.goto('/privacy');
	await expect(page.locator('app-content-modal h2')).toHaveText('Privacy Policy');
	const results = await new AxeBuilder({ page })
		.include('app-content-modal')
		.withTags(AXE_TAGS)
		.analyze();
	expect(results.violations).toEqual([]);
});

test.describe('Accessibility Audits (WCAG 2.2 AA)', () => {
	test.describe.configure({ mode: 'serial' });

	test('A11Y-E2E-1: Initial route /data with welcome modal open', async ({ page }) => {
		await page.goto('/data');
		await page.locator('app-welcome-modal dialog[open]').waitFor({ timeout: 5000 });
		await assertNoUnexpectedViolations(page);
	});

	test('A11Y-E2E-2: Route /data with welcome modal dismissed', async ({ page }) => {
		await page.goto('/data');
		const getStartedBtn = page.locator('app-welcome-modal button.btn-primary');
		await getStartedBtn.waitFor({ timeout: 5000 });
		await getStartedBtn.click();
		await page.locator('app-welcome-modal dialog').waitFor({ state: 'hidden', timeout: 5000 });
		await assertNoUnexpectedViolations(page);
	});

	test('A11Y-E2E-3: Route /data in preview mode', async ({ page }) => {
		await page.goto('/data');
		const getStartedBtn = page.locator('app-welcome-modal button.btn-primary');
		try {
			await getStartedBtn.waitFor({ state: 'visible', timeout: 2000 });
			await getStartedBtn.click();
			await page
				.locator('app-welcome-modal dialog')
				.waitFor({ state: 'hidden', timeout: 2000 });
		} catch {}

		const irisCard = page.locator('app-dataset-card[dataset-id="iris"]');
		await irisCard.waitFor({ state: 'visible', timeout: 5000 });
		await irisCard.locator('button.btn-primary').click();

		const preview = page.locator('app-dataset-preview');
		await expect(preview).toBeVisible({ timeout: 10000 });

		await assertNoUnexpectedViolations(page);
	});

	test('A11Y-E2E-4: Route /data with column inspector open', async ({ page }) => {
		await page.goto('/data');
		const getStartedBtn = page.locator('app-welcome-modal button.btn-primary');
		try {
			await getStartedBtn.waitFor({ state: 'visible', timeout: 2000 });
			await getStartedBtn.click();
			await page
				.locator('app-welcome-modal dialog')
				.waitFor({ state: 'hidden', timeout: 2000 });
		} catch {}

		const irisCard = page.locator('app-dataset-card[dataset-id="iris"]');
		await irisCard.waitFor({ state: 'visible', timeout: 5000 });
		await irisCard.locator('button.btn-primary').click();

		const preview = page.locator('app-dataset-preview');
		await expect(preview).toBeVisible({ timeout: 10000 });

		const sepalLengthBtn = preview.locator('.header-btn[data-col-key="sepal length"]');
		await sepalLengthBtn.click();

		const aside = page.locator('app-column-details aside.overlay');
		await expect(aside).toBeVisible();

		await assertNoUnexpectedViolations(page);
	});

	test('A11Y-E2E-5: Route /data with datasheet modal open', async ({ page }) => {
		await page.goto('/data');
		const getStartedBtn = page.locator('app-welcome-modal button.btn-primary');
		try {
			await getStartedBtn.waitFor({ state: 'visible', timeout: 2000 });
			await getStartedBtn.click();
			await page
				.locator('app-welcome-modal dialog')
				.waitFor({ state: 'hidden', timeout: 2000 });
		} catch {}

		const irisCard = page.locator('app-dataset-card[dataset-id="iris"]');
		await irisCard.getByRole('button', { name: 'Load Dataset' }).click();
		await page
			.locator('app-dataset-preview')
			.getByRole('button', { name: 'Change Dataset', exact: true })
			.click();
		await page
			.getByRole('dialog', { name: 'Change Dataset' })
			.getByRole('button', { name: 'Change Dataset', exact: true })
			.click();
		await irisCard.waitFor({ state: 'visible', timeout: 5000 });
		await irisCard.locator('button:has-text("Datasheet")').click();

		const dialog = page.locator('app-datasheet-dialog dialog[open]');
		await expect(dialog).toBeVisible();

		await assertNoUnexpectedViolations(page);
	});

	test('A11Y-E2E-6: Route /data with upload modal open', async ({ page }) => {
		await page.goto('/data');
		const getStartedBtn = page.locator('app-welcome-modal button.btn-primary');
		try {
			await getStartedBtn.waitFor({ state: 'visible', timeout: 2000 });
			await getStartedBtn.click();
			await page
				.locator('app-welcome-modal dialog')
				.waitFor({ state: 'hidden', timeout: 2000 });
		} catch {}

		const uploadBtn = page.locator('header.page-header button:has-text("Upload Dataset")');
		await uploadBtn.waitFor({ state: 'visible', timeout: 5000 });
		await uploadBtn.click();

		const dialog = page.locator('app-upload-dataset-dialog dialog[open]');
		await expect(dialog).toBeVisible();

		await assertNoUnexpectedViolations(page);
	});

	test('A11Y-E2E-7: Route /target in blocked state', async ({ page }) => {
		await page.goto('/target');
		const getStartedBtn = page.locator('app-welcome-modal button.btn-primary');
		try {
			await getStartedBtn.waitFor({ state: 'visible', timeout: 2000 });
			await getStartedBtn.click();
			await page
				.locator('app-welcome-modal dialog')
				.waitFor({ state: 'hidden', timeout: 2000 });
		} catch {}

		await expect(page.locator('app-target-view [data-testid="target-blocked"]')).toBeVisible();
		await assertNoUnexpectedViolations(page);
	});

	test('A11Y-E2E-8: Route /target in ready state', async ({ page }) => {
		await page.goto('/data');
		const getStartedBtn = page.locator('app-welcome-modal button.btn-primary');
		try {
			await getStartedBtn.waitFor({ state: 'visible', timeout: 2000 });
			await getStartedBtn.click();
			await page
				.locator('app-welcome-modal dialog')
				.waitFor({ state: 'hidden', timeout: 2000 });
		} catch {}

		const irisCard = page.locator('app-dataset-card[dataset-id="iris"]');
		await irisCard.waitFor({ state: 'visible', timeout: 5000 });
		await irisCard.locator('button.btn-primary').click();
		await page.locator('app-dataset-preview').waitFor({ state: 'attached', timeout: 5000 });

		await page.locator('app-sidebar a[href="/target"]').click();
		await expect(page.locator('app-target-view [data-testid="target-ready"]')).toBeVisible({
			timeout: 10000
		});
		await assertNoUnexpectedViolations(page);
	});

	test('A11Y-E2E-9: Route /target with model warning and confirm modal open', async ({
		page
	}) => {
		await page.goto('/data');
		const getStartedBtn = page.locator('app-welcome-modal button.btn-primary');
		try {
			await getStartedBtn.waitFor({ state: 'visible', timeout: 2000 });
			await getStartedBtn.click();
			await page
				.locator('app-welcome-modal dialog')
				.waitFor({ state: 'hidden', timeout: 2000 });
		} catch {}

		const irisCard = page.locator('app-dataset-card[dataset-id="iris"]');
		await irisCard.waitFor({ state: 'visible', timeout: 5000 });
		await irisCard.locator('button.btn-primary').click();
		await page.locator('app-dataset-preview').waitFor({ state: 'attached', timeout: 5000 });

		await page.goto('/target');
		const targetView = page.locator('app-target-view');
		await expect(targetView.locator('[data-testid="target-ready"]')).toBeVisible({
			timeout: 10000
		});

		// Set initial target
		const classRow = targetView.locator('tbody tr:has(th:has-text("class"))');
		await classRow.locator('button').click();
		await expect(classRow.locator('button')).toHaveText('Current Target');
		await targetView.locator('header a[href="/models"]').click();
		await page
			.locator('app-models-view')
			.getByRole('link', { name: 'Train New Model' })
			.click();
		await expect(page).toHaveURL('/models/new');
		await page.locator('app-sidebar a[href="/target"]').click();

		// Click different target to open confirm dialog
		const sepalLengthRow = targetView.locator('tbody tr:has(th:has-text("sepal length"))');
		await sepalLengthRow.locator('button').click();
		const dialog = targetView.locator('dialog.confirm-dialog[open]');
		await expect(dialog).toBeVisible();

		await assertNoUnexpectedViolations(page);
	});

	test('A11Y-E2E-10: Route /models in blocked state', async ({ page }) => {
		await page.goto('/models');
		const getStartedBtn = page.locator('app-welcome-modal button.btn-primary');
		try {
			await getStartedBtn.waitFor({ state: 'visible', timeout: 2000 });
			await getStartedBtn.click();
			await page
				.locator('app-welcome-modal dialog')
				.waitFor({ state: 'hidden', timeout: 2000 });
		} catch {}

		await expect(page.locator('app-models-view [data-testid="models-blocked"]')).toBeVisible();
		await assertNoUnexpectedViolations(page);
	});

	test('A11Y-E2E-11: Route /models in empty state', async ({ page }) => {
		await page.goto('/data');
		const getStartedBtn = page.locator('app-welcome-modal button.btn-primary');
		try {
			await getStartedBtn.waitFor({ state: 'visible', timeout: 2000 });
			await getStartedBtn.click();
			await page
				.locator('app-welcome-modal dialog')
				.waitFor({ state: 'hidden', timeout: 2000 });
		} catch {}

		const irisCard = page.locator('app-dataset-card[dataset-id="iris"]');
		await irisCard.waitFor({ state: 'visible', timeout: 5000 });
		await irisCard.locator('button.btn-primary').click();
		await page.locator('app-dataset-preview').waitFor({ state: 'attached', timeout: 5000 });

		await page.goto('/target');
		const targetView = page.locator('app-target-view');
		await expect(targetView.locator('[data-testid="target-ready"]')).toBeVisible({
			timeout: 10000
		});
		const classTarget = targetView.locator('tbody tr:has(th:has-text("class")) button');
		await classTarget.click();
		await expect(classTarget).toHaveText('Current Target');

		await page.goto('/models');
		const modelsView = page.locator('app-models-view');
		await expect(modelsView.locator('[data-testid="models-empty"]')).toBeVisible({
			timeout: 10000
		});
		await expect(modelsView).toContainText('No models yet. Train a new model to get started.');

		await assertNoUnexpectedViolations(page);
	});

	test('A11Y-E2E-12: Route /models in populated state', async ({ page }) => {
		await openSetup(page, false);
		await page.locator('app-sidebar a[href="/models"]').click();
		const modelsView = page.locator('app-models-view');
		await expect(modelsView.locator('table.table')).toBeVisible({ timeout: 10000 });

		await assertNoUnexpectedViolations(page);
	});

	test('A11Y-E2E-13: Route /models/:num in Choose Model active state', async ({ page }) => {
		const builder = await createDraftForAxe(page);
		await expect(builder.locator('.train-step[aria-current="step"]')).toBeVisible({
			timeout: 10000
		});

		await assertNoUnexpectedViolations(page);
	});

	test('A11Y-E2E-14: Route /models/:num in Select Features active state', async ({ page }) => {
		const builder = await createDraftForAxe(page);
		await builder
			.locator('app-model-card[model-id="logistic-regression"]')
			.getByRole('button', { name: 'Select Model: Logistic Regression', exact: true })
			.click();
		await builder
			.locator('.train-step')
			.first()
			.getByRole('button', { name: 'Continue', exact: true })
			.click();
		await expect(builder.locator('table.table')).toBeVisible({ timeout: 10000 });

		await assertNoUnexpectedViolations(page);
	});

	test('A11Y-E2E-15: Route /models/:num with model description dialog open', async ({ page }) => {
		const builder = await createDraftForAxe(page);
		const descBtn = builder.locator(
			'app-model-card[model-id="logistic-regression"] button:has-text("Model Description")'
		);
		await expect(descBtn).toBeVisible({ timeout: 10000 });
		await descBtn.click();

		const dialog = builder.locator('app-model-description-dialog dialog[open]');
		await expect(dialog).toBeVisible({ timeout: 5000 });

		await assertNoUnexpectedViolations(page);
	});

	test('WML-P3-UI-3 / A11Y-E2E-16: acknowledged Training Setup and the live training panel', async ({
		page
	}) => {
		await controlTraining(page);
		const builder = await openTrainingSetupForAxe(page);
		await builder
			.locator('app-training-setup')
			.getByRole('button', { name: 'Train Model' })
			.click();
		const setup = builder.locator(trainingPanel(4));
		await expect(setup.getByRole('heading', { name: '4. One-Shot (80% / 20%)' })).toBeVisible();
		const training = builder.locator(trainingPanel(5));
		await expect(
			training.getByRole('progressbar', { name: 'Training progress' })
		).toBeVisible();
		await expect(training.getByRole('button', { name: 'Cancel Training' })).toBeEnabled();
		await expect(training.getByRole('button', { name: 'View Results' })).toBeDisabled();
		await page.locator('app-sidebar a[href="/help"]').click();
		await expect(page.getByRole('dialog', { name: 'Help' })).toBeVisible();
		await page.evaluate(() => history.go(-2));
		await expect(page).toHaveURL('/models');
		await page.locator('app-models-view').getByRole('link', { name: 'Continue' }).click();
		await expect(
			training.getByRole('progressbar', { name: 'Training progress' })
		).toBeVisible();
		await assertTrainingPanelAccessibility(page, [5]);
	});

	test('WML-P2-UI-11 / A11Y-E2E-17: Training Setup Retry', async ({ page }) => {
		const builder = await openTrainingSetupForAxe(page);
		await page.evaluate(() => {
			const resources = window.__datasetResources!;
			resources.set({
				...resources.get(),
				status: 'error',
				metadata: null,
				error: 'Metadata could not be read'
			});
		});
		const setup = builder.locator(trainingPanel(4));
		await expect(setup).toBeVisible();
		await expect(setup.getByRole('alert')).toContainText('dataset metadata could not be read');
		await expect(setup.getByRole('button', { name: 'Retry' })).toBeVisible();
		await assertTrainingPanelAccessibility(page, [4]);
	});

	for (const [id, seed, label] of [
		['A11Y-E2E-18', 'breast-cancer', 'binary'],
		['A11Y-E2E-19', 'iris', 'multiclass']
	] as const satisfies readonly (readonly [string, SeedName, string])[]) {
		test(`WML-P4-UI-12 / ${id}: populated ${label} Section 6 with every data table open`, async ({
			page
		}) => {
			await seedTrainedModel(page, seed);
			const results = page.locator('app-model-results');
			await expect(results.locator('app-results-summary')).toBeVisible({ timeout: 15_000 });
			await page
				.locator('app-model-builder-view')
				.evaluate((builder) =>
					(builder as unknown as { whenSettled(): Promise<void> }).whenSettled()
				);
			// Open every native disclosure, in any nested shadow root, so tables are scanned too.
			await page.evaluate(() => {
				const open = (root: ParentNode) => {
					for (const node of root.querySelectorAll('*')) {
						if (node instanceof HTMLDetailsElement) node.open = true;
						if (node.shadowRoot) open(node.shadowRoot);
					}
				};
				open(document);
			});
			await expect(results.locator('.terms-disclosure dl')).toBeVisible();
			const audit = await new AxeBuilder({ page })
				.include({
					fromShadowDom: [
						'app-model-builder-view',
						'section[aria-labelledby="step-6-title"]'
					]
				})
				.options({
					runOnly: { type: 'tag', values: [...AXE_TAGS, 'wcag21a'] },
					rules: { 'color-contrast': { enabled: true } }
				})
				.analyze();
			expect(audit.violations).toEqual([]);
			const checked = [...audit.passes, ...audit.incomplete, ...audit.inapplicable].map(
				(result) => result.id
			);
			expect(checked).toContain('color-contrast');
		});
	}
});
