import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { StorybookPlotHost } from '../.storybook/fixtures/plot-host';

test.describe('Shared Plot controller', () => {
	let directory: string;
	let bundle: string;
	test.beforeAll(() => {
		directory = mkdtempSync(join(tmpdir(), 'plot-controller-'));
		const output = join(directory, 'plot-host.js');
		execFileSync('bun', [
			'build',
			'.storybook/fixtures/plot-host.ts',
			'--target=browser',
			'--outfile',
			output
		]);
		bundle = readFileSync(output, 'utf8');
	});
	test.afterAll(() => {
		if (directory) rmSync(directory, { recursive: true, force: true });
	});
	test.beforeEach(async ({ page }) => {
		await page.setContent(
			`<html lang="en"><head><title>Plot controller</title><style>${readFileSync('css/root.css', 'utf8')}</style></head><body><main><h1>Plot controller</h1><div id="column" style="inline-size: 40rem"><storybook-plot-host></storybook-plot-host></div></main></body></html>`
		);
		await page.addScriptTag({ type: 'module', content: bundle });
		await page.evaluate(async () => {
			await customElements.whenDefined('storybook-plot-host');
			await document.querySelector<StorybookPlotHost>('storybook-plot-host')!.whenSettled();
		});
	});

	test('WML-P4-CHART-2: inserts the plot in the host shadow root with resolved token colours', async ({
		page
	}) => {
		const probe = await page.evaluate(() => {
			const host = document.querySelector<StorybookPlotHost>('storybook-plot-host')!;
			const svg = host.shadowRoot!.querySelector('svg');
			const dot = svg?.querySelector('circle');
			return {
				inShadow: svg !== null && !document.querySelector('main > svg'),
				fill: dot ? getComputedStyle(dot).fill : null,
				fontFamily: svg ? getComputedStyle(svg).fontFamily : null,
				bodyFont: getComputedStyle(document.body).fontFamily,
				width: Number(host.dataset.width)
			};
		});
		expect(probe.inShadow).toBe(true);
		expect(probe.fill).toBe('rgb(29, 78, 216)');
		expect(probe.fontFamily).toBe(probe.bodyFont);
		expect(probe.width).toBeGreaterThan(300);
	});

	test('WML-P4-CHART-2: reflows at 320 px, and only while connected', async ({ page }) => {
		const widths = await page.evaluate(async () => {
			const host = document.querySelector<StorybookPlotHost>('storybook-plot-host')!;
			const column = document.getElementById('column')!;
			const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
			const wide = Number(host.dataset.width);
			column.style.inlineSize = '20rem';
			await frame();
			await frame();
			await host.whenSettled();
			const narrow = Number(host.dataset.width);
			const svgWidth = host.shadowRoot!.querySelector('svg')!.getBoundingClientRect().width;

			host.remove();
			column.style.inlineSize = '30rem';
			await frame();
			await frame();
			const whileDetached = Number(host.dataset.width);
			await host.whenSettled();

			column.append(host);
			await host.whenSettled();
			const reattached = Number(host.dataset.width);
			return { wide, narrow, svgWidth, whileDetached, reattached };
		});
		expect(widths.wide).toBeGreaterThan(widths.narrow);
		expect(widths.narrow).toBeLessThanOrEqual(320);
		expect(widths.svgWidth).toBeLessThanOrEqual(320);
		expect(widths.whileDetached).toBe(widths.narrow);
		expect(widths.reattached).toBeGreaterThan(widths.narrow);
	});

	test('WML-P4-CHART-2: a hidden host settles without rendering', async ({ page }) => {
		const renders = await page.evaluate(async () => {
			const host = document.querySelector<StorybookPlotHost>('storybook-plot-host')!;
			const before = host.renderCount;
			host.hidden = true;
			host.values = [0.1, 0.2];
			await host.whenSettled();
			return host.renderCount - before;
		});
		expect(renders).toBe(0);
	});

	test('WML-P4-CHART-3: exposes one named image without per-mark labels', async ({ page }) => {
		const probe = await page.evaluate(() => {
			const host = document.querySelector<StorybookPlotHost>('storybook-plot-host')!;
			const svg = host.shadowRoot!.querySelector('svg')!;
			return {
				role: svg.getAttribute('role'),
				label: svg.getAttribute('aria-label'),
				descendantLabels: svg.querySelectorAll('[aria-label]').length
			};
		});
		expect(probe).toEqual({ role: 'img', label: 'Example scores', descendantLabels: 0 });
	});

	test('WML-P4-CHART-3: draws no hard-coded colour and keeps text inherited', async ({
		page
	}) => {
		const colours = await page.evaluate(() => {
			const host = document.querySelector<StorybookPlotHost>('storybook-plot-host')!;
			const svg = host.shadowRoot!.querySelector('svg')!;
			return [...svg.querySelectorAll('[fill], [stroke]')]
				.flatMap((node) => [node.getAttribute('fill'), node.getAttribute('stroke')])
				.filter((value): value is string => value !== null && value !== 'none')
				.filter((value) => value !== 'currentColor');
		});
		for (const colour of colours) expect(['#1d4ed8', '#eeebe9']).toContain(colour);
	});
});
