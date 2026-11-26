import { expect, test } from '@playwright/test';
import { parityMap, type ParityEntry } from './visual-parity/map';
import {
	createSidebarFixture,
	prepareSidebarFixture,
	prepareSidebarReference
} from './visual-parity/fixtures';
import { MOCKUPS_URL } from '../scripts/ports';

test.describe('Visual Parity Suite (Chromium 1440x900)', () => {
	test.use({ viewport: { width: 1440, height: 900 } });

	test.beforeEach(async ({ browserName }) => {
		test.skip(browserName !== 'chromium', 'Visual parity is asserted on Chromium only');
	});

	test('PARITY-contract: mapped surfaces have no drift exemptions', () => {
		expect(parityMap.filter((entry) => entry.knownDrift)).toEqual([]);
	});

	for (const entry of parityMap) {
		test(`PARITY-${entry.id}`, async ({ page, context }, testInfo) => {
			if (entry.knownDrift) {
				test.fail(
					true,
					`Expected failure due to known drift tracked in '${entry.knownDrift}'`
				);
			}

			// Open the unmodified mockup document on the review server.
			const mockupPage = await context.newPage();
			await mockupPage.goto(`${MOCKUPS_URL}/${encodeURIComponent(entry.mockupPage)}?clean=1`);
			if (entry.fixture)
				await prepareSidebarReference(mockupPage, entry.fixture, MOCKUPS_URL);
			const mockupEl = mockupPage.locator(entry.mockupSelector).first();
			await mockupEl.waitFor({ state: 'attached', timeout: 5000 });

			// Open app route on app server (this checkout's app URL) with fresh state
			await page.goto(entry.appRoute);
			if (entry.fixture) await prepareSidebarFixture(page, entry.fixture);
			if (entry.id.startsWith('preview-')) {
				const getStartedBtn = page.locator('app-welcome-modal button.btn-primary');
				try {
					await getStartedBtn.waitFor({ state: 'visible', timeout: 2000 });
					await getStartedBtn.click();
				} catch {
					// Already dismissed
				}
				const irisCard = page.locator('app-dataset-card[dataset-id="iris"]');
				await irisCard.waitFor({ state: 'visible', timeout: 5000 });
				await irisCard.locator('button.btn-primary').click();
				await page
					.locator('app-dataset-preview')
					.waitFor({ state: 'attached', timeout: 5000 });
				if (entry.id.includes('aside')) {
					await page.locator('app-dataset-preview .header-btn').first().click();
					await page
						.locator('app-column-details aside.overlay')
						.waitFor({ state: 'attached', timeout: 5000 });
				}
			}
			if (entry.id.startsWith('target-')) {
				await page.goto('/data');
				const getStartedBtn = page.locator('app-welcome-modal button.btn-primary');
				try {
					await getStartedBtn.waitFor({ state: 'visible', timeout: 2000 });
					await getStartedBtn.click();
				} catch {
					// Already dismissed
				}
				const irisCard = page.locator('app-dataset-card[dataset-id="iris"]');
				await irisCard.waitFor({ state: 'visible', timeout: 5000 });
				await irisCard.locator('button.btn-primary').click();
				await page
					.locator('app-dataset-preview')
					.waitFor({ state: 'attached', timeout: 5000 });
				await page.goto('/target');
				await page
					.locator('app-target-view [data-testid="target-ready"]')
					.waitFor({ state: 'visible', timeout: 5000 });
				if (entry.id.includes('alert')) {
					await page.evaluate(() => {
						const s = window.__appState!.get();
						window.__appState!.set({
							...s,
							models: [
								{
									num: 1,
									createdAt: Date.now(),
									status: 'draft',
									completedSteps: [],
									modelId: null,
									features: ['sepal width'],
									modelOptions: {},
									hyperparameters: { mode: 'manual', values: {} },
									multiclass: null,
									trainingSetup: null,
									progress: null,
									resultRevision: null,
									error: null,
									timings: null,
									durationMs: null,
									metrics: null,
									ui: {}
								}
							]
						});
					});
					await page
						.locator('app-target-view .notification.notification-alert')
						.first()
						.waitFor({ state: 'visible', timeout: 5000 });
				}
			}
			if (entry.id.startsWith('models-')) {
				if (entry.id.startsWith('models-disabled-')) {
					await page.goto('/models');
					await page
						.locator('app-models-view .notification.notification-alert')
						.waitFor({ state: 'attached', timeout: 5000 });
				} else if (entry.mockupPage === '03-2_train-models-1-choose-model.html') {
					await page.goto('/data');
					const getStartedBtn = page.locator('app-welcome-modal button.btn-primary');
					try {
						await getStartedBtn.waitFor({ state: 'visible', timeout: 2000 });
						await getStartedBtn.click();
					} catch {}
					const irisCard = page.locator('app-dataset-card[dataset-id="iris"]');
					await irisCard.waitFor({ state: 'visible', timeout: 5000 });
					await irisCard.locator('button.btn-primary').click();
					await page
						.locator('app-dataset-preview')
						.waitFor({ state: 'attached', timeout: 5000 });
					await page.goto('/target');
					await page
						.locator('app-target-view [data-testid="target-ready"]')
						.waitFor({ state: 'visible', timeout: 5000 });
					await page.locator('tbody tr:has(th:has-text("class")) button').click();
					await page.locator('app-target-view header a[href="/models"]').click();
					await page
						.locator('app-models-view')
						.getByRole('link', { name: 'Train New Model' })
						.click();
					await expect(page).toHaveURL(/\/models\/new$/);
					await page
						.locator(
							'app-model-builder-view app-model-card[model-id="logistic-regression"]'
						)
						.waitFor({ state: 'attached', timeout: 5000 });
				} else if (entry.mockupPage === '03-3_train-models-2-select-features.html') {
					await page.goto('/data');
					const getStartedBtn = page.locator('app-welcome-modal button.btn-primary');
					try {
						await getStartedBtn.waitFor({ state: 'visible', timeout: 2000 });
						await getStartedBtn.click();
					} catch {}
					const irisCard = page.locator('app-dataset-card[dataset-id="iris"]');
					await irisCard.waitFor({ state: 'visible', timeout: 5000 });
					await irisCard.locator('button.btn-primary').click();
					await page
						.locator('app-dataset-preview')
						.waitFor({ state: 'attached', timeout: 5000 });
					await page.goto('/target');
					await page
						.locator('app-target-view [data-testid="target-ready"]')
						.waitFor({ state: 'visible', timeout: 5000 });
					await page.locator('tbody tr:has(th:has-text("class")) button').click();
					await page.locator('app-target-view header a[href="/models"]').click();
					await page
						.locator('app-models-view')
						.getByRole('link', { name: 'Train New Model' })
						.click();
					await expect(page).toHaveURL(/\/models\/new$/);
					await page
						.locator(
							'app-model-builder-view app-model-card[model-id="logistic-regression"]'
						)
						.getByRole('button', { name: 'Select Model' })
						.click();
					await page
						.locator('app-model-builder-view table.table')
						.waitFor({ state: 'visible', timeout: 5000 });
				}
			}
			const appEl = page.locator(entry.appSelector).first();
			await appEl.waitFor({ state: 'attached', timeout: 5000 });

			// Capture and attach full-page screenshots for both
			const mockupScreenshot = await mockupPage.screenshot({ fullPage: true });
			await testInfo.attach(`mockup-${entry.id}.png`, {
				body: mockupScreenshot,
				contentType: 'image/png'
			});

			const appScreenshot = await page.screenshot({ fullPage: true });
			await testInfo.attach(`app-${entry.id}.png`, {
				body: appScreenshot,
				contentType: 'image/png'
			});

			// Read computed styles for both
			const mockupStyles = await mockupEl.evaluate((el, properties) => {
				const computed = window.getComputedStyle(el);
				const result: Record<string, string> = {};
				for (const prop of properties) {
					result[prop] = computed.getPropertyValue(prop);
				}
				return result;
			}, entry.properties);

			const appStyles = await appEl.evaluate((el, properties) => {
				const computed = window.getComputedStyle(el);
				const result: Record<string, string> = {};
				for (const prop of properties) {
					result[prop] = computed.getPropertyValue(prop);
				}
				return result;
			}, entry.properties);

			if (entry.geometry) {
				const appBox = await appEl.boundingBox();
				const referenceBox = await mockupEl.boundingBox();
				const appOrigin = await page.locator(entry.geometry.appOrigin).boundingBox();
				const referenceOrigin = await mockupPage
					.locator(entry.geometry.mockupOrigin)
					.boundingBox();
				expect(appBox).not.toBeNull();
				expect(referenceBox).not.toBeNull();
				expect(appOrigin).not.toBeNull();
				expect(referenceOrigin).not.toBeNull();
				for (const axis of entry.geometry.axes) {
					const actual =
						appBox![axis] - (axis === 'x' || axis === 'y' ? appOrigin![axis] : 0);
					const expected =
						referenceBox![axis] -
						(axis === 'x' || axis === 'y' ? referenceOrigin![axis] : 0);
					expect(
						Math.abs(actual - expected),
						`${entry.id} relative ${axis}`
					).toBeLessThanOrEqual(1);
				}
			}
			await mockupPage.close();

			// Compare properties
			for (const prop of entry.properties) {
				const actual = appStyles[prop];
				let expected = mockupStyles[prop];

				if (entry.deviations && entry.deviations[prop]) {
					expected = entry.deviations[prop].value;
				}

				expect(
					actual,
					`Property '${prop}' mismatch on ${entry.id}:\n  mockup value: '${expected}'\n  app value:    '${actual}'`
				).toBe(expected);
			}
		});
	}

	test('SIDE-AC-10: paired empty and populated sidebar reference review', async ({
		context
	}, testInfo) => {
		for (const fixture of ['empty', 'models'] as const) {
			const page = await context.newPage();
			await prepareSidebarFixture(page, fixture);
			const reference = await context.newPage();
			await prepareSidebarReference(reference, fixture, MOCKUPS_URL);
			await reference.screenshot({
				path: testInfo.outputPath(`sidebar-${fixture}-reference.png`)
			});
			await page.screenshot({ path: testInfo.outputPath(`sidebar-${fixture}-app.png`) });
			await expect(page.locator('app-sidebar')).toHaveScreenshot(`sidebar-${fixture}.png`, {
				animations: 'disabled',
				caret: 'hide',
				maxDiffPixels: 0
			});
			await reference.close();
			await page.close();
		}
	});

	test('DOT-AC-7: a separately cued reduced-motion fixture matches the model-row dot slot', async ({
		page,
		context
	}, testInfo) => {
		await prepareSidebarFixture(page, 'dataset');
		await page.evaluate(
			(state) => window.__appState!.set(state),
			createSidebarFixture('target')
		);
		const link = page.locator('app-sidebar a.step-train-new[href="/models/new"]');
		const dot = link.locator('.dot');
		await expect(dot).toBeVisible();
		await expect(page.locator('body > .workflow-dot-burst')).toHaveCount(0);
		const reference = await context.newPage();
		await reference.emulateMedia({ reducedMotion: 'reduce' });
		await reference.goto(`${MOCKUPS_URL}/02-2_target-set.html?clean=1`);
		const referenceDot = reference.locator('.sidebar .step-model-link .dot');
		const { width, height, right, radius } = await referenceDot.evaluate((element) => {
			const style = getComputedStyle(element);
			return {
				width: style.width,
				height: style.height,
				right: style.right,
				radius: style.borderRadius
			};
		});
		await expect(dot).toHaveCSS('width', width);
		await expect(dot).toHaveCSS('height', height);
		await expect(dot).toHaveCSS('inset-inline-end', right);
		await expect(dot).toHaveCSS('border-radius', radius);
		const linkBox = (await link.boundingBox())!;
		const dotBox = (await dot.boundingBox())!;
		expect(dotBox.y + dotBox.height / 2).toBeCloseTo(linkBox.y + linkBox.height / 2);
		await page.locator('app-sidebar').screenshot({
			path: testInfo.outputPath('sidebar-cued-app.png'),
			animations: 'disabled',
			caret: 'hide'
		});
		await reference.locator('.sidebar').screenshot({
			path: testInfo.outputPath('sidebar-cued-reference.png'),
			animations: 'disabled',
			caret: 'hide'
		});
		await reference.close();
	});

	test('SIDE-AC-11: a temporary workflow gap fails the blocking geometry assertion and restoration passes', async ({
		page,
		context
	}) => {
		await prepareSidebarFixture(page, 'empty');
		const reference = await context.newPage();
		await prepareSidebarReference(reference, 'empty', MOCKUPS_URL);
		const referenceBox = await reference.locator('.sidebar .steps').boundingBox();
		const assertHeight = async () => {
			const actual = await page.locator('app-sidebar .steps').boundingBox();
			expect(
				Math.abs(actual!.height - referenceBox!.height),
				'joined workflow height'
			).toBeLessThanOrEqual(1);
		};
		await assertHeight();
		await page.locator('app-sidebar').evaluate((host) => {
			const sheet = new CSSStyleSheet();
			sheet.replaceSync('.steps { display: flex; flex-direction: column; gap: 4px; }');
			host.shadowRoot!.adoptedStyleSheets = [...host.shadowRoot!.adoptedStyleSheets, sheet];
		});
		try {
			await expect(assertHeight()).rejects.toThrow('joined workflow height');
		} finally {
			await page.locator('app-sidebar').evaluate((host) => {
				host.shadowRoot!.adoptedStyleSheets = host.shadowRoot!.adoptedStyleSheets.slice(
					0,
					-1
				);
			});
		}
		await assertHeight();
		await reference.close();
	});

	test('SIDE-AC-10: hover matches the reference and focus remains inset in both directions', async ({
		page,
		context
	}) => {
		await prepareSidebarFixture(page, 'empty');
		const reference = await context.newPage();
		await prepareSidebarReference(reference, 'empty', MOCKUPS_URL);
		const actual = page.locator('app-sidebar .step:nth-child(2) .step-link');
		const expected = reference.locator('.sidebar .step:nth-child(2) .step-link');
		await actual.hover();
		await expected.hover();
		for (const property of ['color', 'background-color', 'border-top-color']) {
			await expect(actual).toHaveCSS(
				property,
				await expected.evaluate(
					(el, prop) => getComputedStyle(el).getPropertyValue(prop),
					property
				)
			);
		}
		for (const direction of ['ltr', 'rtl']) {
			await page.evaluate((dir) => (document.documentElement.dir = dir), direction);
			await actual.focus();
			await page.keyboard.press('Tab');
			await page.keyboard.press('Shift+Tab');
			await expect(actual).toHaveCSS('outline-width', '2px');
			await expect(actual).toHaveCSS('outline-offset', '-2px');
		}
		await reference.close();
	});
});
