# Spec: Model configuration form

**Status:** implemented · Tier: **2 (presentational)** · Criterion prefix: `WML-P1-UI`

## 1. Summary

`<app-model-configuration>` renders the manual hyperparameter form for the selected classifier in Section 3 (Configure Model) of the model builder. The form is generated from the typed model document and the presentation policy; it owns no persistent state and imports no stores.

## 2. Decision and rationale

Controls are generated from the `web-ml` model catalogue (control kind, scale, domain and default per option) instead of hand-written per model, so all eight classifiers share one form and one validation path. Canonical values are sparse overrides: an option equal to its default is omitted, which keeps persisted state small and lets library defaults change without migration. Native `<input type="range">`, `<input type="number">`, `<select>` and `<input type="checkbox">` are used throughout (no custom widgets, no `appearance: base-select`).

## 3. Public API (closed)

Tag `app-model-configuration`, class `AppModelConfiguration`. Properties (all `attribute: false` except `disabled`):

| Property     | Type                         | Default                          | Purpose                                                                                                                                                                  |
| ------------ | ---------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `document`   | `ModelDocument \| null`      | `null`                           | Typed catalogue document of the selected classifier. `null` renders nothing.                                                                                             |
| `value`      | `HyperparameterConfig`       | `{ mode: 'manual', values: {} }` | Stored configuration; `values` holds sparse canonical overrides.                                                                                                         |
| `context`    | `ModelOptionContext`         | `{ rowCount: 0, classCount: 0 }` | Dataset facts for context-dependent defaults and domains (for example nearest-neighbour count versus row count).                                                         |
| `multiclass` | `MulticlassStrategy \| null` | `null`                           | Read-only strategy shown in the multiclass note when `classCount > 2`.                                                                                                   |
| `disabled`   | `boolean`                    | `false`                          | Disables every control and `Save & Continue`, and suppresses both events (trained or otherwise locked models).                                                           |
| `labels`     | `ConfigurationLabels`        | `DEFAULT_CONFIGURATION_LABELS`   | Form chrome, error messages and per-option `name`, `description` and `notes`, plus optional `choices` and `valueLabel`. The connected builder passes its `i18n` strings. |

Events (`bubbles: false`, `composed: false`; the owner binds on the element):

- `app-model-configuration-change` — `detail: { config: HyperparameterConfig }`, after every edit that leaves the edited control valid.
- `app-model-configuration-continue` — `detail: { config; requestOptions }`, on submit only when not disabled and every active field is valid.

There are no slots, parts, methods or custom properties. Styles come from `buttonStyles`, `trainModelStyles` and `hyperparametersStyles` (`src/styles/hyperparameters.styles.ts`).

## 4. Behaviour

- **Mode** is the first field: Manual is selected; Random Search (advanced) is disabled until the tuning phase.
- **Control kinds** follow the catalogue: select (enums), checkbox (booleans), range plus exact number (continuous, integer, log scale), number plus Reset (`number-reset`, for example `tol`, `randomState`), compound mode select with a conditional value control (`maxDepth`, `gamma`, `binarize`, `classWeight`) and a layer editor (`hiddenLayerSizes`).
- **Recommended slider range versus valid domain:** the range covers the recommended span; the number input accepts any value in the valid domain (`step="any"` on continuous fields, no slider-only `min`/`max`) and the slider clamps visually only.
- **Dependencies:** a field with `activeWhen` false is not rendered, and its edit state and error are discarded. Its stored override is untouched. Solver/penalty combinations follow the policy rule; invalid combinations are never offered.
- **`validity.badInput`:** the number input checks `badInput` before the value (browsers sanitise `1e` or `-` to `''`). Malformed or empty drafts are kept as edit state, fire no change event, leave the canonical value alone and are bound with `noChange`/`live()` so the user's text is never erased or reformatted. Errors appear on `blur` and on a failed submit.
- **Submit:** `<form novalidate>`. `Save & Continue` is never disabled for validation errors; a failed submit renders every error and focuses the first invalid control. Issues on defaults (for example KNN neighbours above the row count) are reported on that field's number input.
- **Multiclass and fixed options** appear as `.form-note` text at the end of the form (see visual-design `MODELS-UI-04`).

## 5. Visual specification

Mapped from `specification/mockups/03-4_train-models-3-configure-model.html` and `css/hyperparameters.css`; the normative CSS is `src/styles/hyperparameters.styles.ts` (`.field` family, `A11Y-07`, `A11Y-08`, `SEM-10` applied). `.form-note` is a recorded deviation (`MODELS-UI-04`).

## 6. Accessibility

- Every control has an accessible name equal to its visible label; number inputs add a visually hidden `{name} (exact value)` label; layer inputs are `Layer {n} size`.
- `aria-invalid` is `"true"` or `"false"` on every control. `aria-describedby` lists the error, when shown, before the full field hint. Each hint is a complete plain-text sentence. The Section 3 heading link opens Configure Model Help for technical definitions.
- One polite live region announces errors revealed on blur; it is suppressed on a failed submit, where focus moves to the first invalid control.
- Log-scale ranges expose `aria-valuetext` with the real value.
- Focus outlines are `2px` (`A11Y-08`); layout survives 320 px, 200% zoom, RTL, long labels and forced colours.
- The builder's completed section headers expose `Edit Choose Model`, `Edit Select Features` and `Edit Configure Model` so the accessible name contains the visible text (WCAG 2.5.3).

Manual checks that remain (V1 release checks in `HUMAN.md`): VoiceOver with Safari reads each range pair's label, value and help and the three `Edit …` names; NVDA or Orca equivalent.

## 7. Internationalisation

The element owns default English labels only. The connected builder supplies `labels` from `i18n('app-model-builder-view', …)`, including per-option names, descriptions, dependency notes and choice texts. Numbers are formatted with the document locale.

## 8. Acceptance criteria

| ID          | Criterion and evidence                                                                                                                                     |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WML-P1-UI-1 | All eight classifiers render their non-hidden options with the right control kinds, descriptions and dependency notes; `tests/model-configuration.e2e.ts`. |
| WML-P1-UI-2 | Range/number synchronisation and `validity.badInput` preservation; `tests/model-configuration.e2e.ts`.                                                     |
| WML-P1-UI-3 | Accessibility tree names, `aria-invalid`, descriptions and live region; exact-target axe check.                                                            |
| WML-P1-UI-4 | Failed submit focuses the first invalid control; inactive fields never block completion.                                                                   |
| WML-P1-UI-5 | Help link opens the Configure Model help dialog and returns to `/models/{num}`; saved overrides survive reload.                                            |
| WML-P1-UI-6 | Keyboard-only completion, 320 px, 200% zoom, RTL, long labels and forced colours.                                                                          |
| WML-P1-UI-7 | Stories pass axe in three browsers (`bun run test:stories`).                                                                                               |
| WML-P1-UI-8 | Compound fields and the layer editor, including edit-state cleanup when a compound mode leaves its value mode.                                             |
| WML-P1-UI-9 | `Edit` button names (WCAG 2.5.3); builder stories exclude only the listed `tests/a11y-feature-findings.ts` targets.                                        |

`TERM-AC-1` checks Help activation and focus restoration. `TERM-AC-3` checks names, field descriptions and validation across the eight forms. The Logistic story checks the complete solver hint.

## 9. Stories

`src/features/models/app-model-configuration.stories.ts` (`Models/Model configuration`): Logistic, MlpLayers, SvcGamma, DecisionTreeDepth, NaiveBayesFixed, KnnSmallDataset, Invalid, Disabled, LongLabel and RTL. `src/features/models/app-model-builder-view.stories.ts` adds ConfigureModel, ConfigureModelComplete, NoClassifierNumericTarget, LongLabel and RTL. `src/styles/hyperparameters.stories.ts` (`Primitives/Hyperparameter field`) documents the field styles. Docs descriptions give Do/Don't usage; axe failures fail story tests.
