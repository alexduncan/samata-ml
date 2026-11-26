import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { LOCALES } from '../src/config/locales';
import type { ContentDomain } from '../src/types/content';
import { toDefine, type BuildConstants } from './build-constants';
import { buildContent, type ContentBuildReport } from './build-content';
import { buildModelAssets, WEB_ML_REVISION } from './build-model-assets';
import { copyOptimisedPublicFiles } from './build-public-assets';
import { CSS_DIR, DEV_DIR, DIST_DIR, PUBLIC_DIR, ROOT_DIR, SRC_DIR } from './config';
import { copyDirContents, resetDir, writeRevvedFile } from './filesystem';
import { generateSampleDatasets, type SampleDatasetBuildReport } from './generate-datasets';
import { transformIndexHtml } from './html';
import { parseSemVer } from './release';
import { renderHeaders } from './release-headers';

type BuildArtifact = Awaited<ReturnType<typeof Bun.build>>;

const CONTENT_DOMAINS: readonly ContentDomain[] = ['pages', 'models', 'glossary'];

/**
 * Crawler access policy applied to generated `robots.txt` and `_headers`.
 */
export type CrawlerPolicy = 'closed' | 'public';

/**
 * Options for {@link buildProductionBundle}.
 */
export interface ProductionBuildOptions {
	/** Output directory override (tests and CLI `--out-dir` only; defaults to {@link DIST_DIR}). */
	outDir?: string;
	/** Semantic version override (tests only; defaults to `package.json` version). */
	version?: string;
	/** Enables Umami beta telemetry headers and build flag when paired with a `-beta.N` version. */
	betaTelemetry?: boolean;
	/** Crawler directive policy (`'closed'` by default; `'public'` requires stable `>= 1.0.0`). */
	crawlerPolicy?: CrawlerPolicy;
	/** Worker entrypoint overrides (tests only). */
	workerEntrypoints?: Partial<Record<'storage' | 'training' | 'analysis', string>>;
}

/**
 * Options for {@link buildDevBundle}.
 */
export interface DevBuildOptions {
	/** Output directory override (tests only; defaults to {@link DEV_DIR}). */
	outDir?: string;
	/** Semantic version override (tests only; defaults to `package.json` version). */
	version?: string;
	/** Crawler directive policy (`'closed'` only in dev; `'public'` throws). */
	crawlerPolicy?: CrawlerPolicy;
}

/**
 * Root-absolute URLs and build metadata produced by {@link buildProductionBundle}.
 */
export type ProductionBuildResult = {
	/** Root-absolute URL of the hashed entry JavaScript bundle. */
	jsFile: string;
	/** Root-absolute URL of the hashed stylesheet bundle. */
	cssFile: string;
	/** Root-absolute URL of the hashed storage Web Worker bundle. */
	storageWorkerFile: string;
	/** Root-absolute URL of the hashed training Web Worker bundle. */
	trainingWorkerFile: string;
	/** Root-absolute URL of the hashed analysis Web Worker bundle. */
	analysisWorkerFile: string;
	/** Semantic version compiled into the release. */
	appVersion: string;
	/** Deterministic 12-hex build identifier written to `release.json`. */
	buildId: string;
};

function assertBuild(result: BuildArtifact, label: string): void {
	if (!result.success) {
		for (const log of result.logs) {
			console.error(log);
		}
		throw new Error(`${label} build failed`);
	}
}

function sha256Hex(data: Uint8Array | string): string {
	return createHash('sha256').update(data).digest('hex');
}

async function readPackageVersion(): Promise<string> {
	const pkgText = await readFile(path.join(ROOT_DIR, 'package.json'), 'utf8');
	const pkg = JSON.parse(pkgText) as { version?: unknown };
	if (typeof pkg.version !== 'string') {
		throw new Error('package.json is missing a string "version" field');
	}
	return pkg.version;
}

function validateCrawlerPolicy(
	mode: 'development' | 'production',
	crawlerPolicy: string,
	appVersion: string
): CrawlerPolicy {
	if (crawlerPolicy !== 'closed' && crawlerPolicy !== 'public') {
		throw new Error(`Invalid crawler policy: "${crawlerPolicy}"`);
	}
	const parsed = parseSemVer(appVersion);
	if (crawlerPolicy === 'public') {
		if (mode !== 'production' || parsed.prerelease !== null || parsed.major < 1) {
			throw new Error(
				`Public crawler policy requires a stable production release >= 1.0.0 (got ${mode} ${appVersion})`
			);
		}
	}
	return crawlerPolicy;
}

async function computeContentIndexVersion(outDir: string): Promise<string> {
	const hash = createHash('sha256');
	for (const locale of Object.keys(LOCALES)) {
		for (const domain of CONTENT_DOMAINS) {
			const indexPath = path.join(outDir, 'content', locale, domain, 'index.json');
			hash.update(await readFile(indexPath));
		}
	}
	return hash.digest('hex').slice(0, 12);
}

async function computeDatasetsIndexVersion(outDir: string): Promise<string> {
	const indexPath = path.join(outDir, 'datasets', 'index.json');
	return sha256Hex(await readFile(indexPath)).slice(0, 12);
}

function logContentReport(report: ContentBuildReport): void {
	const summary = Object.entries(report.locales)
		.map(([locale, domains]) => {
			const counts = Object.entries(domains)
				.map(([domain, count]) =>
					count.fallbacks > 0
						? `${domain}:${count.total}(${count.fallbacks} fallback)`
						: `${domain}:${count.total}`
				)
				.join(', ');
			return `${locale} [${counts}]`;
		})
		.join('; ');
	console.log(`Built static content: ${summary}`);
}

function logSampleDatasetReport(report: SampleDatasetBuildReport): void {
	console.log(
		`Built sample datasets: ${report.built.length} (${report.profiled.length} profiled, ${report.cached.length} cached)`
	);
}

function findEntryOutputPath(result: BuildArtifact, entryFile: string): string {
	const expectedBase = `${path.basename(entryFile, path.extname(entryFile))}.js`;
	const entryOutputs = result.outputs.filter((output) => output.kind === 'entry-point');
	const matched = entryOutputs.find((output) => path.basename(output.path) === expectedBase);
	if (!matched) {
		throw new Error(`Expected entrypoint output "${expectedBase}" was not emitted`);
	}
	return matched.path;
}

async function runBuild(options: {
	mode: 'development' | 'production';
	outDir: string;
	version?: string;
	betaTelemetry?: boolean;
	crawlerPolicy?: CrawlerPolicy;
	workerEntrypoints?: Partial<Record<'storage' | 'training' | 'analysis', string>>;
}): Promise<ProductionBuildResult> {
	const isProd = options.mode === 'production';
	const nodeEnv = JSON.stringify(options.mode);
	const appVersion = options.version ?? (await readPackageVersion());
	const parsedVersion = parseSemVer(appVersion);
	const crawlerPolicy = validateCrawlerPolicy(
		options.mode,
		options.crawlerPolicy ?? 'closed',
		appVersion
	);
	const debug = !isProd;
	const betaTelemetryEnabled =
		isProd && Boolean(options.betaTelemetry) && parsedVersion.prerelease !== null;

	const outDir = options.outDir;
	const assetOutDir = isProd ? path.join(outDir, 'bundles') : outDir;

	// Builds are recreated from scratch so stale revved assets do not linger.
	await resetDir(outDir);
	const modelRuntimeUrl = await buildModelAssets(outDir);
	if (isProd) {
		await copyOptimisedPublicFiles(PUBLIC_DIR, outDir);
	} else {
		await copyDirContents(PUBLIC_DIR, outDir);
	}
	logContentReport(await buildContent(outDir));
	logSampleDatasetReport(await generateSampleDatasets(outDir));

	if (isProd) {
		await mkdir(assetOutDir, { recursive: true });
	}

	const contentIndexVersion = await computeContentIndexVersion(outDir);
	const datasetsIndexVersion = await computeDatasetsIndexVersion(outDir);

	const storageEntry =
		options.workerEntrypoints?.storage ??
		path.join(SRC_DIR, 'features/data/ingestion/storage.worker.ts');
	const trainingEntry =
		options.workerEntrypoints?.training ??
		path.join(SRC_DIR, 'features/models/training/training.worker.ts');
	const analysisEntry =
		options.workerEntrypoints?.analysis ??
		path.join(SRC_DIR, 'features/results/analysis.worker.ts');

	const workerDefine = {
		DEBUG: JSON.stringify(debug),
		APP_VERSION: JSON.stringify(appVersion),
		WEB_ML_RUNTIME_URL: JSON.stringify(modelRuntimeUrl),
		WEB_ML_RUNTIME_REVISION: JSON.stringify(WEB_ML_REVISION)
	};

	const workerResult = await Bun.build({
		entrypoints: [storageEntry, trainingEntry, analysisEntry],
		outdir: assetOutDir,
		target: 'browser',
		format: 'esm',
		naming: { entry: '[name].[ext]' },
		minify: isProd,
		sourcemap: isProd ? 'none' : 'linked',
		splitting: false,
		external: [modelRuntimeUrl],
		define: workerDefine
	});
	assertBuild(workerResult, 'Worker JavaScript');

	const storageBuiltPath = findEntryOutputPath(workerResult, storageEntry);
	const trainingBuiltPath = findEntryOutputPath(workerResult, trainingEntry);
	const analysisBuiltPath = findEntryOutputPath(workerResult, analysisEntry);

	const [storageBytes, trainingBytes, analysisBytes] = await Promise.all([
		readFile(storageBuiltPath),
		readFile(trainingBuiltPath),
		readFile(analysisBuiltPath)
	]);

	if (process.env.SAMATA_TRAINING_RUNTIME_PROBE === '1') {
		const probeResult = await Bun.build({
			entrypoints: [path.join(ROOT_DIR, 'tests/fixtures/training/runtime.worker.ts')],
			outdir: outDir,
			target: 'browser',
			format: 'esm',
			naming: { entry: '[name].[ext]' },
			minify: isProd,
			sourcemap: isProd ? 'none' : 'linked',
			splitting: false,
			external: [modelRuntimeUrl],
			define: workerDefine
		});
		assertBuild(probeResult, 'Training runtime probe');
	}

	const storageWorkerUrl = isProd
		? `/bundles/${await writeRevvedFile(storageBuiltPath)}`
		: `/${path.basename(storageBuiltPath)}`;
	const trainingWorkerUrl = isProd
		? `/bundles/${await writeRevvedFile(trainingBuiltPath)}`
		: `/${path.basename(trainingBuiltPath)}`;
	const analysisWorkerUrl = isProd
		? `/bundles/${await writeRevvedFile(analysisBuiltPath)}`
		: `/${path.basename(analysisBuiltPath)}`;

	const buildId = sha256Hex(
		[
			appVersion,
			nodeEnv,
			WEB_ML_REVISION,
			sha256Hex(storageBytes),
			sha256Hex(trainingBytes),
			sha256Hex(analysisBytes),
			contentIndexVersion,
			datasetsIndexVersion
		].join('\n')
	).slice(0, 12);

	const buildConstants: BuildConstants = {
		DEBUG: debug,
		APP_VERSION: appVersion,
		BUILD_ID: buildId,
		BETA_TELEMETRY_ENABLED: betaTelemetryEnabled,
		STORAGE_WORKER_URL: storageWorkerUrl,
		TRAINING_WORKER_URL: trainingWorkerUrl,
		ANALYSIS_WORKER_URL: analysisWorkerUrl,
		CONTENT_INDEX_VERSION: contentIndexVersion,
		DATASETS_INDEX_VERSION: datasetsIndexVersion
	};

	const appResult = await Bun.build({
		entrypoints: [path.join(SRC_DIR, 'app.ts')],
		outdir: assetOutDir,
		target: 'browser',
		format: 'esm',
		naming: { entry: '[name].[ext]', chunk: 'chunks/[name]-[hash].[ext]' },
		minify: isProd,
		sourcemap: isProd ? 'none' : 'linked',
		splitting: true,
		external: [modelRuntimeUrl],
		define: {
			...toDefine(buildConstants),
			'process.env.NODE_ENV': nodeEnv,
			WEB_ML_RUNTIME_URL: JSON.stringify(modelRuntimeUrl),
			WEB_ML_RUNTIME_REVISION: JSON.stringify(WEB_ML_REVISION)
		}
	});
	assertBuild(appResult, 'App JavaScript');

	const cssResult = await Bun.build({
		entrypoints: [path.join(CSS_DIR, 'style.css')],
		outdir: assetOutDir,
		target: 'browser',
		minify: isProd,
		sourcemap: isProd ? 'none' : 'linked'
	});
	assertBuild(cssResult, 'CSS');

	const appBuiltPath = path.join(assetOutDir, 'app.js');
	const cssBuiltPath = path.join(assetOutDir, 'style.css');
	const jsUrl = isProd ? `/bundles/${await writeRevvedFile(appBuiltPath)}` : '/app.js';
	const cssUrl = isProd ? `/bundles/${await writeRevvedFile(cssBuiltPath)}` : '/style.css';

	const releaseManifest = {
		version: appVersion,
		build: buildId,
		workers: {
			storage: storageWorkerUrl,
			training: trainingWorkerUrl,
			analysis: analysisWorkerUrl
		}
	};
	await writeFile(
		path.join(outDir, 'release.json'),
		`${JSON.stringify(releaseManifest)}\n`,
		'utf8'
	);

	const baselineHeaders = await readFile(path.join(PUBLIC_DIR, '_headers'), 'utf8');
	const renderedHeaders = renderHeaders(baselineHeaders, {
		telemetry: betaTelemetryEnabled,
		crawler: crawlerPolicy
	});
	await writeFile(path.join(outDir, '_headers'), renderedHeaders, 'utf8');

	const robotsTxt =
		crawlerPolicy === 'public' ? 'User-agent: *\nAllow: /\n' : 'User-agent: *\nDisallow: /\n';
	await writeFile(path.join(outDir, 'robots.txt'), robotsTxt, 'utf8');

	const outHtml = path.join(outDir, 'index.html');
	await copyFile(path.join(ROOT_DIR, 'index.html'), outHtml);
	await transformIndexHtml(outHtml, options.mode, {
		cssHref: cssUrl,
		jsSrc: jsUrl,
		appVersion: isProd ? appVersion : undefined
	});

	return {
		jsFile: jsUrl,
		cssFile: cssUrl,
		storageWorkerFile: storageWorkerUrl,
		trainingWorkerFile: trainingWorkerUrl,
		analysisWorkerFile: analysisWorkerUrl,
		appVersion,
		buildId
	};
}

/**
 * Builds the development bundle into the dev directory with source maps and unhashed root names.
 *
 * @param options - Optional output directory, version, and crawler policy overrides.
 */
export async function buildDevBundle(options: DevBuildOptions = {}): Promise<void> {
	await runBuild({
		mode: 'development',
		outDir: options.outDir ?? DEV_DIR,
		version: options.version,
		crawlerPolicy: options.crawlerPolicy
	});
}

/**
 * Builds the production bundle into `dist` (or `options.outDir`) with content-hashed `/bundles/` assets.
 *
 * @param options - Optional directory, version, telemetry, crawler policy, and worker overrides.
 * @returns Root-absolute asset URLs, version, and build identifier.
 */
export async function buildProductionBundle(
	options: ProductionBuildOptions = {}
): Promise<ProductionBuildResult> {
	return runBuild({
		mode: 'production',
		outDir: options.outDir ?? DIST_DIR,
		version: options.version,
		betaTelemetry: options.betaTelemetry,
		crawlerPolicy: options.crawlerPolicy,
		workerEntrypoints: options.workerEntrypoints
	});
}
