import { expect, test, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buttonStyles } from '../src/styles/button.styles';
import { chicletStyles } from '../src/styles/chiclet.styles';
import { dialogStyles } from '../src/styles/dialog.styles';
import { loadSampleDataset } from './journeys/helpers';
import { MOCKUPS_URL } from '../scripts/ports';

type FocusableView = HTMLElement & { focusHeading(signal: AbortSignal): Promise<void> };
interface FocusTestWindow extends Window {
	__releaseHeadingFocus?: () => void;
	__detachedFocusView?: FocusableView;
	__releaseMetadata?: () => void;
}

async function mountPrimitiveFixture(page: Page): Promise<void> {
	const styles = [
		readFileSync('css/root.css', 'utf8'),
		buttonStyles.cssText,
		chicletStyles.cssText,
		dialogStyles.cssText,
		'#long-container { inline-size: 200px; }'
	].join('\n');
	await page.setContent(`<html lang="en"><head><title>Primitive acceptance</title><style>${styles}</style></head><body><main>
		<h1>Native controls</h1>
		<button type="button" class="btn" id="default">Datasheet</button>
		<button type="button" class="btn btn-primary" id="primary">Select Dataset</button>
		<button type="button" class="btn" id="disabled" disabled>Unavailable</button>
		<button type="button" class="btn-primary" id="unmodified">Unmodified</button>
		<button type="button" id="plain">Plain</button>
		<div id="long-container"><button type="button" class="btn" id="long">${'Long button label '.repeat(4).slice(0, 60)}</button></div>
		<button type="button" class="btn-icon" id="icon" aria-label="Close modal"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" aria-hidden="true" focusable="false"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
		<p><span class="chiclet" id="chiclet">Numeric</span> <span class="chiclet chiclet-purple">Draft</span> <span class="chiclet chiclet-teal">Trained</span> <span class="chiclet chiclet-amber">Beta</span></p>
		<button type="button" class="btn" id="open-dialog">Open dialog</button>
		<dialog aria-labelledby="primitive-dialog-title"><header class="modal-header"><h2 id="primitive-dialog-title">Dataset information</h2></header><p>Read the dataset information.</p><form method="dialog"><button class="btn btn-primary" type="submit" value="close" autofocus>Close dialog</button></form></dialog>
	</main></body></html>`);
	await page.evaluate(() => {
		for (const button of document.querySelectorAll('button')) {
			button.addEventListener('click', () => {
				button.dataset.clicks = String(Number(button.dataset.clicks ?? 0) + 1);
			});
		}
		const dialog = document.querySelector('dialog')!;
		document.querySelector('#open-dialog')!.addEventListener('click', () => dialog.showModal());
		dialog.addEventListener('close', () => {
			dialog.dataset.closes = String(Number(dialog.dataset.closes ?? 0) + 1);
		});
	});
}

async function focusFirstButton(page: Page, browserName: string): Promise<Locator> {
	await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
	const button = page.locator('#default');
	await expect(button).toBeFocused();
	return button;
}

async function buttonAppearance(button: Locator) {
	return button.evaluate((element) => {
		const style = getComputedStyle(element);
		return {
			colour: style.color,
			background: style.backgroundColor,
			borderStart: style.borderBlockStart,
			borderEnd: style.borderBlockEnd,
			padding: style.padding,
			font: style.fontFamily
		};
	});
}

async function keyboardNavigate(page: Page, path: string): Promise<void> {
	const link = page.locator(`app-sidebar a[href="${path}"]`);
	// Establish native keyboard modality before programmatically locating the link.
	await page.keyboard.press('Tab');
	await link.focus();
	await link.press('Enter');
}

async function createIrisModel(page: Page): Promise<void> {
	await loadSampleDataset(page, 'iris');
	await keyboardNavigate(page, '/target');
	await page.locator('app-target-view tbody tr:has(th:has-text("class")) button').click();
	await keyboardNavigate(page, '/models');
	await page.locator('app-models-view button:has-text("Train New Model")').click();
	await expect(page).toHaveURL(/\/models\/1$/);
}

async function delayHeadingFocus(page: Page, tag: string): Promise<void> {
	await page.evaluate((tag) => {
		const definition = customElements.get(tag)!;
		const original = (definition.prototype as FocusableView).focusHeading;
		const gate = new Promise<void>((resolve) => {
			(window as FocusTestWindow).__releaseHeadingFocus = resolve;
		});
		definition.prototype.focusHeading = async function (
			this: FocusableView,
			signal: AbortSignal
		) {
			await gate;
			await original.call(this, signal);
		};
	}, tag);
}

async function releaseHeadingFocus(page: Page): Promise<void> {
	await page.evaluate(() => (window as FocusTestWindow).__releaseHeadingFocus!());
}

async function outline(heading: Locator) {
	return heading.evaluate((element) => {
		const style = getComputedStyle(element);
		return {
			width: style.outlineWidth,
			style: style.outlineStyle,
			offset: style.outlineOffset,
			colour: style.outlineColor
		};
	});
}

test.describe('App Shell & Navigation E2E (NAV-E2E-1, 2, 3, 9)', () => {
	test.beforeEach(async ({ page }) => {
		// Start with clean state
		await page.goto('/data');
		// Each test starts in a fresh context, so wait for onboarding to be ready.
		const getStartedBtn = page.locator('app-welcome-modal button.btn-primary');
		await getStartedBtn.waitFor({ state: 'visible', timeout: 10_000 });
		await getStartedBtn.click();
		await page
			.locator('app-welcome-modal dialog')
			.waitFor({ state: 'hidden', timeout: 10_000 });
		await expect
			.poll(() =>
				page.evaluate(
					() =>
						JSON.parse(localStorage.getItem('samata-ml:state') ?? '{}').onboarding
							?.welcomeDismissed
				)
			)
			.toBe(true);
	});

	test('NAV-E2E-1: Data -> Target -> Models workflow navigation and back/forward history', async ({
		page
	}) => {
		await expect(page.locator('#content h1')).toHaveText(/^(Load|Select) Data$/);
		expect(page.url()).toContain('/data');

		// Click step 2: Set Target
		await page.locator('app-sidebar a[href="/target"]').click();
		await expect(page.locator('#content h1')).toHaveText('Set Target');
		expect(page.url()).toContain('/target');

		// Click step 3: Train Models
		await page.locator('app-sidebar a[href="/models"]').click();
		await expect(page.locator('#content h1')).toHaveText('Train Models');
		expect(page.url()).toContain('/models');

		// Browser Back -> /target
		await page.goBack();
		await expect(page.locator('#content h1')).toHaveText('Set Target');
		expect(page.url()).toContain('/target');

		// Browser Back -> /data
		await page.goBack();
		await expect(page.locator('#content h1')).toHaveText(/^(Load|Select) Data$/);
		expect(page.url()).toContain('/data');

		// Browser Forward -> /target
		await page.goForward();
		await expect(page.locator('#content h1')).toHaveText('Set Target');
		expect(page.url()).toContain('/target');
	});

	test('NAV-E2E-2: Root URL resumes last visited workflow path, unknown URL redirects', async ({
		page
	}) => {
		// Navigate to /target
		await page.locator('app-sidebar a[href="/target"]').click();
		await expect(page.locator('#content h1')).toHaveText('Set Target');

		// Visiting root / should resolve to resumePath (/target)
		await page.goto('/');
		await expect(page.locator('#content h1')).toHaveText('Set Target');
		expect(page.url()).toContain('/target');

		// Visiting an unknown path should replace to resumePath
		await page.goto('/unknown-random-route');
		await expect(page.locator('#content h1')).toHaveText('Set Target');
		expect(page.url()).toContain('/target');
	});

	test('NAV-E2E-3: Opening and closing reserved route modal leaves underlay intact', async ({
		page
	}) => {
		// Go to /models
		await page.locator('app-sidebar a[href="/models"]').click();
		await expect(page.locator('#content h1')).toHaveText('Train Models');

		// Open about modal via footer
		await page.locator('app-sidebar footer a[href="/about"]').click();
		expect(page.url()).toContain('/about');

		const modal = page.locator('app-content-modal dialog');
		await expect(modal).toBeVisible();
		await expect(modal.locator('h2')).toHaveText('About samatā.ml');

		// Underlay content is still mounted underneath
		await expect(page.locator('#content h1')).toHaveText('Train Models');

		// Close modal via close button
		await modal.locator('button.btn-icon').click();
		await expect(modal).not.toBeVisible();
		await expect(page).toHaveURL(/\/models$/);
		await expect(page.locator('#content h1')).toHaveText('Train Models');
	});

	test('NAV-E2E-9: Deep link to /models/1 loads cleanly with root-absolute assets', async ({
		page
	}) => {
		// Persist a real model so startup reconciliation retains the deep-linked record.
		await page.locator('app-dataset-card[dataset-id="iris"] button.btn-primary').click();
		await expect(page.locator('app-dataset-preview')).toBeVisible();
		await page.locator('app-sidebar a[href="/target"]').click();
		await page.locator('app-target-view tbody tr:has(th:has-text("class")) button').click();
		await page.locator('app-sidebar a[href="/models"]').click();
		await page.locator('app-models-view button:has-text("Train New Model")').click();
		await expect(page).toHaveURL(/\/models\/1$/);
		await page.locator('app-sidebar a[href="/data"]').click();

		const failedRequests: string[] = [];
		page.on('requestfailed', (req) => {
			failedRequests.push(req.url());
		});

		await page.goto('/models/1');

		// Check heading
		await expect(page.locator('#content h1')).toHaveText('Model 1');

		// Sidebar should render steps
		await expect(page.locator('app-sidebar nav.workflow')).toBeVisible();

		// No stylesheet or script asset requests should have failed
		const assetFailures = failedRequests.filter(
			(url) => url.endsWith('.css') || url.endsWith('.js')
		);
		expect(assetFailures).toEqual([]);
	});

	test('NAV-E2E-2d: Sidebar link aria-current conforms to SEM-03', async ({ page }) => {
		for (const path of ['/data', '/target', '/models', '/results']) {
			await page.goto(path);
			// Exactly one a[aria-current="page"] exists and matches path
			const currentLinks = page.locator('app-sidebar a[aria-current="page"]');
			await expect(currentLinks).toHaveCount(1);
			expect(await currentLinks.getAttribute('href')).toBe(path);

			// No li[aria-current] exists
			const currentLis = page.locator('app-sidebar li[aria-current]');
			await expect(currentLis).toHaveCount(0);

			// No empty aria-current attribute exists anywhere in app-sidebar
			const emptyAriaCurrent = page.locator('app-sidebar [aria-current=""]');
			await expect(emptyAriaCurrent).toHaveCount(0);

			// Activating the current link adds no history entry and keeps focus on link
			const initialLength = await page.evaluate(() => window.history.length);
			await currentLinks.click();
			const afterLength = await page.evaluate(() => window.history.length);
			expect(afterLength).toBe(initialLength);
		}
	});

	test('SNC-14: Focus management on reload, user navigation, and modal dismiss', async ({
		page
	}) => {
		// 1. Reload on /target: activeElement is not <h1>
		await page.goto('/target');
		await expect(page.locator('#content h1')).not.toBeFocused();

		// 2. Click sidebar link to /models: activeElement is #content h1
		await page.locator('app-sidebar a[href="/models"]').click();
		await expect(page.locator('#content h1')).toHaveText('Train Models');
		await expect(page.locator('#content h1')).toBeFocused();

		// 3. /target -> open /about -> Esc: focus is not on <h1>
		await page.locator('app-sidebar a[href="/target"]').click();
		await keyboardNavigate(page, '/about');
		const modal = page.locator('app-content-modal dialog');
		await expect(modal).toBeVisible();

		await page.keyboard.press('Escape');
		await expect(modal).not.toBeVisible();
		await expect(page.locator('#content h1')).not.toBeFocused();
		await expect(page.locator('app-sidebar footer a[href="/about"]')).toBeFocused();
	});

	test('SNC-15: Scroll restoration across navigation and modal open/close', async ({ page }) => {
		await page.goto('/target');
		await expect(page.locator('app-target-view h1')).toHaveText('Set Target');
		await page.addStyleTag({ content: '#content { min-height: 300vh !important; }' });
		await expect
			.poll(() => page.evaluate(() => document.documentElement.scrollHeight - innerHeight))
			.toBeGreaterThan(600);

		// Scroll down /target
		await page.evaluate(() => window.scrollTo(0, 600));
		await expect
			.poll(() =>
				page.evaluate(
					() =>
						JSON.parse(localStorage.getItem('samata-ml:scroll') ?? '{}').snapshots
							?.target?.top
				)
			)
			.toBe(600);

		// Click to /models
		await page.locator('app-sidebar a[href="/models"]').click();
		await expect(page.locator('#content h1')).toHaveText('Train Models');

		// Back to /target
		await page.goBack();
		await expect(page.locator('#content h1')).toHaveText('Set Target');
		await expect
			.poll(() => page.evaluate(() => Math.abs(window.scrollY - 600)))
			.toBeLessThanOrEqual(2);
		const scrollYOnReturn = await page.evaluate(() => window.scrollY);

		// Open /about
		await page.locator('app-sidebar footer a[href="/about"]').click();
		const modal = page.locator('app-content-modal dialog');
		await expect(modal).toBeVisible();

		// Close /about
		await modal.locator('button.btn-icon').click();
		await expect(modal).not.toBeVisible();

		const scrollYAfterModal = await page.evaluate(() => window.scrollY);
		expect(scrollYAfterModal).toBe(scrollYOnReturn);
	});

	test('SNC-16: Link clicks in sidebar and reserved dialog trigger client-side navigation without page reload', async ({
		page
	}) => {
		await page.goto('/data');

		// Set a marker on the window object. If a full page reload occurs, this property is lost.
		await page.evaluate(() => {
			(window as any).__spaMarker = 'persists-across-client-navigation';
		});

		let documentNavigationRequests = 0;
		page.on('request', (req) => {
			if (req.isNavigationRequest() && req.frame() === page.mainFrame()) {
				documentNavigationRequests++;
			}
		});

		// 1. Sidebar link click
		await page.locator('app-sidebar a[href="/target"]').click();
		await expect(page.locator('#content h1')).toHaveText('Set Target');
		expect(page.url()).toContain('/target');
		expect(await page.evaluate(() => (window as any).__spaMarker)).toBe(
			'persists-across-client-navigation'
		);

		// 2. Footer reserved link click
		await page.locator('app-sidebar footer a[href="/about"]').click();
		const modal = page.locator('app-content-modal dialog');
		await expect(modal).toBeVisible();
		expect(page.url()).toContain('/about');
		expect(await page.evaluate(() => (window as any).__spaMarker)).toBe(
			'persists-across-client-navigation'
		);

		// Zero document navigation requests occurred
		expect(documentNavigationRequests).toBe(0);
	});

	test('FOCUS-AC-1: keyboard navigation and history focus every empty route heading', async ({
		page
	}) => {
		for (const path of ['/target', '/models', '/results', '/data']) {
			await keyboardNavigate(page, path);
			await expect(page.locator('#content h1')).toBeFocused();
		}
		await page.goBack();
		await expect(page.locator('#content h1')).toHaveText('Compare Results');
		await expect(page.locator('#content h1')).toBeFocused();
		await page.goForward();
		await expect(page.locator('app-data-view h1')).toBeFocused();

		// A native fixture link exercises the actual router for a missing model URL.
		await page.evaluate(() => {
			const link = document.createElement('a');
			link.href = '/models/999';
			link.textContent = 'Open missing model';
			link.dataset.testid = 'missing-model-link';
			document.body.append(link);
		});
		await page.getByTestId('missing-model-link').focus();
		await page.getByTestId('missing-model-link').press('Enter');
		await expect(page.locator('app-model-builder-view h1')).toHaveText('Model Not Found');
		await expect(page.locator('app-model-builder-view h1')).toBeFocused();
	});

	test('FOCUS-AC-1: a real model and nested dataset preview receive requested heading focus', async ({
		page
	}) => {
		await createIrisModel(page);
		await expect(page.locator('app-model-builder-view h1')).toHaveText('Model 1');
		await expect(page.locator('app-model-builder-view h1')).toBeFocused();
		await keyboardNavigate(page, '/data');
		await expect(page.locator('app-dataset-preview h1')).toBeFocused();
		await page.goBack();
		await expect(page.locator('app-model-builder-view h1')).toBeFocused();
		await page.goForward();
		await expect(page.locator('app-dataset-preview h1')).toBeFocused();
	});

	test('FOCUS-AC-2: reload, current links, data-mode changes and modal cycles do not request heading focus', async ({
		page
	}) => {
		await page.reload();
		await expect(page.locator('app-data-view h1')).not.toBeFocused();
		await keyboardNavigate(page, '/target');
		await expect(page.locator('#content h1')).toBeFocused();
		const current = page.locator('app-sidebar a[href="/target"]');
		await current.focus();
		const before = await page.evaluate(() => ({ history: history.length, top: scrollY }));
		await current.press('Enter');
		await expect(current).toBeFocused();
		expect(await page.evaluate(() => ({ history: history.length, top: scrollY }))).toEqual(
			before
		);
		await keyboardNavigate(page, '/about');
		await expect(page.locator('app-content-modal dialog')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page.locator('app-content-modal dialog')).not.toBeVisible();
		await expect(page.locator('app-sidebar a[href="/about"]')).toBeFocused();
		await expect(page.locator('#content h1')).not.toBeFocused();
		await keyboardNavigate(page, '/data');
		await loadSampleDataset(page, 'iris');
		await expect(page.locator('app-dataset-preview h1')).not.toBeFocused();
		const change = page.locator('app-dataset-preview button:has-text("Change Dataset")');
		await change.focus();
		await page.evaluate(() => {
			const state = window.__appState!.get();
			window.__appState!.set({ ...state, data: { ...state.data, selectedColumn: null } });
		});
		await expect(change).toBeFocused();
	});

	test('FOCUS-AC-2: Back closing a reserved modal returns focus to its invoker, and Forward reopens it', async ({
		page
	}) => {
		const about = page.locator('app-sidebar a[href="/about"]');
		const modal = page.locator('app-content-modal dialog');
		await keyboardNavigate(page, '/about');
		await expect(modal).toBeVisible();
		await expect(page).toHaveURL(/\/about$/);

		await page.goBack();
		await expect(page).toHaveURL(/\/data$/);
		await expect(modal).not.toBeVisible();
		await expect(about).toBeFocused();
		await expect(page.locator('#content h1')).not.toBeFocused();

		await page.goForward();
		await expect(page).toHaveURL(/\/about$/);
		await expect(modal).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page).toHaveURL(/\/data$/);
		await expect(modal).not.toBeVisible();
		await expect(about).toBeFocused();
	});

	for (const destination of ['workflow', 'modal'] as const) {
		test(`FOCUS-AC-3: delayed target focus is cancelled by a later ${destination} navigation`, async ({
			page
		}) => {
			await delayHeadingFocus(page, 'app-target-view');
			await keyboardNavigate(page, '/target');
			await expect(page.locator('app-target-view h1')).toBeVisible();
			await keyboardNavigate(page, destination === 'workflow' ? '/models' : '/about');
			if (destination === 'modal')
				await expect(page.locator('app-content-modal dialog')).toBeVisible();
			else await expect(page.locator('app-models-view h1')).toBeFocused();
			await releaseHeadingFocus(page);
			if (destination === 'modal') {
				await expect(page.locator('app-content-modal button.btn-icon')).toBeFocused();
				await expect(page.locator('app-target-view h1')).not.toBeFocused();
			} else await expect(page.locator('app-models-view h1')).toBeFocused();
		});
	}

	test('FOCUS-AC-3: data-mode replacement cancels nested focus; aborted and disconnected methods are harmless', async ({
		page
	}) => {
		await loadSampleDataset(page, 'iris');
		await keyboardNavigate(page, '/models');
		await delayHeadingFocus(page, 'app-data-view');
		await keyboardNavigate(page, '/data');
		await expect(page.locator('app-dataset-preview')).toBeVisible();
		await page.evaluate(() => {
			const state = window.__appState!.get();
			window.__appState!.set({ ...state, data: { ...state.data, mode: 'select' } });
		});
		const upload = page.locator('app-data-view button:has-text("Upload Dataset")');
		await upload.focus();
		await releaseHeadingFocus(page);
		await expect(upload).toBeFocused();
		await expect(page.locator('app-data-view h1')).not.toBeFocused();
		await page.evaluate(async () => {
			const tags = [
				'app-target-view',
				'app-models-view',
				'app-model-builder-view',
				'app-dataset-preview'
			] as const;
			for (const tag of tags) {
				const disconnected = document.createElement(tag);
				await disconnected.focusHeading(new AbortController().signal);
			}
			const data = document.querySelector('app-data-view')!;
			const cancelled = new AbortController();
			cancelled.abort();
			await data.focusHeading(cancelled.signal);
		});
		await expect(upload).toBeFocused();
	});

	test('FOCUS-AC-3: a removed target cannot steal focus and a new request works after reattachment', async ({
		page
	}) => {
		await delayHeadingFocus(page, 'app-target-view');
		await keyboardNavigate(page, '/target');
		await expect(page.locator('app-target-view h1')).toBeVisible();
		await page.evaluate(() => {
			const view = document.querySelector('app-target-view')!;
			(window as FocusTestWindow).__detachedFocusView = view;
			view.remove();
		});
		const invoker = page.locator('app-sidebar a[href="/target"]');
		await invoker.focus();
		await releaseHeadingFocus(page);
		await expect(invoker).toBeFocused();
		await page.evaluate(async () => {
			const view = (window as FocusTestWindow).__detachedFocusView!;
			document.querySelector('#content')!.append(view);
			await view.focusHeading(new AbortController().signal);
		});
		await expect(page.locator('app-target-view h1')).toBeFocused();
	});

	test('FOCUS-AC-4: preview heading is ready before metadata and body transitions do not refocus', async ({
		page,
		browserName
	}) => {
		await loadSampleDataset(page, 'iris');
		await expect(page.locator('app-dataset-preview h1')).toContainText('Iris');
		await keyboardNavigate(page, '/models');
		await page.evaluate(() => {
			const store = window.__datasetResources!;
			const ready = store.get();
			store.set({ ...ready, status: 'loading', metadata: null, error: null });
			(window as FocusTestWindow).__releaseMetadata = () => store.set(ready);
		});
		await keyboardNavigate(page, '/data');
		const heading = page.locator('app-dataset-preview h1');
		await expect(heading).toBeFocused();
		await expect(heading).toHaveAttribute('tabindex', '-1');
		const originalHeading = await heading.elementHandle();
		// Safari's default keyboard mode uses Option+Tab to include native buttons.
		await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
		const change = page.locator('app-dataset-preview button:has-text("Change Dataset")');
		await expect(change).toBeFocused();
		await page.evaluate(() => (window as FocusTestWindow).__releaseMetadata!());
		await expect(heading).toContainText('Iris');
		await expect(change).toBeFocused();
		expect(await originalHeading!.evaluate((element) => element.isConnected)).toBe(true);
		await page.evaluate(() => {
			const store = window.__datasetResources!;
			store.set({
				...store.get(),
				status: 'error',
				metadata: null,
				error: 'Controlled metadata failure'
			});
		});
		await expect(page.locator('app-dataset-preview .status-box[role="alert"]')).toBeVisible();
		await expect(change).toBeFocused();
		await page.evaluate(() => (window as FocusTestWindow).__releaseMetadata!());
		await expect(change).toBeFocused();
	});

	test('FOCUS-AC-4: selection heading is programmatic only and Tab moves to the action', async ({
		page,
		browserName
	}) => {
		await keyboardNavigate(page, '/target');
		await keyboardNavigate(page, '/data');
		await expect(page.locator('app-data-view h1')).toHaveAttribute('tabindex', '-1');
		await expect(page.locator('app-data-view h1')).toBeFocused();
		await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
		await expect(page.locator('app-data-view button:has-text("Upload Dataset")')).toBeFocused();
	});

	test('FOCUS-AC-5: heading outlines work in all owning roots', async ({ page }) => {
		await keyboardNavigate(page, '/target');
		await keyboardNavigate(page, '/data');
		await expect(page.locator('app-data-view h1')).toBeFocused();
		expect(await outline(page.locator('app-data-view h1'))).toMatchObject({
			width: '2px',
			style: 'solid',
			offset: '2px'
		});
		await createIrisModel(page);
		for (const path of ['/data', '/target', '/models', '/results']) {
			await keyboardNavigate(page, path);
			const heading = page.locator('#content h1');
			await expect(heading).toBeFocused();
			expect(await outline(heading)).toMatchObject({
				width: '2px',
				style: 'solid',
				offset: '2px'
			});
		}
		await page.goBack();
		await keyboardNavigate(page, '/models/1');
		await expect(page.locator('#content h1')).toBeFocused();
		expect(await outline(page.locator('#content h1'))).toMatchObject({
			width: '2px',
			style: 'solid',
			offset: '2px'
		});
	});

	test('FOCUS-AC-5: long RTL headings retain geometry, forced-colour outlines and preventScroll', async ({
		page
	}) => {
		await keyboardNavigate(page, '/target');
		const heading = page.locator('app-target-view h1');
		await page.evaluate(() => {
			document.documentElement.dir = 'rtl';
		});
		await heading.evaluate((element) => {
			element.textContent = 'عنوان طويل لاختبار التركيز وإعادة تدفق النص '.repeat(8);
		});
		const before = await heading.boundingBox();
		expect(await outline(heading)).toMatchObject({
			width: '2px',
			style: 'solid',
			offset: '2px'
		});
		await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
		expect(await outline(heading)).toMatchObject({
			width: '2px',
			style: 'solid',
			offset: '2px'
		});
		expect((await outline(heading)).colour).not.toBe('rgba(0, 0, 0, 0)');
		expect(await heading.boundingBox()).toEqual(before);
		await page.addStyleTag({ content: '#content { min-block-size: 300vh; }' });
		await page.evaluate(() => window.scrollTo(0, 450));
		const top = await page.evaluate(() => scrollY);
		await page.locator('app-target-view').evaluate(async (element) => {
			await (element as HTMLElementTagNameMap['app-target-view']).focusHeading(
				new AbortController().signal
			);
		});
		expect(await page.evaluate(() => scrollY)).toBe(top);
		await expect(heading).toBeFocused();
	});

	test('FOCUS-AC-5: nested preview focus preserves document and table offsets', async ({
		page
	}) => {
		await page.setViewportSize({ width: 1000, height: 800 });
		await loadSampleDataset(page, 'iris');
		const table = page.locator('app-dataset-preview ui-virtual-table');
		await table.evaluate(async (element) => {
			await (element as HTMLElementTagNameMap['ui-virtual-table']).scrollToRow(50, 5, 25);
		});
		const viewport = table.locator('.table-viewport');
		await expect
			.poll(() => viewport.evaluate((element) => element.scrollTop))
			.toBeGreaterThan(0);
		await page.addStyleTag({ content: '#content { min-block-size: 300vh; }' });
		await page.evaluate(() => window.scrollTo(0, 450));
		const documentTop = await page.evaluate(() => scrollY);
		const tablePosition = await viewport.evaluate((element) => ({
			top: element.scrollTop,
			left: element.scrollLeft
		}));
		await page.locator('app-data-view').evaluate(async (element) => {
			await (element as HTMLElementTagNameMap['app-data-view']).focusHeading(
				new AbortController().signal
			);
		});
		await expect(page.locator('app-dataset-preview h1')).toBeFocused();
		expect(await page.evaluate(() => scrollY)).toBe(documentTop);
		expect(
			await viewport.evaluate((element) => ({
				top: element.scrollTop,
				left: element.scrollLeft
			}))
		).toEqual(tablePosition);
	});

	test('FOCUS-AC-6: selection and preview focus preserve header geometry with paired references', async ({
		page,
		context
	}, testInfo) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		for (const [mode, mockup] of [
			['selection', '01-1_select-data.html'],
			['preview', '01-4_preview-dataset.html']
		] as const) {
			if (mode === 'preview') await loadSampleDataset(page, 'iris');
			await page.locator('app-data-view').evaluate(async (element) => {
				await (element as HTMLElementTagNameMap['app-data-view']).whenSettled();
			});
			const heading = page.locator('#content h1');
			const before = await heading.evaluate((element) => {
				const style = getComputedStyle(element);
				const box = element.getBoundingClientRect();
				return {
					width: box.width,
					height: box.height,
					fontSize: style.fontSize,
					weight: style.fontWeight,
					colour: style.color
				};
			});
			const reference = await context.newPage();
			await reference.setViewportSize({ width: 1440, height: 900 });
			await reference.goto(`${MOCKUPS_URL}/${mockup}?clean=1`);
			for (const [label, surface] of [
				['reference', reference],
				['app', page]
			] as const) {
				const screenshot = testInfo.outputPath(`focus-${mode}-${label}.png`);
				await surface.screenshot({ path: screenshot });
				await testInfo.attach(`focus-${mode}-${label}`, {
					path: screenshot,
					contentType: 'image/png'
				});
			}
			await reference.close();
			await page.keyboard.press('Tab');
			await page.locator('app-data-view').evaluate(async (element) => {
				await (element as HTMLElementTagNameMap['app-data-view']).focusHeading(
					new AbortController().signal
				);
			});
			await expect(heading).toBeFocused();
			expect(
				await heading.evaluate((element) => {
					const style = getComputedStyle(element);
					const box = element.getBoundingClientRect();
					return {
						width: box.width,
						height: box.height,
						fontSize: style.fontSize,
						weight: style.fontWeight,
						colour: style.color
					};
				})
			).toEqual(before);
			const screenshot = testInfo.outputPath(`focus-${mode}-focused.png`);
			await page.screenshot({ path: screenshot });
			await testInfo.attach(`focus-${mode}-focused-visual-design-4-SEM-01`, {
				path: screenshot,
				contentType: 'image/png'
			});
		}
	});

	test('PH-AC-1: results page header focuses by keyboard and reflows long LTR/RTL text with a native action', async ({
		page,
		browserName
	}, testInfo) => {
		await page.setViewportSize({ width: 375, height: 900 });
		await keyboardNavigate(page, '/results');
		const heading = page.locator('app-results-view header > h1');
		await expect(heading).toBeFocused();
		expect(await outline(heading)).toMatchObject({
			width: '2px',
			style: 'solid',
			offset: '2px'
		});
		await page.locator('app-results-view header').evaluate((header) => {
			header.querySelector('h1')!.textContent =
				'A very long classification comparison title with many words and UnbrokenDatasetNameThatMustWrapAcrossLines';
			header.querySelector('p')!.textContent =
				'Compare every model and inspect the classification metrics before choosing a result.';
			const action = document.createElement('button');
			action.type = 'button';
			action.className = 'btn btn-primary';
			action.textContent = 'Choose another model';
			header.append(action);
		});
		for (const direction of ['ltr', 'rtl']) {
			await page.evaluate((direction) => {
				document.documentElement.dir = direction;
			}, direction);
			const boxes = await page.locator('app-results-view header').evaluate((header) => {
				const bounds = header.getBoundingClientRect();
				return [...header.children].map((child) => {
					const box = child.getBoundingClientRect();
					return {
						start: box.left - bounds.left,
						end: box.right - bounds.left,
						width: bounds.width,
						height: box.height
					};
				});
			});
			for (const box of boxes) {
				expect(box.start).toBeGreaterThanOrEqual(-1);
				expect(box.end).toBeLessThanOrEqual(box.width + 1);
			}
			expect(boxes[0]!.height).toBeGreaterThan(48);
			await heading.focus();
			await heading.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
			await expect(page.locator('app-results-view header > button')).toBeFocused();
			await page.screenshot({
				path: testInfo.outputPath(`page-header-long-${direction}.png`),
				fullPage: true
			});
		}
	});

	test('PH-AC-2: main uses reference geometry and the results header retains semantic markup', async ({
		page,
		context
	}, testInfo) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		const reference = await context.newPage();
		await reference.setViewportSize({ width: 1440, height: 900 });
		await reference.goto(`${MOCKUPS_URL}/01-1_select-data.html?clean=1`);
		await reference.screenshot({
			path: testInfo.outputPath('main-reference.png'),
			fullPage: true
		});
		await page.screenshot({ path: testInfo.outputPath('main-app.png'), fullPage: true });
		const geometry = (element: Element) => {
			const style = getComputedStyle(element);
			return {
				padding: style.padding,
				margin: style.marginInlineStart,
				minHeight: style.minBlockSize,
				sizing: style.boxSizing
			};
		};
		expect(await page.locator('main').evaluate(geometry)).toEqual(
			await reference.locator('main').evaluate(geometry)
		);
		await reference.close();
		await keyboardNavigate(page, '/results');
		await expect(page.locator('app-results-view header.page-header > p')).toHaveText(
			'Compare performance metrics across trained models.'
		);
		await expect(page.locator('app-results-view .notification')).toContainText(
			'Train at least two models'
		);
		await expect(page.locator('app-results-view .notification a')).toHaveAttribute(
			'href',
			'/models'
		);
		await expect(page.locator('#app > style, #app-container, main[role]')).toHaveCount(0);
	});

	test('PH-AC-2: results header and main non-padding geometry match independently', async ({
		page,
		context
	}) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		const reference = await context.newPage();
		await reference.setViewportSize({ width: 1440, height: 900 });
		await reference.goto('http://localhost:3333/01-1_select-data.html?clean=1');
		const geometry = (element: Element) => {
			const style = getComputedStyle(element);
			return {
				margin: style.marginInlineStart,
				minHeight: style.minBlockSize,
				sizing: style.boxSizing
			};
		};
		expect(await page.locator('main').evaluate(geometry)).toEqual(
			await reference.locator('main').evaluate(geometry)
		);
		await reference.close();
		await keyboardNavigate(page, '/results');
		await expect(page.locator('app-results-view header.page-header > p')).toHaveText(
			'Compare performance metrics across trained models.'
		);
		await expect(page.locator('app-results-view .notification')).toContainText(
			'Train at least two models'
		);
		await expect(page.locator('app-results-view .notification a')).toHaveAttribute(
			'href',
			'/models'
		);
		await expect(page.locator('#app > style, #app-container, main[role]')).toHaveCount(0);
	});

	test('PH-AC-3: data and target controls remain usable with no main sidebar margin at 375px', async ({
		page
	}) => {
		await page.setViewportSize({ width: 375, height: 900 });
		await expect(page.locator('main')).toHaveCSS('margin-inline-start', '0px');
		await expect(page.locator('app-sidebar')).toHaveCSS('position', 'static');
		await page.locator('app-data-view .page-header .btn-primary').click();
		await expect(page.locator('app-upload-dataset-dialog dialog')).toBeVisible();
		await page.keyboard.press('Escape');
		await loadSampleDataset(page, 'iris');
		await keyboardNavigate(page, '/target');
		await expect(page.locator('main')).toHaveCSS('margin-inline-start', '0px');
		await page.locator('app-target-view tbody tr:has(th:has-text("class")) button').click();
		await expect.poll(() => page.evaluate(() => window.__appState!.get().target)).toBe('class');
	});
});

test.describe('Shared primitive acceptance', () => {
	test.beforeEach(async ({ page }) => {
		await mountPrimitiveFixture(page);
	});

	test('BTN-AC-1: native default and primary buttons pass axe including contrast', async ({
		page
	}) => {
		const audit = await new AxeBuilder({ page })
			.withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
			.analyze();
		expect(audit.violations).toEqual([]);
	});
	test('BTN-AC-2: Tab reaches the button and Enter and Space each click once', async ({
		page,
		browserName
	}) => {
		const button = await focusFirstButton(page, browserName);
		await button.press('Enter');
		await expect(button).toHaveAttribute('data-clicks', '1');
		await button.press('Space');
		await expect(button).toHaveAttribute('data-clicks', '2');
	});
	test('BTN-AC-3: keyboard focus has a two-pixel outline', async ({ page, browserName }) => {
		expect(await outline(await focusFirstButton(page, browserName))).toMatchObject({
			width: '2px',
			style: 'solid',
			offset: '2px'
		});
	});
	test('BTN-AC-4: disabled buttons neither click nor change background on hover', async ({
		page
	}) => {
		const button = page.locator('#disabled');
		await expect(button).toHaveCSS('background-color', 'rgb(248, 247, 245)');
		const before = await buttonAppearance(button);
		await button.hover();
		await page.mouse.down();
		await page.mouse.up();
		await expect(button).not.toHaveAttribute('data-clicks');
		expect(await buttonAppearance(button)).toEqual(before);
	});
	test('BTN-AC-5: reduced motion removes transitions', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await expect(page.locator('#default')).toHaveCSS('transition-duration', '0s');
	});
	test('BTN-AC-6: a real test Lit host adopts the same exported button styles as the document', async ({
		page
	}) => {
		const directory = mkdtempSync(join(tmpdir(), 'samata-button-'));
		try {
			const bundle = join(directory, 'host.js');
			execFileSync(
				'bun',
				[
					'build',
					'.storybook/fixtures/storybook-button-host.ts',
					'--target=browser',
					'--outfile',
					bundle
				],
				{ stdio: 'pipe' }
			);
			await page.addScriptTag({ type: 'module', content: readFileSync(bundle, 'utf8') });
			await page.waitForFunction(() => customElements.get('storybook-button-host'));
			await page.evaluate(async () => {
				const host = document.createElement('storybook-button-host');
				host.label = 'Datasheet';
				document.querySelector('main')!.append(host);
				await host.updateComplete;
			});
			const shadow = page
				.locator('storybook-button-host')
				.getByRole('button', { name: 'Datasheet', exact: true });
			await expect(shadow).toHaveCSS('background-color', 'rgb(252, 251, 250)');
			await expect(page.locator('#default')).toHaveCSS(
				'background-color',
				'rgb(252, 251, 250)'
			);
			expect(await buttonAppearance(shadow)).toEqual(
				await buttonAppearance(page.locator('#default'))
			);
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});
	test('BTN-AC-7: the production document adopts buttonStyles globally', async ({ page }) => {
		await page.goto('/results');
		await page.getByRole('button', { name: 'Get Started', exact: true }).click();
		await page.locator('main').evaluate((main) => {
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'btn';
			button.textContent = 'Document button';
			main.append(button);
		});
		await expect(page.locator('main > .btn')).toHaveCSS('color', 'rgb(109, 96, 86)');
		await expect(page.locator('main > .btn')).toHaveCSS('border-bottom-width', '3px');
	});
	test('BTN-AC-8: native button typography inherits its parent font', async ({ page }) => {
		expect((await buttonAppearance(page.locator('#default'))).font).toBe(
			await page.locator('main').evaluate((element) => getComputedStyle(element).fontFamily)
		);
	});
	test('BTN-AC-9: a sixty-character label wraps inside two hundred pixels in LTR and RTL', async ({
		page
	}) => {
		for (const direction of ['ltr', 'rtl']) {
			await page.evaluate((direction) => {
				document.documentElement.dir = direction;
			}, direction);
			const button = await page.locator('#long').boundingBox();
			const container = await page.locator('#long-container').boundingBox();
			expect(button!.width).toBeLessThanOrEqual(container!.width);
			expect(button!.height).toBeGreaterThan(40);
		}
	});
	test('BTN-AC-10: forced colours retain the keyboard outline', async ({ page, browserName }) => {
		await page.emulateMedia({ forcedColors: 'active' });
		const style = await outline(await focusFirstButton(page, browserName));
		expect(style).toMatchObject({ width: '2px', style: 'solid' });
		expect(style.colour).not.toBe('rgba(0, 0, 0, 0)');
	});
	test('BTN-AC-11: native text buttons meet the twenty-four-pixel target height', async ({
		page
	}) => {
		for (const selector of ['#default', '#primary', '#disabled'])
			expect((await page.locator(selector).boundingBox())!.height).toBeGreaterThanOrEqual(24);
	});
	test('BTN-AC-12: primary without btn leaves the native appearance unchanged', async ({
		page
	}) => {
		expect(await buttonAppearance(page.locator('#unmodified'))).toEqual(
			await buttonAppearance(page.locator('#plain'))
		);
	});
	test('BTN-AC-13: the icon button is named and its SVG is decorative, with paired references', async ({
		page,
		context
	}, testInfo) => {
		await expect(page.getByRole('button', { name: 'Close modal', exact: true })).toBeVisible();
		await expect(page.locator('#icon svg')).toHaveAttribute('aria-hidden', 'true');
		await expect(page.locator('#icon svg')).toHaveAttribute('focusable', 'false');
		await expect(page.getByRole('img')).toHaveCount(0);
		const reference = await context.newPage();
		await reference.goto(`${MOCKUPS_URL}/01-3_upload-dataset.html?clean=1`);
		const appearance = (element: Element) => {
			const style = getComputedStyle(element);
			return {
				background: style.backgroundColor,
				colour: style.color,
				padding: style.padding,
				radius: style.borderRadius,
				border: style.borderStyle,
				width: style.width,
				height: style.height
			};
		};
		expect(await page.locator('#icon').evaluate(appearance)).toEqual(
			await reference.locator('dialog .btn-icon').evaluate(appearance)
		);
		await reference
			.locator('dialog .btn-icon')
			.screenshot({ path: testInfo.outputPath('icon-reference.png') });
		await page.locator('#icon').screenshot({ path: testInfo.outputPath('icon-app.png') });
		await reference.close();
	});
	test('BTN-AC-14: icon controls retain a twenty-four-pixel target and glyph', async ({
		page
	}) => {
		const button = (await page.locator('#icon').boundingBox())!;
		expect(button.width).toBeGreaterThanOrEqual(24);
		expect(button.height).toBeGreaterThanOrEqual(24);
		await expect(page.locator('#icon svg')).toHaveCSS('width', '24px');
		await expect(page.locator('#icon svg')).toHaveCSS('height', '24px');
	});
	test('CHIP-AC-1: default and solid chiclets match the reference type, case and padding', async ({
		page
	}) => {
		await expect(page.locator('#chiclet')).toHaveCSS('display', 'inline');
		await expect(page.locator('#chiclet')).toHaveCSS('border-top-color', 'rgb(136, 123, 113)');
		await expect(page.locator('#chiclet')).toHaveCSS('padding-inline-start', '4px');
		await expect(page.locator('#chiclet')).toHaveCSS('font-size', '12px');
		await expect(page.locator('#chiclet')).toHaveCSS('font-weight', '500');
		expect(
			await page
				.locator('#chiclet')
				.evaluate((element) => getComputedStyle(element).fontFamily)
		).toBe(
			await page.locator('main').evaluate((element) => getComputedStyle(element).fontFamily)
		);
		await expect(page.locator('#chiclet')).toHaveCSS('line-height', 'normal');
		await expect(page.locator('#chiclet')).toHaveCSS('white-space', 'normal');
		for (const colour of ['purple', 'teal', 'amber']) {
			const chiclet = page.locator(`.chiclet-${colour}`);
			await expect(chiclet).toHaveCSS('display', 'inline-block');
			await expect(chiclet).toHaveCSS('text-transform', 'uppercase');
			await expect(chiclet).toHaveCSS('letter-spacing', '2px');
			await expect(chiclet).toHaveCSS('padding-inline-start', '6px');
		}
		await expect(page.locator('.chiclet-amber')).toHaveCSS('color', 'rgb(51, 41, 35)');
	});
	test('DLG-AC-1: native modal opening, naming, Esc and invoker focus work with shared styles', async ({
		page
	}) => {
		const opener = page.locator('#open-dialog');
		await page.keyboard.press('Tab');
		await opener.focus();
		await opener.press('Enter');
		const dialog = page.getByRole('dialog', { name: 'Dataset information', exact: true });
		await expect(dialog).toBeVisible();
		expect(await dialog.evaluate((element) => element.matches(':modal'))).toBe(true);
		await expect(dialog).not.toHaveAttribute('role');
		await expect(dialog).not.toHaveAttribute('aria-modal');
		await expect(dialog).toHaveCSS('border-top-width', '1px');
		await expect(dialog.locator('h2')).toHaveCSS('margin', '0px');
		await page.keyboard.press('Escape');
		await expect(page.locator('dialog')).toBeHidden();
		await expect(page.locator('dialog')).toHaveAttribute('data-closes', '1');
		await expect(opener).toBeFocused();
	});
});
