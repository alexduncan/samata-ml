import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Known accessibility violations to be fixed by the follow-up
 * remediation plan (scaffolding-visual-remediation).
 */
export const KNOWN_A11Y_DRIFT: string[] = [
	// Zero violations reported on /data by axe-core 4.14 under WCAG 2.0, 2.1, 2.2 AA.
];

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];

test.describe('Accessibility Audits (WCAG 2.2 AA)', () => {
	test('A11Y-E2E-1: Initial route /data with welcome modal open', async ({ page }) => {
		await page.goto('/data');
		await page.locator('app-welcome-modal dialog[open]').waitFor({ timeout: 5000 });

		const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();

		const unexpectedViolations = results.violations.filter(
			(v) => !KNOWN_A11Y_DRIFT.includes(v.id)
		);
		const knownViolations = results.violations.filter((v) => KNOWN_A11Y_DRIFT.includes(v.id));

		if (KNOWN_A11Y_DRIFT.length > 0 && knownViolations.length > 0) {
			test.fail(
				true,
				`Expected failure due to known a11y drift: ${knownViolations.map((v) => v.id).join(', ')}`
			);
		}

		expect(
			unexpectedViolations,
			`Unexpected a11y violations found: ${JSON.stringify(unexpectedViolations, null, 2)}`
		).toEqual([]);
	});

	test('A11Y-E2E-2: Route /data with welcome modal dismissed', async ({ page }) => {
		await page.goto('/data');
		const getStartedBtn = page.locator('app-welcome-modal button.btn-primary');
		await getStartedBtn.waitFor({ timeout: 5000 });
		await getStartedBtn.click();
		await page.locator('app-welcome-modal dialog').waitFor({ state: 'hidden', timeout: 5000 });

		const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();

		const unexpectedViolations = results.violations.filter(
			(v) => !KNOWN_A11Y_DRIFT.includes(v.id)
		);
		const knownViolations = results.violations.filter((v) => KNOWN_A11Y_DRIFT.includes(v.id));

		if (KNOWN_A11Y_DRIFT.length > 0 && knownViolations.length > 0) {
			test.fail(
				true,
				`Expected failure due to known a11y drift: ${knownViolations.map((v) => v.id).join(', ')}`
			);
		}

		expect(
			unexpectedViolations,
			`Unexpected a11y violations found: ${JSON.stringify(unexpectedViolations, null, 2)}`
		).toEqual([]);
	});
});
