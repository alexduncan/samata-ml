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
- `bun run plans:check [plan.md]` — validate plan structure and that spec status lines match the spec index.
- `bun run build` · `bun run server` (https://localhost:3000) · `bun run serve:scaffold` (mockups).

**Baseline:** `bun run check` passes (0 type errors, 52 tests); `bun run build` passes (emits production bundle in `dist/`). Do not add new failures, and report the before/after counts.

## Map

`src/` app code · `css/` styles · `content/` Markdown pages · `public/` static assets · `scripts/` build and dev servers · `tests/` tests · `specification/` specs (index: [`specification/README.md`](specification/README.md)) · `specification/plans/` plans · `specification/notes/` the human's rough notes (inbox, not normative) · `specification/HUMAN.md` the human's work queue · `specification/mockups/` wireframes, normative for appearance (`ui-scaffold/drafts/` holds unstyled agent drafts)

## Rules

- **Visual fidelity:** The mockups in `specification/mockups/ui-scaffold/` define how the app looks; markup may differ. Follow [`visual-design.md`](specification/visual-design.md): use only tokens from `css/root.css`, with no fallbacks; record every visual deviation; run the parity and token tests for any UI change.
- **Missing mockups don't block:** if a surface has no mockup, write an unstyled semantic-HTML draft in `specification/mockups/ui-scaffold/drafts/` and build against it with existing styles only ([visual-design §1.1](specification/visual-design.md#11-draft-mockups)). Never write CSS or make design decisions for it; the human styles drafts.
- **Human queue:** keep [`specification/HUMAN.md`](specification/HUMAN.md) current in every task. Add an item, with a recommended answer where you have one, whenever your work leaves the human something to decide or do (approval, blocking question, escalation, draft to style). Remove items once they are resolved. The format is at the top of that file.
- **Specs:** pick specs from the index's "Read when" column. Specs marked `target` describe intended design, not current code. Check the index's _Known gaps_ first. If you find a new conflict, record it in the plan's Risks section; never silently pick a side.
- **Specs stay current:** a plan is `implemented` only when its final `Sync specification` task has made the specs describe what was built (procedure in the `implementation` skill; writing rules in [`specification/README.md`](specification/README.md#writing-specs)). A no-plan fix that changes behaviour a spec describes updates that spec in the same change.
- **Don't edit** `specification/notes/` (a plan's `Sync specification` task may delete a note it absorbed), `node_modules/`, `../web-ml`, `specification/mockups/` (except files in `ui-scaffold/drafts/`), vendored skills (`.agents/skills/modern-web-guidance/`), or `bun.lock` except through `bun add`/`bun remove` when a plan allows it.
- **Git:** never commit, push or switch branches unless the user asks. When asked, use one commit per task with the message `<plan-slug> Tn: <summary>`.
- **Style:** British English in prose, docs and UI strings. Prettier settings: tabs, single quotes, width 100. Exported TypeScript needs TSDoc ([standards](specification/standards-and-documentation.md)).
- **Final formatting:** make formatting the final file-editing step for every task. Run `bun run format <files>` on every Prettier-supported file changed by the task, including docs, configuration and tests. Use the appropriate formatter for changed files Prettier does not support. Do not format untouched files. If any file is edited after formatting, format it again before reporting the task complete.
- **Web platform:** Baseline Widely available; WCAG 2.2 AA. Rules are in [`COMPONENTS.md`](specification/COMPONENTS.md) §1 and §7. Use the `modern-web-guidance` skill before using an unfamiliar platform feature.
- **Reporting:** state the exact commands you ran and their results; say what you did not verify (e.g. browsers you could not test). Never claim a check passed if it did not run.
