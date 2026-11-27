import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT_DIR } from '../scripts/config';
import type { AdvisoryCheckMode } from './helpers/advisory-a11y';
import {
	KNOWN_FAILURES,
	knownFailureGrep,
	type KnownFailure,
	type KnownFailurePlatform,
	type PlaywrightProjectName
} from './known-failures';

interface PlaywrightSpecNode {
	title: string;
	file: string;
	line: number;
}

interface PlaywrightSuiteNode {
	title: string;
	file?: string;
	suites?: PlaywrightSuiteNode[];
	specs?: PlaywrightSpecNode[];
}

interface PlaywrightListReport {
	suites: PlaywrightSuiteNode[];
}

interface ListedSpec {
	key: string;
	file: string;
	title: string;
	line: number;
}

function collectSpecs(
	suites: PlaywrightSuiteNode[] | undefined,
	describePath: string[] = []
): ListedSpec[] {
	if (!suites) return [];
	const collected: ListedSpec[] = [];
	for (const suite of suites) {
		const isFileLevel = suite.file !== undefined && suite.title === suite.file;
		const nextPath =
			isFileLevel || !suite.title ? describePath : [...describePath, suite.title];
		if (suite.specs) {
			for (const spec of suite.specs) {
				collected.push({
					key: `${spec.file}::${nextPath.join(' > ')}::${spec.title}`,
					file: spec.file,
					title: spec.title,
					line: spec.line
				});
			}
		}
		if (suite.suites) {
			collected.push(...collectSpecs(suite.suites, nextPath));
		}
	}
	return collected;
}

function listPlaywrightSpecs(
	project: PlaywrightProjectName,
	skipKnownFailures: boolean,
	platform: KnownFailurePlatform,
	tier?: 'blocking',
	mode?: AdvisoryCheckMode,
	inheritedEnv = process.env
): ListedSpec[] {
	const env: NodeJS.ProcessEnv = {
		...inheritedEnv,
		SAMATA_SKIP_KNOWN_FAILURES: skipKnownFailures ? '1' : '0',
		SAMATA_KNOWN_FAILURE_PLATFORM: platform
	};
	delete env.SAMATA_E2E_TIER;
	delete env.SAMATA_ADVISORY_CHECKS;
	if (tier) env.SAMATA_E2E_TIER = tier;
	if (mode) env.SAMATA_ADVISORY_CHECKS = mode;
	const result = Bun.spawnSync(
		['bunx', 'playwright', 'test', '--list', '--reporter=json', `--project=${project}`],
		{
			cwd: ROOT_DIR,
			env,
			stdout: 'pipe',
			stderr: 'pipe'
		}
	);
	if (result.exitCode !== 0) {
		const stderr = new TextDecoder().decode(result.stderr);
		throw new Error(`playwright --list failed for ${project}/${platform}: ${stderr}`);
	}
	const report = JSON.parse(new TextDecoder().decode(result.stdout)) as PlaywrightListReport;
	return collectSpecs(report.suites);
}

describe('known E2E failures', () => {
	test('beta CI has no suppressed functional specs', () => {
		expect(KNOWN_FAILURES).toHaveLength(0);
		expect(knownFailureGrep('chromium')).toBeUndefined();
	});

	test('matches only the exact synthetic spec on its project and platform', () => {
		const title = 'Example: value [a] + value (b)';
		const entries: KnownFailure[] = [
			{
				id: 'FIXTURE-1',
				file: 'example.e2e.ts',
				title,
				projects: ['chromium'],
				platforms: ['linux'],
				human: 'Example follow-up'
			}
		];
		const pattern = knownFailureGrep('chromium', 'linux', entries);
		expect(`chromium example.e2e.ts A describe ${title}`).toMatch(pattern!);
		expect(`example.e2e.ts ${title}`).toMatch(pattern!);
		expect(`chromium other-example.e2e.ts ${title}`).not.toMatch(pattern!);
		expect(`chromium example.e2e.ts ${title} too`).not.toMatch(pattern!);
		expect('chromium example.e2e.ts Example: value a + value b').not.toMatch(pattern!);
		expect(knownFailureGrep('chromium', 'darwin', entries)).toBeUndefined();
		expect(knownFailureGrep('firefox', 'linux', entries)).toBeUndefined();
	});

	test('blocking selection isolates inherited tier and severity', () => {
		const collect = (tier?: 'blocking', mode?: AdvisoryCheckMode) =>
			listPlaywrightSpecs('chromium', false, 'linux', tier, mode, {
				...process.env,
				SAMATA_E2E_TIER: 'blocking',
				SAMATA_ADVISORY_CHECKS: mode === 'error' ? 'warn' : 'error'
			}).map(({ key, file }) => ({ key, file }));
		const all = collect();
		const dedicated = ['visual-parity.e2e.ts', 'a11y.e2e.ts'];
		const functional = all.filter(({ file }) => !dedicated.includes(file));
		for (const name of [...dedicated, 'chart-accessibility.e2e.ts']) {
			expect(all.some(({ file }) => file === name)).toBe(true);
		}
		expect(collect(undefined, 'warn')).toEqual(all);
		expect(collect(undefined, 'error')).toEqual(all);
		expect(collect('blocking')).toEqual(functional);
		expect(collect('blocking', 'warn')).toEqual(functional);
		expect(collect('blocking', 'error')).toEqual(all);
	}, 60_000);

	test('REL-KF-1: each entry maps to HUMAN.md and removes exactly one intended spec per project and platform', async () => {
		const humanText = await readFile(path.join(ROOT_DIR, 'specification', 'HUMAN.md'), 'utf8');
		for (const entry of KNOWN_FAILURES) {
			expect(humanText).toContain(entry.human);
		}

		const projects: PlaywrightProjectName[] = ['chromium', 'firefox', 'webkit'];
		const platforms: KnownFailurePlatform[] = ['darwin', 'linux'];

		for (const project of projects) {
			for (const platform of platforms) {
				const unflagged = listPlaywrightSpecs(project, false, platform);
				const flagged = listPlaywrightSpecs(project, true, platform);
				const flaggedKeys = new Set(flagged.map((spec) => spec.key));
				const removed = unflagged.filter((spec) => !flaggedKeys.has(spec.key));

				const applicable = KNOWN_FAILURES.filter(
					(entry) =>
						entry.projects.includes(project) &&
						(entry.platforms === undefined || entry.platforms.includes(platform))
				);

				expect(removed).toHaveLength(applicable.length);
				for (const entry of applicable) {
					const matching = removed.filter(
						(spec) => spec.file === entry.file && spec.title === entry.title
					);
					expect(matching).toHaveLength(1);
				}

				if (platform === 'darwin') {
					expect(
						removed.some(
							(spec) =>
								spec.file === 'visual-parity.e2e.ts' &&
								spec.title.startsWith('SIDE-AC-10: paired')
						)
					).toBe(false);
				}

				// Passing SIDE-AC-10 tests must never be removed on either platform.
				expect(
					flagged.some(
						(spec) =>
							spec.file === 'visual-parity.e2e.ts' &&
							spec.title.startsWith('SIDE-AC-10: hover')
					)
				).toBe(true);
				expect(
					flagged.some(
						(spec) =>
							spec.file === 'sidebar-acceptance.e2e.ts' &&
							spec.title.startsWith('SIDE-AC-10:')
					)
				).toBe(true);
			}
		}
	}, 60_000);
});
