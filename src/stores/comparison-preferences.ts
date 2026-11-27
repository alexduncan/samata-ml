import {
	DEFAULT_COMPARISON_UI,
	type ComparisonColumn,
	type ComparisonOwner,
	type ComparisonUi,
	type PersistedAppState
} from '../types/state';

const columns: readonly ComparisonColumn[] = [
	'balancedAccuracy',
	'macroF1',
	'mcc',
	'accuracy',
	'rocAuc',
	'averagePrecision',
	'logLoss',
	'brier',
	'ece',
	'gap',
	'sd',
	'iqr',
	'falsePositives',
	'falseNegatives',
	'errors',
	'fitDuration'
];

/** Converts a stored fraction to percentage points. */
export function ropeFractionToPoints(fraction: number): number {
	return Math.round(fraction * 1000) / 10;
}

/** Converts valid tenth-point input to its stored fraction. */
export function ropePointsToFraction(points: number): number | null {
	if (
		!Number.isFinite(points) ||
		points < 0.1 ||
		points > 10 ||
		Math.abs(points * 10 - Math.round(points * 10)) >= 1e-9
	)
		return null;
	return Math.round(points * 10) / 1000;
}

/** Returns a fresh unowned set of comparison defaults. */
export function emptyComparisonResults(): PersistedAppState['results'] {
	return { owner: null, ui: { ...DEFAULT_COMPARISON_UI, selected: [] } };
}

/** Returns the protected context that owns comparison choices, if present. */
export function comparisonOwner(
	state: Pick<PersistedAppState, 'dataset' | 'target' | 'comparisonContextEpoch'>
): ComparisonOwner | null {
	return state.dataset && state.target !== null
		? { datasetId: state.dataset.id, target: state.target, epoch: state.comparisonContextEpoch }
		: null;
}

/** Compares two context identities. */
export function sameComparisonOwner(a: ComparisonOwner | null, b: ComparisonOwner | null): boolean {
	return (
		a !== null &&
		b !== null &&
		a.datasetId === b.datasetId &&
		a.target === b.target &&
		a.epoch === b.epoch
	);
}

function object(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validates and normalises comparison choices, pruning unavailable model numbers. */
export function sanitiseComparisonUi(
	value: unknown,
	modelNumbers: readonly number[]
): ComparisonUi {
	const source = object(value) ? value : {};
	const validNumbers = new Set(modelNumbers);
	const selected = Array.isArray(source.selected)
		? [
				...new Set(
					source.selected.filter(
						(n): n is number => Number.isSafeInteger(n) && n > 0 && validNumbers.has(n)
					)
				)
			]
				.sort((a, b) => a - b)
				.slice(0, 8)
		: [];
	const pair = (n: unknown): number | null =>
		typeof n === 'number' && selected.includes(n) ? n : null;
	const sort: ComparisonUi['sort'] =
		object(source.sort) &&
		columns.includes(source.sort.column as ComparisonColumn) &&
		(source.sort.direction === 'ascending' || source.sort.direction === 'descending')
			? { column: source.sort.column as ComparisonColumn, direction: source.sort.direction }
			: null;
	const width = source.ropeWidth;
	const ropeWidth =
		typeof width === 'number' &&
		Number.isFinite(width) &&
		width >= 0.001 &&
		width <= 0.1 &&
		Math.abs(width * 1000 - Math.round(width * 1000)) < 1e-9
			? width
			: 0.01;
	const pairA = pair(source.pairA);
	const pairB = pair(source.pairB);
	const validPair = pairA !== null && pairB !== null && pairA !== pairB;
	return {
		fingerprint:
			typeof source.fingerprint === 'string' && /^[0-9a-f]{64}$/.test(source.fingerprint)
				? source.fingerprint
				: null,
		selected,
		sort,
		pairA: validPair ? pairA : selected.length >= 2 ? selected[0]! : null,
		pairB: validPair ? pairB : selected.length >= 2 ? selected[1]! : null,
		ropeWidth,
		classFilter:
			typeof source.classFilter === 'number' &&
			Number.isSafeInteger(source.classFilter) &&
			source.classFilter >= 0
				? source.classFilter
				: null
	};
}

/** Accepts choices only when their recorded owner matches both source and destination. */
export function ownedComparisonResults(
	source: PersistedAppState,
	destination: PersistedAppState
): PersistedAppState['results'] {
	const owner = source.results?.owner ?? null;
	if (
		!sameComparisonOwner(owner, comparisonOwner(source)) ||
		!sameComparisonOwner(owner, comparisonOwner(destination))
	) {
		return emptyComparisonResults();
	}
	return {
		owner,
		ui: sanitiseComparisonUi(
			source.results.ui,
			destination.models.map((model) => model.num)
		)
	};
}
