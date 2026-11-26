# Beta test robustness, E2E hardening and advisory quality checks

**Status:** draft | **Updated:** 2026-11-26T09:19:54Z
**Authors:** Google Antigravity (Gemini 4 Neon High) | **Created:** 2026-11-26T08:51:44Z
**Verified by:** — | **Verified:** — | **Verification:** changes-requested
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour:** In `samata-ml`, automated WCAG compliance checks (`tests/a11y.e2e.ts`, inline `AxeBuilder` calls across 14 functional E2E suites, and `.storybook/preview.ts` `a11y: { test: 'error' }`) and mockup visual-parity assertions (`tests/visual-parity.e2e.ts` and the `<main>` padding check in `PH-AC-2` at `tests/app-shell.e2e.ts#L1201-L1239`) run as hard-failing errors in the blocking CI pipeline (`.github/workflows/ci.yml`). Because the project is in beta, 19 tests are suppressed in `tests/known-failures.ts` (10 visual parity, 5 stale hardcoded dataset/mockup counts, 1 duplicated layout check, 2 Chromium timing flakes, and 1 Firefox `AxeBuilder` crash), while additional browser E2E flakes (`WML-P4-UI-7`, `FOCUS-AC-5`, `TERM-AC-1`) and Firefox Nightly `AxeBuilder` `signal 11` crashes still interrupt functional verification.

**Target behaviour:** Blocking CI checks (`verify` and 3-browser `e2e`, gating `deploy`) enforce **functional robustness in expected use cases** — core user workflows, data ingestion, persistence, worker training, routing, CSP/console hygiene, token hygiene, and Storybook interaction tests — with **zero** entries in `KNOWN_FAILURES`. Automated WCAG audits and mockup visual-parity checks remain active as **non-blocking warnings** during beta: Storybook reports `@storybook/addon-a11y` findings as `'todo'` warnings, inline `AxeBuilder` scans in functional E2E tests emit Chromium-only warning annotations without failing functional tests (and skip Firefox/WebKit in beta mode), and a dedicated non-blocking Chromium `advisory` CI job (`continue-on-error: true`, outside `deploy.needs`) runs `tests/visual-parity.e2e.ts` and `tests/a11y.e2e.ts` so visual and WCAG drift stays visible without blocking beta deploys. A single environment toggle (`SAMATA_ADVISORY_CHECKS=error`) restores strict V1 error enforcement across all three layers.

**Why:** Shipping a reliable beta requires high-signal tests that catch real user-facing errors without red-lighting CI over cosmetic mockup iterations, aspirational WCAG gaps, hardcoded inventory counts, or timing races in test harnesses.

## Scope

**In scope**

- Introduce a single severity toggle (`SAMATA_ADVISORY_CHECKS`: `'warn'` default in beta, `'error'` for strict V1 runs) governing Storybook a11y (`'todo'` vs `'error'`), inline Playwright `AxeBuilder` checks, and E2E tiering.
- Add shared E2E helpers under `tests/helpers/` for advisory `AxeBuilder` execution (Chromium-only non-blocking warnings in beta; strict in `'error'` mode), async reserved-modal dismissal, persisted-state settlement before reload, and dynamic catalogue/mockup index counts.
- Route inline `AxeBuilder` scans in the 14 mixed functional E2E files through the advisory helper so functional assertions remain blocking in Chromium, Firefox, and WebKit while WCAG findings warn without failing or crashing Firefox.
- Harden and repair all remaining non-visual flaky or stale-count functional E2E tests (`DATA-FLOW-2`, `DATA-UP-2`, `MOCKUP-REVIEW-1..3`, `PH-AC-2`, `DATA-PRE-2`, `WML-P2-ROUTE-2`, `TERM-AC-1`, `WML-P4-UI-7`, `FOCUS-AC-5`) and empty `KNOWN_FAILURES` (`[]`).
- Add `test:e2e:blocking` and `test:e2e:advisory` scripts, update `playwright.config.ts`, split `.github/workflows/ci.yml` into blocking 3-browser `e2e` and non-blocking Chromium `advisory` (`continue-on-error: true`), and update `tests/ci-workflow.test.ts` and `tests/known-failures.test.ts`.
- Sync `specification/testing.md`, `specification/visual-design.md`, `specification/HUMAN.md`, and `AGENTS.md` to document the beta blocking vs advisory tiers and the V1 strict-mode switch.

**Out of scope**

- Modifying production application behaviour, UI components, stores, workers, or styles under `src/`, `css/`, or `content/` (unless a genuine functional product bug is uncovered during `DATA-PRE-2` or `WML-P2-ROUTE-2`, in which case escalate per `/implement` rules rather than expanding scope).
- Resolving the underlying V1 visual-parity CSS/layout gaps (such as removing shared `<main>` padding or committing Linux `SIDE-AC-10` PNG baselines) or the 23 contrast findings in `tests/a11y-feature-findings.ts` — these remain queued for V1 in `specification/HUMAN.md`.
- Editing `specification/mockups/` or `vendor/web-ml/`.
- Implementing the upstream guidance changes inside `../agent-workflow` (tracked separately via `../agent-workflow/specification/requests/2026-11-26-tiered-test-severity-and-e2e-hardening-guidance.md`).

**Constraints and invariants**

- Blocking functional guarantees must never be weakened: all unit tests (`bun run check`), TypeScript checks, TSDoc lint, static CSP/token guards (`tests/style-tokens.test.ts`), production bundle validation (`bun run deploy:dry-run`), Storybook interaction tests (`bun run test:stories`), and functional Playwright E2E assertions across Chromium, Firefox, and WebKit remain hard errors.
- No production code under `src/`, `css/`, `content/`, or `public/` is modified by this plan.
- No new npm/Bun dependencies or third-party GitHub Actions are introduced; `.github/workflows/ci.yml` preserves 40-character SHA pins, `permissions: { contents: read }`, vendored tarball checksum verification, and zero `${{` interpolation in `run` scripts.
- Running `bun run test:e2e <file>` directly without `SAMATA_E2E_TIER=blocking` continues to execute any explicitly targeted file (including `tests/visual-parity.e2e.ts` and `tests/a11y.e2e.ts`) without silent skipping.
- Setting `SAMATA_ADVISORY_CHECKS=error` restores strict error behaviour for Storybook a11y, inline `AxeBuilder` checks, and dedicated advisory suites without code edits.
- All test URLs come from `scripts/ports.ts` (`tests/test-server-urls.test.ts` invariant preserved).
- All exported TypeScript in `tests/` / `scripts/` / `.storybook/` stays strictly typed (no `any` or `@ts-ignore`) and formatted with Prettier (`bun run format`).

## Required reading

- `AGENTS.md` § Verification Commands, § Rules — registered verification commands and style/token rules.
- `specification/testing.md` — current test layers, E2E expectations, and server/checkout rules.
- `specification/visual-design.md` § 6 — current visual parity and accessibility verification contracts.
- `specification/HUMAN.md` § 1 — tracked known-failure items to reconcile in T5.
- `playwright.config.ts`, `.storybook/main.ts`, `.storybook/preview.ts`, `.github/workflows/ci.yml` — test runner and CI configuration.
- `tests/known-failures.ts`, `tests/known-failures.test.ts`, `tests/ci-workflow.test.ts` — CI and known-failure invariants.

## Codebase context

Facts verified by `codebase-scout`:

- **Relevant specifications:** `specification/testing.md` (status `partial`) documents unit, story, E2E, visual parity, and a11y suites; `specification/visual-design.md` § 6 (status `partial`) specifies parity and axe verification; `specification/HUMAN.md` § 1 tracks the 19 `KNOWN_FAILURES` items.
- **Relevant implementation:**
  - `.github/workflows/ci.yml#L1-L145` — `verify`, 3-browser `e2e` (`SAMATA_SKIP_KNOWN_FAILURES: '1'`), and `deploy` (`needs: [verify, e2e]`).
  - `playwright.config.ts#L1-L64` — `chromium`, `firefox`, `webkit` projects with `projectGrepInvert(name)` and 3 `webServer` entries from `scripts/ports.ts`.
  - `.storybook/preview.ts#L16-L21` — hardcodes `parameters.a11y: { test: 'error' }`; `.storybook/main.ts#L9-L14` injects Vite `define` constants via `viteFinal`.
  - `package.json#L6-L36` — `test`, `test:e2e`, `test:stories`, `audit:mockups`, `check`, `typecheck`, `lint`, `format`, `format:check`.
  - `src/features/data/sample-datasets.ts#L9-L34` and `scripts/generate-datasets.ts#L531-L553` — authoritative sample dataset catalogue served at `/datasets/index.json` (`{ version: 1, entries }`, currently 11 entries).
  - `scripts/serve-mockups.ts#L168-L203,L656-L661` — authoritative mockup catalogue served at `MOCKUPS_URL + '/index.json'` (currently 29 entries).
  - `src/stores/persister.ts#L956-L969,L1048,L1128,L1270-L1279,L1323` — `selectedColumn` triggers `writeAppStateNow`, which under `protectedPersistence` performs async `writeOrdinaryGuarded`; `pagehide` (`flushNow`) only flushes pending timers, explaining why `DATA-PRE-2` can race `page.reload()`.
- **Tests and commands:**
  - `tests/known-failures.ts#L33-L168` (19 entries) and `tests/known-failures.test.ts#L88-L147` (`REL-KF-1`, validates `HUMAN.md` references and 1-to-1 Playwright `--list` filtering).
  - `tests/ci-workflow.test.ts#L53-L271` (`REL-CI-1`, validates `.github/workflows/ci.yml` pins, step order, env vars, matrix, and `deploy` gates).
  - `tests/a11y.e2e.ts#L1-L544` (dedicated WCAG suite using `AXE_TAGS` and `tests/a11y-feature-findings.ts#L21-L304`) plus 14 mixed functional E2E files importing `@axe-core/playwright` (`tests/app-shell.e2e.ts`, `tests/sidebar-acceptance.e2e.ts`, `tests/content-dialog.e2e.ts`, `tests/welcome-acceptance.e2e.ts`, `tests/telemetry-acceptance.e2e.ts`, `tests/virtual-table.e2e.ts`, `tests/model-card.e2e.ts`, `tests/model-configuration.e2e.ts`, `tests/models-overview.e2e.ts`, `tests/models-setup.e2e.ts`, `tests/training-panels.e2e.ts`, `tests/results-summary.e2e.ts`, `tests/results-errors.e2e.ts`, `tests/results-probability.e2e.ts`).
  - `tests/visual-parity.e2e.ts#L1-L395` & `tests/visual-parity/map.ts#L1-L748` (Chromium 1440×900 parity suite, 48 mapped entries + `SIDE-AC-10` `maxDiffPixels: 0` + `SIDE-AC-11` + `DOT-AC-7`).
  - Brittle/stale tests: `tests/app-shell.e2e.ts#L1201-L1273` (`PH-AC-2`), `#L974-L1003` (`FOCUS-AC-5`); `tests/content.e2e.ts#L7-L38` (`TERM-AC-1`), `#L135-L182` (`WML-P2-ROUTE-2`); `tests/results-probability.e2e.ts#L142-L165` (`WML-P4-UI-7`); `tests/data-preview.e2e.ts#L249-L321` (`DATA-PRE-2`); `tests/data-flow.e2e.ts#L81-L129` (`DATA-FLOW-2`); `tests/data-upload.e2e.ts#L200-L230` (`DATA-UP-2`); `tests/mockup-review.e2e.ts#L9-L128` (`MOCKUP-REVIEW-1..3`).
  - Existing shared helpers: `tests/journeys/helpers.ts` (`dismissWelcomeModal`, `loadSampleDataset`), `tests/helpers/seed-results.ts`.
  - Baseline: `bun run check` (682/682 pass), `bun run lint` (pass), `bun test tests/style-tokens.test.ts` (11/11 pass).
- **Web guidance:** None — no browser platform APIs are being newly implemented; changes are test-harness, Storybook, and CI configuration.
- **Visual reference:** None — no UI appearance changes.
- **Domain skills:** None — no Lit components, datasets, or upstream `web-ml` contracts are modified.
- **Assumptions requiring verification:** Verify during T3 whether `DATA-PRE-2` and `WML-P2-ROUTE-2` pass reliably in Chromium solely by awaiting async state/modal settlement in the tests, or whether a subtle production persistence timing issue exists in `src/stores/persister.ts` (escalate if product code needs a fix).

## Technical decisions

| Decision                                               | Chosen approach and rationale                                                                                                                                                                                                                                                                                                                                      | Rejected alternative / trade-off                                                                                                                                                                                                                    |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1: Beta warning vs V1 strict toggle                   | Single env var `SAMATA_ADVISORY_CHECKS` (`'warn'` default during beta; `'error'` for strict V1 checks) governing Storybook a11y and inline Playwright `AxeBuilder` checks, plus `SAMATA_E2E_TIER=blocking` for Playwright file selection.                                                                                                                          | Disabling visual-parity and a11y completely until V1 loses early visibility of regressions; soft-failing inside the main 3-browser E2E matrix slows blocking CI and retains Firefox Nightly `AxeBuilder` crashes.                                   |
| D2: Separate non-blocking CI `advisory` job            | Add a Chromium-only `advisory` job in `.github/workflows/ci.yml` (`needs: [verify]`, `continue-on-error: true`, omitted from `deploy.needs`) running `bun run test:e2e:advisory` with `SAMATA_ADVISORY_CHECKS: 'error'`.                                                                                                                                           | Running advisory specs with `continue-on-error` inside `e2e` would mask real functional failures in the same job; running them with `warn` mode would hide the GitHub Actions warning badge on the advisory job.                                    |
| D3: Browser matrix split during beta                   | Blocking functional E2E (`test:e2e:blocking`) runs across `chromium`, `firefox`, and `webkit`. Advisory visual parity (`visual-parity.e2e.ts`), dedicated WCAG (`a11y.e2e.ts`), and inline `AxeBuilder` scans run on **Chromium only** in beta (`SAMATA_ADVISORY_CHECKS=warn`).                                                                                    | Running `AxeBuilder` in Firefox triggers reproducible Playwright Firefox Nightly `signal 11` crashes inside `AxeBuilder.runPartialRecursive` while duplicating DOM/ARIA checks already covered on Chromium.                                         |
| D4: Storybook a11y warning mode                        | Inject `__SAMATA_STORYBOOK_A11Y_TEST__` via `.storybook/main.ts` `viteFinal` (`'error'` when `SAMATA_ADVISORY_CHECKS === 'error'`, `'todo'` otherwise) and wire it into `.storybook/preview.ts` `parameters.a11y.test`.                                                                                                                                            | Disabling `@storybook/addon-a11y` hides Storybook accessibility feedback; keeping `'error'` blocks `verify` on contrast/a11y warnings during beta even when all component interactions pass.                                                        |
| D5: Dynamic manifest counts and empty `KNOWN_FAILURES` | Read expected dataset counts from `/datasets/index.json` and mockup counts/status tallies from `MOCKUPS_URL + '/index.json'`, split `PH-AC-2` layout padding out of `app-shell.e2e.ts` (already in `PARITY-main`), harden async races, and empty `KNOWN_FAILURES` to `[]` while keeping the `known-failures.ts` helper intact for any future measured regressions. | Updating hardcoded literals (`12 -> 11`, `26 -> 29`) would break again on every dataset or draft-mockup change; deleting `known-failures.ts` entirely would require re-implementing the mechanism if a future browser bug needs temporary tracking. |
| D6: No new third-party GitHub Actions                  | Rely on Playwright's `list` reporter stdout/stderr and GitHub Actions' native `continue-on-error: true` warning indicator in the `advisory` job rather than introducing an unpinned `actions/upload-artifact` dependency.                                                                                                                                          | Adding a new action increases supply-chain pin maintenance and requires verifying a new 40-char commit SHA outside the existing approved workflow pins.                                                                                             |

### Interfaces and behaviour

#### 1. `tests/helpers/advisory-a11y.ts`

```ts
import type { Page, TestInfo } from '@playwright/test';

/** Severity mode for beta-advisory accessibility checks. */
export type AdvisoryCheckMode = 'warn' | 'error';

/**
 * Resolves the active advisory check mode from `SAMATA_ADVISORY_CHECKS`.
 * Defaults to `'warn'` during beta; returns `'error'` only when set to `'error'`.
 */
export function advisoryCheckMode(
	env: Record<string, string | undefined> = process.env
): AdvisoryCheckMode;

/**
 * Executes an accessibility scan callback with tier-aware severity handling.
 * - In `'warn'` mode on non-Chromium browsers (`testInfo.project.name !== 'chromium'`):
 *   skips the scan and adds an `'a11y-skipped'` annotation without failing.
 * - In `'warn'` mode on Chromium: runs `scan`; if violations are returned or thrown,
 *   records an `'a11y-warning'` annotation and logs a structured warning without failing.
 * - In `'error'` mode (any browser): runs `scan` and fails via `expect(violations).toEqual([])`.
 */
export async function runAdvisoryAxe<T extends { id: string; nodes?: unknown[] }>(
	testInfo: Pick<TestInfo, 'project' | 'annotations'>,
	scan: () => Promise<readonly T[]>,
	options?: {
		readonly label?: string;
		readonly mode?: AdvisoryCheckMode;
		readonly warn?: (message: string) => void;
	}
): Promise<void>;
```

- When `scan()` returns a non-empty violation list in `'warn'` mode: formats `${label}: ${violations.length} advisory WCAG finding(s) (${ids})`, appends `{ type: 'a11y-warning', description }` to `testInfo.annotations`, and calls `warn(description)` (defaulting to `console.warn`).
- When `scan()` throws in `'warn'` mode (for example a transient axe runtime error): appends `{ type: 'a11y-warning', description }` and logs a warning without failing the functional test.
- When `mode === 'error'`: rethrows scan errors and fails the test with an informative assertion message listing the rule IDs and counts if `violations.length > 0`.

#### 2. `tests/helpers/e2e-settlement.ts`

```ts
import type { Locator, Page } from '@playwright/test';

/**
 * Waits for a reserved content modal dialog to hide and for `history.back()` to restore
 * the expected underlay URL before subsequent test actions run.
 */
export async function expectReservedModalClosed(
	page: Page,
	modal: Locator,
	underlayUrl: RegExp | string
): Promise<void>;

/**
 * Polls `localStorage.getItem('samata-ml:state')` until the parsed JSON satisfies `predicate`,
 * preventing `page.reload()` from racing asynchronous guarded persistence writes.
 */
export async function waitForPersistedAppState(
	page: Page,
	predicate: (state: Record<string, unknown>) => boolean
): Promise<void>;

/**
 * Fetches `/datasets/index.json` via `page.request` and returns the authoritative sample count.
 */
export async function fetchSampleDatasetCount(page: Page): Promise<number>;

/**
 * Fetches `${mockupsUrl}/index.json` via `page.request` and returns parsed mockup metadata entries.
 */
export async function fetchMockupIndex(
	page: Page,
	mockupsUrl: string
): Promise<ReadonlyArray<{ filename: string; name: string; description: string; status: string }>>;
```

#### 3. Playwright & `package.json` tier selection

- `playwright.config.ts`:
  - Defines `const ADVISORY_SPEC_FILES = ['**/visual-parity.e2e.ts', '**/a11y.e2e.ts'];`.
  - When `process.env.SAMATA_E2E_TIER === 'blocking'`, sets `testIgnore: ADVISORY_SPEC_FILES` on the Playwright config so blocking runs execute all functional, journey, security, CSP, router, focus, and storage specs without running visual parity or dedicated WCAG audits.
  - When `SAMATA_E2E_TIER` is unset (ordinary local `bun run test:e2e [file]`), `testIgnore` is omitted so any explicitly requested file runs normally.
- `package.json`:
  - Keeps `"test:e2e": "playwright test"`.
  - Adds `"test:e2e:blocking": "SAMATA_E2E_TIER=blocking playwright test"`.
  - Adds `"test:e2e:advisory": "playwright test tests/visual-parity.e2e.ts tests/a11y.e2e.ts --project=chromium"`.

#### 4. `.github/workflows/ci.yml` job graph

- `verify` (blocking): unchanged step sequence (`lint`, Playwright browser install, `check`, `deploy:dry-run`, `test:stories` — where Storybook a11y defaults to `'todo'` warnings while interaction assertions remain blocking).
- `e2e` (blocking, `needs: [verify]`, `matrix.project: [chromium, firefox, webkit]`): runs `bun run test:e2e:blocking --project="$PROJECT"` with `PROJECT`, `SAMATA_SKIP_KNOWN_FAILURES: '1'`, and `SAMATA_ADVISORY_CHECKS: 'warn'`.
- `advisory` (non-blocking, `needs: [verify]`, `continue-on-error: true`, `timeout-minutes: 30`, `concurrency: advisory-${{ github.ref }}`, `cancel-in-progress: ${{ github.event_name == 'pull_request' }}`): installs `chromium` only and runs `bun run test:e2e:advisory` with `SAMATA_ADVISORY_CHECKS: 'error'`.
- `deploy` (blocking on `[verify, e2e]` only — `advisory` is intentionally excluded from `deploy.needs`): unchanged Cloudflare beta deployment on pushes to `main`.

## Specification changes

- [ ] `specification/testing.md` § Unit and Component Testing, § End-to-End (E2E) Testing — Document the beta two-tier severity model (blocking functional/CSP/token/interaction checks vs advisory visual-parity and WCAG warnings via `SAMATA_ADVISORY_CHECKS`, `test:e2e:blocking`, `test:e2e:advisory`, and Storybook `a11y.test` `'todo'`/`'error'`), the Chromium-only scope for advisory checks during beta, and the browser E2E settlement rules; status `partial` → `partial`.
- [ ] `specification/visual-design.md` § 6 — State that during beta, `tests/visual-parity.e2e.ts` and `tests/a11y.e2e.ts` run in the non-blocking Chromium advisory suite (`test:e2e:advisory`) while static token/CSP guards (`tests/style-tokens.test.ts`) remain blocking, and that `SAMATA_ADVISORY_CHECKS=error` restores strict V1 enforcement; status `partial` → `partial`.
- [ ] `specification/HUMAN.md` § 1 — Remove resolved blocking known-failure items (`Update stale dataset-count and mockup-count E2E expectations`, `Repair Chromium content-modal and data-preview E2E failures`, `Fix intermittent full-suite Firefox crash in remote training recovery`), note that visual parity / `SIDE-AC-10` / `PH-AC-2` main-padding items are tracked in the advisory suite pending V1 promotion rather than suppressed in `KNOWN_FAILURES`, and record a pointer to the `agent-workflow` testing-guidance request (`../../agent-workflow/specification/requests/2026-11-26-tiered-test-severity-and-e2e-hardening-guidance.md`).
- [ ] `AGENTS.md` § Verification Commands, § Rules — Document `bun run test:e2e:blocking`, `bun run test:e2e:advisory`, `SAMATA_ADVISORY_CHECKS`, and the beta functional-first severity rule (blocking functional tests vs advisory visual/WCAG warnings) for future agents.

## Implementation tasks

### T1 — Add shared advisory-a11y and E2E settlement helpers and Storybook beta a11y toggle

- **Depends on:** None
- **Risk:** routine
- **Likely files:** `tests/helpers/advisory-a11y.ts`, `tests/helpers/e2e-settlement.ts`, `tests/advisory-a11y.test.ts`, `.storybook/main.ts`, `.storybook/preview.ts`, `.storybook/env.d.ts`
- **Must not touch:** `src/`, `css/`, `content/`, `public/`, `specification/mockups/`, `vendor/` — production code and mockups stay unchanged.
- **Implementation:**
  1. Create `tests/helpers/advisory-a11y.ts` exporting `AdvisoryCheckMode`, `advisoryCheckMode()`, and `runAdvisoryAxe()` with TSDoc and strict TypeScript types matching § Interfaces and behaviour.
  2. Create `tests/helpers/e2e-settlement.ts` exporting `expectReservedModalClosed()`, `waitForPersistedAppState()`, `fetchSampleDatasetCount()`, and `fetchMockupIndex()` with TSDoc and strict types (reading URLs only from arguments or `scripts/ports.ts`, never hardcoded `localhost:3000`/`3333`).
  3. Create `tests/advisory-a11y.test.ts` covering: default `'warn'` mode when unset; `'error'` mode when `SAMATA_ADVISORY_CHECKS='error'`; Chromium `'warn'` mode recording `'a11y-warning'` annotations and calling `warn` without throwing on violations or scan errors; non-Chromium `'warn'` mode skipping `scan()` and recording `'a11y-skipped'`; `'error'` mode failing on violations and rethrowing scan errors across all browser names.
  4. Update `.storybook/main.ts` (`viteFinal`) to define `__SAMATA_STORYBOOK_A11Y_TEST__` as `JSON.stringify(process.env.SAMATA_ADVISORY_CHECKS === 'error' ? 'error' : 'todo')`, declare the constant type in `.storybook/env.d.ts` (included by `tsconfig.json`), and update `.storybook/preview.ts` to use `a11y: { test: __SAMATA_STORYBOOK_A11Y_TEST__ }`.
- **Acceptance criteria:**
  - [ ] `advisoryCheckMode()` defaults to `'warn'` and returns `'error'` only when `SAMATA_ADVISORY_CHECKS === 'error'`.
  - [ ] `runAdvisoryAxe()` skips non-Chromium scans in `'warn'` mode with an `'a11y-skipped'` annotation, warns without throwing on Chromium violations or scan exceptions in `'warn'` mode, and fails deterministically in `'error'` mode.
  - [ ] `bun run test:stories` passes with Storybook `a11y.test` defaulting to `'todo'` while retaining all story interaction assertions.
  - [ ] `bun run check`, `bun run lint`, and `bun test tests/advisory-a11y.test.ts` pass.
- **Verification:** `bun test tests/advisory-a11y.test.ts`, `bun run check`, `bun run lint`, `bun run test:stories`, `bun run format:check tests/helpers/advisory-a11y.ts tests/helpers/e2e-settlement.ts tests/advisory-a11y.test.ts .storybook/main.ts .storybook/preview.ts .storybook/env.d.ts`
- **Progress:** [ ] Not started

### T2 — Route inline `AxeBuilder` checks in mixed functional E2E suites through `runAdvisoryAxe`

- **Depends on:** T1
- **Risk:** needs care — touches 14 E2E spec files; must preserve every functional, keyboard, focus, RTL, reflow, and forced-colours assertion while wrapping only the `AxeBuilder` scan step.
- **Likely files:** `tests/app-shell.e2e.ts`, `tests/sidebar-acceptance.e2e.ts`, `tests/content-dialog.e2e.ts`, `tests/welcome-acceptance.e2e.ts`, `tests/telemetry-acceptance.e2e.ts`, `tests/virtual-table.e2e.ts`, `tests/model-card.e2e.ts`, `tests/model-configuration.e2e.ts`, `tests/models-overview.e2e.ts`, `tests/models-setup.e2e.ts`, `tests/training-panels.e2e.ts`, `tests/results-summary.e2e.ts`, `tests/results-errors.e2e.ts`, `tests/results-probability.e2e.ts`
- **Must not touch:** `src/`, `css/`, `tests/a11y.e2e.ts`, `tests/visual-parity.e2e.ts` — keep dedicated advisory suites and production code untouched.
- **Implementation:**
  1. In each of the 14 mixed functional E2E files identified in Codebase context, pass Playwright's `testInfo` fixture into tests that invoke `AxeBuilder` (and into `assertPanelAccessibility(page, testInfo)` in `tests/training-panels.e2e.ts`) and wrap only the `AxeBuilder.analyze()` + violation-filtering assertion inside `runAdvisoryAxe(testInfo, async () => { ... }, { label })`.
  2. Preserve every existing rule filter (such as `color-contrast` or `featureA11yFindings` matching in `model-card.e2e.ts`, `model-configuration.e2e.ts`, `models-overview.e2e.ts`, `models-setup.e2e.ts`) inside the `scan` callback so `SAMATA_ADVISORY_CHECKS=error` retains exact parity with prior strict checks.
  3. Never weaken or remove any functional, keyboard, focus, scroll, reflow, or ARIA-name assertion in any of the 14 files.
- **Acceptance criteria:**
  - [ ] Every inline `AxeBuilder` call across the 14 mixed functional E2E files executes via `runAdvisoryAxe()`.
  - [ ] In Firefox (`SAMATA_ADVISORY_CHECKS=warn`), `tests/training-panels.e2e.ts` and `tests/models-setup.e2e.ts` pass all functional assertions without triggering Firefox Nightly `AxeBuilder` `signal 11` crashes.
  - [ ] In Chromium (`SAMATA_ADVISORY_CHECKS=warn`), functional assertions still fail on real regressions while inline `AxeBuilder` scans execute and emit warnings only on unexpected violations.
  - [ ] Under `SAMATA_ADVISORY_CHECKS=error`, the wrapped scans enforce violations as hard errors identically to before.
- **Verification:** `bun run typecheck`, `bun run test:e2e tests/training-panels.e2e.ts tests/models-setup.e2e.ts --project=firefox`, `bun run test:e2e tests/training-panels.e2e.ts tests/models-setup.e2e.ts --project=chromium`
- **Progress:** [ ] Not started

### T3 — Harden brittle and known-failing functional E2E tests

- **Depends on:** T1, T2
- **Risk:** needs care — fixes asynchronous browser timing races (`DATA-PRE-2`, `WML-P2-ROUTE-2`, `TERM-AC-1`, `WML-P4-UI-7`, `FOCUS-AC-5`), removes hardcoded inventory counts (`DATA-FLOW-2`, `DATA-UP-2`, `MOCKUP-REVIEW-1..3`), and splits the duplicated mockup `<main>` padding check out of `PH-AC-2`. If `DATA-PRE-2` or `WML-P2-ROUTE-2` still fails after awaiting async persistence/navigation settlement, stop and escalate rather than modifying `src/`.
- **Likely files:** `tests/data-flow.e2e.ts`, `tests/data-upload.e2e.ts`, `tests/mockup-review.e2e.ts`, `tests/app-shell.e2e.ts`, `tests/data-preview.e2e.ts`, `tests/content.e2e.ts`, `tests/results-probability.e2e.ts`
- **Must not touch:** `src/`, `css/`, `content/`, `specification/mockups/`, `tests/visual-parity.e2e.ts` — test hardening only.
- **Implementation:**
  1. **Dynamic dataset counts (`tests/data-flow.e2e.ts` `DATA-FLOW-2`, `tests/data-upload.e2e.ts` `DATA-UP-2`):** Replace hardcoded `toHaveCount(12)` with `const expectedCount = await fetchSampleDatasetCount(page); expect(expectedCount).toBeGreaterThan(0); await expect(cards).toHaveCount(expectedCount);`.
  2. **Dynamic mockup counts (`tests/mockup-review.e2e.ts` `MOCKUP-REVIEW-1..3`):** Fetch `/index.json` via `fetchMockupIndex(page, MOCKUP_SERVER)` to compute `total`, `implementedCount`, and `draftCount` dynamically (`expect(total).toBeGreaterThan(0)` and `expect(implementedCount).toBeGreaterThan(0)` and `expect(draftCount).toBeGreaterThan(0)`), and assert table rows, `#results-count` text, and `#preview-page option` count against those derived values. Rename the first test title from `with all 26 mockups` to `catalogue renders mockup-index table from /index.json with every listed mockup`.
  3. **Split `PH-AC-2` (`tests/app-shell.e2e.ts#L1201-L1273`):** Keep all semantic header/heading/notification assertions and non-padding `<main>` geometry checks (`marginInlineStart`, `minBlockSize`, `boxSizing`) in `PH-AC-2`; remove the duplicated mockup `padding` equality check (mockup `<main>` padding parity belongs exclusively to `PARITY-main` in `tests/visual-parity.e2e.ts`).
  4. **Harden `DATA-PRE-2` (`tests/data-preview.e2e.ts#L310-L321`):** Before `await page.reload()`, call `await waitForPersistedAppState(page, (state) => (state.data as { selectedColumn?: string } | undefined)?.selectedColumn === 'petal length')` so asynchronous guarded persistence completes before reload.
  5. **Harden `WML-P2-ROUTE-2` and `TERM-AC-1` (`tests/content.e2e.ts`):**
     - In `TERM-AC-1` (`#L30-L35`): replace `await expect(dialog).toBeHidden()` with `await expectReservedModalClosed(page, dialog, /\/data$/)` before `await help.tap()`.
     - In `WML-P2-ROUTE-2` (`#L135-L182`): use `dismissWelcomeModal(page)` and `loadSampleDataset(page, 'iris')` from `tests/journeys/helpers.ts` (avoiding unawaited welcome-dismissal and dataset-ingestion races before `page.goto('/target')`), wait for target persistence via `waitForPersistedAppState` before `page.goto('/models')`, and use `expectReservedModalClosed(page, modal, /\/models\/new$/)` on close.
  6. **Harden `WML-P4-UI-7` (`tests/results-probability.e2e.ts#L156-L165`):** Move `slider.fill('0')` + `whenSettled()` and `slider.fill('100')` + `whenSettled()` out of `expect.poll` so `expect.poll` performs only a read-only check on `ruleX(page)`.
  7. **Harden `FOCUS-AC-5` (`tests/app-shell.e2e.ts#L974-L1003`):** Replace one-shot `expect(await outline(heading)).toMatchObject(...)` calls with `await expect.poll(() => outline(heading)).toMatchObject(...)`.
- **Acceptance criteria:**
  - [ ] `DATA-FLOW-2`, `DATA-UP-2`, `MOCKUP-REVIEW-1..3`, `PH-AC-2`, `DATA-PRE-2`, `WML-P2-ROUTE-2`, `TERM-AC-1`, `WML-P4-UI-7`, and `FOCUS-AC-5` all pass without `SAMATA_SKIP_KNOWN_FAILURES=1` across Chromium, Firefox, and WebKit (3/3 repeats on `WML-P4-UI-7`, `DATA-PRE-2`, `WML-P2-ROUTE-2`, `TERM-AC-1`, and `FOCUS-AC-5` in Chromium).
  - [ ] No test in the modified files hardcodes literal dataset (`12`/`11`) or mockup (`26`/`29`) counts.
  - [ ] `tests/test-server-urls.test.ts` continues to pass.
- **Verification:** `bun run test:e2e tests/data-flow.e2e.ts tests/data-upload.e2e.ts tests/mockup-review.e2e.ts tests/data-preview.e2e.ts tests/content.e2e.ts tests/results-probability.e2e.ts tests/app-shell.e2e.ts --grep "DATA-FLOW-2|DATA-UP-2|catalogue renders|client-side search|normal preview|PH-AC-2|DATA-PRE-2|WML-P2-ROUTE-2|TERM-AC-1|WML-P4-UI-7: the rule moves|FOCUS-AC-5: heading outlines"`, `bun test tests/test-server-urls.test.ts`
- **Progress:** [ ] Not started

### T4 — Separate blocking and advisory E2E tiers, empty `KNOWN_FAILURES`, and update CI workflow

- **Depends on:** T2, T3
- **Risk:** needs care — modifies `playwright.config.ts`, `package.json`, `tests/known-failures.ts`, `tests/known-failures.test.ts`, `.github/workflows/ci.yml`, and `tests/ci-workflow.test.ts`; must preserve all CI security/pinning invariants and ensure `deploy` depends only on blocking `[verify, e2e]`.
- **Likely files:** `playwright.config.ts`, `package.json`, `tests/known-failures.ts`, `tests/known-failures.test.ts`, `.github/workflows/ci.yml`, `tests/ci-workflow.test.ts`
- **Must not touch:** `src/`, `css/`, `content/`, `vendor/`, `bun.lock` — no dependency or product-code edits.
- **Implementation:**
  1. Update `playwright.config.ts` to add `testIgnore: process.env.SAMATA_E2E_TIER === 'blocking' ? ['**/visual-parity.e2e.ts', '**/a11y.e2e.ts'] : undefined` while preserving existing `projectGrepInvert` support and `webServer` configuration.
  2. Update `package.json` scripts to add `"test:e2e:blocking": "SAMATA_E2E_TIER=blocking playwright test"` and `"test:e2e:advisory": "playwright test tests/visual-parity.e2e.ts tests/a11y.e2e.ts --project=chromium"`.
  3. Empty `KNOWN_FAILURES` in `tests/known-failures.ts` (`export const KNOWN_FAILURES: readonly KnownFailure[] = [];`), retaining the exported types and `knownFailureGrep()` utility (plus an optional `entries` parameter defaulting to `KNOWN_FAILURES` so unit tests can exercise matching behaviour cleanly even when `KNOWN_FAILURES` is empty).
  4. Update `tests/known-failures.test.ts` to verify:
     - `KNOWN_FAILURES` is empty (or every future entry maps to `specification/HUMAN.md` and removes exactly one spec per project/platform under `SAMATA_E2E_TIER=blocking`).
     - `knownFailureGrep()` returns `undefined` when empty and builds exact anchored regexes for synthetic entries.
     - `SAMATA_E2E_TIER=blocking` excludes `visual-parity.e2e.ts` and `a11y.e2e.ts` while retaining all functional suites, and unflagged `playwright test --list` still includes both advisory files.
  5. Update `.github/workflows/ci.yml`:
     - In `e2e`: set `SAMATA_ADVISORY_CHECKS: 'warn'` alongside `PROJECT` and `SAMATA_SKIP_KNOWN_FAILURES: '1'`, and run `bun run test:e2e:blocking --project="$PROJECT"`.
     - Add `advisory` job (`name: Advisory (Visual Parity & WCAG)`, `needs: [verify]`, `runs-on: ubuntu-24.04`, `timeout-minutes: 30`, `continue-on-error: true`, `concurrency: { group: advisory-${{ github.ref }}, cancel-in-progress: ${{ github.event_name == 'pull_request' }} }`) using the exact same SHA-pinned checkout/checksum/setup-bun/install steps, installing `chromium` only, and running `bun run test:e2e:advisory` with `SAMATA_ADVISORY_CHECKS: 'error'`.
     - Keep `deploy` `needs: [verify, e2e]` (never `advisory`).
  6. Update `tests/ci-workflow.test.ts` (`collectWorkflowViolations` and regression tests) to enforce:
     - All existing security/pin/checksum/`verify`/`deploy` invariants.
     - `e2e` runs `bun run test:e2e:blocking --project="$PROJECT"` with `SAMATA_ADVISORY_CHECKS: 'warn'` and `SAMATA_SKIP_KNOWN_FAILURES: '1'`.
     - `advisory` has `needs: ['verify']`, `continue-on-error: true`, installs `chromium`, runs `bun run test:e2e:advisory` with `SAMATA_ADVISORY_CHECKS: 'error'`, and is NOT in `deploy.needs`.
     - Regression test confirms adding `advisory` to `deploy.needs`, omitting `continue-on-error: true`, or breaking pins fails `collectWorkflowViolations`.
- **Acceptance criteria:**
  - [ ] `KNOWN_FAILURES` has length `0`.
  - [ ] `bun test tests/known-failures.test.ts tests/ci-workflow.test.ts` passes.
  - [ ] `bun run test:e2e:blocking --project=chromium`, `bun run test:e2e:blocking --project=firefox`, and `bun run test:e2e:blocking --project=webkit` pass with 0 failures.
  - [ ] `SAMATA_ADVISORY_CHECKS=error bun run test:e2e:advisory` runs `tests/visual-parity.e2e.ts` and `tests/a11y.e2e.ts` in Chromium (reporting any known V1 visual-parity/contrast diffs without blocking `test:e2e:blocking`).
- **Verification:** `bun test tests/known-failures.test.ts tests/ci-workflow.test.ts`, `bun run check`, `bun run test:e2e:blocking --project=chromium`, `bun run test:e2e:blocking --project=firefox`, `bun run test:e2e:blocking --project=webkit`
- **Progress:** [ ] Not started

### T5 — Sync specifications, `AGENTS.md`, and `specification/HUMAN.md`

- **Depends on:** T4
- **Risk:** routine
- **Likely files:** `specification/testing.md`, `specification/visual-design.md`, `specification/HUMAN.md`, `AGENTS.md`
- **Must not touch:** `src/`, `css/`, `tests/`, `specification/mockups/` — documentation sync only.
- **Implementation:**
  1. Update `specification/testing.md` (present tense, no history) to describe the blocking vs advisory beta test tiers, `test:e2e:blocking`, `test:e2e:advisory`, `SAMATA_ADVISORY_CHECKS` (`warn` default vs `error` for V1), Storybook `'todo'`/`'error'` a11y mode, Chromium-only advisory scope, and E2E settlement/dynamic-count rules.
  2. Update `specification/visual-design.md` § 6 to record that visual-parity and WCAG automated suites run as non-blocking Chromium advisory checks during beta (`test:e2e:advisory`) while `tests/style-tokens.test.ts` remains blocking, and that `SAMATA_ADVISORY_CHECKS=error` restores strict V1 enforcement.
  3. Update `specification/HUMAN.md` § 1: remove the resolved items (`Update stale dataset-count and mockup-count E2E expectations`, `Repair Chromium content-modal and data-preview E2E failures`, `Fix intermittent full-suite Firefox crash in remote training recovery`), update the V1 visual-parity / `SIDE-AC-10` / main-padding items to reference the advisory suite instead of `tests/known-failures.ts`, and add a non-blocking pointer to `../../agent-workflow/specification/requests/2026-11-26-tiered-test-severity-and-e2e-hardening-guidance.md`. Refresh `**Updated:**`.
  4. Update `AGENTS.md` § Verification Commands and § Rules with `bun run test:e2e:blocking`, `bun run test:e2e:advisory`, and a concise beta severity rule (blocking functional checks vs advisory visual/WCAG warnings) so future agents follow the policy consistently.
- **Acceptance criteria:**
  - [ ] Every item under `## Specification changes` is satisfied and ticked.
  - [ ] `specification/README.md` status column matches every modified spec's `**Status:**` header.
  - [ ] `bun run plans:check`, `bun run check`, `bun run lint`, `bun run deploy:dry-run`, `bun run test:stories`, and `bun run format:check` on all changed files pass.
- **Verification:** `bun run plans:check specification/plans/beta-test-robustness-and-advisory-checks.md`, `bun run check`, `bun run lint`, `bun run deploy:dry-run`, `bun run test:stories`, `bun run format:check specification/testing.md specification/visual-design.md specification/HUMAN.md AGENTS.md`
- **Progress:** [ ] Not started

## Verification and definition of done

- [ ] All task acceptance criteria met (T1–T5).
- [ ] `bun run check`, `bun run lint`, `bun test tests/style-tokens.test.ts`, `bun run deploy:dry-run`, and `bun run test:stories` pass with 0 failures.
- [ ] `bun run test:e2e:blocking --project=chromium`, `bun run test:e2e:blocking --project=firefox`, and `bun run test:e2e:blocking --project=webkit` pass with 0 failures and `KNOWN_FAILURES` empty.
- [ ] `bun run test:e2e:advisory` executes `tests/visual-parity.e2e.ts` and `tests/a11y.e2e.ts` in Chromium without affecting blocking gates.
- [ ] `bun run format:check` passes on all modified files.
- [ ] Every item under _Specification changes_ is ticked, and specifications match the implemented code.
- [ ] No unintended changes outside the tasks' likely files (and zero edits to `src/`, `css/`, `content/`, or `specification/mockups/`).

## Risks and open questions

- **Blocking:** None
- **Non-blocking:**
  - **Upstream `agent-workflow` guidance alignment:** Global lifecycle skills (`create-plan`, `verify-plan`, `implement`, `verify-implementation`) still treat WCAG 2.2 AA and visual parity as uniform hard criteria until `../agent-workflow/specification/requests/2026-11-26-tiered-test-severity-and-e2e-hardening-guidance.md` is planned and adopted. Mitigation: this plan updates `samata-ml`'s `AGENTS.md` and `specification/testing.md` directly so `samata-ml` sessions honour the beta tiering immediately; the upstream request aligns shared skills across repositories.
  - **Hidden production persistence race in `DATA-PRE-2` / `WML-P2-ROUTE-2`:** If awaiting `waitForPersistedAppState` or `loadSampleDataset` does not resolve `DATA-PRE-2` or `WML-P2-ROUTE-2` in Chromium, that indicates a real product persistence bug in `src/stores/persister.ts`. Mitigation: T3 explicitly escalates rather than modifying `src/` out of scope.
  - **V1 strictness re-enablement:** Keeping `SAMATA_ADVISORY_CHECKS` as a single flag (default `'warn'` in beta, `'error'` in V1) ensures visual parity and WCAG checks do not rot out of sight — the `advisory` CI job continues running them on every PR and push to `main`.

## Escalations

None.

## Review fixes

None.

## Implementation and verification log

| When (UTC) | Task | Agent (model) | Outcome / commands / evidence |
| ---------- | ---- | ------------- | ----------------------------- |
| —          | —    | —             | Not started                   |

## Plan review history

| Reviewed (UTC)       | Agent (model)                           | Decision          | Findings                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------- | --------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-26T09:19:54Z | Google Antigravity (Gemini 4 Neon High) | changes-requested | MAJOR: advisory-a11y dual-runner expect/Error mismatch; PH-AC-2 duplicate tests at L1201-L1273; unremoved interim Firefox guards in training-panels/models-setup and T2.2 filter inaccuracy; missing dataset/welcome persistence settlement in DATA-PRE-2/WML-P2-ROUTE-2; T4 missing --with-deps, WorkflowJob/ci-workflow L254 updates, SAMATA_E2E_TIER env isolation in known-failures.test, and AGENTS.md command ordering |

## Change log

| When (UTC)           | Change        | Reason                                                                                                                                                                                                           |
| -------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-26T08:51:44Z | Initial draft | Maintainer direction: prioritise functional robustness in beta, treat WCAG compliance and visual fidelity as advisory warnings, harden flaky E2E tests, and request aligned testing guidance in `agent-workflow` |
