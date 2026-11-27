# Repair inherited shell parity and Firefox accessibility checks

**Status:** ready-for-review | **Updated:** 2026-11-27T10:22:52Z
**Authors:** Codex (GPT-6.2-sol) | **Created:** 2026-11-27T10:17:48Z
**Verified by:** — | **Verified:** — | **Verification:** pending
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour:** The [archived chart release](archive/chart-best-practices.md#verification-and-definition-of-done) left inherited E2E failures for separate repair. On merged main at `7397800f451091f98a03566d126f2bf69042b64a`, 22 of 32 focused Chromium cases passed. Ten failed: `PH-AC-2`, seven sidebar cases (aggregate, first, adjacent, last, label, step links and `SIDE-AC-11`), `PARITY-main` and `PARITY-models-features-table`. Both isolated Firefox accessibility cases passed on merged main in 12.6 seconds. The historical Firefox audit crash still needs investigation because serial mode prevented later independent cases from running.

**Target behaviour:** Sidebar geometry matches the approved reference. A Firefox page crash or axe error fails the affected accessibility case and leaves independent cases runnable. After the shared layout migration, the existing main and feature-table checks establish strict parity, with a local feature-table fix only if a measured difference remains. A fresh unfiltered full suite establishes the final result and names any still-unresolved case and owner.

**Why:** Complete the deferred verification work without reopening the chart release or treating known failures as normal coverage.

## Scope

**In scope**

- Re-establish the unfiltered baseline from an exact Git revision and preserve browser reports.
- Restore sidebar geometry and repair reference selection in the existing parity cases.
- Harden isolation in the dedicated `tests/a11y.e2e.ts` suite and diagnose the historical Firefox audit crashes.
- Recheck shared main and feature-table geometry after the existing main-spacing migration. Repair a residual feature-table mismatch only within its existing view.

**Out of scope**

- [Virtual table D28 and T5](archive/virtual-table-improvements.md#t5--sticky-page-headers-on-every-route) own document main padding, page-body spacing and sticky headers. Their planned geometry changes and the `PH-AC-2` registry retirement remain with that owner. The implementation branch at `4416bcb` has T1–T4 complete and T5 open.
- [Beta test robustness T2–T4](beta-test-robustness-and-advisory-checks.md#implementation-tasks) own `PH-AC-2` deduplication, `FOCUS-AC-5` timing, dynamic dataset counts, mixed functional E2E axe checks including the remote training recovery case, and CI and exception-list policy. The Linux `SIDE-AC-10` screenshot baseline remains its existing [human follow-up](../HUMAN.md#1-workflow-and-plan-review).
- `17d7ad1` already corrected dataset and mockup counts and the data-preview persistence wait. The main Chromium replay passed all six affected cases: `DATA-FLOW-2`, `DATA-UP-2`, `DATA-PRE-2` and the three mockup-review checks.
- Changes to charts, model or worker contracts, dependency versions, CI policy or product mockups.

**Constraints and invariants**

- Keep the strict 1 CSS px parity tolerance, the zero-difference screenshot contract, the temporary 4px-gap negative probe and WCAG 2.2 AA. No expected failure, relaxed assertion, regenerated screenshot or new axe exclusion can make an outstanding defect pass.
- Observe approved mockups as served under `?clean=1`. Reference fixture normalisation may change corresponding text, counts and current state under the existing spec. Styling, wrappers and dimensions stay as authored.
- Retain keyboard focus, native links, route and scroll ownership, semantic fieldsets and tables, local overflow for two-dimensional tables, RTL, long labels, and readable 320 CSS px layout at 200% text. Use existing tokens and logical properties.
- Load each checkout's own server using `scripts/ports.ts` and the registered Playwright global setup. Keep `SAMATA_SKIP_KNOWN_FAILURES` unset during evidence runs.

## Required reading

- [Component conventions](../COMPONENTS.md) §§3–10 and [sidebar](../components/sidebar.md) §§3–10.
- [Visual design](../visual-design.md) §§1, 3, 5–6 and [testing](../testing.md) §End-to-End Testing.
- [Chart release evidence](archive/chart-best-practices.md#verification-and-definition-of-done), [virtual table T5](archive/virtual-table-improvements.md#t5--sticky-page-headers-on-every-route) and [beta test robustness scope](beta-test-robustness-and-advisory-checks.md#scope).

## Codebase context

- **References and sidebar owner:** `src/features/shell/app-sidebar.ts` lines 55–56 and 129–224 own the Tier 3 connected `app-sidebar` and its local geometry against `specification/mockups/css/steps.css` lines 1–62. `tests/visual-parity/fixtures.ts` lines 79–157 seeds and normalises paired fixtures. `tests/visual-parity/map.ts` lines 205–212 and 317 and `tests/visual-parity.e2e.ts` lines 22–34 and 330–369 define the checks. The step-links entry names `00_first-load.html` before the Empty fixture helper navigates the reference to `01-1_select-data.html`. `SIDE-AC-11` already uses `01-1` and also fails.
- **Main and feature table:** `css/base.css` lines 7–13 gives `main` padding. `tests/visual-parity/map.ts` lines 365 and 733–738 maps main geometry and the real feature table. `src/features/models/app-model-builder-view.ts` lines 451–454, 505–508 and 1516–1525 own the fieldset reset and overflow wrapper around the semantic table. The approved static feature-table reference is `specification/mockups/03-3_train-models-2-select-features.html` lines 145–163.
- **Dedicated axe suite:** `tests/a11y.e2e.ts` lines 66–96 define two different scan scopes. Lines 161–162 configure serial fail-fast. Choose Model `A11Y-E2E-13` is a full-page scan at lines 421–427. Retry `A11Y-E2E-17` already scans the Step 4 shadow root and enforces contrast and naming sentinels at lines 486–502. Cases seed separate pages or contexts and share no state.
- **Measured baseline:** Chromium 1440×900 reported absolute sidebar deltas of 96px aggregate height, 24px first-row height and 24px, 72px, 24px and 24px relative positions for adjacent row, last row, label and step links. `SIDE-AC-11` showed 96px before mutation. `PH-AC-2` and `PARITY-main` measured 32px padding against 0px. The feature table measured 942px versus 926px, so older 1006px reference measurements do not prove the current cause. Report `/private/tmp/samata-inherited-e2e-planning-baseline.json`. Focused Firefox replay passed 2/2 at the same revision. Report `/private/tmp/samata-inherited-e2e-planning-firefox.json`. Chart-release history retains the full run of 1,197 passed, 32 failed, 181 skipped and nine not run at `2b34f70` and its dispositions. Those counts describe the older run.
- **Web guidance:** `responsive-design` and `form-factor-adaptation`. Keep text and controls inside responsive layout without clipping. A genuinely two-dimensional table may retain local keyboard-scrollable overflow, with its existing accessible region name.
- **Visual reference:** Use the existing approved Empty sidebar `01-1_select-data.html`, the established paired Models checks and the approved Select Features reference above. Keep recorded semantic and accessibility deviations. Existing draft styling allowances do not make new surfaces normative.
- **Domain skills:** `lit-component-implementer` for T2 and any T4 product CSS. No new Lit element or web-platform API.
- **Assumptions requiring verification:** Compare current product and mockup boxes before choosing the first divergent sidebar owner. Compare feature boxes after D28 before changing local CSS; the source alone does not establish a padding cause. Reproduce Firefox crashes in the full suite before attributing a browser or app cause.

## Technical decisions

| Decision                                       | Chosen approach and rationale                                                                                                                                                                                                                  | Rejected alternative / trade-off                                                                                                                                            |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One repair owner per failure                   | This plan owns sidebar parity, dedicated audit isolation and any measured post-D28 local feature-table residual. D28 owns shared geometry and the beta plan owns its named fixtures and policy.                                                | Copying pending changes would duplicate product decisions and risk conflicting with active work.                                                                            |
| Same reference throughout a comparison         | Use `01-1_select-data.html?clean=1` consistently for the Empty step-link fixture in the parity map and actual navigation. Compare corresponding boxes from the same fixture state and scale, then make the smallest local product correction.  | Removing the reference sample or raising tolerances hides geometry drift. The routing mismatch alone cannot account for `SIDE-AC-11`.                                       |
| Independent axe cases                          | Use default per-case scheduling and Playwright's standard fresh context and page. Keep full-page and Retry scan scopes distinct. Preserve strict failures for both scans and capture actual crashes.                                           | Retrying or suppressing axe exceptions would hide defects. Isolation prevents one failure from blocking others and makes no claim to fix a browser process crash by itself. |
| Condition feature-table CSS on measured causes | Verify D28 first. If the existing table check passes, record evidence and keep local CSS. Otherwise compare the first differing local form, fieldset or overflow-wrapper box and change only its sizing or inset in the existing builder view. | Hand-tuned width or a global workaround would mask the geometry cause or affect other routes.                                                                               |

### Interfaces and behaviour

- `AppSidebar` remains the connected, tag-only `app-sidebar`. Its closed API contains no public properties, attributes, events, slots, methods, parts or CSS custom properties. Keep the existing read-only `$sidebarState` projection and `createSidebarCueTracker()` state and lifetimes. Geometry remains local, including the joined borders, fixed/start-aligned desktop host, 50rem static transition, reserved cue slot, translated labels, `aria-current` rules and inset focus. There are no new strings or stores.
- `app-model-builder-view` remains the existing connected owner. T4 may affect only local, private Select Features layout rules. Its current element API, focus and settlement methods, stores, states, forms, worker messages and table semantics stay as specified. Neither implementation branch adds a public interface.
- Dedicated accessibility tests keep production interactions, existing named criteria, WCAG tags and precise feature findings. Choose Model scans the page; Retry scans the Step 4 subtree and proves the contrast/naming rules ran. A crash produces a failed case and a diagnostic report, while unaffected cases still run.

## Specification changes

- [ ] [Sidebar](../components/sidebar.md) §§5 and 8 and [visual design](../visual-design.md) §6 record the final fixture mapping and geometry evidence. Status stays `implemented` and `partial` respectively.
- [ ] [Testing](../testing.md) records single-case isolation, retained scan scopes and diagnostics. Status stays `partial`.
- [ ] [Human queue](../HUMAN.md) records which exact inherited cases are resolved or remain with their existing owners. The archived chart plan stays intact.

## Implementation tasks

### T1 — Capture the current unfiltered baseline

- **Depends on:** None
- **Risk:** routine
- **Likely files:** `specification/plans/repair-inherited-e2e-failures.md`
- **Must not touch:** `src/`, `css/`, `tests/`, `specification/mockups/`, `.github/`
- **Implementation:** Record the Git revision, browser projects, host, worktree-specific ports, worker count, retry count, duration, report paths and exact failure signatures. Retain raw JSON under ignored `test-results/` before focused replays. Execute the full suite serially with no retries or known-failure filtering. Compare against the historic inventory and the merged-main replays above. Classify a failure as inherited only with the same observed assertion or crash, and preserve skipped and unrun cases as separate dispositions. Do not absorb another plan's test fixes.
- **Acceptance criteria:**
  - [ ] BASE-E2E-1 — Unfiltered report and disposition table cover all failures, skipped and unrun cases and record their owners. Earlier passing replays stay distinct from full-suite results.
- **Verification:** `PLAYWRIGHT_JSON_OUTPUT_FILE=test-results/inherited-e2e-before.json bun run test:e2e --workers 1 --retries 0 --reporter line,json`, plus focused parity, dataset and Firefox commands below for any classification that changes.
- **Progress:** [ ] Not started

### T2 — Restore strict sidebar parity

- **Depends on:** T1
- **Risk:** needs care — joined rows must retain wrapping, focus, current-page state and cue placement.
- **Likely files:** `src/features/shell/app-sidebar.ts`, `src/features/shell/app-sidebar.stories.ts`, `tests/visual-parity/fixtures.ts`, `tests/visual-parity/map.ts`, `tests/visual-parity.e2e.ts`, `tests/sidebar-acceptance.e2e.ts`
- **Must not touch:** `css/base.css`, `src/stores/`, `specification/mockups/`, `tests/visual-parity.e2e.ts-snapshots/`, `tests/known-failures.ts`
- **Implementation:** Align the step-link entry's reference path with the Empty helper and assert the final reference URL in the existing case. At Chromium 1440×900, record actual and reference values for the ol, corresponding rows and labels, including block size, grid rows, row gaps and border box offsets. Correct the first local divergence using the approved steps rules and existing shared tokens; preserve semantic markup, natural wrapping and inset outline. Use the existing Empty, DatasetLoaded, TargetSet, Models, LongLabel and RTL stories; extend existing coverage for the corrected geometry as necessary.
- **Acceptance criteria:**
  - [ ] PARITY-sidebar-steps, PARITY-sidebar-step-first, PARITY-sidebar-step-adjacent, PARITY-sidebar-step-last, PARITY-sidebar-step-label and PARITY-step-links — Both sides measure the same fixture state; all existing 1px checks pass.
  - [ ] SIDE-AC-11 — Before mutation geometry passes, deliberate 4px gap fails the strict geometry check, and restoration passes. Keep the supported-host paired snapshot assertions and files unchanged in this plan. If a legitimate change needs new baselines, escalate with paired reference and app captures for maintainer review.
  - [ ] SIDE-AC-3, SIDE-AC-7 and SIDE-AC-9 — Existing keyboard, long-label LTR/RTL reflow and forced-colours focus remain intact in all three browsers.
- **Verification:** `bun run test:e2e tests/visual-parity.e2e.ts --project chromium --workers 1 --grep 'PARITY-sidebar|PARITY-step-links$|SIDE-AC-11:'`, `bun run test:e2e tests/sidebar-acceptance.e2e.ts`, `bun run test:stories`, `bun test tests/style-tokens.test.ts`.
- **Progress:** [ ] Not started

### T3 — Isolate the dedicated Firefox accessibility cases

- **Depends on:** T1
- **Risk:** needs care — a scan process error is different from an axe violation or a timeout.
- **Likely files:** `tests/a11y.e2e.ts`
- **Must not touch:** `src/`, `css/`, `tests/a11y-feature-findings.ts`, `tests/training-panels.e2e.ts`, `tests/known-failures.ts`, `playwright.config.ts`
- **Implementation:** Set the dedicated suite to explicit `test.describe.configure({ mode: 'default' })` (the project uses `fullyParallel: true`) after confirming each case seeds a fresh context and includes setup it needs. Run the suite at one worker, then repeat Choose Model and Retry three times in Firefox. If an observed scan starts on an unsettled UI, await the existing visible route or ready-panel signal for that case. Preserve native scans, real data/worker fixture and each test's existing assertions. For any repeatable crash after this, retain the report, exact affected scan step and preceding case and escalate the remaining root-cause work before ticking the criterion. Do not add sleeps, skips, retries or a weaker scan as a repair.
- **Acceptance criteria:**
  - [ ] A11Y-E2E-13 and A11Y-E2E-17 — Existing axe scopes and violation assertions execute and pass three consecutive Firefox repetitions. The dedicated suite passes across all configured engines without relying on preceding tests or omitting later cases.
- **Verification:** `bun run test:e2e tests/a11y.e2e.ts --project firefox --workers 1 --retries 0 --repeat-each 3 --grep 'A11Y-E2E-13:|A11Y-E2E-17:'`, `bun run test:e2e tests/a11y.e2e.ts --workers 1 --retries 0`.
- **Progress:** [ ] Not started

### T4 — Verify main and feature-table geometry on the integrated layout

- **Depends on:** T1
- **Risk:** needs care — current widths can change with the shared layout migration.
- **Likely files:** `src/features/models/app-model-builder-view.ts`, `src/features/models/app-model-builder-view.stories.ts`, `tests/visual-parity.e2e.ts`
- **Must not touch:** `src/app.ts`, `css/base.css`, `specification/mockups/`, `tests/visual-parity/map.ts`, `tests/known-failures.ts`
- **Implementation:** Do not start this task until [virtual-table-improvements T5](archive/virtual-table-improvements.md#t5--sticky-page-headers-on-every-route) is landed on `main`. Check the remaining `PH-AC-2` assertions and `PARITY-main` once the existing D28 changes land. Route any failure in shared geometry back to that owner. Replay the feature-table case first. If it passes, complete this task with no product changes. If it still fails, record measured `main`, page-body, form, fieldset, overflow wrapper and table boxes and compare the corresponding approved mockup containers at the same 1440×900. Adjust only a measured local Select Features sizing rule causing the difference and extend the existing co-located `SelectFeaturesHelp` story for that view, including narrow RTL and a long label, if product CSS changes. Preserve a native accessible table and off-screen cell access via the existing local scroll region. If the difference requires a broader owner or a new deviation, escalate.
- **Acceptance criteria:**
  - [ ] PH-AC-2 and PARITY-main — Existing main geometry and semantic heading assertions pass after D28. Any duplicate deletion is handled by the beta plan's T3.
  - [ ] PARITY-models-features-table — Existing width and style comparisons pass; local reflow, table semantics and keyboard access remain intact across the browser matrix.
- **Verification:** `bun run test:e2e tests/app-shell.e2e.ts --workers 1 --grep 'PH-AC-2'`, `bun run test:e2e tests/visual-parity.e2e.ts --project chromium --workers 1 --grep 'PARITY-main$|PARITY-models-features-table$'`, and `bun run test:stories` and `bun test tests/style-tokens.test.ts` for any product CSS change.
- **Progress:** [ ] Not started

### T5 — Publish follow-up dispositions and verify the whole suite

- **Depends on:** T2, T3, T4
- **Risk:** routine
- **Likely files:** `specification/components/sidebar.md`, `specification/visual-design.md`, `specification/testing.md`, `specification/HUMAN.md`
- **Must not touch:** `src/`, `css/`, `tests/`, `specification/mockups/`, `specification/plans/archive/chart-best-practices.md`
- **Implementation:** Update the sidebar mapping, strict parity and dedicated axe test descriptions. Close applicable human follow-ups only after passing evidence. Hand off exact passing owned parity cases to the beta plan owner for its planned exception-list cleanup. Run an unfiltered full suite on the integrated candidate with a separate JSON report and compare with T1. Keep raw failures, skipped and unrun cases distinct. A still-failing outside-owner case leaves the all-green gate incomplete until its fix lands. Record the exact case and existing owner. Do not reuse the chart release exception.
- **Acceptance criteria:**
  - [ ] BASE-E2E-2 — Report shows no failing, flaky or unrun cases, with browser-specific intentional skips accounted for by existing assertions. The spec index stays valid and points to the current behaviour.
- **Verification:** `PLAYWRIGHT_JSON_OUTPUT_FILE=test-results/inherited-e2e-after.json bun run test:e2e --workers 1 --retries 0 --reporter line,json`, `bun run check`, `bun run lint`, `bun run build`, `bun run plans:check specification/plans/repair-inherited-e2e-failures.md`.
- **Progress:** [ ] Not started

## Verification and definition of done

- [ ] All task acceptance criteria met. Preserve baseline and final as separate pinned reports.
- [ ] Relevant `AGENTS.md` commands pass, including the final unfiltered E2E gate. An inherited result remains a failure until fixed and verified.
- [ ] Typecheck, lint, build and token checks pass. The staged hook and landing gate check formatting.
- [ ] Three-engine component acceptance, strict Chromium parity and dedicated axe checks pass. Existing manual accessibility follow-ups stay explicit until verified.
- [ ] Specification changes are ticked and aligned. No edits outside scoped ownership.

## Risks and open questions

- **Blocking:** None
- **Non-blocking:** T4 depends on the external D28 implementation. T1–T3 can proceed independently. The historical Firefox cases passed focused replay on merged main, so browser crash causation remains unproved. Preserve and escalate any repeated crash instead of suppressing it. No repository-local decision checklist or plan backlog exists; the core checklist and existing human queue apply.

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

| When (UTC)           | Change               | Reason                                                                                                                                    |
| -------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-27T10:17:48Z | Initial draft        | Maintainer ordered chart integration first and separate repair of remaining failures. Scoped against merged main and current owner plans. |
| 2026-11-27T10:22:31Z | Invalidated approval | Use the permitted routine risk field spelling for T1 and T5.                                                                              |
