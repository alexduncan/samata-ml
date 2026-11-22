import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { Server } from 'bun';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
	extractHtmlTitle,
	extractMockupMetadata,
	getMockupFiles,
	injectPreviewHelper,
	parseCliArgs,
	renderIndexHtml,
	startMockupsServer,
	type MockupIndexEntry
} from '../scripts/serve-mockups';
import { CHECKOUT_PORTS, CHECKOUT_ROOT } from '../scripts/ports';

describe('mockup server helpers', () => {
	it('extracts HTML titles and parses CLI flags', () => {
		expect(extractHtmlTitle('<title>  Review &amp; view  </title>')).toBe('Review & view');
		expect(extractHtmlTitle('<html><body>Untitled</body></html>')).toBe('');
		expect(parseCliArgs(['--port', '4500', '--host', '0.0.0.0', '--open'])).toEqual({
			port: 4500,
			hostname: '0.0.0.0',
			open: true
		});
		expect(parseCliArgs(['-p', '8080', '-o']).port).toBe(8080);
		expect(parseCliArgs(['--port=9999']).port).toBe(9999);
		if (!process.env.PORT) expect(parseCliArgs([]).port).toBe(CHECKOUT_PORTS.mockups);
	});

	it('extracts mockup metadata across attribute orders, quote styles, entities, and fallbacks', () => {
		const standard = `<!doctype html><html><head>
			<meta name="name" content="Models &amp; Overview &#8212; Draft" />
			<meta content='User&#39;s &lt;hub&gt; &quot;view&quot; &#x2014; &amp;lt;safe&amp;gt;' name='description'>
			<META CONTENT="IMPLEMENTED" NAME="STATUS" />
			<title>Ignored title</title>
		</head><body></body></html>`;
		expect(extractMockupMetadata(standard, '03-0_models-overview.html')).toEqual({
			name: 'Models & Overview — Draft',
			description: 'User\'s <hub> "view" — &lt;safe&gt;',
			status: 'implemented'
		});

		const titleFallback =
			'<html><head><title>Fallback Title</title></head><body></body></html>';
		expect(extractMockupMetadata(titleFallback, 'fallback.html')).toEqual({
			name: 'Fallback Title',
			description: '',
			status: 'draft'
		});

		const filenameFallback =
			'<html><head><meta name="status" content="invalid-status" /></head><body></body></html>';
		expect(extractMockupMetadata(filenameFallback, '04_compare-results.html')).toEqual({
			name: '04_compare-results',
			description: '',
			status: 'draft'
		});

		const readyStatus =
			'<meta name="name" content="Ready Page"><meta name="status" content="ready">';
		expect(extractMockupMetadata(readyStatus, 'ready.html')).toEqual({
			name: 'Ready Page',
			description: '',
			status: 'ready'
		});
	});

	it('discovers only top-level regular non-symlink HTML files sorted deterministically', async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), 'mockup-inventory-'));
		const outside = path.join(os.tmpdir(), `mockup-inv-outside-${process.pid}.html`);
		try {
			await mkdir(path.join(root, 'css'), { recursive: true });
			await mkdir(path.join(root, 'nested'), { recursive: true });
			await writeFile(
				path.join(root, 'b-page.html'),
				'<head><meta name="name" content="Beta"><meta name="description" content="Second"><meta name="status" content="ready"></head>'
			);
			await writeFile(
				path.join(root, 'a-page.html'),
				'<head><meta name="name" content="Alpha"><meta name="description" content="First"><meta name="status" content="implemented"></head>'
			);
			await writeFile(path.join(root, 'empty.html'), '');
			await writeFile(path.join(root, 'index.html'), '<title>Index</title>');
			await writeFile(path.join(root, '.hidden.html'), '<title>Hidden</title>');
			await writeFile(path.join(root, 'style.css'), 'body {}');
			await writeFile(path.join(root, 'css', 'theme.css'), 'body {}');
			await writeFile(path.join(root, 'nested', 'ignored.html'), '<title>Nested</title>');
			await writeFile(outside, '<title>Symlinked</title>');
			await symlink(outside, path.join(root, 'linked.html'));

			const files = await getMockupFiles(root);
			expect(files.map((file) => file.filename)).toEqual([
				'a-page.html',
				'b-page.html',
				'empty.html'
			]);
			expect(files[0]).toMatchObject({
				filename: 'a-page.html',
				name: 'Alpha',
				description: 'First',
				status: 'implemented',
				isEmpty: false
			});
			expect(files[1]).toMatchObject({
				filename: 'b-page.html',
				name: 'Beta',
				description: 'Second',
				status: 'ready',
				isEmpty: false
			});
			expect(files[2]).toMatchObject({
				filename: 'empty.html',
				name: 'empty',
				description: '',
				status: 'draft',
				isEmpty: true,
				size: 0
			});
			expect(Number.isNaN(Date.parse(files[0]!.mtime))).toBe(false);
		} finally {
			await rm(root, { recursive: true, force: true });
			await rm(outside, { force: true });
		}
	});

	it('renders the catalogue index HTML with mockup-index body, filters, and table', () => {
		const html = renderIndexHtml();
		expect(html).toContain('<link rel="stylesheet" href="/mockups.css" />');
		expect(html).toContain('<body class="mockup-index">');
		expect(html).toContain('<table class="mockups">');
		expect(html).toContain('id="query"');
		expect(html).toContain('id="status-filter"');
		expect(html).toContain('id="results-count"');
		expect(html).toContain("fetch('/index.json'");
		expect(html).not.toContain('__mockup-review-helper-host');
	});

	it('injects /mockups.css before </head> and light-DOM helper before </body> with safe escaping', () => {
		const entry: MockupIndexEntry = {
			filename: 'weird</script>.html',
			name: 'Models & <Overview>',
			description: 'When "users" review <models>.',
			status: 'draft',
			isEmpty: false,
			size: 120,
			mtime: '2026-11-21T12:00:00.000Z'
		};
		const input =
			'<!doctype html><html><head><title>T</title></head><body><main>Hi</main></body></html>';
		const output = injectPreviewHelper(input, entry);

		const cssIndex = output.indexOf('<link rel="stylesheet" href="/mockups.css" />');
		const closeHeadIndex = output.indexOf('</head>');
		const hostIndex = output.indexOf('<div id="__mockup-review-helper-host">');
		const closeBodyIndex = output.indexOf('</body>');

		expect(cssIndex).toBeGreaterThan(-1);
		expect(cssIndex).toBeLessThan(closeHeadIndex);
		expect(hostIndex).toBeGreaterThan(output.indexOf('</main>'));
		expect(hostIndex).toBeLessThan(closeBodyIndex);

		expect(output).toContain('<div id="mockup-details">');
		expect(output).toContain('<h4 class="mockup-name">');
		expect(output).toContain('Models &amp; &lt;Overview&gt;');
		expect(output).toContain('<span class="mockup-status mockup-status-draft">draft</span>');
		expect(output).toContain(
			'<p class="mockup-description">When &quot;users&quot; review &lt;models&gt;.</p>'
		);
		expect(output).toContain('<nav id="mockup-controls" aria-label="Mockup review">');
		expect(output).toContain('<select id="preview-page"></select>');
		expect(output).toContain('<a href="/" class="index-link">');
		expect(output).toContain('class="index-link-icon"');
		expect(output).toContain('\\u003c/script\\u003e');
		expect(output).not.toContain('weird</script>.html');
		expect(output).not.toContain('attachShadow');
		expect(output).not.toContain('<label');
		expect(output).not.toContain('>Go<');

		const fragment = injectPreviewHelper('<p>Fragment</p>', entry);
		expect(fragment.startsWith('<link rel="stylesheet" href="/mockups.css" />')).toBe(true);
		expect(fragment).toContain('<div id="__mockup-review-helper-host">');
	});
});

describe('mockup server HTTP behaviour', () => {
	let root: string;
	let server: Server<any>;
	let outsideFile: string;
	const source =
		'<!doctype html><html><head><meta name="name" content="Safe &amp; Fixture" /><meta name="description" content="Fixture description." /><meta name="status" content="implemented" /><title>Safe &amp; Fixture</title></head><body><main><h1>Fixture</h1></main></body></html>';

	beforeAll(async () => {
		root = await mkdtemp(path.join(os.tmpdir(), 'mockup-server-'));
		await mkdir(path.join(root, 'css'), { recursive: true });
		await writeFile(path.join(root, 'fixture.html'), source);
		await writeFile(path.join(root, 'empty.html'), '');
		await writeFile(path.join(root, 'mockups.css'), 'body { margin-top: 60px; }');
		await writeFile(path.join(root, 'css', 'theme.css'), 'body { color: red; }');
		await writeFile(path.join(root, 'image.png'), new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
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

	it('reports the checkout identity on GET and HEAD and refuses POST', async () => {
		const get = await server.fetch(new Request(url('/__checkout')));
		expect(get.status).toBe(200);
		expect(get.headers.get('Cache-Control')).toBe('no-store');
		const body = (await get.json()) as Record<string, unknown>;
		expect(body.service).toBe('samata-ml-mockups');
		expect(body.root).toBe(CHECKOUT_ROOT);
		expect(body.mode).toBeNull();
		const head = await server.fetch(new Request(url('/__checkout'), { method: 'HEAD' }));
		expect(head.status).toBe(200);
		expect(await head.text()).toBe('');
		const post = await server.fetch(new Request(url('/__checkout'), { method: 'POST' }));
		expect(post.status).toBe(405);
	});

	it('serves the catalogue page and live /index.json with no-store headers', async () => {
		const indexResponse = await server.fetch(new Request(url('/')));
		const indexHtml = await indexResponse.text();
		expect(indexResponse.status).toBe(200);
		expect(indexResponse.headers.get('cache-control')).toBe('no-store');
		expect(indexHtml).toContain('<body class="mockup-index">');
		expect(indexHtml).toContain('<table class="mockups">');

		const jsonResponse = await server.fetch(new Request(url('/index.json')));
		expect(jsonResponse.status).toBe(200);
		expect(jsonResponse.headers.get('cache-control')).toBe('no-store');
		expect(jsonResponse.headers.get('content-type')).toBe('application/json; charset=utf-8');
		const entries = (await jsonResponse.json()) as MockupIndexEntry[];
		expect(entries.map((entry) => entry.filename)).toEqual(['empty.html', 'fixture.html']);
		expect(entries[1]).toMatchObject({
			filename: 'fixture.html',
			name: 'Safe & Fixture',
			description: 'Fixture description.',
			status: 'implemented',
			isEmpty: false
		});

		const added = path.join(root, 'new-page.html');
		await writeFile(
			added,
			'<head><meta name="name" content="Added Later"><meta name="status" content="draft"></head>'
		);
		const updatedEntries = (await (
			await server.fetch(new Request(url('/index.json')))
		).json()) as MockupIndexEntry[];
		expect(updatedEntries.map((entry) => entry.filename)).toContain('new-page.html');
		await rm(added);
	});

	it('serves clean HTML byte-for-byte and ordinary previews with the light-DOM helper', async () => {
		const cleanResponse = await server.fetch(new Request(url('/fixture.html?clean=1')));
		expect(cleanResponse.status).toBe(200);
		expect(cleanResponse.headers.get('cache-control')).toBe('no-store');
		expect(new Uint8Array(await cleanResponse.arrayBuffer())).toEqual(
			new TextEncoder().encode(source)
		);

		const previewResponse = await server.fetch(new Request(url('/fixture.html')));
		const previewHtml = await previewResponse.text();
		expect(previewResponse.status).toBe(200);
		expect(previewHtml).toContain('<link rel="stylesheet" href="/mockups.css" />');
		expect(previewHtml).toContain('<div id="__mockup-review-helper-host">');
		expect(previewHtml).toContain('Safe &amp; Fixture');
		expect(previewHtml).toContain('mockup-status-implemented');
	});

	it('serves root and nested CSS plus plain-text source with nosniff', async () => {
		const helperCss = await server.fetch(new Request(url('/mockups.css')));
		expect(helperCss.status).toBe(200);
		expect(helperCss.headers.get('content-type')).toContain('text/css');

		const nestedCss = await server.fetch(new Request(url('/css/theme.css')));
		expect(nestedCss.status).toBe(200);
		expect(nestedCss.headers.get('content-type')).toContain('text/css');

		const text = await server.fetch(new Request(url('/__source/fixture.html')));
		expect(text.status).toBe(200);
		expect(text.headers.get('content-type')).toBe('text/plain; charset=utf-8');
		expect(text.headers.get('x-content-type-options')).toBe('nosniff');
		expect(await text.text()).toBe(source);
	});

	it('rejects malformed URIs, symlink/traversal escapes, missing files, POST, and binary sources', async () => {
		expect((await server.fetch(new Request(url('/%ZZ')))).status).toBe(400);
		expect((await server.fetch(new Request(url('/escape.txt')))).status).toBe(403);
		expect((await server.fetch(new Request(url('/..%2fREADME.md')))).status).toBe(403);
		expect((await server.fetch(new Request(url('/__source/..%2fREADME.md')))).status).toBe(403);

		const missing = await server.fetch(new Request(url('/not-found.html')));
		expect(missing.status).toBe(404);
		expect(await missing.text()).toContain('Back to the mockup catalogue');

		const post = await server.fetch(new Request(url('/fixture.html'), { method: 'POST' }));
		expect(post.status).toBe(405);
		expect(post.headers.get('allow')).toBe('GET, HEAD');

		const binarySource = await server.fetch(new Request(url('/__source/image.png')));
		expect(binarySource.status).toBe(415);
	});

	it('notifies a connected preview via /__hmr after CSS is saved', async () => {
		const response = await server.fetch(new Request(url('/__hmr')));
		const reader = response.body!.getReader();
		await reader.read();
		await writeFile(path.join(root, 'css', 'theme.css'), 'body { color: blue; }');
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
