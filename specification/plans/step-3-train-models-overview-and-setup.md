# Step 3: Models overview and setup

**Status:** ready | **Updated:** 2026-11-13T22:14:44Z

## Goal

**Current behaviour:** Models routes are placeholders. Store actions exist; ingestion and content pipelines are implemented. Only `content/en/models/logistic-regression.md` is authored; the available SVG assets do not cover the full model inventory. The library index has 16 entries, including clustering/PCA; model JSON has conditional defaults, not one flat options object.

**Target behaviour:** A models overview and a six-section builder deliver Choose Model and Select Features. Selection is saved immediately, but only Continue completes a section. Later configuration/training/results remain unavailable with clear pending text.

**Why:** Establish model identity, persisted setup and safe feature choices before the separately specified training work.

## Scope

**In scope**

- Connected models overview/builder, presentational model card/description dialog, catalogue adapter and feature derivation.
- Existing component/mockup contracts, resource stores from Step 1, styles from Step 2, browser tests and both journeys through feature selection.
- Accepted supervised-only scope, numbered names, no rename/delete/duplicate, one-feature minimum and deferred preprocessing controls.

**Out of scope**

- Training algorithms/workers, orchestrator, results, hyperparameter/tuning controls, new preprocessing policy, persistence schema, extra locales, shell styling and Storybook.
- Rendering missing model artwork from guessed paths, inventing diagrams or representing one model's diagram as another model's explanation.

**Constraints and invariants**

- Connected views call stores/actions; no element imports storage client, IndexedDB or workers. Presentational cards have only the existing i18n-message exception.
- Persist choices through chooseModel/setFeatures/completeSection/reopenSection. Never complete Choose Model on card selection alone.
- Target is never a feature; text/datetime are unsupported. Training defaults belong to the later configuration plan, not this adapter.
- Tokens/approved A11Y/SEM rules; draft-only areas have no new design or parity claims.

## Required reading

The implementer reads only these, plus each task's likely files.

- This plan's interfaces; `specification/workflow-steps.md` §3, §3.1–§3.2 — separate selection and Continue.
- `specification/COMPONENTS.md` §3–§9; `specification/visual-design.md` §1–§6 — Lit, API, styles and tests.
- `specification/components/card.md` §2–§8 and human answers captured in Step 1 plan — image required, identity and i18n exception.
- `specification/plans/step-1-load-data-and-preview.md` T1/_Interfaces and behaviour_; `specification/plans/step-2-set-target.md` D4 — resources/i18n and shared style ownership.
- `specification/plans/state-navigation-conformance.md` D5–D9; `specification/app-state-and-navigation.md` §4.3–§4.4, §6.3 — guards/invalidation and reopening.
- `src/types/state.ts`, `src/types/dataset.ts`, `src/types/sample-dataset.ts`, `src/stores/app.store.ts`, `src/stores/predicates.ts` — current contracts.
- `node_modules/web-ml/specification/model-specifications/index.json`, `node_modules/web-ml/specification/model-specifications/models/logistic-regression.json`, `node_modules/web-ml/package.json` — exact library IDs, export paths and conditional-default example (read-only).
- `src/common/content/content-loader.ts`, `src/types/content.ts` — model index and safe fragments.
- `specification/mockups/ui-scaffold/03-1_train-models-disabled.html`, `specification/mockups/ui-scaffold/03-2_train-models-1-choose-model.html`, `specification/mockups/ui-scaffold/03-3_train-models-2-select-features.html` — existing visual references.
- `specification/mockups/ui-scaffold/css/base.css`, `specification/mockups/ui-scaffold/css/train-model.css`, `specification/mockups/ui-scaffold/css/card.css`, `specification/mockups/ui-scaffold/css/table.css`, `specification/mockups/ui-scaffold/css/notifications.css`, `specification/mockups/ui-scaffold/css/badges.css` — mapped selectors.
- `specification/mockups/ui-scaffold/drafts/03-0_models-overview.html`, `specification/mockups/ui-scaffold/drafts/03-8_model-description.html`, `specification/mockups/ui-scaffold/drafts/03-9_choose-model-text-entries.html` — missing surfaces and accepted native text-entry fallback, structure only.
- `specification/plans/reference-dataset-regression-tests.md` D8/D10; `specification/standards-and-documentation.md` — helpers/journeys/TSDoc.

## Codebase context

- **Relevant implementation:** chooseModel selects without completing the section. Feature arrays already persist; conformance adds no-op/validation. Metadata columns are an array; leaky columns belong to the target candidate matching the active target. Existing content lives under `content/en/models/`, not deleted `content/models/` or generated TS pages.
- **Tests and commands:** Review baseline `bun run check`: 144 pass/0 fail in 22 files, 0 type errors. All three browser projects configured; no new runner/dependency required.
- **Web guidance:** Retrieved `accordion`, `forms`, `dialog`, `responsive-table`, `accessibility`. Builder needs real section headings, so use native buttons inside h2 with aria-expanded/hidden panels instead of headings inside summary. No custom arrow-key navigation. Use ordinary click/showModal under Baseline Widely available, no invoker/polyfill dependency. Native labelled checkboxes; no aria-selected on plain rows.
- **Visual reference:** All three pages opened and visually inspected on scaffold server. `03-1`: base.css `.page-header`, notifications.css `.notification-alert`; `03-2`: train-model.css `.train-model`, `.train-step*`, card.css `.cards`, `.card*`, badges.css `.badge-*` mapped to chiclet; `03-3`: same sections plus table.css `.table`, `.target-variable`, `.feature-unsupported`. Draft `03-0` models table, `03-8` dialog and `03-9` text entries have no new style mapping/parity. Keep existing mockup layer styles, not drifted css/train-model.css.
- **Lit skills:** `lit-implementer` for T2–T5.
- **Known gaps decided:** 4 is already resolved; do not reopen legacy generated-content choice. 13 no new drift; 17 tests under tests/\*.e2e.ts; 18 conformance owns shadow-link interception.
- **Assumptions requiring verification:** Step 1 resources and Step 2 shared styles must be implemented first. Missing per-model artwork uses the accepted text-entry fallback below; it is no longer a content blocker.
- **Review author:** Codex (model unrecorded), 2026-11-13; retain this co-author during workflow migration.
- **Review handoff:** Review-complete draft, no product blockers. User accepted supervised setup defaults and native text entries for models without artwork. Retain current-tooling draft metadata, then migrate/submit as ready-for-review once workflow-gates exists.

## Technical decisions

| Decision      | Chosen approach and rationale                                                                                                                                                                               | Rejected alternative / trade-off                                                                              |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| D1 Components | Two connected route elements, one model card and one description dialog. Step panels are same-file template functions until they need independent APIs.                                                     | Four speculative section components add public surfaces for two current steps.                                |
| D2 Catalogue  | Read library JSON index, filter by target type; per-model JSON descriptions only, no default extraction. A static import map is a bundling map validated against index, never a second algorithm inventory. | Dynamic browser imports of bare package paths or flattening conditional defaultBy/applicability into options. |
| D3 Identity   | `modelId` with attribute `model-id`, typed modelId/name event detail, same convention as dataset cards.                                                                                                     | Translated names or inline arrow wrappers for identity.                                                       |
| D4 Content    | Existing model content loader with transient dialog. Missing article falls back to the library JSON's plain description, with a visible unavailable-detail notice; network failure has Retry.               | Removing an otherwise available model because prose is not authored, or unsafeHTML.                           |
| D5 Workflow   | Card select calls chooseModel only. Continue validates selection and completes choose-model. Feature toggles persist; Continue completes select-features.                                                   | Auto-advancing on Select Model contradicts workflow-steps §3.1.                                               |
| D6 Reopen     | Completed section heading button asks native confirmation before reopenSection; keep choices, clear downstream completions. Confirm/cancel/Escape use native dialog lifecycle.                              | Removing the already-approved reopening action or silently discarding later completions.                      |

### Interfaces and behaviour

**Catalogue (accepted scope):** `src/features/models/model-catalogue.ts` exports `ModelCatalogueEntry {id:string,name:string,taskType:'classification'|'regression',description:string}`, `modelsForTarget(type:ColumnType):readonly ModelCatalogueEntry[]`. Build a static import map for per-model descriptions using the package's exported JSON subpaths, checked against every library index id/file. The index alone determines inventory; categorical/boolean → classification, numeric → regression, text/datetime → empty. Exclude clustering/PCA. Preserve library index order. Authored ModelEntry.order is not applied by this synchronous pure catalogue adapter. Read articles with loadContentEntry('models', modelId); display recorded lang/dir. Do not interpret defaultKind/defaultBy/appliesWhen or assign hyperparameters in this plan.

**Accepted illustration and text-entry contract:** User accepted plain text entries for models lacking illustrations. The only illustrated entry in this plan is `logistic-regression`: copy the existing `03-2_train-models-1-choose-model.html` selector `.card-image` SVG as a literal Lit template inside `src/features/models/app-model-builder-view.ts` in T4. Preserve geometry/viewBox; set slot=image and aria-hidden, mapping fill #FCD34D → var(--amber-300), fill #BFDBFE → var(--blue-200), and stroke #6D6056 → var(--stone-700). No unsafeHTML, fetched SVG, new asset file or public illustration helper. Do not assign `public/assets/linear-regression.svg` to a model by filename alone; leave it unchanged.

All other 13 supervised library IDs use native text entries in the same library-order list, following draft `03-9_choose-model-text-entries.html`: li, h3 model name, p library description, Model Description button, Select Model button. They have no app-model-card, empty image slot, placeholder image or new CSS. Use existing buttonStyles and permitted draft layout only. Native buttons carry data-model-id and prototype handlers; accessible names are Model Description: {name} and Select Model: {name}. Both entry forms share the exact choose/describe actions and separate Continue rule. Existing model cards still require their image slot to be filled. The illustration choice is the exact single ID above, not a parallel algorithm inventory or an implementer decision. Later artwork/style work may replace text entries through a separate plan.

**Closed components:** properties below are unreflected; arrays/objects/DocumentFragment are property-only. All listed events dispatch on host with bubbles:false/composed:false because the immediate consumer binds them. No unlisted props/slots/parts/custom properties/events.

| Element / file / tier                                                                       | Public API                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| app-models-view / src/features/models/app-models-view.ts / Tier 3                           | Only `whenSettled():Promise<void>`. Reads app/predicates/resources; calls createModel/router navigate.                                                                                                                                                                                                                                                                      |
| app-model-builder-view / src/features/models/app-model-builder-view.ts / Tier 3             | `modelNum:number=0`, attribute `model-num`; `whenSettled():Promise<void>`. Same store boundary; no storage calls.                                                                                                                                                                                                                                                           |
| app-model-card / src/components/app-model-card.ts / Tier 2                                  | `modelId:string=''`, attribute `model-id`; `type:'classification'\|'regression'='classification'`; `name:string=''`, `description:string=''`; one required image slot with noninteractive SVG `viewBox='0 0 360 216'`. Events `app-model-select` and `app-model-description-open` carry `{modelId:string,name:string}`. Card owns translated labels/type; image decorative. |
| app-model-description-dialog / src/features/models/app-model-description-dialog.ts / Tier 2 | `open:boolean=false`, `heading:string=''`, `content:DocumentFragment\|null=null`, `fallback:string=''`, `status:'loading'\|'ready'\|'missing'\|'error'='loading'`; labels object exactly close/retry/status string keys, default empty strings. Events `app-model-description-close` `{}`, `app-model-description-retry` `{}`. No slots.                                    |

Builder owns private dialog/pending-reopen state; actual route comes from router, chosen model/features/completedSteps from persisted app state. No local parallel model state. Existing resource store loads metadata/descriptor by dataset ID and sampleId. whenSettled resolves after current resources and updateComplete, including failure; stale modelNum/dataset changes invalidate pending work.

**Accepted model overview (TODO-08):** display Model {num} — {library name}, or Model {num} before selection; no rename/delete/duplicate. Features listed in dataset order or “Not selected”; configuration/training setup “Not configured” when sections incomplete, otherwise plain persisted values with no guessed methodology labels; duration “Not trained” unless durationMs exists, formatted seconds via i18n. Continue/View Results always links to `/models/{num}`. Empty table replaced by “No models yet. Train a new model to get started.” Train New Model invokes createModel then navigate only on success. Compare disabled with a visible hint until $canCompare, then link `/results`. `/models/{num}` guard is MODEL_NOT_FOUND only, per conformance D5; do not reinstate dataset/target-first guard.

**Accepted features (TODO-06):** helper `src/features/models/feature-eligibility.ts` exports `FeatureRow {name:string,type:ColumnType,eligible:boolean,isTarget:boolean,initiallySelected:boolean,reasonCodes:FeatureNoteCode[]}`, `FeatureNoteCode` union `TARGET|UNSUPPORTED|ALL_MISSING|CONSTANT|IDENTIFIER|LEAKY|MISSING_VALUES`, and `buildFeatureRows(metadata:DatasetMetadata,target:string,descriptor:SampleDatasetDescriptor|null):FeatureRow[]`. Target shown with an empty checkbox cell and visible Target badge, never checked. Text/datetime/all-missing/constants ineligible using Step 2's discriminated algorithm. Identifier and matching targetCandidate.leakyColumns default unticked but user may deliberately override with visible explanatory note. Sensitive columns remain selectable. At least one eligible feature; no preprocessing controls or automatic training preprocessing yet. Future configuration plan owns provider imputation/encoding.

Do not auto-select features on every mount. Add the explicit store action `initialiseFeatureSelection(num:number,names:string[]):boolean` in app.store.ts. It validates current dataset/target, draft status and names using the same eligibility guards as setFeatures; invalid input returns false without mutation. If `model.ui.featureSelectionInitialised === true`, return true without changing even an empty selection. Otherwise set features and `ui.featureSelectionInitialised=true` atomically, preserving other UI keys and applying normal downstream invalidation. This is a namespaced key in the existing extensible ui record, not a top-level schema/version change. Existing records lacking the marker are initialised once only by the successful Choose Model Continue handler, never on entry/render/reload. Markers survive reopening/model changes, so deliberately empty lists are not auto-filled. Subsequent toggles use setFeatures/toggleFeature. Continue validates current resources before completing select-features. No modelOptions writes.

Builder uses ordered sections with h2 headings and native buttons for completed editable steps; active aria-current=step, pending sections noninteractive. Steps 3–6 show “Not available yet” and cannot be completed; after feature Continue, section 3 displays that pending message, never training controls. Model Description stays transient across reload (current state contract). Reset dialog returnValue after close; native Escape must not replay a previous confirmation.

**Styles:** Step 2 owns tableStyles/notificationStyles. T2 uses existing cardStyles/buttonStyles/chicletStyles. T4 creates only trainModelStyles from normative mockup train-model.css; no competing badge module. Retain A11Y-01/04/06/07/08/10, SEM-04/06/07/08/09/11. Record `MODELS-UI-01` for correcting false completed status in 03-2 and adding explicit Continue; `MODELS-UI-02` removes invalid aria-selected and adds form/unique labels. All ID references remain within each root. Reopening/overview/missing-description/text-entry additions follow drafts without new colours/borders/type sizes. Record MODELS-UI-03 for the user-approved illustrated-card/native-text split: keep parity for the illustrated card and existing step shell; no parity entry for the draft-only text entries.

## Specification changes

- [ ] `specification/workflow-steps.md` §3.1–§3.2 — catalogue scope/order, illustrated Logistic Regression plus native text entries for remaining models, selected-vs-completed phases, numbered overview, features/defaults/reopen and pending later sections; keep partial status for training/results.
- [ ] `specification/components/card.md` §3/§6–§12 — modelId/model-id events, required art, CSS capitalisation, i18n-only exception and browser paths; status implemented only for delivered full scope, otherwise partial.
- [ ] `specification/app-state-and-navigation.md` §4.3–§4.4/§6.3 and `specification/state-and-storage.md` §3/§5 — exact guards/Compare/reopen/setup, initialiseFeatureSelection action and model.ui.featureSelectionInitialised semantics; no invented results controls or top-level schema/version change.
- [ ] `specification/content-and-i18n.md` — model dialog consumes existing safe loader and records missing-content fallback without claiming missing prose is authored.
- [ ] `specification/visual-design.md` §3/§5 — trainModelStyles ownership, MODELS-UI-01/02/03 and mapped A11Y/SEM rules; draft-only surfaces remain unstyled.
- [ ] `specification/testing.md` — reference journeys now reach model and feature selection, later training remains target.
- [ ] `specification/FUTURE.md` — authored model illustrations and replacement of the native text-entry fallback are deferred; new cards require a model-appropriate approved SVG.
- [ ] `specification/TODO.md` — settle scoped TODO-06/07/08/12/14/18/29/30/34/35; narrow TODO-36 to empty 03-4–03-7; `specification/README.md` statuses reflect delivered scope, Known gap 4 stays resolved.

## Implementation tasks

### T1 — Catalogue adapter and pure feature rules

- **Depends on:** Step 1 T1 and Step 2 T1 implemented.
- **Risk:** needs care — library conditional defaults and per-target leakage hints must not be misinterpreted.
- **Likely files:** `src/features/models/model-catalogue.ts`, `src/features/models/feature-eligibility.ts`, `tests/model-catalogue.test.ts`, `tests/feature-eligibility.test.ts`, `src/stores/app.store.ts` (only the new initialiseFeatureSelection action), `tests/state-and-storage.test.ts` (idempotent initialisation cases).
- **Must not touch:** web-ml, store schema, preprocessing/provider and content files.
- **Implementation:** Implement the exact adapter/helper contracts and initialiseFeatureSelection action; no hyperparameter extraction. Validate bundling map against index, target-matched leakage and actual stats types. Existing conformance/Step 1 actions must remain intact.
- **Acceptance criteria:**
    - [ ] `MOD-CAT-1` — exact supervised IDs/types/order, no clustering/PCA, no defaultBy flattening; bundling map complete.
    - [ ] `MOD-FEAT-1` — target/unsupported/constant/all-missing protections, matching candidate leakage and advisory identifier defaults.
    - [ ] `MOD-FEAT-2` — initialisation is atomic/idempotent; deliberate empty selection survives serialisation/reload/reopen; invalid or non-draft input does not mutate state.
- **Verification:** `bun test tests/model-catalogue.test.ts tests/feature-eligibility.test.ts tests/state-and-storage.test.ts`; `bun run check`.
- **Progress:** [ ] Not started

### T2 — Model card and description dialog

- **Depends on:** T1.
- **Risk:** needs care — required illustration and missing-vs-failed content distinction.
- **Likely files:** `src/components/app-model-card.ts`, `src/features/models/app-model-description-dialog.ts`, `tests/model-card.e2e.ts`. The illustrated consumer is the builder file in T4; no asset file is created.
- **Must not touch:** Stores, workers, ingestion and normative mockups.
- **Implementation:** Closed APIs above, direct identity events, existing styles and native dialog with safe fragment. Keep the model-card image required; use the existing mockup SVG as the test fixture. T4 renders the accepted native text fallback without adding another component or card variant.
- **Acceptance criteria:**
    - [ ] `MOD-CARD-1` — typed identity, complete required slot, native actions, wrapping/RTL/long labels, tokens and image hidden from AT.
    - [ ] `MOD-DESC-1` — ready/missing/error/retry states, recorded lang/dir, safe content and native focus return.
- **Verification:** `bun run test:e2e tests/model-card.e2e.ts`; `bun run check`.
- **Progress:** [ ] Not started

### T3 — Models overview

- **Depends on:** T2; state-navigation-conformance implemented.
- **Risk:** routine.
- **Likely files:** `src/features/models/app-models-view.ts`, `src/app.ts`, `tests/models-overview.e2e.ts`.
- **Must not touch:** Builder, sidebar styles, model schema and results.
- **Implementation:** Mount overview with exact guards/table/empty state/create action and Compare hint. Reuse Step 2 styles with draft limits, no new hub appearance.
- **Acceptance criteria:**
    - [ ] `MOD-HUB-1` — guards, empty/populated rows, monotonically numbered creation and correct model links.
    - [ ] `MOD-HUB-2` — Compare disabled until two trained models; no rename/delete/duplicate or invented config summaries.
- **Verification:** `bun run test:e2e tests/models-overview.e2e.ts`; `bun run check`.
- **Progress:** [ ] Not started

### T4 — Builder model and feature sections

- **Depends on:** T3.
- **Risk:** needs care — completion/invalidation and intentional empty features on reload.
- **Likely files:** `src/features/models/app-model-builder-view.ts`, `src/styles/train-model.styles.ts`, `src/styles/global.ts`, `src/app.ts`, `tests/models-setup.e2e.ts`.
- **Must not touch:** Persisted schema, training actions/workers, sidebar and preprocessing.
- **Implementation:** Same-file panel templates, the exact Logistic Regression SVG and native text-entry fallback above, labelled checkboxes/form, separate Select/Continue, one-time feature initialisation in Continue, persisted toggles and confirmed reopening; pending sections 3–6 cannot train.
- **Acceptance criteria:**
    - [ ] `MOD-SETUP-1` — Select alone does not complete; Continue does; initial features set once; deliberately empty selection survives reload.
    - [ ] `MOD-SETUP-2` — target excluded, at least one eligible feature, disabled unsupported rows, overrides for advisory identifier/leakage are deliberate.
    - [ ] `MOD-SETUP-3` — reopening preserves choices and clears later completions only after confirmation; no later training controls.
    - [ ] `MOD-SETUP-4` — Logistic Regression has the existing filled SVG slot; all other supervised IDs render named native text actions with no empty card/image. Both forms select/describe correctly, persist the same IDs and enable the same Continue action. Cover at least one classifier and one regressor fallback, RTL and long names.
- **Verification:** `bun run test:e2e tests/models-setup.e2e.ts`; `bun run check`.
- **Progress:** [ ] Not started

### T5 — Browser parity, a11y and both setup journeys

- **Depends on:** T4; Step 2 T3 journeys implemented.
- **Risk:** needs care — seeded parity must match real active/completed sections.
- **Likely files:** `tests/models-setup.e2e.ts`, `tests/visual-parity/map.ts`, `tests/visual-parity.e2e.ts`, `tests/a11y.e2e.ts`, `tests/journeys/iris-classification.e2e.ts`, `tests/journeys/penguins-classification.e2e.ts`.
- **Must not touch:** Product code, goldens and normative mockups.
- **Implementation:** Seed 03-1/02/03 states for parity only; journeys continue actual sample→target→model→features UI, reload/resume at each stage. No seeded state, worker shortcuts or fabricated training. Hub/dialog/text-entry drafts have tokens/axe, no parity entries. Record keyboard/AT, 320px, 200% zoom, RTL/long labels and forced colours.
- **Acceptance criteria:**
    - [ ] `MOD-PARITY-1` — mapped mockup selectors pass with explicit approved deviations; all new states pass tokens/axe.
    - [ ] `JOURNEY-IRIS-SETUP` and `JOURNEY-PENGUINS-SETUP` verify persisted model/features and completed first two sections via real UI.
- **Verification:** `bun run test:e2e tests/models-setup.e2e.ts tests/visual-parity.e2e.ts tests/a11y.e2e.ts tests/journeys/iris-classification.e2e.ts tests/journeys/penguins-classification.e2e.ts`; `bun run check`; `bun run build`.
- **Progress:** [ ] Not started

### T6 — Sync specification

- **Depends on:** T1, T2, T3, T4, T5.
- **Risk:** needs care — distinguish setup from unavailable training/results.
- **Likely files:** `specification/workflow-steps.md`, `specification/components/card.md`, `specification/app-state-and-navigation.md`, `specification/state-and-storage.md`, `specification/content-and-i18n.md`, `specification/visual-design.md`, `specification/testing.md`, `specification/FUTURE.md`, `specification/TODO.md`, `specification/README.md`, `specification/HUMAN.md`.
- **Must not touch:** Product code, tests and normative mockups.
- **Implementation:** Apply every specification change with honest statuses and remove resolved queue items; retain unfinished content/styling. Workflow-gates verifier owns sync after migration.
- **Acceptance criteria:**
    - [ ] Every specification change applied/ticked, no unresolved API or false training/content completion claim.
    - [ ] Index/status consistency passes.
- **Verification:** `bun run plans:check`; review `git diff specification/`.
- **Progress:** [ ] Not started

## Verification and definition of done

- [ ] All acceptance IDs tested in configured browsers; name any manual/browser checks not run.
- [ ] `bun run check`, build, tokens, parity/a11y and reference journeys pass; record fresh before/after counts (review baseline 144 pass/0 fail, 0 type errors).
- [ ] No schema/training/default-policy expansion; all specification changes ticked and draft-only limitations recorded.

## Risks and open questions

- **Blocking:** None.
- **Decisions accepted:** User accepted the proposed supervised-model setup defaults and the missing-art native text-entry fallback in chat. TODO-06/07/08/12 are settled for this scope. Required image slots remain mandatory for actual model cards; missing artwork/prose does not block native entries with the accepted description fallback.
- **Non-blocking:** Awaiting styled overview/description/text-entry drafts and later model illustrations. Reopening and transient modal policy are already decided; do not re-ask TODO-14/18. Later configuration/training/results still depend on TODO-01/02/04/05/33 and are excluded. Formal ready-for-review submission awaits workflow-gates.

## Implementation and verification log

| When (UTC) | Task | Outcome / commands / evidence |
| ---------- | ---- | ----------------------------- |
| —          | —    | Not started                   |

## Change log

| When (UTC)           | Change                                                                                                          | Reason                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 2026-11-13T10:22:14Z | Initial draft                                                                                                   | Models setup planning.                                                             |
| 2026-11-13T18:47:40Z | Rebased content/data contracts, closed APIs and completion rules, added journeys, isolated missing-art decision | Review request and human answers; all tasks unstarted and decomposed.              |
| 2026-11-13T22:14:44Z | Recorded accepted product defaults and review-complete handoff                                                  | User accepted the grouped decisions in chat; retained draft metadata as requested. |
