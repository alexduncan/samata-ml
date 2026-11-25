import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
	buildDevBundle,
	buildProductionBundle,
	type ProductionBuildResult
} from '../scripts/build-assets';
import { ROOT_DIR } from '../scripts/config';
import { parseHeadersFile, resolveHeaders } from '../scripts/headers-file';

const TEMP_ROOT = path.join(
	ROOT_DIR,
	'out',
	`test-build-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
);

const DEFAULT_PROD_DIR = path.join(TEMP_ROOT, 'prod-default');
const CHANGED_WORKER_DIR = path.join(TEMP_ROOT, 'prod-changed-worker');
const PUBLIC_STABLE_DIR = path.join(TEMP_ROOT, 'prod-public-stable');
const BETA_TELEMETRY_DIR = path.join(TEMP_ROOT, 'prod-beta-telemetry');
const STABLE_TELEMETRY_DIR = path.join(TEMP_ROOT, 'prod-stable-telemetry');
const DEV_VARIANT_DIR = path.join(TEMP_ROOT, 'dev-default');
const PROD_AFTER_DEV_DIR = path.join(TEMP_ROOT, 'prod-after-dev');

let defaultProd!: ProductionBuildResult;
let changedWorkerProd!: ProductionBuildResult;
let publicStableProd!: ProductionBuildResult;
let betaTelemetryProd!: ProductionBuildResult;
let stableTelemetryProd!: ProductionBuildResult;
let prodAfterDev!: ProductionBuildResult;

async function collectFiles(dir: string, prefix = ''): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const files: string[] = [];
	for (const entry of entries) {
		const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await collectFiles(full, rel)));
		} else if (entry.isFile()) {
			files.push(rel);
		}
	}
	return files;
}

describe('hashed build, headers and crawler policy', () => {
	beforeAll(async () => {
		await mkdir(TEMP_ROOT, { recursive: true });

		defaultProd = await buildProductionBundle({ outDir: DEFAULT_PROD_DIR });

		const customWorkerDir = path.join(TEMP_ROOT, 'variant-src');
		await mkdir(customWorkerDir, { recursive: true });
		const realStorageWorker = path.join(
			ROOT_DIR,
			'src/features/data/ingestion/storage.worker.ts'
		);
		const customStorageWorker = path.join(customWorkerDir, 'storage.worker.ts');
		await writeFile(
			customStorageWorker,
			`import ${JSON.stringify(realStorageWorker)};\nconsole.info('build-variant');\n`,
			'utf8'
		);
		changedWorkerProd = await buildProductionBundle({
			outDir: CHANGED_WORKER_DIR,
			workerEntrypoints: { storage: customStorageWorker }
		});

		publicStableProd = await buildProductionBundle({
			outDir: PUBLIC_STABLE_DIR,
			version: '1.0.0',
			crawlerPolicy: 'public'
		});

		betaTelemetryProd = await buildProductionBundle({
			outDir: BETA_TELEMETRY_DIR,
			betaTelemetry: true
		});

		stableTelemetryProd = await buildProductionBundle({
			outDir: STABLE_TELEMETRY_DIR,
			version: '1.0.0',
			betaTelemetry: true
		});

		await buildDevBundle({ outDir: DEV_VARIANT_DIR });
		prodAfterDev = await buildProductionBundle({ outDir: PROD_AFTER_DEV_DIR });
	}, 180_000);

	afterAll(async () => {
		await rm(TEMP_ROOT, { recursive: true, force: true });
	});

	test('BETA-ERR-1: production builds exclude the Lit development diagnostic in both build orders', async () => {
		for (const outDir of [DEFAULT_PROD_DIR, PROD_AFTER_DEV_DIR]) {
			const bundles = path.join(outDir, 'bundles');
			for (const file of await collectFiles(bundles)) {
				if (file.endsWith('.js')) {
					expect(await readFile(path.join(bundles, file), 'utf8')).not.toContain(
						'Lit is in dev mode'
					);
				}
			}
		}
		expect(prodAfterDev.buildId).toBe(defaultProd.buildId);
		expect(prodAfterDev.jsFile).toBe(defaultProd.jsFile);
	});

	test('BETA-ERR-1b: a development build after production retains Lit diagnostics and linked source maps', async () => {
		const files = await collectFiles(DEV_VARIANT_DIR);
		const scripts = await Promise.all(
			files
				.filter(
					(file) =>
						file === 'app.js' || (file.startsWith('chunks/') && file.endsWith('.js'))
				)
				.map((file) => readFile(path.join(DEV_VARIANT_DIR, file), 'utf8'))
		);
		expect(scripts.join('\n')).toContain('Lit is in dev mode');
		expect(scripts).toEqual(
			expect.arrayContaining([expect.stringContaining('sourceMappingURL=app.js.map')])
		);
		expect(files).toContain('app.js.map');
		const manifest = JSON.parse(
			await readFile(path.join(DEV_VARIANT_DIR, 'release.json'), 'utf8')
		) as { build: string };
		expect(manifest.build).not.toBe(defaultProd.buildId);
	});

	test('REL-CACHE-1: production writes only hashed /bundles/ assets, release.json, robots.txt and keeps public assets', async () => {
		const prodFiles = await collectFiles(DEFAULT_PROD_DIR);
		const bundleFiles = prodFiles.filter((file) => file.startsWith('bundles/'));
		expect(bundleFiles.length).toBeGreaterThanOrEqual(5);

		expect(prodFiles).not.toContain('app.js');
		expect(prodFiles).not.toContain('style.css');
		expect(prodFiles).not.toContain('storage.worker.js');
		expect(prodFiles).not.toContain('training.worker.js');
		expect(prodFiles).not.toContain('analysis.worker.js');
		expect(prodFiles).not.toContain('bundles/app.js');
		expect(prodFiles).not.toContain('bundles/style.css');
		expect(prodFiles).not.toContain('bundles/storage.worker.js');
		expect(prodFiles).not.toContain('bundles/training.worker.js');
		expect(prodFiles).not.toContain('bundles/analysis.worker.js');

		expect(prodFiles).toContain('assets/linear-regression.svg');
		expect(prodFiles).toContain('release.json');
		expect(prodFiles).toContain('robots.txt');
		expect(prodFiles).toContain('_headers');

		expect(defaultProd.jsFile).toMatch(/^\/bundles\/app\.[0-9a-f]{10}\.js$/);
		expect(defaultProd.cssFile).toMatch(/^\/bundles\/style\.[0-9a-f]{10}\.css$/);
		expect(defaultProd.storageWorkerFile).toMatch(
			/^\/bundles\/storage\.worker\.[0-9a-f]{10}\.js$/
		);
		expect(defaultProd.trainingWorkerFile).toMatch(
			/^\/bundles\/training\.worker\.[0-9a-f]{10}\.js$/
		);
		expect(defaultProd.analysisWorkerFile).toMatch(
			/^\/bundles\/analysis\.worker\.[0-9a-f]{10}\.js$/
		);

		const devFiles = await collectFiles(DEV_VARIANT_DIR);
		expect(devFiles).toContain('app.js');
		expect(devFiles).toContain('style.css');
		expect(devFiles).toContain('storage.worker.js');
		expect(devFiles).toContain('training.worker.js');
		expect(devFiles).toContain('analysis.worker.js');
		expect(devFiles).toContain('release.json');
		expect(devFiles).toContain('_headers');
		expect(devFiles).toContain('robots.txt');
	});

	test('REL-CACHE-2: production index.html links hashed assets, includes app-version meta and drops inline CSS', async () => {
		const html = await readFile(path.join(DEFAULT_PROD_DIR, 'index.html'), 'utf8');
		expect(html).not.toContain('<style data-inline-build="true">');
		expect(html).toContain(`<link rel="stylesheet" href="${defaultProd.cssFile}" />`);
		expect(html).toContain(`<script type="module" src="${defaultProd.jsFile}"></script>`);
		expect(html).toContain(`<meta name="app-version" content="${defaultProd.appVersion}" />`);
	});

	test('REL-CACHE-1: app bundle embeds hashed worker URLs and manifest versions; worker change rotates hash and BUILD_ID', async () => {
		const bundleFiles = (await collectFiles(path.join(DEFAULT_PROD_DIR, 'bundles'))).filter(
			(file) =>
				file.endsWith('.js') &&
				`/${'bundles/' + file}` !== defaultProd.storageWorkerFile &&
				`/${'bundles/' + file}` !== defaultProd.trainingWorkerFile &&
				`/${'bundles/' + file}` !== defaultProd.analysisWorkerFile
		);
		const appBundleAndChunks = (
			await Promise.all(
				bundleFiles.map((file) =>
					readFile(path.join(DEFAULT_PROD_DIR, 'bundles', file), 'utf8')
				)
			)
		).join('\n');

		expect(appBundleAndChunks).toContain(defaultProd.storageWorkerFile);
		expect(appBundleAndChunks).toContain(defaultProd.trainingWorkerFile);
		expect(appBundleAndChunks).toContain(defaultProd.analysisWorkerFile);

		const contentHash = createHash('sha256');
		for (const domain of ['pages', 'models', 'glossary']) {
			contentHash.update(
				await readFile(path.join(DEFAULT_PROD_DIR, 'content', 'en', domain, 'index.json'))
			);
		}
		const contentVersion = contentHash.digest('hex').slice(0, 12);
		const datasetsVersion = createHash('sha256')
			.update(await readFile(path.join(DEFAULT_PROD_DIR, 'datasets', 'index.json')))
			.digest('hex')
			.slice(0, 12);

		expect(appBundleAndChunks).toContain(contentVersion);
		expect(appBundleAndChunks).toContain(datasetsVersion);
		expect(appBundleAndChunks).toContain('?v=');

		const releaseJson = JSON.parse(
			await readFile(path.join(DEFAULT_PROD_DIR, 'release.json'), 'utf8')
		) as {
			version: string;
			build: string;
			workers: Record<string, string>;
		};
		expect(releaseJson).toEqual({
			version: defaultProd.appVersion,
			build: defaultProd.buildId,
			workers: {
				storage: defaultProd.storageWorkerFile,
				training: defaultProd.trainingWorkerFile,
				analysis: defaultProd.analysisWorkerFile
			}
		});

		expect(changedWorkerProd.storageWorkerFile).not.toBe(defaultProd.storageWorkerFile);
		expect(changedWorkerProd.buildId).not.toBe(defaultProd.buildId);
		const changedAppBundle = await readFile(
			path.join(CHANGED_WORKER_DIR, changedWorkerProd.jsFile.slice(1)),
			'utf8'
		);
		expect(changedAppBundle).toContain(changedWorkerProd.storageWorkerFile);
	});

	test('REL-CACHE-3: rendered _headers enforces isolation, baseline CSP, limits and single Cache-Control per path', async () => {
		const baselineText = await readFile(path.join(ROOT_DIR, 'public', '_headers'), 'utf8');
		const baselineCsp = baselineText
			.split('\n')
			.find((line) => line.trim().toLowerCase().startsWith('content-security-policy:'))!
			.trim();

		const renderedText = await readFile(path.join(DEFAULT_PROD_DIR, '_headers'), 'utf8');
		const lines = renderedText.split('\n');
		for (const line of lines) {
			expect(line.length).toBeLessThanOrEqual(2000);
		}
		const rules = parseHeadersFile(renderedText);
		expect(rules.length).toBeLessThanOrEqual(100);

		const renderedCsp = renderedText
			.split('\n')
			.find((line) => line.trim().toLowerCase().startsWith('content-security-policy:'))!
			.trim();
		expect(renderedCsp).toBe(baselineCsp);

		const revalidatePaths = [
			'/',
			'/data',
			'/index.html',
			'/release.json',
			'/robots.txt',
			'/content/en/pages/index.json',
			'/datasets/index.json',
			'/assets/linear-regression.svg'
		];
		for (const pathname of revalidatePaths) {
			const headers = resolveHeaders(rules, pathname);
			expect(headers.get('cache-control')).toBe('public, max-age=0, must-revalidate');
			expect(headers.get('cross-origin-opener-policy')).toBe('same-origin');
			expect(headers.get('cross-origin-embedder-policy')).toBe('require-corp');
			expect(headers.get('cross-origin-resource-policy')).toBe('same-origin');
			expect(headers.get('content-security-policy')).toContain(
				"script-src 'self' 'wasm-unsafe-eval'"
			);
		}

		const immutablePaths = [
			defaultProd.jsFile,
			'/bundles/chunks/chunk-123.js',
			defaultProd.storageWorkerFile,
			'/web-ml/0.2.0-abc/index.js'
		];
		for (const pathname of immutablePaths) {
			const headers = resolveHeaders(rules, pathname);
			expect(headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
			expect(headers.get('cross-origin-opener-policy')).toBe('same-origin');
			expect(headers.get('cross-origin-embedder-policy')).toBe('require-corp');
			expect(headers.get('cross-origin-resource-policy')).toBe('same-origin');
		}
	});

	test('REL-CRAWL-1: closed vs public crawler outputs and invalid crawler policy rejections', async () => {
		const closedRobots = await readFile(path.join(DEFAULT_PROD_DIR, 'robots.txt'), 'utf8');
		expect(closedRobots).toBe('User-agent: *\nDisallow: /\n');
		const closedRules = parseHeadersFile(
			await readFile(path.join(DEFAULT_PROD_DIR, '_headers'), 'utf8')
		);
		expect(resolveHeaders(closedRules, '/').get('x-robots-tag')).toBe(
			'noindex, nofollow, nosnippet'
		);
		expect(
			resolveHeaders(closedRules, '/content/en/pages/index.json').get('x-robots-tag')
		).toContain('noindex');

		expect(publicStableProd.appVersion).toBe('1.0.0');
		const publicRobots = await readFile(path.join(PUBLIC_STABLE_DIR, 'robots.txt'), 'utf8');
		expect(publicRobots).toBe('User-agent: *\nAllow: /\n');
		const publicRules = parseHeadersFile(
			await readFile(path.join(PUBLIC_STABLE_DIR, '_headers'), 'utf8')
		);
		expect(resolveHeaders(publicRules, '/').get('x-robots-tag')).toBeNull();
		expect(
			resolveHeaders(publicRules, '/content/en/pages/index.json').get('x-robots-tag')
		).toBe('noindex, nofollow');
		expect(resolveHeaders(publicRules, '/datasets/index.json').get('x-robots-tag')).toBe(
			'noindex, nofollow'
		);

		await expect(
			buildProductionBundle({
				outDir: path.join(TEMP_ROOT, 'bad-prerelease-public'),
				version: '1.0.0-beta.1',
				crawlerPolicy: 'public'
			})
		).rejects.toThrow();

		await expect(
			buildDevBundle({
				outDir: path.join(TEMP_ROOT, 'bad-dev-public'),
				version: '1.0.0',
				crawlerPolicy: 'public'
			})
		).rejects.toThrow();

		await expect(
			buildProductionBundle({
				outDir: path.join(TEMP_ROOT, 'bad-policy'),
				crawlerPolicy: 'unknown' as 'closed'
			})
		).rejects.toThrow();
	});

	test('REL-CACHE-1: worker bundles never contain page-only build-constant identifiers', async () => {
		const forbidden = [
			'BUILD_ID',
			'STORAGE_WORKER_URL',
			'TRAINING_WORKER_URL',
			'ANALYSIS_WORKER_URL',
			'CONTENT_INDEX_VERSION',
			'DATASETS_INDEX_VERSION',
			'BETA_TELEMETRY_ENABLED'
		];
		for (const url of [
			defaultProd.storageWorkerFile,
			defaultProd.trainingWorkerFile,
			defaultProd.analysisWorkerFile
		]) {
			const code = await readFile(path.join(DEFAULT_PROD_DIR, url.slice(1)), 'utf8');
			for (const ident of forbidden) {
				expect(code).not.toContain(ident);
			}
		}
	});

	test('REL-TELEM-1: beta telemetry production artefact inserts only Umami CSP tokens and stable telemetry stays off', async () => {
		const baselineText = await readFile(path.join(ROOT_DIR, 'public', '_headers'), 'utf8');
		const baselineCsp = baselineText
			.split('\n')
			.find((line) => line.trim().toLowerCase().startsWith('content-security-policy:'))!
			.trim();

		const betaHeadersText = await readFile(path.join(BETA_TELEMETRY_DIR, '_headers'), 'utf8');
		for (const line of betaHeadersText.split('\n')) {
			expect(line.length).toBeLessThanOrEqual(2000);
		}
		const betaRules = parseHeadersFile(betaHeadersText);
		expect(betaRules.length).toBeLessThanOrEqual(100);
		const betaRootHeaders = resolveHeaders(betaRules, '/');
		const betaCsp = betaRootHeaders.get('content-security-policy')!;
		expect(betaCsp).toContain(
			"script-src 'self' https://cloud.umami.is/script.js 'wasm-unsafe-eval'"
		);
		expect(betaCsp).toContain('https://gateway.umami.is;');
		expect(betaCsp).toContain('palmerpenguins');
		expect(betaCsp).toContain('huggingface.co');
		expect(betaRootHeaders.get('cross-origin-opener-policy')).toBe('same-origin');
		expect(betaRootHeaders.get('cross-origin-embedder-policy')).toBe('require-corp');
		expect(betaRootHeaders.get('cross-origin-resource-policy')).toBe('same-origin');

		const betaBundleText = await readFile(
			path.join(BETA_TELEMETRY_DIR, betaTelemetryProd.jsFile.slice(1)),
			'utf8'
		);
		expect(betaBundleText).toContain('https://cloud.umami.is/script.js');

		const stableHeadersText = await readFile(
			path.join(STABLE_TELEMETRY_DIR, '_headers'),
			'utf8'
		);
		const stableCsp = stableHeadersText
			.split('\n')
			.find((line) => line.trim().toLowerCase().startsWith('content-security-policy:'))!
			.trim();
		expect(stableCsp).toBe(baselineCsp);
		expect(stableHeadersText).not.toContain('umami');
	});
});
