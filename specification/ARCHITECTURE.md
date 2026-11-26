# System Architecture

**Status:** partial — feature placement, external hashed `/bundles/` assets with no CSS inlining, development-only Storybook, routing, hydration, root-absolute assets, Markdown, SPA fallback, CI/CD release verification, production public SVG optimisation and the same-origin training graph are implemented. Service-worker caching, dynamically imported views and broader per-model options remain target. See [Known gaps](README.md#known-gaps).

This document defines the target system shape and the architectural invariants that changes must preserve.

This repository MUST NOT contain actual training algorithms. The only responsibility of this app is to construct the configuration payload and call the `web-ml` library API to run training of machine learning models.

## Tech Stack & Tooling

- **Language:** TypeScript (Strict Mode). UI is built from Lit 3 custom elements ([COMPONENTS.md](COMPONENTS.md)). The router, state/persistence layer, storage worker and ingestion code are framework-free TypeScript and MUST NOT import Lit.
- **State:** Nanostores. Navigation state lives in the URL; everything else is in persisted stores (see [Routing](#routing-flow-control-and-code-splitting)).
- **Package Manager & Runtime:** Bun. You MUST use `bun add`, `bun run`, and `bunx` for all terminal commands. Do not use `npm`, `yarn`, or `pnpm`.

### Local mockup review tooling

- Run `bun run mockups` to browse the flat `specification/mockups/` directory at the checkout's mockup URL (`http://localhost:3333/` in the primary checkout; ports come from `scripts/ports.ts`). The server is read-only, serves files directly at `/<relativePath>`, exposes live metadata at `/index.json`, serves plain-text source at `/__source/<relativePath>` (`X-Content-Type-Options: nosniff`), streams live-reload events over `/__hmr`, and reports its checkout root at `/__checkout`. `/` renders a `<body class="mockup-index">` catalogue containing a JS-populated `<table class="mockups">` with client-side search and status filtering. Normal HTML previews inject `/mockups.css` into `<head>` and a light-DOM `#__mockup-review-helper-host` bar before `</body>`; `?clean=1` returns untouched file bytes from disk without injected CSS, helper markup, or scripts.
- Run `bun run audit:mockups [filename ...] [--port <port>]` with the mockup server running (default: the checkout's mockup port; it refuses another checkout's server) to audit selected top-level HTML files, or omit filenames to scan every non-empty HTML mockup. It uses local Playwright Chromium and axe against `/<filename>?clean=1`, writes `test-results/mockup-a11y/latest.json` and `latest.html`, and never suppresses contrast findings. A clean automated result is not an accessibility approval; review incomplete results and perform the manual checks in [mockup-review.md](mockup-review.md).

## Directory Structure (Feature-Based)

The repository strictly adheres to a domain-driven, feature-based directory structure to keep related logic (UI, state, workers) co-located. Agents must not create generic horizontal directories like `/views` or `/controllers`.

- `/index.html`: Source HTML template referencing `/app.js` and `/style.css`; the build compiles `src/app.ts` and rewrites asset URLs to their emitted hashes.
- `/public/`: Source for public assets such as fonts, favicons, the manifest and model illustrations. The build copies files to the output root at the same relative paths. Production optimises lowercase `.svg` files during that copy.
- `/src/`: All application source code.
- `/src/common/`: Framework-free utilities, content/storage/worker boundaries; no Lit imports.
- `/src/components/`: Reusable feature-agnostic `ui-*` elements, named after their tags.
- `/src/features/`: Domain-specific `app-*` elements and related logic in `data/`, `target/`, `models/` and `shell/`. The shell owns sidebar/onboarding/reserved-content presentation; dataset/model cards stay with their domains. Component rules are in [COMPONENTS.md](COMPONENTS.md), and state rules in [state-and-storage.md](state-and-storage.md).
- `/src/styles/`: Shared Lit CSSResult modules, adopted in document and consuming shadow roots; no duplicate document CSS copies.
- `/src/types/`: Shared TypeScript contracts.
- `/src/router/`: History-API router, route table, scroll memory and reserved-route (modal) handling. Framework-free.
- `/src/stores/`: Nanostores, actions, the persister and hydration/reconciliation ([COMPONENTS.md §5](COMPONENTS.md), [state-and-storage.md](state-and-storage.md)).
- `/src/config/`: Static configuration: `locales.ts` and per-model chart configuration (`models/{model-name}.ts`), per [workflow-steps.md](workflow-steps.md). Sample datasets come from the generated catalogue, not this directory.
- `/content/{locale}/`: Authored Markdown documentation organised by locale (default base `en`) and domain (`pages`, `models`, `glossary`), compiled at build time into `{outDir}/content/`.
- `/content/datasets/`: Locale-neutral sample dataset directories (`descriptor.ts`, `datasheet.md`, and one of `data.csv`, an approved build source or an approved browser-direct source), per [sample-datasets.md](sample-datasets.md).
- `/datasets/` (build output): `index.json` catalogue and, per sample, `descriptor.json` and compiled `datasheet.html`; bundled samples also have `data.csv`, while remote samples do not.
- `/tests/`: Non-component `bun:test` files (`*.test.ts`) and Playwright acceptance/E2E files (`*.e2e.ts`). Co-located `src/**/*.stories.ts` run in the separate Vitest browser project.
- `/.storybook/`: Development preview/configuration and test-only fixtures. Generated CEM and built Storybook are ignored artifacts, never production entry points.
- `/vendor/web-ml/`: The versioned prebuilt `web-ml` release tarball and its SHA-256 checksum.
- `/specification/`: System architecture rules.

## Delivery and Caching

- **No Inlining:** Compiled JavaScript and CSS MUST NOT be inlined into `index.html`. Use external `/bundles/app.<hash>.js` `<script type="module">` and `/bundles/style.<hash>.css` `<link rel="stylesheet">` tags.
- **Bundle mode.** The shared `Bun.build` configuration defines `process.env.NODE_ENV` explicitly as `production` for releases and `development` for local development. Bun resolves Lit’s production exports in release bundles and keeps development diagnostics and source maps for local builds. The definition contributes to the bundle build identity.
- **Root-absolute asset URLs:** Because workflow pages have real paths (`/models/3`), the template references `/style.css` and `/app.js`; emitted production references retain the `/bundles/` leading slash and include content hashes. Relative references break on nested paths.
- **Public SVG delivery.** Use lowercase `.svg` for public illustrations. Production runs SVGO with its default preset and precision 6 when copying those files into the active output directory. Development uses the ordinary copy for all files. Production copies other public files through the same ordinary path, then emits the release metadata and generated header files at their existing stage. The build leaves the authored files intact. Illustrations keep their root-absolute URLs under `/assets/`, with the revalidation policy below. Generated bundles and the training runtime use their existing content hashes and cache rules.
- **Release metadata, cache headers, and stale-build detection:** Production builds emit `/release.json` (`version`, `build`, and `workers`) and Cloudflare `/_headers` rules (`immutable` caching on `/bundles/` and `/web-ml/{version}-{graph-digest}/`; `public, max-age=0, must-revalidate` on `/index.html`, `/content/<locale>/<domain>/index.json?v=<hash>`, `/datasets/index.json?v=<hash>`, `/robots.txt`, `/assets/*`, and `/release.json`; Cloudflare `! Header` detach rules; strict CSP, COOP/COEP/CORP, `nosniff`, and `no-referrer`). `scripts/headers-file.ts` and `scripts/static-server.ts --dist` emulate those `/_headers` rules (including detach directives) locally. Versioned content and dataset manifests avoid stale cached catalogue reads across deploys, and client-side storage/training/analysis worker failures probe `/release.json` to display a reload banner if a newer build is deployed.
- **Beta crawler policy and telemetry boundary:** Closed beta builds (`SAMATA_CRAWLER_POLICY=closed`, default) emit `robots.txt` with `Disallow: /` and global `X-Robots-Tag: noindex, nofollow, nosnippet` on `/*` in `_headers`; public builds (`SAMATA_CRAWLER_POLICY=public`, restricted to stable production releases ≥ `1.0.0`) emit `Allow: /` and omit the global header while keeping `X-Robots-Tag: noindex, nofollow` on `/content/*` and `/datasets/*`. Beta telemetry (`BETA_TELEMETRY_ENABLED=true` on a `-beta.N` build, restricted at runtime to `beta.samata.ml` with CSP allowances for `https://cloud.umami.is/script.js` in `script-src` and `https://gateway.umami.is` in `connect-src`) never loads pre-consent and sends only allowlisted canonical route paths, UI milestone event names, and fixed error-category codes after explicit **Get Started** acceptance.
- **Style/workbench boundary:** `css/style.css` imports only root tokens and document base rules. `src/styles/global.ts` adopts shared primitive sheets. Component-local styles remain in their owning shadow root. Storybook/Vitest/CEM are development tooling and do not affect production bundling, caching, CSP or worker delivery.
- **Single-page fallback:** Every workflow and reserved path (`/`, `/data`, `/target`, `/models`, `/models/{num}`, `/results`, `/about`, `/privacy`, `/help`) MUST return the app shell. Production uses `"not_found_handling": "single-page-application"` in `wrangler.jsonc`; the dev server (`scripts/static-server.ts`) MUST fall back only for extension-less paths so a missing `.js`/`.css` still returns 404.
- **Content and dataset fragments:** `/content/*` and `/datasets/*` carry `X-Robots-Tag: noindex, nofollow` in `public/_headers`, are never `Disallow`ed in `robots.txt`, and are never linked directly with `<a href>`. Compiled fragments contain no inline scripts or third-party images (compatible with the production CSP).
- **Sample acquisition:** Build sources are downloaded, pinned and prepared before profiling; their generated CSVs are same-origin. Direct samples are pinned and profiled at build time but fetched by the browser when loaded. Requests omit credentials and referrers and the worker verifies the digest before parsing. The production CSP retains the COMPAS prefix and adds the pinned Palmer, Credit Card and approved Hugging Face redirect paths; see [sample-datasets.md](sample-datasets.md). Stored projects for retired IDs use local static column and target advice rather than fetching an obsolete descriptor.

- **Training assets.** The app bundles its integration entry as `/training.worker.js`. The locked Bun install resolves the tarball in `vendor/web-ml/` into `node_modules/web-ml`. The build verifies the installed manifest, public contract inputs and runtime hashes, then copies the prebuilt module graph, relative workers, WASM files and notices to `/web-ml/{version}-{graph-digest}/`. Serve JavaScript and WASM with their respective MIME types and preserve `wasm/` beside the worker modules. See the [contributor upgrade procedure](../README.md#upgrade-web-ml).
- **Training isolation.** Development and production serve COOP `same-origin` and COEP `require-corp`. Same-origin assets follow CORP `same-origin`. Allow-listed remote sample CSVs are fetched using CORS and verified with the descriptor hash. The isolated runtime probe exercises the app delivery headers in Chromium, Firefox and WebKit. The model service checks `crossOriginIsolated` before accepting an attempt.
- **Service Worker:** The application MUST implement an offline-first Progressive Web App (PWA) Service Worker to cache the compiled assets locally for instant subsequent loads. Navigation requests for any path above MUST be answered with the cached app shell.

## Routing, Flow Control, and Code Splitting

The workflow is specified in [workflow-steps.md](workflow-steps.md); routing, state and scroll behaviour are specified in [app-state-and-navigation.md](app-state-and-navigation.md) (hybrid router + store), and persistence in [state-and-storage.md](state-and-storage.md).

- **Hybrid state model:** _Where the user is_ is the URL (`/data`, `/target`, `/models`, `/models/{num}`, `/results`), driven by the History API. _What the user has done_ is in persisted Nanostores. There is no single application-wide finite state machine. A small model-lifecycle machine (`draft → training → trained`) covers the one genuinely sequential flow.
- **History router (framework-free):** `src/router/` is the only code that calls `history.pushState`, `history.replaceState` or reads `location`. Components render `<a href>`; the router intercepts same-origin clicks (never modified clicks). It sets `history.scrollRestoration = 'manual'` and owns per-step scroll memory (ignored when the viewport width has changed).
- **Navigation is never blocked by state:** The user can always navigate to any workflow page. State only decides what the page shows; a page that cannot display yet renders a `.notification` explaining why (e.g. "You need to train more than one model before you can compare results."). Redirects are limited to `/` → resume path and URLs that name no page (unknown paths, malformed model numbers), via `replaceState`.
- **Reserved routes:** `/about`, `/privacy`, `/help`, `/help/configure-model` and `/help/training-setup` render static content in a native `<dialog>` over the current workflow page. They are real history entries but are **never persisted** to application state. Content comes from the Markdown pipeline ([content-and-i18n.md](content-and-i18n.md)).
- **Dynamic Imports:** Feature modules MUST be loaded using dynamic `import()` statements to enforce code-splitting.
- **Browser history:** Back/Forward move between workflow pages and open/close reserved-route modals. Deep links and reloads restore the same page, and the base URL `/` resumes the last-viewed workflow page. Hydration runs before routing.

## Event Handling

- **Drag and Drop:** Always implement `e.preventDefault()` on `ondragover` events, or the browser will attempt to open the file instead of triggering `ondrop`.
- **TypeScript Casting:** When reading from native events, explicitly cast the target to safely access properties without compiler errors: `const target = e.target as HTMLInputElement;`

## Future Improvements

- Add a bun run doctor or setup-check command that reads the version files, checks the required tools and dependencies, and prints actionable fix instructions.
- Offer a pinned devcontainer or Codespaces configuration for contributors who prefer a preconfigured environment.
