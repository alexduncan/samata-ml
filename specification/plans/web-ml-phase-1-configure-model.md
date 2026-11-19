# Phase 1: Configure model and manual hyperparameter selection

**Status:** draft | **Updated:** 2026-11-19T11:04:26Z
**Authors:** Google Antigravity (Gemini 4 Argon High) | **Created:** 2026-11-17T21:23:45Z
**Verified by:** — | **Verified:** — | **Verification:** changes-requested
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour:** `src/features/models/app-model-builder-view.ts` (L1008–1031, L1085–1091) renders Section 3 (`3. Configure Model`) as `<p class="pending-notice">Not available yet.</p>`. `src/features/models/model-catalogue.ts` (L1–85) imports unsupervised (`k-means`, `pca`) and regression model specifications alongside the 8 classifiers. `src/types/state.ts` (L64–77) defines `HyperparameterValue = number | string | boolean | number[]` and `STORAGE_VERSION = 1`, which cannot represent `null` or `Record<string, number>` values required by `web-ml`'s `TrainingOptionsFor<A>` (`node_modules/web-ml/dist/src/training/types.d.ts` L185). `src/types/routes.ts` (L5) defines `ReservedPath = '/about' | '/privacy' | '/help'`, so clicking `<a href="/help/configure-model" class="help-link">` (`specification/mockups/ui-scaffold/drafts/03-4_train-models-3-configure-model.html` L207) redirects as an unknown route instead of opening the help modal. `scripts/build-assets.ts` does not publish `web-ml`'s model-specification JSON files to the build output, and no shared hyperparameter grid stylesheet or synchronised slider/numeric parameter input component exists.

**Target behaviour:** `src/features/models/model-catalogue.ts` is restricted to the 8 classification models (with an explicit `"No classification model available"` notice and link to `/target` in Section 1 when the active target is numeric). Section 3 (`3. Configure Model`) renders `<h2 id="step-3-title">3. Configure Model <a href="/help/configure-model" class="help-link">What do these settings mean?</a></h2>` (opening `content/en/pages/configure-model.md` in `<app-content-modal>`), presents a two-column `.field` CSS Grid form generated from `web-ml`'s canonical model-specification JSON documents, uses a reusable `<ui-parameter-input>` component (`linear`, `logarithmic`, and `integer` scales) for synchronised `<input type="range">` + `<input type="number">` controls and `.field-controls--with-action` for resettable numeric inputs, displays plain-English `<div class="field-description">` copy with `<abbr title="…">` glossary tooltips and `<p class="field-dependent">` dependency notes, validates dependent options, and saves the normalised manual configuration to `model.hyperparameters.values` in `localStorage` in the exact shape expected by `web-ml`'s `options` parameter (`Partial<TrainingOptionsFor<A>>`) upon clicking `Save & Continue`. Once completed, Section 3 displays `3. Model Configured` with an `Edit` button (`Reopen Configure Model`). Hyperparameter tuning is deferred to Phase 7 (`specification/plans/web-ml-phase-7-hyperparameter-tuning.md`).

**Why:** Decoupling manual hyperparameter selection (Phase 1) from training setup (Phase 2), training execution (Phase 3), results (Phases 4–6), and hyperparameter tuning (Phase 7) keeps each change small, testable, and aligned with `web-ml`'s public `options` contract and the UI design in commit `7fe505eaa6ec5428cdeafe264c7beb6c26c6cb64`.

## Scope

**In scope**

- Restricting `src/features/models/model-catalogue.ts` to the 8 classification models (`taskType === 'classification'`), removing unused unsupervised (`k-means`, `pca`) and regression JSON imports, rendering the `"No classification model available"` notice (`03-4` L629–633) when a numeric target is active in Section 1, and updating `tests/model-catalogue.test.ts` and `tests/models-setup.e2e.ts` (`MOD-SETUP-4`).
- Build-time validation and publication of `web-ml` classification model-specification JSON (`web-ml/model-specifications`, `web-ml/model-specifications/schema`, `web-ml/model-specifications/*`) to `/models/<revision>/` with a same-origin manifest `/models/index.json`.
- Narrow runtime decoder and revision-keyed loader (`src/features/models/model-documents.ts`) with resource store state (`src/stores/model-resources.store.ts`).
- Presentation policy, slider scale configuration (`linear`, `logarithmic`, `integer`), and option normaliser (`src/features/models/model-presentation-policy.ts`, `src/features/models/model-options.ts`) producing `requestOptions` directly compatible with `Partial<TrainingOptionsFor<A>>`.
- Widening `HyperparameterValue` in `src/types/state.ts` and `src/stores/persister.ts` to `number | string | boolean | null | number[] | Record<string, number>`, migrating persisted state (`STORAGE_VERSION = 2`), and adding `/help/configure-model` to `ReservedPath` and `RESERVED_CONTENT` with `content/en/pages/configure-model.md`.
- Shared style module `src/styles/hyperparameters.styles.ts` (porting `specification/mockups/ui-scaffold/css/hyperparameters.css` and shadow-root `input`/`select` rules from `base.css` with token and logical-property translations), `.help-link` in `src/styles/train-model.styles.ts`, and reusable Tier 2 `<ui-parameter-input>` (`src/components/ui-parameter-input.ts`) supporting synchronised `<input type="range">` + `<input type="number">` across `linear`, `logarithmic`, and `integer` scales.
- Presentational `<app-model-configuration>` Lit component (`src/features/models/app-model-configuration.ts`) using `.field` grid markup, `<abbr title="…">` glossary tooltips, `.field-dependent` notes, and `Save & Continue`, wired into Section 3 of `<app-model-builder-view>`, with co-located Storybook stories and three-browser Playwright E2E tests.

**Out of scope**

- Regression model configuration and training (deferred until regression phases are commissioned; `model-catalogue.ts` is classification-only in Phases 1–7).
- Hyperparameter tuning search-space UI, strategy controls, and `tuningSearchSpace` editing (enabled in Phase 7: `specification/plans/web-ml-phase-7-hyperparameter-tuning.md`; the `Mode` `<select>` renders `Random Search (advanced)` as a `disabled` `<option value="tuning" disabled>` in Phase 1 per `03-4` L224–227).
- Step 4 (`4. Training Setup`) UI and `ValidationMethodology` updates (Phase 2: `specification/plans/web-ml-phase-2-training-setup.md`).
- Worker/WASM runtime copying, COOP/COEP headers, and model training execution (Phase 3: `specification/plans/web-ml-phase-3-model-training.md`).
- Results rendering and comparison (Phases 4–6).
- User-entered Naive Bayes class prior arrays (`priors`, `classPrior`) and editable Logistic Regression decision `threshold` until `web-ml` documents fitted class sort order and positive-label precedence.

**Constraints and invariants**

- Strict TypeScript, Bun only, TSDoc on all exported symbols (`specification/standards-and-documentation.md`).
- Native semantic controls, Baseline Widely available features, WCAG 2.2 AA, British English, and `@nanostores/i18n` localisation (`specification/COMPONENTS.md` §1, §7, §8).
- Plain-English hyperparameter descriptions with `<abbr title="…">` technical-term tooltips must be rendered via structured Lit template data (never `unsafeHTML` or `innerHTML`, per `specification/COMPONENTS.md` §4 L75).
- Reusable components in `src/components/` must use the `ui-` tag prefix (`ui-parameter-input`, class `UiParameterInput` in `src/components/ui-parameter-input.ts`) to satisfy `specification/COMPONENTS.md` §1 and `tests/repository-conventions.test.ts` (`CONV-1..CONV-4`).
- Never read `../web-ml/src/**` or `../web-ml/specification/internals/`; never modify `../web-ml`, `node_modules/`, `bun.lock`, or normative mockups outside `specification/mockups/ui-scaffold/drafts/`.

## Required reading

- `specification/COMPONENTS.md` §1–§11; `specification/visual-design.md` §1.1, §2–§6 — Lit component tiers, `ui-` / `app-` prefix rules, token-only CSS, deviation registers (`A11Y-07`, `A11Y-08`), and Storybook rules for T4 and T5.
- `specification/workflow-steps.md` §3.1–§3.3; `specification/state-and-storage.md` §3–§8; `specification/app-state-and-navigation.md` §3.1, §6; `specification/content-and-i18n.md` §2 — model builder lifecycle, persistence, reserved content routes, and section reopening.
- `specification/notes/ui-fixes.md` L104–269 — proposed `.field` grid markup, plain-English `fieldDesc` with `<abbr>` tooltips, `fieldDependency` notes, range/number synchronisation rules, and `linear` / `logarithmic` / `integer` slider scales.
- `specification/mockups/ui-scaffold/css/hyperparameters.css`, `specification/mockups/ui-scaffold/css/train-model.css` L60–64, `specification/mockups/ui-scaffold/css/base.css` L30–81 — mockup styles for `.field`, `.field-name`, `.field-control`, `.field-controls`, `.field-controls--with-action`, `.field-description`, `.field-dependent`, `.tabs`, `.help-link`, and `input`/`select`.
- `specification/mockups/ui-scaffold/drafts/03-4_train-models-3-configure-model.html` L202–394, L611–633; `specification/mockups/ui-scaffold/drafts/03-5_train-models-4-configure-training.html` L202–230 — active and completed Section 3 structure and Section 1 no-classifier state.
- `../web-ml/specification/public-api/current-limitations.md` L9–55 (classifier capabilities, multiclass strategies), L180–185 (NB prior order).
- `../web-ml/specification/public-api/hyperparameters.md` L25–55, L114–173 (LogisticRegression, MLPClassifier), L197–217 (DecisionTreeClassifier), L236–255 (KNeighborsClassifier), L275–329 (Naive Bayes), L330–355 (SVC).
- `../web-ml/specification/public-api/model-specifications/README.md`, `schema.json`, `index.json`, and `models/*.json`.
- `node_modules/web-ml/dist/src/training/types.d.ts` L50–190 (`TrainingRequest`, `TrainingOptionsFor`), `node_modules/web-ml/dist/src/types.d.ts` L66 (`ClassificationLabel`), L147 (`ClassWeight`).

## Codebase context

- **Relevant specifications:** `specification/workflow-steps.md` (partial), `specification/state-and-storage.md` (draft), `specification/app-state-and-navigation.md` (draft), `specification/content-and-i18n.md` (partial), `specification/visual-design.md` (partial), `specification/COMPONENTS.md` (partial).
- **Relevant implementation:**
    - `src/features/models/model-catalogue.ts` (L1–85: currently imports 16 model specs including `k-means` L7 and `pca` L15, exports `SUPERVISED_MODELS` with 14 entries and `modelsForTarget`).
    - `src/features/models/app-model-builder-view.ts` (L301–355 model description dialog; L414–458 `handleReopenClick` / `handleConfirmReopen` which currently only checks `'choose-model'` and `'select-features'`; L676–832 `renderChooseModelSection` which lacks an empty-state branch when `availableModels.length === 0`; L1008–1031 `renderPendingSection`; L1054–1091 Section 3 call site).
    - `src/features/models/app-models-view.ts` (L280–282: formats `Configuration` column as `isConfigured ? model.hyperparameters.mode : 'Not configured'`).
    - `src/types/state.ts` (L13 `STORAGE_VERSION = 1`, L64–77 `HyperparameterValue` and `HyperparameterConfig`), `src/stores/app.store.ts` (`setHyperparameters` L497, `setMulticlassStrategy` L522, `completeSection` L571, `reopenSection` L613), `src/stores/persister.ts` (L111–117, L236–250, L319–325).
    - `src/types/routes.ts` (L5 `ReservedPath`), `src/router/reserved-content.ts` (L7–11 `RESERVED_CONTENT`), `src/router/route-parser.ts` (L36–38), `src/router/router.ts` (L55–62 `getDocumentTitle`), `src/features/shell/app-content-modal.ts` (L134–140), `scripts/build-content.ts` (L480–486 verifies every `RESERVED_CONTENT` entry exists in `baseMaps.pages`).
    - `src/styles/train-model.styles.ts` (L1–101: missing `.help-link`), `src/styles/global.ts` (L1–29: adopts shared stylesheets), `css/base.css` (L1–29: has no `input` or `select` rules).
- **Verified `web-ml@0.1.0` option contracts (`node_modules/web-ml/dist/src/training/types.d.ts` L185):**
    - Every classifier's JSON option names in `../web-ml/specification/public-api/model-specifications/models/*.json` match its TypeScript `Options` interface (`LogisticRegressionOptions`, `MLPClassifierOptions`, `DecisionTreeClassifierOptions`, `KNeighborsClassifierOptions`, `GaussianNBOptions`, `MultinomialNBOptions`, `BernoulliNBOptions`, `SVCOptions`).
    - Option value types across the 8 classifier interfaces: `number`, `boolean`, string literal enums, `'scale' | 'auto' | number` (`SVCOptions['gamma']`), `number | null` (`maxDepth`, `binarize`), `number | readonly number[]` (`hiddenLayerSizes`), `readonly number[] | null` (`priors`, `classPrior`), and `ClassWeight = 'balanced' | Record<string | number, number> | null` (`classWeight` on Logistic and SVC, `dist/src/types.d.ts` L147).
- **Identified contradictions between `web-ml` JSON, `web-ml` prose/types, and `samata-ml` specs (resolved via `model-presentation-policy.ts`):**
    1. **MLP `learningRate` (`mlp-classifier.json` L68–76 vs `hyperparameters.md` L157 & `_base.d.ts` L19):** `mlp-classifier.json` sets `defaultKind: "fixed"`, `default: 0.001` with no `defaultBy` or `appliesWhen`, whereas `hyperparameters.md` L157 states `"SGD step; Adam uses a fixed rate of 0.001"` and `MLPClassifierOptions` accepts `learningRate?: number`.
    2. **Logistic `learningRate` (`logistic-regression.json` L132–161 vs `hyperparameters.md` L128):** JSON applies `learningRate` when `"solver is 'sgd' or 'adam'"` (`defaultBy`: `sgd: 0.01`, `adam: 0.001`), whereas `hyperparameters.md` L128 states Adam uses a fixed rate of `0.001`.
    3. **Logistic `nIterations` alias (`logistic-regression.json` L163–173):** JSON defines both `maxIter` and deprecated alias `nIterations` (`aliasOf: "maxIter"`, `aliasPrecedence: "alias-wins"`).
    4. **Naive Bayes `priors`/`classPrior` (`current-limitations.md` L184–185):** Custom prior arrays follow fitted sorted observed-class order without defining the sort in public documentation.
    5. **Logistic `threshold` (`types.d.ts` L113 vs `hyperparameters.md` L38):** Declarations state the positive class is `classes_[1]`; prose states it is the second `classLabels` entry.
    6. **Multiclass strategy (`workflow-steps.md` §3.3 L163–169 vs `current-limitations.md` L13, L30–38):** In `web-ml` each classifier has a fixed strategy (Logistic `ovr`, SVC one-vs-one, others native) and no `multiclass` key exists in `TrainingOptionsFor<A>`.
    7. **KNN `nNeighbors` upper bound (`hyperparameters.md` L244):** `nNeighbors` must not exceed the fitting sample count (checked against `dataset.rowCount` in Phase 1 and re-validated against training partition size in Phase 2/3).
- **Tests and commands:** The unit test suite contains 220 tests across 31 files (`bun run check`). Note: `tests/router-and-navigation.test.ts` (L273, L295, L320, L541, L559, L581, L622) hardcodes literal `version: 1` in `$scrollState.set(...)` and must be updated to `STORAGE_VERSION` in T3 when `STORAGE_VERSION = 2`. Adding `'/help/configure-model': 'configure-model'` to `RESERVED_CONTENT` also requires adding `en/pages/configure-model.md` to `tests/fixtures/content/valid-en/` and `tests/fixtures/content/valid-multi/` and updating `tests/build-content.test.ts` (L45, L70, L145–146, L177) in T3.
- **Web guidance:** `forms`, `accessibility` — native labelled controls in `.field` CSS Grid, `<fieldset>`/`<legend>` or `role="group" aria-labelledby` for paired controls, continuous `input` synchronisation with draft text preserved during typing, validate on `blur` and submit, associate help/dependency/error text via `aria-describedby`, and move focus to the first invalid control on submit.
- **Visual reference:** `specification/mockups/ui-scaffold/03-3_train-models-2-select-features.html` — `src/styles/train-model.styles.ts`; `specification/mockups/ui-scaffold/css/hyperparameters.css` — `src/styles/hyperparameters.styles.ts`; Section 3 inner controls follow `specification/mockups/ui-scaffold/drafts/03-4_train-models-3-configure-model.html` and `03-5_train-models-4-configure-training.html` L202–230 (draft-only under `visual-design.md` §1.1, no new parity entries). Deviations applied when porting `hyperparameters.css`, `train-model.css`, and `base.css` control rules: `#fff` → `var(--surface)` (`visual-design.md` §2), `A11Y-07` (`1.5px solid var(--stone-600)` border on `input`/`select`), `A11Y-08` (`2px solid var(--focus-ring)` focus outline with `2px` offset), logical properties (`margin-inline-start`, `border-block-end`, `padding-block`), and `@media (prefers-reduced-motion: no-preference)`.
- **Domain skills:** `lit-component-implementer` for T4 and T5.
- **Assumptions requiring verification:** None — the user confirmed restricting `model-catalogue.ts` to the 8 classifiers and adding `/help/configure-model` to `ReservedPath` / `RESERVED_CONTENT` with `content/en/pages/configure-model.md`.

## Technical decisions

| Decision                                              | Chosen approach and rationale                                                                                                                                                                                                                                                                                                                                                                                                                                              | Rejected alternative / trade-off                                                                                                                                                                               |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 8 classifiers in `model-catalogue.ts`              | Restrict `SUPERVISED_MODELS` in `src/features/models/model-catalogue.ts` to the 8 `classification` models, remove unused `k-means`, `pca`, and regressor JSON imports, render the `"No classification model available"` notice with `<a href="/target">` (`03-4` L629–633) when a numeric target is active in Section 1, and update `MOD-CAT-1` and `MOD-SETUP-4`.                                                                                                         | Keeping 6 regressors in Step 1 while Phases 1–7 only implement classification leaves users unable to configure, train, or evaluate regression models.                                                          |
| D2 `options`-compatible state                         | Store normalised, active hyperparameter overrides in `model.hyperparameters.values` (`Record<string, HyperparameterValue>`) using canonical `web-ml` option keys and value types so Phase 3 can pass `normaliseModelOptions(...).requestOptions` directly as `options: Partial<TrainingOptionsFor<A>>`.                                                                                                                                                                    | Storing raw input strings or uncanonicalised aliases (`nIterations`) pushes form parsing and validation errors into Phase 3 worker execution.                                                                  |
| D3 JSON + policy hybrid & `.field` grid               | Use `web-ml` JSON for option inventory, names, enum values, aliases, and defaults; pair with `model-presentation-policy.ts` for slider scales (`linear`, `logarithmic`, `integer`), numeric bounds, applicability (`sgd` vs `adam`), reset-button fields (`tol`, `varSmoothing`, `minImpurityDecrease`, `coef0`, `p`, `randomState`), and fixed options (`threshold`, NB priors). Render every field in `<div class="field">` from `src/styles/hyperparameters.styles.ts`. | Blindly rendering JSON creates duplicate `nIterations` inputs, makes MLP `learningRate` uneditable under `sgd`, sends `learningRate` under `adam`, and lacks slider scale metadata.                            |
| D4 Reusable `<ui-parameter-input>` (`ui-` prefix)     | Implement the synchronised `<input type="range">` + `<input type="number">` control specified in `specification/notes/ui-fixes.md` L179–269 as a Tier 2 presentational component `<ui-parameter-input>` (`src/components/ui-parameter-input.ts`) supporting `linear`, `logarithmic`, and `integer` scales with canonical parameter `value` and draft text preservation during typing.                                                                                      | Using unprefixed `<parameter-input>` violates `COMPONENTS.md` §1 and fails `tests/repository-conventions.test.ts` (`CONV-2`), which requires reusable components in `src/components/` to use the `ui-` prefix. |
| D5 Plain-English `<abbr>` descriptions & dependencies | Represent each hyperparameter's plain-English description as structured translatable segments (`readonly (string \| { abbr: string; title: string })[]`) rendered into `<div id="{id}-help" class="field-description"><p>…</p></div>` alongside `<p class="field-dependent">` notes (e.g. under `Solver`: Adam's fixed `0.001` learning rate vs SGD).                                                                                                                      | Using `unsafeHTML` for `<abbr>` tags violates `COMPONENTS.md` §4 L75; raw `web-ml` JSON descriptions are too terse for non-technical learners.                                                                 |
| D6 `/help/configure-model` reserved route             | Add `'/help/configure-model'` to `ReservedPath` (`src/types/routes.ts`) and `RESERVED_CONTENT` (`'configure-model'`, `src/router/reserved-content.ts`) backed by `content/en/pages/configure-model.md`, so `<a href="/help/configure-model" class="help-link">What do these settings mean?</a>` in Section 3's header opens the help article in `<app-content-modal>`.                                                                                                     | Leaving `/help/configure-model` unrouted causes the router to treat it as an unknown path and redirect to `resumePath`.                                                                                        |
| D7 Mode select & manual-only Phase 1                  | Render the `Mode` `<select id="mode" name="mode" class="field-control">` at the top of `<app-model-configuration>` with `<option value="manual">Manual</option>` selected and `<option value="tuning" disabled>Random Search (advanced)</option>` disabled until Phase 7 (`03-4` L215–235); fix `model.hyperparameters.mode = 'manual'`.                                                                                                                                   | Omitting the disabled option hides the planned tuning mode shown in `03-4`; enabling tuning in Phase 1 reintroduces monolithic scope.                                                                          |
| D8 Multiclass & Presentational labels                 | Derive multiclass strategy (`native`, `one-vs-rest`, `one-vs-one`) from the model capability map, display it as read-only explanatory text when the target has > 2 classes, and persist it via `setMulticlassStrategy`. `<ui-parameter-input>` and `<app-model-configuration>` are Tier 2 presentational elements receiving typed `labels` properties with defaults; `<app-model-builder-view>` supplies localised strings via `i18n('app-model-builder-view', ...)`.      | Importing `i18n` or stores in Tier 2 elements violates `COMPONENTS.md` §2 and §8 L169.                                                                                                                         |

### Interfaces and behaviour

#### A. Published model documents (`/models/index.json`)

`scripts/build-model-assets.ts` exports `buildModelAssets(outDir: string): Promise<ModelAssetReport>`, wired into `scripts/build-assets.ts`. It reads `web-ml/model-specifications`, `web-ml/model-specifications/schema`, and `web-ml/model-specifications/*` for the 8 classification models in `SUPERVISED_MODELS`, validates `schemaVersion === 1` and option policy coverage, and writes `/models/index.json` (`{ schemaVersion: 1, revision, libraryVersion, models: [{ id, taskType, specUrl }] }`) plus `/models/<revision>/specs/<id>.json`.

`src/features/models/model-documents.ts` exports `loadModelDocuments(signal?: AbortSignal): Promise<ModelDocuments>` and `loadModelDocument(id: string, signal?: AbortSignal): Promise<ModelDocument>`, enforcing `response.ok`, JSON content type, size $\le 256\text{ KiB}$, and prototype-key rejection (`__proto__`, `constructor`, `prototype`). `src/stores/model-resources.store.ts` exposes `$modelDocumentState` and actions `loadConfiguration(modelNum)` / `retryConfiguration(modelNum)`.

#### B. Option policy, slider scales, normaliser, and `options` type alignment

`src/features/models/model-options.ts` exports `normaliseModelOptions(document: ModelDocument, overrides: Readonly<Record<string, HyperparameterValue>>, context: ModelOptionContext): NormalisedModelOptions`:

- Returns `{ effective, requestOptions, fields, issues }`, where `requestOptions` contains **only** active, canonical keys valid for `TrainingOptionsFor<A>`:
    - **Enum → `<select class="field-control">`:** `solver`, `penalty`, `activation`, `criterion`, `weights`, `metric`, `kernel`. Singleton enums (`multiClass: 'ovr'`, `algorithm: 'brute'`) render as read-only `.field-dependent` / `.form-note` notes.
    - **Boolean → `<input type="checkbox" class="field-control">`:** `fitIntercept`, `forceAlpha`, `fitPrior`, `probability`; `multiLabel` is fixed `false`.
    - **Synchronised slider + number (`<ui-parameter-input>`) by scale (`ui-fixes.md` L204–240):**
        - `scale: 'integer'`:
            - `maxIter` (Logistic default `1000`, MLP default `200`): slider `min = 1`, `max = 5000`, `step = 1`; integer $\ge 1$.
            - `nNeighbors` (KNN default `5`): slider `min = 1`, `max = Math.max(1, Math.min(50, maxSampleCount || 50))`, `step = 1`; integer `1..maxSampleCount`.
            - `minSamplesSplit` (Decision Tree default `2`): slider `min = 2`, `max = 100`, `step = 1`; integer $\ge 2$.
            - `minSamplesLeaf` (Decision Tree default `1`): slider `min = 1`, `max = 100`, `step = 1`; integer $\ge 1$.
            - `degree` (SVC default `3`, active when `kernel === 'poly'`): slider `min = 0`, `max = 10`, `step = 1`; integer $\ge 0$.
            - `maxDepth` (Decision Tree when mode is `'value'`, default `10` when switched from `null`): slider `min = 1`, `max = 50`, `step = 1`; integer $\ge 1$.
        - `scale: 'logarithmic'` (slider position is base-10 exponent $e \in [\log_{10}(\text{min}), \log_{10}(\text{max})]$, value $= 10^e$, `precision = 6`):
            - `learningRate` (Logistic default `0.01`, MLP default `0.001`, editable when `solver === 'sgd'`): slider `min = 1e-6`, `max = 1`, exponent `-6..0`, `step = 0.1`; number $> 0$. When `solver === 'adam'`, `learningRate` is omitted from `requestOptions` and reported under `Solver` via `<p class="field-dependent">Adam uses a fixed learning rate of 0.001. Select SGD to adjust the rate.</p><p class="field-dependent">Learning rate: 0.001 (fixed by Adam)</p>` (`03-4` L259–265). When `solver` is `'lbfgs'` or `'coordinate_descent'`, `learningRate` is inactive and omitted.
            - `C` (Logistic when `penalty !== 'none'`, SVC; default `1`): slider `min = 1e-4`, `max = 1e4`, exponent `-4..4`, `step = 0.1`; number $> 0$.
            - `alpha` (MultinomialNB and BernoulliNB; default `1`): slider `min = 1e-4`, `max = 1e2`, exponent `-4..2`, `step = 0.1`; exact numeric input accepts any finite number $\ge 0$ (when `0` is entered manually, slider clamps to `min` while canonical value stays `0`).
            - `gamma` (SVC when mode is `'number'`, default `0.1` when switched from `'scale'`/`'auto'`): slider `min = 1e-4`, `max = 1e2`, exponent `-4..2`, `step = 0.1`; exact numeric input accepts finite number $\ge 0$.
        - `scale: 'linear'`:
            - `l1Ratio` (Logistic when `penalty === 'elasticnet'`, default `0.5`): slider `min = 0`, `max = 1`, `step = 0.01`; number in `[0, 1]`.
    - **Numeric input with Reset action (`.field-controls.field-controls--with-action`, `03-4` L360–386):**
        - `tol` (Logistic conditional `1e-6` / `1e-4`, MLP `1e-6`, SVC `0.001`), `varSmoothing` (GaussianNB `1e-9`), `minImpurityDecrease` (Decision Tree `0`), `coef0` (SVC `0`, active when `kernel` is `'poly'` or `'sigmoid'`), `p` (KNN `2`, active when `metric === 'minkowski'`, finite $\ge 1$), and `randomState` (MLP optional uint32 `0..4294967295`, blank/reset for random) render `<input type="number">` paired with `<button type="button" class="btn">Reset {name}</button>`.
    - **Nullable & union mode controls:**
        - `maxDepth` (Decision Tree): mode `<select class="field-control">` (`'null'` Unlimited vs `'value'` revealing `<ui-parameter-input scale="integer">`).
        - `binarize` (BernoulliNB): mode `<select class="field-control">` (`'null'` Disabled / pre-binary vs `'value'` revealing `<input type="number">` + Reset button, default `0`).
        - `gamma` (SVC): mode `<select class="field-control">` (`'scale'`, `'auto'`, or `'number'` revealing `<ui-parameter-input scale="logarithmic">`).
    - **Structured controls:**
        - `hiddenLayerSizes` (MLP, default `[100]`): `<fieldset>` list editor inside `.field-controls` with per-layer `<input type="number" min="1" step="1">` and `Add layer` / `Remove layer {n}` `.btn` controls, producing a non-empty `number[]` of positive integers.
        - `classWeight` (Logistic and SVC, default `null`): mode `<select class="field-control">` (`'null'` None, `'balanced'` Balanced, or `'custom'` Custom per-class `<input type="number" min="0" step="any">` inputs keyed by observed class labels).
    - **Fixed options:** Logistic `threshold` (`0.5`), GaussianNB `priors` (`null` / Automatic), and MultinomialNB/BernoulliNB `classPrior` (`null` / Automatic) are explained in `.field-dependent` / `.form-note` text and omitted from `requestOptions`.
    - **Aliases:** `nIterations` is canonicalised to `maxIter` on import and never rendered or emitted.

#### C. Persisted state (`STORAGE_VERSION = 2`) and `/help/configure-model` route

- In `src/types/state.ts`:
    - `export const STORAGE_VERSION = 2;`
    - `export type HyperparameterValue = number | string | boolean | null | number[] | Record<string, number>;`
    - `export interface HyperparameterConfig { mode: 'manual' | 'tuning'; values: Record<string, HyperparameterValue>; tuningSearchSpace?: Record<string, HyperparameterValue[]>; }`
- Pure v1→v2 migration in `src/stores/persister.ts` preserves dataset, target, and models, canonicalising `nIterations` to `maxIter` and clearing unsupported legacy `priors`/`classPrior` arrays to `null`.
- In `src/types/routes.ts` and `src/router/reserved-content.ts`:
    - `export type ReservedPath = '/about' | '/privacy' | '/help' | '/help/configure-model';`
    - `RESERVED_CONTENT['/help/configure-model'] = 'configure-model'` backed by `content/en/pages/configure-model.md`.

#### D. Lit component APIs (`<ui-parameter-input>` and `<app-model-configuration>`)

1. **`<ui-parameter-input>` (`src/components/ui-parameter-input.ts`)**
    - **Tier:** 2 (Presentational), tag `ui-parameter-input`, class `UiParameterInput`.
    - **Properties:**
        - `parameterId = ''` (`@property({ type: String, attribute: 'parameter-id' })`)
        - `name = ''` (`@property({ type: String })`) — applied **only** to `<input type="number">`.
        - `value = 0` (`@property({ type: Number })`) — canonical parameter value (never the log10 exponent).
        - `min = 0` (`@property({ type: Number })`)
        - `max = 1` (`@property({ type: Number })`)
        - `step = 1` (`@property({ type: Number })`) — slider increment (on the value for `linear`/`integer`; on the base-10 exponent for `logarithmic`, default `0.1`).
        - `scale: ParameterScale = 'linear'` (`@property({ type: String })`, `'linear' | 'logarithmic' | 'integer'`).
        - `precision = 6` (`@property({ type: Number })`) — significant digits / decimal precision for logarithmic formatting.
        - `allowZero = false` (`@property({ type: Boolean, attribute: 'allow-zero' })`) — allows exact `0` in the number input for non-negative logarithmic parameters (`alpha`, numeric `gamma`).
        - `disabled = false` (`@property({ type: Boolean, reflect: true })`)
        - `invalid = false` (`@property({ type: Boolean, reflect: true })`)
        - `labelId = ''` (`@property({ type: String, attribute: 'label-id' })`)
        - `describedBy = ''` (`@property({ type: String, attribute: 'described-by' })`)
        - `exactValueLabel = ''` (`@property({ type: String, attribute: 'exact-value-label' })`)
    - **Methods:** `focusNumberInput(): void` (focuses the inner `<input type="number">` when validation fails).
    - **Events (`bubbles: true, composed: true`):**
        - `ui-parameter-input-change`: `detail: { name: string; value: number | null; rawValue: string; valid: boolean }`
    - **Synchronisation semantics (`ui-fixes.md` L179–269):**
        - Range slider `input` event converts slider position (`value` for `linear`, `Math.round(value)` for `integer`, `Number((10 ** exponent).toPrecision(this.precision))` for `logarithmic`), clears `draftText`, updates canonical `value`, and dispatches `ui-parameter-input-change` (`valid: true`).
        - Number input `input` event updates `@state() private accessor draftText`; if the text parses to a finite number satisfying scale/bound constraints, immediately updates canonical `value` (and slider position) and dispatches `ui-parameter-input-change` (`valid: true`); if incomplete or invalid while typing, preserves `draftText` without corrupting canonical `value` or slider and dispatches `ui-parameter-input-change` (`value: null, valid: false`).
        - Number input `blur` event normalises formatting if valid or marks the control invalid (`aria-invalid="true"`) so parent form validation can display the error message in `aria-describedby`.
    - **Stories (`src/components/ui-parameter-input.stories.ts`):** `Linear`, `Logarithmic`, `Integer`, `ManualBetweenSteps`, `InvalidDraft`, `Disabled`, `LongLabel`, `RTL`.

2. **`<app-model-configuration>` (`src/features/models/app-model-configuration.ts`)**
    - **Tier:** 2 (Presentational), tag `app-model-configuration`, class `AppModelConfiguration`.
    - **Properties (`attribute: false`):** `document: ModelDocument | null = null`, `value: HyperparameterConfig | null = null`, `multiclass: MulticlassStrategy | null = null`, `classLabels: readonly (string | number | boolean)[] = []`, `maxSampleCount = 0`, `status: 'loading' | 'ready' | 'error' = 'loading'`, `error = ''`, `disabled = false`, `labels: ConfigurationLabels = DEFAULT_CONFIGURATION_LABELS`.
    - **Events (`bubbles: true, composed: true`):**
        - `app-model-configuration-change`: `detail: { config: HyperparameterConfig; requestOptions: Record<string, HyperparameterValue> }`
        - `app-model-configuration-continue`: `detail: { config: HyperparameterConfig; requestOptions: Record<string, HyperparameterValue> }`
        - `app-model-configuration-retry`: `detail: Record<string, never>`
    - **Stories (`src/features/models/app-model-configuration.stories.ts`, `src/features/models/app-model-builder-view.stories.ts`, `src/styles/hyperparameters.styles.stories.ts`):** `Logistic`, `MlpLayers`, `SvcGamma`, `ClassWeightsCustom`, `FixedAndInactive`, `Invalid`, `LoadError`, `Disabled`, `LongLabel`, `RTL`; builder `ConfigureModel`, `NoClassifierNumericTarget`, `LongLabel`, `RTL`; style primitive stories for `.field` and `.tabs`.

## Specification changes

- [ ] `specification/workflow-steps.md` §3.1, §3.3 — Section 1 restricts `model-catalogue.ts` to the 8 classifiers (showing `"No classification model available"` with a link to `/target` for numeric targets); Section 3 renders `.help-link` (`/help/configure-model`), `.field` CSS Grid controls with `<ui-parameter-input>` (`linear`, `logarithmic`, `integer` scales), `.field-controls--with-action` reset buttons, plain-English descriptions with `<abbr title="…">` tooltips, `.field-dependent` notes, read-only multiclass capability, `Save & Continue`, and `3. Model Configured` completed header; status remains partial.
- [ ] `specification/state-and-storage.md` §3, §8 — `STORAGE_VERSION = 2`, widened `HyperparameterValue` (`null` and `Record<string, number>`), and v1→v2 migration; status remains draft.
- [ ] `specification/app-state-and-navigation.md` §3.1 & `specification/content-and-i18n.md` §2 — Add `/help/configure-model` to `ReservedPath` and `RESERVED_CONTENT` (`'configure-model'`, backed by `content/en/pages/configure-model.md`); status remains draft / partial.
- [ ] `specification/visual-design.md` §3 — Map `specification/mockups/ui-scaffold/css/hyperparameters.css` to `src/styles/hyperparameters.styles.ts` and `.help-link` in `train-model.css` to `src/styles/train-model.styles.ts`; status remains partial.
- [ ] `specification/components/parameter-input.md` (new), `specification/components/model-configuration.md` (new), & `specification/README.md` — Closed APIs, events, slider scales, stories, and accessibility rules for `ui-parameter-input` and `app-model-configuration`; status implemented.
- [ ] `specification/TODO.md`, `specification/HUMAN.md`, `specification/notes/ui-fixes.md` — Update TODO-05 (manual subset), record the resolved 8-classifier scope in `HUMAN.md`, and remove the consumed `## Hyperparamter Configuration` section from `specification/notes/ui-fixes.md`.

## Implementation tasks

### T1 — Restrict model catalogue to 8 classifiers and publish/decode `web-ml` model specification JSON

- **Depends on:** None
- **Risk:** needs care — manifest and decoders are the runtime trust boundary for generated controls, and removing unsupervised/regression imports from `model-catalogue.ts` fixes `tsc --noEmit` resolution of `k-means` and `pca`.
- **Likely files:** `src/features/models/model-catalogue.ts`, `scripts/build-model-assets.ts`, `scripts/build-assets.ts`, `src/types/model-document.ts`, `src/features/models/model-documents.ts`, `tests/model-catalogue.test.ts`, `tests/model-assets.test.ts`, `tests/model-documents.test.ts`
- **Must not touch:** `src/stores/`, `src/types/state.ts`, `node_modules/`, `bun.lock`
- **Implementation:** Restrict `src/features/models/model-catalogue.ts` to the 8 `classification` models (`taskType === 'classification'`), removing `k-means`, `pca`, and regression JSON imports and returning `[]` from `modelsForTarget('numeric')`. Update `tests/model-catalogue.test.ts` (`MOD-CAT-1`). Implement `buildModelAssets(outDir)` in `scripts/build-model-assets.ts`, wire into `scripts/build-assets.ts`, and implement narrow decoders and revision-cached fetch loaders in `src/features/models/model-documents.ts`.
- **Acceptance criteria:**
    - [ ] `WML-P1-DOC-1` — `SUPERVISED_MODELS` exports the 8 classification models in library index order (`modelsForTarget('numeric')` returns `[]`); `bun run build` generates `/models/index.json` and `/models/<revision>/specs/<id>.json` for all 8 classifiers; `LogisticRegression` `threshold` default `0.5` is asserted at build time.
    - [ ] `WML-P1-DOC-2` — Loader rejects non-OK responses, non-JSON content types, payloads $> 256\text{ KiB}$, unknown schema versions, and prototype keys (`__proto__`, `constructor`, `prototype`); successful responses are cached by revision.
- **Verification:** `bun test tests/model-catalogue.test.ts tests/model-assets.test.ts tests/model-documents.test.ts`; `bun run check`; `bun run build`.
- **Progress:** [ ] Not started

### T2 — Implement presentation policy, slider scale mappings, and `options`-compatible normaliser

- **Depends on:** T1
- **Risk:** needs care — must resolve `web-ml` JSON vs prose conflicts (`learningRate`, `nIterations`, `threshold`, NB priors) and define slider scales (`linear`, `logarithmic`, `integer`) and resettable controls so `requestOptions` is always valid for `TrainingOptionsFor<A>`.
- **Likely files:** `src/features/models/model-presentation-policy.ts`, `src/features/models/model-options.ts`, `scripts/build-model-assets.ts`, `tests/model-options.test.ts`, `tests/model-assets.test.ts`
- **Must not touch:** `src/stores/`, `src/types/state.ts`, `node_modules/`
- **Implementation:** Encode the option presentation policy (control kind, `linear`/`logarithmic`/`integer` scale config, `.field-controls--with-action` resettable numeric inputs, applicability, plain-English description keys with `<abbr>` term references, and `.field-dependent` note keys) and `normaliseModelOptions` so every canonical option across the 8 classifiers is covered at build time and `requestOptions` matches `Partial<TrainingOptionsFor<A>>`.
- **Acceptance criteria:**
    - [ ] `WML-P1-OPT-1` — Every option in the 8 classifier JSON documents is classified with its control shape and scale (`linear` for `l1Ratio`; `logarithmic` for `learningRate`, `C`, `alpha`, numeric `gamma`; `integer` for `maxIter`, `nNeighbors`, `minSamplesSplit`, `minSamplesLeaf`, `degree`, numeric `maxDepth`; `number-with-reset` for `tol`, `varSmoothing`, `minImpurityDecrease`, `coef0`, `p`, `randomState`, numeric `binarize`); `learningRate` is editable under `sgd` (for both Logistic and MLP) and omitted from `requestOptions` under `adam`/`lbfgs`/`coordinate_descent`; `threshold` and NB priors are fixed and omitted; `nIterations` canonicalises to `maxIter`.
    - [ ] `WML-P1-OPT-2` — `null`, `false`, `0`, and omitted stay distinct; inactive dependent options remain in `overrides` but are excluded from `requestOptions`; type-check proves `requestOptions` is assignable to `web-ml` option types.
- **Verification:** `bun test tests/model-options.test.ts tests/model-assets.test.ts`; `bun run check`; `bun run build`.
- **Progress:** [ ] Not started

### T3 — Widen `HyperparameterValue` state to v2, add `/help/configure-model` reserved route, and add model document resource store

- **Depends on:** T2
- **Risk:** needs care — bumping `STORAGE_VERSION = 2` requires updating literal `version: 1` scroll fixtures in `tests/router-and-navigation.test.ts`, and adding `/help/configure-model` to `RESERVED_CONTENT` requires updating content build fixtures in `tests/fixtures/content/` and `tests/build-content.test.ts`.
- **Likely files:** `src/types/state.ts`, `src/types/routes.ts`, `src/router/reserved-content.ts`, `src/router/route-parser.ts`, `src/router/router.ts`, `src/features/shell/app-content-modal.ts`, `content/en/pages/configure-model.md`, `src/stores/app.store.ts`, `src/stores/persister.ts`, `src/stores/model-resources.store.ts`, `tests/fixtures/content/valid-en/en/pages/configure-model.md`, `tests/fixtures/content/valid-multi/en/pages/configure-model.md`, `tests/build-content.test.ts`, `tests/router-and-navigation.test.ts`, `tests/state-and-storage.test.ts`, `tests/model-configuration-state.test.ts`
- **Must not touch:** `src/common/storage/db.ts`, `src/features/models/`, `src/components/`
- **Implementation:** Widen `HyperparameterValue` to include `null` and `Record<string, number>`, bump `STORAGE_VERSION = 2` with pure v1→v2 migration in `src/stores/persister.ts`, update `tests/router-and-navigation.test.ts` scroll fixtures to use `STORAGE_VERSION`, update `setHyperparameters` to invalidate downstream steps only on effective changes, create `src/stores/model-resources.store.ts`, and add `'/help/configure-model'` to `ReservedPath`, `RESERVED_CONTENT`, `parseRoute`, `getDocumentTitle`, `app-content-modal.ts`, `content/en/pages/configure-model.md`, and content test fixtures.
- **Acceptance criteria:**
    - [ ] `WML-P1-STATE-1` — Scalar, `null`, `number[]`, and `Record<string, number>` hyperparameter values round-trip through `localStorage`; prototype keys and non-finite numbers are rejected; v1 state migrates cleanly to v2; higher versions stay read-only.
    - [ ] `WML-P1-STATE-2` — No-op `setHyperparameters` calls preserve downstream `completedSteps`; effective changes invalidate `'configure-training'` onward; `/help/configure-model` parses as a reserved route and builds cleanly in `buildContent()`.
- **Verification:** `bun test tests/state-and-storage.test.ts tests/model-configuration-state.test.ts tests/router-and-navigation.test.ts tests/build-content.test.ts`; `bun run check`; `bun run build`.
- **Progress:** [ ] Not started

### T4 — Port `hyperparametersStyles` and implement reusable `<ui-parameter-input>` with `linear`, `logarithmic`, and `integer` scales

- **Depends on:** T2
- **Risk:** needs care — bidirectional logarithmic conversion (`10 ** exponent` / `Math.log10(value)`), floating-point precision, and draft editing state during typing must never cause circular re-renders or corrupt the canonical value.
- **Likely files:** `src/styles/hyperparameters.styles.ts`, `src/styles/hyperparameters.styles.stories.ts`, `src/styles/train-model.styles.ts`, `src/styles/global.ts`, `src/components/ui-parameter-input.ts`, `src/components/ui-parameter-input.stories.ts`, `tests/parameter-input.test.ts`, `tests/parameter-input.e2e.ts`
- **Must not touch:** `css/root.css`, `src/stores/`, `src/features/`
- **Implementation:** Create `src/styles/hyperparameters.styles.ts` porting `specification/mockups/ui-scaffold/css/hyperparameters.css` and `input`/`select` control rules from `specification/mockups/ui-scaffold/css/base.css` L30–81 (translating `#fff` → `var(--surface)`, `A11Y-07` `1.5px solid var(--stone-600)` control border, `A11Y-08` `2px solid var(--focus-ring)` focus outline, logical properties, and `@media (prefers-reduced-motion: no-preference)`), adopt `hyperparametersStyles` in `src/styles/global.ts`, and add `.help-link` (`margin-inline-start: 0.5rem; font-weight: 400; font-size: 0.875rem`) to `src/styles/train-model.styles.ts`. Implement `<ui-parameter-input>` (`src/components/ui-parameter-input.ts`) and pure scale conversion utilities with unit tests, Playwright browser tests, and Storybook stories.
- **Acceptance criteria:**
    - [ ] `WML-P1-PARAM-1` — `<ui-parameter-input>` synchronises `<input type="range">` and `<input type="number">` on `input` across `linear`, `logarithmic`, and `integer` scales, keeps the actual parameter value as canonical `value`, applies `name` only to the numeric input, and sets `aria-valuetext` on logarithmic sliders.
    - [ ] `WML-P1-PARAM-2` — Logarithmic conversions are reversible within `precision` without floating-point artefacts; manually entered values between slider steps are preserved; incomplete or invalid text during typing is held in draft state without overwriting the input or corrupting the canonical value/slider.
    - [ ] `WML-P1-PARAM-3` — `hyperparameters.styles.stories.ts` and `ui-parameter-input.stories.ts` pass `bun run test:stories` (axe) and `bun test tests/style-tokens.test.ts tests/repository-conventions.test.ts`.
- **Verification:** `bun test tests/parameter-input.test.ts tests/style-tokens.test.ts tests/repository-conventions.test.ts`; `bun run test:e2e tests/parameter-input.e2e.ts`; `bun run test:stories`; `bun run check`.
- **Progress:** [ ] Not started

### T5 — Render `<app-model-configuration>` in Section 3 with `.field` grid, `<abbr>` descriptions, stories, and E2E tests

- **Depends on:** T3, T4
- **Risk:** needs care — dependent field validation, focus management, `<abbr title="…">` glossary rendering, Section 3 reopen confirmation (`handleReopenClick`), and existing E2E setup/journey tests (`tests/models-setup.e2e.ts` and `tests/journeys/*.e2e.ts`) must stay green.
- **Likely files:** `src/features/models/app-model-configuration.ts`, `src/features/models/app-model-configuration.stories.ts`, `src/features/models/app-model-builder-view.ts`, `src/features/models/app-model-builder-view.stories.ts`, `specification/mockups/ui-scaffold/drafts/03-4_train-models-3-configure-model.html`, `tests/model-configuration.e2e.ts`, `tests/models-setup.e2e.ts`, `tests/journeys/iris-classification.e2e.ts`, `tests/journeys/penguins-classification.e2e.ts`
- **Must not touch:** `css/root.css`, `src/features/models/app-model-card.ts`, `src/features/target/`
- **Implementation:** Clean up contradictory blocks in draft `03-4_train-models-3-configure-model.html` (custom Gaussian priors at L504–534 and broken `aria-labelledby="configuration-heading"` at L213), implement `<app-model-configuration>` using `hyperparametersStyles`, `<ui-parameter-input>`, `.field-controls--with-action` reset buttons, plain-English `<div class="field-description">` with `<abbr title="…">` glossary terms and `<p class="field-dependent">` notes, and `Save & Continue`. Wire Section 1's `"No classification model available"` empty state for numeric targets, Section 3's `.help-link` (`/help/configure-model`), completed header (`3. Model Configured`), and `handleReopenClick` support for `'configure-model'` in `<app-model-builder-view>`. Update `tests/models-setup.e2e.ts` (`MOD-SETUP-2`/`3`/`4`) and journey assertions for Section 3 being active instead of pending, and add Storybook stories.
- **Acceptance criteria:**
    - [ ] `WML-P1-UI-1` — All option control shapes render in `.field` grid layout from real model documents (including disabled `Random Search (advanced)` in `Mode`, `<ui-parameter-input>` sliders, reset buttons, `<abbr title="…">` tooltips, and `.field-dependent` notes), commit valid `options`-shaped values to `$appState`, and complete Section 3 (`configure-model`, showing `3. Model Configured` and `Edit`) on `Save & Continue`.
    - [ ] `WML-P1-UI-2` — Clicking `<a href="/help/configure-model" class="help-link">` opens the Configure Model help dialog; selecting a numeric target in Step 2 shows `"No classification model available"` with a link to `/target` in Section 1; invalid inputs block `Save & Continue` with `aria-describedby` error messages and focus on the first invalid control; RTL, long-label, keyboard, 320 px, 200% zoom, and forced-colours checks pass.
    - [ ] `WML-P1-UI-3` — Co-located `app-model-configuration.stories.ts` and `app-model-builder-view.stories.ts` pass `bun run test:stories` (axe) in Chromium, Firefox, and WebKit.
- **Verification:** `bun run test:e2e tests/model-configuration.e2e.ts tests/models-setup.e2e.ts tests/journeys/iris-classification.e2e.ts tests/journeys/penguins-classification.e2e.ts tests/visual-parity.e2e.ts tests/a11y.e2e.ts`; `bun test tests/style-tokens.test.ts tests/repository-conventions.test.ts`; `bun run test:stories`; `bun run check`.
- **Progress:** [ ] Not started

### T6 — Sync specifications for Phase 1

- **Depends on:** T1, T2, T3, T4, T5
- **Risk:** routine
- **Likely files:** `specification/workflow-steps.md`, `specification/state-and-storage.md`, `specification/app-state-and-navigation.md`, `specification/content-and-i18n.md`, `specification/visual-design.md`, `specification/components/parameter-input.md`, `specification/components/model-configuration.md`, `specification/COMPONENTS.md`, `specification/README.md`, `specification/TODO.md`, `specification/HUMAN.md`, `specification/notes/ui-fixes.md`, `specification/plans/README.md`, `specification/plans/web-ml-classification-integration.md`, `specification/plans/web-ml-phase-1-configure-model.md`
- **Must not touch:** `src/`, `tests/`, `specification/mockups/`
- **Implementation:** Apply every item under _Specification changes_, remove the consumed `## Hyperparamter Configuration` section from `specification/notes/ui-fixes.md`, and verify with `bun run plans:check`.
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

- **Blocking:** None
- **Non-blocking:** Confirmed resolutions adopted in this plan: (1) `src/features/models/model-catalogue.ts` is restricted to the 8 classification models and `MOD-SETUP-4` is updated accordingly; (2) `/help/configure-model` is added to `ReservedPath` and `RESERVED_CONTENT` with `content/en/pages/configure-model.md`; (3) `HyperparameterValue` is widened to `number | string | boolean | null | number[] | Record<string, number>`, and `model-presentation-policy.ts` makes `learningRate` editable under `sgd` and read-only (`0.001`, omitted from `requestOptions`) under `adam`, hides deprecated alias `nIterations`, and keeps `threshold` (`0.5`) and Naive Bayes `priors`/`classPrior` (`Automatic`) read-only until `web-ml` updates its JSON/prose (`specification/HUMAN.md`).
- **Non-blocking:** KNN `nNeighbors <= fittingSampleCount` is checked against `dataset.rowCount` in Phase 1 and re-validated against the actual training partition size in Phase 2/3.
- **Non-blocking:** Draft `03-4_train-models-3-configure-model.html` awaits human promotion once all classification phases are complete (`specification/HUMAN.md`).

## Escalations

None.

## Review fixes

None.

## Implementation and verification log

| When (UTC)           | Task | Agent (model)                            | Outcome / commands / evidence                                                                                                                                                                                                                                                                                               |
| -------------------- | ---- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-17T21:23:45Z | —    | Google Antigravity (Gemini 4 Argon High) | Split Phase 1 from `web-ml-classification-integration.md`; scout-verified `web-ml@0.1.0` option types, JSON conflicts, and `samata-ml` store/test seams.                                                                                                                                                                    |
| 2026-11-18T08:34:14Z | —    | Google Antigravity (Gemini 4 Argon High) | Adopted widened `HyperparameterValue` and presentation-policy resolution for `web-ml` JSON/prose discrepancies.                                                                                                                                                                                                             |
| 2026-11-19T09:27:24Z | —    | Google Antigravity (Gemini 4 Argon High) | Incorporated `7fe505eaa6ec5428cdeafe264c7beb6c26c6cb64` UI design (`.field` CSS Grid, `hyperparametersStyles`, `<ui-parameter-input>` with `linear`/`logarithmic`/`integer` scales, `<abbr>` plain-English descriptions, `.field-dependent` notes, `.help-link` `/help/configure-model`, and 8-classifier catalogue scope). |

## Plan review history

| Reviewed (UTC)       | Agent (model)                           | Decision          | Findings                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------- | --------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-19T10:20:35Z | Google Antigravity (Gemini 4 Neon High) | changes-requested | BLOCKER: <ui-parameter-input> label-id/described-by ARIA IDREFs fail across Shadow DOM; BLOCKER: missing LogisticRegression lbfgs+penalty compatibility rule; BLOCKER: hyperparameters.styles.stories.ts violates CONV-1; MAJOR: web-ml option bounds/SVC.gamma/boolean classWeight, hyperparameters.css literal rgb/contrast & base-select, STORAGE_VERSION=2 scroll migration/deep validator, and Section 3 reopen/MOD-SETUP-3/Storybook seeding gaps |
| 2026-11-19T11:04:26Z | Claude Code (claude-opus-5-5) | changes-requested | Plan unchanged since prior changes-requested review. BLOCKER: ui-parameter-input label-id/described-by IDREFs cannot cross shadow roots (no accessible name, WCAG 4.1.2); BLOCKER: no LogisticRegression lbfgs+l1/elasticnet rule (hyperparameters.md L140-141) so requestOptions can be invalid; MAJOR: hyperparameters.styles.stories.ts fails CONV-1, making WML-P1-PARAM-3 unsatisfiable; MAJOR: values stores active-only (D2) vs inactive overrides (OPT-2); MAJOR: custom classWeight key semantics unresolved upstream (LR) and min=0 vs positive weights (MD L345); MAJOR: per-field bounds missing for tol/varSmoothing/minImpurityDecrease/binarize; MAJOR: STORAGE_VERSION=2 also invalidates PersistedScroll, migration targets data v1 never wrote, and persisted regressor modelIds are not migrated; MAJOR: /models manifest revision/libraryVersion undefined (upstream index.json has neither) and runtime fetch unjustified vs existing static imports; MAJOR: base.css base-select/::picker and rgb()/opacity literals not addressed; MINOR: stale upstream citations (MLP/LR learningRate appliesWhen sgd, threshold at logistic-regression.d.ts L36), T1 breaks MOD-SETUP-4 until T5, multiclass capability map unspecified |

## Change log

| When (UTC)           | Change                                                                | Reason                                                                                                                                                                                                                                                                                |
| -------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-17T21:23:45Z | Initial draft                                                         | Created Phase 1 plan (manual hyperparameter selection and `options`-compatible state persistence) from the multi-phase split of `web-ml-classification-integration.md`.                                                                                                               |
| 2026-11-18T08:34:14Z | Adopt `HyperparameterValue` resolution                                | User confirmed widening `HyperparameterValue` and applying the presentation policy for `learningRate`, `nIterations`, `threshold`, and NB priors.                                                                                                                                     |
| 2026-11-19T09:27:24Z | Incorporate commit `7fe505e` UI design and resolve blocking questions | Added `.field` grid layout (`hyperparametersStyles`), `<ui-parameter-input>` (`linear`/`logarithmic`/`integer` scales), plain-English `<abbr>` descriptions and `.field-dependent` notes, `/help/configure-model` reserved route, and 8-classifier catalogue scope confirmed by user. |
