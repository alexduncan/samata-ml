# Phase 2: Configure training setup (one-shot and nested cross-validation)

**Status:** draft | **Updated:** 2026-11-19T15:44:17Z
**Authors:** Google Antigravity (Gemini 4 Argon High), Claude Code (claude-opus-5-5) | **Created:** 2026-11-17T21:23:45Z
**Verified by:** — | **Verified:** — | **Verification:** changes-requested
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour:** `src/features/models/app-model-builder-view.ts` (L1086–1095) renders Section 4 (`4. Training Setup`) as `<p class="pending-notice">Not available yet.</p>`. `src/types/state.ts` (L80–83) defines `ValidationMethodology = { type: 'nested_cv'; outerFolds: number; innerFolds: number } | { type: 'k_fold_cv'; folds: number } | { type: 'train_test_split'; testRatio: number }` and `src/stores/persister.ts` (L92, L264–271) validates those three provisional variants.

**Target behaviour:** Section 4 (`4. Training Setup`) lets the user choose between **One-Shot Training** and **Nested Cross-Validation** (with an option to choose the number of folds), saves the choice to `model.trainingSetup` in application state (`localStorage`) in a structure directly consumable by Phase 3 model training, and moves choosing custom fold/split sizes to the feature backlog (`specification/FUTURE.md`).

**Why:** Give users an explicit, persisted validation setup before training in Phase 3 while deferring custom split-ratio / fold-size controls to the feature backlog.

## Scope

**In scope**

- Defining the persisted `ValidationMethodology` union in `src/types/state.ts` and `src/stores/persister.ts` for One-Shot Training (`type: 'one_shot'`, with fixed default holdout ratio `testRatio: 0.2` and `randomState: 42`) and Nested Cross-Validation (`type: 'nested_cv'`, with user-selectable fold count).
- Moving user-configurable fold/split size controls to `specification/FUTURE.md`.
- Presentational `<app-training-setup>` Lit component (`src/features/models/app-training-setup.ts`), integration into Section 4 of `<app-model-builder-view>` and the `/models` overview table (`src/features/models/app-models-view.ts`), co-located Storybook stories, and three-browser Playwright E2E tests.

**Out of scope**

- User-editable test split ratio or custom fold byte/row sizes (moved to `specification/FUTURE.md`).
- Non-nested k-fold cross-validation UI (`k_fold_cv`).
- Executing model training or workers when clicking "Train Model" (implemented in Phase 3: `specification/plans/web-ml-phase-3-model-training.md`; until Phase 3 is wired, Section 4 saves state and completes or shows a clear pending-execution notice).
- Hyperparameter tuning search-space configuration (moved to Phase 7: `specification/plans/web-ml-phase-7-hyperparameter-tuning.md`).

**Constraints and invariants**

- Strict TypeScript, Bun only, TSDoc on all exported symbols (`specification/standards-and-documentation.md`).
- Native semantic controls (`<fieldset>`, `<legend>`, `<input type="radio">`, `<input type="number">`), Baseline Widely available features, WCAG 2.2 AA, British English, and `@nanostores/i18n` localisation (`specification/COMPONENTS.md` §1, §7, §8).
- Changing `ValidationMethodology` in `src/types/state.ts` must update all typechecked test fixtures (`tests/state-and-storage.test.ts`, `tests/dataset-resources.test.ts`, `tests/visual-parity/fixtures.ts`, `tests/visual-parity.e2e.ts`, `tests/a11y.e2e.ts`, `tests/models-overview.e2e.ts`, `tests/target-selection.e2e.ts`, `tests/column-eligibility.test.ts`) in the same task so `bun run check` never breaks.

## Required reading

- `specification/COMPONENTS.md` §3–§10; `specification/visual-design.md` §1.1, §3–§6 — Lit component, token, draft styling, and Storybook rules for T2.
- `specification/workflow-steps.md` §3, §3.4; `specification/state-and-storage.md` §3–§5 — Training Setup workflow and persistence rules.
- `../web-ml/specification/public-api/current-limitations.md` L269–314 (tuning and nested cross-validation requirements).
- `node_modules/web-ml/dist/src/training/cross-validation.d.ts` L43–84 (`NestedCrossValidationRequest`: `outerFolds`, `innerFolds`, `searchSpace`, `strategy`, `scoring`, `randomState`).
- `node_modules/web-ml/dist/src/training/types.d.ts` L50–155 (`TrainingRequest` for one-shot training).
- `specification/mockups/ui-scaffold/03-3_train-models-2-select-features.html`, `src/styles/train-model.styles.ts` — outer accordion shell.
- `specification/mockups/ui-scaffold/drafts/03-5_train-models-4-configure-training.html` — draft structure reference (updated in T2 to match one-shot vs nested CV fold count and remove the false cross-origin isolation claim at L337–342 and `../mockups.css` at L7).

## Codebase context

- **Relevant specifications:** `specification/workflow-steps.md` §3.4 (marked TODO), `specification/state-and-storage.md` §3 (provisional `ValidationMethodology`), `specification/FUTURE.md`.
- **Relevant implementation:** `src/types/state.ts` (L80–83: `ValidationMethodology`), `src/stores/app.store.ts` (`setTrainingSetup` L547–566, `completeSection` L571–611, `startTraining` L613–642), `src/stores/persister.ts` (`VALID_TRAINING_SETUP_TYPES` L92, `validateAppState` L264–271), `src/features/models/app-model-builder-view.ts` (L1086–1095), `src/features/models/app-models-view.ts` (L285–290).
- **Verified `web-ml@0.1.0` contracts and contradictions affecting Phase 2:**
    1. **`nestedCrossValidate` requires BOTH `outerFolds` and `innerFolds` (`dist/src/training/cross-validation.d.ts` L47–50):** `NestedCrossValidationRequest<A>` requires `outerFolds: number` ($\ge 2$) and `innerFolds: number` ($\ge 2$). The user request specifies _"nested cross-validation with the option to choose the number of folds"_. If the UI exposes a single "Number of folds" input `folds` (e.g. default `5`, range `2..10`), the persisted state can store `{ type: 'nested_cv'; outerFolds: number; innerFolds: number; randomState: number }` (setting both `outerFolds = folds` and `innerFolds = folds`, or exposing separate outer/inner fold inputs if desired).
    2. **`nestedCrossValidate` requires a hyperparameter tuning `searchSpace` (`dist/src/training/cross-validation.d.ts` L52–59), which is deferred to Phase 7:** `web-ml` has no standalone non-tuning `crossValidate` export. In Phase 2/3 (before Phase 7 adds hyperparameter tuning), selecting Nested Cross-Validation with manual hyperparameters from Phase 1 either requires (a) `web-ml` to add a non-tuning `crossValidate` / optional `searchSpace` path, (b) Phase 3 to synthesise a 1-trial single-point `searchSpace` from the manual `options`, or (c) Nested Cross-Validation to be disabled until tuning is enabled in Phase 7.
    3. **One-shot training requires a fixed default holdout split ratio (`testRatio: 0.2`) in `samata-ml`:** `web-ml`'s `createTrainingClient().train()` fits on 100% of the rows supplied by `data: DatasetProvider` and performs no train/test split (`dist/src/training/types.d.ts` L50–155). Moving fold/split size selection to the feature backlog means `samata-ml` must store a fixed default `testRatio: 0.2` (80% train / 20% test) and `randomState: 42` in the one-shot `ValidationMethodology` variant so Phase 3 can evaluate the trained model on unseen test rows without data leakage (`VISION.md` §10).
    4. **Minimum rows per class constraint:** Stratified splitting in Phase 3 requires at least `outerFolds` (or $\ge 2$ for one-shot) eligible rows in the rarest target class; Phase 2 validates `folds >= 2` and `folds <= 10` (and $\le$ minimum observed class count when dataset metadata is loaded).
- **Tests and commands:** Baseline `bun run check` passes 220 tests across 31 files. Existing tests using `{ type: 'k_fold_cv', folds: 5 }` (`tests/state-and-storage.test.ts` L103, L114, L333, L362, L849, L895; `tests/dataset-resources.test.ts` L33) must be updated when `k_fold_cv` is replaced.
- **Web guidance:** `forms`, `accessibility` — native `<fieldset>`/`<legend>` radio group for methodology choice, conditional `<input type="number" min="2" max="10" step="1">` for fold count, clear explanation of fixed 80/20 split vs nested CV folds.
- **Visual reference:** `specification/mockups/ui-scaffold/03-3_train-models-2-select-features.html` — `src/styles/train-model.styles.ts`; inner content follows updated `specification/mockups/ui-scaffold/drafts/03-5_train-models-4-configure-training.html` (draft-only under `visual-design.md` §1.1).
- **Domain skills:** `lit-component-implementer` for T2 and T3.
- **Assumptions requiring verification:** None — the user confirmed mapping the single "Number of folds" UI input to both `outerFolds` and `innerFolds` (`2..10`, default `5`) and using a fixed 80% train / 20% test stratified holdout split (`testRatio: 0.2, randomState: 42`) for One-Shot Training while custom fold/split sizes move to `specification/FUTURE.md`.

## Technical decisions

| Decision                         | Chosen approach and rationale                                                                                                                                                                                                                                                                 | Rejected alternative / trade-off                                                                                                                                             |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 `ValidationMethodology` shape | `export type ValidationMethodology = { type: 'one_shot'; testRatio: 0.2; randomState: 42 } \| { type: 'nested_cv'; outerFolds: number; innerFolds: number; randomState: 42 };` with defaults `{ type: 'one_shot', testRatio: 0.2, randomState: 42 }` and default folds `5` (integer `2..10`). | Keeping `k_fold_cv` or arbitrary `testRatio` inputs contradicts the user's scope (one-shot vs nested CV, with fold sizes moved to backlog).                                  |
| D2 Single vs dual fold count     | Present a single integer input "Number of folds" (`2..10`, default `5`) when Nested Cross-Validation is selected and write it to both `outerFolds` and `innerFolds` in `ValidationMethodology` so it directly satisfies `NestedCrossValidationRequest<A>`.                                    | Exposing separate outer and inner fold controls adds cognitive load not requested by the prompt (unless the user prefers two inputs; flagged in _Risks and open questions_). |
| D3 Action button semantics       | In Phase 2 (before Phase 3 wires worker execution), Section 4 saves `trainingSetup` via `setTrainingSetup(num, setup)` and provides the primary action button (`Train Model`, or completes Section 4 ready for Phase 3).                                                                      | Leaving `trainingSetup` unpersisted until training starts loses the user's Step 4 choice on reload (`state-and-storage.md` §5).                                              |
| D4 Presentational labels         | `<app-training-setup>` is a Tier 2 presentational element with a typed `labels: SetupLabels = DEFAULT_SETUP_LABELS` property (empty-string defaults); `<app-model-builder-view>` passes localised strings.                                                                                    | Importing stores or `i18n` in `<app-training-setup>` violates `COMPONENTS.md` §2 and §8.                                                                                     |

### Interfaces and behaviour

#### A. State and persistence (`src/types/state.ts`, `src/stores/persister.ts`)

```ts
export type ValidationMethodology =
	| {
			type: 'one_shot';
			/** Fixed 80/20 holdout split until custom split sizes are implemented from FUTURE.md. */
			testRatio: number;
			randomState: number;
	  }
	| {
			type: 'nested_cv';
			outerFolds: number;
			innerFolds: number;
			randomState: number;
	  };
```

- `src/stores/persister.ts` validates `type === 'one_shot'` (`testRatio === 0.2`, finite integer `randomState`) or `type === 'nested_cv'` (integers `outerFolds >= 2 && outerFolds <= 10`, `innerFolds >= 2 && innerFolds <= 10`, finite integer `randomState`).
- v1→v2 migration maps legacy `train_test_split` / `k_fold_cv` to `{ type: 'one_shot', testRatio: 0.2, randomState: 42 }` and legacy `nested_cv` to `{ type: 'nested_cv', outerFolds: clamp(outerFolds, 2, 10), innerFolds: clamp(innerFolds, 2, 10), randomState: 42 }`.

#### B. Lit component API (`<app-training-setup>`)

- **Tier:** 2 (Presentational), `src/features/models/app-training-setup.ts`, tag `app-training-setup`.
- **Properties (`attribute: false`):** `value: ValidationMethodology | null = null`, `maxFolds = 10`, `blockedReason = ''`, `disabled = false`, `labels: SetupLabels = DEFAULT_SETUP_LABELS`.
- **Events (`bubbles: true, composed: true`):**
    - `app-training-setup-change`: `detail: { setup: ValidationMethodology }`
    - `app-training-start`: `detail: { setup: ValidationMethodology }`
- **Overview summary (`src/features/models/app-models-view.ts`):** Formats `one_shot` as `"One-shot (80% / 20%)"` and `nested_cv` as `"Nested CV ({folds} folds)"` instead of raw `model.trainingSetup.type`.
- **Stories (`src/features/models/app-training-setup.stories.ts`, `src/features/models/app-model-builder-view.stories.ts`):** `OneShot`, `NestedCv`, `InvalidFolds`, `Blocked`, `LongLabel`, `RTL`; builder `ConfigureTraining`.

## Specification changes

- [ ] `specification/workflow-steps.md` §3.4 — Specify One-Shot Training (fixed 80/20 holdout) vs Nested Cross-Validation (configurable number of folds `2..10`, default `5`); status remains partial.
- [ ] `specification/state-and-storage.md` §3 — Update `ValidationMethodology` to `one_shot | nested_cv`; status remains draft.
- [ ] `specification/FUTURE.md` — Add user-configurable fold/split sizes on Step 4 (Training Setup) to the product backlog.
- [ ] `specification/components/training-setup.md` (new) & `specification/README.md` — closed API, events, stories, and accessibility rules for `app-training-setup`; status implemented.
- [ ] `specification/TODO.md`, `specification/HUMAN.md` — resolve TODO-01 (initial setup scope) and update draft styling queue for `03-5`.

## Implementation tasks

### T1 — Update `ValidationMethodology` state, persister validation, and test fixtures

- **Depends on:** None
- **Risk:** needs care — removing `k_fold_cv` and `train_test_split` affects existing unit tests in `tests/state-and-storage.test.ts` and `tests/dataset-resources.test.ts`.
- **Likely files:** `src/types/state.ts`, `src/stores/app.store.ts`, `src/stores/persister.ts`, `tests/state-and-storage.test.ts`, `tests/dataset-resources.test.ts`
- **Must not touch:** `src/router/`, `src/common/storage/db.ts`, `src/features/`
- **Implementation:** Update `ValidationMethodology` in `src/types/state.ts`, update `VALID_TRAINING_SETUP_TYPES` and runtime shape validation/migration in `src/stores/persister.ts`, ensure `setTrainingSetup` initialises or updates `model.trainingSetup` cleanly, and update `tests/state-and-storage.test.ts` and `tests/dataset-resources.test.ts`.
- **Acceptance criteria:**
    - [ ] `WML-P2-STATE-1` — `one_shot` and `nested_cv` setups round-trip through `localStorage`; invalid fold counts (`< 2`, `> 10`, non-integer, `NaN`) are rejected; legacy v1 setups migrate cleanly.
    - [ ] `WML-P2-STATE-2` — Changing between `one_shot` and `nested_cv` or changing fold counts invalidates downstream steps (`training`, `results`); no-op updates preserve completion state.
- **Verification:** `bun test tests/state-and-storage.test.ts tests/dataset-resources.test.ts`; `bun run check`.
- **Progress:** [ ] Not started

### T2 — Implement `<app-training-setup>` and wire Section 4 and `/models` overview

- **Depends on:** T1
- **Risk:** needs care — must keep existing `tests/models-setup.e2e.ts` and `tests/models-overview.e2e.ts` passing while adding Section 4 controls.
- **Likely files:** `src/features/models/app-training-setup.ts`, `src/features/models/app-training-setup.stories.ts`, `src/features/models/app-model-builder-view.ts`, `src/features/models/app-model-builder-view.stories.ts`, `src/features/models/app-models-view.ts`, `specification/mockups/ui-scaffold/drafts/03-5_train-models-4-configure-training.html`, `tests/training-setup.e2e.ts`, `tests/models-setup.e2e.ts`, `tests/models-overview.e2e.ts`
- **Must not touch:** `css/root.css`, `src/features/models/app-model-card.ts`, `src/features/target/`
- **Implementation:** Update draft `03-5_train-models-4-configure-training.html` to reflect One-Shot Training vs Nested Cross-Validation (with fold count input) and remove `../mockups.css` and the false mandatory cross-origin isolation block. Implement `<app-training-setup>`, wire it into Section 4 of `<app-model-builder-view>`, update `app-models-view.ts` Training Setup column formatting, and add co-located Storybook stories and Playwright tests.
- **Acceptance criteria:**
    - [ ] `WML-P2-UI-1` — Users can select One-Shot Training or Nested Cross-Validation, enter fold count (`2..10`), and see the persisted setup survive page reload on both `/models/:num` and `/models`.
    - [ ] `WML-P2-UI-2` — Invalid fold counts (`< 2` or `> maxFolds`) block submission, associate error text via `aria-describedby`, and focus the fold input; RTL, long-label, keyboard, 320 px, 200% zoom, and forced-colours checks pass.
    - [ ] `WML-P2-UI-3` — Co-located `app-training-setup.stories.ts` and updated `app-model-builder-view.stories.ts` pass `bun run test:stories` (axe) in Chromium, Firefox, and WebKit.
- **Verification:** `bun run test:e2e tests/training-setup.e2e.ts tests/models-setup.e2e.ts tests/models-overview.e2e.ts tests/visual-parity.e2e.ts tests/a11y.e2e.ts`; `bun test tests/style-tokens.test.ts`; `bun run test:stories`; `bun run check`.
- **Progress:** [ ] Not started

### T3 — Sync specifications and backlog (`FUTURE.md`) for Phase 2

- **Depends on:** T1, T2
- **Risk:** routine
- **Likely files:** `specification/workflow-steps.md`, `specification/state-and-storage.md`, `specification/FUTURE.md`, `specification/components/training-setup.md`, `specification/COMPONENTS.md`, `specification/README.md`, `specification/TODO.md`, `specification/HUMAN.md`, `specification/plans/README.md`, `specification/plans/web-ml-phase-2-training-setup.md`
- **Must not touch:** `src/`, `tests/`, `specification/mockups/`
- **Implementation:** Apply every item under _Specification changes_, adding custom fold/split size configuration to `specification/FUTURE.md`.
- **Acceptance criteria:**
    - [ ] Every item under _Specification changes_ is applied and ticked.
    - [ ] `bun run plans:check` and `bun run plans:task specification/plans/web-ml-phase-2-training-setup.md --check-complete` pass.
- **Verification:** `bun run plans:check specification/plans/web-ml-phase-2-training-setup.md`; `bun run plans:task specification/plans/web-ml-phase-2-training-setup.md --check-complete`; `bun run check`.
- **Progress:** [ ] Not started

## Verification and definition of done

- [ ] All task acceptance criteria met with test names starting with `WML-P2-*`.
- [ ] `bun run check`, `bun run build`, `bun run test:stories`, and Playwright E2E tests pass in Chromium, Firefox, and WebKit.
- [ ] `bun run format <changed files>` run on all edited files.
- [ ] Every _Specification changes_ item is ticked and synced.

## Risks and open questions

- **Blocking:** Confirm whether Phase 2 is ready to submit for `/verify-plan` once the upstream `web-ml` `crossValidate` contract (for executing fixed-hyperparameter cross-validation in Phase 3 when `trainingSetup.type === 'nested_cv'` and `hyperparameters.mode === 'manual'`) is approved.
- **Non-blocking:** Confirmed resolutions adopted in this plan: (1) the single "Number of folds" input (`2..10`, default `5`) writes to both `outerFolds` and `innerFolds` in `ValidationMethodology` (used as `folds: outerFolds` by `crossValidate` in manual mode and as `outerFolds`/`innerFolds` by `nestedCrossValidate` in Phase 7 tuning mode); (2) One-Shot Training uses a fixed 80% train / 20% test stratified holdout split (`testRatio: 0.2, randomState: 42`), with user-configurable fold/split sizes added to `specification/FUTURE.md`.
- **Non-blocking:** Draft `03-5_train-models-4-configure-training.html` awaits human visual styling and promotion (`specification/HUMAN.md`).

## Escalations

None.

## Review fixes

None.

## Implementation and verification log

| When (UTC)           | Task | Agent (model)                            | Outcome / commands / evidence                                                                                                                                  |
| -------------------- | ---- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-17T21:23:45Z | —    | Google Antigravity (Gemini 4 Argon High) | Split Phase 2 from `web-ml-classification-integration.md`; scout-verified `ValidationMethodology`, `NestedCrossValidationRequest`, and existing test fixtures. |
| 2026-11-18T08:34:14Z | —    | Google Antigravity (Gemini 4 Argon High) | Adopted single fold-count mapping (`outerFolds = innerFolds = folds`) and fixed 80/20 `one_shot` holdout split (`testRatio: 0.2, randomState: 42`).            |

## Plan review history

| Reviewed (UTC)       | Agent (model)                           | Decision          | Findings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------- | --------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-19T15:44:17Z | Google Antigravity (Gemini 4 Neon High) | changes-requested | BLOCKER: unresolved blocking question & stale claim that web-ml lacks crossValidate (shipped in web-ml@0.1.0); BLOCKER: D1 vs §A ValidationMethodology type contradiction and unspecified STORAGE_VERSION/v1->v2 migration runner (persister/scroll); BLOCKER: unresolved Section 4 submit/completion fork and undeclared Phase 1 prerequisite; MAJOR: unspecified SetupLabels/i18n/maxFolds/blockedReason/invalid-input handling, missing app-model-builder-view.stories.ts, unaddressed models-setup.e2e.ts conflict, incomplete T1 fixtures & ACs. |

## Change log

| When (UTC)           | Change                                     | Reason                                                                                                                                                                                               |
| -------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-17T21:23:45Z | Initial draft                              | Created Phase 2 plan (Step 4 Training Setup: one-shot vs nested cross-validation fold count, moving fold sizes to `FUTURE.md`) from the multi-phase split of `web-ml-classification-integration.md`. |
| 2026-11-18T08:34:14Z | Adopt fold-count and one-shot split policy | User confirmed mapping the single fold-count option to `outerFolds`/`innerFolds` and adopting the fixed 80/20 holdout split for One-Shot Training.                                                   |
| 2026-11-19T08:47:35Z | Renumbered cross-references                | Tuning renumbered to Phase 7; Phase 7 reuses the outer folds of manual cross-validation so tuned and manual models stay comparable. No change to this phase's contract.                              |
