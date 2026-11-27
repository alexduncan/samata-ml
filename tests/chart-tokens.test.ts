import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { CHART_TOKEN_NAMES } from '../src/features/results/charts/plot-controller';
import {
	MODEL_COLOR_ENCODING,
	computeAxisMargin,
	integerTicks,
	truncateLabel
} from '../src/features/results/charts/chart-encoding';

const css = readFileSync('css/root.css', 'utf8');

function declaration(name: string): string {
	const match = new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(css);
	if (!match) throw new Error(`Missing token ${name}`);
	return match[1]!.trim();
}

function resolve(name: string): string {
	let value = declaration(name);
	for (let depth = 0; depth < 5; depth += 1) {
		const alias = /^var\((--[a-z0-9-]+)\)$/.exec(value);
		if (!alias) break;
		value = declaration(alias[1]!);
	}
	return value;
}

function luminance(shortOrLong: string): number {
	const hex = /^#[0-9a-f]{3}$/i.test(shortOrLong)
		? `#${[...shortOrLong.slice(1)].map((digit) => digit + digit).join('')}`
		: shortOrLong;
	const channels = [1, 3, 5].map((start) => {
		const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
		return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrast(a: string, b: string): number {
	const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (light! + 0.05) / (dark! + 0.05);
}

describe('chart tokens', () => {
	test('WML-P4-CHART-1: declares all chart tokens', () => {
		for (const name of CHART_TOKEN_NAMES) {
			expect(resolve(name)).toMatch(/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i);
		}
	});

	test('WML-P4-CHART-1: every token except the grid reaches 3:1 against the surface', () => {
		const surface = resolve('--surface');
		for (const name of CHART_TOKEN_NAMES.filter((name) => name.startsWith('--chart-'))) {
			if (name === '--chart-grid') continue;
			expect(contrast(resolve(name), surface)).toBeGreaterThanOrEqual(3);
		}
	});

	test('CHT-FOUND-2: model symbols and accessible ink are distinct and contrasted', () => {
		const encodings = Object.values(MODEL_COLOR_ENCODING);
		expect(new Set(encodings.map((item) => item.symbol)).size).toBe(10);
		expect(encodings.filter((item) => item.stroked)).toHaveLength(2);
		for (const item of encodings)
			expect(contrast(resolve(item.token), resolve(item.inkToken))).toBeGreaterThanOrEqual(
				4.5
			);
		expect(contrast(resolve('--amber-500'), resolve('--stone-900'))).toBeGreaterThanOrEqual(3);
	});

	test('CHT-FOUND-2: integer ticks include zero without duplicates', () => {
		for (let max = 1; max <= 3; max++)
			expect(integerTicks(0, max)).toEqual(Array.from({ length: max + 1 }, (_, n) => n));
		expect(integerTicks(-2, 3)).toEqual([-2, -1, 0, 1, 2, 3]);
		const ticks = integerTicks(-12, 34);
		expect(ticks).toContain(0);
		expect(ticks.length).toBeGreaterThanOrEqual(4);
		expect(ticks.length).toBeLessThanOrEqual(7);
		expect(new Set(ticks).size).toBe(ticks.length);
	});

	test('CHT-FOUND-2: integer ticks trim dense grids without losing zero or uniform round spacing', () => {
		for (const [min, max] of [
			[0, 14],
			[-8, 6]
		] as const) {
			const ticks = integerTicks(min, max);
			expect(ticks.length).toBeGreaterThanOrEqual(4);
			expect(ticks.length).toBeLessThanOrEqual(7);
			expect(ticks).toContain(0);
			for (const tick of ticks) {
				expect(Number.isInteger(tick)).toBe(true);
				expect(tick).toBeGreaterThanOrEqual(min);
				expect(tick).toBeLessThanOrEqual(max);
			}
			const spacing = ticks.slice(1).map((tick, index) => tick - ticks[index]!);
			expect(spacing).toEqual(Array(ticks.length - 1).fill(2));
		}
		expect(integerTicks(0, 6)).toEqual([0, 1, 2, 3, 4, 5, 6]);
	});

	test('CHT-FOUND-2: measured margins and grapheme-safe fitting respect the cap', () => {
		const measure = (s: string) =>
			[...s].reduce((sum, char) => sum + (char === 'W' ? 20 : 5), 0);
		expect(computeAxisMargin(['WWWWWW'], 32, 320, measure)).toEqual({
			margin: 121,
			labelWidth: 105
		});
		expect(computeAxisMargin(['abc'], 16, 600, measure)).toEqual({
			margin: 64,
			labelWidth: 56
		});
		expect(truncateLabel('WWWW', 45, measure)).toBe('WW…');
		expect(truncateLabel('abc', 20, measure)).toBe('abc');
		expect(truncateLabel('abc', 4, measure)).toBe('');
		expect(truncateLabel('a\u0301bc', 15, measure)).toBe('a\u0301…');
	});
});
