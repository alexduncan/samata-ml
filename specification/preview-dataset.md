# Dataset Preview Design

**Status:** implemented — delivered in Step 1 (`src/features/data/app-dataset-preview.ts`, `src/components/ui-virtual-table.ts`, `src/features/data/app-column-details.ts`, `src/stores/dataset.store.ts`).

## Goal

After loading a sample dataset or uploading a CSV file, the `/data` view switches immediately from selection cards to a scrollable virtual table preview of the dataset. The preview survives page reloads and browser navigation until explicitly changed or cleared.

## High-Level Flow

1. The user selects a sample dataset or uploads a local CSV file.
2. Ingestion worker parses and profiles the dataset, writing metadata to IndexedDB store `dataset_metadata` and typed rows to `dataset_rows`.
3. Application state records `dataset: { id, name, rowCount, columnCount, ... }` and sets `data: { mode: 'preview', selectedColumn: null }`.
4. `AppDataView` mounts `app-dataset-preview` and `app-column-details`.
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

The `/data` view renders the preview when:

```ts
$appState.get().dataset !== null && $appState.get().data.mode === 'preview';
```

- When `dataset === null` or `data.mode === 'select'`, the sample dataset catalogue and upload header are shown.
- "Change Dataset" requires explicit user confirmation via a modal dialog before clearing the active dataset, target, and models.

## Virtualized Table & Row Paging

- Memory remains bounded by requesting only visible row ranges plus overscan (typically 40–80 rows per fetch) via `ui-virtual-table-range-change`.
- For large datasets, the table operates within a 10,000-row segment with segment navigation controls ("Previous segment", "Next segment", "Go to row"), supporting datasets up to 10,000,000 rows without massive DOM virtualization rail distortion.
- Placeholders render while rows are in flight.
- Dates format in UTC; numbers format with locale grouping and preserved decimals via `$format.number()`.

## Scroll & Focus Integration

- On scroll, logical table position is recorded in the active route's scroll snapshot under `regions['data-table'] = { top, left }`.
- When navigating back or reloading, `restoreScroll` awaits `app-data-view.whenSettled()`, verifies matching viewport width, and delegates restoration to `previewEl.restorePosition(tableRegion)`.
- A router-requested heading focus uses `app-data-view.focusHeading(signal)`, which delegates to `app-dataset-preview.focusHeading(signal)` in preview mode. Each owner awaits only its own Lit render, checks cancellation/connection and focuses its own h1 with `preventScroll: true`. This is independent of metadata/row readiness, `whenSettled()` and column-header focus. Later loading/ready/error updates do not request focus again.
- Selecting a column opens `<app-column-details>` without stealing document scroll. Closing the inspector restores focus to the column header.
