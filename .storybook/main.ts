import type { StorybookConfig } from '@storybook/web-components-vite';
import { TEST_BUILD_CONSTANTS, toDefine } from '../scripts/build-constants';

const config: StorybookConfig = {
	framework: '@storybook/web-components-vite',
	stories: ['../src/**/*.stories.ts'],
	addons: ['@storybook/addon-docs', '@storybook/addon-a11y', '@storybook/addon-vitest'],
	core: { disableTelemetry: true },
	viteFinal: async (config) => ({
		...config,
		define: {
			...config.define,
			...toDefine(TEST_BUILD_CONSTANTS)
		},
		optimizeDeps: {
			...config.optimizeDeps,
			include: [
				...(config.optimizeDeps?.include ?? []),
				'lit/directives/ref.js',
				'lit/directives/repeat.js',
				'lit/directives/class-map.js',
				'@nanostores/i18n',
				'@nanostores/lit'
			]
		},
		esbuild: { ...config.esbuild, supported: { decorators: false } }
	})
};

export default config;
