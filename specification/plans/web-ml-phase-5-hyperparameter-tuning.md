# Phase 5: Add hyperparameter tuning to model configuration

**Status:** stub | **Updated:** 2026-11-18T08:34:14Z
**Authors:** Google Antigravity (Gemini 4 Argon High) | **Created:** 2026-11-17T21:23:45Z
**Verified by:** — | **Verified:** — | **Verification:** pending
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour:** Phase 1 (`specification/plans/web-ml-phase-1-configure-model.md`) implements manual hyperparameter selection (`mode: 'manual'`) in Step 3 (`3. Configure Model`), storing fixed option values in `model.hyperparameters.values`.

**Target behaviour:** Step 3 (`3. Configure Model`) adds an option to configure hyperparameter tuning (`mode: 'tuning'`), allowing users to choose Fixed vs Tune search domains (`categorical`, `integer`, `uniform`, `log-uniform`) and search parameters (`RandomSearchStrategy`, `nTrials`, `randomState`, `scoring`), persist them in `model.hyperparameters`, and execute tuned training in Phase 3 (`HyperparameterTuningTrainingRequest` for one-shot training and `NestedCrossValidationRequest` for nested cross-validation) with trial results displayed in Phase 4.

**Why:** Layer automated hyperparameter exploration onto the working manual configuration, training setup, worker execution, and results pipeline established in Phases 1–4.

## Scope

**In scope**

- Extending `HyperparameterConfig` in `src/types/state.ts` and `src/stores/persister.ts` with typed `tuningSearchSpace: Record<string, SearchDomain>` and `search: { kind: 'random-search'; nTrials: number; randomState: number; scoring: 'accuracy' }` matching `web-ml`'s `TuningSearchSpace<A>` and `RandomSearchStrategy` (`node_modules/web-ml/dist/src/training/types.d.ts` L157–272).
- Extending `src/features/models/model-options.ts` and `<app-model-configuration>` (`src/features/models/app-model-configuration.ts`) with Manual vs Hyperparameter Tuning mode selection, per-field Fixed/Tune domain editors, and search budget controls.
- Connecting `mode: 'tuning'` to Phase 3 worker execution:
    - With Phase 2 `one_shot`: stratified train/validation/test partitioning (`trainingSampleCount` leading rows + `validationSampleCount` trailing rows in `PartitionDatasetProvider`), `createTrainingClient().train({ algorithm: 'hyperparameter-tuning', ... })`, using the narrowed `TuningResult<TTarget>.bestParams`, refitting on development rows, and evaluating on held-out test rows.
    - With Phase 2 `nested_cv`: passing `baseOptions` and `searchSpace` to `nestedCrossValidate({ algorithm, outerFolds, innerFolds, baseOptions, searchSpace, strategy, scoring, ... })`.
- Rendering the tuning trial summary table (`TuningTrialSummary[]`) in Phase 4 results (`<app-model-results>`).
- Co-located Storybook stories and three-browser Playwright E2E tests (`tests/classification-tuning.e2e.ts`).

**Out of scope**

- Hyperband tuning (`HyperbandStrategy`), PCA pipeline tuning (`pca-pipeline`), and binary decision threshold tuning (`thresholdTuning`).

**Constraints and invariants**

- `baseOptions` and `searchSpace` keys must be disjoint; at least one active parameter must be set to Tune when `mode === 'tuning'`.
- Held-out test rows in `one_shot` mode must never be used to score or select candidate hyperparameters.

## Risks and open questions

- **Blocking:** Expand this `stub` into a full `draft` plan once Phases 1–4 are complete and the planned `web-ml` type update (widening `HyperparameterDomain<T>` via `[Extract<NonNullable<T>, number>] extends [never]` so union-typed options like `SVCOptions['gamma']` accept numeric range domains, and narrowing `TrainingClient.train` overloads on `HyperparameterTuningTrainingRequest<TTarget>` so `result.bestModel` and `result.bestParams` preserve `TTarget`) is landed in `../web-ml`. Also confirm whether One-Shot tuning uses a fixed 60% train / 20% validation / 20% test split (since custom split sizes moved to `FUTURE.md` in Phase 2).
- **Non-blocking:** Draft `specification/mockups/ui-scaffold/drafts/03-4_train-models-3-configure-model.html` tuning sections await human visual styling and promotion (`specification/HUMAN.md`).
