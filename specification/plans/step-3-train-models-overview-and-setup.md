# Step 3: Train Models Overview and Setup

**Status:** draft | **Updated:** 2026-11-13T10:22:14Z

## Goal

**Current behaviour:** Navigating to `/models` or `/models/{num}` hits placeholder markup in `src/app.ts`. `src/stores/app.store.ts` already defines `createModel()`, `chooseModel()`, `setFeatures()`, `toggleFeature()`, `setModelOptions()`, `completeSection()`, and `reopenSection()`, and `src/stores/predicates.ts` exposes `$hasDataset`, `$hasTarget`, `$trainedModels`, `$canCompare`, and `blockedReason()`, while `src/styles/card.styles.ts`, `src/styles/chiclet.styles.ts`, and `src/generated/pages/model_logistic_regression.ts` exist partially. However, `<app-model-card>`, the `/models` hub view, the `/models/{num}` 6-step builder accordion, the Model Description modal, `web-ml` catalogue loading, and Step 2 feature selection do not exist, and numerous blocking questions (`TODO-06`–`TODO-08`, `TODO-12`, `TODO-14`, `TODO-18`, `TODO-29`, `TODO-30`, `TODO-34`, `TODO-35`, `card.md` Q4–Q12, missing `/models` table mockup, and missing `src/i18n.ts`) remain unresolved.

**Target behaviour:** Deliver the first half of Step 3 across two connected route views:

1. `/models` (`<app-models-view>`): enforces the dataset/target guard (`03-1_train-models-disabled.html`), shows the configured/trained models overview table (`workflow-steps.md` §3), lets users launch `+ Train New Model` (`createModel()`), navigate to `/models/{num}` (`Continue` / `View Results`), or navigate to `/results` via `Compare Results` (strictly disabled with accessible hint until at least two models are `'trained'`).
2. `/models/{num}` (`<app-model-builder-view>`): enforces `MODEL_NOT_FOUND` / `DATASET_REQUIRED` / `TARGET_REQUIRED` guards, renders the 6-step `train-model` accordion (`03-2`, `03-3`) with interactive Step 1 (**Choose Model** using `<app-model-card>` + `web-ml/model-specifications` + `<app-model-description-dialog>`) and Step 2 (**Select Features** with eligibility, target highlighting, sample leakage/identifier pre-selection, and `Notes`), plus collapsed scaffold panels for Sections 3–6 (`Configure Model`, `Configure Training`, `Training`, `Results`).

**Why:** Separating the `/models` overview and wizard Steps 1–2 (`Choose Model`, `Select Features`) from hyperparameter configuration and execution (`configure-model`, `configure-training`, `training`, `results`) establishes `<app-model-card>`, the 6-step stepper container, and feature selection validation before training workers are wired up.

## Scope

**In scope**

- Route view `<app-models-view>` (`src/features/models/app-models-view.ts`, Tier 3 connected) for `/models`, including `whenSettled(): Promise<void>`.
- Route view `<app-model-builder-view>` (`src/features/models/app-model-builder-view.ts`, Tier 3 connected) for `/models/{num}`, including `whenSettled(): Promise<void>` and collapsed pending scaffold panels for Sections 3–6.
- Presentational `<app-model-card>` (`src/components/app-model-card.ts`, Tier 2 per `specification/components/card.md`) and `<app-model-description-dialog>` (`src/features/models/app-model-description-dialog.ts`, Tier 2).
- `web-ml/model-specifications` catalogue adapter (`src/features/models/model-catalogue.ts`) mapping target column type (`categorical`/`boolean` -> classification, `numeric` -> regression) to eligible model descriptors and defaults.
- Section UI modules for Step 1 (`Choose Model`) and Step 2 (`Select Features`), consuming `isModelEligibleColumnType`, `DatasetMetadata` (`ColumnStats`), and `SampleDatasetDescriptor` (`leakyColumns`, `role === 'identifier'`) per `data-ingestion-and-storage.md` R5.
- Updating `src/app.ts` `/models` and `/models/{num}` route rendering plus `tests/style-tokens.test.ts` checks, Playwright Step 3 E2E suites (`tests/models-setup.e2e.ts`), visual parity (`03-1`, `03-2`, `03-3`), and Axe audits.

**Out of scope**

- Rendering controls inside Sections 3–6 (`configure-model`, `configure-training`, `training`, `results`), running `web-ml` training workers, or persisting metrics/diagnostics (deferred to subsequent Step 3 configuration/training plans; Sections 3–6 stay collapsed pending placeholders here).
- Re-implementing training algorithms or hyperparameter schemas outside `web-ml/model-specifications`.
- Creating `src/i18n.ts` (`COMPONENTS.md` §8 prerequisite) or rewriting `app-sidebar.ts` model step list (`state-navigation-conformance.md` / `scaffolding-visual-remediation`).
- Modifying `specification/mockups/**` or `../web-ml`.

**Constraints and invariants**

- **Lowest tier & store boundary (`COMPONENTS.md` §2, §5):** `<app-model-card>`, `<app-model-description-dialog>`, and any presentational section subcomponents (Tier 2) never import `$appState`, actions, `web-ml` training workers, or storage clients; `<app-models-view>` and `<app-model-builder-view>` (Tier 3 connected) own store subscriptions (`StoreController`), `DatasetMetadata` / `SampleDatasetDescriptor` loading, and store actions (`createModel`, `chooseModel`, `setFeatures`, `toggleFeature`, `setModelOptions`, `completeSection`, `reopenSection`).
- **Closed APIs & clean events (`COMPONENTS.md` §3–§4):** All elements have documented props, events (`bubbles: false, composed: false`), no unlisted globals/CSS custom properties, and no inline arrow-function wrappers in template `@event` bindings (bind `data-model-id` / `data-column` / `data-section` and use prototype handlers).
- **No model duplication in `samata-ml`:** Available models and default options come from `web-ml/model-specifications` (`index.json` + `./model-specifications/*`); never hardcode parallel algorithm lists or training formulas.
- **State invariants (`state-navigation-conformance.md` D7, `app-state-and-navigation.md` §4.4, §6.3):**
    - `setFeatures` rejects ineligible column types (`text` AND `datetime` via `isModelEligibleColumnType`), the `target` column, unknown columns, and duplicates; completing `'select-features'` must keep invariants aligned with `data-ingestion-and-storage.md` D4/T1.
    - Editing a completed earlier section via `reopenSection` clears downstream `completedSteps` while keeping stored choices pre-populated (`features`, `modelOptions`, etc.).
    - `Compare Results` on `/models` MUST be `<button disabled aria-describedby="...">` with a visible explanation until `$canCompare` (`trainedCount >= 2`), then `<a href="/results">` (`app-state-and-navigation.md` §4.4).
- **Tokens & Accessibility (`css/root.css`, `visual-design.md` §5, `TOK-1`–`TOK-4`):** Use only `css/root.css` tokens with no fallbacks or literal colours; apply recorded fixes `A11Y-01` (`--stone-700`), `A11Y-04` (`--stone-900` on `--amber-500`), `A11Y-06` (`--stone-700` on `.train-step-pending`), `A11Y-07` (`--stone-600` control border), `SEM-04` (dialog `aria-labelledby`), `SEM-06` (unique accessible labels per feature checkbox), `SEM-07` (table caption + `scope="col"`), `SEM-08` (decorative SVGs `aria-hidden="true"`), `SEM-11` (chiclets); omit invalid `aria-selected` on plain `<tr>` (`03-3` mockup bug). Never add files to `KNOWN_DRIFT`.

## Required reading

The implementer reads only these, plus each task's likely files.

- `specification/workflow-steps.md` §3 — `/models` hub table columns, `+ Train New Model` / `Compare Results`, and the 6-step builder sequence.
- `specification/app-state-and-navigation.md` §4.2–§4.4, §5.4–§5.5, §6.3 — blocked-state matrix (`DATASET_REQUIRED`, `TARGET_REQUIRED`, `MODEL_NOT_FOUND`), `Compare Results` disabled contract, modal lifecycle, `whenSettled()`, and 6-section wizard state transitions.
- `specification/state-and-storage.md` §3, §5 — `ModelRecord`, `ModelSectionId`, `completedSteps`, write triggers, and UI persistence rules (`TODO-18` guardrail).
- `specification/components/card.md` §§1–§11 — `<app-model-card>` contract, slots, events, and unresolved Q4–Q12.
- `specification/COMPONENTS.md` §§1–§9 — tiers, closed APIs, Lit rules, StoreController, styling, accessibility, `@nanostores/i18n`, Playwright rules.
- `specification/visual-design.md` §§1–§6 — mockup mapping (`train-model.css`, `badges.css`, `card.css`, `notifications.css`, `table.css`, `modal.css`), `A11Y-01`/`04`/`06`/`07`/`10`, `SEM-04`/`06`/`07`/`08`/`11`.
- `specification/plans/data-ingestion-and-storage.md` (Technical decisions & Interfaces) — `isModelEligibleColumnType`, `DatasetMetadata`, and `SampleDatasetDescriptor` (`leakyColumns`, `role === 'identifier'`, preprocessing).
- `specification/plans/state-navigation-conformance.md` (D5–D7) — `blockedReason`, section invalidation, and `setFeatures` validation rules.
- `specification/mockups/ui-scaffold/03-1_train-models-disabled.html`, `03-2_train-models-1-choose-model.html`, `03-3_train-models-2-select-features.html`, `specification/mockups/ui-scaffold/css/train-model.css`, `css/badges.css`, `css/notifications.css` — visual baseline.

## Codebase context

- **Relevant implementation:**
    - `src/app.ts` handles `/models` and `/models/{num}` with placeholders inside `renderWorkflowView()`; `src/app.ts` is in `tests/style-tokens.test.ts` `KNOWN_DRIFT`.
    - `src/stores/app.store.ts` exports `createModel`, `chooseModel`, `setFeatures`, `toggleFeature`, `setModelOptions`, `completeSection`, `reopenSection`. Note: `setFeatures` currently checks `col.type === 'text'` (`state-navigation-conformance.md` + `data-ingestion-and-storage.md` require also rejecting `'datetime'` via `isModelEligibleColumnType`).
    - `src/stores/predicates.ts` exports `$hasDataset`, `$hasTarget`, `$trainedModels`, `$canCompare`, and `blockedReason(route, state)`.
    - `src/styles/card.styles.ts`, `src/styles/chiclet.styles.ts` (note `cardStyles` lacks `.cards` grid and `chicletStyles` uses `--surface` / `--stone-900`), `src/styles/button.styles.ts`, `src/styles/dialog.styles.ts`, and `src/styles/global.ts` already exist.
    - `css/train-model.css` vs `specification/mockups/ui-scaffold/css/train-model.css`: verified mismatch — workspace `css/train-model.css` has empty `.train-step-status {}` (losing `--green-700`), different `.train-step-action` padding, literal `#fff` (`TOK-2` failure if copied), and `--stone-500` on `.train-step-pending` (`A11Y-06` violation). Additionally `03-2` L129 uses `.step-action.step-status` whereas `03-3` L129 uses `.train-step-action.train-step-status`.
    - `web-ml` (`node_modules/web-ml/package.json`) exports `./model-specifications` (`specification/model-specifications/index.json` listing 16 models across `classification`, `regression`, `clustering`, `dimensionality-reduction`) and `./model-specifications/*` (`models/*.json`).
    - `content/models/logistic-regression.md` and `src/generated/pages/model_logistic_regression.ts` exist (only Logistic Regression has content; `src/generated/` is currently unused per Known gap 4).
    - `src/i18n.ts` does **not** exist yet.
- **Tests and commands:**
    - Baseline verified 2026-11-13: `bun run check` passes (0 type errors, 52 tests across 6 files); `bun run test:e2e --list` discovers 54 tests.
    - `tests/style-tokens.test.ts` enforces zero literal colours (`TOK-2`) and zero unknown CSS vars (`TOK-1`) in any new `.ts` file.
    - `tests/visual-parity/map.ts` maps `03-1_train-models-disabled.html` -> `/models`, `03-2_train-models-1-choose-model.html` -> `/models/1`, `03-3_train-models-2-select-features.html` -> `/models/1` (currently `visual-parity.e2e.ts` navigates directly without creating/seeding model `1` or setting active section `'select-features'`).
- **Web guidance:** **Unverified in this session:** `bunx modern-web-guidance` failed inside the offline sandbox (`DNSResolveFailed`). Run queries for `"checkbox"`, `"forms"`, `"disclosure-accordion"`, `"dialog"`, and `"responsive-table"` before approving this plan to `ready`.
- **Visual reference:**
    - **Blocking gap (`/models` hub table):** There is **no** mockup in `specification/mockups/ui-scaffold/` for the populated `/models` hub table (`03-1` covers only the empty/blocked guard, and `03-2` jumps straight to Step 1 of `/models/1`). A mockup or explicit approved layout for `/models` is required before `ready`.
    - `03-1_train-models-disabled.html`: `<header class="page-header">` + `.notification.notification-alert` (`role="alert"`, `#alert` icon + `"You must set both the dataset and the target variable before training a model."`).
    - `03-2_train-models-1-choose-model.html`: 6-item `<ol class="train-model">` with active Step 1 showing `<section class="cards">` and `<article class="card">` (`.card-type.badge.badge-purple`, `<svg class="card-image" viewBox="0 0 360 216">`, `<h3 class="card-title">`, `<p class="card-text">`, `Model Description` `.btn`, `Select Model` `.btn.btn-primary`), plus collapsed pending Steps 2–6.
    - `03-3_train-models-2-select-features.html`: **note:** `TODO-36` erroneously says `03-3` is empty, whereas `03-3` contains 307 lines showing Step 1 collapsed completed (`1. Logistic Regression` + `#check`) and Step 2 active (`2. Select Features`, `Continue` submit button, prompt paragraph naming target column, 4-column table `Include` / `Column Name` / `Type` / `Notes`, `.target-variable` with `.badge.badge-amber` `"target"`, `.feature-unsupported`, and pending Steps 3–6). **Mockup deviations/bugs:** unlabelled checkboxes (`SEM-06`), invalid `aria-selected="true"` on `<tr>`, `.train-step-pending` contrast (`A11Y-06`), missing `<form id="features-form">` wrapper around the table in `03-3`, and placeholder `<a href="">learn more...</a>`.
- **Lit skills:** implementers use `lit-implementer` for all Lit components, controllers, styles, and component tests.
- **Known gaps decided:**
    - **Gap 4 (`content/models/` & `src/generated/`):** Decisions on consuming `src/generated/pages/model_*.ts` vs `web-ml` markdown/JSON guides belong in T1 before wiring `<app-model-description-dialog>`.
    - **Gap 13 (`css/` vs `src/styles/`):** New Step 3 styles must comply with `css/root.css` and A11Y registers; do not add new files to `KNOWN_DRIFT`.
    - **Gap 14 & 15 (`state-navigation-conformance.md`):** Use `blockedReason` (`MODEL_NOT_FOUND` vs `DATASET_REQUIRED`/`TARGET_REQUIRED`), `reopenSection` invalidation semantics (D7), and `whenSettled()` route settlement.
    - **Gap 17 (Playwright naming):** Use `tests/models-*.e2e.ts` so `playwright.config.ts` executes them.
- **Assumptions requiring verification:**
    - `data-ingestion-and-storage.md` (`draft`) and `state-navigation-conformance.md` (`draft`) ship `isModelEligibleColumnType`, `DatasetMetadata`, `SampleDatasetDescriptor`, and Step 3 store/router fixes before T2 begins.
    - `step-2-set-target.md` settles any shared `table.styles.ts` / `notification.styles.ts` decisions (`TODO-35`) or they are resolved jointly in T1.
    - `src/i18n.ts` (`@nanostores/i18n`) exists prior to UI implementation.

## Technical decisions

| Decision                                                     | Chosen approach and rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Rejected alternative / trade-off                                                                                                                               |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component decomposition & tiers                              | Keep stores strictly in Tier 3 connected views: `<app-models-view>` (`src/features/models/app-models-view.ts`) and `<app-model-builder-view>` (`src/features/models/app-model-builder-view.ts`). Presentational elements (Tier 2): `<app-model-card>` (`src/components/app-model-card.ts` per `card.md`), `<app-model-description-dialog>` (`src/features/models/app-model-description-dialog.ts`), plus extracted Tier 2 step panels `<app-choose-model-step>` and `<app-select-features-step>` under `src/features/models/` so the 6-step builder stays modular as Steps 3–6 land.                                                                  | Monolithic `<app-model-builder-view>` mixing cards, feature tables, dialogs, and Steps 3–6 forms in one file, or letting Tier 2 components import `$appState`. |
| `/models` hub table design (`TODO-08`, missing mockup)       | **Blocking:** Approve a `/models` hub mockup (covering table columns `Model Name`, `Features`, `Configuration`, `Training Setup`, `Duration`, Action; auto-naming/rename rules; summary text before training; zero-models empty state; delete/duplicate policy per `TODO-08`) before marking `ready`.                                                                                                                                                                                                                                                                                                                                                 | Guessing layout, table actions, and empty state on `/models` without visual approval (`visual-design.md` §1).                                                  |
| `<app-model-card>` identity & spec gaps (`card.md`)          | **Blocking:** Same conflict as Step 1 (`card.md` §3 forbids `id` and emits `{ name }`, clashing with `COMPONENTS.md` §4's ban on inline arrow handlers); resolve `modelId` property vs `data-model-id` host attribute, plus `card.md` Q4–Q12, `TODO-29`, `TODO-30`, and `A11Y-04` (`.badge-amber` dark ink `--stone-900`).                                                                                                                                                                                                                                                                                                                            | Inferring `modelId` from localised display `name` (fragile) or violating `COMPONENTS.md` §4 with inline arrow wrappers.                                        |
| Model catalogue & unsupervised tasks (`TODO-07`)             | Load `web-ml/model-specifications` (`index.json` + `./model-specifications/*.json`) via pure `model-catalogue.ts`. **Blocking:** Decide via `TODO-07` whether `clustering` (`k-means`) / `dimensionality-reduction` (`pca`) appear alongside supervised tasks, how card SVG illustrations (which cannot use literal hexes in `.ts` under `TOK-2`) are packaged in `public/`, what prose `card.description` renders, and card sort order.                                                                                                                                                                                                              | Hardcoding a custom algorithm list in `samata-ml` or putting raw mockup hexes inside `.ts` templates (`TOK-2` failure).                                        |
| Model description dialog (`TODO-12`, `TODO-18`, `TODO-34`)   | **Blocking:** Resolve authored description source (`content/models/*.md` + `src/generated/` per Gap 4 vs `web-ml` guides), author missing component spec (`TODO-34`), and confirm `TODO-18` honors `state-and-storage.md` §5 (do NOT persist open modal across reloads).                                                                                                                                                                                                                                                                                                                                                                              | Persisting transient dialog state against `state-and-storage.md` §5 or shipping 15 broken/missing model descriptions.                                          |
| Feature selection rules & pre-selection (`TODO-06`)          | Exclude `text` and `datetime` (`!isModelEligibleColumnType(col.type)` in `.feature-unsupported`). Highlight target in `.target-variable` with `.badge.badge-amber`. When creating/entering Step 2 on sample datasets, default-select eligible non-identifier, non-leaky columns (`SampleDatasetDescriptor.modeling.targetCandidates`, `columns[*].role`) per `data-ingestion-and-storage.md` R5. **Blocking (`TODO-06`):** Confirm target checkbox UI (`03-3` empty cell vs ticked disabled checkbox), minimum feature count (>= 1), model-specific options UI vs `IndexedDBDatasetProvider` preprocessing, and zero-variance / all-missing handling. | Allowing `datetime` or `target` columns to be selected as features, or ignoring sample `leakyColumns` warnings.                                                |
| Section reopen triggers & stepper CSS (`TODO-14`, `TODO-35`) | **Blocking:** Define exact UI controls to call `reopenSection(num, section)` on completed steps (`TODO-14`) and shared stylesheet placement for `train-model.styles.ts`, `badge.styles.ts`, `table.styles.ts`, `notification.styles.ts` (`TODO-35`), fixing workspace vs mockup `train-model.css` drift (`--green-700`, `--surface`, `A11Y-06` `--stone-700`).                                                                                                                                                                                                                                                                                        | Leaving completed steps uneditable (`03-3` Step 1 shows only `#check`) or shipping grey invisible status checks from stale `css/train-model.css`.              |
| `setFeatures` `datetime` parity                              | Extend `setFeatures` validation (`state-navigation-conformance.md` D7) if needed so it checks `!isModelEligibleColumnType(col.type)` consistently with `data-ingestion-and-storage.md` T1.                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Allowing `datetime` features through the store while blocking them only in UI checkboxes.                                                                      |
| i18n setup                                                   | **Blocking:** Consume `@nanostores/i18n` messages from `src/i18n.ts` (`COMPONENTS.md` §8); blocked until `src/i18n.ts` prerequisite is settled.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Embedding raw English strings in Step 3 components.                                                                                                            |

### Interfaces and behaviour

**State placement (`COMPONENTS.md` §5, `state-and-storage.md` §5):**

- **Persisted (`$appState`, via `StoreController` in Tier 3 views only):**
    - `<app-models-view>` reads `state.dataset`, `state.target`, `state.models`, `$hasDataset`, `$hasTarget`, `$canCompare`; calls `createModel()`.
    - `<app-model-builder-view>` reads `state.dataset`, `state.target`, `state.models` (lookup `model = state.models.find((m) => m.num === this.modelNum)`) and `blockedReason('/models/' + this.modelNum, state)`; calls `chooseModel()`, `setFeatures()`, `toggleFeature()`, `setModelOptions()`, `completeSection()`, `reopenSection()`.
- **IndexedDB & catalogue data inside Tier 3 views (never imported by Tier 2):**
    - `getStorageClient().getMetadata(dataset.id)` -> `DatasetMetadata | null` (`ColumnStats`) for Step 2 eligibility/notes.
    - `loadSampleDescriptor(dataset.id)` -> `SampleDatasetDescriptor | null` when `dataset.source === 'sample'` (for initial non-leaky, non-identifier feature pre-selection and notes).
    - `loadModelCatalogue()` / `loadModelSpec(id)` -> `ModelCatalogueEntry[]` backed by `web-ml/model-specifications`.
    - Model description HTML/prose source -> finalized adapter (`content/models/*.md` / `src/generated/` or `web-ml`).
- **Transient component `@state`:**
    - `<app-models-view>`: `settledPromise` tracking any pending view readiness (renders synchronously once store + catalogue needed for summary display settles).
    - `<app-model-builder-view>`: `catalogue: ModelCatalogueEntry[]`, `metadata: DatasetMetadata | null`, `descriptor: SampleDatasetDescriptor | null`, `descriptionDialogModelId: string | null`, `draftFeatureSelection: string[]`, `draftModelOptions: Record<string, HyperparameterValue>`.

**Component boundaries and public APIs (provisional until blocking TODOs resolve):**

```ts
// src/components/app-model-card.ts (Tier 2 presentational; aligned pending card.md Q4–Q12 & identity fix)
export class AppModelCard extends LitElement {
	@property({ type: String }) accessor modelId: string = ''; // pending card.md host-attribute vs property decision
	@property({ type: String }) accessor type: 'classification' | 'regression' | 'clustering' =
		'classification';
	@property({ type: String }) accessor name: string = '';
	@property({ type: String }) accessor description: string = '';
	// Slot: `image` (<svg viewBox="0 0 360 216" aria-hidden="true">)
	// Events (bubbles: false, composed: false):
	//   'app-model-description-open' -> CustomEvent<{ modelId: string; name: string }>
	//   'app-model-select'           -> CustomEvent<{ modelId: string; name: string }>
}
```

- **`<app-models-view>` (`src/features/models/app-models-view.ts`, Tier 3 connected):**
    - Public API: `whenSettled(): Promise<void>`.
    - Behaviour: If `blockedReason('/models', state)` is `'DATASET_REQUIRED'` or `'TARGET_REQUIRED'`, displays `03-1`-aligned `.notification.notification-alert` with link(s) to `/data` / `/target`. Otherwise renders header, `+ Train New Model` action (`createModel()` -> navigates to `/models/{num}`), `Compare Results` (`<a href="/results">` if `$canCompare`, `<button disabled aria-describedby="...">` + hint otherwise), and models hub table (`Model Name`, `Features`, `Configuration`, `Training Setup`, `Duration`, action column linking to `/models/{num}`).
- **`<app-model-builder-view>` (`src/features/models/app-model-builder-view.ts`, Tier 3 connected):**
    - Public API: `@property({ type: Number }) accessor modelNum: number = 0;`, `whenSettled(): Promise<void>`.
    - Behaviour: Evaluates `blockedReason('/models/' + this.modelNum, state)`; on `'DATASET_REQUIRED'`/`'TARGET_REQUIRED'`/`'MODEL_NOT_FOUND'`, renders inline alert + recovery navigation (`/data`, `/target`, `/models`). Otherwise renders `<ol class="train-model">` containing 6 ordered `<li class="train-step">`:
        - Step 1 (`choose-model`): renders `<app-choose-model-step>` when active (grid of `<app-model-card>` filtered by task type), or completed header (`1. {Model Name}` + `#check` + reopen trigger) when completed. Opens `<app-model-description-dialog>` on `app-model-description-open`. Calls `chooseModel(...)` + `completeSection(modelNum, 'choose-model')` on `app-model-select`.
        - Step 2 (`select-features`): renders `<app-select-features-step>` when active (`Include`, `Column Name`, `Type`, `Notes` table, target row badge, ineligible `.feature-unsupported` rows, optional model-specific options once `TODO-06` resolves, `Continue` button calling `setFeatures` + `setModelOptions` + `completeSection(modelNum, 'select-features')`), or completed/pending header otherwise.
        - Steps 3–6 (`configure-model`, `configure-training`, `training`, `results`): rendered as pending/collapsed `<li class="train-step">` placeholders matching `03-2`/`03-3` structure (`train-step-pending`, `.train-step-content[hidden]`).
- **Accessible names, semantics & strings:**
    - Models table & Feature table each have accessible table names (`<caption>` / `aria-labelledby`) and `<th scope="col">` (`SEM-07`).
    - Step 2 checkboxes each bind an explicit `<label for="include-...">` and unique slugified+indexed `id` (`SEM-06`); omit invalid `aria-selected="true"` on non-grid `<tr>`.
    - Step status icons have `aria-hidden="true"` + `.visually-hidden` `"Completed"` (`SEM-08`); active accordion step carries `aria-current="step"`; `.badge-amber` uses `--stone-900` text on `--amber-500` (`A11Y-04`); pending step labels use `--stone-700` (`A11Y-06`).
    - All copy uses `@nanostores/i18n` via `src/i18n.ts`.

## Specification changes

What `specification/` must say once this plan is implemented. The final task applies these items and ticks each one; `task_gate.py --check-complete` refuses to close the plan while any is unticked.

- [ ] `specification/components/card.md` §§1–§11 — record resolved Q4–Q12 (`modelId`/attribute identity fix, `clustering` / badge tokens, image SVG asset handling, i18n keys) and update `<app-model-card>` status to `implemented` if satisfied.
- [ ] `specification/workflow-steps.md` §3 — document `/models` hub layout, auto-naming, empty-state, delete/duplicate decisions (`TODO-08`), model task-type filtering (`TODO-07`), Step 2 feature pre-selection/target-row rules (`TODO-06`), and section reopen flow (`TODO-14`).
- [ ] `specification/app-state-and-navigation.md` §4.3–§4.4, §6.3 — align `setFeatures` (`datetime` rejection), `Compare Results` disabled state, `MODEL_NOT_FOUND` recovery, and Steps 1–2 / scaffolded Steps 3–6 wizard transitions.
- [ ] `specification/visual-design.md` §3, §5, §6 — record approved `train-model.styles.ts` / `badge.styles.ts` placement, `css/train-model.css` fixes (`--green-700`, `--surface`, `A11Y-06`), new `/models` hub mockup mapping, `SEM-06` / `A11Y-04` / `aria-selected` deviations on `03-2`/`03-3`, and Step 3 parity/Axe verification.
- [ ] `specification/TODO.md` — resolve TODO-06 (`Select Features`), TODO-07 (`Choose Model`), TODO-08 (`/models` table), TODO-12 (model descriptions), TODO-14 (reopen sections), TODO-18 (modal reload rule), TODO-29/TODO-30 (`card.md`), and narrow TODO-34, TODO-35, TODO-36 (removing false claim that `03-3` is empty) and TODO-53.
- [ ] `specification/README.md` — narrow Known gap 4 (`content/models/` / `src/generated/` usage for model descriptions) and update spec statuses to match shipped files.

## Implementation tasks

### T1 — Resolve blocking Step 3 specs, `/models` mockup, model catalogue, and shared styles

- **Depends on:** Human answers for `TODO-06`–`TODO-08`, `TODO-12`, `TODO-14`, `TODO-18`, `TODO-29`–`TODO-30`, `TODO-34`–`TODO-35`, `card.md` Q4–Q12, approved `/models` hub visual reference, `bunx modern-web-guidance` checks, and `src/i18n.ts` prerequisite.
- **Risk:** needs care — locks `<app-model-card>` contract, model catalogue source (`web-ml/model-specifications`), shared stepper/badge styles, and `/models` hub UI.
- **Likely files:** `specification/components/card.md`, `specification/workflow-steps.md`, `specification/visual-design.md`, `specification/TODO.md`, `src/styles/train-model.styles.ts` (if approved), `src/styles/badge.styles.ts` (if approved), `src/i18n.ts` (Step 3 strings), `specification/plans/step-3-train-models-overview-and-setup.md`.
- **Must not touch:** Existing mockup files in `specification/mockups/**` (any new mockup must be approved outside implementation), `../web-ml`, or `css/root.css` without explicit token approval.
- **Implementation:** Record finalised UX/spec answers (`card.md` identity & Q4–Q12, model description dialog spec/content source, `/models` table layout, reopen affordances, clustering inclusion), resolve shared style module ownership (`train-model.styles.ts`, `badge.styles.ts`, plus `table.styles.ts`/`notification.styles.ts` if not already landed by Step 2) with all `A11Y-04`/`A11Y-06`/`TOK-2` fixes, and register Step 3 i18n keys.
- **Acceptance criteria:**
    - `CARD-SPEC-1`: `specification/components/card.md` has zero unresolved `Open questions` affecting `<app-model-card>`.
    - `STYLE-MODELS-1`: `bun test tests/style-tokens.test.ts` passes cleanly on all Step 3 style modules.
- **Verification:** `bun run format <changed files> && bun run check`.
- **Progress:** not started

### T2 — Build `<app-model-card>`, `<app-model-description-dialog>`, and `web-ml` catalogue adapter

- **Depends on:** T1, `src/i18n.ts`.
- **Risk:** needs care — `<app-model-card>` is shared Tier 2 public surface constrained by `card.md` and `TOK-2` (illustration SVG token compliance).
- **Likely files:** `src/components/app-model-card.ts`, `src/features/models/app-model-description-dialog.ts`, `src/features/models/model-catalogue.ts`, `public/images/models/*.svg` (or approved illustration asset location), `tests/model-catalogue.test.ts`.
- **Must not touch:** `src/stores/app.store.ts`, `specification/mockups/**`, `../web-ml`.
- **Implementation:** Implement pure `model-catalogue.ts` loading `web-ml/model-specifications` (`index.json` + per-model JSON specs) with task-type filtering helper and default option extraction + TSDoc. Implement `<app-model-card>` (via `lit-implementer`) matching `card.md` and `03-2` layout (`buttonStyles`, `chicletStyles`, `cardStyles`, token-compliant SVG illustration slot, `badge-purple`/`badge-teal`/`badge-amber` with `A11Y-04`), and `<app-model-description-dialog>` wrapping native `<dialog>` with `dialogStyles`, `SEM-04`/`SEM-08` compliance, and focus restoration.
- **Acceptance criteria:**
    - `MOD-CAT-1` (`bun:test`): `model-catalogue.ts` maps `categorical`/`boolean` target types to classification models, `numeric` targets to regression models, and preserves exact `web-ml` IDs and defaults without throwing on optional fields.
    - `TOK-1`–`TOK-4`: `tests/style-tokens.test.ts` passes with zero violations across new `.ts` files.
- **Verification:** `bun test tests/model-catalogue.test.ts tests/style-tokens.test.ts && bun run check`.
- **Progress:** not started

### T3 — Build `<app-models-view>` (`/models` hub) and `<app-model-builder-view>` (`/models/{num}` Steps 1–2 + Sections 3–6 placeholders)

- **Depends on:** T2, `data-ingestion-and-storage.md` (`isModelEligibleColumnType`, `DatasetMetadata`, `SampleDatasetDescriptor`), `state-navigation-conformance.md` (`blockedReason`, D5–D7).
- **Risk:** needs care — manages multi-step accordion state, section reopen invalidation, sample feature pre-selection without races, and `setFeatures` `datetime` guard alignment.
- **Likely files:** `src/features/models/app-models-view.ts`, `src/features/models/app-model-builder-view.ts`, `src/features/models/app-choose-model-step.ts`, `src/features/models/app-select-features-step.ts`, `src/features/models/feature-eligibility.ts`, `src/app.ts` (wire `/models` & `/models/{num}` routes), `src/stores/app.store.ts` (if `setFeatures` needs `isModelEligibleColumnType` parity with `data-ingestion-and-storage.md` T1), `tests/feature-eligibility.test.ts`.
- **Must not touch:** `src/features/navigation/app-sidebar.ts`, `tests/style-tokens.test.ts` `KNOWN_DRIFT`.
- **Implementation:** Implement pure `feature-eligibility.ts` (deriving feature rows, ineligibility for `!isModelEligibleColumnType(col.type)`, target flagging, `DatasetMetadata` stats warnings, and initial pre-selection excluding sample `leakyColumns` & `identifier` columns per R5). Build `<app-choose-model-step>`, `<app-select-features-step>`, `<app-models-view>`, and `<app-model-builder-view>` (using `lit-implementer`), exposing `whenSettled()`, rendering empty/blocked guards (`DATASET_REQUIRED`, `TARGET_REQUIRED`, `MODEL_NOT_FOUND`), `Compare Results` accessible disabled state (`app-state-and-navigation.md` §4.4), interactive Steps 1–2, `reopenSection()` triggers, and collapsed pending scaffold panels for Sections 3–6. Wire `/models` and `/models/{num}` in `src/app.ts`.
- **Acceptance criteria:**
    - `MOD-FEAT-1` (`bun:test`): `feature-eligibility.ts` excludes target, `text`, and `datetime` columns, pre-deselects `identifier` and `leakyColumns` on sample datasets, and never emits duplicate checkbox IDs when column names collide after slugifying.
    - `MOD-NAV-1`: `blockedReason('/models', state)` and `blockedReason('/models/99', state)` render matching alert banners and navigation links in `<app-models-view>` / `<app-model-builder-view>`.
    - `TOK-1`–`TOK-4`: `tests/style-tokens.test.ts` passes with zero errors and no new `KNOWN_DRIFT`.
- **Verification:** `bun test tests/feature-eligibility.test.ts tests/style-tokens.test.ts && bun run check`.
- **Progress:** not started

### T4 — Browser acceptance, visual parity, and Axe verification for `/models` and `/models/{num}`

- **Depends on:** T3.
- **Risk:** straightforward — requires seeded state setup in `visual-parity.e2e.ts` so `03-2` and `03-3` are actually exercised in browser screenshots.
- **Likely files:** `tests/models-setup.e2e.ts`, `tests/visual-parity/map.ts`, `tests/visual-parity.e2e.ts`, `tests/a11y.e2e.ts`.
- **Must not touch:** Product code (`src/**`) unless fixing a defect exposed by browser tests.
- **Implementation:** Update `tests/visual-parity.e2e.ts` / `map.ts` to seed state for `03-1` (unready), `03-2` (draft model 1 on Step 1), `03-3` (model 1 on Step 2 after `chooseModel`), and the approved `/models` hub entry. Author `tests/models-setup.e2e.ts` verifying: `MOD-E2E-1` (`03-1` blocked states on `/models` and `MODEL_NOT_FOUND` on `/models/999`), `MOD-E2E-2` (`createModel` from `/models`, `Compare Results` disabled `<button aria-describedby>` until 2 trained models), `MOD-E2E-3` (Step 1 card list filtered by target type, Model Description modal open/Esc/focus restore, `Select Model` advances to Step 2), `MOD-E2E-4` (Step 2 feature selection, target/`text`/`datetime` protections, `Continue` completes Step 2 and opens scaffold Step 3, reopening Step 1 resets Step 2 completion while preserving stored features), `MOD-E2E-5` (320px width, 200% zoom, long names, RTL). Extend `tests/a11y.e2e.ts` for `/models` (blocked + hub), `/models/1` Step 1, description modal, and `/models/1` Step 2 across Chromium, Firefox, and WebKit.
- **Acceptance criteria:**
    - `MOD-E2E-1`..`5` pass across Chromium, Firefox, and WebKit.
    - `visual-parity.e2e.ts` passes for `03-1`, `03-2`, `03-3`, and `/models` hub (within approved deviation register).
    - `a11y.e2e.ts` passes with 0 WCAG 2.2 AA Axe violations across all Step 3 setup states.
- **Verification:** `bun run check && bun run test:e2e tests/models-setup.e2e.ts tests/visual-parity.e2e.ts tests/a11y.e2e.ts && bun run build`.
- **Progress:** not started

### T5 — Sync specification

- **Depends on:** T4 verified passing cleanly.
- **Risk:** straightforward — aligns component, workflow, visual design, gap, and TODO docs with shipped code.
- **Likely files:** `specification/components/card.md`, `specification/workflow-steps.md`, `specification/app-state-and-navigation.md`, `specification/visual-design.md`, `specification/README.md`, `specification/TODO.md`, `specification/plans/step-3-train-models-overview-and-setup.md`, `specification/plans/README.md`.
- **Must not touch:** `src/`, `css/`, `tests/`, `specification/mockups/**`.
- **Implementation:** Re-read shipped files in `src/components/app-model-card.ts`, `src/features/models/**`, `src/styles/`, and `tests/models-setup.e2e.ts`; update every listed spec document, resolve TODOs, narrow Known gap 4, fix `TODO-36` note about `03-3`, tick every `- [ ]` under `## Specification changes`, and validate with `bun run plans:check` and `bun run format`.
- **Acceptance criteria:**
    - Every `## Specification changes` checkbox is `- [x]` and accurately describes shipped files and tests.
    - `bun run plans:check specification/plans/step-3-train-models-overview-and-setup.md` passes cleanly.
- **Verification:** `bun run format <changed files> && bun run plans:check specification/plans/step-3-train-models-overview-and-setup.md && bun run check`.
- **Progress:** not started

## Verification and definition of done

- **Pre-ready prerequisites:** Human decisions recorded for `TODO-06`–`TODO-08`, `TODO-12`, `TODO-14`, `TODO-18`, `TODO-29`–`TODO-30`, `TODO-34`–`TODO-35`, `card.md` Q4–Q12 & `modelId` identity conflict, approved `/models` hub visual reference, `bunx modern-web-guidance` results, `src/i18n.ts` prerequisite, and `data-ingestion-and-storage.md` / `state-navigation-conformance.md` prerequisite changes.
- **Required automated gates before `implemented`:**
    - `bun run check` (`tsc --noEmit` + `bun test` — zero type errors and all unit tests passing).
    - `bun run test:e2e` across Chromium, Firefox, and WebKit for `MOD-E2E-1`–`5`, visual parity (`03-1`, `03-2`, `03-3`, `/models`), and Axe WCAG 2.2 AA scans.
    - `bun run build` emits clean production bundle.
    - `bun run format <changed files>` + `bun run plans:check specification/plans/step-3-train-models-overview-and-setup.md`.
- **Manual / visual verification checklist:** Keyboard-only & VoiceOver navigation across `/models` hub table (`Compare Results` disabled button + hint), `train-model` accordion steps, `<app-model-card>` actions, native `<dialog>` focus trap/restoration, and feature checkbox labels (`SEM-06`); visual inspection under forced-colours, 200% zoom, 320px narrow viewport, long column/model titles, and `dir="rtl"`.

## Risks and open questions

- **Blocking visual reference gap (`/models` hub table):** No HTML mockup exists for the populated `/models` hub (`workflow-steps.md` §3); `03-1` depicts only the blocked state. Must supply or approve a visual reference before `ready`.
- **Blocking human decisions (`specification/TODO.md` & `card.md`):**
    - `TODO-06`: Target row checkbox UI (`03-3` empty cell vs ticked disabled), minimum selected feature count, model-specific options vs automatic `IndexedDBDatasetProvider` preprocessing, and constant/all-missing column eligibility in features.
    - `TODO-07`: Inclusion/exclusion of `clustering` (`k-means`) and `dimensionality-reduction` (`pca`) when supervised targets exist, `web-ml` JSON vs authored blurb copy, card SVG packaging without `.ts` hex literals (`TOK-2`), and card sort order.
    - `TODO-08`: `/models` model auto-naming vs rename support, summary formatting for `Features` / `Configuration` / `Training Setup` / `Duration`, zero-models empty state, and delete/duplicate model actions.
    - `TODO-12` & `TODO-34`: Missing model description content (`content/models/` only has `logistic-regression.md`; Known gap 4) and missing model-description modal specification.
    - `TODO-14`: UI trigger & confirmation UX to reopen completed accordion steps (`03-3` Step 1 shows only `#check`).
    - `TODO-18`: Confirm modal reload behaviour follows `state-and-storage.md` §5 (transient only, not persisted).
    - `TODO-29`, `TODO-30`, `card.md` Q4–Q12 & `modelId` conflict: resolve `<app-model-card>` property/attribute identity without violating `COMPONENTS.md` §4 or `card.md` §3, plus `.badge` placement (`card-type` in `03-2`), `A11Y-04` amber contrast, and i18n keys.
    - `TODO-35`: Decide shared stylesheet modules (`train-model.styles.ts`, `badge.styles.ts`, `table.styles.ts`, `notification.styles.ts`) and reconcile workspace `css/train-model.css` vs mockup `specification/mockups/ui-scaffold/css/train-model.css` drift (`--green-700`, `--surface`, `A11Y-06` `--stone-700`).
- **Mockup accessibility bugs requiring documented remediation:** `03-3_train-models-2-select-features.html` omits checkbox `<label>` elements (`SEM-06`), uses `aria-selected="true"` on non-grid `<tr>` elements (invalid ARIA), and omits wrapping the feature table in `<form id="features-form">`. Both `03-2` and `03-3` contain empty `<a href="">learn more...</a>` links.
- **Misnumbered `TODO-36`:** `specification/TODO.md` claims `03-3_train-models-2-select-features.html` is empty; direct file inspection confirms `03-3` is populated (307 lines) and only `03-4`–`03-7` are empty.
- **Unverified web guidance & environment assumptions:** Sandbox blocks `bunx modern-web-guidance` DNS lookups; run queries online prior to marking `ready`. `src/i18n.ts` does not exist yet.

## Implementation and verification log

| Date | Task | Outcome / commands run | Notes |
| ---- | ---- | ---------------------- | ----- |

## Change log

- `2026-11-13` — Replaced initial `stub` with full `draft` architectural plan adhering to `plan-template.md` and `lit-architecture`, documenting verified `web-ml/model-specifications` discovery, missing `/models` mockup, `03-3` accessibility/CSS drift, `card.md` identity conflict, and blocking TODOs (`TODO-06`–`TODO-08`, `TODO-12`, `TODO-14`, `TODO-18`, `TODO-29`–`TODO-30`, `TODO-34`–`TODO-35`, `src/i18n.ts`).
