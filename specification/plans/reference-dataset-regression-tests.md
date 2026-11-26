# Reference-dataset regression tests

**Status:** draft | **Updated:** 2026-11-26T09:03:13Z
**Authors:** Codex (unrecorded) | **Created:** 2026-11-13T15:24:00Z
**Verified by:** — | **Verified:** — | **Verification:** pending
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour:** Every test uses small synthetic inputs. `bun run check` runs 144 tests in 22 files (review baseline: 0 failures/type errors); the data tests (`tests/profiler.test.ts`, `tests/cells.test.ts`, `tests/column-eligibility.test.ts`, `tests/ingestion-source.test.ts`, `tests/storage-db.test.ts`) build their inputs inline. Playwright suites (`tests/app-shell.test.ts`, `tests/content.e2e.ts`, `tests/a11y.e2e.ts`, `tests/visual-parity.e2e.ts`) test the shell and content modals; each re-implements its own setup (for example `app-shell.test.ts` dismisses the welcome modal with a 1.5 s visibility race). No test reads a committed sample dataset, so nothing checks that the real Iris and Palmer Penguins files still produce the same types, statistics, stored rows and model inputs after a change. The [data-ingestion-and-storage](archive/data-ingestion-and-storage.md) plan (`implemented`, all tasks complete) adds point checks on these datasets (its T9 content test, its T11 "Iris-like" provider test and its T15 browser test), but each asserts a handful of facts, not the whole output.

**Target behaviour:**

- **Reference datasets.** `iris` (clean, all-numeric features, three balanced classes) and `palmer-penguins` (missing values, categorical features, a descriptor type override, three unbalanced classes) are the project's reference datasets. One registry, `tests/helpers/reference-datasets.ts`, records their paths, SHA-256 hashes and spec-level facts.
- **Golden files.** The full output of each data layer for each reference dataset is committed under `tests/golden/` as canonical JSON: ingestion metadata and every stored row (upload path and sample path), and the dataset provider's feature matrix and targets. A change that alters any of it fails `bun run check` with a readable diff. A deliberate change is accepted with `UPDATE_GOLDEN=1` and a reviewed diff.
- **Cross-browser conformance.** In Chromium, Firefox and WebKit, the real storage worker ingests both reference datasets, and the result must equal the same golden files that Bun produced.
- **Shared Playwright helpers.** `tests/e2e/` gives every future browser suite one deterministic way to open the app, dismiss the welcome modal, read persisted state and inspect IndexedDB.
- **Journeys (rule only).** testing.md states how cross-step journey tests over the reference datasets are written and that each workflow-step plan extends them. No journey exists yet, because no workflow step has a UI.

**Why:** Unit tests with tiny inputs check rules one at a time; they do not notice when a change to one rule (a detector threshold, a histogram width, a sort order) shifts the output for a real file. Golden tests over two small, well-understood datasets catch those shifts in under a second, in `bun run check`, at every layer below the UI. The browser conformance test catches engine differences that Bun cannot. The helpers and the journey rule mean that, as Steps 1–4 land, the end-to-end tests grow on one shared base instead of each step reinventing seeding.

## Scope

**In scope**

- A framework-free golden-file helper (canonical JSON, numeric rounding, redaction, update mode) and its unit tests.
- The reference-dataset registry and a hash guard test.
- `.prettierignore` for `tests/golden/`, and the golden update command in `AGENTS.md`.
- Shared Playwright helpers for the app shell, persisted state and IndexedDB, with a smoke suite.
- Golden tests for upload-path ingestion, sample-path ingestion (through the real build generator) and the dataset provider.
- A Playwright conformance suite comparing worker output in three browsers with the goldens.
- testing.md: test layers, reference datasets, golden files, shared helpers and the journey rule.

**Out of scope**

- Any change under `src/`, `scripts/` or `content/`. If a golden test exposes a product bug, the implementer records it and escalates; it is never fixed here.
- Journey tests themselves: the first is created by whichever plan first lets a user load a sample through the UI (expected: [step-1-load-data-and-preview](archive/step-1-load-data-and-preview.md)).
- Training and results tests: the orchestrator is a stub ([machine-learning-orchestrator.md](../machine-learning-orchestrator.md), TODO-33). testing.md records the rule for them; no code.
- Datasets other than Iris and Penguins (a binary-target reference such as `titanic` is a later addition; see Risks).
- CI (Known gap 7), migrating existing suites to the new helpers, and Known gaps 5 and 17 (component-test environment and location; these tests are not component tests).
- Changing `playwright.config.ts` or `bunfig.toml`: both already pick the new files up (see _Codebase context_).

**Constraints and invariants**

- Goldens are written only by `bun test`; Playwright only reads them. Bun is the reference engine.
- A golden test never replaces explicit assertions: every golden suite also asserts the registry's facts (row counts, column names, class counts, missing counts), so an accidental `UPDATE_GOLDEN=1` cannot bless a broken result.
- Golden files are test data, not specification. A golden diff that changes behaviour a spec describes must come with that spec's update in the same change.
- `content/datasets/*/data.csv` stay byte-identical.
- Tests take no network access beyond the local dev server.
- Each golden suite runs in under 2 s in Bun; the conformance suite in under 30 s per browser.

## Required reading

The implementer reads only these, plus each task's likely files. Everything else is optional.

- This plan's _Technical decisions_ and _Interfaces and behaviour_ — the helper contracts and file formats.
- `specification/testing.md` (whole file, short) — current test rules.
- `specification/COMPONENTS.md` §9 bullet 1 — every acceptance criterion ID has a test whose name starts with it.
- `specification/plans/data-ingestion-and-storage.md` — only: _Codebase context_ bullet "Palmer Penguins" (dataset facts); _Interfaces and behaviour_ → "Pipeline" (`runIngestion` options) and the `StorageRequest`/`StorageResponse` protocol; tasks T6, T8, T9, T11 and T15 (what each already tests, so you do not duplicate it). Use the TSDoc of the files those tasks created as the source of truth for signatures. Also read `src/features/data/ingestion/pipeline.ts` RunIngestionOptions and `src/features/data/ingestion/protocol.ts` StorageRequest/StorageResponse.
- `src/types/dataset.ts` — `DatasetMetadata`, `ColumnStats`, `RawRecord`.
- `tests/helpers/fake-indexeddb.ts` and `tests/setup.ts` — the Bun IndexedDB and Web Locks fakes.
- `tests/app-shell.test.ts` lines 1–15 — the current welcome-modal handling the helpers replace for new suites.
- `src/types/state.ts` lines 1–12 — `STATE_STORAGE_KEY`, `SCROLL_STORAGE_KEY`.
- `src/common/storage/db.ts` lines 1–45 — `DB_NAME`, `DB_VERSION`, store names.

## Codebase context

Facts the planner verified, so the implementer need not re-check them.

- **Relevant implementation:**
    - `content/datasets/iris/data.csv` — header `sepal length,sepal width,petal length,petal width,class`; 150 rows; classes `Iris-setosa`, `Iris-versicolor`, `Iris-virginica`, 50 each; no missing values; SHA-256 `daaeb5e3e889d07fbdd44544f5a39fe2372a07172e25899d577be0ad74df9e65`.
    - `content/datasets/palmer-penguins/data.csv` — header `species,island,bill_length_mm,bill_depth_mm,flipper_length_mm,body_mass_g,sex,year`; 344 rows; `Adelie` 152, `Chinstrap` 68, `Gentoo` 124; `NA` twice in each of the four measurement columns and 11 times in `sex`; SHA-256 `f204db2c753b0937caac3cb35258562c14f073e4bbc76be24b4c51ce22767a93`.
    - `src/common/storage/cells.ts:5` — `DEFAULT_MISSING_VALUE_TOKENS` includes `na`, so the upload path also treats `NA` as missing.
    - `src/common/storage/profiler.ts`, `src/features/data/ingestion/{csv-stream,fetch-source,order-statistics,errors,limits}.ts` exist (data-ingestion T1–T5). `runIngestion`, the worker, the generator and the provider now exist; use their actual exported signatures, not the old plan's provisional shapes.
    - `src/common/storage/db.ts` — `DB_NAME = 'samata-db'`, `DB_VERSION = 2`.
    - `src/types/state.ts:7` — `STATE_STORAGE_KEY = 'samata-ml:state'`; the welcome flag is `onboarding.welcomeDismissed` (`src/stores/app.store.ts:50-55`).
    - No `.prettierignore` exists; Prettier 3 reads both `.gitignore` and `.prettierignore` by default.
- **Tests and commands:**
    - Baseline 2026-11-13: `bun run check` passes — 0 type errors, 144 tests across 22 files, 0 failures. AGENTS.md's 52-test count is historical; record a fresh before/after baseline rather than rewriting it in this test-only plan.
    - `playwright.config.ts` `testMatch: /.*(\.e2e|app-shell\.test)\.ts/` under `./tests`, so `tests/reference-conformance.e2e.ts` and `tests/e2e-helpers.e2e.ts` are discovered without a config change; `tests/e2e/*.ts` helper files (no `.e2e`) are not. Each Playwright test gets a fresh browser context, so storage starts empty.
    - `bun test` discovers `*.test.ts` only, so `.e2e.ts` files and `tests/e2e/*.ts` are not run by it. `tsconfig.json` has no `include`, so `tsc` type-checks everything under the root, including `tests/`.
    - Playwright 1.65.0; Chromium, Firefox and WebKit binaries are installed in `~/Library/Caches/ms-playwright`.
- **Web guidance:** None — test tooling only (the skill excludes tests).
- **Review author:** Codex (model unrecorded), 2026-11-13; retain this co-author during workflow migration.
- **Review handoff:** No product blockers. Prepared for review under the current valid `draft` metadata; formal `ready-for-review` submission waits for agent-workflow-gates status support.
- **Visual reference:** None — no user-visible change.
- **Lit skills:** None.
- **Known gaps decided:** None. Gaps 5 and 17 concern component tests; these suites are data and integration tests in `tests/`, consistent with both sides.
- **Assumptions requiring verification:**
    - T3 establishes the upload-path type from actual inference; sample-path `year` must be categorical per descriptor. If the upload type is also categorical, assert the explicit sample override without inventing a cross-path difference. A surprising golden requires review, not weakening the invariant silently.
    - None for the fetch seam: `RunIngestionOptions.fetchImpl` exists. Pass it directly; never replace global fetch. `generateSampleDatasets` accepts the subset ids/cacheDir options already used in tests/sample-datasets-content.test.ts.

## Technical decisions

| Decision                          | Chosen approach and rationale                                                                                                                                                                                                                                                                                                                              | Rejected alternative / trade-off                                                                                                                                                                         |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 Reference datasets             | Iris and Penguins only. Together they cover numeric and categorical features, missing values, balanced and unbalanced multiclass targets and a descriptor override, at 150 and 344 rows: small enough to store every row in a golden and run in milliseconds.                                                                                              | All twelve: slow, large goldens, and most add no new code path. A synthetic "kitchen-sink" CSV: already the job of the unit tests.                                                                       |
| D2 Golden granularity             | One golden per dataset per layer and path: `ingestion/<id>.upload.json`, `ingestion/<id>.sample.json`, `provider/<id>.json`. Each stores the complete output, including every row, so a diff names the exact row and field that changed.                                                                                                                   | Digests only: a failure says "something changed" with no location. Snapshotting intermediate layers (profiler): double maintenance, since the pipeline golden already contains the profile.              |
| D3 Golden format                  | Canonical JSON (_Interfaces_): keys sorted by code unit; non-integer numbers rounded to 12 significant digits; `-0` → `0`; arrays of primitives on one line, everything else tab-indented; trailing newline. Volatile fields (`id`, `createdAt`) are redacted to `"<redacted>"`. `tests/golden/` is in `.prettierignore` so the writer's format is stable. | Bun's `toMatchSnapshot`: Bun-only, so Playwright could not compare with it, and its `.snap` format is harder to review. Exact floats: `Math.log10`/`Math.pow` may differ in the last bit across engines. |
| D4 Updating goldens               | `UPDATE_GOLDEN=1 bun test <file>` rewrites the goldens that suite touches. The helper refuses to write when `CI` is set, and throws a message naming the command when a golden is missing. Playwright never writes.                                                                                                                                        | Auto-create on first run: a missing golden would silently pass.                                                                                                                                          |
| D5 Explicit invariants            | The registry holds spec-level facts (row count, column names in order, target, class counts, missing counts). Every golden suite asserts them before comparing the golden.                                                                                                                                                                                 | Golden only: one careless update blesses a regression.                                                                                                                                                   |
| D6 Sample path uses the build     | T4 runs the real `generateSampleDatasets` into a temporary directory (as data-ingestion T9 does) and serves its output to `runIngestion` through a fake `fetch`, so descriptor, generator and pipeline are tested together on real content.                                                                                                                | Hand-written descriptor fixtures: would not notice a descriptor/CSV drift.                                                                                                                               |
| D7 Cross-browser conformance      | The Playwright runner reads the CSV from disk, the page ingests it in the real worker (`/storage.worker.js`) as an in-page `File` and as a sample, and returns metadata and all rows to the runner, which canonicalises them with the same helper and compares them with the Bun goldens.                                                                  | Separate per-browser goldens: hides engine differences instead of reporting them.                                                                                                                        |
| D8 Shared Playwright helpers      | Plain functions in `tests/e2e/app.ts` and `tests/e2e/storage.ts` taking a `Page`, not a custom `test.extend` fixture: they work in any suite without changing its imports, and fresh contexts already give empty storage.                                                                                                                                  | A custom fixture: every suite would have to import a different `test`. Migrating existing suites: out of scope, and `app-shell.test.ts` is owned by state-navigation-conformance.                        |
| D9 IndexedDB inspection           | Helpers check `indexedDB.databases()` before opening `samata-db`, and open it without a version. They never create the database.                                                                                                                                                                                                                           | Opening blindly: creates an empty v1 database, and the app's v2 upgrade would then run from `oldVersion` 1, which the app does not expect.                                                               |
| D10 Journeys are a rule, not code | testing.md defines journeys (one file per reference scenario, `tests/journeys/<dataset>-<task>.e2e.ts`, walking the real UI from a fresh context with no seeded state, each stage added by the plan that builds that step). The first is written by the plan that adds sample loading to the UI.                                                           | Writing a journey now: with no step UI it could only repeat NAV-E2E-1.                                                                                                                                   |

### Interfaces and behaviour

**`tests/helpers/golden.ts`** (framework-free; only `node:fs`, `node:path`, `node:url`, so it runs in Bun and in Playwright's Node runner):

```ts
/** Options for {@link canonicalise}. */
export interface CanonicaliseOptions {
	/** Property names replaced by `"<redacted>"` at any depth. */
	redact?: readonly string[];
}
/** Returns a deep copy with sorted keys, rounded numbers and redactions applied. Throws on NaN, ±Infinity, undefined, functions, symbols and bigints. Typed arrays become plain arrays. */
export function canonicalise(value: unknown, options?: CanonicaliseOptions): unknown;
/** Serialises an already canonical value in the golden format (D3). */
export function serialiseGolden(value: unknown): string;
/** Reads `tests/golden/<relativePath>`; throws `GoldenMissingError` with the update command if absent. */
export function readGolden(relativePath: string): unknown;
/** Bun only: when UPDATE_GOLDEN=1 and CI is unset, writes `actual` and returns it; otherwise returns readGolden(relativePath). Throws if UPDATE_GOLDEN=1 and CI is set. */
export function goldenFor(relativePath: string, actual: unknown): unknown;
```

- Rounding: integers (`Number.isInteger`) are kept exactly; other finite numbers become `Number(n.toPrecision(12))`.
- Key order: `Object.keys(...).sort()` (code-unit order, never `localeCompare`).
- Paths resolve against the repository's `tests/golden/` from the helper's own location (`import.meta.url`), not the working directory.
- Usage: `expect(canonical).toEqual(goldenFor('ingestion/iris.upload.json', canonical))` in Bun; `expect(canonical).toEqual(readGolden(...))` in Playwright.

**`tests/helpers/reference-datasets.ts`:**

```ts
export type ReferenceDatasetId = 'iris' | 'palmer-penguins';
export interface ReferenceDataset {
	id: ReferenceDatasetId;
	csvPath: string; // absolute path to content/datasets/<id>/data.csv
	sha256: string;
	rowCount: number;
	columns: readonly string[]; // header order
	target: string; // 'class' | 'species'
	classCounts: Readonly<Record<string, number>>;
	missingCounts: Readonly<Record<string, number>>; // only columns with missing values
}
export const REFERENCE_DATASETS: Readonly<Record<ReferenceDatasetId, ReferenceDataset>>;
/** Reads the CSV as text. */
export function readReferenceCsv(id: ReferenceDatasetId): string;
/** A `File` named `<id>.csv` (type `text/csv`) with the CSV bytes. */
export function referenceFile(id: ReferenceDatasetId): File;
```

Values are exactly those under _Codebase context_.

**Golden content:**

- `ingestion/<id>.upload.json` and `ingestion/<id>.sample.json`: `{ metadata: DatasetMetadata, rows: CellValue[][] }`, `rows` in `rowIndex` order, `id` and `createdAt` redacted (Bun runs also inject a fixed `uuid` and `now`, but redaction keeps Bun and browsers identical).
- `provider/<id>.json`: `{ featureNames, targetCategories, sampleCount, features: number[][], targets: number[] }`, with `features` split row-major into rows of `featureNames.length`.

**Provider configurations (T5):**

- Iris: features `sepal length`, `sepal width`, `petal length`, `petal width`; target `class`; no preprocessing.
- Penguins: features `bill_length_mm`, `bill_depth_mm`, `flipper_length_mm`, `body_mass_g` (each `impute: median`), `island` (`one-hot`), `sex` (`impute: mode`, then `one-hot`); target `species`. Ingested by the sample path.

**`tests/e2e/app.ts`:**

```ts
/** Navigates to `path` and waits until either the welcome dialog or `#content h1` is visible. */
export async function openApp(page: Page, path?: string): Promise<void>;
/** If the welcome dialog is open, clicks its primary button and waits for it to close; otherwise does nothing. No fixed timeouts. */
export async function dismissWelcome(page: Page): Promise<void>;
/** The `#content h1` locator. */
export function pageHeading(page: Page): Locator;
/** Clicks the sidebar link for a workflow path and waits for the heading to change. */
export async function gotoStep(
	page: Page,
	path: '/data' | '/target' | '/models' | '/results'
): Promise<void>;
/** Parses `localStorage[STATE_STORAGE_KEY]`, or null. */
export async function readPersistedState(page: Page): Promise<unknown>;
```

**`tests/e2e/storage.ts`:**

```ts
/** True if `samata-db` exists (via indexedDB.databases()). */
export async function hasSamataDb(page: Page): Promise<boolean>;
/** Number of rows stored for a dataset id; 0 if the database does not exist. Never creates it (D9). */
export async function countStoredRows(page: Page, datasetId: string): Promise<number>;
/** Added in T6: ingests through a new module Worker('/storage.worker.js') and returns { metadata, rows }. */
export async function ingestInWorker(
	page: Page,
	source: { kind: 'sample'; sampleId: string } | { kind: 'file'; name: string; text: string }
): Promise<{ metadata: unknown; rows: unknown[][] }>;
```

**Test IDs** (test names start with these; recorded in testing.md):

- `REF-1` reference CSV hashes and facts match the registry.
- `REF-2` upload-path ingestion matches its golden, per dataset.
- `REF-3` sample-path ingestion matches its golden, per dataset; Penguins `year` differs by path.
- `REF-4` provider output matches its golden, per dataset.
- `REF-5` browser worker output equals the Bun goldens, per dataset and path, in each browser.
- `E2E-H-1` the shared helpers open the app, dismiss the welcome modal once, and verify inspection does not create a database.

## Specification changes

What `specification/` must say once this plan is implemented. The final task applies these items and ticks each one; `task_gate.py --check-complete` refuses to close the plan while any is unticked.

- [ ] `specification/testing.md` status line — still `partial`: names reference-dataset goldens, browser conformance and the shared Playwright helpers as built; journeys, Comlink and worker-training tests as target; keeps the Known gap 5 note.
- [ ] `specification/testing.md` new § "Test layers" — unit (`bun:test`, synthetic inputs, one rule per test); reference integration (`bun:test`, goldens); browser conformance (Playwright, reads goldens); journeys (Playwright, target). Which layer a new test belongs in.
- [ ] `specification/testing.md` new § "Reference datasets" — Iris and Penguins, what each covers, the registry path, that their CSVs never change, and that a new reference dataset needs a registry entry and goldens for every layer.
- [ ] `specification/testing.md` new § "Golden files" — location and naming, canonical format (D3), the update command and the CI refusal (D4), explicit invariants alongside every golden (D5), that a golden diff is reviewed like code and that goldens are not normative (a behaviour change also updates its spec), and that only Bun writes them.
- [ ] `specification/testing.md` new § "Shared Playwright helpers" — `tests/e2e/app.ts` and `tests/e2e/storage.ts`, that new suites use them, and the never-create-the-database rule (D9).
- [ ] `specification/testing.md` new § "Journeys" (target) — D10: one file per scenario under `tests/journeys/`, fresh context and real UI only (no seeded state), one stage per workflow step added by the plan that builds the step, reload-and-resume checked at each stage; training stages use fixed seeds and assert invariants and tolerances (metrics within [0, 1], confusion-matrix totals equal the test-set size, a stated minimum accuracy), never exact floating-point metrics.
- [ ] `specification/testing.md` — test IDs `REF-1`–`REF-5` and `E2E-H-1` listed in the relevant sections.
- [ ] `specification/README.md` — testing.md row "Read when" becomes "Writing or running tests; planning any feature (which test layers it must extend)"; status unchanged.

## Implementation tasks

### T1 — Golden helper, reference registry and hash guard

- **Depends on:** None
- **Risk:** routine
- **Likely files:** `tests/helpers/golden.ts`, `tests/helpers/reference-datasets.ts`, `tests/golden-helper.test.ts`, `tests/reference-datasets.test.ts`, `tests/golden/.gitkeep`, `.prettierignore`, `AGENTS.md`
- **Must not touch:** `content/datasets/**`, `bunfig.toml`, `playwright.config.ts`, `src/**`
- Create `.prettierignore` and limit changes to `AGENTS.md` to its Verification Commands list.
- **Implementation:**
    - Write both helpers per _Interfaces_, with TSDoc on every export. `golden.ts` imports nothing from `bun`, `bun:test` or `@playwright/test`.
    - `.prettierignore` contains exactly `tests/golden/`.
    - `tests/golden-helper.test.ts`: unit tests for `canonicalise` and `serialiseGolden` (key order, rounding, `-0`, redaction at depth, typed arrays, throwing inputs), and for `goldenFor` using a temporary subdirectory under `tests/golden/__helper__/` that the test removes in `afterEach` (update mode writes; non-update mode reads; missing file throws with `UPDATE_GOLDEN=1` in the message; `CI` + `UPDATE_GOLDEN` throws). Set and restore `process.env` per test.
    - `tests/reference-datasets.test.ts` (`REF-1`): for each dataset, the file's SHA-256 (`node:crypto`) equals `sha256`; parsing the CSV with PapaParse (`header: false`, `skipEmptyLines: true`) gives the header `columns`, `rowCount` data rows, the `classCounts` for `target`, and the `missingCounts` of `NA` cells.
    - Add to `AGENTS.md` → Commands: `` `UPDATE_GOLDEN=1 bun test <test-file>` — rewrite the golden files that suite uses; review the diff (testing.md "Golden files"). ``
- **Acceptance criteria:**
    - [ ] `canonicalise({ b: 1, a: [0.1 + 0.2, -0] })` serialises with `a` before `b`, `0.3` and `0`; `canonicalise(NaN)` throws.
    - [ ] Arrays of primitives serialise on one line; the output ends with one newline; serialising twice gives identical text.
    - [ ] `goldenFor` behaves as specified in all four modes, and the test leaves nothing under `tests/golden/__helper__/`.
    - [ ] `REF-1` passes for both datasets; changing one expected count in the registry makes it fail.
    - [ ] `.prettierignore` is not Prettier-supported: preserve its single line manually, do not run the formatter on it; `bunx prettier --file-info tests/golden/ingestion/iris.upload.json` reports `"ignored": true`.
- **Verification:** `bun test tests/golden-helper.test.ts tests/reference-datasets.test.ts`; `bun run check` (expect 144 + new tests, 0 failures)
- **Progress:** [ ] Not started

### T2 — Shared Playwright helpers and smoke suite

- **Depends on:** None
- T2 is parallel-safe with T1.
- **Risk:** routine
- **Likely files:** `tests/e2e/app.ts`, `tests/e2e/storage.ts`, `tests/e2e-helpers.e2e.ts`
- **Must not touch:** `tests/app-shell.test.ts`, `tests/app-shell.e2e.ts`, `tests/content.e2e.ts`, `tests/a11y.e2e.ts`, `tests/visual-parity.e2e.ts`, `playwright.config.ts`, `src/**` — preserve existing suites.
- **Implementation:** Write `openApp`, `dismissWelcome`, `pageHeading`, `gotoStep`, `readPersistedState`, `hasSamataDb` and `countStoredRows` per _Interfaces_ (not `ingestInWorker`; T6 adds it). `dismissWelcome` waits with `expect(...).toBeVisible()`/`toBeHidden()` or `locator.waitFor`, never `isVisible({ timeout })` races or `waitForTimeout`. Import `STATE_STORAGE_KEY` and `DB_NAME` from `src/` (type-safe constants; importing is not touching). `tests/e2e-helpers.e2e.ts` (`E2E-H-1`): fresh context → `openApp(page, '/data')` → `dismissWelcome` → heading `Load Data` → `readPersistedState` has `onboarding.welcomeDismissed === true` → reload with `openApp` → no welcome dialog → capture `hasSamataDb` before/after `countStoredRows(page, 'x') === 0` and assert existence unchanged. Startup reconciliation may already create samata-db, so do not require absence. Prove the absent-database branch separately in a fresh same-origin context with the main application script blocked (and no IndexedDB connections), then verify countStoredRows does not create it → `gotoStep(page, '/target')` shows `Set Target`.
- **Acceptance criteria:**
    - [ ] `E2E-H-1` passes in Chromium, Firefox and WebKit.
    - [ ] No helper contains `waitForTimeout` or a `timeout` passed to `isVisible`.
    - [ ] Every exported helper has TSDoc.
- **Verification:** `bun run test:e2e tests/e2e-helpers.e2e.ts`; `bun run check`
- **Progress:** [ ] Not started

### T3 — Upload-path ingestion goldens (`REF-2`)

- **Depends on:** T1
- **Risk:** needs care — the first goldens set the baseline; a product bug blessed here is hard to spot later.
- **Likely files:** `tests/reference-ingestion.test.ts`, `tests/golden/ingestion/iris.upload.json`, `tests/golden/ingestion/palmer-penguins.upload.json`
- **Must not touch:** `src/**`, `tests/ingestion-pipeline.test.ts` — escalate product bugs to their owner and leave the ingestion pipeline suite to the data-ingestion plan.
- **Implementation:** Cross-plan prerequisite: [data-ingestion-and-storage](archive/data-ingestion-and-storage.md) T6 has its progress checked. If not, stop before changing any file and report it. For each reference dataset: `installFakeIndexedDB()`; `runIngestion({ kind: 'file', file: referenceFile(id) }, { db, now: () => 0, uuid: () => 'golden' })`; read every RawRecord back with `getRows`, sort by rowIndex and map to record.values; build `{ metadata, rows }`; assert D5 invariants (rowCount; column names in order; `target` column `categorical` with `categoryCounts` equal to `classCounts`; each column's `missingCount` equals `missingCounts[name] ?? 0`; `source` `'upload'`, `sampleId` null, `name` equal to `id`); then compare `canonicalise(..., { redact: ['id', 'createdAt'] })` with `goldenFor('ingestion/<id>.upload.json', …)`. Generate the goldens with `UPDATE_GOLDEN=1`, then **read both files** and check, against the CSV and data-ingestion's _Interfaces_, that the types, missing counts, histograms (counts sum to `count`) and row values are right. Record anything surprising in the log and escalate rather than committing it.
- **Acceptance criteria:**
    - [ ] `REF-2 iris` and `REF-2 palmer-penguins` pass without `UPDATE_GOLDEN`.
    - [ ] Iris: four `numeric` columns, `class` `categorical`, every `missingCount` 0, 150 rows of 5 values with numbers as numbers.
    - [ ] Penguins: 344 rows; 2 `null`s in each measurement column and 11 in `sex`; `year` type recorded in the log (see _Assumptions_).
    - [ ] Editing one value in a golden file makes the suite fail with a diff naming that field.
- **Verification:** `bun test tests/reference-ingestion.test.ts`; `bun run check`
- **Progress:** [ ] Not started

### T4 — Sample-path ingestion goldens through the generator (`REF-3`)

- **Depends on:** T3
- **Cross-plan prerequisite:** [data-ingestion-and-storage](archive/data-ingestion-and-storage.md) T9 has its progress checked. If not, stop and report it.
- **Risk:** needs care — temporary directories, a fake `fetch` that must strip `?v=` query strings, and restoring globals.
- **Likely files:** `tests/reference-ingestion.test.ts`, `tests/golden/ingestion/iris.sample.json`, `tests/golden/ingestion/palmer-penguins.sample.json`
- **Must not touch:** `src/**`, `scripts/**`, `content/**`, `tests/sample-datasets-content.test.ts`
- **Implementation:** In `beforeAll`, run `generateSampleDatasets(<tmp>/out, { ids: ['iris', 'palmer-penguins'], cacheDir: <tmp>/cache })` (`fs.mkdtemp` under `os.tmpdir()`; removed in `afterAll`). Serve `<tmp>/out` to the pipeline with a fake `fetch` that maps a URL's pathname (ignoring the query) to a file, and returns 404 otherwise, through the seam T6 built. For each dataset run `runIngestion({ kind: 'sample', sampleId: id }, …)` and repeat T3's invariants (with `source` `'sample'`, `sampleId` equal to `id`, `name` from the descriptor), then compare with `ingestion/<id>.sample.json`. Add one test: Penguins `year` is `categorical` on the sample path and records whether its upload-path type differs (per _Assumptions_). Review the new goldens as in T3.
- **Acceptance criteria:**
    - [ ] `REF-3 iris`, `REF-3 palmer-penguins` and `REF-3 year override` pass without `UPDATE_GOLDEN`.
    - [ ] Upload and sample goldens differ only in `name`, `source`, `sampleId`, descriptor overrides and fields those overrides change; any other difference is recorded in the log.
    - [ ] No files remain in `os.tmpdir()` from the suite, and `globalThis.fetch` is restored.
- **Verification:** `bun test tests/reference-ingestion.test.ts`; `bun run check`
- **Progress:** [ ] Not started

### T5 — Dataset-provider goldens (`REF-4`)

- **Depends on:** T4
- **Cross-plan prerequisite:** [data-ingestion-and-storage](archive/data-ingestion-and-storage.md) T11 has its progress checked. If not, stop and report it.
- **Risk:** needs care — buffer sizing and splitting the row-major buffer correctly.
- **Likely files:** `tests/reference-provider.test.ts`, `tests/helpers/reference-ingest.ts`, `tests/reference-ingestion.test.ts`, `tests/golden/provider/iris.json`, `tests/golden/provider/palmer-penguins.json`
- **Must not touch:** `src/**`, `tests/dataset-provider.test.ts`
- Use `tests/helpers/reference-ingest.ts` only if it shares ingestion setup with `tests/reference-ingestion.test.ts`. Limit changes to `tests/reference-ingestion.test.ts` to moving that setup. The upstream checkout is outside this task's scope.
- **Implementation:** Ingest Iris by the upload path and Penguins by the sample path (reuse T3/T4 setup through a small shared function inside the test files, or move it to `tests/helpers/reference-ingest.ts` if both files need it). Create `IndexedDBDatasetProvider` with the _Provider configurations_, load into correctly sized buffers, split features into rows and compare with `provider/<id>.json`. Invariants: `sampleCount` equals `rowCount`; Iris `featureNames` equal the four feature columns and `targetCategories` the three class names in sorted order; Penguins `featureNames` include `island=Biscoe`, `island=Dream`, `island=Torgersen` and each row has exactly one 1 in the island block and in the sex block; no feature value is `NaN`; target counts per category equal `classCounts`.
- **Acceptance criteria:**
    - [ ] `REF-4 iris` and `REF-4 palmer-penguins` pass without `UPDATE_GOLDEN`.
    - [ ] Penguins rows that had `NA` in a measurement column hold that column's metadata median.
- **Verification:** `bun test tests/reference-provider.test.ts`; `bun run check`
- **Progress:** [ ] Not started

### T6 — Cross-browser conformance with the goldens (`REF-5`)

- **Depends on:** T2, T4
- **Cross-plan prerequisite:** [data-ingestion-and-storage](archive/data-ingestion-and-storage.md) T15 has its progress checked (worker, built catalogue and browser IndexedDB proven). If not, stop and report it.
- **Risk:** needs care — structured-clone results across the page boundary, worker lifetime, and genuine engine differences that must be reported, not hidden.
- **Likely files:** `tests/e2e/storage.ts`, `tests/reference-conformance.e2e.ts`
- **Must not touch:** `tests/storage-worker.e2e.ts`, `playwright.config.ts`, `src/**`
- Add `ingestInWorker` to `tests/e2e/storage.ts`. The data-ingestion plan owns `tests/storage-worker.e2e.ts`. Raise a change if `tests/helpers/golden.ts` needs different rounding rules.
- **Implementation:** `ingestInWorker` imports `StorageRequest`/`StorageResponse` from `src/features/data/ingestion/protocol.ts` and uses the implemented protocol (numeric requestId, discriminated type, result.value, error.error), never the old proposal: inside `page.evaluate`, start `new Worker('/storage.worker.js', { type: 'module' })`, post `ingest` (for `file`, build `new File([text], name, { type: 'text/csv' })`), wait for the result, page through getRows until fewer than the page size come back, accumulating each RawRecord.values (not RawRecord objects) in rowIndex order, reject on worker error/messageerror or a bounded 30 s timeout, terminate in finally, and return `{ metadata, rows }`. Match each numeric requestId, ignore progress when waiting for result, and use a new ID for each getRows request. The suite, for each dataset and each path, runs `openApp(page, '/data')`, `ingestInWorker` (file name `<id>.csv`, text from `readReferenceCsv`), canonicalises with the same redactions, and compares with `readGolden('ingestion/<id>.<upload|sample>.json')`. Also assert `countStoredRows` equals `rowCount`.
- **Acceptance criteria:**
    - [ ] All four `REF-5` cases pass in Chromium.
    - [ ] Firefox and WebKit results are recorded in the log; any difference is reported with the field and both values and escalated, never fixed by loosening rounding or adding per-browser goldens.
    - [ ] The suite never writes under `tests/golden/`.
- **Verification:** `bun run test:e2e tests/reference-conformance.e2e.ts`; `bun run check`
- **Progress:** [ ] Not started

### T7 — Sync specification

- **Depends on:** T1, T2, T3, T4, T5, T6
- **Risk:** needs care — specs must describe what was built, not what was planned
- **Likely files:** `specification/testing.md`, `specification/README.md`
- **Must not touch:** `src/**`, `tests/**`, `specification/mockups/` — preserve all product code and the undecided Known gap 5 rule in `specification/testing.md`.
- **Implementation:** Apply every item under _Specification changes_, following "Writing specs" in `specification/README.md`. Where the log records a deviation from the plan, document the deviation, not the plan. Update testing.md's status line and its row in the index.
- **Acceptance criteria:**
    - [ ] Every item under _Specification changes_ is applied and ticked.
    - [ ] No changed spec contradicts the code or another spec, or mentions this plan, its tasks or the history of the change.
    - [ ] `bun run plans:check` reports no spec index mismatch.
- **Verification:** `bun run plans:check`; `git diff specification/` reviewed against _Specification changes_
- **Progress:** [ ] Not started

## Verification and definition of done

- [ ] All task acceptance criteria met.
- [ ] `bun run check` passes with 0 type errors and no failures; the test count is the fresh baseline (review: 144) plus this plan's tests.
- [ ] `bun run test:e2e tests/e2e-helpers.e2e.ts tests/reference-conformance.e2e.ts` passes in Chromium; Firefox and WebKit results recorded.
- [ ] Record golden suite runtime using `bun test tests/reference-ingestion.test.ts tests/reference-provider.test.ts`; target under 2 s excluding cold generator setup. Report excess rather than making machine-dependent timing a flaky assertion.
- [ ] No file under `src/`, `scripts/` or `content/` changed (`git diff --stat`).
- [ ] Every item under _Specification changes_ is ticked, and the specs describe the code as built.
- [ ] No unintended changes outside the tasks' likely files.

## Risks and open questions

- **Blocking:** None.
- **Non-blocking:**
    - **Sequencing.** All data-ingestion prerequisites are now implemented. T1/T2 can run independently; T3–T6 follow their local dependencies. Owner: implementer.
    - **Golden churn.** Every deliberate change to inference or statistics will update goldens. That is intended, but reviewers must read the diff rather than re-run `UPDATE_GOLDEN=1` reflexively; the explicit invariants (D5) are the backstop. Owner: reviewer.
    - **Engine differences.** 12-significant-digit rounding absorbs last-bit differences; a value exactly on a rounding boundary could still differ. If T6 hits one, escalate rather than widening the tolerance.
    - **Journeys are now owned.** Step 1 T6 creates both reference journeys; Step 2 T3 and Step 3 T5 extend them in order. This plan provides helpers and the lasting testing rule, not duplicate journey files.
    - **No CI (Known gap 7).** These tests only prevent regressions if they run. `bun run check` covers the Bun goldens; the Playwright suites must be run by hand until CI exists. Owner: human.
    - **Binary-target reference.** Neither dataset has a binary target, positive class or identifier column. Add `titanic` (or similar) as a third reference when Step 4 results exist. Owner: a later plan.

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

| When (UTC)           | Change                                                                                                                                              | Reason                                                                                                                                                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-13T15:24:00Z | Initial draft                                                                                                                                       | User request: regression tests using the sample datasets (Iris, Penguins) to back up unit tests as the app grows.                                                                                                               |
| 2026-11-13T18:47:40Z | Reviewed implemented APIs, corrected startup-db assumption, fetch seam and worker protocol; linked owned journeys                                   | Review request; baseline now 144 passing tests.                                                                                                                                                                                 |
| 2026-11-13T16:38:05Z | Cross-reference only: data-ingestion-and-storage renumbered its browser e2e task from T14 to T15; every reference here updated. No change of scope. | data-ingestion-and-storage revision of 2026-11-13T16:38:05Z                                                                                                                                                                     |
| 2026-11-19T10:41:31Z | Migrated header to v2 (Claude Code, claude-opus-5-5)                                                                                                | Pre-v2 plan migrated to the v2 header; remains draft.                                                                                                                                                                           |
| 2026-11-26T09:03:13Z | Normalised task scope                                                                                                                               | Adapted the path-list cleanup from the independently audited workflow-records adoption at `76a4370`. The existing app-shell and no-upstream-write boundaries remain explicit. The fixture-source decision stays with the draft. |
