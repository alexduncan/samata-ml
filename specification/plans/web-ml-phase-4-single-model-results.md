# Phase 4: Display shared single-model metrics and visuals in Section 6

**Status:** draft | **Updated:** 2026-11-21T12:04:43Z
**Authors:** Google Antigravity (Gemini 4 Argon High), Claude Code (claude-opus-5-5), Codex (GPT-6) | **Created:** 2026-11-17T21:23:45Z
**Verified by:** — | **Verified:** — | **Verification:** pending
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour:** Phase 3 is implemented and archived. View Results acknowledges an already-published training result and focuses Section 6 on the same route through `app-model-builder-view.ts` L1776–1788 and `training-service.ts` L1071–1105. Section 6 still renders the pending notice (builder L2218–2224). The IndexedDB v1 envelope already contains protocol-specific results and fitted artefacts. There is no shared Section 6 view or `StoredEvaluation`.

**Target behaviour:** After Phase 3 training completes and the user selects **View Results**, Section 6 (`6. Model Results`) renders the **shared base** metrics and visuals that apply to every classifier ([metrics-and-visuals note §1 Shared Base](../notes/metrics-and-visuals.md)): balanced accuracy as the headline, raw accuracy with the zero-rule baseline delta, macro-F1, per-class precision and recall, outer-fold spread (SD and IQR) with a dot-and-interval strip, a binary confusion flowchart or a multiclass Classee strip, a "More metrics" disclosure (MCC, ROC-AUC, PR-AUC, log-loss, Brier, ECE), an interactive probability-threshold histogram for binary targets, a reliability diagram with a confidence histogram, and a train–test gap diagnostic card. Every value comes from `web-ml` and is persisted in a versioned `StoredEvaluation` that Phases 5–7 also read.

**Why:** Give learners an honest, imbalance-aware first view of one model (VISION §5, §8, §10) and fix the persisted evaluation contract and chart foundation once, so comparison (Phase 5), model-specific internals (Phase 6) and tuning results (Phase 7) extend it rather than reshape it.

## Scope

**In scope**

- Adding `@observablehq/plot@0.6.17` (`bun add`), nine `--chart-*` tokens and a shared Plot rendering controller.
- `StoredEvaluation` (`src/types/model-evaluation.ts`): a `samata-ml`-owned, versioned, structured-cloneable record of per-row outputs, per-partition and pooled reports, baselines and curves, plus its decoder, the partition fingerprint and fold aggregation (mean, sample SD, IQR).
- Extending the Phase 3 integration worker to request WR-1…WR-6 and WR-10 outputs from `web-ml` and persist `evaluation` inside the Phase 3 `ResultEnvelope`.
- `$modelResults` resource store and the persisted `ModelRecord.ui.results` state with one action.
- Section 6 components (`src/features/results/`): connected `app-model-results` and presentational `app-results-summary`, `app-fold-strip`, `app-class-metrics-table`, `app-confusion-matrix`, `app-confusion-flowchart`, `app-classee-strips`, `app-threshold-explorer`, `app-reliability-diagram`, with co-located stories.
- Updating draft `specification/mockups/ui-scaffold/drafts/03-7_train-models-5-results.html` to the Phase 4 structure; three-browser Playwright tests; reference journey extension.

**Out of scope**

- `/results` comparison (Phase 5: [web-ml-phase-5-model-comparison.md](web-ml-phase-5-model-comparison.md)); model-specific internals (Phase 6: [web-ml-phase-6-model-specific-results.md](web-ml-phase-6-model-specific-results.md)); tuning results (Phase 7: [web-ml-phase-7-hyperparameter-tuning.md](web-ml-phase-7-hyperparameter-tuning.md)).
- Normalised expected cost (NEC), subgroup fairness gaps (TODO-43), choosing the positive class for the threshold explorer, prediction latency, and hand-built SVG charts — added to `specification/FUTURE.md` in T9.
- Any metric, curve, baseline or fold computation in `samata-ml` (user decision 2026-11-19; see the umbrella ledger).

**Constraints and invariants**

- Every metric, curve, baseline, partition and per-row prediction comes from `web-ml` (umbrella [WR ledger](web-ml-classification-integration.md#scope)). `samata-ml` computes only fold aggregation (mean, sample SD, IQR), the partition fingerprint, unit conversions (e.g. percentages) and layout.
- Reported scores are out-of-sample: One-Shot test rows or outer-fold held-out rows. Training-partition reports appear only as the labelled generalisation gap.
- Stored metrics use the model's own prediction rule. The threshold explorer is exploratory: it never changes stored metrics, `ModelRecord.metrics` or Phase 5 comparisons.
- Strict TypeScript, Bun only, TSDoc on exported symbols, native semantic tables, WCAG 2.2 AA, British English, `@nanostores/i18n` (`COMPONENTS.md` §1, §7, §8). Colour is never the only carrier of meaning: every chart has text labels or positions that carry the same information, and a native data table alternative.
- Never read `../web-ml/src/**` or `../web-ml/specification/internals/`; never modify `../web-ml` or `node_modules/`; `bun.lock` changes only through T1's `bun add`.

## Required reading

- `specification/plans/web-ml-classification-integration.md` §Scope (WR ledger) — the upstream contract every task consumes.
- `specification/notes/metrics-and-visuals.md` §1 Shared Base and §3 A–B — source note (review below).
- `specification/notes/user-experience-decisions.md` §4 — post-training diagnostic card.
- [Phase 3 §Interfaces and behaviour](archive/web-ml-phase-3-model-training.md#interfaces-and-behaviour), T3–T5 — `ResultEnvelope`, worker protocol, `result-repository.ts`, Section 5 **View Results**.
- `specification/COMPONENTS.md` §2–§10; `specification/visual-design.md` §1.1, §2, §4, §6 — tiers, closed APIs, tokens, draft styling, Storybook.
- `specification/state-and-storage.md` §3, §5, §6; `specification/app-state-and-navigation.md` §6.4, §8.4 (`whenSettled`).
- `specification/mockups/ui-scaffold/drafts/03-7_train-models-5-results.html` — structure reference (rewritten in T8).
- Observable Plot API reference for `plot()`, `barX`, `dot`, `ruleX`, `rectY`/`binX`, `lineY`, accessibility options (`ariaLabel`, `ariaDescription`) — <https://observablehq.com/plot/>.

## Codebase context

- **Relevant specifications:** `specification/workflow-steps.md` §3.6 (Section 6, TODO), `specification/state-and-storage.md` §3 (`ModelRecord.metrics`, `ui`), `specification/TODO.md` TODO-02, TODO-21, TODO-41, TODO-43, `specification/VISION.md` §5, §8, §10, §11.
- **Relevant implementation:** `src/features/models/app-model-builder-view.ts` L1776–1788, L2085–2094 and L2218–2224 owns the View Results action, focus and Section 6 placeholder. `src/features/models/training/training-service.ts` L1071–1105 validates the exact acknowledged result before advancing; `src/features/models/training/result-repository.ts` L7–26 reads `model_results` by dataset and model number and checks identity. `src/types/model-result.ts` L13–20 and L50–89 defines run identity and the v1 strategy payloads. The worker entry `src/features/models/training/training.worker.ts` loads the versioned runtime through `training-worker.ts`; `protocol.ts` L42–46 defines the success reply.
- **Phase 3 contract:** The One-Shot adapter (`src/features/models/training/classifier-adapters.ts` L145–172) returns fitted model and preprocessor JSON plus a holdout report from one training attempt. The cross-validation payload keeps a separate full-data refit, folds and pooled diagnostics. The envelope carries source-row indices, class labels, run identity and `webMlRevision`. Phase 3 pins revision `623dd30d7899d8e281773bc593e44be815592693` in `scripts/build-model-assets.ts` L8; `scripts/build-assets.ts` L62–63 injects the corresponding worker URL and revision. See the archived plan for the verified public and executable asset hashes.
- **Candidate upstream contract (not landed):** `web-ml@0.1.0` revision `f552968462e49fe324679b82349123d161719c1b` has built public declarations and matching `specification/public-api/metrics.md` §Classifier evaluation. `dist/src/training/classifier-evaluation.d.ts` defines opt-in outputs, per-partition/pooled test reports, per-partition training reports and both baselines. `dist/src/training/cross-validate.d.ts` and `cross-validation.d.ts` expose opt-in `evaluation` for fixed and nested CV. `dist/src/training/holdout-validate.d.ts` exposes holdout evaluation and end-to-end duration, with neither fitted artefacts nor guaranteed fit-only duration. `TrainingClient.train` returns the fitted artefacts with its existing validation metrics, and `evaluateClassifier` returns only `ClassificationMetrics`. `dist/src/metrics/classification-curves.d.ts` exposes ROC, precision–recall, one-vs-rest, calibration, confusion matrix and threshold sweep. The existing Phase 3 build already verifies WR-10. Canonical upstream `main` (`d621123` at inspection), its stale generated declarations and the installed fallback cannot establish the candidate contract. The package version alone cannot identify a compatible build.
- **Tests and commands:** `tests/app-shell.e2e.ts`, `tests/a11y.e2e.ts`, `tests/style-tokens.test.ts`, `tests/journeys/iris-classification.e2e.ts`, `tests/journeys/penguins-classification.e2e.ts`. Record the `bun run check` baseline in the log before T1; the last recorded baseline (2026-11-17) was 220 pass, 0 fail, 31 files.
- **Web guidance:** `responsive-table` (keep native header relationships and place wide data tables in named keyboard-scrollable regions), `slider` (labelled native range with formatted `aria-valuetext` and visible readout). The chart caption and data-table disclosure use native `<figcaption>` and `<details>`/`<summary>`.
- **Visual reference:** Draft only — `specification/mockups/ui-scaffold/drafts/03-7_train-models-5-results.html` (normative `03-7_train-models-5-results.html` is empty). Outer accordion shell keeps `src/styles/train-model.styles.ts`; tables use `src/styles/table.styles.ts`; buttons `src/styles/button.styles.ts`; notices `src/styles/notification.styles.ts`. No parity entries (`visual-design.md` §1.1).
- **Domain skills:** `lit-architecture-planner` (this plan); `lit-component-implementer` for T1, T4–T8.
- **Assumptions requiring verification:** A landed build that combines the evaluation outputs and fitted artefacts for the same One-Shot fit. Verify the final public signatures, runtime revision and asset pins together. See Blocking.

### Review of the input notes

| Note item                                                                        | Decision in this plan                                                                                                                                          | Why                                                                                       |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Essential shared metrics and visuals                                             | All implemented.                                                                                                                                               | —                                                                                         |
| Optional MCC, ROC-AUC, PR-AUC, Brier, log-loss, threshold histogram, reliability | Implemented (user chose all on 2026-11-19).                                                                                                                    | —                                                                                         |
| nMCC                                                                             | Omitted; MCC only.                                                                                                                                             | nMCC = (MCC + 1)/2 adds a second number for the same quantity.                            |
| "Calibration loss"                                                               | Expected calibration error (ECE) from WR-6.                                                                                                                    | One named, defined quantity (Guo et al. 2017).                                            |
| NEC and subgroup fairness gap                                                    | `FUTURE.md`.                                                                                                                                                   | Need cost-ratio and protected-attribute specifications (TODO-43); user agreed 2026-11-19. |
| Inner-CV tuning stability; inner-CV selection matrix                             | Phase 7.                                                                                                                                                       | Exists only for tuned runs.                                                               |
| Fit/predict time                                                                 | Fit time per partition shown; prediction time omitted.                                                                                                         | `web-ml` reports fit `durationMs` only.                                                   |
| Outer-fold spread for One-Shot runs                                              | One dot, no interval, with the sentence "One test split: no spread is available. Nested cross-validation estimates variability."                               | Inventing spread (e.g. bootstrap) would be a `samata-ml` metric.                          |
| Contextualised confusion flowchart                                               | HTML proportional flow (two actual-class rows, each split into predicted outcomes sized by count) with sentence labels using the target name and class labels. | Plot has no Sankey mark; hand-built SVG is backlog (user decision).                       |
| UX note §4 diagnostic card                                                       | Shown when training balanced accuracy − test balanced accuracy ≥ 0.10; the "Compare with default/tuned range" action is deferred to Phase 7.                   | Gap needs WR-4; the comparison action needs tuning.                                       |

## Technical decisions

| Decision                                  | Chosen approach and rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Rejected alternative / trade-off                                                                                                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| D1 Ownership of numbers                   | `web-ml` produces partitions, per-row outputs, reports, baselines and curves (WR-1…WR-6, WR-10). `samata-ml` maps them into `StoredEvaluation` in the integration worker and computes only mean, sample SD (n − 1) and IQR (linear interpolation, Hyndman–Fan type 7) of per-partition values, plus the fingerprint.                                                                                                                                                                                                                                                                                    | `samata-ml` evaluation module (rejected by the user 2026-11-19: logic useful to other `web-ml` consumers belongs upstream).                                                      |
| D2 Persisted evaluation contract          | `StoredEvaluation` (Interfaces §A) is owned by `samata-ml`, versioned by `schemaVersion`, built from plain numbers, strings and typed arrays, and validated on read. Later phases add **optional** fields and bump `schemaVersion`; readers accept every earlier version and render "Train again to see …" for absent optional sections.                                                                                                                                                                                                                                                                | Storing raw `web-ml` result objects: upstream type changes would silently break stored results.                                                                                  |
| D3 One render path for both protocols     | One-Shot is one partition (`kind: 'holdout-test'`); cross-validation is K partitions (`kind: 'outer-fold'`). Every view reads pooled reports plus a partitions array, so no component branches on protocol except for wording.                                                                                                                                                                                                                                                                                                                                                                          | Separate layouts per protocol (Phase 4 stub's open question): duplicate components and diverging Phase 5 comparisons.                                                            |
| D4 Comparability key                      | `partitionFingerprint` = lowercase hex SHA-256 (`crypto.subtle.digest`) of the UTF-8 header `samata-eval-v1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | {protocol}                                                                                                                                                                       | {folds or testRatio} | {randomState} | {classLabels JSON}`followed by`sourceRowIndex`and`partitionIndex`bytes in ascending`sourceRowIndex` order. Equal fingerprints mean identical evaluation rows and partitions; Phase 5 groups by it. | Comparing settings only: a dataset reload with different eligible rows would look comparable. |
| D5 Chart library                          | Observable Plot `0.6.17` (exact pin; ISC licence; stable since 2025-02-14). Versions 0.6.18–0.6.19 were published 2026-11-03/05 after a 20-month gap and are left for a separate upgrade. Imported statically only by `plot-controller.ts`; T1 records the production bundle size before and after.                                                                                                                                                                                                                                                                                                     | Hand-built SVG (user moved it to the backlog); Vega-Lite (larger runtime, JSON grammar duplicates typed props).                                                                  |
| D6 Shared Plot controller (§3 authorised) | `src/features/results/charts/plot-controller.ts` exports `PlotController` (a Lit `ReactiveController`). It observes its container with `ResizeObserver`, resolves `--chart-*` tokens with `getComputedStyle(host)` into colour strings, and replaces the container's children with `Plot.plot({...options, width, style})` after each host update or resize. Defaults: `style: { background: 'transparent', color: 'inherit', fontFamily: 'inherit', fontSize: '0.875rem', overflow: 'visible' }`. Authorised under §3: four call sites in this plan and four more in Phase 5.                          | Plot in each element: four copies of resize/token logic. Passing `var(--…)` strings to Plot: SVG presentation attributes do not reliably resolve `var()` in all three engines.   |
| D7 Chart tokens                           | Add to the `/* App additions */` block of `css/root.css`: `--chart-1: var(--blue-700)`, `--chart-2: var(--amber-700)`, `--chart-3: var(--teal-700)`, `--chart-4: var(--purple-700)`, `--chart-5: var(--red-700)`, `--chart-6: var(--green-800)`, `--chart-neutral: var(--stone-600)`, `--chart-axis: var(--stone-700)`, `--chart-grid: var(--stone-200)`. Categories beyond six cycle; class identity is always also carried by text and table. `tests/chart-tokens.test.ts` asserts every token except `--chart-grid` reaches 3:1 against `--surface` (WCAG 1.4.11). The human may restyle (HUMAN.md). | Unaliased hex values: duplicate the palette and bypass the token guard. Red/green for correct/error: fails for common colour-vision deficiencies; Classee uses position instead. |
| D8 Chart accessibility pattern            | Each chart element renders `<figure>` → `<figcaption>` (title plus a one-sentence takeaway built by the connected component) → Plot output with `ariaLabel` = title and `ariaDescription` = takeaway → `<details><summary>` "Show data table" → native `<table>` with `<caption>` and `<th scope>`. A wide table scrolls inside a focusable `role="region"` named by its table caption, keeping the page within the viewport. Plot `title` channels give pointer tooltips only; no information is tooltip-only.                                                                                         | Canvas output; ARIA-only descriptions without a table (WAI complex-images tutorial recommends a long description or table).                                                      |
| D9 Number formatting                      | Presentational elements receive pre-formatted strings in view models plus a `formatValue: (value: number) => string` property for Plot tick labels; the connected element builds both from the i18n `$format` store.                                                                                                                                                                                                                                                                                                                                                                                    | Plot's default d3-format ticks: not localised (`COMPONENTS.md` §8).                                                                                                              |
| D10 Results UI state                      | `ModelRecord.ui.results: ModelResultsUi` (`thresholdIndex`, `classFilter`, `moreMetricsOpen`, persisted) through one action `setModelResultsUi(num, patch)`; open/closed state of "Show data table" disclosures is transient `@state`.                                                                                                                                                                                                                                                                                                                                                                  | Component-private threshold state: lost on reload (`state-and-storage.md` §5).                                                                                                   |
| D11 Many classes                          | When `classLabels.length > 20`, the confusion matrix and Classee strips show only rows whose true class matches `classFilter`; `null` shows the 20 classes with the largest support. All predicted-class columns remain.                                                                                                                                                                                                                                                                                                                                                                                | Rendering hundreds of rows: unreadable and slow.                                                                                                                                 |
| D12 No JSON layout loader                 | Section 6 shared sections are fixed per task type (binary vs multiclass) in `app-model-results`. Phase 6 adds the per-model registry `src/config/models/{model-id}-results.ts` required by `workflow-steps.md` §3.6.                                                                                                                                                                                                                                                                                                                                                                                    | The stub's validated JSON layout loader: generic machinery with one caller (`COMPONENTS.md` §3).                                                                                 |

### Interfaces and behaviour

#### A. `StoredEvaluation` (`src/types/model-evaluation.ts`)

```ts
/** Class labels exactly as the target column stores them. */
export type StoredClassLabel = string | number | boolean;

export type MetricUnavailableReason =
	| 'probabilities-unavailable'
	| 'unseen-validation-labels'
	| 'single-class'
	| 'not-applicable';

export type StoredMetric =
	| { readonly available: true; readonly value: number }
	| { readonly available: false; readonly reason: MetricUnavailableReason };

export interface StoredReport {
	readonly sampleCount: number;
	readonly accuracy: number;
	/** Macro recall. */
	readonly balancedAccuracy: number;
	readonly macroF1: number;
	readonly mcc: StoredMetric;
	readonly rocAuc: StoredMetric;
	readonly averagePrecision: StoredMetric;
	readonly logLoss: StoredMetric;
	readonly brier: StoredMetric;
	/** Each length K, `classLabels` order. */
	readonly precisionPerClass: Float32Array;
	readonly recallPerClass: Float32Array;
	readonly f1PerClass: Float32Array;
	readonly support: Uint32Array;
	readonly predictedCount: Uint32Array;
	/** Row-major K × K; rows = true class, columns = predicted class. */
	readonly confusionMatrix: Uint32Array;
}

export interface StoredPartition {
	readonly index: number;
	readonly kind: 'holdout-test' | 'outer-fold';
	readonly trainSampleCount: number;
	readonly testSampleCount: number;
	readonly fitDurationMs: number;
	readonly test: StoredReport;
	/** Training-partition report (WR-4). */
	readonly train: StoredReport;
	readonly baselines: { readonly mostFrequent: StoredReport; readonly stratified: StoredReport };
}

export interface StoredOutputs {
	/** Ascending dataset row indices of every evaluated row. */
	readonly sourceRowIndex: Uint32Array;
	readonly partitionIndex: Uint16Array;
	readonly trueIndex: Uint16Array;
	readonly predictedIndex: Uint16Array;
	/** rowCount × K, `classLabels` order; null when the model has no probabilities. */
	readonly probabilities: Float32Array | null;
	readonly probabilitySource: string | null;
}

export interface StoredCurves {
	/** 101 cutoffs 0.00…1.00 on the positive-class probability; binary with probabilities only. */
	readonly thresholdSweep: {
		readonly thresholds: Float32Array;
		readonly tp: Uint32Array;
		readonly fp: Uint32Array;
		readonly tn: Uint32Array;
		readonly fn: Uint32Array;
		readonly tpr: Float32Array;
		readonly fpr: Float32Array;
	} | null;
	/** Ten uniform bins: binary = positive class; multiclass = top-label confidence vs correctness. */
	readonly calibration: {
		readonly meanPredicted: Float32Array;
		readonly observed: Float32Array;
		readonly count: Uint32Array;
		readonly expectedCalibrationError: number;
	} | null;
	/** Binary: one curve; multiclass: one-vs-rest per class. Read by Phase 5. */
	readonly roc: readonly { readonly fpr: Float32Array; readonly tpr: Float32Array }[] | null;
	readonly precisionRecall:
		| readonly { readonly recall: Float32Array; readonly precision: Float32Array }[]
		| null;
}

export interface StoredEvaluation {
	readonly schemaVersion: 1;
	readonly protocol:
		| { readonly kind: 'one_shot'; readonly testRatio: number; readonly randomState: number }
		| {
				readonly kind: 'cross_validation';
				readonly folds: number;
				readonly randomState: number;
		  };
	readonly classLabels: readonly StoredClassLabel[];
	/** 1 for binary targets (web-ml's default positive label is the second class), otherwise null. */
	readonly positiveClassIndex: number | null;
	readonly partitionFingerprint: string;
	readonly partitions: readonly StoredPartition[];
	/** Pooled over every partition's test rows. */
	readonly pooled: {
		readonly test: StoredReport;
		readonly baselines: StoredPartition['baselines'];
	};
	readonly outputs: StoredOutputs;
	readonly curves: StoredCurves;
}
```

- Phase 3's `ResultEnvelope` gains a required `evaluation: StoredEvaluation`; T3 bumps the envelope version so Phase 3-only envelopes decode as **lost results**.
- `decodeStoredEvaluation(value: unknown): StoredEvaluation | null` (`src/features/results/evaluation-decoder.ts`) rejects: unknown `schemaVersion`; K < 2; K > 65 535; typed-array lengths inconsistent with K, row count or partition count; non-finite numbers; `partitionIndex` ≥ partitions length; `positiveClassIndex` present for K ≠ 2.
- `foldSummary(values: readonly number[]): { mean: number; sd: number | null; q1: number | null; median: number; q3: number | null; iqr: number | null }` (`src/common/evaluation/fold-statistics.ts`): `sd`, quartiles and `iqr` are `null` when `values.length < 2`; throws on an empty array or a non-finite value.
- `partitionFingerprint(input): Promise<string>` (`src/common/evaluation/partition-fingerprint.ts`) implements D4.
- `ModelRecord.metrics` on success: `{ balancedAccuracy, accuracy, macroF1 }` from `pooled.test`, plus `balancedAccuracySd` when partitions ≥ 2.

#### B. State (`src/types/state.ts`, `src/stores/app.store.ts`, `src/stores/model-results.store.ts`)

```ts
export interface ModelResultsUi {
	/** Index into `thresholdSweep.thresholds`; default 50 (0.50). */
	thresholdIndex: number;
	/** Selected true-class label (as `String(label)`) for > 20 classes, or null. */
	classFilter: string | null;
	moreMetricsOpen: boolean;
}
```

- `setModelResultsUi(num: number, patch: Partial<ModelResultsUi>): void` writes `models[i].ui.results`; the persister drops an invalid `ui.results` (integer `0..100`, string or null, boolean) to defaults without failing hydration.
- `$modelResults: MapStore<Record<number, ModelResultsResource>>` with `ModelResultsResource = { status: 'idle' | 'loading' | 'ready' | 'lost' | 'error'; evaluation: StoredEvaluation | null; error: string }`. Actions `loadModelResults(num)` and `retryModelResults(num)` read the envelope through Phase 3's `result-repository.ts`, decode it, and set `lost` when the envelope is missing or `decodeStoredEvaluation` returns `null`. A stale load (model changed or retrained) is discarded by comparing `ModelRecord.resultRevision`.

#### C. Components (`src/features/results/`, all Shadow DOM, `app-` prefix)

Every presentational element takes `labels: <Element>Labels = DEFAULT_<ELEMENT>_LABELS` (empty-string defaults, exported interface and constant) and owns no strings (`COMPONENTS.md` §8). Every chart element follows D8 and takes `formatValue: (value: number) => string = String`. View-model types live in `src/features/results/results-view-model.ts`, built by pure functions tested in `tests/results-view-model.test.ts`.

| Tag (tier)                                       | Properties (`attribute: false` unless stated)                                                                                                                         | Events (`bubbles: true, composed: true` — they cross the connected parent's shadow root)      | Notes                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app-model-results` (connected)                  | `modelNum: number` (attribute `model-num`, reflected: none)                                                                                                           | none                                                                                          | Reads `$appState`, `$modelResults`, `$format`; calls `loadModelResults` when the model is `trained` and `completedSteps` includes `results`; handles child events with `setModelResultsUi`. Public method `whenSettled(): Promise<void>` resolves once the resource is `ready`, `lost` or `error`. States: loading (`<progress>` with label), empty (not trained), lost, error (`role="alert"` + Retry), ready.                    |
| `app-results-summary` (presentational)           | `summary: ResultsSummaryView \| null = null`, `moreOpen = false`                                                                                                      | `app-results-more-toggle` `{ open: boolean }`                                                 | Run line (model, dataset, target, protocol, evaluated rows, fit time); headline `<dl>` (balanced accuracy primary, mean ± SD for CV; accuracy with most-frequent baseline and signed delta; macro-F1 in the headline for multiclass, in More metrics for binary; SD and IQR for CV); diagnostic card (`.notification`, not `role="alert"`) when the gap is ≥ 0.10; `<details>` More metrics with each unavailable metric's reason. |
| `app-fold-strip` (presentational, Plot)          | `series: readonly FoldSeries[] = []`, `baselines: readonly BaselineMark[] = []`, `domain: readonly [number, number] = [0, 1]`, `caption: ChartCaption \| null = null` | none                                                                                          | `FoldSeries = { id: string; label: string; values: readonly number[]; mean: number; sd: number \| null }`; `BaselineMark = { id: string; label: string; value: number }`. Dots per value, mean tick, ± SD rule, dashed baseline rules with direct labels. Phase 4 passes one series; Phase 5 passes several (planned reuse, not a hypothetical prop).                                                                              |
| `app-class-metrics-table` (presentational)       | `rows: readonly ClassMetricsRow[] = []`                                                                                                                               | none                                                                                          | Native table: class, support, precision, recall, F1 (pooled).                                                                                                                                                                                                                                                                                                                                                                      |
| `app-confusion-matrix` (presentational)          | `matrix: ConfusionMatrixView \| null = null`, `classFilter: string \| null = null`                                                                                    | `app-confusion-filter-change` `{ classFilter: string \| null }`                               | Native table, caption states row count and "test rows only"/"held-out rows"; labelled `<select>` filter rendered only when K > 20 (D11).                                                                                                                                                                                                                                                                                           |
| `app-confusion-flowchart` (presentational, HTML) | `flow: BinaryFlowView \| null = null`                                                                                                                                 | none                                                                                          | Binary only. `<ol>` of two actual-class rows; each row's outcomes are list items whose inline size uses `styleMap({ flexGrow: count })` and whose text is a full sentence, e.g. "38 rows with diagnosis Malignant were predicted Malignant (correct)". Correctness is shown by text and a check/cross icon with `aria-hidden`, not by colour alone.                                                                                |
| `app-classee-strips` (presentational, Plot)      | `strips: ClasseeView \| null = null`, `caption: ChartCaption \| null = null`                                                                                          | none                                                                                          | Multiclass. One horizontal row per shown true class: correct count to the right of zero in `--chart-neutral`; errors to the left, stacked by predicted class in `--chart-1…6` with segment text labels when wide enough; data table lists every non-zero cell.                                                                                                                                                                     |
| `app-threshold-explorer` (presentational, Plot)  | `explorer: ThresholdView \| null = null`, `thresholdIndex = 50`, `caption: ChartCaption \| null = null`                                                               | `app-threshold-change` `{ index: number }` (on `input`, throttled to one per animation frame) | Binary with probabilities. Histogram of positive-class probabilities (20 bins) faceted by true class, vertical rule at the threshold; labelled native `<input type="range" min="0" max="100" step="1">` with `aria-valuetext` = formatted threshold; A visible definition list shows TP/FP/TN/FN and TPR/FPR from `thresholdSweep` with dataset nouns; a sentence states that exploring does not change the stored scores.         |
| `app-reliability-diagram` (presentational, Plot) | `calibration: CalibrationView \| null = null`, `caption: ChartCaption \| null = null`                                                                                 | none                                                                                          | Line + dots of observed vs mean predicted per bin against the `y = x` diagonal (`--chart-neutral`, dashed), plus an aligned count histogram; ECE in the caption.                                                                                                                                                                                                                                                                   |

- `ChartCaption = { title: string; takeaway: string }`. Unavailable sections render one sentence with the reason (e.g. "Log loss and the threshold explorer are unavailable because this SVC was trained without probability estimates.").
- Section order in `app-model-results`: summary → fold strip → errors (flowchart **or** Classee, then confusion matrix and class metrics table) → threshold explorer (binary) → reliability diagram. Each block is a `<section>` with an `<h3>`; Section 6's `<h2>` stays in the builder.
- `app-model-builder-view` replaces the Section 6 pending branch with `<app-model-results model-num=…>` when the model is `trained` and Section 6 is active or complete; its existing `whenSettled` awaits `app-model-results.whenSettled()` when present.

## Specification changes

- [ ] `specification/workflow-steps.md` §3.6 — Section 6 shared results: sections, order, binary vs multiclass visuals, out-of-sample wording, threshold explorer semantics, diagnostic card rule, unavailable-metric wording; remove the TODO line; status remains partial.
- [ ] `specification/state-and-storage.md` §3, §6 — `ModelResultsUi`, `ModelRecord.metrics` keys, `StoredEvaluation` inside `ResultEnvelope`, decode-or-lost rule; status remains draft.
- [ ] `specification/machine-learning-orchestrator.md` — Evaluation outputs requested from `web-ml` (WR-1…WR-6, WR-10) and the mapping into `StoredEvaluation`.
- [ ] `specification/visual-design.md` §2 — the nine `--chart-*` tokens and the 3:1 rule; Observable Plot styling rules (D6–D8).
- [ ] `specification/COMPONENTS.md` §1 — chart library row (Observable Plot 0.6.17) and the authorised `PlotController`.
- [ ] `specification/components/model-results.md` (new) & `specification/README.md` — closed APIs, events, stories and a11y rules for the nine elements; status implemented.
- [ ] `specification/FUTURE.md` — NEC with cost-ratio slider; subgroup fairness gap; selectable positive class; prediction latency; hand-built SVG charts (replacing Observable Plot where a bespoke chart is clearer).
- [ ] `specification/TODO.md`, `specification/HUMAN.md` — TODO-02 resolved for classification shared results; TODO-41 chart-library part resolved; TODO-21 confirmed (`model_results` in `samata-db`); HUMAN items for styling the 03-7 draft and reviewing chart tokens.

## Implementation tasks

### T1 — Add Observable Plot, chart tokens and the shared Plot controller

- **Depends on:** None
- **Risk:** needs care — first chart dependency; Plot output must stay inside Shadow DOM, use resolved tokens and reflow at 320 px and 200% zoom in three engines.
- **Likely files:** `package.json`, `bun.lock`, `css/root.css`, `src/features/results/charts/plot-controller.ts`, `src/features/results/charts/plot-controller.stories.ts`, `.storybook/fixtures/plot-host.ts`, `tests/chart-tokens.test.ts`, `tests/plot-controller.e2e.ts`
- **Must not touch:** `node_modules/`, `src/features/models/`, `specification/mockups/` — no feature wiring yet.
- **Implementation:** Run `bun add @observablehq/plot@0.6.17` (exact). Add the D7 tokens to the `/* App additions */` block. Implement `PlotController` per D6: constructor `(host: ReactiveControllerHost & HTMLElement, getContainer: () => HTMLElement | null, getOptions: (tokens: ChartTokens, width: number) => PlotOptions | null)`; `ChartTokens` maps each D7 token name to its resolved string; disconnect the `ResizeObserver` in `hostDisconnected`; render nothing while width is 0. Add a story-only host in `.storybook/fixtures/` and a story proving one bar chart. Record `bun run build` bundle sizes before and after in the log.
- **Acceptance criteria:**
    - [ ] `WML-P4-CHART-1` — Every D7 token except `--chart-grid` has ≥ 3:1 contrast against `--surface`, computed from `css/root.css` hex values; `bun test tests/style-tokens.test.ts` still passes.
    - [ ] `WML-P4-CHART-2` — In Chromium, Firefox and WebKit the fixture host renders an `svg[aria-label]` inside its shadow root whose mark fills equal the resolved token colours; resizing the container to 320 px re-renders at the new width with no horizontal overflow; disconnecting the host stops re-rendering.
    - [ ] `WML-P4-CHART-3` — Source files contain no literal colours (token guard); Plot's inline `background` is `transparent` and font size is in `rem`.
- **Verification:** `bun test tests/chart-tokens.test.ts tests/style-tokens.test.ts`; `bun run test:e2e tests/plot-controller.e2e.ts`; `bun run test:stories`; `bun run build`; `bun run check`.
- **Progress:** [ ] Not started

### T2 — Define `StoredEvaluation`, its decoder, fold statistics and the partition fingerprint

- **Depends on:** T1
- **Risk:** needs care — the contract is shared by Phases 4–7; decoder gaps would let corrupt IndexedDB data crash views.
- **Likely files:** `src/types/model-evaluation.ts`, `src/features/results/evaluation-decoder.ts`, `src/common/evaluation/fold-statistics.ts`, `src/common/evaluation/partition-fingerprint.ts`, `tests/fixtures/results/evaluations.ts`, `tests/evaluation-decoder.test.ts`, `tests/fold-statistics.test.ts`, `tests/partition-fingerprint.test.ts`
- **Must not touch:** `src/common/storage/db.ts`, `src/features/models/training/` — persistence is wired in T3.
- **Implementation:** Implement Interfaces §A exactly. Fixtures (built by hand, not computed): `irisCrossValidation` (K = 3, 5 folds, probabilities), `breastCancerOneShot` (binary, probabilities, sweep, calibration), `svcBinaryNoProbabilities` (probability metrics unavailable, curves null), `manyClasses` (K = 25).
- **Acceptance criteria:**
    - [ ] `WML-P4-EVAL-1` — Each fixture decodes to an equal value; each listed rejection rule returns `null` for a minimally corrupted copy; a `schemaVersion: 2` value with extra optional fields decodes once Phase 5–7 versions are registered (test documents the extension rule with a stub version list).
    - [ ] `WML-P4-EVAL-2` — `foldSummary` matches hand-computed values for `[0.8, 0.9, 1]` (mean 0.9, SD 0.1, Q1 0.85, Q3 0.95, IQR 0.1) and a 5-value case; one value gives `sd`/`iqr` `null`; empty and non-finite inputs throw.
    - [ ] `WML-P4-EVAL-3` — The fingerprint is stable across runs, independent of input row order, changes when any partition index, the seed or the class order changes, and equals a committed hex string for the iris fixture.
- **Verification:** `bun test tests/evaluation-decoder.test.ts tests/fold-statistics.test.ts tests/partition-fingerprint.test.ts`; `bun run check`.
- **Progress:** [ ] Not started

### T3 — Request `web-ml` evaluation outputs in the worker and persist `evaluation`

- **Depends on:** T2
- **Risk:** needs care — the runtime upgrade and One-Shot artefact contract remain unresolved. Preserve Phase 3 progress, cancellation, locking and publication semantics.
- **Likely files:** `src/types/model-result.ts`, `src/features/models/training/training.worker.ts`, `src/features/models/training/classifier-adapters.ts`, `src/features/models/training/evaluation-mapper.ts`, `src/features/models/training/result-repository.ts`, `src/stores/app.store.ts`, `tests/evaluation-mapper.test.ts`, `tests/model-results.test.ts`, `tests/classification-training.e2e.ts`
- **Must not touch:** `src/features/models/app-training-progress.ts`, `src/router/`, `node_modules/`
- **Implementation:** Integrate the final landed public evaluation calls and map their results in `evaluation-mapper.ts`. For fixed CV the candidate request uses `crossValidate` with `refit: true` and opt-in `evaluation: { outputs: true, reports: true, trainingReports: true, baselines: ['most-frequent', 'stratified'] }`. The candidate `holdoutValidate` cannot replace the existing One-Shot path because its return lacks the fitted artefacts. Before submission, specify the landed One-Shot call, how it preserves those artefacts from the same evaluated fit, the curve mapping, the deployment pin update and the legacy envelope policy. Keep the existing acknowledgement boundary.
- **Acceptance criteria:**
    - [ ] `WML-P4-EVAL-4` — The mapper output for fake One-Shot and five-fold results passes `decodeStoredEvaluation`; reports, outputs and curves are copied without recomputation (fake values that no formula would produce survive unchanged).
    - [ ] `WML-P4-EVAL-5` — Real training in the browser (iris five-fold Logistic Regression; breast-cancer One-Shot Gaussian NB; breast-cancer One-Shot SVC without probabilities) writes envelopes that decode, with `partitions.length` 5/1/1, probabilities null only for SVC, and `ModelRecord.metrics` equal to `pooled.test`.
    - [ ] `WML-P4-EVAL-6` — A Phase 3-only envelope (no `evaluation`) and a corrupt one load as `lost`; cancellation still writes no envelope.
- **Verification:** `bun test tests/evaluation-mapper.test.ts tests/model-results.test.ts`; `bun run test:e2e tests/classification-training.e2e.ts`; `bun run check`; `bun run build`.
- **Progress:** [ ] Not started

### T4 — Add `$modelResults`, `ModelResultsUi` and `setModelResultsUi`

- **Depends on:** T3
- **Risk:** routine
- **Likely files:** `src/types/state.ts`, `src/stores/app.store.ts`, `src/stores/persister.ts`, `src/stores/model-results.store.ts`, `tests/model-results-store.test.ts`, `tests/state-and-storage.test.ts`
- **Must not touch:** `src/features/`, `src/common/storage/db.ts`
- **Implementation:** Implement Interfaces §B. `loadModelResults` is idempotent while loading; `retryModelResults` resets `error` and reloads.
- **Acceptance criteria:**
    - [ ] `WML-P4-STATE-1` — `ui.results` round-trips through `localStorage`; invalid values fall back to defaults without discarding the model; no-op patches do not schedule writes.
    - [ ] `WML-P4-STATE-2` — Loading transitions `idle → loading → ready | lost | error`; a load superseded by retraining (`resultRevision` change) is ignored.
- **Verification:** `bun test tests/model-results-store.test.ts tests/state-and-storage.test.ts`; `bun run check`.
- **Progress:** [ ] Not started

### T5 — Build the summary, fold strip and per-class table elements

- **Depends on:** T1, T2
- **Risk:** needs care — headline wording must keep balanced accuracy primary and never present training scores as results.
- **Likely files:** `src/features/results/results-view-model.ts`, `src/features/results/app-results-summary.ts`, `src/features/results/app-results-summary.stories.ts`, `src/features/results/app-fold-strip.ts`, `src/features/results/app-fold-strip.stories.ts`, `src/features/results/app-class-metrics-table.ts`, `src/features/results/app-class-metrics-table.stories.ts`, `src/features/results/app-confusion-matrix.ts`, `src/features/results/app-confusion-matrix.stories.ts`, `tests/results-view-model.test.ts`, `tests/results-summary.e2e.ts`
- **Must not touch:** `css/root.css`, `src/stores/`
- **Implementation:** Implement the four elements and their view-model builders per Interfaces §C and D8–D11. Stories: `CrossValidation`, `OneShot`, `Binary`, `Multiclass`, `GapWarning`, `MetricsUnavailable`, `ManyClasses`, `LongLabel`, `RTL`, with Do/Don't docs ("Do read balanced accuracy first"; "Don't compare against training scores").
- **Acceptance criteria:**
    - [ ] `WML-P4-UI-1` — Headline shows balanced accuracy first; CV shows mean ± SD plus SD and IQR, One-Shot shows one value and the no-spread sentence; accuracy shows the most-frequent baseline and signed delta; the gap card appears at gap ≥ 0.10 and not at 0.099.
    - [ ] `WML-P4-UI-2` — Fold strip renders one dot per partition, a mean mark, an SD rule (CV only) and labelled dashed baselines; its data table lists every value; caption takeaway matches the view model.
    - [ ] `WML-P4-UI-3` — With K = 25 the confusion matrix shows a labelled filter and 20 rows by default; choosing a class fires `app-confusion-filter-change` once and shows one row; with K ≤ 20 no filter renders.
    - [ ] `WML-P4-UI-4` — Unavailable metrics show their reason text; no `NaN`, `undefined` or empty cells render for any fixture; RTL and long-label stories reflow at 320 px.
- **Verification:** `bun test tests/results-view-model.test.ts`; `bun run test:e2e tests/results-summary.e2e.ts`; `bun run test:stories`; `bun test tests/style-tokens.test.ts`; `bun run check`.
- **Progress:** [ ] Not started

### T6 — Build the binary flowchart and multiclass Classee strips

- **Depends on:** T5
- **Risk:** needs care — must convey correct versus incorrect without relying on colour.
- **Likely files:** `src/features/results/results-view-model.ts`, `src/features/results/app-confusion-flowchart.ts`, `src/features/results/app-confusion-flowchart.stories.ts`, `src/features/results/app-classee-strips.ts`, `src/features/results/app-classee-strips.stories.ts`, `tests/results-view-model.test.ts`, `tests/results-errors.e2e.ts`
- **Must not touch:** `css/root.css`, `src/stores/`
- **Implementation:** Per Interfaces §C. Flowchart sentences use the target column name and class labels. Classee rows follow `classLabels` order, filtered per D11. Stories: `Binary`, `PerfectModel`, `AllOneClass`, `Multiclass`, `ManyClasses`, `LongLabel`, `RTL`.
- **Acceptance criteria:**
    - [ ] `WML-P4-UI-5` — For the breast-cancer fixture the flowchart has two actual-class rows whose four outcome sentences contain the counts from `pooled.test.confusionMatrix`; outcome widths are proportional (ratio within 2%); forced-colours emulation keeps every sentence and icon visible.
    - [ ] `WML-P4-UI-6` — For iris the Classee chart has three rows; correct counts are right of zero and errors left; the data table reproduces every non-zero off-diagonal cell; a model with zero errors shows "No errors" text instead of an empty left side.
- **Verification:** `bun test tests/results-view-model.test.ts`; `bun run test:e2e tests/results-errors.e2e.ts`; `bun run test:stories`; `bun run check`.
- **Progress:** [ ] Not started

### T7 — Build the threshold explorer and reliability diagram

- **Depends on:** T5
- **Risk:** needs care — slider keyboard behaviour, value text and announcement rate; exploratory values must never be confused with stored scores.
- **Likely files:** `src/features/results/results-view-model.ts`, `src/features/results/app-threshold-explorer.ts`, `src/features/results/app-threshold-explorer.stories.ts`, `src/features/results/app-reliability-diagram.ts`, `src/features/results/app-reliability-diagram.stories.ts`, `tests/results-view-model.test.ts`, `tests/results-probability.e2e.ts`
- **Must not touch:** `css/root.css`, `src/stores/`
- **Implementation:** Per Interfaces §C. Keep the visible readout in a regular definition list with no live-region role. The slider's `aria-valuetext` carries the formatted threshold while the readout updates in place. Stories: `Binary`, `ExtremeThresholds`, `NoProbabilities`, `Multiclass` (reliability only), `LongLabel`, `RTL`.
- **Acceptance criteria:**
    - [ ] `WML-P4-UI-7` — Arrow keys move the threshold by 0.01 and Home/End reach 0 and 1; each change emits one `app-threshold-change` per frame; counts and rates equal `thresholdSweep` at the index; the rule moves to the threshold.
    - [ ] `WML-P4-UI-8` — Without probabilities both elements render the unavailable sentence and no slider; multiclass hides the explorer and shows top-label reliability with ECE in the caption.
    - [ ] `WML-P4-UI-9` — The "does not change the stored scores" sentence is always visible next to the slider; reduced-motion emulation shows no transitions.
- **Verification:** `bun test tests/results-view-model.test.ts`; `bun run test:e2e tests/results-probability.e2e.ts`; `bun run test:stories`; `bun run check`.
- **Progress:** [ ] Not started

### T8 — Wire `app-model-results` into Section 6, update the draft and journeys

- **Depends on:** T4, T5, T6, T7
- **Risk:** needs care — builder view `whenSettled`, focus and existing builder tests must keep passing.
- **Likely files:** `src/features/results/app-model-results.ts`, `src/features/results/app-model-results.stories.ts`, `src/features/models/app-model-builder-view.ts`, `src/features/models/app-model-builder-view.stories.ts`, `specification/mockups/ui-scaffold/drafts/03-7_train-models-5-results.html`, `tests/helpers/seed-results.ts`, `tests/model-results.e2e.ts`, `tests/a11y.e2e.ts`, `tests/journeys/iris-classification.e2e.ts`, `tests/journeys/penguins-classification.e2e.ts`
- **Must not touch:** `css/root.css`, `src/features/models/app-models-view.ts`, `src/app.ts`
- **Implementation:** Implement `app-model-results` per §C, binding child events to `setModelResultsUi`. Replace the Section 6 pending branch in the builder. Rewrite the 03-7 draft (keep its header comment format) to the Phase 4 section order with Palmer Penguins sample data, binary breast-cancer variants and the loading/empty/lost/error states; remove its comparison and Random Search sections (Phases 5 and 7 own them). `seed-results.ts` writes a fixture envelope and state through `page.evaluate`. Extend both journeys to train, open Section 6, and check the headline and Classee chart.
- **Acceptance criteria:**
    - [ ] `WML-P4-UI-10` — A seeded trained model shows Section 6 with every shared section in order; a seeded lost envelope shows the retrain message with configuration intact; an error shows `role="alert"` and Retry recovers.
    - [ ] `WML-P4-UI-11` — The threshold, class filter and More metrics state survive reload; `whenSettled` resolves after results load so scroll restoration lands on the same section.
    - [ ] `WML-P4-UI-12` — `tests/a11y.e2e.ts` scans a populated binary and multiclass Section 6 with no new findings; keyboard order is summary → charts' data-table toggles → slider; 320 px and 200% zoom reflow without horizontal scrolling of the page.
    - [ ] `WML-P4-UI-13` — `JOURNEY-IRIS-RESULTS` and `JOURNEY-PENGUINS-RESULTS` train real models and reach a populated Section 6 in Chromium, Firefox and WebKit.
- **Verification:** `bun run test:e2e tests/model-results.e2e.ts tests/a11y.e2e.ts tests/journeys/iris-classification.e2e.ts tests/journeys/penguins-classification.e2e.ts tests/models-setup.e2e.ts`; `bun run test:stories`; `bun test tests/style-tokens.test.ts`; `bun run check`; `bun run build`.
- **Progress:** [ ] Not started

### T9 — Sync specifications for Phase 4

- **Depends on:** T1, T2, T3, T4, T5, T6, T7, T8
- **Risk:** routine
- **Likely files:** `specification/workflow-steps.md`, `specification/state-and-storage.md`, `specification/machine-learning-orchestrator.md`, `specification/visual-design.md`, `specification/COMPONENTS.md`, `specification/components/model-results.md`, `specification/README.md`, `specification/FUTURE.md`, `specification/TODO.md`, `specification/HUMAN.md`, `specification/plans/README.md`, `specification/plans/web-ml-phase-4-single-model-results.md`
- **Must not touch:** `src/`, `tests/`, `specification/mockups/`, `specification/notes/` — the metrics note is deleted by Phase 7, its last consumer.
- **Implementation:** Apply every item under _Specification changes_.
- **Acceptance criteria:**
    - [ ] Every item under _Specification changes_ is applied and ticked.
    - [ ] `bun run plans:check` and `bun run plans:task specification/plans/web-ml-phase-4-single-model-results.md --check-complete` pass.
- **Verification:** `bun run plans:check specification/plans/web-ml-phase-4-single-model-results.md`; `bun run plans:task specification/plans/web-ml-phase-4-single-model-results.md --check-complete`; `bun run check`.
- **Progress:** [ ] Not started

## Verification and definition of done

- [ ] All task acceptance criteria met with test names starting with `WML-P4-*` or the journey IDs.
- [ ] `bun run check`, `bun run build`, `bun run test:stories` and the listed Playwright suites pass in Chromium, Firefox and WebKit with no new failures.
- [ ] No metric, curve, baseline or partition is computed in `samata-ml` (code review of `src/` against D1).
- [ ] WCAG 2.2 AA manual checks recorded: screen-reader reading of one chart figure and its table (VoiceOver/Safari), keyboard-only threshold exploration, forced colours, 200% zoom.
- [ ] `bun run format` run on every changed file; every _Specification changes_ item ticked.

## Risks and open questions

- **Blocking:** The existing [evaluation request](../../../web-ml/specification/requests/2026-11-21-classifier-evaluation-outputs-baselines-and-curves.md) is planned upstream. The [same-fit holdout artefact request](../../../web-ml/specification/requests/2026-11-21-holdout-evaluation-fitted-artefacts.md) records the remaining library capability. The candidate exposes WR-1–WR-6 and WR-10, but its One-Shot entry point returns evaluation without the model and preprocessor that Phase 3 persists from that fit. It is on the upstream plan branch and has no landed, verified release revision. Decide whether to keep the full One-Shot and Cross-Validation scope and wait for a verified upstream build with the same-fit artefacts (recommended), or ship the available results in a smaller first increment and defer the shared One-Shot evaluation. Before submission, rescout the selected build and reconcile T2–T4 with Phase 3’s v1 envelopes, run identity, publication and frozen deployment pin.
- **Non-blocking:** Observable Plot sizes margins in pixels; long class labels at 200% zoom may need wider margins. Mitigation: `PlotController` sets margins from measured label length; manual check in T8. Owner: implementer.
- **Non-blocking:** Draft `03-7_train-models-5-results.html` and the nine chart tokens await human styling and review (`specification/HUMAN.md`).
- **Non-blocking:** Stored probabilities cost `rowCount × K × 4` bytes per model (about 0.6 MB for 50 000 rows and three classes). Acceptable for the sample catalogue; revisit with TODO-45's performance budget.

## Escalations

None.

## Review fixes

None.

## Implementation and verification log

| When (UTC)           | Task | Agent (model)                            | Outcome / commands / evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------- | ---- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-17T21:23:45Z | —    | Google Antigravity (Gemini 4 Argon High) | Stub split from `web-ml-classification-integration.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-11-19T08:47:35Z | —    | Claude Code (claude-opus-5-5)            | Planning: `codebase-scout` sweeps of `samata-ml` (builder Section 6, state, storage, tests, tokens, dependencies) and `web-ml@0.1.0` public declarations (metrics, CV, classifiers, tuning). `bun info @observablehq/plot` confirmed 0.6.17 release date and ISC licence. No product code changed.                                                                                                                                                                                                                                                              |
| 2026-11-21T07:59:05Z | —    | Claude Code (claude-opus-5-5)            | Upstream re-check: `codebase-scout` read `web-ml` public declarations (stale `dist/`, built 2026-11-19) and tracked `specification/public-api/` prose. WR-10 met in prose; WR-3 partial; WR-1, WR-2, WR-4, WR-5, WR-6 missing. Filed the upstream request linked under Blocking. No product code changed.                                                                                                                                                                                                                                                       |
| 2026-11-21T12:04:43Z | —    | Codex (GPT-6)                            | Scout compared the canonical upstream public assets, frozen Phase 3 dependency and candidate evaluation revision. The candidate adds WR-1–WR-6 and retains WR-10. Its holdout result omits fitted artefacts. The build is unlanded and its latest review commit records remaining allocation failures. Filed one additional upstream request for same-fit holdout artefacts. The active worktree has no TypeScript installation. The primary checkout typecheck fails against stale declarations, including missing `FittedRun` and `stratifiedTrainTestSplit`. |

## Plan review history

| Reviewed (UTC) | Agent (model) | Decision | Findings |
| -------------- | ------------- | -------- | -------- |

## Change log

| When (UTC)           | Change                                                  | Reason                                                                                                                                                                                                                                                                      |
| -------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-17T21:23:45Z | Initial stub                                            | Split from the monolithic integration plan.                                                                                                                                                                                                                                 |
| 2026-11-19T08:47:35Z | Expanded to a draft; comparison split out               | User split results into Phase 4 (shared single-model), Phase 5 (comparison) and Phase 6 (model-specific); decided `web-ml` owns folds and metrics, Observable Plot for charts, and all optional shared items in scope. File renamed from `web-ml-phase-4-model-results.md`. |
| 2026-11-21T07:59:05Z | Linked upstream request; recorded WR status             | The maintainer reported the `web-ml` requests implemented; the public contract still lacks WR-1–WR-6, so the gaps were filed as one upstream request. Blocking remains open.                                                                                                |
| 2026-11-21T12:04:43Z | Rechecked Phase 3 and the upstream evaluation candidate | Phase 3 is archived. The open dependency is a verified package that can supply both One-Shot evaluation and fitted artefacts for the same fit.                                                                                                                              |
