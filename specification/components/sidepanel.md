# Spec: Side Panel (`app-column-details`)

**Status:** implemented — delivered in Step 1 T4 (`src/features/data/app-column-details.ts`).

Criterion prefix: `PANEL` · Tier: **Presentational component** (conventions §2)

Read [`COMPONENTS.md`](../COMPONENTS.md) first. This spec follows its §12 template.

## 1. Summary

An overlay side panel (`<app-column-details>`) that displays summary statistics, distributions, and data quality metrics for a selected column in the dataset preview. Rendered as a non-modal `<aside class="overlay">` on the right side of the preview area.

## 2. Public API (closed)

### `<app-column-details>`

| Item                  | Detail                                                                                                                                                                                                                                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tag                   | `app-column-details`. Class `AppColumnDetails` in `src/features/data/app-column-details.ts`.                                                                                                                                                                                                                                                      |
| `column`              | `ColumnStats \| null`, default `null`. Discriminated stats object (`numeric`, `categorical`, `boolean`, `datetime`, `text`). Renders `nothing` when `null`.                                                                                                                                                                                       |
| `description`         | `string`, default `''`. Column description from dataset descriptor or profile.                                                                                                                                                                                                                                                                    |
| `rowCount`            | `number`, default `0`. Total dataset row count for missing/valid ratio calculation.                                                                                                                                                                                                                                                               |
| `labels`              | Object of translated strings with default fallbacks for `close`, `type`, `missing`, `invalid`, `min`, `median`, `mean`, `max`, `histogram`, `range`, `count`, `category`, `frequency`, `percentage`, `showAll`, `showFewer`, `distinct`, `identifier`, `true`, `false`, `earliest`, `latest`, `missingTokens`, `invalidExamples`, `notAvailable`. |
| Events                | `app-column-details-close`: `CustomEvent<{}>`, emitted on Close button click or Escape key press. `bubbles: false`, `composed: false`.                                                                                                                                                                                                            |
| Slots, parts, methods | None.                                                                                                                                                                                                                                                                                                                                             |

## 3. Behaviour and Display

- **Fixed overlay positioning:** Positioned on the right edge of the viewport with `z-index: 50`, `box-shadow: var(--shadow-panel)`, `box-sizing: border-box`, `inline-size: 300px`, and `max-inline-size: 100%` so it fits narrow (320px) screens without horizontal overflow.
- **Dismissal & keyboard:** Clicking the close button or pressing Escape emits `app-column-details-close`. The consumer sets `selectedColumn = null` and restores focus to the column header button.
- **Summary metrics:** Displays missing count/percentage and invalid count/percentage if > 0.
- **Numeric columns:** Displays min, median, mean (4 decimals), max, and precomputed histogram bins. Standard deviation is intentionally omitted (not stored).
- **Categorical columns:** Displays distinct count, value frequencies sorted descending (then alphabetical), percentages over non-missing values, showing first 50 entries with a "Show all" / "Show fewer" toggle. The compact English header displays `Freq.` in `<abbr title="Frequency">` and the scoped column header is named “Frequency”. An explicitly supplied `labels.frequency` supplies the visible and accessible text. A non-empty `labels.frequencyExpansion` pairs with a non-empty localised short label and supplies its title and accessible name. With a blank label the English pair is used. Help & Guide defines frequency and the percentage denominator.
- **Boolean columns:** Displays true and false counts with the default `Count` and `%` headers.
- **Datetime columns:** Displays earliest and latest timestamps formatted in UTC.
- **Text columns:** Displays distinct count and an "Identifier candidate" badge when distinct count equals dataset row count.
- **Definition coverage:** `TERM-AC-2` in `tests/data-preview.e2e.ts` checks default, full and abbreviated override labels, Boolean headers and escaped category values. Inspector stories cover all five types, long labels and RTL.
