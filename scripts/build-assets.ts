import { copyFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { CSS_DIR, DEV_DIR, DIST_DIR, PUBLIC_DIR, ROOT_DIR, SRC_DIR } from './config';
import { buildContent, type ContentBuildReport } from './build-content';
import { generateSampleDatasets, type SampleDatasetBuildReport } from './generate-datasets';
import { copyDirContents, resetDir, writeRevvedFile } from './filesystem';
import { transformIndexHtml } from './html';

type BuildArtifact = Awaited<ReturnType<typeof Bun.build>>;

export type ProductionBuildResult = {
	jsFile: string;
	cssFile: string;
};

/**
 * Throws a useful error when a Bun build result contains failures.
 */
function assertBuild(result: BuildArtifact, label: string): void {
	if (!result.success) {
		for (const log of result.logs) {
			console.error(log);
		}
		throw new Error(`${label} build failed`);
	}
}

/**
 * Builds the browser JavaScript and CSS entrypoints into the requested output directory.
 */
async function buildBrowserAssets(options: {
	outdir: string;
	minify: boolean;
	sourcemap: 'linked' | 'none';
	debug: boolean;
}): Promise<void> {
	// JavaScript and CSS are built separately because Bun treats them as
	// separate browser entrypoints for this app.
	const entrypoints = [
		path.join(SRC_DIR, 'app.ts'),
		path.join(SRC_DIR, 'features/data/ingestion/storage.worker.ts')
	];

	const jsResult = await Bun.build({
		entrypoints,
		outdir: options.outdir,
		target: 'browser',
		format: 'esm',
		naming: { entry: '[name].[ext]' },
		minify: options.minify,
		sourcemap: options.sourcemap,
		splitting: true,
		define: {
			DEBUG: options.debug ? 'true' : 'false'
		}
	});
	assertBuild(jsResult, 'JavaScript');

	const cssResult = await Bun.build({
		entrypoints: [path.join(CSS_DIR, 'style.css')],
		outdir: options.outdir,
		target: 'browser',
		minify: options.minify,
		sourcemap: options.sourcemap
	});
	assertBuild(cssResult, 'CSS');
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

/**
 * Builds the development bundle into the dev directory with source maps and readable output.
 */
export async function buildDevBundle(): Promise<void> {
	const devHtml = path.join(DEV_DIR, 'index.html');

	// Dev builds are disposable. Recreate the directory so deleted source files disappear.
	await resetDir(DEV_DIR);
	await copyDirContents(PUBLIC_DIR, DEV_DIR);
	logContentReport(await buildContent(DEV_DIR));
	logSampleDatasetReport(await generateSampleDatasets(DEV_DIR));
	await copyFile(path.join(ROOT_DIR, 'index.html'), devHtml);
	await buildBrowserAssets({
		outdir: DEV_DIR,
		minify: false,
		sourcemap: 'linked',
		debug: true
	});

	await transformIndexHtml(devHtml, 'development', {
		cssHref: '/style.css',
		jsSrc: '/app.js'
	});
}

/**
 * Builds the production bundle into the dist directory with minified and content-hashed assets.
 */
export async function buildProductionBundle(): Promise<ProductionBuildResult> {
	const outJs = path.join(DIST_DIR, 'app.js');
	const outCss = path.join(DIST_DIR, 'style.css');
	const outHtml = path.join(DIST_DIR, 'index.html');

	// Production builds are also recreated from scratch so old revved assets do not linger.
	await resetDir(DIST_DIR);
	await copyDirContents(PUBLIC_DIR, DIST_DIR);
	logContentReport(await buildContent(DIST_DIR));
	logSampleDatasetReport(await generateSampleDatasets(DIST_DIR));
	await copyFile(path.join(ROOT_DIR, 'index.html'), outHtml);
	await buildBrowserAssets({
		outdir: DIST_DIR,
		minify: true,
		sourcemap: 'none',
		debug: false
	});

	const revJs = await writeRevvedFile(outJs);
	const revCss = await writeRevvedFile(outCss);
	const inlineCssText = await readFile(path.join(DIST_DIR, revCss), 'utf8');

	await transformIndexHtml(outHtml, 'production', {
		cssHref: `/${revCss}`,
		jsSrc: `/${revJs}`,
		inlineCssText
	});

	return {
		jsFile: revJs,
		cssFile: revCss
	};
}
