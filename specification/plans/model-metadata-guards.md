# Model metadata guards for the builder and models overview

**Status:** stub | **Updated:** 2026-11-20T07:59:44Z
**Authors:** Claude Code (claude-opus-5-5) | **Created:** 2026-11-20T07:59:44Z
**Verified by:** — | **Verified:** — | **Verification:** pending
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour:** The dataset store publishes any non-null metadata as ready. `src/features/models/app-model-builder-view.ts` reads `metadata.columns` with truthiness checks only (feature initialisation L443–447, target type L745–746, `buildFeatureRows` L919–920, `targetClassCount` L1114–1117), so an IndexedDB record with a missing or non-array `columns` throws during render. The Section 3 Save & Continue handler can persist a binary default when target classes cannot be read. `src/features/models/app-models-view.ts` calls `columns.map` (L270) before rendering rows, with no Retry for this case.

**Target behaviour:** One shared guard validates readiness, dataset identity and the shape of `columns` (named records of recognised types, well-formed category and boolean counts where consumed) before any read. Completed Sections 1–3 keep their headings, Edit controls and summaries while loading or failed. Malformed metadata shows a localised explanation and **Retry** in the builder and the overview; Retry reloads once and participates in `whenSettled()`. No write happens until a fresh, usable result arrives.

**Why:** Prevents uncaught render errors and silent wrong defaults from corrupt local data. Split from `web-ml-phase-2-training-setup.md` (D8, 2026-11-20); Phase 2's Section 4 already uses its own guarded selector, which this plan may consolidate.

## Scope

**In scope** (re-verify with `codebase-scout` when expanding)

- Guard and Retry in builder Sections 1–3, the Section 3 Save & Continue handler and the models overview.
- Browser tests that replace the IndexedDB metadata at the same ID with missing or non-array `columns`, reload, assert Retry and no uncaught error, restore valid metadata and Retry once; malformed target counts as a Retry case; the overview rebuilds rows in dataset order without a configuration write.

**Out of scope**

- Dataset ingestion validation. Section 4 training setup (Phase 2).

## Risks and open questions

- **Blocking:** None identified yet; run `/create-plan` to expand.
