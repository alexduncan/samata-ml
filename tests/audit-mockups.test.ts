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
import { startMockupsServer } from '../scripts/serve-mockups';

let root: string;
let reportDir: string;
let reportRoot: string;
let server: Awaited<ReturnType<typeof startMockupsServer>>;

beforeAll(async () => {
	root = await mkdtemp(path.join(os.tmpdir(), 'mockup-audit-fixture-'));
	reportRoot = await mkdtemp(path.join(os.tmpdir(), 'mockup-audit-reports-'));
	reportDir = reportRoot;
	await mkdir(path.join(root, 'ui-scaffold', 'drafts'), { recursive: true });
	await writeFile(
		path.join(root, 'ui-scaffold', 'drafts', 'clean.html'),
		'<!doctype html><html lang="en"><head><title>Clean</title></head><body><main><h1>Clean fixture</h1><label for="name">Name</label><input id="name"></main></body></html>'
	);
	await writeFile(
		path.join(root, 'ui-scaffold', 'drafts', 'failure.html'),
		'<!doctype html><html lang="en"><head><title>Failure</title></head><body><main><h1>Failure fixture</h1><img src="missing.png"></main></body></html>'
	);
	await writeFile(path.join(root, 'ui-scaffold', 'empty.html'), '');
	await writeFile(
		path.join(root, 'ui-scaffold', 'drafts', 'clean.css'),
		'main { display: block; }'
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
	test('parses explicit paths and validates the local port', () => {
		expect(parseAuditArgs(['ui-scaffold/drafts/clean.html', '--port', '4555'])).toEqual({
			options: { paths: ['ui-scaffold/drafts/clean.html'], port: 4555 }
		});
		expect(parseAuditArgs(['--port=0'])).toHaveProperty('error');
		expect(parseAuditArgs(['--unknown'])).toHaveProperty('error');
		expect(parseAuditArgs(['../outside.html'])).toEqual({
			options: { paths: ['../outside.html'], port: 3333 }
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

	test('audits a known failing and clean fixture in real Chromium and distinguishes empty files', async () => {
		const result = await runMockupAudit({
			port: server.port,
			rootDir: root,
			reportDir
		});
		expect(result.exitCode).toBe(1);
		expect(result.report.browser.version).not.toBe('unavailable');
		expect(
			result.report.results.find((entry) => entry.file.endsWith('clean.html'))?.status
		).toBe('passed');
		const failing = result.report.results.find((entry) => entry.file.endsWith('failure.html'));
		expect(failing?.status).toBe('violations');
		expect(failing?.violations.map((violation) => violation.id)).toContain('image-alt');
		expect(result.report.skipped).toContain('ui-scaffold/empty.html');
		expect(failing?.url).toEndWith('?clean=1');
		expect(result.report.results.every((entry) => entry.incomplete)).toBe(true);
		const json = await readFile(path.join(reportDir, 'latest.json'), 'utf8');
		const html = await readFile(path.join(reportDir, 'latest.html'), 'utf8');
		expect(json).toContain('axeVersion');
		expect(json).toContain('image-alt');
		expect(html).toContain('manual keyboard, screen-reader and responsive checks');
		expect(html).toContain('<code>img</code>');
		expect(html).not.toContain('__mockup-review-helper-host');
	});

	test('rejects explicit non-HTML and empty targets without reporting a pass', async () => {
		const nonHtml = await runMockupAudit({
			paths: ['ui-scaffold/drafts/clean.css'],
			port: server.port,
			rootDir: root,
			reportDir
		});
		expect(nonHtml.exitCode).toBe(2);
		expect(nonHtml.report.passes).toBe(0);
		const clean = await runMockupAudit({
			paths: ['ui-scaffold/drafts/clean.html'],
			port: server.port,
			rootDir: root,
			reportDir
		});
		expect(clean.exitCode).toBe(0);
		expect(clean.report.passes).toBe(1);
		const empty = await runMockupAudit({
			paths: ['ui-scaffold/empty.html'],
			port: server.port,
			rootDir: root,
			reportDir
		});
		expect(empty.exitCode).toBe(2);
		expect(empty.report.setupError).toContain('empty');
	});
});
