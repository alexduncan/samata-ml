import { expect, test } from '@playwright/test';
import { DIST_URL } from '../scripts/ports';

interface DotCspProbe extends Window {
	reportDotCspViolation(directive: string, blocked: string): Promise<void>;
}

test.use({ baseURL: DIST_URL, reducedMotion: 'no-preference' });

test('DOT-AC-7: strict production CSP allows the positioned body burst through its lifecycle', async ({
	page
}) => {
	const violations: string[] = [];
	await page.exposeBinding(
		'reportDotCspViolation',
		(_source, directive: string, blocked: string) => {
			violations.push(`${directive}: ${blocked}`);
		}
	);
	await page.addInitScript(() => {
		document.addEventListener('securitypolicyviolation', (event) => {
			void (window as unknown as DotCspProbe).reportDotCspViolation(
				event.effectiveDirective,
				event.blockedURI
			);
		});
	});
	const response = await page.goto('/target');
	expect(response!.headers()['content-security-policy']).toEqual(
		expect.stringContaining("style-src-attr 'none'")
	);
	expect(response!.headers()['content-security-policy']).toEqual(
		expect.stringContaining("default-src 'none'")
	);
	expect(response!.headers()['cross-origin-opener-policy']).toBe('same-origin');
	expect(response!.headers()['cross-origin-embedder-policy']).toBe('require-corp');
	const core = page.locator('app-sidebar a[href="/data"] > .dot');
	const burst = page.locator('body > .workflow-dot-burst');
	await expect(core).toBeVisible();
	await expect(burst).toHaveCount(1);
	const geometry = await burst.evaluate((element) => {
		const rect = element.getBoundingClientRect();
		const style = getComputedStyle(element);
		const dot = document
			.querySelector('app-sidebar')!
			.shadowRoot!.querySelector('.dot')!
			.getBoundingClientRect();
		return {
			position: style.position,
			left: Number.parseFloat(style.left),
			top: Number.parseFloat(style.top),
			width: rect.width,
			height: rect.height,
			x: dot.x + dot.width / 2,
			y: dot.y + dot.height / 2
		};
	});
	expect(geometry.position).toBe('fixed');
	expect(geometry.width).toBeGreaterThan(0);
	expect(geometry.height).toBeGreaterThan(0);
	expect(geometry.left).toBeCloseTo(geometry.x, 1);
	expect(geometry.top).toBeCloseTo(geometry.y, 1);
	await expect(burst).toHaveCount(0, { timeout: 5_000 });
	await expect(core).toBeVisible();
	expect(violations).toEqual([]);
});
