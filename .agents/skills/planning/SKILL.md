---
name: planning
description: Create or revise implementation-ready technical plans for repository changes, features, refactors and bug fixes. Inspect the codebase, resolve technical decisions, break work into verifiable tasks and save a Markdown plan under specification/plans/. Use for planning or plan review; do not implement code as part of this skill.
---

# Planning

Turn a requested change into a self-contained contract that a cheaper coding agent, possibly from a different vendor, can execute without re-reading the specs or making architectural choices.

## Boundaries

- **Planning only:** inspect and research, but never change product code. You may create or update plan files, `specification/plans/README.md`, and the _Known gaps_ list in `specification/README.md`.
- Every invocation must **save or update** a plan in `specification/plans/` before finishing. Never stop at an answer in chat.
- Use [assets/plan-template.md](assets/plan-template.md). Keep its headings, task fields and the metadata line.
- If an existing plan covers the same change, revise it rather than creating a duplicate. Never overwrite an unrelated plan.
- Resolve consequential choices here. The implementation agent ([`implementation` skill](../implementation/SKILL.md)) may only make routine local decisions.

## Workflow

1. **Orient.** Use the "Read when" column in `specification/README.md` to pick the relevant specs, and check its _Known gaps_ and `specification/TODO.md` for open questions the change depends on (cite them by ID). Read those specs, then the code, tests and scripts the change touches. Do not re-read `AGENTS.md`; it is already loaded.
2. **Define outcome.** State current behaviour (with paths), target behaviour, scope, non-goals and constraints (APIs, types, a11y, browser support, privacy, performance).
3. **Resolve decisions.** Record integration points, contracts, alternatives and trade-offs. Separate verified facts from assumptions. Prefer existing architecture and dependencies. If a spec is `draft`, or the change hits a _Known gap_, decide it explicitly or list it as a blocking question.
4. **Web platform research.** For browser-facing work, run the `modern-web-guidance` skill once per capability (use `bunx` instead of `npx`). Record the guide IDs and the decisions you took from them in the plan, so implementers retrieve only those guides and don't search again.
5. **Distil required reading.** List under `## Required reading` the minimum the implementer must read: exact paths, sections (e.g. `specification/COMPONENTS.md §3, §7`) or line ranges. Copy short normative rules into the task instead of linking a long document. Anything not listed is optional for the implementer.
6. **Decompose.** Write small, ordered tasks with stable IDs (`T1`, `T2`, …). Each task has every field in the template: dependencies, exact likely files, **Must not touch** (nearby files or APIs that are out of scope), concrete actions, independently testable acceptance criteria, and a verification command. Each task should fit one focused session. Mark tasks parallel-safe only when their files don't overlap. Set **Risk** to `needs care` where a weaker model is likely to go wrong, so the user can route that task to a stronger agent.
7. **Verification.** Use only commands that exist: `bun run check`, `bun test <path>`, `bun run build`, `bun run plans:check`. Note the baseline failures listed in `AGENTS.md`, so implementers compare before and after counts instead of trying to fix unrelated failures. If a needed tool isn't installed (e.g. Playwright), either add an installation task or record the check as manual. Never invent commands.
8. **Write the plan.** Use a lower-case kebab-case filename. The H1 is followed (after one blank line) by `**Status:** draft | **Updated:** <UTC>`, with the time from `date -u '+%Y-%m-%dT%H:%M:%SZ'` at write time. Refresh it on every change. Use British English. Link sources by path; don't paste large code or duplicate specs.
9. **Index and validate.** Add or update the row in `specification/plans/README.md` (the status must match the plan's). Run `bun run plans:check specification/plans/<file>.md` and fix every error. Read the saved file before reporting.
10. **Hand off.** Reply with: the path, status, key decisions, blockers, and the handoff line `Use the implementation skill to implement T1 of specification/plans/<file>.md.` Never claim a plan exists unless it is on disk.

## Status transitions

- `draft`: under review, has blocking questions, or was materially changed after approval.
- `ready`: only after the user explicitly approves, no blocking questions remain, and the readiness gate passes. Never self-approve.
- `implemented`: set by the implementation agent, only after all tasks and final checks pass with evidence recorded.
- A substantive change to a `ready` plan returns it to `draft`. Task progress alone does not.

## Readiness gate

- Scope, exclusions and behaviour are unambiguous.
- Decisions are explicit, justified and compatible with the code. Every relevant _Known gap_ is decided.
- _Required reading_ is complete: an implementer who reads only it plus the task's likely files has everything they need.
- Every task has concrete actions, must-not-touch boundaries, testable acceptance criteria and a real verification command.
- `bun run plans:check` passes, no blocking questions remain, and the user has approved.

## Reviewing an implemented task

When asked to review an implementer's work, check the diff (`git diff` or the task's commit) against the task's acceptance criteria and must-not-touch list. Read only the changed files. Record the outcome in the plan's log. Send a correction back as a new or amended task rather than editing product code yourself.
