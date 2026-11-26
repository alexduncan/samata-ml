import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT_DIR } from '../scripts/config';
import {
	bumpSemVer,
	formatChangelogEntry,
	parseSemVer,
	type ReleaseBump
} from '../scripts/release';

describe('release helpers', () => {
	test('REL-VER-2: bumpSemVer matches every table cell', () => {
		const cases: Array<[string, ReleaseBump, string]> = [
			['0.1.0-beta.1', 'prerelease', '0.1.0-beta.2'],
			['0.1.0-beta.1', 'patch', '0.1.0'],
			['0.1.0-beta.1', 'minor', '0.1.0'],
			['0.1.0-beta.1', 'major', '1.0.0'],

			['0.1.2-beta.3', 'prerelease', '0.1.2-beta.4'],
			['0.1.2-beta.3', 'patch', '0.1.2'],
			['0.1.2-beta.3', 'minor', '0.2.0'],
			['0.1.2-beta.3', 'major', '1.0.0'],

			['1.0.0-beta.2', 'prerelease', '1.0.0-beta.3'],
			['1.0.0-beta.2', 'patch', '1.0.0'],
			['1.0.0-beta.2', 'minor', '1.0.0'],
			['1.0.0-beta.2', 'major', '1.0.0'],

			['0.1.0', 'prerelease', '0.1.1-beta.1'],
			['0.1.0', 'patch', '0.1.1'],
			['0.1.0', 'minor', '0.2.0'],
			['0.1.0', 'major', '1.0.0'],

			['1.2.3', 'prerelease', '1.2.4-beta.1'],
			['1.2.3', 'patch', '1.2.4'],
			['1.2.3', 'minor', '1.3.0'],
			['1.2.3', 'major', '2.0.0']
		];

		for (const [from, bump, expected] of cases) {
			expect(bumpSemVer(from, bump)).toBe(expected);
		}
	});

	test('REL-VER-2: invalid SemVer inputs throw naming the input', () => {
		const invalid = ['1.2', '01.2.3', '1.2.3-rc.1', '1.2.3-beta.0', '1.2.3+meta'];
		for (const bad of invalid) {
			expect(() => parseSemVer(bad)).toThrow(bad);
			expect(() => bumpSemVer(bad, 'patch')).toThrow(bad);
		}
	});

	test('REL-VER-2: formatChangelogEntry formats notes or empty fallback', () => {
		expect(formatChangelogEntry('0.1.0-beta.2', '2026-11-23T12:00:00Z', [])).toBe(
			'## [0.1.0-beta.2] - 2026-11-23\n\n- No notable changes.'
		);
		expect(
			formatChangelogEntry('0.1.0-beta.2', '2026-11-23', [
				'- Added cache headers',
				'Fixed bug'
			])
		).toBe('## [0.1.0-beta.2] - 2026-11-23\n\n- Added cache headers\n- Fixed bug');
	});

	test('REL-VER-1: package.json and wrangler.jsonc match release configuration', async () => {
		const pkg = JSON.parse(await readFile(path.join(ROOT_DIR, 'package.json'), 'utf8')) as {
			name: string;
			version: string;
			devDependencies: Record<string, string>;
		};
		expect(pkg.name).toBe('samata-ml');
		expect(pkg.version).toBe('0.1.0-beta.1');
		expect(pkg.devDependencies.wrangler).toBe('4.166.0');

		const wranglerText = await readFile(path.join(ROOT_DIR, 'wrangler.jsonc'), 'utf8');
		const stripped = wranglerText.replace(/^\s*\/\/.*$/gm, '');
		const wrangler = JSON.parse(stripped) as {
			name: string;
			workers_dev: boolean;
			preview_urls: boolean;
			routes: Array<{ pattern: string; custom_domain?: boolean }>;
			assets: { directory: string; not_found_handling: string };
		};
		expect(wrangler.name).toBe('samata-ml');
		expect(wrangler.workers_dev).toBe(false);
		expect(wrangler.preview_urls).toBe(true);
		expect(wrangler.routes).toEqual([{ pattern: 'beta.samata.ml', custom_domain: true }]);
		expect(wrangler.assets.not_found_handling).toBe('single-page-application');
	});

	test('REL-VER-3: CLI dry-run previews bump without modifying files and rejects invalid bump', async () => {
		const pkgPath = path.join(ROOT_DIR, 'package.json');
		const changelogPath = path.join(ROOT_DIR, 'CHANGELOG.md');
		const pkgBefore = await readFile(pkgPath, 'utf8');
		const changelogBefore = await readFile(changelogPath, 'utf8');

		const dryRun = Bun.spawnSync(['bun', 'run', 'version:release', 'prerelease', '--dry-run'], {
			cwd: ROOT_DIR,
			stdout: 'pipe',
			stderr: 'pipe'
		});
		expect(dryRun.exitCode).toBe(0);
		const stdout = new TextDecoder().decode(dryRun.stdout);
		expect(stdout).toContain('0.1.0-beta.1 → 0.1.0-beta.2');
		expect(stdout).toContain('## [0.1.0-beta.2] -');

		expect(await readFile(pkgPath, 'utf8')).toBe(pkgBefore);
		expect(await readFile(changelogPath, 'utf8')).toBe(changelogBefore);

		const invalidRun = Bun.spawnSync(['bun', 'run', 'version:release', 'invalid-bump'], {
			cwd: ROOT_DIR,
			stdout: 'pipe',
			stderr: 'pipe'
		});
		expect(invalidRun.exitCode).not.toBe(0);
	});
});
