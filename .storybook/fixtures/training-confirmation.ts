import {
	createTrainingService,
	setTrainingServiceForTesting,
	type TrainingService
} from '../../src/features/models/training/training-service';
import { $appState, reduceCreateModel } from '../../src/stores/app.store';
import {
	$datasetResources,
	$previewRows,
	setStorageClientForTesting
} from '../../src/stores/dataset.store';
import {
	toDatasetSummary,
	type CategoricalColumnStats,
	type DatasetMetadata
} from '../../src/types/dataset';
import { INITIAL_APP_STATE } from '../../src/types/state';

function category(name: string): CategoricalColumnStats {
	return {
		name,
		type: 'categorical',
		missingCount: 0,
		missingTokens: {},
		invalidCount: 0,
		invalidExamples: [],
		distinctCount: 2,
		categoryCounts: { First: 2, Second: 2 }
	};
}

/** Seeds an isolated connected-view story with data and deferred command outcomes. */
export function seedTrainingConfirmation(overrides: Partial<TrainingService>): () => void {
	const originalState = $appState.get();
	const originalResources = $datasetResources.get();
	const originalPreview = $previewRows.get();
	const metadata: DatasetMetadata = {
		id: 'penguins-story',
		name: 'Palmer Penguins',
		source: 'upload',
		sampleId: null,
		rowCount: 4,
		byteLength: 48,
		createdAt: 1,
		delimiter: ',',
		columns: [category('species'), category('island')],
		paddedRowCount: 0,
		skippedRows: { count: 0, rowNumbers: [] }
	};
	const state = reduceCreateModel(
		{
			...structuredClone(INITIAL_APP_STATE),
			dataset: toDatasetSummary(metadata),
			target: 'species',
			data: { mode: 'preview', selectedColumn: null }
		},
		1
	);
	if (!state) throw new Error('Missing story fixture model');
	setTrainingServiceForTesting({ ...createTrainingService(), ...overrides });
	setStorageClientForTesting({
		ingest: async () => metadata,
		validate: async () => ({ rowCount: 0, columnCount: 0 }),
		getMetadata: async () => metadata,
		fetchRows: async () => [],
		deleteDatasetsExcept: async () => {},
		dispose: () => {}
	});
	$datasetResources.set({
		datasetId: metadata.id,
		status: 'ready',
		metadata,
		descriptor: null,
		error: null
	});
	$previewRows.set({
		datasetId: metadata.id,
		status: 'ready',
		startIndex: 0,
		rows: [],
		error: null
	});
	$appState.set(state);
	return () => {
		$appState.set(originalState);
		$datasetResources.set(originalResources);
		$previewRows.set(originalPreview);
		setStorageClientForTesting(null);
		setTrainingServiceForTesting();
	};
}
