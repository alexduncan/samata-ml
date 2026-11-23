# samata-ml — agent guide

Browser app (Lit 3, strict TypeScript, Nanostores, IndexedDB, Web Workers) for training machine learning models locally, for education. All training and model computation is executed by the `web-ml` release installed from the versioned tarball in `vendor/web-ml/`; see Repository boundary.

## Repository boundary

- **This repository is a user interface.** It guides non-technical users through training models on CSV files in the browser. It owns UI, state, storage, content, data ingestion and display formatting.
- **Upstream:** `../web-ml` owns all model training, evaluation, metrics, cross-validation, preprocessing for models (splitting, imputation, encoding, scaling) and statistical diagnostics. Never implement these here, not even as a temporary shim.
- **When web-ml lacks a capability:** do not plan it here. `/create-plan` creates exactly one new file `../web-ml/specification/requests/<YYYY-MM-DD>-<slug>.md` from `$HOME/.agents/skills/create-plan/assets/upstream-request.md`. It describes the general capability, not this UI. The samata plan depends on it and stays limited to integration. Never edit other files in `../web-ml`.
- **samata-ml requirements do not define web-ml.** web-ml may generalise or decline a request. Adapt to the public API it ships.

## Upstream Library Specs

- **Model catalogue:** For the installed release, check `node_modules/web-ml/specification/public-api/model-specifications/{schema.json,index.json,models/*.json}`.
- **Contract authority:** Use JSON for initial lookup, then the release's public declarations at `node_modules/web-ml/dist/index.d.ts` and their required public declaration dependencies, plus its public prose under `node_modules/web-ml/specification/public-api/`. Check each asset individually. Public TypeScript declarations and Markdown govern compatibility. Report conflicts and insufficient evidence as unresolved.
- **Upstream changes:** For unreleased work, consult `../web-ml/index.ts`, `../web-ml/dist/index.d.ts` and `../web-ml/specification/public-api/`. Report provenance and version differences before comparing with the installed release.
- **Cross-repo scout boundary:** only `codebase-scout` may inspect those upstream public assets. Deny rules override allow rules through symlinks: never inspect upstream Zig, `specification/internals/**`, private implementation, or installed private equivalents; never modify `../web-ml` (the one exception is creating a new request file; see Repository boundary). Report denied reads as unavailable.

## Workflow & Domain Skills

Lifecycle skills and `codebase-scout` live globally via `agent-workflow` (`~/.agents/skills/` and `~/.claude/agents/codebase-scout.md`); project-specific domain skills are symlinked into `.agents/skills/` (git-excluded via `.git/info/exclude`):

- **Discovery (`codebase-scout`):** Delegate source-tree exploration and upstream `web-ml` contract checks before planning or verifying.
- **Ad hoc audit (`/review-codebase`):** Reports findings by default; `--emit-stubs` permits only new stubs and index rows. Routing: `$HOME/.agents/skills/review-codebase/SKILL.md` §Routing Profile. The four lifecycle operations below expand, review, implement and close plans.
- **Planning (`/create-plan`):** Reads specs, enforces ambiguity gating, writes `specification/plans/<slug>.md`. Never edits product code.
- **Plan Review (`/verify-plan`):** Independent adversarial audit (`ready-for-review` -> `ready`) via `codebase-scout`.
- **Implementation (`/implement`):** Executes `ready` plans strictly without unrequested refactoring, running only `Verification Commands` below.
- **Closure Audit (`/verify-implementation`):** Audits diffs against the plan and transitions `implemented` -> `archived`.
- **Lit work (`lit-architecture-planner` & `lit-component-implementer`):** When a plan or task touches Lit components, reactive controllers, store bindings, component styles, or component tests, planners use `lit-architecture-planner` and implementers use `lit-component-implementer`. Rules live in [`specification/COMPONENTS.md`](specification/COMPONENTS.md).
- **Dataset curation (`add-dataset`):** Use when onboarding tabular classification datasets into `content/datasets/{id}/` (including `datasheet.md` compilation during `bun run build`).
- **Web platform (`modern-web-guidance`):** Use before implementing unfamiliar browser platform APIs.
- **No plan:** Only trivial fixes (typo, one-file bug fix, no public API, dependency, schema, or architecture change).

## Verification Commands

Bun only: never npm, yarn, pnpm, or `npx` (use `bunx`).

- `bun run check` — Typecheck + unit tests (`tsc --noEmit && bun test`). Run before reporting a task complete.
- `bun test <path>` — Run one test file.
- `bun run typecheck` — TypeScript check (`tsc --noEmit`; or `bunx tsgo --noEmit` where configured).
- `bun run build` — Production build (bundles app + validates sample datasets + compiles `datasheet.md` to HTML for `<dialog>` presentation).
- `bun run format <files>` — Prettier on changed files (`bun run format:check` to verify).
- `bun run test:e2e [file]` — Playwright end-to-end tests (including `tests/visual-parity.e2e.ts` and `tests/a11y.e2e.ts`); servers use this checkout's ports from `scripts/ports.ts`; a result from another checkout's server is not evidence.
- `bun run server` · `bun run mockups` · `bun run audit:mockups [paths]`.
- `bun run storybook` · `bun run storybook:build` · `bun run storybook:manifest` · `bun run test:stories`.
- `bun run --silent now` — Current UTC timestamp for plan metadata.
- **Plan gates:** Use `bun run plans:check`, `bun run plans:review`, `bun run plans:task`, and `bun run plans:close`; branches: `bun run git:sync`, `bun run git:land`, `bun run git:status`, `bun run git:release`. Evaluate `specification/decision-checklist.md` when present.

One-time adoption steps (package scripts, `plans:baseline`) are in `agent-workflow/docs/consumer-adoption.md`.

## Git workflow

Follow the shared rules in `agent-workflow/AGENTS.md` § Git workflow (summarised here):

- One session, one worktree, one session branch. Never `git switch` to `main` or `plan/<slug>` in a session worktree; the primary checkout stays on `main`.
- Target `main` for specification-only work and `plan/<slug>` for everything belonging to a plan once that branch exists (`implement` creates it with `bun run git:sync plan/<slug> --create`).
- `bun run git:sync <target>` at the start (it gives a detached worktree its own session branch); commit your own paths explicitly (never `git add -A`, `.` or `-u`) with `{slug} plan|review|T{n}|R{n}|closure: …`, `docs: …`, `fix: …` or `chore: …` subjects; `bun run git:land <target>` after each commit the next session needs and before ending. On `BLOCKED`, stop and report.
- Landing non-specification work on `main` needs maintainer approval (`bun run git:land main --maintainer-approved`). `review-codebase` never changes Git state.
- Never reset, clean, stash or overwrite others' changes, rewrite shared branches, add remotes or push.

## Map

`src/` app code · `css/` styles · `content/` Markdown pages & datasets · `public/` static assets · `scripts/` build and dev servers · `tests/` tests · `vendor/web-ml/` vendored release and checksum · `specification/` specs ([`specification/README.md`](specification/README.md)) · `specification/plans/` plans · `specification/notes/` inbox · `specification/HUMAN.md` human queue · `specification/mockups/` flat mockup HTML (`<meta name="status" content="draft|ready|implemented" />`), `style.css`, human-owned `mockups.css`, and `css/*.css`.

## Rules

- **Visual fidelity:** Ready and implemented mockups in `specification/mockups/` define appearance; follow [`specification/visual-design.md`](specification/visual-design.md), use only tokens from `css/root.css` with no fallbacks, record visual deviations, and run parity/token tests (`bun test tests/style-tokens.test.ts`) for UI changes.
- **Missing mockups don't block:** Write an unstyled semantic-HTML draft directly in `specification/mockups/` with `<meta name="name">`, `<meta name="description">`, and `<meta name="status" content="draft" />` (wrapping each multi-state fragment in `<!-- {State} -->` / `<!-- This will display when ... -->` / `<!-- / {State} -->` comments per `visual-design` §1.1) and add it to `specification/HUMAN.md`.
- **Human queue:** Keep [`specification/HUMAN.md`](specification/HUMAN.md) current whenever work leaves the human a decision, approval, or draft to style.
- **Specs stay current:** Keep `specification/` synced in the final task/audit and verify status alignment with `specification/README.md`.
- **Don't edit:** `../web-ml` (except creating a new `specification/requests/` file), `node_modules/`, `specification/mockups/` files with `status="ready"` or `status="implemented"` (or `mockups.css`), or `bun.lock` except via `bun add`/`bun remove` when planned. Agents may create or edit `specification/mockups/*.html` only when `<meta name="status" content="draft" />` (or when explicitly authorised by a plan).
- **Git:** Follow [Git workflow](#git-workflow): commit your own changes before ending a session; never push.
- **Style:** British English in prose, docs, and UI strings. Prettier: tabs, single quotes, width 100. Exported TypeScript requires TSDoc ([`specification/standards-and-documentation.md`](specification/standards-and-documentation.md)). Run `bun run format <files>` as the final file-editing step.
- **Web platform:** Baseline Widely Available; WCAG 2.2 AA (`COMPONENTS.md` §1, §7).
- **Reporting:** State exact commands run and real results; explicitly state anything not verified.
