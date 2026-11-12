import { readFile } from "node:fs/promises";
import path from "node:path";
import { CSS_DIR, DEV_DIR, DIST_DIR, PUBLIC_DIR, SRC_DIR } from "./config";
import { copyDirContents, resetDir, writeRevvedFile } from "./filesystem";
import { transformIndexHtml } from "./html";

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
	sourcemap: "linked" | "none";
	debug: boolean;
}): Promise<void> {
	// JavaScript and CSS are built separately because Bun treats them as
	// separate browser entrypoints for this app.
	const jsResult = await Bun.build({
		entrypoints: [
			path.join(SRC_DIR, "app.ts"),
			path.join(SRC_DIR, "models/storage/storageWorker.ts")
		],
		outdir: options.outdir,
		target: "browser",
		format: "esm",
		minify: options.minify,
		sourcemap: options.sourcemap,
		splitting: true,
		define: {
			DEBUG: options.debug ? "true" : "false",
		},
	});
	assertBuild(jsResult, "JavaScript");

	const cssResult = await Bun.build({
		entrypoints: [path.join(CSS_DIR, "style.css")],
		outdir: options.outdir,
		target: "browser",
		minify: options.minify,
		sourcemap: options.sourcemap,
	});
	assertBuild(cssResult, "CSS");
}

/**
 * Builds the development bundle into the dev directory with source maps and readable output.
 */
export async function buildDevBundle(): Promise<void> {
	const devHtml = path.join(DEV_DIR, "index.html");

	// Dev builds are disposable. Recreate the directory so deleted source files disappear.
	await resetDir(DEV_DIR);
	await copyDirContents(PUBLIC_DIR, DEV_DIR);
	await buildBrowserAssets({
		outdir: DEV_DIR,
		minify: false,
		sourcemap: "linked",
		debug: true,
	});

	await transformIndexHtml(devHtml, "development", {
		cssHref: "style.css",
		jsSrc: "app.js",
	});
}

/**
 * Builds the production bundle into the dist directory with minified and content-hashed assets.
 */
export async function buildProductionBundle(): Promise<ProductionBuildResult> {
	const outJs = path.join(DIST_DIR, "app.js");
	const outCss = path.join(DIST_DIR, "style.css");
	const outHtml = path.join(DIST_DIR, "index.html");

	// Production builds are also recreated from scratch so old revved assets do not linger.
	await resetDir(DIST_DIR);
	await copyDirContents(PUBLIC_DIR, DIST_DIR);
	await buildBrowserAssets({
		outdir: DIST_DIR,
		minify: true,
		sourcemap: "none",
		debug: false,
	});

	const revJs = await writeRevvedFile(outJs);
	const revCss = await writeRevvedFile(outCss);
	const inlineCssText = await readFile(path.join(DIST_DIR, revCss), "utf8");

	await transformIndexHtml(outHtml, "production", {
		cssHref: revCss,
		jsSrc: revJs,
		inlineCssText,
	});

	return {
		jsFile: revJs,
		cssFile: revCss,
	};
}
