import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:https';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isPathInside } from '../../scripts/filesystem';
import { parseHeadersFile, resolveHeaders } from '../../scripts/headers-file';
import { contentTypeFromPath } from '../../scripts/static-server';

const CERT_DIR = path.resolve(fileURLToPath(new URL('../../.cert', import.meta.url)));
const CERT_PATH = path.join(CERT_DIR, 'localhost.pem');
const KEY_PATH = path.join(CERT_DIR, 'localhost-key.pem');

/**
 * Running HTTPS static origin serving a production build with `_headers` and SPA fallback.
 */
export interface BetaOriginServer {
	/** Bound ephemeral localhost port. */
	port: number;
	/** Origin URL using `https://beta.samata.ml:<port>`. */
	url: string;
	/** Stops the HTTPS server and closes active connections. */
	close: () => Promise<void>;
}

/**
 * Starts a local Node HTTPS server serving `rootDir` on `beta.samata.ml` (127.0.0.1, port 0)
 * using the existing `.cert/` TLS files and resolving `<rootDir>/_headers`.
 *
 * @param rootDir - Built production output directory containing `_headers` and `index.html`.
 * @returns Handle with bound port, origin URL, and close method.
 * @throws Error if `.cert/localhost.pem` or `.cert/localhost-key.pem` is missing or `_headers` is invalid.
 */
export async function startBetaOriginServer(rootDir: string): Promise<BetaOriginServer> {
	let cert: string;
	let key: string;
	try {
		[cert, key] = await Promise.all([readFile(CERT_PATH, 'utf8'), readFile(KEY_PATH, 'utf8')]);
	} catch (error) {
		throw new Error(
			`Beta origin server requires TLS certificates at ${CERT_PATH} and ${KEY_PATH}. Run Playwright global setup or ensureHttpsCert() first. (${String(error)})`
		);
	}

	const headerRules = parseHeadersFile(await readFile(path.join(rootDir, '_headers'), 'utf8'));

	const server = createServer({ key, cert }, async (req, res) => {
		try {
			const url = new URL(req.url ?? '/', 'https://beta.samata.ml');
			const reqPath = url.pathname === '/' ? '/index.html' : url.pathname;
			const normalizedPath = path.normalize(reqPath).replace(/^\/+/, '');
			let resolved = path.resolve(rootDir, normalizedPath);

			if (!isPathInside(rootDir, resolved)) {
				res.writeHead(403, {
					'Cross-Origin-Opener-Policy': 'same-origin',
					'Cross-Origin-Embedder-Policy': 'require-corp',
					'Cross-Origin-Resource-Policy': 'same-origin'
				});
				res.end('Forbidden');
				return;
			}

			let exists = false;
			try {
				const st = await stat(resolved);
				exists = st.isFile();
			} catch {
				exists = false;
			}

			if (!exists) {
				if (path.extname(normalizedPath) !== '') {
					res.writeHead(404, {
						'Cross-Origin-Opener-Policy': 'same-origin',
						'Cross-Origin-Embedder-Policy': 'require-corp',
						'Cross-Origin-Resource-Policy': 'same-origin'
					});
					res.end('Not Found');
					return;
				}
				resolved = path.resolve(rootDir, 'index.html');
			}

			const headers = resolveHeaders(headerRules, url.pathname);
			headers.set('Content-Type', contentTypeFromPath(resolved));
			const record: Record<string, string> = {};
			headers.forEach((value, name) => {
				record[name] = value;
			});

			const body = await readFile(resolved);
			res.writeHead(200, record);
			if (req.method === 'HEAD') {
				res.end();
			} else {
				res.end(body);
			}
		} catch (error) {
			res.writeHead(500);
			res.end(String(error));
		}
	});

	await new Promise<void>((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => {
			server.off('error', reject);
			resolve();
		});
	});

	const address = server.address() as AddressInfo;
	return {
		port: address.port,
		url: `https://beta.samata.ml:${address.port}`,
		close: () =>
			new Promise<void>((resolve, reject) => {
				server.close((err) => (err ? reject(err) : resolve()));
			})
	};
}
