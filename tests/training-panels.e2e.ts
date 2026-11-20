import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { configureDraft, controlTraining, openSetup } from './fixtures/training/browser';
import { fixtureTrainingResult } from './fixtures/training/results';

function training(page: Page) {
	return page.getByTestId('training-step');
}

async function revisitTraining(page: Page): Promise<void> {
	await page.locator('app-sidebar a[href="/models"]').click();
	await expect(page).toHaveURL('/models');
	await page.locator('app-sidebar a[href="/models/1"]').click();
	await expect(page).toHaveURL('/models/1');
}

async function assertPanelAccessibility(page: Page): Promise<void> {
	const audit = new AxeBuilder({ page }).withTags([
		'wcag2a',
		'wcag2aa',
		'wcag21a',
		'wcag21aa',
		'wcag22aa'
	]);
	const panel =
		(await training(page).count()) > 0
			? '[data-testid="training-step"]'
			: 'section[aria-labelledby="step-4-title"]';
	audit.include({ fromShadowDom: ['app-model-builder-view', panel] });
	expect((await audit.analyze()).violations).toEqual([]);
}

async function start(page: Page) {
	const setup = await openSetup(page);
	await setup.getByRole('button', { name: 'Train Model' }).press('Enter');
	await expect(training(page).getByRole('heading')).toBeFocused();
	await expect.poll(() => requestCount(page)).toBe(1);
	return setup;
}

function requestCount(page: Page, type = 'start') {
	return page.evaluate(
		(type) => window.__trainingFixture!.requests.filter(({ kind }) => kind === type).length,
		type
	);
}

function fitProgress(page: Page, percent: number, announce: boolean) {
	return page.evaluate(
		({ percent, announce }) => {
			window.__trainingFixture!.reply({
				kind: 'progress',
				progress: {
					percent,
					stage: 'fitting',
					phase: 'training',
					statusMessage: 'training'
				},
				note: announce ? { key: 'phase', phase: 'training' } : undefined
			});
		},
		{ percent, announce }
	);
}

async function succeed(page: Page): Promise<string> {
	const fixture = fixtureTrainingResult();
	if (fixture.strategy !== 'one_shot') throw new Error('Expected holdout fixture');
	const json = JSON.stringify(fixture, (_key, value: unknown) =>
		value instanceof Uint32Array ? Array.from(value) : value
	);
	return page.evaluate((payload) => {
		const arrays = new Set(['trainIndices', 'testIndices', 'confusionMatrix', 'support']);
		const result = JSON.parse(payload, (key, value) =>
			arrays.has(key) ? Uint32Array.from(value) : value
		);
		const fixture = window.__trainingFixture!;
		const start = fixture.requests.find(({ kind }) => kind === 'start')!;
		if (start.kind !== 'start') throw new Error('Expected a start request');
		fixture.reply({ kind: 'success', result });
		return start.identity.runId;
	}, json);
}

test('starts once, keeps native controls stable and announces milestones across progress updates', async ({
	page
}) => {
	await controlTraining(page);
	await start(page);
	const panel = training(page);
	const progress = panel.getByRole('progressbar', { name: 'Training progress' });
	const summary = panel.locator('summary');
	const status = panel.getByRole('status');
	await status.evaluate((element) => {
		const region = element as HTMLElement;
		const changes = new MutationObserver(() => {
			region.dataset.announcements = String(Number(region.dataset.announcements ?? 0) + 1);
		});
		changes.observe(region, { childList: true, characterData: true, subtree: true });
	});
	await expect(progress).toHaveCount(1);
	await expect(progress).not.toHaveAttribute('value');
	await expect(panel.getByRole('button', { name: 'View Results' })).toBeDisabled();

	const progressNode = await progress.elementHandle();
	const summaryNode = await summary.elementHandle();
	await fitProgress(page, 18, true);
	await expect(status).toHaveText('Fitting the model');
	await expect(status).toHaveAttribute('data-announcements', '1');
	await summary.press('Enter');
	await expect(panel.locator('details')).toHaveAttribute('open', '');
	await expect(panel.locator('ol li').last()).toHaveText('Fitting the model');
	await fitProgress(page, 37, false);
	await expect(progress).toHaveAttribute('value', '37');
	expect(await progress.evaluate((node, previous) => node === previous, progressNode)).toBe(true);
	expect(await summary.evaluate((node, previous) => node === previous, summaryNode)).toBe(true);
	await expect(status).toHaveText('Fitting the model');
	await expect(status).toHaveAttribute('data-announcements', '1');
	await expect(summary).toBeFocused();
	await assertPanelAccessibility(page);

	await page.locator('app-sidebar a[href="/target"]').click();
	await expect(page).toHaveURL('/target');
	const runId = await succeed(page);
	await expect
		.poll(() => page.evaluate(() => window.__appState!.get().models[0]?.status))
		.toBe('trained');
	await page.locator('app-sidebar a[href="/models/1"]').click();
	await expect(panel.getByRole('button', { name: 'View Results' })).toBeEnabled();
	await expect(progress).toHaveAttribute('value', '100');
	await expect(panel.getByText(/^Elapsed time/)).toBeVisible();
	await expect(panel.locator('details')).toHaveAttribute('open', '');
	await expect(status).toBeEmpty();
	expect(await page.evaluate(() => window.__appState!.get().models[0]?.resultRevision)).toBe(
		runId
	);
	expect(await requestCount(page)).toBe(1);
	await assertPanelAccessibility(page);
});

for (const outcome of ['cancelled', 'invalid-request', 'worker-crashed'] as const) {
	test(`${outcome} restores the Training Setup button with a safe localised reason`, async ({
		page
	}) => {
		await controlTraining(page);
		const setup = await start(page);
		const cancel = training(page).getByRole('button', { name: 'Cancel Training' });
		await cancel.focus();
		await expect(cancel).toBeFocused();
		if (outcome === 'cancelled') {
			await cancel.press('Enter');
			await expect.poll(() => requestCount(page, 'cancel')).toBe(1);
			await expect(training(page).locator('summary')).toHaveText('Cancelling training');
			await page.evaluate(() => window.__trainingFixture!.reply({ kind: 'cancelled' }));
		} else {
			await page.evaluate(
				(code) => window.__trainingFixture!.reply({ kind: 'failed', code }),
				outcome
			);
		}
		await expect(setup.getByRole('button', { name: 'Train Model' })).toBeFocused();
		await expect(
			page.locator('section[aria-labelledby="step-4-title"]').getByRole('alert')
		).toHaveText(
			outcome === 'cancelled'
				? /Training was cancelled/
				: outcome === 'invalid-request'
					? /The training library rejected this setup/
					: /Training could not finish/
		);
		await expect(training(page)).toHaveCount(0);
		await revisitTraining(page);
		await expect(
			page.locator('section[aria-labelledby="step-4-title"]').getByRole('alert')
		).toBeVisible();
		await assertPanelAccessibility(page);
	});
}

test('rejects a non-isolated start before constructing a worker and keeps the form usable', async ({
	page
}) => {
	await controlTraining(page, false);
	const setup = await openSetup(page);
	const submit = setup.getByRole('button', { name: 'Train Model' });
	await submit.press('Enter');
	await expect(
		page.getByRole('alert').filter({ hasText: 'This page cannot start training' })
	).toBeVisible();
	await expect(submit).toBeFocused();
	await expect(submit).toBeEnabled();
	await expect(training(page)).toHaveCount(0);
	expect(await requestCount(page)).toBe(0);
	await assertPanelAccessibility(page);
});

test('a committed start awaiting publication returns to a draft without launching a worker', async ({
	page
}) => {
	await controlTraining(page);
	const setup = await openSetup(page);
	await page.evaluate(() => (window.__trainingFixture!.blockPublication = 'start'));
	const submit = setup.getByRole('button', { name: 'Train Model' });
	await submit.press('Enter');
	await expect(page.getByRole('alert').filter({ hasText: 'The start was saved' })).toBeVisible();
	await expect(submit).toBeFocused();
	expect(await requestCount(page)).toBe(0);
	await page.evaluate(() => (window.__trainingFixture!.blockPublication = null));
	await page
		.locator('section[aria-labelledby="step-4-title"]')
		.getByRole('button', { name: 'Retry saving' })
		.press('Enter');
	await expect(
		page.getByRole('alert').filter({ hasText: 'Training was interrupted' })
	).toBeVisible();
	await expect(submit).toBeEnabled();
	expect(await requestCount(page)).toBe(0);
	await submit.press('Enter');
	await expect.poll(() => requestCount(page)).toBe(1);
});

test('holds a committed result at 95% and retries only publication', async ({ page }) => {
	await controlTraining(page);
	await start(page);
	await page.evaluate(() => (window.__trainingFixture!.blockPublication = 'finish'));
	const runId = await succeed(page);
	const panel = training(page);
	await expect(panel.getByRole('alert')).toHaveText(
		'The result is saved, but progress could not be saved. Retry saving.'
	);
	await expect(panel.getByRole('progressbar')).toHaveAttribute('value', '95');
	await expect(panel.getByRole('button', { name: 'View Results' })).toBeDisabled();
	await expect(panel.getByRole('button', { name: 'Cancel Training' })).toBeDisabled();
	await revisitTraining(page);
	await panel.getByRole('button', { name: 'Retry saving' }).focus();
	await assertPanelAccessibility(page);
	await page.evaluate(() => (window.__trainingFixture!.blockPublication = null));
	await panel.getByRole('button', { name: 'Retry saving' }).press('Enter');
	await expect(panel.getByRole('button', { name: 'View Results' })).toBeEnabled();
	expect(await requestCount(page)).toBe(1);
	expect(await page.evaluate(() => window.__appState!.get().models[0]?.resultRevision)).toBe(
		runId
	);
});

test('WML-P3-UI-2: each stopped model retries its own repair and preserves the reason', async ({
	page
}) => {
	await controlTraining(page);
	await start(page);
	await page.locator('app-sidebar a[href="/models"]').click();
	const secondSetup = await configureDraft(page, 2);
	await secondSetup.getByRole('button', { name: 'Train Model' }).press('Enter');
	await expect.poll(() => requestCount(page)).toBe(2);
	const generation = await page.evaluate(() => window.__appState!.get().trainingDomainGeneration);

	await page.evaluate(() => {
		const fixture = window.__trainingFixture!;
		fixture.blockRead = true;
		fixture.reply({ kind: 'cancelled' }, 1);
		fixture.reply({ kind: 'failed', code: 'invalid-request' }, 2);
	});
	const panel = training(page);
	const retry = panel.getByRole('button', { name: 'Retry saving' });
	await expect(retry).toBeVisible();
	await page.locator('app-sidebar a[href="/models/1"]').click();
	await expect(retry).toBeVisible();
	await expect(panel.getByRole('alert')).toHaveText(/Training has stopped/);
	await expect(panel.getByRole('button', { name: 'Cancel Training' })).toBeDisabled();
	await expect(panel.getByRole('button', { name: 'View Results' })).toBeDisabled();

	await page.evaluate(() => {
		const fixture = window.__trainingFixture!;
		fixture.blockRead = false;
		fixture.blockPublication = 'stop';
	});
	await retry.press('Enter');
	await expect
		.poll(() => page.evaluate(() => window.__trainingFixture!.blockedWrites))
		.toBeGreaterThan(0);
	await expect(retry).toBeEnabled();
	await page.evaluate(() => (window.__trainingFixture!.blockPublication = null));
	await retry.press('Enter');
	const stoppedNotice = page
		.locator('section[aria-labelledby="step-4-title"]')
		.getByRole('alert');
	await expect(stoppedNotice).toHaveText(/Training was cancelled/);
	expect(await page.evaluate(() => window.__appState!.get().trainingDomainGeneration)).toBe(
		generation + 1
	);

	await page.locator('app-sidebar a[href="/models/2"]').click();
	await expect(retry).toBeVisible();
	await retry.press('Enter');
	await expect(stoppedNotice).toHaveText(/The training library rejected this setup/);
	expect(await page.evaluate(() => window.__appState!.get().trainingDomainGeneration)).toBe(
		generation + 2
	);
	expect(await requestCount(page)).toBe(2);
});

test('a remote tab reads the running state and recovers a pending result without fitting again', async ({
	page,
	context
}) => {
	await controlTraining(page);
	await start(page);
	const other = await context.newPage();
	try {
		await controlTraining(other);
		await other.goto('/models/1');
		const remote = training(other);
		await expect(remote.locator('summary')).toHaveText('Training in another tab');
		await expect(remote.getByRole('button', { name: 'Cancel Training' })).toHaveCount(0);
		await assertPanelAccessibility(other);
		await page.evaluate(() => (window.__trainingFixture!.blockPublication = 'finish'));
		const runId = await succeed(page);
		await expect(training(page).getByRole('button', { name: 'Retry saving' })).toBeVisible();
		await other.reload();
		await expect(remote.getByRole('button', { name: 'View Results' })).toBeEnabled();
		await expect(training(page).getByRole('button', { name: 'View Results' })).toBeEnabled();
		expect(await requestCount(other)).toBe(0);
		expect(await requestCount(page)).toBe(1);
		expect(await other.evaluate(() => window.__appState!.get().models[0]?.resultRevision)).toBe(
			runId
		);
	} finally {
		await other.close();
	}
});

test('reflows training at 320 pixels with RTL, reduced motion and forced colours', async ({
	page
}) => {
	await controlTraining(page);
	await start(page);
	await page.setViewportSize({ width: 320, height: 800 });
	await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' });
	await page.evaluate(() => {
		document.documentElement.dir = 'rtl';
	});
	await fitProgress(page, 31, true);
	const panel = training(page);
	const disclosure = panel.locator('summary');
	await disclosure.press('Enter');
	await expect(disclosure).toBeFocused();
	await expect(panel.getByRole('progressbar')).toBeVisible();
	const bounds = await panel.evaluate((element) => {
		const rect = element.getBoundingClientRect();
		return {
			inlineOverflow: element.scrollWidth > Math.ceil(rect.width),
			width: rect.width,
			focusStyle: getComputedStyle(
				element
					.querySelector('app-training-progress')!
					.shadowRoot!.querySelector('summary')!
			).outlineStyle
		};
	});
	expect(bounds.inlineOverflow).toBe(false);
	expect(bounds.width).toBeLessThanOrEqual(320);
	expect(bounds.focusStyle).toBe('solid');
	await assertPanelAccessibility(page);
});
