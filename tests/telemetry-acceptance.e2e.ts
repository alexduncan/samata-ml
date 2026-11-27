import { expect, test, type Page } from '@playwright/test';
import { runAdvisoryAxe } from './helpers/advisory-a11y';
import AxeBuilder from '@axe-core/playwright';
import { execFileSync } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INITIAL_APP_STATE, STATE_STORAGE_KEY } from '../src/types/state';
import { startBetaOriginServer, type BetaOriginServer } from './fixtures/beta-origin-server';
import { waitForPublishedPreview } from './helpers/dataset-ready';

const ROOT_DIR = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

test.describe.configure({ mode: 'serial' });
test.skip(
	({ browserName }) => browserName !== 'chromium',
	'Beta-origin host mapping E2E runs on Chromium only'
);

test.use({
	launchOptions: {
		args: ['--host-resolver-rules=MAP beta.samata.ml 127.0.0.1']
	}
});

interface RecordedGatewayRequest {
	headers: Record<string, string>;
	body: {
		type: string;
		payload: Record<string, unknown>;
	};
}

let server: BetaOriginServer | undefined;
let buildDirRel = '';
let fakeTrackerScript = '';

test.beforeAll(async ({}, testInfo) => {
	test.setTimeout(240_000);
	buildDirRel = `out/beta-e2e-${testInfo.workerIndex}`;
	execFileSync('bun', ['run', 'build', '--out-dir', buildDirRel], {
		cwd: ROOT_DIR,
		env: {
			...process.env,
			BETA_TELEMETRY_ENABLED: 'true',
			SAMATA_CRAWLER_POLICY: 'closed'
		},
		stdio: 'pipe'
	});
	fakeTrackerScript = await readFile(
		path.join(ROOT_DIR, 'tests/fixtures/umami-fake-tracker.js'),
		'utf8'
	);
	server = await startBetaOriginServer(path.join(ROOT_DIR, buildDirRel));
});

test.afterAll(async () => {
	await server?.close();
	if (buildDirRel) {
		await rm(path.join(ROOT_DIR, buildDirRel), { recursive: true, force: true });
	}
});

async function interceptUmami(
	page: Page,
	options: { blockScript?: boolean } = {}
): Promise<RecordedGatewayRequest[]> {
	const recorded: RecordedGatewayRequest[] = [];
	await page.route('https://cloud.umami.is/script.js', async (route) => {
		if (options.blockScript) {
			await route.abort('failed');
			return;
		}
		await route.fulfill({
			status: 200,
			contentType: 'application/javascript; charset=utf-8',
			headers: {
				'Access-Control-Allow-Origin': '*',
				'Cross-Origin-Resource-Policy': 'cross-origin'
			},
			body: fakeTrackerScript
		});
	});
	await page.route('https://gateway.umami.is/**', async (route) => {
		const req = route.request();
		const headers = await req.allHeaders();
		const rawBody = req.postData() ?? '{}';
		recorded.push({
			headers,
			body: JSON.parse(rawBody) as RecordedGatewayRequest['body']
		});
		await route.fulfill({
			status: 204,
			headers: {
				'Access-Control-Allow-Origin': '*'
			}
		});
	});
	return recorded;
}

test('REL-UI-1 & REL-UI-3: beta origin serves isolated CSP, accessible notice, one acceptance send, and reload pageview', async ({
	page
}, testInfo) => {
	const sends = await interceptUmami(page);
	const response = await page.goto(server!.url);
	expect(response?.status()).toBe(200);
	const csp = response?.headers()['content-security-policy'] ?? '';
	expect(csp).toContain("script-src 'self' https://cloud.umami.is/script.js");
	expect(csp).toContain('https://gateway.umami.is');

	expect(await page.evaluate(() => window.crossOriginIsolated)).toBe(true);
	await expect(page.locator('script[src="https://cloud.umami.is/script.js"]')).toHaveCount(0);
	expect(sends).toHaveLength(0);

	const dialog = page.locator('app-welcome-modal dialog');
	await expect(dialog).toBeVisible();
	await expect(dialog).toHaveAttribute('aria-describedby', 'welcome-beta');

	const notice = dialog.locator('#welcome-beta');
	await expect(notice).toContainText(
		'By clicking Get Started, you accept cookieless analytics and error reporting for this beta.'
	);
	const privacyLink = notice.getByRole('link', { name: 'Read the privacy policy' });
	await expect(privacyLink).toHaveAttribute('href', '/privacy');
	const getStarted = dialog.getByRole('button', { name: 'Get Started', exact: true });
	await expect(getStarted).toBeFocused();

	// Reading order: notice appears before Get Started
	const orderOk = await dialog.evaluate((dlg) => {
		const p = dlg.querySelector('#welcome-beta');
		const btn = dlg.querySelector('button.btn-primary');
		return Boolean(
			p && btn && p.compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING
		);
	});
	expect(orderOk).toBe(true);

	await runAdvisoryAxe(
		testInfo,
		async () => {
			const { violations } = await new AxeBuilder({ page })
				.include('app-welcome-modal')
				.withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
				.analyze();
			return violations;
		},
		{ label: 'REL-UI-1 / REL-UI-3' }
	);

	// Keyboard focus reaches privacy link and Get Started cleanly; 320px reflow & RTL & 400% zoom keep controls in viewport
	await page.setViewportSize({ width: 320, height: 600 });
	const box320 = await dialog.boundingBox();
	expect(box320!.width).toBeLessThanOrEqual(320);

	await page.evaluate(() => {
		document.documentElement.dir = 'rtl';
		document.documentElement.style.zoom = '4';
	});
	await expect(getStarted).toBeVisible();
	await page.evaluate(() => {
		document.documentElement.dir = 'ltr';
		document.documentElement.style.zoom = '1';
	});
	await page.setViewportSize({ width: 1280, height: 800 });

	await getStarted.click();
	await expect(dialog).toBeHidden();
	await expect(page.locator('script[src="https://cloud.umami.is/script.js"]')).toHaveCount(1);

	await expect.poll(() => sends.length).toBe(1);
	expect(sends[0]!.body.type).toBe('event');
	expect(sends[0]!.body.payload).toMatchObject({
		website: 'e13bc119-a1c5-448e-b1ab-0203b71df348',
		hostname: 'beta.samata.ml',
		url: '/data',
		name: 'beta_get_started'
	});
	expect(Object.keys(sends[0]!.body.payload).sort()).toEqual(
		expect.arrayContaining(['hostname', 'name', 'url', 'website'])
	);
	expect(sends[0]!.body.payload.referrer).toBeUndefined();
	expect(sends[0]!.body.payload.title).toBeUndefined();
	expect(sends[0]!.body.payload.salt).toBeUndefined();
	expect(sends[0]!.headers.cookie).toBeUndefined();
	expect(sends[0]!.headers.referer).toBeUndefined();

	const stored = await page.evaluate(
		(key) => JSON.parse(localStorage.getItem(key) ?? '{}'),
		STATE_STORAGE_KEY
	);
	expect(stored.onboarding).toEqual({
		welcomeDismissed: true,
		betaTelemetryAccepted: true
	});

	// Reload tracks pageview without repeating beta_get_started
	await page.reload();
	await expect(dialog).toBeHidden();
	await expect.poll(() => sends.length).toBe(2);
	expect(sends[1]!.body.payload.name).toBeUndefined();
	expect(sends[1]!.body.payload.url).toBe('/data');
});

test('REL-UI-2 & REL-UI-4: legacy blobs, Escape reopen, privacy link/route, and cross-tab adoption never falsely accept', async ({
	browser
}) => {
	const context = await browser.newContext({ ignoreHTTPSErrors: true });
	try {
		const page1 = await context.newPage();
		const sends1 = await interceptUmami(page1);

		// Seed legacy v1 state with welcomeDismissed: true (missing betaTelemetryAccepted)
		await page1.addInitScript(
			({ key, state }) => {
				if (!localStorage.getItem(key)) {
					localStorage.setItem(key, JSON.stringify(state));
				}
			},
			{
				key: STATE_STORAGE_KEY,
				state: {
					...INITIAL_APP_STATE,
					resumePath: '/target',
					onboarding: { welcomeDismissed: true }
				}
			}
		);

		// Direct reserved route /privacy keeps notice hidden and never accepts
		await page1.goto(`${server!.url}/privacy`);
		await expect(page1.locator('app-content-modal dialog')).toBeVisible();
		await expect(page1.locator('app-content-modal')).toContainText('Umami Cloud');
		await expect(page1.locator('app-content-modal')).toContainText('screen dimensions');
		await expect(page1.locator('app-content-modal')).toContainText('IP address');
		await expect(page1.locator('app-welcome-modal dialog')).toBeHidden();
		expect(sends1).toHaveLength(0);

		// Closing /privacy reveals the workflow underlay and opens beta notice
		await page1.keyboard.press('Escape');
		const dialog1 = page1.locator('app-welcome-modal dialog');
		await expect(dialog1).toBeVisible();
		await expect(page1).toHaveURL(/\/target$/);

		await page1.mouse.click(2, 2);
		await expect(dialog1).toBeVisible();

		// Pressing Escape (once and repeatedly) never accepts and keeps dialog open
		await page1.keyboard.press('Escape');
		await page1.keyboard.press('Escape');
		await page1.keyboard.press('Escape');
		await expect(dialog1).toBeVisible();
		expect(
			await page1.evaluate(() => window.__appState!.get().onboarding.betaTelemetryAccepted)
		).toBe(false);
		expect(sends1).toHaveLength(0);

		// Clicking privacy link hides beta dialog without accepting and closing returns to beta dialog
		await dialog1.getByRole('link', { name: 'Read the privacy policy' }).click();
		await expect(page1.locator('app-content-modal dialog')).toBeVisible();
		await expect(dialog1).toBeHidden();
		await page1.keyboard.press('Escape');
		await expect(dialog1).toBeVisible();
		expect(sends1).toHaveLength(0);

		// Open second tab in same context: beta dialog opens there too
		const page2 = await context.newPage();
		const sends2 = await interceptUmami(page2);
		await page2.goto(`${server!.url}/data`);
		const dialog2 = page2.locator('app-welcome-modal dialog');
		await expect(dialog2).toBeVisible();

		// Accepting in page1 closes dialog2 via storage adoption without sending a second beta_get_started
		await dialog1.getByRole('button', { name: 'Get Started', exact: true }).click();
		await expect(dialog1).toBeHidden();
		await expect(dialog2).toBeHidden();
		await expect.poll(() => sends1.length).toBe(1);
		expect(sends1[0]!.body.payload.name).toBe('beta_get_started');

		// Wait briefly to confirm page2 did not emit beta_get_started on adoption
		await page2.waitForTimeout(300);
		expect(sends2.some((s) => s.body.payload.name === 'beta_get_started')).toBe(false);
	} finally {
		await context.close();
	}
});

test('REL-TELEM-5: blocked Umami script keeps the beta workflow completely usable', async ({
	page
}) => {
	const pageErrors: string[] = [];
	page.on('pageerror', (err) => pageErrors.push(err.message));

	const sends = await interceptUmami(page, { blockScript: true });
	await page.goto(server!.url);
	const getStarted = page
		.locator('app-welcome-modal dialog')
		.getByRole('button', { name: 'Get Started', exact: true });
	await getStarted.click();
	await expect(page.locator('app-welcome-modal dialog')).toBeHidden();

	const irisCard = page.locator('app-dataset-card[dataset-id="iris"]');
	await expect(irisCard).toBeVisible();
	await irisCard.locator('button.btn-primary').click();
	await waitForPublishedPreview(page);
	expect(sends).toHaveLength(0);
	expect(pageErrors).toEqual([]);
});
