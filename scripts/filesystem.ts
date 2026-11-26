import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Deletes a directory if it exists and recreates it as an empty directory.
 */
export async function resetDir(dirPath: string): Promise<void> {
	await rm(dirPath, { recursive: true, force: true });
	await mkdir(dirPath, { recursive: true });
}

/**
 * Recursively copies the files from one directory into another directory.
 *
 * @param sourceDir - The source directory.
 * @param targetDir - The destination directory.
 * @param transform - Optional callback that returns substitute file contents. Returning
 * `undefined` keeps the original file bytes.
 */
export async function copyDirContents(
	sourceDir: string,
	targetDir: string,
	transform?: (sourcePath: string) => Promise<string | Uint8Array | undefined>
): Promise<void> {
	await mkdir(targetDir, { recursive: true });
	const entries = await readdir(sourceDir, { withFileTypes: true });

	for (const entry of entries) {
		const fromPath = path.join(sourceDir, entry.name);
		const toPath = path.join(targetDir, entry.name);

		if (entry.isDirectory()) {
			await copyDirContents(fromPath, toPath, transform);
			continue;
		}

		if (entry.isFile()) {
			const file = (await transform?.(fromPath)) ?? Bun.file(fromPath);
			await Bun.write(toPath, file);
		}
	}
}

/**
 * Checks whether a file or directory exists without throwing when it is missing.
 */
export async function fileExists(filePath: string): Promise<boolean> {
	try {
		await stat(filePath);
		return true;
	} catch {
		return false;
	}
}

/**
 * Returns true when a resolved child path is inside the resolved parent directory.
 */
export function isPathInside(parentDir: string, childPath: string): boolean {
	// Use path.relative rather than string prefix checks so sibling paths with
	// similar names are not treated as children.
	const relativePath = path.relative(parentDir, childPath);
	return (
		relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
	);
}

/**
 * Creates a filename that includes a short content hash before the extension.
 */
export function revvedFilename(originalFilename: string, content: Uint8Array): string {
	const ext = path.extname(originalFilename);
	const base = path.basename(originalFilename, ext);
	const digest = createHash('sha256').update(content).digest('hex').slice(0, 10);
	return `${base}.${digest}${ext}`;
}

/**
 * Writes a content-hashed copy of a file, removes the original file, and returns the new filename.
 */
export async function writeRevvedFile(filePath: string): Promise<string> {
	const content = new Uint8Array(await readFile(filePath));
	const dirname = path.dirname(filePath);
	const filename = path.basename(filePath);
	const revvedName = revvedFilename(filename, content);
	const revvedPath = path.join(dirname, revvedName);

	// Replace app.js/style.css with content-hashed filenames for long-lived caches.
	await writeFile(revvedPath, content);
	await rm(filePath, { force: true });

	return revvedName;
}
