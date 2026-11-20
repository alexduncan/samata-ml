import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './tests',
	testMatch: /.*\.e2e\.ts/,
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: 'list',
	use: {
		baseURL: 'https://localhost:3000',
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
			command: 'bun run server',
			url: 'https://localhost:3000',
			env: { SAMATA_TRAINING_RUNTIME_PROBE: '1' },
			ignoreHTTPSErrors: true,
			reuseExistingServer: !process.env.CI
		},
		{
			command: 'bun run build && bun run server --dist',
			url: 'https://localhost:3001',
			env: { SAMATA_SERVER_PORT: '3001', SAMATA_TRAINING_RUNTIME_PROBE: '1' },
			ignoreHTTPSErrors: true,
			reuseExistingServer: false
		},
		{
			command: 'bun run serve:mockups --port 3333',
			url: 'http://localhost:3333',
			reuseExistingServer: !process.env.CI
		}
	]
});
