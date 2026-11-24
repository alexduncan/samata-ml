import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { SaxNamespaceParser } from '@federicocarboni/saxe';
import { optimize } from 'svgo';
import { copyDirContents } from './filesystem';

function validateSvgDocument(source: string): void {
	let sawRoot = false;
	const parser = new SaxNamespaceParser(
		{
			startTag(name) {
				if (sawRoot) return;
				if (!name.matches('svg', 'http://www.w3.org/2000/svg')) {
					throw new SyntaxError('Expected an <svg> root in the SVG namespace.');
				}
				sawRoot = true;
			},
			endTag() {},
			text() {}
		},
		// Preserve internal XML entities. The parser does not fetch external entities.
		{ dtd: 'process' }
	);
	parser.parse(source);
}

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
			validateSvgDocument(source);
			return optimize(source, { path: sourcePath, floatPrecision: 6 }).data;
		} catch (cause) {
			const relative = path.relative(sourceDir, sourcePath);
			const message = cause instanceof Error ? cause.message : String(cause);
			throw new Error(`Could not optimise public SVG ${relative}: ${message}`, { cause });
		}
	});
}
