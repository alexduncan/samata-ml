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

/** E2E failures specifically approved for per-project suppression. */
export const KNOWN_FAILURES: readonly KnownFailure[] = [];

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Returns a Playwright `grepInvert` pattern matching every known failure for `project` on `platform`,
 * or `undefined` when no entries apply.
 *
 * @param project - Playwright project name (`chromium`, `firefox`, or `webkit`).
 * @param platform - Target host platform (`darwin`, `linux`, or `win32`).
 * @param entries - Optional failure entries to match. Defaults to the repository register.
 * @returns Regular expression matching the applicable known failures, or `undefined`.
 */
export function knownFailureGrep(
	project: string,
	platform: string = process.platform,
	entries: readonly KnownFailure[] = KNOWN_FAILURES
): RegExp | undefined {
	const applicable = entries.filter(
		(entry) =>
			entry.projects.includes(project as PlaywrightProjectName) &&
			(entry.platforms === undefined ||
				entry.platforms.includes(platform as KnownFailurePlatform))
	);
	const patterns = applicable.map(({ file, title }) => {
		const spec = escapeRegExp(file);
		const test = escapeRegExp(title);
		return `(?:^|\\s)${spec}\\s+(?:.*\\s)?${test}$`;
	});

	if (patterns.length === 0) {
		return undefined;
	}
	return new RegExp(patterns.join('|'));
}
