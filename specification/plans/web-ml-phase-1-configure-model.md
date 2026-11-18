# Phase 1: Configure model and manual hyperparameter selection

**Status:** draft | **Updated:** 2026-11-18T08:34:14Z
**Authors:** Google Antigravity (Gemini 4 Argon High) | **Created:** 2026-11-17T21:23:45Z
**Verified by:** — | **Verified:** — | **Verification:** pending
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour:** `src/features/models/app-model-builder-view.ts` (L1008–1031, L1083–1089) renders Section 3 (`3. Configure Model`) as `<p class="pending-notice">Not available yet.</p>`. `src/types/state.ts` (L64–77) defines `HyperparameterValue = number | string | boolean | number[]` and `HyperparameterConfig = { mode: 'manual' | 'tuning'; values: Record<string, HyperparameterValue>; tuningSearchSpace?: Record<string, HyperparameterValue[]> }`, which cannot represent `null` or `Record<string, number>` values required by `web-ml`'s `TrainingOptionsFor<A>` (`node_modules/web-ml/dist/src/training/types.d.ts` L185). `scripts/build-assets.ts` does not publish `web-ml`'s model-specification JSON files to the build output.

**Target behaviour:** Section 3 (`3. Configure Model`) renders native HTML controls generated from `web-ml`'s canonical model-specification JSON documents, validates dependent options, and saves the normalised manual configuration to `model.hyperparameters.values` in application state (`localStorage`) in the exact shape expected by `web-ml`'s `options` parameter (`Partial<TrainingOptionsFor<A>>`) when training the model in Phase 3. Hyperparameter tuning is deferred to Phase 5 (`specification/plans/web-ml-phase-5-hyperparameter-tuning.md`).

**Why:** Decoupling manual hyperparameter selection (Phase 1) from training setup (Phase 2), training execution (Phase 3), results (Phase 4), and hyperparameter tuning (Phase 5) keeps each change small, testable, and aligned with `web-ml`'s public `options` contract.

## Scope

**In scope**

- Build-time validation and publication of `web-ml` model-specification JSON (`web-ml/model-specifications`, `web-ml/model-specifications/schema`, `web-ml/model-specifications/*`) to `/models/<revision>/` with a same-origin manifest `/models/index.json`.
- Narrow runtime decoder and revision-keyed loader (`src/features/models/model-documents.ts`) with resource store state (`src/stores/model-resources.store.ts`).
- Presentation policy and option normaliser (`src/features/models/model-presentation-policy.ts`, `src/features/models/model-options.ts`) producing `requestOptions` directly compatible with `Partial<TrainingOptionsFor<A>>` (the `options` parameter of `createTrainingClient().train` and `baseOptions` of `nestedCrossValidate`).
- Widening `HyperparameterValue` in `src/types/state.ts` and `src/stores/persister.ts` to `number | string | boolean | null | number[] | Record<string, number>` and migrating persisted state (`STORAGE_VERSION = 2`) so saved `model.hyperparameters.values` matches `web-ml`'s `options` type.
- Presentational `<app-model-configuration>` Lit component (`src/features/models/app-model-configuration.ts`), integration into Section 3 of `<app-model-builder-view>`, co-located Storybook stories, and three-browser Playwright E2E tests.

**Out of scope**

- Hyperparameter tuning search-space UI, strategy controls, and `tuningSearchSpace` editing (moved to Phase 5: `specification/plans/web-ml-phase-5-hyperparameter-tuning.md`).
- Step 4 (`4. Training Setup`) UI and `ValidationMethodology` updates (moved to Phase 2: `specification/plans/web-ml-phase-2-training-setup.md`).
- Worker/WASM runtime copying, COOP/COEP headers, and model training execution (moved to Phase 3: `specification/plans/web-ml-phase-3-model-training.md`).
- Results rendering and comparison (moved to Phase 4: `specification/plans/web-ml-phase-4-model-results.md`).
- User-entered Naive Bayes class prior arrays (`priors`, `classPrior`) and editable Logistic Regression decision `threshold` until `web-ml` documents fitted class sort order and positive-label precedence.

**Constraints and invariants**

- Strict TypeScript, Bun only, TSDoc on all exported symbols (`specification/standards-and-documentation.md`).
- Native semantic controls, Baseline Widely available features, WCAG 2.2 AA, British English, and `@nanostores/i18n` localisation (`specification/COMPONENTS.md` §1, §7, §8).
- Never read `../web-ml/src/**` or `../web-ml/specification/internals/`; never modify `../web-ml`, `node_modules/`, `bun.lock`, or normative mockups outside `specification/mockups/ui-scaffold/drafts/`.

## Required reading

- `specification/COMPONENTS.md` §3–§10; `specification/visual-design.md` §1.1, §3–§6 — Lit component, token, draft styling, and Storybook rules for T4.
- `specification/workflow-steps.md` §3.1–§3.3; `specification/state-and-storage.md` §3–§8; `specification/app-state-and-navigation.md` §6 — model builder lifecycle, persistence, and section reopening.
- `../web-ml/specification/public-api/current-limitations.md` L9–55 (classifier/regressor capabilities, multiclass strategies), L180–185 (NB prior order).
- `../web-ml/specification/public-api/hyperparameters.md` L25–55, L114–173 (LogisticRegression, MLPClassifier), L197–217 (DecisionTreeClassifier), L236–255 (KNeighborsClassifier), L275–329 (Naive Bayes), L330–355 (SVC).
- `../web-ml/specification/public-api/model-specifications/README.md`, `schema.json`, `index.json`, and `models/*.json`.
- `node_modules/web-ml/dist/src/training/types.d.ts` L50–190 (`TrainingRequest`, `TrainingOptionsFor`), `node_modules/web-ml/dist/src/types.d.ts` L66 (`ClassificationLabel`), L147 (`ClassWeight`).
- `specification/mockups/ui-scaffold/03-3_train-models-2-select-features.html`, `src/styles/train-model.styles.ts` — outer accordion shell.
- `specification/mockups/ui-scaffold/drafts/03-4_train-models-3-configure-model.html` — structure reference for manual controls only (ignore the out-of-scope Random Search tuning states and the contradictory `Gaussian class priors — Custom` block at L402–432, broken `aria-labelledby="configuration-heading"` at L208, and `../mockups.css` link at L7 until T4 cleans up the draft).

## Codebase context

- **Relevant specifications:** `specification/workflow-steps.md` (partial), `specification/state-and-storage.md` (draft), `specification/COMPONENTS.md` (partial).
- **Relevant implementation:** `src/features/models/model-catalogue.ts` (L1–85: imports `web-ml/model-specifications` and `web-ml/model-specifications/*`, exports `SUPERVISED_MODELS`), `src/features/models/app-model-builder-view.ts` (L217–295, L1008–1113), `src/types/state.ts` (L64–151), `src/stores/app.store.ts` (`setHyperparameters` L497, `setMulticlassStrategy` L522, `completeSection` L571), `src/stores/persister.ts` (L206–307).
- **Verified `web-ml@0.1.0` option contracts (`node_modules/web-ml/dist/src/training/types.d.ts` L185):**
    - Every classifier's JSON option names in `../web-ml/specification/public-api/model-specifications/models/*.json` match its TypeScript `Options` interface (`LogisticRegressionOptions`, `MLPClassifierOptions`, `DecisionTreeClassifierOptions`, `KNeighborsClassifierOptions`, `GaussianNBOptions`, `MultinomialNBOptions`, `BernoulliNBOptions`, `SVCOptions`).
    - Option value types across interfaces: `number`, `boolean`, string literal enums, `'scale' | 'auto' | number` (`SVCOptions['gamma']`), `number | null` (`maxDepth`, `binarize`), `number | readonly number[]` (`hiddenLayerSizes`), `readonly number[] | null` (`priors`, `classPrior`), and `ClassWeight = 'balanced' | Record<string | number, number> | null` (`classWeight` on Logistic and SVC, `dist/src/types.d.ts` L147).
- **Identified contradictions between `web-ml` JSON, `web-ml` prose/types, and `samata-ml` specs:**
    1. **MLP `learningRate` (`mlp-classifier.json` L68–76 vs `hyperparameters.md` L157 & `_base.d.ts` L19):** `mlp-classifier.json` sets `defaultKind: "fixed"`, `default: 0.001` with no `defaultBy` or `appliesWhen`, whereas `hyperparameters.md` L157 states `"SGD step; Adam uses a fixed rate of 0.001"` and `MLPClassifierOptions` accepts `learningRate?: number`.
    2. **Logistic `learningRate` (`logistic-regression.json` L132–161 vs `hyperparameters.md` L128):** JSON applies `learningRate` when `"solver is 'sgd' or 'adam'"` (`defaultBy`: `sgd: 0.01`, `adam: 0.001`), whereas `hyperparameters.md` L128 states Adam uses a fixed rate and does not state whether passing `learningRate` under `adam` is ignored or rejected.
    3. **Logistic `nIterations` alias (`logistic-regression.json` L163–173):** JSON defines both `maxIter` and deprecated alias `nIterations` (`aliasOf: "maxIter"`, `aliasPrecedence: "alias-wins"`). Rendering raw JSON options without alias filtering would render duplicate iteration fields.
    4. **Naive Bayes `priors`/`classPrior` (`current-limitations.md` L184–185):** Custom prior arrays follow fitted sorted observed-class order without defining the sort in public documentation.
    5. **Logistic `threshold` (`types.d.ts` L113 vs `hyperparameters.md` L38):** Declarations state the positive class is `classes_[1]`; prose states it is the second `classLabels` entry.
    6. **Multiclass strategy (`workflow-steps.md` §3.3 L163–169 vs `current-limitations.md` L13, L30–38):** `workflow-steps.md` asks the user to choose `Native multiclass | One-vs-Rest | One-vs-One`, whereas in `web-ml` each classifier has a fixed strategy (Logistic `ovr`, SVC one-vs-one, others native) and no `multiclass` key exists in `TrainingOptionsFor<A>`.
    7. **KNN `nNeighbors` upper bound (`hyperparameters.md` L244):** `nNeighbors` must not exceed the fitting sample count, which is only determined after Phase 2's Training Setup split/fold selection.
- **Tests and commands:** Baseline `bun run check` passes 220 tests across 31 files with 0 type errors.
- **Web guidance:** `forms`, `accessibility` — native labelled controls, `<fieldset>`/`<legend>`, validate on blur and submit, associate help/error text via `aria-describedby`, move focus to first invalid control on submit.
- **Visual reference:** `specification/mockups/ui-scaffold/03-3_train-models-2-select-features.html` — `src/styles/train-model.styles.ts`; Section 3 inner controls follow `specification/mockups/ui-scaffold/drafts/03-4_train-models-3-configure-model.html` (draft-only under `visual-design.md` §1.1, no new parity entries).
- **Domain skills:** `lit-component-implementer` for T4.
- **Assumptions requiring verification:** Whether `samata-ml` Phases 1–3 should restrict `model-catalogue.ts` to the 8 classifiers or also generate hyperparameter forms for the 6 regressors already present in `model-catalogue.ts` (see _Risks and open questions_).

## Technical decisions

| Decision                      | Chosen approach and rationale                                                                                                                                                                                                                                                                           | Rejected alternative / trade-off                                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1 `options`-compatible state | Store normalised, active hyperparameter overrides in `model.hyperparameters.values` (`Record<string, HyperparameterValue>`) using canonical `web-ml` option keys and value types so Phase 3 can pass `normaliseModelOptions(...).requestOptions` directly as `options: Partial<TrainingOptionsFor<A>>`. | Storing raw input strings or uncanonicalised aliases (`nIterations`) pushes form parsing and validation errors into Phase 3 worker execution.          |
| D2 JSON + policy hybrid       | Use `web-ml` JSON for option inventory, names, descriptions, enum values, aliases, and defaults; pair with an explicit TypeScript policy (`model-presentation-policy.ts`) for numeric bounds, applicability (`sgd` vs `adam`), and fixed options (`threshold`, NB priors).                              | Blindly rendering JSON creates duplicate `nIterations` inputs, makes MLP `learningRate` uneditable under `sgd`, and sends `learningRate` under `adam`. |
| D3 Manual-only in Phase 1     | Fix `model.hyperparameters.mode = 'manual'` in Phase 1; omit Fixed/Tune domain toggles and Random Search controls until Phase 5.                                                                                                                                                                        | Mixing tuning search spaces into Phase 1 reintroduces the monolithic complexity the phase split removes.                                               |
| D4 Multiclass display         | Derive multiclass strategy (`native`, `one-vs-rest`, `one-vs-one`) from the model capability map, display it as read-only explanatory text when the target has > 2 classes, and persist it via `setMulticlassStrategy` without putting a `multiclass` key inside `hyperparameters.values`.              | Offering an interactive multiclass `<select>` contradicts `web-ml`, where no classifier supports switching multiclass strategies.                      |
| D5 Presentational labels      | `<app-model-configuration>` is a Tier 2 presentational element receiving a typed `labels: ConfigurationLabels` object with empty-string defaults (`DEFAULT_CONFIGURATION_LABELS`); `<app-model-builder-view>` supplies localised labels via `i18n('app-model-builder-view', ...)`.                      | Importing `i18n` or stores in a Tier 2 element violates `COMPONENTS.md` §2 and §8 L169.                                                                |

### Interfaces and behaviour

#### A. Published model documents (`/models/index.json`)

`scripts/build-model-assets.ts` exports `buildModelAssets(outDir: string): Promise<ModelAssetReport>`, wired into `scripts/build-assets.ts`. It reads `web-ml/model-specifications`, `web-ml/model-specifications/schema`, and `web-ml/model-specifications/*`, validates `schemaVersion === 1` and option coverage, and writes `/models/index.json` (`{ schemaVersion: 1, revision, libraryVersion, models: [{ id, taskType, specUrl }] }`) plus `/models/<revision>/specs/<id>.json`.

`src/features/models/model-documents.ts` exports `loadModelDocuments(signal?: AbortSignal): Promise<ModelDocuments>` and `loadModelDocument(id: string, signal?: AbortSignal): Promise<ModelDocument>`, enforcing `response.ok`, JSON content type, size $\le 256\text{ KiB}$, and prototype-key rejection (`__proto__`, `constructor`, `prototype`). `src/stores/model-resources.store.ts` exposes `$modelDocumentState` and actions `loadConfiguration(modelNum)` / `retryConfiguration(modelNum)`.

#### B. Option policy, normaliser, and `options` type alignment

`src/features/models/model-options.ts` exports `normaliseModelOptions(document: ModelDocument, overrides: Readonly<Record<string, HyperparameterValue>>, context: ModelOptionContext): NormalisedModelOptions`:

- Returns `{ effective, requestOptions, fields, issues }`, where `requestOptions` contains **only** active, canonical keys valid for `TrainingOptionsFor<A>`:
    - Enum → `<select>` (`solver`, `penalty`, `activation`, `criterion`, `weights`, `metric`, `kernel`). Singleton enums (`multiClass: 'ovr'`, `algorithm: 'brute'`) render as read-only text.
    - Boolean → `<input type="checkbox">` (`fitIntercept`, `forceAlpha`, `fitPrior`, `probability`); `multiLabel` is fixed `false`.
    - Number → `<input type="number">` (`C > 0`, `tol`, `maxIter >= 1` integer, `minSamplesSplit >= 2` integer, `minSamplesLeaf >= 1` integer, `minImpurityDecrease >= 0`, `nNeighbors >= 1` integer, `p >= 1`, `varSmoothing >= 0`, `alpha >= 0`, `degree >= 0` integer, `coef0` finite, MLP `randomState` integer `0..4294967295` or omitted for random).
    - Bounded fraction (`l1Ratio` in `[0, 1]`, when `penalty === 'elasticnet'`) → paired `<input type="range" min="0" max="1" step="0.01">` and exact `<input type="number">`.
    - Positive continuous (`learningRate` for Logistic and MLP when `solver === 'sgd'`) → log10 slider (`10^-6..1`) paired with exact `<input type="number">`. When `solver === 'adam'`, shown read-only as `0.001` and **omitted from `requestOptions`**. When `solver` is `'lbfgs'` or `'coordinate_descent'`, inactive and omitted.
    - Nullable number (`maxDepth`, `binarize`) → mode `<select>` (`null` vs numeric input).
    - Union `'scale' | 'auto' | number` (SVC `gamma`) → mode `<select>` (`'scale'`, `'auto'`, or numeric $\ge 0$).
    - `number | number[]` (MLP `hiddenLayerSizes`) → ordered list editor producing non-empty `number[]` of positive integers.
    - `ClassWeight` (Logistic and SVC `classWeight`) → mode `<select>` (`null`, `'balanced'`, or custom per-class numeric inputs keyed by observed class labels).
    - Fixed options: Logistic `threshold` (`0.5`), GaussianNB `priors` (`null` / Automatic), MultinomialNB and BernoulliNB `classPrior` (`null` / Automatic) are shown read-only with an explanation and omitted from `requestOptions`.
    - Alias `nIterations` is canonicalised to `maxIter` on import and never rendered or emitted.

#### C. Persisted state (`STORAGE_VERSION = 2`)

In `src/types/state.ts`:

- `export const STORAGE_VERSION = 2;`
- `export type HyperparameterValue = number | string | boolean | null | number[] | Record<string, number>;`
- `export interface HyperparameterConfig { mode: 'manual' | 'tuning'; values: Record<string, HyperparameterValue>; }` (Phase 5 will add optional tuning fields).
- Pure v1→v2 migration in `src/stores/persister.ts` preserves dataset, target, and models, canonicalising `nIterations` to `maxIter` and clearing unsupported legacy `priors`/`classPrior` arrays to `null`.

#### D. Lit component API (`<app-model-configuration>`)

- **Tier:** 2 (Presentational), `src/features/models/app-model-configuration.ts`, tag `app-model-configuration`.
- **Properties (`attribute: false`):** `document: ModelDocument | null = null`, `value: HyperparameterConfig | null = null`, `multiclass: MulticlassStrategy | null = null`, `classLabels: readonly (string | number | boolean)[] = []`, `maxSampleCount = 0`, `status: 'loading' | 'ready' | 'error' = 'loading'`, `error = ''`, `disabled = false`, `labels: ConfigurationLabels = DEFAULT_CONFIGURATION_LABELS`.
- **Events (`bubbles: true, composed: true`):**
    - `app-model-configuration-change`: `detail: { config: HyperparameterConfig; requestOptions: Record<string, HyperparameterValue> }`
    - `app-model-configuration-continue`: `detail: { config: HyperparameterConfig; requestOptions: Record<string, HyperparameterValue> }`
    - `app-model-configuration-retry`: `detail: Record<string, never>`
- **Stories (`src/features/models/app-model-configuration.stories.ts`, `src/features/models/app-model-builder-view.stories.ts`):** `Logistic`, `MlpLayers`, `SvcGamma`, `ClassWeightsCustom`, `FixedAndInactive`, `Invalid`, `LoadError`, `Disabled`, `LongLabel`, `RTL`; builder `ConfigureModel`, `LongLabel`, `RTL`.

## Specification changes

- [ ] `specification/workflow-steps.md` §3.3 — Section 3 renders native controls from `web-ml` JSON metadata + app presentation policy, shows read-only multiclass capability, and saves canonical `options`-shaped values; status remains partial.
- [ ] `specification/state-and-storage.md` §3, §8 — `STORAGE_VERSION = 2`, widened `HyperparameterValue` (`null` and `Record<string, number>`), and v1→v2 migration; status remains draft.
- [ ] `specification/components/model-configuration.md` (new) & `specification/README.md` — closed API, events, stories, and accessibility rules for `app-model-configuration`; status implemented.
- [ ] `specification/TODO.md`, `specification/HUMAN.md` — update TODO-05 (manual subset) and record the upstream `web-ml` JSON/prose discrepancies.

## Implementation tasks

### T1 — Publish and decode `web-ml` model specification JSON

- **Depends on:** None
- **Risk:** needs care — manifest and decoders are the runtime trust boundary for generated controls.
- **Likely files:** `scripts/build-model-assets.ts`, `scripts/build-assets.ts`, `src/types/model-document.ts`, `src/features/models/model-documents.ts`, `tests/model-assets.test.ts`, `tests/model-documents.test.ts`
- **Must not touch:** `src/stores/`, `src/types/state.ts`, `node_modules/`, `bun.lock`
- **Implementation:** Implement `buildModelAssets(outDir)` in `scripts/build-model-assets.ts`, wire into `scripts/build-assets.ts`, and implement narrow decoders and revision-cached fetch loaders in `src/features/models/model-documents.ts`.
- **Acceptance criteria:**
    - [ ] `WML-P1-DOC-1` — Build generates `/models/index.json` and `/models/<revision>/specs/<id>.json` for all supervised models in scope; `LogisticRegression` `threshold` default `0.5` is asserted at build time.
    - [ ] `WML-P1-DOC-2` — Loader rejects non-OK responses, non-JSON content types, payloads $> 256\text{ KiB}$, unknown schema versions, and prototype keys (`__proto__`, `constructor`, `prototype`); successful responses are cached by revision.
- **Verification:** `bun test tests/model-assets.test.ts tests/model-documents.test.ts`; `bun run check`; `bun run build`.
- **Progress:** [ ] Not started

### T2 — Implement presentation policy and `options`-compatible normaliser

- **Depends on:** T1
- **Risk:** needs care — must resolve `web-ml` JSON vs prose conflicts (`learningRate`, `nIterations`, `threshold`, NB priors) so `requestOptions` is always valid for `TrainingOptionsFor<A>`.
- **Likely files:** `src/features/models/model-presentation-policy.ts`, `src/features/models/model-options.ts`, `scripts/build-model-assets.ts`, `tests/model-options.test.ts`, `tests/model-assets.test.ts`
- **Must not touch:** `src/stores/`, `src/types/state.ts`, `node_modules/`
- **Implementation:** Encode the option policy and `normaliseModelOptions` so every canonical option is covered at build time and `requestOptions` matches `Partial<TrainingOptionsFor<A>>`.
- **Acceptance criteria:**
    - [ ] `WML-P1-OPT-1` — Every option in the model JSON documents is classified; `learningRate` is editable under `sgd` (for both Logistic and MLP) and omitted from `requestOptions` under `adam`/`lbfgs`/`coordinate_descent`; `threshold` and NB priors are fixed and omitted; `nIterations` canonicalises to `maxIter`.
    - [ ] `WML-P1-OPT-2` — `null`, `false`, `0`, and omitted stay distinct; inactive dependent options remain in `overrides` but are excluded from `requestOptions`; type-check proves `requestOptions` is assignable to `web-ml` option types.
- **Verification:** `bun test tests/model-options.test.ts tests/model-assets.test.ts`; `bun run check`; `bun run build`.
- **Progress:** [ ] Not started

### T3 — Widen `HyperparameterValue` state to v2 and add model document resource store

- **Depends on:** T2
- **Risk:** needs care — preserves persisted v1 state while updating all typechecked test fixtures.
- **Likely files:** `src/types/state.ts`, `src/stores/app.store.ts`, `src/stores/persister.ts`, `src/stores/model-resources.store.ts`, `tests/state-and-storage.test.ts`, `tests/model-configuration-state.test.ts`
- **Must not touch:** `src/router/`, `src/common/storage/db.ts`, `src/features/`
- **Implementation:** Widen `HyperparameterValue` to include `null` and `Record<string, number>`, bump `STORAGE_VERSION = 2` with pure v1→v2 migration in `src/stores/persister.ts`, update `setHyperparameters` to invalidate downstream steps only on effective changes, and create `src/stores/model-resources.store.ts`.
- **Acceptance criteria:**
    - [ ] `WML-P1-STATE-1` — Scalar, `null`, `number[]`, and `Record<string, number>` hyperparameter values round-trip through `localStorage`; prototype keys and non-finite numbers are rejected; v1 state migrates cleanly to v2; higher versions stay read-only.
    - [ ] `WML-P1-STATE-2` — No-op `setHyperparameters` calls preserve downstream `completedSteps`; effective changes invalidate `'configure-training'` onward.
- **Verification:** `bun test tests/state-and-storage.test.ts tests/model-configuration-state.test.ts`; `bun run check`.
- **Progress:** [ ] Not started

### T4 — Render `<app-model-configuration>` in Section 3 with stories and E2E tests

- **Depends on:** T3
- **Risk:** needs care — dependent field validation, focus management, i18n, and existing E2E setup tests (`tests/models-setup.e2e.ts` and `tests/journeys/*.e2e.ts`) must stay green.
- **Likely files:** `src/features/models/app-model-configuration.ts`, `src/features/models/app-model-configuration.stories.ts`, `src/features/models/app-model-builder-view.ts`, `src/features/models/app-model-builder-view.stories.ts`, `src/features/models/model-catalogue.ts`, `specification/mockups/ui-scaffold/drafts/03-4_train-models-3-configure-model.html`, `tests/model-configuration.e2e.ts`, `tests/models-setup.e2e.ts`, `tests/model-catalogue.test.ts`, `tests/journeys/iris-classification.e2e.ts`, `tests/journeys/penguins-classification.e2e.ts`
- **Must not touch:** `css/root.css`, `src/features/models/app-model-card.ts`, `src/features/target/`
- **Implementation:** Clean up contradictory blocks in draft `03-4_train-models-3-configure-model.html` (`../mockups.css`, custom Gaussian priors, broken `aria-labelledby`), implement `<app-model-configuration>`, wire Section 3 of `<app-model-builder-view>`, update `tests/models-setup.e2e.ts` (`MOD-SETUP-2`/`3`/`4`) and journey assertions for Section 3 being active instead of pending, and add Storybook stories.
- **Acceptance criteria:**
    - [ ] `WML-P1-UI-1` — All option control shapes render from real model documents, commit valid `options`-shaped values to `$appState`, and complete Section 3 (`configure-model`) on Continue.
    - [ ] `WML-P1-UI-2` — Invalid inputs block Continue with `aria-describedby` error messages and focus on the first invalid control; RTL, long-label, keyboard, 320 px, 200% zoom, and forced-colours checks pass.
    - [ ] `WML-P1-UI-3` — Co-located `app-model-configuration.stories.ts` and `app-model-builder-view.stories.ts` pass `bun run test:stories` (axe) in Chromium, Firefox, and WebKit.
- **Verification:** `bun run test:e2e tests/model-configuration.e2e.ts tests/models-setup.e2e.ts tests/journeys/iris-classification.e2e.ts tests/journeys/penguins-classification.e2e.ts tests/visual-parity.e2e.ts tests/a11y.e2e.ts`; `bun test tests/model-catalogue.test.ts tests/style-tokens.test.ts`; `bun run test:stories`; `bun run check`.
- **Progress:** [ ] Not started

### T5 — Sync specifications for Phase 1

- **Depends on:** T1, T2, T3, T4
- **Risk:** routine
- **Likely files:** `specification/workflow-steps.md`, `specification/state-and-storage.md`, `specification/components/model-configuration.md`, `specification/COMPONENTS.md`, `specification/README.md`, `specification/TODO.md`, `specification/HUMAN.md`, `specification/plans/README.md`, `specification/plans/web-ml-phase-1-configure-model.md`
- **Must not touch:** `src/`, `tests/`, `specification/mockups/`
- **Implementation:** Apply every item under _Specification changes_ and verify with `bun run plans:check`.
- **Acceptance criteria:**
    - [ ] Every item under _Specification changes_ is applied and ticked.
    - [ ] `bun run plans:check` and `bun run plans:task specification/plans/web-ml-phase-1-configure-model.md --check-complete` pass.
- **Verification:** `bun run plans:check specification/plans/web-ml-phase-1-configure-model.md`; `bun run plans:task specification/plans/web-ml-phase-1-configure-model.md --check-complete`; `bun run check`.
- **Progress:** [ ] Not started

## Verification and definition of done

- [ ] All task acceptance criteria met with test names starting with `WML-P1-*`.
- [ ] `bun run check`, `bun run build`, `bun run test:stories`, and Playwright E2E tests pass in Chromium, Firefox, and WebKit.
- [ ] `bun run format <changed files>` run on all edited files.
- [ ] Every _Specification changes_ item is ticked and synced.

## Risks and open questions

- **Blocking:** Confirm whether Phase 1–3 keeps `src/features/models/model-catalogue.ts` restricted to the 8 classification models (or consumes task/modality-filtered catalogues exported by `web-ml` once added upstream) and updates `tests/models-setup.e2e.ts` (`MOD-SETUP-4`), or also renders Phase 1 hyperparameter controls for the 6 regression models currently in `model-catalogue.ts`.
- **Non-blocking:** Confirmed resolution for `HyperparameterValue` and `web-ml` JSON/prose conflicts: `HyperparameterValue` is widened to `number | string | boolean | null | number[] | Record<string, number>`, and `model-presentation-policy.ts` makes `learningRate` editable under `sgd` and read-only (`0.001`, omitted from `requestOptions`) under `adam`, hides deprecated alias `nIterations`, and keeps `threshold` (`0.5`) and Naive Bayes `priors`/`classPrior` (`Automatic`) read-only until `web-ml` updates its JSON/prose. Owner: human (`specification/HUMAN.md`).
- **Non-blocking:** KNN `nNeighbors <= fittingSampleCount` is checked against `dataset.rowCount` in Phase 1 and re-validated against the actual training partition size in Phase 2/3.

## Escalations

None.

## Review fixes

None.

## Implementation and verification log

| When (UTC)           | Task | Agent (model)                            | Outcome / commands / evidence                                                                                                                            |
| -------------------- | ---- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-17T21:23:45Z | —    | Google Antigravity (Gemini 4 Argon High) | Split Phase 1 from `web-ml-classification-integration.md`; scout-verified `web-ml@0.1.0` option types, JSON conflicts, and `samata-ml` store/test seams. |
| 2026-11-18T08:34:14Z | —    | Google Antigravity (Gemini 4 Argon High) | Adopted widened `HyperparameterValue` and presentation-policy resolution for `web-ml` JSON/prose discrepancies.                                          |

## Plan review history

| Reviewed (UTC) | Agent (model) | Decision | Findings |
| -------------- | ------------- | -------- | -------- |

## Change log

| When (UTC)           | Change                                 | Reason                                                                                                                                                                  |
| -------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-17T21:23:45Z | Initial draft                          | Created Phase 1 plan (manual hyperparameter selection and `options`-compatible state persistence) from the multi-phase split of `web-ml-classification-integration.md`. |
| 2026-11-18T08:34:14Z | Adopt `HyperparameterValue` resolution | User confirmed widening `HyperparameterValue` and applying the presentation policy for `learningRate`, `nIterations`, `threshold`, and NB priors.                       |
