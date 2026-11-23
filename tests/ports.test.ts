import { afterAll, describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT_DIR } from '../scripts/config';
import {
	CHECKOUT_ROOT,
	checkoutUrls,
	deriveWorktreePortBase,
	fnv1a32,
	parsePortOption,
	resolveCheckoutPorts
} from '../scripts/ports';

const temps: string[] = [];
function tempRoot(kind: 'dir' | 'file' | 'none'): string {
	const root = realpathSync.native(mkdtempSync(path.join(os.tmpdir(), 'ports-')));
	temps.push(root);
	if (kind === 'dir') mkdirSync(path.join(root, '.git'));
	if (kind === 'file') writeFileSync(path.join(root, '.git'), 'gitdir: /elsewhere\n');
	return root;
}
afterAll(() => {
	for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

describe('resolveCheckoutPorts', () => {
	it('keeps primary defaults for a .git directory and for no .git', () => {
		for (const kind of ['dir', 'none'] as const) {
			const ports = resolveCheckoutPorts({ rootDir: tempRoot(kind), env: {} });
			expect([ports.app, ports.dist, ports.mockups]).toEqual([3000, 3001, 3333]);
			expect(ports.kind).toBe('primary');
			expect(ports.source).toBe('primary-default');
		}
	});

	it('derives a stable block for a linked worktree', () => {
		const root = tempRoot('file');
		const first = resolveCheckoutPorts({ rootDir: root, env: {} });
		const base = deriveWorktreePortBase(root);
		expect(first.kind).toBe('linked-worktree');
		expect(first.source).toBe('worktree-derived');
		expect([first.app, first.dist, first.mockups]).toEqual([base, base + 1, base + 2]);
		expect(base).toBeGreaterThanOrEqual(20000);
		expect(base).toBeLessThanOrEqual(32762);
		expect((base - 20000) % 3).toBe(0);
		expect(resolveCheckoutPorts({ rootDir: root, env: {} })).toEqual(first);
	});

	it('hashes with published FNV-1a vectors', () => {
		expect(fnv1a32('')).toBe(2166136261);
		expect(fnv1a32('a')).toBe(3826002220);
	});

	it('accepts valid overrides for both kinds', () => {
		for (const kind of ['dir', 'file'] as const) {
			for (const value of ['1024', '65533']) {
				const ports = resolveCheckoutPorts({
					rootDir: tempRoot(kind),
					env: { SAMATA_PORT_BASE: value }
				});
				expect(ports.source).toBe('override');
				expect([ports.app, ports.dist, ports.mockups]).toEqual([
					Number(value),
					Number(value) + 1,
					Number(value) + 2
				]);
			}
		}
	});

	it('rejects invalid overrides and treats empty as unset', () => {
		const rootDir = tempRoot('dir');
		for (const value of ['1023', '65534', '3000.5', 'abc', '-1']) {
			expect(() =>
				resolveCheckoutPorts({ rootDir, env: { SAMATA_PORT_BASE: value } })
			).toThrow(/SAMATA_PORT_BASE/);
		}
		expect(resolveCheckoutPorts({ rootDir, env: { SAMATA_PORT_BASE: '' } }).source).toBe(
			'primary-default'
		);
	});

	it('builds URLs without trailing slashes', () => {
		const urls = checkoutUrls(resolveCheckoutPorts({ rootDir: tempRoot('dir'), env: {} }));
		expect(urls).toEqual({
			app: 'https://localhost:3000',
			dist: 'https://localhost:3001',
			mockups: 'http://localhost:3333'
		});
	});

	it('exposes the real checkout root', () => {
		expect(CHECKOUT_ROOT).toBe(realpathSync.native(ROOT_DIR));
	});
});

describe('parsePortOption', () => {
	it('prefers flags, then PORT, then the fallback', () => {
		expect(parsePortOption(['--port', '4000'], { PORT: '5000' }, 1)).toBe(4000);
		expect(parsePortOption(['--port=4000'], { PORT: '5000' }, 1)).toBe(4000);
		expect(parsePortOption([], { PORT: '5000' }, 1)).toBe(5000);
		expect(parsePortOption([], { PORT: 'abc' }, 1)).toBe(1);
		expect(parsePortOption(['--port', '70000'], {}, 1)).toBe(1);
		expect(parsePortOption(['-p', '4001'], {}, 1)).toBe(1);
		expect(parsePortOption(['-p', '4001'], {}, 1, ['--port', '-p'])).toBe(4001);
	});

	it('scans left to right and ignores invalid values', () => {
		expect(parsePortOption(['--port', '4000', '--port', 'x'], {}, 1)).toBe(4000);
		expect(parsePortOption(['--port', 'x', '--port=4001'], {}, 1)).toBe(4001);
		expect(parsePortOption(['--port', '4000abc'], { PORT: '5000' }, 1)).toBe(5000);
		expect(parsePortOption([], { PORT: '4000abc' }, 1)).toBe(1);
		expect(parsePortOption(['--port', '0'], {}, 1)).toBe(0);
	});
});

describe('runtime neutrality', () => {
	it('keeps the new modules free of Bun globals and config imports', () => {
		for (const file of ['ports.ts', 'checkout-identity.ts']) {
			const text = readFileSync(path.join(ROOT_DIR, 'scripts', file), 'utf8');
			expect(text).not.toContain('Bun.');
			expect(text).not.toContain('import.meta.dir');
			expect(text).not.toMatch(/from ['"]\.\/config['"]/);
		}
	});
});
