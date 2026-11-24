# Beta console errors, Lit production mode and CSP inline-style fixes

**Status:** draft | **Updated:** 2026-11-24T13:46:55Z
**Authors:** Google Antigravity (Gemini 4 Hydrogen High) | **Created:** 2026-11-24T13:46:55Z
**Verified by:** — | **Verified:** — | **Verification:** pending
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour:** Deploying to `beta.samata.ml` produces four classes of browser console errors and warnings observed on 2026-11-24:

1. **Lit dev mode in production (`app.*.js`):** `scripts/build-assets.ts` calls `Bun.build(...)` without `NODE_ENV=production` (`package.json` `"build"` and `.github/workflows/ci.yml` `deploy`), causing Lit's `"development"` package export condition (`./development/*.js`) to be bundled instead of the `"default"` production files.
2. **CSP `style-src-attr 'none'` violations (`AppConfusionFlowchart`, `AppComparisonTable`, plus latent sites):** `public/_headers` sets `style-src-attr 'none'`, which blocks HTML `style="..."` attributes including Lit's `styleMap(...)`. This strips runtime `inline-size` widths from `.segment` in `app-confusion-flowchart.ts` and `.bar` in `app-comparison-table.ts`. The same pattern exists in `app-model-builder-view.ts` (`<fieldset style="...">`) and `ui-virtual-table.ts` (`style="block-size: ..."` on `.rail-spacer-top` / `.rail-spacer-bottom`).
3. **Lit `change-in-update` warnings (`AppModelResults`, `AppResultsView`):** Both components call store loaders/actions inside `updated()` that synchronously mutate Nanostores subscribed via `StoreController`, scheduling a new Lit update while `_$didUpdate()` is completing.
4. **Blocked native `autofocus` warning (`2:1` on `/models/2`):** `app-model-builder-view.ts` binds `?autofocus=${this.restoreSubmitFocus}` onto `<app-training-setup>` specifically when an element inside the training step already has focus, triggering native HTML autofocus processing while `document.activeElement` is non-null.

**Target behaviour:** Production builds bundle Lit's production exports (`NODE_ENV=production`), all components comply with `style-src-attr 'none'` without dropping computed geometry, `app-model-results` and `app-results-view` do not schedule synchronous re-updates inside `updated()`, and `<app-training-setup>` restores focus without triggering native HTML `autofocus` warnings. Production-served E2E checks assert zero CSP violations and zero console errors or Lit warnings.

**Why:** Eliminate broken bar/spacer styling under production CSP, remove unnecessary double renders and dev-mode overhead in production, and establish a clean console baseline for `beta.samata.ml`. _(Intentionally left in `draft` so the maintainer can append additional beta issues as they arise.)_

## Scope

**In scope**

- Production `Bun.build` configuration (`NODE_ENV=production`) and regression test coverage for Lit production exports.
- Replacing `style="..."` attributes and `styleMap(...)` bindings across `src/` with CSP-safe `static styles` or CSSOM (`element.style.*`) assignments.
- Deferring or restructuring store-mutating side effects out of `updated()` in `app-model-results.ts` and `app-results-view.ts` while preserving `whenSettled()` and loading/error states.
- Replacing the native `autofocus` attribute on `<app-training-setup>` with a non-native reactive property (`restoreFocus`), and auditing `<dialog>` `autofocus` behaviour for stray warnings.
- Adding production-CSP (`DIST_URL`) Playwright assertions for zero `securitypolicyviolation` events and zero console errors/Lit warnings.
- Syncing `specification/COMPONENTS.md`, `specification/components/training-setup.md`, and `specification/ARCHITECTURE.md`.
- Placeholder for additional `beta.samata.ml` issues to be appended by the maintainer before `/verify-plan`.

**Out of scope**

- Weakening `public/_headers` CSP (keep `style-src-attr 'none'` strict).
- Modifying `../web-ml`, `node_modules/`, `vendor/web-ml/`, or `bun.lock`.
- Redesigning Observable Plot chart rendering (`PlotController` already uses CSSOM `.style` assignments).

**Constraints and invariants**

- Keep `public/_headers` `style-src-attr 'none'`, COOP `same-origin`, COEP `require-corp`, and CORP `same-origin` unchanged.
- Preserve `AppModelResults.whenSettled()` and `AppResultsView.whenSettled()` settlement semantics and scroll restoration timing.
- Preserve `AppTrainingSetup` focus restoration on cancellation/failure (`tests/training-panels.e2e.ts` L151–L188) and WCAG 2.2 AA focus behaviour.
- Keep `app-confusion-flowchart`, `app-comparison-table`, and `ui-virtual-table` closed public APIs unchanged; document any `app-training-setup` property addition in `specification/components/training-setup.md`.
- Maintain RTL, 200% zoom, forced-colours, and token compliance (`tests/style-tokens.test.ts`).

## Required reading

- `AGENTS.md` §Verification Commands, §Git workflow, §Rules.
- `specification/COMPONENTS.md` §§3–10 (note §4 `styleMap` guidance conflicts with `style-src-attr 'none'` and is updated in T6).
- `specification/ARCHITECTURE.md` §Tech Stack & Tooling, §Delivery and Caching.
- `specification/components/model-results.md` §§1–8.
- `specification/components/results-comparison.md` §§1–8.
- `specification/components/training-setup.md` §§1–8.
- `specification/components/virtual-table.md` §§1–8.

## Codebase context

Facts verified by `codebase-scout` on 2026-11-24:

- **Relevant specifications:** `specification/COMPONENTS.md` (partial) §4 L74 prescribes `styleMap()` for runtime inline styles, conflicting with `public/_headers` `style-src-attr 'none'`. `specification/components/training-setup.md` (implemented) §3 lists a closed `attribute: false` API without `autofocus`. `specification/components/model-results.md` (implemented), `specification/components/results-comparison.md` (implemented), `specification/components/virtual-table.md` (implemented), `specification/ARCHITECTURE.md` (partial).
- **Build and CI:** `package.json#L7,L73` (`"build": "bun run scripts/build.ts"`, `"lit": "^3.3.3"`); `scripts/build.ts#L1-L83`; `scripts/build-assets.ts#L216-L227,L290-L305` (omits `NODE_ENV=production` / production conditions for `Bun.build`); `.github/workflows/ci.yml#L61,L108,L145`; `node_modules/@lit/reactive-element/package.json#L22-L31`, `node_modules/lit-html/package.json#L18-L27`, `node_modules/lit-element/package.json#L21-L25`.
- **CSP and inline styles:** `public/_headers#L2` (`style-src 'self' 'unsafe-inline'; style-src-attr 'none';`); `scripts/release-headers.ts#L18-L55,L69-L191`; `src/features/results/app-confusion-flowchart.ts#L4,L122-L124`; `src/features/results/app-comparison-table.ts#L4,L135`; `src/features/models/app-model-builder-view.ts#L1259`; `src/components/ui-virtual-table.ts#L491,L519`; `src/features/results/charts/plot-controller.ts#L122-L127` (already uses CSSOM `.style`); `src/common/content/fragment-policy.ts#L44-L55,L127-L160` (already strips `style` in Markdown fragments).
- **Lit `change-in-update`:** `src/features/results/app-model-results.ts#L522-L525,L583-L586` (`loadModelResults` in `updated()`); `src/stores/model-results.store.ts#L49,L54,L57-L64,L97-L108` (`evict` / `read` synchronously sets `$modelResults`); `src/features/results/app-results-view.ts#L207-L212,L329-L356` (`loadComparisonResults`, `selectComparisonGroup`, `requestComparisonAnalysis`, `clearRopeAnalysis` in `updated()`); `src/stores/comparison.store.ts#L117-L124,L132-L145,L182-L248`.
- **Autofocus:** `src/features/models/app-model-builder-view.ts#L549,L575-L580,L1898`; `src/features/models/app-training-setup.ts#L145-L149`; `src/features/shell/app-welcome-modal.ts#L187`; `src/features/target/app-target-view.ts#L567`.
- **Tests and commands:** `tests/build-cache-invalidation.test.ts#L94-L379`, `tests/headers-file.test.ts`, `tests/style-tokens.test.ts#L180-L327`, `tests/virtual-table.e2e.ts#L6-L431`, `tests/model-results.e2e.ts#L50-L468`, `tests/comparison.e2e.ts#L4-L440`, `tests/comparison-charts.e2e.ts#L11-L89`, `tests/training-panels.e2e.ts#L151-L188`, `tests/telemetry-acceptance.e2e.ts#L280-L296`, `tests/journeys/iris-classification.e2e.ts`, `tests/journeys/penguins-classification.e2e.ts`. Gap: no test currently asserts Lit production mode in `dist/`, zero `securitypolicyviolation` events, or zero browser `console` warnings/errors.
- **Web guidance:** None — standard CSSOM, HTML `autofocus`, and CSP `style-src-attr` mechanics.
- **Visual reference:** Existing mockups and `specification/COMPONENTS.md` — no visual design change intended; fixes restore intended bar and virtual-spacer geometry blocked by CSP.
- **Domain skills:** `lit-component-implementer` for T2, T3, T4.
- **Assumptions requiring verification:** Confirm during T4 whether `<button autofocus>` inside `<dialog>` in `app-welcome-modal.ts` or `app-target-view.ts` emits any `Autofocus processing was blocked` warning in Chromium, Firefox, or WebKit when navigated or opened.

## Technical decisions

| Decision                     | Chosen approach and rationale                                                                                                                                                                                                                                                                          | Rejected alternative / trade-off                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Production Lit bundling      | Ensure `NODE_ENV=production` is set for `buildProductionBundle` (`scripts/build-assets.ts` / `package.json` `build` script and `ci.yml` as needed), restoring prior `NODE_ENV` if `buildProductionBundle` sets it programmatically during `runBuild` in tests.                                         | Passing `conditions: ['production']` alone to `Bun.build` still resolved Lit's `./development/*` entrypoints in local verification. |
| CSP-compliant dynamic sizing | Keep `style-src-attr 'none'` in `public/_headers`. Move static `style="..."` to `static styles`, and apply runtime-computed dimensions (`inlineSize`, `blockSize`/`height`) via CSSOM (`element.style.*` in Lit `ref()` / `updated()`).                                                                | Allowing `'unsafe-inline'` or hashes in `style-src-attr` weakens CSP and fails for continuous percentage widths.                    |
| Post-render store loading    | Defer `loadModelResults`, `loadComparisonResults`, `selectComparisonGroup`, `requestComparisonAnalysis`, and `clearRopeAnalysis` out of synchronous `updated()` execution (e.g. via `queueMicrotask` guarded by connection/identity checks), or avoid synchronous store writes inside `_$didUpdate()`. | Suppressing warnings only via Lit production mode leaves redundant double-render cycles in place.                                   |
| Non-native focus restoration | Replace `?autofocus=${this.restoreSubmitFocus}` on `<app-training-setup>` with an unreflected property `restoreFocus: boolean = false` (`attribute: false`), focusing `button[type="submit"]` in `firstUpdated()` when `this.restoreFocus && !this.controlsDisabled`.                                  | Keeping HTML `autofocus` triggers native browser autofocus processing while `[data-testid="training-step"]` already holds focus.    |

### Interfaces and behaviour

- **`AppTrainingSetup` (`src/features/models/app-training-setup.ts`, Tier 2 Presentational):**
    - Add `@property({ attribute: false }) accessor restoreFocus = false;` (default `false`, unreflected).
    - Remove `this.hasAttribute('autofocus')` check in `firstUpdated()`; replace with `if (this.restoreFocus && !this.controlsDisabled)` focusing `button[type="submit"]`.
    - In `AppModelBuilderView` (`src/features/models/app-model-builder-view.ts`), bind `.restoreFocus=${this.restoreSubmitFocus}` instead of `?autofocus=${this.restoreSubmitFocus}`.
- **`AppConfusionFlowchart`, `AppComparisonTable`, `UiVirtualTable`:** Closed public APIs remain unchanged; `.segment` (`inlineSize`), `.bar` (`inlineSize`), and `.rail-spacer-top` / `.rail-spacer-bottom` (`blockSize` / `height`) receive their computed sizes via CSSOM rather than `style="..."` attributes.
- **Additional beta issues (pending maintainer additions):** Reserve space in `## Implementation tasks` / `## Scope` when further issues from `beta.samata.ml` are added before submission.

## Specification changes

- [ ] `specification/COMPONENTS.md` §4 (`Rendering`) — Replace `styleMap()` guidance for runtime styles with CSP-safe CSSOM (`element.style.*`) or native elements (`<progress>`, SVG), explaining that `style-src-attr 'none'` blocks `style="..."` attributes; status stays `partial`.
- [ ] `specification/components/training-setup.md` §3 (`Public API`) — Add `restoreFocus` (`boolean`, default `false`, `attribute: false`) to the closed property table; status stays `implemented`.
- [ ] `specification/ARCHITECTURE.md` §Delivery and Caching — Document that production builds run with `NODE_ENV=production` so Lit resolves production exports; status stays `partial`.

## Implementation tasks

### T1 — Bundle Lit in production mode for `dist/` releases

- **Depends on:** None
- **Risk:** routine
- **Likely files:** `scripts/build-assets.ts`, `package.json`, `.github/workflows/ci.yml`, `tests/build-cache-invalidation.test.ts`
- **Must not touch:** `../web-ml/`, `node_modules/`, `bun.lock`, `public/_headers`
- **Implementation:** Ensure `buildProductionBundle` runs `Bun.build` with `NODE_ENV=production` (setting/restoring `process.env.NODE_ENV` around `Bun.build` when `mode === 'production'` so both CLI and programmatic test invocations produce production Lit bundles, and setting `NODE_ENV=production` in `package.json` `"build"` or `.github/workflows/ci.yml` if needed). Add a test in `tests/build-cache-invalidation.test.ts` verifying emitted `/bundles/app.*.js` (and chunks) from `buildProductionBundle` do not contain `"Lit is in dev mode"`.
- **Acceptance criteria:**
    - [ ] `BETA-ERR-1`: `buildProductionBundle` bundles Lit's production (`"default"`) exports with zero occurrences of `"Lit is in dev mode"` in emitted JS.
    - [ ] `BETA-ERR-1b`: `buildDevBundle` continues to include development diagnostics and source maps.
- **Verification:** `bun test tests/build-cache-invalidation.test.ts`, `bun run deploy:dry-run`
- **Progress:** [ ] Not started

### T2 — Remove `style="..."` attributes and `styleMap()` bindings violating `style-src-attr 'none'`

- **Depends on:** None
- **Risk:** needs care — touches virtual-table scrolling and results charts/tables across shadow roots.
- **Likely files:** `src/features/results/app-confusion-flowchart.ts`, `src/features/results/app-comparison-table.ts`, `src/features/models/app-model-builder-view.ts`, `src/components/ui-virtual-table.ts`, `tests/style-tokens.test.ts`, `tests/results-errors.e2e.ts`, `tests/comparison.e2e.ts`, `tests/virtual-table.e2e.ts`
- **Must not touch:** `public/_headers`, `../web-ml/`, `specification/mockups/`
- **Implementation:**
    1. In `src/features/results/app-confusion-flowchart.ts`, remove `styleMap` and apply `inlineSize` (`${outcome.share * 100}%`) via CSSOM (`ref()` callback or `updated()`).
    2. In `src/features/results/app-comparison-table.ts`, remove `styleMap` and apply `inlineSize` (`${width}%`) via CSSOM (`ref()` callback or `updated()`).
    3. In `src/features/models/app-model-builder-view.ts`, move `<fieldset style="border: 0; padding: 0; margin: 0;">` styling into `static styles` for `#features-form fieldset`.
    4. In `src/components/ui-virtual-table.ts`, replace `style="block-size: ${...}px; height: ${...}px;"` on `.rail-spacer-top` and `.rail-spacer-bottom` with CSSOM (`el.style.blockSize` and `el.style.height` set via `ref()` / `updated()`).
    5. Consider adding a static check in `tests/style-tokens.test.ts` rejecting `styleMap(` or literal `style="` in `src/` (excluding `*.stories.ts`).
- **Acceptance criteria:**
    - [ ] `BETA-ERR-2`: No non-story file in `src/` emits an HTML `style="..."` attribute or imports `styleMap`.
    - [ ] `BETA-ERR-2b`: Under `dist/_headers` CSP (`style-src-attr 'none'`), `app-confusion-flowchart` segments and `app-comparison-table` bars render with expected computed `inline-size`, `ui-virtual-table` spacers scroll accurately, and zero `securitypolicyviolation` events occur.
- **Verification:** `bun run check`, `bun run test:stories`, `bun run test:e2e tests/virtual-table.e2e.ts tests/comparison.e2e.ts tests/results-errors.e2e.ts`
- **Progress:** [ ] Not started

### T3 — Fix `change-in-update` in `app-model-results` and `app-results-view`

- **Depends on:** None
- **Risk:** needs care — `whenSettled()` and `StoreController` timing must remain race-free across fast route transitions.
- **Likely files:** `src/features/results/app-model-results.ts`, `src/features/results/app-results-view.ts`, `tests/model-results.e2e.ts`, `tests/comparison.e2e.ts`
- **Must not touch:** `src/stores/model-results.store.ts` (unless a clean action/helper is needed without changing semantics), `../web-ml/`
- **Implementation:** In `AppModelResults.updated()` and `AppResultsView.updated()`, avoid synchronously mutating stores observed by `StoreController` during Lit's `_$didUpdate()` phase. Defer side-effect triggers (`loadModelResults`, `loadComparisonResults`, `selectComparisonGroup`, `requestComparisonAnalysis`, `clearRopeAnalysis`) to a guarded microtask (`queueMicrotask`, checking `this.isConnected` and current state/identity before running, and cancelling superseded microtasks on disconnect/re-update) while ensuring `whenSettled()` still waits for the triggered load/analysis to settle.
- **Acceptance criteria:**
    - [ ] `BETA-ERR-3`: Rendering `app-model-results` and `app-results-view` in dev and production modes produces zero Lit `change-in-update` warnings.
    - [ ] `BETA-ERR-3b`: `whenSettled()`, scroll restoration, default group selection, and ROPE analysis still complete identically on initial load, reload, and route change.
- **Verification:** `bun run check`, `bun run test:stories`, `bun run test:e2e tests/model-results.e2e.ts tests/comparison.e2e.ts tests/comparison-charts.e2e.ts`
- **Progress:** [ ] Not started

### T4 — Replace native `autofocus` attribute on `<app-training-setup>` and verify dialog autofocus

- **Depends on:** None
- **Risk:** routine
- **Likely files:** `src/features/models/app-model-builder-view.ts`, `src/features/models/app-training-setup.ts`, `src/features/models/app-training-setup.stories.ts`, `tests/training-panels.e2e.ts`
- **Must not touch:** `src/features/shell/app-welcome-modal.ts` and `src/features/target/app-target-view.ts` unless E2E verification proves they also emit the warning
- **Implementation:** Add `restoreFocus = false` (`@property({ attribute: false })`) on `AppTrainingSetup`, use it in `firstUpdated()` instead of `this.hasAttribute('autofocus')`, and bind `.restoreFocus=${this.restoreSubmitFocus}` in `app-model-builder-view.ts`. Verify in Playwright whether `<button autofocus>` inside `<dialog>` in `app-welcome-modal.ts` or `app-target-view.ts` also emits `Autofocus processing was blocked` in Chromium/Firefox/WebKit; if so, handle via explicit dialog focus or report in plan.
- **Acceptance criteria:**
    - [ ] `BETA-ERR-4`: Cancelling or failing training on `/models/2` restores focus to `Train Model` without emitting `Autofocus processing was blocked because a document already has a focused element.`
    - [ ] `BETA-ERR-4b`: Normal navigation to `/models/2` and welcome/confirm modal flows emit no autofocus console warnings.
- **Verification:** `bun run check`, `bun run test:stories`, `bun run test:e2e tests/training-panels.e2e.ts`
- **Progress:** [ ] Not started

### T5 — Add production-CSP and clean-console E2E regression test

- **Depends on:** T1, T2, T3, T4
- **Risk:** routine
- **Likely files:** `tests/csp-and-console.e2e.ts`
- **Must not touch:** `public/_headers`, `src/`
- **Implementation:** Add a Playwright test running against `DIST_URL` (which enforces `dist/_headers`) that attaches `page.on('console', ...)`, `page.on('pageerror', ...)`, and a document `securitypolicyviolation` listener across data preview (virtual table), target selection, `/models/2` training setup + single-model results, and `/results` comparison, asserting zero CSP violations, zero page errors, and zero console error/Lit-warning messages.
- **Acceptance criteria:**
    - [ ] `BETA-ERR-5`: Production server (`DIST_URL`) flow across all four workflow steps and `/results` produces zero `securitypolicyviolation` events, zero `pageerror`s, and zero console errors or Lit warnings in Chromium, Firefox, and WebKit.
- **Verification:** `bun run test:e2e tests/csp-and-console.e2e.ts`
- **Progress:** [ ] Not started

### T6 — Sync specification and run full verification

- **Depends on:** T1, T2, T3, T4, T5
- **Risk:** routine
- **Likely files:** `specification/COMPONENTS.md`, `specification/components/training-setup.md`, `specification/ARCHITECTURE.md`, `specification/README.md`
- **Must not touch:** `src/`, `css/`, `scripts/`, `tests/`
- **Implementation:** Update `specification/COMPONENTS.md` §4 (`Rendering`), `specification/components/training-setup.md` §3 (`Public API`), and `specification/ARCHITECTURE.md` §Delivery and Caching to reflect the implemented rules. Verify `specification/README.md` status alignment and run all verification gates.
- **Acceptance criteria:**
    - [ ] Every item under `## Specification changes` is complete and accurate.
    - [ ] `bun run check`, `bun run lint`, `bun run deploy:dry-run`, `bun run test:stories`, `bun run format:check`, and relevant `bun run test:e2e` suites pass.
- **Verification:** `bun run check`, `bun run lint`, `bun run deploy:dry-run`, `bun run test:stories`, `bun run plans:check specification/plans/beta-console-errors-and-csp-fixes.md`
- **Progress:** [ ] Not started

## Verification and definition of done

- [ ] All task acceptance criteria met.
- [ ] Relevant verification commands from `AGENTS.md` pass with no new failures.
- [ ] Type-check, lint, formatting, and build checks pass.
- [ ] Accessibility (WCAG 2.2 AA), privacy/security, and contract-compatibility checks completed where applicable.
- [ ] Every item under _Specification changes_ is ticked, and specifications match the implemented code.
- [ ] No unintended changes outside the tasks' likely files.

## Risks and open questions

- **Blocking:** Plan intentionally held in `draft` at the maintainer's request (`2026-11-24`) so additional `beta.samata.ml` console/runtime issues can be added before `/verify-plan` review. Once all issues are collected: (1) confirm whether `<button autofocus>` inside `<dialog>` (`app-welcome-modal.ts`, `app-target-view.ts`) needs changes beyond `<app-training-setup>`, and (2) confirm whether the `tests/style-tokens.test.ts` static guard should forbid all `style="..."` / `styleMap` in `src/` (excluding `*.stories.ts`).
- **Non-blocking:** `queueMicrotask` deferral in T3 changes store-load initiation from synchronous inside `updated()` to the next microtask; `AppModelResults.whenSettled()` and `AppResultsView.whenSettled()` must still resolve only after the deferred load finishes.

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

| When (UTC)           | Change        | Reason                                                                                         |
| -------------------- | ------------- | ---------------------------------------------------------------------------------------------- |
| 2026-11-24T13:46:55Z | Initial draft | Browser console errors observed on `beta.samata.ml` (left in `draft` for maintainer additions) |
