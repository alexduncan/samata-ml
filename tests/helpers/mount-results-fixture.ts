import type { Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** A browser entry bundled once per suite. */
export interface ResultsFixtureBundle {
	readonly source: string;
	dispose(): void;
}

/** Bundles a browser fixture entry with Bun into a temporary file. */
export function bundleResultsFixture(entry: string): ResultsFixtureBundle {
	const directory = mkdtempSync(join(tmpdir(), 'results-fixture-'));
	const output = join(directory, 'fixture.js');
	execFileSync('bun', ['build', entry, '--target=browser', '--outfile', output]);
	return {
		source: readFileSync(output, 'utf8'),
		dispose: () => rmSync(directory, { recursive: true, force: true })
	};
}

/** Options for the mounted document. */
export interface MountOptions {
	readonly dir?: 'ltr' | 'rtl';
	/** CSS inline size of the column that holds the element. */
	readonly width?: string;
}

/** Name of the `window` property the bundle sets when it is ready. */
export type FixtureKey = 'summaryFixture' | 'errorsFixture' | 'probabilityFixture';

/**
 * Mounts a minimal document with the real tokens and injects the bundle. The bundle must set
 * the `ready` window property as its readiness signal.
 */
export async function mountResultsFixture(
	page: Page,
	bundle: ResultsFixtureBundle,
	ready: FixtureKey,
	options: MountOptions = {}
): Promise<void> {
	const { dir = 'ltr', width = '48rem' } = options;
	await page.setContent(
		`<html lang="en" dir="${dir}"><head><title>Results fixture</title><style>${readFileSync('css/root.css', 'utf8')}body{margin:0;padding:1rem;font-family:var(--font-sans)}</style></head><body><main><h1>Results fixture</h1><div id="column" style="inline-size: ${width}"></div></main></body></html>`
	);
	await page.addScriptTag({ type: 'module', content: bundle.source });
	await page.waitForFunction((key) => key in window, ready);
}
