# Temporal column types: date, time and datetime

**Status:** draft | **Updated:** 2026-11-25T11:31:22Z
**Authors:** Claude Code (claude-opus-5-5) | **Created:** 2026-11-25T10:49:58Z
**Verified by:** — | **Verified:** — | **Verification:** changes-requested
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour:** Ingestion elects one temporal type, `datetime`, for every column of dates, date-times or epoch timestamps (`src/common/storage/profiler.ts:349-369`). A column of plain `YYYY-MM-DD` values is shown as `Datetime` and rendered with `toISOString()` (`2013-08-14T00:00:00.000Z`) in the preview table (`src/features/data/app-data-view.ts:64-66`) and the column inspector (`src/features/data/app-column-details.ts:450-468`). Whether a column has times is recorded only as an unread `format.hasTime` flag. Time-only values (`09:30`) are not recognised and become categorical or text. Epoch timestamps are only checked when the header suggests time (`headerSuggestsTime`, `src/common/storage/cells.ts:454`). They must have exactly 10, 13 or 16 digits (`EPOCH_PATTERN`, `cells.ts:175`), so the documented 1980-01-01 lower bound is unreachable. Seconds before 2001-09-09T01:46:40Z have 9 digits, as do the equivalent milliseconds (12) and microseconds (15). A seconds column that spans 2001 therefore fails the 98 % threshold.

**Target behaviour:** Ingestion distinguishes three temporal types:

- **`date`:** calendar dates. This includes midnight date-times such as `2013-08-14 00:00:00`, a common Excel and pandas export form.
- **`time`:** times of day.
- **`datetime`:** instants, which includes every epoch timestamp.

Election keeps the existing principle: the most specific type with at least 98 % coverage wins. So `date` is tried before `datetime`. In a mostly-date column, the few cells with a real time of day are invalid and listed as invalid examples. Epoch timestamps are detected in any integer column, whatever its header. The unit is chosen by magnitude, so the whole 1980–2050 window is accepted. The UI shows `Date`, `Time` or `Datetime`. Values are formatted to the precision the column actually holds: `2013-08-14`, `09:30`, `2013-08-13T06:03:42Z`. In the COMPAS sample, 12 of the 14 temporal columns become `date`.

**Why:** Showing `2013-08-14T00:00:00.000Z` for a date-only column is noise for the non-technical users this app is for. Later feature-engineering work (FUTURE.md, web-ml request 11) also needs to know whether a column holds dates, times or instants. The user asked for this split and for wider timestamp support, and chose the mixed-column and header-gate behaviour on 2026-11-25 (D3, D5).

## Scope

**In scope**

- `ColumnType` gains `date` and `time`. A `TEMPORAL_COLUMN_TYPES` constant and an `isTemporalColumnType` predicate replace the literal `'datetime'` eligibility checks.
- New column statistics types `DateColumnStats` and `TimeColumnStats`. `DatetimeColumnStats` gains `precision` and no longer writes `hasTime`.
- Cell detectors: magnitude-based epoch units, a 24-hour time-of-day parser, a date-only test, and `coerceCell` support for `date` and `time`.
- Profiler election for the three temporal types. Epoch detection no longer uses the header gate; `headerSuggestsTime` is removed.
- Pass-2 statistics for `date` and `time`, and a `precision` value for `time` and `datetime`.
- Preview-table and column-inspector formatting through one pure formatter module, plus the type label in the sidebar.
- Generator guards for temporal target and implicit-missing rules, and the COMPAS descriptor's `dataType` values.
- Specification, FUTURE.md and Help text updates.

**Out of scope**

- Migrating datasets already stored in IndexedDB or the persisted `localStorage` summary (D9). Legacy `datetime` columns stay valid and display as before until the dataset is loaded again.
- User control over the elected temporal type or over epoch detection (recorded in FUTURE.md, D10).
- 12-hour clocks, durations (`MM:SS`, hours ≥ 24), time zones on time-only values, nanosecond (19-digit) or fractional epoch values, epochs outside 1980–2050, and new date-string formats.
- Temporal columns as model inputs or targets. All three types stay model-ineligible.
- New visual design, CSS or mockups. Only text content changes.
- Any change to `../web-ml`. Temporal columns never reach web-ml, whose public feature kinds are only `numeric` and `categorical` (installed `web-ml@0.2.0`, `node_modules/web-ml/specification/public-api/tabular-preprocessing.md:14-22`).

**Constraints and invariants**

- `datetime` stays a member of `ColumnType` and keeps its meaning. Legacy metadata that has `format.hasTime` and no `precision` must still type-check, validate and render.
- Persisted app state stays at `STORAGE_VERSION = 1` and IndexedDB stays at `DB_VERSION = 2`. `VALID_COLUMN_TYPES` must accept `date` and `time` in the **same commit** that lets the profiler elect them. Otherwise `decodeProtectedDomain` rejects the whole persisted state (`src/common/storage/training-domain.ts:203-208`) and the app resets.
- Stored cell values: `date` is epoch milliseconds at UTC midnight. `time` is milliseconds since midnight, from 0 to 86,399,999 inclusive. `datetime` is epoch milliseconds in UTC. Invalid cells are `null`.
- `Date.parse`, `new Date(string)`, Temporal and `Intl` are not used to parse or format temporal values. Formatting builds strings from UTC fields, so the browser's time zone never changes the output.
- Boolean, numeric, categorical and text election, the 98 % threshold, the 1,000 and 50,000-row checkpoints, and the date patterns and their bounds are otherwise unchanged.
- British English in UI strings and prose. Exported symbols need TSDoc.

## Required reading

- `specification/data-ingestion.md` §3, §5 — the current inference contract that this plan rewrites for temporal types.
- `specification/plans/archive/data-ingestion-and-storage.md` _Interfaces and behaviour_ → "Epoch timestamps", "Date and time formats" and "Type inference" — the exact `parseDate`, `toEpochMs` and bounds that stay unchanged (T2, T3).
- `specification/components/sidepanel.md` §3 — column-inspector display rules (T4).
- `specification/COMPONENTS.md` §3–§10 — for T4, which changes Lit components and stories.
- `specification/sample-datasets.md` — descriptor `dataType` rules (T5).

## Codebase context

Facts verified by `codebase-scout` on 2026-11-25, so downstream agents need not re-sweep the tree.

- **Relevant specifications:** `specification/data-ingestion.md` §3 and §5 (inference, statistics); `specification/state-and-storage.md:36` and §10 #4 (`ColumnType` copy); `specification/sample-datasets.md:24`; `specification/preview-dataset.md:24-26`; `specification/workflow-steps.md:52,76,79,134,151`; `specification/app-state-and-navigation.md:300-301`; `specification/components/sidepanel.md:20,35,37`; `specification/FUTURE.md:19`. Each restates the type vocabulary or datetime display.
- **Types:** `src/types/state.ts:16` `ColumnType`; `:19` `MODEL_ELIGIBLE_COLUMN_TYPES`; `:27-29` `isModelEligibleColumnType`; `:32-39` `ColumnSummary { name, type, missingCount }`; `:42-55` `DatasetSummary`, which is persisted to `localStorage`. `src/types/dataset.ts:57-65` `DatetimeColumnStats`, with `format` at `:62-64`; `:75-80` `ColumnStats`; `:105-120` `toDatasetSummary`.
- **Cell detectors:** `src/common/storage/cells.ts`:
    - `CellFormat` `:86-90`;
    - `EPOCH_PATTERN` `:175` and `MIN_EPOCH_MS`/`MAX_EPOCH_MS` `:176-177`;
    - `parseEpoch` `:180`, `DATE_PATTERNS` `:196-220` and `parseDate` `:317`;
    - `toEpochMs` `:435`, `headerSuggestsTime` `:454` and `coerceCell(raw, type, format?: CellFormat)` `:475`, whose datetime branch is at `:501-512`.

    No time-only parser exists.

- **Profiler:** `src/common/storage/profiler.ts`:
    - `ColumnProfile` temporal counters `:84-92`: `datetimeActive`, `epochCounts`, `dateOrderCounts`, `dateMatches` (never read), `datetimeMatches`, `dateHasTime`, `dmyForcing`, `mdyForcing` and `hasYearLastDate`;
    - the header-gated epoch parse at `:499` and `:578-587`, and date counting at `:588-597`;
    - `checkDatetimeCheckpoint` `:221-227`, called at `:511`, `:532` and `:628`. It returns early while `values === 0`, so the row-1,000 check is not retried;
    - `chooseDateOrder` `:265-274`;
    - `electColumn` `:323`: boolean `:342`, epoch `:349-356`, date `:357-369`, numeric `:370`, categorical `:391` and text `:393`;
    - the descriptor datetime override `:427-441`, and invalid-example keys `epoch:{unit}` and `date:{order}` at `:134-135` and `:296-321`.
- **Pass 2:** `src/features/data/ingestion/pipeline.ts`: an exhaustive `switch (elected.type)` with no default at `:230-285`; the stats skeleton at `:264-277`; `coerceCell` at `:490`; and temporal count, min and max at `:500-503`. Limits are in `src/features/data/ingestion/limits.ts:17,20,23`.
- **Eligibility guards** test the literal `'datetime'`:
    - `src/features/models/feature-eligibility.ts:98-107` returns `UNSUPPORTED`;
    - `src/features/target/target-eligibility.ts:121-129` returns `INELIGIBLE_DATETIME`;
    - `src/common/storage/indexeddb-dataset-provider.ts:223-227` and `:288-292` throw `UNSUPPORTED_COLUMN`.

    `model-catalogue.ts:87-92` already returns `[]` for any type other than categorical or boolean. `app.store.ts` and `reconciler.ts` use the `isModelEligibleColumnType` allow-list.

- **Persisted state:** `src/common/storage/training-domain.ts:28-34` `VALID_COLUMN_TYPES`, checked at `:206` for each `dataset.columns[].type`; `tests/reconciler-indexeddb.test.ts:613-619` keeps its own copy, used at `:729-738`. `src/stores/app.store.ts:191-221` resets the target and models when any column's `name` or `type` differs between the current and incoming `DatasetSummary`. This is why D9 avoids migration.
- **UI:**
    - `app-data-view.ts:54-77` `formatPreviewRows(records, columns: readonly ColumnStats[])`, called at `:634-635` with `metadata.columns`;
    - `app-column-details.ts:450-468` `renderDatetimeStats`, with fallback labels `'Earliest (UTC)'` and `'Latest (UTC)'`; `:512` shows the raw `col.type`; dispatch is at `:529`. Its `labels` are never bound by `app-data-view.ts:664-668`, so the fallbacks render;
    - `src/features/shell/app-sidebar.ts:33-37` maps types to labels (`datetime: 'Date/time'`);
    - `app-target-view.ts:443` and `app-model-builder-view.ts:1000-1007` capitalise `row.type` (`Datetime`);
    - the story is `src/features/data/app-column-details.stories.ts:93-105` (`DateAndTime`);
    - the Help text is `content/en/pages/help.md:20` ("Date and time").
- **Samples:** only `content/datasets/compas-recidivism/descriptor.ts` uses `dataType: 'datetime'`, on 14 columns (lines 265, 280, 359, 367, 381, 389, 459, 473, 480, 520, 557, 585, 592 and 599). The cached profile, keyed by CSV SHA-256 `c451db85…`, records `hasTime: true` only for `c_jail_in` and `c_jail_out` (for example `2013-08-13 06:03:42`). The other 12 are date-only ISO (`2013-08-14`). `scripts/generate-datasets.ts:217-227` requires `dataType` to equal the elected type, except text overrides and categorical over numeric or boolean. `:275-276` rejects datetime targets. The profile cache key hashes `profiler.ts`, `cells.ts` and `limits.ts` (`:25-29`, `:148-152`), so T2 and T3 invalidate it automatically.
- **Tests and commands:**
    - `tests/cells.test.ts`: `describe('cell detectors')`, epoch at `:58`, header gate at `:105`, coercion at `:132`;
    - `tests/profiler.test.ts`: `describe('DatasetProfiler')`, date order at `:34`;
    - `tests/ingestion-pipeline.test.ts`: datetime stats at `:58`, overrides at `:216`.

    No UI datetime-formatting or early-stop tests exist. Commands: `bun run check`, `bun test <path>`, `bun run lint`, `bun run build`, `bun run test:stories`, `bun run test:e2e [file]` and `bun run format <files>`. Baselines were not run during planning. `tests/data-preview.e2e.ts` `DATA-PRE-2` is a known Chromium failure (`tests/known-failures.ts`).

- **Web guidance:** `capture-location-agnostic-data` (cited by the archived plan): a date-only value stored at UTC midnight must be formatted from UTC fields, or zones west of UTC show the previous day. D7 formats from `toISOString()` substrings for this reason. No new platform API is used.
- **Visual reference:** None. No ready or implemented mockup shows column-type text or temporal cells. `specification/mockups/01-6_virtual-table.html` is a draft. Only text content changes, and no styles do.
- **Domain skills:** `lit-component-implementer` for T1 and T4 (Lit view, label and story changes). `lit-architecture-planner` was applied: no element, tier, event, state placement or style changes; the existing elements' public APIs are unchanged (D8).
- **Assumptions requiring verification:** None.

## Technical decisions

| Decision                                                    | Chosen approach and rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Rejected alternative / trade-off                                                                                                                                                                                                                      |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 Vocabulary                                               | `ColumnType = 'numeric' \| 'categorical' \| 'boolean' \| 'date' \| 'time' \| 'datetime' \| 'text'`. Plus `TEMPORAL_COLUMN_TYPES = ['date', 'time', 'datetime'] as const`, `TemporalColumnType` and `isTemporalColumnType(type): type is TemporalColumnType` in `src/types/state.ts`. Every literal `'datetime'` eligibility check uses the predicate.                                                                                                                                                     | A single `temporal` type with a `kind` statistic: the user wants the type itself to carry the distinction, and the UI shows types directly.                                                                                                           |
| D2 Date-only cells                                          | A `parseDate` match is **date-only** when `hasTime` is false, or when `h`, `mi`, `s` and `ms` are all 0 and `offsetMin` is `null` or `0`. So `2013-08-14`, `2013-08-14 00:00:00` and `2013-08-14T00:00:00Z` are date-only. `2013-08-14T00:00:00+01:00` is not, because it is a different UTC instant.                                                                                                                                                                                                     | Treating any written time as a datetime: Excel and pandas exports write `00:00:00` on every date and would never elect `date`.                                                                                                                        |
| D3 Election inside date strings (user decision, 2026-11-25) | The most specific type with ≥ 98 % coverage, applied in order. `date` if date-only cells valid under the chosen order are ≥ 98 % of `V`. Otherwise `datetime` if all date-string cells valid under that order are ≥ 98 %. Under `date`, cells with a real time of day are **invalid**: stored `null`, counted in `invalidCount` and shown in `invalidExamples`.                                                                                                                                           | Truncating times to the date (keeps more data but adds a silent coercion), or promoting to `datetime` whenever any time appears (one stray time changes the whole column's display).                                                                  |
| D4 Time of day                                              | `time` if `parseTime` matches ≥ 98 % of `V`. 24-hour only: `^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?$`, with `h` 0–23 and `mi`, `s` 0–59. The fraction is cut to three digits and padded on the right. The value is stored as ms since midnight. No zone suffix and no AM/PM (user decision, 2026-11-25). Dates and times are never combined in one column.                                                                                                                                        | 12-hour clocks (FUTURE.md already defers them), or a mixed date-and-time column (it has no single meaning).                                                                                                                                           |
| D5 Epoch detection (user decision, 2026-11-25)              | **Ungated**: any column may elect `datetime` with an epoch format. `headerSuggestsTime` and its call sites are removed. The unit comes from the digit count: 9–10 → `s`, 12–13 → `ms`, 15–16 → `us` (pattern `^[1-9](?:\d{8,9}\|\d{11,12}\|\d{14,15})$`). The existing window `315_532_800_000 ≤ ms < 2_524_608_000_000` still applies. The digit ranges do not overlap, so the unit is unambiguous across the whole window.                                                                              | Keeping the header gate (the archived plan's R11): fewer false positives, but a timestamp column with a neutral header (`value`, `t0`) stays numeric. The user accepted the false-positive risk (see _Risks_) and asked for user control later (D10). |
| D6 Epoch safeguard                                          | Epoch election is skipped when the column's integers are strictly increasing by 1, using the existing tracked identifier-sequence flag. The column then falls through to `numeric` with its identifier hint.                                                                                                                                                                                                                                                                                              | No safeguard: an auto-increment id starting at 1,000,000,000 would become a datetime. The check costs nothing, because the flag is already tracked.                                                                                                   |
| D7 Precision and formatting                                 | Pass 2 computes `precision` for `time` and `datetime` from coerced values: `'millisecond'` if any `v % 1000 !== 0`, else `'second'` if any `v % 60_000 !== 0`, else `'minute'`. One pure module, `src/features/data/temporal-format.ts`, formats values. `date` gives `YYYY-MM-DD`. `time` gives `HH:MM`, `HH:MM:SS` or `HH:MM:SS.sss`. `datetime` gives `YYYY-MM-DDTHH:MMZ`, `…:SSZ` or the full `toISOString()`; legacy metadata without `precision` gets the full string.                              | Precision from syntax (whether seconds were written): `10:30:00` would then show `:00` for no information. `Intl.DateTimeFormat`: locale-dependent output, and it adds zone handling for no gain.                                                     |
| D8 Component APIs                                           | `app-column-details` keeps its public API, including `ColumnDetailsLabels`. Its `column` property accepts the two new `ColumnStats` members. Date and time columns reuse `labels.earliest` and `labels.latest`, with fallbacks `'Earliest'` and `'Latest'`. Datetime keeps `'Earliest (UTC)'` and `'Latest (UTC)'`. `app-sidebar` adds `date: 'Date'` and `time: 'Time'`, and `datetime` stays `'Date/time'`. The target and model-builder views keep capitalising the type (`Date`, `Time`, `Datetime`). | New label keys: no caller binds `labels` today, so new keys would be unused API.                                                                                                                                                                      |
| D9 Stored datasets (user decision, 2026-11-25)              | No migration. Legacy `datetime` stats (with `format.hasTime`, without `precision`) remain valid and render with full ISO strings. Loading the dataset again re-infers its types.                                                                                                                                                                                                                                                                                                                          | An IndexedDB v3 upgrade that rewrites metadata. It must also rewrite the persisted summary consistently, or `reduceDatasetReplacement` resets the target and models (`app.store.ts:191-221`).                                                         |
| D10 Future user control                                     | FUTURE.md records two items. Letting the user change a column's elected temporal type, for example keeping times in a mostly-date column. Letting the user mark an integer column as a timestamp, or not, overriding ungated epoch detection.                                                                                                                                                                                                                                                             | Building overrides now: outside the requested scope, and it needs a UX design.                                                                                                                                                                        |
| D11 Early-stop latches                                      | `datetimeActive` keeps latching date-string counting. New `epochActive` and `timeActive` latches use the same checkpoint rule: at row 1,000 and every 50,000th row, switch off when non-matches exceed 2 % of `V`. `checkDatetimeCheckpoint` is generalised to all three.                                                                                                                                                                                                                                 | Counting epochs and times on every row of every column: correct but wasteful now that epoch checks are ungated.                                                                                                                                       |
| D12 Descriptor overrides                                    | A sample descriptor may set `dataType` to `date`, `time` or `datetime` only when the generator elects that same type (the existing equality rule). At runtime, an override to a temporal type derives its format from the counters, as the existing datetime branch does (`profiler.ts:427-441`). `date` uses date-only counts, `time` time counts, and `datetime` epoch or all-date counts.                                                                                                              | Letting descriptors convert `date` ↔ `datetime`: not needed; COMPAS's elected types are correct.                                                                                                                                                      |

### Interfaces and behaviour

**`src/types/state.ts`**

```ts
export type ColumnType =
	| 'numeric'
	| 'categorical'
	| 'boolean'
	| 'date'
	| 'time'
	| 'datetime'
	| 'text';
export const TEMPORAL_COLUMN_TYPES = [
	'date',
	'time',
	'datetime'
] as const satisfies readonly ColumnType[];
export type TemporalColumnType = (typeof TEMPORAL_COLUMN_TYPES)[number];
export function isTemporalColumnType(type: ColumnType): type is TemporalColumnType;
```

`MODEL_ELIGIBLE_COLUMN_TYPES` is unchanged.

**`src/types/dataset.ts`**

```ts
/** Finest non-zero unit in a column's stored values. */
export type TimePrecision = 'minute' | 'second' | 'millisecond';
/** Date-string format shared by date and datetime columns. */
export interface DateStringFormat {
	kind: 'date';
	order: 'ISO' | 'DMY' | 'MDY';
	orderAssumed: boolean;
}
export interface DateColumnStats extends BaseColumnStats {
	type: 'date';
	count: number;
	min: number; // epoch ms, UTC midnight
	max: number;
	format: DateStringFormat;
}
export interface TimeColumnStats extends BaseColumnStats {
	type: 'time';
	count: number;
	min: number; // ms since midnight
	max: number;
	precision: TimePrecision;
}
export interface DatetimeColumnStats extends BaseColumnStats {
	type: 'datetime';
	count: number;
	min: number;
	max: number;
	/** Absent only on metadata stored before this type existed. */
	precision?: TimePrecision;
	format:
		| { kind: 'epoch'; unit: 's' | 'ms' | 'us' }
		| (DateStringFormat & {
				/** @deprecated Legacy stored metadata only; never written. */
				hasTime?: boolean;
		  });
}
```

`ColumnStats` adds `DateColumnStats | TimeColumnStats`. `CellFormat` adds `DateColumnStats['format']`; `time` takes no format. The min, max and count rules for an empty column are the same as the existing datetime skeleton (`pipeline.ts:264-277`).

**Cell detectors (`src/common/storage/cells.ts`)**

- `EPOCH_PATTERN` becomes `^[1-9](?:\d{8,9}|\d{11,12}|\d{14,15})$`. `parseEpoch` takes the unit from the length (9–10 `s`, 12–13 `ms`, 15–16 `us`) and keeps the existing conversion and window.
- `isDateOnly(parts: DateParts): boolean` follows D2.
- `parseTime(cell: string): number | null` follows D4. It returns ms since midnight; any bound failure returns `null`.
- `coerceCell` handles these temporal types:
    - **`'date'`:** `parseDate`, then `isDateOnly`, then `toEpochMs(parts, format.order)`. Any failure returns `null`. With no format, the order is `'ISO'`, so year-last numeric cells are `null`.
    - **`'time'`:** returns `parseTime`.
    - **`'datetime'`:** unchanged.
- `headerSuggestsTime` is deleted, together with its tests.

**Profiler counters and election (`src/common/storage/profiler.ts`)**

Counters per column:

- `epochCounts` is now counted for every column while `epochActive` is on.
- `dateOrderCounts` keeps counting every date-string cell valid under each order.
- A new `dateOnlyOrderCounts` counts the same, restricted to `isDateOnly` cells.
- `timeMatches` counts while `timeActive` is on.
- `dateMatches` (unused) and `dateHasTime` are removed.

Invalid-example keys are `epoch:{unit}`, `date:{order}`, `date-only:{order}` and `time`. Each key collects up to five distinct cells that fail that interpretation. For `date-only:{order}`, this includes cells that have a real time of day.

Election when `V > 0`, after boolean:

1. **Epoch:** applies while `epochActive` is on and the identifier-sequence flag is false. Take the dominant unit `u`, breaking ties in the order `s`, `ms`, `us`. If `epochCounts[u] / V ≥ 0.98`, elect `datetime` with format `{ kind: 'epoch', unit: u }`.
2. **Date strings:** applies while `datetimeActive` is on, with `order = chooseDateOrder(...)` (unchanged).
    - If `dateOnlyOrderCounts[order] / V ≥ 0.98`, elect `date` with `{ kind: 'date', order, orderAssumed }`. Invalid examples come from `date-only:{order}`.
    - Otherwise, if `dateOrderCounts[order] / V ≥ 0.98`, elect `datetime` with the same format and examples from `date:{order}`.
3. **Time:** if `timeActive` is on and `timeMatches / V ≥ 0.98`, elect `time`.
4. Numeric, categorical and text are unchanged.

`invalidCount` is `V` minus the elected interpretation's match count.

**Worked examples** (each line becomes a profiler test case):

| Column values (non-missing)                                                   | Elected                            | Invalid                   |
| ----------------------------------------------------------------------------- | ---------------------------------- | ------------------------- |
| 100 × `2013-08-14`                                                            | `date`                             | 0                         |
| 100 × `2013-08-14 00:00:00`                                                   | `date`                             | 0                         |
| 99 × `2013-08-14`, 1 × `2013-08-13 06:03:42`                                  | `date`                             | 1 (the time-bearing cell) |
| 99 × `2013-08-14`, 1 × `banana`                                               | `date`                             | 1                         |
| 97 × `2013-08-14`, 3 × `2013-08-13 06:03:42`                                  | `datetime` (date format)           | 0                         |
| 95 × `2013-08-14`, 5 × `banana`                                               | not temporal (categorical or text) | —                         |
| 100 × `09:30` / `17:45:10` mix                                                | `time`                             | 0                         |
| 50 × `2013-08-14`, 50 × `09:30`                                               | not temporal                       | —                         |
| header `value`: `999999999`, `1000000000`, … (9 and 10 digits, spanning 2001) | `datetime` (epoch `s`)             | 0                         |
| `1000000000`, `1000000001`, … strictly +1                                     | `numeric`, identifier hint         | —                         |
| 11-digit integers                                                             | `numeric`                          | —                         |

**Pass 2 (`src/features/data/ingestion/pipeline.ts`)**

The `switch` gains `date` and `time` skeletons. Count, min and max are computed for all three temporal types. `time` and `datetime` also track two booleans, one for any non-zero millisecond and one for any non-zero second remainder. These give `precision` (D7); a column with no valid values gets `'minute'`.

**Formatter (`src/features/data/temporal-format.ts`, new, no DOM)**

```ts
export function formatTemporalValue(
	value: number,
	column: DateColumnStats | TimeColumnStats | DatetimeColumnStats
): string;
```

Behaviour follows D7. A time is built from `Math.floor` of hours, minutes, seconds and milliseconds, zero-padded to 2, 2, 2 and 3 digits. Examples:

- `Date.UTC(2013, 7, 14)` as a date gives `2013-08-14`;
- `34_200_000` as a `'minute'` time gives `09:30`;
- `Date.UTC(2013, 7, 13, 6, 3, 42)` as a `'second'` datetime gives `2013-08-13T06:03:42Z`;
- a legacy datetime without `precision` gives `toISOString()`.

**UI**

- `formatPreviewRows` formats a numeric value with `formatTemporalValue` when `isTemporalColumnType(col.type)`.
- `app-column-details` renders earliest and latest for all three temporal types through the formatter, with the labels from D8.
- The type tag (`:512`) keeps showing the raw type (`date`, `time`, `datetime`).

## Specification changes

- [ ] `specification/data-ingestion.md` §3:
    - the temporal statistics are `date`, `time` and `datetime` with their stored units;
    - `precision` is computed for `time` and `datetime`;
    - legacy `datetime` metadata may lack `precision`.

    §5 states:
    - the D2 date-only rule and the D3 election order with the 98 % rule;
    - the D4 time pattern and bounds;
    - ungated, magnitude-based epoch detection (D5) and the identifier safeguard (D6);
    - the three checkpoint latches (D11) and temporal descriptor overrides (D12).

    The header-gate text is removed. Status stays `implemented`.

- [ ] `specification/state-and-storage.md` §3 (`ColumnType` code block) and §10 #4: the canonical union includes `date`, `time` and `datetime`. Temporal subtype is a type, while date order, epoch unit and precision are statistics.
- [ ] `specification/sample-datasets.md:24` and `specification/preview-dataset.md:24-26`: list the seven types. Preview statistics give earliest and latest values for each temporal type.
- [ ] `specification/workflow-steps.md:52,76,79,134,151` and `specification/app-state-and-navigation.md:300-301`:
    - Type codes include `Date` and `Time`;
    - `date`, `time` and `datetime` are ineligible as targets (`INELIGIBLE_DATETIME`, "Date and time columns cannot be targets.") and as features;
    - earliest and latest values show at the column's precision, with UTC stated only for datetime.
- [ ] `specification/components/sidepanel.md` §2 `column` row, §3 temporal bullet and definition coverage: seven discriminants; date and time display without "UTC"; inspector stories cover all seven types.
- [ ] `specification/FUTURE.md:19`: datetime feature engineering covers `date`, `time` and `datetime` columns. Add two items: user control over a column's temporal type, and user control over epoch-timestamp detection (D10). Also add 12-hour clocks for time-only columns and nanosecond epochs as further formats.

## Implementation tasks

### T1 — Temporal vocabulary, predicate and consumers

- **Depends on:** None
- **Risk:** needs care — the union change and the persisted-state validator must land together, or the app resets saved state (Constraints).
- **Likely files:** `src/types/state.ts`, `src/types/dataset.ts`, `src/common/storage/training-domain.ts`, `src/features/models/feature-eligibility.ts`, `src/features/target/target-eligibility.ts`, `src/common/storage/indexeddb-dataset-provider.ts`, `src/features/shell/app-sidebar.ts`, `src/features/data/ingestion/pipeline.ts`, `src/features/data/app-column-details.ts`, `src/features/data/app-column-details.stories.ts`, `src/common/storage/cells.ts`, `src/common/storage/profiler.ts`, `tests/reconciler-indexeddb.test.ts`, `tests/*eligibility*.test.ts`, `tests/*provider*.test.ts`
- **Must not touch:** `src/common/storage/db.ts` — no IndexedDB version change (D9); `src/stores/persister.ts` — `STORAGE_VERSION` stays 1.
- **Implementation:**
    - Add the D1 types, constant and predicate, and the `dataset.ts` interfaces exactly as in _Interfaces_. `DatetimeColumnStats.format` keeps an optional deprecated `hasTime`.
    - Replace the literal `'datetime'` checks in feature eligibility, target eligibility and both provider guards with `isTemporalColumnType`. Target eligibility emits `INELIGIBLE_DATETIME` for all three.
    - Add `'date'` and `'time'` to `VALID_COLUMN_TYPES` and to the test copy.
    - Add the sidebar labels (D8).
    - Add `date` and `time` cases to the `pipeline.ts` switch, so that it type-checks.
    - Keep the profiler and cells compiling: stop writing `hasTime` and leave `precision` unset, since it is optional until T3 computes it. The profiler does not yet elect `date` or `time`.
    - Update the `DateAndTime` story's `format` literal so it type-checks without `hasTime`.
- **Acceptance criteria:**
    - [ ] TEMP-AC-1: `isTemporalColumnType` is true for `date`, `time` and `datetime`, and false for the other four types (unit test).
    - [ ] TEMP-AC-2: feature and target eligibility mark `date` and `time` columns ineligible with the same codes as `datetime` (`UNSUPPORTED`; `INELIGIBLE_DATETIME`). The provider throws `UNSUPPORTED_COLUMN` for a `date` feature and a `time` target.
    - [ ] TEMP-AC-3: persisted state whose `dataset.columns` contains `date`, `time` and legacy `datetime` types validates. An unknown type still invalidates it.
- **Verification:** `bun run check`, `bun run lint`, `bun run format <changed files>`
- **Progress:** [ ] Not started

### T2 — Cell detectors: epoch magnitudes, time of day, date-only

- **Depends on:** T1
- **Risk:** routine
- **Likely files:** `src/common/storage/cells.ts`, `tests/cells.test.ts`
- **Must not touch:** `src/common/storage/profiler.ts` — T3 owns election and removes the header-gate call sites.
- **Implementation:** Make the _Interfaces_ → "Cell detectors" changes: `EPOCH_PATTERN`, `parseEpoch` units, `isDateOnly`, `parseTime` and the `coerceCell` `date` and `time` branches. Export the new functions with TSDoc. Keep `headerSuggestsTime` exported until T3 removes its last caller.
- **Acceptance criteria:**
    - [ ] TEMP-AC-4: `parseEpoch` gives:
        - `315532800` → `s`, ms `315_532_800_000`;
        - `999999999` → `s`;
        - `2524607999` → `s`;
        - `315532800000` and `1700000000000` → `ms`;
        - `315532800000000` and `1700000000000000` → `us`, ms `1_700_000_000_000`;
        - `315532799`, `2524608000`, `99999999999` (11 digits), `99999999999999` (14 digits), `0315532800` and `1700000000.5` → `null`.
    - [ ] TEMP-AC-5: `parseTime` gives:
        - `9:05` → `32_700_000`;
        - `09:05:07` → `32_707_000`;
        - `23:59:59.9999` → `86_399_999`;
        - `00:00` → `0`;
        - `24:00`, `12:60`, `12:30:60`, `12:30Z`, `12:30 PM`, `1:2`, `123:00`, `12` and `2024-01-15` → `null`.
    - [ ] TEMP-AC-6: `isDateOnly` is true for the parts of `2024-01-15`, `2024-01-15 00:00:00` and `2024-01-15T00:00:00Z`. It is false for `2024-01-15T00:00:00+01:00` and `2024-01-15 00:00:01`.
    - [ ] TEMP-AC-7: `coerceCell` with `'date'` and ISO order gives:
        - `2013-08-13 00:00:00` → `Date.UTC(2013, 7, 13)`;
        - `2013-08-13 06:03:42` → `null`;
        - `14/08/2013` with order `DMY` → `Date.UTC(2013, 7, 14)`.

        `coerceCell` with `'time'` gives `17:45:10` → `63_910_000`.

- **Verification:** `bun test tests/cells.test.ts`, `bun run check`, `bun run lint`, `bun run format <changed files>`
- **Progress:** [ ] Not started

### T3 — Profiler election and Pass-2 statistics

- **Depends on:** T2
- **Risk:** needs care — election order and invalid counting decide every uploaded column's type.
- **Likely files:** `src/common/storage/profiler.ts`, `src/common/storage/cells.ts`, `src/features/data/ingestion/pipeline.ts`, `tests/profiler.test.ts`, `tests/ingestion-pipeline.test.ts`, `tests/cells.test.ts`
- **Must not touch:** `src/features/data/ingestion/limits.ts` — thresholds and checkpoints are unchanged.
- **Implementation:**
    - Make the _Interfaces_ → "Profiler counters and election" and "Pass 2" changes, D11 and D12.
    - Remove the header-gated epoch path, then delete `headerSuggestsTime` and its tests.
    - Compute `precision` in Pass 2, replacing T1's placeholder.
- **Acceptance criteria:**
    - [ ] TEMP-AC-8: every row of the _Worked examples_ table holds as a `tests/profiler.test.ts` case, including `invalidCount`. For the 99/1 time-bearing case, `invalidExamples` contains `2013-08-13 06:03:42`.
    - [ ] TEMP-AC-9: a DMY-forced year-last column with only date-only values elects `date` with `order: 'DMY'`. The same values with one `14/08/2013 10:00` per 20 cells elect `datetime`.
    - [ ] TEMP-AC-10: a column whose first 1,000 rows are more than 2 % non-time switches `timeActive` off and does not elect `time`, even if later rows are all times. The same holds for `epochActive`.
    - [ ] TEMP-AC-11: in pipeline tests:
        - a `date` column stores UTC-midnight epoch ms, with min and max correct and the time-bearing cell stored `null`;
        - a `time` column of `09:00` and `17:30` has `precision: 'minute'` and min `32_400_000`;
        - a datetime column with seconds gets `'second'`;
        - an epoch-`ms` column with non-zero milliseconds gets `'millisecond'`.
    - [ ] TEMP-AC-12: a descriptor override to `date` on a date-only column produces `DateColumnStats` with the counters' order. Existing override tests still pass.
- **Verification:** `bun test tests/profiler.test.ts`, `bun test tests/ingestion-pipeline.test.ts`, `bun run check`, `bun run lint`, `bun run format <changed files>`
- **Progress:** [ ] Not started

### T4 — Temporal display in the preview table and column inspector

- **Depends on:** T1
- **Risk:** routine
- **Likely files:** `src/features/data/temporal-format.ts`, `src/features/data/app-data-view.ts`, `src/features/data/app-column-details.ts`, `src/features/data/app-column-details.stories.ts`, `tests/temporal-format.test.ts`, `tests/data-upload.e2e.ts`
- **Must not touch:** `css/`, `src/styles/`, `specification/mockups/` — text-only change; no styles.
- **Implementation:**
    - Add the formatter (D7), then use it in `formatPreviewRows` and in a generalised `renderTemporalStats` that replaces `renderDatetimeStats`. Dispatch it for every temporal type, with D8 labels.
    - Replace the `DateAndTime` story with a `Datetime` story (`precision: 'second'`, ISO date format), and add `Date` and `Time` stories. Keep the existing Long-label and RTL stories working with a temporal column.
    - Follow `lit-component-implementer`.
- **Acceptance criteria:**
    - [ ] TEMP-AC-13: `formatTemporalValue` returns the four _Interfaces_ examples. It also gives `'millisecond'` time `86_399_999` → `23:59:59.999` and a `'minute'` datetime → `2013-08-13T06:03Z`. The module uses only `toISOString()` and integer arithmetic, never local-time `Date` getters or `Intl`, so its output does not depend on the zone (checked by code review against this criterion).
    - [ ] TEMP-AC-14 (Playwright, new test in `tests/data-upload.e2e.ts`): upload an inline CSV through the existing `setInputFiles({ name, mimeType: 'text/csv', buffer })` pattern (`tests/data-upload.e2e.ts:117-137`). The CSV has 10 rows of `date`, `time` and `datetime` columns plus a categorical label. After the upload:
        - the preview shows `2013-08-14`, `09:30` and `2013-08-13T06:03:42Z`;
        - the inspector for the date column shows "Earliest" and "Latest" (no "UTC") with `YYYY-MM-DD` values;
        - the datetime column keeps "Earliest (UTC)".
    - [ ] TEMP-AC-15: `bun run test:stories` passes smoke and axe checks for the `Date`, `Time` and `Datetime` stories in Chromium, Firefox and WebKit.
- **Verification:** `bun test tests/temporal-format.test.ts`, `bun run check`, `bun run test:stories`, `bun run test:e2e tests/data-upload.e2e.ts`, `bun run lint`, `bun run format <changed files>`. The existing `DATA-UP-2` failure is listed in `tests/known-failures.ts` and is not a regression.
- **Progress:** [ ] Not started

### T5 — Sample datasets and generator guards

- **Depends on:** T3
- **Risk:** needs care — ungated epoch detection may re-type a column in another sample.
- **Likely files:** `content/datasets/compas-recidivism/descriptor.ts`, `scripts/generate-datasets.ts`, `tests/*generate-datasets*.test.ts`
- **Must not touch:** `content/datasets/*/data.csv` — curated sources; `content/datasets/*/datasheet.md` — no prose change is needed.
- **Implementation:**
    - In the generator, reject a target whose type is temporal (`isTemporalColumnType`), and extend the `implicitMissingValues` rejection from `datetime` to all temporal types.
    - Set `dataType: 'date'` on the 12 date-only COMPAS columns. `c_jail_in` and `c_jail_out` stay `'datetime'`.
    - Run `bun run build`. If it reports any other descriptor mismatch, **stop and escalate** with the column, its old and new types and three sample values. Do not edit that descriptor. A numeric column that turns into `datetime` is the D5 risk materialising.
- **Acceptance criteria:**
    - [ ] TEMP-AC-16: `bun run build` passes. In the generated COMPAS descriptor, 12 columns are `date` and 2 are `datetime`, and every other sample's column types are unchanged.
    - [ ] TEMP-AC-17: the generator rejects a temporal target candidate and `implicitMissingValues` on a `date` or `time` column (existing generator tests extended, or a focused new case).
- **Verification:** `bun run build`, `bun run check`, `bun run lint`, `bun run format <changed files>`
- **Progress:** [ ] Not started

### T6 — Sync specification and Help text

- **Depends on:** T3, T4, T5
- **Risk:** routine
- **Likely files:** `specification/data-ingestion.md`, `specification/state-and-storage.md`, `specification/sample-datasets.md`, `specification/preview-dataset.md`, `specification/workflow-steps.md`, `specification/app-state-and-navigation.md`, `specification/components/sidepanel.md`, `specification/FUTURE.md`, `specification/plans/temporal-column-types.md`, `specification/plans/README.md`, `content/en/pages/help.md`
- **Must not touch:** `specification/mockups/` — no visual change.
- **Implementation:**
    - Apply every _Specification changes_ item in present tense, per the `specification/README.md` writing rules.
    - Rewrite the Help sentence at `content/en/pages/help.md:20` to define a date column (calendar dates), a time column (times of day) and a date and time column (a moment, shown in UTC). Keep the "Date and time" heading term.
- **Acceptance criteria:**
    - [ ] TEMP-AC-18: no specification still lists the five-type union or says epoch detection needs a time-like header. `bun run plans:check` passes.
- **Verification:** `bun run plans:check`, `bun run build`, `bun run format <changed files>`
- **Progress:** [ ] Not started

## Verification and definition of done

- [ ] All task acceptance criteria met.
- [ ] Relevant verification commands from `AGENTS.md` pass with no new failures.
- [ ] Type-check, lint, formatting, and build checks pass.
- [ ] Accessibility (WCAG 2.2 AA), privacy/security, and contract-compatibility checks completed where applicable.
- [ ] Every item under _Specification changes_ is ticked, and specifications match the implemented code.
- [ ] No unintended changes outside the tasks' likely files.

## Risks and open questions

- **Blocking:** None
- **Non-blocking:**
    - **Ungated epochs (D5) misread integer columns.** Any integer column whose values are 98 % within 315,532,800–2,524,607,999 (or the ms/µs equivalents) becomes `datetime` and therefore model-ineligible: US phone numbers (`2125551234` → 2037), 9–10-digit account numbers, pence amounts. The user accepted this on 2026-11-25. Mitigations: D6 catches sequential ids; T5 escalates if a sample re-types; FUTURE.md records a user override (D10). Owner: maintainer.
    - **Mostly-date columns lose a few cells (D3).** Under `date`, up to 2 % of cells with a real time are `null`. They are visible as invalid count and examples, and the FUTURE.md override (D10) is the remedy.
    - **`MM:SS` durations read as times.** A lap-time column whose minutes never exceed 23 elects `time`. Accepted: durations are out of scope.
    - **Stale stored datasets (D9).** Datasets ingested before this change keep `datetime` for date-only columns until reloaded. Reloading creates a new dataset id, which resets the target and models as any reload does today.
    - **Old builds in another tab** reject persisted state containing `date` or `time` (unknown type) and fall back to initial state. There is no service worker, so a reload picks up the new build. Accepted.
    - **Shared label key (D8).** If a future caller binds `labels.earliest` with "(UTC)" wording, date and time columns would inherit it. Add per-type keys then.

## Escalations

None.

## Review fixes

None.

## Implementation and verification log

| When (UTC) | Task | Agent (model) | Outcome / commands / evidence |
| ---------- | ---- | ------------- | ----------------------------- |
| —          | —    | —             | Not started                   |

## Plan review history

| Reviewed (UTC)       | Agent (model)                 | Decision          | Findings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------- | ----------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-25T11:31:22Z | Claude Code (claude-opus-5-5) | changes-requested | MAJOR: T3 cannot pass its own `bun run check` — tests/sample-datasets-content.test.ts:21-29 runs generateSampleDatasets over real content, and once T3 elects `date` for 12 COMPAS columns still authored `datetime`, scripts/generate-datasets.ts:217-221 reports a dataType mismatch until T5; move the COMPAS descriptor edits, the :276 temporal target guard and the stop-and-escalate rule into T3 (or merge T5 into T3). MINOR (fix in revision): T5 forbids touching content/datasets/compas-recidivism/datasheet.md, but its column table lists `datetime` for the 12 date-only columns, leaving user-visible datasheets wrong; T5 says to extend an implicitMissingValues datetime rejection that does not exist (generate-datasets.ts:229-239 already allows only numeric/categorical), so TEMP-AC-17 half-passes today; T4 says keep LongLabel/RTL stories working with a temporal column, but both are categorical (app-column-details.stories.ts:120,:129); spec list omits components/sidebar.md:43 (Date/time i18n list) and TODO.md:20,28,30; Worked-examples epoch fixture `999999999, 1000000000, …` reads as +1 consecutive and would hit D6 (numericSequence, profiler.ts:558-571) — state non-consecutive values; D6 also turns 1 Hz epoch-second logs into numeric, unrecorded in Risks. Verified OK: D1-D12 contracts, DateParts fields, parseDate patterns, checkpoint semantics, VALID_COLUMN_TYPES, eligibility guards, web-ml 0.2.0 feature kinds, no other sample has epoch- or time-like columns. |

## Change log

| When (UTC)           | Change        | Reason                                                                                                                              |
| -------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-25T10:49:58Z | Initial draft | User request: split `datetime` into `date`, `time` and `datetime`; widen epoch support. Decisions D3, D4, D5, D9 from user answers. |
