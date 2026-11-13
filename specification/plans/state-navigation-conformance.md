# State and navigation conformance

**Status:** draft | **Updated:** 2026-11-13T09:31:48Z

## Goal

**Current behaviour:** The stores, persister, reconciler and router built by the scaffolding plans differ from [state-and-storage.md](../state-and-storage.md) and [app-state-and-navigation.md](../app-state-and-navigation.md) in the ways listed in _Known gaps_ 14 and 15 of [specification/README.md](../README.md#known-gaps). In summary:

- `src/stores/reconciler.ts:103-122` uses a shallow shape check, treats a newer `version` as corrupt and overwrites it, and writes `localStorage` directly (`:191`, `:388`).
- `src/stores/persister.ts:114-140` debounces feature checkboxes, and its single 300 ms debounce means continuous training-progress ticks are never written while they keep arriving.
- `src/stores/predicates.ts:74-85` reports `DATASET_REQUIRED`/`TARGET_REQUIRED` for `/models/{num}` and `/results`.
- `src/stores/app.store.ts`:
    - `clearScroll` misses `models/{n}` keys, wrongly clears `target`, and is called inside the state transform (`:90`, `:155-162`);
    - a same-dataset reload leaves `data.mode` unchanged;
    - `setFeatures` invalidates later sections even when nothing changed, and section-3 and section-4 edits invalidate nothing;
    - `setFeatures` and `setSelectedColumn` accept unknown columns;
    - `startTraining` requires `configure-training` complete although the spec says it completes it.
- `src/router/router.ts:114-123` and `src/app.ts:145-151` both move focus, the latter on every render, including reload and closing a modal.
- `src/app.ts:93-95` takes the modal's underlay from `resumePath`.
- Nothing calls `recordCurrentScroll` (`src/router/scroll-restorer.ts:50`), so scroll positions are never saved.
- `src/features/navigation/app-sidebar.ts:221-290` puts `aria-current="step"` on `<li>` and binds link `aria-current` with `?`, which renders an empty value.

**Target behaviour:** The persisted-state layer, store actions, router, scroll memory and sidebar behave as the two specs say, with the spec-to-spec conflicts in gap 15 decided here. The only exceptions are the items under _Out of scope_, which stay in Known gap 14.

**Why:** These are correctness and accessibility defects in code every later workflow step depends on:

- Scroll memory is goal G2 and does not work.
- Focus moves on reload.
- Screen readers hear no current page.
- A stale tab can overwrite newer saved work.
- Step 1–3 plans should build on a layer that matches its specs.

## Scope

**In scope**

- **Persisted-state reads and writes.** The persister module owns every `localStorage` read and write: full hand-written validation; read-only mode for blobs with a newer version; the reconciler persisting through the persister.
- **Persister triggers.** Discrete selections (features, multiclass strategy, hyperparameter mode, training-setup type) are written synchronously. Training-progress writes are throttled to at most one per second.
- **`blockedReason`** returns exactly the §4.3 matrix.
- **Store actions:**
    - scroll-key invalidation on dataset change and model discard, with side effects outside the state transform;
    - a same-dataset reload sets `data.mode = 'preview'`;
    - the unchanged-edit rule, and later-section invalidation for every model field;
    - validation in `setFeatures` and `setSelectedColumn`.
- **Training transitions:**
    - `startTraining` requires sections 1–3 and completes `configure-training`;
    - failure, cancellation and interruption re-open `configure-training`.
- **Router:**
    - it decides when focus moves (user-initiated workflow navigation only);
    - reserved routes carry their `underlayPath`;
    - it flushes the persister before every history write.
- **Scroll saving:** snapshots are recorded for the active key, and saving is disabled until restoration for that key has finished.
- **App shell:** it focuses the `<h1>` only on the router's request and renders the underlay from the route's `underlayPath`.
- **Sidebar:** `aria-current` follows §4.4 (register SEM-03 in visual-design §5).
- Tests for all of the above.

**Out of scope**

- **IndexedDB:** wiring an IndexedDB adapter into `bootstrapApp`, and the reconciler's IndexedDB schema. Owned by [data-ingestion-and-storage](data-ingestion-and-storage.md) T10.
- **Training:** the training Web Lock, writing results to IndexedDB, and deleting stored results on discard. No training or results code exists; see TODO-21 and the orchestrator spec.
- **Multi-tab:** the `storage`-event sync (state-and-storage §7).
- **Notification UI:** blocked-page notifications (§4.3), the unknown-path notification, and the "Progress can't be saved" notification (state-and-storage §4.3).
- **Scroll:** regions, the `ResizeObserver` retry, the `pointerdown` abort, and `whenSettled` (§5.5, §8.4). These need real views.
- **Views:** route views and dynamic view mounting.
- **Migrations:** only version 1 exists.
- **Sidebar and shell visuals:** all styling other than the one selector named in T8; SEM-01, SEM-02, tokens and fallbacks. Owned by the unwritten `scaffolding-visual-remediation` plan (Known gap 13).

**Constraints and invariants**

- **Public API unchanged.** Keep every exported action name and signature in `src/stores/*.ts` and `src/router/router.ts`. The only additions are the exports named under _Interfaces and behaviour_.
- **Existing tests.** Tests in `tests/state-and-storage.test.ts` and `tests/router-and-navigation.test.ts` keep passing, except the assertions this plan deliberately changes (named in T1, T3, T4 and T5).
- **Purity.** Actions stay pure transforms returning new objects. Side effects run after the store update, never inside the transform.
- **Storage access.** Only `src/stores/persister.ts` calls `getItem`, `setItem` or `removeItem` (state-and-storage §4).
- **History access.** Only `src/router/router.ts` reads `history.state` or `location` (app-state-and-navigation §5.1).
- **Code standards.** Exported TypeScript has TSDoc. British English in comments and prose.

## Required reading

The implementer reads only these, plus each task's likely files. Everything else is optional.

- This plan's _Technical decisions_ and _Interfaces and behaviour_: the contract. Where they differ from a spec, this plan wins and T9 updates the spec.
- `specification/state-and-storage.md` §3 (schema), §4 (write scheduling), §8 (versioning). Needed for T1 and T2.
- `specification/app-state-and-navigation.md`:
    - §4.3 (blocked-state matrix) for T3;
    - §4.4 (sidebar `aria-current`) for T8;
    - §5.2, §5.3 and §5.6 (history, `popstate`, focus) for T6 and T8;
    - §6.1, §6.3 and §6.4 (step behaviour) for T4;
    - §7 (lifecycle table) for T5;
    - §8.4 (saving and restoring) for T7.
- `specification/COMPONENTS.md` §4, §5, §6.3, §7 and §9: for T8, which touches Lit code.
- `specification/visual-design.md` §5, row SEM-03: for T8.
- `src/types/state.ts`: the full persisted schema, which T1's validator mirrors.
- `src/types/routes.ts` lines 1-29: `ParsedRoute` and `HistoryEntryState` (T6).

## Codebase context

Facts the planner verified, so the implementer need not re-check them.

- **Relevant implementation:**
    - `src/stores/persister.ts` — debounced writer, `flushNow`, quota handling. `isSynchronousChange` (`:114-140`) decides sync versus debounced writes.
    - `src/stores/reconciler.ts` — `parseAppState` (`:101-122`), checks 1–8 (`:139-391`). It reads storage at `:136-155` and writes at `:191` and `:388`.
    - `src/stores/app.store.ts` — `updateState` (`:27-38`) always sets the store, even for an unchanged state.
    - `src/stores/scroll.store.ts` — `recordScroll`, `clearScroll(keys?)`.
    - `src/stores/predicates.ts` — `blockedReason` (`:47-91`).
    - `src/router/router.ts`:
        - `navigate` focuses via `queueMicrotask` (`:114-123`);
        - `openReserved` and `closeReserved` (`:129-209`);
        - `handlePopState` (`:255-289`);
        - `initRouter` resolves the initial URL (`:300-370`).
    - `src/router/scroll-restorer.ts`:
        - `recordCurrentScroll` (`:50`) has no caller;
        - `restoreScroll` (`:76`);
        - the `scroll` listener only updates `liveScrollTop` (`:181-186`).
    - `src/app.ts`:
        - `renderAppShell` (`:101-158`) re-renders on every `$route` change, focuses the `<h1>` (`:145-151`) and calls `restoreScroll` (`:153-157`);
        - `getActiveWorkflowRoute` (`:89-99`).
    - `src/features/navigation/app-sidebar.ts`:
        - the `aria-current` bindings (`:221-290`);
        - the step-number selector (`:128-132`).
- **Tests and commands:**
    - `bun run check` — baseline 0 type errors, 52 pass, 0 fail.
    - Unit tests: `tests/state-and-storage.test.ts` (NAV-AC-3, 5–10) and `tests/router-and-navigation.test.ts` (NAV-AC-1, 2, 4).
    - `tests/setup.ts` preloads happy-dom and a Web Locks mock.
    - Playwright: `bun run test:e2e tests/app-shell.test.ts` (NAV-E2E-1, 2, 3, 9). It is excluded from `bun test` by `bunfig.toml`, and `playwright.config.ts` starts the dev server.
    - The parity and token checks are `bun test tests/style-tokens.test.ts` and `bun run test:e2e tests/visual-parity.e2e.ts tests/a11y.e2e.ts`.
- **Web guidance:** None. No new platform feature is used: `aria-current`, `focus({ preventScroll })`, the History API and passive `scroll` listeners are already in use.
- **Visual reference:** `specification/mockups/ui-scaffold/01-1_select-data.html` — `css/steps.css` `.step[aria-current]`, `.step-num`. T8 changes which element carries `aria-current` (the link, per SEM-03), not how anything looks. The sidebar's parity entries in `tests/visual-parity/map.ts` remain `knownDrift: 'scaffolding-visual-remediation'`. Deviations: SEM-03 (applied here).
- **Lit skills:** implementers use `lit-implementer` for T8.
- **Known gaps decided:** 14 (every bullet except the IndexedDB adapter and stored-results deletion, which stay) and 15 (see _Technical decisions_; its open questions are blocking below).
- **Assumptions requiring verification:** None.

## Technical decisions

| Decision                        | Chosen approach and rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Rejected alternative / trade-off                                                                                                                                    |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 Who touches storage          | `persister.ts` gains `readPersistedState(storage)` and `persistNow(storage?)`. `reconcileStartupState` calls them instead of `getItem`/`setItem`. Its signature `(storage?, idb?)` is unchanged.                                                                                                                                                                                                                                                                                                                            | Leave the reconciler's writes: contradicts state-and-storage §4 and bypasses read-only mode.                                                                        |
| D2 Validation                   | A private hand-written type guard checks every field of `PersistedAppState` and `PersistedScroll` (rules in _Interfaces_). Any failure discards the whole blob (defaults). No validation library.                                                                                                                                                                                                                                                                                                                           | Per-field repair: §8 and §9.1 forbid partial application.                                                                                                           |
| D3 Newer version (gap 15)       | A blob whose `version` is greater than `STORAGE_VERSION` yields defaults in memory **and** puts the persister into read-only mode for that key for the life of the document. This satisfies both state-and-storage §8 (never overwrite newer data) and NAV-AC-10 (defaults, no throw). T9 rewrites NAV-AC-10 to say both.                                                                                                                                                                                                   | Run from the newer blob: its shape is unknown to this code.                                                                                                         |
| D4 Write triggers               | Synchronous: the §4.1 list, plus `features`, `multiclass`, `hyperparameters.mode` and `trainingSetup?.type`. Debounced 300 ms: all other model-field edits. Progress-only changes are **throttled**: the first schedules a write 1000 ms later, and later ticks do not reset it.                                                                                                                                                                                                                                            | One debounce for everything: starves progress writes during training.                                                                                               |
| D5 Blocked reasons              | `/models/{num}`: `null` if the model exists, else `MODEL_NOT_FOUND`. `/results`: `TWO_TRAINED_MODELS_REQUIRED` unless at least two models are trained. Exactly the §4.3 matrix.                                                                                                                                                                                                                                                                                                                                             | Keep the dataset and target checks first: the spec's messages are chosen per page. With no target, models are cleared anyway, so model-not-found is the true state. |
| D6 Scroll invalidation          | A private helper in `app.store.ts` computes the matching keys from `$scrollState` and calls `clearScroll(keys)` **after** `updateState` succeeds. Dataset change clears every key not starting with `data:`. Discard clears `models`, `models/*` and `results`.                                                                                                                                                                                                                                                             | A prefix option on `clearScroll`: changes the §10 public action.                                                                                                    |
| D7 Unchanged edits              | Each model action compares the new value with the old one using a private structural-equality helper for JSON values. If they are equal, it returns `true` without setting the store. If they differ, it un-completes every section **after** the section that owns the field: `select-features` owns `features`; `configure-model` owns `modelOptions`, `hyperparameters` and `multiclass`; `configure-training` owns `trainingSetup`. `updateState` skips `$appState.set` when the transform returns the same reference.  | Always invalidate: contradicts §6.3 and NAV-AC-8.                                                                                                                   |
| D8 Training sections (gap 15)   | `startTraining` requires `choose-model`, `select-features` and `configure-model`, plus a non-null `trainingSetup`. It adds `configure-training` to `completedSteps`, because **Train Model** is section 4's completion trigger (§6.3). `trainingFailed`, `cancelTraining`, `recoverInterrupted` and reconciler check 7 remove `configure-training`, `training` and `results`, so section 4 is active again with the error beside **Train Model** (§7 note). **Needs your confirmation; see Risks.**                         | Require section 4 complete first: then the Train Model button can never complete section 4.                                                                         |
| D9 Focus (gap 14)               | The router owns the decision; the shell performs it. A router-private flag is set by user-initiated workflow navigation (`navigate`, and a `popstate` whose previous route was a workflow route). It is not set by `initRouter`, by closing a modal (`closeReserved`, or a `popstate` from a reserved route) or by opening one. `takeFocusRequest()` returns the flag and clears it. `renderAppShell` focuses `#content h1` synchronously after `render()` only if it returns `true`. The router no longer queries the DOM. | The router focuses after a microtask: races with Lit's render, and it duplicated the shell's focus.                                                                 |
| D10 Underlay                    | The `reserved` variant of `ParsedRoute` gains `underlayPath?: WorkflowPath`. The router sets it whenever it sets a reserved route: from the entry it writes (`openReserved`, `initRouter`) or from `history.state.underlayPath` falling back to `resumePath` (`popstate`). `getActiveWorkflowRoute` uses `route.underlayPath ?? resumePath`. `parseRoute` is unchanged.                                                                                                                                                     | The shell reads `history.state`: breaks §5.1.                                                                                                                       |
| D11 Flush before history writes | Every `pushState`/`replaceState` in `router.ts` is preceded by `flushNow()` (§8.4 saving rule 2).                                                                                                                                                                                                                                                                                                                                                                                                                           | Rely on the 150 ms debounce: loses the outgoing position on a fast reload.                                                                                          |
| D12 Scroll saving               | `scroll-restorer.ts` tracks the active key. `restoreScroll(key)` sets it and disables saving immediately, then re-enables saving on **every** exit path. The passive `scroll` listener calls `recordCurrentScroll(activeKey)` when saving is enabled. The persister's existing 150 ms scroll debounce does the throttling. The outgoing key is therefore current when `popstate` fires (§8.4 rule 3).                                                                                                                       | Save from the router on navigation only: misses reload and tab close.                                                                                               |
| D13 Restore only on key change  | `renderAppShell` keeps the last scroll key it restored and calls `restoreScroll` only when the new key differs. Opening and closing a modal therefore never moves the underlay (§5.4).                                                                                                                                                                                                                                                                                                                                      | Restore on every render: re-scrolls the underlay after every modal.                                                                                                 |
| D14 `aria-current`              | Links use `aria-current=${value ?? nothing}` with `page` or `true` as §4.4 says; `<li>` elements carry none. The step-number highlight selector becomes `li.step > a[aria-current] .step-num`. SEM-03 prescribes this binding.                                                                                                                                                                                                                                                                                              | `?aria-current`: renders `aria-current=""`, which means false.                                                                                                      |
| D15 `results.ui` (gap 15)       | Keep `results.ui` (code, state-and-storage §3 and §5); T9 corrects app-state-and-navigation §6.5.                                                                                                                                                                                                                                                                                                                                                                                                                           | Rename to `ui.results`: changes the persisted schema for no benefit.                                                                                                |

### Interfaces and behaviour

**New exports** (TSDoc required):

```ts
// src/stores/persister.ts
/** Result of reading both persisted blobs; invalid or unsupported blobs come back as defaults. */
export interface PersistedRead {
	state: PersistedAppState;
	scroll: PersistedScroll;
}
/** Reads and validates both keys. Marks a key read-only for this document if its version is newer than STORAGE_VERSION. */
export function readPersistedState(storage?: StorageAdapter): PersistedRead;
/** Writes $appState and $scrollState now, cancelling pending timers; skips read-only keys. */
export function persistNow(storage?: StorageAdapter): void;

// src/router/router.ts
/** Returns true once after a user-initiated workflow navigation, so the shell can move focus (§5.6). */
export function takeFocusRequest(): boolean;

// src/types/routes.ts — reserved variant only
| { kind: 'reserved'; path: ReservedPath; underlayPath?: WorkflowPath }
```

`storage` defaults to the active storage. `stopPersister()` keeps working.

**Read-only lifetime.** `initPersister` must not clear read-only flags set by `readPersistedState` in the same document. A test helper may reset them only through `initPersister(storage)` with a new storage object.

**Validation rules.** Every rule must hold, or the blob is discarded:

- **Top level:**
    - plain object;
    - `version === STORAGE_VERSION` (a number greater than it ⇒ D3; any other value ⇒ discard);
    - `updatedAt` finite number;
    - `onboarding.welcomeDismissed` boolean;
    - `resumePath` a string for which `parseRoute(resumePath).kind === 'workflow'` (import from `src/router/route-parser.ts`, which is pure);
    - `nextModelNum` integer ≥ 1;
    - `results.ui` plain object.
- **`dataset`:** `null`, or an object with:
    - `id` and `name` strings;
    - `source` `'sample' | 'upload'`;
    - `rowCount` integer ≥ 0;
    - `columns` an array of `{ name: string; type: ColumnType; missingCount: integer ≥ 0 }`.
- **`data`:** `mode` `'select' | 'preview'`; `selectedColumn` string or `null`.
- **`target`:** string or `null`.
- **`models`:** an array; each entry has:
    - `num` integer ≥ 1;
    - `createdAt` number;
    - `status` one of the three statuses;
    - `completedSteps` an array of `ModelSectionId`;
    - `modelId` string or `null`;
    - `features` string array;
    - `modelOptions` and `ui` plain objects;
    - `hyperparameters` `{ mode: 'manual' | 'tuning'; values: object }`;
    - `multiclass` `null` or one of the three strategies;
    - `trainingSetup` `null` or an object whose `type` is one of the three types;
    - `progress` `null` or `{ percent: number; statusMessage: string }`;
    - `error` `null` or `{ code: one of the three codes; message: string; timestamp: number }`;
    - `timings` `null` or an object;
    - `durationMs` `null` or a number;
    - `metrics` `null` or an object.
- **Scroll blob:**
    - `version` as above;
    - `snapshots` a plain object;
    - each snapshot has finite numeric `viewportWidth`, `top` and `savedAt`;
    - `regions`, if present, is an object of `{ top: number; left: number }`.

**Store action rules** (all keep their signatures):

- **`loadDatasetSucceeded(d)`:**
    - _Same id and identical column names and types:_ set `dataset = d`, `data = { mode: 'preview', selectedColumn: null }`; nothing else changes.
    - _Otherwise:_ the existing reset, then clear every scroll key not starting with `data:` (D6).
- **`confirmDiscardModels()`:** sets `models = []` and `nextModelNum = 1`, then clears scroll keys `models`, `models/*` and `results`. It does not clear `target` or its scroll key.
- **`setFeatures(num, names)`:** returns `false` if any of these hold:
    - there is no dataset;
    - a name is not a column of the dataset;
    - a name is a `text` column or the target;
    - a name is duplicated.

    An equal set (order-insensitive) is a no-op returning `true`. Otherwise it applies D7.

- **`toggleFeature`:** unchanged; delegates to `setFeatures`.
- **`setModelOptions`, `setHyperparameters`, `setMulticlassStrategy`:** D7 with owner `configure-model`.
- **`setTrainingSetup`:** D7 with owner `configure-training`.
- **`chooseModel`:** unchanged, because it already matches §6.3.
- **`setSelectedColumn(name)`:** a non-null `name` must be a column of the current dataset, else `false`.
- **D7 helper:** the later sections are the entries of `SECTION_ORDER` after the owner.

**Persister triggers (D4).** Add to `isSynchronousChange`, for each model with the same index and `num`:

- `features` differs (any order);
- `multiclass` differs;
- `hyperparameters.mode` differs;
- `trainingSetup?.type` differs.

A change is **progress-only** when every model differs at most in `progress`, and nothing outside `models` differs except `updatedAt`.

Debounce and throttle settings come from the existing options object, plus a new `throttleProgressMs` (default 1000).

**Router focus and underlay (D9, D10).**

| Event                                                                                        | Focus request | `$route` for a reserved path                |
| -------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------- |
| `navigate(path)` to a workflow route (including `/` and unknown resolved to the resume path) | set           | —                                           |
| `closeReserved()` (either branch)                                                            | not set       | —                                           |
| `openReserved(path)`                                                                         | not set       | `underlayPath` = the entry's `underlayPath` |
| `popstate` to a workflow route from a workflow route                                         | set           | —                                           |
| `popstate` to a workflow route from a reserved route                                         | not set       | —                                           |
| `popstate` to a reserved route                                                               | not set       | `history.state?.underlayPath ?? resumePath` |
| `initRouter()`                                                                               | not set       | `underlayPath` = `resumePath`               |

`closeReserved`'s direct-load branch calls an internal navigation that does not request focus. The public `navigate(path, options?)` signature stays the same.

**Scroll saving (D12, D13).**

- `restoreScroll(key, whenSettled?)`:
    - sets `activeKey = key` and `savingEnabled = false` synchronously before any `await`;
    - in all exit paths sets `savingEnabled = true`: no snapshot, width mismatch, interrupted, restored, or thrown.
- The `scroll` listener updates `liveScrollTop`, then calls `recordCurrentScroll(activeKey)` when `activeKey !== null`, `savingEnabled` and not restoring.
- `stopScrollRestorer()` resets `activeKey = null` and `savingEnabled = false`.

**Sidebar (D14).** The connected `app-sidebar` (tag, file and public API unchanged: no properties, events, slots or parts):

- `<li class="step">` gets no `aria-current`;
- the section link gets `aria-current="page"` when `href` equals the current workflow path;
- the "Train Models" link gets `aria-current="true"` on `/models/{num}`;
- model sub-links get `page` for their own URL.

It owns no new strings. Accessible names are unchanged (link text).

## Specification changes

T9 applies these and ticks each one.

- [ ] `specification/state-and-storage.md` §4, §4.1, §8 — the persister is the only code that reads or writes `localStorage`, including during reconciliation. Feature, multiclass, hyperparameter-mode and training-setup-type changes are written synchronously. Progress writes are throttled to one per second. §8 rules are implemented as D2 and D3. The status line drops "§8 read-only mode" from the target list and keeps migrations and §7 as target.
- [ ] `specification/app-state-and-navigation.md` §4.3, §4.4, §5.3, §5.6, §6.1, §6.3, §6.4, §8.4, §10 — move to the status line's implemented list: blocked reasons, sidebar `aria-current`, focus rules, `underlayPath`, scroll saving and invalidation, unchanged-edit rule and action validation.
- [ ] `specification/app-state-and-navigation.md` §6.5 — `ui.results` becomes `results.ui` (D15).
- [ ] `specification/app-state-and-navigation.md` §7 — the `startTraining` guard is "sections 1–3 complete and a training setup chosen". `trainingFailed`, `cancelTraining` and `recoverInterrupted` un-complete `configure-training`, `training` and `results` (D8). `cancelTraining` loses "(proposed)" if Q1c is accepted.
- [ ] `specification/app-state-and-navigation.md` §11 NAV-AC-10 — "unknown future version yields defaults in memory and leaves the stored blob unchanged".
- [ ] `specification/app-state-and-navigation.md` §12 — Q1b, Q1c, Q2 and Q4 are recorded as answered with your decisions; the §6.3, §6.4, §7 and §8.4 "proposed" labels are removed or kept to match.
- [ ] `specification/state-and-storage.md` §6 check 7 — recovery un-completes `configure-training` as well (D8).
- [ ] `specification/visual-design.md` — the status line and §5 SEM-03 row say SEM-03 is applied.
- [ ] Known gap 13 — SEM-03 removed from the list of entries not yet applied.
- [ ] Known gap 14 — narrowed to the IndexedDB adapter bullet and the deletion of stored results on discard.
- [ ] Known gap 15 — resolved.

## Implementation tasks

### T1 — Persister owns storage; full validation; read-only for newer versions

- **Depends on:** None
- **Risk:** needs care — the validator must mirror `src/types/state.ts` exactly. Read-only mode must survive `initPersister`.
- **Likely files:** `src/stores/persister.ts`, `src/stores/reconciler.ts`, `tests/state-and-storage.test.ts`
- **Must not touch:** `src/types/state.ts` (schema unchanged); the `IndexedDBAdapter` interface and `createDefaultIndexedDBAdapter` (owned by data-ingestion-and-storage T10); `src/app.ts`
- **Implementation:**
    - Add `readPersistedState`, `persistNow` and the private validators per _Interfaces and behaviour_ (D1–D3).
    - Read-only flags are module state keyed by storage key. `safeSetItem` and the writers skip a read-only key.
    - In `reconcileStartupState`:
        - replace `parseAppState`, the scroll parsing (`:136-155`), the scroll write in check 1 (`:187-193`) and the final write (`:386-391`) with `readPersistedState(storage)`;
        - set the stores from it;
        - end with `persistNow(storage)`.
    - Delete `parseAppState`.
    - Update the NAV-AC-10 "unsupported version" test (`tests/state-and-storage.test.ts:426-435`): a newer version yields defaults **and** the stored string is unchanged afterwards.
- **Acceptance criteria:**
    - [ ] NAV-AC-10: corrupt JSON, wrong shape, missing storage and an older version yield defaults without throwing.
    - [ ] NAV-AC-10: a blob with `version: 999` yields defaults. After `reconcileStartupState` and `initPersister`, a later action leaves the stored `samata-ml:state` string byte-identical.
    - [ ] SNC-1: a blob that is valid except for one field yields full defaults. Test one case each: `resumePath: '/about'`, a model with `status: 'done'`, `dataset.columns[0].type: 'date'`, and `nextModelNum: 0`.
    - [ ] SNC-2: a test storage adapter that records calls shows `reconcileStartupState` performing no `setItem` other than through the persister. A `grep -n "setItem\|getItem\|removeItem" src/stores/reconciler.ts` returns nothing.
    - [ ] Existing NAV-AC-9 tests pass unchanged.
- **Verification:** `bun test tests/state-and-storage.test.ts`; `bun run check`
- **Progress:** [ ] Not started

### T2 — Persister write triggers: discrete selections synchronous, progress throttled

- **Depends on:** T1
- **Risk:** routine
- **Likely files:** `src/stores/persister.ts`, `tests/state-and-storage.test.ts`
- **Must not touch:** `src/stores/app.store.ts`
- **Implementation:** Extend `isSynchronousChange` and add the progress throttle per D4 and _Interfaces and behaviour_. Add `throttleProgressMs` to the options object with TSDoc.
- **Acceptance criteria:**
    - [ ] SNC-3: with `debounceFieldMs: 10_000`, `toggleFeature` is in storage immediately after the call. So are `setMulticlassStrategy`, a `setHyperparameters` that changes `mode`, and a `setTrainingSetup` that changes `type`.
    - [ ] SNC-4: a `setHyperparameters` changing only `values` is not written before the debounce and is written after it.
    - [ ] SNC-5: with `throttleProgressMs: 50`, ten `updateTrainingProgress` calls 10 ms apart produce a write within 60 ms of the first call. The last tick's value is stored by 50 ms after the final call.
- **Verification:** `bun test tests/state-and-storage.test.ts`; `bun run check`
- **Progress:** [ ] Not started

### T3 — `blockedReason` matches the §4.3 matrix

- **Depends on:** None
- **Risk:** routine
- **Likely files:** `src/stores/predicates.ts`, `tests/state-and-storage.test.ts`
- **Must not touch:** the `BlockedReason` union and the computed stores in `predicates.ts`
- **Implementation:** Apply D5 and update the TSDoc. Change the assertions at `tests/state-and-storage.test.ts:105-134` that expect `DATASET_REQUIRED`/`TARGET_REQUIRED` for `/models/{num}` and `/results`.
- **Acceptance criteria:**
    - [ ] NAV-AC-3b: for every combination of no dataset, no target, 0, 1 and 2 trained models, and existing versus missing model, the result is:
        - `/data` → `null`;
        - `/target` → `DATASET_REQUIRED` or `null`;
        - `/models` → `DATASET_REQUIRED`, `TARGET_REQUIRED` or `null`;
        - `/models/{num}` → `MODEL_NOT_FOUND` or `null`;
        - `/results` → `TWO_TRAINED_MODELS_REQUIRED` or `null`.
- **Verification:** `bun test tests/state-and-storage.test.ts`
- **Progress:** [ ] Not started

### T4 — Store actions: invalidation, unchanged edits and validation

- **Depends on:** T1
- **Risk:** needs care — section ownership and equality must follow D7 exactly. The side effects must move outside the transforms.
- **Likely files:** `src/stores/app.store.ts`, `tests/state-and-storage.test.ts`
- **Must not touch:** exported action names and signatures; `src/stores/scroll.store.ts` (use `clearScroll(keys)` as is); training actions (T5)
- **Implementation:**
    - Make `updateState` skip `$appState.set` when the transform returns the current reference.
    - Add the private D6 scroll helper and the D7 equality and invalidation helpers.
    - Rewrite `loadDatasetSucceeded`, `confirmDiscardModels`, `setFeatures`, `setModelOptions`, `setHyperparameters`, `setMulticlassStrategy`, `setTrainingSetup` and `setSelectedColumn` per _Interfaces and behaviour_.
    - Update `tests/state-and-storage.test.ts` NAV-AC-5 and NAV-AC-8 to the new rules.
- **Acceptance criteria:**
    - [ ] NAV-AC-5:
        - a same-dataset reload keeps target and models and sets `data.mode = 'preview'` and `selectedColumn = null`;
        - a different dataset clears `target`, `models`, `models/3` and `results` scroll keys, and keeps `data:select` and `data:preview`.
    - [ ] NAV-AC-6: `confirmDiscardModels` clears `models`, `models/1`, `models/2` and `results` scroll keys, and keeps `target` and the `target` scroll key.
    - [ ] NAV-AC-8:
        - `setFeatures` with the same set in a different order returns `true` and does not change `$appState` (same reference);
        - a changed `setHyperparameters` on a model with sections 1–4 complete leaves `choose-model`, `select-features` and `configure-model` complete;
        - `chooseModel` with a different model resets options, hyperparameters and multiclass, and keeps features.
    - [ ] SNC-6: `setFeatures` returns `false`, with no mutation, for an unknown column, a `text` column, the target or a duplicate. `setSelectedColumn('nope')` returns `false`.
    - [ ] SNC-7: `clearScroll` is never called inside an `updateState` transform. Check by code review in the task report.
- **Verification:** `bun test tests/state-and-storage.test.ts`; `bun run check`
- **Progress:** [ ] Not started

### T5 — Training section transitions

- **Depends on:** T1, T4
- **Risk:** routine
- **Likely files:** `src/stores/app.store.ts`, `src/stores/reconciler.ts`, `tests/state-and-storage.test.ts`
- **Must not touch:** `ModelStatus`, `TrainingError` and other types in `src/types/state.ts`
- **Implementation:** Apply D8 to `startTraining`, `trainingFailed`, `cancelTraining` and `recoverInterrupted`, and to reconciler check 7 (`src/stores/reconciler.ts:367-379`). Update the NAV-AC-7 tests.
- **Acceptance criteria:**
    - [ ] NAV-AC-7:
        - `startTraining` returns `false` without `configure-model` or with `trainingSetup === null`;
        - with sections 1–3 and a setup, it moves to `training` with `configure-training` completed;
        - `trainingFailed`, `cancelTraining` and `recoverInterrupted` each return to `draft` with `configure-training`, `training` and `results` not completed and the matching error code.
    - [ ] NAV-AC-9: hydration recovery also removes `configure-training`.
- **Verification:** `bun test tests/state-and-storage.test.ts`; `bun run check`
- **Progress:** [ ] Not started

### T6 — Router: focus requests, `underlayPath`, flush before history writes

- **Depends on:** T1
- **Risk:** needs care — every row of the focus and underlay table must hold, including `closeReserved`'s direct-load branch.
- **Likely files:** `src/router/router.ts`, `src/types/routes.ts`, `tests/router-and-navigation.test.ts`
- **Must not touch:** `src/router/route-parser.ts`; the public signatures of `navigate`, `openReserved` and `closeReserved`; `src/app.ts` (T8)
- **Implementation:**
    - Remove the `queueMicrotask` focus block (`router.ts:114-123`).
    - Add the private focus flag and `takeFocusRequest()` (D9).
    - Add `underlayPath` to the reserved variant and set it per the table (D10).
    - Call `flushNow()` (from `../stores/persister`) immediately before each `pushState`/`replaceState` (D11).
- **Acceptance criteria:**
    - [ ] SNC-8: after `navigate('/target')`, `takeFocusRequest()` returns `true`, then `false`. After `initRouter()` on `/models`, `openReserved('/about')` and `closeReserved()`, it returns `false`.
    - [ ] SNC-9: a `popstate` from `/target` to `/data` sets the request. A `popstate` from `/about` to `/data` does not.
    - [ ] SNC-10: `openReserved('/about')` from `/target` sets `$route` to `{ kind: 'reserved', path: '/about', underlayPath: '/target' }`. A direct `initRouter()` on `/help` sets `underlayPath` to `resumePath`.
    - [ ] SNC-11: with a pending debounced state write, `navigate('/models')` leaves the pending value in storage before the history call. Spy on `history.pushState` and read storage inside the spy.
    - [ ] Existing NAV-AC-1 and NAV-AC-2 tests pass.
- **Verification:** `bun test tests/router-and-navigation.test.ts`; `bun run check`
- **Progress:** [ ] Not started

### T7 — Scroll saving for the active key

- **Depends on:** None
- **Risk:** routine
- **Likely files:** `src/router/scroll-restorer.ts`, `tests/router-and-navigation.test.ts`
- **Must not touch:** `ScrollSnapshot`; the viewport-width rule; `getScrollKeyForRoute`
- **Implementation:** Apply D12 per _Interfaces and behaviour_. Wrap `restoreScroll`'s body so `savingEnabled` is restored in a `finally` that covers every return.
- **Acceptance criteria:**
    - [ ] SNC-12: after `restoreScroll('target')` resolves, a dispatched `scroll` event with `window.scrollY = 120` records `snapshots.target.top === 120` with the current `innerWidth`.
    - [ ] SNC-13: a `scroll` event dispatched while `restoreScroll` awaits a pending `whenSettled` records nothing. Restoration with no snapshot or a width mismatch still re-enables saving.
    - [ ] Existing NAV-AC-4 tests pass.
- **Verification:** `bun test tests/router-and-navigation.test.ts`; `bun run check`
- **Progress:** [ ] Not started

### T8 — App shell focus and underlay; sidebar `aria-current`

- **Depends on:** T6, T7
- **Risk:** needs care — Lit attribute bindings with `nothing`; focus only on request; the Playwright tests must pass in all three browsers.
- **Likely files:** `src/app.ts`, `src/features/navigation/app-sidebar.ts`, `tests/app-shell.test.ts`
- **Must not touch:**
    - `src/app.ts`: the `<style>` block and view templates;
    - `app-sidebar.ts`: all styles except the one selector in D14, and all markup except the `aria-current` bindings;
    - `tests/visual-parity/map.ts`.

    These belong to `scaffolding-visual-remediation` (Known gap 13).

- **Implementation:**
    - In `renderAppShell`:
        - remove the focus block (`:145-151`);
        - after `render()`, call `takeFocusRequest()` once per render, and when it returns `true` and the route is a workflow route, focus `#content h1` with `{ preventScroll: true }`;
        - keep a module-level last-restored key and call `restoreScroll` only when the key changes (D13).
    - `getActiveWorkflowRoute` uses `route.underlayPath ?? resumePath` (D10).
    - In `app-sidebar`:
        - apply D14: import `nothing` from `lit`, remove every `<li>` `aria-current`, and replace each link's `?aria-current=${…}` with `aria-current=${… ?? nothing}`;
        - change the selector at `:128-129` to `li.step > a[aria-current] .step-num`.
    - Add the Playwright tests below to `tests/app-shell.test.ts`.
- **Acceptance criteria:**
    - [ ] NAV-E2E-2d:
        - on `/data`, `/target`, `/models` and `/results`, exactly one `app-sidebar a[aria-current="page"]` exists and its `href` is the current path;
        - no `li[aria-current]` exists;
        - no `aria-current` attribute has an empty value;
        - activating the current link adds no history entry (`history.length` unchanged) and keeps focus on that link.
    - [ ] SNC-14: after reload on `/target`, `document.activeElement` is not the `<h1>`. After clicking the sidebar link to `/models`, it is the `<h1>`. After `/target` → open `/about` → press `Esc`, focus is not on the `<h1>`.
    - [ ] SNC-15: scroll `/target` down (make the page tall in the test with `page.addStyleTag` on `#content { min-height: 300vh }`), click to `/models`, then Back: `window.scrollY` is restored within 2 px. Open and close `/about`: `scrollY` is unchanged.
    - [ ] Existing NAV-E2E-1, 2, 3 and 9 pass.
    - [ ] The token guard and parity suites show no new failures, and the sidebar entries stay `knownDrift`.
- **Verification:** `bun run test:e2e tests/app-shell.test.ts`; `bun test tests/style-tokens.test.ts`; `bun run test:e2e tests/visual-parity.e2e.ts tests/a11y.e2e.ts` (attach both screenshots); `bun run check`. Manual check: VoiceOver or NVDA announces "current page" on the active sidebar link in one browser; record which.
- **Progress:** [ ] Not started

### T9 — Sync specification

- **Depends on:** T1, T2, T3, T4, T5, T6, T7, T8
- **Risk:** needs care — specs must describe what was built, not what was planned. §12 answers must quote the user's decisions recorded in this plan's change log.
- **Likely files:** `specification/state-and-storage.md`, `specification/app-state-and-navigation.md`, `specification/visual-design.md`, `specification/README.md`
- **Must not touch:** Product code, tests and `specification/mockups/`
- **Implementation:** Apply every item under _Specification changes_, following "Writing specs" in `specification/README.md`. Where the log records a deviation from the plan, document the deviation, not the plan. Update each changed spec's status line and its row in the index, and narrow or resolve _Known gaps_.
- **Acceptance criteria:**
    - [ ] Every item under _Specification changes_ is applied and ticked.
    - [ ] No changed spec contradicts the code or another spec, or mentions this plan, its tasks or the history of the change.
    - [ ] `bun run plans:check` reports no spec index mismatch.
- **Verification:** `bun run plans:check`; `git diff specification/` reviewed against _Specification changes_
- **Progress:** [ ] Not started

Parallel-safe groups (no shared files):

- T3;
- T7;
- T1 → T2, T4 → T5, T6 (these touch `persister.ts`, `app.store.ts` and the same test file, so run them in sequence);
- T8 after T6 and T7.

## Verification and definition of done

- [ ] All task acceptance criteria met.
- [ ] `bun run check` introduces no new failures compared with the baseline recorded above (0 type errors, 52 pass, 0 fail; new tests only add passes).
- [ ] Parity and token tests pass for UI changes (T8), with no new failures.
- [ ] `bun run test:e2e tests/app-shell.test.ts` passes in Chromium, Firefox and WebKit, or each browser not run is recorded with the reason.
- [ ] Accessibility: the sidebar `aria-current` check and the focus checks (SNC-14) pass. A screen-reader manual check is recorded.
- [ ] Every item under _Specification changes_ is ticked, and the specs describe the code as built.
- [ ] No unintended changes outside the tasks' likely files.

## Risks and open questions

- **Blocking:** these need your decisions before this plan can be `ready`. The code already behaves as the recommendation; app-state-and-navigation §12 says implementers must not decide them.
    - **§12 Q1b — re-opening completed model sections before training** (`reopenSection`). Recommendation: keep.
    - **§12 Q1c — a Cancel training action** (`cancelTraining`). Recommendation: keep. Long in-browser runs need it.
    - **§12 Q2 — confirm-and-discard** when the target or dataset changes with models present (`setTarget` rejects, then `confirmDiscardModels`). The alternatives are a hard lock or read-only archived models. Recommendation: keep confirm-and-discard.
    - **§12 Q4 — scroll semantics:** remember each step's latest position rather than per history entry. Recommendation: keep latest-per-step.
    - **D8 — training sections:** Train Model completes section 4, and a failed, cancelled or interrupted run re-opens section 4. Recommendation: accept. It is the only reading of §6.3 and §7 that is self-consistent.
- **Non-blocking:**
    - **Focus on reserved-route close by Back.** A `popstate` from `/about` to the underlay never requests focus, matching §5.6. When the modal was closed by Back rather than `Esc`, the dialog still returns focus to its invoker, because the shell closes it. Owner: T8 verifies in SNC-14.
    - **Progress throttle.** Throttling is per persister, not per model. With one training run at a time (§7.1) that is enough.
    - **`h1` focus outline.** `src/app.ts` sets `outline: none` on `.page-header h1` with no replacement (COMPONENTS §7). Moving focus there only on navigation does not fix that. Owner: `scaffolding-visual-remediation` (Known gap 13).
    - **Mockup `.step[aria-current]`.** `steps.css` styles the current step's `<li>`. After D14 only links carry `aria-current`, so the remediation plan should port that rule as `.step:has(> .step-link[aria-current])` (`:has()` is Baseline Widely available). Owner: `scaffolding-visual-remediation`.
    - **`data.mode` changes** do not re-render the shell (`app.ts` subscribes only to `$route`), so the `/data` scroll key cannot switch between `data:select` and `data:preview` yet. There is no data view yet. Owner: the step-1 plan.
    - **Overlap with data-ingestion-and-storage.** Its T1 also edits `src/stores/app.store.ts` and `src/stores/reconciler.ts` (eligibility predicate), and its T10 edits `reconciler.ts`. Whichever plan lands second rebases onto the first. This plan does not touch the predicate or the adapter.

## Implementation and verification log

| When (UTC) | Task | Outcome / commands / evidence |
| ---------- | ---- | ----------------------------- |
| —          | —    | Not started                   |

## Change log

| When (UTC)           | Change        | Reason                                                |
| -------------------- | ------------- | ----------------------------------------------------- |
| 2026-11-13T09:31:48Z | Initial draft | User request: plan the fixes for Known gaps 14 and 15 |
