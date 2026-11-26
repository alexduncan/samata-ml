# Virtual table improvements: document scrolling, typed columns and in-page loading

**Status:** draft | **Updated:** 2026-11-26T10:53:58Z
**Authors:** Claude Code (claude-opus-5-5) | **Created:** 2026-11-26T10:41:08Z
**Verified by:** — | **Verified:** — | **Verification:** changes-requested
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour:** `src/components/ui-virtual-table.ts` scrolls inside its own `.table-viewport` (`overflow: auto`, `role="region"`, `tabindex="0"`, lines 70-78) over a segmented rail of 10,000 rows (`SEGMENT_SIZE`, line 43) with top/bottom spacers sized through `ref()` and `element.style.blockSize` (489-526). It renders rows with a Lit `html` map (497-519), overscans 5 rows, uses a 40px (2.5rem) re-measured row height, fixed 12rem columns and only `table-cell`/`placeholder-cell` classes. Header buttons show the raw column name. `src/features/data/app-dataset-preview.ts` renders a `.status-box` (358-381: error alert + Retry, "Loading rows…" status, "No rows to preview.") and a `section.controls-bar` (383-427: Previous/Next segment, Go to row, segment info) and a header with "Preview Dataset: {name}" and one default-style **Change Dataset** button. The table's offset is persisted as `regions['data-table']` (`app-data-view.ts:469-477`, restored by `restoreTableScroll` 209-218). Sample **Load Dataset** (`app-dataset-card.ts:105-106` → `app-data-view.ts:420-422` → `startDatasetLoad`, `src/stores/dataset.store.ts:326`) keeps the selection view until publication with no progress or error UI; sample errors only render inside the upload dialog. Uploads stay in `app-upload-dataset-dialog` until publication acknowledgement (`app-data-view.ts:399-407`) and the dialog bar likely jumps to full because `csv-stream.ts:67` never advances `bytesProcessed` during parsing. Descriptor `displayName` (`src/types/sample-dataset.ts:35-45`) is never shown. The Datasheet dialog is rendered only in selection mode (`app-data-view.ts:619-627`). `css/base.css:7-13` gives `<main>` `overflow-y: scroll`, making it the sticky scrollport despite navigation §8.1.

**Target behaviour:** The document scrolls the preview on both axes. The table body is a single rail whose block size is rows × measured row height; a recycled pool of absolutely positioned rows is moved with `transform: translateY()` from a `requestAnimationFrame` update decoupled from a passive `window` scroll listener, with one screen of overscan above and below. Columns get content-based widths from column statistics, type classes that set alignment, display names for sample datasets and a non-colour **Not used for training** marker on model-ineligible columns. Datasets taller than the browser-safe rail show the first N rows with a notice. The preview header reads "{name} Preview", offers **Datasheet** (samples only) and a red **Change Dataset**, and the column panel title shows the display name above the column name. **Load Dataset** switches straight to the preview with a labelled `<progress>` in main; uploads first validate the whole file in the Upload modal (pass 1, no writes), then close it and write to IndexedDB under the in-page progress bar (pass 2). Loading errors return to the selection view with an alert notification. The document scroll snapshot gains an inline offset and the `data-table` region is retired.

**Why:** Implements the "Improve Virtualized Table" section of `specification/notes/ui-fixes.md` and the revised `specification/mockups/01-6_virtual-table.html` / `css/virtual-table.css` (commit `7a11581`), with the maintainer's 2026-11-26 decisions (D1-D8 below) resolving WCAG and browser-limit conflicts.

## Scope

**In scope**

- Ingestion: a validate-only worker pass (parse + profile + type election, no IndexedDB writes) and corrected byte/row progress reporting.
- Store: load stage and name in `DatasetLoadState`; two-pass upload orchestration; document `left` in `ScrollSnapshot`; removal of the `data-table` region writer.
- `ui-virtual-table` rewrite to document scrolling, rAF row recycling, row-limit cap, grid column tracks, typed cell classes, unsupported marker, display-name headers and a sticky offset custom property; Storybook stories.
- `.btn-red` button variant (style primitive).
- Preview header, Datasheet entry point, row-limit notice, error/empty notifications, column builder with widths, sticky-offset measurement, short-viewport unsticking, document width for horizontal scrolling, column panel display name.
- In-page loading view (samples and upload pass 2), focus handling, selection-view error notification, upload dialog two-pass behaviour.
- Visual parity entries for the promoted 01-6 mockup; updating the `01-8_table-loading.html` draft to the in-page loading structure; specification sync.

**Out of scope**

- Better date/time formatting, multiple-width presets and other `ui-fixes.md` open issues not listed above (e.g. "Format Dates & times better").
- A Cancel control during in-page loading (D5: none). Remote fetches stay non-abortable mid-stream.
- Sticky row headers, horizontal virtualisation, sorting/filtering.
- The `scroll-region-restoration.md` stub's merge/retry/cancellation work (it keeps the regions mechanism for the fold matrix).
- `.page-header` sticky behaviour on other routes and the modal scroll lock (other `ui-fixes.md` items).

**Constraints and invariants**

- CSP `style-src-attr 'none'` (`public/_headers` line 2, `tests/csp-and-console.e2e.ts:176-187`): geometry only through CSSOM (`element.style.transform`, `.blockSize`, `.setProperty`); no template `style` attributes, no `styleMap` (`BETA-ERR-2`).
- `ui-virtual-table` stays Tier 2: no stores, workers, IndexedDB or `src/i18n.ts`; consumer-formatted strings only; cell text via `textContent` (markup renders literally).
- Navigation §8.1: the document is the only scroll container on the preview route; no ancestor of the table may have `overflow` other than `visible`.
- Previous dataset, target and models stay untouched until a new dataset publishes (state-and-storage §6). A reload during ingestion or validation lands on `'select'`; loading state is never persisted.
- WCAG 2.2 AA (COMPONENTS §7): header accessible names come from visible DOM text (no `aria-label`, no `title`); unsupported status is never colour-only; progress is labelled; focus is never lost when views swap; reflow at 320 CSS px and 400% zoom.
- Tokens only from `css/root.css`; logical properties; motion inside `prefers-reduced-motion: no-preference`; British English strings.
- Sample ingestion contract, error codes and `INGESTION_PHASE_LABELS` (`src/features/data/ingestion/errors.ts:60-68`) are reused, not renamed.
- **Implementation precondition:** `specification/mockups/01-6_virtual-table.html` is `status="ready"` before T4 starts (D2). If not, the implementer stops at T4 and escalates.

## Required reading

- `specification/COMPONENTS.md` §3-§10 — for every Lit task (T3-T6).
- `specification/components/virtual-table.md` — current closed API being replaced (T4).
- `specification/components/button.md` §3, §5, §8 — variant contract (T3).
- `specification/preview-dataset.md` — whole file (T5, T6).
- `specification/app-state-and-navigation.md` §6.1 (lines 314-331), §8 (lines 424-490) — preview state, scroll snapshot rules (T2, T5, T6).
- `specification/workflow-steps.md` lines 40-70 — upload and preview behaviour (T6).
- `specification/visual-design.md` §1.1, §4, §5.3 — draft rules, translation rules, DATA-UI register (T4, T5, T7).
- `specification/mockups/01-6_virtual-table.html`, `specification/mockups/css/virtual-table.css`, `css/page.css` `.page-header`, `css/base.css` `main:has(.ui-virtual-table)`, `css/button.css` `.btn-red` — visual reference (T3-T5, T7).
- `specification/notes/ui-fixes.md` § Improve Virtualized Table — source request.

## Codebase context

Facts verified by `codebase-scout` (three passes, 2026-11-26), so downstream agents need not re-sweep the tree.

- **Relevant specifications:** `specification/components/virtual-table.md` (API 17-36, a11y 83-88, ACs 94-102); `specification/preview-dataset.md` 41-53 (segments, scroll/focus); `specification/app-state-and-navigation.md` 314-331 (§6.1), 424-490 (§8); `specification/workflow-steps.md` 49, 63 (phases, segments); `specification/data-ingestion.md` 71-74 (statistics; no progress contract).
- **Table:** `src/components/ui-virtual-table.ts` — exports `VirtualTableColumn` (7-12, `{key, label}`), `VirtualTableWindow` (15-19, `rows: readonly (readonly string[])[]`), `VirtualTableRange` (23), `VirtualTablePosition` (31); props 185-202; `scrollToRow` 385, `restoreScroll` 412, `focusColumn` 422; `onScrollTick` 302-337; styles 57-181 (header cell padding 0.5rem 1rem, row 2.5rem, cell `min-inline-size: 12rem`); header `button.header-btn[data-col-key]` 472-481; `aria-rowcount`/`aria-colcount` 468-469, `aria-rowindex` 471/502, `aria-busy` on placeholders 503; cell `title` 512.
- **Preview:** `src/features/data/app-dataset-preview.ts` — shadow DOM; local sticky `.page-header` (51-62, `inset-block-start: 0`, `z-index: 10`); `PreviewLabels` 17-29 with empty defaults 180-191 and literal template fallbacks ("Preview Dataset:" 348, "Change Dataset" 354, "Loading rows…" 371, segment strings 390-422); `focusHeading` 206-213; `restorePosition` 218-222; columns built at 315-327; status box 358-381; controls bar 383-427; `app-preview-retry` event. Imports only `headingFocusStyles`, `buttonStyles`.
- **Data view:** `src/features/data/app-data-view.ts` — `formatPreviewRows` 56-79 (null → '—', temporal → `formatTemporalValue`, numbers `$format.get().number(v, {useGrouping: true, maximumFractionDigits: 20})`, booleans 'true'/'false'); local `.visually-hidden` 146; `loadController` 177, 555-559; `restoreTableScroll` 209-218; `focusHeading` 304-316; `whenSettled` 321-334; upload handlers 399-413 (`handleUploadCancel` requires `ownedUpload`); sample load 420-422; `handleCardDatasheet` 424-432; region write 469-477; column select 479-489; selection mode 619-627 (Datasheet dialog); preview mode 641-724 (description from descriptor 657-661, `<app-dataset-preview>` 664-674 without `.labels`, Change Dataset confirm 682-722). `i18n('app-data-change-dataset', …)` at 41-53.
- **Column panel:** `src/features/data/app-column-details.ts` — `.column: ColumnStats | null` 211-212, `.description` 215-216, `.rowCount` 219-220; `<aside class="overlay" aria-label="Column details">` > `div.overlay-title` > `<h4>${col.name}</h4>` + close button (491-499).
- **Load state:** `$datasetLoad` (`src/stores/dataset.store.ts:80`), `DatasetLoadState {busy, progress, errorCode}` (38-41); `startDatasetLoad` 326-361 (busy guard 327); `cancelDatasetLoad` 370-374; `changeDataset` 309-318. `src/features/data/load-dataset.ts:17-39` → `client.ingest(source, {signal, onProgress})` → `publishDataset` (`training-service.ts:1428-1468`, `ack.ok`). `reduceDatasetReplacement` `src/stores/app.store.ts:195-219`; `data.mode = 'preview'` at `app.store.ts:214`. Loads are only reachable with no active dataset.
- **Ingestion:** worker `src/features/data/ingestion/storage.worker.ts:3`; handler `worker-handler.ts:76-138` (single active ingest → `BUSY` 91-98, `INGESTION_LOCK` 118-135, cancel 86-88); protocol `protocol.ts:8-27` (`ingest`, `cancel`, `getMetadata`, `getRows`, `deleteDatasetsExcept`; `progress`, `result`, `error`); client `storage-client.ts:81-87`, `send` 135-175. `runIngestion` `pipeline.ts:354`: size/quota 385-387; `onHeader` 409-423 (`MAX_COLUMNS` = 200, `limits.ts:5`; `csv-stream.ts:100-104`; sample `DESCRIPTOR_MISMATCH`); per-chunk `writeRawRows` (312, call 445) into `raw_records` (`src/common/storage/db.ts:25`); `EMPTY_FILE` 451, `NO_DATA_ROWS` 452-454; `profiler.elect()` 456; typing re-reads 5,000-row batches from IndexedDB and rewrites them (488-551, `totalRows` set 550); statistics 553-602. `IngestionProgress {phase, bytesProcessed, totalBytes, rowsProcessed, totalRows}` 53-59, throttled 100 ms (375); remote `totalBytes: null` (131-137). The profiler keeps no row arrays (bounded state; up to 1,000,000 median values).
- **Upload dialog:** `src/features/data/app-upload-dataset-dialog.ts` — .csv check 234-257, `<progress id="load-progress">` 279-307 (phase labels 280-283), error `p[role=alert]` 350, close/cancel 212-232.
- **Column stats:** `src/types/dataset.ts` 14-119 — numeric `min`/`max`/`mean`/`median`/`integer` (24-39); categorical `categoryCounts: Record<string, number>` (42-46, ≤500 tracked); boolean `lexicon` (49-54); date/time/datetime `min`/`max`/precision (57-102); text `distinctCount` (105-109); no string-length statistic. `ColumnType` and `isModelEligibleColumnType` (numeric, categorical, boolean) at `src/types/state.ts:16-23, 54-56`.
- **Scroll:** `ScrollSnapshot` `src/types/state.ts:415-421` (no `left`); `recordCurrentScroll` `src/router/scroll-restorer.ts:52-74`, restore 89-165; validation `validateScrollState` `src/stores/persister.ts:187-236`.
- **Shell:** `src/app.ts:261-262` renders light-DOM `<app-sidebar>` and `<main id="content">`; `<app-data-view>` is a light-DOM child of `main` (122). `css/base.css:7-13` `main { overflow-y: scroll; … }`.
- **Styles:** `src/styles/button.styles.ts` (`buttonStyles` line 7, `.btn-primary` 39; no `.btn-red`); `src/styles/notification.styles.ts` (`.notification`, `.notification-alert`, `.notification-text`; no `.notification-error`); no shared icon sprite — components inline a local `<symbol>` (e.g. `app-model-builder-view.ts:349-351`); no global `.visually-hidden`.
- **Tests and commands:** `tests/virtual-table.e2e.ts` (VTB-AC-1..6); `tests/data-preview.e2e.ts:16, 69, 196, 249`; `tests/data-flow.e2e.ts:21, 81, 131`; `tests/data-upload.e2e.ts:24, 83, 200, 232, 265`; `tests/app-shell.e2e.ts:640, 750, 921, 1042`; `tests/a11y.e2e.ts:179`; `tests/visual-parity/map.ts:577-608`; `tests/ingestion-pipeline.test.ts`, `tests/storage-client.test.ts`, `tests/state-and-storage.test.ts`, `tests/router-and-navigation.test.ts`, `tests/style-tokens.test.ts` (TOK-1 accepts custom properties declared in the same file and `--_` names). No Storybook story for the table or preview exists. Baseline not run during planning.
- **Web guidance:** `single-line-overflow` — full text stays in the DOM as the accessible name; "DO NOT rely on `title` alone"; touch/keyboard users need another route (the column panel). `progress` — native `<progress>` labelled with `aria-labelledby`, `value` omitted for indeterminate, completion announced through a polite status, never focus the bar. `responsive-table` — sticky header context; keep cell text on one line.
- **Visual reference:** `specification/mockups/01-6_virtual-table.html` (to be promoted, D2) — `css/virtual-table.css` `.table-header`, `.table-header-cell`, `.header-btn`, `.table-body`, `.table-row`, `.table-cell`, `.table-cell-num|-text|-boolean|-categorical`; `css/page.css` `.page-header`; `css/base.css` `main:has(.ui-virtual-table)`; `css/button.css` `.btn-red`. `01-8_table-loading.html` stays a draft. Deviations: DATA-UI-02 (revised), DATA-UI-04..07 (new, T7).
- **Domain skills:** `lit-component-implementer` for T3, T4, T5, T6; `modern-web-guidance` guide IDs above (no further search needed).
- **Assumptions requiring verification:** (a) statistics pass can report `rowsProcessed` per batch like typing (T1 adds it if absent); (b) `main` without `overflow-y: scroll` does not reintroduce layout shift on other routes — T5 sets `html { overflow-y: scroll }` to keep the gutter and checks `tests/app-shell.e2e.ts` parity.

## Technical decisions

| Decision                         | Chosen approach and rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Rejected alternative / trade-off                                                                                                                                |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 Rows beyond the browser limit | Maintainer, 2026-11-26: cap with notice. `MAX_RAIL_PX = 16_000_000` (below Firefox's ≈17.9M px element limit). `rowLimit = floor(MAX_RAIL_PX / measuredRowHeightPx)`; rendered rows = `min(totalRows, rowLimit)`. Above the cap the preview shows "Previewing the first {limit} of {total} rows. All rows are used for training." No segment controls, no Go to row.                                                                                                                                                                               | Segments above the cap (extra code path); a Go to row box; compressed scrolling (skips rows, rejected in the original spec).                                    |
| D2 Visual reference              | Maintainer, 2026-11-26: the human promotes 01-6 (and `css/virtual-table.css`) to `ready` before implementation. T4/T5 port it with parity entries in T7.                                                                                                                                                                                                                                                                                                                                                                                           | Authorising draft CSS for this plan only; structure-only port.                                                                                                  |
| D3 Unsupported columns           | Maintainer: unsupported = `!isModelEligibleColumnType(type)` (text, date, time, datetime). `.unsupported` on the header cell and every cell of the column, plus an `aria-hidden` alert icon and visually hidden text "Not used for training" inside the header button, so the accessible name carries the status (WCAG 1.4.1, 1.3.1).                                                                                                                                                                                                              | Text only; class-only styling (colour-only risk).                                                                                                               |
| D4 Upload validation             | Maintainer: two passes. Pass 1 in the open Upload modal parses the whole file and runs `profiler.elect()` with no IndexedDB writes; every parse/shape error (`TOO_MANY_COLUMNS`, `EMPTY_FILE`, `NO_DATA_ROWS`, `READ_FAILED`, election failures) surfaces in the modal. Pass 2 is the unchanged `runIngestion` under the in-page progress bar; only storage, quota or publication errors can occur there. Samples keep one pass.                                                                                                                   | Handover after header + first chunk (late errors in main); closing the modal immediately. Trade-off: roughly double read time for uploads.                      |
| D5 Loading controls              | Maintainer: no Cancel during in-page loading. Failure returns to the selection view with a `role="alert"` notification using `INGESTION_ERROR_MESSAGES`; prior state untouched. The modal's existing Cancel still aborts pass 1.                                                                                                                                                                                                                                                                                                                   | Cancel button in main.                                                                                                                                          |
| D6 Truncated text                | Maintainer: header buttons carry the full display name and name as DOM text (their accessible name) with no `title` or `aria-label`; the column panel shows the untruncated names for keyboard and touch users. Cells keep `title` (pointer convenience); content widths keep truncation rare.                                                                                                                                                                                                                                                     | `title` on headers (duplicate announcement, pointer-only); no cell `title`.                                                                                     |
| D7 Sticky headers                | Maintainer: below `(max-height: 30rem)` the preview `.page-header` is `position: static`; only the table header row sticks. Otherwise the table header sticks at the measured page-header block size, not the mockup's fixed `4rem` (WCAG 1.4.10, 2.4.11).                                                                                                                                                                                                                                                                                         | Always sticky.                                                                                                                                                  |
| D8 Status box replacement        | Maintainer: row-loading error → `.notification.notification-alert` with `role="alert"` and Retry above the table; empty dataset → plain paragraph "No rows to preview." instead of the table; in-flight rows → placeholder cells only. Uses the existing `notificationStyles` (`.notification-alert`) rather than adding the mockup's `.notification-error` variant.                                                                                                                                                                               | Drop the states (fails WCAG 4.1.3).                                                                                                                             |
| D9 Overscan                      | `visibleRows = ceil(innerHeight / rowHeight) + 1`; render `[first − visibleRows, first + 2 × visibleRows)` clamped, i.e. a buffer of `visibleRows × 2` (one screen above, one below). DOM bound: `3 × visibleRows + 1` rows.                                                                                                                                                                                                                                                                                                                       | Two screens each side (5× rows, ≈7k cells at 53 columns).                                                                                                       |
| D10 Row rendering                | Lit renders the header and an empty `.table-body` (no child parts). Body rows are an imperatively managed pool keyed by absolute index (`Map<number, RowNode>` + free list), created and mutated only inside `updateVirtualTable()` on `requestAnimationFrame`. Rows still in range are left untouched; rows leaving the range are recycled: new `aria-rowindex`, `style.transform`, cell `textContent`/`title`/classes. Recorded departure from Lit templating for O(visible) updates.                                                            | Lit `repeat`/`map` per frame (re-diffs every cell); keyed `repeat` recycling is not controllable.                                                               |
| D11 Scroll pipeline              | Passive `window` `scroll` and `resize` listeners only set `currentScrollTop = window.scrollY`, `updatePending = true` and, when no frame is queued, `frameId = requestAnimationFrame(updateVirtualTable)`. `updateVirtualTable` clears `frameId`, performs one layout read (`tableBody.getBoundingClientRect()`), computes the range from `currentScrollTop` and the body's document offset, mutates the pool, emits range changes, clears `updatePending`.                                                                                        | Reading layout inside the scroll handler.                                                                                                                       |
| D12 Column widths                | Consumer computes `contentChars` from statistics with the cell formatter: numeric = longest formatted `min`, `max`, `mean`, `median`; categorical = longest `categoryCounts` key; boolean = longest of `lexicon`/'true'/'false'; date/time/datetime = longest formatted `min`/`max`; text = none. Table track = `clamp(6rem, calc(<n>ch + 1rem), 20rem)`; no hint → `12rem`. All rows and the header row use `display: grid; grid-template-columns: var(--_columns)`, set once via CSSOM on `.table-container`.                                    | Per-cell inline widths (×cells CSSOM writes); measuring rendered text (layout cost; rows unknown). Header text does not widen columns (it truncates by design). |
| D13 Type classes                 | `VirtualTableColumn.kind`: `'numeric' → table-cell-num`, `'temporal' → table-cell-date` (date, time, datetime), `'boolean' → table-cell-boolean`, `'categorical' → table-cell-categorical`, `'text' → table-cell-text`. Alignment per the note: num end + tabular-nums; date start + tabular-nums; boolean/categorical centre; default start.                                                                                                                                                                                                      | Passing `ColumnType` into the generic `ui-` table.                                                                                                              |
| D14 Row-limit signal             | New event `ui-virtual-table-row-limit-change` `{ rowLimit }`, emitted after the first row measurement and whenever the limit changes (text-size change). The preview renders the notice when `totalRows > rowLimit`. `aria-rowcount = renderedRows + 1`.                                                                                                                                                                                                                                                                                           | Fixed row cap (wrong under larger text); slot (number unknown to consumer).                                                                                     |
| D15 Sticky offset API            | Public CSS custom property `--ui-virtual-table-sticky-offset` (default `0px` on `:host`) used as the header's `inset-block-start`. The preview sets it via `style.setProperty` from a `ResizeObserver` on its page header (border-box block size), or `0px` while `matchMedia('(max-height: 30rem)')` matches.                                                                                                                                                                                                                                     | A numeric property (re-render per resize); hard-coded 4rem (overlaps when the header wraps or text grows).                                                      |
| D16 Horizontal scrolling         | Document scrolls on both axes. `css/base.css` drops `main { overflow-y: scroll }`, adds `html { overflow-y: scroll }` (keeps the gutter), and ports the mockup rule as `main:has(> app-data-view[preview]) { inline-size: max-content; min-inline-size: calc(100% - var(--sidebar-width)); }`. `app-data-view` reflects a boolean host attribute `preview` (styling hook only) while it renders the preview or loading view. The preview header keeps the mockup's sticky inline offset.                                                           | Inner horizontal scroller (breaks vertical sticky against the document); JS-synced header.                                                                      |
| D17 Scroll persistence           | `ScrollSnapshot.left?: number` (document `scrollX`, raw, so RTL negatives round-trip). `recordCurrentScroll` writes it; restore calls `scrollTo({ top, left, behavior: 'instant' })`; validator accepts an absent or finite `left`. The `data-table` region writer/restorer, `scrollToRow`, `restoreScroll`, `restorePosition` and `ui-virtual-table-position-change` are removed; legacy `regions['data-table']` entries are ignored. `whenSettled` covers the table because its body height is set in the same update that receives `totalRows`. | Keeping a pseudo-region for the document.                                                                                                                       |
| D18 Load stage                   | `DatasetLoadState` gains `stage: 'idle' \| 'validating' \| 'ingesting'` and `name: string`. Samples go `idle → ingesting`; uploads `idle → validating → ingesting`. `app-data-view` renders the in-page loading view while `stage === 'ingesting'`, the modal progress while `validating`. Not persisted. The Upload dialog shows only errors raised during its own `validating` stage (fixes stale sample errors leaking into it).                                                                                                                | A separate atom; persisting a "loading" sub-view (reload would show a dead bar).                                                                                |
| D19 Progress model               | Pure `toLoadProgressView(progress)`: byte phases (`download`, `parse`) are determinate when `totalBytes > 0` (`bytesProcessed`/`totalBytes`); row phases (`typing`, `statistics`) when `totalRows > 0`; otherwise indeterminate (`value` omitted). The bar shows the current phase; visible text "{phase label}" plus "Step {n} of {total}" (4 for samples, 3 for upload pass 2). `parse` advances `bytesProcessed` per chunk (fixes `csv-stream.ts:67`).                                                                                          | One weighted bar (invents phase weights).                                                                                                                       |
| D20 Focus and announcements      | Load Dataset and the modal's pass-1 success unmount the invoker, so `app-data-view` calls the preview's `focusHeading` once the loading view renders (same h1 element persists into the ready preview: one template, header always rendered). A persistent `role="status"` in the preview announces phase changes and "{name} loaded: {rows} rows, {columns} columns"; the bar is not focusable. On failure focus goes to the selection h1 and the `role="alert"` notification announces.                                                          | Leaving focus on `body`; per-percent announcements.                                                                                                             |
| D21 Preview inputs               | `app-data-view` builds `VirtualTableColumn[]` with `buildPreviewColumns()` (new `src/features/data/preview-columns.ts`, framework-free, using an extracted `formatPreviewValue`) and passes `.columns`, `.labels`, `.datasheetAvailable`, `.loadView` to the preview. Labels (i18n in `app-data-view`, `i18n('app-data-preview', …)`) include a function `rowLimitNotice(limit, total)` closing over `$format` so the presentational preview needs no store.                                                                                       | Preview importing `$format` (Tier violation).                                                                                                                   |
| D22 Datasheet in preview         | **Datasheet** shows only when the active dataset has a `sampleId`; it emits `app-dataset-preview-datasheet` and `app-data-view` reuses `handleCardDatasheet`'s loading with the button as `invoker`; `<app-datasheet-dialog>` is rendered in preview mode too. **Change Dataset** uses `.btn .btn-red`.                                                                                                                                                                                                                                            | Hiding the action for uploads behind a disabled button (disabled-control exception policy).                                                                     |

### Interfaces and behaviour

**`ui-virtual-table` (Tier 2, `src/components/ui-virtual-table.ts`) — closed API after T4**

```ts
export type VirtualTableColumnKind = 'numeric' | 'temporal' | 'boolean' | 'categorical' | 'text';
export interface VirtualTableColumn {
	readonly key: string;
	/** Primary visible header text (display name, or the column name when there is none). */
	readonly label: string;
	/** Raw column name shown under `label`; omit when it equals `label`. */
	readonly sublabel?: string;
	readonly kind?: VirtualTableColumnKind; // omitted → default start alignment, no type class
	readonly unsupported?: boolean;
	/** Character-count width hint; omitted → 12rem track. */
	readonly contentChars?: number;
}
export interface VirtualTableWindow {
	readonly startIndex: number;
	readonly rows: readonly (readonly string[])[];
} // unchanged
export interface VirtualTableRange {
	readonly startIndex: number;
	readonly limit: number;
} // unchanged
export interface VirtualTableRowLimit {
	readonly rowLimit: number;
}
export interface VirtualTableLabels {
	readonly unsupported: string;
} // default { unsupported: 'Not used for training' }
```

- Properties (all `attribute: false` except noted): `columns` (`[]`), `window` (`{startIndex: 0, rows: []}`), `loading` (`false`), `totalRows` (`0`, attribute `total-rows`), `label` (`''`, attribute `label`), `labels` (`VirtualTableLabels`). Removed: `VirtualTablePosition`.
- Methods: `focusColumn(column: string): void` only.
- Events (host, `bubbles: false`, `composed: false`; the consumer listens on the element): `ui-virtual-table-range-change` (`VirtualTableRange`, deduplicated: only when the needed range is not covered by the last request), `ui-virtual-table-column-select` (`{ column: string }`), `ui-virtual-table-row-limit-change` (`VirtualTableRowLimit`).
- CSS custom property: `--ui-virtual-table-sticky-offset` (length, default `0px`). Internal `--_columns` is private.
- Markup: `div.table-container[role=table][aria-label][aria-rowcount][aria-colcount]` > `div.table-header[role=rowgroup]` (sticky) > `div.table-header-row[role=row][aria-rowindex=1]` > `div.table-header-cell[role=columnheader]` (+ `.unsupported`) > `button.header-btn[type=button][data-col-key]` > `span.col-display-name` + `span.col-name` when `sublabel`, else `span.col-name`; unsupported adds `<svg class="icon" aria-hidden="true" focusable="false"><use href="#error"/></svg>` (local `<symbol id="error">` copied from the mockup) and `span.visually-hidden` with `labels.unsupported`. Body: `div.table-body[role=rowgroup]` with `style.blockSize = renderedRows × rowHeight px`; rows `div.table-row[role=row][aria-rowindex=index+2]` absolutely positioned, `style.transform = translateY(index × rowHeight px)`; cells `div.table-cell[role=cell]` + type class + `.unsupported`, `title` = text; placeholder rows keep `placeholder-cell` and `aria-busy="true"`. No `tabindex`, no `role=region` (the document scrolls).
- Row height is measured from a pool row with a `ResizeObserver`; a change recomputes body block size, every pooled row's transform and `rowLimit` (emitting the event when it changes). `disconnectedCallback` removes listeners, cancels the frame and disconnects observers; reconnect restores them (COMPONENTS §4 lifecycle).
- Strings: owns none beyond the `labels` default.

**`.btn-red` (style primitive, `src/styles/button.styles.ts`)** — mockup `css/button.css` 34-42: `border-color: var(--red-700); background-color: var(--surface); color: var(--red-700)`; hover `background-color: var(--red-100)`; focus-visible as `.btn`. Contrast red-700 on surface and on red-100 ≥ 4.5:1 (T3 verifies numerically). Only for destructive actions.

**`app-dataset-preview` (Tier 2, presentational) — changed API**

- Adds: `columns: readonly VirtualTableColumn[]`, `datasheetAvailable: boolean = false`, `loadView: { phaseLabel: string; step: string; value: number | null; max: number } | null = null` (non-null → loading presentation: header + labelled `<progress>` in place of the table), `statusMessage: string = ''` (rendered in the persistent `role="status"`), extended `labels: PreviewLabels` (`heading(name)`, `datasheet`, `changeDataset`, `loadingDescription`, `rowsColumns(rows, columns)`, `rowLimitNotice(limit, total)`, `empty`, `retry`, `unsupported`, `progressLabel`).
- Events: existing `app-preview-retry` and Change Dataset event unchanged; new `app-dataset-preview-datasheet` (`{ invoker: HTMLButtonElement }`, `bubbles: false`, `composed: false`).
- Removes: `restorePosition`, segment/Go to row properties and events, `.status-box`, `.controls-bar`.
- Header markup: `<header class="page-header"><h1 tabindex="-1">{heading}</h1><p>{rowsColumns | loadingDescription}</p><div class="page-actions">[Datasheet] <button class="btn btn-red">Change Dataset</button></div></header>`; Change Dataset hidden while `loadView` is set.
- `app-column-details` adds `displayName: string = ''`; title `<h4>{displayName}<br><span class="col-name">{name}</span></h4>` when `displayName` is non-empty and differs from the name, else `<h4>{name}</h4>`.

**Ingestion protocol (internal)** — request `{ type: 'validate'; requestId: string; source: IngestionSource }` → `result` value `{ rowCount: number; columnCount: number }`; `progress` and `error` as for `ingest`; `cancel` aborts it. Validation uses the single-active-request guard but not `INGESTION_LOCK` (it writes nothing). Client: `client.validate(source, { signal, onProgress })`.

**Edge rules**

- `totalRows = 0` → empty paragraph, no table. `totalRows > rowLimit` → notice above the table, `aria-rowcount = rowLimit + 1`, last reachable row `rowLimit − 1`.
- A late `window` for a range no longer pooled is ignored (no wrong-index population).
- Columns change → pool rebuilt; header re-rendered by Lit.
- Short viewport media change and page-header resize update the sticky offset without re-render.

## Specification changes

- [ ] `specification/components/virtual-table.md` — rewrite §2-§11 to the closed API above (document scroll, single rail, row-limit cap, overscan, pool recycling, grid tracks, kinds, unsupported marker, sticky offset property, removed methods/events); status stays `implemented` with the new ACs VTB-AC-1..10.
- [ ] `specification/components/button.md` §3, §5, §8 — `.btn-red` destructive variant and its acceptance criterion.
- [ ] `specification/preview-dataset.md` — header, Datasheet entry, row-limit notice, no segments, document scroll and snapshot `left`, in-page loading and focus.
- [ ] `specification/workflow-steps.md` §1 Custom Dataset Upload / Preview Dataset — two-pass upload (modal validates, preview loads), immediate sample navigation, no segment controls, Datasheet button, displayName headers.
- [ ] `specification/app-state-and-navigation.md` §6.1 — table offset is the document snapshot; Change Dataset clears the `data:preview` snapshot; reload during validation or ingestion lands on `'select'`. §8.1/§8.3/§8.4 — `left` in the snapshot and restore call; regions remain for inner scrollers only.
- [ ] `specification/state-and-storage.md` §3 — persisted `ScrollSnapshot.left` (optional, backward compatible).
- [ ] `specification/data-ingestion.md` — validate-only pass, progress contract (byte/row phases, determinate rules).
- [ ] `specification/visual-design.md` §5.3 — revise DATA-UI-02 (red Change Dataset now matches the mockup; confirmation unchanged); add DATA-UI-04 (grid tracks with content widths instead of a single `--column-width`), DATA-UI-05 (measured sticky offset and short-viewport unsticking instead of `inset-block-start: 4rem`), DATA-UI-06 (unsupported alert icon + hidden text), DATA-UI-07 (`.notification-alert` for row errors; row-limit notice).
- [ ] `specification/HUMAN.md` §6 — close "Style virtual table" once 01-6 is promoted and ported; add "Style the in-page loading draft (01-8)".
- [ ] `specification/README.md` — status lines of the above specs aligned; no Known gap changes.

## Implementation tasks

### T1 — Validate-only ingestion pass and accurate progress

- **Depends on:** None
- **Risk:** needs care — worker protocol and pipeline changes must not alter the published ingest path.
- **Likely files:** `src/features/data/ingestion/pipeline.ts`, `src/features/data/ingestion/csv-stream.ts`, `src/features/data/ingestion/protocol.ts`, `src/features/data/ingestion/worker-handler.ts`, `src/features/data/ingestion/storage-client.ts`, `src/features/data/load-progress.ts` — new pure `toLoadProgressView`, `tests/ingestion-pipeline.test.ts`, `tests/storage-client.test.ts`, `tests/load-progress.test.ts`
- **Must not touch:** `src/components/`, `src/features/data/app-*.ts`, `src/stores/` — UI and store wiring belong to later tasks.
- **Implementation:** Add `runValidation(source, {signal, onProgress})` sharing the parse/profile path of `runIngestion` with row writes skipped and stopping after `profiler.elect()`; it raises the same error codes and returns `{rowCount, columnCount}`. Add the `validate` request/client method (Interfaces). Make the parse phase advance `bytesProcessed` per chunk; make typing and statistics report `rowsProcessed`/`totalRows` per batch. Add `toLoadProgressView(progress, stageKind)` per D19 returning `{ phase, value: number | null, max, stepIndex, stepCount }`.
- **Acceptance criteria:**
    - [ ] ING-VAL-1: validating a valid CSV returns its row and column counts and writes nothing to `raw_records`.
    - [ ] ING-VAL-2: validating CSVs with >200 columns, no data rows and an empty file rejects with `TOO_MANY_COLUMNS` (or the existing code name), `NO_DATA_ROWS`, `EMPTY_FILE`; an aborted signal rejects as cancelled.
    - [ ] ING-VAL-3: during `ingest` parse, successive progress events have non-decreasing `bytesProcessed` that reaches `totalBytes` before typing; typing/statistics events carry `rowsProcessed ≤ totalRows`.
    - [ ] LOADP-1: `toLoadProgressView` returns indeterminate for `download` with `totalBytes: null`, determinate bytes for `parse`, determinate rows for `typing`/`statistics`, and step counts 4 (sample) / 3 (upload pass 2).
- **Verification:** `bun test tests/ingestion-pipeline.test.ts`, `bun test tests/storage-client.test.ts`, `bun test tests/load-progress.test.ts`, `bun run check`
- **Progress:** [ ] Not started

### T2 — Load stage, two-pass upload orchestration and document inline scroll offset

- **Depends on:** T1
- **Risk:** needs care — persisted schema change and store contract.
- **Likely files:** `src/stores/dataset.store.ts`, `src/features/data/load-dataset.ts`, `src/types/state.ts`, `src/stores/persister.ts`, `src/router/scroll-restorer.ts`, `tests/state-and-storage.test.ts`, `tests/router-and-navigation.test.ts`, `tests/dataset-resources.test.ts`
- **Must not touch:** `src/components/`, `src/features/data/ingestion/` — protocol fixed by T1.
- **Implementation:** Add `stage` and `name` to `DatasetLoadState` (D18). `startDatasetLoad({kind: 'file'})` sets `validating`, calls `client.validate`, on success sets `ingesting` and continues with the existing ingest + `publishDataset`; samples go straight to `ingesting`. Errors and cancellation reset `stage` to `idle` with `errorCode` and record which stage failed (`errorStage: 'validating' | 'ingesting' | null`). Add optional `left` to `ScrollSnapshot`, writer, restore and validator (D17); legacy snapshots without `left` restore to 0.
- **Acceptance criteria:**
    - [ ] LOAD-ST-1: a file load passes through `validating` then `ingesting` then `idle`; a validation error never enters `ingesting` and leaves dataset, target and models unchanged.
    - [ ] LOAD-ST-2: a sample load never enters `validating`; `busy` guard still rejects a second concurrent load.
    - [ ] SCROLL-LEFT-1: a snapshot with `left` round-trips through the persister; a legacy snapshot without `left` validates and restores `left = 0`; a non-finite `left` is rejected by the validator.
- **Verification:** `bun test tests/state-and-storage.test.ts`, `bun test tests/router-and-navigation.test.ts`, `bun run check`
- **Progress:** [ ] Not started

### T3 — `.btn-red` destructive button variant

- **Depends on:** None
- **Risk:** routine
- **Likely files:** `src/styles/button.styles.ts`, `src/styles/button.stories.ts`, `specification/components/button.md`, `tests/styles-and-primitives.test.ts`, `tests/visual-parity/map.ts`
- **Must not touch:** `css/root.css` — no new tokens.
- **Implementation:** Port `.btn-red` from `specification/mockups/css/button.css` 34-42 using tokens only; add the Button story variant (default, hover-forced, focus, long label, RTL) and Do / Don't ("only for destructive or discarding actions"). Add a parity entry against `01-6_virtual-table.html` `.btn-red` (border-color, background-color, color).
- **Acceptance criteria:**
    - [ ] BTN-AC-(next free id): `.btn.btn-red` computed border and text colour equal `--red-700`, background `--surface`, hover `--red-100`; contrast ≥ 4.5:1 in both states; focus-visible outline unchanged.
- **Verification:** `bun test tests/style-tokens.test.ts`, `bun test tests/styles-and-primitives.test.ts`, `bun run test:stories`, `bun run test:e2e tests/visual-parity.e2e.ts`
- **Progress:** [ ] Not started

### T4 — `ui-virtual-table` document-scroll rewrite

- **Depends on:** None
- **Risk:** needs care — performance-critical imperative DOM, CSP, a11y; requires 01-6 promoted to `ready` first (precondition; escalate otherwise).
- **Likely files:** `src/components/ui-virtual-table.ts`, `src/components/ui-virtual-table.stories.ts`, `.storybook/fixtures/`, `tests/virtual-table.e2e.ts`
- **Must not touch:** `src/stores/`, `src/features/` — the table stays Tier 2; consumers change in T5.
- **Implementation:** Implement the closed API and D9-D15 exactly. Port `css/virtual-table.css` into `static styles` with the listed changes (grid tracks via `--_columns`, `inset-block-start: var(--ui-virtual-table-sticky-offset)`, logical `inset-inline-start` for rows, `.table-cell-date` alignment per D13 if absent from the promoted CSS, local `.visually-hidden`, icon size from the mockup `.icon`). Remove segment code, `scrollToRow`, `restoreScroll`, position event and `.table-viewport`. Stories: empty, placeholders, 150-row populated with every kind, unsupported column, display-name headers, capped (`totalRows` 10,000,000), long label, RTL; Do / Don't from the spec.
- **Acceptance criteria:**
    - [ ] VTB-AC-1: with 0, 1, 150, 600,000 and 10,000,000 rows, pooled row count never exceeds `3 × visibleRows + 1` at the start, middle and end of the document scroll; the last reachable row (`min(totalRows, rowLimit) − 1`) renders at the bottom.
    - [ ] VTB-AC-2: `.table-body` block size equals rendered rows × measured row height; each row's computed transform equals `translateY(index × rowHeight)`; scrolling by one row recycles exactly one row element (others keep their identity and transform).
    - [ ] VTB-AC-3: scroll events within one frame produce one `updateVirtualTable` run (instrumented via a counter exposed only in the test fixture); range-change events are deduplicated; a stale `window` never fills wrong indices; cell markup renders literally.
    - [ ] VTB-AC-4: `ui-virtual-table-row-limit-change` fires with `floor(16,000,000 / rowHeight)` after first measurement and again after root font size doubles; `aria-rowcount` = rendered rows + 1.
    - [ ] VTB-AC-5: each kind produces its class and computed `text-align` (num end, date start, boolean/categorical centre, text/default start) and `font-variant-numeric: tabular-nums` for num and date.
    - [ ] VTB-AC-6: column tracks equal `clamp(6rem, calc(nch + 1rem), 20rem)` for hints 1, 10, 100 and `12rem` without a hint; header and body cells align to within 1px.
    - [ ] VTB-AC-7: an unsupported column has `.unsupported` on its header cell and every rendered cell; its header button's accessible name ends with "Not used for training"; the icon is `aria-hidden`.
    - [ ] VTB-AC-8: header buttons' accessible names equal their full visible text (label + sublabel) while visually truncated; header buttons have no `title` or `aria-label`; cells have `title` equal to their text.
    - [ ] VTB-AC-9: the header row sticks at `--ui-virtual-table-sticky-offset` while the document scrolls; no element in the table is a scroll container and none has `tabindex`; no `style` attributes appear in serialised templates (CSP) and all geometry is CSSOM.
    - [ ] VTB-AC-10: disconnect removes the window listeners and observers (no further range events after scrolling); reconnect restores them; RTL renders rows from the inline start; axe passes in Chromium, Firefox and WebKit.
- **Verification:** `bun run test:e2e tests/virtual-table.e2e.ts`, `bun run test:stories`, `bun test tests/style-tokens.test.ts`, `bun run check`, `bun run lint`
- **Progress:** [ ] Not started

### T5 — Preview header, columns, notices and document layout

- **Depends on:** T2, T3, T4
- **Risk:** needs care — shared document CSS and focus/scroll restoration.
- **Likely files:** `src/features/data/app-dataset-preview.ts`, `src/features/data/app-dataset-preview.stories.ts`, `src/features/data/app-column-details.ts`, `src/features/data/app-data-view.ts`, `src/features/data/preview-columns.ts`, `css/base.css`, `tests/preview-columns.test.ts`, `tests/data-preview.e2e.ts`, `tests/data-flow.e2e.ts`, `tests/app-shell.e2e.ts`, `tests/a11y.e2e.ts`
- **Must not touch:** `src/components/ui-virtual-table.ts` — API fixed by T4; `src/features/data/ingestion/`.
- **Implementation:** Extract `formatPreviewValue` from `formatPreviewRows`; add `buildPreviewColumns(stats, displayNames, formatValue)` (D12, D13, D3; `label = displayName ?? name`, `sublabel = name` only when a different display name exists). Pass `.columns`, `.labels` (new `i18n('app-data-preview', …)` messages, British English, including `rowLimitNotice` closure, D21), `.datasheetAvailable`. Rewrite the preview header and states per Interfaces, D8, D14, D22; render the Datasheet dialog in preview mode. Sticky offset per D15/D7 (`@media (max-height: 30rem) { .page-header { position: static } }`). Document CSS per D16; `app-data-view` reflects `preview`. Remove the region writer/restorer and `restorePosition`. Pass `displayName` to `app-column-details`. Preview stories: ready, error, empty, capped notice, uploaded dataset (no Datasheet), long label, RTL.
- **Acceptance criteria:**
    - [ ] PREV-COL-1: `buildPreviewColumns` returns kinds, unsupported flags and `contentChars` per D12 for numeric (negative, decimal), categorical, boolean, each temporal type and text fixtures; sample columns get `label = displayName`, `sublabel = name`; uploads get `label = name` only.
    - [ ] PREV-AC-1: the preview h1 reads "{name} Preview"; a sample shows Datasheet then Change Dataset (`.btn-red`); an upload shows only Change Dataset; Datasheet opens the dialog and returns focus to the button on close.
    - [ ] PREV-AC-2: the document (not `main`) scrolls vertically and horizontally across a 53-column table; the page header stays at the inline start and the table header sticks directly beneath it; at 1280×400 (`max-height: 30rem`) the page header scrolls away and the table header sticks at 0.
    - [ ] PREV-AC-3: a row-loading failure shows a `role="alert"` notification with Retry (Retry re-requests rows); an empty dataset shows "No rows to preview." and no table; no `.status-box` or `.controls-bar` exists.
    - [ ] PREV-AC-4: scrolling to row 50 and 25px inline, then reloading and Back/Forward, restores `scrollY`/`scrollX` within one row; a different viewport width starts at the origin; Change Dataset clears the `data:preview` snapshot.
    - [ ] PREV-AC-5: the column panel title shows the display name and column name for a sample column and only the name for an uploaded column; closing it refocuses the header button.
    - [ ] PREV-AC-6: at 320 CSS px and 400% zoom the header actions remain operable, no content is lost except the documented truncation, and axe passes on the preview in all three browsers; other routes keep their scroll and parity (`tests/app-shell.e2e.ts` SNC-15, FOCUS-AC-1/4/5 updated for the removed table methods).
- **Verification:** `bun test tests/preview-columns.test.ts`, `bun run test:e2e tests/data-preview.e2e.ts`, `bun run test:e2e tests/data-flow.e2e.ts`, `bun run test:e2e tests/app-shell.e2e.ts`, `bun run test:e2e tests/a11y.e2e.ts`, `bun run test:stories`, `bun run check`
- **Progress:** [ ] Not started

### T6 — In-page loading flow and two-pass upload dialog

- **Depends on:** T1, T2, T5
- **Risk:** needs care — focus management across unmounting views and error routing.
- **Likely files:** `src/features/data/app-data-view.ts`, `src/features/data/app-dataset-preview.ts`, `src/features/data/app-upload-dataset-dialog.ts`, `src/features/data/app-dataset-preview.stories.ts`, `specification/mockups/01-8_table-loading.html`, `tests/data-upload.e2e.ts`, `tests/data-flow.e2e.ts`, `tests/data-selection.e2e.ts`
- **Must not touch:** `src/components/ui-virtual-table.ts`, `src/features/data/ingestion/`, `specification/mockups/01-6_virtual-table.html` — human-owned once ready.
- **Implementation:** While `stage === 'ingesting'`, `app-data-view` renders `<app-dataset-preview>` with `.loadView` from `toLoadProgressView` (labels from `INGESTION_PHASE_LABELS`) and `.statusMessage`, reflects `preview`, and requests heading focus once (D20). The upload dialog shows pass-1 progress as "Checking file" with determinate bytes, keeps its Cancel, closes when `stage` becomes `ingesting`, and displays only `errorStage === 'validating'` errors. Failures with `errorStage === 'ingesting'` (and all sample failures) render a `.notification.notification-alert` `role="alert"` above the selection cards and focus the selection h1. `<progress>`: `aria-labelledby` the phase text, `max` set, `value` omitted when indeterminate; indeterminate animation slowed, not removed, under reduced motion (`progress` guide). Update the 01-8 draft to show the loading-in-main structure (header, phase text, step text, progress, status) with the §1.1 state comments, keeping `status="draft"`.
- **Acceptance criteria:**
    - [ ] LOAD-AC-1: clicking Load Dataset immediately replaces the cards with the preview header and a labelled progress bar; focus is on the h1; the bar becomes determinate once totals are known; on success the table appears with the same focused h1 and the status announces "{name} loaded: {rows} rows, {columns} columns".
    - [ ] LOAD-AC-2: uploading a valid CSV keeps the modal open with "Checking file" progress until the whole file is validated, then the modal closes and the in-page bar shows "Reading CSV" (step 1 of 3) onward; focus moves to the preview h1.
    - [ ] LOAD-AC-3: an upload with an error only detectable after the first chunk (a file whose data rows are all blank → `NO_DATA_ROWS`) fails inside the modal; nothing is written and prior state is unchanged.
    - [ ] LOAD-AC-4: a sample load failure (network error fixture) and an upload pass-2 failure (quota fixture) return to the selection view with a plain-English `role="alert"` notification, focus on the selection h1 and the previous state unchanged; a later Upload modal shows no stale sample error.
    - [ ] LOAD-AC-5: reloading during validation or ingestion lands on the selection view with no progress bar.
    - [ ] LOAD-AC-6: with reduced motion the indeterminate bar still shows motion at the slowed duration; in forced colours the bar and its label are visible; RTL mirrors the bar.
- **Verification:** `bun run test:e2e tests/data-upload.e2e.ts`, `bun run test:e2e tests/data-flow.e2e.ts`, `bun run test:e2e tests/data-selection.e2e.ts`, `bun run test:stories`, `bun run audit:mockups specification/mockups/01-8_table-loading.html`, `bun run check`
- **Progress:** [ ] Not started

### T7 — Visual parity and specification sync

- **Depends on:** T3, T4, T5, T6
- **Risk:** routine
- **Likely files:** `tests/visual-parity/map.ts`, `specification/components/virtual-table.md`, `specification/components/button.md`, `specification/preview-dataset.md`, `specification/workflow-steps.md`, `specification/app-state-and-navigation.md`, `specification/state-and-storage.md`, `specification/data-ingestion.md`, `specification/visual-design.md`, `specification/HUMAN.md`, `specification/README.md`, `specification/plans/virtual-table-improvements.md`
- **Must not touch:** `specification/mockups/01-6_virtual-table.html`, `specification/mockups/css/` — human-owned after promotion.
- **Implementation:** Add parity entries mapping 01-6 `.table-header-cell`, `.header-btn`, `.table-row`, `.table-cell`, `.table-cell-num`, `.table-cell-boolean`, `.page-header .page-actions` and `.btn-red` to the app selectors (computed font-size, font-weight, line-height, colour, padding, borders, block size, text-align), citing DATA-UI-04..07 for intentional differences. Tick every Specification changes item.
- **Acceptance criteria:**
    - [ ] Parity entries pass in Chromium with deviations cited by register ID; no new known failures.
    - [ ] Every Specification changes item is ticked and `bun run plans:check` passes.
- **Verification:** `bun run test:e2e tests/visual-parity.e2e.ts`, `bun test tests/style-tokens.test.ts`, `bun run plans:check`, `bun run format:check`, `bun run build`
- **Progress:** [ ] Not started

## Verification and definition of done

- [ ] All task acceptance criteria met.
- [ ] Relevant verification commands from `AGENTS.md` pass with no new failures.
- [ ] Type-check, lint, formatting, and build checks pass.
- [ ] Accessibility (WCAG 2.2 AA), privacy/security, and contract-compatibility checks completed where applicable. Manual checks: NVDA or VoiceOver reads a truncated header's full name and the unsupported text; keyboard Page Down/arrow scrolling from a focused header button; 400% zoom on a 1280×1024 window; touch opening the column panel.
- [ ] Every item under _Specification changes_ is ticked, and specifications match the implemented code.
- [ ] No unintended changes outside the tasks' likely files.

## Risks and open questions

- **Blocking:** None
- **Non-blocking:** T4 cannot start until the maintainer promotes `01-6_virtual-table.html` to `ready` (D2; HUMAN.md §6). The promoted mockup should include the unsupported alert icon and `.table-cell-date` styling; if it does not, T4 implements them per D3/D13 and T7 records DATA-UI-06.
- **Non-blocking:** Removing Go to row and segments means keyboard and screen-reader users reach distant rows only by scrolling (maintainer accepted, D1). Rows beyond `rowLimit` are not previewable.
- **Non-blocking:** Two-pass uploads roughly double read time for large files (D4).
- **Non-blocking:** `16,000,000` px is an empirical browser limit, not a standard; VTB-AC-1 covers 10,000,000 rows in all three engines.
- **Non-blocking:** `scroll-region-restoration.md` (stub) still describes `data-table` as a region; its expansion must drop that reference. Owner: whoever expands the stub.
- **Non-blocking:** The heading change from "Preview Dataset: {name}" to "{name} Preview" changes the document title source only if it is derived from the h1; T5 checks `src/app.ts` title rules.
- **Non-blocking:** Visual styling of the in-page loading view stays draft (01-8) and is queued for the human.

## Escalations

None.

## Review fixes

None.

## Implementation and verification log

| When (UTC) | Task | Agent (model) | Outcome / commands / evidence |
| ---------- | ---- | ------------- | ----------------------------- |
| —          | —    | —             | Not started                   |

## Plan review history

| Reviewed (UTC) | Agent (model) | Decision | Findings |
| -------------- | ------------- | -------- | -------- |
| 2026-11-26T10:53:58Z | Claude Code (claude-opus-5-5) | changes-requested | MAJOR: D10/VTB-AC-2 recycle rows by transform without restoring DOM order, so browse-mode reading order of role=table rows scrambles (WCAG 1.3.2); keep pool children in index order. MAJOR: D16 drops main overflow-y:scroll, which makes the shared sticky .page-header (page-header.styles.ts:10; models, target, data views) stick against the document on every route, contradicting the out-of-scope item and untested for WCAG 2.4.11/parity. MAJOR: D19/T1 leave statistics progress undefined: it runs one histogram scan (no row events) plus one median scan per numeric column (pipeline.ts:587-601), so a per-scan rowsProcessed/totalRows bar resets repeatedly; define a cumulative model and AC. MINOR: name $datasetResources.descriptor as the async displayName source; add errorStage to D18; HUMAN.md entry is Promote the virtual table mockup, not Style virtual table; .unsupported styling absent from 01-6; T3 parity targets draft 01-6; VTB-AC-3 counter mechanism unspecified; MAX_COLUMNS check is in csv-stream.ts:98-108; categoryCounts is uncapped. |

## Change log

| When (UTC)           | Change        | Reason                                                                                                                                        |
| -------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-26T10:41:08Z | Initial draft | `specification/notes/ui-fixes.md` § Improve Virtualized Table and mockup commit `7a11581`; maintainer decisions D1-D8 recorded on 2026-11-26. |
