# Scroll-region restoration and cancellation repairs

**Status:** stub | **Updated:** 2026-11-20T07:59:44Z
**Authors:** Claude Code (claude-opus-5-5) | **Created:** 2026-11-20T07:59:44Z
**Verified by:** — | **Verified:** — | **Verification:** pending
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour:** `src/router/scroll-restorer.ts` saves named `regions` (L54, L69) but has no region restore logic; `recordCurrentScroll` replaces the whole snapshot. Restoration is cancelled only by `wheel`, `touchstart` and `keydown` (L136–139), not `pointerdown`; the key test at L126 checks the invalid key `'Space'`; there is no height retry. `specification/app-state-and-navigation.md` §8.1 (L400) tracks wide-table inner scrollers as named regions, and §8.4 (L447–452) requires a ResizeObserver retry for about 2 s and `pointerdown` cancellation. The Phase 2 fold matrix (`<app-training-setup>`, `.fold-matrix-scroll`) overflows at narrow widths but its offset is not saved (recorded exception in `web-ml-phase-2-training-setup.md` D8).

**Target behaviour:** Region updates merge into the snapshot for the same key and viewport width; document-only saves keep regions; a different width starts fresh. Restoration applies the document offset, then registered region offsets, with height retries, and is cancelled by any user scroll input including `pointerdown` and horizontal arrow keys. The model builder saves and restores the fold-matrix logical inline offset per model through a public event and method on `<app-training-setup>`, including under a Help overlay and after reload.

**Why:** Meets navigation §8 for every wide region and removes the Phase 2 exception. Split from `web-ml-phase-2-training-setup.md` (D8, 2026-11-20).

## Scope

**In scope** (re-verify with `codebase-scout` when expanding)

- `src/router/scroll-restorer.ts` merge, restore callback, cancellation and height retry; the restore handoff in `src/app.ts`; a builder route-view method that delegates to the child; a child position event and restore method with RTL-aware logical offsets and echo suppression.
- Tests: router unit tests for merge and width change; browser tests at 320 CSS px for a ten-fold matrix after Back and reload, a second model at the origin, a different width, RTL, Help open and close, and a late restore that must not move focus or overwrite the active snapshot.

**Out of scope**

- Router Help-history ownership (`router-help-history-and-dynamic-topics.md`). Data-table region behaviour beyond keeping its offsets.

## Risks and open questions

- **Blocking:** None identified yet; run `/create-plan` to expand. Depends on `web-ml-phase-2-training-setup.md` being implemented.
