# Scaffolding: Vanilla TS Router and Navigation

**Status:** archived | **Updated:** 2026-11-19T10:40:52Z

## Goal

**Current behaviour:** The application has no client-side routing. Navigation between steps does not update the URL or browser history stack. Scroll position is lost when switching views or refreshing.

**Target behaviour:** A lightweight, vanilla TypeScript router in `src/router/` manages browser history (`pushState`, `replaceState`, `popstate`), normalises URLs (`/data`, `/target`, `/models`, `/models/{num}`, `/results`, `/about`, `/privacy`, `/help`), exposes active route state via Nanostores, manages document titles, and restores per-step document and region scroll positions with viewport-width validation per `specification/app-state-and-navigation.md`.

**Why:** Real URLs and browser history enable bookmarking, deep linking, reload resumption, and back/forward navigation without monolithic framework router overhead.

## Scope

**In scope**

- Implement `src/router/route-parser.ts` (`parseRoute` and `ParsedRoute` types).
- Implement `src/router/router.ts` (`$route` store, `navigate`, `openReserved`, `closeReserved`, link interceptor, title updater).
- Implement `src/router/scroll-restorer.ts` (document scroll memory, restoration logic, user interruption abort).
- Unit tests in `tests/router-and-navigation.test.ts` implementing `NAV-AC-1`, `NAV-AC-2`, and `NAV-AC-4`.

**Out of scope**

- Mounting Lit views (covered in `scaffolding-app-shell.md`).
- Domain state storage (covered in `scaffolding-state-and-storage.md`).

**Constraints and invariants**

- Follow `specification/app-state-and-navigation.md §5.1`: Only the router module calls `history.pushState`, `history.replaceState`, or reads `location`.
- No redirect-based route guards (`app-state-and-navigation.md §4.1`): blocked pages explain what is missing rather than redirecting.
- Reserved routes (`/about`, `/privacy`, `/help`) are never persisted to `resumePath` (`NAV-AC-2`).
- Scroll snapshots must be ignored when `snapshot.viewportWidth !== window.innerWidth` (`NAV-AC-4`).

## Required reading

The implementer reads only these, plus each task's likely files. Everything else is optional.

- `specification/app-state-and-navigation.md` §1.1, §3, §4.1, §5, §8 — hybrid model, route table, navigation behaviour, and scroll memory.
- `specification/state-and-storage.md` §3 — `WorkflowPath`, `ScrollSnapshot`, and `PersistedScroll` schemas.

## Codebase context

Facts the planner verified, so the implementer need not re-check them.

- **Relevant implementation:** `src/router/` is established in the foundation plan.
- **Tests and commands:** `bun test` runs unit tests without browser dependencies.
- **Web guidance:** `history.scrollRestoration = 'manual'` is supported in all target browsers.
- **Known gaps decided:** Resolves the routing architecture defined in `ARCHITECTURE.md` and `app-state-and-navigation.md`.
- **Assumptions requiring verification:** None.

## Technical decisions

| Decision                     | Chosen approach and rationale                                                                  | Rejected alternative / trade-off                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Router architecture          | Vanilla TypeScript module with Nanostores `$route` atom.                                       | Third-party router library; rejected to keep footprint minimal and avoid framework lock-in.                      |
| Reserved routes              | Rendered in native dialog overlay over the active workflow view; entry carries `underlayPath`. | Dedicated standalone pages; rejected because user workflow context should not be unmounted.                      |
| Scroll restoration container | `document.scrollingElement` (the document scrolls, `<main>` is not an overflow container).     | Scrollable `<main>`; rejected by `app-state-and-navigation.md §8.1` to preserve native browser chrome behaviour. |
| Scroll viewport check        | Validate `snapshot.viewportWidth === window.innerWidth`; ignore snapshot if different.         | Always restore; rejected because responsive layout shifts render prior scroll offsets invalid.                   |

### Interfaces and behaviour

`ParsedRoute` definition:

```typescript
export type ParsedRoute =
	| { kind: 'root' }
	| { kind: 'workflow'; path: WorkflowPath; section: 1 | 2 | 3 | 4; modelNum?: number }
	| { kind: 'reserved'; path: '/about' | '/privacy' | '/help' }
	| { kind: 'unknown'; path: string };
```

## Specification changes

Applied retrospectively when the specs were reconciled with the code (2026-11-13).

- [x] `specification/app-state-and-navigation.md` — the status line lists the implemented and target parts; status stays draft (open questions)
- [x] `specification/ARCHITECTURE.md` — the history router and hydration order are listed as implemented
- [x] Known gap 14 — records where the router and predicates differ from the spec

## Implementation tasks

### T1 — Implement route parser

- **Depends on:** None
- **Risk:** routine
- **Likely files:** `src/router/route-parser.ts`, `src/types/routes.ts`
- **Must not touch:** `src/stores/*`
- **Implementation:**
    - Create `src/types/routes.ts` exporting route union types: `WorkflowPath`, `ReservedPath`, `ParsedRoute`, `HistoryEntryState`.
    - Create `src/router/route-parser.ts` exporting `parseRoute(pathname: string): ParsedRoute`.
    - Match `/` as root.
    - Match `/data`, `/target`, `/models`, `/results` as workflow routes.
    - Match `/models/{num}`: ensure `num` is a positive integer; if invalid, classify as unknown.
    - Match `/about`, `/privacy`, `/help` as reserved routes.
    - Strip trailing slashes. Classify all unrecognized paths as `{ kind: 'unknown', path }`.
- **Acceptance criteria:**
    - [x] `parseRoute` parses all canonical paths correctly.
    - [x] Invalid model numbers (e.g. `/models/0`, `/models/-1`, `/models/abc`) classify as unknown.
    - [x] Trailing slashes are handled without breaking.
- **Verification:** `bun test tests/router-and-navigation.test.ts`
- **Progress:** [x] Complete

### T2 — Implement router core and history management

- **Depends on:** T1
- **Risk:** routine
- **Likely files:** `src/router/router.ts`
- **Must not touch:** `src/features/*`
- **Implementation:**
    - Create `src/router/router.ts` exporting `$route` atom of `ParsedRoute`.
    - Set `history.scrollRestoration = 'manual'` during bootstrap.
    - Implement action functions:
        - `navigate(path: string, options?: { replace?: boolean })`
        - `openReserved(path: ReservedPath)`
        - `closeReserved()`
    - Implement click interception for same-origin `<a>` clicks: ignore modified clicks (`metaKey`, `ctrlKey`, `shiftKey`, non-primary button) or links with `target`/`download`.
    - Listen to `popstate` and update `$route` store synchronously without calling `pushState`.
    - Update `document.title` to `samatā.ml | {Page}` on route change.
    - Ensure reserved paths are never written to `resumePath` in `$appState`.
- **Acceptance criteria:**
    - [x] `$route` emits current route upon navigation.
    - [x] `navigate()` pushes history entries; duplicate navigation is a no-op.
    - [x] `closeReserved()` pops or replaces history cleanly.
    - [x] `document.title` is updated dynamically.
- **Verification:** `bun run check`
- **Progress:** [x] Complete

### T3 — Implement document scroll memory restorer

- **Depends on:** T2
- **Risk:** routine
- **Likely files:** `src/router/scroll-restorer.ts`
- **Must not touch:** `src/styles/*`
- **Implementation:**
    - Create `src/router/scroll-restorer.ts` tracking `liveScroll` via passive scroll listener.
    - Implement `recordCurrentScroll(routeKey: string)` updating `$scrollState`.
    - Implement `restoreScroll(routeKey: string, whenSettled?: Promise<void>): Promise<void>`:
        - Look up snapshot; if `snapshot.viewportWidth !== window.innerWidth`, abort and scroll to top.
        - Await view settlement if provided.
        - Call `window.scrollTo({ top, behavior: 'instant' })`.
        - Abort restoration immediately if user inputs scroll events (`wheel`, `touchstart`, `keydown`).
- **Acceptance criteria:**
    - [x] Scroll is saved under route key on navigation.
    - [x] Scroll is restored only when viewport width matches.
    - [x] User scroll input cancels pending restoration immediately.
- **Verification:** `bun run check`
- **Progress:** [x] Complete

### T4 — Router and scroll unit test suite

- **Depends on:** T1, T2, T3
- **Risk:** routine
- **Likely files:** `tests/router-and-navigation.test.ts`
- **Must not touch:** `src/router/*`
- **Implementation:**
    - Create `tests/router-and-navigation.test.ts`.
    - Implement `NAV-AC-1`: parseRoute classifies `/`, each workflow path, `/models/{num}` (valid, `0`, `-1`, `abc`, `1.5`), each reserved path, trailing slash, and unknown paths.
    - Implement `NAV-AC-2`: reserved paths never appear in `resumePath`; `resumePath` only holds workflow paths.
    - Implement `NAV-AC-4`: scroll snapshot usable only when `viewportWidth === window.innerWidth`; ignored (not deleted) otherwise.
- **Acceptance criteria:**
    - [x] Tests `NAV-AC-1`, `NAV-AC-2`, and `NAV-AC-4` pass in `bun:test`.
- **Verification:** `bun test tests/router-and-navigation.test.ts`
- **Progress:** [x] Complete

## Verification and definition of done

- [x] All task acceptance criteria met.
- [x] `bun test tests/router-and-navigation.test.ts` passes with zero failures.
- [x] `bun run check` passes with zero type errors.
- [x] No changes outside `src/router/` and `tests/router-and-navigation.test.ts`.

## Risks and open questions

- **Blocking:** None.
- **Non-blocking:** Testing real History API and popstate behaviors in detail requires browser emulation via Playwright; unit tests in `bun:test` validate pure parsing, state, and predicates.

## Implementation and verification log

| When (UTC)           | Task | Outcome / commands / evidence                                                                                             |
| -------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-12T12:52:45Z | T1   | Complete. Created: src/types/routes.ts & src/router/route-parser.ts. Verified: bun run check (PASS 0 errors, 33 tests).   |
| 2026-11-12T12:53:56Z | T2   | Complete. Created: src/router/router.ts ($route, navigate, openReserved, closeReserved). Verified: bun run check.         |
| 2026-11-12T12:54:38Z | T3   | Complete. Created: src/router/scroll-restorer.ts (scroll memory & restoration). Verified: bun run check.                  |
| 2026-11-12T12:56:01Z | T4   | Complete. Created: tests/router-and-navigation.test.ts (NAV-AC-1, NAV-AC-2, NAV-AC-4). Verified: bun run check (48 pass). |

## Change log

| When (UTC)           | Change                                                 | Reason                                                |
| -------------------- | ------------------------------------------------------ | ----------------------------------------------------- |
| 2026-11-12T11:37:44Z | Initial draft                                          | Scaffolding router, history manager and scroll memory |
| 2026-11-13T08:59:43Z | Added _Specification changes_, applied retrospectively | Spec reconciliation with the code                     |
