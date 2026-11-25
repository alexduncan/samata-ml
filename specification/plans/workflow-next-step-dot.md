# Give The Dot one purpose in workflow navigation

**Status:** ready-for-review | **Updated:** 2026-11-25T11:00:49Z
**Authors:** Codex (GPT-6) | **Created:** 2026-11-25T10:57:56Z
**Verified by:** — | **Verified:** — | **Verification:** pending
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour:** The sidebar uses an animated `<span class="dot">` to mark training in progress. The sidebar has no next-step indicator and only lists numbered model records. Compare Results uses `/results`.

**Target behaviour:** The sidebar uses The Dot only to suggest the next action at the seven specified workflow moments. Visiting its destination removes it from the DOM. Its arrival produces a single two-second burst outside the sidebar's clipping containers.

**Why:** Learners choose when and where to continue through the workflow. The sidebar makes the next logical choice easier to find.

## Scope

**In scope**

- The Dot on the Load Data, Set Target and Compare Results step links, and on the dedicated Train New Model and Train Another Model sidebar links.
- Removal of The Dot as a training-status indicator, with training and trained status still readable.
- A succinct workflow specification and synchronised sidebar, navigation and visual-design contracts.

**Out of scope**

- Defining or implementing the `/models/new` route, its draft and leave behaviour, or its transition to a numbered model.
- Renaming `/results`, renaming model records, model swatches, training/evaluation logic, new comparisons, persistence changes and unrelated mockup work.

**Constraints and invariants**

- Navigation remains learner-initiated between workflow steps. A hint never requests navigation, moves focus or changes history.
- The Dot is a decorative span. The destination is a native link with readable text and a translated, visually hidden description while suggested. Existing link names, keyboard access, focus outlines and `aria-current` semantics still apply.
- Render zero or one `<span class="dot" aria-hidden="true"></span>` in the application. Where no hint is active the span is absent. The temporary burst uses its own class and is also hidden from assistive technology.
- Use the existing production CSP, cross-origin isolation and tokens. All cue state is transient UI state and stays in the browser.

## Required reading

- `AGENTS.md` § Verification Commands and § Rules.
- `specification/COMPONENTS.md` §§3–10 and `specification/components/sidebar.md` §§3–10 — closed API, scope, styling and acceptance.
- `specification/workflow-steps.md` introduction and §§1–4, `specification/app-state-and-navigation.md` §§4.4 and 5, and `specification/visual-design.md` §§1, 3 and 5 — workflow, history and references.
- `specification/notes/ui-fixes.md` § Rules for The Dot, and § Experiment Names for the companion route and link context.

## Codebase context

- **Relevant specifications:** `specification/workflow-steps.md` governs visible workflow behaviour. `specification/components/sidebar.md` §5 describes the current status dot. `specification/visual-design.md` §5.3 currently omits next-step guidance under SHELL-UI-02.
- **Relevant implementation:** `src/features/shell/app-sidebar.ts:125,230–247,278–320,344–457` clips the joined step rows, renders the status dot and owns all sidebar links. `src/stores/sidebar.store.ts:6–39` projects `$appState` and `$route`. `src/router/route-parser.ts:19–64` recognises `/results` and numbered models. `src/app.ts:251–288` mounts the sidebar after hydration. `src/stores/training-service.ts:590–619,701–707,922–940` publishes acknowledged training results and retries. `src/stores/predicates.ts:21–28` defines the two-trained-model threshold.
- **Tests and commands:** `tests/sidebar-state.test.ts`, `tests/sidebar-acceptance.e2e.ts:58–70,123–145`, `tests/visual-parity.e2e.ts:267–313`, `tests/a11y.e2e.ts` and `tests/style-tokens.test.ts` cover shell projections, the old status dot, accessibility and geometry. Reuse `src/features/shell/app-sidebar.stories.ts`, `tests/visual-parity/fixtures.ts` and the Iris and Penguins two-model journeys. `tests/comparison.e2e.ts:83–110` provides a hydrated comparison fixture. Baseline results and task commit IDs belong in the implementation log.
- **Web guidance:** `motion` — animate opacity and transform, keep the static cue in reduced motion, and clean up even when an animation is suppressed or cancelled.
- **Visual reference:** `01-1_select-data.html`, `02-2_target-set.html` and `03-2_train-models-1-choose-model.html` supply sidebar row and dot styling. The `03-7_train-models-5-results.html` draft supplies Train Another Model structure. Reuse the sidebar's model-row layout, record the scope and markup differences under SHELL-UI-02, and keep reference files read-only.
- **Domain skills:** `lit-component-implementer` for T1 and T2.
- **Assumptions requiring verification:** T1 checks the shipped companion route contract and sidebar actions before implementing. No upstream library contract is involved.

## Technical decisions

| Decision             | Chosen approach and rationale                                                                                                                                                                                           | Rejected alternative / trade-off                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Routes and links     | Native Train New Model and Train Another Model anchors target `/models/new`. Compare Results targets the existing `/results`. The companion route work owns what entering, leaving or completing `/models/new` does.    | A numeric guess or an overview link would send the learner somewhere other than the requested action.                              |
| State ownership      | Extend the existing read-only sidebar projection. Keep acknowledged milestone and destination tracking private to the connected sidebar. Initialise it from the hydrated projection.                                    | Persistence and route flags would introduce a schema or URL contract for transient guidance.                                       |
| Dot and burst        | The sidebar renders the static dot core and schedules one body-level CSS animation on insertion. Keep document and shadow styling in one shared Lit CSSResult, adopted through the existing document style initialiser. | A descendant or pseudo-element on the sidebar link remains subject to the reference layout's overflow clipping.                    |
| Status accessibility | Reuse the translated Training label as visible text on training rows. Keep the existing trained check and status description. Use the translated description `Suggested next step` on the active cue's anchor.          | A status that relies on a pulse or colour would reuse the meaning reserved for The Dot and obscure the distinction without motion. |

### Interfaces and behaviour

The only connected element affected is `app-sidebar` in `src/features/shell/app-sidebar.ts`. Its tag remains its entire public element API. The Dot and burst are internal styling and DOM implementation details. The existing `$sidebarState` computed store remains read-only. Extend its projection with `state.dataset?.id`, `state.target`, `comparisonContextEpoch`, the effective workflow path and the acknowledged count from `$trainedModels` (whose length drives `$canCompare`). Obtain the workflow path from `$route`. For reserved routes, use `underlayPath` with the existing resume-path and `/data` defaults in `src/app.ts:118–128`. Retain the distinction between exact and parent `aria-current`. The sidebar reads the projection through its existing StoreController.

| Moment                                                   | Cue and lifetime                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No dataset                                               | Show on Step 1 `/data` whenever the learner is elsewhere. The fresh app already on `/data` has no dot.                                                                                                                                                                                               |
| Dataset selected                                         | Show on Step 2 `/target` as soon as the acknowledged dataset is available and no target is set, provided the learner is outside `/target`.                                                                                                                                                           |
| Leave Step 2 before setting a target                     | Show again on Step 2. The cue is absent for the entire time `/target` is current.                                                                                                                                                                                                                    |
| Set as Target succeeds                                   | Arm the cue on **Train New Model**, `/models/new`, after the target selection is published. This also applies to an acknowledged replacement target that resets the models.                                                                                                                          |
| Leave `/models/new` before the first successful training | Once navigation actually leaves, put the cue back on **Train New Model** while there are zero trained models. Stay clear of failed or cancelled navigation and Help dialogs.                                                                                                                         |
| First training succeeds                                  | Replace any Train New Model cue with a cue on **Train Another Model**, `/models/new`. Arm it when the first trained record is published and show it as soon as the companion flow has made `/models/new` available as a new destination. A completed numbered model page is a different destination. |
| Second training succeeds                                 | Replace any training-link cue with a cue on the sidebar **Compare Results** link, `/results`, when the acknowledged trained count goes from one to two and `$canCompare` becomes true.                                                                                                               |

- Data and target prerequisites take precedence over model cues. Use the effective workflow path for every destination comparison, including history navigation. A reserved dialog neither consumes nor rearms a cue. Entering a cue's destination consumes that milestone immediately, even via a link elsewhere or Back/Forward. Leaving it only rearms a cue in the incomplete Step 1, Step 2 and first-training cases above. In particular, leaving Compare Results or a second attempt does not create another cue.
- Keep a previous projection and a pending milestone in private sidebar state. Compare committed snapshots before rendering the next cue. Clear stale model cues on dataset or target reset, and clear a Compare cue if `$canCompare` becomes false. For a new target published in the same update as a reset, clear the old cue before arming Train New Model for the new target. Distinguish a pending first-completion suggestion still waiting for the current run to leave `/models/new` from a suggestion already consumed by entering it.
- Use the reconciled application records as the source of truth. Initial hydration does not replay target selection or training completion. Failed, pending and cancelled commands leave the previous committed milestone in force. A later successful publication is eligible. Live acknowledged project updates observed in this tab use the same rules, including updates published by another tab. Additional trained records and status changes that do not cross the specified thresholds never replay the first or second cue.
- The Dot's insertion identity is its destination and link occurrence. Preserve the node across unrelated renders. When the actual span is newly inserted, schedule exactly one `requestAnimationFrame` from the sidebar update lifecycle. In that frame, confirm it is still the active connected node, measure its viewport rectangle, then append the matching fixed circle directly to `body`. Centre the burst on the measured core using individual CSSOM positioning properties. The shared style supplies the round `0.625rem` core and `var(--blue-700)` colour from the existing sidebar. Use the vertical and inline-end slot for each link from `specification/mockups/css/steps.css` (step and model rows). Use no inline style text, per-frame layout reads or style-policy changes.
- Make the burst non-interactive and layer it above the sidebar, below native modal dialogs. Animate `opacity: 1; transform: scale(1)` to `opacity: 0; transform: scale(30)` once over `2000ms`, only with `prefers-reduced-motion: no-preference`. Keep the core static. Remove the body element on animation end or cancellation, or immediately if no animation starts. Cancel a scheduled frame and remove any burst when the cue changes or the sidebar disconnects. During reduced motion render the static core without appending the burst.

## Specification changes

- [ ] `specification/workflow-steps.md` introduction — add a brief **Next-step guidance** section with the seven moments, destination consumption, manual navigation and the one-shot reduced-motion-safe arrival. Status stays partial.
- [ ] `specification/app-state-and-navigation.md` §4.4 — link to the workflow rule and describe underlay route identity and exact destination consumption. Status stays draft.
- [ ] `specification/components/sidebar.md` §§2–10 — record the store projection, link descriptions, training text, core and burst ownership, mapping, criteria and stories. Remove the outdated next-step non-goal. Status stays implemented after the code matches.
- [ ] `specification/visual-design.md` §§3 and 5 — update the style map, SEM-09 and SHELL-UI-02 for exclusive cue use, the body-level arrival effect and text status. Status stays partial.
- [ ] `specification/HUMAN.md` — close the claimed Dot Rules entry on verification. Check specification index status alignment.

## Implementation tasks

### T1 — Put The Dot on workflow destinations

- **Depends on:** None
- **Risk:** needs care — current-destination checks, durable milestones and route transitions can occur in the same render.
- **Likely files:** `src/stores/sidebar.store.ts`, `src/features/shell/app-sidebar.ts`, `src/features/shell/app-sidebar.stories.ts`, `tests/sidebar-state.test.ts`, `tests/sidebar-acceptance.e2e.ts`, `tests/visual-parity/fixtures.ts`, `tests/journeys/iris-classification.e2e.ts`
- **Must not touch:** `src/router/`, `src/stores/training-service.ts`, `src/features/models/`, `vendor/`, `bun.lock`, `specification/mockups/`
- **Implementation:** First confirm that the companion route work is integrated and that re-entering `/models/new` after the first successful training starts another model. Implement the state table under Interfaces and behaviour. Use the companion links if present. If the companion integration delivers only the routes, render the existing-action native anchors in the sidebar model list, using `step-train-new` before any trained model and `step-model-link` after the first. Reuse the sidebar link template and stable list keys. Move the existing core styling onto the suggested links and replace the status Dot with visible translated training text. Extend the existing sidebar stories for the suggested destinations, current/consumed states, Long label and RTL, using a deterministic before/after state fixture for live milestones and Docs guidance for correct use.
- **Acceptance criteria:**
    - [ ] DOT-AC-1 — Initial `/data` is clear. From another step without a dataset, Load Data is suggested. Dataset load and departure from Step 2 before selection suggest Set Target. The destination clears the span on arrival and Help leaves cue state intact.
    - [ ] DOT-AC-2 — Acknowledged target selection suggests Train New Model. Entering `/models/new` clears it and an incomplete first attempt's confirmed departure restores it. Cancelled departure, failed target save and stale hydrated milestones produce no new cue.
    - [ ] DOT-AC-3 — The first successful training suggests Train Another Model as soon as its destination is actionable. The second suggests the sidebar Compare Results anchor. Entering either destination by normal navigation or browser history removes its cue. Restored results, failed/cancelled training, an unrelated render and a third completion never replay a milestone.
    - [ ] DOT-AC-4 — The sidebar contains at most one `.dot`. The indicated link has a translated description and its existing name and focus. Training still shows text and the trained check and text remain. The app stays on the current workflow step at each milestone.
- **Verification:** `bun test tests/sidebar-state.test.ts`, `bun run test:e2e tests/sidebar-acceptance.e2e.ts`, `bun run test:stories`, `bun run test:e2e tests/journeys/iris-classification.e2e.ts`. Use the training journey to establish both durable completion thresholds and ID-prefixed focused tests for suppressed/consumed cues and reserved-route history.
- **Progress:** [ ] Not started

### T2 — Animate the cue arriving and verify visual parity

- **Depends on:** T1
- **Risk:** needs care — body positioning, cleanup and reduced motion cross the sidebar's shadow boundary.
- **Likely files:** `src/features/shell/app-sidebar.ts`, `src/features/shell/app-sidebar.stories.ts`, `src/styles/workflow-dot.styles.ts`, `src/styles/global.ts`, `tests/sidebar-acceptance.e2e.ts`, `tests/a11y.e2e.ts`, `tests/visual-parity.e2e.ts`, `tests/visual-parity.e2e.ts-snapshots/sidebar-*.png`
- **Must not touch:** `public/_headers`, `css/root.css`, `specification/mockups/`
- **Implementation:** Add the fixed burst and scoped rules described above. Update the relevant sidebar parity cases for the registered cue/status change. Keep geometry and pixel assertions for unaffected sidebar surfaces. Review paired snapshots with animation disabled before updating the affected baseline. Exercise the strict production CSP through the existing distribution test project.
- **Acceptance criteria:**
    - [ ] DOT-AC-5 — The next frame appends one fixed, non-interactive body child centred on the inserted span. Computed keyframes and duration meet the contract, the effect paints outside the link's clipping boundary, and the body child is removed on completion.
    - [ ] DOT-AC-6 — Navigation before a scheduled frame, navigation during a burst, replacing a cue, disconnection and a reduced-motion change leave no orphan nodes. Re-renders do not duplicate the burst. With reduced motion, a visible static cue remains without the body child.
    - [ ] DOT-AC-7 — Keyboard activation and focus, forced-colours visibility, RTL, long labels and narrow layouts pass in the existing fixture. The production app emits no CSP violation for the burst.
- **Verification:** `bun test tests/style-tokens.test.ts`, `bun run test:e2e tests/sidebar-acceptance.e2e.ts`, `bun run test:e2e tests/visual-parity.e2e.ts`, `bun run test:e2e tests/a11y.e2e.ts`, `bun run test:stories`, `bun run build`. Manually inspect centring, clipping, 200% zoom and the link descriptions in Safari with VoiceOver.
- **Progress:** [ ] Not started

### T3 — Synchronise the durable specifications

- **Depends on:** T2
- **Risk:** routine
- **Likely files:** `specification/workflow-steps.md`, `specification/app-state-and-navigation.md`, `specification/components/sidebar.md`, `specification/visual-design.md`, `specification/HUMAN.md`
- **Must not touch:** `src/`, `tests/`, `specification/mockups/`, `specification/notes/`
- **Implementation:** Apply the Specification changes. Put the table of learner-visible moments in Workflow steps and link to it from the other specs. Replace obsolete statements about the training dot and omission of next-step guidance.
- **Acceptance criteria:**
    - [ ] DOT-AC-8 — The specifications name the same destinations, triggers, consumption rules and animation as the verified implementation. The sidebar and visual documentation identify The Dot as a navigation cue. The spec and human-queue statuses agree with the delivered work.
- **Verification:** `bun run check`, `bun run lint`, `bun run build`, `bun run format:check`. Read the updated specs alongside `specification/README.md` and the tests for DOT-AC-1 through DOT-AC-7.
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
- **Non-blocking:** The maintainer assigned `/models/new` to separate routing work. This plan can be reviewed now. Its implementation starts after that route and the completed-run transition are available. Confirm the companion implementation at T1 and escalate any incompatible contract before editing.

## Escalations

None.

## Review fixes

None.

## Implementation and verification log

| When (UTC) | Task | Agent (model) | Outcome / commands / evidence |
| ---------- | ---- | ------------- | ----------------------------- |
| —          | —    | —             | Not started                   |

## Plan review history

| Reviewed (UTC) | Agent (model) | Decision | Findings |
| -------------- | ------------- | -------- | -------- |

## Change log

| When (UTC)           | Change        | Reason                                                                                                                                                  |
| -------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-25T10:57:56Z | Initial draft | Maintainer's Rules for The Dot and follow-up decisions: use `/results`, dedicated first/another links and the separately delivered `/models/new` route. |
