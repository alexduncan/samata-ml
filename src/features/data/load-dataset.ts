import { loadDatasetSucceeded } from '../../stores/app.store';
import { toDatasetSummary } from '../../types/dataset';
import type { DatasetSummary } from '../../types/state';
import type { IngestOptions, StorageClient } from './ingestion/storage-client';
import { getStorageClient } from './ingestion/storage-client';
import type { IngestionSource } from './ingestion/pipeline';

/** Options for loading a dataset into the preview workflow. */
export interface LoadDatasetOptions extends IngestOptions {
	/** Optional client override for tests or an explicitly managed worker client. */
	client?: StorageClient;
}

/** Ingests a source, updates application state, then removes older stored datasets. */
export async function loadDataset(
	source: IngestionSource,
	options: LoadDatasetOptions = {}
): Promise<DatasetSummary> {
	const client = options.client ?? getStorageClient();
	const metadata = await client.ingest(source, {
		signal: options.signal,
		onProgress: options.onProgress
	});
	const summary = toDatasetSummary(metadata);
	loadDatasetSucceeded(summary);
	try {
		await client.deleteDatasetsExcept(metadata.id);
	} catch (error) {
		console.warn('The previous dataset could not be removed from browser storage.', error);
	}
	return summary;
}
