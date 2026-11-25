import { expect, test, type Page } from '@playwright/test';

async function configuredTarget(page: Page): Promise<void> {
	await page.goto('/data');
	await page.getByRole('button', { name: 'Get Started' }).click();
	await page.locator('app-dataset-card[dataset-id="iris"] button.btn-primary').click();
	await expect(page.locator('app-dataset-preview')).toBeVisible();
	await page.locator('app-sidebar a[href="/target"]').click();
	await page.getByRole('button', { name: 'Set as Target: class' }).click();
	await expect(page.getByRole('link', { name: 'Train Models' }).last()).toBeVisible();
	await page.getByRole('link', { name: 'Train Models' }).last().click();
	await page.locator('app-models-view').getByRole('link', { name: 'Train New Model' }).click();
	await expect(page).toHaveURL(/\/models\/new$/);
	await expect(page.locator('app-model-builder-view h1')).toHaveText('Model 1');
	await page.goto('/target');
	await expect(page.getByRole('button', { name: 'Set as Target: sepal length' })).toBeVisible();
}

test('WML-P3-TRAIN-4: a remote shared lock keeps confirmation open and storage events do not navigate', async ({
	page,
	context
}) => {
	await configuredTarget(page);
	const other = await context.newPage();
	try {
		await other.goto('/target');
		await expect(other.locator('[data-testid="target-ready"]')).toBeVisible();
		await other.evaluate(() => {
			const lockFixture = window as Window & { releaseTrainingLock?: () => void };
			return new Promise<void>((entered) => {
				void navigator.locks.request(
					'samata-ml:ingestion',
					{ mode: 'shared' },
					() =>
						new Promise<void>((released) => {
							lockFixture.releaseTrainingLock = released;
							entered();
						})
				);
			});
		});
		await page.getByRole('button', { name: 'Set as Target: sepal length' }).click();
		const dialog = page.getByRole('dialog', { name: 'Change Target' });
		await dialog.getByRole('button', { name: 'Change Target' }).click();
		await expect(dialog.getByRole('alert')).toHaveText('Training in another tab');
		expect(await page.evaluate(() => window.__appState!.get().models.length)).toBe(1);
		await other.evaluate(() =>
			(window as Window & { releaseTrainingLock?: () => void }).releaseTrainingLock?.()
		);
		await expect
			.poll(() =>
				other.evaluate(async () =>
					(await navigator.locks.query()).held?.some(
						(lock) => lock.name === 'samata-ml:ingestion'
					)
				)
			)
			.toBe(false);
		await dialog.getByRole('button', { name: 'Change Target' }).click();
		await expect(dialog).not.toBeVisible();
		await expect
			.poll(() => other.evaluate(() => window.__appState!.get().target))
			.toBe('sepal length');
		await expect(other).toHaveURL(/\/target$/);
	} finally {
		await other.close();
	}
});

function blockTargetPublication(): void {
	const fixture = window as Window & { preventPublication?: boolean };
	fixture.preventPublication = true;
	const write = Storage.prototype.setItem;
	Storage.prototype.setItem = function (key, value) {
		if (
			fixture.preventPublication &&
			key === 'samata-ml:state' &&
			JSON.parse(value).target === 'sepal length'
		)
			throw new DOMException('Test write failed', 'SecurityError');
		return write.call(this, key, value);
	};
}

test('WML-P3-TRAIN-6/7: reload withholds old views until committed confirmation can be published', async ({
	page
}) => {
	await configuredTarget(page);
	await page.evaluate(blockTargetPublication);
	await page.getByRole('button', { name: 'Set as Target: sepal length' }).click();
	const dialog = page.getByRole('dialog', { name: 'Change Target' });
	await dialog.getByRole('button', { name: 'Change Target' }).click();
	await expect(dialog.getByRole('button', { name: 'Retry saving' })).toBeVisible();
	await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeDisabled();
	await page.addInitScript(blockTargetPublication);
	await page.reload();
	await expect(page.getByRole('heading', { name: 'Restore saved work' })).toBeVisible();
	await expect(page.locator('app-target-view')).toHaveCount(0);
	await page.evaluate(() => {
		(window as Window & { preventPublication?: boolean }).preventPublication = false;
	});
	await page.getByRole('button', { name: 'Retry saving' }).click();
	await expect(page.locator('[data-testid="target-ready"]')).toBeVisible();
	await expect(page).toHaveURL(/\/target$/);
	expect(
		await page.evaluate(() => ({
			target: window.__appState!.get().target,
			modelCount: window.__appState!.get().models.length
		}))
	).toEqual({ target: 'sepal length', modelCount: 0 });
});
