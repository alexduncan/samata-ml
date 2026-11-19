# Shell manual verification and audit follow-ups

**Status:** stub | **Updated:** 2026-11-19T10:53:17Z
**Authors:** Claude Code (claude-opus-5-5) | **Created:** 2026-11-19T10:53:17Z
**Verified by:** — | **Verified:** — | **Verification:** pending
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour:** The Storybook workbench and shell remediation (sidebar/workflow, welcome modal, content dialog, shared button/chiclet/dialog/page-header styles, D19 heading focus) are built and pass the automated three-browser story, e2e, parity and token suites. The predecessor plan, [storybook-component-library.md](archive/storybook-component-library.md), was archived manually on 2026-11-19 with three kinds of residual work. First, the manual assistive-technology and display-setting evidence was never recorded. Second, the minor test-strength findings from its 2026-11-16 legacy implementation audit remain open. Third, some specification text is stale or incomplete. Its MAJOR-1 (Back focus return) and MAJOR-2 (duplicate-dismissal test) findings are fixed and are not in scope here.

**Target behaviour:** Every residual finding is either fixed with a test that can fail, or recorded as an accepted deviation. The specifications describe the built shell without stale or future-tense text. The manual keyboard, VoiceOver and display-setting observations are recorded as real human evidence, with no emulation substituted.

**Why:** Close the gap between "automatically verified" and "verified" for the shell, so its component specs can honestly claim implemented status. Also remove tests that pass whether or not the behaviour they name holds.

## Scope

**In scope** (findings from the predecessor's 2026-11-16T08:58:52Z audit, rechecked against `specification/` on 2026-11-19; re-verify product/test findings with `codebase-scout` when expanding)

- **Manual evidence (human):** keyboard journeys in Chromium and Firefox; Safari/VoiceOver current-link, dialog and disabled-button announcements; real 200% browser zoom; 320px reflow; RTL and long text; forced-colours focus; reduced motion. The accepted T1 heading/dialog focus evidence stands and is not repeated.
- **Tests that cannot fail or under-assert:**
    - FOCUS-AC-3 workflow/modal cases pass without the abort, because disconnection and the inert underlay are enough. Only the data-mode case proves cancellation.
    - The heading-focus outline colour token is never asserted (FOCUS-AC-5, PH-AC-1).
    - The CONV-2/3 class-naming regex misses decorated classes when a comment or another decorator sits in between.
    - BTN-AC-14 passes because of the fixture SVG's own `width`/`height` attributes, not the component's sizing.
    - A duplicate, assertion-light "CDLG-AC-3" test exists (`tests/content-dialog.e2e.ts`, around line 270).
    - Sidebar paired screenshots are written via `outputPath` rather than attached to the report.
- **Visual review (human decision, then fix or register):**
    - The current workflow step 3 is about 28px taller than the reference and has a two-tone current background. Only the self-generated baseline guards it, and it was never queued for human review.
    - The sidebar row focus is an inset 2px outline (−2px offset) that `specification/visual-design.md` does not register. Footer links use +2px, but `specification/components/sidebar.md` line 35 says focus is inset.
- **Code documentation:** `focusHeading` TSDoc lacks `@returns`. `app-sidebar.stories.ts` imports `tests/visual-parity/fixtures.ts`, so a story depends on test code.
- **Specification sync:**
    - `specification/app-state-and-navigation.md` §4 still says current entries use `cursor: default`; check against the built style.
    - `specification/TODO.md` TODO-33 still mentions Comlink in testing.md.
    - `specification/components/card.md` (about lines 340–345) uses future-tense chiclet requirements ("the chiclet spec MUST"); now that `chiclet.md` exists, it should point there.
    - The project-section `aria-label` rationale exists only in the archived plan's log.
    - The SEM-11 summary-badge deviation registers a non-difference.
    - The SIDE-STATE-1 and I18N-AC-1–3 acceptance IDs are not mapped to tests in any spec.
    - The new shell component specs say implemented without noting that the manual checks are still pending.

**Out of scope**

- Separately tracked follow-ups in `specification/HUMAN.md`: feature stories for data/target/virtual-table, the 24 data/model colour-contrast findings in `tests/a11y-feature-findings.ts`, and the literal-colour guard coverage (Known gap 13).
- Any new shell feature, API, token or visual choice beyond the deviations decided here. Any change to router decisions, scroll restoration or stores.
- Reopening or editing the archived predecessor plan.

## Risks and open questions

- **Blocking:** (resolve when expanding with `/create-plan`)
    1. **Closure versus human evidence.** The predecessor deadlocked because its final task needed manual evidence nobody could supply. Should this plan's closure require that evidence? Recommended: no. Make the agent tasks closable on automated evidence. Track the manual checks as one `specification/HUMAN.md` item, and have the shell component specs state "manual AT/zoom checks pending" until it is ticked. Alternative: a final human-evidence task that blocks `implemented`.
    2. **Step 3 height and two-tone background.** Fix to match the mockup, or register a deviation in `specification/visual-design.md`? A human visual decision.
    3. **Focus offset.** Keep the inset (−2px) sidebar-row outline and register it, and should footer links also be inset (as `sidebar.md` line 35 says) or keep +2px?
- **Non-blocking:**
    - Lit tasks need `lit-architecture-planner` (planning) and `lit-component-implementer` (implementation).
    - Firefox runs need the scratch-home env file recorded in the predecessor's log.
    - Screenshot baselines may change if question 2 leads to a fix. Review the new images against the mockup; do not loosen tolerances.

## Change log

| When (UTC)           | Change       | Reason                                                                                                                                                                                    |
| -------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-19T10:53:17Z | Initial stub | User requested a stub for the unresolved issues in `storybook-component-library.md` before that plan was archived manually: its manual evidence, audit MINOR findings and spec staleness. |
