# Router Help-history ownership and dynamic Help topics

**Status:** stub | **Updated:** 2026-11-20T07:59:44Z
**Authors:** Claude Code (claude-opus-5-5) | **Created:** 2026-11-20T07:59:44Z
**Verified by:** — | **Verified:** — | **Verification:** pending
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour:** `src/router/router.ts` decides whether dismissing a reserved modal calls `history.back()` from a global `inAppHistoryCount` (declared L18, incremented L148 and L216, decremented L237–238, reset L446). Closing a pushed Help entry consumes the count, and Forward reopens the entry without restoring it, so a second Close replaces instead of going Back. The same defect affects a directly loaded `/about` followed by a sidebar push, Back and Close. Help pages are a closed list of fixed paths (`src/types/routes.ts` L5, `src/router/route-parser.ts` L35–43); each new page edits five files.

**Target behaviour:** Each reserved entry records which document session pushed it, so Close and Escape go Back exactly when the entry was pushed in this document, however often it is revisited by Forward, and replace to the underlay otherwise (direct load, reload, explicit replace, legacy entries). Optionally, any single lowercase kebab-case `/help/{slug}` opens a Help page from `content/{locale}/pages/{slug}.md`, with an "unlisted topic" message distinct from delivery errors.

**Why:** `specification/app-state-and-navigation.md` §5.2 requires a pushed entry to dismiss with Back, including after it is revisited. Split from `web-ml-phase-2-training-setup.md` (D8, 2026-11-20).

## Scope

**In scope** (re-verify with `codebase-scout` when expanding)

- Replace `inAppHistoryCount` with an optional `modalDocumentId` on `HistoryEntryState` and a per-router-initialisation ID. Pushes record the owner; topic switches keep the entry ID, underlay and owner; bootstrap of a reserved URL records an unowned entry over the resume path.
- Tests: two Close/Forward and Escape/Forward cycles over one pushed Help entry; direct-load and reload dismissal; explicit `navigate(…, { replace: true })`; legacy ownerless entries.
- Decision needed: whether to add dynamic `/help/{slug}` routing. If yes: slug validation at the parser and at `openReserved`/`navigate`, a finite build-checked map of required pages, a loader error subclass for a validated-index miss (`src/common/content/content-loader.ts` L281–287), an unlisted-topic message in `app-content-modal.ts`, and `app-content-modal.stories.ts` with cache isolation (`resetContentCache` L323–327).

**Out of scope**

- Scroll restoration (`scroll-region-restoration.md`). Help article content.

## Risks and open questions

- **Blocking:** Is dynamic `/help/{slug}` routing wanted, or should Help pages stay a closed list? Recommended: stay closed until there are more than about six Help pages.
