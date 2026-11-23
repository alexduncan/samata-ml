import { defineConfig, devices } from '@playwright/test';
import { APP_URL, CHECKOUT_PORTS, DIST_URL, MOCKUPS_URL } from './scripts/ports';

export default defineConfig({
	globalSetup: './tests/global-setup.ts',
	testDir: './tests',
	testMatch: /.*\.e2e\.ts/,
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
			use: { ...devices['Desktop Chrome'] }
		},
		{
			name: 'firefox',
			use: { ...devices['Desktop Firefox'] }
		},
		{
			name: 'webkit',
			use: { ...devices['Desktop Safari'] }
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
