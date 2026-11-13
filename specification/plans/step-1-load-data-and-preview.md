# Step 1: Load Data & Dataset Preview

**Status:** stub | **Updated:** 2026-11-12T15:03:46Z

## Summary

User-facing implementation of Step 1 (`/data`) as specified in [workflow-steps.md §1](../workflow-steps.md). This view enables users to browse built-in sample datasets, view dataset cards/datasheets, upload custom CSV files, preview dataset rows in a virtualised grid, and inspect column distributions.

## Scope & Key Requirements

- **Presentational Dataset Card (`<app-dataset-card>`):**
    - Implement custom element adhering strictly to [specification/components/card.md](../components/card.md).
    - Attributes/Properties: `name`, `description`, `columns`, `rows`.
    - Events: `app-dataset-datasheet-open`, `app-dataset-select`.
    - Visual styling via shared `cardStyles` (`src/styles/card.styles.ts`).
- **Dataset Selection View (`01-1_select-data.html`):**
    - Mount on route `/data` when `$appState.data.mode === 'select'` (or when no dataset is loaded).
    - Page header with title, descriptive copy, and "Upload Dataset" button.
    - Responsive cards grid rendering an `<app-dataset-card>` for each sample in `src/config/datasets.ts`.
- **Datasheet Modal (`01-2_dataset-card.html`):**
    - Transient dialog opened by `app-dataset-datasheet-open`.
    - Displays title, description, detailed metadata, attributes, and source link.
- **Upload Custom Dataset Modal (`01-3_upload-dataset.html`):**
    - Opened via the header "Upload Dataset" button.
    - Dropzone for drag-and-drop CSV upload and native file picker (`input[type="file"][accept=".csv,text/csv"]`).
    - Text input for remote CSV URL fetching.
    - Dispatches ingestion request to the data storage worker.
- **Dataset Preview View (`01-4_preview-dataset.html`):**
    - Automatically activates when `$appState.dataset !== null` and mode is `'preview'`.
    - Page header: `<h1>Preview Dataset: {name}</h1>`, row/column count subheadings, and "Delete Dataset" / "Change Dataset" button.
    - Virtualised table (`<ui-virtual-table>` matching [specification/components/virtual-table.md](../components/virtual-table.md)) rendering windowed row chunks from IndexedDB with fixed headers and dynamic scrolling.
- **Column Statistics Inspector (`<aside>`):**
    - Interactive side panel triggered by selecting a column header in the preview table.
    - Shows Column Name, Column Type, and Missing Record count.
    - For numeric columns: min, median, mean, max, and a bar chart histogram.
    - For categorical columns: value and frequency list.
- **State Integration:**
    - Update `$appState.dataset` upon successful load.
    - Toggle `$appState.data.mode` between `'select'` and `'preview'`.
    - Update sidebar Step 1 chiclets (`{rows} rows`, `{cols} columns`) and project context.

## References & Required Reading for Full Draft

- `specification/workflow-steps.md §1`
- `specification/mockups/ui-scaffold/01-1_select-data.html`
- `specification/mockups/ui-scaffold/01-2_dataset-card.html`
- `specification/mockups/ui-scaffold/01-3_upload-dataset.html`
- `specification/mockups/ui-scaffold/01-4_preview-dataset.html`
- `specification/components/card.md`
- `specification/components/virtual-table.md`
- `specification/preview-dataset.md`
- `specification/TODO.md` (TODO-10, TODO-12, TODO-13, TODO-30, TODO-31, TODO-32)
