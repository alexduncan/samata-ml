# Human tasks

**Updated:** 2026-11-13

Everything in `specification/` that only a human can do before agents can plan or implement the remaining features: approving plans, answering open questions, writing missing specs and styling mockups. Each item links to where the full detail lives. Agents must not resolve these themselves ([TODO.md](TODO.md), [spec index § Status](README.md#status)).

`TODO-nn` IDs refer to [TODO.md](TODO.md); _Known gap n_ refers to [README.md § Known gaps](README.md#known-gaps). When you answer an item, update the source spec (or ask an agent to) and delete the item here and in TODO.md.

## How this file is maintained

This is the human's work queue. Every agent keeps it current ([AGENTS.md](../AGENTS.md)). The detail always lives in the linked source (a plan's _Risks and open questions_, TODO.md, a spec's open questions); this file only points to it.

- **Add an item** whenever your work leaves the human something to do: a plan waiting for approval, a blocking question, an escalation, an unclaimed note in [notes/](notes/README.md), a draft mockup to style ([visual-design §1.1](visual-design.md#11-draft-mockups)), or a stale entry in TODO.md or Known gaps.
- **Remove an item** as soon as it is resolved, and remove items the human has ticked. Don't leave answered items behind.
- **Format:** `- [ ] **<short title> (<TODO-nn or plan slug>):** <one sentence: what to decide or do>. <Blocks <plan or task>, or Non-blocking.> Recommended: <your proposed answer, if you have one>. → [link](path#heading-anchor)`. Put it under the section that fits, in dependency order.
- **Links:** use paths relative to this file and GitHub heading anchors. Point to the heading nearest the detail. Check that every path and anchor exists.
- **Recommend:** wherever you can, give a recommended answer, so the human can reply "accept". If waiting is costly, say what you will assume.
- Refresh the **Updated:** date when you change the file.

## Suggested order

1. Start implementing the one `ready` plan (§1).
2. Approve [data-ingestion-and-storage](plans/data-ingestion-and-storage.md): Steps 1–3 all depend on it (§2).
3. Settle the virtual table and Step 1 decisions, then Steps 2 and 3 (§2).
4. Write the machine-learning orchestrator spec and the Steps 3.3–4 specs: nothing after "Select Features" can be planned without them (§4). Missing mockups no longer block: planners write unstyled drafts for you to style (§6).

## 1. Unblock work that is ready now

- [ ] **Start `state-navigation-conformance`.** It is the only `ready` plan and has no blocking questions (you answered them on 2026-11-13). Ask an implementation agent to run it. → [plan](plans/state-navigation-conformance.md#risks-and-open-questions)
- [ ] **Ask a planner to refresh the Step 1–3 plans** against answers you have already given. They still list TODO-14, TODO-15, TODO-17 and TODO-19 as open, and step-1 calls `state-navigation-conformance` a draft. → [step-1](plans/step-1-load-data-and-preview.md#risks-and-open-questions), [step-2](plans/step-2-set-target.md#risks-and-open-questions), [step-3](plans/step-3-train-models-overview-and-setup.md#risks-and-open-questions), [answers](plans/state-navigation-conformance.md#risks-and-open-questions)
- [ ] **Let planners run `modern-web-guidance` online.** The Step 1–3 plans could not run its searches (dialog, forms, responsive table, dropzone) because the sandbox had no network, and must do so before they can be `ready`. → [step-1](plans/step-1-load-data-and-preview.md#risks-and-open-questions), [step-2](plans/step-2-set-target.md#risks-and-open-questions), [step-3](plans/step-3-train-models-overview-and-setup.md#risks-and-open-questions)

## 2. Review and approve draft plans

A plan becomes `ready` only when you approve it and no blocking questions remain ([lifecycle](plans/README.md#lifecycle)).

### [data-ingestion-and-storage](plans/data-ingestion-and-storage.md) — no blockers, needs your sign-off

- [ ] **Check six decisions, then approve.** `datetime` added to `ColumnType` but not model-eligible (D17); ambiguous dates default to DMY, not your MDY (R12); stricter small-file categorical rule (R13); `none`/`nil`/`-` kept as missing-value tokens, with counts shown (R14); column roles cut to `feature`/`identifier` plus `sensitive`, with leakage per target (R4/R5); long rows skipped, not truncated (D3). Approving also answers TODO-12 (datasheets), TODO-23, TODO-24, TODO-47, TODO-49 and the ingestion half of TODO-09. → [risks](plans/data-ingestion-and-storage.md#risks-and-open-questions), [input-note review R1–R18](plans/data-ingestion-and-storage.md#review-of-the-input-notes)
- [ ] **Decide what to do with `sample_dataset_specification.md`.** This newer dataset note (underscored name, 2026-11-13 11:41) arrived after the plan's last revision (08:53), and the plan does not cover it. Either ask the planner to fold it in before you approve, or delete it if the hyphenated note still stands. → [new note](notes/sample_dataset_specification.md), [folded note](notes/sample-dataset-specification.md)

### [virtual-table-component](plans/virtual-table-component.md)

- [ ] **Cell rendering (TODO-31):** plain-text cells, or a `renderCell` template per column? → [risks](plans/virtual-table-component.md#risks-and-open-questions), [TODO.md §2](TODO.md#2-open-questions-in-existing-specs)
- [ ] **Tier (TODO-32, Known gap 8):** presentational (current spec) or connected (old stub)? → [component spec](components/virtual-table.md#2-decision-and-rationale), [Known gaps](README.md#known-gaps)
- [ ] **Virtual-table mockup:** none exists. No longer blocking: ask the planner to write an unstyled draft, then style it when you are ready. → [risks](plans/virtual-table-component.md#risks-and-open-questions), [draft mockups](visual-design.md#11-draft-mockups)
- [ ] **Semantics and keyboard model:** native `<table>` or an ARIA table, and how keyboard navigation works. → [risks](plans/virtual-table-component.md#risks-and-open-questions)
- [ ] **Size limit:** document a maximum dataset size or scroll-height strategy? → [risks](plans/virtual-table-component.md#risks-and-open-questions)

### [step-1-load-data-and-preview](plans/step-1-load-data-and-preview.md)

All items are in its [Risks and open questions](plans/step-1-load-data-and-preview.md#risks-and-open-questions).

- [ ] **Dataset card identity:** add `sampleId` to `<app-dataset-card>` (which `card.md` currently forbids), or look up a `data-sample-id` attribute? → [card.md § 3](components/card.md#3-public-api-closed)
- [ ] **Dataset card copy (TODO-29, TODO-30):** answer card.md Q4–Q12. See §3 below.
- [ ] **How the user leaves the preview (TODO-13, TODO-28):** Change Dataset, Delete Dataset, or both. If you keep the red button, approve a danger variant for `.btn`. → [app-state-and-navigation § 6.1](app-state-and-navigation.md#61-section-1--load-data-data), [button.md § 11](components/button.md#11-non-goals)
- [ ] **Column details `<aside>` (TODO-10):** its tier, public API, how the histogram is drawn, how high-cardinality categorical columns are truncated, and what text columns show. Write `components/sidepanel.md` (currently a stub). Mockup `01-5_preview-dataset-aside.html` now shows a panel. → [workflow-steps § Preview Dataset](workflow-steps.md#preview-dataset), [sidepanel.md](components/sidepanel.md)
- [ ] **Datasheet dialog (TODO-12, TODO-34, TODO-18):** its layout, and how descriptor metadata and the compiled datasheet HTML combine without `unsafeHTML`.
- [ ] **Upload UI (TODO-09 UI parts):** progress and cancel UI, error messages for each `IngestionError.code`, and how padded rows, skipped rows, missing-value tokens and invalid counts are reported. → [workflow-steps § Custom Dataset Upload](workflow-steps.md#custom-dataset-upload)
- [ ] **i18n prerequisite:** approve creating `src/i18n.ts` (`@nanostores/i18n`) in a prerequisite plan before T1. Steps 2 and 3 need it too. See §5.

### [step-2-set-target](plans/step-2-set-target.md)

All items are in its [Risks and open questions](plans/step-2-set-target.md#risks-and-open-questions).

- [ ] **Target rules and Notes column (TODO-11):** why mockups `02-1`/`02-2` have no Notes column; the exact Notes text for text, ID-like, constant, high-cardinality and mostly empty columns; and whether ineligible rows show a disabled button or an empty cell. → [workflow-steps § 2](workflow-steps.md#2-set-target)
- [ ] **Blocked state (TODO-16):** use the shared `.notification` with a link to `/data` instead of a separate warning bar? → [app-state-and-navigation § 4.3](app-state-and-navigation.md#43-blocked-state-matrix)
- [ ] **Which models a target change resets:** confirm-and-discard is decided (TODO-17). It remains open whether it applies only to trained models (as `02-2` says) or to any draft model (as the code does). → [app-state-and-navigation § 6.4](app-state-and-navigation.md#64-changing-the-dataset-or-target-while-models-exist)
- [ ] **Mockup gaps:** type shown as `<code>` or a chiclet badge; style for the active target row; where "learn more…" links go; stale links in `02-2`; literal colours and contrast in `.notification-info` and `.notification-alert`.

### [step-3-train-models-overview-and-setup](plans/step-3-train-models-overview-and-setup.md)

All items are in its [Risks and open questions](plans/step-3-train-models-overview-and-setup.md#risks-and-open-questions).

- [ ] **Mockup of the populated `/models` hub:** `03-1` shows only the blocked state. No longer blocking: ask the planner to write an unstyled draft, then style it. → [draft mockups](visual-design.md#11-draft-mockups)
- [ ] **Select Features (TODO-06):** how the target row's checkbox looks, the minimum number of features, model-specific options or automatic preprocessing, and whether constant or empty columns are eligible. → [workflow-steps § 3.2](workflow-steps.md#2-select-features)
- [ ] **Choose Model (TODO-07):** whether clustering (k-means) and dimensionality reduction (PCA) are offered, where card copy and SVGs come from, and card order. → [workflow-steps § 3.1](workflow-steps.md#1-choose-model)
- [ ] **Models table (TODO-08):** model naming and renaming, what the Features, Configuration, Training Setup and Duration columns show, the zero-models empty state, and delete or duplicate actions. → [workflow-steps § 3](workflow-steps.md#3-train-models)
- [ ] **Model description content and dialog (TODO-12, TODO-34):** only `content/models/logistic-regression.md` exists.
- [ ] **Re-opening completed sections (TODO-14):** the control and confirmation UX (keeping the action is already decided).
- [ ] **Model card (TODO-29, TODO-30):** card identity without breaking COMPONENTS §4, badge placement, amber contrast (A11Y-04) and i18n keys.
- [ ] **Shared stylesheets (TODO-35):** which shared style modules to create, and how to reconcile `css/train-model.css` with the mockup copy.
- [ ] **Mockup `03-3` accessibility bugs:** missing checkbox labels, invalid `aria-selected` on rows, no `<form>`. Record the fixes as deviations. → [visual-design § 5.2](visual-design.md#52-sem-register-mockup-semantic-defects)

## 3. Answer open questions in draft specs

`app-state-and-navigation.md`, `state-and-storage.md`, `button.md` and `card.md` are `draft`: agents may not plan against them until these are answered and you promote them ([status rules](README.md#status)).

- [ ] **Navigation spec §12 (TODO-18, TODO-20):** restore an open Datasheet or Model Description dialog on reload? Create `content/pages/help.md`, and give terms and conditions a route? Q1b, Q1c, Q2 and Q4 are answered; check that the conformance plan's sync task records them. → [app-state-and-navigation § 12](app-state-and-navigation.md#12-open-questions)
- [ ] **Storage spec §11 (TODO-21, TODO-22):** store results in `samata-db` or a separate database? Identify uploads by content hash? Q4 and Q5 are covered by the data-ingestion plan. → [state-and-storage § 11](state-and-storage.md#11-open-questions)
- [ ] **Button (TODO-26, TODO-27, TODO-28):** answer Q3–Q8 (disabled colours, hover transition, wrapping, pressed style, hover on touch, how many primary buttons). Recheck the `--stone-600` on `--stone-50` contrast claim (3.97:1). Decide on a danger variant. Q1 and Q2 are answered, so TODO-25 can be closed. → [button.md § 12](components/button.md#12-open-questions-human-to-answer-agents-must-not-resolve)
- [ ] **Card (TODO-29, TODO-30):** answer Q4–Q12: `app-` prefix, compact numbers ("61K"), long-string wrapping, empty image slot, wrapping stats, capitalisation, `aria-describedby`, the i18n import exception, and Select vs Load Dataset / showing `tasks`. → [card.md § 12](components/card.md#12-open-questions-human-to-answer-agents-must-not-resolve)
- [ ] **Promote the draft specs** to `target` or `partial` once their questions are answered. → [spec index](README.md#specs)

## 4. Write the missing specs

- [ ] **Machine-learning orchestrator (TODO-33):** the `web-ml` API surface used, worker topology and messaging (Comlink or not), progress and cancellation events, errors, the results shape, and who owns the `SharedArrayBuffer`. This blocks every training feature. → [machine-learning-orchestrator.md](machine-learning-orchestrator.md), [TODO.md §2](TODO.md#2-open-questions-in-existing-specs)
- [ ] **Configure Model (TODO-05):** where hyperparameter definitions come from, the tuning UI and metric, and how multiclass strategies are discovered. → [workflow-steps § 3.3](workflow-steps.md#3-configure-model)
- [ ] **Configure Training (TODO-01):** split, fold and validation procedures with defaults, and how the UI enforces separate training, validation and test data. → [workflow-steps § 3.4](workflow-steps.md#4-configure-training), [VISION § 10](VISION.md#10-enforced-methodological-rigour)
- [ ] **Training (TODO-04):** progress and timing events, the per-step timing table, failure handling, and the button label ("Train Model" or "Continue"). → [workflow-steps § 3.5](workflow-steps.md#5-training)
- [ ] **Single Model Results (TODO-02):** common metrics, charts per model, and the format of `src/config/models/{model-name}.ts`. → [workflow-steps § 3.6](workflow-steps.md#6-single-model-results)
- [ ] **Compare Results (TODO-03):** which metrics, which models can be compared, and the layout. → [workflow-steps § 4](workflow-steps.md#4-compare-results)
- [ ] **Component specs (TODO-34, TODO-35):** sidebar, welcome modal, content modal and transient dialogs; and the patterns with no spec (notification, chiclet, dropzone, modal, step list, data tables, `.train-step`, status dot, progress bar, histogram). COMPONENTS §12 requires a spec before a component is built. → [TODO.md §3](TODO.md#3-components-with-no-spec), [spec template](COMPONENTS.md#12-component-spec-template)
- [ ] **Modal content (TODO-12):** welcome modal text, datasheet fields and copy, and a description for each model. → [TODO.md §1](TODO.md#1-workflow-steps-that-need-specifying)
- [ ] **Rewrite or retire `preview-dataset.md` (TODO-48, Known gap 16):** it describes a removed prototype. → [preview-dataset.md](preview-dataset.md), [TODO.md §6](TODO.md#6-inconsistencies-between-specs)

## 5. Commission plans that don't exist yet

- [ ] **`scaffolding-visual-remediation` (Known gap 13, TODO-53):** bring the scaffold shell onto `css/root.css` tokens and the mockups, and apply A11Y-01, A11Y-02, A11Y-09 and SEM-01–03. → [Known gaps](README.md#known-gaps), [TODO.md §8](TODO.md#8-accessibility-wcag-22-aa), [visual-design § 5](visual-design.md#5-deviation-registers)
- [ ] **Static content notes (Known gap 4):** no plan has claimed `build-static-content.md` or `static-content-indexes.md` yet. Ask a planner to fold them into a plan, together with the i18n item below. Non-blocking. → [build-static-content](notes/build-static-content.md), [static-content-indexes](notes/static-content-indexes.md)
- [ ] **i18n foundation (TODO-46, Known gap 4):** `src/i18n.ts`, which locales ship, the language switcher, the translation workflow and where content lives. Steps 1–3 depend on it. → [content-and-i18n.md](content-and-i18n.md)
- [ ] **The rest of Known gap 14:** wiring the IndexedDB adapter and deleting stored results are outside the conformance plan. Check what data-ingestion T10 covers, then plan the remainder. → [Known gaps](README.md#known-gaps)

## 6. Style or fix mockups

Only you change the normative mockups. Where none exists, agents write an unstyled structural draft in `mockups/ui-scaffold/drafts/` and add an item here. Style the draft and move it up to `ui-scaffold/` to make it normative. → [draft mockups](visual-design.md#11-draft-mockups), [TODO.md §4](TODO.md#4-mockups-missing-or-out-of-date-mockupsui-scaffold)

- [ ] **Empty mockups (TODO-36):** `03-4` to `03-7` are empty and `04_compare-results.html` is a placeholder. Their specs (§4) must come first; agents can then draft the structure. `03-3` is now filled in, so TODO-36 needs narrowing.
- [ ] **Missing mockups:** the populated `/models` hub and the virtual table (see §2). Drafts can be written now.
- [ ] **`01-3` (TODO-37):** remove the "Paste url to dataset" input; URL loading was dropped.
- [ ] **Step lists (TODO-38):** render the current step as a link with `aria-current`, not a `<div>`. → [app-state-and-navigation § 4.4](app-state-and-navigation.md#44-sidebar-and-shortcuts)
- [ ] **`01-4` and `01-5` (TODO-39):** both have the page title "Pen". `01-5` adds the column-details panel, so TODO-39 needs narrowing.

## 7. Decide spec-to-spec and spec-to-code conflicts

- [ ] **Development cross-origin isolation (TODO-50):** the dev server needs COOP/COEP headers for `SharedArrayBuffer`. → [TODO.md §6](TODO.md#6-inconsistencies-between-specs)
- [ ] **ARCHITECTURE "Future Improvements" (TODO-51):** which of Zig, Emscripten and the scikit-learn benchmark apply to this repo rather than `web-ml`. → [ARCHITECTURE § Future Improvements](ARCHITECTURE.md#future-improvements)
- [ ] **Known gaps 1–7, 10 and 17:** decide which side wins for each: entry file and directories, HTML template path, CSS inlining, content location, happy-dom vs Playwright, Comlink and the service worker, ESLint/CI, the product name (`web-ml-app` or `samata-ml`), and where Playwright component tests live. → [Known gaps](README.md#known-gaps)
- [ ] **Scaffolding plans built on draft specs (TODO-52):** the five scaffolding plans are now `implemented`. Close the item, or record that they adopted the proposed answers. → [TODO.md §7](TODO.md#7-process)

## 8. Vision requirements with no spec yet

These aren't needed for Steps 1–3, but each needs a spec before it can be planned. → [TODO.md §5](TODO.md#5-vision-requirements-with-no-spec-yet-visionmd)

- [ ] **Progressive disclosure (TODO-40):** plain-English definitions, glossary and optional formulas. → [VISION § 4](VISION.md#4-progressive-disclosure-and-plain-english-guidance)
- [ ] **Visualisations (TODO-41):** decision boundaries and confusion matrices, plus a chart library. → [VISION § 5](VISION.md#5-appropriate-visualisations)
- [ ] **Ethical sample datasets (TODO-42):** Folktables, COMPAS and German Credit, with licensing, size and datasheets. → [VISION § 6](VISION.md#6-consequential-sociotechnical-context)
- [ ] **Threshold and fairness auditing (TODO-43):** threshold slider, FP/FN rates, group metrics and fairness prompts. → [VISION § 8](VISION.md#8-probabilistic-threshold-calibration-and-fairness-auditing)
- [ ] **Neural network (TODO-44):** which model, and how it is contrasted with the inspectable ones. → [VISION § 9](VISION.md#9-explainable-classical-models-contrasted-with-an-opaque-neural-network)
- [ ] **Performance budget and caching (TODO-45):** bundle and dataset limits, memory, service-worker caching and updates. → [VISION § 12](VISION.md#12-privacy-responsiveness-and-open-source-longevity)

[FUTURE.md](FUTURE.md) lists deferred features. Nothing there is needed now; move an item into a spec only when you want it built.
