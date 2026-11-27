import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { buttonStyles } from '../../styles/button.styles';
import { headingFocusStyles } from '../../styles/heading-focus.styles';
import { notificationStyles } from '../../styles/notification.styles';
import '../../components/ui-virtual-table';
import type {
	UiVirtualTable,
	VirtualTableColumn,
	VirtualTableRange,
	VirtualTableRowLimit,
	VirtualTableWindow
} from '../../components/ui-virtual-table';
import type { DatasetMetadata } from '../../types/dataset';
import { StickyHeaderController } from '../shell/sticky-header-controller';

/** Labels for dataset preview text; the connected view owns the strings and the locale. */
export interface PreviewLabels {
	/** Heading text for a dataset name, for example "Iris Preview". */
	heading(name: string): string;
	datasheet: string;
	changeDataset: string;
	/** Header description while a dataset is loading. */
	loadingDescription: string;
	/** Header description once rows and columns are known. */
	rowsColumns(rows: number, columns: number): string;
	/** Notice shown when the table renders fewer rows than the dataset has. */
	rowLimitNotice(limit: number, total: number): string;
	empty: string;
	retry: string;
	/** Alert text shown when metadata or rows could not be loaded. */
	errorMessage: string;
	/** Visually hidden suffix of unsupported column headers. */
	unsupported: string;
	/** Accessible name of the loading progress bar. */
	progressLabel: string;
}

/** Presentation values for the loading progress bar shown in place of the table. */
export interface PreviewLoadView {
	/** Visible name of the current phase. */
	phaseLabel: string;
	/** Visible position in the sequence of phases, for example "Step 2 of 4". */
	step: string;
	/** Current value, or `null` for an indeterminate phase (the `value` attribute is omitted). */
	value: number | null;
	/** Maximum for a determinate phase. */
	max: number;
}

const DEFAULT_LABELS: PreviewLabels = {
	heading: (name) => name,
	datasheet: 'Datasheet',
	changeDataset: 'Change Dataset',
	loadingDescription: '',
	rowsColumns: (rows, columns) => `${rows} rows | ${columns} columns`,
	rowLimitNotice: (limit, total) => `Previewing the first ${limit} of ${total} rows.`,
	empty: 'No rows to preview.',
	retry: 'Retry',
	errorMessage: 'The preview could not be loaded.',
	unsupported: ', not used for training',
	progressLabel: 'Loading progress'
};

/**
 * Presentational view for the dataset preview: page header, notices and the document-scrolled
 * virtual table.
 *
 * Follows the dataset preview design in specification/preview-dataset.md.
 *
 * @fires app-preview-retry - The user asked to reload metadata and rows.
 * @fires app-preview-change-dataset - The user asked to change the dataset.
 * @fires app-dataset-preview-datasheet - The user asked for the datasheet (`{ invoker }`).
 * @fires app-preview-range-change - The table needs another row range.
 * @fires app-preview-column-select - A column header was activated.
 */
@customElement('app-dataset-preview')
export class AppDatasetPreview extends LitElement {
	static override readonly styles = [
		headingFocusStyles,
		buttonStyles,
		notificationStyles,
		css`
			:host {
				display: block;
				box-sizing: border-box;
				inline-size: 100%;
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
				inset-inline-start: var(--sidebar-width);
				background-color: var(--stone-50);
				padding: 1.5rem 2rem;
				inline-size: 100%;
				max-inline-size: calc(100vw - var(--sidebar-width));

				@media (width < 50rem) {
					inset-inline-start: 0;
					max-inline-size: 100vw;
				}

				@media (max-height: 30rem) {
					position: static;
				}
			}

			.page-header h1 {
				grid-area: title;
				margin: 0;
				min-inline-size: 0;
				color: var(--stone-900);
				font-weight: 500;
				font-size: 1.5rem;
				overflow-wrap: anywhere;
			}

			.page-header p {
				grid-area: description;
				margin: 0;
				min-inline-size: 0;
				color: var(--stone-700);
				line-height: 1.75rem;
				overflow-wrap: anywhere;
			}

			.page-actions {
				display: flex;
				grid-area: action;
				flex-wrap: wrap;
				align-items: center;
				justify-self: end;
				gap: 0.75rem;
			}

			.page-body {
				margin: 0 2rem 2rem;
			}

			.page-body:has(+ ui-virtual-table) {
				margin-block-end: 1rem;
			}

			.page-body > * + * {
				margin-block-start: 0.75rem;
			}

			.notification {
				margin-block-end: 0;
			}

			.notification-alert {
				justify-content: space-between;
				gap: 1rem;
			}

			.page-body p {
				margin: 0;
			}

			.load-phase {
				color: var(--stone-900);
				font-weight: 500;
			}

			.load-step {
				color: var(--stone-700);
				font-size: 0.875rem;
			}

			.load-progress {
				appearance: none;
				box-shadow: 0 0 0 3px var(--blue-200);
				border: 1.5px solid var(--blue-700);
				border-radius: 0.5rem;
				background: var(--stone-100);
				inline-size: 100%;
				max-inline-size: 40rem;
				block-size: 1.25rem;
				overflow: clip;
			}

			.load-progress::-webkit-progress-bar {
				background: transparent;
			}

			.load-progress::-webkit-progress-value {
				background: var(--blue-600);
			}

			.load-progress::-moz-progress-bar {
				background: var(--blue-600);
			}

			.load-progress:indeterminate {
				animation: load-stripes 0.8s linear infinite;
				background: repeating-linear-gradient(
					-45deg,
					var(--blue-600) 0,
					var(--blue-600) 0.75rem,
					var(--blue-400) 0.75rem,
					var(--blue-400) 1.5rem
				);
				background-size: 2.12rem 100%;
			}

			@keyframes load-stripes {
				from {
					background-position: 0 0;
				}

				to {
					background-position: 2.12rem 0;
				}
			}

			/* Slowed, not removed: the bar must still show that work is going on. */
			@media (prefers-reduced-motion: reduce) {
				.load-progress:indeterminate {
					animation-duration: 3.2s;
				}
			}

			@media (forced-colors: active) {
				.load-progress {
					appearance: auto;
					box-shadow: none;
					border-color: CanvasText;
				}
			}

			.visually-hidden {
				position: absolute;
				clip-path: inset(50%);
				inline-size: 1px;
				block-size: 1px;
				overflow: hidden;
				white-space: nowrap;
			}
		`
	];

	/** Dataset metadata; absent while the preview is being prepared. */
	@property({ attribute: false })
	accessor metadata: DatasetMetadata | null = null;

	/** Dataset name for the heading, available before metadata. */
	@property({ attribute: false })
	accessor datasetName = '';

	/** Row count shown in the header before metadata is available. */
	@property({ attribute: false })
	accessor rowCount = 0;

	/** Column count shown in the header before metadata is available. */
	@property({ attribute: false })
	accessor columnCount = 0;

	/** Table columns, built by the consumer from the metadata. */
	@property({ attribute: false })
	accessor columns: readonly VirtualTableColumn[] = [];

	/** Active row window. */
	@property({ attribute: false })
	accessor window: VirtualTableWindow = { startIndex: 0, rows: [] };

	/** Whether a row fetch is in progress. */
	@property({ type: Boolean })
	accessor loading = false;

	/** Set when metadata or rows failed to load. */
	@property({ attribute: false })
	accessor error: string | null = null;

	/** Whether a datasheet exists for the active dataset (samples only). */
	@property({ type: Boolean })
	accessor datasheetAvailable = false;

	/** Text for the persistent status region (announcements only, never focus). */
	@property({ attribute: false })
	accessor statusMessage = '';

	/** When set, the loading presentation replaces notices and the table. */
	@property({ attribute: false })
	accessor loadView: PreviewLoadView | null = null;

	/** Localised text labels. */
	@property({ attribute: false })
	accessor labels: PreviewLabels = DEFAULT_LABELS;

	@state() private accessor rowLimit: number | null = null;

	private stickyOffset = 0;
	private readonly stickyHeader = new StickyHeaderController(this, {
		onBlockSize: (px) => {
			this.stickyOffset = px;
			this.applyStickyOffset();
		}
	});

	private applyStickyOffset(): void {
		this.tableEl?.style.setProperty(
			'--ui-virtual-table-sticky-offset',
			`${this.stickyOffset}px`
		);
	}

	protected override updated(): void {
		// The table may be created after the header was first measured.
		this.applyStickyOffset();
	}

	private get tableEl(): UiVirtualTable | null {
		return this.renderRoot?.querySelector('ui-virtual-table') ?? null;
	}

	/**
	 * Focuses this preview's heading after rendering, unless cancelled or disconnected.
	 *
	 * @param signal - Cancels a superseded navigation's focus request.
	 */
	async focusHeading(signal: AbortSignal): Promise<void> {
		if (signal.aborted || !this.isConnected) return;
		await this.updateComplete;
		if (signal.aborted || !this.isConnected) return;
		this.renderRoot.querySelector<HTMLElement>('.page-header > h1')?.focus({
			preventScroll: true
		});
	}

	/**
	 * Resolves once this view and its table have final geometry, so a restored document scroll
	 * lands on a full-height page (D17).
	 */
	async whenSettled(): Promise<void> {
		await this.updateComplete;
		await this.tableEl?.updateComplete;
		await this.updateComplete;
	}

	/**
	 * Directs focus to a column header button in the virtual table.
	 *
	 * @param column - Column key.
	 */
	focusColumn(column: string): void {
		this.tableEl?.focusColumn(column);
	}

	private emit<T>(name: string, detail?: T): void {
		this.dispatchEvent(new CustomEvent<T>(name, { detail, bubbles: false, composed: false }));
	}

	private handleDatasheet(event: Event): void {
		this.emit('app-dataset-preview-datasheet', {
			invoker: event.currentTarget as HTMLButtonElement
		});
	}

	private handleRangeChange(event: CustomEvent<VirtualTableRange>): void {
		this.emit('app-preview-range-change', event.detail);
	}

	private handleRowLimitChange(event: CustomEvent<VirtualTableRowLimit>): void {
		this.rowLimit = event.detail.rowLimit;
	}

	private handleColumnSelect(event: CustomEvent<{ column: string }>): void {
		this.emit('app-preview-column-select', event.detail);
	}

	private renderNotices(totalRows: number): TemplateResult | typeof nothing {
		const showLimit = this.rowLimit !== null && totalRows > this.rowLimit;
		const showEmpty = !this.error && this.metadata !== null && totalRows === 0;
		if (!this.error && !showLimit && !showEmpty) return nothing;
		return html`
			<div class="page-body">
				${this.error
					? html`<div class="notification notification-alert" role="alert">
							<span class="notification-text">${this.labels.errorMessage}</span>
							<button
								type="button"
								class="btn"
								@click=${() => this.emit('app-preview-retry')}>
								${this.labels.retry}
							</button>
						</div>`
					: nothing}
				${showLimit
					? html`<p class="notification">
							${this.labels.rowLimitNotice(this.rowLimit!, totalRows)}
						</p>`
					: nothing}
				${showEmpty ? html`<p>${this.labels.empty}</p>` : nothing}
			</div>
		`;
	}

	private renderLoading(view: PreviewLoadView): TemplateResult {
		return html`
			<div class="page-body" role="group" aria-label=${this.labels.progressLabel}>
				<p class="load-phase" id="load-phase">${view.phaseLabel}</p>
				<p class="load-step">${view.step}</p>
				<progress
					class="load-progress"
					aria-labelledby="load-phase"
					max=${view.max}
					value=${ifDefined(view.value ?? undefined)}></progress>
			</div>
		`;
	}

	override render(): TemplateResult {
		const metadata = this.metadata;
		const loading = this.loadView;
		const totalRows = metadata?.rowCount ?? 0;
		const name = metadata?.name ?? this.datasetName;
		const rows = metadata?.rowCount ?? this.rowCount;
		const columns = metadata?.columns.length ?? this.columnCount;
		const heading = this.labels.heading(name);

		return html`
			<header class="page-header">
				<h1 tabindex="-1">${heading}</h1>
				<p>
					${loading
						? this.labels.loadingDescription
						: this.labels.rowsColumns(rows, columns)}
				</p>
				<div class="page-actions">
					${this.datasheetAvailable
						? html`<button type="button" class="btn" @click=${this.handleDatasheet}>
								${this.labels.datasheet}
							</button>`
						: nothing}
					${loading
						? nothing
						: html`<button
								type="button"
								class="btn btn-red"
								@click=${() => this.emit('app-preview-change-dataset')}>
								${this.labels.changeDataset}
							</button>`}
				</div>
			</header>
			<p class="visually-hidden" role="status">${this.statusMessage}</p>
			${loading ? this.renderLoading(loading) : nothing}
			${loading ? nothing : this.renderNotices(totalRows)}
			${!loading && metadata !== null && totalRows > 0
				? html`<ui-virtual-table
						.columns=${this.columns}
						.window=${this.window}
						.labels=${{ unsupported: this.labels.unsupported }}
						?loading=${this.loading}
						total-rows=${totalRows}
						label=${heading}
						@ui-virtual-table-range-change=${this.handleRangeChange}
						@ui-virtual-table-row-limit-change=${this.handleRowLimitChange}
						@ui-virtual-table-column-select=${this
							.handleColumnSelect}></ui-virtual-table>`
				: nothing}
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'app-dataset-preview': AppDatasetPreview;
	}
}
