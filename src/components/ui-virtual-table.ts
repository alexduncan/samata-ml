import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { repeat } from 'lit/directives/repeat.js';

/** Value family of a column; selects the cell alignment class. */
export type VirtualTableColumnKind = 'numeric' | 'temporal' | 'boolean' | 'categorical' | 'text';

/** Column definition for the virtual table. */
export interface VirtualTableColumn {
	/** Unique key matching data record key. */
	readonly key: string;
	/** Primary visible header text (display name, or the column name when there is none). */
	readonly label: string;
	/** Raw column name shown after `label` on the same line, separated by one space; omit when it equals `label`. */
	readonly sublabel?: string;
	/** Value family; omitted gives default start alignment and no type class. */
	readonly kind?: VirtualTableColumnKind;
	/** Marks a column the model cannot use; adds the unsupported styling, icon and hidden suffix. */
	readonly unsupported?: boolean;
	/** Character-count width hint; omitted gives a 12rem track. */
	readonly contentChars?: number;
}

/** Row window slice supplied by the consumer. */
export interface VirtualTableWindow {
	/** Zero-based starting row index of this slice. */
	readonly startIndex: number;
	/** Ordered row cell values matching column order. */
	readonly rows: readonly (readonly string[])[];
}

/** Row range requested from the consumer. */
export interface VirtualTableRange {
	/** Zero-based start index of requested row window. */
	readonly startIndex: number;
	/** Maximum number of rows requested. */
	readonly limit: number;
}

/** Maximum number of rows the table can render at the current text size. */
export interface VirtualTableRowLimit {
	/** `floor(16,000,000 / measured row height in px)`. */
	readonly rowLimit: number;
}

/** Consumer-supplied strings. */
export interface VirtualTableLabels {
	/** Visually hidden suffix appended to the name of an unsupported column header. */
	readonly unsupported: string;
}

/**
 * Document scroll position emitted by the table.
 *
 * @deprecated Transitional: removed with `scrollToRow` and `restoreScroll` once consumers read the document snapshot.
 */
export interface VirtualTablePosition {
	/** Zero-based data row index at viewport top. */
	rowIndex: number;
	/** Pixel offset within the top row. */
	offset: number;
	/** Document inline scroll offset (`scrollX`). */
	inlineOffset: number;
	/** Document block scroll offset (`scrollY`). */
	top: number;
}

/** Rail height cap in px, below Firefox's element height limit (about 17.9 million). */
const MAX_RAIL_PX = 16_000_000;
/** Row height in px at the default 16px root font size, used until a row is measured. */
const DEFAULT_ROW_HEIGHT = 32;
const DEFAULT_LABELS: VirtualTableLabels = { unsupported: ', not used for training' };

const KIND_CLASS: Record<VirtualTableColumnKind, string> = {
	numeric: 'table-cell-num',
	temporal: 'table-cell-date',
	boolean: 'table-cell-boolean',
	categorical: 'table-cell-categorical',
	text: 'table-cell-text'
};

interface RowNode {
	readonly element: HTMLElement;
	readonly cells: HTMLElement[];
	index: number;
	/** The window row currently shown (`null` for placeholder, `undefined` when never filled). */
	filled: readonly string[] | null | undefined;
	busy: boolean;
}

function columnTrack(column: VirtualTableColumn): string {
	return column.contentChars === undefined
		? '12rem'
		: `clamp(6rem, calc(${Math.max(0, Math.ceil(column.contentChars))}ch + 1rem), 20rem)`;
}

/**
 * Presentational virtualised data table scrolled by the document.
 *
 * The body is a single rail of `rows × measured row height`. A pool of absolutely positioned
 * rows is recycled with `transform: translateY()` from a `requestAnimationFrame` update that a
 * passive window scroll listener only schedules. Rows beyond the browser-safe rail height are
 * not rendered; the consumer is told the limit.
 *
 * @fires ui-virtual-table-range-change - Emits the row range that needs data.
 * @fires ui-virtual-table-column-select - Emits the selected column key.
 * @fires ui-virtual-table-row-limit-change - Emits the maximum renderable row count.
 * @fires ui-virtual-table-position-change - Transitional: emits the document scroll position.
 * The public CSS custom property `--ui-virtual-table-sticky-offset` (default `0px`) sets the
 * block-start offset of the sticky header.
 */
@customElement('ui-virtual-table')
export class UiVirtualTable extends LitElement {
	static override readonly styles = css`
		:host {
			--ui-virtual-table-sticky-offset: 0px;
			display: block;
			box-sizing: border-box;
			inline-size: 100%;
		}

		:host([hidden]) {
			display: none;
		}

		.symbols {
			position: absolute;
			inline-size: 0;
			block-size: 0;
			overflow: hidden;
		}

		/*
		 * Stays inline with zero font size: an absolutely positioned or inline-block element
		 * makes some engines insert a space before the suffix in the accessible name.
		 */
		.visually-hidden {
			font-size: 0;
			line-height: 0;
			user-select: none;
		}

		.icon {
			display: block;
			inline-size: 1.5rem;
			block-size: 1.5rem;
			color: currentColor;
		}

		.table-container {
			box-sizing: border-box;
			border: 1px solid var(--stone-300);
			background-color: var(--surface);
			inline-size: max-content;
			min-inline-size: 100%;
		}

		.table-header {
			position: sticky;
			z-index: 2;
			inset-block-start: var(--ui-virtual-table-sticky-offset);
			border-block-end: 2px solid var(--stone-300);
			background-color: var(--stone-150);
		}

		.table-header-row,
		.table-row {
			display: grid;
			grid-template-columns: var(--_columns);
		}

		.table-header-cell {
			display: flex;
			align-items: center;
			box-sizing: border-box;
			border-inline-end: 1px solid var(--stone-200);
			min-inline-size: 0;
			color: var(--stone-800);
			font-weight: 600;
			font-size: 0.75rem;
			line-height: 2rem;
			text-align: start;
		}

		.header-btn {
			display: flex;
			flex: 1 1 auto;
			justify-content: space-between;
			align-items: center;
			cursor: pointer;
			border: medium;
			background: none;
			padding: 0.25rem 0.5rem;
			min-inline-size: 0;
			color: inherit;
			font-weight: inherit;
			font-size: inherit;
			line-height: inherit;
			font-family: inherit;
			text-align: start;
		}

		.header-btn:hover {
			background-color: var(--stone-300);
		}

		.header-btn:focus-visible {
			outline: 2px solid;
			outline-color: var(--blue-700);
			outline-offset: -2px;
		}

		.header-label {
			display: block;
			min-inline-size: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.col-display-name ~ .col-name {
			font-weight: 400;
		}

		.table-header-cell.unsupported {
			background-color: var(--red-100);
			color: var(--red-700);
		}

		.table-header-cell.unsupported .icon {
			flex: 0 0 auto;
			margin-inline-end: 0.5rem;
			color: var(--red-700);
		}

		.table-header-cell.unsupported .header-btn:hover {
			background-color: var(--stone-300);
		}

		.table-body {
			position: relative;
			inline-size: 100%;
		}

		.table-row {
			position: absolute;
			will-change: transform;
			box-sizing: border-box;
			inset-block-start: 0;
			inset-inline-start: 0;
			border-block-end: 1px solid var(--stone-200);
			inline-size: 100%;
			block-size: 2rem;
		}

		.table-cell {
			box-sizing: border-box;
			border-inline-end: 1px solid var(--stone-200);
			padding: 0 0.5rem;
			min-inline-size: 0;
			overflow: hidden;
			color: var(--stone-800);
			font-size: 0.75rem;
			line-height: 2rem;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.table-cell-num {
			font-variant-numeric: tabular-nums;
			text-align: end;
		}

		.table-cell-text {
			text-align: start;
		}

		.table-cell-boolean,
		.table-cell-categorical {
			text-align: center;
		}

		.table-cell-date {
			font-variant-numeric: tabular-nums;
			text-align: start;
		}

		.table-cell.unsupported {
			background-color: var(--red-100);
		}
	`;

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

	/** Consumer-supplied strings. */
	@property({ attribute: false })
	accessor labels: VirtualTableLabels = DEFAULT_LABELS;

	private rowHeight = DEFAULT_ROW_HEIGHT;
	private rowLimit = Math.floor(MAX_RAIL_PX / DEFAULT_ROW_HEIGHT);
	private limitEmitted = false;
	private pool: RowNode[] = [];
	private poolStart = 0;
	private probe: RowNode | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private frameId: number | null = null;
	private updatePending = false;
	private currentScrollTop = 0;
	private lastRequestedRange: VirtualTableRange | null = null;
	private bodyEl: HTMLElement | null = null;
	private containerEl: HTMLElement | null = null;

	private readonly handleWindowScroll = (): void => {
		this.currentScrollTop = window.scrollY;
		this.scheduleFrame();
	};

	override connectedCallback(): void {
		super.connectedCallback();
		window.addEventListener('scroll', this.handleWindowScroll, { passive: true });
		window.addEventListener('resize', this.handleWindowScroll, { passive: true });
		if (this.hasUpdated) {
			this.lastRequestedRange = null;
			this.observeProbe();
			this.scheduleFrame();
		}
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		window.removeEventListener('scroll', this.handleWindowScroll);
		window.removeEventListener('resize', this.handleWindowScroll);
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
		if (this.frameId !== null) {
			cancelAnimationFrame(this.frameId);
			this.frameId = null;
		}
		this.updatePending = false;
	}

	override firstUpdated(): void {
		this.bodyEl = this.renderRoot.querySelector('.table-body');
		this.containerEl = this.renderRoot.querySelector('.table-container');
		this.applyColumns();
		this.measureRowHeight();
	}

	override updated(changed: PropertyValues<this>): void {
		super.updated(changed);
		if (changed.has('columns')) {
			this.applyColumns();
			this.clearPool();
			this.lastRequestedRange = null;
		}
		if (changed.has('totalRows')) this.lastRequestedRange = null;
		if (changed.has('columns') || changed.has('totalRows')) this.measureRowHeight();
		this.syncGeometry();
		if (this.renderedRows === 0) this.clearPool();
		this.scheduleFrame();
	}

	private get renderedRows(): number {
		const total = Number.isFinite(this.totalRows) ? Math.max(0, Math.floor(this.totalRows)) : 0;
		return Math.min(total, this.rowLimit);
	}

	private scheduleFrame(): void {
		this.updatePending = true;
		if (this.frameId === null && this.isConnected) {
			this.frameId = requestAnimationFrame(() => this.updateVirtualTable());
		}
	}

	private applyColumns(): void {
		this.containerEl?.style.setProperty('--_columns', this.columns.map(columnTrack).join(' '));
	}

	/** Sets the rail's block size and `aria-rowcount` from the rendered row count and row height. */
	private syncGeometry(): void {
		if (!this.bodyEl || !this.containerEl) return;
		this.bodyEl.style.blockSize = `${this.renderedRows * this.rowHeight}px`;
		this.containerEl.setAttribute('aria-rowcount', String(this.renderedRows + 1));
	}

	/** Measures one row's block size, using a temporary row when the pool is empty. */
	private measureRowHeight(): void {
		const body = this.bodyEl;
		if (!body) return;
		let height: number;
		if (this.probe) {
			height = this.probe.element.getBoundingClientRect().height;
		} else {
			const temporary = this.createRow();
			body.append(temporary.element);
			height = temporary.element.getBoundingClientRect().height;
			temporary.element.remove();
		}
		this.applyRowHeight(height);
	}

	private applyRowHeight(height: number): void {
		if (!(height > 0)) return;
		const changed = Math.abs(height - this.rowHeight) >= 0.01;
		if (!changed && this.limitEmitted) return;
		this.rowHeight = height;
		const limit = Math.floor(MAX_RAIL_PX / height);
		const limitChanged = limit !== this.rowLimit || !this.limitEmitted;
		this.rowLimit = limit;
		this.limitEmitted = true;
		if (changed) {
			for (const node of this.pool) this.positionRow(node);
			this.syncGeometry();
			this.scheduleFrame();
		}
		if (limitChanged) {
			this.syncGeometry();
			this.dispatchEvent(
				new CustomEvent<VirtualTableRowLimit>('ui-virtual-table-row-limit-change', {
					detail: { rowLimit: limit },
					bubbles: false,
					composed: false
				})
			);
		}
	}

	private observeProbe(): void {
		if (typeof ResizeObserver === 'undefined') return;
		this.resizeObserver ??= new ResizeObserver((entries) => {
			const entry = entries[entries.length - 1];
			const height = entry?.borderBoxSize?.[0]?.blockSize ?? entry?.contentRect.height ?? 0;
			if (height > 0) this.applyRowHeight(height);
		});
		this.resizeObserver.disconnect();
		if (this.probe) this.resizeObserver.observe(this.probe.element);
	}

	private createRow(): RowNode {
		const element = document.createElement('div');
		element.className = 'table-row';
		element.setAttribute('role', 'row');
		const cells = this.columns.map((column) => {
			const cell = document.createElement('div');
			cell.className = [
				'table-cell',
				column.kind ? KIND_CLASS[column.kind] : '',
				column.unsupported ? 'unsupported' : ''
			]
				.filter(Boolean)
				.join(' ');
			cell.setAttribute('role', 'cell');
			element.append(cell);
			return cell;
		});
		return { element, cells, index: -1, filled: undefined, busy: false };
	}

	private positionRow(node: RowNode): void {
		node.element.style.transform = `translateY(${node.index * this.rowHeight}px)`;
	}

	private assignRow(node: RowNode, index: number): void {
		node.index = index;
		node.element.setAttribute('aria-rowindex', String(index + 2));
		this.positionRow(node);
		node.filled = undefined;
	}

	private discardRow(node: RowNode): void {
		node.element.remove();
		if (node === this.probe) {
			this.probe = null;
			this.resizeObserver?.disconnect();
		}
	}

	private clearPool(): void {
		for (const node of this.pool) this.discardRow(node);
		this.pool = [];
		this.poolStart = 0;
	}

	/** Shows each pooled row's window values, or placeholders, touching only rows whose data changed. */
	private fillRow(node: RowNode): void {
		const offset = node.index - this.window.startIndex;
		const values =
			offset >= 0 && offset < this.window.rows.length
				? (this.window.rows[offset] ?? null)
				: null;
		const busy = values === null && this.loading;
		if (node.filled === values && node.busy === busy) return;
		node.filled = values;
		node.busy = busy;
		if (busy) node.element.setAttribute('aria-busy', 'true');
		else node.element.removeAttribute('aria-busy');
		node.cells.forEach((cell, column) => {
			const text = values ? (values[column] ?? '') : '';
			if (cell.textContent !== text) cell.textContent = text;
			cell.classList.toggle('placeholder-cell', values === null);
			if (text) cell.setAttribute('title', text);
			else cell.removeAttribute('title');
		});
	}

	/** Moves the pool to cover `[start, end)` keeping `.table-row` children in ascending index order. */
	private layoutPool(start: number, end: number): void {
		const body = this.bodyEl;
		if (!body) return;
		const count = end - start;
		const poolEnd = this.poolStart + this.pool.length;
		const overlaps = this.pool.length > 0 && start < poolEnd && end > this.poolStart;

		if (!overlaps) {
			for (let offset = 0; offset < count; offset++) {
				let node = this.pool[offset];
				if (!node) {
					node = this.createRow();
					body.append(node.element);
					this.pool.push(node);
				}
				this.assignRow(node, start + offset);
			}
			for (const extra of this.pool.splice(count)) this.discardRow(extra);
			this.poolStart = start;
			return;
		}

		const keepFrom = Math.max(start, this.poolStart);
		const keepTo = Math.min(end, poolEnd);
		const kept = this.pool.slice(keepFrom - this.poolStart, keepTo - this.poolStart);
		const freed = [
			...this.pool.slice(0, keepFrom - this.poolStart),
			...this.pool.slice(keepTo - this.poolStart)
		];
		const take = (): RowNode => freed.pop() ?? this.createRow();

		const head: RowNode[] = [];
		for (let index = keepFrom - 1; index >= start; index--) {
			const node = take();
			this.assignRow(node, index);
			body.prepend(node.element);
			head.unshift(node);
		}
		const tail: RowNode[] = [];
		for (let index = keepTo; index < end; index++) {
			const node = take();
			this.assignRow(node, index);
			body.append(node.element);
			tail.push(node);
		}
		for (const leftover of freed) this.discardRow(leftover);
		this.pool = [...head, ...kept, ...tail];
		this.poolStart = start;
	}

	/** One frame of work: read layout once, recycle rows, emit range and position changes. */
	private updateVirtualTable(): void {
		this.frameId = null;
		const body = this.bodyEl;
		if (!body || !this.isConnected) return;
		this.currentScrollTop = window.scrollY;
		const bodyTop = body.getBoundingClientRect().top + this.currentScrollTop;
		if (this.probe) this.applyRowHeight(this.probe.element.getBoundingClientRect().height);

		const rowHeight = this.rowHeight;
		const rendered = this.renderedRows;
		this.updatePending = false;
		if (rendered === 0) {
			this.clearPool();
			return;
		}
		const visibleRows = Math.ceil(window.innerHeight / rowHeight) + 1;
		const relativeTop = this.currentScrollTop - bodyTop;
		const first = Math.min(rendered - 1, Math.max(0, Math.floor(relativeTop / rowHeight)));
		const start = Math.max(0, first - visibleRows);
		const end = Math.min(rendered, first + 2 * visibleRows);

		this.layoutPool(start, end);
		if (!this.probe && this.pool[0]) {
			this.probe = this.pool[0];
			this.observeProbe();
		}
		for (const node of this.pool) this.fillRow(node);

		const requested = this.lastRequestedRange;
		if (
			!requested ||
			start < requested.startIndex ||
			end > requested.startIndex + requested.limit
		) {
			this.lastRequestedRange = { startIndex: start, limit: end - start };
			this.dispatchEvent(
				new CustomEvent<VirtualTableRange>('ui-virtual-table-range-change', {
					detail: { startIndex: start, limit: end - start },
					bubbles: false,
					composed: false
				})
			);
		}
		this.dispatchEvent(
			new CustomEvent<VirtualTablePosition>('ui-virtual-table-position-change', {
				detail: {
					rowIndex: first,
					offset: Math.max(0, relativeTop - first * rowHeight),
					inlineOffset: Math.abs(window.scrollX),
					top: this.currentScrollTop
				},
				bubbles: false,
				composed: false
			})
		);
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

	/** Runs the pending frame's work now, so callers see rows for the new scroll position. */
	private flushUpdate(): void {
		if (this.frameId !== null) {
			cancelAnimationFrame(this.frameId);
			this.frameId = null;
		}
		this.updateVirtualTable();
	}

	/**
	 * Scrolls the document so the given zero-based row is at the top of the rail.
	 *
	 * @deprecated Transitional: removed once consumers use the document scroll snapshot.
	 * @param index - Row index, clamped to the renderable rows.
	 * @param offset - Extra block offset in px.
	 * @param inlineOffset - Document inline offset in px.
	 */
	async scrollToRow(index: number, offset = 0, inlineOffset = 0): Promise<void> {
		const body = this.bodyEl;
		if (!body) return;
		const clamped = Math.max(0, Math.min(index, Math.max(0, this.renderedRows - 1)));
		const bodyTop = body.getBoundingClientRect().top + window.scrollY;
		window.scrollTo({
			top: bodyTop + clamped * this.rowHeight + offset,
			left: inlineOffset,
			behavior: 'instant'
		});
		this.flushUpdate();
		await this.updateComplete;
	}

	/**
	 * Restores a saved document scroll position.
	 *
	 * @deprecated Transitional: the router restores the document snapshot directly.
	 * @param top - Document block offset in px.
	 * @param left - Document inline offset in px.
	 */
	async restoreScroll(top: number, left: number): Promise<void> {
		window.scrollTo({ top, left, behavior: 'instant' });
		this.flushUpdate();
		await this.updateComplete;
	}

	/**
	 * Programmatically focuses the column header button for the given column key.
	 *
	 * @param column - Column key.
	 */
	focusColumn(column: string): void {
		this.renderRoot
			?.querySelector<HTMLButtonElement>(`button[data-col-key="${CSS.escape(column)}"]`)
			?.focus();
	}

	private renderHeaderCell(column: VirtualTableColumn): TemplateResult {
		const hasSublabel = column.sublabel !== undefined && column.sublabel !== '';
		return html`
			<div
				class="table-header-cell ${column.unsupported ? 'unsupported' : ''}"
				role="columnheader">
				<button
					type="button"
					class="header-btn"
					data-col-key=${column.key}
					@click=${() => this.handleHeaderClick(column.key)}>
					<span class="header-label"
						>${hasSublabel
							? html`<span class="col-display-name">${column.label}</span>${' '}<span
										class="col-name"
										>${column.sublabel}</span
									>`
							: html`<span class="col-name"
									>${column.label}</span
								>`}${column.unsupported
							? html`<span class="visually-hidden">${this.labels.unsupported}</span>`
							: nothing}</span
					>
				</button>
				${column.unsupported
					? html`<svg class="icon" aria-hidden="true" focusable="false">
							<use href="#alert"></use>
						</svg>`
					: nothing}
			</div>
		`;
	}

	override render(): TemplateResult {
		return html`
			${html`<svg class="symbols" aria-hidden="true" focusable="false">
				<symbol id="alert" viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd">
					<path
						d="M13.3 2c1 .4 1.5 1.5 2.5 3.6l5 10c1 2 1.5 2.9 1.3 3.8a3 3 0 0 1-1.2 2q-1 .8-4 .6H7.1q-3.1.1-4-.5a3 3 0 0 1-1.3-2c-.2-1 .3-2 1.3-4l5-9.9q1.3-3 2.5-3.6a3 3 0 0 1 2.6 0M12 16.8a1.3 1.3 0 1 0 0 2.5 1.3 1.3 0 0 0 0-2.6m0-10.3a1 1 0 0 0-.9.5L11 8.1v4.8l.1 1a1 1 0 0 0 1.8 0l.1-1V8.1l-.1-1a1 1 0 0 0-.9-.6" />
				</symbol>
			</svg>`}
			<div
				class="table-container"
				role="table"
				aria-label=${ifDefined(this.label || undefined)}
				aria-colcount=${this.columns.length}>
				<div class="table-header" role="rowgroup">
					<div class="table-header-row" role="row" aria-rowindex="1">
						${repeat(
							this.columns,
							(column) => column.key,
							(column) => this.renderHeaderCell(column)
						)}
					</div>
				</div>
				<div class="table-body" role="rowgroup"></div>
			</div>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'ui-virtual-table': UiVirtualTable;
	}
}
