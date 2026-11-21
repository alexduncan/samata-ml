import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { CHART_TOKEN_NAMES } from '../src/features/results/charts/plot-controller';

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
	test('WML-P4-CHART-1: declares all nine tokens as aliases of palette values', () => {
		expect(CHART_TOKEN_NAMES).toHaveLength(9);
		for (const name of CHART_TOKEN_NAMES) {
			expect(declaration(name)).toMatch(/^var\(--[a-z]+-\d+\)$/);
			expect(resolve(name)).toMatch(/^#[0-9a-f]{6}$/i);
		}
	});

	test('WML-P4-CHART-1: every token except the grid reaches 3:1 against the surface', () => {
		const surface = resolve('--surface');
		for (const name of CHART_TOKEN_NAMES) {
			if (name === '--chart-grid') continue;
			expect(contrast(resolve(name), surface)).toBeGreaterThanOrEqual(3);
		}
	});
});
