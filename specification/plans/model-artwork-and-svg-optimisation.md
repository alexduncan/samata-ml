# Model artwork and production SVG optimisation

**Status:** implemented | **Updated:** 2026-11-24T15:14:25Z
**Authors:** Codex (GPT-6) | **Created:** 2026-11-24T08:25:54Z
**Verified by:** Codex (GPT-6) | **Verified:** 2026-11-24T08:54:35Z | **Verification:** approved
**Verified hash:** sha256:a3c949f20e846b2f7f0f798ab6eee416f26bcc35ff2e9b9b1077426b245e7b75
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
  The beta release keeps SVGs in revalidating `/assets/` and reserves immutable `/bundles/` for
  generated bundles. Preserve the existing release ID and bundle hashing inputs.

## Required reading

- `AGENTS.md` — repository boundary, verification commands and visual fidelity.
- `specification/ARCHITECTURE.md` — directory structure and asset delivery, including the release
  metadata and cache rules when the beta build is present.
- `specification/standards-and-documentation.md` — TSDoc for exported TypeScript and the beta lint gate.
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
  (`scripts/filesystem.ts` lines 16–33). In beta tip `13b3b4b`, `scripts/build-assets.ts` lines
  162–190 share that copy in `runBuild`, and lines 322–346 generate release outputs later.
  `scripts/release-headers.ts` lines 116–123 and 163–171 give `/assets/` the default revalidation
  policy and keep immutable caching for generated bundle and runtime paths. The static server
  recognises `.svg` and applies the generated header rules only in production mode.
- **Tests and commands:** `tests/models-setup.e2e.ts`, `tests/model-card.e2e.ts` and
  `tests/visual-parity/map.ts` cover chooser interactions, card behaviour and parity.
  `tests/model-catalogue.test.ts` covers all five column types. On the pre-beta baseline,
  `bun run check` passed 586 tests and `bun run build` passed. A temporary merge preview of
  `main` at `fc42384` and `beta_release_cicd` at `13b3b4b` retained all nine SVGs and passed
  `bun run build`, `bun run lint`, `bun run check` (629 tests) and all seven cases in
  `tests/build-cache-invalidation.test.ts`. The emitted header resolver confirmed revalidation for
  all nine paths. The preview’s `bun run test:stories` passed 600 tests and the Chromium
  `PARITY-models-card` check passed. The beta branch on its own predates the eight classifier files.
  The static `bun run storybook:build` fails on both the pre-beta baseline and the merge preview:
  the sidebar story at `src/features/shell/app-sidebar.stories.ts` line 6 imports
  `tests/visual-parity/fixtures.ts`, whose line 92 dynamically imports Node-only `scripts/ports.ts`.
  The production Storybook bundler follows the import and rejects `lstatSync` in the browser bundle.
  T2 removes this dependency from the shared fixture. A scratch SVGO 4.1.0 run at precision 6 processed all nine
  SVGs, reducing the aggregate size from 43,915 to 31,646 bytes. The outputs retained their
  intrinsic dimensions and viewBox. Chromium decoded and compared all pairs at 360×216 and 720×432.
- **Web guidance:** `accessibility` §6 and `html` §§1, 3 — use empty alternative text for
  decorative images and declare dimensions to reserve space.
- **Visual reference:** `specification/mockups/03-2_train-models-1-choose-model.html`,
  `section.cards > article.card` with `svg.card-image`. In the app the builder uses
  `.cards-grid` and each card uses `article.card` with a `.card-image` slot wrapper. Record the
  eight-card expansion, supplied artwork and selected marker in MODELS-UI-03.
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
  output setup. On the beta build, the same-origin SVG requests use the existing image CSP and
  `Cache-Control: public, max-age=0, must-revalidate` from the production default rule.

### Integration with the beta release

- If beta lands first, implement T1 at the shared copy site and T2 with the existing TSDoc
  configuration. Apply the beta-specific acceptance criteria as part of implementation.
- If the SVG implementation lands first, resolve the beta integration against its shared
  `runBuild`. Carry the existing SVG helper into its production copy path, retain the ordinary
  development copy and confirm the optimised SVGs use the active `outDir`. Enable the production
  cache assertion in the existing SVG browser test and add the `@slot` definition when
  `tsdoc.json` arrives. Preserve both branches’ story fixture changes. Before landing the
  combined code, rerun the SVG build, cache and browser checks from T1, plus beta lint, Storybook
  build, story smoke and model-card parity from T2.

## Specification changes

- [x] `specification/ARCHITECTURE.md` — Production public-file delivery includes SVG optimisation for lowercase `.svg` files with stable URLs and authored sources. With beta release delivery, integrate this rule into the public-file layout and retain the release header and caching rules. Status partial → partial.
- [x] `specification/workflow-steps.md` §3.1 — Each of the eight classifiers has a mapped illustration, with the current selection conveyed visibly and programmatically. Status partial → partial.
- [x] `specification/components/card.md` §§2–9, 11 — Document both decorative slot forms, the selected property and marker, model-specific accessible button names, geometry, acceptance tests and model-card stories. Update §11 to allow the defined model selected state and required empty `alt` on the decorative `img`. Keep the dataset-card contract. Status implemented → implemented.
- [x] `specification/visual-design.md` §5.3 — MODELS-UI-03 records eight illustrated cards, the supplied art and current-selection marker with 03-2 as the per-card geometry reference. Status partial → partial.
- [x] `specification/HUMAN.md` — Close the model text-entry styling and optional illustration queue items when the illustrated chooser replaces the text entries. Keep the draft mockup file as a historical reference.
- [x] `specification/TODO.md` TODO-07 — Replace the Logistic-only and text-entry details with the eight illustrated classifiers and reference the current workflow specification.
- [x] `specification/FUTURE.md` §2 — Remove the completed deferred classifier illustration and text-entry replacement item.
- [x] `specification/testing.md` — Record model card and chooser story coverage in the coverage boundary. Status partial → partial.
- [x] `specification/README.md` and `specification/COMPONENTS.md` — Check status alignment and known gaps. Scope broader story and contrast gaps to outstanding work if needed.

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
  Report read or optimisation errors with the source path relative to `sourceDir`. Add TSDoc
  for the exported helper and describe the copier’s new callback. In the original separate build
  functions, replace the public copy inside `buildProductionBundle` only. In the beta build,
  replace the public copy in `runBuild` with `isProd` dispatch at the same stage after the output
  reset and runtime copy and before content and dataset generation. Pass the active `outDir`
  including overrides in both branches; the beta `assetOutDir` is for generated bundles. Keep
  development and other callers on the ordinary copy. The copy helper preserves bytes for
  non-SVG inputs, and the beta build continues generating `_headers`, `robots.txt` and
  `release.json` in its existing later stages.
- **Acceptance criteria:**
    - [x] SVG-BUILD-1: All nine supplied SVGs, including Linear Regression, are emitted under unchanged paths. Inputs remain byte-for-byte identical. The SVG collection shrinks in aggregate, and no individual output grows.
    - [x] SVG-BUILD-2: A scratch public tree with a nested SVG containing a removable comment and a non-SVG peer proves recursive optimisation and exact non-SVG copying. The default copy preserves SVG bytes; malformed SVG input makes the production transform reject with the source-relative path and cause.
    - [x] SVG-BUILD-3: Both `APP_URL` and `DIST_URL` return the nine URLs successfully as `image/svg+xml`. In the Chromium project, fetch the response bytes from both servers with Playwright's request fixture. Pass the bytes into a blank page as base64 data URLs, decode with `Image.decode()` and check intrinsic dimensions of 360×216. Draw each pair onto separate transparent canvases at 360×216 and 720×432. Compare same-position RGBA values from `getImageData()` and count a pixel once if any channel differs by more than 24. Require the count divided by total pixels to be at most 0.002 at each size. Inspect the source and production images side by side for clipping, missing geometry or colour changes, including Linear Regression’s internal reference.
    - [x] SVG-BUILD-4: With the beta build present, the configured production output directory contains the same root-relative public paths and keeps SVGs outside `bundles/`. Each SVG response from `DIST_URL` has the exact revalidation policy in Interfaces and behaviour. The beta build-cache suite still verifies the release ID, generated bundles and header rules.
- **Verification:** `bun test tests/public-svg-build.test.ts`, `bun run build`, `bun run test:e2e tests/public-svg-assets.e2e.ts`, manual browser inspection of original and production SVGs at both sizes. With the beta build present, also run `bun test tests/build-cache-invalidation.test.ts` and the beta repository lint gate `bun run lint`.
- **Progress:** [x] Completed (2026-11-24T13:29:02Z)

### T2 — Render the supplied artwork on each classifier card

- **Depends on:** T1
- **Risk:** needs care — selector collisions and lost selection feedback are possible when the chooser moves to eight card instances.
- **Likely files:** `src/features/models/app-model-builder-view.ts`, `src/features/models/app-model-builder-view.stories.ts`, `src/features/models/app-model-card.ts`, `src/features/models/app-model-card.stories.ts`, `src/styles/card.styles.ts`, `tests/models-setup.e2e.ts`, `tests/model-card.e2e.ts`, `tests/model-configuration.e2e.ts`, `tests/a11y.e2e.ts`, `tests/visual-parity.e2e.ts`, `tests/visual-parity/fixtures.ts`, `tests/visual-parity/map.ts`, `tsdoc.json`
- **Must not touch:** `public/`, `src/features/models/model-catalogue.ts`, `src/stores/`, `src/workers/`, `vendor/`, `specification/mockups/`
- **Implementation:** Replace the inline Logistic Regression template and text-entry branch with
  one illustrated list driven by the existing catalogue and exhaustive URL map. Wire the two
  existing card listeners to their existing handlers and retain ID-based selection. Implement
  the defined slot and selected-state API, add the `@slot image` TSDoc to `AppModelCard`, and
  preserve the original inline SVG form. When the beta lint configuration is present, add
  `{ "tagName": "@slot", "syntaxKind": "block", "allowMultiple": true }` to `tsdoc.json`
  alongside `@fires` so the CEM annotation passes lint. Leave the pre-beta build free of a new
  lint configuration. Remove chooser-only text-entry styles and messages only where now unused.
  Update chooser locators to scope by `model-id` in existing tests and move the existing parity
  card selector to Logistic Regression explicitly. Compare the same card shell properties.
  Restore the static Storybook build by changing the shared fixture API to
  `prepareSidebarReference(page: Page, fixture: 'empty' | 'models', mockupsUrl: string): Promise<void>`.
  Pass the existing `MOCKUPS_URL` at all four calls in `tests/visual-parity.e2e.ts`. Remove the
  dynamic port-module import from the shared fixture. Preserve its reduced-motion setup and
  exact `?clean=1` navigation targets.
  Update chooser stories for the illustrated list and selected and numeric unsupported examples
  using the existing builder seed. Extend the seed for a Boolean story with Boolean target metadata
  in both persisted summary and ready state. Use an empty completion list and a null model ID for
  an unselected chooser. On the beta branch’s code, preserve `betaTelemetryAccepted: false` in the
  chooser seed and the existing persistence wait in the browser flow. For the Boolean browser
  journey use the existing CSV upload flow with a Boolean column containing both true and false
  values and a varying numeric feature. Add model-card stories for all three type variants, both image forms,
  selected and unselected, long label, narrow, grid and RTL. Use one actual `public/assets` image,
  existing Storybook Vite public-file delivery and CEM controls. Put the slot usage rules in the
  Docs description.
- **Acceptance criteria:**
    - [x] MODEL-ART-1: Categorical and Boolean chooser fixtures show exactly eight cards in catalogue order, with one correctly mapped decorative image each. The card images decode at 360×216. The numeric-target browser flow still reaches the no-candidate notice and shows zero cards. Use `tests/model-catalogue.test.ts` to verify the empty lists for text and datetime, which the target actions and hydration exclude before the builder. Keep both target-selection restrictions.
    - [x] MODEL-ART-2: Assert the exact model-specific accessible name of each button and the original visible action labels. Open a non-Logistic description with the keyboard, dismiss it and verify focus returns to the invoking button. Verify that pointer activation opens the same description and preserves native focus behaviour. Selecting a model marks only that model with visible `Selected` and `aria-current="true"`, and keeps Section 1 active. Re-selecting the current model leaves the selection and existing setup data intact. Selecting a different model and using Continue follow the existing store rules. Reload restores the selected card.
    - [x] MODEL-ART-3: The slot supports both image forms at the existing inner width and 60% height within 1px, including before load and after a forced failed image request. The accessibility tree exposes no artwork. In 320px, RTL and long-label cases, text and actions fit without horizontal overflow. At 200% zoom, in forced colours and with reduced motion, actions and the selected status remain legible and focus is visible. Keep the existing card geometry comparison and axe assertions.
    - [x] MODEL-ART-4: Stories show both image forms and the selected marker, retain the native controls and pass three-browser story smoke and axe. The static Storybook build succeeds with the actual SVG in its output. The four affected parity calls still load the same references with the checkout-scoped URL. On the beta build, TSDoc lint accepts the card slot annotation.
- **Verification:** `bun test tests/model-catalogue.test.ts`, `bun run test:e2e tests/models-setup.e2e.ts`, `bun run test:e2e tests/model-card.e2e.ts`, `bun run test:e2e tests/model-configuration.e2e.ts`, `bun run test:e2e tests/a11y.e2e.ts`, `bun run test:e2e tests/visual-parity.e2e.ts`, `bun test tests/style-tokens.test.ts`, `bun run storybook:build`, `bun run test:stories`, manual keyboard, zoom and screen-reader checks. Require the `PARITY-models-card` case to pass explicitly using `bun run test:e2e tests/visual-parity.e2e.ts --project=chromium --grep PARITY-models-card`. On pre-beta code, compare any unrelated failures in the full parity file with the pre-task baseline. On beta, run the full parity file with the existing `SAMATA_SKIP_KNOWN_FAILURES=1 bun run test:e2e tests/visual-parity.e2e.ts` and confirm the model-card case remains active. Run `bun run lint` with the beta lint configuration.
- **Progress:** [x] Completed (2026-11-24T13:40:20Z)

### T3 — Sync specification

- **Depends on:** T1, T2
- **Risk:** routine
- **Likely files:** `specification/ARCHITECTURE.md`, `specification/workflow-steps.md`, `specification/components/card.md`, `specification/visual-design.md`, `specification/HUMAN.md`, `specification/README.md`, `specification/COMPONENTS.md`, `specification/TODO.md`, `specification/FUTURE.md`, `specification/testing.md`
- **Must not touch:** `src/`, `public/`, `specification/mockups/`
- **Implementation:** Apply the lasting rules and queue changes in Specification changes. Preserve
  the original reference mockups and update the existing deviation entry. When the beta
  architecture description is present, extend it with the SVG rule. Close only the illustration
  and text-entry items in the human queue.
- **Acceptance criteria:**
    - [x] All listed specifications agree on the card slots, current selection, catalogue coverage and production SVG path rules. Statuses and the human queue agree with shipped behaviour.
- **Verification:** `bun run plans:check specification/plans/model-artwork-and-svg-optimisation.md`, `bun run check`, `bun run build`, `bun run format:check <changed files>`
- **Progress:** [x] Completed (2026-11-24T13:41:39Z)

## Verification and definition of done

- [x] All task acceptance criteria met.
- [x] Relevant verification commands from `AGENTS.md` pass with no new failures.
- [x] Type-check, formatting and build checks pass. If the beta release code is present, its
      TSDoc lint and build-cache regression checks also pass under that checkout’s `AGENTS.md`.
- [x] Accessibility (WCAG 2.2 AA), privacy/security and contract-compatibility checks completed where applicable.
- [x] Every item under _Specification changes_ is ticked, and specifications match the implemented code.
- [x] No unintended changes outside the tasks' likely files.

## Risks and open questions

- **Blocking:** None
- **Non-blocking:** Browser rasterisation can differ slightly after path optimisation. T1 compares source and output at two sizes and checks for perceptible regressions. The beta check is provisional against `13b3b4b`. Apply the appropriate integration procedure and verify the combined contract before landing both changes.

## Escalations

- [x] **E1 (R2):** Two independent closure rounds are complete. SVG-BUILD-2 requires the production helper to reject malformed public SVG with its public-relative path and underlying error. R1 added strict UTF-8 decoding and XML parsing with an SVG root check. On `a901a4173714afb1bf6c966a88bf21602841a68d`, the helper still accepts `<svg xmlns="http://www.w3.org/2000/svg" xmlns:a="urn:example" xmlns:b="urn:example" a:x="a" b:x="b"/>` at `nested/probe.svg` and emits identical bytes. The two attributes have the same namespace URI and local name. Python ElementTree and the XML parser in Chromium, Firefox and WebKit report a duplicate attribute, and all three browsers reject image decoding. A control using different namespace URIs parses and renders. The production build can therefore publish broken artwork while reporting success. The nine current assets pass. On 2026-11-24 the maintainer directed “Authorise one more repair and audit”. This authorises the scoped R2 repair and one fresh independent closure audit. Closure remains blocked until R2 is verified. [Namespaces in XML §6.3](https://www.w3.org/TR/xml-names/#uniqAttrs) · [SVG 2 §5.1.2](https://www.w3.org/TR/SVG2/struct.html)
- [x] **E2 (R3):** The extra independent audit verified E1 and found a separate violation of the public SVG contract. At `5430cf4f8b4647cfbbff81ec3bb950ca892b1348`, put `<!DOCTYPE svg [<!ATTLIST svg xmlns CDATA "http://www.w3.org/2000/svg">]><svg width="40" height="24"><title>Example</title><rect width="40" height="24" fill="red"/></svg>` in `nested/fixture.svg`. The public-file helper accepts the source, then emits `<svg width="40" height="24"><title>Example</title><path fill="red" d="M0 0h40v24H0z"/></svg>`. Chromium, Firefox and WebKit identify the source root in the SVG namespace, decode it at 40×24 and render an opaque red interior pixel. The output root has no namespace and all three browsers reject image decoding. With explicit `xmlns` and an internal DTD that defaults a rectangle’s `width`, both images decode but the same pixel changes from opaque red to transparent in all three engines. The original optimiser settings also drop these DTD defaults after R1 validation. Separately, R2 introduces a parser depth limit. An explicit-namespace SVG with 200 nested `g` elements around the same rectangle renders in all three engines and passes the predecessor parser and optimiser. R2 rejects it with `Limit exceeded`. The nine supplied illustrations are unaffected. On 2026-11-24 the maintainer directed retaining the document type declaration, using real repository artwork as the compatibility baseline, and excluding the 200-level nesting probe from release checks. The maintainer authorised R3 and a fresh independent closure audit.

## Review fixes

- [x] **R1** `scripts/build-public-assets.ts` `copyOptimisedPublicFiles` — SVG-BUILD-2 requires malformed SVG inputs to fail with a public-relative path and underlying cause. Validate that the original input is a well-formed XML document with one SVG root before passing it to the existing optimiser. Test: Cover empty input, multiple roots, a non-SVG root and malformed XML around or within a namespaced SVG root in `tests/public-svg-build.test.ts`. Require each rejection to identify the nested public-relative path and retain an underlying `Error`. Keep valid standalone SVGs and the existing asset regressions passing.
- [x] **R2** `scripts/build-public-assets.ts` `copyOptimisedPublicFiles` — SVG-BUILD-2 requires rejecting malformed stand-alone public SVG. Validate the source with namespace-aware XML checks before SVGO can emit the document. The scope includes the production helper, `tests/public-svg-build.test.ts` and, if needed for a pinned development-only XML parser, `package.json` and `bun.lock`. Test: Add a nested input with the same local attribute name under two prefixes for one URI. Verify the wrapped error names the public-relative path, retains the underlying error and leaves no output file. Verify that attributes sharing a local name under different namespace URIs are accepted. Keep the R1, SVG byte and raster, and release cache checks passing.

- [x] **R3** `scripts/build-public-assets.ts` `copyOptimisedPublicFiles` — Preserve the document type declaration by disabling only `removeDoctype` in SVGO’s default preset. Scope includes the production helper and `tests/public-svg-assets.e2e.ts`. Test: Use the production helper on one temporary browser fixture whose DTD supplies the SVG namespace and a visible rectangle’s width. Verify it decodes and renders before and after optimisation. Keep the existing malformed-input, repository artwork size, raster and cache checks passing. The maintainer excluded the 200-level nesting probe from the plan’s release checks.

## Implementation and verification log

| When (UTC)           | Task      | Agent (model) | Outcome / commands / evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------- | --------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| —                    | —         | —             | Not started                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-11-24T13:29:02Z | T1        | Codex (GPT-6) | bun add --dev --exact svgo@4.1.0; bun run check (627 passed); bun test tests/public-svg-build.test.ts (3 passed); bun test tests/build-cache-invalidation.test.ts (7 passed); bun run build and bun run lint passed; bun run test:e2e tests/public-svg-assets.e2e.ts --workers=2 (4 passed, 2 Chromium-only skips). Visually compared all nine source and production pairs at 360×216 and 720×432, including Linear Regression. Total 43,915 → 31,646 bytes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-11-24T13:40:20Z | T2        | Codex (GPT-6) | bun test tests/model-catalogue.test.ts tests/style-tokens.test.ts (10 passed); bun run test:e2e tests/models-setup.e2e.ts tests/model-card.e2e.ts tests/model-configuration.e2e.ts tests/a11y.e2e.ts --workers=2 (127 passed, 2 Chromium-only skips); bun run test:e2e tests/visual-parity.e2e.ts --project=chromium --grep PARITY-models-card (1 passed); SAMATA_SKIP_KNOWN_FAILURES=1 bun run test:e2e tests/visual-parity.e2e.ts --workers=2 (60 passed, 138 skips under Chromium-only/known-failure rules; card active and passed); bun run storybook:build (static SVG matches original; CEM exposes image slot); bun run test:stories (660 passed); bun run check (627 passed), bun run lint and format check passed. Native Safari at 200% verified keyboard selection, visible focus and marker, Escape restoring description focus, named buttons and decorative image omission from the accessibility tree. Spoken VoiceOver output was unavailable; tree inspection and browser assertions are the recorded evidence. |
| 2026-11-24T13:41:39Z | T3        | Codex (GPT-6) | bun run plans:check passed for plan and specification index; bun run check passed 627 tests; bun run build passed and emitted production /assets/ SVGs; bun run format:check passed for all ten specs and the plan. Updated MODELS-UI-03 and closed the two artwork and text-entry queue items. Reference mockups were preserved.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-11-24T13:42:07Z | Implement | Codex (GPT-6) | Marked implemented                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-11-24T13:46:04Z | Review    | Codex (GPT-6) | Independently audited `3a73aa1886a3eb181157224894f8c162e129b9d1` against `9d73b710bb5c5fefc720ef831c3340c0e52a9c06`. Approval and completion gates matched before R1. Reproduced SVG-BUILD-2 failures with `bun -e` invoking the production helper on nested temporary files. It delivered zero bytes, two SVG roots and an HTML root. It accepted trailing `<`, an unclosed comment, duplicate attributes and undeclared `&copy;` in namespaced SVGs. The mismatched-tag control rejected with the relative path and `SvgoParserError`. Validate input because SVGO can discard the malformed content. Added R1 and left the plan implemented.                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-11-24T13:46:04Z | Review    | Codex (GPT-6) | `bun run check` passed 627 tests with loopback access. `bun run lint`, `bun run build`, `bun run storybook:build` and formatting passed. SVG, build-cache, catalogue and style-token units passed 20 cases. Targeted Playwright acceptance passed 131 with four Chromium-only skips. Focused Chromium model-card parity passed. Nine SVGs passed headers, raster tests and visual comparison at both sizes, saving 12,269 bytes. Chooser and accessibility changes match the approved scope. The recorded manual Safari checks relied on the accessibility tree because spoken VoiceOver was unavailable.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-11-24T13:50:30Z | R1        | Codex (GPT-6) | Reproduced 9 failures before the fix. The existing Bun 1.4.3 runtime validates UTF-8, XML well-formedness and a standalone root in the SVG namespace before SVGO. Tests retain the nested path and error cause, check no invalid file is emitted, and accept an explicitly prefixed SVG. bun test tests/public-svg-build.test.ts (13 passed); bun run check (637 passed); bun test tests/build-cache-invalidation.test.ts (7 passed); bun run build and bun run lint passed; bun run test:e2e tests/public-svg-assets.e2e.ts --workers=2 (4 passed, 2 Chromium-only skips); totals remain 43,915 → 31,646 bytes. Scope passed with one warning for the regression test that R1 explicitly requests.                                                                                                                                                                                                                                                                                                                              |
| 2026-11-24T13:53:45Z | Review    | Codex (GPT-6) | Second independent closure audit of `a901a4173714afb1bf6c966a88bf21602841a68d` against `9d73b710bb5c5fefc720ef831c3340c0e52a9c06`. The approval fingerprint, task completion at the audited commit and plan/spec index validation passed. `bun run check` passed 637 tests. The focused SVG, cache, catalogue and token units passed 30 tests. `bun run build` and `bun run lint` passed. SVG, chooser and card Playwright suites passed 29 with four declared Chromium-only skips. Focused Chromium model-card parity passed. The nine SVGs still total 43,915 → 31,646 bytes. The actual production helper reproduced E1. All originally reported malformed inputs now reject. The maintainer authorised R2 and one fresh closure audit after the second round.                                                                                                                                                                                                                                                                |
| 2026-11-24T13:58:07Z | R2        | Codex (GPT-6) | Both duplicate expanded-name inputs were accepted before the repair and now reject with the public-relative path and cause, leaving no output file. The distinct-URI control and internal-entity title pass. The namespace-aware parser is pinned at @federicocarboni/saxe 0.8.0 as a build-only dependency, with internal DTD processing and no external entity fetch. bun test tests/public-svg-build.test.ts (19 passed); bun run check (643 passed); bun test tests/build-cache-invalidation.test.ts (7 passed); bun run build and bun run lint passed; bun run test:e2e tests/public-svg-assets.e2e.ts --workers=2 (4 passed, 2 Chromium-only skips). Scope passed with three warnings for the test and dependency paths explicitly named by R2.                                                                                                                                                                                                                                                                            |
| 2026-11-24T14:03:20Z | Review    | Codex (GPT-6) | Audited `5430cf4f8b4647cfbbff81ec3bb950ca892b1348` against `9d73b710bb5c5fefc720ef831c3340c0e52a9c06`. Approval, task completion at the audited commit and plan/index checks passed. A fresh scout ran `bun test tests/public-svg-build.test.ts` (19 passed). `bun run check` passed 643. `bun test tests/build-cache-invalidation.test.ts tests/model-catalogue.test.ts tests/style-tokens.test.ts` passed 17. `bun run lint`, `bun run build` and Prettier on changed Markdown, TypeScript and JSON passed. Prettier has no parser for the Bun lockfile. `bun run test:e2e tests/public-svg-assets.e2e.ts --workers=2` passed 4 with 2 declared Chromium-only skips. The nine images still total 43,915 → 31,646 bytes.                                                                                                                                                                                                                                                                                                        |
| 2026-11-24T14:03:20Z | Review    | Codex (GPT-6) | Independent production-helper probes rejected the E1 root and nested duplicate names, including equivalent character references, and R1 malformed inputs with path, cause and absent output. The distinct-namespace, rebound-prefix and title-entity controls passed. Chooser code, specs and tests are unchanged from the preceding audits. Native Safari zoom and keyboard checks use the earlier evidence. Spoken VoiceOver output remains unavailable. Reproduced E2 through the production helper and all three browser engines. The plan remains implemented pending a maintainer decision.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-11-24T15:12:04Z | R3        | Codex (GPT-6) | The focused DOCTYPE render case failed on the original build with image decoding errors in Chromium, Firefox and WebKit and passed in all three with the SVGO preset override. bun run test:e2e tests/public-svg-assets.e2e.ts --workers=2 passed 7, with 2 declared Chromium-only raster skips. bun run check passed 643. bun test tests/public-svg-build.test.ts tests/build-cache-invalidation.test.ts passed 26, including malformed-input and cache controls. bun run build, bun run lint, formatting and plan checks passed. Recorded the maintainer scope in E2 and removed its resolved HUMAN queue item.                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-11-24T15:14:25Z | Review    | Codex (GPT-6) | Independently audited R3 at `22e2ca9ef232ead6da0fe20c7f3a4224f123fa76` against E2 at `cf7b5ca8cbb1b9d1a2a5dacb9ad6eeb5246e43f5` and the full plan base `9d73b710bb5c5fefc720ef831c3340c0e52a9c06`. The only production change disables `removeDoctype` in SVGO’s default preset. The actual production copy preserved both DTD defaults. Chromium, Firefox and WebKit decoded the authored and optimised fixture at 40×24 and rendered the same opaque red pixel. `bun run test:e2e tests/public-svg-assets.e2e.ts --workers=2` passed 7 tests with 2 expected Chromium-only raster skips. `bun test tests/public-svg-build.test.ts tests/build-cache-invalidation.test.ts` passed 26, including malformed-input, repository artwork and release cache checks. `bun run check` passed 643. `bun run lint`, `bun run build`, formatting, plan and specification index validation and task completion passed. The original approval fingerprint matches.                                                                           |
| 2026-11-24T15:14:25Z | Review    | Codex (GPT-6) | The diff and T1–T3 review confirm the scoped build, component, test and specification changes. Public component and build contracts match Interfaces and behaviour. Authored art, reference mockups, upstream model contracts and catalogue, stores, workers and beta cache contracts are preserved. The unchanged chooser uses the earlier acceptance, parity, Storybook, axe and native Safari evidence. The earlier visual comparison covered all nine source and production illustrations at 360×216 and 720×432. Spoken VoiceOver output was unavailable and the recorded checks used Safari’s accessibility tree. The maintainer set repository artwork as the compatibility baseline and excluded the 200-level nesting probe in E2. The SVGO and ARIA references remain in Technical decisions, and the XML sources are recorded in E1. T1–T3 are at `9a6b707`, `4142d09` and `908bf3c`. R1–R3 are at `a901a41`, `5430cf4` and `22e2ca9`. No repository-specific decision checklist is present.                          |

## Plan review history

| Reviewed (UTC)       | Agent (model) | Decision          | Findings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------- | ------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-24T08:32:12Z | Codex (GPT-6) | changes-requested | MAJOR T2: define the replacement button names and heading descriptions, and specify whether Logistic Regression card copy is retained. Existing text-entry names include the model and card names do not (app-model-builder-view.ts:1106–1157, app-model-card.ts:93–105). MAJOR MODEL-ART-1: text and datetime are rejected by the target action and reconciler, so define isolated fixtures without changing eligibility. Clarify MODEL-ART-2 keyboard versus pointer focus restoration because the dialog restores the previously focused element. MAJOR T3: reconcile the express non-goals in components/card.md §11 and stale artwork and story coverage in FUTURE.md, TODO.md and testing.md. T1: make the numeric raster check repeatable and clarify uppercase file MIME scope.                                |
| 2026-11-24T08:38:30Z | Codex (GPT-6) | approved          | Reviewed T1–T3 with independent scout evidence. The nine assets, recursive production copy, preserved development paths, eight-card catalogue, component events and selection, accessible names and focus, and existing journey, Storybook and parity contracts align. The revised tests cover malformed SVGs, raster fidelity and reachable target states. No blocking findings.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-11-24T08:48:36Z | Codex (GPT-6) | changes-requested | MAJOR T2: the required static Storybook build fails on main and the beta preview. The sidebar story imports tests/visual-parity/fixtures.ts, whose dynamic scripts/ports.ts dependency pulls node:fs into Vite. Pass the checkout mockup URL from all four Playwright callers, scope the helper in T2 and retain the Storybook and parity gates. MAJOR T2: the beta TSDoc gate rejects the proposed @slot (tsdoc-undefined-tag); register it in tsdoc.json alongside @fires and verify manifest metadata and lint. MAJOR T1: the Risks section gates for beta-first only; require the beta integration to retain the production transform at the shared runBuild copy stage and rerun SVG, build-cache and lint gates when SVG lands first. MINOR: correct the 03-2 mockup locators to section.cards and article.card. |
| 2026-11-24T08:54:35Z | Codex (GPT-6) | approved          | Independently reviewed T1–T3 against main 1a7f6ab and provisional beta_release_cicd 13b3b4b. Scout confirmed the production copy and cache contracts, both landing orders, beta TSDoc registration, all four checkout URL consumers and active model-card parity. Reproduced the inherited Storybook failure and verified the T2 repair scope. No blockers.                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

## Change log

| When (UTC)           | Change                       | Reason                                                                                                                                                                      |
| -------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-24T08:25:54Z | Initial draft                | Use the supplied model SVGs and add production SVG optimisation.                                                                                                            |
| 2026-11-24T08:33:40Z | Address first review         | Specify model-specific accessible names and keyboard focus restoration, test reachable target states, document the reproducible SVG comparison and reconcile related specs. |
| 2026-11-24T08:43:58Z | Invalidated approval         | Specify compatibility with the pending beta release build, asset cache rules and CI verification gates.                                                                     |
| 2026-11-24T08:45:19Z | Reconcile pending beta build | Define the production copy hook for both build layouts, existing cache rules, release regression checks and beta test fixture compatibility.                                |
| 2026-11-24T08:50:09Z | Address beta review          | Include the inherited Storybook fixture repair, beta TSDoc slot registration, both integration orders and parity verification.                                              |
