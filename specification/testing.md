# Testing Strategy

**Status:** partial — Bun units, three-browser Storybook and Playwright checks, parity, classification execution journeys and application/mockup audits are implemented. Broader feature-story migration, exact data/model contrast findings and the reference-journey comparison stage remain follow-up work.

All functionality must be created alongside a comprehensive test setup. Code submitted without tests will be rejected.

## Unit and Component Testing

- **Non-component units:** `bun:test` runs `*.test.ts` store, routing, storage and utility tests. `tests/setup.ts` supplies happy-dom for non-component DOM utilities; it does not establish Lit lifecycle, focus, dialog or layout behaviour.
- **Component acceptance:** Playwright runs `tests/**/*.e2e.ts` in Chromium, Firefox and WebKit. Acceptance IDs map to browser tests independently of stories. Test visible output, native events, computed styles and accessibility rather than private state.
- **Story smoke:** `bun run test:stories` generates the CEM and runs only co-located CSF stories through the Storybook Vitest addon and Playwright provider in all three engines. Every story runs interactions/hooks and axe with violations failing the command. Vitest does not collect unit/E2E files; Bun does not collect stories or Playwright files.
- **Coverage boundary:** Button, Chiclet, Dialog, Page Header and shell stories use production modules. Existing data/target/model/virtual-table story migration is follow-up work. Successful smoke tests do not replace acceptance criteria, real app navigation or manual accessibility checks.

## End-to-End (E2E) Testing

- **Runner:** Playwright MUST be used for integration and E2E testing.
- Playwright is mandatory for verifying features that cannot be perfectly mocked in a terminal, specifically:
    - Writing raw CSV data to the actual browser IndexedDB.
    - Verifying Web Worker initialisation and the application's typed request/response protocol.
- The shell suite covers cancellable component-owned heading focus independently of scroll restoration, native modal intent/history, responsive/RTL layouts and reduced-motion/forced-colours emulation. Real browser zoom and screen-reader observations are recorded separately from emulation.
- `tests/visual-parity.e2e.ts` compares clean reference/app styles and relative geometry at Chromium 1440×900, with reviewed Empty/Models sidebar screenshot baselines and a negative layout probe. Parity is intentionally Chromium-only; component acceptance remains three-browser. No mapped surface has a drift exemption.
- Shell-scoped axe scans allow no rule exclusions. Broad app audits accept only the exact separately owned feature findings in `tests/a11y-feature-findings.ts`, including measured colours/type and canonical node identity; unlisted elements or rules fail. These existing findings do not constitute a whole-app WCAG pass.

### Mockup review checks

- `bun run test:e2e tests/mockup-review.e2e.ts` covers the server-rendered catalogue and preview helper in Chromium, Firefox and WebKit as configured. It checks semantic structure, GET search/history, no-JavaScript filtering, source safety, byte-identical clean previews, explicit preview navigation, narrow reflow, native focus and the full configured axe tag set without exclusions. Browser execution failures must be reported separately from product assertions.
- `bun run audit:mockups [relative-path ...] [--port 3333]` runs a static Chromium/axe audit against the running mockup server. Explicit paths audit those non-empty HTML files; no paths selects all non-empty HTML files. Reports are overwritten at `test-results/mockup-a11y/latest.json` and `latest.html` and preserve violations, skipped empty files, execution errors and incomplete results separately.
- The mockup audit and catalogue axe scan do not prove WCAG conformance. Static pages do not exercise application interactions; incomplete axe results and keyboard, screen-reader, zoom/reflow, forced-colours, reduced-motion and relevant focus checks need human review. Application-state accessibility is covered independently by `tests/a11y.e2e.ts` and feature-specific tests; exact feature findings never suppress mockup reports.

## Reference Journey Testing

- Two reference classification journeys (`tests/journeys/iris-classification.e2e.ts` and `tests/journeys/penguins-classification.e2e.ts`) test realistic user workflows end-to-end through the real UI in browser engines.
- The **Load Data stage** (`JOURNEY-IRIS-DATA` and `JOURNEY-PENGUINS-DATA`) is implemented: exercises real sample dataset loading, header metadata, table row virtual rendering, column inspector panels, and page reload/resume.
- The **Target Selection stage** (`JOURNEY-IRIS-TARGET` and `JOURNEY-PENGUINS-TARGET`) is implemented: exercises navigating to `/target` via sidebar, selecting target column (`class` for Iris, `species` for Penguins), verifying current target state, continue link to `/models`, and state resumption on page reload.
- The **Model Setup and Training stage** (`JOURNEY-IRIS-SETUP` and `JOURNEY-PENGUINS-SETUP`) configures Logistic Regression and runs real worker training through the builder. Iris uses manual four-fold Cross-Validation with refit. Palmer Penguins uses stratified One-Shot. Each journey reloads the durable result and open log, confirms the retained run ID and acknowledges Section 5 without changing URL. Chromium, Firefox and WebKit exercise both journeys.
- `tests/classification-training.e2e.ts` runs the compiled deployment worker in Chromium for all eight classifiers with both strategies. It checks fixed folds, refit, held-out report counts, authoritative partition and model-domain errors, and validation-only feature leakage.
- `tests/training-panels.e2e.ts` separates deterministic lifecycle fixtures from genuine fits. The worker fixture keeps browser IndexedDB and Web Locks active to check progress, keyboard focus, safe notices, cancellation, 95% publication recovery, remote replay and route independence. Panel axe and the three-engine stories supplement the engine journeys. The Phase 3 plan records Safari and manual check limits.
- Result details and comparison remain target for subsequent stages.
