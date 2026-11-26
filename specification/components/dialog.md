# Spec: Shared native-dialog styles

**Status:** implemented · Tier: **Style primitive** · Criterion prefix: `DLG`

## 1. Summary

Shared appearance for native content modals and confirmation dialogs. Consumers own opening, dismissal, content, messages and state.

## 2. Decision and rationale

`<dialog>` supplies top-layer placement, an inert background, keyboard dismissal and focus return. The two named layouts share a Lit CSSResult that can also be adopted in the document.

## 3. Public API (closed)

`dialogStyles` is the sole export from `src/styles/dialog.styles.ts`. Base `dialog` and `dialog::backdrop` styles also apply to bare native dialogs. Content consumers use `dialog.modal`, `.modal-header`, optional `.header-titles` and `.header-subtitle`, and `.modal-content`. Confirmations use `dialog.confirm-dialog`, `.confirm-header`, `.confirm-body` and `.confirm-footer`. The layouts expose no component properties, events, methods, parts or custom property API.

## 4. Usage

```html
<dialog class="modal" closedby="any" aria-labelledby="content-title">
	<header class="modal-header">
		<h2 id="content-title">Dataset information</h2>
		<button type="button" class="btn-icon" aria-label="Close">
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				aria-hidden="true"
				focusable="false">
				<path d="M6 6l12 12M18 6 6 18"></path>
			</svg>
		</button>
	</header>
	<div class="modal-content">…</div>
</dialog>

<dialog class="confirm-dialog" aria-labelledby="confirm-title">
	<header class="confirm-header"><h2 id="confirm-title">Change dataset</h2></header>
	<div class="confirm-body"><p>Configured targets and models will be discarded.</p></div>
	<footer class="confirm-footer">
		<button type="button" class="btn">Cancel</button>
		<button type="button" class="btn btn-primary">Change Dataset</button>
	</footer>
</dialog>
```

The owner uses native `showModal()` and `close()`, and names the dialog through its visible h2. Buttons use the shared button primitive. Native dialogs supply their own role and modal semantics. The shell locks page scrolling until the last modal closes or is removed, while the dialog retains its own scrolling.

### Content modals

The native `closedby="any"` policy allows Escape and a backdrop click. A click requires both the primary pointer press and release outside the dialog. Dialog padding and drags crossing the edge leave the dialog open. The beta welcome uses `closedby="none"` and prevents `cancel` until **Get Started** records acceptance. Route-driven dismissal still follows the welcome and reserved-content contracts.

`observeDialogHeader` in `src/common/dom/dialog-header.ts` and `installBackdropDismiss` in `src/common/dom/dialog-backdrop.ts` serve `app-content-dialog`, `app-welcome-modal`, `app-datasheet-dialog`, `app-upload-dataset-dialog` and `app-model-description-dialog`. The backdrop helper attaches only when the browser lacks `HTMLDialogElement.closedBy`, including older Safari/WebKit. It checks the current dismissal policy and pairs pointer IDs. Open-session observation and temporary focus geometry are released on native close or teardown.

### Confirmations

The footer puts the safe Cancel action first. The body uses plain copy and may include an inline `role="alert"` for recovery feedback. A button or idle Escape dismisses. A busy protected confirmation uses `closedby="none"` and also prevents native `cancel` for browsers without the attribute. Change Dataset keeps `dialog.change-dataset-modal` and Reopen Section keeps `dialog[data-confirm="reopen-section"]` as purpose selectors.

## 5. Visual specification

The normative CSS is [dialog.styles.ts](../../src/styles/dialog.styles.ts), mapped from `00_first-load.html` and `css/modal.css`.

| Surface        | Values                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Base dialog    | Centred border box. The stone-200 border is 1px, the radius is 1rem and the padding is 1.5rem. Uses the shared surface and shadow-deep tokens.         |
| Content size   | `inline-size: min(40rem, calc(100% - 2rem))` and a maximum block size of viewport height minus 2rem. Overflow is auto with contained overscroll.       |
| Content header | The wrapping flex header pins to the inside block-start border and uses the opaque surface. Its measured block size sets `scroll-padding-block-start`. |
| Confirmation   | Uses the base surface with a 1.5px border, a maximum width of 32rem and a two-action footer.                                                           |
| Backdrop       | Uses the backdrop token and 4px blur, with hidden overflow and contained overscroll.                                                                   |

A header taller than half the dialog scrollport becomes static, keeps the same box dimensions and clears the temporary scroll padding. The unscrolled welcome retains reference geometry and the `modal-dialog` parity mapping. Draft-only surfaces share these layouts while retaining their existing body and control styles.

## 6. Accessibility

The owner supplies a visible accessible name, native buttons and the initial focus target. The resize observer watches both the open dialog and its header. Forward and reverse keyboard focus remain visible below the sticky header. If native focus scrolling lands a control under the header, the dialog scrolls it into view. At extreme sizes the header scrolls with the content. Native close returns focus to the invoker. The consuming owner handles route or property synchronisation and suppresses user intent during teardown.

## 7. Internationalisation

The style primitive has no strings. Consumers provide translated headings and actions or safe loaded content. Titles wrap beside the fixed-size icon and the styles use logical properties.

## 8. Acceptance criteria

| ID                                | Criterion and evidence                                                                                                             |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| DLG-AC-1                          | Native opening, named h2, Escape and invoker focus work with the shared sheet in `tests/app-shell.e2e.ts`.                         |
| DLG-HARM-1 and DLG-HARM-2         | Content owners and confirmations use their shared layout and corresponding controls.                                               |
| DLG-STICKY-1                      | Browser tests cover narrow RTL, forward and reverse focus, and the unpinned fallback. Native Safari was also checked at 200% zoom. |
| DLG-STICKY-2                      | The `modal-dialog` parity entry checks the unscrolled welcome against the mapped reference.                                        |
| DLG-BACKDROP-1 and DLG-BACKDROP-2 | Browser tests cover content dismissal, drags, padding, invoker focus, protected confirmations and beta consent.                    |

## 9. Stories

`Primitives/Dialog` in `src/styles/dialog.stories.ts` covers a content modal, long content, RTL and a confirmation with initial focus on Cancel. The consuming stories exercise their own status and usage cases.

## 10. Files

`src/styles/dialog.styles.ts`, `src/styles/dialog.stories.ts`, `src/styles/global.ts`, `src/common/dom/dialog-header.ts`, `src/common/dom/dialog-backdrop.ts`, `tests/app-shell.e2e.ts`, `tests/content-dialog.e2e.ts`, `tests/visual-parity/map.ts`.

## 11. Non-goals

The primitive leaves routing, loading, consent, feature content and state to its consumers. Existing prose and feature-specific sizing stay with their owners.

## 12. Open questions

Draft mockup styling is tracked in the human queue.
