# Spec for Model Results

**Status:** implemented · Tier: **Connected component** (`app-model-results`) composing eight **presentational components**

## 1. Summary and responsibility

The numbered route shows one trained classifier. The builder owns the route heading and large number swatch. The connected `app-model-results` reads the current run from `$modelResults`, builds preformatted view models and passes them to eight shared elements: `app-results-summary`, `app-fold-strip`, `app-class-metrics-table`, `app-confusion-matrix`, `app-confusion-flowchart`, `app-classee-strips`, `app-threshold-explorer` and `app-reliability-diagram`. The training library supplies the evaluation numbers. See [Machine Learning Orchestrator](../machine-learning-orchestrator.md#stored-evaluation) and [workflow-steps §3.6](../workflow-steps.md#6-single-model-results).

## 2. Decision and rationale

- **One render path for both protocols.** One-Shot is a single partition and Cross-Validation has one per fold. Components read the pooled report and the partitions, so only wording differs by protocol.
- **Presentational elements own no strings.** Each takes a `labels` object with empty defaults. The connected element declares the `app-model-results` messages and builds every label, including sentence functions, so text, plurals and numbers follow the locale. Numbers shown by the summary, tables and flowchart are preformatted in the view model; chart elements receive `formatPercent` and `formatCount`.
- **Observable Plot through one controller.** The four chart elements draw through the shared `PlotController` ([COMPONENTS.md §4](../COMPONENTS.md#4-lit-practices-and-component-documentation)). Rejected: hand-built SVG for every chart and a JSON chart grammar. A Sankey-style flowchart is an HTML proportional bar because Plot has no such mark.
- **No layout loader.** The shared blocks are fixed per task type. Phase 6 adds the per-model registry for model-specific blocks.

## 3. Public API (closed)

| Element                   | Properties (`attribute: false` unless stated)                                                             | Events (all `bubbles` and `composed`)                     |
| ------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `app-model-results`       | `modelNum` (reflected `model-num`), `headingLevel: 2 \| 3` (default `3`), and `whenSettled()`             | none                                                      |
| `app-results-summary`     | `summary`, `moreOpen`, `labels`                                                                           | `app-results-more-toggle` `{ open }`                      |
| `app-fold-strip`          | `series`, `baselines`, `caption`, `formatPercent`, `labels`; method `whenSettled()`                       | none                                                      |
| `app-class-metrics-table` | `rows`, `labels`                                                                                          | none                                                      |
| `app-confusion-matrix`    | `matrix`, `classFilter`, `labels`                                                                         | `app-confusion-filter-change` `{ classFilter }`           |
| `app-confusion-flowchart` | `flow`, `caption`, `labels`                                                                               | none                                                      |
| `app-classee-strips`      | `strips`, `caption`, `formatCount`, `labels`; method `whenSettled()`                                      | none                                                      |
| `app-threshold-explorer`  | `explorer`, `thresholdIndex`, `caption`, `formatPercent`, `formatCount`, `labels`; method `whenSettled()` | `app-threshold-change` `{ index }`, at most one per frame |
| `app-reliability-diagram` | `calibration`, `caption`, `formatPercent`, `formatCount`, `labels`; method `whenSettled()`                | none                                                      |

The exported label interfaces include axis names, interval and baseline notes, descriptions, legend labels and live-status formatting where applicable; their exact typed fields are declared with each element. There are no slots, CSS parts or CSS properties. View-model types and their pure builders are in `src/features/results/results-view-model.ts`. `ChartCaption` is `{ title, takeaway }`. `whenSettled()` on the chart elements resolves when the chart has been drawn or abandoned (hidden or disconnected). It lets `app-model-results.whenSettled()` wait for the first visible render; see Open questions.

Fold strips show one dot per partition and a labelled mean ± standard-deviation interval; unordered model rows are never connected. The data table retains the full model and partition values.

`app-model-results.whenSettled()` resolves after the saved result reaches a terminal state for the current run and the visible charts have drawn. It resolves immediately without an active trained run and also when the run is superseded or the element is removed while waiting. The builder's own `whenSettled()` awaits it.

## 4. Usage

The numbered builder renders a single focusable `h1.model-results` with the number and the saved label or catalogue name, then supplies `.headingLevel=${2}` to the connected results host. Embedded presentations use the default h3. View Results from the provisional wizard replaces that visit with the numbered route. A direct numbered link to a trained model opens its result without a prior visit to the wizard. The connected host handles loading, legacy, lost, read error, empty and ready states.

**Training Details** is a native disclosure before the result blocks. The named table lists the model, saved target, selected feature names and count, strategy, training rows and held-out rows. One-Shot uses the saved partition counts. Cross-Validation gives each fold's training count and the pooled held-out count. Missing historical counts display as unavailable.

Display preferences persist per model through `setModelResultsUi`: the threshold index, the class filter and whether More metrics is open ([state-and-storage §5](../state-and-storage.md#5-ui-state-persistence-rule)). The ready view adds one native “What do these results terms mean?” disclosure after the summary, before the fold section. It starts closed, keeps its native open state while mounted and opens independently of More metrics and the chart tables. A fresh view starts closed. Cross-Validation includes the fold-mean definition, and binary results include the probability threshold definition. Other resource states have no disclosure. The “Show data table” disclosures are transient. Exploring the threshold never changes a stored score or `ModelRecord.metrics`.

## 5. Visual specification

The numbered heading and Training Details use the scoped port of [03-7](../mockups/03-7_train-models-5-results.html) and the shared swatch styles. The chart surfaces remain draft-only. Shared table, notification, button and results styles own the result blocks, chart figures and scroll regions. Chart marks use the existing chart tokens; class colours have direct labels and surface separators. The reliability plot is square and its aligned histogram uses stored bin totals; binary bins describe observed positive rate and multiclass bins top-label accuracy. ROC-AUC, average precision and ECE use 0–100% formatting. Flowchart outcomes use distinct outlines, fill and icons as well as colour. See [visual-design](../visual-design.md#3-where-mockup-css-lives-in-the-app).

## 6. Accessibility

- Every chart is a `figure` with a `figcaption` (title and one-sentence takeaway), the Plot output named by the title and described by the takeaway, and a "Show data table" `details` holding a native table with a caption and `th scope`. A wide table scrolls inside a focusable `role="region"` named by its caption. No information is tooltip-only.
- Plot's per-mark labels are removed by the controller; the chart is one `img` and the table carries the detail.
- The threshold is a labelled native range input from 0 to 100 with a formatted `aria-valuetext`. The readout is a definition list and the sentence that exploring does not change the stored scores stays visible beside it. A polite live region announces a committed change immediately and otherwise announces the latest value after 250 ms of inactivity. Arrow keys move one point; Home and End reach the ends.
- Tables use `contain: inline-size` on their scroll region so a wide matrix never widens the page at 320 px.
- The diagnostic gap card is a `.notification` without `role="alert"`; only the read-error message is an alert.
- The native summary adds one keyboard stop, preserves the marker and has a visible focus outline with a target at least 24 × 24 CSS px. A definition list presents full terms and expansions. The visible expansions accompany the `title` values for MCC, ROC-AUC and ECE.
- Automated axe scans cover binary and multiclass numbered results with every table and the definitions open. Safari showed term order, visible expansions, disclosure states and summary focus at browser zoom. Spoken chart and table output remains a results follow-up.

## 7. Internationalisation

`app-model-results` owns the strings (messages key `app-model-results`) and builds every presentational `labels` object. It registers the shared `RESULT_TERM_COPY` entries under `term.<id>.name`, `term.<id>.definition` and `term.<id>.expansion`. Counts use plural forms. Numbers use the application formatter: percentages with one decimal place, whole counts, seconds, percentage points and three-decimal scores. Layouts use logical properties, wrap long class names and shorten them on chart axes while the table carries the full name. Tested with `dir="rtl"`.

## 8. Acceptance criteria

`CHT-SINGLE-*`, `CHT-PROB-*` and `CHT-A11Y-*` cover chart encoding, responsive labels, descriptions, controls and live updates. Test names begin with the ID. `WML-P4-UI-1` to `WML-P4-UI-4` cover the summary, fold strip, confusion matrix and per-class table. `WML-P4-UI-5` and `WML-P4-UI-6` cover the flowchart and Classee strips. `WML-P4-UI-7` to `WML-P4-UI-9` cover threshold exploration and reliability. The numbered page, details table, persisted preferences and accessibility are exercised by `tests/model-results.e2e.ts`, `tests/a11y.e2e.ts`, and the Iris and Penguins journeys. The scroll-landing part of `WML-P4-UI-11` remains open (see Open questions).

`TERM-AC-6`, `TERM-AC-8` and `TERM-AC-9` exercise the single disclosure, unchanged metric reasons and other disclosures, and reflow. A six-row fixture distinguishes the 75% cross-validation fold mean and 25-point paired gap from the 83.3% pooled score.

## 9. Stories

Co-located `*.stories.ts` cover every element: CrossValidation, OneShot, Binary, Multiclass, GapWarning, MetricsUnavailable, ManyClasses, PerfectModel, AllOneClass, ExtremeThresholds, NoProbabilities, EmptyBin, Loading, Empty, Legacy, Lost, ReadError, LongLabel and RTL, each with Do and Don't guidance in the docs description. The ready, RTL and long-label stories open the definitions, and the non-ready stories check their absence.

## 10. Files

`src/features/results/` (elements, stories, view models, term copy, decoder and plot controller), `src/styles/results.styles.ts`, `src/stores/model-results.store.ts`, `src/types/model-evaluation.ts`, `src/common/evaluation/` and the numbered route in `src/features/models/app-model-builder-view.ts`.

## 11. Non-goals

Comparison across models (Phase 5), model-specific results (Phase 6), tuning results (Phase 7), cost-based metrics, subgroup fairness, a selectable positive class and hand-built SVG charts ([FUTURE.md](../FUTURE.md)). No metric, curve, baseline or fold is computed in the app.

## 12. Open questions

- **`whenSettled()` on the chart elements.** The plan's element table lists no methods for them, yet `app-model-results.whenSettled()` must wait for the first visible chart render. The method was added to the four Plot elements. Confirm, or specify another mechanism.
- **Scroll landing after reload.** The shell now awaits the builder's `whenSettled()` for document scroll restoration. Exact restoration inside named regions remains with [the scroll restoration follow-up](../plans/scroll-region-restoration.md).
