import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { buttonStyles } from '../../styles/button.styles';
import { headingFocusStyles } from '../../styles/heading-focus.styles';
import '../../components/ui-virtual-table';
import type {
	UiVirtualTable,
	VirtualTableColumn,
	VirtualTablePosition,
	VirtualTableRange,
	VirtualTableWindow
} from '../../components/ui-virtual-table';
import type { DatasetMetadata } from '../../types/dataset';
import { $format } from '../../i18n';

/** Labels for dataset preview text. */
export interface PreviewLabels {
	table: string;
	previousSegment: string;
	nextSegment: string;
	goToRow: string;
	go: string;
	empty: string;
	loading: string;
	retry: string;
	changeDataset: string;
	capNotice: string;
	rowRange: string;
}

const SEGMENT_SIZE = 10_000;
const MAX_PREVIEW_ROWS = 10_000_000;

/**
 * Presentational view for dataset table preview, controls and segment navigation.
 * Follows specification/plans/step-1-load-data-and-preview.md T4.
 */
@customElement('app-dataset-preview')
export class AppDatasetPreview extends LitElement {
	static override readonly styles = [
		headingFocusStyles,
		buttonStyles,
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
				margin-block-end: 1.5rem;
				inset-block-start: 0;
				background-color: var(--surface);
			}

			.page-header h1 {
				grid-area: title;
				margin: 0;
				color: var(--stone-900);
				font-weight: 500;
				font-size: 1.5rem;
			}

			.page-header p {
				grid-area: description;
				margin: 0;
				color: var(--stone-700);
				line-height: 1.75rem;
			}

			.page-header .btn {
				grid-area: action;
			}

			.controls-bar {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 1rem;
				margin-block-end: 1rem;
				border: 1px solid var(--stone-250);
				border-radius: 0.5rem;
				background-color: var(--stone-100);
				padding: 0.75rem 1rem;
				font-size: 0.875rem;
			}

			.segment-controls {
				display: flex;
				align-items: center;
				gap: 0.5rem;
			}

			.go-to-row {
				display: flex;
				align-items: center;
				gap: 0.5rem;
			}

			.go-to-row input[type='number'] {
				border: 1px solid var(--stone-300);
				border-radius: 0.25rem;
				padding: 0.25rem 0.5rem;
				inline-size: 5rem;
				font: inherit;
			}

			.go-to-row input[type='number']:focus-visible {
				outline: 2px solid;
				outline-color: var(--blue-700);
				outline-offset: 1px;
			}

			.segment-info {
				color: var(--stone-700);
				font-size: 0.8125rem;
			}

			.cap-notice {
				color: var(--stone-600);
				font-style: italic;
				font-size: 0.8125rem;
			}

			.status-box {
				margin-block: 1rem;
				border: 1px dashed var(--stone-300);
				border-radius: 0.5rem;
				background-color: var(--stone-50);
				padding: 1.5rem;
				text-align: center;
			}

			.status-box p {
				margin: 0 0 0.5rem 0;
			}

			p[role='alert'] {
				color: var(--red-700);
			}

			p[role='status'] {
				color: var(--stone-700);
			}
		`
	];

	/** Dataset metadata. */
	@property({ attribute: false })
	accessor metadata: DatasetMetadata | null = null;

	/** Active row window. */
	@property({ attribute: false })
	accessor window: VirtualTableWindow = { startIndex: 0, rows: [] };

	/** Key of the currently selected column. */
	@property({ attribute: false })
	accessor selectedColumn: string | null = null;

	/** Whether a row fetch is in progress. */
	@property({ type: Boolean })
	accessor loading = false;

	/** Error string when preview fails to load. */
	@property({ attribute: false })
	accessor error: string | null = null;

	/** Localised text labels. */
	@property({ attribute: false })
	accessor labels: PreviewLabels = {
		table: '',
		previousSegment: '',
		nextSegment: '',
		goToRow: '',
		go: '',
		empty: '',
		loading: '',
		retry: '',
		changeDataset: '',
		capNotice: '',
		rowRange: ''
	};

	@state() private accessor currentSegment = 0;
	@state() private accessor targetRowInput = 1;

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
	 * Restores logical scroll position in the underlying virtual table.
	 */
	async restorePosition(position: { top: number; left: number }): Promise<void> {
		if (this.tableEl) {
			await this.tableEl.restoreScroll(position.top, position.left);
		}
	}

	/**
	 * Directs focus to a column header button in the virtual table.
	 */
	focusColumn(column: string): void {
		this.tableEl?.focusColumn(column);
	}

	private handleChangeDataset(): void {
		this.dispatchEvent(
			new CustomEvent('app-preview-change-dataset', {
				bubbles: false,
				composed: false
			})
		);
	}

	private handleRetry(): void {
		this.dispatchEvent(
			new CustomEvent('app-preview-retry', {
				bubbles: false,
				composed: false
			})
		);
	}

	private handleRangeChange(e: CustomEvent<VirtualTableRange>): void {
		this.dispatchEvent(
			new CustomEvent<VirtualTableRange>('app-preview-range-change', {
				detail: e.detail,
				bubbles: false,
				composed: false
			})
		);
	}

	private handlePositionChange(e: CustomEvent<VirtualTablePosition>): void {
		this.currentSegment = Math.floor(e.detail.rowIndex / SEGMENT_SIZE);
		this.dispatchEvent(
			new CustomEvent<VirtualTablePosition>('app-preview-position-change', {
				detail: e.detail,
				bubbles: false,
				composed: false
			})
		);
	}

	private handleColumnSelect(e: CustomEvent<{ column: string }>): void {
		this.dispatchEvent(
			new CustomEvent<{ column: string }>('app-preview-column-select', {
				detail: e.detail,
				bubbles: false,
				composed: false
			})
		);
	}

	private handlePreviousSegment(): void {
		if (this.currentSegment > 0) {
			const targetRow = (this.currentSegment - 1) * SEGMENT_SIZE;
			void this.tableEl?.scrollToRow(targetRow);
		}
	}

	private handleNextSegment(): void {
		const totalRows = this.metadata?.rowCount ?? 0;
		const effectiveRows = Math.min(totalRows, MAX_PREVIEW_ROWS);
		if ((this.currentSegment + 1) * SEGMENT_SIZE < effectiveRows) {
			const targetRow = (this.currentSegment + 1) * SEGMENT_SIZE;
			void this.tableEl?.scrollToRow(targetRow);
		}
	}

	private handleGoToRow(e: Event): void {
		e.preventDefault();
		const totalRows = this.metadata?.rowCount ?? 0;
		const effectiveRows = Math.min(totalRows, MAX_PREVIEW_ROWS);
		const zeroBased = Math.max(0, Math.min(this.targetRowInput - 1, effectiveRows - 1));
		void this.tableEl?.scrollToRow(zeroBased);
	}

	private handleRowInputChange(e: Event): void {
		const input = e.target as HTMLInputElement;
		const val = parseInt(input.value, 10);
		if (!Number.isNaN(val)) {
			this.targetRowInput = val;
		}
	}

	private cachedMetadataColumns: unknown = null;
	private cachedTableColumns: VirtualTableColumn[] = [];

	private getTableColumns(): VirtualTableColumn[] {
		const cols = this.metadata?.columns;
		if (cols && cols === this.cachedMetadataColumns) {
			return this.cachedTableColumns;
		}
		this.cachedMetadataColumns = cols ?? null;
		if (cols && cols.length > 0) {
			this.cachedTableColumns = cols.map((col) => ({ key: col.name, label: col.name }));
		} else {
			this.cachedTableColumns = [];
		}
		return this.cachedTableColumns;
	}

	override render(): TemplateResult {
		const totalRows = this.metadata?.rowCount ?? 0;
		const effectiveRows = Math.min(totalRows, MAX_PREVIEW_ROWS);

		const name = this.metadata?.name ?? 'Dataset';
		const columnsCount = this.metadata?.columns?.length ?? this.window.rows[0]?.length ?? 0;

		const formatCount = (n: number) => $format.get().number(n, { useGrouping: true });

		const segmentStart = this.currentSegment * SEGMENT_SIZE;
		const segmentEnd = Math.min(segmentStart + SEGMENT_SIZE, effectiveRows);

		const hasPrevious = this.currentSegment > 0;
		const hasNext = segmentEnd < effectiveRows;

		const tableColumns = this.getTableColumns();

		return html`
			<header class="page-header">
				<h1 tabindex="-1">Preview Dataset: ${name}</h1>
				<p>
					${formatCount(totalRows)} rows &nbsp;|&nbsp; ${formatCount(columnsCount)}
					columns
				</p>
				<button type="button" class="btn" @click=${this.handleChangeDataset}>
					${this.labels.changeDataset || 'Change Dataset'}
				</button>
			</header>

			${this.error
				? html`
						<div class="status-box" role="alert">
							<p role="alert">${this.error}</p>
							<button type="button" class="btn" @click=${this.handleRetry}>
								${this.labels.retry || 'Retry'}
							</button>
						</div>
					`
				: nothing}
			${this.loading
				? html`
						<div class="status-box">
							<p role="status">${this.labels.loading || 'Loading rows…'}</p>
						</div>
					`
				: nothing}
			${totalRows === 0 && !this.loading && !this.error
				? html`
						<div class="status-box">
							<p>${this.labels.empty || 'No rows to preview.'}</p>
						</div>
					`
				: nothing}

			<section class="controls-bar" aria-label="Table controls">
				<div class="segment-controls">
					<button
						type="button"
						class="btn"
						?disabled=${!hasPrevious}
						@click=${this.handlePreviousSegment}>
						${this.labels.previousSegment || 'Previous segment'}
					</button>
					<button
						type="button"
						class="btn"
						?disabled=${!hasNext}
						@click=${this.handleNextSegment}>
						${this.labels.nextSegment || 'Next segment'}
					</button>
				</div>

				<form class="go-to-row" @submit=${this.handleGoToRow}>
					<label for="row-number">${this.labels.goToRow || 'Go to row'}</label>
					<input
						type="number"
						id="row-number"
						name="row-number"
						min="1"
						max=${effectiveRows}
						.value=${String(this.targetRowInput)}
						@change=${this.handleRowInputChange} />
					<button type="submit" class="btn">${this.labels.go || 'Go'}</button>
				</form>

				<span class="segment-info">
					Rows ${formatCount(segmentStart + 1)}–${formatCount(segmentEnd)} of
					${formatCount(totalRows)}
				</span>

				${totalRows > MAX_PREVIEW_ROWS
					? html`
							<span class="cap-notice">
								${this.labels.capNotice ||
								'Up to 10,000,000 rows can be previewed.'}
							</span>
						`
					: nothing}
			</section>

			<ui-virtual-table
				.columns=${tableColumns}
				.window=${this.window}
				?loading=${this.loading}
				total-rows=${totalRows}
				label=${this.labels.table || `${name} preview`}
				@ui-virtual-table-range-change=${this.handleRangeChange}
				@ui-virtual-table-position-change=${this.handlePositionChange}
				@ui-virtual-table-column-select=${this.handleColumnSelect}></ui-virtual-table>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'app-dataset-preview': AppDatasetPreview;
	}
}
