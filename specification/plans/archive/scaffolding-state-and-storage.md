# Scaffolding: Application State and Persistence Layer

**Status:** archived | **Updated:** 2026-11-19T10:40:52Z

## Goal

**Current behaviour:** `src/types/state.ts` contains an obsolete placeholder (`PipelineState`) holding `csvData: any[]`. No Nanostores stores exist. State persistence to `localStorage` and reconciliation with IndexedDB are not implemented.

**Target behaviour:** State is structured into Nanostores atoms (`$appState`, `$scrollState`) and computed stores (`$hasDataset`, `$hasTarget`, `$canCompare`, `$trainedModels`). State mutations occur exclusively via exported action functions. A centralized persister writes synchronous state changes to `samata-ml:state` and debounced scroll snapshots to `samata-ml:scroll`. A startup reconciler executes checks 1–7 (dataset integrity, orphans, target validity, model validity, Web Lock training check) before the first render.

**Why:** Decoupled, headless state management ensures that navigation, deep linking, and UI views can resume the user's exact workflow state safely across browser reloads without risking `QuotaExceededError`.

## Scope

**In scope**

- Create `src/types/state.ts` implementing `PersistedAppState`, `ModelRecord`, `ColumnSummary`, `DatasetSummary`, `ScrollSnapshot`, and `PersistedScroll`.
- Implement `src/stores/app.store.ts` (`$appState` Nanostore with actions).
- Implement `src/stores/scroll.store.ts` (`$scrollState` Nanostore with actions).
- Implement `src/stores/predicates.ts` (computed availability stores).
- Implement `src/stores/persister.ts` (write scheduling, debouncing, and quota error handling).
- Implement `src/stores/reconciler.ts` (IndexedDB reconciliation and Web Lock training recovery).
- Unit tests in `tests/state-and-storage.test.ts` implementing criteria `NAV-AC-3` through `NAV-AC-10`.

**Out of scope**

- Vanilla TS Router and URL parsing (covered in `scaffolding-router-and-navigation.md`).
- Lit UI components (covered in `scaffolding-app-shell.md`).
- Data ingestion Web Worker implementation (covered in subsequent data feature plans).

**Constraints and invariants**

- Follow `specification/COMPONENTS.md §5`: Stores live in `src/stores/`, mutated strictly via action functions; components never call `store.set()` directly; reducers are pure and produce new object references.
- `localStorage` MUST NOT hold dataset rows, statistics, or per-row results (`specification/state-and-storage.md §2`).
- Storage adapter must be injectable for unit tests.

## Required reading

The implementer reads only these, plus each task's likely files. Everything else is optional.

- `specification/state-and-storage.md` §2, §3, §4, §6, §7 — storage split, persisted schema, write scheduling, IndexedDB reconciliation, and multi-tab behaviour.
- `specification/app-state-and-navigation.md` §4.2, §6.4, §7, §10 — predicates, discard confirmation rules, model lifecycle state machine, and store actions.
- `specification/COMPONENTS.md` §5 — state rules for Nanostores.

## Codebase context

Facts the planner verified, so the implementer need not re-check them.

- **Relevant implementation:** `src/types/state.ts` is currently an obsolete placeholder to be replaced.
- **Tests and commands:** `bun test` runs unit tests in terminal.
- **Web guidance:** `navigator.locks` is Baseline Widely available across evergreen browsers.
- **Known gaps decided:** Resolves Gap 6 (`nanostores` installation) and Gap 9 (column type vocabulary `'numeric' | 'categorical' | 'boolean' | 'text'`).
- **Assumptions requiring verification:** None.

## Technical decisions

| Decision                  | Chosen approach and rationale                                                                                                     | Rejected alternative / trade-off                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| State library             | Use `nanostores` (`atom`, `computed`) per `ARCHITECTURE.md` and `COMPONENTS.md §5`.                                               | Proxy-based singleton; rejected due to in-place mutation and component subscription complexity.           |
| Storage keys              | `samata-ml:state` for domain state; `samata-ml:scroll` for scroll snapshots per `state-and-storage.md §2`.                        | Single monolithic key; rejected because high-frequency scroll writes would constantly rewrite model data. |
| Model lifecycle           | Minimal 3-state machine (`draft` $\rightarrow$ `training` $\rightarrow$ `trained`) per `app-state-and-navigation.md §7`.          | Global FSM; rejected because multi-model workflow requires per-model lifecycle.                           |
| Ingestion ordering safety | Write new dataset under new `datasetId` and delete old dataset only after `metadata` write completes (`state-and-storage.md §6`). | Clear-on-upload; rejected because interrupted upload would destroy existing dataset.                      |

### Interfaces and behaviour

`PersistedAppState` defaults:

```typescript
export const INITIAL_APP_STATE: PersistedAppState = {
	version: 1,
	updatedAt: Date.now(),
	onboarding: { welcomeDismissed: false },
	resumePath: '/data',
	dataset: null,
	data: { mode: 'select', selectedColumn: null },
	target: null,
	models: [],
	nextModelNum: 1,
	results: { ui: {} }
};
```

## Specification changes

Applied retrospectively when the specs were reconciled with the code (2026-11-13).

- [x] `specification/state-and-storage.md` — the status line lists the implemented and target sections; status stays draft (open questions)
- [x] Known gap 14 — records where the stores and reconciler differ from the spec
- [x] Known gap 15 — records spec-to-spec conflicts and behaviour built ahead of open questions

## Implementation tasks

### T1 — Define canonical state types and schema

- **Depends on:** None
- **Risk:** routine
- **Likely files:** `src/types/state.ts`
- **Must not touch:** `src/config/*`
- **Implementation:**
    - Implement interfaces from `specification/state-and-storage.md §3`:
        - `ColumnType = 'numeric' | 'categorical' | 'boolean' | 'text'`
        - `ColumnSummary`, `DatasetSummary`, `ModelSectionId`, `HyperparameterConfig`, `ValidationMethodology`, `MulticlassStrategy`, `TrainingProgress`, `TrainingError`, `TrainingTimings`, `ModelStatus`, `ModelRecord`, `PersistedAppState`, `ScrollSnapshot`, `PersistedScroll`.
    - Export constants `STATE_STORAGE_KEY = 'samata-ml:state'`, `SCROLL_STORAGE_KEY = 'samata-ml:scroll'`, `STORAGE_VERSION = 1`.
    - Add TSDoc documentation for all exported types.
- **Acceptance criteria:**
    - [x] `src/types/state.ts` exports all types matching `state-and-storage.md §3`.
    - [x] `ColumnType` matches `'numeric' | 'categorical' | 'boolean' | 'text'`.
    - [x] `bun run typecheck` passes with no errors.
- **Verification:** `bun run typecheck`
- **Progress:** [x] Complete

### T2 — Implement Nanostores atoms, computed predicates and actions

- **Depends on:** T1
- **Risk:** routine
- **Likely files:** `src/stores/app.store.ts`, `src/stores/scroll.store.ts`, `src/stores/predicates.ts`
- **Must not touch:** `src/router/*`, `src/features/*`
- **Implementation:**
    - Create `src/stores/app.store.ts` exporting `$appState = atom(INITIAL_APP_STATE)` and pure action functions from `app-state-and-navigation.md §10`:
        - Onboarding: `dismissWelcome()`
        - Data: `loadDatasetSucceeded(dataset)`, `setDataMode(mode)`, `setSelectedColumn(name)`
        - Target: `setTarget(column)`, `confirmDiscardModels()`
        - Models: `createModel()`, `chooseModel(num, id, defaults)`, `setFeatures(num, names)`, `toggleFeature(num, name)`, `setModelOptions(num, options)`, `setHyperparameters(num, config)`, `setMulticlassStrategy(num, strategy)`, `setTrainingSetup(num, setup)`, `completeSection(num, section)`, `reopenSection(num, section)`
        - Training: `startTraining(num)`, `updateTrainingProgress(num, progress)`, `trainingSucceeded(num, result)`, `trainingFailed(num, msg, details)`, `cancelTraining(num)`, `recoverInterrupted(num)`
    - Create `src/stores/scroll.store.ts` exporting `$scrollState = atom(INITIAL_SCROLL_STATE)` and actions `recordScroll(key, snapshot)`, `clearScroll(keys)`.
    - Create `src/stores/predicates.ts` exporting computed stores:
        - `$hasDataset`: boolean
        - `$hasTarget`: boolean
        - `$trainedModels`: ModelRecord[]
        - `$canCompare`: boolean (trainedModels.length >= 2)
    - Ensure all actions are guarded (return false on invalid state; no mutations in place).
- **Acceptance criteria:**
    - [x] `$appState` and `$scrollState` are initialized.
    - [x] All actions listed in `app-state-and-navigation.md §10` are implemented.
    - [x] `$canCompare` evaluates to true only when at least 2 models have `status: 'trained'`.
- **Verification:** `bun run check`
- **Progress:** [x] Complete

### T3 — Implement storage persister module

- **Depends on:** T2
- **Risk:** routine
- **Likely files:** `src/stores/persister.ts`
- **Must not touch:** `src/features/*`
- **Implementation:**
    - Create `src/stores/persister.ts` with injectable `Storage` interface (defaulting to `window.localStorage`).
    - Listen to `$appState` and `$scrollState`.
    - Schedule writes per `specification/state-and-storage.md §4`:
        - Synchronous writes for navigation, dataset, target, model creation, section completion, status changes, and welcome dismissal.
        - Debounced writes (~150ms) for scroll snapshots (`samata-ml:scroll`).
        - Debounced writes (~300ms) for field edits.
    - Export `flushNow()` for lifecycle hooks (`visibilitychange`, `pagehide`).
    - Catch `QuotaExceededError`: drop scroll snapshots first, retry once, and notify without throwing.
- **Acceptance criteria:**
    - [x] Synchronous changes write to `localStorage` immediately.
    - [x] Scroll snapshot writes are debounced.
    - [x] `QuotaExceededError` is handled gracefully without crashing.
- **Verification:** `bun run check`
- **Progress:** [x] Complete

### T4 — Implement startup reconciler and Web Lock recovery

- **Depends on:** T3
- **Risk:** needs care — async multi-tab coordination and database reconciliation
- **Likely files:** `src/stores/reconciler.ts`
- **Must not touch:** `src/router/*`
- **Implementation:**
    - Create `src/stores/reconciler.ts` exporting `reconcileStartupState(storage, idb)`.
    - Execute checks 1–7 in order per `specification/state-and-storage.md §6`:
        1. Dataset present: verify metadata exists in IndexedDB; if missing, reset dataset and downstream state.
        2. Orphans: delete IndexedDB records for other dataset IDs.
        3. Target valid: ensure target column exists in `dataset.columns` and is not `text`.
        4. Models valid: ensure features exist in dataset; revert trained models with missing results.
        5. Counters: ensure monotonic `nextModelNum`.
        6. Selections valid: verify selectedColumn and resumePath.
        7. Interrupted training: request Web Lock `samata-ml:training:{num}` with `{ ifAvailable: true }`. If lock acquired, set `recoverInterrupted`; if lock held, leave as training in another tab.
    - Persist repaired state immediately.
- **Acceptance criteria:**
    - [x] Reconciler executes all 7 checks in specified order.
    - [x] Interrupted training without lock converts to `draft` with `TRAINING_INTERRUPTED_BY_RELOAD`.
    - [x] Corrupt storage data cleanly recovers to initial defaults.
- **Verification:** `bun run check`
- **Progress:** [x] Complete

### T5 — State and persistence unit test suite

- **Depends on:** T2, T3, T4
- **Risk:** routine
- **Likely files:** `tests/state-and-storage.test.ts`
- **Must not touch:** `src/stores/*`
- **Implementation:**
    - Implement tests in `tests/state-and-storage.test.ts` covering:
        - `NAV-AC-3`: Availability predicates for all state combinations.
        - `NAV-AC-5`: Dataset change reconciliation (preserves on identical schema, clears on change).
        - `NAV-AC-6`: `setTarget` reject with models until `confirmDiscardModels`.
        - `NAV-AC-7`: Model lifecycle transition table (draft -> training -> trained).
        - `NAV-AC-8`: Re-opening and editing sections invalidates later sections only.
        - `NAV-AC-9`: Interrupted training recovery on hydrate.
        - `NAV-AC-10`: Corrupt JSON, wrong shape, and unsupported version handling.
- **Acceptance criteria:**
    - [x] All test cases `NAV-AC-3` through `NAV-AC-10` pass in `bun:test`.
- **Verification:** `bun test tests/state-and-storage.test.ts`
- **Progress:** [x] Complete

## Verification and definition of done

- [x] All task acceptance criteria met.
- [x] `bun test tests/state-and-storage.test.ts` passes with zero failures.
- [x] `bun run check` passes with zero type errors.
- [x] No product code changes outside `src/types/state.ts` and `src/stores/*`.

## Risks and open questions

- **Blocking:** None.
- **Non-blocking:** The mock implementation of `navigator.locks` in `tests/setup.ts` must accurately emulate `{ ifAvailable: true }` lock acquisition behavior for testing in the terminal.

## Implementation and verification log

| When (UTC)           | Task | Outcome / commands / evidence                                                                                                                                        |
| -------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-12T12:40:50Z | T1   | Complete. Created: src/types/state.ts with full state schema and constants. Verified: bun run typecheck (PASS 0 errors).                                             |
| 2026-11-12T12:42:44Z | T2   | Complete. Created: src/stores/{app.store,scroll.store,predicates}.ts with all actions and predicates. Verified: bun run check (PASS with 0 errors, 19 tests passed). |
| 2026-11-12T12:43:51Z | T3   | Complete. Created: src/stores/persister.ts with debounced write scheduling and quota recovery. Verified: bun run check (PASS with 0 errors, 19 tests passed).        |
| 2026-11-12T12:48:14Z | T4   | Complete. Created: src/stores/reconciler.ts with 7-step startup reconciler & Web Lock recovery. Verified: bun run check (PASS with 0 errors, 19 tests passed).       |
| 2026-11-12T12:51:37Z | T5   | Complete. Implemented: tests/state-and-storage.test.ts covering NAV-AC-3 to NAV-AC-10. Verified: bun run check (PASS with 0 errors, 33 tests passed).                |

## Change log

| When (UTC)           | Change                                                 | Reason                                                   |
| -------------------- | ------------------------------------------------------ | -------------------------------------------------------- |
| 2026-11-12T11:37:44Z | Initial draft                                          | Scaffolding state stores, persistence and reconciliation |
| 2026-11-13T08:59:43Z | Added _Specification changes_, applied retrospectively | Spec reconciliation with the code                        |
