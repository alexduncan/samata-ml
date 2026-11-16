# Spec: Reserved Content Modal and Dialog

**Status:** implemented — behaviour and shared shell appearance; prose styling remains draft-only pending human promotion. · Tiers: **Connected component** and **Presentational component** · Criterion prefix: `CDLG`

## 1. Summary

`app-content-modal` loads safe reserved-route content and owns router intent. `app-content-dialog` presents that fragment in a named native dialog without stores, loading services or route decisions.

## 2. Decision and rationale

The loader/controller stays connected; the independently documented presentational dialog accepts typed labels and safe nodes. Native close synchronisation distinguishes user intent from history/property updates. A generic dialog framework or presentational i18n subscription is unnecessary.

## 3. Public API (closed)

Connected tag `app-content-modal`, class `AppContentModal`, source `src/features/shell/app-content-modal.ts`: tag only, no other API.

Presentational tag `app-content-dialog`, class `AppContentDialog`, source `src/features/shell/app-content-dialog.ts`:

| Property      | Type/default                               | Attribute      |
| ------------- | ------------------------------------------ | -------------- |
| `open`        | boolean, false                             | `open`         |
| `heading`     | string, empty                              | `heading`      |
| `contentLang` | string, empty                              | `content-lang` |
| `contentDir`  | `'' \| 'ltr' \| 'rtl'`, empty              | `content-dir`  |
| `content`     | `DocumentFragment \| null`, null           | Property only  |
| `status`      | `'loading' \| 'ready' \| 'error'`, loading | `status`       |
| `labels`      | `ContentDialogLabels`                      | Property only  |

All scalar properties are unreflected. `ContentDialogLabels` exports exactly `close: string` and `loadError: string`, with standalone defaults “Close” and “This content could not be loaded. Check your connection, then close this dialog and try again.” `ContentDialogCloseDetail = Record<string, never>` is the exported empty detail type.

The only event is `app-content-dialog-close: CustomEvent<ContentDialogCloseDetail>`, dispatched on the host once for user button/native dismissal, `bubbles: false`, `composed: false`. Property/route-driven closing emits no intent. Apart from the named class and two contract types, there are no slots, public methods, parts, CSS properties or other exports. CEM is derived from this contract and excludes private members.

## 4. Usage

The shell mounts `<app-content-modal></app-content-modal>`. A direct presentational consumer binds safe properties:

```ts
html`<app-content-dialog
	.open=${open}
	.heading=${title}
	.status=${'ready'}
	.content=${safeFragment}
	.contentLang=${lang}
	.contentDir=${dir}
	.labels=${translatedLabels}
	@app-content-dialog-close=${handleDismiss}></app-content-dialog>`;
```

Pass loader/sanitiser output, never HTML strings. The child clones the fragment before rendering, including readiness transitions with the same source; it never consumes or mutates consumer nodes. Heading/body lang and dir apply only while ready. Loading sets body aria-busy; error renders one labelled alert while Close remains usable.

Native opening reconciles on first render/open-property changes, not on every loading/content update, so a delayed parent cannot reopen a user-closed dialog. Counted suppression consumes queued closes caused by property changes/disconnection, including immediate reopening.

The connected parent retains transient status/entry/fragment, AbortController, request sequence and path guards around loadContentEntry. Only a complete current entry and safe fragment become ready; idle/loading maps to loading. Each reserved-route opening or switch creates a fresh child instance, so an old route's queued event cannot dismiss a new reserved route. Leaving a reserved route keeps the current instance connected while it closes, so the browser returns focus to the invoker after Back as well as after Esc or the close button. User intent calls closeReserved once only for the corresponding active reserved path; history-driven close has no navigation echo. Source loader, sanitiser, router decisions and underlay/scroll ownership remain unchanged.

## 5. Visual specification

Structure follows `drafts/00-2_content-modal.html`; prose has no promoted appearance and no parity entries. The child reuses dialogStyles and buttonStyles with display-contents/hidden host rules, a wrapping h2 and non-shrinking icon control. Connected host is display-contents/hidden. No new prose typography, colours, spacing system or sanitised-content CSS API exists.

The shared dialog header translates its title to named h2 (SEM-04), and the native icon button uses SEM-08 decorative SVG. Paired draft/app screenshots document structure/shared styling only, not finished prose parity.

## 6. Accessibility

Native dialog aria-labelledby references h2. Close has the translated accessible name, a decorative non-focusable SVG and shared 40px target/24px glyph. Native Esc/focus return remain browser-owned; there is no role/aria-modal, custom Esc, focus trap or document scroll lock. Manual review checks loading/ready/error names, invoker focus, real zoom, RTL and display settings. Strict ready-content axe has no exclusions.

## 7. Internationalisation

The connected dictionary owns About/Privacy/Help fallback titles and existing Close/load-error text. Loaded entry titles retain their consumer wording. The child owns no messages/stores and receives ContentDialogLabels; entry metadata controls ready content language/direction. No language switcher or locale persistence is introduced.

## 8. Acceptance criteria

| ID        | Criterion                                                                                                   |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| CDLG-AC-1 | Button emits exactly one typed non-bubbling/non-composed intent; subsequent loading update does not reopen. |
| CDLG-AC-2 | Native Esc emits once and returns keyboard invoker focus.                                                   |
| CDLG-AC-3 | Named h2/control/decorative SVG, unreflected properties, strict axe and draft structure.                    |
| CDLG-AC-4 | Language/direction are ready-only; loading has aria-busy.                                                   |
| CDLG-AC-5 | Same source fragment survives repeated readiness/render transitions intact.                                 |
| CDLG-AC-6 | Error has one consumer-labelled alert and retains supplied control text.                                    |
| CDLG-AC-7 | Property close/immediate reopen suppress queued native user intent.                                         |
| CDLG-AC-8 | A newer reserved route survives queued Back closure; no stale content/navigation echo.                      |
| CEM-AC-1  | Generated seven-field/event contract excludes private members and drives actual Docs controls.              |

CDLG tests run in `tests/content-dialog.e2e.ts` across all three engines. `tests/content.e2e.ts` CNT-E2E-1–4 and app-shell tests cover direct-load close, errors, external-link safety, stale loads, Back/Forward and preserved underlay/history; FOCUS-AC-2 in `tests/app-shell.e2e.ts` asserts invoker focus after Back closes the modal and after Esc closes a Forward-reopened modal. CEM artifact assertions run in `tests/custom-elements-manifest.test.ts`; built Docs control rendering/update is verified separately. `tests/a11y.e2e.ts` retains preview A11Y-E2E-3 and adds unique A11Y-E2E-CONTENT.

## 9. Stories

`src/features/shell/app-content-dialog.stories.ts`, `Shell/Content Dialog`: Loading, Ready, Error, LongHeading and RTL. Ready uses a safe structured prose/table fixture with valid headings/caption/scoped headers. Generated CEM supplies properties/events; there are no duplicate handwritten controls. The connected network/router owner has real app journeys rather than a bootstrapped story.

## 10. Files

Both shell component files, the co-located content-dialog story, `tests/content-dialog.e2e.ts`, `tests/custom-elements-manifest.test.ts`, `tests/content.e2e.ts`, `tests/app-shell.e2e.ts`, `tests/a11y.e2e.ts` and `custom-elements-manifest.config.mjs`.

## 11. Non-goals

No generic dialog abstraction, raw HTML input, source-fragment mutation, loader/sanitiser changes, extra routing/persistence, feature-dialog migration or new prose design.

## 12. Open questions

No unresolved behaviour/API questions. Human styling/promotion of the prose draft remains non-blocking appearance work in HUMAN.md.
