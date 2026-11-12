# Escalation format for planning agents

Use this when an implementation task cannot proceed under the approved contract.

```md
**Plan:** specification/plans/<name>.md
**Task:** Tn
**Blocker:** <one-line summary>
**Evidence:** <exact path and code location, error message, or behaviour actually observed>
**Conflict:** <specific approved decision, invariant, dependency, scope or acceptance criterion affected>
**Impact:** <what will fail or change if not resolved>
**Decision needed:** <one precise question for the planning agent / user>
**Possible options (optional):** <A / B, with constraints; do not silently choose>
**Work completed:** <changed files, checks already run and outcomes>
```

Write a short entry in the plan's implementation log (without secrets), refresh `Updated` in UTC and stop the blocked task. Leave plan status `ready` unless an authorised planning revision changes it to `draft`. Preserve all partial work, unless the user instructs otherwise.
