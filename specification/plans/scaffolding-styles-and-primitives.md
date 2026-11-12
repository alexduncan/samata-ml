# Scaffolding: Design Tokens and Shared Style Primitives

**Status:** implemented | **Updated:** 2026-11-12T12:39:16Z

## Goal

**Current behaviour:** Design tokens reside in `css/root.css` and lack the `--surface: #fff` token. Shared style modules mandated by component specifications (`button.styles.ts`, `card.styles.ts`, `chiclet.styles.ts`, `dialog.styles.ts`, and `global.ts`) do not exist.

**Target behaviour:** Tokens live in `src/styles/tokens.css` loaded by `index.html`. Lit `CSSResult` shared style modules exist under `src/styles/` and conform strictly to `specification/COMPONENTS.md §6`, `specification/components/button.md`, and `specification/components/card.md`. `src/styles/global.ts` adopts document-level sheets.

**Why:** Downstream Lit components (`app-sidebar`, `app-dataset-card`, `app-model-card`, dialog overlays) require normative CSS tokens and shared style modules without duplicating CSS rules or using literal colours.

## Scope

**In scope**

- Create `src/styles/tokens.css` from `css/root.css`, adding `--surface: #fff` and chiclet color tokens.
- Implement `src/styles/button.styles.ts` (`buttonStyles`).
- Implement `src/styles/chiclet.styles.ts` (`chicletStyles`).
- Implement `src/styles/card.styles.ts` (`cardStyles`).
- Implement `src/styles/dialog.styles.ts` (`dialogStyles`).
- Implement `src/styles/global.ts` adopting document-level sheets.
- Add style export tests in `tests/styles-and-primitives.test.ts`.

**Out of scope**

- Building custom elements (`<app-dataset-card>`, `<app-sidebar>`, etc.).
- Modifying `specification/mockups/`.

**Constraints and invariants**

- Follow `specification/COMPONENTS.md §6`: Logical properties only (`margin-block`, `padding-inline`), no literal colors, transitions inside `prefers-reduced-motion: no-preference`.
- Focus rings must use `outline` (not `box-shadow`) at least 2px with token colors.
- Closed public API: export only the exact symbols specified.

## Required reading

The implementer reads only these, plus each task's likely files. Everything else is optional.

- `specification/COMPONENTS.md` §6, §7 — styles, design tokens, and accessibility rules.
- `specification/components/button.md` §3, §5 — normative button styles and tokens.
- `specification/components/card.md` §5.1, §5.4 — card tokens and normative card styles.
- `specification/app-state-and-navigation.md` §5.4 — dialog modal styling and overscroll containment.

## Codebase context

Facts the planner verified, so the implementer need not re-check them.

- **Relevant implementation:** `css/root.css` holds color and font tokens. `specification/components/button.md` and `card.md` contain normative CSS code blocks.
- **Tests and commands:** `bun test` runs unit tests.
- **Web guidance:** None required for static Lit CSSResult definitions.
- **Known gaps decided:** Resolves Gap 2 (token location and missing `--surface` token).
- **Assumptions requiring verification:** None.

## Technical decisions

| Decision                | Chosen approach and rationale                                                                                   | Rejected alternative / trade-off                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Token file location     | Move tokens to `src/styles/tokens.css` per `COMPONENTS.md §6.1` and link in `index.html`.                       | Keeping `css/root.css`; rejected to maintain unified feature-based structure under `src/styles/`. |
| Shared style exports    | Export Lit `css` tagged template results (`CSSResult`) from `.styles.ts` files.                                 | Duplicate raw `.css` files; rejected by `COMPONENTS.md §6.2`.                                     |
| Chiclet color tokens    | Use `--purple-700` (`#7e22ce`), `--teal-700` (`#0f766e`), and `--amber-500` (`#f59e0b`) on chiclet backgrounds. | Chiclet pink; rejected by `card.md §5.2` due to contrast failure.                                 |
| Dialog backdrop styling | Apply `overscroll-behavior: contain` to `dialog` and `backdrop` per `app-state-and-navigation.md §5.4`.         | Body scroll locking with `position: fixed`; rejected because it breaks document scroll memory.    |

### Interfaces and behaviour

Exports from `src/styles/`:

- `tokens.css`: Loaded once by `index.html` via `<link rel="stylesheet" href="/styles/tokens.css">`.
- `button.styles.ts`: `export const buttonStyles: CSSResult;`
- `chiclet.styles.ts`: `export const chicletStyles: CSSResult;`
- `card.styles.ts`: `export const cardStyles: CSSResult;`
- `dialog.styles.ts`: `export const dialogStyles: CSSResult;`
- `global.ts`: `export function initGlobalStyles(): void;`

## Implementation tasks

### T1 — Migrate design tokens to src/styles/tokens.css

- **Depends on:** None
- **Risk:** routine
- **Likely files:** `src/styles/tokens.css`, `index.html`
- **Must not touch:** `specification/mockups/*`
- **Implementation:**
    - Copy custom properties from `css/root.css` into `src/styles/tokens.css`.
    - Add `--surface: #fff;` to `:root`.
    - Add chiclet color tokens: `--purple-700: #7e22ce;`, `--teal-700: #0f766e;`, `--amber-500: #f59e0b;`.
    - Update `index.html` to load `<link rel="stylesheet" href="/src/styles/tokens.css" />`.
- **Acceptance criteria:**
    - [x] `src/styles/tokens.css` contains `--surface: #fff`.
    - [x] `src/styles/tokens.css` contains `--purple-700`, `--teal-700`, and `--amber-500`.
    - [x] `index.html` links to `/src/styles/tokens.css`.
- **Verification:** `bun test`
- **Progress:** [x] Complete

### T2 — Implement buttonStyles module

- **Depends on:** T1
- **Risk:** routine
- **Likely files:** `src/styles/button.styles.ts`
- **Must not touch:** `src/components/*`
- **Implementation:**
    - Create `src/styles/button.styles.ts` exporting `buttonStyles: CSSResult`.
    - Implement classes `.btn` and `.btn-primary` using token custom properties per `specification/components/button.md §5.4`.
    - Include `:focus-visible` outline styles and logical properties.
    - Wrap transitions inside `@media (prefers-reduced-motion: no-preference)`.
- **Acceptance criteria:**
    - [x] `buttonStyles` exports a Lit `CSSResult`.
    - [x] `.btn` and `.btn-primary` styles match `specification/components/button.md`.
    - [x] No literal colors are used; only tokens.
- **Verification:** `bun run check`
- **Progress:** [x] Complete

### T3 — Implement chicletStyles module

- **Depends on:** T1
- **Risk:** routine
- **Likely files:** `src/styles/chiclet.styles.ts`
- **Must not touch:** `src/components/*`
- **Implementation:**
    - Create `src/styles/chiclet.styles.ts` exporting `chicletStyles: CSSResult`.
    - Implement `.chiclet`, `.chiclet-purple`, `.chiclet-teal`, `.chiclet-amber`.
    - Ensure contrast: white text on `--purple-700` and `--teal-700`, `--stone-900` text on `--amber-500` per `specification/components/card.md §6`.
    - Use logical properties and `font-family: var(--font-mono)`.
- **Acceptance criteria:**
    - [x] `chicletStyles` exports a Lit `CSSResult`.
    - [x] Text contrast meets WCAG 2.2 AA (≥ 4.5:1) for all three chiclet variants.
- **Verification:** `bun run check`
- **Progress:** [x] Complete

### T4 — Implement cardStyles module

- **Depends on:** T1, T2, T3
- **Risk:** routine
- **Likely files:** `src/styles/card.styles.ts`
- **Must not touch:** `src/components/*`
- **Implementation:**
    - Create `src/styles/card.styles.ts` exporting `cardStyles: CSSResult`.
    - Implement normative CSS from `specification/components/card.md §5.4`: `:host`, `:host([hidden])`, `.card`, `.card-image`, `.card-type`, `.card-title`, `.card-text`, `.card-stats`, `.stat`, `.card-actions`, `::slotted(svg)`.
    - Ensure logical properties and `--surface` background are used.
- **Acceptance criteria:**
    - [x] `cardStyles` exports a Lit `CSSResult`.
    - [x] CSS matches `specification/components/card.md §5.4` exactly.
- **Verification:** `bun run check`
- **Progress:** [x] Complete

### T5 — Implement dialogStyles and global document adoption

- **Depends on:** T2, T3
- **Risk:** routine
- **Likely files:** `src/styles/dialog.styles.ts`, `src/styles/global.ts`
- **Must not touch:** `src/features/*`
- **Implementation:**
    - Create `src/styles/dialog.styles.ts` exporting `dialogStyles: CSSResult` styling native `<dialog>` and `::backdrop` with `overscroll-behavior: contain`.
    - Create `src/styles/global.ts` exporting `initGlobalStyles()` that adopts `buttonStyles`, `chicletStyles`, and `dialogStyles` into `document.adoptedStyleSheets`.
- **Acceptance criteria:**
    - [x] `dialogStyles` exports a Lit `CSSResult`.
    - [x] `initGlobalStyles()` adds style sheets to `document.adoptedStyleSheets`.
- **Verification:** `bun run check`
- **Progress:** [x] Complete

### T6 — Unit tests for shared style primitives

- **Depends on:** T2, T3, T4, T5
- **Risk:** routine
- **Likely files:** `tests/styles-and-primitives.test.ts`
- **Must not touch:** `src/styles/*`
- **Implementation:**
    - Create `tests/styles-and-primitives.test.ts`.
    - Test that `buttonStyles`, `chicletStyles`, `cardStyles`, and `dialogStyles` are instances of Lit `CSSResult`.
    - Verify that `buttonStyles.cssText` contains `.btn` and `.btn-primary`.
    - Verify that `cardStyles.cssText` contains `.card` and `--surface`.
    - Verify that `chicletStyles.cssText` contains `.chiclet-purple`, `.chiclet-teal`, and `.chiclet-amber`.
- **Acceptance criteria:**
    - [x] All style primitive exports pass assertions in `bun:test`.
- **Verification:** `bun test tests/styles-and-primitives.test.ts`
- **Progress:** [x] Complete

## Verification and definition of done

- [x] All task acceptance criteria met.
- [x] `src/styles/tokens.css` contains all required tokens with no literal colors.
- [x] `buttonStyles`, `chicletStyles`, `cardStyles`, `dialogStyles` exported and tested.
- [x] `bun test tests/styles-and-primitives.test.ts` passes.
- [x] `bun run check` passes with 0 errors.

## Risks and open questions

- **Blocking:** None.
- **Non-blocking:** The chiclet specification is currently embedded in `card.md` rather than a standalone file under `specification/components/chiclet.md`; this plan follows the resolved values from `card.md §5.2` and `card.md §6`.

## Implementation and verification log

| When (UTC)           | Task | Outcome / commands / evidence                                                                                                                                                  |
| -------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-11-12T12:23:03Z | T1   | Complete. Created: src/styles/tokens.css; modified: index.html. Verified: bun test (1 pre-existing CSS test failure, 0 new), bun run check (20 pre-existing TS errors, 0 new). |
| 2026-11-12T12:34:51Z | T2   | Complete. Created: src/styles/button.styles.ts; modified: src/styles/tokens.css. Verified: bun run check (PASS with 0 errors, 13 tests passed).                                |
| 2026-11-12T12:36:12Z | T3   | Complete. Created: src/styles/chiclet.styles.ts. Verified: bun run check (PASS with 0 errors, 13 tests passed).                                                                |
| 2026-11-12T12:37:03Z | T4   | Complete. Created: src/styles/card.styles.ts. Verified: bun run check (PASS with 0 errors, 13 tests passed).                                                                   |
| 2026-11-12T12:38:25Z | T5   | Complete. Created: src/styles/dialog.styles.ts, src/styles/global.ts. Verified: bun run check (PASS with 0 errors, 13 tests passed).                                           |
| 2026-11-12T12:39:16Z | T6   | Complete. Created: tests/styles-and-primitives.test.ts. Verified: bun test (PASS 6 tests), bun run check (PASS with 0 errors, 19 tests passed).                                |

## Change log

| When (UTC)           | Change        | Reason                                  |
| -------------------- | ------------- | --------------------------------------- |
| 2026-11-12T11:37:44Z | Initial draft | Scaffolding tokens and style primitives |
