# Adopt workflow records in Samata ML

**Status:** ready-for-review | **Updated:** 2026-11-25T11:41:14Z
**Authors:** Codex (gpt-6.2-sol) | **Created:** 2026-11-25T11:26:57Z
**Verified by:** — | **Verified:** — | **Verification:** pending
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour:** Samata ML stores deferred features in `specification/FUTURE.md` and tracks decisions and actions in `specification/HUMAN.md` and `specification/TODO.md`. Its Bun scripts expose the shared lifecycle gates and a baseline runner. The required `check` runs typechecking and the raw Bun suite. Shared workflow records and recorded task verification are unregistered.

**Target behaviour:** Samata ML uses one canonical backlog and a reviewed, reproducible inventory of its existing records. Its established checks run through the shared verification interface. It can issue version 2 upstream requests after the receiving library activates that format.

**Why:** Supply the Samata ML migration evidence required by agent-workflow’s approved workflow-records plan, task T9.

## Scope

**In scope**

- Register the shared CLI and local verification commands in Bun, the agent guide and the two existing copies of the command hook.
- Classify records owned by Samata ML, migrate agreed deferrals, retain actionable human decisions, and preserve historical evidence.
- Reconcile the resurrected mockup draft with the audited closure and return independently checkable migration evidence to the parent task.

**Out of scope**

- Product changes, application specs beyond workflow-record navigation, runtime dependencies, tests, mockups, the human’s notes and other repositories’ records.
- Changes to shared tools, installed global skills, host permissions or receiver format activation.

**Constraints and invariants**

- Use an isolated Samata ML session on the local plan branch for implementation. Staged validation uses the tested parent candidate `31530fcb41fae255a9d26d688f032f9fcf8de3ef` in a worktree-local installation or an integrated release containing the same tested workflow changes. Record the exact tool commit and construct wrapper paths under one skill root. Preserve existing command spellings.
- Preserve archived plans, verified plan content and fingerprints, original human note bodies and product source comments. The maintainer’s primary `specification/notes/ui-fixes.md` has unrelated changes. The inventory uses committed evidence, with the maintainer as owner of any worktree-only material.
- Samata ML is a producer. Its links to library requests are provenance. The receiver owns request files, receipts, decisions and activation. Keep legacy-format submission until the receiver is demonstrably ready.

## Required reading

- `AGENTS.md` §§ Verification Commands, Git workflow and Rules, and `specification/README.md` §§ Backlog and Known gaps.
- `specification/FUTURE.md`, `specification/TODO.md`, `specification/HUMAN.md`, and `specification/notes/README.md` for existing queue ownership and navigation.
- Parent agent-workflow plan `specification/plans/workflow-records-and-request-archiving.md` at `31530fcb41fae255a9d26d688f032f9fcf8de3ef`, T9 and Interfaces and behaviour §§ 1, 4–5 and 7–8, including the promotion, request reconciliation and migration rules.
- Parent agent-workflow `docs/consumer-adoption.md` and `templates/samata-ml-AGENTS.md`, at the same revision, for local installation, baseline composition and request cutover.

## Codebase context

- **Relevant specifications:** `specification/README.md` § Backlog links the human queue, TODO register and FUTURE register. `specification/notes/README.md` describes the human-owned inbox. `specification/ARCHITECTURE.md` § Future Improvements and the spec index § Known gaps are explicit supplemental inventory sources.
- **Relevant implementation:** `package.json` scripts define `check`, `plans:baseline` and the existing lifecycle and Git wrappers. `.github/workflows/ci.yml` runs `check` after installing project dependencies. Its runner has no agent-workflow installation. `.agents/hooks.json` configures Antigravity’s relative command-hook path. The same hook is tracked at `.agents/scripts/whitelist-check.ts` and `.agents/.agents/scripts/whitelist-check.ts`. Samata ML has neither a tracked request inbox nor a backlog at base `196875fa983b17b56d90459cb7c75368654a13bb`.
- **Tests and commands:** Scoped `bun run plans:check` and `bun run format:check <files>` cover the changed documentation. At the base revision, whole-repository `bun run plans:check` reports the unindexed `specification/plans/mockup-review-improvements.md` alongside its already indexed audited archive. The draft reappeared via merge `3e68498` after audited closure `425f904`. `bun run check` was attempted with the existing dependency install and stopped on missing `@federicocarboni/saxe` and `svgo` plus a consequent implicit-any diagnostic. A complete frozen dependency install and a fresh run in the implementation worktree are required for test evidence.
- **Web guidance:** None. Browser APIs and rendering are outside the workflow scope.
- **Visual reference:** None.
- **Domain skills:** None.
- **Assumptions requiring verification:** Local tracked request bodies number zero at the base revision. Recheck at the pinned migration revision. Recheck for a newly added release or work item with the same canonical backlog ownership before moving anything.

## Technical decisions

| Decision          | Chosen approach and rationale                                                                                                                                                           | Rejected alternative / trade-off                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Verification      | Add local `verify` as `bun run typecheck && bun run plans:baseline`, using the template’s new-verify composition. Preserve standalone `check` for CI and developers.                    | Making `check` use the installed skill would add an agent-workflow dependency to CI.             |
| Deferred work     | Make `specification/plans/BACKLOG.md` canonical. Retain `FUTURE.md` as navigation with existing section anchors and links.                                                              | A second deferred queue would require keeping two copies in sync.                                |
| Mockup draft      | Compare the orphan draft with the audited archive and identify any genuinely open obligations before moving it outside plan discovery. Keep its recorded history and pinned provenance. | Listing the old draft as live would give the delivered mockup-revision work duplicate ownership. |
| Upstream requests | Dry-run local reconciliation and record its actual result. Keep Samata ML’s receiver-dependent producer transition tied to the recorded receiver readiness.                             | Local intake markers would assert receiver ownership Samata ML does not have.                    |

### Interfaces and behaviour

1. `plans:records` runs the shared records CLI. Register and document the shared lifecycle options that apply to this consumer, including review submit with an initial index description, review handoff checks, task escalation and verification evidence. Keep the existing wrappers available and add `/.agent-workflow/` before any shared record writer runs. Use `AGENT_WORKFLOW_SKILLS` as the optional worktree-local selector with the current installed directory as the default for shared lifecycle wrappers.
    - Both local command hooks allow bare `bun run verify`. The complete new `bun run plans:records` allow-list is `inventory`, `backlog-list [--all]`, `backlog-add --key <kebab-key> --summary <text> --source <source> [--source <source> ...]`, `backlog-promote --key <kebab-key> --plan specification/plans/<slug>.md`, and bare `reconcile` for preview. Document these forms and their owning lifecycle skills in `AGENTS.md`.
    - Match the whole invocation, require the listed positional and flag structure, and keep existing shell-operator handling. A documented value with spaces can use a quoted argument. Any extra argument on `verify`, unlisted records subcommand or unsupported option must miss the new allow rules. Receiver-only `request-decide`, `request-attest` and `reconcile --apply` remain under review.
2. The version 1 backlog uses the shared writer and parser. Use stable kebab-case keys, one row per deferred obligation, and repeated sources for corroborating records. Use existing section anchors or revision-qualified paths with line references for relocated or historical sources. An indexed active plan that claims an existing backlog item uses the shared promotion operation. Published request residuals retain their namespaced source key.
3. The ledger at `specification/workflow-records-migration.md` names the consumer input revision and exact shared tool commit. Cover each raw inventory result (`path:line` at the pinned revision) and each manual addition exactly once. It may group explicit locations with the same decision and evidence. Record one classification per location: delivered with evidence, actively planned with owner, human action with owner and actionable question, duplicate with canonical owner, deferred with backlog key, or irrelevant with reason. Classify overlapping locations and logical work separately so duplicate references do not create backlog rows.
4. Keep genuine decisions in `HUMAN.md` and their open questions in `TODO.md`. Split mixed items by keeping the decision and linking to its deferred backlog key from the human entry, then include the human entry’s stable source or ledger reference on the backlog item. Treat the FUTURE entries as evidence to classify. Preserve conditions on speculative ideas and respect existing active plan ownership. Preserve the note inbox and the human’s uncommitted work.
5. The orphan mockup draft remains byte-identical at `specification/history/mockup-review-improvements-draft.md` if the audit finds no unique live plan scope. Classify any remaining item via its existing owner, HUMAN, or the backlog as the evidence warrants before relocating the draft. The ledger pins its original path, blob and reviewed closure, and records any relative or incoming links that need a current destination. Preserve the original blob as evidence and put current destinations in the ledger if the original draft’s relative links become historical. If unique plan scope still lacks an agreed owner or the duplicate cannot be retired safely, leave the files alone and escalate with the evidence.
6. Inventory scans committed `HEAD` blobs. After the migration commit is landed, the independent auditor runs it from an isolated clean checkout of that exact Samata ML commit, using the same recorded tool commit, before recording closure. Correlate carried-forward matches with their input-ledger locations. Classify each new location, including matches in the newly committed ledger. A ledger reference to classified work is a duplicate when it resolves to that canonical record. A bookkeeping match with no work item is irrelevant with a reason. Treat a substantive uncovered item according to its actual class and resolve any migration obligation before closure.
7. The independent auditor records a cumulative receipt in the implementation and verification log in a later commit. Include the Samata input and migrated commits, exact shared tool commit, command results, counts by class including zeros, new locations with their dispositions and evidence, remaining human actions, and exceptions with owners. Count carried-forward matches once and report the post-commit scan’s coverage separately from the combined classifications. Include local request and residual totals. Pin the receipt to the already migrated commit so adding the receipt does not change the inventory it verifies. Send the receipt and closure commit to the parent T9 audit.

## Specification changes

- [ ] `specification/README.md` § Backlog and `specification/plans/README.md` § Lifecycle describe the canonical backlog and the human and TODO queues. Keep the backlog separate from the plan status table.
- [ ] `specification/FUTURE.md` links current work to its canonical backlog, active plan or human decision while retaining public section anchors.
- [ ] `specification/HUMAN.md` and `specification/TODO.md` preserve live decisions, identify their owners and link overlapping deferred work where warranted.
- [ ] `specification/workflow-records-migration.md` holds the pinned migration evidence and documents the mockup draft disposition.

## Implementation tasks

### T1 — Register shared commands and preserve the local verification chain

- **Depends on:** None
- **Risk:** needs care — stale dependency installs and divergent hooks can hide adoption failures
- **Likely files:** `AGENTS.md`, `package.json`, `.gitignore`, `.agents/scripts/whitelist-check.ts`, `.agents/.agents/scripts/whitelist-check.ts`
- **Must not touch:** `bun.lock`, `src/`, `tests/`, `scripts/`, `specification/notes/`, `specification/mockups/`, `specification/plans/archive/`, `.claude/settings.json`
- **Implementation:** Add the wrappers, verification and ignore rules from Interfaces and behaviour 1. Use the optional skill-root selector consistently for commands that participate in the candidate workflow. Keep the hook copies aligned and extend only their existing allow-list for the new registered commands, including equally scoped format and verification forms where already supported. Continue to check shell operators and keep existing Git restrictions. Use a frozen dependency install matching the checkout before running the application check. Record the old plan-check failure as the baseline until T2 handles it.
- **Acceptance criteria:**
    - [ ] `verify` runs the existing typecheck and invokes the baseline wrapper exactly once per run, using an empty allowance. CI’s standalone `check` retains its existing typecheck and raw suite.
    - [ ] The registered records inventory and reconcile dry-run dispatch through the pinned skills from the repository root. The plans/task and review help expose the documented options.
    - [ ] Both hook copies allow every documented producer form and bare `bun run verify`. Both request review for `bun run plans:records request-decide specification/requests/2026-11-25-adoption-fixture.md --status declined --reason "Fixture decision"`, `bun run plans:records request-attest specification/requests/2026-11-25-adoption-fixture.md`, `bun run plans:records reconcile --apply`, `bun run plans:records inventory --all` and `bun run verify --help`. Existing handling of chained commands, unregistered commands and blanket staging remains in effect.
- **Verification:** Existing `bun run check`, `bun run plans:check specification/plans/workflow-records-adoption.md`, `bun run format:check <files>`. After registration, run `bun run verify`, `bun run plans:records inventory` and `bun run plans:records reconcile`. Submit the listed positive and negative command strings, including a quoted summary, repeated sources and a chained command, as `CommandLine` values to both existing hooks. Compare the JSON decisions without executing the represented commands.
- **Progress:** [ ] Not started

### T2 — Classify and migrate Samata ML’s workflow records

- **Depends on:** T1
- **Risk:** needs care — historical sources, human decisions and existing plan stamps must survive
- **Likely files:** `specification/README.md`, `specification/FUTURE.md`, `specification/HUMAN.md`, `specification/TODO.md`, `specification/plans/README.md`, `specification/plans/BACKLOG.md`, `specification/workflow-records-migration.md`, `specification/plans/mockup-review-improvements.md`, `specification/history/mockup-review-improvements-draft.md`
- **Must not touch:** `specification/requests/`, `specification/notes/`, `specification/mockups/`, `specification/plans/archive/`, `src/`, `tests/`, `scripts/`
- **Implementation:** Run the input inventory in the owning worktree with clean, pinned HEAD, then cover the named documentation, notes and limitation sections. Apply Interfaces and behaviour 2–5. Inspect the archived mockup closure and preserve its stamps and bytes. Review the local reconciliation dry run. Record zero local bodies and residuals if confirmed. If there is a new owned inbound request, stop and ask its owner to resolve scope before any request writes. Land the migration and hand its exact commit and tool commit to the independent auditor for the separate post-commit check in Interfaces and behaviour 6–7.
- **Acceptance criteria:**
    - [ ] The checked-in ledger covers the pinned input inventory and supplemental sources with observed class totals, including zeros.
    - [ ] Exactly one version 1 backlog exists. Equivalent deferrals share one entry, confirmed human actions retain useful links, and the sampled cross-links resolve.
    - [ ] The audited mockup archive and signed plan content retain their original blobs or fingerprints. Whole-repository plan validation passes after the orphan draft’s documented disposition.
    - [ ] The local request count and dry-run result are backed by Git tree evidence. No upstream or uncommitted human record is staged.
- **Verification:** `bun run plans:check`, `bun run verify`, `bun run format:check <files>` on edited documents excluding the byte-identical historical draft, `bun run plans:records inventory` for the pinned input, `bun run plans:records backlog-list --all`, `bun run plans:records reconcile`. Compare source coverage, retained anchors, archive blobs and verified fingerprints against the pinned input revision. Verify scoped task changes with the registered task gate before staging. The independent auditor repeats `bun run plans:records inventory` after landing with HEAD at the migrated commit.
- **Progress:** [ ] Not started

## Verification and definition of done

- [ ] All task acceptance criteria and specification changes are verified.
- [ ] The registered verification and repository-wide plan checks pass inside the implementation worktree. The format check covers changed authored documents.
- [ ] The independent auditor’s post-commit inventory covers the migrated tree, including matches in the migration ledger. Every match has a disposition. Repeated source references create no duplicate backlog items. The cumulative receipt covers both inventories and reaches the parent T9 audit.
- [ ] Changed paths match the task scopes. Browser and WCAG checks are inapplicable because the changes are limited to workflow commands and records.

## Risks and open questions

- **Blocking:** None
- **Non-blocking:** The inherited orphan draft and incomplete dependency install are implementation preflight items with explicit local resolution above. If classifying a record would require a product decision, route the question to its human owner and report any unresolved migration obligation to T9. The producer continues legacy request intake until upstream activation.

## Escalations

None.

## Review fixes

None.

## Implementation and verification log

| When (UTC) | Task | Agent (model) | Outcome / commands / evidence |
| ---------- | ---- | ------------- | ----------------------------- |
| —          | —    | —             | Not started                   |

## Plan review history

| Reviewed (UTC)       | Agent (model)         | Decision          | Findings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------- | --------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-25T11:37:22Z | Codex (gpt-6.2-astra) | changes-requested | MAJOR T2: records_inventory.py reads committed HEAD blobs and includes specification/workflow-records-migration.md. A second run before the task commit repeats the input scan. Assign post-commit reinventory at the migrated SHA, classify new matches including ledger references, and place the resulting SHA, totals and exceptions in a later audit receipt. MAJOR T1: both whitelist hooks accept arbitrary arguments on existing wrapper patterns. Specify the supported producer records subcommands and bare verify, and exercise a receiver-only subcommand and verify with arguments as negative cases so adoption cannot silently grant them. |

## Change log

| When (UTC)           | Change          | Reason                                                                                                                                                  |
| -------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-25T11:26:57Z | Initial draft   | Owning-repository adoption for agent-workflow workflow records task T9.                                                                                 |
| 2026-11-25T11:39:20Z | Review revision | Require reinventory of the committed migration and a cumulative audit receipt. Bound the producer hook commands and add negative checks in both copies. |
