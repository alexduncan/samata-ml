/** A paired Bayesian comparison request. */
export interface RopeRequest {
	id: number;
	type: 'rope';
	scoresA: number[];
	scoresB: number[];
	rope: number;
	testFraction: number;
}

/** The three posterior probabilities exposed to the view. */
export interface RopeView {
	probabilityLower: number;
	probabilityEquivalent: number;
	probabilityHigher: number;
}

/** Replies from the analysis worker. */
export type RopeReply =
	| { id: number; type: 'rope-result'; result: RopeView }
	| { id: number; type: 'rope-error'; reason: 'invalid-input' | 'analysis-failed' };

function object(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Returns the request identifier only when it can safely identify a reply. */
export function ropeRequestId(value: unknown): number | null {
	return object(value) &&
		typeof value.id === 'number' &&
		Number.isSafeInteger(value.id) &&
		value.id > 0
		? value.id
		: null;
}

/** Checks the worker input before loading the statistical runtime. */
export function isRopeRequest(value: unknown): value is RopeRequest {
	if (!object(value) || ropeRequestId(value) === null || value.type !== 'rope') return false;
	const scoresA = value.scoresA,
		scoresB = value.scoresB;
	return (
		Array.isArray(scoresA) &&
		Array.isArray(scoresB) &&
		scoresA.length >= 2 &&
		scoresA.length <= 10 &&
		scoresA.length === scoresB.length &&
		scoresA.every((n) => typeof n === 'number' && Number.isFinite(n)) &&
		scoresB.every((n) => typeof n === 'number' && Number.isFinite(n)) &&
		typeof value.rope === 'number' &&
		Number.isFinite(value.rope) &&
		value.rope >= 0.001 &&
		value.rope <= 0.1 &&
		typeof value.testFraction === 'number' &&
		Number.isFinite(value.testFraction) &&
		value.testFraction > 0 &&
		value.testFraction < 1
	);
}

/** Checks a worker reply, including posterior normalisation. */
export function isRopeReply(value: unknown): value is RopeReply {
	if (!object(value) || ropeRequestId(value) === null) return false;
	if (value.type === 'rope-error')
		return value.reason === 'invalid-input' || value.reason === 'analysis-failed';
	if (value.type !== 'rope-result' || !object(value.result)) return false;
	const values = [
		value.result.probabilityLower,
		value.result.probabilityEquivalent,
		value.result.probabilityHigher
	];
	return (
		values.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1) &&
		Math.abs((values as number[]).reduce((sum, n) => sum + n, 0) - 1) <= 1e-9
	);
}
