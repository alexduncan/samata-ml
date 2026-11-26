# Spec: Sidebar (`app-sidebar`)

**Status:** implemented · Tier: **Connected component** · Criterion prefix: `SIDE`

## 1. Summary

The workflow navigation, project placeholder, read-only dataset/target/model summaries and reserved-route footer. It presents state without mutating it.

## 2. Decision and rationale

A connected element reads the sidebar summaries, transient cue, and messages through StoreController. Each connected sidebar owns a tracker in the framework-free store module. The tracker reduces captured route and app-state publications in order, and tracks the highest acknowledged trained count in the current dataset and target context. Reconnection seeds a fresh tracker from the reconciled state. Ordinary links preserve native navigation and router semantics.

## 3. Public API (closed)

Tag `app-sidebar`, class `AppSidebar`, source `src/features/shell/app-sidebar.ts`. Tag only: no custom properties/attributes, reactive properties, slots, events, methods or parts.

The internal `src/stores/sidebar.store.ts` module provides read-only `$sidebarState` for dataset, target, trained-model and current-link summaries. `createSidebarCueTracker()` returns a read-only transient cue and start/stop methods for the connected element. The tracker releases both subscriptions when the sidebar disconnects. It adds no persisted data or domain action.

## 4. Usage

```html
<app-sidebar></app-sidebar>
```

Mount once beside document main. Current links retain their href and keyboard focus. Duplicate activation is a router no-op. Exact workflow and trained links use `aria-current="page"` and **All Trained Models** uses `true` on a descendant. The visible new wizard's static status row owns `aria-current="page"`. Reserved overlays retain the row and remove workflow current semantics. Put current semantics on the relevant control or status row, with no nested links.

Follow the [next-step guidance rules](../workflow-steps.md#next-step-guidance) for cue destinations and consumption. Apply the cue to the existing destination link and leave focus and navigation with the learner.

## 5. Visual specification

Reference pages are `01-1_select-data.html` (empty), `02-2_target-set.html` (model-row cue) and `03-2_train-models-1-choose-model.html` (summaries/models). Sidebar and steps CSS map to component-local rules. Chiclets, numbered swatches and the workflow cue use their shared styles.

The host is fixed at inline-start, 25rem wide via sidebar-width, stone-150 with shadow-sidebar, z-index 100 and viewport-height scrolling. Brand is a paragraph styled 1.75rem/600; tagline is 0.875rem/300 with 1rem line-height. Project retains its two-column `minmax(0, 1fr) 2.5rem` grid and reserved settings track. Workflow rows keep joined 1px borders, negative adjacent margin, original grid areas, plain numbers and first/last radii. Current labels use weight 600. Footer separators/text use stone-700, links stone-800.

Step 3 starts as a full-size **Train Models** link to `/models`. Once the dataset and target are set, the numbered row contains the compact **All Trained Models** anchor and a keyed sibling list of acknowledged trained models. Each `a.step-trained-model` shows the number swatch, saved label or catalogue name, localised feature-count chiclet and trained check with accessible text. The model name stays on one line, with an ellipsis when it exceeds its available space and the full name available to assistive technology. Within the list, `a.step-train-new` (zero trained models) or `a.step-model-link` (one or more) links to `/models/new`. That route shows **Training New Model…** through completion, then the next real workflow destination takes over. Each row remains legible in RTL and forced colours.

`workflow-dot.styles.ts` places the round 0.625rem cue in the reserved inline-end space of the suggested link. A new core schedules one animation frame to measure its centre and place a fixed burst in `body`, above the sidebar and below native dialogs. The burst fades and scales once over two seconds, then is removed. It also leaves on cancellation, cue replacement or disconnection. Reduced motion retains the static core. Forced-colours mode uses the system link foreground.

Visual translations and deviations are registered under SEM-01/02/03/09, A11Y-02/09/10/15 and SHELL-UI-01 through SHELL-UI-04. Focus is an inset 2px outline so joined rows do not clip it. Long dataset and target values and narrow chiclets wrap. The Project section has the translated accessible name and a visible h2.

## 6. Accessibility

Named Workflow nav with one ol containing four li. Brand is not a page heading; Project is h2 and the active route owns h1. Every workflow/model/footer link is reachable by Tab with visible focus. Status is never colour/motion alone. Manual checks cover current-link announcements, full keyboard traversal, 320px/real zoom, RTL, forced colours and reduced motion.

The suggested link retains its accessible name, and `aria-describedby` points to a translated, visually hidden **Suggested next step**. The core and burst are hidden from assistive technology. The burst ignores pointer input. Native Safari checks cover the cue centring and clipping, keyboard focus at 200% zoom, and VoiceOver's description of the link.

## 7. Internationalisation

Owns brand/tagline, Project/New Project/Workflow, four workflow names, Dataset/Target/Models, row/column plurals, Model {num}, training/trained, Numeric/Categorical/Boolean/Date/Time/Date/time/Text and about/privacy/help. Messages and formatter are StoreControllers. `params(count(...))` receives formatted parameters then raw numeric count; no formatted string chooses a plural. Names are consumer data. Layout tolerates long labels and RTL.

The sidebar also owns **Suggested next step** as a separate translated description.

## 8. Acceptance criteria

| ID         | Criterion                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------- |
| SIDE-AC-1  | Only the exact workflow link or visible provisional row is current page.                          |
| SIDE-AC-2  | Model detail has current page/current parent; reserved routes have neither.                       |
| SIDE-AC-3  | Every link is keyboard reachable with 2px outline.                                                |
| SIDE-AC-4  | Training/trained indicators have accessible status text.                                          |
| SIDE-AC-5  | Valid four-item list and sibling model links without interactive nesting.                         |
| SIDE-AC-6  | Project h2 and route-owned page h1.                                                               |
| SIDE-AC-7  | 320px long values in both directions, static sidebar above main.                                  |
| SIDE-AC-8  | Reduced motion retains readable status text and removes transitions.                              |
| SIDE-AC-9  | Forced colours retain inset focus.                                                                |
| SIDE-AC-10 | Grouped numeric plurals, strict axe, reference hover/geometry and reviewed screenshots.           |
| SIDE-AC-11 | Temporary 4px workflow gap fails blocking geometry; restoration passes.                           |
| SIDE-AC-12 | Keyed insertion/reordering retains identity/focus; duplicate activation preserves history/scroll. |

DOT-AC-1 through DOT-AC-4 cover the acknowledged destinations, reserved underlays, consumption, result loss and preservation of link names and focus. DOT-AC-5 through DOT-AC-7 cover geometry and cleanup, reduced motion, keyboard, forced colours, narrow RTL reflow and production CSP. DOT-AC-8 synchronises these specifications.

`tests/sidebar-acceptance.e2e.ts` runs behaviour across three engines. SIDE-AC-10/11 visual cases run in `tests/visual-parity.e2e.ts` at Chromium 1440×900. Reference normalisation changes text/counts/current fixtures only, never CSS/wrappers/dimensions. Empty/Models screenshot baselines require paired-reference review, zero allowed changed pixels at the default colour threshold, animations disabled and caret hidden; platform baselines stay separate.

## 9. Stories

`src/features/shell/app-sidebar.stories.ts`, `Shell/Sidebar`: Empty, DatasetLoaded, TargetSet, Models, LongLabel and RTL. Browser fixtures and stories cover the first-training link, trained rows and the provisional current route. The sidebar story's nine-column Penguins fixture is separate from the shipped eight-column dataset.

Suggestion stories exercise every destination, consumption, hydration without replay and a long RTL layout. The manual story replays each cue for native browser checks. `src/styles/workflow-dot.stories.ts` covers the standalone style primitive and its link description.

## 10. Files

`src/features/shell/app-sidebar.ts`, its co-located story, `src/stores/sidebar.store.ts`, the shared workflow-dot styles and story, `tests/sidebar-state.test.ts`, `tests/sidebar-acceptance.e2e.ts`, `tests/workflow-dot-csp.e2e.ts`, `tests/visual-parity/fixtures.ts`, parity mappings and screenshot baselines.

## 11. Non-goals

No settings control, drawer/hamburger, domain mutations, persistence or model lifecycle implementation.

## 12. Open questions

None for this closed shell. A settings control requires a separate design.
