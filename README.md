# web-ml

## Review the project

This browser app trains models locally from CSV data. Start with the [architecture](specification/ARCHITECTURE.md), [sample dataset sources and licences](specification/sample-datasets.md), and the [verification commands](AGENTS.md#verification-commands). Samples are pinned and acquired at build time or, for direct sources, when loaded; user-uploaded data stays in the browser.

For a dissertation review, share a commit-specific permalink to each verified repository snapshot so its files and milestone evidence remain stable. Optional milestone tags should point only to verified published snapshots. The maintainer's [first-publication guide](specification/publication-history.md) explains the required dataset history audit and separate publication decision.

## Prerequisites

- [Bun](https://bun.com)
- [mkcert](https://github.com/FiloSottile/mkcert), for a trusted localhost SSL certificate

On macOS, `mkcert` can be installed with Homebrew:

```bash
brew install mkcert
```

## Install Dependencies

```bash
bun install --frozen-lockfile --ignore-scripts
```

The lockfile installs the prebuilt `web-ml` release committed in `vendor/web-ml/`. The
same install works in standalone clones, worktrees and CI.

### Upgrade web-ml

1. Copy the upstream `web-ml-<version>.tgz` and `web-ml-<version>.tgz.sha256`
   into `vendor/web-ml/`. Always use a new versioned filename for a new release.
2. From `vendor/web-ml/`, run `shasum -a 256 -c web-ml-<version>.tgz.sha256`.
   Confirm it reports `OK` and the digest matches the upstream release SHA-256.
3. From the repository root, run `bun add ./vendor/web-ml/web-ml-<version>.tgz`.
   If Bun retains the previous dependency in the lockfile, run `bun remove web-ml`
   before retrying the add. Confirm `package.json` and `bun.lock` resolve only the new
   tarball, then run `bun install --frozen-lockfile --ignore-scripts`.
4. Delete the old tarball and its checksum file. Refresh the version, release SHA-256,
   package manifest hash, public contract digest and runtime hashes in
   `scripts/build-model-assets.ts`, using bytes from the verified release. Update the
   expected asset graph and release URL in the model asset and training runtime tests.
   Check the catalogue against samata-ml's model option policy.
5. Run `bun run check`, `bun run build` and
   `bun run test:e2e tests/training-runtime.e2e.ts tests/classification-training.e2e.ts`.
   Commit the new tarball and checksum along with the lockfile and integration changes.

## Create a Localhost SSL Certificate

The local server reads its HTTPS certificate from `.cert/localhost.pem` and `.cert/localhost-key.pem`.

Create and trust a local certificate authority:

```bash
mkcert -install
```

Generate the localhost certificate used by the app:

```bash
mkdir -p .cert
mkcert \
  -key-file .cert/localhost-key.pem \
  -cert-file .cert/localhost.pem \
  localhost 127.0.0.1 ::1
```

`mkcert -install` may ask for your system password because it updates your local trust store. This is only needed once per machine.

If these certificate files are missing, the server can create a self-signed OpenSSL fallback. That fallback allows HTTPS to run, but browsers will not trust it as cleanly as a certificate created with `mkcert`.

## Build System Overview

The build scripts live in `scripts/` and share their core logic through helper modules:

- `scripts/build.ts` is the production build entrypoint.
- `scripts/server.ts` runs the HTTPS local server.
- `scripts/build-assets.ts` contains the shared dev and production bundle steps.
- `scripts/build-model-assets.ts` verifies the installed `web-ml` release and copies its
  browser modules, workers, WASM and notices to a versioned same-origin directory.
- `scripts/html.ts` applies template variables and rewrites asset tags.
- `scripts/static-server.ts` serves files from either `dev/` or `dist/`.
- `scripts/certificates.ts` manages localhost HTTPS certificate paths and fallback generation.
- `scripts/filesystem.ts` contains shared file and path helpers.
- `scripts/config.ts` defines shared project paths.

The source inputs are:

- `src/app.ts` for browser JavaScript.
- `css/style.css` for browser CSS.
- `index.html` for the HTML template.
- Any other files in `public/`, which are copied into the output directory.

The generated output directories are:

- `dev/` for local development output.
- `dist/` for production output.

## Template Variables

The HTML template in `index.html` can use either `{{ TOKEN }}` or `%TOKEN%` syntax.

Available variables:

- `MODE`: `development` or `production`.
- `APP_ENV`: the same value as `MODE`.
- `BASE_URL`: currently `/`.
- `BUILD_TIME`: the ISO timestamp for the build.
- `TIMESTAMP`: the same value as `BUILD_TIME`.
- `YEAR`: the current UTC year.

During every dev or production build, `scripts/html.ts` replaces those variables before writing the generated `index.html`.

The same HTML transform also rewrites asset tags:

- In development, the HTML points at `/style.css` and `/app.js`.
- In production, the HTML links external content-hashed assets under `/bundles/`, such as `/bundles/style.d954b9081e.css` and `/bundles/app.524e1e5624.js`, and sets the `<meta name="app-version">` tag without inlining CSS into `index.html`.

## Start the Local Development Server

```bash
bun run server
```

Open the URL the server logs. In the primary checkout it is:

```text
https://localhost:3000/
```

Ports belong to the checkout. The primary checkout uses 3000 (app), 3001 (Playwright's production-build server) and 3333 (mockups). A linked Git worktree derives a stable block of three ports in 20000 to 32764 from its real root path, so parallel worktrees normally get separate servers (two worktrees share a block with probability 1 in 4255; `SAMATA_PORT_BASE` resolves a collision). Set `SAMATA_PORT_BASE` (1024 to 65533) to choose the app port for any checkout; dist and mockups use the next two ports. `bun run server --port <n>` and `bun run mockups --port <n>` override a single server, and `PORT` is honoured when no `--port` is given. `scripts/ports.ts` is the single source for these values, and both servers answer `GET /__checkout` with their checkout root and mode so tools can tell which checkout owns a port.

Development server features:

- Builds development assets into `dev/` before the server starts.
- Serves `dev/` over HTTPS at the checkout's app URL (`https://localhost:3000/` in the primary checkout).
- Watches `src/`, `css/`, and `public/` for changes.
- Debounces file events so one save does not trigger unnecessary rebuilds.
- Tracks file content hashes so duplicate watcher events are ignored.
- Injects a small live-reload script into HTML responses.
- Sends browser reload events over the `/__hmr` server-sent events endpoint.
- Logs certificate paths, watched directories, changed files, rebuild reasons, rebuild duration, and live-reload client counts.

Use `Ctrl-C` to stop the server.

## Review mockups

Browse the flat mockup directory (`specification/mockups/`), including drafts and implemented references:

```bash
bun run mockups
```

Open `http://localhost:3333/` (the primary checkout's mockup URL; a linked worktree uses its own mockup port, printed at start). The review server is read-only. Normal HTML previews inject `/mockups.css` and a light-DOM navigation bar; `?clean=1` returns untouched file bytes from disk.

With the mockup server running, audit one or more HTML files or every non-empty mockup:

```bash
bun run audit:mockups 03-0_models-overview.html
bun run audit:mockups
```

The audit uses the checkout's mockup port and refuses a server that belongs to another checkout. Reports are written to `test-results/mockup-a11y/latest.json` and `latest.html`. Automated results do not replace manual keyboard, screen-reader, zoom and responsive checks. See [the mockup review guide](specification/mockup-review.md) for the CSS, markup-request, promotion and application-port workflow.

## Build the Production App

```bash
bun run build
```

Production build steps:

1. Deletes and recreates `dist/`.
2. Copies all files from `public/` into `dist/`.
3. Compiles `src/app.ts` and `css/style.css` into content-hashed files under `dist/bundles/`.
4. Rewrites `dist/index.html` with production template variables, external `/bundles/` tags, version metadata, and conditional CSP.
5. Emits `dist/release.json`, `dist/_headers`, and `dist/robots.txt` according to `SAMATA_CRAWLER_POLICY` and `BETA_TELEMETRY_ENABLED`.
6. Prints the output directory, generated asset filenames, and build ID.

The production build does not modify `dev/`.

## Test the Production App Locally

Build the app, then run the same HTTPS server in `dist` mode:

```bash
bun run build
bun run server -- --dist
```

Without `--port` the server binds the checkout's app port (3000 in the primary checkout), not 3001; only Playwright passes the dist port. To run it beside the development server, pass `--port`:

```bash
bun run server -- --dist --port 3001
```

Open:

```text
https://localhost:3000/
```

(or the port you passed). In `--dist` mode, the server:

- Serves files from `dist/`.
- Does not rebuild files.
- Does not watch the filesystem.
- Does not inject the live-reload script.
- Does not expose the `/__hmr` live-reload workflow.

## Previews in worktrees

The desktop previews in `.claude/launch.json` use 3000 and 3333 in every checkout. The app preview fails if 3000 is taken; the mockup preview moves to a free port. A worktree preview that holds 3000 or 3333 makes the primary checkout's `bun run test:e2e` stop at `globalSetup` with the worktree's root. Playwright in a worktree uses that worktree's own ports regardless.

## Lint, Release and Beta Deployment

### Verification and TSDoc lint

- `bun run lint` — Parses `src/` and `scripts/` TypeScript files with `oxc-parser` and validates `/** ... */` comments against `tsdoc.json` (`scripts/lint-tsdoc.ts`).
- `bun run check` — Runs `tsc --noEmit` and the `bun test` unit suite.
- `bun run test:stories` — Generates `custom-elements.json` and runs Storybook tests in Chromium, Firefox, and WebKit.
- `bun run plans:check` / `plans:task` / `plans:review` / `plans:close` — Plan workflow gates; these read scripts from `$HOME/.agents/skills/` and run in local checkouts only (never invoked by GitHub Actions).

### Versioning and dry-run bundle checks

- Preview the next SemVer version and `CHANGELOG.md` entry without writing files:

```bash
bun run version:release prerelease --dry-run
```

- Apply a version bump (`prerelease`, `patch`, `minor`, or `major`) and update `package.json` plus `CHANGELOG.md`:

```bash
bun run version:release patch --notes "Summary of changes"
```

- Validate the production bundle and Wrangler configuration locally without Cloudflare credentials:

```bash
bun run deploy:dry-run
```

### CI/CD and `cloudflare-beta` setup

`.github/workflows/ci.yml` runs on `push` and `pull_request` to `main`:

1. `verify` — Checks out full history, verifies `vendor/web-ml/web-ml-0.2.0.tgz.sha256`, installs Bun from `.bun-version`, installs frozen dependencies (`--ignore-scripts`), runs changed-file Prettier checks, runs `lint`, `check`, and `deploy:dry-run`, installs Playwright browsers, and runs `test:stories`.
2. `e2e` (`needs: [verify]`) — Runs `SAMATA_SKIP_KNOWN_FAILURES=1 bun run test:e2e --project=<browser>` across Chromium, Firefox, and WebKit (`fail-fast: false`, `workers: 1` in CI).
3. `deploy` (`needs: [verify, e2e]`) — Runs on `push` to `main` inside the `cloudflare-beta` GitHub environment with `BETA_TELEMETRY_ENABLED=true` and `SAMATA_CRAWLER_POLICY=closed`.

Configure two environment secrets in GitHub under **Settings -> Environments -> `cloudflare-beta`**:

- `CLOUDFLARE_API_TOKEN` — API token with Cloudflare Workers Scripts Edit and Custom Domains / Routes permissions for `beta.samata.ml`.
- `CLOUDFLARE_ACCOUNT_ID` — Target Cloudflare account identifier.

Before publicising `https://beta.samata.ml`, add a hostname-scoped Cloudflare WAF custom rule with the **Block** action in addition to the generated closed `robots.txt` and global `X-Robots-Tag: noindex, nofollow, nosnippet` headers:

- Match when `http.host eq "beta.samata.ml"` and `http.request.uri.path ne "/robots.txt"`, and either `cf.verified_bot_category in {"Search Engine Crawler" "AI Crawler" "AI Search" "AI Assistant"}` or `lower(http.user_agent)` contains any of `googlebot`, `bingbot`, `gptbot`, `oai-searchbot`, `chatgpt-user`, `claudebot`, `claude-searchbot`, `claude-user`, `perplexitybot`, or `perplexity-user` (if the zone lacks `cf.verified_bot_category`, use the user-agent list and note the narrower enforcement).
- Check rule order against any Skip rules and verify Cloudflare managed robots directives do not alter the emitted `Disallow: /` file.
- Verify live responses after deploy: `/robots.txt` serves `text/plain` `Disallow: /` (not the SPA HTML fallback), representative search/AI crawler user agents receive `403`, normal browsers load `https://beta.samata.ml/`, and non-beta / Version URL hostnames on `workers.dev` stay outside the WAF rule while still serving closed crawler headers.

### Live Umami beta smoke check

After deploying to `https://beta.samata.ml`, verify in a fresh browser profile:

1. **Pre-consent isolation:** Before clicking **Get Started**, no request leaves for `https://cloud.umami.is/script.js` or `https://gateway.umami.is/api/send`, `window.crossOriginIsolated` is `true`, and document/worker responses include COOP `same-origin`, COEP `require-corp`, CORP `same-origin`, and strict CSP headers.
2. **Consent, reload, and preflight:** Click **Get Started**, reload the page, confirm `https://cloud.umami.is/script.js` loads once, confirm the gateway `OPTIONS` preflight allows `x-umami-website-id` and `x-umami-hostname` headers, and confirm the workflow remains functional even if content blockers block it.
3. **Allowlisted payloads only:** Trigger `/data`, `/target`, `/models`, `/results`, and a synthetic fixed exception event check; confirm the Umami dashboard receives one pageview, `beta_get_started`, and the triggered fixed exception event, and verify outgoing bodies contain only allowlisted fields—never CSV filenames, row counts, column names, targets, metrics, or stack traces.

### V1 public opening procedure

When promoting to the stable V1 release:

1. Build and deploy without `BETA_TELEMETRY_ENABLED=true` (beta analytics are disabled outside `beta.samata.ml` and in non-beta builds).
2. Switch `SAMATA_CRAWLER_POLICY` from `closed` to `public` so root `robots.txt` opens indexable pages and `_headers` retains `X-Robots-Tag: noindex, nofollow` only on `/content/*` and `/datasets/*`.
3. Remove or narrow the `beta.samata.ml` Cloudflare WAF crawler-blocking rule.
