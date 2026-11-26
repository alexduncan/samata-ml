/**
 * Browser projects configured in `playwright.config.ts`.
 */
export type PlaywrightProjectName = 'chromium' | 'firefox' | 'webkit';

/**
 * Host operating system platforms matched against `process.platform`.
 */
export type KnownFailurePlatform = 'darwin' | 'linux' | 'win32';

/**
 * Metadata describing a pre-existing E2E failure tracked for per-project CI filtering.
 */
export interface KnownFailure {
	/** Short human-readable test or finding identifier. */
	id: string;
	/** Spec file path relative to `tests/`. */
	file: string;
	/** Exact Playwright test title. */
	title: string;
	/** Playwright browser projects where this test consistently fails. */
	projects: readonly PlaywrightProjectName[];
	/** Optional host platforms where the failure applies (defaults to all platforms). */
	platforms?: readonly KnownFailurePlatform[];
	/** Reference substring matching an open item in `specification/HUMAN.md`. */
	human: string;
}

/**
 * Inherited and pre-existing E2E failures verified across two consecutive unflagged runs
 * (plus platform-specific baseline gaps).
 */
export const KNOWN_FAILURES: readonly KnownFailure[] = [
	{
		id: 'PH-AC-2',
		file: 'app-shell.e2e.ts',
		title: 'PH-AC-2: main uses reference geometry and the results header retains semantic markup',
		projects: ['chromium', 'firefox', 'webkit'],
		human: 'Remove shared main padding for full-width content'
	},
	{
		id: 'WML-P2-ROUTE-2',
		file: 'content.e2e.ts',
		title: 'WML-P2-ROUTE-2: Training Setup Help preserves the Model 1 underlay',
		projects: ['chromium'],
		human: 'Repair Chromium content-modal and data-preview E2E failures'
	},
	{
		id: 'PARITY-sidebar-steps',
		file: 'visual-parity.e2e.ts',
		title: 'PARITY-sidebar-steps',
		projects: ['chromium'],
		human: 'Repair inherited visual parity'
	},
	{
		id: 'PARITY-sidebar-step-first',
		file: 'visual-parity.e2e.ts',
		title: 'PARITY-sidebar-step-first',
		projects: ['chromium'],
		human: 'Repair inherited visual parity'
	},
	{
		id: 'PARITY-sidebar-step-adjacent',
		file: 'visual-parity.e2e.ts',
		title: 'PARITY-sidebar-step-adjacent',
		projects: ['chromium'],
		human: 'Repair inherited visual parity'
	},
	{
		id: 'PARITY-sidebar-step-last',
		file: 'visual-parity.e2e.ts',
		title: 'PARITY-sidebar-step-last',
		projects: ['chromium'],
		human: 'Repair inherited visual parity'
	},
	{
		id: 'PARITY-sidebar-step-label',
		file: 'visual-parity.e2e.ts',
		title: 'PARITY-sidebar-step-label',
		projects: ['chromium'],
		human: 'Repair inherited visual parity'
	},
	{
		id: 'PARITY-step-links',
		file: 'visual-parity.e2e.ts',
		title: 'PARITY-step-links',
		projects: ['chromium'],
		human: 'Repair inherited visual parity'
	},
	{
		id: 'PARITY-main',
		file: 'visual-parity.e2e.ts',
		title: 'PARITY-main',
		projects: ['chromium'],
		human: 'Repair inherited visual parity'
	},
	{
		id: 'PARITY-models-features-table',
		file: 'visual-parity.e2e.ts',
		title: 'PARITY-models-features-table',
		projects: ['chromium'],
		human: 'Repair inherited visual parity'
	},
	{
		id: 'SIDE-AC-11',
		file: 'visual-parity.e2e.ts',
		title: 'SIDE-AC-11: a temporary workflow gap fails the blocking geometry assertion and restoration passes',
		projects: ['chromium'],
		human: 'Repair inherited visual parity'
	},
	{
		id: 'SIDE-AC-10',
		file: 'visual-parity.e2e.ts',
		title: 'SIDE-AC-10: paired empty and populated sidebar reference review',
		projects: ['chromium'],
		platforms: ['linux'],
		human: 'Commit Linux Chromium sidebar screenshot baselines'
	},
	{
		id: 'TRAIN-REMOTE-RECOVERY',
		file: 'training-panels.e2e.ts',
		title: 'a remote tab reads the running state and recovers a pending result without fitting again',
		projects: ['firefox'],
		human: 'Fix intermittent full-suite Firefox crash in remote training recovery'
	}
];

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Returns a Playwright `grepInvert` pattern matching every known failure for `project` on `platform`,
 * or `undefined` when no entries apply.
 *
 * @param project - Playwright project name (`chromium`, `firefox`, or `webkit`).
 * @param platform - Target host platform (`darwin`, `linux`, or `win32`).
 * @returns Regular expression matching the applicable known failures, or `undefined`.
 */
export function knownFailureGrep(
	project: string,
	platform: string = process.platform
): RegExp | undefined {
	const patterns = KNOWN_FAILURES.filter(
		(entry) =>
			entry.projects.includes(project as PlaywrightProjectName) &&
			(entry.platforms === undefined ||
				entry.platforms.includes(platform as KnownFailurePlatform))
	).map(
		(entry) => `${escapeRegExp(entry.file)}\\b.*(?:^|\\s)${escapeRegExp(entry.title)}(?=\\s|$)`
	);

	if (patterns.length === 0) {
		return undefined;
	}
	return new RegExp(patterns.join('|'));
}
