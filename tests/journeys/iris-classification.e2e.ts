import { expect, test } from '@playwright/test';
import {
	acknowledgeDurableTraining,
	expectPopulatedResults,
	loadSampleDataset,
	viewNumberedTrainingResult
} from './helpers';
import { configureOpenDraft, openSidebarDraft } from '../fixtures/training/browser';

test('DOT-AC-3 / JOURNEY-IRIS-COMPARE: train two cross-validation models and consume the two completion suggestions', async ({
	page
}) => {
	test.setTimeout(120_000);
	await page.goto('/data');
	await loadSampleDataset(page, 'iris');
	const sidebar = page.locator('app-sidebar');
	const compare = sidebar.locator('a[href="/results"]');
	await sidebar.locator('a[href="/target"]').click();
	await page.locator('app-target-view tbody tr:has(th:has-text("class")) button').click();
	await sidebar.locator('a[href="/models"]').click();
	for (const [expectedNumber, label] of [
		[1, 'Train New Model'],
		[2, 'Train Another Model']
	] as const) {
		await expect(
			sidebar.getByRole('link', { name: label, exact: true }).locator('.dot')
		).toBeVisible();
		const num = await openSidebarDraft(page, label);
		expect(num).toBe(expectedNumber);
		await expect(sidebar.locator('.dot')).toHaveCount(0);
		const setup = await configureOpenDraft(page, num);
		await setup.getByRole('combobox', { name: 'Training Strategy' }).selectOption('nested_cv');
		await setup.getByRole('spinbutton').fill('4');
		await setup.getByRole('button', { name: 'Train Model' }).click();
		await expect(page.getByRole('button', { name: 'View Results', exact: true })).toBeEnabled({
			timeout: 45_000
		});
		await expect(page).toHaveURL('/models/new');
		if (num === 1) {
			await expect(sidebar.locator('.dot')).toHaveCount(0);
		} else {
			await expect(compare.locator('.dot')).toBeVisible();
		}
		await viewNumberedTrainingResult(page, num, 'Logistic Regression');
		await expect(
			page.locator('app-model-results summary').filter({ hasText: 'Training Details' })
		).toBeVisible();
	}
	await expect(compare.locator('.dot')).toBeVisible();
	await compare.click();
	await expect(sidebar.locator('.dot')).toHaveCount(0);
	await expect(page.locator('app-results-view app-comparison-table')).toBeVisible();
	await expect(page.locator('app-rope-bar figure')).toBeVisible({ timeout: 45_000 });
	await page.goBack();
	await expect(page).toHaveURL('/models/2');
	await expect(sidebar.locator('.dot')).toHaveCount(0);
	await page.goForward();
	await expect(page).toHaveURL('/results');
	await expect(sidebar.locator('.dot')).toHaveCount(0);
});

test.describe('Reference Journey: Iris Classification (JOURNEY-IRIS-DATA)', () => {
	test.describe.configure({ mode: 'serial' });

	test('JOURNEY-IRIS-DATA: load sample dataset, preview contents, inspect columns, and resume on reload', async ({
		page
	}) => {
		await page.goto('/data');

		// 1. Load Iris sample dataset
		await loadSampleDataset(page, 'iris');

		const preview = page.locator('app-dataset-preview');
		await expect(preview).toBeVisible();

		// 2. Verify preview header and summary
		await expect(preview.locator('.page-header h1')).toHaveText(
			'Preview Dataset: Iris Flower Species'
		);
		await expect(preview.locator('.page-header p')).toContainText('150 rows | 5 columns');

		// 3. Verify sidebar reflects loaded dataset
		const sidebarItem = page.locator('app-sidebar a[href="/data"]');
		await expect(sidebarItem).toBeVisible();
		await expect(sidebarItem.locator('.step-value')).toHaveText('Iris Flower Species');
		await expect(sidebarItem.locator('.chiclet')).toHaveText(['150 rows', '5 columns']);

		// 4. Verify virtual table column headers
		const table = preview.locator('ui-virtual-table');
		const expectedColumns = [
			'sepal length',
			'sepal width',
			'petal length',
			'petal width',
			'class'
		];
		for (const col of expectedColumns) {
			await expect(table.locator(`.header-btn[data-col-key="${col}"]`)).toBeVisible();
		}

		// 5. Inspect numeric column (sepal length)
		const sepalLengthBtn = table.locator('.header-btn[data-col-key="sepal length"]');
		await sepalLengthBtn.click();
		const aside = page.locator('app-column-details aside.overlay');
		await expect(aside).toBeVisible();
		await expect(aside.locator('.overlay-title h4')).toHaveText('sepal length');
		await expect(aside.locator('code.type-tag')).toHaveText('numeric');
		await expect(aside.locator('table.table').first()).toBeVisible();

		// Close inspector
		await aside.locator('.btn-icon[aria-label="Close"]').click();
		await expect(aside).not.toBeVisible();

		// 6. Inspect categorical column (class)
		const classBtn = table.locator('.header-btn[data-col-key="class"]');
		await classBtn.click();
		await expect(aside).toBeVisible();
		await expect(aside.locator('.overlay-title h4')).toHaveText('class');
		await expect(aside.locator('code.type-tag')).toHaveText('categorical');
		await expect(aside.locator('table.table').first()).toBeVisible();

		// Close inspector
		await aside.locator('.btn-icon[aria-label="Close"]').click();
		await expect(aside).not.toBeVisible();

		// 7. Verify first row content
		const firstRowCells = table.locator('.table-row').first().locator('.table-cell');
		await expect(firstRowCells.last()).toHaveText('Iris-setosa');

		// 8. Reload page and verify state resumes cleanly
		await page.reload();
		await expect(preview).toBeVisible();
		await expect(preview.locator('.page-header h1')).toHaveText(
			'Preview Dataset: Iris Flower Species'
		);
		await expect(preview.locator('.page-header p')).toContainText('150 rows | 5 columns');
		await expect(sidebarItem.locator('.step-value')).toHaveText('Iris Flower Species');
		await expect(sidebarItem.locator('.chiclet')).toHaveText(['150 rows', '5 columns']);
		await expect(
			preview.locator('.table-row').first().locator('.table-cell').last()
		).toHaveText('Iris-setosa');
	});

	test('JOURNEY-IRIS-TARGET: navigate to /target, select class target, and resume on reload', async ({
		page
	}) => {
		await page.goto('/data');
		await loadSampleDataset(page, 'iris');

		// 1. Navigate to /target via sidebar
		await page.locator('app-sidebar a[href="/target"]').click();
		await expect(page).toHaveURL(/\/target/);

		const targetView = page.locator('app-target-view');
		await expect(targetView).toBeVisible();
		const readySection = targetView.locator('[data-testid="target-ready"]');
		await expect(readySection).toBeVisible({ timeout: 10000 });

		// 2. Select class target
		const classRow = readySection.locator('tbody tr:has(th:has-text("class"))');
		const classBtn = classRow.locator('button');
		await expect(classBtn).toHaveText('Set as Target');
		await classBtn.click();

		// 3. Verify class is now current target and continue link is visible
		await expect(classBtn).toHaveText('Current Target');
		await expect(classBtn).toBeDisabled();
		const continueLink = targetView.locator('header a[href="/models"]');
		await expect(continueLink).toBeVisible();

		// 4. Reload and verify state resumes cleanly
		await page.reload();
		await expect(page).toHaveURL(/\/target/);
		await expect(readySection).toBeVisible({ timeout: 10000 });
		await expect(classRow.locator('button')).toHaveText('Current Target');
		await expect(classRow.locator('button')).toBeDisabled();
		await expect(continueLink).toBeVisible();
	});

	test('WML-P4-UI-13 / JOURNEY-IRIS-RESULTS and WML-P3-UI-4 / JOURNEY-IRIS-SETUP: train, acknowledge and show populated results for fixed Cross-Validation', async ({
		page
	}) => {
		await page.goto('/data');
		await loadSampleDataset(page, 'iris');

		// 1. Navigate to /target and select class
		await page.locator('app-sidebar a[href="/target"]').click();
		await expect(page).toHaveURL(/\/target/);
		const targetView = page.locator('app-target-view');
		const readySection = targetView.locator('[data-testid="target-ready"]');
		await expect(readySection).toBeVisible({ timeout: 10000 });
		const classRow = readySection.locator('tbody tr:has(th:has-text("class"))');
		await classRow.locator('button').click();
		await expect(classRow.locator('button')).toHaveText('Current Target');

		// 2. Navigate to /models via target continue link
		const continueToModels = targetView.locator('header a[href="/models"]');
		await expect(continueToModels).toBeVisible();
		await continueToModels.click();
		await expect(page).toHaveURL(/\/models$/);

		const modelsView = page.locator('app-models-view');
		await expect(modelsView).toBeVisible();

		// Verify empty state text
		await expect(modelsView).toContainText('No models yet. Train a new model to get started.');

		// 3. Train New Model -> navigates to /models/new
		const trainNewBtn = modelsView.locator('a.btn-primary[href="/models/new"]');
		await expect(trainNewBtn).toBeVisible();
		await trainNewBtn.click();
		await expect(page).toHaveURL(/\/models\/new$/);

		const builder = page.locator('app-model-builder-view');
		await expect(builder).toBeVisible();

		// 4. Section 1 (Choose Model) is active
		const step1 = builder.locator('.train-step').nth(0);
		await expect(step1).toHaveAttribute('aria-current', 'step');

		// Select Logistic Regression
		const lrCard = step1.locator('app-model-card[model-id="logistic-regression"]');
		await expect(lrCard).toBeVisible();
		const selectLrBtn = lrCard.locator('button.btn-primary');
		await selectLrBtn.click();

		// 5. Section 2 (Select Features) is now active
		const step2 = builder.locator('.train-step').nth(1);
		await expect(step2).toHaveAttribute('aria-current', 'step');
		// Section 1 is now completed
		await expect(step1).not.toHaveAttribute('aria-current', 'step');
		await expect(step1.locator('h2')).toHaveText('1. Logistic Regression');

		// 6. Verify feature rows for Iris:
		// Target class has Target chiclet and no checkbox
		const targetRow = step2.locator('tbody tr:has(th:has-text("class"))');
		await expect(targetRow.locator('.chiclet')).toHaveText('Target');
		await expect(targetRow.locator('input[type="checkbox"]')).toHaveCount(0);

		// 4 predictors: sepal length, sepal width, petal length, petal width
		const predictors = ['sepal length', 'sepal width', 'petal length', 'petal width'];
		for (const name of predictors) {
			const checkbox = step2.locator(`input[aria-label="Include ${name}"]`);
			await expect(checkbox).toBeVisible();
			await expect(checkbox).toBeChecked();
		}

		// Toggle a feature off and back on
		const sepalWidthCb = step2.locator('input[aria-label="Include sepal width"]');
		await sepalWidthCb.click();
		await expect(sepalWidthCb).not.toBeChecked();
		await sepalWidthCb.click();
		await expect(sepalWidthCb).toBeChecked();

		// Click Continue in Section 2
		const continueStep2Btn = step2.locator('.section-actions button:has-text("Continue")');
		await expect(continueStep2Btn).toBeEnabled();
		await continueStep2Btn.click();

		// 7. Section 2 is complete and Section 3 is active.
		await expect(step2).not.toHaveAttribute('aria-current', 'step');
		await expect(step2.locator('h2')).toHaveText('2. 4 Features Selected');

		const step3 = builder.locator('.train-step').nth(2);
		await expect(step3).toHaveAttribute('aria-current', 'step');
		await expect(step3.locator('app-model-configuration form')).toBeVisible();
		await expect(step3.locator('h2')).toContainText('3. Configure Model');

		// 8. Reload page and verify state resumes cleanly
		await expect
			.poll(() =>
				page.evaluate(
					() =>
						JSON.parse(localStorage.getItem('samata-ml:state')!).models[0]
							?.completedSteps
				)
			)
			.toContain('select-features');
		await page.reload();
		await expect(page).toHaveURL(/\/models\/new$/);
		await expect(builder).toBeVisible();
		await expect(step1.locator('h2')).toHaveText('1. Logistic Regression');
		await expect(step2.locator('h2')).toHaveText('2. 4 Features Selected');
		await expect(step3).toHaveAttribute('aria-current', 'step');
		await expect(step3.locator('app-model-configuration form')).toBeVisible();
		await expect(step3.locator('h2')).toContainText('3. Configure Model');

		await step3.getByRole('button', { name: 'Save & Continue' }).click();
		const setup = builder.locator('app-training-setup');
		await setup.getByRole('combobox', { name: 'Training Strategy' }).selectOption('nested_cv');
		await expect(setup.getByRole('spinbutton')).toHaveValue('5');
		await setup.getByRole('spinbutton').fill('4');
		await setup.getByRole('button', { name: 'Train Model' }).click();
		const summary = 'Cross-Validation (4 folds)';
		await expect(
			builder.getByRole('heading', { name: '4. 4 Fold Cross-Validation', exact: true })
		).toBeVisible();
		expect(await acknowledgeDurableTraining(page, 1, 'Logistic Regression')).toMatchObject({
			strategy: 'cross_validation',
			rows: 150,
			foldCount: 4,
			refitComplete: true
		});
		await expectPopulatedResults(page, {
			protocol: 'cross_validation',
			folds: 4,
			heldOutRows: 150
		});

		// 9. Navigate back to /models via sidebar.
		await page.locator('app-sidebar a[href="/models"]').click();
		await expect(page).toHaveURL(/\/models$/);
		await expect(modelsView).toBeVisible();
		const table = modelsView.locator('table.table');
		await expect(table).toBeVisible();
		await expect(table.locator('tbody tr')).toHaveCount(1);
		await expect(table).toContainText('Model 1 — Logistic Regression');
		await expect(table.locator('tbody td:nth-child(4)')).toHaveText(summary);
	});
});
