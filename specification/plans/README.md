# Implementation plans

Each substantive change has one plan here. The `planning` skill writes plans and the `implementation` skill executes them; the rules live in those skills, not here. Only files that follow the planning template belong in this directory. Specs live one level up ([index](../README.md)); mockups are in `../mockups/`.

| Plan                                                                         | Status      | Description                                                                                                          |
| ---------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------- |
| [scaffolding-foundation.md](scaffolding-foundation.md)                       | implemented | Foundation setup: dependencies cleanup, asset URL fixes, retirement of legacy Mithril views, and test harness setup. |
| [scaffolding-styles-and-primitives.md](scaffolding-styles-and-primitives.md) | implemented | Design tokens, button, chiclet, card, and dialog style primitives.                                                   |
| [scaffolding-state-and-storage.md](scaffolding-state-and-storage.md)         | implemented | Nanostores application state, persistence persister, and startup reconciler.                                         |
| [scaffolding-router-and-navigation.md](scaffolding-router-and-navigation.md) | implemented | Vanilla TS router, history management, and document scroll memory.                                                   |
| [scaffolding-app-shell.md](scaffolding-app-shell.md)                         | implemented | App shell, sidebar navigation, welcome and content modals, and main view outlet.                                     |

## Lifecycle

- **draft** — proposed or materially revised; not authorised for implementation.
- **ready** — the user has approved it and no blocking questions remain; implementation may begin.
- **implemented** — all acceptance criteria are met and the verification evidence is recorded.

Run `bun run plans:check` to validate every plan and this index.
