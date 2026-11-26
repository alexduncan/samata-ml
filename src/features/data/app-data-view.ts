import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
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
import { isTemporalColumnType } from '../../types/state';
import { formatTemporalValue, type TemporalColumnStats } from './temporal-format';
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
import type { AppDatasetPreview } from './app-dataset-preview';
import type {
	VirtualTablePosition,
	VirtualTableRange,
	VirtualTableWindow
} from '../../components/ui-virtual-table';
import type { ColumnStats, RawRecord } from '../../types/dataset';
import { $format, i18n } from '../../i18n';
import { INGESTION_ERROR_MESSAGES } from './ingestion/errors';
import { $scrollState } from '../../stores/scroll.store';
import { recordCurrentScroll, getIsRestoringScroll } from '../../router/scroll-restorer';

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

function formatPreviewRows(
	records: readonly RawRecord[],
	columns: readonly ColumnStats[]
): readonly (readonly string[])[] {
	const format = $format.get();
	return records.map((record) =>
		record.values.map((val, idx) => {
			if (val === null || val === undefined) {
				return '—';
			}
			const col = columns[idx];
			if (col && isTemporalColumnType(col.type) && typeof val === 'number') {
				return formatTemporalValue(val, col as TemporalColumnStats);
			}
			if (typeof val === 'number') {
				return format.number(val, { useGrouping: true, maximumFractionDigits: 20 });
			}
			if (typeof val === 'boolean') {
				return val ? 'true' : 'false';
			}
			return String(val);
		})
	);
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
				margin-block-end: 1.5rem;
				inset-block-start: 0;

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
	private tableScrollRestored = false;

	private async restoreTableScroll(): Promise<void> {
		if (typeof window === 'undefined') return;
		const snapshot = $scrollState.get().snapshots['data:preview'];
		if (snapshot && snapshot.viewportWidth === window.innerWidth) {
			const tableRegion = snapshot.regions?.['data-table'];
			if (tableRegion && this.previewEl) {
				await this.previewEl.restorePosition(tableRegion);
			}
		}
	}

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
			if (!this.tableScrollRestored) {
				this.tableScrollRestored = true;
				queueMicrotask(async () => {
					await this.whenSettled();
					await this.restoreTableScroll();
				});
			}
		} else {
			this.tableScrollRestored = false;
			this.startCatalogueSelection();
		}
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		this.stopCatalogueSelection();
		this.datasheetSeq++;
		this.abortController.abort();
	}

	override updated(changedProperties: PropertyValues): void {
		super.updated(changedProperties);

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
			if (!this.tableScrollRestored) {
				this.tableScrollRestored = true;
				queueMicrotask(async () => {
					await this.whenSettled();
					await this.restoreTableScroll();
				});
			}
		} else {
			this.tableScrollRestored = false;
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

	/**
	 * Waits for active catalogue, rendering and resource operations to settle.
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
		if (this.previewEl) {
			await this.previewEl.updateComplete;
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
		this.activeDatasheetId = e.detail.datasetId;
		this.datasheetHeading = e.detail.name;
		this.datasheetOpen = true;
		this.datasheetInvoker = e.detail.invoker ?? null;
		this.loadDatasheet(e.detail.datasetId);
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

	private handlePreviewPositionChange(e: CustomEvent<VirtualTablePosition>): void {
		if (getIsRestoringScroll()) return;
		recordCurrentScroll('data:preview', {
			'data-table': {
				top: e.detail.top,
				left: e.detail.inlineOffset
			}
		});
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
													${this.noticeMessagesController.value.remote}
												</p>`
											: nothing}
									</li>
								`
							)}
						</ul>
					`
				: nothing}

			<app-datasheet-dialog
				?open=${this.datasheetOpen}
				.invoker=${this.datasheetInvoker}
				.heading=${this.datasheetHeading}
				.content=${this.datasheetContent}
				.status=${this.datasheetStatus}
				close-label="Close modal"
				@app-datasheet-dialog-close=${this.handleDatasheetClose}
				@app-datasheet-dialog-retry=${this.handleDatasheetRetry}></app-datasheet-dialog>

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
		const selectedColumnDescription =
			(selectedColumnName &&
				resources.descriptor?.columns.find((c) => c.name === selectedColumnName)
					?.description) ||
			'';

		return html`
			<app-dataset-preview
				.metadata=${resources.metadata}
				.window=${previewWindow}
				.selectedColumn=${selectedColumnName}
				?loading=${resources.status === 'loading' || previewState.status === 'loading'}
				.error=${resources.error || previewState.error}
				@app-preview-range-change=${this.handlePreviewRangeChange}
				@app-preview-position-change=${this.handlePreviewPositionChange}
				@app-preview-column-select=${this.handlePreviewColumnSelect}
				@app-preview-change-dataset=${this.handleChangeDatasetRequest}
				@app-preview-retry=${this.handlePreviewRetry}></app-dataset-preview>

			<app-column-details
				.column=${selectedColumnStats}
				.description=${selectedColumnDescription}
				.rowCount=${resources.metadata?.rowCount ?? 0}
				@app-column-details-close=${this.handleColumnDetailsClose}></app-column-details>

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
