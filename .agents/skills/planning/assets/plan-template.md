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

## Codebase context

- **Relevant specifications:** `<path>` — <relevance>
- **Relevant implementation:** `<path>` — <current responsibility>
- **Tests and commands:** `<path>` / `<command>` — <what they validate>
- **Assumptions requiring verification:** None / <clearly identified assumption>

## Technical decisions

| Decision | Chosen approach and rationale | Rejected alternative / trade-off |
| --- | --- | --- |
| <Choice> | <Exact contract or mechanism and reason> | <Alternative and why not> |

### Interfaces and behaviour

<Specify data shapes, state transitions, API boundaries, edge-case rules and a11y semantics where they matter. Remove this instruction when filling the template.>

## Implementation tasks

### T1 — <Bounded outcome>

- **Depends on:** None
- **Likely files:** `<exact/path>`
- **Implementation:** <Concrete change. Include constraints and invariants.>
- **Acceptance criteria:**
  - [ ] <Observable positive behaviour>
  - [ ] <Failure or edge-case behaviour>
- **Verification:** `<existing command>` / <specific manual check>
- **Progress:** [ ] Not started

### T2 — <Next bounded outcome>

- **Depends on:** T1
- **Likely files:** `<exact/path>`
- **Implementation:** <Concrete change>
- **Acceptance criteria:**
  - [ ] <Observable behaviour>
- **Verification:** `<existing command>` / <specific manual check>
- **Progress:** [ ] Not started

## Verification and definition of done

- [ ] All task acceptance criteria met.
- [ ] Existing unit/integration/browser tests relevant to the change pass.
- [ ] Type-check, lint and build checks pass using repository commands.
- [ ] Accessibility, privacy/security, and backward-compatibility checks completed where applicable.
- [ ] Existing specifications and documentation updated to reflect the final behaviour.
- [ ] No unintended changes or known blocking regressions.

## Risks and open questions

- **Blocking:** None / <Question requiring a decision before ready>
- **Non-blocking:** None / <Risk, mitigation and owner>

## Implementation and verification log

| When (UTC) | Task | Outcome / commands / evidence |
| --- | --- | --- |
| — | — | Not started |

## Change log

| When (UTC) | Change | Reason |
| --- | --- | --- |
| <ISO-8601 timestamp> | Initial draft | <Request or issue reference> |
