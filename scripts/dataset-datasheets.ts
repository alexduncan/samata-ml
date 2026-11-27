import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { compileMarkdownFragment } from './markdown';

interface PreparedDatasheet {
	html: string;
	errors: string[];
}

/** Discovers and compiles authored datasheets without loading or profiling CSV data. */
export async function prepareDatasetDatasheets(
	contentDir: string,
	assetRoot: string,
	ids?: readonly string[]
): Promise<ReadonlyMap<string, PreparedDatasheet>> {
	const directories = (await readdir(contentDir, { withFileTypes: true }))
		.filter((entry) => entry.isDirectory() && (!ids || ids.includes(entry.name)))
		.map((entry) => entry.name)
		.sort();
	const datasheets = new Map<string, PreparedDatasheet>();
	for (const id of directories) {
		const sourcePath = `datasets/${id}/datasheet.md`;
		let source: string;
		try {
			source = await readFile(path.join(contentDir, id, 'datasheet.md'), 'utf8');
		} catch (error) {
			const message =
				(error as NodeJS.ErrnoException).code === 'ENOENT'
					? 'datasheet.md is required'
					: `cannot read datasheet: ${String(error)}`;
			datasheets.set(id, { html: '', errors: [`${sourcePath}: ${message}`] });
			continue;
		}
		if (!source.trim()) {
			datasheets.set(id, { html: '', errors: [`${sourcePath}: datasheet.md is empty`] });
			continue;
		}
		datasheets.set(
			id,
			await compileMarkdownFragment(source, { sourcePath, outDir: assetRoot, locale: 'en' })
		);
	}
	return datasheets;
}
