import { createHash } from 'node:crypto';
import { Stats, watch } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { buildDevBundle } from './build-assets';
import { CERT_DIR, CERT_PATH, ensureHttpsCert, KEY_PATH } from './certificates';
import { CHECKOUT_IDENTITY_PATH, createCheckoutIdentityResponse } from './checkout-identity';
import { CONTENT_DIR, CSS_DIR, DEV_DIR, DIST_DIR, PUBLIC_DIR, SRC_DIR } from './config';
import { isPathInside } from './filesystem';
import { parseHeadersFile, type HeaderRule } from './headers-file';
import { CHECKOUT_PORTS, CHECKOUT_ROOT, parsePortOption } from './ports';
import { serveStaticFile } from './static-server';

const PORT = parsePortOption(process.argv.slice(2), process.env, CHECKOUT_PORTS.app);
const HOSTNAME = 'localhost';
const SERVE_DIST = process.argv.includes('--dist');
const SERVE_DIR = SERVE_DIST ? DIST_DIR : DEV_DIR;
const TRAINING_RUNTIME_PROBE = SERVE_DIST
	? null
	: process.env.SAMATA_TRAINING_RUNTIME_PROBE === '1';
const WATCH_DEBOUNCE_MS = 250;

type ReloadClient = ReadableStreamDefaultController<Uint8Array>;
type FileSignature = string;

/**
 * Adds the browser live-reload client script to an HTML response.
 */
function injectReloadClient(html: string): string {
	const client = [
		'<script>',
		'(() => {',
		'  let source;',
		'  const connect = () => {',
		"    source = new EventSource('/__hmr');",
		'    source.onmessage = (event) => {',
		"      if (event.data === 'reload') location.reload();",
		'    };',
		'    source.onerror = () => {',
		'      source.close();',
		'      setTimeout(connect, 1000);',
		'    };',
		'  };',
		'  connect();',
		'})();',
		'</script>'
	].join('\n');

	return html.includes('</body>')
		? html.replace('</body>', `${client}\n</body>`)
		: `${html}\n${client}`;
}

let reloadVersion = Date.now();
const clients = new Set<ReloadClient>();

/**
 * Writes a server message with a consistent prefix so logs are easy to scan.
 */
function log(message: string): void {
	// Date string format: HH:mm:ss for easier scanning, but still ISO-like for sorting and timezone clarity.
	const now = new Date();
	const timestamp = now.toISOString().replace(/T/, ' ').replace(/\..+/, '');
	console.log(`${timestamp} [server] ${message}`);
}

/**
 * Writes a server error with the same timestamped prefix as normal server logs.
 */
function logError(message: string, error: unknown): void {
	const now = new Date();
	const timestamp = now.toISOString().replace(/T/, ' ').replace(/\..+/, '');
	console.error(`${timestamp} [server] ${message}`, error);
}

/**
 * Sends a reload event to every browser currently connected to the live-reload stream.
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

	log(`Browser reload sent to ${clients.size} client(s).`);
}

/**
 * Creates the server-sent events response used by browsers for live reload.
 */
function createReloadStream(): Response {
	let clientController: ReloadClient | undefined;
	const stream = new ReadableStream<Uint8Array>({
		/**
		 * Registers a browser as an active live-reload client.
		 */
		start(controller) {
			clientController = controller;
			clients.add(controller);
			controller.enqueue(
				new TextEncoder().encode(
					`event: message\ndata: connected\nid: ${reloadVersion}\n\n`
				)
			);
			log(`Browser connected. Active clients: ${clients.size}.`);
		},
		/**
		 * Removes a browser from the active live-reload clients when it disconnects.
		 */
		cancel() {
			if (clientController) {
				clients.delete(clientController);
				log(`Browser disconnected from live reload. Active clients: ${clients.size}.`);
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
 * Coordinates development rebuilds so rapid file events produce one rebuild and one reload.
 */
class DevBuildScheduler {
	private debounceHandle: ReturnType<typeof setTimeout> | undefined;
	private isBuilding = false;
	private pendingRebuild = false;
	private readonly reasons = new Set<string>();

	/**
	 * Stores the build function that should run when the scheduler decides to rebuild.
	 */
	constructor(private readonly build: () => Promise<void>) {}

	/**
	 * Runs the first development build before the server starts accepting requests.
	 */
	async buildInitial(): Promise<void> {
		log('Building development assets...');
		await this.build();
		log(`Development assets written to ${DEV_DIR}.`);
	}

	/**
	 * Records a file-change reason and schedules a debounced rebuild.
	 */
	requestRebuild(reason: string): void {
		this.reasons.add(reason);
		log(`Change detected: ${reason}`);

		if (this.debounceHandle) {
			clearTimeout(this.debounceHandle);
		}

		this.debounceHandle = setTimeout(() => {
			void this.rebuildNow();
		}, WATCH_DEBOUNCE_MS);
	}

	/**
	 * Runs a rebuild immediately unless another rebuild is already in progress.
	 */
	private async rebuildNow(): Promise<void> {
		if (this.isBuilding) {
			this.pendingRebuild = true;
			log('A rebuild is already running; queued one follow-up rebuild.');
			return;
		}

		this.isBuilding = true;
		const reasons = [...this.reasons].join(', ');
		this.reasons.clear();
		const startedAt = performance.now();

		try {
			log(`Rebuilding development assets because: ${reasons || 'manual request'}.`);
			await this.build();
			const elapsedMs = Math.round(performance.now() - startedAt);
			log(`Rebuild finished in ${elapsedMs}ms.`);
			sendReload();
		} catch (error) {
			logError('Rebuild failed:', error);
		} finally {
			this.isBuilding = false;

			if (this.pendingRebuild) {
				this.pendingRebuild = false;
				await this.rebuildNow();
			}
		}
	}
}

/**
 * Tracks file signatures so duplicate watcher events do not trigger duplicate rebuilds.
 */
class WatchSnapshot {
	private readonly signatures = new Map<string, FileSignature>();

	/**
	 * Records the initial signatures for every watched path.
	 */
	async initialize(paths: string[]): Promise<void> {
		for (const watchPath of paths) {
			await this.snapshotPath(watchPath);
		}
	}

	/**
	 * Returns true when the file content or directory signature changed since the last event.
	 */
	async hasMeaningfulChange(filePath: string): Promise<boolean> {
		const nextSignature = await this.signatureForPath(filePath);
		const previousSignature = this.signatures.get(filePath);

		if (previousSignature === nextSignature) {
			return false;
		}

		this.signatures.set(filePath, nextSignature);
		return true;
	}

	/**
	 * Recursively stores the current signature for a file or directory.
	 */
	private async snapshotPath(filePath: string): Promise<void> {
		const currentStat = await stat(filePath);
		this.signatures.set(filePath, await this.signatureFromStat(filePath, currentStat));

		if (!currentStat.isDirectory()) {
			return;
		}

		const entries = await readdir(filePath, { withFileTypes: true });
		for (const entry of entries) {
			await this.snapshotPath(path.join(filePath, entry.name));
		}
	}

	/**
	 * Returns the current signature for a path, or a missing marker when the path is gone.
	 */
	private async signatureForPath(filePath: string): Promise<FileSignature> {
		try {
			const currentStat = await stat(filePath);
			return this.signatureFromStat(filePath, currentStat);
		} catch {
			return 'missing';
		}
	}

	/**
	 * Builds a stable signature for a file or directory from its current filesystem state.
	 */
	private async signatureFromStat(filePath: string, currentStat: Stats): Promise<FileSignature> {
		if (currentStat.isDirectory()) {
			return ['dir', currentStat.size, currentStat.mtimeMs].join(':');
		}

		const content = await readFile(filePath);
		const digest = createHash('sha256').update(content).digest('hex');

		// fs.watch can emit duplicate events for one save. Hash the content so
		// metadata-only changes do not cause rebuild loops.
		return ['file', currentStat.size, digest].join(':');
	}
}

/**
 * Returns true for generated files that should not trigger development rebuilds.
 */
function shouldIgnoreWatchPath(filePath: string): boolean {
	const ignoredDirs = [DEV_DIR, DIST_DIR, CERT_DIR];
	return ignoredDirs.some((dir) => isPathInside(dir, filePath));
}

/**
 * Starts recursive filesystem watchers for source, CSS, and public template files.
 */
async function startWatchers(scheduler: DevBuildScheduler): Promise<void> {
	const watchTargets = [SRC_DIR, CSS_DIR, PUBLIC_DIR, CONTENT_DIR];
	const snapshot = new WatchSnapshot();

	await snapshot.initialize(watchTargets);
	log('Initial file watch snapshot created.');

	for (const target of watchTargets) {
		// Shorten target paths in logs by using project-relative paths when possible.
		const relativeTarget = path.relative(process.cwd(), target);
		log(`Watching ${relativeTarget}`);

		watch(target, { recursive: true }, (eventType, filename) => {
			const changedPath = path.resolve(target, filename ? filename.toString() : '.');

			// Generated files should never trigger a dev rebuild. This guard is defensive
			// because recursive watch behavior can vary between platforms and editors.
			if (shouldIgnoreWatchPath(changedPath)) {
				log(`Ignored generated file event: ${eventType} ${changedPath}`);
				return;
			}

			void snapshot.hasMeaningfulChange(changedPath).then((hasMeaningfulChange) => {
				if (!hasMeaningfulChange) {
					log(`Ignored duplicate file event: ${eventType} ${changedPath}`);
					return;
				}

				scheduler.requestRebuild(`${eventType} ${changedPath}`);
			});
		});
	}
}

await ensureHttpsCert();
log(`HTTPS certificate: ${CERT_PATH}`);
log(`HTTPS private key: ${KEY_PATH}`);

const scheduler = SERVE_DIST ? undefined : new DevBuildScheduler(buildDevBundle);

let distHeaderRules: readonly HeaderRule[] | undefined;

if (scheduler) {
	await scheduler.buildInitial();
} else {
	const headersPath = path.join(SERVE_DIR, '_headers');
	distHeaderRules = parseHeadersFile(await readFile(headersPath, 'utf8'));
	log(`Serving production files from ${DIST_DIR}.`);
	log('Hot reload is disabled in dist mode.');
}

const tlsKey = await readFile(KEY_PATH, 'utf8');
const tlsCert = await readFile(CERT_PATH, 'utf8');

const server = Bun.serve({
	port: PORT,
	hostname: HOSTNAME,
	tls: {
		key: tlsKey,
		cert: tlsCert
	},
	/**
	 * Routes live-reload requests in development and static-file requests in both modes.
	 */
	async fetch(request, server) {
		const url = new URL(request.url);

		if (url.pathname === CHECKOUT_IDENTITY_PATH) {
			if (request.method !== 'GET' && request.method !== 'HEAD') {
				return new Response('Method Not Allowed', {
					status: 405,
					headers: { Allow: 'GET, HEAD' }
				});
			}
			return createCheckoutIdentityResponse(
				{
					service: 'samata-ml-app',
					root: CHECKOUT_ROOT,
					servingDir: SERVE_DIR,
					mode: SERVE_DIST ? 'dist' : 'dev',
					trainingRuntimeProbe: TRAINING_RUNTIME_PROBE
				},
				request.method
			);
		}

		if (!SERVE_DIST && url.pathname === '/__hmr') {
			server.timeout(request, 0);
			return createReloadStream();
		}

		return serveStaticFile({
			requestPath: url.pathname,
			rootDir: SERVE_DIR,
			transformHtml: SERVE_DIST ? undefined : injectReloadClient,
			headerRules: distHeaderRules
		});
	}
});

const label = SERVE_DIST ? 'Production dist server' : 'Development server';
log(`${label} running at https://${HOSTNAME}:${server.port}/`);

if (scheduler) {
	await startWatchers(scheduler);
}
