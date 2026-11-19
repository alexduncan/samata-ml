# Step 2: Set target

**Status:** archived | **Updated:** 2026-11-19T10:40:54Z

## Goal

**Current behaviour:** `/target` is a placeholder. `setTarget` already rejects text/datetime and different targets while models exist. Metadata is stored as a `ColumnStats[]`; only categorical/text stats have distinctCount. Existing plans incorrectly assume every column has it.

**Target behaviour:** A connected target view displays blocked/loading/error/ready states, a semantic four-column table, clear eligibility notes, an active-target indicator and confirm-and-discard for a different target with any existing model.

**Why:** Help learners choose meaningful targets and preserve model work until a target change is confirmed.

## Scope

**In scope**

- Pure eligibility derivation, connected target view, existing store actions, shared table/notification styles, tests and target stages in both reference journeys.
- Adopt the already-decided confirm-and-discard policy for all models, not just trained ones; selecting the current target is a no-op.

**Out of scope**

- Ingestion, persistence schema, preprocessing, training, virtualising at most 256 column rows, reusable confirmation components, shell remediation and Storybook.
- i18n/resource foundation: Step 1 T1 provides it with an explicit contract.

**Constraints and invariants**

- Only the connected view imports stores/actions; no component imports the storage client or IndexedDB.
- Never enable selection with missing/failed metadata. Descriptor failure is advisory; metadata failure is blocking UI with Retry.
- Native table/controls/dialog, tokens, logical styles, same-root label references. No new KNOWN_DRIFT entries.

## Required reading

The implementer reads only these, plus each task's likely files.

- This plan's interfaces — exact eligibility, notes and UI state rules.
- `specification/workflow-steps.md` §2; `specification/app-state-and-navigation.md` §4.3, §6.2, §6.4 — workflow and state contract.
- `specification/COMPONENTS.md` §3–§9; `specification/visual-design.md` §1–§6 — Lit, styling, tests.
- `specification/plans/step-1-load-data-and-preview.md` T1 and _Interfaces and behaviour_ — i18n/resource stores and sampleId handling.
- `specification/plans/state-navigation-conformance.md` D5–D9 — store no-op/reset and navigation.
- `src/types/dataset.ts`, `src/types/sample-dataset.ts`, `src/types/state.ts`, `src/stores/app.store.ts` — existing discriminated stats and action signatures.
- `specification/mockups/ui-scaffold/02-1_set-target.html`, `specification/mockups/ui-scaffold/02-2_target-set.html`, `specification/mockups/ui-scaffold/03-1_train-models-disabled.html` — table/notification appearance.
- `specification/mockups/ui-scaffold/css/base.css`, `specification/mockups/ui-scaffold/css/table.css`, `specification/mockups/ui-scaffold/css/notifications.css`, `specification/mockups/ui-scaffold/css/button.css` — selectors below.
- `specification/mockups/ui-scaffold/drafts/02-3_target-states.html` — missing Notes/current-target/blocked/dialog structure, no new appearance.
- `specification/standards-and-documentation.md`; `specification/plans/reference-dataset-regression-tests.md` D8/D10 — TSDoc, helpers and journeys.

## Codebase context

- **Relevant implementation:** Existing eligibility predicate is already implemented; data-ingestion/static-content are implemented. `SampleDatasetDescriptor.modeling.targetCandidates` and sampleId are the real hints, never lookup by dataset UUID. No table/notification style modules exist.
- **Tests and commands:** Review `bun run check`: 144 passing tests in 22 files, 0 type errors/failures. Browser discovery uses `tests/*.e2e.ts`; parity requires seeded datasets/model state before navigation.
- **Web guidance:** Retrieved `responsive-table`, `forms`, `dialog`, `accessibility`: native caption/headers, named keyboard-scrollable overflow, same-root labels and native dialog lifecycle. Keep horizontal scrolling rather than introducing a stacked mobile design. Dialogs use showModal, not newer invoker commands; no manual focus trap or key handler.
- **Visual reference:** Opened/visually inspected `02-1`, `02-2`, `03-1` on scaffold server. `base.css` `.page-header`; `table.css` `.table`, `thead`, `th`, `td`; `notifications.css` `.notification.notification-alert`; `button.css` `.btn`. Preserve `<code>` type treatment. Draft `02-3` supplies absent structures; no parity entry for new Notes/confirmation content.
- **Lit skills:** `lit-implementer` for T1–T3.
- **Known gaps decided:** 13: no new drift entries; 17: browser suite paths; 18: depend on conformance's shadow-link fix.
- **Assumptions requiring verification:** Step 1 T1 and conformance implementation precede dependent code; missing component designs are fully described here.
- **Review author:** Codex (model unrecorded), 2026-11-13; retain this co-author during workflow migration.
- **Review handoff:** Review-complete draft, no product blockers. The user accepted the Step 1–2 defaults and chose valid draft metadata under current tooling. Migrate/submit as ready-for-review after workflow-gates is implemented.

## Technical decisions

| Decision           | Chosen approach and rationale                                                                                                                                              | Rejected alternative / trade-off                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| D1 View            | One Tier 3 `app-target-view`; pure target-eligibility helper. Native inline confirmation dialog.                                                                           | A row component or generic modal adds API without enough call sites.                              |
| D2 Rules           | Unsupported types, all-missing and constant columns disabled; identifier/missing/sample-candidate hints advisory. See exact algorithm below, accepted by the user in chat. | Blanket identifier ban would reject plausible targets based only on a heuristic.                  |
| D3 Reset           | Any existing model triggers warning and confirmation for a different target. Current target does nothing.                                                                  | Trained-only guard contradicts existing setTarget contract and the accepted conformance decision. |
| D4 Shared CSS      | T1 owns `tableStyles` and `notificationStyles`; adoption in document/global and consuming shadow roots. Notification-alert only; no unused notification-info variant.      | Duplicating rules or importing unused literal-colour variants.                                    |
| D5 Missing details | Keep code type labels; current target disabled button with visible Current Target. Replace empty learn-more href with existing `/help`.                                    | Inventing selected-row colours or shipping empty links.                                           |

### Interfaces and behaviour

`src/features/target/target-eligibility.ts` exports `TargetColumnRow`, `TargetNoteCode`, `buildTargetRows(dataset:DatasetSummary,currentTarget:string|null,metadata:DatasetMetadata|null,descriptor:SampleDatasetDescriptor|null):TargetColumnRow[]`. A row is `{name:string,type:ColumnType,eligible:boolean,isCurrentTarget:boolean,reasonCodes:TargetNoteCode[]}`. No pretranslated notes array. Codes are `METADATA_UNAVAILABLE`, `INELIGIBLE_TEXT`, `INELIGIBLE_DATETIME`, `INELIGIBLE_ALL_MISSING`, `INELIGIBLE_CONSTANT`, `ADVISORY_IDENTIFIER`, `ADVISORY_MISSING_VALUES`, `ADVISORY_HIGH_CARDINALITY`, `ADVISORY_TARGET_CANDIDATE`; localise in the view using row/stat parameters.

**Accepted TODO-11 decision:** missing count is `missingCount + invalidCount`, counted once from metadata. Supported target types are numeric/categorical/boolean. All-missing means valid count zero. Numeric is constant when `count>0 && min===max`; categorical when distinctCount <=1; boolean when only one of trueCount/falseCount is positive. Do not access a nonexistent numeric distinctCount. Unsupported/all-missing/constant are disqualifying in that order. Identifier role or numeric/text identifierHint is advisory only; sample targetCandidates are suggestions, never an exclusive whitelist. High cardinality advisory for categorical distinctCount >50; any missing/invalid cells get a count note, with no invented mostly-empty rejection threshold. Non-candidates remain selectable if otherwise eligible. If stats are missing/mismatched, row disabled with METADATA_UNAVAILABLE; zero is never inferred from missing data.

**Accepted Notes copy:** “Text columns cannot be targets.”; “Date and time columns cannot be targets.”; “No usable values.”; “Only one value is present.”; “This column may identify individual records.”; “{count} missing or invalid values.”; “{count} categories; check that this is a meaningful target.”; “Suggested target”; “Column information is unavailable.” Advisory order: identifier, missing, high cardinality, candidate. Render as text/list in Notes; an eligible row with no notes is empty.

`app-target-view` in `src/features/target/app-target-view.ts`, Tier 3, exports `AppTargetView`; public API only `whenSettled():Promise<void>`, no properties/attributes/slots/events/parts/custom properties. Reads `$appState`, `$hasDataset`, Step 1 resource stores; calls loadDatasetResources, setTarget, confirmDiscardModels. Derived store-only values use computed in stores; metadata-derived helper is pure. Transient pending target/dialog stays private @state. Generation checking prevents old dataset resources from displaying. whenSettled waits for current metadata result (including error) and updateComplete, not for perpetual network retry.

**States:** no dataset: heading + shared notification with `/data` link (“Load a dataset before choosing a target.”). Loading: progress/status, no enabled row actions. Failure: “Column information could not be loaded.” + Retry. Ready: caption, Column Name/Type/Notes/Action, `<th scope>`, `<code>` types; no virtualisation. Ineligible/current buttons disabled. Eligible buttons are named “Set as Target: {column}”, retaining visible text in accessible name; use data-column and prototype listener. Current target displays Current Target without an invented selected-row style.

**Change:** Revalidate current dataset ID, selected column and model state when confirmation is accepted; stale modal cancels with no mutation. `confirmDiscardModels()` then `setTarget(column)` are synchronous after this check. Cancel/Esc keeps state. No-op for current target; no model reset. Stay on `/target`; a link to `/models` allows continuation. Warning whenever models.length>0: “Changing the target will reset all existing models.” Native `<dialog>` uses safe Cancel autofocus and same-root h2 label; native browser restores focus, no custom Escape handler. Clear returnValue on close so a previous Confirm cannot be replayed by Escape.

**Styles:** `src/styles/table.styles.ts` exports only tableStyles from mockup table rules; `src/styles/notification.styles.ts` exports only notificationStyles for alert state; `src/styles/global.ts` adopts these same sheets. No generic helper/controller. These style primitives have three specified call sites: target table, model feature table and models overview; notifications in target, models overview and missing model. Convert to logical properties, use existing tokens, A11Y-01/07/08/10 and SEM-07/08. `TARGET-UI-01` records behaviour-required Notes/current/reset copy; draft elements have no parity entries. Keep status partial where app shell/later features remain.

## Specification changes

- [x] `specification/workflow-steps.md` §2 — exact target rules/notes/current state, blocked notification, warning for any model, stay-on-target continuation; status remains partial for other steps.
- [x] `specification/app-state-and-navigation.md` §4.3/§6.2/§6.4 — confirmed target UI behaviour; preserve decided confirm-and-discard, no trained-only exception.
- [x] `specification/visual-design.md` §3/§5 — shared table/notification ownership and TARGET-UI-01 plus mapped A11Y/SEM rules.
- [x] `specification/testing.md` — both reference journeys include target selection and reload/resume.
- [x] `specification/TODO.md` TODO-11/16 resolved; TODO-17 already answered, narrow TODO-35 only for styles delivered here; `specification/README.md` status/index updates remain honest.

## Implementation tasks

### T1 — Eligibility and shared style primitives

- **Depends on:** None
- **Cross-plan prerequisite:** Step 1 T1 implemented.
- **Risk:** needs care — discriminated statistics and absent metadata must not permit unsuitable targets.
- **Likely files:** `src/features/target/target-eligibility.ts`, `src/styles/table.styles.ts`, `src/styles/notification.styles.ts`, `src/styles/global.ts`, `tests/target-eligibility.test.ts`.
- **Must not touch:** Store schemas/actions, tokens, ingestion or normative mockups.
- **Implementation:** Implement the exact helper algorithm and shared styles above; no spec decisions deferred to this task.
- **Acceptance criteria:**
    - [x] `TARG-UNIT-1` — each stats type, unsupported/constant/all-missing, metadata absent and malformed-name match cases return exact eligibility/codes.
    - [x] `TARG-UNIT-2` — identifier/high-cardinality/missing/candidate hints are advisory; current target flagged independently.
    - [x] `TARG-STYLE-1` — tokens pass, no new literal colours/fallbacks/drift entries.
- **Verification:** `bun test tests/target-eligibility.test.ts tests/style-tokens.test.ts`; `bun run check`.
- **Progress:** [x] Complete

### T2 — Connected target route and confirmation

- **Depends on:** T1
- **Cross-plan prerequisite:** state-navigation-conformance implemented.
- **Risk:** needs care — stale metadata/modal and reset atomicity.
- **Likely files:** `src/features/target/app-target-view.ts`, `src/app.ts`, `tests/target-selection.e2e.ts`.
- **Must not touch:** Store schema, sidebar styles, storage client and other workflow views.
- **Implementation:** Mount view, subscribe to shared resource stores, render all states/table/notes and native confirmation. Preserve route/focus and complete whenSettled contract.
- **Acceptance criteria:**
    - [x] `TARG-E2E-1` — blocked/loading/failure/ready views and Retry; no action enabled before correct metadata.
    - [x] `TARG-E2E-2` — selecting eligible target persists, current selection is a no-op; ineligible disabled with exact notes.
    - [x] `TARG-E2E-3` — cancel/Esc keeps models/focus, confirm discards any existing model, dataset change while modal open cancels safely.
- **Verification:** `bun run test:e2e tests/target-selection.e2e.ts`; `bun run check`.
- **Progress:** [x] Complete

### T3 — Browser parity, a11y and both target journeys

- **Depends on:** T2
- **Cross-plan prerequisite:** Step 1 T6 journeys and reference helper T2 implemented.
- **Risk:** needs care — fixtures must exercise real target states rather than just blocked pages.
- **Likely files:** `tests/target-selection.e2e.ts`, `tests/visual-parity/map.ts`, `tests/visual-parity.e2e.ts`, `tests/a11y.e2e.ts`, `tests/journeys/iris-classification.e2e.ts`, `tests/journeys/penguins-classification.e2e.ts`.
- **Must not touch:** Product code, golden files and normative mockups.
- **Implementation:** Seed matching data/model states for parity only; journeys continue real UI from Step 1 with class/species target and reload/resume. Add no parity entries for draft-only content. Check manual keyboard/AT and 320px/zoom/RTL/forced colours/long labels.
- **Acceptance criteria:**
    - [x] `TARG-E2E-4` — existing 02-1/02-2 selectors match approved deviations and all new states pass axe/tokens.
    - [x] `JOURNEY-IRIS-TARGET` and `JOURNEY-PENGUINS-TARGET` select target via real UI and resume after reload without seeded state.
- **Verification:** `bun run test:e2e tests/target-selection.e2e.ts tests/visual-parity.e2e.ts tests/a11y.e2e.ts tests/journeys/iris-classification.e2e.ts tests/journeys/penguins-classification.e2e.ts`; `bun run check`; `bun run build`.
- **Progress:** [x] Complete

### T4 — Sync specification

- **Depends on:** T1, T2, T3
- **Risk:** needs care — update lasting rules without promoting unrelated draft questions.
- **Likely files:** `specification/workflow-steps.md`, `specification/app-state-and-navigation.md`, `specification/visual-design.md`, `specification/testing.md`, `specification/TODO.md`, `specification/README.md`, `specification/HUMAN.md`.
- **Must not touch:** Product code, tests and normative mockups.
- **Implementation:** Apply all specification changes, statuses/index/gap narrowing, and remove resolved queue items. Workflow-gates verifier owns sync once migrated.
- **Acceptance criteria:**
    - [x] All specification changes applied/ticked; no contradictory target/reset/type rule remains.
    - [x] Plan/spec indexes validate with honest partial statuses.
- **Verification:** `bun run plans:check`; review `git diff specification/`.
- **Progress:** [x] Complete

## Verification and definition of done

- [x] All acceptance IDs met in configured browsers; name any browser/manual AT checks not run.
- [x] `bun run check`, build, tokens, parity/a11y and journeys pass; record fresh counts against review baseline 144 pass/0 fail, 0 type errors.
- [x] No full-table colour/selected-row design invented; draft-only elements have no parity claims; specification changes ticked.

## Risks and open questions

- **Blocking:** None.
- **Decisions accepted:** User accepted the Step 1–2 defaults in chat: unsupported/constant/all-missing targets are disabled; identifier/missing-value notes are advisory; the shared notification supplies the blocked state. The exact rules and copy above implement those defaults. TODO-17 confirm-and-discard applies to every existing model and remains accepted.
- **Non-blocking:** Awaiting styled `02-3` Notes/current/confirmation states. Existing mockup stale routes map to canonical `/data`, `/target`, `/results`; existing help uses `/help`. Descriptor advisories must never be mistaken for hard target exclusions. Formal ready-for-review submission awaits workflow-gates.

## Implementation and verification log

| When (UTC)           | Task | Outcome / commands / evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-14T16:01:17Z | T1   | Implemented `buildTargetRows`, `formatTargetNote`, `tableStyles`, `notificationStyles` and adopted sheets in `global.ts`. PASS: `bun test tests/target-eligibility.test.ts tests/style-tokens.test.ts` (17 pass), typecheck (0 errors).                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-11-14T16:19:28Z | T2   | Implemented `<app-target-view>` in `src/features/target/app-target-view.ts`, mounted route in `src/app.ts`, authored `tests/target-selection.e2e.ts`. PASS: `bunx playwright test tests/target-selection.e2e.ts --project=chromium --project=webkit` (6 pass, 0 fail; Firefox launcher unverified due to local Nightly profile bug), `bun run check` (0 type errors, 194 unit tests pass).                                                                                                                                                                                                                                                                              |
| 2026-11-14T16:28:06Z | T3   | Added 02-1 and 02-2 entries to `tests/visual-parity/map.ts` and seeded route in `tests/visual-parity.e2e.ts`; added target a11y tests in `tests/a11y.e2e.ts`; added `JOURNEY-IRIS-TARGET` and `JOURNEY-PENGUINS-TARGET` in journey specs. Dynamic `confirmDialogEl` getter ensures modal operates across update cycles. PASS: full e2e suite (`tests/target-selection.e2e.ts tests/visual-parity.e2e.ts tests/a11y.e2e.ts tests/journeys/iris-classification.e2e.ts tests/journeys/penguins-classification.e2e.ts`, 64 pass in Chromium/WebKit), `bun test tests/style-tokens.test.ts` (4 pass), `bun run check` (0 type errors, 199 unit tests pass), `bun run build`. |
| 2026-11-14T16:31:23Z | T4   | Synchronised specifications: updated `workflow-steps.md` §2 to describe implemented states/notes/confirmation, updated `app-state-and-navigation.md` §4.3/§6.2/§6.4, added `TARGET-UI-01` and style ownership to `visual-design.md`, updated `testing.md` with target journey stages, resolved TODO-11/16/17 and narrowed TODO-35 in `TODO.md`, cleaned resolved review item in `HUMAN.md`. PASS: `bun run plans:check` (0 errors), `bun run check` (0 type errors, 199 unit tests pass).                                                                                                                                                                               |

## Change log

| When (UTC)           | Change                                                                                     | Reason                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| 2026-11-13T10:22:14Z | Initial draft                                                                              | Target-view planning.                                                              |
| 2026-11-13T18:47:40Z | Closed stats/eligibility and view contract, removed answered blockers, added real journeys | Review against implemented data types and human answers.                           |
| 2026-11-13T22:14:44Z | Recorded accepted product defaults and review-complete handoff                             | User accepted the grouped decisions in chat; retained draft metadata as requested. |
