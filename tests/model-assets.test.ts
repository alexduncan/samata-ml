import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildModelAssets } from '../scripts/build-model-assets';

const workspaces: string[] = [];

async function workspace(): Promise<string> {
	const directory = await mkdtemp(path.join(tmpdir(), 'samata-model-assets-'));
	workspaces.push(directory);
	return directory;
}

afterEach(async () => {
	await Promise.all(
		workspaces.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
	);
});

describe('prebuilt model assets', () => {
	test('WML-P3-ASSET-1: preserves the versioned module graph and notices in a standalone app', async () => {
		const root = await workspace();
		const app = path.join(root, 'samata-ml');
		const modules = path.join(app, 'node_modules');
		const output = path.join(root, 'output');
		await mkdir(modules, { recursive: true });
		await symlink(
			fileURLToPath(new URL('../node_modules/web-ml', import.meta.url)),
			path.join(modules, 'web-ml'),
			'junction'
		);
		const url = await buildModelAssets(output, app);
		expect(url).toBe(
			'/web-ml/0.2.0-7a53ca09d2dbca329724be2b2509694d522efa55e4d9a1f72ca58d415d1b91f6/index.js'
		);
		const directory = path.join(output, path.dirname(url));
		const files = await readdir(directory, { recursive: true, withFileTypes: true });
		expect(files.filter((file) => file.isFile())).toHaveLength(20);
		expect(files.some((file) => file.name.endsWith('.d.ts') || file.name.endsWith('.ts'))).toBe(
			false
		);
		expect(await Bun.file(path.join(directory, 'training-orchestrator.js')).exists()).toBe(
			true
		);
		expect(
			await Bun.file(path.join(directory, 'training-orchestrator-dedicated.js')).exists()
		).toBe(true);
		expect(await Bun.file(path.join(directory, 'training-worker-probe.js')).exists()).toBe(
			true
		);
		expect(await Bun.file(path.join(directory, 'training-worker-svm.js')).exists()).toBe(true);
		const svcWasm = await readFile(path.join(directory, 'wasm', 'libsvm.wasm'));
		expect([...svcWasm.subarray(0, 4)]).toEqual([0, 97, 115, 109]);
		expect(
			await Bun.file(path.join(directory, 'wasm', 'logistic-regression.v1.wasm')).exists()
		).toBe(true);
		expect(await Bun.file(path.join(directory, 'LICENSE.md')).exists()).toBe(true);
		expect(await Bun.file(path.join(directory, 'THIRD-PARTY-NOTICES.md')).exists()).toBe(true);
		expect(await Bun.file(path.join(directory, 'wasm', 'LIBSVM-COPYRIGHT')).exists()).toBe(
			true
		);
	});

	test('WML-P3-ASSET-1: names the installed package if it is missing', async () => {
		const root = await workspace();
		const app = path.join(root, 'samata-ml');
		const output = path.join(root, 'output');
		const packageDirectory = path.join(app, 'node_modules', 'web-ml');
		await expect(buildModelAssets(output, app)).rejects.toThrow(
			`web-ml setup error at ${packageDirectory}: installed package is unavailable`
		);
		await expect(readdir(output)).rejects.toThrow();
	});

	test('WML-P3-ASSET-1: refuses a missing or mismatched public entry', async () => {
		const root = await workspace();
		const app = path.join(root, 'samata-ml');
		const packageDirectory = path.join(app, 'node_modules', 'web-ml');
		const output = path.join(root, 'output');
		await mkdir(packageDirectory, { recursive: true });
		const manifest = path.join(packageDirectory, 'package.json');
		await expect(buildModelAssets(output, app)).rejects.toThrow(
			`web-ml setup error at ${manifest}`
		);
		await writeFile(
			path.join(packageDirectory, 'package.json'),
			'{"name":"web-ml","version":"0.2.0"}'
		);
		await expect(buildModelAssets(output, app)).rejects.toThrow(
			`web-ml setup error at ${manifest}: package manifest does not match`
		);
		await expect(readdir(output)).rejects.toThrow();
	});

	test('WML-P3-ASSET-1: production headers permit WASM and isolate same-origin workers', async () => {
		const headers = await Bun.file(new URL('../public/_headers', import.meta.url)).text();
		expect(headers).toContain('Cross-Origin-Opener-Policy: same-origin');
		expect(headers).toContain('Cross-Origin-Embedder-Policy: require-corp');
		expect(headers).toContain('Cross-Origin-Resource-Policy: same-origin');
		expect(headers).toMatch(/script-src 'self' 'wasm-unsafe-eval'/);
		expect(headers).toMatch(/worker-src 'self'/);
	});
});
