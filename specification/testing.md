# Testing Strategy

All functionality must be created alongside a comprehensive test setup. Code submitted without tests will be rejected.

## Unit and Component Testing

- **Runner:** `bun:test` MUST be used for all unit tests due to speed requirements for AI iteration.
- **DOM Environment:** `happy-dom` (or equivalent lightweight DOM simulator) must be configured within `bun:test` to test Lit components and state logic in the terminal.

## End-to-End (E2E) Testing

- **Runner:** Playwright MUST be used for integration and E2E testing.
- Playwright is mandatory for verifying features that cannot be perfectly mocked in a terminal, specifically:
    - Writing raw CSV data to the actual browser IndexedDB.
    - Verifying Web Worker initialization and Comlink communication.
