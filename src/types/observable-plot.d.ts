// Plot 0.6.18 ships declarations but does not expose them through its package exports.
declare module '@observablehq/plot' {
	const plot: typeof import('../../node_modules/@observablehq/plot/src/index.js');
	export = plot;
}
