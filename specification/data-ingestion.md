# Specification: Data Ingestion & Storage Pipeline

**Status:** target — not implemented. `src/stores/reconciler.ts` already creates `samata-db` with out-of-line keys that differ from §4 ([Known gap](README.md#known-gaps) 14).

## 1. Summary

This specification defines the architecture and implementation requirements for the data ingestion, statistical analysis, and storage layer of the browser-based machine learning application. The pipeline is responsible for fetching CSV files (via local upload or URL), streaming the parsing process, calculating column statistics via a two-pass algorithm, storing the raw records in IndexedDB, and exposing the data to the ML engine via the `IndexedDBDatasetProvider`.

## 2. Engineering Standards & Constraints

- **Language & Runtime:** Vanilla TypeScript (strict mode). No front-end frameworks (e.g., React) may be imported into the worker or storage layers.
- **Documentation:** All exported types, interfaces, and functions MUST include strict TSDoc inline documentation.
- **Execution Context:** All heavy I/O (fetching, parsing) and computations (type inference, statistical passes) MUST execute within a Dedicated WebWorker to prevent main-thread blocking.
- **Dependencies:**
- `idb` (by Jake Archibald) for Promise-based IndexedDB interactions.
- `papaparse` for robust, chunked CSV parsing.

## 3. Data Structures & Interfaces

The coding agent MUST implement the following core interfaces to ensure explicit type safety across the worker boundary.

```typescript
type ColumnType = 'numeric' | 'categorical' | 'text' | 'unknown';

interface BaseColumnStats {
	name: string;
	type: ColumnType;
	missingCount: number;
}

interface NumericColumnStats extends BaseColumnStats {
	type: 'numeric';
	min: number;
	max: number;
	mean: number;
	median: number;
	/** Array of length up to 100 representing histogram bin counts */
	histogram: number[];
}

interface CategoricalColumnStats extends BaseColumnStats {
	type: 'categorical';
	/** Map of unique string categories to their occurrence counts */
	categoryCounts: Record<string, number>;
}

type ColumnStats = NumericColumnStats | CategoricalColumnStats | BaseColumnStats;

interface DatasetMetadata {
	id: string;
	rowCount: number;
	columns: ColumnStats[];
}
```

## 4. IndexedDB Schema

The worker MUST initialize an IndexedDB database using the `idb` library with the following structure:

- **Database Name:** `samata-db`
- **Object Store 1:** `metadata`
- **Key Path:** `id` (string UUID)
- **Purpose:** Stores the `DatasetMetadata` object for each ingested dataset.

- **Object Store 2:** `raw_records`
- **Key Path:** `[datasetId, rowIndex]` (Compound key)
- **Purpose:** Stores the individual parsed rows.

## 5. Procedural Pipeline Requirements

The ingestion pipeline MUST follow a strictly procedural, two-pass execution model to minimize memory overhead.

### Pass 1: Streaming Ingestion & Basic Stats

1. **Source Resolution:**

- If the source is a URL, fetch the file using a silent exponential backoff retry wrapper (up to 3 attempts) for 5xx/network errors. Abort immediately on 4xx errors.
- If the source is a `File` object, read directly.

2. **Chunked Parsing:** Stream the file through PapaParse in chunks (e.g., 5MB blocks).
3. **Error Handling:** Configure PapaParse to gracefully skip malformed rows, incrementing a skipped-row counter rather than aborting the stream.
4. **On-the-Fly Aggregation:** As chunks are processed:

- Write valid row objects to the `raw_records` IndexedDB store in transactional batches.
- Infer column types based on the first 1,000 non-null values.
- Accumulate `missingCount`.
- For numeric columns, track running `min`, `max`, and a rolling `mean`.
- For categorical columns, track running totals in a `Map` or dictionary.

### Pass 2: Complex Stats (Median & Histogram)

Because true medians and bounded histograms cannot be calculated accurately on a single streaming pass without keeping all data in memory, a second pass is required.

1. Once Pass 1 completes and all records are flushed to IndexedDB, query the DB for the final `min` and `max` established for each numeric column.
2. Calculate the boundaries for up to 100 uniform histogram bins per numeric column.
3. Open a read-only IndexedDB cursor on the `raw_records` store for the target dataset.
4. Iterate over the dataset via the cursor:

- Allocate numeric values into their respective histogram bins.
- Push numeric values into a temporary array (or sort them procedurally in batches) to determine the exact `median`.

5. Write the finalized `DatasetMetadata` object to the `metadata` store.

## 6. DatasetProvider Implementation

The agent MUST implement `IndexedDBDatasetProvider` to satisfy the unified dataset abstraction required by the ML orchestrator. This provider acts as the bridge between the IndexedDB storage layer and the math compute layer.

- **Buffer Mapping:** It MUST NOT allocate intermediate `Float64Array` buffers for every batch. It MUST accept an externally allocated `Float64Array` view (backed by a `SharedArrayBuffer` from the Orchestrator) and populate it directly via `datasetProvider.load(features, targets)`.
- **Preprocessing:** It MUST accept a `preprocessing` pipeline array in its constructor (e.g., imputing missing means, applying one-hot encoding). These transformations MUST be applied in real-time as records are streamed out of IndexedDB, prior to setting the numerical values into the `Float64Array`.
- **Cursor Streaming:** Data MUST be pulled from IndexedDB using cursors or paginated `getAll` bounds to prevent main-thread out-of-memory errors when hydrating large buffers.

## 7. Acceptance Criteria (DoD)

- **DATA-AC-1:** The WebWorker successfully fetches a CSV from a URL, automatically retrying on transient network failures, and streams the parsing using PapaParse.
- **DATA-AC-2:** Malformed rows are skipped and logged to a skipped-counter without crashing the parser or terminating the ingestion.
- **DATA-AC-3:** Column types are correctly inferred, and Pass 1 successfully writes all valid records to the `raw_records` IndexedDB store in batches.
- **DATA-AC-4:** Pass 2 successfully calculates a 100-bin histogram and median for numeric columns using a cursor-based iteration of IndexedDB, writing the final result to the `metadata` store.
- **DATA-AC-5:** `IndexedDBDatasetProvider` implements the `DatasetProvider` interface, successfully streaming records from IDB, applying requested preprocessing rules, and writing the final numeric matrices directly into the provided `Float64Array` view without intermediate allocations.
