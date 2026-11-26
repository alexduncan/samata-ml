# Feature importance on Compare Results

**Status:** draft | **Updated:** 2026-11-26T19:22:59Z
**Authors:** Claude Code (claude-opus-5-5) | **Created:** 2026-11-26T13:24:47Z
**Verified by:** — | **Verified:** — | **Verification:** changes-requested
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour:** Compare Results (`/results`, `src/features/results/app-results-view.ts`) shows six sections: the metrics table, the fold strip, class error bars, confusion differences, practical equivalence and instance agreement (L665-820). No surface shows which inputs a model relies on. `StoredEvaluation` (`src/types/model-evaluation.ts` L113-134) is `schemaVersion: 1` and holds no feature-level data. `decodeStoredEvaluation` (`src/features/results/evaluation-decoder.ts` L454-457) rejects every other version. The training worker (`src/features/models/training/training-worker.ts` L76, L95) disposes each fitted model without inspecting it.

**Target behaviour:** During training, the worker measures **shuffle importance on held-out rows** for every cross-validation fold or the One-Shot holdout. Each fold model scores only its own held-out rows. The worker shuffles each raw column (all of its encoded columns together) and records how much **balanced accuracy** drops. The same shuffles are used for the same column, fold and repeat in every model. Below instance agreement, Compare Results adds a **Feature importance** section with:

- a **multi-model dot plot** (`COMPARISON_DOTS`), with one row per raw column and one dot per eligible model on a shared axis. Whiskers show variation across folds, and each model keeps its own colour and marker;
- a sort control (average importance, biggest disagreement, alphabetical), a "Show as share of each model's total (%)" toggle and "Show all N features";
- a skill gate: models that do not beat the most-frequent-class baseline are listed as "not compared: barely beats guessing" and plotted nowhere;
- a visible note on columns where models that score about the same rank them differently;
- the "Computed on held-out data" label and the collapsible "What this does and does not tell you" note;
- a data table that holds every value the chart shows.

**Why:** VISION §9 asks learners to contrast inspectable models with an opaque network. Shuffle importance is the one measure that applies to all eight classifiers in the same units. The requirements note (`specification/notes/feature-importance-requirements.md`) makes `COMPARISON_DOTS` the default comparison view.

## Scope

**In scope**

- v2 requirements for the comparison surface:
  - rules 1–10, as they apply to one comparison chart;
  - invariants I1–I7 and I11 (training-time computation);
  - Chart 2a `COMPARISON_DOTS`;
  - the §7 constants this plan uses (`TOP_N`, `REPEATS_DEFAULT`, `REPEATS_MIN`, `ROPE`).
- `StoredEvaluation` `schemaVersion: 2` with an optional `featureImportance` block. The decoder accepts versions 1 and 2 and drops an invalid block without rejecting the evaluation.
- A worker-side importance collector, passed as `onModel` to `holdoutValidate` and `crossValidate`, and two Step 5 log notes.
- One presentational element, `app-importance-comparison`, with its view-model, stories and three-browser tests. It is wired into `app-results-view`, and three new persisted `ComparisonUi` fields hold the sort, share and show-all choices.
- A draft "Feature importance" section in `specification/mockups/04_compare-results.html` (status `draft`).
- Specification sync and the backlog entries listed under _Specification changes_.

**Out of scope**

- **Model-specific surfaces** go to Phase 6 (user decision 2026-11-26): `PFI_DOTS` in Section 6, `SIGNED_WEIGHTS`, `MDI_VS_PFI` (I9), `GAUSSIAN_DIST`, `LOCAL_EXPLAIN` 7a/7c/7d and the shared `selectedClass` (I10). Phase 6 reuses this plan's stored `featureImportance` block.
- **Deferred to the backlog** (`specification/FUTURE.md`):
  - correlation warnings (I8): needs `web-ml` association measures; request filed 2026-11-26 (user decision);
  - the log-loss alternative (I4), which needs a `web-ml` log-loss scorer (user decision);
  - lazy computation and the "More precise" option (I11): fold models and preprocessors are discarded after training (user decision);
  - `COMPARISON_HEATMAP`, the grouped-permutation toggle (v2 Phase 2) and v2 Phase 3.
- Recomputing importance for results saved before this plan, and regression.
- Any `web-ml` computation. `samata-ml` never shuffles, predicts or scores (Repository boundary).

**Constraints and invariants**

- **Order:** implement after `virtual-table-improvements` and after `chart-best-practices` (both `ready`), and before Phase 6 (user decisions 2026-11-26). Implementation also waits for the upstream gate (Risks: Blocking).
- **I1 Held-out only:** importance is measured with the fold model (`kind: 'fold'`) on that fold's `validationFeatures`, or with the One-Shot model (`kind: 'holdout'`) on its `validationFeatures`. The refit is ignored. Each call asserts that `trainingIndices` and `validationIndices` are disjoint; if they are not, the block becomes unavailable.
- **I3 Raw columns:** every unit is one raw column, which covers all `featureNamesOut` entries whose `JSON.parse(name)[0]` is that column (`tabular-preprocessing.md` L86-89). Encoded columns are never shuffled independently.
- **I4 Metric and orientation:** balanced accuracy is used for every model. Importance is `baseline − permuted`, so positive means worse after shuffling. Negatives are never clamped in stored data; only `share` clamps.
- **I6 Determinism and pairing:**
  - fold `k` uses `randomState = (IMPORTANCE_SEED ^ Math.imul(k + 1, 0x85ebca6b)) >>> 0`;
  - each unit's key is the 32-bit FNV-1a hash of its raw column name;
  - with `web-ml`'s keyed group streams (request Q6), the same column, fold and repeat get the same shuffle in every model.

  Comparison groups already guarantee identical folds (`partitionFingerprint`).
- **Hook safety:**
  - `onModel` is awaited, and a thrown error fails the run (`metrics.md` L97-137), so the collector catches everything;
  - it awaits `permutationImportance` before the hook settles (tensors are valid only until then);
  - it copies outputs into new `Float64Array`s and never disposes the model or the tensors;
  - it passes the worker's abort `signal`.
- **No partial blocks:** any failed fold makes the run's block `null`, logs one note and still lets training succeed.
- **Display arithmetic only:** `samata-ml` computes only the I5 summaries, shares, ranks, the skill-gate comparison of two stored scores and the axis domain (D5).
- **Presentation rules:**
  - **Plain language:** say "shuffle" in default text, never "permutation" (rule 5).
  - **Spread wording:** label spread "variation across folds", never "confidence interval" (rule 3).
  - **No hover-only information:** there are no tooltips; the data table is the keyboard path (rule 10).
- **Phase 4/5 conventions** (`specification/components/results-comparison.md` §3):
  - Plot only through `PlotController`;
  - a figure, a caption and a data-table `<details>`;
  - `labels` objects with empty-string defaults, and the view owns every string;
  - `specification/charts.md` model identity (from `chart-best-practices`);
  - tokens only; WCAG 2.2 AA and i18n.
- **Named constants** live in `src/config/feature-importance.ts` and are never inlined in components:
  - `TOP_N = 15`;
  - `REPEATS_DEFAULT = 5`;
  - `REPEATS_MIN = 3`;
  - `IMPORTANCE_SEED = 0`;
  - `IMPORTANCE_BUDGET_MS = 60_000` (a design choice);
  - `DISAGREEMENT_RANK_RANGE = 3`.

## Required reading

- `specification/notes/feature-importance-requirements.md` §2 (rules 1–10), §3 I1–I7 and I11, §5 `PfiRow`/`ComparisonCell`/`ComparisonPayload`, §6 Chart 1 (single-holdout and fewer-shuffles edge cases), §6 Chart 2a and §9 tests 2–5 and 11–12. This plan's deviations are listed in D9.
- `specification/COMPONENTS.md` §3–§10 and `specification/components/results-comparison.md` §3–§9 (every Lit task).
- `specification/charts.md` (created by `chart-best-practices`): model identity colours, symbols and chart accessibility rules.
- `specification/workflow-steps.md` §4 and `specification/machine-learning-orchestrator.md` §2.
- `web-ml` public contract (pin the post-gate release at re-scout):
  - `node_modules/web-ml/dist/src/inspection/permutation-importance.d.ts` L6-81 and `node_modules/web-ml/specification/public-api/model-inspection.md` L227-254;
  - `node_modules/web-ml/dist/src/training/fitted-model-hook.d.ts` L6-38 and `node_modules/web-ml/specification/public-api/metrics.md` L97-137;
  - `node_modules/web-ml/specification/public-api/tabular-preprocessing.md` L80-90.

## Codebase context

- **Relevant specifications:**
  - `specification/workflow-steps.md` §4 (L234-242);
  - `specification/components/results-comparison.md`;
  - `specification/machine-learning-orchestrator.md` §2;
  - `specification/VISION.md` §9;
  - `specification/plans/chart-best-practices.md`, D "Model identity colour exception" and D "WCAG safeguards" (`ModelColor`→symbol mapping in `src/features/results/charts/chart-encoding.ts`, and `ComparisonModel.modelColor`).
- **Persisted contract:**
  - `src/types/model-evaluation.ts`: `StoredReport.balancedAccuracy` (L26), `partitions[i].test` (L51), `partitions[i].baselines.mostFrequent` (L54), `pooled` (L129-130) and `StoredEvaluation` (L113-134). Fold means are computed at render time (`comparison-model.ts` L127-130 `foldSummary`).
  - `src/features/models/training/evaluation-mapper.ts` L223-226 `mapEvaluation`, with the literal record at L279-295. It is called from `classifier-adapters.ts` L211 (holdout) and L260 (CV).
  - `src/features/results/evaluation-decoder.ts`:
    - helpers at L44-208;
    - `fail()`/`Invalid` at L38-42;
    - the version check at L457;
    - the optional-block pattern at L342, L372 and L402;
    - the result object at L482-492.
  - `src/types/model-result.ts` L27-41 `TrainingLogMessage`; `isTrainingLogMessage` is in `src/features/models/training/protocol.ts` L153-154.
- **Training worker:**
  - `classifier-adapters.ts`:
    - `buildClassificationRequest(classifier, prepared, setup)` at L97-139;
    - the identity-mapped provider over retained rows at L105-108;
    - One-Shot `returnFit` at L118-127; CV `refit: true` at L129-138.
  - `training-worker.ts` `execute` (L41-109) receives `send` (L46) and the abort signal (L45, controller at L143).
  - `prepare-classification.ts` L100-115: `prepared.classLabels[prepared.targetCodes[i]]` is provider row `i`'s label. Row `r` of `validationFeatures` is `validationIndices[r]` (`fitted-model-hook.d.ts` L11, L19-26).
- **Compare view:**
  - `app-results-view.ts`:
    - messages via `i18n('app-results-view', …)` at L65-171;
    - `whenSettled` list at L304;
    - `buildViews` at L380-507;
    - sections at L665-820;
    - the instance agreement section ends at L818.
  - `ComparisonUi` (`src/types/state.ts` L356-364) and its defaults (L367-375); sanitiser `src/stores/comparison-preferences.ts` L58-112; setter `setComparisonUi` (`src/stores/app.store.ts` L163-182).
  - `ComparisonModel` (`comparison-model.ts` L12-16) has no `featureNamesOut`, so the block carries its own column names. After `chart-best-practices` it carries `modelColor`.
  - `PlotController` (`charts/plot-controller.ts` L24-34) exposes `dot`, `ruleX`, `ruleY`, `rectY`, `text` and `plot`, and filters no options.
- **Step 5 log:** `app-training-progress` (`src/features/models/app-training-progress.ts` L16-47) and `formatTrainingLogEntry` (`app-model-builder-view.ts` L1972).
- **Tests:**
  - `tests/evaluation-decoder.test.ts`, `tests/evaluation-mapper.test.ts`, `tests/classifier-adapters.test.ts` and `tests/training-protocol.test.ts`;
  - `tests/training-runtime.e2e.ts` with `tests/fixtures/training/runtime.worker.ts` (real `web-ml`);
  - `tests/comparison.e2e.ts`, `tests/comparison-charts.e2e.ts`, `tests/a11y.e2e.ts` L29-31 and `tests/state-and-storage.test.ts`;
  - fixtures `tests/fixtures/results/evaluations.ts` (`irisCrossValidation` L200, `breastCancerOneShot` L363), `tests/fixtures/results/comparison.ts` L5 and `tests/helpers/seed-results.ts` (`seedComparablePair` L222, `downgradeEnvelope` L310).
- **Tokens:** `css/root.css` has `--chart-neutral` (stone-600), `--chart-axis`, `--chart-grid`, `--stone-50…150` and `--neutral-*`. It has no slate, grey or Okabe-Ito tokens; D9 maps the note's colour contract onto these.
- **Web guidance:** None. Native `<details>`, `<select>`, `<input type="checkbox">`, `<button>` and `<table>` follow existing `/results` precedent.
- **Visual reference:** draft only (`04_compare-results.html`); no parity entries.
- **Domain skills:** `lit-component-implementer` for T4 and T5.
- **Upstream evidence:** `codebase-scout` read `web-ml` 0.2.0 (installed, and the unreleased checkout at the same version) on 2026-11-26:
  - scorers are `'accuracy' | 'f1' | 'r2' | 'mean-squared-error'`, with binary-only F1 (`permutation-importance.d.ts` L6, L58-67);
  - there are no feature groups;
  - each column's shuffle stream is seeded from `randomState` and the column position (`model-inspection.md` L243-248);
  - the hook exposes no fitted preprocessor (`fitted-model-hook.d.ts` L6-13).
- **Assumptions requiring verification:** at re-scout, confirm:
  - the shipped scorer name for balanced accuracy;
  - the groups and keys option names, or the raw-column alternative;
  - that holdout `preprocessing.validationFeatures` is present (implied by `metrics.md` L103-105).

## Technical decisions

| Decision                                       | Chosen approach and rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Rejected alternative / trade-off                                                                                  |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| D1 Measure                                     | `web-ml` `permutationImportance`, balanced-accuracy scorer, `nRepeats: REPEATS_DEFAULT`, the I6 seed and keys, on held-out rows only. Balanced accuracy is the `/results` headline (I4; user decision 2026-11-26).                                                                                                                                                                                                                                                                                                                                                                                                                                 | Accuracy now (rejected 2026-11-26); log loss (deferred).                                                          |
| D2 Units                                       | One unit per raw column, ordered by first appearance in `featureNamesOut`, with column indices ascending. The collector passes the units as `web-ml` groups with FNV-1a keys, or passes raw columns if `web-ml` ships that form instead.                                                                                                                                                                                                                                                                                                                                                                                                           | Shuffling encoded columns (forbidden by I3).                                                                      |
| D3 Collector                                   | `src/features/models/training/importance-collector.ts` `createImportanceCollector(deps)` returns `{ hook, finish }`. `buildClassificationRequest` gains an optional `onModel`, which `execute` passes on both protocols. `finish()` goes into the snapshot for `mapEvaluation`. `permutationImportance` and a clock are injected so tests can fake them.                                                                                                                                                                                                                                                                                           | Hydrating stored `modelJson` later (fold models are not kept; lazy compute deferred by the user).                 |
| D4 Budget (I11)                                | The first cross-validation fold runs `REPEATS_DEFAULT`. If its measured time × the remaining folds exceeds `IMPORTANCE_BUDGET_MS`, the remaining folds use `REPEATS_MIN`. Each partition stores its own `nRepeats`. One-Shot always uses `REPEATS_DEFAULT`.                                                                                                                                                                                                                                                                                                                                                                                        | A fixed repeat count (unbounded KNN cost); per-row subsampling (changes the estimate silently).                   |
| D5 Summaries (I5)                              | Pure functions in `src/features/results/importance-comparison-view-model.ts`. Per model and column, with `delta[k][r]` the stored drops: `v[k] = mean_r delta[k][r]`; `meanImportance = mean_k v[k]`; `sdAcrossFolds` = sample SD of `v` (null if K < 2); `positiveFolds = count(v[k] > 0)`; `monteCarloSe = mean_k (sd_r(delta[k][r]) / √R_k)`; `signal` per I5.6. There is never a CI and never a pool of K × R values. Shares, competition ranks ("1, 2, 2, 4"), the rank range across eligible models, and the axis domain are computed here too (Interfaces).                                                                                 | Asking `web-ml` for descriptive summaries of its own outputs (recorded for the human in HUMAN.md, as Phase 6 D3). |
| D6 Skill gate (I7)                             | `modelBeatsDummy` = mean over partitions of `test.balancedAccuracy` > mean over partitions of `baselines.mostFrequent.balancedAccuracy`. Both values are already stored. An ineligible model gets no dots and no shares, and the legend reads "not compared: barely beats guessing".                                                                                                                                                                                                                                                                                                                                                               | Inferring skill from near-zero importances (forbidden by I7).                                                     |
| D7 Chart                                       | `app-importance-comparison` draws `COMPARISON_DOTS` per Chart 2a: a `dot` per eligible model at `meanImportance` (or `share`), using its `ModelColor` and `chart-encoding.ts` symbol; `ruleY` whiskers at ± `sdAcrossFolds` (One-Shot: ± `monteCarloSe`, captioned "shuffle noise only"); a light `ruleY` from the row's minimum to maximum model value; and a `ruleX` at 0. A `rectY` band left of zero uses `--stone-100` with the direct label "No reliable effect". Rows are the top `TOP_N` by mean share across eligible models, unless "Show all" is on. The user chose v2's dot plot on 2026-11-26, replacing the earlier small multiples. | Small multiples (superseded by v2); the heatmap (Phase 2).                                                        |
| D8 Persisted choices                           | `ComparisonUi` gains `importanceSort: 'average' \| 'disagreement' \| 'alphabetical'` (default `'average'`), `importanceShare: boolean` (default `false`) and `importanceShowAll: boolean` (default `false`). The existing sanitiser repairs invalid values to these defaults, consistent with the other `/results` choices, which survive reload.                                                                                                                                                                                                                                                                                                  | Transient `@state` (would not survive reload, unlike sort, pair and width).                                       |
| D9 Deviations from v2 for the comparison chart | (a) **No tooltips.** Every tooltip sentence is a column of the long-format data table, which satisfies rule 10 without hover. (b) **Negative values:** the colour contract's grey hatch becomes the `--stone-100` band plus a hollow marker for any model whose mean is ≤ 0. Hatched fills on small markers are illegible, and the root palette has no grey or slate tokens. (c) **Disagreement hint:** shown as a visible marker and data-table note, not on hover. (d) **No correlation icons yet** (I8 deferred). All four are recorded in HUMAN.md for the pilot.                                                                              | Plot `tip` marks (pointer-only, which breaks rule 10); new tokens (closed vocabulary needs a separate decision).  |
| D10 Progress                                   | The hook resends the last `TrainingProgress` with the note `{ key: 'importance-start' }`; the first failure sends `{ key: 'importance-unavailable' }` once. The percent never moves (user decision 2026-11-26: always on, with a note).                                                                                                                                                                                                                                                                                                                                                                                                            | An opt-in setting (rejected).                                                                                     |

### Interfaces and behaviour

**Stored block** (`src/types/model-evaluation.ts`, exported with TSDoc):

```ts
/** One held-out partition's shuffle drops, in hook call order. */
export interface StoredImportancePartition {
	readonly nRepeats: number; // REPEATS_DEFAULT or REPEATS_MIN (D4)
	readonly baselineScore: number; // balanced accuracy before shuffling, [0, 1]
	/** baseline − permuted per unit and repeat, `[u * nRepeats + r]`; may be negative. */
	readonly importances: Float64Array;
}

/** Held-out shuffle importance per raw column (schema version 2). */
export interface StoredFeatureImportance {
	readonly scoring: string; // the web-ml scorer name, pinned at re-scout
	readonly seed: number; // IMPORTANCE_SEED
	readonly nRepeatsRequested: number; // REPEATS_DEFAULT
	readonly features: readonly string[]; // raw column names, one per unit
	readonly partitions: readonly StoredImportancePartition[]; // CV folds in order, or one holdout
}
```

`StoredEvaluation` gains `readonly featureImportance: StoredFeatureImportance | null` and `schemaVersion: 1 | 2`.

Decoder rules: `scoring` is a non-empty string; `seed` is an integer; `nRepeatsRequested` is an integer ≥ 1; `features` is non-empty and made of unique non-empty strings; `partitions.length` equals the evaluation's partition count; each `nRepeats` is an integer between 1 and `nRepeatsRequested`; each `baselineScore` is finite in [0, 1]; each `importances` is a `Float64Array` of length `features.length × nRepeats` with finite values. Any failure makes the block `null`, and the rest of the evaluation decodes.

**Collector** (`src/features/models/training/importance-collector.ts`):

```ts
export interface ImportanceCollectorDeps {
	readonly permutationImportance: typeof import('web-ml').permutationImportance;
	readonly prepared: Pick<PreparedClassification, 'targetCodes' | 'classLabels'>;
	readonly signal: AbortSignal;
	readonly now: () => number;
	readonly onNote: (note: TrainingLogMessage) => void;
}
export interface ImportanceCollector {
	readonly hook: FittedModelHook<Classifier>;
	finish(): StoredFeatureImportance | null;
}
export function createImportanceCollector(deps: ImportanceCollectorDeps): ImportanceCollector;
```

Per hook call:

1. `refit` returns at once. A fold or holdout call without `validationFeatures`, or with overlapping training and validation indices, marks the run failed.
2. The first call builds the units (D2). A later call with different `featureNamesOut` marks the run failed.
3. Targets are `Array.from(validationIndices, (i) => prepared.classLabels[prepared.targetCodes[i]])`.
4. `onNote({ key: 'importance-start' })`.
5. Await `permutationImportance` with the fold's `randomState`, the unit keys, the scorer, `nRepeats` (D4), `classLabels: prepared.classLabels` and `signal`. Copy `baselineScore` and `importances`, and check the length.
6. On any error, mark the run failed, send `importance-unavailable` once and skip later calls.

`finish()` returns `null` if the run failed or nothing was recorded.

**View-model** (`src/features/results/importance-comparison-view-model.ts`, pure):

```ts
export type ImportanceSort = 'average' | 'disagreement' | 'alphabetical';
export interface ImportanceCell {
	readonly meanImportance: number;
	readonly sdAcrossFolds: number | null;
	readonly monteCarloSe: number;
	readonly foldValues: readonly number[]; // v[k]
	readonly positiveFolds: number;
	readonly folds: number;
	readonly signal: 'consistent' | 'unclear' | 'negative';
	readonly share: number | null; // max(0, mean) / Σ positive means within the model; null if Σ = 0
	readonly rank: number | null; // competition rank within the model; null if ineligible
}
export interface ImportanceModel {
	readonly num: number;
	readonly label: string;
	readonly modelColor: ModelColor;
	readonly status: 'eligible' | 'below-baseline' | 'legacy' | 'unavailable';
	readonly nRepeatsUsed: number | null; // min partition nRepeats
	readonly nRepeatsRequested: number | null;
}
export interface ImportanceRow {
	readonly feature: string;
	readonly cells: readonly (ImportanceCell | null)[]; // by model index; null when the model lacks the column or is not eligible
	readonly meanShare: number | null; // over eligible models with the column
	readonly rankRange: number | null; // max − min rank over eligible models with the column
	readonly disagreement: boolean; // rankRange ≥ DISAGREEMENT_RANK_RANGE and some eligible pair's mean balanced accuracy differs by < ROPE
}
export interface ImportanceComparisonView {
	readonly evaluatedOn: 'outer-test-folds' | 'single-holdout';
	readonly models: readonly ImportanceModel[];
	readonly rows: readonly ImportanceRow[]; // all rows, sorted
	readonly shownRowCount: number; // min(TOP_N, rows.length) unless showAll
	readonly xDomain: readonly [number, number] | null; // null when no eligible model
}
export function buildImportanceComparison(
	models: readonly ComparisonModel[],
	choices: { sort: ImportanceSort; share: boolean; showAll: boolean; ropeWidth: number }
): ImportanceComparisonView;
```

Sorting:

- **`average`:** `meanShare` descending, nulls last, ties alphabetical.
- **`disagreement`:** `rankRange` descending, nulls last, ties by `meanShare`.
- **`alphabetical`:** locale-insensitive code-point order.

The domain spans 0 and every plotted value ± its whisker (all fold values in share mode), padded 10% of its span each side, or `[-0.01, 0.01]` when the span is 0. Share mode plots `share` with no whiskers. `ROPE` is the current `ComparisonUi.ropeWidth`.

**Presentational element:** `app-importance-comparison` (`src/features/results/app-importance-comparison.ts`), tier 2, no store imports. Public API (closed):

| Property      | Type and default                                                        |
| ------------- | ----------------------------------------------------------------------- |
| `view`        | `ImportanceComparisonView \| null = null`                               |
| `sort`        | `ImportanceSort = 'average'`                                            |
| `share`       | `boolean = false`                                                       |
| `showAll`     | `boolean = false`                                                       |
| `formatDrop`  | `(value: number) => string = String` (signed percentage points)         |
| `formatShare` | `(value: number) => string = String`                                    |
| `labels`      | `ImportanceComparisonLabels`, every field defaulting to an empty string |

`ImportanceComparisonLabels` has these fields:

- string fields: `caption`, `sort`, `sortAverage`, `sortDisagreement`, `sortAlphabetical`, `share`, `axisDrop`, `axisShare`, `noEffect`, `variation`, `shuffleNoise`, `orderCaveat`, `legend`, `notCompared`, `showData`, `feature`, `model`, `rank`, `drop`, `hurt`, `note`, `disagreementNote`;
- function fields: `showAll(count: number): string`, `showTop(count: number): string`, `hurtIn(n: number, k: number): string`, `fewerShuffles(model: string): string` and `rowText(feature: string, model: string, rank: number | null, n: number): string`.

Function fields default to returning an empty string.

Events, all bubbling and composed, as on `/results`:

- `app-importance-sort-change` `{ sort: ImportanceSort }`
- `app-importance-share-change` `{ share: boolean }`
- `app-importance-show-all-change` `{ showAll: boolean }`

The element has no slots, parts or custom properties. It exposes `whenSettled(): Promise<void>` through `PlotController`.

The element renders, in order:

1. A labelled native `<select>` (sort), a checkbox (share) and a legend list. Each model has its swatch, symbol and label. Ineligible models show `labels.notCompared`; `fewerShuffles` appears where `nRepeatsUsed < nRepeatsRequested`.
2. A `<figure>`. The SVG is `aria-hidden`; the figcaption holds `labels.caption`, the whisker meaning (`variation` or `shuffleNoise`) and `orderCaveat` ("Features with overlapping spread are not reliably ordered.").
3. A `<button>` that toggles `showAll(count)` / `showTop(TOP_N)`, shown when there are more than `TOP_N` rows.
4. `<details><summary>${labels.showData}</summary>` with a long-format `<table>`. Rows are grouped by feature (the feature is a row header spanning its model rows). Columns are model, rank, drop (± variation), hurt (`hurtIn(n, K)`) and note (`noEffect` when `signal` is `'negative'`; `disagreementNote` when `disagreement`). Every row, including those beyond `TOP_N`, appears in the table.

Disagreement rows get a visible "≠" text marker beside the y-axis label, and the data table explains it.

**Connected view (`app-results-view`):** after instance agreement (after L818) it renders:

- `<section><h2>Feature importance</h2>`;
- the label "Computed on held-out data";
- one intro sentence ("Each dot shows how much a model's balanced accuracy dropped when one column's values were shuffled in rows the model never trained on.");
- `<details><summary>What this does and does not tell you</summary>` with the three rule 1 statements;
- the element.

It handles the three events with `setComparisonUi(...)` and adds the tag to `whenSettled` (L304). Each non-`eligible` status has its sentence in the legend:

- legacy: "Trained before feature importance was measured; train it again to include it."
- unavailable: "Feature importance could not be measured for this model."
- below-baseline: "Not compared: barely beats guessing."

When no model is eligible, the section shows only the label, the note and "No selected model beats guessing, so none is compared."

**Log notes:** `TrainingLogMessage` gains `{ key: 'importance-start' }` and `{ key: 'importance-unavailable' }`. English: "Measuring feature importance on held-out rows…" and "Feature importance could not be measured for this run."

**Accessibility:**

- **Names:** native controls have visible labels. The figure is named by its figcaption, and the table has a caption.
- **Not colour alone:** model identity uses colour, symbol and the legend label; negative values use position left of zero and the band label.
- **Keyboard:** select → checkbox → "Show all" → disclosure. The data table is the full keyboard path.
- **Manual checks:** VoiceOver with Safari through the controls and the table, forced colours (markers, rules and band stay visible), 200% zoom and 320 px with eight models and 15 rows, and RTL.

## Specification changes

- [ ] `specification/workflow-steps.md` §4: the Feature importance section follows instance agreement (held-out shuffling, balanced accuracy, the skill gate, sort, share and show-all controls, statuses). §Step 5 log: the two notes.
- [ ] `specification/machine-learning-orchestrator.md` §2: `StoredEvaluation` version 2 with `featureImportance`, decoding versions 1–2 with drop-not-reject, the importance collector, I6 seeding and the D4 budget.
- [ ] `specification/state-and-storage.md` §3: `ComparisonUi.importanceSort`, `importanceShare` and `importanceShowAll`.
- [ ] `specification/components/results-comparison.md`: the `app-importance-comparison` row and label contract in §3, statuses in §4, accessibility and manual checks in §6, `CFI-*` in §8, stories in §9 and files in §10.
- [x] `specification/FUTURE.md` § "Richer feature importance": revised at planning on 2026-11-26 to the v2 deferrals (I8 correlation warnings, I4 log loss, I11 lazy compute and "More precise", `COMPARISON_HEATMAP`, the grouped-permutation toggle, `EFFECT_PLOT`, `LOCAL_EXPLAIN` 7b, Phase 3 views). T6 checks that it still matches.
- [x] `specification/plans/web-ml-phase-6-model-specific-results.md`: approval invalidated and v2 model-specific requirements added at planning on 2026-11-26.
- [ ] `specification/HUMAN.md`: the upstream hand-off and Phase 6 revision items, updated at planning; T6 removes the hand-off item once the gate passes. T6 adds items for D5 display arithmetic, the D9 deviations for the pilot, the draft section styling and the manual assistive-technology checks.

## Implementation tasks

### T1 — Stored evaluation version 2 and decoder

- **Depends on:** None
- **Risk:** needs care — persisted contract; old results must keep decoding.
- **Likely files:** `src/types/model-evaluation.ts`, `src/features/results/evaluation-decoder.ts`, `tests/evaluation-decoder.test.ts`, `tests/fixtures/results/evaluations.ts`, `tests/fixtures/results/variants.ts`
- **Must not touch:** `node_modules/`, `vendor/web-ml/` — upstream release.
- **Implementation:** Add the Interfaces types and widen `schemaVersion`. Decode the block in a local helper that catches its own `Invalid` and returns `null`. Version 1 decodes with `featureImportance: null`. Add blocks to the iris cross-validation fixture (3 columns, 5 folds, with one fold at `REPEATS_MIN`) and the breast-cancer One-Shot fixture. Keep a version 1 variant.
- **Acceptance criteria:**
  - [ ] `CFI-SCHEMA-1` — Version 2 decodes with every drop unchanged, including negatives. Version 1 decodes with `featureImportance: null` and the other fields unchanged.
  - [ ] `CFI-SCHEMA-2` — Each invalid block decodes to `featureImportance: null` while the rest of the evaluation decodes: wrong length; non-finite drop; duplicate column; partition-count mismatch; `nRepeats` above `nRepeatsRequested`; baseline outside [0, 1]. Version 3 still returns `null`. The stored type has no `ci95` field (v2 test 5).
- **Verification:** `bun test tests/evaluation-decoder.test.ts`; `bun run check`
- **Progress:** [ ] Not started

### T2 — Importance collector, mapping and log notes

- **Depends on:** T1
- **Risk:** needs care — runs inside the awaited training hook and adds training time.
- **Likely files:** `src/config/feature-importance.ts`, `src/features/models/training/importance-collector.ts`, `src/features/models/training/classifier-adapters.ts`, `src/features/models/training/training-worker.ts`, `src/features/models/training/evaluation-mapper.ts`, `src/features/models/training/protocol.ts`, `src/types/model-result.ts`, `src/features/models/app-training-progress.ts`, `src/features/models/app-model-builder-view.ts`, `tests/importance-collector.test.ts`, `tests/evaluation-mapper.test.ts`, `tests/classifier-adapters.test.ts`, `tests/training-protocol.test.ts`, `tests/training-runtime.e2e.ts`, `tests/fixtures/training/runtime.worker.ts`
- **Must not touch:** `src/features/results/` — display belongs to T3–T5.
- **Implementation:** Add the constants module. Implement D2–D4 and D10 with the collector contract. `execute` creates the collector with the real `permutationImportance`, `prepared`, the run signal, `performance.now` and an `onNote` that resends the last sent progress with the note. It passes `collector.hook` as `onModel` and hands `collector.finish()` to the snapshot. `mapEvaluation` writes `schemaVersion: 2`. Record importance time against total training time in the implementation log for iris, penguins and adult-census (KNN and MLP).
- **Acceptance criteria:**
  - [ ] `CFI-WORKER-1` — With a fake `permutationImportance` and three fold contexts plus a refit, using names such as `["colour","blue"]`, the collector:
    - passes units ordered by first appearance and FNV-1a keys;
    - passes each fold's `randomState` per I6 and targets aligned to `validationIndices`;
    - passes the balanced-accuracy scorer, `REPEATS_DEFAULT` and the signal;
    - ignores the refit;
    - returns copies that survive mutation of the fake's arrays.
  - [ ] `CFI-WORKER-2` — With a fake clock that makes fold 1 project over `IMPORTANCE_BUDGET_MS`, folds 2–3 use `REPEATS_MIN`, and each partition records its own `nRepeats`.
  - [ ] `CFI-WORKER-3` — Each of these gives `finish() === null`, exactly one `importance-unavailable` note and a hook that resolves without throwing: a throwing fake; a wrong-length result; a missing `validationFeatures`; overlapping indices (v2 test 3); differing `featureNamesOut` between folds.
  - [ ] `CFI-WORKER-4` — `isTrainingLogMessage` accepts both notes and rejects unknown keys, and Step 5 renders both English sentences.
  - [ ] `CFI-WORKER-5` — With real `web-ml` (`tests/training-runtime.e2e.ts`): iris CV and penguins One-Shot store valid version 2 blocks, and penguins' categorical columns appear once each, under their raw names. Training the same model twice on the same partitions gives identical `importances` (determinism, v2 test 2). Cancelling during measurement settles as cancelled.
- **Verification:** `bun test tests/importance-collector.test.ts`; `bun test tests/evaluation-mapper.test.ts`; `bun test tests/training-protocol.test.ts`; `bun run test:e2e tests/training-runtime.e2e.ts`; `bun run check`
- **Progress:** [ ] Not started

### T3 — Comparison view-model and persisted choices

- **Depends on:** T1
- **Risk:** needs care — the statistics wording relies on exact I5 arithmetic.
- **Likely files:** `src/features/results/importance-comparison-view-model.ts`, `src/types/state.ts`, `src/stores/comparison-preferences.ts`, `tests/importance-comparison-view-model.test.ts`, `tests/state-and-storage.test.ts`
- **Must not touch:** `src/features/results/comparison-model.ts` — consumed as is; `modelColor` comes from `chart-best-practices`.
- **Implementation:** D5, D6 and D8 with the view-model contract. Add the three `ComparisonUi` fields, defaults and sanitiser branches.
- **Acceptance criteria:**
  - [ ] `CFI-VM-1` — Hand-computed fixtures match:
    - `v[k]`, `meanImportance`, `sdAcrossFolds` (null for K = 1), `positiveFolds`, `monteCarloSe` with unequal `nRepeats`, and `signal` for consistent, unclear and negative cases (K = 2 never consistent);
    - shares with the clamp only in `share` (null when no mean is positive), competition ranks with ties, and `rankRange` over models that have the column.

    No value pools K × R (v2 tests 4–5).
  - [ ] `CFI-VM-2` — The skill gate applies: a model whose mean held-out balanced accuracy is not above the mean most-frequent baseline is `below-baseline`, has `null` cells and is excluded from `meanShare`, `rankRange` and `xDomain` (v2 test 11). Version 1 gives `legacy`, and a `null` block gives `unavailable`.
  - [ ] `CFI-VM-3` — All three sorts order rows as specified. `shownRowCount` respects `TOP_N` and `showAll`. `disagreement` needs both a rank range ≥ `DISAGREEMENT_RANK_RANGE` and an eligible pair within `ropeWidth`. The domain includes 0, the whiskers and the padding.
  - [ ] `CFI-STATE-1` — Invalid stored `importanceSort`, `importanceShare` and `importanceShowAll` values repair to their defaults, and valid values round-trip.
- **Verification:** `bun test tests/importance-comparison-view-model.test.ts`; `bun test tests/state-and-storage.test.ts`; `bun run check`
- **Progress:** [ ] Not started

### T4 — `app-importance-comparison`

- **Depends on:** T3
- **Risk:** routine
- **Likely files:** `src/features/results/app-importance-comparison.ts`, `src/features/results/app-importance-comparison.stories.ts`, `tests/importance-comparison.e2e.ts`
- **Must not touch:** `src/features/results/charts/plot-controller.ts`, `src/features/results/charts/chart-encoding.ts` — shared; use them as shipped.
- **Implementation:** D7 and D9 with the element contract. Use model colours and symbols from `chart-encoding.ts` and chart tokens from `specification/charts.md`, with no literal colours and logical properties only.
- **Acceptance criteria:**
  - [ ] `CFI-UI-1` — With three eligible models, every visible row has one dot per model that has the column, using that model's symbol. Whiskers mean ± variation for CV and ± shuffle noise for One-Shot. A min–max rule and a zero rule are drawn. In share mode the whiskers disappear and the axis reads `axisShare`.
  - [ ] `CFI-UI-2` — More than `TOP_N` rows shows `TOP_N` plus the "Show all N features" button, and the table lists every row. A below-baseline model appears in the legend with `notCompared` and has no dots. A negative mean draws a hollow marker in the "No reliable effect" band, and its table note says so.
  - [ ] `CFI-UI-3` — Changing the select, checkbox and button fires the three events with the documented `detail`, bubbling and composed. Keyboard alone reaches every control and the table. Every figure value appears in the table. RTL, a 60-character column name and 320 px width render without clipping or page scroll.
  - [ ] Stories:
    - variants: CV three models; One-Shot; share mode; more than 15 rows; show all; a below-baseline model; negative means; disagreement rows; all ineligible;
    - Long label and RTL;
    - Do / Don't: "Do keep one metric for every model"; "Don't describe importance as cause and effect"; "Don't call the whiskers a confidence interval".
- **Verification:** `bun run test:e2e tests/importance-comparison.e2e.ts`; `bun run test:stories`; `bun test tests/style-tokens.test.ts`; `bun run check`
- **Progress:** [ ] Not started

### T5 — Compare Results section, mockup draft and journeys

- **Depends on:** T2, T4
- **Risk:** routine
- **Likely files:** `src/features/results/app-results-view.ts`, `src/features/results/app-results-view.stories.ts`, `tests/comparison.e2e.ts`, `tests/comparison-charts.e2e.ts`, `tests/a11y.e2e.ts`, `tests/helpers/seed-results.ts`, `tests/fixtures/results/comparison.ts`, `tests/fixtures/results/labels.ts`, `specification/mockups/04_compare-results.html`
- **Must not touch:** `specification/mockups/mockups.css` — human-owned.
- **Implementation:** Implement the connected view, strings and event handlers from Interfaces. Add a `<!-- {Feature importance} -->` draft section, with its no-eligible-model and legacy states, to the 04 draft (visual-design §1.1).
- **Acceptance criteria:**
  - [ ] `CFI-UI-4` — On `/results` with the iris pair, the section follows instance agreement with the held-out label and the closed "What this does and does not tell you" disclosure containing the three statements. Deselecting a model removes its dots and legend entry.
  - [ ] `CFI-UI-5` — Sort, share and show-all survive reload. One result downgraded to version 1 shows its legacy sentence. `whenSettled` resolves.
  - [ ] `CFI-UI-6` — `tests/a11y.e2e.ts` scans the populated comparison with the section and finds no new violations (v2 test 12).
- **Verification:** `bun run test:e2e tests/comparison.e2e.ts`; `bun run test:e2e tests/comparison-charts.e2e.ts`; `bun run test:e2e tests/a11y.e2e.ts`; `bun run test:stories`; `bun run check`
- **Progress:** [ ] Not started

### T6 — Specification sync

- **Depends on:** T1, T2, T3, T4, T5
- **Risk:** routine
- **Likely files:** `specification/workflow-steps.md`, `specification/machine-learning-orchestrator.md`, `specification/state-and-storage.md`, `specification/components/results-comparison.md`, `specification/FUTURE.md`, `specification/HUMAN.md`, `specification/plans/README.md`, `specification/plans/compare-feature-importance.md`
- **Must not touch:** `specification/plans/web-ml-phase-6-model-specific-results.md` — revised in its own planning session.
- **Implementation:** Tick every _Specification changes_ item and update HUMAN.md as listed there.
- **Acceptance criteria:**
  - [ ] Every _Specification changes_ item is ticked, and `bun run plans:check` passes.
- **Verification:** `bun run plans:check specification/plans/compare-feature-importance.md`; `bun run lint`; `bun run build`; `bun run check`
- **Progress:** [ ] Not started

## Verification and definition of done

- [ ] All task acceptance criteria met.
- [ ] `bun run check`, `bun run lint`, `bun run build`, `bun run test:stories` and the listed `bun run test:e2e` files pass with no new failures.
- [ ] Manual checks recorded: VoiceOver with Safari, forced colours, 200% zoom, 320 px width and RTL.
- [ ] Code review confirms that `samata-ml` never shuffles, predicts or scores, that the hook cannot throw, and that default text avoids "permutation" and "confidence interval".
- [ ] Every _Specification changes_ item is ticked, and specifications match the code.
- [ ] `bun run format` run on changed files; no changes outside the tasks' likely files.

## Risks and open questions

- **Blocking:** Implementation needs a `web-ml` release, vendored in `vendor/web-ml/`, in which `permutationImportance` provides two things:
  - (a) a balanced-accuracy scorer: request [`2026-11-23-01-balanced-accuracy-scoring-everywhere.md`](../../../web-ml/specification/requests/2026-11-23-01-balanced-accuracy-scoring-everywhere.md), status `planned`;
  - (b) grouped or raw-column shuffling with keyed group streams: request `2026-11-26-grouped-permutation-importance.md`, which is pending in the `web-ml` inbox; its receipt will be at `../web-ml/specification/requests/receipts/2026-11-26-grouped-permutation-importance.md`.

  Then re-scout the release, pin the scorer, groups and keys names (or the raw-column form) and holdout `validationFeatures` in D1, D2 and Interfaces, and submit for review. Owner: `web-ml` planner, then the `samata-ml` planner.
- **Non-blocking:** `chart-best-practices` must be implemented first (user decision 2026-11-26); this plan consumes its `ComparisonModel.modelColor`, `chart-encoding.ts` symbols and `specification/charts.md`. `virtual-table-improvements` also edits `app-results-view.ts`, and it lands first. Owner: implementer.
- **Non-blocking:** Phase 6 now waits for this plan. It must move to schema version 3, decode versions 1–3, compose its `onModel` collector with this one, and integrate the v2 model-specific requirements added to it on 2026-11-26. Owner: planner (HUMAN.md).
- **Non-blocking:** Cost. Each fold adds `1 + columns × repeats` predictions over its held-out rows, and KNN on adult-census is the costliest. D4 caps it at `REPEATS_MIN`; T2 records the times. If importance still dominates training, record it in HUMAN.md; request `2026-11-23-13` (worker prediction) is the follow-up. Owner: implementer, then human.
- **Non-blocking:** Correlated columns share credit, so the order of a correlated pair is unreliable; the rule 1 note states this until I8 lands. Association measures are requested in `2026-11-26-pairwise-feature-association.md` (pending in the `web-ml` inbox; not needed to unblock this plan). Owner: human.
- **Non-blocking:** D5 keeps descriptive arithmetic in `samata-ml`, and D9 records four deviations from v2 for the pilot (HUMAN.md). Owner: human.

## Escalations

None.

## Review fixes

None.

## Implementation and verification log

| When (UTC) | Task | Agent (model) | Outcome / commands / evidence |
| ---------- | ---- | ------------- | ----------------------------- |
| —          | —    | —             | Not started                   |

## Plan review history

| Reviewed (UTC)       | Agent (model)                             | Decision          | Findings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------- | ----------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-26T19:22:59Z | Google Antigravity (Gemini 4 Carbon High) | changes-requested | BLOCKER: unshipped web-ml scorer/grouped-shuffling APIs left unpinned (D1/D2/T2) and T4 PlotController rectY/--stone-100 mismatch + unmerged chart-best-practices dependency; MAJOR: T2 omits result-validation.ts and progress.ts breaking worker/envelope validation and dropping notes, D9(b) hollow markers fail on stroked olive/neutral symbols and amber 1.4.11 contrast and disagree with I5.6 at 0, T4/T5 SVG aria-hidden violates charts.md role=img, ImportanceComparisonLabels lacks legacy/unavailable/empty strings and orphans rowText, downgradeEnvelope produces ResultEnvelopeV1 hiding comparison, and I6 holdout seed / share xDomain / ROPE disagreement / R=1 monteCarloSe edge cases are underspecified; MINOR: training-progress.md spec sync, note retention, Phase 6 tick, format scope |

## Change log

| When (UTC)           | Change                                                                        | Reason                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-26T13:24:47Z | Initial draft                                                                 | User request: feature importance as a Compare Results section, lean, before Phase 6. Decisions: balanced accuracy, grouped shuffling, small multiples, always on with a progress note.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-11-26T13:44:02Z | Revised against `specification/notes/feature-importance-requirements.md` (v2) | User request. Scope stays on Compare Results; the model-specific v2 items move to Phase 6. The chart becomes `COMPARISON_DOTS` (replacing small multiples). Aggregation follows I5 (per-fold means, no pooled CI) instead of the earlier pooled SD. Added the I1 assertion, I6 keyed pairing, the I7 skill gate, the I11 budget fallback, rule 1 and 2 labels, persisted sort, share and show-all choices, and the named constants. User decisions 2026-11-26: I8 and I4 deferred (association request filed), eager computation, `chart-best-practices` first, implement after `virtual-table-improvements`. Amended the pending grouped request with keyed streams (Q6). |
