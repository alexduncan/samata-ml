import { html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../../src/components/ui-virtual-table';
import type {
	VirtualTableColumn,
	VirtualTableRange,
	VirtualTableWindow
} from '../../src/components/ui-virtual-table';

const SAMPLE_WORDS = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];

/** Generates the display text for one cell of a story row. */
function cellText(column: VirtualTableColumn, row: number): string {
	switch (column.kind) {
		case 'numeric':
			return (row * 1.5 + 1000).toFixed(2);
		case 'temporal':
			return `2024-01-${String((row % 28) + 1).padStart(2, '0')}`;
		case 'boolean':
			return row % 2 === 0 ? 'true' : 'false';
		case 'categorical':
			return SAMPLE_WORDS[row % SAMPLE_WORDS.length]!;
		default:
			return `Free text for row ${row + 1} in ${column.key}`;
	}
}

/** Story-only consumer: answers range requests with generated rows, as a real consumer would. */
@customElement('storybook-virtual-table-host')
class StorybookVirtualTableHost extends LitElement {
	/** Columns passed through to the table. */
	@property({ attribute: false }) accessor columns: readonly VirtualTableColumn[] = [];

	/** Total number of rows. */
	@property({ type: Number }) accessor totalRows = 150;

	/** Accessible table label. */
	@property() accessor label = 'Story table';

	@state() private accessor rowWindow: VirtualTableWindow = { startIndex: 0, rows: [] };

	private handleRange(event: CustomEvent<VirtualTableRange>): void {
		const { startIndex, limit } = event.detail;
		this.rowWindow = {
			startIndex,
			rows: Array.from({ length: limit }, (_, offset) =>
				this.columns.map((column) => cellText(column, startIndex + offset))
			)
		};
	}

	override render() {
		return html`<ui-virtual-table
			.columns=${this.columns}
			.window=${this.rowWindow}
			.totalRows=${this.totalRows}
			label=${this.label}
			@ui-virtual-table-range-change=${this.handleRange}></ui-virtual-table>`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'storybook-virtual-table-host': StorybookVirtualTableHost;
	}
}
