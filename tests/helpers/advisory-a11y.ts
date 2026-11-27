import type { TestInfo } from '@playwright/test';

/** Severity mode for beta-advisory accessibility checks. */
export type AdvisoryCheckMode = 'warn' | 'error';

/** Returns strict mode only when `SAMATA_ADVISORY_CHECKS` is set to `error`. */
export function advisoryCheckMode(
	env: Record<string, string | undefined> = process.env
): AdvisoryCheckMode {
	return env.SAMATA_ADVISORY_CHECKS === 'error' ? 'error' : 'warn';
}

/**
 * Runs axe on Chromium in warning mode and on every browser in strict mode.
 * Warning mode annotates findings and scan errors. Strict mode fails the test.
 */
export async function runAdvisoryAxe<T extends { id: string; nodes?: unknown[] }>(
	testInfo: Pick<TestInfo, 'project' | 'annotations'>,
	scan: () => Promise<readonly T[]>,
	options: {
		readonly label?: string;
		readonly mode?: AdvisoryCheckMode;
		readonly warn?: (message: string) => void;
	} = {}
): Promise<void> {
	const { label = 'a11y', mode = advisoryCheckMode(), warn = console.warn } = options;
	const browser = testInfo.project.name;
	if (mode === 'warn' && browser !== 'chromium') {
		testInfo.annotations.push({
			type: 'a11y-skipped',
			description: `${label}: skipped advisory WCAG scan on ${browser} (beta Chromium-only)`
		});
		return;
	}

	let violations: readonly T[];
	try {
		violations = await scan();
	} catch (error) {
		if (mode === 'error') throw error;
		const message = error instanceof Error ? error.message : String(error);
		const description = `${label}: advisory WCAG scan failed (${message})`;
		testInfo.annotations.push({ type: 'a11y-warning', description });
		warn(description);
		return;
	}

	if (violations.length === 0) return;
	const ids = violations
		.map(({ id, nodes }) => (Array.isArray(nodes) ? `${id} (${nodes.length})` : id))
		.join(', ');
	if (mode === 'error') {
		throw new Error(`${label}: ${violations.length} WCAG finding(s) (${ids})`);
	}
	const description = `${label}: ${violations.length} advisory WCAG finding(s) (${ids})`;
	testInfo.annotations.push({ type: 'a11y-warning', description });
	warn(description);
}
