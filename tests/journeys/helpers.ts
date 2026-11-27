import { expect, type Page } from '@playwright/test';
import type { ResultEnvelope } from '../../src/types/model-result';

/**
 * Dismisses the welcome modal if displayed.
 */
export async function dismissWelcomeModal(page: Page): Promise<void> {
	const welcome = page.locator('app-welcome-modal');
	const activation = await welcome.evaluate(
		async (host: HTMLElementTagNameMap['app-welcome-modal']) => {
			await host.updateComplete;
			const dialog = host.shadowRoot?.querySelector('dialog');
			if (!dialog?.open) return null;
			return dialog.getAttribute('aria-describedby') === 'welcome-beta'
				? 'betaTelemetryAccepted'
				: 'welcomeDismissed';
		}
	);
	if (!activation) return;
	await welcome.getByRole('button', { name: 'Get Started', exact: true }).click();
	await expect(welcome.locator('dialog')).toBeHidden();
	await expect
		.poll(() =>
			page.evaluate((field) => {
				const state = localStorage.getItem('samata-ml:state');
				return state ? JSON.parse(state).onboarding[field] : false;
			}, activation)
		)
		.toBe(true);
}

/**
 * Selects and loads a sample dataset from the catalogue by clicking its "Load" button.
 */
export async function loadSampleDataset(page: Page, datasetId: string): Promise<void> {
	await dismissWelcomeModal(page);
	const card = page.locator(`app-dataset-card[dataset-id="${datasetId}"]`);
	await card.waitFor({ state: 'visible', timeout: 5000 });
	await card.locator('button.btn-primary').click();

	const preview = page.locator('app-dataset-preview');
	await expect(preview).toBeVisible({ timeout: 10000 });

	const table = preview.locator('ui-virtual-table');
	await expect(table).toBeVisible({ timeout: 10000 });
}

/** Views the acknowledged result on its numbered route and checks the history replacement. */
export async function viewNumberedTrainingResult(
	page: Page,
	modelNum: number,
	modelName: string
): Promise<void> {
	const training = page.getByTestId('training-step');
	const viewResults = training.getByRole('button', { name: 'View Results', exact: true });
	await expect(viewResults).toBeEnabled({ timeout: 45_000 });
	await expect(page).toHaveURL('/models/new');
	const sidebar = page.locator('app-sidebar');
	await expect(sidebar.locator('.step-model-link[aria-current="page"]')).toHaveText(
		'Training New Model…'
	);

	const historyLength = await page.evaluate(() => history.length);
	await viewResults.click();
	await expect(page).toHaveURL(`/models/${modelNum}`);
	await expect(
		page.getByRole('heading', {
			level: 1,
			name: `${modelNum} ${modelName} Results`,
			exact: true
		})
	).toBeFocused();
	expect(await page.evaluate(() => history.length)).toBe(historyLength);
	await expect(training).toHaveCount(0);
	await expect(
		sidebar.locator(`a.step-trained-model[href="/models/${modelNum}"]`)
	).toHaveAttribute('aria-current', 'page');
}

/** Confirms the completed run and log survive reload before acknowledging Section 5. */
export async function acknowledgeDurableTraining(
	page: Page,
	modelNum: number,
	modelName: string
): Promise<{
	runId: string;
	strategy: string;
	rows: number;
	trainCount: number;
	testCount: number;
	foldCount: number;
	refitComplete: boolean;
}> {
	const training = page.getByTestId('training-step');
	const viewResults = training.getByRole('button', { name: 'View Results' });
	await expect(viewResults).toBeEnabled({ timeout: 45_000 });
	await expect(training.getByRole('progressbar', { name: 'Training progress' })).toHaveAttribute(
		'value',
		'100'
	);
	await expect(training.getByText(/^Elapsed time/)).toBeVisible();
	await expect(training.getByText('Completed', { exact: true })).toHaveCount(0);
	await training.locator('summary').click();
	await expect(training.locator('details')).toHaveAttribute('open', '');
	await expect(training.locator('ol li').last()).toHaveText('Training complete');

	const savedResult = () =>
		page.evaluate(async (num) => {
			const state = window.__appState!.get();
			const model = state.models.find((entry) => entry.num === num)!;
			const db = await new Promise<IDBDatabase>((resolve, reject) => {
				const request = indexedDB.open('samata-db');
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});
			try {
				const result = await new Promise<ResultEnvelope>((resolve, reject) => {
					const get = db
						.transaction('model_results')
						.objectStore('model_results')
						.get([state.dataset!.id, model.num]);
					get.onsuccess = () => resolve(get.result);
					get.onerror = () => reject(get.error);
				});
				if (result.runId !== model.resultRevision)
					throw new Error('The saved result revision does not match the model');
				return {
					runId: result.runId,
					strategy: result.strategy,
					rows: result.sourceRowIndices.length,
					trainCount:
						result.strategy === 'one_shot' ? result.holdout.trainIndices.length : 0,
					testCount:
						result.strategy === 'one_shot' ? result.holdout.testIndices.length : 0,
					foldCount:
						result.strategy === 'cross_validation'
							? result.crossValidation.folds.length
							: 0,
					refitComplete: result.logEntries.some(
						(entry) => entry.message.key === 'refit-complete'
					)
				};
			} finally {
				db.close();
			}
		}, modelNum);
	const before = await savedResult();
	await page.reload();
	await expect(page.locator('.train-step[aria-current="step"] h2')).toHaveText(
		'5. Training Complete'
	);
	await expect(viewResults).toBeEnabled();
	await expect(training.locator('details')).toHaveAttribute('open', '');
	await expect(training.locator('ol li').last()).toHaveText('Training complete');
	await expect(training.getByRole('status')).toBeEmpty();
	expect(await savedResult()).toEqual(before);

	await viewNumberedTrainingResult(page, modelNum, modelName);
	await page.reload();
	await expect(
		page.getByRole('heading', {
			level: 1,
			name: `${modelNum} ${modelName} Results`,
			exact: true
		})
	).toBeVisible();
	await expect(page.locator('app-model-results')).toBeVisible();
	return before;
}

/** What a real, numbered results page must show for a multiclass journey. */
export interface PopulatedResultsExpectation {
	readonly protocol: 'one_shot' | 'cross_validation';
	readonly folds?: number;
	/** Held-out rows scored. */
	readonly heldOutRows: number;
}

/**
 * Confirms the numbered page shows every shared multiclass block for a real trained model: headline,
 * fold or test-split score, Classee errors, confusion matrix, per-class table and calibration
 * state, in order. Draws no threshold explorer.
 */
export async function expectPopulatedResults(
	page: Page,
	expected: PopulatedResultsExpectation
): Promise<void> {
	const results = page.locator('app-model-results');
	await expect(results.locator('app-results-summary')).toBeVisible({ timeout: 15_000 });
	await expect(results.locator('h2')).toHaveText([
		'Scores on held-out rows',
		expected.protocol === 'one_shot' ? 'Score on the test split' : 'Scores across folds',
		'Where the model makes mistakes',
		'Calibration'
	]);
	const summary = results.locator('app-results-summary');
	await expect(summary).toContainText(`Held-out rows scored: ${expected.heldOutRows}`);
	await expect(summary).toContainText(
		expected.protocol === 'one_shot'
			? 'One test split'
			: `${expected.folds}-fold cross-validation`
	);
	await expect(summary.locator('.headline dt').first()).toHaveText(
		'Balanced accuracy on held-out rows'
	);
	await expect(results.locator('app-fold-strip svg[role="img"]')).toBeVisible();
	await expect(results.locator('app-classee-strips svg[role="img"]')).toBeVisible();
	await expect(results.locator('app-confusion-matrix table')).toBeVisible();
	await expect(results.locator('app-class-metrics-table table')).toBeVisible();
	await expect(results.locator('app-threshold-explorer')).toHaveCount(0);
	await expect(results.getByRole('alert')).toHaveCount(0);
}
