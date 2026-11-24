import { afterEach, beforeEach, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { copyOptimisedPublicFiles } from '../scripts/build-public-assets';
import { PUBLIC_DIR } from '../scripts/config';
import { copyDirContents } from '../scripts/filesystem';

const artwork = [
	'bernoulli-naive-bayes.svg',
	'decision-tree-classifier.svg',
	'gaussian-naive-bayes.svg',
	'k-nearest-neighbours-classifier.svg',
	'linear-regression.svg',
	'logistic-regression.svg',
	'mlp-classifier.svg',
	'multinomial-naive-bayes.svg',
	'support-vector-classifier.svg'
] as const;

let temporary: string;

beforeEach(async () => {
	temporary = await mkdtemp(path.join(tmpdir(), 'samata-public-svg-'));
});

afterEach(async () => {
	await rm(temporary, { recursive: true, force: true });
});

test('SVG-BUILD-1: all supplied artwork keeps its path and the original bytes are preserved', async () => {
	const sources = await Promise.all(
		artwork.map((name) => readFile(path.join(PUBLIC_DIR, 'assets', name)))
	);
	await copyOptimisedPublicFiles(PUBLIC_DIR, temporary);
	const output = path.join(temporary, 'assets');
	expect((await readdir(output)).filter((name) => name.endsWith('.svg')).sort()).toEqual([
		...artwork
	]);

	let sourceSize = 0;
	let outputSize = 0;
	for (const [index, name] of artwork.entries()) {
		const before = sources[index]!;
		const result = await readFile(path.join(output, name));
		expect(await readFile(path.join(PUBLIC_DIR, 'assets', name)), name).toEqual(before);
		expect(result.byteLength, name).toBeLessThanOrEqual(before.byteLength);
		expect(result.toString(), name).toContain('viewBox="0 0 360 216"');
		sourceSize += before.byteLength;
		outputSize += result.byteLength;
	}
	expect(outputSize).toBeLessThan(sourceSize);
	const regression = await readFile(path.join(output, 'linear-regression.svg'), 'utf8');
	const destination = regression.match(/<use\b[^>]*xlink:href="#([^"]+)"/)?.[1];
	expect(destination).toBeDefined();
	expect(regression).toContain(`id="${destination}"`);
});

test('SVG-BUILD-2: transforms nested SVGs and preserves every other file byte', async () => {
	const source = path.join(temporary, 'source');
	const nested = path.join(source, 'nested');
	await mkdir(nested, { recursive: true });

	const authored =
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><title>Example</title><!-- removable --><circle cx="5" cy="5" r="3"/></svg>\n';
	const peer = Uint8Array.of(0, 255, 128, 10);
	await writeFile(path.join(nested, 'example.svg'), authored);
	await writeFile(path.join(nested, 'peer.bin'), peer);
	await writeFile(path.join(nested, 'uppercase.SVG'), authored);

	const development = path.join(temporary, 'development');
	const production = path.join(temporary, 'production');
	await copyDirContents(source, development);
	await copyOptimisedPublicFiles(source, production);

	expect(await readFile(path.join(development, 'nested/example.svg'), 'utf8')).toBe(authored);
	expect(await readFile(path.join(production, 'nested/peer.bin'))).toEqual(Buffer.from(peer));
	expect(await readFile(path.join(production, 'nested/uppercase.SVG'), 'utf8')).toBe(authored);
	const transformed = await readFile(path.join(production, 'nested/example.svg'), 'utf8');
	expect(transformed).not.toContain('removable');
	expect(transformed).toContain('<title>Example</title>');
	expect(transformed).toContain('viewBox="0 0 10 10"');
});

test('SVG-BUILD-2: names the public-relative path and underlying malformed SVG error', async () => {
	const source = path.join(temporary, 'source');
	await mkdir(path.join(source, 'nested'), { recursive: true });
	await writeFile(path.join(source, 'nested/broken.svg'), '<svg><path></svg>');

	const result = await copyOptimisedPublicFiles(source, path.join(temporary, 'production')).catch(
		(error: unknown) => error
	);
	expect(result).toBeInstanceOf(Error);
	expect((result as Error).message).toContain('nested/broken.svg');
	expect((result as Error).cause).toBeInstanceOf(Error);
});
