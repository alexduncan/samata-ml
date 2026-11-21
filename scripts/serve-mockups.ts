import type { Server } from 'bun';
import { watch } from 'node:fs';
import { lstat, readdir, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { MOCKUPS_DIR } from './config';
import { isPathInside } from './filesystem';
import { contentTypeFromPath } from './static-server';

/** Lifecycle status declared by a mockup HTML document. */
export type MockupStatus = 'draft' | 'ready' | 'implemented';

/** Structured metadata parsed from a mockup HTML document's `<head>`. */
export interface MockupMetadata {
	/** Plain-English mockup name from `<meta name="name">` or fallback. */
	name: string;
	/** Plain-English summary of when the user encounters this UI. */
	description: string;
	/** Mockup lifecycle status (`draft`, `ready`, or `implemented`). */
	status: MockupStatus;
}

/** Catalogue entry served by `GET /index.json` for a top-level HTML mockup. */
export interface MockupIndexEntry extends MockupMetadata {
	/** Top-level filename inside `specification/mockups/`. */
	filename: string;
	/** True when the file has zero bytes. */
	isEmpty: boolean;
	/** File size in bytes. */
	size: number;
	/** ISO-8601 timestamp of the last modification. */
	mtime: string;
}

/** Parsed command-line settings for the local mockup server. */
export interface ServerCliOptions {
	/** HTTP port to listen on. */
	port: number;
	/** Hostname or IP address to bind. */
	hostname: string;
	/** Whether to launch the default browser. */
	open: boolean;
}

type ReloadClient = ReadableStreamDefaultController<Uint8Array>;

const DEFAULT_PORT = 3333;
const DEFAULT_HOSTNAME = 'localhost';
const WATCH_DEBOUNCE_MS = 150;
const TEXT_SOURCE_EXTENSION = /\.(html?|css|js|mjs|json|md|txt)$/i;
const VALID_STATUSES: ReadonlySet<string> = new Set<MockupStatus>([
	'draft',
	'ready',
	'implemented'
]);
const clients = new Set<ReloadClient>();
let reloadVersion = Date.now();

function decodeHtmlEntities(value: string): string {
	return value.replace(
		/&(amp|lt|gt|quot|#39|#x27|#\d+|#x[0-9a-f]+);/gi,
		(match, entity: string) => {
			const lower = entity.toLowerCase();
			if (lower === 'amp') return '&';
			if (lower === 'lt') return '<';
			if (lower === 'gt') return '>';
			if (lower === 'quot') return '"';
			if (lower === '#39' || lower === '#x27') return "'";
			if (lower.startsWith('#x')) {
				const codePoint = Number.parseInt(lower.slice(2), 16);
				if (Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff)
					return String.fromCodePoint(codePoint);
				return match;
			}
			if (lower.startsWith('#')) {
				const codePoint = Number.parseInt(lower.slice(1), 10);
				if (Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff)
					return String.fromCodePoint(codePoint);
				return match;
			}
			return match;
		}
	);
}

function escapeHtml(value: string): string {
	const entities: Record<string, string> = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;'
	};
	return value.replace(/[&<>"']/g, (character) => entities[character]!);
}

function escapeInlineScriptJson(value: unknown): string {
	const escapes: Record<string, string> = {
		'<': '\\u003c',
		'>': '\\u003e',
		'&': '\\u0026',
		'\u2028': '\\u2028',
		'\u2029': '\\u2029'
	};
	return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (character) => escapes[character]!);
}

/**
 * Extracts the text content of an HTML `<title>` element.
 *
 * @param html - Raw HTML document source.
 * @returns Trimmed title text, or an empty string when absent.
 */
export function extractHtmlTitle(html: string): string {
	const match = html.match(/<title\b[^>]*>([^<]+)<\/title>/i);
	return match ? decodeHtmlEntities(match[1]!).trim() : '';
}

function parseMetaAttributes(tag: string): Map<string, string> {
	const attributes = new Map<string, string>();
	const attributePattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
	for (const match of tag.matchAll(attributePattern)) {
		const attrName = match[1]!.toLowerCase();
		const attrValue = match[2] ?? match[3] ?? '';
		attributes.set(attrName, decodeHtmlEntities(attrValue));
	}
	return attributes;
}

/**
 * Parses `<meta name="name|description|status">` headers from mockup HTML with safe fallbacks.
 *
 * @param html - Raw HTML document source.
 * @param filename - Top-level mockup filename used as a last-resort name fallback.
 * @returns Normalised mockup metadata.
 */
export function extractMockupMetadata(html: string, filename: string): MockupMetadata {
	let name = '';
	let description = '';
	let rawStatus = '';
	for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
		const attrs = parseMetaAttributes(match[0]);
		const metaName = attrs.get('name')?.trim().toLowerCase();
		const content = attrs.get('content');
		if (!metaName || content === undefined) continue;
		if (metaName === 'name' && !name) name = content.trim();
		else if (metaName === 'description' && !description) description = content.trim();
		else if (metaName === 'status' && !rawStatus) rawStatus = content.trim().toLowerCase();
	}
	const fallbackTitle = extractHtmlTitle(html);
	const resolvedName = name || fallbackTitle || filename.replace(/\.html$/i, '');
	const status: MockupStatus = VALID_STATUSES.has(rawStatus)
		? (rawStatus as MockupStatus)
		: 'draft';
	return {
		name: resolvedName,
		description,
		status
	};
}

/**
 * Discovers top-level regular non-symlink `.html` mockup files directly inside a directory.
 *
 * @param dir - Absolute path to the mockups directory.
 * @returns Sorted mockup index entries with parsed `<meta>` metadata.
 */
export async function getMockupFiles(dir: string = MOCKUPS_DIR): Promise<MockupIndexEntry[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const filenames = entries
		.filter((entry) => {
			if (entry.name.startsWith('.')) return false;
			if (!entry.isFile() || entry.isSymbolicLink()) return false;
			const lower = entry.name.toLowerCase();
			return lower.endsWith('.html') && lower !== 'index.html';
		})
		.map((entry) => entry.name);

	const files = await Promise.all(
		filenames.map(async (filename): Promise<MockupIndexEntry> => {
			const filePath = path.join(dir, filename);
			const fileStat = await stat(filePath);
			const isEmpty = fileStat.size === 0;
			let html = '';
			if (!isEmpty) {
				try {
					html = await readFile(filePath, 'utf8');
				} catch {
					/* Use metadata fallbacks. */
				}
			}
			const metadata = extractMockupMetadata(html, filename);
			return {
				filename,
				...metadata,
				isEmpty,
				size: fileStat.size,
				mtime: fileStat.mtime.toISOString()
			};
		})
	);
	return files.sort((left, right) => left.filename.localeCompare(right.filename, 'en'));
}

/**
 * Parses command-line arguments and the `PORT` environment variable.
 *
 * @param argv - Raw CLI argument slice (typically `process.argv.slice(2)`).
 * @returns Resolved server binding and browser-launch options.
 */
export function parseCliArgs(argv: string[]): ServerCliOptions {
	const envPort = Number.parseInt(process.env.PORT ?? '', 10);
	let port = Number.isInteger(envPort) && envPort >= 0 ? envPort : DEFAULT_PORT;
	let hostname = DEFAULT_HOSTNAME;
	let open = false;
	for (let index = 0; index < argv.length; index++) {
		const argument = argv[index];
		if (argument === '--port' || argument === '-p') {
			const candidate = Number.parseInt(argv[++index] ?? '', 10);
			if (Number.isInteger(candidate) && candidate >= 0 && candidate <= 65535)
				port = candidate;
		} else if (argument?.startsWith('--port=')) {
			const candidate = Number.parseInt(argument.slice('--port='.length), 10);
			if (Number.isInteger(candidate) && candidate >= 0 && candidate <= 65535)
				port = candidate;
		} else if (argument === '--host' || argument === '-h') hostname = argv[++index] ?? hostname;
		else if (argument === '--open' || argument === '-o') open = true;
	}
	return { port, hostname, open };
}

/**
 * Renders the `/` mockup catalogue document backed by `GET /index.json`.
 *
 * @returns Complete HTML5 index document linking `/mockups.css`.
 */
export function renderIndexHtml(): string {
	const script = `(() => {
	const queryInput = document.getElementById('query');
	const statusSelect = document.getElementById('status-filter');
	const resultsCount = document.getElementById('results-count');
	const tbody = document.querySelector('table.mockups tbody');
	let allEntries = [];

	const renderRows = () => {
		const query = (queryInput ? queryInput.value : '').trim().toLowerCase();
		const status = statusSelect ? statusSelect.value : 'all';
		const filtered = allEntries.filter((entry) => {
			if (status !== 'all' && entry.status !== status) return false;
			if (!query) return true;
			return (
				entry.name.toLowerCase().includes(query) ||
				entry.filename.toLowerCase().includes(query) ||
				entry.description.toLowerCase().includes(query)
			);
		});
		if (resultsCount) {
			resultsCount.textContent =
				'Showing ' + filtered.length + ' of ' + allEntries.length + ' mockups';
		}
		if (!tbody) return;
		tbody.replaceChildren();
		if (filtered.length === 0) {
			const tr = document.createElement('tr');
			const td = document.createElement('td');
			td.setAttribute('colspan', '4');
			td.textContent = 'No mockups match your filter.';
			tr.append(td);
			tbody.append(tr);
			return;
		}
		for (const entry of filtered) {
			const encoded = encodeURIComponent(entry.filename);
			const tr = document.createElement('tr');

			const nameCell = document.createElement('td');
			const nameLink = document.createElement('a');
			nameLink.setAttribute('href', '/' + encoded);
			nameLink.textContent = entry.name;
			const br = document.createElement('br');
			const small = document.createElement('small');
			small.textContent = entry.filename;
			nameCell.append(nameLink, br, small);

			const descCell = document.createElement('td');
			descCell.textContent = entry.description;

			const statusCell = document.createElement('td');
			const statusBadge = document.createElement('span');
			statusBadge.setAttribute('class', 'mockup-status mockup-status-' + entry.status);
			statusBadge.textContent = entry.status;
			statusCell.append(statusBadge);

			const actionsCell = document.createElement('td');
			const sourceLink = document.createElement('a');
			sourceLink.setAttribute('href', '/__source/' + encoded);
			sourceLink.textContent = 'View source';
			const cleanLink = document.createElement('a');
			cleanLink.setAttribute('href', '/' + encoded + '?clean=1');
			cleanLink.textContent = 'Clean preview';
			actionsCell.append(sourceLink, document.createTextNode(' '), cleanLink);

			tr.append(nameCell, descCell, statusCell, actionsCell);
			tbody.append(tr);
		}
	};

	if (queryInput) queryInput.addEventListener('input', renderRows);
	if (statusSelect) statusSelect.addEventListener('change', renderRows);

	fetch('/index.json', { cache: 'no-store' })
		.then((response) => {
			if (!response.ok) throw new Error('HTTP ' + response.status);
			return response.json();
		})
		.then((entries) => {
			allEntries = Array.isArray(entries) ? entries : [];
			renderRows();
		})
		.catch(() => {
			if (resultsCount) resultsCount.textContent = 'Failed to load mockups.';
		});

	const connect = () => {
		const source = new EventSource('/__hmr');
		source.onmessage = (event) => {
			if (event.data === 'reload') location.reload();
		};
		source.onerror = () => {
			source.close();
			setTimeout(connect, 1000);
		};
	};
	connect();
})();`;

	return (
		'<!doctype html>\n' +
		'<html lang="en">\n' +
		'\t<head>\n' +
		'\t\t<meta charset="utf-8" />\n' +
		'\t\t<meta name="viewport" content="width=device-width, initial-scale=1" />\n' +
		'\t\t<title>Mockup review catalogue — samatā.ml</title>\n' +
		'\t\t<link rel="stylesheet" href="/mockups.css" />\n' +
		'\t</head>\n' +
		'\t<body class="mockup-index">\n' +
		'\t\t<header>\n' +
		'\t\t\t<h1>Mockup review</h1>\n' +
		'\t\t\t<p>Browse HTML mockups in specification/mockups/.</p>\n' +
		'\t\t</header>\n' +
		'\t\t<main id="catalogue">\n' +
		'\t\t\t<div class="mockup-filters">\n' +
		'\t\t\t\t<label for="query">Search mockups</label>\n' +
		'\t\t\t\t<input id="query" name="q" type="search" placeholder="Search by name, filename, or description" />\n' +
		'\t\t\t\t<label for="status-filter">Status</label>\n' +
		'\t\t\t\t<select id="status-filter" name="status">\n' +
		'\t\t\t\t\t<option value="all" selected>All statuses</option>\n' +
		'\t\t\t\t\t<option value="draft">Draft</option>\n' +
		'\t\t\t\t\t<option value="ready">Ready</option>\n' +
		'\t\t\t\t\t<option value="implemented">Implemented</option>\n' +
		'\t\t\t\t</select>\n' +
		'\t\t\t</div>\n' +
		'\t\t\t<p id="results-count" aria-live="polite"></p>\n' +
		'\t\t\t<table class="mockups">\n' +
		'\t\t\t\t<thead>\n' +
		'\t\t\t\t\t<tr>\n' +
		'\t\t\t\t\t\t<th scope="col">Name</th>\n' +
		'\t\t\t\t\t\t<th scope="col">Description</th>\n' +
		'\t\t\t\t\t\t<th scope="col">Status</th>\n' +
		'\t\t\t\t\t\t<th scope="col">Actions</th>\n' +
		'\t\t\t\t\t</tr>\n' +
		'\t\t\t\t</thead>\n' +
		'\t\t\t\t<tbody></tbody>\n' +
		'\t\t\t</table>\n' +
		'\t\t</main>\n' +
		'\t\t<script>' +
		script +
		'</script>\n' +
		'\t</body>\n' +
		'</html>\n'
	);
}

/**
 * Injects `/mockups.css` into `<head>` and the light-DOM `#__mockup-review-helper-host`
 * review bar plus live-reload script immediately before `</body>`.
 *
 * @param html - Original HTML document source.
 * @param entry - Parsed catalogue metadata for the previewed mockup.
 * @returns Preview HTML with helper stylesheet, navigation bar, and HMR listener.
 */
export function injectPreviewHelper(html: string, entry: MockupIndexEntry): string {
	const stylesheetLink = '<link rel="stylesheet" href="/mockups.css" />';
	const withStylesheet = /<\/head>/i.test(html)
		? html.replace(/<\/head>/i, (closing) => stylesheetLink + '\n' + closing)
		: stylesheetLink + '\n' + html;

	const safeStatus = VALID_STATUSES.has(entry.status) ? entry.status : 'draft';
	const helperHtml =
		'<div id="__mockup-review-helper-host">\n' +
		'\t<div id="mockup-details">\n' +
		'\t\t<h4 class="mockup-name">\n' +
		'\t\t\t' +
		escapeHtml(entry.name) +
		'\n' +
		'\t\t\t<span class="mockup-status mockup-status-' +
		safeStatus +
		'">' +
		safeStatus +
		'</span>\n' +
		'\t\t</h4>\n' +
		'\t\t<p class="mockup-description">' +
		escapeHtml(entry.description) +
		'</p>\n' +
		'\t</div>\n' +
		'\t<nav id="mockup-controls" aria-label="Mockup review">\n' +
		'\t\t<select id="preview-page"></select>\n' +
		'\t\t<a href="/" class="index-link">\n' +
		'\t\t\t<svg\n' +
		'\t\t\t\tclass="index-link-icon"\n' +
		'\t\t\t\txmlns="http://www.w3.org/2000/svg"\n' +
		'\t\t\t\twidth="24"\n' +
		'\t\t\t\theight="24"\n' +
		'\t\t\t\tviewBox="0 0 24 24"\n' +
		'\t\t\t\tfill="none"\n' +
		'\t\t\t\tstroke="currentColor"\n' +
		'\t\t\t\tstroke-width="1.5"\n' +
		'\t\t\t\tstroke-linecap="round"\n' +
		'\t\t\t\tstroke-linejoin="round">\n' +
		'\t\t\t\t<path d="M14 3v4a1 1 0 0 0 1 1h4" />\n' +
		'\t\t\t\t<path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2" />\n' +
		'\t\t\t\t<path d="M9 9l1 0" />\n' +
		'\t\t\t\t<path d="M9 13l6 0" />\n' +
		'\t\t\t\t<path d="M9 17l6 0" />\n' +
		'\t\t\t</svg>\n' +
		'\t\t\t<span class="index-link-text">Index</span>\n' +
		'\t\t</a>\n' +
		'\t</nav>\n' +
		'</div>';

	const currentFileJson = escapeInlineScriptJson(entry.filename);
	const helperScript =
		'<script>(() => {' +
		'const currentFile = ' +
		currentFileJson +
		';' +
		'const select = document.getElementById("preview-page");' +
		'if (select) {' +
		'fetch("/index.json", { cache: "no-store" })' +
		'.then((response) => (response.ok ? response.json() : []))' +
		'.then((items) => {' +
		'if (!Array.isArray(items)) return;' +
		'select.replaceChildren();' +
		'for (const item of items) {' +
		'const option = document.createElement("option");' +
		'option.value = item.filename;' +
		'option.textContent = item.name + " (" + item.filename + ")";' +
		'option.selected = item.filename === currentFile;' +
		'select.append(option);' +
		'}' +
		'})' +
		'.catch(() => {});' +
		'select.addEventListener("change", () => {' +
		'if (select.value && select.value !== currentFile) {' +
		'window.location.assign("/" + encodeURIComponent(select.value));' +
		'}' +
		'});' +
		'}' +
		'const connect = () => {' +
		'const source = new EventSource("/__hmr");' +
		'source.onmessage = (event) => { if (event.data === "reload") location.reload(); };' +
		'source.onerror = () => { source.close(); setTimeout(connect, 1000); };' +
		'};' +
		'connect();' +
		'})();</script>';

	const footerBlock = helperHtml + '\n' + helperScript;
	return /<\/body>/i.test(withStylesheet)
		? withStylesheet.replace(/<\/body>/i, (closing) => footerBlock + '\n' + closing)
		: withStylesheet + '\n' + footerBlock;
}

function sendReload(): void {
	reloadVersion = Date.now();
	const message = new TextEncoder().encode(
		'event: message\ndata: reload\nid: ' + reloadVersion + '\n\n'
	);
	for (const client of clients) {
		try {
			client.enqueue(message);
		} catch {
			clients.delete(client);
		}
	}
}

function createReloadStream(): Response {
	let client: ReloadClient | undefined;
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			client = controller;
			clients.add(controller);
			controller.enqueue(
				new TextEncoder().encode(
					'event: message\ndata: connected\nid: ' + reloadVersion + '\n\n'
				)
			);
		},
		cancel() {
			if (client) clients.delete(client);
		}
	});
	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive'
		}
	});
}

function startWatcher(rootDir: string): () => void {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const watcher = watch(rootDir, { recursive: true }, (eventType, filename) => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			console.log(
				'[mockups] Change detected (' +
					eventType +
					'): ' +
					(filename ?? 'file') +
					'; reloading previews.'
			);
			sendReload();
		}, WATCH_DEBOUNCE_MS);
	});
	return () => {
		if (timer) clearTimeout(timer);
		watcher.close();
	};
}

function noStoreHeaders(contentType?: string): Headers {
	const headers = new Headers({ 'Cache-Control': 'no-store' });
	if (contentType) headers.set('Content-Type', contentType);
	return headers;
}

function missingFile(relativePath: string): Response {
	return new Response(
		'<!doctype html><html lang="en"><meta charset="utf-8"><title>404 Not Found</title><body><h1>404 Not Found</h1><p>Could not find <code>' +
			escapeHtml(relativePath) +
			'</code>.</p><p><a href="/">Back to the mockup catalogue</a></p></body></html>',
		{ status: 404, headers: noStoreHeaders('text/html; charset=utf-8') }
	);
}

function badRequest(message: string, status: 400 | 403): Response {
	return new Response(escapeHtml(message), {
		status,
		headers: noStoreHeaders('text/plain; charset=utf-8')
	});
}

function decodePath(pathname: string): string[] | Response {
	let segments: string[];
	try {
		segments = pathname.split('/').filter(Boolean).map(decodeURIComponent);
	} catch {
		return badRequest('Malformed URL encoding', 400);
	}
	if (segments.some((segment) => segment.includes('\0')))
		return badRequest('Malformed path', 400);
	if (
		segments.some(
			(segment) =>
				segment === '.' ||
				segment === '..' ||
				segment.includes('\\') ||
				segment.includes('/')
		)
	) {
		return badRequest('Forbidden path', 403);
	}
	return segments;
}

async function resolveRegularFile(
	rootDir: string,
	relativePath: string
): Promise<string | Response> {
	const resolved = path.resolve(rootDir, ...relativePath.split('/'));
	if (!isPathInside(rootDir, resolved)) return badRequest('Forbidden path', 403);
	let cursor = rootDir;
	for (const segment of relativePath.split('/')) {
		cursor = path.join(cursor, segment);
		try {
			const info = await lstat(cursor);
			if (info.isSymbolicLink()) return badRequest('Symbolic links are not served', 403);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT')
				return missingFile(relativePath);
			throw error;
		}
	}
	const info = await stat(resolved);
	if (!info.isFile()) return missingFile(relativePath);
	const rootReal = await realpath(rootDir);
	const fileReal = await realpath(resolved);
	if (!isPathInside(rootReal, fileReal)) return badRequest('Forbidden path', 403);
	return resolved;
}

/**
 * Starts the read-only local mockup server.
 *
 * @param customOptions - Optional server, root and watcher settings for fixtures.
 * @returns The running Bun server.
 */
export async function startMockupsServer(
	customOptions?: Partial<ServerCliOptions> & { enableWatcher?: boolean; rootDir?: string }
): Promise<Server<any>> {
	const parsed = parseCliArgs(process.argv.slice(2));
	const options = {
		port: customOptions?.port ?? parsed.port,
		hostname: customOptions?.hostname ?? parsed.hostname,
		open: customOptions?.open ?? parsed.open
	};
	const rootDir = path.resolve(customOptions?.rootDir ?? MOCKUPS_DIR);
	const enableWatcher = customOptions?.enableWatcher ?? true;
	let stopWatcher = () => {};
	const server = Bun.serve({
		port: options.port,
		hostname: options.hostname,
		async fetch(request, bunServer) {
			const url = new URL(request.url);
			if (request.method !== 'GET' && request.method !== 'HEAD') {
				const headers = noStoreHeaders('text/plain; charset=utf-8');
				headers.set('Allow', 'GET, HEAD');
				return new Response('Method not allowed', { status: 405, headers });
			}
			if (url.pathname === '/__hmr') {
				bunServer?.timeout(request, 0);
				return createReloadStream();
			}
			if (url.pathname === '/' || url.pathname === '/index.html') {
				return new Response(request.method === 'HEAD' ? null : renderIndexHtml(), {
					headers: noStoreHeaders('text/html; charset=utf-8')
				});
			}
			if (url.pathname === '/index.json') {
				const entries = await getMockupFiles(rootDir);
				return new Response(request.method === 'HEAD' ? null : JSON.stringify(entries), {
					headers: noStoreHeaders('application/json; charset=utf-8')
				});
			}
			const decoded = decodePath(url.pathname);
			if (decoded instanceof Response) return decoded;
			let mode: 'file' | 'source' = 'file';
			let relativePath: string;
			if (decoded[0] === '__source') {
				mode = 'source';
				relativePath = decoded.slice(1).join('/');
			} else {
				relativePath = decoded.join('/');
			}
			if (!relativePath) return missingFile('');
			const resolved = await resolveRegularFile(rootDir, relativePath);
			if (resolved instanceof Response) return resolved;
			const file = Bun.file(resolved);
			if (mode === 'source') {
				if (!TEXT_SOURCE_EXTENSION.test(relativePath)) {
					return new Response('Source view is available for text files only.', {
						status: 415,
						headers: noStoreHeaders('text/plain; charset=utf-8')
					});
				}
				const headers = noStoreHeaders('text/plain; charset=utf-8');
				headers.set('X-Content-Type-Options', 'nosniff');
				return new Response(request.method === 'HEAD' ? null : file, { headers });
			}
			if (relativePath.toLowerCase().endsWith('.html')) {
				const bytes = new Uint8Array(await file.arrayBuffer());
				if (url.searchParams.get('clean') === '1') {
					return new Response(request.method === 'HEAD' ? null : bytes, {
						headers: noStoreHeaders('text/html; charset=utf-8')
					});
				}
				const html = new TextDecoder().decode(bytes);
				const fileStat = await stat(resolved);
				const entry: MockupIndexEntry = {
					filename: relativePath,
					...extractMockupMetadata(html, relativePath),
					isEmpty: bytes.byteLength === 0,
					size: bytes.byteLength,
					mtime: fileStat.mtime.toISOString()
				};
				return new Response(
					request.method === 'HEAD' ? null : injectPreviewHelper(html, entry),
					{ headers: noStoreHeaders('text/html; charset=utf-8') }
				);
			}
			return new Response(request.method === 'HEAD' ? null : file, {
				headers: noStoreHeaders(contentTypeFromPath(resolved))
			});
		}
	});
	if (enableWatcher) stopWatcher = startWatcher(rootDir);
	const originalStop = server.stop.bind(server);
	server.stop = (closeActive?: boolean) => {
		stopWatcher();
		for (const client of clients) {
			try {
				client.close();
			} catch {
				/* Already closed. */
			}
			clients.delete(client);
		}
		return originalStop(closeActive);
	};
	const baseUrl = 'http://' + options.hostname + ':' + server.port;
	console.log('\nMockup review server: ' + baseUrl + '/');
	console.log('Mockup root: ' + rootDir);
	console.log('Live reload ' + (enableWatcher ? 'enabled' : 'disabled') + '.');
	if (options.open) {
		const command =
			process.platform === 'darwin'
				? 'open'
				: process.platform === 'win32'
					? 'start'
					: 'xdg-open';
		Bun.spawn([command, baseUrl + '/']);
	}
	return server;
}

if (import.meta.main) await startMockupsServer();
