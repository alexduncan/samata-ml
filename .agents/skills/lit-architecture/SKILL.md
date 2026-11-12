---
name: lit-architecture
description: Design Lit component work while planning samata-ml changes. Choose each element's tier and prefix, place its state, fix its closed public API, events, styling and tests, and write them into the plan template. Use together with the planning skill whenever a plan adds or changes Lit components, reactive controllers, store bindings, component styles or component tests.
---

# Lit architecture

Use this together with the `planning` skill: it covers the component part of that skill's step 5. This skill is a procedure only. The rules are in [`specification/COMPONENTS.md`](../../../specification/COMPONENTS.md) (cited here as §n) and the specs it links. If something here seems to disagree with `COMPONENTS.md`, `COMPONENTS.md` is right; record the disagreement in the plan's _Risks and open questions_.

## Steps

1. **Read.** Read `COMPONENTS.md` in full, plus the component spec in `specification/components/` for every element you add or change. If an element has no component spec, the plan must define its closed public API (step 4) or list it as a blocking question. Never leave the API for the implementer to invent.
2. **Choose tier and prefix.** For each building block, pick the lowest tier that works (§2): style primitive, then presentational, then connected. Pick the prefix by scope, not tier (§1). Record tier, tag name and file path (one element per file, named after the tag, §4).
3. **Place state.** For each piece of state, decide where it lives (§5):
    - where the user is → the router's store;
    - what the user has done, or UI state that must survive a reload → a persisted store with an action ([state-and-storage.md](../../../specification/state-and-storage.md) §5);
    - transient UI state (hover, an open menu) → `@state` in the element;
    - large data (rows, statistics, results) → IndexedDB behind the storage layer, reaching components through stores or properties.

    Only connected components import stores. Name every store, `computed` value and action the plan relies on.

4. **Fix the public API.** For each element, list everything §3 calls public: properties and attributes (type, default, whether reflected and why), slots, events, methods, CSS parts and CSS custom properties. For each event give the full name (§4 prefix), the TypeScript `detail` interface, and whether it bubbles and is composed, with the reason. Anything not listed stays private.
5. **Check for shared code.** Don't plan base classes, mixins, shared controllers or shared helpers unless §3's conditions are met. Static markup that needs no state, events or reuse is a template function in the same file, not a new element.
6. **Styling.** Name the tokens (§6.1) and shared style modules (§6.2) each element uses. Parts and custom properties come only from step 4.
7. **Accessibility and i18n.** For each element, record how its accessible name is supplied, its keyboard behaviour and its manual checks (§7). Record its strings, or say it owns none (§8). For any web-platform feature, use the `modern-web-guidance` skill as the planning skill's step 4 describes.
8. **Tests.** Give each acceptance criterion an ID (§9). Component behaviour is tested in Playwright; non-DOM logic in `bun:test`. Include RTL and long-label cases. Storybook is not installed (§10), so list stories as deferred. Use only commands that exist (`AGENTS.md`).

## Where the design goes in the plan

| Design output                                     | Plan template location                                        |
| ------------------------------------------------- | ------------------------------------------------------------- |
| Elements, tiers, tags, file paths (step 2)        | _Technical decisions_, and each task's **Likely files**       |
| State placement, stores and actions (step 3)      | _Interfaces and behaviour_                                    |
| Public API and event contracts (step 4)           | _Interfaces and behaviour_                                    |
| Tokens, style modules, a11y, strings (steps 6, 7) | _Interfaces and behaviour_, and the relevant tasks            |
| Acceptance criteria with IDs (step 8)             | Each task's **Acceptance criteria**                           |
| Test commands (step 8)                            | Each task's **Verification**                                  |
| `COMPONENTS.md` §3–§9 and each component spec     | _Required reading_, for every task that touches Lit code      |
| Tasks that touch Lit code                         | _Codebase context_ → **Lit skills** line, naming the task IDs |

## Before handing off

- Every element has a tier, tag, file path and closed public API.
- Every event has a prefixed name, a `detail` interface and a stated `bubbles`/`composed` choice.
- Every piece of state has one home, and no presentational element imports a store.
- No shared helper, controller or base class is planned without §3's authorisation.
- Every Lit task lists `COMPONENTS.md` §3–§9 under _Required reading_.
