import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import type { PersistedAppState } from '../src/types/state';
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
	// The Phase 4 evaluation carries Uint16, Uint32, Float32 and Float64 arrays; tag each one
	// so the page restores the same typed array rather than a plain object.
	const json = JSON.stringify(fixture, (_key, value: unknown) =>
		ArrayBuffer.isView(value)
			? {
					__typed: value.constructor.name,
					data: Array.from(value as unknown as ArrayLike<number>)
				}
			: value
	);
	return page.evaluate((payload) => {
		const constructors = { Uint16Array, Uint32Array, Float32Array, Float64Array };
		const result = JSON.parse(payload, (_key, value) =>
			value && typeof value === 'object' && '__typed' in value
				? constructors[value.__typed as keyof typeof constructors].from(value.data)
				: value
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

test('WML-P3-UI-1/5: retries only publication and preserves a disclosure changed during the failure', async ({
	page
}) => {
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
	const blockedWrites = await page.evaluate(() => window.__trainingFixture!.blockedWrites);
	await panel.locator('summary').press('Enter');
	await expect(panel.locator('details')).toHaveAttribute('open', '');
	await expect
		.poll(() => page.evaluate(() => window.__trainingFixture!.blockedWrites))
		.toBeGreaterThan(blockedWrites);
	await revisitTraining(page);
	await expect(panel.locator('details')).toHaveAttribute('open', '');
	await panel.getByRole('button', { name: 'Retry saving' }).focus();
	await assertPanelAccessibility(page);
	await page.evaluate(() => (window.__trainingFixture!.blockPublication = null));
	await panel.getByRole('button', { name: 'Retry saving' }).press('Enter');
	await expect(panel.getByRole('button', { name: 'View Results' })).toBeEnabled();
	expect(await requestCount(page)).toBe(1);
	expect(await page.evaluate(() => window.__appState!.get().models[0]?.resultRevision)).toBe(
		runId
	);
	await expect(panel.locator('details')).toHaveAttribute('open', '');
	await page.reload();
	await expect(panel.getByRole('button', { name: 'View Results' })).toBeEnabled();
	await expect(panel.locator('details')).toHaveAttribute('open', '');
	expect(await page.evaluate(() => window.__appState!.get().models[0]?.resultRevision)).toBe(
		runId
	);
	expect(await requestCount(page)).toBe(0);
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

type CleanupWindow = Window & {
	allowFinishCleanup?: () => void;
	deniedFinishCleanups?: number;
	releaseStateLock?: () => void;
};

function savedRun(page: Page) {
	return page.evaluate(() => {
		const state = JSON.parse(localStorage.getItem('samata-ml:state')!) as PersistedAppState;
		return {
			generation: state.trainingDomainGeneration,
			status: state.models[0]?.status,
			revision: state.models[0]?.resultRevision,
			open: state.models[0]?.ui.trainingLogOpen
		};
	});
}

function blockFinishCleanup(page: Page, generation: number) {
	return page.evaluate((finishGeneration) => {
		const fixture = window as CleanupWindow;
		fixture.deniedFinishCleanups = 0;
		const put = IDBObjectStore.prototype.put;
		IDBObjectStore.prototype.put = function (value, key) {
			if (
				this.name === 'model_results' &&
				value?.kind === 'training-domain-checkpoint' &&
				value.generation === finishGeneration &&
				value.pending === null
			) {
				fixture.deniedFinishCleanups!++;
				throw new DOMException('Fixture blocked finish cleanup', 'SecurityError');
			}
			return put.call(this, value, key);
		};
		fixture.allowFinishCleanup = () => {
			IDBObjectStore.prototype.put = put;
		};
	}, generation);
}

function storedStop(page: Page) {
	return page.evaluate(async () => {
		const state = JSON.parse(localStorage.getItem('samata-ml:state')!) as PersistedAppState;
		const model = state.models[0]!;
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open('samata-db');
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		try {
			const store = db.transaction('model_results').objectStore('model_results');
			const marker = store.get(['samata-ml:training-domain', 0]);
			const result = store.get([state.dataset!.id, model.num]);
			return await new Promise((resolve, reject) => {
				store.transaction.oncomplete = () =>
					resolve({
						generation: state.trainingDomainGeneration,
						status: model.status,
						reason: model.error?.details,
						revision: model.resultRevision,
						logOpen: model.ui.trainingLogOpen ?? false,
						marker: {
							generation: marker.result?.generation,
							pending: marker.result?.pending?.kind ?? null
						},
						hasResult: result.result !== undefined
					});
				store.transaction.onerror = () => reject(store.transaction.error);
			});
		} finally {
			db.close();
		}
	});
}

for (const [outcome, recovery] of [
	['invalid-request', 'owner acknowledgement'],
	['worker-crashed', 'owner acknowledgement'],
	['cancelled', 'owner acknowledgement'],
	['invalid-request', 'foreign cleanup'],
	['cancelled', 'foreign cleanup'],
	['worker-crashed', 'later storage event']
] as const) {
	test(`WML-P3-UI-2: committed ${outcome} stop restores its reason after ${recovery}`, async ({
		page,
		context
	}) => {
		await controlTraining(page);
		const setup = await start(page);
		const submit = setup.getByRole('button', { name: 'Train Model' });
		const retry = training(page).getByRole('button', { name: 'Retry saving' });
		const generation = (await savedRun(page)).generation + 1;
		const reason =
			outcome === 'invalid-request'
				? /The training library rejected this setup/
				: outcome === 'worker-crashed'
					? /Training could not finish/
					: /Training was cancelled/;
		const other = recovery === 'owner acknowledgement' ? undefined : await context.newPage();
		try {
			if (other) {
				await controlTraining(other);
				await other.goto('/models/1');
				await expect(training(other).locator('summary')).toHaveText(
					'Training in another tab'
				);
				for (const tab of [page, other]) await blockFinishCleanup(tab, generation);
			} else {
				await page.evaluate(() => (window.__trainingFixture!.blockPublication = 'stop'));
			}
			if (outcome === 'cancelled') {
				await training(page)
					.getByRole('button', { name: 'Cancel Training' })
					.press('Enter');
				await expect.poll(() => requestCount(page, 'cancel')).toBe(1);
			}
			await page.evaluate((code) => {
				const fixture = window.__trainingFixture!;
				if (code === 'cancelled') fixture.reply({ kind: 'cancelled' });
				else if (code === 'worker-crashed') fixture.crash();
				else fixture.reply({ kind: 'failed', code });
			}, outcome);
			await expect(retry).toBeEnabled();
			await expect(
				training(page).getByRole('button', { name: 'View Results' })
			).toBeDisabled();
			const openLog = recovery === 'foreign cleanup' && outcome === 'invalid-request';
			if (openLog) {
				const denials = () =>
					page.evaluate(() => (window as CleanupWindow).deniedFinishCleanups!);
				const beforeToggle = await denials();
				await training(page).locator('summary').press('Enter');
				await expect(training(page).locator('details')).toHaveAttribute('open', '');
				await expect.poll(denials).toBeGreaterThan(beforeToggle);
				await page.evaluate(() =>
					navigator.locks.request('samata-ml:training-state', () => {})
				);
			}
			expect(await storedStop(page)).toMatchObject({
				marker: { generation, pending: outcome === 'cancelled' ? 'cancel' : 'finish' },
				hasResult: false
			});
			if (other) {
				const remoteRetry = other.getByRole('button', { name: 'Retry saving' });
				await expect(remoteRetry).toBeVisible();
				await other.evaluate(() => (window as CleanupWindow).allowFinishCleanup!());
				await remoteRetry.press('Enter');
				await expect(other.getByRole('button', { name: 'Train Model' })).toBeEnabled();
				await expect
					.poll(() => storedStop(other))
					.toMatchObject({ marker: { generation, pending: null } });
				// Clearing an already acknowledged marker makes no localStorage write.
				expect(await page.evaluate(() => window.__appState!.get().models[0]?.status)).toBe(
					'training'
				);
				if (recovery === 'later storage event') {
					await other.locator('app-sidebar a[href="/models"]').click();
					await expect(other).toHaveURL('/models');
				}
			} else {
				await retry.evaluate((button) => {
					// Keep writes denied until the keyboard activates Retry saving.
					button.addEventListener(
						'click',
						() => (window.__trainingFixture!.blockPublication = null),
						{
							capture: true,
							once: true
						}
					);
				});
			}
			if (recovery !== 'later storage event') await retry.press('Enter');
			const notice = page
				.locator('section[aria-labelledby="step-4-title"]')
				.getByRole('alert');
			await expect(submit).toBeEnabled();
			await expect(notice).toHaveText(reason);
			await expect(page.getByText('Private worker details')).toHaveCount(0);
			await expect(training(page)).toHaveCount(0);
			await expect(page.getByRole('button', { name: 'Retry saving' })).toHaveCount(0);
			expect(await storedStop(page)).toEqual({
				generation,
				status: 'draft',
				reason: outcome,
				revision: null,
				logOpen: openLog,
				marker: { generation, pending: null },
				hasResult: false
			});
			expect(
				await page.evaluate(() => window.__appState!.get().models[0]?.error?.details)
			).toBe(outcome);
			expect(await requestCount(page)).toBe(1);
			if (other) expect(await requestCount(other)).toBe(0);
			await page.reload();
			await expect(submit).toBeEnabled();
			await expect(notice).toHaveText(reason);
			expect(await storedStop(page)).toMatchObject({
				logOpen: openLog,
				reason: outcome,
				hasResult: false
			});
			expect(await requestCount(page)).toBe(0);
		} finally {
			await other?.close();
		}
	});
}

for (const recovery of [
	'keyboard retry without a log toggle',
	'keyboard retry after a failed log write',
	'result loading after a later storage event'
] as const) {
	test(`WML-P3-UI-1/2/5: owner recovers after foreign finish cleanup by ${recovery}`, async ({
		page,
		context
	}) => {
		const toggleLog = recovery !== 'keyboard retry without a log toggle';
		await controlTraining(page);
		await start(page);
		const other = await context.newPage();
		const owner = training(page);
		const retry = owner.getByRole('button', { name: 'Retry saving' });
		const viewResults = owner.getByRole('button', { name: 'View Results' });
		const ownerState = () =>
			page.evaluate(() => {
				const state = window.__appState!.get();
				const model = state.models[0]!;
				return {
					generation: state.trainingDomainGeneration,
					status: model.status,
					revision: model.resultRevision,
					open: model.ui.trainingLogOpen
				};
			});
		try {
			await controlTraining(other);
			await other.goto('/models/1');
			await expect(training(other).locator('summary')).toHaveText('Training in another tab');
			const generation = (await savedRun(page)).generation + 1;
			for (const tab of [page, other]) await blockFinishCleanup(tab, generation);
			const revision = await succeed(page);
			await expect(retry).toBeVisible();
			const remoteRetry = other.getByRole('button', { name: 'Retry saving' });
			await expect(remoteRetry).toBeVisible();
			if (toggleLog) {
				const denials = () =>
					page.evaluate(() => (window as CleanupWindow).deniedFinishCleanups!);
				const beforeToggle = await denials();
				await owner.locator('summary').press('Enter');
				await expect(owner.locator('details')).toHaveAttribute('open', '');
				await expect.poll(denials).toBeGreaterThan(beforeToggle);
				await page.evaluate(() =>
					navigator.locks.request('samata-ml:training-state', () => {})
				);
				await expect(
					page.getByText(
						'Your changes could not be saved. They are available in this tab.'
					)
				).toBeVisible();
			}
			await other.evaluate(() => (window as CleanupWindow).allowFinishCleanup!());
			await remoteRetry.press('Enter');
			await expect(
				training(other).getByRole('button', { name: 'View Results' })
			).toBeEnabled();
			// Only the other tab can clear the marker. Its retry needs no localStorage write.
			const trained = { generation, status: 'trained', revision, open: toggleLog };
			expect(await savedRun(page)).toEqual({ ...trained, open: false });
			expect(await ownerState()).toMatchObject({
				generation: generation - 1,
				status: 'training'
			});
			await expect(viewResults).toBeDisabled();

			if (recovery === 'result loading after a later storage event') {
				await other.locator('app-sidebar a[href="/models"]').click();
				await expect(other).toHaveURL('/models');
			} else {
				await retry.press('Enter');
			}
			await expect(viewResults).toBeEnabled();
			await expect(retry).toBeHidden();
			await expect(owner.getByRole('progressbar')).toHaveAttribute('value', '100');
			await expect(page).toHaveURL('/models/1');
			expect(await ownerState()).toEqual(trained);
			expect(await savedRun(page)).toEqual(trained);
			expect(await requestCount(page)).toBe(1);
			expect(await requestCount(other)).toBe(0);

			await page.reload();
			await expect(viewResults).toBeEnabled();
			if (toggleLog) await expect(owner.locator('details')).toHaveAttribute('open', '');
			else await expect(owner.locator('details')).not.toHaveAttribute('open');
			expect(await ownerState()).toEqual(trained);
			expect(await requestCount(page)).toBe(0);
		} finally {
			await other.close();
		}
	});
}

test('WML-P3-UI-1: retrying finish checkpoint cleanup keeps another tab’s saved disclosure', async ({
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
		const { generation } = await savedRun(page);
		await remote.locator('summary').press('Enter');
		await expect(remote.locator('details')).toHaveAttribute('open', '');
		await expect
			.poll(() => savedRun(page))
			.toMatchObject({ generation, status: 'training', open: true });
		const owner = training(page);
		await expect(owner.locator('details')).not.toHaveAttribute('open');

		// Either tab can replay the checkpoint on a storage event. Block only the
		// finish marker cleanup in both tabs so the owner's Retry saving is exercised.
		for (const tab of [page, other]) {
			await blockFinishCleanup(tab, generation + 1);
		}
		const runId = await succeed(page);
		const retry = owner.getByRole('button', { name: 'Retry saving' });
		await expect(retry).toBeVisible();
		const trained = {
			generation: generation + 1,
			status: 'trained',
			revision: runId,
			open: true
		};
		expect(await savedRun(page)).toEqual(trained);
		await expect(owner.locator('details')).not.toHaveAttribute('open');

		await page.evaluate(() => (window as CleanupWindow).allowFinishCleanup!());
		await retry.press('Enter');
		await expect(owner.getByRole('button', { name: 'View Results' })).toBeEnabled();
		await expect(owner.locator('details')).toHaveAttribute('open', '');
		expect(await savedRun(page)).toEqual(trained);
		expect(await requestCount(page)).toBe(1);
		expect(await requestCount(other)).toBe(0);

		await page.reload();
		await expect(owner.getByRole('button', { name: 'View Results' })).toBeEnabled();
		await expect(owner.locator('details')).toHaveAttribute('open', '');
		expect(await savedRun(page)).toEqual(trained);
		expect(await requestCount(page)).toBe(0);
	} finally {
		await other.close();
	}
});

test('WML-P3-UI-1: keeps a keyboard log toggle when the other tab clears the finish marker before refresh and save', async ({
	page,
	context
}) => {
	await controlTraining(page);
	await start(page);
	const other = await context.newPage();
	const owner = training(page);
	const stateLock = 'samata-ml:training-state';
	const pending = () =>
		page.evaluate(
			async (name) =>
				(await navigator.locks.query()).pending?.filter((lock) => lock.name === name)
					.length ?? 0,
			stateLock
		);
	try {
		await controlTraining(other);
		await other.goto('/models/1');
		await expect(training(other).locator('summary')).toHaveText('Training in another tab');
		const generation = (await savedRun(page)).generation + 1;
		for (const tab of [page, other]) await blockFinishCleanup(tab, generation);
		const revision = await succeed(page);
		await expect(owner.getByRole('button', { name: 'Retry saving' })).toBeVisible();
		const trained = { generation, status: 'trained', revision, open: false };
		expect(await savedRun(page)).toEqual(trained);

		await page.evaluate(
			(name) =>
				new Promise<void>((ready) => {
					void navigator.locks.request(
						name,
						() =>
							new Promise<void>((release) => {
								(window as CleanupWindow).releaseStateLock = release;
								ready();
							})
					);
				}),
			stateLock
		);
		// Queue remote marker cleanup and then owner refresh via the real storage listener.
		await other.evaluate(() => (window as CleanupWindow).allowFinishCleanup!());
		for (const tab of [other, page]) {
			const queued = await pending();
			await tab.evaluate(() =>
				window.dispatchEvent(new StorageEvent('storage', { key: 'samata-ml:state' }))
			);
			await expect.poll(pending).toBeGreaterThan(queued);
		}
		const queued = await pending();
		await owner.locator('summary').press('Enter');
		await expect(owner.locator('details')).toHaveAttribute('open', '');
		await expect.poll(pending).toBeGreaterThan(queued);
		await page.evaluate(() => (window as CleanupWindow).releaseStateLock!());

		const persisted = { ...trained, open: true };
		await expect(owner.getByRole('button', { name: 'View Results' })).toBeEnabled();
		await expect.poll(() => savedRun(page)).toEqual(persisted);
		await expect(owner.locator('details')).toHaveAttribute('open', '');
		expect(await requestCount(page)).toBe(1);
		expect(await requestCount(other)).toBe(0);
		await page.reload();
		await expect(owner.getByRole('button', { name: 'View Results' })).toBeEnabled();
		await expect(owner.locator('details')).toHaveAttribute('open', '');
		expect(await savedRun(page)).toEqual(persisted);
		expect(await requestCount(page)).toBe(0);
	} finally {
		await page.evaluate(() => (window as CleanupWindow).releaseStateLock?.());
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
