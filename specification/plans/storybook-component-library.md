# Storybook component library, shell remediation and repository conventions

**Status:** draft | **Updated:** 2026-11-13T22:48:56Z

## Goal

**Current behaviour:**

- Storybook is not installed (COMPONENTS §1, §10; Known gap 5). There are no stories, no Vitest, no story-level axe checks and no `custom-elements.json`.
- The UI is three connected Lit elements, four shared style modules and placeholder views:
    - `src/features/navigation/app-sidebar.ts`, `src/features/navigation/app-content-modal.ts`, `src/features/onboarding/app-welcome-modal.ts`;
    - `src/styles/button.styles.ts`, `chiclet.styles.ts`, `dialog.styles.ts`, `card.styles.ts` (the last has no consumer yet);
    - the four route views are inline templates in `src/app.ts:16-81`, with an inline `<style>` block at `src/app.ts:112-136`.
- `src/components/` contains only a stray `.DS_Store`.
- The shell does not match the mockups and breaks the rules (Known gap 13). The shell files use 21 unknown tokens, 83 `var()` fallbacks and literal colours, and `tests/style-tokens.test.ts:5-10` exempts them through `KNOWN_DRIFT`. Every sidebar, main, page-header and modal entry in `tests/visual-parity/map.ts` is marked `knownDrift: 'scaffolding-visual-remediation'`, a plan that was never written. Strings are hard-coded; `src/i18n.ts` does not exist.
- The sidebar has a second `<h1>` (SEM-01) and an `<h4>` straight after `<h1>` (SEM-02). It has no focus styles (A11Y-10), a 260px fallback width instead of `--sidebar-width` and no narrow-viewport layout.
- The content modal heading is an `<h1>` and the close button is a text "✕". The welcome modal copy differs from `00_first-load.html`. Pressing `Esc` closes the welcome dialog without setting `welcomeDismissed`, so it reopens on the next render (`src/features/onboarding/app-welcome-modal.ts:44-63`).
- `css/style.css` loads copies of thirteen mockup CSS files. `css/base.css` is a byte-for-byte copy of the mockup's, including its physical properties and the A11Y-07/08 input and select defects. The button, card, badge and modal rules are duplicated between `css/` and `src/styles/` (visual-design §3).
- Naming is inconsistent:
    - `src/config/pipelineSteps.ts` is an empty camelCase file that nothing imports.
    - `.gitkeep` files remain in non-empty directories.
    - `tests/app-shell.test.ts` is a Playwright file that `playwright.config.ts:5` special-cases (Known gap 17).
    - Draft plans put `app-*` cards in `src/components/`.
    - ARCHITECTURE names `src/main.ts` and `/styles.css` (Known gaps 1, 2), and the README names `public/index.html`.

**Target behaviour:**

- `bun run storybook` serves a component workbench: every style primitive and shell component has stories, with autodocs drawn from the Custom Elements Manifest and spec usage rules.
- `bun run test:stories` runs every story in Chromium, Firefox and WebKit through the Storybook Vitest addon, with axe (WCAG 2.2 AA tags) failing on any violation.
- The shell (sidebar, main, page header, welcome modal, content modal) matches the mockups at 1440×900 apart from register deviations. It uses only `css/root.css` tokens, passes WCAG 2.2 AA (including 320px width and 200% zoom), and takes every string from `@nanostores/i18n`.
- `KNOWN_DRIFT` is empty and no parity entry carries `knownDrift`.
- One documented naming and CSS standard applies across the repository and is checked by tests:
    - **Files:** kebab-case, a small set of role suffixes, and element files named after their tag. `ui-*` elements live in `src/components/`; `app-*` elements live in `src/features/{feature}/`.
    - **Tests:** `tests/*.test.ts` run under `bun:test`, `tests/*.e2e.ts` under Playwright, and co-located `*.stories.ts` under Storybook.
    - **CSS:** native CSS only, with no framework, preprocessor or utility-class system. Document CSS is just tokens plus base.

**Why:** The user asked for a small, robust, semantic, WCAG-conformant component set developed in Storybook, with streamlined naming and clean modern CSS. Known gap 13 (shell remediation) covers the same files and the same mockups, and its owning plan was never written. This plan absorbs it, so each component is fixed once and documented once.

## Scope

**In scope**

- Install and configure Storybook 10.6 (`@storybook/web-components-vite` on Vite 7) with the docs, a11y and Vitest addons, the Custom Elements Manifest and Vitest browser mode.
- Repository conventions:
    - kebab-case files, role suffixes, element placement and test locations;
    - delete dead files and move the shell elements into `src/features/shell/`;
    - fix stale paths in the README and ARCHITECTURE;
    - add a conventions guard test.
- CSS consolidation:
    - document CSS becomes `root.css` and `base.css` only;
    - delete the duplicated mockup copies in `css/`;
    - add the `--backdrop` and `--shadow-sidebar` tokens and a page-header style primitive;
    - extend the token guard (inline-direction physical properties, `!important`, `:host-context`).
- Style primitives brought to the mockups, with stories: `.btn` (adds `.btn-icon`, applies A11Y-01), `.chiclet` (decides the SEM-11 look, applies A11Y-04), the dialog styles and `.page-header`.
- `src/i18n.ts`, using exactly the contract in [step-1-load-data-and-preview](step-1-load-data-and-preview.md) D3.
- Shell components with stories:
    - `app-sidebar` (SEM-01, SEM-02, A11Y-02, A11Y-09, A11Y-10, step summaries, narrow viewport);
    - `app-welcome-modal` (mockup copy, any dismissal persists the flag);
    - `app-content-modal`, split into a connected element and a presentational `app-content-dialog`.
- Parity map, token guard and axe scans for all of the above. Specs synced, including new component specs for TODO-34 and part of TODO-35.

**Out of scope**

- Building route views. The placeholders in `src/app.ts` stay until the step plans replace them. No `Views/` stories are written, because no view elements exist.
- Cards (`app-dataset-card`, `app-model-card`), the virtual table, notifications, dropzone, tables, `.train-step` sections and form controls (`input`, `select`, `.file-picker`). Their feature plans own them. This plan only removes their unused `css/` copies.
- A generic `ui-dialog` or `ui-content-dialog` (decision D12), an icon system, a visually-hidden utility module and cascade layers (D9).
- The project-settings button and the "next step" pulse dot in the mockup sidebar: no behaviour spec defines them.
- Additional locales and a language switcher (TODO-46).
- Editing mockups (TODO-37/38/39), the router, stores, the persister and anything else owned by [state-navigation-conformance](state-navigation-conformance.md).
- Production build changes. Storybook is a development tool only and is not deployed.

**Constraints and invariants**

- Lit 3 with TypeScript standard decorators and `accessor` (COMPONENTS §4); `experimentalDecorators` stays off.
- Bun remains the only package manager and script runner (`bun add`, `bun run`, `bunx`). The Storybook and Vitest CLIs run on Node through their bin shebangs, invoked by `bun run` scripts.
- Mockups stay normative for appearance (visual-design §1); Storybook does not replace them.
- Behavioural contracts that tests already rely on are preserved: the `app-sidebar`, `app-welcome-modal` and `app-content-modal` tags, every `href`, the `aria-current` values from conformance D14, `<main id="content">` with the focus target `#content h1`, and router-driven dialog closing.
- No telemetry: Storybook runs with telemetry disabled. Nothing in this plan sends data to a third party at runtime.
- Baseline Widely available features only. `:has()`, media-query range syntax and CSS nesting are widely available. Invoker commands and `closedby` are not, so they are not used.

## Required reading

The implementer reads only these, plus each task's likely files. Everything else is optional.

- `specification/COMPONENTS.md` §1–§10 (all Lit tasks); §6 and §7 for the CSS tasks.
- `specification/visual-design.md` §1, §2, §3, §4 and §5: tokens, translation rules and registers.
- `specification/app-state-and-navigation.md` §2, §4.4 and §5.4: layout regions, sidebar rules and reserved-route dialogs (T6–T8).
- `specification/components/button.md` §3–§9: the button API and criteria (T2, T4).
- `specification/plans/state-navigation-conformance.md`, the **Sidebar (D14)** paragraph under _Interfaces and behaviour_: `aria-current` rules this plan must keep (T6).
- `specification/plans/step-1-load-data-and-preview.md`, decision row D3: the `src/i18n.ts` contract (T5).
- `node_modules/@nanostores/i18n/README.md`: the `createI18n`, `params`, `count` and `formatter` API (T5–T8).
- Mockups (`bun run serve:scaffold`, http://localhost:3333):
    - `specification/mockups/ui-scaffold/00_first-load.html` for the sidebar, `main`, `.page-header`, welcome dialog and badge;
    - `specification/mockups/ui-scaffold/03-2_train-models-1-choose-model.html` for the sidebar summaries, chiclets and model list;
    - `specification/mockups/ui-scaffold/01-3_upload-dataset.html` for `.btn-icon` in `.modal-header`;
    - draft `specification/mockups/ui-scaffold/drafts/00-2_content-modal.html` for the content dialog structure.
- Mockup CSS:
    - `specification/mockups/ui-scaffold/css/base.css`, `button.css`, `badges.css`, `modal.css`, `sidebar.css`, `steps.css`;
    - `specification/mockups/ui-scaffold/css/train-model.css`, only the `.visually-hidden` block;
    - `specification/mockups/ui-scaffold/css/dot.css`.
- `tests/visual-parity/map.ts`, `tests/style-tokens.test.ts`, `tests/a11y.e2e.ts`: harness shapes (T3, T6–T8).
- Storybook Vitest addon manual setup for Vitest 4 or later: https://storybook.js.org/docs/writing-tests/integrations/vitest-addon (T2 only).

## Codebase context

Facts the planner verified, so the implementer need not re-check them.

- **Relevant implementation:**
    - `src/app.ts` renders the shell with Lit `render()` into `#app` (no `app-root`, per app-state-and-navigation §2) and auto-bootstraps only when `#app` exists. Storybook's root is `#storybook-root`, so importing elements never bootstraps the app.
    - `$appState` (`src/stores/app.store.ts:22`) and `$route` (`src/router/router.ts:10`) are plain nanostore atoms. `parseRoute(pathname)` is exported from `src/router/route-parser.ts`. `INITIAL_APP_STATE` comes from `src/types/state.ts`.
    - `sanitiseFragment(html: string): DocumentFragment` is exported from `src/common/content/sanitise-fragment.ts`.
    - Nothing in `src/` references the `DEBUG` build define.
    - `css/base.css` is identical to the mockup `base.css`. `css/root.css` is the mockup root plus `--surface` and `--focus-ring`.
    - `.icon`, `.columns` and `.column` (`css/style.css`) are not used in `src/`.
- **Tests and commands:**
    - Baseline on 2026-11-13, with state-navigation-conformance changes uncommitted in the working tree: `bun run check` gives 0 type errors and 158 pass, 0 fail across 22 files. `AGENTS.md` still says 52; report before and after counts against 158.
    - Playwright 1.65.0 is installed with browsers. `playwright.config.ts` runs `tests/*.e2e.ts` plus `tests/app-shell.test.ts` against `bun run server` (:3000) and `serve:scaffold` (:3333).
    - The current selectors used by `tests/app-shell.test.ts` and `tests/content.e2e.ts` are `#content h1`, `app-sidebar a[href=…]`, `app-sidebar footer a[href=…]`, `app-sidebar nav.steps`, `app-content-modal dialog`, `dialog h1`, `button.close-btn`, `.modal-body`, `[role="alert"]` and `app-welcome-modal button.btn-primary`. T6 and T8 update the ones they change.
- **Package versions (checked with `bun info`, 2026-11-13):**
    - `storybook`, `@storybook/web-components-vite`, `@storybook/addon-docs`, `@storybook/addon-a11y` and `@storybook/addon-vitest` are all 10.6.7.
    - `@storybook/builder-vite` 10.6.7 accepts `vite` `^5 || ^6 || ^7 || ^8`. The latest Vite 7 is 7.3.8.
    - `@storybook/addon-vitest` 10.6.7 accepts `vitest`, `@vitest/browser` and `@vitest/browser-playwright` `^4 || ^5`. `vitest` 5.1.0 accepts Vite `^6.4 || ^7 || ^8`. `@vitest/browser-playwright` 5.1.0 has peers `vitest 5.1.0` and `playwright *`.
    - Installed: Bun 1.4.3, Node 26.12.0, TypeScript 7.0.2, `@custom-elements-manifest/analyzer` 0.10.10.
- **Web guidance:** Retrieved IDs: `dialog`, `styling-web-components`, `navbar`, `icons`. Decisions taken from them:
    - `dialog`: native `<dialog>` with `showModal()`, no `role`/`aria-modal`/trap/`Esc` handler; `aria-labelledby` to one consistent heading level; `dialog:modal { overscroll-behavior: contain }` and `dialog::backdrop { overflow: hidden; overscroll-behavior: contain }`; never set `display` on `dialog` unconditionally; never open with the `open` attribute (so the existing `catch { dialog.open = true }` fallbacks are removed); `closedby` and invoker commands are not used (not Widely available).
    - `styling-web-components`: `:host { display }` on every element; no `:host-context()` (Chromium-only); form controls need `font: inherit`; components theme only through inherited custom properties.
    - `navbar`: mark the current page with `aria-current="page"` and style it through `[aria-current]`; never by colour alone (A11Y-09 adds weight); the indicator reaches 3:1; use logical properties.
    - `icons`: decorative inline SVG with `aria-hidden="true"` and `focusable="false"`; icon buttons take their name from a localised `aria-label`. One icon (close) has one consumer, so it is inlined in that file; no icon system.
- **Visual reference:** each item names the mockup selector, then its app selector, then any register deviation.
    - Sidebar (`00_first-load.html`, `03-2_…`; `sidebar.css`, `steps.css`):
        - `.sidebar` → `app-sidebar` `:host`;
        - `.sidebar h1` → `.brand` (SEM-01);
        - `.sidebar .tagline` → `.tagline`;
        - `.sidebar .project` → `.project`;
        - `.project h4` → `.project h2` (SEM-02);
        - `.project-name` → `.project-name`;
        - `.workflow`, `.steps`, `.step`, `.step-link`, `.step-num`, `.step-label`, `.step-label-small`, `.step-value`, `.step-chiclets`, `.step-models`, `.step-model-link` → same names;
        - `.step[aria-current]` → `.step:has(> .step-link[aria-current])` (A11Y-09, A11Y-10);
        - `.sidebar footer` → `footer` (A11Y-02);
        - `.dot` and `.visually-hidden` → local copies in `app-sidebar` (SEM-09).
    - Main and page header (`00_first-load.html`; `base.css`): `main` → `main` (logical properties); `.page-header` and its `> h1`, `> p`, `> button` → `pageHeaderStyles` `.page-header`.
    - Dialog (`00_first-load.html`; `modal.css`): `.modal` → `dialogStyles` `dialog`; `.modal .modal-header` → `.modal-header`; `.modal-header h1` → `.modal-header h2` (SEM-04); `::backdrop` → `dialog::backdrop`.
    - Buttons (`button.css`): `.btn` and `.btn-primary` (A11Y-01, A11Y-10) → `buttonStyles`; `.btn-icon` (`01-3`) → `buttonStyles` `.btn-icon` (A11Y-10).
    - Badges (`badges.css`, computed on `00` and `03-2`): `.chiclet` → `chicletStyles` `.chiclet`; `.badge.badge-amber` → `.chiclet.chiclet-amber` (SEM-11, A11Y-04); `.badge-purple` → `.chiclet-purple`.
    - Draft: `drafts/00-2_content-modal.html`, unstyled (visual-design §1.1). `app-content-dialog` gets no parity entries beyond the shared `dialogStyles` already mapped through the welcome dialog.
- **Lit skills:** implementers use `lit-implementer` for T2, T4, T6, T7 and T8.
- **Known gaps decided:**
    - Gap 1: ARCHITECTURE gets the real entry (`src/app.ts`), `src/types/`, `src/components/`, `src/styles/` and `src/features/shell/`.
    - Gap 2: the README template path and the ARCHITECTURE asset URL are corrected (T1).
    - Gap 5: component behaviour is tested in real browsers only. Stories run through the Vitest addon and emulation criteria run in Playwright; happy-dom stays for non-component DOM unit tests (D7).
    - Gap 13: resolved by T3, T4 and T6–T8.
    - Gap 17: Playwright files are `tests/**/*.e2e.ts` and nothing else (D7).
    - Gap 3 (CSS inlining) and gap 10 (product name) are not touched.
- **Assumptions requiring verification:**
    - **A1 (T2).** Vite 7's esbuild transform lowers TC39 standard decorators with `accessor` for Lit. esbuild lowers decorators for every target because no browser ships them. The T2 criterion SB-AC-3 proves it with a real decorated element.
    - **A2 (T2).** Storybook 10.6.7 and Vitest 5.1 run on the installed Node 26.12. If either CLI refuses Node 26, stop and escalate; do not downgrade Node or switch runtimes on your own.
    - **A3 (T2).** `playwright` resolves for `@vitest/browser-playwright` through `@playwright/test@1.65.0`. If it does not, `bun add -d playwright@1.65.0`.
    - **A4 (T8).** The CEM analyzer 0.10.10 with `litelement: true` lists `@property() accessor` fields. If it does not, record it in the log; the docs table may be incomplete, but stories and tests are unaffected. Do not hand-write `argTypes` to compensate (COMPONENTS §10).

## Technical decisions

| Decision                             | Chosen approach and rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Rejected alternative / trade-off                                                                                                                                                                                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 Storybook stack                   | Dev dependencies, with exact versions: `storybook@10.6.7`, `@storybook/web-components-vite@10.6.7`, `@storybook/addon-docs@10.6.7`, `@storybook/addon-a11y@10.6.7`, `@storybook/addon-vitest@10.6.7`, `vite@^7.3.8`, `vitest@^5.1.0`, `@vitest/browser@^5.1.0`, `@vitest/browser-playwright@^5.1.0`. Installed with `bun add -d`. Configured by hand, not with `storybook init`, which writes example stories and may run another package manager. This is the stack COMPONENTS §1 already chose.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Hand-rolled Playwright crawling `storybook-static/index.json` with `@axe-core/playwright`: fewer dependencies, but it needs a custom script, gives up the maintained play-function runner and contradicts COMPONENTS §1. Lit's own `@web/dev-server` catalogue: no docs or addon ecosystem. |
| D2 Vite 7, not 8                     | Pin `vite` to `^7.3.8`. Vite 8's Oxc transform does not lower TC39 standard decorators: the Vite 8 migration guide says so, and oxc PR #28882 to add it is still open. Lit's `@property() accessor` would ship unlowered and fail at runtime. Vite 7's esbuild lowers them. Revisit when Oxc lowers standard decorators.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Vite 8 with `@rolldown/plugin-babel` and `@babel/plugin-proposal-decorators` (2023-11): two more dependencies, a slower transform, and reported class-name bugs (vitejs/vite discussion #21891). Switching to `experimentalDecorators`: contradicts COMPONENTS §1 and §4.                   |
| D3 Scripts and files                 | `package.json` scripts: `"storybook": "bun run storybook:manifest && storybook dev --port 6006 --ci"`, `"storybook:build": "bun run storybook:manifest && storybook build --output-dir storybook-static"`, `"storybook:manifest": "custom-elements-manifest analyze"`, `"test:stories": "bun run storybook:manifest && vitest run"`. New files: `.storybook/main.ts`, `.storybook/preview.ts`, `vitest.config.ts`, and `custom-elements-manifest.config.mjs` with `globs: ['src/**/*.ts']`, `exclude: ['src/**/*.stories.ts']`, `litelement: true`, `outdir: '.'`. Add `/custom-elements.json` to `.gitignore`; `storybook-static/` is already ignored. `tsconfig.json` gains `"include": ["**/*", ".storybook/**/*"]` and `"exclude": ["node_modules", "dist", "dev", "storybook-static"]`. `check` stays typecheck plus `bun test`; stories are typechecked by it but run only through `test:stories`, as `test:e2e` is separate.                                                                                                                                                  | Committing `custom-elements.json`: a derived file that drifts. Adding stories to `check`: needs browsers, which slows the fast agent loop.                                                                                                                                                  |
| D4 Storybook configuration           | `main.ts`: framework `@storybook/web-components-vite`; `stories: ['../src/**/*.stories.ts']`; the docs, a11y and vitest addons; `core.disableTelemetry: true`; no `staticDirs`. `preview.ts` (see _Interfaces_): imports `../css/style.css`, calls `initGlobalStyles()`, loads the manifest through `import.meta.glob('../custom-elements.json', { eager: true, import: 'default' })` so that typecheck passes when the file is absent, and sets `a11y.test = 'error'` with the WCAG tags of `tests/a11y.e2e.ts`. It sets `storySort` to Primitives, Components, Views. A global `beforeEach` resets `$appState` and `$route` and cancels same-origin link navigation, logging it as an action.                                                                                                                                                                                                                                                                                                                                                                                      | Mock Service Worker or `fetch` stubs for connected I/O: a new dependency; D6 avoids it by giving such components a presentational part. A global locale or RTL toolbar: no second locale exists yet.                                                                                        |
| D5 Story conventions                 | Stories are co-located as `{file}.stories.ts`. Titles are `Primitives/{Name}` for style primitives, `Components/{Name}` for custom elements and `Views/{Step}` for route views (none yet). Every meta has `tags: ['autodocs']`. The docs description holds the spec's usage rules as Do / Don't, with no MDX files. Required stories follow COMPONENTS §10. A block that renders no consumer text needs no Long label story; its spec says so. Stories that open a modal `<dialog>` set `parameters.docs.story.inline = false`, so the docs page stays usable. Criteria checked in stories are **criterion stories**: `name` starts with the ID (`'BTN-AC-2 Enter and Space activate'`), `tags: ['!dev', '!autodocs']`, with a `play` function. They run in Vitest under that name but stay out of the sidebar and the docs. Fixture strings may be literals. Fixture fragments are built with `sanitiseFragment()`, never `innerHTML`.                                                                                                                                              | MDX docs pages: an extra file per block, duplicating the spec. Criterion IDs in public story names: clutters the docs.                                                                                                                                                                      |
| D6 Connected components in Storybook | A connected component's stories set its stores in a story `beforeEach` (`$appState.set(fixture)`, `$route.set(parseRoute(path))`), after the global reset. A component is split into a connected element and a presentational element only when it also performs I/O (`fetch`, storage, router history) that a story cannot set. The sidebar and welcome modal stay single elements. The content modal is split (D12). Router-driving connected elements get no stories of their own; their presentational part has the stories and Playwright covers the journey.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Splitting every connected element into a connected and a presentational pair: doubles the elements and the public API for no user benefit (COMPONENTS §3, and the user's "no premature abstraction").                                                                                       |
| D7 Test locations (gaps 5, 17)       | `tests/**/*.test.ts` run under `bun:test` (non-DOM logic, plus happy-dom for non-component DOM). `tests/**/*.e2e.ts` run under Playwright (journeys, parity, route axe and emulation criteria: reduced motion, forced colours, viewport). `src/**/*.stories.ts` run under Storybook and Vitest (rendering, play-function criteria and axe in three browsers). Rename `tests/app-shell.test.ts` to `tests/app-shell.e2e.ts`; `playwright.config.ts` `testMatch` becomes `/.*\.e2e\.ts$/`. Emulation criteria for a block run on an app route where the block appears. No Storybook web server is added to Playwright until a block has no route.                                                                                                                                                                                                                                                                                                                                                                                                                                      | Co-located `*.test.ts` Playwright files (the current component specs): `bun test` would pick them up. A Storybook web server inside Playwright now: no block needs it yet.                                                                                                                  |
| D8 Naming standard                   | Files: kebab-case in `src/`, `tests/` (except `tests/fixtures/`), `scripts/` and `css/`. The only dot suffixes are `.store`, `.styles`, `.worker`, `.stories`, `.test`, `.e2e` and `.d`. A custom element's file is named after its tag. `ui-*` elements live in `src/components/`; `app-*` elements live in `src/features/{feature}/`. The shell is the feature `src/features/shell/`. `src/common/` holds framework-free shared code with no Lit imports. Identifiers: an element's class is the PascalCase of its tag; stores are `$camelCase`; actions are verb-first camelCase; style modules are `{name}Styles`; types are PascalCase with no `I` prefix; module constants are `UPPER_SNAKE_CASE`; events are `{prefix}-{noun}-{verb}`; scripts are `area:action`. CSS classes use the mockup vocabulary in lower case with hyphens (`block`, `block-part`, `block-variant`). State is expressed with native attributes, pseudo-classes or ARIA (`:disabled`, `[open]`, `[aria-current]`, `[hidden]`), never a state class. Component-private custom properties are `--_name`. | Moving every element into `src/components/`, as the draft card plans do: loses feature co-location (ARCHITECTURE). BEM `__`/`--`: the mockups already use single hyphens, and renaming would break parity.                                                                                  |
| D9 CSS standard                      | Native CSS only, in `css/*.css` and Lit `css` templates: no Tailwind, Bootstrap, Sass, Less, PostCSS plugins, CSS-in-JS beyond Lit, or utility-class system; Prettier with `prettier-plugin-css-order` formats it. Document CSS is `css/style.css`, which imports only `root.css` (tokens) and `base.css` (`html`, `body`, `main`, `p` and `a` defaults). Everything else is component `static styles` or a shared module. A shared module (`src/styles/*.styles.ts`) exists only for rules used by two or more elements, or by the document and an element. Rules: tokens only; logical properties for the inline direction; `rem` for type and spacing (`px` only for borders and outlines up to 3px); nesting at most three levels; no `!important`, ID selectors or `:host-context()`; motion inside `prefers-reduced-motion: no-preference`; `:focus-visible` outline from `--focus-ring`. No cascade layers: the document has two files and shadow roots scope component CSS, so layers would add ordering rules without solving a conflict. Revisit if document CSS grows.    | Cascade layers now: premature. Stylelint for enforcement: a new dependency, where three regex guards in the existing token test cover the rules that matter.                                                                                                                                |
| D10 New tokens                       | Add to the `css/root.css` App additions: `--backdrop: rgb(30 25 22 / 55%)` (replaces the literal in `dialogStyles`, as visual-design §2 already anticipates) and `--shadow-sidebar: -0.2rem 0 0.25rem 0.2rem rgb(73 57 47 / 0.15), -0.5rem 0 0.75rem 0.5rem rgb(73 57 47 / 0.2)` (the literal from mockup `.sidebar`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Inlining literals: forbidden by COMPONENTS §6.1.                                                                                                                                                                                                                                            |
| D11 Chiclet look (SEM-11)            | `.chiclet` takes the computed mockup values on `00` and `03-2` (`badges.css` wins the cascade over `steps.css`): `display: inline-block`; border 1px `--stone-600`; radius 0.25rem; padding-block 0.125rem; padding-inline 0.25rem; `--stone-800`; weight 500; size 0.75rem; the font is inherited. The solid variants `.chiclet-purple`, `.chiclet-teal` and `.chiclet-amber` take the `.badge` treatment: transparent border, padding-inline-start 0.375rem, letter-spacing 0.125rem, `text-transform: uppercase`. Backgrounds and text colours stay as decided in card.md Q13 (amber uses `--stone-900`, A11Y-04). Remove the monospace font, `line-height: 1rem` and `white-space: nowrap`: they are in no mockup, and `nowrap` can overflow translated text. The mockup `.badge` with no variant (blue) has no use and is not built.                                                                                                                                                                                                                                            | Keeping the monospace chiclet: matches no mockup.                                                                                                                                                                                                                                           |
| D12 Dialogs                          | Each dialog stays its own element, sharing `dialogStyles` (now including `.modal-header` and its heading) and `.btn-icon`. Every dialog title is an `<h2>` (SEM-04 and the dialog guide's "one consistent heading level"), which supersedes the `<h1>` in app-state-and-navigation §5.4. The content modal becomes a connected `app-content-modal` (route, loading and router close) and a presentational `app-content-dialog` (D6), so its loading, ready and error states have stories. No `ui-dialog` wrapper: native `<dialog>` already gives the behaviour, and a wrapper adds `aria-labelledby` problems across the shadow boundary. When the step-1 datasheet or step-3 model-description dialog is approved and has the same shape, promote `app-content-dialog` to `ui-content-dialog` in that plan.                                                                                                                                                                                                                                                                        | `ui-dialog` with slots: the IDREF cannot reach a slotted heading, and today it has two consumers whose content differs. `ui-content-dialog` now: its reuse is only in unapproved drafts.                                                                                                    |
| D13 i18n                             | T5 creates `src/i18n.ts` with exactly the step-1 D3 contract: export `i18n` (`createI18n`), `$locale` (read-only, base `en`) and `$format` (`formatter($locale)`), and derive `document.documentElement.lang` and `dir` from `LOCALES` when `document` exists. Each element declares `const messages = i18n('{tag}', { … })` in its own file and binds it with `StoreController`. Presentational elements may import their own `messages` store and `$format` only (the i18n exception step-1 also syncs). If step-1 T1 has already landed, T5 only verifies that the contract matches.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Leaving the shell strings literal: keeps gap 13 open (COMPONENTS §8).                                                                                                                                                                                                                       |
| D14 Narrow viewport                  | WCAG 1.4.10 (320px and 200% zoom) beats the desktop-only mockup. At `@media (width < 50rem)`, `app-sidebar` `:host` becomes `position: static; inline-size: auto; min-block-size: auto` and `main` gets `margin-inline-start: 0`, so the sidebar stacks above the content. No other design changes. 50rem is two 25rem columns: the fixed sidebar plus a usable main.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | A hamburger or drawer: needs a design and a spec. Fluid widths: changes the desktop parity.                                                                                                                                                                                                 |
| D15 Welcome dismissal                | `app-welcome-modal` calls `dismissWelcome()` from the dialog's `close` event, so Get Started, `Esc` and the back gesture all persist `welcomeDismissed`. This fixes the reopen bug. Copy follows `00_first-load.html`, as workflow-steps requires.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Persist only on Get Started: the dialog reopens on the next render after `Esc`.                                                                                                                                                                                                             |

### Interfaces and behaviour

**`.storybook/preview.ts`** exports a `Preview` with:

- `parameters.a11y = { test: 'error', options: { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } } }`. Keep the list identical to `AXE_TAGS` in `tests/a11y.e2e.ts`; add a comment in each file naming the other.
- `parameters.options.storySort = { order: ['Primitives', 'Components', 'Views'] }`.
- A global `beforeEach`, which runs before story-level hooks:
    1. Reset `$appState.set(INITIAL_APP_STATE)` and `$route.set(parseRoute('/data'))`.
    2. Add a `click` listener on `document` in the capture phase. It finds the first `HTMLAnchorElement` in `event.composedPath()`. If the anchor's `href` is same-origin and the click has no modifier keys, it calls `preventDefault()` and `action('navigate')(anchor.pathname)` from `storybook/actions`.
    3. Return a cleanup function that removes the listener.
- Top-level side effects: `import '../css/style.css'`, `initGlobalStyles()`, and `setCustomElementsManifest(manifest)` from `@storybook/web-components` when the glob found the file.

**`vitest.config.ts`**: one test project named `storybook`, using `storybookTest({ configDir: '.storybook' })`. Browser mode uses `provider: playwright()` and runs headless with instances `chromium`, `firefox` and `webkit`. Follow the addon's Vitest 4+ "test projects" setup. Add `.storybook/vitest.setup.ts` only if the 10.6 manual-setup page requires it. Nothing else is included, so `tests/**` never runs under Vitest.

**Conventions guard, `tests/repository-conventions.test.ts` (bun):**

- **CONV-1:** every file under `src/`, `tests/` (excluding `tests/fixtures/`), `scripts/` and `css/` matches `^[a-z0-9]+(-[a-z0-9]+)*(\.(store|styles|worker|stories|test|e2e|d))?\.(ts|css)$`. Ignore `.DS_Store`.
- **CONV-2:** for every `@customElement('x')`, the file is named `x.ts`; `ui-` elements are under `src/components/` and `app-` elements under `src/features/`.
- **CONV-3:** the class declared after the decorator is the PascalCase of the tag.
- **CONV-4:** no `src/common/**` file imports `lit`.

**Token guard additions (`tests/style-tokens.test.ts`), over the same file set as TOK-1:**

- **TOK-5:** no `margin-left`, `margin-right`, `padding-left`, `padding-right`, `border-left*`, `border-right*`, standalone `left:` or `right:`, `text-align: left|right` or `float: left|right` declarations.
- **TOK-6:** no `!important` and no `:host-context(`.
- `KNOWN_DRIFT` shrinks to `[]` by the end of T8.

**Style primitives (shared modules; none has properties, events, parts or custom properties):**

- **`buttonStyles`** (`src/styles/button.styles.ts`):
    - Add `.btn-icon` from mockup `button.css`:
        - `cursor: pointer`; no border; radius 0.5rem; `--stone-200` background; padding 0.5rem; `--stone-900`; `line-height: 0`;
        - a `:focus-visible` outline;
        - a hover background of `--stone-300` (from mockup `.project-settings:hover`), unconditional like `.btn`'s hover (button.md Q7 stays open);
        - `svg { inline-size: 1.5rem; block-size: 1.5rem }`.
    - A `.btn-icon` must contain an SVG with `aria-hidden="true" focusable="false"` and must have a localised `aria-label`. That makes it 40×40px, above the 24px target minimum.
    - Apply A11Y-01: `.btn` text becomes `--stone-700`.
- **`chicletStyles`** (`src/styles/chiclet.styles.ts`): D11.
- **`dialogStyles`** (`src/styles/dialog.styles.ts`):
    - `dialog` takes mockup `.modal`: `box-shadow: var(--shadow-deep)`, border `1px solid var(--stone-200)` (was 1.5px), and the existing radius, background, padding, width, max sizes, overflow and colour.
    - `dialog:modal { overscroll-behavior: contain }`.
    - `dialog::backdrop` uses `var(--backdrop)`, keeps its blur, and adds `overflow: hidden; overscroll-behavior: contain`.
    - `.modal-header { display: flex; justify-content: space-between; align-items: center; padding-block-end: 1rem }`.
    - `.modal-header h2 { margin: 0; color: var(--stone-800); font-weight: 500; font-size: 1.5rem }`.
- **`pageHeaderStyles`** (new `src/styles/page-header.styles.ts`): moves `.page-header` and its children from `base.css` unchanged, except `top` → `inset-block-start`, `margin-bottom` → `margin-block-end` and `justify-self: end`, which stays. Add `> h1:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px }`. `global.ts` adopts it alongside button, chiclet and dialog, and route views will include it in their own `static styles`.
- **`css/base.css`** keeps only these, converted to logical properties:
    - `html, body`;
    - `main`: `margin-inline-start: var(--sidebar-width)`, `--stone-50` background, padding 2rem and `min-block-size: calc(100dvh - 4rem)`. Drop the mockup's `overflow-y: scroll`, because app-state-and-navigation §8.1 forbids making `main` a scroll container;
    - `p` and `a`;
    - the D14 media query.
- `h3`, `input`, `select`, `::picker(select)`, `select::picker-icon` and `.file-picker` are removed from `base.css`; the feature plans port them from the mockups with A11Y-03, A11Y-07 and A11Y-08.

**`app-sidebar`** (connected, Tier 3, `src/features/shell/app-sidebar.ts`):

- **Public API:** the tag only. No properties, attributes, slots, events, methods, parts or custom properties.
- **Data:** reads `$appState` (`dataset`, `target`, `models`), `$route`, its own `messages` and `$format`. Writes nothing.
- **Styles:** `[chicletStyles, css`…`]`.
- **Markup** (shadow root):

```html
<p class="brand">{brand}</p>
<p class="tagline">{tagline}</p>
<section class="project" aria-labelledby="project-heading">
	<h2 id="project-heading">{project}</h2>
	<p class="project-name">{newProject}</p>
</section>
<nav class="workflow" aria-label="{workflow}">
	<ol class="steps">
		<li class="step">
			<a class="step-link" href="/data" aria-current="…">
				<span class="step-num">1</span>
				<!-- no dataset: --><span class="step-label">{loadData}</span>
				<!-- dataset: -->
				<span class="step-label-small">{dataset}</span>
				<span class="step-value">{dataset.name}</span>
				<span class="step-chiclets">
					<span class="chiclet">{rows, count}</span>
					<span class="chiclet">{columns, count}</span>
				</span>
			</a>
		</li>
		<!-- step 2, /target: {setTarget} | {target} + target name + one chiclet {type name} -->
		<!-- step 3, /models: no models → {trainModels}; models → step-label-small {models}, and after the link: -->
		<ul class="step-models">
			<li class="step-model">
				<a class="step-model-link" href="/models/{n}" aria-current="…">
					{model, num}
					<!-- training: --><span class="dot" aria-hidden="true"></span
					><span class="visually-hidden">{training}</span>
					<!-- trained:  --><span aria-hidden="true"> ✓</span
					><span class="visually-hidden">{trained}</span>
				</a>
			</li>
		</ul>
		<!-- step 4, /results: {compareResults} -->
	</ol>
</nav>
<footer>
	<a href="/about">{about}</a><span class="separator" aria-hidden="true">|</span>
	<a href="/privacy">{privacy}</a><span class="separator" aria-hidden="true">|</span>
	<a href="/help">{help}</a>
</footer>
```

- **Markup rules:**
    - `aria-current` values follow conformance D14 exactly: `"page"` when the `href` equals the workflow path, `"true"` on Train Models while on `/models/{n}`, otherwise `nothing`. Use an attribute binding, never `?`.
    - Model lists use `repeat(models, (m) => m.num, …)`.
    - The target type chiclet maps `ColumnType` to a message (`typeNumeric`, `typeCategorical`, `typeBoolean`, `typeDatetime`, `typeText`). The `{dataset.name}` and `{target}` values are consumer data and are never translated.
    - `ul.step-models` is a sibling of the step 3 link, never a child of it, because a list nested inside `<a>` is invalid. It sits in the label column through `padding-inline: 2rem 0.5rem; padding-block: 0.25rem 0.5rem; margin: 0`, which reproduces the mockup's `value` grid area.
- **Strings** (`i18n('app-sidebar', …)`, en):
    - `brand` "samatā.ml", `tagline` "Machine Learning in Your Browser", `project` "Project", `newProject` "New Project", `workflow` "Workflow";
    - `loadData` "Load Data", `setTarget` "Set Target", `trainModels` "Train Models", `compareResults` "Compare Results";
    - `dataset` "Dataset", `target` "Target", `models` "Models";
    - `rows` (count: "{count} row" / "{count} rows"), `columns` (count, same pattern), `model` (params: "Model {num}");
    - `training` "training", `trained` "trained";
    - the five type names "Numeric", "Categorical", "Boolean", "Date/time", "Text";
    - `about` "about", `privacy` "privacy", `help` "help".
    - Counts are formatted with `$format` number grouping.
- **CSS:**
    - Copy the computed mockup values for every mapped selector.
    - `:host` takes `.sidebar` (`position: fixed; inset-block: 0; inset-inline-start: 0; z-index: 100; box-shadow: var(--shadow-sidebar); background-color: var(--stone-150); inline-size: var(--sidebar-width); min-block-size: 100dvh; overflow-y: auto; display: flex; flex-direction: column`) plus `:host([hidden]) { display: none }` and the D14 query.
    - `.brand` takes the computed values of `.sidebar h1` (margins 1.25rem 1.25rem 0, `--stone-900`, weight 600, 1.75rem); `.project h2` takes those of `.project h4` (UA 1em bold, margin 0, `--stone-900`).
    - `.project` is a single-column grid, because the settings column is not built.
    - `.step:has(> .step-link[aria-current])` takes `.step[aria-current]`.
    - Current links: `cursor: default`, no hover change, and `.step-label` weight 600 (A11Y-09).
    - Hover rules apply only to `:not([aria-current])`.
    - Step and model links get `:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: -2px }`. The offset is inset, because `.step { overflow: hidden }` clips an outer outline (a change from mockup, A11Y-10).
    - `footer`: A11Y-02 colour `--stone-700`; links `--stone-800`; `.separator { padding-inline: 0.5em }`.
    - `.dot` comes from `steps.css` with every animation inside the reduced-motion query; `.visually-hidden` comes from `train-model.css` with logical sizes.
    - All transitions sit inside `@media (prefers-reduced-motion: no-preference)`.
- **Changes from the mockup CSS:** SEM-01, SEM-02, SEM-09, A11Y-02, A11Y-09 and A11Y-10 (inset offset); project-settings button and next-step dot not built; model list moved out of the link; D14.

**`app-welcome-modal`** (connected, Tier 3, `src/features/shell/app-welcome-modal.ts`):

- **Public API:** the tag only.
- **Data:** reads `$appState.onboarding.welcomeDismissed`, `$route` and `messages`; calls `dismissWelcome()`. Styles `[dialogStyles, buttonStyles, chicletStyles, css`…`]`.
- **Markup:**
    - `<dialog aria-labelledby="welcome-title" @close=${this.handleClose}>`;
    - `<header class="modal-header"><h2 id="welcome-title">{brand} <span class="chiclet chiclet-amber">{beta}</span></h2></header>`;
    - `<p class="lead">{lead}</p>`, then `<p>{body}</p>`;
    - `<button type="button" class="btn btn-primary" @click=${this.handleGetStarted}>{getStarted}</button>`.
- **Mockup changes:**
    - The mockup's `<h2>` tagline becomes `p.lead`, with the computed values of mockup `dialog > h2` (proposed SEM-12: it is a tagline, not a section heading).
    - The mockup's `aria-label="Close modal"` on Get Started is dropped, because it breaks WCAG 2.5.3 Label in Name (proposed SEM-13).
    - `aria-modal` is dropped.
    - The inline `min-height: 50dvh` becomes local `dialog { min-block-size: 50dvh }`.
    - `.btn-full` becomes local `.modal-actions button { inline-size: 100% }`, because it has one use.
    - `.chiclet-amber` follows A11Y-04.
- **Behaviour:**
    - `updated()` calls `showModal()` when `!welcomeDismissed`, the route kind is `workflow` or `root`, and the dialog is closed. It calls `close()` when the dialog should not be open.
    - Both `handleGetStarted` and `handleClose` call `dismissWelcome()`, which is idempotent; Get Started then calls `close()`.
    - No `open = true` fallback.
- **Strings** (en): `brand` "samatā.ml", `beta` "beta", `lead` "train machine learning models inside your browser.", `body` "The samatā.ml platform allows anyone to learn key Artificial Intelligence concepts through hands-on experimentation.", `getStarted` "Get Started".

**`app-content-dialog`** (presentational, Tier 2, `src/features/shell/app-content-dialog.ts`, class `AppContentDialog`). Public API, closed:

| Item                                     | Detail                                                                                                                                                                                                                                                    |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `open`                                   | `boolean`, default `false`, attribute `open`, not reflected. `true` → `showModal()` when it changes and the dialog is closed; `false` → `close()` when it changes and the dialog is open.                                                                 |
| `heading`                                | `string`, default `''`, attribute `heading`.                                                                                                                                                                                                              |
| `contentLang`                            | `string`, default `''`, attribute `content-lang`. BCP 47 tag of the content; applied to the heading and the body only when `status === 'ready'` and the value is not empty.                                                                               |
| `contentDir`                             | `'ltr' \| 'rtl' \| ''`, default `''`, attribute `content-dir`. Applied with `contentLang`.                                                                                                                                                                |
| `content`                                | `DocumentFragment \| null`, default `null`, property only. Rendered as a node when `status === 'ready'`; never mutated (render a `cloneNode(true)` made in `willUpdate` when `content` changes).                                                          |
| `status`                                 | `'loading' \| 'ready' \| 'error'`, default `'loading'`, attribute `status`, not reflected.                                                                                                                                                                |
| Event `app-content-dialog-close`         | `CustomEvent<Record<string, never>>`, `detail: {}`, `bubbles: false`, `composed: false`. The parent listens on this element. Dispatched from the native `close` event of the inner `<dialog>`, so it covers the close button, `Esc` and the back gesture. |
| Slots, parts, custom properties, methods | None.                                                                                                                                                                                                                                                     |

- **Markup:**

```html
<dialog aria-labelledby="content-dialog-title" @close="…">
	<header class="modal-header">
		<h2 id="content-dialog-title" lang="…" dir="…">${heading}</h2>
		<button type="button" class="btn-icon" aria-label="{close}" @click="…">
			<svg …close icon from 00_first-load #close, aria-hidden="true" focusable="false"></svg>
		</button>
	</header>
	<section class="modal-content" aria-busy="true|false" lang="…" dir="…">
		<!-- ready: content | error: <p role="alert">{loadError}</p> | loading: empty -->
	</section>
</dialog>
```

- **Styles:** `[dialogStyles, buttonStyles, css`…`]`. Draft-only, so the local CSS is limited to `:host { display: contents }`, `:host([hidden]) { display: none }` and `.modal-content > * + * { margin-block-start: 1rem }`.
- **Strings** (en): `close` "Close"; `loadError` "This content could not be loaded. Check your connection, then close this dialog and try again."
- **Owned strings only:** the heading and content are consumer data.

**`app-content-modal`** (connected, Tier 3, `src/features/shell/app-content-modal.ts`):

- **Public API:** the tag only.
- **Behaviour:**
    - Keeps the existing load logic (`AbortController`, request sequence and `loadContentEntry`).
    - Renders `<app-content-dialog .open=${isReserved} .heading=… .contentLang=… .contentDir=${LOCALES[entry.lang].dir} .content=… .status=… @app-content-dialog-close=${this.handleClose}>`.
    - `handleClose` calls `closeReserved()` unless `getIsSyncingFromHistory()`.
- **Fallback titles:** move to messages (`about` "About", `privacy` "Privacy", `help` "Help").
- **Styles:** `:host { display: contents }` and `:host([hidden]) { display: none }`.

**State placement:** no new state. All persisted state is already in `$appState` (`welcomeDismissed`, `dataset`, `target`, `models`); the route is in `$route`. Content-loading status, entry and body stay `@state` in `app-content-modal` (transient).

## Specification changes

What `specification/` must say once this plan is implemented. The final task applies these items and ticks each one; `task_gate.py --check-complete` refuses to close the plan while any is unticked.

- [ ] `specification/COMPONENTS.md` §1, §2, §4, §6.2, §6.3, §8, §9, §10, §11 — these sections say:
    - the Storybook stack is installed (D1, D2, D4);
    - element placement and class naming (D8);
    - when a shared module may exist and the CSS authoring rules (D9);
    - the i18n-only exception for presentational elements (D13);
    - test locations (D7);
    - story conventions, criterion stories, store fixtures and which blocks get stories (D5, D6);
    - §10 is in force.
    - The status line drops "Storybook (§10) does not exist" and the shell-violation clause, and keeps `partial` only for anything still unbuilt.
- [ ] `specification/visual-design.md` §1.1, §2, §3, §4, §5 — the following:
    - `--backdrop` and `--shadow-sidebar` are listed (D10);
    - the §3 table gains `page-header.styles.ts`, the sidebar's local `.dot` and `.visually-hidden`, and `base.css` scope (D9);
    - the `css/` copies are removed;
    - D14 is a §4 translation rule for the shell;
    - A11Y-01, 02, 04, 09 and 10, and SEM-01, 02 and 04, are marked applied;
    - SEM-11 records the D11 look;
    - SEM-12 (welcome tagline paragraph) and SEM-13 (no `aria-label` overriding visible text) are added.
    - The status line says the shell matches the mockups.
- [ ] `specification/ARCHITECTURE.md` Directory Structure, Delivery and Caching — the entry is `src/app.ts`, the stylesheet is `/style.css`, and the directory list covers `src/components/` (`ui-*`), `src/features/shell/`, `src/styles/`, `src/types/` and the framework-free `src/common/`; `.storybook/` is a development-only tool.
- [ ] `specification/standards-and-documentation.md` (new "Naming" section) — the D8 naming standard and the CONV guard; status stays `partial` (lint gap 7).
- [ ] `specification/testing.md` — runners and locations per D7; Storybook and Vitest browser mode for stories; happy-dom only for non-component DOM; status line updated (Comlink remains target).
- [ ] `specification/app-state-and-navigation.md` §2, §5.4 — component specs exist for the shell; `app-content-modal` composes `app-content-dialog`; welcome dismissal by any path persists the flag (D15); dialog headings are `<h2>` (D12).
- [ ] `specification/content-and-i18n.md` Localisation Store — the `src/i18n.ts` instance and formatter exist (shared with step-1; apply only if not already applied).
- [ ] `specification/components/button.md` §3–§12 — `.btn-icon` is in the public API, with its accessible-name rule and stories; A11Y-01 is applied and the wrong contrast claim corrected (TODO-27); icon-only buttons are removed from the non-goals; the test file paths follow D7; the status line is updated.
- [ ] `specification/components/chiclet.md` (new) — `.chiclet` style primitive per D11, with variants, mapping, criteria and stories; resolves card.md's "chiclet has no spec" dependency.
- [ ] `specification/components/dialog.md` (new) — the `dialogStyles` primitive, `.modal-header` and the `<h2>` rule.
- [ ] `specification/components/page-header.md` (new) — the `.page-header` primitive.
- [ ] `specification/components/sidebar.md` (new) — `app-sidebar` as built.
- [ ] `specification/components/welcome-modal.md` (new) — `app-welcome-modal` as built.
- [ ] `specification/components/content-modal.md` (new) — `app-content-modal` and `app-content-dialog` as built.
- [ ] `specification/components/card.md` §3, §9, §10 — file paths move to `src/features/data/app-dataset-card.ts` and `src/features/models/app-model-card.ts` (D8); the tests are `tests/*.e2e.ts` and criterion stories (D7); the chiclet dependency points to chiclet.md.
- [ ] `specification/components/virtual-table.md` §10 — test file paths follow D7.
- [ ] `specification/README.md` — new component spec rows and statuses.
- [ ] `specification/TODO.md` — TODO-27 resolved; TODO-34 narrowed to the transient dialogs; TODO-35 narrowed by removing the chiclet, modal, sidebar step list and page header; TODO-53 narrowed to the mockup files only.
- [ ] Known gap 1 — Resolved.
- [ ] Known gap 2 — Resolved.
- [ ] Known gap 5 — Resolved.
- [ ] Known gap 13 — Resolved.
- [ ] Known gap 17 — Resolved.

## Implementation tasks

### T1 — Repository conventions, moves and guard

- **Depends on:** None in this plan. External: [state-navigation-conformance](state-navigation-conformance.md) T8 must be complete, because it edits `src/features/navigation/app-sidebar.ts` and `src/app.ts`, which this task moves or touches.
- **Risk:** routine
- **Likely files:**
    - `src/features/shell/app-sidebar.ts`, `src/features/shell/app-content-modal.ts`, `src/features/shell/app-welcome-modal.ts` (moved with `git mv` from `src/features/navigation/` and `src/features/onboarding/`);
    - `src/app.ts` (import paths only);
    - `src/config/pipelineSteps.ts` (delete);
    - `src/common/.gitkeep`, `src/features/.gitkeep`, `src/router/.gitkeep`, `src/stores/.gitkeep`, `src/styles/.gitkeep` (delete);
    - `tests/app-shell.test.ts` → `tests/app-shell.e2e.ts` (`git mv`);
    - `playwright.config.ts`, `tests/style-tokens.test.ts` (`KNOWN_DRIFT` paths only), `tests/repository-conventions.test.ts` (new), `README.md`.
- **Must not touch:** element code beyond import paths, styles, stores, router, any other test logic and `specification/`.
- **Implementation:**
    - Move the three elements; update imports in `src/app.ts` and the `KNOWN_DRIFT` paths.
    - Delete the empty `pipelineSteps.ts` and the five listed `.gitkeep` files; every one of those directories contains source files.
    - Rename the shell test and set `testMatch: /.*\.e2e\.ts$/`.
    - Fix `README.md`: the template is the root `index.html`, not `public/index.html`.
    - Write CONV-1 to CONV-4 as specified, with each test name starting with its ID. For CONV-2 and CONV-3, find `@customElement('…')` with a regex over source text; do not import the modules.
- **Acceptance criteria:**
    - [ ] CONV-1 to CONV-4 pass. Each fails when you temporarily add a `badName.ts` file or put an `app-` element under `src/components/` (check locally, then revert).
    - [ ] `rg -n "features/navigation|features/onboarding|pipelineSteps" src tests scripts` finds nothing.
    - [ ] `bun run test:e2e tests/app-shell.e2e.ts` still passes, and no Playwright config special-cases a `.test.ts` file.
- **Verification:** `bun run check` (expect 158 plus the new CONV tests, 0 fail); `bun run test:e2e tests/app-shell.e2e.ts`; `bun run format` on the changed files.
- **Progress:** [ ] Not started

### T2 — Install and configure Storybook, Vitest and the manifest; button stories

- **Depends on:** T1
- **Risk:** needs care — new toolchain, a pinned Vite major for decorators (D2), and Node-run CLIs under Bun scripts
- **Likely files:** `package.json`, `bun.lock` (through `bun add` only), `tsconfig.json`, `.gitignore`, `.storybook/main.ts`, `.storybook/preview.ts`, `vitest.config.ts`, `custom-elements-manifest.config.mjs`, `src/styles/button.styles.ts` (A11Y-01 colour only), `src/styles/button.stories.ts`, `tests/a11y.e2e.ts` (cross-reference comment only), `AGENTS.md` (Commands and Baseline lines only)
- **Must not touch:** `src/app.ts`, the shell elements, `scripts/` (the production build is unchanged), `playwright.config.ts`
- **Implementation:**
    - `bun add -d` the exact D1 packages. Write the D3 scripts and files and the D4 configuration, with the preview exactly as in _Interfaces_. Do not run `storybook init` or `storybook add`.
    - In `buttonStyles`, change the `.btn` text colour to `var(--stone-700)` (A11Y-01, approved), or the Default story fails axe.
    - Write `src/styles/button.stories.ts`, title `Primitives/Button`. Stories, per button.md §9: Default, Primary, Pair, Disabled, Long label (60 characters in a 200px container), RTL (`dir="rtl" lang="ar"`, Arabic label) and In shadow root.
    - In shadow root defines `story-button-host` inside the story file with `@customElement` and one `@property() accessor label = ''`, renders `<button class="btn">${this.label}</button>` with `static styles = [buttonStyles]`, and binds the story arg `label`.
    - Write criterion stories BTN-AC-1 (default and primary in one story; the axe pass is the assertion), BTN-AC-2 (Tab, Enter, Space: one click each), BTN-AC-4 (disabled: no click, background unchanged on hover), BTN-AC-9, BTN-AC-11 and BTN-AC-12.
    - In `AGENTS.md`, add `bun run storybook`, `bun run storybook:build` and `bun run test:stories` to Commands, and update the Baseline to the measured counts.
- **Acceptance criteria:**
    - [ ] SB-AC-1: `bun run storybook:build` exits 0 and writes `storybook-static/index.json` listing the Primitives/Button stories. Criterion stories are present with tags `!dev` and `!autodocs`.
    - [ ] SB-AC-2: `bun run test:stories` runs every Button story in chromium, firefox and webkit with zero axe violations. A deliberate contrast violation (temporarily set the text to `--stone-500`) fails the run; revert it.
    - [ ] SB-AC-3: the In shadow root story renders a styled button whose text updates when the `label` arg changes (play function). This proves that standard `accessor` decorators work under Vite 7 (assumption A1).
    - [ ] SB-AC-4: `bun run typecheck` passes with and without `custom-elements.json` present, and `bun test` collects no story file.
    - [ ] SB-AC-5: `bun run storybook` starts on :6006 with telemetry disabled; the Docs page for Button shows the usage rules as Do / Don't. Check manually; record a screenshot in the log.
    - [ ] Clicking a same-origin link inside any story logs a `navigate` action and does not navigate the iframe (check manually).
- **Verification:** `bun run check`; `bun run storybook:build`; `bun run test:stories`; manual `bun run storybook`; `bun run format` on the changed files.
- **Progress:** [ ] Not started

### T3 — Document CSS, tokens, page header and guards

- **Depends on:** T2
- **Risk:** needs care — deletes CSS that parity entries still read, and the guard changes can expose existing violations
- **Likely files:**
    - `css/style.css`, `css/base.css`, `css/root.css`;
    - delete `css/badges.css`, `css/button.css`, `css/card.css`, `css/dot.css`, `css/dropzone.css`, `css/loading.css`, `css/modal.css`, `css/notifications.css`, `css/sidebar.css`, `css/steps.css`, `css/table.css`, `css/train-model.css`;
    - `src/styles/page-header.styles.ts` (new), `src/styles/page-header.stories.ts` (new), `src/styles/global.ts`, `src/app.ts`;
    - `tests/style-tokens.test.ts`, `tests/visual-parity/map.ts` (entries `main`, `page-header-h1`, `page-header-p`).
- **Must not touch:** the shell elements, the other `src/styles/*` modules, `specification/mockups/`
- **Implementation:**
    - `css/style.css` imports only `root.css` and `base.css`; remove `.icon`, `.columns` and `.column`.
    - Rewrite `base.css` per _Interfaces_, including the D14 `main` rule. Add the D10 tokens to the `root.css` App additions block.
    - Create `pageHeaderStyles` and add it to `global.ts`.
    - In `src/app.ts`:
        - remove the inline `<style>` block, the `#app-container` wrapper and `role="main"`;
        - keep `<app-sidebar>`, `<main id="content">` and the modals as siblings;
        - change each placeholder `<div class="page-header">` to `<header class="page-header">`, and its `<p class="description">` to a plain `<p>`.
    - Remove `src/app.ts` from `KNOWN_DRIFT`.
    - Add TOK-5 and TOK-6. Remove `knownDrift` from the `main` and page-header parity entries.
    - Stories `Primitives/Page Header`: Title and description, With action (a `.btn-primary`), Long title (120 characters), RTL; criterion story PH-AC-1 for `h1:focus-visible` (focus with `tabindex="-1"`, then `matches(':focus-visible')`, then a computed outline of at least 2px).
- **Acceptance criteria:**
    - [ ] PH-AC-2: the parity entries `main`, `page-header-h1` and `page-header-p` pass without `knownDrift`.
    - [ ] TOK-5 and TOK-6 pass; each fails when a `margin-left` or `!important` is temporarily added to `css/base.css`.
    - [ ] `rg -n "<style" src` finds nothing, and `KNOWN_DRIFT` no longer lists `src/app.ts`.
    - [ ] At a 375px viewport, `main` has computed `margin-inline-start: 0px` (Playwright, added to `tests/app-shell.e2e.ts` as PH-AC-3).
- **Verification:** `bun run check`; `bun run test:stories`; `bun run test:e2e tests/visual-parity.e2e.ts tests/app-shell.e2e.ts tests/a11y.e2e.ts`; `bun run format` on the changed files.
- **Progress:** [ ] Not started

### T4 — Primitives: `.btn-icon`, chiclet and dialog, with stories

- **Depends on:** T3
- **Risk:** routine
- **Likely files:** `src/styles/button.styles.ts`, `src/styles/button.stories.ts`, `src/styles/chiclet.styles.ts`, `src/styles/chiclet.stories.ts` (new), `src/styles/dialog.styles.ts`, `src/styles/dialog.stories.ts` (new), `tests/visual-parity/map.ts` (entries `modal-dialog`, `btn-primary`)
- **Must not touch:** the shell elements (T6–T8 adopt these modules), `src/styles/card.styles.ts`, `css/`
- **Implementation:**
    - Apply `.btn-icon`, D11 and the `dialogStyles` changes exactly as in _Interfaces_.
    - Button: add an Icon story with the `#close` path from `00_first-load.html` inlined (`aria-hidden="true" focusable="false"`), labelled `aria-label="Close"`. Add criterion stories BTN-AC-13 (the Icon story's button is found by role `button` with name "Close", and its `svg` is `aria-hidden`) and BTN-AC-14 (the rendered size is at least 24×24).
    - Chiclet stories (`Primitives/Chiclet`): Default ("344 rows"), Purple, Teal, Amber ("beta"), Long label, RTL; criterion story CHIP-AC-1, where computed `text-transform` is `uppercase` only on the variants.
    - Dialog stories (`Primitives/Dialog`, `docs.story.inline = false`): Default (a `.modal-header` `<h2>` and a paragraph), Long content (scrolls inside the dialog), RTL. Each story's `play` function opens the dialog with `showModal()`. Criterion story DLG-AC-1: `:modal` matches and `Esc` closes the dialog.
    - The `btn-primary` and `modal-dialog` parity entries stay drift-free where they already are; leave the welcome-specific entries to T7.
- **Acceptance criteria:**
    - [ ] `bun run test:stories` passes for Button, Chiclet and Dialog in all three browsers.
    - [ ] `dialog.styles.ts` contains no literal colour, and the token guard passes.
    - [ ] Computed `.btn` text colour is `rgb(109, 96, 86)` (A11Y-01).
- **Verification:** `bun run check`; `bun run test:stories`; `bun run format` on the changed files.
- **Progress:** [ ] Not started

### T5 — i18n foundation

- **Depends on:** T1
- **Risk:** routine
- **Likely files:** `src/i18n.ts`, `tests/i18n.test.ts` (new)
- **Must not touch:** `src/config/locales.ts`, the elements (T6–T8 add messages)
- **Implementation:**
    - If `src/i18n.ts` already exists from step-1 T1, check that its exports match D13 and record the result in the log; do not change it.
    - Otherwise create it per D13 with TSDoc. `$locale` is a read-only store fixed to `BASE_LOCALE`. `i18n = createI18n($locale, { get: () => Promise.resolve({}) })` is enough while only the base locale exists. `$format = formatter($locale)`. A `$locale` subscription sets `lang` and `dir` on `document.documentElement` when `document` is defined.
    - Tests: I18N-AC-1 (`$locale.get() === 'en'`); I18N-AC-2 (a `messages` store returns the base strings, with `count` and `params` applied); I18N-AC-3 (`<html>` gets `lang="en"` and `dir="ltr"` under happy-dom).
- **Acceptance criteria:**
    - [ ] I18N-AC-1 to I18N-AC-3 pass.
    - [ ] The exports are exactly `i18n`, `$locale` and `$format`, plus their types.
- **Verification:** `bun test tests/i18n.test.ts`; `bun run check`; `bun run format` on the changed files.
- **Progress:** [ ] Not started

### T6 — Sidebar to the mockup, with stories

- **Depends on:** T4, T5
- **Risk:** needs care — the largest visual port; must keep the conformance `aria-current` contract and avoid nested interactive content
- **Likely files:** `src/features/shell/app-sidebar.ts`, `src/features/shell/app-sidebar.stories.ts` (new), `tests/visual-parity/map.ts` (sidebar entries), `tests/style-tokens.test.ts` (`KNOWN_DRIFT`), `tests/app-shell.e2e.ts` (selector `nav.steps` → `nav.workflow`; SIDE e2e criteria)
- **Must not touch:** `src/router/**`, `src/stores/**`, the other elements, the `aria-current` logic's outcomes (conformance D14)
- **Implementation:**
    - Rebuild the element exactly per _Interfaces_ → `app-sidebar`, with messages and computed mockup values.
    - Remove the file from `KNOWN_DRIFT`.
    - Update the parity map: remove `knownDrift` from `sidebar`, `sidebar-tagline`, `sidebar-project`, `step-links`, `step-current` and `sidebar-footer`. Rename `sidebar-h1` to `sidebar-brand` (app selector `app-sidebar .brand`), and repoint `step-links` and `step-current` to `app-sidebar .step:nth-child(n) .step-link`. `step-current` compares only `color` and `background-color`. Add three entries:
        - `step-current-border`: mockup `.step[aria-current]` vs `app-sidebar .step:nth-child(1)`, `border-top-color`;
        - `step-current-label`: mockup `.step[aria-current] .step-label` vs `app-sidebar .step:nth-child(1) .step-label`, `font-weight`, with deviation `{ value: '600', register: 'A11Y-09' }`;
        - `project-heading`: mockup `.project h4` vs `app-sidebar .project h2`.
    - Stories `Components/Sidebar` (layout `fullscreen`): Empty (on `/data`); Dataset loaded (Penguins, 344 rows, 9 columns); Target set (`species`, categorical, on `/target`); Models (on `/models/2`, three models: draft, training and trained); Long label (an 80-character dataset name and target); RTL (`dir="rtl"`, Arabic dataset name).
    - Criterion stories:
        - SIDE-AC-1: exactly one `[aria-current="page"]` on `/data`.
        - SIDE-AC-2: on `/models/2`, Train Models has `aria-current="true"` and the Model 2 link has `"page"`.
        - SIDE-AC-3: every step and model link is reachable with Tab, with a visible outline at least 2px.
        - SIDE-AC-4: the training model has visually hidden "training" text and the dot is `aria-hidden`.
        - SIDE-AC-5: no `a a` or `a ul` nesting.
        - SIDE-AC-6: exactly one heading and it is an `h2`; there is no `h1`.
    - Playwright in `tests/app-shell.e2e.ts`:
        - SIDE-AC-7: at a 320px viewport, there is no horizontal scroll, and the sidebar is `position: static` and above `main`.
        - SIDE-AC-8: with `prefers-reduced-motion: reduce`, the `.dot` `::before` has `animation-name: none` and links have `transition-duration: 0s`.
        - SIDE-AC-9: with `forced-colors: active`, a focused step link has a visible outline.
- **Acceptance criteria:**
    - [ ] SIDE-AC-1 to SIDE-AC-9 pass in all three browsers.
    - [ ] All sidebar parity entries pass with no `knownDrift`; deviations are cited by register ID.
    - [ ] The token guard passes with the sidebar removed from `KNOWN_DRIFT`; there is no literal string in the template (all text comes from messages or data).
    - [ ] The existing `tests/app-shell.e2e.ts` and `tests/router-and-navigation.test.ts` pass unchanged, apart from the `nav.steps` selector update.
- **Verification:** `bun run check`; `bun run test:stories`; `bun run test:e2e tests/app-shell.e2e.ts tests/visual-parity.e2e.ts tests/a11y.e2e.ts`; manual side-by-side with `00_first-load.html` and `03-2` at 1440×900 (visual-design §6.5), with screenshots in the log; `bun run format` on the changed files.
- **Progress:** [ ] Not started

### T7 — Welcome modal to the mockup, with stories

- **Depends on:** T6
- **Risk:** routine
- **Likely files:** `src/features/shell/app-welcome-modal.ts`, `src/features/shell/app-welcome-modal.stories.ts` (new), `tests/visual-parity/map.ts` (`modal-dialog`, new `modal-heading`, new `welcome-beta`), `tests/style-tokens.test.ts` (`KNOWN_DRIFT`), `tests/app-shell.e2e.ts` (WEL e2e)
- **Must not touch:** `src/stores/app.store.ts` (`dismissWelcome` exists), the router, the other elements
- **Implementation:**
    - Rebuild per _Interfaces_ → `app-welcome-modal` and D15; remove the file from `KNOWN_DRIFT`.
    - Parity: remove `knownDrift` from `modal-dialog`. Add `modal-heading` (mockup `dialog.modal .modal-header h1` vs app `app-welcome-modal .modal-header h2`: font-size, font-weight, color) and `welcome-beta` (mockup `.badge.badge-amber` vs app `app-welcome-modal .chiclet-amber`: background-color, font-size, letter-spacing, text-transform; colour deviation A11Y-04).
    - Stories `Components/Welcome Modal` (`docs.story.inline = false`): Open (on `/data`, not dismissed) and RTL. Long label is not applicable, because the element renders no consumer text; say so in the docs description.
    - Criterion stories: WEL-AC-1 (Get Started sets `welcomeDismissed` and closes the dialog); WEL-AC-2 (`Esc` sets `welcomeDismissed` and the dialog stays closed after a store change triggers a re-render); WEL-AC-3 (the dialog's accessible name is "samatā.ml beta", and Get Started has no `aria-label`).
    - Playwright WEL-AC-4: after a reload, a dismissed welcome stays closed.
- **Acceptance criteria:**
    - [ ] WEL-AC-1 to WEL-AC-4 pass; the existing `a11y.e2e.ts` A11Y-E2E-1 and A11Y-E2E-2 pass.
    - [ ] The parity entries pass, with A11Y-04 cited.
- **Verification:** `bun run check`; `bun run test:stories`; `bun run test:e2e tests/app-shell.e2e.ts tests/visual-parity.e2e.ts tests/a11y.e2e.ts`; `bun run format` on the changed files.
- **Progress:** [ ] Not started

### T8 — Content dialog and content modal, with stories

- **Depends on:** T7
- **Risk:** needs care — the element split must keep router close semantics (`closeReserved` versus history sync) and the existing content e2e journeys
- **Likely files:** `src/features/shell/app-content-dialog.ts` (new), `src/features/shell/app-content-dialog.stories.ts` (new), `src/features/shell/app-content-modal.ts`, `tests/content.e2e.ts` (selectors `h1` → `h2`, `.modal-body` → `.modal-content`, `button.close-btn` → `button.btn-icon`), `tests/app-shell.e2e.ts` (same selector updates), `tests/a11y.e2e.ts` (new A11Y-E2E-3), `tests/style-tokens.test.ts` (`KNOWN_DRIFT` becomes `[]`)
- **Must not touch:** `src/router/**`, `src/common/content/**`, `content/`
- **Implementation:**
    - Build `app-content-dialog` and slim `app-content-modal` per _Interfaces_, with `@fires`, `@property` and TSDoc tags for the manifest.
    - Stories `Components/Content Dialog` (`docs.story.inline = false`):
        - Loading;
        - Ready: a fixture built with `sanitiseFragment()` from the body of `drafts/00-2_content-modal.html` (paragraph, `h2`, list, `h3`, ordered list, blockquote, table, `pre`, link);
        - Error;
        - Long heading (120 characters);
        - RTL: `contentLang` `ar`, `contentDir` `rtl`, Arabic fixture.
    - Criterion stories:
        - CDLG-AC-1: the close button fires exactly one `app-content-dialog-close`.
        - CDLG-AC-2: `Esc` fires it.
        - CDLG-AC-3: the dialog is named by its heading, and the close button is named "Close".
        - CDLG-AC-4: `lang` and `dir` are applied only when the status is ready.
        - CDLG-AC-5: the content fragment passed in is not mutated (its `childNodes.length` is unchanged after rendering twice).
        - CDLG-AC-6: in the error state there is one `role="alert"`.
    - Playwright: A11Y-E2E-3 runs axe with `/about` open and loaded, with zero violations. The existing content journeys pass with the updated selectors.
    - Confirm assumption A4 from `custom-elements.json` and record it.
- **Acceptance criteria:**
    - [ ] CDLG-AC-1 to CDLG-AC-6 and A11Y-E2E-3 pass; `tests/content.e2e.ts` and `tests/app-shell.e2e.ts` pass in all three browsers.
    - [ ] `KNOWN_DRIFT` is `[]` and TOK-4 still passes; no parity entry has `knownDrift`.
    - [ ] Neither `app-content-modal` nor `app-content-dialog` sets `dialog.open = true` or adds `role`, `aria-modal` or a key handler.
- **Verification:** `bun run check`; `bun run test:stories`; `bun run test:e2e`, the full suite: report the counts and compare with the T1 run; `bun run storybook:build`; `bun run format` on the changed files.
- **Progress:** [ ] Not started

### T9 — Sync specification

- **Depends on:** T1, T2, T3, T4, T5, T6, T7, T8
- **Risk:** needs care — specs must describe what was built, not what was planned; seven new component specs follow the COMPONENTS §12 template
- **Likely files:** every path under _Specification changes_, plus `.agents/skills/lit-architecture/SKILL.md` (step 8: stories are now required, not deferred) and `.agents/skills/lit-implementer/SKILL.md` (the Storybook install line)
- **Must not touch:** product code, tests and `specification/mockups/`
- **Implementation:** Apply every item under _Specification changes_, following "Writing specs" in `specification/README.md`. Where the log records a deviation from the plan, document the deviation, not the plan. Update each changed spec's status line and its row in the index, and narrow or resolve _Known gaps_. Remove the HUMAN.md items this plan resolved.
- **Acceptance criteria:**
    - [ ] Every item under _Specification changes_ is applied and ticked.
    - [ ] No changed spec contradicts the code or another spec, or mentions this plan, its tasks or the history of the change.
    - [ ] `bun run plans:check` reports no spec index mismatch.
- **Verification:** `bun run plans:check`; `git diff specification/` reviewed against _Specification changes_
- **Progress:** [ ] Not started

## Verification and definition of done

- [ ] All task acceptance criteria met.
- [ ] `bun run check` introduces no new failures compared with the baseline recorded above (158 pass, 0 type errors).
- [ ] `bun run test:stories` passes in Chromium, Firefox and WebKit with zero axe violations.
- [ ] `bun run test:e2e` passes, including parity with no `knownDrift`, `a11y.e2e.ts` and the content and shell journeys.
- [ ] `bun run build` still succeeds; Storybook adds nothing to `dist/`.
- [ ] Manual checks recorded in the log:
    - keyboard-only walk through the sidebar, the welcome modal and `/about` in Chromium and Firefox;
    - VoiceOver on Safari announces the current step as "current page" and the dialog names;
    - 200% zoom and 320px width;
    - Windows High Contrast, or Chromium forced-colours emulation, shows focus and the chiclet boundaries.
- [ ] Every item under _Specification changes_ is ticked, and the specs describe the code as built.
- [ ] No unintended changes outside the tasks' likely files.

## Risks and open questions

- **Blocking:** None. The plan needs the user's approval to become `ready`.
- **Non-blocking:**
    - **External dependency.** T1 waits for state-navigation-conformance T8, which is in progress in the working tree. Do not start T1 on a tree where `app-sidebar.ts` still has uncommitted conformance edits.
    - **Decorator toolchain (D2).** Pinning Vite 7 means a future major upgrade of Storybook may need Vite 8. Owner: whoever upgrades Storybook. Mitigation: SB-AC-3 fails loudly if decorators stop being lowered.
    - **Overlap with draft plans.**
        - step-1 D3 and this plan's T5 create the same `src/i18n.ts`; the first one to land wins, and the other only verifies it.
        - step-1, step-3 and virtual-table say "Storybook not installed / deferred". After T2 they must add stories (COMPONENTS §10).
        - D8 moves `app-dataset-card` and `app-model-card` into `src/features/data/` and `src/features/models/`.
        - Their dialogs should reuse `dialogStyles`, `.modal-header` and `.btn-icon`, and consider promoting `app-content-dialog` (D12).
        - Recorded in HUMAN.md for their review. Owner: the planner who revises those drafts.
    - **Spec conflict.** app-state-and-navigation §5.4 says the dialog heading is `<h1>`; visual-design SEM-04 says `<h2>`. Decided `<h2>` (D12); T9 updates §5.4.
    - **Design calls a human may want to restyle:** the D14 narrow layout (stacked sidebar below 50rem), the proposed SEM-12 and SEM-13 rows, and the omitted project-settings button and next-step dot. Recommended: accept as specified; restyle later through mockups. Recorded in HUMAN.md.
    - **The content dialog is draft-only** (visual-design §1.1): awaiting a styled mockup. The existing HUMAN.md "Style content modal" item covers it.
    - **Test time.** Stories run in three browsers. If `test:stories` exceeds about three minutes, a later decision may run Firefox and WebKit only in `test:e2e`. Do not change the instances without a plan decision.

## Implementation and verification log

| When (UTC) | Task | Outcome / commands / evidence |
| ---------- | ---- | ----------------------------- |
| —          | —    | Not started                   |

## Change log

| When (UTC)           | Change        | Reason                                                                                                                                                                 |
| -------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-13T22:48:56Z | Initial draft | User request: migrate components and views to Storybook, with a small semantic WCAG-conformant component set, streamlined naming and native CSS; absorbs Known gap 13. |
