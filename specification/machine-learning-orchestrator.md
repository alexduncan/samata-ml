# Machine Learning Orchestrator

**Status:** implemented — local single-target classification with One-Shot and fixed-parameter Cross-Validation, with stored evaluation outputs for the shared Section 6 results.

## 1. Runtime boundary

Samatā owns the model builder, input transport, training coordination and durable results. The `web-ml` package owns stratification, fitted preprocessing, model fitting, evaluation, cross-validation and diagnostics. The [Phase 3 plan](plans/archive/web-ml-phase-3-model-training.md#implementation-and-verification-log) records the verified prebuilt revision and its public and executable hashes. The build verifies the frozen local dependency and serves the unchanged module graph, relative workers, WASM files and notices from a versioned, content-addressed same-origin directory. See [Delivery and Caching](ARCHITECTURE.md#delivery-and-caching) for isolation and installation.

The app starts one module worker at `/training.worker.js` per accepted attempt. The worker imports the verified runtime and uses the package's own worker and WASM graph. A non-isolated page stays in Training Setup with a recovery message. The browser owns the WebAssembly and shared-memory resources used by the library.

## 2. Input and evaluation

The worker reads the acknowledged dataset by ID. It reads bounded IndexedDB pages, verifies column metadata and row types, and preserves the mapping from dense accepted rows to original row indices. Rows with missing or invalid target values are excluded and counted. The worker preserves missing predictor values for the library. The transport encodes each selected feature and class without fitting statistics.

- **One-Shot.** The app calls `holdoutValidate` once with a 20% test ratio, seed 42 and `returnFit: true`. The library stratifies the split, fits preprocessing on the fitting rows, transforms the held-out rows with that state and returns the fitted model and fitted preprocessor from the same fit. There is no second training attempt.
- **Cross-Validation.** The app sends the selected fold count, seed 42, fixed manual options, accuracy scoring and `refit: true` to `crossValidate`. The library fits preprocessing and the model inside each fold, scores its validation rows and refits on all eligible rows. The stored folds and out-of-fold diagnostics describe the evaluation. The stored model and fitted preprocessor describe the separate full-data refit.
- **Evaluation outputs.** Both calls also request `evaluation: { outputs: true, reports: true, trainingReports: true, baselines: ['most-frequent', 'stratified'] }`. Binary targets name the second class of the request axis as the explicit positive label. The library returns per-row outputs, a held-out report and a training report for each partition, and both baseline reports for each partition (WR-1…WR-6). The worker then calls the public curve functions on the pooled held-out rows: `rocCurve` and `precisionRecallCurve` for binary ranking, `oneVsRestCurves` for multiclass, `binaryThresholdSweep` over 101 cutoffs and `calibrationCurve` with ten uniform bins (WR-10). Samatā computes no metric, curve, baseline or partition.

### Stored evaluation

The worker maps these outputs into `StoredEvaluation` (`src/types/model-evaluation.ts`, version 1), which belongs to Samatā so that later library changes cannot silently break saved results. It holds the class axis, the explicit positive class index for binary targets, the partition fingerprint, one entry per partition (held-out report, training report, both baselines, duration and timing kind), the pooled held-out report and baselines, the per-row outputs and the curves. One-Shot is one partition of kind `holdout-test`; Cross-Validation is one `outer-fold` partition per fold. Source row indices are mapped back to original dataset rows. Metrics keep the library's value or its unavailability reason. The partition fingerprint is a SHA-256 over the dataset ID, protocol, seed, class axis and the sorted pairs of original row and partition, so matching held-out rows can be recognised across models. `decodeStoredEvaluation` validates every stored evaluation on read.

The eight classifier adapters pass the active validated option overrides. Section 4 checks observed class counts and the user's fold count. The library is the authority for whether its split and estimator can execute. A safe rejection reopens Section 4 with a reason.

## 3. Worker messages and progress

`TrainingStartRequest` captures the dataset, target, model number, creation timestamp, configuration key and run ID together with the classifier, features and setup. Each worker processes a single start. Cancellation addresses that worker's run ID and aborts the library through its signal. Main-thread decoding checks the captured identity and payload before applying any message. Late progress, mismatched attempts and duplicate terminal replies cannot settle the run.

The worker returns progress with optional structured log entries, a result payload, a safe error code or cancellation. The session stores a compact progress snapshot and at most 250 ordered entries. Fit fractions and completed folds occupy the measurable 10–85% range. Indeterminate processing leaves the bar unset until measurable work starts. Evaluation and refit hold the last reliable fraction. Saving uses 95%. Acknowledged success uses 100%. The entry keys and bounded counts allow the builder to localise messages without exposing raw errors. See [Training Progress](components/training-progress.md).

## 4. Publication and recovery

Training holds a shared ingestion lock and an exclusive per-model lock. Start, success, cancellation and failure use the acknowledged training-domain journal. The start is published before creating the worker. On success, the service commits a checked version 2 result and the matching pending state together in IndexedDB, with the headline metrics projected from the stored evaluation. It publishes the state before enabling View Results. The envelope keeps the model and preprocessor JSON, web-ml revision, source row indices, class labels, duration, final log and `evaluation`, with the fold or holdout partitions specific to the chosen strategy. Version 1 envelopes from Phase 3 stay readable without a migration write; they open Section 6 with a message that detailed results need a new training run.

A saved result awaiting publication retains its run ID and stays at 95%. Retry and startup replay publish the same committed operation. After a failed start publication, recovery returns to a draft when no worker owns the run. The app never starts a new fit as part of this recovery. View Results validates the exact envelope again, acknowledges Section 5 and focuses Section 6 on the same route. [Application State Persistence](state-and-storage.md#6-indexeddb-reconciliation) defines the locks, journal and restoration order.

Section 6 reads the evaluation through the `$modelResults` store, which loads it with the full run identity and discards a result that no longer matches the active model. Tuned execution, model-specific results and comparison are follow-up phases.
