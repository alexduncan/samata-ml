# Implementation plans

Each substantive change has one plan here. The `planning` skill writes plans and the `implementation` skill executes them; the rules live in those skills, not here. Only files that follow the planning template belong in this directory; rough notes go in [`../notes/`](../notes/README.md). Specs live one level up ([index](../README.md)); mockups are in `../mockups/`.

| Plan                                                                                   | Status      | Description                                                                                                                                                                     |
| -------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [scaffolding-foundation.md](scaffolding-foundation.md)                                 | implemented | Foundation setup: dependencies cleanup, asset URL fixes, retirement of legacy Mithril views, and test harness setup.                                                            |
| [scaffolding-styles-and-primitives.md](scaffolding-styles-and-primitives.md)           | implemented | Design tokens, button, chiclet, card, and dialog style primitives.                                                                                                              |
| [scaffolding-state-and-storage.md](scaffolding-state-and-storage.md)                   | implemented | Nanostores application state, persistence persister, and startup reconciler.                                                                                                    |
| [scaffolding-router-and-navigation.md](scaffolding-router-and-navigation.md)           | implemented | Vanilla TS router, history management, and document scroll memory.                                                                                                              |
| [scaffolding-app-shell.md](scaffolding-app-shell.md)                                   | implemented | App shell, sidebar navigation, welcome and content modals, and main view outlet.                                                                                                |
| [mockup-visual-fidelity.md](mockup-visual-fidelity.md)                                 | implemented | Make the mockups normative for appearance: visual spec, agent instruction changes, token guard, parity and WCAG tests.                                                          |
| [data-ingestion-and-storage.md](data-ingestion-and-storage.md)                         | implemented | Storage worker: whole-file type inference, typed IndexedDB rows, exact statistics; build-time sample-dataset catalogue.                                                         |
| [state-navigation-conformance.md](state-navigation-conformance.md)                     | draft       | Reviewed state/navigation contract, including composed-path shadow links and existing datetime/sampleId support (Known gaps 14, 15, 18).                                        |
| [step-1-load-data-and-preview.md](step-1-load-data-and-preview.md)                     | draft       | Step 1 dataset selection, local CSV upload, preview and column inspector; depends on storage and component contracts.                                                           |
| [step-2-set-target.md](step-2-set-target.md)                                           | draft       | Target variable selection table, type tags, empty-state notifications, and model reset warning.                                                                                 |
| [step-3-train-models-overview-and-setup.md](step-3-train-models-overview-and-setup.md) | draft       | Models hub table, empty-state guard, and 6-step model builder wizard with Step 1 (Choose Model) and Step 2 (Select Features).                                                   |
| [virtual-table-component.md](virtual-table-component.md)                               | draft       | Resolve the reusable virtual table's contract, then implement and verify its accessible bounded row rendering.                                                                  |
| [static-content-pipeline.md](static-content-pipeline.md)                               | implemented | Markdown content in `content/`, compiled per locale (base `en`) to safe HTML fragments and per-domain `index.json` in the build output; content loader; reserved-route pages.   |
| [agent-workflow-gates.md](agent-workflow-gates.md)                                     | draft       | Reviewed four-skill workflow; bootstrap approval, legacy spec-sync closure and escalation ordering corrected.                                                                   |
| [reference-dataset-regression-tests.md](reference-dataset-regression-tests.md)         | draft       | Golden-file regression tests over the Iris and Penguins reference datasets at every data layer, cross-browser conformance, shared Playwright helpers and the journey-test rule. |

## Lifecycle

- **stub** — placeholder outlining scope and notes; needs to be turned into a full draft.
- **draft** — proposed or materially revised; not authorised for implementation.
- **ready** — the user has approved it and no blocking questions remain; implementation may begin.
- **implemented** — all acceptance criteria are met, the verification evidence is recorded, and the `Sync specification` task has updated every spec listed under _Specification changes_. Implemented plans stay here as the record of why each decision was taken; the specs describe the result.

Run `bun run plans:check` to validate every plan, this index and the spec index's status column. Plans written before _Specification changes_ existed get a warning, not a failure, until they are reconciled.

## Review preparation — 2026-11-13

The seven formerly ready/draft plans have been reviewed against current code, human comments and mockups. The current validator does not accept `ready-for-review`; that transition is implemented by agent-workflow-gates, not by a planning-only documentation change. Keep valid draft metadata until formal submission is available. Substantive amendments reset prior approval; previously answered product questions remain accepted.

| Plan                                   | Review handoff                                                                                                              |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| agent-workflow-gates                   | Renew bootstrap approval under the current workflow; corrected closure/escalation/migration contracts are ready for review. |
| state-navigation-conformance           | Review composed-path shadow-link amendment; no unanswered product questions.                                                |
| virtual-table-component                | No product blockers; closed textual-cell/segmented-scroll contract, unstyled draft supplied.                                |
| reference-dataset-regression-tests     | No product blockers; implemented API seams and startup-database assumptions reconciled.                                     |
| step-1-load-data-and-preview           | Review-complete draft; accepted load/panel/datasheet defaults, no product blockers.                                         |
| step-2-set-target                      | Review-complete draft; accepted target rules/notes/notification, no product blockers.                                       |
| step-3-train-models-overview-and-setup | Review-complete draft; accepted setup defaults and native text-entry fallback, no product blockers.                         |

The user accepted the grouped Step 1–3 defaults and missing-art fallback, and chose review-complete drafts using current tooling. All seven plans now have no unanswered product blockers. Remaining review/styling work is in [HUMAN.md](../HUMAN.md#2-step-13-decisions). These drafts are not implementation authorisation. The three UI plans now create/extend the same two reference journeys in dependency order.

Review evidence: `bun run check` passed with 144 tests across 22 files, 0 failures and 0 type errors; `bun run plans:check` passed for every plan and the spec index; `bun run build` passed using all 12 cached sample profiles; `git diff --check` reported no whitespace errors. A follow-up `ls` checked all 72 extracted required-reading file paths, including the accepted text-entry draft. Ten existing workflow mockups and the new model text-entry draft were opened and visually inspected using `bun run serve:scaffold --port 3333`. New product browser acceptance tests were not run because this task changes planning documents and structural drafts only. All changed Markdown/HTML files receive `bun run format` as the final editing step, followed by validation.
