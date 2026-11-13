# Scaffolding: App Shell, Sidebar and Modals

**Status:** implemented | **Updated:** 2026-11-13T08:59:43Z

## Goal

**Current behaviour:** `src/app.ts` renders a static hello world header. There is no navigation sidebar, no welcome modal overlay, no static content modal, and no dynamic view outlet for workflow routes.

**Target behaviour:** A coordinated application shell where `<app-sidebar>` displays the 4-step workflow navigation, model sub-links, and footer links; `<app-welcome-modal>` displays on first load; `<app-content-modal>` renders reserved routes (`/about`, `/privacy`, `/help`) as top-layer native dialogs; and `src/app.ts` dynamically mounts workflow views into `<main>` while coordinating focus and scroll memory.

**Why:** Completes the visible application framework so that downstream feature teams can implement individual workflow views (`/data`, `/target`, `/models`, `/results`) in isolation.

## Scope

**In scope**

- Implement `<app-sidebar>` connected Lit component (`src/features/navigation/app-sidebar.ts`).
- Implement `<app-welcome-modal>` connected Lit component (`src/features/onboarding/app-welcome-modal.ts`).
- Implement `<app-content-modal>` connected Lit component (`src/features/navigation/app-content-modal.ts`).
- Assemble root shell in `src/app.ts` with dynamic view mounting in `<main>`.
- Browser acceptance tests in `tests/app-shell.test.ts` (Playwright) covering `NAV-E2E-1` through `NAV-E2E-4` and `NAV-E2E-9`.

**Out of scope**

- Implementing internal view logic for `/data`, `/target`, `/models/{num}`, or `/results` (covered by dedicated feature plans).
- Markdown-to-TS build script for content (covered in content pipeline plan).

**Constraints and invariants**

- Follow `specification/COMPONENTS.md §4`: Shadow DOM by default, one element per file, `@customElement` registration, no `unsafeHTML`, `StoreController` for store bindings.
- Modals must use native `<dialog>` and `showModal()` per `specification/app-state-and-navigation.md §5.4`.
- Sidebar links must be real `<a href>` elements; never disabled `<a>` tags (`app-state-and-navigation.md §4.3`).

## Required reading

The implementer reads only these, plus each task's likely files. Everything else is optional.

- `specification/app-state-and-navigation.md` §2, §4.3, §5.4, §5.5, §5.6 — layout regions, sidebar behaviour, reserved route modals, view mounting, and focus management.
- `specification/COMPONENTS.md` §1, §4, §5 — component tiers, Lit practices, and store controller bindings.
- `specification/plans/basic-html-structure.html` — canonical sidebar markup structure and icons.

## Codebase context

Facts the planner verified, so the implementer need not re-check them.

- **Relevant implementation:** `src/router/router.ts` exposes `$route` and navigation actions; `src/stores/app.store.ts` exposes `$appState` and actions.
- **Tests and commands:** Playwright runs browser E2E tests via `bunx playwright test`.
- **Web guidance:** Native `<dialog>` is widely supported; use `dialog.showModal()` and `dialog.close()`.
- **Known gaps decided:** Resolves Gap 1 (main layout) and Gap 4 (modals for content).
- **Assumptions requiring verification:** None.

## Technical decisions

| Decision             | Chosen approach and rationale                                                                       | Rejected alternative / trade-off                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Modal implementation | Native `<dialog>` with `.showModal()` and `.close()` per `app-state-and-navigation.md §5.4`.        | Custom overlay with focus trap; rejected because native dialog provides top layer and focus trapping natively. |
| View mounting        | Dynamic `import()` based on `$route` mapping; mount one view at a time in `<main>`.                 | Mounting all views with `display: none`; rejected to preserve code splitting and memory bounds.                |
| Focus management     | On user navigation, move focus to `.page-header h1` (`tabindex="-1"`, `preventScroll: true`).       | Resetting focus to document body; rejected because screen readers need announcement of the new view title.     |
| Sidebar model links  | Dynamically render sub-links under step 3 (`/models/{num}`) derived from `models[]` in `$appState`. | Static sidebar; rejected because workflow-steps requires multi-model direct access.                            |

### Interfaces and behaviour

Sidebar step items:

```html
<nav class="steps" aria-label="Workflow">
	<ol>
		<li class="step"><a href="/data">1. Load Data</a></li>
		<li class="step"><a href="/target">2. Set Target</a></li>
		<li class="step">
			<a href="/models">3. Train Models</a>
			<ul>
				...model links...
			</ul>
		</li>
		<li class="step"><a href="/results">4. Compare Results</a></li>
	</ol>
</nav>
```

## Specification changes

Applied retrospectively when the specs were reconciled with the code (2026-11-13).

- [x] `specification/workflow-steps.md` — the step URLs, sidebar and first-load welcome modal are built; status target → partial
- [x] `specification/app-state-and-navigation.md` §2, §5.4 — the layout regions and reserved-route modals are listed as implemented
- [x] Known gap 13 — records the shell's token, mockup and COMPONENTS drift
- [x] Known gap 14 — records the sidebar `aria-current` and focus behaviour

## Implementation tasks

### T1 — Implement app-sidebar component

- **Depends on:** None
- **Risk:** routine
- **Likely files:** `src/features/navigation/app-sidebar.ts`
- **Must not touch:** `src/styles/tokens.css`
- **Implementation:**
    - Create `src/features/navigation/app-sidebar.ts` defining `AppSidebar` custom element (`app-sidebar`).
    - Connect to `$appState` and `$route` using `StoreController`.
    - Render application title and tagline: "samatā.ml" | "Machine Learning in Your Browser".
    - Render project placeholder section with project name.
    - Render workflow `<nav aria-label="Workflow"><ol>` with steps 1–4.
    - Render step 3 model sub-links (`/models/{num}`) dynamically from `models[]`.
    - Render step summary text once choices are made (dataset name/rows/cols, target name/type).
    - Render footer links to `/about`, `/privacy`, `/help`.
    - Highlight active step using `aria-current="step"`.
- **Acceptance criteria:**
    - [x] `app-sidebar` custom element is registered and renders the 4 workflow steps.
    - [x] Completed steps display summary info.
    - [x] Step 3 displays model links when models exist.
    - [x] All links use real `<a href>` elements.
- **Verification:** `bun run check`
- **Progress:** [x] Complete

### T2 — Implement app-welcome-modal component

- **Depends on:** None
- **Risk:** routine
- **Likely files:** `src/features/onboarding/app-welcome-modal.ts`
- **Must not touch:** `src/router/*`
- **Implementation:**
    - Create `src/features/onboarding/app-welcome-modal.ts` defining `AppWelcomeModal` custom element (`app-welcome-modal`).
    - Connect to `$appState` using `StoreController`.
    - Use native `<dialog>` element.
    - When `onboarding.welcomeDismissed === false` and current route is a workflow route, open via `.showModal()`.
    - Provide explanation text and a "Get Started" `.btn.btn-primary` button.
    - Clicking "Get Started" calls `dismissWelcome()`, closing the dialog.
- **Acceptance criteria:**
    - [x] Dialog opens automatically on first load when `welcomeDismissed` is false.
    - [x] Clicking "Get Started" calls `dismissWelcome()` and closes the dialog.
- **Verification:** `bun run check`
- **Progress:** [x] Complete

### T3 — Implement app-content-modal component

- **Depends on:** None
- **Risk:** routine
- **Likely files:** `src/features/navigation/app-content-modal.ts`
- **Must not touch:** `src/styles/tokens.css`
- **Implementation:**
    - Create `src/features/navigation/app-content-modal.ts` defining `AppContentModal` custom element (`app-content-modal`).
    - Connect to `$route` using `StoreController`.
    - Use native `<dialog>` element with `aria-labelledby="content-modal-title"`.
    - Open via `.showModal()` when `$route.kind === 'reserved'`.
    - Provide a visible close button calling `closeReserved()`.
    - Listen to dialog `close` event and trigger `closeReserved()`.
    - Render static content corresponding to `/about`, `/privacy`, or `/help`.
- **Acceptance criteria:**
    - [x] Navigating to `/about`, `/privacy`, `/help` opens the content modal.
    - [x] Closing the modal via Esc, close button, or backdrop triggers `closeReserved()`.
- **Verification:** `bun run check`
- **Progress:** [x] Complete

### T4 — Assemble root shell and view outlet in src/app.ts

- **Depends on:** T1, T2, T3
- **Risk:** routine
- **Likely files:** `src/app.ts`
- **Must not touch:** `public/*`
- **Implementation:**
    - Update `src/app.ts` to coordinate `<app-sidebar>`, `<main id="content">`, `<app-welcome-modal>`, and `<app-content-modal>`.
    - Subscribe to `$route`: dynamically import and mount active route view into `<main>`.
    - Provide placeholder views for `/data`, `/target`, `/models`, `/results` with a `.page-header h1`.
    - When route changes via user action, focus `.page-header h1` with `{ preventScroll: true }`.
    - Trigger `restoreScroll()` after view settles.
- **Acceptance criteria:**
    - [x] `src/app.ts` renders sidebar, main outlet, and modals.
    - [x] Switching routes dynamically updates `<main>` without full page reload.
    - [x] Focus moves to the page heading after route change.
- **Verification:** `bun run check`
- **Progress:** [x] Complete

### T5 — Playwright browser tests for shell and navigation

- **Depends on:** T4
- **Risk:** routine
- **Likely files:** `tests/app-shell.test.ts`
- **Must not touch:** `src/*`
- **Implementation:**
    - Create Playwright test suite `tests/app-shell.test.ts`.
    - Implement `NAV-E2E-1`: navigating Data -> Target -> Models pushes history entries; Back/Forward re-renders correct step and restores scroll.
    - Implement `NAV-E2E-2`: loading `/` resumes last workflow path; loading unknown path replaces to `/data`.
    - Implement `NAV-E2E-3`: opening `/about` pushes entry; closing it leaves exactly one entry removed and underlay intact.
    - Implement `NAV-E2E-9`: deep link `/models/1` loads cleanly with correct root-absolute assets.
- **Acceptance criteria:**
    - [x] All Playwright E2E tests in `tests/app-shell.test.ts` pass across Chromium, Firefox, WebKit.
- **Verification:** `bunx playwright test tests/app-shell.test.ts`
- **Progress:** [x] Complete

## Verification and definition of done

- [x] All task acceptance criteria met.
- [x] `<app-sidebar>`, `<app-welcome-modal>`, `<app-content-modal>` implemented and connected.
- [x] `bun run check` passes with 0 errors.
- [x] `bunx playwright test tests/app-shell.test.ts` passes.
- [x] No unintended modifications outside task files.

## Risks and open questions

- **Blocking:** None.
- **Non-blocking:** Detailed markdown compilation for `/about`, `/privacy`, `/help` will be handled by the content pipeline plan; this plan implements structural modals with placeholder static text.

## Implementation and verification log

| When (UTC)           | Task | Outcome / commands / evidence                                                                                         |
| -------------------- | ---- | --------------------------------------------------------------------------------------------------------------------- |
| 2026-11-12T12:57:39Z | T1   | Complete. Created: src/features/navigation/app-sidebar.ts (<app-sidebar>). Verified: bun run check (48 tests pass).   |
| 2026-11-12T12:58:20Z | T2   | Complete. Created: src/features/onboarding/app-welcome-modal.ts (<app-welcome-modal>). Verified: bun run check.       |
| 2026-11-12T12:58:55Z | T3   | Complete. Created: src/features/navigation/app-content-modal.ts (<app-content-modal>). Verified: bun run check.       |
| 2026-11-12T13:00:06Z | T4   | Complete. Created: src/app.ts root shell, dynamic view mounting & focus handling. Verified: bun run check.            |
| 2026-11-12T13:16:00Z | T5   | Complete. Created: tests/app-shell.test.ts. Verified: bunx playwright test (4 passed), bun run check (48 pass, 0 TS). |

## Change log

| When (UTC)           | Change                                                 | Reason                                     |
| -------------------- | ------------------------------------------------------ | ------------------------------------------ |
| 2026-11-12T11:37:44Z | Initial draft                                          | Scaffolding app shell, sidebar, and modals |
| 2026-11-13T08:59:43Z | Added _Specification changes_, applied retrospectively | Spec reconciliation with the code          |
