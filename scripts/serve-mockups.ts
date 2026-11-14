import type { Server } from 'bun';
import { watch } from 'node:fs';
import { lstat, readdir, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { MOCKUPS_DIR } from './config';
import { isPathInside } from './filesystem';
import { contentTypeFromPath } from './static-server';

/** Metadata for a regular file discovered beneath the mockups root. */
export interface MockupFileInfo {
	/** POSIX path relative to the mockups root. */
	relativePath: string;
	/** Extracted HTML title or a path-derived fallback. */
	title: string;
	/** File size in bytes. */
	size: number;
	/** True when the file has no bytes. */
	isEmpty: boolean;
	/** Timestamp of the last modification. */
	mtime: Date;
	/** Broad file category used by the catalogue. */
	kind: 'html' | 'css' | 'asset';
	/** True when the file is under ui-scaffold/drafts/. */
	isDraft: boolean;
	/** Matching reference path when a draft has an exact counterpart. */
	counterpartPath?: string;
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
type CatalogueFilter = 'all' | 'needs-styling' | 'html' | 'css' | 'assets' | 'empty';

const DEFAULT_PORT = 3333;
const DEFAULT_HOSTNAME = 'localhost';
const WATCH_DEBOUNCE_MS = 150;
const TEXT_SOURCE_EXTENSION = /\.(html?|css|js|mjs|json|md|txt)$/i;
const clients = new Set<ReloadClient>();
let reloadVersion = Date.now();

/** Formats a raw byte count into human-readable units. */
export function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB'];
	const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
	return parseFloat((bytes / 1024 ** index).toFixed(1)) + ' ' + units[index];
}

/** Extracts the text content of an HTML title element. */
export function extractHtmlTitle(html: string): string {
	const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
	return match ? match[1]!.trim() : '';
}

/**
 * Recursively discovers regular files beneath the mockups root.
 *
 * @param dir - Absolute path to the mockups root.
 * @returns Sorted file metadata.
 */
export async function getMockupFiles(dir: string = MOCKUPS_DIR): Promise<MockupFileInfo[]> {
	const relativePaths: string[] = [];
	const visit = async (directory: string, prefix = ''): Promise<void> => {
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			if (entry.name.startsWith('.')) continue;
			const relativePath = prefix ? prefix + '/' + entry.name : entry.name;
			if (entry.isDirectory()) await visit(path.join(directory, entry.name), relativePath);
			else if (entry.isFile()) relativePaths.push(relativePath);
		}
	};
	await visit(dir);
	const discovered = new Set(relativePaths);
	const files = await Promise.all(
		relativePaths.map(async (relativePath): Promise<MockupFileInfo> => {
			const filePath = path.join(dir, ...relativePath.split('/'));
			const fileStat = await stat(filePath);
			const lowerPath = relativePath.toLowerCase();
			const kind = lowerPath.endsWith('.html')
				? 'html'
				: lowerPath.endsWith('.css')
					? 'css'
					: 'asset';
			let title = '';
			if (kind === 'html' && fileStat.size > 0) {
				try {
					title = extractHtmlTitle(await readFile(filePath, 'utf8'));
				} catch {
					/* Use fallback. */
				}
			}
			const isDraft = relativePath.startsWith('ui-scaffold/drafts/');
			const counterpartPath = isDraft
				? relativePath.replace('ui-scaffold/drafts/', 'ui-scaffold/')
				: undefined;
			return {
				relativePath,
				title:
					title ||
					path.posix
						.basename(relativePath)
						.replace(/\.[^.]+$/, '')
						.replace(/[_-]/g, ' '),
				size: fileStat.size,
				isEmpty: fileStat.size === 0,
				mtime: fileStat.mtime,
				kind,
				isDraft,
				...(kind === 'html' && counterpartPath && discovered.has(counterpartPath)
					? { counterpartPath }
					: {})
			};
		})
	);
	return files.sort((left, right) =>
		left.relativePath.localeCompare(right.relativePath, undefined, { numeric: true })
	);
}

/** Parses command-line arguments and the PORT environment variable. */
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

function encodePath(relativePath: string): string {
	return relativePath.split('/').map(encodeURIComponent).join('/');
}

function fileUrl(relativePath: string): string {
	return '/files/' + encodePath(relativePath);
}
function sourceUrl(relativePath: string): string {
	return '/__source/' + encodePath(relativePath);
}

function matchesFilter(file: MockupFileInfo, filter: CatalogueFilter): boolean {
	if (filter === 'needs-styling') return file.kind === 'html' && file.isDraft;
	if (filter === 'html') return file.kind === 'html';
	if (filter === 'css') return file.kind === 'css';
	if (filter === 'assets') return file.kind === 'asset';
	if (filter === 'empty') return file.isEmpty;
	return true;
}

function renderFileItem(file: MockupFileInfo, files: MockupFileInfo[]): string {
	const type =
		file.kind === 'html'
			? file.isDraft
				? 'Draft — needs styling'
				: 'Reference'
			: file.kind.toUpperCase() + ' resource';
	const openLink =
		file.kind === 'html'
			? '<p><a href="' +
				fileUrl(file.relativePath) +
				'">Preview: ' +
				escapeHtml(file.relativePath) +
				'</a></p><p><a href="' +
				fileUrl(file.relativePath) +
				'?clean=1">Clean preview: ' +
				escapeHtml(file.relativePath) +
				'</a></p>'
			: '<p><a href="' +
				fileUrl(file.relativePath) +
				'">Open file: ' +
				escapeHtml(file.relativePath) +
				'</a></p>';
	const source = TEXT_SOURCE_EXTENSION.test(file.relativePath)
		? '<p><a href="' +
			sourceUrl(file.relativePath) +
			'">View source: ' +
			escapeHtml(file.relativePath) +
			'</a></p>'
		: '';
	let counterpart = '';
	if (file.counterpartPath) {
		const counterpartFile = files.find((entry) => entry.relativePath === file.counterpartPath);
		counterpart =
			'<p><a href="' +
			fileUrl(file.counterpartPath) +
			'">Compare with reference: ' +
			escapeHtml(file.counterpartPath) +
			(counterpartFile?.isEmpty ? ' (empty)' : '') +
			'</a></p>';
	}
	const modified = file.mtime.toLocaleString('en-GB', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		timeZoneName: 'short'
	});
	return (
		'<li><a href="' +
		fileUrl(file.relativePath) +
		'"><code>' +
		escapeHtml(file.relativePath) +
		'</code></a>' +
		'<p>' +
		escapeHtml(file.title) +
		'. ' +
		type +
		(file.isEmpty ? ' — empty (0 B)' : '') +
		'. ' +
		formatBytes(file.size) +
		'. Modified <time datetime="' +
		file.mtime.toISOString() +
		'">' +
		escapeHtml(modified) +
		'</time>.</p>' +
		openLink +
		source +
		counterpart +
		'</p></li>'
	);
}

/** Renders the native searchable catalogue without application styles. */
export function renderIndexHtml(
	files: MockupFileInfo[],
	query = '',
	requestedFilter = 'all'
): string {
	const options: Array<[CatalogueFilter, string]> = [
		['all', 'All files'],
		['needs-styling', 'Needs styling'],
		['html', 'HTML'],
		['css', 'CSS'],
		['assets', 'Other resources'],
		['empty', 'Empty files']
	];
	const filter = options.some(([value]) => value === requestedFilter)
		? (requestedFilter as CatalogueFilter)
		: 'all';
	const normalizedQuery = query.trim().toLocaleLowerCase();
	const matches = files.filter(
		(file) =>
			matchesFilter(file, filter) &&
			(!normalizedQuery ||
				file.relativePath.toLocaleLowerCase().includes(normalizedQuery) ||
				file.title.toLocaleLowerCase().includes(normalizedQuery))
	);
	const drafts = matches.filter((file) => file.kind === 'html' && file.isDraft);
	const references = matches.filter((file) => file.kind === 'html' && !file.isDraft);
	const resources = matches.filter((file) => file.kind !== 'html');
	const list = (items: MockupFileInfo[]) =>
		items.length
			? '<ul>' + items.map((file) => renderFileItem(file, files)).join('') + '</ul>'
			: '<p>No files in this group.</p>';
	const section = (id: string, heading: string, items: MockupFileInfo[]) =>
		'<section' +
		(id ? ' id="' + id + '"' : '') +
		'><h2>' +
		heading +
		'</h2>' +
		list(items) +
		'</section>';
	const filterOptions = options
		.map(
			([value, label]) =>
				'<option value="' +
				value +
				'"' +
				(value === filter ? ' selected' : '') +
				'>' +
				label +
				'</option>'
		)
		.join('');
	const noResults = matches.length
		? ''
		: '<p>No files match these filters. <a href="/">Reset filters</a>.</p>';
	return (
		'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
		'<title>Mockup review catalogue — samatā.ml</title><style>:where(*) { box-sizing: border-box; max-inline-size: 100%; overflow-wrap: anywhere; }</style></head><body>' +
		'<header><h1>Mockup review</h1><p>Browse every file in specification/mockups. Drafts need human styling.</p></header>' +
		'<main id="catalogue"><form role="search" action="/" method="get"><label for="query">Search paths and titles</label>' +
		'<input id="query" name="q" type="search" value="' +
		escapeHtml(query) +
		'"><label for="filter">Show files</label>' +
		'<select id="filter" name="filter">' +
		filterOptions +
		'</select><button type="submit">Apply filters</button> <a href="/">Reset filters</a></form>' +
		'<p>Showing ' +
		matches.length +
		' of ' +
		files.length +
		' files. A reference file is not evidence of review approval.</p>' +
		noResults +
		section('needs-styling', 'Needs styling', drafts) +
		section('', 'References', references) +
		section('resources', 'Resources', resources) +
		'<section><h2>Review workflow</h2><p>Edit local HTML and CSS in your editor. Save DevTools experiments to disk before live reload.</p>' +
		'<p>Run <code>bun run audit:mockups ui-scaffold/drafts/03-0_models-overview.html</code> with the mockup server running. Automated results need manual keyboard, screen-reader and responsive checks.</p>' +
		'<p>Request markup changes with a file path, section, current problem, desired change and affected states. Human promotion and application integration are separate steps.</p></section></main>' +
		'<script>(() => { const connect = () => { const source = new EventSource("/__hmr"); source.onmessage = (event) => { if (event.data === "reload") location.reload(); }; source.onerror = () => { source.close(); setTimeout(connect, 1000); }; }; connect(); })();</script></body></html>'
	);
}

/**
 * Adds a normal-flow, open-shadow-root helper to an HTML preview.
 *
 * @param html - Original HTML source.
 * @param relativePath - POSIX path relative to the mockups root.
 * @param allFiles - Current mockup inventory.
 * @returns HTML containing preview controls and live reload.
 */
export function injectPreviewHelper(
	html: string,
	relativePath: string,
	allFiles: MockupFileInfo[]
): string {
	const current = allFiles.find((file) => file.relativePath === relativePath);
	const payload = {
		relativePath,
		isDraft: current?.isDraft ?? relativePath.startsWith('ui-scaffold/drafts/'),
		isEmpty: current?.isEmpty ?? html.length === 0,
		counterpartPath: current?.counterpartPath,
		files: allFiles
			.filter((file) => file.kind === 'html')
			.map((file) => ({ relativePath: file.relativePath, isEmpty: file.isEmpty }))
	};
	const dataId = '__mockup-review-data-' + crypto.randomUUID();
	const escapes: Record<string, string> = {
		'<': '\\u003c',
		'>': '\\u003e',
		'&': '\\u0026',
		'\u2028': '\\u2028',
		'\u2029': '\\u2029'
	};
	const json = JSON.stringify(payload).replace(
		/[<>&\u2028\u2029]/g,
		(character) => escapes[character]!
	);
	const helper =
		'<script type="application/json" id="' +
		dataId +
		'">' +
		json +
		'</script><script>(() => {' +
		'const dataNode = document.getElementById("' +
		dataId +
		'"); const data = JSON.parse(dataNode.textContent || "{}"); dataNode.remove();' +
		'const host = document.createElement("div"); host.id = "__mockup-review-helper-host"; const shadow = host.attachShadow({mode:"open"});' +
		'const style = document.createElement("style"); style.textContent = ":host{display:block;max-inline-size:100%;box-sizing:border-box;overflow-wrap:anywhere}*{max-inline-size:100%;box-sizing:border-box;overflow-wrap:anywhere}"; shadow.append(style);' +
		'const nav = document.createElement("nav"); nav.id = "preview-controls"; nav.setAttribute("aria-label","Mockup review");' +
		'const status = document.createElement("p"); status.textContent = data.relativePath + " — " + (data.isDraft ? "Draft — needs styling" : "Reference"); nav.append(status);' +
		'const addLink = (label, href) => { const a = document.createElement("a"); a.textContent = label; a.href = href; nav.append(a); };' +
		'const encode = (value) => value.split("/").map(encodeURIComponent).join("/"); addLink("Catalogue","/"); addLink("Source","/__source/" + encode(data.relativePath)); addLink("Clean preview","/files/" + encode(data.relativePath) + "?clean=1");' +
		'if (data.counterpartPath) addLink("Compare with reference: " + data.counterpartPath, "/files/" + encode(data.counterpartPath));' +
		'if (data.isEmpty) { const p = document.createElement("p"); p.textContent = "This HTML file is empty."; nav.append(p); }' +
		'const label = document.createElement("label"); label.htmlFor = "preview-page"; label.textContent = "Preview HTML file"; const select = document.createElement("select"); select.id = "preview-page";' +
		'for (const file of data.files) { const option = document.createElement("option"); option.value = "/files/" + encode(file.relativePath); option.textContent = file.relativePath + (file.isEmpty ? " (empty)" : ""); option.selected = file.relativePath === data.relativePath; select.append(option); }' +
		'const go = document.createElement("button"); go.type = "button"; go.textContent = "Go"; go.addEventListener("click", () => window.location.assign(select.value)); nav.append(label,select,go); shadow.append(nav);' +
		'const source = new EventSource("/__hmr"); source.onmessage = (event) => { if (event.data === "reload") location.reload(); }; source.onerror = () => { source.close(); setTimeout(() => location.reload(),1000); };' +
		'const install = () => { const main = document.querySelector("main"); if (main) main.prepend(host); else if (document.body) document.body.prepend(host); else document.documentElement.append(host); };' +
		'if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",install,{once:true}); else install(); })();</script>';
	const bodyOpen = /<body\b[^>]*>/i;
	return bodyOpen.test(html)
		? html.replace(bodyOpen, (opening) => opening + helper)
		: helper + html;
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
			if (request.method !== 'GET' && request.method !== 'HEAD')
				return new Response('Method not allowed', {
					status: 405,
					headers: { Allow: 'GET, HEAD' }
				});
			if (url.pathname === '/__hmr') {
				bunServer?.timeout(request, 0);
				return createReloadStream();
			}
			if (url.pathname === '/' || url.pathname === '/index.html') {
				const files = await getMockupFiles(rootDir);
				return new Response(
					renderIndexHtml(
						files,
						url.searchParams.get('q') ?? '',
						url.searchParams.get('filter') ?? 'all'
					),
					{ headers: noStoreHeaders('text/html; charset=utf-8') }
				);
			}
			const decoded = decodePath(url.pathname);
			if (decoded instanceof Response) return decoded;
			let mode: 'file' | 'source' = 'file';
			let relativePath: string;
			if (decoded[0] === 'files' || decoded[0] === '__source') {
				mode = decoded[0] === '__source' ? 'source' : 'file';
				relativePath = decoded.slice(1).join('/');
			} else {
				const oldPath = decoded.join('/');
				if (
					oldPath === 'specification/mockups' ||
					oldPath === 'specification/mockups/index.html'
				)
					return Response.redirect(new URL('/' + url.search, url), 302);
				if (oldPath.startsWith('specification/mockups/'))
					relativePath = oldPath.slice('specification/mockups/'.length);
				else if (oldPath.startsWith('ui-scaffold/')) relativePath = oldPath;
				else if (oldPath.startsWith('drafts/')) relativePath = 'ui-scaffold/' + oldPath;
				else relativePath = 'ui-scaffold/' + oldPath;
				if (!relativePath || relativePath === 'index.html')
					return Response.redirect(new URL('/' + url.search, url), 302);
				return Response.redirect(
					new URL('/files/' + encodePath(relativePath) + url.search, url),
					302
				);
			}
			if (!relativePath) return missingFile('');
			const resolved = await resolveRegularFile(rootDir, relativePath);
			if (resolved instanceof Response) return resolved;
			const file = Bun.file(resolved);
			if (mode === 'source') {
				if (!TEXT_SOURCE_EXTENSION.test(relativePath))
					return new Response('Source view is available for text files only.', {
						status: 415,
						headers: noStoreHeaders('text/plain; charset=utf-8')
					});
				const headers = noStoreHeaders('text/plain; charset=utf-8');
				headers.set('X-Content-Type-Options', 'nosniff');
				return new Response(request.method === 'HEAD' ? null : file, { headers });
			}
			if (relativePath.toLowerCase().endsWith('.html')) {
				const bytes = new Uint8Array(await file.arrayBuffer());
				if (url.searchParams.get('clean') === '1')
					return new Response(request.method === 'HEAD' ? null : bytes, {
						headers: noStoreHeaders('text/html; charset=utf-8')
					});
				const currentFiles = await getMockupFiles(rootDir);
				return new Response(
					injectPreviewHelper(
						new TextDecoder().decode(bytes),
						relativePath,
						currentFiles
					),
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
