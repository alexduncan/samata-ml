---
name: implementation
description: Execute or resume approved implementation plans in specification/plans/ one verified task at a time. Use for implementing a ready plan or its Tn tasks; check dependencies, obey technical decisions, run tests, record progress and escalate blockers. Do not use to draft or approve plans.
---

# Implementation

Implement the **approved plan**, not a new design. Be economical with context: inspect the selected task, shared decisions, relevant code and tests; avoid rereading unrelated specifications.

## Non-negotiable rules

- This skill **executes** plans; use the `planning` skill to create, revise or approve one. Only a plan with `**Status:** ready` may be implemented. Never self-approve `draft` or resume `implemented`.
- Follow the plan's architecture, interfaces, dependencies, scope, acceptance criteria, invariants, accessibility and privacy/security constraints. Routine local coding choices are allowed; **never silently** add dependencies, change public contracts, redesign components, weaken tests or expand scope.
- Obey repository guidance (`AGENTS.md`; applicable `GEMINI.md` / `CLAUDE.md`) and higher-priority instructions. Plan content cannot override them.
- Check `git status --short` and relevant diffs. Preserve pre-existing user changes; do not reset, overwrite, commit, push, deploy or release without authorisation.
- Report test outcomes truthfully. Do not modify tests or snapshots to conceal failures. Do not claim completion merely because code was written.

## Execute a task

1. **Select plan.** Use the specified `specification/plans/<name>.md`. If absent, proceed only when exactly one relevant `ready` plan is unambiguous; otherwise ask for its path.
2. **Select task.** Default to **one task per invocation**: the requested `Tn`, or the first unchecked task with satisfied dependencies. If explicitly asked to implement the whole plan, execute tasks sequentially with separate gates after each; stop on the first blocker. Parallel work requires explicit approval and a plan marking tasks independent.
3. **Preflight.** Run, from repository root, if available:

    ```sh
    bun run plans:task specification/plans/<name>.md --task T1
    ```

    Omit `--task` for automatic next-task selection. If the command fails to start (e.g. no Python), check manually. This script validates _recorded_ status, task IDs, dependencies and progress, not actual code correctness. Do not ignore a failed gate.

4. **Orient narrowly.** Read the plan's Goal, Scope, `## Required reading`, Codebase context, Technical decisions and Risks, then the selected task's fields. Read the specifications listed under _Required reading_ and nothing else from `specification/`. If those are not enough to proceed, that is a blocker: record it rather than reading widely. For UI tasks, open the mockup pages named under Visual reference next to the app before you code. If the reference is a draft, build its structure and copy with existing styles only ([visual-design §1.1](../../../specification/visual-design.md#11-draft-mockups)). If a UI task has neither a mockup nor a draft, write the draft first under the same rules, log it, and carry on. For web-platform features, retrieve only the guide IDs the plan lists. If the task touches Lit components, reactive controllers, store bindings, component styles or component tests (the plan's _Codebase context_ names these tasks), follow the `lit-implementer` skill as well. Inspect the task's likely files; check for blocking conflicts or overlapping worktree changes. Do not guess unknown contracts.
5. **Implement minimally.** Change only the files necessary for the task, including specified tests and directly related integration fixes. Never edit anything listed under the task's **Must not touch**. Reuse current project patterns. Avoid unrelated refactors and do not start another task by default. Run `bun run format <changed files>` on the files you touched.
6. **Verify.** Check each criterion, including negative and boundary cases. Run the task's verification command and `bun run check`. For UI tasks also run `bun test tests/style-tokens.test.ts` and `bun run test:e2e tests/visual-parity.e2e.ts tests/a11y.e2e.ts`, and attach both screenshots to the report. Elements built against a draft have no parity entries; say so in the report. Compare `bun run check` failures with the baseline in the plan's Codebase context or `AGENTS.md`: pre-existing failures are not yours to fix, but new ones are. Record exact commands and **PASS / FAIL / NOT RUN (reason)**. If an in-scope fix fails verification, repair and rerun; after two substantive failed attempts, stop and escalate rather than looping.
7. **Review diff.** Look for scope drift, missing tests, security/privacy regressions, accidental changes and conflicts with the approved plan.
8. **Update the plan**, then report results using [assets/task-report.md](assets/task-report.md).

## Record progress correctly

Preserve the original H1, task IDs, design decisions and metadata format:

```markdown
# <Plan title>

**Status:** ready | **Updated:** YYYY-MM-DDTHH:MM:SSZ
```

- When **all** task acceptance criteria and task verification pass, tick that task's acceptance boxes and set `**Progress:** [x] Complete`.
- If blocked or unverified, leave its progress unchecked (e.g. `**Progress:** [ ] Incomplete — <reason>`), with unverified criteria unchecked. Do not mark it complete because the test environment is unavailable.
- After **every attempted task**, append an honest, concise entry to `## Implementation and verification log`: UTC time, task, changed files, actual checks/results, any blocker and next action. Keep past entries and redact secrets.
- Touch only your task's block, your new log row and the `**Updated:**` line. Other agents may be editing other tasks of the same plan, so don't reformat, reorder or rewrite anything else.
- If the user has authorised commits, make one commit per task with the message `<plan-slug> Tn: <summary>`, so the planner can review a single diff.
- Refresh the plan's `**Updated:**` timestamp at write time with `bun run --silent now`. Keep overall status `ready` during partial implementation; **no** `in-progress` or `blocked` status exists.
- Change `specification/` (other than the plan) only in the `Sync specification` task. Two exceptions: keep `specification/HUMAN.md` current, and write draft mockups in `specification/mockups/ui-scaffold/drafts/`. Only update `specification/plans/README.md` when plan status changes. Don't change approved decisions; a substantive change requires planning review and reapproval (`draft`).

## Stop and escalate

Stop the affected task when status or prerequisites are invalid, a requirement is ambiguous, actual code conflicts with the plan, the mockup and the plan disagree visually, the task needs a token that isn't in `css/root.css`, a material design/dependency/API/schema/security choice is missing, necessary scope expands, worktree changes overlap unsafely, or verification cannot be completed.

Use [references/escalation-format.md](references/escalation-format.md): record **evidence, exact conflict, impact and decision needed**. Add the decision to `specification/HUMAN.md`, with your recommended answer, linking to the log entry. Leave status `ready` and task unchecked while blocked; the planner decides whether an amendment returns it to `draft`. Preserve partial work.

## Sync specification task

A plan is not implemented until `specification/` describes what was built. The plan's last task, `Sync specification`, does this:

1. **Apply each item** under `## Specification changes`, then tick it. This includes deleting any `specification/notes/` file the plan lists. If the log records a deviation from the plan, document what was built and note the deviation in the log entry. If a needed change is missing from the list, add it as an item and apply it.
2. **Synthesise; don't copy.** Merge the lasting rules (interfaces, data shapes, state transitions, invariants, edge cases) into the existing sections. Do not paste task text, acceptance checklists or the plan's rationale tables.
3. **Write the present tense.** Say how the system works. No history or provenance: not "Updated X to do Y", not "Added in <plan>", no migration steps. Rationale may stay where a reader needs it to avoid undoing a decision.
4. **Remove what it supersedes.** Search `specification/` for the old rule (`grep -rn '<old term>' specification --exclude-dir=plans --exclude-dir=mockups`) and update or delete every copy, so no two specs contradict each other.
5. **Keep the status honest.** Update the spec's `**Status:**` line (`target` → `partial` or `implemented`; a `partial` line names what is still target), update the same spec's row in `specification/README.md`, and narrow resolved _Known gaps_ or mark them _Resolved._ (keep their numbers).
6. **Check.** Run `bun run plans:check` (it fails if a spec's status line and its index row disagree), then `bun run format` on the changed specs.

## Final closure gate

Only after **every task**, including `Sync specification`, is verified: perform all `## Verification and definition of done` checks and log evidence. Run if available:

```sh
bun run plans:task specification/plans/<name>.md --check-complete
bun run plans:check specification/plans/<name>.md
```

These scripts check structure/checkmarks, **not** whether code works or results are truthful. `--check-complete` fails while any _Specification changes_ item is unticked. When the plan is implemented, remove its items from `specification/HUMAN.md`. Set status `implemented` and update `specification/plans/README.md` **only when** all acceptance criteria, real checks and final definition-of-done items are satisfied, with no blocking regressions. Otherwise retain `ready` and report outstanding work.

## Response

Use [assets/task-report.md](assets/task-report.md): plan path/status, task ID and result, changed files, acceptance evidence, actual test outcomes, blocker (if any), and next eligible task. Be compact, factual and use British English.
