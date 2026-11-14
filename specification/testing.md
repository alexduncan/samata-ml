# Testing Strategy

**Status:** partial — `bun:test` with a happy-dom preload (`tests/setup.ts`), Playwright (Chromium, Firefox, WebKit), visual parity, application accessibility audits, mockup review browser coverage and per-file mockup audits are implemented. The Load Data and Target Selection stages of both reference journeys are implemented; later workflow stages remain target.

All functionality must be created alongside a comprehensive test setup. Code submitted without tests will be rejected.

## Unit and Component Testing

- **Runner:** `bun:test` MUST be used for all unit tests due to speed requirements for AI iteration.
- **DOM Environment:** `happy-dom` (or equivalent lightweight DOM simulator) must be configured within `bun:test` to test Lit components and state logic in the terminal.

## End-to-End (E2E) Testing

- **Runner:** Playwright MUST be used for integration and E2E testing.
- Playwright is mandatory for verifying features that cannot be perfectly mocked in a terminal, specifically:
    - Writing raw CSV data to the actual browser IndexedDB.
    - Verifying Web Worker initialization and Comlink communication.

### Mockup review checks

- `bun run test:e2e tests/mockup-review.e2e.ts` covers the server-rendered catalogue and preview helper in Chromium, Firefox and WebKit as configured. It checks semantic structure, GET search/history, no-JavaScript filtering, source safety, byte-identical clean previews, explicit preview navigation, narrow reflow, native focus and the full configured axe tag set without exclusions. Browser execution failures must be reported separately from product assertions.
- `bun run audit:mockups [relative-path ...] [--port 3333]` runs a static Chromium/axe audit against the running mockup server. Explicit paths audit those non-empty HTML files; no paths selects all non-empty HTML files. Reports are overwritten at `test-results/mockup-a11y/latest.json` and `latest.html` and preserve violations, skipped empty files, execution errors and incomplete results separately.
- The mockup audit and catalogue axe scan do not prove WCAG conformance. Static pages do not exercise application interactions; incomplete axe results and keyboard, screen-reader, zoom/reflow, forced-colours, reduced-motion and relevant focus checks need human review. Application-state accessibility remains covered by `tests/a11y.e2e.ts` and feature-specific tests; its existing drift list is independent of mockup reports.

## Reference Journey Testing

- Two reference classification journeys (`tests/journeys/iris-classification.e2e.ts` and `tests/journeys/penguins-classification.e2e.ts`) test realistic user workflows end-to-end through the real UI in browser engines.
- The **Load Data stage** (`JOURNEY-IRIS-DATA` and `JOURNEY-PENGUINS-DATA`) is implemented: exercises real sample dataset loading, header metadata, table row virtual rendering, column inspector panels, and page reload/resume.
- The **Target Selection stage** (`JOURNEY-IRIS-TARGET` and `JOURNEY-PENGUINS-TARGET`) is implemented: exercises navigating to `/target` via sidebar, selecting target column (`class` for Iris, `species` for Penguins), verifying current target state, continue link to `/models`, and state resumption on page reload.
- Subsequent workflow stages (model training, comparison) in these reference journeys remain target and will be extended sequentially in Step 3.
