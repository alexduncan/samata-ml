# Spec for Model Results

**Status:** implemented · Tier: **Connected component** (`app-model-results`) composing eight **presentational components**

## 1. Summary and responsibility

Section 6 of the model builder shows the shared results of one trained classifier. `app-model-results` is the connected element. It reads the application state, the `$modelResults` resource and the number formatter, loads the saved evaluation for the model's current run, builds preformatted view models and passes them to eight presentational elements: `app-results-summary`, `app-fold-strip`, `app-class-metrics-table`, `app-confusion-matrix`, `app-confusion-flowchart`, `app-classee-strips`, `app-threshold-explorer` and `app-reliability-diagram`. The training library computes every number; the app displays them ([Machine Learning Orchestrator](../machine-learning-orchestrator.md#stored-evaluation)). The behaviour, order and wording of the blocks are in [workflow-steps §3.6](../workflow-steps.md). The [03-7 draft](../mockups/ui-scaffold/drafts/03-7_train-models-5-results.html) records the structure and awaits human styling.

## 2. Decision and rationale

- **One render path for both protocols.** One-Shot is a single partition and Cross-Validation has one per fold. Components read the pooled report and the partitions, so only wording differs by protocol.
- **Presentational elements own no strings.** Each takes a `labels` object with empty defaults. The connected element declares the `app-model-results` messages and builds every label, including sentence functions, so text, plurals and numbers follow the locale. Numbers shown by the summary, tables and flowchart are preformatted in the view model; chart elements receive `formatPercent` and `formatCount`.
- **Observable Plot through one controller.** The four chart elements draw through the shared `PlotController` ([COMPONENTS.md §4](../COMPONENTS.md#4-lit-practices-and-component-documentation)). Rejected: hand-built SVG for every chart and a JSON chart grammar. A Sankey-style flowchart is an HTML proportional bar because Plot has no such mark.
- **No layout loader.** The shared blocks are fixed per task type. Phase 6 adds the per-model registry for model-specific blocks.

## 3. Public API (closed)

| Element                   | Properties (`attribute: false` unless stated)                                                             | Events (all `bubbles` and `composed`)                     |
| ------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `app-model-results`       | `modelNum` (attribute `model-num`, reflected); method `whenSettled()`                                     | none                                                      |
| `app-results-summary`     | `summary`, `moreOpen`, `labels`                                                                           | `app-results-more-toggle` `{ open }`                      |
| `app-fold-strip`          | `series`, `baselines`, `caption`, `formatPercent`, `labels`; method `whenSettled()`                       | none                                                      |
| `app-class-metrics-table` | `rows`, `labels`                                                                                          | none                                                      |
| `app-confusion-matrix`    | `matrix`, `classFilter`, `labels`                                                                         | `app-confusion-filter-change` `{ classFilter }`           |
| `app-confusion-flowchart` | `flow`, `labels`                                                                                          | none                                                      |
| `app-classee-strips`      | `strips`, `caption`, `formatCount`, `labels`; method `whenSettled()`                                      | none                                                      |
| `app-threshold-explorer`  | `explorer`, `thresholdIndex`, `caption`, `formatPercent`, `formatCount`, `labels`; method `whenSettled()` | `app-threshold-change` `{ index }`, at most one per frame |
| `app-reliability-diagram` | `calibration`, `caption`, `formatPercent`, `formatCount`, `labels`; method `whenSettled()`                | none                                                      |

There are no slots, CSS parts or CSS properties. View-model types and their pure builders are in `src/features/results/results-view-model.ts`. `ChartCaption` is `{ title, takeaway }`. `whenSettled()` on the chart elements resolves when the chart has been drawn or abandoned (hidden or disconnected). It lets `app-model-results.whenSettled()` wait for the first visible render; see Open questions.

`app-model-results.whenSettled()` resolves after the saved result reaches a terminal state for the current run and the visible charts have drawn. It resolves immediately without an active trained run and also when the run is superseded or the element is removed while waiting. The builder's own `whenSettled()` awaits it.

## 4. Usage

The builder renders `<app-model-results model-num="N">` inside Section 6 when the model is trained and its results are acknowledged. It handles four resource states besides ready: loading (a labelled native `progress`), legacy (a Phase 3 result: a message and a link to Models), lost (a result that has gone missing since View Results) and error (an alert with Retry). The model must be trained for any state but empty.

Display preferences persist per model through `setModelResultsUi`: the threshold index, the class filter and whether More metrics is open ([state-and-storage §5](../state-and-storage.md#5-ui-state-persistence-rule)). The "Show data table" disclosures are transient. Exploring the threshold never changes a stored score or `ModelRecord.metrics`.

## 5. Visual specification

There is no normative mockup. The draft is structure only. Elements use `table.styles.ts`, `notification.styles.ts`, `button.styles.ts` and `src/styles/results.styles.ts` (chart figures, the data-table disclosure and the keyboard-scrollable table region) plus the nine chart tokens ([visual-design §2](../visual-design.md#2-tokens)). Chart marks use token colours; typography is inherited. Correct and incorrect flowchart outcomes differ by outline style (solid and dashed), a striped fill and an icon as well as colour. See the scoped chart allowance in [visual-design §1.1](../visual-design.md#11-draft-mockups).

## 6. Accessibility

- Every chart is a `figure` with a `figcaption` (title and one-sentence takeaway), the Plot output named by the title and described by the takeaway, and a "Show data table" `details` holding a native table with a caption and `th scope`. A wide table scrolls inside a focusable `role="region"` named by its caption. No information is tooltip-only.
- Plot's per-mark labels are removed by the controller; the chart is one `img` and the table carries the detail.
- The threshold is a labelled native range input from 0 to 100 with a formatted `aria-valuetext`. The readout is an ordinary definition list with no live region, and the sentence that exploring does not change the stored scores stays visible beside it. Arrow keys move one point; Home and End reach the ends.
- Tables use `contain: inline-size` on their scroll region so a wide matrix never widens the page at 320 px.
- The diagnostic gap card is a `.notification` without `role="alert"`; only the read-error message is an alert.
- Manual checks (WCAG 2.2 AA): VoiceOver in Safari reading one chart figure and its table; keyboard-only threshold exploration; forced colours; 200% zoom. Automated axe scans cover binary and multiclass Section 6 with every table open.

## 7. Internationalisation

`app-model-results` owns the strings (messages key `app-model-results`) and builds every presentational `labels` object. Counts use plural forms. Numbers use the application formatter: percentages with one decimal place, whole counts, seconds, percentage points and three-decimal scores. Layouts use logical properties, wrap long class names and shorten them on chart axes while the table carries the full name. Tested with `dir="rtl"`.

## 8. Acceptance criteria

Test names begin with the ID. `WML-P4-UI-1` to `WML-P4-UI-4` cover the summary, fold strip, confusion matrix and per-class table (`tests/results-view-model.test.ts`, `tests/results-summary.e2e.ts`); `WML-P4-UI-5` and `WML-P4-UI-6` the flowchart and Classee strips (`tests/results-errors.e2e.ts`); `WML-P4-UI-7` to `WML-P4-UI-9` the threshold explorer and reliability diagram (`tests/results-probability.e2e.ts`); `WML-P4-UI-10` to `WML-P4-UI-13` the connected Section 6, persisted preferences, accessibility and the Iris and Penguins journeys (`tests/model-results.e2e.ts`, `tests/a11y.e2e.ts`, `tests/journeys/`). The scroll-landing part of `WML-P4-UI-11` is not met; see Open questions.

## 9. Stories

Co-located `*.stories.ts` cover every element: CrossValidation, OneShot, Binary, Multiclass, GapWarning, MetricsUnavailable, ManyClasses, PerfectModel, AllOneClass, ExtremeThresholds, NoProbabilities, EmptyBin, Loading, Empty, Legacy, Lost, ReadError, LongLabel and RTL, each with Do and Don't guidance in the docs description.

## 10. Files

`src/features/results/` (the nine elements, their stories, `results-view-model.ts`, `evaluation-decoder.ts`, `charts/plot-controller.ts`), `src/styles/results.styles.ts`, `src/stores/model-results.store.ts`, `src/types/model-evaluation.ts`, `src/common/evaluation/`, and the Section 6 wiring in `src/features/models/app-model-builder-view.ts`.

## 11. Non-goals

Comparison across models (Phase 5), model-specific results (Phase 6), tuning results (Phase 7), cost-based metrics, subgroup fairness, a selectable positive class and hand-built SVG charts ([FUTURE.md](../FUTURE.md)). No metric, curve, baseline or fold is computed in the app.

## 12. Open questions

- **`whenSettled()` on the chart elements.** The plan's element table lists no methods for them, yet `app-model-results.whenSettled()` must wait for the first visible chart render. The method was added to the four Plot elements. Confirm, or specify another mechanism.
- **Scroll landing after reload.** `src/app.ts` passes a view's `whenSettled()` to scroll restoration only for `app-data-view`, so the builder's promise is not used and the page does not return to the same section of Section 6 after a reload. Letting the router use the builder's promise would meet the plan's criterion; `src/app.ts` was outside the task's scope.
