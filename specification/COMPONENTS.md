# Engineering Conventions for Components

**Status:** partial — the shared primitives, shell, base-locale i18n, CEM workbench and three-browser story runner are implemented. Model card and chooser stories are implemented. Remaining data, target, model and virtual-table story coverage and wider feature-style consolidation are follow-up work; exact outstanding feature contrast findings are tracked in [Known gap](README.md#known-gaps) 13.

Applies to every component, style primitive and store in this repository. Agents MUST read this file before implementing any spec in `specification/components/`.

The key words MUST, MUST NOT, SHOULD, SHOULD NOT and MAY are used as in RFC 2119. A component spec overrides a rule here only when it says so explicitly ("Overrides §n because …"). Silence in a component spec means this file applies.

When a spec is ambiguous or seems wrong, the agent MUST stop and list the question rather than choose an answer. Inventing API, tokens, strings or design decisions is a defect even if the result works.

## 1. Project decisions

| Decision                   | Value                                                                                                                                                                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework                  | Lit 3, TypeScript (strict)                                                                                                                                                                                                                            |
| State                      | nanostores; `@nanostores/lit` for binding stores to connected components                                                                                                                                                                              |
| i18n                       | `@nanostores/i18n`                                                                                                                                                                                                                                    |
| Custom element prefix      | Reusable, feature-agnostic elements: `ui-`, e.g. `<ui-modal>`, `<ui-virtual-table>`. Feature-specific elements: `app-`, e.g. `<app-dashboard>`. The prefix says where an element belongs, not its tier (§2): an `app-` element can be presentational. |
| Browser support            | Evergreen browsers; Baseline "widely available" features only. CSS nesting is permitted.                                                                                                                                                              |
| Accessibility target       | WCAG 2.2 level AA                                                                                                                                                                                                                                     |
| Component acceptance tests | Playwright in Chromium, Firefox and WebKit                                                                                                                                                                                                            |
| Docs                       | Storybook 10.6.7 (`@storybook/web-components-vite`), Vite 7.3.8, a11y/Docs/Vitest addons and Vitest 5.1.0; development only (§10).                                                                                                                    |
| Charts                     | Observable Plot 0.6.18 (exact pin, ISC), imported only by the shared `PlotController` (`src/features/results/charts/plot-controller.ts`). Elements render charts through the controller, never import Plot themselves.                                |
| Decorators                 | TypeScript standard decorators (`experimentalDecorators` is off). See §4 for what this requires.                                                                                                                                                      |

### Web platform rules

- Prefer native semantic HTML, CSS and browser APIs over custom JavaScript (e.g. `<dialog>`, `popover`, form validation).
- Use progressive enhancement for anything not yet Baseline Widely available; experimental APIs need explicit human approval and a fallback.
- Before using an unfamiliar platform feature, look it up with the `modern-web-guidance` skill. Planners record the guide IDs in the plan so implementers do not search again.
- Record any intentional departure from these rules in the spec or plan, with the reason.

## 2. Choose the lowest tier that works

Every UI building block is exactly one of these. A spec MUST state which tier it is.

1. **Style primitive.** CSS only, applied to a native element that already has the correct semantics and behaviour (`<button>`, `<input>`, `<a>`). No JavaScript, no custom element. This is the default for anything that only needs to _look_ different.
2. **Presentational component.** A Lit element. Data in through properties and slots, intent out through events. MUST NOT import stores.
3. **Connected component.** A Lit element that reads stores and calls actions. It SHOULD contain little markup of its own and compose presentational components.

A block is promoted to a higher tier only when a spec requires behaviour the lower tier cannot provide. Promotion requires a revised spec, not an agent's judgement.

## 3. Public API is closed

The public API of a block is everything its spec lists under **Public API**: tag name, classes, properties and attributes, slots, events, methods, CSS parts, CSS custom properties, and exported symbols. Anything not listed MUST NOT be public.

- Agents MUST NOT add properties, variants, options, slots, parts or exports beyond the spec. If one seems necessary, note it under "Proposed changes" in the PR description instead.
- No base classes, mixins, shared helpers or "generic" components until three concrete, spec'd call sites need the same thing, and a spec authorises the extraction.
- No props for hypothetical futures. No variant enums with values nobody uses.
- Prefer slots for content and composition over props that carry content.
- Do not wrap a native element in a custom element just to rename or restyle it.
- Do not build form-associated custom elements (`static formAssociated = true`, `ElementInternals`) unless a spec requires a custom form control. Use native form controls.
- When in doubt, less code. Removing an option is better than documenting it.
- The component spec is the normative source of truth for its API. Generated `custom-elements.json` is a derived documentation artifact and MUST NOT expand or override the API in the spec.

## 4. Lit practices and component documentation

**Elements and members**

- One element per file. File name matches the tag name (`app-dataset-picker.ts`).
- TypeScript/CSS filenames use kebab-case with established role suffixes (`.store`, `.styles`, `.worker`, `.stories`, `.test`, `.e2e`, `.d`). Reusable `ui-*` elements live in `src/components/`; domain `app-*` elements live directly in their `src/features/<feature>/` folder, including `shell`, `data` and `models`. The class is PascalCase of its tag. `src/common/` contains framework-free utilities and MUST NOT import Lit or `@nanostores/lit`. CONV-1–4 enforce these boundaries; story-only test hosts are not production elements.
- Register with `@customElement('app-…')` or `@customElement('ui-…')`, as specified, and augment `HTMLElementTagNameMap`.
- Public reactive properties use `@property`; internal state uses `@state` and is `private`. Reflect attributes only when CSS needs them.
- Domain identity convention: Elements that represent a specific dataset or model entity reflect their domain key as a typed, hyphenated attribute (e.g. `dataset-id="iris"`), never an untyped generic `id` or raw DOM ID.
- Decorated reactive fields MUST use the `accessor` keyword: `@property() accessor label = '';`, `@state() private accessor open = false;`. A plain field (`@property() label = '';`) fails typecheck and throws "Unsupported decorator location: field" at runtime.
- Overridden Lit members (`render`, `updated`, `willUpdate`, `firstUpdated`, `connectedCallback`, `disconnectedCallback`, `styles`) use `override`.
- Internal methods and fields use TypeScript `private` (e.g. `private handleClick()`), not `#private` names. Decorators cannot be applied to `#private` names.

**Rendering**

- `render()` is pure: no side effects, no store writes, no DOM queries.
- Return `nothing` (from `lit`) for an empty branch, not `''`, `null` or `undefined`.
- A list whose items can be added, removed or reordered uses `repeat(items, (item) => item.id, …)` with a stable ID. Never key by array index.
- Use `classMap()` for conditional classes and put fixed rules in `static styles`. For computed geometry, use native attributes on elements such as `<progress>` or SVG, or assign individual properties through `element.style` (CSSOM). The production policy `style-src-attr 'none'` blocks template `style` attributes and Lit `styleMap()` bindings.
- Bind properties with `.prop=${…}`, boolean attributes with `?attr=${…}` and listeners with `@event=${this.handleX}`. Lit calls listeners with `this` set to the host, so do not use `.bind()` or arrow wrappers.
- Do not use `unsafeHTML` or `unsafeCSS`.
- First-party content is rendered only from the `DocumentFragment` returned by the content loader (`src/common/content/`); never with `unsafeHTML`, `innerHTML` or string templates.
- Never mutate objects received through properties. Emit an event instead.

**Derived values**

- A value derived from stores is a `computed` store (§5).
- A value derived from the element's own properties is computed in `willUpdate(changed)` and stored in a `private` field.
- Never set a reactive property in `updated()`: it triggers a second update.

**Lifecycle**

- Side effects go in `updated()` / `firstUpdated()`, never in `render()`.
- Anything that needs teardown (listeners on other objects, observers, timers) is set up in `connectedCallback()` and torn down in `disconnectedCallback()`.
- If the setup needs rendered shadow DOM, do it in `firstUpdated()` for the first connection, and in `connectedCallback()` when `this.hasUpdated` is true for later connections. `firstUpdated()` runs only once, so an element that is removed and re-attached would otherwise lose the resource.
- Prefer a reactive controller (`hostConnected()` / `hostDisconnected()`) for such setup. A controller used by one element is declared in that element's file. A controller used by several elements is a shared helper and needs the authorisation in §3. Authorised: `PlotController`, which observes a stable chart wrapper, coalesces resizes to one animation frame, resolves chart tokens, inserts the detached plot and exposes `whenSettled()`. It measures text and re-renders on container, font-loading and root text-size changes, sets the SVG name and description, removes descendant aria labels and hides data-mark groups. The shared Lit-free `chart-encoding.ts` helper is authorised for symbol and contrast mappings, integer ticks and responsive label fitting across results charts; see [charts.md](charts.md).

**Events and DOM**

- Use native events where they exist (`click`, `input`, `change`). Custom events carry a typed `detail` and use the prefix of the element that fires them: `ui-<noun>-<verb>` from `ui-` elements and `app-<noun>-<verb>` from `app-` elements. Set `bubbles` and `composed` only when the spec says the event must cross a shadow boundary.
- Read light-DOM children only through slots (`slotchange`, `assignedElements`).
- Never query another element's `shadowRoot`.
- Shadow DOM by default. Use `delegatesFocus: true` when the host should act as the focus target.

**Documentation**

- The project uses `@custom-elements-manifest/analyzer` to generate `custom-elements.json` for Lit component documentation. Document public APIs with JSDoc/CEM tags: `@slot`, `@fires`, `@csspart` and `@cssprop`. The manifest feeds Storybook autodocs; it is generated and is not a substitute for the component spec.

## 5. State (nanostores)

- Stores live in `src/stores/`, never inside component files.
- Only connected components import stores, using `StoreController` from `@nanostores/lit`. Do not hand-write store subscriptions or controllers that call `store.subscribe()`.
- There is no application-wide state machine. Where the user is comes from the router's store; what the user has done is in persisted stores ([ARCHITECTURE.md](ARCHITECTURE.md), "Hybrid state model").
- Components never import workers or touch IndexedDB. Large data reaches them through stores or properties.
- Derived values use `computed`; do not derive in `render()`.
- Mutations go through exported action functions in the store module. Components call actions; they do not call `store.set()` directly.
- Components MUST NOT call `history.*` or read `location`. Navigation is an `<a href>` (intercepted by the router) or a router action; the current route is read from the router's store. See [app-state-and-navigation.md §5](app-state-and-navigation.md).
- Any user-controlled UI state that is not a transient overlay and must survive a reload (selected column, step completion, chosen options, etc.) lives in a store with an action, not in a component's private `@state`. Presentational components receive it as a property and emit an event; the connected component calls the action. See [state-and-storage.md §5](state-and-storage.md).
- Modal overlays use a native `<dialog>` opened with `showModal()` and the shared [dialog styles](components/dialog.md). Content `dialog.modal` uses a sticky `.modal-header` and `closedby="any"`. The approved pointer fallback applies only where `closedBy` is unavailable. Beta welcome uses `closedby="none"` and prevents the native `cancel` event until consent. Confirmations use `dialog.confirm-dialog` with a plain-text body, Cancel first and idle Escape. Busy protected confirmations use `closedby="none"` and prevent native `cancel`. Native semantics supply the modal role and focus containment.
- Use `overscroll-behavior: contain` on the dialog and both hidden overflow and contained overscroll on its backdrop. The shell locks user scrolling on the document root while a native modal is open, preserving the page offset and allowing dialog content to scroll. User dismissal of a reserved-route modal calls `closeReserved()` through its connected owner. Property and route updates suppress the queued native close intent so history changes only once.
- A route view exposes `whenSettled(): Promise<void>`, resolved once its layout height is stable, so the router can restore scroll position.
- Requested heading focus is a separate capability: `focusHeading(signal: AbortSignal): Promise<void>` on data, target, models overview, model builder, results comparison and nested dataset preview. Already-aborted/disconnected calls are no-ops. Each method awaits its own Lit render, rechecks cancellation/connection, then queries only its own `.page-header > h1` and focuses with `preventScroll: true`. The data view delegates preview focus through the preview's method. It never waits for metadata, rows or `whenSettled()`, returns internal nodes, crosses a shadow boundary or requests focus on an ordinary resource update. The shell cancels pending requests on every render; the router retains ownership of whether focus is requested ([navigation §5.6](app-state-and-navigation.md#56-document-title-and-focus)).

## 6. Styles and design tokens

Styling crosses shadow boundaries in exactly two sanctioned ways.

**6.1 Tokens.** `css/root.css`, loaded by `/style.css`, is the only token file. The token vocabulary is closed; adding a token requires a plan decision and an entry in [visual-design.md](visual-design.md). Custom properties inherit into shadow roots, so every component sees them without imports. Components MUST use tokens for colour, and MUST NOT use literal colours (`#hex`, `white`, `rgb()`, `hsl()`), including inside `var()` fallbacks. Fallbacks on global tokens are forbidden.

**6.2 Shared style modules.** Rules that must apply both in the document and inside shadow roots (e.g. style primitives) live in `src/styles/<name>.styles.ts` and export a Lit `CSSResult`. That single export is the only source of the rules:

- Components include it in `static styles = [buttonStyles, css`…`];`.
- `src/styles/global.ts` adopts the same sheets into the document:
  ```ts
  document.adoptedStyleSheets = [
      ...document.adoptedStyleSheets,
      ...[buttonStyles].map((s) => s.styleSheet!).filter(Boolean)
  ];
  ```
- The rules MUST NOT be duplicated into a `.css` file.

**6.3 Rules for all CSS**

- Component styles live only in `static override styles`, never in a `<style>` element in `render()`.
- Every component's styles include `:host { display: …; }` (whatever display the host needs) and `:host([hidden]) { display: none; }`.
- Use logical properties (`padding-inline`, `border-block-end`, `margin-inline-start`) so layouts work in right-to-left locales.
- Do not use `!important` or `:host-context()`. TOK-5/6 inspect CSS declarations and Lit CSS templates, not unrelated JavaScript coordinate objects.
- All transitions and animations sit inside `@media (prefers-reduced-motion: no-preference)`.
- Every focusable thing has a `:focus-visible` style using `outline` (not `box-shadow`, which disappears in forced-colours mode), at least 2px, colour from a token.
- Form controls set `font-family: inherit` (browsers do not inherit fonts into controls).
- CSS parts and component-level custom properties are public API (§3) and exist only when a spec lists them.

**6.4 Matching the mockups.** The `ready` and `implemented` mockups in `specification/mockups/` define how every user-visible surface looks. Follow [visual-design.md](visual-design.md): use only tokens from `css/root.css` with no fallbacks, record every visual deviation in the A11Y or SEM registers, and run the parity and token tests for any UI change. Where only a `draft` mockup exists, follow [visual-design.md §1.1](visual-design.md#11-draft-mockups): structure from the draft, existing styles only, no parity entries.

## 7. Accessibility (WCAG 2.2 AA)

- Native elements first. ARIA only when no native element provides the semantics, and never to override correct native semantics.
- Everything operable by pointer is operable by keyboard. No positive `tabindex`.
- Every control has an accessible name. A spec for anything that can be icon-only MUST say how the name is supplied.
- Contrast: text at least 4.5:1 (3:1 for large text); boundaries and focus indicators at least 3:1 where they are needed to identify the control or its state.
- Pointer targets at least 24×24 CSS px.
- Information is never conveyed by colour alone.
- Must work at 200% zoom and 320px viewport width, with reduced motion, and in forced-colours mode.
- Focus indicators are always visible (`:focus-visible`); never remove an outline without an equivalent replacement.
- Respect user text size: font sizes and text containers use `rem`/`em`, never fixed `px` heights that clip text. Motion and animation respect `prefers-reduced-motion`.
- Automated checks are necessary, not sufficient: each spec lists its manual checks.

## 8. Internationalisation (`@nanostores/i18n`)

- No user-visible string literal in component code, including `aria-label`, `title` and `alt` text.
- `src/i18n.ts` creates the single i18n instance. Each component declares its own base-locale messages with `i18n('<tag-name>', { … })` in its own file and subscribes to them with `StoreController`.
- Interpolation and plurals use the library's `params` and `count` helpers. Never concatenate strings to build a sentence.
- Numbers, dates and lists are formatted with the i18n formatter, never by hand.
- The locale store takes its supported locales and base locale from `src/config/locales.ts`, and drives `lang` and `dir` on `<html>`.
- Layouts MUST tolerate labels roughly 40% longer than English and right-to-left direction: no fixed widths on text, no clipping, logical properties only.
- Presentational component exception: Tier 2 presentational components do not import store subscriptions or `src/i18n.ts`. Instead, they accept pre-translated strings through a typed `labels` property object with explicit default fallbacks, or render consumer-supplied content directly.
- The two presentational cards retain the explicit i18n-only exception in [card.md](components/card.md); it grants no access to domain stores and is not a general Tier 2 exception.
- A block that renders only consumer-supplied text owns no strings and its spec MUST say so.

## 9. Testing

- Every acceptance criterion has an ID (e.g. `BTN-AC-3`). Every ID has at least one test whose name starts with that ID. A criterion without a test is not done.
- Component acceptance criteria MUST run in real browsers through Playwright; do not use jsdom or a lightweight DOM simulator for component behaviour. Tests live under `tests/**/*.e2e.ts`, including `tests/journeys/`; `bun:test` collects `*.test.ts` non-component logic such as store actions and pure utilities. Happy-dom supports non-component DOM utilities only.
- Test observable behaviour (rendered output, computed styles, events, accessibility tree). Do not assert private state or snapshot shadow DOM markup.
- Stories are smoke tests: every story runs with an axe scan, and axe violations fail the run. `bun run test:stories` uses the Storybook Vitest addon and Playwright provider in Chromium, Firefox and WebKit; it does not replace Playwright acceptance, history, emulation or screenshot tests. Put interactions in `play` functions where possible. Reduced motion and forced colours belong in Playwright `*.e2e.ts` files. Bun, Vitest and Playwright collection boundaries do not overlap.
- Every block is tested with `dir="rtl"` and with a long label.
- History, scroll restoration and `<dialog>` behaviour (back/forward, reload, new-tab resume, viewport-width invalidation) are tested in Playwright, never in a simulated DOM. Pure routing/hydration/reconciliation logic is tested with `bun:test` and an in-memory `Storage`.

## 10. Storybook

The installed workbench previews production components and their actual shared styles. Current coverage is Button, Chiclet, Dialog, Page Header, Sidebar, Welcome and Content Dialog. Existing feature stories remain a scoped backlog, not a reason to defer stories for new work.

- `bun run storybook` generates the CEM then serves port 6006 with telemetry disabled; `bun run storybook:build` writes ignored `storybook-static/`; `bun run storybook:manifest` regenerates ignored `custom-elements.json`. These tools do not enter the production bundle.
- Vite/esbuild lowers standard decorators; `experimentalDecorators` stays off. The decorated test-only button host lives in `.storybook/fixtures/`, imported by its story, so the story parser does not have to parse an auto-accessor declaration.
- Preview imports document tokens/base CSS and adopts shared sheets. Each story receives a fresh cloned store/route fixture and English/LTR document attributes; cleanup restores previous values and listeners. Stories never bootstrap routing, persistence or storage. Same-origin story links log to Actions instead of navigating the workbench, while modified/external/target/download/hash links retain native behaviour. Docs stories use isolated iframes.

- One `*.stories.ts` per block, co-located with its source, including style primitives.
- Required stories: each variant, each state the spec lists, Long label, RTL. Components also need a story per slot configuration the spec lists.
- Autodocs come from the Custom Elements Manifest for Lit components or the story's `parameters.docs` description for style primitives.
- CEM-generated properties and events supply component API controls. Agents MUST NOT hand-write component `argTypes` or property controls that duplicate the manifest; story-specific controls may be declared when required by the story.
- The docs page includes the spec's usage rules as Do / Don't.

## 11. Definition of done

- [ ] Only the spec's public API exists (§3).
- [ ] Every acceptance criterion has a passing test named with its ID.
- [ ] Computed styles match the mapped mockup (parity test), deviations cited by register ID.
- [ ] No unknown tokens or literal fallbacks (token guard).
- [ ] All stories pass axe with zero violations.
- [ ] Manual a11y checks in the spec done and noted in the PR.
- [ ] No string literals, no literal colours, no physical-direction CSS.
- [ ] Stories cover variants, states, Long label and RTL.
- [ ] Open questions in the spec are either answered by a human or still listed.

## 12. Component spec template

Each spec in `specification/components/` uses these sections, in this order:

1. **Summary**: one paragraph; what it is and the tier (§2).
2. **Decision and rationale**: why this tier and shape; rejected alternatives.
3. **Public API (closed)**: exhaustive.
4. **Usage**: canonical code examples and usage rules.
5. **Visual specification**: mockup page(s) and selectors, tokens, states, normative CSS if it is a style primitive, and 'Changes from the mockup CSS' with register IDs.
6. **Accessibility**: requirements beyond §7, plus manual checks.
7. **Internationalisation**: strings owned, layout constraints.
8. **Acceptance criteria**: numbered, testable, with IDs.
9. **Stories**.
10. **Files**: what is created or modified.
11. **Non-goals**: what not to build, explicitly.
12. **Open questions**: for a human to answer; agents must not resolve these.
