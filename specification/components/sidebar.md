# Spec: Sidebar (`app-sidebar`)

**Status:** implemented · Tier: **Connected component** · Criterion prefix: `SIDE`

## 1. Summary

The workflow navigation, project placeholder, read-only dataset/target/model summaries and reserved-route footer. It presents state without mutating it.

## 2. Decision and rationale

A connected element reads the small sidebar projection and messages through StoreController. A separate presentational layer or application-wide state machine adds no needed boundary. Ordinary links preserve native navigation and router semantics.

## 3. Public API (closed)

Tag `app-sidebar`, class `AppSidebar`, source `src/features/shell/app-sidebar.ts`. Tag only: no custom properties/attributes, reactive properties, slots, events, methods or parts.

The framework-free `src/stores/sidebar.store.ts` exports only read-only `$sidebarState = computed([$appState, $route], …)`: nullable dataset `{name, rows, columns}`, nullable target `{name, type|null}`, model `{num, status, current}` records and current-link values. It imports no Lit/i18n, performs no writes and introduces no persisted schema or actions.

## 4. Usage

```html
<app-sidebar></app-sidebar>
```

Mount once beside document main. Current links retain their href and keyboard focus. Duplicate activation is a router no-op. Exact workflow and trained links use `aria-current="page"` and **All Trained Models** uses `true` on a descendant. The visible new wizard's static status row owns `aria-current="page"`. Reserved overlays retain the row and remove workflow current semantics. Put current semantics on the relevant control or status row, with no nested links.

## 5. Visual specification

Reference pages are `01-1_select-data.html` (empty) and `03-2_train-models-1-choose-model.html` (summaries/models). Sidebar and steps CSS map to component-local rules. Chiclets and numbered swatches use their shared styles.

The host is fixed at inline-start, 25rem wide via sidebar-width, stone-150 with shadow-sidebar, z-index 100 and viewport-height scrolling. Brand is a paragraph styled 1.75rem/600; tagline is 0.875rem/300 with 1rem line-height. Project retains its two-column `minmax(0, 1fr) 2.5rem` grid and reserved settings track. Workflow rows keep joined 1px borders, negative adjacent margin, original grid areas, plain numbers and first/last radii. Current labels use weight 600. Footer separators/text use stone-700, links stone-800.

Step 3 contains the compact **All Trained Models** anchor and a keyed sibling list of acknowledged trained models. Each `a.step-trained-model` shows the number swatch, saved label or catalogue name, localised feature-count chiclet and trained check with accessible text. With a dataset and target, `a.step-train-new` (zero trained models) or `a.step-model-link` (one or more) links to `/models/new`. That route shows **Training New Model…** through completion, then the next real workflow destination takes over. Each row remains legible in RTL and forced colours.

Visual translations and deviations are registered under SEM-01/02/03/09, A11Y-02/09/10/15 and SHELL-UI-01 through SHELL-UI-04. Focus is an inset 2px outline so joined rows do not clip it. Long values and narrow chiclets wrap. The Project section has the translated accessible name and a visible h2.

## 6. Accessibility

Named Workflow nav with one ol containing four li. Brand is not a page heading; Project is h2 and the active route owns h1. Every workflow/model/footer link is reachable by Tab with visible focus. Status is never colour/motion alone. Manual checks cover current-link announcements, full keyboard traversal, 320px/real zoom, RTL, forced colours and reduced motion.

## 7. Internationalisation

Owns brand/tagline, Project/New Project/Workflow, four workflow names, Dataset/Target/Models, row/column plurals, Model {num}, training/trained, Numeric/Categorical/Boolean/Date/Time/Date/time/Text and about/privacy/help. Messages and formatter are StoreControllers. `params(count(...))` receives formatted parameters then raw numeric count; no formatted string chooses a plural. Names are consumer data. Layout tolerates long labels and RTL.

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

`tests/sidebar-acceptance.e2e.ts` runs behaviour across three engines. SIDE-AC-10/11 visual cases run in `tests/visual-parity.e2e.ts` at Chromium 1440×900. Reference normalisation changes text/counts/current fixtures only, never CSS/wrappers/dimensions. Empty/Models screenshot baselines require paired-reference review, zero allowed changed pixels at the default colour threshold, animations disabled and caret hidden; platform baselines stay separate.

## 9. Stories

`src/features/shell/app-sidebar.stories.ts`, `Shell/Sidebar`: Empty, DatasetLoaded, TargetSet, Models, LongLabel and RTL. Browser fixtures and stories cover the first-training link, trained rows and the provisional current route. The sidebar story's nine-column Penguins fixture is separate from the shipped eight-column dataset.

## 10. Files

`src/features/shell/app-sidebar.ts`, its co-located story, `src/stores/sidebar.store.ts`, `tests/sidebar-state.test.ts`, `tests/sidebar-acceptance.e2e.ts`, `tests/visual-parity/fixtures.ts`, parity mappings and screenshot baselines.

## 11. Non-goals

No settings control, drawer/hamburger, next-step guidance, domain mutations, persistence or model lifecycle implementation.

## 12. Open questions

None for this closed shell. Settings/next-step features require separate designs.
