---
name: planning
description: Create or revise implementation-ready technical plans for repository changes, features, refactors and bug fixes. Inspect the codebase, resolve technical decisions, break work into verifiable tasks and save a Markdown plan under specification/plans/. Use for planning or plan review; do not implement code as part of this skill.
---

# Planning

Turn a requested change into a durable, implementation-ready contract that another coding agent can execute with minimal architectural reasoning.

## Boundaries

- This is a **planning-only** skill: inspect and research, but do not make product-code changes. You may create or update plan files and their index.
- Every invocation must **save or update** a Markdown plan in `specification/plans/` before finishing. Do not stop at an answer in chat.
- Use the template in [assets/plan-template.md](assets/plan-template.md). Preserve its heading structure and visible metadata line.
- If an existing plan covers the same change, revise that file rather than creating a duplicate. Never overwrite an unrelated plan.
- The approved plan is authoritative for implementation. Resolve consequential choices here; do not delegate architecture to the implementation agent.

## Workflow

1. **Orient.** Read `AGENTS.md`, `GEMINI.md` if present, `specification/README.md`, relevant specifications, implementation code, tests and package/build scripts. Read only files relevant to the requested change. Identify any existing plan in `specification/plans/`.
2. **Define outcome.** Describe current behaviour, desired observable behaviour, explicit scope and non-goals. Record all constraints: APIs, types, accessibility, browser support, compatibility, security/privacy, performance and repository conventions where relevant.
3. **Resolve technical decisions.** Identify integration points, affected paths, data flows, important contracts, alternatives and trade-offs. Distinguish verified facts from assumptions. Prefer existing architecture and dependencies unless there is a clear reason not to. Record any unresolved blocking decision explicitly.
4. **Decompose.** Make small, ordered tasks with stable IDs (`T1`, `T2`, ...), prerequisites, exact likely files, specific implementation actions, independent acceptance criteria and test commands. Avoid tasks such as “implement feature” or “add tests” without describing the required behaviour. Prefer tasks one agent can complete and verify in one focused session. Mark parallel-safe tasks only when they genuinely do not overlap.
5. **Establish verification.** Include success and failure/edge cases; appropriate unit/integration/UI and accessibility checks; runnable commands already supported by the repository; and a final definition of done. Do not invent commands or file paths—if unknown, label them as needing verification.
6. **Write the plan.** Use a lower-case kebab-case filename, e.g. `specification/plans/add-stratified-cross-validation.md`. Start with `# <Title>` followed immediately by the single visible line `**Status:** draft | **Updated:** <ISO-8601 UTC timestamp>`. Get the current timestamp from `date -u '+%Y-%m-%dT%H:%M:%SZ'` (or an equivalent clock) **at write time**. Refresh it every time the file is changed, not merely read. Use `draft` for new and materially revised plans.
7. **Index and validate.** Add or update the plan link and status in `specification/plans/README.md` and any existing specification index that conventionally lists plans. Run `python3 .agents/skills/planning/scripts/validate_plan.py specification/plans/<file>.md` if Python is available. Inspect the saved file before reporting completion.
8. **Hand off.** Reply with the saved relative path, status, a compact summary of decisions, the recommended first task and any blockers. Never imply a plan was written unless it exists on disk.

## Status transitions

- `draft`: still under review, contains unresolved blocking questions, or has been materially changed after approval.
- `ready`: the user explicitly approves the plan (or has already clearly authorised this exact plan), all blocking questions are resolved, and the readiness checklist passes. Do not self-approve a new plan.
- `implemented`: implementation is complete, checks have passed, and outcomes have been verified against the acceptance criteria. An implementation or verification agent may set this status only after recording evidence; writing code alone is not sufficient.
- A substantive change to a `ready` plan returns it to `draft` for re-approval. Progress against existing tasks does not by itself invalidate approval.

## Readiness gate

A plan can be marked `ready` only when:

- Scope, exclusions and required behaviour are unambiguous.
- Key architectural decisions are explicit, justified and compatible with the codebase.
- Each task has concrete actions, affected components, dependencies and testable acceptance criteria.
- Tasks are ordered and scoped to minimise overlapping edits and unintended changes.
- Validation commands and manual checks are concrete; unknowns are non-blocking or resolved.
- No blocking questions remain, and the user has approved the plan.

## Hand-off rules for cheaper implementation agents

- Complete tasks in order (or follow explicitly recorded dependency/parallelism rules).
- Follow recorded design decisions; choose only routine local implementation details using existing code patterns.
- Do not silently add dependencies, alter public contracts, expand scope or re-architect the solution.
- If the plan conflicts with actual code or a blocking requirement is ambiguous, stop that task, record the precise blocker and evidence in the plan, and request a planning decision. Do not guess.
- After each task, check its acceptance criteria, run relevant available checks, record results and tick it off. Keep the existing plan path, status line and task IDs stable.
- Mark the plan `implemented` only after all tasks and final checks pass and the results are recorded.

## Quality standard

Optimise for **decision completeness**, not document length. Be explicit where a cheaper agent might make the wrong design choice, terse where the repository already establishes an unambiguous pattern. Do not paste large code files or duplicate specifications. Link relevant sources by repository path. Use British English for prose.
