# Data Ingestion & Storage Pipeline

**Status:** draft | **Updated:** 2026-11-13T11:17:32Z

## Goal

**Current behaviour:** No dataset can be loaded. There is no worker, CSV parser integration or row storage. `scripts/build-assets.ts:38-42` adds `src/models/storage/storageWorker.ts` as a build entrypoint only if it exists (it does not). `src/stores/reconciler.ts:31-104` (`createDefaultIndexedDBAdapter`) opens `samata-db` v1 with **out-of-line** stores (no key paths), which do not match [data-ingestion §4](../data-ingestion.md). `src/app.ts` calls `reconcileStartupState()` with no IndexedDB adapter, so reconciliation checks 1, 2 and 4 never run in the browser. `src/config/datasets.ts` has wrong shapes (Iris's URL sits in `description`, a trailing `{}` entry, Penguins claims 5 columns but has 9) and points at third-party gists that the production CSP (`connect-src 'self'` in `public/_headers`) would block. Two unstructured notes, [sample-dataset-specification.md](../notes/sample-dataset-specification.md) and [data-type-inference.md](../notes/data-type-inference.md), propose a dataset descriptor schema and type-inference rules. Both are in the notes inbox, `specification/notes/`.

**Target behaviour:**

- **Worker:** a dedicated module worker (`/storage.worker.js`) ingests either a bundled sample dataset (by id) or a user `File`, up to 200 MB.
- **Inference:** it streams the CSV through PapaParse and infers each column's type over **every row**: `boolean`, `datetime`, `numeric`, `categorical` or `text`, using the precedence and tolerance rules from the type-inference notes, revised in this plan.
- **Storage:** it stores rows losslessly, then rewrites them as typed values once the types are final.
- **Statistics:** it computes exact statistics, including exact medians with bounded memory and histograms for integer and float columns, then writes `DatasetMetadata`.
- **Main thread:** it gets a typed client and a `loadDataset()` service that activates the new dataset and only then deletes the old one.
- **Sample catalogue:** each sample dataset is authored as a typed descriptor (`content/datasets/{id}/descriptor.ts`) plus `datasheet.md` and `data.csv`. The build validates it against the CSV using the same profiling code, computes its statistics and emits a same-origin manifest, so cards render without fetching any CSV. The descriptor's column types, missing-value tokens and implicit missing values steer ingestion.
- **Training:** `IndexedDBDatasetProvider` streams one dataset straight into caller-supplied `Float64Array` views for `web-ml`.

**Why:** Every later workflow step depends on a stored, profiled dataset. The sample catalogue also gives the target and feature steps the leakage, identifier and sensitivity information they need. This plan is the non-UI foundation that [step-1-load-data-and-preview](step-1-load-data-and-preview.md) builds on.

## Scope

**In scope**

- `datetime` added to the canonical `ColumnType`, with one shared "can be a target or feature" predicate used by the store and reconciler.
- New dev dependencies: `fake-indexeddb` (unit tests) and `@types/papaparse` (strict typecheck).
- Shared types: `src/types/dataset.ts` (ingested data) and `src/types/sample-dataset.ts` (descriptors and manifest). The `samata-db` v2 schema module (`src/common/storage/db.ts`).
- Cell detectors, the column profiler and type election, PapaParse streaming, the multi-pass pipeline, the worker, the message protocol, the main-thread client, and the `loadDataset()` service.
- Storage-quota pre-check and a Web Lock (`samata-ml:ingestion`) held during ingestion.
- Sample catalogue: descriptor types, the build-time generator (validation, computed statistics, manifest, datasheet HTML, CSV copy), and Penguins and Iris content.
- Reconciler adapter on the real schema, wired into `bootstrapApp`.
- `IndexedDBDatasetProvider` with impute and one-hot preprocessing.
- Build: worker entrypoint, output naming, generator hook.
- Playwright test of the real worker and IndexedDB.
- Turning the two notes files into a proper spec, and aligning `data-ingestion.md`, `state-and-storage.md`, `workflow-steps.md`, `ARCHITECTURE.md`, `TODO.md` and _Known gaps_.

**Out of scope**

- All UI: catalogue cards, filters, datasheet dialog, upload modal, progress, error copy, preview table, column `<aside>`, leaky-column auto-unticking (step 1, step 2 and step 3 plans). This plan supplies data, codes and descriptors only.
- Further sample datasets (Titanic, COMPAS, Adult, German Credit, Pima, Bank, Wine, Breast Cancer; TODO-42). The generator's validation rules are designed for the pitfalls the notes list, but curating those datasets (files, licences, datasheets) is a separate content plan.
- User-edited column metadata (sample-dataset notes §6; FUTURE).
- Paste-URL ingestion of arbitrary remote CSVs (removed per state-and-storage §10 #7; see Risks).
- The ML orchestrator, `SharedArrayBuffer`, dev-server COOP/COEP (TODO-33, TODO-50); `model_results` contents (TODO-21); content-hash dataset identity (TODO-22); service-worker caching; localisation of descriptor prose (TODO-46).
- Datetime as a model input (feature engineering). Datetime columns are profiled but not eligible as target or feature.

**Constraints and invariants**

- Worker, storage, profiler and provider code is framework-free TypeScript: no Lit, no nanostores (ARCHITECTURE "Language"). Only `load-dataset.ts` imports `src/stores/app.store.ts`.
- Components never import workers or IndexedDB (COMPONENTS §5). No components are added.
- All heavy work (fetch, parse, inference, every pass) runs in the worker. The build-time generator runs in Bun and reuses the same pure profiler, so build-time and runtime statistics cannot drift.
- Ingestion writes under a **new** `datasetId`. The previous dataset is deleted only after the new metadata is written **and** `$appState` points at it (state-and-storage §6). A failed or cancelled run leaves the previous dataset and `$appState` untouched and deletes its own partial rows.
- Readers never see a half-ingested dataset: `getRows` and the provider return nothing for an id without `metadata`, and metadata is written last.
- `localStorage` never holds rows or statistics; only `DatasetSummary` reaches `$appState`.
- The `IndexedDBAdapter` interface (`src/stores/reconciler.ts:19-26`) keeps its signature; existing tests in `tests/state-and-storage.test.ts` pass unchanged.
- Exported TypeScript has TSDoc. British English in prose and comments. Error `message` strings are English developer messages, not UI copy.
- Baseline Widely available only: module workers, IndexedDB, Web Locks, `crypto.randomUUID`, `ReadableStream` bodies, `StorageManager.estimate()` and typed-array `sort` all qualify. `Temporal` does **not** (Safari lacks it), and neither `Date.parse` nor `new Date(string)` may be used for detection.
- Privacy: data never leaves the browser; every fetch is same-origin.

## Required reading

The implementer reads only these, plus each task's likely files. Everything else is optional.

- This plan's _Technical decisions_, _Review of the input notes_ and _Interfaces and behaviour_: the contract. Where the notes, `data-ingestion.md` or `preview-dataset.md` differ, this plan wins; T13 updates the specs.
- `specification/data-ingestion.md` §7: DATA-AC-1 to DATA-AC-5 (still the acceptance targets).
- `specification/state-and-storage.md` §2 (storage split), §6 (reconciliation checks 1–4 and the ingestion ordering requirement), §7 (multi-tab).
- `src/types/state.ts` lines 15-39: `ColumnType`, `ColumnSummary`, `DatasetSummary`.
- `src/stores/app.store.ts` lines 63-140: `loadDatasetSucceeded`, `setTarget`.
- `src/stores/reconciler.ts` lines 15-104 and 140-245: the adapter, checks 1–4 (T1, T10).
- `scripts/build-assets.ts` lines 26-125 and `scripts/generate-pages.ts` lines 1-70 (T8: the build hook and the existing `marked` pattern).
- `../web-ml/src/training/types.ts` lines 78-98: `DatasetProvider` (T11). Read-only; import as `import type { DatasetProvider } from 'web-ml'`.
- `tests/setup.ts`: global happy-dom and the Web Locks mock.
- `node_modules/fake-indexeddb/README.md` § "Usage" (T2): non-global `IDBFactory` / `IDBKeyRange`.

## Codebase context

Facts the planner verified, so the implementer need not re-check them.

- **Relevant implementation:** `src/stores/reconciler.ts` — startup reconciliation; `createDefaultIndexedDBAdapter` is unused and has the wrong schema. `src/app.ts:182` calls `reconcileStartupState()` without an adapter. `src/stores/app.store.ts:131` (`setTarget`) and `src/stores/reconciler.ts:217,235` test eligibility as `type !== 'text'`; adding `datetime` makes these wrong, so T1 replaces them with one predicate. `loadDatasetSucceeded` resets target and models whenever the id differs; that is intended, because every ingestion gets a new UUID.
- **Generated code:** `src/generated/` is git-ignored and nothing in `src/` imports it, so a fresh clone typechecks without running a generator. The sample catalogue therefore ships as **runtime-fetched JSON** in the build output, not as generated TypeScript, and the authored `descriptor.ts` files are ordinary source that `tsc` checks (`tsconfig.json` has no `include`, so all `.ts` files in the repo are checked).
- **Build and dev server:** `buildDevBundle` / `buildProductionBundle` reset the output directory, copy `public/`, then call `buildBrowserAssets`. `scripts/server.ts:296` watches `content/` and rebuilds, so a generator called from `build-assets.ts` runs on both. `generate-pages.ts` already compiles Markdown with `marked`.
- **Dependencies:** `idb@8.0.4` and `papaparse@5.7.0` are installed. `@types/papaparse` is not (strict `tsc` would fail with TS7016). `fake-indexeddb@6.2.6` is only present transitively via `web-ml`. Comlink is not installed or needed.
- **PapaParse in a worker:** it installs its own `onmessage` only when `IS_PAPA_WORKER` is set (`node_modules/papaparse/papaparse.js:55-90`), so it is safe inside our worker with `worker: false`. File input uses async `FileReader`. `parser.pause()` and `resume()` exist (lines 1062-1072). Papa implements RFC 4180 quoting, `""` unescaping, `\n`/`\r\n` detection and delimiter guessing (`delimitersToGuess`); it does **not** report whether a field was quoted.
- **`web-ml`:** exports `type DatasetProvider`. Its own `IndexedDBDatasetProvider` can't select one `datasetId`, can't page a compound key, accepts only numbers and implements only constant imputation, so it is not reusable. `PreprocessingStep` is not exported.
- **Sample data (fetched 2026-11-12):** Penguins gist: header `rowid,species,island,bill_length_mm,bill_depth_mm,flipper_length_mm,body_mass_g,sex,year`, 344 rows, missing values as `NA`, SHA-256 `b89bdaaa7099d701de8d7e9d8901b73948d49d214219056365d2e8a1f0406254`. Iris gist: header `sepal_length,sepal_width,petal_length,petal_width,species`, 150 rows, SHA-256 `c52742e50315a99f956a383faedf7575552675f6409ef0f9a47076dd08479930`. URLs are in the current `src/config/datasets.ts`. Nothing imports that file.
- **Delivery constraints:** `public/_headers`: `connect-src 'self'`, `worker-src 'self'`, COEP `require-corp`, CORP `same-origin`. Same-origin worker and fetches satisfy them.
- **Tests and commands (baseline 2026-11-13):** `bun run check` passes (0 type errors, **52 pass, 0 fail**, 6 files). `bun run build` passes. Known gap 12 in `specification/README.md` still says the build fails; that is stale. `bun run plans:check` fails only on the two notes files. `bun run test:e2e` runs Playwright (`*.e2e.ts`, server at https://localhost:3000); `bun test` ignores `*.e2e.ts`. Whether Playwright browsers are installed is unverified.
- **Web guidance:** No guide covers workers, IndexedDB, Web Locks, fetch streaming, UUIDs or storage quota (searched). `security` §3.2/§3.6: keep everything same-origin rather than widening `connect-src`. `capture-location-agnostic-data`: Temporal is "Limited availability" (Safari unsupported), so dates are parsed with explicit regexes and `Date.UTC`. A date without a zone is stored as epoch milliseconds at UTC as a deliberate, documented convention, and must be **displayed with `timeZone: 'UTC'`**: the guide warns that a plain date read back in a zone west of UTC "yields `"31/12/1989"`". Step-1 inherits that display rule. Implementers need not search again.
- **Visual reference:** None (no UI).
- **Lit skills:** None.
- **Known gaps decided:** **1** (layout): data feature code in `src/features/data/`, shared storage in `src/common/storage/`, types in `src/types/`. **4** (content location): sample datasets live in `content/datasets/{id}/`, next to the existing `content/pages` and `content/models`; locales are deferred with TODO-46. **6** (Comlink): not used by the storage worker. **9** (column types): one canonical vocabulary, `numeric | categorical | boolean | datetime | text`, everywhere, including the worker, descriptors and state. The notes' PascalCase `InferredColumnType` and `Timestamp` are not adopted (see Review). **12**: stale; T8 makes the worker a real entrypoint.
- **TODO items decided by this plan (approval answers them):** TODO-12 (datasheet source: a Markdown file per dataset), TODO-23 (descriptor shape, D10), TODO-24 (Web Locks is Baseline Widely available since 2022), TODO-47 (ingestion and descriptor vocabularies; `preview-dataset.md` stays under TODO-48), TODO-49 (D6), and the non-UI parts of TODO-09 (D3, D11, D12). Partly informs TODO-06 (descriptors mark identifiers and leaky columns) and TODO-11 (eligibility predicate, identifier hints). Left open: TODO-21, TODO-22, TODO-33, TODO-42, TODO-45, TODO-46, TODO-50.
- **Assumptions requiring verification:** (a) `Papa.parse(string, { chunkSize, chunk })` calls `chunk` with `pause`/`resume` under `bun test`. T5 checks this first; if it fails, unit tests use string input only and `Blob` input is covered by T12. (b) `fake-indexeddb` supports compound key paths and array `IDBKeyRange`s (T2 proves it). (c) Bun can `await import()` a `content/datasets/*/descriptor.ts` file from the generator (T8 proves it).

## Technical decisions

| Decision                                                                    | Chosen approach and rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Rejected alternative / trade-off                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 File layout                                                              | `src/types/dataset.ts`, `src/types/sample-dataset.ts`; `src/common/storage/{db,cells,profiler,indexeddb-dataset-provider}.ts` (shared by worker, generator, provider and reconciler); `src/features/data/ingestion/{limits,fetch-source,csv-stream,pipeline,order-statistics,protocol,worker-handler,storage.worker,storage-client}.ts`; `src/features/data/{load-dataset,sample-datasets}.ts`; `scripts/generate-datasets.ts`; `content/datasets/{id}/{descriptor.ts,datasheet.md,data.csv}`. `src/config/datasets.ts` is deleted.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `src/models/storage/` (a generic directory that collides with the "models" step). `public/datasets/{id}/metadata.json` + `datasheet.md` as in the notes: ships source files to production and mixes authored and generated files (see Review R1).                                                                                                                         |
| D2 Row storage: lossless first, typed after                                 | Pass 1 stores `RawRecord.values` as `(string \| null)[]`: the trimmed cell, or `null` for a missing token. Once types are final, Pass 2 rewrites every row in place as typed `CellValue[]` (number, boolean, string, epoch-ms number for datetime, `null`). Inference over **all** rows means a type is only known at end of file. Coercing during Pass 1 (as the notes' Phase B does) would destroy the original text of cells later needed if a column is demoted. `rowIndex` is contiguous from 0 over kept rows; key path `['datasetId', 'rowIndex']`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Typed cells in Pass 1: data loss on demotion (Review R9). Raw strings forever and coercion on every read: repeats the parsing cost for each preview page and each training load.                                                                                                                                                                                          |
| D3 Tokenising, headers, ragged rows                                         | PapaParse with `header: false`, `skipEmptyLines: 'greedy'`, `delimiter: ''`, `delimitersToGuess: [',', '\t', ';', '\|']`, `dynamicTyping: false`; UTF-8 only; BOM stripped from the first header cell. Every cell is trimmed: Papa cannot tell quoted from unquoted fields, so the notes' "preserve whitespace inside quotes" is not implemented (recorded deviation). Headers: trim; empty → `column_{i}` (0-based); duplicates → `_{n}` from 1, repeating until unique (so `id, id, id_1` → `id, id_2, id_1`, not two `id_1`s). Header row is required. Rows **shorter** than the header are padded with `null` and counted (`paddedRowCount`). Rows **longer** than the header, and rows Papa flags with a quote error, are **skipped** and counted, keeping up to 10 row numbers (1-based data rows). Truncating long rows would silently misalign columns, so this is the one place the notes are overruled to keep DATA-AC-2.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Truncating overflow (notes §1.5): silently shifts values into the wrong columns. Skipping short rows: loses rows from exporters that drop trailing empty cells.                                                                                                                                                                                                           |
| D4 Missing values and type inference over all rows                          | See _Interfaces_ → "Type inference" for the exact algorithm. Summary: (1) **Missing**: the trimmed, lower-cased cell is in the sentinel set (`''`, `null`, `nan`, `na`, `n/a`, `none`, `nil`, `-`, `?`), or a sample descriptor's `missingValueTokens` (which **replace** the default set; `''` always applies), or a descriptor's `implicitMissingValues` for that column. (2) **Cheap detectors run on every non-missing cell of the whole file**: boolean lexicons (5 pairs), numeric with optional affix, and a capped distinct-value map (500). **Datetime** detection is costly, so it is eliminated from a column once it can no longer reach 98 % (checked after 1,000 values, then every 50,000 rows). Timestamp detection runs only for columns whose header names a time. (3) **At end of file**, the type is the first in precedence `boolean → datetime → numeric → categorical → text` whose match rate over **all** non-missing cells is ≥ 98 %. Non-matching cells (≤ 2 %) become `null` and are counted as `invalidCount`, with up to 5 example values. (4) A sample descriptor's `dataType` overrides the elected type; the generator guarantees the override is feasible (D10).                                                                                                                                                                                                                                                                                 | First 1,000 rows only (earlier draft): misses late anomalies, as you pointed out. The notes' fixed 2,000-row warm-up plus mid-stream demotion: needs lossless storage anyway (D2), and once storage is lossless, whole-file counters make the warm-up unnecessary for the cheap detectors.                                                                                |
| D5 Statistics                                                               | Final statistics are computed in Pass 2 from coerced values, so they are exact: count, min, max, mean (incremental), integer flag, boolean counts, category counts (bounded, because categorical implies ≤ 250 distinct), and datetime min/max. Pass 1 keeps only inference counters plus a **superset range** (min/max of every cell that parsed as a number under any affix), which Pass 2 needs to size the median's fine histogram.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Statistics in Pass 1 before types are final: counts and ranges would include cells later rejected as invalid.                                                                                                                                                                                                                                                             |
| D6 Histograms (integers **and** floats) and exact medians (decides TODO-49) | **Display histogram**, for every numeric column, built in Pass 3 from the exact Pass-2 min and max: (a) integer-valued column with `max - min + 1 ≤ 100` → one bin per integer, `start = min - 0.5`, `width = 1`; (b) **every other column, floats included** → `target = min(100, max(1, ceil(sqrt(count))))`, `width = niceCeil((max - min) / target)`, where nice widths are {1, 2, 2.5, 5} × 10^k for floats and {1, 2, 5} × 10^k (minimum 1) for integers; `start = floor(min / width) × width`; `bins = max(1, ceil((max - start) / width))`, moving to the next nice width while `bins > 100`. A constant column gets 1 bin (`start = min - 0.5`, `width = 1`). Bin index = clamp(`floor((x - start) / width)`, 0, bins - 1). Nice widths give readable axis labels (0, 2.5, 5…) for learners. **Median**: exact, via bucket selection with bounded memory (_Interfaces_ → "Order statistics"). Pass 2 fills a 2,048-bin fine histogram (count, min and max per bin) over the superset range; this identifies the bin holding the median rank(s). If that bin's min equals its max, the median is known; otherwise Pass 3 collects only that bin's values, then sorts them. If a target bin holds more than `MEDIAN_COLLECT_LIMIT` values, Pass 3 sub-buckets it instead and repeats (at most 8 rounds). Memory ≤ 2,048 × 3 numbers per column plus at most 1 M collected values.                                                                                           | One `Float64Array` per numeric column (earlier draft): about 400 MB for a 200 MB file of short numbers, too much for a worker on a commodity laptop. Approximate medians (P², t-digest): the UI calls it "median". Freedman–Diaconis bins: need the IQR before binning, which costs an extra pass (noted as a later improvement).                                         |
| D7 Passes, batching and backpressure                                        | Pass 1: Papa `chunkSize = 1 MiB`; per chunk `parser.pause()`, write rows in **one** `readwrite` transaction, `await tx.done`, `parser.resume()`. Pass 2: batches of 5,000 rows, each in one `readwrite` transaction: `getAll(range, 5000)`, coerce, `put` each, update statistics. Pass 3 (only if numeric columns exist): read-only cursor for display histograms and median collection; extra rounds only for columns that still need them. Never `await` non-IndexedDB work inside an open transaction (auto-commit).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | One giant transaction for Pass 2: a huge undo journal on 200 MB. Per-row transactions: very slow.                                                                                                                                                                                                                                                                         |
| D8 Worker protocol and client                                               | Hand-written discriminated unions (_Interfaces_) correlated by `requestId`. `storage.worker.ts` only calls `installWorkerHandler(self)`; the logic lives in `worker-handler.ts`, so tests wire the client and handler in-process. One ingestion at a time (`BUSY` otherwise). `getRows` returns the stored typed values, and `[]` for an id without metadata. The client lazily creates `new Worker('/storage.worker.js', { type: 'module' })`. For sample ingestion the main thread sends only the sample id; the worker fetches the descriptor and CSV itself.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Comlink (new dependency, Known gap 6). Main-thread IndexedDB reads (preview-dataset wants storage centralised in the worker). Sending the descriptor from the main thread: duplicates the fetch logic in two contexts.                                                                                                                                                    |
| D9 Multi-tab safety and Web Locks (decides TODO-24)                         | The worker holds exclusive Web Lock `samata-ml:ingestion` for the whole run. Reconciliation check 2 runs inside `navigator.locks.request(INGESTION_LOCK, { ifAvailable: true }, …)`, skipping cleanup when the lock is held; if the API is missing, cleanup runs anyway.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | No lock: a second tab's startup deletes rows that are still being written.                                                                                                                                                                                                                                                                                                |
| D10 Sample dataset catalogue (decides TODO-12, TODO-23)                     | **Authoring:** `content/datasets/{id}/descriptor.ts` exports `default { … } satisfies AuthoredDatasetDescriptor`, so `tsc` validates every descriptor at compile time (the notes asked for "TypeScript compiler checks") and authors get autocomplete and comments. Alongside sit `datasheet.md` and a curated `data.csv` (UTF-8, comma-delimited, header row, header names already clean: the generator rejects a file whose headers would change under D3). Authored fields: the notes' schema, revised per _Review_ R2–R8. **Generated** (never authored): `stats` (row and column counts, size, SHA-256, missing flag, default-target distribution) and each column's `missingCount`. **Build:** `scripts/generate-datasets.ts` runs from `build-assets.ts` for both dev and production. It profiles each CSV with the same `profiler.ts`, validates (_Interfaces_ → "Generator validation", collecting every error and then failing the build), and writes `<out>/datasets/manifest.json`, `<out>/datasets/{id}/descriptor.json`, `<out>/datasets/{id}/datasheet.html` (compiled with `marked` from first-party Markdown) and `<out>/datasets/{id}/data.csv`. Descriptor URLs carry `?v={sha256 first 12 hex}` for cache-busting. **Runtime:** `sample-datasets.ts` exposes `loadSampleCatalogue()` (manifest) and `loadSampleDescriptor(id)`; cards need no CSV fetch. **First datasets:** `palmer-penguins` and `iris` (byte-identical to the gists; SHA-256 values above). | Hand-authored `stats` (notes §2): the notes' own pitfall table warns these drift. Generated TypeScript in `src/generated/`: imports from a git-ignored folder break `tsc` on a fresh clone. JSON descriptors with a JSON Schema validator: a new dependency and weaker editor support. Keeping `src/config/datasets.ts`: a third, hand-maintained copy of the same facts. |
| D11 Limits                                                                  | `limits.ts`: `MAX_FILE_BYTES = 200 * 1024 * 1024` (shown to users as "200 MB"), `MAX_COLUMNS = 200`, `PARSE_CHUNK_BYTES = 1 MiB`, `PASS_BATCH_ROWS = 5000`, `MAX_TRACKED_DISTINCT = 500`, `DATETIME_FIRST_CHECKPOINT = 1000`, `CHECKPOINT_ROWS = 50000`, `TYPE_MATCH_THRESHOLD = 0.98`, `HISTOGRAM_MAX_BINS = 100`, `FINE_BINS = 2048`, `MEDIAN_COLLECT_LIMIT = 1_000_000`, `MAX_SKIPPED_ROW_NUMBERS = 10`, `MAX_INVALID_EXAMPLES = 5`, `STORAGE_HEADROOM_FACTOR = 3`. Size is checked against `File.size` / `Content-Length` before reading, and against bytes received while downloading. **Quota pre-check:** when `navigator.storage?.estimate` exists, fail with `INSUFFICIENT_STORAGE` if `quota - usage < 3 × fileBytes` (raw rows, typed rewrite and per-record overhead).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 50 MB (earlier draft): superseded by your choice of 200 MB. No quota check: a 200 MB upload could fail with `QuotaExceededError` minutes into Pass 2.                                                                                                                                                                                                                     |
| D12 Errors and progress                                                     | `IngestionError { code, message, status?, details? }`. Codes: `NETWORK_ERROR`, `HTTP_ERROR` (`status`), `FILE_TOO_LARGE`, `TOO_MANY_COLUMNS`, `INSUFFICIENT_STORAGE`, `EMPTY_FILE`, `NO_DATA_ROWS`, `READ_FAILED`, `SAMPLE_NOT_FOUND`, `DESCRIPTOR_MISMATCH` (sample CSV header differs from its descriptor, e.g. a stale cache), `STORAGE_FAILED`, `CANCELLED`, `BUSY`, `UNKNOWN`. Progress `{ phase: 'download' \| 'parse' \| 'typing' \| 'statistics'; bytesProcessed; totalBytes \| null; rowsProcessed; totalRows \| null }`, at most every 100 ms plus each phase change. The UI maps codes to copy.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | UI strings from the worker (copy and i18n do not belong in storage).                                                                                                                                                                                                                                                                                                      |
| D13 Fetch retry                                                             | `fetchWithRetry(url, { signal, fetchImpl, sleep })`: at most 3 attempts; retry only on a network `TypeError` or 5xx; delays 500 ms then 1,000 ms; 4xx and other non-OK statuses fail immediately with `HTTP_ERROR`; abort → `CANCELLED`. URLs are resolved against `self.location.href`. The body is read via `getReader()`, counting bytes and enforcing the limit, then collected into a `Blob`. Used for the descriptor JSON and the sample CSV.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Papa's `download: true` (XHR, no retry, limit or abort).                                                                                                                                                                                                                                                                                                                  |
| D14 IndexedDB schema                                                        | `samata-db` version 2. If `oldVersion < 2`, delete any existing `metadata`, `raw_records` and `model_results` stores (v1 never held data), then create `metadata` (keyPath `id`), `raw_records` (keyPath `['datasetId', 'rowIndex']`) and `model_results` (keyPath `['datasetId', 'modelNum']`). Delete one dataset: `metadata.delete(id)` + `raw_records.delete(IDBKeyRange.bound([id, -Infinity], [id, Infinity]))`. Delete all but `keepId`: `upperBound([keepId, -Infinity], true)` and `lowerBound([keepId, Infinity], true)` ranges on `raw_records` and `model_results`, plus every other metadata key; `null` clears all three.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Patching v1 (out-of-line keys can't do range deletes). A store per dataset (schema change per upload).                                                                                                                                                                                                                                                                    |
| D15 Dataset provider                                                        | samata-ml's own `IndexedDBDatasetProvider implements DatasetProvider` (web-ml's cannot address one dataset in a compound-key store). `create()` validates columns and preprocessing; `load()` pages `getRows` and writes straight into the views. It allocates no `Float64Array`, and rows are already typed (D2), so there is no parsing. Steps: `impute` (`mean`, `median`, `mode`, `constant`) and `one-hot` (default categories: metadata keys sorted with `localeCompare`). Booleans → 0/1. A categorical target → its index in the sorted categories (`targetCategories`). `text` and `datetime` columns are rejected. A categorical feature needs a `one-hot` step. A missing value without `impute` rejects with `MISSING_VALUE`; rows are never dropped.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Reusing web-ml's provider (see above). Dropping incomplete rows: breaks the fixed `sampleCount` the orchestrator pre-allocates.                                                                                                                                                                                                                                           |
| D16 Build integration                                                       | `build-assets.ts`: unconditional entrypoint `src/features/data/ingestion/storage.worker.ts`, plus `naming: { entry: '[name].[ext]' }`, so outputs are `/app.js` and `/storage.worker.js` (not revved: `new Worker` needs a stable URL). It calls `generateSampleDatasets(outdir)` after copying `public/`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Revving the worker would make `app.js`'s hash depend on the worker's hash.                                                                                                                                                                                                                                                                                                |
| D17 Canonical `ColumnType` gains `datetime`                                 | `ColumnType = 'numeric' \| 'categorical' \| 'boolean' \| 'datetime' \| 'text'` in `src/types/state.ts`, with `MODEL_ELIGIBLE_COLUMN_TYPES = ['numeric', 'categorical', 'boolean']` and `isModelEligibleColumnType(type)`. `setTarget` and reconciler checks 3–4 use the predicate instead of `!== 'text'`. Adding a union member keeps existing persisted state valid, so `STORAGE_VERSION` is unchanged. `DatasetSummary` gains optional `sampleId?: string`, so later steps can look up the descriptor (leaky columns, display names).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Mapping datetime to `text` silently: hides real structure from learners, and the notes and descriptor schema both want `datetime`. Making datetime eligible now: needs feature engineering (year, month, weekday) that no spec defines.                                                                                                                                   |

### Review of the input notes

What I changed when folding [sample-dataset-specification.md](../notes/sample-dataset-specification.md) and [data-type-inference.md](../notes/data-type-inference.md) into this plan, and why. T13 writes the result up as `specification/sample-datasets.md` and `data-ingestion.md` §5, and deletes both notes from `specification/notes/`.

| #   | Note                                                                                                                | Problem                                                                                                                                                                                                                   | Change adopted                                                                                                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Samples: `/public/datasets/{id}/` with `metadata.json`, `datasheet.md`, `datasheet.html`, generated `manifest.json` | Mixes authored sources and build output in `public/`; ships Markdown and authoring JSON to production; JSON gets no type checking.                                                                                        | Author in `content/datasets/{id}/` (`descriptor.ts`, `datasheet.md`, `data.csv`); the build emits `manifest.json`, `descriptor.json`, `datasheet.html` and `data.csv` into the output (D10). `files` paths are dropped: the file names are fixed by convention.                                                                                         |
| R2  | Samples: interface named `DatasetMetadata`                                                                          | Collides with the ingestion-computed `DatasetMetadata` that `data-ingestion.md` already defines and IndexedDB stores.                                                                                                     | `AuthoredDatasetDescriptor` (source), `SampleDatasetDescriptor` (authored + generated), `SampleDatasetSummary` (manifest entry). `DatasetMetadata` stays the ingestion profile.                                                                                                                                                                         |
| R3  | Samples: hand-written `stats` and `columns[].missingCount`                                                          | The notes' own pitfall table says these drift.                                                                                                                                                                            | Generated by the build from the CSV with the runtime profiler; authors never write them.                                                                                                                                                                                                                                                                |
| R4  | Samples: `semanticRole: 'feature' \| 'target' \| 'identifier' \| 'sensitive' \| 'leaky'`                            | The roles are not mutually exclusive: `sex` is both a feature and sensitive. `target` duplicates `modeling`. Leakage depends on the target (`alive` leaks `survived` but not `pclass`), so it can't be a column property. | `role: 'feature' \| 'identifier'` plus `sensitive?: boolean`. Leakage lives only in `TargetCandidate.leakyColumns: { column, reason }[]`. `ethics.sensitiveColumns` is derived from the columns; only `ethicsWarnings` is authored.                                                                                                                     |
| R5  | Samples: `defaultSelected` and `exclusionReason` per column                                                         | Both depend on the chosen target (leakage) and are otherwise implied by `role`.                                                                                                                                           | Removed. A column is pre-selected unless `role === 'identifier'`, or it is leaky for the chosen target (reason taken from that `leakyColumns` entry), or its type is not model-eligible. Step 3 owns the UI.                                                                                                                                            |
| R6  | Samples: `parsing.delimiter`, `hasHeader`, `overrideHeaders`                                                        | Runtime header surgery for files we control adds untested code paths. `hasHeader: true` plus `overrideHeaders` is ambiguous (replace or prepend?).                                                                        | Bundled CSVs are **curated** to UTF-8, comma-delimited, with clean headers; curation steps are listed in `provenance.transformations` (Datasheets for Datasets practice). Only `missingValueTokens` remains.                                                                                                                                            |
| R7  | Samples: `positiveClass?: string \| number`; `license: string`; `yearPublished`                                     | Number-or-string labels mismatch the string category keys (`1` vs `"1"`). Free-text licences can't be checked. Attribution for CC BY is not captured.                                                                     | `positiveClass?: string` (matched against category strings). `license` must be an SPDX id from an allow-list (`CC0-1.0`, `CC-BY-4.0`, `PDDL-1.0`, `ODbL-1.0`); add `licenseUrl` and `attribution`, plus `retrievedAt` (ISO date) and `transformations: string[]`.                                                                                       |
| R8  | Samples: `taskType` and `defaultTargetDistribution`                                                                 | Can contradict the data (a "binary" target with 3 classes).                                                                                                                                                               | The generator checks each candidate's `taskType` against the profiled target: binary ⇒ exactly 2 categories and `positiveClass` is one of them; multiclass ⇒ ≥ 3 categories; regression ⇒ numeric. The distribution is generated.                                                                                                                       |
| R9  | Inference: Phase B emits `null` for invalid cells; Phase C demotes the type mid-stream                              | After demotion (e.g. numeric → categorical), the earlier invalid cells' text is already gone.                                                                                                                             | Lossless Pass-1 storage and a rewrite after final election (D2). Whole-file counters replace the warm-up for the cheap detectors (D4).                                                                                                                                                                                                                  |
| R10 | Inference: PascalCase `InferredColumnType` with separate `Timestamp`                                                | Introduces a sixth, differently cased vocabulary (Known gap 9 again).                                                                                                                                                     | Canonical lower-case `ColumnType` with `datetime`. Timestamp is a datetime **format** (`{ kind: 'epoch', unit }`), not a type.                                                                                                                                                                                                                          |
| R11 | Inference: timestamp header heuristic `/time\|ts\|epoch\|created\|updated\|_at$/i`                                  | Substring matching: `ts` matches `counts` and `posts`; `time` matches `overtime`. Ungated 10-digit detection turns IDs and phone numbers into dates.                                                                      | Header split into words (on `_`, `-`, space, `.` and camelCase boundaries). Timestamp detection runs only if a word is in {`time`, `timestamp`, `ts`, `epoch`, `created`, `updated`, `date`, `datetime`} or the header ends in `_at`. Values must be integers without leading zeros, within the window, and ≥ 98 % must share one digit length.         |
| R12 | Inference: ambiguous `DD/MM` vs `MM/DD` defaults to MDY                                                             | US-centric default for a British-English product.                                                                                                                                                                         | Default **DMY** when never disambiguated, recorded as `orderAssumed: true` so the UI can say so. **Please confirm.** Two-digit years: `00–49` → 2000s, `50–99` → 1900s. Named months: English only.                                                                                                                                                     |
| R13 | Inference: categorical rule `(U ≤ 50) OR (U ≤ 250 AND U/V ≤ 0.05)`                                                  | Too lenient on small files: 40 unique names in 45 rows counts as categorical.                                                                                                                                             | `(U ≤ 50 AND U ≤ V / 2) OR (U ≤ 250 AND U / V ≤ 0.05)`, with mean unique length ≤ 64 and no overflow.                                                                                                                                                                                                                                                   |
| R14 | Inference: default sentinels include `none`, `nil`, `-`                                                             | These can be real values (`none` as a category, `-` as a sign or placeholder).                                                                                                                                            | Kept as you specified, but made **visible**: `missingTokens` records per-token counts, so the UI can say "'none' was treated as missing in 12 cells". Sample descriptors can replace the set.                                                                                                                                                           |
| R15 | Inference: affix stripping ("consistent across the column")                                                         | Undefined consistency. Thousands separators vary with magnitude (`999` vs `1,000`). `%` meaning is ambiguous.                                                                                                             | Signature = (prefix ∈ {none, `$`, `€`, `£`}, suffix ∈ {none, `%`}). The dominant non-empty signature is locked; cells with no affix are also valid; cells with a different affix are invalid. Comma grouping must be well-formed (`^\d{1,3}(,\d{3})+`). `45%` is stored as `45`, with `format.suffix = '%'`. European decimal commas are not supported. |
| R16 | Inference: tokenizer spec (§1)                                                                                      | Re-specifies RFC 4180 scanning that PapaParse already implements.                                                                                                                                                         | Mapped to Papa options (D3). Not adopted: whitespace preservation inside quotes (Papa can't tell), truncation of long rows (D3), `column_{index}` dedupe collisions (fixed by repeating until unique).                                                                                                                                                  |
| R17 | Inference: identifier hint for unique text                                                                          | Good idea; applies equally to integer row ids (`rowid`).                                                                                                                                                                  | `identifierHint: true` on `text` columns with `U / V > 0.98` and no whitespace in the tracked values, and on integer `numeric` columns whose values are all distinct and strictly increasing by 1 (tracked cheaply). Hints only; uploads are never auto-excluded.                                                                                       |
| R18 | Samples §5: pitfall table                                                                                           | Correct and valuable; most items belong to the future datasets (TODO-42).                                                                                                                                                 | Encoded as generator checks (header byte-equality, computed counts, leaky and identifier references, `implicitMissingValues`, high-cardinality `text` never offered as a feature). The datasets themselves stay out of scope.                                                                                                                           |

### Interfaces and behaviour

**`src/types/state.ts` changes (T1):** `ColumnType` gains `'datetime'`; add the `MODEL_ELIGIBLE_COLUMN_TYPES` constant and `isModelEligibleColumnType(type: ColumnType): boolean`; `DatasetSummary` gains `sampleId?: string`.

**`src/types/dataset.ts`** (ingested data):

```ts
import type { ColumnType, DatasetSummary } from './state';

/** Pass-2 typed cell. Datetime cells are epoch milliseconds (UTC convention). */
export type CellValue = number | boolean | string | null;
export interface RawRecord {
	datasetId: string;
	rowIndex: number;
	values: CellValue[]; // (string | null)[] until Pass 2 rewrites it
}

interface BaseColumnStats {
	name: string;
	type: ColumnType;
	missingCount: number; // sentinel tokens + implicit missing values
	missingTokens: Record<string, number>; // per token, e.g. { na: 2, none: 12 }
	invalidCount: number; // non-missing cells that did not fit the type; stored as null
	invalidExamples: string[]; // up to 5 distinct raw values
}
export interface NumericColumnStats extends BaseColumnStats {
	type: 'numeric';
	count: number;
	min: number;
	max: number;
	mean: number;
	median: number;
	integer: boolean;
	identifierHint: boolean;
	format: { prefix: '' | '$' | '€' | '£'; suffix: '' | '%'; thousandsSeparator: boolean };
	histogram: { start: number; width: number; counts: number[] };
}
export interface CategoricalColumnStats extends BaseColumnStats {
	type: 'categorical';
	distinctCount: number;
	categoryCounts: Record<string, number>;
}
export interface BooleanColumnStats extends BaseColumnStats {
	type: 'boolean';
	trueCount: number;
	falseCount: number;
	lexicon: [string, string]; // [true token, false token] as written, e.g. ['yes', 'no']
}
export interface DatetimeColumnStats extends BaseColumnStats {
	type: 'datetime';
	count: number;
	min: number;
	max: number;
	format:
		| { kind: 'epoch'; unit: 's' | 'ms' | 'us' }
		| { kind: 'date'; order: 'ISO' | 'DMY' | 'MDY'; orderAssumed: boolean; hasTime: boolean };
}
export interface TextColumnStats extends BaseColumnStats {
	type: 'text';
	distinctCount: number | null; // null when over MAX_TRACKED_DISTINCT
	identifierHint: boolean;
}
export type ColumnStats =
	| NumericColumnStats
	| CategoricalColumnStats
	| BooleanColumnStats
	| DatetimeColumnStats
	| TextColumnStats;

export interface DatasetMetadata {
	id: string;
	name: string;
	source: 'sample' | 'upload';
	sampleId: string | null;
	rowCount: number;
	byteLength: number;
	createdAt: number;
	delimiter: string;
	columns: ColumnStats[];
	paddedRowCount: number;
	skippedRows: { count: number; rowNumbers: number[] };
}

/** summary.columns[i].missingCount = missingCount + invalidCount (the nulls actually stored). */
export function toDatasetSummary(meta: DatasetMetadata): DatasetSummary;
```

**Cell detectors (`src/common/storage/cells.ts`):** `normaliseMissing(raw, tokens, implicit)`; `matchBoolean(cell)` → lexicon index or −1 (pairs, case-insensitive: `true/false`, `t/f`, `yes/no`, `y/n`, `1/0`, where `1.0`/`0.0` count as `1`/`0`); `parseNumber(cell)` → `{ value, prefix, suffix, grouped } | null` with regex `^([+-]?)([$€£]?)([+-]?)(\d{1,3}(?:,\d{3})+|\d+)?(\.\d+)?([eE][+-]?\d+)?(%?)$` (at most one sign; at least one digit; leading-zero guard: reject an integer part of length > 1 starting with `0` when there is no `.`); `parseEpoch(cell)` → `{ ms, unit } | null` (10, 13 or 16 digits, no leading zero, within 1980-01-01 … 2050-01-01 UTC); `parseDate(cell)` → `{ y, m, d, h, mi, s, ms, offsetMin, form: 'iso' | 'numeric' | 'named', firstPart, secondPart } | null`, using the three regexes in the inference notes §3.3. Calendar validity is checked by round-tripping through `Date.UTC`; `Date.parse` is never used. `toEpochMs(parts, order)`; `coerceCell(raw, type, format)` → `CellValue`.

**Type inference (`src/common/storage/profiler.ts`):**

- **Per column, for every row:** count non-missing cells `V` and record missing tokens.
    - Boolean: matches per lexicon pair (5 counters) and whether `0`/`1` were each seen.
    - Numeric: matches per `(prefix, suffix)` signature (8 counters), the superset min/max, an all-integer flag, and whether integers are strictly increasing by 1.
    - Distinct values: `Map<string, number>` up to 500 entries, then an overflow flag (map cleared).
    - Timestamp: only if the header gate passes (R11), matches per digit length.
    - Datetime: while still active, matches per form, plus DMY-forcing (`firstPart > 12`) and MDY-forcing (`secondPart > 12`) counts. It stops when, at row 1,000 or any 50,000-row checkpoint, its mismatch ratio exceeds 2 %.
- **Election at end of file:**
    - `V = 0` → `text`.
    - **Boolean:** take the best lexicon's matches. If it is ≥ 98 % of `V` and, for the `1/0` pair only, `(sawZero && sawOne) || V >= 20`, the type is `boolean`.
    - **Datetime:** if epoch matches (dominant digit length) or date matches (one order: DMY if DMY-forcing > 0 and MDY-forcing = 0, MDY in the reverse case, the majority if both, DMY with `orderAssumed` if neither; cells contradicting the chosen order are invalid) are ≥ 98 %, the type is `datetime`.
    - **Numeric:** cells matching the dominant non-empty signature or no affix are ≥ 98 %.
    - **Categorical:** R13's rule.
    - **Otherwise:** `text`.
- **Overrides:** a sample descriptor's `dataType` replaces the elected type. Its format is still derived from the counters.

**Order statistics (`src/features/data/ingestion/order-statistics.ts`):**

- **Ranks:** for a numeric column with `count = n`, the target ranks are `lo = floor((n - 1) / 2)` and `hi = floor(n / 2)` (0-based); the median is `(value(lo) + value(hi)) / 2`.
- **`FineHistogram(min, max, bins = 2048)`:** `add(x)` keeps a count, min and max per bin. `locate(rank)` returns `{ bin, rankInBin }` from cumulative counts.
- **Resolution:** a rank is resolved when its bin's min equals its max. Otherwise the next pass either collects that bin's values (if its count is at most `MEDIAN_COLLECT_LIMIT`), or builds a new `FineHistogram` over the bin's `[min, max]` (if larger). Values are then sorted and the rank read off.
- **API:** pure functions that consume values pushed from any cursor loop, so they are unit-testable without IndexedDB.

**Pipeline (`runIngestion(source, { db, signal?, onProgress?, now?, uuid? })`):**

1. **Resolve the source.** A sample → fetch `/datasets/{id}/descriptor.json` (`SAMPLE_NOT_FOUND` on 404), derive the options (tokens, overrides, implicit missing values, expected header), then fetch `files.csv`. A file → the `File`.
2. **Check limits** (D11) and **storage quota**.
3. **New id:** `datasetId = uuid()`.
4. **Pass 1:** parse, normalise headers (a sample must equal its expected header, else `DESCRIPTOR_MISMATCH`), handle ragged rows, store raw values and profile.
5. **No data:** if zero rows were kept → `NO_DATA_ROWS`.
6. **Elect types.**
7. **Pass 2:** coerce, rewrite, final statistics and fine histograms.
8. **Pass 3 (and more if needed):** display histograms and medians.
9. **Write metadata.**

On failure or cancellation after step 3, delete the dataset (best effort) and rethrow. Cancellation is checked between chunks and batches, and every 1,000 cursor rows. The worker handler holds `INGESTION_LOCK` around the whole call.

**Protocol (`protocol.ts`):**

```ts
export type IngestSource = { kind: 'sample'; sampleId: string } | { kind: 'file'; file: File };
export type StorageRequest =
	| { requestId: number; type: 'ingest'; source: IngestSource }
	| { requestId: number; type: 'cancel'; targetRequestId: number }
	| { requestId: number; type: 'getMetadata'; datasetId: string }
	| { requestId: number; type: 'getRows'; datasetId: string; offset: number; limit: number }
	| { requestId: number; type: 'deleteDatasetsExcept'; keepId: string | null };
export type StorageResponse =
	| { requestId: number; type: 'progress'; progress: IngestionProgress }
	| { requestId: number; type: 'result'; value: unknown }
	| { requestId: number; type: 'error'; error: IngestionError };
```

The file name gives `name` (minus `/\.csv$/i`, or `Uploaded dataset`). A sample's `name` comes from its descriptor. `StorageClient`: `ingest(source, { signal?, onProgress? })` resolving to `DatasetMetadata`, `getMetadata(id)`, `fetchRows(id, offset, limit)`, `deleteDatasetsExcept(keepId)`, `dispose()`; `createStorageClient(port)`; `getStorageClient()` (lazy singleton). `loadDataset(source, opts)` resolves to `DatasetSummary`. It ingests, calls `loadDatasetSucceeded(toDatasetSummary(meta))` (which carries `sampleId`), then `deleteDatasetsExcept(meta.id)`, only warning if that delete fails. On error it rethrows without touching `$appState`.

**`src/types/sample-dataset.ts`** (descriptors):

```ts
import type { ColumnType } from './state';
export type TaskType = 'binary-classification' | 'multiclass-classification' | 'regression';
export type DatasetDomain =
	| 'biology'
	| 'healthcare'
	| 'finance'
	| 'criminal-justice'
	| 'social-science'
	| 'marketing';
export type SpdxLicense = 'CC0-1.0' | 'CC-BY-4.0' | 'PDDL-1.0' | 'ODbL-1.0';
export interface AuthoredColumn {
	name: string;
	displayName: string;
	description: string;
	dataType: ColumnType;
	role: 'feature' | 'identifier';
	sensitive?: boolean;
	unit?: string;
	implicitMissingValues?: (string | number)[];
	valueLabels?: Record<string, string>;
}
export interface TargetCandidate {
	column: string;
	taskType: TaskType;
	positiveClass?: string;
	description: string;
	leakyColumns?: { column: string; reason: string }[];
}
export interface DatasetReference {
	title: string;
	authors?: string[];
	year?: number;
	type: 'seminal-paper' | 'fairness-audit' | 'article' | 'documentation';
	url: string;
	citation?: string;
}
export interface AuthoredDatasetDescriptor {
	id: string;
	name: string;
	tagline: string;
	description: string;
	domain: DatasetDomain;
	difficulty: 'beginner' | 'intermediate' | 'advanced';
	tags: string[];
	missingValueTokens?: string[];
	modeling: { defaultTarget: string; targetCandidates: TargetCandidate[] };
	columns: AuthoredColumn[];
	provenance: {
		homepageUrl: string;
		sourceRepositoryUrl: string;
		retrievedAt: string;
		license: SpdxLicense;
		licenseUrl: string;
		attribution: string;
		yearPublished: number;
		creators: string[];
		transformations: string[];
	};
	references: DatasetReference[];
	ethicsWarnings?: string[];
}
export interface ComputedDatasetStats {
	rowCount: number;
	columnCount: number;
	fileSizeBytes: number;
	sha256: string;
	hasMissingValues: boolean;
	defaultTargetDistribution?: Record<string, number>;
}
export interface SampleDatasetDescriptor extends Omit<AuthoredDatasetDescriptor, 'columns'> {
	columns: (AuthoredColumn & { missingCount: number })[];
	stats: ComputedDatasetStats;
	files: { csv: string; datasheet: string }; // root-absolute, with ?v=
}
export interface SampleDatasetSummary {
	id: string;
	name: string;
	tagline: string;
	domain: DatasetDomain;
	difficulty: 'beginner' | 'intermediate' | 'advanced';
	tags: string[];
	taskTypes: TaskType[];
	license: SpdxLicense;
	stats: ComputedDatasetStats;
	descriptorUrl: string;
}
export interface SampleDatasetManifest {
	manifestVersion: 1;
	datasets: SampleDatasetSummary[];
}
```

The manifest is sorted by difficulty (beginner first), then `name` with `localeCompare(…, 'en-GB')`. The runtime loader rejects a manifest whose `manifestVersion !== 1`.

**Generator validation (`scripts/generate-datasets.ts`):** collect every error, then fail the build. Checks:

- `id` is kebab-case, equals the directory name and is unique.
- The CSV is valid UTF-8, its header is unchanged by D3 normalisation, and it equals `columns[].name` in order, byte for byte.
- No ragged or skipped rows (curated files must be clean).
- Each `dataType` is feasible against the profile: it equals the elected type, or is an allowed override (numeric or boolean → categorical; anything → text). An override must leave `invalidCount === 0`.
- `defaultTarget` is a `targetCandidates` entry; every referenced column exists; leaky columns are not the target; identifiers and non-eligible types are not targets; `taskType` matches the profile (R8).
- `valueLabels` keys exist among the column's categories.
- `implicitMissingValues` only on numeric or categorical columns.
- `license` is in the allow-list.
- `datasheet.md` exists and is non-empty.

## Specification changes

T13 applies these and ticks each one.

- [ ] `specification/data-ingestion.md` §3–§6 — §3 links `src/types/dataset.ts`; §4 states the `samata-db` v2 schema (D14); §5 states D2–D7, D11 and the full type-inference rules from _Interfaces and behaviour_, absorbing `data-type-inference.md`; §6 states D15; DATA-AC-1–5 stay; status target → implemented
- [ ] `specification/sample-datasets.md` (new) — descriptor schema, authoring layout, generator rules, R1–R8 and R18, absorbing `sample-dataset-specification.md`; status implemented
- [ ] `specification/state-and-storage.md` §3, §10 #4 — `ColumnType` includes `datetime`; `DatasetSummary` has `sampleId`; §10 #4 points at the canonical type
- [ ] `specification/workflow-steps.md` §1 — dataset cards come from the sample-dataset manifest and show `name`, `tagline`, `stats.rowCount` and `stats.columnCount`
- [ ] `specification/ARCHITECTURE.md` — the `/src/config/` line no longer lists datasets; `content/datasets/` is described
- [ ] `specification/TODO.md` — TODO-12 (datasheet part), TODO-23, TODO-24, TODO-47 and TODO-49 removed; TODO-09 reworded to its UI parts; TODO-42 points at `sample-datasets.md`
- [ ] `specification/README.md` — `sample-datasets.md` row added; `data-ingestion.md` row says implemented; `notes/sample-dataset-specification.md` and `notes/data-type-inference.md` deleted
- [ ] Known gap 4 — narrowed to the Markdown pages only (datasets decided)
- [ ] Known gap 6 — removed or narrowed, per what remains specified but not installed
- [ ] Known gap 9 — resolved (one canonical `ColumnType`)
- [ ] Known gap 14 — first bullet resolved (the reconciler uses the v2 schema and is wired into `bootstrapApp`)

## Implementation tasks

### T1 — Canonical `ColumnType` gains `datetime`; one eligibility predicate

- **Depends on:** None
- **Risk:** routine
- **Likely files:** `src/types/state.ts`, `src/stores/app.store.ts`, `src/stores/reconciler.ts`, `tests/column-eligibility.test.ts`
- **Must not touch:** `tests/state-and-storage.test.ts` — must pass unchanged; `STORAGE_VERSION` — the persisted shape stays compatible; the `IndexedDBAdapter` interface.
- **Implementation:** Per D17 and _Interfaces_. Replace the three `=== 'text'` / `!== 'text'` tests (`app.store.ts:131`, `reconciler.ts:217,235`) with `isModelEligibleColumnType`. TSDoc on the new exports.
- **Acceptance criteria:**
    - [ ] `setTarget` rejects a `datetime` column and a `text` column, and accepts `numeric`, `categorical` and `boolean`.
    - [ ] Reconciliation drops a persisted target or feature that names a `datetime` column, just as it does for `text`.
    - [ ] A persisted state with `sampleId` on the dataset survives a reconcile round-trip; one without it is still valid.
    - [ ] Baseline 52 tests still pass.
- **Verification:** `bun test tests/column-eligibility.test.ts`; `bun run check`
- **Progress:** [ ] Not started

### T2 — Dependencies, dataset types and the `samata-db` v2 schema module

- **Depends on:** T1
- **Risk:** routine
- **Likely files:** `package.json`, `bun.lock` (via `bun add` only), `src/types/dataset.ts`, `src/common/storage/db.ts`, `tests/helpers/fake-indexeddb.ts`, `tests/storage-db.test.ts`
- **Must not touch:** `tests/setup.ts` — global IndexedDB fakes would leak into tests that rely on it being undefined; `src/stores/reconciler.ts` (T10).
- **Implementation:** `bun add -d fake-indexeddb@6.2.6 @types/papaparse`. Write `dataset.ts` and `toDatasetSummary` exactly as in _Interfaces_. `db.ts` per D14: export `DB_NAME`, `DB_VERSION`, `INGESTION_LOCK = 'samata-ml:ingestion'`, `SamataDBSchema`, `openSamataDb()`, `datasetRowRange(id, from = 0)`, `getMetadata`, `putMetadata`, `getRows` (returns `[]` when the id has no metadata), `deleteDataset`, `deleteDatasetsExcept`, `hasModelResults`. Do not cache the connection at module level. `tests/helpers/fake-indexeddb.ts`: `installFakeIndexedDB()` sets `globalThis.indexedDB = new IDBFactory()` and `IDBKeyRange` from the non-`auto` import, and returns `restore()`.
- **Acceptance criteria:**
    - [ ] A fresh DB has the three stores with D14 key paths; a v1 DB with same-named out-of-line stores upgrades to v2.
    - [ ] `getRows(db, 'a', 2, 3)` returns rows 2–4 of `a` only while `b` exists; it returns `[]` for an id whose rows exist but whose metadata does not.
    - [ ] `deleteDatasetsExcept(db, 'b')` leaves only `b` in all three stores; `null` empties them; `deleteDataset(db, 'a')` leaves `b`.
    - [ ] `toDatasetSummary` sums `missingCount + invalidCount` per column, carries `sampleId` (omitting the key when it is `null`), and adds no other keys.
    - [ ] After `restore()`, `typeof indexedDB === 'undefined'`.
- **Verification:** `bun test tests/storage-db.test.ts`; `bun run check`
- **Progress:** [ ] Not started

### T3 — Cell detectors: missing values, boolean, numeric with affixes, epoch, dates

- **Depends on:** T2
- **Risk:** needs care — regexes, the leading-zero and affix rules, calendar validation and the UTC convention are easy to get subtly wrong.
- **Likely files:** `src/common/storage/cells.ts`, `src/features/data/ingestion/limits.ts`, `tests/cells.test.ts`
- **Must not touch:** `src/common/storage/db.ts` — pure functions only; no `Date.parse`, no `new Date(string)`, no `Temporal`.
- **Implementation:** Per _Interfaces_ → "Cell detectors", R11, R12 and R15. `limits.ts` holds the D11 constants. Header word-splitting for the timestamp gate lives here (`headerSuggestsTime(name)`).
- **Acceptance criteria:**
    - [ ] Numeric: `'3.5'`, `'-1e3'`, `'.5'`, `'$1,234.50'`→1234.5 (prefix `$`, grouped), `'45%'`→45 (suffix `%`), `'0'`, `'0.5'` match; `'01'`, `'007'`, `'1,23'`, `'Infinity'`, `'0x1F'`, `'$-'`, `'1.2.3'` do not.
    - [ ] Boolean: `'Yes'`/`'no'` → pair `yes/no`; `'1.0'` → pair `1/0`; `'maybe'` → −1.
    - [ ] Epoch: `'1700000000'` → seconds; `'0315532800'` and `'99999'` → null.
    - [ ] Dates: `'2024-02-29'` valid, `'2023-02-29'` invalid, `'2024-01-15T10:30:00+01:00'` → epoch ms 09:30Z, `'15/01/2024'` reports `firstPart` 15, `'3 March 2024'` and `'Mar 3, 2024'` valid, `'Model 2024'` and `'10-2'` null; `'10/02/24'` gives year 2024; `'10/02/75'` gives year 1975.
    - [ ] `headerSuggestsTime`: `created_at`, `eventTime`, `ts`, `Date` → true; `counts`, `overtime`, `posts` → false.
    - [ ] Missing: default tokens are case-insensitive after trimming; a custom token list replaces the default (but `''` stays missing); an implicit value `0` matches `'0'` and `'0.0'`.
- **Verification:** `bun test tests/cells.test.ts`; `bun run check`
- **Progress:** [ ] Not started

### T4 — Column profiler and whole-file type election

- **Depends on:** T3
- **Risk:** needs care — the precedence, thresholds, guardrails and override rules must match _Interfaces_ exactly, and the generator reuses this code.
- **Likely files:** `src/common/storage/profiler.ts`, `tests/profiler.test.ts`
- **Must not touch:** `src/common/storage/db.ts`, PapaParse — the profiler consumes `string[]` rows and knows nothing about I/O.
- **Implementation:** `class DatasetProfiler { constructor(rawHeader: string[], options: ProfileOptions); readonly header: string[]; addRow(cells: string[]): { kept: boolean; padded: boolean; values: (string | null)[] }; elect(): ElectedColumn[] }`. `ProfileOptions = { missingValueTokens?: string[]; overrides?: Record<string, ColumnType>; implicitMissing?: Record<string, (string | number)[]>; rowNumberOffset?: number }`. `ElectedColumn` = name, type, format, missing/invalid counters, tokens and examples, superset range, identifier hint and, for categorical, the distinct map. Implement header normalisation (D3), ragged-row handling (D3), all counters, datetime elimination checkpoints and the election rules exactly as in _Interfaces_ → "Type inference" and R13/R17. Also export `normaliseHeaders`.
- **Acceptance criteria:**
    - [ ] Whole-file behaviour: 5,000 numeric rows then 200 `'abc'` rows (3.8 %) → `categorical` or `text`, never `numeric`; 5,000 numeric rows then 50 `'abc'` rows (≤ 2 %) → `numeric` with `invalidCount` 50 and `invalidExamples` `['abc']`.
    - [ ] A `0`/`1` column: 10 rows of only `0` → `numeric`; 25 rows of only `0` → `boolean`; 10 rows mixing `0` and `1` → `boolean`; values `0`, `1`, `2` → `numeric`.
    - [ ] A date column with `05/03/2024` and `25/03/2024` → DMY, `orderAssumed: false`; only `05/03/2024`-style values → DMY with `orderAssumed: true`.
    - [ ] Categorical rule: 3 species over 150 rows → `categorical`; 40 unique names over 45 rows → `text`; 600 distinct codes → overflow → `text` with `distinctCount: null`.
    - [ ] Penguins-like `rowid` 1…n → `numeric` with `identifierHint: true`; `NA` counted in `missingTokens.na`.
    - [ ] Headers `['﻿id', '', 'id', 'id_1']` → `['id', 'column_1', 'id_2', 'id_1']`; a short row is padded and flagged; a long row is not kept.
    - [ ] Override `{ pclass: 'categorical' }` on integer data → `categorical`.
- **Verification:** `bun test tests/profiler.test.ts`; `bun run check`
- **Progress:** [ ] Not started

### T5 — Source resolution, quota check and the PapaParse streaming adapter

- **Depends on:** T2
- **Risk:** needs care — pause/resume with async work, chunk-relative error indexes and streamed byte limits.
- **Likely files:** `src/features/data/ingestion/fetch-source.ts`, `src/features/data/ingestion/csv-stream.ts`, `tests/ingestion-source.test.ts`
- **Must not touch:** `src/common/storage/profiler.ts` and `cells.ts` (T3/T4, parallel-safe) — `streamCsv` passes raw header cells and raw rows on; it does not normalise.
- **Implementation:** `fetchWithRetry` per D13; `checkFileSize` and `checkStorageQuota(bytes, estimate = navigator.storage?.estimate?.bind(navigator.storage))` per D11. `streamCsv(input: Blob | string, handlers: { onHeader(cells: string[]): void; onRows(rows: string[][], quoteErrorRowNumbers: number[]): Promise<void>; onBytes?(n: number): void }, signal?)` with the D3 Papa options. Each chunk: `pause()`, `await onRows`, then `resume()`, or `abort()` if aborted. Quote-error rows are reported, not dropped; the profiler decides. `EMPTY_FILE` if there is no header row; `TOO_MANY_COLUMNS` if the header has more than 200 cells. Verify assumption (a) first and log the result.
- **Acceptance criteria:**
    - [ ] Retry: 503, 503, 200 → success after sleeps of 500 ms and 1,000 ms; 503 ×3 → `HTTP_ERROR` 503; 404 → one attempt; `TypeError` then 200 → success; abort → `CANCELLED`.
    - [ ] A size over the limit (from `size`, `Content-Length` or streamed bytes) → `FILE_TOO_LARGE`; an estimate with less than 3× headroom → `INSUFFICIENT_STORAGE`; no `navigator.storage` → the check is skipped.
    - [ ] Semicolon and tab files are auto-detected; an unterminated quote does not throw and is reported; `\r\n` files parse identically to `\n` files.
    - [ ] With a 3 MiB CSV, `onRows` is called more than once, and no chunk is delivered before the previous promise resolves.
- **Verification:** `bun test tests/ingestion-source.test.ts`; `bun run check`
- **Progress:** [ ] Not started

### T6 — Ingestion pipeline: lossless Pass 1, typed rewrite, statistics, histograms, exact medians

- **Depends on:** T4, T5
- **Risk:** needs care — transaction auto-commit, batch rewrites, bounded-memory order statistics and cleanup on failure.
- **Likely files:** `src/features/data/ingestion/pipeline.ts`, `src/features/data/ingestion/order-statistics.ts`, `tests/order-statistics.test.ts`, `tests/ingestion-pipeline.test.ts`
- **Must not touch:** `src/stores/` (the pipeline never imports stores); `content/datasets/` (T9).
- **Implementation:** `runIngestion` per _Interfaces_ → "Pipeline", with D5–D7 and the D6 histogram and median rules. `order-statistics.ts` holds the pure `FineHistogram`, rank location, collection and sub-bucketing; Pass 3 feeds it. Map `QuotaExceededError` and other `DOMException`s to `STORAGE_FAILED`. Progress phases per D12. Sample-source resolution (descriptor fetch, `DESCRIPTOR_MISMATCH`) lives here too, using `fetchWithRetry`. Tests inject a fake `fetchImpl` that serves a descriptor JSON and CSV text.
- **Acceptance criteria:**
    - [ ] Order statistics (pure): random arrays of sizes 1, 2, 7, 10,000 and 2,000,001 (with `MEDIAN_COLLECT_LIMIT` lowered to 1,000 for the test) give the same median as a full sort; 90 % identical values resolve without collecting; never more than `MEDIAN_COLLECT_LIMIT` values are held at once.
    - [ ] Histograms: integers 2007–2009 → 3 bins, `start` 2006.5, `width` 1; floats 0.0–9.99 over 400 values → 20 bins of width 0.5 starting at 0; floats −3.2–41.7 over 344 values → nice width 2.5, `start` −5, ≤ 100 bins; `counts` sum to `count`, and `max` falls in the last bin; a constant column → 1 bin.
    - [ ] After success, stored rows are typed (numbers, booleans, epoch ms, strings, `null`), invalid cells are `null`, and `rowIndex` runs 0…n-1.
    - [ ] Ragged and skipped rows are reflected in `paddedRowCount` and `skippedRows`.
    - [ ] A header-only CSV → `NO_DATA_ROWS`; an abort during Pass 2 → `CANCELLED`; both leave no rows or metadata for the new id, and a pre-existing dataset is untouched.
    - [ ] A sample whose CSV header differs from its descriptor → `DESCRIPTOR_MISMATCH`; a descriptor `dataType` override is applied.
- **Verification:** `bun test tests/order-statistics.test.ts tests/ingestion-pipeline.test.ts`; `bun run check`
- **Progress:** [ ] Not started

### T7 — Worker entry, protocol, client and `loadDataset` service

- **Depends on:** T6
- **Risk:** needs care — request correlation, cancellation and the single-flight rule across an async boundary.
- **Likely files:** `src/features/data/ingestion/protocol.ts`, `src/features/data/ingestion/worker-handler.ts`, `src/features/data/ingestion/storage.worker.ts`, `src/features/data/ingestion/storage-client.ts`, `src/features/data/load-dataset.ts`, `tests/storage-client.test.ts`
- **Must not touch:** `src/stores/app.store.ts` (call `loadDatasetSucceeded`, never change it); `src/app.ts` (T10).
- **Implementation:** Per D8, D9 and _Interfaces_. The handler wraps each ingest in `navigator.locks.request(INGESTION_LOCK, …)` when the API is available. Tests connect the client and handler through an in-memory port pair, with `installFakeIndexedDB()`, the Locks mock and a fake fetch.
- **Acceptance criteria:**
    - [ ] `ingest({ kind: 'file' })` resolves to metadata and emits `parse`, `typing` and `statistics` progress; `fetchRows(id, 0, 5)` returns 5 typed rows; reading near the end returns the remainder; an unknown id returns `[]`.
    - [ ] A concurrent second `ingest` → `BUSY`; abort → `CANCELLED`, with no rows left behind.
    - [ ] `loadDataset()` sets `$appState.dataset` (including `sampleId` for samples) and `data.mode = 'preview'`, and leaves only the new dataset stored; on error, `$appState` and the old dataset are unchanged.
    - [ ] The ingestion lock is held during the run and released afterwards.
    - [ ] No file under `src/features/data/ingestion/` or `src/common/storage/` imports `lit`, `nanostores` or `src/stores/` (a test reads the import lines).
- **Verification:** `bun test tests/storage-client.test.ts`; `bun run check`
- **Progress:** [ ] Not started

### T8 — Sample catalogue types, build generator, worker build entry and runtime loader

- **Depends on:** T4, T7
- **Risk:** needs care — the generator is the guard against metadata drift; its validation must collect every error and fail the build.
- **Likely files:** `src/types/sample-dataset.ts`, `scripts/generate-datasets.ts`, `scripts/build-assets.ts`, `src/features/data/sample-datasets.ts`, `src/config/datasets.ts` (delete), `tests/generate-datasets.test.ts`, `tests/fixtures/datasets/` (small valid and invalid dataset folders)
- **Must not touch:** `scripts/generate-pages.ts`, `scripts/html.ts`, `public/_headers`; `content/datasets/` real content (T9).
- **Implementation:** Write the types per _Interfaces_. `generateSampleDatasets(outDir, contentDir = 'content/datasets')`: for each folder, `await import()` its `descriptor.ts`, read `data.csv` as text, profile it with `Papa.parse(text, { header: false, … })` and `DatasetProfiler` (same options as D3), run every _Generator validation_ check, compute `stats`, `missingCount` and the SHA-256 (`Bun.CryptoHasher`), compile `datasheet.md` with `marked`, and write the four outputs plus `manifest.json`. On any error, print every message and throw. Make the D16 edits in `build-assets.ts`. `sample-datasets.ts`: `loadSampleCatalogue()` and `loadSampleDescriptor(id)` via same-origin `fetch`, with a manifest-version check. Delete `src/config/datasets.ts` (nothing imports it).
- **Acceptance criteria:**
    - [ ] A valid fixture produces a manifest and descriptor with computed `stats`, a `missingCount` per column and a `?v=` hash in `files`.
    - [ ] Each of these invalid fixtures fails with a message naming the dataset and rule: a header mismatch, a header needing normalisation, an infeasible `dataType` override, a binary target with 3 classes, a leaky column that is the target, an unknown referenced column, a licence outside the allow-list, a missing datasheet. A fixture with two errors reports both.
    - [ ] `bun run build` emits `dist/storage.worker.js`, `dist/datasets/manifest.json` and the per-dataset files.
- **Verification:** `bun test tests/generate-datasets.test.ts`; `bun run build`; `bun run check`
- **Progress:** [ ] Not started

### T9 — Penguins and Iris content

- **Depends on:** T8
- **Risk:** routine
- **Likely files:** `content/datasets/palmer-penguins/{descriptor.ts,datasheet.md,data.csv}`, `content/datasets/iris/{descriptor.ts,datasheet.md,data.csv}`
- **Must not touch:** `scripts/` — content only; if the generator rejects the content, fix the content, or raise it in the log if a rule looks wrong.
- **Implementation:** Download the two gist CSVs byte-for-byte as `data.csv` and verify their SHA-256 against _Codebase context_. Do not reformat them, and do not pass them to Prettier. Descriptors (British-English prose):
    - **Palmer Penguins:** `id` `palmer-penguins`, domain `biology`, difficulty `beginner`, `missingValueTokens: ['NA']`.
        - Columns: `rowid` is an identifier; `species`, `island` and `sex` are categorical; `bill_length_mm`, `bill_depth_mm`, `flipper_length_mm` and `body_mass_g` are numeric with units `mm`/`g`; `year` is numeric.
        - `defaultTarget: 'species'` (multiclass); further candidates `sex` (binary, `positiveClass: 'female'`) and `body_mass_g` (regression).
        - Licence `CC0-1.0`. Creators: Horst, Hill and Gorman, building on Gorman, Williams and Fraser (2014). Homepage https://allisonhorst.github.io/palmerpenguins/. `transformations`: none.
    - **Iris:** `id` `iris`, `beginner`; four numeric `cm` columns and categorical `species`; `defaultTarget: 'species'` (multiclass).
        - Licence `CC-BY-4.0`, with attribution to R. A. Fisher (1936) via the UCI Machine Learning Repository (https://archive.ics.uci.edu/dataset/53/iris).
        - `references`: Fisher 1936 (seminal paper).
    - **Datasheets:** short, covering motivation, composition, collection, preprocessing and licence. Full datasheet copy beyond that is content work, not this plan.
- **Acceptance criteria:**
    - [ ] `bun run build` succeeds; the manifest lists both datasets with `rowCount` 344 / 150 and `columnCount` 9 / 5; Penguins `hasMissingValues` is true.
    - [ ] Both CSV hashes match the recorded values.
    - [ ] `tsc` passes, so both descriptors satisfy `AuthoredDatasetDescriptor`.
- **Verification:** `bun run build`; `bun run check`; `shasum -a 256 content/datasets/*/data.csv`
- **Progress:** [ ] Not started

### T10 — Reconciler on the real schema, lock-aware orphan cleanup, wired into bootstrap

- **Depends on:** T2, T7
- **Risk:** routine
- **Likely files:** `src/stores/reconciler.ts`, `src/app.ts`, `tests/reconciler-indexeddb.test.ts`
- **Must not touch:** `tests/state-and-storage.test.ts`; the `IndexedDBAdapter` signature; checks 5–8.
- **Implementation:** Rebuild `createDefaultIndexedDBAdapter()` on `db.ts`, with D9 lock-aware cleanup; remove the local `getDB`. `bootstrapApp` calls `reconcileStartupState(undefined, createDefaultIndexedDBAdapter())`.
- **Acceptance criteria:**
    - [ ] Active `a` plus orphan `b` → `b` deleted.
    - [ ] With `INGESTION_LOCK` held (`_holdLock`), a partial dataset `c` survives; after release, a rerun deletes it.
    - [ ] Persisted `dataset.id` without metadata → check-1 reset through the real adapter.
    - [ ] All earlier tests still pass.
- **Verification:** `bun test tests/reconciler-indexeddb.test.ts`; `bun run check`
- **Progress:** [ ] Not started

### T11 — `IndexedDBDatasetProvider`

- **Depends on:** T1, T2
- **Risk:** needs care — one-hot offset arithmetic, label encoding and the rule against intermediate `Float64Array`s.
- **Likely files:** `src/common/storage/indexeddb-dataset-provider.ts`, `tests/dataset-provider.test.ts`
- **Must not touch:** `../web-ml/**` (type import only); `src/features/**` (shared code imports only `src/common/storage/` and `src/types/`).
- **Implementation:** Per D15, with `PreprocessingStep`, the options, `featureNames`, `targetCategories` and the `DatasetProviderError` codes (`DATASET_NOT_FOUND`, `UNKNOWN_COLUMN`, `UNSUPPORTED_COLUMN` for `text`/`datetime`, `MISSING_PREPROCESSING`, `MISSING_VALUE`, `BUFFER_TOO_SMALL`, `ABORTED`). Precompute write plans in `create()`. Write rows row-major, with impute applied before one-hot. Tests write typed `RawRecord`s and metadata directly through `db.ts`.
- **Acceptance criteria:**
    - [ ] Iris-like: 4 numeric features plus target `species` → `targetCategories` `['setosa', 'versicolor', 'virginica']`, targets 0/1/2, features row-major.
    - [ ] One-hot `island` → `featureNames` `['bill_length_mm', 'island=Biscoe', 'island=Dream', 'island=Torgersen']`, with exactly one 1 per row in that block.
    - [ ] Missing with `impute: median` writes the metadata median; with no impute → `MISSING_VALUE` naming the column and row.
    - [ ] `text` or `datetime` → `UNSUPPORTED_COLUMN`; a categorical feature without one-hot → `MISSING_PREPROCESSING`; an undersized buffer → `BUFFER_TOO_SMALL`; abort → `ABORTED`; with `batchSize: 2` over 5 rows, progress is 0.4, 0.8, 1.
    - [ ] The source contains no `new Float64Array`.
- **Verification:** `bun test tests/dataset-provider.test.ts`; `bun run check`
- **Progress:** [ ] Not started

### T12 — Browser end-to-end test of worker, catalogue and IndexedDB

- **Depends on:** T9, T10
- **Risk:** routine
- **Likely files:** `tests/storage-worker.e2e.ts`
- **Must not touch:** `playwright.config.ts`; other e2e suites.
- **Implementation:** Open `/data`, delete `samata-db` in `beforeEach`, then use `page.evaluate` to: fetch `/datasets/manifest.json`; start `new Worker('/storage.worker.js', { type: 'module' })`; post `ingest` `{ kind: 'sample', sampleId: 'palmer-penguins' }`; post `getRows`; count rows with raw `indexedDB`; ingest an in-page `File` with one long (skipped) row, one short (padded) row and a 30 % non-numeric column. Covers the real `Blob`/`FileReader` path and DATA-AC-1 to DATA-AC-4. If browsers are missing, ask the user before running `bunx playwright install chromium`; otherwise record "not run".
- **Acceptance criteria:**
    - [ ] The manifest lists `iris` and `palmer-penguins`.
    - [ ] Penguins: 344 rows, 9 columns; `species`/`island`/`sex` categorical; `bill_length_mm` numeric with `missingCount` 2; `year` numeric with a 3-bin histogram; `rowid` has `identifierHint`; `sampleId` is `palmer-penguins`.
    - [ ] `getRows(…, 0, 3)` returns typed values (numbers, not strings), and IndexedDB holds 344 rows for the id.
    - [ ] The in-page `File` reports `skippedRows.count` 1 and `paddedRowCount` 1, and the 30 % column is not `numeric`.
    - [ ] Passes in chromium; firefox and webkit results are recorded.
- **Verification:** `bun run test:e2e tests/storage-worker.e2e.ts`
- **Progress:** [ ] Not started

### T13 — Sync specification: specs, notes, TODO list and Known gaps

- **Depends on:** T1–T12
- **Risk:** routine
- **Likely files:** `specification/data-ingestion.md`, `specification/sample-datasets.md` (new), `specification/notes/sample-dataset-specification.md` (delete), `specification/notes/data-type-inference.md` (delete), `specification/state-and-storage.md`, `specification/workflow-steps.md`, `specification/ARCHITECTURE.md`, `specification/TODO.md`, `specification/README.md`
- **Must not touch:** `specification/preview-dataset.md` (TODO-48); `specification/mockups/`; `AGENTS.md`; other plans.
- **Implementation:**
    - **`data-ingestion.md`:** status `implemented`. §3 links `src/types/dataset.ts`. §4 = D14. §5 = D2–D7, D11 and the full type-inference rules from _Interfaces_ (this absorbs `data-type-inference.md`, including the R9–R17 changes). §6 = D15. Keep DATA-AC-1–5.
    - **New `sample-datasets.md`** (status `implemented`): the descriptor schema, authoring layout, generator rules and R1–R8, R18. It absorbs `sample-dataset-specification.md` and keeps its §3 UI intents and §6 future idea as non-normative notes. Then delete both notes from `plans/`.
    - **`state-and-storage.md`:** §3 gets `datetime` and `sampleId`; §10 #4 points at the canonical type.
    - **`workflow-steps.md` §1:** "cards for each dataset in `./src/config/datasets.ts`" becomes "in the sample-dataset manifest (sample-datasets.md)"; the card fields become `name`, `tagline`, `stats.rowCount`, `stats.columnCount`.
    - **`ARCHITECTURE.md`:** update the `/src/config/` line and add `content/datasets/`.
    - **`TODO.md`:** delete TODO-12 (datasheet part only; keep the welcome-modal and model-description parts), TODO-23, TODO-24, TODO-47 (re-scope its remainder to TODO-48) and TODO-49; re-word TODO-09 to its UI parts; note in TODO-42 that new datasets follow sample-datasets.md.
    - **`README.md`:** add the `sample-datasets.md` row; set `data-ingestion.md` to `implemented`; Known gaps 4 (datasets decided), 6, 9 and 14 (first bullet).
- **Acceptance criteria:**
    - [ ] Every item under _Specification changes_ is applied and ticked, following "Writing specs" in `specification/README.md`.
    - [ ] No spec contradicts D1–D17 or R1–R18 (no `unknown` type, no `Timestamp` type, no `histogram: number[]`, no hand-authored `stats`, no `src/config/datasets.ts`).
    - [ ] `bun run plans:check` passes for every plan (the two notes files are gone).
- **Verification:** `bun run plans:check`; `bun run check`
- **Progress:** [ ] Not started

## Verification and definition of done

- [ ] All task acceptance criteria met.
- [ ] `bun run check` introduces no new failures (baseline 0 type errors, 52 pass, 0 fail; new tests only add passes).
- [ ] Parity and token tests pass for UI changes. Not applicable: this plan changes no UI.
- [ ] `bun run build` succeeds and emits `storage.worker.js` and `datasets/manifest.json`.
- [ ] `bun run test:e2e tests/storage-worker.e2e.ts` passes in at least chromium, or is recorded as not run with the reason.
- [ ] Privacy and security: every fetch is same-origin; no CSP change; datasheet HTML comes only from first-party Markdown.
- [ ] Every item under _Specification changes_ is ticked, and the specs describe the code as built (T13).
- [ ] No unintended changes outside the tasks' likely files; `bun run format` run on every changed Prettier-supported file (not the CSVs).

## Risks and open questions

- **Blocking:** None. Approval answers TODO-12 (datasheets), TODO-23, TODO-24, TODO-47 and TODO-49, plus the ingestion parts of TODO-09. Please check these before approving:
    - **D17:** `datetime` joins the canonical `ColumnType`; it is profiled but not model-eligible.
    - **R12:** ambiguous dates default to **DMY**, where your notes said MDY.
    - **R13:** the stricter small-file categorical rule.
    - **R14:** your sentinel set kept as is, including `none`/`nil`/`-`, with per-token counts for transparency.
    - **R4/R5:** roles reduced to `feature`/`identifier` plus `sensitive`; leakage per target only.
    - **D3:** long rows skipped rather than truncated.
- **Non-blocking:**
    - **Spec conflict:** `workflow-steps.md` and `ARCHITECTURE.md` name `src/config/datasets.ts` as the card source. This plan replaces it with the generated manifest. These are file locations, not user-facing behaviour, so T13 updates both specs. Owner: this plan.
    - **Step-1 stub:** it still lists a remote-URL input. That conflicts with state-and-storage §10 #7 and TODO-37, and the CSP blocks it. `IngestSource` no longer has a URL kind. Owner: the step-1 planner.
    - **Ingestion time:** at 200 MB, ingestion writes the data twice (Pass 1 raw, Pass 2 typed) and reads it at least once more (Pass 3), which could take minutes on slow disks. Progress phases make this visible. If it proves too slow, Pass 2 could skip rewriting columns whose raw and typed forms are identical (text, categorical); the interfaces would not change. Owner: TODO-45.
    - **IndexedDB footprint:** a 200 MB CSV may occupy roughly 1.5–3× its size in IndexedDB. The quota pre-check uses 3×. `navigator.storage.persist()` is not requested, because Firefox shows a permission prompt; revisit with TODO-45.
    - **Datetime convention:** values are stored as UTC epoch milliseconds, so the step-1 preview must format them with `timeZone: 'UTC'`, or a date can display as the previous day west of UTC (Temporal guide). Owner: the step-1 planner.
    - **Approximations:** the 98 % threshold at the first datetime checkpoint (row 1,000) can eliminate a datetime column whose early rows are noisier than the file overall. This only affects datetime; boolean, numeric and categorical decisions are exact over all rows.
    - **Not supported:** European number formats (`1.234,5`) and accounting negatives (`($5)`) are read as non-numeric and fall through to `categorical`/`text`.
    - **Later improvement:** exact quartiles (and so Freedman–Diaconis bins and box plots) could reuse the order-statistics module with extra ranks.
    - **Datasheet sanitising:** compiled HTML is trusted only because it is first-party. If datasheets ever accept contributions, sanitise at build time.
    - **Test fidelity:** `fake-indexeddb` and happy-dom differ from real browsers; T12 is the safety net and records "not run" rather than claiming a pass.

## Implementation and verification log

| When (UTC) | Task | Outcome / commands / evidence |
| ---------- | ---- | ----------------------------- |
| —          | —    | Not started                   |

## Change log

| When (UTC)           | Change                                                                                                                                                                                                                                                                                                                        | Reason                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 2026-11-12T15:35:52Z | Initial draft                                                                                                                                                                                                                                                                                                                 | User request: turn the `data-ingestion-and-storage` stub into a draft plan |
| 2026-11-13T08:09:39Z | Major revision: whole-file type inference with the notes' rules (D2–D4, R9–R17); histograms for floats and nice bins (D6); bounded-memory exact medians; 200 MB limit and quota check (D11); typed sample-dataset descriptors and build-time catalogue (D10, R1–R8); `datetime` in `ColumnType` (D17); tasks re-cut to T1–T13 | User review of D4, D6, D10, D11 and the two notes files                    |
| 2026-11-13T08:53:21Z | Added _Specification changes_, distilled from T13; T13 renamed to the `Sync specification` task                                                                                                                                                                                                                               | New spec-sync rule in the planning and implementation skills               |
| 2026-11-13T11:17:32Z | The two input notes moved from `plans/` to `specification/notes/`; paths updated                                                                                                                                                                                                                                              | Notes inbox created so `plans:check` only sees plans                       |
