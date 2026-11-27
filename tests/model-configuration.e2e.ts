import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { featureA11yFindings } from './a11y-feature-findings';
import { waitForPublishedPreview } from './helpers/dataset-ready';

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

async function dismissWelcome(page: Page): Promise<void> {
	const getStarted = page.locator('app-welcome-modal button.btn-primary');
	try {
		await getStarted.waitFor({ state: 'visible', timeout: 1500 });
		await getStarted.click();
		await page.locator('app-welcome-modal dialog').waitFor({ state: 'hidden', timeout: 2000 });
	} catch {
		// Not shown
	}
}

/** Loads a sample dataset (Iris by default), targets `class`, builds Model 1 with Logistic Regression and completes Sections 1 and 2. */
async function openConfigure(page: Page, target = 'class', dataset = 'iris'): Promise<Locator> {
	await resetApp(page);
	const iris = page.locator(`app-dataset-card[dataset-id="${dataset}"]`);
	await iris.waitFor({ state: 'visible', timeout: 5000 });
	await iris.locator('button.btn-primary').click();
	await waitForPublishedPreview(page);
	await page.goto('/target');
	await expect(page.locator('app-target-view [data-testid="target-ready"]')).toBeVisible({
		timeout: 10000
	});
	await page.locator(`app-target-view tbody tr:has(th:has-text("${target}")) button`).click();
	await expect
		.poll(() =>
			page.evaluate(() => {
				const raw = localStorage.getItem('samata-ml:state');
				return raw ? JSON.parse(raw).target : null;
			})
		)
		.toBe(target);
	await page.goto('/models');
	await page.locator('app-models-view a[href="/models/new"]').click();
	const builder = page.locator('app-model-builder-view');
	const step1 = builder.locator('.train-step').nth(0);
	await step1
		.locator('app-model-card[model-id="logistic-regression"] button:has-text("Select Model")')
		.click();
	await builder
		.locator('.train-step')
		.nth(1)
		.locator('.section-actions button:has-text("Continue")')
		.click();
	const form = builder.locator('app-model-configuration');
	await expect(form.locator('form')).toBeVisible();
	await expect(builder.locator('.step-active .train-step-content[inert]')).toHaveCount(0);
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

const CLASSIFIERS: ReadonlyArray<{ id: string; setup?: [string, string] }> = [
	{ id: 'logistic-regression', setup: ['penalty', 'l2'] },
	{ id: 'mlp-classifier' },
	{ id: 'decision-tree-classifier' },
	{ id: 'k-neighbors-classifier', setup: ['metric', 'minkowski'] },
	{ id: 'gaussian-nb' },
	{ id: 'multinomial-nb' },
	{ id: 'bernoulli-nb' },
	{ id: 'support-vector-classifier', setup: ['kernel', 'poly'] }
];

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Asserts every range, number, select and checkbox has a name, a valid state and a description. */
async function expectControlsAccessible(form: Locator): Promise<number> {
	const controls = form.locator(
		'select, input[type="range"], input[type="number"], input[type="checkbox"]'
	);
	const count = await controls.count();
	expect(count).toBeGreaterThan(0);
	for (let index = 0; index < count; index += 1) {
		const control = controls.nth(index);
		const facts = await control.evaluate((el) => {
			const root = el.getRootNode() as ShadowRoot;
			const clean = (text: string | null | undefined) =>
				(text ?? '').replace(/\s+/g, ' ').trim();
			const labelledBy = el.getAttribute('aria-labelledby');
			const label =
				el.getAttribute('aria-label') ??
				(labelledBy ? root.getElementById(labelledBy)?.textContent : null) ??
				root.querySelector(`label[for="${el.id}"]`)?.textContent;
			const key = el.getAttribute('data-name') ?? el.id;
			const helpElement = root.getElementById(`${key}-help`);
			const help = (helpElement?.querySelector('p') ?? helpElement)?.textContent;
			return { id: el.id, label: clean(label), help: clean(help) };
		});
		expect(facts.label, `${facts.id} has a label`).not.toBe('');
		expect(facts.help, `${facts.id} has help text`).not.toBe('');
		await expect(control, facts.id).toHaveAccessibleName(facts.label);
		await expect(control, facts.id).toHaveAttribute('aria-invalid', 'false');
		await expect(control, facts.id).toHaveAccessibleDescription(
			new RegExp(escapeRegExp(facts.help))
		);
	}
	return count;
}

test.describe('Configure model (WML-P1-UI-*)', () => {
	test('WML-P1-UI-1: renders every classifier form with Mode, descriptions and dependency notes', async ({
		page
	}) => {
		const form = await openConfigure(page);
		const mode = form.locator('select#mode');
		await expect(mode).toHaveValue('manual');
		await expect(mode.locator('option[value="tuning"]')).toBeDisabled();
		await expect(form.locator('#solver-help')).toContainText(
			'The solver is the method used to fit the model.'
		);
		await expect(form.locator('#solver-help abbr')).toHaveCount(0);

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

	test('TERM-AC-3: WML-P1-UI-3 every control has a name, validity and plain description', async ({
		page
	}) => {
		const form = await openConfigure(page);
		for (const { id, setup } of CLASSIFIERS) {
			await useModel(page, id);
			if (setup) await form.locator(`select#${setup[0]}`).selectOption(setup[1]);
			await expect(form.locator('select#mode')).toBeVisible();
			await expectControlsAccessible(form);
			await expect(form.locator('.field-description abbr')).toHaveCount(0);
		}

		// Named examples from each control kind
		await useModel(page, 'logistic-regression');
		await form.locator('select#penalty').selectOption('l2');
		await expect(form.getByRole('checkbox', { name: 'Fit an intercept' })).toBeVisible();
		await expect(
			form.getByRole('slider', { name: 'Regularisation strength (C)' })
		).toBeVisible();
		await expect(
			form.getByRole('spinbutton', { name: 'Regularisation strength (C) (exact value)' })
		).toHaveAttribute('aria-invalid', 'false');
		await expect(form.getByRole('combobox', { name: 'Solver' })).toHaveAccessibleDescription(
			/solver is the method/
		);
		await expect(form.getByRole('combobox', { name: 'Mode' })).toHaveAttribute(
			'aria-invalid',
			'false'
		);

		// Invalid control: the error comes first in the description
		const number = form.locator('#C-number');
		await number.fill('0');
		await number.blur();
		await expect(number).toHaveAttribute('aria-invalid', 'true');
		const error = ((await form.locator('#C-error').textContent()) ?? '')
			.replace(/\s+/g, ' ')
			.trim();
		expect(error).not.toBe('');
		await expect(number).toHaveAccessibleDescription(new RegExp(`^${escapeRegExp(error)}`));

		await useModel(page, 'decision-tree-classifier');
		await form.getByRole('combobox', { name: 'Maximum depth' }).selectOption('limited');
		await expect(
			form.getByRole('slider', { name: 'Maximum depth', exact: true }).first()
		).toBeVisible();
		await expect(
			form.getByRole('spinbutton', { name: 'Maximum depth (exact value)' })
		).toBeVisible();
		await expectControlsAccessible(form);

		await useModel(page, 'mlp-classifier');
		const layer = form.getByRole('spinbutton', { name: 'Layer 1 size' });
		await expect(layer).toBeVisible();
		await expect(layer).toHaveAttribute('min', '1');
		// Audit the last persisted form after exercising the transient controls in each model.
		await expect
			.poll(() =>
				page.evaluate(
					() => JSON.parse(localStorage.getItem('samata-ml:state')!).models[0]?.modelId
				)
			)
			.toBe('mlp-classifier');
		await page.reload();
		await expect(layer).toBeVisible();

		const axe = await new AxeBuilder({ page })
			.withTags(AXE_TAGS)
			.include('app-model-builder-view')
			.analyze();
		const unexpected = axe.violations.flatMap((v) =>
			v.nodes
				.filter(
					(n) =>
						!featureA11yFindings.some(
							(f) =>
								f.rule === v.id &&
								[f.target, ...(f.alternateTargets ?? [])].some(
									(t) => JSON.stringify(t) === JSON.stringify(n.target)
								)
						)
				)
				.map((n) => ({ rule: v.id, target: n.target, summary: n.failureSummary }))
		);
		expect(unexpected).toEqual([]);
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
		await step3.getByRole('button', { name: 'Edit Configure Model' }).click();
		await expect(builder.locator('dialog[data-confirm="reopen-section"]')).not.toBeVisible();
		await expect(step3).toHaveAttribute('aria-current', 'step');
		await form.locator('select#penalty').selectOption('l2');
		await expect(form.locator('#C-number')).toHaveValue('1');
		await expect(form.locator('#C-error')).toHaveCount(0);

		// With a later section complete, Edit asks first (from persisted state, after a reload)
		await form.locator('select#penalty').selectOption('none');
		await form.getByRole('button', { name: 'Save & Continue' }).click();
		await expect(step3.locator('h2')).toContainText('3. Model Configured');
		await page.evaluate(() => {
			const s = window.__appState!.get();
			window.__appState!.set({
				...s,
				models: s.models.map((m) => ({
					...m,
					trainingSetup: { type: 'one_shot', testRatio: 0.2, randomState: 42 },
					completedSteps: [...m.completedSteps, 'configure-training' as const]
				}))
			});
		});
		await expect
			.poll(() =>
				page.evaluate(
					() =>
						JSON.parse(localStorage.getItem('samata-ml:state')!).models[0]
							.completedSteps
				)
			)
			.toContain('configure-training');
		await page.reload();
		await dismissWelcome(page);
		const reloaded = page.locator('app-model-builder-view .train-step').nth(2);
		await expect(reloaded.locator('h2')).toContainText('3. Model Configured');
		expect(
			await page.evaluate(() => window.__appState!.get().models[0]!.completedSteps)
		).toContain('configure-training');
		await reloaded.getByRole('button', { name: 'Edit Configure Model' }).click();
		await expect(
			page.locator('app-model-builder-view dialog[data-confirm="reopen-section"]')
		).toBeVisible();
	});

	test('WML-P1-UI-4: a binary target saves multiclass as null', async ({ page }) => {
		const form = await openConfigure(page, 'Diagnosis', 'breast-cancer-wisconsin');
		await form.locator('select#penalty').selectOption('none');
		await form.getByRole('button', { name: 'Save & Continue' }).click();
		await expect(
			page.locator('app-model-builder-view .train-step').nth(2).locator('h2')
		).toContainText('3. Model Configured');
		const model = await page.evaluate(() => window.__appState!.get().models[0]!);
		expect(model.completedSteps).toContain('configure-model');
		expect(model.multiclass).toBeNull();
		await expect(form.locator('.form-note')).toHaveCount(0);
	});

	test('WML-P1-UI-9: Edit buttons for Sections 1 to 3 have exact accessible names', async ({
		page
	}) => {
		const form = await openConfigure(page);
		await form.locator('select#penalty').selectOption('none');
		await form.getByRole('button', { name: 'Save & Continue' }).click();
		const builder = page.locator('app-model-builder-view');
		await expect(builder.locator('.train-step').nth(2).locator('h2')).toContainText(
			'3. Model Configured'
		);
		for (const name of ['Edit Choose Model', 'Edit Select Features', 'Edit Configure Model']) {
			const button = builder.getByRole('button', { name, exact: true });
			await expect(button).toHaveCount(1);
			await expect(button).toBeVisible();
			await expect(button.getByText('Edit', { exact: true })).toBeVisible();
		}
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

	test.describe('Configure Model term definitions', () => {
		test.use({ hasTouch: true });

		test('TERM-AC-1: Configure Model Help works by keyboard and touch', async ({ page }) => {
			await openConfigure(page);
			const help = page.locator('app-model-builder-view a[href="/help/configure-model"]');
			const dialog = page.getByRole('dialog', { name: 'What do these settings mean?' });
			const article = dialog.locator('.modal-content');
			await help.focus();
			await page.keyboard.press('Enter');
			await expect(article).toContainText('The exact stopping check depends on the solver.');
			await expect(article).toContainText('limited-memory Broyden–Fletcher–Goldfarb–Shanno');
			await page.keyboard.press('Escape');
			await expect(dialog).toBeHidden();
			await expect(help).toBeFocused();

			await help.tap();
			await expect(dialog).toBeVisible();
			await dialog.getByRole('button', { name: 'Close' }).tap();
			await expect(dialog).toBeHidden();
		});
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
		await expect(page).toHaveURL(/\/models\/new$/);

		const form = page.locator('app-model-configuration');
		await form.locator('select#penalty').selectOption('l2');
		await form.locator('#C-number').fill('2');
		await expect
			.poll(() =>
				page.evaluate(() => {
					const raw = localStorage.getItem('samata-ml:state');
					return raw ? JSON.parse(raw).models[0]?.hyperparameters.values.C : undefined;
				})
			)
			.toBe(2);
		await page.reload();
		await expect(page.locator('app-model-configuration #C-number')).toHaveValue('2');
	});

	test('WML-P1-UI-6: keyboard-only completion shows focus on every control', async ({
		page,
		browserName
	}) => {
		const form = await openConfigure(page);
		await form.locator('select#mode').focus();
		// Safari on macOS skips buttons and checkboxes on a plain Tab (system setting); Alt+Tab is its Tab.
		const tabKey =
			browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab';
		const deepActive = () =>
			page.evaluate(() => {
				let el: Element | null = document.activeElement;
				while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
				return {
					text: el?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
					tag: el?.tagName ?? '',
					outline: el ? getComputedStyle(el).outlineStyle : 'none'
				};
			});
		let reached = false;
		for (let press = 0; press < 40 && !reached; press += 1) {
			await page.keyboard.press(tabKey);
			const active = await deepActive();
			expect(active.outline, `focus outline on ${active.tag} ${active.text}`).not.toBe(
				'none'
			);
			reached = active.tag === 'BUTTON' && active.text === 'Save & Continue';
		}
		expect(reached).toBe(true);
		await page.keyboard.press('Enter');
		await expect(
			page.locator('app-model-builder-view .train-step').nth(2).locator('h2')
		).toContainText('3. Model Configured');
	});

	test('WML-P1-UI-6: long labels fit at 320 px without horizontal overflow', async ({ page }) => {
		const form = await openConfigure(page);
		await useModel(page, 'support-vector-classifier');
		await form.locator('select#kernel').selectOption('poly');
		await page.setViewportSize({ width: 320, height: 800 });
		const clipped = await form
			.locator('.field-name, .field-description, button')
			.evaluateAll((elements) =>
				elements
					.filter((el) => el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1)
					.map((el) => el.textContent?.replace(/\s+/g, ' ').trim().slice(0, 40))
			);
		expect(clipped).toEqual([]);
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth > document.documentElement.clientWidth
		);
		expect(overflow).toBe(false);
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
			.getByRole('button', { name: 'Edit Configure Model' })
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
