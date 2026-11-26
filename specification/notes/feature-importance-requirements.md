# Feature Importance and Interpretability Views: Requirements (v2)

Audience: a coding agent that will produce an implementation plan, then code. Normative words: MUST, SHOULD, MAY. Values in `UPPER_SNAKE_CASE` are named constants (section 7); never hard-code them in components. Where a rule says "design choice", treat it as a hypothesis to be revisited after the pilot, and keep it behind a constant or flag.

## 1. Purpose, scope, non-goals

- Help non-technical learners see which inputs a trained classifier relies on, in which direction, and how much that conclusion can be trusted.
- Two surfaces: Individual Model Results (each of the 8 classifiers) and Cross-Model Comparison.
- All computation runs client-side in Web Workers, with no backend.
- Non-goals: causal claims about the real world; fairness auditing; regression; ensembles.

## 2. Product rules (apply to every chart)

1. **Model, not world.** Every chart in this spec shows how a model behaves. Each chart MUST carry a collapsible "What this does and does not tell you" note stating: (a) it describes this model, not cause and effect in reality; (b) a feature that matters little to this model could matter to a better one; (c) features that move together share credit unpredictably.
2. **Held-out only.** Importance and effect charts MUST be computed on rows the scoring model never trained on. Label every chart "Computed on held-out data".
3. **Show spread, not just means.** Never show a bare ranking. Show per-fold values, and label the spread as "variation across folds", never "confidence interval".
4. **Raw feature space.** Learners see original columns (for example `occupation`), never encoded columns (`occupation_Sales`), except in `SIGNED_WEIGHTS` where levels are shown grouped under their parent feature.
5. **Plain language first.** Use "shuffle", "held-out data", "pushes toward". Do not use "permutation", "log-likelihood", "SHAP" or "ALE" in the default view. Technical names appear only in Tier 2 detail and tooltips.
6. **Position over colour.** Magnitude MUST be encoded by position or length on a shared axis wherever the task is comparison. Colour fill encodes magnitude only in the heatmap, and there every cell MUST also carry a text value.
7. **Colour contract.**
   - Signed charts: Okabe-Ito blue for "toward class", vermilion for "away from class".
   - Unsigned importance: neutral slate.
   - Negative or unreliable importance: grey with a diagonal hatch pattern. It MUST NOT reuse the vermilion or blue of signed charts.
   - Models in comparison charts: the application's fixed per-classifier colour and marker shape.
   - Colour MUST NOT be the only carrier of meaning. Add direction text, patterns or labels.
8. **Truncation.** Ranked charts show the top `TOP_N` rows with a "Show all N features" control. Sort descending by primary magnitude. Sorting is a convenience; add the caption "Features with overlapping spread are not reliably ordered."
9. **Progressive disclosure.** Tier 1 (default) shows `PFI_DOTS`, the model-appropriate native chart, and the note from rule 1. Tier 2 (Explore deeper) shows effect plots, grouped-permutation toggles, and technical diagnostics.
10. **Accessibility.** Follow the project's chart guide: text alternative and data table per chart, keyboard-operable point selection, contrast, and no hover-only information. Tooltips MUST have a keyboard equivalent.

## 3. Computation invariants

**I1. Evaluation split.** Compute all importance and effect quantities on outer held-out test folds only. If cross-validation is disabled, use the single hold-out set and set `evaluatedOn = 'single_holdout'`. Assert in code that no scored row belongs to the scoring model's training set.

**I2. Which model scores which row.** Each outer test row MUST be scored by the model of its own outer fold (the tuned model that did not see it). Results are aggregated across the K outer models. Structural views that need a single model (Gaussian curves, tree structure) use the final refitted model and MUST show the badge "Final model structure (not the cross-validated estimate)".

**I3. Permute raw columns before preprocessing.** Shuffle the raw column in the held-out split, then apply the fold's fitted preprocessor (encoder, scaler, imputer), then predict. Never shuffle encoded columns independently. The engine operates on _permutation units_ (`PermutationUnit`): a unit is a list of raw columns shuffled together with the same row permutation. In v1 every unit holds exactly one raw column; the grouped toggle (Phase 2) only changes how units are built.

**I4. Metric and orientation.**

- The importance metric defaults to the application's headline metric (`metricId`). One metric MUST be used for all models on the Comparison page.
- Support a probabilistic alternative (log loss) where the model yields probabilities. Do not offer it for any model whose probabilities are not consistent with its predictions.
- Orient every importance so that positive means "performance got worse after shuffling": `baseline - permuted` for higher-is-better metrics, `permuted - baseline` for loss metrics. Never clamp negatives in stored data.

**I5. Aggregation and spread.**

1. For each outer fold k and repeat r, compute `delta[k][r]`.
2. Fold value `v[k] = mean_r delta[k][r]`.
3. `meanImportance = mean_k v[k]`; `sdAcrossFolds = sd_k v[k]` (null if K < 2); `positiveFolds = count(v[k] > 0)`.
4. `monteCarloSe` = standard error from repeats, averaged over folds, reported separately as shuffle noise.
5. Do NOT pool all `K x R` values and compute a confidence interval as if they were independent. Do not emit `ci95` fields.
6. `signal`: `'consistent'` if `K >= 3` and `positiveFolds === K`; `'negative'` if `meanImportance < 0`; otherwise `'unclear'`.

**I6. Determinism and pairing.** Use one seeded PRNG. Derive the permutation for (fold, unit, repeat) from the seed so that all models in a comparison use the same permutations for the same fold, unit and repeat. Folds MUST be identical across models.

**I7. Skill gate.** Before showing a model's importances, compare its outer-fold score to the dummy baseline (majority-class predictor). If the model does not beat it (mean score not above baseline), set `modelBeatsDummy = false`. Show the banner "This model barely beats guessing, so its feature importances say little." Keep the chart visible but greyed. Exclude the model from comparison fills (`eligible = false`). Do NOT infer this from importances being near zero.

**I8. Association metadata.** On the raw feature columns (no target involved), compute pairwise association once per dataset version:

- numeric-numeric: Spearman |rho|;
- categorical-categorical: bias-corrected Cramér's V;
- numeric-categorical: correlation ratio (eta).

Attach `correlatedPeers` to any feature with an association of at least `ASSOC_WARN`. Pairwise measures can miss multi-feature redundancy; the UI wording MUST say "at least one other feature moves together with this one", not "this feature is independent" when no peer is flagged.

**I9. MDI aggregation.** Decision Tree impurity importance is computed per outer-fold tree on that fold's training data after encoding. Sum the scores of all encoded columns that belong to one raw feature, then average across folds. Normalise to shares summing to 1.

**I10. Multi-class.** Unsigned global charts (`PFI_DOTS`, `MDI_VS_PFI`, comparison charts) use multi-class metrics directly. Signed and probability-based charts (`SIGNED_WEIGHTS`, `EFFECT_PLOT`, `LOCAL_EXPLAIN`) bind to one shared `selectedClass` control when classes > 2. Default `selectedClass` = the dataset's configured positive class (binary) or the class with the most rows (multi-class). Changing it updates every signed chart on the page.

**I11. Compute budget.**

- Run in Web Workers, cancellable, with progress per model.
- Cache results by (dataset hash, model id, fold seed, metric, repeats, unit set).
- Default `REPEATS_DEFAULT`; offer a "More precise" option (`REPEATS_PRECISE`).
- If a model's time budget is exceeded (KNN and kernel SVC predictions are the usual cause), reduce repeats down to `REPEATS_MIN`, record `nRepeatsUsed`, and show "Estimated with fewer shuffles".
- Compute charts lazily when first opened.

## 4. Routing matrix

| Model                  | PFI_DOTS | SIGNED_WEIGHTS              | MDI_VS_PFI | GAUSSIAN_DIST | EFFECT_PLOT | LOCAL_EXPLAIN                           |
| ---------------------- | -------- | --------------------------- | ---------- | ------------- | ----------- | --------------------------------------- |
| Logistic Regression    | Default  | Tab                         | n/a        | n/a           | Tier 2      | Exact additive waterfall                |
| SVC, linear kernel     | Default  | Tab                         | n/a        | n/a           | Tier 2      | Exact additive waterfall                |
| SVC, non-linear kernel | Default  | n/a (show explanatory note) | n/a        | n/a           | Tier 2      | Approximate Shapley waterfall (Phase 2) |
| Bernoulli NB           | Default  | Tab                         | n/a        | n/a           | Tier 2      | Exact additive waterfall                |
| Multinomial NB         | Default  | Tab                         | n/a        | n/a           | Tier 2      | Exact additive waterfall                |
| Gaussian NB            | Default  | n/a                         | n/a        | Tab           | Tier 2      | Exact additive waterfall                |
| Decision Tree          | Default  | n/a                         | Tab        | n/a           | Tier 2      | Rule-path stepper                       |
| KNN                    | Default  | n/a                         | n/a        | n/a           | Tier 2      | Neighbour table                         |
| MLP                    | Default  | n/a                         | n/a        | n/a           | Tier 2      | Approximate Shapley waterfall (Phase 2) |

Comparison page: `COMPARISON_DOTS` (default) and `COMPARISON_HEATMAP` (secondary tab).

## 5. Data contracts

```ts
export type ModelType =
  | 'bernoulli_nb' | 'gaussian_nb' | 'multinomial_nb' | 'knn'
  | 'logistic_regression' | 'mlp' | 'svc' | 'decision_tree';

export interface AssociationPeer {
  feature: string;
  measure: 'spearman' | 'cramers_v_bias_corrected' | 'eta';
  strength: number; // absolute value in [0, 1]
}

export interface PermutationUnit {
  id: string;
  label: string;
  rawFeatures: string[]; // v1: exactly one
}

export interface FeatureMeta {
  kind: 'numeric' | 'categorical';
  nLevels?: number; // categorical only
}

export interface PfiRow {
  unitId: string;
  feature: string;
  meta: FeatureMeta;
  meanImportance: number;     // may be negative; oriented per I4
  foldValues: number[];       // v[k], length K (length 1 for single hold-out)
  sdAcrossFolds: number | null;
  positiveFolds: number;
  monteCarloSe: number;
  signal: 'consistent' | 'unclear' | 'negative';
  correlatedPeers: AssociationPeer[];
}

export interface PfiPayload {
  modelId: string;
  metricId: string;
  metricName: string;
  metricDirection: 'higher_is_better' | 'lower_is_better';
  baselineMean: number;
  dummyBaselineMean: number;
  modelBeatsDummy: boolean;
  evaluatedOn: 'outer_test_folds' | 'single_holdout';
  nFolds: number;
  nRepeatsRequested: number;
  nRepeatsUsed: number;
  seed: number;
  rows: PfiRow[];
}

export interface WeightRow {
  rawFeature: string;
  levelLabel: string | null;   // category level, null for numeric
  isLevel: boolean;
  weight: number;              // display scale, see chart 3
  foldValues: number[];
  signConsistency: number;     // share of folds with the same sign as the mean, in [0, 1]
  oddsRatio?: number;          // logistic regression only
}

export interface WeightsPayload {
  modelId: string;
  family: 'logistic' | 'linear_svc' | 'bernoulli_nb' | 'multinomial_nb';
  unitLabel: string;           // e.g. "change in log-odds, low to high value"
  classes: string[];
  comparison: 'vs_rest' | 'pairwise';   // NB and one-vs-one SVC may be pairwise
  byClass: Record<string, WeightRow[]>; // key = target class (or "A|B" when pairwise)
}

export interface MdiVsPfiRow {
  feature: string;
  meta: FeatureMeta;
  mdiShare: number;            // in [0, 1]
  pfiShare: number | null;     // max(0, mean) / sum of positive means; null if undefined
  pfiMeanImportance: number;   // raw, may be negative
  pfiFoldValues: number[];
  gap: number | null;          // mdiShare - pfiShare
  flagged: boolean;            // gap >= MDI_PFI_GAP_FLAG
  correlatedPeers: AssociationPeer[];
}

export interface GaussianCurve {
  classLabel: string;
  mean: number;                // original units
  sd: number;                  // original units, after smoothing
  meanSdAcrossFolds: number;
  prior: number;
  histogram: { binEdges: number[]; density: number[] }; // training rows of this class
}

export interface GaussianPanel {
  feature: string;
  isBinaryColumn: boolean;     // render proportion bars instead of curves
  separation: number;          // prior-weighted Fisher ratio
  separationBand: 'high' | 'medium' | 'low'; // terciles within this model
  domain: [number, number];
  curves: GaussianCurve[];
}

export interface EffectPoint {
  x: number | string;
  mean: number;                // PDP mean output, or centred ALE value
  foldLow: number;             // min across outer-fold models
  foldHigh: number;            // max across outer-fold models
  sampleCount: number;
  sparse: boolean;             // sampleCount < MIN_ROWS_PER_REGION
}

export interface EffectPlotPayload {
  modelId: string;
  method: 'pdp_ice' | 'ale';
  feature: string;
  meta: FeatureMeta;
  targetClass: string;
  outputKind: 'probability' | 'decision_score';
  referenceOutput: number;     // mean held-out output (reference line)
  points: EffectPoint[];
  ice?: Array<{ rowId: string; y: number[] }>; // aligned to points; max ICE_MAX_ROWS
  recommendedMethod: 'pdp_ice' | 'ale';
  recommendationReason?: string;
}

export interface ComparisonCell {
  meanImportance: number;
  sdAcrossFolds: number | null;
  positiveFolds: number;
  share: number | null;        // max(0, mean) / sum of positive means within model
  rank: number | null;         // 1-based within model, ties share a rank
  correlatedFlag: boolean;
}

export interface ComparisonPayload {
  metricId: string;
  metricName: string;
  models: Array<{ modelId: string; label: string; eligible: boolean; ineligibleReason?: string;
                  headlineScoreMean: number }>;
  features: string[];          // default order: mean share across eligible models, descending
  cells: ComparisonCell[][];   // cells[featureIndex][modelIndex]
}

export type LocalExplainPayload =
  | { kind: 'additive'; rowId: string; foldIndex: number; selectedClass: string;
      outputKind: 'log_odds' | 'decision_score' | 'probability';
      baseline: number;            // mean model output over background rows
      contributions: Array<{ rawFeature: string; valueLabel: string; contribution: number }>;
      otherCount: number; otherContribution: number;
      finalOutput: number; finalProbability?: number;
      method: 'exact' | 'shapley_enumerated' | 'shapley_sampled';
      approxStdError?: number; }
  | { kind: 'rule_path'; rowId: string; foldIndex: number;
      steps: Array<{ text: string; rowValueLabel: string; satisfied: boolean; nSamples: number;
                     classShares: Record<string, number> }>;
      leaf: { predictedClass: string; classShares: Record<string, number> } }
  | { kind: 'neighbors'; rowId: string; foldIndex: number; k: number; weighting: 'uniform' | 'distance';
      votes: Record<string, number>;
      neighbors: Array<{ trainRowId: string; trueLabel: string; distance: number;
                         closestFeatures: string[]; farthestFeatures: string[];
                         featureShareOfDistance: Record<string, number> }> };
```

## 6. Chart specifications

### Chart 1: `PFI_DOTS` (all 8 models, Tier 1 default)

- **Type.** Horizontal dot-and-interval plot, one row per raw feature, with a bold vertical zero line.
- **Marks per row.**
  - Small translucent dots: one per outer fold (`foldValues`), vertically jittered.
  - Solid marker: `meanImportance`.
  - Thin whisker: mean plus or minus `sdAcrossFolds`, captioned "variation across folds".
  - Do not draw bars from zero.
- **Y axis.** Raw feature names, sorted descending by `meanImportance`. Add a clickable warning icon when `correlatedPeers` is non-empty.
- **X axis.** Title: "Drop in [metricName] when this feature is shuffled". The domain spans the min and max of all fold values and the zero line, padded 10%.
- **Style.** Positive means: slate. Negative means: grey with hatch, with a direct label "no reliable effect". Rows with `signal = 'consistent'` get a small tag "hurt in K of K folds"; others show "hurt in n of K folds".
- **Controls.** `Top 15 / All`. "Show relative share (%)" optional: shares use `max(0, mean) / sum of positive means`, and negative rows stay visible, greyed, unscaled.
- **Tooltip and text alternative.**
  - Feature name and type.
  - "Shuffling [feature] changed [metricName] from [baseline] to [baseline minus mean] on average. Hurt in n of K folds." (use the loss wording for loss metrics).
  - If `signal = 'negative'`: "On average shuffling this feature did not hurt. Small negative values are usually random noise, so this feature has no reliable effect on this model."
  - If `signal = 'unclear'` and the mean is positive: "Shuffling hurt on average but not in every fold, so treat the size as uncertain."
  - If correlated: "This feature moves together with [peer] (strength 0.xx). Importance may be shared between them, and shuffling one breaks a pattern that really occurs in the data."
- **Banners and edge cases.**
  - `modelBeatsDummy = false`: banner from I7.
  - `evaluatedOn = 'single_holdout'`: no fold dots; show the whisker as "shuffle noise only" and the note "Estimated from 1 split, so it ignores training variability."
  - `nRepeatsUsed < nRepeatsRequested`: "Estimated with fewer shuffles."

### Chart 2a: `COMPARISON_DOTS` (Comparison page, default)

- **Type.** Multi-model dot plot with a shared x axis. One row per raw feature, one dot per eligible model at its `meanImportance`, with whiskers for fold SD. Use fixed per-model colour and marker shape. Draw a light connecting line across models in a row.
- **X axis.** Same metric units for every model. Add a toggle "Show as share of each model's total (%)" (uses `share`).
- **Rows.** Top `TOP_N`, sorted by mean share across eligible models. Sort control: "Average importance", "Biggest disagreement" (range of ranks, max minus min), alphabetical. Rows with `correlatedFlag` get the warning icon, because rank disagreement can be an artefact of shared credit.
- **Ineligible models.** Show in the legend as "not compared: barely beats guessing". Never plot their dots.
- **Disagreement hint.** If two eligible models' headline scores differ by less than `ROPE`, and a feature's rank range is at least 3, show on hover: "These models score about the same but rely on different features."
- **Tooltip.** "[Feature] in [Model]: rank #r of N, drop 0.xx (variation across folds 0.xx), hurt in n of K folds."

### Chart 2b: `COMPARISON_HEATMAP` (Comparison page, secondary tab "Rank view")

- **Type.** Matrix, features by models, sequential single-hue fill.
- **Fill.** Default "Share of the model's total importance", with a colour scale shared across models. Alternative toggle "Raw drop". Do NOT normalise by each model's maximum. Cells with `meanImportance <= 0` use grey hatch. Ineligible model columns are greyed and unfilled.
- **Cell text.** Always print rank and value in the cell (for example `#2 · 8%`). Cells MUST NOT rely on colour alone.
- **Axes.** Rows: raw features, top `TOP_N`. Columns: models, sortable by headline score. Same row sort options as 2a.
- **Tooltip.** As in 2a.

### Chart 3: `SIGNED_WEIGHTS` (Logistic Regression, linear SVC, Bernoulli NB, Multinomial NB)

- **Type.** Diverging horizontal dot-and-bar chart anchored at 0, rows grouped under their parent raw feature. Fold dots show stability.
- **Display scale (all families).**
  - Convert coefficients back to original units using the fold's training means and SDs.
  - Numeric feature: weight for a change from low to high (minus 1 SD to plus 1 SD), that is `beta x 2 x SD`. Label: "low to high value".
  - Binary or one-hot level: weight for "present" versus "absent", unscaled.
  - Categorical levels: centre within the raw feature (`beta_level - mean_levels(beta)`, with a dropped reference level counted as 0). Label: "compared with the average [feature] category".
  - Multinomial NB non-binary features: per-unit weight times `2 x SD` of the feature; binary features: per unit.
- **Family details.**
  - **Logistic Regression.** Binary: weights on the log-odds scale. Softmax multi-class: centre per-class weights across classes before display. One-vs-rest: no centring. Odds ratio is `exp(weight)`.
  - **Linear SVC.** Primal weights in decision-score units (not probabilities, not odds). If the kernel is non-linear, hide the chart and show: "This kind of model has no single weight per feature. See the effect and local views." If the implementation is one-vs-one, set `comparison = 'pairwise'` and show a pair selector.
  - **Bernoulli NB.** Binary: `w_j = log[p1j (1 - p0j) / (p0j (1 - p1j))]`, which is the evidence that feature present versus absent adds for class 1 over class 0. Multi-class: pairwise `w_{c,k,j} = log[p_cj (1 - p_kj) / (p_kj (1 - p_cj))]`; the default view for class c is the average over `k != c`, labelled "vs the other classes (average)". Offer a pair selector.
  - **Multinomial NB.** `w_{c,k,j} = log theta_cj - log theta_kj` per unit of feature j. The default view for class c is the average over `k != c`, with the same pair selector.
- **Axes.** Y: levels or features, sorted by absolute weight within the filter. X: symmetric domain around 0. Left label "Pushes away from [class]" (binary: "Favours [other class]"), right label "Pushes toward [class]".
- **Controls.**
  - Target class selector (classes > 2).
  - Filter "Top 10 positive + top 10 negative" or "Top 15 by size".
  - Logistic only: toggle "Show as odds multipliers" (log axis centred on 1). The default stays the weight scale.
- **Tooltip.**
  - Logistic: "Going from a low to a high [feature], with other features held fixed, multiplies the odds of [class] by [OR]. Odds are not the same as probability." For levels: "Compared with the average [feature], being [level] multiplies the odds of [class] by [OR]."
  - Linear SVC: "Higher [feature] moves the decision score toward [class] by [w]."
  - NB: "Seeing [feature] at a higher value makes [class] more likely than [other class(es)], assuming the other features are independent."
  - All: "Seen in the same direction in n of K folds." Add a banner when `signConsistency < 1` for many rows.
- **Warnings.** Show one of: "Weights shared between features that move together are unstable" (when a feature has `correlatedPeers`), and for NB "Naive Bayes counts overlapping evidence twice".
- **Do not** present weights as causal effects, and do not rank features by weights across different scale types without the scale label.

### Chart 4: `MDI_VS_PFI` (Decision Tree)

- **Type.** Horizontal paired dumbbell: hollow circle = share of impurity decrease while building the tree (training data); solid circle = share of held-out importance (PFI). A thin connector joins the two. Raw feature rows only.
- **Axes.** X: share of each method's total, 0 to 100%. Y: raw features, default sort by `pfiShare` (nulls last).
- **Shares.** `mdiShare` from I9. `pfiShare = max(0, mean) / sum of positive means`; if that sum is 0, set null and show the empty-state "No feature reliably matters on held-out data". Raw PFI (including negatives) is always shown in the tooltip, and never clamped in stored data.
- **Flag.** Highlight the connector when `gap >= MDI_PFI_GAP_FLAG`.
- **Tooltip.**
  - "Used in building the tree: x%. Held-out importance: y% (raw drop 0.xxx, hurt in n of K folds)."
  - Feature type and, for categorical, number of levels.
  - If flagged: "The tree split on [feature] a lot while it was being built, but shuffling it barely changed held-out performance. This often happens for features with many possible split points (numbers or many-category columns), or when the tree has memorised noise."
  - If correlated: shared-credit warning.
- **Controls.** Sort: "Held-out importance", "Used in building", "Largest gap".

### Chart 5: `GAUSSIAN_DIST` (Gaussian NB)

- **Type.** Responsive grid of small multiples (2 to 3 columns), one per numeric raw feature, ordered by `separation`.
- **Per panel.**
  - Fitted per-class normal curve (translucent area plus stroke) over a faint per-class histogram of the data the model was fitted on. Use the global class palette. Optional dashed marker at each class mean.
  - Header: feature name plus `separationBand` ("Separation: high / medium / low", relative to other features in this model). Do not use fixed numeric thresholds.
  - If the histogram departs strongly from the curve (for example skew), show the note "The data here is not bell-shaped, so this model's assumption is a poor fit."
- **Axes.** X: feature in original units over `domain` (union of class mean plus or minus 3 SD and the 1st to 99th percentile of the data). Y: titled "How typical (higher = more common)", with tick labels hidden; y scale is shared by all classes within a panel and free across panels. Use 100 evenly spaced points.
- **Separation.** Prior-weighted Fisher ratio `sum_c pi_c (mu_c - mu)^2 / sum_c pi_c sigma_c^2`, with variances after smoothing.
- **Smoothing.** Add the same epsilon the model used: `var_smoothing x max over features of variance`. Never evaluate a density with zero variance, and never output `NaN` or `Infinity`.
- **Binary or one-hot columns.** Do not draw curves. Draw per-class proportion bars and the note "This model treats a yes/no column as a number."
- **Controls.** Class legend filter (isolate or dim); "Weight curves by class share" toggle (prior times density; helps show where evidence for one class overtakes another); "Show top 6 / all".
- **Tooltip.** Hovered x value, then per class: "[Class]: average 45.2, spread 6.1 (density 0.059)". Add fold stability: "average varied by 1.1 across folds."
- **Badge.** "Final model structure (not the cross-validated estimate)."

### Chart 6: `EFFECT_PLOT` (all 8 models, Tier 2, Phase 2)

- **Entry.** Opens from clicking a feature in `PFI_DOTS`, or a feature selector ordered by PFI rank.
- **Output.** `predict_proba` for the selected class where the model's probabilities are consistent with its predictions. For SVC use the decision score and label the axis "Model score (distance from boundary)". `outputKind` records which.
- **Method choice.**
  - Default `recommendedMethod = 'ale'` for numeric features that have `correlatedPeers`; otherwise `'pdp_ice'`.
  - The user may switch freely for numeric features.
  - Categorical features: PDP-style "average output with every row set to this level" only; no ALE.
  - If `ale` is not the current method while `recommendedMethod = 'ale'`, show: "Because [peer] moves with [feature], this chart may be evaluating combinations that never occur. Try the ALE view."
- **Computation.**
  - Each held-out row is scored by its own fold's model (I2). Per-fold curves are computed on that fold's held-out rows, and the plot shows the pooled mean with a band between the lowest and highest fold curve, captioned "differs between fold models".
  - PDP grid: `PDP_GRID_POINTS` points between the 1st and 99th percentile of the held-out feature values.
  - ICE: up to `ICE_MAX_ROWS` rows, stratified by true class, opacity `ICE_ALPHA`.
  - ALE: `ALE_BINS` quantile bins, merging any bin with fewer than `MIN_ROWS_PER_REGION` rows; centre so the data-weighted mean is 0.
- **Marks.** Numeric: line plus band; faint ICE lines (PDP only); rug or mini histogram of `sampleCount`. Categorical: point plus fold-range whisker per level, with counts under labels.
- **Axes.**
  - PDP: Y "Predicted probability of [class]" with a dashed `referenceOutput` line.
  - ALE: Y "Effect on predicted probability of [class], compared with the average prediction", with a dashed zero line.
  - X: feature values or levels.
- **Guardrail.** Dim or hatch regions where `sparse = true`, and do not extend the PDP grid beyond the central range.
- **Notes.** Averages can hide opposite effects in different rows; the ICE toggle exists to show this. Step-like curves for trees and KNN are expected and are explained in a tooltip.
- **Controls.** Feature selector, target class selector, method toggle, "Show individual rows (ICE)" (PDP only).

### Chart 7: `LOCAL_EXPLAIN` (all 8 models; row drawer from the predictions table or confusion drill-down)

Always show the true label, the predicted label, and the predicted probability or score at the top. Always use the model of the row's own fold, and say so ("Explained by the model that never saw this row").

**7a. Additive waterfall (Logistic Regression, linear SVC, Bernoulli NB, Multinomial NB, Gaussian NB; Phase 1)**

- Output scale is the model's natural additive scale: log-odds (LR, NB) or decision score (linear SVC), shown with the final probability beside it when available. Multi-class: the selected class's score minus the average score of the other classes.
- Baseline = mean model output over the fold's training rows (the background). Contribution of feature j = `w_j x (x_j - mean(x_j))` for linear models; for NB, the feature's log-likelihood-ratio term minus its mean over the background. This is exact and equals Shapley values for these models.
- Sum encoded columns into their raw feature before display.
- Show top `WATERFALL_TOP` features by absolute contribution plus one bar "Other N features". Order bars by size, signed, using the colour contract. Baseline and end bars labelled "Average case" and "This row".
- Test: `baseline + sum(all contributions)` equals the model's own output within 1e-9.

**7b. Approximate Shapley waterfall (MLP, non-linear SVC; Phase 2)**

- Players are raw features (not encoded columns). Background: up to `SHAPLEY_BACKGROUND` training rows of the row's fold model, features replaced jointly by a background row.
- If the number of raw features is at most `ENUM_MAX_FEATURES`, enumerate all coalitions exactly (`method = 'shapley_enumerated'`). Otherwise use a sampling estimator with a fixed seed, a convergence check, and a reported `approxStdError` (`method = 'shapley_sampled'`).
- Badge: "Approximate. Explains this model's behaviour, not cause and effect." Show the residual, `finalOutput - (baseline + sum)`, if non-zero.
- Because the background breaks correlations, add the note "Some combinations tried here may not occur in real data" when the row's top features have `correlatedPeers`.

**7c. Rule-path stepper (Decision Tree)**

- Vertical cards from root to leaf. Each card: the plain-language condition, the row's value with a tick or cross, sample count, and a class-share bar that updates down the path.
- Translate encoded splits: a split on a one-hot column reads "[feature] is [level]" or "[feature] is not [level]". Convert thresholds on scaled columns back to original units.

**7d. Neighbour table (KNN)**

- Show k, the weighting rule, and the vote tally.
- List the k neighbours (from the fold model's training rows) by distance: true label, total distance in the model's preprocessed space, and mini bars for each raw feature's share of that distance. Highlight up to 3 closest and 3 most different features, summing encoded columns per raw feature.

## 7. Named constants

| Constant                                              | Default                      | Note                            |
| ----------------------------------------------------- | ---------------------------- | ------------------------------- |
| `TOP_N`                                               | 15                           | Ranked chart truncation         |
| `ASSOC_WARN`                                          | 0.7                          | Heuristic; tune in pilot        |
| `REPEATS_DEFAULT` / `REPEATS_MIN` / `REPEATS_PRECISE` | 5 / 3 / 20                   | Per fold; browser budget        |
| `MDI_PFI_GAP_FLAG`                                    | 0.15                         | Share gap, heuristic            |
| `MIN_ROWS_PER_REGION`                                 | 5                            | Sparse-region guard             |
| `PDP_GRID_POINTS`                                     | 20                           | Within 1st to 99th percentile   |
| `ICE_MAX_ROWS` / `ICE_ALPHA`                          | 50 / 0.12                    |                                 |
| `ALE_BINS`                                            | 10                           | Quantile bins before merging    |
| `SHAPLEY_BACKGROUND`                                  | 50                           | Up to 100 allowed               |
| `ENUM_MAX_FEATURES`                                   | 10                           | Exact Shapley enumeration limit |
| `WATERFALL_TOP`                                       | 8                            |                                 |
| `ROPE`                                                | the project's existing value | "Scores about the same"         |

## 8. Phasing

- **Phase 1:** permutation engine (I1 to I8, I11); `PFI_DOTS`; `COMPARISON_DOTS`; `SIGNED_WEIGHTS`; `MDI_VS_PFI`; `GAUSSIAN_DIST`; `LOCAL_EXPLAIN` 7a, 7c, 7d; the note from rule 1; association metadata.
- **Phase 2:** `EFFECT_PLOT`; `LOCAL_EXPLAIN` 7b; `COMPARISON_HEATMAP`; grouped-permutation toggle (units built by hierarchical clustering on `1 - |Spearman|`, Ward linkage, cut at `1 - ASSOC_WARN`; payloads gain `PermutationUnit.rawFeatures.length > 1` and rows are labelled "Group: A + B").
- **Phase 3 (deferred, separate specs):** 2D decision-boundary explorer, counterfactual explanations, feature-sliced error analysis.

## 9. Acceptance tests (automated)

1. Permuting a raw categorical column and then encoding yields exactly one active dummy per row, and the multiset of values equals the original.
2. Same seed gives identical results. Two models in one comparison receive identical permutation indices for the same (fold, unit, repeat).
3. No scored row is in its scoring model's training set.
4. Orientation: for both a higher-is-better metric and log loss, shuffling an informative feature gives a positive importance, and a constant-noise feature averages near 0 with negative values preserved in payloads.
5. Stored payloads contain no `ci95` fields and no clamped negatives. Shares are the only clamped values.
6. `SIGNED_WEIGHTS`: multi-class centred softmax weights sum to 0 across classes for each feature; binary Bernoulli NB `intercept + sum(x_j w_j)` reproduces the model's log-odds; categorical levels centre to mean 0 within each raw feature.
7. `LOCAL_EXPLAIN` 7a additivity within 1e-9; 7b residual reported; contributions are summed to raw features.
8. `GAUSSIAN_DIST`: a zero-variance feature produces finite curves using `epsilon`.
9. `EFFECT_PLOT`: ALE bin counts sum to the number of rows used; ALE is centred; PDP grid lies within the 1st to 99th percentile; sparse points are flagged.
10. `MDI_VS_PFI`: per-feature MDI shares sum to 1 across raw features; when all PFI means are at most 0, `pfiShare` is null for every row and the empty state shows.
11. Skill gate: a model that does not beat the dummy baseline sets `modelBeatsDummy = false`, shows the banner, and is excluded from comparison fills.
12. Accessibility: every chart has a data table, a text alternative and a keyboard path to every tooltip.

## 10. Pilot questions to settle with learners (do not block implementation)

- Do learners read fold dots better than a mean-with-whisker marker?
- Does the "low to high" weight scale and its tooltip read more clearly than odds multipliers?
- Is `COMPARISON_DOTS` read more accurately than `COMPARISON_HEATMAP`?
- Are `ASSOC_WARN`, `MDI_PFI_GAP_FLAG` and `REPEATS_DEFAULT` reasonable?
