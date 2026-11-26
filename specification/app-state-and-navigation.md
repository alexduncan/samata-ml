# Architecture Specification: Application State & Navigation (Hybrid Router + Store)

**Status:** draft — routing, route focus, scroll, protected storage, the provisional wizard and numbered results are implemented. Dynamic view imports, broader synchronisation and service-worker delivery remain target. See [Known gap 14](README.md#known-gaps).

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

- **[`<app-sidebar>`](components/sidebar.md)** (connected): brand paragraph, Project h2, named workflow nav/ol, four steps, keyed sibling model links inside step 3 and reserved-route footer. The read-only computed `$sidebarState` projects dataset/counts, target/type, model/status and current-link values from app state and route; messages/formatting remain component-owned. No domain state is written.
- **`<main>`** (native element): the shell mounts the active route view here; current route elements are statically imported. Dynamic imports remain target (ARCHITECTURE.md → code splitting).
- **[`<app-welcome-modal>`](components/welcome-modal.md)** (connected): shown while undismissed on root/workflow routes. Get Started or native dismissal persists once; reserved-route hiding/disconnection suppresses the queued close and never dismisses onboarding. It has no URL or history entry.
- **[`<app-content-modal>`](components/content-modal.md)** (connected): retains safe-content loading and route ownership, composing the store-free presentational `<app-content-dialog>` (§5.4).

The three shell owners have closed component specs linked above and live in `src/features/shell/`. Their public API is tag-only; the content dialog's seven properties, typed labels and user-close event are specified separately in the same content spec. Main's current feature elements mount through `src/app.ts`; dynamic imports remain target architecture.

---

## 3. Route Table

| Path                    | Section  | Sidebar label       | View                                         | Notes                                                                                                                             |
| :---------------------- | :------- | :------------------ | :------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------- |
| `/`                     | –        | –                   | none (redirect)                              | Resolves to the resume path (§9.2) with `replaceState`.                                                                           |
| `/data`                 | 1        | Load Data           | Dataset picker **or** dataset preview (§6.1) | Default resume path on first load.                                                                                                |
| `/target`               | 2        | Set Target          | Column table (§6.2)                          | Always reachable. Shows a `.notification` instead of the table if no dataset is loaded (§4.3).                                    |
| `/models`               | 3        | All Trained Models  | Table of models and Train New Model (§6.3)   | Always reachable. Shows a notification if dataset or target is missing. Compare Results is disabled until two models are trained. |
| `/models/new`           | 3        | Training New Model… | Provisional model wizard (§6.3, §7)          | Explicit navigation may allocate. Each acknowledged entry binds to one model in the current project context.                      |
| `/models/{num}`         | 3        | Saved model name    | Trained result or historical draft (§6.3)    | Positive integer allocated once. A missing well-formed number keeps its URL and shows a recovery link.                            |
| `/results`              | 4        | Compare Results     | Cross-model comparison (§6.5)                | Always reachable. Shows a `.notification` if fewer than two models are trained.                                                   |
| `/about`                | reserved | footer              | Static content modal                         | Never persisted.                                                                                                                  |
| `/privacy`              | reserved | footer              | Static content modal                         | Never persisted.                                                                                                                  |
| `/help`                 | reserved | footer              | Static content modal                         | Never persisted.                                                                                                                  |
| `/help/select-features` | reserved | Step 2              | Static content modal                         | What are features? opens over the current wizard entry.                                                                           |
| `/help/configure-model` | reserved | Step 3              | Static content modal                         | What do these settings mean? opens over the current wizard entry.                                                                 |
| `/help/training-setup`  | reserved | Section 4           | Static content modal                         | Opens from What is this? or Learn more. Closing returns to the same builder.                                                      |
| anything else           | –        | –                   | none (redirect)                              | `replaceState` to the resume path plus a transient notification.                                                                  |

Rules:

- Matching is on `location.pathname` only. Query strings and hashes are ignored, not generated and not persisted. A trailing slash is normalised away by `replaceState`.
- `new` is the one reserved workflow segment under `/models`. Other segments must be positive integers. Unknown paths follow §9.2. A positive integer with no matching model is a valid page URL with the model-not-found notification (§4.3).
- Reserved paths are the six fixed entries in the table. `RESERVED_CONTENT` in `src/router/reserved-content.ts` maps each to the page ID of its final segment, with `/privacy` using `privacy-policy`. The [content pipeline](content-and-i18n.md#static-content) compiles and validates the required default articles.

### 3.1 Types

```typescript
export type SectionNumber = 1 | 2 | 3 | 4;

export type ReservedPath =
	| '/about'
	| '/privacy'
	| '/help'
	| '/help/select-features'
	| '/help/configure-model'
	| '/help/training-setup';

export type WorkflowPath =
	| '/data'
	| '/target'
	| '/models'
	| '/models/new'
	| `/models/${number}`
	| '/results';

export type ProvisionalEntry =
	| { kind: 'pending'; context: ProvisionalModelContext; candidate?: ProvisionalModelIdentity }
	| { kind: 'bound'; identity: ProvisionalModelIdentity };

export type ProvisionalRouteState =
	| ProvisionalEntry
	| { kind: 'loading'; context: ProvisionalModelContext };

export type ParsedRoute =
	| { kind: 'root' }
	| {
			kind: 'workflow';
			path: WorkflowPath;
			section: SectionNumber;
			modelNum?: number;
			provisional?: ProvisionalRouteState;
	  }
	| {
			kind: 'reserved';
			path: ReservedPath;
			underlayPath?: WorkflowPath;
			provisional?: ProvisionalRouteState;
	  }
	| { kind: 'unknown'; path: string };

/** The only data written to `history.state` by the app. Domain state NEVER goes here. */
export interface HistoryEntryState {
	v: 1;
	/** Random id so tests and the router can tell entries apart. */
	entryId: string;
	stackId?: string;
	index?: number;
	modalDocumentId?: string;
	underlayPath?: WorkflowPath;
	underlayEntryId?: string;
	provisional?: ProvisionalEntry;
}
```

The context is the dataset ID, target and comparison context epoch. A provisional identity adds the allocated model number and creation time. Version 1 history entries can omit the added fields. Only a pending or bound identity is stored in history. The loading presentation stays in memory.

---

## 4. Workflow Availability and Departure

The main workflow routes are reachable by link, typed URL, bookmark and Back/Forward. A page whose prerequisites are missing explains what the learner needs to do. The unfinished provisional wizard guards a confirmed departure (§5.3).

### 4.1 Consequences

- Root and unknown paths resolve to the resume path with `replaceState`. A numeric URL for the current provisional record canonicalises to its bound `/models/new` entry. An inferred new-model resume without a valid pointer falls back to the Models overview.
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

| Route           | Blocked when                                  | Message (English; i18n key per COMPONENTS.md §8)                                                   | Link                       |
| :-------------- | :-------------------------------------------- | :------------------------------------------------------------------------------------------------- | :------------------------- |
| `/target`       | `!hasDataset`                                 | "Load a dataset before choosing a target."                                                         | Load Data → `/data`        |
| `/models`       | `!hasDataset`                                 | "You need to load a dataset and set a target variable before you can train a model."               | Load a dataset → `/data`   |
| `/models`       | `hasDataset && !hasTarget`                    | "You need to set a target variable before you can train a model."                                  | Set a target → `/target`   |
| `/models/new`   | Missing dataset or target                     | Explain the first missing prerequisite.                                                            | Load data or set a target  |
| `/models/new`   | Bound model or first saved result unavailable | Show read-only recovery for the old visit.                                                         | Back to Models → `/models` |
| `/models/{num}` | no model with that `num`                      | "Model {num} doesn't exist. It may have been removed when the dataset or target variable changed." | Back to models → `/models` |
| `/models/{num}` | model exists                                  | never blocked                                                                                      | –                          |
| `/results`      | `!canCompare`                                 | "You need to train more than one model before you can compare results."                            | Train models → `/models`   |
| `/data`         | never                                         | –                                                                                                  | –                          |

Notes:

- `/models` when `!hasDataset` and when `!hasTarget` show different messages deliberately: each says only what is actually missing next.
- This replaces the "warning bar" wording for `/target` in workflow-steps §2 with the same `.notification` component used elsewhere, so every blocked page looks and behaves the same. Confirm in §12 if the distinct "warning bar" is intended.
- Messages describe the cause and the remedy. They never say "access denied" or similar, because nothing is being denied.
- Blocked views contain no dead controls: the "new model" action, model table, column table and comparison are simply not rendered.
- The notification has `role="status"` (it is informative, not an interruption) and is not focused on navigation; focus goes to the `<h1>` as for any route (§5.6).

### 4.4 Sidebar and shortcuts

- Each of the four sections has a native link. **All Trained Models** links to `/models`. Trained links are keyed by model number in a sibling list, with no nested link. When prerequisites allow, `a.step-train-new` or `a.step-model-link` links to `/models/new` as **Train New Model** or **Train Another Model**, respectively.
- Mark the exact visible workflow destination `aria-current="page"` and mark the Models parent `aria-current="true"` on a descendant. The bound new wizard has a static **Training New Model…** row through Step 5 completion, with `aria-current="page"` only when the wizard is visible. Reserved routes retain the underlay and clear current markers from the workflow navigation. Within the wizard, the one active section uses `aria-current="step"`.
- Current links retain their `href`, visible focus outline and keyboard focus. Activating the exact current link preserves the history entry and scroll (§5.2). The Models parent link is still a destination from a descendant.
- Match mockup current states to native links and the static provisional status row.
- The Dot follows [the next-step guidance rules](workflow-steps.md#next-step-guidance). It tracks acknowledged project milestones in memory and leaves navigation, history and focus with the learner and router.
- The cue compares exact effective workflows. Opening, switching or closing Help over the same underlay preserves it. History that reaches a different underlay follows the ordinary arrival and departure rules. Entering `/models/new` consumes its active training cue. A numbered result is a different destination. Comparison is consumed on arrival at `/results`, including when the second result acknowledges while that page is current.
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

| Situation                                                                 | History call                                                                   |
| :------------------------------------------------------------------------ | :----------------------------------------------------------------------------- |
| User navigates to a different workflow path                               | `pushState`                                                                    |
| User navigates to the path already shown                                  | no-op (no duplicate entry)                                                     |
| Activate a start-new link                                                 | `pushState` to `/models/new` with a unique entry and a captured pending intent |
| Acknowledge its matching binding                                          | `replaceState` for the same source entry or its active reserved underlay       |
| View Results from an acknowledged provisional wizard                      | `replaceState` with its numbered result                                        |
| Open a reserved route from a workflow page                                | `pushState` with underlay, source entry and document owner                     |
| Reserved → reserved (link inside a modal)                                 | `replaceState` (never stack two overlays)                                      |
| Close a reserved route opened in this document                            | `history.back()`                                                               |
| Close a reserved route that was loaded directly (no in-app entry beneath) | `replaceState` to the underlay path                                            |
| Root, unknown path or active provisional numeric alias                    | `replaceState`                                                                 |

### 5.3 `popstate`

The router marks entries with a per-document stack ID and index. Push adds a unique entry and drops any forward branch. Replace retains its position and entry ID on the same visit. Bootstrap starts a new local stack at the current entry and decodes a still-valid binding.

For an unfinished visible wizard, compare the destination's effective underlay and bound model with the source. A different underlay or model is a departure. Before rendering a reversible same-stack destination, restore the source by history delta and show the builder's native **Stay** / **Leave** dialog. Stay preserves the source entry, scroll and invoker focus. Leave waits for protected abandonment, then replays the confirmed destination once. The router owns history operations and a single source-entry intent with a monotonic token. Stale effects and unexpected replay retire the intent. Repeated traversals while a decision is pending do not start a second confirmation or write.

Traversals without a valid shared stack/index, document reload and cross-document navigation preserve saved work. Opening, changing and closing a reserved overlay over the same wizard preserves the draft. Traversal from an overlay to a different underlay also preserves the draft and proceeds without a stacked dialog. History-driven modal close suppresses the queued native close event, so it cannot echo a navigation. `popstate` never pushes a new entry.

### 5.4 Reserved routes as modals

- Content is rendered in a native `<dialog>` opened with `showModal()` (not `show()` or the `open` attribute). Invoker commands (`command="show-modal"`) are _not_ Baseline Widely available, so they are not used; the router opens the dialog from script. No `role="dialog"`, `aria-modal`, focus trap or `Esc` handler is added; the platform provides them.
- The dialog is named with `aria-labelledby` pointing at its visible `<h2>`. Heading/body receive entry lang/dir only when ready. A native `.btn-icon` Close has translated aria-label and decorative SVG. Loading sets body aria-busy; error displays one labelled alert while Close stays usable.
- Dismissal: `Esc` and the mobile back gesture (modal default) and the close button. Light-dismiss (`closedby="any"`) is permitted as progressive enhancement only (Safari lacks it).
- Native user dismissal produces one `app-content-dialog-close` intent; the connected owner calls closeReserved only for the corresponding active reserved route (§5.2). Property/history-driven closing emits no intent. Route-keyed child instances and abort/sequence/path load guards prevent an old queued close or response from affecting a newer reserved route. This keeps native dismissal and the URL aligned without echoing Back/Forward navigation.
- While any native modal dialog is open, the shell locks user scrolling on the document root and reserves an existing scrollbar gutter. Dialog content can still scroll, and the page retains its scroll offset. Closing or removing the last modal restores ordinary page scrolling. Dialogs and backdrops retain their shared overscroll containment.
- The underlay view stays mounted while the modal is open, so the workflow page's DOM, scroll position and focus return are unaffected.
- A fixed reserved entry pushed in this document records its `modalDocumentId`. Close and Escape go Back on every visit, including after Forward. Topic switches retain the owner and the underlay's identity. Direct loads, reloads and legacy ownerless entries replace to the validated underlay. The reserved URL never becomes the persisted resume path.
- A reserved entry retains the same wizard source via `underlayEntryId`. If the underlying pending wizard binds while Help is open, the router retains the acknowledgement against that source and updates the active overlay's underlay metadata. Returning to the source restores only the matching entry before rendering.
- If the user first lands on a reserved URL, the welcome modal is not shown on top of it; it appears when the reserved modal is closed (if still undismissed).

### 5.5 Mounting views

- The shell mounts one Lit workflow view for the resolved route and retains that same view under reserved content. Switching workflows unmounts the preceding view. Persistent state lives in stores. Dynamic route imports remain target.
- A view that needs async data before its layout height is final (dataset metadata, table row count, results) MUST expose `whenSettled(): Promise<void>`, resolving once layout is stable. The scroll restorer waits on it (§8.4). _(This is part of the view contract and must be added to each view's component spec.)_

### 5.6 Document title and focus

- On every route change the router sets `document.title` to `samatā.ml | {Page}` (e.g. `samatā.ml | Train Models`, `samatā.ml | Model 3`, `samatā.ml | About`), so history entries are distinguishable in the browser's history list and by screen readers.
- After a workflow route change initiated by the user, focus moves to the `<h1>` in `.page-header` (`tabindex="-1"`, `focus({ preventScroll: true })`). It does **not** move on hydration/reload or while restoring scroll, and never when `popstate` was caused by closing a modal (the dialog returns focus to its invoker itself).
- The router decides whether to request focus. The shell consumes that request once and delegates it to the rendered route element's `focusHeading(signal)`; it aborts the previous pending request at every shell render, including route/data-mode replacement and reserved-route opening. Data, target, models overview, model builder and results each await their own Lit render, recheck cancellation/connection and query only their own heading. In preview mode data delegates to the nested preview's method, which performs the same checks. No shell query crosses Shadow DOM.
- Focus readiness is independent of whenSettled, metadata/network/rows and the scroll-restoration algorithm. Ordinary resource renders, duplicate current links, hydration/reload and reserved open/close create no extra request. Already-aborted/disconnected calls resolve without action; removed targets cannot steal focus, and a new call after reattachment works. Loading/ready/error body updates do not refocus. The shared 2px token outline changes no normal heading geometry; preventScroll preserves document/table offsets while scroll restoration retains its independent decisions.

### 5.7 Hosting and asset URLs

Because step URLs are real paths, deep links and reloads request e.g. `/models/3` from the server:

- Production (`wrangler.jsonc`) already uses `"not_found_handling": "single-page-application"`; keep it.
- The dev/static server (`scripts/static-server.ts`) falls back to index.html only for extension-less paths; missing script/style files return 404.
- The index.html template references `/style.css` and `/app.js`; emitted production references retain root-absolute URLs with content hashes, including on nested model routes.
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

- Table rows: Column Name (`<th scope="row">`), Type (`<code>Numeric</code>`, `<code>Categorical</code>`, `<code>Boolean</code>`, `<code>Text</code>`, `<code>Date</code>`, `<code>Time</code>`, `<code>Datetime</code>`), Notes, and Action.
- Eligibility: Text, date, time, datetime, all-missing, and constant columns are disqualified and show disabling explanatory notes. Identifier hints, missing-value counts, high cardinality, and descriptor suggestions provide advisory guidance while remaining selectable.
- Action buttons:
  - Active target shows a disabled button reading "Current Target".
  - Eligible candidate columns show a primary button reading "Set as Target".
  - Disqualified columns show a disabled button reading "Set as Target".
- The connected view requests a protected target change. If models exist and the target differs, the user confirms discarding the current models and results first (§6.4). The selected target updates after acknowledgement.
- Selecting the already-active target is a no-op that never opens a modal or alters models.
- Setting the target updates state and keeps the user on `/target`; a "Train Models" button (`<a href="/models" class="btn btn-primary">`) in the page header enables progressing to Step 3.
- Without a dataset a `.notification` replaces the table body (§4.3).

### 6.3 Section 3 — Train Models

Corresponds to workflow-steps §3.

**`/models`** lists the workspace models, setup, and durations. **View Results** opens a trained numbered route. **Continue** routes the current provisional draft to `/models/new` with its binding and historical drafts to their numbered routes. The header offers **Train New Model** and **Compare Results**.

**`/models/new`** renders a focusable loading or recovery view until the source binds. Explicit entry may allocate under the protected state lock after checking dataset, target and metadata. Duplicate visits or concurrent tabs adopt the one valid provisional pointer. A pending entry's acknowledgement must match its captured entry, context and candidate. Reload and traversal never create a second draft for a pending or bound entry. Explicit retry can recover the current matching pointer. Only if the source still owns the loading heading's focus may acknowledgement transfer focus to the bound view.

The wizard presents the following steps. Historical numbered drafts retain their existing editable route.

| Step | Section ID           | Acknowledgement that advances                              | Completed heading                         |
| :--- | :------------------- | :--------------------------------------------------------- | :---------------------------------------- |
| 1    | `choose-model`       | Select Model saves model, eligible defaults and completion | Selected catalogue name                   |
| 2    | `select-features`    | Continue saves eligible features and completion            | Localised feature count                   |
| 3    | `configure-model`    | Save & Continue saves eligible options and completion      | Model Configured                          |
| 4    | `configure-training` | Matching acknowledged start with saved strategy            | One-Shot Training or localised fold count |
| 5    | `training`           | Matching durable finish enables View Results               | Training Complete                         |

The connected builder animates the measured block-size from the departing panel to the acknowledged step and focuses its heading. The departing controls are inert while closing. Reduced motion, supersession and disconnection settle the current ownership without a stale focus change. A failed or pending Step 1–3 save keeps its eligible draft and current step. The same operation and candidate replay when publication was committed.

Model-level rules:

- **Eligible models** are classifiers for boolean and categorical targets. Numeric targets show the current classification limit (workflow-steps §3.1).
- **Features**: all columns are listed; the target is shown but not selectable; ineligible (`text`) columns are not selectable. The target can never be in `features`.
- **Multiclass strategy** (`native | one-vs-rest | one-vs-one`) is derived from the selected classifier for eligible multiclass targets and shown read-only in Step 3.
- **Training Setup** (Section 4) displays **One-Shot** before the first write. The builder checks that the route, active model, dataset and target still match ready eligible metadata before accepting a change or submit. Cross-Validation uses the current target’s observed class counts to bound folds and shows a scrollable matrix. Valid **Train Model** submission captures the setup and requests an attempt. Accepted start activates Section 5 and focuses its heading for the initiating action. Rejected start leaves Section 4 open with a reason. The Models table uses the same summary and shows “Not configured” when there is no usable setup, including for read-only models.
- **Help and transient edits.** Steps 2–4 have contextual heading links. Opening Help keeps the same builder, form, draft values and effective history entry. The native modal returns focus to the invoker on Close, Escape or Back. Covered workflow actions are unavailable. A different dataset, target or model gets a fresh keyed form.
- **Editing earlier sections**: while `status === 'draft'`, a completed section can be re-opened and edited. If the edit **changes** its value, completion of all _later_ sections is removed (their values are kept where still valid and the user re-confirms with the section action). Re-selecting the same model, or re-confirming unchanged values, invalidates nothing. Selecting a **different** model resets `modelOptions`, `hyperparameters` and `multiclass` to the new model's defaults and un-completes sections 2 and 3; `features` and `trainingSetup` are kept.
- **Training and acknowledgement.** The first acknowledged provisional finish clears `newModelNum` and pins that run in the same commit. Its source visit stays bound at `/models/new` through Help or refresh. View Results first verifies the pinned run against the current saved revision and exact envelope. It then acknowledges the result and replaces that visit with the numbered route. A stale binding, missing pin or later numeric rerun shows read-only recovery with a Models link.
- **Numbered results.** A trained numbered route opens the result directly with its own focusable heading, swatch and Training Details. A numeric URL for the current unfinished provisional record canonicalises to its bound new-model route, including under Help. Historical numbered drafts keep their existing edit and training routes.
- **Frozen configuration.** Completed saved results display the settings used by the acknowledged evaluation. A learner starts a new model to train with different settings.

### 6.4 Changing the dataset or target while models exist

- The dataset and target views request explicit confirmation before discarding the current resources or models. A local cancellation settles before confirmed deletion. A remote run keeps the dialog open with a busy notice and allows the learner to return later.
- A confirmed discard deletes the associated IndexedDB data in the protected commit. The acknowledged state resets the model list and counter and clears affected scroll snapshots. If publication fails after deletion, keep the dialog open with Retry saving and disable duplicate deletion.
- Cancelling an uncommitted dialog preserves the current resources. A changed dataset invalidates a stale target confirmation.
- A different tab observes the acknowledged state in place. A route naming a discarded model keeps its URL and displays the matching blocked-state notification.

### 6.5 Section 4 — Compare Results (`/results`)

Inputs are trained models and their saved evaluations. `$comparison` groups compatible evaluations and derives the active group, selected models, ordered pair and visible views. Loading, legacy, lost and read-error resources remain distinct. Group and display choices live in `results.ui` and are owned by `{ datasetId, target, epoch }`; stale owners cannot write. A selected fingerprint identifies the group; model numbers are pruned against the current models and capped at eight. Changing dataset or target advances the context epoch and clears the choices. See [state-and-storage §5](state-and-storage.md#5-ui-state-persistence-rule) for validation and guarded merges.

`app-results-view.focusHeading(signal)` focuses its own heading independently of result loading and honours cancellation. `whenSettled()` waits for current evaluations, the first terminal paired analysis and initially visible charts, and settles promptly on supersession or disconnection. The shell uses it for scroll restoration; later updates do not refocus.

---

## 7. Model Lifecycle (Small State Machine)

| Before   | Action                                   | After    | Acknowledgement                                                                                     |
| -------- | ---------------------------------------- | -------- | --------------------------------------------------------------------------------------------------- |
| Draft    | Train Model                              | Training | Store the exact run identity and setup before starting the worker                                   |
| Training | Matching cancelled or failed run settles | Draft    | Publish the safe reason and preserve setup                                                          |
| Training | Matching run finishes                    | Trained  | Save the envelope and state. The first provisional finish also pins the run and clears the pointer. |
| Trained  | View Results                             | Trained  | Verify the exact run and acknowledge its numbered handoff                                           |

A rejected start presents its reason in Training Setup. A committed start awaiting publication returns to an interrupted draft when no worker owns it. A local stopped panel keeps only the last known percentage from the exact displayed run and presents Train Model and Edit Training Setup. Retry starts a new run. A focus request after a stopped local run applies only to its enabled retry action. Background completion and cross-tab updates preserve focus. A fresh reload has no local stopped attempt, so it restores the saved editable setup.

Confirmed departure waits for matching local cancellation or an already cancelling or saving attempt. Publication pending must settle first. A remote owner or unavailable acknowledgement keeps the source visible with recovery. Protected abandonment rechecks the captured identity and removes only that unfinished draft and pointer. A finish that wins the race retains its evaluation and allows departure.

```typescript
export interface TrainingProgress {
	percent: number | null;
	stage: 'preparing' | 'fitting' | 'cross-validation' | 'refitting' | 'evaluating' | 'saving';
	phase: string | null;
	statusMessage: string;
}
```

### 7.1 Training locks

The training service holds shared `samata-ml:ingestion` and exclusive `samata-ml:training:{num}` locks for the attempt. The state lock serialises journal reads, migration and protected writes. A live lock indicates an active owner. Read completed results under shared data and model locks after the relevant publication. See [state-and-storage.md §7](state-and-storage.md#7-multi-tab-behaviour).

---

## 8. Scroll Memory

Goal G2: each workflow step remembers its own scroll position, and a new tab or reload resumes it.

### 8.1 Scroll container

The **document** scrolls (`document.scrollingElement`). `<main>` MUST NOT be `overflow: scroll|auto` with a fixed height, and the sidebar is `position: fixed` (as in the mockups). This keeps mobile browser chrome behaviour, keyboard scrolling, find-in-page and focus-into-view native. Inner scrollers (the virtual table, wide tables) are tracked as named **regions** (§8.3).

### 8.2 Scroll keys

One snapshot is kept per key, latest write wins:

| Route                    | Key                                |
| :----------------------- | :--------------------------------- |
| `/data` (picker)         | `data:select`                      |
| `/data` (preview)        | `data:preview`                     |
| `/target`                | `target`                           |
| `/models`                | `models`                           |
| `/models/new` once bound | `models/{num}` for the bound model |
| `/models/{num}`          | `models/{num}`                     |
| `/results`               | `results`                          |

`/data` has two keys because the views have unrelated heights. An unbound wizard has no numeric scroll key. A Help overlay keeps the current underlay's position and bound numeric key. Acknowledged abandonment clears the abandoned model's snapshot.

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

The Training Setup matrix scrolls inside its own wrapper. Its horizontal offset is not restored on reload or remount while [scroll-region restoration](plans/scroll-region-restoration.md) is pending. The same wrapper stays mounted when Help opens over the model.

**Invalidation.** Dataset change (§6.1) and model discard (§6.4) clear the affected keys.

---

## 9. Hydration, Resume & Reload Recovery

### 9.1 Startup sequence

1. Read persisted state and the protected IndexedDB checkpoint under the state lock. Replay a committed pending candidate before showing workflow views. A failed read or replay displays Restore saved work and Retry saving.
2. Reconcile with IndexedDB and apply integrity checks and interrupted-training recovery ([state-and-storage.md §6](state-and-storage.md#6-indexeddb-reconciliation)).
3. Initialise stores, **then** the router (hydrate-before-routing is retained from the previous design).
4. Set `history.scrollRestoration = 'manual'`.
5. Resolve the initial route (§9.2).
6. Mount the view, restore scroll (§8.4).
7. Show the welcome modal if `!welcomeDismissed` and the route is a workflow route.

### 9.2 Resolving the initial URL

| Loaded URL                 | Behaviour                                                                                                                                                        |
| :------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                        | Replace to the persisted resume path, defaulting to `/data`. An inferred `/models/new` can adopt a valid pointer or falls back to `/models`.                     |
| An explicit workflow path  | Honour the visit. A new explicit `/models/new` may allocate, and a numeric alias for the active provisional draft canonicalises to its exact binding.            |
| A recorded new-model entry | Restore its valid pending or bound identity. A completed visit can read only its pinned saved run. An invalid or stale visit offers recovery without allocating. |
| A reserved path            | Open over the validated recorded underlay or its inferred resume path. Keep the binding and do not modify `resumePath`.                                          |
| Unknown path               | `replaceState` to `resumePath` and show a notification                                                                                                           |

`resumePath` is written synchronously on every workflow navigation (push or replace). Opening the base URL in a new tab therefore shows whatever workflow page was most recently visited in any tab.

### 9.3 Interrupted training

Startup first replays committed pending operations. A published trained result then opens with its verified log. For a model still marked training, hydration attempts the exclusive model lock. With a live owner, show Training in another tab. When the lock is available, acknowledge an interrupted draft with the saved setup. Retry or reload publishes existing work without starting a new fit.

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

| Area                       | Actions                                                                                                                                                                                                                            |
| :------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Onboarding                 | `dismissWelcome`                                                                                                                                                                                                                   |
| Navigation (router module) | `navigate(path)`, `openReserved(path)`, `closeReserved()`                                                                                                                                                                          |
| Data                       | Dataset publication and discard use the training service. View settings use the ordinary actions.                                                                                                                                  |
| Target                     | The training service acknowledges the target change and any confirmed result deletion.                                                                                                                                             |
| Models                     | The training service acknowledges provisional allocation, abandonment and eligible wizard completion. Interactive draft edits use actions including `toggleFeature`, `setHyperparameters`, `setTrainingSetup` and `reopenSection`. |
| Training                   | The training service owns start, cancel and retry. Run-scoped progress and the disclosure action update presentation state.                                                                                                        |
| Results                    | The training service acknowledges View Results for the exact run identity.                                                                                                                                                         |
| Scroll                     | `recordScroll(key, snapshot)`, `clearScroll(keys)`                                                                                                                                                                                 |

All actions are guarded: an action that is invalid for the current state (for example `toggleFeature` on a non-draft model, or `setFeatures` including the target) is a no-op that returns `false`; it does not throw and does not mutate.

---

## 11. Verification Requirements

Pure logic runs under `bun:test` with an in-memory `Storage`. Anything that depends on real history, layout or `<dialog>` MUST run in Playwright (Chromium, Firefox, WebKit) per [COMPONENTS.md §9](COMPONENTS.md); `happy-dom` has no layout and does not implement session history faithfully enough for these checks.

Unit and browser training checks exercise exact run identities, guarded state, result validation, storage failure before and after commit, non-isolation, cross-tab locks and saved-run acknowledgement. See the [Phase 3 evidence](plans/archive/web-ml-phase-3-model-training.md#implementation-and-verification-log).

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
| NAV-E2E-2d | The exact workflow link or visible provisional status row owns `aria-current="page"`. The Models parent uses `aria-current="true"` on a descendant. Duplicate current links preserve history, scroll and focus.                                                                                                                                                                                        |
| NAV-E2E-2c | On `/models` the Compare Results control is a disabled `<button>` with its visible hint as `aria-describedby` while fewer than two models are trained, and an enabled link to `/results` once two are trained; the sidebar's Compare Results link is enabled in both cases.                                                                                                                            |
| NAV-E2E-2b | For every workflow page and every combination of missing prerequisites, the sidebar link is enabled, navigation succeeds with no redirect (URL and history length as expected), and the page shows the expected `.notification` text from §4.3. When state later satisfies the prerequisite (e.g. a second model finishes training) the same page re-renders to its normal content without navigation. |
| NAV-E2E-3  | Opening a reserved route pushes one entry. Escape or Close goes Back again after a Forward revisit. Direct Back closes once, and the underlay retains scroll. The reserved path stays out of persisted workflow state.                                                                                                                                                                                 |
| NAV-E2E-4  | Direct load of `/help` shows the modal over the persisted resume page; closing replaces rather than leaving the app; Back/Forward behaves coherently.                                                                                                                                                                                                                                                  |
| NAV-E2E-5  | Resize the viewport width, reload: the previous scroll is **not** applied; restore the width, reload: it is.                                                                                                                                                                                                                                                                                           |
| NAV-E2E-6  | Reload during `training` returns to the model page with section 4 active and the interrupted error; a second tab loaded during training does not mark it interrupted.                                                                                                                                                                                                                                  |
| NAV-E2E-7  | Selected column aside and virtual-table offset on `/data` survive a reload.                                                                                                                                                                                                                                                                                                                            |
| NAV-E2E-8  | A user scroll during restoration cancels it.                                                                                                                                                                                                                                                                                                                                                           |
| NAV-E2E-9  | Deep link `/models/3` loads with correct assets (root-absolute URLs) from a cold start. Service-worker routing remains target.                                                                                                                                                                                                                                                                         |

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
5. **Reserved content mapping:** Fixed Help and Privacy articles are live. Should Terms and Conditions have a reserved route?
6. ~~**File rename** to `app-state-and-navigation.md`~~ — done 2026-11-12.
7. ~~**Results**~~ — numbered trained results and workflow comparison are implemented. See [Workflow Steps](workflow-steps.md#6-single-model-results).
