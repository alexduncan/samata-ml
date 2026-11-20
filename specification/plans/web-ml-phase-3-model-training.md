# Phase 3 — Execute classification training with progress and an expandable log

**Status:** ready-for-review | **Updated:** 2026-11-20T16:36:38Z
**Authors:** Google Antigravity (Gemini 4 Argon High), Claude Code (claude-opus-5-5), Codex (GPT-6) | **Created:** 2026-11-17T21:23:45Z
**Verified by:** — | **Verified:** — | **Verification:** pending
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour:** Valid Training Setup submission saves the setup and opens the Section 5 placeholder while the model stays a draft. The store has lifecycle actions and IndexedDB reserves a result store, but there is no training service, result writer or deployed web-ml runtime.

**Target behaviour:** **Train Model** starts local, manually configured classification in a worker. One-Shot evaluates a stratified 80/20 holdout. Cross-Validation evaluates fixed options across the chosen number of stratified folds and refits once on all eligible rows. Section 5 displays a single native progress bar, a disclosure with a chronological status log, cancellation and elapsed time on success. Successful runs store their result before publishing trained status. **View Results** acknowledges success and opens the existing Section 6 placeholder.

**Why:** Learners can run and retry a real, reproducible evaluation protocol without blocking the interface or uploading their data. Later phases can consume durable trained artefacts.

## Scope

**In scope**

- Deploy the matching prebuilt web-ml module, worker and WASM assets. Enable cross-origin isolation in development and verify the existing production headers.
- Support the eight Phase 1 classifiers for categorical or boolean targets. Use the existing option policy, feature selection and Phase 2 training setup.
- Read typed raw rows, exclude missing target rows, invoke web-ml APIs, store a versioned result and drive accessible progress and retry.
- Coordinate cancellation, reload, target changes and dataset replacement across tabs.

**Out of scope**

- Regression, hyperparameter tuning including nested CV, live or post-training timing breakdown tables, Section 6 results rendering, comparison, advanced reports and row-level outputs. See [Phases 4–7 and the WR ledger](web-ml-classification-integration.md#scope).
- Visual promotion of the Section 5 draft, a general cross-tab synchronisation redesign, and service-worker installation.

**Constraints and invariants**

- web-ml owns partition selection, preprocessing fit and transform, estimator fitting/refit and every reported metric. Samatā handles reading and packaging rows, dispatch, persistence and display.
- Dataset rows, class labels, predictions, fitted artefacts and logs stay in the browser. A fitted k-neighbours snapshot can contain training rows, so it shares the dataset deletion lifecycle.
- Strict TypeScript, TSDoc, WCAG 2.2 AA, British English, project i18n and the existing token vocabulary. Keep the training service and worker free of Lit. Worker code never imports app stores.
- Keep the existing database store/key and v1 Training Setup wire format. Read earlier drafts and progress objects. Pin the runtime and typings to one matching web-ml build.

## Required reading

- `specification/workflow-steps.md` §§3.3–3.6, `specification/components/training-setup.md` §§2–8 and `specification/components/model-configuration.md` §§2–8 — current form, options, workflow and messages.
- `specification/state-and-storage.md` §§3–8, `specification/app-state-and-navigation.md` §§6.2–7, 9.3 and `specification/data-ingestion.md` §6 — lifecycle, result storage, recovery and locking.
- `specification/ARCHITECTURE.md` §§Delivery and Caching, Routing and `specification/VISION.md` §§10–12 — browser delivery, methodological rigour and privacy.
- `specification/COMPONENTS.md` §§3–10, `specification/visual-design.md` §1.1 and §§3–6, `specification/testing.md` — component, accessibility, style and testing contracts.
- `specification/plans/web-ml-classification-integration.md` §Scope and `specification/plans/web-ml-phase-4-single-model-results.md` §Interfaces and behaviour — downstream evaluation extension.
- The web-ml public assets identified below. Have a codebase-scout verify the installed public contract at the start of T1.

## Codebase context

- **Relevant specifications:** `specification/machine-learning-orchestrator.md` is a stub. Training Setup is implemented. Workflow §3.5 still describes the execution placeholder. Known gaps 6, 13 and 14 govern worker delivery, draft styling and state synchronisation.
- **Relevant implementation:** Builder submit and placeholders `src/features/models/app-model-builder-view.ts:1398–1463,1607–1628,1673–1686`. Option normalisation `src/features/models/model-options.ts:154–216`. Setup eligibility and fold bounds `src/features/models/training-setup.ts:45–105`. Classification IDs `src/features/models/model-catalogue.ts:14–54`. Lifecycle `src/stores/app.store.ts:610–794`.
- **Storage and confirmation seams:** `src/common/storage/db.ts:16–32,45–130` has `raw_records`, paged reads and `model_results` keyed by `[datasetId, modelNum]`. The old IndexedDB ML provider fits dataset-wide transforms and is unsuitable here. `src/stores/reconciler.ts:227–337` checks for a result key and probes the model lock. `src/stores/persister.ts:461–503,559–613,717–815` reads/writes the whole v1 snapshot. `src/stores/dataset.store.ts:311–342`, `src/features/data/load-dataset.ts:15–31`, `src/features/data/app-data-view.ts:456–487,610–647` and `src/features/target/app-target-view.ts:230–298,462–493` own existing mutation and confirmation seams.
- **Build:** `scripts/build-assets.ts:31–57,94–145` builds the app and storage worker. `scripts/server.ts:342–364` delegates dev and local production serving to `scripts/static-server.ts`. `public/_headers:1–11` already configures isolation and WebAssembly CSP for production. `package.json` and `bun.lock` resolve web-ml through `file:../web-ml`.
- **Upstream provenance:** Scout verified web-ml 0.1.0 at `c31a967a61c1a55a19490f3537e00254bf7c7c86` against the matching built public declarations, catalogue and public prose in the upstream closure checkout. Canonical upstream `main` at `207c03d9cf6b4d0b3569a9ed6cba38f61e0dcc78` differs from that revision only in planning/index/request documents. Its primary checkout's generated declarations and the primary samata install linked to them are stale. The current Codex worktree has neither a local upstream sibling nor installed dependencies. Use a matching, rebuilt package for T1. Do not combine current prose with stale types or assets.
- **Public upstream contracts at the verified revision:** Catalogue under `specification/public-api/model-specifications/`; exports in `dist/index.d.ts:11` and `dist/src/training/index.d.ts:1–20`; request, label axis, provider and run in `dist/src/training/types.d.ts:23–37,51–167,504–601`; CV in `dist/src/training/cross-validate.d.ts:26–141`; split in `dist/src/training/partitions.d.ts:2–46`; tabular transport and transformer in `dist/src/training/tabular-preprocessing.d.ts:3–50,80–140`. See `specification/public-api/tabular-preprocessing.md:235–296,346–356`, `specification/public-api/metrics.md:56–81,449–456` and `specification/public-api/current-limitations.md:336–343,368–385`. The scout's public import resolved all required exports and a 10-row balanced holdout returned 8 train and 2 test indices.
- **Tests and commands:** `bun run check` on clean primary samata `8309edb` passed typechecking and 289 tests across 37 files. The same command in this worktree stopped at missing `tsc`. Existing setup journey and axe tests expect the placeholder (`tests/training-setup.e2e.ts:443–496`, `tests/a11y.e2e.ts:628–648`). Synthetic trained fixtures currently create key-only IDB results.
- **Web guidance:** `progress` for explicit naming and absent indeterminate value; `html` for first-child summary and native disclosure; `accessibility` for a dedicated polite region; `security` for cross-browser isolation. Use Web Locks shared/exclusive request callbacks and release on settlement. [Web Locks request semantics](https://www.w3.org/TR/web-locks/#dom-lockmanager-request).
- **Visual reference:** Builder shell from `specification/mockups/ui-scaffold/03-3_train-models-2-select-features.html` and `src/styles/train-model.styles.ts`. Promoted 03-6 is empty. The draft-only `specification/mockups/ui-scaffold/drafts/03-6_train-models-5-train.html` is revised in T5. Apply visual-design §1.1 and keep existing parity mappings.
- **Domain skills:** `lit-architecture-planner` applied here. `lit-component-implementer` for T4 and T5.
- **Assumptions requiring verification:** Exact deployed runtime and browser isolation checked in T1. Any replacement dependency revision must match all cited public contracts and pass T1 before execution tasks begin.

## Technical decisions

| Decision               | Chosen approach and rationale                                                                                                                                                           | Rejected alternative / trade-off                                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 — Manual evaluation | One-Shot uses library stratification at 0.2/42 and held-out training validation. Manual CV maps the saved outer count to `crossValidate.folds` and asks for a separate full-data refit. | The v1 `nested_cv` tag remains for compatibility. Tuning requires a later workflow. Refit adds one fit and supplies the model artefact for Phase 6.  |
| D2 — Raw transport     | Build one transport dictionary with `encodeTabularFeatures` and hand the schema to both train and evaluation. Request per-partition preprocessing with `standardize: false`.            | A globally fitted dataset transform leaks validation information. Transport dictionary codes carry nominal identity only.                            |
| D3 — Deployment        | Serve matching, same-origin prebuilt JS and WASM under a deterministic versioned URL, preserving their relative graph. Compile that URL into the integration worker.                    | Rebundling web-ml can rewrite its worker/WASM paths. A fetched runtime manifest would add a separate version pairing requirement.                    |
| D4 — Commit point      | Keep training cancellable until saving starts. Hold the data and model locks through the result commit and state publication. Recover post-commit crashes from a matching envelope.     | Clearing locks before the commit admits a concurrent discard. Marking trained before the transaction completes can leave a broken model.             |
| D5 — Display           | One native progress bar and one recoverable disclosure. Keep success visible until the user requests results.                                                                           | Saving per-event logs in localStorage adds write and quota pressure.                                                                                 |
| D6 — Feasibility       | Keep Phase 2's class-count UI limits. A library invalid-request takes precedence and reopens Section 4 with the reason.                                                                 | The existing input check cannot guarantee library partition feasibility. The future public feasibility API can replace the preflight in a follow-up. |

### Interfaces and behaviour

#### Dataset and upstream requests

- Capture an immutable request identity from the submit snapshot: dataset ID, target name, model number, model creation timestamp, and a canonical key for algorithm, ordered features, effective options and setup. Allocate a fresh run ID (`crypto.randomUUID()`) for the attempt. Keep the Phase 1 normaliser's active request options and reject a failed normalisation at launch. Keep fixed/hidden options omitted under the established policy. Use the algorithm discriminator and an exhaustive typed adapter for the eight catalogue IDs. Launch only with manual options, an eligible target, completed prerequisite sections and at least one selected feature.
- In the worker resolve selected columns against current dataset metadata and page `raw_records` in offset order using `getRows`. Preserve feature order, source row indices and class/row association. Exclude and count only null targets. Construct a single stable label axis by first occurrence among retained rows and write one contiguous Float64 code per retained row. Preserve boolean labels in that axis. Accept numeric, categorical and boolean features under the existing eligibility rules. Transport numeric values as numbers, categorical values verbatim and booleans as categorical strings `true` and `false`. Preserve nulls. Reject any metadata or row-type mismatch before fitting. Check abort between page reads and before starting the library run.
- Use `encodeTabularFeatures(rows, columns)` once. The index-backed `PartitionDatasetProvider` implements the public `DatasetProvider.load(features, targets?, signal?, onProgress?)` and exposes caller-allocated row-major values at the supplied indices in their supplied order. Both partitions use the same transport schema. Missing values remain available to the library as missing data. Check buffer dimensions and cancellation, and keep progress monotonic within each load. Keep retained input indices available until the run completes so a returned partition index can be traced to a source row.
- For One-Shot call `stratifiedTrainTestSplit(codes, { testRatio: 0.2, randomState: 42 })`. Call `createTrainingClient().train` with the indexed train provider as `data`, `validation: { data: testProvider }`, `classLabels`, the validated classifier options and `preprocessing: { columns, standardize: false }`. Require a held-out single-target classification report from `await run.result` and save it with the split indices. Preserve probability-metric availability tags. A missing report on a successful validated run is a contract error.
- For CV call `crossValidate` with the full prepared provider, `folds: trainingSetup.outerFolds`, `randomState: 42`, `scoring: 'accuracy'`, `classLabels`, the validated options, the same preprocessing policy and `refit: true`. Leave `includeMetrics` unset and retain the always-present classification diagnostics. Save the returned fold scores/indices, pooled diagnostics, mean score and dispersion. The refit artefact is trained on all retained rows and supplies the stored fitted model and transformer through `result.refit`. A missing requested refit or missing fitted transformer is a contract error. It does not add to the out-of-sample report.
- Send options and identifiers only in the main-to-worker request. The dedicated app worker owns row reads and the web-ml run. It copies upstream model JSON and fitted transformer JSON before disposing any disposable fitted estimator. Preserve each explicit report or estimator label axis in its own order. Do not enable SVC probabilities implicitly, replace unsupported data with made-up values or implement a fallback estimator.

#### Protocol, progress and result

- `training/protocol.ts` defines structured-cloneable messages. Main sends `start` with the run identity/request or `cancel` with the run ID. Worker sends `progress`, `success`, `failed` or `cancelled`, each with the run ID. One worker handles one attempt. Validate kind, payload and run identity before applying messages. Only the first terminal message settles, and worker `error`/`messageerror` also settle. Ignore late messages from an older attempt or mismatched dataset, target or model.
- Store compact `TrainingProgress` as `{ percent: number | null, stage: TrainingStage, phase: string | null, statusMessage: string }`. App stages are `preparing | fitting | cross-validation | refitting | evaluating | saving`. Consume each run’s `events` while awaiting `result`. Normalise training `phase`, `progress.fraction` and warning events. CV uses `fold-start`, `fold-progress`, `fold-complete`, `refit-start`, `refit-progress` and `refit-complete`. Follow the number of distinct completed folds for overall progress because the public contract does not specify a base for `foldIndex`. Terminal events and the result promise settle through the same guard. Use an indeterminate bar until a reliable run-level measure is available. One-Shot maps reported fit fractions to 10–85%. CV maps completed folds to 10–85% and never advances from a repeated or lower count. Hold the last determinate value during evaluation/refit. Saving displays 95%. Reserve 100% for a successful IDB commit. Initialise from zero or indeterminate on each new attempt.
- The session store is keyed by dataset/model/run identity and holds the latest progress plus up to 250 chronological `TrainingLogEntry` items with stable monotonically increasing IDs, timestamps, level and localisable message data. Append phase/fold boundaries, deduplicated warning codes and terminal events. Coalesce repeated ticks; retain the newest 250 when over the cap. Append the success item to the candidate envelope before saving and publish it in the live session only after commit. Persist compact ticks at the existing one-second throttle; flush entry, exit and the disclosure toggle synchronously. Cancelled or failed attempts present the terminal notice in Section 4.
- Define `ResultEnvelope` in `src/types/model-result.ts` with `schemaVersion: 1`, `datasetId`, `target`, `modelNum`, `modelCreatedAt`, `configurationKey`, `runId`, `algorithm`, `webMlRevision`, `durationMs`, `excludedTargetRows`, `featureNamesOut`, `classLabels`, `modelJson`, `preprocessorJson` and `logEntries`. Discriminate `strategy: 'one_shot'` with `holdout: { trainIndices, testIndices, report }` from `strategy: 'cross_validation'` with `crossValidation: { folds, diagnostics, meanScore, standardDeviation }`. Indices are relative to the retained rows and the envelope also stores their source-index mapping. Persist copied structured-cloneable values and the public report/transformer types. Timing uses the service's monotonic start-to-save-start interval and is displayed as total elapsed training time. Phase 4 adds its higher-level `evaluation` field independently.
- Read results through the repository. Validate version, identity, strategy, required payload field shapes and safe finite counts/timings. Persist `ModelRecord.resultRevision: string | null` with the current run ID from start through saved success; historic models decode it as null. Clear it on cancellation, failure or lost results. Require an envelope run ID equal to this revision, including when a number is reused after discard. Phase 4 uses the revision to ignore stale result reads. Legacy key-only rows are invalid results. Keep `ModelRecord.metrics` and `timings` empty for Phase 3 and retain `durationMs` for the overview. Expose `model.ui.trainingLogOpen` as a boolean-only preference, default false, updated by an action preserving other keys. Decode old progress into the new shape without discarding the rest of an otherwise valid v1 envelope.

#### Lifecycle, durability and cross-tab invalidation

- `startModelTraining` owns prep, launch and finish independently of any route. Hold `samata-ml:ingestion` shared then `samata-ml:training:{num}` exclusive, requesting both with `ifAvailable: true`. Revalidate the persisted dataset/target/model/configuration under the locks and check IDB metadata before transitioning to training. Keep a synchronous per-model pending guard from the first intent. A rejected acquisition preserves the draft and surfaces an actionable busy notice. Release the locks when the attempt and any pending result transaction settle. Distinct models may run concurrently and use distinct session entries.
- On local Cancel, keep the UI in cancelling until terminal settlement. Send cancel to the app worker, abort row loading and the web-ml run through its public cancellation mechanism, and wait for the acknowledgement or terminal event. Allow the library’s cancellation grace period to run. If the integration worker errors or reports a protocol failure, terminate it and settle once. Suppress success if cancellation won before entering saving. Once saving starts, remove Cancel and await the IDB transaction. A late confirmed discard waits for the transaction and then deletes the saved result under the exclusive lock. A write failure returns the model to draft with a retryable error. Use the worker's library error code and safe reason for invalid request (including partition rejection); do not render a stack or raw row values.
- Keep the result transaction and the state publication within the model lock. Persist the new run ID before posting start to the worker. Use a transaction that resolves on commit, then publish the same run ID, status and duration with `trainingSucceeded`. On hydrate, if the model lock is held, leave the run in progress and show the other-tab state. If the lock is free, reconcile under it while holding the shared ingestion lock: a matching committed envelope recovers a saved success; absent/invalid result returns to draft with interruption. A trained model with missing or mismatched results falls back to draft with a lost-results error. Clear stale duration, result metadata and Section 4–6 completion on either recovery to draft. Preserve Phase 2 model-local setup repairs and finish persistence before releasing the relevant locks.
- Target and dataset confirmation cancel and await any local training in the captured dataset. Then take the ingestion lock exclusively with `ifAvailable: true`, recheck the dataset/target and confirmation scope, and perform the deletion and state change inside the lock. If a shared training holder prevents acquisition, show “Training in another tab” in the still-open dialog and keep its state and results. Target change deletes all results for the active dataset in one transaction before publishing the target and resetting models. Change Dataset retains the existing transactional dataset deletion. A competing ingestion shows the existing dataset-busy error. Failed deletes keep the old selection and models; close only on success. Guard new local starts during a confirmed discard.
- Put the ingestion worker's post-success publication and old-dataset cleanup under the same exclusive resource lock, reacquired after worker success; recheck the pointer captured at ingestion start. If another mutation won, delete only the unpublished dataset created by this request. Reacquisition is queued for this terminal hand-off, while confirmed discards request the lock without waiting. Startup orphan cleanup also revalidates the persisted active pointer under the exclusive lock. Keep dataset delete RPC use inside the owning main-thread lock callback.
- The persister remains the sole localStorage writer. Before a protected training commit or destructive change, read the latest decoded domain state. Await protected persistence with the resource locks held before sending the start message, returning a successful destructive command, or settling the run. Apply protected updates to the in-memory store on successful validation and guard the subscription against echo and recursive locks. Patch only the current run/model or the confirmed dataset/target; abort on an identity conflict. For scheduled, immediate and startup writes, preserve external changes to a protected run/result/discard identity by comparing the last observed domain snapshot with the latest stored snapshot. Strip stale protected writes and keep ordinary settings on existing last-writer-wins semantics. Serialize protected domain commits under a short exclusive `samata-ml:training-state` lock, acquired inside the resource locks when both are needed; no state-lock callback requests a resource lock. Apply `storage` events to protected domain state without echo writes or navigation, and revalidate relevant dataset resources. Do not run the startup orphan check from a storage-event handler.

#### Section 5 and Lit contract

- The connected `app-model-builder-view` owns start, cancellation and View Results actions. It binds `$appState` and the keyed `$trainingSession` through `StoreController`. The service reads completed envelopes and exposes their logs through the session resource. Activate Section 5 while an accepted start is pending, for a local or remote training attempt, and for a trained model until `viewResults` marks the existing `results` completion. A rejected start leaves Section 4 active. Render completion styling/check in the header only after that action. A trained direct link from Models opens Section 5 until acknowledged; once acknowledged it opens Section 6. Section 5 remains inspectable on revisit.
- Use the Section 5 header for a local Cancel Training button and the View Results button. View Results remains disabled until success. On activation, mark viewed and focus the Section 6 heading without changing URL. Focus the Section 5 heading for an accepted explicit submit; if cancellation/failure removes the focused Section 5 control, return focus to Train Model as Section 4 opens and expose the localized error beside it. Background progress/success and remote changes do not steal focus. Keep existing route heading focus and metadata settlement separate from training.
- Tier 2 `app-training-progress` at `src/features/models/app-training-progress.ts` is presentational. Its entire custom API is `progress: TrainingProgress | null = null`, `logEntries: readonly TrainingLogEntry[] = []`, `logOpen: boolean = false`, `announcement: string = ''`, `durationText: string = ''`, and `labels: TrainingProgressLabels` with explicit English defaults for `progress`, `waiting` and `formatEntry(entry)`. Each property uses `attribute: false` and is unreflected. Export the class and labels type with TSDoc. There are no slots, public methods, parts or custom CSS properties.
- `app-training-log-toggle` is a `CustomEvent<{ readonly open: boolean }>` with `bubbles: false, composed: false` because the builder listens on the host. Use a native `toggle` listener and suppress the event if the final native open state already matches the incoming property. Repeated events or a property echo must not persist a change. Keep progress and disclosure nodes stable on ticks. Render one labelled `<progress max="100">`, omit `value` when indeterminate, and place a first-child `<summary>` with the latest status inside `<details>`. Expanded content is an `<ol>` keyed by entry ID. Mount a separate polite status region before updating it and announce meaningful phase changes, actionable warnings and completion once. Keep it quiet on ticks, log toggles and historical hydration. Keep a readable status in remote mode even though only the owner can cancel. Localise all displayed labels and durations with the app formatter.
- Use the existing button/notification and train-model modules in the builder. The progress component uses native rendering with minimal logical layout, visible existing-token focus indication and no new visual tokens or animation. Document actual visual deviations for mapped shell elements only. Stories cover queued, determinate, open and collapsed log, CV, cancelling, remote, complete, long-label and RTL. Builder, data and target stories cover their changed result/error/confirmation states. Document Do/Don't use, use manifest controls, and keep Storybook free of real workers, IndexedDB and network.

## Specification changes

- [ ] `specification/machine-learning-orchestrator.md` — Document the verified package boundary, both worker strategies, protocol and storage lifecycle; status stub → implemented.
- [ ] `specification/workflow-steps.md` §§1–3 — Document confirmation, classification execution and Section 5 acknowledgement. Keep later result and tuning work visible; status stays partial.
- [ ] `specification/components/training-setup.md` §§2, 4, 6 and 11 — Document submit-to-training, reopening and authoritative library rejection; status stays implemented.
- [ ] `specification/state-and-storage.md` §§3–8 and `specification/app-state-and-navigation.md` §§6.2–7, 9.3 and 11 — Document progress, acknowledged completion, versioned result, recovery and protected cross-tab operations. Keep unrelated open decisions; both statuses stay draft.
- [ ] `specification/ARCHITECTURE.md` — Describe the prebuilt same-origin module graph, CORS/CORP and development/production isolation. Preserve service-worker gap; status stays partial.
- [ ] `specification/components/training-progress.md` and `specification/README.md` — Add implemented component and correct the spec index. Narrow Known gap 14 to remaining state/navigation scope, and gap 13 only if affected coverage is verified.
- [ ] `specification/TODO.md`, `specification/HUMAN.md` — Resolve Phase 3 portions of TODO-04, TODO-21, TODO-33, TODO-50 and TODO-51. Keep later timing/reporting scope, public feasibility follow-up and styling/promotion on the queue.

## Implementation tasks

### T1 — Deliver a matching browser runtime

- **Depends on:** None
- **Risk:** needs care — relative asset resolution, generated package provenance and isolation.
- **Likely files:** `scripts/build-assets.ts`, `scripts/build-model-assets.ts`, `scripts/static-server.ts`, `scripts/server.ts`, `tests/model-assets.test.ts`, `tests/training-runtime.e2e.ts`, `tests/fixtures/training/runtime.worker.ts`, `playwright.config.ts`
- **Must not touch:** `node_modules/`, `bun.lock`, `public/_headers`, `src/`
- **Implementation:** Verify the installed public exports/types and revision before proceeding. Use the existing local file dependency resolved to a coherent build. From the installed dist, copy the executable JS graph and relative WASM assets with their notices. Include both training orchestrators, the probe and compute worker bundles, including the libraries used by SVC and logistic regression. Omit declarations and package source from public output. Build a deterministic graph digest for its URL and pass it to the worker build. Add WASM MIME and existing production isolation headers to the shared static handler. Check existing remote sample CSVs still load with CORS. Use a production-serving test context as well as the dev server. A training request in a non-isolated context fails before launch and leaves the model in draft.
- **Acceptance criteria:**
    - [ ] `WML-P3-ASSET-1` — Both servers return isolated documents and same-origin worker assets with correct MIME, including SVC WASM. Missing/incoherent required inputs fail the build with the offending package path.
    - [ ] `WML-P3-ASSET-2` — A module worker imports the deployed URL, completes a real classification run including the SVC bundle smoke test, and handles cancellation in Chromium, Firefox and WebKit. Non-isolation blocks training with a recoverable message.
- **Verification:** `bun test tests/model-assets.test.ts`; `bun run test:e2e tests/training-runtime.e2e.ts`; `bun run check`; `bun run build`.
- **Progress:** [ ] Not started

### T2 — Hand off data and invoke both public training strategies

- **Depends on:** T1
- **Risk:** needs care — row alignment, transport encoding, and no cross-partition fit leakage.
- **Likely files:** `src/features/models/training/prepare-classification.ts`, `src/features/models/training/partition-provider.ts`, `src/features/models/training/classifier-adapters.ts`, `src/features/models/training/types.ts`, `tests/classification-preparation.test.ts`, `tests/partition-provider.test.ts`, `tests/classifier-adapters.test.ts`
- **Must not touch:** `src/common/storage/indexeddb-dataset-provider.ts`, `src/features/data/ingestion/`, `bun.lock`
- **Implementation:** Implement the transport, providers and exhaustive option-to-request adapter above. Exercise upstream data and label axes with realistic mixed features, sample data and missing targets. Record fit output before disposal; preserve library diagnostic categories instead of inventing metrics.
- **Acceptance criteria:**
    - [ ] `WML-P3-DATA-1` — Paging preserves feature and row order for mixed, missing and unseen categories; excluded targets are counted and never enter either partition. A fixed seed reproduces the upstream split or fold indices.
    - [ ] `WML-P3-DATA-2` — Indexed loading fills precisely the requested buffers and propagates abort. Reordering columns or row indices cannot silently pair a label with another row.
    - [ ] `WML-P3-DATA-3` — Request construction is checked for all eight classifiers in both modes. In T5 all eight complete both strategies in a real browser on compatible fixtures. CV honours the manual fold count, One-Shot scores holdout rows, and an infeasible split or model-domain failure returns a typed error. Fit statistics are learned from fitting rows even when validation has a category absent from fitting.
- **Verification:** `bun test tests/classification-preparation.test.ts`; `bun test tests/partition-provider.test.ts`; `bun test tests/classifier-adapters.test.ts`; `bun run check`.
- **Progress:** [ ] Not started

### T3 — Define worker messages, progress and durable results

- **Depends on:** T2
- **Risk:** needs care — v1 compatibility and the result transaction boundary.
- **Likely files:** `src/types/state.ts`, `src/types/model-result.ts`, `src/common/storage/db.ts`, `src/stores/app.store.ts`, `src/stores/persister.ts`, `src/stores/training.store.ts`, `src/features/models/training/`, `scripts/build-assets.ts`, `tests/training-progress.test.ts`, `tests/training-protocol.test.ts`, `tests/model-results.test.ts`, `tests/storage-db.test.ts`, `tests/state-and-storage.test.ts`, `tests/column-eligibility.test.ts`, `tests/dataset-resources.test.ts`, `tests/visual-parity/fixtures.ts`
- **Must not touch:** `src/router/`, `src/features/data/ingestion/`, `css/root.css`
- **Implementation:** Implement the single-attempt integration worker, protocol and event mapping, result repository and decoder, progress/session stores and Phase 3 lifecycle fields. Replace the app-private training action arguments with run-scoped equivalents, update their existing tests and preserve the unrelated configuration actions and v1 fixture compatibility. Add a production entry for `/training.worker.js`. Keep library errors and warning categories behind the normaliser.
- **Acceptance criteria:**
    - [ ] `WML-P3-EVENT-1` — Fixed CV and training events produce finite, monotonic progress once determinate, with 100% reserved for saved success. Warnings and terminal events are bounded and chronological. Invalid, duplicate and stale messages never mutate the current run.
    - [ ] `WML-P3-EVENT-2` — Both envelopes round-trip with their own evaluation and label axes; bad version, identity, payload or empty legacy envelopes fail validation. A write rejected before transaction commit reports failure.
    - [ ] `WML-P3-EVENT-3` — Existing v1 setup and draft state survive a round trip. Logs stay out of localStorage. Only matching run state can publish a terminal outcome.
- **Verification:** `bun test tests/training-progress.test.ts`; `bun test tests/training-protocol.test.ts`; `bun test tests/model-results.test.ts`; `bun test tests/storage-db.test.ts`; `bun run check`; `bun run build`.
- **Progress:** [ ] Not started

### T4 — Coordinate training, cancellation, reload and dataset/target changes

- **Depends on:** T3
- **Risk:** needs care — races from stale tabs, crashes or pending IDB writes.
- **Likely files:** `src/app.ts`, `src/stores/app.store.ts`, `src/stores/persister.ts`, `src/stores/reconciler.ts`, `src/stores/dataset.store.ts`, `src/stores/training.store.ts`, `src/features/data/load-dataset.ts`, `src/features/data/app-data-view.ts`, `src/features/data/app-data-view.stories.ts`, `src/features/target/app-target-view.ts`, `src/features/target/app-target-view.stories.ts`, `src/features/models/training/training-service.ts`, `src/features/models/training/result-repository.ts`, `tests/storage-client.test.ts`, `tests/training-service.test.ts`, `tests/reconciler-indexeddb.test.ts`, `tests/state-and-storage.test.ts`, `tests/training-concurrency.e2e.ts`, `tests/target-selection.e2e.ts`
- **Must not touch:** `src/router/`, `src/features/data/ingestion/`, `css/root.css`
- **Implementation:** Implement the service and coordination rules above. Route store consumption through connected views. Keep dialog controls and focus usable while a busy attempt is refused. Use injected worker, lock and storage seams for reproducible unit races and real browser contexts for cross-tab journeys.
- **Acceptance criteria:**
    - [ ] `WML-P3-TRAIN-1` — A duplicate start is rejected, a stale tab cannot start for a replaced dataset/model, and a concurrent run on another model preserves its outcome. A successful save publishes only after IDB commit.
    - [ ] `WML-P3-TRAIN-2` — Cancel and worker failure release locks once. Cancelling before saving publishes no result. A completed save racing discard is deleted before the replacement state appears.
    - [ ] `WML-P3-TRAIN-3` — Reload distinguishes another tab, interruption and a committed success awaiting publication. A missing/mismatched trained result clears just that model's stale training state. Cross-tab update never navigates the receiving tab.
    - [ ] `WML-P3-TRAIN-4` — Confirmation aborts local runs or reports the remote lock without deleting state. Old-dataset cleanup and stale tabs cannot delete replacement data or resurrect discarded runs. Dialog failure preserves focus and allows retry.
- **Verification:** `bun test tests/training-service.test.ts`; `bun test tests/reconciler-indexeddb.test.ts`; `bun test tests/storage-client.test.ts`; `bun run test:e2e tests/training-concurrency.e2e.ts`; `bun run test:e2e tests/target-selection.e2e.ts`; `bun run test:stories`; `bun run check`.
- **Progress:** [ ] Not started

### T5 — Connect Section 5 and deliver the accessible training journey

- **Depends on:** T4
- **Risk:** needs care — announcement frequency, focus and completion across reloads.
- **Likely files:** `src/features/models/app-model-builder-view.ts`, `src/features/models/app-model-builder-view.stories.ts`, `src/features/models/app-training-progress.ts`, `src/features/models/app-training-progress.stories.ts`, `specification/mockups/ui-scaffold/drafts/03-6_train-models-5-train.html`, `tests/classification-training.e2e.ts`, `tests/training-panels.e2e.ts`, `tests/training-setup.e2e.ts`, `tests/models-overview.e2e.ts`, `tests/a11y.e2e.ts`, `tests/visual-parity.e2e.ts`, `tests/visual-parity/fixtures.ts`, `tests/journeys/iris-classification.e2e.ts`, `tests/journeys/penguins-classification.e2e.ts`
- **Must not touch:** `css/root.css`, `src/features/models/app-model-card.ts`, `specification/mockups/ui-scaffold/03-6_train-models-5-train.html`
- **Implementation:** Connect valid submission to the service, add the progress component and alert/retry path and restore logs on return. Update the unstyled draft to match the native controls and Phase 3 states. Update the existing setup placeholder assertions and key-only result fixtures. Keep fixture-controlled lifecycle tests separate from genuine end-to-end worker runs. Exercise the real eight-classifier matrix from T2 through the worker in Chromium; cover both routes in the three-engine journeys as well.
- **Acceptance criteria:**
    - [ ] `WML-P3-UI-1` — Valid Phase 2 submit starts exactly one attempt. Section 5 shows one labelled bar and an expandable ordered log with the latest message in its summary. The preference survives reload and milestones alone are announced.
    - [ ] `WML-P3-UI-2` — Failure, cancellation and an authoritative upstream partition error reopen Section 4 with a reason. After saving, the bar reads 100%, the elapsed time is displayed and View Results enables. Section 5's completion check appears after activation, and focus moves to Section 6.
    - [ ] `WML-P3-UI-3` — Worker training continues across route changes. Local/remote, cancelled, failed and successful states pass real browser axe, keyboard and responsive tests. Record manual checks for VoiceOver/Safari, 200% browser zoom, 320 px reflow, long labels, RTL, forced colours and reduced motion. Note any unavailable manual environment.
- **Verification:** `bun run test:e2e tests/training-panels.e2e.ts`; `bun run test:e2e tests/classification-training.e2e.ts`; `bun run test:e2e tests/training-setup.e2e.ts`; `bun run test:e2e tests/models-overview.e2e.ts`; `bun run test:e2e tests/a11y.e2e.ts`; `bun run test:e2e tests/visual-parity.e2e.ts`; `bun run test:e2e tests/journeys/iris-classification.e2e.ts`; `bun run test:e2e tests/journeys/penguins-classification.e2e.ts`; `bun test tests/style-tokens.test.ts`; `bun run test:stories`; `bun run check`.
- **Progress:** [ ] Not started

### T6 — Sync specification

- **Depends on:** T1, T2, T3, T4, T5
- **Risk:** routine
- **Likely files:** `specification/machine-learning-orchestrator.md`, `specification/workflow-steps.md`, `specification/state-and-storage.md`, `specification/app-state-and-navigation.md`, `specification/ARCHITECTURE.md`, `specification/components/training-setup.md`, `specification/components/training-progress.md`, `specification/README.md`, `specification/TODO.md`, `specification/HUMAN.md`, `specification/plans/README.md`, `specification/plans/web-ml-phase-3-model-training.md`
- **Must not touch:** `src/`, `tests/`, `specification/mockups/`
- **Implementation:** Apply each Specification changes item with present-tense behaviour and align statuses. Keep visual promotion and later work in the queue. Record each task commit ID as the task lands.
- **Acceptance criteria:**
    - [ ] `WML-P3-SPEC-1` — Each specification item is synced and ticked. Spec and plan index status checks pass and no Phase 3 section claims the placeholder still ships.
- **Verification:** `bun run plans:check specification/plans/web-ml-phase-3-model-training.md`; `bun run plans:task specification/plans/web-ml-phase-3-model-training.md --check-complete`; `bun run check`.
- **Progress:** [ ] Not started

## Verification and definition of done

- [ ] Acceptance criteria met with named evidence. Capture baseline parity/a11y failures separately from any Phase 3 regressions.
- [ ] `bun run check`, `bun run build`, `bun run test:stories`, and targeted Playwright checks pass across Chromium, Firefox and WebKit. Complete token and manual accessibility checks.
- [ ] `bun run format <changed files>` run as the final file-editing step.
- [ ] Specification changes are complete and all landed task commit IDs are logged. Task commit IDs are pending until implementation. No unintended paths changed.

## Risks and open questions

- **Blocking:** None
- **Non-blocking:** T1 requires a matching built upstream package. The canonical primary install currently links a stale dist. The verified closure build supplies the integration contract for WR-7, WR-10 and fixed CV. A shared checkout rebuild is coordinated upstream; T1 verifies the actual dependency before downstream work.
- **Non-blocking:** The separate partition feasibility request `../web-ml/specification/requests/2026-11-20-stratified-partition-feasibility.md` can improve preflight after it ships. The execution rejection remains authoritative.
- **Non-blocking:** Section 5 is draft-only visually. Human styling and promotion precede a visual port and its new parity mapping.
- **Non-blocking:** TODO-50 and prior planning cite a non-isolated fallback for an older upstream contract. The verified revision requires isolation. T1 verifies deployed headers, same-origin worker assets and existing CORS sample fetches.

## Escalations

None.

## Review fixes

None.

## Implementation and verification log

| When (UTC)           | Task | Agent (model)                            | Outcome / commands / evidence                                                                                                                                                  |
| -------------------- | ---- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-11-17T21:23:45Z | —    | Google Antigravity (Gemini 4 Argon High) | Split Phase 3 from `web-ml-classification-integration.md`; scout-verified `createTrainingClient().train`, `nestedCrossValidate`, event contracts, and lock/confirmation seams. |
| 2026-11-18T08:34:14Z | —    | Google Antigravity (Gemini 4 Argon High) | Adopted `crossValidate` recommendation, fixed 80/20 `one_shot` split, and `<details>`/`<summary>` message-log storage/live-region policy.                                      |
| 2026-11-20T16:31:01Z | —    | Codex (GPT-6)                            | Scout verified upstream exports and coherent build at c31a967. Primary samata baseline `bun run check` passed 289 tests (37 files). No Phase 3 implementation tests run.       |

## Plan review history

| Reviewed (UTC) | Agent (model) | Decision | Findings |
| -------------- | ------------- | -------- | -------- |

## Change log

| When (UTC)           | Change                                                               | Reason                                                                                                                                                                                                                                               |
| -------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-17T21:23:45Z | Initial draft                                                        | Created Phase 3 plan (model training execution with a single `<progress>` bar and `<details>`/`<summary>` message log) from the multi-phase split of `web-ml-classification-integration.md`.                                                         |
| 2026-11-18T08:34:14Z | Adopt split, log, and `crossValidate` API                            | User confirmed one-shot split policy, `<details>`/`<summary>` log persistence/a11y policy, and requested an upstream `web-ml` plan for non-tuning CV (`crossValidate`).                                                                              |
| 2026-11-19T08:47:35Z | Recorded fold-ownership decision; renumbered cross-references        | User decided `web-ml` runs folds (umbrella WR ledger); results split into Phases 4–6 and tuning renumbered to Phase 7. Blocking item (2) resolved; tasks T2/T4 await WR-7/WR-10.                                                                     |
| 2026-11-19T10:42:36Z | Moved preprocessing and splitting to `web-ml`                        | Repository boundary: T2 had `samata-ml` splitting, imputing and one-hot encoding, contrary to the 2026-11-19 fold-ownership decision. T2 now hands rows to `web-ml` and depends on WR-7/WR-10, filed as `../web-ml/specification/requests/` entries. |
| 2026-11-20T16:31:01Z | Specify fixed-parameter training against the verified upstream build | Resolve the stale nested-CV, split and preprocessing paths. Define the worker, storage, cancellation and Section 5 contracts against implemented Phase 2.                                                                                            |
| 2026-11-20T16:36:24Z | Invalidated approval                                                 | Preserve the Phase 4 resultRevision contract and make the worker acceptance checks explicit                                                                                                                                                          |
| 2026-11-20T16:36:38Z | Clarify result revision and browser evidence                         | Preserve the Phase 4 resultRevision contract and make the worker acceptance checks explicit.                                                                                                                                                         |
