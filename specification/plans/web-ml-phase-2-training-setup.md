# Phase 2: Configure training setup (one-shot and cross-validation)

**Status:** draft | **Updated:** 2026-11-19T17:13:05Z
**Authors:** Google Antigravity (Gemini 4 Argon High), Claude Code (claude-opus-5-5), Google Antigravity (Gemini 4 Neon High) | **Created:** 2026-11-17T21:23:45Z
**Verified by:** — | **Verified:** — | **Verification:** changes-requested
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour:** `src/features/models/app-model-builder-view.ts` (L1092–1098) renders Section 4 (`4. Training Setup`) via `renderPendingSection` (L1008–1031) as `<p class="pending-notice">Not available yet.</p>`. `src/types/state.ts` (L80–83) defines provisional `ValidationMethodology` variants (`nested_cv`, `k_fold_cv`, `train_test_split`), and `src/stores/persister.ts` (L92, L257–267) checks only `trainingSetup.type` without validating numeric fields. `src/features/models/app-models-view.ts` (L285–287) renders the raw `model.trainingSetup.type` string. Reserved routes (`src/types/routes.ts` L5, `src/router/route-parser.ts` L36–38) hard-code individual help paths rather than supporting dynamic `/help/*` pages compiled from `content/{locale}/pages/*.md`.

**Target behaviour:** Following the `03-5` draft layout (omitting Random Seed and Missing Values), Section 4 (`4. Training Setup`) lets the user choose between **One-Shot** (fixed 80% train / 20% test stratified holdout, `randomState: 42`) and **Cross-Validation** (synchronised range + number fold selector `2..10`, default `5`, capped by the rarest target class count, with a live fold-partition matrix table, summary, and legend, `randomState: 42`), linked to a new `/help/training-setup` page served via a dynamic `/help/*` reserved route. Valid edits persist immediately to `model.trainingSetup` (`STORAGE_VERSION` stays `1`). Clicking **Train Model** validates, persists `trainingSetup`, completes Section 4 (`status` stays `'draft'` until Phase 3 wires worker execution), collapses Section 4 to `4. {summary}` with an `Edit` button, activates Section 5 (`Not available yet.`), and formats the `/models` Training Setup column as `"One-Shot (80% / 20%)"` or `"Cross-Validation ({folds} folds)"`. Custom split ratios, editable random seeds, and missing-value options are recorded in `specification/FUTURE.md`.

**Why:** Give users an explicit, visual, persisted validation setup consumable directly by Phase 3 (`createTrainingClient().train` / `crossValidate`) and Phase 7 (`nestedCrossValidate`), while generalising `/help/*` so future help pages need no router changes.

## Scope

**Prerequisite:** [Phase 1 (`specification/plans/web-ml-phase-1-configure-model.md`)](web-ml-phase-1-configure-model.md) must be implemented before executing this plan. Phase 1 activates Section 3 (making Section 4 reachable), creates `src/styles/hyperparameters.styles.ts`, `src/common/parameter-scale.ts`, and `src/features/models/app-model-builder-view.stories.ts`, exports `SECTION_ORDER` from `src/stores/app.store.ts`, adds `.help-link` to `src/styles/train-model.styles.ts`, introduces `i18n('app-model-builder-view', …)` and the `SECTION_ORDER`-based `handleReopenClick` rule in `app-model-builder-view.ts`, and updates `MOD-SETUP-2`/`MOD-SETUP-3` for Section 3.

**In scope**

- Replacing the provisional `ValidationMethodology` union in `src/types/state.ts` with `one_shot` (`testRatio: 0.2`, `randomState: 42`) and `nested_cv` (`outerFolds`, `innerFolds`, `randomState: 42`), strict runtime validation in `src/stores/persister.ts` (keeping `STORAGE_VERSION = 1`), pure setup bounds/validation/summary utilities (`src/features/models/training-setup.ts`), and updating existing unit test fixtures.
- Generalising reserved routing to support dynamic `/help/{slug}` routes (single-segment lowercase kebab-case slugs resolved from `content/{locale}/pages/{slug}.md`), adding `content/en/pages/training-setup.md` (and `'/help/training-setup': 'training-setup'` in `RESERVED_CONTENT`), and distinguishing `NOT_FOUND` in `app-content-modal.ts`.
- Porting `.field--folds`, `.field-visual`, `.fold-matrix`, `.fold-visual-summary`, `.fold-legend`, and the `@media (max-width: 700px)` `.field--folds` rule from `specification/mockups/ui-scaffold/css/hyperparameters.css` L105–235 & L261–268 into `src/styles/hyperparameters.styles.ts` (with logical properties, scrollable matrix wrapper, and forced-colours non-colour differentiation) and extending `src/styles/hyperparameters.stories.ts`.
- Presentational `<app-training-setup>` (Tier 2, `src/features/models/app-training-setup.ts`), Section 4 integration in `<app-model-builder-view>`, formatted Training Setup column in `<app-models-view>`, cleaning draft `03-5_train-models-4-configure-training.html`, co-located Storybook stories, and three-browser Playwright E2E tests.
- Moving user-configurable split/fold sizes, editable random seed (`randomState`), and missing-value handling options to `specification/FUTURE.md`.

**Out of scope**

- User-editable random seed (`randomState` stays fixed at `42`; user decision, 2026-11-19), custom test split ratios (`testRatio` stays fixed at `0.2`), and Missing Values controls (marked `After Phase 5` in draft `03-5`): all recorded in `specification/FUTURE.md`.
- Non-nested `k_fold_cv` or arbitrary `train_test_split` state variants.
- Executing model training, workers, Web Locks, or calling `startTraining(num)` when clicking `Train Model` (implemented in Phase 3: `specification/plans/web-ml-phase-3-model-training.md`).
- Hyperparameter tuning search-space configuration (Phase 7: `specification/plans/web-ml-phase-7-hyperparameter-tuning.md`).
- Translating unrelated hard-coded strings in `app-models-view.ts` or `app-model-builder-view.ts` (only new/touched Section 4 and Training Setup column strings use `i18n`).

**Constraints and invariants**

- Strict TypeScript, Bun only, TSDoc on all exported symbols (`specification/standards-and-documentation.md`). British English in prose, docs, and UI strings.
- Native semantic controls (`<select>`, `<input type="range">`, `<input type="number">`, `<table>` with `<caption>`/`<th scope>`), Baseline Widely available features only, WCAG 2.2 AA (`specification/COMPONENTS.md` §1, §7). Every `id` referenced by `for`, `aria-labelledby`, or `aria-describedby` lives in the same shadow root as the referencing element.
- Tier 2 `<app-training-setup>` imports no stores and no `src/i18n.ts`; it receives pre-translated strings via a typed `labels` property with English defaults (`COMPONENTS.md` §2, §8).
- Tokens from `css/root.css` only, no literal colours, no `var()` fallbacks, logical inline properties only (`COMPONENTS.md` §6.1, §6.3; `tests/style-tokens.test.ts` `TOK-1`–`TOK-6`).
- `STORAGE_VERSION` stays `1` (matching Phase 1 D9): Section 4 has never been rendered in any shipped build, so every real user's persisted v1 state has `trainingSetup: null` (still valid), and keeping `1` avoids wiping user datasets/models/scroll state or introducing dead migration code.
- `validateAppState` stays unexported (`src/stores/persister.ts` L104–106); persisted-state tests exercise it through `reconcileStartupState`.
- Clicking `Train Model` in Phase 2 keeps `model.status === 'draft'` (never calls `startTraining(num)`), so reloading the page never triggers `TRAINING_INTERRUPTED_BY_RELOAD` and the user can still reopen Section 4 via `Edit`.
- Never read `../web-ml/src/**` or `../web-ml/specification/internals/**`; never modify `../web-ml`, `node_modules/`, `bun.lock`, or mockups outside `specification/mockups/ui-scaffold/drafts/`.

## Required reading

- `specification/COMPONENTS.md` §2–§10 — tiers, closed public API, `accessor` decorators, events, styles, i18n `labels`, testing, and Storybook rules.
- `specification/visual-design.md` §1.1, §2, §3, §4, and §5.1–§5.2 (`A11Y-07`, `A11Y-08`, `SEM-07`, `SEM-10`) — draft-only parity rules, token rules, and translation rules.
- `specification/workflow-steps.md` §3, §3.4; `specification/state-and-storage.md` §3–§5, §8; `specification/app-state-and-navigation.md` §3–§3.1, §5.4, §6.3; `specification/content-and-i18n.md` §2.
- `specification/mockups/ui-scaffold/drafts/03-5_train-models-4-configure-training.html` L232–406 — Section 4 `.field` layout, Strategy `<select>`, `.field--folds` range/number pair, and `.field-visual` fold-matrix structure (cleaned in T3 to remove Random Seed, Missing Values, inline `<script>`, `../mockups.css`, and stale L550–654 blocks).
- `specification/mockups/ui-scaffold/css/hyperparameters.css` L105–235 & L261–268 — `.field--folds`, `.field-visual`, `.fold-matrix`, `.fold-visual-summary`, `.fold-legend`, and responsive narrow rule.
- `../web-ml/specification/public-api/current-limitations.md` L296–317 — stratified fold minimum rows-per-class note and `crossValidate` / `nestedCrossValidate` capabilities.
- `../web-ml/dist/src/training/cross-validate.d.ts` L1–22, L111–113 (`CrossValidationRequest`, `crossValidate`) and `../web-ml/dist/src/training/cross-validation.d.ts` L43–84 (`NestedCrossValidationRequest`, `outerFolds`, `innerFolds`, `randomState`).

## Codebase context

- **Relevant specifications:** `specification/workflow-steps.md` §3.4 (partial, TODO), `specification/state-and-storage.md` §3 & §8 (draft), `specification/app-state-and-navigation.md` §3 (draft), `specification/content-and-i18n.md` §2 (partial), `specification/visual-design.md` §1.1 & §3 (partial), `specification/COMPONENTS.md` (partial), `specification/FUTURE.md`.
- **Relevant implementation:**
    - `src/types/state.ts` — `STORAGE_VERSION = 1` L13; `ModelSectionId` L61–67; `ValidationMethodology` L80–83; `ModelRecord.trainingSetup` L135; `PersistedScroll` L195–199.
    - `src/stores/persister.ts` — `VALID_TRAINING_SETUP_TYPES` L92; unexported `validateAppState` L104–106 (`trainingSetup` shape check L257–267 checks `type` only); `validateScrollState` L312–366 (version check L319–325); `readPersistedState` L374–414; `isSynchronousChange` L529–571 (`trainingSetup?.type` sync trigger at L562; same-type numeric edits debounce `300` ms at L661, L700–703); `flushNow()` L628–644.
    - `src/stores/app.store.ts` — `SECTION_ORDER` L24–31 (exported by Phase 1); `jsonEqual` L36–61; `invalidateLaterSections` L66–74; `setTrainingSetup(num, setup)` L547–566 (returns `false` when model missing or non-draft; no-op when `jsonEqual`, returning `true` without updating `$appState` reference or `completedSteps`; otherwise updates `trainingSetup` and invalidates `'training'` and `'results'` while preserving `'configure-training'`); `completeSection` L571–584; `reopenSection` L589–607; `startTraining` L613–639. Needs no edits in Phase 2.
    - `src/stores/reconciler.ts` — `reconcileStartupState` L87–324 (strips `'configure-training'` on dropped features L187–196 or interrupted training L309–311; never touches `trainingSetup`).
    - `src/types/dataset.ts` — `CategoricalColumnStats` L42–46 (`distinctCount`, `categoryCounts: Record<string, number>`); `BooleanColumnStats` L49–54 (`trueCount`, `falseCount`, `lexicon`); `ColumnStats` L75–80; `DatasetMetadata` L83–95. Reached via `$datasetResources.get().metadata.columns` (`src/stores/dataset.store.ts` L16–22, L65).
    - `src/features/models/app-model-builder-view.ts` — `appStateController` L213, `resourcesController` L214 (`render()` checks `resources.metadata` directly at L686/L845 without a status guard); `handleReopenClick` L414–439 (Phase 1 updates to `SECTION_ORDER`-based downstream check); completed-header `Edit` pattern L710–732; `activeStep` L1054–1068 (`4` when `configure-model` complete and `configure-training` incomplete); Section 4 pending call site L1092–1098. Phase 1 adds `i18n('app-model-builder-view', …)` and `src/features/models/app-model-builder-view.stories.ts`.
    - `src/features/models/app-models-view.ts` — Training Setup column at L284–287 (`isTrainingSetup = model.completedSteps.includes('configure-training')`, currently renders `model.trainingSetup.type` or `'Not configured'`), cell L300, header L336. No `i18n` import today.
    - `src/types/routes.ts` L5 (`ReservedPath`), `src/router/route-parser.ts` L10–59 (strips trailing slash; exact match at L36–38), `src/router/reserved-content.ts` L7–11 (`RESERVED_CONTENT`), `src/router/router.ts` `getDocumentTitle` L33–66, `scripts/build-content.ts` L179–283 (compiles every `content/{locale}/pages/*.md` into `pages/{id}.html` and `pages/index.json` with `{ id, lang, title, description, url, headings, updated? }`) & L480–486 (validates every entry of `RESERVED_CONTENT` exists in base locale `en`), `src/common/content/content-loader.ts` L6–24 (`ContentLoadError`, `ContentLoadErrorCode = 'NETWORK' | 'NOT_FOUND' | 'INVALID_INDEX' | 'INVALID_FRAGMENT'`, `loadContentEntry` L272–320), `src/features/shell/app-content-modal.ts` L14–21 (`messages`), L27 (`translations`), L83–115 (`startLoad`), L123–158 (`render`, heading uses `this.entry.title` when `ready`).
    - `src/styles/hyperparameters.styles.ts` (created by Phase 1 T4; owns `.field` family, `.field-error`, `.form-note`, scoped `.field input[type='number']` & `.field select`; explicitly leaves `.field--folds`, `.field-visual`, `.fold-*` for Phase 2). `src/styles/train-model.styles.ts` (Phase 1 adds `.train-step-header h2 .help-link`; `.visually-hidden` at L90). `src/styles/notification.styles.ts` (shared `.notification.notification-alert`).
- **Upstream `web-ml@0.1.0` contracts & provenance:**
    - Both `../web-ml/package.json#L3` and `node_modules/web-ml/package.json#L3` declare `"version": "0.1.0"`.
    - `../web-ml/dist/src/training/cross-validate.d.ts` (L11–22, L111–113) ships `crossValidate<A>(request: CrossValidationRequest<A>, options?)` taking `folds: number` (`>= 2`), `options?: Partial<TrainingOptionsFor<A>>`, `randomState?: number`, `scoring`, `classLabels`, `includeMetrics`, `refit`. Provenance note: both `../web-ml/dist/src/training/index.d.ts#L1-15` and `node_modules/web-ml/dist/src/training/index.d.ts#L1-15` re-export `crossValidate`, while the installed `node_modules/web-ml/dist/src/training/cross-validate.d.ts` file is absent on disk (stale installed `dist/` vs `../web-ml/dist/`). Phase 2 imports no `web-ml` runtime symbols, so this is non-blocking for Phase 2 (Phase 3 refreshes the workspace link / build deployment).
    - `../web-ml/dist/src/training/cross-validation.d.ts` (identical in `node_modules/web-ml`, L43–84) ships `nestedCrossValidate` requiring `outerFolds >= 2`, `innerFolds >= 2`, `randomState?: number`.
    - `../web-ml/specification/public-api/current-limitations.md` (L298–300): classifier folds are stratified and need enough rows per class; rare-class datasets can be rejected. Hence Phase 2 caps `maxFolds = Math.min(10, minClassCount)` and blocks submission when `minClassCount < 2`.
- **Tests and commands:** Baseline `bun run check` passes 220 tests across 31 files (before Phase 1). Affected test files:
    - Unit fixtures using `k_fold_cv`: `tests/state-and-storage.test.ts` (9 occurrences: L103, L114, L333, L362, L542, L599, L849, L851, L895; 0 occurrences of `train_test_split` or `nested_cv`) and `tests/dataset-resources.test.ts` (L32). All other fixture files (`tests/column-eligibility.test.ts` L63, `tests/visual-parity/fixtures.ts` L17, `tests/visual-parity.e2e.ts` L93/L149/L202, `tests/a11y.e2e.ts` L272/L379/L436/L495/L552, `tests/models-overview.e2e.ts` L178/L197, `tests/target-selection.e2e.ts` L185/L270) set `trainingSetup: null` and remain valid without edits.
    - E2E tests: `tests/models-setup.e2e.ts` `MOD-SETUP-3` (Phase 1 updates the pending-inputs loop to sections 4–6; Phase 2 updates it to sections 5–6, `i = 4..5`); `tests/models-overview.e2e.ts` (`MOD-HUB-1` L86 expects `'Not configured'` before completion; add assertions for formatted configured setups); `tests/journeys/iris-classification.e2e.ts` and `tests/journeys/penguins-classification.e2e.ts` (update Section 4 active / Section 5 pending after Phase 1); `tests/content.e2e.ts` (add dynamic `/help/training-setup` and `/help/nonexistent-topic` checks).
    - Parity & tokens: `tests/visual-parity/map.ts` `models-step-pending` (L700–706) targets `li.train-step.train-step-pending` on `/models/1` — Sections 5 and 6 remain pending, so it needs no change. `tests/style-tokens.test.ts` `TOK-2` rejects literal colours/fallbacks (`transparent` passes); `TOK-5` rejects physical inline properties including `text-align: left`.
- **Web guidance:** `forms`, `accessible-error-announcement`, `responsive-table` — labelled native `<select>` and synchronised range/number pair in `role="group" aria-labelledby`; `<form novalidate>` with `type="submit"` never disabled for field validation errors (disabled only for `disabled` or unfixable dataset-level `blockedReason`); validate on `blur` and `submit`, clear errors on valid `input`, preserve `validity.badInput` via `noChange` + `live()`, set `aria-invalid="false"` until invalid (`"true"` when invalid), include `folds-error` in `aria-describedby` only while shown, announce blur errors via one `.visually-hidden` `aria-live="polite"` region, focus `#folds-number` on failed submit; wrap `.fold-matrix` in a keyboard-scrollable `tabindex="0" role="region" aria-labelledby` container with semantic `<caption>` and `<th scope>`.
- **Visual reference:** Draft-only (`visual-design.md` §1.1): structure from updated `specification/mockups/ui-scaffold/drafts/03-5_train-models-4-configure-training.html`, fold/matrix CSS from `specification/mockups/ui-scaffold/css/hyperparameters.css` L105–235 & L261–268 (every token `--stone-200`, `--neutral-50`, `--neutral-600`, `--neutral-700`, `--neutral-800`, `--blue-100`, `--blue-300`, `--green-100`, `--green-500` verified in `css/root.css`); no new parity entries. Physical→logical translations (`padding-bottom` → `padding-block-end`, `text-align: left` → `text-align: start`) and forced-colours border distinction (`dashed` vs `2px solid`) applied under `visual-design.md` §4.
- **Domain skills:** `lit-architecture-planner` (applied here); `lit-component-implementer` for T2 and T3; `modern-web-guidance` (`forms`, `accessible-error-announcement`, `responsive-table`) for T2 and T3.
- **Assumptions requiring verification:** None — all design decisions were confirmed by the user on 2026-11-18 and 2026-11-19.

## Technical decisions

| Decision                          | Chosen approach and rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Rejected alternative / trade-off                                                                                                                                                                 |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1 `ValidationMethodology` shape  | `export type ValidationMethodology = { type: 'one_shot'; testRatio: 0.2; randomState: 42 } \| { type: 'nested_cv'; outerFolds: number; innerFolds: number; randomState: 42 };` with defaults `DEFAULT_ONE_SHOT_SETUP` and `DEFAULT_CV_FOLDS = 5` (`MIN_CV_FOLDS = 2`, `MAX_CV_FOLDS = 10`). Literal `0.2` and `42` match runtime validation identically and enforce the fixed-ratio / fixed-seed scope.                                                                                                               | Typing `testRatio: number` / `randomState: number` while rejecting non-`0.2`/non-`42` values contradicts the type contract; keeping `k_fold_cv` / `train_test_split` leaves dead variants.       |
| D2 Keep `STORAGE_VERSION = 1`     | Keep `STORAGE_VERSION = 1` (matching Phase 1 D9). Section 4 has never rendered in any shipped build, so every real user has `trainingSetup: null`, which stays valid. `validateAppState` validates `one_shot` (`testRatio === 0.2`, `randomState === 42`) and `nested_cv` (integers `outerFolds` & `innerFolds` in `2..10`, `randomState === 42`) and rejects unknown/malformed blobs via the existing invalid-state path.                                                                                            | Bumping to `STORAGE_VERSION = 2` invalidates `PersistedScroll` (`persister.ts` L319–325) and requires a migration runner for legacy variants no shipped UI ever wrote.                           |
| D3 Section 4 UI layout (`03-5`)   | Follow the updated `03-5` draft: `.field` Training Strategy `<select>` (`One-Shot` / `Cross-Validation`), and when Cross-Validation is selected, `.field.field--folds` with synchronised range + number pair (`2..maxFolds`, default `5`) plus the live `.field-visual` fold-matrix table, percentage summary, and legend. Omit Random Seed (fixed `42`) and Missing Values (moved to `FUTURE.md`). User decision, 2026-11-19.                                                                                        | Earlier radio-group + plain number design discarded the human-designed `03-5` fold-matrix visual and `hyperparameters.css` L105–235 rules reserved for Phase 2 by Phase 1.                       |
| D4 Dynamic `/help/*` route        | Generalise `ReservedPath = StaticReservedPath \| \`/help/${string}\`` where `parseRoute` accepts single-segment lowercase kebab-case slugs (`^[a-z0-9]+(?:-[a-z0-9]+)*$`) as reserved routes. Keep `RESERVED_CONTENT`for build-verified required pages (adding`'/help/training-setup': 'training-setup'`), export `getReservedContentPageId(path)`, and map `ContentLoadError('NOT_FOUND')`in`app-content-modal.ts`to a distinct not-found message without changing`<app-content-dialog>`. User decision, 2026-11-19. | Hard-coding every new `/help/<slug>` in five router/modal files forces code edits whenever a help page is added; treating `/help/*` as a workflow path would break modal/underlay semantics.     |
| D5 `Train Model` pre-Phase 3      | Keep the primary submit button labelled `Train Model` (`03-5`, `workflow-steps.md` §3.4). On valid submit, `<app-model-builder-view>` calls `setTrainingSetup(num, setup)` then `completeSection(num, 'configure-training')` while keeping `model.status === 'draft'`. Section 4 collapses to `4. {summary}` with an `Edit` button, and Section 5 activates showing `Not available yet.`. Phase 3 swaps the submit handler to `startModelTraining`. User decision, 2026-11-19.                                        | Calling `startTraining(num)` without a worker freezes Sections 1–4 and causes `TRAINING_INTERRUPTED_BY_RELOAD` on reload; leaving Section 4 incomplete keeps `/models` showing `Not configured`. |
| D6 Tier 2 component & domain util | `<app-training-setup>` (`src/features/models/app-training-setup.ts`) is Tier 2 presentational with closed `labels: TrainingSetupLabels = DEFAULT_TRAINING_SETUP_LABELS` and `bubbles: false, composed: false` events. Pure bounds/validation/summary logic lives in `src/features/models/training-setup.ts` (zero Lit imports, unit-tested via `bun:test`), shared by `app-model-builder-view.ts` and `app-models-view.ts`.                                                                                           | Importing stores or `i18n` inside `<app-training-setup>` violates `COMPONENTS.md` §2 and §8; duplicating summary formatting in builder and overview risks drift.                                 |

### Interfaces and behaviour

#### A. State, constants, and pure domain helpers

```ts
// src/types/state.ts
export const FIXED_ONE_SHOT_TEST_RATIO = 0.2 as const;
export const FIXED_TRAINING_RANDOM_STATE = 42 as const;
export const MIN_CV_FOLDS = 2;
export const MAX_CV_FOLDS = 10;
export const DEFAULT_CV_FOLDS = 5;

export type ValidationMethodology =
	| {
			type: 'one_shot';
			testRatio: typeof FIXED_ONE_SHOT_TEST_RATIO;
			randomState: typeof FIXED_TRAINING_RANDOM_STATE;
	  }
	| {
			type: 'nested_cv';
			outerFolds: number;
			innerFolds: number;
			randomState: typeof FIXED_TRAINING_RANDOM_STATE;
	  };

export const DEFAULT_ONE_SHOT_SETUP: ValidationMethodology = {
	type: 'one_shot',
	testRatio: FIXED_ONE_SHOT_TEST_RATIO,
	randomState: FIXED_TRAINING_RANDOM_STATE
};
```

- `src/stores/persister.ts` (`STORAGE_VERSION` remains `1`; `validateAppState` remains unexported):
    - `VALID_TRAINING_SETUP_TYPES` becomes `new Set(['one_shot', 'nested_cv'])`.
    - When `m.trainingSetup !== null`, require `isPlainObject(m.trainingSetup)`, no own prototype keys (`'__proto__'`, `'constructor'`, `'prototype'`), and:
        - `type === 'one_shot'`: `m.trainingSetup.testRatio === FIXED_ONE_SHOT_TEST_RATIO && m.trainingSetup.randomState === FIXED_TRAINING_RANDOM_STATE`.
        - `type === 'nested_cv'`: `Number.isInteger(outerFolds) && outerFolds >= MIN_CV_FOLDS && outerFolds <= MAX_CV_FOLDS`, `Number.isInteger(innerFolds) && innerFolds >= MIN_CV_FOLDS && innerFolds <= MAX_CV_FOLDS`, and `randomState === FIXED_TRAINING_RANDOM_STATE`.
    - Any invalid value (including legacy `'k_fold_cv'` or `'train_test_split'`, `NaN`, `±Infinity`, floats, `< 2`, `> 10`, wrong `testRatio` or `randomState`, or prototype keys) fails `validateAppState`, causing `reconcileStartupState` to fall back to `INITIAL_APP_STATE`.
    - `isSynchronousChange` (`persister.ts` L562) stays unchanged (`prevModel.trainingSetup?.type !== nextModel.trainingSetup?.type` writes synchronously; same-type fold edits debounce `300` ms and flush on `pagehide`/`visibilitychange`, while `completeSection` writes synchronously).

```ts
// src/features/models/training-setup.ts (framework-free; zero Lit imports)
export interface TrainingSetupBounds {
	/** Upper integer bound for cross-validation folds, clamped to [2, 10] when splittable (0 when blocked). */
	readonly maxFolds: number;
	/** Minimum non-zero class count observed in the target column, or null if metadata is unavailable. */
	readonly minClassCount: number | null;
	/** True when the target column has fewer than 2 classes or its rarest class has fewer than 2 labelled rows. */
	readonly blocked: boolean;
}

export type FoldValidationError = 'invalid-number' | 'out-of-range';

export interface TrainingSetupSummaryLabels {
	readonly oneShot: string;
	readonly crossValidation: (folds: number) => string;
}

export function computeTrainingSetupBounds(targetStats: ColumnStats | null): TrainingSetupBounds;
export function validateFoldCount(folds: number, maxFolds: number): FoldValidationError | null;
export function createCrossValidationSetup(
	folds: number
): Extract<ValidationMethodology, { type: 'nested_cv' }>;
export function formatTrainingSetupSummary(
	setup: ValidationMethodology,
	labels: TrainingSetupSummaryLabels
): string;
```

- `computeTrainingSetupBounds(targetStats)` rules:
    - If `targetStats === null`: returns `{ maxFolds: MAX_CV_FOLDS, minClassCount: null, blocked: false }`.
    - If `targetStats.type === 'categorical'`: take positive entries `Object.values(targetStats.categoryCounts).filter((n) => Number.isFinite(n) && n > 0)`. If fewer than 2 classes or `Math.min(...counts) < MIN_CV_FOLDS`, return `{ maxFolds: 0, minClassCount: counts.length < 2 ? 0 : Math.min(...counts), blocked: true }`. Otherwise `min = Math.min(...counts)`, return `{ maxFolds: Math.min(MAX_CV_FOLDS, min), minClassCount: min, blocked: false }`.
    - If `targetStats.type === 'boolean'`: take `[targetStats.trueCount, targetStats.falseCount].filter((n) => Number.isFinite(n) && n > 0)`. Apply the same `< 2` class / `< 2` min-count rule.
    - Any other `ColumnStats` type (e.g. numeric/text/datetime, unreachable for valid classification targets): return `{ maxFolds: 0, minClassCount: 0, blocked: true }`.
- `validateFoldCount(folds, maxFolds)`: returns `'invalid-number'` when `!Number.isFinite(folds)`, `'out-of-range'` when `!Number.isInteger(folds) || folds < MIN_CV_FOLDS || folds > maxFolds`, else `null`.
- `createCrossValidationSetup(folds)`: returns `{ type: 'nested_cv', outerFolds: folds, innerFolds: folds, randomState: 42 }`.
- `formatTrainingSetupSummary(setup, labels)`: returns `labels.oneShot` (`"One-Shot (80% / 20%)"`) for `one_shot` and `labels.crossValidation(setup.outerFolds)` (`"Cross-Validation (5 folds)"`) for `nested_cv`.

#### B. Dynamic `/help/*` reserved route and content page

- `src/types/routes.ts`:
    ```ts
    export type StaticReservedPath = '/about' | '/privacy' | '/help';
    export type HelpTopicPath = `/help/${string}`;
    export type ReservedPath = StaticReservedPath | HelpTopicPath;
    ```
- `src/router/route-parser.ts`: after stripping trailing slashes, match exact `'/about' | '/privacy' | '/help'` as `{ kind: 'reserved', path }`; if `normalised.startsWith('/help/')`, validate `slug = normalised.slice('/help/'.length)` against `/^[a-z0-9]+(?:-[a-z0-9]+)*$/` — matching slugs return `{ kind: 'reserved', path: `/help/${slug}` as ReservedPath }`; non-matching paths (e.g. `/help/a/b`, `/help/UPPER`, `/help/..`, `/help/-bad`, `/help/foo_bar`) fall through to `{ kind: 'unknown', path: pathname }`.
- `src/router/reserved-content.ts`:
    - `RESERVED_CONTENT` keeps all build-verified required pages: `'/about': 'about'`, `'/privacy': 'privacy-policy'`, `'/help': 'help'`, `'/help/configure-model': 'configure-model'` (from Phase 1), and adds `'/help/training-setup': 'training-setup'`.
    - Export `getReservedContentPageId(path: ReservedPath): string`: returns `RESERVED_CONTENT[path]` when present via `Object.hasOwn`, else `path.slice('/help/'.length)` for `/help/*` paths, else `'help'`.
- `src/router/router.ts` (`getDocumentTitle`): add `case '/help/training-setup': return 'samatā.ml | Training Setup';` and default for any other `route.path.startsWith('/help/')` → `'samatā.ml | Help'`.
- `src/features/shell/app-content-modal.ts`:
    - Call `loadContentEntry('pages', getReservedContentPageId(path), { locale: BASE_LOCALE, signal })`.
    - Track `private errorCode: ContentLoadErrorCode | null = null` on load failure (`err instanceof ContentLoadError ? err.code : 'NETWORK'`).
    - Add `trainingSetup: 'Training Setup'` and `notFound: 'This help topic could not be found.'` to `messages = i18n('app-content-modal', …)`.
    - Fallback heading while loading/error: `/about` → `t.about`, `/privacy` → `t.privacy`, `/help/configure-model` → `t.configureModel`, `/help/training-setup` → `t.trainingSetup`, any other `/help` or `/help/*` → `t.help`; once `ready`, uses `this.entry!.title` (from the compiled Markdown `# H1` / front matter).
    - Pass `.labels=${{ close: t.close, loadError: this.errorCode === 'NOT_FOUND' ? t.notFound : t.loadError }}` to `<app-content-dialog>` (leaving `<app-content-dialog>`'s closed API untouched).
- `content/en/pages/training-setup.md` (British English): explains One-Shot Training (80% / 20% stratified holdout, fixed seed 42), Cross-Validation (stratified $k$ folds, trade-offs of fold count, how every row serves once in validation, and how Phase 7 extends it to nested cross-validation for tuning), and why training and evaluation data stay separate.

#### C. Fold-matrix styles (`src/styles/hyperparameters.styles.ts`)

Port `.field--folds`, `.field-visual`, `.fold-matrix`, `.fold-visual-summary`, `.fold-legend`, `.fold-legend-swatch*`, and the `@media (max-width: 700px)` `.field--folds` rule from `specification/mockups/ui-scaffold/css/hyperparameters.css` L105–235 & L261–268 into `src/styles/hyperparameters.styles.ts` (which Phase 1 created for `.field` L1–104 & L251–260):

- Translate every physical property to logical equivalents: `padding-bottom` → `padding-block-end`, `text-align: left` → `text-align: start`, `width` → `inline-size`, `min-width` → `min-inline-size`, `height` → `block-size`.
- Add `.fold-matrix-scroll { overflow-x: auto; max-inline-size: 100%; }` with `:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }` so keyboard users can scroll a 10-fold matrix at 320 px or 200% zoom (`responsive-table`).
- Add `@media (forced-colors: active)` differentiation with zero colour literals: `.fold-matrix .fold-training, .fold-legend-swatch-train { border-style: dashed; }` and `.fold-matrix .fold-validation, .fold-legend-swatch-validation { border-style: solid; border-width: 2px; }`.
- Keep all colour tokens from `css/root.css` with zero fallbacks (`--stone-200`, `--neutral-50`, `--neutral-600`, `--neutral-700`, `--neutral-800`, `--blue-100`, `--blue-300`, `--green-100`, `--green-500`).

#### D. `<app-training-setup>` (`src/features/models/app-training-setup.ts`)

- **Tier:** 2 (Presentational), tag `app-training-setup`, class `AppTrainingSetup`, augments `HTMLElementTagNameMap`.
- **Styles:** `[buttonStyles, notificationStyles, trainModelStyles, hyperparametersStyles, css`…`]` (component CSS limited to `:host { display: block; }`, `:host([hidden]) { display: none; }`, `.section-actions`, and `.blocked-notice` margin spacing using existing spacing values).
- **Public API (closed) — Properties (`@property({ attribute: false }) accessor`):**
    - `value: ValidationMethodology | null = null` — current persisted setup; `null` displays default One-Shot without mutating state until interaction or submit.
    - `maxFolds = MAX_CV_FOLDS` — maximum allowed folds (`<= 10`), supplied by the connected builder from target class counts.
    - `blockedReason = ''` — non-empty alert string when the dataset cannot be split (`minClassCount < 2`).
    - `disabled = false` — when `true`, disables every interactive control (`<select>`, range, number, submit button) and suppresses both custom events.
    - `labels: TrainingSetupLabels = DEFAULT_TRAINING_SETUP_LABELS`:
        ```ts
        export interface TrainingSetupLabels {
        	readonly formLabel: string;
        	readonly strategyLabel: string;
        	readonly strategyOneShot: string;
        	readonly strategyCrossValidation: string;
        	readonly strategyHelp: string;
        	readonly strategyHelpLinkText: string;
        	readonly strategyHelpHref: string;
        	readonly oneShotNote: string;
        	readonly foldsLabel: string;
        	readonly foldsExactValueLabel: string;
        	readonly foldsHelp: string;
        	readonly matrixCaption: string;
        	readonly matrixRunHeader: string;
        	readonly matrixTrainingCell: string;
        	readonly matrixValidationCell: string;
        	readonly legendLabel: string;
        	readonly legendTraining: string;
        	readonly legendValidation: string;
        	readonly foldSummary: (params: {
        		readonly folds: number;
        		readonly trainFolds: number;
        		readonly trainPercent: string;
        		readonly validationPercent: string;
        	}) => string;
        	readonly formatPercent: (percent: number) => string;
        	readonly foldErrorInvalidNumber: string;
        	readonly foldErrorRange: (min: number, max: number) => string;
        	readonly submitButton: string;
        }
        ```
        English defaults in `DEFAULT_TRAINING_SETUP_LABELS` match the cleaned `03-5` draft (`formLabel: 'Training Setup'`, `strategyLabel: 'Training Strategy'`, `strategyOneShot: 'One-Shot'`, `strategyCrossValidation: 'Cross-Validation'`, `strategyHelpLinkText: 'Learn more'`, `strategyHelpHref: '/help/training-setup'`, `oneShotNote: 'Splits eligible rows into 80% training and 20% held-out test data.'`, `foldsLabel: 'Cross-validation Folds'`, `foldsExactValueLabel: 'Number of folds (exact value)'`, `matrixCaption: 'Cross-validation training iterations'`, `matrixRunHeader: 'Run'`, `matrixTrainingCell: 'Training'`, `matrixValidationCell: 'Validation'`, `legendLabel: 'Fold partition legend'`, `legendTraining: 'Training'`, `legendValidation: 'Validation'`, `foldErrorInvalidNumber: 'Enter a valid whole number.'`, `foldErrorRange: (min, max) => \`Enter a whole number between ${min} and ${max}.\``, `submitButton: 'Train Model'`).
- **Slots / Methods / CSS parts / CSS custom properties:** None.
- **Events (`bubbles: false, composed: false`; bound directly by `<app-model-builder-view>`, per `COMPONENTS.md` §4):**
    - `app-training-setup-change` — `CustomEvent<{ setup: ValidationMethodology }>`, fired on strategy change or valid fold edit (`2..maxFolds`); never fired when `disabled` or on invalid/`bad-input`/empty fold drafts.
    - `app-training-setup-submit` — `CustomEvent<{ setup: ValidationMethodology }>`, fired on submit only when `!disabled`, `!blockedReason`, and validation passes.
- **Markup, synchronisation, `validity.badInput`, and accessibility:**
    - `<form novalidate aria-label=${this.labels.formLabel} @submit=${this.handleSubmit}>` (uses `aria-label` instead of cross-root `aria-labelledby`).
    - When `this.blockedReason`: render `<div id="training-setup-blocked" class="notification notification-alert blocked-notice" role="alert">${this.blockedReason}</div>` above the fields; `Train Model` sets `?disabled=${this.disabled || Boolean(this.blockedReason)}` and `aria-describedby=${this.blockedReason ? 'training-setup-blocked' : nothing}`. For field validation errors (`foldError`), `Train Model` is **never** disabled.
    - Strategy `.field`: `<label for="strategy" class="field-name">`, `<select id="strategy" name="strategy" class="field-control" aria-invalid="false" aria-describedby="strategy-help" ?disabled=${this.disabled} @change=${this.handleStrategyChange}>` with `<option value="one_shot">` and `<option value="nested_cv">`; `<div id="strategy-help" class="field-description">` with `<p>${labels.strategyHelp} <a href=${labels.strategyHelpHref}>${labels.strategyHelpLinkText}</a></p>` (no `target="_blank"` — router intercepts shadow-DOM clicks via `composedPath()`), plus `<p class="field-dependent">${labels.oneShotNote}</p>` when `one_shot` is selected.
    - Folds `.field.field--folds` (rendered only when strategy is `'nested_cv'`):
        - `<label id="folds-label" for="folds-range" class="field-name">${labels.foldsLabel}</label>`
        - `<div class="field-controls field-controls--folds" role="group" aria-labelledby="folds-label">`:
            - `<input id="folds-range" type="range" min=${MIN_CV_FOLDS} max=${sliderMax} step="1" .value=${String(clampedSliderFolds)} aria-labelledby="folds-label" aria-describedby="folds-help folds-visual-summary" ?disabled=${this.disabled} @input=${this.handleRangeInput} />`
            - `<label class="visually-hidden" for="folds-number">${labels.foldsExactValueLabel}</label>`
            - `<input id="folds-number" name="folds" type="number" min=${MIN_CV_FOLDS} max=${sliderMax} step="1" .value=${this.foldEditState?.status === 'bad-input' ? noChange : live(displayText)} aria-invalid=${this.foldError ? 'true' : 'false'} aria-describedby=${this.foldError ? 'folds-error folds-help folds-visual-summary' : 'folds-help folds-visual-summary'} ?disabled=${this.disabled} @input=${this.handleNumberInput} @blur=${this.handleNumberBlur} />`
        - `<div class="field-description">`: when `this.foldError`, `<p id="folds-error" class="field-error">${this.foldError}</p>` first, then `<div id="folds-help"><p>${labels.foldsHelp}</p></div>`.
        - `<div class="field-visual">`:
            - `<div class="fold-matrix-scroll" tabindex="0" role="region" aria-labelledby="folds-matrix-caption">` wrapping `<table class="fold-matrix" aria-describedby="folds-visual-summary">` with `<caption id="folds-matrix-caption">`, `<thead>` (`Run`, `1..k`), `<tbody>` (`1..k` rows with `<th scope="row">${iteration}</th>` and `k` `<td class=${isValidation ? 'fold-validation' : 'fold-training'}><span class="visually-hidden">${isValidation ? labels.matrixValidationCell : labels.matrixTrainingCell}</span></td>`). The matrix renders for `matrixFolds = Math.min(MAX_CV_FOLDS, Math.max(MIN_CV_FOLDS, Math.round(canonicalFolds)))`, keeping DOM size strictly bounded to `2×2..10×10`.
            - `<p id="folds-visual-summary" class="fold-visual-summary">${summaryText}</p>` using `labels.formatPercent(((k - 1) / k) * 100)` and `labels.formatPercent(100 / k)`.
            - `<ul class="fold-legend" aria-label=${labels.legendLabel}>` with `.fold-legend-swatch-train` and `.fold-legend-swatch-validation` (`aria-hidden="true"`).
    - One `.visually-hidden` `<div aria-live="polite">${this.liveAnnouncement}</div>` inside the form announces blur-triggered fold errors once, clears when fixed, and is cleared (not spoken redundantly) on failed submit because focus moves directly to `#folds-number` in `updated()`.
    - Edit-state clearing & `badInput` preservation:
        - `handleNumberInput` checks `target.validity.badInput` **first** (`{ status: 'bad-input' }`), then `target.value.trim() === ''` (`{ status: 'empty' }`), else `{ status: 'text', text: target.value }` parsed via `parseNumberText` (`src/common/parameter-scale.ts`); valid integers in `2..maxFolds` clear `foldError`/`liveAnnouncement`, update `lastValidFolds`, and emit `app-training-setup-change`; invalid drafts never mutate canonical folds, slider, or matrix.
        - `handleRangeInput` clears `foldEditState`/`foldError`/`liveAnnouncement`, updates `lastValidFolds`, and emits `app-training-setup-change`.
        - `handleNumberBlur` validates without rewriting/clamping invalid user input (intentional accessibility upgrade over draft `03-5`'s silent blur reset, per `modern-web-guidance` `forms`/`accessible-error-announcement`), setting `foldError` and `liveAnnouncement`.
        - Switching strategy to `'one_shot'` deletes `foldEditState`, `foldError`, and `liveAnnouncement` immediately so hidden fold drafts never block submission. Switching back to `'nested_cv'` clears `foldEditState`/`foldError`/`liveAnnouncement` and emits `createCrossValidationSetup(Math.min(Math.max(this.lastValidFolds, MIN_CV_FOLDS), Math.max(MIN_CV_FOLDS, this.maxFolds)))`.
        - External `value` changes (in `willUpdate`) sync `lastValidFolds` when `value?.type === 'nested_cv'` and clear stale `foldEditState`/`foldError` when `value?.type === 'one_shot'`.

#### E. Builder and `/models` overview wiring

- **`src/features/models/app-model-builder-view.ts`:**
    - Add Section 4 keys to `i18n('app-model-builder-view', …)` (created in Phase 1) and format fold percentages via `$format` (`$format.get().number(percent, { maximumFractionDigits: 1 })`).
    - Replace the Section 4 `renderPendingSection` call (L1092–1098) with `renderTrainingSetupSection(model, activeStep, targetStats)`:
        - **Pending (`!isActive && !isCompleted`):** `4. Training Setup`, `train-step-pending`, collapsed (`hidden`).
        - **Active (`isActive`):** header `4. Training Setup` + `<a href="/help/training-setup" class="help-link">What is this?</a>`; body renders `<app-training-setup>` with `bounds = computeTrainingSetupBounds(targetStats)` (`blockedReason` = localised `"Every target class needs at least 2 labelled rows to split data for training."` when `bounds.blocked`, else `''`).
        - **Completed (`isCompleted && !isActive`):** header `4. ${summaryText}` + `<span class="train-step-action train-step-status">` with `Edit` button (`aria-label="Reopen Training Setup"`, calling `handleReopenClick('configure-training')`) and completed check icon; collapsed `.completed-summary` renders `<p>Selected training setup: <strong>${summaryText}</strong></p>`.
    - `handleTrainingSetupChange`: calls `setTrainingSetup(this.modelNum, e.detail.setup)`.
    - `handleTrainingSetupSubmit`: calls `setTrainingSetup(this.modelNum, e.detail.setup)` then `completeSection(this.modelNum, 'configure-training')` (keeping `model.status === 'draft'`).
- **`src/features/models/app-models-view.ts`:**
    - Add `i18n('app-models-view', …)` with `oneShotSummary`, `crossValidationSummary` (`params('Cross-Validation ({folds} folds)')`), and `notConfigured` via `StoreController`.
    - Replace L285–287 raw `model.trainingSetup.type` with `formatTrainingSetupSummary(model.trainingSetup, summaryLabels)` when `isTrainingSetup && model.trainingSetup`, else `t.notConfigured`.

## Specification changes

- [ ] `specification/workflow-steps.md` §3, §3.4 — Specify Section 4 (`4. Training Setup`): One-Shot (fixed 80% / 20% stratified holdout, seed 42) vs Cross-Validation (`2..10` folds, default `5`, capped by rarest class count, synchronised range+number pair + live fold-matrix visual), `/help/training-setup` link, `Train Model` completion showing `4. {summary}` with `Edit`, and `/models` Training Setup column formatting; status stays partial.
- [ ] `specification/state-and-storage.md` §3, §5, §8 — Replace provisional `ValidationMethodology` with `one_shot` (`testRatio: 0.2`, `randomState: 42`) and `nested_cv` (`outerFolds`, `innerFolds`, `randomState: 42`), record strict `validateAppState` checks and why `STORAGE_VERSION` stays `1`; status stays draft.
- [ ] `specification/app-state-and-navigation.md` §3, §3.1 and `specification/content-and-i18n.md` §2 — Specify dynamic `/help/{slug}` reserved routes (lowercase kebab-case slugs resolved from `content/{locale}/pages/{slug}.md`), `getReservedContentPageId`, `RESERVED_CONTENT['/help/training-setup']`, and `NOT_FOUND` modal error messaging; status unchanged.
- [ ] `specification/visual-design.md` §3 — Map `hyperparameters.css` L105–235 & L261–268 (`.field--folds`, `.field-visual`, `.fold-matrix`, `.fold-visual-summary`, `.fold-legend`) to `src/styles/hyperparameters.styles.ts` with logical properties, scrollable matrix wrapper, and forced-colours border rules; status stays partial.
- [ ] `specification/FUTURE.md` — Add user-configurable split/fold sizes, editable random seed (`randomState`), and missing-value handling options on Step 4 (Training Setup) to the Product backlog.
- [ ] `specification/components/training-setup.md` (new) & `specification/README.md` — Closed API, events, fold-matrix markup, validation/`badInput`, accessibility, i18n `labels`, and stories for `app-training-setup`; status implemented.
- [ ] `specification/TODO.md` (resolve TODO-01 initial classification scope and note the TODO-04 Step 4 `"Train Model"` button resolution) and `specification/HUMAN.md` (remove the Phase 2 verify item added during planning and update the `03-5` draft-styling queue item to note the cleaned strategy/folds/matrix draft and optional colour-blind matrix styling).

## Implementation tasks

### T1 — Update `ValidationMethodology` state, persister validation, pure setup utilities, and unit tests

- **Depends on:** None
- **Risk:** needs care — replacing provisional `k_fold_cv` and `train_test_split` affects 9 fixtures in `tests/state-and-storage.test.ts` and 1 in `tests/dataset-resources.test.ts`; over-strict validation must never reject valid `trainingSetup: null` state.
- **Likely files:** `src/types/state.ts`, `src/stores/persister.ts`, `src/features/models/training-setup.ts`, `tests/training-setup.test.ts`, `tests/state-and-storage.test.ts`, `tests/dataset-resources.test.ts` — new files: `src/features/models/training-setup.ts`, `tests/training-setup.test.ts`
- **Must not touch:** `src/stores/app.store.ts`, `src/stores/reconciler.ts`, `src/router/`, `src/common/storage/db.ts`, `src/features/models/app-model-builder-view.ts`, `src/features/models/app-models-view.ts`
- **Implementation:** Apply D1, D2, and Interfaces A. Define the new `ValidationMethodology` union and constants in `src/types/state.ts` (keeping `STORAGE_VERSION = 1`). Update `VALID_TRAINING_SETUP_TYPES` and `validateAppState` (`src/stores/persister.ts` L92, L257–267) without exporting `validateAppState`. Implement `computeTrainingSetupBounds`, `validateFoldCount`, `createCrossValidationSetup`, and `formatTrainingSetupSummary` in framework-free `src/features/models/training-setup.ts` with TSDoc on every export. Update the 9 `k_fold_cv` fixtures in `tests/state-and-storage.test.ts` (L103, L114, L333, L362, L542, L599, L849, L851, L895) and L32 in `tests/dataset-resources.test.ts` to valid `one_shot` / `nested_cv` objects, and add comprehensive unit tests in `tests/training-setup.test.ts` and `tests/state-and-storage.test.ts`.
- **Acceptance criteria:**
    - [ ] `WML-P2-STATE-1` — Through `reconcileStartupState` only (`validateAppState` stays unexported; `STORAGE_VERSION` stays `1`): `trainingSetup: null`, `{ type: 'one_shot', testRatio: 0.2, randomState: 42 }`, and `{ type: 'nested_cv', outerFolds: 5, innerFolds: 5, randomState: 42 }` (and boundary folds `2` and `10`) round-trip unchanged; any invalid `trainingSetup` — wrong `testRatio` (`0.3`), wrong `randomState` (`7`), `outerFolds` or `innerFolds` `< 2` (`1`), `> 10` (`11`), non-integer (`3.5`), raw JSON `1e999` (`Infinity`), missing field, own prototype key (`"__proto__"`, `"constructor"`, `"prototype"`), or removed legacy types (`'k_fold_cv'`, `'train_test_split'`) — reconciles to `models: []`.
    - [ ] `WML-P2-STATE-2` — `setTrainingSetup` with a `jsonEqual` setup leaves `$appState.get()` as the same object reference and preserves `completedSteps`; changing between `one_shot` and `nested_cv` or changing fold counts invalidates `'training'` and `'results'` while preserving `'configure-training'`; calling `setTrainingSetup` on a non-draft model returns `false`.
    - [ ] `WML-P2-UTIL-1` — `computeTrainingSetupBounds` returns `{ maxFolds: 10, minClassCount: null, blocked: false }` for `null` metadata, `{ maxFolds: 10, minClassCount: 50, blocked: false }` for a balanced categorical target (`>= 10` per class), `{ maxFolds: 4, minClassCount: 4, blocked: false }` when the rarest non-zero class has 4 rows (ignoring zero-count categories), `{ maxFolds: 0, minClassCount: 1, blocked: true }` when a class has 1 row, `{ maxFolds: 0, minClassCount: 0, blocked: true }` when fewer than 2 non-zero classes exist, and computes `min(trueCount, falseCount)` for boolean targets; `validateFoldCount` accepts integers `2..maxFolds` and rejects `NaN`, `Infinity`, floats, `< 2`, and `> maxFolds`; `formatTrainingSetupSummary` formats both variants via the supplied labels.
- **Verification:** `bun test tests/training-setup.test.ts tests/state-and-storage.test.ts tests/dataset-resources.test.ts tests/repository-conventions.test.ts`; `bun run check`.
- **Progress:** [ ] Not started

### T2 — Dynamic `/help/*` reserved route, `training-setup.md` help page, and `.field--folds` / fold-matrix styles

- **Depends on:** None
- **Risk:** needs care — generalising `ReservedPath` touches route parsing, content build validation, and modal error handling; porting `.field--folds` / `.fold-*` must satisfy `TOK-1`–`TOK-6` and forced-colours legibility.
- **Likely files:** `src/types/routes.ts`, `src/router/route-parser.ts`, `src/router/reserved-content.ts`, `src/router/router.ts`, `src/features/shell/app-content-modal.ts`, `content/en/pages/training-setup.md`, `tests/fixtures/content/valid-en/en/pages/training-setup.md`, `tests/fixtures/content/valid-multi/en/pages/training-setup.md`, `tests/router-and-navigation.test.ts`, `tests/build-content.test.ts`, `tests/content.e2e.ts`, `src/styles/hyperparameters.styles.ts`, `src/styles/hyperparameters.stories.ts` — new files: `content/en/pages/training-setup.md`, both fixture files
- **Must not touch:** `css/root.css`, `src/styles/global.ts`, `src/features/shell/app-content-dialog.ts`, `src/stores/`, `src/features/models/`
- **Implementation:** Apply D4, Interfaces B, and Interfaces C. Generalise `ReservedPath`, `parseRoute`, `RESERVED_CONTENT` + `getReservedContentPageId`, `getDocumentTitle`, and `app-content-modal.ts` (including `NOT_FOUND` vs `NETWORK` message selection without altering `<app-content-dialog>`). Author `content/en/pages/training-setup.md` (British English) and add matching minimal fixtures in `tests/fixtures/content/valid-en/en/pages/training-setup.md` and `tests/fixtures/content/valid-multi/en/pages/training-setup.md`. Port `.field--folds`, `.field-visual`, `.fold-matrix-scroll`, `.fold-matrix`, `.fold-training`, `.fold-validation`, `.fold-visual-summary`, `.fold-legend`, `.fold-legend-swatch*`, forced-colours border rules, and responsive `@media (max-width: 700px)` `.field--folds` rules into `src/styles/hyperparameters.styles.ts`, and add a `FoldsMatrix` story (with `play` checks) to `src/styles/hyperparameters.stories.ts`.
- **Acceptance criteria:**
    - [ ] `WML-P2-ROUTE-1` — `parseRoute` parses `/help/training-setup`, `/help/training-setup/`, and arbitrary kebab-case `/help/custom-topic-2` as `{ kind: 'reserved', path }` (trailing slash stripped), and classifies `/help/a/b`, `/help/UPPER`, `/help/..`, `/help/-bad`, and `/help/foo_bar` as `{ kind: 'unknown' }`; `getReservedContentPageId` maps static and dynamic `/help/*` paths accurately; `getDocumentTitle` returns `'samatā.ml | Training Setup'` for `/help/training-setup` and `'samatā.ml | Help'` for arbitrary `/help/*`; `buildContent()` passes with `training-setup.md` and fails if `training-setup.md` is missing.
    - [ ] `WML-P2-ROUTE-2` — In Playwright (`tests/content.e2e.ts`), navigating to `/help/training-setup` opens `<app-content-dialog>` with the compiled Training Setup article and heading and never writes `/help/training-setup` to `resumePath`; navigating to `/help/nonexistent-topic` opens the dialog in its error state displaying `'This help topic could not be found.'` while Close remains usable and returns to the underlay route.
    - [ ] `WML-P2-STYLE-1` — `bun test tests/style-tokens.test.ts tests/repository-conventions.test.ts` passes (`TOK-1`–`TOK-6` clean, zero physical inline properties or literal colours); `src/styles/hyperparameters.stories.ts` (including `FoldsMatrix`) passes `bun run test:stories` (axe) in Chromium, Firefox, and WebKit.
- **Verification:** `bun test tests/router-and-navigation.test.ts tests/build-content.test.ts tests/style-tokens.test.ts tests/repository-conventions.test.ts`; `bun run test:e2e tests/content.e2e.ts`; `bun run test:stories`; `bun run check`; `bun run build`.
- **Progress:** [ ] Not started

### T3 — Implement `<app-training-setup>`, wire Section 4 and `/models` overview, stories, and E2E tests

- **Depends on:** T1, T2
- **Risk:** needs care — `<input type="number">` `validity.badInput` synchronisation (`noChange` + `live()`), live fold-matrix accessibility, updating `MOD-SETUP-3` and journey tests for Section 4 becoming active, and cleaning draft `03-5`.
- **Likely files:** `src/features/models/app-training-setup.ts`, `src/features/models/app-training-setup.stories.ts`, `src/features/models/app-model-builder-view.ts`, `src/features/models/app-model-builder-view.stories.ts`, `src/features/models/app-models-view.ts`, `specification/mockups/ui-scaffold/drafts/03-5_train-models-4-configure-training.html`, `tests/training-setup.e2e.ts`, `tests/models-setup.e2e.ts`, `tests/models-overview.e2e.ts`, `tests/journeys/iris-classification.e2e.ts`, `tests/journeys/penguins-classification.e2e.ts` — new files: `src/features/models/app-training-setup.ts`, `src/features/models/app-training-setup.stories.ts`, `tests/training-setup.e2e.ts`
- **Must not touch:** `css/root.css`, `src/features/models/app-model-card.ts`, `src/features/models/app-model-configuration.ts`, `src/features/target/`, `src/stores/persister.ts`, `src/stores/reconciler.ts`, `src/stores/app.store.ts`
- **Implementation:** Apply D3, D5, D6, Interfaces D, and Interfaces E. Implement `<app-training-setup>`, wire Section 4 in `<app-model-builder-view>`, and update the Training Setup column in `<app-models-view>`. Clean `specification/mockups/ui-scaffold/drafts/03-5_train-models-4-configure-training.html` (remove `../mockups.css` at L7, fix Section 3 `aria-label` at L211 to `Reopen Configure Model`, update L237 and L312 links to `/help/training-setup` without `target="_blank"`, fix `<form aria-labelledby="step-4-title">` at L243, remove Random Seed L244–264 and Missing Values L266–286, enable Cross-Validation `<option value="nested_cv">` alongside `one_shot`, wrap `.fold-matrix` in `.fold-matrix-scroll` with static 5-fold HTML rows, change `Train Model` to `type="submit"`, remove inline `<script>` L407–521, and replace stale L550–654 blocks including the false cross-origin isolation claim at L640–643 with concise Phase 2 Completed / Invalid Folds / Blocked draft `<section>`s). Update `tests/models-setup.e2e.ts` `MOD-SETUP-3` to assert zero inputs in Sections 5–6 (`i = 4..5`), update `tests/journeys/{iris,penguins}-classification.e2e.ts` for Section 4 active / Section 5 pending, and extend `tests/models-overview.e2e.ts`. Add co-located `app-training-setup.stories.ts` (`OneShot`, `CrossValidation`, `MinFolds`, `MaxFolds`, `CappedFolds`, `InvalidFolds`, `Blocked`, `Disabled`, `LongLabel`, `RTL`, plus Do/Don't docs and `play` checks) and extend `app-model-builder-view.stories.ts` with `ConfigureTraining` and `TrainingSetupCompleted`.
- **Acceptance criteria:**
    - [ ] `WML-P2-UI-1` — In Section 4, One-Shot is selected by default; clicking `Train Model` persists `{ type: 'one_shot', testRatio: 0.2, randomState: 42 }`, completes `configure-training` while keeping `status: 'draft'`, collapses Section 4 to `4. One-Shot (80% / 20%)` with `Edit`, activates Section 5 (`Not available yet.`), and displays `"One-Shot (80% / 20%)"` on `/models` after page reload. Switching to Cross-Validation shows the folds range/number pair at `5` and a `5×5` fold matrix (`"Training on 4 folds (80%) and validating on 1 fold (20%) per iteration."`); changing to `7` folds updates the matrix to `7×7`, persists `{ type: 'nested_cv', outerFolds: 7, innerFolds: 7, randomState: 42 }`, survives page reload on `/models/:num` and `/models` (`"Cross-Validation (7 folds)"`).
    - [ ] `WML-P2-UI-2` — Fold validation & `validity.badInput`: typing out-of-range (`fill('1')` or `fill(String(maxFolds + 1))`), blank (`fill('')`), or malformed text (`pressSequentially('1e')`) in `#folds-number` leaves canonical state, slider, and matrix unchanged; on `blur` or `Train Model` submit, sets `aria-invalid="true"`, renders `folds-error` linked first in `aria-describedby`, preserves `1e` across re-renders (never wipes it), keeps `Train Model` enabled, and on submit moves focus to `#folds-number` without completing Section 4; switching strategy to `One-Shot` clears the hidden fold error/edit state so `Train Model` succeeds cleanly; fixing to a valid integer clears `aria-invalid="false"` and removes `folds-error` from `aria-describedby`.
    - [ ] `WML-P2-UI-3` — Capped folds, blocked datasets, and disabled state: when `maxFolds` is `4`, slider `max` is `4` and submitting persisted `outerFolds: 5` shows the range error and focuses `#folds-number`; when `blockedReason` is set (`minClassCount < 2`), the `role="alert"` notification renders and `Train Model` is disabled with `aria-describedby="training-setup-blocked"` and emits no submit event; when `disabled` is `true`, all controls are disabled and no events fire.
    - [ ] `WML-P2-UI-4` — Reopen & help links: clicking `Edit` (`Reopen Training Setup`) on completed Section 4 reopens it directly with no dialog when Section 5 is not complete, and opens the confirmation dialog when a later step (`training`) is seeded as complete; clicking `What is this?` in the Section 4 header or `Learn more` in Strategy help opens `<app-content-dialog>` at `/help/training-setup` without leaving the underlay model builder, and closing restores `/models/:num`.
    - [ ] `WML-P2-UI-5` — Accessibility & responsive checks: accessible names/descriptions match in Chromium, Firefox, and WebKit; keyboard-only completion, 320 px viewport width, 200% zoom, `dir="rtl"`, long labels, and `forced-colors: active` (dashed training vs 2 px solid validation cells) pass with no clipped text, overflow blowout, or missing focus outlines; `tests/a11y.e2e.ts` and `tests/visual-parity.e2e.ts` pass.
    - [ ] `WML-P2-UI-6` — Co-located `app-training-setup.stories.ts` and updated `app-model-builder-view.stories.ts` pass `bun run test:stories` (axe) in Chromium, Firefox, and WebKit.
- **Verification:** `bun run test:e2e tests/training-setup.e2e.ts tests/models-setup.e2e.ts tests/models-overview.e2e.ts tests/journeys/iris-classification.e2e.ts tests/journeys/penguins-classification.e2e.ts tests/visual-parity.e2e.ts tests/a11y.e2e.ts`; `bun test tests/style-tokens.test.ts tests/repository-conventions.test.ts`; `bun run test:stories`; `bun run check`; `bun run build`.
- **Progress:** [ ] Not started

### T4 — Sync specifications and backlog (`FUTURE.md`) for Phase 2

- **Depends on:** T1, T2, T3
- **Risk:** routine
- **Likely files:** `specification/workflow-steps.md`, `specification/state-and-storage.md`, `specification/app-state-and-navigation.md`, `specification/content-and-i18n.md`, `specification/visual-design.md`, `specification/FUTURE.md`, `specification/components/training-setup.md`, `specification/README.md`, `specification/TODO.md`, `specification/HUMAN.md`, `specification/plans/README.md`, `specification/plans/web-ml-phase-2-training-setup.md` — new file: `specification/components/training-setup.md`
- **Must not touch:** `src/`, `tests/`, `specification/mockups/`
- **Implementation:** Apply and tick every item under _Specification changes_.
- **Acceptance criteria:**
    - [ ] Every item under _Specification changes_ is applied and ticked.
    - [ ] `bun run plans:check` and `bun run plans:task specification/plans/web-ml-phase-2-training-setup.md --check-complete` pass.
- **Verification:** `bun run plans:check specification/plans/web-ml-phase-2-training-setup.md`; `bun run plans:task specification/plans/web-ml-phase-2-training-setup.md --check-complete`; `bun run check`.
- **Progress:** [ ] Not started

## Verification and definition of done

- [ ] All task acceptance criteria met, with test names starting with their `WML-P2-*` IDs.
- [ ] `bun run check`, `bun run build`, `bun run test:stories`, and all listed Playwright E2E tests pass in Chromium, Firefox, and WebKit.
- [ ] `bun run format <changed files>` run on all edited files.
- [ ] Manual checks recorded in the log: VoiceOver (Safari) reads Strategy select, Folds range/number pair, fold-matrix table headers/cells (`Run`, fold number, `Training`/`Validation`), and help modal; NVDA or Orca equivalent if available, otherwise explicitly stated as not verified.
- [ ] Every _Specification changes_ item is ticked and synced; no changes outside the tasks' likely files.

## Risks and open questions

- **Blocking:** None
- **Non-blocking:** Phase 2 depends on Phase 1 (`specification/plans/web-ml-phase-1-configure-model.md`, currently `ready`) being implemented first so Section 3, `hyperparameters.styles.ts`, `parameter-scale.ts`, `SECTION_ORDER`, and `app-model-builder-view.stories.ts` exist on disk.
- **Non-blocking:** `node_modules/web-ml/dist/src/training/cross-validate.d.ts` is missing in the stale installed `dist/` while present in `../web-ml/dist/src/training/cross-validate.d.ts`. Phase 2 imports no `web-ml` runtime exports; Phase 3 owns refreshing/deploying `web-ml`'s `dist/` assets.
- **Non-blocking:** Draft `03-5_train-models-4-configure-training.html` awaits human visual styling and promotion (`specification/HUMAN.md` §6), including optional non-colour cell markers for colour-blind users beyond the forced-colours dashed/solid distinction.

## Escalations

None.

## Review fixes

None.

## Implementation and verification log

| When (UTC)           | Task | Agent (model)                            | Outcome / commands / evidence                                                                                                                                                                                                                                               |
| -------------------- | ---- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-17T21:23:45Z | —    | Google Antigravity (Gemini 4 Argon High) | Split Phase 2 from `web-ml-classification-integration.md`; scout-verified `ValidationMethodology`, `NestedCrossValidationRequest`, and existing test fixtures.                                                                                                              |
| 2026-11-18T08:34:14Z | —    | Google Antigravity (Gemini 4 Argon High) | Adopted single fold-count mapping (`outerFolds = innerFolds = folds`) and fixed 80/20 `one_shot` holdout split (`testRatio: 0.2, randomState: 42`).                                                                                                                         |
| 2026-11-19T16:53:37Z | —    | Google Antigravity (Gemini 4 Neon High)  | Addressed all 3 BLOCKER and 4 MAJOR findings from the 2026-11-19T15:44:17Z review after three `codebase-scout` passes, user decisions (A1–A3), and `modern-web-guidance` retrieval (`forms`, `accessible-error-announcement`, `responsive-table`). No product code changed. |

## Plan review history

| Reviewed (UTC)       | Agent (model)                           | Decision          | Findings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------- | --------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-19T15:44:17Z | Google Antigravity (Gemini 4 Neon High) | changes-requested | BLOCKER: unresolved blocking question & stale claim that web-ml lacks crossValidate (shipped in web-ml@0.1.0); BLOCKER: D1 vs §A ValidationMethodology type contradiction and unspecified STORAGE_VERSION/v1->v2 migration runner (persister/scroll); BLOCKER: unresolved Section 4 submit/completion fork and undeclared Phase 1 prerequisite; MAJOR: unspecified SetupLabels/i18n/maxFolds/blockedReason/invalid-input handling, missing app-model-builder-view.stories.ts, unaddressed models-setup.e2e.ts conflict, incomplete T1 fixtures & ACs. |
| 2026-11-19T17:13:05Z | Codex (gpt-6.2-astra)                   | changes-requested | BLOCKER in T1: an incompatible setup can erase the active IndexedDB dataset on restart or rollback. MAJOR findings in T1–T3 cover metadata readiness, split feasibility, content error handling, accessible controls and per-model form state. T4 leaves a conflicting default. See the evidence and revision criteria below.                                                                                                                                                                                                                         |

### Evidence for the 2026-11-19 Codex review

- **BLOCKER — T1, persisted data.** D2 and `WML-P2-STATE-1` discard the whole state for one invalid setup. On rollback the existing reader also rejects a valid new `one_shot` record (`src/stores/persister.ts:257`, `:381`). Startup passes a null dataset ID to orphan cleanup, which clears metadata, raw rows and model results (`src/stores/reconciler.ts:135`, `src/common/storage/db.ts:100`). A version bump alone protects only the localStorage key. Specify a representation or rollout the older reader can handle, define recovery for the affected model, and test upgrade, malformed setup and rollback with a populated IndexedDB.
- **MAJOR — T1/T3, eligibility at submit.** §A accepts ten folds when statistics are null. The builder loads them asynchronously and the store also returns null on error (`src/features/models/app-model-builder-view.ts:242`, `src/stores/dataset.store.ts:119`). §D also emits two folds on a strategy switch when the permitted maximum is zero. Require current dataset and target statistics before persisting a fold choice or completing Section 4. Cover loading, failed read, retry and a blocked strategy change.
- **MAJOR — T1/T2, split contracts.** With four minority rows and four outer folds, each outer training partition has only three minority rows for four stratified inner folds (`web-ml/dist/src/training/cross-validation.d.ts:60`, `:151`). Distinguish eligibility for manual CV from eligibility for tuning and test that boundary. The public train request accepts prepared data (`web-ml/dist/src/training/types.d.ts:602`), and evaluation requires a separate holdout (`web-ml/specification/public-api/metrics.md:36`). The scout found no public stratified 80/20 split contract. Treat the ratio and seed as configuration and identify the upstream dependency for Phase 3 before promising executable holdout behaviour.
- **MAJOR — T2, help error handling.** §B maps every `NOT_FOUND` to a missing help topic. The loader also uses that code for failed HTTP responses and invalid fragment media types (`src/common/content/content-loader.ts:127`, `:169`, `:281`). Existing `CNT-E2E-3` expects the generic load error for an unavailable index on `/about` (`tests/content.e2e.ts:85`). Distinguish a missing slug in a successfully loaded index from delivery failures. Cover both on a help route and retain the static-route test.
- **MAJOR — T2/T3, accessibility.** §C and §D defer visible non-colour cues to forced-colours mode and hide the cell text. Distinguish training and validation visibly in both cells and legend in ordinary display mode too (`specification/COMPONENTS.md:155`). §E and `WML-P2-UI-4` pair visible “Edit” with the accessible name “Reopen Training Setup”. Include “Edit” in the accessible name and assert it. See [WCAG use of colour](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html) and [label in name](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html).
- **MAJOR — T3, switching models.** §D clears an invalid fold draft when the strategy changes to One-Shot. Sidebar navigation can reuse the same builder for two CV models (`src/app.ts:70`, `src/features/shell/app-sidebar.ts:423`). Scope the edit state to the model and test navigating from an invalid draft on model A to a saved, valid fold count on model B.
- **MINOR — T4, specification sync.** Include `specification/app-state-and-navigation.md` §6.3 in the sync. Line 328 still calls Section 4 a placeholder and selects nested CV by default, which conflicts with §D's initial One-Shot choice.

The scout checked the catalogue JSON, public declarations and prose in the primary checkout’s sibling `web-ml` and its installed package, both version 0.1.0. Only the sibling supplied the fixed-CV declaration. The review worktree had neither upstream location. Phase 1 is an explicit implementation prerequisite. T1–T4 have named files, boundaries and Bun commands. The revision needs the negative and boundary cases above. Worker messages and new IndexedDB stores are outside Phase 2. The repository has no additional decision checklist.

## Change log

| When (UTC)           | Change                                            | Reason                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-17T21:23:45Z | Initial draft                                     | Created Phase 2 plan (Step 4 Training Setup: one-shot vs nested cross-validation fold count, moving fold sizes to `FUTURE.md`) from the multi-phase split of `web-ml-classification-integration.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-11-18T08:34:14Z | Adopt fold-count and one-shot split policy        | User confirmed mapping the single fold-count option to `outerFolds`/`innerFolds` and adopting the fixed 80/20 holdout split for One-Shot Training.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-11-19T08:47:35Z | Renumbered cross-references                       | Tuning renumbered to Phase 7; Phase 7 reuses the outer folds of manual cross-validation so tuned and manual models stay comparable. No change to this phase's contract.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-11-19T16:53:37Z | Address changes-requested review & user decisions | Resolved all review blockers/majors: verified `web-ml` `crossValidate` contract and cleared blocking question; unified `ValidationMethodology` literal types and kept `STORAGE_VERSION = 1`; declared Phase 1 prerequisite; adopted updated `03-5` Strategy `<select>` + `.field--folds` + live fold-matrix visual (fixed `randomState: 42`, Random Seed & Missing Values to `FUTURE.md`); added dynamic `/help/*` reserved route and `training-setup.md`; resolved pre-Phase-3 `Train Model` completion (`status: 'draft'`); closed `TrainingSetupLabels`, `maxFolds`/`blockedReason`, `badInput` handling, stories, and affected test fixtures/E2E updates. |
