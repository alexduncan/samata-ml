# Specification: ui-virtual-table

**Status:** implemented — presentational virtual table scrolled by the document, with a single capped rail, a recycled row pool, ARIA table semantics and consumer-owned fetching and formatting. Visual reference: draft `specification/mockups/01-6_virtual-table.html` at commit `8329a10`, authorised as normative for the virtual-table-improvements plan (visual-design §1.1 exception) until the human promotes it.

## 1. Summary

This is a **Tier 2 (Presentational component)**. `<ui-virtual-table>` renders a bounded pool of rows inside one rail whose block size is `rows × measured row height`. The document scrolls on both axes; the table owns no scroll container. It requests rows from its consumer via events and supports datasets of any size by capping the rail at a browser-safe height (`MAX_RAIL_PX = 16_000_000`). It uses `<div>` elements with standard ARIA table roles and native `columnheader` buttons.

## 2. Decision and rationale

**Tier 2:** the component receives data through properties and emits intents through events. It does not manage workers, query IndexedDB, import stores or use `src/i18n.ts`. Fetching, caching and display formatting are consumer concerns; cell text is set with `textContent`, so markup renders literally.

**Document scrolling (navigation §8.1):** the document is the only scroll container on the preview route, so no ancestor of the table may have `overflow` other than `visible`. A passive `window` `scroll` and `resize` listener only records the scroll offset and schedules one `requestAnimationFrame`; the frame reads layout once (`tableBody.getBoundingClientRect()`) and then mutates.

**Single capped rail:** `rowLimit = floor(16,000,000 / measuredRowHeightPx)` (below Firefox's ≈17.9M px element limit). Rendered rows are `min(totalRows, rowLimit)`. The consumer learns the limit from `ui-virtual-table-row-limit-change` and explains it to the user. There are no segments and no compressed scrolling.

**Row pool, imperative DOM:** Lit renders the header and an empty `.table-body`. Rows are an imperatively managed pool created and mutated only in the frame update (recorded departure from Lit templating, for O(visible) updates). Rows are absolutely positioned and moved with `transform: translateY()`; geometry is only ever set through the CSSOM (`element.style.transform`, `.blockSize`, `.setProperty`) because the CSP forbids `style` attributes in templates. Overscan is one screen above and below: `visibleRows = ceil(innerHeight / rowHeight) + 1`, rendered range `[first − visibleRows, first + 2 × visibleRows)` clamped, so the pool never exceeds `3 × visibleRows + 1` rows.

**DOM order equals `aria-rowindex` order** (WCAG 1.3.2): scrolling forwards recycles rows from the start and appends them; scrolling backwards recycles from the end and prepends them; a jump that does not overlap the old range reassigns the existing pool in ascending order in place. Rows still in range are neither moved nor mutated.

**Semantics:** div-based ARIA table (`role="table"`, `rowgroup`, `row`, `columnheader`, `cell`) with native `<button>` elements in column headers; not `role="grid"`, because spreadsheet navigation and editing are out of scope.

**Columns:** all rows and the header row use `display: grid` with `grid-template-columns: var(--_columns)`, set once on `.table-container`. A column with `contentChars` gets `clamp(6rem, calc(<n>ch + 1rem), 20rem)`; without a hint `12rem`. Header text never widens a column; it truncates.

## 3. Public API (closed)

- **Tag name:** `ui-virtual-table`
- **Types:**

```ts
export type VirtualTableColumnKind = 'numeric' | 'temporal' | 'boolean' | 'categorical' | 'text';
export interface VirtualTableColumn {
	readonly key: string;
	/** Primary visible header text (display name, or the column name when there is none). */
	readonly label: string;
	/** Raw column name shown after `label` on the same line, separated by one space; omit when it equals `label`. */
	readonly sublabel?: string;
	readonly kind?: VirtualTableColumnKind; // omitted: default start alignment, no type class
	readonly unsupported?: boolean;
	/** Character-count width hint; omitted: 12rem track. */
	readonly contentChars?: number;
}
export interface VirtualTableWindow {
	readonly startIndex: number;
	readonly rows: readonly (readonly string[])[];
}
export interface VirtualTableRange {
	readonly startIndex: number;
	readonly limit: number;
}
export interface VirtualTableRowLimit {
	readonly rowLimit: number;
}
export interface VirtualTableLabels {
	readonly unsupported: string;
} // default { unsupported: ', not used for training' }
```

- **Properties** (`attribute: false` unless noted): `columns` (`[]`), `window` (`{ startIndex: 0, rows: [] }`), `loading` (`false`), `totalRows` (`0`, attribute `total-rows`), `label` (`''`, attribute `label`), `labels` (`VirtualTableLabels`).
- **Methods:** `focusColumn(column: string): void`. `updateComplete` resolves after `.table-body`'s block size is set for the current `totalRows`, without waiting for an animation frame (so the document is full height when a restore runs).
- **Transitional (removed once consumers use the document scroll snapshot):** `scrollToRow(index, offset = 0, inlineOffset = 0): Promise<void>` (`window.scrollTo` to the body's document top + `clamp(index) × rowHeight + offset`), `restoreScroll(top, left): Promise<void>` (`window.scrollTo`), and `ui-virtual-table-position-change` with `VirtualTablePosition { rowIndex, offset, inlineOffset, top }` (first visible row, offset inside it, document `scrollX`, document `scrollY`), emitted from each frame update.
- **Events** (host, `bubbles: false`, `composed: false`; listen on the element):
    - `ui-virtual-table-range-change` — `VirtualTableRange`; deduplicated: emitted only when the needed range is not covered by the last request.
    - `ui-virtual-table-column-select` — `{ column: string }`.
    - `ui-virtual-table-row-limit-change` — `VirtualTableRowLimit`; emitted after the first row measurement and whenever the limit changes (text size).
- **CSS custom property:** `--ui-virtual-table-sticky-offset` (length, default `0px`) is the header's `inset-block-start`. `--_columns` is private.
- **Markup:** `div.table-container[role=table][aria-label][aria-rowcount][aria-colcount]` > `div.table-header[role=rowgroup]` (sticky) > `div.table-header-row[role=row][aria-rowindex=1]` > `div.table-header-cell[role=columnheader]` (+ `.unsupported`) > `button.header-btn[type=button][data-col-key]` > `span.header-label` > (`span.col-display-name`, a space, `span.col-name`) when `sublabel` is set, else `span.col-name`; an unsupported column adds a final `span.visually-hidden` with `labels.unsupported` inside `span.header-label` and, after the button inside the header cell, `svg.icon[aria-hidden=true][focusable=false]` using the local `<symbol id="alert">`. Body: `div.table-body[role=rowgroup]` (`style.blockSize = renderedRows × rowHeight px`) with rows `div.table-row[role=row][aria-rowindex=index+2]` and cells `div.table-cell[role=cell]` + type class + `.unsupported`, `title` = text; placeholder cells keep `placeholder-cell` and busy rows `aria-busy="true"`. No `tabindex`, no `role="region"`.
- **CSS parts:** none.

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
		{ key: 'id', label: 'ID', kind: 'numeric' },
		{ key: 'name', label: 'Name', kind: 'text' }
	];

	private handleRangeChange(e: CustomEvent<VirtualTableRange>) {
		const { startIndex, limit } = e.detail; // fetch rows, then set this.window
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

Usage rules: do not wrap the table in an element with `overflow`; set `--ui-virtual-table-sticky-offset` to the measured height of any sticky header above it; pass formatted text only; give unsupported columns `unsupported: true` rather than styling them from outside.

## 5. Visual specification

Structure and styling follow the authorised draft `specification/mockups/01-6_virtual-table.html` and `css/virtual-table.css` (commit `8329a10`). Recorded differences (visual-design §5.3): DATA-UI-04 grid tracks with content widths instead of a single `--column-width`; DATA-UI-05 measured sticky offset instead of `inset-block-start: 4rem`; DATA-UI-06 visually hidden ", not used for training" inside the header button in addition to the decorative icon; DATA-UI-08 the `.table-cell-date` amber background is not ported; DATA-UI-09 display name and column name inline in one truncating `span.header-label`, column name at weight 400.

- **Tokens:** borders `--stone-300`, `--stone-200`; backgrounds `--surface` (container), `--stone-150` (header); text `--stone-800`; unsupported `--red-100` (background) and `--red-700` (header text, icon); hover `--stone-300`; focus ring `--blue-700`. Row height is `2rem` (measured), cell text `0.75rem`.
- **Alignment (kinds):** numeric end with tabular numbers; temporal start with tabular numbers; boolean and categorical centre; text and default start.

## 6. Accessibility

- `role="table"` with the supplied `aria-label`; `aria-rowcount = renderedRows + 1`, `aria-colcount = columns.length`, header row `aria-rowindex="1"`, data rows `index + 2`.
- Header accessible names come from visible DOM text (no `aria-label`, no `title`): `label`, one space, `sublabel`, then the hidden unsupported suffix (for example "Age category age_cat, not used for training"). Unsupported status is never colour-only (WCAG 1.4.1, 1.3.1). The suffix stays inline with zero font size so no engine inserts a space before the comma.
- Header buttons are native buttons; no keyboard trap and no scroll container, so the document scrolls with the keyboard. Cells carry `title` for pointer users; keyboard and touch users read full values in the column panel.
- WCAG 2.4.11: the sticky header must not hide a focused element; the consumer keeps the document `scroll-padding-block-start` in step with the sticky offset.

## 7. Internationalisation

- **Strings:** the component owns only the `labels.unsupported` default; all names, labels and cell values are consumer-supplied.
- **Layout:** logical properties (`border-inline-end`, `inset-inline-start`, `margin-inline-end`, `inset-block-start`); rows start at the inline start in RTL.

## 8. Acceptance criteria

- **VTB-AC-1:** with 0, 1, 150, 600,000 and 10,000,000 rows the pooled row count never exceeds `3 × visibleRows + 1` at the start, middle and end of the document scroll; the last reachable row (`min(totalRows, rowLimit) − 1`) renders at the bottom.
- **VTB-AC-2:** `.table-body` block size equals rendered rows × row height; each row's transform equals `translateY(index × rowHeight)`; scrolling forwards by one row recycles exactly one row (others keep identity, DOM position and transform); after scrolling forwards, backwards and jumping, `aria-rowindex` values are strictly ascending in DOM order and the accessibility tree lists rows in that order.
- **VTB-AC-3:** ten synthetic `scroll` events after `window.scrollTo` schedule exactly one animation frame and one row update; range events are deduplicated; a stale window never fills wrong indices; cell markup renders literally; column selection emits `{ column }`.
- **VTB-AC-4:** `ui-virtual-table-row-limit-change` fires with `floor(16,000,000 / rowHeight)` after the first measurement and again after the root font size doubles; `aria-rowcount` equals rendered rows + 1.
- **VTB-AC-5:** each kind produces its class and computed `text-align`, and `font-variant-numeric: tabular-nums` for numeric and temporal columns.
- **VTB-AC-6:** column tracks equal `clamp(6rem, calc(nch + 1rem), 20rem)` for hints 1, 10 and 100 and `12rem` without a hint; header and body cells align within 1px.
- **VTB-AC-7:** an unsupported column has `.unsupported` on its header cell and every rendered cell; its button's accessible name ends with ", not used for training"; the header cell's last child is an `aria-hidden` `svg.icon` using `#alert` after the button; header background `--red-100`, colour `--red-700`, icon `margin-inline-end` 0.5rem (mirrored in RTL), unsupported body cells `--red-100`; date cells have no amber background.
- **VTB-AC-8:** each header button holds exactly one `span.header-label` whose last child is the hidden suffix for unsupported columns; accessible names equal the full visible text and visually truncate with an ellipsis on one line; `.col-name` after a display name computes `font-weight: 400`; no `title` or `aria-label` on header buttons; cells have `title` equal to their text.
- **VTB-AC-9:** the header sticks at `--ui-virtual-table-sticky-offset` while the document scrolls; no table element or ancestor is a scroll container and none has `tabindex`; no CSP violation and no `style` attributes or `styleMap` in templates.
- **VTB-AC-10:** disconnect removes the window listeners and observers (no range events afterwards); reconnect restores them; RTL renders from the inline start; axe passes in Chromium, Firefox and WebKit.
- **VTB-AC-11:** setting `totalRows` from 0 to 20,000 gives `.table-body` a block size of `20,000 × rowHeight` by the time `updateComplete` resolves, with `requestAnimationFrame` stubbed to never fire.
- **VTB-AC-12 (transitional):** `scrollToRow(50, 5, 25)` scrolls the document to the body's top + `50 × rowHeight + 5` and `scrollX` 25; `restoreScroll(top, left)` calls `window.scrollTo`; `ui-virtual-table-position-change` reports the first visible row.

Tests run in Playwright, `tests/virtual-table.e2e.ts`, in Chromium, Firefox and WebKit.

## 9. Stories

`src/components/ui-virtual-table.stories.ts`, title `Components/Virtual table`, with the story-only consumer `.storybook/fixtures/storybook-virtual-table-host.ts`: Populated (150 rows, every kind), Empty, Placeholders, Unsupported column, Display-name headers, Capped (10,000,000 rows), Long label, RTL. The docs page carries the Do / Don't rules of §4.

## 10. Files

- `src/components/ui-virtual-table.ts`, `src/components/ui-virtual-table.stories.ts`
- `.storybook/fixtures/storybook-virtual-table-host.ts`
- `tests/virtual-table.e2e.ts`

## 11. Non-goals

- Internal data fetching (workers, IndexedDB, stores).
- Variable row heights.
- Sorting, filtering, editing, sticky row headers.
- Horizontal virtualisation (all columns render; up to 200 columns).
- Spreadsheet grid semantics.
- Segments, Go to row and compressed scrolling (rows beyond the rail limit are not previewed; the consumer says so).

## 12. Open questions

None.
