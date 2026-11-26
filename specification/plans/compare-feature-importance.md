# Feature importance on Compare Results

**Status:** draft | **Updated:** 2026-11-26T13:24:47Z
**Authors:** Claude Code (claude-opus-5-5) | **Created:** 2026-11-26T13:24:47Z
**Verified by:** — | **Verified:** — | **Verification:** pending
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour:** Compare Results (`/results`, `src/features/results/app-results-view.ts`) shows six sections: the metrics table, the fold strip, class error bars, confusion differences, practical equivalence and instance agreement (L665-820). No surface in the app shows how much a model relies on each feature. `StoredEvaluation` (`src/types/model-evaluation.ts` L113-134) is `schemaVersion: 1` and holds no feature-level data. `decodeStoredEvaluation` (`src/features/results/evaluation-decoder.ts` L454-457) rejects every other version. The training worker (`src/features/models/training/training-worker.ts` L76, L95) disposes each fitted model without inspecting it and passes no `onModel` hook.

**Target behaviour:** Below instance agreement, Compare Results adds a **Feature importance** section. It holds one panel per selected model (small multiples, two to eight panels). Each panel ranks that model's source columns by how much **balanced accuracy on held-out rows** drops when the column is shuffled. A shuffled categorical column moves all of its encoded columns together. Each panel shows the top 15 columns as horizontal bars from a zero line. Cross-validation panels add ±1 SD whiskers over folds × repeats. Every panel shares one x-axis so magnitudes compare across models. A "Show data table" disclosure lists every column. Results saved before this plan, or whose measurement failed, explain why that model's panel is empty. Step 5 shows a log line while importance is measured.

**Why:** VISION §9 asks learners to contrast inspectable models with an opaque neural network. Phase 6 shows each model's native internals, but they use different units and cannot be compared. Held-out permutation importance is the one measure that applies to all eight classifiers in the same units. The source note (`specification/notes/feature-importance.md`) names it the universal default view.

## Scope

**In scope**

- `StoredEvaluation` `schemaVersion: 2` with an optional `featureImportance` block. The decoder accepts versions 1 and 2 and drops an invalid block without rejecting the evaluation.
- A worker-side importance collector, passed as `onModel` to `holdoutValidate` and `crossValidate`. It calls `web-ml` `permutationImportance` on each fold's or the holdout's held-out rows, with source-column groups and the balanced-accuracy scorer.
- Two new training-log notes for Step 5 (measurement started, measurement unavailable).
- One presentational element, `app-feature-importance`, with its view-model, stories and three-browser tests. It is wired into `app-results-view` with its strings.
- A draft "Feature importance" section in the `04_compare-results.html` draft mockup.
- Specification sync and the backlog entries listed under _Specification changes_.

**Out of scope**

- Any `web-ml` computation. `samata-ml` never shuffles rows, predicts or scores itself (Repository boundary).
- The note's cross-model heatmap, per-model normalisation, rank badges and "highest disagreement" sort. On 2026-11-26 the user chose small multiples for v1. Backlog.
- Importance in Section 6 (`/models/{num}`), tree MDI versus permutation, signed native weights, effect plots (ALE/PDP/ICE), local explanations (SHAP, waterfalls), counterfactuals, correlation-peer warnings, a top-N toggle, a relative-share toggle, tooltips and a configurable repeat count. Backlog (`specification/FUTURE.md`); Phase 6 owns its own native internals.
- Per-encoded-level importance (for example "colour: blue"). Grouped shuffling replaces it.
- Recomputing importance for results saved before this plan, or hydrating stored `modelJson`.
- Regression models.

**Constraints and invariants**

- **Upstream gate:** implementation starts only once the vendored `web-ml` release provides both (a) a balanced-accuracy scorer accepted by `permutationImportance` and (b) grouped or raw-column permutation. See Risks: Blocking.
- **Held-out only:** importance is measured with the fold model (hook `kind: 'fold'`) on that fold's `validationFeatures`, and with the One-Shot model (`kind: 'holdout'`) on its `validationFeatures`. The cross-validation refit (`kind: 'refit'`) has no held-out rows and is ignored (`metrics.md` L113-114).
- **Hook safety:** `onModel` is awaited on the worker thread, and a thrown error fails the run with `callback-failed` (`metrics.md` L97-137). The collector catches every error, so it can never throw out of the hook. It awaits `permutationImportance` before the hook settles, because tensors are valid only until then (`metrics.md` L129-131). It copies every output into new `Float64Array`s. It never disposes the model or the context tensors.
- **Cancellation:** the collector passes the worker's `AbortController.signal` (`training-worker.ts` L143) to `permutationImportance`. An abort settles the run as cancelled without waiting for the hook (`metrics.md` L135-137).
- **No partial blocks:** if any fold or holdout measurement fails, the run stores `featureImportance: null` and logs one "unavailable" note. The training result itself still succeeds.
- **Display arithmetic only:** `samata-ml` computes only the mean and sample SD of stored per-repeat drops, the ranking and the shared axis domain (D5). Negative drops are never clamped.
- Phase 4/5 element conventions apply (`specification/components/results-comparison.md` §3):
  - Observable Plot only through `PlotController`;
  - a figure, a caption and a "Show data table" `<details>`;
  - `labels` objects with empty-string defaults, with `app-results-view` owning every string;
  - tokens only; no colour-only meaning;
  - WCAG 2.2 AA and i18n.

## Required reading

- `specification/COMPONENTS.md` §3–§10 (every Lit task).
- `specification/components/results-comparison.md` §3–§9 — closed APIs and label conventions on `/results`.
- `specification/notes/feature-importance.md` §Grouped Shuffling, §Core Computation Invariants 1, 2, 6 and 7, and §Chart 1 `PFI_BAR` — the source note. Note: the plan deviates from it as recorded in D1 and D6.
- `specification/workflow-steps.md` §4 Compare Results (section order) and `specification/machine-learning-orchestrator.md` §2 (stored evaluation).
- `web-ml` public contract, installed package (pin the post-gate release at re-scout):
  - `node_modules/web-ml/dist/src/inspection/permutation-importance.d.ts` L6-81 and `node_modules/web-ml/specification/public-api/model-inspection.md` L227-254 — signature, scorers, cost, model input space;
  - `node_modules/web-ml/dist/src/training/fitted-model-hook.d.ts` L6-38 and `node_modules/web-ml/specification/public-api/metrics.md` L97-137 — hook context, ordering, tensor lifetime, cancellation;
  - `node_modules/web-ml/specification/public-api/tabular-preprocessing.md` L80-90 — `featureNamesOut` encoding.

## Codebase context

- **Relevant specifications:**
  - `specification/workflow-steps.md` §4 (L234-242) — section order on `/results`;
  - `specification/components/results-comparison.md` — connected and presentational contracts;
  - `specification/machine-learning-orchestrator.md` §2 — stored evaluation;
  - `specification/VISION.md` §9;
  - `specification/notes/metrics-and-visuals.md` §3 C item 13 (permutation importance component).
- **Persisted contract:**
  - `src/types/model-evaluation.ts` L113-134 `StoredEvaluation` (`schemaVersion: 1`; `protocol`, `classLabels`, `positiveClassIndex`, `partitionFingerprint`, `partitions`, `pooled`, `outputs`, `curves`); L111 says later phases add optional fields and bump `schemaVersion`.
  - `src/features/models/training/evaluation-mapper.ts` L223-226 `mapEvaluation(runtime, input): Promise<StoredEvaluation>` assembles the literal record at L279-295. It is called from `classifier-adapters.ts` L211 (holdout, `snapshotHoldoutResult` L195) and L260 (CV, `snapshotCrossValidationResult` L241).
  - `src/features/results/evaluation-decoder.ts`: helpers `record` L44, `count` L51, `finite` L58, `typed` L70, `partitions` L208, `curves` L334. `fail()` throws the internal `Invalid` (L38-42), and `decodeStoredEvaluation` (L454) returns `null` on `Invalid`. The version check is at L457. Optional blocks follow the `curves` pattern (L342, L372, L402), and the result object is at L482-492.
  - `src/types/model-result.ts` L27-41 `TrainingLogMessage` (a discriminated union, for example `{ key: 'fold-start'; fold; folds }`). `isTrainingLogMessage` is in `src/features/models/training/protocol.ts` L153-154.
- **Training worker:**
  - `src/features/models/training/classifier-adapters.ts` L97-139 `buildClassificationRequest(classifier, prepared, setup)`:
    - preprocessing `{ columns, standardize: false }` at L105;
    - provider `new PartitionDatasetProvider(prepared, prepared.targetCodes.map((_code, index) => index))` at L105-108, identity-mapped over retained rows;
    - One-Shot `returnFit: true` at L118-127; CV `scoring: 'accuracy'`, `refit: true` at L129-138.
  - `training-worker.ts`:
    - `execute` (L41-109) receives `send: (update: TrainingUpdate) => void` (L46) and the signal (L45);
    - `installTrainingWorker`'s `send` (L146-150) drops progress after abort;
    - fitted models are disposed in `finally` (L232-234, L277-279).
  - `prepared.targetCodes[i]` and `prepared.classLabels` (`prepare-classification.ts` L100-115) give the label of provider row `i`, and the hook's `validationIndices` index provider rows. Row `r` of `validationFeatures` is `validationIndices[r]` (`fitted-model-hook.d.ts` L11, L19-26).
  - `src/features/models/training/progress.ts` L6 `TrainingUpdate = { progress; note? }`; the CV mapper is at L91-124 and the holdout mapper at L60-77.
- **Compare view:**
  - `app-results-view.ts`:
    - messages via `i18n('app-results-view', …)` at L65-171 (`model` at L91, `showData` at L118);
    - `whenSettled` tag list at L304;
    - `buildViews` at L380-507, taking `num` from `data.activeGroup.models` (L405-408);
    - sections at L665-820, with the instance agreement section ending at L818;
    - unavailable-model rendering at L610-633.
  - `src/features/results/comparison-model.ts` L12-16 `ComparisonModel { num; label; evaluation }` (no `featureNamesOut`; `src/stores/model-results.store.ts` L71-76 keeps only the evaluation). The importance block must therefore carry its own column names.
  - Horizontal bar precedent: `src/features/results/app-class-error-bars.ts` (`barX` at L83, `<details>` data table at L112-115). `PlotController` mark kinds (`src/features/results/charts/plot-controller.ts` L26) include `barX`, `ruleX` and `ruleY`.
- **Step 5 log:** `app-training-progress` (`src/features/models/app-training-progress.ts` L16-47 English `defaultLabels.formatEntry`, L54-55). It is mounted with `formatEntry` in `src/features/models/app-model-builder-view.ts` L2463-2479, and `formatTrainingLogEntry` is at L1972.
- **Tests and commands:**
  - `tests/evaluation-decoder.test.ts`, `tests/evaluation-mapper.test.ts`, `tests/classifier-adapters.test.ts`, `tests/training-progress.test.ts` and `tests/training-protocol.test.ts`;
  - `tests/training-runtime.e2e.ts` with `tests/fixtures/training/runtime.worker.ts` (real `web-ml` in a worker);
  - `tests/results-view-model.test.ts`, `tests/comparison.e2e.ts`, `tests/comparison-charts.e2e.ts` and `tests/a11y.e2e.ts` L29-31;
  - fixtures `tests/fixtures/results/evaluations.ts` (`irisCrossValidation` L200, `breastCancerOneShot` L363), `tests/fixtures/results/comparison.ts` L5 and `tests/helpers/seed-results.ts` (`seedComparablePair` L222, `downgradeEnvelope` L310);
  - commands: `bun run check`, `bun test <path>`, `bun run test:e2e [file]`, `bun run test:stories`, `bun test tests/style-tokens.test.ts`, `bun run lint`, `bun run build`.
- **Web guidance:** None. Native `<details>`, `<figure>` and `<table>` follow existing `/results` precedent.
- **Visual reference:** draft only. `specification/mockups/04_compare-results.html` (status `draft`) gains a "Feature importance" section (T4). No parity entries (visual-design §1.1).
- **Domain skills:** `lit-component-implementer` for T3 and T4.
- **Upstream evidence:** `codebase-scout` read the installed `web-ml` 0.2.0 public declarations and prose on 2026-11-26. `permutationImportance` accepts `'accuracy' | 'f1' | 'r2' | 'mean-squared-error'`, where `'f1'` is binary only (`permutation-importance.d.ts` L6, L58-67), and has no feature groups (L8-26). Request `2026-11-23-01` (status `planned`) asks for `recall-macro` and the `balanced-accuracy` alias in `permutationImportance` (L16, L21-22, L36). Grouped permutation is requested in [`2026-11-26-grouped-permutation-importance.md`](../../../web-ml/specification/requests/2026-11-26-grouped-permutation-importance.md) (filed 2026-11-26).
- **Assumptions requiring verification:** At re-scout, confirm the release's grouped-permutation API shape, the balanced-accuracy scorer name and that holdout `preprocessing.validationFeatures` is present. 0.2.0 implies it ("same rules as for a fold", `metrics.md` L103-105) but does not state it.

## Technical decisions

| Decision                | Chosen approach and rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Rejected alternative / trade-off                                                                                                                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 Measure              | `web-ml` `permutationImportance` on held-out rows, scored by balanced accuracy, with `nRepeats: 5` and `randomState: 0` for every model, so comparable models draw identical permutations. The user chose balanced accuracy on 2026-11-26 to match the `/results` headline; on bank-marketing or adult-census, accuracy would understate minority-class columns. Five repeats is the `web-ml` default and halves the cost of the note's suggested 10 (Risks).                                                                                                                                            | Accuracy now (rejected by the user on 2026-11-26). Tree MDI or native weights (not comparable across models; backlog). Ten repeats (doubles cost).                                                             |
| D2 Grouping             | One group per source column: `JSON.parse(featureNamesOut[i])[0]` names the source (`tabular-preprocessing.md` L86-89). Groups are ordered by first appearance, and each lists every column index with that source, in ascending order. The user required grouped shuffling on 2026-11-26. If `web-ml` ships raw-column permutation instead (the request's equivalent alternative), the collector passes source columns, with the same groups and order.                                                                                                                                                  | Per-encoded-column importance (impossible rows, split importance; rejected by the user). Summing per-column drops (not equal to a joint shuffle).                                                              |
| D3 Collector            | `src/features/models/training/importance-collector.ts` exports `createImportanceCollector(deps)`, which returns `{ hook, finish }` (Interfaces). `execute` builds the collector and passes `collector.hook` as `onModel` on both protocols (`buildClassificationRequest` gains an optional `onModel` parameter). `finish()` is passed into the snapshot so `mapEvaluation` can attach the block. The `permutationImportance` function is injected so unit tests use a fake.                                                                                                                              | Hydrating `modelJson` later in the page (fold models are not stored; synchronous prediction would block the UI).                                                                                               |
| D4 Storage              | `StoredEvaluation.schemaVersion` becomes `1 \| 2`; the mapper always writes 2, with `featureImportance: StoredFeatureImportance \| null`. The decoder accepts 1 (block `null`) and 2. An invalid block decodes to `null`, and the rest of the evaluation still decodes. Per-repeat drops are stored so the display can compute SD over folds × repeats.                                                                                                                                                                                                                                                  | Storing only `web-ml`'s per-fold mean and SD (cannot give the note's SD over folds × repeats). Rejecting the evaluation on a bad block (would hide every other comparison).                                    |
| D5 Display arithmetic   | In `src/features/results/feature-importance-view-model.ts`, per column: `mean` is the arithmetic mean of all stored drops (every partition × repeat); `sd` is the sample SD (n − 1) of those drops for cross-validation, and `null` for One-Shot (the note hides whiskers for a single split). Columns rank by `mean`, descending; ties go by source order. Panels show the top 15; the table lists all. The shared x domain over every ready panel is `[min(0, min(mean − (sd ?? 0))), max(0, max(mean + (sd ?? 0)))]`, widened by 10% of its span on each side, or `[-0.01, 0.01]` when the span is 0. | Asking `web-ml` for pooled statistics (descriptive display arithmetic over stored values; recorded for the human in HUMAN.md, as Phase 6 D3 does). Per-panel axes (hide magnitude differences between models). |
| D6 Chart                | Small multiples: one `app-feature-importance` element per selected model, in model order, inside one section. Each element has a horizontal `barX` from 0 to `mean` (y = column, ranked), a `ruleX` at 0 and, when `sd` is non-null, `ruleY` whiskers from `mean − sd` to `mean + sd`. Negative bars use a second chart token and extend left of zero, so direction carries the meaning and colour only reinforces it. The user chose small multiples over one shared dot plot on 2026-11-26.                                                                                                            | The note's heatmap (backlog). One faceted Plot (Plot facets share the y scale, so each model could not rank its own columns).                                                                                  |
| D7 Progress             | The hook posts the last progress unchanged with the note `{ key: 'importance-start' }`. A failure posts `{ key: 'importance-unavailable' }` once per run. `execute` keeps the last `TrainingProgress` it sent so the hook can resend it; the percent never moves. The user chose always-on measurement with a progress note on 2026-11-26.                                                                                                                                                                                                                                                               | An opt-in Training Setup checkbox (rejected by the user). A new progress stage (changes Step 5 state rules).                                                                                                   |
| D8 Availability reasons | The view-model gives each panel a status: `ready`, `legacy` (block missing because `schemaVersion` is 1), `unavailable` (block `null` in version 2) or `empty` (every mean is 0, matching the note's "did not outperform baseline" banner). The view supplies one sentence per status.                                                                                                                                                                                                                                                                                                                   | Hiding panels (learners would not know why a model is missing).                                                                                                                                                |

### Interfaces and behaviour

**Stored block** (`src/types/model-evaluation.ts`; exported, with TSDoc):

```ts
/** One held-out partition's permutation drops, in hook call order. */
export interface StoredImportancePartition {
	/** Balanced accuracy of the unshuffled held-out rows, in [0, 1]. */
	readonly baselineScore: number;
	/** Drop per source column and repeat, laid out `[g * nRepeats + r]`; may be negative. */
	readonly importances: Float64Array;
}

/** Held-out grouped permutation importance (schema version 2). */
export interface StoredFeatureImportance {
	/** The `web-ml` scorer name, pinned at re-scout (for example `'balanced-accuracy'`). */
	readonly scoring: string;
	readonly nRepeats: number;
	/** Source column names, one per group, in first-appearance order of `featureNamesOut`. */
	readonly features: readonly string[];
	/** Cross-validation: one per fold in fold order. One-Shot: exactly one. */
	readonly partitions: readonly StoredImportancePartition[];
}
```

`StoredEvaluation` gains `readonly featureImportance: StoredFeatureImportance | null` and `schemaVersion: 1 | 2`.

Decoder rules for the block: `scoring` is a non-empty string; `nRepeats` is an integer ≥ 1; `features` is non-empty, made of unique non-empty strings; `partitions.length` equals the evaluation's partition count; each `baselineScore` is finite in [0, 1]; each `importances` is a `Float64Array` of length `features.length × nRepeats` with finite values. Any failure makes the block `null`.

**Collector** (`src/features/models/training/importance-collector.ts`):

```ts
export interface ImportanceCollectorDeps {
	readonly permutationImportance: typeof import('web-ml').permutationImportance;
	readonly prepared: Pick<PreparedClassification, 'targetCodes' | 'classLabels'>;
	readonly signal: AbortSignal;
	readonly onNote: (note: TrainingLogMessage) => void;
}
export interface ImportanceCollector {
	readonly hook: FittedModelHook<Classifier>;
	finish(): StoredFeatureImportance | null;
}
export function createImportanceCollector(deps: ImportanceCollectorDeps): ImportanceCollector;
```

Hook behaviour per call:

1. A `refit` call, or a call without `preprocessing.validationFeatures`, returns at once (for a fold or holdout, a missing `validationFeatures` marks the run failed).
2. On the first fold or holdout call, the collector derives the groups from `preprocessing.featureNamesOut` (D2) and keeps the names. On later calls, a differing `featureNamesOut` marks the run failed.
3. Targets are `Array.from(validationIndices, (i) => prepared.classLabels[prepared.targetCodes[i]])`.
4. Each fold or holdout call posts `onNote({ key: 'importance-start' })`.
5. The collector awaits `permutationImportance(model, { features: validationFeatures, targets }, { scoring, nRepeats: 5, randomState: 0, classLabels: prepared.classLabels, signal, <groups option> })`. It copies `baselineScore` and `importances` into a new partition entry.
6. Any error, or a result whose `importances.length` is not groups × 5, marks the run failed. The collector posts `onNote({ key: 'importance-unavailable' })` once and skips all later calls.

`finish()` returns `null` if the run failed or no partition was recorded; otherwise it returns the block.

**Log notes:** `TrainingLogMessage` gains `{ key: 'importance-start' }` and `{ key: 'importance-unavailable' }`, and `isTrainingLogMessage` accepts them. English defaults in `app-training-progress` and translations in `app-model-builder-view` read "Measuring feature importance on held-out rows…" and "Feature importance could not be measured for this run."

**Presentational element:** `app-feature-importance`, file `src/features/results/app-feature-importance.ts`, tier 2 (presentational), no store imports. Public API (closed):

| Property      | Type and default                            | Notes                                                                                                 |
| ------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `panel`       | `FeatureImportancePanel \| null = null`     | Not reflected, `attribute: false`.                                                                    |
| `xDomain`     | `readonly [number, number] \| null = null`  | The shared axis from the view-model.                                                                  |
| `formatScore` | `(value: number) => string = String`        | Signed percentage-point formatter from the view.                                                      |
| `labels`      | `FeatureImportanceLabels` (all fields `''`) | `title`, `caption`, `axis`, `column`, `rank`, `meanDrop`, `spread`, `noSpread`, `showData`, `status`. |

The element has no slots, parts, custom properties or events. It exposes `whenSettled(): Promise<void>` (delegating to `PlotController`), like the other chart elements.

```ts
export interface FeatureImportanceRow {
	readonly column: string;
	readonly rank: number; // 1-based
	readonly mean: number;
	readonly sd: number | null;
}
export interface FeatureImportancePanel {
	readonly num: number; // reflected as model-num on the host for test targeting
	readonly status: 'ready' | 'legacy' | 'unavailable' | 'empty';
	readonly rows: readonly FeatureImportanceRow[]; // all columns, ranked; empty unless ready/empty
}
```

The host reflects a `model-num` attribute from `panel.num` (domain identity convention, COMPONENTS §4). Rendering:

- The host renders `<figure>` with `<figcaption>` holding `labels.title` (the model name) and `labels.caption`.
- A `ready` panel adds the chart (top 15 rows, `xDomain`, axis label `labels.axis`).
- Every non-`ready` status renders `<p>${labels.status}</p>` instead of a chart. An `empty` panel still offers the data table.
- `<details><summary>${labels.showData}</summary>` holds a `<table>` with every row: rank, column, mean drop (`formatScore`) and spread (`formatScore(sd)` or `labels.noSpread`).

**View-model:** `src/features/results/feature-importance-view-model.ts` exports `buildFeatureImportanceViews(models: readonly ComparisonModel[]): { panels: FeatureImportancePanel[]; xDomain: readonly [number, number] | null }`. It is pure; `xDomain` is `null` when no panel is `ready`. It implements D5 and D8.

**Connected view:** `app-results-view` renders after instance agreement (after L818):

- `<section><h2>Feature importance</h2>`;
- one introductory paragraph ("Each chart shows how much balanced accuracy on held-out rows fell when one column's values were shuffled. Longer bars mean the model relied on that column more. Bars left of zero mean shuffling made no difference, or slightly helped, by chance.");
- a protocol sentence (cross-validation: "Whiskers show ±1 SD over {folds} folds × {repeats} shuffles."; One-Shot: "Estimated from one split × {repeats} shuffles, so no spread is shown.");
- one `app-feature-importance` per selected model, using `repeat` keyed by `num`.

It adds the tag to the `whenSettled` list (L304). Status sentences:

- legacy: "Trained before feature importance was measured. Train the model again to see it."
- unavailable: "Feature importance could not be measured for this model."
- empty: "Shuffling any single column did not change this model's balanced accuracy."

No new persisted UI state: the disclosure keeps its native open state while mounted, like the existing data tables.

**Accessibility:** each figure is named by its `<figcaption>`. The chart is decorative beside the data table (`aria-hidden` on the Plot SVG, as in `app-class-error-bars`), and the table carries every value with its sign. The section heading is an `<h2>`, matching the other `/results` sections. Keyboard: one disclosure stop per panel. Manual checks: VoiceOver with Safari reading one panel and its table; forced colours (bars keep a visible boundary, and the zero rule stays visible); 200% zoom and 320 px width with eight panels.

## Specification changes

- [ ] `specification/workflow-steps.md` §4: "Feature importance" follows instance agreement; it describes held-out grouped permutation, balanced accuracy, the shared axis and the status sentences. §Step 5 log: the importance notes. Status remains partial.
- [ ] `specification/machine-learning-orchestrator.md` §2: `StoredEvaluation` version 2 with `featureImportance`, decoding versions 1–2 with drop-not-reject, and the `onModel` importance collector.
- [ ] `specification/components/results-comparison.md`: the `app-feature-importance` row in §3, the `FeatureImportanceLabels` contract, the statuses in §4, accessibility and manual checks in §6, the `CFI-*` criteria in §8, stories in §9 and files in §10.
- [x] `specification/FUTURE.md` § Product, "Richer feature importance" (added at planning on 2026-11-26 at the user's request): the note's heatmap with per-model normalisation, ranks and disagreement sort; Section 6 importance; tree MDI versus permutation; correlated-column warnings (needs `web-ml` association diagnostics); effect plots (ALE/PDP/ICE); local explanations; counterfactuals; a decision-boundary explorer; feature-sliced error analysis; a top-N toggle, relative share and tooltips; a configurable repeat count (the note suggests 10). T5 checks the entry still matches what shipped.
- [ ] `specification/HUMAN.md`: (a) the upstream gate and (b) the Phase 6 revision were added at planning; T5 removes (a) once the gate has passed. T5 adds (c) D5 display arithmetic stays in `samata-ml`; (d) style the draft "Feature importance" section; (e) the manual assistive-technology checks.
- [ ] `specification/plans/README.md`: this plan's row and status.

## Implementation tasks

### T1 — Stored evaluation version 2 and decoder

- **Depends on:** None
- **Risk:** needs care — persisted contract; old results must keep decoding.
- **Likely files:** `src/types/model-evaluation.ts`, `src/features/results/evaluation-decoder.ts`, `tests/evaluation-decoder.test.ts`, `tests/fixtures/results/evaluations.ts`, `tests/fixtures/results/variants.ts`
- **Must not touch:** `node_modules/`, `vendor/web-ml/` — upstream release.
- **Implementation:** Add the Interfaces types with TSDoc and widen `schemaVersion` to `1 | 2`. In the decoder, accept versions 1 and 2. Decode `featureImportance` with a local helper that throws `Invalid` inside its own `try`/`catch` and returns `null` (D4). A version 1 evaluation decodes with `featureImportance: null`. Add `featureImportance` to the iris cross-validation fixture (3 columns, 5 folds, 5 repeats) and the breast-cancer One-Shot fixture (1 partition). Keep a version 1 variant.
- **Acceptance criteria:**
  - [ ] `CFI-SCHEMA-1` — A version 2 fixture decodes with every stored drop unchanged, and a version 1 fixture decodes with `featureImportance: null` and the other fields unchanged.
  - [ ] `CFI-SCHEMA-2` — Each invalid block (wrong length, non-finite drop, duplicate column, partition count mismatch, `nRepeats` 0, baseline outside [0, 1]) decodes to `featureImportance: null`, and the rest of the evaluation still decodes. Version 3 still returns `null`.
- **Verification:** `bun test tests/evaluation-decoder.test.ts`; `bun run check`
- **Progress:** [ ] Not started

### T2 — Worker importance collector, mapping and log notes

- **Depends on:** T1
- **Risk:** needs care — runs inside the awaited training hook and adds training time.
- **Likely files:** `src/features/models/training/importance-collector.ts`, `src/features/models/training/classifier-adapters.ts`, `src/features/models/training/training-worker.ts`, `src/features/models/training/evaluation-mapper.ts`, `src/features/models/training/protocol.ts`, `src/types/model-result.ts`, `src/features/models/app-training-progress.ts`, `src/features/models/app-model-builder-view.ts`, `tests/importance-collector.test.ts`, `tests/evaluation-mapper.test.ts`, `tests/classifier-adapters.test.ts`, `tests/training-protocol.test.ts`, `tests/training-runtime.e2e.ts`, `tests/fixtures/training/runtime.worker.ts`
- **Must not touch:** `src/features/results/` — display belongs to T3 and T4.
- **Implementation:** D2, D3 and D7 with the collector contract in Interfaces. `buildClassificationRequest` takes an optional `onModel` and sets it on both protocol requests. In `execute`:
  1. Create the collector with the real `permutationImportance`, `prepared`, the run signal and an `onNote` that resends the last sent progress with the note.
  2. Pass `collector.hook` as `onModel`.
  3. Hand `collector.finish()` to the snapshot.

  `mapEvaluation` writes `schemaVersion: 2` and `featureImportance` from its input. Measurement time goes only in the implementation log as evidence; no stored timing field is added.

- **Acceptance criteria:**
  - [ ] `CFI-WORKER-1` — With a fake `permutationImportance` and fake hook contexts (3 folds plus a refit, with one-hot names such as `["colour","blue"]`), the collector:
    - passes groups ordered by first appearance;
    - passes targets aligned to `validationIndices`, plus balanced-accuracy scoring, `nRepeats` 5, `randomState` 0 and the signal;
    - ignores the refit;
    - returns copies whose values survive mutation of the fake's output arrays.
  - [ ] `CFI-WORKER-2` — Each of these yields `finish() === null`, exactly one `importance-unavailable` note, and a hook that resolves without throwing: a throwing fake; a result of the wrong length; a missing `validationFeatures` on a fold; differing `featureNamesOut` between folds.
  - [ ] `CFI-WORKER-3` — `isTrainingLogMessage` accepts both new notes and rejects unknown keys. Step 5 renders both English sentences.
  - [ ] `CFI-WORKER-4` — In `tests/training-runtime.e2e.ts`, real `web-ml` training on iris (CV) and penguins (One-Shot) stores a version 2 evaluation with a valid `featureImportance`. Penguins' categorical columns appear once each, under their source names. Cancelling during measurement settles the run as cancelled.
- **Verification:** `bun test tests/importance-collector.test.ts`; `bun test tests/evaluation-mapper.test.ts`; `bun test tests/training-protocol.test.ts`; `bun run test:e2e tests/training-runtime.e2e.ts`; `bun run check`. Record importance time against total training time for iris, penguins and adult-census (KNN and MLP) in the implementation log.
- **Progress:** [ ] Not started

### T3 — View-model and `app-feature-importance`

- **Depends on:** T1
- **Risk:** routine
- **Likely files:** `src/features/results/feature-importance-view-model.ts`, `src/features/results/app-feature-importance.ts`, `src/features/results/app-feature-importance.stories.ts`, `tests/feature-importance-view-model.test.ts`, `tests/feature-importance.e2e.ts`
- **Must not touch:** `src/features/results/charts/plot-controller.ts` — shared controller; use only its existing mark kinds.
- **Implementation:** D5, D6 and D8 with the element contract in Interfaces. The bars use the same chart tokens as `app-class-error-bars`; negative bars use the next chart token. No literal colours. Logical properties only.
- **Acceptance criteria:**
  - [ ] `CFI-VM-1` — For hand-computed fixtures, mean, sample SD, rank (ties by source order) and the shared domain (including padding and the zero-span case) match. One-Shot rows have `sd: null`. Negative means stay negative.
  - [ ] `CFI-VM-2` — Version 1 gives `legacy`, a `null` block gives `unavailable`, all-zero means give `empty`, and `xDomain` is `null` when no panel is ready.
  - [ ] `CFI-UI-1` — A ready panel draws at most 15 bars ranked by mean, with whiskers only when `sd` is non-null. The data table lists every column with signed values. Negative bars sit left of the zero rule.
  - [ ] `CFI-UI-2` — Each non-ready status renders its status sentence and no chart. RTL and a 60-character column name render without clipping or horizontal page scroll at 320 px.
  - [ ] Stories: ready CV, ready One-Shot, negative values, more than 15 columns, legacy, unavailable, empty, Long label, RTL, with Do / Don't usage rules ("Do keep one shared axis across panels"; "Don't present the ranking as causal").
- **Verification:** `bun test tests/feature-importance-view-model.test.ts`; `bun run test:e2e tests/feature-importance.e2e.ts`; `bun run test:stories`; `bun test tests/style-tokens.test.ts`; `bun run check`
- **Progress:** [ ] Not started

### T4 — Compare Results section, mockup draft and journeys

- **Depends on:** T2, T3
- **Risk:** routine
- **Likely files:** `src/features/results/app-results-view.ts`, `src/features/results/app-results-view.stories.ts`, `tests/comparison-charts.e2e.ts`, `tests/comparison.e2e.ts`, `tests/a11y.e2e.ts`, `tests/helpers/seed-results.ts`, `tests/fixtures/results/comparison.ts`, `tests/fixtures/results/labels.ts`, `specification/mockups/04_compare-results.html`
- **Must not touch:** `specification/mockups/mockups.css` — human-owned.
- **Implementation:** Implement the connected view from Interfaces: messages in the `app-results-view` i18n block, the section after instance agreement, `repeat` keyed by `num`, and the `whenSettled` entry. Add a `<!-- {Feature importance} -->` draft section with its legacy-panel state to the 04 draft, with the multi-state comments of visual-design §1.1.
- **Acceptance criteria:**
  - [ ] `CFI-UI-3` — On `/results` with the iris pair, the section follows instance agreement and shows one panel per selected model in model order, with matching axis domains. Deselecting a model removes its panel.
  - [ ] `CFI-UI-4` — A pair where one result is downgraded to version 1 shows the legacy sentence for that model and a chart for the other. `whenSettled` resolves.
  - [ ] `CFI-UI-5` — `tests/a11y.e2e.ts` scans the populated comparison with the section and finds no new violations.
- **Verification:** `bun run test:e2e tests/comparison-charts.e2e.ts`; `bun run test:e2e tests/comparison.e2e.ts`; `bun run test:e2e tests/a11y.e2e.ts`; `bun run test:stories`; `bun run check`
- **Progress:** [ ] Not started

### T5 — Specification sync

- **Depends on:** T1, T2, T3, T4
- **Risk:** routine
- **Likely files:** `specification/workflow-steps.md`, `specification/machine-learning-orchestrator.md`, `specification/components/results-comparison.md`, `specification/FUTURE.md`, `specification/HUMAN.md`, `specification/plans/README.md`, `specification/plans/compare-feature-importance.md`
- **Must not touch:** `specification/plans/web-ml-phase-6-model-specific-results.md` — its revision is a separate planning session.
- **Implementation:** Tick every _Specification changes_ item. Remove HUMAN.md item (a) once the gate has passed.
- **Acceptance criteria:**
  - [ ] Every _Specification changes_ item is ticked, and `bun run plans:check` passes.
- **Verification:** `bun run plans:check specification/plans/compare-feature-importance.md`; `bun run lint`; `bun run build`; `bun run check`
- **Progress:** [ ] Not started

## Verification and definition of done

- [ ] All task acceptance criteria met.
- [ ] `bun run check`, `bun run lint`, `bun run build`, `bun run test:stories` and the listed `bun run test:e2e` files pass with no new failures.
- [ ] Accessibility (WCAG 2.2 AA) manual checks recorded: VoiceOver with Safari, forced colours, 200% zoom and 320 px width.
- [ ] Code review confirms that `samata-ml` never shuffles, predicts or scores, and that the hook cannot throw.
- [ ] Every _Specification changes_ item is ticked, and specifications match the implemented code.
- [ ] `bun run format` run on changed files; no changes outside the tasks' likely files.

## Risks and open questions

- **Blocking:** `web-ml` must publish, and `vendor/web-ml/` must carry, a release in which `permutationImportance` accepts (a) a balanced-accuracy scorer (request [`2026-11-23-01`](../../../web-ml/specification/requests/2026-11-23-01-balanced-accuracy-scoring-everywhere.md), status `planned`) and (b) grouped or raw-column permutation (request [`2026-11-26-grouped-permutation-importance.md`](../../../web-ml/specification/requests/2026-11-26-grouped-permutation-importance.md), decision receipt at `../web-ml/specification/requests/receipts/2026-11-26-grouped-permutation-importance.md`). Then: re-scout the release; pin the scorer name, the groups option (or raw-column form) and holdout `validationFeatures` in D1, D2 and Interfaces; then submit for review. Owner: `web-ml` planner, then the `samata-ml` planner.
- **Non-blocking:** The user placed this plan before Phase 6 (2026-11-26). Phase 6 (`ready-for-review`) also adds an `onModel` collector and bumps `StoredEvaluation` to version 2, so it must be revised before its review is accepted: schema version 3, decoding 1–3, and one hook that awaits this collector and Phase 6's in sequence. Phase 6 therefore waits behind this plan's upstream gate. Owner: planner (HUMAN.md).
- **Non-blocking:** Cost. Each fold adds `1 + columns × 5` predictions over its held-out rows. KNN on adult-census (about 48,000 rows) is the costliest, because each prediction compares every held-out row with every training row. T2 records the times. If importance exceeds the model's own training time on any sample dataset, record it in HUMAN.md; request `2026-11-23-13` (worker prediction) and a configurable repeat count (backlog) are the follow-ups. Owner: implementer, then human.
- **Non-blocking:** `chart-best-practices` (`ready`) changes model identification on `/results` charts. Whichever lands second applies the same model swatch and label convention to the panel title. Owner: implementer.
- **Non-blocking:** D5 keeps mean, SD and ranking arithmetic in `samata-ml` (HUMAN.md item, as Phase 6 D3). Correlated columns share importance, so a low bar does not mean a column is useless; the introductory text and backlog correlation warnings address this. Owner: human.

## Escalations

None.

## Review fixes

None.

## Implementation and verification log

| When (UTC) | Task | Agent (model) | Outcome / commands / evidence |
| ---------- | ---- | ------------- | ----------------------------- |
| —          | —    | —             | Not started                   |

## Plan review history

| Reviewed (UTC) | Agent (model) | Decision | Findings |
| -------------- | ------------- | -------- | -------- |

## Change log

| When (UTC)           | Change        | Reason                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-11-26T13:24:47Z | Initial draft | User request in session: feature importance as a Compare Results section, lean, before Phase 6. `codebase-scout` read the Compare view, training worker, decoder and `web-ml` 0.2.0 public contract. User decisions on 2026-11-26: balanced accuracy (wait for request 01), grouped shuffling (wait; filed request `2026-11-26-grouped-permutation-importance`), small multiples, always on with a progress note, before Phase 6. Source note `specification/notes/feature-importance.md`. |
