# Visual Design Specification

**Status:** partial — the token vocabulary (§2), the shared style modules (§3) and the checks (§6) are in force. The shell does not yet match the mockups (§1), the `css/` copies of button, card, badges and modal remain (§3), and A11Y-01, A11Y-02, A11Y-09 and SEM-01–03 (§5) are not yet applied ([Known gap](README.md#known-gaps) 13).

This specification defines the visual standards, token architecture, mockup mappings, translation rules, and deviation registers for the application.

## 1. Source of truth

The mockups in [`mockups/ui-scaffold/`](mockups/ui-scaffold/) (`*.html` and [`mockups/ui-scaffold/style.css`](mockups/ui-scaffold/style.css)) define how every user-visible surface looks. Computed values for colour, font family, size, weight, line-height, spacing, borders, radii, and shadows must match the mockup at a 1440×900 viewport, except where §4 (Translation rules) or §5 (Deviation registers) allows a deviation.

Markup, class names, file layout, and selectors may change to suit Lit, Shadow DOM, accessibility, and semantics. Behaviour and copy follow [workflow-steps.md](workflow-steps.md). When a mockup and a behaviour specification conflict, the behaviour specification wins, and the visual treatment is kept on the new structure.

### 1.1 Draft mockups

A missing mockup does not block a feature. When a surface has no mockup in `mockups/ui-scaffold/`, or its file is empty, an agent writes an unstyled **draft** that records structure and copy only. The draft gives the human a starting point for the styling; it makes no design decisions.

**Writing a draft:**

- **Location:** `mockups/ui-scaffold/drafts/<name>.html`, named as the normative mockup will be (e.g. `03-4_train-models-3-configure-model.html`). Agents create and edit files in `drafts/` only. `bun run serve:scaffold` serves them at `http://localhost:3333/drafts/<name>.html`; the index page doesn't list them.
- **Shell:** copy the document shell (head, sidebar, page header) unchanged from the nearest existing mockup, and link `../style.css`. Only the new content area is drafted.
- **Semantic HTML only:** landmarks, headings in order, lists, tables with a `<caption>` and `<th scope>`, forms with `<label>`, `<fieldset>` and `<legend>`, and native `<button>`, `<dialog>` and `<details>`. Use ARIA only where no native element fits. Follow the SEM register (§5.2).
- **No design:** no `<style>` element, `style` attribute, new CSS file, token, icon or image. Reuse an existing class only where an existing pattern is reused unchanged (e.g. `.btn`, `.notification`, `.chiclet`); add no other classes.
- **Content:** copy from the behaviour spec in British English, with realistic sample data (Palmer Penguins). Every state the spec describes (empty, blocked, loading, error, populated) gets its own file or its own headed `<section>`.
- **Header comment:** directly after `<!doctype html>`: `<!-- DRAFT: structure only, not normative for appearance. Source: <spec § or plan>. Open questions: <TODO IDs or none>. -->`
- **Human queue:** add an item to [HUMAN.md](HUMAN.md) §6 to style the draft.

**Promotion:** the human styles the draft and moves it into `mockups/ui-scaffold/`, replacing any empty placeholder. Only then is it normative, and only then do §1 and the parity checks (§6) apply to it.

**Building against a draft:**

- Follow its structure and copy. Behaviour still follows [workflow-steps.md](workflow-steps.md).
- Style with existing shared style modules (§3) and `css/root.css` tokens only. Component CSS is limited to `:host` display, `:host([hidden])`, §4 focus and motion rules, and the minimum layout needed to keep content readable (`display`, and a `gap` or `margin` from existing spacing values). Choose no colours, type sizes, borders or shadows.
- Add no parity entries for draft-only elements. The token guard and the accessibility scan still apply.
- The plan names the draft under **Visual reference** and lists "awaiting a styled mockup" as non-blocking under _Risks and open questions_. Once the mockup is promoted, a follow-up task ports its styles and adds parity entries.

## 2. Tokens

The closed token vocabulary is defined in [`css/root.css`](../css/root.css). It consists of the mockup [`mockups/ui-scaffold/css/root.css`](mockups/ui-scaffold/css/root.css) unchanged, plus an `/* App additions */` block listing:

- `--surface: #fff` (replaces mockup `#fff` and `white`)
- `--focus-ring: var(--blue-700)`

Adding any token requires an explicit plan decision and an entry in this section.

Rules:

- Reference global tokens as `var(--name)`, with no fallback.
- Never use a literal colour (`#hex`, `rgb()`, `hsl()`, or named colours), including inside a `var()` fallback.
- Mockup literals map to tokens: `#fff` and `white` become `--surface`, and `rgb(30 25 22 / 55%)` becomes the backdrop token added by the remediation plan.

## 3. Where mockup CSS lives in the app

Mockup CSS files map to application locations as follows:

| Mockup file                                                                                                                                               | App location                                                                                                            |
| :-------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------- |
| [`mockups/ui-scaffold/css/root.css`](mockups/ui-scaffold/css/root.css)                                                                                    | [`css/root.css`](../css/root.css) (document)                                                                            |
| [`mockups/ui-scaffold/css/base.css`](mockups/ui-scaffold/css/base.css)                                                                                    | [`css/base.css`](../css/base.css), for the light-DOM document, `main` and `.page-header`                                |
| [`mockups/ui-scaffold/css/button.css`](mockups/ui-scaffold/css/button.css)                                                                                | [`src/styles/button.styles.ts`](../src/styles/button.styles.ts) only                                                    |
| [`mockups/ui-scaffold/css/badges.css`](mockups/ui-scaffold/css/badges.css)                                                                                | [`src/styles/chiclet.styles.ts`](../src/styles/chiclet.styles.ts) only; mockup `.badge-*` maps to `.chiclet-*` (SEM-11) |
| [`mockups/ui-scaffold/css/card.css`](mockups/ui-scaffold/css/card.css)                                                                                    | [`src/styles/card.styles.ts`](../src/styles/card.styles.ts)                                                             |
| [`mockups/ui-scaffold/css/modal.css`](mockups/ui-scaffold/css/modal.css)                                                                                  | [`src/styles/dialog.styles.ts`](../src/styles/dialog.styles.ts)                                                         |
| [`mockups/ui-scaffold/css/sidebar.css`](mockups/ui-scaffold/css/sidebar.css) and [`mockups/ui-scaffold/css/steps.css`](mockups/ui-scaffold/css/steps.css) | [`app-sidebar`](../src/features/navigation/app-sidebar.ts) `static styles`                                              |
| `dot.css`, `dropzone.css`, `notifications.css`, `table.css`, `train-model.css`                                                                            | Location decided by the feature plan that first uses them                                                               |

A rule used inside any shadow root lives only in a shared module ([COMPONENTS.md §6.2](COMPONENTS.md#62-shared-style-modules)). Its `css/` copy is removed by the remediation plan.

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

| ID      | Where (mockup)                                           | Mockup pair (ratio)                                                  | Approved app value (ratio)                                     | WCAG          |
| :------ | :------------------------------------------------------- | :------------------------------------------------------------------- | :------------------------------------------------------------- | :------------ |
| A11Y-01 | `.btn` text (00, 01-1, 01-2, 01-3, 03-2)                 | stone-600 on stone-50 (3.97)                                         | stone-700 (5.88)                                               | 1.4.3         |
| A11Y-02 | `.sidebar footer` text and separators (all pages)        | stone-600 on stone-150 (3.66)                                        | stone-700 (5.42); links stay stone-800 (8.79)                  | 1.4.3         |
| A11Y-03 | `.file-picker-button` (01-3)                             | stone-600 on stone-150 (3.66)                                        | stone-700 (5.42)                                               | 1.4.3         |
| A11Y-04 | `.badge-amber` "beta" (00, 03-3)                         | white on amber-500 (2.15)                                            | stone-900 on amber-500 (6.60), as `card.md` chiclet-amber      | 1.4.3         |
| A11Y-05 | `.card-text` (00, 01-x, 03-2)                            | stone-600 on white (4.10)                                            | Already decided in `card.md`: stone-900 (14.17). Not reopened. | 1.4.3         |
| A11Y-06 | `.train-step-pending` text (03-2, 03-3)                  | stone-500 on stone-100 (2.61)                                        | stone-700 (5.67)                                               | 1.4.3         |
| A11Y-07 | `input` and `select` boundary (base.css)                 | stone-300 border on stone-100 (1.30), field on stone-50 page         | stone-600 border (3.83 on stone-100, 3.97 on stone-50)         | 1.4.11        |
| A11Y-08 | `select:focus-visible` outline and `input:focus-visible` | 3px blue-300 on stone-50 (1.74); input focus is a border change only | 2px `outline` in `--focus-ring` (blue-700, 6.48), offset 2px   | 1.4.11, 2.4.7 |
| A11Y-09 | Current sidebar step (`steps.css` `[aria-current]`)      | colour change only (border, background, text)                        | also `font-weight: 600` on `.step-label`                       | 1.4.1         |
| A11Y-10 | `.btn` and step links have no focus style                | none                                                                 | translation rule (§4) focus outline                            | 2.4.7         |

Disabled controls are exempt from 1.4.3, but they must stay legible ([button.md Q3](components/button.md#q3)). The "Training progress" label hit on `03-2` and `03-3` is a false positive: it sits in a `hidden` container.

### 5.2 SEM register: mockup semantic defects

Measured by DOM audit of the mockups.

| ID     | Mockup defect                                                                          | App rule                                                                                                                                                                                                                                          |
| :----- | :------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SEM-01 | Two `<h1>` per page (the sidebar brand and the page title)                             | The brand is `<p class="brand">` styled as the mockup `.sidebar h1`. The page title is the only `<h1>` (it is the focus target, [app-state-and-navigation.md §5.6](app-state-and-navigation.md#56-focus-management-after-navigation)).            |
| SEM-02 | Project box uses `<h4>` straight after `<h1>` (skipped levels)                         | `<h2>` styled as the mockup `.project h4`.                                                                                                                                                                                                        |
| SEM-03 | Current step is a non-link `<div>`                                                     | `<a href>` with `aria-current="page"` ([app-state-and-navigation.md §4.4](app-state-and-navigation.md#44-step-bar-interaction-model)). Set the value with an attribute binding (`aria-current=${…}` with `nothing`), never a `?` boolean binding. |
| SEM-04 | `<dialog class="modal">` has no accessible name (00, 01-2, 01-3)                       | `aria-labelledby` pointing to the dialog's heading. The modal heading is `<h2>`, styled as the mockup `.modal-header h1`.                                                                                                                         |
| SEM-05 | URL `<input>` labelled only by a placeholder (01-3)                                    | A visible `<label>`. The placeholder is optional.                                                                                                                                                                                                 |
| SEM-06 | Feature checkboxes have no label, and there are duplicate ids (03-3, work in progress) | Each checkbox is labelled by its column name; ids are unique per row.                                                                                                                                                                             |
| SEM-07 | Tables have no accessible name (02-1, 02-2, 03-3)                                      | `<caption>` (it may be visually hidden) or `aria-labelledby` to the section heading. Column headers are `<th scope="col">`.                                                                                                                       |
| SEM-08 | Decorative SVGs                                                                        | `aria-hidden="true"`. Icon-only buttons take their accessible name from a localised string ([COMPONENTS.md §8](COMPONENTS.md#8-internationalisation-nanostoresi18n)).                                                                             |
| SEM-09 | Status shown by colour (`.dot`, `.train-step-status`)                                  | Status also shown as text (a visually hidden span counts), as `03-2` "Completed" already does.                                                                                                                                                    |
| SEM-10 | `select`: `appearance: base-select`                                                    | Progressive enhancement only. Every select has a `<label>` and a `name`.                                                                                                                                                                          |
| SEM-11 | `.badge` and `.badge-*` (mockup) and `.chiclet` (app)                                  | One primitive, `.chiclet`, with variants. Text is never `text-transform`-only meaning. The remediation plan decides the badge look ([card.md](components/card.md) already defers this).                                                           |

## 6. Verification

Visual fidelity is verified continuously through three automated checks and one manual inspection procedure:

1. **Token use static guard (`bun test tests/style-tokens.test.ts`):**
   Parses `css/root.css` to determine the canonical token set. Scans `src/**/*.ts` and `css/**/*.css` to assert:
    - Every `var(--name)` references a known global or local token.
    - No literal colour values exist in declarations or in `var()` fallbacks (outside `css/root.css`).
    - No `<style>` tags appear inside HTML templates (`render()`).
    - Any file in `KNOWN_DRIFT` that starts passing must be removed from the drift list.

2. **Visual parity test harness (`bun run test:e2e tests/visual-parity.e2e.ts`):**
   A Playwright test running in Chromium at a 1440×900 viewport. It compares computed CSS styles between the mockup pages served by the scaffold server (`http://localhost:3333`) and the running application routes (`https://localhost:3000`).
    - Mapped elements are defined in `tests/visual-parity/map.ts`.
    - Checks properties such as background colours, borders, font weights, and spacing.
    - Deviations are validated against the approved deviation registers.
    - Drift under active remediation is tracked with `test.fail()` so it cannot regress silently.
    - Full-page screenshots of both the mockup and the app are captured and attached to the test run.

3. **Accessibility scan (`bun run test:e2e tests/a11y.e2e.ts`):**
   Uses `@axe-core/playwright` to scan application routes against WCAG 2.0, 2.1, and 2.2 Level A and AA tags (`wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`). Known pre-remediation violations are isolated in `KNOWN_A11Y_DRIFT` and wrapped in `test.fail()`.

4. **Adding a parity entry for a new view:**
   When introducing or refactoring a view:
    - Identify the corresponding mockup page in `specification/mockups/ui-scaffold/`.
    - Add a `ParityEntry` to `tests/visual-parity/map.ts` specifying the `mockupPage`, `mockupSelector`, `appRoute`, `appSelector`, and `properties` to compare.
    - If a known deviation exists, document it with the register ID (`A11Y-nn` or `SEM-nn`) in the entry's `deviations` map.

5. **Manual side-by-side verification:**
   Start both servers:
    ```sh
    bun run serve:scaffold
    bun run server
    ```
    Open Chromium at a 1440×900 viewport side by side with the mockup page and the application route. Inspect visual alignment, fonts, colours, and interactive states. Attach screenshots of both views to the task report.
