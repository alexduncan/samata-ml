import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { ROOT_DIR } from './config';

export const CERT_DIR = path.join(ROOT_DIR, '.cert');
export const KEY_PATH = path.join(CERT_DIR, 'localhost-key.pem');
export const CERT_PATH = path.join(CERT_DIR, 'localhost.pem');

/**
 * Ensures the local HTTPS certificate files exist before the server starts.
 */
export async function ensureHttpsCert(): Promise<void> {
	if (existsSync(KEY_PATH) && existsSync(CERT_PATH)) {
		return;
	}

	await mkdir(CERT_DIR, { recursive: true });

	// This fallback keeps the server usable before mkcert has been run.
	// Browsers will trust mkcert certificates, but not this self-signed fallback.
	const openssl = Bun.spawnSync(
		[
			'openssl',
			'req',
			'-x509',
			'-newkey',
			'rsa:2048',
			'-nodes',
			'-keyout',
			KEY_PATH,
			'-out',
			CERT_PATH,
			'-days',
			'365',
			'-subj',
			'/CN=localhost',
			'-addext',
			'subjectAltName=DNS:localhost,IP:127.0.0.1'
		],
		{ stdout: 'ignore', stderr: 'pipe' }
	);

	if (openssl.exitCode !== 0) {
		const stderr = new TextDecoder().decode(openssl.stderr);
		throw new Error(`Unable to generate HTTPS certificate with openssl.\n${stderr}`);
	}
}
