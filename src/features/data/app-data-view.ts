import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { params } from '@nanostores/i18n';
import { customElement, state } from 'lit/decorators.js';
import { StoreController } from '@nanostores/lit';
import { $appState, setSelectedColumn } from '../../stores/app.store';
import {
	$datasetLoad,
	$datasetResources,
	$previewRows,
	cancelDatasetLoad,
	changeDataset,
	clearDatasetResources,
	loadDatasetResources,
	loadPreviewRows,
	startDatasetLoad
} from '../../stores/dataset.store';
import { buildPreviewColumns, formatPreviewValue } from './preview-columns';
import { loadSampleCatalogue, loadSampleDatasheet } from './sample-datasets';
import { getTrainingService } from '../models/training/training-service';
import type { SampleDatasetIndex } from '../../types/sample-dataset';
import { buttonStyles } from '../../styles/button.styles';
import { dialogStyles } from '../../styles/dialog.styles';
import { headingFocusStyles } from '../../styles/heading-focus.styles';
import './app-dataset-card';
import './app-datasheet-dialog';
import './app-upload-dataset-dialog';
import './app-dataset-preview';
import './app-column-details';
import type { AppDatasetPreview, PreviewLabels } from './app-dataset-preview';
import type {
	VirtualTableColumn,
	VirtualTableRange,
	VirtualTableWindow
} from '../../components/ui-virtual-table';
import type { ColumnStats, RawRecord } from '../../types/dataset';
import type { SampleDatasetGuidance } from '../../types/sample-dataset';
import type { DatasetMetadata } from '../../types/dataset';
import { $format, i18n } from '../../i18n';
import { INGESTION_ERROR_MESSAGES } from './ingestion/errors';
import { StickyHeaderController } from '../shell/sticky-header-controller';

const noticeMessages = i18n('app-data-sample-notice', {
	remote: 'Downloaded from the source when loaded. Internet connection required.',
	samples: 'Sample datasets'
});

const changeMessages = i18n('app-data-change-dataset', {
	remote: 'Training in another tab',
	busy: 'The dataset is busy. Try again.',
	failed: 'The dataset could not be changed. Try again.',
	pending: 'The change is saved, but finishing is pending. Retry saving.',
	retry: 'Retry saving',
	changing: 'Changing…',
	change: 'Change Dataset'
});

const previewMessages = i18n('app-data-preview', {
	heading: params<{ name: string }>('{name} Preview'),
	datasheet: 'Datasheet',
	changeDataset: 'Change Dataset',
	loadingDescription: 'Loading dataset…',
	rowsColumns: params<{ rows: string; columns: string }>('{rows} rows | {columns} columns'),
	rowLimitNotice: params<{ limit: string; total: string }>(
		'Previewing the first {limit} of {total} rows. All rows are used for training.'
	),
	empty: 'No rows to preview.',
	retry: 'Retry',
	errorMessage: 'The preview could not be loaded.',
	unsupported: ', not used for training',
	progressLabel: 'Loading progress',
	preparing: 'Loading preview…'
});

/** Formats a stored row window for the table with the active locale. */
function formatPreviewRows(
	records: readonly RawRecord[],
	columns: readonly ColumnStats[]
): readonly (readonly string[])[] {
	const formatNumber = numberFormatter();
	return records.map((record) =>
		record.values.map((value, index) => formatPreviewValue(value, columns[index], formatNumber))
	);
}

/** The cell number formatter for the active locale. */
function numberFormatter(): (value: number) => string {
	const format = $format.get();
	return (value) => format.number(value, { useGrouping: true, maximumFractionDigits: 20 });
}

/**
 * Connected root workflow view for Step 1: Load Data and Preview.
 * Follows specification/plans/step-1-load-data-and-preview.md.
 */
@customElement('app-data-view')
export class AppDataView extends LitElement {
	static override readonly styles = [
		headingFocusStyles,
		dialogStyles,
		buttonStyles,
		css`
			:host {
				display: block;
			}

			.page-body {
				margin: 0 2rem 2rem;
			}

			.page-header {
				display: grid;
				position: sticky;
				grid-template-columns: minmax(0, 1fr) auto;
				grid-template-areas:
					'title       action'
					'description action';
				column-gap: 2rem;
				row-gap: 0.5rem;
				align-items: center;
				z-index: 10;
				box-sizing: border-box;
				inset-block-start: 0;
				background-color: var(--stone-50);
				padding: 1.5rem 2rem;
				inline-size: 100%;

				@media (max-height: 30rem) {
					position: static;
				}

				> h1 {
					grid-area: title;
					margin: 0;
					color: var(--stone-900);
					font-weight: 500;
					font-size: 1.5rem;
				}

				> p {
					grid-area: description;
					margin: 0;
					color: var(--stone-700);
					line-height: 1.75rem;
				}

				> button {
					grid-area: action;
					justify-self: end;
				}
			}

			.cards {
				display: grid;
				grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
				justify-content: center;
				gap: 1.5rem;
				margin: 0;
				padding: 0;
				list-style: none;
			}

			.card-item {
				display: flex;
				flex-direction: column;
				gap: 0.5rem;
			}

			.visually-hidden {
				position: absolute;
				clip-path: inset(50%);
				inline-size: 1px;
				block-size: 1px;
				overflow: hidden;
				white-space: nowrap;
			}

			.remote-notice {
				margin: 0;
				color: var(--stone-700);
				font-size: 0.8125rem;
				line-height: 1.25rem;
				overflow-wrap: anywhere;
			}

			.status-notice {
				display: flex;
				flex-direction: column;
				align-items: flex-start;
				gap: 0.75rem;
				padding-block: 1rem;
				color: var(--stone-700);
			}
		`
	];

	private readonly stickyHeader = new StickyHeaderController(this);
	private readonly appStateController = new StoreController(this, $appState);
	private readonly resourcesController = new StoreController(this, $datasetResources);
	private readonly previewController = new StoreController(this, $previewRows);
	private readonly loadController = new StoreController(this, $datasetLoad);

	@state() private accessor catalogueStatus: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
	@state() private accessor catalogue: SampleDatasetIndex | null = null;
	@state() private accessor catalogueError: string | null = null;

	@state() private accessor datasheetOpen = false;
	@state() private accessor datasheetHeading = '';
	@state() private accessor datasheetContent: DocumentFragment | null = null;
	@state() private accessor datasheetStatus: 'loading' | 'ready' | 'error' = 'loading';

	@state() private accessor uploadOpen = false;

	@state() private accessor changeDatasetOpen = false;
	@state() private accessor changeDatasetError: string | null = null;
	@state() private accessor changeDatasetBusy = false;
	@state() private accessor changeDatasetPending = false;
	private changeIdentity: { datasetId: string; target: string | null } | null = null;
	private readonly changeMessagesController = new StoreController(this, changeMessages);
	private readonly noticeMessagesController = new StoreController(this, noticeMessages);

	private cataloguePromise: Promise<void> | null = null;
	private catalogueSelection: AbortController | null = null;
	private activeDatasheetId: string | null = null;
	private datasheetInvoker: HTMLElement | null = null;
	private uploadInvoker: HTMLElement | null = null;
	private ownedUpload: Promise<boolean> | null = null;
	private changeDatasetInvoker: HTMLElement | null = null;
	private datasheetSeq = 0;
	private abortController = new AbortController();
	private resourcesDeferred: { promise: Promise<void>; resolve: () => void } | null = null;
	private previewLabelCache: {
		messages: unknown;
		format: unknown;
		labels: PreviewLabels;
	} | null = null;
	private columnCache: {
		metadata: DatasetMetadata | null;
		descriptor: SampleDatasetGuidance | null;
		format: unknown;
		columns: readonly VirtualTableColumn[];
	} | null = null;

	private get previewEl(): AppDatasetPreview | null {
		return this.renderRoot?.querySelector('app-dataset-preview') ?? null;
	}

	private get changeDatasetDialogElement(): HTMLDialogElement | null {
		return this.renderRoot?.querySelector('dialog.change-dataset-modal') ?? null;
	}

	override connectedCallback(): void {
		super.connectedCallback();
		if (this.abortController.signal.aborted) this.abortController = new AbortController();
		const appState = this.appStateController.value;
		if (appState.dataset && appState.data.mode === 'preview') {
			const datasetId = appState.dataset.id;
			const resources = this.resourcesController.value;
			if (resources.datasetId !== datasetId && resources.status !== 'loading') {
				queueMicrotask(() => {
					void loadDatasetResources(datasetId);
				});
			}
		} else {
			this.startCatalogueSelection();
		}
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		this.settleResources();
		this.stopCatalogueSelection();
		this.datasheetSeq++;
		this.abortController.abort();
	}

	override willUpdate(changedProperties: PropertyValues): void {
		super.willUpdate(changedProperties);
		const { dataset, data } = this.appStateController.value;
		// Styling hook for `main:has(> app-data-view[preview])`, the document-wide table layout.
		this.toggleAttribute('preview', dataset !== null && data.mode === 'preview');
	}

	override updated(changedProperties: PropertyValues): void {
		super.updated(changedProperties);
		if (this.resourcesReady()) this.settleResources();

		const changeDialog = this.changeDatasetDialogElement;
		if (changeDialog) {
			if (this.changeDatasetOpen && !changeDialog.open) {
				try {
					changeDialog.showModal();
				} catch {
					changeDialog.open = true;
				}
			} else if (!this.changeDatasetOpen && changeDialog.open) {
				changeDialog.close();
			}
		}

		const appState = this.appStateController.value;
		if (appState.dataset && appState.data.mode === 'preview') {
			this.stopCatalogueSelection();
			const datasetId = appState.dataset.id;
			const resources = this.resourcesController.value;
			if (resources.datasetId !== datasetId && resources.status !== 'loading') {
				queueMicrotask(() => {
					void loadDatasetResources(datasetId);
				});
			}
		} else {
			this.startCatalogueSelection();
		}
	}

	/**
	 * Focuses the current page heading after rendering, unless cancelled or disconnected.
	 *
	 * @param signal - Cancels a superseded navigation's focus request.
	 */
	async focusHeading(signal: AbortSignal): Promise<void> {
		if (signal.aborted || !this.isConnected) return;
		await this.updateComplete;
		if (signal.aborted || !this.isConnected) return;
		const preview = this.previewEl;
		if (preview) {
			await preview.focusHeading(signal);
		} else {
			this.renderRoot.querySelector<HTMLElement>('.page-header > h1')?.focus({
				preventScroll: true
			});
		}
	}

	/** Whether metadata for the active dataset has finished loading, successfully or not. */
	private resourcesReady(): boolean {
		const { dataset } = this.appStateController.value;
		const resources = this.resourcesController.value;
		return (
			dataset !== null &&
			resources.datasetId === dataset.id &&
			(resources.status === 'ready' || resources.status === 'error')
		);
	}

	private settleResources(): void {
		this.resourcesDeferred?.resolve();
		this.resourcesDeferred = null;
	}

	/**
	 * Waits for active catalogue, resource and rendering operations to settle.
	 *
	 * In preview mode this also waits for the dataset's metadata and the table's geometry, so the
	 * router's single scroll restoration lands on a full-height document (D17).
	 */
	async whenSettled(): Promise<void> {
		await this.updateComplete;
		if (this.cataloguePromise) {
			try {
				await this.cataloguePromise;
			} catch {
				// Errors captured in component state
			}
		}
		const { dataset, data } = this.appStateController.value;
		if (dataset !== null && data.mode === 'preview') {
			if (!this.resourcesReady()) {
				this.resourcesDeferred ??= (() => {
					let resolve!: () => void;
					const promise = new Promise<void>((done) => (resolve = done));
					return { promise, resolve };
				})();
				await this.resourcesDeferred.promise;
			}
			await this.updateComplete;
			await this.previewEl?.whenSettled();
		}
		await this.updateComplete;
	}

	private startCatalogueSelection(): void {
		this.catalogueSelection ??= new AbortController();
		if (this.catalogueStatus === 'idle') this.fetchCatalogue();
	}

	private stopCatalogueSelection(): void {
		if (!this.catalogueSelection) return;
		this.catalogueSelection.abort();
		this.catalogueSelection = null;
		this.cataloguePromise = null;
		queueMicrotask(() => {
			if (!this.cataloguePromise && this.catalogueStatus !== 'ready') {
				this.catalogueStatus = 'idle';
				this.catalogueError = null;
			}
		});
	}

	private fetchCatalogue(): void {
		const selection = this.catalogueSelection;
		if (!selection || this.cataloguePromise) return;
		const current = () => {
			const { dataset, data } = this.appStateController.value;
			return (
				this.isConnected &&
				this.catalogueSelection === selection &&
				(!dataset || data.mode === 'select')
			);
		};
		const promise = Promise.resolve()
			.then(async () => {
				if (!current()) return;
				this.catalogueStatus = 'loading';
				this.catalogueError = null;
				try {
					const index = await loadSampleCatalogue(selection.signal);
					if (!current()) return;
					this.catalogue = index;
					this.catalogueStatus = 'ready';
				} catch (error) {
					if (!current()) return;
					// A newly connected view can briefly share an aborted loader request.
					if (error instanceof DOMException && error.name === 'AbortError') {
						this.cataloguePromise = null;
						this.catalogueStatus = 'idle';
						return;
					}
					this.catalogue = null;
					this.catalogueStatus = 'error';
					this.catalogueError = error instanceof Error ? error.message : String(error);
				}
			})
			.finally(() => {
				if (this.cataloguePromise === promise) this.cataloguePromise = null;
			});
		this.cataloguePromise = promise;
	}

	private handleUploadClick(e: MouseEvent): void {
		this.uploadInvoker = (e.currentTarget as HTMLElement) ?? null;
		this.uploadOpen = true;
	}

	private async handleUploadFileSelect(e: CustomEvent<{ file: File }>): Promise<void> {
		if ($datasetLoad.get().busy) return;
		const upload = startDatasetLoad({ kind: 'file', file: e.detail.file });
		this.ownedUpload = upload;
		const ok = await upload;
		if (this.ownedUpload !== upload) return;
		this.ownedUpload = null;
		if (ok) this.uploadOpen = false;
	}

	private handleUploadCancel(): void {
		if (!this.ownedUpload) return;
		this.ownedUpload = null;
		cancelDatasetLoad();
	}

	private handleUploadClose(): void {
		this.uploadOpen = false;
		this.handleUploadCancel();
	}

	private handleCardSelect(e: CustomEvent<{ datasetId: string; name: string }>): void {
		void startDatasetLoad({ kind: 'sample', sampleId: e.detail.datasetId });
	}

	private handleCardDatasheet(
		e: CustomEvent<{ datasetId: string; name: string; invoker?: HTMLElement }>
	): void {
		this.openDatasheet(e.detail.datasetId, e.detail.name, e.detail.invoker ?? null);
	}

	private handlePreviewDatasheet(e: CustomEvent<{ invoker: HTMLButtonElement }>): void {
		const dataset = this.appStateController.value.dataset;
		if (!dataset?.sampleId) return;
		this.openDatasheet(dataset.sampleId, dataset.name, e.detail.invoker);
	}

	private openDatasheet(datasetId: string, name: string, invoker: HTMLElement | null): void {
		this.activeDatasheetId = datasetId;
		this.datasheetHeading = name;
		this.datasheetOpen = true;
		this.datasheetInvoker = invoker;
		this.loadDatasheet(datasetId);
	}

	private loadDatasheet(id: string): void {
		const seq = ++this.datasheetSeq;
		this.datasheetStatus = 'loading';
		this.datasheetContent = null;

		void loadSampleDatasheet(id, this.abortController.signal)
			.then((fragment) => {
				if (seq !== this.datasheetSeq) return;
				this.datasheetContent = fragment;
				this.datasheetStatus = 'ready';
			})
			.catch(() => {
				if (seq !== this.datasheetSeq) return;
				this.datasheetContent = null;
				this.datasheetStatus = 'error';
			});
	}

	private handleDatasheetClose(): void {
		this.datasheetOpen = false;
	}

	private handleDatasheetRetry(): void {
		if (this.activeDatasheetId) {
			this.loadDatasheet(this.activeDatasheetId);
		}
	}

	private handlePreviewRangeChange(e: CustomEvent<VirtualTableRange>): void {
		const datasetId = this.appStateController.value.dataset?.id;
		if (datasetId) {
			void loadPreviewRows(datasetId, e.detail.startIndex, e.detail.limit);
		}
	}

	private handlePreviewColumnSelect(e: CustomEvent<{ column: string }>): void {
		setSelectedColumn(e.detail.column);
	}

	private handleColumnDetailsClose(): void {
		const prev = this.appStateController.value.data.selectedColumn;
		setSelectedColumn(null);
		if (prev && this.previewEl) {
			this.previewEl.focusColumn(prev);
		}
	}

	private handlePreviewRetry(): void {
		const datasetId = this.appStateController.value.dataset?.id;
		if (!datasetId) return;
		void loadDatasetResources(datasetId);
		void loadPreviewRows(datasetId, this.previewController.value.startIndex, 50);
	}

	private handleChangeDatasetRequest(e: Event): void {
		const state = this.appStateController.value;
		if (!state.dataset) return;
		this.changeIdentity = { datasetId: state.dataset.id, target: state.target };
		this.changeDatasetInvoker = (e.target as HTMLElement) ?? null;
		this.changeDatasetOpen = true;
		this.changeDatasetError = null;
	}

	private handleChangeDatasetCancel(): void {
		if (this.changeDatasetBusy || this.changeDatasetPending) return;
		this.changeDatasetOpen = false;
		this.changeDatasetError = null;
		this.changeIdentity = null;
		if (this.changeDatasetInvoker) {
			this.changeDatasetInvoker.focus();
		}
	}

	private handleChangeDatasetDialogNativeClose(event: Event): void {
		if (event.type === 'cancel' && (this.changeDatasetBusy || this.changeDatasetPending)) {
			event.preventDefault();
			return;
		}
		this.changeDatasetOpen = false;
	}

	private async handleChangeDatasetConfirm(): Promise<void> {
		if (this.changeDatasetBusy || !this.changeIdentity) return;
		this.changeDatasetBusy = true;
		this.changeDatasetError = null;
		try {
			const result = this.changeDatasetPending
				? await getTrainingService().retry()
				: await changeDataset(this.changeIdentity.datasetId, this.changeIdentity.target);
			if (result.ok) {
				this.changeDatasetOpen = false;
				this.changeDatasetPending = false;
				this.changeIdentity = null;
				clearDatasetResources();
			} else {
				const labels = this.changeMessagesController.value;
				this.changeDatasetPending ||= result.pending === 'discard';
				this.changeDatasetError = this.changeDatasetPending
					? labels.pending
					: result.code === 'remote-training'
						? labels.remote
						: result.code === 'busy'
							? labels.busy
							: labels.failed;
			}
		} finally {
			this.changeDatasetBusy = false;
		}
	}

	private renderDatasheetDialog(): TemplateResult {
		return html`<app-datasheet-dialog
			?open=${this.datasheetOpen}
			.invoker=${this.datasheetInvoker}
			.heading=${this.datasheetHeading}
			.content=${this.datasheetContent}
			.status=${this.datasheetStatus}
			close-label="Close modal"
			@app-datasheet-dialog-close=${this.handleDatasheetClose}
			@app-datasheet-dialog-retry=${this.handleDatasheetRetry}></app-datasheet-dialog>`;
	}

	/** Preview labels for the active locale; the same object while nothing changes. */
	private previewLabels(): PreviewLabels {
		const messages = previewMessages.get();
		const format = $format.get();
		if (
			this.previewLabelCache?.messages === messages &&
			this.previewLabelCache.format === format
		) {
			return this.previewLabelCache.labels;
		}
		const count = (value: number) => format.number(value, { useGrouping: true });
		const labels: PreviewLabels = {
			heading: (name) => messages.heading({ name }),
			datasheet: messages.datasheet,
			changeDataset: messages.changeDataset,
			loadingDescription: messages.loadingDescription,
			rowsColumns: (rows, columns) =>
				messages.rowsColumns({ rows: count(rows), columns: count(columns) }),
			rowLimitNotice: (limit, total) =>
				messages.rowLimitNotice({ limit: count(limit), total: count(total) }),
			empty: messages.empty,
			retry: messages.retry,
			errorMessage: messages.errorMessage,
			unsupported: messages.unsupported,
			progressLabel: messages.progressLabel
		};
		this.previewLabelCache = { messages, format, labels };
		return labels;
	}

	/** Table columns for the loaded metadata; rebuilt only when their inputs change. */
	private previewColumns(
		metadata: DatasetMetadata | null,
		descriptor: SampleDatasetGuidance | null
	): readonly VirtualTableColumn[] {
		const format = $format.get();
		const cache = this.columnCache;
		if (
			cache &&
			cache.metadata === metadata &&
			cache.descriptor === descriptor &&
			cache.format === format
		) {
			return cache.columns;
		}
		const formatNumber = numberFormatter();
		const columns = metadata
			? buildPreviewColumns(metadata.columns, descriptor?.columns ?? [], (value, column) =>
					formatPreviewValue(value, column, formatNumber)
				)
			: [];
		this.columnCache = { metadata, descriptor, format, columns };
		return columns;
	}

	private renderSelectionMode(): TemplateResult {
		const loadState = this.loadController.value;
		let uploadError: string | null = null;
		if (loadState.errorCode && loadState.errorCode !== 'CANCELLED') {
			uploadError =
				INGESTION_ERROR_MESSAGES[loadState.errorCode] ?? INGESTION_ERROR_MESSAGES.UNKNOWN;
		}

		return html`
			<header class="page-header">
				<h1 tabindex="-1">Select Data</h1>
				<p>
					Training an AI model needs data. Get started by choosing one of the sample
					datasets below or uploading your own custom dataset.
				</p>
				<button type="button" class="btn btn-primary" @click=${this.handleUploadClick}>
					Upload Dataset
				</button>
			</header>

			<div class="page-body">
				${this.catalogueStatus === 'loading'
					? html`<div class="status-notice">
							<p role="status">Loading sample datasets...</p>
						</div>`
					: nothing}
				${this.catalogueStatus === 'error'
					? html`
							<div class="status-notice" role="alert">
								<p>Could not load sample dataset catalogue.</p>
								<button type="button" class="btn" @click=${this.fetchCatalogue}>
									Retry
								</button>
							</div>
						`
					: nothing}
				${this.catalogueStatus === 'ready' && this.catalogue
					? html`
							<h2 class="visually-hidden">
								${this.noticeMessagesController.value.samples}
							</h2>
							<ul class="cards">
								${this.catalogue.entries.map(
									(entry) => html`
										<li class="card-item">
											<app-dataset-card
												dataset-id=${entry.id}
												name=${entry.name}
												description=${entry.tagline}
												columns=${entry.stats.columnCount}
												rows=${entry.stats.rowCount}
												@app-dataset-select=${this.handleCardSelect}
												@app-dataset-datasheet-open=${this
													.handleCardDatasheet}></app-dataset-card>
											${entry.csvOrigin === 'remote'
												? html`<p class="remote-notice">
														${this.noticeMessagesController.value
															.remote}
													</p>`
												: nothing}
										</li>
									`
								)}
							</ul>
						`
					: nothing}
			</div>

			${this.renderDatasheetDialog()}

			<app-upload-dataset-dialog
				?open=${this.uploadOpen}
				.invoker=${this.uploadInvoker}
				?busy=${loadState.busy}
				.progress=${loadState.progress}
				.error=${uploadError}
				@app-upload-file-select=${this.handleUploadFileSelect}
				@app-upload-cancel=${this.handleUploadCancel}
				@app-upload-close=${this.handleUploadClose}></app-upload-dataset-dialog>
		`;
	}

	private renderPreviewMode(): TemplateResult {
		const appState = this.appStateController.value;
		const resources = this.resourcesController.value;
		const previewState = this.previewController.value;

		const columns = resources.metadata?.columns ?? [];
		const formattedRows = formatPreviewRows(previewState.rows, columns);
		const previewWindow: VirtualTableWindow = {
			startIndex: previewState.startIndex,
			rows: formattedRows
		};

		const selectedColumnName = appState.data.selectedColumn;
		const selectedColumnStats = selectedColumnName
			? (columns.find((c) => c.name === selectedColumnName) ?? null)
			: null;
		const selectedColumnDisplayName =
			(selectedColumnName &&
				resources.descriptor?.columns.find((c) => c.name === selectedColumnName)
					?.displayName) ||
			'';
		const selectedColumnDescription =
			(selectedColumnName &&
				resources.descriptor?.columns.find((c) => c.name === selectedColumnName)
					?.description) ||
			'';

		const dataset = appState.dataset!;
		const failure = resources.error || previewState.error;

		return html`
			<app-dataset-preview
				.metadata=${resources.metadata}
				.datasetName=${dataset.name}
				.rowCount=${dataset.rowCount}
				.columnCount=${dataset.columns.length}
				.columns=${this.previewColumns(resources.metadata, resources.descriptor)}
				.window=${previewWindow}
				.labels=${this.previewLabels()}
				.statusMessage=${resources.metadata === null && !failure
					? previewMessages.get().preparing
					: ''}
				.datasheetAvailable=${Boolean(dataset.sampleId)}
				?loading=${resources.status === 'loading' || previewState.status === 'loading'}
				.error=${failure}
				@app-preview-range-change=${this.handlePreviewRangeChange}
				@app-preview-column-select=${this.handlePreviewColumnSelect}
				@app-preview-change-dataset=${this.handleChangeDatasetRequest}
				@app-dataset-preview-datasheet=${this.handlePreviewDatasheet}
				@app-preview-retry=${this.handlePreviewRetry}></app-dataset-preview>

			<app-column-details
				.column=${selectedColumnStats}
				.displayName=${selectedColumnDisplayName}
				.description=${selectedColumnDescription}
				.rowCount=${resources.metadata?.rowCount ?? 0}
				@app-column-details-close=${this.handleColumnDetailsClose}></app-column-details>

			${this.renderDatasheetDialog()}

			<dialog
				class="confirm-dialog change-dataset-modal"
				aria-labelledby="change-dataset-title"
				closedby=${this.changeDatasetBusy || this.changeDatasetPending
					? 'none'
					: 'closerequest'}
				@cancel=${this.handleChangeDatasetDialogNativeClose}
				@close=${this.handleChangeDatasetDialogNativeClose}>
				<div class="confirm-header">
					<h2 id="change-dataset-title">Change Dataset</h2>
				</div>
				<div class="confirm-body">
					<p>
						Are you sure you want to change the dataset? Any configured target or models
						will be discarded.
					</p>
					${this.changeDatasetError
						? html`<p role="alert">${this.changeDatasetError}</p>`
						: nothing}
				</div>
				<div class="confirm-footer">
					<button
						type="button"
						class="btn"
						?disabled=${this.changeDatasetBusy || this.changeDatasetPending}
						@click=${this.handleChangeDatasetCancel}>
						Cancel
					</button>
					<button
						type="button"
						class="btn btn-primary"
						?disabled=${this.changeDatasetBusy}
						@click=${this.handleChangeDatasetConfirm}>
						${this.changeDatasetPending
							? this.changeMessagesController.value.retry
							: this.changeDatasetBusy
								? this.changeMessagesController.value.changing
								: this.changeMessagesController.value.change}
					</button>
				</div>
			</dialog>
		`;
	}

	override render(): TemplateResult {
		const appState = this.appStateController.value;
		const isPreview = appState.dataset !== null && appState.data.mode === 'preview';

		if (!isPreview) {
			return this.renderSelectionMode();
		}

		return this.renderPreviewMode();
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'app-data-view': AppDataView;
	}
}
