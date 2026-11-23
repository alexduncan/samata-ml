# Spec: Page Header

**Status:** implemented · Tier: **Style primitive** · Criterion prefix: `PH`

## 1. Summary

Shared native page-header layout for one route h1, description and optional action, including the authorised keyboard heading outline.

## 2. Decision and rationale

Semantic header markup needs styling only. A new custom element would obscure route-owned heading focus and add an unnecessary API. Existing feature-private header styling remains owned by those features.

## 3. Public API (closed)

| Item                 | Contract                                                                                                                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pageHeaderStyles`   | Sole CSSResult export from `src/styles/page-header.styles.ts`.                                                                                                                                  |
| `.page-header`       | Header layout hook; direct h1, p and optional button/a action.                                                                                                                                  |
| `headingFocusStyles` | Implementation helper, sole export of `src/styles/heading-focus.styles.ts`; only `.page-header > h1:focus-visible`. Composed into pageHeaderStyles and adopted by five existing heading owners. |

No element, events, properties, variants, parts or custom properties. Route methods are documented in COMPONENTS §5, not introduced by the style primitive.

## 4. Usage

```html
<header class="page-header">
	<h1 tabindex="-1">…</h1>
	<p>…</p>
	<button type="button" class="btn">…</button>
</header>
```

Use the actual route title as the sole page h1. Supply consumer text/actions and adopt the sheet in the owning root. The heading has no normal Tab stop; the owner fulfils an explicit cancellable navigation request with `preventScroll`.

## 5. Visual specification

The normative CSS is [page-header.styles.ts](../../src/styles/page-header.styles.ts), mapped from `css/base.css` `.page-header` in `00`, `01-1`, `01-4` and `02-1`.

Grid columns are `minmax(0, 1fr) auto`, with title/action then description/action areas; gaps are 2rem/0.5rem, centre alignment, sticky block-start zero and 1.5rem block-end margin. H1 has zero margin, stone-900, weight 500 and 1.5rem size; p has zero margin, stone-700 and 1.75rem line-height. Both shrink/wrap. Direct native button/link actions align to the inline end. The heading helper supplies only a 2px focus-ring outline with 2px offset.

Changes from mockup CSS: logical properties, shrinkable/wrapping text, native link action support, SEM-01 single route heading, and visual-design §4 keyboard outline. Normal geometry/type remains the reference. Document main keeps content-box padding 2rem and sidebar offset; below 50rem the sidebar stacks above it and main's offset is zero.

## 6. Accessibility

One named route h1 with `tabindex="-1"`; native actions retain their own semantics. Heading focus never moves document/table offsets. Real keyboard/screen-reader/zoom checks complement automated focus, RTL, forced-colours and reflow tests.

## 7. Internationalisation

Owns no strings. Headings/descriptions/actions are consumer content; long LTR/RTL text wraps without truncation.

## 8. Acceptance criteria

| ID      | Criterion and evidence                                              |
| ------- | ------------------------------------------------------------------- |
| PH-AC-1 | Route-owned heading focus, native action and long LTR/RTL reflow.   |
| PH-AC-2 | Main/header reference geometry and semantic markup.                 |
| PH-AC-3 | Data/target controls remain usable at 375px without sidebar offset. |

All three run in `tests/app-shell.e2e.ts`. FOCUS-AC-1–6 there independently cover owner boundaries, nested delegation, cancellation, async readiness and preserved scroll/normal geometry; existing header parity mappings remain blocking.

## 9. Stories

`src/styles/page-header.stories.ts`, `Primitives/Page Header`: TitleAndDescription, WithAction, LongLabel and RTL. The production helper is composed in the previews.

## 10. Files

`src/styles/page-header.styles.ts`, `src/styles/heading-focus.styles.ts`, `src/styles/page-header.stories.ts`, `src/styles/global.ts`, `tests/app-shell.e2e.ts`, `tests/visual-parity/map.ts`.

## 11. Non-goals

No route decisions, scroll-restoration changes, action behaviour, extra heading API, new focus tokens or feature-header redesign.

## 12. Open questions

None for this primitive.
