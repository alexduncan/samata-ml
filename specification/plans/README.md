# Implementation plans

Every substantive proposed change has a durable Markdown plan in this directory. Plans are produced by the `planning` agent skill, are approved before implementation, and remain as a record of decisions and verification.

| Plan | Status | Description |
| --- | --- | --- |
| _None yet_ | — | Add a link whenever a plan is created. |

## Lifecycle

- **draft** — proposed or materially revised; not authorised for implementation.
- **ready** — explicitly approved with blocking questions resolved; implementation may begin.
- **implemented** — all acceptance criteria satisfied and verification evidence recorded.

Each plan has a visible status/timestamp line immediately under its H1 title. Timestamps are ISO-8601 in UTC and update whenever the file changes. Plans must use lowercase kebab-case filenames. Update the table when plan status changes; retain implemented plans for traceability.

## Conventions

- Prefer one plan per cohesive outcome. Revise an existing plan instead of duplicating it.
- Use stable task IDs, task-level acceptance criteria, verifiable commands and a task progress record.
- A substantive approved-plan change returns the status to `draft` for re-approval.
- Implementation agents may make routine local decisions, but must escalate changes to architecture, scope or public interfaces.
- Planning must not modify product code; implementation must not quietly rewrite approved architectural choices.
- Plans complement, rather than replace, authoritative specifications in `specification/`.
