import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator } from '@playwright/test';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];

const LOGISTIC_REGRESSION_SVG = `
	<svg slot="image" viewBox="0 0 360 216" aria-hidden="true">
		<circle cx="6" cy="6" r="6" fill="var(--amber-300, #FCD34D)" transform="translate(95 60)" />
		<circle cx="6" cy="6" r="6" fill="var(--blue-200, #BFDBFE)" transform="translate(192 159)" />
		<line x1="10" x2="350" y1="185" y2="10" stroke="var(--stone-700, #6D6056)" stroke-width="6" />
	</svg>
`;

test.describe('Model Card and Description Dialog (MOD-CARD-1, MOD-DESC-1)', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/data');
		const welcome = page.locator('app-welcome-modal dialog.modal');
		await welcome.getByRole('button', { name: 'Get Started' }).click();
		await expect(welcome).toBeHidden();
	});

	test('MOD-CARD-1: typed identity, image slot, native actions, chiclet types, RTL and a11y', async ({
		page
	}) => {
		await page.evaluate((svgMarkup) => {
			const container = document.createElement('div');
			container.id = 'card-test-container';
			container.style.padding = '20px';
			container.style.maxWidth = '360px';
			container.innerHTML = `
				<ul style="list-style: none; margin: 0; padding: 0;">
					<li>
						<app-model-card
							id="card-clf"
							model-id="logistic-regression"
							type="classification"
							name="Logistic Regression"
							description="A classification tool used to predict a binary outcome.">
							${svgMarkup}
						</app-model-card>
					</li>
					<li>
						<app-model-card
							id="card-reg"
							model-id="linear-regression"
							type="regression"
							name="Linear Regression"
							description="A regression tool for continuous values.">
							${svgMarkup}
						</app-model-card>
					</li>
					<li>
						<app-model-card
							id="card-clt"
							model-id="k-means"
							type="clustering"
							name="K-Means"
							description="An unsupervised clustering algorithm.">
							${svgMarkup}
						</app-model-card>
					</li>
				</ul>
			`;
			const parent = document.getElementById('content') || document.body;
			parent.appendChild(container);
		}, LOGISTIC_REGRESSION_SVG);

		const cardClf = page.locator('#card-clf');
		await expect(cardClf).toBeVisible();

		// 1. Typed identity & properties
		const modelId = await cardClf.getAttribute('model-id');
		expect(modelId).toBe('logistic-regression');

		const propValues = await cardClf.evaluate((el: any) => ({
			modelId: el.modelId,
			type: el.type,
			name: el.name,
			description: el.description
		}));
		expect(propValues.modelId).toBe('logistic-regression');
		expect(propValues.type).toBe('classification');
		expect(propValues.name).toBe('Logistic Regression');
		expect(propValues.description).toContain('classification tool');

		// 2. Chiclet badge and image slot
		const chiclet = cardClf.locator('.card-type');
		await expect(chiclet).toHaveClass(/chiclet-purple/);
		await expect(chiclet).toHaveText('Classification');

		const cardReg = page.locator('#card-reg');
		await expect(cardReg.locator('.card-type')).toHaveClass(/chiclet-teal/);
		await expect(cardReg.locator('.card-type')).toHaveText('Regression');

		const cardClt = page.locator('#card-clt');
		await expect(cardClt.locator('.card-type')).toHaveClass(/chiclet-amber/);
		await expect(cardClt.locator('.card-type')).toHaveText('Clustering');

		// Image wrapper has aria-hidden="true"
		const imgWrapper = cardClf.locator('.card-image');
		await expect(imgWrapper).toHaveAttribute('aria-hidden', 'true');

		// 3. Native buttons and model-specific names
		const descBtn = cardClf.locator('button:has-text("Model Description")');
		const selectBtn = cardClf.locator('button:has-text("Select Model")');
		await expect(descBtn).toBeVisible();
		await expect(selectBtn).toBeVisible();
		await expect(descBtn).toHaveAccessibleName('Model Description: Logistic Regression');
		await expect(selectBtn).toHaveAccessibleName('Select Model: Logistic Regression');

		// 4. Custom event dispatching (non-bubbling)
		await page.evaluate(() => {
			const card = document.getElementById('card-clf')!;
			(window as any).__events = [];
			card.addEventListener('app-model-description-open', (e: any) => {
				(window as any).__events.push({
					type: 'desc',
					detail: e.detail,
					bubbles: e.bubbles,
					composed: e.composed
				});
			});
			card.addEventListener('app-model-select', (e: any) => {
				(window as any).__events.push({
					type: 'select',
					detail: e.detail,
					bubbles: e.bubbles,
					composed: e.composed
				});
			});
		});

		await descBtn.click();
		let events = await page.evaluate(() => (window as any).__events);
		expect(events.length).toBe(1);
		expect(events[0]).toEqual({
			type: 'desc',
			detail: { modelId: 'logistic-regression', name: 'Logistic Regression' },
			bubbles: false,
			composed: false
		});

		await selectBtn.click();
		events = await page.evaluate(() => (window as any).__events);
		expect(events.length).toBe(2);
		expect(events[1]).toEqual({
			type: 'select',
			detail: { modelId: 'logistic-regression', name: 'Logistic Regression' },
			bubbles: false,
			composed: false
		});

		await cardClf.evaluate((element) => element.removeAttribute('name'));
		await expect(descBtn).toHaveAccessibleName('Model Description');
		await expect(selectBtn).toHaveAccessibleName('Select Model');

		// 5. RTL and narrow layout (320px)
		await page.evaluate((svgMarkup) => {
			const container = document.getElementById('card-test-container')!;
			container.style.maxWidth = '320px';
			container.innerHTML = `
				<div dir="rtl">
					<app-model-card
						id="card-rtl" selected
						model-id="logistic-regression"
						type="classification"
						name="انحدار لوجستي طويل جدا جدا للتأكد من التفاف النص وعدم الخروج عن الحدود"
						description="هذا النص طويل جدا جدا لاختبار قدرة البطاقة على التعامل مع النصوص الطويلة في اتجاه اليمين إلى اليسار وتأكيد التوافق وعدم حدوث أي تجاوز أفقي.">
						${svgMarkup}
					</app-model-card>
				</div>
			`;
		}, LOGISTIC_REGRESSION_SVG);

		const cardRtl = page.locator('#card-rtl');
		await expect(cardRtl).toBeVisible();
		const rtlBox = await cardRtl.boundingBox();
		expect(rtlBox?.width).toBeLessThanOrEqual(320);
		await expect(cardRtl.getByText('Selected', { exact: true })).toBeVisible();
		await expect(cardRtl.locator('.card-actions button')).toHaveCount(2);
		expect(
			await cardRtl.locator('article').evaluate((el) => el.scrollWidth - el.clientWidth)
		).toBeLessThanOrEqual(1);
		expect(
			await cardRtl.locator('.card-actions').evaluate((el) => el.scrollWidth - el.clientWidth)
		).toBeLessThanOrEqual(1);

		// Check no horizontal scrollbar on body
		const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
		const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
		expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

		// 6. Accessibility scan with axe
		const axeResults = await new AxeBuilder({ page })
			.withTags(AXE_TAGS)
			.include('#card-test-container')
			.analyze();
		const unexpectedCardViolations = axeResults.violations.filter(
			(v) => v.id !== 'color-contrast'
		);
		expect(unexpectedCardViolations).toEqual([]);
	});

	test('MODEL-ART-3: both slot forms reserve space before load and after image failure', async ({
		page
	}) => {
		await page.setViewportSize({ width: 320, height: 800 });
		const { promise: requested, resolve: reportRequest } = Promise.withResolvers<void>();
		const { promise: fail, resolve: releaseRequest } = Promise.withResolvers<void>();
		await page.route('**/assets/missing-artwork.svg', async (route) => {
			reportRequest();
			await fail;
			await route.abort();
		});

		await page.evaluate((svg) => {
			const cards = document.createElement('div');
			cards.id = 'artwork-layout';
			cards.innerHTML = [
				['inline-art', svg],
				[
					'external-art',
					'<img slot="image" src="/assets/linear-regression.svg" alt="" width="360" height="216">'
				],
				[
					'failed-art',
					'<img slot="image" src="/assets/missing-artwork.svg" alt="" width="360" height="216">'
				]
			]
				.map(
					([id, art]) =>
						'<app-model-card id="' +
						id +
						'" name="Linear Regression" selected>' +
						art +
						'</app-model-card>'
				)
				.join('');
			(document.getElementById('content') || document.body).append(cards);
		}, LOGISTIC_REGRESSION_SVG);

		const cards = page.locator('#artwork-layout app-model-card');
		async function expectImageFrame(card: Locator) {
			const shell = await card.locator('article').boundingBox();
			const frame = await card.locator('.card-image').boundingBox();
			const artwork = await card.locator('[slot="image"]').boundingBox();
			const innerWidth = await card.locator('article').evaluate((el) => el.clientWidth);
			expect(shell!.width).toBeLessThanOrEqual(320);
			expect(Math.abs(frame!.width - innerWidth)).toBeLessThanOrEqual(1);
			expect(Math.abs(frame!.height - frame!.width * 0.6)).toBeLessThanOrEqual(1);
			expect(Math.abs(artwork!.width - frame!.width)).toBeLessThanOrEqual(1);
			expect(Math.abs(artwork!.height - frame!.height)).toBeLessThanOrEqual(1);
		}

		const failed = cards.filter({
			has: page.locator('img[src="/assets/missing-artwork.svg"]')
		});
		await requested;
		try {
			await expectImageFrame(failed);
		} finally {
			releaseRequest();
		}
		await expect
			.poll(() =>
				failed
					.locator('img')
					.evaluate((img: HTMLImageElement) => [img.complete, img.naturalWidth])
			)
			.toEqual([true, 0]);
		await cards
			.nth(1)
			.locator('img')
			.evaluate((img: HTMLImageElement) => img.decode());
		for (const card of await cards.all()) {
			await expectImageFrame(card);
			await expect(card.getByRole('img')).toHaveCount(0);
			expect(await card.ariaSnapshot()).not.toMatch(/^\s*-\s+img\b/m);
			await expect(
				card.getByRole('button', { name: 'Model Description: Linear Regression' })
			).toBeEnabled();
			await expect(
				card.getByRole('button', { name: 'Select Model: Linear Regression' })
			).toBeEnabled();
			await expect(card.getByText('Selected', { exact: true })).toBeVisible();
		}
	});

	test('MODEL-ART-3: forced colours and reduced motion preserve the current action and focus', async ({
		page,
		browserName
	}) => {
		test.skip(
			browserName !== 'chromium',
			'Forced colours inspection uses Chromium media emulation'
		);
		await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
		await page.evaluate(() => {
			const card = document.createElement('app-model-card');
			card.modelId = 'logistic-regression';
			card.name = 'Logistic Regression';
			card.selected = true;
			(document.getElementById('content') || document.body).append(card);
		});
		const card = page.locator('app-model-card');
		const description = card.getByRole('button', {
			name: 'Model Description: Logistic Regression'
		});
		const select = card.getByRole('button', { name: 'Select Model: Logistic Regression' });
		await description.focus();
		await page.keyboard.press('Tab');
		await expect(select).toBeFocused();
		await expect(select).toHaveCSS('outline-style', 'solid');
		await expect(select).toHaveCSS('outline-width', '2px');
		await expect(select).toHaveAttribute('aria-current', 'true');
		await expect(card.getByText('Selected', { exact: true })).toBeVisible();
	});

	test('MOD-DESC-1: ready, missing, error, retry states, lang/dir, safe content and focus return', async ({
		page
	}) => {
		await page.evaluate(() => {
			const container = document.createElement('div');
			container.id = 'dialog-test-container';
			container.style.padding = '20px';
			container.innerHTML = `
				<button id="invoker-btn" type="button" class="btn">Open Logistic Regression</button>
				<app-model-description-dialog
					id="test-dialog"
					heading="Logistic Regression"
					fallback="A classification model predicting probabilities."
					lang="en"
					dir="ltr"
				></app-model-description-dialog>
			`;
			const parent = document.getElementById('content') || document.body;
			parent.appendChild(container);

			const invoker = document.getElementById('invoker-btn')!;
			const dialog = document.getElementById('test-dialog') as any;

			(window as any).__dialogEvents = [];
			dialog.addEventListener('app-model-description-close', () => {
				(window as any).__dialogEvents.push('close');
			});
			dialog.addEventListener('app-model-description-retry', () => {
				(window as any).__dialogEvents.push('retry');
			});

			invoker.addEventListener('click', (e) => {
				(e.currentTarget as HTMLElement)?.focus();
				dialog.open = true;
			});
		});

		const invokerBtn = page.locator('#invoker-btn');
		const dialogEl = page.locator('#test-dialog');
		const nativeDialog = dialogEl.locator('dialog.modal');

		// --- 1. Loading state ---
		await page.evaluate(async () => {
			const dialog = document.getElementById('test-dialog') as any;
			dialog.status = 'loading';
			dialog.labels = { close: 'Close', retry: 'Retry', status: 'Loading model details…' };
			await dialog.updateComplete;
		});
		await invokerBtn.click();

		await expect(nativeDialog).toBeVisible();
		await expect(nativeDialog).toHaveAttribute('open', '');
		const statusText = dialogEl.locator('p[role="status"]');
		await expect(statusText).toHaveText('Loading model details…');

		// --- 2. Ready state with safe DocumentFragment ---
		await page.evaluate(async () => {
			const dialog = document.getElementById('test-dialog') as any;
			const frag = document.createDocumentFragment();
			const p = document.createElement('p');
			p.className = 'test-article-p';
			p.textContent = 'Authored article content with safe links.';
			const a = document.createElement('a');
			a.href = 'https://example.com';
			a.textContent = 'Learn more';
			p.appendChild(a);
			frag.appendChild(p);

			dialog.content = frag;
			dialog.status = 'ready';
			await dialog.updateComplete;
		});

		const contentSection = dialogEl.locator('.modal-content .description-article');
		await expect(contentSection).toBeVisible();
		await expect(contentSection.locator('.test-article-p')).toContainText(
			'Authored article content'
		);
		await expect(contentSection).toHaveAttribute('lang', 'en');
		await expect(contentSection).toHaveAttribute('dir', 'ltr');

		// Axe check on open modal
		const axeModal = await new AxeBuilder({ page })
			.withTags(AXE_TAGS)
			.include('#test-dialog')
			.analyze();
		const unexpectedModalViolations = axeModal.violations.filter(
			(v) => v.id !== 'color-contrast'
		);
		expect(unexpectedModalViolations).toEqual([]);

		// Close via close button and check focus returns to invoker button
		const closeBtn = dialogEl.locator('button.btn-icon');
		await closeBtn.click();
		await expect(nativeDialog).not.toBeVisible();
		await expect(invokerBtn).toBeFocused();

		let events = await page.evaluate(() => (window as any).__dialogEvents);
		expect(events).toContain('close');

		// --- 3. Missing state ---
		await page.evaluate(async () => {
			const invoker = document.getElementById('invoker-btn')!;
			invoker.focus();
			const dialog = document.getElementById('test-dialog') as any;
			dialog.status = 'missing';
			dialog.fallback = 'Specification fallback text for unauthored model.';
			dialog.open = true;
			await dialog.updateComplete;
		});

		await expect(nativeDialog).toBeVisible();
		await expect(dialogEl.locator('.missing-notice')).toContainText(
			'A detailed description is not available'
		);
		await expect(dialogEl.locator('.fallback-text')).toContainText(
			'Specification fallback text for unauthored model.'
		);

		// Close via Escape key and test native focus return
		await page.keyboard.press('Escape');
		await expect(nativeDialog).not.toBeVisible();
		await expect(invokerBtn).toBeFocused();

		// Check dialog returnValue was reset
		const returnValue = await nativeDialog.evaluate((d: HTMLDialogElement) => d.returnValue);
		expect(returnValue).toBe('');

		// --- 4. Error and retry state ---
		await page.evaluate(async () => {
			const dialog = document.getElementById('test-dialog') as any;
			dialog.status = 'error';
			dialog.labels = { close: 'Close', retry: 'Retry loading', status: '' };
			dialog.open = true;
			await dialog.updateComplete;
		});

		await expect(nativeDialog).toBeVisible();
		const alertBox = dialogEl.locator('p[role="alert"]');
		await expect(alertBox).toHaveText('The model description could not be loaded.');

		const retryBtn = dialogEl.locator('button:has-text("Retry loading")');
		await expect(retryBtn).toBeVisible();
		await retryBtn.click();

		events = await page.evaluate(() => (window as any).__dialogEvents);
		expect(events).toContain('retry');

		// Close modal
		const bottomCloseBtn = dialogEl.locator('.modal-actions button:has-text("Close")');
		await bottomCloseBtn.click();
		await expect(nativeDialog).not.toBeVisible();
	});
});
