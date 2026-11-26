import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { APP_URL, DIST_URL } from '../scripts/ports';

const artwork = [
	'bernoulli-naive-bayes.svg',
	'decision-tree-classifier.svg',
	'gaussian-naive-bayes.svg',
	'k-nearest-neighbours-classifier.svg',
	'linear-regression.svg',
	'logistic-regression.svg',
	'mlp-classifier.svg',
	'multinomial-naive-bayes.svg',
	'support-vector-classifier.svg'
] as const;

test('SVG-BUILD-2: optimisation preserves DOCTYPE defaults used for rendering', async ({
	page
}, testInfo) => {
	const sourceDir = testInfo.outputPath('public');
	const outputDir = testInfo.outputPath('optimised');
	await mkdir(sourceDir, { recursive: true });
	const source = `<!DOCTYPE svg [
		<!ATTLIST svg xmlns CDATA "http://www.w3.org/2000/svg">
		<!ATTLIST rect width CDATA "40">
	]>
	<svg width="40" height="24"><rect height="24" fill="red"/></svg>`;
	await writeFile(path.join(sourceDir, 'doctype.svg'), source);
	// Playwright runs in Node, while the production copy helper runs in Bun.
	execFileSync('bun', [
		'-e',
		`import { copyOptimisedPublicFiles } from './scripts/build-public-assets.ts';
		await copyOptimisedPublicFiles(...process.argv.slice(-2));`,
		sourceDir,
		outputDir
	]);
	const output = await readFile(path.join(outputDir, 'doctype.svg'), 'utf8');

	for (const svg of [source, output]) {
		const rendered = await page.evaluate(async (markup) => {
			const image = new Image();
			image.src = `data:image/svg+xml,${encodeURIComponent(markup)}`;
			await image.decode();
			const canvas = document.createElement('canvas');
			canvas.width = image.naturalWidth;
			canvas.height = image.naturalHeight;
			const context = canvas.getContext('2d')!;
			context.drawImage(image, 0, 0);
			return {
				size: [image.naturalWidth, image.naturalHeight],
				pixel: Array.from(context.getImageData(20, 12, 1, 1).data)
			};
		}, svg);
		expect(rendered).toEqual({ size: [40, 24], pixel: [255, 0, 0, 255] });
	}
});

test('SVG-BUILD-3 / SVG-BUILD-4: both servers deliver the artwork with the production cache policy', async ({
	request
}) => {
	for (const name of artwork) {
		const route = `/assets/${name}`;
		const [source, optimised] = await Promise.all([
			request.get(APP_URL + route),
			request.get(DIST_URL + route)
		]);
		expect(source.ok(), route).toBe(true);
		expect(optimised.ok(), route).toBe(true);
		expect(source.headers()['content-type'], route).toBe('image/svg+xml');
		expect(optimised.headers()['content-type'], route).toBe('image/svg+xml');
		expect(optimised.headers()['cache-control'], route).toBe(
			'public, max-age=0, must-revalidate'
		);
		await source.dispose();
		await optimised.dispose();
	}
});

test('SVG-BUILD-3: Chromium raster fidelity at both artwork sizes', async ({
	browserName,
	page,
	request
}, testInfo) => {
	test.skip(browserName !== 'chromium', 'The plan defines the raster comparison in Chromium.');
	const pairs = await Promise.all(
		artwork.map(async (name) => {
			const route = `/assets/${name}`;
			const [source, optimised] = await Promise.all([
				request.get(APP_URL + route),
				request.get(DIST_URL + route)
			]);
			const [before, after] = await Promise.all([source.body(), optimised.body()]);
			await Promise.all([source.dispose(), optimised.dispose()]);
			return { name, before: before.toString('base64'), after: after.toString('base64') };
		})
	);

	for (const width of [360, 720]) {
		const height = width * 0.6;
		await page.goto('about:blank');
		await page.setViewportSize({ width: width * 2 + 32, height: 900 });
		const comparisons = await page.evaluate(
			async ({ pairs, width, height }) => {
				const decode = async (bytes: string) => {
					const image = new Image();
					image.src = `data:image/svg+xml;base64,${bytes}`;
					await image.decode();
					return image;
				};
				const rasterise = (image: HTMLImageElement) => {
					const canvas = document.createElement('canvas');
					canvas.width = width;
					canvas.height = height;
					const context = canvas.getContext('2d')!;
					context.drawImage(image, 0, 0, width, height);
					return { canvas, pixels: context.getImageData(0, 0, width, height).data };
				};

				const results = [];
				for (const pair of pairs) {
					const [source, production] = await Promise.all([
						decode(pair.before),
						decode(pair.after)
					]);
					const before = rasterise(source);
					const after = rasterise(production);
					let different = 0;
					for (let pixel = 0; pixel < before.pixels.length; pixel += 4) {
						for (let channel = pixel; channel < pixel + 4; channel++) {
							if (Math.abs(before.pixels[channel]! - after.pixels[channel]!) > 24) {
								different++;
								break;
							}
						}
					}

					const heading = document.createElement('h2');
					heading.textContent = `${pair.name} — source (left), production (right)`;
					const row = document.createElement('div');
					row.style.display = 'flex';
					row.style.gap = '1rem';
					row.append(before.canvas, after.canvas);
					document.body.append(heading, row);

					results.push({
						name: pair.name,
						intrinsicSizes: [
							source.naturalWidth,
							source.naturalHeight,
							production.naturalWidth,
							production.naturalHeight
						],
						difference: different / (width * height)
					});
				}
				return results;
			},
			{ pairs, width, height }
		);

		const visual = testInfo.outputPath(`svg-artwork-${width}.png`);
		await page.screenshot({ path: visual, fullPage: true, scale: 'css' });
		await testInfo.attach(`Artwork at ${width} × ${height}`, {
			path: visual,
			contentType: 'image/png'
		});
		for (const result of comparisons) {
			expect(result.intrinsicSizes, result.name).toEqual([360, 216, 360, 216]);
			expect(result.difference, `${result.name} at ${width} × ${height}`).toBeLessThanOrEqual(
				0.002
			);
		}
	}
});
