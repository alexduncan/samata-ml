# System Architecture

**Status:** partial — tooling and delivery rules apply now; the directory structure, router, stores and service worker are target design not yet in `src/` (see [Known gaps](README.md#known-gaps))

This document defines the target system shape and the architectural invariants that changes must preserve.

This repository MUST NOT contain actual training algorithms. The only responsibility of this app is to construct the configuration payload and call the `web-ml` library API to run training of machine learning models.

## Tech Stack & Tooling

- **Language:** TypeScript (Strict Mode). UI is built from Lit 3 custom elements ([COMPONENTS.md](COMPONENTS.md)). The router, state/persistence layer, storage worker and ingestion code are framework-free TypeScript and MUST NOT import Lit.
- **State:** Nanostores. Navigation state lives in the URL; everything else is in persisted stores (see [Routing](#routing-flow-control-and-code-splitting)).
- **Package Manager & Runtime:** Bun. You MUST use `bun add`, `bun run`, and `bunx` for all terminal commands. Do not use `npm`, `yarn`, or `pnpm`.

## Directory Structure (Feature-Based)

The repository strictly adheres to a domain-driven, feature-based directory structure to keep related logic (UI, state, workers) co-located. Agents must not create generic horizontal directories like `/views` or `/controllers`.

- `/index.html`: Root entry point referencing `/src/main.ts`.
- `/public/`: Static assets (fonts, favicons, manifest).
- `/src/`: All application source code.
- `/src/common/`: Highly reusable UI building blocks and shared utilities. Component tiers and implementation rules are defined in [COMPONENTS.md](COMPONENTS.md).
- `/src/features/`: Domain-specific modules representing the four workflow sections (e.g., `/src/features/data/`, `/src/features/target/`, `/src/features/models/`, `/src/features/results/`). Feature-specific UI and worker code stays co-located; component rules are defined in [COMPONENTS.md](COMPONENTS.md), and state rules in [state-and-storage.md](state-and-storage.md).
- `/src/router/`: History-API router, route table, scroll memory and reserved-route (modal) handling. Framework-free.
- `/src/stores/`: Nanostores, actions, the persister and hydration/reconciliation ([COMPONENTS.md §5](COMPONENTS.md), [state-and-storage.md](state-and-storage.md)).
- `/src/config/`: Static configuration: `datasets.ts` and per-model chart configuration (`models/{model-name}.ts`), per [workflow-steps.md](workflow-steps.md).
- `/content-src/`: Raw Markdown documentation organized by locale.
- `/tests/`: `bun:test` specifications and Playwright E2E tests.
- `/specification/`: System architecture rules.

## Delivery and Caching

- **No Inlining:** Compiled JavaScript and CSS MUST NOT be inlined into `index.html`. Use standard `<script type="module">` and `<link rel="stylesheet">`.
- **Root-absolute asset URLs:** Because workflow pages have real paths (`/models/3`), `index.html` MUST reference assets with root-absolute URLs (`/styles.css`, `/app.js`). Relative references break on nested paths.
- **Single-page fallback:** Every workflow and reserved path (`/`, `/data`, `/target`, `/models`, `/models/{num}`, `/results`, `/about`, `/privacy`, `/help`) MUST return the app shell. Production uses `"not_found_handling": "single-page-application"` in `wrangler.jsonc`; the dev server (`scripts/static-server.ts`) MUST fall back only for extension-less paths so a missing `.js`/`.css` still returns 404.
- **Service Worker:** The application MUST implement an offline-first Progressive Web App (PWA) Service Worker to cache the compiled assets locally for instant subsequent loads. Navigation requests for any path above MUST be answered with the cached app shell.

## Routing, Flow Control, and Code Splitting

The workflow is specified in [workflow-steps.md](workflow-steps.md); routing, state and scroll behaviour are specified in [app-state-and-navigation.md](app-state-and-navigation.md) (hybrid router + store), and persistence in [state-and-storage.md](state-and-storage.md).

- **Hybrid state model:** *Where the user is* is the URL (`/data`, `/target`, `/models`, `/models/{num}`, `/results`), driven by the History API. *What the user has done* is in persisted Nanostores. There is no single application-wide finite state machine. A small model-lifecycle machine (`draft → training → trained`) covers the one genuinely sequential flow.
- **History router (framework-free):** `src/router/` is the only code that calls `history.pushState`, `history.replaceState` or reads `location`. Components render `<a href>`; the router intercepts same-origin clicks (never modified clicks). It sets `history.scrollRestoration = 'manual'` and owns per-step scroll memory (ignored when the viewport width has changed).
- **Navigation is never blocked by state:** The user can always navigate to any workflow page. State only decides what the page shows; a page that cannot display yet renders a `.notification` explaining why (e.g. "You need to train more than one model before you can compare results."). Redirects are limited to `/` → resume path and URLs that name no page (unknown paths, malformed model numbers), via `replaceState`.
- **Reserved routes:** `/about`, `/privacy` and `/help` render static content in a native `<dialog>` over the current workflow page. They are real history entries but are **never persisted** to application state. Content comes from the Markdown pipeline ([content-and-i18n.md](content-and-i18n.md)).
- **Dynamic Imports:** Feature modules MUST be loaded using dynamic `import()` statements to enforce code-splitting.
- **Browser history:** Back/Forward move between workflow pages and open/close reserved-route modals. Deep links and reloads restore the same page, and the base URL `/` resumes the last-viewed workflow page. Hydration runs before routing.

## Event Handling

- **Drag and Drop:** Always implement `e.preventDefault()` on `ondragover` events, or the browser will attempt to open the file instead of triggering `ondrop`.
- **TypeScript Casting:** When reading from native events, explicitly cast the target to safely access properties without compiler errors: `const target = e.target as HTMLInputElement;`

## Future Improvements

- Add a regular GitHub Actions workflow that installs the pinned Bun, Zig, and Emscripten versions, runs bun install --frozen-lockfile, and gates pull requests with bun run test. The existing workflow only runs the scikit-learn benchmark, so it does not yet provide full-suite CI.
- Add a bun run doctor or setup-check command that reads the version files, checks the required tools and dependencies, and prints actionable fix instructions.
- Offer a pinned devcontainer or Codespaces configuration for contributors who prefer a preconfigured environment.
- Research security requirements and add `SECURITY.md`.
