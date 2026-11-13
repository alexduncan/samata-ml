# <Concise plan title>

**Status:** draft | **Updated:** YYYY-MM-DDTHH:MM:SSZ

## Goal

**Current behaviour:** <What the code currently does, supported by inspected paths.>

**Target behaviour:** <What users or integrations should observe when complete.>

**Why:** <Purpose and expected benefit.>

## Scope

**In scope**

- <Explicit change>

**Out of scope**

- <Explicit non-goal>

**Constraints and invariants**

- <Important unchanged behaviour, compatibility, accessibility, privacy or security constraint>

## Required reading

The implementer reads only these, plus each task's likely files. Everything else is optional.

- `<path>` §<section> / lines <n–m> — <why it is needed>

## Codebase context

Facts the planner verified, so the implementer need not re-check them.

- **Relevant implementation:** `<path>` — <current responsibility>
- **Tests and commands:** `<path>` / `<command>` — <what they validate; baseline result before this plan>
- **Web guidance:** None / `<guide-id>` — <decision taken from it>
- **Visual reference:** None / `<mockup page>` — `<css file>` `<selectors>`; deviations: <register IDs or none>
- **Lit skills:** None / implementers use `lit-implementer` for <task IDs>
- **Known gaps decided:** None / <gap number from specification/README.md and the decision>
- **Assumptions requiring verification:** None / <clearly identified assumption>

## Technical decisions

| Decision | Chosen approach and rationale            | Rejected alternative / trade-off |
| -------- | ---------------------------------------- | -------------------------------- |
| <Choice> | <Exact contract or mechanism and reason> | <Alternative and why not>        |

### Interfaces and behaviour

<Specify data shapes, state transitions, API boundaries, edge-case rules and a11y semantics where they matter. Remove this instruction when filling the template.>

## Specification changes

What `specification/` must say once this plan is implemented. The final task applies these items and ticks each one; `task_gate.py --check-complete` refuses to close the plan while any is unticked.

- [ ] `<Spec path>` §<Section> — <Present-tense rule the spec will state>; status <Old> → <New> (write "(new)" after the path for a spec this plan creates)
- [ ] Known gap <Number> — <Resolved, or the narrower wording that remains>
- [ ] None — <Why no spec describes this behaviour; use this line alone>

## Implementation tasks

### T1 — <Bounded outcome>

- **Depends on:** None
- **Risk:** routine / needs care — <why>
- **Likely files:** `<exact/path>`
- **Must not touch:** None / `<path or API>` — <why>
- **Implementation:** <Concrete change. Include constraints and invariants.>
- **Acceptance criteria:**
    - [ ] <Observable positive behaviour>
    - [ ] <Failure or edge-case behaviour>
- **Verification:** `<existing command>` / <specific manual check>
- **Progress:** [ ] Not started

### T2 — <Next bounded outcome>

- **Depends on:** T1
- **Risk:** routine
- **Likely files:** `<exact/path>`
- **Must not touch:** None
- **Implementation:** <Concrete change>
- **Acceptance criteria:**
    - [ ] <Observable behaviour>
- **Verification:** `<existing command>` / <specific manual check>
- **Progress:** [ ] Not started

### T3 — Sync specification

- **Depends on:** T1, T2
- **Risk:** needs care — specs must describe what was built, not what was planned
- **Likely files:** `<Spec path>`, `specification/README.md`
- **Must not touch:** Product code, tests and `specification/mockups/`
- **Implementation:** Apply every item under _Specification changes_, following "Writing specs" in `specification/README.md`. Where the log records a deviation from the plan, document the deviation, not the plan. Update each changed spec's status line and its row in the index, and narrow or resolve _Known gaps_.
- **Acceptance criteria:**
    - [ ] Every item under _Specification changes_ is applied and ticked.
    - [ ] No changed spec contradicts the code or another spec, or mentions this plan, its tasks or the history of the change.
    - [ ] `bun run plans:check` reports no spec index mismatch.
- **Verification:** `bun run plans:check`; `git diff specification/` reviewed against _Specification changes_
- **Progress:** [ ] Not started

## Verification and definition of done

- [ ] All task acceptance criteria met.
- [ ] `bun run check` introduces no new failures compared with the baseline recorded above.
- [ ] Parity and token tests pass for UI changes.
- [ ] Accessibility, privacy/security and backward-compatibility checks completed where applicable.
- [ ] Every item under _Specification changes_ is ticked, and the specs describe the code as built.
- [ ] No unintended changes outside the tasks' likely files.

## Risks and open questions

- **Blocking:** None / <Question requiring a decision before ready>
- **Non-blocking:** None / <Risk, mitigation and owner>

## Implementation and verification log

| When (UTC) | Task | Outcome / commands / evidence |
| ---------- | ---- | ----------------------------- |
| —          | —    | Not started                   |

## Change log

| When (UTC)           | Change        | Reason                       |
| -------------------- | ------------- | ---------------------------- |
| <ISO-8601 timestamp> | Initial draft | <Request or issue reference> |
