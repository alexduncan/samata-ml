/**
 * Global environment constants replaced by Bun at compile time via `define`.
 */
declare const DEBUG: boolean;

/** Semantic version string read from `package.json` at build time. */
declare const APP_VERSION: string;

/** Deterministic build identifier computed from version, workers and content manifests. */
declare const BUILD_ID: string;

/** Whether beta telemetry is compiled into this production bundle. */
declare const BETA_TELEMETRY_ENABLED: boolean;

/** Root-absolute URL for the storage Web Worker script. */
declare const STORAGE_WORKER_URL: string;

/** Root-absolute URL for the training Web Worker script. */
declare const TRAINING_WORKER_URL: string;

/** Root-absolute URL for the analysis Web Worker script. */
declare const ANALYSIS_WORKER_URL: string;

/** Digest version query string value for content manifest fetches. */
declare const CONTENT_INDEX_VERSION: string;

/** Digest version query string value for the sample datasets manifest fetch. */
declare const DATASETS_INDEX_VERSION: string;

/** Root-absolute URL for the vendored `web-ml` runtime entrypoint. */
declare const WEB_ML_RUNTIME_URL: string;

/** Content-addressed revision string for the vendored `web-ml` runtime. */
declare const WEB_ML_RUNTIME_REVISION: string;
