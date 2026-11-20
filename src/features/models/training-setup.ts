import type { ColumnStats } from '../../types/dataset';
import {
	FIXED_TRAINING_RANDOM_STATE,
	MAX_CV_FOLDS,
	MIN_CV_FOLDS,
	type ValidationMethodology
} from '../../types/state';

/** Training setup input limits for the current target. */
export interface TrainingSetupBounds {
	/** Largest selectable fold count, or zero when training setup is blocked. */
	readonly maxFolds: number;
	/** Smallest observed class count, zero for fewer than two classes, or null for unavailable stats. */
	readonly minClassCount: number | null;
	/** Whether the target has insufficient class counts for either strategy. */
	readonly blocked: boolean;
}

/** Validation feedback for an invalid fold count. */
export type FoldValidationError = 'invalid-number' | 'out-of-range';

/** Translated summary labels for the two supported strategies. */
export interface TrainingSetupSummaryLabels {
	/** One-Shot summary, including the requested train/test ratio. */
	readonly oneShot: string;
	/** Formats the Cross-Validation summary for the selected fold count. */
	readonly crossValidation: (folds: number) => string;
}

const unavailableBounds: TrainingSetupBounds = { maxFolds: 0, minClassCount: null, blocked: true };

function isCountRecord(value: unknown): value is Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === null || prototype === Object.prototype;
}

/**
 * Applies samatā's UI input rule to the current target. Both strategies require at least two
 * labelled rows in each of at least two observed classes. web-ml may still reject the setup.
 *
 * @param targetStats - Current target column statistics, or null when unavailable.
 * @returns Input limits and whether training setup is blocked.
 */
export function computeTrainingSetupBounds(targetStats: ColumnStats | null): TrainingSetupBounds {
	let counts: Record<string, unknown>;
	if (targetStats?.type === 'categorical' && isCountRecord(targetStats.categoryCounts)) {
		counts = targetStats.categoryCounts;
	} else if (targetStats?.type === 'boolean') {
		counts = { true: targetStats.trueCount, false: targetStats.falseCount };
	} else {
		return unavailableBounds;
	}

	let observedClasses = 0;
	let smallestClass = Infinity;
	for (const label in counts) {
		if (!Object.hasOwn(counts, label)) continue;
		const count = counts[label];
		if (typeof count !== 'number' || !Number.isInteger(count) || count < 0)
			return unavailableBounds;
		if (count === 0) continue;
		observedClasses++;
		smallestClass = Math.min(smallestClass, count);
	}

	const minClassCount = observedClasses < 2 ? 0 : smallestClass;
	const blocked = minClassCount < MIN_CV_FOLDS;
	return {
		maxFolds: blocked ? 0 : Math.min(MAX_CV_FOLDS, minClassCount),
		minClassCount,
		blocked
	};
}

/**
 * Validates a fold count against the applicable input limits.
 *
 * @param folds - Candidate count from the input.
 * @param maxFolds - Largest permitted count for this target.
 * @returns A validation error, or null for a permitted fold count.
 */
export function validateFoldCount(folds: number, maxFolds: number): FoldValidationError | null {
	if (!Number.isFinite(folds)) return 'invalid-number';
	return Number.isInteger(folds) && folds >= MIN_CV_FOLDS && folds <= maxFolds
		? null
		: 'out-of-range';
}

/**
 * Creates a reproducible Cross-Validation setup with matching outer and inner fold counts.
 *
 * @param folds - A fold count already checked with {@link validateFoldCount}.
 * @returns A training setup with the fixed seed.
 */
export function createCrossValidationSetup(folds: number): ValidationMethodology {
	return {
		type: 'nested_cv',
		outerFolds: folds,
		innerFolds: folds,
		randomState: FIXED_TRAINING_RANDOM_STATE
	};
}

/**
 * Formats a saved strategy for the model builder and overview.
 *
 * @param setup - A validated training setup.
 * @param labels - Translated summary labels.
 * @returns The model's training setup summary.
 */
export function formatTrainingSetupSummary(
	setup: ValidationMethodology,
	labels: TrainingSetupSummaryLabels
): string {
	return setup.type === 'one_shot' ? labels.oneShot : labels.crossValidation(setup.outerFolds);
}
