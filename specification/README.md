# Specification Index

Authoritative product and engineering specifications for `samata-ml`. **Planning agents** use this index to pick the specs a change needs and read only those. **Implementation agents** read only the files a plan lists under _Required reading_.

If code and a spec disagree, do not silently pick one. Check [Known gaps](#known-gaps). If the conflict isn't listed there, record it in the plan's _Risks and open questions_ section.

## Status

Each spec has a `**Status:**` line under its title:

- **implemented** — describes the code as it is.
- **partial** — some rules apply now; the rest is target design. The status line says which.
- **target** — agreed design that the code does not follow yet. A plan must say how to get there.
- **draft** — not yet agreed; has open questions. Do not plan against it without the user answering them.
- **reference** / **stub** — context only / not yet written.

## Specs

| Spec                                                                 | Status    | Read when                                                                                            |
| -------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------- |
| [VISION.md](VISION.md)                                               | reference | Planning a new feature (product intent, educational and ethical goals)                               |
| [workflow-steps.md](workflow-steps.md)                               | target    | Anything a user sees in the four workflow steps. **Wins over other specs on user-facing behaviour.** |
| [ARCHITECTURE.md](ARCHITECTURE.md)                                   | partial   | New directories or modules, routing, build, delivery, caching, Bun tooling                           |
| [COMPONENTS.md](COMPONENTS.md)                                       | target    | Any Lit component, style primitive, store binding, a11y or i18n in UI                                |
| [app-state-and-navigation.md](app-state-and-navigation.md)           | draft     | Router, URL/history, step behaviour, scroll memory, model lifecycle                                  |
| [state-and-storage.md](state-and-storage.md)                         | draft     | Nanostores, persisted schema, `localStorage`, IndexedDB, multi-tab                                   |
| [data-ingestion.md](data-ingestion.md)                               | target    | CSV upload/parsing, column statistics, IndexedDB dataset storage                                     |
| [preview-dataset.md](preview-dataset.md)                             | target    | Dataset preview table after upload                                                                   |
| [machine-learning-orchestrator.md](machine-learning-orchestrator.md) | stub      | Calling the `web-ml` library or training workers                                                     |
| [content-and-i18n.md](content-and-i18n.md)                           | target    | Markdown content pipeline, localisation                                                              |
| [testing.md](testing.md)                                             | partial   | Writing or running tests                                                                             |
| [standards-and-documentation.md](standards-and-documentation.md)     | partial   | Any exported TypeScript (TSDoc rules)                                                                |

### Component specs (`components/`)

Read [COMPONENTS.md](COMPONENTS.md) first; a component spec overrides it only where it says so.

| Spec                                            | Status | Tier                                                |
| ----------------------------------------------- | ------ | --------------------------------------------------- |
| [button.md](components/button.md)               | draft  | Style primitive `.btn`                              |
| [card.md](components/card.md)                   | draft  | Presentational `app-dataset-card`, `app-model-card` |
| [virtual-table.md](components/virtual-table.md) | draft  | `ui-virtual-table` (tier disputed, see gaps)        |
| [sidepanel.md](components/sidepanel.md)         | stub   | —                                                   |

### Other directories

- [`mockups/`](mockups/) — static HTML/CSS wireframes referenced by `workflow-steps.md`. Served by `bun run serve:scaffold`. Reference only; don't edit unless a plan says to.
- [`plans/`](plans/README.md) — implementation plans. Only files that follow the planning template go here.

## Known gaps

Known conflicts between specs, and between specs and code, as of 2026-11-12. A plan that touches one of these must decide it explicitly; remove the entry once it is resolved.

1. **Directory structure.** ARCHITECTURE specifies `src/features/`, `src/router/` and `src/stores/`, with entry `/src/main.ts`. The code has `src/views/`, `src/partials/` and `src/types/`, with entry `src/app.ts`.
2. **HTML template.** The README and `scripts/build-assets.ts` expect `public/index.html`, which does not exist. A root `index.html` exists and references relative `styles.css`/`app.js`, but the build emits `style.css`, and ARCHITECTURE requires root-absolute URLs.
3. **CSS inlining.** The production build inlines CSS (`scripts/html.ts`, README). ARCHITECTURE says "No Inlining".
4. **Content location.** The specs say `/content-src/<locale>/`, compiled to `src/content-compiled/`. The code has `content/models/` and `content/pages/`, with no locales and no compile step.
5. **Component test environment.** testing.md says to use happy-dom for Lit components. COMPONENTS §9 forbids a simulated DOM for components and requires Playwright. happy-dom, Playwright, Storybook and Vitest are not installed.
6. **Specified but not installed.** `nanostores`, `@nanostores/lit`, `@nanostores/i18n`, Comlink (testing.md) and a service worker.
7. **Linting.** standards-and-documentation says `eslint-plugin-tsdoc` is enforced in CI. There's no ESLint config, no `lint` script and no CI.
8. **Virtual table tier.** components/virtual-table.md says Tier 2 presentational; an earlier stub said connected component.
9. **Column type vocabularies** differ across specs; see the table in [state-and-storage.md §10](state-and-storage.md).
10. **Product name.** VISION and `wrangler.jsonc` say `web-ml-app`; the repository and UI say `samata-ml`/`samatā.ml`.
11. **`npx` vs Bun.** The vendored `modern-web-guidance` skill runs `npx`; this repo uses Bun only, so run its commands with `bunx`.
12. **Legacy code and baseline failures.** `src/views/` and `src/partials/` import Mithril, which is not installed (20 `bun run typecheck` errors). `bun run build` fails because `src/models/storage/storageWorker.ts` does not exist. One scaffold-server test fails (`--font-sans` expected in the mockup CSS).
