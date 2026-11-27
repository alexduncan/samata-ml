# Spec: Page Header

**Status:** implemented · Tier: **Style primitive** · Criterion prefix: `PH`

## 1. Summary

Shared native page-header layout for one route h1, description and optional action, including the authorised keyboard heading outline.

## 2. Decision and rationale

Semantic header markup needs styling only. A new custom element would obscure route-owned heading focus and add an unnecessary API. Existing feature-private header styling remains owned by those features.

## 3. Public API (closed)

| Item                     | Contract                                                                                                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pageHeaderStyles`       | Sole CSSResult export from `src/styles/page-header.styles.ts`.                                                                                                                                  |
| `.page-header`           | Header layout hook; direct h1, p and optional button/a action.                                                                                                                                  |
| `headingFocusStyles`     | Implementation helper, sole export of `src/styles/heading-focus.styles.ts`; only `.page-header > h1:focus-visible`. Composed into pageHeaderStyles and adopted by five existing heading owners. |
| `observeStickyHeader`    | Framework-free core, `src/common/sticky-header.ts`: measures a sticky `.page-header` and owns the root `--page-header-block-size` property (§5).                                                |
| `StickyHeaderController` | Shared reactive controller, `src/features/shell/sticky-header-controller.ts`, wrapping `observeStickyHeader` for the six route views.                                                           |

No element, events, properties, variants or parts. The only custom property is the root `--page-header-block-size` written by the sticky-header helper. `main` owns no padding. Route methods are documented in COMPONENTS §5, not introduced by the style primitive.

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

Grid columns are `minmax(0, 1fr) auto`, with title/action then description/action areas; gaps are 2rem/0.5rem, centre alignment and `box-sizing: border-box` with `padding: 1.5rem 2rem`, `inline-size: 100%` and no block-end margin (the header's own padding provides the gap). The header is `position: sticky` at `inset-block-start: 0` with `z-index: 10` and an opaque `--stone-50` background (SHELL-UI-06), and `position: static` below `(max-height: 30rem)` (SHELL-UI-05). H1 has zero margin, stone-900, weight 500 and 1.5rem size; p has zero margin, stone-700 and 1.75rem line-height. Both shrink/wrap. Direct native button/link actions align to the inline end. The heading helper supplies only a 2px focus-ring outline with 2px offset.

Changes from mockup CSS: logical properties, shrinkable/wrapping text, native link action support, SEM-01 single route heading, and visual-design §4 keyboard outline. Normal geometry/type remains the reference. Document main has no padding and keeps the sidebar offset; below 50rem the sidebar stacks above it and main's offset is zero. Every route's non-header content sits in exactly one `.page-body` wrapper with `margin: 0 2rem 2rem` (never nested), declared by each view next to its header rule and, for the two light-DOM shell pages, by `css/base.css` as `#content > .page-body`; shell notices that are direct children of `main#content` get `margin-inline: 2rem` and `margin-block-start: 1rem`. The preview's table is the exception: it is a full-bleed child, and only its notices sit in a `div.page-body`. The 60rem maximum width of the mockup `.page-body` belongs to the separate Large Screens note (HUMAN.md §6).

**Sticky headers.** The document scrolls, not `main` (`css/base.css` gives `html` `overflow-y: scroll`, so the shell's modal scroll lock still overrides it), so every route's header sticks (navigation §8.1). `observeStickyHeader` observes the header's border box with a `ResizeObserver` and the `(max-height: 30rem)` media query and writes the effective block size (0 while short) to `--page-header-block-size` on the root; `html { scroll-padding-block-start: var(--page-header-block-size) }` keeps focus clear of the header (WCAG 2.4.11). The observation that started most recently owns the property and resets it to `0px` only if it is still the owner when it ends. `StickyHeaderController` is the Lit wrapper for the data, preview, target, models, builder and results views, and `src/app.ts` calls the core for the two light-DOM shell headers (unbound `/models/new` placeholder, startup recovery). COMPONENTS §3 authorises the helpers (eight call sites) and §4 Lifecycle lists the controller. The preview also passes `onBlockSize` to set `--ui-virtual-table-sticky-offset`.

## 6. Accessibility

One named route h1 with `tabindex="-1"`; native actions retain their own semantics. Heading focus never moves document/table offsets. A sticky header never hides focus: scroll padding follows its measured size (WCAG 2.4.11), and it is static on short viewports (WCAG 1.4.10 reflow). Real keyboard/screen-reader/zoom checks complement automated focus, RTL, forced-colours and reflow tests.

## 7. Internationalisation

Owns no strings. Headings/descriptions/actions are consumer content; long LTR/RTL text wraps without truncation.

## 8. Acceptance criteria

| ID           | Criterion and evidence                                                                                                                                                                                     |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PH-AC-1      | Route-owned heading focus, native action and long LTR/RTL reflow.                                                                                                                                          |
| PH-AC-2      | Main/header reference geometry and semantic markup.                                                                                                                                                        |
| PH-AC-3      | Data/target controls remain usable at 375px without sidebar offset.                                                                                                                                        |
| STICKY-HDR-1 | `observeStickyHeader` writes the observed size, writes `0px` while short, and resets only when still the owner (`tests/sticky-header.test.ts`).                                                            |
| STICKY-AC-1  | At 1280×800 the document (not `main`) scrolls on `/data`, `/target`, `/models`, `/models/new` (bound wizard) and `/results` (and `/models/1`); each header sticks at 0 with `--stone-50` and `z-index` 10. |
| STICKY-AC-2  | At 1280×400 headers are static and the property is `0px`.                                                                                                                                                  |
| STICKY-AC-3  | Shift+Tab to an element above the scroll position leaves it below the header; the property equals the header's block size within 1px, also when it wraps.                                                  |
| STICKY-AC-4  | The property follows route changes and never keeps an unmounted view's value; RTL with a long title wraps without overflow.                                                                                |
| STICKY-AC-5  | The unbound placeholder and startup-recovery headers publish their size and keep Retry clear of the header at 320×640 with 200% text.                                                                      |
| STICKY-AC-6  | A content modal opened at 600px applies the scroll lock and keeps `scrollY`; closing it restores scrolling.                                                                                                |
| MAIN-AC-1    | `main` has zero padding; headers are `24px 32px` border-box spanning `main`; the first content wrapper is inset 32px (1440px and 375px, LTR and RTL); no horizontal overflow.                              |
| MAIN-AC-2    | PH-AC-2 and `PARITY-main` pass without known-failure entries; the target alerts start 32px in; no `.page-body` is nested.                                                                                  |

PH-AC-1..3 run in `tests/app-shell.e2e.ts`; STICKY-AC-1..6 in `tests/sticky-page-header.e2e.ts`; MAIN-AC-1..2 in `tests/main-spacing.e2e.ts`. FOCUS-AC-1–6 there independently cover owner boundaries, nested delegation, cancellation, async readiness and preserved scroll/normal geometry; existing header parity mappings remain blocking.

## 9. Stories

`src/styles/page-header.stories.ts`, `Primitives/Page Header`: TitleAndDescription, WithAction, LongLabel and RTL. The production helper is composed in the previews.

## 10. Files

`src/styles/page-header.styles.ts`, `src/styles/heading-focus.styles.ts`, `src/styles/page-header.stories.ts`, `src/styles/global.ts`, `src/common/sticky-header.ts`, `src/features/shell/sticky-header-controller.ts`, `css/base.css`, `tests/sticky-header.test.ts`, `tests/sticky-page-header.e2e.ts`, `tests/main-spacing.e2e.ts`, `tests/app-shell.e2e.ts`, `tests/visual-parity/map.ts`.

## 11. Non-goals

No route decisions, scroll-restoration changes, action behaviour, extra heading API, new focus tokens or feature-header redesign.

## 12. Open questions

None for this primitive.
