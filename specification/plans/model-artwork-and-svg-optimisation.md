# Model artwork and production SVG optimisation

**Status:** ready | **Updated:** 2026-11-24T08:38:30Z
**Authors:** Codex (GPT-6) | **Created:** 2026-11-24T08:25:54Z
**Verified by:** Codex (GPT-6) | **Verified:** 2026-11-24T08:38:30Z | **Verification:** approved
**Verified hash:** sha256:28a417b5a974722aeb8e7d7247bdeee883e24d8ed12de87f19996a03dd5f6d84
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour:** The builder's Choose Model section renders one Logistic Regression card with
an inline illustration and seven classifiers as text entries. Both build modes copy the supplied SVG
files directly from `public/`.

**Target behaviour:** Every offered classifier uses its supplied illustration on an illustrated
model card. Production builds optimise each public SVG and serve it under the same URL.

**Why:** Give learners the intended illustration for each choice and reduce the size of the SVGs
shipped to browsers.

## Scope

**In scope**

- All eight classifier cards in builder Section 1 and the existing selection and description interactions.
- Build-time SVGO optimisation of every `.svg` file copied from `public/`, including the unused Linear Regression illustration.

**Out of scope**

- New model types or changes to catalogue eligibility, training, model configuration, workers or data formats.
- New artwork, edits to the authored SVGs, or optimisation of inline SVG markup, mockup source or vendored files.

**Constraints and invariants**

- Keep existing catalogue IDs, eligible target kinds and catalogue order. Restore the selected card
  from the existing model state and advance on the existing Continue action.
- Preserve both directly listened-to model card events, visible action labels, keyboard
  behaviour and workflow focus handling. Give each card action a model-specific accessible name.
- Keep artwork decorative, same-origin and within the existing 5:3 image frame. No new CSS tokens.
  Authored colours are part of the supplied image files.
- Keep authored sources, development delivery, non-SVG public files, root-absolute URLs, deployment
  headers and the training asset graph intact. Optimisation consumes repository-owned build inputs.

## Required reading

- `AGENTS.md` — repository boundary, verification commands and visual fidelity.
- `specification/ARCHITECTURE.md` — directory structure and asset delivery.
- `specification/COMPONENTS.md` §§3–10 and `specification/components/card.md` §§3–9, 11 — closed API, slots, styles, accessibility, tests, stories and non-goals.
- `specification/workflow-steps.md` §3.1 — chooser eligibility, selection, description and Continue.
- `specification/visual-design.md` §§1, 5.3 and 6 — approved mockup geometry, deviations and parity.
- `specification/testing.md` — browser, story and checkout contracts.

## Codebase context

- **Relevant specifications:** `specification/workflow-steps.md` §3.1 and `specification/components/card.md` §§3–9.
- **Relevant implementation:** `src/features/models/model-catalogue.ts` lines 15–25 and 66–92
  define `ClassifierId` and eligibility. `src/features/models/app-model-builder-view.ts` lines
  681–716, 808–1018 and 1106–1170 implement Section 1. `src/features/models/app-model-card.ts`
  lines 33–105 and `src/styles/card.styles.ts` lines 37–42 and 96–100 define the card and image slot.
  `scripts/build-assets.ts` lines 104–112 and 131–141 call `copyDirContents`
  (`scripts/filesystem.ts` lines 16–33). The static server already recognises `.svg`.
- **Tests and commands:** `tests/models-setup.e2e.ts`, `tests/model-card.e2e.ts` and
  `tests/visual-parity/map.ts` cover chooser interactions, card behaviour and parity.
  `tests/model-catalogue.test.ts` covers all five column types. Baseline `bun run check` passed
  586 tests and `bun run build` passed. A scratch SVGO 4.1.0 run at precision 6 processed all nine
  SVGs, reducing the aggregate size from 43,915 to 31,646 bytes. The outputs retained their
  intrinsic dimensions and viewBox. Chromium decoded and compared all pairs at 360×216 and 720×432.
- **Web guidance:** `accessibility` §6 and `html` §§1, 3 — use empty alternative text for
  decorative images and declare dimensions to reserve space.
- **Visual reference:** `specification/mockups/03-2_train-models-1-choose-model.html`,
  `.cards-grid` and `.card.card-model`. Record the eight-card expansion, supplied artwork and
  selected marker in MODELS-UI-03. Use the existing card layout and approved mockup.
- **Domain skills:** `lit-component-implementer` for T2.
- **Assumptions requiring verification:** None.

## Technical decisions

| Decision       | Chosen approach and rationale                                                                                                                                                                                                                   | Rejected alternative / trade-off                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Asset URLs     | An exhaustive, private `ClassifierId` to `/assets/*.svg` map in the existing builder module. This binds each model to the supplied filename and checks future catalogue changes at typecheck.                                                   | Filename derivation would misname four classifiers.                                                         |
| Image delivery | Place a native `img` in the existing decorative slot. Respect the original SVG slot form for current consumers and fixtures.                                                                                                                    | Inlining duplicates art in the JavaScript bundle and requires handling each document's SVG IDs in the page. |
| Current choice | Use the builder's existing model ID, a visible localised `Selected` marker and `aria-current="true"` on the selected card's select button.                                                                                                      | A toggle would change the select-only interaction.                                                          |
| Optimisation   | Pin SVGO 4.1.0 as a Bun dev dependency. Use its programmatic `optimize` API with the v4 default preset and `floatPrecision: 6` in the production public-file copy. The higher precision limits raster differences while reducing shipped bytes. | A separate in-place command would modify authored files or need a second pass over the build output.        |

References for the optimisation and current-item semantics are in the [SVGO 4.1.0 release](https://github.com/svg/svgo/releases/tag/v4.1.0), [SVGO Node API](https://svgo.dev/docs/usage/node/), [v4 default preset changes](https://svgo.dev/docs/migrations/migration-from-v3-to-v4/) and [WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/#aria-current).

### Interfaces and behaviour

| `ClassifierId`              | URL                                           |
| --------------------------- | --------------------------------------------- |
| `bernoulli-nb`              | `/assets/bernoulli-naive-bayes.svg`           |
| `decision-tree-classifier`  | `/assets/decision-tree-classifier.svg`        |
| `gaussian-nb`               | `/assets/gaussian-naive-bayes.svg`            |
| `k-neighbors-classifier`    | `/assets/k-nearest-neighbours-classifier.svg` |
| `logistic-regression`       | `/assets/logistic-regression.svg`             |
| `mlp-classifier`            | `/assets/mlp-classifier.svg`                  |
| `multinomial-nb`            | `/assets/multinomial-naive-bayes.svg`         |
| `support-vector-classifier` | `/assets/support-vector-classifier.svg`       |

- The connected `app-model-builder-view` renders a single `ul.cards-grid` with a native `li`
  for each catalogue entry, keyed by `entry.id`. Keep list semantics in Safari with `role="list"`
  when resetting list markers. Bind `model-id` as an attribute for stable identification. Bind
  selection from the existing model ID. Choosing the current ID follows the existing store no-op.
  Keep the catalogue names and summaries for the seven newly illustrated choices. Preserve the
  existing visible Logistic Regression card title and two-sentence description at builder lines
  1111–1114 as a local card-only override. Keep the existing no-candidate notice, description-dialog content,
  confirmation and Continue flows.
- Presentational `app-model-card` retains `modelId` (`model-id`, default `''`), `name` and
  `description` (string, default `''`) and `type` (classification, regression or clustering,
  default classification). The only added property is `selected` (Boolean attribute, defaults to
  false, no reflection). The only slot remains `image`, accepting exactly one existing inline
  `svg` with `viewBox="0 0 360 216"` or one decorative `img` of ratio 5:3. The two events
  `app-model-select` and `app-model-description-open` keep their
  `CustomEvent<{ modelId: string; name: string }>` payload and `bubbles: false, composed: false`.
  The card has no public methods, parts or CSS custom properties.
- The builder passes `<img slot="image" src="…" alt="" width="360" height="216">`. Keep the hidden
  image wrapper, existing image background and full inline width. Fit both forms using the shared
  slotted image styles. Keep the reserved area if an image fails to load. A failed request leaves
  the name, description and actions usable.
- Keep the localised visible action labels. Give each native button an accessible name through a
  localised parameterised message containing the full visible action label and model name. In
  English the names are `Model Description: {name}` and `Select Model: {name}`. With an empty
  model name, let the visible action label supply the accessible name. Remove the current
  `aria-describedby="title"` from these buttons because their accessible names now include the
  model. Keep the existing description dialog’s restoration of the element focused at opening.
- Put the localised `Selected` text beside the selected button in the existing actions area, with
  `aria-hidden="true"` on the marker. Set `aria-current="true"` on that button only. Allow the
  actions to wrap within the same card. Use the existing button and type styles. Keep the grid’s
  280px preferred minimum, capped by available inline space, so one card fits at narrow widths.
- The build optimises every regular file with the lowercase `.svg` extension under `public/`
  during the production copy. This is the extension recognised by the current static server. Use
  lowercase `.svg` for public SVG files and retain their relative paths. Keep scalability, available title text,
  aspect ratios and internal references such as Linear Regression's `xlink:href`. Unchanged bytes
  are valid when SVGO yields the original bytes. An unreadable or malformed SVG fails the build
  with its public-relative path and underlying error. A later build follows the existing clean
  output setup.

## Specification changes

- [ ] `specification/ARCHITECTURE.md` — Production public-file delivery includes build-time SVG optimisation for lowercase `.svg` files with stable URLs and authored sources. Status partial → partial.
- [ ] `specification/workflow-steps.md` §3.1 — Each of the eight classifiers has a mapped illustration, with the current selection conveyed visibly and programmatically. Status partial → partial.
- [ ] `specification/components/card.md` §§2–9, 11 — Document both decorative slot forms, the selected property and marker, model-specific accessible button names, geometry, acceptance tests and model-card stories. Update §11 to allow the defined model selected state and required empty `alt` on the decorative `img`. Keep the dataset-card contract. Status implemented → implemented.
- [ ] `specification/visual-design.md` §5.3 — MODELS-UI-03 records eight illustrated cards, the supplied art and current-selection marker with 03-2 as the per-card geometry reference. Status partial → partial.
- [ ] `specification/HUMAN.md` — Close the model text-entry styling and optional illustration queue items when the illustrated chooser replaces the text entries. Keep the draft mockup file as a historical reference.
- [ ] `specification/TODO.md` TODO-07 — Replace the Logistic-only and text-entry details with the eight illustrated classifiers and reference the current workflow specification.
- [ ] `specification/FUTURE.md` §2 — Remove the completed deferred classifier illustration and text-entry replacement item.
- [ ] `specification/testing.md` — Record model card and chooser story coverage in the coverage boundary. Status partial → partial.
- [ ] `specification/README.md` and `specification/COMPONENTS.md` — Check status alignment and known gaps. Scope broader story and contrast gaps to outstanding work if needed.

## Implementation tasks

### T1 — Optimise production SVGs during the public-file copy

- **Depends on:** None
- **Risk:** needs care — a successful optimiser run can still alter artwork geometry or references.
- **Likely files:** `package.json`, `bun.lock`, `scripts/build-assets.ts`, `scripts/build-public-assets.ts`, `scripts/filesystem.ts`, `tests/public-svg-build.test.ts`, `tests/public-svg-assets.e2e.ts`
- **Must not touch:** `public/`, `src/`, `vendor/`, `specification/mockups/`
- **Implementation:** Install with `bun add --dev --exact svgo@4.1.0`. Add an optional async
  file-transform callback to `copyDirContents`, forwarding it through its existing recursion.
  A callback return of `undefined` uses the ordinary file copy. Export
  `copyOptimisedPublicFiles(sourceDir: string, outDir: string): Promise<void>` from
  `scripts/build-public-assets.ts` for the production build and temporary-directory tests. It
  calls the existing copier with the SVG transform. For each `.svg` read the original, pass the
  source path and precision 6 to SVGO, and write its returned `data` at the normal destination.
  Report read or optimisation errors with the source path relative to `sourceDir`. Leave
  development and other callers on the default copy.
- **Acceptance criteria:**
    - [ ] SVG-BUILD-1: All nine supplied SVGs, including Linear Regression, are emitted under unchanged paths. Inputs remain byte-for-byte identical. The SVG collection shrinks in aggregate, and no individual output grows.
    - [ ] SVG-BUILD-2: A scratch public tree with a nested SVG containing a removable comment and a non-SVG peer proves recursive optimisation and exact non-SVG copying. The default copy preserves SVG bytes; malformed SVG input makes the production transform reject with the source-relative path and cause.
    - [ ] SVG-BUILD-3: Both `APP_URL` and `DIST_URL` return the nine URLs successfully as `image/svg+xml`. In the Chromium project, fetch the response bytes from both servers with Playwright's request fixture. Pass the bytes into a blank page as base64 data URLs, decode with `Image.decode()` and check intrinsic dimensions of 360×216. Draw each pair onto separate transparent canvases at 360×216 and 720×432. Compare same-position RGBA values from `getImageData()` and count a pixel once if any channel differs by more than 24. Require the count divided by total pixels to be at most 0.002 at each size. Inspect the source and production images side by side for clipping, missing geometry or colour changes, including Linear Regression’s internal reference.
- **Verification:** `bun test tests/public-svg-build.test.ts`, `bun run build`, `bun run test:e2e tests/public-svg-assets.e2e.ts`, manual browser inspection of original and production SVGs at both sizes.
- **Progress:** [ ] Not started

### T2 — Render the supplied artwork on each classifier card

- **Depends on:** T1
- **Risk:** needs care — selector collisions and lost selection feedback are possible when the chooser moves to eight card instances.
- **Likely files:** `src/features/models/app-model-builder-view.ts`, `src/features/models/app-model-builder-view.stories.ts`, `src/features/models/app-model-card.ts`, `src/features/models/app-model-card.stories.ts`, `src/styles/card.styles.ts`, `tests/models-setup.e2e.ts`, `tests/model-card.e2e.ts`, `tests/model-configuration.e2e.ts`, `tests/a11y.e2e.ts`, `tests/visual-parity.e2e.ts`, `tests/visual-parity/map.ts`
- **Must not touch:** `public/`, `src/features/models/model-catalogue.ts`, `src/stores/`, `src/workers/`, `vendor/`, `specification/mockups/`
- **Implementation:** Replace the inline Logistic Regression template and text-entry branch with
  one illustrated list driven by the existing catalogue and exhaustive URL map. Wire the two
  existing card listeners to their existing handlers and retain ID-based selection. Implement
  the defined slot and selected-state API, update the `@slot` TSDoc, and preserve the original
  inline SVG form. Remove chooser-only text-entry styles and messages only where now unused.
  Update chooser locators to scope by `model-id` in existing tests and move the existing parity
  card selector to Logistic Regression explicitly. Compare the same card shell properties.
  Update chooser stories for the illustrated list and selected and numeric unsupported examples
  using the existing builder seed. Extend the seed for a Boolean story with Boolean target metadata
  in both persisted summary and ready state. Use an empty completion list and a null model ID for
  an unselected chooser. For the Boolean browser journey use the existing CSV upload flow with a
  Boolean column containing both true and false values and a varying numeric feature. Add model-card stories for all three type variants, both image forms,
  selected and unselected, long label, narrow, grid and RTL. Use one actual `public/assets` image,
  existing Storybook Vite public-file delivery and CEM controls. Put the slot usage rules in the
  Docs description.
- **Acceptance criteria:**
    - [ ] MODEL-ART-1: Categorical and Boolean chooser fixtures show exactly eight cards in catalogue order, with one correctly mapped decorative image each. The card images decode at 360×216. The numeric-target browser flow still reaches the no-candidate notice and shows zero cards. Use `tests/model-catalogue.test.ts` to verify the empty lists for text and datetime, which the target actions and hydration exclude before the builder. Keep both target-selection restrictions.
    - [ ] MODEL-ART-2: Assert the exact model-specific accessible name of each button and the original visible action labels. Open a non-Logistic description with the keyboard, dismiss it and verify focus returns to the invoking button. Verify that pointer activation opens the same description and preserves native focus behaviour. Selecting a model marks only that model with visible `Selected` and `aria-current="true"`, and keeps Section 1 active. Re-selecting the current model leaves the selection and existing setup data intact. Selecting a different model and using Continue follow the existing store rules. Reload restores the selected card.
    - [ ] MODEL-ART-3: The slot supports both image forms at the existing inner width and 60% height within 1px, including before load and after a forced failed image request. The accessibility tree exposes no artwork. In 320px, RTL and long-label cases, text and actions fit without horizontal overflow. At 200% zoom, in forced colours and with reduced motion, actions and the selected status remain legible and focus is visible. Keep the existing card geometry comparison and axe assertions.
    - [ ] MODEL-ART-4: Stories show both image forms and the selected marker, retain the native controls and pass three-browser story smoke and axe.
- **Verification:** `bun test tests/model-catalogue.test.ts`, `bun run test:e2e tests/models-setup.e2e.ts`, `bun run test:e2e tests/model-card.e2e.ts`, `bun run test:e2e tests/model-configuration.e2e.ts`, `bun run test:e2e tests/a11y.e2e.ts`, `bun run test:e2e tests/visual-parity.e2e.ts`, `bun test tests/style-tokens.test.ts`, `bun run storybook:build`, `bun run test:stories`, manual keyboard, zoom and screen-reader checks.
- **Progress:** [ ] Not started

### T3 — Sync specification

- **Depends on:** T1, T2
- **Risk:** routine
- **Likely files:** `specification/ARCHITECTURE.md`, `specification/workflow-steps.md`, `specification/components/card.md`, `specification/visual-design.md`, `specification/HUMAN.md`, `specification/README.md`, `specification/COMPONENTS.md`, `specification/TODO.md`, `specification/FUTURE.md`, `specification/testing.md`
- **Must not touch:** `src/`, `public/`, `specification/mockups/`
- **Implementation:** Apply the lasting rules and queue changes in Specification changes. Preserve
  the original reference mockups and update the existing deviation entry.
- **Acceptance criteria:**
    - [ ] All listed specifications agree on the card slots, current selection, catalogue coverage and production SVG path rules. Statuses and the human queue agree with shipped behaviour.
- **Verification:** `bun run plans:check specification/plans/model-artwork-and-svg-optimisation.md`, `bun run check`, `bun run build`, `bun run format:check <changed files>`
- **Progress:** [ ] Not started

## Verification and definition of done

- [ ] All task acceptance criteria met.
- [ ] Relevant verification commands from `AGENTS.md` pass with no new failures.
- [ ] Type-check, formatting and build checks pass.
- [ ] Accessibility (WCAG 2.2 AA), privacy/security and contract-compatibility checks completed where applicable.
- [ ] Every item under _Specification changes_ is ticked, and specifications match the implemented code.
- [ ] No unintended changes outside the tasks' likely files.

## Risks and open questions

- **Blocking:** None
- **Non-blocking:** Browser rasterisation can differ slightly after path optimisation. T1 compares source and output at two sizes and checks for perceptible regressions.

## Escalations

None.

## Review fixes

None.

## Implementation and verification log

| When (UTC) | Task | Agent (model) | Outcome / commands / evidence |
| ---------- | ---- | ------------- | ----------------------------- |
| —          | —    | —             | Not started                   |

## Plan review history

| Reviewed (UTC)       | Agent (model) | Decision          | Findings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------- | ------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-24T08:32:12Z | Codex (GPT-6) | changes-requested | MAJOR T2: define the replacement button names and heading descriptions, and specify whether Logistic Regression card copy is retained. Existing text-entry names include the model and card names do not (app-model-builder-view.ts:1106–1157, app-model-card.ts:93–105). MAJOR MODEL-ART-1: text and datetime are rejected by the target action and reconciler, so define isolated fixtures without changing eligibility. Clarify MODEL-ART-2 keyboard versus pointer focus restoration because the dialog restores the previously focused element. MAJOR T3: reconcile the express non-goals in components/card.md §11 and stale artwork and story coverage in FUTURE.md, TODO.md and testing.md. T1: make the numeric raster check repeatable and clarify uppercase file MIME scope. |
| 2026-11-24T08:38:30Z | Codex (GPT-6) | approved          | Reviewed T1–T3 with independent scout evidence. The nine assets, recursive production copy, preserved development paths, eight-card catalogue, component events and selection, accessible names and focus, and existing journey, Storybook and parity contracts align. The revised tests cover malformed SVGs, raster fidelity and reachable target states. No blocking findings.                                                                                                                                                                                                                                                                                                                                                                                                       |

## Change log

| When (UTC)           | Change               | Reason                                                                                                                                                                      |
| -------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-24T08:25:54Z | Initial draft        | Use the supplied model SVGs and add production SVG optimisation.                                                                                                            |
| 2026-11-24T08:33:40Z | Address first review | Specify model-specific accessible names and keyboard focus restoration, test reachable target states, document the reproducible SVG comparison and reconcile related specs. |
