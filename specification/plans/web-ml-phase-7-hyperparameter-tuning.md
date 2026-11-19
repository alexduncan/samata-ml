# Phase 7: Configure, run and explain hyperparameter tuning

**Status:** draft | **Updated:** 2026-11-19T08:47:35Z
**Authors:** Google Antigravity (Gemini 4 Argon High), Claude Code (claude-opus-5-5) | **Created:** 2026-11-17T21:23:45Z
**Verified by:** — | **Verified:** — | **Verification:** pending
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour:** Phase 1 ([web-ml-phase-1-configure-model.md](archive/web-ml-phase-1-configure-model.md)) fixes `model.hyperparameters.mode = 'manual'` and stores fixed values in `model.hyperparameters.values`. `src/types/state.ts` L73–77 still declares a provisional `tuningSearchSpace?: Record<string, HyperparameterValue[]>`. Phases 3–6 train, evaluate and display fixed-hyperparameter models only.

**Target behaviour:** Section 3 (`3. Configure Model`) offers **Manual** or **Hyperparameter tuning**. In tuning mode each tunable option is **Fixed** or **Tune**: categorical options take a checkbox set of at least two candidates, numeric options a minimum, maximum and scale (integer, linear or log). A random-search budget (trials and seed) and a live model-fit count complete the form. Training then runs:

- **One-Shot + tuning:** the same stratified 80/20 split as manual One-Shot; `createTuner().search()` on a 75/25 stratified split of the 80% development rows (60/20/20 overall); a refit of the best parameters on all development rows; Phase 4 evaluation on the 20% test rows.
- **Nested CV + tuning:** `nestedCrossValidate` with the Phase 2 fold count as outer and inner folds, on the same outer partitions as manual cross-validation, with a final refit search on all rows.

Section 6 gains a **Tuning** section: search summary, an inner-CV hyperparameter selection matrix (outer folds × tuned parameters), per-fold trial history, and validation curves (score against a tuned value, e.g. the KNN k-sweep and tree-depth curve; a 2D scatter for two tuned numeric parameters such as SVC C and γ). Tuned models compare directly with manual models evaluated on the same rows in Phase 5.

**Why:** Layer automated hyperparameter exploration onto the working configuration, training, results and comparison pipeline, while keeping test rows out of every selection decision (VISION §10).

## Scope

**In scope**

- `SearchDomain`, `TuningSearch` and the tuning fields of `HyperparameterConfig` (`src/types/state.ts`, `src/stores/persister.ts`), with validation and fit-count helpers.
- Tuning policy in `src/features/models/model-presentation-policy.ts` (tunable kind, hard bounds, default scale, parent/child activation).
- Extending `<app-model-configuration>` (Phase 1) with mode, Fixed/Tune editors and budget controls; updating draft `03-4`.
- Worker execution for both protocols, progress normalisation for tuning events, and `StoredEvaluation` version 3 `tuning` record.
- Tuning results elements `app-tuning-summary`, `app-selection-matrix`, `app-trial-table`, `app-tuning-curve`, `app-tuning-scatter`; five sequential chart tokens; Section 6, `/models` and Phase 5 label updates.
- Three-browser Playwright tests (`tests/classification-tuning.e2e.ts`) and stories.

**Out of scope**

- Hyperband (`HyperbandStrategy`), PCA pipeline tuning (`pca-pipeline`), binary decision-threshold tuning (`thresholdTuning`), grid search (not offered by `web-ml`; UX note §6 grid rows go to `FUTURE.md`), tuning dependent child options while their parent is tuned, a "create a tuned copy of this model" action from the Phase 4 diagnostic card — all `specification/FUTURE.md`.
- Choosing a scoring metric: candidates are always scored by balanced accuracy, matching the Phase 4 headline.

**Constraints and invariants**

- Fixed (`values`) and tuned (`tuningSearchSpace`) keys are disjoint; at least one active option is tuned when `mode === 'tuning'`.
- Test rows (One-Shot) and outer held-out rows (Nested CV) never score or select candidates.
- Tuned One-Shot runs use exactly the manual One-Shot test rows; tuned nested runs use exactly the manual cross-validation outer partitions (WR-10), so Phase 4 fingerprints match and Phase 5 compares them.
- `web-ml` runs all folds, searches, refits and scoring (WR-7, WR-10, WR-11, WR-13). `samata-ml` validates configuration, computes the displayed fit count and maps results.
- Phase 4–6 rules apply (charts, tokens, a11y, i18n, closed APIs).

## Required reading

- `specification/plans/web-ml-classification-integration.md` §Scope (WR ledger: WR-7, WR-8, WR-10, WR-11, WR-13).
- `specification/plans/web-ml-phase-1-configure-model.md` §Interfaces A–D — option documents, presentation policy, `<app-model-configuration>` API.
- `specification/plans/web-ml-phase-3-model-training.md` §Interfaces A — progress and log normaliser.
- `specification/plans/web-ml-phase-4-single-model-results.md` §Interfaces A–C; `specification/plans/web-ml-phase-5-model-comparison.md` §Interfaces A; `specification/plans/web-ml-phase-6-model-specific-results.md` §Interfaces A.
- `specification/notes/user-experience-decisions.md` §3, §4, §5, §6, §8 — boundary tiers, compute alert, Fixed/Tune checkboxes, numeric ranges, dependent controls.
- `specification/notes/metrics-and-visuals.md` §1 (inner-CV items), §3 D.
- `node_modules/web-ml/dist/src/training/types.d.ts` L157–272 (`HyperparameterDomain`, `TuningSearchSpace`, `TuningScoring`, `RandomSearchStrategy`, `HyperparameterTuningTrainingRequest`), L413–482 (`TuningTrialSummary`, `TuningResult`); `node_modules/web-ml/dist/src/training/TuningClient.d.ts` L1–90 (`TunerSearchRequest` holdout/fold-aware, `TuningRun<A>`, `createTuner`); `node_modules/web-ml/dist/src/training/cross-validation.d.ts` L43–116.
- `../web-ml/specification/public-api/hyperparameters.md` L25–60 (tuning entry points).
- `specification/COMPONENTS.md` §2–§10; `specification/visual-design.md` §1.1, §2.

## Codebase context

- **Relevant specifications:** `specification/workflow-steps.md` §3.3 ("Model Configured" or "Hyperparameter Tuning" header), §3.5 (per-step timing table for tuning), §3.6; `specification/TODO.md` TODO-04 (tuning UI: search method, ranges, metric).
- **Relevant implementation:** `src/types/state.ts` (`HyperparameterConfig` L73–77), `src/stores/app.store.ts` (`setHyperparameters` L497), `src/stores/persister.ts`, `src/features/models/app-models-view.ts` (Configuration column shows raw `hyperparameters.mode`), `src/features/models/app-model-builder-view.ts`. Phase 1 delivers `model-presentation-policy.ts`, `model-options.ts`, `app-model-configuration.ts`; Phases 3–6 deliver the worker, `StoredEvaluation`, `app-model-results`, `comparison-model.ts`.
- **Verified `web-ml@0.1.0` contracts:** `createTuner().search()` is public (`dist/src/training/index.d.ts` L4–5) and returns `TuningRun<A>` with `result: Promise<TuningResult<A>>` (typed `bestModel`, `bestParams`, `trials`), so no `TrainingClient.train` overload is needed. `TunerSearchRequest` is either holdout (`trainingData` + `validationData`) or fold-aware (`trainingData` + `innerFoldAssignments` + `innerFoldCount`). `TuningScoring` for classifiers is `'accuracy' | 'f1' | 'log-loss'` (no balanced accuracy). `TuningTrialSummary` has `trialId`, `params`, `score?`, `status`, `durationMs` and no training score. `nestedCrossValidate` folds carry `bestParams` and `innerScore` but discard trials. The refit plan verified `HyperparameterDomain<T>` already accepts numeric ranges for `SVCOptions['gamma']`. Whether `bestModel` is fitted on all supplied rows is documented only in an internal-looking declaration (`Tuner.d.ts` L17–18), so D3 refits explicitly.
- **Tests and commands:** `tests/state-and-storage.test.ts`, `tests/model-configuration.e2e.ts` (Phase 1), `tests/classification-training.e2e.ts` (Phase 3). Record the `bun run check` baseline before T1.
- **Web guidance:** `forms` (fieldsets, checkbox groups with minimum selections, number inputs, error association), `accessibility`, `html`.
- **Visual reference:** Draft only — `specification/mockups/ui-scaffold/drafts/03-4_train-models-3-configure-model.html` (its "Advanced Random Search" section L570+ is rewritten in T3) and `drafts/03-7_train-models-5-results.html` (Tuning section added in T6).
- **Domain skills:** `lit-component-implementer` for T3, T5, T6.
- **Assumptions requiring verification:** Landed signatures for WR-7, WR-10, WR-11 and WR-13.

## Technical decisions

| Decision                         | Chosen approach and rationale                                                                                                                                                                                                                                                                                                                                                                                             | Rejected alternative / trade-off                                                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 One-Shot tuning split         | Outer 80/20 split identical to manual One-Shot (`testRatio 0.2`, `randomState 42`, WR-10); inner 75/25 stratified split of the development rows (`randomState` = the search seed). Overall 60/20/20, as the stub proposed.                                                                                                                                                                                                | Inner k-fold for One-Shot: Phase 2 offers no fold count for One-Shot; a different outer split would break comparability with manual One-Shot models. |
| D2 Nested tuning                 | `nestedCrossValidate` with `outerFolds = innerFolds = trainingSetup.outerFolds`, `randomState = trainingSetup.randomState`, WR-7 pipeline, WR-8 hook (Phase 6 insights) and WR-11 outputs and `refit`.                                                                                                                                                                                                                    | Orchestrating outer folds in `samata-ml` (rejected by the user 2026-11-19).                                                                          |
| D3 Explicit One-Shot refit       | After `createTuner().search()` resolves, dispose `bestModel` and fit `bestParams` on all development rows with `createTrainingClient().train()` (WR-7 pipeline), then evaluate on the test rows. Costs one extra fit; semantics are unambiguous from public declarations.                                                                                                                                                 | Trusting `bestModel`: whether it saw the 25% validation rows is not publicly documented.                                                             |
| D4 Scoring                       | Balanced accuracy (WR-11 scorer) for every search, shown as read-only text "Candidates are scored by balanced accuracy on validation rows".                                                                                                                                                                                                                                                                               | Learner-chosen scoring: tuning on accuracy while the headline shows balanced accuracy teaches the wrong lesson on imbalanced data.                   |
| D5 Search domains                | Persist `SearchDomain` exactly as `web-ml`'s domain kinds (`categorical`, `integer`, `uniform`, `log-uniform`). Policy defaults: `log-uniform` for multiplicative options (C, γ, α, learning rate, `varSmoothing`), `integer` for counts and depths, `categorical` for enums and booleans. Union options (`gamma`, nullable `maxDepth`) let the user choose "candidate values" or "numeric range".                        | Separate UI-only shapes: an extra mapping layer to keep in sync.                                                                                     |
| D6 Validation tiers (UX note §3) | Hard block: invalid domains (min ≥ max, log-uniform min ≤ 0, non-integer integer bounds, < 2 categorical candidates, bounds outside the policy's hard limits, no tuned option, child tuned while parent tuned). Hard ceiling: `nTrials` 1–100. Allowed: extreme but valid ranges. Errors use `aria-invalid` and `aria-describedby`; values are never silently clamped.                                                    | Clamping on blur: hides the learner's choice (UX note §3).                                                                                           |
| D7 Fit count and compute alert   | One-Shot: `nTrials + 1`. Nested: `(K + 1) × (K × nTrials + 1)` (K outer-fold searches plus the final search on all rows, each with `K × nTrials` candidate fits and one refit of the winner). A non-blocking `.notification` appears at ≥ 500 fits, stating the count and that training may take minutes on a laptop.                                                                                                     | No estimate: learners cannot anticipate cost (UX note §4).                                                                                           |
| D8 Dependent options             | When a parent option (e.g. SVC `kernel`, Logistic `solver`) is tuned, its dependants (`degree`, `gamma`, `penalty`) must be Fixed, with an inline explanation; a Fixed parent hides inactive dependants (Phase 1 policy `appliesWhen`).                                                                                                                                                                                   | Conditional search spaces: `web-ml` random search samples options independently.                                                                     |
| D9 Persisted tuning record       | `StoredEvaluation` version 3 adds optional `tuning: StoredTuning` (Interfaces §B). Earlier versions render without a Tuning section.                                                                                                                                                                                                                                                                                      | Storing `TuningResult` objects: carry hydrated models.                                                                                               |
| D10 Curves from trials           | `app-tuning-curve`: one tuned numeric option on x (log axis for `log-uniform`), validation score on y, one dot per completed trial with marker shape per outer fold, best trial per fold ringed, and training score as hollow dots when WR-13 data exists ("bias–variance" sentence). `app-tuning-scatter`: two tuned numeric options on x/y, dot fill from `--chart-seq-1…5` by score quintile, score in the data table. | Interpolated heatmaps: random-search points are irregular; interpolation invents scores.                                                             |
| D11 Sequential tokens            | Add `--chart-seq-1: var(--blue-100)`, `--chart-seq-2: var(--blue-300)`, `--chart-seq-3: var(--blue-500)`, `--chart-seq-4: var(--blue-700)`, `--chart-seq-5: var(--blue-900)`; dots also carry a `--chart-axis` stroke so light fills keep a 3:1 boundary. `tests/chart-tokens.test.ts` asserts the stroke rule.                                                                                                           | A Plot built-in scheme: literal colours outside the token vocabulary.                                                                                |

### Interfaces and behaviour

#### A. Configuration state (`src/types/state.ts`)

```ts
export type SearchDomain =
	| { kind: 'categorical'; values: (string | number | boolean | null)[] }
	| { kind: 'integer'; min: number; max: number }
	| { kind: 'uniform'; min: number; max: number }
	| { kind: 'log-uniform'; min: number; max: number };

export interface TuningSearch {
	kind: 'random-search';
	/** Integer 1–100; default 20. */
	nTrials: number;
	/** Integer; default 42. */
	randomState: number;
}

export interface HyperparameterConfig {
	mode: 'manual' | 'tuning';
	values: Record<string, HyperparameterValue>;
	/** Present only when mode === 'tuning'; keys disjoint from `values`. */
	tuningSearchSpace?: Record<string, SearchDomain>;
	search?: TuningSearch;
}
```

- Persister migration: a legacy `tuningSearchSpace` of value arrays becomes `{ kind: 'categorical', values }` when it has ≥ 2 values, otherwise it is dropped and the model returns to `mode: 'manual'`.
- `src/features/models/tuning-config.ts`: `validateTuningConfig(config, policy, context): TuningIssue[]` (D6, each issue `{ option: string | null; code: TuningIssueCode }`), `fitCount(config, setup): number` (D7), `toSearchRequest(config, document)` → `{ baseOptions, searchSpace, strategy }` in `web-ml` shapes.
- Policy additions (`model-presentation-policy.ts`): per option `tuning?: { kinds: readonly SearchDomain['kind'][]; defaultKind: SearchDomain['kind']; hardMin?: number; hardMax?: number; parent?: string }`.

#### B. Tuning record (`src/types/model-evaluation.ts`, `schemaVersion: 3`)

```ts
export interface StoredTrial {
	readonly trialId: number;
	readonly params: Readonly<Record<string, string | number | boolean | null>>;
	readonly status: 'completed' | 'pruned' | 'failed';
	readonly validationScore: number | null;
	readonly trainingScore: number | null;
	readonly durationMs: number;
}

export interface StoredTuning {
	readonly strategy: {
		readonly kind: 'random-search';
		readonly nTrials: number;
		readonly randomState: number;
	};
	readonly scoring: 'balanced-accuracy';
	readonly searchSpace: Readonly<Record<string, SearchDomain>>;
	readonly baseOptions: Readonly<Record<string, HyperparameterValue>>;
	/** One entry per Phase 4 partition (One-Shot: one). */
	readonly searches: readonly {
		readonly partitionIndex: number;
		readonly bestParams: Readonly<Record<string, string | number | boolean | null>>;
		readonly bestValidationScore: number;
		readonly trials: readonly StoredTrial[];
	}[];
	/** Nested CV final search on all rows (WR-11 refit); null for One-Shot. */
	readonly final: {
		readonly bestParams: Readonly<Record<string, string | number | boolean | null>>;
		readonly bestValidationScore: number;
	} | null;
}
```

- The decoder accepts versions 1–3; an invalid `tuning` block is dropped (Phase 6 rule).
- Progress: the Phase 3 normaliser maps tuning-progress events to `stage: 'tuning'` with "Trial {n} of {total}" (One-Shot) or "Outer fold {f} of {K}: trial {n} of {total}" (nested); milestones at each outer fold and at the refit append log entries.

#### C. Components

**`<app-model-configuration>` (Phase 1, extended).** New properties: `fitCount = 0`, `computeAlertThreshold = 500`, `tuningIssues: readonly TuningIssue[] = []`. Events keep their names; `detail.config` now carries tuning fields. Structure: mode `<fieldset>` (Manual / Hyperparameter tuning radios) → per option, in tuning mode, a nested `<fieldset>` with Fixed/Tune radios; Tune shows either a checkbox `<fieldset>` of candidates or min/max `<input type="number">` with a scale `<select>`; union options add a "candidate values / numeric range" radio pair → budget `<fieldset>` (trials, seed) → read-only scoring sentence → fit count `<output>` → compute alert `.notification` when `fitCount ≥ 500`. Labels gain the new strings in `ConfigurationLabels`.

**Results elements (`src/features/results/`, presentational, `labels`, D8 chart pattern).**

| Tag                         | Properties                                                                 | Events                                                                                 | Behaviour                                                                                                                                                                                                            |
| --------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app-tuning-summary`        | `summary: TuningSummaryView \| null`                                       | none                                                                                   | `<dl>`: strategy, trials, seed, scoring, tuned and fixed options, fit count, final best parameters; sentence that validation scores selected the parameters and test/outer scores evaluate them.                     |
| `app-selection-matrix`      | `matrix: SelectionMatrixView \| null`                                      | none                                                                                   | Native table: rows = outer folds (+ "Final search"), columns = tuned options, cells = selected values; a stability sentence per option ("maxDepth = 4 in 3 of 5 folds").                                             |
| `app-trial-table`           | `trials: TrialTableView \| null`, `partitionIndex: number`, `page: number` | `app-trial-page-change` `{ partitionIndex: number; page: number }` (bubbles, composed) | Fold `<select>` (nested only), native table (trial, parameters, status, validation score, training score when present, duration), 50 rows per page with First/Previous/Next/Last buttons and a "Page n of m" status. |
| `app-tuning-curve` (Plot)   | `curve: TuningCurveView \| null`, `option: string \| null`                 | `app-tuning-option-change` `{ option: string }` (bubbles, composed)                    | D10; option `<select>` when several numeric options are tuned.                                                                                                                                                       |
| `app-tuning-scatter` (Plot) | `scatter: TuningScatterView \| null`                                       | none                                                                                   | D10; rendered only when exactly two numeric options are tuned.                                                                                                                                                       |

- `app-model-results` renders a "Tuning" `<section>` after the shared sections and before model internals when `evaluation.tuning` exists; persisted `ModelResultsUi` gains `trialPartition: number`, `trialPage: number`, `tuningOption: string | null`.
- `/models` Configuration column: "Manual" or "Random search · {n} trials · {k} tuned". Phase 5 model labels append "(tuned)".

## Specification changes

- [ ] `specification/workflow-steps.md` §3.3 — Manual vs Hyperparameter tuning, Fixed/Tune editors, validation tiers, budget, fit count, compute alert; §3.5 tuning progress wording; §3.6 Tuning results section; status remains partial.
- [ ] `specification/state-and-storage.md` §3, §6 — `HyperparameterConfig` tuning fields, migration, `StoredEvaluation` version 3, `ModelResultsUi` tuning fields.
- [ ] `specification/machine-learning-orchestrator.md` — One-Shot tuning flow (D1, D3) and nested tuning flow (D2); WR-10/WR-11 usage.
- [ ] `specification/visual-design.md` §2 — `--chart-seq-1…5` and the stroke rule.
- [ ] `specification/components/model-configuration.md` (tuning API), `specification/components/tuning-results.md` (new) & `specification/README.md`.
- [ ] `specification/FUTURE.md` — Hyperband, grid search for ≤ 3 options, threshold tuning, PCA pipeline tuning, conditional search spaces, learner-selected scoring, "tuned copy" action.
- [ ] `specification/TODO.md`, `specification/HUMAN.md` — TODO-04 resolved; HUMAN items for styling the tuning drafts and commissioning plans for the unclaimed UX note sections (§1, §2, §7, §9, §10).
- [ ] Delete `specification/notes/metrics-and-visuals.md` — its rules now live in the Phase 4–7 specs.

## Implementation tasks

### T1 — Tuning state, migration, validation and fit count

- **Depends on:** None
- **Risk:** needs care — persisted shape change with migration; validation is the only guard against invalid `web-ml` requests.
- **Likely files:** `src/types/state.ts`, `src/stores/persister.ts`, `src/stores/app.store.ts`, `src/features/models/tuning-config.ts`, `tests/tuning-config.test.ts`, `tests/state-and-storage.test.ts`
- **Must not touch:** `src/features/models/app-model-configuration.ts`, `src/features/models/training/`
- **Implementation:** Implement Interfaces §A and D6–D8. `setHyperparameters` invalidates downstream steps only on effective change (Phase 1 rule).
- **Acceptance criteria:**
    - [ ] `WML-P7-STATE-1` — Tuning configs round-trip; legacy array search spaces migrate per §A; overlapping fixed/tuned keys are rejected on hydrate.
    - [ ] `WML-P7-STATE-2` — Every D6 issue code has a positive and negative test; `fitCount` returns 21 for One-Shot with 20 trials and (5 + 1) × (5 × 20 + 1) = 606 for five-fold nested CV.
    - [ ] `WML-P7-STATE-3` — `toSearchRequest` yields disjoint `baseOptions` and `searchSpace` in `web-ml` domain shapes for Logistic Regression, SVC (`gamma` range) and Decision Tree (`maxDepth` with `null` candidate).
- **Verification:** `bun test tests/tuning-config.test.ts tests/state-and-storage.test.ts`; `bun run check`.
- **Progress:** [ ] Not started

### T2 — Tuning policy for every classifier option

- **Depends on:** T1
- **Risk:** routine
- **Likely files:** `src/features/models/model-presentation-policy.ts`, `tests/model-options.test.ts`
- **Must not touch:** `src/features/models/app-model-configuration.ts`, `node_modules/`
- **Implementation:** Add `tuning` metadata (D5, D8) for every tunable option of the eight classifiers, citing `web-ml` ranges from `hyperparameters.md`; structured options (custom class weights, hidden layer arrays, priors) are not tunable.
- **Acceptance criteria:**
    - [ ] `WML-P7-POLICY-1` — Every option in every classifier document is either tunable with valid metadata or explicitly not tunable; hard limits never exceed `web-ml`'s documented ranges; every `parent` names an option of the same model.
- **Verification:** `bun test tests/model-options.test.ts`; `bun run check`.
- **Progress:** [ ] Not started

### T3 — Tuning controls in `<app-model-configuration>` and draft 03-4

- **Depends on:** T2
- **Risk:** needs care — nested fieldsets, error association and focus on invalid submit.
- **Likely files:** `src/features/models/app-model-configuration.ts`, `src/features/models/app-model-configuration.stories.ts`, `src/features/models/app-model-builder-view.ts`, `specification/mockups/ui-scaffold/drafts/03-4_train-models-3-configure-model.html`, `tests/model-tuning-configuration.e2e.ts`
- **Must not touch:** `css/root.css`, `src/features/results/`
- **Implementation:** Per Interfaces §C (configuration). The builder computes `fitCount` and `tuningIssues` with T1 helpers and passes them in; Continue is blocked while issues exist and focuses the first invalid control. Section 3's header reads "Hyperparameter Tuning" when complete in tuning mode (`workflow-steps.md` §3.3). Rewrite the draft's "Advanced Random Search" section to this structure. Stories: `TuningLogistic`, `TuningSvcGammaRange`, `CategoricalTooFew`, `ParentTuned`, `ComputeAlert`, `LongLabel`, `RTL`.
- **Acceptance criteria:**
    - [ ] `WML-P7-UI-1` — Switching to tuning shows Fixed/Tune per tunable option; Tune categorical requires two checked candidates; numeric ranges validate per D6 with messages associated via `aria-describedby`; switching back to Manual restores the previous fixed values.
    - [ ] `WML-P7-UI-2` — The fit count updates as trials or folds change; the compute alert appears at 500 and not at 499; tuning a parent disables Tune on its children with the explanation text.
    - [ ] `WML-P7-UI-3` — Keyboard, RTL, long-label, 320 px and 200% zoom checks pass; stories pass axe in three browsers.
- **Verification:** `bun run test:e2e tests/model-tuning-configuration.e2e.ts tests/model-configuration.e2e.ts`; `bun run test:stories`; `bun test tests/style-tokens.test.ts`; `bun run check`.
- **Progress:** [ ] Not started

### T4 — Execute tuned training and persist the tuning record

- **Depends on:** T1
- **Risk:** needs care — depends on WR-7, WR-10, WR-11, WR-13; must keep test rows out of selection and preserve Phase 3 cancellation and locks.
- **Likely files:** `src/types/model-evaluation.ts`, `src/features/results/evaluation-decoder.ts`, `src/features/models/training/training.worker.ts`, `src/features/models/training/classifier-adapters.ts`, `src/features/models/training/tuning-runner.ts`, `src/features/models/training/evaluation-mapper.ts`, `src/features/models/training/progress.ts`, `tests/tuning-runner.test.ts`, `tests/evaluation-decoder.test.ts`, `tests/training-progress.test.ts`, `tests/classification-tuning.e2e.ts`
- **Must not touch:** `src/features/results/app-*.ts`, `node_modules/`
- **Implementation:** Implement D1–D3 and Interfaces §B in `tuning-runner.ts`; map One-Shot and nested results into Phase 4 evaluation plus `tuning`; extend the progress normaliser.
- **Acceptance criteria:**
    - [ ] `WML-P7-RUN-1` — A spy-backed unit test proves test rows (One-Shot) and outer held-out rows (nested) are never in any search's training or validation data.
    - [ ] `WML-P7-RUN-2` — A tuned One-Shot model and a manual One-Shot model on the same dataset share `partitionFingerprint`; likewise tuned and manual five-fold models.
    - [ ] `WML-P7-RUN-3` — Real tuned training (iris KNN tuning `nNeighbors` 1–30, five folds, 10 trials; breast-cancer SVC tuning C and γ One-Shot) completes in three browsers, decodes as version 3, and cancellation mid-search writes no envelope.
- **Verification:** `bun test tests/tuning-runner.test.ts tests/evaluation-decoder.test.ts tests/training-progress.test.ts`; `bun run test:e2e tests/classification-tuning.e2e.ts`; `bun run check`; `bun run build`.
- **Progress:** [ ] Not started

### T5 — Tuning results elements and sequential tokens

- **Depends on:** T4
- **Risk:** routine
- **Likely files:** `css/root.css`, `tests/chart-tokens.test.ts`, `src/features/results/tuning-view-model.ts`, `src/features/results/app-tuning-summary.ts`, `src/features/results/app-tuning-summary.stories.ts`, `src/features/results/app-selection-matrix.ts`, `src/features/results/app-selection-matrix.stories.ts`, `src/features/results/app-trial-table.ts`, `src/features/results/app-trial-table.stories.ts`, `src/features/results/app-tuning-curve.ts`, `src/features/results/app-tuning-curve.stories.ts`, `src/features/results/app-tuning-scatter.ts`, `src/features/results/app-tuning-scatter.stories.ts`, `tests/tuning-view-model.test.ts`, `tests/tuning-results.e2e.ts`
- **Must not touch:** `src/stores/`, `src/features/models/`
- **Implementation:** Per Interfaces §C (results), D10–D11.
- **Acceptance criteria:**
    - [ ] `WML-P7-UI-4` — The selection matrix shows one row per outer fold plus "Final search" (nested) and the stability sentence per option; One-Shot shows one row.
    - [ ] `WML-P7-UI-5` — The trial table pages 50 rows with correct "Page n of m" text and disabled boundary buttons; failed trials show "Unavailable" scores and their status.
    - [ ] `WML-P7-UI-6` — The curve uses a log axis for log-uniform options, rings each fold's best trial and shows training scores only when present; the scatter renders only with exactly two numeric tuned options and its table lists every trial.
- **Verification:** `bun test tests/tuning-view-model.test.ts tests/chart-tokens.test.ts tests/style-tokens.test.ts`; `bun run test:e2e tests/tuning-results.e2e.ts`; `bun run test:stories`; `bun run check`.
- **Progress:** [ ] Not started

### T6 — Wire the Tuning section, overview labels and comparison labels

- **Depends on:** T3, T5
- **Risk:** needs care — touches Phase 4/5 connected elements and the models overview.
- **Likely files:** `src/features/results/app-model-results.ts`, `src/features/results/app-model-results.stories.ts`, `src/features/results/comparison-model.ts`, `src/features/models/app-models-view.ts`, `src/types/state.ts`, `src/stores/app.store.ts`, `src/stores/persister.ts`, `specification/mockups/ui-scaffold/drafts/03-7_train-models-5-results.html`, `tests/classification-tuning.e2e.ts`, `tests/models-overview.e2e.ts`, `tests/comparison-model.test.ts`, `tests/a11y.e2e.ts`
- **Must not touch:** `css/root.css`, `src/app.ts`
- **Implementation:** Per Interfaces §C last bullets. Add a Tuning section to the 03-7 draft (replacing the removed Random Search sample).
- **Acceptance criteria:**
    - [ ] `WML-P7-UI-7` — A tuned model's Section 6 shows Tuning between the shared sections and model internals; trial fold, page and curve option survive reload.
    - [ ] `WML-P7-UI-8` — `/models` shows "Random search · 20 trials · 2 tuned"; `/results` labels the tuned model "(tuned)" and compares it with a manual model on the same rows.
    - [ ] `WML-P7-UI-9` — `tests/a11y.e2e.ts` scans a tuned Section 6 and the tuning configuration form with no new findings.
- **Verification:** `bun run test:e2e tests/classification-tuning.e2e.ts tests/models-overview.e2e.ts tests/a11y.e2e.ts`; `bun test tests/comparison-model.test.ts`; `bun run test:stories`; `bun run check`; `bun run build`.
- **Progress:** [ ] Not started

### T7 — Sync specifications for Phase 7

- **Depends on:** T1, T2, T3, T4, T5, T6
- **Risk:** routine
- **Likely files:** `specification/workflow-steps.md`, `specification/state-and-storage.md`, `specification/machine-learning-orchestrator.md`, `specification/visual-design.md`, `specification/components/model-configuration.md`, `specification/components/tuning-results.md`, `specification/README.md`, `specification/FUTURE.md`, `specification/TODO.md`, `specification/HUMAN.md`, `specification/notes/metrics-and-visuals.md`, `specification/plans/README.md`, `specification/plans/web-ml-phase-7-hyperparameter-tuning.md`
- **Must not touch:** `src/`, `tests/`, `specification/mockups/`, `specification/notes/user-experience-decisions.md` — sections §1, §2, §7, §9, §10 are unclaimed.
- **Implementation:** Apply every item under _Specification changes_, including deleting the metrics note once Phases 4–6 specs contain its rules.
- **Acceptance criteria:**
    - [ ] Every item under _Specification changes_ is applied and ticked.
    - [ ] `bun run plans:check` and `bun run plans:task specification/plans/web-ml-phase-7-hyperparameter-tuning.md --check-complete` pass.
- **Verification:** `bun run plans:check specification/plans/web-ml-phase-7-hyperparameter-tuning.md`; `bun run plans:task specification/plans/web-ml-phase-7-hyperparameter-tuning.md --check-complete`; `bun run check`.
- **Progress:** [ ] Not started

## Verification and definition of done

- [ ] All acceptance criteria met with test names starting with `WML-P7-*`.
- [ ] `bun run check`, `bun run build`, `bun run test:stories` and `bun run test:e2e tests/classification-tuning.e2e.ts` pass in three browsers with no new failures.
- [ ] Leakage review: no test or outer held-out row reaches any search (WML-P7-RUN-1).
- [ ] Manual checks recorded: screen-reader pass through the tuning form; keyboard-only trial paging; forced colours; 200% zoom.
- [ ] `bun run format` run on changed files; every _Specification changes_ item ticked.

## Risks and open questions

- **Blocking:** Phases 1, 3, 4, 5 and 6 must be `ready`, and `web-ml` must publish WR-7, WR-10, WR-11 and WR-13 (umbrella ledger). Then re-scout, pin the `createTuner().search()` pipeline argument, the balanced-accuracy scorer name and the nested refit contract in T4, and submit for review.
- **Non-blocking:** Nested tuning cost grows as K² × trials (606 fits for five folds and 20 trials). The compute alert (D7) informs learners; TODO-45's performance budget may later cap `nTrials × K²`. Owner: human.
- **Non-blocking:** Tuning drafts (03-4 tuning section, 03-7 Tuning section) await human styling (`specification/HUMAN.md`).

## Escalations

None.

## Review fixes

None.

## Implementation and verification log

| When (UTC)           | Task | Agent (model)                            | Outcome / commands / evidence                                                                                                                                                                                                         |
| -------------------- | ---- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-17T21:23:45Z | —    | Google Antigravity (Gemini 4 Argon High) | Stub created as Phase 5.                                                                                                                                                                                                              |
| 2026-11-19T08:47:35Z | —    | Claude Code (claude-opus-5-5)            | Planning: read public `TuningClient.d.ts` (holdout and fold-aware `createTuner().search()`), `types.d.ts` L185–484 and `hyperparameters.md` L25–60; confirmed no balanced-accuracy scorer or trial training scores in `web-ml@0.1.0`. |

## Plan review history

| Reviewed (UTC) | Agent (model) | Decision | Findings |
| -------------- | ------------- | -------- | -------- |

## Change log

| When (UTC)           | Change                                | Reason                                                                                                                                                                                                                                                                                                       |
| -------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-11-17T21:23:45Z | Initial stub (as Phase 5)             | Split from the monolithic integration plan.                                                                                                                                                                                                                                                                  |
| 2026-11-19T08:47:35Z | Renumbered to Phase 7; expanded draft | User inserted Phases 5 (comparison) and 6 (model-specific) before tuning; `web-ml` owns folds and scoring (2026-11-19). Resolved the stub's questions: 60/20/20 One-Shot split (D1), public `createTuner` typing instead of a `train` overload. File renamed from `web-ml-phase-5-hyperparameter-tuning.md`. |
