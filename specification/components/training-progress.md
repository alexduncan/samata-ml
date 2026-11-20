# Spec for Training Progress

**Status:** implemented · Tier: **Presentational component**

## 1. Summary and responsibility

`app-training-progress` presents the current run, the latest readable status and its chronological log. Use it inside the connected Model Builder. The builder owns messages, the persisted disclosure preference, focus and all training commands. The component receives stable entry identifiers and renders them in the order supplied.

## 2. Public API (closed)

| Property       | Type                          | Default                                                 |
| -------------- | ----------------------------- | ------------------------------------------------------- |
| `progress`     | `TrainingProgress \| null`    | `null`                                                  |
| `logEntries`   | `readonly TrainingLogEntry[]` | Empty list                                              |
| `logOpen`      | `boolean`                     | `false`                                                 |
| `announcement` | `string`                      | Empty string                                            |
| `durationText` | `string`                      | Empty string                                            |
| `labels`       | `TrainingProgressLabels`      | English progress name, waiting text and entry formatter |

Properties are unreflected and use `attribute: false`. The contract has no custom methods, slots, parts or CSS properties. The labels object supplies `progress`, `waiting` and `formatEntry(entry)`. The parent supplies all localised labels, formatted counts and elapsed text.

The non-bubbling, non-composed `app-training-log-toggle` event carries `{ readonly open: boolean }`. Listen on the host and update the saved preference. The component suppresses the preference echo and duplicate native toggles.

## 3. Semantics, layout and focus

The component retains one labelled native `progress` with `max="100"`. Indeterminate progress omits the value attribute. A native `details` has its current status in the first-child `summary` and an ordered list keyed by log ID. The bar and disclosure remain mounted on ticks. The visible focus outline uses the shared token.

The builder supplies announcements only for live milestones. It leaves the announcement empty when first presenting saved historical content. The component mounts a separate polite status region before updating its text. Progress ticks and disclosure changes leave that text alone. The builder displays a readable status in other tabs and owns the Cancel Training, View Results and Retry saving affordances.

## 4. Usage and verification

Use the component for one run. Supply readable stage text and a chronological event list. Leave the percent indeterminate until the worker reports reliable run-level progress. Keep failed or cancelled terminal notices beside Training Setup so the learner can retry.

The progress stories cover queued, determinate, open and closed logs, cross-validation, cancelling, remote, publication pending, completion, long labels and RTL. `tests/training-panels.e2e.ts` covers the connected component, native keyboard interaction, quiet updates, failure focus, recovery and 320 px reflow. The Iris and Palmer Penguins journeys verify that logs, the disclosure preference and the acknowledged section survive reload. The Phase 3 plan records Safari and manual screen-reader evidence.

The [03-6 draft](../mockups/ui-scaffold/drafts/03-6_train-models-5-train.html) shows the semantic states. Human styling and promotion remain in the [human queue](../HUMAN.md#6-style-or-fix-mockups).
