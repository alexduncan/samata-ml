# Specification: ui-virtual-table

## 1. Summary

This is a **Tier 2 (Presentational component)**. `<ui-virtual-table>` is a highly performant virtualized data grid designed to render millions of rows via DOM recycling and infinite scrolling. It utilizes standard `<div>` elements augmented with ARIA roles to bypass the rendering bottlenecks and layout constraints inherent to native `<table>` elements under extreme vertical heights.

## 2. Decision and rationale

**Tier 2 Selection:** The component is explicitly Tier 2 because it receives data strictly through properties and emits intents through events. It MUST NOT manage its own WebWorker, query IndexedDB directly, or import nanostores. Managing asynchronous chunk fetching is the responsibility of the consumer or a parent Tier 3 component.

**Markup Rationale:** Native `<table>` layouts severely degrade when placing massive height spacers inside a `<tbody>`, and `transform: translateY()` behavior on table rows is undefined across rendering engines. A CSS Flexbox/Grid structure using `<div>` elements ensures decoupled layout physics, reliable sticky headers, and 60fps scrolling while preserving semantic structure via the WAI-ARIA Table pattern.

## 3. Public API (closed)

* **Tag name:** `ui-virtual-table`
* **Properties:**
* `totalRows` (Number): The absolute total number of rows in the dataset.
* `rowHeight` (Number): The fixed pixel height of each row.
* `viewportHeight` (Number): The visible height of the scrolling container.
* `buffer` (Number): The number of off-screen rows to render above and below the visible window to prevent tearing during rapid scrolling.
* `visibleRows` (Array): An array of generic row objects currently passed in for rendering.
* `columns` (Array): Configuration objects defining column keys, headers, and widths.


* **Events:**
* `ui-virtual-table-range-change`: Fired when the scroll threshold crosses a row boundary. Emits `detail: { startIndex: number, limit: number }`.




* **CSS Parts:**
* `viewport`, `spacer`, `rows-window`, `row`, `cell`, `header`, `columnheader`


* **CSS Custom Properties:**
* None beyond global system tokens.



## 4. Usage

```typescript
import { html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import './ui-virtual-table.ts';

/**
 * Connected controller orchestrating the WebWorker and the virtual table.
 */
@customElement('app-dataset-viewer')
export class AppDatasetViewer extends LitElement {
  @state() private visibleRows = [];
  private worker = new Worker(new URL('./table-worker.ts', import.meta.url), { type: 'module' });

  private handleRangeChange(e: CustomEvent<{ startIndex: number, limit: number }>) {
    this.worker.postMessage({
      type: 'FETCH_ROWS',
      offset: e.detail.startIndex,
      limit: e.detail.limit
    });
  }

  render() {
    return html`
      <ui-virtual-table
        .totalRows=${2_000_000}
        .rowHeight=${40}
        .viewportHeight=${600}
        .buffer=${10}
        .columns=${[
          { key: 'id', header: 'ID', width: '100px' },
          { key: 'attrA', header: 'Attribute A', width: '1fr' }
        ]}
        .visibleRows=${this.visibleRows}
        @ui-virtual-table-range-change=${this.handleRangeChange}
      ></ui-virtual-table>
    `;
  }
}

```

## 5. Visual specification

As a generic UI primitive, this component applies structural layout but relies on global design tokens for colors and borders.

* **Layout:** The host uses `display: flex; flex-direction: column;`. The header is naturally fixed via `flex: 0 0 auto`. The body is `flex: 1 1 auto` with `overflow-y: auto`.
* **Tokens:**
* Backgrounds MUST map to `var(--color-bg-surface)` or equivalent.
* Borders MUST use `var(--color-border-subtle)` mapped via logical properties.
* Focus rings MUST use the globally defined outline token on `:focus-visible`.





## 6. Accessibility

The component bypasses native `<table>` elements and therefore MUST reconstruct the exact accessibility tree.

* **ARIA Roles:** `role="table"` on the host/container. `role="rowgroup"` for the header container and the scrolling body. `role="row"` on individual rows. `role="columnheader"` and `role="cell"` on grid items.
* **Attributes:** `aria-rowcount` on the table to indicate the total virtualized length. `aria-rowindex` on each rendered row to communicate its absolute position within the virtual array. `aria-colcount` on the table.
* **Manual Checks:**
1. Verify VoiceOver/NVDA announces the total row count correctly upon entering the table.
2. Verify screen readers announce the correct absolute row number when navigating via virtual cursor.



## 7. Internationalisation

* **Strings:** This block renders only consumer-supplied text and owns no strings.


* **Layout Constraints:** The component strictly uses logical CSS properties (`border-block-end`, `padding-inline`, `inset-inline-start`). Fixed widths on text are forbidden, allowing for +40% expansion in verbose locales and seamless RTL mirroring.



## 8. Acceptance criteria

* **VTB-AC-1:** The DOM contains exactly `(viewportHeight / rowHeight) + (buffer * 2)` row nodes during standard scrolling, recycling nodes strictly via `transform: translateY`.


* **VTB-AC-2:** `ui-virtual-table-range-change` fires exactly once per threshold boundary crossing without emitting duplicate events for the same `startIndex`.
* **VTB-AC-3:** The table structure renders without overflow clipping when `dir="rtl"` is set on the document.


* **VTB-AC-4:** Keyboard navigation (tabbing into the viewport and using arrow keys) natively scrolls the viewport and dispatches correct chunk requests.

## 9. Stories

* `Default`: A static viewport mapping 100 rows.
* `MillionsOfRows`: A mock data provider feeding a 5-million row array to test 64-bit integer height limits in standard browsers.
* `RTL`: The table rendered with right-to-left alignment, testing logical layout properties.


* `LongLabel`: Consumer data cells with unbroken strings exceeding standard widths to verify `text-overflow: ellipsis` and logical boundary constraints.

## 10. Files

* `src/components/ui-virtual-table/ui-virtual-table.ts`
* `src/components/ui-virtual-table/ui-virtual-table.stories.ts`
* `src/components/ui-virtual-table/ui-virtual-table.test.ts` (Playwright acceptance criteria)



## 11. Non-goals

* **Internal Data Fetching:** The component will NOT integrate directly with WebWorkers, `nanostores`, or IndexedDB. It is a pure rendering pipeline.
* **Variable Row Heights:** Calculating dynamic offsets for millions of variable-height rows introduces $O(N)$ layout thrashing. Row heights MUST be fixed.
* **Built-in Sorting/Filtering:** Data manipulation belongs in the worker/store layer, not the view primitive.

## 12. Open questions

* Should we expose a generic `<slot>` per cell by passing a `renderCell` template function in the column definition, or strictly enforce string-only data rendering to maximize WebWorker transfer speeds?