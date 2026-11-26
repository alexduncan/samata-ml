# Spec for Results Comparison

**Status:** implemented · Tier: **Connected route** (`app-results-view`) composing presentational elements

## 1. Summary and responsibility

The `/results` route compares classification evaluations of the same held-out rows and partitions. The connected view reads `$appState`, `$canCompare`, `$comparison`, `$ropeAnalysis` and `$format` through store controllers, owns translations and calls store actions. Presentational elements receive view models and labels and emit events. [Workflow steps §4](../workflow-steps.md#4-compare-results) defines the section order and learner-facing behaviour. The [04 draft](../mockups/04_compare-results.html) awaits human styling.

## 2. Decision and rationale

Comparable groups use the saved partition fingerprint and validate the protocol, class axis, partition counts, row order and true labels. The default is the largest eligible group, breaking ties by model number, once all trained results have reached a terminal state. The user selects two to eight models. Every measure and baseline is presented without an automatic winner; unavailable and inconsistent data remain explicit. The app projects and formats upstream reports and calls the upstream paired-analysis API rather than training or computing a posterior here.

## 3. Public API (closed)

Properties below are reactive, not reflected and use `attribute: false`. All listed events bubble and are composed. There are no slots, parts or custom CSS properties. Every presentational element also receives its exported `labels` object with empty-string defaults; chart formatters default to `String` unless otherwise noted.

| Element                   | Properties and defaults                                                                   | Events or public methods                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `app-results-view`        | None                                                                                      | `focusHeading(signal: AbortSignal): Promise<void>`, `whenSettled(): Promise<void>`                |
| `app-comparison-controls` | `groups = []`, `fingerprint = null`, `models = []`, `selected = []`                       | `app-comparison-group-change` `{ fingerprint }`; `app-comparison-selection-change` `{ selected }` |
| `app-comparison-table`    | `rows = []`, `baselines = []`, `columns = []`, `sort = null`                              | `app-comparison-sort-change` `{ sort }`                                                           |
| `app-fold-strip`          | Phase 4 properties plus `paired = false`                                                  | `whenSettled()`                                                                                   |
| `app-class-error-bars`    | `rows = []`, `caption = null`, `formatPercent`                                            | `whenSettled()`                                                                                   |
| `app-model-pair-picker`   | `models = []`, `pairA = null`, `pairB = null`                                             | `app-model-pair-change` `{ pairA, pairB }`                                                        |
| `app-confusion-delta`     | `delta = null`, `classFilter = null`, `formatSignedCount = null`                          | `app-confusion-delta-filter-change` `{ classFilter }`                                             |
| `app-rope-bar`            | `result = null`, `ropeWidth = 0.01`, `status = 'idle'`, `caption = null`, `formatPercent` | `app-rope-width-change` `{ ropeWidth }`; `app-rope-retry` `{}`; `whenSettled()`                   |
| `app-instance-agreement`  | `counts = null`, `caption = null`, `formatCount`                                          | `whenSettled()`                                                                                   |

Group options carry `fingerprint`, `protocol`, `modelCount`, `disabled`, `reason` and complete localised `text`. Model options carry `num` and `label`. Table columns carry `id`, `label` and `lowerIsBetter`; row cells retain raw `value`, optional `unavailableReason` and formatted `text`. View-model and event types are exported from the corresponding source modules.

The labels contracts are: `ComparisonControlsLabels` (`group`, `models`, `limit`); `ComparisonTableLabels` (`caption`, `model`, `baseline`, `unavailable`); `ModelPairPickerLabels` (`modelA`, `modelB`, `swap`, `order`); `ClassErrorBarsLabels` (`class`, `model`, `errorRate`, `unavailable`, `showData`); `ConfusionDeltaLabels` (`caption`, `filter`, `allClasses`, `trueClass`, `predictedClass`, `correct`, `takeaway`); `RopeBarLabels` (`width`, `invalidWidth`, `aHigher`, `equivalent`, `bHigher`, `loading`, `unavailable`, `error`, `retry`, `outcome`, `probability`, `showData`); and `InstanceAgreementLabels` (`correctModels`, `rowCount`, `showData`, `bucket`). All fields are strings except `bucket(correct: number): string`, whose default returns an empty string. The connected view supplies complete translated option text, sentences and plural-aware bucket labels.

## 4. Usage and states

With fewer than two trained models, show a notification and Models link. While results load, wait before choosing the initial default. Legacy, lost and read-error results have their own explanations and retry or retraining actions. Incompatible groups are listed; a group with fewer than two selected keeps the controls and explains the requirement. The populated group puts one native “What do these results terms mean?” disclosure immediately after the metrics table. It starts closed and retains its native open state while that comparison remains mounted. A missing comparison projection has no disclosure. An analysis error does not hide the other comparisons. The route's `focusHeading` never waits for data. `whenSettled` waits for resources, the initial terminal analysis and visible charts, but resolves when the view is superseded or disconnected.

## 5. Visual specification

The semantic draft is not normative for appearance until promoted. Apply shared table, notification, page-header and native results disclosure styles and the chart-token exception in [visual design §1.1](../visual-design.md#11-draft-mockups). Measured visual-only deviations and human styling work are tracked in [HUMAN.md](../HUMAN.md). No winner styling is used.

## 6. Accessibility

Use labelled native checkboxes, selects, buttons and a captioned table. Header buttons cycle ascending, descending and unsorted, with `aria-sort` on the active header. Keep baseline rows fixed. Pair selects prevent duplicate models; the swap button works with exactly two models, keeps focus and announces the committed order in a persistent status. Charts have captions, text and data-table disclosures; matrix regions are keyboard scrollable and signed counts include non-colour text. The selection limit and invalid width are visibly explained and associated with controls. The >20-class filter uses the same default and ordering as Section 6. The terms summary adds one keyboard stop with a visible focus outline, a native marker and a target at least 24 × 24 CSS px. The definition list exposes expansion text for MCC, ROC-AUC and ECE directly beside the term.

## 7. Internationalisation

The connected route supplies all user-facing text through the application i18n and formatter. The shared `RESULT_TERM_COPY` inventory supplies the base `term.<id>.name`, `term.<id>.definition` and `term.<id>.expansion` messages. Signed confusion values use locale-aware grouping and signs, including an unsigned zero. Labels and group reasons are complete translated messages rather than concatenated fragments.

## 8. Acceptance criteria

The executable contracts are `WML-P5-MODEL-*`, `WML-P5-STATE-*`, `WML-P5-ROPE-*`, `WML-P5-UI-*`, `JOURNEY-IRIS-COMPARE` and `JOURNEY-PENGUINS-COMPARE` in the Phase 5 plan and corresponding tests. `TERM-AC-7` checks placement, persistence while mounted, sort and width behaviour, and the six-row fixture’s 83.3% pooled balanced accuracy and 25% table gap. `TERM-AC-9` checks the open disclosure at narrow widths, zoom and RTL, and with axe. Native Safari verified focus, term order, expanded state and actual 200% zoom for the disclosure. Spoken VoiceOver output and the broader Phase 5 assistive-technology checks are tracked in the human queue.

## 9. Stories

The co-located stories cover populated, blocked, loading, unavailable, error, incompatible, long-label and RTL states. The populated, long-label and RTL stories toggle the native disclosure. Non-ready and incompatible stories check its absence. Chart and control stories cover their own variants and data tables.

## 10. Files

`src/features/results/app-results-view.ts`, the seven comparison presentational modules and their stories, `src/features/results/comparison-model.ts`, `src/features/results/result-term-copy.ts`, `src/stores/comparison.store.ts`, `src/features/results/analysis-{protocol,client,worker}.ts`, and `tests/comparison*.e2e.ts`.

## 11. Non-goals

Regression comparison, automatic winner selection, model training, model computation, tuning and future comparison charts are outside this component.

## 12. Open questions

No implementation questions remain. Styling and the user-deferred native accessibility checks remain in [HUMAN.md](../HUMAN.md).
