# Beta console errors, CSP, dataset switching and modal harmonisation

**Status:** draft | **Updated:** 2026-11-25T14:32:18Z
**Authors:** Google Antigravity (Gemini 4 Hydrogen High) | **Created:** 2026-11-24T13:46:55Z
**Verified by:** — | **Verified:** — | **Verification:** pending
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour:** Issues observed on `beta.samata.ml` and across modal components:

1. **Lit dev mode in production (`app.*.js`):** `scripts/build-assets.ts` calls `Bun.build(...)` without `NODE_ENV=production` (`package.json` `"build"` and `.github/workflows/ci.yml` `deploy`), causing Lit's `"development"` package export condition (`./development/*.js`) to be bundled instead of the `"default"` production files.
2. **CSP `style-src-attr 'none'` violations (`AppConfusionFlowchart`, `AppComparisonTable`, plus latent sites):** `public/_headers` sets `style-src-attr 'none'`, which blocks HTML `style="..."` attributes including Lit's `styleMap(...)`. This strips runtime `inline-size` widths from `.segment` in `app-confusion-flowchart.ts` and `.bar` in `app-comparison-table.ts`. The same pattern exists in `app-model-builder-view.ts` (`<fieldset style="...">`) and `ui-virtual-table.ts` (`style="block-size: ..."` on `.rail-spacer-top` / `.rail-spacer-bottom`).
3. **Lit `change-in-update` warnings (`AppModelResults`, `AppResultsView`):** Both components call store loaders/actions inside `updated()` that synchronously mutate Nanostores subscribed via `StoreController`, scheduling a new Lit update while `_$didUpdate()` is completing.
4. **Blocked native `autofocus` warning (`2:1` on `/models/2`):** `app-model-builder-view.ts` binds `?autofocus=${this.restoreSubmitFocus}` onto `<app-training-setup>` specifically when an element inside the training step already has focus, triggering native HTML autofocus processing while `document.activeElement` is non-null.
5. **Broken "Change Dataset" flow leaving `/data` empty:** `AppDataView.connectedCallback()` calls `this.fetchCatalogue()` only when `/data` mounts in selection mode. When `/data` mounts in preview mode (e.g. after reload with a dataset loaded), `catalogue` stays `null` (`catalogueStatus === 'idle'`). Confirming **Change Dataset** clears `dataset` and switches `data.mode` to `'select'` in place via `renderAppShell(root)`, and `AppDataView.updated()` resets `tableScrollRestored` without fetching the catalogue, leaving `/data` empty below `.page-header`. No E2E test exercises this transition.
6. **Inconsistent modal markup, non-sticky `.modal-header`, and missing backdrop dismissal:** Dialog styling and markup are fragmented across eight `<dialog>` implementations (`app-content-dialog`, `app-datasheet-dialog`, `app-upload-dataset-dialog`, `app-model-description-dialog`, `app-welcome-modal`, `app-data-view`, `app-target-view`, `app-model-builder-view`):
    - `<dialog>` is the scrollport (`padding: 1.5rem; max-block-size: calc(100dvh - 2rem); overflow: auto`) with an unpinned `.modal-header`, so long dialogs scroll `.modal-header` and the close button off screen.
    - No modal supports `::backdrop` click dismissal, `app-model-description-dialog` and `app-model-builder-view` lack `@close` state synchronisation, and `app-datasheet-dialog` / `app-model-description-dialog` use custom text `✕` `.close-btn` instead of `.btn-icon` SVG.
    - Two-button destructive confirmations diverge across `modal change-dataset-modal` (`app-data-view.ts`), `confirm-dialog` + `.modal-header` + `.notification-alert` (`app-target-view.ts`), and `confirm-dialog` + `.confirm-header` + `.notification-alert` (`app-model-builder-view.ts`).

**Target behaviour:** Production builds bundle Lit's production exports (`NODE_ENV=production`); all components comply with `style-src-attr 'none'` without dropping computed geometry; `app-model-results` and `app-results-view` do not schedule synchronous re-updates inside `updated()`; `<app-training-setup>` restores focus without triggering native HTML `autofocus` warnings; confirming **Change Dataset** on `/data` reliably loads and displays the dataset selection cards (covered by E2E tests); and all `<dialog>` surfaces are harmonised into two clean, consistent patterns backed by shared `dialogStyles` ([`00-2_content-modal.html`](../mockups/00-2_content-modal.html) and [`00-4_confirm-dialog.html`](../mockups/00-4_confirm-dialog.html) drafts queued for CSS review):

1. **Content Modals (`dialog.modal`):** `app-content-dialog`, `app-datasheet-dialog`, `app-model-description-dialog`, plus `app-upload-dataset-dialog` sharing the `.modal` shell (and `app-welcome-modal` as an onboarding `.modal` variant preserving its mandatory beta **Get Started** gate). Sticky `.modal-header` with SVG `.btn-icon` close button (and optional `.header-subtitle`), `scroll-padding-block-start` for unobscured keyboard focus, and easy dismissal via close button, `::backdrop` click (across Chromium, Firefox, and WebKit), or `Esc` (except beta `app-welcome-modal` before **Get Started**).
2. **Confirm Dialogs (`dialog.confirm-dialog`):** `app-data-view` ("Change Dataset"), `app-target-view` ("Change Target"), and `app-model-builder-view` ("Confirm Reopening Section"). Uniform `.confirm-header`, `.confirm-body` with plain `<p>` confirmation text (no `.notification.notification-alert` banner; inline `<p role="alert">` only on save/retry errors), and `.confirm-footer` with two buttons (`.btn` Cancel + `.btn.btn-primary` Confirm). Never dismisses on `::backdrop` click (requires clicking one of the two buttons, while keeping native `Esc` mapped to Cancel when idle).

**Why:** Fix functional regressions, broken CSP-blocked styling, and UX friction discovered on `beta.samata.ml`, unify fragmented dialog code and styles around two clear UX archetypes, and establish a clean console and E2E regression baseline. _(Intentionally left in `draft` so the maintainer can review the draft mockup CSS and append any additional issues before `/verify-plan`.)_

## Scope

**In scope**

- Production `Bun.build` configuration (`NODE_ENV=production`) and regression test coverage for Lit production exports.
- Replacing `style="..."` attributes and `styleMap(...)` bindings across `src/` with CSP-safe `static styles` or CSSOM (`element.style.*`) assignments.
- Deferring or restructuring store-mutating side effects out of `updated()` in `app-model-results.ts` and `app-results-view.ts` while preserving `whenSettled()` and loading/error states.
- Replacing the native `autofocus` attribute on `<app-training-setup>` with a non-native reactive property (`restoreFocus`), and auditing `<dialog>` `autofocus` behaviour for stray warnings.
- Fixing `AppDataView` so transitioning from preview mode to selection mode via **Change Dataset** fetches the sample catalogue if unpopulated, plus dedicated Playwright E2E coverage.
- Harmonising all eight `<dialog>` components and `src/styles/dialog.styles.ts` into Content Modals (`dialog.modal`) and Confirm Dialogs (`dialog.confirm-dialog`), removing per-component duplicated dialog shell CSS.
- Making `.modal-header` sticky in `dialog.styles.ts` with `scroll-padding-block-start` (WCAG 2.4.11) and `closedby="any"` + WebKit pointer-bounds fallback on dismissible `.modal` dialogs, while blocking `::backdrop` dismissal on `.confirm-dialog` and beta `app-welcome-modal`.
- Providing draft static HTML mockups ([`00-2_content-modal.html`](../mockups/00-2_content-modal.html) and [`00-4_confirm-dialog.html`](../mockups/00-4_confirm-dialog.html)) for human CSS review, plus updating `dialog.stories.ts` and component stories.
- Adding production-CSP (`DIST_URL`) Playwright assertions for zero `securitypolicyviolation` events and zero console errors/Lit warnings.
- Syncing affected specifications (`COMPONENTS.md`, `ARCHITECTURE.md`, `workflow-steps.md`, `components/training-setup.md`, `components/dialog.md`, `components/content-modal.md`, `components/welcome-modal.md`).
- Placeholder for additional `beta.samata.ml` issues to be appended by the maintainer before `/verify-plan`.

**Out of scope**

- Weakening `public/_headers` CSP (keep `style-src-attr 'none'` strict).
- Modifying `../web-ml`, `node_modules/`, `vendor/web-ml/`, or `bun.lock`.
- Redesigning Observable Plot chart rendering (`PlotController` already uses CSSOM `.style` assignments).
- Replacing native `<dialog>` with a custom modal wrapper element.
- Editing human-owned `status="implemented"` mockups (`00_first-load.html`, `01-2_dataset-card.html`, `01-3_upload-dataset.html`) or `specification/mockups/css/modal.css` in this plan.

**Constraints and invariants**

- Keep `public/_headers` `style-src-attr 'none'`, COOP `same-origin`, COEP `require-corp`, and CORP `same-origin` unchanged.
- Preserve `AppModelResults.whenSettled()` and `AppResultsView.whenSettled()` settlement semantics and scroll restoration timing.
- Preserve `AppTrainingSetup` focus restoration on cancellation/failure (`tests/training-panels.e2e.ts` L151–L188) and WCAG 2.2 AA focus behaviour.
- `AppDataView` must not trigger Lit `change-in-update` warnings when initiating `fetchCatalogue()` on preview → select transition, and must handle network errors/Retry cleanly.
- Beta `app-welcome-modal` (`$betaDeployment === true`) must remain non-dismissible until **Get Started** is clicked (`beta-release-and-ci-cd.md` D9), and `.confirm-dialog` instances must never dismiss on `::backdrop` click or while busy/publication-pending (keeping native `Esc` = Cancel when idle).
- Sticky `.modal-header` must preserve `modal-dialog` visual parity at scroll offset `0` (`tests/visual-parity/map.ts`) and satisfy WCAG 2.4.11 (Focus Not Obscured) via `scroll-padding-block-start`.
- Backdrop click detection fallback must require both `pointerdown` and `pointerup` outside `dialog.getBoundingClientRect()`, never closing on text-selection drags or clicks on dialog padding/children.
- Confirm Dialog bodies use plain `<p>` text (no `.notification.notification-alert` banner); save/retry failures inside `.confirm-body` retain `role="alert"`.
- Maintain RTL, 200% zoom, forced-colours, and token compliance (`tests/style-tokens.test.ts`).

## Required reading

- `AGENTS.md` §Verification Commands, §Git workflow, §Rules.
- `specification/COMPONENTS.md` §§3–10 (note §4 `styleMap` guidance conflicts with `style-src-attr 'none'` and is updated in T9).
- `specification/ARCHITECTURE.md` §Tech Stack & Tooling, §Delivery and Caching.
- `specification/visual-design.md` §1.1 (Draft mockups), §4 (Translation rules).
- `specification/workflow-steps.md` §1 (Load Data / Change Dataset), §2 (Model Discard Warning).
- `specification/components/model-results.md` §§1–8.
- `specification/components/results-comparison.md` §§1–8.
- `specification/components/training-setup.md` §§1–8.
- `specification/components/virtual-table.md` §§1–8.
- `specification/components/dialog.md` §§1–8.
- `specification/components/content-modal.md` §§1–8.
- `specification/components/welcome-modal.md` §§1–8.

## Codebase context

Facts verified by `codebase-scout` on 2026-11-24 and 2026-11-25:

- **Relevant specifications:** `specification/COMPONENTS.md` (partial) §4 L74 prescribes `styleMap()` for runtime inline styles, conflicting with `public/_headers` `style-src-attr 'none'`. `specification/components/training-setup.md` (implemented) §3 lists a closed `attribute: false` API without `autofocus`. `specification/components/dialog.md` (implemented) §5 documents `dialog` padding/overflow and `.modal-header`, §11 excludes light-dismiss. `specification/components/content-modal.md` (implemented), `specification/components/welcome-modal.md` (implemented), `specification/components/model-results.md` (implemented), `specification/components/results-comparison.md` (implemented), `specification/components/virtual-table.md` (implemented), `specification/ARCHITECTURE.md` (partial), `specification/workflow-steps.md` (partial).
- **Build and CI:** `package.json#L7,L73` (`"build": "bun run scripts/build.ts"`, `"lit": "^3.3.3"`); `scripts/build.ts#L1-L83`; `scripts/build-assets.ts#L216-L227,L290-L305` (omits `NODE_ENV=production`); `.github/workflows/ci.yml#L61,L108,L145`; `node_modules/@lit/reactive-element/package.json#L22-L31`, `node_modules/lit-html/package.json#L18-L27`, `node_modules/lit-element/package.json#L21-L25`.
- **CSP and inline styles:** `public/_headers#L2` (`style-src 'self' 'unsafe-inline'; style-src-attr 'none';`); `scripts/release-headers.ts#L18-L55,L69-L191`; `src/features/results/app-confusion-flowchart.ts#L4,L122-L124`; `src/features/results/app-comparison-table.ts#L4,L135`; `src/features/models/app-model-builder-view.ts#L1259`; `src/components/ui-virtual-table.ts#L491,L519`; `src/features/results/charts/plot-controller.ts#L122-L127` (already uses CSSOM `.style`); `src/common/content/fragment-policy.ts#L44-L55,L127-L160`.
- **Lit `change-in-update`:** `src/features/results/app-model-results.ts#L522-L525,L583-L586` (`loadModelResults` in `updated()`); `src/stores/model-results.store.ts#L49,L54,L57-L64,L97-L108`; `src/features/results/app-results-view.ts#L207-L212,L329-L356`; `src/stores/comparison.store.ts#L117-L124,L132-L145,L182-L248`.
- **Autofocus:** `src/features/models/app-model-builder-view.ts#L549,L575-L580,L1898`; `src/features/models/app-training-setup.ts#L145-L149`; `src/features/shell/app-welcome-modal.ts#L187`; `src/features/target/app-target-view.ts#L567`.
- **Change Dataset & `/data`:** `src/features/data/app-dataset-preview.ts#L26,L231-L238,L353-L355` (`app-preview-change-dataset`); `src/features/data/app-data-view.ts#L51,L261-L285,L308-L327,L486-L540,L542-L627,L670-L707` (`fetchCatalogue()` only in `connectedCallback` `else` branch, omitted in `updated()` `else` branch); `src/stores/dataset.store.ts#L309-L318` (`changeDataset`); `src/stores/app.store.ts#L191-L247` (`reduceDatasetReplacement`, `setDataMode`); `src/app.ts#L97-L98,L309-L315` (updates `<app-data-view>` in place).
- **Dialogs & `.modal-header`:** `specification/mockups/css/modal.css#L1-L37`; `src/styles/dialog.styles.ts#L7-L44`; `src/styles/dialog.stories.ts#L6-L30`; `src/features/shell/app-welcome-modal.ts#L51-L53,L98-L169` (no `.modal`, beta blocks `cancel` / reopens on `close`); `src/features/shell/app-content-dialog.ts#L63-L69,L103-L171` (no `.modal`, `.btn-icon` SVG, `.modal-body`); `src/features/data/app-datasheet-dialog.ts#L16-L55,L183-L212,L252-L273` (`.modal`, text `✕` `.close-btn`, `.modal-content`); `src/features/data/app-upload-dataset-dialog.ts#L30-L56,L241-L274,L370-L424` (`.modal`, `.btn-icon` SVG); `src/features/models/app-model-description-dialog.ts#L39-L78,L213-L236,L317-L336` (`.modal`, text `✕` `.close-btn`, lacks `@close`); `src/features/data/app-data-view.ts#L170-L200,L505-L511,L670-L707` (`.modal.change-dataset-modal`, `.modal-header/body/footer`); `src/features/target/app-target-view.ts#L125-L155,L311-L345,L541-L584` (`.confirm-dialog`, `.modal-header/body/footer`, `.notification-alert`); `src/features/models/app-model-builder-view.ts#L453-L483,L733-L764,L1999-L2021` (`.confirm-dialog`, `.confirm-header/body/footer`, `.notification-alert`, lacks `@cancel`/`@close`).
- **Tests and commands:** `tests/build-cache-invalidation.test.ts#L94-L379`, `tests/headers-file.test.ts`, `tests/style-tokens.test.ts#L180-L327`, `tests/virtual-table.e2e.ts#L6-L431`, `tests/model-results.e2e.ts#L50-L468`, `tests/comparison.e2e.ts#L4-L440`, `tests/comparison-charts.e2e.ts#L11-L89`, `tests/training-panels.e2e.ts#L151-L188`, `tests/data-selection.e2e.ts#L151-L202`, `tests/data-preview.e2e.ts`, `tests/data-upload.e2e.ts#L19-L108`, `tests/content-dialog.e2e.ts`, `tests/content.e2e.ts`, `tests/app-shell.e2e.ts#L519-L522`, `tests/target.e2e.ts#L139-L304`, `tests/a11y.e2e.ts#L225-L229` (dead `changeBtn` check with stale `.btn-danger`), `tests/telemetry-acceptance.e2e.ts#L280-L296`.
- **Web guidance:** `light-dismiss-a-dialog`, `dialog`, `state-aware-sticky-headers` (skill version `2026_11_09-5bcc021b`) — `closedby="any"` is Limited Availability (Chrome 134+, Edge 134+, Firefox 141+; unsupported in Safari), so a `!('closedBy' in HTMLDialogElement.prototype)` `pointerdown`/`pointerup` bounds fallback is mandatory; `scroll-padding-block-start` prevents sticky headers from obscuring focused elements (WCAG 2.4.11).
- **Visual reference:** Draft mockups [`00-2_content-modal.html`](../mockups/00-2_content-modal.html) and [`00-4_confirm-dialog.html`](../mockups/00-4_confirm-dialog.html) (`status="draft"`, queued in `specification/HUMAN.md` §6 for human CSS review in `css/modal.css`), plus existing `00_first-load.html` / `css/modal.css` and `tests/visual-parity/map.ts` (`modal-dialog` entry has no drift exemption at scroll `0`).
- **Domain skills:** `lit-component-implementer` for T2, T3, T4, T5, T6, T7.
- **Assumptions requiring verification:** Confirm during T4 whether `<button autofocus>` inside `<dialog>` in `app-welcome-modal.ts` or `app-target-view.ts` emits any `Autofocus processing was blocked` warning in Chromium, Firefox, or WebKit when navigated or opened.

## Technical decisions

| Decision                                 | Chosen approach and rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Rejected alternative / trade-off                                                                                                                                                                                             |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production Lit bundling                  | Ensure `NODE_ENV=production` is set for `buildProductionBundle` (`scripts/build-assets.ts` / `package.json` `build` script and `ci.yml` as needed), restoring prior `NODE_ENV` if `buildProductionBundle` sets it programmatically during `runBuild` in tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Passing `conditions: ['production']` alone to `Bun.build` still resolved Lit's `./development/*` entrypoints in local verification.                                                                                          |
| CSP-compliant dynamic sizing             | Keep `style-src-attr 'none'` in `public/_headers`. Move static `style="..."` to `static styles`, and apply runtime-computed dimensions (`inlineSize`, `blockSize`/`height`) via CSSOM (`element.style.*` in Lit `ref()` / `updated()`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Allowing `'unsafe-inline'` or hashes in `style-src-attr` weakens CSP and fails for continuous percentage widths.                                                                                                             |
| Post-render store loading                | Defer `loadModelResults`, `loadComparisonResults`, `selectComparisonGroup`, `requestComparisonAnalysis`, and `clearRopeAnalysis` out of synchronous `updated()` execution (e.g. via `queueMicrotask` guarded by connection/identity checks).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Suppressing warnings only via Lit production mode leaves redundant double-render cycles in place.                                                                                                                            |
| Non-native focus restoration             | Replace `?autofocus=${this.restoreSubmitFocus}` on `<app-training-setup>` with an unreflected property `restoreFocus: boolean = false` (`attribute: false`), focusing `button[type="submit"]` in `firstUpdated()` when `this.restoreFocus && !this.controlsDisabled`.                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Keeping HTML `autofocus` triggers native browser autofocus processing while `[data-testid="training-step"]` already holds focus.                                                                                             |
| Change Dataset catalogue fetch           | In `AppDataView`, trigger `fetchCatalogue()` whenever selection mode is active and `catalogueStatus === 'idle'` (both in `connectedCallback` and when entering selection mode after `updated()`, deferred via `queueMicrotask` or guarded in `willUpdate()` so it does not trigger `change-in-update`).                                                                                                                                                                                                                                                                                                                                                                                                                          | Unconditionally fetching on every `connectedCallback` wastes network requests in preview mode unless guarded, and wouldn't solve in-place updates from `renderAppShell`.                                                     |
| Two-type modal harmonisation             | Harmonise all eight dialogs in `src/styles/dialog.styles.ts` into two archetypes: **`dialog.modal`** (`40rem`, sticky `.modal-header`, `.btn-icon` SVG close button, optional `.header-titles` / `.header-subtitle`, `.modal-content`) covering `app-content-dialog`, `app-datasheet-dialog`, `app-model-description-dialog`, `app-upload-dataset-dialog` (sharing `.modal` shell), and `app-welcome-modal` (onboarding variant preserving its beta consent gate); and **`dialog.confirm-dialog`** (`32rem`, `.confirm-header`, plain-text `.confirm-body`, `.confirm-footer` two-button row) covering `app-data-view`, `app-target-view`, and `app-model-builder-view`. Remove duplicated shell CSS from individual components. | Keeping eight divergent component-local dialog stylesheets perpetuates visual drift, mismatched close buttons, and stale `.modal` / `.confirm-header` names.                                                                 |
| Sticky `.modal-header` in `dialogStyles` | Keep `<dialog>` as the scroll container (preserving `modal-dialog` parity at scroll `0`) and pin `.modal-header` via `position: sticky; inset-block-start: -1.5rem; z-index: 1; margin-block-start: -1.5rem; margin-inline: -1.5rem; padding-block: 1.5rem 1rem; padding-inline: 1.5rem; background-color: var(--surface);`, plus `scroll-padding-block-start` on `dialog` (WCAG 2.4.11).                                                                                                                                                                                                                                                                                                                                        | Requiring every consumer to add a separate internal scrolling body breaks `app-welcome-modal` and `dialog.stories.ts` parity.                                                                                                |
| Backdrop click light-dismiss             | Enable `closedby="any"` + shared framework-free `pointerdown`/`pointerup` bounds fallback (`!('closedBy' in HTMLDialogElement.prototype)`) for `.modal` dialogs (`app-content-dialog`, `app-datasheet-dialog`, `app-upload-dataset-dialog`, `app-model-description-dialog`, non-beta `app-welcome-modal`). Beta `app-welcome-modal` uses `closedby="none"` (no backdrop close). `.confirm-dialog` instances never close on `::backdrop` click while keeping native `Esc` = Cancel when idle. Wire missing `@close` sync on `app-model-description-dialog` and `app-model-builder-view`.                                                                                                                                          | Checking `event.target === dialog` on `click` closes dialogs on padding/gap clicks or text-selection drags (`modern-web-guidance` `dialog`). Blocking `Esc` on `.confirm-dialog` breaks WCAG/workflow keyboard expectations. |

### Interfaces and behaviour

- **`AppTrainingSetup` (`src/features/models/app-training-setup.ts`, Tier 2 Presentational):**
    - Add `@property({ attribute: false }) accessor restoreFocus = false;` (default `false`, unreflected).
    - Remove `this.hasAttribute('autofocus')` check in `firstUpdated()`; replace with `if (this.restoreFocus && !this.controlsDisabled)` focusing `button[type="submit"]`.
    - In `AppModelBuilderView` (`src/features/models/app-model-builder-view.ts`), bind `.restoreFocus=${this.restoreSubmitFocus}` instead of `?autofocus=${this.restoreSubmitFocus}`.
- **`AppConfusionFlowchart`, `AppComparisonTable`, `UiVirtualTable`:** Closed public APIs remain unchanged; `.segment`, `.bar`, and `.rail-spacer-top` / `.rail-spacer-bottom` receive computed sizes via CSSOM rather than `style="..."` attributes.
- **`AppDataView` (`src/features/data/app-data-view.ts`):** Closed public API unchanged; `data.mode === 'select'` (or `!dataset`) with `catalogueStatus === 'idle'` initiates `fetchCatalogue()` on both initial mount and in-place transition from preview mode. Change-dataset dialog adopts `<dialog class="confirm-dialog">` with `.confirm-header` / `.confirm-body` / `.confirm-footer`.
- **Harmonised `dialogStyles` (`src/styles/dialog.styles.ts`):**
    - Base `dialog` and `dialog::backdrop` rules remain for bare `<dialog>` compatibility (`scroll-padding-block-start` included).
    - `dialog.modal` (`40rem`), sticky `.modal-header` (`<h2>`, optional `.header-titles` / `.header-subtitle`, `.btn-icon` SVG close button), and `.modal-content` (and `.modal-body` alias during transition if needed, or unified `.modal-content`).
    - `dialog.confirm-dialog` (`32rem`), `.confirm-header` (`<h2>`), `.confirm-body` (plain `<p>` copy + optional `<p role="alert">` error), `.confirm-footer` (`.btn` Cancel + `.btn.btn-primary` Confirm).
- **Backdrop dismiss helper (`src/common/dom/dialog-backdrop.ts`, framework-free module per `COMPONENTS.md` §3 >3 call sites):**
    - Attaches `pointerdown`/`pointerup` listeners on a `<dialog>` only when `!('closedBy' in HTMLDialogElement.prototype)` (or enforces `canClose()` guard), returning a cleanup function for `disconnectedCallback()`.
    - Applied to `.modal` dialogs (`app-content-dialog`, `app-datasheet-dialog`, `app-upload-dataset-dialog`, `app-model-description-dialog`, and non-beta `app-welcome-modal` with `canClose` checking `!betaDeployment`). Never attached to `.confirm-dialog`.
- **Additional beta issues (pending maintainer additions):** Reserve space in `## Implementation tasks` / `## Scope` when further issues from `beta.samata.ml` are added before submission.

## Specification changes

- [ ] `specification/COMPONENTS.md` §4 (`Rendering`), §5 (Modal overlays) — Replace `styleMap()` guidance for runtime styles with CSP-safe CSSOM (`element.style.*`) or native elements (`<progress>`, SVG) under `style-src-attr 'none'`; document the two modal patterns (`dialog.modal` vs `dialog.confirm-dialog`), sticky `.modal-header`, and `closedby="any"` + fallback allowance; status stays `partial`.
- [ ] `specification/components/training-setup.md` §3 (`Public API`) — Add `restoreFocus` (`boolean`, default `false`, `attribute: false`) to the closed property table; status stays `implemented`.
- [ ] `specification/components/dialog.md` §§1–11 — Document the two shared patterns (`dialog.modal` and `dialog.confirm-dialog`), sticky `.modal-header`, `scroll-padding-block-start`, `dialog.modal` backdrop light-dismiss + WebKit fallback, and `.confirm-dialog` button-or-Esc-only rule; update Visual specification / parity references once human promotes `00-2_content-modal.html` and `00-4_confirm-dialog.html`; status stays `implemented`.
- [ ] `specification/components/content-modal.md` §§3, 4, 5, 6 — Document `.modal` / `.modal-content` alignment and that backdrop click emits `app-content-dialog-close` once via native close; status stays `implemented`.
- [ ] `specification/components/welcome-modal.md` §§5, 6 — Note `class="modal"` alignment and non-beta backdrop dismissal vs beta consent lock; status stays `implemented`.
- [ ] `specification/workflow-steps.md` §§1–3 — Note plain-text `.confirm-dialog` presentation across Change Dataset, Change Target, and Reopen Section; status stays `partial`.
- [ ] `specification/ARCHITECTURE.md` §Delivery and Caching — Document that production builds run with `NODE_ENV=production` so Lit resolves production exports; status stays `partial`.

## Implementation tasks

### T1 — Bundle Lit in production mode for `dist/` releases

- **Depends on:** None
- **Risk:** routine
- **Likely files:** `scripts/build-assets.ts`, `package.json`, `.github/workflows/ci.yml`, `tests/build-cache-invalidation.test.ts`
- **Must not touch:** `../web-ml/`, `node_modules/`, `bun.lock`, `public/_headers`
- **Implementation:** Ensure `buildProductionBundle` runs `Bun.build` with `NODE_ENV=production` (setting/restoring `process.env.NODE_ENV` around `Bun.build` when `mode === 'production'` so both CLI and programmatic test invocations produce production Lit bundles, and setting `NODE_ENV=production` in `package.json` `"build"` or `.github/workflows/ci.yml` if needed). Add a test in `tests/build-cache-invalidation.test.ts` verifying emitted `/bundles/app.*.js` (and chunks) from `buildProductionBundle` do not contain `"Lit is in dev mode"`.
- **Acceptance criteria:**
    - [ ] `BETA-ERR-1`: `buildProductionBundle` bundles Lit's production (`"default"`) exports with zero occurrences of `"Lit is in dev mode"` in emitted JS.
    - [ ] `BETA-ERR-1b`: `buildDevBundle` continues to include development diagnostics and source maps.
- **Verification:** `bun test tests/build-cache-invalidation.test.ts`, `bun run deploy:dry-run`
- **Progress:** [ ] Not started

### T2 — Remove `style="..."` attributes and `styleMap()` bindings violating `style-src-attr 'none'`

- **Depends on:** None
- **Risk:** needs care — touches virtual-table scrolling and results charts/tables across shadow roots.
- **Likely files:** `src/features/results/app-confusion-flowchart.ts`, `src/features/results/app-comparison-table.ts`, `src/features/models/app-model-builder-view.ts`, `src/components/ui-virtual-table.ts`, `tests/style-tokens.test.ts`, `tests/results-errors.e2e.ts`, `tests/comparison.e2e.ts`, `tests/virtual-table.e2e.ts`
- **Must not touch:** `public/_headers`, `../web-ml/`, `specification/mockups/`
- **Implementation:**
    1. In `src/features/results/app-confusion-flowchart.ts`, remove `styleMap` and apply `inlineSize` (`${outcome.share * 100}%`) via CSSOM (`ref()` callback or `updated()`).
    2. In `src/features/results/app-comparison-table.ts`, remove `styleMap` and apply `inlineSize` (`${width}%`) via CSSOM (`ref()` callback or `updated()`).
    3. In `src/features/models/app-model-builder-view.ts`, move `<fieldset style="border: 0; padding: 0; margin: 0;">` styling into `static styles` for `#features-form fieldset`.
    4. In `src/components/ui-virtual-table.ts`, replace `style="block-size: ${...}px; height: ${...}px;"` on `.rail-spacer-top` and `.rail-spacer-bottom` with CSSOM (`el.style.blockSize` and `el.style.height` set via `ref()` / `updated()`).
    5. Add a static check in `tests/style-tokens.test.ts` rejecting `styleMap(` or literal `style="` in `src/` (excluding `*.stories.ts`).
- **Acceptance criteria:**
    - [ ] `BETA-ERR-2`: No non-story file in `src/` emits an HTML `style="..."` attribute or imports `styleMap`.
    - [ ] `BETA-ERR-2b`: Under `dist/_headers` CSP (`style-src-attr 'none'`), `app-confusion-flowchart` segments and `app-comparison-table` bars render with expected computed `inline-size`, `ui-virtual-table` spacers scroll accurately, and zero `securitypolicyviolation` events occur.
- **Verification:** `bun run check`, `bun run test:stories`, `bun run test:e2e tests/virtual-table.e2e.ts tests/comparison.e2e.ts tests/results-errors.e2e.ts`
- **Progress:** [ ] Not started

### T3 — Fix `change-in-update` in `app-model-results` and `app-results-view`

- **Depends on:** None
- **Risk:** needs care — `whenSettled()` and `StoreController` timing must remain race-free across fast route transitions.
- **Likely files:** `src/features/results/app-model-results.ts`, `src/features/results/app-results-view.ts`, `tests/model-results.e2e.ts`, `tests/comparison.e2e.ts`
- **Must not touch:** `src/stores/model-results.store.ts` (unless a clean action/helper is needed without changing semantics), `../web-ml/`
- **Implementation:** In `AppModelResults.updated()` and `AppResultsView.updated()`, avoid synchronously mutating stores observed by `StoreController` during Lit's `_$didUpdate()` phase. Defer side-effect triggers (`loadModelResults`, `loadComparisonResults`, `selectComparisonGroup`, `requestComparisonAnalysis`, `clearRopeAnalysis`) to a guarded microtask (`queueMicrotask`, checking `this.isConnected` and current state/identity before running, and cancelling superseded microtasks on disconnect/re-update) while ensuring `whenSettled()` still waits for the triggered load/analysis to settle.
- **Acceptance criteria:**
    - [ ] `BETA-ERR-3`: Rendering `app-model-results` and `app-results-view` in dev and production modes produces zero Lit `change-in-update` warnings.
    - [ ] `BETA-ERR-3b`: `whenSettled()`, scroll restoration, default group selection, and ROPE analysis still complete identically on initial load, reload, and route change.
- **Verification:** `bun run check`, `bun run test:stories`, `bun run test:e2e tests/model-results.e2e.ts tests/comparison.e2e.ts tests/comparison-charts.e2e.ts`
- **Progress:** [ ] Not started

### T4 — Replace native `autofocus` attribute on `<app-training-setup>` and verify dialog autofocus

- **Depends on:** None
- **Risk:** routine
- **Likely files:** `src/features/models/app-model-builder-view.ts`, `src/features/models/app-training-setup.ts`, `src/features/models/app-training-setup.stories.ts`, `tests/training-panels.e2e.ts`
- **Must not touch:** `src/features/shell/app-welcome-modal.ts` and `src/features/target/app-target-view.ts` unless E2E verification proves they also emit the warning
- **Implementation:** Add `restoreFocus = false` (`@property({ attribute: false })`) on `AppTrainingSetup`, use it in `firstUpdated()` instead of `this.hasAttribute('autofocus')`, and bind `.restoreFocus=${this.restoreSubmitFocus}` in `app-model-builder-view.ts`. Verify in Playwright whether `<button autofocus>` inside `<dialog>` in `app-welcome-modal.ts` or `app-target-view.ts` also emits `Autofocus processing was blocked` in Chromium/Firefox/WebKit; if so, handle via explicit dialog focus or report in plan.
- **Acceptance criteria:**
    - [ ] `BETA-ERR-4`: Cancelling or failing training on `/models/2` restores focus to `Train Model` without emitting `Autofocus processing was blocked because a document already has a focused element.`
    - [ ] `BETA-ERR-4b`: Normal navigation to `/models/2` and welcome/confirm modal flows emit no autofocus console warnings.
- **Verification:** `bun run check`, `bun run test:stories`, `bun run test:e2e tests/training-panels.e2e.ts`
- **Progress:** [ ] Not started

### T5 — Fix "Change Dataset" catalogue reload on `/data` and add E2E tests

- **Depends on:** None
- **Risk:** needs care — in-place `AppDataView` transitions must avoid `change-in-update`, stale catalogue races, and dead test assertions.
- **Likely files:** `src/features/data/app-data-view.ts`, `tests/data-preview.e2e.ts`, `tests/data-selection.e2e.ts`, `tests/a11y.e2e.ts`
- **Must not touch:** `src/stores/dataset.store.ts`, `src/stores/app.store.ts`, `../web-ml/`
- **Implementation:** In `AppDataView`, ensure that whenever `/data` enters selection mode (`!state.dataset || state.data.mode === 'select'`) and `this.catalogueStatus === 'idle'`, `fetchCatalogue()` is scheduled (deferred safely outside synchronous `updated()` if setting `@state()` `catalogueStatus = 'loading'`, or guarding against re-entrant updates), while keeping failure/Retry handling intact. Add Playwright E2E tests in `tests/data-preview.e2e.ts` (or `tests/data-selection.e2e.ts`) covering: (1) load dataset → reload `/data` directly in preview mode → click **Change Dataset** → confirm → sample dataset cards render and a new dataset can be loaded; (2) clicking **Change Dataset** → Cancel keeps the current preview intact. Repair the dead `changeBtn` / `.btn-danger` check in `tests/a11y.e2e.ts` if needed.
- **Acceptance criteria:**
    - [ ] `BETA-DATA-1`: Reloading `/data` with an active dataset and confirming **Change Dataset** loads and renders `.cards` with sample datasets without needing a page refresh.
    - [ ] `BETA-DATA-2`: Cancelling **Change Dataset** preserves the loaded dataset preview and target/models; after confirming **Change Dataset**, loading another sample dataset succeeds.
    - [ ] `BETA-DATA-3`: Error state when `/datasets/index.json` fails after **Change Dataset** displays the alert and Retry recovers the catalogue.
- **Verification:** `bun run check`, `bun run test:e2e tests/data-preview.e2e.ts tests/data-selection.e2e.ts tests/a11y.e2e.ts`
- **Progress:** [ ] Not started

### T6 — Harmonise Content Modal (`.modal`) and Confirm Dialog (`.confirm-dialog`) CSS and sticky `.modal-header`

- **Depends on:** None
- **Risk:** needs care — affects `modal-dialog` visual parity (`tests/visual-parity.e2e.ts`) and all eight `<dialog>` components.
- **Likely files:** `src/styles/dialog.styles.ts`, `src/styles/dialog.stories.ts`, `src/features/shell/app-content-dialog.ts`, `src/features/shell/app-welcome-modal.ts`, `src/features/data/app-datasheet-dialog.ts`, `src/features/data/app-upload-dataset-dialog.ts`, `src/features/models/app-model-description-dialog.ts`, `src/features/data/app-data-view.ts`, `src/features/target/app-target-view.ts`, `src/features/models/app-model-builder-view.ts`, `tests/app-shell.e2e.ts`, `tests/visual-parity.e2e.ts`, `tests/target.e2e.ts`
- **Must not touch:** `specification/mockups/`, `tests/visual-parity/map.ts` (parity should pass at scroll `0`)
- **Implementation:**
    1. In `src/styles/dialog.styles.ts`, define shared rules for:
        - Base `dialog` and `dialog::backdrop` plus `scroll-padding-block-start` (WCAG 2.4.11).
        - `dialog.modal` (`40rem`), sticky `.modal-header` (`position: sticky; inset-block-start: -1.5rem; z-index: 1; margin-block-start: -1.5rem; margin-inline: -1.5rem; padding-block: 1.5rem 1rem; padding-inline: 1.5rem; background-color: var(--surface);`, optional `.header-titles` / `.header-subtitle` and `border-block-end` if promoted in `css/modal.css`), and `.modal-content`.
        - `dialog.confirm-dialog` (`32rem`), `.confirm-header` (`<h2>`), `.confirm-body` (plain `<p>` copy, inline `role="alert"` error), and `.confirm-footer` (`flex`, `justify-content: flex-end`, `gap: 0.75rem`).
    2. Harmonise **Content Modals** (`app-content-dialog`, `app-datasheet-dialog`, `app-model-description-dialog`, `app-upload-dataset-dialog`, and onboarding variant `app-welcome-modal`) onto `<dialog class="modal">` with `<header class="modal-header">`, SVG `.btn-icon` close button (replacing custom text `✕` `.close-btn` in `app-datasheet-dialog` and `app-model-description-dialog`, while `app-welcome-modal` retains its single primary **Get Started** action), and `.modal-content`. Remove duplicated dialog shell CSS from those components.
    3. Harmonise **Confirm Dialogs** (`app-data-view`, `app-target-view`, `app-model-builder-view`) onto `<dialog class="confirm-dialog">` with `.confirm-header`, `.confirm-body` (plain `<p>` text only — remove `.notification.notification-alert` banners from `app-target-view` and `app-model-builder-view` confirm bodies, keeping `role="alert"` only for failure/retry notices), and `.confirm-footer` (`.btn` Cancel + `.btn.btn-primary` Confirm). Remove duplicated confirm shell CSS from those components.
    4. Update `src/styles/dialog.stories.ts` (`Default`, `LongContent`, `RTL`, and add a `ConfirmDialog` story) to verify sticky `.modal-header` stays pinned when scrolled and `.confirm-dialog` renders cleanly. If the maintainer promotes updated `css/modal.css` from `00-2_content-modal.html` and `00-4_confirm-dialog.html` before implementation, align token/computed values with the promoted mockups.
- **Acceptance criteria:**
    - [ ] `DLG-HARM-1`: Every Content Modal (`app-content-dialog`, `app-datasheet-dialog`, `app-upload-dataset-dialog`, `app-model-description-dialog`, `app-welcome-modal`) uses `dialog.modal` and shared `dialogStyles` with SVG `.btn-icon` close button (except `app-welcome-modal`).
    - [ ] `DLG-HARM-2`: Every Confirm Dialog (`app-data-view`, `app-target-view`, `app-model-builder-view`) uses `dialog.confirm-dialog`, `.confirm-header`, plain-text `.confirm-body` (no `.notification-alert` banner), and `.confirm-footer` two-button layout.
    - [ ] `DLG-STICKY-1`: When a tall `.modal` scrolls vertically, `.modal-header` remains pinned at the top of the dialog scrollport with opaque `var(--surface)` background, and tabbing through scrolled content never hides focus behind `.modal-header`.
    - [ ] `DLG-STICKY-2`: `modal-dialog` visual parity in `tests/visual-parity.e2e.ts` passes at scroll `0`.
- **Verification:** `bun run check`, `bun run test:stories`, `bun run test:e2e tests/app-shell.e2e.ts tests/content-dialog.e2e.ts tests/visual-parity.e2e.ts tests/target.e2e.ts tests/data-selection.e2e.ts tests/data-upload.e2e.ts`
- **Progress:** [ ] Not started

### T7 — Add `::backdrop` dismissal to Content Modals while keeping Confirm Dialogs button/Esc-only

- **Depends on:** T6
- **Risk:** needs care — must preserve beta onboarding enforcement, Confirm Dialog safety, Safari/WebKit compatibility, and invoker focus return.
- **Likely files:** `src/common/dom/dialog-backdrop.ts`, `src/features/shell/app-content-dialog.ts`, `src/features/shell/app-welcome-modal.ts`, `src/features/data/app-datasheet-dialog.ts`, `src/features/data/app-upload-dataset-dialog.ts`, `src/features/models/app-model-description-dialog.ts`, `src/features/models/app-model-builder-view.ts`, `src/styles/dialog.stories.ts`, `tests/content-dialog.e2e.ts`, `tests/app-shell.e2e.ts`, `tests/welcome-acceptance.e2e.ts`, `tests/target.e2e.ts`, `tests/data-preview.e2e.ts`
- **Must not touch:** `src/router/`, `src/stores/persister.ts`, `../web-ml/`
- **Implementation:**
    1. Create a small framework-free helper (`src/common/dom/dialog-backdrop.ts`) implementing the `modern-web-guidance` `dialog-closedby` fallback for browsers lacking `'closedBy' in HTMLDialogElement.prototype` (Safari/WebKit): record `pointerdown` outside `dialog.getBoundingClientRect()`, and on `pointerup` outside `dialog.getBoundingClientRect()` call `dialog.close()` if `canClose()` allows.
    2. Set `closedby="any"` and attach the fallback helper on dismissible `.modal` dialogs (`app-content-dialog`, `app-datasheet-dialog`, `app-upload-dataset-dialog`, `app-model-description-dialog`, and non-beta `app-welcome-modal` with `canClose` checking `!betaDeployment`). Beta `app-welcome-modal` sets `closedby="none"` and ignores backdrop clicks.
    3. Leave all three `.confirm-dialog` instances (`app-data-view`, `app-target-view`, `app-model-builder-view`) without `closedby="any"` and without the backdrop helper so `::backdrop` clicks never close them (native `Esc` remains mapped to Cancel when idle, and blocked when busy/pending).
    4. Fix missing `@close` state synchronisation in `app-model-description-dialog.ts` and `app-model-builder-view.ts` (`confirm-dialog`) so native close resets `open` / `pendingReopenSection` cleanly.
    5. Add E2E and story tests across Chromium, Firefox, and WebKit verifying: backdrop click closes Content Modals and restores invoker focus; dragging from inside a modal onto the backdrop does not close; clicking `::backdrop` on any `.confirm-dialog` or beta `app-welcome-modal` leaves the dialog open; pressing `Esc` on an idle `.confirm-dialog` cancels safely.
- **Acceptance criteria:**
    - [ ] `DLG-BACKDROP-1`: Clicking and releasing on `::backdrop` outside any `.modal` (except beta `app-welcome-modal`) closes it, emits its close intent once (`app-content-dialog-close` for content dialog), resets component state, and restores invoker focus across Chromium, Firefox, and WebKit.
    - [ ] `DLG-BACKDROP-2`: Dragging text selection onto the backdrop or clicking dialog padding/gaps leaves `.modal` open; clicking `::backdrop` on any `.confirm-dialog` or beta `app-welcome-modal` leaves it open; clicking either `.confirm-dialog` button (or pressing `Esc` when idle) performs the expected confirm/cancel transition.
- **Verification:** `bun run check`, `bun run test:stories`, `bun run test:e2e tests/content-dialog.e2e.ts tests/app-shell.e2e.ts tests/welcome-acceptance.e2e.ts tests/target.e2e.ts tests/data-selection.e2e.ts tests/data-upload.e2e.ts tests/data-preview.e2e.ts`
- **Progress:** [ ] Not started

### T8 — Add production-CSP and clean-console E2E regression test

- **Depends on:** T1, T2, T3, T4, T5, T6, T7
- **Risk:** routine
- **Likely files:** `tests/csp-and-console.e2e.ts`
- **Must not touch:** `public/_headers`, `src/`
- **Implementation:** Add a Playwright test running against `DIST_URL` (which enforces `dist/_headers`) that attaches `page.on('console', ...)`, `page.on('pageerror', ...)`, and a document `securitypolicyviolation` listener across data preview (virtual table), **Change Dataset** → re-load, target selection, `/models/2` training setup + single-model results, `/results` comparison, and Content Modal scroll/backdrop-close + Confirm Dialog backdrop-ignored flows, asserting zero CSP violations, zero page errors, and zero console error/Lit-warning messages.
- **Acceptance criteria:**
    - [ ] `BETA-ERR-5`: Production server (`DIST_URL`) flow across all four workflow steps, `/results`, **Change Dataset**, and both dialog types produces zero `securitypolicyviolation` events, zero `pageerror`s, and zero console errors or Lit warnings in Chromium, Firefox, and WebKit.
- **Verification:** `bun run test:e2e tests/csp-and-console.e2e.ts`
- **Progress:** [ ] Not started

### T9 — Sync specification and run full verification

- **Depends on:** T1, T2, T3, T4, T5, T6, T7, T8
- **Risk:** routine
- **Likely files:** `specification/COMPONENTS.md`, `specification/components/training-setup.md`, `specification/components/dialog.md`, `specification/components/content-modal.md`, `specification/components/welcome-modal.md`, `specification/workflow-steps.md`, `specification/ARCHITECTURE.md`, `specification/README.md`
- **Must not touch:** `src/`, `css/`, `scripts/`, `tests/`
- **Implementation:** Update all specs listed under `## Specification changes` to reflect the implemented changes, verify `specification/README.md` status alignment, and run all verification gates.
- **Acceptance criteria:**
    - [ ] Every item under `## Specification changes` is complete and accurate.
    - [ ] `bun run check`, `bun run lint`, `bun run deploy:dry-run`, `bun run test:stories`, `bun run format:check`, and relevant `bun run test:e2e` suites pass.
- **Verification:** `bun run check`, `bun run lint`, `bun run deploy:dry-run`, `bun run test:stories`, `bun run plans:check specification/plans/beta-console-errors-and-csp-fixes.md`
- **Progress:** [ ] Not started

## Verification and definition of done

- [ ] All task acceptance criteria met.
- [ ] Relevant verification commands from `AGENTS.md` pass with no new failures.
- [ ] Type-check, lint, formatting, and build checks pass.
- [ ] Accessibility (WCAG 2.2 AA), privacy/security, and contract-compatibility checks completed where applicable.
- [ ] Every item under _Specification changes_ is ticked, and specifications match the implemented code.
- [ ] No unintended changes outside the tasks' likely files.

## Risks and open questions

- **Blocking:** Plan intentionally held in `draft` at the maintainer's request (`2026-11-24`, updated `2026-11-25`) so the maintainer can review/style the draft mockups (`00-2_content-modal.html`, `00-4_confirm-dialog.html` in `css/modal.css`) and append any additional `beta.samata.ml` issues before `/verify-plan` review. Before submitting to `ready-for-review`, confirm: (1) whether `<button autofocus>` inside `<dialog>` (`app-welcome-modal.ts`, `app-target-view.ts`) needs changes beyond `<app-training-setup>`; (2) whether `tests/style-tokens.test.ts` should forbid all `style="..."` / `styleMap` in `src/` (excluding `*.stories.ts`); and (3) any CSS updates from reviewing `00-2_content-modal.html` and `00-4_confirm-dialog.html` (e.g. `1px` vs `1.5px` border or `.modal-header` bottom border).
- **Non-blocking:** `queueMicrotask` deferral in T3 (and T5 if needed) changes store-load initiation from synchronous inside `updated()` to the next microtask; `whenSettled()` methods must still wait for the deferred load. Draft mockups `00-2_content-modal.html` and `00-4_confirm-dialog.html` remain non-normative until promoted to `ready`.

## Escalations

None.

## Review fixes

None.

## Implementation and verification log

| When (UTC) | Task | Agent (model) | Outcome / commands / evidence |
| ---------- | ---- | ------------- | ----------------------------- |
| —          | —    | —             | Not started                   |

## Plan review history

| Reviewed (UTC) | Agent (model) | Decision | Findings |
| -------------- | ------------- | -------- | -------- |

## Change log

| When (UTC)           | Change                                                                 | Reason                                                                                                                                                                    |
| -------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-24T13:46:55Z | Initial draft                                                          | Browser console errors observed on `beta.samata.ml` (left in `draft` for maintainer additions)                                                                            |
| 2026-11-25T13:57:01Z | Added T5–T7 (Change Dataset, sticky modal header, backdrop)            | Maintainer requested adding dataset-switch bug, sticky `.modal-header`, and modal backdrop dismiss                                                                        |
| 2026-11-25T14:32:18Z | Harmonised modals into Content Modal vs Confirm Dialog + draft mockups | Maintainer interview resolved two-type modal split, plain-text confirm body, Esc/backdrop rules, and draft mockups `00-2_content-modal.html` & `00-4_confirm-dialog.html` |
