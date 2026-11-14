# Architecture Specification: Application State & Navigation (Hybrid Router + Store)

**Status:** draft — open questions in §12 (Q1b, Q1c, Q2 and Q4 answered). Implemented: route parsing and types, router history and titles, reserved-route modals, availability predicates, §4.3 blocked reasons, §4.4 sidebar aria-current, §5.1 click interception (including shadow roots), §5.3 underlayPath, §5.6 focus rules, §6.1/§6.3/§6.4 unchanged-edit rule and action validation, §8.4 scroll saving and invalidation, the §10 store actions, and scroll keys and the width rule. Target: route views, the Compare Results control, confirm dialogs, whenSettled (§5.5, §8.4), dynamic view mounting, the training lock and the service worker. Code that differs from this spec is listed in [Known gaps](README.md#known-gaps) 14.

> **History:** Replaces the previous five-step, single-FSM design (formerly `plans/finite-state-machine.md`; moved and renamed 2026-11-12).
>
> **Source of truth:** [workflow-steps.md](workflow-steps.md) defines the user-facing workflow. If this document disagrees with it, `workflow-steps.md` wins and this document must be corrected.
>
> **Companion document:** [state-and-storage.md](state-and-storage.md) owns _persistence mechanics_ (storage keys, the persisted schema, write scheduling, IndexedDB reconciliation, multi-tab behaviour). This document owns _navigation, routing, step behaviour, scroll memory and state transitions_. Do not duplicate content between them; link instead.

---

## 1. Overview & Architectural Goals

The application is a browser-based machine learning workflow with four top-level sections (Load Data, Set Target, Train Models, Compare Results). Training happens in the browser through the `web-ml` library; this repository only builds the configuration payload (see [ARCHITECTURE.md](ARCHITECTURE.md)).

### 1.1 The hybrid model

Application state is split by what it answers:

| Question                                                                                                       | Source of truth                                             | Mechanism                                                                                  |
| :------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------- | :----------------------------------------------------------------------------------------- |
| _Where is the user?_ (which step, which model)                                                                 | The URL                                                     | History API (`pushState` / `replaceState` / `popstate`)                                    |
| _What has the user done and chosen?_ (dataset, target, models, step progress, UI selections, scroll positions) | The persisted store                                         | Nanostores + `localStorage` / IndexedDB (see [state-and-storage.md](state-and-storage.md)) |
| _What overlay is showing?_ (About, Privacy, Help)                                                              | The URL, but **never persisted**                            | History API with a reserved-route entry on top of the workflow entry                       |
| _Where is training up to?_                                                                                     | Two small state machines (model lifecycle §7, training run) | Pure reducers in the store module                                                          |

A single application-wide finite state machine is **no longer used**. The previous design forced every URL, validation rule and UI region through one `value` enum; the new workflow has real URLs, per-model sub-flows (`/models/{num}`) and several models living side by side, which a single enum cannot express without a combinatorial explosion of states.

### 1.2 Goals

1. **G1 – Deep-linkable.** Every workflow step and every model has a stable URL that can be bookmarked, reloaded and opened in a new tab.
2. **G2 – Native-app feel.** Browser Back/Forward move between workflow pages; each step remembers its own scroll position.
3. **G3 – Exact resume.** Reloading the tab, or opening the base URL (`/`) in a new tab, shows the same UI the user last saw (§9).
4. **G4 – Transient overlays stay transient.** `/about`, `/privacy` and `/help` live in browser history but are never written to persisted state.
5. **G5 – Headless, testable logic.** Route parsing, guards, reducers, scroll-compatibility checks and hydration/reconciliation are pure TypeScript with an injectable `Storage`, unit-testable under `bun:test` without a DOM.
6. **G6 – No training logic here.** Unchanged: this layer only builds configuration and dispatches to `web-ml`.

### 1.3 What is retained from the FSM design

- Strongly typed actions as the _only_ way to change state; reducers are deterministic and synchronous.
- Async work (CSV ingestion, `web-ml` training) lives in services that dispatch success/failure actions back into the store.
- Injectable storage adapter; strict immutability (never mutate arrays/objects in place).
- Interrupted-training recovery on reload (§9.3).
- Downstream-preservation rules when an earlier choice changes (§6.4), adapted from the "preservation matrix".

### 1.4 What is dropped

| Dropped                                                                                  | Replaced by                                                                                                    |
| :--------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------- |
| `AppStateValue` enum (`step1.loadData`, …) and `NAVIGATE_TO_STEP` event                  | URL + router (§5)                                                                                              |
| Bottom `<banner>` with a progression button                                              | Per-section `Continue` / `Train Model` / `View Results` buttons in each section `<header>` (workflow-steps §3) |
| Sidebar steps disabled until prior steps complete                                        | Always-navigable steps; pages that cannot display yet show a `.notification` explaining why (§4)               |
| "Paste URL" dataset input                                                                | Not in workflow-steps; sample datasets and CSV upload only                                                     |
| Single global `selectedModelId` / `selectedFeatures` / `hyperparameters` / `methodology` | One `ModelRecord` per model, keyed by `num` (§6.3)                                                             |
| `trainingRounds` + `activeResultsTab`                                                    | `models[]` with `status: 'trained'`; `/results` is its own URL (§6.5)                                          |
| `isTargetLocked`                                                                         | Confirm-and-discard when the target or dataset changes while models exist (§6.4)                               |
| A step 5 labelled "Analyse Results" / five sidebar items                                 | Four sections, per workflow-steps                                                                              |

---

## 2. Layout Regions

The layout has three regions plus overlays. There is **no `<app-root>` wrapper** and **no bottom banner**.

```
┌───────────────┬────────────────────────────────────────────┐
│ <app-sidebar> │ <main>                                      │
│  title        │   .page-header  (h1, description, actions)  │
│  <nav><ol>    │   <section> … route view mounted here …     │
│   1 Load Data │                                              │
│   2 Target    │                                              │
│   3 Models    │   (document scrolls; <main> is NOT a        │
│      · Model 1│    scroll container — see §8.1)             │
│      · Model 2│                                              │
│   4 Compare   │                                              │
│  footer:      │                                              │
│   about|privacy|help                                         │
└───────────────┴────────────────────────────────────────────┘
  Overlays (native <dialog>, top layer):
    <app-welcome-modal>   first load only, no URL
    <app-content-modal>   reserved routes /about /privacy /help
    transient modals      datasheet, upload, model description (no URL, not persisted)
```

- **`<app-sidebar>`** (connected component): application title, `<nav aria-label="Workflow"><ol>` with the four steps, the list of models under step 3 (one link to `/models/{num}` per model, as in `mockups/ui-scaffold/03-2`), and the footer links to the reserved routes. Each step shows a summary of its choice once made (dataset name and size, target name and type) as in the scaffold.
- **`<main>`** (native element): the router mounts the active route view here. Views are dynamically imported (ARCHITECTURE.md → code splitting).
- **`<app-welcome-modal>`** (connected): shown when `onboarding.welcomeDismissed === false` and the current route is a workflow route. "Get Started" closes it and persists the flag. It has no URL and creates no history entry.
- **`<app-content-modal>`** (connected): renders static Markdown content for a reserved route (§5.4).

Component names above are proposals that follow the `app-` prefix rule in [COMPONENTS.md §1](COMPONENTS.md); each still needs its own component spec under `specification/components/` before implementation (COMPONENTS.md §3, §12).

---

## 3. Route Table

| Path            | Section  | Sidebar label              | View                                         | Notes                                                                                                                                                       |
| :-------------- | :------- | :------------------------- | :------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`             | –        | –                          | none (redirect)                              | Resolves to the resume path (§9.2) with `replaceState`.                                                                                                     |
| `/data`         | 1        | Load Data                  | Dataset picker **or** dataset preview (§6.1) | Default resume path on first load.                                                                                                                          |
| `/target`       | 2        | Set Target                 | Column table (§6.2)                          | Always reachable. Shows a `.notification` instead of the table if no dataset is loaded (§4.3).                                                              |
| `/models`       | 3        | Train Models               | Table of models + "new model" action (§6.3)  | Always reachable. Shows a `.notification` if dataset or target is missing. Header holds **Compare Results** (disabled until ≥ 2 trained models).            |
| `/models/{num}` | 3        | `Model {num}` under step 3 | Six-section model builder (§6.3, §7)         | `num` is a positive integer, assigned at creation, never reused. A well-formed `num` with no model shows a "model not found" `.notification` (no redirect). |
| `/results`      | 4        | Compare Results            | Cross-model comparison (§6.5)                | Always reachable. Shows a `.notification` if fewer than two models are trained.                                                                             |
| `/about`        | reserved | footer                     | Static content modal                         | Never persisted.                                                                                                                                            |
| `/privacy`      | reserved | footer                     | Static content modal                         | Never persisted.                                                                                                                                            |
| `/help`         | reserved | footer                     | Static content modal                         | Never persisted.                                                                                                                                            |
| anything else   | –        | –                          | none (redirect)                              | `replaceState` to the resume path plus a transient notification.                                                                                            |

Rules:

- Matching is on `location.pathname` only. Query strings and hashes are ignored, not generated and not persisted. A trailing slash is normalised away by `replaceState`.
- A `/models/{segment}` where `segment` is not a positive integer is an **unknown path** (it does not name a page) and is redirected like any other. A positive integer with no matching model is a valid page URL whose content is the "model not found" notification (§4.3); it is not redirected.
- Reserved paths are exactly `/about`, `/privacy`, `/help`. Reserved paths MUST NOT be used for anything else in future.
- Each reserved path maps to one page id via `RESERVED_CONTENT` in `src/router/reserved-content.ts` (`/about` → `about`, `/privacy` → `privacy-policy`, `/help` → `help`), compiled by the content pipeline (see [content-and-i18n.md](content-and-i18n.md)). The mapping lives in router configuration, not in content front matter.

### 3.1 Types

```typescript
export type SectionNumber = 1 | 2 | 3 | 4;

export type ReservedPath = '/about' | '/privacy' | '/help';

export type WorkflowPath = '/data' | '/target' | '/models' | `/models/${number}` | '/results';

export type ParsedRoute =
	| { kind: 'root' }
	| { kind: 'workflow'; path: WorkflowPath; section: SectionNumber; modelNum?: number }
	| { kind: 'reserved'; path: ReservedPath }
	| { kind: 'unknown'; path: string };

/** The only data written to `history.state` by the app. Domain state NEVER goes here. */
export interface HistoryEntryState {
	v: 1;
	/** Random id so tests and the router can tell entries apart. */
	entryId: string;
	/** Present only on reserved-route entries: the workflow page rendered underneath. */
	underlayPath?: WorkflowPath;
}
```

---

## 4. Navigation Is Never Blocked; State Decides What Is Shown

> **Principle.** The user can always navigate to any workflow page, by sidebar, link, typed URL, bookmark, or Back/Forward. Application state **never prevents, redirects or undoes** a navigation to a workflow page. State only decides _what that page displays_. A page that cannot yet show anything renders a `.notification` that explains, in plain English, why and what to do next.

### 4.1 Consequences

- There are **no availability guards** in the router and no disabled or non-link sidebar entries. Every sidebar step is a real `<a href>`.
- The only redirects the router performs are for URLs that do not name a page at all, never for state reasons:
    1. `/` → resume path.
    2. Unknown paths (including `/models/abc`, `/models/0`, `/models/1.5`) → resume path, with a transient notification.
       Both use `replaceState`, so Back never loops.
- A well-formed model URL for a model that does not exist (`/models/9`) **stays on that URL** and renders the "model not found" notification below. The same happens reactively if the model is discarded while it is on screen (another tab, §6.4).
- When state changes while a page is open (another tab replaces the dataset, models are discarded), the page re-renders into its blocked state in place. It is never navigated away.

### 4.2 Derived predicates

Pure, derived values over the persisted state (computed stores; never derived in `render()`):

| Predicate       | Definition                                   |
| :-------------- | :------------------------------------------- |
| `hasDataset`    | `dataset !== null`                           |
| `hasTarget`     | `hasDataset && target !== null`              |
| `trainedModels` | `models.filter(m => m.status === 'trained')` |
| `canCompare`    | `trainedModels.length >= 2`                  |

`blockedReason(route, state)` is a single pure function returning `null` (page can render) or a `BlockedReason` identifying the first unmet prerequisite. Views call it through a computed store; they do not re-implement the checks.

### 4.3 Blocked-state matrix

The blocked view replaces the page body (the `.page-header` with title and description still renders so the user knows where they are). It is a `<section>` containing one `.notification.notification-alert` with the message and a link to the step that fixes the problem. The first unmet prerequisite wins.

| Route           | Blocked when               | Message (English; i18n key per COMPONENTS.md §8)                                                   | Link                       |
| :-------------- | :------------------------- | :------------------------------------------------------------------------------------------------- | :------------------------- |
| `/target`       | `!hasDataset`              | "Load a dataset before choosing a target."                                                         | Load Data → `/data`        |
| `/models`       | `!hasDataset`              | "You need to load a dataset and set a target variable before you can train a model."               | Load a dataset → `/data`   |
| `/models`       | `hasDataset && !hasTarget` | "You need to set a target variable before you can train a model."                                  | Set a target → `/target`   |
| `/models/{num}` | no model with that `num`   | "Model {num} doesn't exist. It may have been removed when the dataset or target variable changed." | Back to models → `/models` |
| `/models/{num}` | model exists               | never blocked                                                                                      | –                          |
| `/results`      | `!canCompare`              | "You need to train more than one model before you can compare results."                            | Train models → `/models`   |
| `/data`         | never                      | –                                                                                                  | –                          |

Notes:

- `/models` when `!hasDataset` and when `!hasTarget` show different messages deliberately: each says only what is actually missing next.
- This replaces the "warning bar" wording for `/target` in workflow-steps §2 with the same `.notification` component used elsewhere, so every blocked page looks and behaves the same. Confirm in §12 if the distinct "warning bar" is intended.
- Messages describe the cause and the remedy. They never say "access denied" or similar, because nothing is being denied.
- Blocked views contain no dead controls: the "new model" action, model table, column table and comparison are simply not rendered.
- The notification has `role="status"` (it is informative, not an interruption) and is not focused on navigation; focus goes to the `<h1>` as for any route (§5.6).

### 4.4 Sidebar and shortcuts

- All four section entries, and every model under step 3, are always links. Entries may _indicate_ progress (the dataset name, the target and its type, a check mark) but never disable.
- **Current location is marked, not removed.** The entry whose `href` equals the current workflow path is `<a href="…" aria-current="page">`. An entry for a section that contains the current page but is not the page itself (e.g. "Train Models" while on `/models/3`) is `aria-current="true"`. There is never more than one `aria-current="page"` at a time. `aria-current="step"` is not used: these are links to URLs, so `page` is the correct announcement.
- Current entries are styled as inactive (visual state keyed off `[aria-current]`, `cursor: default`) but remain focusable, keep their `href`, and keep a `:focus-visible` outline. Activating one is a no-op in the router (§5.2): no history entry, no scroll change. This preserves keyboard focus when the sidebar re-renders reactively, keeps the section link usable from a model page, and keeps the link list a reliable map for screen reader users.
- The `ui-scaffold` mock-ups that render the current step as a non-link `<div>` are superseded by this rule and should be updated.
- **Deliberate exception: the Compare Results button.** The **Compare Results** button in the `/models` header is disabled until `canCompare`, as specified in workflow-steps §3, and this is a **deliberate design choice, not an oversight**. The principle in §4 is about _navigation_: where the user may go. The button is a _call to action_ that invites the user to go and compare, and inviting them when there is nothing to compare would be misleading. The two are kept separate on purpose:
    - `/results` is always reachable from the sidebar and by URL, and explains itself with the §4.3 notification.
    - The button is the only control in the application that is disabled because of workflow state. New controls MUST NOT copy this pattern for navigation; a disabled call to action needs the same justification and an entry here.
    - Accessibility: a native `<a>` cannot be disabled, so the control is a `<button type="button" disabled>` while `!canCompare` and an `<a href="/results">` styled as a button when `canCompare`. Disabled buttons are skipped by keyboard focus and give no explanation, so a visible, always-rendered hint (not a tooltip) sits beside it and is the button's `aria-describedby`: "Train more than one model to compare results." The hint is replaced by nothing (hidden with the same layout space reserved) once enabled.

---

## 5. Navigation Behaviour

### 5.1 Ownership

- Only the router module (`src/router/`) may call `history.pushState`, `history.replaceState`, `history.back()` or read `location`. Components render real `<a href>` elements; the router intercepts same-origin clicks (using `event.composedPath()` so that anchors inside Shadow DOM components are intercepted reliably) and ignores modified clicks (`ctrl`/`meta`/`shift`/non-primary button, `target`, `download`) so "open in new tab" keeps working.
- The router exposes the current parsed route as a nanostore (`$route`) and navigation as actions (`navigate`, `openReserved`, `closeReserved`). Components import these through connected components only (COMPONENTS.md §5).
- At bootstrap the router sets `history.scrollRestoration = 'manual'`; scroll is managed by §8.

### 5.2 `pushState` vs `replaceState`

| Situation                                                                 | History call                               |
| :------------------------------------------------------------------------ | :----------------------------------------- |
| User navigates to a different workflow path                               | `pushState`                                |
| User navigates to the path already shown                                  | no-op (no duplicate entry)                 |
| "New model" creates a model and opens it                                  | `pushState` to `/models/{num}`             |
| Open a reserved route from a workflow page                                | `pushState` (entry carries `underlayPath`) |
| Reserved → reserved (link inside a modal)                                 | `replaceState` (never stack two overlays)  |
| Close a reserved route opened in this document                            | `history.back()`                           |
| Close a reserved route that was loaded directly (no in-app entry beneath) | `replaceState` to the underlay path        |
| Root redirect, unknown path (never for state reasons, §4.1)               | `replaceState`                             |

### 5.3 `popstate`

1. Parse `location.pathname`.
2. Workflow route → mount its view (§5.5), restore its remembered scroll (§8.4).
3. Reserved route → read `history.state.underlayPath` (fall back to the persisted resume path), ensure the underlay is mounted, open the modal.
4. Arriving at a non-reserved route while a modal is open → call `dialog.close()` **without** triggering `closeReserved` (guard with an `isSyncingFromHistory` flag so `close` does not push or pop history again).
5. Never call `pushState` from the `popstate` handler.

### 5.4 Reserved routes as modals

- Content is rendered in a native `<dialog>` opened with `showModal()` (not `show()` or the `open` attribute). Invoker commands (`command="show-modal"`) are _not_ Baseline Widely available, so they are not used; the router opens the dialog from script. No `role="dialog"`, `aria-modal`, focus trap or `Esc` handler is added; the platform provides them.
- The dialog is named with `aria-labelledby` pointing at its heading (`<h1>`, carrying the entry's `lang` and `dir` once loaded) and contains a visible, natively labelled close button. If the page fails to load, the dialog body displays an alert (`role="alert"`) while keeping the close button working.
- Dismissal: `Esc` and the mobile back gesture (modal default) and the close button. Light-dismiss (`closedby="any"`) is permitted as progressive enhancement only (Safari lacks it).
- Every dismissal path funnels into the dialog's `close` event, which calls `closeReserved()` per §5.2. This matters for the back gesture on Android, where the browser closes the dialog _instead of_ navigating: without the router calling `history.back()` the stale `/about` entry would be left on the stack.
- The page underneath is **not** scroll-locked with `overflow: hidden` / `position: fixed` on `html` or `body` (that would reset or jump the scroll position this spec is trying to preserve). Use `overscroll-behavior: contain` on `dialog:modal` and `overflow: hidden; overscroll-behavior: contain` on `dialog::backdrop`.
- The underlay view stays mounted while the modal is open, so the workflow page's DOM, scroll position and focus return are unaffected.
- A reload while a reserved route is open reopens the modal over the persisted resume path (§9.2). The reserved path itself is **never** written to persisted state.
- If the user first lands on a reserved URL, the welcome modal is not shown on top of it; it appears when the reserved modal is closed (if still undismissed).

### 5.5 Mounting views

- A view is a Lit element created via dynamic `import()` for its route. The router keeps at most one workflow view mounted. Switching steps unmounts the previous view; its state lives in the store, not in the element.
- A view that needs async data before its layout height is final (dataset metadata, table row count, results) MUST expose `whenSettled(): Promise<void>`, resolving once layout is stable. The scroll restorer waits on it (§8.4). _(This is part of the view contract and must be added to each view's component spec.)_

### 5.6 Document title and focus

- On every route change the router sets `document.title` to `samatā.ml | {Page}` (e.g. `samatā.ml | Train Models`, `samatā.ml | Model 3`, `samatā.ml | About`), so history entries are distinguishable in the browser's history list and by screen readers.
- After a workflow route change initiated by the user, focus moves to the `<h1>` in `.page-header` (`tabindex="-1"`, `focus({ preventScroll: true })`). It does **not** move on hydration/reload or while restoring scroll, and never when `popstate` was caused by closing a modal (the dialog returns focus to its invoker itself).

### 5.7 Hosting and asset URLs

Because step URLs are real paths, deep links and reloads request e.g. `/models/3` from the server:

- Production (`wrangler.jsonc`) already uses `"not_found_handling": "single-page-application"`; keep it.
- The dev/static server (`scripts/static-server.ts`) falls back to `index.html` for any missing file. Acceptable for routes, but it also returns HTML for a missing `.js`/`.css`; restrict the fallback to extension-less paths.
- `index.html` MUST reference assets with root-absolute URLs (`/styles.css`, `/app.js`). The current relative references (`styles.css`, `app.js`) break at `/models/3`.
- The Service Worker (ARCHITECTURE.md) MUST answer navigation requests for any workflow or reserved path with the cached `index.html` app shell.

---

## 6. Step Behaviour

### 6.1 Section 1 — Load Data (`/data`)

Corresponds to workflow-steps §1.

- **Sub-view** is `data.mode` (`'select' | 'preview'`), a persisted value (not derived), so the exact view survives reloads:
    - `'select'`: sample dataset cards from the generated sample-dataset catalogue ([sample-datasets.md](sample-datasets.md)) and the **Upload Dataset** header button.
    - `'preview'`: dataset header, virtual table, and the column-details `<aside>`.
- On successful ingestion (`loadDatasetSucceeded`) the store sets `dataset`, `data.mode = 'preview'`, `data.selectedColumn = null`.
- `data.selectedColumn` (the column whose `<aside>` is open) is persisted. Column statistics themselves are read from the IndexedDB `metadata` store, never from `localStorage`.
- The virtual table's own scroll offset is persisted as a scroll _region_ (§8.3).
- Transient and **not** persisted: the Datasheet modal, the Upload modal, in-flight parsing progress, validation errors from a failed upload. A reload during ingestion lands on `'select'` (the previous dataset, if any, is untouched until the new one completes; see [state-and-storage.md §6](state-and-storage.md#6-indexeddb-reconciliation)).
- **Change Dataset.** A header action **Change Dataset** on the preview view opens a confirmation modal before discarding the active dataset. On user confirmation, the action `clearDataset()` resets `dataset = null`, `data.mode = 'select'`, `data.selectedColumn = null`, clears `target = null`, `models = []`, `nextModelNum = 1`, and clears remembered table scroll regions. If cancelled, all state remains intact.

**Dataset change reconciliation** (`loadDatasetSucceeded` when a dataset already exists):

- If the new dataset has the same `id` **and** identical column names and types: nothing downstream changes.
- Otherwise: `target = null`, `models = []`, `nextModelNum = 1`, `data.selectedColumn = null`, and every scroll snapshot except `/data` is cleared. If `models.length > 0` the user must first confirm the discard (§6.4).

### 6.2 Section 2 — Set Target (`/target`)

Corresponds to workflow-steps §2.

- Table rows: Column Name (`<th scope="row">`), Type (`<code>Numeric</code>`, `<code>Categorical</code>`, `<code>Boolean</code>`, `<code>Text</code>`, `<code>Datetime</code>`), Notes, and Action.
- Eligibility: Text, datetime, all-missing, and constant columns are disqualified and show disabling explanatory notes. Identifier hints, missing-value counts, high cardinality, and descriptor suggestions provide advisory guidance while remaining selectable.
- Action buttons:
    - Active target shows a disabled button reading "Current Target".
    - Eligible candidate columns show a primary button reading "Set as Target".
    - Disqualified columns show a disabled button reading "Set as Target".
- `setTarget(column)` stores `target`. If models exist and the selected column differs from the current target, the user must confirm discarding all models first (§6.4).
- Selecting the already-active target is a no-op that never opens a modal or alters models.
- Setting the target updates state and keeps the user on `/target`; a "Train Models" button (`<a href="/models" class="btn btn-primary">`) in the page header enables progressing to Step 3.
- Without a dataset a `.notification` replaces the table body (§4.3).

### 6.3 Section 3 — Train Models (`/models`, `/models/{num}`)

Corresponds to workflow-steps §3.

**`/models`** (requires `hasTarget`): table of all models with columns _Model Name, Features, Configuration, Training Setup, Duration, View Results_, all derived from `ModelRecord`. The action cell reads **View Results** for `status === 'trained'` and **Continue** otherwise, linking to `/models/{num}`. The header holds the **Compare Results** button (link to `/results`, disabled while `!canCompare`) and the action that creates a model: `createModel()` allocates `num = nextModelNum`, increments `nextModelNum`, appends a draft `ModelRecord`, then the router pushes `/models/{num}`.

**`/models/{num}`** shows six sections, in order, as a series down one page:

| #   | Section id           | Completion trigger                            | Header `<h2>` after completion                |
| :-- | :------------------- | :-------------------------------------------- | :-------------------------------------------- |
| 1   | `choose-model`       | **Continue** after a model is selected        | Selected model name                           |
| 2   | `select-features`    | **Continue** with ≥ 1 feature                 | "{n} features"                                |
| 3   | `configure-model`    | **Continue** once all hyperparameters are set | "Model Configured" or "Hyperparameter Tuning" |
| 4   | `configure-training` | **Train Model**                               | Chosen training setup                         |
| 5   | `training`           | Training finishes                             | "Training Complete"                           |
| 6   | `results`            | **View Results**                              | –                                             |

When a section completes, its button is replaced by the `#check` icon and `.train-step-complete` is added to its `.train-step`. This presentation is a pure function of `ModelRecord.completedSteps`; no component keeps its own "completed" flag.

Model-level rules:

- **Eligible models** are filtered by the target type: classifiers for `boolean`/`categorical`, regressors for `numeric` (workflow-steps §3.1).
- **Features**: all columns are listed; the target is shown but not selectable; ineligible (`text`) columns are not selectable. The target can never be in `features`.
- **Multiclass strategy** (`native | one-vs-rest | one-vs-one`) is required only when the target is categorical with more than two categories _and_ the `web-ml` model supports the choice. It is part of section 3.
- **Training setup** (section 4) is a placeholder: workflow-steps marks it "TODO". Until specified, the shape is the `ValidationMethodology` union in [state-and-storage.md](state-and-storage.md#3-persisted-schema), defaulting to nested cross-validation.
- **Editing earlier sections**: while `status === 'draft'`, a completed section can be re-opened and edited. If the edit **changes** its value, completion of all _later_ sections is removed (their values are kept where still valid and the user re-confirms with Continue). Re-selecting the same model, or re-confirming unchanged values, invalidates nothing. Selecting a **different** model resets `modelOptions`, `hyperparameters` and `multiclass` to the new model's defaults and un-completes sections 2 and 3; `features` and `trainingSetup` are kept.
- **Frozen configuration.** Once a model leaves `draft` (training starts), sections 1–4 are read-only so the configuration shown in `/models` and `/results` is exactly what was trained. To try different settings the user creates a new model.

### 6.4 Changing the dataset or target while models exist

The previous design locked the target once any round was trained. With several independently configured models and a freely changeable dataset, a lock would trap the user. Instead:

- `setTarget` (different column) or `loadDatasetSucceeded` (different dataset) on a project with `models.length > 0` requires an explicit confirmation dialog stating how many models, including trained results, will be discarded.
- On confirm: `models = []`, `nextModelNum = 1`, associated IndexedDB results are deleted, scroll snapshots for `/target`-dependent pages (`/models`, `/models/*`, `/results`) are cleared.
- On cancel nothing changes.
- If the dataset changes while the target confirmation modal is open, the modal cancels safely with no mutation.
- If the current route is `/models/{num}` the URL is left alone and the page re-renders into the "model not found" notification (§4.3).

### 6.5 Section 4 — Compare Results (`/results`)

Corresponds to workflow-steps §4, which is still marked TODO. This document defines only what the state layer must guarantee:

- Inputs are `models.filter(status === 'trained')` and their stored results.
- Any user-controlled UI state on the page (selected metric, compared models, tab) follows the general rule in [state-and-storage.md §5](state-and-storage.md#5-ui-state-persistence-rule) and is persisted under `results.ui`; its shape is defined when the section 4 and section 6 specs are completed.

---

## 7. Model Lifecycle (Small State Machine)

A model's lifecycle is the one genuinely sequential flow, so it keeps a minimal explicit state machine.

```typescript
export type ModelStatus = 'draft' | 'training' | 'trained';
```

| Current status | Action                                 | Next status | Guard                                              | Mutation                                                                                                                                       |
| :------------- | :------------------------------------- | :---------- | :------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------- |
| `draft`        | `startTraining`                        | `training`  | sections 1–3 complete and `trainingSetup !== null` | `error = null`; `progress = { percent: 0, statusMessage: 'Initializing...' }`; complete `configure-training`; acquire the training lock (§7.1) |
| `training`     | `updateTrainingProgress`               | `training`  | none                                               | Update `progress` (persistence throttled)                                                                                                      |
| `training`     | `trainingSucceeded`                    | `trained`   | none                                               | `progress = null`; `error = null`; store `metrics`, `timings`, `durationMs`; write detailed results to IndexedDB; complete `training`          |
| `training`     | `trainingFailed`                       | `draft`     | none                                               | `progress = null`; `error = { code: 'TRAINING_FAILED', … }`; un-complete `configure-training`, `training`, `results`                           |
| `training`     | `cancelTraining`                       | `draft`     | none                                               | `progress = null`; `error = { code: 'TRAINING_CANCELLED', … }`; un-complete `configure-training`, `training`, `results`                        |
| `training`     | `recoverInterrupted` (on hydrate only) | `draft`     | training lock not held by any tab                  | `progress = null`; `error = { code: 'TRAINING_INTERRUPTED_BY_RELOAD', … }`; un-complete `configure-training`, `training`, `results`            |
| `trained`      | `viewResults`                          | `trained`   | none                                               | Complete `results`                                                                                                                             |

After `trainingFailed` / `cancelTraining` / `recoverInterrupted` the model is a draft with sections 1–3 complete and section 4 active with the error visible beside the **Train Model** button (matching the "Continue" behaviour in workflow-steps §3).

```typescript
export interface TrainingError {
	code: 'TRAINING_FAILED' | 'TRAINING_CANCELLED' | 'TRAINING_INTERRUPTED_BY_RELOAD';
	message: string;
	timestamp: number;
	details?: string;
}

export interface TrainingProgress {
	percent: number; // 0..100
	currentFold?: number;
	totalFolds?: number;
	statusMessage: string;
}
```

### 7.1 Training lock

While a model trains, the tab that owns the `web-ml` worker holds a [Web Lock](https://developer.mozilla.org/docs/Web/API/Web_Locks_API) named `samata-ml:training:{num}` for the run's duration. The browser releases it automatically if the tab closes or crashes. This lets a freshly loaded tab distinguish "training in another tab" (lock held) from "training was interrupted" (lock free). Details in [state-and-storage.md §7](state-and-storage.md#7-multi-tab-behaviour). _(Confirm the API against the project's Baseline target with `modern-web-guidance` before implementing.)_

---

## 8. Scroll Memory

Goal G2: each workflow step remembers its own scroll position, and a new tab or reload resumes it.

### 8.1 Scroll container

The **document** scrolls (`document.scrollingElement`). `<main>` MUST NOT be `overflow: scroll|auto` with a fixed height, and the sidebar is `position: fixed` (as in the scaffold). This keeps mobile browser chrome behaviour, keyboard scrolling, find-in-page and focus-into-view native. Inner scrollers (the virtual table, wide tables) are tracked as named **regions** (§8.3).

### 8.2 Scroll keys

One snapshot is kept per key, latest write wins:

| Route             | Key            |
| :---------------- | :------------- |
| `/data` (picker)  | `data:select`  |
| `/data` (preview) | `data:preview` |
| `/target`         | `target`       |
| `/models`         | `models`       |
| `/models/{num}`   | `models/{num}` |
| `/results`        | `results`      |

`/data` has two keys because the two views have unrelated content heights. Reserved routes have **no** key; opening a modal never changes the underlay's position.

### 8.3 Snapshot shape

```typescript
export interface ScrollSnapshot {
	/** window.innerWidth (CSS px) when saved. */
	viewportWidth: number;
	/** Document scroll offset. */
	top: number;
	/** Named inner scrollers, e.g. { 'data-table': { top, left } }. */
	regions?: Record<string, { top: number; left: number }>;
	savedAt: number;
}
```

- **Viewport-width rule.** A snapshot is used only if `snapshot.viewportWidth === window.innerWidth` at restore time. Otherwise it is ignored (treated as "no snapshot": scroll to top, regions to origin). `innerWidth` is used rather than `clientWidth` because it includes the scrollbar and so does not change when a page becomes tall enough to gain a scrollbar; it does change under browser zoom, which also invalidates layout and should discard the position.
- Mismatched snapshots are not deleted when the viewport changes, only ignored, so returning to the original width (e.g. rotating a tablet back) makes them valid again. They are overwritten the next time that key is saved.
- Viewport **height** is deliberately not part of the rule (mobile browser chrome changes it constantly).
- Persistence format and storage key: [state-and-storage.md §3](state-and-storage.md#3-persisted-schema).

### 8.4 Saving and restoring

**Saving**

1. A passive `scroll` listener updates an in-memory `liveScroll` value synchronously.
2. The persisted snapshot is written debounced (~150 ms), and flushed immediately on: before any router `pushState`/`replaceState`, `visibilitychange` → `hidden`, and `pagehide`. Do not rely on `beforeunload` or on `scrollend` (not Baseline Widely available).
3. For `popstate`, the browser has already changed `location`, so the outgoing key's position comes from `liveScroll`, not from the DOM.
4. Saving is **disabled until restoration for the current route has finished** (success, give-up, or nothing to restore). Otherwise the initial render at `top = 0` would overwrite the position being restored.

**Restoring** (after the view mounts)

1. Look up the key's snapshot; ignore it if the viewport width differs (§8.3). No snapshot → leave at top.
2. Await `view.whenSettled()` (§5.5).
3. Call `scrollTo({ top, behavior: 'instant' })` explicitly (global `scroll-behavior: smooth` must not animate a restore; reduced-motion users must not see a long glide). Then restore each region once the owning component reports its content height (the virtual table needs `rowCount` for its height rail).
4. If the document is not yet tall enough, retry on a `ResizeObserver` for `main` for at most ~2 s, then clamp and stop.
5. Abort restoration immediately on any user scroll input (`wheel`, `touchstart`, `keydown` of scroll keys, `pointerdown` on the scrollbar). Never fight the user.
6. Restoration never moves focus.

**Semantics.** Entering a step by link, sidebar or Back/Forward restores that step's **latest** remembered position (tab-like, native-app behaviour), not the position at the moment of that specific history entry. A brand-new model page has no snapshot and opens at top.

**Invalidation.** Dataset change (§6.1) and model discard (§6.4) clear the affected keys.

---

## 9. Hydration, Resume & Reload Recovery

### 9.1 Startup sequence

1. Read persisted state (storage reads are wrapped in `try/catch`; absent, corrupt, wrong-shape or unsupported-version data yields fresh defaults and is never partially applied).
2. Reconcile with IndexedDB and apply integrity checks and interrupted-training recovery ([state-and-storage.md §6](state-and-storage.md#6-indexeddb-reconciliation)).
3. Initialise stores, **then** the router (hydrate-before-routing is retained from the previous design).
4. Set `history.scrollRestoration = 'manual'`.
5. Resolve the initial route (§9.2).
6. Mount the view, restore scroll (§8.4).
7. Show the welcome modal if `!welcomeDismissed` and the route is a workflow route.

### 9.2 Resolving the initial URL

| Loaded URL      | Behaviour                                                                                                                                                    |
| :-------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`             | `replaceState` to `resumePath` (persisted; defaults to `/data`)                                                                                              |
| A workflow path | Honour the URL exactly, even if it differs from `resumePath` (e.g. a pasted deep link); `resumePath` is updated                                              |
| A reserved path | Open the modal over `resumePath`; write `{ underlayPath: resumePath }` into this entry's `history.state` with `replaceState`; do **not** modify `resumePath` |
| Unknown path    | `replaceState` to `resumePath` and show a notification                                                                                                       |

`resumePath` is written synchronously on every workflow navigation (push or replace). Opening the base URL in a new tab therefore shows whatever workflow page was most recently visited in any tab.

### 9.3 Interrupted training

A persisted model with `status === 'training'` found during hydration is recovered per §7 (`recoverInterrupted`), but **only if** no other tab holds its training lock; otherwise it is left as `training` and shown as "Training in another tab" (read-only).

### 9.4 "Exact same UI" checklist

Everything the user can see or has chosen is covered by exactly one of these, so a reload reproduces the screen:

- **Location:** URL (workflow page, model number).
- **Content:** dataset summary, target, models and their per-section data, results.
- **Progress presentation:** `completedSteps`, `status`, and error state per model.
- **UI selections:** `data.mode`, `data.selectedColumn`, and any further user-controlled UI state registered under [state-and-storage.md §5](state-and-storage.md#5-ui-state-persistence-rule).
- **Scroll:** per-key window and region offsets (§8).
- **Onboarding:** `welcomeDismissed`.

Deliberately **not** restored: reserved-route modals as persisted state (they restore only because the URL says so, §9.2), transient dialogs (Datasheet, Upload, Model Description), focus and hover, text typed into a field but not committed, in-flight ingestion, live training progress between ticks. _(Whether transient dialogs should be restored is a question in §12.)_

---

## 10. Store Actions

State changes occur only through exported action functions in the store modules (COMPONENTS.md §5). Names are normative; signatures live in the TSDoc of the implementation.

| Area                       | Actions                                                                                                                                                                                                                                                                                                                   |
| :------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Onboarding                 | `dismissWelcome`                                                                                                                                                                                                                                                                                                          |
| Navigation (router module) | `navigate(path)`, `openReserved(path)`, `closeReserved()`                                                                                                                                                                                                                                                                 |
| Data                       | `loadDatasetSucceeded(dataset)`, `setDataMode(mode)`, `setSelectedColumn(name \| null)`                                                                                                                                                                                                                                   |
| Target                     | `setTarget(column)`, `confirmDiscardModels()`                                                                                                                                                                                                                                                                             |
| Models                     | `createModel()`, `chooseModel(num, modelId, defaults)`, `setFeatures(num, names)`, `toggleFeature(num, name)`, `setModelOptions(num, options)`, `setHyperparameters(num, config)`, `setMulticlassStrategy(num, strategy)`, `setTrainingSetup(num, setup)`, `completeSection(num, section)`, `reopenSection(num, section)` |
| Training                   | `startTraining(num)`, `updateTrainingProgress(num, progress)`, `trainingSucceeded(num, result)`, `trainingFailed(num, message, details?)`, `cancelTraining(num)`, `recoverInterrupted(num)`                                                                                                                               |
| Results                    | `viewResults(num)`                                                                                                                                                                                                                                                                                                        |
| Scroll                     | `recordScroll(key, snapshot)`, `clearScroll(keys)`                                                                                                                                                                                                                                                                        |

All actions are guarded: an action that is invalid for the current state (for example `toggleFeature` on a non-draft model, or `setFeatures` including the target) is a no-op that returns `false`; it does not throw and does not mutate.

---

## 11. Verification Requirements

Pure logic runs under `bun:test` with an in-memory `Storage`. Anything that depends on real history, layout or `<dialog>` MUST run in Playwright (Chromium, Firefox, WebKit) per [COMPONENTS.md §9](COMPONENTS.md); `happy-dom` has no layout and does not implement session history faithfully enough for these checks.

**Unit (`bun:test`)**

| ID        | Criterion                                                                                                                                                                                                                   |
| :-------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NAV-AC-1  | `parseRoute` classifies `/`, each workflow path, `/models/{num}` (valid, `0`, `-1`, `abc`, `1.5`), each reserved path, trailing slash, and unknown paths.                                                                   |
| NAV-AC-2  | Reserved paths never appear in `resumePath`; `resumePath` only ever holds a workflow path.                                                                                                                                  |
| NAV-AC-3  | Availability predicates (`hasDataset`, `hasTarget`, `canCompare`) for every combination, including `canCompare` flipping at exactly two trained models.                                                                     |
| NAV-AC-3b | `blockedReason(route, state)` returns the §4.3 reason (or `null`) for every route and state combination, reports the _first_ unmet prerequisite, and never returns a reason for `/data` or for an existing `/models/{num}`. |
| NAV-AC-4  | Scroll snapshot usable only when `viewportWidth === window.innerWidth`; ignored (not deleted) otherwise.                                                                                                                    |
| NAV-AC-5  | `loadDatasetSucceeded` with the same id and schema preserves downstream state; with a different dataset clears target, models and non-`/data` scroll keys.                                                                  |
| NAV-AC-6  | `setTarget` to a different column with existing models is rejected until `confirmDiscardModels`; features never contain the target.                                                                                         |
| NAV-AC-7  | Model lifecycle table (§7), every row, including that `trained` models and frozen sections reject edits.                                                                                                                    |
| NAV-AC-8  | Editing a completed section with a changed value un-completes later sections only; an unchanged edit un-completes nothing; changing the model resets options/hyperparameters but keeps features.                            |
| NAV-AC-9  | Hydration of `status: 'training'` becomes `draft` + `TRAINING_INTERRUPTED_BY_RELOAD` when the lock is free, and is left alone when held.                                                                                    |
| NAV-AC-10 | Corrupt JSON, wrong shape, unknown future version and missing `localStorage` all yield defaults without throwing; an unknown future version leaves the stored blob byte-identical in storage.                               |

**Browser (Playwright)**

| ID         | Criterion                                                                                                                                                                                                                                                                                                                                                                                              |
| :--------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NAV-E2E-1  | Navigating Data → Target → Models pushes entries; Back/Forward re-render the correct step and restore each step's scroll.                                                                                                                                                                                                                                                                              |
| NAV-E2E-2  | Loading `/` in a new tab resumes the last workflow path and its scroll; loading `/models/9999` stays on that URL and shows the "model not found" notification; loading `/models/abc` replaces to the resume path.                                                                                                                                                                                      |
| NAV-E2E-2d | On each workflow page exactly one sidebar link has `aria-current="page"` (and on `/models/{num}` the "Train Models" link has `aria-current="true"`); current entries remain focusable with a visible focus outline; activating one adds no history entry and does not change scroll; keyboard focus stays on the activated link after the sidebar re-renders.                                          |
| NAV-E2E-2c | On `/models` the Compare Results control is a disabled `<button>` with its visible hint as `aria-describedby` while fewer than two models are trained, and an enabled link to `/results` once two are trained; the sidebar's Compare Results link is enabled in both cases.                                                                                                                            |
| NAV-E2E-2b | For every workflow page and every combination of missing prerequisites, the sidebar link is enabled, navigation succeeds with no redirect (URL and history length as expected), and the page shows the expected `.notification` text from §4.3. When state later satisfies the prerequisite (e.g. a second model finishes training) the same page re-renders to its normal content without navigation. |
| NAV-E2E-3  | Opening `/about` pushes one entry; `Esc`, the close button and Back each close it and leave exactly one entry removed; the underlay's scroll offset is unchanged and nothing in persisted state mentions `/about`.                                                                                                                                                                                     |
| NAV-E2E-4  | Direct load of `/help` shows the modal over the persisted resume page; closing replaces rather than leaving the app; Back/Forward behaves coherently.                                                                                                                                                                                                                                                  |
| NAV-E2E-5  | Resize the viewport width, reload: the previous scroll is **not** applied; restore the width, reload: it is.                                                                                                                                                                                                                                                                                           |
| NAV-E2E-6  | Reload during `training` returns to the model page with section 4 active and the interrupted error; a second tab loaded during training does not mark it interrupted.                                                                                                                                                                                                                                  |
| NAV-E2E-7  | Selected column aside and virtual-table offset on `/data` survive a reload.                                                                                                                                                                                                                                                                                                                            |
| NAV-E2E-8  | A user scroll during restoration cancels it.                                                                                                                                                                                                                                                                                                                                                           |
| NAV-E2E-9  | Deep link `/models/3` loads with correct assets (root-absolute URLs) from a cold start and from the service worker.                                                                                                                                                                                                                                                                                    |

---

## 12. Open Questions

For a human to answer; implementers must not resolve these silently.

1. **Workflow additions:**
    - ~~Return from preview to the dataset cards~~ (§6.1) — answered: **Change Dataset** with modal confirmation and `clearDataset()`.
    - ~~Re-opening and editing completed model sections before training~~ (§6.3) — answered: keep `reopenSection`.
    - ~~A **Cancel training** control~~ (§7) — answered: keep `cancelTraining`.
    - Replacing the "warning bar" on `/target` (workflow-steps §2) with the same `.notification` used on every other blocked page (§4.3).
2. ~~**Changing the target or dataset with existing models**~~ (§6.4) — answered: confirm-and-discard (`setTarget` rejects with models present; explicit `confirmDiscardModels` action clears them).
3. **Transient dialogs on reload:** should an open Datasheet / Model Description dialog be restored? (Currently not; "exact same UI" could be read to include them.)
4. ~~**Scroll semantics**~~ (§8.4) — answered: latest-per-step scroll memory is accepted.
5. **Reserved content mapping:** `content/pages/privacy-policy.md` serves `/privacy`; there is no `help` content and `terms-and-conditions.md` has no route. Create `help.md`? Add a reserved route for terms?
6. ~~**File rename** to `app-state-and-navigation.md`~~ — done 2026-11-12.
7. **Training setup** (section 4) and **results** (sections 6 and 4) remain TODO in workflow-steps.md; the persisted shapes for them are placeholders.
