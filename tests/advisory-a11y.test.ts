import { describe, expect, mock, test } from 'bun:test';
import type { TestInfo } from '@playwright/test';
import { advisoryCheckMode, runAdvisoryAxe } from './helpers/advisory-a11y';

function testInfoFor(name: string): Pick<TestInfo, 'project' | 'annotations'> {
	// The helper reads only the project name.
	return { project: { name } as TestInfo['project'], annotations: [] };
}

const violations = [{ id: 'image-alt', nodes: [{}, {}] }, { id: 'label' }];

describe('advisoryCheckMode', () => {
	test('defaults to warn when the variable is absent or unrecognised', () => {
		expect(advisoryCheckMode({})).toBe('warn');
		expect(advisoryCheckMode({ SAMATA_ADVISORY_CHECKS: 'ERROR' })).toBe('warn');
	});

	test('selects strict mode for the exact error setting', () => {
		expect(advisoryCheckMode({ SAMATA_ADVISORY_CHECKS: 'error' })).toBe('error');
	});
});

describe('runAdvisoryAxe', () => {
	test('annotates and logs Chromium findings in warn mode', async () => {
		const info = testInfoFor('chromium');
		const warn = mock();
		const description = 'example: 2 advisory WCAG finding(s) (image-alt (2), label)';

		const scan = async () => violations;
		await runAdvisoryAxe(info, scan, { label: 'example', mode: 'warn', warn });

		expect(info.annotations).toEqual([{ type: 'a11y-warning', description }]);
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn).toHaveBeenCalledWith(description);
	});

	test('annotates and logs Chromium scan errors in warn mode', async () => {
		const info = testInfoFor('chromium');
		const warn = mock();
		const description = 'a11y: advisory WCAG scan failed (axe unavailable)';
		const scan = async () => {
			throw new Error('axe unavailable');
		};

		await runAdvisoryAxe(info, scan, { mode: 'warn', warn });

		expect(info.annotations).toEqual([{ type: 'a11y-warning', description }]);
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn).toHaveBeenCalledWith(description);
	});

	test.each(['firefox', 'webkit'])('skips %s in warn mode', async (browser) => {
		const info = testInfoFor(browser);
		const scan = mock(async () => violations);
		const warn = mock();

		await runAdvisoryAxe(info, scan, { mode: 'warn', warn });

		expect(scan).not.toHaveBeenCalled();
		expect(warn).not.toHaveBeenCalled();
		expect(info.annotations).toEqual([
			{
				type: 'a11y-skipped',
				description: `a11y: skipped advisory WCAG scan on ${browser} (beta Chromium-only)`
			}
		]);
	});

	test.each(['chromium', 'firefox', 'webkit'])(
		'rejects with rule and node counts on %s in error mode',
		async (browser) => {
			const info = testInfoFor(browser);
			const warn = mock();

			const scan = async () => violations;
			const result = runAdvisoryAxe(info, scan, { label: 'example', mode: 'error', warn });

			await expect(result).rejects.toEqual(
				new Error('example: 2 WCAG finding(s) (image-alt (2), label)')
			);
			expect(info.annotations).toEqual([]);
			expect(warn).not.toHaveBeenCalled();
		}
	);

	test.each(['chromium', 'firefox', 'webkit'])(
		'rethrows scan errors from %s in error mode',
		async (browser) => {
			const error = new Error('axe unavailable');
			const scan = async () => {
				throw error;
			};
			const result = runAdvisoryAxe(testInfoFor(browser), scan, { mode: 'error' });
			await expect(result).rejects.toBe(error);
		}
	);
});

test('the Bun DOM setup leaves XMLHttpRequest off the Node global', () => {
	expect('XMLHttpRequest' in globalThis).toBe(false);
});
