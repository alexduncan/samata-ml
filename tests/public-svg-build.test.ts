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

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

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
		'<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><title>Example</title><!-- removable --><circle cx="5" cy="5" r="3"/></svg>\n';
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

test('SVG-BUILD-2: accepts SVG with an explicit namespace prefix', async () => {
	const source = path.join(temporary, 'source');
	await mkdir(source);
	await writeFile(
		path.join(source, 'prefixed.svg'),
		'<art:svg xmlns:art="' + SVG_NAMESPACE + '"><art:svg/></art:svg>'
	);
	const output = path.join(temporary, 'production');
	await copyOptimisedPublicFiles(source, output);
	expect(await readFile(path.join(output, 'prefixed.svg'), 'utf8')).toContain(
		'<art:svg xmlns:art="' + SVG_NAMESPACE + '"'
	);
});

const svgRoot = '<svg xmlns="' + SVG_NAMESPACE + '"';

test('SVG-BUILD-2: accepts matching attribute local names in distinct namespaces', async () => {
	const source = path.join(temporary, 'source');
	await mkdir(source);
	await writeFile(
		path.join(source, 'distinct.svg'),
		svgRoot + ' xmlns:a="urn:first" xmlns:b="urn:second" a:x="one" b:x="two"/>'
	);
	const output = path.join(temporary, 'production');
	await copyOptimisedPublicFiles(source, output);
	const result = await readFile(path.join(output, 'distinct.svg'), 'utf8');
	expect(result).toContain('a:x="one"');
	expect(result).toContain('b:x="two"');
});

test('SVG-BUILD-2: preserves a title that uses a declared internal entity', async () => {
	const source = path.join(temporary, 'source');
	await mkdir(source);
	await writeFile(
		path.join(source, 'title.svg'),
		'<!DOCTYPE svg [<!ENTITY caption "An illustration">]>' +
			svgRoot +
			'><title>&caption;</title></svg>'
	);
	const output = path.join(temporary, 'production');
	await copyOptimisedPublicFiles(source, output);
	expect(await readFile(path.join(output, 'title.svg'), 'utf8')).toContain(
		'<title>An illustration</title>'
	);
});

test.each([
	['mismatched tags', svgRoot + '><path></svg>'],
	['an empty file', ''],
	['multiple roots', svgRoot + '/>' + svgRoot + '/>'],
	['a non-SVG root', '<html/>'],
	['an SVG name in another namespace', '<svg xmlns="urn:other"/>'],
	['truncated trailing markup', svgRoot + '/><'],
	['an unclosed trailing comment', svgRoot + '/><!-- unclosed'],
	['duplicate attributes', svgRoot + ' id="first" id="second"/>'],
	[
		'duplicate expanded attribute names',
		svgRoot + ' xmlns:a="urn:shared" xmlns:b="urn:shared" a:x="one" b:x="two"/>'
	],
	[
		'duplicate expanded attribute names in a nested element',
		svgRoot + ' xmlns:a="urn:shared"><g xmlns:b="urn:shared" a:x="one" b:x="two"/></svg>'
	],
	['an unbound attribute prefix', svgRoot + '><g missing:id="one"/></svg>'],
	['an invalid binding of the xml prefix', svgRoot + '><g xmlns:xml="urn:other"/></svg>'],
	['an undeclared entity', svgRoot + '><title>&copy;</title></svg>'],
	[
		'invalid UTF-8',
		Buffer.concat([
			Buffer.from(svgRoot + '><title>'),
			Buffer.of(255),
			Buffer.from('</title></svg>')
		])
	]
])(
	'SVG-BUILD-2: names the public-relative path and underlying error for %s',
	async (_, contents) => {
		const source = path.join(temporary, 'source');
		await mkdir(path.join(source, 'nested'), { recursive: true });
		await writeFile(path.join(source, 'nested/broken.svg'), contents);

		const output = path.join(temporary, 'production');
		const result = await copyOptimisedPublicFiles(source, output).catch(
			(error: unknown) => error
		);
		expect(result).toBeInstanceOf(Error);
		expect((result as Error).message).toContain('nested/broken.svg');
		expect((result as Error).cause).toBeInstanceOf(Error);
		expect(await Bun.file(path.join(output, 'nested/broken.svg')).exists()).toBe(false);
	}
);
