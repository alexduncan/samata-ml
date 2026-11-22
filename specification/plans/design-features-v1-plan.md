# Design Features — First Release Implementation Plan

**Status:** draft  
**Created:** 2026-11-21T18:12:54+01:00  
**Updated:** 2026-11-21T18:12:54+01:00  
**Author:** ChatGPT (GPT-6)  
**Reviewed by:** Pending  
**Review date:** Pending  
**Implementation status:** Not started  
**Proposed repository path:** `specification/plans/design-features-v1.md`  
**Related projects:** `web-ml` (in-browser ML library) and its consuming educational web app

> **Agent handoff:** Review this plan against the actual repositories and existing specifications before implementing. Record disagreements, missing interfaces, scope conflicts, and test gaps in the review. Update this living plan with agreed decisions. Do not mark **ready** or begin implementation until an independent verification pass finds no blocking issues. Preserve existing behaviour unless an explicit migration is approved.

## 1. Objective and educational rationale

Add **Design Features** between **Set Target** and **Train Models**. Students should be able to turn raw tabular data into reusable, inspectable numerical features through a small set of understandable transformations. The new step must demonstrate that feature representation affects performance, explainability, and fairness without compromising the validity of one-shot training or cross-validation.

The five-step user journey becomes:

1. **Load Data** — select a curated dataset or upload a CSV.
2. **Set Target** — choose the prediction target.
3. **Design Features** — inspect types, exclude inputs, define deterministic derived features, and configure fitted encoders/scalers/imputers.
4. **Train Models** — select a subset of the available features for each model, configure hyperparameters, and choose one-shot or cross-validation.
5. **Compare Results** — evaluate each immutable training run with its exact feature recipe, evaluation population, and metrics.

**Guiding principle:** Design Features saves a *recipe*, not a globally pre-fitted numeric matrix. All statistics-dependent preprocessing must be fitted inside the training portion of each split/fold, and then applied without refitting to validation/test records.

### Success criteria

- Non-technical users can make common numeric and low-cardinality text columns usable without programming.
- Multiple models can select different subsets of a common catalogue of original and derived features.
- No training/validation/test leakage arises from preprocessing; cross-validation gives independently fitted preprocessing per fold.
- Existing training workflows continue to work when no custom feature design is performed.
- Every run records enough information to reproduce its preprocessing, row eligibility, training splits, and output feature names.
- The experience explains significant consequences: information loss, feature expansion, missing values, changed populations, and potential fairness effects.

## 2. Scope for first release

Implement the following as a deliberately constrained vertical slice. Prefer familiar controls and visible explanations over a general-purpose expression language.

| Area | Included in V1 | Guardrails / defaults |
| --- | --- | --- |
| Inspect features | Raw column name, inferred physical type, editable semantic role, missing count, unique-category estimate, example values | Distinguish numeric, categorical text, datetime-like, identifier, target, sensitive attribute |
| Feature exclusion | Exclude a column from default predictors without deleting raw data | Target unavailable as predictor; sensitive columns remain available for fairness analysis |
| Arithmetic | Create named numeric features with `+`, `-`, `*`, `/` between two numeric columns or a column and a constant | Typed, structured inputs; no arbitrary code; invalid results become missing with explicit warning/count |
| Fixed-rule categorisation | Create categories from numeric thresholds, e.g. age `< 25`, `25–59`, `>= 60` | User-specified non-overlapping exhaustive bins; separate missing-value handling |
| Row filtering | Optional simple **AND** of numeric comparisons, categorical equality/inequality, and missing/not-missing tests | Default: no row filtering. Explain retained cohort and prohibit target-dependent rules; preserve stable row IDs |
| Categorical encoding | One-hot encoding for categorical columns; explicitly ordered ordinal encoding | One-hot default; cap expansion (proposed: 32 output categories per source column); no inferred ordering for nominal categories |
| Missing values | Numeric: fixed constant, mean or median; categorical: fixed category or most frequent | Learned statistics fitted on training portion only; never silently delete rows |
| Scaling | None, standardisation (`z` score), min-max `[0,1]`, fixed `log1p(x)` | Standard/min-max fitted per fold; `log1p` requires `x >= 0`; warn before using it with negative data |
| Datetime basics | Strictly parse supported date/datetime formats; derive year, month, weekday, or elapsed days between two timestamps | Only deterministic parsing/extraction. Do not use raw timestamps as arbitrary ordinal numbers; reject ambiguous date formats and surface timezone assumptions |
| Preview | Original versus generated feature examples, estimated feature count, invalid-value warnings, retained-row count | Show deterministic previews only; no full-data-fitted encoder/scaler parameters presented as training parameters |
| Model integration | Selected feature recipe integrated into one-shot and cross-validation training | Fit separately per training split/fold; immutable snapshots per run |
| Results integration | Show source → generated features, transformations, row-selection rule, resulting feature count, warnings | Flag non-comparable evaluation populations/splits |

**Scope-control decisions:**

- The app owns the interactive editor; `web-ml` owns pure validated transform specifications, fitting, execution, and metadata wherever existing architecture permits. Reviewers must confirm the actual ownership boundaries first.
- **V1 datetime support is intentionally minimal** because COMPAS-like datasets contain useful date columns. No custom date-format builder, timezone conversions, holiday features, or rolling windows.
- One-hot vocabulary and category frequencies are **learned from training records**, never permanently from the full dataset. New categories at transform time use a documented unknown-category policy (proposed: all-zero vector plus a count/warning); missing values are handled separately.
- Proposed limits (32 categories, total generated-feature and memory budgets) are defaults for review, **not unchangeable magic constants**. Align with current `web-ml` browser memory and matrix representations.
- No arbitrary Boolean expression editor, user-supplied JavaScript, full spreadsheet formulas, automated feature selection, target encoding, TF-IDF, or embeddings in V1.
- A feature can be excluded from model input yet retained separately as a sensitive attribute for audit metrics or as a group identifier for split logic.

### Explicitly out of scope

Free-form text vectorisation, high-cardinality feature hashing, learned quantile binning, interaction/polynomial generators, rich datetime parsing, automatic feature suggestions, target encoding, expression scripting, model-specific overrides of the shared recipe, nested-CV automation, advanced train/test holdout management, exportable interactive pipelines, and new model families.

## 3. Required semantics and integrity invariants

### 3.1 Roles, provenance, and dependency validation

- Maintain the **original dataset immutably** with stable row identities and raw column IDs.
- Distinguish *physical storage type* (e.g. string), *semantic data kind* (e.g. category, datetime, identifier), and *usage metadata* (target, predictor-eligible, sensitive/audit attribute, or group identifier). Usage flags other than target are not necessarily mutually exclusive. Never assume every string is categorical.
- Treat generated features as named objects with stable IDs, source-column IDs, operation/version/parameters, output type, and lineage.
- Support chaining of **deterministic** derived features through an acyclic dependency graph. Reject cycles, duplicate IDs/names, incompatible operands, and missing sources.
- In V1, fitted outputs (such as standardised values) **cannot feed subsequent deterministic feature expressions**. Resolve operation order as deterministic derivation → missing-value handling → categorical encoding / scaling → model matrix.
- Forbid any direct or indirect dependency on the target as a predictor; prevent target-dependent row filters by default. Curated dataset metadata may additionally flag target proxies or columns observed only after prediction time.
- Preserve sensitive attributes for group analysis even when they are not predictors. Record deliberate inclusion as a predictor when selected and show an explanatory warning.

### 3.2 Training boundaries

1. Validate the feature recipe against the schema and target.
2. Derive only **row-independent, deterministic** values; calculate row eligibility from permissible, target-independent filter rules. Exclude records with missing target according to the existing target policy and record this separately.
3. Determine the eligible population and split it according to the training configuration (one-shot or cross-validation). Preserve row IDs and a split signature.
4. For every training partition/fold, instantiate **fresh** fitted transformers and learn their parameters using **training rows only**.
5. Apply the frozen fitted transformers to the training partition and corresponding validation/test partition; enforce identical output feature names, order and dimensions.
6. Fit the estimator only on the transformed training partition, then evaluate on validation/test rows.
7. Save the immutable recipe, fitted-pipeline metadata needed for prediction/replay, split IDs/seed, selected features, and training warnings with the resulting model/run.

**Important distinction:** fixed row-filter rules may be applied to define the eligible population *before* the split, but this changes the population being evaluated. Document that population shift; never silently compare it against results from a different cohort. Even deterministic transformations must use only information available at the intended prediction time.

**Exploratory selection warning:** Students may manually redesign features after reading results. Fold-correct preprocessing prevents mechanical leakage but does not make repeatedly selected validation performance an unbiased final test estimate. Preserve existing holdout semantics if they exist; do not claim an untouched final-test estimate unless the test population was genuinely sealed from tuning and repeated inspection.

### 3.3 Deterministic transformation contracts

| Operation | Required behaviour |
| --- | --- |
| Division | Handle denominator zero/near-zero using a documented finite-value policy; never return `Infinity` or `NaN` to the estimator silently |
| Fixed thresholds | Explicit boundary inclusivity; ordered, complete and non-overlapping ranges; labels are user-defined; missing is distinct |
| Row filters | Apply predictable AND semantics; show retained/excluded counts and any target or group shifts; preserve row IDs |
| `log1p(x)` | Defined for `x >= 0` in V1 (conservative policy); invalid inputs reported and handled via missing-value policy |
| StandardScaler | Training-only mean and population std (`ddof=0`) if claiming scikit-learn compatibility; constant column gets safe factor 1 |
| MinMaxScaler | Fit training min/max; define constant-column and out-of-range validation behaviour (default: no clipping, matching scikit-learn default) |
| One-hot | Vocabulary learned from training rows; stable deterministic category ordering; fixed output width at inference; new categories follow explicit policy; cap expansion |
| Ordinal | User defines meaningful order; never invent a meaningful rank from a nominal string; define unknown handling explicitly |
| Imputation | Fit mean/median/mode only from training; handle all-missing columns explicitly (error or documented fallback); respect input/output types |
| Datetime | Accept only explicitly documented formats (proposed ISO date, ISO datetime, and `YYYY-MM-DD HH:mm:ss`); treat timezone-naive timestamps consistently; do not depend on the browser's local timezone; expose parse failures |

Do not silently coerce arbitrary strings into numbers, change dataset units, reorder rows, truncate features, or delete missing records. Any lossy operation should remain visible and reviewable.

### 3.4 Matrix and resource safety

- Preflight worst-case feature width and approximate memory before training; refuse unreasonable expansions with actionable error messages.
- Investigate existing dense/sparse capabilities in `web-ml` and choose the native representation. If sparse is absent, keep one-hot limits conservative and record a separate future sparse-matrix task.
- Run long operations off the UI thread when consistent with existing worker/WASM architecture; propagate cancellation and progress rather than freezing the interface.
- Ensure numeric precision, finite-value checks and output dimensions are compatible with each estimator.

## 4. Proposed library interface (conceptual, adapt to existing code)

Do not create parallel abstractions if `web-ml` already has preprocessing, dataset and training interfaces. The following defines required *behaviour*, not prescribed filenames or API names.

```typescript
interface FeatureRecipe {
  version: 1;
  datasetFingerprint: string;
  targetColumnId: string;
  columnPolicies: Record<string, {
    predictorEligible: boolean;
    sensitiveForAudit?: boolean;
    groupIdentifier?: boolean;
  }>;
  derivedFeatures: DerivedFeatureDefinition[];
  rowFilters: RowFilterDefinition[];
  featureTransforms: FeatureTransformDefinition[];
}

// Execution shape (illustrative):
// validate(recipe, schema) -> errors / warnings / lineage
// compile(recipe) -> reusable plan without learned statistics
// fit(compiled, trainingRows, selectedFeatureIds) -> fitted pipeline
// transform(fitted, rows) -> matrix, stable output feature names, diagnostics
// serialize(fitted) / deserialize(...) -> exact inference-time preprocessing
```

**Design requirement:** `fit` must never receive validation/test rows through a hidden shared dataset reference. A compiled plan must not carry globally calculated means, category vocabularies, quantiles or imputations. Prefer explicit immutable inputs and fresh fitted state per fold. A training run snapshot includes both source recipe ID/version and its frozen configuration.

## 5. User experience specification

### 5.1 Entry and overview

- Add **Design Features** after **Set Target** in the existing accessible step navigation, progress state, back/next controls and URL/state management.
- Show a compact table of raw columns: name, inferred type, role, missing count, distinct values, and existing/possible transformations.
- Label unsupported raw columns clearly with a path to a supported transformation; do not imply raw text or datetime is always trainable.
- The stage is **optional**: users can proceed with the current numeric-only/default behaviour if they create no transformations, subject to existing model requirements.

### 5.2 Transformation editor

- Offer clear actions: **Create calculated feature**, **Create categories**, **Encode categories**, **Handle missing values**, **Scale numbers**, **Extract date component**, **Calculate date difference**, and **Filter rows**.
- Use guided forms (source column, operation, parameters, result name) with domain-specific hints rather than exposing raw expressions.
- Show a deterministic before/after preview for a small sample of rows and a clear estimate of created features. For fitted operations, show the *recipe* and an explanation that values are calculated separately during training; do not display full-data-derived statistics as if they were fitted training values.
- Allow edit, remove and undo/restore of generated transformations. Preserve original columns.
- Add inline warnings for invalid arithmetic, category proliferation, reduction in row count, target proxies, potentially sensitive predictors, and transformation order.
- Use semantic controls and accessible errors/status updates. Keyboard access, focus restoration, labels, screen-reader announcements and reduced-motion considerations are acceptance criteria.

### 5.3 Train Models and Compare Results

- Model feature selectors list original eligible features and generated features, with provenance and output width. Selection is per model, not automatically forced by the Design Features stage.
- Training uses the recipe snapshot applicable when the run starts. Subsequent edits do **not** mutate completed models or their results.
- Results show a compact "Feature design" summary (selected input features, generated numeric width, encoding/scaling/imputation summary, row-filter rule and count, warnings, recipe version).
- Where two runs use different eligible row IDs, target definitions or evaluation splits, mark direct comparisons as **not controlled** or **different evaluation populations**. Do not automatically claim one model is better merely from different test sets.
- Retain excluded sensitive/group columns separately for fairness analyses and group-aware splitting, where supported.

## 6. Implementation sequence and exit gates

### Milestone 0 — Repository investigation and plan verification

**Tasks**

- Inspect current `web-ml` data structures, preprocessing APIs, model matrix contracts, one-shot and CV execution, worker/WASM boundaries, serialization and cancellation behaviour.
- Inspect the app's dataset/schema representation, type inference, route/state system, feature selection, model persistence, results and accessibility conventions.
- Identify existing transformations to reuse, migration risks, library/app ownership and any incompatible assumptions in this plan.
- Confirm the default feature budget, dataset limits, target/row identity model and supported datetime formats.
- Update this plan with concrete files/modules/owners and decisions; have a separate agent verify blocking issues. Move status to `ready` only after verification.

**Exit gate:** Reviewed design with explicit integration points and no unresolved blocking questions.

### Milestone 1 — Recipe schema, type system and validator

**Tasks**

- Implement versioned, serialisable recipe types; stable IDs and lineage; semantic roles and type compatibility.
- Add deterministic transformation graph ordering; reject cycles, target dependencies, duplicate names, unsupported operations and invalid thresholds.
- Add schema fingerprint/compatibility checks and human-readable diagnostic codes.

**Exit gate:** Fully deterministic validator with unit tests; no UI or model behaviour change yet.

### Milestone 2 — Pure transforms and fitted transformers

**Tasks**

- Implement arithmetic, fixed bins, row filters, strict datetime extraction/difference, and fixed `log1p` as pure operations.
- Implement numeric/categorical missing handlers, one-hot/ordinal encoding, standardisation and min-max scaling with clear `fit`/`transform` separation.
- Enforce finite outputs, stable feature names/order, known-category policy, and output expansion limits.

**Exit gate:** Unit and scikit-learn differential fixtures pass; independent fitted states never share learned parameters.

### Milestone 3 — Training and prediction integration

**Tasks**

- Integrate compilation and per-fold fitting with existing one-shot and CV paths; retain original row IDs and split signatures.
- Connect generated features and per-model feature selection to every supported estimator without duplicating per-estimator logic.
- Persist frozen recipe/fitted state so inference and replay perform identical transformations.
- Maintain progress, cancellation and resource guards through worker/WASM boundaries.

**Exit gate:** End-to-end one-shot and CV tests prove validation/test data are transform-only; old models and default workflows still function.

### Milestone 4 — Design Features UI

**Tasks**

- Add the workflow step with semantic navigation and non-destructive editor.
- Add type/role overview, operation editors, previews, invalid-value counts and cost/width warnings.
- Persist edits per dataset/target session, with explicit invalidation on dataset or target changes; preserve existing trained-run snapshots.
- Make empty/default state usable and accessible.

**Exit gate:** A first-time non-technical user can build, edit, remove and inspect a feature without reading documentation.

### Milestone 5 — Training/results integration and educational explanations

**Tasks**

- Display lineage and generated widths in feature selection and completed runs.
- Show cohort-retention and fairness-related warnings, including possible population differences across results.
- Explain fitted versus deterministic transforms in simple language, including a fold-specific explanation for cross-validation.

**Exit gate:** Students can compare two runs with different feature selections and understand which transformations were used and whether evaluation populations match.

### Milestone 6 — Verification, documentation and release

**Tasks**

- Complete test matrix below; run existing regressions, cross-browser checks as supported, accessibility checks and browser memory/performance smoke tests.
- Document supported operations, edge cases, dataset examples, data leakage protections and limitations. Update architecture/specifications, developer docs and change log.
- Verify at least one curated dataset (COMPAS or an appropriate privacy-safe subset) and one uploaded CSV through the entire workflow.

**Exit gate:** All must-pass acceptance criteria met, relevant tests green, reviewer sign-off recorded, and status advanced to `implemented` after merge.

## 7. Test and validation matrix

### Must-pass unit tests

- Arithmetic order, arithmetic with constants, chained deterministic features, division by zero, overflow/non-finite values, missing inputs and invalid types.
- Threshold categorisation: exact boundary values, disjoint coverage, missing values, invalid/overlapping intervals, stable category names.
- Row filtering: multiple AND predicates, stable row IDs, zero-row result, target-dependent rule rejection, counts and demographic-summary availability.
- One-hot: deterministic order, unseen category in validation, missing category, single category, category cap, no learned categories from validation data.
- Ordinal: explicit ordering, unknown category behaviour, warning/rejection for unspecified nominal ordering.
- Imputation: fitted mean/median/mode, empty/all-missing source, missing value retained/converted consistently, no validation influence.
- StandardScaler and MinMaxScaler: constant features, unseen extreme validation values, training-only fitted statistics, numeric tolerance/precision, no silent clipping.
- Datetime: ISO date, supported timestamp formats, invalid and ambiguous dates, timezone-independent deterministic behaviour, date difference orientation and missing values.
- Recipe validation: cycles, duplicate names, bad dependencies, target-derived feature rejection, schema mismatch, orthogonal audit/predictor roles, deterministic serialization round-trip.

### Must-pass leakage and cross-validation tests

1. Create a training partition and a validation partition with an extreme numeric outlier appearing **only in validation**. Verify fitted scaling/imputation parameters equal training-only statistics and are unchanged when validation values change.
2. Construct folds with intentionally different training means and category vocabularies. Confirm each fold has separate fitted transformer state and correct fixed feature dimensions for its own validation set.
3. Verify the **same** fitted pipeline transforms training and validation inputs consistently; confirm no hidden global fitting or caching across folds/runs.
4. Confirm that changing a recipe after training does not alter completed-run predictions, metadata, or summaries.
5. Confirm filtering changes eligible row IDs and is clearly labelled in model comparisons; same-cohort runs preserve comparable split signatures under identical training settings.

### Differential testing against scikit-learn

Use deterministic small fixtures in Python with pinned dependency versions, a machine-readable expected-output format, and matching operation semantics. Reference classes/functions where applicable: `OneHotEncoder`, `OrdinalEncoder`, `SimpleImputer`, `StandardScaler`, `MinMaxScaler`, and equivalent explicit arithmetic/binning.

- Compare generated feature names (after an agreed naming mapping), dimensions, values and per-fold learned parameters, **not only final classifier accuracy**.
- Use an explicitly documented floating-point tolerance appropriate for `web-ml` precision (do not hard-code a false promise of bitwise parity); all non-finite values are failures unless the transformation contract explicitly handles them.
- Include a complete example with an estimator inside scikit-learn `Pipeline` / `ColumnTransformer` and compare predictions and evaluation scores under identical splits when the algorithms themselves are already parity-tested.
- Assert semantic differences explicitly where the library intentionally differs (e.g. category ordering, datetime conventions, unknown categories); do not silently label these as parity.

### Integration, UX and performance tests

- Zero-transform default experience and current numeric-only training remain unchanged.
- Two models choose different subsets of the same feature catalogue; one-shot and 5-fold CV produce valid results.
- Edits/reordering/deletion, load-data/target change, refresh/revisit (according to existing persistence contract), cancellation and actionable error recovery.
- Keyboard-only workflow, descriptive form labels, errors, focus, step state and live progress announcements; no inaccessible icon-only actions.
- Conservative resource limits for high-cardinality columns and large uploads: warn and reject safely rather than freeze or crash. Record measured memory/time under representative browser hardware.

## 8. Definition of done

The feature is releasable only when **all** of the following are true:

- [ ] A reviewed, versioned recipe schema exists; original data and row IDs are never modified in place.
- [ ] The supported V1 operations work and fail predictably on invalid inputs.
- [ ] Fitted transforms learn exclusively from each training partition in both one-shot and CV.
- [ ] Encoded output dimensions/names are stable between training and validation/inference.
- [ ] Target-derived predictor/filter dependencies are rejected; semantic leakage limitations are explained.
- [ ] A user can preview, edit, remove and reuse feature definitions across different model runs.
- [ ] Every completed run freezes its recipe and evaluation population/split metadata.
- [ ] Compare Results visibly identifies differing evaluation populations or splits.
- [ ] Accessibility, regression, differential and resource-limit tests pass.
- [ ] At least one COMPAS-like mixed-type dataset and one uploaded CSV complete the full workflow.
- [ ] Public/internal documentation and relevant living specifications are updated.
- [ ] Independent plan verification and implementation review are recorded below.

## 9. Risks and mitigation

| Risk | Mitigation |
| --- | --- |
| Leakage from fitted transforms | Split before fit, per-fold state, explicit tests with adversarial outliers |
| Leakage from future/target-proxy fields | Role metadata, dependency rejection, curated warnings, prediction-time explanations |
| Changed cohorts distort comparisons | Stable row IDs, row retention summary, comparison compatibility flags |
| Overly broad feature editor delays delivery | Limited operations, structured controls, explicit deferred list |
| Feature explosion and browser memory | Category cap, output-width budgeting, cancellation, sparse follow-up |
| Inconsistent preprocessing at prediction time | Versioned recipes plus fitted state serialized with each run |
| Date ambiguity and local timezone | Strict formats, documented timezone-naive interpretation, no silent parsing |
| Student confuses validation tuning with final evidence | Exploratory-result wording and sealed-holdout guidance |
| Algorithm-specific preprocessing limitations | Existing estimator contracts checked in milestone 0; clear compatibility warnings |

## 10. Decisions the reviewer must validate

The defaults below permit planning without implying repository-specific knowledge. Review them before marking `ready`.

1. **Ownership:** Where do preprocessing types, fitted state and the UI editor belong in the current architecture? Does a preprocessing abstraction already exist?
2. **Feature budgets:** Is the proposed one-hot cap of 32 categories sensible, and what is the total transformed-feature/memory limit for browser hardware?
3. **Row filtering:** Should optional user-created row filters ship in V1, given comparison and fairness risks, or be deferred to a small follow-up? If deferred, column exclusion remains required.
4. **Datetime formats:** Which exact formats do shipped curated datasets and uploaded CSVs use, and what is the deterministic timezone-naive policy?
5. **Missing-data behaviour:** What should happen for columns entirely missing in a training fold, and for unknown categories? Formalise error/fallback choices.
6. **Recipe lifecycle:** When does an upstream dataset/target change invalidate saved features? What persistence format/versioning already exists?
7. **Inference:** Does `web-ml` currently support prediction on new records after model training, and where can fitted preprocessing be persisted?
8. **Comparability:** Which current split IDs, per-run samples and fairness attributes are exposed to Compare Results? What can be added without destabilising existing APIs?
9. **Supported tasks:** Does V1 cover classification only, or must the same features work across regression/clustering already supported? Target-role rules must adapt accordingly.

### Review record (to be completed by reviewer)

- **Reviewer / model:** Pending
- **Reviewed on:** Pending
- **Verdict:** Pending (`blocking-changes` | `ready`)
- **Blocking issues and resolutions:** Pending
- **Agreed architecture and implementation owners:** Pending

---

# Feature Backlog — After First Release

These ideas are explicitly **not acceptance criteria for V1**. Prioritise by educational value, implementation complexity, algorithm compatibility and leakage/fairness risk after evaluating actual usage.

## Near-term priorities (P1)

| Feature | Educational / practical benefit | Key consideration |
| --- | --- | --- |
| Richer datetime features | Month/weekday/hour cyclic encoding; time since an event; more supported date formats | Timezone and prediction-time leakage |
| Smarter categorical handling | Rare-category grouping, `max_categories`, frequency encoding | Train-only category statistics |
| Missingness indicator | Let learners see whether missing data is predictive | Avoid hidden correlations with protected attributes |
| Visual feature lineage | Graph original columns → derived columns → encoded model inputs | Clear explanation of many-to-one and one-to-many transforms |
| Per-model transformation variants | Compare scaled vs unscaled versions or multiple encoders under the same algorithm | Avoid confusing global recipe state |
| Cohort/fairness impact panel | Show before/after class and sensitive-group distributions following filters | Minimum support per group and privacy safeguards |
| Better comparison controls | Pair runs on identical records/folds and label uncontrolled comparisons | Store split signatures and sample IDs |
| Pipeline import/export | Share reproducible transformation designs | Schema/version migration, avoid including private row data |

## Medium-term priorities (P2)

| Feature | Educational / practical benefit | Key consideration |
| --- | --- | --- |
| Free-text BoW / TF-IDF | Make narrative/text columns model-ready | Sparse matrices, vocabulary learned per training fold |
| Sparse matrix support | Efficient one-hot and text features | Estimator/WASM backend compatibility |
| Feature hashing | Predictable dimensionality for high-cardinality categories | Collisions and explainability |
| Quantile/equal-frequency bins | Contrast learned versus fixed threshold categories | Fold-specific fit and reproducibility |
| Polynomial and interaction features | Show nonlinear representation and interaction effects | Feature explosion |
| Robust/power scaling | Compare sensitivity to outliers and skew | Fitted statistics; valid domains |
| Automated data-quality diagnostics | Flag duplicates, near-constants, outliers, invalid units | Avoid automatic destructive cleaning |
| Split and holdout design | Explicit locked test sets, grouped/temporal split options | Avoid repeated-test overfitting and time leakage |
| Feature ablation experiments | Automatically compare selected feature subsets on fixed splits | Multiple comparisons and experiment tracking |

## Research / longer-term possibilities (P3)

| Feature | Educational / practical benefit | Key consideration |
| --- | --- | --- |
| Target encoding with cross-fitting | Teach powerful encodings and leakage traps | Requires strict inner-fold fitting; higher misuse risk |
| Text embeddings | Compare classical versus learned text representations | Model size, browser downloads, reproducibility |
| Automated feature suggestions | Explain candidate derived features | Suggestions should be transparent, controllable, non-leaky |
| Counterfactual feature changes | Explore model sensitivity and individual explanations | Causal limitations and fairness interpretation |
| Feature drift monitoring | Compare train and new-data distributions | Privacy and longitudinal dataset support |
| Richer rule-based editor | AND/OR groups, string/date conditions, user-defined formulas | Validation complexity and misleading filters |
| Visual preprocessing experiments | Side-by-side encoding/scaling/feature importance demonstrations | Need evaluation controls and clear caveats |
| Nested CV for entire preprocessing search | Stronger generalisation claims for feature+model selection | Significant computational expense in the browser |

## Suggested backlog scoring

For each backlog item, record: **learning objective**, target user story, estimated effort, dependency on matrix/estimator support, potential fairness/leakage risk, resource impact, test strategy, and evidence from user testing. Avoid adding features only because they exist in scikit-learn.

## Reference documentation

- scikit-learn: Common pitfalls and data leakage — https://scikit-learn.org/stable/common_pitfalls.html
- scikit-learn: `Pipeline` — https://scikit-learn.org/stable/modules/generated/sklearn.pipeline.Pipeline.html
- scikit-learn: `ColumnTransformer` — https://scikit-learn.org/stable/modules/generated/sklearn.compose.ColumnTransformer.html
- scikit-learn: `OneHotEncoder` — https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.OneHotEncoder.html
- scikit-learn: `StandardScaler` — https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.StandardScaler.html
- scikit-learn: `MinMaxScaler` — https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.MinMaxScaler.html
- scikit-learn: `SimpleImputer` — https://scikit-learn.org/stable/modules/generated/sklearn.impute.SimpleImputer.html

**Implementation instruction for a coding agent:** Use this document as a change-controlled plan. Begin with milestone 0 and repository discovery. Do not infer nonexistent module names, alter existing model semantics without tests, implement P1–P3 items accidentally, or advance the status beyond the actual verified state. Record deviations and reviewer decisions in this document before they are implemented.
