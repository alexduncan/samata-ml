import type { IDBPDatabase } from 'idb';
import type { SamataDBSchema } from '../../../common/storage/db';
import type { ResultEnvelope, TrainingRunIdentity } from '../../../types/model-result';
import { TRAINING_DOMAIN_DATASET_ID } from '../../../types/state';
import { decodeResultEnvelope } from './result-validation';

/** Reads only a validated real result; IndexedDB failures propagate to the caller. */
export async function readModelResult(
	db: IDBPDatabase<SamataDBSchema>,
	datasetId: string,
	modelNum: number,
	identity?: TrainingRunIdentity
): Promise<ResultEnvelope | null> {
	if (
		datasetId === TRAINING_DOMAIN_DATASET_ID ||
		!Number.isSafeInteger(modelNum) ||
		modelNum < 1
	) {
		return null;
	}
	const result = decodeResultEnvelope(
		await db.get('model_results', [datasetId, modelNum]),
		identity
	);
	return result?.datasetId === datasetId && result.modelNum === modelNum ? result : null;
}
