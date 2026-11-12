import type { Server } from 'bun';
import { watch } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { UI_SCAFFOLD_DIR } from './config';
import { isPathInside } from './filesystem';
import { contentTypeFromPath } from './static-server';

/**
 * Metadata for a UI scaffold file discovered in the directory.
 */
export interface ScaffoldFileInfo {
	/** Filename including extension (e.g., '00_first-load.html') */
	name: string;
	/** Extracted `<title>` tag or formatted fallback */
	title: string;
	/** File size in bytes */
	size: number;
	/** True if file size is 0 bytes */
	isEmpty: boolean;
	/** Timestamp of last modification */
	mtime: Date;
}

/**
 * CLI options parsed from process arguments.
 */
export interface ServerCliOptions {
	/** HTTP port to listen on */
	port: number;
	/** Hostname or IP to bind */
	hostname: string;
	/** Whether to automatically launch the default browser */
	open: boolean;
}

type ReloadClient = ReadableStreamDefaultController<Uint8Array>;

const DEFAULT_PORT = 3333;
const DEFAULT_HOSTNAME = 'localhost';
const WATCH_DEBOUNCE_MS = 150;

let reloadVersion = Date.now();
const clients = new Set<ReloadClient>();

/**
 * Formats a raw byte count into human-readable units.
 *
 * @param bytes - Size in bytes.
 * @returns Human-readable file size string.
 *
 * @example
 * ```ts
 * formatBytes(4453); // "4.4 KB"
 * formatBytes(0); // "0 B"
 * ```
 */
export function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Extracts the content of the `<title>` tag from raw HTML text.
 *
 * @param html - HTML string to inspect.
 * @returns Found title text, or an empty string if not found.
 */
export function extractHtmlTitle(html: string): string {
	const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
	return match ? match[1]!.trim() : '';
}

/**
 * Scans the UI scaffold directory and returns metadata for all HTML and asset files.
 *
 * @param dir - Absolute path to the scaffold directory.
 * @returns Promise resolving to an array of file metadata objects sorted by name.
 * @throws {Error} When reading the directory fails.
 */
export async function getScaffoldFiles(dir: string = UI_SCAFFOLD_DIR): Promise<ScaffoldFileInfo[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const htmlFiles: ScaffoldFileInfo[] = [];

	for (const entry of entries) {
		if (!entry.isFile() || !entry.name.endsWith('.html')) {
			continue;
		}

		const filePath = path.join(dir, entry.name);
		const fileStat = await stat(filePath);
		let title = '';

		if (fileStat.size > 0) {
			try {
				const content = await readFile(filePath, 'utf8');
				title = extractHtmlTitle(content);
			} catch {
				// Ignore read errors for metadata extraction
			}
		}

		htmlFiles.push({
			name: entry.name,
			title: title || entry.name.replace(/\.html$/, '').replace(/[_-]/g, ' '),
			size: fileStat.size,
			isEmpty: fileStat.size === 0,
			mtime: fileStat.mtime
		});
	}

	return htmlFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

/**
 * Injects live reload SSE script and a floating navigation widget into served HTML.
 *
 * @param html - Original HTML string.
 * @param currentFileName - Filename of the currently requested page.
 * @param allFiles - List of all available scaffold HTML files for the quick switcher.
 * @returns Modified HTML containing the preview helper widget.
 */
export function injectPreviewHelper(
	html: string,
	currentFileName: string,
	allFiles: ScaffoldFileInfo[]
): string {
	const fileOptions = allFiles
		.map((f) => {
			const selected = f.name === currentFileName ? 'selected' : '';
			const status = f.isEmpty ? ' (empty)' : '';
			return `<option value="/${f.name}" ${selected}>${f.name}${status}</option>`;
		})
		.join('');

	const widgetScript = `
<script id="__scaffold_helper">
(() => {
	// Live reload SSE client
	let source;
	const connect = () => {
		source = new EventSource('/__hmr');
		source.onmessage = (event) => {
			if (event.data === 'reload') {
				console.log('[scaffold] Reloading page due to file change...');
				location.reload();
			}
		};
		source.onerror = () => {
			source.close();
			setTimeout(connect, 1000);
		};
	};
	connect();

	// Floating switcher widget in isolated Shadow DOM
	const container = document.createElement('div');
	container.id = '__scaffold_switcher_host';
	const shadow = container.attachShadow({ mode: 'open' });

	const isCollapsed = sessionStorage.getItem('__scaffold_nav_collapsed') === 'true';

	shadow.innerHTML = \`
		<style>
			:host {
				all: initial;
				position: fixed;
				bottom: 16px;
				right: 16px;
				z-index: 999999;
				font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
				font-size: 13px;
				line-height: 1.4;
			}
			.badge {
				display: flex;
				align-items: center;
				gap: 8px;
				background: #0f172a;
				color: #f8fafc;
				padding: 6px 12px;
				border-radius: 9999px;
				box-shadow: 0 4px 14px rgba(0,0,0,0.35);
				border: 1px solid #334155;
				cursor: pointer;
				user-select: none;
			}
			.panel {
				display: flex;
				align-items: center;
				gap: 8px;
				background: rgba(15, 23, 42, 0.95);
				color: #f8fafc;
				padding: 8px 12px;
				border-radius: 10px;
				box-shadow: 0 8px 24px rgba(0,0,0,0.4);
				border: 1px solid #334155;
				backdrop-filter: blur(8px);
			}
			.dot {
				width: 8px;
				height: 8px;
				border-radius: 50%;
				background: #22c55e;
				box-shadow: 0 0 6px #22c55e;
				flex-shrink: 0;
			}
			.title {
				font-weight: 600;
				color: #93c5fd;
				text-decoration: none;
				display: flex;
				align-items: center;
				gap: 4px;
			}
			.title:hover {
				color: #bfdbfe;
			}
			select {
				background: #1e293b;
				color: #f8fafc;
				border: 1px solid #475569;
				border-radius: 6px;
				padding: 4px 8px;
				font-size: 12px;
				font-family: inherit;
				outline: none;
				cursor: pointer;
				max-width: 200px;
			}
			select:hover {
				border-color: #60a5fa;
			}
			button {
				background: transparent;
				border: none;
				color: #94a3b8;
				cursor: pointer;
				padding: 2px 4px;
				border-radius: 4px;
				font-size: 13px;
				line-height: 1;
			}
			button:hover {
				color: #f8fafc;
				background: #334155;
			}
		</style>
		<div id="content"></div>
	\`;

	const content = shadow.getElementById('content');

	function render(collapsed) {
		if (collapsed) {
			content.innerHTML = \`
				<div class="badge" title="Click to expand scaffold navigation">
					<span class="dot"></span>
					<span>Scaffold: <strong>\${${JSON.stringify(currentFileName)}}</strong></span>
				</div>
			\`;
			content.querySelector('.badge').addEventListener('click', () => {
				sessionStorage.setItem('__scaffold_nav_collapsed', 'false');
				render(false);
			});
		} else {
			content.innerHTML = \`
				<div class="panel">
					<span class="dot" title="Live reload connected"></span>
					<a href="/" class="title" title="View all scaffold wireframes">◂ Index</a>
					<span>|</span>
					<label for="page-select" style="sr-only" aria-label="Switch page"></label>
					<select id="page-select">
						${fileOptions}
					</select>
					<button id="collapse-btn" title="Minimize floating panel">✕</button>
				</div>
			\`;
			const select = content.querySelector('#page-select');
			select.addEventListener('change', (e) => {
				location.href = e.target.value;
			});
			content.querySelector('#collapse-btn').addEventListener('click', () => {
				sessionStorage.setItem('__scaffold_nav_collapsed', 'true');
				render(true);
			});
		}
	}

	render(isCollapsed);
	document.body.appendChild(container);
})();
</script>
`;

	return html.includes('</body>')
		? html.replace('</body>', `${widgetScript}\n</body>`)
		: `${html}\n${widgetScript}`;
}

/**
 * Generates an index HTML dashboard listing all UI scaffold templates.
 *
 * @param files - Array of scaffold files found in the directory.
 * @returns Clean, styled HTML string for the index overview.
 */
export function renderIndexHtml(files: ScaffoldFileInfo[]): string {
	const fileRows = files
		.map((file) => {
			const statusBadge = file.isEmpty
				? '<span class="badge badge-empty">Empty (0 B)</span>'
				: `<span class="badge badge-ready">${formatBytes(file.size)}</span>`;

			const linkClass = file.isEmpty ? 'item-title is-empty' : 'item-title';

			return `
				<li class="file-card">
					<div class="file-info">
						<a href="/${file.name}" class="${linkClass}">
							${file.name}
						</a>
						<div class="file-meta">
							<span class="file-desc">${file.title}</span>
							<span class="bullet">•</span>
							<span class="file-mtime">${file.mtime.toLocaleTimeString()}</span>
						</div>
					</div>
					<div class="file-actions">
						${statusBadge}
						<a href="/${file.name}" class="btn-preview" aria-label="Preview ${file.name}">
							Preview ↗
						</a>
					</div>
				</li>
			`;
		})
		.join('');

	return `<!doctype html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>samata-ml · UI Scaffold Explorer</title>
	<style>
		:root {
			--font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
			--bg-page: #0b0f19;
			--bg-card: #131b2e;
			--bg-card-hover: #1a253e;
			--border: #1e293b;
			--text-main: #f8fafc;
			--text-muted: #94a3b8;
			--primary: #3b82f6;
			--primary-hover: #60a5fa;
			--green: #22c55e;
			--yellow: #eab308;
		}
		* {
			box-sizing: border-box;
			margin: 0;
			padding: 0;
		}
		body {
			font-family: var(--font-sans);
			background-color: var(--bg-page);
			color: var(--text-main);
			padding: 32px 20px;
			min-height: 100vh;
			display: flex;
			justify-content: center;
		}
		.container {
			max-width: 860px;
			width: 100%;
		}
		header {
			margin-bottom: 28px;
			border-bottom: 1px solid var(--border);
			padding-bottom: 20px;
		}
		.brand {
			display: flex;
			align-items: center;
			justify-content: space-between;
			margin-bottom: 8px;
		}
		h1 {
			font-size: 24px;
			font-weight: 700;
			letter-spacing: -0.02em;
			display: flex;
			align-items: center;
			gap: 10px;
		}
		h1 .logo-highlight {
			color: var(--primary);
		}
		.live-indicator {
			display: inline-flex;
			align-items: center;
			gap: 6px;
			font-size: 12px;
			color: var(--green);
			background: rgba(34, 197, 94, 0.1);
			padding: 4px 10px;
			border-radius: 9999px;
			border: 1px solid rgba(34, 197, 94, 0.25);
		}
		.pulse-dot {
			width: 6px;
			height: 6px;
			background: var(--green);
			border-radius: 50%;
			box-shadow: 0 0 6px var(--green);
		}
		p.subtitle {
			color: var(--text-muted);
			font-size: 14px;
		}
		.scaffold-path {
			font-family: ui-monospace, Menlo, Consolas, monospace;
			font-size: 12px;
			color: #38bdf8;
			background: #172554;
			padding: 2px 6px;
			border-radius: 4px;
		}
		.file-list {
			list-style: none;
			display: flex;
			flex-direction: column;
			gap: 12px;
		}
		.file-card {
			display: flex;
			align-items: center;
			justify-content: space-between;
			background: var(--bg-card);
			border: 1px solid var(--border);
			border-radius: 10px;
			padding: 16px 20px;
			transition: all 0.15s ease;
		}
		.file-card:hover {
			background: var(--bg-card-hover);
			border-color: #334155;
			transform: translateY(-1px);
		}
		.file-info {
			display: flex;
			flex-direction: column;
			gap: 4px;
		}
		.item-title {
			color: var(--text-main);
			text-decoration: none;
			font-size: 16px;
			font-weight: 600;
			font-family: ui-monospace, Menlo, Consolas, monospace;
		}
		.item-title:hover {
			color: var(--primary-hover);
			text-decoration: underline;
		}
		.item-title.is-empty {
			color: var(--text-muted);
		}
		.file-meta {
			display: flex;
			align-items: center;
			gap: 8px;
			font-size: 13px;
			color: var(--text-muted);
		}
		.bullet {
			color: #475569;
		}
		.file-actions {
			display: flex;
			align-items: center;
			gap: 12px;
		}
		.badge {
			font-size: 12px;
			padding: 3px 8px;
			border-radius: 6px;
			font-weight: 500;
		}
		.badge-ready {
			background: #1e293b;
			color: #cbd5e1;
		}
		.badge-empty {
			background: rgba(234, 179, 8, 0.1);
			color: var(--yellow);
			border: 1px solid rgba(234, 179, 8, 0.25);
		}
		.btn-preview {
			display: inline-flex;
			align-items: center;
			padding: 6px 14px;
			background: var(--primary);
			color: #ffffff;
			text-decoration: none;
			font-size: 13px;
			font-weight: 500;
			border-radius: 6px;
			transition: background 0.15s ease;
		}
		.btn-preview:hover {
			background: var(--primary-hover);
		}
		footer {
			margin-top: 36px;
			text-align: center;
			font-size: 12px;
			color: #64748b;
			border-top: 1px solid var(--border);
			padding-top: 16px;
		}
	</style>
</head>
<body>
	<div class="container">
		<header>
			<div class="brand">
				<h1>samat&amacr;.ml <span class="logo-highlight">UI Scaffold</span></h1>
				<span class="live-indicator">
					<span class="pulse-dot"></span>
					Live Reload Active
				</span>
			</div>
			<p class="subtitle">
				Serving mockups and wireframes from <code class="scaffold-path">specification/plans/ui-scaffold</code>.
			</p>
		</header>

		<main>
			<ul class="file-list">
				${fileRows || '<li class="file-card">No HTML scaffold files found.</li>'}
			</ul>
		</main>

		<footer>
			samata-ml · Changes to files in <code>specification/plans/ui-scaffold</code> will reload automatically.
		</footer>
	</div>

	<script>
		(() => {
			let source;
			const connect = () => {
				source = new EventSource('/__hmr');
				source.onmessage = (event) => {
					if (event.data === 'reload') location.reload();
				};
				source.onerror = () => {
					source.close();
					setTimeout(connect, 1000);
				};
			};
			connect();
		})();
	</script>
</body>
</html>`;
}

/**
 * Sends a live-reload signal to all connected browser SSE clients.
 */
function sendReload(): void {
	reloadVersion = Date.now();
	const payload = new TextEncoder().encode(
		`event: message\ndata: reload\nid: ${reloadVersion}\n\n`
	);

	for (const controller of clients) {
		try {
			controller.enqueue(payload);
		} catch {
			clients.delete(controller);
		}
	}
}

/**
 * Creates the Server-Sent Events response stream for live-reload notifications.
 *
 * @returns HTTP response stream configured for SSE.
 */
function createReloadStream(): Response {
	let clientController: ReloadClient | undefined;
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			clientController = controller;
			clients.add(controller);
			controller.enqueue(
				new TextEncoder().encode(
					`event: message\ndata: connected\nid: ${reloadVersion}\n\n`
				)
			);
		},
		cancel() {
			if (clientController) {
				clients.delete(clientController);
			}
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

/**
 * Starts a debounced recursive filesystem watcher on the UI scaffold directory.
 *
 * @param dir - Directory path to watch.
 */
function startWatcher(dir: string): void {
	let debounceHandle: ReturnType<typeof setTimeout> | undefined;

	watch(dir, { recursive: true }, (eventType, filename) => {
		if (debounceHandle) {
			clearTimeout(debounceHandle);
		}

		debounceHandle = setTimeout(() => {
			const file = filename ? filename.toString() : 'file';
			console.log(
				`[scaffold] Change detected (${eventType}): ${file}. Reloading browsers...`
			);
			sendReload();
		}, WATCH_DEBOUNCE_MS);
	});
}

/**
 * Parses command-line arguments and environment variables for server options.
 *
 * @param argv - Argument array (usually `process.argv.slice(2)`).
 * @returns Parsed server options.
 */
export function parseCliArgs(argv: string[]): ServerCliOptions {
	let port = parseInt(process.env.PORT || '', 10) || DEFAULT_PORT;
	let hostname = DEFAULT_HOSTNAME;
	let open = false;

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (!arg) continue;

		if (arg === '--port' || arg === '-p') {
			const nextVal = argv[++i];
			if (nextVal) port = parseInt(nextVal, 10) || DEFAULT_PORT;
		} else if (arg.startsWith('--port=')) {
			port = parseInt(arg.split('=')[1] ?? '', 10) || DEFAULT_PORT;
		} else if (arg === '--host' || arg === '-h') {
			const nextVal = argv[++i];
			if (nextVal) hostname = nextVal;
		} else if (arg === '--open' || arg === '-o') {
			open = true;
		}
	}

	return { port, hostname, open };
}

/**
 * Starts the UI scaffold preview server.
 *
 * @param customOptions - Optional custom server configurations (overrides CLI flags).
 * @returns Promise resolving to the running Bun Server instance.
 */
export async function startScaffoldServer(
	customOptions?: Partial<ServerCliOptions> & { enableWatcher?: boolean }
): Promise<Server> {
	const parsed = parseCliArgs(process.argv.slice(2));
	const options: ServerCliOptions = {
		port: customOptions?.port ?? parsed.port,
		hostname: customOptions?.hostname ?? parsed.hostname,
		open: customOptions?.open ?? parsed.open
	};
	const enableWatcher = customOptions?.enableWatcher ?? true;
	const files = await getScaffoldFiles(UI_SCAFFOLD_DIR);

	const server = Bun.serve({
		port: options.port,
		hostname: options.hostname,
		async fetch(request, server) {
			const url = new URL(request.url);

			// Server-sent events endpoint for live reload
			if (url.pathname === '/__hmr') {
				server.timeout(request, 0);
				return createReloadStream();
			}

			// Clean path and normalize
			let reqPath = url.pathname;

			// Support requests prefixed by full spec path
			if (reqPath.startsWith('/specification/plans/ui-scaffold')) {
				reqPath = reqPath.replace(/^\/specification\/plans\/ui-scaffold/, '') || '/';
			}

			// Dashboard / Index route
			if (reqPath === '/' || reqPath === '/index.html') {
				const currentFiles = await getScaffoldFiles(UI_SCAFFOLD_DIR);
				return new Response(renderIndexHtml(currentFiles), {
					headers: { 'Content-Type': 'text/html; charset=utf-8' }
				});
			}

			// Normalize target file path inside UI_SCAFFOLD_DIR
			const cleanRelative = path.normalize(reqPath).replace(/^\/+/, '');
			const resolvedPath = path.resolve(UI_SCAFFOLD_DIR, cleanRelative);

			if (!isPathInside(UI_SCAFFOLD_DIR, resolvedPath)) {
				return new Response('Forbidden', { status: 403 });
			}

			const file = Bun.file(resolvedPath);
			if (!(await file.exists())) {
				return new Response(
					`<!doctype html><html><body style="font-family: sans-serif; padding: 2rem;">
						<h2>404 Not Found</h2>
						<p>Could not find <code>${cleanRelative}</code> in UI scaffold directory.</p>
						<p><a href="/">◂ Back to Scaffold Index</a></p>
					</body></html>`,
					{
						status: 404,
						headers: { 'Content-Type': 'text/html; charset=utf-8' }
					}
				);
			}

			if (resolvedPath.endsWith('.html')) {
				const htmlContent = await file.text();
				const currentFiles = await getScaffoldFiles(UI_SCAFFOLD_DIR);
				const modifiedHtml = injectPreviewHelper(
					htmlContent,
					path.basename(resolvedPath),
					currentFiles
				);
				return new Response(modifiedHtml, {
					headers: { 'Content-Type': 'text/html; charset=utf-8' }
				});
			}

			return new Response(file, {
				headers: {
					'Content-Type': contentTypeFromPath(resolvedPath)
				}
			});
		}
	});

	if (enableWatcher) {
		startWatcher(UI_SCAFFOLD_DIR);
	}

	const baseUrl = `http://${options.hostname}:${server.port}`;
	console.log(`\n🎨 samata-ml UI Scaffold Server running at: \x1b[36m${baseUrl}/\x1b[0m`);
	console.log(`📁 Directory: \x1b[90m${UI_SCAFFOLD_DIR}\x1b[0m\n`);
	console.log(`Available preview pages:`);
	for (const file of files) {
		const sizeLabel = file.isEmpty
			? '\x1b[33m(empty)\x1b[0m'
			: `\x1b[90m(${formatBytes(file.size)})\x1b[0m`;
		console.log(`  • \x1b[32m${baseUrl}/${file.name}\x1b[0m ${sizeLabel}`);
	}
	console.log(`\n⚡ Live reload is active. Press \x1b[90mCtrl+C\x1b[0m to stop.\n`);

	if (options.open) {
		const openCommand =
			process.platform === 'darwin'
				? 'open'
				: process.platform === 'win32'
					? 'start'
					: 'xdg-open';
		Bun.spawn([openCommand, `${baseUrl}/`]);
	}

	return server;
}

// Auto-run when executed directly
if (import.meta.main) {
	await startScaffoldServer();
}
