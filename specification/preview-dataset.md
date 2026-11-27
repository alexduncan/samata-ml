# Dataset Preview Design

**Status:** implemented — delivered in Step 1 (`src/features/data/app-dataset-preview.ts`, `src/components/ui-virtual-table.ts`, `src/features/data/app-column-details.ts`, `src/stores/dataset.store.ts`).

## Goal

When the user clicks Load Dataset on a sample, or an uploaded file has passed its check, the `/data` view switches immediately from selection cards to the preview page, which shows a labelled progress bar until the dataset is published and then the document-scrolled virtual table. The preview survives page reloads and browser navigation until explicitly changed or cleared.

## High-Level Flow

1. The user selects a sample dataset, or uploads a local CSV file. An upload is checked first, inside the Upload modal: pass 1 parses and profiles the whole file with no IndexedDB writes ("Checking file", determinate bytes), so every parse, shape, size and quota error appears in the modal. A sample has one pass.
2. The page switches to the preview branch (the modal closes for an upload). The ingestion worker parses and profiles the dataset in-page, writing metadata to IndexedDB store `dataset_metadata` and typed rows to `dataset_rows`, while the preview header and a progress bar (phase text, "Step n of total", `<progress>`) show the phase. There is no Cancel in the page. A failure returns to selection with a `role="alert"` notification above the cards and focus on the selection heading; storage, quota or publication failures of an upload's second pass are shown the same way.
3. Application state records `dataset: { id, name, rowCount, columnCount, ... }` and sets `data: { mode: 'preview', selectedColumn: null }`.
4. `AppDataView` shows one `app-dataset-preview` instance from the start of loading, through publication, into the ready preview (`selectDataViewMode`), together with `app-column-details` and the Datasheet dialog. Its heading is focused once when loading starts; the persistent `role="status"` announces phase changes and "{name} loaded: {rows} rows, {columns} columns", and focus stays on the same h1 (WCAG 2.4.3, 4.1.3).
5. The virtual table requests row chunks on demand for the visible viewport through `loadPreviewRows(offset, limit)` and `$previewRows`.

## Storage & Metadata Model

- Rows are keyed in IndexedDB by compound key `[datasetId, rowIndex]`.
- Metadata is stored per dataset in `dataset_metadata` with typed columns:
  - `numeric`
  - `categorical`
  - `boolean`
  - `date`
  - `time`
  - `datetime`
  - `text`
- Statistics for each column include missing/invalid counts, tokens, and type-specific summaries (min/mean/max/histogram for numeric, value frequencies for categorical, earliest and latest values for date, time and datetime, shown at the column's precision, with UTC stated only for datetime).

## View-Switch & State Rules

The `/data` view renders the preview branch when a load is ingesting or when:

```ts
$appState.get().dataset !== null && $appState.get().data.mode === 'preview';
```

- When neither holds, the sample dataset catalogue and upload header are shown. A reload during validation or ingestion lands on selection with no progress bar (the load state is not persisted).
- The preview header reads "{name} Preview" with "{rows} rows | {columns} columns". Actions: **Datasheet** (samples only, opens the datasheet dialog; focus returns to the button) and a red **Change Dataset** (`.btn-red`). Hidden while loading.
- Columns show the sample's display name and the raw column name on one truncating line (name at weight 400); uploaded columns show only the name. Columns the modelling workflow cannot use (text, date, time, datetime) carry a red treatment, an alert icon and a hidden ", not used for training". Tracks are sized from the column's statistics.
- "Change Dataset" requires explicit user confirmation via a modal dialog before clearing the active dataset, target, and models.

## Virtualized Table & Row Paging

- The document scrolls the table on both axes; `main` is not a scroll container. The table header sticks beneath the page header (measured, not fixed), or at 0 on viewports shorter than 30rem.
- Memory remains bounded by a recycled row pool and requesting only visible row ranges plus one screen of buffer via `ui-virtual-table-range-change`.
- There are no segment controls and no Go to row. The rail is capped at `MAX_RAIL_PX` (16,000,000 px): above `floor(MAX_RAIL_PX / rowHeight)` rows the preview shows "Previewing the first {limit} of {total} rows. All rows are used for training."
- Placeholders render while rows are in flight. An empty dataset shows "No rows to preview." and no table; a metadata or row failure shows a `role="alert"` notification with Retry above the table.
- Dates format in UTC; numbers format with locale grouping and preserved decimals via `$format.number()`.

## Scroll & Focus Integration

- The table offset is the route's document scroll snapshot under `data:preview` (`top` and, optionally, `left` for horizontal scroll); `regions['data-table']` is no longer written and legacy entries are ignored. A snapshot restores only at the same viewport width.
- When navigating back or reloading, the router awaits `app-data-view.whenSettled()`, which waits for the dataset resources and the table's geometry, then restores the snapshot once. A dataset discard or the publication of a different dataset clears `data:preview`.
- A router-requested heading focus uses `app-data-view.focusHeading(signal)`, which delegates to `app-dataset-preview.focusHeading(signal)` in preview mode. Each owner awaits only its own Lit render, checks cancellation/connection and focuses its own h1 with `preventScroll: true`. This is independent of metadata/row readiness, `whenSettled()` and column-header focus. Later loading/ready/error updates do not request focus again, except that starting a load moves focus to the preview heading once because the invoking control unmounts.
- Selecting a column opens `<app-column-details>` without stealing document scroll. Closing the inspector restores focus to the column header.
