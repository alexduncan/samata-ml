# Vendor packed semver `web-ml` release tarball

**Status:** draft | **Updated:** 2026-11-21T15:06:37Z
**Authors:** Google Antigravity (Gemini 4 Neon High) | **Created:** 2026-11-21T15:06:37Z
**Verified by:** — | **Verified:** — | **Verification:** pending
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —

The maintainer supplied the 0.2.0 release and directed the migration using the
tarball and checksum under `vendor/web-ml/`. This draft records the original
proposal. The [contributor instructions](../../README.md#upgrade-web-ml) and
[training asset specification](../ARCHITECTURE.md#delivery-and-caching) describe
the shipped layout.

## Goal

**Current behaviour:** `package.json` (L67) declares `"web-ml": "file:../web-ml"`, which binds installation to an unversioned sibling checkout and causes `bun.lock` (L14, L904, L970) to omit a tarball integrity hash and pull in upstream `devDependencies` (such as `web-ml/prettier`). `scripts/build-model-assets.ts` (L109–115) hard-requires a `../web-ml` sibling directory via `stat(path.resolve(appDir, '../web-ml'))` before reading and hashing `node_modules/web-ml`, and its `setupError` message (L79–86) instructs contributors to place `samata-ml` beside a matching `../web-ml` checkout. `tests/model-assets.test.ts` (L55–60, L67) asserts that missing sibling check and creates a dummy sibling directory for manifest tests. `AGENTS.md`, `README.md`, `specification/ARCHITECTURE.md` and `specification/machine-learning-orchestrator.md` describe or assume the sibling `../web-ml` layout.

**Target behaviour:** `samata-ml` commits a single packed semver `web-ml` release tarball at `vendor/web-ml-<version>.tgz` (allowlisted beneath `*.tgz` in `.gitignore`) and installs it via `"web-ml": "file:./vendor/web-ml-<version>.tgz"` with a locked `bun.lock`. `scripts/build-model-assets.ts` drops the `../web-ml` sibling directory check while preserving full SHA-256 verification of `node_modules/web-ml` (`package.json`, public declarations/prose/catalogue digest, and every runtime JS/WASM/notice file) and emits actionable setup errors pointing to the vendored tarball and `bun install --frozen-lockfile --ignore-scripts`. `samata-ml` installs, type-checks, tests and builds cleanly in standalone clones, git worktrees and CI without a sibling `../web-ml` directory. Agent and project documentation clearly state that `samata-ml` consumes the vendored tarball rather than live `../web-ml`.

**Why:** Eliminates brittle coupling to a mutable sibling `../web-ml` working tree, makes standalone clones and isolated worktrees reproducible with a single locked Bun install, stops leaking upstream `devDependencies` into `bun.lock`, and establishes an explicit semver upgrade boundary between `web-ml` and `samata-ml`.

## Scope

**In scope**

- Allowlisting `vendor/web-ml-*.tgz` beneath `*.tgz` in `.gitignore` and committing the shipped packed semver tarball under `vendor/`.
- Updating `package.json` (`dependencies["web-ml"]`) to `file:./vendor/web-ml-<version>.tgz` and regenerating `bun.lock` via Bun (`bun install` verified by `bun install --frozen-lockfile --ignore-scripts`).
- Removing the hard `../web-ml` sibling directory requirement from `scripts/build-model-assets.ts` while preserving full SHA-256 verification of `node_modules/web-ml` (`package.json`, `publicFiles` + `publicDigest`, and `runtimeHashes`), updating pinned version/revision/hashes to the shipped tarball, and updating `setupError` remediation text.
- Updating `tests/model-assets.test.ts` to verify standalone operation without `../web-ml` alongside all missing/mismatched manifest, public-digest and runtime-hash failure cases (and updating `tests/training-runtime.e2e.ts` L50 if the shipped semver differs from `0.1.0`).
- Updating `AGENTS.md`, `README.md`, `specification/ARCHITECTURE.md`, `specification/machine-learning-orchestrator.md`, `specification/README.md` and `specification/HUMAN.md` so agents and contributors know `samata-ml` consumes the vendored tarball rather than live `../web-ml`.

**Out of scope**

- Modifying `../web-ml` build tooling, packaging scripts, or release publication (owned upstream; requested in `../../../web-ml/specification/requests/2026-11-21-semver-package-tarball-releases.md`).
- Publishing `web-ml` to a public or private npm registry.
- Changing browser runtime loading (`src/features/models/training/training.worker.ts`), model catalogue imports (`src/features/models/model-catalogue.ts`), IndexedDB result schemas, or COOP/COEP headers (`public/_headers`).
- Adding GitHub Actions / CI workflow files (remains in `specification/ARCHITECTURE.md` §Future Improvements) or renaming the legacy `# web-ml` title in `README.md` (Known gap 10).
- Adopting new `web-ml` ML features or Phase 4–7 APIs (handled in their respective phase plans).

**Constraints and invariants**

- **Repository boundary:** Never edit any file in `../web-ml` (the upstream packaging request was already filed separately) and never inspect private upstream files (`../web-ml/src/**`, `../web-ml/specification/internals/**`, or installed private equivalents).
- **Zero weakened integrity guarantees:** `scripts/build-model-assets.ts` must continue to verify SHA-256 hashes of `node_modules/web-ml/package.json`, the full public surface (`publicFiles` + `package.json` → `publicDigest`), and every emitted runtime/WASM/notice file (`runtimeHashes`) before writing any file into `outDir`. On any failure, `outDir` must not receive partial output.
- **Same-origin runtime delivery preserved:** Output path format remains `/web-ml/${webMlVersion}-${graphDigest}/index.js` with `dist/` stripped, relative worker/WASM paths intact, zero `.ts`/`.d.ts` files emitted, and `WEB_ML_REVISION` still exported for `scripts/build-assets.ts` (`WEB_ML_RUNTIME_REVISION`).
- **Single committed tarball:** Only one `vendor/web-ml-<version>.tgz` file lives in `vendor/` at a time; future upgrades replace the previous tarball in the same commit.
- **Bun only & formatting:** Use `bun install` / `bun run` / `bun test` (never `npm`, `yarn`, `pnpm`, or `npx`). Keep `bun.lock` updated only via Bun commands. Maintain British English in prose and docs, TSDoc on exported TypeScript, and Prettier formatting (`bun run format`).

## Required reading

- `AGENTS.md` §Repository boundary, §Upstream Library Specs, §Verification Commands, §Rules — authoritative cross-repo rules, commands and lockfile policy.
- `specification/ARCHITECTURE.md` §Directory Structure and §Delivery and Caching (`Training assets.`) — current sibling-closure rule being replaced.
- `specification/machine-learning-orchestrator.md` §1 (`Runtime boundary`) — runtime asset verification rule that links to `ARCHITECTURE.md`.
- `specification/README.md` §Writing specs and §Specs — spec sync rules and status table alignment.

## Codebase context

Facts verified by `codebase-scout`, so downstream agents need not re-sweep the tree.

- **Relevant specifications:** `specification/ARCHITECTURE.md` (status `partial`, L50 mandates sibling `../web-ml` closure check; L20–40 directory map lacks `/vendor/`); `specification/machine-learning-orchestrator.md` (status `implemented`, L7 cites frozen local dependency and Phase 3 revision/hashes); `specification/README.md` (L35, L43 index rows); `specification/TODO.md` (L109 `TODO-51` notes pinned prebuilt `web-ml` via frozen Bun install). `specification/decision-checklist.md` does not exist.
- **Relevant implementation:**
    - `package.json` L67: `"web-ml": "file:../web-ml"`.
    - `bun.lock` L14, L904, L970: `file:../web-ml` has no tarball integrity hash and pulls in upstream `devDependencies` (`web-ml/prettier`, etc.).
    - `.gitignore` L8: global `*.tgz` currently ignores all tarballs repo-wide; no `vendor/` ignore rule exists.
    - `scripts/build-model-assets.ts` L1–157: exports `WEB_ML_REVISION` (L8) and `buildModelAssets(outDir: string, appDir = ROOT_DIR): Promise<string>` (L108–157). L6 pins `webMlVersion = '0.1.0'`; L12–47 pin 19 `runtimeHashes`; L49–77 pin 25 `publicFiles` and `publicDigest`; L119 pins `package.json` SHA-256. L109–115 hard-require `../web-ml` via `stat(path.resolve(appDir, '../web-ml'))`. L79–86 `setupError` instructs placing `samata-ml` beside `../web-ml`.
    - `scripts/build-assets.ts` L5, L59–64, L108, L137: calls `buildModelAssets(DEV_DIR | DIST_DIR)`, marks `modelRuntimeUrl` external in `Bun.build`, and injects `WEB_ML_RUNTIME_URL` and `WEB_ML_RUNTIME_REVISION` (`WEB_ML_REVISION`).
    - `src/features/models/model-catalogue.ts` L1–92: imports types from `'web-ml'` and static JSON via package `exports` subpaths (`web-ml/model-specifications`, `web-ml/model-specifications/<id>`); no dependency on `build-model-assets.ts`.
    - `src/features/models/training/training.worker.ts` L1–10 & `training-worker.ts` L41–140: dynamically imports `WEB_ML_RUNTIME_URL` and persists `WEB_ML_RUNTIME_REVISION` as `webMlRevision` (validated as a non-empty string in `src/features/models/training/result-validation.ts` L315).
    - `README.md` L14–18 (`## Install Dependencies`) & L44–68 (`## Build System Overview`): omits `web-ml` installation notes and `scripts/build-model-assets.ts`.
    - `AGENTS.md` L3–17, L71: describes `../web-ml` as primary spec/model-catalogue lookup and installed `node_modules/web-ml` as fallback.
    - `scripts/server.ts` L293 watches only `SRC_DIR`, `CSS_DIR`, `PUBLIC_DIR`, `CONTENT_DIR` (unaffected by `vendor/`). `tests/repository-conventions.test.ts` L65 scans only `['src', 'tests', 'scripts', 'css']` (unaffected by `vendor/`).
- **Tests and commands:**
    - `tests/model-assets.test.ts` L1–91: four tests (`WML-P3-ASSET-1`); L55–60 tests missing `../web-ml` sibling error; L67 creates a dummy sibling `web-ml` directory to reach the `node_modules/web-ml` manifest check.
    - `tests/training-runtime.e2e.ts` L50: asserts `reply.runtimeUrl` matches `/^\/web-ml\/0\.1\.0-[0-9a-f]{64}\/index\.js$/`.
    - Unit tests importing `'web-ml'` directly: `tests/classification-preparation.test.ts`, `tests/classifier-adapters.test.ts`, `tests/training-protocol.test.ts`.
    - Verification commands from `AGENTS.md`: `bun run check`, `bun test <path>`, `bun run typecheck`, `bun run build`, `bun run format <files>`, `bun run format:check`, `bun run test:e2e [file]`, `bun run plans:check`. Baseline not run during planning; record baseline before T1.
- **Web guidance:** None — build tooling, dependency management and documentation change only; no browser platform APIs or UI changes.
- **Visual reference:** None — no user-facing UI changes.
- **Domain skills:** None — no Lit components, dataset curation or browser platform API changes.
- **Assumptions requiring verification:** Exact shipped tarball filename (`vendor/web-ml-<version>.tgz`), semver `webMlVersion`, provenance `WEB_ML_REVISION`, `package.json` SHA-256, `publicFiles` list and `publicDigest`, `runtimeHashes` map, and resulting `graphDigest` depend on the upstream tarball release request (`../../../web-ml/specification/requests/2026-11-21-semver-package-tarball-releases.md`). All must be rescouted from the shipped tarball before transitioning this plan to `ready-for-review`.

## Technical decisions

| Decision                                                                                    | Chosen approach and rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Rejected alternative / trade-off                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1 Vendored tarball location & specifier                                                    | Commit the packed semver tarball inside `vendor/web-ml-<version>.tgz` and reference it in `package.json` as `"web-ml": "file:./vendor/web-ml-<version>.tgz"`. Keeps `samata-ml` 100% self-contained for standalone clones, worktrees, offline installs and CI without requiring a registry or sibling checkout (maintainer decision 2026-11-21).                                                                                                                                                                                          | Keep `file:../web-ml` (breaks worktrees/CI and leaks upstream `devDependencies` into `bun.lock`). Publish to npm / private registry (adds external auth/network infrastructure not yet needed).  |
| D2 `.gitignore` allowlist policy                                                            | Retain global `*.tgz` on `.gitignore` L8 to keep accidental `bun pm pack` / `npm pack` outputs untracked, and add `!vendor/web-ml-*.tgz` immediately beneath it so only deliberate `web-ml` release tarballs inside `vendor/` are tracked.                                                                                                                                                                                                                                                                                                | Remove `*.tgz` globally (risks accidentally committing stray tarballs in the repo root). Broad `!vendor/**` (could track unintended scratch files in `vendor/`).                                 |
| D3 Drop sibling check, keep full SHA-256 verification                                       | Remove the `stat(path.resolve(appDir, '../web-ml'))` check (L109–115) from `scripts/build-model-assets.ts` and validate `node_modules/web-ml` directly: directory presence, `package.json` SHA-256, `publicFiles` + `package.json` → `publicDigest`, and every `runtimeHashes` entry. Guarantees identical tamper/drift detection without requiring `../web-ml`.                                                                                                                                                                          | Trust `bun.lock` alone and remove per-file SHA-256 verification (loses build-time detection of stale/corrupt `node_modules/web-ml` or accidental manual edits/symlinks).                         |
| D4 Verify `node_modules/web-ml` rather than re-reading `vendor/*.tgz` in `buildModelAssets` | `bun install --frozen-lockfile --ignore-scripts` verifies the tarball against `bun.lock` when populating `node_modules/web-ml`; `buildModelAssets` verifies the exact unpacked files it actually copies into `outDir`. Keeps `buildModelAssets(outDir, appDir)` fast, dependency-free (no tar parser needed), and cleanly testable with isolated `tempAppDir` fixtures.                                                                                                                                                                   | Decompress and hash `vendor/web-ml-<version>.tgz` on every build (duplicates lockfile verification, adds tar parsing/IO overhead on every dev rebuild, and complicates fixture tests).           |
| D5 Keep `WEB_ML_REVISION` export and runtime URL shape                                      | Preserve `export const WEB_ML_REVISION` (pinned to the shipped release's provenance identifier / semver release commit recorded on rescout) and `/web-ml/${webMlVersion}-${graphDigest}/index.js`. Zero churn to `scripts/build-assets.ts`, `training.worker.ts`, or `ResultEnvelope` schema.                                                                                                                                                                                                                                             | Rename `WEB_ML_REVISION` across build scripts, worker definitions and stored result envelopes (unnecessary churn for a packaging change).                                                        |
| D6 Agent & developer spec authority                                                         | Update `AGENTS.md` §Upstream Library Specs so installed `./node_modules/web-ml/` (`dist/index.d.ts` and `specification/public-api/`) is the primary contract authority for the currently vendored build, while `../web-ml/specification/public-api/` is consulted only when evaluating unreleased upstream work or planning an upgrade, and `../web-ml/specification/requests/` remains the upstream request drop-off. Update `README.md`, `specification/ARCHITECTURE.md` and `specification/machine-learning-orchestrator.md` to match. | Leave `AGENTS.md` pointing primarily at `../web-ml` (causes agents in worktrees or standalone clones to read a different version than the vendored tarball `samata-ml` actually builds against). |

### Interfaces and behaviour

#### A. `scripts/build-model-assets.ts`

- Public exports remain unchanged:
    - `export const WEB_ML_REVISION: string` — pinned to the shipped release's provenance identifier (rescouted before `ready-for-review`).
    - `export async function buildModelAssets(outDir: string, appDir = ROOT_DIR): Promise<string>` — returns `/web-ml/${webMlVersion}-${graphDigest}/index.js`.
- Constants pinned from the rescouted tarball before submission:
    - `webMlVersion`: exact semver string from the shipped tarball's `package.json`.
    - `webMlTarball`: `vendor/web-ml-${webMlVersion}.tgz` (used in `setupError` remediation text).
    - `manifestHash`: expected SHA-256 hex of `node_modules/web-ml/package.json`.
    - `publicFiles` and `publicDigest`: exact public declarations, public Markdown prose, and model-specification JSON catalogue files shipped in the tarball and their `digestGraph` SHA-256 hex.
    - `runtimeHashes`: exact map of package-relative runtime JS/WASM/notice files shipped in the tarball to their SHA-256 hex digests.
- Verification sequence in `buildModelAssets(outDir, appDir = ROOT_DIR)`:
    1. Resolve `packageDirectory = path.join(appDir, 'node_modules', 'web-ml')`. Verify `stat(packageDirectory)` succeeds and `isDirectory()` is true; otherwise throw `setupError(packageDirectory, 'installed web-ml package is unavailable' | 'expected a directory', cause)`. Do **not** inspect `path.resolve(appDir, '../web-ml')`.
    2. Read `package.json` via `readInput(packageDirectory, 'package.json')` and assert `manifest.hash === manifestHash`; mismatch throws `setupError(path.join(packageDirectory, 'package.json'), 'package manifest does not match the verified build')`.
    3. Read every file in `publicFiles`, append `manifest`, and assert `digestGraph(publicInputs) === publicDigest`; mismatch throws `setupError(packageDirectory, 'public declarations or catalogue do not match the verified build')`.
    4. Read every entry in `runtimeHashes` and assert `input.hash === expectedHash`; mismatch throws `setupError(path.join(packageDirectory, name), 'runtime file does not match the verified build')`.
    5. Only after all checks pass, compute `graphDigest = digestGraph(runtime)` (with leading `dist/` stripped from output names), write every runtime file under `path.join(outDir, 'web-ml', `${webMlVersion}-${graphDigest}`)`, and return `/${relativeDirectory}/index.js`.
- `setupError(location, reason, cause?)` format:
    - Names `location`, `reason`, expected vendored tarball (`${webMlTarball}`), expected `webMlVersion`, `WEB_ML_REVISION`, and the fix command `bun install --frozen-lockfile --ignore-scripts`. Must never mention `../web-ml` or a sibling directory.

#### B. `.gitignore`, `vendor/` and `package.json`

- `.gitignore`: beneath `*.tgz` (L8), add `!vendor/web-ml-*.tgz`.
- `vendor/`: contains only the active shipped `web-ml-<version>.tgz` tarball (no unpacked sources, no secondary copies).
- `package.json`: `"web-ml": "file:./vendor/web-ml-<version>.tgz"`.
- `bun.lock`: updated exclusively via `bun install`, with no leaked upstream `devDependencies` (such as `web-ml/prettier`), verified via `bun install --frozen-lockfile --ignore-scripts`.

## Specification changes

- [ ] `specification/ARCHITECTURE.md` §Directory Structure and §Delivery and Caching (`Training assets.`) — document `/vendor/` (committed upstream `web-ml` release tarball) and replace the sibling `../web-ml` closure check rule with verification of the vendored `web-ml` package installed into `node_modules/web-ml` via the locked Bun install; status remains `partial`.
- [ ] `specification/machine-learning-orchestrator.md` §1 (`Runtime boundary`) — state that the build verifies the installed vendored `web-ml` release package (referencing `ARCHITECTURE.md` §Delivery and Caching and the pinned revision/hashes in `scripts/build-model-assets.ts`); status remains `implemented`.
- [ ] `specification/README.md` §Specs — verify status alignment for `ARCHITECTURE.md` (`partial`) and `machine-learning-orchestrator.md` (`implemented`) with zero contradictory sibling-checkout rules.
- [ ] `specification/HUMAN.md` §1 — tick/remove the `vendor-web-ml-tarball` upstream hand-off item once implemented.

## Implementation tasks

### T1 — Vendor shipped `web-ml` tarball and drop sibling requirement in build and tests

- **Depends on:** None
- **Risk:** needs care — modifies dependency resolution (`package.json`, `bun.lock`), build-time SHA-256 verification (`scripts/build-model-assets.ts`), and production runtime asset emission. Must preserve strict tamper detection and zero-partial-output semantics.
- **Likely files:** `.gitignore`, `vendor/*.tgz`, `package.json`, `bun.lock`, `scripts/build-model-assets.ts`, `tests/model-assets.test.ts`, `tests/training-runtime.e2e.ts` — narrow `vendor/*.tgz` to the exact shipped tarball filename before submission; edit `tests/training-runtime.e2e.ts` only if the shipped semver differs from `0.1.0`.
- **Must not touch:** `node_modules/`, `src/`, `css/`, `public/`, `specification/` — runtime code, styles, headers and specifications do not change in T1 (`node_modules/` changes only via Bun install).
- **Implementation:**
    1. Record the pre-change `bun run check` baseline in the log.
    2. Add `!vendor/web-ml-*.tgz` beneath `*.tgz` in `.gitignore`. Copy the shipped upstream tarball into `vendor/web-ml-<version>.tgz` (exact filename rescouted before submission).
    3. Update `package.json` L67 from `"web-ml": "file:../web-ml"` to `"web-ml": "file:./vendor/web-ml-<version>.tgz"`. Run `bun install` to update `bun.lock` and populate `node_modules/web-ml`, then verify with `bun install --frozen-lockfile --ignore-scripts`. Confirm `bun.lock` no longer contains leaked upstream `devDependencies` (e.g. `web-ml/prettier`).
    4. Update `scripts/build-model-assets.ts` per Interfaces §A: remove the `../web-ml` `stat` check (L109–115), validate `node_modules/web-ml` directory presence directly, update `webMlVersion`, `WEB_ML_REVISION`, `manifestHash`, `publicFiles`, `publicDigest` and `runtimeHashes` to the rescouted values for the shipped tarball, and update `setupError` to reference `vendor/web-ml-<version>.tgz`, `webMlVersion`, `WEB_ML_REVISION` and `bun install --frozen-lockfile --ignore-scripts` (with no reference to `../web-ml`).
    5. Update `tests/model-assets.test.ts`: update the expected URL/file list to the shipped tarball's `webMlVersion` and `graphDigest`; replace the missing-sibling test with a standalone test proving `buildModelAssets(output, tempAppDir)` succeeds with a valid `node_modules/web-ml` and **no** `../web-ml` sibling directory; remove the dummy sibling directory setup from the failure test; add negative assertions covering missing `node_modules/web-ml`, non-directory `node_modules/web-ml`, missing/mismatched `package.json`, mismatched `publicFiles`/`publicDigest`, and mismatched `runtimeHashes`, confirming no `output` directory is created on failure and no error mentions `../web-ml`. Keep the `public/_headers` isolation assertion intact.
    6. If `webMlVersion` differs from `0.1.0`, update the regex in `tests/training-runtime.e2e.ts` L50 to match the shipped semver.
    7. Run `bun run format scripts/build-model-assets.ts tests/model-assets.test.ts` (plus `tests/training-runtime.e2e.ts` if edited).
- **Acceptance criteria:**
    - [ ] `VEND-INSTALL-1` — `git check-ignore -v vendor/web-ml-<version>.tgz` shows it is unignored via `!vendor/web-ml-*.tgz`, while a stray root `foo.tgz` remains ignored by `*.tgz`.
    - [ ] `VEND-INSTALL-2` — `bun install --frozen-lockfile --ignore-scripts` exits 0 and `bun.lock` resolves `web-ml` from `file:./vendor/web-ml-<version>.tgz` without upstream `devDependencies` (such as `web-ml/prettier`).
    - [ ] `VEND-ASSET-1` — `buildModelAssets(output)` against the repository checkout emits the exact verified runtime/WASM/notice files to `/web-ml/<version>-<graphDigest>/` with zero `.ts`/`.d.ts` files and valid WASM magic bytes.
    - [ ] `VEND-ASSET-2` — `buildModelAssets(output, tempAppDir)` succeeds when `tempAppDir` has a valid `node_modules/web-ml` closure and **no** `../web-ml` sibling directory exists.
    - [ ] `VEND-ASSET-3` — Missing/non-directory `node_modules/web-ml`, missing/mismatched `package.json`, tampered `publicFiles` (`publicDigest` mismatch), and tampered `runtimeHashes` each reject with a `web-ml setup error` naming the failing path, `vendor/web-ml-<version>.tgz`, `bun install --frozen-lockfile --ignore-scripts`, and never mentioning `../web-ml`; `output` is not created on any failure.
    - [ ] `VEND-RUNTIME-1` — `bun run build`, `bun run check`, and `bun run test:e2e tests/training-runtime.e2e.ts` pass end-to-end against the vendored package.
- **Verification:** `bun install --frozen-lockfile --ignore-scripts`; `bun test tests/model-assets.test.ts`; `bun run check`; `bun run build`; `bun run test:e2e tests/training-runtime.e2e.ts`; `bun run format:check`.
- **Progress:** [ ] Not started

### T2 — Update agent instructions, README and specifications for vendored `web-ml`

- **Depends on:** T1
- **Risk:** routine
- **Likely files:** `AGENTS.md`, `README.md`, `specification/ARCHITECTURE.md`, `specification/machine-learning-orchestrator.md`, `specification/README.md`, `specification/HUMAN.md`, `specification/plans/README.md`, `specification/plans/vendor-web-ml-tarball.md`
- **Must not touch:** `src/`, `scripts/`, `tests/`, `vendor/`, `package.json`, `bun.lock`, `node_modules/`, `specification/mockups/` — no code, dependency or mockup changes.
- **Implementation:**
    1. Update `AGENTS.md`:
        - Intro & `## Repository boundary`: clarify that `samata-ml` builds and runs against the vendored semver `web-ml` tarball in `vendor/` installed into `node_modules/web-ml` (no sibling `../web-ml` checkout is needed to install, build or test), while `../web-ml` remains the upstream repository and `../web-ml/specification/requests/` remains the upstream capability-request drop-off.
        - `## Upstream Library Specs`: make the installed package (`./node_modules/web-ml/specification/public-api/model-specifications/{schema.json,index.json,models/*.json}`, `./node_modules/web-ml/dist/index.d.ts` and `./node_modules/web-ml/specification/public-api/`) the primary contract authority for the currently vendored build; specify that `../web-ml/specification/public-api/` is only consulted when inspecting unreleased upstream work or planning an upgrade, and keep the strict cross-repo scout deny boundary intact.
        - `## Map` & `## Rules`: list `vendor/` (`vendored web-ml release tarball`) in Map and state under Rules that `vendor/*.tgz` is replaced only during a planned `web-ml` upgrade (and `bun.lock` only via Bun install/add/remove when planned).
    2. Update `README.md`:
        - `## Install Dependencies`: explain that `web-ml` is vendored as a packed semver tarball under `vendor/` (no sibling `../web-ml` checkout needed), recommend `bun install --frozen-lockfile --ignore-scripts` (or `bun install`), and document the upgrade steps (replace `vendor/web-ml-<version>.tgz`, update `package.json`, run `bun install`, update pinned version/revision/hashes in `scripts/build-model-assets.ts` and `tests/model-assets.test.ts`).
        - `## Build System Overview`: list `scripts/build-model-assets.ts` and summarise how it verifies `node_modules/web-ml` hashes and emits `/web-ml/{version}-{digest}/`.
    3. Apply every item under `## Specification changes` (`specification/ARCHITECTURE.md`, `specification/machine-learning-orchestrator.md`, `specification/README.md`, `specification/HUMAN.md`), tick the checklist items in this plan, and run `bun run format` on every edited file.
- **Acceptance criteria:**
    - [ ] `VEND-DOC-1` — `AGENTS.md`, `README.md`, `specification/ARCHITECTURE.md` and `specification/machine-learning-orchestrator.md` state consistently that `samata-ml` installs and verifies the vendored tarball from `vendor/` via `node_modules/web-ml` without requiring a sibling `../web-ml` checkout, while preserving the upstream boundary for `../web-ml/specification/requests/`.
    - [ ] `VEND-DOC-2` — Every item under _Specification changes_ is applied and ticked, `specification/README.md` status rows match spec headers, and `bun run plans:check specification/plans/vendor-web-ml-tarball.md` plus `bun run plans:task specification/plans/vendor-web-ml-tarball.md --check-complete` pass.
    - [ ] `VEND-DOC-3` — `bun run format:check` and `bun run check` pass with no unintended diffs outside T2's likely files.
- **Verification:** `bun run format:check`; `bun run plans:check specification/plans/vendor-web-ml-tarball.md`; `bun run plans:task specification/plans/vendor-web-ml-tarball.md --check-complete`; `bun run check`.
- **Progress:** [ ] Not started

## Verification and definition of done

- [ ] All task acceptance criteria (`VEND-INSTALL-*`, `VEND-ASSET-*`, `VEND-RUNTIME-1`, `VEND-DOC-*`) met.
- [ ] `bun install --frozen-lockfile --ignore-scripts`, `bun run check`, `bun run build`, `bun run test:e2e tests/training-runtime.e2e.ts` and `bun run format:check` pass with no new failures.
- [ ] Standalone verification confirms `buildModelAssets` and `bun run build` work without a `../web-ml` sibling directory while rejecting missing or tampered `node_modules/web-ml` files.
- [ ] Every item under _Specification changes_ is ticked, and specifications match the implemented code.
- [ ] No unintended changes outside the tasks' likely files; `../web-ml` untouched.

## Risks and open questions

- **Blocking:** None.
- **Non-blocking:** Binary `.tgz` commits grow git history on each `web-ml` release upgrade. Mitigation: `web-ml` is a small prebuilt JS + WASM package (~hundreds of KB), only one active tarball is kept in `vendor/`, and upgrades happen infrequently at deliberate semver releases. Owner: maintainer.
- **Non-blocking:** `README.md` L1 still carries the legacy `# web-ml` title (`specification/README.md` Known gap 10) and `bun.lock` L6 has stale workspace name `"web-ml-app"`. Left untouched as out-of-scope churn unless separately planned. Owner: maintainer.

## Escalations

None.

## Review fixes

None.

## Implementation and verification log

| When (UTC)           | Task | Agent (model)                           | Outcome / commands / evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------- | ---- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-21T15:06:37Z | —    | Google Antigravity (Gemini 4 Neon High) | Initial draft authored after `codebase-scout` inspection of `package.json`, `bun.lock`, `.gitignore`, `scripts/build-model-assets.ts`, `scripts/build-assets.ts`, `tests/model-assets.test.ts`, `tests/training-runtime.e2e.ts`, `src/features/models/model-catalogue.ts`, `README.md`, `AGENTS.md`, and `specification/`. Kept `draft` pending shipped upstream tarball (`../../../web-ml/specification/requests/2026-11-21-semver-package-tarball-releases.md`). No product code changed. |

## Plan review history

| Reviewed (UTC) | Agent (model) | Decision | Findings |
| -------------- | ------------- | -------- | -------- |

## Change log

| When (UTC)           | Change        | Reason                                                                                                                                                                                                                                                                                                |
| -------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-21T15:06:37Z | Initial draft | Maintainer chose vendoring a packed semver `web-ml` tarball under `vendor/` (`file:./vendor/web-ml-<version>.tgz`) and dropping the hard `../web-ml` sibling requirement; upstream packaging request filed at `../../../web-ml/specification/requests/2026-11-21-semver-package-tarball-releases.md`. |
