import { expect, type Page } from '@playwright/test';
import type { ResultEnvelope } from '../../src/types/model-result';

/**
 * Dismisses the welcome modal if displayed.
 */
export async function dismissWelcomeModal(page: Page): Promise<void> {
	const getStartedBtn = page.locator('app-welcome-modal button.btn-primary');
	try {
		await getStartedBtn.waitFor({ state: 'visible', timeout: 2000 });
	} catch {
		return;
	}
	await getStartedBtn.click();
	await expect(page.locator('app-welcome-modal dialog')).toBeHidden();
	await expect
		.poll(() =>
			page.evaluate(() => {
				const state = localStorage.getItem('samata-ml:state');
				return state ? JSON.parse(state).onboarding.welcomeDismissed : false;
			})
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

/** Confirms the completed run and log survive reload before acknowledging Section 5. */
export async function acknowledgeDurableTraining(page: Page): Promise<{
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
		page.evaluate(async () => {
			const state = window.__appState!.get();
			const model = state.models.find((entry) => entry.num === 1)!;
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
		});
	const before = await savedResult();
	await page.reload();
	await expect(page.locator('.train-step[aria-current="step"] h2')).toHaveText('5. Train Model');
	await expect(viewResults).toBeEnabled();
	await expect(training.locator('details')).toHaveAttribute('open', '');
	await expect(training.locator('ol li').last()).toHaveText('Training complete');
	await expect(training.getByRole('status')).toBeEmpty();
	expect(await savedResult()).toEqual(before);

	await viewResults.click();
	await expect(page.getByRole('heading', { name: '6. Model Results' })).toBeFocused();
	await expect(page).toHaveURL('/models/1');
	await expect(training.getByText('Completed', { exact: true })).toHaveCount(1);
	await page.reload();
	await expect(page.locator('.train-step[aria-current="step"] h2')).toHaveText(
		'6. Model Results'
	);
	await expect(training.locator('ol li').last()).toHaveText('Training complete');
	return before;
}
