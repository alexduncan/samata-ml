const { execFileSync } = require('node:child_process');
const { dirname } = require('node:path');

function cssOrderPlugin() {
	const plugin = 'prettier-plugin-css-order';
	try {
		return require.resolve(plugin);
	} catch (error) {
		if (error.code !== 'MODULE_NOT_FOUND') throw error;
	}
	// The primary checkout provides the plugin when this linked worktree has no dependencies.
	const commonDir = execFileSync(
		'git',
		['rev-parse', '--path-format=absolute', '--git-common-dir'],
		{ cwd: __dirname, encoding: 'utf8' }
	).trim();
	return require.resolve(plugin, { paths: [dirname(commonDir)] });
}

module.exports = {
	trailingComma: 'none',
	printWidth: 100,
	tabWidth: 4,
	useTabs: true,
	semi: true,
	singleQuote: true,
	bracketSpacing: true,
	bracketSameLine: true,
	arrowParens: 'always',
	plugins: [cssOrderPlugin()],
	overrides: [
		{
			files: ['**/*.css', '**/*.html'],
			options: {
				singleQuote: false
			}
		}
	]
};
