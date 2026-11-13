---
name: planning
description: Create or revise implementation-ready technical plans for repository changes, features, refactors and bug fixes. Inspect the codebase, resolve technical decisions, break work into verifiable tasks and save a Markdown plan under specification/plans/. Use for planning or plan review; do not implement code as part of this skill.
---

# Planning

Turn a requested change into a self-contained contract that a cheaper coding agent, possibly from a different vendor, can execute without re-reading the specs or making architectural choices.

## Boundaries

- **Planning only:** inspect and research, but never change product code. You may create or update plan files, `specification/plans/README.md`, the _Known gaps_ list in `specification/README.md`, `specification/HUMAN.md`, and draft mockups in `specification/mockups/ui-scaffold/drafts/`. Other specs change only through a plan's `Sync specification` task (or when reviewing one).
- Every invocation must **save or update** a plan in `specification/plans/` before finishing. Never stop at an answer in chat.
- Use [assets/plan-template.md](assets/plan-template.md). Keep its headings, task fields and the metadata line.
- If an existing plan covers the same change, revise it rather than creating a duplicate. Never overwrite an unrelated plan.
- Resolve consequential choices here. The implementation agent ([`implementation` skill](../implementation/SKILL.md)) may only make routine local decisions.

## Workflow

1. **Orient.** Use the "Read when" column in `specification/README.md` to pick the relevant specs, and check its _Known gaps_ and `specification/TODO.md` for open questions the change depends on (cite them by ID). Check `specification/notes/` for the human's notes on the change, and use them as its [README](../../../specification/notes/README.md) describes. Read those specs, then the code, tests and scripts the change touches. Do not re-read `AGENTS.md`; it is already loaded.
2. **Define outcome.** State current behaviour (with paths), target behaviour, scope, non-goals and constraints (APIs, types, a11y, browser support, privacy, performance).
3. **Resolve decisions.** Record integration points, contracts, alternatives and trade-offs. Separate verified facts from assumptions. Prefer existing architecture and dependencies. If a spec is `draft`, or the change hits a _Known gap_, decide it explicitly or list it as a blocking question.
4. **Web platform research.** For browser-facing work, run the `modern-web-guidance` skill once per capability (use `bunx` instead of `npx`). Record the guide IDs and the decisions you took from them in the plan, so implementers retrieve only those guides and don't search again.
5. **Lit design.** If the change adds or changes Lit components, reactive controllers, store bindings, component styles or component tests, follow the `lit-architecture` skill. It puts the component design into this plan template.
   5a. **Visual reference.** For any task that changes something a user sees, open the mockup page(s) in `specification/mockups/ui-scaffold/` (`bun run serve:scaffold`). Name the page(s), the CSS file(s) and the selectors for each element in _Codebase context_ → **Visual reference**, and add them to _Required reading_. Check every path exists (`ls`). Decide each deviation from `visual-design.md` §4/§5, or list it as a blocking question. Add parity entries to the task's acceptance criteria. If no mockup exists, or its file is empty, don't block: write a draft as [visual-design §1.1](../../../specification/visual-design.md#11-draft-mockups) describes, before you finish the plan. Name it as `draft:` under **Visual reference**, follow §1.1 for its styling limits, list "awaiting a styled mockup" as non-blocking under _Risks and open questions_, and add it to `specification/HUMAN.md`. Draft only what the behaviour spec defines. If the spec is missing too, that is the blocking question.
6. **Distil required reading.** List under `## Required reading` the minimum the implementer must read: exact paths, sections (e.g. `specification/COMPONENTS.md §3, §7`) or line ranges. Check that every cited path exists (`ls`). Copy short normative rules into the task instead of linking a long document. Anything not listed is optional for the implementer.
   6a. **Specification changes.** List under `## Specification changes` every spec section, status line and _Known gap_ that will be out of date once the plan is built, with the present-tense rule each will state. Usually a `target` or `partial` spec moves towards `implemented`. If no spec describes the behaviour, write the single `None — <reason>` item; if one should, add it as a change. Do not edit the specs now: they must describe what is built, and nothing is built yet.
7. **Decompose.** Write small, ordered tasks with stable IDs (`T1`, `T2`, …). The last task is always `Sync specification` (see the template), depending on every other task. Each task has every field in the template: dependencies, exact likely files, **Must not touch** (nearby files or APIs that are out of scope), concrete actions, independently testable acceptance criteria, and a verification command. Each task should fit one focused session. Mark tasks parallel-safe only when their files don't overlap. Set **Risk** to `needs care` where a weaker model is likely to go wrong, so the user can route that task to a stronger agent.
8. **Verification.** Use only commands that exist: `bun run check`, `bun test <path>`, `bun run build`, `bun run plans:check`. Note the baseline failures listed in `AGENTS.md`, so implementers compare before and after counts instead of trying to fix unrelated failures. If a needed tool isn't installed (e.g. Playwright), either add an installation task or record the check as manual. Never invent commands.
9. **Write the plan.** Use a lower-case kebab-case filename. The H1 is followed (after one blank line) by `**Status:** draft | **Updated:** <UTC>`, with the time from `bun run --silent now` at write time. Refresh it on every change. Use British English. Link sources by path; don't paste large code or duplicate specs.
10. **Index and validate.** Add or update the row in `specification/plans/README.md` (the status must match the plan's). Run `bun run plans:check specification/plans/<file>.md` and fix every error. Read the saved file before reporting.
    10a. **Update the human queue.** In `specification/HUMAN.md`, add or update one item per blocking question (with your recommended answer), one asking for approval when the plan is waiting for it, and one per draft mockup. Remove items this plan has resolved. Follow the format at the top of that file and check its links.
11. **Hand off.** Reply with: the path, status, key decisions, blockers, and the handoff line `Use the implementation skill to implement T1 of specification/plans/<file>.md.` Never claim a plan exists unless it is on disk.

## Status transitions

- `draft`: under review, has blocking questions, or was materially changed after approval.
- `ready`: only after the user explicitly approves, no blocking questions remain, and the readiness gate passes. Never self-approve.
- `implemented`: set by the implementation agent, only after all tasks and final checks pass with evidence recorded.
- A substantive change to a `ready` plan returns it to `draft`. Task progress alone does not.

## Readiness gate

- Scope, exclusions and behaviour are unambiguous.
- Decisions are explicit, justified and compatible with the code. Every relevant _Known gap_ is decided.
- _Required reading_ is complete: an implementer who reads only it plus the task's likely files has everything they need.
- Every UI task cites existing mockup paths and selectors, or a draft mockup (visual-design §1.1).
- Every cited path exists.
- Every task has concrete actions, must-not-touch boundaries, testable acceptance criteria and a real verification command.
- _Specification changes_ names every spec and _Known gap_ the plan makes stale, and the last task is `Sync specification`.
- `bun run plans:check` passes, no blocking questions remain, and the user has approved.

## Reviewing an implemented task

When asked to review an implementer's work, check the diff (`git diff` or the task's commit) against the task's acceptance criteria and must-not-touch list. Read only the changed files. Record the outcome in the plan's log. Send a correction back as a new or amended task rather than editing product code yourself.

When reviewing the `Sync specification` task, also check that `git diff specification/` covers every item under _Specification changes_ and every deviation in the log, follows "Writing specs" in `specification/README.md`, and leaves no superseded rule elsewhere in the specs. You may fix wording in specs directly; specs are not product code.
