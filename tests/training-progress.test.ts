import { beforeEach, expect, test } from 'bun:test';
import { createTrainingProgressMapper } from '../src/features/models/training/progress';
import {
	$trainingSession,
	appendTrainingLog,
	applyTrainingSessionUpdate,
	createTrainingSession,
	getTrainingSession,
	setTrainingSessionStatus
} from '../src/stores/training.store';
import type { TrainingLogEntry, TrainingRunIdentity } from '../src/types/model-result';

const identity: TrainingRunIdentity = {
	datasetId: 'dataset',
	target: 'target',
	modelNum: 1,
	modelCreatedAt: 5,
	configurationKey: 'configuration',
	runId: 'run'
};

beforeEach(() => $trainingSession.set(new Map()));

test('WML-P3-EVENT-1: one-shot progress is finite, monotonic and holds through evaluation', () => {
	const mapper = createTrainingProgressMapper();
	expect(mapper.training({ type: 'phase', phase: 'loading-data' })?.progress.percent).toBeNull();
	expect(
		mapper.training({
			type: 'progress',
			phase: 'training',
			fraction: NaN,
			completed: 0,
			total: 8
		})
	).toBeNull();
	const update = mapper.training({
		type: 'progress',
		phase: 'training',
		fraction: 0.8,
		completed: 8,
		total: 10
	});
	expect(update?.progress).toMatchObject({ stage: 'fitting', percent: 70 });
	expect(
		mapper.training({
			type: 'progress',
			phase: 'training',
			fraction: 0.2,
			completed: 2,
			total: 10
		})
	).toBeNull();
	expect(mapper.training({ type: 'phase', phase: 'evaluating' })?.progress).toMatchObject({
		stage: 'evaluating',
		percent: 70
	});
	expect(mapper.training({ type: 'completed' })).toBeNull();
});

test('WML-P3-EVENT-1: CV counts unique completed folds with no fold index base assumption', () => {
	const mapper = createTrainingProgressMapper(3);
	expect(
		mapper.crossValidation({ type: 'fold-start', foldCount: 3, foldIndex: 10 })?.progress
			.percent
	).toBeNull();
	const complete = (foldIndex: number) =>
		mapper.crossValidation({ type: 'fold-complete', foldIndex, score: 0.5, meanScore: 0.5 });
	expect(complete(10)?.progress.percent).toBe(35);
	expect(complete(10)).toBeNull();
	expect(complete(2)?.progress.percent).toBe(60);
	expect(complete(7)?.progress.percent).toBe(85);
	expect(complete(0)).toBeNull();
	expect(
		mapper.crossValidation({ type: 'refit-start', sampleCount: 100 })?.progress
	).toMatchObject({ stage: 'refitting', percent: 85 });
});

test('WML-P3-EVENT-1: logs are bounded, warning text is discarded and only saved success reaches 100', () => {
	const mapper = createTrainingProgressMapper();
	createTrainingSession(identity);
	const warning = mapper.training({
		type: 'warning',
		code: 'worker-retried',
		message: 'untrusted detail'
	})!;
	expect(warning.note).toEqual({ key: 'warning', code: 'worker-retried' });
	expect(applyTrainingSessionUpdate(identity, warning)).toBe(true);
	expect(applyTrainingSessionUpdate(identity, warning)).toBe(false);
	expect(applyTrainingSessionUpdate({ ...identity, modelCreatedAt: 6 }, warning)).toBe(false);
	expect(
		applyTrainingSessionUpdate(identity, {
			...warning,
			progress: { ...warning.progress, percent: 100 }
		})
	).toBe(false);
	let log: readonly TrainingLogEntry[] = [];
	for (let fold = 1; fold <= 260; fold++)
		log = appendTrainingLog(log, { key: 'fold-complete', fold }, 261 - fold);
	expect(log).toHaveLength(250);
	expect(log[0]?.id).toBe(11);
	expect(log.at(-1)).toMatchObject({ id: 260, timestamp: 260 });
	setTrainingSessionStatus(identity, 'saving');
	setTrainingSessionStatus(identity, 'publication-pending');
	expect(getTrainingSession(identity)?.progress.percent).toBe(95);
	setTrainingSessionStatus(
		identity,
		'complete',
		appendTrainingLog(log, { key: 'completed' }, 300)
	);
	expect(getTrainingSession(identity)?.progress.percent).toBe(100);
	expect(getTrainingSession(identity)?.logEntries.at(-1)).toMatchObject({
		id: 261,
		message: { key: 'completed' }
	});
	expect(setTrainingSessionStatus(identity, 'failed')).toBe(false);
});
