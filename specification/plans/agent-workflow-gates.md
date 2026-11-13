# Agent workflow gates: create-plan, verify-plan, implement, verify-implementation

**Status:** draft | **Updated:** 2026-11-13T19:10:15Z

## Goal

**Current behaviour:** Two skills run the workflow. `planning` (`.agents/skills/planning/SKILL.md`) writes plans, and a plan becomes `ready` once the human approves it (`specification/plans/README.md` § Lifecycle). Nothing records who approved it, or whether the plan changed after approval. `implementation` (`.agents/skills/implementation/SKILL.md`) is run by cheaper agents. It does three jobs: writes code; writes `specification/HUMAN.md` items when it escalates; and runs each plan's final `Sync specification` task, which rewrites the specs. It also sets a plan to `implemented`. Implemented plans stay in `specification/plans/` beside active ones. Gate scripts: `validate_plan.py` (`bun run plans:check`) checks structure. `task_gate.py` (`bun run plans:task`) checks the status line and checkboxes. `planning` § "Reviewing an implemented task" describes an optional review by the planner.

**Target behaviour:** Four skills, each with one owner role and a gate script:

1. **`create-plan`** (high-effort agent) writes and revises plans. It records every author, works through a shared decision checklist, and challenges weak spec rules. When no blocking question remains, it submits the plan as `ready-for-review`.
2. **`verify-plan`** (high-effort agent, not one of the plan's authors) reviews the plan independently. It either approves it, which sets `ready` and stores a fingerprint of the plan's content, or sends it back to `draft` with findings.
3. **`implement`** (fast, cheaper agent) writes only code and tests. It records blockers as numbered escalations in the plan, stops when one is blocking, and never edits `HUMAN.md` or specs.
4. **`verify-implementation`** (high-effort agent, not one of the implementers) works in two modes:
    - **Checkpoint:** reviews `needs care` tasks as they finish.
    - **Closing review:** runs the automated gates, audits the diff against the plan, settles escalations, writes fix items back to `implement`, syncs the specs, sets `implemented` and moves the plan to `specification/plans/archive/`.

Implementation can't start unless the plan's fingerprint matches its approval.

**Why:** Unresolved design questions currently reach the cheap implementer, and `HUMAN.md` fills with approval requests and unstructured escalations. Each job should go to the model tier that does it best: decisions and audits to the high-effort models, code generation to the cheap ones. The gates must be scripts that work the same way in Claude Code, Codex and Antigravity.

## Scope

**In scope**

- Rename `planning` to `create-plan` and `implementation` to `implement`, updating every reference.
- New skills `verify-plan` and `verify-implementation`, with reference files and gate scripts.
- Plan metadata (authors, verification stamp, fingerprint, implementation-verification stamp); the `ready-for-review` status; new sections _Escalations_, _Review fixes_ and _Plan review history_; an `Agent (model)` column in the implementation log; removal of the final `Sync specification` task from the template.
- A shared decision checklist and rules for challenging specs (Lit, accessibility, storage, workers, UI states).
- Moving existing plans to the new format, and archiving the implemented ones (link-safe).
- `bun run` scripts for every gate, plus `bun run verify` and `bun run skills:test`.
- `AGENTS.md`: roles, model routing, `HUMAN.md` ownership, the spec-sync rule, and a baseline rule that doesn't go stale.

**Out of scope**

- MCP servers, a `decide` skill for the human, a git pre-commit hook, and a console-error helper for Playwright tests. These are follow-ups, if wanted.
- Any change to product code (`src/`, `css/`, `content/`, `public/`, `scripts/` other than `package.json` scripts), tests in `tests/`, or `../web-ml`.
- Rule changes to product specs: `COMPONENTS.md` (e.g. the cross-shadow-root ID rule), `visual-design.md` §1.1 (draft-sync rule). Make these in follow-up plans or no-plan fixes.
- Answering any open item in `HUMAN.md`.
- Vendor configuration outside the repository (`~/.codex`, `~/.gemini`).

**Constraints and invariants**

- The gate scripts use only the Python standard library and run from the repository root through `bun run`. Agents never call `python3` directly (AGENTS.md § Commands).
- The fingerprint is a guard against acting on a stale approval, not proof of identity: agents report their own agent and model. The skills must say so.
- Keep the plan structure the existing tooling relies on: the H1, the `**Status:** … | **Updated:** …` line as the first non-blank line after the H1, the `### Tn — …` task headings and the task fields.
- Existing plans must keep validating after migration. No product scope or behaviour changes during migration. Legacy final Sync specification tasks retain their verifier-owned closure role, as described below.
- British English; Prettier formatting (`proseWrap` is unset, so the metadata line breaks are kept).

## Required reading

The implementer reads only these, plus each task's likely files. Everything else is optional.

- `AGENTS.md` (already loaded) — Commands, Rules.
- `.agents/skills/planning/SKILL.md` and `.agents/skills/implementation/SKILL.md` — the procedures being split and renamed (T1, T7, T9, T10).
- `.agents/skills/planning/assets/plan-template.md` — the current template (T4).
- `.agents/skills/planning/scripts/validate_plan.py`, `.agents/skills/implementation/scripts/task_gate.py`, `.agents/skills/implementation/scripts/test_task_gate.py` — the scripts being extended (T2–T5).
- `/Users/alex/Sites/web-ml/web-ml/.agents/skills/verify-plan/scripts/review_gate.py` and `test_review_gate.py` (read-only, sister repo) — the model for T2. The differences to apply are under _Interfaces and behaviour_ below.
- `/Users/alex/Sites/web-ml/web-ml/.agents/skills/verify-plan/SKILL.md` and its `references/` (read-only) — the model for T8.
- `specification/README.md` § Writing specs — the rules the spec sync follows (T10, T12).
- `specification/HUMAN.md` § How this file is maintained (T10, T12).

## Codebase context

Facts the planner verified, so the implementer need not re-check them.

- **Relevant implementation:**
    - `.agents/skills/{planning,implementation,lit-architecture,lit-implementer}/` are the current skills. `.claude/skills/<name>` are relative symlinks to `../../.agents/skills/<name>`. Codex and Antigravity read `.agents/skills/` directly.
    - `validate_plan.py` accepts the statuses `draft|ready|implemented|stub` (`METADATA`, line 47). It globs `specification/plans/*.md`, not subfolders, and finds a plan's index at `path.parent / "README.md"`.
    - `task_gate.py` accepts `draft|ready|implemented` (line 16). `completion_gate()` requires every _Specification changes_ item to be ticked.
    - web-ml's `review_gate.py` expects its metadata on lines 2–5, with no blank line after the H1. It hashes Goal, Scope, Codebase context, Technical decisions, Implementation tasks, Verification and definition of done, and Risks and open questions. It compares only the agent name, not the model (`agent_name()`).
- **Tests and commands:**
    - `bun run check` passed on 2026-11-13: 144 tests in 22 files, no type errors.
    - `bun run plans:check` passes.
    - `bun run plans:task {plan}` works (added 2026-11-13).
    - Python script tests run as `python3 {file}`: each test file ends in `unittest.main()`. No bun script runs them yet.
- **References to the old skill names** (found with grep): `AGENTS.md` lines 7–8 and 44; `package.json` (`plans:check`, `plans:task`); `.agents/skills/lit-architecture/SKILL.md` lines 3 and 8; `.agents/skills/lit-implementer/SKILL.md` lines 3, 8 and 11; `specification/plans/README.md` lines 3 and 26–27; `specification/README.md` lines 21 and 69; `specification/notes/README.md` line 9; `specification/HUMAN.md` § 2 intro; the skills' own cross-links; `test_task_gate.py`.
- **Plans and their links:**
    - **Implemented (8):** the five `scaffolding-*`, `mockup-visual-fidelity`, `data-ingestion-and-storage` and `static-content-pipeline`. Inbound links to them exist in `specification/README.md`, `TODO.md`, `HUMAN.md`, `notes/README.md` and other plans. `data-ingestion-and-storage.md` (14 links) and `static-content-pipeline.md` (8) contain relative links that break if the file moves without rewriting.
    - **Ready:** None after this review's substantive amendments. Prior state-navigation product answers remain accepted, but the amended plan needs review.
    - **Draft:** `step-1-load-data-and-preview`, `step-2-set-target`, `step-3-train-models-overview-and-setup`, `virtual-table-component`, `reference-dataset-regression-tests`.
    - Run the migration on the statuses actually in the files at that time; don't assume this list is still current.
- **Web guidance:** None — tooling and prose only.
- **Visual reference:** None.
- **Lit skills:** None. `lit-architecture` and `lit-implementer` are edited as text (T7, T9); no Lit code changes.
- **Known gaps decided:** None.
- **Review author:** Codex (model unrecorded), 2026-11-13; retain this co-author during workflow migration.
- **Review handoff:** The review changes bootstrap/gate contracts, so prior approval is stale and this plan returns to draft. Current tooling cannot represent ready-for-review: obtain renewed approval under the existing workflow to bootstrap T1; never invent a verification stamp or self-approve. Other drafts are submitted only after tooling exists and product blockers are answered.
- **Assumptions requiring verification:** Prettier keeps the consecutive metadata lines as separate lines. `proseWrap` defaults to `preserve`; T3 confirms this by formatting a migrated plan.

## Technical decisions

| Decision                                | Chosen approach and rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Rejected alternative / trade-off                                                                                     |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| D1 Skill names                          | `create-plan`, `verify-plan`, `implement`, `verify-implementation`, matching web-ml so the same human uses the same names in both repos.                                                                                                                                                                                                                                                                                                                                                                                                                                                | Keeping `planning`/`implementation`: inconsistent across repos.                                                      |
| D2 Statuses                             | `stub`, `draft`, `ready-for-review`, `ready`, `implemented`. Who sets each is under _Interfaces_. The plan stays `ready` while it is built.                                                                                                                                                                                                                                                                                                                                                                                                                                             | An `in-review` or `verified` status: adds states without adding a gate.                                              |
| D3 Plan approval                        | Only `verify-plan` sets `ready`. No human sign-off (user decision, 2026-11-13). The human answers product questions before submission.                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Keeping human approval: it is the bottleneck in `HUMAN.md` §2.                                                       |
| D4 Plan reviewer independence           | The reviewer's agent name (the part before ` (`) must differ from every agent name in `**Authors:**`, as in web-ml (user decision, 2026-11-13).                                                                                                                                                                                                                                                                                                                                                                                                                                         | Different model only: weaker; a fresh session alone can't be checked.                                                |
| D5 Authors                              | Replace web-ml's `Created by` with `**Authors:** {agent} ({model}), …` (first entry is the creator). Every agent that edits a plan's normative sections adds itself if absent. This closes the loophole where one agent creates the plan, another rewrites it, and the second then reviews it.                                                                                                                                                                                                                                                                                          | A single creator field: can't detect co-authors.                                                                     |
| D6 Fingerprint                          | SHA-256 over the H1 plus the normative sections: Goal, Scope, Required reading, Codebase context, Technical decisions, Specification changes, Implementation tasks, Verification and definition of done, Risks and open questions. Ignore `**Progress:**` lines. Normalise checkboxes to `[ ]`. Collapse runs of whitespace and table padding, so reformatting with Prettier doesn't break the approval. Metadata, log, escalations, review fixes, review history and change log are excluded.                                                                                          | web-ml's raw-text hash: a Prettier re-alignment of a table would break it.                                           |
| D7 Implementation verifier independence | The `{agent} ({model})` identity that closes the plan must not equal any identity in the log rows for `T*` or `R*` tasks. Agent and model are compared case-insensitively. A different model of the same product is allowed, since the point is the stronger tier. The reviewer's own `Review` rows are exempt.                                                                                                                                                                                                                                                                         | Requiring a different vendor: needlessly strict for a tier split.                                                    |
| D8 Escalations                          | `implement` records blockers in a new non-normative `## Escalations` section as `- [ ] **E{n} ({task}):** …`, with detail in the log using `implement/references/escalation-format.md`. A blocking escalation stops the task. The task gate refuses to start a task that has an open escalation, and refuses completion while any is open. No `TODO(human)` markers in code.                                                                                                                                                                                                            | Code markers: scattered, easy to ship, and surface only at the final review.                                         |
| D9 Review fixes                         | Fixes from `verify-implementation` go in a new non-normative `## Review fixes` section: `- [ ] **R{n}** \`{path}\` \`{symbol}\` — {defect}. Test: {assertion}.` `implement` works on them as tasks (`--task R1`). They need no re-approval only when restoring an approved acceptance criterion within its boundaries. New scope/API/schema/behaviour must invalidate and re-review the normative plan, never bypass the gate through an R item. Two review rounds per plan; then the remaining items go to `HUMAN.md`.                                                                 | Adding `T` tasks: changes normative content and forces re-review.                                                    |
| D10 Reviewer direct fixes               | `verify-implementation` may edit directly only specs, docs, comments, test names, and code changes already pinned by an existing or newly added test that don't alter a public API, state, storage or behaviour. Each direct fix is logged as a `Review` row, and `bun run verify` is re-run.                                                                                                                                                                                                                                                                                           | A 20-line threshold: arbitrary, and lets behaviour changes through unreviewed.                                       |
| D11 Spec sync                           | Moves from the template's last task to `verify-implementation`. _Specification changes_ remains the contract. New plans have no `Sync specification` task.                                                                                                                                                                                                                                                                                                                                                                                                                              | A separate `sync-spec` skill: one more hand-off for the same reviewer.                                               |
| D12 `HUMAN.md` ownership                | Only `create-plan`, `verify-plan` and `verify-implementation` write to `HUMAN.md`. Escalations reach it as decision records: context, options, current default, what it means for a user, recommendation, and the reply wanted. The full record goes in the plan's _Risks_ or log; the `HUMAN.md` line points to it. No new ID scheme: use `E{n}` within the plan slug.                                                                                                                                                                                                                 | `implement` writing to it: the source of today's unstructured items.                                                 |
| D13 Archiving                           | `plans:close close` (and `archive` for legacy plans) moves the plan to `specification/plans/archive/{slug}.md`, keeping the slug with no date. The script rewrites the moved file's relative links and every inbound link in `specification/**/*.md` and `AGENTS.md`, points the index row at `archive/{slug}.md`, and fails if any rewritten link doesn't resolve. `create-plan` skips `archive/` when it looks for existing plans.                                                                                                                                                    | Deleting the file: loses searchable rationale. Date-prefixed names: break links for no gain.                         |
| D14 Migration                           | `plans:review migrate {plan}` adds the metadata block, the three new sections and the log column without touching normative text. Draft or stub plans get `Authors: Unrecorded (pre-gate)` and `Verification: pending`. Ready plans get the same authors plus `Verified by: Human (pre-gate approval)`, `Verification: approved`, a fingerprint, and a review-history row recording the human's earlier approval. Implemented plans are archived without metadata (`plans:close archive`).                                                                                              | Only approvals for the exact unchanged current revision can migrate; amended drafts must receive independent review. |
| D15 Bootstrapping                       | This plan runs under the current lifecycle: the human approves it, and an implementer runs T1–T11. T3 migrates it like any `ready` plan (Human pre-gate approval), so later tasks pass the new gate. T12 is carried out with the new `verify-implementation` skill and closes the plan through `plans:close`, which tests the new closure path on this plan itself.                                                                                                                                                                                                                     | Exempting this plan from the gate: leaves a permanent loophole.                                                      |
| D16 Shared checklist                    | `.agents/skills/create-plan/references/decision-checklist.md` is read by `create-plan` (resolve), `verify-plan` (confirm) and `verify-implementation` (audit). Every item is answered, or marked `N/A — {reason}`.                                                                                                                                                                                                                                                                                                                                                                      | A copy in each skill: the copies drift apart.                                                                        |
| D17 Push-back                           | Specs remain binding on implementers. `create-plan` and `verify-plan` must record any spec rule they believe is wrong as a **Spec challenge** in the plan's _Risks_, with a recommendation and a plain-English user impact, and add a `HUMAN.md` item. Every Lit or accessibility decision cites a source: a `COMPONENTS.md` section, a WCAG 2.2 success criterion, an ARIA Authoring Practices pattern, the Lit docs or a `modern-web-guidance` guide ID. An uncited one is a `MAJOR` finding in `verify-plan`. `lit-architecture`'s "`COMPONENTS.md` is right" line changes to match. | Plan-to-spec conformance only: the human isn't a Lit or accessibility expert and wants to be challenged.             |
| D18 Gate commands                       | `plans:check` (validate_plan), `plans:task` (task_gate), `plans:review` (review_gate), `plans:close` (close_plan), `skills:test` (all four Python test files), `verify` (`bun run check && bun run test:e2e`). Each is a single `bun run` command, which the agent tools already allow.                                                                                                                                                                                                                                                                                                 | Direct `python3` calls: prompt for approval in every tool.                                                           |
| D19 Baseline                            | `AGENTS.md` no longer hard-codes a test count. Each task records `bun run check` on the existing tree before starting and compares after. Dirty trees are supported: record the starting diff, never reset/clean user changes, and audit only the task's own changes.                                                                                                                                                                                                                                                                                                                   | Updating the number: goes stale again (open `HUMAN.md` item).                                                        |

### Interfaces and behaviour

**Plan header** (lines after the H1 and one blank line, in this order):

```md
**Status:** draft | **Updated:** 2026-11-13T18:00:00Z
**Authors:** Claude Code (claude-opus-5-5) | **Created:** 2026-11-13T18:00:00Z
**Verified by:** — | **Verified:** — | **Verification:** pending
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —
```

`Verification` is one of `pending`, `changes-requested` or `approved`. Archived legacy plans need only the status line.

**Status transitions and who makes them** (the scripts enforce each):

| From → to                               | Who                   | Command                                                 | Script checks                                                                                                                                                                                                                |
| --------------------------------------- | --------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (new) → `draft`                         | create-plan           | writes the file                                         | `plans:check` passes                                                                                                                                                                                                         |
| `draft` → `ready-for-review`            | create-plan           | `plans:review submit {plan} --agent --model`            | Metadata valid. _Risks_ contains `- **Blocking:** None`. The submitter is in `Authors` (added if absent).                                                                                                                    |
| `ready-for-review` → `ready`            | verify-plan           | `plans:review approve {plan} --agent --model --summary` | The reviewer's agent name isn't among the authors' (D4). Stores the hash and timestamp; appends a review-history row.                                                                                                        |
| `ready-for-review` → `draft`            | verify-plan           | `plans:review request-changes … --summary`              | Same identity rule. Clears the stamp; appends a history row.                                                                                                                                                                 |
| `ready` or `ready-for-review` → `draft` | create-plan           | `plans:review invalidate {plan} --reason`               | Before any normative edit. Clears the stamp; adds a change-log row.                                                                                                                                                          |
| `ready` → `implemented` + archived      | verify-implementation | `plans:close close {plan} --agent --model --summary`    | `review_gate.check --require-ready` passes. All `T`/`R`/`E` items, acceptance boxes, _Specification changes_ and DoD items are ticked. Identity rule D7. Then stamps, sets the status, appends a log row and archives (D13). |
| legacy `implemented` → archived         | migration             | `plans:close archive {plan}`                            | Status `implemented`; links resolve after the move.                                                                                                                                                                          |

**Task gate** (`plans:task`):

- **Preflight** runs `review_gate.check(require_ready=True)` first. It accepts a `T{n}` or `R{n}` ID. With no ID, it picks the first open `R` item, then the first `T` task whose dependencies are met. It refuses a task with an open `E` item naming it.
- **`--check-complete`** means implementation complete: implementation T/R tasks and their acceptance boxes ticked, no open E. For migrated legacy plans only, exclude the exact final task titled Sync specification and its acceptance boxes: the closing verifier executes it after code review. Exclude no other T task. Specification changes, closure-only DoD boxes and the legacy sync task are checked by plans:close after sync. New plans have no sync task. This avoids requiring spec sync before the verifier can start.

**Implementation log columns:** `| When (UTC) | Task | Agent (model) | Outcome / commands / evidence |`. Values for `Task`: a `T`/`R` ID, `Review`, `Migration` or `—`.

**Plan sections in order:** Goal; Scope; Required reading; Codebase context; Technical decisions; Specification changes; Implementation tasks; Verification and definition of done; Risks and open questions; Escalations; Review fixes; Implementation and verification log; Plan review history; Change log.

**verify-implementation runs in two modes:**

- **Checkpoint:** reviews one task's commit, for tasks marked `needs care` or any the plan names. It adds `Review` log rows and `R` items, and never closes.
- **Closing:** works in order:
    1. Runs plans:review check --require-ready and bun run verify. A stale approval returns to create-plan; a test failure becomes an R fix. Triage open E items before plans:task --check-complete: unresolved decisions go to HUMAN.md and stop, not to an automatic code fix. Run --check-complete after escalation triage; incomplete code returns to implement. No expensive diff audit until these gates pass.
    2. Audits each task's commit (`<plan-slug> Tn:`) or the diff against acceptance criteria, must-not-touch lists, the decision checklist and `COMPONENTS.md`.
    3. Confirms escalation resolutions from preflight against the audited code; new product/scope decisions return to create-plan for invalidate and re-review.
    4. Applies direct fixes (D10).
    5. Syncs the specs, following the procedure that moves from `implementation` § Sync specification task.
    6. Closes and archives.
    7. Removes the plan's `HUMAN.md` items.

## Specification changes

What specification must say once implemented. The closing verifier applies/ticks these items and the legacy T12 sync task; plans:close refuses closure while any remain unticked. The code-completion check intentionally runs before this sync.

- [ ] `specification/plans/README.md` intro and § Lifecycle — the four skills and their roles. The statuses `stub`, `draft`, `ready-for-review`, `ready` and `implemented`, who sets each, and the `bun run plans:*` commands. Implemented plans live in `archive/`, and `plans:check` validates them. Rows for archived plans link to `archive/{slug}.md`.
- [ ] `specification/README.md` § Writing specs (line 21) and § Other directories (`plans/`, `notes/` lines) — spec changes happen in `verify-implementation`'s spec sync or in a no-plan fix. `plans/archive/` holds implemented plans. A plan that uses a note deletes it during the spec sync.
- [ ] `specification/HUMAN.md` § How this file is maintained and § 2 intro — items are written by `create-plan`, `verify-plan` and `verify-implementation`, never by `implement`. An escalation appears as a decision record: context, options, the current default, what it means for a user, a recommendation, and the reply wanted. Plans become `ready` through `verify-plan`, so §2 lists plans waiting for review or with open questions, not approvals. Remove the resolved "Refresh the `AGENTS.md` baseline" item.
- [ ] `specification/notes/README.md` (planners bullet) — a plan lists the note's deletion under _Specification changes_, and `verify-implementation` removes the note when it syncs the specs.

## Implementation tasks

Handoff note: from T2 onwards the implementation skill is called `implement`, after T1 renames it.

### T1 — Rename skills and every reference

- **Depends on:** None
- **Risk:** routine
- **Likely files:**
    - `.agents/skills/planning/` → `.agents/skills/create-plan/`, and `.agents/skills/implementation/` → `.agents/skills/implement/` (filesystem moves, without staging);
    - `.claude/skills/planning`, `.claude/skills/implementation` (replace with links named `create-plan` and `implement`);
    - `package.json`, `AGENTS.md`;
    - `.agents/skills/lit-architecture/SKILL.md`, `.agents/skills/lit-implementer/SKILL.md`;
    - `.agents/skills/implement/scripts/test_task_gate.py`;
    - `specification/plans/README.md` (intro line only).
- **Must not touch:** script logic; `specification/` beyond the one index line; `.agents/skills/modern-web-guidance/`.
- **Implementation:**
    1. Move the two directories with filesystem operations without staging the Git index; remove only generated **pycache** folders, preserving all pre-existing skill edits.
    2. Recreate the `.claude/skills` symlinks as `create-plan -> ../../.agents/skills/create-plan` and `implement -> ../../.agents/skills/implement`.
    3. Set each skill's frontmatter `name:` to its new name.
    4. Update `package.json`: `plans:check` → `.agents/skills/create-plan/scripts/validate_plan.py`; `plans:task` → `.agents/skills/implement/scripts/task_gate.py`.
    5. Add `"skills:test": "python3 .agents/skills/create-plan/scripts/test_validate_plan.py && python3 .agents/skills/implement/scripts/test_task_gate.py"`. Create `test_validate_plan.py` only if a test file for the validator already exists; otherwise list just the task-gate test now, and T2/T4/T5 append theirs.
    6. Replace old skill names only in this task's Likely files, including skill cross-links. Other specification/HUMAN/notes references listed in Codebase context are updated by T12, not T1. No other wording changes.
- **Acceptance criteria:**
    - [ ] `rg -n "skills/planning|skills/implementation|\`planning\` skill|\`implementation\` skill" AGENTS.md .agents .claude package.json specification/plans/README.md` finds nothing, apart from historical text inside other plans.
    - [ ] Both symlinks resolve, and the old ones are gone.
    - [ ] `bun run plans:check`, `bun run plans:task specification/plans/agent-workflow-gates.md --task T1` and `bun run skills:test` pass under renewed bootstrap approval; draft state-navigation is refused.
- **Verification:** `bun run plans:check`; `bun run skills:test`; `bun run check`
- **Progress:** [ ] Not started

### T2 — `review_gate.py` for samata (submit, approve, request changes, invalidate, check, migrate)

- **Depends on:** T1
- **Risk:** needs care — hashing, metadata parsing and identity rules; mistakes here silently weaken the gate
- **Likely files:** `.agents/skills/verify-plan/scripts/review_gate.py` (new), `.agents/skills/verify-plan/scripts/test_review_gate.py` (new), `package.json`
- **Must not touch:** `validate_plan.py`, `task_gate.py`, any plan file, `../web-ml`
- **Implementation:** Port web-ml's `review_gate.py` with these differences:
    1. Metadata is the five lines under _Interfaces_. They come after the H1 and one blank line, so find them by pattern, not by fixed line numbers.
    2. The statuses are D2's.
    3. `Authors` is a comma-separated list of `{agent} ({model})`. The agent-name comparison (D4) runs against every author.
    4. The fingerprint follows D6, including whitespace and table normalisation.
    5. Commands: `fingerprint`, `check [--require-ready]`, `submit --agent --model`, `approve`/`request-changes --agent --model --summary`, `invalidate --reason`, `migrate [--authors '{agent} ({model}), …']` (D14; `--authors` replaces `Unrecorded (pre-gate)` when the authors are known). Transitions exactly as in the table under _Interfaces_.
    6. `migrate` refuses an `implemented` plan (that is `plans:close archive`) and any plan that already has metadata. It adds the missing sections (_Escalations_, _Review fixes_, _Plan review history_ with the header `| Reviewed (UTC) | Agent (model) | Decision | Findings |`) in the order under _Interfaces_. It adds the `Agent (model)` column to the log, with `—` in existing rows. For a `ready` plan it computes the hash after these edits.
    7. All writes refresh `Updated` using UTC from the script itself.

    Add `"plans:review": "python3 .agents/skills/verify-plan/scripts/review_gate.py"` and append the test file to `skills:test`.

- **Acceptance criteria:**
    - [ ] The tests cover:
        - the fingerprint is stable across checkbox ticks, `Progress` changes, log, escalation, review-fix and history edits, and table re-padding;
        - the fingerprint changes when any normative section changes;
        - `submit` refuses unless the Blocking section contains only None; test a contradictory None plus an unresolved question as a refusal;
        - `approve` refuses from `draft` and refuses a reviewer whose agent matches any author;
        - `request-changes` and `invalidate` clear the stamp;
        - `check --require-ready` fails on a hash mismatch, on a missing history row and on a `draft`;
        - `migrate` handles draft and ready fixtures and refuses implemented ones.
    - [ ] `bun run skills:test` passes.
- **Verification:** `bun run skills:test`
- **Progress:** [ ] Not started

### T3 — Migrate active plans

- **Depends on:** T2
- **Risk:** routine
- **Likely files:** `specification/plans/*.md` except `README.md` and `implemented` plans
- **Must not touch:** normative sections of any plan; implemented plans (T6 archives them); `specification/plans/README.md`
- **Implementation:**
    1. Run `bun run plans:review migrate {plan}` on every plan whose status is `stub`, `draft` or `ready`, this plan included (D15). For the seven plans revised in this review, preserve Codex (model unrecorded) as a co-author alongside any known original author or Unrecorded (pre-gate); use --authors, not an invented original identity. For this plan, record the original author plus Codex (model unrecorded), which materially revised the contract; never invent a model identity. Only renewed approval of this exact revision permits the bootstrap stamp.
    2. Run `bun run format` on the changed plans.
    3. Run `bun run plans:review check {plan}` on each ready plan, to confirm that formatting didn't break its hash.
- **Acceptance criteria:**
    - [ ] Every migrated plan has the metadata block and the three new sections.
    - [ ] `git diff` shows no changed line inside a normative section.
    - [ ] `check --require-ready` passes for this renewed-approved bootstrap plan and refuses the still-draft state-navigation-conformance plan.
    - [ ] The old `bun run plans:check` still passes.
- **Verification:** `bun run plans:check`; `bun run plans:review check specification/plans/agent-workflow-gates.md --require-ready`
- **Progress:** [ ] Not started

### T4 — Template, validator and task gate enforce the new format

- **Depends on:** T3
- **Risk:** needs care — every later plan depends on these checks
- **Likely files:** `.agents/skills/create-plan/assets/plan-template.md`, `.agents/skills/create-plan/scripts/validate_plan.py`, `.agents/skills/implement/scripts/task_gate.py`, `.agents/skills/implement/scripts/test_task_gate.py`, `.agents/skills/create-plan/scripts/test_validate_plan.py` (new), `package.json`
- **Must not touch:** `review_gate.py` (import it; don't fork its logic); plan files
- **Implementation:**
    1. **Template:** apply the header, section order, log columns, _Escalations_, _Review fixes_ and _Plan review history_ from _Interfaces_. Remove the final `Sync specification` task. Change the _Specification changes_ intro so `verify-implementation` applies the items. Change the DoD so `bun run verify` replaces the separate parity line.
    2. **`validate_plan.py`:**
        - accept the D2 statuses;
        - require the metadata block on non-archived plans;
        - validate `specification/plans/archive/*.md`, requiring only the status line and `implemented`;
        - look up index rows in `specification/plans/README.md` for archived plans too (link `archive/{slug}.md`);
        - stop requiring a last `Sync specification` task (it isn't enforced today; check the template is consistent).
    3. **`task_gate.py`:**
        - preflight imports `review_gate` (as web-ml's task gate does) and calls `check(require_ready=True)` first;
        - accept `R{n}` IDs;
        - follow the selection and escalation rules and the new `--check-complete` meaning from _Interfaces_.
    4. Extend both test files, and add `test_validate_plan.py` to `skills:test`.
- **Acceptance criteria:**
    - [ ] The tests cover:
        - preflight fails on an unverified, mismatched or draft plan;
        - an open `E1 (T2)` blocks `--task T2` but not `--task T3`;
        - `R1` is chosen before the next `T` task;
        - `--check-complete` passes with unticked _Specification changes_ and fails with an open `R` or `E`;
        - the validator accepts every new status, rejects a non-archived plan without metadata, and accepts a legacy archived plan;
        - --check-complete accepts a legacy plan with only final Sync specification unticked, refuses any incomplete implementation task, and close refuses until sync/spec/DoD boxes are all ticked.
    - [ ] `bun run plans:check` passes on the whole repo.
    - [ ] `bun run plans:task specification/plans/agent-workflow-gates.md` selects T5.
- **Verification:** `bun run skills:test`; `bun run plans:check`; `bun run check`
- **Progress:** [ ] Not started

### T5 — `close_plan.py`: close, archive and link rewriting

- **Depends on:** T4
- **Risk:** needs care — moving files and rewriting links across `specification/`
- **Likely files:** `.agents/skills/verify-implementation/scripts/close_plan.py` (new), `.agents/skills/verify-implementation/scripts/test_close_plan.py` (new), `package.json`
- **Must not touch:** plan files (T6 runs the script on real plans); `review_gate.py` and `task_gate.py` (import them)
- **Implementation:**
    1. **`check {plan}`** lists what blocks closure.
    2. **`close {plan} --agent --model --summary`** follows the transitions table:
        - D7 identity check against log rows;
        - stamps `Implementation verified by` and the time;
        - sets `implemented`, adds a `Review` log row, then archives.
    3. **`archive {plan}`** is for legacy implemented plans: status must already be `implemented`; it archives without stamping.
    4. **Archiving:**
        - create `specification/plans/archive/` if missing, and move the plan with filesystem operations (do not stage the user's Git index);
        - rewrite every relative Markdown link in the moved file (skip `http`, `#` and absolute targets) using `os.path.relpath`;
        - rewrite inbound links in `specification/**/*.md` and `AGENTS.md` that point at the old path;
        - update the index row's link;
        - check that every rewritten link resolves, and roll back the whole operation if one doesn't.
    5. Add `"plans:close": "python3 .agents/skills/verify-implementation/scripts/close_plan.py"` and append the tests to `skills:test`.
- **Acceptance criteria:**
    - [ ] Tests on a temporary repo fixture cover:
        - outbound `../README.md` and sibling `foo.md` links become `../../README.md` and `../foo.md`;
        - an inbound link from `specification/HUMAN.md` is rewritten;
        - dirty pre-existing files and the Git index remain unchanged outside exact link edits, including rollback; no git reset/clean/commit is called;
        - a link that would dangle causes a rollback with the files untouched;
        - `close` refuses when the closer's identity appears in a `T` row, when an `E` or `R` item is open, or when a _Specification changes_ item is unticked.
    - [ ] `bun run skills:test` passes.
- **Verification:** `bun run skills:test`
- **Progress:** [ ] Not started

### T6 — Archive the implemented plans

- **Depends on:** T5
- **Risk:** routine
- **Likely files:** `specification/plans/archive/` (new files), `specification/plans/README.md`, files containing inbound links (`specification/README.md`, `TODO.md`, `HUMAN.md`, `notes/README.md`, other plans)
- **Must not touch:** the content of archived plans other than link targets
- **Implementation:** Run `bun run plans:close archive {plan}` for every plan whose status line says `implemented`, then `bun run format` on the changed files.
- **Acceptance criteria:**
    - [ ] No `implemented` plan remains directly in `specification/plans/`.
    - [ ] `git diff` of the moved files shows only link-target changes.
    - [ ] `rg -n "\]\((\.\./)*(plans/)?(scaffolding-|data-ingestion-and-storage|static-content-pipeline|mockup-visual-fidelity)" specification AGENTS.md` shows only `archive/` targets.
    - [ ] `bun run plans:check` passes.
- **Verification:** `bun run plans:check`
- **Progress:** [ ] Not started

### T7 — `create-plan` skill, shared checklist and push-back rules

- **Depends on:** T4
- **Risk:** needs care — this prose sets how every future plan is written
- **Likely files:** `.agents/skills/create-plan/SKILL.md`, `.agents/skills/create-plan/references/decision-checklist.md` (new), `.agents/skills/lit-architecture/SKILL.md`
- **Must not touch:** scripts; `specification/`
- **Implementation:** Rewrite `create-plan/SKILL.md` so that it:
    - drops human approval;
    - records authors (D5);
    - works through the checklist (D16);
    - raises spec challenges and requires sources (D17);
    - won't submit while a behaviour spec it depends on has unanswered product questions (these stay blocking, with a `HUMAN.md` item);
    - submits with `plans:review submit`;
    - runs `plans:review invalidate` before any normative edit to a `ready` or `ready-for-review` plan;
    - skips `archive/` when searching for existing plans;
    - hands off with: "Use the verify-plan skill, in a different agent, to review specification/plans/{file}.md."

    Remove § "Reviewing an implemented task" (now `verify-implementation`) and the human-approval line in the readiness gate.

    Write `decision-checklist.md` with these sections, each item answered or `N/A — {reason}`:
    - **Storage:** IndexedDB schema version and upgrade path, quota and eviction, private browsing, transaction failure.
    - **Workers:** errors, cancellation, termination, transfer versus copy, progress.
    - **UI states:** empty, blocked, loading, error, populated.
    - **Keyboard and focus:** the named ARIA Authoring Practices pattern or native element; where focus goes after a route change or a dialog closes.
    - **Accessibility:** accessible names, WCAG 2.2 AA with 2.4.11, 2.5.7, 2.5.8 and 3.3.7 checked explicitly, no ID references across shadow roots.
    - **i18n:** strings.
    - **Persistence across reload.**
    - **Visual reference:** mockup or draft.
    - **Lit:** tier, state home, closed API, `bubbles`/`composed` with reason.
    - **Sources cited.**

    In `lit-architecture`, replace "`COMPONENTS.md` is right" with: `COMPONENTS.md` binds implementers, but a planner who thinks a rule is wrong records a spec challenge (D17).

- **Acceptance criteria:**
    - [ ] The skill names every `plans:*` command it uses, and no `python3` call.
    - [ ] The checklist exists and is linked from the skill.
    - [ ] No remaining text says the human approves plans under the new workflow; the limited legacy bootstrap approval is documented separately.
- **Verification:** `rg -n "python3|user has approved|explicitly approves" .agents/skills/create-plan .agents/skills/lit-architecture` finds nothing; `bun run format` on the changed files
- **Progress:** [ ] Not started

### T8 — `verify-plan` skill

- **Depends on:** T2, T7
- **Risk:** needs care — reviewer behaviour
- **Likely files:** `.agents/skills/verify-plan/SKILL.md` (new), `.agents/skills/verify-plan/references/review-checklist.md` (new), `.agents/skills/verify-plan/references/decision-record.md` (new), `.claude/skills/verify-plan` (new symlink)
- **Must not touch:** plan normative sections (the reviewer never edits them); scripts
- **Implementation:** Adapt web-ml's `verify-plan` SKILL and references to these rules:
    - **Input:** `ready-for-review` plans only.
    - **Independence:** D4 against `Authors`.
    - **Checklist:** the shared one from D16, plus web-ml's review checklist.
    - **Severities:** `BLOCKER`, `MAJOR`, `MINOR`, `SUGGESTION`. An open technical choice or an undefined state transition is a `BLOCKER`, given with a proposed resolution the author can accept word for word. An uncited Lit or accessibility decision is `MAJOR` (D17).
    - **Spec challenges** go in the findings and in `HUMAN.md`.
    - **Recording:** the outcome is recorded only with `plans:review approve` or `request-changes`.
    - **Hand-off:** "Use the implement skill to implement T1 …" on approval.
    - **Honesty:** the skill states that identity is self-reported.

    Fix web-ml's stale paths; use `bun run plans:*` everywhere.

- **Acceptance criteria:**
    - [ ] The skill and its references exist, the symlink resolves, and the frontmatter `name` is `verify-plan`.
    - [ ] No `python3` calls and no `skills/planning` paths.
    - [ ] It refuses `draft` input.
- **Verification:** `rg -n "python3|skills/planning|skills/implementation/" .agents/skills/verify-plan` finds nothing
- **Progress:** [ ] Not started

### T9 — Narrow `implement`

- **Depends on:** T4
- **Risk:** routine
- **Likely files:** `.agents/skills/implement/SKILL.md`, `.agents/skills/implement/assets/task-report.md`, `.agents/skills/implement/references/escalation-format.md`, `.agents/skills/lit-implementer/SKILL.md`, `package.json`
- **Must not touch:** scripts other than the `package.json` `verify` entry; `specification/`
- **Implementation:**
    - Add `"verify": "bun run check && bun run test:e2e"`.
    - **Preflight:** `bun run plans:task` (it includes the review gate). Support `R` items.
    - **Gate:** `bun run verify` replaces the separate UI test commands. Keep the token and parity rules for UI tasks via `test:e2e`.
    - **Escalations (D8):** add `E{n}` items, stop when blocking, and add no `HUMAN.md` edits.
    - **Remove:** spec edits, § Sync specification task, § Final closure gate and setting `implemented`. Replace them with: when `--check-complete` passes, hand off with "Use the verify-implementation skill, in a different agent or model, to close specification/plans/{file}.md."
    - **Log rows** include `Agent (model)`, and the baseline follows D19.
    - Keep the draft-mockup rule as it is.
    - In `lit-implementer`, escalate via `E` items.
- **Acceptance criteria:**
    - [ ] The skill contains no instruction to edit `specification/` apart from the plan's own progress, log, escalations and review-fix ticks.
    - [ ] No `HUMAN.md` instruction remains.
    - [ ] `bun run verify` runs.
- **Verification:** `rg -n "HUMAN.md|Sync specification|implemented\`" .agents/skills/implement`shows only lines saying it must not do these things;`bun run verify`
- **Progress:** [ ] Not started

### T10 — `verify-implementation` skill

- **Depends on:** T5, T7
- **Risk:** needs care — final gate and spec authorship
- **Likely files:** `.agents/skills/verify-implementation/SKILL.md` (new), `.agents/skills/verify-implementation/references/remediation-format.md` (new), `.agents/skills/verify-implementation/references/human-decision-record.md` (new), `.claude/skills/verify-implementation` (new symlink)
- **Must not touch:** scripts; plan normative sections (amendments go through `create-plan`)
- **Implementation:**
    - Write the skill for checkpoint and closing modes exactly as under _Interfaces_, with D7, D9, D10, D11 and D12.
    - Move the spec-sync procedure (current `implementation` § Sync specification task, steps 1–6) here unchanged in substance.
    - The remediation format is the D9 `R` line.
    - The decision record has: context, the current default, options with trade-offs, what it means for a user, a recommendation, and the reply wanted (e.g. `ACCEPT A` / `SWITCH TO B`).
    - After two review rounds, move the remaining `R` items to `HUMAN.md` and stop.
- **Acceptance criteria:**
    - [ ] The skill covers gates-first ordering, the commit-by-commit audit, settling escalations, the direct-fix limits, the retry cap, spec sync, `plans:close close` and removing `HUMAN.md` items.
    - [ ] The symlink resolves.
    - [ ] No `python3` calls.
- **Verification:** `rg -n "python3" .agents/skills/verify-implementation/SKILL.md` finds nothing; read-through against D7–D13
- **Progress:** [ ] Not started

### T11 — `AGENTS.md` roles, model routing and rules

- **Depends on:** T7, T8, T9, T10
- **Risk:** routine
- **Likely files:** `AGENTS.md`
- **Must not touch:** § Commands shell rules (except adding the new scripts); other files
- **Implementation:**
    1. **Roles:** the four skills, with one line each.
    2. **Model routing** table:
        - create-plan: high effort;
        - verify-plan: high effort, a different agent from the authors;
        - implement: fast for `routine` tasks, stronger for `needs care`;
        - verify-implementation: high effort, not an implementer.
    3. **Commands:** add `plans:review`, `plans:close`, `skills:test` and `verify`.
    4. **Human queue rule:** `implement` never writes `HUMAN.md`.
    5. **Specs stay current:** `verify-implementation` closes a plan only after its spec sync.
    6. **Baseline:** replace the 52-test line with D19.
- **Acceptance criteria:**
    - [ ] `AGENTS.md` names only the four workflow skills, plus the Lit and web-guidance skills.
    - [ ] No hard-coded test count.
- **Verification:** `rg -n "52 tests|planning skill|implementation skill" AGENTS.md` finds nothing; `bun run format AGENTS.md`
- **Progress:** [ ] Not started

### T12 — Sync specification

- **Depends on:** T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11
- **Risk:** needs care — specs must describe what was built, not what was planned
- **Likely files:** `specification/plans/README.md`, `specification/README.md`, `specification/HUMAN.md`, `specification/notes/README.md`
- **Must not touch:** Product code, tests and `specification/mockups/`
- **Implementation:**
    - Carry this out with the new `verify-implementation` skill (D15), by an agent and model that implemented none of T1–T11.
    - Apply every item under _Specification changes_, following "Writing specs" in `specification/README.md`. Where the log records a deviation from the plan, document the deviation, not the plan.
    - Close the plan with `bun run plans:close close specification/plans/agent-workflow-gates.md --agent … --model … --summary …`, which archives it.
- **Acceptance criteria:**
    - [ ] Every item under _Specification changes_ is applied and ticked.
    - [ ] No changed spec contradicts the code or another spec, or mentions this plan, its tasks or the history of the change.
    - [ ] `bun run plans:check` reports no spec index mismatch.
    - [ ] The plan is in `specification/plans/archive/` with `Implementation verified by` set.
- **Verification:** `bun run plans:check`; `bun run skills:test`; `bun run check`; `git diff specification/` reviewed against _Specification changes_
- **Progress:** [ ] Not started

## Verification and definition of done

- [ ] All task acceptance criteria met.
- [ ] `bun run check` introduces no new failures compared with the baseline recorded above.
- [ ] `bun run skills:test` and `bun run plans:check` pass.
- [ ] A dry run on a scratch copy of one draft plan goes through every transition: `submit` → `request-changes` → `submit` → `approve` → `plans:task` → `close`. Identity refusals are seen at `approve` and `close`.
- [ ] Every item under _Specification changes_ is ticked, and the specs describe the workflow as built.
- [ ] No unintended changes outside the tasks' likely files.

## Risks and open questions

- **Blocking:** None
- **Non-blocking:**
    - **Identity is self-reported.** The gates prevent acting on a stale or missing approval, not a dishonest one. The skills say so; protected branches or CI would be needed for real enforcement.
    - **Same model, different product.** Antigravity can run Claude models, so D4's agent-name rule doesn't guarantee a different model. Accepted, per the user's decision to follow web-ml.
    - **Link rewriting** may miss link forms other than Markdown inline links (reference-style links, raw paths in backticks). Backticked paths aren't links and are left alone. T5's rollback-on-dangling check covers inline links.
    - **Bootstrapping:** T3 stamps this plan as Human (pre-gate approval) only after renewed explicit approval of this revision. Do not stamp state-navigation-conformance or other revised drafts from stale approvals. All other drafts need independent review once the new skills exist.
    - **Prettier and the fingerprint:** D6's normalisation is designed for Prettier's table re-padding; T3 confirms it on real plans.
    - **Follow-ups (not in this plan):**
        - add the cross-shadow-root ID rule to `COMPONENTS.md` §7;
        - a Playwright helper that fails a test on any console or worker error;
        - a `visual-design.md` §1.1 rule that `implement` updates a draft when the built markup differs;
        - a `decide` skill for working through `HUMAN.md`;
        - a pre-commit hook running `bun run check` and `plans:check`.

## Implementation and verification log

| When (UTC) | Task | Outcome / commands / evidence |
| ---------- | ---- | ----------------------------- |
| —          | —    | Not started                   |

## Change log

| When (UTC)           | Change                                                                                              | Reason                                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 2026-11-13T18:32:35Z | Initial draft                                                                                       | User request: tighten plan approval (verify-plan), narrow implement, add verify-implementation (2026-11-13). |
| 2026-11-13T18:37:17Z | Status → ready                                                                                      | User approved the plan in chat (2026-11-13).                                                                 |
| 2026-11-13T18:47:40Z | Returned to draft; corrected bootstrap, legacy-sync gate, escalation triage and dirty-tree handling | Review found circular closure and stale-approval paths; earlier approval remains history only.               |
