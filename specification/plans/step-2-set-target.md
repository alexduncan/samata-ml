# Step 2: Set Target

**Status:** draft | **Updated:** 2026-11-13T10:22:14Z

## Goal

**Current behaviour:** Navigating to `/target` renders a placeholder stub inside `src/app.ts`. `src/stores/app.store.ts` already implements `setTarget(column)` and `confirmDiscardModels()`, and `src/stores/predicates.ts` exposes `$hasDataset` and `blockedReason('/target', state)`, but no view component inspects dataset metadata for column eligibility/notes, renders the column table, shows the model-reset alert banner, or asks for confirmation before discarding existing models. Unresolved human questions (`TODO-11`, `TODO-16`, `TODO-17`, `TODO-35`, `TODO-53`) and missing `src/i18n.ts` block final implementation decisions.

**Target behaviour:** Render a connected `<app-target-view>` route component for `/target` that:

1. Displays a blocked-state alert notification with navigation back to `/data` when `!$hasDataset` (`blockedReason === 'DATASET_REQUIRED'`).
2. Lists every dataset column (`Column Name`, `Type`, `Notes`, and `Set as Target` / current-target action) from `state.dataset` enriched with `DatasetMetadata` and optional `SampleDatasetDescriptor` hints.
3. Prevents selecting ineligible columns (`text`, `datetime`, zero-variance, or all-missing columns per final `TODO-11` rules) with clear inline notes and disabled actions.
4. Shows a warning banner when `$appState.get().models.length > 0` (`02-2_target-set.html`) and requires confirmation via a native `<dialog>` modal (`confirmDiscardModels()` + `setTarget(column)`) when selecting a _different_ target while models exist.
5. Emits semantic, token-compliant Lit styles matching `02-1_set-target.html` / `02-2_target-set.html` with all accessibility deviations recorded and real-browser verification.

**Why:** Step 2 determines the supervised prediction target and downstream task type (classification vs regression), so the UI must guide users away from unsuitable columns (identifiers, free text, datetime, constant/empty columns) and protect existing model work against accidental target resets.

## Scope

**In scope**

- Connected route view `<app-target-view>` (`src/features/target/app-target-view.ts`) mounted by `src/app.ts` for `/target`, including `whenSettled(): Promise<void>`.
- Blocked-state empty UI (`DATASET_REQUIRED`) aligned with `app-state-and-navigation.md` §4.3 and `03-1_train-models-disabled.html` `.notification.notification-alert` styling.
- Target selection table (`table.styles.ts` / `notification.styles.ts` decision per `TODO-35`), column eligibility & notes derivation (`ColumnStats`, `isModelEligibleColumnType`, `SampleDatasetDescriptor`), selected-target indicator, model-reset warning banner, and native `<dialog>` confirmation flow.
- Wiring `src/app.ts` `/target` route branch and adding `/target` Playwright parity (`visual-parity.e2e.ts`), accessibility (`a11y.e2e.ts`), and Step 2 E2E acceptance tests (`tests/target-selection.e2e.ts`).
- `bun:test` unit coverage for pure column-eligibility / notes derivation helpers and store/view integration edge cases.

**Out of scope**

- Modifying `src/stores/app.store.ts` `setTarget` core validation (`isModelEligibleColumnType` migration belongs to `data-ingestion-and-storage.md` T1), except any explicitly approved archive or trained-only vs draft-model rule change under `TODO-17`.
- Implementing `src/i18n.ts` (`COMPONENTS.md` §8 prerequisite), `SampleDatasetDescriptor` / `DatasetMetadata` IndexedDB storage (`data-ingestion-and-storage.md`), or `app-sidebar.ts` target step summary (`state-navigation-conformance.md` / `scaffolding-visual-remediation`).
- Virtualising the `/target` column table (column counts are capped at 256 by ingestion guards in `data-ingestion-and-storage.md`, unlike row tables).
- Creating a shared confirmation modal component across Step 1 and Step 2 before a third call site or component spec exists (`COMPONENTS.md` §3).
- Modifying `specification/mockups/**` or `../web-ml`.

**Constraints and invariants**

- **Lowest tier & store isolation (`COMPONENTS.md` §2, §5):** `<app-target-view>` is Tier 3 (`src/features/target/`, connected route view via `StoreController`); only connected components import `$appState`, `$hasDataset`, `setTarget`, `confirmDiscardModels`, `getStorageClient()`, and `loadSampleDescriptor()`. Pure column-notes/eligibility helpers take plain data inputs (`ColumnSummary`, `DatasetMetadata | null`, `SampleDatasetDescriptor | null`) and never touch IndexedDB or stores.
- **Public API closed (`COMPONENTS.md` §3):** `<app-target-view>` exposes only `whenSettled(): Promise<void>` and is mounted by `src/app.ts`; no unlisted public properties, slots, parts, CSS custom properties, or leaked internal state.
- **No arrow-function event wrappers (`COMPONENTS.md` §4):** Row action buttons bind `data-column=${col.name}` and invoke a bound prototype method (`@click=${this.handleSelectTargetClick}`) reading `(e.currentTarget as HTMLButtonElement).dataset.column`.
- **Navigation invariant (`app-state-and-navigation.md` §6.2):** Selecting the _already active_ target (`state.target === column`) succeeds silently without opening the discard modal or mutating models; selecting a _different_ target while models exist prompts before clearing models. `setTarget(column)` handles post-selection state while navigation stays declarative (`<a href="/models">`) or follows the finalised Step 2 navigation decision.
- **Token & style rules (`css/root.css`, `tests/style-tokens.test.ts` `TOK-1`–`TOK-4`):** Use only tokens from `css/root.css`, with no fallbacks, no literal hex/rgb colours (except importing `dialogStyles` backdrop), logical properties (`margin-block`, `padding-inline`), `:host { display: block; }` + `:host([hidden]) { display: none; }`, and no `<style>` tags in templates. Never add new files to `KNOWN_DRIFT`.
- **Accessibility & i18n (`COMPONENTS.md` §7–§8):** WCAG 2.2 AA contrast (notably verifying `.notification-alert` text/icon contrast against `--amber-100`), keyboard focus restoration when closing the confirmation `<dialog>`, semantic `<caption>`/`<th scope="col">`, descriptive accessible names for per-row `Set as Target` buttons, and `@nanostores/i18n` messages via `src/i18n.ts`.

## Required reading

The implementer reads only these, plus each task's likely files.

- `specification/workflow-steps.md` §2 — Set Target user workflow, table columns (`Dataset Column Name`, `Column Type`, `Notes`, action) and warning notification.
- `specification/app-state-and-navigation.md` §4.2–§4.3, §5.4–§5.5, §6.2, §6.4 — `/target` blocked matrix (`DATASET_REQUIRED`), native modal lifecycle, `whenSettled()`, and confirm-and-discard target change contract.
- `specification/state-and-storage.md` §3, §5 — `DatasetSummary`, `ColumnSummary`, `ColumnType`, and persistence rules.
- `specification/COMPONENTS.md` §1–§9 — tiers, closed APIs, Lit decorators/controllers, styles, accessibility, and `@nanostores/i18n`.
- `specification/visual-design.md` §1–§6 — mockup mapping (`table.css`, `notifications.css`, `badges.css`, `button.css`), token rules, `A11Y-*`/`SEM-*` registers, and parity/Axe test requirements.
- `specification/plans/data-ingestion-and-storage.md` (Technical decisions & Interfaces) — `ColumnType` (`'datetime'`), `isModelEligibleColumnType`, `DatasetMetadata` (`ColumnStats`), and `SampleDatasetDescriptor` (`modeling.targetCandidates`, `columns`).
- `specification/plans/state-navigation-conformance.md` (D5, D6, D7) — `blockedReason('/target', state)`, scroll reset on `/target` -> `/models`, and `setTarget` behaviour.
- `specification/mockups/ui-scaffold/02-1_set-target.html`, `02-2_target-set.html`, `03-1_train-models-disabled.html`, `specification/mockups/ui-scaffold/css/table.css`, `notifications.css`, `badges.css` — visual baseline.
- `css/root.css`, `css/notifications.css`, `css/table.css`, `css/badges.css` — canonical CSS tokens and scaffold stylesheets.

## Codebase context

- **Relevant implementation:**
    - `src/app.ts` currently renders a `<main>` heading + placeholder copy for `/target` when dataset is loaded (exact lines in `src/app.ts` `renderWorkflowView()`), and sits in `tests/style-tokens.test.ts` `KNOWN_DRIFT`.
    - `src/stores/app.store.ts` already implements `setTarget(column)` (note: currently checks `col.type === 'text'`, pending `data-ingestion-and-storage.md` T1 update to `!isModelEligibleColumnType(col.type)`, and rejects when `state.models.length > 0 && state.target !== column`) and `confirmDiscardModels()` (clears `models` and resets `nextModelNum = 1`).
    - `src/stores/predicates.ts` exports `$hasDataset` and `blockedReason('/target', state)` (`'DATASET_REQUIRED' | null`).
    - `src/types/state.ts` defines `ColumnType` (`'numeric' | 'categorical' | 'boolean' | 'text'`, with `'datetime'` + `isModelEligibleColumnType` added by `data-ingestion-and-storage.md` T1) and `DatasetSummary`.
    - `src/styles/global.ts` adopts `buttonStyles`, `chicletStyles`, `dialogStyles`; no `table.styles.ts` or `notification.styles.ts` exists yet.
    - `src/i18n.ts` does **not** exist yet (`COMPONENTS.md` §3, §8).
- **Tests and commands:**
    - Baseline verified 2026-11-13: `bun run check` passes (0 type errors, 52 passing tests across 6 files); `bun run test:e2e --list` discovers 54 tests across `a11y.e2e.ts`, `app-shell.test.ts` and `visual-parity.e2e.ts`.
    - `tests/style-tokens.test.ts` enforces `css/root.css` tokens, no fallbacks, no literal colours (`TOK-2`), and no `<style>` in HTML templates (`TOK-4`).
    - `tests/visual-parity/map.ts` maps `02-1_set-target.html` and `02-2_target-set.html` to `/target`, and `tests/visual-parity.e2e.ts` navigates directly to `/target` with clean storage (so both entries currently lack seeded dataset/models state).
- **Web guidance:** **Unverified in this session:** `bunx modern-web-guidance` requires network access (`DNSResolveFailed` inside sandbox). Run `bunx modern-web-guidance query "responsive-table"` and `"dialog"` / `"accessible tables"` before approving this plan to `ready`.
- **Visual reference:**
    - `02-1_set-target.html` (`base.css`, `table.css`, `button.css`): renders `<header class="page-header">` (`<h1>Set Target</h1>`, description + `<a href="">learn more...</a>`) and a 3-column `<table class="table">` (`Column Name`, `Type` with `<code>` pills `String`/`Number`/`Categorical`/`Boolean`, action column with `<button class="btn btn-primary">Set as Target</button>`). **Gap:** omits the `Notes` column specified by `workflow-steps.md §2` and has no empty-state mockup.
    - `02-2_target-set.html`: adds `<section class="notification notification-alert" role="alert">` above the table (`#alert` icon + `"Changing the target variable after you train a model will reset your trained models."`). **Deviations & gaps:** uses stale sidebar links `/load-data` and `/compare-results`; omits visual styling for the _currently selected_ target row; no `02-0` empty-state mockup exists (`03-1_train-models-disabled.html` supplies the canonical `.notification.notification-alert` blocked banner pattern).
    - Note: Only source HTML and CSS files were inspected (`css/notifications.css`, `css/table.css`, `css/badges.css`, `02-1`, `02-2`, `03-1`); neither `02-1` nor `02-2` was visually screenshotted here.
- **Lit skills:** implementers use `lit-implementer` for all Lit component, style module, and test tasks.
- **Known gaps decided:**
    - **Gap 13 (`css/` vs `src/styles/`):** New Step 2 component styles must use `css/root.css` tokens only (no literal `#e5f1ff`/`#0050b3` from `css/notifications.css` `.notification-info`); do not add Step 2 files to `KNOWN_DRIFT`.
    - **Gap 14 & 15 (`state-navigation-conformance.md`):** `/target` readiness and blocked state use `blockedReason('/target', state)` and `$appState`; scroll snapshots clear on route change per D6.
    - **Gap 17 (Playwright discovery):** Name browser tests `tests/target-*.e2e.ts` so `playwright.config.ts` picks them up.
- **Assumptions requiring verification:**
    - `data-ingestion-and-storage.md` (`draft`) lands `ColumnType` (`'datetime'`), `isModelEligibleColumnType`, `DatasetMetadata` (`ColumnStats`), and `SampleDatasetDescriptor` before Step 2 implementation starts.
    - `state-navigation-conformance.md` (`draft`) lands updated `/target` route/scroll plumbing before T2.
    - `src/i18n.ts` (`@nanostores/i18n`) is created by a shared prerequisite task before UI components reference it.
    - Playwright browser binaries are installed on the implementation machine (only `--list` verified in this environment).

## Technical decisions

| Decision                                          | Chosen approach and rationale                                                                                                                                                                                                                                                                                                                                                                     | Rejected alternative / trade-off                                                                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component tier & file placement                   | One Tier 3 connected element `<app-target-view>` in `src/features/target/app-target-view.ts`, plus a pure helper module `src/features/target/target-eligibility.ts` (zero DOM/store imports) and an inline native `<dialog>` for discard confirmation.                                                                                                                                            | Extracting a tiny row or modal component before 3 spec'd call sites exist (`COMPONENTS.md` §3) or leaking IndexedDB/store imports into Tier 2.            |
| Target eligibility & `Notes` column (`TODO-11`)   | **Blocking:** Confirm exact column table shape (`Column Name`, `Type`, `Notes`, action vs mockup's 3 columns), exact `Notes` copy, and disqualifying conditions (`text`, `datetime`, zero-variance / single distinct value, 100% missing, `identifier` role, `leakyColumns` warnings, sample `targetCandidates`).                                                                                 | Guessing disqualification rules or leaving free-text/constant columns selectable (which breaks training workers in `web-ml`).                             |
| Empty-state `/target` notification (`TODO-16`)    | **Blocking:** Render `.notification.notification-alert` with guidance link to `/data` (matching `03-1_train-models-disabled.html` and `app-state-and-navigation.md` §4.3); confirm with human whether a dedicated banner design or copy overrides `TODO-16`.                                                                                                                                      | Silently reusing Step 3 copy without answering whether `/target` uses a dedicated warning bar vs shared `.notification`.                                  |
| Model reset on target change (`TODO-17`)          | **Blocking:** Keep `app-state-and-navigation.md` §6.4 confirm-and-discard modal (`confirmDiscardModels()` + `setTarget(col)`), and confirm with human between confirm-and-discard vs hard lock vs archiving models, AND whether _draft_ (`models.length > 0`) vs _trained_ (`trainedModels.length > 0`) triggers the alert banner (`app.store.ts` currently blocks whenever `models.length > 0`). | Bypassing confirmation and wiping trained models on click, or blocking on `draft` models if the UI banner only mentions trained models without alignment. |
| Type presentation, selected state & "learn more"  | **Blocking:** Decide between mockup `<code>` pill (`<code>Numeric</code>`) vs `.chiclet` type tag (Step 2 stub), clarify visual appearance of the _already-selected_ target row (disabled button `"Current Target"` / `#check` vs badge), and decide the target/removal of `<a href="">learn more...</a>` in `02-1`/`02-2`.                                                                       | Shipping an empty `<a href="">` link (invalid navigation and `SEM` risk) or inventing unapproved badge colours.                                           |
| Shared `.table` & `.notification` CSS (`TODO-35`) | Decide cleanly via `TODO-35` whether `tableStyles` (`src/styles/table.styles.ts`) and `notificationStyles` (`src/styles/notification.styles.ts`) are extracted into `src/styles/` for shared adoption by Step 1, Step 2 and Step 3, replacing literal colours and verifying `--amber-700` vs `--stone-900` WCAG 2.2 AA contrast on `--amber-100`.                                                 | Duplicating identical `.table` and `.notification` rules inside Step 1, Step 2 and Step 3 component stylesheets.                                          |
| i18n setup                                        | **Blocking:** Import UI strings from `src/i18n.ts` (`@nanostores/i18n`, `COMPONENTS.md` §8); requires prerequisite i18n setup before components compile.                                                                                                                                                                                                                                          | Hard-coding untranslated English literals inside component templates.                                                                                     |
| Parity & Axe verification                         | Extend `tests/visual-parity.e2e.ts` so `02-1_set-target.html` seeds a dataset with no target, and `02-2_target-set.html` seeds a dataset + trained model so both Step 2 parity entries and Axe scans exercise real rendered tables and alert banners.                                                                                                                                             | Auditing `/target` only in its unseeded empty state while marking `02-1` / `02-2` parity complete.                                                        |

### Interfaces and behaviour

**State placement (`COMPONENTS.md` §5, `state-and-storage.md` §5):**

- **Persisted (`$appState`):** Reads `state.dataset`, `state.target`, `state.models`. Mutates only via `setTarget(column)` and `confirmDiscardModels()`. Blocked status computed via `blockedReason('/target', state)` / `$hasDataset`.
- **IndexedDB & sample metadata (loaded inside `app-target-view` on `dataset.id` change):** `getStorageClient().getMetadata(datasetId)` -> `DatasetMetadata | null` (`columns[name]` gives `distinctCount`, `missingCount`, `identifierHint`), and if `dataset.source === 'sample'`, `loadSampleDescriptor(datasetId)` -> `SampleDatasetDescriptor | null` (`columns` roles/descriptions, `modeling.targetCandidates`).
- **Transient `@state` inside `<app-target-view>`:**
    - `private accessor metadata: DatasetMetadata | null = null;`
    - `private accessor descriptor: SampleDatasetDescriptor | null = null;`
    - `private accessor metadataStatus: 'idle' | 'loading' | 'ready' | 'error' = 'idle';`
    - `private accessor pendingTargetColumn: string | null = null;` (non-null opens confirmation `<dialog>` via `showModal()` when switching to a different column with existing models)

**Component & pure helper signatures (provisional until blocking TODOs resolve):**

```ts
// src/features/target/target-eligibility.ts
export interface TargetColumnRow {
	name: string;
	type: ColumnType;
	eligible: boolean;
	isCurrentTarget: boolean;
	/** Ineligibility reason or advisory notes (identifier hint, missing values, sample candidate note). */
	notes: string[];
	/** Diagnostic reason code so the view localises notes via src/i18n.ts without hardcoding copy in the helper. */
	reasonCodes: TargetNoteCode[];
}

export type TargetNoteCode =
	| 'INELIGIBLE_TEXT'
	| 'INELIGIBLE_DATETIME'
	| 'INELIGIBLE_ALL_MISSING'
	| 'INELIGIBLE_CONSTANT'
	| 'ADVISORY_IDENTIFIER'
	| 'ADVISORY_MISSING_VALUES'
	| 'ADVISORY_TARGET_CANDIDATE';

export function buildTargetRows(
	dataset: DatasetSummary,
	currentTarget: string | null,
	metadata: DatasetMetadata | null,
	descriptor: SampleDatasetDescriptor | null
): TargetColumnRow[];
```

- **`<app-target-view>` (`src/features/target/app-target-view.ts`, Tier 3 connected):**
    - **Public API:** only `whenSettled(): Promise<void>` (resolves once any active `getMetadata` / `loadSampleDescriptor` lookup completes for the current `dataset.id`).
    - **Internal behaviour:**
        - If `!hasDataset`: renders blocked header (`Set Target`) and `<section class="notification notification-alert" role="alert">` with guidance copy and `<a href="/data">` CTA.
        - If `hasDataset`: renders header; renders reset-warning `.notification.notification-alert` when models exist; renders `<table class="table">` with `<caption>` (visually hidden or table heading), `<thead>` (`<th scope="col">`), and rows built from `buildTargetRows(...)`.
        - Each eligible row button carries `data-column=${row.name}`, unique `aria-label` or `aria-describedby` distinguishing buttons (e.g. `"Set {column} as target"`, `SEM-07` / WCAG 2.4.6), and `disabled` when ineligible (with note in `Notes` cell) or when `row.isCurrentTarget` (subject to confirmed selected-state UX).
        - Clicking a different eligible column while `models.length > 0` sets `pendingTargetColumn = colName`, opens native `<dialog>` with `showModal()`, returns focus to the triggering button on Cancel (`close` / `Escape`), or calls `confirmDiscardModels()` + `setTarget(colName)` on Confirm.
- **Accessible names, semantics & strings:**
    - `<caption>` or `aria-labelledby` on column table, `<th scope="col">` headers (`SEM-07`), `.visually-hidden` alert icon (`aria-hidden="true"` per `SEM-08`), explicit accessible action label per column (`"Set {column} as target"` vs `"Selected target: {column}"`), native modal `<dialog aria-labelledby="...">` (`SEM-04`).
    - All visible text and `reasonCodes` formatting live in `src/i18n.ts`.

## Specification changes

What `specification/` must say once this plan is implemented. The final task applies these items and ticks each one; `task_gate.py --check-complete` refuses to close the plan while any is unticked.

- [ ] `specification/workflow-steps.md` §2 — update column type vocabulary (`numeric`, `categorical`, `boolean`, `datetime`, `text`), target eligibility rules, `Notes` column content, and post-selection / `"learn more"` behaviour to match implementation.
- [ ] `specification/app-state-and-navigation.md` §4.3, §6.2, §6.4 — confirm `/target` `DATASET_REQUIRED` notification presentation, selected-target row state, and whether draft vs trained models trigger target-change discard confirmation.
- [ ] `specification/visual-design.md` §3, §5, §6 — record approved `table.styles.ts` / `notification.styles.ts` placement, `.notification-alert` contrast token adjustment if needed, selected-row / `Notes` column deviations relative to `02-1`/`02-2`, and Step 2 parity/Axe coverage.
- [ ] `specification/TODO.md` — resolve TODO-11 (target eligibility & `Notes`), TODO-16 (`/target` empty state & notification), TODO-17 (target-change model reset/archive behaviour), and narrow TODO-35 (`table.css`/`notifications.css` placement) and TODO-53 (if `.notification-alert` contrast is closed here).

## Implementation tasks

### T1 — Resolve Step 2 target rules, visual deviations, and shared styles

- **Depends on:** Human answers for `TODO-11`, `TODO-16`, `TODO-17`, selected-target/"learn more" decisions, `TODO-35` (`.table` / `.notification` style ownership), `bunx modern-web-guidance` checks, and `src/i18n.ts` availability.
- **Risk:** needs care — locks column eligibility rules and shared CSS modules used across Step 1, Step 2, and Step 3.
- **Likely files:** `specification/workflow-steps.md`, `specification/app-state-and-navigation.md`, `specification/visual-design.md`, `src/styles/table.styles.ts` (if approved), `src/styles/notification.styles.ts` (if approved), `src/i18n.ts` (Step 2 strings), `specification/plans/step-2-set-target.md`.
- **Must not touch:** Mockup files in `specification/mockups/**`, `../web-ml`, or `css/root.css` without explicit token approval.
- **Implementation:** Record finalised answers in specs, author any approved shared `tableStyles` / `notificationStyles` in `src/styles/` using `css/root.css` tokens only (fixing `.notification-info` `#e5f1ff`/`#0050b3` literal hexes and verifying `.notification-alert` WCAG AA contrast), and add Step 2 i18n keys.
- **Acceptance criteria:**
    - `STYLE-TARGET-1`: `bun test tests/style-tokens.test.ts` passes with zero literal colour or unknown token violations on new style modules.
    - Specs (`workflow-steps.md` §2, `app-state-and-navigation.md` §6.2) contain no unresolved conflicts with `data-ingestion-and-storage.md` (`datetime`, `isModelEligibleColumnType`).
- **Verification:** `bun run format <changed files> && bun run check`.
- **Progress:** not started

### T2 — Implement pure target-eligibility helper and `<app-target-view>` route component

- **Depends on:** T1, `data-ingestion-and-storage.md` (`DatasetMetadata`, `SampleDatasetDescriptor`, `isModelEligibleColumnType`), `state-navigation-conformance.md` (`/target` routing & scroll reset).
- **Risk:** needs care — handles metadata async loading (`whenSettled()`), discard confirmation `<dialog>` focus restoration, and model-reset invariants.
- **Likely files:** `src/features/target/target-eligibility.ts`, `src/features/target/app-target-view.ts`, `src/app.ts` (replace `/target` placeholder with `<app-target-view>`), `tests/target-eligibility.test.ts`.
- **Must not touch:** `src/stores/app.store.ts` core schema/persister outside approved `TODO-17` delta, `src/features/navigation/app-sidebar.ts`, `tests/style-tokens.test.ts` `KNOWN_DRIFT`.
- **Implementation:** Write `buildTargetRows()` covering `isModelEligibleColumnType`, zero-variance / all-missing stats, `identifierHint`, sample `targetCandidates`, and `missingCount` diagnostics with full TSDoc. Implement `<app-target-view>` (using `lit-implementer`) subscribing to `$appState` & `$hasDataset`, loading metadata/descriptor cleanly without race conditions when `dataset.id` changes, exposing `whenSettled()`, rendering `DATASET_REQUIRED` notification, warning alert banner, semantic column table, and `<dialog>` discard confirmation modal (`showModal()`, focus restore on cancel, `confirmDiscardModels()` + `setTarget(col)` on confirm). Mount `<app-target-view>` in `src/app.ts`.
- **Acceptance criteria:**
    - `TARG-UNIT-1` (`bun:test`): `buildTargetRows` marks `text`, `datetime`, constant (`distinctCount <= 1`), and all-missing columns ineligible with expected `reasonCodes`, flags identifier/missing advisories, and flags `isCurrentTarget`.
    - `TARG-STATE-1`: Calling `whenSettled()` resolves only after active metadata/descriptor promises finish.
    - `TOK-1`–`TOK-4`: `tests/style-tokens.test.ts` passes with zero errors and no new `KNOWN_DRIFT` entries.
- **Verification:** `bun test tests/target-eligibility.test.ts tests/style-tokens.test.ts && bun run check`.
- **Progress:** not started

### T3 — Browser acceptance, visual parity, and Axe verification for `/target`

- **Depends on:** T2.
- **Risk:** straightforward — extends Playwright suites to cover empty, ready, model-warning, confirmation dialog, and parity/Axe gates.
- **Likely files:** `tests/target-selection.e2e.ts`, `tests/visual-parity/map.ts`, `tests/visual-parity.e2e.ts`, `tests/a11y.e2e.ts`.
- **Must not touch:** Application production code (`src/**`) unless fixing a defect uncovered by tests.
- **Implementation:** Update `visual-parity.e2e.ts` / `map.ts` so `02-1_set-target.html` and `02-2_target-set.html` parity checks seed matching dataset/models state. Add `tests/target-selection.e2e.ts` covering: `TARG-E2E-1` (`!hasDataset` blocked notification + `/data` navigation), `TARG-E2E-2` (table columns, ineligible disabled rows, selecting eligible target updates `$appState.target`), `TARG-E2E-3` (warning banner + `<dialog>` cancel preserves models & restores focus; confirm discards models and updates target; re-selecting same target does not prompt), `TARG-E2E-4` (320px width, 200% zoom, long column names, RTL layout). Update `tests/a11y.e2e.ts` to audit `/target` across empty, loaded, warning banner, and open confirmation modal states in Chromium, Firefox, and WebKit.
- **Acceptance criteria:**
    - `TARG-E2E-1`..`4` pass across Chromium, Firefox, and WebKit (`playwright.config.ts` projects).
    - `visual-parity.e2e.ts` entries for `02-1` and `02-2` match screenshots or approved documented deviations (`A11Y-*`/`SEM-*`).
    - `a11y.e2e.ts` reports 0 WCAG 2.2 AA Axe violations on `/target` states.
- **Verification:** `bun run check && bun run test:e2e tests/target-selection.e2e.ts tests/visual-parity.e2e.ts tests/a11y.e2e.ts && bun run build`.
- **Progress:** not started

### T4 — Sync specification

- **Depends on:** T3 verified passing cleanly.
- **Risk:** straightforward — documentation sync matching built code and decisions.
- **Likely files:** `specification/workflow-steps.md`, `specification/app-state-and-navigation.md`, `specification/visual-design.md`, `specification/TODO.md`, `specification/README.md`, `specification/plans/step-2-set-target.md`, `specification/plans/README.md`.
- **Must not touch:** `src/`, `css/`, `tests/`, `specification/mockups/**`.
- **Implementation:** Re-read shipped files in `src/features/target/`, `src/styles/`, and `tests/target-selection.e2e.ts`; update every spec listed under `## Specification changes` (marking status headers `implemented` only if implemented behaviour satisfies the full file, or documenting remaining Step 3–4 items accurately); resolve answered items in `specification/TODO.md`; tick every `- [ ]` box in `## Specification changes`; run `bun run plans:check` and `bun run format`.
- **Acceptance criteria:**
    - Every `## Specification changes` checkbox is `- [x]` and matches the shipped implementation word for word.
    - `bun run plans:check specification/plans/step-2-set-target.md` passes.
- **Verification:** `bun run format <changed files> && bun run plans:check specification/plans/step-2-set-target.md && bun run check`.
- **Progress:** not started

## Verification and definition of done

- **Pre-ready prerequisites:** Human resolutions recorded for `TODO-11`, `TODO-16`, `TODO-17`, `TODO-35` (`.table`/`.notification` CSS), selected-row / `learn more...` behaviour, `src/i18n.ts` prerequisite, `bunx modern-web-guidance` checks (`responsive-table`, `dialog`), and prerequisite `data-ingestion-and-storage.md` / `state-navigation-conformance.md` schemas finalised.
- **Required automated gates before `implemented`:**
    - `bun run check` (`tsc --noEmit` + `bun test` — zero type errors and all unit tests passing).
    - `bun run test:e2e` in Chromium, Firefox, and WebKit covering `TARG-E2E-1`–`4`, `02-1`/`02-2` visual parity, and Axe WCAG 2.2 AA scans.
    - `bun run build` emits clean production bundle.
    - `bun run format <changed files>` + `bun run plans:check specification/plans/step-2-set-target.md`.
- **Manual / visual verification checklist:** VoiceOver keyboard navigation of `<table class="table">` (caption, `<th scope="col">`, action button labels) and confirmation `<dialog>` focus trap/restoration; forced-colours, 200% zoom, 320px narrow viewport, long unbroken column names, and `dir="rtl"` inspection.

## Risks and open questions

- **Blocking human question (`TODO-11`):** Must clarify why `02-1_set-target.html` & `02-2_target-set.html` omit the `Notes` column required by `workflow-steps.md §2` (`app-state-and-navigation.md §6.2`), what exact copy appears in `Notes` (including constant/empty columns, `identifierHint`, missing counts, and sample `targetCandidates`), and whether `text`/`datetime` rows show a disabled button (`app-state-and-navigation.md §6.2`) or empty cell.
- **Blocking human question (`TODO-16`):** Confirm `/target` blocked state uses shared `.notification.notification-alert` (as in `03-1`) + `/data` link rather than a separate warning-bar layout.
- **Blocking human question (`TODO-17`):** Choose between confirm-and-discard (`confirmDiscardModels()`, currently required by `app-state-and-navigation.md §6.4`), hard-locking `/target`, or archiving models per target — AND resolve whether changing target resets only `trained` models (matching `02-2` prose `"after you train a model"`) or _any_ draft model (`app.store.ts` currently checks `state.models.length > 0`).
- **Blocking visual/UX gaps (`02-1`, `02-2`):**
    - Mockups render types as `<code>String</code>` rather than `.chiclet` type badges mentioned in the prior stub.
    - Neither mockup shows visual styling for the _currently active target row_ nor resolves `<a href="">learn more...</a>` (and `02-2` contains stale links `/load-data`, `/compare-results`).
    - `css/notifications.css` `.notification-info` uses literal `#e5f1ff`/`#0050b3` (`TOK-2` violation if copied verbatim), and `.notification-alert` (`--amber-700` on `--amber-100`) needs WCAG 2.2 AA contrast verification against `TODO-53`.
- **Unverified web guidance & environment assumptions:** Sandbox blocks `bunx modern-web-guidance` DNS lookups; run them online prior to marking `ready`. `src/i18n.ts` does not exist yet.

## Implementation and verification log

| Date | Task | Outcome / commands run | Notes |
| ---- | ---- | ---------------------- | ----- |

## Change log

- `2026-11-13` — Replaced initial `stub` with full `draft` architectural plan adhering to `plan-template.md` and `lit-architecture`, documenting verified mockup/spec conflicts and blocking TODOs (`TODO-11`, `TODO-16`, `TODO-17`, `TODO-35`, `02-1`/`02-2` gaps, `src/i18n.ts`).
