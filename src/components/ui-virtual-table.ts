import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { buttonStyles } from '../styles/button.styles';

/** Column definition for the virtual table. */
export interface VirtualTableColumn {
	key: string;
	label: string;
}

/** Row window slice supplied by the consumer. */
export interface VirtualTableWindow {
	startIndex: number;
	rows: readonly (readonly string[])[];
}

/** Row range requested from the consumer. */
export interface VirtualTableRange {
	startIndex: number;
	limit: number;
}

/** Viewport scroll position emitted by the table. */
export interface VirtualTablePosition {
	rowIndex: number;
	offset: number;
	inlineOffset: number;
	top: number;
}

const MAX_PREVIEW_ROWS = 10_000_000;
const SEGMENT_SIZE = 10_000;
const DEFAULT_ROW_HEIGHT = 40; // 2.5rem at base 16px
const OVERSCAN = 5;

/**
 * Presentational virtualised data table with bounded row geometry.
 * Follows specification/plans/virtual-table-component.md.
 */
@customElement('ui-virtual-table')
export class UiVirtualTable extends LitElement {
	static override readonly styles = [
		buttonStyles,
		css`
			:host {
				display: block;
				box-sizing: border-box;
				width: 100%;
			}

			.table-viewport {
				position: relative;
				box-sizing: border-box;
				outline: none;
				border: 1px solid var(--stone-300);
				border-radius: 0.5rem;
				background-color: var(--surface);
				max-block-size: 25rem;
				overflow: auto;
			}

			.table-viewport:focus-visible {
				outline: 3px solid;
				outline-color: var(--blue-700);
				outline-offset: 1px;
			}

			.table-container {
				display: table;
				border-collapse: collapse;
				min-inline-size: 100%;
			}

			.table-header {
				display: table-header-group;
				position: sticky;
				z-index: 2;
				inset-block-start: 0;
				border-block-end: 2px solid var(--stone-300);
				background-color: var(--stone-150);
			}

			.table-header-row {
				display: table-row;
			}

			.table-header-cell {
				display: table-cell;
				box-sizing: border-box;
				border-inline-end: 1px solid var(--stone-200);
				padding: 0.5rem 1rem;
				min-inline-size: 12rem;
				color: var(--stone-800);
				font-weight: 600;
				text-align: start;
			}

			.table-header-cell:last-child {
				border-inline-end: none;
			}

			.header-btn {
				display: flex;
				justify-content: space-between;
				align-items: center;
				cursor: pointer;
				border: none;
				background: none;
				padding: 0;
				inline-size: 100%;
				color: inherit;
				font: inherit;
				text-align: start;
			}

			.header-btn:focus-visible {
				outline: 2px solid;
				outline-color: var(--blue-700);
				outline-offset: 2px;
				border-radius: 0.25rem;
			}

			.table-body {
				display: table-row-group;
				position: relative;
			}

			.table-row {
				display: table-row;
				box-sizing: border-box;
				border-block-end: 1px solid var(--stone-200);
				block-size: 2.5rem;
				height: 2.5rem;
			}

			.table-row:nth-child(even) {
				background-color: var(--stone-50);
			}

			.table-cell {
				display: table-cell;
				vertical-align: middle;
				box-sizing: border-box;
				border-inline-end: 1px solid var(--stone-200);
				padding: 0.5rem 1rem;
				min-inline-size: 12rem;
				overflow: hidden;
				color: var(--stone-800);
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			.table-cell:last-child {
				border-inline-end: none;
			}

			.rail-spacer-top,
			.rail-spacer-bottom {
				display: block;
				width: 100%;
			}
		`
	];

	/** Columns configuration. */
	@property({ attribute: false })
	accessor columns: readonly VirtualTableColumn[] = [];

	/** Active row window provided by the consumer. */
	@property({ attribute: false })
	accessor window: VirtualTableWindow = { startIndex: 0, rows: [] };

	/** Whether a row fetch is currently in flight. */
	@property({ attribute: false })
	accessor loading = false;

	/** Total row count of the dataset. */
	@property({ type: Number, attribute: 'total-rows' })
	accessor totalRows = 0;

	/** Accessible label describing the table contents. */
	@property({ type: String, attribute: 'label' })
	accessor label = '';

	private measuredRowHeight = DEFAULT_ROW_HEIGHT;
	private viewportHeight = 400;
	@state() private accessor currentSegment = 0;

	private resizeObserver: ResizeObserver | null = null;
	private rafId: number | null = null;
	private lastRequestedRange: VirtualTableRange | null = null;

	private get viewportEl(): HTMLElement | null {
		return this.renderRoot?.querySelector('.table-viewport') ?? null;
	}

	override connectedCallback(): void {
		super.connectedCallback();
		this.setupObserver();
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		this.teardownObserver();
		if (this.rafId !== null) {
			cancelAnimationFrame(this.rafId);
			this.rafId = null;
		}
	}

	override firstUpdated(): void {
		this.measureGeometry();
		this.emitRangeChange();
	}

	override updated(changedProperties: PropertyValues): void {
		super.updated(changedProperties);
		if (changedProperties.has('totalRows')) {
			this.lastRequestedRange = null;
			this.emitRangeChange();
		}
	}

	private setupObserver(): void {
		if (typeof ResizeObserver === 'undefined') return;
		this.resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const height = Math.round(entry.contentRect.height);
				if (height > 0 && Math.abs(height - this.viewportHeight) > 2) {
					this.viewportHeight = height;
					this.emitRangeChange();
				}
			}
		});
		if (this.viewportEl) {
			this.resizeObserver.observe(this.viewportEl);
		}
	}

	private teardownObserver(): void {
		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}
	}

	private measureGeometry(): void {
		const vp = this.viewportEl;
		if (!vp) return;
		const height = vp.clientHeight;
		if (height > 0) {
			this.viewportHeight = height;
		}
		const sampleRow = this.renderRoot?.querySelector('.table-row') as HTMLElement | null;
		if (sampleRow && sampleRow.offsetHeight > 0) {
			this.measuredRowHeight = sampleRow.offsetHeight;
		}
	}

	private handleHeaderClick(columnKey: string): void {
		this.dispatchEvent(
			new CustomEvent<{ column: string }>('ui-virtual-table-column-select', {
				detail: { column: columnKey },
				bubbles: false,
				composed: false
			})
		);
	}

	private handleScroll(): void {
		if (this.rafId !== null) return;
		this.rafId = requestAnimationFrame(() => {
			this.rafId = null;
			this.onScrollTick();
		});
	}

	private onScrollTick(): void {
		const vp = this.viewportEl;
		if (!vp) return;

		const r = this.measuredRowHeight;
		const scrollTop = vp.scrollTop;
		const inlineOffset = Math.abs(vp.scrollLeft);

		const segmentStart = this.currentSegment * SEGMENT_SIZE;
		const localRowIndex = Math.floor(scrollTop / r);
		const absoluteRowIndex = segmentStart + localRowIndex;
		const offset = scrollTop % r;
		const top = absoluteRowIndex * r + offset;

		this.dispatchEvent(
			new CustomEvent<VirtualTablePosition>('ui-virtual-table-position-change', {
				detail: {
					rowIndex: absoluteRowIndex,
					offset,
					inlineOffset,
					top
				},
				bubbles: false,
				composed: false
			})
		);

		this.emitRangeChange();
	}

	private emitRangeChange(): void {
		const effectiveRows = Math.min(this.totalRows, MAX_PREVIEW_ROWS);
		if (effectiveRows === 0) return;

		const vp = this.viewportEl;
		const r = this.measuredRowHeight;
		const h = this.viewportHeight;

		const segmentStart = this.currentSegment * SEGMENT_SIZE;
		const segmentEnd = Math.min(segmentStart + SEGMENT_SIZE, effectiveRows);

		const localScrollTop = vp ? vp.scrollTop : 0;
		const first = segmentStart + Math.floor(localScrollTop / r);

		const startIndex = Math.max(segmentStart, first - OVERSCAN);
		const visibleRows = Math.ceil(h / r);
		const endIndex = Math.min(segmentEnd, first + visibleRows + OVERSCAN + 1);
		const limit = Math.max(1, endIndex - startIndex);

		if (
			this.lastRequestedRange &&
			this.lastRequestedRange.startIndex === startIndex &&
			this.lastRequestedRange.limit === limit
		) {
			return;
		}

		this.lastRequestedRange = { startIndex, limit };
		this.dispatchEvent(
			new CustomEvent<VirtualTableRange>('ui-virtual-table-range-change', {
				detail: { startIndex, limit },
				bubbles: false,
				composed: false
			})
		);
	}

	/**
	 * Programmatically scrolls the table to an absolute zero-based row index.
	 */
	async scrollToRow(index: number, offset = 0, inlineOffset = 0): Promise<void> {
		const effectiveRows = Math.min(this.totalRows, MAX_PREVIEW_ROWS);
		const clampedIndex = Math.max(0, Math.min(index, effectiveRows - 1));
		const targetSegment = Math.floor(clampedIndex / SEGMENT_SIZE);

		if (targetSegment !== this.currentSegment) {
			this.currentSegment = targetSegment;
			this.requestUpdate();
			await this.updateComplete;
		}

		const vp = this.viewportEl;
		if (vp) {
			const localRow = clampedIndex % SEGMENT_SIZE;
			vp.scrollTop = localRow * this.measuredRowHeight + offset;
			vp.scrollLeft = inlineOffset;
		}

		this.onScrollTick();
		await this.updateComplete;
	}

	/**
	 * Restores logical scroll position from saved coordinates.
	 */
	async restoreScroll(top: number, left: number): Promise<void> {
		const r = this.measuredRowHeight;
		const rowIndex = Math.floor(top / r);
		const offset = top % r;
		await this.scrollToRow(rowIndex, offset, left);
	}

	/**
	 * Programmatically focuses the column header button for the given column key.
	 */
	focusColumn(column: string): void {
		const btn = this.renderRoot?.querySelector<HTMLButtonElement>(
			`button[data-col-key="${column}"]`
		);
		btn?.focus();
	}

	override render(): TemplateResult {
		const effectiveRows = Math.min(this.totalRows, MAX_PREVIEW_ROWS);
		const segmentStart = this.currentSegment * SEGMENT_SIZE;
		const segmentEnd = Math.min(segmentStart + SEGMENT_SIZE, effectiveRows);
		const segmentRows = Math.max(0, segmentEnd - segmentStart);

		const r = this.measuredRowHeight;
		const windowStart = this.window.startIndex;
		const windowRows = this.window.rows;

		// Calculate rail spacing above and below the rendered window within this segment
		const localWindowStart = Math.max(0, windowStart - segmentStart);
		const topSpacerHeight = localWindowStart * r;
		const renderedCount = windowRows.length;
		const bottomSpacerHeight = Math.max(
			0,
			(segmentRows - localWindowStart - renderedCount) * r
		);

		return html`
			<div
				class="table-viewport"
				tabindex="0"
				aria-label=${this.label || 'Dataset preview'}
				@scroll=${this.handleScroll}>
				<div
					class="table-container"
					role="table"
					aria-label=${this.label || 'Dataset preview'}
					aria-rowcount=${effectiveRows + 1}
					aria-colcount=${this.columns.length}>
					<div class="table-header" role="rowgroup">
						<div class="table-header-row" role="row" aria-rowindex="1">
							${this.columns.map(
								(col) => html`
									<div class="table-header-cell" role="columnheader">
										<button
											type="button"
											class="header-btn"
											data-col-key=${col.key}
											@click=${() => this.handleHeaderClick(col.key)}>
											<span>${col.label}</span>
										</button>
									</div>
								`
							)}
						</div>
					</div>

					<div class="table-body" role="rowgroup">
						${topSpacerHeight > 0
							? html`<div
									class="rail-spacer-top"
									style="block-size: ${topSpacerHeight}px; height: ${topSpacerHeight}px;"></div>`
							: nothing}
						${windowRows.map((rowValues, i) => {
							const absoluteRowIndex = windowStart + i;
							return html`
								<div
									class="table-row"
									role="row"
									aria-rowindex=${absoluteRowIndex + 2}>
									${rowValues.map(
										(cellVal) => html`
											<div class="table-cell" role="cell" title=${cellVal}>
												${cellVal}
											</div>
										`
									)}
								</div>
							`;
						})}
						${bottomSpacerHeight > 0
							? html`<div
									class="rail-spacer-bottom"
									style="block-size: ${bottomSpacerHeight}px; height: ${bottomSpacerHeight}px;"></div>`
							: nothing}
					</div>
				</div>
			</div>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'ui-virtual-table': UiVirtualTable;
	}
}
