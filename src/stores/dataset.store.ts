import { atom } from 'nanostores';
import {
	getTrainingService,
	type TrainingCommandResult
} from '../features/models/training/training-service';
import { IngestionError, type IngestionErrorCode } from '../features/data/ingestion/errors';
import type { IngestionProgress, IngestionSource } from '../features/data/ingestion/pipeline';
import { getStorageClient, type StorageClient } from '../features/data/ingestion/storage-client';
import { loadDataset } from '../features/data/load-dataset';
import { loadSampleDescriptor } from '../features/data/sample-datasets';
import { trackBetaEvent } from '../common/telemetry/telemetry-client';
import { retiredSampleGuidance } from '../features/data/retired-sample-guidance';
import { $appState } from './app.store';
import type { DatasetMetadata, RawRecord } from '../types/dataset';
import type { SampleDatasetGuidance } from '../types/sample-dataset';

/** Status of dataset resource loading. */
export type ResourceStatus = 'idle' | 'loading' | 'ready' | 'error';

/** State holding loaded dataset metadata and optional sample descriptor. */
export interface DatasetResourcesState {
	datasetId: string | null;
	status: ResourceStatus;
	metadata: DatasetMetadata | null;
	descriptor: SampleDatasetGuidance | null;
	error: string | null;
}

/** State holding paged raw rows for dataset preview. */
export interface PreviewRowsState {
	datasetId: string | null;
	startIndex: number;
	rows: RawRecord[];
	status: ResourceStatus;
	error: string | null;
}

/** State tracking an active dataset load or ingestion run. */
export interface DatasetLoadState {
	busy: boolean;
	progress: IngestionProgress | null;
	errorCode: IngestionErrorCode | null;
}

const INITIAL_RESOURCES: DatasetResourcesState = {
	datasetId: null,
	status: 'idle',
	metadata: null,
	descriptor: null,
	error: null
};

const INITIAL_PREVIEW: PreviewRowsState = {
	datasetId: null,
	startIndex: 0,
	rows: [],
	status: 'idle',
	error: null
};

const INITIAL_LOAD: DatasetLoadState = {
	busy: false,
	progress: null,
	errorCode: null
};

/**
 * Nanostore holding metadata and sample descriptor for the active dataset.
 */
export const $datasetResources = atom<DatasetResourcesState>(INITIAL_RESOURCES);

/**
 * Nanostore holding the current window of preview rows.
 */
export const $previewRows = atom<PreviewRowsState>(INITIAL_PREVIEW);

/**
 * Nanostore holding active dataset loading/ingestion progress and error state.
 */
export const $datasetLoad = atom<DatasetLoadState>(INITIAL_LOAD);

let resourceGeneration = 0;
let previewGeneration = 0;

interface CachedWindow {
	startIndex: number;
	limit: number;
	rows: RawRecord[];
}

let cachedWindowsDatasetId: string | null = null;
let cachedWindows: CachedWindow[] = [];

let inFlightPreviewRequest: Promise<void> | null = null;
let pendingPreviewRange: {
	datasetId: string;
	startIndex: number;
	limit: number;
	gen: number;
} | null = null;

let activeAbortController: AbortController | null = null;
let testClient: StorageClient | null = null;

/**
 * @internal Allows test suites to provide controlled storage client instances.
 */
export function setStorageClientForTesting(client: StorageClient | null): void {
	testClient = client;
}

function getEffectiveClient(): StorageClient {
	return testClient ?? getStorageClient();
}

/**
 * Loads metadata and descriptor resources for a dataset.
 * Rejects stale responses and treats missing descriptors as advisory.
 *
 * @param datasetId - ID of the dataset to load resources for.
 */
export async function loadDatasetResources(datasetId: string): Promise<void> {
	const currentGen = ++resourceGeneration;
	$datasetResources.set({
		datasetId,
		status: 'loading',
		metadata: null,
		descriptor: null,
		error: null
	});

	try {
		const client = getEffectiveClient();
		const metadata = await client.getMetadata(datasetId);

		if (currentGen !== resourceGeneration) return;

		if (!metadata) {
			$datasetResources.set({
				datasetId,
				status: 'error',
				metadata: null,
				descriptor: null,
				error: 'The dataset metadata could not be found.'
			});
			return;
		}

		// Descriptors resolve through the persisted sampleId, not dataset UUID.
		const sampleId = metadata.sampleId ?? null;

		let descriptor: SampleDatasetGuidance | null = null;
		if (sampleId) {
			descriptor = retiredSampleGuidance[sampleId] ?? null;
			if (!descriptor) {
				try {
					descriptor = await loadSampleDescriptor(sampleId);
				} catch (descError) {
					console.warn(
						'Sample descriptor could not be loaded; continuing without it.',
						descError
					);
				}
			}
		}

		if (currentGen !== resourceGeneration) return;

		$datasetResources.set({
			datasetId,
			status: 'ready',
			metadata,
			descriptor,
			error: null
		});
	} catch (error) {
		if (currentGen !== resourceGeneration) return;
		$datasetResources.set({
			datasetId,
			status: 'error',
			metadata: null,
			descriptor: null,
			error: error instanceof Error ? error.message : String(error)
		});
	}
}

/**
 * Executes a single fetch operation or returns cached rows, queueing only the latest pending range.
 */
async function fetchPreviewWindow(
	targetDatasetId: string,
	targetStartIndex: number,
	targetLimit: number,
	targetGen: number
): Promise<void> {
	try {
		const client = getEffectiveClient();
		const rows = await client.fetchRows(targetDatasetId, targetStartIndex, targetLimit);

		if (targetGen !== previewGeneration || cachedWindowsDatasetId !== targetDatasetId) {
			return;
		}

		if (cachedWindows.length >= 3) {
			cachedWindows.shift();
		}
		cachedWindows.push({ startIndex: targetStartIndex, limit: targetLimit, rows });

		$previewRows.set({
			datasetId: targetDatasetId,
			startIndex: targetStartIndex,
			rows,
			status: 'ready',
			error: null
		});
	} catch (error) {
		if (targetGen !== previewGeneration || cachedWindowsDatasetId !== targetDatasetId) {
			return;
		}
		$previewRows.set({
			datasetId: targetDatasetId,
			startIndex: targetStartIndex,
			rows: [],
			status: 'error',
			error: error instanceof Error ? error.message : String(error)
		});
	} finally {
		inFlightPreviewRequest = null;
		if (pendingPreviewRange) {
			const next = pendingPreviewRange;
			pendingPreviewRange = null;
			inFlightPreviewRequest = fetchPreviewWindow(
				next.datasetId,
				next.startIndex,
				next.limit,
				next.gen
			);
			await inFlightPreviewRequest;
		}
	}
}

/**
 * Loads a slice of raw records for dataset preview.
 * Bounds requests to 256 rows, caches up to three windows, and allows only one request in flight.
 *
 * @param datasetId - ID of the dataset to fetch rows from.
 * @param startIndex - Zero-based offset of the first row to fetch.
 * @param limit - Number of rows to fetch (capped at 256).
 */
export async function loadPreviewRows(
	datasetId: string,
	startIndex: number,
	limit: number
): Promise<void> {
	const clampedLimit = Math.max(0, Math.min(limit, 256));

	if (datasetId !== cachedWindowsDatasetId) {
		cachedWindows = [];
		cachedWindowsDatasetId = datasetId;
	}

	const hit = cachedWindows.find((w) => w.startIndex === startIndex && w.limit === clampedLimit);
	if (hit) {
		$previewRows.set({
			datasetId,
			startIndex,
			rows: hit.rows,
			status: 'ready',
			error: null
		});
		return;
	}

	const gen = ++previewGeneration;
	$previewRows.set({
		datasetId,
		startIndex,
		rows: $previewRows.get().rows,
		status: 'loading',
		error: null
	});

	if (inFlightPreviewRequest) {
		pendingPreviewRange = { datasetId, startIndex, limit: clampedLimit, gen };
		await inFlightPreviewRequest;
		return;
	}

	inFlightPreviewRequest = fetchPreviewWindow(datasetId, startIndex, clampedLimit, gen);
	await inFlightPreviewRequest;
}

/**
 * Clears loaded resources and row caches, invalidating any pending async operations.
 */
export function clearDatasetResources(): void {
	resourceGeneration++;
	previewGeneration++;
	cachedWindows = [];
	cachedWindowsDatasetId = null;
	pendingPreviewRange = null;
	$datasetResources.set(INITIAL_RESOURCES);
	$previewRows.set(INITIAL_PREVIEW);
}

/** Confirms removal using the captured dataset and target identity. */
export async function changeDataset(
	datasetId = $appState.get().dataset?.id,
	target = $appState.get().target
): Promise<TrainingCommandResult> {
	if ($datasetLoad.get().busy) return { ok: false, code: 'busy' };
	if (!datasetId) return { ok: false, code: 'conflict' };
	const result = await getTrainingService().discardDataset(datasetId, target);
	if (result.ok) clearDatasetResources();
	return result;
}

/**
 * Starts a dataset ingestion run with cancellation tracking.
 *
 * @param source - Ingestion source to process.
 * @returns True if ingestion completed successfully, false otherwise.
 */
export async function startDatasetLoad(source: IngestionSource): Promise<boolean> {
	if ($datasetLoad.get().busy) return false;

	const controller = new AbortController();
	activeAbortController = controller;
	$datasetLoad.set({ busy: true, progress: null, errorCode: null });

	try {
		await loadDataset(source, {
			client: getEffectiveClient(),
			signal: controller.signal,
			onProgress: (progress) => {
				if (activeAbortController === controller) {
					$datasetLoad.set({ busy: true, progress, errorCode: null });
				}
			}
		});

		if (activeAbortController === controller) {
			$datasetLoad.set({ busy: false, progress: null, errorCode: null });
			activeAbortController = null;
			trackBetaEvent(
				source.kind === 'sample' ? 'sample_dataset_selected' : 'custom_dataset_uploaded'
			);
		}
		return true;
	} catch (error) {
		if (activeAbortController === controller) {
			activeAbortController = null;
			let errorCode: IngestionErrorCode = 'UNKNOWN';
			if (error instanceof IngestionError) {
				errorCode = error.code;
			} else if (controller.signal.aborted) {
				errorCode = 'CANCELLED';
			}
			$datasetLoad.set({ busy: false, progress: null, errorCode });
		}
		return false;
	}
}

/**
 * Cancels the currently active dataset loading process, if one is running.
 */
export function cancelDatasetLoad(): void {
	if (activeAbortController) {
		activeAbortController.abort();
	}
}
