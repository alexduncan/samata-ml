# Virtualised dataset table

**Status:** draft | **Updated:** 2026-11-13T22:17:28Z

## Goal

**Current behaviour:** No table component exists. The draft `specification/components/virtual-table.md` has useful Tier 2 and ARIA-table requirements, but also a worker-owning example, unavailable tokens and an unresolved API. Preview mockups contain only a table placeholder.

**Target behaviour:** A presentational Lit table renders a bounded window, requests rows from its consumer and previews up to 10,000,000 rows. Numeric cells have grouping separators. The consumer owns fetching and display formatting.

**Why:** Make dataset preview performant and give Step 1 a complete component contract.

## Scope

**In scope**

- Close and implement the table API, row window, column-selection intent and scroll restoration.
- Retain the useful component specification; rewrite conflicting parts during final sync, rather than deleting it.
- Record the human's formatting and row-cap answers; richer boolean/float formatting goes into `specification/FUTURE.md` at sync.

**Out of scope**

- Workers, IndexedDB, stores, sorting, filtering, editing, variable row heights, horizontal column virtualisation and custom cell renderers.
- A spreadsheet grid, roving cell focus, new visual design/tokens and Storybook (not installed).

**Constraints and invariants**

- Tier 2, no application/store imports. Data in, typed intent out.
- Honour the human's performance-first answer: retain inexpensive names, table roles and native controls, but do not build a spreadsheet keyboard model or claim that unmounted rows are accessible.
- At most 256 columns (ingestion limit); only viewport rows plus five overscan rows on each side are mounted.
- Draft-only styles follow visual-design §1.1. Rail geometry is necessary to virtualisation and does not authorise decorative styles.

## Required reading

The implementer reads only these, plus each task's likely files.

- This plan's _Interfaces and behaviour_ — settled contract, superseding the unresolved component proposal.
- `specification/COMPONENTS.md` §3–§9 — Lit, API, lifecycle, styles and tests.
- `specification/components/virtual-table.md` §1–§3, §6, §11 — useful presentational boundary and semantics; conflicts are decided below.
- `specification/visual-design.md` §1.1, §2, §4 — draft limits and tokens.
- `specification/mockups/ui-scaffold/drafts/01-6_virtual-table.html` — unstyled structure.
- `src/types/dataset.ts`, `css/root.css`, `specification/standards-and-documentation.md` — cells, tokens, TSDoc.

## Codebase context

- **Relevant implementation:** `src/components/ui-virtual-table.ts` is new. Step 1's store calls `getStorageClient().fetchRows(datasetId, offset, limit)` and formats `RawRecord.values`; this component never does.
- **Tests and commands:** Review baseline `bun run check`: 144 pass, 0 fail, 22 files, 0 type errors. Playwright suites belong in `tests/*.e2e.ts` (Known gap 17).
- **Web guidance:** Retrieved `responsive-table` and `accessibility` on 2026-11-13: named, keyboard-scrollable overflow and header associations. [WAI table pattern](https://www.w3.org/WAI/ARIA/apg/patterns/table/) has no composite keyboard model. [Lit properties](https://lit.dev/docs/components/properties/) and [events](https://lit.dev/docs/components/events/) support properties in and direct host events out.
- **Visual reference:** draft: `specification/mockups/ui-scaffold/drafts/01-6_virtual-table.html`, shell from `01-4_preview-dataset.html`; no normative table selectors. Existing button styles only, no table parity entry until styled. Token/a11y checks still apply.
- **Lit skills:** `lit-implementer` for T1 and T2.
- **Known gaps decided:** 8: keep Tier 2; remove worker example and unavailable tokens during sync. 17: browser tests under `tests/`.
- **Assumptions requiring verification:** None about browser maximum scroll height; use bounded segments.
- **Review author:** Codex (model unrecorded), 2026-11-13; retain this co-author during workflow migration.
- **Review handoff:** Prepared for technical review. Formal `ready-for-review` metadata awaits `agent-workflow-gates`; the current validator accepts only `draft`, `ready`, `implemented`, `stub`.

## Technical decisions

| Decision           | Chosen approach and rationale                                                                                              | Rejected alternative / trade-off                                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| D1 Tier            | Presentational; preserve the spec's useful boundary.                                                                       | A connected reusable table couples it to application storage.                                                                          |
| D2 Cells           | Plain display strings, escaped by Lit. Step 1 groups numbers while preserving decimals.                                    | Per-cell templates/slots expand the API and add cost without a present need.                                                           |
| D3 Semantics       | Div-based ARIA table with native header buttons; no grid role.                                                             | Grid semantics require focus/editing behaviour absent from this preview.                                                               |
| D4 Scroll geometry | Segments of 10,000 rows, selected by `scrollToRow`; Step 1 supplies Previous/Next segment and Go to row controls.          | A ten-million-row spacer can exceed browser layout limits even with bounded DOM. A compressed rail makes ordinary scrolling skip rows. |
| D5 Preview cap     | `effectiveRows = min(totalRows, 10_000_000)`; consumer shows a cap notice when needed. Stored/training rows remain intact. | Treating the preview limit as an ingestion or training limit.                                                                          |

### Interfaces and behaviour

`src/components/ui-virtual-table.ts` exports `UiVirtualTable`, `VirtualTableColumn`, `VirtualTableWindow`, `VirtualTableRange`, `VirtualTablePosition`:

```ts
interface VirtualTableColumn {
	key: string;
	label: string;
}
interface VirtualTableWindow {
	startIndex: number;
	rows: readonly (readonly string[])[];
}
interface VirtualTableRange {
	startIndex: number;
	limit: number;
}
interface VirtualTablePosition {
	rowIndex: number;
	offset: number;
	inlineOffset: number;
	top: number;
}
```

Indices are zero-based data indices. Column keys are exact unique names in metadata order. `window.rows[i]` belongs to `window.startIndex + i`. Inputs are immutable.

**Closed API:** `columns: readonly VirtualTableColumn[] = []`, `window: VirtualTableWindow = {startIndex: 0, rows: []}`, `loading: boolean = false` are property-only (`attribute: false`). `totalRows: number = 0` has attribute `total-rows`; `label: string = ''` has attribute `label`, with a required non-empty name supplied by the caller. No reflection. Method `scrollToRow(index: number, offset = 0, inlineOffset = 0): Promise<void>` clamps to the effective range and resolves after geometry and Lit updates. Method `restoreScroll(top:number,left:number):Promise<void>` converts logical pixel offsets using current measured row height, then calls scrollToRow. Position event `top` is rowIndex \* measuredRowHeight + offset; the consumer need not inspect private geometry. Method `focusColumn(column:string):void` focuses the matching native header button (no-op if absent); lets the panel consumer restore focus without querying another shadowRoot. No slots, parts, custom properties or other public methods.

Events: `ui-virtual-table-range-change` carries `VirtualTableRange`; `ui-virtual-table-position-change` carries `VirtualTablePosition`; `ui-virtual-table-column-select` carries `{column: string}`. All dispatch on the host, `bubbles: false`, `composed: false`, because the direct consumer binds the host.

**Geometry:** Row block size `2.5rem`, measured after render; viewport at most `25rem`, fitting available space; column minimum inline size `12rem`, horizontal overflow with a shared header/body inline position. These are structural geometry decisions, not visual styling permission. A `ResizeObserver` remeasures on size/font changes; dispose and reconnect per COMPONENTS §4. Full cell strings stay in DOM and `title`; no cell tooltip component.

For measured row height `r`, body height `h`, segment start `s = floor(index / 10000) * 10000`, end `e = min(s + 10000, effectiveRows)`, and `first = s + floor(localScrollTop / r)`, request `[max(s, first - 5), min(e, first + ceil(h / r) + 6))`. Row DOM bound is `ceil(h / r) + 11`, clamped at boundaries. The rail height is at most 10,000 rows; position the window within this rail. Coalesce scroll in `requestAnimationFrame`; emit once per changed `(startIndex, limit)`, resetting de-duplication on columns/count changes. Empty datasets emit no request. Do not allocate a full row array.

Render only requested rows supplied by `window`; absent rows use empty busy placeholders of identical height. Obsolete windows cannot appear under different absolute indices. Consumer owns empty/loading/error prose, retry and segment controls. `scrollToRow` selects the appropriate segment and requests/emits its position; `offset` is the within-row vertical pixel offset, `inlineOffset` the non-negative distance from inline start (normalise browser RTL `scrollLeft`). Native arrows/Page Up/Page Down scroll within a segment; consumer controls reach every segment. No global keyboard handlers.

Use `role="table"`, header/body `rowgroup`, `row`, `columnheader`, `cell`. `aria-rowcount = effectiveRows + 1`, header index 1, data row index `absoluteIndex + 2`, and `aria-colcount` from columns. Header buttons use column labels; table and focusable scroll region use `label` within the same shadow root. No `aria-selected`. Component owns no prose or numeric formatting. Position lives transiently here; consumer persists emitted logical position, not just the local segment's CSS offset.

## Specification changes

- [ ] `specification/components/virtual-table.md` §1–§12 — settled API, segmented rail, semantics, consumer formatting and browser tests; `draft` → `implemented` for delivered behaviour, with styled appearance pending.
- [ ] `specification/FUTURE.md` — richer type-specific preview formatting for booleans/floats/currency/percentages is deferred; current grouped numeric display preserves decimals.
- [ ] `specification/README.md` Known gap 8 — resolved after worker example and unavailable tokens are removed; gap 17 narrowed for this component.
- [ ] `specification/TODO.md` TODO-31/TODO-32 — textual cells and presentational tier resolved; TODO-48 remains owned by Step 1.

## Implementation tasks

### T1 — Implement the bounded virtual table

- **Depends on:** None; approval under the active workflow.
- **Risk:** needs care — ranges, segments, stale windows and observer lifecycle.
- **Likely files:** `src/components/ui-virtual-table.ts`, `tests/virtual-table.e2e.ts`.
- **Must not touch:** Stores, workers, storage client, tokens and product views.
- **Implementation:** Implement the complete contract above with standard accessor decorators, stable absolute keys, pure rendering and teardown. Single-use geometry/controller stays in the element file. Apply only permitted draft geometry and existing shared styles; no parity entry.
- **Acceptance criteria:**
    - [ ] `VTB-AC-1` — DOM bound holds at start/middle/end for 0, 1, 10,001, 10,000,000 and 10,000,001 rows without full-row allocation; last permitted row reachable.
    - [ ] `VTB-AC-2` — exact ranges/de-duplication at partial rows, resize and segment changes; stale windows never populate wrong indices.
    - [ ] `VTB-AC-3` — exact column/position events; markup in cell values displays as text.
- **Verification:** `bun run test:e2e tests/virtual-table.e2e.ts`; `bun run check`.
- **Progress:** [ ] Not started

### T2 — Verify browser scrolling and semantics

- **Depends on:** T1.
- **Risk:** needs care — browser scroll/font geometry differs.
- **Likely files:** `tests/virtual-table.e2e.ts`, `tests/a11y.e2e.ts`.
- **Must not touch:** Normative mockups, parity map, stores and workers.
- **Implementation:** Cover resize/reconnect, bounded rail, native keyboard, RTL inline offsets, long labels, text scaling, 320px, 200% zoom and forced colours. Manual screen-reader verification covers mounted rows and records limitations.
- **Acceptance criteria:**
    - [ ] `VTB-AC-4` — named header buttons are operable, no trap, exact table counts/indices.
    - [ ] `VTB-AC-5` — all three configured browsers pass the large-row cases, tokens and mounted-table axe scan; no rail clamping or invented appearance.
    - [ ] `VTB-AC-6` — font scaling remeasures rows without clipping; disconnect silences observers/events and reconnect restores them.
- **Verification:** `bun run test:e2e tests/virtual-table.e2e.ts tests/a11y.e2e.ts`; `bun test tests/style-tokens.test.ts`; `bun run check`.
- **Progress:** [ ] Not started

### T3 — Sync specification

- **Depends on:** T1, T2.
- **Risk:** needs care — preserve useful rules and remove contradictions.
- **Likely files:** `specification/components/virtual-table.md`, `specification/FUTURE.md`, `specification/README.md`, `specification/TODO.md`, `specification/HUMAN.md`.
- **Must not touch:** Product code, tests and normative mockups.
- **Implementation:** Apply every specification change, update statuses/index honestly and remove answered queue items. Keep the styling request. If workflow-gates has landed, its verifier owns this sync.
- **Acceptance criteria:**
    - [ ] Every specification change applied and ticked; no worker example, unavailable token or old API remains.
    - [ ] Plan/spec indexes agree and draft styling limitation stays explicit.
- **Verification:** `bun run plans:check`; review `git diff specification/`.
- **Progress:** [ ] Not started

## Verification and definition of done

- [ ] T1–T3 criteria met with evidence.
- [ ] `bun run check`: 0 type errors/no failures relative to 144 passing tests; record fresh implementation before/after counts.
- [ ] `bun run build`, tokens and all configured browsers pass; name browsers/manual checks not run.
- [ ] No parity claim for the unstyled table; all specification changes ticked.

## Risks and open questions

- **Blocking:** None.
- **Review handoff:** The user chose review-complete drafts under current tooling. Formal submission awaits workflow-gates status support; implementation approval is separate.
- **Non-blocking:** Awaiting a styled mockup (human). Segmented navigation is the cost of avoiding layout-height limits. All 256 columns may be mounted per visible row; horizontal virtualisation is deferred pending measurement. The performance-first preview exposes only mounted rows to assistive technology; a complete non-virtual alternative remains future work.

## Implementation and verification log

| When (UTC) | Task | Outcome / commands / evidence |
| ---------- | ---- | ----------------------------- |
| —          | —    | Not started                   |

## Change log

| When (UTC)           | Change                                                | Reason                                                                                                |
| -------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 2026-11-13T09:56:12Z | Initial draft                                         | Separated table work from Step 1.                                                                     |
| 2026-11-13T18:47:40Z | Closed API, tier, cells and segmented-scroll contract | Human answers and review against current code/platform guidance.                                      |
| 2026-11-13T22:17:28Z | Normalised no-blocker review handoff                  | User chose review-complete drafts using current tooling; accepted product decisions remain unchanged. |
