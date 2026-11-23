import { map } from 'nanostores';
import { openSamataDb } from '../common/storage/db';
import { getTrainingConfigurationKey } from '../features/models/training/training-service';
import { readModelResult } from '../features/models/training/result-repository';
import { sameTrainingRun } from '../features/models/training/result-validation';
import type { StoredEvaluation } from '../types/model-evaluation';
import type { TrainingRunIdentity } from '../types/model-result';
import { $appState } from './app.store';

/** Lifecycle of one model's saved-evaluation read. */
export type ModelResultsStatus = 'idle' | 'loading' | 'ready' | 'legacy' | 'lost' | 'error';

/** Session-only cache entry for the evaluation of one trained run. */
export interface ModelResultsResource {
	/** The full run the entry was read for; entries never outlive the active identity. */
	readonly identity: TrainingRunIdentity;
	readonly status: ModelResultsStatus;
	/** Present only when `status` is `ready`. */
	readonly evaluation: StoredEvaluation | null;
	/** A safe, non-technical sentence when `status` is `error`; otherwise empty. */
	readonly error: string;
}

/** Evaluation cache keyed by model number. Never persisted. */
export const $modelResults = map<Record<number, ModelResultsResource>>({});

const READ_ERROR = 'The saved results could not be read from this browser.';

/** Derives the identity of the active trained run, or null when the model has none. */
export function currentResultIdentity(num: number): TrainingRunIdentity | null {
	const state = $appState.get();
	const model = state.models.find((entry) => entry.num === num);
	if (!state.dataset || !state.target || model?.status !== 'trained' || !model.resultRevision) {
		return null;
	}
	const configurationKey = getTrainingConfigurationKey(model, state.dataset.rowCount);
	if (!configurationKey) return null;
	return {
		datasetId: state.dataset.id,
		target: state.target,
		modelNum: num,
		modelCreatedAt: model.createdAt,
		configurationKey,
		runId: model.resultRevision
	};
}

function publish(num: number, resource: ModelResultsResource): void {
	$modelResults.setKey(num, resource);
}

function evict(num: number): void {
	const { [num]: _removed, ...rest } = $modelResults.get();
	$modelResults.set(rest);
}

async function read(num: number, identity: TrainingRunIdentity): Promise<void> {
	const loading: ModelResultsResource = {
		identity,
		status: 'loading',
		evaluation: null,
		error: ''
	};
	publish(num, loading);
	let next: ModelResultsResource;
	try {
		const db = await openSamataDb();
		try {
			const result = await readModelResult(db, identity.datasetId, num, identity);
			next =
				result?.schemaVersion === 2
					? { identity, status: 'ready', evaluation: result.evaluation, error: '' }
					: {
							identity,
							status: result ? 'legacy' : 'lost',
							evaluation: null,
							error: ''
						};
		} finally {
			db.close();
		}
	} catch {
		next = { identity, status: 'error', evaluation: null, error: READ_ERROR };
	}
	// A superseded run, dataset or entry must not publish into the cache.
	const active = currentResultIdentity(num);
	if ($modelResults.get()[num] !== loading || !active || !sameTrainingRun(active, identity)) {
		return;
	}
	publish(num, next);
}

/**
 * Reads the saved evaluation for the model's current run. Loading is idempotent: a matching
 * in-flight or terminal entry, including an error, is reused. Use `retryModelResults` to retry.
 */
export async function loadModelResults(num: number): Promise<void> {
	const identity = currentResultIdentity(num);
	if (!identity) {
		if ($modelResults.get()[num]) evict(num);
		return;
	}
	const existing = $modelResults.get()[num];
	if (existing && existing.status !== 'idle' && sameTrainingRun(existing.identity, identity)) {
		return;
	}
	await read(num, identity);
}

/** Replaces a failed read of the current run with a new one. */
export async function retryModelResults(num: number): Promise<void> {
	const identity = currentResultIdentity(num);
	if (!identity) {
		if ($modelResults.get()[num]) evict(num);
		return;
	}
	const existing = $modelResults.get()[num];
	if (
		existing &&
		sameTrainingRun(existing.identity, identity) &&
		(existing.status === 'loading' ||
			existing.status === 'ready' ||
			existing.status === 'legacy')
	) {
		return;
	}
	await read(num, identity);
}

/** Clears entries whose run is no longer the active one. */
function pruneObsolete(): void {
	for (const [key, entry] of Object.entries($modelResults.get())) {
		const active = currentResultIdentity(Number(key));
		if (!active || !sameTrainingRun(active, entry.identity)) evict(Number(key));
	}
}

$appState.listen(pruneObsolete);
