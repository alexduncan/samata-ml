# Machine Learning Orchestrator

**Status:** implemented — local single-target classification with One-Shot and fixed-parameter Cross-Validation.

## 1. Runtime boundary

Samatā owns the model builder, input transport, training coordination and durable results. The `web-ml` package owns stratification, fitted preprocessing, model fitting, evaluation, cross-validation and diagnostics. The [Phase 3 plan](plans/archive/web-ml-phase-3-model-training.md#implementation-and-verification-log) records the verified prebuilt revision and its public and executable hashes. The build verifies the frozen local dependency and serves the unchanged module graph, relative workers, WASM files and notices from a versioned, content-addressed same-origin directory. See [Delivery and Caching](ARCHITECTURE.md#delivery-and-caching) for isolation and installation.

The app starts one module worker at `/training.worker.js` per accepted attempt. The worker imports the verified runtime and uses the package's own worker and WASM graph. A non-isolated page stays in Training Setup with a recovery message. The browser owns the WebAssembly and shared-memory resources used by the library.

## 2. Input and evaluation

The worker reads the acknowledged dataset by ID. It reads bounded IndexedDB pages, verifies column metadata and row types, and preserves the mapping from dense accepted rows to original row indices. Rows with missing or invalid target values are excluded and counted. The worker preserves missing predictor values for the library. The transport encodes each selected feature and class without fitting statistics.

- **One-Shot.** The app requests a stratified 80/20 split with seed 42 through `stratifiedTrainTestSplit`. It supplies indexed fitting and held-out providers to `createTrainingClient().train`. The library fits preprocessing on the fitting rows and transforms the held-out rows with that state. The returned report describes held-out predictions.
- **Cross-Validation.** The app sends the selected fold count, seed 42, fixed manual options, accuracy scoring and `refit: true` to `crossValidate`. The library fits preprocessing and the model inside each fold, scores its validation rows and refits on all eligible rows. The stored folds and out-of-fold diagnostics describe the evaluation. The stored model and fitted preprocessor describe the separate full-data refit.

The eight classifier adapters pass the active validated option overrides. Section 4 checks observed class counts and the user's fold count. The library is the authority for whether its split and estimator can execute. A safe rejection reopens Section 4 with a reason.

## 3. Worker messages and progress

`TrainingStartRequest` captures the dataset, target, model number, creation timestamp, configuration key and run ID together with the classifier, features and setup. Each worker processes a single start. Cancellation addresses that worker's run ID and aborts the library through its signal. Main-thread decoding checks the captured identity and payload before applying any message. Late progress, mismatched attempts and duplicate terminal replies cannot settle the run.

The worker returns progress with optional structured log entries, a result payload, a safe error code or cancellation. The session stores a compact progress snapshot and at most 250 ordered entries. Fit fractions and completed folds occupy the measurable 10–85% range. Indeterminate processing leaves the bar unset until measurable work starts. Evaluation and refit hold the last reliable fraction. Saving uses 95%. Acknowledged success uses 100%. The entry keys and bounded counts allow the builder to localise messages without exposing raw errors. See [Training Progress](components/training-progress.md).

## 4. Publication and recovery

Training holds a shared ingestion lock and an exclusive per-model lock. Start, success, cancellation and failure use the acknowledged training-domain journal. The start is published before creating the worker. On success, the service commits a checked v1 result and the matching pending state together in IndexedDB. It publishes the state before enabling View Results. The envelope keeps the model and preprocessor JSON, web-ml revision, source row indices, class labels, duration and final log, with report data specific to the chosen strategy.

A saved result awaiting publication retains its run ID and stays at 95%. Retry and startup replay publish the same committed operation. After a failed start publication, recovery returns to a draft when no worker owns the run. The app never starts a new fit as part of this recovery. View Results validates the exact envelope again, acknowledges Section 5 and focuses Section 6 on the same route. [Application State Persistence](state-and-storage.md#6-indexeddb-reconciliation) defines the locks, journal and restoration order.

Tuned execution, detailed results rendering and comparison are follow-up phases.
