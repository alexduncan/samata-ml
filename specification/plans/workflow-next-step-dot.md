# Give The Dot one purpose in workflow navigation

**Status:** ready | **Updated:** 2026-11-25T15:06:39Z
**Authors:** Codex (GPT-6) | **Created:** 2026-11-25T10:57:56Z
**Verified by:** Codex (GPT-6) | **Verified:** 2026-11-25T15:06:39Z | **Verification:** approved
**Verified hash:** sha256:c2ea29a30096468c2a71c9871848b9c537c940fb272e4009759113109c848a54
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour:** The sidebar uses an animated `<span class="dot">` to mark training in progress. The sidebar has no next-step indicator and only lists numbered model records. Compare Results uses `/results`.

**Target behaviour:** The sidebar uses The Dot only to suggest the next action at the seven specified workflow moments. Visiting its destination removes it from the DOM. Its arrival produces a single two-second burst outside the sidebar's clipping containers.

**Why:** Learners choose when and where to continue through the workflow. The sidebar makes the next logical choice easier to find.

## Scope

**In scope**

- The Dot on the Load Data, Set Target and Compare Results step links, and on the dedicated Train New Model and Train Another Model sidebar links.
- Exclusive use of The Dot for navigation suggestions. Reuse the model workflow’s visible training row and trained status.
- A succinct workflow specification and synchronised sidebar, navigation and visual-design contracts.

**Out of scope**

- Defining or implementing the `/models/new` route, its draft and leave behaviour, or its transition to a numbered model.
- Renaming `/results`, renaming model records, model swatches, training/evaluation logic, new comparisons, persistence changes and unrelated mockup work.

**Constraints and invariants**

- Navigation remains learner-initiated between workflow steps. A hint never requests navigation, moves focus or changes history.
- The Dot is a decorative span. The destination is a native link with readable text and a translated, visually hidden description while suggested. Existing link names, keyboard access, focus outlines and `aria-current` semantics still apply.
- Render zero or one `<span class="dot" aria-hidden="true"></span>` in the application. Where no hint is active the span is absent. The temporary burst uses its own class and is also hidden from assistive technology.
- Use the existing production CSP, cross-origin isolation and tokens. All cue state is transient UI state and stays in the browser.

**Implementation order across plans**

Start after [Model Training Workflow](model-training-workflow.md) has landed, including its T4 sidebar and T8 journey and baseline checks. That plan owns the native train anchors, current training row, removal of its old status dot, wizard handoff and uncued parity fixture. This plan adds only cue state, link decoration and arrival motion. [Beta Console Errors and CSP Fixes](beta-console-errors-and-csp-fixes.md) supplies the unchanged strict policy and the baseline production regression. Add the cue assertion separately using the same distribution-server setup.

## Required reading

- `AGENTS.md` § Verification Commands and § Rules.
- `specification/COMPONENTS.md` §§3–10 and `specification/components/sidebar.md` §§3–10 — closed API, scope, styling and acceptance.
- `specification/workflow-steps.md` introduction and §§1–4, `specification/app-state-and-navigation.md` §§4.4 and 5, and `specification/visual-design.md` §§1, 3 and 5 — workflow, history and references.
- `specification/notes/ui-fixes.md` § Rules for The Dot, and `specification/plans/model-training-workflow.md` § Router and new-wizard ownership and § Model navigation and results for the exact delivered links.

## Codebase context

- **Relevant specifications:** `specification/workflow-steps.md` governs visible workflow behaviour. `specification/components/sidebar.md` §5 describes the current status dot. `specification/visual-design.md` §5.3 currently omits next-step guidance under SHELL-UI-02.
- **Relevant implementation:** `src/features/shell/app-sidebar.ts:125,230–247,278–320,344–457` clips the joined step rows, renders the status dot and owns all sidebar links. `src/stores/sidebar.store.ts:6–39` projects `$appState` and `$route`. `src/router/route-parser.ts:19–64` recognises `/results` and numbered models. `src/app.ts:251–288` mounts the sidebar after hydration. `src/features/models/training/training-service.ts:590–619,701–707,922–940` publishes acknowledged training results and retries. `src/stores/predicates.ts:21–28` defines the two-trained-model threshold.
- **Tests and commands:** `tests/sidebar-state.test.ts`, `tests/sidebar-acceptance.e2e.ts:58–70,123–145`, `tests/visual-parity.e2e.ts:267–313`, `tests/a11y.e2e.ts` and `tests/style-tokens.test.ts` cover shell projections, the old status dot, accessibility and geometry. Reuse `src/features/shell/app-sidebar.stories.ts`, `tests/visual-parity/fixtures.ts` and the Iris and Penguins two-model journeys. `tests/comparison.e2e.ts:83–110` provides a hydrated comparison fixture. Baseline results and task commit IDs belong in the implementation log.
- **Web guidance:** `motion` — animate opacity and transform, keep the static cue in reduced motion, and clean up even when an animation is suppressed or cancelled.
- **Visual reference:** `01-1_select-data.html`, `02-2_target-set.html` and `03-2_train-models-1-choose-model.html` supply sidebar row and dot styling. The `03-7_train-models-5-results.html` draft supplies Train Another Model structure. Reuse the sidebar's model-row layout, record the scope and markup differences under SHELL-UI-02, and keep reference files read-only.
- **Domain skills:** `lit-component-implementer` for T1 and T2.
- **Assumptions requiring verification:** T1 checks the shipped companion route contract and sidebar actions before implementing. No upstream library contract is involved.

## Technical decisions

| Decision             | Chosen approach and rationale                                                                                                                                                                                                                                                     | Rejected alternative / trade-off                                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Routes and links     | Native Train New Model and Train Another Model anchors target `/models/new`. Compare Results targets the existing `/results`. Model Training Workflow defines `a.step-train-new` and `a.step-model-link` as the native train actions and owns entry, continuation and completion. | A numeric guess or an overview link would send the learner somewhere other than the requested action.                              |
| State ownership      | Keep a framework-free, per-mounted-sidebar read-only cue projection beside the existing sidebar store. Seed the reducer from the reconciled state and feed Lit through StoreController.                                                                                           | Persistence and route flags would introduce a schema or URL contract for transient guidance.                                       |
| Dot and burst        | The sidebar renders the static dot core and schedules one body-level CSS animation on insertion. Keep document and shadow styling in one shared Lit CSSResult, adopted through the existing document style initialiser.                                                           | A descendant or pseudo-element on the sidebar link remains subject to the reference layout's overflow clipping.                    |
| Status accessibility | Preserve the visible training row and the trained check and status supplied by the companion plan. Use the translated description `Suggested next step` on the active cue's anchor.                                                                                               | A status that relies on a pulse or colour would reuse the meaning reserved for The Dot and obscure the distinction without motion. |

### Interfaces and behaviour

The only connected element affected is `app-sidebar` in `src/features/shell/app-sidebar.ts`. Its tag remains its public element API. Keep the existing read-only `$sidebarState` projection for rendering. In `src/stores/sidebar.store.ts`, create one private cue tracker per connected sidebar instance. The factory returns the read-only string-or-null cue store and start/stop lifecycle methods. The store atom is written only by the tracker. Start seeds it from the current reconciled `$appState` and `$route`. In the store module, listen synchronously to both stores. Each callback replaces the last observed value for its source with the value passed to the callback and reduces that pair once. Do not reread the other store during a callback: its next value may already be queued for delivery. Stop removes both listeners and discards its transient history. The component binds the cue store via `StoreController`; its connection hooks start and stop tracking without subscribing to stores directly. Use one coherent `$appState` snapshot per reduction for dataset ID, target, comparison context epoch and the count of `status === 'trained'` records. Compare eligibility uses that same count (two or more), matching `$canCompare`.

For destination comparisons consume the effective workflow path from the normalised route published by Model Training Workflow: workflow path when it is a workflow route and resolved underlay when it is reserved. Use the same fallback as the shell only when the router has no route. Exact and parent `aria-current` still use the actual route. Process every committed route/state pair in publication order so a later Lit update cannot skip an earlier arrival. Lit’s own update lifecycle only handles DOM insertion detection. Decorate the exact `a.step-train-new[href="/models/new"]` or `a.step-model-link[href="/models/new"]`, according to the cue, and preserve existing accessible name and description IDs when appending the visually hidden translated suggestion.

| Moment                                                   | Cue and lifetime                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No dataset                                               | Show on Step 1 `/data` whenever the learner is elsewhere. The fresh app already on `/data` has no dot.                                                                                                                                                                                                                                                                                                                                                                |
| Dataset selected                                         | Show on Step 2 `/target` as soon as the acknowledged dataset is available and no target is set, provided the learner is outside `/target`.                                                                                                                                                                                                                                                                                                                            |
| Leave Step 2 before setting a target                     | Show again on Step 2. The cue is absent for the entire time `/target` is current.                                                                                                                                                                                                                                                                                                                                                                                     |
| Set as Target succeeds                                   | Arm the cue on **Train New Model**, `/models/new`, after the target selection is published. This also applies to an acknowledged replacement target that resets the models.                                                                                                                                                                                                                                                                                           |
| Leave `/models/new` before the first successful training | Once navigation actually leaves, put the cue back on **Train New Model** only while the current context has never observed a trained model and the current trained count is zero. Stay clear of failed or cancelled navigation and Help dialogs.                                                                                                                                                                                                                      |
| First training succeeds                                  | Replace any Train New Model cue with a cue on **Train Another Model**, `/models/new`. Arm it at the first acknowledged success. While the completed new-model entry or its Help underlay is current, keep the milestone pending and render no cue. The acknowledged departure or View Results replacement exposes the existing Train Another link and shows the cue; only a subsequent entry consumes it. A completed numbered model page is a different destination. |
| Second training succeeds                                 | Replace any training-link cue with a cue on the sidebar **Compare Results** link, `/results`, when the acknowledged trained count crosses the second-completion threshold and `$canCompare` is true. If the committed projection crosses both thresholds at once, Compare takes precedence.                                                                                                                                                                           |

- Data and target prerequisites take precedence over model cues. Use the effective workflow path for every destination comparison, including history navigation. Opening, switching or closing a reserved dialog over the same effective workflow page leaves cue state unchanged. Browser history that actually changes the effective underlay follows the usual arrival/departure rule, including a historical reserved entry. Entering a cue's destination consumes that milestone immediately, even via a link elsewhere or Back/Forward. Leaving it only rearms a cue in the incomplete Step 1, Step 2 and first-training cases above. In particular, leaving Compare Results or a second attempt does not create another cue.
- Keep a previous projection, pending milestone and trained-count high-water mark in private sidebar state. Seed the mark from hydration and reset it on acknowledged dataset/target replacement, prerequisite loss or full model discard, which advance the comparison context epoch. Result-only demotion and recovery keep the same epoch and retain the mark. If a new context first arrives with already trained records from another tab, seed its count as the new baseline; only subsequent crossings in that context arm train or compare cues. Recognise each first/second crossing once in that epoch, even if reconciliation temporarily demotes and restores a record. Consume Compare immediately if it becomes available while its workflow route is already current. Compare committed snapshots before rendering the next cue. Clear stale model cues on dataset or target reset, and retire a pending Train Another cue if the trained count drops to zero and retire a Compare cue if `$canCompare` becomes false. Retirement keeps the high-water mark and does not substitute a Train New cue. Restoring the lost record cannot re-arm the retired cue. For a new target published in the same update as a reset, clear the old cue first. Arm Train New Model if that new target arrives with zero trained records. Distinguish a pending first-completion suggestion still waiting for the current run to leave `/models/new` from a suggestion already consumed by entering it.
- Use the reconciled application records as the source of truth. Initial hydration does not replay target selection or training completion. Failed, pending and cancelled commands leave the previous committed milestone in force. A later successful publication is eligible. Live acknowledged project updates observed in this tab use the same rules, including updates published by another tab. Additional trained records and status changes that do not cross the specified thresholds never replay the first or second cue.
- The Dot's insertion identity is its destination and link occurrence. Preserve the node across unrelated renders. When the actual span is newly inserted, schedule exactly one `requestAnimationFrame` from the sidebar update lifecycle. In that frame, confirm it is still the active connected node, measure its viewport rectangle, then append the matching fixed circle directly to `body`. Centre the burst on the measured core using individual CSSOM positioning properties. The shared style supplies the round `0.625rem` core and `var(--blue-700)` colour from the existing sidebar. Use the vertical and inline-end slot for each link from `specification/mockups/css/steps.css` (step and model rows). Use no inline style text, per-frame layout reads or style-policy changes. Reserve space in the existing link layout so the cue never overlaps text or the focus outline, and use a system foreground in forced colours.
- Make the burst non-interactive and layer it above the sidebar, below native modal dialogs. Animate `opacity: 1; transform: scale(1)` to `opacity: 0; transform: scale(30)` once over `2000ms`, only with `prefers-reduced-motion: no-preference`. Keep the core static. Remove the body element on animation end or cancellation, or immediately if no animation starts. Cancel a scheduled frame and remove any burst when the cue changes or the sidebar disconnects. During reduced motion render the static core without appending the burst.

## Specification changes

- [ ] `specification/workflow-steps.md` introduction — add a brief **Next-step guidance** section with the seven moments, destination consumption, manual navigation and the one-shot reduced-motion-safe arrival. Status stays partial.
- [ ] `specification/app-state-and-navigation.md` §4.4 — link to the workflow rule and describe underlay route identity and exact destination consumption. Status stays draft.
- [ ] `specification/components/sidebar.md` §§2–10 — record the store projection, link descriptions, training text, core and burst ownership, mapping, criteria and stories. Remove the outdated next-step non-goal and cite the existing training row without redefining it. Status stays implemented after the code matches.
- [ ] `specification/visual-design.md` §§3 and 5 — update the style map, SEM-09 and SHELL-UI-02 for exclusive cue use, the body-level arrival effect and text status. Status stays partial.
- [ ] `specification/HUMAN.md` — close the claimed Dot Rules entry on verification. Check specification index status alignment.

## Implementation tasks

### T1 — Put The Dot on workflow destinations

- **Depends on:** None
- **Risk:** needs care — current-destination checks, durable milestones and route transitions can occur in the same render.
- **Likely files:** `src/stores/sidebar.store.ts`, `src/features/shell/app-sidebar.ts`, `src/features/shell/app-sidebar.stories.ts`, `src/styles/workflow-dot.styles.ts`, `tests/sidebar-state.test.ts`, `tests/sidebar-acceptance.e2e.ts`, `tests/visual-parity/fixtures.ts`, `tests/journeys/iris-classification.e2e.ts`
- **Must not touch:** `src/router/`, `src/features/models/training/training-service.ts`, `src/features/models/`, `vendor/`, `bun.lock`, `specification/mockups/`
- **Implementation:** Verify the integrated companion delivers both native train links and the completed-run route handoff. Implement the state table above using the existing anchors and step links. Land the static, token-based core, reserved inline space and visually hidden description styling in this task. The burst belongs to T2. Preserve the current training row and stable list keys. A missing anchor or incompatible route is a prerequisite failure. Extend the existing sidebar stories for the suggested destinations, current/consumed states, Long label and RTL, using a deterministic before/after state fixture for live milestones and Docs guidance for correct use.
- **Acceptance criteria:**
    - [ ] DOT-AC-1 — Initial `/data` is clear. From another step without a dataset, Load Data is suggested. Dataset load and departure from Step 2 before selection suggest Set Target. The destination clears the span on arrival. Same-underlay Help preserves cue state and a different effective underlay reached via history consumes the matching cue.
    - [ ] DOT-AC-2 — Acknowledged target selection suggests Train New Model. Entering `/models/new` clears it and an incomplete first attempt's confirmed departure restores it. Cancelled departure, failed target save and stale hydrated milestones produce no new cue.
    - [ ] DOT-AC-3 — The first successful training suggests Train Another Model as soon as its destination is actionable. The second suggests the sidebar Compare Results anchor. Entering either destination by normal navigation or browser history removes its cue. Restored results, failed/cancelled training, unrelated renders and a third completion never replay a milestone. Test first success before departure, live demotion from one trained record to zero, departure and recovery. Retirement leaves no Train New cue on departure and no Train Another cue or burst when the saved result returns. A cross-tab jump from zero to two suggests Compare only.
    - [ ] DOT-AC-4 — The sidebar contains at most one `.dot`. The indicated link has a translated description and its existing name and focus. Training still shows text and the trained check and text remain. The app stays on the current workflow step at each milestone.
- **Verification:** `bun test tests/sidebar-state.test.ts`, `bun test tests/style-tokens.test.ts`, `bun run test:e2e tests/sidebar-acceptance.e2e.ts`, `bun run test:stories`, `bun run test:e2e tests/journeys/iris-classification.e2e.ts`. Use the training journey for both durable thresholds and ID-prefixed tests for queued route/state publications, loss/recovery, suppressed/consumed cues and reserved-route history.
- **Progress:** [ ] Not started

### T2 — Animate the cue arriving and verify visual parity

- **Depends on:** T1
- **Risk:** needs care — body positioning, cleanup and reduced motion cross the sidebar's shadow boundary.
- **Likely files:** `src/features/shell/app-sidebar.ts`, `src/features/shell/app-sidebar.stories.ts`, `src/styles/workflow-dot.styles.ts`, `src/styles/global.ts`, `tests/sidebar-acceptance.e2e.ts`, `tests/a11y.e2e.ts`, `tests/visual-parity.e2e.ts`, `tests/visual-parity/fixtures.ts`, `tests/visual-parity/map.ts`, `tests/workflow-dot-csp.e2e.ts`, `tests/visual-parity.e2e.ts-snapshots/sidebar-*.png`
- **Must not touch:** `public/_headers`, `css/root.css`, `specification/mockups/`
- **Implementation:** Add the fixed burst and scoped rules described above. Update the relevant sidebar parity cases for the registered cue/status change. Keep geometry and pixel assertions for unaffected sidebar surfaces. Review paired snapshots with animation disabled before updating the affected baseline. Exercise the strict production CSP through the existing browser projects with `test.use({ baseURL: DIST_URL })` as in `tests/classification-training.e2e.ts`; open fresh `/target` without a dataset, with no reduced-motion preference and the CSP probe installed before navigation. Positively observe the static Load Data cue and its connected fixed body burst with nonzero computed geometry. Assert the policy response header and zero CSP events through the burst lifecycle. Keep the uncued sidebar parity fixture as the baseline and exercise the deliberate cue in a separate reduced-motion fixture.
- **Acceptance criteria:**
    - [ ] DOT-AC-5 — The next frame appends one fixed, non-interactive body child centred on the inserted span. Computed keyframes and duration meet the contract, the effect paints outside the link's clipping boundary, and the body child is removed on completion.
    - [ ] DOT-AC-6 — Navigation before a scheduled frame, navigation during a burst, replacing a cue, disconnection and a reduced-motion change leave no orphan nodes. Re-renders do not duplicate the burst. With reduced motion, a visible static cue remains without the body child.
    - [ ] DOT-AC-7 — Keyboard activation and focus, forced-colours visibility, RTL, long labels and narrow layouts pass in the existing fixture. The production test verifies the strict header, observes the actual positioned burst in all three browser projects and reports no CSP violation.
- **Verification:** `bun test tests/style-tokens.test.ts`, `bun run test:e2e tests/sidebar-acceptance.e2e.ts`, `bun run test:e2e tests/visual-parity.e2e.ts`, `bun run test:e2e tests/a11y.e2e.ts`, `bun run test:e2e tests/workflow-dot-csp.e2e.ts`, `bun run test:stories`, `bun run build`. Manually inspect centring, clipping, 200% zoom and the link descriptions in Safari with VoiceOver.
- **Progress:** [ ] Not started

### T3 — Synchronise the durable specifications

- **Depends on:** T2
- **Risk:** routine
- **Likely files:** `specification/workflow-steps.md`, `specification/app-state-and-navigation.md`, `specification/components/sidebar.md`, `specification/visual-design.md`, `specification/HUMAN.md`
- **Must not touch:** `src/`, `tests/`, `specification/mockups/`, `specification/notes/`
- **Implementation:** Apply the Specification changes. Put the table of learner-visible moments in Workflow steps and link to it from the other specs. Replace obsolete statements about the training dot and omission of next-step guidance.
- **Acceptance criteria:**
    - [ ] DOT-AC-8 — The specifications name the same destinations, triggers, consumption rules and animation as the verified implementation. The sidebar and visual documentation identify The Dot as a navigation cue. The spec and human-queue statuses agree with the delivered work.
- **Verification:** `bun run check`, `bun run lint`, `bun run build`, `bun run format:check` with this task’s changed paths. Read the updated specs alongside `specification/README.md` and the tests for DOT-AC-1 through DOT-AC-7.
- **Progress:** [ ] Not started

## Verification and definition of done

- [ ] All task acceptance criteria met.
- [ ] Relevant verification commands from `AGENTS.md` pass with no new failures.
- [ ] Type-check, lint, formatting, and build checks pass.
- [ ] Accessibility (WCAG 2.2 AA), privacy/security, and contract-compatibility checks completed where applicable.
- [ ] Every item under _Specification changes_ is ticked, and specifications match the implemented code.
- [ ] No unintended changes outside the tasks' likely files.

## Risks and open questions

- **Blocking:** None
- **Non-blocking:** Implementation depends on the integrated Model Training Workflow route, completion handoff, two train anchors and uncued sidebar baseline. Check these at T1 and escalate a mismatch before editing.

## Escalations

None.

## Review fixes

None.

## Implementation and verification log

| When (UTC) | Task | Agent (model) | Outcome / commands / evidence |
| ---------- | ---- | ------------- | ----------------------------- |
| —          | —    | —             | Not started                   |

## Plan review history

| Reviewed (UTC)       | Agent (model) | Decision          | Findings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------- | ------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-25T14:57:39Z | Codex (GPT-6) | changes-requested | MAJOR T1: synchronous component subscriptions conflict with COMPONENTS.md §5. Define a compliant transition owner behind StoreController, keep admission and trained counts in one acknowledged projection, and distinguish model-loss epochs from genuine dataset/target or full-discard resets. MAJOR navigation seam: compare the model workflow resolved effective path and specify same-underlay Help versus different-underlay history. Make the core visible in T1, target the exact /models/new anchors, and make the CSP test observe a real burst under the policy. Supply changed paths to the T3 format check. |
| 2026-11-25T15:01:01Z | Codex (GPT-6) | changes-requested | MAJOR T1: invalidate pending Train Another when the last trained record is lost and gate incomplete first-attempt rearm on the epoch high-water mark, so demotion and recovery cannot reinsert and reanimate a previously armed cue (DOT-AC-3). Preserve each captured Nanostore publication in the reducer rather than rereading both live stores from a queued callback; add focused regression coverage.                                                                                                                                                                                                                |
| 2026-11-25T15:06:39Z | Codex (GPT-6) | approved          | Verified T1–T3, captured Nanostores updates and no replay on loss or recovery, exact companion sidebar links and effective history path, and CSP-safe burst coverage across three browsers. No blockers.                                                                                                                                                                                                                                                                                                                                                                                                                   |

## Change log

| When (UTC)           | Change                                     | Reason                                                                                                                                                                        |
| -------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-25T10:57:56Z | Initial draft                              | Maintainer's Rules for The Dot and follow-up decisions: use `/results`, dedicated first/another links and the separately delivered `/models/new` route.                       |
| 2026-11-25T14:45:10Z | Invalidated approval                       | Bind guidance to the model workflow anchors and acknowledged navigation; correct the production CSP verification                                                              |
| 2026-11-25T14:50:36Z | Bind cues to the integrated model workflow | Fix anchor ownership, acknowledged milestone consumption and production CSP coverage.                                                                                         |
| 2026-11-25T14:58:48Z | Address first independent review           | Keep synchronous cue tracking in the store layer, distinguish effective Help navigation and hydrate safely, and require visible static/production cues in their owning tasks. |
| 2026-11-25T15:01:48Z | Address second independent review          | Reduce captured store updates in order and retire Train Another when its saved result disappears.                                                                             |
