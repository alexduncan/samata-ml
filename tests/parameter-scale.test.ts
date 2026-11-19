import { describe, expect, it } from 'bun:test';
import {
	fromSliderPosition,
	parseNumberText,
	sliderBounds,
	toSliderPosition,
	type ScaleConfig
} from '../src/common/parameter-scale';

const log: ScaleConfig = { scale: 'logarithmic', min: 1e-6, max: 1e4, step: 0.1 };
const integer: ScaleConfig = { scale: 'integer', min: 1, max: 100, step: 1 };
const linear: ScaleConfig = { scale: 'linear', min: 0, max: 1, step: 0.01 };

describe('parameter scales (WML-P1-SCALE-1)', () => {
	it('WML-P1-SCALE-1: round-trips logarithmic values within six significant digits', () => {
		for (const value of [1e-6, 0.001, 0.37, 1, 1e4]) {
			const back = fromSliderPosition(toSliderPosition(value, log), log);
			expect(back).toBeCloseTo(value, 12);
			expect(Math.abs(back - value) / value).toBeLessThan(1e-5);
		}
	});

	it('WML-P1-SCALE-1: reports log10 slider bounds', () => {
		expect(sliderBounds(log)).toEqual({ min: -6, max: 4, step: 0.1 });
		expect(sliderBounds(integer)).toEqual({ min: 1, max: 100, step: 1 });
	});

	it('WML-P1-SCALE-1: rounds integer positions and clamps only the position', () => {
		expect(fromSliderPosition(4.4, integer)).toBe(4);
		expect(fromSliderPosition(4.6, integer)).toBe(5);
		expect(toSliderPosition(250, integer)).toBe(100);
		expect(toSliderPosition(-3, integer)).toBe(1);
		expect(toSliderPosition(1e5, log)).toBe(4);
		expect(toSliderPosition(0, log)).toBe(-6);
		expect(toSliderPosition(2, linear)).toBe(1);
		expect(fromSliderPosition(0.3, linear)).toBe(0.3);
	});

	it('WML-P1-SCALE-1: parses numeric text and rejects everything else', () => {
		expect(parseNumberText('0.002')).toBe(0.002);
		expect(parseNumberText(' 1e5 ')).toBe(100000);
		expect(parseNumberText('-2')).toBe(-2);
		for (const bad of ['', '  ', '-', '1e', 'abc', 'Infinity', '0x10', '1,5']) {
			expect(parseNumberText(bad)).toBeNull();
		}
	});
});
