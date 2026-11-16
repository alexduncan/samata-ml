# Spec: Shared native-dialog styles

**Status:** implemented · Tier: **Style primitive** · Criterion prefix: `DLG`

## 1. Summary

Shared appearance for native modal dialogs and their named headers. Consumers retain opening, dismissal, content, messages and state ownership.

## 2. Decision and rationale

`<dialog>` supplies top-layer placement, inert background, keyboard dismissal and focus return. A generic wrapper or manual focus trap is unnecessary; a CSSResult works in the document and consuming shadow roots.

## 3. Public API (closed)

`dialogStyles` is the sole CSSResult export from `src/styles/dialog.styles.ts`. It styles native `dialog`, `dialog::backdrop`, `.modal-header` and its `h2`. There is no custom element, property, event, method, part or custom property API.

## 4. Usage

```html
<dialog aria-labelledby="dialog-title">
	<header class="modal-header"><h2 id="dialog-title">…</h2></header>
	<p>…</p>
</dialog>
```

Adopt the sheet in the owning root, then call native `showModal()`/`close()` from the owner. Name the dialog through its visible h2. Buttons use the separate button primitive. Do not set unconditional dialog display, add role/aria-modal, an Esc listener or a focus trap. Do not lock document scrolling.

## 5. Visual specification

The normative CSS is [dialog.styles.ts](../../src/styles/dialog.styles.ts), mapped from `00_first-load.html` and `css/modal.css`.

| Surface       | Values                                                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dialog        | Border-box; centred margin; shadow-deep; 1px stone-200 border; 1rem radius; surface background; 1.5rem padding; stone-800 text.                   |
| Size/overflow | `inline-size: min(40rem, calc(100% - 2rem))`; no UA max-inline limit; max block size viewport minus 2rem; auto overflow and contained overscroll. |
| Backdrop      | Backdrop token, blur 4px; hidden overflow and contained overscroll.                                                                               |
| Header        | Flex, space-between, centre alignment; 1rem block-end padding.                                                                                    |
| h2            | Zero margin; stone-800, weight 500, 1.5rem.                                                                                                       |

Changes from mockup CSS: logical properties, viewport-safe size/overflow, tokenised backdrop and surface, SEM-04 h2 naming. There is no new body/prose design; draft consumers reuse existing styles.

## 6. Accessibility

The owner supplies one visible accessible name, native buttons and an appropriate initial focus target. Native Esc and close restore invoker focus. Property/route synchronisation must suppress user-close intent where the consuming spec requires it. Manual checks cover dialog announcements, keyboard focus return, real zoom, forced colours and motion settings.

## 7. Internationalisation

Owns no strings. Consumer headings/body/controls are translated or safe consumer content. Header text can wrap; consumers keep the close target from shrinking when required.

## 8. Acceptance criteria

| ID       | Criterion and evidence                                                                                |
| -------- | ----------------------------------------------------------------------------------------------------- |
| DLG-AC-1 | Native opening, named h2, Esc and invoker focus work with the shared sheet; `tests/app-shell.e2e.ts`. |

Welcome/content acceptance exercises real ownership and close synchronisation. The `modal-dialog` parity mapping checks reference geometry, colours, border, shadow and backdrop; it has no drift exemption.

## 9. Stories

`src/styles/dialog.stories.ts`, `Primitives/Dialog`: Default, LongContent and RTL, with native opening/closing controls and isolated Docs previews. Axe failures fail story tests.

## 10. Files

`src/styles/dialog.styles.ts`, `src/styles/dialog.stories.ts`, `src/styles/global.ts`, `tests/app-shell.e2e.ts`, `tests/visual-parity/map.ts`.

## 11. Non-goals

No dialog element framework, router, loader, focus trap, scroll lock, light-dismiss API, body typography or feature-specific sizing contract.

## 12. Open questions

None for the shared appearance; consuming specs own behaviour.
