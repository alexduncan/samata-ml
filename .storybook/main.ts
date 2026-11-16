import type { StorybookConfig } from '@storybook/web-components-vite';

const config: StorybookConfig = {
	framework: '@storybook/web-components-vite',
	stories: ['../src/**/*.stories.ts'],
	addons: ['@storybook/addon-docs', '@storybook/addon-a11y', '@storybook/addon-vitest'],
	core: { disableTelemetry: true },
	viteFinal: async (config) => ({
		...config,
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
