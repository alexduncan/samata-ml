# Specification TODO

**Updated:** 2026-11-12

Open questions and missing specification found by reviewing every Markdown and HTML file in `specification/`. Each item names its source. These are **decisions for a human**: agents must not resolve them silently. When one is answered, update the source spec and delete the item here. Plans can cite items by ID (e.g. "decides TODO-05").

Spec-vs-code conflicts are tracked separately in [README.md § Known gaps](README.md#known-gaps). Deferred features are in [FUTURE.md](FUTURE.md).

## 1. Workflow steps that need specifying

- **TODO-01 — Configure Training** ([workflow-steps §3.4](workflow-steps.md), marked TODO): which split, fold and validation procedures (hold-out, k-fold, nested cross-validation), their options and defaults. Also how the UI _enforces_ separate training, validation and test data ([VISION §10](VISION.md)). The persisted `ValidationMethodology` shape in [state-and-storage §3](state-and-storage.md) is a placeholder. Mockup `03-5` is empty.
- **TODO-02 — Single Model Results** ([workflow-steps §3.6](workflow-steps.md), marked TODO): the common metrics for classification and regression; which charts each model shows; and the format of `src/config/models/{model-name}.ts`. Results storage is still open (TODO-21). Mockup `03-7` is empty.
- **TODO-03 — Compare Results** ([workflow-steps §4](workflow-steps.md), marked TODO): which metrics are compared, which models can be compared (same task type only?), and the layout. Mockup `04` is a placeholder.
- **TODO-04 — Training** ([workflow-steps §3.5](workflow-steps.md)): the progress and timing events `web-ml` emits; the per-step timing table for nested cross-validation and tuning; and what happens if training fails. Step 4's button is called "Train Model" in §3.4 but "Continue" in §3.5, so pick one. Mockup `03-6` is empty.
- **TODO-05 — Configure Model** ([workflow-steps §3.3](workflow-steps.md)):
    - Where each model's hyperparameter definitions come from (ranges, types, defaults; `web-ml` or app config).
    - The hyperparameter-tuning UI: search method, how ranges are entered, and which tuning metric.
    - How the available multiclass strategies are discovered.
    - Mockup `03-4` is empty.
- **TODO-06 — Select Features** ([workflow-steps §3.2](workflow-steps.md)):
    - The list "includes the target variable". Can the target ever be ticked as a feature? It should probably be shown but disabled, to avoid leakage.
    - Which column types can be selected.
    - Where model-specific options (one-hot encoding, regularisation) are defined, and how they map to the `IndexedDBDatasetProvider` preprocessing pipeline ([data-ingestion §6](data-ingestion.md)).
    - Mockup `03-3` is empty.
- **TODO-07 — Choose Model** ([workflow-steps §3.1](workflow-steps.md)):
    - How the model list and task types are read from `web-ml`.
    - Where each card's SVG illustration and description come from. Only `content/models/logistic-regression.md` exists.
    - The badge lists "Clustering", but only classifiers and regressors are offered. Are clustering models in scope?
- **TODO-08 — Models table on `/models`** ([workflow-steps §3](workflow-steps.md)): how models are named and numbered; what the Configuration and Training Setup columns show; and whether a model can be deleted or duplicated.
- **TODO-09 — Custom dataset upload** ([workflow-steps §1](workflow-steps.md)):
    - "When the following events fire…" lists no events.
    - Limits on file size and row and column counts.
    - Accepted encodings and delimiters, and whether there must be a header row.
    - Error messages.
    - Upload progress UI.
    - How the user is told about skipped malformed rows (DATA-AC-2 in [data-ingestion](data-ingestion.md)).
- **TODO-10 — Column details panel** ([workflow-steps §1 Preview](workflow-steps.md)): how the histogram is rendered; how categorical frequencies are shown for high-cardinality columns; and what text columns show. [components/sidepanel.md](components/sidepanel.md) is a stub, and mockup `01-4` has no `<aside>`.
- **TODO-11 — Set Target rules** ([workflow-steps §2](workflow-steps.md)): which columns can be targets, and what the Notes column says for each case: text, ID-like, constant, high-cardinality categorical, or mostly empty.
- **TODO-12 — Modal content:** the welcome modal text; the datasheet's fields and their source (`datasets.ts` fields or a Markdown file per dataset); and the model description content for each model.

## 2. Open questions in existing specs

### [app-state-and-navigation.md §12](app-state-and-navigation.md)

- **TODO-13** — How does the user leave the dataset preview: **Change Dataset**, **Delete Dataset** (shown disabled in mockup `01-4`), or both? (§6.1)
- **TODO-14** — Can completed model sections be re-opened and edited before training? (§6.3)
- **TODO-15** — Add a **Cancel training** control? (§7)
- **TODO-16** — Replace the "warning bar" on `/target` with the shared `.notification`? (§4.3)
- **TODO-17** — What happens to trained models when the dataset or target changes: confirm and discard (proposed), a hard lock, or keep them read-only and archived? (§6.4; mockup `02-2` shows a reset warning.)
- **TODO-18** — Restore an open Datasheet or Model Description dialog on reload? (Currently no.)
- **TODO-19** — Is scroll memory "latest per step" (proposed) or per history entry acceptable? (§8.4)
- **TODO-20** — Reserved content: create `content/pages/help.md`? Give `terms-and-conditions.md` a route?

### [state-and-storage.md §11](state-and-storage.md)

- **TODO-21** — Store results in a `model_results` store in `samata-db`, or in a separate database?
- **TODO-22** — Identify uploads by content hash, so that re-uploading the same file keeps downstream state?
- **TODO-23** — `datasets.ts` uses `name`/`shape` and has no stable `id`, while workflow-steps uses `title`/`num_records`/`num_columns`. Which is canonical?
- **TODO-24** — Confirm that Web Locks meets the Baseline Widely available target.

### [components/button.md §12](components/button.md)

- **TODO-25** — Q1 primary background token: [card.md](components/card.md) Q1 answered `--surface: #fff`, so adopt that in button.md.
- **TODO-26** — Q2–Q8: focus-ring token; disabled colours; hover transition (add `color`? is 500 ms intended?); long labels wrap or not; a pressed `:active` style; hover only under `@media (hover: hover)`; how many primary buttons a view may have.
- **TODO-27** — card.md Q2 found that button.md's claim that `--stone-600` on `--stone-50` reaches 4.5:1 is wrong (3.97:1). Recheck it.
- **TODO-28** — Mockup `01-4` uses `.btn-red`, but button.md §11 excludes danger variants. Add a variant, or change the mockup.

### [components/card.md §12](components/card.md)

- **TODO-29** — Q4–Q9, Q11, Q12:
    - The `app-` prefix.
    - Compact number notation losing precision ("61K").
    - `overflow-wrap` for long strings.
    - An empty image slot.
    - Wrapping `.stat` spans.
    - Capitalisation of model types.
    - The `aria-describedby` approach for repeated button names.
    - Whether presentational components may import the i18n store.
- **TODO-30** — Q10 refers to `specification/steps/step-one.md`, which does not exist (now [workflow-steps.md §1](workflow-steps.md)). The card says **Select Dataset**, but workflow-steps and mockup `01-1` say **Load Dataset**. Should the card show dataset `tasks`?

### [components/virtual-table.md §12](components/virtual-table.md)

- **TODO-31** — Render cells with a `renderCell` template per column, or strings only?
- **TODO-32** — Is the component presentational (this spec) or connected (the old stub)? See Known gap 8.

### [machine-learning-orchestrator.md](machine-learning-orchestrator.md)

- **TODO-33** — Whole spec needed:
    - The `web-ml` API surface the app uses.
    - Worker topology and the messaging protocol (testing.md mentions Comlink; no spec chooses it).
    - Progress and cancellation events.
    - Error handling.
    - The results shape.
    - Ownership of the `SharedArrayBuffer` that [data-ingestion §6](data-ingestion.md) requires.

## 3. Components with no spec

[app-state-and-navigation §3](app-state-and-navigation.md) says each component needs a spec in `components/` before implementation (COMPONENTS.md §12). None of these has one:

- **TODO-34** — `<app-sidebar>`, `<app-welcome-modal>`, `<app-content-modal>`, and the transient dialogs (datasheet, upload, model description).
- **TODO-35** — Patterns that appear in the mockup CSS but have no spec:
    - `.notification` (`notifications.css`).
    - The badge or chiclet. Its rules live inside card.md; consider moving them to `components/chiclet.md`.
    - The upload dropzone (`dropzone.css`).
    - The modal and dialog styles (`modal.css`).
    - The sidebar step list (`steps.css`, `sidebar.css`).
    - The data tables on `/target` and `/models` (`table.css`).
    - The `.train-step` sections (`train-model.css`).
    - The status dot (`dot.css`).
    - The training progress bar.
    - The histogram chart.

## 4. Mockups missing or out of date ([mockups/ui-scaffold/](mockups/ui-scaffold/))

- **TODO-36** — `03-3` to `03-7` are empty files, and `04_compare-results.html` contains only a placeholder.
- **TODO-37** — `01-3` still has a "Paste url to dataset" input, but URL-paste was removed ([state-and-storage §10 #7](state-and-storage.md)).
- **TODO-38** — The step lists render the current step as a non-link `<div>`, which [app-state-and-navigation §4.4](app-state-and-navigation.md) supersedes.
- **TODO-39** — `01-4` has the page title "Pen", and has no column-details panel.

## 5. Vision requirements with no spec yet ([VISION.md](VISION.md))

- **TODO-40** — §4 Progressive disclosure: how plain-English definitions, a glossary and optional formulas are authored and shown.
- **TODO-41** — §5 Model-specific interactive visualisations (decision boundaries, confusion matrices) and the choice of chart library. There is no dependency for one yet.
- **TODO-42** — §6 Ethical sample datasets (Folktables, COMPAS, German Credit). `datasets.ts` has only Penguins and Iris. Also needed: licensing and size, and the datasheet content.
- **TODO-43** — §8 Probability threshold slider, false-positive and false-negative rates, fairness auditing (group metrics), and the fairness prompts the workflow asks.
- **TODO-44** — §9 Which neural network model to offer, and how its opacity is contrasted with the inspectable models.
- **TODO-45** — §12 Performance budget for a "commodity laptop" (bundle size, dataset size limits, memory). Also the service-worker caching and update strategy, which ARCHITECTURE requires but does not specify.
- **TODO-46** — i18n: which locales ship, the language-switcher UI, and the translation workflow. [content-and-i18n.md](content-and-i18n.md) is only an outline.

## 6. Inconsistencies between specs

- **TODO-47** — Column types: [data-ingestion.md](data-ingestion.md) has no `boolean`, and [preview-dataset.md](preview-dataset.md) uses `text|integer|float|boolean`. [state-and-storage §10 #4](state-and-storage.md) sets the canonical set but says both need aligning.
- **TODO-48** — [preview-dataset.md](preview-dataset.md) describes the old implementation (`Pipeline.state`, `SelectDataView`, single-dataset stores, the `dataset_stats` key), which state-and-storage §10 #5 and #8 supersede. Rewrite it or retire it.
- **TODO-49** — The data-ingestion Pass 2 median collects every value into an array, which conflicts with its memory goal. Specify the algorithm (external sort, an approximation, or a size cap).
- **TODO-50** — `SharedArrayBuffer` needs cross-origin isolation. `public/_headers` sets COOP and COEP for production, but the dev server does not send them. Specify this for development.
- **TODO-51** — [ARCHITECTURE § Future Improvements](ARCHITECTURE.md) mentions Zig, Emscripten and a scikit-learn benchmark workflow. These look as though they belong to `web-ml`; confirm what applies to this repo.

## 7. Process

- **TODO-52** — The five `plans/scaffolding-*.md` plans are `ready`, but they build on specs that are still `draft` (app-state-and-navigation, state-and-storage). They also build on unanswered questions (TODO-13 to TODO-26), and `scaffolding-app-shell.md` builds components that have no spec (TODO-34). Either answer the questions and promote the specs, or record in each plan that it adopts the proposed answers.
