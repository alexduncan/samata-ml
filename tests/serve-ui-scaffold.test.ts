import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { Server } from 'bun';
import {
	extractHtmlTitle,
	formatBytes,
	getScaffoldFiles,
	injectPreviewHelper,
	parseCliArgs,
	renderIndexHtml,
	startScaffoldServer,
	type ScaffoldFileInfo
} from '../scripts/serve-ui-scaffold';
import { UI_SCAFFOLD_DIR } from '../scripts/config';

describe('serve-ui-scaffold helper functions', () => {
	it('formats bytes into human readable format', () => {
		expect(formatBytes(0)).toBe('0 B');
		expect(formatBytes(500)).toBe('500 B');
		expect(formatBytes(1024)).toBe('1 KB');
		expect(formatBytes(4453)).toBe('4.3 KB');
		expect(formatBytes(1048576)).toBe('1 MB');
	});

	it('extracts html titles accurately', () => {
		expect(
			extractHtmlTitle('<!doctype html><html><head><title>My Title</title></head></html>')
		).toBe('My Title');
		expect(extractHtmlTitle('<title>  Trimmed Title  </title>')).toBe('Trimmed Title');
		expect(extractHtmlTitle('<html><head></head><body>No title</body></html>')).toBe('');
	});

	it('parses cli arguments correctly', () => {
		const options1 = parseCliArgs(['--port', '4500', '--host', '0.0.0.0', '--open']);
		expect(options1.port).toBe(4500);
		expect(options1.hostname).toBe('0.0.0.0');
		expect(options1.open).toBe(true);

		const options2 = parseCliArgs(['-p', '8080', '-o']);
		expect(options2.port).toBe(8080);
		expect(options2.open).toBe(true);

		const options3 = parseCliArgs(['--port=9999']);
		expect(options3.port).toBe(9999);
	});

	it('discovers files in UI_SCAFFOLD_DIR', async () => {
		const files = await getScaffoldFiles(UI_SCAFFOLD_DIR);
		expect(Array.isArray(files)).toBe(true);
		expect(files.length).toBeGreaterThan(0);

		// Every entry must be an html file
		for (const file of files) {
			expect(file.name.endsWith('.html')).toBe(true);
			expect(typeof file.size).toBe('number');
			expect(typeof file.isEmpty).toBe('boolean');
		}

		// 00_first-load.html should be present
		const firstLoad = files.find((f) => f.name === '00_first-load.html');
		expect(firstLoad).toBeDefined();
		expect(firstLoad!.isEmpty).toBe(false);
	});

	it('renders index html with all files and live reload script', () => {
		const mockFiles: ScaffoldFileInfo[] = [
			{
				name: '00_first-load.html',
				title: 'First Load View',
				size: 4000,
				isEmpty: false,
				mtime: new Date()
			},
			{
				name: '01-2_select-dataset.html',
				title: 'Select Dataset View',
				size: 0,
				isEmpty: true,
				mtime: new Date()
			}
		];

		const html = renderIndexHtml(mockFiles);
		expect(html).toContain('00_first-load.html');
		expect(html).toContain('First Load View');
		expect(html).toContain('01-2_select-dataset.html');
		expect(html).toContain('Empty (0 B)');
		expect(html).toContain('/__hmr');
		expect(html).toContain('EventSource');
	});

	it('injects live reload and navigation widget into html', () => {
		const mockFiles: ScaffoldFileInfo[] = [
			{
				name: '00_first-load.html',
				title: 'First Load View',
				size: 4000,
				isEmpty: false,
				mtime: new Date()
			}
		];

		const originalHtml =
			'<!doctype html><html><head><title>Test</title></head><body><h1>Hello</h1></body></html>';
		const injected = injectPreviewHelper(originalHtml, '00_first-load.html', mockFiles);

		expect(injected).toContain('__scaffold_helper');
		expect(injected).toContain('/__hmr');
		expect(injected).toContain('attachShadow');
		expect(injected).toContain('00_first-load.html');
		expect(injected).toContain('</body>');
	});
});

describe('serve-ui-scaffold HTTP server', () => {
	let server: Server<any>;
	const testPort = 3456;

	beforeAll(async () => {
		server = await startScaffoldServer({
			port: testPort,
			hostname: '127.0.0.1',
			open: false,
			enableWatcher: false
		});
	});

	afterAll(() => {
		server.stop(true);
	});

	it('serves the index page at /', async () => {
		const res = await server.fetch(new Request(`http://127.0.0.1:${testPort}/`));
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toContain('text/html');
		const html = await res.text();
		expect(html).toContain('UI Scaffold');
		expect(html).toContain('00_first-load.html');
	});

	it('serves an HTML template with injected helpers', async () => {
		const res = await server.fetch(
			new Request(`http://127.0.0.1:${testPort}/00_first-load.html`)
		);
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toContain('text/html');
		const html = await res.text();
		expect(html).toContain('__scaffold_helper');
		expect(html).toContain('samat&amacr;.ml');
	});

	it('serves static CSS with correct MIME type', async () => {
		const res = await server.fetch(new Request(`http://127.0.0.1:${testPort}/style.css`));
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toContain('text/css');
		const css = await res.text();
		expect(css).toContain('@import');
	});

	it('handles full specification path prefix gracefully', async () => {
		const res = await server.fetch(
			new Request(
				`http://127.0.0.1:${testPort}/specification/mockups/ui-scaffold/00_first-load.html`
			)
		);
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toContain('text/html');
	});

	it('returns 404 for nonexistent files', async () => {
		const res = await server.fetch(
			new Request(`http://127.0.0.1:${testPort}/missing-file.html`)
		);
		expect(res.status).toBe(404);
		const html = await res.text();
		expect(html).toContain('404 Not Found');
	});
});
