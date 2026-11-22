import type { CrossValidationEvent, TrainingEvent, TrainingPhase } from 'web-ml';
import type { TrainingLogMessage, TrainingWarningCode } from '../../../types/model-result';
import type { TrainingProgress, TrainingStage } from '../../../types/state';

/** Progress and optional log event emitted together by the app worker. */
export type TrainingUpdate = { progress: TrainingProgress; note?: TrainingLogMessage };

function trainingStage(phase: TrainingPhase): TrainingStage {
	switch (phase) {
		case 'training':
			return 'fitting';
		case 'evaluating':
		case 'finalizing':
			return 'evaluating';
		default:
			return 'preparing';
	}
}

/** Maps the public library event streams to bounded app progress. */
export function createTrainingProgressMapper(foldCount: number | null = null) {
	let progress: TrainingProgress = {
		percent: null,
		stage: 'preparing',
		phase: null,
		statusMessage: 'preparing'
	};
	const warnings = new Set<TrainingWarningCode>();
	const completed = new Set<number>();
	const foldOrdinals = new Map<number, number>();
	const started = new Set<number>();

	function update(
		stage: TrainingStage,
		phase: string | null,
		percent: number | null,
		note?: TrainingLogMessage
	) {
		if (percent !== null && progress.percent !== null)
			percent = Math.max(percent, progress.percent);
		if (percent === null) percent = progress.percent;
		const statusMessage = phase ?? stage;
		if (
			!note &&
			stage === progress.stage &&
			phase === progress.phase &&
			percent === progress.percent
		)
			return null;
		progress = { stage, phase, percent, statusMessage };
		return { progress, note };
	}

	function warning(event: Extract<TrainingEvent, { type: 'warning' }>): TrainingUpdate | null {
		if (warnings.has(event.code)) return null;
		warnings.add(event.code);
		return { progress, note: { key: 'warning', code: event.code } };
	}

	function training(event: TrainingEvent): TrainingUpdate | null {
		if (event.type === 'warning') return warning(event);
		if (event.type === 'phase') {
			const note =
				event.phase === progress.phase
					? undefined
					: ({ key: 'phase', phase: event.phase } as const);
			return update(trainingStage(event.phase), event.phase, null, note);
		}
		if (
			event.type === 'progress' &&
			event.phase === 'training' &&
			Number.isFinite(event.fraction) &&
			event.fraction >= 0 &&
			event.fraction <= 1
		) {
			return update('fitting', event.phase, 10 + event.fraction * 75);
		}
		return null;
	}

	function ordinal(index: number, count: number): number | null {
		if (!Number.isSafeInteger(index) || index < 0) return null;
		const existing = foldOrdinals.get(index);
		if (existing !== undefined) return existing;
		if (foldOrdinals.size >= count) return null;
		const value = foldOrdinals.size + 1;
		foldOrdinals.set(index, value);
		return value;
	}

	function crossValidation(event: CrossValidationEvent): TrainingUpdate | null {
		if (foldCount === null) return null;
		switch (event.type) {
			case 'fold-start': {
				const fold = ordinal(event.foldIndex, foldCount);
				if (fold === null || started.has(event.foldIndex)) return null;
				started.add(event.foldIndex);
				return update('cross-validation', null, null, {
					key: 'fold-start',
					fold,
					folds: foldCount
				});
			}
			case 'fold-progress':
			case 'refit-progress':
				return event.event.type === 'warning' ? warning(event.event) : null;
			case 'fold-complete': {
				const fold = ordinal(event.foldIndex, foldCount);
				if (fold === null || completed.has(event.foldIndex)) return null;
				completed.add(event.foldIndex);
				return update('cross-validation', null, 10 + (completed.size / foldCount) * 75, {
					key: 'fold-complete',
					fold
				});
			}
			case 'refit-start':
			case 'refit-complete':
				return progress.phase === event.type
					? null
					: update('refitting', event.type, null, { key: event.type });
			default:
				return null;
		}
	}

	return { training, crossValidation };
}
