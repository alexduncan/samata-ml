# Implementation plans

Each substantive change has one plan here. The `planning` skill writes plans and the `implementation` skill executes them; the rules live in those skills, not here. Only files that follow the planning template belong in this directory. Specs live one level up ([index](../README.md)); mockups are in `../mockups/`.

| Plan                                                                                   | Status      | Description                                                                                                                   |
| -------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| [scaffolding-foundation.md](scaffolding-foundation.md)                                 | implemented | Foundation setup: dependencies cleanup, asset URL fixes, retirement of legacy Mithril views, and test harness setup.          |
| [scaffolding-styles-and-primitives.md](scaffolding-styles-and-primitives.md)           | implemented | Design tokens, button, chiclet, card, and dialog style primitives.                                                            |
| [scaffolding-state-and-storage.md](scaffolding-state-and-storage.md)                   | implemented | Nanostores application state, persistence persister, and startup reconciler.                                                  |
| [scaffolding-router-and-navigation.md](scaffolding-router-and-navigation.md)           | implemented | Vanilla TS router, history management, and document scroll memory.                                                            |
| [scaffolding-app-shell.md](scaffolding-app-shell.md)                                   | implemented | App shell, sidebar navigation, welcome and content modals, and main view outlet.                                              |
| [mockup-visual-fidelity.md](mockup-visual-fidelity.md)                                 | implemented | Make the mockups normative for appearance: visual spec, agent instruction changes, token guard, parity and WCAG tests.        |
| [data-ingestion-and-storage.md](data-ingestion-and-storage.md)                         | draft       | Storage worker: whole-file type inference, typed IndexedDB rows, exact statistics; build-time sample-dataset catalogue.       |
| [state-navigation-conformance.md](state-navigation-conformance.md)                     | draft       | Make stores, persister, router, scroll memory and sidebar match the state and navigation specs (Known gaps 14, 15).           |
| [step-1-load-data-and-preview.md](step-1-load-data-and-preview.md)                     | stub        | Sample dataset cards, Datasheet modal, Upload Custom Dataset modal, virtual table preview, and column inspector.              |
| [step-2-set-target.md](step-2-set-target.md)                                           | stub        | Target variable selection table, type tags, empty-state notifications, and model reset warning.                               |
| [step-3-train-models-overview-and-setup.md](step-3-train-models-overview-and-setup.md) | stub        | Models hub table, empty-state guard, and 6-step model builder wizard with Step 1 (Choose Model) and Step 2 (Select Features). |

## Lifecycle

- **stub** — placeholder outlining scope and notes; needs to be turned into a full draft.
- **draft** — proposed or materially revised; not authorised for implementation.
- **ready** — the user has approved it and no blocking questions remain; implementation may begin.
- **implemented** — all acceptance criteria are met, the verification evidence is recorded, and the `Sync specification` task has updated every spec listed under _Specification changes_. Implemented plans stay here as the record of why each decision was taken; the specs describe the result.

Run `bun run plans:check` to validate every plan, this index and the spec index's status column. Plans written before _Specification changes_ existed get a warning, not a failure, until they are reconciled.
