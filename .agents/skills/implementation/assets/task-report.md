# Task completion / handoff format

Use the following **response structure** after executing a task. This is a response template, not a new file to create for each task.

```md
**Plan:** `specification/plans/<file>.md` (status: ready | implemented)
**Task:** Tn — <name>
**Outcome:** Complete | Incomplete | Blocked

**Changes:** `<path>` — <what changed>; `<path>` — <what changed>
**Acceptance:** <criterion and evidence>; <criterion and evidence>
**Verification:** `<actual command>` — PASS / FAIL / NOT RUN (<reason>)
**Scope / risks:** None, or <specific concern>
**Next:** Tm — <name> | Request planning decision <exact question> | All done
```

Rules: no invented execution results; mention any relevant dirty worktree changes, skipped checks, or unverified claims. Prefer direct statements over lengthy retellings of the plan.
