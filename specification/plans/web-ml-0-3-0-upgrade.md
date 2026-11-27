# Complete the web-ml 0.3.0 upgrade

**Status:** ready-for-review | **Updated:** 2026-11-27T16:03:45Z
**Authors:** Codex (GPT-6) | **Created:** 2026-11-27T16:02:18Z
**Verified by:** — | **Verified:** — | **Verification:** pending
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour:** The frozen Bun lockfile installs `web-ml` 0.3.0 from the verified vendored tarball. The build and CI still pin 0.2.0, and the build rejects the installed package manifest.

**Target behaviour:** The development server starts and serves the app and the verified 0.3.0 browser runtime over HTTPS. The production build and CI verify the same release.

**Why:** The application needs a reproducible local and CI build from the release already selected by the maintainer.

## Scope

**In scope**

- Complete the release refresh in the runtime pins, catalogue presentation policy, CI, existing tests and contributor instructions.

**Out of scope**

- New controls, computation, features, dependency upgrades or changes to the dependency selections already in the Bun lockfile.

**Constraints and invariants**

- Derive release, manifest, public and runtime hashes from the checksum-verified tarball. Keep the pre-publish integrity checks and same-origin runtime URL format.
- Keep the existing integer decision-tree sample controls and leave the added options to upstream defaults. Continue to reject unsupported values using the existing policy.

## Required reading

- `README.md` §Upgrade web-ml and `specification/ARCHITECTURE.md` §Delivery and Caching.

## Codebase context

- **Relevant implementation:** `scripts/build-model-assets.ts` pins the package, contract and runtime. `src/features/models/model-presentation-policy.ts` explicitly accounts for every consumed model option. The verified release ships the same 20 runtime files and adds four decision-tree options.
- **Tests and commands:** `tests/model-assets.test.ts` checks the release and rejects tampering, `tests/model-options.test.ts` checks catalogue policy coverage, `tests/ci-workflow.test.ts` checks CI, and the training and analysis E2E tests exercise the browser runtime.
- **Web guidance:** None. The release uses the existing browser loading and worker paths.
- **Visual reference:** None. Existing controls retain their appearance and behaviour.
- **Domain skills:** None. No Lit component changes are needed.
- **Assumptions requiring verification:** None.

## Technical decisions

| Decision          | Chosen approach and rationale                                                                                                                                      | Rejected alternative / trade-off                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Release integrity | Refresh the existing versioned pins from the supplied tarball and retain the verification pipeline.                                                                | Deriving pins dynamically from the installed package would weaken verification.           |
| Catalogue policy  | Mark `categoricalFeatures`, `ccpAlpha`, `maxLeafNodes` and `classWeight` hidden for the decision tree, following the existing convention for new upstream options. | Exposing fractional sample options or new controls would change the training setup scope. |

### Interfaces and behaviour

The runtime module URL remains `/web-ml/{version}-{graph-digest}/index.js`. Newly recorded model revisions use the verified 0.3.0 tarball SHA-256. The decision-tree policy omits the four new options from overrides and training requests, including if such values appear in previously persisted input. Exclude the same options from the decision-tree configuration key to preserve earlier saved results.

## Specification changes

- [ ] `specification/machine-learning-orchestrator.md` §3 — document the decision-tree library defaults excluded from the saved configuration key. Status remains implemented.

## Implementation tasks

### T1 — Pin and verify the complete 0.3.0 integration

- **Depends on:** None
- **Risk:** needs care — stale release pins stop local and production builds.
- **Likely files:** `scripts/build-model-assets.ts`, `src/features/models/model-presentation-policy.ts`, `src/features/models/training/training-service.ts`, `tests/model-options.test.ts`, `tests/model-documents.test.ts`, `tests/training-service.test.ts`, `tests/model-assets.test.ts`, `tests/training-runtime.e2e.ts`, `tests/analysis-worker.e2e.ts`, `.github/workflows/ci.yml`, `tests/ci-workflow.test.ts`, `README.md`, `specification/machine-learning-orchestrator.md`, `vendor/web-ml/web-ml-0.2.0.tgz`, `vendor/web-ml/web-ml-0.2.0.tgz.sha256`
- **Must not touch:** `package.json`, `bun.lock`, `specification/mockups/`
- **Implementation:** Refresh release and asset integrity expectations from 0.3.0. Pin the public tree declaration barrel and option types, and the public hyperparameter prose. Preserve the existing emitted 20-file graph. Refresh the release-specific CI and test expectations, including the narrowed integer-or-null `maxDepth` catalogue test. Explicitly hide the four added options and exclude them from the decision-tree configuration key, extending the existing hidden-option and saved-result tests. Remove the old tarball and checksum and bring the contributor guide into line with CI and runtime verification.
- **Acceptance criteria:**
  - [ ] A frozen install selects 0.3.0. The vendored checksum and CI agree, and only the 0.3.0 release remains in `vendor/web-ml/`.
  - [ ] The build emits the verified 0.3.0 runtime URL and still rejects tampered or stale inputs. Existing tree controls retain their integer policy, added options are omitted from saved overrides and requests, and earlier decision-tree results restore with their existing key.
  - [ ] `bun run server` starts from this checkout. Its HTTPS app route and the module at the emitted 0.3.0 runtime URL respond successfully. The production build and relevant runtime browser tests are checked.
- **Verification:** `bun run check`, `bun run lint`, `bun run build`, `bun run server`, `bun run test:e2e tests/training-runtime.e2e.ts tests/classification-training.e2e.ts tests/analysis-worker.e2e.ts`.
- **Progress:** [ ] Not started

## Verification and definition of done

- [ ] Task acceptance criteria are met and verification outcomes are recorded.
- [ ] Specifications match the completed work and there are no changes outside the task scope.

## Risks and open questions

- **Blocking:** None
- **Non-blocking:** None.

## Escalations

None.

## Review fixes

None.

## Implementation and verification log

| When (UTC) | Task | Agent (model) | Outcome / commands / evidence |
| ---------- | ---- | ------------- | ----------------------------- |
| —          | —    | —             | Not started                   |

## Plan review history

| Reviewed (UTC) | Agent (model) | Decision | Findings |
| -------------- | ------------- | -------- | -------- |

## Change log

| When (UTC)           | Change        | Reason                                                                                                    |
| -------------------- | ------------- | --------------------------------------------------------------------------------------------------------- |
| 2026-11-27T16:02:18Z | Initial draft | The maintainer requested that the partial 0.3.0 upgrade be completed and the development server verified. |
