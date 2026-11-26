import type { Page } from '@playwright/test';

/**
 * Worker role names recorded in `/release.json`.
 */
export type ReleaseWorkerName = 'storage' | 'training' | 'analysis';

/**
 * Reads `/release.json` from the current page origin and returns the root-absolute worker URL.
 *
 * @param page - Playwright page navigated to the target origin.
 * @param name - Worker key inside `release.json` (`storage`, `training`, or `analysis`).
 * @returns Root-absolute URL for the requested Web Worker script.
 */
export async function workerUrl(page: Page, name: ReleaseWorkerName): Promise<string> {
	return page.evaluate(async (workerName) => {
		const response = await fetch('/release.json', { cache: 'no-store' });
		if (!response.ok) {
			throw new Error(`Failed to fetch /release.json: ${response.status}`);
		}
		const manifest = (await response.json()) as {
			workers?: Record<string, string>;
		};
		const url = manifest.workers?.[workerName];
		if (typeof url !== 'string' || !url.startsWith('/')) {
			throw new Error(`Missing worker URL for "${workerName}" in /release.json`);
		}
		return url;
	}, name);
}
