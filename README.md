# web-ml

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

- In development, the HTML points at `style.css` and `app.js`.
- In production, the HTML points at content-hashed files such as `style.d954b9081e.css` and `app.524e1e5624.js`.
- In production, the generated CSS is also inlined into `index.html` with a `data-inline-build="true"` style tag.

## Start the Local Development Server

```bash
bun run server
```

Open:

```text
https://localhost:3000/
```

Development server features:

- Builds development assets into `dev/` before the server starts.
- Serves `dev/` over HTTPS at `https://localhost:3000/`.
- Watches `src/`, `css/`, and `public/` for changes.
- Debounces file events so one save does not trigger unnecessary rebuilds.
- Tracks file content hashes so duplicate watcher events are ignored.
- Injects a small live-reload script into HTML responses.
- Sends browser reload events over the `/__hmr` server-sent events endpoint.
- Logs certificate paths, watched directories, changed files, rebuild reasons, rebuild duration, and live-reload client counts.

Use `Ctrl-C` to stop the server.

## Review mockups

Browse the complete mockup tree, including drafts, source files and empty placeholders:

```bash
bun run serve:mockups
```

Open `http://localhost:3333/`. The review server is read-only. It offers clean previews that omit the in-flow review controls. The old `bun run serve:scaffold` command remains as a deprecated alias for historical instructions.

With the mockup server running, audit one or more HTML files or the whole tree:

```bash
bun run audit:mockups ui-scaffold/drafts/03-0_models-overview.html
bun run audit:mockups
```

Reports are written to `test-results/mockup-a11y/latest.json` and `latest.html`. Automated results do not replace manual keyboard, screen-reader, zoom and responsive checks. See [the mockup review guide](specification/mockup-review.md) for the CSS, markup-request, promotion and application-port workflow.

## Build the Production App

```bash
bun run build
```

Production build steps:

1. Deletes and recreates `dist/`.
2. Copies all files from `public/` into `dist/`.
3. Builds `src/app.ts` into browser JavaScript.
4. Builds `css/style.css` into browser CSS.
5. Minifies JavaScript and CSS.
6. Renames the generated JavaScript and CSS files with short content hashes.
7. Rewrites `dist/index.html` with production template variables.
8. Updates the HTML asset tags to point at the hashed production files.
9. Inlines the production CSS into `dist/index.html`.
10. Prints the output directory and generated asset filenames.

The production build does not modify `dev/`.

## Test the Production App Locally

Build the app, then run the same HTTPS server in `dist` mode:

```bash
bun run build
bun run server -- --dist
```

Open:

```text
https://localhost:3000/
```

In `--dist` mode, the server:

- Serves files from `dist/`.
- Does not rebuild files.
- Does not watch the filesystem.
- Does not inject the live-reload script.
- Does not expose the `/__hmr` live-reload workflow.
