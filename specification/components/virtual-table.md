# Specification: ui-virtual-table

**Status:** implemented — delivered presentational virtual table with segmented rail, ARIA table semantics, and consumer-owned fetching/formatting; styled appearance pending human mockup promotion.

## 1. Summary

This is a **Tier 2 (Presentational component)**. `<ui-virtual-table>` is a presentational virtualised data table that renders a bounded window of rows within a segmented virtual rail, requesting rows from its consumer via events. It supports datasets of up to 10,000,000 preview rows without allocating large arrays or exceeding browser layout limits. It uses `<div>` elements with standard ARIA table roles and native columnheader buttons.

## 2. Decision and rationale

**Tier 2 Selection:** The component is explicitly Tier 2 because it receives data strictly through properties and emits intents through events. It does not manage its own WebWorker, query IndexedDB directly, or import stores. Asynchronous chunk fetching, caching, and display formatting are owned by the consumer.

**Segmented Rail and Layout:** A continuous 10-million-row layout spacer exceeds browser height limits even with a bounded DOM, and a compressed rail causes ordinary scroll operations to skip rows. The component renders a segmented rail of at most 10,000 rows (25,000rem). The consumer provides Previous/Next segment and Go to row controls.

**Semantics:** Div-based ARIA table (`role="table"`, `role="rowgroup"`, `role="row"`, `role="columnheader"`, `role="cell"`) with native `<button>` elements in column headers. It does not use the `grid` role, because spreadsheet grid navigation, cell focus, and in-cell editing are outside scope for this preview table.

## 3. Public API (closed)

- **Tag name:** `ui-virtual-table`
- **Properties:**
    - `columns` (`readonly VirtualTableColumn[] = []`): Column keys and display labels (property-only, `attribute: false`).
    - `window` (`VirtualTableWindow = { startIndex: 0, rows: [] }`): Current row slice provided by consumer (property-only, `attribute: false`).
    - `loading` (`boolean = false`): Whether a fetch is currently in flight (property-only, `attribute: false`).
    - `totalRows` (`number = 0`): Total row count in the dataset (attribute `total-rows`).
    - `label` (`string = ''`): Accessible label describing the table contents (attribute `label`).
- **Methods:**
    - `scrollToRow(index: number, offset?: number, inlineOffset?: number): Promise<void>`: Programmatically scrolls to an absolute zero-based row index, selecting the appropriate segment. Clamps to `[0, min(totalRows, 10_000_000) - 1]`.
    - `restoreScroll(top: number, left: number): Promise<void>`: Converts logical pixel offsets using measured row height, then calls `scrollToRow`.
    - `focusColumn(column: string): void`: Programmatically focuses the matching column header button.
- **Events:**
    - `ui-virtual-table-range-change`: Emitted when the visible window requires new rows. Carries `VirtualTableRange` (`{ startIndex: number, limit: number }`). Dispatches on host, `bubbles: false`, `composed: false`.
    - `ui-virtual-table-position-change`: Emitted on scroll. Carries `VirtualTablePosition` (`{ rowIndex: number, offset: number, inlineOffset: number, top: number }`). Dispatches on host, `bubbles: false`, `composed: false`.
    - `ui-virtual-table-column-select`: Emitted when a header button is clicked. Carries `{ column: string }`. Dispatches on host, `bubbles: false`, `composed: false`.
- **CSS Parts:** None.
- **CSS Custom Properties:** None beyond global tokens in `css/root.css`.

## 4. Usage

```typescript
import { html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { VirtualTableColumn, VirtualTableRange, VirtualTableWindow } from './ui-virtual-table';
import './ui-virtual-table';

@customElement('app-dataset-viewer')
export class AppDatasetViewer extends LitElement {
	@state() private window: VirtualTableWindow = { startIndex: 0, rows: [] };
	@state() private columns: VirtualTableColumn[] = [
		{ key: 'id', label: 'ID' },
		{ key: 'name', label: 'Name' }
	];

	private handleRangeChange(e: CustomEvent<VirtualTableRange>) {
		// Consumer fetches rows and updates this.window:
		const { startIndex, limit } = e.detail;
		// e.g. store.fetchRows(startIndex, limit);
	}

	override render() {
		return html`
			<ui-virtual-table
				.columns=${this.columns}
				.window=${this.window}
				.totalRows=${150}
				label="Dataset preview"
				@ui-virtual-table-range-change=${this.handleRangeChange}></ui-virtual-table>
		`;
	}
}
```

## 5. Visual specification

Structure follows draft `specification/mockups/ui-scaffold/drafts/01-6_virtual-table.html`. Styled appearance is pending promotion by the human.

- **Layout & Geometry:** Host uses `display: block`. Row height is `2.5rem`, measured after render. Viewport has `max-block-size: 25rem` with `overflow: auto`. Column minimum inline size is `12rem`.
- **Tokens:**
    - Border: `var(--stone-300)` and `var(--stone-200)`.
    - Backgrounds: `var(--surface)` for viewport, `var(--stone-150)` for header, `var(--stone-50)` for alternating rows.
    - Text: `var(--stone-800)`.
    - Focus ring: `var(--blue-700)`.

## 6. Accessibility

- **ARIA Roles:** `role="table"` on container, `role="rowgroup"` for header and body, `role="row"` on rows, `role="columnheader"` on header cells, `role="cell"` on data cells. Focusable viewport has `role="region"`, `tabindex="0"`, and `aria-label`.
- **Attributes:** `aria-rowcount` is `min(totalRows, 10_000_000) + 1`. Header row has `aria-rowindex="1"`. Data rows have `aria-rowindex="absoluteIndex + 2"`. `aria-colcount` matches columns length.
- **Controls:** Native `<button type="button">` elements inside header cells provide keyboard accessibility without custom keyboard handlers.

## 7. Internationalisation

- **Strings:** The component owns no user-visible string literals; all column names, labels, and cell values are consumer-supplied.
- **Layout Constraints:** Uses logical properties (`border-block-end`, `border-inline-end`, `min-inline-size`, `inset-block-start`). RTL scrolling normalises `scrollLeft` to non-negative inline offsets.

## 8. Acceptance criteria

- **VTB-AC-1:** DOM bound holds at start/middle/end for 0, 1, 10,001, 10,000,000 and 10,000,001 rows without full-row allocation; last permitted row reachable.
- **VTB-AC-2:** Exact ranges and deduplication at partial rows, resize and segment changes; stale windows never populate wrong indices.
- **VTB-AC-3:** Exact column and position events; markup in cell values displays as literal text.
- **VTB-AC-4:** Named header buttons are operable, no keyboard trap, exact table counts/indices in ARIA attributes.
- **VTB-AC-5:** Configured browsers pass the large-row cases, tokens, and mounted-table axe scan.
- **VTB-AC-6:** Font scaling remeasures rows without clipping; disconnect silences observers/events and reconnect restores them.

## 9. Stories

Feature-story migration remains a separate follow-up; the installed Storybook workbench currently covers primitives and shell. Acceptance tests continue through Playwright in `tests/virtual-table.e2e.ts`. This boundary does not change the table contract, tier or styles.

## 10. Files

- `src/components/ui-virtual-table.ts`
- `tests/virtual-table.e2e.ts`

## 11. Non-goals

- **Internal Data Fetching:** Component does not touch WebWorkers, IndexedDB, or stores.
- **Variable Row Heights:** Fixed row heights avoid $O(N)$ layout thrashing.
- **Sorting / Filtering / Editing:** Owned by worker/store layer.
- **Horizontal virtualisation:** Deferred pending measurement of 256-column datasets.
- **Spreadsheet grid:** No roving cell focus or `role="grid"`.

## 12. Open questions

None. All architectural and API questions are settled.
