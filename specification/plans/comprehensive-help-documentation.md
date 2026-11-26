# Comprehensive Plain-English Help Documentation System

**Status:** ready-for-review | **Updated:** 2026-11-26T17:51:47Z
**Authors:** Google Antigravity (Gemini 4 Neon High) | **Created:** 2026-11-26T17:46:20Z
**Verified by:** — | **Verified:** — | **Verification:** pending
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour:** In-app educational documentation is sparse and flat. `content/en/pages/` holds seven flat pages (`help.md`, `select-features.md`, `configure-model.md`, `training-setup.md`, plus `about.md`, `privacy-policy.md`, and `terms-and-conditions.md`); `content/en/models/` contains only a two-link stub (`logistic-regression.md`); and `content/en/glossary/` is empty. `scripts/build-content.ts` only permits flat domains `['pages', 'models', 'glossary']` and rejects nested directories or co-located SVG assets. `src/common/content/fragment-policy.ts` (`isAllowedHref`) strips root-absolute internal links (`/help/...`), preventing articles from cross-linking. `src/router/reserved-content.ts` supports only six hardcoded `ReservedPath` values and replaces history on modal switches, giving learners no Back/Forward trail or breadcrumbs. Model descriptions open in a separate transient `<app-model-description-dialog>` with no URL routing, and `<app-model-configuration>` displays only one-sentence inline hints with no per-hyperparameter Help links. An example article (`content/en/help/mlp/activation.md` with five co-located SVGs) cannot currently build, contains US spellings and an H1→H3 skip, has a `TODO_LINK_TO_MLP_OVERVIEW_DOC` placeholder, and uses inline `style="..."` on `<svg>` elements that violates production CSP `style-src-attr 'none'`.

**Target behaviour:** `samata-ml` provides a comprehensive, accessible, plain-English, SVG-illustrated Help knowledge base structured hierarchically under `/help/...`, governed by a formal documentation standard (`specification/documentation-standard.md`) and enforced by an automated build and quality evaluator (`scripts/evaluate-docs.ts`, `bun run audit:docs`). Learners can open contextual, in-depth Help from every workflow step—including **every single exposed hyperparameter across all eight active classifiers** (40 exposed controls mapping to 37 unique hyperparameter articles), all six model family overviews, all eight classifier guides (unifying Model Description cards into `/help/models/...`), 16 shared concept articles (reused via build-validated links and `::concept[slug]` callout embeds), six workflow guides, two results/comparison overview guides, and a browsable Help Hub at `/help`. Clicking links inside the native `<app-content-modal>` updates breadcrumbs and pushes modal history so Back/Forward moves smoothly across articles while Close or Escape returns directly to the underlying workflow page with form edits and invoker focus intact.

**Why:** `samata-ml` exists to help non-technical learners understand machine learning concepts without extraneous cognitive load or expertise reversal (`specification/VISION.md` §3–§4). Plain-English explanations paired with concrete dataset examples, accessible SVG visualisations, and reusable shared concepts turn every control in the workflow into an inspectable learning opportunity, while a codified standard and automated evaluator keep future documentation consistent, accurate, British English, WCAG 2.2 AA conformant, and CSP-safe.

## Scope

**In scope**

- Author the formal documentation standard (`specification/documentation-standard.md`) and reusable Markdown archetype templates (`specification/templates/docs/`), covering tone, British English, plain-English readability, progressive disclosure, SVG visual/accessibility/CSP rules, shared-concept reuse, authoring instructions, and the two-tier evaluation rubric.
- Upgrade the static content pipeline (`scripts/build-content.ts`, `scripts/markdown.ts`, `scripts/build-assets.ts`, `src/types/content.ts`, `src/common/content/*`) to support a hierarchical `help` domain under `content/{locale}/help/`, legacy URL aliases (`/help/select-features`, `/help/configure-model`, `/help/training-setup`), co-located SVG validation/optimisation/copying (rejecting inline `style` attributes), build-validated internal `/help/...` links and anchors, semantic `<figure>`/`<figcaption>` and `<aside class="concept-callout">` compilation, and `::concept[slug]` build-time embeds.
- Build an automated documentation evaluator (`scripts/evaluate-docs.ts`, registered as `bun run audit:docs`) verifying model/hyperparameter coverage against `MODEL_OPTION_POLICY`, archetype structure, link/placeholder integrity, SVG accessibility/CSP/contrast compliance, heading hierarchy, British English prose, readability thresholds, and concept cross-linking.
- Upgrade the router (`src/router/*`, `src/types/routes.ts`) and reserved content modal (`app-content-modal`, `app-content-dialog`, `src/styles/help-prose.styles.ts`) for hierarchical `/help/...` routes (resolving the `router-help-history-and-dynamic-topics.md` stub), `helpDepth`-tracked Back/Forward history inside the modal, direct-return Close/Esc, breadcrumbs, distinct `not-found` vs `error` states, and unified `/help/models/...` Model Description loading with library-JSON fallback.
- Add contextual Help entry points across all four workflow steps, including per-hyperparameter Help links on every exposed control (and fixed/multiclass notes) in `<app-model-configuration>` via a deterministic `src/features/models/model-help-map.ts`, plus entry points in Column Details, Set Target, Choose Model, Training Progress, Single Model Results, and Compare Results.
- Author and verify the complete initial Help corpus under `content/en/help/`:
  - Help Hub (`index.md`), six workflow guides (`inspect-data`, `set-target`, `select-features`, `configure-model`, `training-setup`, `training-progress`), and two results/comparison overview guides (`metrics/understanding-results`, `metrics/comparing-models`).
  - Sixteen core shared concept articles under `concepts/` (`sigmoid`, `regularisation`, `solvers-and-gradient-descent`, `stopping-tolerance`, `overfitting-and-underfitting`, `class-weights-and-imbalance`, `distance-metrics`, `prior-probability`, `smoothing`, `kernels`, `impurity`, `random-seed`, `multiclass-strategies`, `data-leakage`, `stratified-splitting`, `probability-calibration`).
  - All six model family overviews (`linear-models`, `mlp`, `decision-trees`, `knn`, `naive-bayes`, `svm`), all eight active classifier articles, and all 37 unique hyperparameter articles covering 100% of the 40 exposed controls across the eight classifiers—including migrating and upgrading `content/en/help/mlp/activation.md` and its five SVGs.
- Update `specification/mockups/00-2_content-modal.html` (currently `status="draft"`) with unstyled semantic structure for breadcrumbs, Back button, `not-found`, concept callout, and SVG figure states, plus Storybook stories and Playwright E2E/a11y/CSP tests.

**Out of scope**

- Individual deep-dive articles for each of the 37 granular metrics in `RESULT_TERM_COPY` beyond the two comprehensive `metrics/understanding-results.md` and `metrics/comparing-models.md` guides (tracked as Wave 2 in the evaluator coverage report; existing inline `<details class="terms-disclosure">` definitions stay intact).
- Articles for the eight currently hidden `web-ml` models (six regressors, `k-means`, `pca`) or unreleased upstream `decision-tree-*` options (`categoricalFeatures`, `ccpAlpha`, `maxLeafNodes`, `classWeight`); the family-first hierarchy and `model-help-map.ts` accommodate them without URL migration when those models are enabled.
- Full-page `/help/...` routes outside the modal overlay, interactive client-side search UI, multi-locale translations beyond `en`, or human visual styling/promotion of `status="draft"` mockups.
- Any machine learning computation or changes to `../web-ml` (upstream library boundary unchanged).

**Constraints and invariants**

- **Upstream boundary:** All model metadata, parameter domains, defaults, and option interactions remain grounded exclusively in the installed `web-ml@0.2.0` public catalogue (`node_modules/web-ml/specification/public-api/model-specifications/`), public declarations (`node_modules/web-ml/dist/index.d.ts`), and `samata-ml`'s `MODEL_OPTION_POLICY`. Never inspect private upstream source or invent unsupported options.
- **Zero broken links or regressions:** Existing reserved routes (`/about`, `/privacy`, `/help`, `/help/select-features`, `/help/configure-model`, `/help/training-setup`) and all existing workflow tests (`CNT-*`, `CDLG-*`, `MW-HELP-*`, `WML-P1-UI-*`, `TERM-AC-*`) continue to pass. Opening, navigating, or closing Help over a provisional or historical wizard preserves form edits, draft identity, scroll position, and invoker focus, and never persists reserved URLs to `resumePath`.
- **CSP & security:** Compiled HTML fragments remain wrapper-free, script-free, and sanitised into cloned `DocumentFragment` nodes (`sanitiseFragment`; never `unsafeHTML` or `innerHTML`). All authored SVGs served under `/content/*` or `/assets/*` MUST have **zero inline `style="..."` attributes** (enforcing production CSP `style-src-attr 'none'`), zero `<script>` tags, zero `on*` handlers, and zero external `<image>`/`href` fetches.
- **WCAG 2.2 AA & styling:** Use only tokens from `css/root.css` with no fallbacks and no literal colours (`tests/style-tokens.test.ts`). Per-field Help links in `<app-model-configuration>` MUST sit outside the `aria-describedby` target (`#${name}-help`) and carry disambiguated accessible names containing their visible text (WCAG 2.5.3). All interactive controls meet 24×24 CSS px target size, visible `2px` `--focus-ring` outlines, 320px/200% zoom reflow, RTL logical properties, and `prefers-reduced-motion`.
- **British English:** All user-facing prose, UI labels, and documentation articles use British English (`centred`, `behaviour`, `generalise`, `regularisation`, `neighbours`, `binarise`, `colour`), while verbatim `web-ml` API identifiers remain exact inside backticks (e.g. `` `nNeighbors` ``, `` `binarize` ``).
- **Local user edits preservation:** Do not touch unrelated local changes in `content/en/pages/about.md`.

## Required reading

- `specification/COMPONENTS.md` §3–§10 — closed public APIs, Lit practices, Nanostores boundaries, token-only styles, WCAG 2.2 AA, i18n, testing, and Storybook rules (mandatory for T4, T5).
- `specification/content-and-i18n.md` §Static Content — current Markdown pipeline, allow-list, and model-description fallback rules (T1, T2, T4).
- `specification/app-state-and-navigation.md` §3, §5.2–§5.4, §5.6 — reserved route table, history ownership, modal overlay behaviour, and focus rules (T4).
- `specification/components/content-modal.md` — current closed API and acceptance criteria (`CDLG-AC-1..8`, `CEM-AC-1`) for `app-content-modal` and `app-content-dialog` (T4).
- `specification/components/model-configuration.md` — current closed API and accessibility rules (`WML-P1-UI-1..9`, `TERM-AC-1`, `TERM-AC-3`) for `app-model-configuration` (T5).
- `specification/visual-design.md` §1.1, §2, §4–§6 — draft mockup authoring rules, closed token vocabulary, and token guard rules (T1, T4, T5).
- `specification/VISION.md` §3–§4, §9 — cognitive load alignment, progressive disclosure, plain-English guidance, and neural-network opacity goals (T1, T6–T9).

## Codebase context

Facts verified by `codebase-scout`:

- **Relevant specifications:** `specification/content-and-i18n.md` (partial), `specification/app-state-and-navigation.md` (draft), `specification/workflow-steps.md` (partial), `specification/components/content-modal.md` (implemented), `specification/components/model-configuration.md` (implemented), `specification/visual-design.md` (partial), `specification/plans/router-help-history-and-dynamic-topics.md` (stub — superseded by this plan), `specification/TODO.md` (TODO-12, TODO-40).
- **Relevant implementation:**
  - Content pipeline: `scripts/build-content.ts#L17-L557` (domains `['pages', 'models', 'glossary']`, flat only), `scripts/markdown.ts#L17-L398` (`Marked` + `gray-matter` + `HTMLRewriter`), `scripts/build-assets.ts#L163-L373`, `scripts/build-public-assets.ts#L7-L54` (`SaxNamespaceParser` + `svgo@4.1.0`), `src/types/content.ts#L4-L67`, `src/common/content/fragment-policy.ts#L5-L160` (`isAllowedHref` currently omits `/...`), `src/common/content/sanitise-fragment.ts#L16-L72`, `src/common/content/content-loader.ts#L6-L329`.
  - CSP & headers: `public/_headers#L1-L17` and `scripts/release-headers.ts#L69-L191` apply `style-src-attr 'none'` on `/*`, inherited by `/content/*` and `/assets/*`.
  - Router & modals: `src/types/routes.ts#L6-L45`, `src/router/reserved-content.ts#L7-L14`, `src/router/route-parser.ts#L11-L64`, `src/router/router.ts#L406-L846`, `src/features/shell/app-content-modal.ts#L27-L172`, `src/features/shell/app-content-dialog.ts#L9-L190`.
  - Model catalogue & UI help surfaces: `node_modules/web-ml@0.2.0` (`specification/public-api/model-specifications/index.json` and 8 classifier JSONs; note `../web-ml` has 2 unreleased 2026-11-25 tree JSON updates not in installed `0.2.0`), `src/features/models/model-catalogue.ts#L15-L99`, `src/features/models/model-presentation-policy.ts#L90-L337` (40 exposed options across 8 classifiers), `src/features/models/model-option-copy.ts#L6-L278`, `src/features/models/app-model-configuration.ts#L43-L1045`, `src/features/models/app-model-builder-view.ts#L130-L2730`, `src/features/models/app-model-description-dialog.ts#L11-L315`, `src/features/data/app-column-details.ts`, `src/features/target/app-target-view.ts#L332`, `src/features/models/app-training-setup.ts#L495`, `src/features/models/app-training-progress.ts`, `src/features/results/app-model-results.ts#L823-L860`, `src/features/results/app-results-view.ts#L540-L572`, `src/features/results/result-term-copy.ts#L2-L217`, `src/styles/help-link.styles.ts#L4-L28`, `src/styles/dialog.styles.ts#L7-L118`.
  - Existing seed content: `content/en/help/mlp/activation.md` + 5 co-located SVGs (`mlp-activation-{function,identity,logistic,relu,tanh}.svg`), `content/en/pages/{help,select-features,configure-model,training-setup}.md`, `content/en/models/logistic-regression.md`.
- **Tests and commands:** `bun run check`, `bun run lint`, `bun run build`, `bun test tests/style-tokens.test.ts`, `bun run test:stories`, `bun run test:e2e`, plus new `bun run audit:docs` introduced in T3. Existing suites: `tests/content-policy.test.ts`, `tests/content-markdown.test.ts`, `tests/build-content.test.ts`, `tests/content-loader.test.ts`, `tests/router-and-navigation.test.ts`, `tests/custom-elements-manifest.test.ts`, `tests/content.e2e.ts`, `tests/content-dialog.e2e.ts`, `tests/model-configuration.e2e.ts`, `tests/models-setup.e2e.ts`, `tests/a11y.e2e.ts`.
- **Web guidance:**
  - `dialog` — Native `<dialog>` via `showModal()`, no manual `role="dialog"`/`aria-modal`/focus trap, `closedby="any"` progressive enhancement with existing pointer fallback, native focus return to invoker on close; retains `samata-ml`'s `SEM-04` `<h2>` modal heading.
  - `accessibility` — Disambiguate repeated links with unique accessible names containing visible text (WCAG 2.5.3); keep interactive Help links outside `aria-describedby` targets so screen readers do not announce "Learn more" inside an input's description; use `<figure>`/`<figcaption>` for informative diagrams and `<nav aria-label="...">` for breadcrumbs.
  - `sanitize-untrusted-html` — Sanitizer API remains Limited Availability (unsupported in Safari), so retain `DOMParser` + allow-list `sanitiseFragment` returning cloned `DocumentFragment` nodes without re-serialising to `innerHTML` (preventing mXSS).
- **Visual reference:** Draft-only mockups `specification/mockups/00-2_content-modal.html` (`status="draft"`) and `specification/mockups/03-4_train-models-3-configure-model.html` (`status="draft"`). Follow `specification/visual-design.md` §1.1 (structure from draft, existing shared style modules + `css/root.css` tokens only, no parity entries until human promotion). Deviations: none beyond existing `MODELS-UI-04` and `MODELS-UI-06`.
- **Domain skills:** `lit-component-implementer` for `T4, T5`.
- **Assumptions requiring verification:** None — all paths, types, CSP headers, and exposed option lists were verified by `codebase-scout` against installed `web-ml@0.2.0` and the active source tree.

## Technical decisions

| Decision                                                               | Chosen approach and rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Rejected alternative / trade-off                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan scope & rollout (User A1)                                         | Deliver the complete documentation platform, standard, automated evaluator, app-wide UI entry points, Help Hub, 6 workflow guides, 2 results/comparison guides, 16 core shared concepts, all 6 model families, all 8 active classifiers, and all 37 unique hyperparameter articles (40 exposed controls) in one sequenced plan (T1–T10), decomposed by subsystem and model family.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Deferring authoring to a separate plan (leaves app sparse after platform delivery); putting all 37 granular per-metric articles and 8 hidden models in one plan (premature for unbuilt regression/clustering UIs).                                    |
| Hierarchical Help taxonomy & URLs (User A2)                            | Promote `help` to a first-class hierarchical domain under `content/{locale}/help/` mapped 1:1 to `/help/...`: `/help` (`index.md`), `/help/workflow/{slug}`, `/help/models/{family}` (`index.md`), `/help/models/{family}/{model-id}`, `/help/models/{family}/{option}` (shared across task variants) with per-model overrides `/help/models/{family}/{model-id}/{option}` when task-specific (e.g. Decision Tree `criterion`, Logistic Regression `solver`/`penalty`/`C`/`l1Ratio`, SVC `classWeight`/`probability`, GNB `varSmoothing`, BNB `binarize`), `/help/concepts/{slug}`, and `/help/metrics/{slug}`. Keep `/about`, `/privacy`, `/terms-and-conditions` in `content/{locale}/pages/`. Support front-matter `aliases` so `/help/select-features`, `/help/configure-model`, and `/help/training-setup` resolve directly to their `/help/workflow/*` articles with zero broken bookmarks or tests. | Flat `pages`/`models`/`glossary` domains (cannot cleanly express family→model→hyperparameter hierarchy); always duplicating per-model hyperparameter URLs (creates maintenance drift between classifier/regressor or MNB/BNB siblings).               |
| Shared concept reuse (User A3)                                         | Every shared concept lives once at `content/{locale}/help/concepts/{slug}.md` with required `summary` (1–2 plain-English sentences) and optional `summarySvg` front matter. Other articles reference it via (a) build-validated inline Markdown links (`/help/concepts/{slug}`) and/or (b) an optional block directive `::concept[slug]` compiled at build time into `<aside class="concept-callout" aria-label="Concept: {Title}">` containing the canonical `summary`, optional shared SVG, and a link to the full concept article. Zero runtime fetch waterfalls and zero copy-paste drift.                                                                                                                                                                                                                                                                                                             | Hyperlinks only (forces context-switching for a 2-sentence refresher); full Markdown section transclusion (bloats pages and causes heading-level collisions).                                                                                         |
| Help modal navigation & unified Model Descriptions (User A4)           | Keep Help in the native `<dialog class="modal">` (`<app-content-modal>` / `<app-content-dialog>`), preserving workflow underlay, form edits, and scroll. Navigating between `/help/...` links pushes history with an incremented `helpDepth`, enabling browser Back/Forward and an in-modal Back button plus `<nav aria-label="Breadcrumb">`. Close/Esc calls `history.go(-helpDepth)` (when opened in-document) to return directly to the underlay in one step. Unify Choose Model's **Model Description** buttons to open `/help/models/{family}/{model-id}` in `<app-content-modal>`, retaining graceful library-JSON fallback if an unauthored model is ever requested, and retire redundant `<app-model-description-dialog>` usage from the builder.                                                                                                                                                  | Replacing history on Help-to-Help clicks (breaks Back between articles); separate transient model dialog (fragments navigation and prevents links from model overviews into hyperparameters); full-page `/help` routes (destroys builder form state). |
| SVG authoring, optimisation & CSP compliance                           | Author SVGs co-located beside their Markdown article (`./<name>.svg`), optimised at build time via `svgo` and emitted to `{outDir}/content/{locale}/help/{dir}/{name}.svg` with `?v={12-hex}` cache-busting query. Reject any inline `style="..."` attribute on `<svg>` or descendants at build and audit time because `/content/*` inherits `style-src-attr 'none'` from `public/_headers`. Enforce `viewBox`, integer `width`/`height`, `role="img"`, `<title>`, `<desc>`, and `aria-labelledby`; size responsively via CSS on `<img class="help-svg">` inside `<figure class="help-figure">`.                                                                                                                                                                                                                                                                                                           | Relaxing production CSP `style-src-attr` (weakens XSS defence); storing all 100+ doc SVGs flat in `public/assets/` (loses co-location and makes orphan detection harder).                                                                             |
| Per-hyperparameter Help links & a11y (`lit-architecture-planner`)      | Keep `<app-model-configuration>` strictly Tier 2 presentational (zero store/router imports). Extend `OptionLabels` with optional `helpPath?: string` populated by `app-model-builder-view` via pure `src/features/models/model-help-map.ts`. Render `<a class="help-link field-help-link" href=${helpPath}>Learn more<span class="visually-hidden"> about ${copy.name}</span></a>` as a sibling **outside** `#${name}-help` (`aria-describedby` target), preventing "Learn more" from polluting the input's accessible description and ensuring unique accessible link names (WCAG 2.5.3).                                                                                                                                                                                                                                                                                                                 | Embedding `<a>` inside `#${name}-help` (violates `accessibility` guide §3); importing router/help-map inside `<app-model-configuration>` (violates `COMPONENTS.md` §2/§5).                                                                            |
| Component tiers, prefixes & shared styles (`lit-architecture-planner`) | Retain existing `<app-content-modal>` (Tier 3 connected) and `<app-content-dialog>` (Tier 2 presentational) rather than adding new wrapper elements (`COMPONENTS.md` §2–§3). Extract shared prose, figure, table-scroll, and `.concept-callout` styles into one `src/styles/help-prose.styles.ts` (`CSSResult`) adopted by `<app-content-dialog>` (and `<app-datasheet-dialog>` if reused later, or `help-prose.stories.ts`), using only `css/root.css` tokens with zero fallbacks.                                                                                                                                                                                                                                                                                                                                                                                                                        | Creating `<ui-help-breadcrumb>` or `<ui-concept-callout>` custom elements (unnecessary wrapper over native `<nav><ol>` and `<aside>`, violating `COMPONENTS.md` §3).                                                                                  |
| Two-tier documentation evaluation                                      | Layer 1 (CI-blocking): `bun run audit:docs` (`scripts/evaluate-docs.ts`) checks 100% exposed model/hyperparameter coverage, archetype front matter & headings, zero broken links/`TODO`s, SVG XML/CSP/a11y/contrast rules, heading-level continuity, British English prose (exempting code spans), readability thresholds, and unlinked concept jargon warnings. Layer 2 (Review rubric): codified 6-dimension pedagogical checklist (1–5 scale, ≥4 required) in `specification/documentation-standard.md` for human/agent authoring and review.                                                                                                                                                                                                                                                                                                                                                           | Purely manual review (inconsistent, drifts as options change); LLM-only grading in CI (non-deterministic, requires network/keys).                                                                                                                     |

### Interfaces and behaviour

#### 1. Documentation Taxonomy & Model-to-Help Mapping

Complete mapping of all 6 model families, 8 active classifiers, and 40 exposed controls (37 unique hyperparameter articles) verified against installed `web-ml@0.2.0` and `src/features/models/model-presentation-policy.ts`:

| Family Slug (`/help/models/{family}`) | Classifier (`modelId`)      | Model Article Path                                     | Exposed Options → Canonical Hyperparameter Path                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------- | --------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `linear-models`                       | `logistic-regression`       | `/help/models/linear-models/logistic-regression`       | `solver` → `.../logistic-regression/solver`, `penalty` → `.../logistic-regression/penalty`, `C` → `.../logistic-regression/c`, `l1Ratio` → `.../logistic-regression/l1-ratio`, `fitIntercept` → `/help/models/linear-models/fit-intercept`, `learningRate` → `/help/models/linear-models/learning-rate`, `maxIter` → `/help/models/linear-models/max-iter`, `tol` → `/help/models/linear-models/tol` |
| `mlp`                                 | `mlp-classifier`            | `/help/models/mlp/mlp-classifier`                      | `hiddenLayerSizes` → `/help/models/mlp/hidden-layer-sizes`, `activation` → `/help/models/mlp/activation`, `solver` → `/help/models/mlp/solver`, `learningRate` → `/help/models/mlp/learning-rate`, `maxIter` → `/help/models/mlp/max-iter`, `tol` → `/help/models/mlp/tol`, `randomState` → `/help/models/mlp/random-state`                                                                          |
| `decision-trees`                      | `decision-tree-classifier`  | `/help/models/decision-trees/decision-tree-classifier` | `criterion` → `.../decision-tree-classifier/criterion`, `maxDepth` → `/help/models/decision-trees/max-depth`, `minSamplesSplit` → `/help/models/decision-trees/min-samples-split`, `minSamplesLeaf` → `/help/models/decision-trees/min-samples-leaf`, `minImpurityDecrease` → `/help/models/decision-trees/min-impurity-decrease`                                                                    |
| `knn`                                 | `k-neighbors-classifier`    | `/help/models/knn/k-neighbors-classifier`              | `nNeighbors` → `/help/models/knn/n-neighbors`, `weights` → `/help/models/knn/weights`, `metric` → `/help/models/knn/metric`, `p` → `/help/models/knn/p`                                                                                                                                                                                                                                              |
| `naive-bayes`                         | `gaussian-nb`               | `/help/models/naive-bayes/gaussian-nb`                 | `varSmoothing` → `/help/models/naive-bayes/gaussian-nb/var-smoothing`                                                                                                                                                                                                                                                                                                                                |
| `naive-bayes`                         | `multinomial-nb`            | `/help/models/naive-bayes/multinomial-nb`              | `alpha` → `/help/models/naive-bayes/alpha`, `forceAlpha` → `/help/models/naive-bayes/force-alpha`, `fitPrior` → `/help/models/naive-bayes/fit-prior`                                                                                                                                                                                                                                                 |
| `naive-bayes`                         | `bernoulli-nb`              | `/help/models/naive-bayes/bernoulli-nb`                | `alpha` → `/help/models/naive-bayes/alpha`, `forceAlpha` → `/help/models/naive-bayes/force-alpha`, `binarize` → `/help/models/naive-bayes/bernoulli-nb/binarize`, `fitPrior` → `/help/models/naive-bayes/fit-prior`                                                                                                                                                                                  |
| `svm`                                 | `support-vector-classifier` | `/help/models/svm/support-vector-classifier`           | `C` → `/help/models/svm/c`, `kernel` → `/help/models/svm/kernel`, `degree` → `/help/models/svm/degree`, `gamma` → `/help/models/svm/gamma`, `coef0` → `/help/models/svm/coef0`, `tol` → `/help/models/svm/tol`, `classWeight` → `.../support-vector-classifier/class-weight`, `probability` → `.../support-vector-classifier/probability`                                                            |

Fixed/read-only `.form-note` mappings: `multiclass` → `/help/concepts/multiclass-strategies`, `threshold` → `/help/metrics/understanding-results#probability-threshold`, `priors` / `classPrior` → `/help/concepts/prior-probability`.

#### 2. Content Pipeline & Types (`src/types/content.ts`, `src/common/content/*`, `scripts/markdown.ts`, `scripts/build-content.ts`)

- **Domain & entries:**
  ```ts
  export type ContentDomain = 'pages' | 'models' | 'glossary' | 'help';
  export type HelpDocType =
  	| 'hub'
  	| 'workflow'
  	| 'model-family'
  	| 'model'
  	| 'hyperparameter'
  	| 'concept'
  	| 'metric';

  export interface HelpBreadcrumb {
  	readonly label: string;
  	readonly href: string;
  }

  export interface HelpEntry {
  	readonly id: string; // canonical route without leading slash, e.g. 'help' or 'help/models/mlp/activation'
  	readonly path: string; // canonical route path, e.g. '/help/models/mlp/activation'
  	readonly aliases?: readonly string[]; // e.g. ['/help/configure-model']
  	readonly docType: HelpDocType;
  	readonly title: string;
  	readonly description: string;
  	readonly summary?: string; // required when docType === 'concept'
  	readonly parentPath: string | null; // null only for '/help'
  	readonly breadcrumbs: readonly HelpBreadcrumb[];
  	readonly family?: string;
  	readonly modelId?: string;
  	readonly optionName?: string;
  	readonly related?: readonly string[];
  	readonly headings: readonly ContentHeading[];
  	readonly url: string; // '/content/{locale}/help/{rel}.html?v={12-hex}'
  	readonly lang: Locale;
  }
  ```
- **Front matter schema for `help` domain:** Required: `docType`, `title`, `description`, `updated` (`YYYY-MM-DD`). Conditional required: `summary` (required for `concept`; 1–2 plain-English sentences ≤ 280 chars), `family` (required for `model-family`, `model`, `hyperparameter`), `modelId` (required for `model`, optional for task-specific `hyperparameter`), `optionName` (required for `hyperparameter`). Optional: `aliases` (array of `/help/{kebab}` paths, base locale only), `summarySvg` (relative `./*.svg` path for `concept`), `illustration` (`'none'` only with `illustrationReason` string when a concept/option is genuinely non-visual), `related` (array of canonical `/help/...` paths validated in Pass 2). Unknown keys fail the build.
- **Shared concept directive (`::concept[slug]`):** On its own paragraph line in Markdown, `::concept[sigmoid]` is expanded during Pass 2 compilation into:
  ```html
  <aside class="concept-callout" aria-label="Concept: Sigmoid function">
  	<p class="concept-callout-title">Concept: Sigmoid function</p>
  	<p class="concept-callout-body">{canonical summary}</p>
  	<!-- optional <img class="help-svg" ...> when concept declares summarySvg -->
  	<p class="concept-callout-link"><a href="/help/concepts/sigmoid">Read the full Sigmoid function guide</a></p>
  </aside>
  ```
  Unknown slugs, non-`concept` targets, or self-referencing/cyclic embeds fail the build.
- **Fragment allow-list (`src/common/content/fragment-policy.ts`):**
  - Permitted elements add semantic HTML5: `aside`, `figure`, `figcaption`, `details`, `summary`, `dl`, `dt`, `dd`.
  - Permitted `class` values (strict closed allow-list on `aside`, `figure`, `img`, `p`): `concept-callout`, `concept-callout-title`, `concept-callout-body`, `concept-callout-link`, `help-figure`, `help-svg`.
  - Permitted `aria-label` on `aside` only (non-empty text).
  - `isAllowedHref(href)`: permits `https:`, `http:`, `mailto:`, `#<non-whitespace>`, and root-absolute same-origin paths starting with `/` whose pathname is `/about`, `/privacy`, `/help`, or `/help/...` (strictly rejecting `/content/*`, `/datasets/*`, `//`, `/\`, `..`, and whitespace). External links keep `target="_blank" rel="noopener noreferrer"`; internal `/...` links carry neither.
  - `isAllowedImageSrc(src)`: permits root-absolute `/assets/...` and `/content/...` (rejecting `//`, `/\`, `..`, whitespace); `img` permits `src`, non-empty `alt`, optional `title`, optional positive integer `width`/`height`, and optional `class="help-svg"`.
- **Co-located SVG compilation:** In `content/{locale}/help/`, relative image paths `./<kebab-name>.svg` are resolved against the Markdown file's directory, verified to exist within `content/{locale}/help/`, validated via `SaxNamespaceParser` (`<svg>` root in SVG namespace, non-empty `viewBox`, integer `width`/`height`, `role="img"`, `<title>`, `<desc>`, `aria-labelledby`, zero `<script>`, zero `on*` attributes, **zero `style` attributes**, zero external `href`/`xlink:href`), optimised with SVGO (preserving `viewBox`, `width`, `height`, `<title>`, `<desc>`, `role`, `aria-labelledby`), written to `{outDir}/content/{locale}/help/{relDir}/{name}.svg`, and rewritten in HTML to `/content/{locale}/help/{relDir}/{name}.svg?v={sha256_12}` inside `<figure class="help-figure"><img class="help-svg" src="..." alt="..." width="..." height="..." /><figcaption>...</figcaption></figure>` (caption from image `title` when provided, or omitted when absent).

#### 3. Router & History Contract (`src/types/routes.ts`, `src/router/*`)

- `ReservedPath`:
  ```ts
  export type ReservedPath =
  	| '/about'
  	| '/privacy'
  	| '/help'
  	| `/help/${string}`;
  ```
- `parseRoute(pathname)` validates `/help/{segments}` with:
  - 1 to 5 `/`-separated segments after `/help`, each matching `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`.
  - Malformed `/help/...` paths (empty segments, uppercase, punctuation, `..`, >5 segments) return `{ kind: 'unknown', path }` and redirect to `resumePath` as before.
  - Well-formed `/help/...` paths return `{ kind: 'reserved', path }`; whether an entry exists is resolved by `<app-content-modal>` against the validated `help` index (`status: 'not-found'` for unlisted valid slugs, distinct from network `'error'`).
- `HistoryEntryState` adds `helpDepth?: number`:
  - Opening any reserved path from a workflow route: `pushState` with `helpDepth: 1`, `underlayPath`, `underlayEntryId`, `modalDocumentId`.
  - Navigating from a `/help*` reserved route to another `/help*` reserved route (different path): `pushState` with `helpDepth: (prev.helpDepth ?? 1) + 1`, retaining the same `underlayPath`, `underlayEntryId`, `modalDocumentId`, and `provisional` metadata. Same-path clicks are a no-op.
  - Navigating between non-Help reserved routes (`/about` ↔ `/privacy`): retains existing `replaceState` (`helpDepth: 1`).
  - `navigateBackInReserved()`: exported router action called when the user clicks the modal's Back button (`history.back()` when `helpDepth > 1` and owned by `documentId`).
  - `closeReserved()`: when `modalDocumentId === documentId`, calls `history.go(-(state.helpDepth ?? 1))` so Close/Esc jumps directly back to the exact workflow underlay regardless of how many Help links the learner clicked; when direct-loaded / ownerless, calls `replaceState` to `underlayPath`.
  - `popstate` transitions between two reserved entries sharing `underlayEntryId` never trigger wizard departure guards and update `$route` in place.

#### 4. Closed Public APIs (`COMPONENTS.md` §3, `lit-architecture-planner`)

1. **`<app-content-modal>`** (`src/features/shell/app-content-modal.ts`, Tier 3 connected):
   - Public API: tag only (unchanged). Reads `$route` via `StoreController`, loads `'help'` index/entries for `/help*` (resolving aliases and breadcrumbs) and `'pages'` for `/about`/`/privacy`, derives `canGoBack` from owned `helpDepth > 1`, passes fallback library description when a `/help/models/{family}/{model-id}` route has a known `modelId` in `model-catalogue.ts` but no authored article, updates `document.title` to `samatā.ml | {entry.title}`, and handles `app-content-dialog-close` (`closeReserved()`) and `app-content-dialog-back` (`navigateBackInReserved()`).
2. **`<app-content-dialog>`** (`src/features/shell/app-content-dialog.ts`, Tier 2 presentational):
   - Properties (all scalar properties unreflected):
     - `open: boolean = false` (`open`)
     - `heading: string = ''` (`heading`)
     - `contentLang: string = ''` (`content-lang`)
     - `contentDir: '' | 'ltr' | 'rtl' = ''` (`content-dir`)
     - `content: DocumentFragment | null = null` (property only)
     - `status: 'loading' | 'ready' | 'not-found' | 'error' = 'loading'` (`status`)
     - `breadcrumbs: readonly HelpBreadcrumb[] = []` (property only)
     - `canGoBack: boolean = false` (`can-go-back`)
     - `fallback: string = ''` (`fallback`) — optional plain-text fallback shown when `status === 'not-found'` for an unauthored model
     - `labels: ContentDialogLabels` (property only) — exports `close`, `back`, `breadcrumbLabel`, `loadError`, `notFound`, `notFoundAction`, `missingModelFallback` with standalone English defaults.
   - Events (`bubbles: false`, `composed: false`):
     - `app-content-dialog-close: CustomEvent<ContentDialogCloseDetail>`
     - `app-content-dialog-back: CustomEvent<ContentDialogBackDetail>` (`Record<string, never>`)
   - Behaviour: No slots, public methods, parts, or custom properties. Keeps the dialog mounted and open when navigating between Help articles inside an open modal, scrolling `.modal-content` to `0` and focusing the modal `<h2>` (`tabindex="-1"`, `preventScroll: true`) on in-modal article transitions so keyboard and screen-reader users immediately land at the new article title, while closing restores native browser focus to the workflow invoker. Uses `dialogStyles`, `buttonStyles`, `helpLinkStyles`, and `helpProseStyles` (`src/styles/help-prose.styles.ts`).
3. **`<app-model-configuration>`** (`src/features/models/app-model-configuration.ts`, Tier 2 presentational):
   - Closed API addition only on typed `labels` dictionary (no new element properties, slots, events, methods, parts, or CSS custom properties):
     - `OptionLabels` adds optional `helpPath?: string`.
     - ``ConfigurationLabels`` adds ``learnMore: string`` (default ``'Learn more'``), ``learnMoreAbout: (name: string) => string`` (default ``(name) => \`` about \${name}\```— or pre-formatted``helpLinkAriaLabel``? Prefer visible text ``Learn more``+ visually hidden`` about ${copy.name}``using``params``from i18n so WCAG 2.5.3 Label in Name is guaranteed in every locale!), and optional``fixedOptionHelpPaths?: Readonly<Record<string, string>>``+``multiclassHelpPath?: string`.
   - Accessibility: `#${name}-help` wraps ONLY the plain-text description and dependency notes referenced by `aria-describedby`. The `<a class="help-link field-help-link" href=${copy.helpPath}>` renders immediately after `#${name}-help` as a sibling inside `.field-description`, never inside the `aria-describedby` target.
4. **`<app-column-details>`** (`src/features/data/app-column-details.ts`, Tier 2 presentational):
   - Adds optional `helpHref: string = ''` (`help-href`) and `labels.helpLink: string` (default `'Learn about data types and statistics'`) rendering a single `<a class="help-link">` in the inspector header/footer.
5. **`<app-training-progress>`** (`src/features/models/app-training-progress.ts`, Tier 2 presentational):
   - Adds optional `helpHref: string = ''` (`help-href`) and `labels.helpLink: string` (default `'What happens during training?'`) rendering a single `<a class="help-link">`.

#### 5. Automated Evaluator CLI (`scripts/evaluate-docs.ts`, `bun run audit:docs`)

- Flags: `--json` (machine-readable report), `--scope <core|mlp|linear-models|decision-trees|knn|naive-bayes|svm|all>` (default `all`), `--allow-incomplete` (reports coverage gaps as warnings during intermediate authoring commits without failing; default strict mode fails on any missing exposed classifier or hyperparameter).
- Checks:
  1. **Coverage:** Cross-checks `src/features/models/model-catalogue.ts` (all 8 classifiers) and `MODEL_OPTION_POLICY` (all 40 exposed controls) via `src/features/models/model-help-map.ts` against `content/en/help/`, plus required Hub, 6 workflow guides, and 2 metrics guides.
  2. **Archetype schema & headings:** Required front-matter keys per `docType`, required H2 section categories per `docType`, no skipped heading levels (`h1→h3` fails), no body `# H1`, non-empty `alt` text on all images.
  3. **Link, anchor, concept & placeholder integrity:** Fails on any `TODO`/`TBD`/`FIXME` in prose/links, broken `/help/...` links, broken `#anchor`, broken `::concept[slug]`, or orphaned `.svg` files under `content/en/help/`.
  4. **SVG accessibility, CSP & contrast:** Parses every `.svg` under `content/en/help/` — fails on missing `viewBox`, non-integer `width`/`height`, missing `role="img"` / `<title>` / `<desc>` / `aria-labelledby`, any `style="..."` attribute, any `<script>` or `on*`, or text/graphic hex fills falling below WCAG AA contrast (4.5:1 for `<text>` against card background `#f8fafc`/`#fcfbfa`/`#ffffff`, 3:1 for data curves/key strokes).
  5. **Plain-English & British English:** Strips code blocks, inline backticks, URLs, and front matter; flags US spellings (`color`, `center`, `centered`, `behavior`, `generalize`, `regularization`, `neighbors`, `optimize`, `normalize`, `binarize`, `categorize`, `visualize`, `modeling`, `labeled`, `standardize`, `analyze`) as errors; computes Flesch-Kincaid grade level and max paragraph word count (warns > grade 11 or > 90 words; fails > grade 13 or > 140 words); warns when a canonical concept term appears unlinked on first prose mention outside its own article.

## Specification changes

- [ ] `specification/documentation-standard.md` — Create normative documentation authoring standard, archetype schemas, SVG visual/CSP/a11y contract, shared-concept reuse rules, and two-tier evaluation rubric; status `implemented`.
- [ ] `specification/content-and-i18n.md` §Static Content & §Model Descriptions — Document hierarchical `help` domain, front-matter schema, aliases, co-located SVG validation/optimisation, validated root-absolute `/help/...` links, `::concept[slug]` embeds, expanded allow-list, and unified `/help/models/...` loading; status `partial` → `partial` (multi-locale UI switcher remains target).
- [ ] `specification/app-state-and-navigation.md` §3, §5.2–§5.4, §5.6 — Document hierarchical `/help/...` routes, `helpDepth` in `HistoryEntryState`, in-modal Back/Forward + direct-return Close/Esc, and unlisted-topic state; status `draft` → `draft`.
- [ ] `specification/components/content-modal.md` §3–§10 — Update closed public API (`breadcrumbs`, `canGoBack`, `not-found`, `fallback`, `app-content-dialog-back`, updated `ContentDialogLabels`), prose styling, stories, and acceptance criteria; status `implemented` → `implemented`.
- [ ] `specification/components/model-configuration.md` §3–§9 — Document per-hyperparameter Help links outside `aria-describedby`, disambiguated accessible names, and fixed/multiclass note links; status `implemented` → `implemented`.
- [ ] `specification/workflow-steps.md` §1–§4 — Record contextual Help entry points across Steps 1–4 and unified Model Description routing; status `partial` → `partial`.
- [ ] `specification/visual-design.md` §1.1, §3 — Record `src/styles/help-prose.styles.ts` and updated `00-2_content-modal.html` draft structure; status `partial` → `partial`.
- [ ] `specification/README.md` §Specs — Add `documentation-standard.md` row with matching `implemented` status.
- [ ] `specification/TODO.md` — Mark `TODO-12` model prose authoring resolved for all eight classifiers; narrow `TODO-40` to note canonical concept library and Help Hub implemented (optional expandable math formulas in future waves).
- [ ] `specification/HUMAN.md` — Update `00-2_content-modal.html` draft styling item with breadcrumb/Back/callout/figure additions, mark `Author remaining model articles (TODO-12)` and `router-help-history-and-dynamic-topics` resolved, and add manual VoiceOver/NVDA/200%-zoom check for the upgraded Help modal and per-hyperparameter links.
- [ ] `specification/plans/router-help-history-and-dynamic-topics.md` — Mark superseded in `specification/plans/README.md` (or archive/remove per workflow convention if unused) since hierarchical `/help/...` routing and distinct unlisted-topic state are delivered here.
- [ ] `AGENTS.md` §Verification Commands — Add `bun run audit:docs` alongside existing verification commands.

## Implementation tasks

### T1 — Documentation Standard, Authoring Templates & Draft Modal Mockup

- **Depends on:** None
- **Risk:** routine
- **Likely files:** `specification/documentation-standard.md`, `specification/templates/docs/model-family.md`, `specification/templates/docs/model.md`, `specification/templates/docs/hyperparameter.md`, `specification/templates/docs/concept.md`, `specification/templates/docs/workflow.md`, `specification/templates/docs/metric.md`, `specification/mockups/00-2_content-modal.html`, `specification/HUMAN.md`
- **Must not touch:** `src/`, `scripts/`, `tests/`, `content/en/pages/about.md` — T1 defines the normative standard and draft mockup structure before pipeline/code changes.
- **Implementation:**
  - Author `specification/documentation-standard.md` covering: (1) Educational mission & audience (non-technical learners, plain-English reading level Year 9–11, progressive disclosure via optional `<details>` "Mathematical detail" blocks to avoid expertise reversal); (2) Complete app-wide Documentation Surface Map across all four workflow steps; (3) Information Architecture & URL rules (`/help`, `/help/workflow/*`, `/help/models/{family}`, `/help/models/{family}/{model-id}`, `/help/models/{family}/{option}`, per-model overrides, `/help/concepts/*`, `/help/metrics/*`, and legacy aliases); (4) Exact front-matter & required-heading contracts for all seven `HelpDocType` archetypes; (5) Shared-concept authoring & `::concept[slug]` reuse rules; (6) SVG visual, accessibility, and CSP standard (approved palette hex values aligned with `css/root.css` contrast ≥ 4.5:1 text / ≥ 3:1 graphics, mandatory `viewBox` + integer `width`/`height` + `role="img"` + `<title>` + `<desc>` + `aria-labelledby`, prohibition of inline `style="..."` and scripts, `<figure>`/`<figcaption>` usage); (7) Two-tier evaluation standard (CI checks in `bun run audit:docs` + 6-criterion pedagogical review rubric scored 1–5 with ≥4 pass bar) and a deterministic authoring checklist/prompt template for generating new documents.
  - Create the six reusable Markdown templates under `specification/templates/docs/`.
  - Update `specification/mockups/00-2_content-modal.html` (preserving `<meta name="status" content="draft" />` and `visual-design.md` §1.1 semantic-HTML-only rules) to include unstyled multi-state comments for: Back button + `<nav aria-label="Breadcrumb">`, `not-found` topic state, missing-model fallback state, `<aside class="concept-callout">`, and `<figure class="help-figure">` SVG illustration. Update the existing `00-2_content-modal.html` entry in `specification/HUMAN.md` §6.
- **Acceptance criteria:**
  - [ ] `DOC-STD-1`: `specification/documentation-standard.md` defines all 7 archetypes, required front matter, British English rules, SVG CSP/a11y/palette rules, `::concept[slug]` contract, and the automated + rubric evaluation criteria with zero unresolved TBDs.
  - [ ] `DOC-STD-2`: All six templates under `specification/templates/docs/` match the front-matter and heading schemas defined in `specification/documentation-standard.md`.
  - [ ] `DOC-STD-3`: `specification/mockups/00-2_content-modal.html` remains `status="draft"`, uses only semantic HTML and existing classes, and passes `bun run audit:mockups 00-2_content-modal.html` (or zero new axe violations if mockup server is exercised).
- **Verification:** `bun run plans:check` / inspect `specification/documentation-standard.md` and `specification/templates/docs/*.md`.
- **Progress:** [ ] Not started

### T2 — Content Build Pipeline: Hierarchical `help` Domain, Co-located SVGs, Internal Links & `::concept[slug]`

- **Depends on:** T1
- **Risk:** needs care — modifies the Markdown compiler, fragment security policy, runtime sanitiser, and build asset graph; must preserve strict XSS/CSP guarantees and all existing `CNT-*` tests.
- **Likely files:** `src/types/content.ts`, `src/common/content/fragment-policy.ts`, `src/common/content/sanitise-fragment.ts`, `src/common/content/content-loader.ts`, `scripts/markdown.ts`, `scripts/build-content.ts`, `scripts/build-assets.ts`, `scripts/build-public-assets.ts`, `tests/content-policy.test.ts`, `tests/content-markdown.test.ts`, `tests/build-content.test.ts`, `tests/content-loader.test.ts`
- **Must not touch:** `src/router/`, `src/features/`, `content/en/pages/about.md` — keep pipeline and security policy changes cleanly isolated and unit-tested before router/UI integration.
- **Implementation:**
  - Extend `src/types/content.ts` with `'help'` in `ContentDomain`, `HelpDocType`, `HelpBreadcrumb`, `HelpEntry`, and `ContentEntryMap['help']`.
  - Update `src/common/content/fragment-policy.ts` and `sanitise-fragment.ts`:
    - Allow semantic tags `aside`, `figure`, `figcaption`, `details`, `summary`, `dl`, `dt`, `dd`.
    - Allow closed class allow-list (`concept-callout`, `concept-callout-title`, `concept-callout-body`, `concept-callout-link`, `help-figure`, `help-svg`), `aria-label` on `aside`, and positive integer `width`/`height` on `img`.
    - Update `isAllowedHref` to allow root-absolute internal links `/about`, `/privacy`, `/help`, and `/help/{kebab-segments}` (with optional `#anchor`), strictly rejecting `/content/*`, `/datasets/*`, `//`, `/\`, `..`, `javascript:`, `data:`, and `vbscript:`.
    - Update `isAllowedImageSrc` to allow root-absolute `/assets/...` and `/content/...` (rejecting traversal/protocol-relative URLs).
  - Extract a reusable SVG XML/CSP/SVGO validator helper (sharing `SaxNamespaceParser` + `svgo` logic with `scripts/build-public-assets.ts`) that rejects inline `style="..."` attributes, `<script>`, `on*` handlers, and external references in content SVGs while preserving `viewBox`, `width`, `height`, `<title>`, `<desc>`, `role`, and `aria-labelledby`.
  - Upgrade `scripts/build-content.ts` and `scripts/markdown.ts` to run a two-pass build for `content/{locale}/help/`:
    - Pass 1 discovers recursive kebab-case `.md` files (`index.md` maps to its directory route; e.g. `help/index.md` → `/help`, `help/models/mlp/index.md` → `/help/models/mlp`, `help/models/mlp/activation.md` → `/help/models/mlp/activation`), validates front matter per `HelpDocType`, builds the route + alias + heading + concept registry, and validates `aliases` uniqueness.
    - Pass 2 expands `::concept[slug]` directives into semantic `<aside class="concept-callout">` blocks (failing on unknown/non-concept/cyclic slugs), resolves co-located `./<name>.svg` images (validating, optimising, emitting to `{outDir}/content/{locale}/help/{relDir}/{name}.svg`, rewriting to `/content/{locale}/help/...svg?v={hash}`, and wrapping standalone images in `<figure class="help-figure">`), validates every internal `/help...` link and `#anchor` against Pass 1, rejects `TODO` placeholder link targets, and emits `{outDir}/content/{locale}/help/index.json` (`version: 1`) with precomputed `breadcrumbs` and `aliases`.
  - Update `src/common/content/content-loader.ts` to support `loadContentIndex('help', opts)` and `loadHelpEntryByPath(path, opts)` (resolving canonical paths and `aliases`, returning `ContentLoadError('NOT_FOUND')` cleanly for unlisted paths).
  - Add thorough unit tests (positive + negative/security cases) in `tests/content-policy.test.ts`, `tests/content-markdown.test.ts`, `tests/build-content.test.ts`, and `tests/content-loader.test.ts`.
- **Acceptance criteria:**
  - [ ] `DOC-PIPE-1`: `FRAGMENT_POLICY` and `sanitiseFragment` allow `/help/...` links, `<aside class="concept-callout">`, `<figure class="help-figure">`, `<details>`/`<summary>`, `<dl>`/`<dt>`/`<dd>`, and `/content/...svg` images while stripping `/content/*` links, `/datasets/*` links, `javascript:` URLs, disallowed classes, and `<script>`/`style` attributes.
  - [ ] `DOC-PIPE-2`: `buildContent` compiles nested `content/en/help/` fixtures with `index.md`, aliases, co-located SVGs, and `::concept[slug]` embeds into deterministic hashed fragments and `help/index.json` with accurate `breadcrumbs`.
  - [ ] `DOC-PIPE-3`: `buildContent` fails deterministically on: broken `/help/...` links, broken `#anchors`, `TODO` link targets, unknown or cyclic `::concept[...]` slugs, missing co-located SVGs, SVGs containing inline `style="..."` or `<script>`, duplicate aliases, and invalid `HelpDocType` front matter.
  - [ ] `DOC-PIPE-4`: Existing `CNT-P-*`, `CNT-M-*`, `CNT-B-*`, and `CNT-L-*` tests pass without regression.
- **Verification:** `bun test tests/content-policy.test.ts tests/content-markdown.test.ts tests/build-content.test.ts tests/content-loader.test.ts && bun run typecheck`
- **Progress:** [ ] Not started

### T3 — Automated Documentation Quality Evaluator (`bun run audit:docs`)

- **Depends on:** T2
- **Risk:** routine
- **Likely files:** `scripts/evaluate-docs.ts`, `src/features/models/model-help-map.ts`, `package.json`, `tests/evaluate-docs.test.ts`, `tests/model-help-map.test.ts`
- **Must not touch:** `src/router/`, `src/features/shell/`, `content/en/pages/about.md` — T3 builds the canonical model-help map and automated evaluator; UI wiring follows in T4–T5.
- **Implementation:**
  - Create `src/features/models/model-help-map.ts` exporting pure functions: `getModelFamilySlug(modelId)`, `getModelHelpPath(modelId)`, `getHyperparameterHelpPath(modelId, optionName)`, `getFixedOptionHelpPath(optionName)`, `getMulticlassHelpPath()`, and `listExpectedModelHelpEntries()` covering all 8 classifiers and all 40 exposed controls (37 unique hyperparameter paths) derived from `MODEL_OPTION_POLICY` and `model-catalogue.ts`.
  - Create `scripts/evaluate-docs.ts` and add `"audit:docs": "bun run scripts/evaluate-docs.ts"` to `package.json`. Implement all five deterministic check groups specified in _Interfaces and behaviour §5_: (1) model/hyperparameter/workflow coverage against `listExpectedModelHelpEntries()` (supporting `--allow-incomplete` and `--scope <name>` for incremental authoring); (2) archetype front-matter & required-section checks + heading-level continuity; (3) broken link/anchor/concept/`TODO` and orphaned SVG checks; (4) SVG XML, `viewBox`, integer `width`/`height`, `role="img"`, `<title>`, `<desc>`, `aria-labelledby`, zero inline `style`, and WCAG AA contrast validation on hex fills/strokes; (5) British English prose linter (ignoring code spans/blocks/URLs), Flesch-Kincaid grade & paragraph length thresholds, and unlinked concept jargon warnings. Support `--json` output and non-zero exit code on errors.
  - Author `tests/model-help-map.test.ts` (asserting 100% deterministic mapping of every active classifier and every exposed option in `MODEL_OPTION_POLICY`) and `tests/evaluate-docs.test.ts` (synthetic pass/fail fixtures for every single evaluator rule, including US spelling in prose vs allowed backticked `` `nNeighbors` ``, H1→H3 skip, inline SVG `style`, low-contrast SVG text, and missing concept link warning).
- **Acceptance criteria:**
  - [ ] `DOC-EVAL-1`: `model-help-map.ts` maps all 8 classifiers in `model-catalogue.ts` and all 40 exposed controls in `MODEL_OPTION_POLICY` to valid canonical `/help/models/...` paths (37 unique hyperparameter paths).
  - [ ] `DOC-EVAL-2`: `scripts/evaluate-docs.ts` catches every negative fixture (missing front matter, missing required archetype heading, skipped heading level, `TODO` placeholder, US spelling in prose, inline SVG `style`, missing SVG `<title>`/`<desc>`, low-contrast SVG text, orphaned SVG, missing exposed hyperparameter coverage) and passes clean fixtures (including backticked US API identifiers like `` `binarize` `` and `` `nNeighbors` ``).
  - [ ] `DOC-EVAL-3`: `bun run audit:docs --json` emits valid JSON with per-file pass/warn/error diagnostics and summary coverage counts.
- **Verification:** `bun test tests/model-help-map.test.ts tests/evaluate-docs.test.ts && bun run typecheck && bun run lint`
- **Progress:** [ ] Not started

### T4 — Hierarchical `/help/...` Router, In-Modal Breadcrumbs & Back/Forward, Prose Styles & Unified Model Descriptions

- **Depends on:** T2, T3
- **Risk:** needs care — modifies browser History API transitions, native `<dialog>` focus management, closed component API (`app-content-dialog`), and shared styles; must obey `lit-component-implementer`, `COMPONENTS.md` §3–§10, and `tests/style-tokens.test.ts`.
- **Likely files:** `src/types/routes.ts`, `src/router/reserved-content.ts`, `src/router/route-parser.ts`, `src/router/router.ts`, `src/styles/help-prose.styles.ts`, `src/styles/help-prose.stories.ts`, `src/features/shell/app-content-dialog.ts`, `src/features/shell/app-content-dialog.stories.ts`, `src/features/shell/app-content-modal.ts`, `src/features/models/app-model-builder-view.ts`, `src/features/models/app-model-description-dialog.ts`, `tests/router-and-navigation.test.ts`, `tests/custom-elements-manifest.test.ts`, `tests/content-dialog.e2e.ts`, `tests/content.e2e.ts`, `tests/models-setup.e2e.ts`, `tests/style-tokens.test.ts`
- **Must not touch:** `content/`, `scripts/evaluate-docs.ts` — keep router and shell UI cleanly tested with unit/story/E2E fixtures before bulk content authoring in T6–T9.
- **Implementation:**
  - Update `src/types/routes.ts`, `src/router/reserved-content.ts`, `src/router/route-parser.ts`, and `src/router/router.ts`:
    - Parse `/help` and hierarchical `/help/{kebab}` (1–5 segments) as `kind: 'reserved'`; reject malformed `/help/...` paths as `unknown`.
    - Track `helpDepth` in `HistoryEntryState`; push history on Help→Help navigation preserving `underlayPath`, `underlayEntryId`, `modalDocumentId`, and `provisional`; export `navigateBackInReserved()`; update `closeReserved()` to call `history.go(-helpDepth)` when owned by `documentId` and `replaceState` to `underlayPath` when direct-loaded.
    - Ensure `popstate` across Help entries never triggers wizard departure confirmation and preserves draft state and scroll.
  - Create `src/styles/help-prose.styles.ts` (and co-located `src/styles/help-prose.stories.ts`) using strictly `css/root.css` tokens (zero literal colours, zero fallbacks, logical properties, `prefers-reduced-motion`, 2px `--focus-ring` outlines) styling `.modal-breadcrumbs`, `.modal-back`, `.modal-prose`, `figure.help-figure`, `img.help-svg`, `aside.concept-callout`, responsive prose tables, `<details>` math disclosures, and `<dl>` lists.
  - Update `<app-content-dialog>` closed public API per _Interfaces and behaviour §4_ (`breadcrumbs`, `canGoBack`, `status: 'loading' | 'ready' | 'not-found' | 'error'`, `fallback`, updated `ContentDialogLabels`, `app-content-dialog-back` event, JSDoc/CEM tags). Keep `<dialog class="modal" closedby="any">` mounted across in-modal article transitions, scroll `.modal-content` to top and focus modal `<h2>` on article switch, and preserve native browser focus return to the workflow invoker on close.
  - Update `<app-content-modal>` to load `'help'` entries for `/help*` (falling back gracefully to `'pages'` if legacy `pages` still exist during transition until T6 removes duplicates), resolve `aliases` & `breadcrumbs`, show library JSON `fallback` when a `/help/models/{family}/{model-id}` article is missing, update `document.title`, and wire `app-content-dialog-back` → `navigateBackInReserved()`.
  - Update `<app-model-builder-view>` so clicking **Model Description** on any `<app-model-card>` navigates to `getModelHelpPath(modelId)` via `openReserved(...)` (replacing transient `<app-model-description-dialog>` invocation; remove unused dialog state/import in the builder and check if `app-model-description-dialog.ts` has any remaining consumers before deleting or deprecating).
  - Update Storybook stories (`app-content-dialog.stories.ts` covering Loading, Ready with SVGs & Concept Callout, Breadcrumbs + Back, NotFound, MissingModelFallback, Error, LongHeading, RTL + Do/Don't docs) and regenerate/verify CEM (`tests/custom-elements-manifest.test.ts`).
  - Update/add Playwright & unit tests (`tests/router-and-navigation.test.ts`, `tests/content-dialog.e2e.ts`, `tests/content.e2e.ts`, `tests/models-setup.e2e.ts`).
- **Acceptance criteria:**
  - [ ] `DOC-NAV-1`: `parseRoute` accepts valid hierarchical `/help/{segments}` (up to 5 kebab-case segments) and rejects malformed/uppercase/traversal paths as `unknown`.
  - [ ] `DOC-NAV-2`: Multi-hop Help navigation (`Workflow` → `Help A` → `Help B` → `Help C`) pushes `helpDepth` 1→2→3; clicking modal Back or browser Back steps C→B→A without closing the modal or triggering wizard departure guards; clicking Close or pressing Escape returns directly to the workflow underlay in one step with invoker focus and unsaved form edits preserved.
  - [ ] `DOC-NAV-3`: Direct load of `/help/models/mlp/activation` renders the article over the resumed underlay; Close/Esc replaces to the underlay; an unlisted valid slug (`/help/nonexistent-topic`) renders `status="not-found"` with a link to `/help`, distinct from network `status="error"`.
  - [ ] `DOC-NAV-4`: Clicking **Model Description** on a model card opens `/help/models/{family}/{model-id}` in `<app-content-modal>`, displays authored prose or library-JSON fallback cleanly, and returns focus to the card button on close.
  - [ ] `DOC-NAV-5`: `bun run storybook:manifest`, `tests/custom-elements-manifest.test.ts`, `tests/style-tokens.test.ts`, and `bun run test:stories` pass across Chromium, Firefox, and WebKit with zero axe violations (including LongHeading and RTL).
- **Verification:** `bun test tests/router-and-navigation.test.ts tests/custom-elements-manifest.test.ts tests/style-tokens.test.ts && bun run storybook:manifest && bun run test:stories && bun run test:e2e tests/content-dialog.e2e.ts tests/content.e2e.ts tests/models-setup.e2e.ts`
- **Progress:** [ ] Not started

### T5 — App-Wide Contextual Help Entry Points & Per-Hyperparameter Help Links

- **Depends on:** T3, T4
- **Risk:** needs care — updates `<app-model-configuration>` (Tier 2 presentational), `<app-column-details>`, `<app-training-progress>`, `<app-target-view>`, `<app-model-results>`, and `<app-results-view>`; must preserve strict accessibility (`aria-describedby` separation, WCAG 2.5.3 Label in Name, `WML-P1-UI-*`, `TERM-AC-*`) and zero store imports in Tier 2 elements.
- **Likely files:** `src/features/models/app-model-configuration.ts`, `src/features/models/app-model-configuration.stories.ts`, `src/features/models/model-option-copy.ts`, `src/features/models/app-model-builder-view.ts`, `src/features/models/app-training-progress.ts`, `src/features/data/app-column-details.ts`, `src/features/data/app-dataset-preview.ts`, `src/features/target/app-target-view.ts`, `src/features/results/app-model-results.ts`, `src/features/results/app-results-view.ts`, `src/styles/hyperparameters.styles.ts`, `tests/model-configuration.e2e.ts`, `tests/data-preview.e2e.ts`, `tests/model-results.e2e.ts`, `tests/comparison.e2e.ts`
- **Must not touch:** `content/`, `src/router/` — UI entry points link to canonical `/help/...` paths wired through `model-help-map.ts` and `app-content-modal`.
- **Implementation:**
  - In `src/features/models/model-option-copy.ts` and `app-model-builder-view.ts`, populate `OptionLabels.helpPath` for every exposed option using `getHyperparameterHelpPath(modelId, optionName)` and populate `fixedOptionHelpPaths` / `multiclassHelpPath` for `.form-note` items.
  - In `<app-model-configuration>` (`src/features/models/app-model-configuration.ts`):
    - Adopt `helpLinkStyles` alongside `hyperparametersStyles`.
    - In `renderDescription`, keep `#${name}-help` containing ONLY the plain-text description and dependency notes referenced by `aria-describedby`. Render `<a class="help-link field-help-link" href=${copy.helpPath}>${labels.learnMore}<span class="visually-hidden">${labels.learnMoreAbout(copy.name)}</span></a>` immediately after `#${name}-help` inside `.field-description` when `copy.helpPath` is present.
    - Add contextual Help links beside fixed-option and multiclass `.form-note` lines when their help path is provided.
  - Wire contextual Help entry points across the other workflow surfaces (all strings via `@nanostores/i18n` in connected views, passed via `labels` to Tier 2 components):
    - **Step 1 (`app-column-details` via `app-dataset-preview`):** Add `"Learn about data types and statistics"` link to `/help/workflow/inspect-data`.
    - **Step 2 (`app-target-view`):** Point existing Help link to `/help/workflow/set-target`.
    - **Step 3.5 (`app-training-progress` via `app-model-builder-view`):** Add `"What happens during training?"` link to `/help/workflow/training-progress`.
    - **Step 3.6 (`app-model-results`) & Step 4 (`app-results-view`):** Retain existing `What do these results terms mean?` `<details class="terms-disclosure">` unchanged for `TERM-AC-6..8`, and add a link inside the disclosure footer (`"Read the full guide to results and metrics"` → `/help/metrics/understanding-results` in Step 3.6; `"Read the full guide to comparing models"` → `/help/metrics/comparing-models` in Step 4).
  - Update `src/features/models/app-model-configuration.stories.ts` (including per-field Help links, Long label, RTL) and Playwright tests verifying accessible names, `aria-describedby` exclusion of link text, focus restoration, and zero axe violations across all 8 classifiers.
- **Acceptance criteria:**
  - [ ] `DOC-UI-1`: Every exposed hyperparameter across all 8 classifiers renders a native `<a class="help-link">` pointing to its exact `getHyperparameterHelpPath(modelId, optionName)` target, with a unique accessible name containing visible `"Learn more"` (WCAG 2.5.3) and excluded from the control's `aria-describedby` accessible description.
  - [ ] `DOC-UI-2`: Activating any hyperparameter Help link opens the Help modal over the builder without discarding unsaved hyperparameter edits, and closing restores focus to that exact link.
  - [ ] `DOC-UI-3`: Contextual Help links exist and open the matching Help route across Step 1 (`inspect-data`), Step 2 (`set-target`), Step 3.1 (`models/{family}/{model-id}`), Step 3.2 (`select-features`), Step 3.3 (`configure-model` + per-option), Step 3.4 (`training-setup`), Step 3.5 (`training-progress`), Step 3.6 (`understanding-results`), and Step 4 (`comparing-models`).
  - [ ] `DOC-UI-4`: `tests/style-tokens.test.ts`, `bun run test:stories`, and `tests/model-configuration.e2e.ts` pass with zero regressions on `WML-P1-UI-*`, `TERM-AC-*`, and `DATA-PRE-2`.
- **Verification:** `bun test tests/style-tokens.test.ts && bun run test:stories && bun run test:e2e tests/model-configuration.e2e.ts tests/data-preview.e2e.ts tests/model-results.e2e.ts tests/comparison.e2e.ts`
- **Progress:** [ ] Not started

### T6 — Author Help Hub, 6 Workflow Guides, 2 Results/Comparison Guides & 16 Shared Concept Articles (with SVGs)

- **Depends on:** T2, T3, T4
- **Risk:** routine
- **Likely files:** `content/en/help/index.md`, `content/en/help/workflow/`, `content/en/help/metrics/`, `content/en/help/concepts/`, `content/en/pages/help.md`, `content/en/pages/select-features.md`, `content/en/pages/configure-model.md`, `content/en/pages/training-setup.md`
- **Must not touch:** `content/en/pages/about.md`, `content/en/pages/privacy-policy.md`, `content/en/pages/terms-and-conditions.md`, `src/` — keep legal/about pages untouched and isolate authoring to `content/en/help/` (removing the four superseded duplicate Help files from `content/en/pages/` once migrated).
- **Implementation:**
  - Author `content/en/help/index.md` (`docType: hub`) organising all Workflow Guides, Model Families, Results & Metrics Guides, and Core Concepts in clear plain-English tables/lists (initial model-family links may temporarily target stub/index or be validated with `--scope core` until T7–T9 land; keep every link in `index.md` valid at build time by either authoring the six family `index.md` files in T7–T9 and adding their hub links as each family lands, OR creating valid links in sync—specifically: include Workflow, Metrics, and Concepts links in T6, and add each Model Family row to `index.md` in T7, T8, T9 so `bun run build` stays 100% green after EVERY single task commit!).
  - Author all **16 core shared concept articles** under `content/en/help/concepts/` (each with canonical `summary`, concrete Iris/Penguins/Credit example, optional `<details>` deeper mathematical note, and bespoke CSP-clean WCAG-AA SVG where visual):
    - `sigmoid.md` (+ `sigmoid-curve.svg` set as `summarySvg`), `regularisation.md` (+ `regularisation-tradeoff.svg`), `solvers-and-gradient-descent.md` (+ `gradient-descent-steps.svg`), `stopping-tolerance.md` (+ `stopping-tolerance.svg`), `overfitting-and-underfitting.md` (+ `overfitting-underfitting.svg`), `class-weights-and-imbalance.md` (+ `class-weights.svg`), `distance-metrics.md` (+ `euclidean-vs-manhattan.svg`), `prior-probability.md` (+ `prior-probability.svg`), `smoothing.md` (+ `laplace-smoothing.svg`), `kernels.md` (+ `kernel-trick.svg`), `impurity.md` (+ `impurity-split.svg`), `random-seed.md`, `multiclass-strategies.md` (+ `ovr-vs-ovo.svg`), `data-leakage.md` (+ `data-leakage.svg`), `stratified-splitting.md` (+ `stratified-split.svg`), `probability-calibration.md` (+ `calibration-curve.svg`).
  - Author all **6 workflow guides** under `content/en/help/workflow/` (each with plain-English guidance, Iris/Penguins examples, `::concept[...]` callouts, and SVG diagrams):
    - `inspect-data.md` (column types, missing/invalid, min/median/mean/max, histogram SVG, identifiers)
    - `set-target.md` (target selection, classification vs regression, eligibility rules, class imbalance)
    - `select-features.md` (`aliases: ['/help/select-features']`, Iris example, `::concept[data-leakage]`, feature-selection SVG)
    - `configure-model.md` (`aliases: ['/help/configure-model']`, hyperparameters, sensible defaults, Manual vs future Tuning, linking to concepts)
    - `training-setup.md` (`aliases: ['/help/training-setup']`, One-Shot 80/20 & K-Fold Cross-Validation SVGs, benefits/drawbacks table, `::concept[stratified-splitting]`, fold limits)
    - `training-progress.md` (what happens during fitting, folds, refitting, stopping/cancelling)
  - Author the **2 results & comparison overview guides** under `content/en/help/metrics/`:
    - `understanding-results.md` (balanced accuracy vs accuracy, baseline, confusion matrix SVG, precision/recall/F1, `#probability-threshold` section with FP/FN trade-off SVG, calibration & `::concept[probability-calibration]`, train–test gap & `::concept[overfitting-and-underfitting]`)
    - `comparing-models.md` (compatible evaluation groups & pooling, paired fold strip, confusion differences, Bayesian correlated t-test & ROPE SVG, instance agreement)
  - Delete superseded `content/en/pages/{help,select-features,configure-model,training-setup}.md` once served from `content/en/help/`.
- **Acceptance criteria:**
  - [ ] `DOC-CORE-1`: `bun run build` compiles all 25 core Help articles (1 Hub + 6 Workflow + 2 Metrics + 16 Concepts) and all co-located SVGs with zero link, anchor, concept-embed, or SVG CSP errors.
  - [ ] `DOC-CORE-2`: `bun run audit:docs --scope core --allow-incomplete` passes with zero errors (British English, heading hierarchy, archetype structure, SVG a11y/contrast/CSP, readability).
  - [ ] `DOC-CORE-3`: Existing reserved-route E2E tests (`tests/content.e2e.ts`) continue to pass on `/help`, `/help/select-features`, `/help/configure-model`, and `/help/training-setup`.
- **Verification:** `bun run build && bun run audit:docs --scope core --allow-incomplete && bun run test:e2e tests/content.e2e.ts`
- **Progress:** [ ] Not started

### T7 — Author Neural Networks (`mlp`) & Linear Models (`linear-models`) Documentation (2 Families, 2 Classifiers, 15 Hyperparameters + SVGs)

- **Depends on:** T6
- **Risk:** routine
- **Likely files:** `content/en/help/index.md`, `content/en/help/models/mlp/`, `content/en/help/models/linear-models/`, `content/en/help/mlp/`, `content/en/models/logistic-regression.md`
- **Must not touch:** `src/`, `content/en/pages/about.md` — content authoring and legacy stub cleanup only.
- **Implementation:**
  - **MLP (`content/en/help/models/mlp/`):**
    - Author `index.md` (`model-family`: how multi-layer perceptrons learn, network-layers SVG, links to `mlp-classifier` and notes future regressor support).
    - Author `mlp-classifier.md` (`model`: classification output, structural opacity vs inspectable models per `VISION.md` §9, complete table linking all 7 hyperparameters, when to choose).
    - Migrate `content/en/help/mlp/activation.md` + 5 SVGs → `content/en/help/models/mlp/activation.md`: replace `TODO_LINK_TO_MLP_OVERVIEW_DOC` with `/help/models/mlp`, fix `### Why this step matters` → `## Why this step matters`, convert US spellings (`Zero-centered`, `centered`, `behavior`, `generalize`) to British English (`Zero-centred`, `centred`, `behaviour`, `generalise`), strip inline `style="..."` from all 5 SVGs and ensure integer `width`/`height` + WCAG AA contrast, embed `::concept[sigmoid]` under `logistic`, and remove legacy `content/en/help/mlp/`.
    - Author the 6 remaining MLP hyperparameter articles + bespoke SVGs: `hidden-layer-sizes.md`, `solver.md` (`sgd`, `adam`; embeds `::concept[solvers-and-gradient-descent]`), `learning-rate.md` (notes `sgd`-only applicability, Adam fixed `0.001`), `max-iter.md` (notes 5,000 browser cap), `tol.md` (embeds `::concept[stopping-tolerance]`), `random-state.md` (embeds `::concept[random-seed]`).
  - **Linear Models (`content/en/help/models/linear-models/`):**
    - Author `index.md` (`model-family`: straight-line / hyperplane boundaries SVG, links to `logistic-regression` and notes future linear/polynomial regression).
    - Author `logistic-regression.md` (`model`: embeds `::concept[sigmoid]`, links all 8 exposed hyperparameters + fixed `threshold` note; remove legacy 2-link stub `content/en/models/logistic-regression.md` if no test requires `content/en/models/logistic-regression.md`, or verify `tests/build-content.test.ts` expectations first).
    - Author all 8 Logistic Regression hyperparameter articles + bespoke SVGs:
      - Task-specific (`logistic-regression/`): `solver.md` (`sgd`, `adam`, `lbfgs`, `coordinate_descent` + `lbfgs` penalty compatibility note), `penalty.md` (`none`, `l1`, `l2`, `elasticnet`; embeds `::concept[regularisation]`), `c.md` (inverse regularisation strength SVG), `l1-ratio.md` (`elasticnet` mix SVG).
      - Family-shared: `fit-intercept.md` (intercept shift SVG), `learning-rate.md` (`sgd`-only note), `max-iter.md`, `tol.md` (solver-dependent defaults `1e-6` vs `1e-4`).
  - Add the MLP and Linear Models entries to `content/en/help/index.md`.
- **Acceptance criteria:**
  - [ ] `DOC-FAM-1`: `bun run build` compiles all 19 articles (2 families + 2 models + 15 hyperparameters) and all co-located SVGs cleanly with zero broken links or CSP violations.
  - [ ] `DOC-FAM-2`: `bun run audit:docs --scope mlp --allow-incomplete` and `bun run audit:docs --scope linear-models --allow-incomplete` pass with zero errors.
  - [ ] `DOC-FAM-3`: Every option description, default, and dependency (`lbfgs` penalty restriction, `sgd`-only `learningRate`, `elasticnet`-only `l1Ratio`, `maxIter` browser cap) matches installed `web-ml@0.2.0` and `MODEL_OPTION_POLICY`.
- **Verification:** `bun run build && bun run audit:docs --scope mlp --allow-incomplete && bun run audit:docs --scope linear-models --allow-incomplete`
- **Progress:** [ ] Not started

### T8 — Author Decision Trees (`decision-trees`) & K-Nearest Neighbours (`knn`) Documentation (2 Families, 2 Classifiers, 9 Hyperparameters + SVGs)

- **Depends on:** T6
- **Risk:** routine
- **Likely files:** `content/en/help/index.md`, `content/en/help/models/decision-trees/`, `content/en/help/models/knn/`
- **Must not touch:** `src/`, `content/en/pages/about.md` — content authoring only.
- **Implementation:**
  - **Decision Trees (`content/en/help/models/decision-trees/`):**
    - Author `index.md` (`model-family`: yes/no question tree & axis-aligned boundary SVG, interpretability vs overfitting).
    - Author `decision-tree-classifier.md` (`model`: links all 5 exposed hyperparameters, concrete Iris/Penguins split example).
    - Author all 5 Decision Tree hyperparameter articles + bespoke SVGs:
      - Task-specific (`decision-tree-classifier/`): `criterion.md` (`gini`, `entropy`, `log_loss`; embeds `::concept[impurity]`, impurity curves SVG).
      - Family-shared: `max-depth.md` (shallow vs deep tree overfitting SVG; embeds `::concept[overfitting-and-underfitting]`, `Unlimited` vs custom integer), `min-samples-split.md` (split threshold SVG), `min-samples-leaf.md` (leaf size smoothing SVG), `min-impurity-decrease.md` (pruning threshold SVG).
  - **KNN (`content/en/help/models/knn/`):**
    - Author `index.md` (`model-family`: nearest-neighbour voting SVG, lazy learning & feature-scale sensitivity).
    - Author `k-neighbors-classifier.md` (`model`: links all 4 exposed hyperparameters, dataset-size cap on `k`).
    - Author all 4 KNN hyperparameter articles + bespoke SVGs:
      - `n-neighbors.md` (`k=1` vs `k=5` vs `k=25` boundary smoothness SVG; embeds `::concept[overfitting-and-underfitting]`), `weights.md` (`uniform` vs `distance` voting SVG), `metric.md` (`minkowski`, `euclidean`, `manhattan`; embeds `::concept[distance-metrics]`), `p.md` (Minkowski unit-circle shapes for `p=1`, `p=2`, `p=4` SVG; notes `metric === 'minkowski'` dependency).
  - Add the Decision Trees and KNN entries to `content/en/help/index.md`.
- **Acceptance criteria:**
  - [ ] `DOC-FAM-4`: `bun run build` compiles all 13 articles (2 families + 2 models + 9 hyperparameters) and all co-located SVGs cleanly.
  - [ ] `DOC-FAM-5`: `bun run audit:docs --scope decision-trees --allow-incomplete` and `bun run audit:docs --scope knn --allow-incomplete` pass with zero errors.
  - [ ] `DOC-FAM-6`: Every default, option enum, and dependency (`p` active when `metric === 'minkowski'`, `nNeighbors <= rowCount`, nullable `maxDepth`) matches installed `web-ml@0.2.0` and `MODEL_OPTION_POLICY`.
- **Verification:** `bun run build && bun run audit:docs --scope decision-trees --allow-incomplete && bun run audit:docs --scope knn --allow-incomplete`
- **Progress:** [ ] Not started

### T9 — Author Naive Bayes (`naive-bayes`) & Support Vector Machines (`svm`) Documentation (2 Families, 4 Classifiers, 13 Unique Hyperparameters + SVGs)

- **Depends on:** T6
- **Risk:** routine
- **Likely files:** `content/en/help/index.md`, `content/en/help/models/naive-bayes/`, `content/en/help/models/svm/`
- **Must not touch:** `src/`, `content/en/pages/about.md` — content authoring only.
- **Implementation:**
  - **Naive Bayes (`content/en/help/models/naive-bayes/`):**
    - Author `index.md` (`model-family`: Bayes' rule & conditional independence intuition SVG, side-by-side table choosing between Gaussian, Multinomial, and Bernoulli Naive Bayes).
    - Author all 3 classifier articles (`gaussian-nb.md`, `multinomial-nb.md`, `bernoulli-nb.md`), each with concrete dataset guidance, fixed `priors`/`classPrior` note link, and table linking its hyperparameters.
    - Author all 5 unique Naive Bayes hyperparameter articles + bespoke SVGs (covering all 8 exposed controls):
      - Family-shared (Multinomial & Bernoulli): `alpha.md` (embeds `::concept[smoothing]`, Laplace/Lidstone smoothing SVG), `force-alpha.md` (flooring near-zero alpha explanation SVG), `fit-prior.md` (embeds `::concept[prior-probability]`, uniform vs learned priors SVG).
      - Model-specific: `gaussian-nb/var-smoothing.md` (bell-curve variance stability SVG), `bernoulli-nb/binarize.md` (thresholding continuous inputs into 0/1 SVG, `None` when already binary).
  - **Support Vector Machines (`content/en/help/models/svm/`):**
    - Author `index.md` (`model-family`: maximum-margin boundary & support vectors SVG, links to `support-vector-classifier` and notes future `support-vector-regressor`).
    - Author `support-vector-classifier.md` (`model`: links all 8 exposed hyperparameters, notes probability calibration speed trade-off).
    - Author all 8 SVC hyperparameter articles + bespoke SVGs:
      - Family-shared: `c.md` (wide soft margin vs narrow strict margin SVG; embeds `::concept[regularisation]`), `kernel.md` (`rbf`, `linear`, `poly`, `sigmoid` decision-boundary SVGs; embeds `::concept[kernels]` and `::concept[sigmoid]`), `degree.md` (`poly` degree 1/2/3/5 curve complexity SVG; notes `kernel === 'poly'`), `gamma.md` (`scale`, `auto`, custom numeric reach-of-influence SVG; notes `kernel !== 'linear'`), `coef0.md` (`poly`/`sigmoid` intercept shift SVG), `tol.md` (embeds `::concept[stopping-tolerance]`).
      - Classification-specific (`support-vector-classifier/`): `class-weight.md` (`none` vs `balanced` margin shift on imbalanced data SVG; embeds `::concept[class-weights-and-imbalance]`), `probability.md` (Platt scaling / probability estimates trade-off SVG; embeds `::concept[probability-calibration]`).
  - Add Naive Bayes and SVM entries to `content/en/help/index.md`.
  - Run full strict `bun run audit:docs` (without `--allow-incomplete`) to confirm **100% coverage** of all 8 classifiers and all 40 exposed controls (37 unique hyperparameter articles)!
- **Acceptance criteria:**
  - [ ] `DOC-FAM-7`: `bun run build` compiles the entire Help corpus with zero broken links, zero orphaned SVGs, and zero CSP/SVGO errors.
  - [ ] `DOC-FAM-8`: Strict `bun run audit:docs` (no `--allow-incomplete`) exits `0` with 100% coverage across all 6 model families, 8 active classifiers, 40 exposed hyperparameter controls (37 unique pages), 6 workflow guides, 2 metrics guides, 16 core concepts, and the Help Hub.
- **Verification:** `bun run build && bun run audit:docs && bun test tests/model-help-map.test.ts`
- **Progress:** [ ] Not started

### T10 — End-to-End Verification, Accessibility & CSP Audit, and Specification Sync

- **Depends on:** T5, T7, T8, T9
- **Risk:** routine
- **Likely files:** `tests/a11y.e2e.ts`, `tests/content.e2e.ts`, `specification/README.md`, `specification/content-and-i18n.md`, `specification/app-state-and-navigation.md`, `specification/components/content-modal.md`, `specification/components/model-configuration.md`, `specification/workflow-steps.md`, `specification/visual-design.md`, `specification/TODO.md`, `specification/HUMAN.md`, `specification/plans/README.md`, `specification/plans/router-help-history-and-dynamic-topics.md`, `AGENTS.md`
- **Must not touch:** `content/en/pages/about.md` — leave unrelated user edits untouched.
- **Implementation:**
  - Add Playwright E2E/a11y assertions in `tests/content.e2e.ts` and `tests/a11y.e2e.ts` exercising:
    - Real built-server (`--dist` / production CSP headers) rendering of `/help/models/mlp/activation` and `/help/models/svm/kernel` confirming all SVG figures load (`naturalWidth > 0`) with **zero CSP console errors**.
    - Multi-hop journey: Configure Model (MLP) → click Activation `Learn more` → click `Multi-layer Perceptron` → click `Sigmoid function` → click modal Back twice → click Close → verify Configure Model form edits intact and focus restored to the Activation `Learn more` link.
    - Axe WCAG 2.2 AA scan across Help Hub, a model family page, a classifier page, a hyperparameter page with SVGs + `::concept[...]` callout, and the `not-found` state, plus 320px viewport and 200% zoom checks.
  - Update all specifications listed under _Specification changes_ (`specification/README.md`, `content-and-i18n.md`, `app-state-and-navigation.md`, `components/content-modal.md`, `components/model-configuration.md`, `workflow-steps.md`, `visual-design.md`, `TODO.md`, `HUMAN.md`, `AGENTS.md`, and supersede `router-help-history-and-dynamic-topics.md`).
  - Run the complete verification suite from `AGENTS.md`.
- **Acceptance criteria:**
  - [ ] `DOC-E2E-1`: Production-header Playwright check renders SVG-illustrated Help articles and concept callouts with zero CSP console errors and zero broken images.
  - [ ] `DOC-E2E-2`: Strict axe WCAG 2.2 AA scans pass with zero violations on Help Hub, model overview, hyperparameter + SVG + concept callout, and `not-found` states.
  - [ ] `DOC-E2E-3`: Every item under _Specification changes_ is completed and `bun run plans:check` passes.
- **Verification:** `bun run check && bun run lint && bun run build && bun run audit:docs && bun test tests/style-tokens.test.ts && bun run test:stories && bun run test:e2e tests/content.e2e.ts tests/content-dialog.e2e.ts tests/model-configuration.e2e.ts tests/models-setup.e2e.ts tests/a11y.e2e.ts && bun run plans:check`
- **Progress:** [ ] Not started

## Verification and definition of done

- [ ] All task acceptance criteria (`DOC-STD-1..3`, `DOC-PIPE-1..4`, `DOC-EVAL-1..3`, `DOC-NAV-1..5`, `DOC-UI-1..4`, `DOC-CORE-1..3`, `DOC-FAM-1..8`, `DOC-E2E-1..3`) are met.
- [ ] All verification commands from `AGENTS.md` pass with no new failures: `bun run check`, `bun run lint`, `bun run build`, `bun run audit:docs`, `bun test tests/style-tokens.test.ts`, `bun run test:stories`, `bun run test:e2e`, and `bun run plans:check`.
- [ ] Type-check, lint, and build checks pass; the staged-file hook and landing gate enforce formatting.
- [ ] Accessibility (WCAG 2.2 AA), production CSP (`style-src-attr 'none'` on SVGs), sanitisation/XSS safety, and `web-ml@0.2.0` contract compatibility checks are completed.
- [ ] Every item under _Specification changes_ is ticked, and specifications match the implemented code.
- [ ] No unintended changes outside the tasks' likely files (and unrelated local changes in `content/en/pages/about.md` remain untouched).

## Risks and open questions

- **Blocking:** None
- **Non-blocking:**
  - **Draft mockup styling (`00-2_content-modal.html`, `03-4_train-models-3-configure-model.html`):** Both remain `status="draft"` awaiting human visual styling and promotion (`specification/HUMAN.md` §6). Implementation uses existing shared styles (`dialogStyles`, `helpLinkStyles`, `helpProseStyles`) and `css/root.css` tokens only, with no parity entries until promoted.
  - **Manual assistive-technology and zoom verification:** Automated axe and Playwright checks pass across three engines, while manual Safari/VoiceOver, NVDA/Orca, and real 200% browser zoom verification of the upgraded Help modal breadcrumbs, Back button, concept callouts, and per-hyperparameter links are queued in `specification/HUMAN.md` for maintainer check before V1.
  - **Wave 2 documentation scope:** Individual deep-dive articles for each of the 37 granular results metrics (beyond `metrics/understanding-results.md` and `metrics/comparing-models.md`) and articles for the 8 currently hidden `web-ml` models (regressors, K-Means, PCA) are tracked as informational coverage targets in `bun run audit:docs` for future authoring waves.
  - **Unreleased upstream `web-ml` tree options:** `../web-ml` contains unreleased 2026-11-25 JSON additions for `decision-tree-*` (`categoricalFeatures`, `ccpAlpha`, `maxLeafNodes`, `classWeight`) whose `.d.ts` files are not yet rebuilt and which are not in installed `web-ml@0.2.0`. Decision tree documentation in T8 strictly matches installed `web-ml@0.2.0`; when a future `web-ml` release is vendored and exposed in `MODEL_OPTION_POLICY`, `bun run audit:docs` will automatically prompt authoring those new hyperparameter pages.

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

## Change log

| When (UTC)           | Change               | Reason                                                                                           |
| -------------------- | -------------------- | ------------------------------------------------------------------------------------------------ |
| 2026-11-26T17:46:20Z | Initial draft        | User request for comprehensive plain-English, SVG-illustrated Help documentation system (A1–A4). |
| 2026-11-26T17:51:12Z | Risk syntax fix      | Invalidated and normalised `Risk: routine` fields to satisfy `plans:check`.                      |
| 2026-11-26T17:51:12Z | Invalidated approval | Fix routine Risk field syntax flagged by plans:check                                             |
