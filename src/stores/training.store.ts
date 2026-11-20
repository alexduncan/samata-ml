import { atom } from 'nanostores';
import type {
	TrainingLogEntry,
	TrainingLogMessage,
	TrainingRunIdentity,
	TrainingWarningCode
} from '../types/model-result';
import type { TrainingProgress } from '../types/state';
import type { TrainingUpdate } from '../features/models/training/progress';
import { sameTrainingRun } from '../features/models/training/result-validation';

/** Route-independent state of a local or recovered training attempt. */
export type TrainingSessionStatus =
	| 'pending'
	| 'running'
	| 'cancelling'
	| 'saving'
	| 'publication-pending'
	| 'complete'
	| 'cancelled'
	| 'failed';

/** Live progress and log for one immutable training identity. */
export interface TrainingSession {
	identity: TrainingRunIdentity;
	status: TrainingSessionStatus;
	progress: TrainingProgress;
	logEntries: readonly TrainingLogEntry[];
	warnings: readonly TrainingWarningCode[];
}

/** Session-only data; logs are never written to localStorage. */
export const $trainingSession = atom<ReadonlyMap<string, TrainingSession>>(new Map());

/** Stable map key, including the run revision even if the model number was reused. */
export function trainingSessionKey(identity: TrainingRunIdentity): string {
	return JSON.stringify([identity.datasetId, identity.modelNum, identity.runId]);
}

/** Computes a log append without publishing it, including the final durable success item. */
export function appendTrainingLog(
	entries: readonly TrainingLogEntry[],
	message: TrainingLogMessage,
	timestamp = Date.now()
): readonly TrainingLogEntry[] {
	const last = entries.at(-1);
	if (last && JSON.stringify(last.message) === JSON.stringify(message)) return entries;
	const level =
		message.key === 'warning' ? 'warning' : message.key === 'failed' ? 'error' : 'status';
	return [
		...entries.slice(-249),
		{
			id: (last?.id ?? 0) + 1,
			timestamp: Math.max(last?.timestamp ?? 0, timestamp),
			level,
			message
		}
	];
}

function setSession(session: TrainingSession): void {
	const sessions = new Map($trainingSession.get());
	sessions.set(trainingSessionKey(session.identity), session);
	$trainingSession.set(sessions);
}

/** Initialises a fresh attempt independently of the current route. */
export function createTrainingSession(identity: TrainingRunIdentity): TrainingSession {
	const existing = getTrainingSession(identity);
	if (existing) return existing;
	const session: TrainingSession = {
		identity,
		status: 'pending',
		progress: { percent: null, stage: 'preparing', phase: null, statusMessage: 'preparing' },
		logEntries: [],
		warnings: []
	};
	setSession(session);
	return session;
}

/** Looks up the current entry and also checks its full captured identity. */
export function getTrainingSession(identity: TrainingRunIdentity): TrainingSession | undefined {
	const session = $trainingSession.get().get(trainingSessionKey(identity));
	return session && sameTrainingRun(session.identity, identity) ? session : undefined;
}

/** Updates the session for a worker reply while suppressing stale or repeated ticks. */
export function applyTrainingSessionUpdate(
	identity: TrainingRunIdentity,
	update: TrainingUpdate
): boolean {
	const session = getTrainingSession(identity);
	if (!session || (session.status !== 'running' && session.status !== 'pending')) return false;
	const { progress, note } = update;
	if (
		progress.percent === 100 ||
		(session.progress.percent !== null &&
			(progress.percent === null || progress.percent < session.progress.percent))
	) {
		return false;
	}
	let warnings = session.warnings;
	if (note?.key === 'warning') {
		if (warnings.includes(note.code)) return false;
		warnings = [...warnings, note.code];
	}
	const logEntries = note ? appendTrainingLog(session.logEntries, note) : session.logEntries;
	if (
		JSON.stringify(progress) === JSON.stringify(session.progress) &&
		logEntries === session.logEntries
	) {
		return false;
	}
	setSession({ ...session, progress, logEntries, warnings });
	return true;
}

/** Updates the main-thread lifecycle and reserves 100% for an acknowledged saved result. */
export function setTrainingSessionStatus(
	identity: TrainingRunIdentity,
	status: TrainingSessionStatus,
	logEntries?: readonly TrainingLogEntry[]
): boolean {
	const session = getTrainingSession(identity);
	if (
		!session ||
		session.status === 'complete' ||
		session.status === 'cancelled' ||
		session.status === 'failed'
	) {
		return false;
	}
	let progress = session.progress;
	if (status === 'saving') {
		progress = { percent: 95, stage: 'saving', phase: null, statusMessage: 'saving' };
	} else if (status === 'complete') {
		progress = { percent: 100, stage: 'saving', phase: null, statusMessage: 'completed' };
	}
	setSession({ ...session, status, progress, logEntries: logEntries ?? session.logEntries });
	return true;
}
