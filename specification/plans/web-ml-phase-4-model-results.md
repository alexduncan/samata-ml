# Phase 4: Display single-model and comparison results

**Status:** stub | **Updated:** 2026-11-17T21:23:45Z
**Authors:** Google Antigravity (Gemini 4 Argon High) | **Created:** 2026-11-17T21:23:45Z
**Verified by:** — | **Verified:** — | **Verification:** pending
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour:** `src/features/models/app-model-builder-view.ts` (L1105–1112) renders Section 6 (`6. Model Results`) as `<p class="pending-notice">Not available yet.</p>`, and `src/app.ts` (L57–66) renders an inline placeholder on `/results`.

**Target behaviour:** Once model training completes in Phase 3 (`specification/plans/web-ml-phase-3-model-training.md`), the UI updates to display single-model evaluation results in Section 6 (`<app-model-results>`) and cross-model comparison results on `/results` (`<app-results-view>`, adopting `pageHeaderStyles` and updating `src/app.ts` and `tests/app-shell.e2e.ts`), driven by validated JSON result-view layouts (`content/model-views/classification.json` and generated model diagnostic layouts).

**Why:** Present clear, unbiased evaluation metrics, confusion tables, model fit diagnostics, and compatible cross-model comparisons after Phase 3 training finishes.

## Scope

**In scope**

- Validated declarative JSON layout loader (`src/features/results/result-layout.ts`) and build-time layout publication (`content/model-views/classification.json` plus per-model diagnostic blocks from `web-ml` JSON `metrics`).
- Presentational `<app-model-results>` (`src/features/results/app-model-results.ts`) in Section 6 of `<app-model-builder-view>` rendering run summary, common scores (`accuracy`, `macro-f1`, `log-loss`), confusion matrix (with class filter when $> 20$ classes), and model diagnostics (`lossCurve_` paged table, `nIter_`, `nodeCount_`, `maxDepth_`, `nSamplesFit_`, `nSupport_`).
- Connected `<app-results-view>` (`src/features/results/app-results-view.ts`) replacing the `/results` placeholder in `src/app.ts`, adopting `pageHeaderStyles` (`src/styles/page-header.styles.ts`) to preserve `/results` visual parity (`tests/visual-parity/map.ts` L382–397) and updating `tests/app-shell.e2e.ts` (`PH-AC-1`, `PH-AC-2`).
- Co-located Storybook stories and three-browser Playwright E2E tests (including reference journey extensions in `tests/journeys/`).

**Out of scope**

- Interactive charts, ROC curves, decision-boundary plots, and fairness audit visualisations (`specification/TODO.md` TODO-41, TODO-43).
- Model configuration (Phase 1), training setup (Phase 2), training execution (Phase 3), and hyperparameter tuning UI (Phase 5).

**Constraints and invariants**

- Strict TypeScript, Bun only, TSDoc on all exported symbols, native semantic tables, WCAG 2.2 AA, British English, and `@nanostores/i18n`.
- No `unsafeHTML`, arbitrary property paths, or executable expressions in JSON result layouts.

## Risks and open questions

- **Blocking:** Expand this `stub` into a full `draft` plan after resolving the Phase 3 result-shape contradiction between `createTrainingClient().train()` (which returns a fitted `Classifier` yielding a test confusion matrix and estimator diagnostics `lossCurve_`, `nodeCount_`, `nSupport_`) and `nestedCrossValidate()` (which discards fitted models and returns `NestedCrossValidationResult<A>` with per-fold scores, `meanScore`, `standardDeviation`, and optional aggregate `metrics`, but no confusion matrix or estimator diagnostics). Decide whether Phase 4 renders distinct result layouts for `one_shot` vs `nested_cv` runs, or whether Phase 3/4 refits a final model on full data after Nested CV, and define how `/results` compares a `one_shot` model against a `nested_cv` model.
- **Non-blocking:** Draft `specification/mockups/ui-scaffold/drafts/03-7_train-models-5-results.html` awaits human visual styling and promotion (`specification/HUMAN.md`).
