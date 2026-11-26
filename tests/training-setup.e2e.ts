import { expect, test, type Locator, type Page } from '@playwright/test';
import type { DatasetMetadata } from '../src/types/dataset';
import type { ModelSectionId, ValidationMethodology } from '../src/types/state';
import type { AppTrainingSetup } from '../src/features/models/app-training-setup';
import type { StorageRequest } from '../src/features/data/ingestion/protocol';
import { openLegacyModel, openLegacyTrainingSetup, openSetup } from './fixtures/training/browser';

const earlierSteps: ModelSectionId[] = ['choose-model', 'select-features', 'configure-model'];
const oneShot = { type: 'one_shot', testRatio: 0.2, randomState: 42 } as const;
const crossValidation = (folds: number) =>
	({ type: 'nested_cv', outerFolds: folds, innerFolds: folds, randomState: 42 }) as const;
const setupChanges = ['app-training-setup-change', 'app-training-setup-submit'] as const;
type SetupEventRecord = {
	type: string;
	detail: { setup: ValidationMethodology };
	bubbles: boolean;
	composed: boolean;
};

declare global {
	interface Window {
		__trainingSetupEvents?: SetupEventRecord[];
		__metadataRequests?: ((metadata: DatasetMetadata | null) => void)[];
	}
}

function builder(page: Page): Locator {
	return page.locator('app-model-builder-view');
}

function setupStep(page: Page): Locator {
	return builder(page).locator('section[aria-labelledby="step-4-title"]');
}

function setupForm(page: Page): Locator {
	return setupStep(page).locator('app-training-setup');
}

async function mountStandalone(
	page: Page,
	props: {
		value?: ValidationMethodology | null;
		maxFolds?: number;
		disabled?: boolean;
		blockedReason?: string;
	} = {}
): Promise<Locator> {
	await openSetup(page, false);
	await page.evaluate(
		async ({ props, types }) => {
			await customElements.whenDefined('app-training-setup');
			const fixture = document.createElement('div');
			fixture.dataset.testid = 'standalone-training-setup';
			const element = document.createElement('app-training-setup');
			Object.assign(element, props);
			const events: SetupEventRecord[] = [];
			window.__trainingSetupEvents = events;
			for (const type of types) {
				element.addEventListener(type, (event) => {
					const { detail, bubbles, composed } = event as CustomEvent<{
						setup: ValidationMethodology;
					}>;
					events.push({ type, detail, bubbles, composed });
				});
			}
			fixture.append(element);
			document.querySelector('#content')!.append(fixture);
			await element.updateComplete;
		},
		{ props, types: setupChanges }
	);
	return page.getByTestId('standalone-training-setup').locator('app-training-setup');
}

async function recordedEvents(page: Page): Promise<SetupEventRecord[]> {
	return page.evaluate(() => window.__trainingSetupEvents!);
}

async function trainingState(page: Page) {
	return page.evaluate(() => {
		const memory = window.__appState!.get();
		const wire = JSON.parse(localStorage.getItem('samata-ml:state')!);
		return {
			models: memory.models.map(({ num, trainingSetup, completedSteps, status }) => ({
				num,
				trainingSetup,
				completedSteps,
				status
			})),
			wireModels: wire.models.map(
				(model: { trainingSetup: unknown; completedSteps: ModelSectionId[] }) => ({
					trainingSetup: model.trainingSetup,
					completedSteps: model.completedSteps
				})
			)
		};
	});
}

async function setCounts(page: Page, counts: Record<string, number>): Promise<void> {
	await page.evaluate((categoryCounts) => {
		const app = window.__appState!.get();
		const store = window.__datasetResources!;
		const resource = store.get();
		const metadata = resource.metadata!;
		store.set({
			...resource,
			metadata: {
				...metadata,
				columns: metadata.columns.map((column) =>
					column.type === 'categorical' && column.name === app.target
						? {
								...column,
								categoryCounts,
								distinctCount: Object.keys(categoryCounts).length
							}
						: column
				)
			}
		});
	}, counts);
}

async function seedSetup(page: Page, trainingSetup: ValidationMethodology, completed = false) {
	await page.evaluate(
		({ trainingSetup, completed }) => {
			const store = window.__appState!;
			const state = store.get();
			store.set({
				...state,
				models: state.models.map((model) =>
					model.num === 1
						? {
								...model,
								trainingSetup,
								completedSteps: completed
									? [...model.completedSteps, 'configure-training']
									: model.completedSteps
							}
						: model
				)
			});
		},
		{ trainingSetup, completed }
	);
}

async function interceptMetadataRequests(page: Page): Promise<DatasetMetadata> {
	return page.evaluate(() => {
		const postMessage = Worker.prototype.postMessage;
		window.__metadataRequests = [];
		Worker.prototype.postMessage = function (
			this: Worker,
			message: unknown,
			options?: StructuredSerializeOptions | Transferable[]
		) {
			const request = message as StorageRequest;
			if (request.type !== 'getMetadata') {
				Reflect.apply(postMessage, this, [message, options]);
				return;
			}
			window.__metadataRequests!.push((metadata) =>
				this.dispatchEvent(
					new MessageEvent('message', {
						data: { requestId: request.requestId, type: 'result', value: metadata }
					})
				)
			);
		};
		return window.__datasetResources!.get().metadata!;
	});
}

test.describe('Standalone Training Setup component', () => {
	test('TERM-AC-4: the native select describes just the selected strategy', async ({
		page,
		browserName
	}) => {
		const form = await mountStandalone(page);
		const strategy = form.getByRole('combobox', { name: 'Training Strategy' });
		const oneShotHint = 'Train once on one part of the data and test on the part set aside.';
		const crossValidationHint =
			'Divide the data into groups, then train and check a model several times, using a different group for the check each time.';
		const description = form.locator('#strategy-description');
		await expect(strategy).toHaveAccessibleDescription(
			`${oneShotHint} Requests an 80% training and 20% held-out test split.`
		);
		await expect(description.getByRole('link')).toHaveCount(0);
		await expect(strategy.locator('option')).toHaveText(['One-Shot', 'Cross-Validation']);
		await expect(strategy.locator('option abbr')).toHaveCount(0);

		await strategy.focus();
		if (browserName === 'chromium') {
			await page.keyboard.press('c');
		} else {
			await strategy.selectOption('nested_cv');
		}
		await expect(strategy).toBeFocused();
		await expect(strategy).toHaveValue('nested_cv');
		await expect(strategy).toHaveAccessibleDescription(crossValidationHint);
		await expect(description).toHaveText(crossValidationHint);
		await expect(form.getByRole('spinbutton')).toHaveValue('5');
		await strategy.selectOption('one_shot');
		await expect(strategy).toBeFocused();
		await expect(description).toContainText(oneShotHint);
		await expect(description).not.toContainText(crossValidationHint);
	});

	test('WML-P2-COMP-1: strategy and range emit direct changes and redraw the matrix', async ({
		page
	}) => {
		const form = await mountStandalone(page);
		const strategy = form.getByRole('combobox', { name: 'Training Strategy' });
		await expect(strategy).toHaveValue('one_shot');
		expect(await recordedEvents(page)).toEqual([]);
		await strategy.selectOption('nested_cv');
		expect(await recordedEvents(page)).toEqual([
			{
				type: 'app-training-setup-change',
				detail: { setup: crossValidation(5) },
				bubbles: false,
				composed: false
			}
		]);
		const range = form.getByRole('slider');
		await range.press('ArrowRight');
		await expect(form.getByRole('spinbutton')).toHaveValue('6');
		await expect(form.locator('tbody tr')).toHaveCount(6);
		expect(
			await form
				.locator('tbody tr')
				.evaluateAll((rows) =>
					rows.map((row) =>
						[...row.querySelectorAll('td')].findIndex((cell) =>
							cell.classList.contains('fold-validation')
						)
					)
				)
		).toEqual([0, 1, 2, 3, 4, 5]);
		await expect(form.locator('.fold-visual-summary')).toContainText('83.3%');
		await expect(form.locator('.fold-visual-summary')).toContainText('16.7%');
		expect((await recordedEvents(page))[1]).toEqual({
			type: 'app-training-setup-change',
			detail: { setup: crossValidation(6) },
			bubbles: false,
			composed: false
		});

		await strategy.selectOption('one_shot');
		await form.evaluate(async (host) => {
			const element = host as AppTrainingSetup;
			element.maxFolds = 4;
			await element.updateComplete;
		});
		await strategy.selectOption('nested_cv');
		await expect(form.getByRole('spinbutton')).toHaveValue('4');
		expect((await recordedEvents(page)).at(-1)?.detail.setup).toEqual(crossValidation(4));
	});

	test('WML-P2-COMP-2: fold roles are available through named table headers and cells', async ({
		page
	}) => {
		const form = await mountStandalone(page, { value: crossValidation(5) });
		const region = form.getByRole('region', { name: 'Cross-validation training iterations' });
		await expect(region).toHaveAttribute('tabindex', '0');
		const table = region.getByRole('table', { name: 'Cross-validation training iterations' });
		await expect(table.locator('caption')).toHaveText('Cross-validation training iterations');
		await expect(table.locator('th[scope=col]')).toHaveCount(6);
		await expect(table.locator('th[scope=row]')).toHaveCount(5);
		await expect(table.locator('td > .visually-hidden')).toHaveCount(25);
		await expect(table.locator('td.fold-training .visually-hidden').first()).toHaveText(
			'Training'
		);
		await expect(table.locator('td.fold-validation .visually-hidden').first()).toHaveText(
			'Validation'
		);
		await expect(form.locator('.fold-visual-summary')).toContainText('80%');
		await expect(form.locator('.fold-visual-summary')).toContainText('20%');
	});

	test('WML-P2-COMP-3: saved out-of-range folds stay visible until corrected', async ({
		page
	}) => {
		const form = await mountStandalone(page, { value: crossValidation(5), maxFolds: 4 });
		const number = form.getByRole('spinbutton');
		await expect(number).toHaveValue('5');
		await expect(form.getByRole('slider')).toHaveValue('4');
		await expect(form.locator('tbody tr')).toHaveCount(5);
		await expect(number).toHaveAttribute('aria-describedby', /^folds-error\b/);
		await expect(number).toHaveAttribute('aria-invalid', 'true');
		await expect(form.locator('[aria-live]')).toBeEmpty();
		const submit = form.getByRole('button', { name: 'Train Model' });
		await submit.click();
		await expect(number).toBeFocused();
		expect(await recordedEvents(page)).toEqual([]);
		await number.fill('4');
		await submit.click();
		expect(
			(await recordedEvents(page)).filter(
				(event) => event.type === 'app-training-setup-submit'
			)
		).toEqual([
			{
				type: 'app-training-setup-submit',
				detail: { setup: crossValidation(4) },
				bubbles: false,
				composed: false
			}
		]);
	});

	for (const waitForRender of [false, true]) {
		const timing = waitForRender ? 'after rendering' : 'before rendering';
		test(`WML-P2-COMP-3: rejects stale saved folds when a draft becomes in range ${timing}`, async ({
			page
		}) => {
			const form = await mountStandalone(page, { value: crossValidation(10), maxFolds: 5 });
			const number = form.getByRole('spinbutton');
			const submit = form.getByRole('button', { name: 'Train Model' });
			await number.fill('7');
			await submit.focus();
			await expect(submit).toBeFocused();

			await form.evaluate(async (host, wait) => {
				const element = host as AppTrainingSetup;
				element.maxFolds = 8;
				if (wait) await element.updateComplete;
				element.shadowRoot!.querySelector('form')!.requestSubmit();
			}, waitForRender);
			expect(await recordedEvents(page)).toEqual([]);
			await expect(number).toHaveValue('7');
			await expect(number).toBeFocused();
			await expect(number).toHaveAttribute('aria-invalid', 'true');
			await expect(number).toHaveAccessibleDescription(
				/Enter a whole number between 2 and 8\./
			);

			await number.fill('8');
			await expect(number).toHaveAttribute('aria-invalid', 'false');
			await submit.click();
			expect((await recordedEvents(page)).at(-1)).toEqual({
				type: 'app-training-setup-submit',
				detail: { setup: crossValidation(8) },
				bubbles: false,
				composed: false
			});
		});
	}

	for (const [reason, props] of [
		['disabled', { disabled: true }],
		['blocked', { blockedReason: 'Choose a target with more labelled rows.' }],
		['below minimum folds', { maxFolds: 1 }]
	] as const) {
		test(`WML-P2-COMP-4: ${reason} controls emit no events before or after rendering`, async ({
			page
		}) => {
			const form = await mountStandalone(page, { value: crossValidation(5) });
			const submit = form.getByRole('button', { name: 'Train Model' });
			await expect(submit).toBeEnabled();
			await form.evaluate(async (host, changedProps) => {
				const element = host as AppTrainingSetup;
				const root = element.shadowRoot!;
				const strategy = root.querySelector('select')!;
				const inputs = root.querySelectorAll<HTMLInputElement>('input');
				const nativeForm = root.querySelector('form')!;
				const dispatch = (value: string) => {
					strategy.value = 'one_shot';
					strategy.dispatchEvent(new Event('change'));
					for (const input of inputs) {
						input.value = value;
						input.dispatchEvent(new Event('input'));
					}
					nativeForm.dispatchEvent(new SubmitEvent('submit', { cancelable: true }));
				};

				Object.assign(element, changedProps);
				dispatch('6');
				await element.updateComplete;
				dispatch('4');
			}, props);
			expect(await recordedEvents(page)).toEqual([]);
			for (const control of [
				form.getByRole('combobox'),
				form.getByRole('slider'),
				form.getByRole('spinbutton'),
				submit
			]) {
				await expect(control).toBeDisabled();
			}
			if ('blockedReason' in props) {
				await expect(form.getByRole('alert')).toBeVisible();
				await expect(submit).toHaveAttribute('aria-describedby', 'training-setup-blocked');
			} else {
				await expect(form.getByRole('alert')).toHaveCount(0);
				expect(await submit.getAttribute('aria-describedby')).toBeNull();
			}
		});
	}

	test('WML-P2-COMP-4: change handlers use new fold limits before rendering', async ({
		page
	}) => {
		const form = await mountStandalone(page);
		await form.evaluate(async (host) => {
			const element = host as AppTrainingSetup;
			const root = element.shadowRoot!;
			const strategy = root.querySelector('select')!;
			element.maxFolds = 4;
			strategy.value = 'nested_cv';
			strategy.dispatchEvent(new Event('change'));
			await element.updateComplete;

			const range = root.querySelector<HTMLInputElement>('#folds-range')!;
			element.maxFolds = 6;
			range.value = '3';
			range.dispatchEvent(new Event('input'));
			await element.updateComplete;

			element.maxFolds = 4;
			range.value = '6';
			range.dispatchEvent(new Event('input'));
		});
		expect(await recordedEvents(page)).toEqual([
			{
				type: 'app-training-setup-change',
				detail: { setup: crossValidation(4) },
				bubbles: false,
				composed: false
			},
			{
				type: 'app-training-setup-change',
				detail: { setup: crossValidation(3) },
				bubbles: false,
				composed: false
			}
		]);
		await expect(form.getByRole('spinbutton')).toHaveValue('3');
		await expect(form.getByRole('slider')).toHaveValue('3');
	});
});

test.describe('Connected Training Setup', () => {
	for (const strategy of ['one_shot', 'nested_cv'] as const) {
		test(`WML-P2-UI-1: submits and reloads ${strategy} with a durable result`, async ({
			page
		}) => {
			const form = await openSetup(page);
			await expect(form.getByRole('combobox')).toHaveValue('one_shot');
			expect((await trainingState(page)).models[0]?.trainingSetup).toBeNull();
			const value = strategy === 'one_shot' ? oneShot : crossValidation(7);
			const heading =
				strategy === 'one_shot' ? 'One-Shot Training' : '7 Fold Cross-Validation';
			const summary =
				strategy === 'one_shot' ? 'One-Shot (80% / 20%)' : 'Cross-Validation (7 folds)';
			if (strategy === 'nested_cv') {
				await form.getByRole('combobox').selectOption('nested_cv');
				await expect(form.getByRole('spinbutton')).toHaveValue('5');
				await form.getByRole('spinbutton').fill('7');
			}
			await form.getByRole('button', { name: 'Train Model' }).click();
			await expect(
				setupStep(page).getByRole('heading', { name: `4. ${heading}` })
			).toBeVisible();
			const progress = page.getByRole('progressbar', { name: 'Training progress' });
			await expect(progress).toHaveAttribute('value', '100', { timeout: 45000 });
			const before = await trainingState(page);
			expect(before.models[0]).toMatchObject({
				status: 'trained',
				trainingSetup: value,
				completedSteps: [...earlierSteps, 'configure-training', 'training']
			});
			expect(before.wireModels[0].trainingSetup).toEqual(
				strategy === 'one_shot' ? { ...oneShot, type: 'train_test_split' } : value
			);
			await page.reload();
			await expect(
				setupStep(page).getByRole('heading', { name: `4. ${heading}` })
			).toBeVisible();
			await expect(setupStep(page).locator('.completed-summary')).toContainText(summary);
			await expect(progress).toHaveAttribute('value', '100');
			expect(await trainingState(page)).toEqual(before);
		});
	}

	test('WML-P2-UI-2: invalid and empty drafts keep the saved folds and matrix', async ({
		page
	}) => {
		const form = await openSetup(page);
		const strategy = form.getByRole('combobox');
		await strategy.selectOption('nested_cv');
		await expect
			.poll(async () => (await trainingState(page)).wireModels[0]?.trainingSetup)
			.toEqual(crossValidation(5));
		const before = await trainingState(page);
		const number = form.getByRole('spinbutton');
		const submit = form.getByRole('button', { name: 'Train Model' });
		for (const badValue of ['1', '11', '']) {
			await number.fill(badValue);
			await number.press('Tab');
			await expect(number).toHaveValue(badValue);
			await expect(number).toHaveAttribute('aria-invalid', 'true');
			await expect(number).toHaveAttribute('aria-describedby', /^folds-error\b/);
			await expect(form.getByRole('slider')).toHaveValue('5');
			await expect(form.locator('tbody tr')).toHaveCount(5);
			await expect(submit).toBeEnabled();
			await submit.click();
			await expect(number).toBeFocused();
			expect(await trainingState(page)).toEqual(before);
		}
		await number.fill('5');
		await expect(number).toHaveAttribute('aria-invalid', 'false');
		await strategy.selectOption('one_shot');
		await expect(form.locator('#folds-error')).toHaveCount(0);
		await submit.click();
		await expect(
			setupStep(page).getByRole('heading', { name: '4. One-Shot Training' })
		).toBeVisible();
	});

	test('WML-P2-UI-2: unfinished exponent text survives a builder refresh and invalid submit', async ({
		page
	}) => {
		const form = await openSetup(page);
		await form.getByRole('combobox').selectOption('nested_cv');
		const number = form.getByRole('spinbutton');
		const original = await number.elementHandle();
		const before = await trainingState(page);
		await number.fill('1');
		await number.pressSequentially('e');
		await expect
			.poll(() => number.evaluate((el) => (el as HTMLInputElement).validity.badInput))
			.toBe(true);
		await builder(page).evaluate(async (el) => {
			const host = el as HTMLElementTagNameMap['app-model-builder-view'];
			host.requestUpdate();
			await host.updateComplete;
			await host.shadowRoot!.querySelector('app-training-setup')!.updateComplete;
		});
		expect(
			await number.evaluate(
				(node, previous) =>
					node === previous && (node as HTMLInputElement).validity.badInput,
				original
			)
		).toBe(true);
		const submit = form.getByRole('button', { name: 'Train Model' });
		await expect(submit).toBeEnabled();
		await submit.click();
		await expect(number).toBeFocused();
		await expect(number).toHaveAttribute('aria-invalid', 'true');
		await expect(number).toHaveAttribute('aria-describedby', /^folds-error\b/);
		await expect(form.getByRole('slider')).toHaveValue('5');
		await expect(form.locator('tbody tr')).toHaveCount(5);
		expect(await trainingState(page)).toEqual(before);
	});

	test('WML-P2-UI-3: the four-row minority limits default folds and keeps a saved larger count until corrected', async ({
		page
	}) => {
		const form = await openSetup(page);
		await setCounts(page, { a: 100, b: 4 });
		await form.getByRole('combobox').selectOption('nested_cv');
		const number = form.getByRole('spinbutton');
		await expect(number).toHaveValue('4');
		const submit = form.getByRole('button', { name: 'Train Model' });
		await expect(form.getByRole('slider')).toHaveValue('4');
		await seedSetup(page, crossValidation(5));
		await expect(number).toHaveValue('5');
		await expect(form.getByRole('slider')).toHaveValue('4');
		await expect(number).toHaveAttribute('aria-invalid', 'true');
		await submit.click();
		await expect(number).toBeFocused();
		expect((await trainingState(page)).models[0]?.completedSteps).toEqual(earlierSteps);
		await number.fill('4');
		await expect(number).toHaveAttribute('aria-invalid', 'false');
		await submit.click();
		await expect(
			setupStep(page).getByRole('heading', { name: '4. 4 Fold Cross-Validation' })
		).toBeVisible();
	});

	test('WML-P2-UI-3: single-class metadata rejects same-turn changes and blocks every control', async ({
		page
	}) => {
		const form = await openSetup(page);
		await form.getByRole('combobox').selectOption('nested_cv');
		await expect(form.getByRole('spinbutton')).toHaveValue('5');
		await expect
			.poll(async () => (await trainingState(page)).wireModels[0]?.trainingSetup)
			.toEqual(crossValidation(5));
		const before = await trainingState(page);
		await form.evaluate(
			(element, { setup, types }) => {
				const resources = window.__datasetResources!;
				const current = resources.get();
				const metadata = current.metadata!;
				resources.set({
					...current,
					metadata: {
						...metadata,
						columns: metadata.columns.map((column) =>
							column.type === 'categorical' && column.name === 'class'
								? { ...column, distinctCount: 1, categoryCounts: { only: 150 } }
								: column
						)
					}
				});
				for (const type of types)
					element.dispatchEvent(new CustomEvent(type, { detail: { setup } }));
			},
			{ setup: oneShot, types: setupChanges }
		);
		await expect(form.getByRole('alert')).toContainText(
			'at least two classes with two labelled rows each'
		);
		await expect(
			setupStep(page).getByRole('link', { name: 'Choose a target' })
		).toHaveAttribute('href', '/target');
		for (const control of [
			form.getByRole('combobox'),
			form.getByRole('slider'),
			form.getByRole('spinbutton'),
			form.getByRole('button', { name: 'Train Model' })
		]) {
			await expect(control).toBeDisabled();
		}
		await form.evaluate((element) => {
			for (const control of element.shadowRoot!.querySelectorAll('select, input')) {
				control.dispatchEvent(
					new Event(control instanceof HTMLSelectElement ? 'change' : 'input')
				);
			}
			element.shadowRoot!.querySelector('form')!.requestSubmit();
		});
		expect(await trainingState(page)).toEqual(before);
	});

	test('TERM-AC-5: WML-P2-UI-4 both Help links open the article and preserve the form', async ({
		page
	}) => {
		const form = await openSetup(page);
		await seedSetup(page, oneShot, true);
		const edit = setupStep(page).getByRole('button', { name: 'Edit Training Setup' });
		await expect(edit).toHaveText('Edit');
		await edit.click();
		await expect(form).toBeVisible();
		await expect(builder(page).locator('dialog[data-confirm="reopen-section"]')).toBeHidden();

		await setupStep(page).getByRole('link', { name: 'What is this?' }).click();
		const modal = page.getByRole('dialog', { name: 'Training Setup' });
		await expect(page).toHaveURL('/help/training-setup');
		const article = modal.locator('.modal-content');
		for (const text of [
			'Rows left out of training for the model that made those predictions',
			'The test rows are set aside to check how it performs on other rows',
			'A stratified split tries to keep the shares of each class similar',
			'The validation fold is the group set aside for one check',
			'Train the final model again using all the eligible rows'
		]) {
			await expect(article).toContainText(text, { ignoreCase: true });
		}
		await modal.getByRole('button', { name: 'Close' }).click();
		await expect(page).toHaveURL('/models/new');

		await form.getByRole('combobox').selectOption('nested_cv');
		const number = form.getByRole('spinbutton');
		const link = form.getByRole('link', { name: 'Learn more' });
		await number.fill('11');
		await link.focus();
		await expect(number).toHaveAttribute('aria-invalid', 'true');
		const before = await trainingState(page);
		const [oldForm, oldNumber, oldLink] = await Promise.all([
			form.elementHandle(),
			number.elementHandle(),
			link.elementHandle()
		]);
		await page.keyboard.press('Enter');
		await expect(page).toHaveURL('/help/training-setup');
		await expect(modal).toBeVisible();
		await expect(article).toContainText(
			'using all the eligible rows after cross-validation has checked performance'
		);
		await builder(page).evaluate(async (el) => {
			const host = el as HTMLElementTagNameMap['app-model-builder-view'];
			host.requestUpdate();
			await host.updateComplete;
		});
		await form.evaluate(
			(element, { setup, types }) => {
				for (const type of types)
					element.dispatchEvent(new CustomEvent(type, { detail: { setup } }));
			},
			{ setup: oneShot, types: setupChanges }
		);
		expect(await trainingState(page)).toEqual(before);
		await modal.getByRole('button', { name: 'Close' }).click();
		await expect(page).toHaveURL('/models/new');
		for (const [locator, original] of [
			[form, oldForm],
			[number, oldNumber],
			[link, oldLink]
		] as const) {
			expect(
				await locator.evaluate(
					(element, previous) => element.isConnected && element === previous,
					original
				)
			).toBe(true);
		}
		await expect(number).toHaveValue('11');
		await expect(number).toHaveAttribute('aria-invalid', 'true');
		await expect(link).toBeFocused();

		await seedSetup(page, crossValidation(5), true);
		await page.evaluate(() => {
			const state = window.__appState!;
			const current = state.get();
			state.set({
				...current,
				models: current.models.map((model) => ({
					...model,
					completedSteps: [...model.completedSteps, 'training']
				}))
			});
		});
		await edit.click();
		await expect(
			builder(page).getByRole('dialog', { name: 'Confirm Reopening Section' })
		).toBeVisible();
	});

	for (const targetState of ['eligible', 'blocked', 'missing'] as const) {
		test(`WML-P2-UI-4: Section 4 link has visible keyboard focus when the target is ${targetState}`, async ({
			page,
			browserName
		}) => {
			const form = await openSetup(page);
			const section = setupStep(page);
			const help = section.getByRole('link', { name: 'What is this?' });
			const recovery = section.getByRole('link', { name: 'Choose a target' });
			let previous = builder(page).getByRole('button', { name: 'Edit Configure Model' });
			if (targetState === 'blocked') {
				await setCounts(page, { a: 100 });
				previous = form.getByRole('link', { name: 'Learn more' });
			} else if (targetState === 'missing') {
				await page.evaluate(() => {
					const target = window.__appState!.get().target;
					const resources = window.__datasetResources!;
					const current = resources.get();
					const metadata = current.metadata!;
					resources.set({
						...current,
						metadata: {
							...metadata,
							columns: metadata.columns.filter((column) => column.name !== target)
						}
					});
				});
				previous = help;
			}
			const link = targetState === 'eligible' ? help : recovery;
			await expect(link).toBeVisible();
			await previous.focus();
			await expect(previous).toBeFocused();
			await page.keyboard.press('Tab');
			if (
				browserName === 'webkit' &&
				process.platform === 'darwin' &&
				!(await link.evaluate((element) => element.matches(':focus')))
			) {
				// Safari on macOS can require Option-Tab to include links in keyboard navigation.
				await previous.focus();
				await page.keyboard.press('Alt+Tab');
			}
			await expect(link).toBeFocused();
			expect(await link.evaluate((element) => element.matches(':focus-visible'))).toBe(true);

			const tokenColour = await link.evaluate((element) => {
				const reference = document.createElement('span');
				reference.style.color = 'var(--focus-ring)';
				element.append(reference);
				const colour = getComputedStyle(reference).color;
				reference.remove();
				return colour;
			});
			await expect(link).toHaveCSS('outline-color', tokenColour);
			await expect(link).toHaveCSS('outline-style', 'solid');
			await expect(link).toHaveCSS('outline-width', '2px');
			await expect(link).toHaveCSS('outline-offset', '2px');

			await page.emulateMedia({ forcedColors: 'active' });
			expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(
				true
			);
			await expect(link).toBeFocused();
			await expect(link).toHaveCSS('outline-style', 'solid');
			await expect(link).toHaveCSS('outline-width', '2px');
			const colours = await link.evaluate((element) => ({
				outline: getComputedStyle(element).outlineColor,
				background: getComputedStyle(element.closest('.train-step')!).backgroundColor
			}));
			expect(colours.outline).not.toBe('rgba(0, 0, 0, 0)');
			expect(colours.outline).not.toBe(colours.background);
		});
	}

	for (const direction of ['ltr', 'rtl'] as const) {
		test(`WML-P2-UI-5: ten folds scroll by keyboard in ${direction} with visible markers in forced colours`, async ({
			page,
			browserName
		}) => {
			const form = await openSetup(page);
			await form.getByRole('combobox').selectOption('nested_cv');
			await form.getByRole('spinbutton').fill('10');
			await page.setViewportSize({ width: 320, height: 900 });
			await page.evaluate((direction) => {
				document.documentElement.dir = direction;
			}, direction);
			const region = form.getByRole('region', {
				name: 'Cross-validation training iterations'
			});
			expect(
				await region.evaluate((el) => el.scrollWidth > el.clientWidth && el.clientWidth > 0)
			).toBe(true);
			expect(
				await page.evaluate(
					() =>
						document.documentElement.scrollWidth <= document.documentElement.clientWidth
				)
			).toBe(true);
			await form.getByRole('spinbutton').focus();
			await page.keyboard.press('Tab');
			await expect(region).toBeFocused();
			const arrow = direction === 'ltr' ? 'ArrowRight' : 'ArrowLeft';
			await expect(
				region.getByRole('columnheader', { name: '10', exact: true })
			).toBeVisible();
			await page.keyboard.press(arrow);
			await expect
				.poll(
					async () => {
						const lastFoldVisible = await region.evaluate((el) => {
							const last = el
								.querySelector('thead th:last-child')!
								.getBoundingClientRect();
							const wrapper = el.getBoundingClientRect();
							return last.left >= wrapper.left - 1 && last.right <= wrapper.right + 1;
						});
						if (!lastFoldVisible) await page.keyboard.press(arrow);
						return lastFoldVisible;
					},
					{
						message:
							'The focused matrix scrolls until the fold 10 header is fully visible',
						intervals: [250],
						timeout: 10_000
					}
				)
				.toBe(true);

			const learnMore = form.getByRole('link', { name: 'Learn more' });
			const strategy = form.getByRole('combobox');
			await strategy.focus();
			await page.keyboard.press('Tab');
			if (
				browserName === 'webkit' &&
				process.platform === 'darwin' &&
				!(await learnMore.evaluate((link) => link.matches(':focus')))
			) {
				// Safari's default macOS keyboard navigation includes links with Option-Tab.
				await strategy.focus();
				await page.keyboard.press('Alt+Tab');
			}
			await expect(learnMore).toBeFocused();
			expect(
				await learnMore.evaluate((link) => {
					const style = getComputedStyle(link);
					const reference = document.createElement('span');
					reference.style.color = 'var(--focus-ring)';
					link.append(reference);
					const expected = getComputedStyle(reference).color;
					reference.remove();
					return (
						link.matches(':focus-visible') &&
						style.outlineStyle === 'solid' &&
						style.outlineWidth === '2px' &&
						style.outlineOffset === '2px' &&
						style.outlineColor === expected
					);
				})
			).toBe(true);

			await page.emulateMedia({ forcedColors: 'active' });
			expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(
				true
			);
			await expect(learnMore).toHaveCSS('outline-style', 'solid');
			await expect(learnMore).toHaveCSS('outline-width', '2px');
			for (const [role, marker, border] of [
				['training', '–', 'dashed'],
				['validation', '✓', 'solid']
			] as const) {
				const cell = region.locator(`td.fold-${role}`).first();
				const swatch = form.locator(
					`.fold-legend-swatch-${role === 'training' ? 'train' : 'validation'}`
				);
				await expect(cell.locator('span[aria-hidden=true]')).toHaveText(marker);
				await expect(cell.locator('span[aria-hidden=true]')).toBeVisible();
				await expect(swatch).toHaveText(marker);
				await expect(swatch).toBeVisible();
				await expect(cell).toHaveCSS('border-top-style', border);
				await expect(swatch).toHaveCSS('border-top-style', border);
			}
		});
	}

	test('WML-P2-UI-6: loading, failed and malformed metadata guard both events and allow one Retry', async ({
		page
	}) => {
		const form = await openSetup(page);
		const metadata = await interceptMetadataRequests(page);
		const before = await trainingState(page);
		await form.evaluate(
			(element, { setup, types }) => {
				const resources = window.__datasetResources!;
				resources.set({ ...resources.get(), metadata: null, status: 'idle' });
				for (const type of types)
					element.dispatchEvent(new CustomEvent(type, { detail: { setup } }));
			},
			{ setup: oneShot, types: setupChanges }
		);
		await expect(setupStep(page).getByRole('status')).toContainText('Loading dataset metadata');
		await expect.poll(() => page.evaluate(() => window.__metadataRequests!.length)).toBe(1);
		expect(await trainingState(page)).toEqual(before);

		await page.evaluate(() => window.__metadataRequests![0]!(null));
		await expect(setupStep(page).getByRole('alert')).toContainText(
			'dataset metadata could not be read'
		);
		const retry = setupStep(page).getByRole('button', { name: 'Retry' });
		await retry.click();
		await expect.poll(() => page.evaluate(() => window.__metadataRequests!.length)).toBe(2);
		await page.evaluate((metadata) => window.__metadataRequests![1]!(metadata), metadata);
		await expect(form).toBeVisible();
		expect(await page.evaluate(() => window.__metadataRequests!.length)).toBe(2);
		await seedSetup(page, oneShot, true);
		await setupStep(page).getByRole('button', { name: 'Edit Training Setup' }).click();
		await expect
			.poll(async () => (await trainingState(page)).wireModels[0]?.completedSteps)
			.not.toContain('configure-training');
		const reopened = await trainingState(page);
		await form.evaluate(
			(element, { setup, types }) => {
				const resources = window.__datasetResources!;
				const current = resources.get();
				resources.set({
					...current,
					metadata: {
						...current.metadata!,
						columns: current.metadata!.columns.map((column) =>
							column.type === 'categorical' && column.name === 'class'
								? { ...column, categoryCounts: { invalid: -1, other: 100 } }
								: column
						)
					}
				});
				for (const type of types)
					element.dispatchEvent(new CustomEvent(type, { detail: { setup } }));
			},
			{ setup: crossValidation(3), types: setupChanges }
		);
		await expect(setupStep(page).getByRole('alert')).toContainText(
			'class counts for this target could not be read'
		);
		await expect(retry).toBeVisible();
		expect(await trainingState(page)).toEqual(reopened);
	});

	test('WML-P2-UI-6: changed target and mismatched dataset reject stale events and late metadata', async ({
		page
	}) => {
		const form = await openLegacyTrainingSetup(page);
		const metadata = await interceptMetadataRequests(page);
		const before = await trainingState(page);
		await form.evaluate(
			(element, { setup, types }) => {
				const app = window.__appState!;
				const original = app.get();
				app.set({ ...original, target: 'petal length' });
				for (const type of types)
					element.dispatchEvent(new CustomEvent(type, { detail: { setup } }));
				app.set({ ...app.get(), target: original.target });
				const resources = window.__datasetResources!;
				resources.set({ ...resources.get(), datasetId: 'earlier-dataset' });
				for (const type of types)
					element.dispatchEvent(new CustomEvent(type, { detail: { setup } }));
			},
			{ setup: oneShot, types: setupChanges }
		);
		await expect(setupStep(page).getByRole('status')).toBeVisible();
		await expect.poll(() => page.evaluate(() => window.__metadataRequests!.length)).toBe(1);
		expect(await trainingState(page)).toEqual(before);

		await page.evaluate(() => {
			const app = window.__appState!;
			const state = app.get();
			app.set({
				...state,
				dataset: { ...state.dataset!, id: 'new-dataset' },
				target: 'missing-target'
			});
		});
		await expect.poll(() => page.evaluate(() => window.__metadataRequests!.length)).toBe(2);
		await page.evaluate((metadata) => window.__metadataRequests![0]!(metadata), metadata);
		await expect(setupStep(page).getByRole('status')).toBeVisible();
		expect(await trainingState(page)).toEqual(before);

		await page.evaluate(
			(metadata) => window.__metadataRequests![1]!({ ...metadata, id: 'new-dataset' }),
			metadata
		);
		await expect(
			setupStep(page).getByText('The current target is unavailable for training setup.')
		).toBeVisible();
		await expect(
			setupStep(page).getByRole('link', { name: 'Choose a target' })
		).toHaveAttribute('href', '/target');
		expect(await trainingState(page)).toEqual(before);
	});

	for (const otherFolds of [5, 7]) {
		test(`WML-P2-UI-7: an invalid Model 1 draft stays out of Model 2 with ${otherFolds} saved folds`, async ({
			page
		}) => {
			const form = await openLegacyTrainingSetup(page, [
				crossValidation(5),
				crossValidation(otherFolds)
			]);
			const number = form.getByRole('spinbutton');
			await number.fill('1');
			await number.pressSequentially('e');
			await expect
				.poll(() => number.evaluate((el) => (el as HTMLInputElement).validity.badInput))
				.toBe(true);
			await number.press('Tab');
			await expect(form.locator('[aria-live]')).toContainText('Enter a valid whole number.');
			await openLegacyModel(page, 2);
			await expect(page).toHaveURL('/models/2');
			await expect(number).toHaveValue(String(otherFolds));
			await expect(number).toHaveAttribute('aria-invalid', 'false');
			await expect(form.locator('[aria-live]')).toBeEmpty();
			await number.fill('6');
			await number.press('Tab');
			await expect(number).toHaveValue('6');
			await openLegacyModel(page, 1);
			await expect(page).toHaveURL('/models/1');
			await expect(number).toHaveValue('5');
			await expect(number).toHaveAttribute('aria-invalid', 'false');
			await expect(form.locator('[aria-live]')).toBeEmpty();
			expect((await trainingState(page)).models.map((model) => model.trainingSetup)).toEqual([
				crossValidation(5),
				crossValidation(6)
			]);
		});
	}

	test('WML-P2-UI-8: the connected five-fold matrix includes localised percentages', async ({
		page
	}) => {
		const form = await openSetup(page);
		await form.getByRole('combobox').selectOption('nested_cv');
		await expect(form.locator('.fold-visual-summary')).toContainText('4 folds (80%)');
		await expect(form.locator('.fold-visual-summary')).toContainText('1 fold (20%)');
	});
});
