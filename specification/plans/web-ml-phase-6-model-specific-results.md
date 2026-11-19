# Phase 6: Display model-specific internals for the eight classifiers in Section 6

**Status:** draft | **Updated:** 2026-11-19T08:47:35Z
**Authors:** Claude Code (claude-opus-5-5) | **Created:** 2026-11-19T08:47:35Z
**Verified by:** — | **Verified:** — | **Verification:** pending
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour:** After Phase 4, Section 6 shows only the shared base metrics and visuals. `workflow-steps.md` §3.6 requires a per-model configuration file `src/config/models/{model-name}-results.ts` to decide which model-specific charts render; none exists. `web-ml@0.1.0` exposes public fitted attributes per classifier (`dist/src/models/**`): Gaussian NB `theta_`, `var_`, `classPrior_`; Multinomial NB `classCount_`, `featureCount_`, `featureLogProb_`; Bernoulli NB `classCount_`, `featureCount_`; KNN `nSamplesFit_`, `kneighbors(X, n?)`; Logistic Regression `coef_`, `intercept_`, `getTrainingHistory()`; MLP `coefs_`, `intercepts_`, `lossCurve_`, `nIter_`; SVC `supportVectors_`, `dualCoef_`, `intercept_`, `nSupport_`, `decisionFunction(X)`; Decision Tree `maxDepth_`, `nodeCount_`. No tree structure, permutation importance, validation loss or feature contributions are public.

**Target behaviour:** Below the shared sections, Section 6 adds a **Model internals** section chosen by the model's results configuration, covering the Essential items of [metrics-and-visuals note §1 Model-Specific Internals](../notes/metrics-and-visuals.md) that do not depend on tuning:

- **Bernoulli NB:** class priors and smoothed presence rates; presence-vs-absence weight of evidence; butterfly chart; additive evidence waterfall for an example row.
- **Gaussian NB:** per-class means and SDs; Fisher separability per feature; fitted Gaussian curves over class histograms; density-lookup waterfall.
- **Multinomial NB:** priors and feature shares; unit log-odds weights; ranked diverging log-odds bars; count-multiplied waterfall.
- **KNN:** configured k, metric and weighting; neighbour vote consensus and mean neighbour distance; spoke diagram with a neighbour comparison table.
- **Logistic Regression:** standardised coefficients and odds ratios; C, penalty and active feature count; coefficient forest plot with outer-fold whiskers; linear score to sigmoid curve.
- **MLP:** final training versus validation loss gap, best epoch and convergence status; capacity and parameter-to-sample ratio; learning curves; global permutation importance.
- **SVC:** support-vector count and fraction; kernel, C and γ; signed decision-value histogram; a 2D margin map when exactly two encoded features exist.
- **Decision Tree:** depth, node count, leaf count and mean decision-path length; train versus test gap; a proportional decision-tree outline with row tracing.

**Why:** VISION §5 and §9 ask for visualisations matched to each model so learners can contrast inspectable models with the opaque MLP.

## Scope

**In scope**

- `StoredEvaluation` schema version 2: optional `insights` (per-model, discriminated by model id) and `examples`, with decoder support for versions 1 and 2.
- Worker-side insight extraction through the WR-8 model hook and WR-12 functions, one extractor per model, mapping public `web-ml` output into stored insights.
- The per-model registry `src/config/models/{model-id}-results.ts` (eight files) and its closed panel-ID union.
- Presentational elements listed in Interfaces §C, the example-row picker, stories and three-browser tests; wiring into Phase 4's `app-model-results`.

**Out of scope**

- Tuning-dependent items: inner-CV selected values, KNN k-sweep, tree pruning curve, (C, γ) heatmap, NB α/τ selection (Phase 7: [web-ml-phase-7-hyperparameter-tuning.md](web-ml-phase-7-hyperparameter-tuning.md)).
- Optional note items (user selected optional items only for Phases 4–5): collinearity and VIF diagnostics, binarisation cutpoint overlay, simplex/α-shrinkage explorers, Voronoi/decision maps, latency ratios, partial dependence, regularisation paths, Platt status, margin band fraction, root-split stability, MDI — `specification/FUTURE.md`.
- Local SHAP/LIME attributions for MLP (Essential in the note): no `web-ml` support and no accepted specification; `specification/FUTURE.md`.
- Regression models.

**Constraints and invariants**

- Global internals describe the **final model**: the One-Shot model, or the cross-validation refit (WR-8 `kind: 'refit'`). Fold models are used only for fold variability (coefficient whiskers, loss curves, permutation importance spread) and to explain each example row with the model that predicted it out-of-sample.
- `samata-ml` reads public fitted attributes and WR-12 outputs. It applies only display transforms listed in D3; it never re-implements a model's likelihood, prediction or importance algorithm.
- Fitted models never leave the worker and are never stored; only compact insights are persisted.
- Phase 4 rules apply: Observable Plot through `PlotController`, D8 chart pattern (figure, caption takeaway, data table), tokens only, no colour-only meaning, WCAG 2.2 AA, i18n.

## Required reading

- `specification/plans/web-ml-classification-integration.md` §Scope (WR ledger: WR-7, WR-8, WR-12; WR-4 via Phase 4).
- `specification/plans/web-ml-phase-4-single-model-results.md` §Technical decisions, §Interfaces A–C — `StoredEvaluation`, decoder extension rule, `PlotController`, chart pattern, `app-model-results`.
- `specification/notes/metrics-and-visuals.md` §1 Model-Specific Internals, §3 C–E.
- `specification/workflow-steps.md` §3.6 — per-model results configuration file.
- `node_modules/web-ml/dist/src/models/bayesian/{bernoulli-nb,gaussian-nb,multinomial-nb}.d.ts`, `distance-based/k-neighbors-classifier.d.ts` L34–75, `linear/logistic-regression.d.ts` L77–197, `neural-networks/mlp-classifier.d.ts` L36 and `_base.d.ts` L54–57, `svm/support-vector-classifier.d.ts` L40, `trees/decision-tree-classifier.d.ts` L35 — public fitted attributes.
- `../web-ml/specification/public-api/current-limitations.md` L246–267 — serialisation; unsmoothed NB `-Infinity` becomes `null`.
- `specification/COMPONENTS.md` §2–§10; `specification/visual-design.md` §1.1, §6.

## Codebase context

- **Relevant specifications:** `specification/workflow-steps.md` §3.6; `specification/VISION.md` §5, §9; `specification/TODO.md` TODO-41, TODO-44.
- **Relevant implementation:** None of the target files exist yet. Phase 4 delivers `src/types/model-evaluation.ts`, `src/features/results/evaluation-decoder.ts`, `src/features/results/app-model-results.ts`, `src/features/results/charts/plot-controller.ts`. Phase 3 delivers `src/features/models/training/training.worker.ts` and `classifier-adapters.ts`. `src/features/models/model-catalogue.ts` (`SUPERVISED_MODELS` L56) holds the eight classifier ids: `bernoulli-nb`, `gaussian-nb`, `multinomial-nb`, `k-neighbors-classifier`, `logistic-regression`, `mlp-classifier`, `support-vector-classifier`, `decision-tree-classifier`.
- **`web-ml` model-specification JSON `metrics` blocks** (`../web-ml/specification/public-api/model-specifications/models/*.json`, schema L186–236): MLP `training-loss` → `lossCurve_` (`valueType: "training-history"`), `iterations` → `nIter_`; SVC `support-counts` → `nSupport_`; tree `node-count`, `tree-depth`; KNN `fit-sample-count`; NB and Logistic Regression `[]`. They name attributes only and do not define charts, so the registry (D2) is authoritative for panels.
- **Tests and commands:** Phase 4 fixtures `tests/fixtures/results/evaluations.ts`; `tests/model-results.e2e.ts`; journeys. Record the `bun run check` baseline before T1.
- **Web guidance:** `accessibility`, `html` (`<details>`/`<summary>` for the tree outline; `<select>` for the example picker), `forms`.
- **Visual reference:** Draft only — `specification/mockups/ui-scaffold/drafts/03-7_train-models-5-results.html` gains a "Model internals" section per model family (T10). No parity entries.
- **Domain skills:** `lit-component-implementer` for T3–T10.
- **Assumptions requiring verification:** The landed signatures of WR-8 and WR-12.

### Review of the input note (model-specific internals)

| Note item                                                                | Decision                                                                                                                                                                         | Why                                                                                                            |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| "Inner-CV selected" metrics (NB α/τ, KNN k, LR C, SVC C/γ, tree pruning) | Phase 4 shows the **configured** values now; Phase 7 adds selected values and stability across folds.                                                                            | Only tuned runs select values.                                                                                 |
| MLP train vs **validation** loss, best epoch                             | Implemented against WR-12; until a model is trained with a validation fraction, the panel shows training loss only with the sentence "Validation loss needs a validation split". | `web-ml` has no validation fraction today.                                                                     |
| MLP local SHAP/LIME                                                      | `FUTURE.md`.                                                                                                                                                                     | No library support; heavy; needs its own specification.                                                        |
| BaobabView proportional-stream tree                                      | Nested native `<details>` outline: each node summary states the split, row count and class mix, with a proportional bar; row tracing opens and marks the path.                   | Keyboard and screen-reader support is native; Plot's `tree` mark cannot encode per-link sample width reliably. |
| SVC 2D hyperplane map                                                    | Only when exactly two encoded features exist; otherwise a sentence explains why and suggests selecting two numeric features.                                                     | A 2D slice of a higher-dimensional boundary misleads.                                                          |
| KNN 2D Voronoi (optional)                                                | `FUTURE.md`.                                                                                                                                                                     | Optional; same 2D limitation.                                                                                  |

## Technical decisions

| Decision                                     | Chosen approach and rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Rejected alternative / trade-off                                                                                                                                                 |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 Extraction location                       | Per-model extractors (`src/features/models/training/insights/{model-id}.ts`) run inside the WR-8 hook in the integration worker, where the fitted model and transformed matrices exist, and return plain structured-cloneable insight objects.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Storing `toJSON()` snapshots per fold: KNN snapshots embed training rows (K × dataset memory) and keys are undocumented.                                                         |
| D2 Per-model registry                        | `src/config/models/{model-id}-results.ts` exports `results: ModelResultsConfig = { panels: readonly ModelPanelId[] }` (closed union, Interfaces §B). `app-model-results` renders panels in listed order inside a "Model internals" `<section>`. Satisfies `workflow-steps.md` §3.6.                                                                                                                                                                                                                                                                                                                                                                                                                            | JSON layouts with property paths (Phase 4 D12).                                                                                                                                  |
| D3 Display transforms allowed in `samata-ml` | Only: `exp` of stored log-probabilities (priors, feature rates, shares); `1 − p` for absence rates; WoE = `log(p_present,c / p_present,other)` from two stored rates; odds ratio = `exp(β)`; standardised coefficient = `β × SD` of the transformed training column (skipped and labelled when WR-7 already standardised); Fisher separability = Σ*c π_c (μ_jc − μ̄_j)² / Σ_c π_c σ²_jc from stored `theta*`, `var\_`, priors; support-vector fraction; parameter count from weight shapes; consensus = share of returned neighbours whose label equals the prediction; mean of returned distances; mean decision-path length from WR-12 paths; per-class histograms of transformed training columns (20 bins). | Asking `web-ml` for every derived number: these are closed-form re-expressions of public outputs. The user may move any of them upstream; each is isolated in one pure function. |
| D4 Example rows                              | `selectExamples(outputs, classLabels)` picks up to 24 held-out rows deterministically: for each class in `classLabels` order (first six classes by support when K > 6), the two correct and two incorrect rows with the lowest `sourceRowIndex`. Each example is explained by the model of its partition. Selected example persisted in `ModelResultsUi.exampleRow`.                                                                                                                                                                                                                                                                                                                                           | Arbitrary user-entered rows: needs a data-entry UI and leaks nothing new.                                                                                                        |
| D5 Evidence waterfall                        | One shared `app-evidence-waterfall` for the three NB models and Logistic Regression. Input: base term and per-feature terms from WR-12 `featureContributions` for the predicted class and the runner-up (binary: positive versus negative), plotted as the difference so bars sum to the decision margin; top 12 features by absolute contribution, remainder grouped as "Other features".                                                                                                                                                                                                                                                                                                                     | Separate waterfalls per model: four copies of the same chart.                                                                                                                    |
| D6 Tree outline                              | `app-tree-outline` renders nested `<details>`/`<summary>` from WR-12 node structure; levels 0–2 open by default; each summary reads "Petal length ≤ 2.45 cm — 120 rows (40%) — Adelie 40, Chinstrap 40, Gentoo 40" with an `aria-hidden` proportional bar; selecting an example opens its path and marks visited nodes with text "Example row went this way". Trees deeper than 12 levels show levels ≥ 12 as "N more nodes" summaries.                                                                                                                                                                                                                                                                        | SVG node-link tree: needs custom keyboard semantics (APG tree view) for the same information.                                                                                    |
| D7 SVC margin map                            | When `featureNamesOut.length === 2`: the extractor evaluates `decisionFunction` (binary) or `predict` (multiclass) on a 60 × 60 grid spanning the transformed training range ±5%; the chart draws filled regions, contour lines at −1, 0, +1 (binary) with Plot `contour`, support vectors with a ring, held-out rows as dots by true class and marker shape.                                                                                                                                                                                                                                                                                                                                                  | Projecting many features to 2D: the boundary drawn would not be the model's.                                                                                                     |
| D8 Partition choice for views                | Global panels read `insights.final`; fold variability panels read `insights.folds[]` (absent for One-Shot, where whiskers and spread are omitted with a sentence).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Averaging fold models into a pseudo-model: not a model anyone trained.                                                                                                           |

### Interfaces and behaviour

#### A. Stored insights (`src/types/model-evaluation.ts`, `schemaVersion: 2`)

```ts
export interface StoredEvaluationV2 extends Omit<StoredEvaluation, 'schemaVersion'> {
	readonly schemaVersion: 2;
	readonly insights?: StoredModelInsights;
	readonly examples?: readonly StoredExample[];
}

export interface StoredExample {
	readonly sourceRowIndex: number;
	readonly partitionIndex: number;
	/** Raw dataset values of the selected features, as displayed strings. */
	readonly featureValues: readonly string[];
	/** WR-12 contributions (NB, LR): base term and per-feature terms per class, row-major K × (1 + p). */
	readonly contributions?: Float32Array;
	/** KNN only. */
	readonly neighbours?: {
		readonly sourceRowIndex: Uint32Array;
		readonly distance: Float32Array;
		readonly classIndex: Uint16Array;
		readonly featureValues: readonly (readonly string[])[];
	};
	/** Decision Tree only: node ids on the path, root first. */
	readonly path?: Uint32Array;
}

export type StoredModelInsights =
	| {
			readonly modelId: 'bernoulli-nb';
			readonly final: NbInsight;
			readonly featureNames: readonly string[];
	  }
	| {
			readonly modelId: 'multinomial-nb';
			readonly final: NbInsight;
			readonly featureNames: readonly string[];
	  }
	| {
			readonly modelId: 'gaussian-nb';
			readonly final: GaussianInsight;
			readonly featureNames: readonly string[];
	  }
	| { readonly modelId: 'k-neighbors-classifier'; readonly final: KnnInsight }
	| {
			readonly modelId: 'logistic-regression';
			readonly final: LinearInsight;
			readonly folds?: readonly LinearInsight[];
			readonly featureNames: readonly string[];
	  }
	| {
			readonly modelId: 'mlp-classifier';
			readonly final: MlpInsight;
			readonly folds?: readonly MlpInsight[];
			readonly featureNames: readonly string[];
	  }
	| {
			readonly modelId: 'support-vector-classifier';
			readonly final: SvcInsight;
			readonly featureNames: readonly string[];
	  }
	| {
			readonly modelId: 'decision-tree-classifier';
			readonly final: TreeInsight;
			readonly featureNames: readonly string[];
	  };
```

- `NbInsight = { classLogPrior: Float32Array; featureLogProb: Float32Array /* K × p */; alpha: number }`.
- `GaussianInsight = { classPrior: Float32Array; theta: Float32Array; variance: Float32Array /* K × p */; histograms: { edges: Float32Array /* p × 21 */; counts: Uint32Array /* K × p × 20 */ } }`.
- `KnnInsight = { k: number; metric: string; weights: string; consensus: Float32Array /* per held-out row */; meanDistance: Float32Array /* per held-out row */ }`.
- `LinearInsight = { coefficients: Float32Array /* C × p, C = 1 binary */; intercepts: Float32Array; columnSd: Float32Array | null; c: number; penalty: string; decisionScores: Float32Array /* held-out rows × C */ }`.
- `MlpInsight = { lossCurve: Float32Array; validationLossCurve: Float32Array | null; bestEpoch: number | null; nIter: number; maxIter: number; parameterCount: number; trainSampleCount: number; permutationImportance: { mean: Float32Array; sd: Float32Array } | null }`.
- `SvcInsight = { nSupport: Uint32Array; trainSampleCount: number; kernel: string; c: number; gamma: string; decisionValues: Float32Array | null /* binary held-out rows */; grid: { x: Float32Array; y: Float32Array; values: Float32Array; supportVectors: Float32Array } | null }`.
- `TreeInsight = { depth: number; nodeCount: number; leafCount: number; meanPathLength: number; nodes: { feature: Int32Array /* −1 leaf */; threshold: Float32Array; left: Int32Array; right: Int32Array; samples: Uint32Array; classCounts: Uint32Array /* nodes × K */ } }`.
- The Phase 4 decoder accepts versions 1 and 2; for version 2 it validates every insight's array lengths against K, p, node count and held-out row count, and drops (not rejects) an invalid `insights` or `examples` with a console warning so shared results still render.

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
	| 'knn-spokes'
	| 'knn-consensus'
	| 'coefficient-forest'
	| 'sigmoid-curve'
	| 'loss-curves'
	| 'permutation-importance'
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
| `mlp-classifier-results.ts`            | parameter-summary, loss-curves, permutation-importance                                   |
| `support-vector-classifier-results.ts` | parameter-summary, svc-decision-histogram, svc-margin-map                                |
| `decision-tree-classifier-results.ts`  | parameter-summary, example-picker, tree-outline                                          |

`src/config/models/results-registry.ts` exports `modelResultsConfig(modelId: string): ModelResultsConfig | null`; unknown ids return `null` and render no internals section.

#### C. Components (`src/features/results/`, presentational unless stated)

All take `labels` (`DEFAULT_*_LABELS`, no owned strings); charts take `caption: ChartCaption | null` and `formatValue`, and follow Phase 4 D8. View models come from pure builders in `src/features/results/model-insights-view-model.ts`.

| Tag                                 | Properties                                                           | Events                                                                      | Behaviour                                                                                                                                                                                     |
| ----------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app-parameter-summary`             | `items: readonly SummaryItemView[]`                                  | none                                                                        | `<dl>` of configured hyperparameters and model facts (e.g. "Support vectors: 26 (22% of training rows)", "Converged after 143 of 200 iterations" or the iteration-limit warning).             |
| `app-example-picker`                | `examples: readonly ExampleOptionView[]`, `selected: number \| null` | `app-example-change` `{ sourceRowIndex: number }` (bubbles, composed)       | Labelled `<select>` grouped by true class (`<optgroup>`), each option stating correct/incorrect in text.                                                                                      |
| `app-evidence-waterfall` (Plot)     | `waterfall: WaterfallView \| null`                                   | none                                                                        | D5. Bars from the base term, each feature bar labelled with feature name and value; final bar labelled with the predicted class.                                                              |
| `app-nb-rates-table`                | `table: NbRatesView \| null`                                         | none                                                                        | Priors row plus per-feature per-class rates (Bernoulli presence, Multinomial share, Gaussian mean ± SD) and WoE / Fisher ratio columns where applicable; K > 6 uses the Phase 4 class filter. |
| `app-nb-butterfly` (Plot)           | `butterfly: ButterflyView \| null`                                   | none                                                                        | Two-class comparison (binary, or a class pair chosen in the view model as predicted vs runner-up overall): presence rates mirrored left/right per feature, sorted by absolute WoE.            |
| `app-gaussian-fit` (Plot)           | `fits: GaussianFitView \| null`                                      | none                                                                        | Small multiples (max 8 features by Fisher ratio, with a note naming the rest): class histograms as steps and fitted normal curves, class identity by colour and line dash.                    |
| `app-feature-log-odds` (Plot)       | `weights: LogOddsView \| null`                                       | none                                                                        | Ranked diverging bars of the top 20 features by absolute weight for the selected class pair.                                                                                                  |
| `app-knn-consensus` (Plot)          | `consensus: ConsensusView \| null`                                   | none                                                                        | Histogram of neighbour consensus over held-out rows with mean distance in the caption.                                                                                                        |
| `app-knn-spokes` (Plot)             | `spokes: SpokesView \| null`                                         | none                                                                        | Query at centre; neighbours at equal angles, radius = distance, marker shape and label by class; neighbour comparison `<table>` (distance, class, each selected feature value).               |
| `app-coefficient-forest` (Plot)     | `forest: ForestView \| null`, `classIndex: number`                   | `app-coefficient-class-change` `{ classIndex: number }` (bubbles, composed) | Dots = final standardised coefficient; whiskers = min–max across folds (CV only); odds ratio in the table; class `<select>` for multiclass one-vs-rest.                                       |
| `app-sigmoid-curve` (Plot)          | `curve: SigmoidView \| null`                                         | none                                                                        | Logistic curve over the decision-score range with held-out rows as dots at their scores (jittered vertically by true class, marker shape by class); binary or the selected OvR class.         |
| `app-loss-curves` (Plot)            | `curves: LossCurvesView \| null`                                     | none                                                                        | Final model training loss (solid), validation loss (dashed) when present, fold curves as thin lines; best epoch rule; gap stated in the caption.                                              |
| `app-permutation-importance` (Plot) | `importance: ImportanceView \| null`                                 | none                                                                        | Horizontal bars of mean importance with ± SD rules, top 20 features.                                                                                                                          |
| `app-svc-decision-histogram` (Plot) | `histogram: DecisionHistogramView \| null`                           | none                                                                        | Binary: decision values of held-out rows by true class with rules at −1, 0, +1 labelled "margin" and "boundary"; multiclass: the sentence that pairwise values are not shown.                 |
| `app-svc-margin-map` (Plot)         | `map: MarginMapView \| null`                                         | none                                                                        | D7, or the two-feature explanation sentence.                                                                                                                                                  |
| `app-tree-outline`                  | `tree: TreeOutlineView \| null`, `path: readonly number[]`           | none                                                                        | D6; summary list (depth, nodes, leaves, mean path length) above the outline.                                                                                                                  |

- `app-model-results` (Phase 4, connected) gains: a "Model internals" `<section>` with `<h3>`, the panels from `modelResultsConfig(model.modelId)`, handlers for `app-example-change` and `app-coefficient-class-change` writing `ModelResultsUi.exampleRow` and `ModelResultsUi.coefficientClass` (new optional fields, default `null` and `0`), and "Train again to see model internals" when `insights` is absent (version 1 or dropped).

## Specification changes

- [ ] `specification/workflow-steps.md` §3.6 — Model internals: registry location and panel list per model; final versus fold models; example rows; status remains partial.
- [ ] `specification/state-and-storage.md` §3, §6 — `StoredEvaluation` version 2 fields and drop-not-reject rule; `ModelResultsUi.exampleRow`, `coefficientClass`.
- [ ] `specification/machine-learning-orchestrator.md` — WR-8 hook extraction and WR-12 calls per model; memory bounds (histograms 20 bins, grid 60 × 60, 24 examples).
- [ ] `specification/components/model-internals.md` (new) & `specification/README.md` — closed APIs for the sixteen elements; status implemented.
- [ ] `specification/FUTURE.md` — MLP local attribution (SHAP/LIME), KNN Voronoi map, collinearity/VIF, regularisation paths, partial dependence, root-split stability, MDI, binarisation cutpoint overlay, simplex/α explorers, Platt status, margin band fraction.
- [ ] `specification/TODO.md`, `specification/HUMAN.md` — TODO-41 model-specific part resolved; TODO-44 contrast (MLP opacity) addressed through permutation importance and loss curves; HUMAN item to style the model-internals draft sections.

## Implementation tasks

### T1 — Insight types, decoder version 2, example selection and the registry

- **Depends on:** None
- **Risk:** needs care — extends a shared persisted contract; version 1 results must keep rendering.
- **Likely files:** `src/types/model-evaluation.ts`, `src/features/results/evaluation-decoder.ts`, `src/features/results/example-selection.ts`, `src/config/models/results-registry.ts`, `src/config/models/bernoulli-nb-results.ts`, `src/config/models/gaussian-nb-results.ts`, `src/config/models/multinomial-nb-results.ts`, `src/config/models/k-neighbors-classifier-results.ts`, `src/config/models/logistic-regression-results.ts`, `src/config/models/mlp-classifier-results.ts`, `src/config/models/support-vector-classifier-results.ts`, `src/config/models/decision-tree-classifier-results.ts`, `tests/fixtures/results/insights.ts`, `tests/evaluation-decoder.test.ts`, `tests/example-selection.test.ts`, `tests/results-registry.test.ts`
- **Must not touch:** `src/features/models/training/`, `src/features/results/app-*.ts`
- **Implementation:** Implement Interfaces §A–B and D4. One hand-built fixture per model id (iris for multiclass, breast-cancer for binary models with binary-only panels).
- **Acceptance criteria:**
    - [ ] `WML-P6-EVAL-1` — Version 1 and version 2 fixtures decode; an invalid `insights` block is dropped while the rest decodes; every insight length rule has a negative test.
    - [ ] `WML-P6-EVAL-2` — `selectExamples` returns the documented rows for iris and breast-cancer fixtures, at most 24, stable across calls; a class with no incorrect rows contributes only correct rows.
    - [ ] `WML-P6-EVAL-3` — Every catalogue classifier id has a registry entry whose panels are valid `ModelPanelId`s; unknown ids return `null`.
- **Verification:** `bun test tests/evaluation-decoder.test.ts tests/example-selection.test.ts tests/results-registry.test.ts`; `bun run check`.
- **Progress:** [ ] Not started

### T2 — Extract insights in the worker through the model hook

- **Depends on:** T1
- **Risk:** needs care — depends on WR-8/WR-12 signatures; extraction must not keep models alive or slow training disproportionately.
- **Likely files:** `src/features/models/training/insights/index.ts`, `src/features/models/training/insights/bernoulli-nb.ts`, `src/features/models/training/insights/gaussian-nb.ts`, `src/features/models/training/insights/multinomial-nb.ts`, `src/features/models/training/insights/k-neighbors-classifier.ts`, `src/features/models/training/insights/logistic-regression.ts`, `src/features/models/training/insights/mlp-classifier.ts`, `src/features/models/training/insights/support-vector-classifier.ts`, `src/features/models/training/insights/decision-tree-classifier.ts`, `src/features/models/training/insights/display-transforms.ts`, `src/features/models/training/training.worker.ts`, `src/features/models/training/evaluation-mapper.ts`, `tests/insight-extractors.test.ts`, `tests/display-transforms.test.ts`, `tests/classification-training.e2e.ts`
- **Must not touch:** `src/features/results/`, `node_modules/`
- **Implementation:** Register the WR-8 hook in Phase 3/4 calls (CV with `refit: true`). Each extractor reads only public attributes and WR-12 functions, applies D3 transforms from `display-transforms.ts`, and returns its insight; examples gain contributions, neighbours (with raw feature values read from the worker's loaded rows) or paths. Record extraction time in the training log as one entry.
- **Acceptance criteria:**
    - [ ] `WML-P6-EXTRACT-1` — For fake models exposing the landed public attributes, each extractor's output decodes and copies attribute values unchanged; `display-transforms` match hand-computed values (odds ratio, WoE, Fisher ratio, SV fraction, parameter count, consensus).
    - [ ] `WML-P6-EXTRACT-2` — Real training of all eight classifiers on iris (and SVC/tree/LR/NB on breast-cancer) stores insights that decode; One-Shot runs have no `folds`; five-fold Logistic Regression has five `folds`.
    - [ ] `WML-P6-EXTRACT-3` — The SVC margin grid exists only with two encoded features; KNN consensus values are in [0, 1]; tree node arrays are consistent with `nodeCount`.
- **Verification:** `bun test tests/insight-extractors.test.ts tests/display-transforms.test.ts`; `bun run test:e2e tests/classification-training.e2e.ts`; `bun run check`; `bun run build`.
- **Progress:** [ ] Not started

### T3 — Shared internals elements: parameter summary, example picker, evidence waterfall

- **Depends on:** T1
- **Risk:** routine
- **Likely files:** `src/features/results/model-insights-view-model.ts`, `src/features/results/app-parameter-summary.ts`, `src/features/results/app-parameter-summary.stories.ts`, `src/features/results/app-example-picker.ts`, `src/features/results/app-example-picker.stories.ts`, `src/features/results/app-evidence-waterfall.ts`, `src/features/results/app-evidence-waterfall.stories.ts`, `tests/model-insights-view-model.test.ts`, `tests/internals-shared.e2e.ts`
- **Must not touch:** `css/root.css`, `src/stores/`
- **Implementation:** Per Interfaces §C and D5. Stories: `Binary`, `Multiclass`, `ManyFeatures`, `IterationLimit`, `LongLabel`, `RTL`.
- **Acceptance criteria:**
    - [ ] `WML-P6-UI-1` — The waterfall's bars sum (within 1e-6) to the margin stated in its caption; at most 13 bars render (12 + "Other features"); the data table lists every feature.
    - [ ] `WML-P6-UI-2` — The example picker groups options by class with correct/incorrect text and emits one event per change.
- **Verification:** `bun test tests/model-insights-view-model.test.ts`; `bun run test:e2e tests/internals-shared.e2e.ts`; `bun run test:stories`; `bun run check`.
- **Progress:** [ ] Not started

### T4 — Naive Bayes panels

- **Depends on:** T3
- **Risk:** routine
- **Likely files:** `src/features/results/model-insights-view-model.ts`, `src/features/results/app-nb-rates-table.ts`, `src/features/results/app-nb-rates-table.stories.ts`, `src/features/results/app-nb-butterfly.ts`, `src/features/results/app-nb-butterfly.stories.ts`, `src/features/results/app-gaussian-fit.ts`, `src/features/results/app-gaussian-fit.stories.ts`, `src/features/results/app-feature-log-odds.ts`, `src/features/results/app-feature-log-odds.stories.ts`, `tests/model-insights-view-model.test.ts`, `tests/internals-naive-bayes.e2e.ts`
- **Must not touch:** `css/root.css`, `src/stores/`
- **Implementation:** Per Interfaces §C. `null` log-probabilities (unsmoothed `-Infinity`) display as "Zero (no smoothing)".
- **Acceptance criteria:**
    - [ ] `WML-P6-UI-3` — Bernoulli butterfly rows are sorted by absolute WoE and mirror the stored rates; Gaussian small multiples show at most eight features with the omitted names listed; Multinomial bars show the top 20 by absolute weight.
    - [ ] `WML-P6-UI-4` — Rates tables reproduce stored values (after `exp`) to four decimals; zero-rate cells read "Zero (no smoothing)".
- **Verification:** `bun test tests/model-insights-view-model.test.ts`; `bun run test:e2e tests/internals-naive-bayes.e2e.ts`; `bun run test:stories`; `bun run check`.
- **Progress:** [ ] Not started

### T5 — KNN panels

- **Depends on:** T3
- **Risk:** routine
- **Likely files:** `src/features/results/model-insights-view-model.ts`, `src/features/results/app-knn-consensus.ts`, `src/features/results/app-knn-consensus.stories.ts`, `src/features/results/app-knn-spokes.ts`, `src/features/results/app-knn-spokes.stories.ts`, `tests/internals-knn.e2e.ts`
- **Must not touch:** `css/root.css`, `src/stores/`
- **Implementation:** Per Interfaces §C.
- **Acceptance criteria:**
    - [ ] `WML-P6-UI-5` — The spoke chart shows k neighbours with labels; the comparison table lists each neighbour's distance, class and feature values in ascending distance; `k = 1` renders one spoke and a sentence about memorisation.
- **Verification:** `bun run test:e2e tests/internals-knn.e2e.ts`; `bun run test:stories`; `bun run check`.
- **Progress:** [ ] Not started

### T6 — Logistic Regression panels

- **Depends on:** T3
- **Risk:** routine
- **Likely files:** `src/features/results/model-insights-view-model.ts`, `src/features/results/app-coefficient-forest.ts`, `src/features/results/app-coefficient-forest.stories.ts`, `src/features/results/app-sigmoid-curve.ts`, `src/features/results/app-sigmoid-curve.stories.ts`, `tests/internals-logistic.e2e.ts`
- **Must not touch:** `css/root.css`, `src/stores/`
- **Implementation:** Per Interfaces §C and D8.
- **Acceptance criteria:**
    - [ ] `WML-P6-UI-6` — Cross-validated runs show whiskers spanning fold min–max; One-Shot runs show dots only with the sentence about folds; L1 models state the active feature count; the class select switches classes for multiclass.
    - [ ] `WML-P6-UI-7` — The sigmoid chart plots every held-out row at its stored decision score; markers differ by shape per class.
- **Verification:** `bun run test:e2e tests/internals-logistic.e2e.ts`; `bun run test:stories`; `bun run check`.
- **Progress:** [ ] Not started

### T7 — MLP panels

- **Depends on:** T3
- **Risk:** routine
- **Likely files:** `src/features/results/model-insights-view-model.ts`, `src/features/results/app-loss-curves.ts`, `src/features/results/app-loss-curves.stories.ts`, `src/features/results/app-permutation-importance.ts`, `src/features/results/app-permutation-importance.stories.ts`, `tests/internals-mlp.e2e.ts`
- **Must not touch:** `css/root.css`, `src/stores/`
- **Implementation:** Per Interfaces §C. The parameter summary states parameters, training rows and their ratio with a sentence when the ratio exceeds 1.
- **Acceptance criteria:**
    - [ ] `WML-P6-UI-8` — Without validation loss the chart shows training loss only with the validation sentence; with it, the best-epoch rule and the gap in the caption; `nIter === maxIter` shows the iteration-limit warning.
    - [ ] `WML-P6-UI-9` — Permutation importance bars show mean ± SD for the top 20 features; unavailable importance shows its reason.
- **Verification:** `bun run test:e2e tests/internals-mlp.e2e.ts`; `bun run test:stories`; `bun run check`.
- **Progress:** [ ] Not started

### T8 — SVC panels

- **Depends on:** T3
- **Risk:** routine
- **Likely files:** `src/features/results/model-insights-view-model.ts`, `src/features/results/app-svc-decision-histogram.ts`, `src/features/results/app-svc-decision-histogram.stories.ts`, `src/features/results/app-svc-margin-map.ts`, `src/features/results/app-svc-margin-map.stories.ts`, `tests/internals-svc.e2e.ts`
- **Must not touch:** `css/root.css`, `src/stores/`
- **Implementation:** Per D7 and Interfaces §C.
- **Acceptance criteria:**
    - [ ] `WML-P6-UI-10` — With two features the map shows regions, the −1/0/+1 contours (binary) and ringed support vectors; with three features it shows the explanation sentence and no chart.
    - [ ] `WML-P6-UI-11` — The binary histogram labels the margin and boundary rules; multiclass shows the pairwise sentence.
- **Verification:** `bun run test:e2e tests/internals-svc.e2e.ts`; `bun run test:stories`; `bun run check`.
- **Progress:** [ ] Not started

### T9 — Decision tree outline with row tracing

- **Depends on:** T3
- **Risk:** needs care — deep trees and keyboard navigation through nested disclosures.
- **Likely files:** `src/features/results/model-insights-view-model.ts`, `src/features/results/app-tree-outline.ts`, `src/features/results/app-tree-outline.stories.ts`, `tests/internals-tree.e2e.ts`
- **Must not touch:** `css/root.css`, `src/stores/`
- **Implementation:** Per D6.
- **Acceptance criteria:**
    - [ ] `WML-P6-UI-12` — Summaries state split, rows, share and class mix; levels 0–2 are open; selecting an example opens every node on its path and marks them in text; a 20-level tree renders the "more nodes" summaries below level 12.
    - [ ] `WML-P6-UI-13` — Tab and Enter/Space operate every disclosure; the outline reflows at 320 px without horizontal page scrolling.
- **Verification:** `bun run test:e2e tests/internals-tree.e2e.ts`; `bun run test:stories`; `bun run check`.
- **Progress:** [ ] Not started

### T10 — Wire internals into Section 6, update the draft and journeys

- **Depends on:** T2, T4, T5, T6, T7, T8, T9
- **Risk:** needs care — extends the Phase 4 connected element and persisted UI.
- **Likely files:** `src/features/results/app-model-results.ts`, `src/features/results/app-model-results.stories.ts`, `src/types/state.ts`, `src/stores/app.store.ts`, `src/stores/persister.ts`, `specification/mockups/ui-scaffold/drafts/03-7_train-models-5-results.html`, `tests/helpers/seed-results.ts`, `tests/model-internals.e2e.ts`, `tests/a11y.e2e.ts`, `tests/state-and-storage.test.ts`, `tests/journeys/iris-classification.e2e.ts`, `tests/journeys/penguins-classification.e2e.ts`
- **Must not touch:** `css/root.css`, `src/app.ts`, `src/features/results/app-results-view.ts`
- **Implementation:** Per Interfaces §C last bullet. Add one "Model internals" draft section per model family to the 03-7 draft. Extend journeys to assert Logistic Regression internals (forest and waterfall).
- **Acceptance criteria:**
    - [ ] `WML-P6-UI-14` — For each of the eight fixtures Section 6 renders the registry panels in order after the shared sections; a version 1 envelope shows "Train again to see model internals".
    - [ ] `WML-P6-UI-15` — Example and coefficient-class choices survive reload; `tests/a11y.e2e.ts` scans one NB, one tree and one SVC Section 6 with no new findings.
    - [ ] `WML-P6-UI-16` — `JOURNEY-IRIS-INTERNALS` and `JOURNEY-PENGUINS-INTERNALS` pass in three browsers.
- **Verification:** `bun run test:e2e tests/model-internals.e2e.ts tests/model-results.e2e.ts tests/a11y.e2e.ts tests/journeys/iris-classification.e2e.ts tests/journeys/penguins-classification.e2e.ts`; `bun test tests/state-and-storage.test.ts tests/style-tokens.test.ts`; `bun run test:stories`; `bun run check`; `bun run build`.
- **Progress:** [ ] Not started

### T11 — Sync specifications for Phase 6

- **Depends on:** T1, T2, T3, T4, T5, T6, T7, T8, T9, T10
- **Risk:** routine
- **Likely files:** `specification/workflow-steps.md`, `specification/state-and-storage.md`, `specification/machine-learning-orchestrator.md`, `specification/components/model-internals.md`, `specification/README.md`, `specification/FUTURE.md`, `specification/TODO.md`, `specification/HUMAN.md`, `specification/plans/README.md`, `specification/plans/web-ml-phase-6-model-specific-results.md`
- **Must not touch:** `src/`, `tests/`, `specification/mockups/`, `specification/notes/`
- **Implementation:** Apply every item under _Specification changes_.
- **Acceptance criteria:**
    - [ ] Every item under _Specification changes_ is applied and ticked.
    - [ ] `bun run plans:check` and `bun run plans:task specification/plans/web-ml-phase-6-model-specific-results.md --check-complete` pass.
- **Verification:** `bun run plans:check specification/plans/web-ml-phase-6-model-specific-results.md`; `bun run plans:task specification/plans/web-ml-phase-6-model-specific-results.md --check-complete`; `bun run check`.
- **Progress:** [ ] Not started

## Verification and definition of done

- [ ] All acceptance criteria met with test names starting with `WML-P6-*` or the journey IDs.
- [ ] `bun run check`, `bun run build`, `bun run test:stories` and the listed Playwright suites pass in three browsers with no new failures.
- [ ] Code review confirms extractors use only public `web-ml` attributes/functions and D3 transforms.
- [ ] Manual checks recorded: screen-reader walk through the tree outline and one waterfall; keyboard-only example selection; forced colours; 200% zoom.
- [ ] `bun run format` run on changed files; every _Specification changes_ item ticked.

## Risks and open questions

- **Blocking:** Phase 4 must be `ready`, and `web-ml` must publish WR-7, WR-8 and WR-12 in its public declarations and prose. Then re-scout, pin the hook and WR-12 signatures in T2, and submit for review.
- **Non-blocking:** D3 keeps closed-form display transforms (odds ratio, WoE, Fisher ratio, consensus, parameter count) in `samata-ml`. If the user wants these in `web-ml` too, add them to WR-12 and replace `display-transforms.ts` calls. Owner: human (HUMAN.md).
- **Non-blocking:** Extraction adds work after each fold (permutation importance is the costliest: `nRepeats × features` predictions). Default `nRepeats: 5`; T2 records extraction time per model on iris and penguins in the log.
- **Non-blocking:** Model-internals draft sections await human styling (`specification/HUMAN.md`).

## Escalations

None.

## Review fixes

None.

## Implementation and verification log

| When (UTC)           | Task | Agent (model)                 | Outcome / commands / evidence                                                                                                                 |
| -------------------- | ---- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-19T08:47:35Z | —    | Claude Code (claude-opus-5-5) | Planning: `codebase-scout` listed every classifier's public fitted attributes and the model-specification `metrics` blocks in `web-ml@0.1.0`. |

## Plan review history

| Reviewed (UTC) | Agent (model) | Decision | Findings |
| -------------- | ------------- | -------- | -------- |

## Change log

| When (UTC)           | Change        | Reason                                                                                                       |
| -------------------- | ------------- | ------------------------------------------------------------------------------------------------------------ |
| 2026-11-19T08:47:35Z | Initial draft | User split the former Phase 4 stub; model-specific metrics and visuals become Phase 6 on Phase 4's contract. |
