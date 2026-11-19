# Phase 5: Compare trained models on identical evaluation rows at `/results`

**Status:** draft | **Updated:** 2026-11-19T08:47:35Z
**Authors:** Claude Code (claude-opus-5-5) | **Created:** 2026-11-19T08:47:35Z
**Verified by:** — | **Verified:** — | **Verification:** pending
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour:** `src/app.ts` L57–66 renders `/results` as an inline light-DOM placeholder (`h1` "Compare Results", `section[data-testid="results-view"]`); it has no custom element, so it is absent from `WorkflowFocusView` (L24–28) and uses the document-adopted `pageHeaderStyles`. `tests/app-shell.e2e.ts` PH-AC-2 (L826–859) asserts the placeholder text (L855–857); FOCUS-AC-5 (L598–610) includes `/results`. `$canCompare` (`src/stores/predicates.ts` L28) is true at two or more trained models.

**Target behaviour:** `/results` renders a connected `app-results-view` that compares 2–8 trained models **evaluated on identical rows and partitions** (equal Phase 4 `partitionFingerprint`). It shows, without choosing a winner: a sortable table lens of balanced accuracy, macro-F1, MCC, accuracy, ROC-AUC, PR-AUC, log-loss, Brier, ECE, train–test gap, spread, error counts and fit time against most-frequent and stratified baselines; paired outer-fold dot plots; per-class error bars; a relative confusion matrix for a chosen pair; a Bayesian ROPE probability bar for a chosen pair of cross-validated models; and an instance-agreement chart. Models evaluated on different rows are listed in other groups and never mixed.

**Why:** Comparison is where learners make choices; it must expose trade-offs, uncertainty and practical equivalence rather than a single-score leaderboard ([metrics-and-visuals note §2](../notes/metrics-and-visuals.md); VISION §7, §10).

## Scope

**In scope**

- Comparison grouping by `partitionFingerprint`, default selection, and persisted `results.ui` state with one action.
- An analysis worker and store that call `web-ml`'s Bayesian correlated t-test (WR-9).
- Presentational elements `app-comparison-controls`, `app-comparison-table`, `app-model-pair-picker`, `app-class-error-bars`, `app-confusion-delta`, `app-rope-bar`, `app-instance-agreement`; a `paired` property on Phase 4's `app-fold-strip`.
- Connected `app-results-view` replacing the `/results` placeholder, adopting `pageHeaderStyles`, with `focusHeading` and `whenSettled`.
- New draft `specification/mockups/ui-scaffold/drafts/04_compare-results.html`; stories; three-browser Playwright tests; reference journeys extended to two models.

**Out of scope**

- Normalised expected cost with a cost-ratio slider, subgroup fairness, superimposed ROC/PR curves, multi-model reliability diagrams, Pareto trade-off scatter and decision-boundary galleries — `specification/FUTURE.md` (user decision 2026-11-19 on optional items). FP and FN counts are in scope.
- Comparing models across different evaluation rows; regression models; any automatic "best model" label.
- Single-model views (Phase 4), model internals (Phase 6), tuning (Phase 7).

**Constraints and invariants**

- Only models with equal `partitionFingerprint` are compared; paired statistics use partitions with equal `index`.
- Every score, baseline and the ROPE posterior come from `web-ml` (WR-3, WR-4, WR-5, WR-9). `samata-ml` computes only fold aggregation (Phase 4 `foldSummary`), counts of per-row correctness across models, and confusion-matrix differences (subtraction of stored `web-ml` matrices).
- No automatic winner: no bold maxima, crowns or "best" text. Sorting is a user action.
- Strict TypeScript, Bun only, TSDoc, WCAG 2.2 AA, British English, `@nanostores/i18n`; charts follow Phase 4 D8 (figure, caption takeaway, data table).

## Required reading

- `specification/plans/web-ml-classification-integration.md` §Scope (WR ledger: WR-1, WR-3, WR-4, WR-5, WR-9, WR-10).
- `specification/plans/web-ml-phase-4-single-model-results.md` §Technical decisions D1–D11, §Interfaces A–C — `StoredEvaluation`, `$modelResults`, `PlotController`, chart pattern, `app-fold-strip`.
- `specification/notes/metrics-and-visuals.md` §2 — source note.
- `specification/app-state-and-navigation.md` §4.3, §5.6, §6.5, §8.4 — `/results` notification, heading focus, comparison inputs, `whenSettled`.
- `specification/COMPONENTS.md` §2–§10; `specification/visual-design.md` §1.1, §6; `specification/components/page-header.md`.
- Benavoli, Corani, Demšar & Zaffalon (2017), "Time for a change: a tutorial for comparing multiple classifiers through Bayesian analysis", JMLR 18(77) §3–4 — ROPE interpretation and the default width 0.01.

## Codebase context

- **Relevant specifications:** `specification/workflow-steps.md` §4 (Compare Results, TODO), `specification/app-state-and-navigation.md` §6.5 (`results.ui` persisted), `specification/state-and-storage.md` §3 (`PersistedAppState.results: { ui }` L179 in `src/types/state.ts`), `specification/TODO.md` TODO-03.
- **Relevant implementation:** `src/app.ts` (`WorkflowFocusView` L24–28, `/results` placeholder L57–66, route mounts L51–73); `src/styles/page-header.styles.ts` (`pageHeaderStyles` L5, adopted in `src/styles/global.ts` L20; shadow-root views duplicate `.page-header` locally — `app-models-view` L36, `app-model-builder-view` L57); `src/stores/predicates.ts` (`$canCompare` L28); `src/features/models/app-models-view.ts` (Compare Results control). Phase 4 files: `src/stores/model-results.store.ts`, `src/types/model-evaluation.ts`, `src/features/results/charts/plot-controller.ts`, `src/features/results/app-fold-strip.ts`.
- **Tests and commands:** `tests/app-shell.e2e.ts` (L377 heading, FOCUS-AC-5 L598–610, PH-AC-1 L771–824, PH-AC-2 L826–859); `tests/visual-parity/map.ts` L382–397 (`/results` `page-header-h1`, `page-header-p`); `tests/sidebar-acceptance.e2e.ts` L10; `tests/a11y.e2e.ts` has no `/results` scan. Record the `bun run check` baseline before T1.
- **Web guidance:** `accessibility` (sortable table headers, names), `forms` (checkbox group with a count constraint, `<select>`), `html`. Sortable columns follow the WAI-ARIA APG sortable table example: header `<button>` inside `<th aria-sort>`.
- **Visual reference:** `specification/mockups/ui-scaffold/04_compare-results.html` page header only (parity entries L382–397 stay); content follows the new draft `drafts/04_compare-results.html` (draft-only, no new parity entries).
- **Domain skills:** `lit-component-implementer` for T3–T6.
- **Assumptions requiring verification:** WR-9's exact signature and whether `web-ml` exposes it as a pure function callable in a module worker.

### Review of the input note (§2)

| Note item                                                  | Decision                                                                                           | Why                                                                                |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Balanced hard-decision discrimination with dummy baselines | Table lens columns + two baseline rows.                                                            | —                                                                                  |
| Class-specific & cost-weighted error profile               | FP/FN counts (binary, relative to the positive class) and total errors (multiclass); NEC deferred. | NEC needs a cost specification (TODO-43); user accepted 2026-11-19.                |
| Generalisation stability & equivalence                     | SD, IQR, train–test gap columns; ROPE bar for one chosen pair.                                     | All-pairs ROPE matrices overload the page; the pair picker teaches the comparison. |
| Threshold-independent ranking, calibration                 | ROC-AUC, PR-AUC, log-loss, Brier, ECE columns (numbers only).                                      | Superimposed curves and reliability are optional items the user did not select.    |
| Operational efficiency & fairness                          | Fit time column; fairness deferred.                                                                | Prediction time unavailable; fairness needs TODO-43.                               |
| Paired raincloud / dot-and-interval                        | `app-fold-strip` with `paired` lines (no density "cloud").                                         | K ≤ 10 dots; a density estimate of ≤ 10 points misleads.                           |
| Instance agreement & ROPE bar (optional)                   | In scope (user selected).                                                                          | —                                                                                  |

## Technical decisions

| Decision                     | Chosen approach and rationale                                                                                                                                                                                                                                                                                                                                                                                                      | Rejected alternative / trade-off                                                                                                                |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| D1 Comparison groups         | `comparisonGroups(models, resources)` groups trained models with `ready` evaluations by `partitionFingerprint`. Default group: most models; tie → the group containing the lowest model `num`. Groups with one model are listed but disabled with the reason. Models with `lost`/`error` results are listed in a notice.                                                                                                           | Comparing by settings only, or mixing protocols with a warning: pairs scores from different rows (the draft's "Incompatible comparison" state). |
| D2 Selection                 | 2–8 models per group (`metrics-and-visuals` §2). Default: the first eight by `num`. Checkboxes beyond eight are disabled with a visible reason; fewer than two selected shows a notice and hides charts.                                                                                                                                                                                                                           | Unlimited selection: unreadable charts.                                                                                                         |
| D3 Baseline rows             | Baseline rows come from the first selected model's `pooled.baselines` (identical across a group because partitions and seeds are equal, WR-5/WR-10). The pure model asserts equality across selected models and shows "Baselines differ" diagnostics instead of a row if they do not.                                                                                                                                              | Recomputing baselines in `samata-ml`: forbidden (user decision).                                                                                |
| D4 ROPE                      | `web-ml` `bayesianCorrelatedTTest` (WR-9) on per-partition test balanced accuracy of models A and B, `testFraction = testSampleCount / (trainSampleCount + testSampleCount)` of partition 0, `rope` from `ComparisonUi.ropeWidth` (default 0.01, allowed 0.001–0.1, step 0.001). Only for `cross_validation` groups with ≥ 2 partitions; One-Shot groups show "Needs cross-validation folds". Called through a module worker (D5). | ROPE on pooled scores (no fold variance); frequentist paired t-test (overconfident with correlated folds — Nadeau & Bengio 2003).               |
| D5 Analysis worker           | `src/features/results/analysis.worker.ts` dynamically imports the Phase 3 `runtimeUrl` (`/vendor/web-ml/<revision>/index.js`) and answers typed `{ id, type: 'rope', a, b, rope, testFraction }` messages; `analysis-client.ts` wraps it with request IDs and abort. `$ropeAnalysis` (store) caches by `${fingerprint}                                                                                                             | ${a}                                                                                                                                            | ${b} | ${rope}` and debounces width changes by 250 ms. | Importing `web-ml` on the main thread: Phase 3 D1 keeps the runtime in workers to preserve relative worker/WASM URLs. |
| D6 Instance agreement        | For selected models in one group, `outputs.sourceRowIndex` arrays are equal (same fingerprint), so row `r` is correct for model `m` when `trueIndex[r] === predictedIndex[r]`. The chart counts rows by the number of selected models that were correct (0…M); "hard cases" = rows no model got right. Pure counting over stored `web-ml` predictions; no scores are computed.                                                     | Asking `web-ml` for agreement: an application-level view over several stored results, not a model metric.                                       |
| D7 Relative confusion matrix | `ΔCM = CM_A − CM_B` cell-wise on pooled `web-ml` matrices, rendered as a native table with signed counts and sentences ("Model 1 makes 3 fewer Chinstrap → Adelie errors than Model 2"). Diagonal cells are labelled "correct". Colour is supplementary to the sign and text.                                                                                                                                                      | Heatmap only: colour carries the sign.                                                                                                          |
| D8 Table lens                | Native `<table>`; each metric cell shows the formatted value and a decorative (`aria-hidden`) micro-bar whose inline size is a percentage of the column's range (`styleMap`). Lower-is-better columns state it in the header. Sorting via header `<button>` and `aria-sort`; sort state persisted.                                                                                                                                 | Plot for micro-bars: one SVG per cell is heavy and harder to make accessible.                                                                   |
| D9 Fold strip reuse          | Phase 4's `app-fold-strip` gains `paired = false`; when true, dots with the same partition index are joined by thin lines across series. Series are ordered by model `num`. The component spec is updated in T7.                                                                                                                                                                                                                   | A second strip component duplicating Plot setup.                                                                                                |
| D10 Persisted UI             | `PersistedAppState.results.ui: ComparisonUi` with one action `setComparisonUi(patch)`; invalid persisted values reset to defaults; selections referencing missing models are pruned on hydrate.                                                                                                                                                                                                                                    | Component state: lost on reload (`state-and-storage.md` §5).                                                                                    |

### Interfaces and behaviour

#### A. State (`src/types/state.ts`, `src/stores/app.store.ts`, `src/stores/comparison.store.ts`)

```ts
export type ComparisonColumn =
	| 'balancedAccuracy'
	| 'macroF1'
	| 'mcc'
	| 'accuracy'
	| 'rocAuc'
	| 'averagePrecision'
	| 'logLoss'
	| 'brier'
	| 'ece'
	| 'gap'
	| 'sd'
	| 'iqr'
	| 'falsePositives'
	| 'falseNegatives'
	| 'errors'
	| 'fitDuration';

export interface ComparisonUi {
	fingerprint: string | null;
	selected: number[];
	sort: { column: ComparisonColumn; direction: 'ascending' | 'descending' } | null;
	pairA: number | null;
	pairB: number | null;
	ropeWidth: number;
}
```

- `setComparisonUi(patch: Partial<ComparisonUi>): void`.
- `$comparison` (`computed` over `$appState`, `$modelResults`): `{ groups: ComparisonGroupView[]; activeGroup: ComparisonGroupView | null; unavailableModels: { num: number; reason: 'lost' | 'error' | 'loading' }[] }`. `loadComparisonResults()` calls Phase 4 `loadModelResults` for every trained model.
- `$ropeAnalysis` map store: `{ status: 'idle' | 'loading' | 'ready' | 'error'; pLeft: number; pRope: number; pRight: number }` per cache key; action `requestRope(key, input)`.
- Pure module `src/features/results/comparison-model.ts`: `comparisonGroups`, `defaultSelection`, `tableRows` (per model: pooled metrics, `foldSummary` of partition balanced accuracy, gap = pooled train − pooled test balanced accuracy, FP/FN for binary from pooled matrix with `positiveClassIndex`), `classErrorRows`, `confusionDelta`, `agreementCounts`.

#### B. Components (`src/features/results/`, `app-` prefix)

Presentational elements take `labels` with `DEFAULT_*_LABELS` and own no strings; chart elements follow Phase 4 D8 and take `formatValue`. Events bubble and are composed (they cross the connected view's shadow root).

| Tag (tier)                                      | Properties                                                                                                                                                | Events                                                                                                              | Notes                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app-results-view` (connected, route view)      | none                                                                                                                                                      | none                                                                                                                | Reads `$appState`, `$canCompare`, `$comparison`, `$ropeAnalysis`, `$format`. `static styles` include `pageHeaderStyles`. Public `focusHeading(signal: AbortSignal): Promise<void>` (COMPONENTS §5) and `whenSettled(): Promise<void>`. States: blocked (`!canCompare`, existing notification text and link), loading, no comparable group, ready. |
| `app-comparison-controls` (presentational)      | `groups: readonly GroupOptionView[]`, `fingerprint: string \| null`, `models: readonly ModelOptionView[]`, `selected: readonly number[]`                  | `app-comparison-group-change` `{ fingerprint: string }`; `app-comparison-selection-change` `{ selected: number[] }` | Labelled `<select>` (shown when > 1 group) with each group's protocol and model count; `<fieldset>`/`<legend>` of checkboxes; limit reason text referenced by `aria-describedby`.                                                                                                                                                                 |
| `app-comparison-table` (presentational)         | `rows: readonly ComparisonRowView[]`, `baselines: readonly ComparisonRowView[]`, `columns: readonly ComparisonColumnView[]`, `sort: ComparisonUi['sort']` | `app-comparison-sort-change` `{ sort: ComparisonUi['sort'] }`                                                       | D8. Baseline rows are visually separated and labelled "Baseline"; columns that do not apply (FP/FN for multiclass) are omitted, not blank.                                                                                                                                                                                                        |
| `app-fold-strip` (Phase 4, extended)            | adds `paired = false`                                                                                                                                     | none                                                                                                                | D9.                                                                                                                                                                                                                                                                                                                                               |
| `app-class-error-bars` (presentational, Plot)   | `rows: readonly ClassErrorRowView[]`, `caption: ChartCaption \| null`                                                                                     | none                                                                                                                | Grouped horizontal bars: per true class, one bar per model of `1 − recall` (error rate), model identity by colour **and** direct label/legend text; data table.                                                                                                                                                                                   |
| `app-model-pair-picker` (presentational)        | `models: readonly ModelOptionView[]`, `pairA: number \| null`, `pairB: number \| null`                                                                    | `app-model-pair-change` `{ pairA: number; pairB: number }`                                                          | Two labelled `<select>`s; the same model cannot be chosen twice (the other option is disabled).                                                                                                                                                                                                                                                   |
| `app-confusion-delta` (presentational)          | `delta: ConfusionDeltaView \| null`                                                                                                                       | none                                                                                                                | D7; K > 20 uses the Phase 4 D11 class filter value passed in the view.                                                                                                                                                                                                                                                                            |
| `app-rope-bar` (presentational, Plot)           | `result: RopeView \| null`, `ropeWidth: number`, `status: 'idle' \| 'loading' \| 'ready' \| 'error' \| 'unavailable'`, `caption: ChartCaption \| null`    | `app-rope-width-change` `{ ropeWidth: number }`                                                                     | One stacked bar: P(A better), P(practically equivalent), P(B better) with percentage text in or beside each segment; labelled `<input type="number" min="0.001" max="0.1" step="0.001">` for the width; explanatory sentence; no p-values.                                                                                                        |
| `app-instance-agreement` (presentational, Plot) | `counts: AgreementView \| null`, `caption: ChartCaption \| null`                                                                                          | none                                                                                                                | Column chart of row counts for 0…M models correct; "hard cases" count in the caption; data table.                                                                                                                                                                                                                                                 |

- Page order: header → controls → table lens → paired fold strip (cross-validation groups; One-Shot groups show one dot per model and the no-spread sentence) → per-class error bars → pair picker → relative confusion matrix → ROPE bar → instance agreement → "No automatic winner is selected" sentence.
- `src/app.ts` mounts `<app-results-view>` for `/results` and adds it to `WorkflowFocusView`.

## Specification changes

- [ ] `specification/workflow-steps.md` §4 — Compare Results: grouping by identical evaluation rows, selection limits, sections and order, ROPE semantics, no-winner rule; remove the TODO line; status remains partial.
- [ ] `specification/app-state-and-navigation.md` §6.5 — `results.ui` shape (`ComparisonUi`) and pruning rule; `/results` view contract (`focusHeading`, `whenSettled`).
- [ ] `specification/state-and-storage.md` §3 — `ComparisonUi` in `PersistedAppState.results`.
- [ ] `specification/machine-learning-orchestrator.md` — analysis worker protocol and WR-9 call.
- [ ] `specification/components/results-comparison.md` (new), `specification/components/model-results.md` (`app-fold-strip.paired`) & `specification/README.md` — closed APIs; status implemented.
- [ ] `specification/FUTURE.md` — superimposed ROC/PR curves; multi-model reliability; Pareto scatter; decision-boundary gallery; NEC cost slider in comparison.
- [ ] `specification/TODO.md`, `specification/HUMAN.md` — TODO-03 resolved for classification; HUMAN item to style `drafts/04_compare-results.html`.

## Implementation tasks

### T1 — Comparison model, grouping and persisted comparison state

- **Depends on:** None
- **Risk:** needs care — grouping errors would compare different rows; persisted selections must survive model and dataset changes.
- **Likely files:** `src/types/state.ts`, `src/stores/app.store.ts`, `src/stores/persister.ts`, `src/stores/comparison.store.ts`, `src/features/results/comparison-model.ts`, `tests/fixtures/results/comparison.ts`, `tests/comparison-model.test.ts`, `tests/state-and-storage.test.ts`
- **Must not touch:** `src/features/results/app-*.ts`, `src/app.ts`
- **Implementation:** Implement Interfaces §A and D1–D3, D6–D7. Fixtures extend Phase 4's: three iris five-fold models sharing a fingerprint, one iris One-Shot model, one model with a different seed, one lost model, and two binary models.
- **Acceptance criteria:**
    - [ ] `WML-P5-MODEL-1` — Grouping yields the expected groups and default group; single-model groups are disabled with a reason; lost models appear in `unavailableModels`.
    - [ ] `WML-P5-MODEL-2` — `tableRows` copies pooled `web-ml` values unchanged, computes SD/IQR with Phase 4 `foldSummary`, gap as pooled train − test balanced accuracy, and FP/FN from the pooled matrix with `positiveClassIndex`; multiclass rows omit FP/FN.
    - [ ] `WML-P5-MODEL-3` — `agreementCounts` and `confusionDelta` match hand-computed fixtures; mismatched `sourceRowIndex` arrays throw (a defensive check that fingerprints prevent in practice).
    - [ ] `WML-P5-STATE-1` — `ComparisonUi` round-trips; selections of deleted models are pruned on hydrate; more than eight selected values are truncated; invalid ROPE widths reset to 0.01.
- **Verification:** `bun test tests/comparison-model.test.ts tests/state-and-storage.test.ts`; `bun run check`.
- **Progress:** [ ] Not started

### T2 — Analysis worker and ROPE store

- **Depends on:** T1
- **Risk:** needs care — depends on WR-9; the worker must load the same `web-ml` revision as Phase 3 and cancel stale requests.
- **Likely files:** `src/features/results/analysis.worker.ts`, `src/features/results/analysis-client.ts`, `src/features/results/analysis-protocol.ts`, `src/stores/comparison.store.ts`, `scripts/build-assets.ts`, `tests/analysis-protocol.test.ts`, `tests/analysis-worker.e2e.ts`
- **Must not touch:** `src/features/models/training/`, `node_modules/`
- **Implementation:** Per D4–D5. Add the worker entry to `scripts/build-assets.ts` alongside Phase 3's training worker. Protocol guards reject malformed messages.
- **Acceptance criteria:**
    - [ ] `WML-P5-ROPE-1` — In Chromium, Firefox and WebKit the worker returns `pLeft + pRope + pRight` within 1e-9 of 1 for fixture fold scores and equals `web-ml`'s direct output for the same input; a superseded request's response is ignored.
    - [ ] `WML-P5-ROPE-2` — Width changes are debounced (one request for five changes within 250 ms); One-Shot groups never post a request and report `unavailable`.
- **Verification:** `bun test tests/analysis-protocol.test.ts`; `bun run test:e2e tests/analysis-worker.e2e.ts`; `bun run build`; `bun run check`.
- **Progress:** [ ] Not started

### T3 — Controls, table lens and pair picker elements

- **Depends on:** T1
- **Risk:** needs care — sortable-header semantics, checkbox limits and long model names.
- **Likely files:** `src/features/results/app-comparison-controls.ts`, `src/features/results/app-comparison-controls.stories.ts`, `src/features/results/app-comparison-table.ts`, `src/features/results/app-comparison-table.stories.ts`, `src/features/results/app-model-pair-picker.ts`, `src/features/results/app-model-pair-picker.stories.ts`, `tests/comparison-controls.e2e.ts`
- **Must not touch:** `css/root.css`, `src/stores/`
- **Implementation:** Per Interfaces §B and D8. Stories: `TwoModels`, `EightModels`, `LimitReached`, `MultipleGroups`, `Binary`, `Multiclass`, `Sorted`, `LongLabel`, `RTL`; docs Do/Don't ("Do compare against the baselines"; "Don't read the top row as the winner").
- **Acceptance criteria:**
    - [ ] `WML-P5-UI-1` — Activating a header button cycles ascending → descending → unsorted, updates `aria-sort` on that header only and emits one event; baseline rows never move when sorting.
    - [ ] `WML-P5-UI-2` — With eight selected, unchecked boxes are disabled and the reason is announced via `aria-describedby`; unchecking re-enables them; the pair picker never allows A = B.
    - [ ] `WML-P5-UI-3` — No cell, header or row gets winner styling or text for any fixture; micro-bars are `aria-hidden` and every value is readable text; long model names wrap at 320 px.
- **Verification:** `bun run test:e2e tests/comparison-controls.e2e.ts`; `bun run test:stories`; `bun test tests/style-tokens.test.ts`; `bun run check`.
- **Progress:** [ ] Not started

### T4 — Paired fold strip, per-class error bars and relative confusion matrix

- **Depends on:** T1
- **Risk:** routine
- **Likely files:** `src/features/results/app-fold-strip.ts`, `src/features/results/app-fold-strip.stories.ts`, `src/features/results/app-class-error-bars.ts`, `src/features/results/app-class-error-bars.stories.ts`, `src/features/results/app-confusion-delta.ts`, `src/features/results/app-confusion-delta.stories.ts`, `tests/comparison-charts.e2e.ts`
- **Must not touch:** `css/root.css`, `src/stores/`, `src/features/results/app-model-results.ts`
- **Implementation:** Per D7, D9 and Interfaces §B. Add a `Paired` story to the existing fold-strip stories.
- **Acceptance criteria:**
    - [ ] `WML-P5-UI-4` — With `paired`, each partition index has one connecting line across M series; Phase 4 single-series stories render unchanged.
    - [ ] `WML-P5-UI-5` — Error bars show one bar per model per class with direct labels; the data table lists every value; forced colours keep labels visible.
    - [ ] `WML-P5-UI-6` — The relative confusion matrix shows signed counts and the sentence for the largest absolute off-diagonal difference; equal matrices show "No differences".
- **Verification:** `bun run test:e2e tests/comparison-charts.e2e.ts`; `bun run test:stories`; `bun run check`.
- **Progress:** [ ] Not started

### T5 — ROPE bar and instance-agreement chart

- **Depends on:** T1
- **Risk:** needs care — probability wording must not imply significance testing.
- **Likely files:** `src/features/results/app-rope-bar.ts`, `src/features/results/app-rope-bar.stories.ts`, `src/features/results/app-instance-agreement.ts`, `src/features/results/app-instance-agreement.stories.ts`, `tests/comparison-rope.e2e.ts`
- **Must not touch:** `css/root.css`, `src/stores/`
- **Implementation:** Per D4, D6 and Interfaces §B. Stories: `AClearlyBetter`, `Equivalent`, `Uncertain`, `Loading`, `Unavailable`, `Error`, `LongLabel`, `RTL`; agreement `ThreeModels`, `NoHardCases`.
- **Acceptance criteria:**
    - [ ] `WML-P5-UI-7` — The ROPE bar's three segment texts equal the rounded probabilities and sum to 100% after rounding (largest-remainder rounding); the width input rejects values outside 0.001–0.1 with an associated error message.
    - [ ] `WML-P5-UI-8` — Unavailable and error states show their sentence and no bar; the explanation sentence names both models and the width.
    - [ ] `WML-P5-UI-9` — The agreement chart has M + 1 columns summing to the evaluated row count; the caption states the hard-case count.
- **Verification:** `bun run test:e2e tests/comparison-rope.e2e.ts`; `bun run test:stories`; `bun run check`.
- **Progress:** [ ] Not started

### T6 — Connected `/results` view, shell wiring, draft and journeys

- **Depends on:** T2, T3, T4, T5
- **Risk:** needs care — replaces a shell route covered by focus, page-header parity and app-shell tests.
- **Likely files:** `src/features/results/app-results-view.ts`, `src/features/results/app-results-view.stories.ts`, `src/app.ts`, `specification/mockups/ui-scaffold/drafts/04_compare-results.html`, `tests/app-shell.e2e.ts`, `tests/comparison.e2e.ts`, `tests/a11y.e2e.ts`, `tests/helpers/seed-results.ts`, `tests/journeys/iris-classification.e2e.ts`, `tests/journeys/penguins-classification.e2e.ts`
- **Must not touch:** `css/root.css`, `tests/visual-parity/map.ts`, `src/features/models/app-models-view.ts`
- **Implementation:** Implement `app-results-view` per Interfaces §B, wire `/results` in `src/app.ts`, and add it to `WorkflowFocusView`. Update PH-AC-2 to assert the blocked notification instead of the placeholder text and keep PH-AC-1/FOCUS-AC-5 passing. Write the 04 draft (structure only, Palmer Penguins sample data, every state). Extend both journeys to train a second model and compare.
- **Acceptance criteria:**
    - [ ] `WML-P5-UI-10` — With fewer than two trained models `/results` shows the existing notification and link; with two comparable models every section renders in order; with only incomparable models the "different evaluation rows" notice lists each group.
    - [ ] `WML-P5-UI-11` — Group, selection, sort, pair and ROPE width survive reload; heading focus and scroll restoration work on `/results` (FOCUS-AC-5, PH-AC-1, PH-AC-2, `/results` parity entries pass).
    - [ ] `WML-P5-UI-12` — `tests/a11y.e2e.ts` scans a populated `/results` with no new findings; 320 px and 200% zoom reflow; keyboard reaches every control in visual order.
    - [ ] `WML-P5-UI-13` — `JOURNEY-IRIS-COMPARE` and `JOURNEY-PENGUINS-COMPARE` train two models with the same setup and reach a populated comparison in three browsers.
- **Verification:** `bun run test:e2e tests/comparison.e2e.ts tests/app-shell.e2e.ts tests/a11y.e2e.ts tests/visual-parity.e2e.ts tests/sidebar-acceptance.e2e.ts tests/journeys/iris-classification.e2e.ts tests/journeys/penguins-classification.e2e.ts`; `bun run test:stories`; `bun run check`; `bun run build`.
- **Progress:** [ ] Not started

### T7 — Sync specifications for Phase 5

- **Depends on:** T1, T2, T3, T4, T5, T6
- **Risk:** routine
- **Likely files:** `specification/workflow-steps.md`, `specification/app-state-and-navigation.md`, `specification/state-and-storage.md`, `specification/machine-learning-orchestrator.md`, `specification/components/results-comparison.md`, `specification/components/model-results.md`, `specification/README.md`, `specification/FUTURE.md`, `specification/TODO.md`, `specification/HUMAN.md`, `specification/plans/README.md`, `specification/plans/web-ml-phase-5-model-comparison.md`
- **Must not touch:** `src/`, `tests/`, `specification/mockups/`, `specification/notes/`
- **Implementation:** Apply every item under _Specification changes_.
- **Acceptance criteria:**
    - [ ] Every item under _Specification changes_ is applied and ticked.
    - [ ] `bun run plans:check` and `bun run plans:task specification/plans/web-ml-phase-5-model-comparison.md --check-complete` pass.
- **Verification:** `bun run plans:check specification/plans/web-ml-phase-5-model-comparison.md`; `bun run plans:task specification/plans/web-ml-phase-5-model-comparison.md --check-complete`; `bun run check`.
- **Progress:** [ ] Not started

## Verification and definition of done

- [ ] All acceptance criteria met with test names starting with `WML-P5-*` or the journey IDs.
- [ ] `bun run check`, `bun run build`, `bun run test:stories` and the listed Playwright suites pass in three browsers with no new failures.
- [ ] No score, baseline or posterior computed in `samata-ml`; no winner styling anywhere.
- [ ] Manual checks recorded: screen-reader reading of the table lens and ROPE bar; keyboard-only sorting and selection; forced colours; 200% zoom.
- [ ] `bun run format` run on changed files; every _Specification changes_ item ticked.

## Risks and open questions

- **Blocking:** Phase 4 must be `ready`, and `web-ml` must publish WR-9 (plus WR-1, WR-3, WR-4, WR-5, WR-10 consumed through Phase 4) in its public declarations and prose. Then re-scout WR-9's signature, update D4/D5 and T2, and submit for review.
- **Non-blocking:** With 2–3 outer folds the correlated t-test posterior is wide; the explanation sentence states the fold count. Owner: implementer (copy in T5).
- **Non-blocking:** Draft `04_compare-results.html` awaits human styling (`specification/HUMAN.md`).

## Escalations

None.

## Review fixes

None.

## Implementation and verification log

| When (UTC)           | Task | Agent (model)                 | Outcome / commands / evidence                                                                                                                                      |
| -------------------- | ---- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-11-19T08:47:35Z | —    | Claude Code (claude-opus-5-5) | Planning: `codebase-scout` verified `/results` placeholder, focus/parity tests, `$canCompare`, page-header adoption; no `web-ml` statistical tests exist in 0.1.0. |

## Plan review history

| Reviewed (UTC) | Agent (model) | Decision | Findings |
| -------------- | ------------- | -------- | -------- |

## Change log

| When (UTC)           | Change        | Reason                                                                                                                                                   |
| -------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-19T08:47:35Z | Initial draft | User split the former Phase 4 stub; comparison becomes Phase 5 on top of Phase 4's evaluation contract; ROPE and instance agreement selected 2026-11-19. |
