import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT_DIR } from '../scripts/config';
import {
	KNOWN_FAILURES,
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
	platform: KnownFailurePlatform
): ListedSpec[] {
	const result = Bun.spawnSync(
		['bunx', 'playwright', 'test', '--list', '--reporter=json', `--project=${project}`],
		{
			cwd: ROOT_DIR,
			env: {
				...process.env,
				SAMATA_SKIP_KNOWN_FAILURES: skipKnownFailures ? '1' : '0',
				SAMATA_KNOWN_FAILURE_PLATFORM: platform
			},
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
