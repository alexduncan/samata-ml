# Live training timings and fold scores in Step 5

**Status:** draft | **Updated:** 2026-11-26T09:03:13Z
**Authors:** Claude Code (claude-opus-5-5) | **Created:** 2026-11-25T15:59:05Z
**Verified by:** — | **Verified:** — | **Verification:** changes-requested
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour:** Section 5 renders `app-training-progress` (`src/features/models/app-training-progress.ts`): one native progress bar, a `<details>` log (template :128-147) and, only after completion, the builder's `durationText` ("Elapsed time {seconds}", `app-model-builder-view.ts:1772-1781`). Nothing ticks while training runs. The worker mapper (`src/features/models/training/progress.ts:91-124`) turns web-ml's `fold-complete` event into an ordinal log note and discards the event's `score` and `meanScore`. Neither `TrainingSession` (`src/stores/training.store.ts:25-31`) nor `ModelRecord` stores a start time.

**Target behaviour:** Directly below the training log, a new presentational element `app-training-timings` shows a live HH:MM:SS elapsed clock for the run. For Cross-Validation it also shows a table with one row per fold, created as soon as the run starts, plus a final-model (refit) row. Each row has its own clock while it runs and freezes when it ends. Each fold row fills in its validation accuracy when web-ml reports that fold complete. A footer row shows web-ml's running mean accuracy, and a line estimates the time left for the remaining folds. One-Shot shows the elapsed clock only.

**Why:** Long runs currently look stalled between log entries. A ticking clock and folds filling in show that work is progressing, and they introduce fold-to-fold variation before the learner reaches Section 6.

## Scope

**In scope**

- Forward web-ml's per-fold `score` (accuracy) and `meanScore` from the worker on the existing progress reply.
- Session-only wall-clock timing in the training session store.
- New presentational element `app-training-timings` with stories, and its placement in the connected builder.
- An unstyled draft fragment in the 03-6 mockup and a human styling entry.
- Specification sync.

**Out of scope**

- Showing timings or the table after a reload, in another tab, or for a session restored from a saved result. The learner chose "live session only". Section 6's "Scores across folds" table covers saved per-fold results.
- Balanced accuracy per fold during training. It waits for upstream request `2026-11-23-01-balanced-accuracy-scoring-everywhere.md`, which a later plan can adopt.
- Live score for One-Shot. web-ml does not declare which metric the holdout `fold-complete.score` uses.
- Live per-model metrics (loss, tree depth, support vectors). They wait on the upstream request below.
- Persisting any timing in localStorage or IndexedDB, or changing `StoredEvaluation`, `ResultEnvelopeV2` or the stored log.
- Styling beyond the existing shared styles (draft mockup only).

**Must not touch:** `vendor/`, `bun.lock`, `node_modules/`, `src/types/model-evaluation.ts`, `src/features/models/training/result-validation.ts`, `specification/mockups/mockups.css`

**Constraints and invariants**

- **Sequencing:** start only after `model-training-workflow.md` is implemented. Its T5/T6 rewrite `app-model-builder-view.ts`, `app-training-progress.ts` and `tests/training-panels.e2e.ts`; `beta-console-errors-and-csp-fixes.md` (ready, earlier in the agreed order) also edits the builder. Implement against the code those plans leave, and do not reopen their decisions.
- **Repository boundary:** samata never computes model metrics. The fold accuracy and running mean come verbatim from web-ml events. Wall-clock timing and the time-left estimate are display arithmetic on timestamps the app records itself, not model evaluation.
- The progress bar's percentages, log entries, live-region announcements and the 250-entry log cap stay unchanged. The table never becomes a live region.
- `app-training-progress` keeps its public API as left by `model-training-workflow.md`. The new element is a sibling, not a child.
- A late, mismatched or duplicate reply cannot change timings; timings change only where `applyTrainingSessionUpdate` already accepts the reply.
- No timers run when no run is active. The element's ticker stops on disconnect and once the run ends.
- `Intl.DurationFormat` is not Baseline Widely available; do not use it. Format each clock segment through the i18n number formatter.

## Required reading

- `specification/COMPONENTS.md` §3–§10 — rules for the new element, its labels object, ticker controller, stories and tests (T4, T5).
- `specification/components/training-progress.md` — the sibling's contract and the builder's ownership of strings and announcements (T4, T5).
- `specification/visual-design.md` §1.1 — draft-mockup styling limits (T1, T4).
- `specification/machine-learning-orchestrator.md` §3 — worker reply and session contract (T2, T3).
- `specification/workflow-steps.md` §3 Train Models › 5. Training — user-facing Section 5 rules (T5, T6).
- `node_modules/web-ml/dist/src/training/cross-validate.d.ts` lines 80-112 — `CrossValidationEvent`, including `fold-complete { foldIndex, score, meanScore }` (T2).

## Codebase context

Facts verified by `codebase-scout` on 2026-11-25 against installed `web-ml` 0.2.0 (`vendor/web-ml/web-ml-0.2.0.tgz`; `../web-ml` is also 0.2.0).

- **Relevant specifications:** `specification/components/training-progress.md` — presentational, closed API, builder supplies all strings. `specification/workflow-steps.md` §3 › 5. Training — line 187 defers only nested-evaluation and tuning timing tables, which this plan leaves in place. `specification/mockups/03-6_train-models-5-train.html` — `status="draft"`, `<details class="log">` examples at lines 331-416, completion `<p>Elapsed time 2.1 sec</p>` at line 480.
- **web-ml contract:** `crossValidate(request, { signal, onModel })` returns `run.events: AsyncIterable<CrossValidationEvent>` (`cross-validate.d.ts:114-147`); there is no `onProgress`. Events: `fold-start { foldIndex, foldCount }`, `fold-progress { foldIndex, event }`, `fold-complete { foldIndex, score, meanScore }`, `refit-start { sampleCount }`, `refit-progress`, `refit-complete { durationMs }` and terminal events (:80-112). `scoring` is required, `'accuracy' | 'f1'` for classifiers (:24, :33); samata sends `accuracy` (orchestrator §2). `score` and `meanScore` have no TSDoc. `metrics.md` L88 and L156-157 describe `score` as the validation-fold score. `HoldoutValidationEvent` is `fold-start | fold-progress | fold-complete | terminal` (`holdout-validate.d.ts:17-19`). Holdout has no `scoring` field, so its score metric is undeclared. Live per-model metrics need `liveMetrics`, which exists only on `BaseTrainingRequest` (`training/types.d.ts:64`).
- **Worker:** `src/features/models/training/training-worker.ts:75-108` calls `holdoutValidate` (forwards only `fold-progress` to `mapper.training`) and `crossValidate` (`consumeEvents(run.events, mapper.crossValidation, send)`). Mapper factory `createTrainingProgressMapper(foldCount)` in `progress.ts:21`. `fold-start` emits note `{ key: 'fold-start', fold, folds }` (:98). `fold-complete` emits percent `10 + completed/foldCount × 75` and note `{ key: 'fold-complete', fold }` (:111-114). `refit-start`/`refit-complete` emit notes with those keys (:118-120). `fold` in notes is 1-based.
- **Protocol:** `TrainingWorkerReply` in `src/features/models/training/protocol.ts:42-47`; the progress arm is `{ kind: 'progress'; progress; note?: TrainingLogMessage }`. Decoded by `decodeTrainingWorkerReply` (:139-163) through the guard (:166-180), accepted at `training-service.ts:423`, applied with `applyTrainingSessionUpdate` (:437). `TrainingLogMessage` is in `src/types/model-result.ts:27-41`.
- **Session store:** `src/stores/training.store.ts`. `$trainingSession` (:34) is one in-memory map keyed by `trainingSessionKey(identity)` = dataset, model number and run ID (:37-39); it is never written to storage and never cleared before reload. Exports: `appendTrainingLog(entries, message, timestamp = Date.now())` :42, `createTrainingSession(identity)` :69, `getTrainingSession` :85, `applyTrainingSessionUpdate(identity, update)` :91, `setTrainingSessionStatus(identity, status, logEntries?)` :122. Sessions are created at `training-service.ts:662` for a live start and at `training-service.ts:933` and `src/stores/reconciler.ts:274` for restored results. The setup is `ValidationMethodology` (`src/types/state.ts:122-133`), with the fold count in `outerFolds` for `type: 'nested_cv'`.
- **Builder:** `src/features/models/app-model-builder-view.ts` — `renderTrainingSection` :1724, `displaySession` :305-319, `updateTrainingAnnouncement` :1469-1482 (announces each new log entry, including "Fold {fold} complete"), `durationText` :1772-1781, base-locale catalogue `i18n('app-model-builder-view', …)` :110-214, `$format` from `src/i18n.ts:14`. Other tabs show "Training in another tab" and have no session.
- **Reusable styles:** `tableStyles` from `src/styles/table.styles.ts:7` with `.table.table-compact`, as used by `src/features/results/app-fold-strip.ts:48,188-198`.
- **Tests and commands:** `tests/training-progress.test.ts` (mapper), `tests/training-protocol.test.ts`, `tests/training-service.test.ts`, `tests/training-panels.e2e.ts` (connected panel, with the scripted fake worker `controlTraining` in `tests/fixtures/training/browser.ts:95` whose `reply(event)` injects worker replies), `tests/classification-training.e2e.ts`, `tests/a11y.e2e.ts`, `tests/style-tokens.test.ts`. Baseline not run during planning.
- **Web guidance:** `responsive-table` — semantic `<table>` with `<caption>`, column and row `<th>`, and a focusable `role="region"` scroll wrapper named by the caption. No guide covers timers. Following WAI-ARIA, the clock is plain text in a `<time>` element with no live role, so it never announces each second.
- **Visual reference:** `specification/mockups/03-6_train-models-5-train.html` (draft) — no parity mapping (visual-design §1.1). Reuse `tableStyles` and the existing focus-outline token from `app-training-progress.ts:55-73`.
- **Domain skills:** `lit-architecture-planner` (this plan); `lit-component-implementer` for T4 and T5.
- **Assumptions requiring verification:** (A1) `meanScore` on `fold-complete` is the equal-weight mean of the folds completed so far. web-ml does not document this; the upstream request asks it to. T2 checks it (see T2) and escalates if it does not hold. (A2) The `model-training-workflow.md` stopped state keeps the matching terminal session displayed, so a stopped table stays visible. T5 confirms this against the landed code.

## Technical decisions

| Decision               | Chosen approach and rationale                                                                                                                                                                                                                                                                                                                                                                                                           | Rejected alternative / trade-off                                                                                                               |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 Placement           | Sibling element rendered by the builder directly after `<app-training-progress>`, always visible (learner's choice). The table is visible whether or not the log is open.                                                                                                                                                                                                                                                               | Inside `<details>`: hidden by default, and it would reopen `app-training-progress`'s API, which `model-training-workflow` T6 is changing.      |
| D2 Tier and tag        | Presentational `app-training-timings` in `src/features/models/app-training-timings.ts`. `app-` because it is feature-specific; presentational because it needs only data in and no intents out. Owns its 1-second ticker in a private reactive controller in the same file (COMPONENTS §4), so only this element re-renders each second.                                                                                                | Ticking in the connected builder would re-render the whole builder every second. A shared clock store would add a global timer side effect.    |
| D3 Fold score          | Live **accuracy** from `fold-complete.score`, labelled "Accuracy" (learner's choice). The running mean is web-ml's `meanScore`.                                                                                                                                                                                                                                                                                                         | Balanced accuracy, which is not live until upstream request 01 ships. Timings only.                                                            |
| D4 Score transport     | Add an optional `foldScore` field to the progress reply, separate from `note`. The stored log and `ResultEnvelopeV2` stay unchanged.                                                                                                                                                                                                                                                                                                    | Adding scores to the `fold-complete` log note would change the persisted log schema and its validation.                                        |
| D5 Clock source        | `performance.now()` on the main thread when the store applies an accepted reply. It is monotonic, unaffected by system clock changes, and controllable by Playwright's clock. Main-thread receipt includes negligible message latency.                                                                                                                                                                                                  | Worker timestamps use a different time origin. Library `durationMs` is not on `fold-complete` (it is optional item 4 of the upstream request). |
| D6 Live session only   | Timing exists only on sessions created by a live start in this tab. Restored sessions (`training-service.ts:933`, `reconciler.ts:274`) get `timing: null`, so the element is not rendered (learner's choice).                                                                                                                                                                                                                           | Rebuilding from `StoredPartition.durationMs` would show times different from those the learner watched, and would need a new decoding path.    |
| D7 One elapsed display | When the displayed session has `timing`, the builder passes an empty `durationText` and the element shows the frozen total. Restored sessions keep `durationText`.                                                                                                                                                                                                                                                                      | Showing both "Elapsed time 83.4 seconds" (library duration) and "00:01:24" (wall clock) side by side would contradict itself.                  |
| D8 Time-left estimate  | Cross-Validation only, after at least one fold completes and while any fold is waiting or running: mean of completed fold wall-clock durations × (waiting folds + 1 if a fold is running) − the running fold's elapsed time, floored at 0. Labelled as the folds' time only; hidden during refit and after the run. Coarse wording ("About 3 minutes left for the remaining folds", "Less than a minute left…") avoids false precision. | Including the refit would need a guess, since its cost is unknown. Second-level precision would jitter and look authoritative.                 |
| D9 Clock format        | `H:MM:SS` text `{hours}:{minutes}:{seconds}` from an i18n message, each segment formatted by `$format.number` with `minimumIntegerDigits: 2` (hours unpadded beyond 2, never wrapped at 24). Machine-readable `<time datetime="PT{h}H{m}M{s}S">`. Times are floored to whole seconds.                                                                                                                                                   | `Intl.DurationFormat`: not Baseline Widely available. Hand-built zero padding would break localised digits.                                    |
| D10 Status not colour  | Each row has a Status cell with text (Waiting, Training, Done, Stopped). Numeric cells use `font-variant-numeric: tabular-nums` so ticking digits do not shift the layout.                                                                                                                                                                                                                                                              | A colour or icon alone would fail WCAG 1.4.1.                                                                                                  |

### Interfaces and behaviour

**Worker → main (T2).** In `src/features/models/training/protocol.ts`:

```ts
/** Live validation score web-ml reported for one completed fold. */
export interface TrainingFoldScore {
	/** 1-based fold ordinal in arrival order, copied from the accompanying fold-complete note's `fold`. */
	readonly fold: number;
	/** web-ml `fold-complete.score` for accuracy scoring, in [0, 1]. */
	readonly accuracy: number;
	/** web-ml `fold-complete.meanScore`, in [0, 1]. */
	readonly meanAccuracy: number;
}
```

The progress arm becomes `{ kind: 'progress'; progress; note?: TrainingLogMessage; foldScore?: TrainingFoldScore }`, and `TrainingUpdate` (`progress.ts:6`) gains the same optional `foldScore`. The worker already spreads each update into the reply (`training-worker.ts:170-171`), so it needs no change. The Cross-Validation mapper sets `foldScore` only on the `fold-complete` update it emits, and `foldScore.fold` is the same `fold` value it puts in the note: the arrival ordinal from `ordinal()` (`progress.ts:81-89`), never `foldIndex + 1`. A duplicate `fold-complete` already returns `null`, so it carries no score. If `score` or `meanScore` is not a finite number in [0, 1], the mapper omits `foldScore`; the run continues and the note is sent as today. The decoder rebuilds the progress arm field by field (`protocol.ts:149-155`), dropping unknown keys, so it must copy `foldScore` into the rebuilt object explicitly. It accepts `foldScore` only when `note?.key === 'fold-complete'`, `foldScore.fold === note.fold`, the fold is an integer ≥ 1, and both values are finite in [0, 1]. Any other `foldScore` rejects the reply, as other malformed fields do. The holdout path stays unchanged. Table rows are numbered by the same arrival ordinal as the log ("Fold 2" is the second fold to start).

**Session timing (T3).** Types in the new framework-free module `src/types/training-timing.ts`, imported by the store and, type-only, by the element:

```ts
export type TrainingRowStatus = 'waiting' | 'running' | 'complete' | 'stopped';

export interface TrainingRowTiming {
	readonly status: TrainingRowStatus;
	/** performance.now() when the row started, or null while waiting. */
	readonly startedAt: number | null;
	/** performance.now() when the row ended, or null while waiting or running. */
	readonly endedAt: number | null;
}

export interface TrainingFoldTiming extends TrainingRowTiming {
	readonly fold: number; // 1-based arrival ordinal, as in the log notes
	readonly accuracy: number | null;
}

export interface TrainingTiming {
	readonly startedAt: number;
	readonly endedAt: number | null;
	/** Empty for One-Shot; one entry per outer fold for Cross-Validation. */
	readonly folds: readonly TrainingFoldTiming[];
	/** Final-model refit row for Cross-Validation; null for One-Shot. */
	readonly refit: TrainingRowTiming | null;
	/** Latest web-ml meanScore, or null before the first fold completes. */
	readonly meanAccuracy: number | null;
}
```

`TrainingSession` in `src/stores/training.store.ts` gains `readonly timing: TrainingTiming | null`.

- `createTrainingSession(identity, setup?: ValidationMethodology, now = performance.now())`. A live start (`training-service.ts:662`) passes `config.setup`. The session is created with `timing.startedAt = now`, `endedAt: null`, `outerFolds` rows `{ fold: i, status: 'waiting', startedAt: null, endedAt: null, accuracy: null }` and `refit: { status: 'waiting', … }` for `nested_cv`, or `folds: []` and `refit: null` for `one_shot`. Restored callers pass no setup and get `timing: null`.
- `applyTrainingSessionUpdate(identity, update, now = performance.now())`, applied only after the existing acceptance checks and only while `timing.endedAt` is null:
    - note `fold-start` (fold n): row n becomes `running` with `startedAt = now`.
    - note `fold-complete` (fold n): row n becomes `complete` with `endedAt = now`; if `foldScore` is present, set `accuracy` and `timing.meanAccuracy`. A `fold-complete` for a row not yet started sets `startedAt = endedAt = now`.
    - note `refit-start` / `refit-complete`: the same transitions for `refit`.
    - Repeated transitions are ignored (a `complete` row never goes back to `running`).
- `endTrainingTiming(identity, outcome: 'complete' | 'stopped', now = performance.now()): boolean` (new action). The service calls it inside `settle` in `runWorker` (`training-service.ts:411-418`), the single resolver for every worker outcome, after the `done` check and before `resolve`. An accepted `success` reply passes `'complete'`. `failed` and `cancelled` replies and the synthesised crash, startup and protocol failures (`:432`, `:446`, `:450`, `:455`) pass `'stopped'`. The action sets `timing.endedAt = now` if it is null. `'complete'` turns any still-running row into `complete` with `endedAt = now`. `'stopped'` turns running rows into `stopped` with `endedAt = now`. Waiting rows stay waiting. A session with `timing: null`, or a second call, is a no-op returning `false`.
- `setTrainingSessionStatus` does not touch timing. The clock is therefore frozen from the worker's terminal reply onwards, through `saving`, `publication-pending` and `stopped-pending` (`training-service.ts:486-488`, `:612-615`), however long they last, and the rows keep the state the worker left them in. A run whose result later fails to save keeps its `complete` timing; the stopped notice explains the failure.
- Timing is never persisted and adds no new storage keys.

**Element (T4).** `app-training-timings`, presentational, closed public API:

| Property | Type                     | Default                    |
| -------- | ------------------------ | -------------------------- |
| `timing` | `TrainingTiming \| null` | `null` (renders `nothing`) |
| `labels` | `TrainingTimingsLabels`  | English defaults below     |

Both use `attribute: false` and are unreflected. There are no events, slots, parts, CSS custom properties or methods. `TrainingTimingsLabels` is exported from the element file:

```ts
export interface TrainingTimingsLabels {
	readonly elapsed: string; // "Elapsed"
	readonly caption: string; // "Progress by fold"
	readonly foldColumn: string; // "Fold"
	readonly statusColumn: string; // "Status"
	readonly timeColumn: string; // "Time"
	readonly accuracyColumn: string; // "Accuracy"
	readonly status: Readonly<Record<TrainingRowStatus, string>>; // Waiting / Training / Done / Stopped
	readonly refitRow: string; // "Final model (all rows)"
	readonly meanRow: string; // "Mean so far"
	readonly notScored: string; // "Not scored" (refit accuracy cell)
	readonly pending: string; // "Not yet" (empty time/accuracy cells)
	foldRow(fold: number): string; // "Fold {fold}"
	formatClock(ms: number): string; // H:MM:SS, D9
	formatAccuracy(value: number): string; // percent, one decimal place
	formatRemaining(ms: number): string; // D8 wording
}
```

Defaults format with `Intl.NumberFormat('en')` so stories work without the builder. The builder always supplies localised labels.

Rendering:

1. `<p class="elapsed">{elapsed} <time datetime="PT…">{clock}</time></p>`, where the total is `(timing.endedAt ?? now) − timing.startedAt`.
2. When D8 applies: `<p class="remaining">{formatRemaining(ms)}</p>`.
3. When `folds.length > 0`: `<div class="table-scroll" role="region" tabindex="0" aria-labelledby="timings-caption">` containing `<table class="table table-compact">` with `<caption id="timings-caption">`. The header row has four `<th scope="col">` cells. Body rows are keyed with `repeat` by fold number. Each row has a `<th scope="row">` (`foldRow(n)`), a status cell, a time cell (`<time>` for a running or ended row; `pending` while waiting) and an accuracy cell (formatted value or `pending`). The refit row follows with key `refit` and the `notScored` accuracy cell. A `<tfoot>` row has `<th scope="row">{meanRow}</th>`, an empty status cell, an empty time cell and the mean accuracy or `pending`.
4. Elapsed values for rows are `max(0, (row.endedAt ?? now) − row.startedAt)`; the total is clamped the same way.

The `now` value is private `@state`, updated by a private `TickController` declared in the same file. In `hostConnected` and in `hostUpdate`, the controller schedules a 1000 ms `setTimeout` chain only while `timing && timing.endedAt === null`, and clears it in `hostDisconnected` or once the run ends. In `willUpdate`, whenever `timing` has changed, the element first refreshes `now = performance.now()`, so a row that started after the last tick never shows a stale or negative time. Derived values (row clocks, total, remaining) are then computed in `willUpdate`, not in `render()`, and every derived duration is clamped at 0.

**Builder (T5).** `renderTrainingSection` renders `<app-training-timings .timing=${session.timing} .labels=${this.trainingTimingsLabels}>` immediately after `<app-training-progress>` when the displayed session (live or the retained matching terminal session) has `timing`. It then passes `durationText = ''` (D7). The labels object is built once per locale change in `willUpdate` from new catalogue keys: `timingsElapsed`, `timingsCaption`, `timingsFold`, `timingsStatus`, `timingsTime`, `timingsAccuracy`, `timingsWaiting`, `timingsRunning`, `timingsDone`, `timingsStopped`, `timingsRefit`, `timingsMean`, `timingsNotScored`, `timingsPending`, `timingsFoldRow` ("Fold {fold}"), `timingsClock` ("{hours}:{minutes}:{seconds}"), `timingsRemainingMinutes` (count-based: "About {minutes} minute(s) left for the remaining folds", rounded up) and `timingsRemainingUnderMinute` ("Less than a minute left for the remaining folds"). Accuracy uses `$format.number(value, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 })`. Announcements stay unchanged.

**Accessibility.** The clock and table are not live regions; existing milestone announcements already say "Fold n complete". The scroll region is focusable and named by the caption. Status is in text. Checks cover 320 px reflow (the region scrolls; the page does not), 200% zoom, forced colours (the table borders come from `tableStyles`) and RTL. Manual check: with VoiceOver in Safari, confirm that the clock is not read every second, and that table navigation reads the row and column headers.

## Specification changes

- [ ] `specification/components/training-timings.md` (new, `implemented`) — summary, presentational tier, closed API above, rendering and ticker rules, accessibility, strings owned (none: labels from the builder), acceptance IDs TT-AC-1…8, stories, files, non-goals (no persistence, no live per-model metrics).
- [ ] `specification/README.md` §Component specs — add the `training-timings.md` row.
- [ ] `specification/components/training-progress.md` §1/§4 — the builder renders `app-training-timings` as a sibling below the log; `durationText` is empty while a live-timed session is shown.
- [ ] `specification/workflow-steps.md` §3 Train Models › 5. Training — add the elapsed clock, per-fold table, refit row, running mean, folds-only time-left estimate and live-session-only rule. Keep the existing sentence that defers nested-evaluation and tuning timing tables (line 187); it already excludes this table.
- [ ] `specification/machine-learning-orchestrator.md` §3 — the optional `foldScore` on progress replies, its validation, and session-only wall-clock timing created only for live starts and ended on the worker's terminal reply.
- [ ] `specification/HUMAN.md` §6 — add "Style live training timings in 03-6" (T1).

## Implementation tasks

### T1 — Draft the timings fragment in the 03-6 mockup

- **Depends on:** None
- **Risk:** routine
- **Likely files:** `specification/mockups/03-6_train-models-5-train.html`, `specification/HUMAN.md`
- **Must not touch:** `specification/mockups/mockups.css`, `specification/mockups/style.css`, `specification/mockups/css/` — the draft carries no styling.
- **Implementation:** Keep `<meta name="status" content="draft" />`. After "Example 3 Refitting Training Log", add an unstyled semantic fragment wrapped in `<!-- Live Timings: Cross-Validation -->` / `<!-- This will display below the training log while a Cross-Validation run trained in this tab is in progress or has just finished. -->` / `<!-- / Live Timings: Cross-Validation -->`. Its markup is exactly the element's shadow structure from _Interfaces and behaviour_ (elapsed line, remaining line, region, table with five folds: two Done with accuracies, one Training, two Waiting, a Waiting refit row and a Mean so far footer). Add a second fragment `Live Timings: One-Shot` with the elapsed line only. Add a §6 item to `specification/HUMAN.md` linking the fragments for styling, following the queue's existing format.
- **Acceptance criteria:**
    - [ ] The two fragments use the comment convention of visual-design §1.1, and the file's status is still `draft`.
    - [ ] `bun run audit:mockups specification/mockups/03-6_train-models-5-train.html` reports no new violations in the fragments.
- **Verification:** `bun run audit:mockups specification/mockups/03-6_train-models-5-train.html`, `bun run plans:check`
- **Progress:** [ ] Not started

### T2 — Forward fold accuracy and running mean from the worker

- **Depends on:** None
- **Risk:** needs care — the reply decoder is a trust boundary, and a regression would reject every Cross-Validation progress reply.
- **Likely files:** `src/features/models/training/protocol.ts`, `src/features/models/training/progress.ts`, `tests/training-progress.test.ts`, `tests/training-protocol.test.ts`, `tests/fixtures/training/runtime.worker.ts`, `tests/training-runtime.e2e.ts`
- **Must not touch:** `src/types/model-result.ts`, `src/types/model-evaluation.ts`, `src/features/models/training/result-validation.ts` — the log and result schemas stay unchanged (D4).
- **Implementation:** Add `TrainingFoldScore` with TSDoc, the optional `foldScore` on the progress arm and on `TrainingUpdate`, the mapper change and the decoder change exactly as in _Interfaces and behaviour_. Leave percent and note logic unchanged. Check assumption A1 against the real runtime by extending the existing probe. `tests/fixtures/training/runtime.worker.ts` is bundled by `scripts/build-assets.ts:247` and served as `/runtime.worker.js`, so it can import app modules. Add a fourth probe command, `'cross-validation'`, to its command union and `onmessage` handler. It builds a deterministic 40-row, one-feature, two-class `ArrayDatasetProvider` whose classes overlap (for example label 1 for rows with `row % 5 === 0` among the first half and label 0 for `row % 5 === 0` in the second half), so fold accuracies differ. It calls `runtime.crossValidate` with the fields `buildClassificationRequest` sets for Cross-Validation (`classifier-adapters.ts:129-138`: `folds: 5`, `randomState: 42`, `scoring: 'accuracy'`, `refit: true`), with `algorithm: 'support-vector-classifier'`, `options: { kernel: 'linear' }` and `classLabels: ['left', 'right']` as in the existing probe commands. It feeds every event through `createTrainingProgressMapper(5).crossValidation`, wraps each non-null update as `{ kind: 'progress', identity, ...update }` with a fixed fixture identity, and decodes it with `decodeTrainingWorkerReply`. It posts `{ kind: 'cross-validation', raw: [{ foldIndex, score, meanScore }…], foldScores: TrainingFoldScore[], rejected: number }`, then disposes any returned model. Add `'cross-validation'` to `ProbeReply` and `runProbe` in `tests/training-runtime.e2e.ts`, and add a test for both origins. If `meanAccuracy` does not hold as the running mean, stop and escalate; do not compute a mean in samata.
- **Acceptance criteria:**
    - [ ] LTM-W-1 — The mapper emits `foldScore` on `fold-complete` only, with `fold` equal to the note's arrival ordinal, plus `score` and `meanScore`. A unit test whose folds complete out of index order (`foldIndex` 3 starts and completes first) gets `foldScore.fold === note.fold === 1`, and the decoder accepts the reply.
    - [ ] LTM-W-2 — The mapper omits `foldScore` for NaN, negative and >1 values, and the percent and note are unchanged.
    - [ ] LTM-W-3 — The decoder accepts a valid `foldScore` and returns it on the decoded reply. It rejects one without a `fold-complete` note, one with a mismatched fold, a non-integer or zero fold, or an out-of-range or non-finite value. Replies without `foldScore` decode exactly as before, with no `foldScore` key.
    - [ ] LTM-W-4 — For both origins, the `'cross-validation'` probe returns `rejected: 0`, five `raw` events and five `foldScores` with `fold` 1…5 in arrival order. Each `accuracy` equals the matching raw `score`. For each k, `meanAccuracy` equals the mean of the first k `accuracy` values within 1e-9 (A1). At least two fold accuracies differ, so the check is not trivially true.
- **Verification:** `bun test tests/training-progress.test.ts`, `bun test tests/training-protocol.test.ts`, `bun run test:e2e tests/training-runtime.e2e.ts`, `bun run typecheck`
- **Progress:** [ ] Not started

### T3 — Session-only wall-clock timing in the training store

- **Depends on:** T2
- **Risk:** needs care — the store is shared by live, restored and reconciled sessions, and the restored paths must stay timing-free.
- **Likely files:** `src/types/training-timing.ts`, `src/stores/training.store.ts`, `src/features/models/training/training-service.ts`, `tests/training-progress.test.ts`, `tests/training-service.test.ts` — the existing store-action tests are at lines 78–115 of `tests/training-progress.test.ts`.
- **Must not touch:** `src/stores/persister.ts`, `src/stores/reconciler.ts`, `src/types/state.ts` — no persisted shape changes; the reconciler's existing `createTrainingSession(identity)` call must yield `timing: null` unchanged.
- **Implementation:** Add the types and action changes from _Interfaces and behaviour_ with TSDoc. Use injectable `now` parameters defaulting to `performance.now()`. Pass `config.setup` at the live start (`training-service.ts:662`) only, and call `endTrainingTiming` from `settle` (`training-service.ts:411-418`) as specified. Pass the reply's `foldScore` through the existing `TrainingUpdate` path into `applyTrainingSessionUpdate`. Keep updates immutable: replace the arrays, never mutate them.
- **Acceptance criteria:**
    - [ ] LTM-S-1 — A live Cross-Validation start with `outerFolds: 5` creates five waiting fold rows, a waiting refit row, `meanAccuracy: null` and `startedAt` equal to the injected `now`. A One-Shot start creates `folds: []` and `refit: null`.
    - [ ] LTM-S-2 — `fold-start`, `fold-complete` (with and without `foldScore`), `refit-start` and `refit-complete` produce the specified transitions and timestamps. Duplicate or out-of-order notes never regress a row.
    - [ ] LTM-S-3 — `endTrainingTiming(…, 'complete')` sets `endedAt` and completes any running row. `'stopped'` sets `endedAt`, turns running rows into `stopped` and leaves waiting rows waiting. A second call returns `false`. Notes applied after the end change no timing.
    - [ ] LTM-S-5 — Service tests: a `success` reply ends the clock before saving starts, and a later `setTrainingSessionStatus` to `'saving'`, `'publication-pending'` or `'complete'` leaves `timing` unchanged. A cancel with `stopped-pending` (a publication failure in `repairStopped`) keeps the clock frozen at the worker's `cancelled` reply. A worker crash ends the clock with the running row `stopped`.
    - [ ] LTM-S-4 — Sessions created by the restore and reconcile paths have `timing: null`. A reply rejected by the existing identity checks changes no timing.
- **Verification:** `bun test tests/training-progress.test.ts`, `bun test tests/training-service.test.ts`, `bun run check`
- **Progress:** [ ] Not started

### T4 — Presentational `app-training-timings` element and stories

- **Depends on:** T3
- **Risk:** needs care — the ticker lifecycle and the table semantics are new.
- **Likely files:** `src/features/models/app-training-timings.ts`, `src/features/models/app-training-timings.stories.ts`, `tests/training-timings.e2e.ts`
- **Must not touch:** `src/features/models/app-training-progress.ts`, `src/stores/` — preserve the sibling API from `model-training-workflow` (D1) and keep the presentational element free of store imports (COMPONENTS §2, §5).
- **Implementation:** Build the element exactly as specified, with `@customElement`, the `HTMLElementTagNameMap` augmentation, `accessor` decorated fields, CEM JSDoc and English default labels. Import only types, and only from `src/types/training-timing.ts`; never import from `src/stores/`. The private `TickController` uses `setTimeout` and must not run while `timing` is null or ended. Stories: Waiting (all rows waiting, clock at 0:00:00), Mid-run (two Done with accuracies, one Training, mean and remaining shown), Refitting (all folds Done, refit Training, no remaining line), Complete, Stopped (fold 3 Stopped, folds 4–5 Waiting), One-Shot running, One-Shot complete, Long label (labels about 40% longer) and RTL. Build story timestamps relative to `performance.now()` at render. The docs page adds Do (use under the training log for a run trained in this tab) and Don't (feed saved results; place inside a live region). Write component tests in `tests/training-timings.e2e.ts` using the presentational pattern in `tests/content-dialog.e2e.ts:18-40`: `bun build` the element in `beforeAll`, `page.setContent` with `css/root.css`, `addScriptTag`, then set properties through `page.evaluate`. Call `page.clock.install()` before `setContent` so `performance.now()` and `setTimeout` are controlled.
- **Acceptance criteria:**
    - [ ] TT-AC-1 — With `timing: null` the element renders nothing.
    - [ ] TT-AC-2 — The total clock reads `0:00:00`, then `0:01:05` after `page.clock.runFor(65_000)`, and stops advancing once `endedAt` is set. `<time datetime>` is `PT0H1M5S`.
    - [ ] TT-AC-3 — A Cross-Validation timing renders a captioned table with column headers Fold, Status, Time and Accuracy, one row header per fold, the refit row and the Mean so far footer. Waiting cells read "Not yet" and the refit accuracy reads "Not scored".
    - [ ] TT-AC-4 — Only running rows advance; completed and stopped rows keep their frozen time; accuracies render as one-decimal percentages.
    - [ ] TT-AC-5 — The remaining line appears only with at least one completed fold and at least one waiting or running fold, and it uses the D8 formula (for example two folds of 60 s done, one running for 20 s and one waiting gives 100 s, rendered as "About 2 minutes left…").
    - [ ] TT-AC-6 — One-Shot timing renders only the elapsed line.
    - [ ] TT-AC-7 — After disconnection, or after the run ends, no timer remains scheduled: `page.clock.runFor` produces no further renders, observed through an unchanged clock text and no console errors.
    - [ ] TT-AC-8 — At 320 px the region scrolls horizontally inside itself without page overflow. It is keyboard-focusable with a visible outline. RTL mirrors the column order. The long-label story wraps without clipping, and axe reports no violations.
- **Verification:** `bun run test:e2e tests/training-timings.e2e.ts`, `bun run storybook:manifest`, `bun run test:stories`, `bun test tests/style-tokens.test.ts`, `bun run lint`
- **Progress:** [ ] Not started

### T5 — Render timings in the builder

- **Depends on:** T4
- **Risk:** needs care — the builder is shared with the stopped, remote and publication-pending states from `model-training-workflow`.
- **Likely files:** `src/features/models/app-model-builder-view.ts`, `src/features/models/app-model-builder-view.stories.ts`, `tests/training-panels.e2e.ts`, `tests/classification-training.e2e.ts`, `tests/a11y.e2e.ts`
- **Must not touch:** `src/features/models/app-training-progress.ts`, `src/features/models/training/` — the worker and service contracts are fixed by T2/T3.
- **Implementation:** Add the catalogue keys and the labels object from _Interfaces and behaviour_. Render the element after `<app-training-progress>` when the displayed session has `timing`, including the retained matching terminal (stopped) session; confirm A2 against the landed code. Pass `durationText = ''` in that case. Leave announcements, focus and the log unchanged. Update existing assertions on "Elapsed time" in `tests/training-panels.e2e.ts:141` so they cover the restored-session path, where `durationText` still applies. Add connected tests using `controlTraining` and `page.clock`. Call `page.clock.install()` before navigation and do not pause it, so real-time waits keep working. Advance timings with `page.clock.fastForward(ms)`, which also fires any due persister timers (`persister.ts:1262-1286`; the progress write is throttled to 1000 ms). Before any reload, `fastForward` by at least 1000 ms so persisted state is written exactly as in production.
- **Acceptance criteria:**
    - [ ] LTM-B-1 — Starting Cross-Validation with five folds immediately shows five Waiting rows, the refit row and a ticking clock under the log, with the log both collapsed and open.
    - [ ] LTM-B-2 — Scripted `fold-start`/`fold-complete` replies with `foldScore` fill rows in order, update Mean so far and show the time-left line. Scripted `refit-start` hides that line and starts the refit row.
    - [ ] LTM-B-3 — On acknowledged completion, the clock freezes, all rows show Done, and "Elapsed time" `durationText` is absent. After reload, the trained-but-unacknowledged model shows no timings element and keeps its existing behaviour.
    - [ ] LTM-B-4 — Cancelling mid-fold freezes the clock and marks the running fold Stopped in the stopped state. Another tab shows no timings element.
    - [ ] LTM-B-5 — The live region announces the same milestones as before; timer ticks produce no announcements.
    - [ ] LTM-B-6 — A One-Shot run shows only the elapsed clock.
    - [ ] LTM-B-7 — The panel axe scan (`assertPanelAccessibility`) passes mid-run and at completion.
- **Verification:** `bun run test:e2e tests/training-panels.e2e.ts`, `bun run test:e2e tests/classification-training.e2e.ts`, `bun run test:e2e tests/a11y.e2e.ts`, `bun run test:stories`, `bun run check`. Manually check with VoiceOver in Safari that the clock is silent and that table cells read their headers.
- **Progress:** [ ] Not started

### T6 — Sync specification

- **Depends on:** T5
- **Risk:** routine
- **Likely files:** `specification/components/training-timings.md`, `specification/components/training-progress.md`, `specification/README.md`, `specification/workflow-steps.md`, `specification/machine-learning-orchestrator.md`, `specification/plans/live-training-metrics.md`, `specification/plans/README.md`
- **Must not touch:** `src/`, `tests/`
- **Implementation:** Apply every item under _Specification changes_ in present tense, following the README's Writing specs rules. The new component spec follows COMPONENTS §12. Leave the filed request and any other files in the upstream checkout to the upstream session. Run `bun run format` on the changed files.
- **Acceptance criteria:**
    - [ ] Every _Specification changes_ item is ticked, and `bun run plans:check` passes, with the spec index status column matching.
- **Verification:** `bun run plans:check`, `bun run format:check`, `bun run build`
- **Progress:** [ ] Not started

## Verification and definition of done

- [ ] All task acceptance criteria met.
- [ ] Relevant verification commands from `AGENTS.md` pass with no new failures (`bun run check`, `bun run lint`, `bun run build`, the listed `bun run test:e2e` files, `bun run test:stories`).
- [ ] Type-check, lint, formatting, and build checks pass.
- [ ] Accessibility (WCAG 2.2 AA), privacy/security, and contract-compatibility checks completed where applicable, including the VoiceOver check in T5.
- [ ] Every item under _Specification changes_ is ticked, and specifications match the implemented code.
- [ ] No unintended changes outside the tasks' likely files.

## Risks and open questions

- **Blocking:** None
- **Non-blocking:**
    - **Plan sequencing.** This plan edits files that `model-training-workflow.md` T5/T6 and `beta-console-errors-and-csp-fixes.md` also change. Owner: implementer. Start only after both are implemented. If their landed APIs differ from the facts above (for example the stopped-state session retention, A2), escalate rather than reworking their decisions.
    - **A1: `meanScore` semantics are undocumented upstream.** T2's LTM-W-4 checks them against the real runtime. If they fail, escalate; the Mean so far row is then dropped or deferred rather than computed in samata.
    - **Upstream request (non-blocking dependency):** [`../web-ml/specification/requests/2026-11-25-live-validation-run-metrics.md`](../../../web-ml/specification/requests/2026-11-25-live-validation-run-metrics.md) asks for `liveMetrics` on validation runs, documented nested events, `score`/`meanScore` semantics, holdout's score metric and optional `durationMs` on `fold-complete`. A later plan can add a live per-model chart (for example an MLP loss sparkline), a One-Shot live score and library-matched times. This plan does not wait for it.
    - **Accuracy vs balanced accuracy.** The live column is accuracy, while Section 6 leads with balanced accuracy, so a learner may see different numbers. The labels say "Accuracy" explicitly. When upstream request 01 ships, a follow-up plan can switch the scoring and the label together.
    - **Wall clock vs library duration.** Live times include worker scheduling and messaging, so they slightly exceed the library's `durationMs` shown on Models and in Section 6. They are accepted as different measures; the specs name the live one "elapsed".
    - **Time-left estimate.** Fold 1 can include runtime start-up, so early estimates may be high. The coarse wording, the label limiting it to the folds' time and hiding it during refit mitigate this.

## Escalations

None.

## Review fixes

None.

## Implementation and verification log

| When (UTC) | Task | Agent (model) | Outcome / commands / evidence |
| ---------- | ---- | ------------- | ----------------------------- |
| —          | —    | —             | Not started                   |

## Plan review history

| Reviewed (UTC)       | Agent (model)                 | Decision          | Findings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------- | ----------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-25T16:19:33Z | Claude Code (claude-opus-5-5) | changes-requested | MAJOR: T2 sets foldScore.fold = foldIndex+1 but note.fold is the arrival ordinal (progress.ts:81-89) and the decoder requires equality, so any mismatch fails the run with worker-protocol-error; use the note ordinal. MAJOR: T2 LTM-W-4 assumes tests/training-runtime.e2e.ts can run an Iris five-fold run and record decoded replies, but its probe harness tests/fixtures/training/runtime.worker.ts has only train/cancel/one-shot, no CV, no Iris CSV, and bypasses the app protocol; specify the probe, dataset, assertions and add the fixture to Likely files. MAJOR: T3 keeps the clock and running rows ticking through stopped-pending and publication-pending, which persist indefinitely after the worker has stopped or finished (training-service.ts:486-488, 612-615); define the clock end on the accepted worker terminal reply and the row state for those statuses, with tests. MINOR: T4 derives row clocks from a stale ticker now, so a row started after the last tick yields a negative time; refresh now on timing change and clamp at 0. MINOR: workflow-steps has no 3.5 and its L187 sentence already defers only nested and tuning tables; restate the spec change. MINOR: tests/training-store.test.ts does not exist; store tests are in tests/training-progress.test.ts:78-115, so name one target. MINOR: decoder rebuilds the progress arm field by field (protocol.ts:149-155) and strips unknown keys, and TrainingUpdate lives in progress.ts:6; name both. SUGGESTION: page.clock in connected T5 tests also freezes persister timers (persister.ts:315, 1262-1286); state how tests advance them. |
| 2026-11-25T16:45:53Z | Claude Code (claude-opus-5-5) | changes-requested | Prior findings resolved (fold ordinal, CV probe, settle clock end, clamped ticker, spec/test/decoder refs, page.clock). MAJOR: endTrainingTiming is called only from runWorker settle, but runs also end without a worker: cancel before worker start (training-service.ts:558 settleStopped) and a failed start checkpoint setting publication-pending or failed (:547-549), after the timed session is created at :662; the retained stopped session (A2) then ticks forever; also end timing in settleStopped and the :548 path and add LTM-S-5 cases. MINOR: probe says dispose any returned model, but the refit model is result.refit.model (cross-validate.d.ts:56-58) and the onModel doc (:145) conflicts on ownership; state dispose result.refit.model without onModel. MINOR: builder has no durationText symbol; local duration at app-model-builder-view.ts:1772-1781 is passed as .durationText at :1834. SUGGESTION: cite the count() plural pattern (app-dataset-card.ts:15-21) for timingsRemainingMinutes; TT-AC-7 cannot observe a timer after disconnect via clock text, so instrument setTimeout in an init script.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

## Change log

| When (UTC)           | Change                | Reason                                                                                                                                                                                                                                                                                                   |
| -------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-25T15:59:05Z | Initial draft         | Learner request: live elapsed timer per fold and a per-fold metrics table under the Step 5 training log. Placement, live accuracy, live-session-only scope and the extras (refit row, mean so far, time-left estimate, upstream live-metrics request) were decided by the user in the authoring session. |
| 2026-11-25T16:34:00Z | Revised after review  | Addressed the 2026-11-25T16:19:33Z changes-requested findings: fold ordinal, real-runtime CV probe, clock ending on the worker's terminal reply, stale ticker, spec and test references, decoder field copy, persister timers under `page.clock`.                                                        |
| 2026-11-26T09:03:13Z | Normalised task scope | Made the local T3, T4 and T6 path lists machine-readable and retained the upstream write boundary in T6 prose. The plan retains its draft status and outstanding review findings.                                                                                                                        |
