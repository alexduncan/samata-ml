# Worktree-scoped dev and test servers

**Status:** draft | **Updated:** 2026-11-22T21:29:44Z
**Authors:** Claude Code (claude-opus-5-5) | **Created:** 2026-11-22T16:21:47Z
**Verified by:** — | **Verified:** — | **Verification:** changes-requested
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour:** Every checkout uses the same ports. `scripts/server.ts` L14 binds `Number(process.env.SAMATA_SERVER_PORT ?? 3000)` without validation. `scripts/serve-mockups.ts` binds `DEFAULT_PORT` 3333 (L46) unless `PORT` or `--port` overrides it (`parseCliArgs`, L210–229). `playwright.config.ts` L30–50 starts or reuses three servers: `bun run server` on `https://localhost:3000` (`reuseExistingServer: !process.env.CI`), `bun run build && bun run server --dist` on 3001 (`SAMATA_SERVER_PORT: '3001'`, `reuseExistingServer: false`) and `bun run mockups --port 3333` on `http://localhost:3333` (`reuseExistingServer: !process.env.CI`). Playwright treats any answer on the URL as a reusable server. Each server serves files from the checkout that started it, so a test run in one worktree can silently test another checkout. Seen in practice: visual-parity and mockup-review compared against the primary checkout's old `ui-scaffold/` layout; `tests/training-runtime.e2e.ts` failed 12 tests because a reused port-3000 server had been started without `SAMATA_TRAINING_RUNTIME_PROBE=1`; and two worktrees cannot run `bun run test:e2e` at the same time because both need port 3001. Eight test files hard-code `localhost:3000`, `3001` or `3333`. `server.ts` L12 also derives `CONTENT_DIR` from `process.cwd()` rather than from its own checkout.

**Target behaviour:** One runtime-neutral module, `scripts/ports.ts`, gives every checkout its own ports and URLs. The primary checkout keeps 3000 (app), 3001 (dist) and 3333 (mockups). A linked Git worktree derives a stable block of three ports from its real root path. `SAMATA_PORT_BASE` overrides the base for any checkout. Both servers answer `GET /__checkout` with their checkout root and mode. A Playwright `globalSetup` checks every server before any test runs and fails with a clear message when a server belongs to another checkout, lacks the endpoint, or runs in the wrong mode. `bun run audit:mockups` makes the same check before it audits. Tests, the Playwright config and the audit script take every URL from the shared module.

**Why:** Parallel agent sessions each run in their own worktree. A result obtained from another checkout's server is not evidence about this checkout. This plan implements the consumer guidance in the agent-workflow plan `worktree-session-readiness` decision D11 for `samata-ml`.

## Scope

**In scope**

- New `scripts/ports.ts` (ports, URLs, checkout kind, override, CLI port parsing) and `scripts/checkout-identity.ts` (identity payload and comparison).
- `GET /__checkout` on `scripts/server.ts` and `scripts/serve-mockups.ts`.
- Port precedence in both servers (`--port`, then `PORT`, then the checkout port). `SAMATA_SERVER_PORT` is retired.
- `CONTENT_DIR` moves to `scripts/config.ts`, rooted at the checkout.
- `scripts/audit-mockups.ts`: checkout default port and identity check before auditing.
- `playwright.config.ts`: ports from the module, explicit `--port` per server, `globalSetup` identity check.
- Replace every hard-coded server URL in Playwright tests with the module's constants, and add a guard test against new ones.
- `.claude/launch.json`: explicit ports for the primary checkout (see D9).
- README, `AGENTS.md` and specification text that names fixed ports.

**Out of scope**

- Storybook (`package.json` L13 `storybook dev --port 6006 --ci`, which `vitest.config.ts` L20 names as `storybookScript`). Not part of `test:e2e`; recorded as a non-blocking risk.
- `tests/setup.ts` L3 `http://localhost:3000`: the happy-dom document URL for `bun test`. It contacts no server.
- Report-rendering fixtures in `tests/audit-mockups.test.ts` (L66, L74) that use `localhost:3333` as literal sample data.
- Stopping, killing or detecting processes. Nothing in this plan stops a process.
- CI configuration (no CI exists; `beta-release-and-ci-cd` is a draft).
- Changing `scripts/config.ts` `ROOT_DIR` to be runtime-neutral.

**Must not touch:** `src/`, `css/`, `content/`, `specification/mockups/`, `vendor/`, `bun.lock`, `package.json` — no runtime code, content, mockups or dependencies change.

**Constraints and invariants**

- The primary checkout's default ports stay 3000, 3001 and 3333, so existing habits, `README.md` and the `mockup-review-improvements` requirement (the mockup server runs alongside `bun run server`) still hold there. In every checkout the three ports differ from each other.
- `scripts/ports.ts` and `scripts/checkout-identity.ts` import only `node:` built-ins and each other. They never use Bun globals (`Bun.*`, `import.meta.dir`), because Playwright loads `playwright.config.ts` and its `globalSetup` in Node (the `playwright` bin is `#!/usr/bin/env node`; `package.json` is `"type": "module"`). They never import `scripts/config.ts`, which uses `import.meta.dir`.
- `/__checkout` exists only in the local dev and mockup servers, bound to `localhost`. It sends no CORS headers. Production (`wrangler.jsonc`, static `dist/`) never serves it.
- Never stop or signal a process the session did not start. Failure messages say so.
- `?clean=1` mockup responses stay byte-identical to disk. Existing routes keep their behaviour.

## Required reading

- `specification/testing.md` §End-to-End (E2E) Testing, §Mockup review checks — where the new rules go.
- `specification/ARCHITECTURE.md` §Local mockup review tooling (L15–18).
- `specification/mockup-review.md` L7–32 — port wording.
- `specification/visual-design.md` L190–205 — parity harness and audit port wording.
- `README.md` §Start the Local Development Server, §Review mockups, §Test the Production App Locally (L114–200).
- This plan's _Technical decisions_ and _Interfaces and behaviour_.

## Codebase context

Facts verified by `codebase-scout` on 2026-11-22 against `main` at `ecbe9dd`, so downstream agents need not re-sweep the tree.

- **Relevant specifications:** `specification/testing.md` (no webServer text; mockup audit port at L27); `specification/ARCHITECTURE.md` L17–18 (mockup server at `http://localhost:3333/`); `specification/mockup-review.md` L15, L19–22, L32; `specification/visual-design.md` L192, L204. Archived `mockup-review-improvements` D2 requires the mockup server to run concurrently with `bun run server`.
- **Relevant implementation:**
    - `playwright.config.ts` (51 lines): `testMatch` `/.*\.e2e\.ts/` L5; `use.baseURL` `'https://localhost:3000'` L12, `ignoreHTTPSErrors` L13; projects chromium/firefox/webkit L16–29; `webServer` L30–50 as described under _Goal_ (no `timeout`, no `cwd`); no `globalSetup`.
    - Playwright 1.65.0 (`node_modules/playwright/lib/runner/index.js`): `createGlobalSetupTasks` (L6603) runs plugin (webServer) setup before `globalSetup`, so `globalSetup` sees the servers that tests will use. The webServer child gets `{...DEFAULT_ENVIRONMENT_VARIABLES, ...process.env, ...options.env}` (L943–947), so a `PORT` exported in the shell reaches every server unless `--port` is passed. With `reuseExistingServer: false` and the URL already answering, it throws `… is already used …` (L936).
    - `scripts/server.ts` (374 lines, no exports, starts itself): `CONTENT_DIR = join(process.cwd(), 'content')` L12 (watch target L293 only); port L14; `HOSTNAME = 'localhost'` L15; `--dist` L16; `SERVE_DIR` L17. TLS from `ensureHttpsCert()` (`scripts/certificates.ts` L13–48, `ROOT/.cert/localhost.pem`, self-signed, SAN `DNS:localhost,IP:127.0.0.1`). Dev builds before listening (L330–333); dist does not (L335–336). `Bun.serve` L342–366; `fetch` L352–365 handles `/__hmr` (dev only, L355), then `serveStaticFile` (L360). `scripts/static-server.ts` L50–58 returns `index.html` with 200 for unknown extension-less paths, so a server without the new route answers `/__checkout` with HTML.
    - `scripts/build-assets.ts` L46: `SAMATA_TRAINING_RUNTIME_PROBE === '1'` adds `tests/fixtures/training/runtime.worker.ts` as a build entrypoint (dev build at server start; production build in `bun run build`).
    - `scripts/serve-mockups.ts` (738 lines): `ServerCliOptions` L35–42 `{ port; hostname; open }`; `DEFAULT_PORT = 3333` L46; `DEFAULT_HOSTNAME = 'localhost'` L47; `parseCliArgs` L210–229 (`PORT` ≥ 0, then `--port`/`-p`/`--port=` 0–65535, invalid values ignored; `--host`/`-h`; `--open`/`-o`); `startMockupsServer(customOptions?: Partial<ServerCliOptions> & { enableWatcher?: boolean; rootDir?: string })` L619–621, reads `process.argv.slice(2)` L622, `rootDir` default `MOCKUPS_DIR` L628; routes in `fetch` L631–706: `/__hmr` L641, `/` and `/index.html` L645, `/index.json` L650, `decodePath` L656, `__source` L660; self-start L737.
    - `scripts/config.ts` (15 lines): `ROOT_DIR = path.resolve(import.meta.dir, '..')` L6; `PUBLIC_DIR`, `SRC_DIR`, `CSS_DIR`, `DEV_DIR`, `DIST_DIR` L7–11; `MOCKUPS_DIR` L14. No `CONTENT_DIR`.
    - `scripts/audit-mockups.ts` (411 lines): `DEFAULT_PORT = 3333` L8; `parseAuditArgs` L63–86 (`--port`/`--port=` 1–65535, default L65); `runMockupAudit` L300, port default L308, `server = http://localhost:${port}` L309, reachability fetch L345 (1500 ms), hint L349 `Cannot reach ${server}. Start it with bun run mockups.`, page URL L360; usage text L397 `[--port 3333]`.
    - `package.json`: `server` L7 `bun run scripts/server.ts`; `mockups` L8; `audit:mockups` L9; `test:e2e` L11 `playwright test`. `tsconfig.json` L29–37 includes root `*.ts`, `scripts/**/*` and `tests/**/*`, so new modules are typechecked.
    - `.claude/launch.json` (tracked): `app` (`bun run server`, port 3000, url `https://localhost:3000`) and `mockups` (`bun run mockups`, port 3333). No `env` or `autoPort`.
    - Checkout kind: in a linked worktree `<root>/.git` is a file (`gitdir: …/.git/worktrees/<name>`); in the primary checkout it is a directory. No existing helper detects this.
- **Hard-coded server URLs (to replace):**
    - `http://localhost:3333`: `tests/visual-parity.e2e.ts` L28; `tests/visual-parity/fixtures.ts` L94; `tests/mockup-review.e2e.ts` L3 (`MOCKUP_SERVER`, used L11, L22, L55, L86, L138); `tests/welcome-acceptance.e2e.ts` L83; `tests/content-dialog.e2e.ts` L281; `tests/app-shell.e2e.ts` L729, L833, L1021.
    - `https://localhost:3000` / `3001`: `tests/training-runtime.e2e.ts` L38–39 (used L48, L65, L82, L95, L102); `tests/classification-training.e2e.ts` L115 `test.use({ baseURL: 'https://localhost:3001' })` (L43 is a relative `page.goto('/data')` and needs no change); `tests/visual-parity.e2e.ts` L34 (comment).
    - Unit: `tests/audit-mockups.test.ts` L59 expects default `port: 3333`.
    - Everything else in `tests/*.e2e.ts` uses relative paths against `baseURL`.
    - `tests/visual-parity/fixtures.ts` is also imported by the Bun unit test `tests/sidebar-state.test.ts` L6, so whatever it imports runs under `bun test` too.
    - `scripts/audit-mockups.ts` `runMockupAudit` (L300–391) returns `{ report, exitCode }`. Every setup error is stored in `report.setupError`, skips the Chromium launch, and still writes `latest.json` and `latest.html` (L384–388); `exitCode` is 2 when `setupError` is set. `main()` (L393–409) prints `report.setupError` and sets `process.exitCode`.
- **Tests and commands:** `tests/serve-mockups.test.ts` (imports `parseCliArgs`, `startMockupsServer` etc. L6–15; explicit-port parsing L21–27; real server on `port: 0`, `127.0.0.1`, L203–209). `tests/audit-mockups.test.ts` (server on `port: 0` L37–42; `parseAuditArgs` L53–59; unreachable port L128–144). No unit test covers `scripts/server.ts`. Commands: `bun run check`, `bun test <path>`, `bun run test:e2e [file]`, `bun run format <files>`, `bun run audit:mockups`.
- **External tooling (desktop preview):** <https://code.claude.com/docs/en/desktop.md> §Configure preview servers documents per-configuration `env`, `cwd`, `autoPort` and `url`; with `autoPort` unset or `true` the app moves a busy port and rewrites a `--port`/`-p` value in `runtimeArgs`, and passes the assigned port in `PORT`; `false` fails instead. Whether a desktop worktree session reads `.claude/launch.json` from the worktree or the main checkout is undocumented (<https://code.claude.com/docs/en/worktrees.md> §What worktrees share with the main checkout lists settings, hooks, skills, agents, commands and `.mcp.json`, not `launch.json`). Whether the app rewrites `url` when it moves a port is undocumented.
- **Web guidance:** None — Node/Bun tooling only.
- **Visual reference:** None.
- **Domain skills:** None — no Lit, content or dataset work.
- **Assumptions requiring verification:** Preview behaviour in desktop worktree sessions (see _Risks_); not verifiable by the implementer.

## Technical decisions

| Decision                                    | Chosen approach and rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Rejected alternative / trade-off                                                                                                                                                                        |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1. One shared port module                  | `scripts/ports.ts` owns every port and URL. Servers, `playwright.config.ts`, `globalSetup`, `audit-mockups` and tests import it. It is runtime-neutral (Node and Bun) and computes its own root with `fileURLToPath(new URL('..', import.meta.url))`.                                                                                                                                                                                                                                                                                                                                                                                    | Constants in `scripts/config.ts`: that module uses `import.meta.dir`, which Node lacks, so Playwright could not import it. A `tests/urls.ts` module: servers and the audit script also need the values. |
| D2. Checkout kind                           | `lstat(<root>/.git)`: a directory or a missing entry (tarball export) means `primary`; a regular file means `linked-worktree`. No Git subprocess.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `git rev-parse --git-common-dir`: needs Git on PATH and a subprocess at config load.                                                                                                                    |
| D3. Port layout                             | Maintainer accepted the narrower range (Q4, 2026-11-22). Primary: app 3000, dist 3001, mockups 3333. Linked worktree: base `B = 20000 + 3 × (fnv1a32(realpath(root)) mod 4255)`, so `B` ∈ [20000, 32762] and app `B`, dist `B + 1`, mockups `B + 2` stay at or below 32764. Blocks of three never partly overlap. The range stays below 32768, the start of Linux's default ephemeral range, and far below macOS's (49152). FNV-1a 32-bit over the UTF-8 bytes of the real path is stable across runs, processes and runtimes.                                                                                                           | The suggested 20000–39999: overlaps Linux's ephemeral range (32768–60999). Random free ports: not stable, so reuse and previews break. Hashing the branch name: branches move between worktrees.        |
| D4. Override                                | `SAMATA_PORT_BASE` (integer 1024–65533) sets app `N`, dist `N + 1`, mockups `N + 2` for any checkout kind. Empty or unset means no override. Any other value throws `Error` naming the variable and the accepted range.                                                                                                                                                                                                                                                                                                                                                                                                                  | Separate override per server: three variables that can collide. Silent fallback on bad input: hides mistakes.                                                                                           |
| D5. Server port precedence                  | Maintainer decision Q3 (2026-11-22). `--port <n>` / `--port=<n>` (and `-p` on the mockup server), then `PORT`, then the checkout port. Shared parser in `ports.ts`; out-of-range or non-integer values are ignored, as `parseCliArgs` already does. `SAMATA_SERVER_PORT` is retired (only `playwright.config.ts` sets it). `playwright.config.ts` passes `--port` to every server, because Playwright merges `process.env` into the server environment.                                                                                                                                                                                  | Keeping `SAMATA_SERVER_PORT` as an alias: a third precedence level for one caller. Ignoring `PORT`: the desktop preview passes the assigned port in `PORT`, and the mockup server already honours it.   |
| D6. Identity endpoint                       | `GET`/`HEAD /__checkout` on both servers returns `CheckoutIdentity` JSON (below) with `Cache-Control: no-store`. The app route goes before `/__hmr` and the static fallback; the mockup route before `decodePath`. `root` is the real path of the server's checkout, so symlinked paths compare equal.                                                                                                                                                                                                                                                                                                                                   | Returning a hash of the root: the failure message could not say which checkout owns the server. A response header on every request: a reused non-samata server would still need a probe.                |
| D7. Reuse check                             | New `tests/global-setup.ts` (named by `globalSetup` in `playwright.config.ts`) fetches `/__checkout` from all three servers with a 5-second timeout and TLS verification off for those `localhost` requests only (each checkout has its own self-signed certificate). It compares each reply with the expectation from `ports.ts`, collects every problem, and throws one `Error` listing them. App: service `samata-ml-app`, mode `dev`, `trainingRuntimeProbe: true`. Dist: service `samata-ml-app`, mode `dist`. Mockups: service `samata-ml-mockups`. Reuse settings stay as they are (`!CI` for app and mockups, `false` for dist). | `reuseExistingServer: false` everywhere: loud but no isolation, and it blocks reuse of a session's own preview. Checking inside each test file: misses suites and repeats work.                         |
| D8. Audit check                             | Maintainer accepted (Q4, 2026-11-22). `audit:mockups` defaults to the checkout's mockup port and, after the reachability fetch, requires `/__checkout` to report service `samata-ml-mockups` and this checkout's root. Otherwise it records the `formatCheckoutFailure` text in `report.setupError`, like every existing setup error: no Chromium launch and no page results, reports still written, `exitCode` 2, and `main()` prints it.                                                                                                                                                                                               | Auditing whatever answers: another checkout's mockups would produce a confident but wrong accessibility report.                                                                                         |
| D9. Desktop preview (`.claude/launch.json`) | Maintainer decision Q1 (2026-11-22). Keep 3000 and 3333 and pass them explicitly: `app` gets `runtimeArgs` `["run", "server", "--port", "3000"]` and `"autoPort": false` (its `url` is fixed https, and whether the app rewrites `url` when it moves a port is undocumented, so a moved port could show another checkout's app). `mockups` gets `["run", "mockups", "--port", "3333"]` and `"autoPort": true` (plain http; the app rewrites `--port`).                                                                                                                                                                                   | Leave `launch.json` untouched: in a worktree `bun run server` binds the derived port while the preview waits on 3000, so the pane shows the primary checkout's app or nothing.                          |
| D10. Probe flag in the preview              | Maintainer decision Q2 (2026-11-22). `app` gets `"env": { "SAMATA_TRAINING_RUNTIME_PROBE": "1" }`, so a running preview passes the D7 check and Playwright can reuse it. The flag only adds the test runtime worker as an extra dev-bundle entrypoint.                                                                                                                                                                                                                                                                                                                                                                                   | No flag: whenever the primary's preview is running, `test:e2e` fails at `globalSetup` until it is stopped.                                                                                              |
| D11. Guard against new hard-coded URLs      | A unit test scans `playwright.config.ts`, `tests/**/*.e2e.ts` and `tests/visual-parity/**/*.ts` and fails on `localhost:3000`, `localhost:3001` or `localhost:3333`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Review discipline only: the same mistake returns with every new test file.                                                                                                                              |

### Interfaces and behaviour

`scripts/ports.ts` (all exports carry TSDoc):

```ts
export const PORT_BASE_ENV = 'SAMATA_PORT_BASE';
export const PRIMARY_PORTS = { app: 3000, dist: 3001, mockups: 3333 } as const;
export const WORKTREE_PORT_MIN = 20000;
export const WORKTREE_PORT_BLOCKS = 4255; // bases 20000…32762, step 3

export type CheckoutKind = 'primary' | 'linked-worktree';
export type PortSource = 'primary-default' | 'worktree-derived' | 'override';

export interface CheckoutPorts {
	readonly root: string; // realpath of the checkout root
	readonly kind: CheckoutKind;
	readonly source: PortSource;
	readonly app: number;
	readonly dist: number;
	readonly mockups: number;
}

export interface CheckoutUrls {
	readonly app: string; // `https://localhost:${app}`
	readonly dist: string; // `https://localhost:${dist}`
	readonly mockups: string; // `http://localhost:${mockups}`
}

export function fnv1a32(text: string): number; // unsigned 32-bit
export function deriveWorktreePortBase(root: string): number;
export function detectCheckoutKind(root: string): CheckoutKind;
export function resolveCheckoutPorts(options?: {
	rootDir?: string; // default: this checkout's root
	env?: Readonly<Record<string, string | undefined>>; // default: process.env
}): CheckoutPorts;
export function checkoutUrls(ports: CheckoutPorts): CheckoutUrls;
export function parsePortOption(
	argv: readonly string[],
	env: Readonly<Record<string, string | undefined>>,
	fallback: number,
	flags?: readonly string[] // default ['--port']; the mockup server passes ['--port', '-p']
): number;

export const CHECKOUT_ROOT: string;
export const CHECKOUT_PORTS: CheckoutPorts; // resolveCheckoutPorts() at import
export const APP_URL: string;
export const DIST_URL: string;
export const MOCKUPS_URL: string;
```

- URLs carry no trailing slash. Tests build page URLs as `` `${MOCKUPS_URL}/<file>` ``.
- `resolveCheckoutPorts` reads the override first. It throws on an invalid override, so a typo fails at config load rather than at a busy port.
- `parsePortOption` reads a value as a port only if it matches `/^\d+$/` and lies in 0–65535 (0 lets tests bind a free port); `4000abc`, `-1`, `''` and `1e3` are invalid. Flags are scanned left to right: a valid value from any listed flag (`--port 4000`, `--port=4000`, or `-p 4000` when listed) replaces the current choice; an invalid value is ignored and leaves the earlier choice. If no flag supplied a valid value, a valid `PORT` is used; otherwise `fallback`. This keeps `parseCliArgs`'s current ignore-invalid behaviour and only tightens `parseInt`'s acceptance of trailing junk.
- Every real path (`CHECKOUT_ROOT`, the `root` in `CheckoutPorts` and in `/__checkout`, and the hash input) uses `realpathSync.native` from `node:fs` (available in Node and Bun), so case differences on case-insensitive macOS volumes and symlinks compare equal.

`scripts/checkout-identity.ts`:

```ts
export const CHECKOUT_IDENTITY_PATH = '/__checkout';
export type CheckoutService = 'samata-ml-app' | 'samata-ml-mockups';

export interface CheckoutIdentity {
	readonly service: CheckoutService;
	readonly root: string; // realpath of the checkout root
	readonly servingDir: string; // absolute directory the server reads files from
	readonly mode: 'dev' | 'dist' | null; // null for mockups
	readonly trainingRuntimeProbe: boolean | null; // dev app: env flag at start; otherwise null
}

export interface CheckoutExpectation {
	readonly label: 'app' | 'dist' | 'mockups';
	readonly url: string; // server base URL
	readonly service: CheckoutService;
	readonly root: string;
	readonly mode?: 'dev' | 'dist';
	readonly trainingRuntimeProbe?: true;
}

export function createCheckoutIdentityResponse(
	identity: CheckoutIdentity,
	method: string
): Response;
export function compareCheckoutIdentity(expected: CheckoutExpectation, reply: unknown): string[];
export function formatCheckoutFailure(
	failures: readonly { expected: CheckoutExpectation; problems: readonly string[] }[]
): string;
```

- `createCheckoutIdentityResponse`: 200 `application/json; charset=utf-8`, `Cache-Control: no-store`; `HEAD` sends headers and no body. The mockup server keeps its existing 405 for other methods; the app server applies the same rule to this path only.
- `compareCheckoutIdentity` returns an empty array on a match. Otherwise one plain sentence per problem: reply is not a JSON object with a string `service` and `root` (`"does not report a samata-ml checkout (older samata-ml server or another program)"`); wrong service; `root` differs (names both paths); wrong mode; probe flag missing.
- `formatCheckoutFailure` produces one message: a heading line, then per server the label, URL and problems, then the remedies: stop the server only if this session started it; otherwise set `SAMATA_PORT_BASE` to an unused base, or for the app restart it with `SAMATA_TRAINING_RUNTIME_PROBE=1`. It states that results from another checkout's server are not evidence and that the run must not stop processes it did not start.
- `tests/global-setup.ts` (default export, Node `node:http`/`node:https` with `rejectUnauthorized: false` per request) treats a network error or timeout as a problem (`"no reply from <url>/__checkout: <error>"`).

## Specification changes

- [ ] `specification/testing.md` §End-to-End (E2E) Testing — new subsection _Test servers and checkouts_: ports per checkout (primary 3000/3001/3333; linked worktrees a stable block of three from the root path; `SAMATA_PORT_BASE`), URLs only from `scripts/ports.ts`, `/__checkout` and the `globalSetup` check, and the rule that a result from another checkout's server or a run stopped by a port held by an unknown process is an environment blocker, not evidence. §Mockup review checks — `audit:mockups` uses the checkout's mockup port and refuses another checkout's server. Status stays partial.
- [ ] `specification/ARCHITECTURE.md` §Local mockup review tooling — the mockup server and audit use the checkout's mockup port (3333 in the primary checkout); `/__checkout` listed among the server's routes. Status stays partial.
- [ ] `specification/mockup-review.md` L15–32 — URLs stated as the checkout's mockup URL, with 3333 named as the primary checkout's default. Status stays implemented.
- [ ] `specification/visual-design.md` L192, L204 — the parity harness and audit use the checkout's mockup and app URLs. Status unchanged.

## Implementation tasks

### T1 — Port and identity modules

- **Depends on:** None
- **Risk:** needs care — every other task depends on its exact values, and it must load in both Node and Bun.
- **Likely files:** `scripts/ports.ts`, `scripts/checkout-identity.ts`, `scripts/config.ts`, `tests/ports.test.ts`, `tests/checkout-identity.test.ts`
- **Must not touch:** `playwright.config.ts`, `scripts/server.ts`, `scripts/serve-mockups.ts` — wired up in T2 and T3.
- **Implementation:**
    - Create `scripts/ports.ts` and `scripts/checkout-identity.ts` exactly as in _Interfaces and behaviour_, D1–D4 and D6. Only `node:` imports. `CHECKOUT_ROOT` is `realpathSync.native(fileURLToPath(new URL('..', import.meta.url)))`.
    - `detectCheckoutKind`: `lstatSync(join(root, '.git'))`; `isFile()` → `linked-worktree`; directory or `ENOENT` → `primary`; any other error is rethrown.
    - Add `export const CONTENT_DIR = path.join(ROOT_DIR, 'content');` with TSDoc to `scripts/config.ts`.
    - Tests use temporary directories (`node:fs` `mkdtempSync`) with a `.git` directory, a `.git` file and no `.git`.
- **Acceptance criteria:**
    - [ ] A primary root (`.git` directory) and a root without `.git` resolve to 3000/3001/3333 with source `primary-default`.
    - [ ] A linked-worktree root resolves to app `B`, dist `B + 1`, mockups `B + 2`, where `B` = `deriveWorktreePortBase(realpath(root))`, `B` ≥ 20000, `B` ≤ 32762, `(B − 20000) mod 3 = 0`; resolving twice gives the same ports.
    - [ ] `fnv1a32('')` is 2166136261 and `fnv1a32('a')` is 3826002220 (published FNV-1a 32-bit test vectors).
    - [ ] `SAMATA_PORT_BASE=1024` and `=65533` are accepted for both kinds (source `override`); `1023`, `65534`, `3000.5`, `abc` and `-1` throw an `Error` whose message contains `SAMATA_PORT_BASE`; `''` behaves as unset.
    - [ ] `parsePortOption`: `--port 4000` and `--port=4000` beat `PORT=5000`; `PORT=5000` beats the fallback; `PORT=abc` and `--port 70000` fall back; `-p 4001` is honoured only when `-p` is in `flags`.
    - [ ] `checkoutUrls` returns `https://localhost:<app>`, `https://localhost:<dist>` and `http://localhost:<mockups>`, no trailing slash.
    - [ ] `CHECKOUT_ROOT` equals `realpathSync.native(ROOT_DIR)` from `scripts/config.ts`.
    - [ ] `parsePortOption`: `['--port', '4000', '--port', 'x']` gives 4000; `['--port', 'x', '--port=4001']` gives 4001; `['--port', '4000abc']` with `PORT=5000` gives 5000; `PORT='4000abc'` gives the fallback.
    - [ ] `compareCheckoutIdentity` returns `[]` for a matching reply, and one problem each for: `null`, an HTML string, an object without `root`, a different `root`, the wrong `service`, mode `dist` where `dev` is expected, and `trainingRuntimeProbe: false` where `true` is expected.
    - [ ] `formatCheckoutFailure` output names each failing URL, both roots when they differ, `SAMATA_PORT_BASE`, and the instruction not to stop processes the session did not start.
    - [ ] `createCheckoutIdentityResponse` sets status 200, `Cache-Control: no-store` and JSON content type; `HEAD` has an empty body.
    - [ ] Neither new module contains `Bun.` or `import.meta.dir`, and neither imports `./config`.
- **Verification:** `bun test tests/ports.test.ts`, `bun test tests/checkout-identity.test.ts`, `bun run check`, `bun run format <changed files>`
- **Progress:** [ ] Not started

### T2 — Servers and mockup audit

- **Depends on:** T1
- **Risk:** needs care — `scripts/server.ts` has no unit tests; its route is proved by T3's end-to-end run.
- **Likely files:** `scripts/server.ts`, `scripts/serve-mockups.ts`, `scripts/audit-mockups.ts`, `tests/serve-mockups.test.ts`, `tests/audit-mockups.test.ts`
- **Must not touch:** `scripts/static-server.ts`, `scripts/build-assets.ts`, `scripts/certificates.ts` — behaviour unchanged.
- **Implementation:**
    - `server.ts`: delete the local `CONTENT_DIR` (L12) and the duplicate `join` import, import `CONTENT_DIR` from `./config`. `PORT = parsePortOption(process.argv.slice(2), process.env, CHECKOUT_PORTS.app)`. Capture `trainingRuntimeProbe = !SERVE_DIST ? process.env.SAMATA_TRAINING_RUNTIME_PROBE === '1' : null` once at start. In `fetch`, before `/__hmr`, answer `CHECKOUT_IDENTITY_PATH` with `createCheckoutIdentityResponse({ service: 'samata-ml-app', root: CHECKOUT_ROOT, servingDir: SERVE_DIR, mode: SERVE_DIST ? 'dist' : 'dev', trainingRuntimeProbe }, request.method)`; other methods on that path get 405. Remove every `SAMATA_SERVER_PORT` reference. The startup log prints the URL it bound.
    - `serve-mockups.ts`: `parseCliArgs` uses `parsePortOption(argv, process.env, CHECKOUT_PORTS.mockups, ['--port', '-p'])` for the port and keeps host/open parsing. Remove `DEFAULT_PORT` or set it from `CHECKOUT_PORTS.mockups`. Add the identity route before `decodePath` (L656), with `service: 'samata-ml-mockups'`, `root: CHECKOUT_ROOT`, `servingDir` = the resolved `rootDir`, `mode: null`, `trainingRuntimeProbe: null`.
    - `audit-mockups.ts`: default port `CHECKOUT_PORTS.mockups` (L8, L65, L308). When the reachability fetch leaves `report.setupError` unset, fetch `` `${server}/__checkout` `` (1500 ms timeout, as the reachability fetch). A network error or non-JSON body counts as a reply of `null`. If `compareCheckoutIdentity` returns problems, set `report.setupError = formatCheckoutFailure([{ expected, problems }])`. Control flow, report writing and exit code stay as they are for other setup errors. `main()` is unchanged apart from the usage text. The unreachable hint names the URL and says `bun run mockups` (or `--port` to target another port of this checkout). Usage text shows `[--port <port>]` and says the default is this checkout's mockup port.
    - `audit-mockups.ts` gains an optional `expectedRoot` input on `runMockupAudit` (default `CHECKOUT_ROOT`) so tests can point the check at the test server; it is not a CLI flag.
- **Acceptance criteria:**
    - [ ] `GET /__checkout` on a mockup server started by `startMockupsServer({ port: 0, … })` returns 200 JSON with `service: 'samata-ml-mockups'`, `root` = `CHECKOUT_ROOT`, `mode: null`, and `Cache-Control: no-store`; `HEAD` returns headers only; `POST` returns 405.
    - [ ] `/`, `/index.json`, `/__source/<file>`, `/<file>` and `/<file>?clean=1` behave as before (existing `tests/serve-mockups.test.ts` cases pass unchanged).
    - [ ] `parseCliArgs([])` returns `CHECKOUT_PORTS.mockups` when `PORT` is unset; existing explicit-port cases (L21–27) still pass.
    - [ ] `parseAuditArgs(['../outside.html'])` reports `port: CHECKOUT_PORTS.mockups` (update L59).
    - [ ] `runMockupAudit` against a test mockup server whose identity root differs from `expectedRoot` returns `exitCode` 2 with `report.setupError` naming both roots and `report.results` empty, and `latest.json` in the test's `reportDir` contains that `setupError`. Against a plain `Bun.serve` that answers every path with HTML, `report.setupError` contains the "does not report a samata-ml checkout" problem.
    - [ ] Existing audit cases pass with `expectedRoot` matching the test server.
    - [ ] No file under `scripts/` or `tests/` mentions `SAMATA_SERVER_PORT`.
- **Verification:** `bun test tests/serve-mockups.test.ts`, `bun test tests/audit-mockups.test.ts`, `bun run check`, `bun run format <changed files>`
- **Progress:** [ ] Not started

### T3 — Playwright config, identity gate and test URLs

- **Depends on:** T2
- **Risk:** needs care — touches every end-to-end suite's entry URLs; a wrong constant fails whole suites.
- **Likely files:** `playwright.config.ts`, `tests/global-setup.ts`, `tests/visual-parity.e2e.ts`, `tests/visual-parity/fixtures.ts`, `tests/mockup-review.e2e.ts`, `tests/welcome-acceptance.e2e.ts`, `tests/content-dialog.e2e.ts`, `tests/app-shell.e2e.ts`, `tests/training-runtime.e2e.ts`, `tests/classification-training.e2e.ts`, `tests/test-server-urls.test.ts`, `.claude/launch.json`
- **Must not touch:** `src/`, `tests/a11y-feature-findings.ts`, `tests/visual-parity/map.ts` — URLs only, no assertion changes.
- **Implementation:**
    - `playwright.config.ts`: import `CHECKOUT_PORTS`, `APP_URL`, `DIST_URL`, `MOCKUPS_URL` from `./scripts/ports`. `use.baseURL: APP_URL`. Servers: `` `bun run server --port ${CHECKOUT_PORTS.app}` `` (url `APP_URL`, env probe, reuse `!process.env.CI`); `` `bun run build && bun run server --dist --port ${CHECKOUT_PORTS.dist}` `` (url `DIST_URL`, env probe only, reuse `false`); `` `bun run mockups --port ${CHECKOUT_PORTS.mockups}` `` (url `MOCKUPS_URL`, reuse `!process.env.CI`). `globalSetup: './tests/global-setup.ts'`. Remove `SAMATA_SERVER_PORT`.
    - `tests/global-setup.ts`: default-exported async function per D7 and _Interfaces_. Builds the three `CheckoutExpectation`s from `CHECKOUT_ROOT` and the URLs, checks all three, throws `new Error(formatCheckoutFailure(…))` if any failed.
    - `tests/visual-parity/fixtures.ts` is also loaded by `bun test` (`tests/sidebar-state.test.ts`); importing the runtime-neutral `scripts/ports.ts` there is safe, and an invalid `SAMATA_PORT_BASE` then fails that unit test at import, which is intended.
    - Replace each hard-coded URL listed under _Codebase context_ with `APP_URL`, `DIST_URL` or `MOCKUPS_URL` imported from `../scripts/ports` (`../../scripts/ports` in `tests/visual-parity/`). `classification-training.e2e.ts` L115 becomes `test.use({ baseURL: DIST_URL })`. Update the `visual-parity.e2e.ts` L34 comment.
    - `tests/test-server-urls.test.ts` (D11): reads `playwright.config.ts`, every `tests/**/*.e2e.ts` and `tests/visual-parity/**/*.ts`, and fails listing `file:line` for any `localhost:3000`, `localhost:3001` or `localhost:3333`.
    - `.claude/launch.json`: `app` → `"runtimeArgs": ["run", "server", "--port", "3000"]`, `"port": 3000`, `"autoPort": false`, `"url": "https://localhost:3000"`, `"env": { "SAMATA_TRAINING_RUNTIME_PROBE": "1" }`; `mockups` → `"runtimeArgs": ["run", "mockups", "--port", "3333"]`, `"port": 3333`, `"autoPort": true`. Keep `version` and names unchanged.
- **Acceptance criteria:**
    - [ ] Baseline: before editing any T3 file, run `bun run test:e2e` once and record the failing test titles in the log (the run uses the old fixed ports and may reuse another checkout's servers, so it is indicative only). After T3, `bun run test:e2e` in this worktree starts servers on this checkout's derived ports (not 3000/3001/3333). Every remaining failure must appear in that baseline list or in the known `main` failures in `specification/HUMAN.md` (the 9 `tests/visual-parity.e2e.ts` failures and `PH-AC-2`); each one is listed in the log with its reason. Any other failure blocks the task.
    - [ ] Negative: with a mockup server from another directory listening on this checkout's mockup port (or a server without `/__checkout`), `bun run test:e2e tests/mockup-review.e2e.ts` fails in `globalSetup` before any test, and the message names the URL, both roots (or the missing endpoint) and `SAMATA_PORT_BASE`. Record the exact setup used; if the implementer cannot create such a server within Verification Commands, record the check as not run and cover it by the T1 unit cases.
    - [ ] Negative: a dev app server reused without `SAMATA_TRAINING_RUNTIME_PROBE=1` fails `globalSetup` with the probe problem, not 12 runtime-probe test failures (same recording rule).
    - [ ] Two linked worktrees can run `bun run test:e2e` at the same time without port conflicts (recorded as not run if only one worktree is available).
    - [ ] `tests/test-server-urls.test.ts` passes on the repository. Its scanning function, defined in the same file, is also called on an in-memory sample containing `localhost:3333` and must report that line (proves the guard can fail without editing real tests).
    - [ ] `.claude/launch.json` matches D9/D10 exactly and is valid JSON, and `bun run format:check .claude/launch.json` passes.
    - [ ] Within the guard's scope (`playwright.config.ts`, `tests/**/*.e2e.ts`, `tests/visual-parity/**/*.ts`) no file contains `localhost:3000`, `localhost:3001` or `localhost:3333`. Files outside that scope may keep these strings where they name the primary checkout's defaults or sample data, for example `.claude/launch.json`, `tests/setup.ts` L3, the `tests/audit-mockups.test.ts` report fixtures, `tests/ports.test.ts` expectations, the guard's own in-memory sample, README and specifications.
- **Verification:** `bun test tests/test-server-urls.test.ts`, `bun test tests/sidebar-state.test.ts`, `bun run check`, `bun run test:e2e`, `bun run format <changed files>`
- **Progress:** [ ] Not started

### T4 — Sync documentation and specification

- **Depends on:** T3
- **Risk:** routine
- **Likely files:** `README.md`, `AGENTS.md`, `specification/testing.md`, `specification/ARCHITECTURE.md`, `specification/mockup-review.md`, `specification/visual-design.md`, `specification/plans/worktree-scoped-servers.md`, `specification/plans/README.md`
- **Must not touch:** `specification/mockups/` — no mockup changes.
- **Implementation:**
    - Apply every item under _Specification changes_ in present tense ("One rule, one place").
    - `README.md`: the dev server, mockup and `--dist` sections say the ports are the checkout's (3000/3001/3333 in the primary checkout), how a linked worktree gets its block, `SAMATA_PORT_BASE`, `--port`/`PORT`, and `/__checkout`. Fix `server -- --dist` / `server --dist` consistency only if both work as documented.
    - `README.md` gains a short _Previews in worktrees_ note: the desktop previews use 3000 and 3333 in every checkout; the app preview fails if 3000 is taken, the mockup preview moves to a free port; a worktree preview holding 3000 or 3333 makes the primary checkout's `test:e2e` stop at `globalSetup` with the worktree's root; Playwright in a worktree uses that worktree's own ports regardless.
    - `AGENTS.md` §Verification Commands, `bun run test:e2e` bullet: append "servers use this checkout's ports from `scripts/ports.ts`; a result from another checkout's server is not evidence". No other `AGENTS.md` change.
    - Tick _Specification changes_ items; set the plan's status per the lifecycle.
- **Acceptance criteria:**
    - [ ] No active specification or README line states 3000, 3001 or 3333 without saying it is the primary checkout's default.
    - [ ] `bun run plans:check` passes.
- **Verification:** `bun run plans:check`, `bun run format <changed files>`, `bun run format:check <changed files>`
- **Progress:** [ ] Not started

## Verification and definition of done

- [ ] All task acceptance criteria met.
- [ ] Relevant verification commands from `AGENTS.md` pass with no new failures.
- [ ] Type-check, lint, formatting, and build checks pass.
- [ ] Accessibility (WCAG 2.2 AA), privacy/security, and contract-compatibility checks completed where applicable. (No UI change; `/__checkout` is local-only and sends no CORS headers.)
- [ ] Every item under _Specification changes_ is ticked, and specifications match the implemented code.
- [ ] No unintended changes outside the tasks' likely files.

## Risks and open questions

- **Blocking:** None
- **Resolved:** The maintainer answered Q1 (D9 explicit ports), Q2 (D10 probe flag in the preview), Q3 (D5 retire `SAMATA_SERVER_PORT`) and Q4 (D3 range 20000–32764, D8 audit check) on 2026-11-22.
- **Non-blocking:**
    - **Hash collision.** Two worktrees share a port block with probability 1 in 4255 per pair. Reused app/mockup servers then fail `globalSetup` with the owner's root; the dist server fails with Playwright's `… is already used` error. Remedy: `SAMATA_PORT_BASE`. Owner: the agent that hits it, via the documented message.
    - **Desktop preview in worktrees.** Whether the desktop app reads `.claude/launch.json` from the worktree or the main checkout is undocumented, and whether it rewrites `url` on a moved port is undocumented. With D9 as recommended, an `app` preview binds 3000 or fails loudly; while a worktree preview holds 3000, the primary checkout's `test:e2e` fails at `globalSetup` with the worktree's root. Owner: maintainer, when previewing in worktrees; queued in `specification/HUMAN.md`.
    - **Storybook.** `bun run storybook` fixes port 6006 and `test:stories` may reuse it across checkouts. Out of scope; follow-up if it bites. Owner: maintainer.
    - **Overlapping plans.** `reference-dataset-regression-tests` (draft) adds new `*.e2e.ts` files; after this plan lands they must take URLs from `scripts/ports.ts`, and D11's guard enforces it. Owner: whichever plan lands second.

## Escalations

None.

## Review fixes

None.

## Implementation and verification log

| When (UTC) | Task | Agent (model) | Outcome / commands / evidence |
| ---------- | ---- | ------------- | ----------------------------- |
| —          | —    | —             | Not started                   |

## Plan review history

| Reviewed (UTC)       | Agent (model)                 | Decision          | Findings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------- | ----------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-22T21:21:02Z | Claude Code (claude-opus-5-5) | changes-requested | MAJOR: T2/D8 audit identity failure "print and exit 2 before writing a report" contradicts runMockupAudit contract (setup errors go in report.setupError, latest.json/html always written L384-388, printing in main()); return value undefined. MAJOR: T3 AC (no localhost:3000/3001/3333 outside guard scope except setup.ts and audit fixtures) is unsatisfiable: D9 launch.json url https://localhost:3000, guard self-test sample, ports.test.ts expectations, README/spec defaults. MINOR: parsePortOption invalid-flag precedence and parseInt-vs-strict parsing ambiguous vs current parseCliArgs L210-229; T3 e2e baseline run unspecified; facts: classification-training.e2e.ts L43 has no URL, Storybook port is package.json L13 not vitest.config.ts L20, tests/visual-parity/fixtures.ts also imported by bun test tests/sidebar-state.test.ts L6. SUGGESTION: realpathSync.native in both runtimes; HUMAN.md item for desktop-preview risk.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-11-22T21:29:44Z | Claude Code (claude-opus-5-5) | changes-requested | Round 2: all round-1 findings resolved (D8/T2 follows report.setupError contract, verified L340-389; T3 URL AC scoped to guard; strict parsePortOption; e2e baseline; facts; realpathSync.native; HUMAN.md item). New MAJOR: T2 retires SAMATA_SERVER_PORT and makes server.ts fall back to CHECKOUT_PORTS.app, but playwright.config.ts (unchanged until T3, L37-43) still starts dist as `bun run server --dist` with SAMATA_SERVER_PORT=3001, so after T2 dist binds the app port (EADDRINUSE with dev in primary; in a worktree dev/dist bind derived port B while Playwright waits on 3000/3001, reusing other checkouts or timing out). The T3 baseline (run "before editing any T3 file", i.e. after T2) therefore cannot produce test titles, and T2 lands a commit where test:e2e cannot start. Fix: take the baseline before T2 edits (or at T1 start) and state test:e2e is not expected to run between T2 and T3, or move the server.ts port wiring into T3. MINOR: T2 rewords the unreachable hint but tests/audit-mockups.test.ts L143 asserts "Start it with bun run mockups." while the AC says existing audit cases pass unchanged; keep that sentence or list the test update. MINOR: state that a manual `bun run server --dist` without --port binds the checkout app port (README L185-191 shows 3000), so T4 does not document dist as 3001. NIT: server.ts L4/L10 are two node:path imports, not a duplicate; removing L10 is correct only because join is used solely at L12. |

## Change log

| When (UTC)           | Change                                 | Reason                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-11-22T16:21:47Z | Initial draft                          | Maintainer request after parallel sessions tested other checkouts' servers; implements agent-workflow `worktree-session-readiness` D11 guidance for samata-ml                                                                                                                                                                                                                                          |
| 2026-11-22T16:34:20Z | Resolved Q1–Q4                         | Maintainer chose explicit preview ports (D9), the probe flag in the app preview (D10), retiring `SAMATA_SERVER_PORT` (D5), the 20000–32764 range (D3) and the audit identity check (D8)                                                                                                                                                                                                                |
| 2026-11-22T21:23:03Z | Revised after changes-requested review | D8/T2: audit identity failure follows the existing `report.setupError` contract (reports written, `exitCode` 2). T3: URL criterion limited to the guard's scope; e2e baseline defined. Strict `parsePortOption` rules; `realpathSync.native`; corrected facts (classification-training L43, Storybook `package.json` L13, `fixtures.ts` loaded by `bun test`); desktop-preview risk queued in HUMAN.md |
