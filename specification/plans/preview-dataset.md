# Uploaded Dataset Preview Design

## Goal

After a successful upload, the Select Data step should immediately switch from upload controls to a scrollable table preview of the uploaded dataset. That preview must also survive page reloads until the user moves on to model selection.

## High-Level Flow

1. the user uploads a CSV file or selects a remote dataset URL
2. `CSVStreamer` parses the CSV incrementally with PapaParse
3. each row chunk is written to IndexedDB through the storage worker
4. metadata and inferred schema are updated as the stream progresses
5. upload success marks `Pipeline.state.datasetId` as non-null
6. `SelectDataView` switches into preview mode
7. the preview model loads metadata and fetches row chunks on demand for the visible viewport

## Storage Model

The current implementation uses a single active dataset:

- a new upload clears the old `dataset` and `metadata` stores
- rows are stored with explicit `rowIndex` keys
- metadata is stored under the fixed key `dataset_stats`

This design keeps the storage layer simple while still supporting reload-safe preview rendering.

## Persisted Metadata

The preview depends on stored metadata rather than reparsing the dataset:

- `totalRows`
- ordered `columns`
- inferred `schema`
- simple summary fields already tracked during streaming

The schema uses:

- `text`
- `integer`
- `float`
- `boolean`

Date and datetime inference are intentionally deferred and currently fall back to `text`.

## Schema Inference Rules

During streaming, each observed value can widen a column type:

- all integers stays `integer`
- any decimal number widens numeric columns to `float`
- pure booleans stay `boolean`
- mixed incompatible values fall back to `text`

This keeps inference predictable and cheap during upload.

## View-Switch Rule

The Select Data step shows the preview only when:

```ts
Pipeline.state.datasetId !== null && Pipeline.state.modelType === null
```

That rule captures the intended UX:

- uploaded but not yet moved on: show preview
- no dataset yet: show upload controls
- model selection already started: do not force the old preview state

## Virtualized Row Loading

The preview does not read the entire dataset into memory.

Instead it uses:

- `rowCount` from stored metadata
- `rowAt(index)` to resolve rows from an in-memory cache
- `onWindowChange(startIndex, endIndex)` from the table component to request row chunks near the viewport

The preview model keeps:

- loaded chunk indexes
- in-flight chunk indexes
- a row cache keyed by absolute row index

Distant chunks are evicted so memory stays bounded.

## Table Rendering Design

The table uses virtualization because datasets may contain very large numbers of rows.

Important design choices:

- sticky headers remain visible while rows scroll
- only visible rows plus overscan are mounted
- the body uses a real positioned height rail so the browser has a concrete scroll area
- missing not-yet-loaded rows render as empty placeholders rather than crashing the table

## Why a Worker-Based Storage Layer?

IndexedDB access is routed through a dedicated worker proxy so the main thread stays focused on UI work and the storage protocol remains centralized.

That separation also makes it easier to evolve storage behavior without pushing IndexedDB details directly into views.
