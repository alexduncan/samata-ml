# samata-ml — agent guide

Browser app (Lit 3, strict TypeScript, Nanostores) for training machine learning models locally, for education. All training is done by the sister library `web-ml` (`../web-ml`, read-only from here). This repo never implements training algorithms.

## Roles

- **Planning** → `planning` skill. Reads specs, makes the decisions, writes `specification/plans/<slug>.md`. Never edits product code.
- **Implementation** → `implementation` skill. Executes tasks of a `ready` plan. Reads the plan's _Required reading_, not the whole spec set; the plan has already distilled the specs.
- **Lit work:** when a plan or task touches Lit components, reactive controllers, store bindings, component styles or component tests, planners also use the `lit-architecture` skill and implementers also use the `lit-implementer` skill. Both are procedures; the rules are in [`COMPONENTS.md`](specification/COMPONENTS.md).
- **No plan:** only trivial fixes (typo, one-file bug fix, no public API, dependency, schema or architecture change). Anything larger needs a plan; ask for one.

## Commands

Bun only: never npm, yarn, pnpm or `npx` (use `bunx`, including for commands in vendored skills).

- `bun run check` — typecheck + tests. Run it before reporting a task as done.
- `bun test <path>` — one test file.
- `bun run format <files>` — Prettier on the files you changed.
- `bun run plans:check [plan.md]` — validate plan structure.
- `bun run build` · `bun run server` (https://localhost:3000) · `bun run serve:scaffold` (mockups).

**Baseline failures:** `bun run check` already fails (20 type errors, mostly from the pre-Lit Mithril views in `src/views/` and `src/partials/`, plus 1 failing test in `tests/serve-ui-scaffold.test.ts`), and `bun run build` fails (missing `src/models/storage/storageWorker.ts`). Don't fix these unless your task says to. Do not add new failures, and report the before/after counts.

## Map

`src/` app code · `css/` styles · `content/` Markdown pages · `public/` static assets · `scripts/` build and dev servers · `tests/` tests · `specification/` specs (index: [`specification/README.md`](specification/README.md)) · `specification/plans/` plans · `specification/mockups/` wireframes

## Rules

- **Specs:** pick specs from the index's "Read when" column. Specs marked `target` describe intended design, not current code. Check the index's _Known gaps_ first. If you find a new conflict, record it in the plan's Risks section; never silently pick a side.
- **Don't edit** `node_modules/`, `../web-ml`, `specification/mockups/`, vendored skills (`.agents/skills/modern-web-guidance/`), or `bun.lock` except through `bun add`/`bun remove` when a plan allows it.
- **Git:** never commit, push or switch branches unless the user asks. When asked, use one commit per task with the message `<plan-slug> Tn: <summary>`.
- **Style:** British English in prose, docs and UI strings. Prettier settings: tabs, single quotes, width 100. Exported TypeScript needs TSDoc ([standards](specification/standards-and-documentation.md)).
- **Final formatting:** make formatting the final file-editing step for every task. Run `bun run format <files>` on every Prettier-supported file changed by the task, including docs, configuration and tests. Use the appropriate formatter for changed files Prettier does not support. Do not format untouched files. If any file is edited after formatting, format it again before reporting the task complete.
- **Web platform:** Baseline Widely available; WCAG 2.2 AA. Rules are in [`COMPONENTS.md`](specification/COMPONENTS.md) §1 and §7. Use the `modern-web-guidance` skill before using an unfamiliar platform feature.
- **Reporting:** state the exact commands you ran and their results; say what you did not verify (e.g. browsers you could not test). Never claim a check passed if it did not run.
