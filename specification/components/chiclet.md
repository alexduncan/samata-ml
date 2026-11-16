# Spec: Chiclet (`.chiclet`)

**Status:** implemented · Tier: **Style primitive** · Criterion prefix: `CHIP`

## 1. Summary

Compact consumer-supplied text, rendered as an inline outlined count or a solid category/status badge. One shared CSSResult serves cards, sidebar and welcome content.

## 2. Decision and rationale

Native text needs styling only. A custom element, formatter or status store would add behaviour this primitive does not own. Solid variants preserve the badge treatment while ordinary counts retain the mockup's actual inline cascade.

## 3. Public API (closed)

| Item                      | Contract                                                   |
| ------------------------- | ---------------------------------------------------------- |
| `.chiclet`                | Default outlined inline treatment.                         |
| `.chiclet.chiclet-purple` | Solid purple category badge.                               |
| `.chiclet.chiclet-teal`   | Solid teal category badge.                                 |
| `.chiclet.chiclet-amber`  | Solid amber badge with dark text.                          |
| `chicletStyles`           | Sole CSSResult export from `src/styles/chiclet.styles.ts`. |

No element, properties, events, parts or custom properties. Variant classes have no effect without `.chiclet`.

## 4. Usage

```html
<span class="chiclet">344 rows</span> <span class="chiclet chiclet-amber">beta</span>
```

Import `chicletStyles` into the consuming shadow root; `global.ts` adopts the same sheet for document markup. Supply translated/formatted text. Do not use the badge alone as a control or convey status only through colour.

## 5. Visual specification

The normative CSS is [chiclet.styles.ts](../../src/styles/chiclet.styles.ts). Reference selectors are `.chiclet` and `.badge-*` in `01-1`, `03-2` and `00_first-load.html`, with the badge classes translated by SEM-11.

| Treatment      | Values                                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Default        | `display: inline`; 1px stone-600 border; 0.25rem radius; 0.125rem block/0.25rem inline padding; stone-800; 500 weight, 0.75rem, inherited family and normal line-height. |
| Solid variants | Inline-block; transparent border; 0.375rem inline-start padding; 0.125rem letter spacing; uppercase presentation.                                                        |
| Purple / teal  | Purple-700 / teal-700 background, surface text.                                                                                                                          |
| Amber          | Amber-500 background, stone-900 text (A11Y-04).                                                                                                                          |

Changes from mockup CSS: logical padding; SEM-11 class consolidation and inherited one-pixel border; A11Y-04 amber contrast. Default counts have no invented monospace or nowrap treatment. Consumers own positioning and wrapping layout. The solid beta's border can add one pixel to the welcome title line box; its mapped geometry records that departure.

## 6. Accessibility

Text supplies the meaning; the primitive adds no role or focus target. Status consumers provide accessible text alongside decorative indicators. Manual review checks readable long text, RTL and real 200% zoom.

## 7. Internationalisation

Owns no strings. Consumers format numbers and select plurals using raw counts. Default text preserves case; solid uppercase is visual and never the only source of meaning.

## 8. Acceptance criteria

| ID        | Criterion and evidence                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------- |
| CHIP-AC-1 | Default/solid type, case and padding match the reference; `tests/app-shell.e2e.ts`, plus sidebar/welcome parity mappings. |

Stories exercise long/RTL labels and axe in all three engines; sidebar acceptance also verifies wrapping/grouped count semantics.

## 9. Stories

`src/styles/chiclet.stories.ts`, `Primitives/Chiclet`: Default, Purple, Teal, Amber, LongLabel and RTL. Docs describe consumer text and forbid colour-only meaning.

## 10. Files

`src/styles/chiclet.styles.ts`, `src/styles/chiclet.stories.ts`, `src/styles/global.ts`, `tests/app-shell.e2e.ts`, `tests/visual-parity/map.ts`.

## 11. Non-goals

No dismissal, interaction, formatter, status logic, extra variants, sizes or card positioning API.

## 12. Open questions

None for this closed primitive.
