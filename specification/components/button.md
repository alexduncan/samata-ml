# Spec: Button (`.btn`)

**Status:** draft — default/primary/icon styling, A11Y-01 contrast and three-browser acceptance/stories are implemented; Q1/Q2 are answered, Q3–Q8 remain unresolved policy questions. · Tier: **Style primitive** (conventions §2) · Criterion prefix: `BTN`

## 1. Summary

A visual style for native `<button>` elements, in two variants: **default** and
**primary**, plus an independent icon-only `.btn-icon` treatment. Delivered as a shared style module usable in the document and inside
any component's shadow root.

## 2. Decision and rationale

**Decision:** this is a CSS class on a native `<button>`, not a custom element.

The native `<button>` already provides the role, focusability, Enter/Space activation,
form submission, `disabled`, and an accessible name from its content. A wrapping
`<app-button>` would have to re-create form association (via `ElementInternals`),
forward `type`, `name`, `value`, `disabled` and `aria-*` attributes, and handle
labelling across the shadow boundary. That is API and bug surface with no user benefit,
because this button has no behaviour, no state and no strings of its own. Later views
will contain thousands of elements, so avoiding a shadow root per button also matters.

**Rejected alternative:** `<app-button variant="primary">`. Revisit only if a future
spec requires behaviour CSS cannot add to a native button (for example a loading
state with an announced status). That requires a new spec, not an agent's judgement.

## 3. Public API (closed)

| Item                      | Description                                                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `class="btn"`             | Default variant. Valid only on `<button>`.                                                                                 |
| `class="btn btn-primary"` | Primary variant. `btn-primary` has no effect without `btn`.                                                                |
| `class="btn btn-red"`     | Destructive variant, only for destructive or discarding actions (for example Change Dataset). Has no effect without `btn`. |
| `class="btn-icon"`        | Independent native icon button, without `.btn`; direct decorative SVG and a translated accessible name are required.       |
| `buttonStyles`            | `CSSResult` exported from `src/styles/button.styles.ts`.                                                                   |

Nothing else is public. No other classes, modifiers, custom properties or exports.

## 4. Usage

In the document, or in any light-DOM markup:

```html
<button type="button" class="btn">…</button>
<button type="button" class="btn btn-primary">…</button>
```

Inside a Lit component (labels come from that component's own messages):

```ts
import { buttonStyles } from '../styles/button.styles';

static styles = [buttonStyles, css`/* component styles */`];

render() {
  const t = this.messages.value;
  return html`
    <button type="button" class="btn">${t.datasheet}</button>
    <button type="button" class="btn btn-primary">${t.selectDataset}</button>
  `;
}
```

Usage rules:

- MUST be applied to a `<button>` element. Never to `<div>`, `<span>` or `<a>`.
- MUST set `type` explicitly (`button`, `submit` or `reset`). A button with no
  `type` inside a form submits it.
- MUST NOT add `role` or `tabindex`.
- Use `.btn-red` only for destructive or discarding actions; never for ordinary or primary actions.
- Disable with the native `disabled` attribute, not `aria-disabled` or a class.
- Icon controls supply a translated `aria-label` (for example Close) and direct `svg[aria-hidden="true"][focusable="false"]`. They remain native buttons with explicit type; do not invent a custom icon component.

## 5. Visual specification

### 5.1 Tokens used

All from `css/root.css`: `--stone-50`, `--stone-200`, `--stone-300`, `--stone-400`,
`--stone-700` (default text colour, A11Y-01), `--blue-100`, `--blue-700`, `--red-100`, `--red-700`, plus the tokens named in
Open questions Q1 to Q3 once decided.

### 5.2 States

| State                | Default                                                         | Primary                                         |
| -------------------- | --------------------------------------------------------------- | ----------------------------------------------- |
| Rest                 | text stone-700 (A11Y-01), border stone-300, bg stone-50         | text blue-700, border blue-700, bg surface (Q1) |
| Hover (enabled only) | text stone-700, border stone-400, bg stone-200                  | bg blue-100                                     |
| Focus-visible        | 2px outline, focus-ring token (Q2), 2px offset                  | same                                            |
| Disabled             | provisional values (Q3); no hover change; `cursor: not-allowed` | same                                            |

### 5.3 Normative CSS

This is the implementation. Values marked `/* Qn */` wait on Open questions.

```css
.btn {
	cursor: pointer;
	border: 1.5px solid var(--stone-300);
	border-radius: 0.5rem;
	border-block-end-width: 3px;
	background-color: var(--stone-50);
	padding: 0.5rem;
	color: var(--stone-700); /* A11Y-01 */
	font-weight: 500;
	font-size: 1rem;
	font-family: inherit;
	text-align: center;

	&:hover:not(:disabled) {
		border-color: var(--stone-400);
		background-color: var(--stone-200);
		color: var(--stone-700);
	}

	&:focus-visible {
		outline: 2px solid var(--focus-ring); /* Q2 */
		outline-offset: 2px;
	}

	&:disabled {
		cursor: not-allowed;
		border-color: var(--stone-200); /* Q3 */
		background-color: var(--stone-100); /* Q3 */
		color: var(--stone-400); /* Q3 */
	}

	&.btn-primary {
		border-color: var(--blue-700);
		background-color: var(--surface); /* Q1: replaces literal `white` */
		color: var(--blue-700);

		&:hover:not(:disabled) {
			background-color: var(--blue-100);
		}
	}

	&.btn-red {
		border-color: var(--red-700);
		background-color: var(--surface);
		color: var(--red-700);

		/* Repeats border and colour: `.btn:hover:not(:disabled)` is more specific than `.btn.btn-red`. */
		&:hover:not(:disabled) {
			border-color: var(--red-700);
			background-color: var(--red-100);
			color: var(--red-700);
		}
	}
}

@media (prefers-reduced-motion: no-preference) {
	.btn {
		transition:
			background-color 500ms ease,
			border-color 500ms ease; /* Q4 */
	}
}
```

The same module also defines independent `.btn-icon`: no border, 0.5rem radius/padding, stone-200 background, stone-900 text, pointer cursor, line-height zero and inherited font. Its direct SVG is display-block and 1.5rem square (24px at the default root size), giving a 40px square button. Hover uses stone-300; keyboard focus has the same 2px focus-ring outline/2px offset. This treatment maps to the close control in `01-3_upload-dataset.html`; it adds no pressed/disabled/touch policy beyond the unresolved questions below. The normative icon declarations live in [button.styles.ts](../../src/styles/button.styles.ts).

Changes from the original CSS:
`font-family: inherit` added (controls don't inherit fonts); `border-bottom-width` became
`border-block-end-width`; hover is limited to enabled buttons; focus-visible and disabled
states added; literal `white` replaced by a token.

## 6. Accessibility

Beyond conventions §7:

- Text controls take their name from visible text. Icon-only controls use translated aria-label with decorative SVG (SEM-08).
- These colour pairs MUST meet 4.5:1, verified against the actual token values:
  stone-700 on stone-50 (5.88:1, A11Y-01); stone-700 on stone-200; blue-700 on surface; blue-700 on blue-100.
- The focus ring MUST be at least 3:1 against the page background(s) it appears on.
- Disabled buttons are exempt from contrast requirements but MUST remain legible.

Manual checks (record results in the PR):

- [ ] Screen reader (VoiceOver or NVDA) announces "<label>, button"; disabled announced as dimmed/unavailable.
- [ ] Windows High Contrast / forced colours: boundary and focus ring visible.
- [ ] 200% browser zoom: label readable, no clipping.

## 7. Internationalisation

- This primitive owns **no strings**. Labels are supplied by the consuming component's
  `i18n()` messages.
- Text-button width is determined by content. Icon glyph size/padding follow the explicit treatment above.
- Long labels wrap onto further lines rather than overflowing or truncating (see Q5).
- Renders correctly with `dir="rtl"` (the style is symmetric; logical properties keep it so).

## 8. Acceptance criteria

| ID        | Criterion                                                                                                                                                                                                                                                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BTN-AC-1  | Default and Primary stories have zero axe violations, including colour contrast.                                                                                                                                                                                                                                                |
| BTN-AC-2  | A `.btn` button is reached with Tab; Enter and Space each fire one `click`.                                                                                                                                                                                                                                                     |
| BTN-AC-3  | When focused by keyboard, computed `outline-style` is not `none` and `outline-width` ≥ 2px.                                                                                                                                                                                                                                     |
| BTN-AC-4  | A `disabled` `.btn` fires no `click` and its computed background does not change on hover.                                                                                                                                                                                                                                      |
| BTN-AC-5  | With `prefers-reduced-motion: reduce` emulated, computed `transition-duration` is `0s`.                                                                                                                                                                                                                                         |
| BTN-AC-6  | A button inside a test Lit element using `buttonStyles` has the same computed colour, background, border and padding as a button in the document.                                                                                                                                                                               |
| BTN-AC-7  | A button in the document (no shadow root) is styled, via `global.ts` adoption.                                                                                                                                                                                                                                                  |
| BTN-AC-8  | Computed `font-family` equals its parent's.                                                                                                                                                                                                                                                                                     |
| BTN-AC-9  | With a 60-character label inside a 200px-wide container, the button does not overflow the container.                                                                                                                                                                                                                            |
| BTN-AC-10 | With `forced-colors: active` emulated, a keyboard-focused button still has a visible outline.                                                                                                                                                                                                                                   |
| BTN-AC-11 | Rendered height is at least 24 CSS px.                                                                                                                                                                                                                                                                                          |
| BTN-AC-12 | `btn-primary` without `btn` applies no button styles.                                                                                                                                                                                                                                                                           |
| BTN-AC-13 | Icon control has the supplied accessible name, decorative SVG and reference/shared styles.                                                                                                                                                                                                                                      |
| BTN-AC-14 | Icon target is at least 24px, actual default button 40px with a 24px glyph.                                                                                                                                                                                                                                                     |
| BTN-AC-15 | `.btn.btn-red` computes border and text colour `--red-700` and background `--surface`, `--red-100` on hover; red-700 on surface and on red-100 is at least 4.5:1; the focus-visible outline is unchanged. Verified by `tests/styles-and-primitives.test.ts` (token, rule and numeric contrast) and the Red story play function. |

BTN-AC-1–14 run independently in `tests/app-shell.e2e.ts` in Chromium, Firefox and WebKit. Story play functions provide additional smoke coverage; reduced-motion and forced-colours emulation stays in Playwright, not Bun or simulated DOM.

## 9. Stories

`src/styles/button.stories.ts`, title `Primitives/Button`:

- **Default**: "Datasheet"
- **Primary**: "Select Dataset"
- **Pair**: both side by side, as they will commonly appear
- **Red**, **Red hover**, **Red focus**, **Red long label**, **Red RTL**: the destructive variant ("Change Dataset")
- **Disabled**: both variants disabled
- **Long label**: 60-character label in a 200px container
- **RTL**: both variants with `dir="rtl"` and an Arabic or Hebrew label
- **In shadow root**: both variants inside a minimal Lit element using `buttonStyles`
- **Icon**: translated-name fixture with decorative SVG and the independent `.btn-icon` treatment

The decorated test host is imported from `.storybook/fixtures/storybook-button-host.ts`; it stays outside production/CEM globs. Stories preview the production sheet and run strict axe in all three engines.

Story labels are fixtures, not app strings, and may be literals.
Docs page: purpose, the usage rules from §4 as Do / Don't, and the rationale in §2.

## 10. Files

- `src/styles/button.styles.ts`, `src/styles/global.ts`
- `src/styles/button.stories.ts`, `.storybook/fixtures/storybook-button-host.ts`
- `tests/app-shell.e2e.ts` (BTN-AC-1–14)
- `css/root.css` is the closed token source; additions require an explicit plan decision.

## 11. Non-goals

Do not build any of these: an `<app-button>` element; size variants; a generic icon system;
loading or busy state; toggle buttons (`aria-pressed`); button groups;
danger, ghost or other variants; links styled as buttons; dark-mode values
(handled by tokens, if at all); a pressed/active style (unless Q6 says otherwise).

## 12. Open questions (human to answer; agents must not resolve)

- **Q1.** Which token replaces `white` for the primary background? _Answered: `--surface` (visual-design §2)._
- **Q2.** Focus ring colour token, and is it the same for both variants? _Answered: `--focus-ring`, for both variants (visual-design §2)._
- **Q3.** Disabled colours. The values above are a proposal.
- **Q4.** Hover changes text colour but the transition covers only background and border,
  so text snaps while the background fades. Add `color` to the transition? Is 500ms intended?
- **Q5.** Long labels: wrap (proposed) or stay on one line?
- **Q6.** The 3px bottom border suggests a physical key. Is there a pressed (`:active`) style?
- **Q7.** Should hover apply on touch devices, or only under `@media (hover: hover)`?
- **Q8.** Any guidance on how many primary buttons may appear in one view or region?
