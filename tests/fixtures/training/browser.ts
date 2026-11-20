import { expect, type Locator, type Page } from '@playwright/test';
import type {
	TrainingStartRequest,
	TrainingWorkerReply,
	TrainingWorkerRequest
} from '../../../src/features/models/training/protocol';
import { dismissWelcomeModal } from '../../journeys/helpers';

type FixtureReply = {
	[Kind in TrainingWorkerReply['kind']]: Omit<
		Extract<TrainingWorkerReply, { kind: Kind }>,
		'identity'
	>;
}[TrainingWorkerReply['kind']];

type BrowserTrainingFixture = {
	requests: TrainingWorkerRequest[];
	reply(event: FixtureReply, modelNum?: number): void;
	blockRead: boolean;
	blockPublication: 'start' | 'finish' | 'stop' | null;
	blockedWrites: number;
};

declare global {
	interface Window {
		__trainingFixture?: BrowserTrainingFixture;
	}
}

/** Configures an Iris Logistic Regression draft through the ordinary UI. */
export async function openSetup(page: Page, saveConfiguration = true): Promise<Locator> {
	await page.goto('/data');
	await dismissWelcomeModal(page);
	await page.locator('app-dataset-card[dataset-id="iris"] button.btn-primary').click();
	await expect(page.locator('app-dataset-preview')).toBeAttached();

	await page.goto('/target');
	const target = page.locator('app-target-view');
	await expect(target.getByTestId('target-ready')).toBeVisible({ timeout: 10_000 });
	const classTarget = target.locator('tbody tr:has(th:has-text("class")) button');
	await classTarget.click();
	await expect(classTarget).toHaveText('Current Target');
	await page.goto('/models');
	return configureDraft(page, 1, saveConfiguration);
}

/** Creates and configures the next model from the Models overview. */
export async function configureDraft(
	page: Page,
	modelNum: number,
	saveConfiguration = true
): Promise<Locator> {
	await page.getByRole('button', { name: 'Train New Model' }).click();
	await expect(page).toHaveURL(`/models/${modelNum}`);

	await page
		.locator('app-model-builder-view')
		.locator('app-model-card[model-id="logistic-regression"]')
		.getByRole('button', { name: 'Select Model' })
		.click();
	await page
		.locator('app-model-builder-view')
		.locator('.train-step')
		.nth(0)
		.getByRole('button', { name: 'Continue', exact: true })
		.click();
	await page
		.locator('app-model-builder-view')
		.locator('.train-step')
		.nth(1)
		.getByRole('button', { name: 'Continue', exact: true })
		.click();
	if (saveConfiguration) {
		await page
			.locator('app-model-builder-view')
			.getByRole('button', { name: 'Save & Continue' })
			.click();
		await expect(page.locator('app-model-builder-view app-training-setup')).toBeVisible();
		await expect
			.poll(() =>
				page.evaluate((num) => {
					const raw = localStorage.getItem('samata-ml:state');
					const models = raw ? JSON.parse(raw).models : [];
					return models.find((model: { num: number }) => model.num === num)
						?.completedSteps;
				}, modelNum)
			)
			.toContain('configure-model');
	}
	return page.locator('app-model-builder-view app-training-setup');
}

/** Controls only the dedicated training worker while all storage and locks remain real. */
export async function controlTraining(page: Page, isolated = true): Promise<void> {
	await page.addInitScript((isolated) => {
		const nativeWorker = window.Worker;
		let worker:
			| {
					onmessage: ((event: MessageEvent<TrainingWorkerReply>) => void) | null;
					request?: TrainingStartRequest;
			  }
			| undefined;
		const workers = new Map<number, NonNullable<typeof worker>>();
		const fixture: BrowserTrainingFixture = {
			requests: [],
			reply(event, modelNum) {
				const recipient = modelNum === undefined ? worker : workers.get(modelNum);
				if (!recipient?.request || !recipient.onmessage)
					throw new Error('Expected a started training worker');
				recipient.onmessage(
					new MessageEvent('message', {
						data: { ...event, identity: recipient.request.identity }
					})
				);
			},
			blockRead: false,
			blockPublication: null,
			blockedWrites: 0
		};
		window.__trainingFixture = fixture;
		if (!isolated) Object.defineProperty(window, 'crossOriginIsolated', { value: false });
		window.Worker = new Proxy(nativeWorker, {
			construct(target, argumentsList, newTarget) {
				if (!String(argumentsList[0]).endsWith('/training.worker.js'))
					return Reflect.construct(target, argumentsList, newTarget);
				const mock = {
					onmessage: null,
					request: undefined as TrainingStartRequest | undefined,
					postMessage(message: TrainingWorkerRequest) {
						fixture.requests.push(message);
						if (message.kind === 'start') {
							mock.request = message;
							workers.set(message.identity.modelNum, mock);
						}
					},
					terminate() {}
				};
				worker = mock;
				return mock;
			}
		});
		const getItem = Storage.prototype.getItem;
		Storage.prototype.getItem = function (key: string): string | null {
			if (fixture.blockRead && key === 'samata-ml:state') {
				throw new DOMException('Fixture blocked state read', 'SecurityError');
			}
			return getItem.call(this, key);
		};
		const setItem = Storage.prototype.setItem;
		Storage.prototype.setItem = function (key: string, value: string): void {
			if (fixture.blockPublication && key === 'samata-ml:state') {
				const status = JSON.parse(value).models?.[0]?.status;
				const blocked = { start: 'training', finish: 'trained', stop: 'draft' };
				if (status === blocked[fixture.blockPublication]) {
					fixture.blockedWrites++;
					throw new DOMException('Fixture blocked publication', 'SecurityError');
				}
			}
			setItem.call(this, key, value);
		};
	}, isolated);
}
