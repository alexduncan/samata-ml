import m from 'mithril';
import { Select } from '../components/select';
import { VirtualTable } from '../components/virtualTable/component';
import { VirtualTableModel } from '../components/virtualTable/model';
import datasets from '../config/datasets';
import { Pipeline } from '../models/pipeline';
import { DatasetPreviewModel } from '../models/upload/datasetPreview';
import { UploadModel } from '../models/upload/upload';

const datasetOptions = datasets.map((dataset) => ({
	label: dataset.name,
	value: dataset.url
}));

let isDragging = false;

/**
 * Determine whether the Select Data step should render the uploaded dataset preview.
 *
 * @param None.
 * @returns `true` when the pipeline has a dataset selected but no model type yet.
 * @throws This function does not throw directly.
 * @example
 * ```ts
 * const showPreview = shouldShowDatasetPreview();
 * ```
 */
function shouldShowDatasetPreview(): boolean {
	return Pipeline.state.datasetId !== null && Pipeline.state.modelType === null;
}

/**
 * Synchronize the preview model with the pipeline state used by the Select Data step.
 *
 * @param None.
 * @returns Nothing.
 * @throws This function does not throw directly.
 * @example
 * ```ts
 * syncDatasetPreviewState();
 * ```
 */
function syncDatasetPreviewState(): void {
	DatasetPreviewModel.ensureDataset(shouldShowDatasetPreview() ? Pipeline.state.datasetId : null);
}

/**
 * Render the dataset preview table shown after a successful upload.
 *
 * @param None.
 * @returns The Mithril vnode tree for the preview state.
 * @throws This function does not throw directly.
 * @example
 * ```ts
 * const preview = renderDatasetPreview();
 * ```
 */
function renderDatasetPreview(): m.Children {
	if (DEBUG) console.log('SelectDataView.renderDatasetPreview');

	const tableModel = new VirtualTableModel();
	tableModel.init();

	return m(
		'section#dataset-preview',
		{
			style: {
				display: 'flex',
				flexDirection: 'column',
				flex: '1',
				minHeight: '0',
				height: '100%'
			}
		},
		[
			m('p.status', UploadModel.uploadStatus || 'Uploaded dataset preview'),
			DatasetPreviewModel.error &&
				m(
					'.error-banner',
					{ style: { color: 'red', marginBottom: '10px' } },
					DatasetPreviewModel.error
				),
			DatasetPreviewModel.isLoading &&
				m('p.status', 'Loading uploaded dataset preview from IndexedDB...'),
			DatasetPreviewModel.metadata &&
				m(
					'.table-preview',
					{
						style: {
							flex: '1',
							minHeight: '0'
						}
					},
					m(VirtualTable, { model: tableModel })
				)
		]
	);
}

/**
 * Render the upload controls shown before a dataset has been uploaded.
 *
 * @param None.
 * @returns The Mithril vnode tree for the upload state.
 * @throws This function does not throw directly.
 * @example
 * ```ts
 * const view = renderUploadView();
 * ```
 */
function renderUploadView(): m.Children {
	if (DEBUG) console.log('SelectDataView.renderUploadView');

	// DRAG AND DROP FILE UPLOAD
	return m(
		'section#upload',
		{
			// Prevent default browser behavior (opening the file)
			ondragover: (e: DragEvent) => {
				e.preventDefault();
				if (!UploadModel.isUploading) isDragging = true;
			},
			ondragleave: () => {
				isDragging = false;
			},
			ondrop: (e: DragEvent) => {
				e.preventDefault();
				if (DEBUG) console.log('SelectDataView#ondrop');
				isDragging = false;
				if (UploadModel.isUploading) return;

				const file = e.dataTransfer?.files.item(0);

				if (file) {
					UploadModel.setFile(file);
				}
			}
		},
		[
			// Show error message if there is one
			UploadModel.uploadError &&
				m(
					'.error-banner',
					{ style: { color: 'red', marginBottom: '10px' } },
					UploadModel.uploadError
				),

			// FILE UPLOAD BUTTON
			m('label.file-button', 'Upload a CSV file', [
				m('input[type=file]#fileInput', {
					accept: '.csv,.txt',
					disabled: UploadModel.isUploading,
					onchange: (e: Event) => {
						if (DEBUG) console.log('SelectDataView#fileInput');
						const target = e.target as HTMLInputElement;

						const file = target.files?.item(0);

						if (file) {
							UploadModel.setFile(file);
							target.value = ''; // Reset input
						}
					}
				})
			]),
			m('small', 'or'),

			// TEXT INPUT
			m('input[type=text]#fileURL', {
				placeholder: 'Paste url to CSV file...',
				disabled: UploadModel.isUploading,
				// Using onchange so it only fires when the user clicks away or hits enter
				onchange: (e: Event) => {
					if (DEBUG) console.log('SelectDataView#fileURL');
					const target = e.target as HTMLInputElement;
					UploadModel.setUrl(target.value);
				}
			}),
			m('small', 'or'),

			// SELECT FILE
			m(Select, {
				id: 'selectDataset',
				options: datasetOptions,
				disabled: UploadModel.isUploading,
				value: '',
				placeholder: 'Select a sample dataset...',
				onchange: (value: string) => {
					if (DEBUG) console.log('SelectDataView#selectDataset');
					const selectedOption = datasetOptions.find((o) => o.value === value);
					if (selectedOption) {
						UploadModel.setUrl(selectedOption.value, selectedOption.label);
					}
				}
			}),

			m('p.status', UploadModel.uploadStatus),

			// Render the progress bar if an upload is actively processing
			UploadModel.isUploading &&
				m('.progress-container', [
					m('progress', {
						max: 100,
						value: UploadModel.uploadProgress,
						style: { width: '100%', marginTop: '10px' }
					}),
					m('span', ` ${UploadModel.uploadProgress}%`)
				])
		]
	);
}

export const SelectDataView: m.Component = {
	/**
	 * Synchronize preview state before the Select Data step is first rendered.
	 *
	 * @param None.
	 * @returns Nothing.
	 * @throws This function does not throw directly.
	 * @example
	 * ```ts
	 * SelectDataView.oninit?.();
	 * ```
	 */
	oninit() {
		syncDatasetPreviewState();
	},

	/**
	 * Synchronize preview state when Mithril considers updating the Select Data step.
	 *
	 * @param None.
	 * @returns `true` so Mithril continues with the update.
	 * @throws This function does not throw directly.
	 * @example
	 * ```ts
	 * SelectDataView.onbeforeupdate?.();
	 * ```
	 */
	onbeforeupdate() {
		syncDatasetPreviewState();
		return true;
	},

	/**
	 * Render either the dataset upload UI or the uploaded dataset preview table.
	 *
	 * @param None.
	 * @returns The Mithril vnode tree for the Select Data step.
	 * @throws This function does not throw directly.
	 * @example
	 * ```ts
	 * const view = SelectDataView.view?.();
	 * ```
	 */
	view() {
		return shouldShowDatasetPreview() ? renderDatasetPreview() : renderUploadView();
	}
};
