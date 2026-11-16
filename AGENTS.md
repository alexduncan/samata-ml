# samata-ml — agent guide

Browser app (Lit 3, strict TypeScript, Nanostores, IndexedDB, Web Workers) for training machine learning models locally, for education. All training is executed by the sister library `web-ml` (`../web-ml`, read-only from here). This repository never implements training algorithms.

## Upstream Library Specs

- **Primary path:** `../web-ml/specification/public-api/` (and `../web-ml/index.ts`, `../web-ml/specification/model-specifications/`).
- **Package fallback:** `./node_modules/web-ml/specification/public-api/` (and `./node_modules/web-ml/`).
- **Cross-repo scout boundary:** `codebase-scout` may read `../web-ml/specification/public-api/`, `../web-ml/index.ts`, `../web-ml/src/index.ts`, or `./node_modules/web-ml/` to verify model configuration schemas, exported types, and worker initialization contracts (`SharedArrayBuffer`, COOP/COEP). Agents in `samata-ml` must **never** read `../web-ml/specification/internals/` or modify files in `../web-ml`.

## Workflow & Domain Skills

Lifecycle skills and `codebase-scout` live globally via `agent-workflow` (`~/.agents/skills/` and `~/.claude/agents/codebase-scout.md`); project-specific domain skills are symlinked into `.agents/skills/` (git-excluded via `.git/info/exclude`):

- **Discovery (`codebase-scout`):** Delegate source-tree exploration and upstream `web-ml` contract checks before planning or verifying.
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
- `bun run test:e2e [file]` — Playwright end-to-end tests (including `tests/visual-parity.e2e.ts` and `tests/a11y.e2e.ts`).
- `bun run server` · `bun run serve:mockups` · `bun run audit:mockups [paths]`.
- `bun run storybook` · `bun run storybook:build` · `bun run storybook:manifest` · `bun run test:stories`.
- `bun run --silent now` — Current UTC timestamp for plan metadata.
- **Plan gates:** Run `~/.agents/skills/create-plan/scripts/validate_plan.py`, `~/.agents/skills/verify-plan/scripts/review_gate.py`, `~/.agents/skills/implement/scripts/task_gate.py`, and `~/.agents/skills/verify-implementation/scripts/close_gate.py` (or `bun run plans:check` / `bun run plans:task` wrappers if present).

**Shell use (avoids permission prompts & respects `.agents/hooks.json` whitelist):**
Run one command per call from repository root. No `cd`, no `&&`, `;`, or `||` chains, no pipes, no `$(...)`, heredocs, or redirections. Edit files with edit tools rather than shell redirection.

**Baseline:** Record current `bun run check` pass/fail counts in the plan's `Codebase context` rather than assuming static counts; do not introduce new failures.

## Map

`src/` app code · `css/` styles · `content/` Markdown pages & datasets · `public/` static assets · `scripts/` build and dev servers · `tests/` tests · `specification/` specs ([`specification/README.md`](specification/README.md)) · `specification/plans/` plans · `specification/notes/` inbox · `specification/HUMAN.md` human queue · `specification/mockups/` normative wireframes (`ui-scaffold/drafts/` holds unstyled agent drafts).

## Rules

- **Visual fidelity:** Mockups in `specification/mockups/ui-scaffold/` define appearance; follow [`specification/visual-design.md`](specification/visual-design.md), use only tokens from `css/root.css` with no fallbacks, record visual deviations, and run parity/token tests (`bun test tests/style-tokens.test.ts`) for UI changes.
- **Missing mockups don't block:** Write an unstyled semantic-HTML draft in `specification/mockups/ui-scaffold/drafts/` (`visual-design` §1.1) and add it to `specification/HUMAN.md`.
- **Human queue:** Keep [`specification/HUMAN.md`](specification/HUMAN.md) current whenever work leaves the human a decision, approval, or draft to style.
- **Specs stay current:** Keep `specification/` synced in the final task/audit and verify status alignment with `specification/README.md`.
- **Don't edit:** `../web-ml`, `node_modules/`, `specification/mockups/` (except `ui-scaffold/drafts/`), or `bun.lock` except via `bun add`/`bun remove` when planned.
- **Git:** Never commit, push, or switch branches unless the user asks.
- **Style:** British English in prose, docs, and UI strings. Prettier: tabs, single quotes, width 100. Exported TypeScript requires TSDoc ([`specification/standards-and-documentation.md`](specification/standards-and-documentation.md)). Run `bun run format <files>` as the final file-editing step.
- **Web platform:** Baseline Widely Available; WCAG 2.2 AA (`COMPONENTS.md` §1, §7).
- **Reporting:** State exact commands run and real results; explicitly state anything not verified.
