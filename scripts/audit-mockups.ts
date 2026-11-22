import AxeBuilder from '@axe-core/playwright';
import { chromium, type Page } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getMockupFiles, type MockupIndexEntry } from './serve-mockups';

const DEFAULT_PORT = 3333;
const REPORT_DIR = path.resolve('test-results/mockup-a11y');
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const VIEWPORT = { width: 1440, height: 900 };

/** Command-line options for a local mockup audit. */
export interface AuditCliOptions {
	/** HTML paths relative to specification/mockups; empty audits all eligible pages. */
	paths: string[];
	/** Port of the running local mockup server. */
	port: number;
}

/** A reported accessibility violation with the actionable axe fields. */
export interface MockupAuditViolation {
	id: string;
	impact: string | null;
	description: string;
	help: string;
	helpUrl: string;
	nodes: Array<{
		target: string[];
		html: string;
		failureSummary: string | null;
	}>;
}

/** One audited file, including incomplete findings and execution failures. */
export interface MockupAuditFileResult {
	file: string;
	url: string;
	status: 'passed' | 'violations' | 'error' | 'skipped';
	violations: MockupAuditViolation[];
	incomplete: Array<{ id: string; impact: string | null; help: string; helpUrl: string }>;
	error?: string;
}

/** Machine-readable evidence for one mockup audit run. */
export interface MockupAuditReport {
	runAt: string;
	server: string;
	browser: { name: string; version: string };
	viewport: typeof VIEWPORT;
	axeVersion: string;
	tags: string[];
	results: MockupAuditFileResult[];
	passes: number;
	violations: number;
	incomplete: number;
	errors: number;
	skipped: string[];
	setupError?: string;
}

/** Parses audit targets and an optional port, returning a useful error on invalid input. */
export function parseAuditArgs(argv: string[]): { options: AuditCliOptions } | { error: string } {
	const paths: string[] = [];
	let port = DEFAULT_PORT;
	for (let index = 0; index < argv.length; index++) {
		const argument = argv[index]!;
		if (argument === '--port') {
			const value = argv[++index];
			if (!value || !/^\d+$/.test(value))
				return { error: '--port requires an integer from 1 to 65535.' };
			port = Number(value);
			if (port < 1 || port > 65535)
				return { error: '--port requires an integer from 1 to 65535.' };
		} else if (argument.startsWith('--port=')) {
			const value = argument.slice('--port='.length);
			if (!/^\d+$/.test(value))
				return { error: '--port requires an integer from 1 to 65535.' };
			port = Number(value);
			if (port < 1 || port > 65535)
				return { error: '--port requires an integer from 1 to 65535.' };
		} else if (argument.startsWith('-')) return { error: `Unknown option: ${argument}` };
		else paths.push(argument);
	}
	return { options: { paths, port } };
}

function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (character) => {
		const entities: Record<string, string> = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#39;'
		};
		return entities[character]!;
	});
}

/** Renders escaped, human-readable HTML for an audit report. */
export function renderAuditReportHtml(report: MockupAuditReport): string {
	const rows = report.results
		.map((result) => {
			const violations = result.violations
				.map(
					(violation) =>
						'<li><strong>' +
						escapeHtml(violation.id) +
						'</strong> (' +
						escapeHtml(violation.impact ?? 'unknown impact') +
						'): ' +
						escapeHtml(violation.help) +
						' — <a href="' +
						escapeHtml(violation.helpUrl) +
						'">help</a><ul>' +
						violation.nodes
							.map(
								(node) =>
									'<li><code>' +
									escapeHtml(node.target.join(', ')) +
									'</code><pre>' +
									escapeHtml(node.html) +
									'</pre><p>' +
									escapeHtml(node.failureSummary ?? '') +
									'</p></li>'
							)
							.join('') +
						'</ul></li>'
				)
				.join('');
			const incomplete = result.incomplete
				.map(
					(item) =>
						'<li><strong>' +
						escapeHtml(item.id) +
						'</strong>: ' +
						escapeHtml(item.help) +
						' — <a href="' +
						escapeHtml(item.helpUrl) +
						'">help</a></li>'
				)
				.join('');
			return (
				'<section><h2>' +
				escapeHtml(result.file) +
				'</h2><p>Status: ' +
				escapeHtml(result.status) +
				'</p><p><a href="' +
				escapeHtml(result.url) +
				'">Clean preview</a></p>' +
				(result.error ? '<p class="error">' + escapeHtml(result.error) + '</p>' : '') +
				'<h3>Violations (' +
				result.violations.length +
				')</h3>' +
				(violations ? '<ul>' + violations + '</ul>' : '<p>None found.</p>') +
				'<h3>Incomplete checks requiring manual review (' +
				result.incomplete.length +
				')</h3>' +
				(incomplete ? '<ul>' + incomplete + '</ul>' : '<p>None returned.</p>') +
				'</section>'
			);
		})
		.join('');
	const setupError = report.setupError
		? '<p class="error">' + escapeHtml(report.setupError) + '</p>'
		: '';
	return (
		'<!doctype html><html lang="en"><meta charset="utf-8"><title>Mockup accessibility audit</title>' +
		'<h1>Mockup accessibility audit</h1><p>Run: ' +
		escapeHtml(report.runAt) +
		'</p><p>Server: ' +
		escapeHtml(report.server) +
		'; browser: ' +
		escapeHtml(report.browser.name + ' ' + report.browser.version) +
		'; viewport: ' +
		report.viewport.width +
		'×' +
		report.viewport.height +
		'; axe-core: ' +
		escapeHtml(report.axeVersion) +
		'</p><p>Passed files: ' +
		report.passes +
		'; violations: ' +
		report.violations +
		'; incomplete checks: ' +
		report.incomplete +
		'; errors: ' +
		report.errors +
		'; skipped empty files: ' +
		report.skipped.length +
		'</p><p>Zero automated violations do not establish WCAG conformance. Review incomplete results and complete manual keyboard, screen-reader and responsive checks.</p>' +
		setupError +
		(report.skipped.length
			? '<h2>Skipped empty files</h2><ul>' +
				report.skipped.map((file) => '<li>' + escapeHtml(file) + '</li>').join('') +
				'</ul>'
			: '') +
		rows +
		'</html>'
	);
}

function emptyReport(server: string, axeVersion: string): MockupAuditReport {
	return {
		runAt: new Date().toISOString(),
		server,
		browser: { name: 'Chromium', version: 'unavailable' },
		viewport: VIEWPORT,
		axeVersion,
		tags: AXE_TAGS,
		results: [],
		passes: 0,
		violations: 0,
		incomplete: 0,
		errors: 0,
		skipped: []
	};
}

async function getAxeVersion(): Promise<string> {
	const modulePath = fileURLToPath(import.meta.resolve('axe-core'));
	const packageJson = JSON.parse(
		await readFile(path.join(path.dirname(modulePath), 'package.json'), 'utf8')
	) as { version?: string };
	return packageJson.version ?? 'unknown';
}

function safeAuditPath(value: string): boolean {
	return (
		value.length > 0 &&
		value !== '.' &&
		value !== '..' &&
		!value.includes('/') &&
		!value.includes('\\') &&
		!value.includes('\0')
	);
}

async function extractPageResult(
	page: Page,
	file: MockupIndexEntry,
	url: string
): Promise<MockupAuditFileResult> {
	const response = await page.goto(url, { waitUntil: 'networkidle' });
	if (!response || !response.ok()) {
		return {
			file: file.filename,
			url,
			status: 'error',
			violations: [],
			incomplete: [],
			error: response
				? `Navigation returned HTTP ${response.status()}.`
				: 'Navigation returned no response.'
		};
	}
	const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
	const violations: MockupAuditViolation[] = results.violations.map((violation) => ({
		id: violation.id,
		impact: violation.impact ?? null,
		description: violation.description,
		help: violation.help,
		helpUrl: violation.helpUrl,
		nodes: violation.nodes.map((node) => ({
			target: node.target.map(String),
			html: node.html,
			failureSummary: node.failureSummary ?? null
		}))
	}));
	const incomplete = results.incomplete.map((item) => ({
		id: item.id,
		impact: item.impact ?? null,
		help: item.help,
		helpUrl: item.helpUrl
	}));
	return {
		file: file.filename,
		url,
		status: violations.length > 0 ? 'violations' : 'passed',
		violations,
		incomplete
	};
}

function updateTotals(report: MockupAuditReport): void {
	report.passes = report.results.filter((result) => result.status === 'passed').length;
	report.violations = report.results.reduce(
		(count, result) => count + result.violations.length,
		0
	);
	report.incomplete = report.results.reduce(
		(count, result) => count + result.incomplete.length,
		0
	);
	report.errors = report.results.filter((result) => result.status === 'error').length;
}

/** Audits explicit HTML files or all non-empty HTML files under a mockup root. */
export async function runMockupAudit(
	options: {
		paths?: string[];
		port?: number;
		rootDir?: string;
		reportDir?: string;
	} = {}
): Promise<{ report: MockupAuditReport; exitCode: 0 | 1 | 2 }> {
	const port = options.port ?? DEFAULT_PORT;
	const server = `http://localhost:${port}`;
	const reportDir = options.reportDir ?? REPORT_DIR;
	let axeVersion = 'unknown';
	try {
		axeVersion = await getAxeVersion();
	} catch {
		/* Keep the report available even when local package metadata is unusual. */
	}
	const report = emptyReport(server, axeVersion);
	const files = await getMockupFiles(options.rootDir);
	const fileMap = new Map(files.map((file) => [file.filename, file]));
	let selected: MockupIndexEntry[] = [];
	if (options.paths?.length) {
		for (const target of options.paths) {
			if (!safeAuditPath(target)) {
				report.setupError = `Invalid mockup filename: ${target}`;
				break;
			}
			const file = fileMap.get(target);
			if (!file) {
				report.setupError = `Not an HTML mockup file: ${target}`;
				break;
			}
			if (file.isEmpty) {
				report.setupError = `Explicit audit target is empty: ${target}`;
				break;
			}
			selected.push(file);
		}
	} else {
		report.skipped = files.filter((file) => file.isEmpty).map((file) => file.filename);
		selected = files.filter((file) => !file.isEmpty);
		if (selected.length === 0) report.setupError = 'No non-empty HTML mockups were found.';
	}
	if (!report.setupError) {
		try {
			const response = await fetch(server, { signal: AbortSignal.timeout(1500) });
			if (!response.ok) report.setupError = `Mockup server returned HTTP ${response.status}.`;
			await response.arrayBuffer();
		} catch {
			report.setupError = `Cannot reach ${server}. Start it with bun run mockups.`;
		}
	}
	if (!report.setupError) {
		let browser;
		try {
			browser = await chromium.launch({ headless: true });
			report.browser.version = browser.version();
			const context = await browser.newContext({ viewport: VIEWPORT });
			const page = await context.newPage();
			for (const file of selected) {
				const fileUrl = `${server}/${encodeURIComponent(file.filename)}?clean=1`;
				try {
					report.results.push(await extractPageResult(page, file, fileUrl));
				} catch (error) {
					report.results.push({
						file: file.filename,
						url: fileUrl,
						status: 'error',
						violations: [],
						incomplete: [],
						error: error instanceof Error ? error.message : String(error)
					});
				}
			}
			await context.close();
		} catch (error) {
			report.setupError =
				'Chromium could not start. Install the Playwright Chromium browser with bunx playwright install chromium. ' +
				(error instanceof Error ? error.message : String(error));
		} finally {
			await browser?.close().catch(() => {});
		}
	}
	updateTotals(report);
	await mkdir(reportDir, { recursive: true });
	await Promise.all([
		writeFile(path.join(reportDir, 'latest.json'), JSON.stringify(report, null, 2) + '\n'),
		writeFile(path.join(reportDir, 'latest.html'), renderAuditReportHtml(report))
	]);
	const exitCode = report.setupError ? 2 : report.violations || report.errors ? 1 : 0;
	return { report, exitCode };
}

async function main(): Promise<void> {
	const parsed = parseAuditArgs(process.argv.slice(2));
	if ('error' in parsed) {
		console.error(parsed.error);
		console.error('Usage: bun run audit:mockups [relative-path ...] [--port 3333]');
		process.exitCode = 2;
		return;
	}
	const { report, exitCode } = await runMockupAudit(parsed.options);
	console.log(`Mockup audit reports: ${path.join(REPORT_DIR, 'latest.json')} and latest.html`);
	console.log(
		`${report.passes} passed; ${report.violations} violations; ${report.incomplete} incomplete; ${report.errors} errors; ${report.skipped.length} empty files skipped.`
	);
	if (report.setupError) console.error(report.setupError);
	process.exitCode = exitCode;
}

if (import.meta.main) await main();
