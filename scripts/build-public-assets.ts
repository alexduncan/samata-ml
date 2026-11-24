import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { optimize } from 'svgo';
import { copyDirContents } from './filesystem';

/**
 * Copies public files to the production output, optimising lowercase SVG files in place
 * during the copy and preserving every public-relative path.
 */
export async function copyOptimisedPublicFiles(sourceDir: string, outDir: string): Promise<void> {
	await copyDirContents(sourceDir, outDir, async (sourcePath) => {
		if (path.extname(sourcePath) !== '.svg') return undefined;
		try {
			const source = await readFile(sourcePath, 'utf8');
			return optimize(source, { path: sourcePath, floatPrecision: 6 }).data;
		} catch (cause) {
			const relative = path.relative(sourceDir, sourcePath);
			const message = cause instanceof Error ? cause.message : String(cause);
			throw new Error(`Could not optimise public SVG ${relative}: ${message}`, { cause });
		}
	});
}
