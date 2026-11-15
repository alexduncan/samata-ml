# Specification Index

Authoritative product and engineering specifications for `samata-ml`. **Planning agents** use this index to pick the specs a change needs and read only those. **Implementation agents** read only the files a plan lists under _Required reading_.

The specs describe the intended design. Each spec's status line, and the [Known gaps](#known-gaps) list, say exactly how much of it is built. Plans in [`plans/`](plans/README.md) describe proposed and in-flight work; when a plan is implemented, its final `Sync specification` task updates the specs it lists under _Specification changes_.

If code and a spec disagree, do not silently pick one. Check [Known gaps](#known-gaps). If the conflict isn't listed there, record it in the plan's _Risks and open questions_ section.

## Status

Each spec has a `**Status:**` line under its title, and the same status in its row below (`bun run plans:check` fails if they differ):

- **implemented** — describes the code as it is.
- **partial** — some rules apply now; the rest is target design. The status line says which.
- **target** — agreed design that the code does not follow yet. A plan must say how to get there.
- **draft** — not yet agreed; has open questions. Do not plan against it without the user answering them.
- **reference** / **stub** — context only / not yet written.

## Writing specs

These rules apply whenever a spec changes, whether in a plan's `Sync specification` task or a no-plan fix.

- **Present tense, no history.** Say how the system works: interfaces, data shapes, state transitions, invariants and edge cases. Don't write "Updated X to do Y", "Added in <plan>", migration steps or task checklists. Keep rationale only where a reader needs it to avoid undoing a decision.
- **Synthesise; don't copy.** Merge lasting rules into the existing sections rather than pasting plan text.
- **One rule, one place.** When behaviour changes, update or delete every copy of the old rule, so no two specs contradict each other.
- **Honest status.** Move the status towards `implemented` only for what the code does now. A `partial` status line names what is still target design.
- **Known gaps.** Narrow an entry's wording once a change resolves part of it; once it is fully resolved, replace its text with _Resolved._ and keep its number.

## Specs

| Spec                                                                 | Status      | Read when                                                                                                                |
| -------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| [VISION.md](VISION.md)                                               | reference   | Planning a new feature (product intent, educational and ethical goals)                                                   |
| [workflow-steps.md](workflow-steps.md)                               | partial     | Anything a user sees in the four workflow steps. **Wins over other specs on user-facing behaviour.**                     |
| [ARCHITECTURE.md](ARCHITECTURE.md)                                   | partial     | New directories or modules, routing, build, delivery, caching, Bun tooling                                               |
| [COMPONENTS.md](COMPONENTS.md)                                       | partial     | Any Lit component, style primitive, store binding, a11y or i18n in UI                                                    |
| [visual-design.md](visual-design.md)                                 | partial     | Anything a user sees: colours, type, spacing, tokens, mockup fidelity, contrast. Wins over the mockups on accessibility. |
| [app-state-and-navigation.md](app-state-and-navigation.md)           | draft       | Router, URL/history, step behaviour, scroll memory, model lifecycle                                                      |
| [state-and-storage.md](state-and-storage.md)                         | draft       | Nanostores, persisted schema, `localStorage`, IndexedDB, multi-tab                                                       |
| [data-ingestion.md](data-ingestion.md)                               | implemented | CSV upload/parsing, column statistics, IndexedDB dataset storage                                                         |
| [sample-datasets.md](sample-datasets.md)                             | implemented | Typed sample descriptors, build-time validation, generated catalogue and datasheets                                      |
| [preview-dataset.md](preview-dataset.md)                             | implemented | Dataset preview table and column inspector                                                                               |
| [machine-learning-orchestrator.md](machine-learning-orchestrator.md) | stub        | Calling the `web-ml` library or training workers                                                                         |
| [content-and-i18n.md](content-and-i18n.md)                           | partial     | Markdown content pipeline, localisation                                                                                  |
| [testing.md](testing.md)                                             | partial     | Writing or running tests                                                                                                 |
| [mockup-review.md](mockup-review.md)                                 | implemented | Reviewing and promoting mockups, requesting markup changes and commissioning an app port                                 |
| [standards-and-documentation.md](standards-and-documentation.md)     | partial     | Any exported TypeScript (TSDoc rules)                                                                                    |

### Component specs (`components/`)

Read [COMPONENTS.md](COMPONENTS.md) first; a component spec overrides it only where it says so.

| Spec                                            | Status      | Tier                                                          |
| ----------------------------------------------- | ----------- | ------------------------------------------------------------- |
| [button.md](components/button.md)               | draft       | Style primitive `.btn`                                        |
| [card.md](components/card.md)                   | implemented | Presentational `app-dataset-card`, `app-model-card`           |
| [virtual-table.md](components/virtual-table.md) | implemented | Presentational `ui-virtual-table` (styled appearance pending) |
| [sidepanel.md](components/sidepanel.md)         | implemented | Presentational `app-column-details`                           |

### Backlog

- [HUMAN.md](HUMAN.md) — the human's work queue: approvals, decisions and mockups to style, each linking to its detail. Every agent keeps it current.
- [TODO.md](TODO.md) — open questions and missing specification, with IDs (`TODO-nn`) that plans can cite.
- [FUTURE.md](FUTURE.md) — deferred features. Do not plan these until they are moved into a spec.

### Other directories

- [`mockups/`](mockups/) — static HTML/CSS wireframes, normative for appearance (see [visual-design.md](visual-design.md)); not for markup or behaviour. Browse every file with `bun run serve:mockups`; audit mockup accessibility with `bun run audit:mockups`. Reference only; don't edit unless a plan says to. Exception: agents write unstyled, non-normative drafts in `mockups/ui-scaffold/drafts/` ([visual-design §1.1](visual-design.md#11-draft-mockups)).
- [`plans/`](plans/README.md) — implementation plans. Only files that follow the planning template go here.
- [`notes/`](notes/README.md) — the human's rough notes, inbox for planners. Not normative; a plan that uses a note deletes it in its `Sync specification` task.

## Known gaps

Known conflicts between specs, and between specs and code, as of 2026-11-13. A plan that touches one of these must decide it explicitly. Numbers are stable because plans cite them: when an entry is resolved, replace its text with _Resolved._ rather than renumbering.

1. **Directory structure.** ARCHITECTURE names the entry `/src/main.ts`; the code's entry is `src/app.ts` (`scripts/build-assets.ts`). ARCHITECTURE's directory list omits `src/types/`.
2. **HTML template.** The repository README says the template is `public/index.html`, which does not exist; the build copies the root `index.html`. ARCHITECTURE's example asset URL is `/styles.css`; the real file is `/style.css`.
3. **CSS inlining.** The production build inlines CSS as well as linking it (`scripts/build-assets.ts`, `scripts/html.ts`, README). ARCHITECTURE says "No Inlining".
4. _Resolved._
5. **Component test environment.** testing.md says to use happy-dom for Lit components. COMPONENTS §9 forbids a simulated DOM for components and requires Playwright, which is what the code does: happy-dom is used only for non-component DOM tests. Storybook and Vitest are not installed (COMPONENTS §10 defers the Storybook rules until they are).
6. **Service worker specified but not installed.** ARCHITECTURE describes offline-first service-worker caching; no service worker is present. `testing.md` mentions Comlink as an option, but the application uses its own worker protocol and does not depend on Comlink.
7. **Linting.** standards-and-documentation says `eslint-plugin-tsdoc` is enforced in CI. The plugin is installed, but there is no ESLint config, no `lint` script and no CI.
8. _Resolved._
9. _Resolved._
10. **Product name.** VISION and `wrangler.jsonc` say `web-ml-app`; the repository and UI say `samata-ml`/`samatā.ml`.
11. **`npx` vs Bun.** The vendored `modern-web-guidance` skill runs `npx`; this repo uses Bun only, so run its commands with `bunx`.
12. _Resolved._
13. **Mockups versus WCAG and the Lit scaffold.** The mockups contain contrast and semantic failures (registers A11Y and SEM in [mockup-visual-fidelity](plans/mockup-visual-fidelity.md)); A11Y-01, A11Y-02, A11Y-09 and SEM-01–02 are not yet applied (SEM-03 is applied). The scaffold shell (`src/app.ts`, `src/features/**`) uses 21 tokens that are not in `css/root.css`, 83 `var()` fallbacks and literal colours, does not match the mockups, and breaks COMPONENTS §4, §6.3, §7 and §8 in places; `tests/style-tokens.test.ts` passes only because these files are listed in `KNOWN_DRIFT`. The `css/` copies of button, card, badges and modal are still loaded, and the token guard does not check literal colours in `css/*.css`. Owned by [storybook-component-library](plans/storybook-component-library.md) (draft), which also owns gaps 1, 2, 5 and 17.
14. **State, storage and navigation remaining undelivered scope.** Conformance plan [state-navigation-conformance](plans/state-navigation-conformance.md) resolved persister ownership, schema validation, read-only mode, discrete write triggers, progress throttling, blocked reasons, sidebar `aria-current`, `underlayPath`, focus management, scroll saving and invalidation, unchanged-edit no-ops and action validation. Remaining undelivered scope: stored-results deletion in IndexedDB (`model_results`), save-failure notifications, and full multi-tab sync.
15. _Resolved._
16. _Resolved._
17. **Where Playwright component tests live.** COMPONENTS §9, button.md and card.md put Playwright tests in `*.test.ts` beside the source. `playwright.config.ts` runs tests in `tests/*.e2e.ts`, `tests/journeys/*.e2e.ts` and `tests/app-shell.test.ts`, avoiding collision with `bun test` in `src/`. Tests for `ui-virtual-table` live in `tests/virtual-table.e2e.ts`.
18. _Resolved._
