# Beta release, asset cache invalidation, privacy-gated telemetry and Cloudflare CI/CD

**Status:** draft | **Updated:** 2026-11-22T16:22:03Z
**Authors:** Google Antigravity (Gemini 4 Argon High) | **Created:** 2026-11-21T19:43:46Z
**Verified by:** — | **Verified:** — | **Verification:** pending
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour:** `package.json` (L1–L70) omits a `"version"` field, omits `wrangler` from `devDependencies`, and provides no release versioning, changelog, lint, or Cloudflare deployment scripts. `wrangler.jsonc` (L1–L24) uses the legacy worker name `"web-ml-app"` (`specification/README.md` Known gap 10), sets `"preview_urls": false`, and points routes at placeholder `"app.example.com"`. In production builds (`scripts/build-assets.ts` L41–L164, `scripts/html.ts` L1–L92), only `app.js` and `style.css` receive content hashes via `writeRevvedFile`; Web Workers are emitted and spawned unhashed at `/storage.worker.js` (`src/features/data/ingestion/storage-client.ts` L182) and `/training.worker.js` (`src/features/models/training/training-service.ts` L285); `/content/{locale}/{domain}/index.json` and `/datasets/index.json` are fetched without build hashes; `scripts/html.ts` L68–L73 inlines the entire production stylesheet into `index.html` alongside `<link rel="stylesheet">` (`specification/README.md` Known gap 3); `public/_headers` (L1–L17) defines zero `Cache-Control` rules; and `public/robots.txt` (mandated by `specification/ARCHITECTURE.md` L25, L48) does not exist. There is no stale-asset recovery when an open tab encounters a replaced chunk or worker after a deployment, no global or worker exception reporting boundary, no opt-in beta event telemetry boundary (`src/types/state.ts` L7–L266, `content/en/pages/privacy-policy.md` L1–L9), no ESLint configuration despite `eslint-plugin-tsdoc` being installed (`specification/README.md` Known gap 7), no `SECURITY.md`, and no `.github/workflows/` CI/CD pipeline.

**Target behaviour:** `samata-ml` is versioned under SemVer starting at `0.1.0-beta.1` with a repeatable `scripts/release.ts` (`bun run version:release`) workflow, `CHANGELOG.md`, and build-time `APP_VERSION` injection. `wrangler.jsonc` is renamed to `"samata-ml"` with `"preview_urls": true` and paired with pinned `wrangler` deployment scripts (`deploy`, `deploy:dry-run`). Every production static asset (`app.<hash>.js`, `style.<hash>.css`, `storage.worker.<hash>.js`, `training.worker.<hash>.js`, `/chunks/*`, `/web-ml/*`, and `?v=<hash>` content/dataset manifests and fragments) is content-addressed and paired with explicit `Cache-Control` headers in `public/_headers`, duplicate CSS inlining is removed from `scripts/html.ts` (resolving Known gap 3), `public/robots.txt` is shipped, and stale tabs gracefully prompt a non-destructive reload when a deployment replaces workers or chunks. A removable, cookieless, beta-only telemetry and optional error-reporting boundary (`src/common/telemetry/`) enforces deterministic dataset/PII scrubbing and strict user opt-in (`telemetryConsent: 'unset' | 'granted' | 'declined'`), ready to wire to the chosen vendor once the human resolves the vendor research questions and trivial to disable (`BETA_TELEMETRY_ENABLED = 'false'`) at V1. ESLint + `eslint-plugin-tsdoc` (resolving Known gap 7), `SECURITY.md`, and a GitHub Actions CI/CD workflow (`.github/workflows/ci-deploy.yml`, gated on `vendor-web-ml-tarball.md`) automatically verify pull requests and deploy merges to `main` to Cloudflare.

**Why:** Establishes a reliable, low-friction beta release and patch pipeline with automatic Cloudflare deployment on merges to `main`, eliminates stale-cache bugs across workers and assets, enforces TSDoc and security hygiene in CI, and provides an architecture for strictly opt-in, cookieless beta telemetry and crash reporting that respects learner privacy and can be cleanly retired for V1.

## Scope

**In scope**

- SemVer project versioning (`"version": "0.1.0-beta.1"` in `package.json`), `CHANGELOG.md`, build-time `APP_VERSION` define/meta injection (`scripts/build-assets.ts`, `scripts/html.ts`, `src/types/env.d.ts`), and `scripts/release.ts` (`bun run version:release`).
- Cloudflare deployment setup: add pinned `wrangler` to `devDependencies`, rename worker `"web-ml-app"` → `"samata-ml"` in `wrangler.jsonc` (resolving Known gap 10), enable `"preview_urls": true`, and add `deploy` / `deploy:dry-run` scripts to `package.json`.
- End-to-end static asset cache invalidation: content-hash `storage.worker.<hash>.js` and `training.worker.<hash>.js` and inject `STORAGE_WORKER_URL` and `TRAINING_WORKER_URL` via `Bun.build` `define`; configure `Bun.build` chunk naming under `chunks/[name]-[hash].[ext]`; append build-time content hashes to `/content/{locale}/{domain}/index.json` and `/datasets/index.json` requests; remove duplicate CSS inlining from `scripts/html.ts` (resolving Known gap 3); add `Cache-Control` rules to `public/_headers`; and add `public/robots.txt`.
- Non-destructive stale-asset recovery (`src/common/release/stale-asset-recovery.ts` + shell banner in `src/app.ts`) when a background deployment invalidates a lazy chunk or worker script in an already-open tab.
- Cookieless, strictly opt-in beta telemetry and optional exception-reporting architecture (`src/common/telemetry/privacy-scrubber.ts`, `src/common/telemetry/telemetry-client.ts`), persisted `telemetryConsent` state (`src/types/state.ts`, `src/stores/app.store.ts`, `src/stores/persister.ts` at `STORAGE_VERSION = 1`), global and worker error hooks (`src/app.ts`, `src/features/data/ingestion/storage-client.ts`, `src/features/models/training/training-service.ts`), opt-in UI controls, and updated `content/en/pages/privacy-policy.md` (pending human resolution of the blocking vendor and UI placement questions).
- ESLint flat config (`eslint.config.mjs`) enforcing `eslint-plugin-tsdoc` (`tsdoc/syntax: 'error'`, resolving Known gap 7) and `SECURITY.md`.
- Adopting the shared, parameterised `agent-workflow` GitHub Actions CI/CD workflow (`.github/workflows/ci.yml`) configured with `samata-ml`'s repository options: `vendor/web-ml/` tarball SHA-256 verification, `AGENTS.md` verification commands (`format:check`, `lint`, `check`, `build`, `plans:check`, `test:stories`, `test:e2e`), and automatic Cloudflare deployment (`bun run deploy`) on pushes to `main` (coordinated with `../../../agent-workflow/specification/plans/github-pull-requests-and-ci.md` via upstream request `../../../agent-workflow/specification/requests/2026-11-22-parameterised-github-ci-cd-and-beta-activation.md`).

**Out of scope**

- Modifying `../web-ml` or changing how `web-ml` tarballs are packed (already delivered in `vendor/web-ml/web-ml-0.2.0.tgz` per `README.md` §Upgrade web-ml).
- Authoring standalone CI governance scripts (`close_plan.py --range`, `check-markdown-links.ts`, `check-spec-drift.ts`), branch ruleset JSON templates, or duplicate CI workflow generators outside `agent-workflow` (owned upstream by `../../../agent-workflow/specification/plans/github-pull-requests-and-ci.md` and requested in `../../../agent-workflow/specification/requests/2026-11-22-parameterised-github-ci-cd-and-beta-activation.md`).
- Implementing the offline-first PWA Service Worker (`specification/README.md` Known gap 6; deferred until post-beta caching behaviour settles so a service worker does not mask asset invalidation issues during rapid beta patching).
- Re-baselining the 9 pre-existing `tests/visual-parity.e2e.ts` failures or fixing the 24 feature contrast items tracked separately in `specification/HUMAN.md` §1.
- Adding cookie-based tracking, third-party `<script>` tags, session replay, or retaining any event tracking in V1.

**Constraints and invariants**

- **Strict privacy & beta-only telemetry invariant:** User datasets (filenames, row counts, column names, cell values, target names) and trained model artefacts must **never** leave the browser (`specification/VISION.md` §12). Event tracking exists **only** during the beta phase and must be completely disabled/removed at V1 via `BETA_TELEMETRY_ENABLED = 'false'`. No cookies, fingerprinting, or third-party `<script>` tags are permitted. Both exception tracking and event tracking are strictly opt-in (`telemetryConsent === 'granted'`); when `'unset'` or `'declined'`, zero network requests are made.
- **Backward-compatible `STORAGE_VERSION = 1` persistence:** `telemetryConsent: 'unset' | 'granted' | 'declined'` defaults to `'unset'` when absent from existing v1 `localStorage` blobs (`samata-ml:state`), preserving existing learner sessions without a destructive schema version bump.
- **Strict Content-Security-Policy & COOP/COEP isolation:** `public/_headers` must preserve `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`, `Cross-Origin-Resource-Policy: same-origin`, `script-src 'self' 'wasm-unsafe-eval'`, and allow only `'self'`, `https://raw.githubusercontent.com/propublica/compas-analysis/`, and (when `BETA_TELEMETRY_ENABLED === 'true'`) the single chosen telemetry ingestion origin in `connect-src`.
- **Repository conventions (CONV-1–4):** Every `.ts` and `.css` file under `src/`, `tests/`, `scripts/`, and `css/` must obey `tests/repository-conventions.test.ts` (kebab-case filenames with allowed role suffixes; zero Lit imports in `src/common/`).
- **Bun only & formatting:** Use `bun` and `bunx` exclusively (never `npm`, `yarn`, `pnpm`, or `npx`). Use British English in prose, docs, and UI copy, TSDoc on all exported TypeScript, and Prettier formatting (`bun run format`).

## Required reading

- `AGENTS.md` §Verification Commands, §Git workflow, §Rules — authoritative commands, branch workflow, and conventions.
- `specification/ARCHITECTURE.md` §Tech Stack & Tooling, §Directory Structure, §Delivery and Caching, §Future Improvements — asset URL, header, COOP/COEP, `robots.txt`, and no-inlining rules.
- `specification/VISION.md` §12 (`Privacy, Responsiveness, and Open-Source Longevity`) — local-only data processing mandate.
- `specification/standards-and-documentation.md` §Documentation Standards (TSDoc), §Naming and placement — TSDoc requirements and CONV-1–4 rules.
- `specification/state-and-storage.md` §3 (`Persisted Schema`), §5 (`UI State Persistence Rule`), §8 (`Versioning & Validation`) — v1 state validation and persistence rules.
- `specification/COMPONENTS.md` §4–§9 — Lit component conventions, i18n rules, and WCAG 2.2 AA testing requirements.
- `README.md` §Install Dependencies, §Upgrade web-ml — standalone `bun install --frozen-lockfile --ignore-scripts` and `vendor/web-ml/` checksum verification rules.

## Codebase context

Facts verified by `codebase-scout`, so downstream agents need not re-sweep the tree.

- **Relevant specifications:**
    - `specification/ARCHITECTURE.md` (status `partial`): L24 & L44 mandate no JS/CSS inlining into `index.html`; L25 & L48 mandate `public/robots.txt` and `X-Robots-Tag: noindex, nofollow` on `/content/*` and `/datasets/*`; L49 restricts production `connect-src`; L50–L51 specify `/training.worker.js`, `/web-ml/{version}-{graph-digest}/`, and COOP/COEP headers; L70–L75 list CI and `SECURITY.md` under Future Improvements.
    - `specification/README.md`: Known gap 3 (CSS inlining in `scripts/build-assets.ts` and `scripts/html.ts`), Known gap 6 (Service worker not installed), Known gap 7 (`eslint-plugin-tsdoc` installed without ESLint config, `lint` script, or CI), Known gap 10 (`wrangler.jsonc` and `VISION.md` say `web-ml-app` while repo/UI say `samata-ml`/`samatā.ml`).
    - `specification/standards-and-documentation.md` (status `partial`, L1–L17): mandates TSDoc (`@param`, `@returns`, `@throws`, `@example`) and `eslint-plugin-tsdoc` enforcement.
    - `specification/state-and-storage.md` (status `draft`, L28–L194, L234–L258, L281–L289): defines `PersistedAppState` (`STORAGE_VERSION = 1`, `onboarding: { welcomeDismissed: boolean }`) and UI state persistence registry.
    - `specification/components/welcome-modal.md` (status `implemented`, L1–L65) & `specification/components/sidebar.md` (status `implemented`, L1–L78): closed public APIs and visual parity tests (`WEL-AC-3`, `SIDE-AC-10/11`).
    - `specification/decision-checklist.md`: does not exist; evaluated against `create-plan` core decision checklist.
- **Relevant implementation:**
    - `package.json` L1–L70: `name: "samata-ml"` (L2), no `"version"` field; `scripts` L5–L32 (`build`, `server`, `test`, `test:e2e`, `storybook*`, `test:stories`, `typecheck`, `check`, `format*`, `plans:*`, `git:*`, `now`); `devDependencies` L33–L59 includes `eslint-plugin-tsdoc: "^0.5.4"` (L45) but omits `eslint`, `@typescript-eslint/parser`, and `wrangler`; `dependencies` L60–L68 resolves `"web-ml": "./vendor/web-ml/web-ml-0.2.0.tgz"` (L67).
    - `scripts/build-model-assets.ts` L1–L158: verifies `node_modules/web-ml` against `webMlVersion = '0.2.0'`, `webMlTarball = 'vendor/web-ml/web-ml-0.2.0.tgz'`, `WEB_ML_REVISION = 'sha256:82fc9163764805dde88ea1ca13eb3bd1a8a8a3f62d0eeb4930689c47028e76b0'`, 25 `publicFiles` (`publicDigest`), and 20 `runtimeHashes` without requiring a sibling `../web-ml` checkout.
    - `wrangler.jsonc` L1–L24: `name: "web-ml-app"` (L4), `compatibility_date: "2026-10-06"` (L5), `workers_dev: false` (L8), `preview_urls: false` (L11), `routes` L13–L18 (`app.example.com`), `assets` L20–L23 (`directory: "./dist"`, `not_found_handling: "single-page-application"`).
    - `public/_headers` L1–L17: `/*` sets strict CSP (L2), COOP/COEP/CORP (L3–L5), security headers (L6–L11); `/content/*` and `/datasets/*` set `X-Robots-Tag: noindex, nofollow` (L13–L17); zero `Cache-Control` headers. `public/robots.txt` is missing.
    - `index.html` L1–L13: links `/style.css` (L7) and `<script src="/app.js" type="module"></script>` (L11).
    - `scripts/build-assets.ts` L1–L164: exports `ProductionBuildResult` (L12–L15), `buildDevBundle` (L103–L125), `buildProductionBundle` (L130–L164). Bundles `src/app.ts`, `src/features/data/ingestion/storage.worker.ts`, and `src/features/models/training/training.worker.ts` with `splitting: true`, `naming: { entry: '[name].[ext]' }` (L50–L65), and `define: { DEBUG, WEB_ML_RUNTIME_URL, WEB_ML_RUNTIME_REVISION }`. In production (L150–L152), calls `writeRevvedFile` (`scripts/filesystem.ts` L61–L83) only on `app.js` and `style.css` (`<base>.<10-hex-sha256>.<ext>`), leaving workers unhashed at `/storage.worker.js` and `/training.worker.js`.
    - `scripts/html.ts` L1–L92: exports `BuildMode`, `HtmlAssets`, `templateVariables`, `replaceTemplateVariables`, `rewriteHtmlAssets`, `transformIndexHtml`. L68–L73 injects inline `<style data-inline-build="true">` in production.
    - `scripts/build-content.ts` L248–L250, L430–L557 & `src/common/content/content-loader.ts`: fragment URLs in `index.json` carry `?v=<12-hex-sha256>`, while `index.json` is fetched by path.
    - `scripts/generate-datasets.ts` L420–L563: descriptor, datasheet, and CSV URLs in `datasets/index.json` carry `?v=<12-hex-sha256>`, while `datasets/index.json` is fetched by path.
    - `scripts/certificates.ts` L1–L48 & `scripts/server.ts` L326–L348: `ensureHttpsCert()` auto-generates a self-signed `.cert/localhost.pem` + `localhost-key.pem` via `openssl` when missing; `playwright.config.ts` L1–L51 runs Chromium, Firefox, and WebKit against `https://localhost:3000` (`:3001` for `--dist`, `:3333` for mockups) with `ignoreHTTPSErrors: true`.
    - `src/app.ts` L1–L277: statically imports route views (L1–L10); exports `renderAppShell` (L131–L219) and `bootstrapApp` (L224–L269); has startup recovery (L141–L158) and save notices (L160–L178), but no global `error`/`unhandledrejection` listeners or stale-asset reload notice.
    - `src/features/data/ingestion/storage-client.ts` L53–L62, L179–L187: spawns `new Worker('/storage.worker.js', { type: 'module' })` without `onerror` or `onmessageerror` handlers.
    - `src/features/models/training/training-service.ts` L284–L285, L391–L437: spawns `new Worker('/training.worker.js', { type: 'module' })` and handles `port.onerror` (`'worker-crashed'`), `port.onmessageerror` (`'worker-protocol-error'`), and startup catch (`'worker-startup-failed'`).
    - `src/types/state.ts` L7–L266, `src/stores/app.store.ts` L1–L781, `src/stores/persister.ts` L115–L165: `STORAGE_VERSION = 1`, `PersistedAppState` validation in `validateAppState`.
    - `content/en/pages/privacy-policy.md` L1–L9: states `"Complete privacy is the only option... We don't even track pageviews."`
- **Tests and commands:**
    - `tests/repository-conventions.test.ts` L1–L125: enforces CONV-1 (kebab-case + single allowed suffix `.store`, `.styles`, `.worker`, `.stories`, `.test`, `.e2e`, `.d`), CONV-2/3 (custom element placement/class naming), and CONV-4 (no Lit imports under `src/common/`).
    - `tests/model-assets.test.ts` L83–L90: checks `public/_headers` isolation directives.
    - `tests/state-and-storage.test.ts` L1–L1154: validates `PersistedAppState` persistence and startup reconciliation.
    - Verification commands from `AGENTS.md`: `bun run check`, `bun test <path>`, `bun run typecheck`, `bun run build`, `bun run format <files>`, `bun run format:check`, `bun run test:e2e [file]`, `bun run test:stories`, `bun run plans:check`.
- **Web guidance:** None — no unfamiliar browser platform APIs introduced (`fetch` with `keepalive`, `window` `error`/`unhandledrejection` events, and HTTP `Cache-Control` headers are standard Baseline Widely Available APIs).
- **Visual reference:** `specification/mockups/ui-scaffold/00_first-load.html` and `specification/mockups/ui-scaffold/drafts/00-2_content-modal.html` — any opt-in telemetry control added to the `/privacy` modal or onboarding surface will require an unstyled semantic HTML draft in `specification/mockups/ui-scaffold/drafts/` (`specification/visual-design.md` §1.1) once blocking question Q3 is answered.
- **Domain skills:** `lit-architecture-planner` / `lit-component-implementer` for `T4` and `T5` where shell notification or privacy opt-in UI touches Lit components.
- **Assumptions requiring verification:**
    - Blocking questions Q1 (exception tracking vendor/platform), Q2 (beta-only event tracking vendor/platform), and Q3 (UI placement for the opt-in telemetry & error-reporting toggles, plus production custom domain for `wrangler.jsonc`) require human research and decision before T5 can be finalised and this plan submitted to `ready-for-review`.

## Technical decisions

| Decision                                                                                              | Chosen approach and rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Rejected alternative / trade-off                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 Cloudflare Workers Static Assets & `wrangler.jsonc` alignment                                      | Add pinned `wrangler` to `devDependencies`, rename `name` in `wrangler.jsonc` from `"web-ml-app"` to `"samata-ml"` (resolving Known gap 10), enable `"preview_urls": true`, and add `"deploy": "bun run build && bunx wrangler deploy"` and `"deploy:dry-run": "bun run build && bunx wrangler deploy --dry-run"` to `package.json`. Keeps deployment reproducible through Bun and aligns project naming across repo, UI, and Cloudflare (maintainer decision 2026-11-21).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Global unpinned `npx wrangler` (violates Bun-only and deterministic tooling rules). Keep `"web-ml-app"` (perpetuates Known gap 10).                                                                                                                                                                        |
| D2 SemVer lifecycle & `bun run version:release`                                                       | Start `package.json` `"version"` at `"0.1.0-beta.1"`, maintain `CHANGELOG.md`, inject `APP_VERSION` at build time via `Bun.build` `define` and `<meta name="app-version">` in `index.html`, and add `scripts/release.ts` (`bun run version:release <prerelease\|patch\|minor\|major> [--dry-run]`). Naming the script `version:release` avoids colliding with `agent-workflow`'s `bun run git:release` worktree command.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Use `npm version` (violates Bun-only policy and does not update `CHANGELOG.md` or run `samata-ml` gates). Reuse `git:release` (collides with `agent-workflow` worktree release command in `package.json` L29).                                                                                             |
| D3 Content-hashed workers, chunks, manifest URLs, no CSS inlining & `public/_headers` `Cache-Control` | In `scripts/build-assets.ts`, build `storage.worker.ts` and `training.worker.ts` first, rev them in production to `/storage.worker.<10-hex>.js` and `/training.worker.<10-hex>.js` via `writeRevvedFile`, and inject `STORAGE_WORKER_URL`, `TRAINING_WORKER_URL`, `CONTENT_INDEX_VERSION`, and `DATASETS_INDEX_VERSION` into the app build via `define`. Configure `Bun.build` with `naming: { entry: '[name].[ext]', chunk: 'chunks/[name]-[hash].[ext]' }`. Remove duplicate `<style data-inline-build="true">` injection from `scripts/html.ts` (resolving Known gap 3). Configure `public/_headers` with `Cache-Control: public, max-age=0, must-revalidate` on `/*`, `/index.html`, `/content/*/index.json`, and `/datasets/index.json`, and `Cache-Control: public, max-age=31536000, immutable` on `/app.*.js`, `/style.*.css`, `/storage.worker.*.js`, `/training.worker.*.js`, `/chunks/*`, and `/web-ml/*`. Add `public/robots.txt`.                                                       | Leave `/storage.worker.js` and `/training.worker.js` unhashed (causes silent protocol mismatches when browsers serve cached workers against a newly deployed `app.<hash>.js`). Keep duplicate inline CSS in `index.html` (doubles CSS transfer size and violates `ARCHITECTURE.md` §Delivery and Caching). |
| D4 Non-destructive stale-asset recovery across deployments                                            | Add framework-free `src/common/release/stale-asset-recovery.ts` that detects failed worker script loads (`worker-startup-failed` or initial worker `error` event before ready) and failed dynamic module imports, setting a reactive `$staleAssetNotice` atom rendered as an accessible `.notification.notification-alert` banner in `src/app.ts` with a **Reload Application** action (and a once-per-version `sessionStorage` guard so reload never loops). Because Nanostores and IndexedDB persist workflow state, reloading restores the learner's exact step.                                                                                                                                                                                                                                                                                                                                                                                                                                  | Auto-reload immediately without a loop guard or user notice (risks infinite reload loops on genuine network outages and violates WCAG 2.2 AA unexpected context-change expectations).                                                                                                                      |
| D5 Removable, cookieless, opt-in beta telemetry & optional error-reporting boundary                   | Isolate all telemetry behind `src/common/telemetry/privacy-scrubber.ts` and `src/common/telemetry/telemetry-client.ts`, gated by build-time `BETA_TELEMETRY_ENABLED` (`'true'` in beta, `'false'` in V1) and persisted `PersistedAppState.onboarding.telemetryConsent: 'unset' \| 'granted' \| 'declined'` (default `'unset'`, keeping `STORAGE_VERSION = 1`). Never use cookies, local anonymous user IDs that persist across opt-out, or third-party `<script>` tags. Both error reporting and beta event tracking are strictly opt-in and scrub all dataset/column/file identifiers via an explicit allowlist before sending via `fetch`.                                                                                                                                                                                                                                                                                                                                                         | Install full third-party analytics & replay SDKs directly in components (adds cookies, bloated bundles, and broad CSP exceptions; makes V1 removal invasive; risks leaking dataset or column names in breadcrumbs/DOM snapshots).                                                                          |
| D6 ESLint flat config for TSDoc (Known gap 7) & `SECURITY.md`                                         | Add `eslint` and `@typescript-eslint/parser` to `devDependencies`, author `eslint.config.mjs` enabling `eslint-plugin-tsdoc` (`tsdoc/syntax: 'error'`) across `src/**/*.ts` and `scripts/**/*.ts`, add `"lint": "bunx eslint src/ scripts/"` to `package.json`, and add `SECURITY.md`. Resolves Known gap 7 and `ARCHITECTURE.md` §Future Improvements.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Run `tsc --noEmit` only (TypeScript does not validate TSDoc tag syntax such as malformed `@param` or unescaped braces).                                                                                                                                                                                    |
| D7 Shared `agent-workflow` parameterised GitHub CI/CD template with `samata-ml` options               | Delegate shared CI/PR governance, 40-hex SHA action pinning, commit/link/spec-drift checks, and parameterised workflow templates to `agent-workflow` (`../../../agent-workflow/specification/plans/github-pull-requests-and-ci.md`, requested in `../../../agent-workflow/specification/requests/2026-11-22-parameterised-github-ci-cd-and-beta-activation.md`). Standardise `samata-ml`'s `package.json` scripts (`format:check`, `lint`, `check`, `build`, `plans:check`, `test:stories`, `test:e2e`, `deploy:dry-run`, `deploy`) and instantiate `.github/workflows/ci.yml` from `agent-workflow`'s template with `samata-ml`'s options: pre-install `vendor/web-ml/*.tgz.sha256` checksum verification, Playwright 3-browser E2E gate (`--grep-invert "PARITY\|SIDE-AC-11\|PH-AC-2"` until the 9 inherited visual-parity baseline failures in `HUMAN.md` §1 are re-baselined), and the serialized `deploy` job running `bun run deploy` (`bunx wrangler deploy`) on `push` to `refs/heads/main`. | Maintain a bespoke, unshared GitHub Actions workflow in `samata-ml` (duplicates governance, SHA-pinning, and commit/plan gates needed across `agent-workflow`, `web-ml`, and `samata-ml`).                                                                                                                 |

### Vendor research brief for blocking questions Q1 and Q2

Because `samata-ml` processes user datasets locally in the browser (`specification/VISION.md` §12), executes under a strict Content-Security-Policy (`script-src 'self' 'wasm-unsafe-eval'`), uses zero cookies, and will **remove all user event tracking at V1** while keeping error reporting optional, the table below compares the candidate platforms to support the human's decision on Q1 and Q2:

| Platform                                                                                                       | Role                                              | Privacy & cookieless posture                                                                                                                                                                                                                   | Bundle & CSP impact                                                                                                                                                                                     | V1 retirement / self-hosting                                                                                                            | Trade-offs                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Sentry** (via minimal Sentry Envelope `fetch` client or `@sentry/browser` with `defaultIntegrations: false`) | Exception tracking (Q1)                           | Cookieless when using custom envelope sender or disabling user IP/session storage (`sendDefaultPii: false`). Must pair with `privacy-scrubber.ts` so stack frames and error messages never include CSV filenames, column names, or row values. | Minimal envelope `fetch` client: ~2 KB, zero external scripts, 1 `connect-src` host (`https://*.ingest.sentry.io` or `https://*.ingest.de.sentry.io`). Full `@sentry/browser` SDK is ~25–35 KB gzipped. | Easy to keep optional in V1 or switch DSN to self-hosted **GlitchTip** (100% Sentry envelope API-compatible, open-source, lightweight). | Industry-standard stack trace symbolication and source-map upload in CI (`sentry-cli`), but requires disabling breadcrumb DOM/console scraping to prevent dataset leaks. |
| **GlitchTip** (self-hosted or cloud; Sentry protocol)                                                          | Exception tracking (Q1)                           | Open-source, Sentry-envelope compatible, no tracking cookies, EU/self-hosted control over retention and IP anonymisation.                                                                                                                      | Same ~2 KB envelope `fetch` poster as Sentry; 1 `connect-src` origin.                                                                                                                                   | Ideal if open-source self-hosting (`VISION.md` §12) is preferred for V1.                                                                | Narrower UI than Sentry SaaS, though 100% wire-compatible with Sentry DSNs and source maps.                                                                              |
| **Plausible** or **Umami** (Cloud EU or self-hosted)                                                           | Beta event tracking (Q2)                          | Built specifically for cookieless, GDPR/PECR-compliant aggregate event counting (`POST /api/event`). Stores no persistent user profiles or cross-session identifiers.                                                                          | ~1 KB `fetch` wrapper in `src/common/telemetry/telemetry-client.ts`; 1 `connect-src` origin; zero cookies or `localStorage` SDK state.                                                                  | Trivial to decommission at V1 (`BETA_TELEMETRY_ENABLED = 'false'`). Umami and Plausible Community Edition can also run self-hosted.     | Aggregate funnel/event counts only (`dataset_loaded`, `model_trained`), not per-user cohort retention—which aligns strongly with `samata-ml`'s privacy ethos.            |
| **PostHog** (EU Cloud or self-hosted, via stateless HTTP `/capture/` API)                                      | Unified Beta event + exception tracking (Q1 + Q2) | Can be called cookieless via direct `POST /capture/` with an ephemeral per-session random ID when opted in (`$process_person_profile: false`).                                                                                                 | ~2 KB `fetch` adapter; single `connect-src` origin (`https://eu.i.posthog.com`) for both beta events and `$exception` events.                                                                           | Single vendor for beta; at V1, disable non-error events via `BETA_TELEMETRY_ENABLED = 'false'` or retire entirely.                      | Full `posthog-js` SDK is heavy and defaults to cookies/session recording; **must** use the lightweight stateless `fetch` endpoint instead of the full SDK.               |
| **Mixpanel** or **Segment** (via HTTP track API)                                                               | Beta event tracking (Q2)                          | Designed around `distinct_id` user profiling; requires explicit opt-in and ephemeral IDs to avoid persistent user tracking.                                                                                                                    | ~2 KB `fetch` adapter to `api-eu.mixpanel.com` or `api.segment.io`; 1 `connect-src` origin.                                                                                                             | Decommissioned at V1 via `BETA_TELEMETRY_ENABLED = 'false'`.                                                                            | Commercial user-centric analytics mindset is a weaker philosophical fit for an open-source, privacy-first educational tool than Plausible, Umami, or GlitchTip/Sentry.   |

**Planner recommendation for Q1 & Q2:**

1. **Architecture now:** Implement the vendor-agnostic `src/common/telemetry/` boundary with deterministic PII/dataset scrubbing and strict opt-in gating (`telemetryConsent === 'granted'`).
2. **For Q1 (Exceptions):** Use a **minimal ~2 KB Sentry Envelope `fetch` poster** (compatible with both **Sentry EU ingest** and self-hosted **GlitchTip**) with source maps uploaded in GitHub CI, and zero breadcrumb/DOM/console scraping.
3. **For Q2 (Beta-only Events):** Use **Umami** or **Plausible** via a 50-line stateless `fetch` call (`POST /api/event` / `POST /api/send`) with an ephemeral per-page-load token (zero cookies, zero persistent user profile), and disable it at V1 via `BETA_TELEMETRY_ENABLED = 'false'`.

### Interfaces and behaviour

#### A. Versioning, build defines & `scripts/release.ts`

- `package.json`:
    - Add `"version": "0.1.0-beta.1"` after `"name": "samata-ml"`.
    - Add scripts:
        - `"version:release": "bun run scripts/release.ts"`
        - `"deploy": "bun run build && bunx wrangler deploy"`
        - `"deploy:dry-run": "bun run build && bunx wrangler deploy --dry-run"`
        - `"lint": "bunx eslint src/ scripts/"`
- `src/types/env.d.ts`:
    ```typescript
    declare const DEBUG: boolean;
    declare const APP_VERSION: string;
    declare const BETA_TELEMETRY_ENABLED: boolean;
    declare const STORAGE_WORKER_URL: string;
    declare const TRAINING_WORKER_URL: string;
    declare const CONTENT_INDEX_VERSION: string;
    declare const DATASETS_INDEX_VERSION: string;
    declare const WEB_ML_RUNTIME_URL: string;
    declare const WEB_ML_RUNTIME_REVISION: string;
    ```
- `scripts/release.ts`:
    - Exports pure helpers `parseSemVer(version: string)`, `bumpSemVer(version: string, bump: 'prerelease' | 'patch' | 'minor' | 'major', preid = 'beta'): string`, and `formatChangelogEntry(version: string, isoDate: string, notes: string[]): string` for unit testing in `tests/release.test.ts`.
    - CLI flow (`bun run version:release <prerelease|patch|minor|major> [--dry-run]`):
        1. Validates the argument and reads `"version"` from `package.json`.
        2. Computes next SemVer (`0.1.0-beta.1` → `0.1.0-beta.2` on `prerelease`, or `0.1.0` on `patch`).
        3. In non-dry-run mode, verifies clean git working tree (`git status --porcelain`), runs `bun run format:check`, `bun run lint`, `bun run check`, `bun run build`, and `bun run plans:check`, updates `package.json` and `CHANGELOG.md`, formats both, and prints the exact `git add package.json CHANGELOG.md && git commit -m "chore: release v<version>" && git tag -a v<version> -m "Release v<version>"` instructions (or executes them when `--commit` is passed under maintainer approval).

#### B. Content-hashed workers, chunks, manifests & `public/_headers`

- Build order in `scripts/build-assets.ts`:
    1. Run `buildModelAssets(outDir)`, `buildContent({ outDir })`, and `generateSampleDatasets({ outDir })`.
    2. Compute 12-hex SHA-256 digests of `{outDir}/content/en/pages/index.json` + `{outDir}/content/en/models/index.json` + `{outDir}/content/en/glossary/index.json` → `CONTENT_INDEX_VERSION` and `{outDir}/datasets/index.json` → `DATASETS_INDEX_VERSION`.
    3. Bundle worker entrypoints (`storage.worker.ts`, `training.worker.ts`, plus `runtime.worker.ts` when `SAMATA_TRAINING_RUNTIME_PROBE === '1'`) with `define: { DEBUG, APP_VERSION, WEB_ML_RUNTIME_URL, WEB_ML_RUNTIME_REVISION }`.
    4. In production (`buildProductionBundle`), rev `storage.worker.js` → `storage.worker.<10-hex>.js` and `training.worker.js` → `training.worker.<10-hex>.js` via `writeRevvedFile` (which deletes the unhashed worker files). In dev (`buildDevBundle`), keep `/storage.worker.js` and `/training.worker.js`.
    5. Bundle `src/app.ts` with `splitting: true`, `naming: { entry: '[name].[ext]', chunk: 'chunks/[name]-[hash].[ext]' }`, and `define` including `STORAGE_WORKER_URL: JSON.stringify('/' + storageWorkerFile)`, `TRAINING_WORKER_URL: JSON.stringify('/' + trainingWorkerFile)`, `CONTENT_INDEX_VERSION`, `DATASETS_INDEX_VERSION`, `APP_VERSION`, and `BETA_TELEMETRY_ENABLED`.
    6. In production, rev `app.js` → `app.<10-hex>.js` and `style.css` → `style.<10-hex>.css` via `writeRevvedFile`, and rewrite `index.html` via `transformIndexHtml` (with `<meta name="app-version" content="${appVersion}" />` and **no** `<style data-inline-build="true">` inlining).
- `ProductionBuildResult` in `scripts/build-assets.ts`:
    ```typescript
    export interface ProductionBuildResult {
    	jsFile: string;
    	cssFile: string;
    	storageWorkerFile: string;
    	trainingWorkerFile: string;
    	appVersion: string;
    }
    ```
- Worker instantiation updates:
    - `src/features/data/ingestion/storage-client.ts` L182: `new Worker(typeof STORAGE_WORKER_URL !== 'undefined' ? STORAGE_WORKER_URL : '/storage.worker.js', { type: 'module' })`.
    - `src/features/models/training/training-service.ts` L285: `new Worker(typeof TRAINING_WORKER_URL !== 'undefined' ? TRAINING_WORKER_URL : '/training.worker.js', { type: 'module' })`.
- Manifest URL cache-busting:
    - `src/common/content/content-loader.ts`: appends `?v=${CONTENT_INDEX_VERSION}` when `typeof CONTENT_INDEX_VERSION === 'string' && CONTENT_INDEX_VERSION.length > 0`.
    - `src/features/data/sample-datasets.ts` (or dataset catalogue loader): appends `?v=${DATASETS_INDEX_VERSION}` when fetching `/datasets/index.json`.
- `public/_headers` `Cache-Control` rules:
    - Under `/*`: `Cache-Control: public, max-age=0, must-revalidate`
    - Under `/app.*.js`, `/style.*.css`, `/storage.worker.*.js`, `/training.worker.*.js`, `/chunks/*`, `/web-ml/*`: `Cache-Control: public, max-age=31536000, immutable`
- `public/robots.txt`:
    ```text
    User-agent: *
    Allow: /
    ```

#### C. Stale-tab chunk/worker load recovery (`src/common/release/stale-asset-recovery.ts`)

- Framework-free module under `src/common/release/stale-asset-recovery.ts` (zero Lit imports per CONV-4):
    - Exports `$staleAssetDetected: ReadableAtom<boolean>`, `isStaleAssetError(error: unknown): boolean`, `reportStaleAssetError(error: unknown): boolean`, `reloadForUpdatedRelease(storage?: Storage, reload?: () => void): boolean`, and `resetStaleAssetStateForTests(): void`.
    - Matches dynamic import / module script network failures (`TypeError` matching `/Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i` or worker script load error before handshake).
    - `reloadForUpdatedRelease` writes `samata-ml:last-stale-reload = APP_VERSION` to `sessionStorage` and calls `location.reload()` only if that exact version has not already triggered an automatic/prompted reload in the current tab session.
    - `src/app.ts` subscribes to `$staleAssetDetected` and renders a top-of-`<main>` `.notification.notification-alert` banner (`role="alert"`) with translated message (_"A newer version of samatā.ml is available. Reload to continue with your saved progress."_) and a **Reload** button.

#### D. Cookieless, opt-in beta telemetry & exception reporting (`src/common/telemetry/`)

- State schema (`src/types/state.ts`):
    - `export type TelemetryConsent = 'unset' | 'granted' | 'declined';`
    - `PersistedAppState.onboarding`: `{ welcomeDismissed: boolean; telemetryConsent?: TelemetryConsent }` (normalised to `'unset'` when absent in `validateAppState` in `src/stores/persister.ts`, keeping `STORAGE_VERSION = 1`).
    - Store action `setTelemetryConsent(consent: 'granted' | 'declined'): void` in `src/stores/app.store.ts` performs an immediate prompt write via `persister.ts`; when set to `'declined'`, any in-memory session correlation token is wiped immediately.
- Privacy scrubber (`src/common/telemetry/privacy-scrubber.ts`, framework-free):
    - Exports `scrubExceptionPayload(input: RawExceptionInput): ScrubbedExceptionPayload` and `scrubTelemetryEvent(event: AllowedBetaEvent): ScrubbedTelemetryEvent`.
    - Allowlisted event names only: `'app_bootstrapped' | 'sample_dataset_selected' | 'custom_dataset_uploaded' | 'target_selected' | 'model_chosen' | 'training_started' | 'training_completed' | 'training_failed' | 'results_viewed'`.
    - Allowlisted event properties only: `{ appVersion: string; routeSection: 1 | 2 | 3 | 4; sampleId?: string; rowBucket?: '1-100' | '101-1000' | '1001-10000' | '10000+'; columnCountBucket?: '1-10' | '11-50' | '50+'; targetType?: ColumnType; modelId?: string; methodology?: 'one_shot' | 'nested_cv'; durationBucketMs?: '<1s' | '1-5s' | '5-30s' | '30s+'; errorCode?: string }`.
    - **Forbidden and stripped by construction:** custom upload filenames, dataset names, column names, category labels, cell values, raw stack local values, full filesystem paths (normalised to repo-relative module basenames), query strings, and user IP/user-agent fingerprinting.
- Telemetry client (`src/common/telemetry/telemetry-client.ts`, framework-free):
    - Exports `initTelemetry(options)`, `reportException(error: unknown, context: ExceptionContext): void`, `trackBetaEvent(event: AllowedBetaEvent): void`.
    - Returns immediately as a strict no-op unless:
        1. `getTelemetryConsent() === 'granted'`, AND
        2. For events: `BETA_TELEMETRY_ENABLED === true` and `BETA_EVENT_ENDPOINT` is non-empty, AND
        3. For exceptions: `EXCEPTION_INGEST_ENDPOINT` is non-empty.
    - Uses `fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true, credentials: 'omit' })` (`credentials: 'omit'` prevents the browser from ever sending or storing cookies on telemetry requests!). Swallows all network failures silently so telemetry never disrupts the learner.

## Specification changes

- [ ] `specification/ARCHITECTURE.md` §Delivery and Caching and §Future Improvements — state that production builds content-hash `app.<hash>.js`, `style.<hash>.css`, `storage.worker.<hash>.js`, `training.worker.<hash>.js`, and code-split `/chunks/*`, version `/content/**/index.json` and `/datasets/index.json` fetches with `?v=<hash>`, serve `public/robots.txt` and explicit `Cache-Control` rules in `public/_headers`, never inline CSS into `index.html`, and run automated verification and Cloudflare deployment in GitHub Actions CI; status remains `partial`.
- [ ] `specification/standards-and-documentation.md` §Documentation Standards (TSDoc) — state that `eslint.config.mjs` and `bun run lint` enforce `eslint-plugin-tsdoc` across `src/` and `scripts/` in local checks and CI; status transitions `partial` → `implemented`.
- [ ] `specification/state-and-storage.md` §3 (`Persisted Schema`) and §5 (`UI State Persistence Rule`) — add optional `onboarding.telemetryConsent: 'unset' | 'granted' | 'declined'` (default `'unset'`) to `PersistedAppState` at `STORAGE_VERSION = 1` and register it in the §5 UI state persistence table; status remains `draft`.
- [ ] `specification/README.md` §Specs and §Known gaps — update `standards-and-documentation.md` status to `implemented`, mark Known gaps 3 (CSS inlining), 7 (Linting), and 10 (Product name in `wrangler.jsonc`) as `_Resolved._`, and verify status alignment.
- [ ] `specification/FUTURE.md` §Engineering — remove the delivered CI workflow, TSDoc lint, and `SECURITY.md` items once implemented.
- [ ] `specification/HUMAN.md` §1 and §7 — add and then resolve the beta telemetry vendor & UI placement decision item, and update the Known gaps 3, 7, 10 backlog entry.

## Implementation tasks

### T1 — SemVer versioning, `CHANGELOG.md`, `wrangler.jsonc` alignment and release scripts

- **Depends on:** None
- **Risk:** routine
- **Likely files:** `package.json`, `bun.lock`, `wrangler.jsonc`, `CHANGELOG.md`, `scripts/release.ts`, `src/types/env.d.ts`, `tests/release.test.ts`
- **Must not touch:** `src/features/`, `src/components/`, `src/stores/`, `src/router/`, `css/`, `specification/mockups/` — no UI component, store, router, style, or mockup changes in T1.
- **Implementation:**
    1. Record the pre-change `bun run check` baseline in the implementation log.
    2. Install `wrangler` as a pinned `devDependency` via `bun add -d --exact wrangler` (or if offline in sandbox, defer package install to T3 alongside `eslint` and verify lockfile cleanliness). Add `"version": "0.1.0-beta.1"` to `package.json`, and add `"version:release": "bun run scripts/release.ts"`, `"deploy": "bun run build && bunx wrangler deploy"`, and `"deploy:dry-run": "bun run build && bunx wrangler deploy --dry-run"` to `package.json` `scripts`.
    3. Update `wrangler.jsonc`: change `"name": "web-ml-app"` to `"name": "samata-ml"` (resolving Known gap 10) and set `"preview_urls": true`.
    4. Declare `APP_VERSION`, `BETA_TELEMETRY_ENABLED`, `STORAGE_WORKER_URL`, `TRAINING_WORKER_URL`, `CONTENT_INDEX_VERSION`, and `DATASETS_INDEX_VERSION` in `src/types/env.d.ts`.
    5. Create `CHANGELOG.md` following Keep a Changelog format with the initial `## [0.1.0-beta.1] - 2026-11-21` section.
    6. Create `scripts/release.ts` with full TSDoc comments exporting `parseSemVer`, `bumpSemVer`, and `formatChangelogEntry`, plus a CLI entrypoint supporting `prerelease`, `patch`, `minor`, and `major` with `--dry-run`.
    7. Author unit tests in `tests/release.test.ts` covering SemVer parsing, `prerelease`/`patch`/`minor`/`major` transitions, invalid SemVer rejection, changelog entry insertion, and `wrangler.jsonc` project name and SPA asset configuration.
    8. Run `bun run format` on all touched files.
- **Acceptance criteria:**
    - [ ] `REL-VER-1` — `package.json` declares `"version": "0.1.0-beta.1"` and `"name": "samata-ml"`, and `wrangler.jsonc` declares `"name": "samata-ml"` with `"preview_urls": true` and `"not_found_handling": "single-page-application"`.
    - [ ] `REL-VER-2` — `bumpSemVer('0.1.0-beta.1', 'prerelease')` returns `'0.1.0-beta.2'`, `bumpSemVer('0.1.0-beta.2', 'patch')` returns `'0.1.0'`, `bumpSemVer('0.1.0', 'patch')` returns `'0.1.1'`, and malformed version strings throw a descriptive `Error`.
    - [ ] `REL-VER-3` — `bun run version:release prerelease --dry-run` exits 0 and prints the proposed version bump and changelog section without modifying `package.json` or `CHANGELOG.md`.
- **Verification:** `bun test tests/release.test.ts`; `bun run check`; `bun run format:check`.
- **Progress:** [ ] Not started

### T2 — Full static asset cache invalidation, worker hashing, `Cache-Control` headers, no CSS inlining and `robots.txt`

- **Depends on:** T1
- **Risk:** needs care — modifies `scripts/build-assets.ts`, `scripts/html.ts`, worker spawn URLs, and `public/_headers`; must preserve dev server HMR (`bun run server`), production server (`bun run server --dist`), and COOP/COEP cross-origin isolation.
- **Likely files:** `scripts/build-assets.ts`, `scripts/build.ts`, `scripts/html.ts`, `public/_headers`, `public/robots.txt`, `src/features/data/ingestion/storage-client.ts`, `src/features/models/training/training-service.ts`, `src/common/content/content-loader.ts`, `src/features/data/sample-datasets.ts`, `tests/build-cache-invalidation.test.ts`, `tests/model-assets.test.ts`
- **Must not touch:** `src/components/`, `src/stores/`, `src/router/`, `css/`, `specification/mockups/` — no component, store, router, CSS token, or mockup changes.
- **Implementation:**
    1. Update `scripts/html.ts`:
        - Remove the duplicate `<style data-inline-build="true">${options.inlineCss}</style>` injection from `transformIndexHtml` (resolving Known gap 3) so production `index.html` links `/style.<10-hex>.css` without inlining CSS.
        - Inject `<meta name="app-version" content="${appVersion}" />` into `<head>` during `transformIndexHtml`.
    2. Update `scripts/build-assets.ts` per Interfaces §B:
        - Compute 12-hex SHA-256 digests `CONTENT_INDEX_VERSION` (over the emitted `content/**/index.json` files) and `DATASETS_INDEX_VERSION` (over `{outDir}/datasets/index.json`).
        - Bundle worker entrypoints (`storage.worker.ts`, `training.worker.ts`, and `runtime.worker.ts` when `SAMATA_TRAINING_RUNTIME_PROBE === '1'`) first. In production (`buildProductionBundle`), rev `storage.worker.js` → `storage.worker.<10-hex>.js` and `training.worker.js` → `training.worker.<10-hex>.js` using `writeRevvedFile` (removing unhashed worker files from `dist/`). In development (`buildDevBundle`), keep `/storage.worker.js` and `/training.worker.js`.
        - Bundle `src/app.ts` with `splitting: true`, `naming: { entry: '[name].[ext]', chunk: 'chunks/[name]-[hash].[ext]' }`, and `define` setting `DEBUG`, `APP_VERSION`, `BETA_TELEMETRY_ENABLED`, `STORAGE_WORKER_URL`, `TRAINING_WORKER_URL`, `CONTENT_INDEX_VERSION`, `DATASETS_INDEX_VERSION`, `WEB_ML_RUNTIME_URL`, and `WEB_ML_RUNTIME_REVISION`.
        - Return `{ jsFile, cssFile, storageWorkerFile, trainingWorkerFile, appVersion }` from `buildProductionBundle()`.
    3. Update `src/features/data/ingestion/storage-client.ts` (L182) to use `typeof STORAGE_WORKER_URL !== 'undefined' ? STORAGE_WORKER_URL : '/storage.worker.js'` and `src/features/models/training/training-service.ts` (L285) to use `typeof TRAINING_WORKER_URL !== 'undefined' ? TRAINING_WORKER_URL : '/training.worker.js'`.
    4. Update `src/common/content/content-loader.ts` and `src/features/data/sample-datasets.ts` so `index.json` fetches append `?v=${CONTENT_INDEX_VERSION}` and `?v=${DATASETS_INDEX_VERSION}` respectively when those constants are non-empty.
    5. Update `public/_headers`:
        - Add `Cache-Control: public, max-age=0, must-revalidate` under `/*`, `/index.html`, `/content/*/index.json`, and `/datasets/index.json`.
        - Add `Cache-Control: public, max-age=31536000, immutable` blocks for `/app.*.js`, `/style.*.css`, `/storage.worker.*.js`, `/training.worker.*.js`, `/chunks/*`, and `/web-ml/*`.
        - Create `public/robots.txt` with `User-agent: *\nAllow: /\n` (no `Disallow` on `/content/*` or `/datasets/*`, per `ARCHITECTURE.md` L48).
    6. Author `tests/build-cache-invalidation.test.ts` verifying:
        - `buildProductionBundle()` emits content-hashed `app.<10-hex>.js`, `style.<10-hex>.css`, `storage.worker.<10-hex>.js`, and `training.worker.<10-hex>.js` in `dist/`, removes unrevved `app.js`, `style.css`, `storage.worker.js`, and `training.worker.js`, and copies `robots.txt` and `_headers`.
        - `dist/index.html` links `/app.<10-hex>.js` and `/style.<10-hex>.css`, includes `<meta name="app-version" content="0.1.0-beta.1" />`, and contains **zero** `<style data-inline-build="true">` tags.
        - `dist/app.<10-hex>.js` embeds the exact revved `/storage.worker.<10-hex>.js` and `/training.worker.<10-hex>.js` paths and `?v=` manifest digests.
        - Modifying a worker source input changes its emitted 10-hex filename and the worker URL embedded in `dist/app.<10-hex>.js`.
        - `public/_headers` defines `must-revalidate` for shell/manifests and `immutable` for fingerprinted assets while preserving COOP/COEP/CORP and CSP headers.
    7. Run `bun run format` on all edited files.
- **Acceptance criteria:**
    - [ ] `REL-CACHE-1` — `bun run build` emits hashed `app.<10-hex>.js`, `style.<10-hex>.css`, `storage.worker.<10-hex>.js`, and `training.worker.<10-hex>.js` in `dist/`, removes the unhashed filenames, and writes `dist/robots.txt`.
    - [ ] `REL-CACHE-2` — `dist/index.html` contains zero inline `<style data-inline-build="true">` blocks (Known gap 3 resolved), references root-absolute `/style.<10-hex>.css` and `/app.<10-hex>.js`, and carries `<meta name="app-version" content="0.1.0-beta.1">`.
    - [ ] `REL-CACHE-3` — `public/_headers` specifies `Cache-Control: public, max-age=0, must-revalidate` for the app shell and `index.json` manifests, and `Cache-Control: public, max-age=31536000, immutable` for hashed JS, CSS, worker, chunk, and `/web-ml/*` paths, while keeping COOP `same-origin` and COEP `require-corp`.
    - [ ] `REL-CACHE-4` — End-to-end training runtime and dataset ingestion succeed against both dev (`:3000`) and production (`--dist` `:3001`) servers in Playwright (`bun run test:e2e tests/training-runtime.e2e.ts`).
- **Verification:** `bun test tests/build-cache-invalidation.test.ts`; `bun test tests/model-assets.test.ts`; `bun run check`; `bun run build`; `bun run test:e2e tests/training-runtime.e2e.ts`; `bun run format:check`.
- **Progress:** [ ] Not started

### T3 — Stale-tab chunk and worker load recovery across deployments

- **Depends on:** T2
- **Risk:** routine
- **Likely files:** `src/common/release/stale-asset-recovery.ts`, `src/app.ts`, `src/features/data/ingestion/storage-client.ts`, `src/features/models/training/training-service.ts`, `tests/stale-asset-recovery.test.ts`, `tests/app-shell.e2e.ts`
- **Must not touch:** `src/components/`, `src/stores/`, `css/`, `specification/mockups/` — uses existing shared `.notification.notification-alert` and `.btn` primitives in `src/app.ts`.
- **Implementation:**
    1. Create `src/common/release/stale-asset-recovery.ts` (framework-free, zero Lit imports per CONV-4) implementing `$staleAssetDetected`, `isStaleAssetError`, `reportStaleAssetError`, `reloadForUpdatedRelease`, and `resetStaleAssetStateForTests` per Interfaces §C.
    2. In `src/features/data/ingestion/storage-client.ts` (`StorageClientImpl`), attach `this.worker.addEventListener('error', ...)` and `this.worker.addEventListener('messageerror', ...)` so worker load or runtime errors reject pending requests cleanly and call `reportStaleAssetError` when the worker fails to load before its first message.
    3. In `src/features/models/training/training-service.ts`, when `runWorker` encounters `'worker-startup-failed'` or an initial script-load `onerror`, pass the failure through `reportStaleAssetError`.
    4. In `src/app.ts`, subscribe to `$staleAssetDetected`, wire a window `'unhandledrejection'` check for dynamic module import failures (`isStaleAssetError`), and render an accessible `.notification.notification-alert` banner (`role="alert"`) at the top of `<main id="content">` with a translated notice and a **Reload** button calling `reloadForUpdatedRelease()`.
    5. Add unit tests in `tests/stale-asset-recovery.test.ts` (testing positive chunk/worker error matching, negative ordinary runtime error rejection, and `sessionStorage` single-reload loop protection) and an E2E check in `tests/app-shell.e2e.ts`.
    6. Run `bun run format` on all touched files.
- **Acceptance criteria:**
    - [ ] `REL-STALE-1` — `isStaleAssetError` returns `true` for browser dynamic-import fetch errors (`Failed to fetch dynamically imported module`, `Importing a module script failed`) and initial worker script-load errors, and `false` for ordinary dataset validation or training failures.
    - [ ] `REL-STALE-2` — `reloadForUpdatedRelease` triggers `reload()` on first invocation for `APP_VERSION` and returns `false` without reloading a second time in the same `sessionStorage` session for the same `APP_VERSION`.
    - [ ] `REL-STALE-3` — When `$staleAssetDetected` becomes `true`, `src/app.ts` renders a `.notification.notification-alert` banner (`role="alert"`) with a keyboard-focusable **Reload** button that passes axe accessibility checks.
- **Verification:** `bun test tests/stale-asset-recovery.test.ts`; `bun test tests/repository-conventions.test.ts`; `bun run check`; `bun run test:e2e tests/app-shell.e2e.ts`; `bun run format:check`.
- **Progress:** [ ] Not started

### T4 — Cookieless, opt-in beta telemetry and exception-reporting boundary with deterministic privacy scrubbing

- **Depends on:** T1, T3
- **Risk:** needs care — touches persisted state validation (`src/types/state.ts`, `src/stores/persister.ts`) and error hooks; must guarantee zero dataset/column/file leakage, zero cookies, and 100% backward compatibility with `STORAGE_VERSION = 1`.
- **Likely files:** `src/types/state.ts`, `src/stores/app.store.ts`, `src/stores/persister.ts`, `src/common/telemetry/privacy-scrubber.ts`, `src/common/telemetry/telemetry-client.ts`, `src/app.ts`, `src/features/data/ingestion/storage-client.ts`, `src/features/models/training/training-service.ts`, `tests/telemetry-privacy.test.ts`, `tests/state-and-storage.test.ts`
- **Must not touch:** `css/`, `specification/mockups/` — no CSS or normative mockup changes.
- **Implementation:**
    1. Extend `src/types/state.ts` (`PersistedAppState.onboarding`) with `telemetryConsent?: 'unset' | 'granted' | 'declined'` (default `'unset'` in `INITIAL_APP_STATE`), keeping `STORAGE_VERSION = 1`.
    2. Update `validateAppState` in `src/stores/persister.ts` so `onboarding.telemetryConsent` accepts `'unset' | 'granted' | 'declined'` or `undefined` (normalised to `'unset'`), rejecting any other value type. Add `setTelemetryConsent(consent: 'granted' | 'declined')` action to `src/stores/app.store.ts`.
    3. Create `src/common/telemetry/privacy-scrubber.ts` (framework-free, zero Lit imports per CONV-4) implementing `scrubExceptionPayload` and `scrubTelemetryEvent` per Interfaces §D:
        - Strictly allowlist event names and bucketed metadata fields (`rowBucket`, `columnCountBucket`, `durationBucketMs`, `sampleId` only when `source === 'sample'`, never custom dataset `name` or `id`, never `features` or `target` column names).
        - Redact quoted strings, file paths, URLs, emails, and any known active dataset/column names from exception messages and stack frames.
    4. Create `src/common/telemetry/telemetry-client.ts` (framework-free) implementing `initTelemetry`, `reportException`, and `trackBetaEvent` per Interfaces §D:
        - Checks `$appState.get().onboarding.telemetryConsent === 'granted'` before constructing or sending any payload.
        - Uses `fetch(..., { method: 'POST', credentials: 'omit', keepalive: true })` so cookies are never sent or accepted.
        - When `BETA_TELEMETRY_ENABLED` is `false` (V1 mode), `trackBetaEvent` is a compile-time/runtime no-op.
    5. Wire global `window` `'error'` and `'unhandledrejection'` listeners in `src/app.ts` and worker crash hooks in `storage-client.ts` and `training-service.ts` to `reportException`.
    6. Author comprehensive unit tests in `tests/telemetry-privacy.test.ts` covering:
        - Zero network calls when `telemetryConsent` is `'unset'` or `'declined'`, or when `BETA_TELEMETRY_ENABLED` is `false`.
        - Immediate cessation of tracking when a user transitions from `'granted'` to `'declined'`.
        - Adversarial scrubbing tests proving that exceptions and events containing custom CSV filenames (`patients_secret.csv`), column names (`ssn`, `income`, `diagnosis`), or row values never appear in the serialized request body.
        - Verification that `fetch` is always called with `credentials: 'omit'`.
    7. Add backward-compatibility tests in `tests/state-and-storage.test.ts` verifying legacy v1 state blobs without `telemetryConsent` hydrate cleanly to `'unset'`.
    8. Run `bun run format` on all touched files.
- **Acceptance criteria:**
    - [ ] `REL-TELEM-1` — Legacy v1 `samata-ml:state` JSON without `telemetryConsent` hydrates with `onboarding.telemetryConsent === 'unset'` at `STORAGE_VERSION = 1`, and `setTelemetryConsent('granted' | 'declined')` persists across reloads.
    - [ ] `REL-TELEM-2` — When `telemetryConsent` is `'unset'` or `'declined'`, `trackBetaEvent` and `reportException` invoke `fetch` zero times.
    - [ ] `REL-TELEM-3` — `scrubExceptionPayload` and `scrubTelemetryEvent` strip custom dataset names, filenames, column names, target names, cell values, and local filesystem paths from all payloads, and `telemetry-client.ts` passes `credentials: 'omit'` on every `fetch` call.
    - [ ] `REL-TELEM-4` — When `BETA_TELEMETRY_ENABLED` is `false`, `trackBetaEvent` performs zero network requests even if `telemetryConsent === 'granted'`.
- **Verification:** `bun test tests/telemetry-privacy.test.ts`; `bun test tests/state-and-storage.test.ts`; `bun test tests/repository-conventions.test.ts`; `bun run check`; `bun run format:check`.
- **Progress:** [ ] Not started

### T5 — Opt-in telemetry UI, vendor endpoint wiring and `privacy-policy.md` disclosure

- **Depends on:** T4
- **Risk:** needs care — depends on the human's answers to blocking questions Q1, Q2, and Q3; touches user-visible privacy controls and `public/_headers` `connect-src`.
- **Likely files:** `content/en/pages/privacy-policy.md`, `public/_headers`, `src/common/telemetry/telemetry-client.ts`, `src/features/shell/app-content-modal.ts`, `src/features/shell/app-content-dialog.ts`, `specification/mockups/ui-scaffold/drafts/00-2_content-modal.html`, `tests/content-dialog.e2e.ts`, `tests/a11y.e2e.ts`
- **Must not touch:** `src/stores/reconciler.ts`, `src/features/models/training/training.worker.ts` — storage reconciliation and worker training logic do not change in T5.
- **Implementation:**
    1. Once Q1, Q2, and Q3 are resolved before `ready-for-review`, wire the chosen exception and beta event ingestion envelope format and build-time endpoint defines in `src/common/telemetry/telemetry-client.ts`, and add the exact ingestion origin to `connect-src` in `public/_headers`.
    2. Update `content/en/pages/privacy-policy.md` to state clearly:
        - All datasets, CSV uploads, feature selections, and trained models execute 100% locally in the browser and **never leave the user's machine**.
        - Zero cookies or third-party scripts are ever used.
        - During the beta phase only, users may optionally opt in to anonymous, aggregate workflow telemetry and/or scrubbed crash reports; in V1 all event tracking is removed.
        - Users can grant or revoke consent at any time using the opt-in controls.
    3. Implement the accessible opt-in toggle UI in the surface chosen in Q3 (following `lit-component-implementer` rules: native form controls, `@nanostores/i18n` strings, token-only styles, 2px `:focus-visible` outline, RTL and 320px reflow support, and draft mockup update in `specification/mockups/ui-scaffold/drafts/`).
    4. Add Playwright E2E and axe accessibility verification in `tests/content-dialog.e2e.ts` and `tests/a11y.e2e.ts`.
    5. Run `bun run format` on all touched files.
- **Acceptance criteria:**
    - [ ] `REL-UI-1` — The opt-in controls allow keyboard and pointer users to opt in or out of beta telemetry and optional error reporting, reflecting and persisting `onboarding.telemetryConsent` across reloads.
    - [ ] `REL-UI-2` — `content/en/pages/privacy-policy.md` compiles cleanly via `bun run build` and accurately documents local-only data processing, cookieless operation, beta-only opt-in event tracking, optional crash reporting, and how to withdraw consent.
    - [ ] `REL-UI-3` — The opt-in UI passes Playwright axe accessibility checks in Chromium, Firefox, and WebKit, works in `dir="rtl"` and at 320px width, and introduces zero token-guard violations (`bun test tests/style-tokens.test.ts`).
- **Verification:** `bun run build`; `bun test tests/style-tokens.test.ts`; `bun run check`; `bun run test:e2e tests/content-dialog.e2e.ts`; `bun run test:e2e tests/a11y.e2e.ts`; `bun run format:check`.
- **Progress:** [ ] Not started

### T6 — ESLint + `eslint-plugin-tsdoc` enforcement (Known gap 7) and `SECURITY.md`

- **Depends on:** T1
- **Risk:** routine
- **Likely files:** `package.json`, `bun.lock`, `eslint.config.mjs`, `SECURITY.md`, `src/**/*.ts`, `scripts/**/*.ts`, `tests/tsdoc-lint.test.ts`
- **Must not touch:** `css/`, `public/`, `specification/mockups/` — no CSS, static asset, or mockup changes.
- **Implementation:**
    1. Add `eslint` and `@typescript-eslint/parser` to `devDependencies` via `bun add -d eslint @typescript-eslint/parser` (pairing with the already-installed `eslint-plugin-tsdoc: "^0.5.4"`).
    2. Author `eslint.config.mjs` configuring `@typescript-eslint/parser` and `eslint-plugin-tsdoc` with rule `'tsdoc/syntax': 'error'` across `src/**/*.ts` and `scripts/**/*.ts`.
    3. Run `bunx eslint src/ scripts/` and fix any malformed TSDoc comment tags (`@param`, unescaped `{}` or `<>` in prose comments) across `src/**/*.ts` and `scripts/**/*.ts` without changing runtime behaviour.
    4. Author `tests/tsdoc-lint.test.ts` verifying that `eslint.config.mjs` exists, `package.json` defines `"lint"`, and `eslint` catches malformed TSDoc syntax on a negative fixture while passing across `src/` and `scripts/`.
    5. Author `SECURITY.md` covering supported versions (`0.1.x-beta`), local-only browser execution security properties (CSP, COOP/COEP, SHA-256 dataset and `web-ml` runtime verification), and vulnerability reporting instructions.
    6. Run `bun run format` on all touched files.
- **Acceptance criteria:**
    - [ ] `REL-LINT-1` — `bunx eslint src/ scripts/` (and `bun test tests/tsdoc-lint.test.ts`) exits 0 with zero `tsdoc/syntax` errors across `src/` and `scripts/`, and rejects a negative fixture containing invalid TSDoc syntax (resolving Known gap 7).
    - [ ] `REL-LINT-2` — `SECURITY.md` exists at repository root and documents supported beta versions, browser security invariants, and private vulnerability disclosure steps.
- **Verification:** `bun test tests/tsdoc-lint.test.ts`; `bun run check`; `bun run format:check`.
- **Progress:** [ ] Not started

### T7 — Adopt shared `agent-workflow` parameterised GitHub CI/CD workflow and specification sync

- **Depends on:** T2, T3, T4, T5, T6
- **Risk:** needs care — provisions `.github/workflows/ci.yml` from the shared `agent-workflow` parameterised CI/CD template (`../../../agent-workflow/specification/plans/github-pull-requests-and-ci.md`) with `samata-ml`'s verification and Cloudflare deployment options against the standalone vendored `vendor/web-ml/web-ml-0.2.0.tgz` layout.
- **Likely files:** `.github/workflows/ci.yml`, `AGENTS.md`, `README.md`, `specification/ARCHITECTURE.md`, `specification/standards-and-documentation.md`, `specification/state-and-storage.md`, `specification/README.md`, `specification/FUTURE.md`, `specification/HUMAN.md`, `specification/plans/README.md`, `specification/plans/beta-release-and-ci-cd.md`, `tests/ci-workflow.test.ts`
- **Must not touch:** `src/`, `css/`, `specification/mockups/` — no runtime source, stylesheet, or mockup changes in T7.
- **Implementation:**
    1. Instantiate `.github/workflows/ci.yml` using the shared `agent-workflow` template/generator (`github-pull-requests-and-ci.md`) configured with `samata-ml`'s repository options:
        - Triggers: `pull_request` (branches: `[main]`) and `push` (branches: `[main]`), with root `permissions: contents: read` and 40-character SHA-pinned actions.
        - Shared `quality` & `plans` gates + `samata-ml` verification options (`ubuntu-latest`, `timeout-minutes: 20`):
            1. `actions/checkout` (40-hex SHA pin)
            2. Vendored tarball integrity option: `cd vendor/web-ml && shasum -a 256 -c web-ml-0.2.0.tgz.sha256`
            3. `oven-sh/setup-bun` and `actions/setup-python` (40-hex SHA pins)
            4. `bun install --frozen-lockfile --ignore-scripts`
            5. `bun run format:check`
            6. `bun run lint` (`bunx eslint src/ scripts/`)
            7. `bun run check` (`tsc --noEmit && bun test`)
            8. `bun run build`
            9. `bun run plans:check` (plus shared `agent-workflow` commit-grammar, markdown-link, and spec-drift checks when provisioned)
            10. Playwright & Storybook browser option: `bunx playwright install --with-deps chromium firefox webkit`, `bun run test:stories`, and `bun run test:e2e --grep-invert "PARITY|SIDE-AC-11|PH-AC-2"` (isolating the 9 inherited visual-parity baseline failures tracked in `specification/HUMAN.md` §1 until re-baselined).
        - Continuous Delivery option (`deploy-script` job, `needs: [verify]`, `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`, `ubuntu-latest`, `concurrency: { group: cloudflare-deploy-main, cancel-in-progress: false }`):
            1. `actions/checkout` and `oven-sh/setup-bun` (40-hex SHA pins)
            2. `bun install --frozen-lockfile --ignore-scripts`
            3. `bun run deploy` (`bun run build && bunx wrangler deploy`) with `CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}` and `CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}`.
    2. Author `tests/ci-workflow.test.ts` asserting that `.github/workflows/ci.yml` exists, pins third-party actions to 40-hex commit SHAs with `permissions: contents: read`, triggers on `pull_request` and `push` to `main`, verifies `vendor/web-ml/*.tgz.sha256`, uses `bun install --frozen-lockfile --ignore-scripts`, runs `format:check`, `lint`, `check`, `build`, `plans:check`, `test:stories`, and `test:e2e`, and gates `bun run deploy` strictly on `github.event_name == 'push' && github.ref == 'refs/heads/main'` after verification succeeds.
    3. Update `README.md` and `AGENTS.md` (`Verification Commands`) to document `bun run lint`, `bun run version:release`, `bun run deploy:dry-run`, `bun run deploy`, and the GitHub Actions CI/CD secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`).
    4. Apply every item under `## Specification changes` (`specification/ARCHITECTURE.md`, `specification/standards-and-documentation.md`, `specification/state-and-storage.md`, `specification/README.md`, `specification/FUTURE.md`, `specification/HUMAN.md`), tick the checklist items in this plan, and run `bun run format` on all edited files.
- **Acceptance criteria:**
    - [ ] `REL-CI-1` — `.github/workflows/ci.yml` conforms to the `agent-workflow` parameterised CI/CD template (40-hex SHA action pins, `permissions: contents: read`, vendored tarball checksum check, full verification gates on PRs and `main` pushes, and serialized `bun run deploy` CD job on `push` to `refs/heads/main`, verified by `bun test tests/ci-workflow.test.ts`).
    - [ ] `REL-DOC-1` — Every item under _Specification changes_ is applied and ticked, Known gaps 3, 7, and 10 are marked `_Resolved._` in `specification/README.md`, status rows match spec headers, and `bun run plans:check specification/plans/beta-release-and-ci-cd.md` passes.
    - [ ] `REL-DOC-2` — `bun run format:check` and `bun run check` pass with zero unintended changes outside the plan's likely files.
- **Verification:** `bun test tests/ci-workflow.test.ts`; `bun run plans:check specification/plans/beta-release-and-ci-cd.md`; `bun run check`; `bun run build`; `bun run format:check`.
- **Progress:** [ ] Not started

## Verification and definition of done

- [ ] All task acceptance criteria (`REL-VER-*`, `REL-CACHE-*`, `REL-STALE-*`, `REL-TELEM-*`, `REL-UI-*`, `REL-LINT-*`, `REL-CI-1`, `REL-DOC-*`) met.
- [ ] Relevant verification commands from `AGENTS.md` (`bun run check`, `bun run build`, `bun run format:check`, `bun run test:stories`, `bun run test:e2e tests/training-runtime.e2e.ts tests/app-shell.e2e.ts tests/content-dialog.e2e.ts tests/a11y.e2e.ts`, `bun run plans:check`) pass with no new failures.
- [ ] Type-check, TSDoc lint (`bunx eslint src/ scripts/`), formatting, and production build checks pass.
- [ ] Accessibility (WCAG 2.2 AA), privacy/security (zero dataset/column/file leakage, `credentials: 'omit'`, zero cookies, strict opt-in gating), and contract-compatibility checks completed.
- [ ] Every item under _Specification changes_ is ticked, and specifications match the implemented code.
- [ ] No unintended changes outside the tasks' likely files.

## Risks and open questions

- **Blocking:**
    1. **Q1 — Realtime exception tracking platform:** After reviewing the vendor comparison matrix in _Technical decisions_, which exception tracking platform should `src/common/telemetry/telemetry-client.ts` target for optional (opt-in) crash reporting?
        - **Option A (Recommended):** Minimal ~2 KB **Sentry Envelope `fetch` poster** (wire-compatible with both **Sentry EU ingest** and self-hosted open-source **GlitchTip**), with source maps uploaded in CI and zero breadcrumb/DOM/console scraping.
        - **Option B:** Self-hosted or managed **GlitchTip** using the same Sentry Envelope `fetch` poster.
        - **Option C:** Unified **PostHog EU Cloud** `$exception` events over its stateless HTTP `/capture/` endpoint.
    2. **Q2 — Beta-only opt-in event tracking platform:** After reviewing the vendor comparison matrix in _Technical decisions_, which cookieless platform should `src/common/telemetry/telemetry-client.ts` target during the beta phase (to be disabled via `BETA_TELEMETRY_ENABLED = 'false'` at V1)?
        - **Option A (Recommended):** **Umami** or **Plausible** (Cloud EU or self-hosted) via a stateless ~50-line `fetch` request (`credentials: 'omit'`, zero cookies, zero persistent user profile, aggregate workflow funnel counts only).
        - **Option B:** **PostHog EU Cloud** stateless HTTP `/capture/` endpoint with `$process_person_profile: false` and an ephemeral per-session token.
        - **Option C:** First-party **Cloudflare Workers Analytics Engine** bound in `wrangler.jsonc` (zero external third-party vendor; aggregate counts stays inside the project's own Cloudflare account).
    3. **Q3 — Opt-in telemetry & error-reporting UI surface and production Cloudflare domain:**
        - **(a) UI placement:** Where should the learner opt in/out of beta event tracking and optional error reporting? **Option A (Recommended):** Keep `app-welcome-modal` unchanged (preserving `00_first-load.html` visual parity) and place the opt-in controls inside the `/privacy` modal (`app-content-modal` / `app-content-dialog`) with a subtle link from the Welcome Modal or sidebar footer; **Option B:** Add an opt-in checkbox directly to `app-welcome-modal` on first visit plus a toggle in `/privacy` (updating the welcome modal visual parity baseline).
        - **(b) Cloudflare production domain:** What custom domain pattern should replace placeholder `"app.example.com"` in `wrangler.jsonc` `routes` for the beta deployment (e.g. `"beta.samata.ml"` or `"samata.ml"`), or should `routes` be omitted in favour of Cloudflare dashboard custom domains / `workers_dev: true` for initial beta testing?
- **Non-blocking:**
    - **Upstream `agent-workflow` parameterised CI/CD dependency (`github-pull-requests-and-ci.md`):** Task T7 consumes the shared, parameterised GitHub Actions CI/CD template and governance toolkit requested in [2026-11-22-parameterised-github-ci-cd-and-beta-activation.md](../../../agent-workflow/specification/requests/2026-11-22-parameterised-github-ci-cd-and-beta-activation.md) (updating [github-pull-requests-and-ci.md](../../../agent-workflow/specification/plans/github-pull-requests-and-ci.md) in `agent-workflow` for beta-phase activation and per-repository verification/CD options across `agent-workflow`, `web-ml`, and `samata-ml`). Mitigation: T1–T6 have zero dependency on `agent-workflow` changes and standardise the exact `package.json` scripts (`lint`, `check`, `build`, `deploy`) that the shared CI template invokes. Owner: maintainer.
    - **Inherited visual-parity baseline failures (`HUMAN.md` §1):** Nine `tests/visual-parity.e2e.ts` tests currently fail on unmodified `main` (`PARITY/SIDE-AC-11`, `PH-AC-2`). Mitigation: CI runs functional and axe E2E suites as blocking gates and excludes those 9 visual-parity baseline checks via `--grep-invert` until the human re-baselines them in `shell-verification-follow-ups.md`. Owner: maintainer.
    - **Offline Service Worker (`Known gap 6`):** Deferred out of the initial beta release so service-worker caching cannot interfere with rapid beta hotfixes; content-hashed assets + `Cache-Control` headers in T2 provide immediate, deterministic cache invalidation. Owner: maintainer.

## Escalations

None.

## Review fixes

None.

## Implementation and verification log

| When (UTC)           | Task | Agent (model)                            | Outcome / commands / evidence                                                                                                                                                                                                                                                                                        |
| -------------------- | ---- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-21T19:43:46Z | —    | Google Antigravity (Gemini 4 Argon High) | Initial draft authored after `codebase-scout` inspection of `package.json`, `wrangler.jsonc`, `public/_headers`, `index.html`, `scripts/`, `src/app.ts`, `src/router/`, `src/stores/`, `src/types/`, `content/en/pages/`, `playwright.config.ts`, and `tests/`. Kept `draft` pending human vendor research on Q1–Q3. |
| 2026-11-22T16:22:03Z | —    | Google Antigravity (Gemini 4 Argon High) | Aligned D7 and T7 with `agent-workflow/specification/plans/github-pull-requests-and-ci.md` and filed upstream request `../agent-workflow/specification/requests/2026-11-22-parameterised-github-ci-cd-and-beta-activation.md`.                                                                                       |

## Plan review history

| Reviewed (UTC) | Agent (model) | Decision | Findings |
| -------------- | ------------- | -------- | -------- |

## Change log

| When (UTC)           | Change                                                 | Reason                                                                                                                                                                                                                 |
| -------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-21T19:43:46Z | Initial draft                                          | Created beta release, asset cache invalidation, privacy-gated beta telemetry, ESLint TSDoc gate, and Cloudflare GitHub CI/CD plan. Left in `draft` per user request to research exception and event tracking vendors.  |
| 2026-11-22T16:22:03Z | Align T7/D7 with `agent-workflow` shared CI/CD toolkit | Filed `../agent-workflow/specification/requests/2026-11-22-parameterised-github-ci-cd-and-beta-activation.md` so `github-pull-requests-and-ci.md` provides parameterised CI/CD templates for `samata-ml` and `web-ml`. |
