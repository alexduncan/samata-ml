import { $appState } from '../../stores/app.store';
import { getTrainingService } from '../models/training/training-service';
import { toDatasetSummary } from '../../types/dataset';
import type { DatasetSummary } from '../../types/state';
import type { IngestOptions, StorageClient } from './ingestion/storage-client';
import { getStorageClient } from './ingestion/storage-client';
import { IngestionError } from './ingestion/errors';
import type { IngestionSource } from './ingestion/pipeline';

/** Options for loading a dataset into the preview workflow. */
export interface LoadDatasetOptions extends IngestOptions {
	/** Optional client override for tests or an explicitly managed worker client. */
	client?: StorageClient;
	/** Receives each stage as it starts: uploads validate first, samples only ingest. */
	onStage?: (stage: 'validating' | 'ingesting') => void;
}

/** Ingests a source, updates application state, then removes older stored datasets. */
export async function loadDataset(
	source: IngestionSource,
	options: LoadDatasetOptions = {}
): Promise<DatasetSummary> {
	const client = options.client ?? getStorageClient();
	const previousDataset = $appState.get().dataset?.id ?? null;
	if (source.kind === 'file') {
		options.onStage?.('validating');
		// Pass 1: parse and profile the whole file without writing to IndexedDB.
		await client.validate(source, { signal: options.signal, onProgress: options.onProgress });
		if (options.signal?.aborted)
			throw new IngestionError('CANCELLED', 'Dataset loading was cancelled.');
	}
	options.onStage?.('ingesting');
	const metadata = await client.ingest(source, {
		signal: options.signal,
		onProgress: options.onProgress
	});
	const summary = toDatasetSummary(metadata);
	const publication = await getTrainingService().publishDataset(summary, previousDataset, () =>
		client.deleteDatasetsExcept(metadata.id)
	);
	if (!publication.ok)
		throw new IngestionError(
			publication.code === 'busy' || publication.code === 'remote-training'
				? 'BUSY'
				: 'UNKNOWN',
			'The loaded dataset could not be published.'
		);
	return summary;
}
