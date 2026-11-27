# Complete the web-ml 0.3.0 upgrade

**Status:** ready | **Updated:** 2026-11-27T16:17:29Z
**Authors:** Codex (GPT-6) | **Created:** 2026-11-27T16:02:18Z
**Verified by:** Codex (GPT-6) | **Verified:** 2026-11-27T16:14:49Z | **Verification:** approved
**Verified hash:** sha256:c8906660f46663442d2d5c33f1cddd2fe831c83f9899caebc5daa521dc316420
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour:** The frozen Bun lockfile installs `web-ml` 0.3.0 from the verified vendored tarball. The original upgrade left the build and CI pinned to 0.2.0, so the build rejected the installed package manifest. The release pins now allow the server to start. Browser tests expose a further mismatch because the app rejects 0.3.0’s serialised preprocessor V2 state.

**Target behaviour:** The development server starts and serves the app and the verified 0.3.0 browser runtime over HTTPS. The production build and CI verify the same release. Classification results from 0.3.0 are validated, recorded and restored alongside existing results.

**Why:** The application needs a reproducible local and CI build from the release already selected by the maintainer.

## Scope

**In scope**

- Complete the release refresh in the runtime pins, catalogue presentation policy, stored-result validation, CI, existing tests and contributor instructions.

**Out of scope**

- New controls, computation, features, dependency upgrades or changes to the dependency selections already in the Bun lockfile.

**Constraints and invariants**

- Derive release, manifest, public and runtime hashes from the checksum-verified tarball. Keep the pre-publish integrity checks and same-origin runtime URL format.
- Keep the existing integer decision-tree sample controls and leave the added options to upstream defaults. Continue to reject unsupported values using the existing policy.
- Keep the app result envelope and worker message shapes, and accept V1 and V2 preprocessor snapshots without conversion. `web-ml` owns fitted preprocessing.

## Required reading

- `README.md` §Upgrade web-ml and `specification/ARCHITECTURE.md` §Delivery and Caching.

## Codebase context

- **Relevant implementation:** `scripts/build-model-assets.ts` pins the package, contract and runtime. `src/features/models/model-presentation-policy.ts` explicitly accounts for every consumed model option. The verified release ships the same 20 runtime files and adds four decision-tree options.
- **Public contract:** In installed `web-ml` 0.3.0, `dist/src/training/tabular-preprocessing.d.ts` and `specification/public-api/tabular-preprocessing.md` define both fitted state versions. `toJSON()` emits V2, which has per-column imputation, scaling and encoding metadata. `src/features/models/training/result-validation.ts` currently checks only V1.
- **Tests and commands:** `tests/model-assets.test.ts` checks the release and rejects tampering, `tests/model-options.test.ts` checks catalogue policy coverage, `tests/ci-workflow.test.ts` checks CI, and the training and analysis E2E tests exercise the browser runtime.
- **Web guidance:** None. The release uses the existing browser loading and worker paths.
- **Visual reference:** None. Existing controls retain their appearance and behaviour.
- **Domain skills:** None. No Lit component changes are needed.
- **Assumptions requiring verification:** None.

## Technical decisions

| Decision                  | Chosen approach and rationale                                                                                                                                      | Rejected alternative / trade-off                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Release integrity         | Refresh the existing versioned pins from the supplied tarball and retain the verification pipeline.                                                                | Deriving pins dynamically from the installed package would weaken verification.                                                                    |
| Catalogue policy          | Mark `categoricalFeatures`, `ccpAlpha`, `maxLeafNodes` and `classWeight` hidden for the decision tree, following the existing convention for new upstream options. | Exposing fractional sample options or new controls would change the training setup scope.                                                          |
| Fitted preprocessor state | Branch validation on the state’s own version and preserve the release’s serialised state as supplied.                                                              | Converting V2 to V1 could discard fitted metadata. Loading the runtime in synchronous storage validation would cross the existing worker boundary. |

### Interfaces and behaviour

The runtime module URL remains `/web-ml/{version}-{graph-digest}/index.js`. Newly recorded model revisions use the verified 0.3.0 tarball SHA-256. The decision-tree policy omits the four new options from overrides and training requests, including if such values appear in previously persisted input. Exclude the same options from the decision-tree configuration key to preserve earlier saved results.

The shared training-result validator preserves the V1 `standardize`, column name, numeric and categorical checks. For V2, require a nonempty set of uniquely named numeric or categorical columns, the column kinds Samata sends. Require a boolean `missingIndicator`, the imputation strategy and value for its kind, a supported scaling kind, a finite offset and a positive finite scale. Scaling `none` uses offset 0 and scale 1. One-hot state has unique, disjoint known and infrequent label lists that together include the imputation value, with unknown handling `ignore` or `error`. Ordinal state has a unique ordered label list containing the imputation value, a finite unknown value or null, and the same scaling rules. Preserve both label orders as supplied. The library enforces canonical category order and any additional invariants when it deserialises its own state. Reject unsupported snapshot versions and column kinds, including datetime. The app’s training request retains its current encoding and scaling policy.

## Specification changes

- [x] `specification/machine-learning-orchestrator.md` §3 — document the decision-tree library defaults excluded from the saved configuration key. Status remains implemented.
- [x] `specification/machine-learning-orchestrator.md` §4 — state that preprocessor snapshot versions 1 and 2 are validated independently of the envelope version. Status remains implemented.

## Implementation tasks

### T1 — Pin and verify the complete 0.3.0 integration

- **Depends on:** None
- **Risk:** needs care — stale release pins stop local and production builds.
- **Likely files:** `scripts/build-model-assets.ts`, `src/features/models/model-presentation-policy.ts`, `src/features/models/training/training-service.ts`, `src/features/models/training/result-validation.ts`, `tests/model-results.test.ts`, `tests/model-options.test.ts`, `tests/model-documents.test.ts`, `tests/training-service.test.ts`, `tests/model-assets.test.ts`, `tests/training-runtime.e2e.ts`, `tests/classification-training.e2e.ts`, `tests/analysis-worker.e2e.ts`, `.github/workflows/ci.yml`, `tests/ci-workflow.test.ts`, `README.md`, `specification/machine-learning-orchestrator.md`, `vendor/web-ml/web-ml-0.2.0.tgz`, `vendor/web-ml/web-ml-0.2.0.tgz.sha256`
- **Must not touch:** `package.json`, `bun.lock`, `specification/mockups/`
- **Implementation:** Refresh release and asset integrity expectations from 0.3.0. Pin the public tree declaration barrel and option types, and the public hyperparameter prose. Preserve the existing emitted 20-file graph. Refresh the release-specific CI and test expectations, including the narrowed integer-or-null `maxDepth` catalogue test. Explicitly hide the four added options and exclude them from the decision-tree configuration key, extending the existing hidden-option and saved-result tests. Remove the old tarball and checksum and bring the contributor guide into line with CI and runtime verification.
- **Result validation:** Extend `hasPreprocessor` for V2 and keep V1 fixtures and behaviour. Extend `tests/model-results.test.ts` with an IndexedDB round trip for a V2 state and representative rejection checks. Verify a real worker returns V2 state in the existing classification suite.
- **Acceptance criteria:**
  - [x] A frozen install selects 0.3.0. The vendored checksum and CI agree, and only the 0.3.0 release remains in `vendor/web-ml/`.
  - [x] The build emits the verified 0.3.0 runtime URL and still rejects tampered or stale inputs. Existing tree controls retain their integer policy, added options are omitted from saved overrides and requests, and earlier decision-tree results restore with their existing key.
  - [x] V1 and supported V2 fitted preprocessor states load unchanged. The shared guard rejects malformed V2 fields and unsupported column kinds. The 0.3.0 app worker completes and publishes One-Shot and fixed cross-validation results across the existing classifier suite.
  - [x] `bun run server` starts from this checkout. Its HTTPS app route and the module at the emitted 0.3.0 runtime URL respond successfully. The production build and relevant runtime browser tests are checked.
- **Verification:** `bun run check`, `bun run lint`, `bun run build`, `bun run server`, `bun run test:e2e tests/training-runtime.e2e.ts tests/classification-training.e2e.ts tests/analysis-worker.e2e.ts`.
- **Progress:** [x] Completed (2026-11-27T16:17:29Z)

## Verification and definition of done

- [x] Task acceptance criteria are met and verification outcomes are recorded.
- [x] Specifications match the completed work and there are no changes outside the task scope.

## Risks and open questions

- **Blocking:** None
- **Non-blocking:** None.

## Escalations

None.

## Review fixes

None.

## Implementation and verification log

| When (UTC)           | Task | Agent (model) | Outcome / commands / evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------- | ---- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| —                    | —    | —             | Not started                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-11-27T16:17:29Z | T1   | Codex (GPT-6) | The frozen Bun install and `shasum -a 256 -c web-ml-0.3.0.tgz.sha256` succeeded and only the 0.3.0 pair remains. `bun run check`: 742 passed, 0 failed. `bun run lint` and `bun run build` passed. `bun run test:e2e tests/training-runtime.e2e.ts tests/classification-training.e2e.ts tests/analysis-worker.e2e.ts --workers=3`: 43 passed, 26 intended skips, 0 failed. `bun run server` started at https://localhost:20783/; verified `/__checkout` identifies this worktree and both `/` and the 0.3.0 runtime module returned HTTP 200 over HTTPS using the local certificate. The result validator accepts the numeric and categorical 0.3.0 fitted state (V2) and retains V1 compatibility. Scoped initial integration checkpoint: 8f4333b. |

## Plan review history

| Reviewed (UTC)       | Agent (model) | Decision          | Findings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------- | ------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-27T16:05:40Z | Codex (GPT-6) | approved          | Verified the shipped 0.3.0 catalogue, tree declarations and public prose, the unchanged 0.2.0 tree defaults, the hidden-option and saved-key flow, release integrity coverage and checkout-specific HTTPS and browser verification. No blocking findings.                                                                                                                                                                                                                                                                                             |
| 2026-11-27T16:13:45Z | Codex (GPT-6) | changes-requested | MAJOR: Interfaces and T1 promise valid V2 snapshots and reject malformed ones, but leave datetime support undefined and omit public fitted-state invariants for app-emitted numeric/categorical columns. Scope V2 to app-emitted column kinds or specify the additional branch. Cite released tabular-preprocessing.md and include unique names, no-op scaling offset 0 and scale 1, and categorical ordering, distinctness, disjointness and imputation membership as applicable. Use representative rejection tests for these contract constraints. |
| 2026-11-27T16:14:49Z | Codex (GPT-6) | approved          | Reviewed the revised V2 validation against scout-verified installed and vendored 0.3.0 public declarations and prose. The plan defines Samata-supported numeric and categorical columns, rejects unsupported kinds, preserves V1 and label order, states scaling and label membership constraints, and leaves upstream canonical ordering to web-ml. Shared result validation, an IndexedDB round trip and real-worker browser tests cover the amended behaviour. No blocking findings.                                                               |

## Change log

| When (UTC)           | Change               | Reason                                                                                                                              |
| -------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-27T16:02:18Z | Initial draft        | The maintainer requested that the partial 0.3.0 upgrade be completed and the development server verified.                           |
| 2026-11-27T16:10:59Z | Invalidated approval | Browser verification exposed the 0.3.0 serialised preprocessor V2 contract. Preserve V1 results and validate V2 before publication. |
