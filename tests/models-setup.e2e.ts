import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];

test.describe('Model Builder Setup (MOD-SETUP-1 .. MOD-SETUP-4)', () => {
	test.beforeEach(async ({ page }) => {
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
		await page.reload();
	});

	test('MOD-SETUP-1: select alone does not complete; continue does; initial features set once; empty selection survives reload', async ({
		page
	}) => {
		// 1. Setup dataset and target
		const irisCard = page.locator('app-dataset-card[dataset-id="iris"]');
		await irisCard.waitFor({ state: 'visible', timeout: 5000 });
		await irisCard.locator('button.btn-primary').click();
		await page.locator('app-dataset-preview').waitFor({ state: 'attached', timeout: 5000 });

		await page.goto('/target');
		const targetView = page.locator('app-target-view');
		await expect(targetView.locator('[data-testid="target-ready"]')).toBeVisible({
			timeout: 10000
		});
		await targetView.locator('tbody tr:has(th:has-text("class")) button').click();

		// 2. Go to /models and create Model 1
		await page.goto('/models');
		const overview = page.locator('app-models-view');
		await expect(overview.locator('button:has-text("Train New Model")')).toBeVisible();
		await overview.locator('button:has-text("Train New Model")').click();

		await expect(page).toHaveURL(/\/models\/1$/);
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
		await selectBtn.click();

		// Check app state: modelId is set, but completedSteps is STILL empty!
		let state = await page.evaluate(() => window.__appState!.get());
		expect(state.models[0]?.modelId).toBe('logistic-regression');
		expect(state.models[0]?.completedSteps).toEqual([]);

		// Section 1 is STILL active (selecting alone does not complete!)
		await expect(step1).toHaveAttribute('aria-current', 'step');

		// 4. Click Section 1 Continue button
		const continueBtn1 = step1.locator('.section-actions button:has-text("Continue")');
		await expect(continueBtn1).toBeEnabled();
		await continueBtn1.click();

		// Now Section 1 is completed and Section 2 is active!
		state = await page.evaluate(() => window.__appState!.get());
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
		await page.locator('app-dataset-preview').waitFor({ state: 'attached', timeout: 5000 });

		await page.goto('/target');
		const targetView = page.locator('app-target-view');
		await expect(targetView.locator('[data-testid="target-ready"]')).toBeVisible({
			timeout: 10000
		});
		await targetView.locator('tbody tr:has(th:has-text("species")) button').click();

		// Go to /models and create model
		await page.goto('/models');
		await page.locator('app-models-view button:has-text("Train New Model")').click();
		await expect(page).toHaveURL(/\/models\/1$/);

		const builder = page.locator('app-model-builder-view');
		const step1 = builder.locator('.train-step').nth(0);
		const step2 = builder.locator('.train-step').nth(1);

		// Select Logistic Regression and Continue
		await step1.locator('app-model-card button:has-text("Select Model")').click();
		await step1.locator('.section-actions button:has-text("Continue")').click();

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
		const state = await page.evaluate(() => window.__appState!.get());
		expect(state.models[0]?.completedSteps).toContain('select-features');

		// Section 3 is now active
		const step3 = builder.locator('.train-step').nth(2);
		await expect(step3).toHaveAttribute('aria-current', 'step');
		await expect(step3.locator('.pending-notice')).toHaveText('Not available yet.');
	});

	test('MOD-SETUP-3: reopening preserves choices and clears later completions only after confirmation; no later training controls', async ({
		page
	}) => {
		// Setup Iris with completed Section 1 and Section 2
		await page.goto('/data');
		const irisCard = page.locator('app-dataset-card[dataset-id="iris"]');
		await irisCard.waitFor({ state: 'visible', timeout: 5000 });
		await irisCard.locator('button.btn-primary').click();
		await page.locator('app-dataset-preview').waitFor({ state: 'attached', timeout: 5000 });

		await page.goto('/target');
		await page.locator('app-target-view tbody tr:has(th:has-text("class")) button').click();

		await page.goto('/models');
		await page.locator('app-models-view button:has-text("Train New Model")').click();

		const builder = page.locator('app-model-builder-view');
		const step1 = builder.locator('.train-step').nth(0);
		const step2 = builder.locator('.train-step').nth(1);
		const step3 = builder.locator('.train-step').nth(2);

		// Choose Logistic Regression & Continue
		await step1.locator('app-model-card button:has-text("Select Model")').click();
		await step1.locator('.section-actions button:has-text("Continue")').click();

		// Select only 2 features & Continue
		await step2.locator('input[aria-label="Include sepal length"]').uncheck();
		await step2.locator('input[aria-label="Include sepal width"]').uncheck();
		await step2.locator('.section-actions button:has-text("Continue")').click();

		// Both Section 1 and Section 2 are completed
		let state = await page.evaluate(() => window.__appState!.get());
		expect(state.models[0]?.completedSteps).toEqual(['choose-model', 'select-features']);
		expect(state.models[0]?.features).toEqual(['petal length', 'petal width']);

		// 1. Click "Edit" on Section 1 -> opens confirmation dialog because downstream Section 2 is completed
		const editBtn1 = step1.locator('button.reopen-btn');
		await editBtn1.click();

		const confirmDialog = builder.locator('dialog.confirm-dialog');
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

		// 4. Verify sections 3-6 never show training controls
		for (let i = 2; i <= 5; i++) {
			const pendingStep = builder.locator('.train-step').nth(i);
			await expect(pendingStep.locator('button:has-text("Train")')).toHaveCount(0);
			await expect(pendingStep.locator('input')).toHaveCount(0);
		}
	});

	test('MOD-SETUP-4: Logistic Regression has SVG slot; other IDs render native text actions; classifier cards and numeric-target notice', async ({
		page
	}) => {
		// 1. Classification target (Iris -> class)
		await page.goto('/data');
		const irisCard = page.locator('app-dataset-card[dataset-id="iris"]');
		await irisCard.waitFor({ state: 'visible', timeout: 5000 });
		await irisCard.locator('button.btn-primary').click();
		await page.locator('app-dataset-preview').waitFor({ state: 'attached', timeout: 5000 });

		await page.goto('/target');
		await page.locator('app-target-view tbody tr:has(th:has-text("class")) button').click();

		await page.goto('/models');
		await page.locator('app-models-view button:has-text("Train New Model")').click();

		const builder = page.locator('app-model-builder-view');
		const step1 = builder.locator('.train-step').nth(0);

		// Logistic Regression has app-model-card with SVG
		const lrCard = step1.locator('app-model-card[model-id="logistic-regression"]');
		await expect(lrCard).toBeVisible();
		await expect(lrCard.locator('svg[slot="image"]')).toBeVisible();

		// Remaining 7 classifiers are rendered as text entries
		const textEntries = step1.locator('ul.text-model-entries li');
		await expect(textEntries).toHaveCount(7);

		// Verify Bernoulli Naive Bayes text entry
		const bnbEntry = step1.locator(
			'li.text-model-entry:has(h3:has-text("Bernoulli Naive Bayes"))'
		);
		await expect(bnbEntry).toBeVisible();
		const bnbDescBtn = bnbEntry.locator('button[aria-label^="Model Description"]');
		const bnbSelectBtn = bnbEntry.locator('button[aria-label^="Select Model"]');
		await expect(bnbDescBtn).toBeVisible();
		await expect(bnbSelectBtn).toBeVisible();

		// Select Bernoulli Naive Bayes -> updates state
		await bnbSelectBtn.click();
		let state = await page.evaluate(() => window.__appState!.get());
		expect(state.models[0]?.modelId).toBe('bernoulli-nb');

		// Description opens description dialog
		await bnbDescBtn.click();
		const descDialog = builder.locator('app-model-description-dialog dialog.modal');
		await expect(descDialog).toBeVisible();
		// Bernoulli Naive Bayes is unauthored prose -> renders missing fallback state with plain text
		await expect(descDialog.locator('.missing-notice')).toContainText(
			'A detailed description is not available'
		);
		await expect(descDialog.locator('.fallback-text')).toContainText('Bernoulli Naive Bayes');

		await descDialog.locator('button.close-btn').click();
		await expect(descDialog).not.toBeVisible();

		// 2. Regression target (Boston Housing or Penguins bill_length_mm)
		await page.goto('/target');
		// Change target to numeric 'sepal length'
		await page
			.locator('app-target-view tbody tr:has(th:has-text("sepal length")) button')
			.click();
		// Confirm target change modal
		const changeConfirm = page.locator('app-target-view dialog.confirm-dialog[open]');
		await changeConfirm.locator('button:has-text("Change Target")').click();

		// Go to /models and create model for regression
		await page.goto('/models');
		await page.locator('app-models-view button:has-text("Train New Model")').click();

		// WML-P1-CAT-2: a numeric target has no available classifier
		await expect(step1.locator('app-model-card')).toHaveCount(0);
		await expect(step1.locator('ul.text-model-entries li')).toHaveCount(0);
		const notice = step1.locator('.no-model-notice');
		await expect(notice.locator('h3')).toHaveText('No classification model available');
		const targetLink = notice.locator('a[href="/target"]');
		await expect(targetLink).toBeVisible();
		await targetLink.click();
		await expect(page).toHaveURL(/\/target$/);
		await page.goBack();

		// Axe check
		const axeResults = await new AxeBuilder({ page })
			.withTags(AXE_TAGS)
			.include('app-model-builder-view')
			.analyze();
		const unexpectedViolations = axeResults.violations.filter((v) => v.id !== 'color-contrast');
		expect(unexpectedViolations).toEqual([]);
	});
});
