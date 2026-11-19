import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];

async function resetApp(page: Page): Promise<void> {
	await page.goto('/data');
	const getStarted = page.locator('app-welcome-modal button.btn-primary');
	try {
		await getStarted.waitFor({ state: 'visible', timeout: 2000 });
		await getStarted.click();
		await page.locator('app-welcome-modal dialog').waitFor({ state: 'hidden', timeout: 2000 });
	} catch {
		// Already dismissed
	}
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
	try {
		await getStarted.waitFor({ state: 'visible', timeout: 1500 });
		await getStarted.click();
		await page.locator('app-welcome-modal dialog').waitFor({ state: 'hidden', timeout: 2000 });
	} catch {
		// Not shown again
	}
}

/** Loads Iris, targets `class`, builds Model 1 with Logistic Regression and completes Sections 1 and 2. */
async function openConfigure(page: Page, target = 'class'): Promise<Locator> {
	await resetApp(page);
	const iris = page.locator('app-dataset-card[dataset-id="iris"]');
	await iris.waitFor({ state: 'visible', timeout: 5000 });
	await iris.locator('button.btn-primary').click();
	await page.locator('app-dataset-preview').waitFor({ state: 'attached', timeout: 5000 });
	await page.goto('/target');
	await expect(page.locator('app-target-view [data-testid="target-ready"]')).toBeVisible({
		timeout: 10000
	});
	await page.locator(`app-target-view tbody tr:has(th:has-text("${target}")) button`).click();
	await page.goto('/models');
	await page.locator('app-models-view button:has-text("Train New Model")').click();
	const builder = page.locator('app-model-builder-view');
	const step1 = builder.locator('.train-step').nth(0);
	await step1.locator('app-model-card button:has-text("Select Model")').click();
	await step1.locator('.section-actions button:has-text("Continue")').click();
	await builder
		.locator('.train-step')
		.nth(1)
		.locator('.section-actions button:has-text("Continue")')
		.click();
	const form = builder.locator('app-model-configuration');
	await expect(form.locator('form')).toBeVisible();
	return form;
}

/** Switches the model id (and clears its settings) without walking Section 1 again. */
async function useModel(page: Page, modelId: string): Promise<void> {
	await page.evaluate((id) => {
		const s = window.__appState!.get();
		window.__appState!.set({
			...s,
			models: s.models.map((m) => ({
				...m,
				modelId: id,
				hyperparameters: { mode: 'manual' as const, values: {} }
			}))
		});
	}, modelId);
}

async function values(page: Page): Promise<Record<string, unknown>> {
	return page.evaluate(() => window.__appState!.get().models[0]!.hyperparameters.values);
}

test.describe('Configure model (WML-P1-UI-*)', () => {
	test('WML-P1-UI-1: renders every classifier form with Mode, descriptions and dependency notes', async ({
		page
	}) => {
		const form = await openConfigure(page);
		const mode = form.locator('select#mode');
		await expect(mode).toHaveValue('manual');
		await expect(mode.locator('option[value="tuning"]')).toBeDisabled();
		await expect(form.locator('abbr[title]').first()).toBeVisible();

		// Logistic Regression: classWeight hidden; solver and penalty rules
		await expect(form.getByLabel('Class weights')).toHaveCount(0);
		await expect(form.locator('#learningRate-range')).toHaveCount(0);
		await expect(form.getByText('Adam uses a fixed learning rate of 0.001.')).toBeVisible();
		await form.locator('select#solver').selectOption('sgd');
		await expect(form.locator('#learningRate-number')).toBeVisible();
		await form.locator('select#solver').selectOption('lbfgs');
		await expect(form.getByText('This solver does not use a learning rate.')).toBeVisible();
		await form.locator('select#solver').selectOption('adam');
		await form.locator('select#penalty').selectOption('l1');
		await expect(form.locator('select#solver option[value="lbfgs"]')).toBeDisabled();
		await expect(
			form.getByText('L-BFGS supports only no penalty or L2.').first()
		).toBeVisible();

		const expected: Record<string, string[]> = {
			'mlp-classifier': [
				'Hidden layers',
				'Activation function',
				'Solver',
				'Maximum iterations',
				'Tolerance',
				'Random seed'
			],
			'decision-tree-classifier': [
				'Criterion',
				'Maximum depth',
				'Minimum samples to split',
				'Minimum samples per leaf',
				'Minimum impurity decrease'
			],
			'k-neighbors-classifier': [
				'Number of neighbours',
				'Weights',
				'Distance metric',
				'Minkowski power (p)'
			],
			'gaussian-nb': ['Variance smoothing'],
			'multinomial-nb': ['Smoothing (alpha)', 'Force smoothing', 'Learn class priors'],
			'bernoulli-nb': [
				'Smoothing (alpha)',
				'Force smoothing',
				'Binarise',
				'Learn class priors'
			],
			'support-vector-classifier': [
				'Regularisation strength (C)',
				'Class weights',
				'Kernel',
				'Gamma',
				'Tolerance',
				'Probability estimates'
			]
		};
		for (const [id, labels] of Object.entries(expected)) {
			await useModel(page, id);
			for (const label of labels) {
				await expect(
					form.locator('.field-name, legend', { hasText: label }).first()
				).toBeVisible();
			}
		}

		// KNN slider maximum is min(50, rowCount) for 150 rows
		await useModel(page, 'k-neighbors-classifier');
		await expect(form.locator('#nNeighbors-range')).toHaveAttribute('max', '50');
		await expect(form.locator('#nNeighbors-range')).toHaveAttribute('min', '1');
	});

	test('WML-P1-UI-2: range and number stay in step and preserve malformed text', async ({
		page
	}) => {
		const form = await openConfigure(page);
		await form.locator('select#penalty').selectOption('l2');
		const range = form.locator('#C-range');
		const number = form.locator('#C-number');

		// Log slider shows the actual value, not the exponent
		await range.fill('1');
		await expect(number).toHaveValue('10');
		await expect(range).toHaveAttribute('aria-valuetext', '10');
		expect((await values(page)).C).toBe(10);

		// 0.00 is out of domain: keeps text, no change
		await number.fill('0.00');
		await expect(number).toHaveValue('0.00');
		expect((await values(page)).C).toBe(10);

		// 1e5 keeps the exact value and parks the slider at max
		await number.fill('1e5');
		await expect(number).toHaveValue('1e5');
		expect((await values(page)).C).toBe(100000);
		await expect(range).toHaveValue('4');

		// Out-of-domain on blur
		await number.fill('0');
		await number.blur();
		await expect(number).toHaveAttribute('aria-invalid', 'true');
		await expect(number).toHaveAttribute('aria-describedby', /C-error/);
		expect((await values(page)).C).toBe(100000);

		// Learning rate needs the sgd solver
		await form.locator('select#solver').selectOption('sgd');
		const lr = form.locator('#learningRate-number');
		await lr.fill('0.002');
		expect((await values(page)).learningRate).toBe(0.002);
		expect(Number(await form.locator('#learningRate-range').inputValue())).toBeCloseTo(
			Math.log10(0.002),
			2
		);

		// Malformed scientific text via keyboard: badInput, not blank
		await number.fill('1');
		await number.pressSequentially('e');
		await expect
			.poll(() => number.evaluate((el: HTMLInputElement) => el.validity.badInput))
			.toBe(true);
		await number.blur();
		await expect(number).toHaveAttribute('aria-invalid', 'true');
		await expect(form.locator('#C-error')).toHaveText('Enter a valid number.');
		// Editing another field re-renders the form but keeps the text
		await form.locator('select#solver').selectOption('adam');
		await form.locator('select#solver').selectOption('sgd');
		await expect
			.poll(() => number.evaluate((el: HTMLInputElement) => el.validity.badInput))
			.toBe(true);

		// Reset on SVC tolerance after badInput
		await useModel(page, 'support-vector-classifier');
		const tol = form.locator('input#tol');
		await tol.fill('');
		await tol.pressSequentially('1e');
		await form.getByRole('button', { name: 'Reset Tolerance' }).click();
		await expect(tol).toHaveValue('0.001');
		expect(await tol.evaluate((el: HTMLInputElement) => el.validity.badInput)).toBe(false);
		expect(await values(page)).not.toHaveProperty('tol');

		// MLP randomState: blank is valid, Reset empties after badInput
		await useModel(page, 'mlp-classifier');
		const seed = form.locator('input#randomState');
		await seed.fill('42');
		expect((await values(page)).randomState).toBe(42);
		await seed.fill('');
		expect(await values(page)).not.toHaveProperty('randomState');
		await seed.pressSequentially('1e');
		await seed.blur();
		await expect(seed).toHaveAttribute('aria-invalid', 'true');
		await form.getByRole('button', { name: 'Reset Random seed' }).click();
		await expect(seed).toHaveValue('');
		expect(await seed.evaluate((el: HTMLInputElement) => el.validity.badInput)).toBe(false);
	});

	test('WML-P1-UI-3: controls have accessible names, validity and descriptions', async ({
		page
	}) => {
		const form = await openConfigure(page);
		await form.locator('select#penalty').selectOption('l2');
		await expect(form.getByRole('combobox', { name: 'Solver' })).toHaveAttribute(
			'aria-invalid',
			'false'
		);
		await expect(form.getByRole('checkbox', { name: 'Fit an intercept' })).toBeVisible();
		await expect(
			form.getByRole('slider', { name: 'Regularisation strength (C)' })
		).toBeVisible();
		await expect(
			form.getByRole('spinbutton', { name: 'Regularisation strength (C) (exact value)' })
		).toHaveAttribute('aria-invalid', 'false');
		const solver = form.getByRole('combobox', { name: 'Solver' });
		await expect(solver).toHaveAccessibleDescription(/solver is the method/);

		await useModel(page, 'decision-tree-classifier');
		await form.getByRole('combobox', { name: 'Maximum depth' }).selectOption('limited');
		await expect(
			form.getByRole('slider', { name: 'Maximum depth', exact: true }).first()
		).toBeVisible();
		await expect(
			form.getByRole('spinbutton', { name: 'Maximum depth (exact value)' })
		).toBeVisible();

		await useModel(page, 'mlp-classifier');
		await expect(form.getByRole('spinbutton', { name: 'Layer 1 size' })).toBeVisible();

		const axe = await new AxeBuilder({ page })
			.withTags(AXE_TAGS)
			.include('app-model-builder-view')
			.analyze();
		expect(axe.violations.filter((v) => v.id !== 'color-contrast')).toEqual([]);
	});

	test('WML-P1-UI-4: Save & Continue validates, completes, and Edit reopens', async ({
		page
	}) => {
		const form = await openConfigure(page);
		const builder = page.locator('app-model-builder-view');
		const step3 = builder.locator('.train-step').nth(2);
		await form.locator('select#penalty').selectOption('l2');
		await form.locator('#C-number').fill('0');
		await form.getByRole('button', { name: 'Save & Continue' }).click();
		await expect(form.locator('#C-number')).toBeFocused();
		await expect(form.locator('#C-error')).toBeVisible();
		await expect(step3).toHaveAttribute('aria-current', 'step');

		// Hiding C clears its draft; Save then succeeds with no C key
		await form.locator('select#penalty').selectOption('none');
		await form.getByRole('button', { name: 'Save & Continue' }).click();
		await expect(step3.locator('h2')).toContainText('3. Model Configured');
		const model = await page.evaluate(() => window.__appState!.get().models[0]!);
		expect(model.completedSteps).toContain('configure-model');
		expect(model.hyperparameters.values).not.toHaveProperty('C');
		expect(model.multiclass).toBe('one-vs-rest');
		await expect(builder.locator('.train-step').nth(3)).toHaveAttribute('aria-current', 'step');

		// Edit reopens directly (no later section complete)
		await step3.getByRole('button', { name: 'Reopen Configure Model' }).click();
		await expect(builder.locator('dialog.confirm-dialog')).not.toBeVisible();
		await expect(step3).toHaveAttribute('aria-current', 'step');
		await form.locator('select#penalty').selectOption('l2');
		await expect(form.locator('#C-number')).toHaveValue('1');
		await expect(form.locator('#C-error')).toHaveCount(0);

		// With a later section complete, Edit asks first
		await form.locator('select#penalty').selectOption('none');
		await form.getByRole('button', { name: 'Save & Continue' }).click();
		await page.evaluate(() => {
			const s = window.__appState!.get();
			window.__appState!.set({
				...s,
				models: s.models.map((m) => ({
					...m,
					completedSteps: [...m.completedSteps, 'configure-training' as const]
				}))
			});
		});
		await step3.getByRole('button', { name: 'Reopen Configure Model' }).click();
		await expect(builder.locator('dialog.confirm-dialog')).toBeVisible();
	});

	test('WML-P1-UI-4: shows the read-only multiclass note for a three-class target', async ({
		page
	}) => {
		const form = await openConfigure(page);
		await expect(form.locator('.form-note').first()).toContainText('one model per class');
		await useModel(page, 'gaussian-nb');
		await expect(form.locator('.form-note').first()).toContainText('more than two classes');
		await expect(form.locator('.form-note').last()).toContainText('Class priors');
	});

	test('WML-P1-UI-5: help link opens the dialog and closing returns to the model', async ({
		page
	}) => {
		await openConfigure(page);
		await page.locator('app-model-builder-view a.help-link').click();
		await expect(page).toHaveURL(/\/help\/configure-model$/);
		const dialog = page.locator('app-content-modal dialog');
		await expect(dialog).toBeVisible();
		await expect(
			dialog.getByRole('heading', { name: 'What do these settings mean?' })
		).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page).toHaveURL(/\/models\/1$/);

		const form = page.locator('app-model-configuration');
		await form.locator('select#penalty').selectOption('l2');
		await form.locator('#C-number').fill('2');
		await page.reload();
		await expect(page.locator('app-model-configuration #C-number')).toHaveValue('2');
	});

	test('WML-P1-UI-6: keyboard completion and 320 px width without horizontal overflow', async ({
		page
	}) => {
		const form = await openConfigure(page);
		await page.setViewportSize({ width: 320, height: 800 });
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth > document.documentElement.clientWidth
		);
		expect(overflow).toBe(false);
		await form.locator('select#mode').focus();
		await page.keyboard.press('Tab');
		await expect(form.locator('select#penalty')).toBeFocused();
		const save = form.getByRole('button', { name: 'Save & Continue' });
		await save.focus();
		await page.keyboard.press('Enter');
		await expect(
			page.locator('app-model-builder-view .train-step').nth(2).locator('h2')
		).toContainText('3. Model Configured');
	});

	test('WML-P1-UI-6: right-to-left, 200% zoom and forced colours keep content and focus visible', async ({
		page
	}) => {
		const form = await openConfigure(page);
		await page.evaluate(() => {
			document.documentElement.dir = 'rtl';
			document.documentElement.style.zoom = '2';
		});
		await page.setViewportSize({ width: 640, height: 800 });
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
		);
		expect(overflow).toBe(false);
		await page.emulateMedia({ forcedColors: 'active' });
		await form.locator('select#penalty').focus();
		await page.keyboard.press('Shift+Tab');
		await page.keyboard.press('Tab');
		const outline = await form
			.locator('select#penalty')
			.evaluate((el) => getComputedStyle(el).outlineStyle);
		expect(outline).not.toBe('none');
	});

	test('WML-P1-UI-8: compound fields and layers', async ({ page }) => {
		const form = await openConfigure(page);
		await useModel(page, 'decision-tree-classifier');
		const depth = form.getByRole('combobox', { name: 'Maximum depth' });
		await depth.selectOption('limited');
		await expect(form.locator('#maxDepth-value-number')).toHaveValue('10');
		expect((await values(page)).maxDepth).toBe(10);
		await depth.selectOption('unlimited');
		expect(await values(page)).not.toHaveProperty('maxDepth');

		await depth.selectOption('limited');
		const depthNumber = form.locator('#maxDepth-value-number');
		await depthNumber.fill('');
		await depthNumber.pressSequentially('1e');
		await depth.selectOption('unlimited');
		await depth.selectOption('limited');
		await expect(depthNumber).toHaveValue('10');
		await expect(form.locator('#maxDepth-value-range')).toHaveValue('10');
		await depth.selectOption('unlimited');
		await form.getByRole('button', { name: 'Save & Continue' }).click();
		await expect(
			page.locator('app-model-builder-view .train-step').nth(2).locator('h2')
		).toContainText('3. Model Configured');

		await page
			.locator('app-model-builder-view .train-step')
			.nth(2)
			.getByRole('button', { name: 'Reopen Configure Model' })
			.click();
		await useModel(page, 'support-vector-classifier');
		const gamma = form.getByRole('combobox', { name: 'Gamma' });
		await gamma.selectOption('value');
		expect((await values(page)).gamma).toBe(0.1);
		await gamma.selectOption('auto');
		expect((await values(page)).gamma).toBe('auto');
		await gamma.selectOption('scale');
		expect(await values(page)).not.toHaveProperty('gamma');
		await form.getByRole('combobox', { name: 'Class weights' }).selectOption('balanced');
		expect((await values(page)).classWeight).toBe('balanced');

		await useModel(page, 'mlp-classifier');
		await expect(form.getByRole('button', { name: /Remove layer/ })).toHaveCount(0);
		await form.getByRole('button', { name: 'Add layer' }).click();
		await expect(form.getByRole('spinbutton', { name: 'Layer 2 size' })).toBeFocused();
		expect((await values(page)).hiddenLayerSizes).toEqual([100, 100]);
		await form.getByRole('button', { name: 'Add layer' }).click();
		await form.getByRole('spinbutton', { name: 'Layer 3 size' }).fill('32');
		await form.getByRole('button', { name: 'Remove layer 2' }).click();
		await expect(form.getByRole('spinbutton', { name: 'Layer 2 size' })).toBeFocused();
		expect((await values(page)).hiddenLayerSizes).toEqual([100, 32]);

		// A bad-input draft in a removed layer leaves no error and Save succeeds
		const layer2 = form.getByRole('spinbutton', { name: 'Layer 2 size' });
		await layer2.fill('');
		await layer2.pressSequentially('1e');
		await form.getByRole('button', { name: 'Remove layer 2' }).click();
		await form.getByRole('button', { name: 'Save & Continue' }).click();
		await expect(
			page.locator('app-model-builder-view .train-step').nth(2).locator('h2')
		).toContainText('3. Model Configured');
	});
});
