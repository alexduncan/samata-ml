import type { ModelColor } from '../../../types/state';
import type { ChartTokenName, ChartTokens } from './plot-controller';

/** Symbols used to distinguish model identities without relying on colour alone. */
export type ModelPlotSymbol =
	| 'circle'
	| 'square'
	| 'triangle'
	| 'diamond'
	| 'cross'
	| 'star'
	| 'wye'
	| 'hexagon'
	| 'plus'
	| 'times';

/** Palette and symbol assignment for one model colour. */
export type ModelColorEncoding = {
	readonly token: ChartTokenName;
	readonly symbol: ModelPlotSymbol;
	readonly stroked: boolean;
	readonly outlineRequired: boolean;
	readonly inkToken: '--surface' | '--model-swatch-ink';
};

/** Stable, redundant model identity encodings. */
export const MODEL_COLOR_ENCODING: Readonly<Record<ModelColor, ModelColorEncoding>> = {
	amber: {
		token: '--amber-500',
		symbol: 'circle',
		stroked: false,
		outlineRequired: true,
		inkToken: '--model-swatch-ink'
	},
	blue: {
		token: '--blue-700',
		symbol: 'square',
		stroked: false,
		outlineRequired: false,
		inkToken: '--surface'
	},
	teal: {
		token: '--teal-700',
		symbol: 'triangle',
		stroked: false,
		outlineRequired: false,
		inkToken: '--surface'
	},
	purple: {
		token: '--purple-700',
		symbol: 'diamond',
		stroked: false,
		outlineRequired: false,
		inkToken: '--surface'
	},
	red: {
		token: '--red-700',
		symbol: 'cross',
		stroked: false,
		outlineRequired: false,
		inkToken: '--surface'
	},
	green: {
		token: '--green-800',
		symbol: 'star',
		stroked: false,
		outlineRequired: false,
		inkToken: '--surface'
	},
	pink: {
		token: '--pink-700',
		symbol: 'wye',
		stroked: false,
		outlineRequired: false,
		inkToken: '--surface'
	},
	sky: {
		token: '--sky-600',
		symbol: 'hexagon',
		stroked: false,
		outlineRequired: false,
		inkToken: '--model-swatch-ink'
	},
	olive: {
		token: '--olive-700',
		symbol: 'plus',
		stroked: true,
		outlineRequired: false,
		inkToken: '--surface'
	},
	neutral: {
		token: '--neutral-600',
		symbol: 'times',
		stroked: true,
		outlineRequired: false,
		inkToken: '--surface'
	}
};

/** Resolved chart mark styles for an assigned model colour. */
export type ResolvedModelMarkStyle = {
	readonly fill: string;
	readonly dotFill: string;
	readonly dotStroke: string;
	readonly dotStrokeWidth: number;
	readonly barStroke: string;
	readonly barStrokeWidth: number;
	readonly ink: string;
	readonly symbol: ModelPlotSymbol;
	readonly stroked: boolean;
};

/** Resolve token values for marks and bars for one model. */
export function resolveModelMarkStyle(
	color: ModelColor,
	tokens: ChartTokens
): ResolvedModelMarkStyle {
	const e = MODEL_COLOR_ENCODING[color];
	const fill = tokens[e.token];
	const outline = e.outlineRequired ? tokens['--stone-900'] : tokens['--surface'];
	return {
		fill,
		dotFill: e.stroked ? 'none' : fill,
		dotStroke: e.stroked ? fill : outline,
		dotStrokeWidth: e.stroked ? 2 : e.outlineRequired ? 1.5 : 1,
		barStroke: outline,
		barStrokeWidth: 1.5,
		ink: tokens[e.inkToken],
		symbol: e.symbol,
		stroked: e.stroked
	};
}

/** Dataset-class colours in visual order. */
export const DATASET_CLASS_TOKENS: readonly ChartTokenName[] = [
	'--chart-1',
	'--chart-2',
	'--chart-3',
	'--chart-4',
	'--chart-5',
	'--chart-6'
];

/** SVG legend paths in a 16 by 16 centred view box. */
export const PLOT_SYMBOL_PATHS: Readonly<Record<ModelPlotSymbol, string>> = {
	circle: 'M5.046,0A5.046,5.046,0,1,1,-5.046,0A5.046,5.046,0,1,1,5.046,0',
	square: 'M-4.472,-4.472h8.944v8.944h-8.944Z',
	triangle: 'M0,-7.848L6.796,3.924L-6.796,3.924Z',
	diamond: 'M0,-7.5L4.33,0L0,7.5L-4.33,0Z',
	cross: 'M-6,-2L-2,-2L-2,-6L2,-6L2,-2L6,-2L6,2L2,2L2,6L-2,6L-2,2L-6,2Z',
	star: 'M0,-7.5L1.684,-2.318L7.133,-2.318L2.725,0.885L4.408,6.068L0,2.865L-4.408,6.068L-2.725,0.885L-7.133,-2.318L-1.684,-2.318Z',
	wye: 'M2.414,1.394L2.414,6.221L-2.414,6.221L-2.414,1.394L-6.594,-1.02L-4.181,-5.201L0,-2.787L4.181,-5.201L6.594,-1.02Z',
	hexagon: 'M0,-6L5.196,-3L5.196,3L0,6L-5.196,3L-5.196,-3Z',
	plus: 'M-6,0L6,0M0,6L0,-6',
	times: 'M-4.243,-4.243L4.243,4.243M-4.243,4.243L4.243,-4.243'
};

/** Return unique whole-number ticks, including zero, for a range containing zero. */
export function integerTicks(min: number, max: number, targetCount = 5): number[] {
	if (max - min <= 6)
		return Array.from(
			{ length: Math.floor(max) - Math.ceil(min) + 1 },
			(_, i) => Math.ceil(min) + i
		);
	const raw = (max - min) / Math.max(1, targetCount - 1);
	const power = 10 ** Math.floor(Math.log10(raw));
	const candidates = [0.1, 0.2, 0.5, 1, 2, 5, 10].map((n) => Math.max(1, n * power));
	const count = (step: number): number => Math.floor(max / step) - Math.ceil(min / step) + 1;
	const step =
		candidates
			.filter((n) => count(n) >= 4 && count(n) <= 7)
			.sort(
				(a, b) => Math.abs(count(a) - targetCount) - Math.abs(count(b) - targetCount)
			)[0] ?? Math.max(1, power);
	const ticks: number[] = [];
	for (let n = Math.ceil(min / step); n * step <= max; n += 1) ticks.push(n * step || 0);
	return ticks;
}

/** Calculate a bounded axis margin and the space remaining for labels. */
export function computeAxisMargin(
	labels: readonly string[],
	fontSizePx: number,
	containerWidth: number,
	measureText: (text: string) => number,
	maxFraction = 0.38
): { readonly margin: number; readonly labelWidth: number } {
	const upper = Math.floor(containerWidth * maxFraction);
	const lower = Math.min(Math.ceil(fontSizePx * 4), upper);
	const padding = Math.ceil(fontSizePx * 0.5);
	const measured = Math.max(0, ...labels.map(measureText));
	const margin = Math.min(upper, Math.max(lower, Math.ceil(measured + padding)));
	return { margin, labelWidth: Math.max(0, margin - padding) };
}

/** Fit a label to its measured space without splitting grapheme clusters. */
export function truncateLabel(
	label: string,
	labelWidth: number,
	measureText: (text: string) => number
): string {
	if (measureText(label) <= labelWidth) return label;
	if (measureText('…') > labelWidth) return '';
	const graphemes = [
		...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(label)
	].map((part) => part.segment);
	for (let length = graphemes.length - 1; length >= 0; length -= 1) {
		const candidate = graphemes.slice(0, length).join('') + '…';
		if (measureText(candidate) <= labelWidth) return candidate;
	}
	return '';
}
