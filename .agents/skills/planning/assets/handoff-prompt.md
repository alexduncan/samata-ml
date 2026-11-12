# Implementation handoff prompt

Implement **only task <Tn>** from `specification/plans/<plan-slug>.md`.

1. Check that the plan's status is `ready`. If not, stop and report this as a blocker.
2. Read `AGENTS.md`, relevant specifications, the plan's decisions and the target task. Inspect only the code/tests needed for this task and its dependencies.
3. Follow the plan's interface and behaviour decisions. Do not add dependencies, change the architecture, expand scope or start another task without authorisation.
4. Implement the smallest correct change, including the tests explicitly required by the task. Apply existing code style and accessibility conventions.
5. Run the task's verification commands and relevant type-checks, linters or builds. Report each result accurately; do not claim tests passed if they were not run.
6. Update the task's progress, checkboxes, verification log and the plan's Updated timestamp. Keep the overall plan `ready` until every task and final check have been completed.
7. Return: files changed, acceptance criteria met, tests and outcomes, remaining risks, and next task. If blocked by missing facts or a conflict with approved architecture, do not guess: record the blocker and escalate to the planning agent.

Do not start work before verifying the plan status. Make no unrelated edits.
