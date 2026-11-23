import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
	parseAuditArgs,
	renderAuditReportHtml,
	runMockupAudit,
	type MockupAuditReport
} from '../scripts/audit-mockups';
import { CHECKOUT_PORTS, CHECKOUT_ROOT } from '../scripts/ports';
import { startMockupsServer } from '../scripts/serve-mockups';

let root: string;
let reportDir: string;
let reportRoot: string;
let server: Awaited<ReturnType<typeof startMockupsServer>>;

beforeAll(async () => {
	root = await mkdtemp(path.join(os.tmpdir(), 'mockup-audit-fixture-'));
	reportRoot = await mkdtemp(path.join(os.tmpdir(), 'mockup-audit-reports-'));
	reportDir = reportRoot;
	await mkdir(path.join(root, 'nested'), { recursive: true });
	await writeFile(
		path.join(root, 'clean.html'),
		'<!doctype html><html lang="en"><head><title>Clean</title></head><body><main><h1>Clean fixture</h1><label for="name">Name</label><input id="name"></main></body></html>'
	);
	await writeFile(
		path.join(root, 'failing.html'),
		'<!doctype html><html lang="en"><head><title>Failure</title></head><body><main><h1>Failure fixture</h1><img src="missing.png"></main></body></html>'
	);
	await writeFile(path.join(root, 'empty.html'), '');
	await writeFile(path.join(root, 'clean.css'), 'main { display: block; }');
	await writeFile(
		path.join(root, 'nested', 'sub.html'),
		'<!doctype html><html lang="en"><head><title>Nested</title></head><body><main><h1>Nested</h1></main></body></html>'
	);
	server = await startMockupsServer({
		port: 0,
		hostname: 'localhost',
		rootDir: root,
		enableWatcher: false
	});
});

afterAll(async () => {
	server?.stop(true);
	if (root) await rm(root, { recursive: true, force: true });
	if (reportRoot) await rm(reportRoot, { recursive: true, force: true });
});

describe('mockup audit helpers', () => {
	test('parses explicit filenames and validates the local port', () => {
		expect(parseAuditArgs(['clean.html', '--port', '4555'])).toEqual({
			options: { paths: ['clean.html'], port: 4555 }
		});
		expect(parseAuditArgs(['--port=0'])).toHaveProperty('error');
		expect(parseAuditArgs(['--unknown'])).toHaveProperty('error');
		expect(parseAuditArgs(['../outside.html'])).toEqual({
			options: { paths: ['../outside.html'], port: CHECKOUT_PORTS.mockups }
		});
	});

	test('escapes report content and lists selectors, help links and incomplete checks', () => {
		const report: MockupAuditReport = {
			runAt: 'run',
			server: 'http://localhost:3333',
			browser: { name: 'Chromium', version: 'test' },
			viewport: { width: 1440, height: 900 },
			axeVersion: '4.14.0',
			tags: ['wcag22aa'],
			results: [
				{
					file: '<script>alert(1)</script>.html',
					url: 'http://localhost:3333/?x="&y',
					status: 'violations',
					violations: [
						{
							id: 'image-alt',
							impact: 'critical',
							description: 'Description',
							help: 'Add text alternative',
							helpUrl: 'https://example.test/?x="&y',
							nodes: [
								{
									target: ['img:nth-child(1)'],
									html: '<img src="x">',
									failureSummary: 'Need alt'
								}
							]
						}
					],
					incomplete: [
						{
							id: 'color-contrast',
							impact: 'serious',
							help: 'Check contrast',
							helpUrl: 'https://example.test/contrast'
						}
					]
				}
			],
			passes: 0,
			violations: 1,
			incomplete: 1,
			errors: 0,
			skipped: []
		};
		const html = renderAuditReportHtml(report);
		expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;.html');
		expect(html).toContain('&lt;img src=&quot;x&quot;&gt;');
		expect(html).toContain('img:nth-child(1)');
		expect(html).toContain('https://example.test/?x=&quot;&amp;y');
		expect(html).toContain('Incomplete checks requiring manual review (1)');
		expect(html).not.toContain('<script>alert(1)</script>');
	});

	test('records no eligible pages as setup failure with exit code 2', async () => {
		const emptyRoot = await mkdtemp(path.join(os.tmpdir(), 'mockup-audit-empty-'));
		try {
			const result = await runMockupAudit({ rootDir: emptyRoot, reportDir });
			expect(result.exitCode).toBe(2);
			expect(result.report.setupError).toContain('No non-empty HTML');
		} finally {
			await rm(emptyRoot, { recursive: true, force: true });
		}
	});

	test('reports bun run mockups when the local mockup server is unreachable', async () => {
		const temporaryServer = Bun.serve({
			port: 0,
			hostname: '127.0.0.1',
			fetch: () => new Response()
		});
		const unusedPort = temporaryServer.port!;
		temporaryServer.stop(true);
		const result = await runMockupAudit({
			paths: ['clean.html'],
			port: unusedPort,
			rootDir: root,
			reportDir
		});
		expect(result.exitCode).toBe(2);
		expect(result.report.setupError).toContain('Start it with bun run mockups.');
	});

	test('refuses a mockup server that belongs to another checkout', async () => {
		const result = await runMockupAudit({
			paths: ['clean.html'],
			port: server.port,
			rootDir: root,
			reportDir,
			expectedRoot: '/another/checkout'
		});
		expect(result.exitCode).toBe(2);
		expect(result.report.results).toEqual([]);
		expect(result.report.setupError).toContain('/another/checkout');
		expect(result.report.setupError).toContain(CHECKOUT_ROOT);
		const json = await readFile(path.join(reportDir, 'latest.json'), 'utf8');
		expect(json).toContain('/another/checkout');
	});

	test('refuses a server without the checkout identity endpoint', async () => {
		const plain = Bun.serve({
			port: 0,
			hostname: '127.0.0.1',
			fetch: () =>
				new Response('<!doctype html>', { headers: { 'Content-Type': 'text/html' } })
		});
		try {
			const result = await runMockupAudit({
				paths: ['clean.html'],
				port: plain.port,
				rootDir: root,
				reportDir
			});
			expect(result.exitCode).toBe(2);
			expect(result.report.setupError).toContain('does not report a samata-ml checkout');
		} finally {
			plain.stop(true);
		}
	});

	test('audits a known failing and clean fixture in real Chromium and distinguishes empty files', async () => {
		const result = await runMockupAudit({
			port: server.port,
			rootDir: root,
			reportDir
		});
		expect(result.exitCode).toBe(1);
		expect(result.report.browser.version).not.toBe('unavailable');
		const clean = result.report.results.find((entry) => entry.file === 'clean.html');
		const failing = result.report.results.find((entry) => entry.file === 'failing.html');
		expect(clean?.status).toBe('passed');
		expect(clean?.url).toBe(`http://localhost:${server.port}/clean.html?clean=1`);
		expect(failing?.status).toBe('violations');
		expect(failing?.url).toBe(`http://localhost:${server.port}/failing.html?clean=1`);
		expect(failing?.violations.map((violation) => violation.id)).toContain('image-alt');
		expect(result.report.skipped).toContain('empty.html');
		expect(result.report.results.every((entry) => entry.incomplete)).toBe(true);
		const json = await readFile(path.join(reportDir, 'latest.json'), 'utf8');
		const html = await readFile(path.join(reportDir, 'latest.html'), 'utf8');
		expect(json).toContain('axeVersion');
		expect(json).toContain('image-alt');
		expect(html).toContain('manual keyboard, screen-reader and responsive checks');
		expect(html).toContain('<code>img</code>');
		expect(html).not.toContain('__mockup-review-helper-host');
	});

	test('rejects explicit non-HTML, nested, traversal, and empty targets with exit code 2', async () => {
		const nonHtml = await runMockupAudit({
			paths: ['clean.css'],
			port: server.port,
			rootDir: root,
			reportDir
		});
		expect(nonHtml.exitCode).toBe(2);
		expect(nonHtml.report.passes).toBe(0);

		const nested = await runMockupAudit({
			paths: ['nested/sub.html'],
			port: server.port,
			rootDir: root,
			reportDir
		});
		expect(nested.exitCode).toBe(2);
		expect(nested.report.passes).toBe(0);

		const traversal = await runMockupAudit({
			paths: ['../outside.html'],
			port: server.port,
			rootDir: root,
			reportDir
		});
		expect(traversal.exitCode).toBe(2);

		const clean = await runMockupAudit({
			paths: ['clean.html'],
			port: server.port,
			rootDir: root,
			reportDir
		});
		expect(clean.exitCode).toBe(0);
		expect(clean.report.passes).toBe(1);

		const empty = await runMockupAudit({
			paths: ['empty.html'],
			port: server.port,
			rootDir: root,
			reportDir
		});
		expect(empty.exitCode).toBe(2);
		expect(empty.report.setupError).toContain('empty');
	});
});
