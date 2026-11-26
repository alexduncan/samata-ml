# Data Ingestion & Storage Pipeline

**Status:** implemented

## 1. Summary

The data pipeline reads an uploaded CSV or a sample from the catalogue, profiles every kept row, stores the original cell strings in IndexedDB, then elects and applies column types. It computes statistics without holding the whole dataset in memory and exposes paged rows and metadata to the application and `IndexedDBDatasetProvider`.

## 2. Runtime and constraints

- CSV fetching, parsing, profiling and storage run in a dedicated module worker. The worker and storage modules do not import Lit.
- PapaParse parses UTF-8 input in chunks. The default missing tokens are `""`, `null`, `nan`, `na`, `n/a`, `none`, `nil`, `-` and `?` (case-insensitive after trimming); sample descriptors may replace the tokens, while empty cells remain missing.
- The input limit is 200 MiB and the header limit is 200 columns. Before ingestion, the pipeline estimates storage at three times the input size and rejects the input if available IndexedDB quota is insufficient. It does not request persistent storage.
- Fetches retry network failures and HTTP 5xx responses up to three attempts with exponential backoff; 4xx responses fail immediately. Cancellation is checked between chunks and batches and every 1,000 cursor rows. An unsuccessful or cancelled ingest removes its partial dataset where possible.

## 3. Data structures

The canonical column vocabulary and lightweight persisted dataset summary are defined in [`src/types/state.ts`](../src/types/state.ts). Ingestion records and full statistics are defined in [`src/types/dataset.ts`](../src/types/dataset.ts); these types are the contract for the worker, IndexedDB and provider.

`CellValue` is `number | boolean | string | null`. `RawRecord` stores `{ datasetId, rowIndex, values }`. `DatasetMetadata` stores the dataset id and name, source (`sample` or `upload`), nullable `sampleId`, row and byte counts, creation time, detected delimiter, ordered column statistics, padded-row count and skipped-row count with up to 10 row numbers.

Every column records its name, canonical `ColumnType`, missing-token counts, invalid-cell count and up to five distinct invalid examples. Numeric statistics include count, range, mean, exact median, integer and identifier hints, display format and histogram. Categorical statistics include the distinct count and category counts; booleans include true/false counts and their observed lexicon; dates include a UTC-midnight epoch-millisecond range and detected format; times include a milliseconds-since-midnight range and a `precision`; datetimes include an epoch-millisecond range, a `precision` and the detected format. `precision` is `minute`, `second` or `millisecond`, the finest non-zero unit among the stored values. Datetime metadata stored before the `date` and `time` types existed may lack `precision` and carry a `hasTime` flag; it is displayed with full ISO strings. Text statistics include a bounded distinct count and identifier hint. Invalid values are stored as `null`. `toDatasetSummary` omits full statistics and reports `missingCount + invalidCount`, because both are null in the stored rows; it carries `sampleId` when present.

## 4. IndexedDB schema (D14)

The `idb` database is `samata-db`, version 2. An upgrade deletes and recreates the legacy stores to establish the v2 key paths. Its schema is:

| Store           | Key                     | Indexes | Contents                                                               |
| --------------- | ----------------------- | ------- | ---------------------------------------------------------------------- |
| `metadata`      | `id`                    | —       | One `DatasetMetadata` per ingested dataset                             |
| `raw_records`   | `[datasetId, rowIndex]` | —       | One `RawRecord` per kept row; compound-key ranges page rows by dataset |
| `model_results` | `[datasetId, modelNum]` | —       | Stored model results                                                   |

Rows use zero-based indexes within each dataset. The database adapter exposes bounded row ranges, metadata reads and writes, per-dataset deletion, deletion of all datasets except a selected id, and a check for stored model results. Database connections are opened for each operation rather than cached at module scope. The worker serialises ingestion with the `samata-ml:ingestion` Web Lock when Web Locks are available.

## 5. Parsing, profiling and type inference (D2–D7, D11)

### CSV parsing and row handling

PapaParse streams 1 MiB chunks and detects a delimiter from comma, tab, semicolon and pipe using the initial non-empty lines, with quoting handled by PapaParse. UTF-8 decoding removes an initial BOM. Normalised headers have a BOM removed, are trimmed, receive `column_{index}` when blank and are deduplicated with the smallest available `_N` suffix that does not collide with another header. A sample's resulting header must exactly match its descriptor.

Empty rows are ignored. A short row is padded with missing cells and increments `paddedRowCount`. A row longer than its header is skipped and recorded; malformed-quote rows are passed to profiling. No row is truncated. Stored row numbers are one-based in diagnostics.

### Whole-file inference

Pass 1 stores untyped, lossless cell strings and profiles all kept rows. No conversion is committed during this pass, so a late value cannot destroy an earlier value needed after type election. For each column the profiler counts missing values, invalid candidates, type matches, ranges, distinct values and identifier patterns. Distinct values are tracked up to 500; on overflow the map is cleared and the column is permanently ineligible to be categorical. Date-string, epoch and time-of-day counting are three independent latches. Each stops at row 1,000 or a 50,000-row checkpoint if its mismatch rate exceeds 2%.

Election uses the most specific valid type, with at least 98% match coverage for primitive types:

1. **Boolean:** case-insensitive pairs `true/false`, `t/f`, `yes/no`, `y/n` or `1/0`; values from different pairs are not mixed. For `1/0`, both values must occur or there must be at least 20 non-missing cells.
2. **Epoch timestamp:** any column may elect `datetime` with an epoch format; the header is not consulted. Values are unsigned integers without leading zeroes. The digit count gives the unit: 9–10 digits are seconds, 12–13 milliseconds and 15–16 microseconds (`^[1-9](?:\d{8,9}|\d{11,12}|\d{14,15})$`). The value must fall in 1980-01-01 through (exclusive) 2050-01-01 UTC. The unit with the most matches is used, with ties broken in the order `s`, `ms`, `us`. Epoch election is skipped when the column's integers strictly increase by one (the identifier sequence), so such a column is numeric.
3. **Date strings:** a column is a `date` when date-only cells valid under the chosen order reach 98% of non-missing cells, otherwise a `datetime` when all date-string cells valid under that order reach 98%. A cell is date-only when it has no time, or a time of exactly midnight with no offset or an offset of zero (`2013-08-14 00:00:00`, `2013-08-14T00:00:00Z`). Under `date`, a cell with a real time of day is invalid: it is stored as `null`, counted in `invalidCount` and shown in `invalidExamples`. Dates are stored as epoch milliseconds at UTC midnight. Only these explicit patterns are accepted; permissive `Date.parse`, `new Date(string)` and Temporal parsing are not used:

   ```text
   ISO        ^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}(?::?\d{2})?)?)?$
   NUM_YMD    ^(\d{4})([/-])(\d{1,2})\2(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?$
   NUM_XXY    ^(\d{1,2})([/-])(\d{1,2})\2(\d{4}|\d{2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?$
   NAMED_DMY  ^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,9})\.?,?\s+(\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$
   NAMED_MDY  ^([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$
   ```

   The patterns accept one consistent `/` or `-` separator for numeric dates, English month names and abbreviations, and optional times. Four-digit years are 1000–9999; two-digit year-last dates pivot at 50 (`00–49` → 2000–2049, `50–99` → 1950–1999). Hours are 0–23, minutes and seconds 0–59, offsets at most ±14:59, and dates must round-trip through the Gregorian calendar. ISO fractional seconds use the first three digits, padded on the right. Ambiguous year-last dates default to DMY with `orderAssumed: true`; a day or month above 12 determines the order. A date without a zone is stored as UTC; explicit offsets are converted to UTC.

4. **Time of day:** a column is a `time` when at least 98% of non-missing cells match `^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?$` with hours 0–23 and minutes and seconds 0–59. The fraction is cut to three digits and padded on the right. Times are 24-hour only, with no zone suffix and no AM/PM, and are stored as milliseconds since midnight (0 to 86,399,999). Dates and times are never combined in one column.
5. **Numeric:** the parser accepts a signed integer, decimal or scientific number with an optional currency prefix and percent suffix. It allows at most one sign, requires at least one digit, accepts commas only in groups matching `\d{1,3}(,\d{3})+`, and rejects an integer part with leading zeroes unless a decimal point is present. One dominant non-empty `(prefix, suffix)` signature is selected; cells with no affix are also valid, but a different non-empty signature is invalid. `45%` is stored as `45` with `%` retained as display format. European decimal commas and accounting negatives are not supported.
6. **Categorical:** after primitive types, a column is categorical when there is no distinct-value overflow, mean unique-value length is at most 64, and either `U ≤ 50` and `U ≤ V/2`, or `U ≤ 250` and `U/V ≤ 0.05`. Here `U` is the distinct non-missing count and `V` the non-missing count. The first bound prevents small files with many unique values from becoming categorical.
7. **Text:** fallback type, including columns with no non-missing values. Text columns receive an identifier hint when distinctness exceeds 98% and tracked values contain no whitespace.

Boolean, date, time, datetime and numeric types require at least 98% matching non-missing cells. Numeric columns use the dominant non-empty affix signature; un-affixed values remain valid. Numeric columns also receive an identifier hint when all values are distinct integers in a strictly increasing sequence by one. Hints do not automatically exclude uploaded columns. A sample descriptor may override an elected `numeric` or `boolean` type to `categorical` when all values are valid, or any type to `text`; otherwise it must match the elected type. A `date`, `time` or `datetime` override is therefore allowed only when the profiler elects that same type. Values that do not fit an override are counted invalid and stored as null.

### Statistics and bounded memory

Pass 2 rereads stored raw rows, coerces values to the elected type and rewrites them in batches, replacing invalid cells with null. It computes final counts, means, ranges and category counts. Exact medians use order statistics without retaining every numeric value: a 2,048-bin fine histogram locates ranks `floor((n - 1) / 2)` and `floor(n / 2)`; unresolved bins are repeatedly refined, collecting and sorting values only when a bin contains at most 1,000,000 values. The two selected values are averaged for an even-sized column. Numeric display histograms use at most 100 bins based on the final range. Constant columns use one bin. Passes report phase, bytes and rows at most every 100 ms, as well as on phase changes.

## 6. Dataset provider (D15)

`IndexedDBDatasetProvider` implements the `web-ml` dataset-provider contract. It pages records from IndexedDB and writes row-major values directly into the caller-provided `Float64Array` view. It does not allocate a `Float64Array` for each batch. Its preprocessing steps support mean imputation and one-hot encoding; imputation is applied before one-hot encoding. `create()` validates column eligibility and preprocessing requirements and prepares the write plan before `load()` writes any values.

## 7. Acceptance criteria

- **DATA-AC-1:** The Web Worker successfully fetches a sample CSV, automatically retrying transient network failures, and streams parsing with PapaParse. Uploads are read from their `File` object.
- **DATA-AC-2:** Malformed and overlong rows are skipped and counted without terminating ingestion; short rows are padded and counted.
- **DATA-AC-3:** Column types are inferred over the whole file, and Pass 1 writes all kept raw records to IndexedDB in batches.
- **DATA-AC-4:** Later passes calculate numeric histograms and exact medians using bounded-memory, cursor-based IndexedDB iteration, then write final metadata.
- **DATA-AC-5:** `IndexedDBDatasetProvider` streams stored records, applies requested preprocessing and writes into the supplied `Float64Array` without intermediate batch arrays.
