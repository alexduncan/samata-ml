import type {
	CellValue,
	DateColumnStats,
	DatetimeColumnStats,
	NumericColumnStats
} from '../../types/dataset';
import type { ColumnType } from '../../types/state';

/** Default case-insensitive missing-value tokens. */
export const DEFAULT_MISSING_VALUE_TOKENS = [
	'',
	'null',
	'nan',
	'na',
	'n/a',
	'none',
	'nil',
	'-',
	'?'
] as const;

/** Boolean token pairs, ordered as true token followed by false token. */
export const BOOLEAN_LEXICON_PAIRS = [
	['true', 'false'],
	['t', 'f'],
	['yes', 'no'],
	['y', 'n'],
	['1', '0']
] as const;

/** A cell after missing-value normalisation, including the token used for transparency counts. */
export interface NormalisedCell {
	/** Trimmed cell value, or null when the cell is missing. */
	value: string | null;
	/** Lower-case missing token to count, or null for a present value. */
	missingToken: string | null;
}

/** Components returned when a cell matches the numeric grammar. */
export interface ParsedNumber {
	/** Parsed finite numeric value. */
	value: number;
	/** Currency prefix as written, or the empty string. */
	prefix: '' | '$' | '€' | '£';
	/** Percent suffix as written, or the empty string. */
	suffix: '' | '%';
	/** Whether the integer part used valid comma grouping. */
	grouped: boolean;
}

/** Parsed epoch value and the source unit inferred from its digit count. */
export interface ParsedEpoch {
	/** Epoch timestamp converted to milliseconds. */
	ms: number;
	/** Unit represented by the source digit count. */
	unit: 's' | 'ms' | 'us';
}

/** Components of a recognised date or timestamp before ambiguous order is elected. */
export interface DateParts {
	/** Source date form. */
	form: 'iso' | 'numeric' | 'named';
	/** Four-digit year after applying the two-digit pivot. */
	y: number;
	/** Month from 1 to 12, or null until year-last order is chosen. */
	m: number | null;
	/** Day from 1 to 31, or null until year-last order is chosen. */
	d: number | null;
	/** First year-last numeric date field as written. */
	firstPart: number | null;
	/** Second year-last numeric date field as written. */
	secondPart: number | null;
	/** Hour, defaulting to zero when no time is present. */
	h: number;
	/** Minute, defaulting to zero when no time is present. */
	mi: number;
	/** Second, defaulting to zero when no time is present. */
	s: number;
	/** Millisecond fraction, defaulting to zero when no fraction is present. */
	ms: number;
	/** ISO zone offset in minutes, or null when no zone is present. */
	offsetMin: number | null;
	/** Whether the source text contained a time. */
	hasTime: boolean;
}

/** Possible interpretations for an ambiguous year-last numeric date. */
export type DateOrder = 'ISO' | 'DMY' | 'MDY';

/** Display format information accepted by {@link coerceCell}. */
export type CellFormat =
	| NumericColumnStats['format']
	| DatetimeColumnStats['format']
	| DateColumnStats['format']
	| readonly [string, string]
	| undefined;

/**
 * Trims a cell and maps configured or implicit missing values to null.
 *
 * A provided token list replaces the defaults, except that an empty cell is always missing.
 * Numeric implicit values match equivalent numeric spellings such as `0` and `0.0`.
 *
 * @param raw - Raw CSV cell text.
 * @param tokens - Optional replacement missing-token list.
 * @param implicit - Additional string or numeric missing values for this column.
 * @returns The trimmed value and, for missing cells, the normalised token to count.
 */
export function normaliseMissing(
	raw: string,
	tokens: readonly string[] = DEFAULT_MISSING_VALUE_TOKENS,
	implicit: readonly (string | number)[] = []
): NormalisedCell {
	const value = raw.trim();
	const normalised = value.toLowerCase();
	if (normalised === '') return { value: null, missingToken: '' };

	const normalisedTokens = new Set(tokens.map((token) => token.trim().toLowerCase()));
	normalisedTokens.add('');
	if (normalisedTokens.has(normalised)) return { value: null, missingToken: normalised };

	for (const implicitValue of implicit) {
		if (typeof implicitValue === 'number') {
			const numericValue = Number(value);
			if (Number.isFinite(numericValue) && numericValue === implicitValue) {
				return { value: null, missingToken: normalised };
			}
		} else if (normalised === implicitValue.trim().toLowerCase()) {
			return { value: null, missingToken: normalised };
		}
	}

	return { value, missingToken: null };
}

/**
 * Returns the matching token index in the flattened boolean lexicons, or -1.
 *
 * Even indexes represent the true token and the following odd index its paired false token.
 *
 * @param cell - Cell text to match.
 * @returns Flattened lexicon index, or -1 when no boolean token matches.
 */
export function matchBoolean(cell: string): number {
	const normalised = cell.trim().toLowerCase();
	for (let pairIndex = 0; pairIndex < BOOLEAN_LEXICON_PAIRS.length; pairIndex++) {
		const pair = BOOLEAN_LEXICON_PAIRS[pairIndex]!;
		if (normalised === pair[0]) return pairIndex * 2;
		if (normalised === pair[1]) return pairIndex * 2 + 1;
	}
	if (normalised === '1.0') return BOOLEAN_LEXICON_PAIRS.length * 2 - 2;
	if (normalised === '0.0') return BOOLEAN_LEXICON_PAIRS.length * 2 - 1;
	return -1;
}

const NUMBER_PATTERN =
	/^([+-]?)([$€£]?)([+-]?)(\d{1,3}(?:,\d{3})+|\d+)?(\.\d+)?([eE][+-]?\d+)?(%?)$/;

/** Parses a number with the supported sign, currency, grouping, exponent and percent syntax. */
export function parseNumber(cell: string): ParsedNumber | null {
	const match = NUMBER_PATTERN.exec(cell.trim());
	if (!match) return null;
	const [, leadingSign, prefix, trailingSign, integerPart, fraction, exponent, suffix] = match;
	if (leadingSign && trailingSign) return null;
	if (!integerPart && !fraction) return null;
	if (integerPart && integerPart.length > 1 && integerPart.startsWith('0') && !fraction) {
		return null;
	}

	const digits = `${integerPart ?? ''}${fraction ?? ''}${exponent ?? ''}`.replaceAll(',', '');
	const value = Number(`${leadingSign || trailingSign}${digits}`);
	if (!Number.isFinite(value)) return null;
	return {
		value,
		prefix: prefix as ParsedNumber['prefix'],
		suffix: suffix as ParsedNumber['suffix'],
		grouped: Boolean(integerPart?.includes(','))
	};
}

const EPOCH_PATTERN = /^[1-9](?:\d{9}|\d{12}|\d{15})$/;
const MIN_EPOCH_MS = 315_532_800_000;
const MAX_EPOCH_MS = 2_524_608_000_000;

/** Parses 10-, 13- or 16-digit epoch timestamps within the supported 1980–2050 window. */
export function parseEpoch(cell: string): ParsedEpoch | null {
	const value = cell.trim();
	if (!EPOCH_PATTERN.test(value)) return null;
	const unit = value.length === 10 ? 's' : value.length === 13 ? 'ms' : 'us';
	const numericValue = Number(value);
	if (!Number.isSafeInteger(numericValue)) return null;
	const ms =
		unit === 's'
			? numericValue * 1000
			: unit === 'us'
				? Math.floor(numericValue / 1000)
				: numericValue;
	if (ms < MIN_EPOCH_MS || ms >= MAX_EPOCH_MS) return null;
	return { ms, unit };
}

const DATE_PATTERNS = [
	{
		form: 'iso',
		pattern:
			/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}(?::?\d{2})?)?)?$/i
	},
	{
		form: 'numeric-ymd',
		pattern: /^(\d{4})([/-])(\d{1,2})\2(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/i
	},
	{
		form: 'numeric-xxy',
		pattern: /^(\d{1,2})([/-])(\d{1,2})\2(\d{4}|\d{2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/i
	},
	{
		form: 'named-dmy',
		pattern:
			/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,9})\.?,?\s+(\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/i
	},
	{
		form: 'named-mdy',
		pattern:
			/^([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/i
	}
] as const;

const MONTHS: Record<string, number> = {
	jan: 1,
	january: 1,
	feb: 2,
	february: 2,
	mar: 3,
	march: 3,
	apr: 4,
	april: 4,
	may: 5,
	jun: 6,
	june: 6,
	jul: 7,
	july: 7,
	aug: 8,
	august: 8,
	sep: 9,
	sept: 9,
	september: 9,
	oct: 10,
	october: 10,
	nov: 11,
	november: 11,
	dec: 12,
	december: 12
};

function validCalendarDate(year: number, month: number, day: number): boolean {
	if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return false;
	const date = new Date(Date.UTC(year, month - 1, day));
	return (
		date.getUTCFullYear() === year &&
		date.getUTCMonth() === month - 1 &&
		date.getUTCDate() === day
	);
}

function validTime(hour: number, minute: number, second: number): boolean {
	return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 && second >= 0 && second <= 59;
}

function parseOffset(zone: string | undefined): number | null | false {
	if (!zone) return null;
	if (zone.toUpperCase() === 'Z') return 0;
	const match = /^([+-])(\d{2})(?::?(\d{2}))?$/.exec(zone);
	if (!match) return false;
	const hours = Number(match[2]);
	const minutes = Number(match[3] ?? '0');
	if (hours > 14 || minutes > 59) return false;
	const offset = hours * 60 + minutes;
	return match[1] === '-' ? -offset : offset;
}

function twoDigitYear(year: number): number {
	return year <= 49 ? 2000 + year : 1900 + year;
}

function buildDateParts(
	form: DateParts['form'],
	year: number,
	month: number | null,
	day: number | null,
	firstPart: number | null,
	secondPart: number | null,
	hour: number,
	minute: number,
	second: number,
	ms: number,
	offsetMin: number | null,
	hasTime: boolean
): DateParts | null {
	if (year < 1000 || year > 9999 || !validTime(hour, minute, second)) return null;
	if (month !== null && day !== null && !validCalendarDate(year, month, day)) return null;
	if (month === null || day === null) {
		const validDMY = validCalendarDate(year, secondPart ?? 0, firstPart ?? 0);
		const validMDY = validCalendarDate(year, firstPart ?? 0, secondPart ?? 0);
		if (!validDMY && !validMDY) return null;
	}
	return {
		form,
		y: year,
		m: month,
		d: day,
		firstPart,
		secondPart,
		h: hour,
		mi: minute,
		s: second,
		ms,
		offsetMin,
		hasTime
	};
}

/** Parses a supported ISO, numeric or English named date without implementation-dependent parsing. */
export function parseDate(cell: string): DateParts | null {
	const value = cell.trim();
	for (const { form, pattern } of DATE_PATTERNS) {
		const match = pattern.exec(value);
		if (!match) continue;

		if (form === 'iso') {
			const year = Number(match[1]);
			const month = Number(match[2]);
			const day = Number(match[3]);
			const hasTime = match[4] !== undefined;
			const hour = Number(match[4] ?? 0);
			const minute = Number(match[5] ?? 0);
			const second = Number(match[6] ?? 0);
			const fraction = match[7] ?? '';
			const ms = Number(fraction.slice(0, 3).padEnd(3, '0'));
			const offsetMin = parseOffset(match[8]);
			if (offsetMin === false) return null;
			return buildDateParts(
				'iso',
				year,
				month,
				day,
				null,
				null,
				hour,
				minute,
				second,
				ms,
				offsetMin,
				hasTime
			);
		}

		if (form === 'numeric-ymd') {
			const year = Number(match[1]);
			const month = Number(match[3]);
			const day = Number(match[4]);
			const hasTime = match[5] !== undefined;
			return buildDateParts(
				'numeric',
				year,
				month,
				day,
				null,
				null,
				Number(match[5] ?? 0),
				Number(match[6] ?? 0),
				Number(match[7] ?? 0),
				0,
				null,
				hasTime
			);
		}

		if (form === 'numeric-xxy') {
			const firstPart = Number(match[1]);
			const secondPart = Number(match[3]);
			const rawYear = Number(match[4]);
			const year = match[4]!.length === 2 ? twoDigitYear(rawYear) : rawYear;
			const hasTime = match[5] !== undefined;
			return buildDateParts(
				'numeric',
				year,
				null,
				null,
				firstPart,
				secondPart,
				Number(match[5] ?? 0),
				Number(match[6] ?? 0),
				Number(match[7] ?? 0),
				0,
				null,
				hasTime
			);
		}

		if (form === 'named-dmy') {
			const day = Number(match[1]);
			const month = MONTHS[match[2]!.toLowerCase()];
			if (month === undefined) return null;
			return buildDateParts(
				'named',
				Number(match[3]),
				month,
				day,
				null,
				null,
				Number(match[4] ?? 0),
				Number(match[5] ?? 0),
				Number(match[6] ?? 0),
				0,
				null,
				match[4] !== undefined
			);
		}

		const month = MONTHS[match[1]!.toLowerCase()];
		if (month === undefined) return null;
		return buildDateParts(
			'named',
			Number(match[3]),
			month,
			Number(match[2]),
			null,
			null,
			Number(match[4] ?? 0),
			Number(match[5] ?? 0),
			Number(match[6] ?? 0),
			0,
			null,
			match[4] !== undefined
		);
	}
	return null;
}

/** Converts parsed date parts to UTC epoch milliseconds using the requested ambiguous order. */
export function toEpochMs(parts: DateParts, order: DateOrder): number | null {
	let month = parts.m;
	let day = parts.d;
	if (parts.firstPart !== null && parts.secondPart !== null) {
		if (order === 'ISO') return null;
		if (order === 'DMY') {
			day = parts.firstPart;
			month = parts.secondPart;
		} else {
			month = parts.firstPart;
			day = parts.secondPart;
		}
	}
	if (month === null || day === null || !validCalendarDate(parts.y, month, day)) return null;
	const timestamp = Date.UTC(parts.y, month - 1, day, parts.h, parts.mi, parts.s, parts.ms);
	return timestamp - (parts.offsetMin ?? 0) * 60_000;
}

/** Reports whether a column header contains a whole word commonly used for timestamps. */
export function headerSuggestsTime(name: string): boolean {
	const trimmed = name.trim().toLowerCase();
	const words = name
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.toLowerCase()
		.split(/[\s_.-]+/)
		.filter(Boolean);
	const timeWords = new Set([
		'time',
		'timestamp',
		'ts',
		'epoch',
		'created',
		'updated',
		'date',
		'datetime'
	]);
	return words.some((word) => timeWords.has(word)) || trimmed.endsWith('_at');
}

/** Coerces a raw cell to a typed value using the selected column type and format. */
export function coerceCell(raw: string, type: ColumnType, format?: CellFormat): CellValue {
	if (type === 'text' || type === 'categorical') return raw;
	if (type === 'boolean') {
		const match = matchBoolean(raw);
		if (match < 0) return null;
		if (Array.isArray(format)) {
			const normalised = raw.trim().toLowerCase();
			if (normalised === format[0]!.toLowerCase()) return true;
			if (normalised === format[1]!.toLowerCase()) return false;
			return null;
		}
		return match % 2 === 0;
	}
	if (type === 'numeric') {
		const parsed = parseNumber(raw);
		if (!parsed) return null;
		const numericFormat = format as NumericColumnStats['format'] | undefined;
		if (
			numericFormat &&
			((parsed.prefix !== '' && parsed.prefix !== numericFormat.prefix) ||
				(parsed.suffix !== '' && parsed.suffix !== numericFormat.suffix))
		) {
			return null;
		}
		return parsed.value;
	}
	if (type === 'datetime') {
		const dateFormat = format as DatetimeColumnStats['format'] | undefined;
		if (dateFormat?.kind === 'epoch') {
			const epoch = parseEpoch(raw);
			return epoch?.unit === dateFormat.unit ? epoch.ms : null;
		}
		if (dateFormat?.kind === 'date') {
			const parts = parseDate(raw);
			return parts ? toEpochMs(parts, dateFormat.order) : null;
		}
		return parseEpoch(raw)?.ms ?? null;
	}
	return null;
}
