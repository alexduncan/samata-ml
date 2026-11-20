# Spec for Training Setup

**Status:** implemented · Tier: **Presentational component**

## 1. Summary

`app-training-setup` displays the classification training strategy and a fold matrix for Cross-Validation. The model builder owns persisted setup and eligibility. The form owns native input drafts and interaction feedback.

## 2. Decision and rationale

The presentational form receives the model's saved value and the target-specific fold limit. This keeps persistence, metadata and navigation in the connected model builder. Native select, range and number controls provide familiar keyboard behaviour. The number field gives precise entry alongside the range.

Samatā's input rule requires at least two observed classes, each with two or more rows. Cross-Validation folds run from 2 through the smallest observed class count, capped at 10. The UI rule applies to both strategies. Web-ml may still reject the requested partition once training runs. [The workflow spec](../workflow-steps.md#4-training-setup) describes the builder's loading, retry and completion states.

## 3. Public API (closed)

| Property        | Type                            | Default                                            |
| :-------------- | :------------------------------ | :------------------------------------------------- |
| `value`         | `ValidationMethodology \| null` | `null`, displaying One-Shot before the first write |
| `maxFolds`      | `number`                        | `10`                                               |
| `blockedReason` | `string`                        | Empty string                                       |
| `disabled`      | `boolean`                       | `false`                                            |
| `labels`        | `TrainingSetupLabels`           | English strings and formatters                     |

Every property uses `attribute: false` and is unreflected. There are no custom slots, parts, styling hooks or methods.

- `app-training-setup-change` emits on a strategy change or valid fold edit.
- `app-training-setup-submit` emits on valid submission.

Both events are typed as `CustomEvent<{ readonly setup: ValidationMethodology }>` and use `bubbles: false` and `composed: false`. The builder listens directly on the form host. The [state contract](../state-and-storage.md#3-persisted-schema) defines the event value.

## 4. Usage

The model builder binds the saved value and current fold limit with Lit property bindings and handles both events directly. For example

```html
<app-training-setup
	.value="${model.trainingSetup}"
	.maxFolds="${bounds.maxFolds}"
	.blockedReason="${blockedReason}"
	.labels="${translatedLabels}"
	@app-training-setup-change="${handleChange}"
	@app-training-setup-submit="${handleSubmit}">
</app-training-setup>
```

The first switch to Cross-Validation uses five folds or the supplied maximum, whichever is lower. The two CV counts in a committed setup are equal. With a saved value above the current maximum, the number and matrix keep the saved count and the slider clamps to the maximum. Submission requires a correction. Empty, unfinished or out-of-range input keeps the last valid matrix and leaves the store untouched. Switching to One-Shot clears the fold error.

The builder keys the form by model number and checks route, draft status and current eligible metadata before applying an intent. The same instance stays mounted during Help, retaining its invalid draft and link focus on return. A different model starts with its own saved settings. Valid submission saves the setup and opens the pending Section 5.

## 5. Visual specification

The unstyled [03-5 draft](../mockups/ui-scaffold/drafts/03-5_train-models-4-configure-training.html) records the control order, matrix, legend and alternate states. The component uses shared button, notification, train-model and hyperparameter styles with existing tokens. Only the named matrix wrapper scrolls horizontally. Fold columns are 2rem wide with a 3.5rem run column and 0.25rem cell spacing. At ten folds the matrix spans at least 26.5rem. The summary, legend and form actions wrap within the available inline size.

Changes from mockup CSS follow [the deviation registers](../visual-design.md#5-deviation-registers), including widths and contained overflow (MODELS-UI-05), visible role markers (SEM-14), matrix and Help focus outlines (A11Y-11), and the builder's pending-notice contrast (A11Y-12). The draft awaits human styling and has no visual parity target.

## 6. Accessibility

- The form and Strategy select have accessible names. The range and exact number field each have a label, with shared fold help. On an invalid fold edit, the described error comes first and is announced politely on blur and read as the focused field’s description on invalid submit. The same native number control retains unfinished input across updates. Train Model remains available with a field error and sends focus to the number field on invalid submission.
- A blocked form disables all form controls. Its alert describes the submit control. A disabled form with no blocked reason omits the alert and its description.
- A table caption names both the table and its focusable scroll region. The table uses scoped row and column headers and a visually hidden “Training” or “Validation” label per cell. Visible en dashes and check marks, dashed and solid borders, and matching legend swatches distinguish roles in forced colours. Keyboard focus is visible on the wrapper and Learn more.
- Safari's accessibility tree exposed the Strategy select, both fold inputs, matrix headers, cell labels and the named Help dialog. The maintainer verified the corresponding spoken announcements with VoiceOver in Safari. NVDA and Orca were unavailable on the test host.

## 7. Internationalisation

The builder supplies labels and formatters through `TrainingSetupLabels`. This includes the strategy and fold inputs, form, summary percentages, legend, cell roles, error and submit text. The form uses logical layout and accommodates RTL, long labels and narrow widths. The content router localises the Help dialog independently.

## 8. Acceptance criteria

1. `WML-P2-COMP-1` — Default render emits nothing. Strategy selection and valid fold changes emit the canonical value and update the paired controls.
2. `WML-P2-COMP-2` — The table and keyboard region have names. Row and column headers and both cell roles are present.
3. `WML-P2-COMP-3` — A saved count above the maximum remains visible and prevents submission until corrected. A corrected value submits once.
4. `WML-P2-COMP-4` — Blocked and disabled forms suppress both intents. Only the blocked state presents a described alert.
5. `WML-P2-COMP-5` — Ten component stories pass interaction and axe checks. `WML-P2-UI-2`, `-4`, `-5` and `-7` cover native invalid input, Help, forced colours, narrow/RTL scrolling and model isolation in the builder.

## 9. Stories

OneShot, CrossValidation, MinFolds, MaxFolds, SavedAboveMaximum, InvalidFolds, Blocked, Disabled, LongLabel and RTL. The shared styles also include two-fold, ten-fold and long-label RTL matrix previews.

## 10. Files

- `src/features/models/app-training-setup.ts` and `src/features/models/app-training-setup.stories.ts`
- `src/features/models/app-model-builder-view.ts` and `src/styles/hyperparameters.styles.ts`
- `tests/training-setup.e2e.ts` and `tests/a11y.e2e.ts`

## 11. Non-goals

Training execution, row membership, partition feasibility from web-ml, editable seeds, custom holdout ratios and missing-value controls belong to later work. Persisted fold-matrix scrolling is tracked in [scroll-region restoration](../plans/scroll-region-restoration.md).

## 12. Open questions

Human styling and promotion of 03-5 remain in the [human queue](../HUMAN.md#6-style-or-fix-mockups).
