# Spec for Training Progress

**Status:** implemented · Tier: **Presentational component**

## 1. Summary and responsibility

`app-training-progress` presents the current run, the latest readable status and its chronological log. Use it inside the connected Model Builder. The builder owns messages, the persisted disclosure preference, focus and all training commands. The component receives stable entry identifiers and renders them in the order supplied.

## 2. Public API (closed)

| Property       | Type                                  | Default                                                 |
| -------------- | ------------------------------------- | ------------------------------------------------------- |
| `progress`     | `TrainingProgress \| null`            | `null`                                                  |
| `variant`      | `'active' \| 'stopped' \| 'complete'` | `'active'`                                              |
| `logEntries`   | `readonly TrainingLogEntry[]`         | Empty list                                              |
| `logOpen`      | `boolean`                             | `false`                                                 |
| `announcement` | `string`                              | Empty string                                            |
| `durationText` | `string`                              | Empty string                                            |
| `labels`       | `TrainingProgressLabels`              | English progress name, waiting text and entry formatter |

Properties are unreflected and use `attribute: false`. The contract has no custom methods, slots, parts or CSS properties. The labels object supplies `progress`, `waiting` and `formatEntry(entry)`. The parent supplies all localised labels, formatted counts and elapsed text.

The non-bubbling, non-composed `app-training-log-toggle` event carries `{ readonly open: boolean }`. Listen on the host and update the saved preference. The component suppresses the preference echo and duplicate native toggles.

## 3. Semantics, layout and focus

The component renders one labelled native `progress` with `max="100"`. An indeterminate active bar omits the value attribute. An unknown stopped ratio omits the bar. A visible percentage is hidden from assistive technology because the native element supplies that value. Active uses static stripes, stopped uses red, and complete uses green. Text and forced-colours boundaries preserve the status and bar in display overrides. A native `details` has its status in the first-child `summary` and an ordered list keyed by log ID. The bar and disclosure remain mounted across progress ticks. The focus outline uses the shared token.

The builder supplies live milestones and leaves the announcement empty when presenting historical content. The component mounts a separate polite status region before updating its text. Progress ticks and disclosure changes leave that text alone. The builder owns Cancel Training, View Results and Retry saving and the stopped Train Model and Edit Training Setup actions. The acknowledged stop reason takes precedence over earlier command notices.

## 4. Usage and verification

Use the component for one run. Supply readable status text and a chronological event list. Keep the last measured percent during saving and use 100 only after acknowledged success. The builder may supply a stopped ratio only from the matching locally displayed run. It clears that projection on retry, edit or departure and retains it under Help. Reload without the local run restores the editable setup.

Stories cover queued, determinate, open and closed logs, cross-validation, cancelling, remote, publication pending, completion, stopped with and without progress, manual milestones, long labels and RTL. `tests/training-panels.e2e.ts` covers native keyboard interaction, quiet updates, failure focus, recovery, forced colours and 320 px reflow. The Iris and Palmer Penguins journeys verify logs, disclosure preference and acknowledged completion after reload. The maintainer confirmed VoiceOver in Safari. The native 200% inspection confirmed the labelled bar, keyboard disclosure and retained stopped percentage and log. See [T6 evidence](../plans/model-training-workflow.md#implementation-and-verification-log).

The [03-6 draft](../mockups/03-6_train-models-5-train.html) shows the semantic states. Human styling and promotion remain in the [human queue](../HUMAN.md#6-style-or-fix-mockups).
