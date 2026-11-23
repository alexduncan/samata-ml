import path from 'node:path';
import { buildProductionBundle, type CrawlerPolicy } from './build-assets';
import { DEV_DIR, DIST_DIR, ROOT_DIR } from './config';
import { isPathInside } from './filesystem';

function resolveOutDir(rawPath: string): string {
	if (!rawPath || path.isAbsolute(rawPath)) {
		throw new Error(`Invalid --out-dir "${rawPath}": must be a relative path`);
	}
	const segments = rawPath.split(/[\\/]/);
	if (segments.includes('..')) {
		throw new Error(`Invalid --out-dir "${rawPath}": ".." segments are not allowed`);
	}
	const resolved = path.resolve(ROOT_DIR, rawPath);
	const outRoot = path.join(ROOT_DIR, 'out');
	if (
		!isPathInside(outRoot, resolved) &&
		!isPathInside(DIST_DIR, resolved) &&
		!isPathInside(DEV_DIR, resolved)
	) {
		throw new Error(`Invalid --out-dir "${rawPath}": must stay inside out/, dist/, or dev/`);
	}
	return resolved;
}

function parseArgs(argv: string[]): { outDir: string } {
	let outDir = DIST_DIR;
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i]!;
		if (arg === '--out-dir') {
			const next = argv[i + 1];
			if (!next) {
				throw new Error('Missing value for --out-dir');
			}
			outDir = resolveOutDir(next);
			i++;
			continue;
		}
		if (arg.startsWith('--out-dir=')) {
			outDir = resolveOutDir(arg.slice('--out-dir='.length));
			continue;
		}
		throw new Error(`Unknown argument: "${arg}"`);
	}
	return { outDir };
}

function parseCrawlerPolicy(raw: string | undefined): CrawlerPolicy {
	if (raw === undefined || raw === '') {
		return 'closed';
	}
	if (raw === 'closed' || raw === 'public') {
		return raw;
	}
	throw new Error(`Invalid SAMATA_CRAWLER_POLICY: "${raw}"`);
}

/**
 * Runs the production build entrypoint and prints the generated asset names.
 */
async function main(): Promise<void> {
	const { outDir } = parseArgs(process.argv.slice(2));
	const betaTelemetry = process.env.BETA_TELEMETRY_ENABLED === 'true';
	const crawlerPolicy = parseCrawlerPolicy(process.env.SAMATA_CRAWLER_POLICY);

	console.log('Starting production build...');
	const result = await buildProductionBundle({
		outDir,
		betaTelemetry,
		crawlerPolicy
	});

	console.log('Production build complete.');
	console.log(`Output directory: ${outDir}`);
	console.log(`JavaScript asset: ${result.jsFile}`);
	console.log(`CSS asset: ${result.cssFile}`);
	console.log(`Build ID: ${result.buildId}`);
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
