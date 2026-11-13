import { expect, test } from '@playwright/test';
import { parityMap, type ParityEntry } from './visual-parity/map';

test.describe('Visual Parity Suite (Chromium 1440x900)', () => {
	test.use({ viewport: { width: 1440, height: 900 } });

	test.beforeEach(async ({ browserName }) => {
		test.skip(browserName !== 'chromium', 'Visual parity is asserted on Chromium only');
	});

	for (const entry of parityMap) {
		test(`PARITY-${entry.id}`, async ({ page, context }, testInfo) => {
			if (entry.knownDrift) {
				test.fail(
					true,
					`Expected failure due to known drift tracked in '${entry.knownDrift}'`
				);
			}

			// Open mockup page on scaffold server (http://localhost:3333)
			const mockupPage = await context.newPage();
			await mockupPage.goto(`http://localhost:3333/${entry.mockupPage}`);
			const mockupEl = mockupPage.locator(entry.mockupSelector).first();
			await mockupEl.waitFor({ state: 'attached', timeout: 5000 });

			// Open app route on app server (https://localhost:3000) with fresh state
			await page.goto(entry.appRoute);
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
});
