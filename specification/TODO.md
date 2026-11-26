# Specification TODO

**Updated:** 2026-11-24

Open questions and missing specification found by reviewing every Markdown and HTML file in `specification/`. Each item names its source. These are **decisions for a human**: agents must not resolve them silently. When one is answered, update the source spec and delete the item here. Plans can cite items by ID (e.g. "decides TODO-05").

[HUMAN.md](HUMAN.md) is the action queue that points into this list. Spec-vs-code conflicts are tracked separately in [README.md § Known gaps](README.md#known-gaps). Deferred features are in [FUTURE.md](FUTURE.md).

## 1. Workflow steps that need specifying

- **TODO-02 — Single Model Results** ([workflow-steps §3.6](workflow-steps.md)): _Resolved for the shared classification results_ ([Model Results](components/model-results.md)). Still open: the common metrics for regression, which model-specific charts each classifier shows and the format of `src/config/models/{model-name}-results.ts` (Phase 6). The normative mockup `03-7` is empty; the draft awaits styling.
- **TODO-03 — Compare Results** ([workflow-steps §4](workflow-steps.md)): _Resolved for classification_ with compatible-row grouping, metrics and comparison views. Regression comparison remains future work; the [04 draft](mockups/04_compare-results.html) awaits human styling.
- **TODO-04 — Training.** Phase 3 delivers local One-Shot and fixed CV, progress, safe errors, elapsed time and recovery. Detailed timing tables for nested evaluation and tuning remain later work. The [03-6 draft](mockups/03-6_train-models-5-train.html) awaits styling and promotion.
- **TODO-05 — Configure Model** ([workflow-steps §3.3](workflow-steps.md)):
    - Where each model's hyperparameter definitions come from (ranges, types, defaults; `web-ml` or app config).
    - The hyperparameter-tuning UI: search method, how ranges are entered, and which tuning metric.
    - How the available multiclass strategies are discovered.
    - _Resolved for manual configuration (Phase 1):_ hyperparameter definitions come from the `web-ml` catalogue documents; the manual form is implemented ([components/model-configuration.md](components/model-configuration.md)); multiclass strategy is fixed per model and shown read-only. Still open: the hyperparameter-tuning UI (search method, range entry, tuning metric) and user-selectable multiclass strategies.
- **TODO-06 — Select Features** ([workflow-steps §3.2](workflow-steps.md)):
    - _Resolved for Step 3:_ Implemented in `feature-eligibility.ts` and `app-model-builder-view.ts`: target column displayed with Target badge and no checkbox (never selectable); unsupported (text, date, time, datetime), constant, and all-missing columns disabled with explanatory note codes; identifiers and target-candidate leaky columns default unticked with advisory notes and deliberate selection override; at least one feature required; initial features populated once on Choose Model completion via `initialiseFeatureSelection`.
- **TODO-07 — Choose Model** ([workflow-steps §3.1](workflow-steps.md)):
    - _Resolved for Step 3:_ The [Choose Model workflow](workflow-steps.md#1-choose-model) renders the eight eligible classifiers as illustrated cards in library index order. The current choice is visible and programmatically identified. Descriptions use authored prose or fall back to the model catalogue.
- **TODO-08 — Models table on `/models`** ([workflow-steps §3](workflow-steps.md)):
    - _Resolved for Step 3:_ Monotonically numbered sequentially (Model 1, Model 2); Model Name displays `Model {num} — {Library Name}` or `Model {num}`; features listed in dataset order or "Not selected"; configuration shows persisted values or "Not configured"; Training Setup shows the formatted One-Shot split or Cross-Validation fold count, or "Not configured"; duration shows formatted seconds or "Not trained"; Action links to `/models/{num}` ("View Results" if trained, "Continue" if draft); renaming/deleting/duplicating excluded; empty state displays clear guidance; Compare Results disabled with visible hint until ≥ 2 models trained.
- **TODO-09 — Custom dataset upload** ([workflow-steps §1](workflow-steps.md)):
    - _Resolved for Step 1:_ Upload dialog (`app-upload-dataset-dialog`), progress phases, error mappings, cancellation lifecycle, and data-quality reporting implemented.
- **TODO-10 — Column details panel** ([workflow-steps §1 Preview](workflow-steps.md)):
    - _Resolved for Step 1:_ Delivered in `app-column-details` and [components/sidepanel.md](components/sidepanel.md) (stored statistics, discrete histogram bin table, categorical expansion, date, time and UTC datetime display, text identifier candidate, Escape/close focus return).
- **TODO-11 — Set Target rules** ([workflow-steps §2](workflow-steps.md)):
    - _Resolved for Step 2:_ Implemented in `src/features/target/target-eligibility.ts` and `app-target-view.ts`: unsupported (text, date, time, datetime), constant, and all-missing columns disabled with exact notes; identifier, missing values count, high cardinality, and descriptor candidate hints are advisory.
- **TODO-12 — Modal content:**
    - _Resolved:_ Datasheets rendered via `app-datasheet-dialog`; Model descriptions rendered via `app-model-description-dialog` using safe loader and missing-prose fallback.

## 2. Open questions in existing specs

### [app-state-and-navigation.md §12](app-state-and-navigation.md)

- **TODO-13** — _Resolved:_ **Change Dataset** button opens a modal confirmation dialog before clearing dataset, target, and models via `clearDataset()`.
- **TODO-14** — _Resolved for Step 3:_ Completed model sections in draft models display an "Edit" button; clicking it prompts native modal confirmation before reopening and clearing downstream completions while preserving choices (§6.3).
- **TODO-15** — Add a **Cancel training** control? (§7)
- **TODO-16** — _Resolved for Step 2:_ Replaced "warning bar" with shared `.notification.notification-alert` with `/data` link in blocked view (§4.3).
- **TODO-17** — _Resolved for Step 2:_ Confirm and discard modal dialog whenever any model exists (`models.length > 0`) on selecting a different target; current target is a no-op (§6.4).
- **TODO-18** — _Resolved:_ Open Datasheet and Model Description dialogs are transient UI state; they are not restored on reload.
- **TODO-19** — Is scroll memory "latest per step" (proposed) or per history entry acceptable? (§8.4)
- **TODO-20** — Give `terms-and-conditions.md` a route?

### [state-and-storage.md §11](state-and-storage.md)

- **TODO-21** — _Resolved:_ validated versioned training results are stored in `samata-db` → `model_results`. Version 2 envelopes also hold the `StoredEvaluation` that Section 6 reads; version 1 envelopes stay readable. Later result views consume these records.
- **TODO-22** — Identify uploads by content hash, so that re-uploading the same file keeps downstream state?

### [components/button.md §12](components/button.md)

- **TODO-25** — _Resolved:_ Primary background uses the agreed surface token; button Q1 is answered.
- **TODO-26** — Q3–Q8 remain open: disabled colours; hover transition (add `color`? is 500 ms intended?); long labels wrap or not; a pressed `:active` style; hover only under `@media (hover: hover)`; how many primary buttons a view may have. Q2's shared focus-ring token is answered and implemented.
- **TODO-27** — _Resolved:_ Default button text uses stone-700 on stone-50 (5.88:1, A11Y-01), with strict three-browser axe and BTN-AC-1 acceptance. Q3–Q8 remain separate policy questions.
- **TODO-28** — _Resolved for Step 1:_ No `.btn-red` style primitive added; Change Dataset opens a confirmation dialog with a `.btn-danger` confirm button.

### [components/card.md §12](components/card.md)

- **TODO-29** — _Resolved:_ Q4–Q9, Q11, Q12 answered in `components/card.md` §12 (`app-` prefix, compact notation, overflow-wrap, flex stats, capitalized strings, native button names, typed labels property dictionary).
- **TODO-30** — _Resolved:_ Button is **Load Dataset**; task badges are omitted from cards.

### [components/virtual-table.md §12](components/virtual-table.md)

- **TODO-31** — _Resolved:_ Cells render as consumer-supplied strings escaped by Lit; type-specific rich formatting is deferred ([FUTURE.md](FUTURE.md)).
- **TODO-32** — _Resolved:_ Presentational Tier 2 component (`ui-virtual-table`); consumer owns data fetching, worker integration, and stores (Known gap 8 resolved).

### [machine-learning-orchestrator.md](machine-learning-orchestrator.md)

- **TODO-33** — _Resolved for Phase 3:_ the [orchestrator](machine-learning-orchestrator.md) defines the pinned runtime, worker protocol, progress, cancellation, safe errors and result envelopes. Advanced tuning and result presentation remain later work.

## 3. Components with no spec

[COMPONENTS.md §12](COMPONENTS.md#12-component-spec-template) defines the component-spec format. Closed shell contracts are documented; the remaining feature/pattern backlog follows.

- **TODO-34** — _Resolved for shell/cards/column details:_ [sidebar](components/sidebar.md), [welcome](components/welcome-modal.md), [content modal/dialog](components/content-modal.md), [card](components/card.md) and [sidepanel](components/sidepanel.md) have specs. Separate transient datasheet/upload/model-description specs remain backlog; existing behaviour remains covered by feature plans/tests. Feature stories are a follow-up, not a missing Storybook installation.
- **TODO-35** — Patterns that appear in the mockup CSS but have no spec:
    - `.notification` (`notifications.css`) — alert variant implemented in `src/styles/notification.styles.ts` and adopted globally.
    - _Resolved:_ [chiclet](components/chiclet.md), [shared dialog](components/dialog.md), [page header](components/page-header.md) and [sidebar workflow/status](components/sidebar.md) have closed specs and scoped stories/acceptance.
    - The upload dropzone (`dropzone.css`) — used in `app-upload-dataset-dialog`.
    - The data tables on `/target` and `/models` (`table.css`) — table style module implemented in `src/styles/table.styles.ts` and adopted globally.
    - The `.train-step` sections (`train-model.css`) — implemented in `src/styles/train-model.styles.ts` and adopted globally.
    - Any general status-dot primitive beyond the sidebar-local implementation.
    - _Resolved:_ the native bar and log are specified in [Training Progress](components/training-progress.md).
    - The histogram chart.

## 4. Mockups missing or out of date ([mockups/](mockups/))

- **TODO-36** — _Narrowed:_ empty `03-4`..`03-7` placeholder duplicates are removed; `03-4` to `03-7` and `04_compare-results.html` now exist as flat `status="draft"` HTML mockups awaiting human styling and promotion.
- **TODO-37** — `01-3` still has a "Paste url to dataset" input; excluded from implemented `app-upload-dataset-dialog`. Human styling queue owns mockup cleanup.
- **TODO-38** — The step lists render the current step as a non-link `<div>`, which [app-state-and-navigation §4.4](app-state-and-navigation.md) supersedes.
- **TODO-39** — `01-4` has page title "Pen" and lacks column details panel; resolved for application code with DATA-UI-01/02/03.

## 5. Vision requirements with no spec yet ([VISION.md](VISION.md))

- **TODO-40** — §4 Progressive disclosure: standalone glossary/reference and optional formulas. Contextual definitions are implemented in Help, Training Setup and the ready results views.
- **TODO-41** — §5 Model-specific interactive visualisations (decision boundaries and similar). The chart-library choice is _resolved_: Observable Plot 0.6.17 through the shared `PlotController`. Model-specific charts remain open (Phase 6).
- **TODO-42** — §6 Ethical sample datasets (including Folktables and German Credit), and future additions to the catalogue. Follow [sample-datasets.md](sample-datasets.md) for dataset authoring and licensing. COMPAS is a remote sample because ProPublica declares no licence; it is fetched from its pinned source when loaded.
- **TODO-43** — §8 Fairness auditing (group metrics) and the fairness prompts the workflow asks. The probability threshold slider and false-positive and false-negative rates are implemented in Section 6 (Phase 4).
- **TODO-44** — §9 Which neural network model to offer, and how its opacity is contrasted with the inspectable models.
- **TODO-45** — §12 Performance budget for a "commodity laptop" (bundle size, dataset size limits, memory). Also the service-worker caching and update strategy, which ARCHITECTURE requires but does not specify.
- **TODO-46** — _Narrowed:_ Base-locale `en` instance `$locale` and `$format` implemented in `src/i18n.ts`. Additional locales, switcher, and translation workflow remain target.

## 6. Inconsistencies between specs

- **TODO-48** — _Resolved:_ [preview-dataset.md](preview-dataset.md) rewritten to describe implemented store, paging, virtualization, and scroll contracts.
- **TODO-50** — _Resolved:_ development and production serve the isolation headers required by the prebuilt training runtime. Browser checks cover both servers.
- **TODO-51** — _Resolved:_ the app consumes the pinned prebuilt web-ml package via the frozen Bun install. Native tooling and library benchmarks belong to web-ml.

## 7. Process

- **TODO-52** — The five `plans/scaffolding-*.md` plans are `ready`, but they build on specs that are still `draft` (app-state-and-navigation, state-and-storage). They also build on unanswered questions (TODO-13 to TODO-26), and `scaffolding-app-shell.md` builds components that have no spec (TODO-34). Either answer the questions and promote the specs, or record in each plan that it adopts the proposed answers.

## 8. Accessibility (WCAG 2.2 AA)

- **TODO-53 — Mockup styles WCAG 2.2 AA violations** ([mockups/css/](mockups/css/)):
  Normative mockup CSS still contains the defects below; it is not imported or mirrored wholesale into production. Shared default buttons, shell footer/current state, amber chiclets, named headings/dialogs, keyboard outlines and sidebar status/motion are repaired in the app under the visual-design registers. Remaining feature findings include the 24 exact data/model contrast elements in `tests/a11y-feature-findings.ts`, separately owned in HUMAN.md. This list remains open for feature repairs and human mockup cleanup:
    1. **SC 1.4.3 Contrast (Minimum) — Text**:
        - `.badge-amber` (`badges.css`): White on amber-500 is 2.15:1. App chiclet/welcome uses stone-900 (6.60:1, A11Y-04); mockup cleanup remains human work.
        - `.btn` default secondary button (`button.css`): Text colour `--stone-600` (`#887b71`) on `--stone-50` (`#fcfbfa`) achieves only 3.97:1 (minimum 4.5:1 required). _Remediation_: Change text colour to `--stone-700` (`#6d6056`) for 5.88:1 contrast.
        - `.card-text` (`card.css`): Text colour `--stone-600` (`#887b71`) on `#fff` achieves only 4.10:1 (minimum 4.5:1 required). _Remediation_: Change text colour to `--stone-700` (`#6d6056`, 6.07:1) or `--stone-800` (`#4d413b`, 9.84:1), as implemented in `card.styles.ts`.
        - `.file-picker-button` (`base.css`): Text colour `--stone-600` (`#887b71`) on `--stone-150` (`#f3f2ef`) achieves 3.66:1, and on hover with `--blue-100` (`#dbeafe`) achieves 3.36:1 (minimum 4.5:1 required). _Remediation_: Change text colour to `--stone-700` (5.42:1) or `--stone-800` (8.79:1).
        - `sidebar footer` (`sidebar.css`): Text colour `--stone-600` (`#887b71`) on `--stone-150` (`#f3f2ef`) achieves only 3.66:1 (minimum 4.5:1 required). _Remediation_: Change text colour to `--stone-700` (5.42:1) or `--stone-800` (8.79:1).
        - `.train-step-pending` (`train-model.css`): Text colour `--stone-500` (`#a6988e`) on `--stone-100` (`#f8f7f5`) achieves only 2.61:1 (minimum 4.5:1 required). _Remediation_: Ensure pending state is conveyed using an accessible badge/icon or `aria-disabled`, rather than low-contrast text alone.
    2. **SC 1.4.11 Non-text Contrast — Focus Indicators & Boundaries**:
        - `select:focus-visible` and `select:open` (`base.css`): Focus indicator outline `3px solid var(--blue-300)` (`#93c5fd`) against `--stone-50` achieves only 1.48:1 contrast (minimum 3:1 required for focus indicators). _Remediation_: Use `--blue-700` (`#1d4ed8`, 6.48:1), matching `:has(input:focus-visible) .file-picker-button`.
        - Form input borders (`base.css`): Borders on `input` and `select` use `1.5px solid var(--stone-300)` (`#e3d9d1`) against `--stone-100` (`#f8f7f5`), yielding a contrast ratio of 1.33:1 (minimum 3:1 required if border is the sole visual indicator of the control's boundary).
    3. **SC 2.4.7 Focus Visible**:
        - Interactive elements (`button.css`, `sidebar.css`, `steps.css`): `.btn`, `.btn-icon`, `.step-link`, `.step-model-link`, and `.project-settings` define `:hover` states but omit explicit `:focus-visible` outlines. `COMPONENTS.md §6.3` requires an outline of at least 2px using a token colour.
    4. **SC 2.3.3 Animation from Interactions & SC 2.2.2 Pause, Stop, Hide**:
        - Infinite animations (`dot.css`): The continuous pulsing animations (`pulse-core` and `pulse-ring`) run unconditionally without being enclosed in `@media (prefers-reduced-motion: no-preference)`.
        - Sidebar transitions (`sidebar.css`): `.project-settings` transition is declared outside a `prefers-reduced-motion` media query.
    5. **SC 1.4.1 Use of Colour**:
        - Status dot (`dot.css`, `steps.css`): The pulsing `.dot` conveys state (e.g. training active) via colour/pulsing alone; must always be accompanied by accessible text (e.g. `.visually-hidden`).
