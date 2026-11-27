# Testing Strategy

**Status:** partial — Bun units, three-browser Storybook and Playwright checks, parity, classification execution journeys and application/mockup audits are implemented. Broader feature-story migration, exact data/model contrast findings and the reference-journey comparison stage remain follow-up work.

All functionality must be created alongside a comprehensive test setup. Code submitted without tests will be rejected.

## Unit and Component Testing

- **Authored Markdown:** Run `bun run content:check` to validate pages, model descriptions,
  glossary entries and dataset datasheets using the build compiler. A development rebuild
  reports the same compiler diagnostics. The pre-commit hook checks the staged tree
  after formatting when content or its inputs change. CI requires the check to pass
  before E2E tests and deployment.

- **Non-component units:** `bun:test` runs `*.test.ts` store, routing, storage and utility tests. `tests/setup.ts` supplies happy-dom for non-component DOM utilities; it does not establish Lit lifecycle, focus, dialog or layout behaviour.
- **Component acceptance:** Playwright runs `tests/**/*.e2e.ts` in Chromium, Firefox and WebKit. Acceptance IDs map to browser tests independently of stories. Test visible output, native events, computed styles and accessibility rather than private state.
- **Story smoke:** `bun run test:stories` generates the CEM and runs co-located CSF stories through the Storybook Vitest addon and Playwright provider in all three engines. Story interactions and hooks remain blocking. Automated accessibility findings use Storybook's `a11y.test: 'todo'` during beta and `'error'` in strict mode. Vitest collects the story suite and Bun collects the unit suite.
- **Coverage boundary:** Button, Chiclet, Dialog, Page Header, shell, model card and chooser stories use production modules. The model card covers all three type labels, both decorative image forms, current selection, a grid, long labels, narrow layout and RTL. The chooser covers categorical and Boolean targets, a saved current choice and an unsupported numeric target. Remaining data, target, model and virtual-table story migration is follow-up work. Successful smoke tests do not replace acceptance criteria, real app navigation or manual accessibility checks.

## End-to-End (E2E) Testing

- **Runner:** Playwright MUST be used for integration and E2E testing.
- **Blocking beta checks:** `bun run test:e2e:blocking` runs functional E2E in Chromium, Firefox and WebKit. CI gates deployment on the `verify` job and all three blocking E2E jobs. Unit tests, Storybook interactions, production build validation, static token checks and CSP checks remain blocking.
- **Advisory beta checks:** Inline automated WCAG scans warn in Chromium and are skipped in Firefox and WebKit. The separate Chromium job runs `bun run test:e2e:advisory`, covering `tests/visual-parity.e2e.ts` and `tests/a11y.e2e.ts` while deployment continues to depend on `verify` and blocking E2E. Running `bun run test:e2e [file]` directly keeps both dedicated suites available.
- **Strict enforcement:** `SAMATA_ADVISORY_CHECKS` defaults to `warn`. Set it to `error` in the local environment or the same-named GitHub repository variable. CI inherits that value at workflow level. Storybook and inline WCAG scans fail on findings, and blocking E2E includes the dedicated accessibility suites and Chromium visual parity.
- Playwright is mandatory for verifying features that cannot be perfectly mocked in a terminal, specifically:
  - Writing raw CSV data to the actual browser IndexedDB.
  - Verifying Web Worker initialisation and the application's typed request/response protocol.
- The model-card and builder suites cover image decoding, reserved space on image failure, accessible action names, native focus restoration, selection persistence and catalogue eligibility in the connected browser workflow.
- The shell suite covers cancellable component-owned heading focus independently of scroll restoration, native modal intent/history, responsive/RTL layouts and reduced-motion/forced-colours emulation. Real browser zoom and screen-reader observations are recorded separately from emulation.
- Use `expectReservedModalClosed` before further input on a restored underlay and `waitForPersistedAppState` before reload or full navigation that depends on a saved edit. Use `waitForPublishedPreview` when later steps depend on dataset publication. Derive sample counts from the served catalogue with `fetchSampleDatasetCount`.
- Reserve exact authored wording for editorial review. Use controlled, versioned content fixtures for dialog titles, semantic structure, focus and navigation, and a compiled Privacy route smoke test for the delivery path. Welcome functional tests use the visible dialog structure and actions. Exact Welcome geometry is checked in visual parity with common text on both sides.
- `tests/visual-parity.e2e.ts` compares clean reference/app styles and relative geometry at Chromium 1440×900, with reviewed Empty/Models sidebar screenshot baselines and a negative layout probe. Parity is intentionally Chromium-only; component acceptance remains three-browser. No mapped surface has a drift exemption.
- Shell-scoped axe scans allow no rule exclusions. Broad app audits accept only the exact separately owned feature findings in `tests/a11y-feature-findings.ts`, including measured colours/type and canonical node identity; unlisted elements or rules fail. These existing findings do not constitute a whole-app WCAG pass.

### Test servers and checkouts

- Every checkout has its own ports from `scripts/ports.ts`. The primary checkout uses 3000 (app), 3001 (production build) and 3333 (mockups). A linked Git worktree derives a stable block of three ports from its real root path. `SAMATA_PORT_BASE` overrides the base for any checkout.
- Tests, `playwright.config.ts` and `audit:mockups` take every server URL from `scripts/ports.ts` (`APP_URL`, `DIST_URL`, `MOCKUPS_URL`). `tests/test-server-urls.test.ts` fails on hard-coded `localhost:3000`, `3001` or `3333` in Playwright code.
- Both servers answer `GET /__checkout` with their checkout root and mode. `tests/global-setup.ts` checks all three servers before any test runs and fails when one belongs to another checkout, lacks the endpoint, runs in the wrong mode, or the app was started without `SAMATA_TRAINING_RUNTIME_PROBE=1`.
- A result from another checkout's server, or a run stopped by a port held by an unknown process, is an environment blocker, not evidence. Never stop a process the session did not start.

### Mockup review checks

- `bun run test:e2e tests/mockup-review.e2e.ts` covers the mockup review server in Chromium, Firefox, and WebKit as configured. It checks flat URLs (`/<filename>`, `/index.json`, `/__source/<filename>`), the `<body class="mockup-index">` catalogue and JS-rendered `<table class="mockups">`, client-side text search and status filtering, bottom light-DOM `#__mockup-review-helper-host` injection with `/mockups.css` and auto-navigating `#preview-page` selector, safe plain-text source headers (`X-Content-Type-Options: nosniff`), and untouched `?clean=1` previews. Browser execution failures must be reported separately from product assertions.
- `bun run audit:mockups [filename ...] [--port <port>]` (default: the checkout's mockup port, 3333 in the primary checkout; it refuses a server that reports another checkout) runs a strict static Chromium/axe WCAG 2.2 AA audit against product mockups served by `bun run mockups` at `/<filename>?clean=1` (the developer-only catalogue index and review helper bar are exempt from mandatory WCAG/no-JS gates). Explicit filenames audit those non-empty top-level HTML files; no filenames selects all non-empty top-level HTML files. Reports are overwritten at `test-results/mockup-a11y/latest.json` and `latest.html` and preserve violations, skipped empty files, execution errors, and incomplete results separately.
- The static mockup audit does not prove WCAG conformance. Static pages do not exercise application interactions; incomplete axe results and keyboard, screen-reader, zoom/reflow, forced-colours, reduced-motion, and relevant focus checks need human review. Application-state accessibility is covered independently by `tests/a11y.e2e.ts` and feature-specific tests; exact feature findings never suppress mockup reports.

## Reference Journey Testing

- Two reference classification journeys (`tests/journeys/iris-classification.e2e.ts` and `tests/journeys/penguins-classification.e2e.ts`) test realistic user workflows end-to-end through the real UI in browser engines.
- The **Load Data stage** (`JOURNEY-IRIS-DATA` and `JOURNEY-PENGUINS-DATA`) is implemented: exercises real sample dataset loading, header metadata, table row virtual rendering, column inspector panels, and page reload/resume.
- The **Target Selection stage** (`JOURNEY-IRIS-TARGET` and `JOURNEY-PENGUINS-TARGET`) is implemented: exercises navigating to `/target` via sidebar, selecting target column (`class` for Iris, `species` for Penguins), verifying current target state, continue link to `/models`, and state resumption on page reload.
- The **Model Setup and Training stage** (`JOURNEY-IRIS-SETUP` and `JOURNEY-PENGUINS-SETUP`) configures Logistic Regression and runs real worker training through the builder. Iris uses manual four-fold Cross-Validation with refit. Palmer Penguins uses stratified One-Shot. Each journey reloads the durable result and open log, confirms the retained run ID and acknowledges Section 5 without changing URL. Chromium, Firefox and WebKit exercise both journeys.
- `tests/classification-training.e2e.ts` runs the compiled deployment worker in Chromium for all eight classifiers with both strategies. It checks fixed folds, refit, held-out report counts, authoritative partition and model-domain errors, and validation-only feature leakage.
- `tests/training-panels.e2e.ts` separates deterministic lifecycle fixtures from genuine fits. The worker fixture keeps browser IndexedDB and Web Locks active to check progress, keyboard focus, safe notices, cancellation, 95% publication recovery, remote replay and route independence. Panel axe and the three-engine stories supplement the engine journeys. The Phase 3 plan records Safari and manual check limits.
- Result details and comparison remain target for subsequent stages.

### Chart verification

`tests/chart-accessibility.e2e.ts` checks axe, chart names and descriptions, 320px reflow, 200% text size, forced colours, polite live updates and RTL in Chromium, Firefox and WebKit. `tests/chart-tokens.test.ts` checks model-colour, outline and text contrast. Automated checks do not replace colour-vision-deficiency simulation or native Safari/VoiceOver spoken-output checks; pending manual work is in [HUMAN.md](HUMAN.md). See [charts.md](charts.md).
