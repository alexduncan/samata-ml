import { lstatSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Runtime-neutral port and URL resolution for every checkout. Loaded by Bun
 * servers and by Playwright (Node), so it imports only `node:` built-ins and
 * never uses Bun globals.
 */

/** Environment variable that overrides the port base for any checkout. */
export const PORT_BASE_ENV = 'SAMATA_PORT_BASE';

/** Default ports of the primary checkout. */
export const PRIMARY_PORTS = { app: 3000, dist: 3001, mockups: 3333 } as const;

/** Lowest port base of a linked worktree. */
export const WORKTREE_PORT_MIN = 20000;

/** Number of port blocks a linked worktree can hash into (bases 20000 to 32762, step 3). */
export const WORKTREE_PORT_BLOCKS = 4255;

/** Whether a checkout is the primary one or a linked Git worktree. */
export type CheckoutKind = 'primary' | 'linked-worktree';

/** Where the ports of a checkout came from. */
export type PortSource = 'primary-default' | 'worktree-derived' | 'override';

/** Ports assigned to one checkout. */
export interface CheckoutPorts {
	/** Real path of the checkout root. */
	readonly root: string;
	/** Primary checkout or linked worktree. */
	readonly kind: CheckoutKind;
	/** How the ports were chosen. */
	readonly source: PortSource;
	/** Development app server port. */
	readonly app: number;
	/** Production-build (dist) server port. */
	readonly dist: number;
	/** Mockup server port. */
	readonly mockups: number;
}

/** Base URLs of one checkout's servers, without trailing slashes. */
export interface CheckoutUrls {
	/** `https://localhost:${app}` */
	readonly app: string;
	/** `https://localhost:${dist}` */
	readonly dist: string;
	/** `http://localhost:${mockups}` */
	readonly mockups: string;
}

type Env = Readonly<Record<string, string | undefined>>;

/**
 * Computes the unsigned 32-bit FNV-1a hash of the UTF-8 bytes of `text`.
 *
 * @param text - Text to hash.
 * @returns Unsigned 32-bit hash.
 */
export function fnv1a32(text: string): number {
	let hash = 0x811c9dc5;
	for (const byte of new TextEncoder().encode(text)) {
		hash ^= byte;
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return hash >>> 0;
}

/**
 * Derives the stable port base of a linked worktree from its real root path.
 *
 * @param root - Real path of the worktree root.
 * @returns Base port (the app port) in 20000 to 32762, a multiple of 3 above 20000.
 */
export function deriveWorktreePortBase(root: string): number {
	return WORKTREE_PORT_MIN + 3 * (fnv1a32(root) % WORKTREE_PORT_BLOCKS);
}

/**
 * Detects whether `root` is a primary checkout or a linked worktree.
 *
 * A `.git` file marks a linked worktree; a `.git` directory or no `.git` entry
 * (tarball export) marks a primary checkout.
 *
 * @param root - Checkout root directory.
 * @returns The checkout kind.
 */
export function detectCheckoutKind(root: string): CheckoutKind {
	try {
		return lstatSync(join(root, '.git')).isFile() ? 'linked-worktree' : 'primary';
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 'primary';
		throw error;
	}
}

function parseBaseOverride(env: Env): number | null {
	const raw = env[PORT_BASE_ENV];
	if (raw === undefined || raw === '') return null;
	const value = /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
	if (!Number.isInteger(value) || value < 1024 || value > 65533) {
		throw new Error(
			`${PORT_BASE_ENV} must be an integer from 1024 to 65533 (received "${raw}").`
		);
	}
	return value;
}

/**
 * Resolves the ports of a checkout. The override is read first and throws on
 * an invalid value.
 *
 * @param options - Optional root directory and environment.
 * @returns The checkout's ports.
 */
export function resolveCheckoutPorts(options: { rootDir?: string; env?: Env } = {}): CheckoutPorts {
	const root = realpathSync.native(
		options.rootDir ?? fileURLToPath(new URL('..', import.meta.url))
	);
	const env = options.env ?? process.env;
	const kind = detectCheckoutKind(root);
	const override = parseBaseOverride(env);
	if (override !== null) {
		return {
			root,
			kind,
			source: 'override',
			app: override,
			dist: override + 1,
			mockups: override + 2
		};
	}
	if (kind === 'primary') {
		return { root, kind, source: 'primary-default', ...PRIMARY_PORTS };
	}
	const base = deriveWorktreePortBase(root);
	return {
		root,
		kind,
		source: 'worktree-derived',
		app: base,
		dist: base + 1,
		mockups: base + 2
	};
}

/**
 * Builds the base URLs for a checkout's ports.
 *
 * @param ports - Resolved checkout ports.
 * @returns URLs without trailing slashes.
 */
export function checkoutUrls(ports: CheckoutPorts): CheckoutUrls {
	return {
		app: `https://localhost:${ports.app}`,
		dist: `https://localhost:${ports.dist}`,
		mockups: `http://localhost:${ports.mockups}`
	};
}

function validPort(raw: string | undefined): number | null {
	if (raw === undefined || !/^\d+$/.test(raw)) return null;
	const value = Number(raw);
	return value >= 0 && value <= 65535 ? value : null;
}

/**
 * Chooses a server port: the last valid listed flag, then a valid `PORT`, then `fallback`.
 * Invalid values are ignored.
 *
 * @param argv - Command-line arguments.
 * @param env - Environment (reads `PORT`).
 * @param fallback - Port used when nothing valid is supplied.
 * @param flags - Accepted flags (default `['--port']`).
 * @returns The chosen port, 0 to 65535.
 */
export function parsePortOption(
	argv: readonly string[],
	env: Env,
	fallback: number,
	flags: readonly string[] = ['--port']
): number {
	let chosen: number | null = null;
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index] as string;
		let raw: string | undefined;
		if (flags.includes(arg)) {
			raw = argv[index + 1];
			index += 1;
		} else {
			const flag = flags.find((candidate) => arg.startsWith(`${candidate}=`));
			if (flag) raw = arg.slice(flag.length + 1);
			else continue;
		}
		const port = validPort(raw);
		if (port !== null) chosen = port;
	}
	return chosen ?? validPort(env.PORT) ?? fallback;
}

/** Real path of this checkout's root. */
export const CHECKOUT_ROOT: string = realpathSync.native(
	fileURLToPath(new URL('..', import.meta.url))
);

/** Ports of this checkout, resolved at import. */
export const CHECKOUT_PORTS: CheckoutPorts = resolveCheckoutPorts();

const URLS = checkoutUrls(CHECKOUT_PORTS);

/** Development app server URL of this checkout. */
export const APP_URL: string = URLS.app;

/** Production-build (dist) server URL of this checkout. */
export const DIST_URL: string = URLS.dist;

/** Mockup server URL of this checkout. */
export const MOCKUPS_URL: string = URLS.mockups;
