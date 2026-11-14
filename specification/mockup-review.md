# Mockup review workflow

**Status:** implemented

This guide covers the human-owned CSS review, markup feedback, promotion and application handoff for files under [`mockups/`](mockups/). The server and audit command provide local evidence; neither a directory name nor an automated result approves a design.

## Browse and audit

Start the read-only catalogue from the repository root:

```sh
bun run serve:mockups
```

Open `http://localhost:3333/`. Search by path or title and filter the Needs styling, HTML, CSS, other resources and empty-file groups. Each file is identified by its full path relative to `specification/mockups/`. Drafts remain in the Needs styling group wherever they are nested. A reference file is not labelled approved.

Canonical file URLs start with `/files/`, for example:

- Preview: `http://localhost:3333/files/ui-scaffold/drafts/03-0_models-overview.html`
- Original source: `http://localhost:3333/__source/ui-scaffold/drafts/03-0_models-overview.html`
- Clean preview: `http://localhost:3333/files/ui-scaffold/drafts/03-0_models-overview.html?clean=1`

The normal HTML preview adds an isolated, in-flow helper. It identifies the full path and status and provides catalogue, source, clean-preview and counterpart links. Choose a page and activate **Go** to navigate; changing the select does not navigate. The clean URL returns the original HTML bytes without helper or live-reload code, so it is suitable for screenshots and automated audits. CSS and asset URLs keep their original relative paths. The server never writes files; edit and save them in the local editor. Save DevTools experiments to disk before a live reload.

Run a focused audit in another terminal while the server is running:

```sh
bun run audit:mockups ui-scaffold/drafts/03-0_models-overview.html ui-scaffold/drafts/03-4_train-models-3-configure-model.html
```

To audit every non-empty HTML file, omit the paths. An optional `--port 3333` selects a different local server port. Paths are relative to `specification/mockups/`; pass HTML files only. Empty explicit targets, missing files, non-HTML files and invalid paths are setup errors. Empty HTML files discovered in all-pages mode are listed as skipped. The command overwrites `test-results/mockup-a11y/latest.json` and `latest.html` for each run.

Exit status `0` means no automated violations were found; `1` means a violation or file-level navigation/runtime error; `2` means arguments, eligible pages, the server or browser prevented a valid run. Reports include file paths and clean URLs, Chromium version, 1440×900 viewport, axe-core version, tags, violation selectors and help links, incomplete findings, errors and skipped empty files. Contrast is included. Review incomplete findings manually. A static scan does not test app interactions or establish WCAG conformance.

## Style and review a draft

1. Choose one draft and read the behaviour specification that defines its copy and states. Open the draft and any counterpart in separate windows. Keep the application open separately when an implementation exists.
2. Edit the actual draft and its stylesheet in the editor. A human-authored sibling CSS file can be linked after `../style.css`. Scope new selectors to an explicit content wrapper. Prefer existing tokens, logical properties, native controls and established shared patterns. Avoid broad edits to the shared scaffold stylesheet for one surface.
3. Use DevTools to experiment, then save the final changes to disk. Start visual review at 1440×900; check narrow and zoomed layouts before polishing.
4. Run the per-file audit. Inspect every violation and incomplete result; distinguish inherited shell problems from new defects using the existing A11Y and SEM registers. Open native dialogs through their actual controls when they exist. If a state cannot be reached in static markup, record it as not tested.
5. Complete and record the manual checks below. A screenshot or passing automated score is evidence, not a design approval.

The catalogue itself uses native browser presentation with TOOL-01's minimal reflow rules. This developer-only exception does not grant a styling exception to product surfaces. See [visual-design.md §1.1](visual-design.md#11-draft-mockups).

### Manual checks

Record the actual browser and assistive technology used. Check:

- Tab and Shift+Tab order, Enter/Space/Escape behaviour as appropriate, visible and unobscured focus, absence of keyboard traps, and dialog return focus.
- Headings, landmarks, control names/roles/states, labels and errors, and table captions/headers. Use VoiceOver with Safari or name the actual alternative screen-reader/browser pair.
- 200% text zoom, 320 CSS-pixel reflow or equivalent 400% zoom, WCAG text-spacing overrides, forced colours and reduced motion.
- Text contrast of 4.5:1 (3:1 for large text), required non-text boundaries of 3:1, and 24×24 CSS-pixel targets or a valid spacing/other exception.

Two-dimensional data tables may scroll where required; surrounding text and controls still need to reflow. Mark unavailable or unreached checks as not tested instead of inferring a pass.

## Request markup changes

Request structural changes early, with enough detail to preserve behaviour and accessibility:

```text
File and section/selector:
Current problem:
Desired layout or interaction:
Proposed element, wrapper or order change:
Affected states:
Accessibility implications:
Evidence (screenshot, selector or snippet):
```

Agents may edit structural drafts within an authorised task. Preserve human-authored CSS hooks and report changed selectors. Existing behaviour specifications take precedence; a new interaction, public API or larger change needs a plan. Do not rewrite normative mockups or use CSS ordering to conceal reading or focus order.

## Review record template

Save a record at `specification/mockups/ui-scaffold/drafts/reviews/<surface>.md` when evidence needs to travel with the draft. The folder is inventoried as a resource; records are not approvals.

```markdown
# <Surface> review

## Source and scope

- HTML/CSS paths:
- Behaviour plan/spec:
- Sections, selectors and states reviewed:
- Intended final destination:

## CSS and markup

- CSS summary and shared-pattern impact:
- Requested markup changes and resolution:

## Automated evidence

- Command, report path, date, browser and viewport:
- Violations and incomplete results:

## Manual checks

| Check                             | Result  | Evidence | Browser / assistive technology |
| --------------------------------- | ------- | -------- | ------------------------------ |
| Keyboard                          | pending |          |                                |
| Screen reader                     | pending |          |                                |
| Zoom and reflow                   | pending |          |                                |
| Forced colours and reduced motion | pending |          |                                |
| Contrast and target size          | pending |          |                                |

## Unresolved findings

| Severity | Selector | Register ID | Owner | Status |
| -------- | -------- | ----------- | ----- | ------ |

## Human decision and app port

- Promotion decision (human-owned): pending
- Integration plan:
- Final app verification evidence:
```

Use `pending`, `passed`, `failed` and `not tested` honestly. An agent may prepare evidence but must not create a reviewer stamp or record design acceptance for the human.

## Human promotion

After reviewing the CSS and evidence, the human chooses the final filename and moves the styled HTML into `mockups/ui-scaffold/`. Move its CSS into `mockups/ui-scaffold/css/`, update imports and asset paths, and replace any placeholder deliberately. Recheck related references and rerun the audit after the move. Remove the DRAFT comment only during human promotion. A non-empty reference is not proof of approval or conformance. Keep its HUMAN.md styling item until the human confirms the work is complete.

## Commission the application port

Once styling and promotion are complete, request a focused integration plan naming the HTML, CSS/selectors, states and consuming routes/components. Map document-wide rules to `css/`, reusable Shadow DOM rules to `src/styles/*.styles.ts`, and local rules to the owning Lit component. CSS selectors do not cross Shadow DOM boundaries automatically; never import mockup CSS into the application wholesale. The implementation uses the Lit architecture and implementer skills, records permitted translations and A11Y/SEM deviations, adds parity entries for promoted surfaces at 1440×900, and runs token, app-state accessibility, keyboard and browser checks with paired screenshots. Remove the separate integration queue item only when the port is verified and specifications are synced.
