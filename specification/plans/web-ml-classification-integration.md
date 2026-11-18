# Integrate web-ml classification training and generated views (split into Phases 1–5)

**Status:** stub | **Updated:** 2026-11-18T08:34:14Z
**Authors:** Unrecorded agent (unrecorded model), Claude Code (claude-opus-5-5), Google Antigravity (Gemini 4 Argon High) | **Created:** 2026-11-13T22:51:48Z
**Verified by:** — | **Verified:** — | **Verification:** changes-requested
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour:** This monolithic 16-task plan previously combined Step 3.3 manual hyperparameter controls, Step 3.3 hyperparameter tuning, Step 3.4 training setup, Step 3.5 worker training and progress, and Step 3.6 / Step 4 results into a single file.

**Target behaviour:** Superseded and split into five sequential phase plans so each phase can be reviewed, verified, and implemented independently:

1. **Phase 1 (`draft`):** [web-ml-phase-1-configure-model.md](web-ml-phase-1-configure-model.md) — Step 3 (`3. Configure Model`) manual hyperparameter selection from `web-ml` JSON metadata and saving normalised values to application state matching `web-ml`'s `options` parameter (`Partial<TrainingOptionsFor<A>>`).
2. **Phase 2 (`draft`):** [web-ml-phase-2-training-setup.md](web-ml-phase-2-training-setup.md) — Step 4 (`4. Training Setup`) choosing between One-Shot Training and Nested Cross-Validation (with configurable number of folds), persisting `ValidationMethodology` to application state, and moving custom fold/split sizes to [FUTURE.md](../FUTURE.md).
3. **Phase 3 (`draft`):** [web-ml-phase-3-model-training.md](web-ml-phase-3-model-training.md) — Step 5 (`5. Train Model`) executing training via `web-ml`'s public functions (`createTrainingClient().train` and `nestedCrossValidate`) with a single `<progress>` bar and an expandable `<details>`/`<summary>` message log.
4. **Phase 4 (`stub`):** [web-ml-phase-4-model-results.md](web-ml-phase-4-model-results.md) — Step 6 (`6. Model Results`) and `/results` (`Compare Results`) displaying evaluation results once training completes.
5. **Phase 5 (`stub`):** [web-ml-phase-5-hyperparameter-tuning.md](web-ml-phase-5-hyperparameter-tuning.md) — Adding hyperparameter tuning configuration to Step 3 (`3. Configure Model`) and wiring tuned runs through Phases 2–4.

**Why:** Reduce plan size and cognitive load, isolate manual hyperparameter selection from hyperparameter tuning, and surface architectural contradictions between the requested phase boundaries and `web-ml@0.1.0`'s public API before implementation begins.

## Scope

**In scope**

- Cross-phase roadmap and contradiction/resolution ledger linking [web-ml-phase-1-configure-model.md](web-ml-phase-1-configure-model.md), [web-ml-phase-2-training-setup.md](web-ml-phase-2-training-setup.md), [web-ml-phase-3-model-training.md](web-ml-phase-3-model-training.md), [web-ml-phase-4-model-results.md](web-ml-phase-4-model-results.md), and [web-ml-phase-5-hyperparameter-tuning.md](web-ml-phase-5-hyperparameter-tuning.md).
- Preservation of the prior review history and change log from the monolithic draft.

**Out of scope**

- Direct implementation tasks in this file; all implementation tasks live in the individual Phase 1–5 plans.

**Constraints and invariants**

- Each phase plan must pass `/verify-plan` independently before `/implement` is run on that phase.

## Risks and open questions

- **Blocking:** This umbrella file is superseded by Phases 1–5 and is not directly implemented; status of the cross-phase items (`samata-ml` vs `web-ml`):
    1. **Nested Cross-Validation in Phase 2/3 vs Hyperparameter Tuning in Phase 5 (`web-ml` + `samata-ml`):** _Recommended & drafted for `web-ml`:_ Introduce `crossValidate(request, options?)` in `web-ml` for fixed-hyperparameter $k$-fold cross-validation (`mode === 'manual'` in Phase 3), keeping `nestedCrossValidate(request, options?)` strictly for outer+inner loop hyperparameter tuning (`mode === 'tuning'` in Phase 5). In Phase 2, the single "Number of folds" UI input maps to `outerFolds = innerFolds = folds` (`folds` in `crossValidate`).
    2. **`nestedCrossValidate` / `crossValidate` threading, events, and missing fitted model (`web-ml` vs `samata-ml`):** _Awaiting final choice between trade-offs:_ Either keep CV execution inside `samata-ml`'s integration worker (normalising `TrainingEvent` and CV events, with an optional final `createTrainingClient().train()` refit or distinct `one_shot` vs `nested_cv` result views in Phase 4) or move CV orchestration into `web-ml`'s worker `TrainingClient` with optional `refit: true` and out-of-fold confusion counts.
    3. **One-Shot Training split ratio when fold/split sizes move to backlog (`samata-ml`):** _Resolved:_ Store a fixed default 80% train / 20% test stratified holdout split (`testRatio: 0.2, randomState: 42`) for `one_shot` mode and fit imputation/one-hot encoding on the 80% training partition only.
    4. **State `HyperparameterValue` and JSON vs TypeScript/prose hyperparameter conflicts (`samata-ml` + `web-ml`):** _Resolved in `samata-ml`:_ Widen `HyperparameterValue` to include `null` and `Record<string, number>`, and apply `model-presentation-policy.ts` (`learningRate` editable under `sgd` and omitted under `adam`, `nIterations` hidden, `threshold` `0.5` and NB priors `Automatic` read-only).
    5. **Classification-only (8 models) vs all 14 supervised models & multi-modality catalogue design (`web-ml` + `samata-ml`):** _Open:_ Decide whether Phase 1–3 restricts `model-catalogue.ts` to 8 classifiers or includes 6 regressors, and whether `web-ml` should export task- and modality-scoped model specification catalogues (`taskType` + `modality: 'tabular' | 'text' | 'image'`).
    6. **Phase 5 tuning domain restriction on union types and `TrainingClient.train` narrowing (`web-ml`):** _Resolved via drafted `web-ml` plan:_ Widen `HyperparameterDomain<T>` in `web-ml` via `[Extract<NonNullable<T>, number>] extends [never]` and add a `TrainingClient.train<TTarget>(request: HyperparameterTuningTrainingRequest<TTarget>)` overload preserving `TuningResult<TTarget>`.
- **Non-blocking:** Draft mockups `03-4`..`03-7` await human visual styling and promotion (`specification/HUMAN.md`).

## Escalations

None.

## Review fixes

None.

## Implementation and verification log

| When (UTC)           | Task   | Agent (model)                            | Outcome / commands / evidence                                                                                                                                     |
| -------------------- | ------ | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-13T22:51:48Z | —      | Unrecorded agent (unrecorded model)      | Planning baseline: `bun run check` 169 pass, 0 fail, 22 files. `bun run build` passed.                                                                            |
| 2026-11-13T23:16:48Z | —      | Unrecorded agent (unrecorded model)      | Planning review: targeted `plans:check` passed under the old validator; `bun run check` unchanged.                                                                |
| 2026-11-17T16:59:05Z | Review | Claude Code (claude-opus-5-5)            | Revision baseline: `bun run check` 220 pass, 0 fail, 31 files, typecheck clean.                                                                                   |
| 2026-11-17T21:23:45Z | —      | Google Antigravity (Gemini 4 Argon High) | Split monolithic plan into Phases 1–5 (`web-ml-phase-1-configure-model.md` .. `web-ml-phase-5-hyperparameter-tuning.md`) and recorded cross-phase contradictions. |

## Plan review history

| Reviewed (UTC)       | Agent (model)                               | Decision          | Findings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------- | ------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-17T16:41:55Z | Claude Code (claude-opus-5-5)               | changes-requested | BLOCKER: header not v2 (review_gate check: Unrecognised plan header; no Escalations/Review fixes sections; Blocking line not None). BLOCKER: metadata paths cite node_modules/web-ml/specification/model-specifications/ (absent); canonical is specification/public-api/model-specifications/ via export web-ml/model-specifications/\*; public-api docs not in Required reading. BLOCKER: isolation requirement, WML-ASSET-2 error assertion and Adam fixed learningRate rest on private ../web-ml/src lines; public current-limitations.md L325-328 says non-isolated training works; unresolved. MAJOR: D uses BatchDatasetProvider owned batches (deprecated adapter) while E says provider fills library-supplied arrays; CombinedDatasetProvider unnamed. MAJOR: Storybook now installed; COMPONENTS L190 requires co-located stories and L169 labels with defaults; G defers stories and defaults labels to null. MINOR: randomState not per-model (absent for Logistic/tree/SVC); train is createTrainingClient().train; lit-implementer renamed; baseline now 220/31; prerequisites and gaps 5/17 now resolved; reconciler ingestion probe vs shared lock unaddressed. |
| 2026-11-17T17:40:50Z | Google Antigravity (Gemini 4 Hydrogen High) | changes-requested | MAJOR: T4 omits 7 typechecked test/fixture files breaking tsc --noEmit (visual-parity/fixtures.ts, dataset-resources.test.ts, column-eligibility.test.ts, a11y.e2e.ts, visual-parity.e2e.ts, models-overview.e2e.ts, target-selection.e2e.ts) and T6 omits storage-db.test.ts. MAJOR: T8/T9/T14 break unlisted E2E assertions (models-setup.e2e.ts, journeys pending-notice, app-shell.e2e.ts PH-AC-1/2), and Interface G omits pageHeaderStyles for app-results-view parity. MAJOR: E/T11 assumes a nonexistent confirmation service and omits app-target-view.ts, app-data-view.ts, and mocked IndexedDBAdapter tests. MAJOR: drafts 03-4 (L402-432 custom priors, L208 broken aria-labelledby, mockups.css) and 03-5 (L337-342 mandatory isolation) contradict Scope/D8/B. MINOR: mlp-classifier.json learningRate fixed defaultKind conflict uncited; T12 bestParams narrowing; state-and-storage.md §7 lock wording.                                                                                                                                                                                                                                                        |

## Change log

| When (UTC)           | Change                                | Reason                                                                                                                                                                                                                                                                                                                 |
| -------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-13T22:51:48Z | Initial draft                         | User requested classification-first web-ml integration planning, generated hyperparameter/results views, an initial feature-complexity decision and progress-event analysis.                                                                                                                                           |
| 2026-11-13T23:14:26Z | Review and shared-workspace alignment | Added structural drafts, state identity/timing details and test-only runtime fixture boundaries; preserved concurrent conformance completion and Storybook ownership.                                                                                                                                                  |
| 2026-11-13T23:16:48Z | Final contract review                 | Clarified atomic start, full-test metric aggregation and literal diagnostic accessors; made component API formatting robust against Markdown table parsing.                                                                                                                                                            |
| 2026-11-17T16:59:05Z | Revision after changes-requested      | Migrated to the v2 template; public-api-only evidence; single app-ordered `PartitionDatasetProvider` (D6); co-located stories and typed label defaults (D12); per-model seeds; `createTrainingClient().train`; lock interaction with reconciler/`changeDataset`; split metadata task (T2/T3), tasks renumbered T1–T16. |
| 2026-11-17T21:23:45Z | Split into Phases 1–5 (`stub`)        | User requested splitting the monolithic plan into five sequential phases (Phase 1 manual hyperparameters, Phase 2 training setup, Phase 3 model training with `<details>`/`<summary>` log, Phase 4 results stub, Phase 5 hyperparameter tuning stub) and documenting all scope/API contradictions.                     |
