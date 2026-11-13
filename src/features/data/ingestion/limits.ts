/** Maximum accepted CSV size: 200 MiB, displayed to users as 200 MB. */
export const MAX_FILE_BYTES = 200 * 1024 * 1024;

/** Maximum number of columns accepted from a CSV header. */
export const MAX_COLUMNS = 200;

/** PapaParse streaming chunk size. */
export const PARSE_CHUNK_BYTES = 1024 * 1024;

/** Number of rows processed in one IndexedDB pass-two batch. */
export const PASS_BATCH_ROWS = 5000;

/** Maximum distinct values tracked per column during inference. */
export const MAX_TRACKED_DISTINCT = 500;

/** First row count at which datetime inference can be eliminated. */
export const DATETIME_FIRST_CHECKPOINT = 1000;

/** Row interval between subsequent datetime inference checkpoints. */
export const CHECKPOINT_ROWS = 50_000;

/** Minimum match ratio required to elect a detected cell type. */
export const TYPE_MATCH_THRESHOLD = 0.98;

/** Maximum number of display histogram bins. */
export const HISTOGRAM_MAX_BINS = 100;

/** Number of buckets used to locate exact numeric medians. */
export const FINE_BINS = 2048;

/** Maximum number of values collected to resolve an exact median bucket. */
export const MEDIAN_COLLECT_LIMIT = 1_000_000;

/** Maximum skipped row numbers retained in metadata. */
export const MAX_SKIPPED_ROW_NUMBERS = 10;

/** Maximum invalid cell examples retained per column. */
export const MAX_INVALID_EXAMPLES = 5;

/** Storage quota headroom multiplier for raw and rewritten dataset rows. */
export const STORAGE_HEADROOM_FACTOR = 3;
