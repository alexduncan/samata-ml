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
			const source = new TextDecoder('utf-8', { fatal: true }).decode(
				await readFile(sourcePath)
			);
			// SVGO can recover from some malformed XML. Validate before it rewrites the source.
			const root = Bun.XML.parse(source, { compact: false });
			const separator = root.name.indexOf(':');
			const localName = root.name.slice(separator + 1);
			const namespaceAttribute =
				separator === -1 ? 'xmlns' : 'xmlns:' + root.name.slice(0, separator);
			if (
				localName !== 'svg' ||
				root.attributes[namespaceAttribute] !== 'http://www.w3.org/2000/svg'
			) {
				throw new SyntaxError('Expected a root element in the SVG namespace named svg.');
			}
			return optimize(source, { path: sourcePath, floatPrecision: 6 }).data;
		} catch (cause) {
			const relative = path.relative(sourceDir, sourcePath);
			const message = cause instanceof Error ? cause.message : String(cause);
			throw new Error(`Could not optimise public SVG ${relative}: ${message}`, { cause });
		}
	});
}
