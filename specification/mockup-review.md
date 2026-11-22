# Mockup review workflow

**Status:** implemented

This guide covers the human-owned CSS review, markup feedback, in-place promotion, and application handoff for files under [`mockups/`](mockups/). The server and audit command provide local evidence; neither a status label nor an automated result approves a design.

## Browse and audit

Start the read-only catalogue from the repository root:

```sh
bun run mockups
```

Open `http://localhost:3333/`. The `/` index page renders `<body class="mockup-index">` and populates `<table class="mockups">` from live `GET /index.json`, listing every top-level HTML mockup with its plain-English name, filename, description, lifecycle status (`draft`, `ready`, or `implemented`), and `View source` / `Clean preview` actions. Search matches name, filename, and description client-side, and the status selector filters by `all`, `draft`, `ready`, or `implemented`.

File URLs are served flat from `specification/mockups/`, for example:

- Preview: `http://localhost:3333/03-0_models-overview.html`
- Original source: `http://localhost:3333/__source/03-0_models-overview.html`
- Clean preview: `http://localhost:3333/03-0_models-overview.html?clean=1`
- Live metadata: `http://localhost:3333/index.json`

Normal HTML previews inject `<link rel="stylesheet" href="/mockups.css" />` into `<head>` and a light-DOM `#__mockup-review-helper-host` bar before `</body>` showing the mockup name, status badge, description, an Index link (`/`), and a `#preview-page` `<select>` populated from `/index.json` that navigates immediately on `change`. Human-authored rules in `specification/mockups/mockups.css` style both the helper bar and the `body.mockup-index` catalogue directly. The `?clean=1` URL returns untouched raw file bytes from disk without injected CSS, helper markup, or live-reload scripts, so it is suitable for visual-parity screenshots and automated accessibility audits. CSS and asset URLs (`./style.css`, `css/*.css`) resolve directly from the flat root. The server never writes files; edit and save them in the local editor. Save DevTools experiments to disk before a live reload.

Run a focused audit in another terminal while the server is running:

```sh
bun run audit:mockups 03-0_models-overview.html 03-4_train-models-3-configure-model.html
```

To audit every non-empty top-level HTML file, omit the filenames. An optional `--port 3333` selects a different local server port. Pass top-level HTML filenames directly inside `specification/mockups/`. Empty explicit targets, missing files, nested paths, non-HTML files, and invalid paths are setup errors. Empty HTML files discovered in all-pages mode are listed as skipped. The command overwrites `test-results/mockup-a11y/latest.json` and `latest.html` for each run.

Exit status `0` means no automated violations were found; `1` means a violation or file-level navigation/runtime error; `2` means arguments, eligible pages, the server, or the browser prevented a valid run. Reports include filenames and clean URLs, Chromium version, 1440×900 viewport, axe-core version, tags, violation selectors and help links, incomplete findings, errors, and skipped empty files. Contrast is included. Review incomplete findings manually. A static scan does not test app interactions or establish WCAG conformance.

## Style and review a draft

1. Choose one mockup with `<meta name="status" content="draft" />` and read the behaviour specification that defines its copy and states. Multi-state drafts wrap each state fragment in `<!-- {State Name} -->`, `<!-- This will display when {condition}. -->`, and `<!-- / {State Name} -->` HTML comments so each variant is clear to inspect and style. Keep the application open separately when an implementation exists.
2. Edit the draft and its stylesheet in the editor. A human-authored sibling CSS file can be linked after `./style.css`. Scope new selectors to an explicit content wrapper. Prefer existing tokens, logical properties, native controls, and established shared patterns. Avoid broad edits to the shared mockups stylesheet for one surface.
3. Use DevTools to experiment, then save the final changes to disk. Start visual review at 1440×900; check narrow and zoomed layouts before polishing.
4. Run the per-file audit. Inspect every violation and incomplete result; distinguish inherited shell problems from new defects using the existing A11Y and SEM registers. Open native dialogs through their actual controls when they exist. If a state cannot be reached in static markup, record it as not tested.
5. Complete and record the manual checks below. A screenshot or passing automated score is evidence, not a design approval.

The `/` catalogue and `#__mockup-review-helper-host` review bar are developer-only tooling styled by human-owned `specification/mockups/mockups.css`. This developer-only exemption does not grant any styling or WCAG exception to product mockups or application surfaces. See [visual-design.md §1.1](visual-design.md#11-draft-mockups).

### Manual checks

Record the actual browser and assistive technology used. Check:

- Tab and Shift+Tab order, Enter/Space/Escape behaviour as appropriate, visible and unobscured focus, absence of keyboard traps, and dialog return focus.
- Headings, landmarks, control names/roles/states, labels and errors, and table captions/headers. Use VoiceOver with Safari or name the actual alternative screen-reader/browser pair.
- 200% text zoom, 320 CSS-pixel reflow or equivalent 400% zoom, WCAG text-spacing overrides, forced colours, and reduced motion.
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

Agents may edit structural drafts (`<meta name="status" content="draft" />`) within an authorised task. Preserve human-authored CSS hooks and report changed selectors. Existing behaviour specifications take precedence; a new interaction, public API, or larger change needs a plan. Do not rewrite `ready` or `implemented` mockups, do not overwrite `mockups.css`, and do not use CSS ordering to conceal reading or focus order.

## Review record template

Save a record at `specification/mockups/reviews/<surface>.md` when evidence needs to travel with the draft. Review records are not listed in the `/` catalogue or `/index.json` (which list top-level `.html` files only), remain readable via `/__source/reviews/<surface>.md`, and are not approvals.

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

Use `pending`, `passed`, `failed`, and `not tested` honestly. An agent may prepare evidence but must not create a reviewer stamp or record design acceptance for the human.

## Human promotion

Promotion happens in place inside `specification/mockups/`: after reviewing the CSS and evidence, the human updates `<meta name="status" content="ready" />` (and later `implemented` once ported), moves or links any new stylesheet under `specification/mockups/css/`, removes the `DRAFT` header comment, and reruns `bun run audit:mockups` on the promoted file. A `ready` or `implemented` status is human-owned; keep the corresponding `HUMAN.md` styling item until the human confirms the work is complete.

## Commission the application port

Once styling and promotion are complete, request a focused integration plan naming the HTML, CSS/selectors, states, and consuming routes/components. Map document-wide rules to `css/`, reusable Shadow DOM rules to `src/styles/*.styles.ts`, and local rules to the owning Lit component. CSS selectors do not cross Shadow DOM boundaries automatically; never import mockup CSS into the application wholesale. The implementation uses the Lit architecture and implementer skills, records permitted translations and A11Y/SEM deviations, adds parity entries for promoted surfaces at 1440×900, and runs token, app-state accessibility, keyboard, and browser checks with paired screenshots. Remove the separate integration queue item only when the port is verified and specifications are synced.

After the initial port, co-located production component stories are the editing and review surface: changes to the real component or shared style sheet update the workbench. Mockups remain the appearance reference; a Storybook preview is not a second implementation or authority to redesign. Review the paired clean-reference/app images before accepting screenshot baselines. Computed style/relative geometry, screenshot regression, and token checks block unapproved drift; passing story smoke alone does not close an application port. Draft-only prose/features still await human styling and promotion.
