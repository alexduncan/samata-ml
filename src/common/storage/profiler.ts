import {
	BOOLEAN_LEXICON_PAIRS,
	DEFAULT_MISSING_VALUE_TOKENS,
	headerSuggestsTime,
	matchBoolean,
	normaliseMissing,
	parseDate,
	parseEpoch,
	parseNumber,
	toEpochMs
} from './cells';
import type { DateOrder, DateParts, ParsedEpoch, ParsedNumber } from './cells';
import type { ColumnType } from '../../types/state';
import {
	DATETIME_FIRST_CHECKPOINT,
	MAX_INVALID_EXAMPLES,
	MAX_SKIPPED_ROW_NUMBERS,
	MAX_TRACKED_DISTINCT,
	TYPE_MATCH_THRESHOLD,
	CHECKPOINT_ROWS
} from '../../features/data/ingestion/limits';
import type { DatetimeColumnStats, NumericColumnStats } from '../../types/dataset';

/** Options controlling per-dataset missing-value handling and declared type overrides. */
export interface ProfileOptions {
	/** Replaces default missing tokens; empty strings remain missing. */
	missingValueTokens?: string[];
	/** Per-column final type overrides from an authored sample descriptor. */
	overrides?: Record<string, ColumnType>;
	/** Per-column implicit missing values from an authored sample descriptor. */
	implicitMissing?: Record<string, (string | number)[]>;
	/** One-based row offset for a continuation of a streamed input. */
	rowNumberOffset?: number;
}

/** Selected type and inference details used by ingestion and sample validation. */
export interface ElectedColumn {
	/** Normalised and de-duplicated column header. */
	name: string;
	/** Inferred or overridden canonical type. */
	type: ColumnType;
	/** Numeric or datetime display/coercion format, otherwise null. */
	format: NumericColumnStats['format'] | DatetimeColumnStats['format'] | null;
	/** Observed true/false tokens for boolean columns. */
	lexicon: [string, string] | null;
	/** Number of recognised missing or implicit-missing cells. */
	missingCount: number;
	/** Missing-token counts keyed by the trimmed lower-case token. */
	missingTokens: Record<string, number>;
	/** Non-missing cells that do not fit the elected type and format. */
	invalidCount: number;
	/** Up to five distinct invalid raw values. */
	invalidExamples: string[];
	/** Min and max of every cell parsed numerically under any affix. */
	supersetRange: { min: number | null; max: number | null };
	/** Whether an identifier-like numeric or text column was detected. */
	identifierHint: boolean;
	/** Tracked distinct values, or null after the tracking cap is exceeded. */
	distinctValues: Map<string, number> | null;
	/** Tracked distinct count, or null when the cap was exceeded. */
	distinctCount: number | null;
}

/** Ragged-row handling summary accumulated while rows are profiled. */
export interface ProfileRowSummary {
	count: number;
	rowNumbers: number[];
}

/** Internal counters for a single column. */
interface ColumnProfile {
	values: number;
	missingCount: number;
	missingTokens: Map<string, number>;
	booleanCounts: number[];
	booleanTokens: [string | null, string | null][];
	numericCounts: Map<string, number>;
	numericGroupedCounts: Map<string, number>;
	numericRange: { min: number | null; max: number | null };
	allNumericIntegers: boolean;
	numericSequence: boolean;
	numericSequenceCount: number;
	lastNumeric: number | null;
	datetimeActive: boolean;
	epochCounts: Map<'s' | 'ms' | 'us', number>;
	dateOrderCounts: Map<DateOrder, number>;
	dateMatches: number;
	datetimeMatches: number;
	dateHasTime: boolean;
	dmyForcing: number;
	mdyForcing: number;
	hasYearLastDate: boolean;
	distinctValues: Map<string, number>;
	distinctOverflow: boolean;
	textHasWhitespace: boolean;
	invalidExamples: Map<string, Set<string>>;
}

const NUMERIC_SIGNATURES = [
	{ prefix: '', suffix: '' },
	{ prefix: '', suffix: '%' },
	{ prefix: '$', suffix: '' },
	{ prefix: '$', suffix: '%' },
	{ prefix: '€', suffix: '' },
	{ prefix: '€', suffix: '%' },
	{ prefix: '£', suffix: '' },
	{ prefix: '£', suffix: '%' }
] as const;
const DATE_ORDERS: DateOrder[] = ['ISO', 'DMY', 'MDY'];
const EPOCH_UNITS = ['s', 'ms', 'us'] as const;

type NumericSignature = (typeof NUMERIC_SIGNATURES)[number];
type EpochUnit = (typeof EPOCH_UNITS)[number];

function numericSignatureKey(signature: { prefix: string; suffix: string }): string {
	return `${signature.prefix}|${signature.suffix}`;
}

function makeProfile(): ColumnProfile {
	const numericCounts = new Map<string, number>();
	const numericGroupedCounts = new Map<string, number>();
	for (const signature of NUMERIC_SIGNATURES) {
		const key = numericSignatureKey(signature);
		numericCounts.set(key, 0);
		numericGroupedCounts.set(key, 0);
	}
	const invalidExamples = new Map<string, Set<string>>();
	for (let index = 0; index < BOOLEAN_LEXICON_PAIRS.length; index++) {
		invalidExamples.set(`boolean:${index}`, new Set());
	}
	for (const signature of NUMERIC_SIGNATURES) {
		invalidExamples.set(`numeric:${numericSignatureKey(signature)}`, new Set());
	}
	for (const unit of EPOCH_UNITS) invalidExamples.set(`epoch:${unit}`, new Set());
	for (const order of DATE_ORDERS) invalidExamples.set(`date:${order}`, new Set());
	return {
		values: 0,
		missingCount: 0,
		missingTokens: new Map(),
		booleanCounts: BOOLEAN_LEXICON_PAIRS.map(() => 0),
		booleanTokens: BOOLEAN_LEXICON_PAIRS.map(() => [null, null]),
		numericCounts,
		numericGroupedCounts,
		numericRange: { min: null, max: null },
		allNumericIntegers: true,
		numericSequence: true,
		numericSequenceCount: 0,
		lastNumeric: null,
		datetimeActive: true,
		epochCounts: new Map(EPOCH_UNITS.map((unit) => [unit, 0])),
		dateOrderCounts: new Map(DATE_ORDERS.map((order) => [order, 0])),
		dateMatches: 0,
		datetimeMatches: 0,
		dateHasTime: false,
		dmyForcing: 0,
		mdyForcing: 0,
		hasYearLastDate: false,
		distinctValues: new Map(),
		distinctOverflow: false,
		textHasWhitespace: false,
		invalidExamples
	};
}

function addExample(profile: ColumnProfile, key: string, value: string): void {
	const examples = profile.invalidExamples.get(key);
	if (!examples || examples.size >= MAX_INVALID_EXAMPLES || examples.has(value)) return;
	examples.add(value);
}

function getExamples(profile: ColumnProfile, key: string): string[] {
	return [...(profile.invalidExamples.get(key) ?? [])];
}

function normaliseHeaders(rawHeader: string[]): string[] {
	const baseHeaders = rawHeader.map((raw, index) => {
		const withoutBom = index === 0 ? raw.replace(/^\uFEFF/, '') : raw;
		const trimmed = withoutBom.trim();
		return trimmed || `column_${index}`;
	});
	const reserved = new Set(baseHeaders);
	const seen = new Set<string>();
	return baseHeaders.map((header) => {
		if (!seen.has(header)) {
			seen.add(header);
			return header;
		}
		let suffix = 1;
		let candidate = `${header}_${suffix}`;
		while (seen.has(candidate) || reserved.has(candidate)) {
			suffix++;
			candidate = `${header}_${suffix}`;
		}
		seen.add(candidate);
		return candidate;
	});
}

function addNumericRange(profile: ColumnProfile, value: number): void {
	profile.numericRange.min =
		profile.numericRange.min === null ? value : Math.min(profile.numericRange.min, value);
	profile.numericRange.max =
		profile.numericRange.max === null ? value : Math.max(profile.numericRange.max, value);
}

function trackDistinct(profile: ColumnProfile, value: string): void {
	if (profile.distinctOverflow) return;
	if (profile.distinctValues.has(value)) {
		profile.distinctValues.set(value, profile.distinctValues.get(value)! + 1);
		return;
	}
	if (profile.distinctValues.size >= MAX_TRACKED_DISTINCT) {
		profile.distinctValues.clear();
		profile.distinctOverflow = true;
		return;
	}
	profile.distinctValues.set(value, 1);
	if (/\s/.test(value)) profile.textHasWhitespace = true;
}

function checkDatetimeCheckpoint(profile: ColumnProfile, rowNumber: number): void {
	if (!profile.datetimeActive || profile.values === 0) return;
	if (rowNumber !== DATETIME_FIRST_CHECKPOINT && rowNumber % CHECKPOINT_ROWS !== 0) return;
	if ((profile.values - profile.datetimeMatches) / profile.values > 1 - TYPE_MATCH_THRESHOLD) {
		profile.datetimeActive = false;
	}
}

function chooseNumericSignature(profile: ColumnProfile): NumericSignature {
	let chosen: NumericSignature | null = null;
	let bestCount = 0;
	for (const signature of NUMERIC_SIGNATURES) {
		if (signature.prefix === '' && signature.suffix === '') continue;
		const count = profile.numericCounts.get(numericSignatureKey(signature)) ?? 0;
		if (count > bestCount) {
			chosen = signature;
			bestCount = count;
		}
	}
	return chosen ?? NUMERIC_SIGNATURES[0]!;
}

function numericValidCount(profile: ColumnProfile, signature: NumericSignature): number {
	const selectedCount = profile.numericCounts.get(numericSignatureKey(signature)) ?? 0;
	if (signature.prefix === '' && signature.suffix === '') return selectedCount;
	return selectedCount + (profile.numericCounts.get('|') ?? 0);
}

function chooseBooleanPair(profile: ColumnProfile): number {
	let selected = 0;
	for (let index = 1; index < profile.booleanCounts.length; index++) {
		if (profile.booleanCounts[index]! > profile.booleanCounts[selected]!) selected = index;
	}
	return selected;
}

function booleanEligible(profile: ColumnProfile, pairIndex: number): boolean {
	const matches = profile.booleanCounts[pairIndex] ?? 0;
	if (matches / profile.values < TYPE_MATCH_THRESHOLD) return false;
	if (pairIndex !== BOOLEAN_LEXICON_PAIRS.length - 1) return true;
	const [trueToken, falseToken] = profile.booleanTokens[pairIndex]!;
	return (trueToken !== null && falseToken !== null) || profile.values >= 20;
}

function chooseDateOrder(profile: ColumnProfile): { order: DateOrder; orderAssumed: boolean } {
	if (!profile.hasYearLastDate) return { order: 'ISO', orderAssumed: false };
	if (profile.dmyForcing === 0 && profile.mdyForcing === 0) {
		return { order: 'DMY', orderAssumed: true };
	}
	return {
		order: profile.dmyForcing >= profile.mdyForcing ? 'DMY' : 'MDY',
		orderAssumed: false
	};
}

function categoricalEligible(profile: ColumnProfile): boolean {
	if (profile.distinctOverflow) return false;
	const uniqueCount = profile.distinctValues.size;
	const meanLength =
		uniqueCount === 0
			? 0
			: [...profile.distinctValues.keys()].reduce((sum, value) => sum + value.length, 0) /
				uniqueCount;
	return (
		((uniqueCount <= 50 && uniqueCount <= profile.values / 2) ||
			(uniqueCount <= 250 && uniqueCount / profile.values <= 0.05)) &&
		meanLength <= 64
	);
}

function isNumericSignature(value: ParsedNumber, signature: NumericSignature): boolean {
	if (value.prefix === '' && value.suffix === '') return true;
	return value.prefix === signature.prefix && value.suffix === signature.suffix;
}

function recordInvalidExamples(
	profile: ColumnProfile,
	value: string,
	booleanMatch: number,
	numeric: ParsedNumber | null,
	epoch: ParsedEpoch | null,
	date: DateParts | null,
	dateOrderValidity: Map<DateOrder, boolean>
): void {
	for (let pair = 0; pair < BOOLEAN_LEXICON_PAIRS.length; pair++) {
		if (booleanMatch < 0 || Math.floor(booleanMatch / 2) !== pair) {
			addExample(profile, `boolean:${pair}`, value);
		}
	}
	for (const signature of NUMERIC_SIGNATURES) {
		if (!numeric || !isNumericSignature(numeric, signature)) {
			addExample(profile, `numeric:${numericSignatureKey(signature)}`, value);
		}
	}
	for (const unit of EPOCH_UNITS) {
		if (!epoch || epoch.unit !== unit) addExample(profile, `epoch:${unit}`, value);
	}
	for (const order of DATE_ORDERS) {
		if (!date || !dateOrderValidity.get(order)) addExample(profile, `date:${order}`, value);
	}
}

function electColumn(
	name: string,
	profile: ColumnProfile,
	override: ColumnType | undefined
): ElectedColumn {
	let type: ColumnType = 'text';
	let format: ElectedColumn['format'] = null;
	let lexicon: [string, string] | null = null;
	let invalidCount = 0;
	let invalidExamples: string[] = [];
	let identifierHint = false;
	const numericSignature = chooseNumericSignature(profile);
	const dateOrder = chooseDateOrder(profile);
	const bestBooleanPair = chooseBooleanPair(profile);
	const bestEpochUnit = EPOCH_UNITS.reduce((best, unit) =>
		(profile.epochCounts.get(unit) ?? 0) > (profile.epochCounts.get(best) ?? 0) ? unit : best
	);

	if (profile.values > 0) {
		if (booleanEligible(profile, bestBooleanPair)) {
			type = 'boolean';
			const canonicalPair = BOOLEAN_LEXICON_PAIRS[bestBooleanPair]!;
			const observedPair = profile.booleanTokens[bestBooleanPair]!;
			lexicon = [observedPair[0] ?? canonicalPair[0], observedPair[1] ?? canonicalPair[1]];
			invalidCount = profile.values - profile.booleanCounts[bestBooleanPair]!;
			invalidExamples = getExamples(profile, `boolean:${bestBooleanPair}`);
		} else if (
			profile.datetimeActive &&
			profile.epochCounts.get(bestEpochUnit)! / profile.values >= TYPE_MATCH_THRESHOLD
		) {
			type = 'datetime';
			format = { kind: 'epoch', unit: bestEpochUnit };
			invalidCount = profile.values - profile.epochCounts.get(bestEpochUnit)!;
			invalidExamples = getExamples(profile, `epoch:${bestEpochUnit}`);
		} else if (
			profile.datetimeActive &&
			profile.dateOrderCounts.get(dateOrder.order)! / profile.values >= TYPE_MATCH_THRESHOLD
		) {
			type = 'datetime';
			format = {
				kind: 'date',
				order: dateOrder.order,
				orderAssumed: dateOrder.orderAssumed,
				hasTime: profile.dateHasTime
			};
			invalidCount = profile.values - profile.dateOrderCounts.get(dateOrder.order)!;
			invalidExamples = getExamples(profile, `date:${dateOrder.order}`);
		} else if (
			numericValidCount(profile, numericSignature) / profile.values >=
			TYPE_MATCH_THRESHOLD
		) {
			type = 'numeric';
			format = {
				...numericSignature,
				thousandsSeparator:
					(profile.numericGroupedCounts.get(numericSignatureKey(numericSignature)) ?? 0) >
					0
			};
			invalidCount = profile.values - numericValidCount(profile, numericSignature);
			invalidExamples = getExamples(
				profile,
				`numeric:${numericSignatureKey(numericSignature)}`
			);
			identifierHint =
				profile.numericSequence &&
				profile.allNumericIntegers &&
				profile.numericSequenceCount === profile.values &&
				invalidCount === 0;
		} else if (categoricalEligible(profile)) {
			type = 'categorical';
		} else {
			type = 'text';
			identifierHint =
				!profile.distinctOverflow &&
				profile.distinctValues.size / profile.values > 0.98 &&
				!profile.textHasWhitespace;
		}
	}

	if (override) {
		type = override;
		if (type === 'numeric') {
			format = {
				...numericSignature,
				thousandsSeparator:
					(profile.numericGroupedCounts.get(numericSignatureKey(numericSignature)) ?? 0) >
					0
			};
			invalidCount = profile.values - numericValidCount(profile, numericSignature);
			invalidExamples = getExamples(
				profile,
				`numeric:${numericSignatureKey(numericSignature)}`
			);
			identifierHint =
				profile.numericSequence &&
				profile.allNumericIntegers &&
				profile.numericSequenceCount === profile.values &&
				invalidCount === 0;
		} else if (type === 'boolean') {
			const canonicalPair = BOOLEAN_LEXICON_PAIRS[bestBooleanPair]!;
			const observedPair = profile.booleanTokens[bestBooleanPair]!;
			lexicon = [observedPair[0] ?? canonicalPair[0], observedPair[1] ?? canonicalPair[1]];
			invalidCount = profile.values - profile.booleanCounts[bestBooleanPair]!;
			invalidExamples = getExamples(profile, `boolean:${bestBooleanPair}`);
		} else if (type === 'datetime') {
			if (profile.epochCounts.get(bestEpochUnit)! > 0) {
				format = { kind: 'epoch', unit: bestEpochUnit };
				invalidCount = profile.values - profile.epochCounts.get(bestEpochUnit)!;
				invalidExamples = getExamples(profile, `epoch:${bestEpochUnit}`);
			} else {
				format = {
					kind: 'date',
					order: dateOrder.order,
					orderAssumed: dateOrder.orderAssumed,
					hasTime: profile.dateHasTime
				};
				invalidCount = profile.values - profile.dateOrderCounts.get(dateOrder.order)!;
				invalidExamples = getExamples(profile, `date:${dateOrder.order}`);
			}
		} else {
			invalidCount = 0;
			invalidExamples = [];
			format = null;
			lexicon = null;
			identifierHint =
				type === 'text' &&
				!profile.distinctOverflow &&
				profile.distinctValues.size / Math.max(1, profile.values) > 0.98 &&
				!profile.textHasWhitespace;
		}
	}

	return {
		name,
		type,
		format,
		lexicon,
		missingCount: profile.missingCount,
		missingTokens: Object.fromEntries(profile.missingTokens),
		invalidCount,
		invalidExamples,
		supersetRange: profile.numericRange,
		identifierHint,
		distinctValues: profile.distinctOverflow ? null : new Map(profile.distinctValues),
		distinctCount: profile.distinctOverflow ? null : profile.distinctValues.size
	};
}

/**
 * Profiles all rows in a dataset before electing stable column types.
 *
 * The profiler stores counters and bounded distinct-value maps only; it does not retain dataset rows.
 */
export class DatasetProfiler {
	/** Normalised and de-duplicated column names. */
	readonly header: string[];
	/** Number of skipped long rows and their first row numbers. */
	readonly skippedRows: ProfileRowSummary = { count: 0, rowNumbers: [] };
	private readonly options: ProfileOptions;
	private readonly columns: ColumnProfile[];
	private readonly timestampHeaders: boolean[];
	private rowsSeen = 0;
	private keptRows = 0;
	private paddedRows = 0;

	/**
	 * Creates a profiler for a CSV header.
	 *
	 * @param rawHeader - Unmodified header cells from the CSV parser.
	 * @param options - Missing values, overrides and row-number offset.
	 */
	constructor(rawHeader: string[], options: ProfileOptions = {}) {
		if (rawHeader.length === 0) throw new Error('A CSV header row is required');
		this.header = normaliseHeaders(rawHeader);
		this.options = options;
		this.columns = this.header.map(() => makeProfile());
		this.timestampHeaders = this.header.map(headerSuggestsTime);
	}

	/** Adds one parsed row, padding short rows and skipping long rows. */
	addRow(cells: string[]): { kept: boolean; padded: boolean; values: (string | null)[] } {
		this.rowsSeen++;
		const rowNumber = (this.options.rowNumberOffset ?? 0) + this.rowsSeen;
		if (cells.length > this.header.length) {
			this.skippedRows.count++;
			if (this.skippedRows.rowNumbers.length < MAX_SKIPPED_ROW_NUMBERS) {
				this.skippedRows.rowNumbers.push(rowNumber);
			}
			for (const profile of this.columns) checkDatetimeCheckpoint(profile, this.rowsSeen);
			return { kept: false, padded: false, values: [] };
		}

		const padded = cells.length < this.header.length;
		if (padded) this.paddedRows++;
		const values: (string | null)[] = [];
		for (let index = 0; index < this.header.length; index++) {
			const raw = cells[index] ?? '';
			const name = this.header[index]!;
			const normalised = normaliseMissing(
				raw,
				this.options.missingValueTokens ?? [...DEFAULT_MISSING_VALUE_TOKENS],
				this.options.implicitMissing?.[name] ?? []
			);
			const profile = this.columns[index]!;
			if (normalised.value === null) {
				profile.missingCount++;
				const token = normalised.missingToken ?? '';
				profile.missingTokens.set(token, (profile.missingTokens.get(token) ?? 0) + 1);
				values.push(null);
				checkDatetimeCheckpoint(profile, this.rowsSeen);
				continue;
			}

			const value = normalised.value;
			values.push(value);
			profile.values++;
			trackDistinct(profile, value);
			const booleanMatch = matchBoolean(value);
			if (booleanMatch >= 0) {
				const pairIndex = Math.floor(booleanMatch / 2);
				profile.booleanCounts[pairIndex] = profile.booleanCounts[pairIndex]! + 1;
				profile.booleanTokens[pairIndex]![booleanMatch % 2] ??= value;
			}

			const numeric = parseNumber(value);
			if (numeric) {
				const key = numericSignatureKey(numeric);
				profile.numericCounts.set(key, (profile.numericCounts.get(key) ?? 0) + 1);
				if (numeric.grouped) {
					profile.numericGroupedCounts.set(
						key,
						(profile.numericGroupedCounts.get(key) ?? 0) + 1
					);
				}
				addNumericRange(profile, numeric.value);
				if (Number.isInteger(numeric.value)) {
					if (profile.lastNumeric !== null && numeric.value !== profile.lastNumeric + 1) {
						profile.numericSequence = false;
					}
					profile.numericSequenceCount++;
					profile.lastNumeric = numeric.value;
				} else {
					profile.allNumericIntegers = false;
					profile.numericSequence = false;
				}
			} else {
				profile.allNumericIntegers = false;
				profile.numericSequence = false;
			}

			let epoch: ParsedEpoch | null = null;
			let date: DateParts | null = null;
			const dateOrderValidity = new Map<DateOrder, boolean>();
			if (profile.datetimeActive) {
				let datetimeMatch = false;
				if (this.timestampHeaders[index]) {
					epoch = parseEpoch(value);
					if (epoch) {
						profile.epochCounts.set(
							epoch.unit,
							profile.epochCounts.get(epoch.unit)! + 1
						);
						datetimeMatch = true;
					}
				}
				date = parseDate(value);
				if (date) {
					datetimeMatch = true;
					profile.dateMatches++;
					profile.dateHasTime ||= date.hasTime;
					if (date.firstPart !== null && date.secondPart !== null) {
						profile.hasYearLastDate = true;
						if (date.firstPart > 12) profile.dmyForcing++;
						if (date.secondPart > 12) profile.mdyForcing++;
					}
				}
				for (const order of DATE_ORDERS) {
					const valid = date !== null && toEpochMs(date, order) !== null;
					dateOrderValidity.set(order, valid);
					if (valid)
						profile.dateOrderCounts.set(order, profile.dateOrderCounts.get(order)! + 1);
				}
				if (datetimeMatch) profile.datetimeMatches++;
				recordInvalidExamples(
					profile,
					value,
					booleanMatch,
					numeric,
					epoch,
					date,
					dateOrderValidity
				);
			} else {
				for (const order of DATE_ORDERS) dateOrderValidity.set(order, false);
				recordInvalidExamples(
					profile,
					value,
					booleanMatch,
					numeric,
					epoch,
					date,
					dateOrderValidity
				);
			}

			checkDatetimeCheckpoint(profile, this.rowsSeen);
		}
		this.keptRows++;
		return { kept: true, padded, values };
	}

	/** Elects final column types and returns their bounded inference details. */
	elect(): ElectedColumn[] {
		return this.header.map((name, index) =>
			electColumn(name, this.columns[index]!, this.options.overrides?.[name])
		);
	}

	/** Gets the number of rows retained by {@link addRow}. */
	get rowCount(): number {
		return this.keptRows;
	}

	/** Gets the number of short rows padded by {@link addRow}. */
	get paddedRowCount(): number {
		return this.paddedRows;
	}
}

/** Normalises and de-duplicates raw CSV header cells. */
export { normaliseHeaders };
