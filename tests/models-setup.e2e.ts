import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator } from '@playwright/test';
import { DIST_URL } from '../scripts/ports';
import { interceptSampleDownload } from './fixtures/sample-dataset-downloads';
import { controlTraining, openSetup } from './fixtures/training/browser';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];

const CLASSIFIER_ARTWORK = [
	['bernoulli-nb', 'bernoulli-naive-bayes'],
	['gaussian-nb', 'gaussian-naive-bayes'],
	['multinomial-nb', 'multinomial-naive-bayes'],
	['k-neighbors-classifier', 'k-nearest-neighbours-classifier'],
	['logistic-regression', 'logistic-regression'],
	['mlp-classifier', 'mlp-classifier'],
	['support-vector-classifier', 'support-vector-classifier'],
	['decision-tree-classifier', 'decision-tree-classifier']
] as const;

test.describe('Contextual wizard Help', () => {
	test.use({ hasTouch: true, baseURL: DIST_URL });

	test('MW-HELP-2 / MW-HELP-1: each Help link opens its article and preserves the current step', async ({
		page
	}) => {
		test.setTimeout(60_000);
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/data');
		const welcome = page.locator('app-welcome-modal').getByRole('dialog');
		await welcome.getByRole('button', { name: 'Get Started' }).click();
		await expect(welcome).toBeHidden();
		await page.locator('app-dataset-card[dataset-id="iris"] button.btn-primary').click();
		await expect(page.locator('app-dataset-preview')).toBeAttached();
		await page.goto('/target');
		const target = page.locator('app-target-view');
		await expect(target.getByTestId('target-ready')).toBeVisible();
		const classTarget = target.locator('tbody tr:has(th:has-text("class")) button');
		await classTarget.click();
		await expect(classTarget).toHaveText('Current Target');
		await page.goto('/models');
		await page
			.locator('app-models-view')
			.getByRole('link', { name: 'Train New Model' })
			.click();

		const builder = page.locator('app-model-builder-view');
		await builder
			.locator('app-model-card[model-id="logistic-regression"]')
			.getByRole('button', { name: 'Select Model' })
			.click();
		const source = await page.evaluate(() => history.state.entryId);
		const modal = page.locator('app-content-modal').getByRole('dialog');
		const article = modal.locator('.modal-content');
		const readDraft = () =>
			page.evaluate(() => {
				const state = window.__appState!.get();
				return state.models.find((model) => model.num === state.newModelNum);
			});

		async function exerciseHelp(
			stepTitle: string,
			topic: string,
			title: string,
			verifyArticle: () => Promise<void>,
			verifyForm: () => Promise<void>
		): Promise<void> {
			const link = builder.locator(`h2#${stepTitle} .help-link`);
			await expect(link).toHaveAttribute('href', topic);
			const draft = await readDraft();
			expect(draft).toBeDefined();

			for (const mode of ['mouse', 'keyboard', 'touch'] as const) {
				if (mode === 'mouse') await link.click();
				else if (mode === 'keyboard') await link.press('Enter');
				else await link.tap();
				await expect(page).toHaveURL(topic);
				await expect(modal).toHaveAccessibleName(title);
				expect(await page.evaluate(() => history.state.underlayEntryId)).toBe(source);
				expect(await page.evaluate(() => history.state.underlayPath)).toBe('/models/new');
				await verifyArticle();

				if (mode === 'mouse') await modal.getByRole('button', { name: 'Close' }).click();
				else if (mode === 'keyboard') await page.keyboard.press('Escape');
				else await page.goBack();
				await expect(page).toHaveURL('/models/new');
				await expect(modal).toBeHidden();
				await expect(link).toBeFocused();
				await expect(builder.locator('[aria-current="step"] h2')).toHaveAttribute(
					'id',
					stepTitle
				);
				expect(await page.evaluate(() => history.state.entryId)).toBe(source);
				expect(await readDraft()).toEqual(draft);
				await verifyForm();
			}
		}

		const feature = builder.getByRole('checkbox', { name: 'Include sepal length' });
		await feature.uncheck();
		await exerciseHelp(
			'step-2-title',
			'/help/select-features',
			'What are features?',
			async () => {
				await expect(article).toContainText('the column you want the model to predict');
				await expect(article).toContainText('petal length and petal width');
				await expect(
					article.getByRole('heading', { name: 'Watch out for data leakage' })
				).toBeVisible();
			},
			async () => {
				await expect(feature).not.toBeChecked();
			}
		);
		await builder.getByRole('button', { name: 'Continue', exact: true }).click();

		const configuration = builder.locator('app-model-configuration');
		await configuration.locator('select#penalty').selectOption('l2');
		const regularisation = configuration.locator('#C-number');
		await regularisation.fill('0.00');
		await exerciseHelp(
			'step-3-title',
			'/help/configure-model',
			'What do these settings mean?',
			async () => {
				await expect(article).toContainText(
					'The exact stopping check depends on the solver.'
				);
			},
			async () => {
				await expect(regularisation).toHaveValue('0.00');
				await expect(regularisation).toHaveAttribute('aria-invalid', 'true');
			}
		);
		await regularisation.fill('1');
		await configuration.getByRole('button', { name: 'Save & Continue' }).click();

		const setup = builder.locator('app-training-setup');
		await setup.getByRole('combobox').selectOption('nested_cv');
		const folds = setup.getByRole('spinbutton');
		await folds.fill('11');
		await exerciseHelp(
			'step-4-title',
			'/help/training-setup',
			'Training Setup',
			async () => {
				const tradeOffs = article.getByRole('table');
				await expect(
					tradeOffs.getByRole('columnheader', { name: 'Benefits' })
				).toBeVisible();
				await expect(
					tradeOffs.getByRole('columnheader', { name: 'Drawbacks' })
				).toBeVisible();
				await expect(tradeOffs.getByRole('row', { name: /^One-Shot/ })).toContainText(
					'depends on which rows land in the single test group'
				);
				await expect(
					tradeOffs.getByRole('row', { name: /^Cross-Validation/ })
				).toContainText('Trains several times');
			},
			async () => {
				await expect(folds).toHaveValue('11');
				await expect(folds).toHaveAttribute('aria-invalid', 'true');
			}
		);
	});
});

test('MW-STEP-2: a failed save keeps the form and the exact committed candidate replays once', async ({
	page
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await controlTraining(page);
	await openSetup(page, false);
	const builder = page.locator('app-model-builder-view');
	const configuration = builder.locator('app-model-configuration');
	const maximumIterations = configuration.getByRole('spinbutton', {
		name: 'Maximum iterations (exact value)'
	});
	await maximumIterations.fill('900');
	const save = configuration.getByRole('button', { name: 'Save & Continue' });
	const generation = await page.evaluate(() => window.__appState!.get().trainingDomainGeneration);
	await page.evaluate(() => {
		window.__trainingFixture!.blockRead = true;
	});
	await save.click();
	await expect(builder.getByRole('alert')).toContainText('This step could not be saved');
	await expect(maximumIterations).toHaveValue('900');
	await expect(builder.locator('.step-active h2')).toHaveAttribute('id', 'step-3-title');

	await page.evaluate(() => {
		window.__trainingFixture!.blockRead = false;
		window.__trainingFixture!.blockPublication = 'wizard';
	});
	await save.click();
	const retry = builder.getByRole('button', { name: 'Retry Saving' });
	await expect(retry).toBeVisible();
	await expect(maximumIterations).toHaveValue('900');
	await expect(builder.locator('.step-active h2')).toHaveAttribute('id', 'step-3-title');
	expect(await page.evaluate(() => window.__appState!.get().trainingDomainGeneration)).toBe(
		generation
	);

	await page.evaluate(() => {
		window.__trainingFixture!.blockPublication = null;
	});
	await retry.click();
	await expect(builder.locator('#step-4-title')).toBeFocused();
	await expect(builder.locator('.step-active .train-step-content[inert]')).toHaveCount(0);
	expect(await page.evaluate(() => window.__appState!.get().trainingDomainGeneration)).toBe(
		generation + 1
	);
	await page.reload();
	await expect(builder.locator('.step-active h2')).toHaveAttribute('id', 'step-4-title');
});

async function expectIllustratedCatalogue(step: Locator) {
	const cards = step.locator('ul.cards-grid[role="list"] > li > app-model-card');
	await expect(cards).toHaveCount(CLASSIFIER_ARTWORK.length);
	for (const [index, [id, artwork]] of CLASSIFIER_ARTWORK.entries()) {
		const card = cards.nth(index);
		await expect(card).toHaveAttribute('model-id', id);
		const image = card.locator('img[slot="image"]');
		await expect(image).toHaveCount(1);
		await expect(image).toHaveAttribute('src', '/assets/' + artwork + '.svg');
		await expect(image).toHaveAttribute('alt', '');
		expect(
			await image.evaluate(async (img: HTMLImageElement) => {
				await img.decode();
				return [img.naturalWidth, img.naturalHeight];
			})
		).toEqual([360, 216]);

		const heading = (await card.getByRole('heading', { level: 3 }).innerText()).trim();
		for (const label of ['Model Description', 'Select Model']) {
			await expect(
				card.getByRole('button', { name: label + ': ' + heading, exact: true })
			).toHaveText(label);
		}
	}
}

test.describe('Model Builder Setup (MOD-SETUP-1 .. MOD-SETUP-4)', () => {
	let assertDownload: () => void;
	test.beforeEach(async ({ page }) => {
		assertDownload = await interceptSampleDownload(page.context(), 'palmer-penguins');
		await page.goto('/data');
		// Dismiss welcome modal if open
		const getStartedBtn = page.locator('app-welcome-modal button.btn-primary');
		try {
			await getStartedBtn.waitFor({ state: 'visible', timeout: 2000 });
			await getStartedBtn.click();
			await page
				.locator('app-welcome-modal dialog')
				.waitFor({ state: 'hidden', timeout: 2000 });
		} catch {
			// Already dismissed
		}

		// Reset state to initial clean state
		await page.evaluate(() => {
			const s = window.__appState?.get();
			if (s) {
				window.__appState?.set({
					...s,
					dataset: null,
					target: null,
					models: [],
					nextModelNum: 1,
					resumePath: '/data',
					data: { mode: 'select', selectedColumn: null }
				});
			}
		});
		await expect
			.poll(() =>
				page.evaluate(() => {
					const raw = localStorage.getItem('samata-ml:state');
					if (!raw) return false;
					const parsed = JSON.parse(raw) as {
						onboarding?: { welcomeDismissed?: boolean };
						dataset?: unknown;
					};
					return parsed.onboarding?.welcomeDismissed === true && parsed.dataset === null;
				})
			)
			.toBe(true);
		await page.reload();
	});

	test('MW-STEP-1 / MOD-SETUP-1: selecting saves defaults, closes before opening and survives reload', async ({
		page
	}) => {
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		// 1. Setup dataset and target
		const irisCard = page.locator('app-dataset-card[dataset-id="iris"]');
		await irisCard.waitFor({ state: 'visible', timeout: 5000 });
		await irisCard.locator('button.btn-primary').click();
		await page.locator('app-dataset-preview').waitFor({ state: 'attached', timeout: 5000 });
		await expect
			.poll(() =>
				page.evaluate(
					() =>
						JSON.parse(localStorage.getItem('samata-ml:state') ?? '{}').dataset?.id ??
						null
				)
			)
			.not.toBeNull();

		await page.goto('/target');
		const targetView = page.locator('app-target-view');
		await expect(targetView.locator('[data-testid="target-ready"]')).toBeVisible({
			timeout: 10000
		});
		await targetView.locator('tbody tr:has(th:has-text("class")) button').click();
		await expect
			.poll(() =>
				page.evaluate(
					() => JSON.parse(localStorage.getItem('samata-ml:state') ?? '{}').target
				)
			)
			.toBe('class');

		// 2. Go to /models and create Model 1
		await page.goto('/models');
		const overview = page.locator('app-models-view');
		await expect(overview.locator('a[href="/models/new"]')).toBeVisible();
		await overview.locator('a[href="/models/new"]').click();

		await expect(page).toHaveURL(/\/models\/new$/);
		const builder = page.locator('app-model-builder-view');
		await expect(builder.locator('[data-testid="model-builder"]')).toBeVisible();

		// Section 1 is active; Section 2 is pending
		const step1 = builder.locator('.train-step').nth(0);
		const step2 = builder.locator('.train-step').nth(1);
		await expect(step1).toHaveAttribute('aria-current', 'step');
		await expect(step2).not.toHaveAttribute('aria-current', 'step');

		// 3. Select Logistic Regression via card button
		const lrCard = step1.locator('app-model-card[model-id="logistic-regression"]');
		await expect(lrCard).toBeVisible();
		const selectBtn = lrCard.locator('button:has-text("Select Model")');
		await builder.evaluate((host) => {
			const root = host.shadowRoot!;
			root.addEventListener('transitionstart', (event) => {
				const content = event.target;
				if (!(content instanceof HTMLElement) || !content.classList.contains('step-sizing'))
					return;
				const close = content.classList.contains('step-collapsed');
				const current = root.querySelector('[aria-current="step"] h2')?.id;
				const recorded = `${close ? 'close' : 'open'}:${current}:${content.inert}`;
				const phases = new Set(
					(host.getAttribute('data-test-step-phases') ?? '').split(' ').filter(Boolean)
				);
				phases.add(recorded);
				host.setAttribute('data-test-step-phases', [...phases].join(' '));
			});
		});
		await expect(step1.getByRole('button', { name: 'Continue', exact: true })).toHaveCount(0);
		await selectBtn.click();
		await expect(step2.getByRole('heading', { name: '2. Select Features' })).toBeFocused();
		await expect(builder).toHaveAttribute(
			'data-test-step-phases',
			'close:step-1-title:true open:step-2-title:true'
		);
		await expect(builder.locator('.step-active[aria-current="step"]')).toHaveCount(1);
		await expect(step1.getByRole('heading', { name: '1. Logistic Regression' })).toBeVisible();
		await expect(step1.getByRole('button', { name: 'Edit Choose Model' })).toBeVisible();
		await expect(step1.getByText('Completed', { exact: true })).toHaveCount(1);
		await expect(step1.locator('svg.icon use')).toHaveAttribute('href', '#check');
		await expect(builder.locator('symbol[id="check"]')).toHaveCount(1);
		let state = await page.evaluate(() => window.__appState!.get());
		expect(state.models[0]?.modelId).toBe('logistic-regression');
		expect(state.models[0]?.completedSteps).toContain('choose-model');
		expect(state.models[0]?.ui.featureSelectionInitialised).toBe(true);

		await expect(step1).not.toHaveAttribute('aria-current', 'step');
		await expect(step2).toHaveAttribute('aria-current', 'step');

		// Initial features were populated: Iris has 4 features (sepal length, sepal width, petal length, petal width)
		expect(state.models[0]?.features.length).toBe(4);

		// 5. Deliberately uncheck all features
		for (const feat of ['sepal length', 'sepal width', 'petal length', 'petal width']) {
			const checkbox = step2.locator(`input[aria-label="Include ${feat}"]`);
			await checkbox.uncheck();
		}

		state = await page.evaluate(() => window.__appState!.get());
		expect(state.models[0]?.features).toEqual([]);

		// Continue button in Section 2 is now disabled (requires >= 1 feature)
		const continueBtn2 = step2.locator('.section-actions button:has-text("Continue")');
		await expect(continueBtn2).toBeDisabled();
		await expect(step2.locator('.validation-hint')).toContainText(
			'Select at least one feature'
		);

		// Wait for the debounced persistence before testing the saved selection after reload.
		await expect
			.poll(() =>
				page.evaluate(() => {
					const raw = localStorage.getItem('samata-ml:state');
					return raw ? JSON.parse(raw).models[0]?.features : null;
				})
			)
			.toEqual([]);
		// 6. Reload the page -> deliberate empty selection survives reload!
		await page.reload();
		await expect(builder.locator('[data-testid="model-builder"]')).toBeVisible();

		state = await page.evaluate(() => window.__appState!.get());
		expect(state.models[0]?.features).toEqual([]);
		expect(state.models[0]?.ui.featureSelectionInitialised).toBe(true);

		// Checkboxes remain unchecked
		for (const feat of ['sepal length', 'sepal width', 'petal length', 'petal width']) {
			const checkbox = step2.locator(`input[aria-label="Include ${feat}"]`);
			await expect(checkbox).not.toBeChecked();
		}
	});

	test('MOD-SETUP-2: target excluded, at least one feature required, disabled unsupported rows, deliberate overrides', async ({
		page
	}) => {
		// Load Penguins dataset (has text/unsupported column 'sex' or similar)
		await page.goto('/data');
		const penguinsCard = page.locator('app-dataset-card[dataset-id="palmer-penguins"]');
		await penguinsCard.waitFor({ state: 'visible', timeout: 5000 });
		await penguinsCard.locator('button.btn-primary').click();
		await expect(page.locator('app-dataset-preview')).toBeVisible();
		assertDownload();
		await expect
			.poll(() =>
				page.evaluate(
					() =>
						JSON.parse(localStorage.getItem('samata-ml:state') ?? '{}').dataset?.id ??
						null
				)
			)
			.not.toBeNull();
		await page.locator('app-dataset-preview').waitFor({ state: 'attached', timeout: 5000 });
		await expect
			.poll(() =>
				page.evaluate(
					() =>
						JSON.parse(localStorage.getItem('samata-ml:state') ?? '{}').dataset?.id ??
						null
				)
			)
			.not.toBeNull();

		await page.goto('/target');
		const targetView = page.locator('app-target-view');
		await expect(targetView.locator('[data-testid="target-ready"]')).toBeVisible({
			timeout: 10000
		});
		await targetView.locator('tbody tr:has(th:has-text("species")) button').click();
		await expect
			.poll(() =>
				page.evaluate(
					() => JSON.parse(localStorage.getItem('samata-ml:state') ?? '{}').target
				)
			)
			.toBe('species');

		// Go to /models and create model
		await page.goto('/models');
		await page.locator('app-models-view a[href="/models/new"]').click();
		await expect(page).toHaveURL(/\/models\/new$/);

		const builder = page.locator('app-model-builder-view');
		const step1 = builder.locator('.train-step').nth(0);
		const step2 = builder.locator('.train-step').nth(1);

		// Select Logistic Regression.
		await step1
			.locator(
				'app-model-card[model-id="logistic-regression"] button:has-text("Select Model")'
			)
			.click();

		// Now in Section 2 (Select Features)
		await expect(step2).toHaveAttribute('aria-current', 'step');

		// 1. Target row has Target chiclet and NO input checkbox
		const targetRow = step2.locator('tbody tr:has(th label:has-text("species"))');
		await expect(targetRow.locator('.chiclet')).toHaveText('Target');
		await expect(targetRow.locator('input[type="checkbox"]')).toHaveCount(0);

		// 2. Check disabled unsupported rows or missing values notes
		// In penguins, island, bill_length_mm, etc. exist
		const islandRow = step2.locator('tbody tr:has(th label:has-text("island"))');
		await expect(islandRow).toBeVisible();

		// 3. At least one eligible feature: check that unchecking all disables Continue, checking 1 enables Continue
		const continueBtn = step2.locator('.section-actions button:has-text("Continue")');
		// Currently all eligible initial features are checked
		await expect(continueBtn).toBeEnabled();

		// Complete section 2
		await continueBtn.click();
		const step3 = builder.locator('.train-step').nth(2);
		await expect(step3).toHaveAttribute('aria-current', 'step');
		const state = await page.evaluate(() => window.__appState!.get());
		expect(state.models[0]?.completedSteps).toContain('select-features');

		// Section 3 is now active
		await expect(step3.locator('app-model-configuration form')).toBeVisible();
		await expect(step3.locator('h2')).toContainText('3. Configure Model');
	});

	test('MOD-SETUP-3: reopening preserves choices and clears later completions only after confirmation; no later training controls', async ({
		page
	}) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		// Setup Iris with completed Section 1 and Section 2
		await page.goto('/data');
		const irisCard = page.locator('app-dataset-card[dataset-id="iris"]');
		await irisCard.waitFor({ state: 'visible', timeout: 5000 });
		await irisCard.locator('button.btn-primary').click();
		await page.locator('app-dataset-preview').waitFor({ state: 'attached', timeout: 5000 });
		await expect
			.poll(() =>
				page.evaluate(
					() =>
						JSON.parse(localStorage.getItem('samata-ml:state') ?? '{}').dataset?.id ??
						null
				)
			)
			.not.toBeNull();

		await page.goto('/target');
		await page.locator('app-target-view tbody tr:has(th:has-text("class")) button').click();
		await expect
			.poll(() =>
				page.evaluate(
					() => JSON.parse(localStorage.getItem('samata-ml:state') ?? '{}').target
				)
			)
			.toBe('class');

		await page.goto('/models');
		await page.locator('app-models-view a[href="/models/new"]').click();

		const builder = page.locator('app-model-builder-view');
		const step1 = builder.locator('.train-step').nth(0);
		const step2 = builder.locator('.train-step').nth(1);
		const step3 = builder.locator('.train-step').nth(2);

		// Choose Logistic Regression.
		await step1
			.locator(
				'app-model-card[model-id="logistic-regression"] button:has-text("Select Model")'
			)
			.click();

		// Select only 2 features & Continue
		await expect(step2).toHaveAttribute('aria-current', 'step');
		await step2.locator('input[aria-label="Include sepal length"]').uncheck();
		await step2.locator('input[aria-label="Include sepal width"]').uncheck();
		expect(await page.evaluate(() => window.__appState!.get().models[0]?.features)).toEqual([
			'petal length',
			'petal width'
		]);
		await step2.locator('.section-actions button:has-text("Continue")').click();
		await expect(step3).toHaveAttribute('aria-current', 'step');
		await expect(step3.locator('h2')).toBeFocused();
		await expect(builder.locator('.step-sizing, .train-step-content[inert]')).toHaveCount(0);

		// Both Section 1 and Section 2 are completed
		let state = await page.evaluate(() => window.__appState!.get());
		expect(state.models[0]?.completedSteps).toEqual(['choose-model', 'select-features']);
		expect(state.models[0]?.features).toEqual(['petal length', 'petal width']);

		// 1. Click "Edit" on Section 1 -> opens confirmation dialog because downstream Section 2 is completed
		const editBtn1 = step1.locator('button.reopen-btn');
		await editBtn1.click();

		const confirmDialog = builder.locator('dialog[data-confirm="reopen-section"]');
		await expect(confirmDialog).toBeVisible();

		// 2. Cancel reopening -> nothing changes
		const cancelBtn = confirmDialog.locator('button:has-text("Cancel")');
		await cancelBtn.click();
		await expect(confirmDialog).not.toBeVisible();

		state = await page.evaluate(() => window.__appState!.get());
		expect(state.models[0]?.completedSteps).toEqual(['choose-model', 'select-features']);

		// 3. Click "Edit" again and confirm
		await editBtn1.click();
		await expect(confirmDialog).toBeVisible();

		const confirmBtn = confirmDialog.locator('button:has-text("Edit Section")');
		await confirmBtn.click();
		await expect(confirmDialog).not.toBeVisible();

		// Section 1 is now active, Section 2 completion was cleared, but previous choices were PRESERVED!
		state = await page.evaluate(() => window.__appState!.get());
		expect(state.models[0]?.completedSteps).toEqual([]);
		expect(state.models[0]?.modelId).toBe('logistic-regression'); // preserved
		expect(state.models[0]?.features).toEqual(['petal length', 'petal width']); // preserved

		await expect(step1).toHaveAttribute('aria-current', 'step');

		const currentSelect = step1.getByRole('button', {
			name: 'Select Model: Logistic Regression',
			exact: true
		});
		await expect(currentSelect).toHaveAttribute('aria-current', 'true');
		await currentSelect.click();
		await expect(step2).toHaveAttribute('aria-current', 'step');
		expect(await page.evaluate(() => window.__appState!.get().models[0]?.features)).toEqual(
			state.models[0]?.features
		);
		await step1.getByRole('button', { name: 'Edit Choose Model' }).click();
		await expect(step1).toHaveAttribute('aria-current', 'step');

		const otherSelect = step1.getByRole('button', {
			name: 'Select Model: Bernoulli Naive Bayes',
			exact: true
		});
		await otherSelect.click();
		await expect(step2).toHaveAttribute('aria-current', 'step');
		state = await page.evaluate(() => window.__appState!.get());
		expect(state.models[0]).toMatchObject({
			modelId: 'bernoulli-nb',
			features: ['petal length', 'petal width'],
			completedSteps: ['choose-model']
		});

		// 4. Sections 5 and 6 are still placeholders.
		for (let i = 4; i <= 5; i++) {
			const pendingStep = builder.locator('.train-step').nth(i);
			await expect(pendingStep.locator('button:has-text("Train")')).toHaveCount(0);
			await expect(pendingStep.locator('input')).toHaveCount(0);
		}
	});

	test('MOD-SETUP-4 / MODEL-ART-1 and 2: illustrated catalogue, native actions and numeric-target notice', async ({
		page
	}) => {
		// 1. Classification target (Iris -> class)
		await page.goto('/data');
		const irisCard = page.locator('app-dataset-card[dataset-id="iris"]');
		await irisCard.waitFor({ state: 'visible', timeout: 5000 });
		await irisCard.locator('button.btn-primary').click();
		await page.locator('app-dataset-preview').waitFor({ state: 'attached', timeout: 5000 });
		await expect
			.poll(() =>
				page.evaluate(
					() =>
						JSON.parse(localStorage.getItem('samata-ml:state') ?? '{}').dataset?.id ??
						null
				)
			)
			.not.toBeNull();

		await page.goto('/target');
		await page.locator('app-target-view tbody tr:has(th:has-text("class")) button').click();
		await expect
			.poll(() =>
				page.evaluate(
					() => JSON.parse(localStorage.getItem('samata-ml:state') ?? '{}').target
				)
			)
			.toBe('class');

		await page.goto('/models');
		await page.locator('app-models-view a[href="/models/new"]').click();

		const builder = page.locator('app-model-builder-view');
		const step1 = builder.locator('.train-step').nth(0);

		await expectIllustratedCatalogue(step1);
		await expect(step1.locator('button[aria-current="true"]')).toHaveCount(0);
		const bnb = step1.locator('app-model-card[model-id="bernoulli-nb"]');
		const bnbDesc = bnb.getByRole('button', {
			name: 'Model Description: Bernoulli Naive Bayes',
			exact: true
		});
		const bnbSelect = bnb.getByRole('button', {
			name: 'Select Model: Bernoulli Naive Bayes',
			exact: true
		});
		const descDialog = builder.getByRole('dialog', { name: 'Bernoulli Naive Bayes' });
		await bnbDesc.focus();
		await page.keyboard.press('Enter');
		await expect(descDialog).toBeVisible();
		await expect(descDialog.locator('.missing-notice')).toContainText(
			'A detailed description is not available'
		);
		await expect(descDialog.locator('.fallback-text')).toContainText('Bernoulli Naive Bayes');
		await page.keyboard.press('Escape');
		await expect(descDialog).not.toBeVisible();
		await expect(bnbDesc).toBeFocused();

		await bnbSelect.focus();
		await bnbDesc.click();
		await expect(descDialog).toBeVisible();
		await descDialog.locator('button.btn-icon').click();
		await expect(descDialog).not.toBeVisible();
		await expect(bnbDesc).toBeFocused();

		await bnbSelect.click();
		await expect(
			step1.getByRole('heading', { name: '1. Bernoulli Naive Bayes' })
		).toBeVisible();
		await expect(builder.locator('.train-step').nth(1)).toHaveAttribute('aria-current', 'step');
		await expect
			.poll(() =>
				page.evaluate(
					() =>
						JSON.parse(localStorage.getItem('samata-ml:state') ?? '{}').models[0]
							?.modelId
				)
			)
			.toBe('bernoulli-nb');

		await page.reload();
		await expect(
			step1.getByRole('heading', { name: '1. Bernoulli Naive Bayes' })
		).toBeVisible();
		await expect(builder.locator('.train-step').nth(1)).toHaveAttribute('aria-current', 'step');

		// 2. Regression target (Boston Housing or Penguins bill_length_mm)
		await page.goto('/target');
		// Change target to numeric 'sepal length'
		await page
			.locator('app-target-view tbody tr:has(th:has-text("sepal length")) button')
			.click();
		// Confirm target change modal
		const changeConfirm = page.locator('app-target-view dialog.confirm-dialog[open]');
		await changeConfirm.locator('button:has-text("Change Target")').click();
		await expect
			.poll(() =>
				page.evaluate(
					() => JSON.parse(localStorage.getItem('samata-ml:state') ?? '{}').target
				)
			)
			.toBe('sepal length');

		// Go to /models and create model for regression
		await page.goto('/models');
		await page.locator('app-models-view a[href="/models/new"]').click();

		// WML-P1-CAT-2: a numeric target has no available classifier
		await expect(step1.locator('app-model-card')).toHaveCount(0);
		await expect(step1.locator('ul.cards-grid')).toHaveCount(0);
		const notice = step1.locator('.no-model-notice');
		await expect(notice.locator('h3')).toHaveText('No classification model available');
		const targetLink = notice.locator('a[href="/target"]');
		await expect(targetLink).toBeVisible();

		const axeResults = await new AxeBuilder({ page })
			.withTags(AXE_TAGS)
			.include('app-model-builder-view')
			.analyze();
		const unexpectedViolations = axeResults.violations.filter((v) => v.id !== 'color-contrast');
		expect(unexpectedViolations).toEqual([]);
		await targetLink.click();
		await builder
			.getByRole('dialog', { name: 'Leave this model?' })
			.getByRole('button', { name: 'Leave', exact: true })
			.click();
		await expect(page).toHaveURL(/\/target$/);
	});

	test('MODEL-ART-1: an uploaded Boolean target offers all eight illustrated cards', async ({
		page
	}) => {
		await page.getByRole('button', { name: 'Upload Dataset', exact: true }).click();
		await page.locator('app-upload-dataset-dialog input[type="file"]').setInputFiles({
			name: 'boolean-target.csv',
			mimeType: 'text/csv',
			buffer: Buffer.from('feature,flag\n1,true\n2,false\n3,true\n4,false\n')
		});
		await expect(page.locator('app-dataset-preview')).toBeVisible();
		await expect
			.poll(() =>
				page.evaluate(() => {
					const state = JSON.parse(localStorage.getItem('samata-ml:state') ?? '{}');
					return state.dataset?.columns.find(
						(column: { name: string }) => column.name === 'flag'
					)?.type;
				})
			)
			.toBe('boolean');

		await page.goto('/target');
		const targetView = page.locator('app-target-view');
		await targetView
			.getByRole('row')
			.filter({
				has: page.getByRole('rowheader', { name: 'flag', exact: true })
			})
			.getByRole('button')
			.click();
		await targetView.locator('header a[href="/models"]').click();
		await page
			.locator('app-models-view')
			.getByRole('link', { name: 'Train New Model', exact: true })
			.click();
		const step = page.locator('app-model-builder-view .train-step').first();
		await expect(step).toHaveAttribute('aria-current', 'step');
		await expectIllustratedCatalogue(step);

		await page.setViewportSize({ width: 320, height: 800 });
		const grid = step.locator('ul.cards-grid');
		expect(await grid.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
		const firstCard = grid.locator('app-model-card[model-id="bernoulli-nb"]');
		const secondCard = grid.locator('app-model-card[model-id="gaussian-nb"]');
		const first = (await firstCard.boundingBox())!;
		const second = (await secondCard.boundingBox())!;
		expect(second.x).toBeCloseTo(first.x);
		expect(second.y).toBeGreaterThan(first.y + first.height);
	});
});
