/** How a slider position maps to a parameter value. */
export type ParameterScale = 'linear' | 'logarithmic' | 'integer';

/** Recommended slider range and mapping for one numeric parameter. */
export interface ScaleConfig {
	/** Mapping between slider position and value. */
	scale: ParameterScale;
	/** Smallest recommended value (always positive for `logarithmic`). */
	min: number;
	/** Largest recommended value. */
	max: number;
	/** Slider step in position space (powers of ten for `logarithmic`). */
	step: number;
	/** Significant digits kept when converting a position to a value. Defaults to 6. */
	precision?: number;
}

/** Native `<input type="range">` bounds for a scale. */
export interface SliderBounds {
	/** Slider `min` attribute. */
	min: number;
	/** Slider `max` attribute. */
	max: number;
	/** Slider `step` attribute. */
	step: number;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

/**
 * Returns the slider position bounds for a scale (exponents for logarithmic scales).
 *
 * @param config - Scale configuration.
 * @returns The `min`, `max` and `step` to set on a range input.
 */
export function sliderBounds(config: ScaleConfig): SliderBounds {
	if (config.scale === 'logarithmic') {
		return { min: Math.log10(config.min), max: Math.log10(config.max), step: config.step };
	}
	return { min: config.min, max: config.max, step: config.step };
}

/**
 * Converts a parameter value to a slider position, clamping the value to the recommended range.
 * Values outside the range park the slider at the nearest end without altering the value itself.
 *
 * @param value - Parameter value.
 * @param config - Scale configuration.
 * @returns Position to assign to the range input.
 */
export function toSliderPosition(value: number, config: ScaleConfig): number {
	const clamped = Number.isFinite(value) ? clamp(value, config.min, config.max) : config.min;
	return config.scale === 'logarithmic' ? Math.log10(clamped) : clamped;
}

/**
 * Converts a slider position to a parameter value.
 *
 * @param position - Range input value.
 * @param config - Scale configuration.
 * @returns The parameter value: rounded for `integer`, `10 ** position` for `logarithmic`.
 */
export function fromSliderPosition(position: number, config: ScaleConfig): number {
	const bounds = sliderBounds(config);
	const clamped = clamp(position, bounds.min, bounds.max);
	const precision = config.precision ?? 6;
	if (config.scale === 'integer') {
		return Math.round(clamped);
	}
	if (config.scale === 'logarithmic') {
		return Number((10 ** clamped).toPrecision(precision));
	}
	return Number(clamped.toPrecision(precision));
}

const NUMBER_TEXT = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

/**
 * Parses user-entered numeric text.
 *
 * @param text - Raw text from a number input.
 * @returns The finite number, or `null` for blank, malformed or non-finite text.
 */
export function parseNumberText(text: string): number | null {
	const trimmed = text.trim();
	if (!NUMBER_TEXT.test(trimmed)) return null;
	const value = Number(trimmed);
	return Number.isFinite(value) ? value : null;
}
