import type { PersistedAppState } from '../../types/state';
import type { DatasetLoadState } from '../../stores/dataset.store';

/** Which presentation the data route shows, and whether a failed load needs an alert. */
export interface DataViewMode {
	/** `preview` covers loading, the publication gap and the ready preview. */
	mode: 'selection' | 'preview';
	/** True when a load failed after ingestion started and nothing was published. */
	showLoadAlert: boolean;
}

/**
 * Chooses the data route's presentation (virtual-table-improvements D20).
 *
 * The preview branch is shown while a load is ingesting and whenever a dataset is published in
 * preview mode, so one preview element persists from loading through publication into the ready
 * preview. A failure returns to the selection view with an alert only when no dataset exists;
 * if a replacement had already committed, the preview stays and the shell's pending-save notice
 * is the recovery path.
 *
 * @param appState - The dataset summary and the data route's mode.
 * @param load - The active load's stage and the stage of its failure, if any.
 * @returns The mode and whether to show the load-failure alert.
 */
export function selectDataViewMode(
	appState: Pick<PersistedAppState, 'dataset' | 'data'>,
	load: Pick<DatasetLoadState, 'stage' | 'errorStage'>
): DataViewMode {
	const preview =
		load.stage === 'ingesting' ||
		(appState.dataset !== null && appState.data.mode === 'preview');
	return {
		mode: preview ? 'preview' : 'selection',
		showLoadAlert: load.errorStage === 'ingesting' && appState.dataset === null
	};
}
