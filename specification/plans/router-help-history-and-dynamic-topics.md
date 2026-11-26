# Help modal breadcrumbs, Back trail and in-article anchors

**Status:** stub | **Updated:** 2026-11-26T18:45:17Z
**Authors:** Claude Code (claude-opus-5-5) | **Created:** 2026-11-20T07:59:44Z
**Verified by:** — | **Verified:** — | **Verification:** pending
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour** — After [comprehensive-help-documentation](comprehensive-help-documentation.md), `/help/...` is an open, validated set of reserved routes served from the `help` content index, with a `not-found` state that is distinct from delivery errors. That settles this stub's original question: dynamic topics are wanted (maintainer decision, 2026-11-26). Help-to-Help links replace history, and Close, Escape and browser Back close Help (§5.2, kept by maintainer decision on 2026-11-26). The Help domain rejects `#` and `{path}#` links because the router leaves `#…` to the browser (`src/router/router.ts:826`), which cannot reach ids inside the dialog's shadow root, and drops the hash of `/path#…` (`:829`).

**Target behaviour** — Inside the Help modal, a learner sees breadcrumbs derived from `parentPath` in the Help index, and after following a link sees a **Back to {previous title}** control. The control uses an in-memory trail owned by `app-content-modal` and navigates with the existing reserved-to-reserved `replaceState`. In-article `#` links scroll within the dialog without adding history, and `/help/x#y` links open `x` scrolled to `y`, with the hash still neither persisted nor generated in the URL.

## Scope

**In scope** (re-verify with `codebase-scout` when expanding)

- Breadcrumb `<nav>` and the Back-trail control in `app-content-dialog` (closed API additions), the trail state in `app-content-modal`, and draft mockup states.
- Anchor handling: dialog-local scrolling for `#id`, a scroll target passed for `/help/x#y`, the build-time anchor validation that replaces HELP-LINK-1's fragment ban, and focus management.

**Out of scope**

- Stacked browser history for Help (`helpDepth`), which the maintainer declined on 2026-11-26. Entry points and corpus are handled in [help-entry-points.md](help-entry-points.md) and the corpus plans.

## Risks and open questions

- **Blocking:** None identified yet; run `/create-plan` to expand. Expansion must confirm whether a trail survives a reload (recommended: no) and how focus moves after a Back-trail activation (recommended: the modal `<h2>`).
