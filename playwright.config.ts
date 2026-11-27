import { defineConfig, devices } from '@playwright/test';
import { APP_URL, CHECKOUT_PORTS, DIST_URL, MOCKUPS_URL } from './scripts/ports';
import { advisoryCheckMode } from './tests/helpers/advisory-a11y';
import { knownFailureGrep } from './tests/known-failures';

const ADVISORY_SPEC_FILES = ['**/visual-parity.e2e.ts', '**/a11y.e2e.ts'];

function projectGrepInvert(name: string): RegExp | undefined {
	if (process.env.SAMATA_SKIP_KNOWN_FAILURES !== '1') {
		return undefined;
	}
	return knownFailureGrep(name, process.env.SAMATA_KNOWN_FAILURE_PLATFORM ?? process.platform);
}

export default defineConfig({
	globalSetup: './tests/global-setup.ts',
	testDir: './tests',
	testMatch: /.*\.e2e\.ts/,
	testIgnore:
		process.env.SAMATA_E2E_TIER === 'blocking' && advisoryCheckMode() === 'warn'
			? ADVISORY_SPEC_FILES
			: undefined,
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: 'list',
	use: {
		baseURL: APP_URL,
		ignoreHTTPSErrors: true,
		trace: 'on-first-retry'
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
			grepInvert: projectGrepInvert('chromium')
		},
		{
			name: 'firefox',
			use: { ...devices['Desktop Firefox'] },
			grepInvert: projectGrepInvert('firefox')
		},
		{
			name: 'webkit',
			use: { ...devices['Desktop Safari'] },
			grepInvert: projectGrepInvert('webkit')
		}
	],
	webServer: [
		{
			command: `bun run server --port ${CHECKOUT_PORTS.app}`,
			url: APP_URL,
			env: { SAMATA_TRAINING_RUNTIME_PROBE: '1' },
			ignoreHTTPSErrors: true,
			reuseExistingServer: !process.env.CI
		},
		{
			command: `bun run build && bun run server --dist --port ${CHECKOUT_PORTS.dist}`,
			url: DIST_URL,
			env: { SAMATA_TRAINING_RUNTIME_PROBE: '1' },
			ignoreHTTPSErrors: true,
			reuseExistingServer: false
		},
		{
			command: `bun run mockups --port ${CHECKOUT_PORTS.mockups}`,
			url: MOCKUPS_URL,
			reuseExistingServer: !process.env.CI
		}
	]
});
