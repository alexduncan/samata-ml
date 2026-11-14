import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { Server } from 'bun';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
	extractHtmlTitle,
	formatBytes,
	getMockupFiles,
	parseCliArgs,
	renderIndexHtml,
	startMockupsServer
} from '../scripts/serve-mockups';

describe('mockup server helpers', () => {
	it('formats byte counts and extracts HTML titles', () => {
		expect(formatBytes(0)).toBe('0 B');
		expect(formatBytes(1024)).toBe('1 KB');
		expect(extractHtmlTitle('<title>  Review view  </title>')).toBe('Review view');
		expect(extractHtmlTitle('<html><body>Untitled</body></html>')).toBe('');
	});

	it('parses server flags', () => {
		expect(parseCliArgs(['--port', '4500', '--host', '0.0.0.0', '--open'])).toEqual({
			port: 4500,
			hostname: '0.0.0.0',
			open: true
		});
		expect(parseCliArgs(['-p', '8080', '-o']).port).toBe(8080);
		expect(parseCliArgs(['--port=9999']).port).toBe(9999);
	});

	it('discovers nested regular files, classifies them and pairs exact counterparts', async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), 'mockup-inventory-'));
		try {
			await mkdir(path.join(root, 'ui-scaffold', 'drafts'), { recursive: true });
			await mkdir(path.join(root, 'ui-scaffold', 'css'), { recursive: true });
			await mkdir(path.join(root, 'ui-scaffold', 'nested'), { recursive: true });
			await writeFile(
				path.join(root, 'ui-scaffold', 'page.html'),
				'<title>Reference</title>'
			);
			await writeFile(
				path.join(root, 'ui-scaffold', 'nested', 'index.html'),
				'<title>Nested index</title>'
			);
			await writeFile(
				path.join(root, 'ui-scaffold', 'drafts', 'page.html'),
				'<title>Draft</title>'
			);
			await writeFile(path.join(root, 'ui-scaffold', 'css', 'theme.css'), 'body {}');
			await writeFile(path.join(root, 'empty.html'), '');
			const files = await getMockupFiles(root);
			expect(files.map((file) => file.relativePath)).toEqual([
				'empty.html',
				'ui-scaffold/css/theme.css',
				'ui-scaffold/drafts/page.html',
				'ui-scaffold/nested/index.html',
				'ui-scaffold/page.html'
			]);
			expect(files[0]).toMatchObject({ kind: 'html', isEmpty: true, isDraft: false });
			expect(files[2]).toMatchObject({
				kind: 'html',
				isDraft: true,
				counterpartPath: 'ui-scaffold/page.html',
				title: 'Draft'
			});
			expect(files[1]?.kind).toBe('css');
			expect(
				files.some((file) => file.relativePath === 'ui-scaffold/nested/index.html')
			).toBe(true);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it('renders filtered groups with escaped query text and one catalogue entry per file', async () => {
		const files: Awaited<ReturnType<typeof getMockupFiles>> = [
			{
				relativePath: 'ui-scaffold/drafts/view.html',
				title: 'View & title',
				size: 20,
				isEmpty: false,
				mtime: new Date('2026-11-14T12:00:00Z'),
				kind: 'html',
				isDraft: true,
				counterpartPath: 'ui-scaffold/view.html'
			},
			{
				relativePath: 'ui-scaffold/view.html',
				title: 'Reference',
				size: 0,
				isEmpty: true,
				mtime: new Date('2026-11-14T12:00:00Z'),
				kind: 'html',
				isDraft: false
			},
			{
				relativePath: 'ui-scaffold/style.css',
				title: 'style',
				size: 5,
				isEmpty: false,
				mtime: new Date('2026-11-14T12:00:00Z'),
				kind: 'css',
				isDraft: false
			}
		];
		const all = renderIndexHtml(files);
		expect(all.match(/<li>/g)).toHaveLength(files.length);
		expect(all).toContain('View &amp; title');
		expect(all).toContain('Compare with reference: ui-scaffold/view.html (empty)');
		const filtered = renderIndexHtml(files, 'View', 'needs-styling');
		expect(filtered).toContain('value="View"');
		expect(filtered).toContain('value="needs-styling" selected');
		expect(filtered.match(/<li>/g)).toHaveLength(1);
		const noMatches = renderIndexHtml(files, 'missing', 'unknown-filter');
		expect(noMatches).toContain('No files match these filters.');
		expect(noMatches).toContain('value="all" selected');
	});
});

describe('mockup server HTTP behaviour', () => {
	let root: string;
	let server: Server<any>;
	let outsideFile: string;
	const source =
		'<!doctype html><html><head><title>Safe & title</title></head><body><h1>Fixture</h1></body></html>';

	beforeAll(async () => {
		root = await mkdtemp(path.join(os.tmpdir(), 'mockup-server-'));
		await mkdir(path.join(root, 'ui-scaffold', 'drafts'), { recursive: true });
		await mkdir(path.join(root, 'ui-scaffold', 'css'), { recursive: true });
		await mkdir(path.join(root, 'ui-scaffold', 'nested'), { recursive: true });
		await writeFile(path.join(root, 'ui-scaffold', 'fixture.html'), source);
		await writeFile(
			path.join(root, 'ui-scaffold', 'nested', 'index.html'),
			'<title>Nested index</title>'
		);
		await writeFile(
			path.join(root, 'ui-scaffold', 'drafts', 'fixture.html'),
			'<title>Draft fixture</title>'
		);
		await writeFile(path.join(root, 'ui-scaffold', 'css', 'theme.css'), 'body { color: red; }');
		await writeFile(path.join(root, 'ui-scaffold', 'empty.html'), '');
		outsideFile = path.join(os.tmpdir(), `mockup-outside-${process.pid}.txt`);
		await writeFile(outsideFile, 'outside');
		await symlink(outsideFile, path.join(root, 'escape.txt'));
		server = await startMockupsServer({
			port: 0,
			hostname: '127.0.0.1',
			open: false,
			enableWatcher: true,
			rootDir: root
		});
	});

	afterAll(async () => {
		server.stop(true);
		await rm(root, { recursive: true, force: true });
		await rm(outsideFile, { force: true });
	});

	const url = (pathname: string) => new URL(pathname, server.url);

	it('serves a fresh catalogue with no-store headers and every resource', async () => {
		const response = await server.fetch(new Request(url('/')));
		const html = await response.text();
		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(html).toContain('ui-scaffold/drafts/fixture.html');
		expect(html).toContain('ui-scaffold/css/theme.css');
		expect(html).toContain('empty.html');
		expect(html).toContain('Safe &amp; title');
		expect(html).toContain('/files/ui-scaffold/nested/index.html');
	});

	it('serves clean HTML byte-for-byte and ordinary previews with the helper', async () => {
		const cleanResponse = await server.fetch(
			new Request(url('/files/ui-scaffold/fixture.html?clean=1'))
		);
		expect(new Uint8Array(await cleanResponse.arrayBuffer())).toEqual(
			new TextEncoder().encode(source)
		);
		const preview = await server.fetch(new Request(url('/files/ui-scaffold/fixture.html')));
		expect(await preview.text()).toContain('__mockup-review-helper-host');
	});

	it('redirects legacy scaffold and full specification URLs to canonical paths', async () => {
		for (const oldPath of [
			'/fixture.html?x=1',
			'/ui-scaffold/fixture.html',
			'/specification/mockups/ui-scaffold/fixture.html'
		]) {
			const response = await server.fetch(new Request(url(oldPath), { redirect: 'manual' }));
			expect(response.status).toBe(302);
			expect(response.headers.get('location')).toContain('/files/ui-scaffold/fixture.html');
		}
		const queryRedirect = await server.fetch(
			new Request(url('/fixture.html?x=1'), { redirect: 'manual' })
		);
		expect(queryRedirect.headers.get('location')).toContain('?x=1');
	});

	it('serves nested CSS and source as plain text with safe headers', async () => {
		const css = await server.fetch(new Request(url('/files/ui-scaffold/css/theme.css')));
		expect(css.headers.get('content-type')).toContain('text/css');
		const text = await server.fetch(new Request(url('/__source/ui-scaffold/fixture.html')));
		expect(text.headers.get('content-type')).toBe('text/plain; charset=utf-8');
		expect(text.headers.get('x-content-type-options')).toBe('nosniff');
		expect(await text.text()).toBe(source);
	});

	it('rejects malformed paths and symlink escapes and returns safe missing-file pages', async () => {
		expect((await server.fetch(new Request(url('/files/%ZZ')))).status).toBe(400);
		expect((await server.fetch(new Request(url('/files/escape.txt')))).status).toBe(403);
		const missing = await server.fetch(new Request(url('/files/not-found.html')));
		expect(missing.status).toBe(404);
		expect(await missing.text()).toContain('Back to the mockup catalogue');
	});

	it('keeps the source endpoint inside the mockup root', async () => {
		const response = await server.fetch(new Request(url('/__source/../README.md')));
		expect(response.status).not.toBe(200);
	});

	it('detects nested inventory changes between requests', async () => {
		const added = path.join(root, 'ui-scaffold', 'drafts', 'new.html');
		await writeFile(added, '<title>Added later</title>');
		const listing = await server.fetch(new Request(url('/')));
		expect(await listing.text()).toContain('ui-scaffold/drafts/new.html');
		await rm(added);
	});

	it('notifies a connected preview after nested CSS is saved', async () => {
		const response = await server.fetch(new Request(url('/__hmr')));
		const reader = response.body!.getReader();
		await reader.read();
		await writeFile(
			path.join(root, 'ui-scaffold', 'css', 'theme.css'),
			'body { color: blue; }'
		);
		const result = await Promise.race([
			reader.read(),
			new Promise<ReadableStreamReadResult<Uint8Array>>((resolve) =>
				setTimeout(() => resolve({ done: true, value: undefined }), 2000)
			)
		]);
		expect(result.done).toBe(false);
		expect(new TextDecoder().decode(result.value)).toContain('data: reload');
		await reader.cancel();
	});
});
