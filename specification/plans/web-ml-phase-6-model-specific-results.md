# Phase 6: Display model-specific internals for the eight classifiers in Section 6

**Status:** draft | **Updated:** 2026-11-26T13:49:27Z
**Authors:** Claude Code (claude-opus-5-5) | **Created:** 2026-11-19T08:47:35Z
**Verified by:** — | **Verified:** — | **Verification:** pending
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour:** Phase 4 is implemented. Section 6 (`src/features/results/app-model-results.ts`) shows the shared results only: summary, fold strip, error views, threshold explorer and reliability diagram. `StoredEvaluation` (`src/types/model-evaluation.ts` L113-134) is `schemaVersion: 1`, and `decodeStoredEvaluation` (`src/features/results/evaluation-decoder.ts` L454-457) rejects any other version. The training worker (`src/features/models/training/training-worker.ts` L76, L95) calls `holdoutValidate` and `crossValidate` (with `refit: true`) without `onModel`. `workflow-steps.md` §3.6 requires a per-model registry in `src/config/models/{model-name}-results.ts`; none exists. Configure Model hides MLP `validationFraction` (`model-presentation-policy.ts` L253). The vendored `web-ml` 0.2.0 release provides a fitted-model hook (`onModel`), `DecisionTreeClassifier.tree_`/`nLeaves_`/`apply`/`decisionPath`, MLP `validationFraction`/`validationLossCurve_`/`bestEpoch_`, Naive Bayes `classLogPrior_`/`featureLogProb_`, `featureContributions`, `LogisticRegression.decisionFunction` and `permutationImportance`.

**Target behaviour:** Below the shared sections, Section 6 adds a **Model internals** section chosen by the model's results registry. It covers the Essential items of [metrics-and-visuals note §1 Model-Specific Internals](../notes/metrics-and-visuals.md) that need no tuning and no balanced-accuracy permutation scorer:

- **Bernoulli NB:** class priors and smoothed presence rates; presence-vs-absence weight of evidence; butterfly chart; additive evidence waterfall for an example row.
- **Gaussian NB:** per-class means and SDs; Fisher separability per feature; fitted Gaussian curves over class histograms; evidence waterfall.
- **Multinomial NB:** priors and feature shares; unit log-odds weights; ranked diverging log-odds bars; evidence waterfall.
- **KNN:** configured k, metric and weighting; neighbour vote consensus and mean neighbour distance; spoke diagram with a neighbour comparison table.
- **Logistic Regression:** standardised coefficients and odds ratios; C, penalty and active feature count; coefficient forest plot with outer-fold whiskers; linear score to sigmoid curve; evidence waterfall.
- **MLP:** final training loss, and validation loss with the best epoch when the learner set a validation share; convergence status; capacity and parameter-to-sample ratio; learning curves. Configure Model gains an optional **Validation share** for MLP.
- **SVC:** support-vector count and fraction; kernel, C and γ; signed decision-value histogram (binary); a 2D margin map when exactly two encoded features exist.
- **Decision Tree:** realised depth, node count, leaf count and mean decision-path length; a proportional decision-tree outline with row tracing.

**Why:** VISION §5 and §9 ask for visualisations matched to each model so learners can contrast inspectable models with the opaque MLP.

## Scope

**In scope**

- `StoredEvaluation` `schemaVersion: 2` with optional `insights` and `examples`; decoding of versions 1 and 2, where an invalid `insights` or `examples` block is dropped rather than failing the whole evaluation.
- Worker-side extraction through `onModel` on `holdoutValidate` and `crossValidate` (fold and refit models), with one extractor per classifier and display transforms (D3).
- Raw feature values for example rows and KNN neighbours, re-read in the worker after the run.
- The registry `src/config/models/{model-id}-results.ts` (eight files) and its closed panel-ID union.
- Fourteen presentational elements (Interfaces §C), their stories and three-browser tests; wiring into `app-model-results`; two new `ModelResultsUi` fields.
- Configure Model: an MLP **Validation share** option (D11) and its configuration-key rule.

**v2 feature-importance requirements to integrate (added 2026-11-26)**

The user placed the model-specific items of `specification/notes/feature-importance-requirements.md` (v2) in this plan. The comparison surface and the permutation engine belong to [compare-feature-importance](compare-feature-importance.md), which lands first. The next revision of this plan must integrate:

- **`PFI_DOTS` (v2 Chart 1)** in Section 6 for all eight models. It reads compare-feature-importance's stored `featureImportance` block and I5 summaries. It includes:
  - fold dots, the mean marker and the variation whisker;
  - the "hurt in n of K folds" tags and the `TOP_N` / "Show all" controls;
  - the I7 skill-gate banner, with the chart greyed but kept;
  - the single-holdout and fewer-shuffles notes;
  - the rule 1 "What this does and does not tell you" note and the "Computed on held-out data" label.

  This replaces this plan's deferral of MLP permutation importance.
- **`SIGNED_WEIGHTS` (v2 Chart 3)** for Logistic Regression, linear SVC, Bernoulli NB and Multinomial NB:
  - the "low to high" display scale and category-level centring;
  - softmax centring and pairwise NB views;
  - the odds-multiplier toggle;
  - the non-linear SVC explanatory note.

  It reconciles with this plan's coefficient forest and log-odds bars.
- **`MDI_VS_PFI` (v2 Chart 4, I9)** for the Decision Tree: per-fold `featureImportances_` summed per raw column and averaged across folds, against held-out shuffle importance shares. This replaces this plan's deferral of MDI.
- **`GAUSSIAN_DIST` (v2 Chart 5):**
  - separation bands (terciles) and the smoothing epsilon;
  - proportion bars for binary columns and the poor-fit note;
  - the "Final model structure" badge.

  It reconciles with this plan's fitted-curve panels.
- **`LOCAL_EXPLAIN` 7a, 7c and 7d:**
  - additive waterfalls summed to raw columns, with a test that additivity holds within 1e-9;
  - rule paths that translate encoded splits;
  - KNN neighbour tables with per-raw-column distance shares;
  - every row explained by its own fold model.

  It reconciles with this plan's evidence waterfall, tree outline and spoke diagram.
- **The shared `selectedClass` control (I10)** for signed and probability charts, with v2 §2 rules 1–10 and the §7 constants (`WATERFALL_TOP`, `MDI_PFI_GAP_FLAG`) where they apply.

Deferred with compare-feature-importance: I8 correlation warnings, the I4 log-loss alternative, lazy computation, `EFFECT_PLOT`, `LOCAL_EXPLAIN` 7b (approximate Shapley) and v2 Phase 3.

**Out of scope**

- Permutation importance (the MLP "global permutation importance" item). Deferred by the user on 2026-11-23 until `web-ml` scores importance with balanced accuracy ([request 01](../../../web-ml/specification/requests/2026-11-23-01-balanced-accuracy-scoring-everywhere.md)); recorded in `specification/FUTURE.md`.
- Tuning-dependent items: inner-CV selected values, KNN k-sweep, tree pruning curve, (C, γ) heatmap, NB α/τ selection ([Phase 7](web-ml-phase-7-hyperparameter-tuning.md)).
- MLP early stopping and best-weight restoration, which `web-ml` lacks ([request 03](../../../web-ml/specification/requests/2026-11-23-03-mlp-early-stopping-and-weight-decay.md)).
- Optional note items: collinearity and VIF, binarisation cutpoint overlay, simplex/α-shrinkage explorers, Voronoi/decision maps, latency ratios, partial dependence, regularisation paths, Platt status, margin band fraction, root-split stability, MDI (`featureImportances_`) — `specification/FUTURE.md`.
- Local SHAP/LIME attributions for MLP: no `web-ml` support; `specification/FUTURE.md`.
- Regression models. Hydrating the stored `modelJson`/`preprocessorJson` in the page.

**Constraints and invariants**

- **Final model:** global internals describe the One-Shot model (hook `kind: 'holdout'`) or the cross-validation refit (`kind: 'refit'`). Fold models (`kind: 'fold'`) supply fold variability (coefficient whiskers, fold loss curves) and explain each example row with the model that predicted it out of sample. The tree outline is the exception: it traces examples through the final tree (D6).
- **Hook safety:** `onModel` runs on the caller's thread (the training worker), is awaited, and a thrown error fails the run with `callback-failed` (`metrics.md` L97-137). Every extractor catches its own errors and reports "unavailable" instead. The hook copies everything it keeps into new typed arrays before it settles, and never disposes the model or the context tensors.
- `samata-ml` reads only public `web-ml` attributes and functions. It applies only the display transforms in D3 and never re-implements a model's likelihood, prediction, traversal or importance algorithm.
- Fitted models are not stored by Phase 6. Phase 3 already stores the final `modelJson`, which Phase 6 does not read.
- Phase 4 conventions apply (`components/model-results.md`):
  - Observable Plot only through `PlotController`;
  - the figure, caption and "Show data table" pattern;
  - presentational elements with `labels` objects whose defaults are empty strings, and `app-model-results` owning every string;
  - tokens only and no colour-only meaning;
  - `shownClassIndices` (more than 20 classes) for class-filtered tables;
  - WCAG 2.2 AA and i18n.
- Every output tensor is read through its runtime `shape`. An unexpected shape makes that insight part unavailable; it never throws (D10).

## Required reading

- `specification/COMPONENTS.md` §3–§10 (every UI task) and `specification/components/model-results.md` (the Phase 4 element conventions).
- `specification/plans/archive/web-ml-phase-4-single-model-results.md` §Technical decisions and §Interfaces A–C.
- `specification/notes/metrics-and-visuals.md` §1 Model-Specific Internals.
- `specification/workflow-steps.md` §3.3 (Configure Model fields) and §3.6.
- `specification/machine-learning-orchestrator.md` §2 (stored evaluation) and its configuration-key paragraph (L29).
- `web-ml` 0.2.0 public contract (installed package):
  - `node_modules/web-ml/dist/src/training/fitted-model-hook.d.ts` L6-38 and `node_modules/web-ml/specification/public-api/metrics.md` L97-137 — hook and context;
  - `holdout-validate.d.ts` L9-75 and `cross-validate.d.ts` L28-146 under `node_modules/web-ml/dist/src/training/`;
  - `node_modules/web-ml/dist/src/inspection/feature-contributions.d.ts` L9-69 and `node_modules/web-ml/specification/public-api/model-inspection.md`;
  - `trees/decision-tree-classifier.d.ts` L7-166, `neural-networks/_base.d.ts` L33-79, `bayesian/{bernoulli-nb,multinomial-nb,gaussian-nb}.d.ts`, `linear/logistic-regression.d.ts` L78-228, `distance-based/k-neighbors-classifier.d.ts` L37-76 and `support-vector-machines/support-vector-classifier.d.ts` L43-150, all under `node_modules/web-ml/dist/src/models/`;
  - `node_modules/web-ml/dist/src/types.d.ts` L12-61 (tensor and `MatrixLike`) and `node_modules/web-ml/specification/public-api/current-limitations.md` L9-17 and L347-354.

## Codebase context

- **Relevant specifications:** `specification/workflow-steps.md` §3.6 (L189-205: "Model-specific sections (Phase 6) will use a per-model registry in `src/config/models/{model-name}-results.ts`"); `specification/state-and-storage.md` §3 `ModelResultsUi` (L154-162); `specification/machine-learning-orchestrator.md` §2 (L19-21), configuration key (L29); `specification/VISION.md` §5, §9; `specification/TODO.md` TODO-41, TODO-44.
- **Persisted contract:**
  - `src/types/model-evaluation.ts`: `StoredEvaluation` L113-134; `StoredOutputs` L58-75 (`sourceRowIndex: Uint32Array` ascending; `partitionIndex`, `trueIndex`, `predictedIndex: Uint16Array`); L111 "Phases 5-7 add optional fields and bump `schemaVersion`".
  - `src/types/model-result.ts`: `PayloadBase` L54-62 (`featureNamesOut`, `sourceRowIndices`, `classLabels`, `modelJson`) and `ResultEnvelopeV2` L119 (`evaluation` at the payload's top level).
- **Decoding:**
  - `src/features/results/evaluation-decoder.ts`: L454 `decodeStoredEvaluation` is whole-or-nothing through `fail()` (L38).
  - `src/features/models/training/result-validation.ts`: L394-408 `isTrainingResultPayload` calls the decoder (L397), but L430 returns the raw stored value rather than the decoded one.
  - `src/stores/model-results.store.ts`: L71-75 is `ready` only for envelope version 2; a null decode maps to `lost`.
- **Worker:**
  - `training-worker.ts`: `execute()` L41-109.
  - `classifier-adapters.ts`: `buildClassificationRequest` L97-139 (`preprocessing: { columns, standardize: false }` L105, `evaluation` L110-115, One-Shot `returnFit: true` L118-127, CV `refit: true` L129-138); `snapshotHoldoutResult` L195-235; `snapshotCrossValidationResult` L241-280.
  - `evaluation-mapper.ts`: `mapEvaluation` L223-296 hard-codes `schemaVersion: 1` at L280; `mapOutputs` L84; `evaluationTransferables` L299.
  - `prepare-classification.ts`: reads `raw_records` by page (L40+), builds raw cells (L91-102) and keeps only encoded `features` in `PreparedClassification` (`types.ts` L11-18).
  - `progress.ts` L6 `TrainingUpdate`.
  - `onModel` is unused today.
- **Results UI:**
  - `app-model-results.ts`: sections L746-807, `buildViews` L585-694, `preferences()` L572-574, handlers L696-710, messages L57.
  - `results-view-model.ts`: `ChartCaption` L49-52; `MANY_CLASSES = 20` L321; `shownClassIndices` L357-369.
  - `charts/plot-controller.ts`: L45 `PlotController(host, getContainer, render)`.
  - Data-table pattern: `app-fold-strip.ts` L171-184.
  - Labels: `DEFAULT_FOLD_STRIP_LABELS` (`app-fold-strip.ts` L22) and the other `DEFAULT_*_LABELS` constants.
- **UI state:** `src/types/state.ts` L195-215 (`ModelResultsUi`, `DEFAULT_MODEL_RESULTS_UI`, `sanitiseModelResultsUi`); `src/stores/app.store.ts` L767 `setModelResultsUi`; `src/stores/persister.ts` L692-706 `mergeResultsUi`.
- **Configure Model:**
  - `src/features/models/model-presentation-policy.ts`: `NumberDomain` L11-21 (`min`, `minExclusive`, `max`, `integer`, `messageKey`); MLP policy L230-253 (`validationFraction: { kind: 'hidden' }` L253); `nullable-mode` examples `maxDepth` L263-268 and `binarize` L334-339.
  - `src/features/models/model-option-copy.ts`: option labels and help.
  - `src/features/models/training/training-service.ts` L174-181: the configuration key excludes MLP `validationFraction` and KNN `leafSize`.
- **Catalogue:** `src/features/models/model-catalogue.ts` L15-25 `ClassifierId`; L67 `SUPERVISED_MODELS`. `src/config/` holds only `locales.ts`.
- **Tests:**
  - Fixtures: `tests/fixtures/results/{evaluations,variants,labels}.ts`, `tests/fixtures/training/{results-v2,runtime.worker}.ts`; helpers `tests/helpers/{seed-results,mount-results-fixture}.ts`.
  - Unit: `tests/evaluation-decoder.test.ts`, `tests/evaluation-mapper.test.ts`, `tests/classifier-adapters.test.ts`, `tests/training-service.test.ts`, `tests/state-and-storage.test.ts`.
  - Browser: `tests/model-results.e2e.ts`, `tests/classification-training.e2e.ts`, `tests/a11y.e2e.ts`, `tests/journeys/{iris,penguins}-classification.e2e.ts`.
  - Record the `bun run check` baseline before T1.
- **Web guidance:** `accessibility`, `html` (`<details>`/`<summary>` for the tree outline; `<select>` with `<optgroup>` for the example picker), `forms`.
- **Visual reference:** draft only. `specification/mockups/03-7_train-models-5-results.html` (status `draft`) gains a "Model internals" section per model family (T11). `specification/mockups/03-4_train-models-3-configure-model.html` (status `draft`) gains the MLP Validation share field (T2). No parity entries.
- **Domain skills:** `lit-component-implementer` for T2 and T4–T11.
- **Upstream evidence:** `codebase-scout` read the installed `web-ml` 0.2.0 public declarations and prose on 2026-11-23 (`node_modules/web-ml/package.json` 0.2.0; `../web-ml/package.json` also 0.2.0). Unresolved documentation gaps are handled by D10 and filed as [request 15](../../../web-ml/specification/requests/2026-11-23-15-inspection-output-shapes-documentation.md).

### Review of the input note (model-specific internals)

| Note item                                                                | Decision                                                                                                                      | Why                                                                                        |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| "Inner-CV selected" metrics (NB α/τ, KNN k, LR C, SVC C/γ, tree pruning) | The parameter summary shows the **configured** values; Phase 7 adds selected values.                                          | Only tuned runs select values.                                                             |
| MLP train vs **validation** loss, best epoch                             | Shown when the learner sets the new Validation share (D11); otherwise training loss with a sentence on how to add validation. | User decision 2026-11-23; `web-ml` records validation loss only with `validationFraction`. |
| MLP global permutation importance                                        | Deferred to `FUTURE.md`.                                                                                                      | User decision 2026-11-23: wait for a balanced-accuracy importance scorer (request 01).     |
| MLP local SHAP/LIME                                                      | `FUTURE.md`.                                                                                                                  | No library support.                                                                        |
| BaobabView proportional-stream tree                                      | Nested native `<details>` outline with proportional bars and row tracing (D6).                                                | Native keyboard and screen-reader support.                                                 |
| SVC 2D hyperplane map                                                    | Only with exactly two encoded features (D7).                                                                                  | A 2D slice of a higher-dimensional boundary misleads.                                      |
| KNN 2D Voronoi (optional)                                                | `FUTURE.md`.                                                                                                                  | Optional; same 2D limitation.                                                              |

## Technical decisions

| Decision                                     | Chosen approach and rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Rejected alternative / trade-off                                                                                                                  |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 Extraction location                       | `buildClassificationRequest` passes one `onModel` hook from `src/features/models/training/insights/collector.ts`. The collector dispatches each call to the model's extractor (`insights/{model-id}.ts`), which copies public attributes and inspection outputs into plain typed arrays. After the run, `collector.finish()` returns `{ insights, examples }`, which `mapEvaluation` adds to the evaluation. All work happens in the training worker.                                                                                                                                                                                                                                                                                                                                                     | Hydrating `modelJson` in the page: synchronous prediction would block the UI (`current-limitations.md` L149-151), and fold models are not stored. |
| D2 Per-model registry                        | `src/config/models/{model-id}-results.ts` exports `results: ModelResultsConfig`. `results-registry.ts` maps `ClassifierId` to its config. `app-model-results` renders the panels in listed order inside a "Model internals" `<section>`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | JSON layouts with property paths (Phase 4 D12).                                                                                                   |
| D3 Display transforms allowed in `samata-ml` | One pure function each, in `insights/display-transforms.ts`: `exp` of stored log-probabilities; `1 − p` absence rates; WoE `log(p_c / p_other)`; odds ratio `exp(β)`; standardised coefficient `β × SD` of the transformed training column (preprocessing uses `standardize: false`); Fisher separability `Σ_c π_c (μ_jc − μ̄_j)² / Σ_c π_c σ²_jc` from `theta_`, `var_` and `classPrior_`; support-vector fraction; parameter count as the sum of `coefs_` and `intercepts_` sizes; KNN consensus (the share of returned neighbours whose label equals the model's prediction) and mean returned distance; decision-path length from `decisionPath`; per-class 20-bin histograms of transformed training columns.                                                                                         | Asking `web-ml` for each derived number: these are closed-form re-expressions of public outputs.                                                  |
| D4 Example rows                              | For every fold and holdout hook, the extractor (NB, LR, KNN, tree) calls `model.predict(validationFeatures)`. Among the displayed classes, it keeps up to two correct and two incorrect validation rows per class, choosing the lowest `sourceRowIndex`, and computes their explanations. The displayed classes are those in `classLabels` order, or the first six by training support when K > 6. `finish()` applies the same rule to the union of candidates, which gives the global selection of at most 24. It drops any candidate whose hook prediction differs from the stored `outputs.predictedIndex`. The worker then reads raw values for the selected rows and their KNN neighbours from `raw_records` (`insights/raw-rows.ts`). The selected example persists as `ModelResultsUi.exampleRow`. | Selecting after the run: fold models are disposed by then. Arbitrary user-entered rows need a data-entry UI.                                      |
| D5 Evidence waterfall                        | One `app-evidence-waterfall` for the three NB models and Logistic Regression, from `featureContributions(model, X)` (layout `rowCount × C × (featureCount + 1)`, base term first). **NB** (`score: 'joint-log-likelihood'`, C = K): plots predicted-class minus runner-up terms, which sum to the log-odds margin. **LR** (`score: 'decision-function'`): plots the predicted class's column (binary: the single `classes_[1]` column, whose sign gives the class). Shows the top 12 features by absolute term, with the rest as "Other features".                                                                                                                                                                                                                                                        | Separate waterfalls per model.                                                                                                                    |
| D6 Tree outline                              | `app-tree-outline` renders nested `<details>`/`<summary>` from the final model's `tree_` (left when `value ≤ threshold`, as documented). Levels 0–2 are open by default. A summary reads "Petal length ≤ 2.45 — 120 rows (40%) — Adelie 40, Chinstrap 40, Gentoo 40", with an `aria-hidden` proportional bar. Example paths come from the **final** model's `decisionPath`: for One-Shot, on the holdout `validationFeatures`; for CV, on the refit `trainingFeatures` row of the example. Cross-validated examples state that the final model was trained on all rows, including this one. Levels at depth 12 and below collapse to "N more nodes" summaries.                                                                                                                                            | An SVG node-link tree needs APG tree-view semantics. Tracing through fold trees would show a tree other than the one displayed.                   |
| D7 SVC margin map                            | When `featureNamesOut.length === 2`, the final-model extractor evaluates a 60 × 60 grid spanning the transformed training range ±5%. For binary models it uses `decisionFunction` (column 0 for `classes_[1]`), for multiclass `predict`. The chart draws filled regions, contours at −1, 0 and +1 (binary) with Plot `contour`, ringed support vectors (`supportVectors_`) and held-out rows as dots by true class and marker shape.                                                                                                                                                                                                                                                                                                                                                                     | Projecting many features to 2D would not draw the model's boundary.                                                                               |
| D8 Partition choice for views                | Global panels read `insights.final`; fold-variability panels read `insights.folds` (absent for One-Shot, where whiskers and fold curves are omitted with a sentence). Per-row insight arrays align with `evaluation.outputs.sourceRowIndex`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Averaging fold models into a model nobody trained.                                                                                                |
| D9 Storage and versioning                    | `mapEvaluation` writes `schemaVersion: 2` with optional `insights` and `examples`. `decodeStoredEvaluation` accepts 1 and 2 and decodes the version 1 fields unchanged. For version 2, `decodeModelInsights` and `decodeStoredExamples` (new, in `src/features/results/insights-decoder.ts`) validate their blocks separately: an invalid block is omitted, with a `console.warn`. `isTrainingResultPayload` returns the **decoded** evaluation, so dropped blocks never reach the UI. Missing insights show "Train again to see model internals".                                                                                                                                                                                                                                                        | Whole-record rejection: a malformed panel would hide the shared results. A separate IndexedDB store: a second transaction for one result.         |
| D10 Tensor handling                          | Hook tensors (`trainingFeatures`, `validationFeatures`) pass straight to `predict`, `decisionFunction`, `kneighbors`, `apply`, `decisionPath` and `featureContributions` as `MatrixLike`. Constructed inputs (grid points, single rows) are arrays of `Float64Array` rows. Outputs are read through `shape` and `iget`/`data`, and every read checks the expected shape (for example `kneighbors` `[n, k]`, `getWeights()` 1-D for binary or `[C, p]`). A mismatch marks that insight part `null`. Where prose and declarations disagree (Multinomial `featureLogProb_`, holdout `validationFeatures`), the declarations govern (`CLAUDE.md` Contract authority).                                                                                                                                         | Trusting undocumented layouts. Copying tensors into a new representation before each call.                                                        |
| D11 MLP Validation share                     | `model-presentation-policy.ts` MLP `validationFraction` becomes `{ kind: 'nullable-mode', terms: ['validation'], scale: { scale: 'linear', min: 0.05, max: 0.5, step: 0.05 }, domain: { min: 0, minExclusive: true, max: 0.5, messageKey: 'validation-share-range' }, startValue: 0.1 }`. The default stays `null` (off). The configuration key includes `validationFraction` only when it is non-null, so earlier results keep their keys. `web-ml` holds out a stratified, seeded share of each fitting partition and keeps the final weights (`current-limitations.md` L188-199). The parameter summary says so, and the loss chart marks the best epoch.                                                                                                                                              | A fixed 10% for every MLP (fewer training rows than other models); training loss only. Both rejected by the user on 2026-11-23.                   |

### Interfaces and behaviour

#### A. Stored insights (`src/types/model-evaluation.ts`)

`StoredEvaluation.schemaVersion` becomes `1 | 2`. Version 2 adds two optional fields; version 1 never has them.

```ts
export interface StoredEvaluation {
	readonly schemaVersion: 1 | 2;
	// …Phase 4 fields unchanged…
	/** Version 2 only. Absent when extraction failed or the block failed decoding. */
	readonly insights?: StoredModelInsights;
	/** Version 2 only. At most 24, ascending `sourceRowIndex`. */
	readonly examples?: readonly StoredExample[];
}

export interface StoredExample {
	readonly sourceRowIndex: number;
	readonly partitionIndex: number;
	/** Raw dataset values of the model's selected source columns, in `model.features` order. */
	readonly featureValues: readonly (string | null)[];
	/** NB and LR: from the partition model. `columnClassIndices` index `classLabels`; `values` is C × (1 + p). */
	readonly contributions?: {
		readonly score: 'joint-log-likelihood' | 'decision-function';
		readonly columnClassIndices: Uint16Array;
		readonly values: Float32Array;
	};
	/** KNN: from the partition model, ascending distance. */
	readonly neighbours?: {
		readonly sourceRowIndex: Uint32Array;
		readonly distance: Float32Array;
		readonly classIndex: Uint16Array;
		readonly featureValues: readonly (readonly (string | null)[])[];
	};
	/** Decision Tree: node ids in the final model's `tree_`, root first. */
	readonly path?: Uint32Array;
}

export type StoredModelInsights =
	| {
			readonly modelId: 'bernoulli-nb' | 'multinomial-nb';
			readonly featureNames: readonly string[];
			readonly final: NbInsight;
	  }
	| {
			readonly modelId: 'gaussian-nb';
			readonly featureNames: readonly string[];
			readonly final: GaussianInsight;
	  }
	| {
			readonly modelId: 'k-neighbors-classifier';
			readonly featureNames: readonly string[];
			readonly final: KnnInsight;
	  }
	| {
			readonly modelId: 'logistic-regression';
			readonly featureNames: readonly string[];
			readonly final: LinearInsight;
			readonly folds?: readonly LinearFoldInsight[];
	  }
	| {
			readonly modelId: 'mlp-classifier';
			readonly featureNames: readonly string[];
			readonly final: MlpInsight;
			readonly folds?: readonly MlpFoldInsight[];
	  }
	| {
			readonly modelId: 'support-vector-classifier';
			readonly featureNames: readonly string[];
			readonly final: SvcInsight;
	  }
	| {
			readonly modelId: 'decision-tree-classifier';
			readonly featureNames: readonly string[];
			readonly final: TreeInsight;
	  };
```

K = `classLabels.length`; p = `featureNames.length` (the encoded `featureNamesOut`); n = `outputs.sourceRowIndex.length`.

- `NbInsight = { classLogPrior: Float32Array /* K */; featureLogProb: Float32Array /* K × p; -Infinity allowed */; alpha: number; binarize: number | null /* Bernoulli only, else null */ }`.
- `GaussianInsight = { classPrior: Float32Array /* K */; theta: Float32Array; variance: Float32Array /* K × p */; histograms: { edges: Float32Array /* p × 21 */; counts: Uint32Array /* K × p × 20 */ } }`.
- `KnnInsight = { k: number; metric: string; weights: string; consensus: Float32Array | null /* n */; meanDistance: Float32Array | null /* n */ }`.
- `LinearInsight = { coefficients: Float32Array /* C × p, C = 1 binary */; columnSd: Float32Array /* p */; c: number; penalty: string; activeFeatureCount: number; decisionScores: Float32Array | null /* n × C */ }`; `LinearFoldInsight = { coefficients: Float32Array; columnSd: Float32Array }`.
- `MlpInsight = { lossCurve: Float32Array; validationLossCurve: Float32Array | null; bestEpoch: number | null; nIter: number; maxIter: number; validationShare: number | null; parameterCount: number | null; trainSampleCount: number }`; `MlpFoldInsight = { lossCurve: Float32Array; validationLossCurve: Float32Array | null }`.
- `SvcInsight = { nSupport: Uint32Array /* K */; trainSampleCount: number; kernel: string; c: number; gamma: string; decisionValues: Float32Array | null /* n, binary only */; grid: { x: Float32Array /* 60 */; y: Float32Array /* 60 */; values: Float32Array /* 3600 */; kind: 'decision' | 'class'; supportVectors: Float32Array /* nSV × 2 */ } | null }`.
- `TreeInsight = { depth: number; nodeCount: number; leafCount: number; meanPathLength: number; nodes: { feature: Int32Array /* −1 leaf */; threshold: Float32Array /* NaN leaf */; left: Int32Array; right: Int32Array; samples: Uint32Array; impurity: Float32Array; classCounts: Uint32Array /* nodeCount × K */ } }`.
- **Option sources:** `maxIter` and `validationShare` come from the effective options passed to the request, because `web-ml` keeps them protected. `c`, `penalty`, `kernel`, `gamma`, `k`, `metric`, `weights` and `alpha` come from the public option echoes.
- **Decoding:** `decodeModelInsights(value, { K, p, n, modelId })` checks every length above, finite values (except `-Infinity` in `featureLogProb` and `NaN` leaf thresholds), node child indices within range, and that `modelId` matches the result's algorithm. `decodeStoredExamples(value, { K, p, n, sourceRowIndex })` checks that each example's `sourceRowIndex` occurs in the outputs and that array lengths match.
- **Transfer:** `evaluationTransferables` includes every typed-array buffer in `insights` and `examples`.

#### B. Registry (`src/config/models/`)

```ts
export type ModelPanelId =
	| 'parameter-summary'
	| 'example-picker'
	| 'evidence-waterfall'
	| 'nb-rates-table'
	| 'nb-butterfly'
	| 'gaussian-fit'
	| 'feature-log-odds'
	| 'knn-consensus'
	| 'knn-spokes'
	| 'coefficient-forest'
	| 'sigmoid-curve'
	| 'loss-curves'
	| 'svc-decision-histogram'
	| 'svc-margin-map'
	| 'tree-outline';

export interface ModelResultsConfig {
	readonly panels: readonly ModelPanelId[];
}
```

| File                                   | Panels in order                                                                          |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| `bernoulli-nb-results.ts`              | parameter-summary, nb-rates-table, nb-butterfly, example-picker, evidence-waterfall      |
| `gaussian-nb-results.ts`               | parameter-summary, nb-rates-table, gaussian-fit, example-picker, evidence-waterfall      |
| `multinomial-nb-results.ts`            | parameter-summary, nb-rates-table, feature-log-odds, example-picker, evidence-waterfall  |
| `k-neighbors-classifier-results.ts`    | parameter-summary, knn-consensus, example-picker, knn-spokes                             |
| `logistic-regression-results.ts`       | parameter-summary, coefficient-forest, sigmoid-curve, example-picker, evidence-waterfall |
| `mlp-classifier-results.ts`            | parameter-summary, loss-curves                                                           |
| `support-vector-classifier-results.ts` | parameter-summary, svc-decision-histogram, svc-margin-map                                |
| `decision-tree-classifier-results.ts`  | parameter-summary, example-picker, tree-outline                                          |

`src/config/models/results-registry.ts` exports `modelResultsConfig(modelId: string): ModelResultsConfig | null`. Unknown ids return `null`, and no internals section renders.

#### C. Elements (`src/features/results/`, all presentational, `app-` prefix)

- **Common properties** (all `attribute: false`): `labels` (a `<Name>Labels` interface exported with `DEFAULT_<NAME>_LABELS` of empty strings or functions that return `''`; the parent supplies every string). Chart elements also take `caption: ChartCaption | null` and `formatNumber: (value: number) => string`, and expose `whenSettled(): Promise<void>` with the Phase 4 meaning.
- **View models:** types and pure builders live in `src/features/results/model-insights-view-model.ts`. Builders take insights plus `classLabels` and return preformatted views.
- **Common rules:** each element has no slots, CSS parts or custom properties. Each chart follows the Phase 4 figure, caption and data-table pattern. A `null` view renders the `unavailable` label as a sentence.

| Tag                                 | Properties beyond the common ones                                    | Events (bubbles and composed, matching Phase 4: the connected parent listens across its shadow root) | Behaviour                                                                                                                                                                                                                                                      |
| ----------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app-parameter-summary`             | `items: readonly { term: string; value: string }[]`                  | none                                                                                                 | `<dl>` of configured hyperparameters and model facts, for example "Support vectors: 26 (22% of training rows)", "Stopped after 143 of 200 iterations" or the iteration-limit sentence, "Validation share: 10%; the model keeps its last weights". Not a chart. |
| `app-example-picker`                | `examples: readonly ExampleOptionView[]`, `selected: number \| null` | `app-example-change` `{ sourceRowIndex: number }`                                                    | Labelled native `<select>` with an `<optgroup>` per true class; each option states correct or incorrect in text. Not a chart.                                                                                                                                  |
| `app-evidence-waterfall` (Plot)     | `waterfall: WaterfallView \| null`                                   | none                                                                                                 | D5. Each feature bar is labelled with the feature name and raw value; the final bar names the predicted class.                                                                                                                                                 |
| `app-nb-rates-table`                | `table: NbRatesView \| null`                                         | none                                                                                                 | Priors row plus per-feature, per-class rates (Bernoulli presence, Multinomial share, Gaussian mean ± SD), with WoE or Fisher columns where applicable. Classes follow `shownClassIndices`. `-Infinity` reads "Zero (no smoothing)". Not a chart.               |
| `app-nb-butterfly` (Plot)           | `butterfly: ButterflyView \| null`                                   | none                                                                                                 | Binary classes, or predicted vs runner-up overall: presence rates mirrored per feature, sorted by absolute WoE.                                                                                                                                                |
| `app-gaussian-fit` (Plot)           | `fits: GaussianFitView \| null`                                      | none                                                                                                 | Small multiples, at most 8 features by Fisher ratio, with the rest named: class histograms as steps and fitted normal curves, class shown by colour and line dash.                                                                                             |
| `app-feature-log-odds` (Plot)       | `weights: LogOddsView \| null`                                       | none                                                                                                 | Ranked diverging bars of the top 20 features by absolute log-odds weight for the predicted/runner-up pair.                                                                                                                                                     |
| `app-knn-consensus` (Plot)          | `consensus: ConsensusView \| null`                                   | none                                                                                                 | Histogram of neighbour consensus over held-out rows, with mean distance in the caption.                                                                                                                                                                        |
| `app-knn-spokes` (Plot)             | `spokes: SpokesView \| null`                                         | none                                                                                                 | Query at the centre, neighbours at equal angles with radius = distance, marker shape and label by class; a neighbour comparison `<table>` (distance, class, raw feature values).                                                                               |
| `app-coefficient-forest` (Plot)     | `forest: ForestView \| null`, `classIndex: number`                   | `app-coefficient-class-change` `{ classIndex: number }`                                              | Dots are final standardised coefficients; whiskers span min–max across folds (CV only); odds ratios in the table; class `<select>` for one-vs-rest multiclass.                                                                                                 |
| `app-sigmoid-curve` (Plot)          | `curve: SigmoidView \| null`                                         | none                                                                                                 | Logistic curve over the decision-score range, with held-out rows as dots at their scores (vertically jittered by true class, marker shape by class); binary or the selected one-vs-rest class.                                                                 |
| `app-loss-curves` (Plot)            | `curves: LossCurvesView \| null`                                     | none                                                                                                 | Final training loss (solid), validation loss (dashed) when present, fold curves as thin lines, a best-epoch rule, and the gap in the caption.                                                                                                                  |
| `app-svc-decision-histogram` (Plot) | `histogram: DecisionHistogramView \| null`                           | none                                                                                                 | Binary: held-out decision values by true class, with rules at −1, 0 and +1 labelled "margin" and "boundary". Multiclass: the sentence that pairwise values are not shown.                                                                                      |
| `app-svc-margin-map` (Plot)         | `map: MarginMapView \| null`                                         | none                                                                                                 | D7, or the two-feature explanation sentence.                                                                                                                                                                                                                   |
| `app-tree-outline`                  | `tree: TreeOutlineView \| null`, `path: readonly number[]`           | none                                                                                                 | D6. A summary list (depth, nodes, leaves, mean path length) above the outline. Not a chart; no `formatNumber` or `whenSettled`.                                                                                                                                |

**Connected changes (`app-model-results`):**

- It gains a "Model internals" `<section>` with an `<h3>`, rendering the panels from `modelResultsConfig(model.modelId)` after the calibration section.
- Its messages (key `app-model-results`) gain every internals string.
- `app-example-change` and `app-coefficient-class-change` call `setModelResultsUi(num, { exampleRow })` and `setModelResultsUi(num, { coefficientClass })`, then `flushNow`.
- `whenSettled()` also awaits the internals charts.
- When `insights` is absent it shows "Train again to see model internals".

**State:**

- `ModelResultsUi` (`src/types/state.ts`) gains `exampleRow: number | null` (default `null`, meaning the first example) and `coefficientClass: number` (default `0`).
- `sanitiseModelResultsUi` clamps each field to a valid example or class, or resets it to the default.
- No new store. `app-model-results` remains the only connected element.

**Accessibility and strings:**

- Accessible names come from the figure caption or the `<label>`.
- Keyboard: native `<select>` and `<details>`; no custom key handling.
- Strings are owned by `app-model-results`; every presentational element owns none.
- Manual checks: VoiceOver with Safari through the tree outline and one waterfall; keyboard-only example selection; forced colours; 200% zoom.

#### D. Configure Model (D11)

- Policy as in D11. `model-option-copy.ts` adds `validationFraction` copy: label "Validation share"; help "Holds back a share of the training rows to measure loss on rows the network does not learn from. The model still keeps its last weights."; mode labels "Off" and "Hold back a share"; `validation-share-range` "Enter a share above 0 and at most 0.5".
- The term `validation` is added to the glossary terms if the policy requires it.
- The configuration key (`training-service.ts` L174-181) still omits `validationFraction` when it is `null`, and includes it otherwise.

## Specification changes

- [ ] `specification/workflow-steps.md` §3.3: the MLP Validation share field. §3.6: the Model internals section, registry location and panel list, final versus fold models, example rows, permutation importance deferred. Status remains partial.
- [ ] `specification/state-and-storage.md` §3: `ModelResultsUi.exampleRow` and `coefficientClass`.
- [ ] `specification/machine-learning-orchestrator.md`: stored evaluation version 2 and the drop-not-reject rule (§2); `onModel` extraction and memory bounds (24 examples, 20-bin histograms, 60 × 60 grid); configuration key with a non-null `validationFraction`.
- [ ] `specification/components/model-internals.md` (new): closed APIs for the fourteen elements; status implemented. `specification/components/model-results.md`: the internals section and new preferences. `specification/components/model-configuration.md`: Validation share. `specification/README.md`: an index row for model-internals.
- [ ] `specification/FUTURE.md`: MLP permutation importance (after request 01), MLP local attribution (SHAP/LIME), KNN Voronoi map, collinearity/VIF, regularisation paths, partial dependence, root-split stability, MDI, binarisation cutpoint overlay, simplex/α explorers, Platt status, margin band fraction.
- [ ] `specification/TODO.md` and `specification/HUMAN.md`: TODO-41 model-specific part resolved; TODO-44 contrast addressed through loss curves (importance deferred); a HUMAN item to style the internals and Validation share draft sections.

## Implementation tasks

### T1 — Insight types, version 2 decoding, example selection and the registry

- **Depends on:** None
- **Risk:** needs care — extends a shared persisted contract; version 1 results must keep rendering.
- **Likely files:** `src/types/model-evaluation.ts`, `src/features/results/evaluation-decoder.ts`, `src/features/results/insights-decoder.ts`, `src/features/models/training/result-validation.ts`, `src/features/models/training/insights/example-selection.ts`, `src/config/models/results-registry.ts`, `src/config/models/*-results.ts`, `tests/fixtures/results/insights.ts`, `tests/evaluation-decoder.test.ts`, `tests/insights-decoder.test.ts`, `tests/example-selection.test.ts`, `tests/results-registry.test.ts`, `tests/model-results.test.ts`
- **Must not touch:** `src/features/results/app-*.ts`, `src/features/models/training/training-worker.ts`, `src/features/models/training/classifier-adapters.ts`
- **Implementation:** Implement Interfaces §A–B and D9. `selectExamples(candidates, outputs, classLabels, classSupport)` implements the D4 rule as a pure function. `isTrainingResultPayload` returns the decoded evaluation. One hand-built fixture per model id (iris for multiclass, breast-cancer for binary-only panels).
- **Acceptance criteria:**
  - [ ] `WML-P6-EVAL-1` — Version 1 and version 2 fixtures decode. An invalid `insights` or `examples` block is dropped while the rest decodes, and the decoded envelope omits it. Every length and range rule has a negative test. `-Infinity` in `featureLogProb` is accepted, and `NaN` elsewhere is rejected.
  - [ ] `WML-P6-EVAL-2` — `selectExamples` returns the documented rows for the iris and breast-cancer fixtures: at most 24, ascending `sourceRowIndex`, stable across calls. A class with no incorrect rows contributes only correct rows. Candidates whose prediction differs from `outputs.predictedIndex` are dropped. With K > 6, only the six best-supported classes appear.
  - [ ] `WML-P6-EVAL-3` — Every `ClassifierId` has a registry entry with valid, unique `ModelPanelId`s; unknown ids return `null`.
- **Verification:** `bun test tests/evaluation-decoder.test.ts tests/insights-decoder.test.ts tests/example-selection.test.ts tests/results-registry.test.ts tests/model-results.test.ts`; `bun run check`.
- **Progress:** [ ] Not started

### T2 — MLP Validation share in Configure Model

- **Depends on:** None
- **Risk:** routine
- **Likely files:** `src/features/models/model-presentation-policy.ts`, `src/features/models/model-option-copy.ts`, `src/features/models/training/training-service.ts`, `specification/mockups/03-4_train-models-3-configure-model.html`, `tests/model-presentation-policy.test.ts`, `tests/training-service.test.ts`, `tests/model-configuration.e2e.ts`
- **Must not touch:** `src/features/results/`, `css/root.css`
- **Implementation:** Interfaces §D and D11. Add the field to the 03-4 draft's MLP section as unstyled semantic HTML.
- **Acceptance criteria:**
  - [ ] `WML-P6-CFG-1` — The MLP form shows Validation share as Off by default. Turning it on starts at 0.1. Values ≤ 0 or > 0.5 show the range message and block saving; 0.05–0.5 save.
  - [ ] `WML-P6-CFG-2` — The configuration key is unchanged for `validationFraction: null` (an existing-key fixture) and differs for 0.1 vs 0.2. The saved value reaches the training request.
- **Verification:** `bun test tests/model-presentation-policy.test.ts tests/training-service.test.ts`; `bun run test:e2e tests/model-configuration.e2e.ts`; `bun run check`.
- **Progress:** [ ] Not started

### T3 — Extract insights in the worker through `onModel`

- **Depends on:** T1, T2
- **Risk:** needs care — hook failures fail the run, and extraction must not keep models alive or slow training disproportionately.
- **Likely files:** `src/features/models/training/insights/collector.ts`, `src/features/models/training/insights/bernoulli-nb.ts`, `src/features/models/training/insights/gaussian-nb.ts`, `src/features/models/training/insights/multinomial-nb.ts`, `src/features/models/training/insights/k-neighbors-classifier.ts`, `src/features/models/training/insights/logistic-regression.ts`, `src/features/models/training/insights/mlp-classifier.ts`, `src/features/models/training/insights/support-vector-classifier.ts`, `src/features/models/training/insights/decision-tree-classifier.ts`, `src/features/models/training/insights/display-transforms.ts`, `src/features/models/training/insights/raw-rows.ts`, `src/features/models/training/classifier-adapters.ts`, `src/features/models/training/training-worker.ts`, `src/features/models/training/evaluation-mapper.ts`, `tests/insight-extractors.test.ts`, `tests/display-transforms.test.ts`, `tests/evaluation-mapper.test.ts`, `tests/classifier-adapters.test.ts`, `tests/classification-training.e2e.ts`
- **Must not touch:** `src/features/results/`, `node_modules/`
- **Implementation:**
  - D1, D3, D4, D6–D8 and D10. `buildClassificationRequest` sets `onModel: collector.hook` on both protocols. Each extractor wraps its work in `try`/`catch`, records `null` parts on failure, and adds one training-log note per failed extractor.
  - Provider row positions map to `outputs.sourceRowIndex` through the same index space `mapOutputs` uses.
  - KNN neighbour indices are positions in the fold's `trainingIndices`. Neighbour labels come from `prepared.targetCodes`.
  - `raw-rows.ts` reads only the needed `raw_records` rows after the run, before the success reply.
  - `mapEvaluation` writes `schemaVersion: 2` plus `collector.finish()`. One training-log note records the extraction time.
- **Acceptance criteria:**
  - [ ] `WML-P6-EXTRACT-1` — With fake models exposing the 0.2.0 public members, each extractor's output decodes and copies values unchanged. Display transforms match hand-computed values (odds ratio, WoE, Fisher ratio, SV fraction, parameter count, consensus, histogram counts). An extractor that throws, or sees an unexpected tensor shape, yields `null` parts and the run still succeeds.
  - [ ] `WML-P6-EXTRACT-2` — Real training of all eight classifiers on iris, and of SVC, tree, LR and the NB models on breast-cancer, stores insights and examples that decode. One-Shot runs have no `folds`; five-fold Logistic Regression and MLP have five. Example rows carry raw feature values equal to the dataset's.
  - [ ] `WML-P6-EXTRACT-3` — The SVC grid exists only with two encoded features. KNN consensus values lie in [0, 1]. Tree child indices are in range, and each example path ends at a leaf. MLP trained with Validation share 0.1 stores a validation curve as long as the training curve.
- **Verification:** `bun test tests/insight-extractors.test.ts tests/display-transforms.test.ts tests/evaluation-mapper.test.ts tests/classifier-adapters.test.ts`; `bun run test:e2e tests/classification-training.e2e.ts`; `bun run check`; `bun run build`.
- **Progress:** [ ] Not started

### T4 — Shared internals elements: parameter summary, example picker, evidence waterfall

- **Depends on:** T1
- **Risk:** routine
- **Likely files:** `src/features/results/model-insights-view-model.ts`, `src/features/results/app-parameter-summary.ts`, `src/features/results/app-parameter-summary.stories.ts`, `src/features/results/app-example-picker.ts`, `src/features/results/app-example-picker.stories.ts`, `src/features/results/app-evidence-waterfall.ts`, `src/features/results/app-evidence-waterfall.stories.ts`, `tests/model-insights-view-model.test.ts`, `tests/internals-shared.e2e.ts`
- **Must not touch:** `css/root.css`, `src/stores/`
- **Implementation:** Interfaces §C and D5. Stories: Binary, Multiclass, ManyFeatures, IterationLimit, Unavailable, LongLabel and RTL, each with Do / Don't guidance.
- **Acceptance criteria:**
  - [ ] `WML-P6-UI-1` — The waterfall's bars sum (within 1e-6) to the margin stated in its caption. At most 13 bars render (12 plus "Other features"), and the data table lists every feature.
  - [ ] `WML-P6-UI-2` — The example picker groups options by class with correct/incorrect text and emits one event per change.
- **Verification:** `bun test tests/model-insights-view-model.test.ts`; `bun run test:e2e tests/internals-shared.e2e.ts`; `bun run test:stories`; `bun run check`.
- **Progress:** [ ] Not started

### T5 — Naive Bayes panels

- **Depends on:** T4
- **Risk:** routine
- **Likely files:** `src/features/results/model-insights-view-model.ts`, `src/features/results/app-nb-rates-table.ts`, `src/features/results/app-nb-rates-table.stories.ts`, `src/features/results/app-nb-butterfly.ts`, `src/features/results/app-nb-butterfly.stories.ts`, `src/features/results/app-gaussian-fit.ts`, `src/features/results/app-gaussian-fit.stories.ts`, `src/features/results/app-feature-log-odds.ts`, `src/features/results/app-feature-log-odds.stories.ts`, `tests/model-insights-view-model.test.ts`, `tests/internals-naive-bayes.e2e.ts`
- **Must not touch:** `css/root.css`, `src/stores/`
- **Implementation:** Interfaces §C.
- **Acceptance criteria:**
  - [ ] `WML-P6-UI-3` — Bernoulli butterfly rows are sorted by absolute WoE and mirror the stored rates. Gaussian small multiples show at most eight features and name the omitted ones. Multinomial bars show the top 20 by absolute weight.
  - [ ] `WML-P6-UI-4` — Rates tables reproduce stored values (after `exp`) to four decimals. `-Infinity` cells read "Zero (no smoothing)". More than 20 classes use `shownClassIndices`.
- **Verification:** `bun test tests/model-insights-view-model.test.ts`; `bun run test:e2e tests/internals-naive-bayes.e2e.ts`; `bun run test:stories`; `bun run check`.
- **Progress:** [ ] Not started

### T6 — KNN panels

- **Depends on:** T4
- **Risk:** routine
- **Likely files:** `src/features/results/model-insights-view-model.ts`, `src/features/results/app-knn-consensus.ts`, `src/features/results/app-knn-consensus.stories.ts`, `src/features/results/app-knn-spokes.ts`, `src/features/results/app-knn-spokes.stories.ts`, `tests/internals-knn.e2e.ts`
- **Must not touch:** `css/root.css`, `src/stores/`
- **Implementation:** Interfaces §C.
- **Acceptance criteria:**
  - [ ] `WML-P6-UI-5` — The spoke chart shows k labelled neighbours. The comparison table lists each neighbour's distance, class and raw feature values in ascending distance. `k = 1` renders one spoke and a sentence about memorisation. Missing neighbours show the unavailable sentence.
- **Verification:** `bun run test:e2e tests/internals-knn.e2e.ts`; `bun run test:stories`; `bun run check`.
- **Progress:** [ ] Not started

### T7 — Logistic Regression panels

- **Depends on:** T4
- **Risk:** routine
- **Likely files:** `src/features/results/model-insights-view-model.ts`, `src/features/results/app-coefficient-forest.ts`, `src/features/results/app-coefficient-forest.stories.ts`, `src/features/results/app-sigmoid-curve.ts`, `src/features/results/app-sigmoid-curve.stories.ts`, `tests/internals-logistic.e2e.ts`
- **Must not touch:** `css/root.css`, `src/stores/`
- **Implementation:** Interfaces §C and D8.
- **Acceptance criteria:**
  - [ ] `WML-P6-UI-6` — Cross-validated runs show whiskers spanning the fold min–max. One-Shot runs show dots only, with the sentence about folds. L1 and Elastic Net models state the active feature count. The class select switches classes for multiclass and emits one event per change.
  - [ ] `WML-P6-UI-7` — The sigmoid chart plots every held-out row at its stored decision score, with markers that differ by shape per class.
- **Verification:** `bun run test:e2e tests/internals-logistic.e2e.ts`; `bun run test:stories`; `bun run check`.
- **Progress:** [ ] Not started

### T8 — MLP panels

- **Depends on:** T4
- **Risk:** routine
- **Likely files:** `src/features/results/model-insights-view-model.ts`, `src/features/results/app-loss-curves.ts`, `src/features/results/app-loss-curves.stories.ts`, `tests/internals-mlp.e2e.ts`
- **Must not touch:** `css/root.css`, `src/stores/`
- **Implementation:** Interfaces §C and D11. The parameter summary states parameters, training rows and their ratio, with a sentence when the ratio exceeds 1. It also states the Validation share and that the last weights are kept.
- **Acceptance criteria:**
  - [ ] `WML-P6-UI-8` — Without validation loss, the chart shows training loss only, with the sentence naming the Validation share option. With validation loss, it shows the best-epoch rule and states the gap in the caption. `nIter === maxIter` shows the iteration-limit sentence. Fold curves appear only for cross-validation.
- **Verification:** `bun run test:e2e tests/internals-mlp.e2e.ts`; `bun run test:stories`; `bun run check`.
- **Progress:** [ ] Not started

### T9 — SVC panels

- **Depends on:** T4
- **Risk:** routine
- **Likely files:** `src/features/results/model-insights-view-model.ts`, `src/features/results/app-svc-decision-histogram.ts`, `src/features/results/app-svc-decision-histogram.stories.ts`, `src/features/results/app-svc-margin-map.ts`, `src/features/results/app-svc-margin-map.stories.ts`, `tests/internals-svc.e2e.ts`
- **Must not touch:** `css/root.css`, `src/stores/`
- **Implementation:** D7 and Interfaces §C.
- **Acceptance criteria:**
  - [ ] `WML-P6-UI-9` — With two features, the map shows regions, the −1/0/+1 contours (binary only) and ringed support vectors. With three features, it shows the explanation sentence and no chart.
  - [ ] `WML-P6-UI-10` — The binary histogram labels the margin and boundary rules; multiclass shows the pairwise sentence.
- **Verification:** `bun run test:e2e tests/internals-svc.e2e.ts`; `bun run test:stories`; `bun run check`.
- **Progress:** [ ] Not started

### T10 — Decision tree outline with row tracing

- **Depends on:** T4
- **Risk:** needs care — deep trees and keyboard navigation through nested disclosures.
- **Likely files:** `src/features/results/model-insights-view-model.ts`, `src/features/results/app-tree-outline.ts`, `src/features/results/app-tree-outline.stories.ts`, `tests/internals-tree.e2e.ts`
- **Must not touch:** `css/root.css`, `src/stores/`
- **Implementation:** D6.
- **Acceptance criteria:**
  - [ ] `WML-P6-UI-11` — Summaries state the split, rows, share and class mix; levels 0–2 are open. Selecting an example opens every node on its path and marks each in text. Cross-validated examples state that the final model was trained on them. A 20-level tree renders "more nodes" summaries below level 12.
  - [ ] `WML-P6-UI-12` — Tab and Enter/Space operate every disclosure, and the outline reflows at 320 px without horizontal page scrolling.
- **Verification:** `bun run test:e2e tests/internals-tree.e2e.ts`; `bun run test:stories`; `bun run check`.
- **Progress:** [ ] Not started

### T11 — Wire internals into Section 6, persist choices, update the draft and journeys

- **Depends on:** T3, T5, T6, T7, T8, T9, T10
- **Risk:** needs care — extends the Phase 4 connected element and persisted UI; shares files with Phase 5.
- **Likely files:** `src/features/results/app-model-results.ts`, `src/features/results/app-model-results.stories.ts`, `src/types/state.ts`, `src/stores/app.store.ts`, `src/stores/persister.ts`, `specification/mockups/03-7_train-models-5-results.html`, `tests/helpers/seed-results.ts`, `tests/helpers/mount-results-fixture.ts`, `tests/model-internals.e2e.ts`, `tests/model-results.e2e.ts`, `tests/a11y.e2e.ts`, `tests/state-and-storage.test.ts`, `tests/journeys/iris-classification.e2e.ts`, `tests/journeys/penguins-classification.e2e.ts`
- **Must not touch:** `css/root.css`, `src/app.ts`, `src/features/models/training/`
- **Implementation:** Connected changes and state rules in Interfaces §C. Add one "Model internals" draft section per model family to the 03-7 draft. Extend the journeys to assert Logistic Regression internals (forest and waterfall).
- **Acceptance criteria:**
  - [ ] `WML-P6-UI-13` — For each of the eight fixtures, Section 6 renders the registry panels in order after the shared sections. A version 1 evaluation, or one with dropped insights, shows "Train again to see model internals" with the shared sections intact.
  - [ ] `WML-P6-UI-14` — Example and coefficient-class choices survive a reload. Out-of-range stored values reset to their defaults. `tests/a11y.e2e.ts` scans one NB, one tree and one SVC Section 6 with no new findings.
  - [ ] `WML-P6-UI-15` — `JOURNEY-IRIS-INTERNALS` and `JOURNEY-PENGUINS-INTERNALS` pass in three browsers.
- **Verification:** `bun run test:e2e tests/model-internals.e2e.ts tests/model-results.e2e.ts tests/a11y.e2e.ts tests/journeys/iris-classification.e2e.ts tests/journeys/penguins-classification.e2e.ts`; `bun test tests/state-and-storage.test.ts tests/style-tokens.test.ts`; `bun run test:stories`; `bun run check`; `bun run build`.
- **Progress:** [ ] Not started

### T12 — Sync specifications for Phase 6

- **Depends on:** T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11
- **Risk:** routine
- **Likely files:** `specification/workflow-steps.md`, `specification/state-and-storage.md`, `specification/machine-learning-orchestrator.md`, `specification/components/model-internals.md`, `specification/components/model-results.md`, `specification/components/model-configuration.md`, `specification/README.md`, `specification/FUTURE.md`, `specification/TODO.md`, `specification/HUMAN.md`, `specification/plans/README.md`, `specification/plans/web-ml-phase-6-model-specific-results.md`
- **Must not touch:** `src/`, `tests/`, `specification/mockups/`, `specification/notes/`
- **Implementation:** Apply every item under _Specification changes_.
- **Acceptance criteria:**
  - [ ] Every item under _Specification changes_ is applied and ticked.
  - [ ] `bun run plans:check` and `bun run plans:task specification/plans/web-ml-phase-6-model-specific-results.md --check-complete` pass.
- **Verification:** `bun run plans:check specification/plans/web-ml-phase-6-model-specific-results.md`; `bun run plans:task specification/plans/web-ml-phase-6-model-specific-results.md --check-complete`; `bun run check`.
- **Progress:** [ ] Not started

## Verification and definition of done

- [ ] All acceptance criteria are met, with test names starting with `WML-P6-*` or the journey IDs.
- [ ] `bun run check`, `bun run build`, `bun run test:stories` and the listed Playwright suites pass in three browsers with no new failures against the recorded baseline.
- [ ] Code review confirms the extractors use only public `web-ml` members, D3 transforms and D10 shape guards, and that no extractor can throw out of `onModel`.
- [ ] Manual checks recorded: VoiceOver with Safari through the tree outline and one waterfall; keyboard-only example selection; forced colours; 200% zoom.
- [ ] `bun run format` run on changed files, and every _Specification changes_ item ticked.

## Risks and open questions

- **Blocking:** (1) compare-feature-importance lands first (user decision 2026-11-26). Move `StoredEvaluation` to schema version 3, decode versions 1–3 with drop-not-reject, and run this plan's `onModel` collector after the importance collector in one hook. (2) Integrate the v2 requirements listed under Scope ("v2 feature-importance requirements to integrate") into the decisions, interfaces and tasks: re-scout, then decide with the user where v2 conflicts with D1–D11. (3) Re-check the upstream gate inherited from compare-feature-importance. Then submit for review. Owner: `samata-ml` planner.
- **Non-blocking:** Phase 5 (`ready`) shares `src/types/state.ts`, `src/stores/app.store.ts`, `src/stores/persister.ts`, `tests/a11y.e2e.ts`, `tests/helpers/seed-results.ts` and the journeys with T11. Implement Phase 6 after Phase 5 lands, or rebase T11 onto it; the changes touch different fields (`ModelRecord.ui.results` here, `results.ui` there). Owner: implementer.
- **Non-blocking:** `web-ml` leaves several inspection shapes undocumented (`kneighbors`, `coef_`/`intercept_`, `coefs_`, Gaussian `classPrior_`). Prose and declarations also disagree on Multinomial `featureLogProb_` and holdout `validationFeatures`. D10 guards every read; filed as [request 15](../../../web-ml/specification/requests/2026-11-23-15-inspection-output-shapes-documentation.md). Owner: `web-ml` planner.
- **Non-blocking:** Permutation importance is deferred until `web-ml` scores importance with balanced accuracy ([request 01](../../../web-ml/specification/requests/2026-11-23-01-balanced-accuracy-scoring-everywhere.md)). MLP early stopping awaits [request 03](../../../web-ml/specification/requests/2026-11-23-03-mlp-early-stopping-and-weight-decay.md). Owner: human (HUMAN.md).
- **Non-blocking:** Extraction work grows with folds × rows. The KNN `kneighbors` call over every held-out row is the costliest (n × training rows distances). T3 records extraction time per model on iris and penguins in the log. If it exceeds 25% of training time, restrict consensus to at most 2,000 held-out rows, chosen deterministically by lowest `sourceRowIndex`, and say so in the caption.
- **Non-blocking:** D3 keeps closed-form display transforms in `samata-ml` (`specification/HUMAN.md` item). Owner: human.
- **Non-blocking:** The model-internals and Validation share draft sections await human styling (`specification/HUMAN.md`).

## Escalations

None.

## Review fixes

None.

## Implementation and verification log

| When (UTC)           | Task | Agent (model)                 | Outcome / commands / evidence                                                                                                                                                                                                                                                                                                            |
| -------------------- | ---- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-19T08:47:35Z | —    | Claude Code (claude-opus-5-5) | Planning: `codebase-scout` listed every classifier's public fitted attributes and the model-specification `metrics` blocks in `web-ml@0.1.0`.                                                                                                                                                                                            |
| 2026-11-23T09:48:14Z | —    | Claude Code (claude-opus-5-5) | Re-planning: `codebase-scout` read the installed `web-ml` 0.2.0 public declarations and prose (hook, holdout/cross-validation, inspection, model members, tensor types) and the implemented Phase 3–4 code (evaluation types, decoders, worker, adapters, mapper, results UI, state, Configure Model policy, tests and mockup statuses). |

## Plan review history

| Reviewed (UTC) | Agent (model) | Decision | Findings |
| -------------- | ------------- | -------- | -------- |

## Change log

| When (UTC)           | Change                                                                         | Reason                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-19T08:47:35Z | Initial draft                                                                  | User split the former Phase 4 stub; model-specific metrics and visuals become Phase 6 on Phase 4's contract.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-11-21T08:09:01Z | Linked upstream WR-8 request                                                   | User asked for an upstream request covering the nested-CV and multiclass trial-report limitations; Blocking remains open.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-11-21T08:23:10Z | Linked upstream WR-12 request                                                  | User asked for the WR-12 upstream request; Blocking remains open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-11-23T09:48:14Z | Revised against `web-ml` 0.2.0 and the implemented Phase 4                     | WR-7, WR-8 and WR-12 ship in 0.2.0 and Phase 4 is archived, so the Blocking item is resolved. Pinned `onModel` (holdout, fold, refit) and the inspection signatures. Added decoder version 2 with drop-not-reject (D9), shape guards (D10), in-hook example selection (D4), final-tree tracing (D6) and the Phase 4 `labels`/`shownClassIndices` conventions. User decisions on 2026-11-23: an MLP Validation share option in Configure Model (D11, new T2), and permutation importance deferred until a balanced-accuracy scorer exists. Fixed the mockup paths. Filed request 15. |
| 2026-11-26T13:49:27Z | Invalidated approval                                                           | compare-feature-importance now lands first (schema v2, onModel collector) and the v2 feature-importance requirements add model-specific items                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-11-26T13:49:27Z | Added v2 feature-importance requirements to Scope and a Blocking revision item | User request: model-specific requirements from `specification/notes/feature-importance-requirements.md` belong in Phase 6; compare-feature-importance comes first.                                                                                                                                                                                                                                                                                                                                                                                                                  |
