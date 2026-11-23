# Visual Design Specification

**Status:** partial — tokens, shared primitives, shell mockup mappings, document CSS consolidation and blocking parity/screenshots are implemented. Draft-only prose/features await human styling; exact data/model contrast findings and broader feature-style coverage remain follow-up work ([Known gap](README.md#known-gaps) 13). Mockup accessibility defects remain governed by the registers below.

This specification defines the visual standards, token architecture, mockup mappings, translation rules, and deviation registers for the application.

## 1. Source of truth

The mockups in [`mockups/`](mockups/) with `<meta name="status" content="ready" />` or `<meta name="status" content="implemented" />` (`*.html` and [`mockups/style.css`](mockups/style.css)) define how every user-visible surface looks. Computed values for colour, font family, size, weight, line-height, spacing, borders, radii, and shadows must match the mockup at a 1440×900 viewport, except where §4 (Translation rules) or §5 (Deviation registers) allows a deviation.

Markup, class names, file layout, and selectors may change to suit Lit, Shadow DOM, accessibility, and semantics. Behaviour and copy follow [workflow-steps.md](workflow-steps.md). When a mockup and a behaviour specification conflict, the behaviour specification wins, and the visual treatment is kept on the new structure.

### 1.1 Draft mockups

A missing mockup does not block a feature. When a surface has no `ready` or `implemented` mockup in `mockups/`, an agent writes an unstyled **draft** that records structure and copy only. The draft gives the human a starting point for the styling; it makes no design decisions.

**Writing a draft:**

- **Location and governance:** `mockups/<name>.html`, named as the promoted mockup will be (e.g. `03-4_train-models-3-configure-model.html`). Agents may create and edit files in `specification/mockups/` only when `<meta name="status" content="draft" />` (or when explicitly authorised by a plan); `ready` and `implemented` mockups and `mockups.css` are human-owned. `bun run mockups` serves files flat at `<checkout mockup URL>/<name>.html` (`http://localhost:3333/` in the primary checkout) and lists them via `/index.json` in the `/` catalogue.
- **Required metadata:** every HTML file in `mockups/` declares three `<meta>` elements in `<head>`:
    - `<meta name="name" content="{Plain English Name}" />`
    - `<meta name="description" content="{When the user encounters this UI}" />`
    - `<meta name="status" content="draft|ready|implemented" />` (new agent drafts always start at `draft`)
- **Shell:** copy the document shell (head, sidebar, page header) unchanged from the nearest existing mockup, and link `./style.css`. Do not hardcode `<link rel="stylesheet" href="./mockups.css" />` or `#__mockup-review-helper-host` markup in product mockups. Only the new content area is drafted.
- **Semantic HTML only:** landmarks, headings in order, lists, tables with a `<caption>` and `<th scope>`, forms with `<label>`, `<fieldset>` and `<legend>`, and native `<button>`, `<dialog>` and `<details>`. Use ARIA only where no native element fits. Follow the SEM register (§5.2).
- **No design:** no `<style>` element, `style` attribute, new CSS file, token, icon or image. Reuse an existing class only where an existing pattern is reused unchanged (e.g. `.btn`, `.notification`, `.chiclet`); add no other classes.
- **Content and multi-state comments:** copy from the behaviour spec in British English, with realistic sample data (Palmer Penguins). Every state the spec describes (empty, blocked, loading, error, populated) gets its own file or its own fragment wrapped in opening and closing HTML comments:
    ```html
    <!-- {State Name} -->
    <!-- This will display when {condition}. -->
    <section>...</section>
    <!-- / {State Name} -->
    ```
- **Header comment:** directly after `<!doctype html>`: `<!-- DRAFT: structure only, not normative for appearance. Source: <spec § or plan>. Open questions: <TODO IDs or none>. -->`
- **Human queue:** add an item to [HUMAN.md](HUMAN.md) §6 to style the draft.

The local review server (`bun run mockups`) serves top-level HTML files and stylesheets directly from `specification/mockups/` and exposes live metadata at `/index.json`. Its `/` catalogue (`<body class="mockup-index">` with `<table class="mockups">`) and preview helper bar are developer tooling styled by human-owned `specification/mockups/mockups.css`, not product mockups. On normal HTML previews, the server injects `<link rel="stylesheet" href="/mockups.css" />` into `<head>` and a light-DOM `#__mockup-review-helper-host` bar (with an auto-navigating `<select id="preview-page">` and `.index-link`) before `</body>`; `?clean=1` returns untouched raw file bytes from disk with zero injected CSS, helper DOM, or scripts. This developer-only exemption applies only to the review tool and never relaxes WCAG 2.2 AA requirements on product mockups or the application.

The human owns mockup CSS, `mockups.css`, review acceptance, and promotion. The review and markup-request templates, audit limits, and Shadow DOM port procedure are in [mockup-review.md](mockup-review.md). `bun run audit:mockups` provides per-file automated evidence; passing axe does not establish conformance, and incomplete findings require manual review.

**Promotion:** the human styles the draft in place inside `mockups/`, updates `<meta name="status" content="ready" />` (and later `implemented` once ported), and removes the `DRAFT` header comment. Only then is it normative, and only then do §1 and the parity checks (§6) apply to it.

**Charts against a draft (scoped exception, Phases 4 and 5).** Charts drawn by Observable Plot may use the chart tokens (§2) for marks and the minimum chart geometry (margins, mark sizes, dash patterns) while the draft HTML stays unstyled. Typography is inherited from the surrounding component. This allowance covers the Section 6 results charts and Phase 5 `/results` comparison charts and ends for each view when the human promotes its styled mockup. The human authorised this extension for Phase 5 on 2026-11-23; WCAG, token and functional requirements remain in force.

**Phase 5 visual follow-up exception.** The human authorised Phase 5 to proceed while visual-only styling differences are recorded for human attention in `HUMAN.md`. Run parity assertions without suppression; record each affected test, measured actual and expected values, evidence that the difference is visual rather than functional or accessibility-related, and its human follow-up. This does not waive WCAG, keyboard operation, readable reflow, content, focus, scroll restoration, or other behaviour. After the human resolves a styling item, verify the corresponding parity assertions again.

**Building against a draft:**

- Follow its structure and copy. Behaviour still follows [workflow-steps.md](workflow-steps.md).
- Style with existing shared style modules (§3) and `css/root.css` tokens only. Component CSS is limited to `:host` display, `:host([hidden])`, §4 focus and motion rules, and the minimum layout needed to keep content readable (`display`, and a `gap` or `margin` from existing spacing values). Choose no colours, type sizes, borders or shadows.
- Add no parity entries for draft-only elements. The token guard and the accessibility scan still apply.
- For the local tool's reference comparisons, parity requests the clean preview URL (`/<filename>?clean=1`) so injected review controls and `/mockups.css` cannot affect screenshots or computed styles.
- The plan names the draft under **Visual reference** and lists "awaiting a styled mockup" as non-blocking under _Risks and open questions_. Once the mockup is promoted, a follow-up task ports its styles and adds parity entries.

## 2. Tokens

The closed token vocabulary is defined in [`css/root.css`](../css/root.css). It consists of the mockup [`mockups/css/root.css`](mockups/css/root.css) unchanged, plus an `/* App additions */` block listing:

- `--surface: #fff` (replaces mockup `#fff` and `white`)
- `--focus-ring: var(--blue-700)`
- `--shadow-panel: -2px 0 5px rgba(0, 0, 0, 0.1)` (overlay panel shadow, added in Step 1 T4)
- `--backdrop: rgb(30 25 22 / 55%)` (native dialog backdrop)
- `--shadow-sidebar: -0.2rem 0 0.25rem 0.2rem rgb(73 57 47 / 0.15), -0.5rem 0 0.75rem 0.5rem rgb(73 57 47 / 0.2)` (reference sidebar shadow)
- Chart tokens, aliases of existing palette tokens (Phase 4): `--chart-1: var(--blue-700)`, `--chart-2: var(--amber-700)`, `--chart-3: var(--teal-700)`, `--chart-4: var(--purple-700)`, `--chart-5: var(--red-700)`, `--chart-6: var(--green-800)` (categories beyond six cycle), `--chart-neutral: var(--stone-600)`, `--chart-axis: var(--stone-700)` and `--chart-grid: var(--stone-200)`. Every chart token except the decorative `--chart-grid` reaches 3:1 against `--surface` (WCAG 1.4.11); `tests/chart-tokens.test.ts` checks it. Normal text keeps its existing text colour. Class identity is carried by labels and the data table, never by colour alone. The human may restyle these tokens ([HUMAN.md](HUMAN.md)).

Adding any token requires an explicit plan decision and an entry in this section.

Rules:

- Reference global tokens as `var(--name)`, with no fallback.
- Never use a literal colour (`#hex`, `rgb()`, `hsl()`, or named colours), including inside a `var()` fallback.
- Mockup literals map to tokens: `#fff` and `white` become `--surface`, and `rgb(30 25 22 / 55%)` becomes `--backdrop`.

## 3. Where mockup CSS lives in the app

Mockup CSS files map to application locations as follows:

| Mockup file                                                                                                          | App location                                                                                                                                                                                                 |
| :------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`mockups/css/root.css`](mockups/css/root.css)                                                                       | [`css/root.css`](../css/root.css) (document)                                                                                                                                                                 |
| [`mockups/css/base.css`](mockups/css/base.css)                                                                       | [`css/base.css`](../css/base.css), for document/main; `.page-header` → `src/styles/page-header.styles.ts`                                                                                                    |
| [`mockups/css/button.css`](mockups/css/button.css)                                                                   | [`src/styles/button.styles.ts`](../src/styles/button.styles.ts) only                                                                                                                                         |
| [`mockups/css/badges.css`](mockups/css/badges.css)                                                                   | [`src/styles/chiclet.styles.ts`](../src/styles/chiclet.styles.ts) only; mockup `.badge-*` maps to `.chiclet-*` (SEM-11)                                                                                      |
| [`mockups/css/card.css`](mockups/css/card.css)                                                                       | [`src/styles/card.styles.ts`](../src/styles/card.styles.ts)                                                                                                                                                  |
| [`mockups/css/modal.css`](mockups/css/modal.css)                                                                     | [`src/styles/dialog.styles.ts`](../src/styles/dialog.styles.ts)                                                                                                                                              |
| [`mockups/css/sidebar.css`](mockups/css/sidebar.css) and [`mockups/css/steps.css`](mockups/css/steps.css)            | [`app-sidebar`](../src/features/shell/app-sidebar.ts) `static styles`                                                                                                                                        |
| [`mockups/css/table.css`](mockups/css/table.css)                                                                     | [`src/styles/table.styles.ts`](../src/styles/table.styles.ts) (adopted in `global.ts` and consuming shadow roots)                                                                                            |
| [`mockups/css/notifications.css`](mockups/css/notifications.css)                                                     | [`src/styles/notification.styles.ts`](../src/styles/notification.styles.ts) alert variant only (adopted in `global.ts`)                                                                                      |
| [`mockups/css/train-model.css`](mockups/css/train-model.css)                                                         | [`src/styles/train-model.styles.ts`](../src/styles/train-model.styles.ts) (adopted in `global.ts` and builder view); `.help-link` in the section `h2`                                                        |
| [`mockups/css/hyperparameters.css`](mockups/css/hyperparameters.css) `.field` family and `base.css` `input`/`select` | [`src/styles/hyperparameters.styles.ts`](../src/styles/hyperparameters.styles.ts) (scoped under `.field`; `A11Y-07`, `A11Y-08`, `SEM-10` applied; `base-select` and `::picker` dropped for native rendering) |
| `.fold-matrix*`, `.fold-visual-summary` and `.fold-legend*` (03-5 draft)                                             | [`src/styles/hyperparameters.styles.ts`](../src/styles/hyperparameters.styles.ts), adopted by [Training Setup](components/training-setup.md).                                                                |
| 03-7 draft results (`figure`, `figcaption`, "Show data table" `details`, scrollable table regions)                   | [`src/styles/results.styles.ts`](../src/styles/results.styles.ts), composed by the Section 6 results elements with `table.styles.ts`                                                                         |
| `dot.css`, `dropzone.css`                                                                                            | Sidebar-local dot and feature-owned upload/dropzone rules; no document copies                                                                                                                                |

A rule used across roots lives in a shared module ([COMPONENTS.md §6.2](COMPONENTS.md#62-shared-style-modules)); a feature-private rule remains with its owner. `css/style.css` imports only root/base. Obsolete document copies of badges/button/card/dot/dropzone/loading/modal/notifications/sidebar/steps/table/train-model are absent. Table, notification and train-model sheets retain document adoption and feature consumers. Page Header owns the shared header grid and composes `headingFocusStyles`; existing feature-private headers retain their appearance and adopt only the heading outline. Sidebar rules live in `src/features/shell/app-sidebar.ts`; its local static dot has no general dot-primitive API. Upload/dropzone rules remain feature-owned.

Below 50rem the sidebar becomes static above main, with auto inline/min-block sizes and reset fixed insets; main has zero sidebar margin. There is one navigation tree. At desktop, main retains content-box sizing, 2rem padding, sidebar-width margin and viewport-minus-4rem minimum block size; document scrolling remains the restoration owner.

## 4. Translation rules (allowed without a register entry)

The following changes that preserve the look are allowed without an explicit deviation register entry:

- Physical to logical properties (e.g. `padding-inline`, `margin-block`).
- Wrapping in `:host` and an inner element.
- Adding `:host([hidden]) { display: none; }`.
- `font-family: inherit` on form controls.
- Adding hover, `:focus-visible`, and disabled states where the mockup has none. Focus uses a 2px `outline` in `var(--focus-ring)` with a 2px offset.
- Wrapping transitions and animations in `@media (prefers-reduced-motion: no-preference)`.
- Swapping an element for a semantically correct one, styled to look the same.
- Adding `border: 1px solid transparent` wherever a boundary is drawn only by `box-shadow`, so it shows in forced-colours mode.

Every plan or component spec that ports mockup CSS lists its "Changes from the mockup CSS", as [components/card.md §5.4](components/card.md#54-changes-from-the-mockup-css) already does.

## 5. Deviation registers

### 5.1 A11Y register: mockup contrast failures

Measured from token hex values. The user approved the A11Y values on 2026-11-12 (Q1).

| ID      | Where (mockup)                                           | Mockup pair (ratio)                                                  | Approved app value (ratio)                                            | WCAG          |
| :------ | :------------------------------------------------------- | :------------------------------------------------------------------- | :-------------------------------------------------------------------- | :------------ |
| A11Y-01 | `.btn` text (00, 01-1, 01-2, 01-3, 03-2)                 | stone-600 on stone-50 (3.97)                                         | stone-700 (5.88)                                                      | 1.4.3         |
| A11Y-02 | `.sidebar footer` text and separators (all pages)        | stone-600 on stone-150 (3.66)                                        | stone-700 (5.42); links stay stone-800 (8.79)                         | 1.4.3         |
| A11Y-03 | `.file-picker-button` (01-3)                             | stone-600 on stone-150 (3.66)                                        | stone-700 (5.42)                                                      | 1.4.3         |
| A11Y-04 | `.badge-amber` "beta" (00, 03-3)                         | white on amber-500 (2.15)                                            | stone-900 on amber-500 (6.60), as `card.md` chiclet-amber             | 1.4.3         |
| A11Y-05 | `.card-text` (00, 01-x, 03-2)                            | stone-600 on white (4.10)                                            | Already decided in `card.md`: stone-900 (14.17). Not reopened.        | 1.4.3         |
| A11Y-06 | `.train-step-pending` text (03-2, 03-3)                  | stone-500 on stone-100 (2.61)                                        | stone-700 (5.67)                                                      | 1.4.3         |
| A11Y-07 | `input` and `select` boundary (base.css)                 | stone-300 border on stone-100 (1.30), field on stone-50 page         | stone-600 border (3.83 on stone-100, 3.97 on stone-50)                | 1.4.11        |
| A11Y-08 | `select:focus-visible` outline and `input:focus-visible` | 3px blue-300 on stone-50 (1.74); input focus is a border change only | 2px `outline` in `--focus-ring` (blue-700, 6.48), offset 2px          | 1.4.11, 2.4.7 |
| A11Y-09 | Current sidebar step (`steps.css` `[aria-current]`)      | colour change only (border, background, text)                        | also `font-weight: 600` on `.step-label`                              | 1.4.1         |
| A11Y-10 | `.btn` and step links have no focus style                | none                                                                 | translation rule (§4) focus outline                                   | 2.4.7         |
| A11Y-11 | Fold matrix wrapper and Section 4 links (03-5 draft)     | Browser-default focus indicator                                      | 2px `--focus-ring` outline with 2px offset, visible in forced colours | 2.4.7         |
| A11Y-12 | Builder Section 5 `.pending-notice`                      | Previous app token `--stone-600` on white (4.10:1)                   | `--neutral-700` on white (10.35:1)                                    | 1.4.3         |
| A11Y-13 | Sample download notice                                   | stone-600 on stone-50 (3.96)                                         | stone-700 (5.88 on stone-50; 6.07 on white)                           | 1.4.3         |

Disabled controls are exempt from 1.4.3, but they must stay legible ([button.md Q3](components/button.md#q3)). The "Training progress" label hit on `03-2` and `03-3` is a false positive: it sits in a `hidden` container.

### 5.2 SEM register: mockup semantic defects

Measured by DOM audit of the mockups.

| ID     | Mockup defect                                                                          | App rule                                                                                                                                                                                                                                                                                                |
| :----- | :------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SEM-01 | Two `<h1>` per page (the sidebar brand and the page title)                             | The brand is `<p class="brand">` styled as the mockup `.sidebar h1`. The page title is the only `<h1>` (it is the focus target, [app-state-and-navigation.md §5.6](app-state-and-navigation.md#56-focus-management-after-navigation)).                                                                  |
| SEM-02 | Project box uses `<h4>` straight after `<h1>` (skipped levels)                         | `<h2>` styled as the mockup `.project h4`.                                                                                                                                                                                                                                                              |
| SEM-03 | Current step is a non-link `<div>`                                                     | `<a href>` with `aria-current="page"` ([app-state-and-navigation.md §4.4](app-state-and-navigation.md#44-sidebar-and-shortcuts)). Set the value with an attribute binding (`aria-current=${…}` with `nothing`), never a `?` boolean binding. Applied.                                                   |
| SEM-04 | `<dialog class="modal">` has no accessible name (00, 01-2, 01-3)                       | `aria-labelledby` pointing to the dialog's heading. The modal heading is `<h2>`, styled as the mockup `.modal-header h1`.                                                                                                                                                                               |
| SEM-05 | URL `<input>` labelled only by a placeholder (01-3)                                    | A visible `<label>`. The placeholder is optional.                                                                                                                                                                                                                                                       |
| SEM-06 | Feature checkboxes have no label, and there are duplicate ids (03-3, work in progress) | Each checkbox is labelled by its column name; ids are unique per row.                                                                                                                                                                                                                                   |
| SEM-07 | Tables have no accessible name (02-1, 02-2, 03-3)                                      | `<caption>` (it may be visually hidden) or `aria-labelledby` to the section heading. Column headers are `<th scope="col">`.                                                                                                                                                                             |
| SEM-08 | Decorative SVGs                                                                        | `aria-hidden="true"`. Icon-only buttons take their accessible name from a localised string ([COMPONENTS.md §8](COMPONENTS.md#8-internationalisation-nanostoresi18n)).                                                                                                                                   |
| SEM-09 | Status shown by colour (`.dot`, `.train-step-status`)                                  | Status also shown as text (a visually hidden span counts), as `03-2` "Completed" already does.                                                                                                                                                                                                          |
| SEM-10 | `select`: `appearance: base-select`                                                    | Progressive enhancement only. Every select has a `<label>` and a `name`.                                                                                                                                                                                                                                |
| SEM-11 | `.badge` and `.badge-*` (mockup) and `.chiclet` (app)                                  | One [chiclet](components/chiclet.md) primitive: default inline outlined counts, solid inline-block variants with transparent border, start padding/tracking/uppercase badge treatment. Text retains its semantic meaning. The solid beta border permits the recorded 1px welcome title-flow difference. |
| SEM-12 | Welcome tagline is an h2 despite being descriptive copy                                | Paragraph with the original h2's computed weight, size, normal line-height and margins.                                                                                                                                                                                                                 |
| SEM-13 | Get Started has an aria-label different from visible text                              | Native button accessible name comes from visible translated Get Started text.                                                                                                                                                                                                                           |
| SEM-14 | Fold matrix has distinct training and validation roles (03-5 draft)                    | Show en dash and check markers with dashed and solid borders, including in forced colours. Mark glyphs decorative and give each cell a hidden role name. Use a caption and scoped row and column headers.                                                                                               |

Shell brand/project/current-link/dialog/status/decorative-icon rules apply as SEM-01/02/03/04/08/09. Shared buttons, footer/current labels and amber badge apply A11Y-01/02/04/09/10. These completed shell translations do not claim all feature/mockup defects are repaired.

### 5.3 Behaviour-driven UI deviations

| ID           | Where (mockup)                     | Mockup behaviour                                                           | Approved app behaviour                                                                                                         | Reason                                                                                                                    |
| :----------- | :--------------------------------- | :------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------ |
| DATA-UI-01   | Column details aside (01-5)        | Standard deviation stat; plain histogram graphic                           | Standard deviation omitted; histogram rendered as discrete bin distribution table                                              | Standard deviation is not computed during ingestion or stored; precomputed histogram bins rendered cleanly as table data. |
| DATA-UI-02   | Preview header (01-4)              | Disabled red "Delete Dataset" button                                       | "Change Dataset" button opening confirmation dialog                                                                            | Removing active dataset requires user confirmation; "Change Dataset" cleanly manages replacement or reset.                |
| DATA-UI-03   | Column details aside (01-5)        | Fixed width without viewport clamping                                      | `max-inline-size: 100%`, `box-sizing: border-box`, logical properties                                                          | Prevents horizontal document blowout on narrow (320px) screens.                                                           |
| TARGET-UI-01 | Set target (02-1, 02-2)            | 3-column table; warning bar for trained models                             | 4-column table with Notes; alert notification for any model; modal confirmation; disabled Current Target; header continue link | Implements workflow-steps §2 eligibility/notes and app-state-and-navigation §6.2/§6.4 model-discard safety.               |
| MODELS-UI-01 | Choose model (03-2)                | Completed icon `#check` before continue                                    | Section remains active until Continue clicked; explicit Continue button in `.section-actions` completes Section 1              | Separates model selection from step completion per workflow-steps §3.1.                                                   |
| MODELS-UI-02 | Select features (03-3)             | `aria-selected` on plain rows; missing labels                              | Removed invalid `aria-selected` on non-interactive rows; unique form labels and `input[aria-label]` per feature row            | Conformance with WCAG 4.1.2 and SEM-06.                                                                                   |
| MODELS-UI-03 | Choose model (03-2, 03-9)          | Only one illustrated Logistic Regression card                              | Illustrated card for `logistic-regression`; native text entries (`03-9`) for remaining 13 supervised models without artwork    | User-approved scope for models lacking authored SVG art; draft text entries have no parity entries.                       |
| MODELS-UI-04 | Configure model (03-4)             | `.form-note` is no longer defined by the mockup CSS (removed in `e5e50b2`) | `.form-note` uses `color: var(--neutral-600); font-size: 0.875rem`, the last committed rule, pending human restyling           | The 03-4 draft still uses the class for multiclass and fixed-option notes; restyling is queued in HUMAN.md.               |
| MODELS-UI-05 | Training Setup matrix (03-5 draft) | Unstyled fold table                                                        | 2rem per fold, 3.5rem run column and 0.25rem border spacing. Only the named matrix wrapper scrolls horizontally.               | Ten folds span at least 26.5rem. The page, summary and legend fit narrow viewports.                                       |

| ID          | Where                    | App behaviour                                                                                                      | Reason                                                                                                         |
| ----------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| SHELL-UI-01 | Project settings         | Omit the unimplemented settings control; preserve its 2.5rem grid track and project geometry.                      | No settings behaviour is specified.                                                                            |
| SHELL-UI-02 | Next-step dot            | Omit the undefined next-step hint.                                                                                 | No next-step guidance contract exists.                                                                         |
| SHELL-UI-03 | Models in step 3         | Keyed sibling model list inside the third li, after its anchor; preserve horizontal columns and local row styling. | Valid list/link semantics without interactive nesting; group vertical placement follows the sibling structure. |
| SHELL-UI-04 | Long text/narrow screens | Shrink/wrap names and chiclets; below 50rem stack static sidebar above main, zero main sidebar margin.             | Readable 320px/RTL layouts without a new drawer or duplicate navigation.                                       |

## 6. Verification

Visual fidelity uses static guards, computed styles/geometry, reviewed screenshot regression and accessibility checks, complemented by manual inspection:

1. **Token use static guard (`bun test tests/style-tokens.test.ts`):**
   Parses `css/root.css` to determine the canonical token set. Scans `src/**/*.ts` and `css/**/*.css` to assert:
    - Every `var(--name)` references a known global or local token.
    - TOK-2 checks literal colours in TypeScript style declarations and var fallbacks outside css/root.css. Direct CSS declaration coverage remains limited (Known gap 13); the normative token-only rule still applies to every style and requires review beyond the guard.
    - No `<style>` tags appear inside HTML templates (`render()`).
    - `KNOWN_DRIFT` is empty; TOK-4 prevents repaired shell exemptions returning.
    - TOK-5/6 reject physical inline-direction CSS, `!important` and `:host-context()` in actual CSS/template declarations, without treating JavaScript scroll coordinates as styles.

2. **Visual parity test harness (`bun run test:e2e tests/visual-parity.e2e.ts`):**
   A Playwright test running in Chromium at a 1440×900 viewport. It compares computed CSS styles between clean mockup pages served by `bun run mockups` (`<checkout mockup URL>/<filename>?clean=1`) and the running application routes (the checkout's app URL); the primary checkout uses 3333 and 3000.
    - Mapped elements are defined in `tests/visual-parity/map.ts`.
    - Checks background, borders, typography, spacing, explicit grid areas/tracks and fixture-relative numeric geometry within at most 1 CSS px. Content-dependent tracks are compared numerically rather than as identical strings.
    - Deviations are validated against the approved deviation registers.
    - No mapped surface has knownDrift; PARITY-contract prevents exemptions returning. Existing feature mappings remain blocking.
    - Full-page screenshots of both the mockup and the app are captured and attached to the test run.
    - Empty/Models sidebar fixtures have platform-specific `toHaveScreenshot` baselines after paired reference review, with animations disabled, caret hidden and zero allowed changed pixels at the default colour threshold. Never update baselines to hide unexpected differences. A temporary 4px workflow-gap mutation must fail geometry/screenshot checks before restoration passes.
    - Reference fixtures may normalise text/counts/current state only; CSS, wrappers and dimensions remain unchanged. Draft-only content has paired structure captures, no appearance mapping or baseline approval claim.

3. **Accessibility scan (`bun run test:e2e tests/a11y.e2e.ts`):**
   Uses `@axe-core/playwright` with `wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`. Shell-scoped scans have zero violations and no exclusions. Broad audits match only separately owned exact feature elements and measured evidence in `tests/a11y-feature-findings.ts`. Unlisted rules and elements fail. Phase 2 resolved the Section 4 notice contrast finding. The remaining 24 data and model contrast targets are tracked in [the human queue](HUMAN.md#1-workflow-and-plan-review).

4. **Static mockup audit (`bun run audit:mockups [filename ...] [--port <port>]` (default: the checkout's mockup port, 3333 in the primary checkout)):**
   With `bun run mockups` running, audits selected non-empty top-level HTML files or all eligible files at a 1440×900 viewport using Chromium and `@axe-core/playwright` via `/<filename>?clean=1`. It uses `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and `wcag22aa` without rule exclusions. JSON and escaped HTML reports are written to `test-results/mockup-a11y/`. Violations, navigation/runtime errors, skipped empty files and incomplete checks remain distinct. A zero exit status means only that no automated violations were found; static markup cannot prove interactive states or replace manual keyboard, screen-reader, responsive, zoom, forced-colours and motion checks. The review server catalogue and helper behaviour are covered separately in `tests/mockup-review.e2e.ts`.

5. **Adding a parity entry for a new view:**
   When introducing or refactoring a view:
    - Identify the corresponding mockup page in `specification/mockups/`.
    - Add a `ParityEntry` to `tests/visual-parity/map.ts` specifying the `mockupPage`, `mockupSelector`, `appRoute`, `appSelector`, and `properties` to compare.
    - If a known deviation exists, document it with the register ID (`A11Y-nn` or `SEM-nn`) in the entry's `deviations` map.

6. **Manual side-by-side verification:**
   Start both servers:
    ```sh
    bun run mockups
    bun run server
    ```
    Open Chromium at a 1440×900 viewport side by side with the mockup page and the application route. Inspect visual alignment, fonts, colours, and interactive states. Attach screenshots of both views to the task report.
    Review keyboard journeys, screen-reader current links/dialog/control names, real 200% browser zoom, 320px/RTL/long text, forced colours and reduced motion separately. Browser emulation is automated evidence, not a claim of native assistive-technology or real zoom testing. Production component stories provide the editing/review surface after porting; mockups remain normative.
