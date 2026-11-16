import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

export default defineConfig({
	test: {
		projects: [
			{
				optimizeDeps: {
					include: [
						'lit/directives/ref.js',
						'lit/directives/repeat.js',
						'lit/directives/class-map.js',
						'@nanostores/i18n',
						'@nanostores/lit'
					]
				},
				esbuild: { supported: { decorators: false } },
				plugins: [
					storybookTest({ configDir: '.storybook', storybookScript: 'bun run storybook' })
				],
				test: {
					name: 'storybook',
					exclude: ['tests/**'],
					browser: {
						enabled: true,
						headless: true,
						provider: playwright(),
						instances: [
							{ browser: 'chromium' },
							{ browser: 'firefox' },
							{ browser: 'webkit' }
						]
					}
				}
			}
		]
	}
});
