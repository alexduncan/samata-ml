# Virtualised Dataset Table Component

**Status:** draft | **Updated:** 2026-11-13T09:56:12Z

## Goal

**Current behaviour:** `specification/components/virtual-table.md` describes a proposed `ui-virtual-table`, but it is draft and unresolved on cell rendering (TODO-31) and tier (TODO-32). It specifies CSS tokens absent from `css/root.css`, includes a worker-owning example that conflicts with `COMPONENTS.md` §5, and has no markup in the preview mockup beyond a `{Virtual Table Component}` placeholder. No table component or dataset row view exists in `src/`.

**Target behaviour:** Define, implement and browser-test a reusable table component for the Step 1 dataset preview. Its public API, data rendering, virtualisation, keyboard and screen-reader behaviour, styling and performance limits are explicit and match the app's component and visual design contracts.

**Why:** Dataset previews can contain many rows, so the UI needs a bounded DOM while preserving reliable table context and keyboard/screen-reader access.

## Scope

**In scope**

- Resolve and record the component tier, public API and cell rendering contract in `specification/components/virtual-table.md` before implementation.
- Implement `ui-virtual-table` and its real-browser acceptance tests, including the interaction with a caller-provided row window.
- Match the approved Step 1 preview table visual reference and add parity coverage when a normative mockup is available.
- Update TODO-31/TODO-32 and Known gap 8 only for the decisions and code this plan settles.

**Out of scope**

- IndexedDB access, workers, Nanostores, CSV parsing, filtering or sorting.
- Variable row heights, editable cells, column resizing/reordering, and row selection unless the approved API explicitly requires one.
- The surrounding dataset preview page and column details panel; those belong to `step-1-load-data-and-preview.md`.
- Modifying `specification/mockups/**` as part of implementation. A normative visual reference must be approved before this plan is ready.

**Constraints and invariants**

- Choose the lowest tier that satisfies the settled behaviour. Only connected components import stores; reusable `ui-` elements do not reach into app storage or create workers.
- Use closed, documented Lit public APIs and prefixed events; no unlisted props, slots, parts, CSS custom properties or exports.
- Preserve native table semantics where compatible with the approved virtualisation model. Any non-native ARIA table pattern needs an explicit keyboard/screen-reader contract and manual checks.
- Use only `css/root.css` tokens, no fallbacks or literal colours. CSS uses logical properties and required `:host([hidden])` handling.
- Target WCAG 2.2 AA, Baseline Widely Available browsers, RTL, long labels, 320px width, 200% zoom, reduced motion and forced colours.
- The implementation keeps DOM nodes proportional to viewport rows and bounded overscan, rather than dataset size; supported maximum row count and scroll-height behaviour must be decided and tested.

## Required reading

The implementer reads only these, plus each task's likely files. Everything else is optional.

- `specification/COMPONENTS.md` §1–§9 — tiers, public API, Lit, state, styling, accessibility and browser tests.
- `specification/components/virtual-table.md` §§1–§12 — proposed component requirements; rewrite it before treating its current API as binding.
- `specification/preview-dataset.md` “Virtualized Row Loading” and “Table Rendering Design” — consumer's proposed bounded row loading (reconcile obsolete storage references under TODO-48).
- `specification/visual-design.md` §1–§6 — mockup fidelity, token use, deviations and parity checks.
- `specification/README.md` Known gap 8 and `specification/TODO.md` TODO-31/TODO-32 — conflicts to resolve.
- `specification/mockups/ui-scaffold/01-4_preview-dataset.html` — page header and table placeholder; CSS `specification/mockups/ui-scaffold/css/table.css`, selector `.table` (presentational table rules only; there is no virtual-table markup or selector mapping).
- `css/root.css` — canonical available tokens.
- `specification/standards-and-documentation.md` — exported TypeScript documentation.

## Codebase context

- **Relevant implementation:** `src/` has no components directory or table component. `src/types/state.ts` defines `ColumnType`; `src/styles/` has shared button/card/chiclet/dialog styles but no table style module.
- **Tests and commands:** `bun run test:e2e` invokes Playwright; `tests/visual-parity.e2e.ts` is the parity harness and `tests/style-tokens.test.ts` checks tokens. Baseline from `AGENTS.md`: `bun run check` has 0 type errors and 52 tests passing; `bun run build` passes. No component-specific test exists.
- **Web guidance:** `responsive-table`, `accessibility`, `defer-rendering-heavy-content` — keep table semantics, name and keyboard-enable any scroll region; virtualise actual rows instead of deferring a full massive DOM with `content-visibility`; sticky table context is a candidate pattern only after a mockup and assistive-technology checks.
- **Visual reference:** `01-4_preview-dataset.html` shows only `{Virtual Table Component}` and `css/table.css` defines ordinary `.table`, `thead`, `th`, `td` and zebra striping. There is no virtual table mockup, interaction state or responsive treatment. **Blocking visual reference gap:** the user must provide/approve a table mockup or explicitly approve a plan-level visual design before this plan can become ready. If a new mockup is requested, its creation is a separate task outside this implementation plan.
- **Lit skills:** implementers use `lit-implementer` for T2 and T3.
- **Known gaps decided:** None yet. Known gap 8 and TODO-31/TODO-32 remain blocking until the human decisions below are recorded and the component spec is revised.
- **Assumptions requiring verification:** the row-window consumer can provide string/display values and stable absolute row indices without rendering a `renderCell` function in the component. This is not adopted as a contract until TODO-31 is answered.

## Technical decisions

| Decision                                      | Chosen approach and rationale                                                                                                                                                                                                     | Rejected alternative / trade-off                                                                                                                  |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component tier                                | **Blocking:** settle TODO-32. The existing draft says presentational, while Known gap 8 records an older connected-component stub. The plan cannot choose until the human confirms the owning boundary.                           | A planner must not silently resolve a recorded human question.                                                                                    |
| Cell content contract                         | **Blocking:** settle TODO-31. Decide whether the component renders plain textual values or accepts a per-column cell renderer/template, and define safe handling of nulls, long/unbroken strings and non-text values.             | An implicit renderer property would expand the component API and can introduce non-transferable closures into row-window data.                    |
| Accessible table structure and keyboard model | **Blocking:** the draft proposes div-based ARIA roles and arrow keys but does not specify a complete pattern. Settle native `<table>` versus ARIA table semantics and the exact focus/keyboard interaction before implementation. | A role-only structure without the corresponding interaction model can expose a misleading or unusable table to assistive technology.              |
| Visual contract                               | **Blocking:** approve a normative table design for the preview, including responsive overflow, sticky headers, row height, spacing and the mapping to `.table` rules. The current mockup has only a marker.                       | The implementer must not invent a visual treatment or infer virtualization details from the non-virtual `.table` stylesheet.                      |
| Row window and event                          | **Blocking:** finalise the properties, defaults, types, event detail and duplicate/range emission semantics in the component spec. Consumer owns fetch and cache; the table emits intent and receives rows.                       | The current `totalRows`/`visibleRows` proposal does not establish stable row identity, empty/loading rows, range semantics or error presentation. |

### Interfaces and behaviour

- Before implementation, the component spec must close: tag and file path; tier; all properties/attributes and defaults; slots; events and typed details with `bubbles`/`composed`; methods; CSS parts/properties; row and column types; range request rules; empty/loading/error representation; keyboard/focus behaviour; and string ownership.
- Data comes from the consumer. The element must not import `src/stores/**`, call IndexedDB or construct a `Worker`.
- The consumer supplies an ordered column list and only the current row window plus absolute indices; the component renders the approved rows and requests a new range when scrolling requires it. Exact API is intentionally unset pending TODO-31/TODO-32.
- The table exposes an accessible name using the approved caption/label strategy. If the scroll viewport is independently keyboard-scrollable, it has a visible focus indicator and accessible name. Header associations and row positions remain available in the accessibility tree.
- No strings are owned unless the resolved API requires loading/empty/error copy; any owned strings use the project's i18n pattern.
- Styling consumes only approved `css/root.css` tokens. Known gap 8's absent `--color-bg-surface` and `--color-border-subtle` must be replaced with existing tokens or approved additions; this plan does not authorise token additions by itself.
- Manual verification includes VoiceOver or NVDA table navigation, keyboard-only range scrolling, high-contrast/forced colours, RTL, long labels, 320px viewport and 200% zoom in supported browsers.

## Specification changes

What `specification/` must say once this plan is implemented. The final task applies these items and ticks each one; `task_gate.py --check-complete` refuses to close the plan while any is unticked.

- [ ] `specification/components/virtual-table.md` §§1–§12 — state final tier, API, data/range semantics, visual mapping, a11y, i18n, acceptance criteria, files and non-goals; status `draft` → `implemented` only when shipped behaviour satisfies the spec.
- [ ] `specification/visual-design.md` §3/§6 — add the virtual table's approved visual mapping and parity verification path if this plan establishes it.
- [ ] Known gap 8 — resolve the component tier, unavailable token names and worker-in-component example according to the final spec and code.
- [ ] `specification/TODO.md` — resolve TODO-31 (cell rendering contract).
- [ ] `specification/TODO.md` — resolve TODO-32 (component tier).
- [ ] `specification/TODO.md` — narrow TODO-48's virtual-table consumer/storage references after they match the canonical storage spec; the remaining preview-spec rewrite belongs to the Step 1 plan.

## Implementation tasks

### T1 — Finalise the virtual table component contract

- **Depends on:** Human answers for TODO-31 and TODO-32; approved visual reference; any required API decisions documented in `specification/components/virtual-table.md`.
- **Risk:** needs care — this task closes public API, accessibility and visual behaviour; each decision constrains the consumer plan.
- **Likely files:** `specification/components/virtual-table.md`, `specification/README.md`, `specification/TODO.md`.
- **Must not touch:** Product code, `specification/mockups/**`, or `css/root.css` token definitions unless a separate explicit decision adds tokens.
- **Implementation:** Rewrite the component spec as an agreed, complete contract. Remove the worker-owning example; specify real-browser criteria with stable IDs, mockup selector mapping, tokens and parity entries. Record any intentional deviation in an existing register or obtain approval for a new one before implementation.
- **Acceptance criteria:**
    - [ ] `VTB-SPEC-AC-1` — tier and cell rendering choice are explicit and TODO-31/TODO-32 match those choices.
    - [ ] `VTB-SPEC-AC-2` — every public API item, row-window edge case, keyboard interaction and accessibility role/association is specified; there are no open component questions.
    - [ ] `VTB-SPEC-AC-3` — styles map to an approved mockup and only existing tokens or explicitly approved additions; there are no unresolved visual deviations.
- **Verification:** `bun run plans:check specification/plans/virtual-table-component.md`; review `git diff specification/` against the recorded decisions.
- **Progress:** [ ] Not started

### T2 — Implement the virtualised table

- **Depends on:** T1; user approves this plan; `step-1-load-data-and-preview.md` consumer contract is aligned to the final component spec.
- **Risk:** needs care — virtual positioning, scrolling, header association and DOM recycling are browser-sensitive.
- **Likely files:** `src/components/ui-virtual-table.ts`, `src/styles/virtual-table.styles.ts`, `tests/virtual-table.e2e.ts`, `tests/visual-parity/map.ts`.
- **Must not touch:** storage workers, IndexedDB, app stores, CSV ingestion, dataset preview view, and `specification/mockups/**`.
- **Implementation:** Implement only the spec'd public API, render a bounded row window, request ranges through the spec'd event, support spec'd keyboard/scroll behaviour, use stable row identity, and keep the implementation store/worker-free. Add parity mapping for the approved preview mockup.
- **Acceptance criteria:**
    - [ ] `VTB-AC-1` — mounted row count is bounded by the final viewport and overscan contract during initial, middle and end-of-data scrolling.
    - [ ] `VTB-AC-2` — range events have the exact documented indices and do not emit duplicates for an unchanged requested range.
    - [ ] `VTB-AC-3` — rendered table has the specified semantic structure, accessible name, header/cell associations and absolute row context.
    - [ ] `VTB-AC-4` — the documented keyboard interaction scrolls/request ranges correctly; no focusable content is trapped or skipped.
    - [ ] `VTB-AC-5` — parity, token, RTL, long-label, 320px, 200% zoom and forced-colours criteria pass against the approved design.
- **Verification:** `bun run test:e2e tests/virtual-table.e2e.ts`; `bun run test:e2e tests/visual-parity.e2e.ts`; `bun test tests/style-tokens.test.ts`.
- **Progress:** [ ] Not started

### T3 — Sync specification

- **Depends on:** T1, T2.
- **Risk:** needs care — spec must describe the implemented code and preserve the human decisions verbatim.
- **Likely files:** `specification/components/virtual-table.md`, `specification/visual-design.md`, `specification/README.md`, `specification/TODO.md`.
- **Must not touch:** Product code, tests and `specification/mockups/**`.
- **Implementation:** Apply all items under _Specification changes_ to the shipped component, update status/index rows honestly and remove the superseded worker example and token names.
- **Acceptance criteria:**
    - [ ] Every item under _Specification changes_ is applied and ticked.
    - [ ] The component spec has no rule that conflicts with the implementation or `COMPONENTS.md`.
    - [ ] The plan/spec indexes and Known gap/TODO lists agree.
- **Verification:** `bun run plans:check`; inspect `git diff specification/` against _Specification changes_.
- **Progress:** [ ] Not started

## Verification and definition of done

- [ ] All task acceptance criteria met.
- [ ] `bun run check` introduces no new failures compared with the baseline: 0 type errors and 52 tests passing.
- [ ] `bun run build` passes.
- [ ] Parity and token checks pass; Playwright acceptance criteria pass in the supported configured browser projects.
- [ ] Manual screen-reader, keyboard-only, RTL, long-label, 320px, zoom and forced-colours checks are recorded.
- [ ] Every item under _Specification changes_ is ticked, and the spec describes the code as built.

## Risks and open questions

- **Blocking:** TODO-31 (plain text cells or per-column render template); TODO-32 (presentational or connected tier); no normative virtual-table mockup exists; native `<table>` or ARIA table and keyboard model are not specified; confirm whether the table needs a documented maximum dataset size / scroll-height strategy.
- **Non-blocking:** Browser engines differ in very large scroll-area limits; the final implementation should publish and test an explicit supported row bound rather than claim unbounded millions of rows.

## Implementation and verification log

| When (UTC) | Task | Outcome / commands / evidence |
| ---------- | ---- | ----------------------------- |
| —          | —    | Not started                   |

## Change log

| When (UTC)           | Change        | Reason                                                            |
| -------------------- | ------------- | ----------------------------------------------------------------- |
| 2026-11-13T09:56:12Z | Initial draft | Separated the unresolved virtual table work from the Step 1 view. |
