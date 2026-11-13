# Spec: Card (`app-dataset-card`, `app-model-card`)

Status: Draft — `cardStyles` (§5.4) is built; `app-dataset-card` and `app-model-card` are not; Q4–Q12 are open · Tier: **Presentational component** ×2 (conventions §2) · Criterion prefix: `CARD`

Read [`COMPONENTS.md`](../COMPONENTS.md) first. This spec follows its §12 template. Where this spec
is silent, COMPONENTS.md applies. The only explicit override is in §2 (shared style module).

## 1. Summary

Two presentational Lit elements that render the same visual "card" for two kinds of content:

- **`<app-dataset-card>`** shows a dataset's name, description, column and row counts, and two
  actions: _Datasheet_ and _Select Dataset_.
- **`<app-model-card>`** shows a model's type label, an illustration, name, description, and two
  actions: _Model Description_ and _Select Model_.

Data comes in through properties (and one slot for the model illustration). Intent goes out through
custom events. Neither component imports a store, except the i18n message store that
[COMPONENTS.md §8](../COMPONENTS.md) prescribes.

## 2. Decision and rationale

**Decision (spec owner, 2026-11-05):** two separate custom elements, one per content type, sharing
one style module.

**Why not a style primitive (§2 lowest tier).** The HTML and CSS could be delivered as a `.card`
class, as `.btn` is. The card, however, must own translated button labels, pluralised and
compact-formatted counts, and a translated model-type label. It must also emit events from its
buttons. None of that can live in CSS, so every consumer would repeat it. That is the "behaviour the
lower tier cannot provide" that §2 requires for promotion. The spec owner chose this promotion.

**Why two elements, not one `ui-card` with slots.** The two variants differ in content and in
strings. Each element has a small, typed, closed API (plain properties), with no slot configuration
for consumers to get wrong. Neither is a "primitive UI" element, so both use the `app-` prefix (Q4).

**Why the model image is a slot.** The original markup injects `{model_svg: string}`. Rendering an
SVG string in Lit needs `unsafeHTML`, which §4 forbids. A named slot takes a real `<svg>` element
from the consumer instead. This follows §3 ("prefer slots for content").

**Shared style module (explicit override of §3).** §3 says no shared helpers before three spec'd
call sites exist. _Overrides §3 because_ the two cards must stay visually identical, and two
hand-copied stylesheets would drift. `src/styles/card.styles.ts` exports `cardStyles`, and both
elements include it. It is **not** adopted into the document by `global.ts`, because card markup only
exists inside these two shadow roots.

**Rejected alternatives:** a `.card` style primitive; one `ui-card` with six slots; one
`<app-card kind="dataset|model">` with a union of properties (that makes half of its API invalid at
any time); a base class for the two elements (violates §3).

## 3. Public API (closed)

### `<app-dataset-card>`

| Item                                  | Detail                                                                                                                                                                                 |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tag                                   | `app-dataset-card`. Class `AppDatasetCard` in `src/components/app-dataset-card.ts`.                                                                                                    |
| `name`                                | `string`, default `''`. Attribute `name`. Dataset title.                                                                                                                               |
| `description`                         | `string`, default `''`. Attribute `description`.                                                                                                                                       |
| `columns`                             | `number`, default `0`. Attribute `columns`. Column count.                                                                                                                              |
| `rows`                                | `number`, default `0`. Attribute `rows`. Row count.                                                                                                                                    |
| Slots                                 | None.                                                                                                                                                                                  |
| Events                                | `app-dataset-datasheet-open` and `app-dataset-select`, each `CustomEvent<{ name: string }>`. `detail.name` is the card's `name` at dispatch time. `bubbles: false`, `composed: false`. |
| Parts, CSS custom properties, methods | None.                                                                                                                                                                                  |

### `<app-model-card>`

| Item                                  | Detail                                                                                                                       |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Tag                                   | `app-model-card`. Class `AppModelCard` in `src/components/app-model-card.ts`.                                                |
| `type`                                | `'classification' \| 'regression' \| 'clustering'`. Attribute `type`. Required; no default.                                  |
| `name`                                | `string`, default `''`. Attribute `name`. Model title.                                                                       |
| `description`                         | `string`, default `''`. Attribute `description`.                                                                             |
| Slots                                 | `image`: one `<svg viewBox="0 0 360 216">` element. No default slot.                                                         |
| Events                                | `app-model-description-open` and `app-model-select`, each `CustomEvent<{ name: string }>`. Same rules as the dataset events. |
| Parts, CSS custom properties, methods | None.                                                                                                                        |

### Shared

| Item         | Detail                                                 |
| ------------ | ------------------------------------------------------ |
| `cardStyles` | `CSSResult` exported from `src/styles/card.styles.ts`. |

Notes:

- Properties are not reflected to attributes. CSS does not need them (§4).
- `columns` and `rows` use Lit's default `Number` attribute converter.
- The `type` union is declared locally in `app-model-card.ts` and not exported (§3). Reconcile it
  with any model-type type that later appears in `src/types/`.
- `--card-padding` is an internal custom property declared on the inner `.card`. It is **not**
  public API and consumers MUST NOT set or rely on it.
- Nothing else is public: no other attributes, events, slots, parts or exports. Both classes are
  registered with `@customElement(...)` and added to `HTMLElementTagNameMap`.

## 4. Usage

The consumer owns the grid and the list semantics. A card is an `<article>`, so the consumer
puts each one in a list item:

```html
<h2>…</h2>
<ul class="cards">
	<li>
		<app-dataset-card
			name="Penguins"
			description="Body measurements for three penguin species."
			columns="5"
			rows="344"></app-dataset-card>
	</li>
</ul>

<ul class="cards">
	<li>
		<app-model-card type="classification" name="Logistic regression" description="…">
			<svg slot="image" viewBox="0 0 360 216">…</svg>
		</app-model-card>
	</li>
</ul>
```

In a Lit view:

```ts
html`<app-dataset-card
	name=${d.name}
	description=${d.description}
	columns=${d.shape.columns}
	rows=${d.shape.rows}
	@app-dataset-select=${this.onSelect}
	@app-dataset-datasheet-open=${this.onDatasheet}></app-dataset-card>`;
```

Usage rules:

- Do place cards under an `<h2>`. The card's heading is a fixed `<h3>`.
- Do wrap each card in an `<li>` of a `<ul>` (or `<ol>`).
- Do give `app-model-card` exactly one `<svg slot="image" viewBox="0 0 360 216">`. A different
  aspect ratio breaks the layout contract (5:3).
- Do listen for events on the card element itself. Events do not bubble.
- Don't put focusable content or `<a>` elements inside the slotted SVG. It is hidden from assistive
  technology (§6), so that content would be unreachable.
- Don't pass translated or formatted text for the buttons, counts or type. The card owns those strings.
  `name` and `description` are consumer-supplied data; the card owns no translation for them.
- Don't use `unsafeHTML` to inject an SVG string. Parse or construct a real element in the consumer.
- Don't set a width on the card. It fills its container. The consumer sets the container width.

## 5. Visual specification

### 5.1 Tokens used

All from `css/root.css`: `--surface` (`#fff`; resolved Q1), `--stone-100`, `--stone-200`,
`--stone-800` (`.stat` only), `--stone-900` (`.card-title`, `.card-text`; resolved Q2/Q14/Q15), `--font-mono`, plus the chiclet
background tokens `--purple-700`, `--teal-700` and `--amber-500` (resolved Q3/Q13). The chiclet
spec owns how the chiclet uses them.
No literal colours.

### 5.2 Structure

Dataset card (shadow root):

```html
<article class="card">
	<h3 class="card-title" id="title">…</h3>
	<p class="card-text">…</p>
	<p class="card-stats">
		<span class="stat">…</span>
		<span class="stat">…</span>
	</p>
	<div class="card-actions">
		<button type="button" class="btn" aria-describedby="title">…</button>
		<button type="button" class="btn btn-primary" aria-describedby="title">…</button>
	</div>
</article>
```

Model card (shadow root):

```html
<article class="card">
	<span class="card-type chiclet chiclet-{colour}">…</span>
	<div class="card-image" aria-hidden="true"><slot name="image"></slot></div>
	<h3 class="card-title" id="title">…</h3>
	<p class="card-text">…</p>
	<div class="card-actions">
		<button type="button" class="btn" aria-describedby="title">…</button>
		<button type="button" class="btn btn-primary" aria-describedby="title">…</button>
	</div>
</article>
```

- The whitespace between the two `.stat` spans must be a real space in the rendered template.
- The `{colour}` comes from `type` (resolved Q3): `classification` → purple (`--purple-700`),
  `regression` → teal (`--teal-700`), `clustering` → amber (`--amber-500`). These are the chiclet's
  solid **background** colours. Class names are `chiclet-purple`, `chiclet-teal` and
  `chiclet-amber` (resolved Q13); the chiclet spec defines them. The original HTML's
  `chiclet-pink` is not used.
- `id="title"` is unique inside the shadow root, so it needs no prefixing.

### 5.3 Static states

The card is not interactive. It has no hover, active, focus or disabled state of its own. Its two
buttons carry their own states from [`button.md`](../components/button.md).

### 5.4 Normative CSS (`cardStyles`)

```css
:host {
	display: block;
}

:host([hidden]) {
	display: none;
}

.card {
	--card-padding: 1rem;

	display: flex;
	position: relative;
	flex-direction: column;
	gap: 0.5rem;
	box-sizing: border-box;
	border: 1.5px solid var(--stone-200);
	border-radius: 1rem;
	border-block-end-width: 3px;
	background-color: var(--surface); /* replaces literal #fff; --surface is #fff */
	padding-inline: 0;
	padding-block: 0 1rem;
	block-size: 100%;
	overflow: hidden;

	> :not(.card-image):not(.card-type) {
		padding-inline: var(--card-padding);
	}

	.card-image {
		display: block;
		background-color: var(--stone-100);
		inline-size: 100%;
		block-size: auto;
	}

	.card-type {
		position: absolute;
		inset-block-start: 1rem;
		inset-inline-start: 1rem;
	}

	.card-title {
		margin-inline: 0;
		margin-block: 0.25rem 0;
		color: var(--stone-900);
		font-weight: 600;
		font-size: 1.5rem;

		&:first-child {
			margin-block-start: 1rem;
		}
	}

	.card-text {
		margin: 0;
		color: var(--stone-900);
		line-height: 1.5rem;
	}

	.card-stats {
		margin-inline: 0;
		margin-block: 0.5rem;

		.stat {
			border-radius: 0.25rem;
			background-color: var(--stone-200);
			padding-inline: 0.375rem;
			padding-block: 0.25rem;
			color: var(--stone-800);
			font-size: 0.875rem;
			font-family: var(--font-mono);
		}
	}

	.card-actions {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-block-start: auto;
	}
}

::slotted(svg) {
	display: block;
	inline-size: 100%;
	block-size: auto;
}
```

Each element also includes `buttonStyles` (from `button.md`) and, in the model card, the chiclet
style module (chiclet spec dependency):

```ts
static styles = [buttonStyles, cardStyles];            // app-dataset-card
static styles = [buttonStyles, chicletStyles, cardStyles]; // app-model-card
```

Changes from the original CSS, for the reviewer:

- Wrapped in `:host` and an inner `<article class="card">`, so the host can be a grid item. The
  `:host { display: block }` and `block-size: 100%` make the card fill its grid cell. That keeps
  cards in one row equal in height, and `margin-block-start: auto` then pins the actions to the
  bottom. The original relied on `.card` being the grid item itself. `:host([hidden])` is added
  so `hidden` still works.
- `.card-image` moved from the `<svg>` to a wrapper `<div>` around the slot, so the wrapper can carry
  `aria-hidden` and the background. `::slotted(svg)` sizes the SVG itself. `grid-column: 1 / -1` is
  dropped, because the card is a flex column and the declaration had no effect.
- Physical properties became logical (`inset`, `margin`, `padding`, `border-block-end-width`,
  `inline-size`, `block-size`) per §6.3.
- `#fff` became the new `--surface` token (`#fff`). `font-family`, line-height, sizes and all other values are unchanged.
- `box-sizing: border-box` is added so `block-size: 100%` includes the border.
- No transitions or animations exist in the card, so no `prefers-reduced-motion` block is needed.

## 6. Accessibility

Beyond conventions §7:

- **Semantics.** `<article>` with one `<h3>`. The heading level is fixed. The consumer provides the
  list wrapper.
- **Repeated button names.** A page with many cards has many buttons named "Select Dataset". Each
  button therefore has `aria-describedby` pointing to the card's own title, so a screen reader
  announces the button together with the dataset or model name. This adds no strings. The `id` and
  the reference are in the same shadow root, so the reference resolves. (Q11 asks you to confirm.)
- **Decorative image.** The `.card-image` wrapper has `aria-hidden="true"`. The model name, type
  label and description already convey the content. The slotted SVG needs no `<title>`.
- **Type label.** The model type is visible text, so it is not conveyed by colour alone.
- **Contrast.** These pairs MUST meet 4.5:1, verified against the actual token values:
  `.card-title` on the surface; `.card-text` on the surface; `.stat` text on `--stone-200`; the
  chiclet text on its chiclet background (chiclet spec).
  Computed values: `.card-text` and `.card-title` (both `--stone-900`) on white are 14.17:1; `.stat` (`--stone-800`) on `--stone-200` is 8.29:1. There are no contrast
  deviations and no axe exclusions.
- **Chiclet contrast (requirement on the chiclet spec).** The type label sits on a solid colour. With
  the chosen backgrounds the text colours are: white on `--purple-700` (6.98:1), white on
  `--teal-700` (5.47:1) and `--stone-900` on `--amber-500` (6.60:1). The card spec does not set the
  text colour; the chiclet spec MUST. `--teal-700` replaces the earlier `--teal-600`, because white on
  `--teal-600` is only 3.74:1.
- **Card boundary.** The `--stone-200` border (1.19:1 against white) is decoration and is not
  needed to identify a control. The card is not interactive, so the 3:1 boundary rule does not apply.
- **Focus.** Button focus rings come from `button.md`. They MUST NOT be clipped by the card's
  `overflow: hidden`. The 1rem inline padding of `.card-actions` and 1rem block-end padding of the
  card leave room for a 2px outline with a 2px offset.
- **Targets.** Buttons are at least 24px high (button spec).

Manual checks (record results in the PR):

- [ ] Screen reader (VoiceOver or NVDA) reads each card as an article with its heading, and
      announces each button with the card's name, e.g. "Select Dataset, button, Penguins".
- [ ] The decorative model image is not announced.
- [ ] Windows High Contrast / forced colours: the card boundary, the type label and the button
      focus rings are visible.
- [ ] 200% browser zoom and a 320px viewport: no clipping and no horizontal scroll.
- [ ] Tab order inside a card is _secondary action_, then _primary action_, and each focus ring is
      fully visible.

## 7. Internationalisation

Each element declares its own base-locale messages with `i18n('<tag-name>', {…})` and subscribes
through `StoreController` (§8). Nothing is concatenated; counts use the library's `count`
helper for plurals. Numbers use the i18n formatter with compact notation.

`app-dataset-card` (`i18n('app-dataset-card', …)`), base locale `en`:

| Key             | Base-locale message                           |
| --------------- | --------------------------------------------- |
| `datasheet`     | `Datasheet`                                   |
| `selectDataset` | `Select Dataset`                              |
| `columns`       | `{count} column` / `{count} columns` (plural) |
| `rows`          | `{count} row` / `{count} rows` (plural)       |

`app-model-card` (`i18n('app-model-card', …)`), base locale `en`:

| Key                | Base-locale message |
| ------------------ | ------------------- |
| `modelDescription` | `Model Description` |
| `selectModel`      | `Select Model`      |
| `classification`   | `classification`    |
| `regression`       | `regression`        |
| `clustering`       | `clustering`        |

- Counts are shown in compact notation: `1600000` shows as `1.6M`, `344` as `344`. `60845` shows as
  `61K` with default compact rounding (Q5). The plural form is chosen from the exact number.
  Singular is used for `1` ("1 column", "1 row").
- The type labels are lowercase to match the type values; any capitalisation is the chiclet spec's
  CSS responsibility (Q9).
- The card owns **no** string for `name` or `description`; both are consumer data.
- Layout must tolerate labels roughly 40% longer and right-to-left direction: no fixed widths on
  text, no clipping, logical properties only (see §5.4). The chiclet appears at the inline start
  (top-left in LTR, top-right in RTL).
- Unbroken long strings are Q6.

## 8. Acceptance criteria

All run in real browsers through Playwright (Chromium, Firefox, WebKit) unless noted. Each criterion
applies to both components unless it says otherwise.

| ID         | Criterion                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CARD-AC-1  | Every story of both components has zero axe violations, including colour contrast.                                                                                                                                                                                                                                                                                                                                                    |
| CARD-AC-2  | The card root is an `<article>` containing exactly one heading, an `<h3>`, whose text equals `name`.                                                                                                                                                                                                                                                                                                                                  |
| CARD-AC-3  | Computed card box: `border-radius` 16px; border widths 1.5px (inline and block-start) and 3px (block-end); `display: flex`; `flex-direction: column`; `row-gap` 8px; `overflow` hidden; background equals the `--surface` value.                                                                                                                                                                                                      |
| CARD-AC-4  | `.card-title`, `.card-text`, `.card-stats` and `.card-actions` each have computed inline padding of 16px. `.card-image` and `.card-type` have 0.                                                                                                                                                                                                                                                                                      |
| CARD-AC-5  | The title's computed block-start margin is 16px in `app-dataset-card` (first child) and 4px in `app-model-card`.                                                                                                                                                                                                                                                                                                                      |
| CARD-AC-6  | In a grid with two cards of different description length, both host elements have the same height, and the bottom edge of `.card-actions` sits at the same offset from the bottom of each card.                                                                                                                                                                                                                                       |
| CARD-AC-7  | The card contains two `<button type="button">` elements in order: `.btn`, then `.btn.btn-primary`. Their computed colour, background, border and padding equal those of a `.btn` in the document (`button.md`).                                                                                                                                                                                                                       |
| CARD-AC-8  | Tab order inside the card is the secondary button, then the primary button. A keyboard-focused button's focus outline lies fully inside the card's border box (not clipped).                                                                                                                                                                                                                                                          |
| CARD-AC-9  | Each button's click, Enter and Space each fire exactly one event with the names in §3, and `detail.name` equals the `name` property. A listener on the parent element is never called (no bubbling).                                                                                                                                                                                                                                  |
| CARD-AC-10 | Each button's accessible description equals the card's `name`, and its accessible name equals the button's label message.                                                                                                                                                                                                                                                                                                             |
| CARD-AC-11 | Dataset stats under `en`: `columns=21 rows=1600000` shows "21 columns" and "1.6M rows"; `columns=1 rows=1` shows "1 column" and "1 row"; `rows=60845` shows "61K rows" (Q5).                                                                                                                                                                                                                                                          |
| CARD-AC-12 | `.stat` computed `font-family` equals the `--font-mono` value, `font-size` is 14px and `background-color` equals the `--stone-200` value. The two stats are separated by whitespace.                                                                                                                                                                                                                                                  |
| CARD-AC-13 | With a second locale loaded, every card-owned string (button labels, stats, type label) renders in that locale and no base-locale text remains.                                                                                                                                                                                                                                                                                       |
| CARD-AC-14 | `app-model-card`: the `.card-image` wrapper has `aria-hidden="true"`; the slotted SVG's width equals the card's inner width, its height is 0.6 × width ±1px, and the wrapper's background equals `--stone-100`. The accessibility tree exposes no image for it.                                                                                                                                                                       |
| CARD-AC-15 | `app-model-card`: for each of the three `type` values the visible type label is the translated message, rendered in an element with classes `card-type chiclet` plus the colour class for the type (classification purple, regression teal, clustering amber), inside the card at 16px from the block-start and inline-start edges, overlapping the image. (Blocked on the chiclet spec, which defines the classes and text colours.) |
| CARD-AC-16 | `app-dataset-card` renders no `.card-type` and no `.card-image`.                                                                                                                                                                                                                                                                                                                                                                      |
| CARD-AC-17 | With `dir="rtl"`, the chiclet is at the inline-start (right) edge, all padding is mirrored, the title is right-aligned, and there is no horizontal overflow.                                                                                                                                                                                                                                                                          |
| CARD-AC-18 | With a title and description each about 3× the length of the typical fixtures (multi-word text), the card grows in height, nothing is clipped, and there is no horizontal overflow. (Unbroken strings: Q6.)                                                                                                                                                                                                                           |
| CARD-AC-19 | In a 320px-wide container the card has no horizontal overflow, and at 200% zoom its text and buttons remain fully visible.                                                                                                                                                                                                                                                                                                            |
| CARD-AC-20 | With `forced-colors: active` emulated, the card's border is still drawn (`border-style` not `none`) and a keyboard-focused button still has a visible outline.                                                                                                                                                                                                                                                                        |
| CARD-AC-21 | No element inside the card has a non-zero computed `transition-duration` or `animation-duration`, with and without `prefers-reduced-motion: reduce` emulated. Buttons are exempt (`button.md`).                                                                                                                                                                                                                                       |
| CARD-AC-22 | The `hidden` attribute on either host removes it from rendering (`display: none`).                                                                                                                                                                                                                                                                                                                                                    |
| CARD-AC-23 | The public API is closed: `observedAttributes` is exactly `['name', 'description', 'columns', 'rows']` (dataset) and `['type', 'name', 'description']` (model); the only slot in any shadow root is `image` in the model card; no element in either shadow root has a `part` attribute.                                                                                                                                               |
| CARD-AC-24 | `.card-title` colour on the card background is ≥ 4.5:1, computed from the actual token values. `.card-text` colour is ≥ 4.5:1 on the same background, computed the same way.                                                                                                                                                                                                                                                          |
| CARD-AC-25 | A `bun:test` check confirms neither component file imports from `src/stores/`. The only store-like import is the i18n instance. (Not a browser test.)                                                                                                                                                                                                                                                                                 |

CARD-AC-1, 2, 7, 8, 9, 10, 11, 12, 14, 16 and 22 SHOULD be `play` functions on stories.
CARD-AC-17, 19, 20 and 21 need browser or viewport emulation and go in the `*.test.ts` files.

## 9. Stories

`src/components/app-dataset-card.stories.ts`, title `Components/Dataset Card`:

- **Default**: "Penguins", 5 columns, 344 rows
- **Large dataset**: 21 columns, 1,600,000 rows
- **Singular**: 1 column, 1 row
- **Long label**: a multi-word title and description about 3× typical length
- **Narrow**: card in a 320px container
- **RTL**: `dir="rtl"` with Arabic or Hebrew text
- **Grid**: three cards of unequal description length in a 420px-wide grid (equal-height check)

`src/components/app-model-card.stories.ts`, title `Components/Model Card`:

- **Classification**, **Regression**, **Clustering**: one per `type`, each with a fixture SVG
- **Long label**: as above
- **Narrow**: 320px container
- **RTL**: `dir="rtl"` with Arabic or Hebrew text
- **Grid**: three cards of unequal description length (equal-height check)

Fixture text and SVGs are fixtures, not app strings, and may be literals. Docs pages come from
the Custom Elements Manifest and list `@slot`, `@fires`, and the usage rules from §4 as Do / Don't.
The element classes carry `@slot image` and `@fires` JSDoc tags (§4). Do not hand-write `argTypes`
for properties or events the manifest already supplies.

## 10. Files

Create:

- `src/styles/card.styles.ts` (exports `cardStyles`, TSDoc'd)
- `src/components/app-dataset-card.ts`
- `src/components/app-model-card.ts`
- `src/components/app-dataset-card.stories.ts`
- `src/components/app-model-card.stories.ts`
- `src/components/app-dataset-card.test.ts` (Playwright)
- `src/components/app-model-card.test.ts` (Playwright)

Modify:

- `css/root.css` only to add chiclet tokens the chiclet spec decides (visual-design §2 governs additions).

Do **not** modify `src/styles/global.ts` for this spec: `cardStyles` is used only inside shadow roots.

Dependencies (must exist or be specified first):

- `buttonStyles` from `button.md` (`src/styles/button.styles.ts`).
- The chiclet style primitive, which has **no spec yet** (needed for `app-model-card` only).
  `app-dataset-card` is not blocked by it. Chiclet styling, its pink token, text-transform and
  contrast belong in that spec. The exported style module's name is that spec's to decide.
- `src/i18n.ts`, the single i18n instance (§8). It is not in the repository yet.

Implementation order: `cardStyles` → `app-dataset-card` → chiclet spec → `app-model-card`.

## 11. Non-goals

Do not build any of these:

- A grid or list wrapper for cards. The consumer owns the layout, the `<ul>`/`<li>`, and the heading above.
- A configurable heading level (`<h3>` is fixed).
- A `ui-card` base element, a base class or a mixin. Do not make one generic `<app-card>`.
- Any hover, selected, loading, disabled, skeleton or error state.
- Making the whole card clickable or focusable.
- An overlay, datasheet or model description content. The consumer opens it on the events.
- Dataset `tasks` display (see the discrepancy under Q10).
- An image `alt`, `title` or named-image mode. The image is decorative by decision.
- A fallback or empty state for a missing `image` slot (Q7).
- Validation or clamping of `columns` and `rows`, and per-locale number options beyond compact notation.
- A property for `id`, `selected`, `variant` or any other state not listed in §3.
- Dark-mode values (handled by tokens, if at all).

## 12. Open questions (human to answer; agents must not resolve)

Answered by the spec owner (2026-11-05), kept here for the record:

- **Q1 (answered).** The card background uses a new `--surface: #fff` token. `button.md` Q1 (the
  same question) should adopt the same answer.
- **Q2 (answered, then changed by Q14).** `.card-text` was first kept at `--stone-600` (4.10:1,
  below AA). Q14 replaced that: `.card-text` is now `--stone-900`, so there is no deviation. The
  `button.md` claim that `--stone-600` on `--stone-50` meets 4.5:1 is wrong (3.97:1) and should be
  rechecked there.
- **Q3 (answered, refined by Q13).** Model type colours: classification `--purple-700`, regression
  `--teal-600`, clustering `--amber-500`. Q13 changed regression to `--teal-700`.
- **Q13 (answered).** (a) The colours are solid chiclet backgrounds. (b) Classes are
  `chiclet-purple`, `chiclet-teal`, `chiclet-amber`. (c) Text is white on purple and teal, and
  `--stone-900` on amber, with regression moved to `--teal-700` so it reaches 5.47:1.
- **Q14 (answered).** Instead of an axe exclusion, `.card-text` changes to `--stone-900`. No
  contrast deviation remains, so the stories' axe scan runs unmodified and COMPONENTS.md is not
  amended.
- **Q15 (answered).** `.card-title` changes from `--stone-800` to `--stone-900`, matching
  `.card-text`. The heading stands out by size (1.5rem) and weight (600), not by colour.

Still open:

- **Q4.** Confirm the `app-` prefix for both elements. (They are domain cards, not primitive UI,
  so `app-` is proposed. The event names and `i18n()` keys depend on it.)
- **Q5.** Compact notation turns `60,845` into `61K` and `19,158` into `19K`, which loses
  precision. Is that intended, or should there be a fraction-digit or threshold rule? The scaffold
  showed `60,845 rows` in full.
- **Q6.** `overflow: hidden` clips unbroken long strings (a URL or identifier in `name` or
  `description`). Add `overflow-wrap: anywhere` to the title and text? (Same issue as `button.md` Q5.)
- **Q7.** If the model card's `image` slot is empty, should the card reserve the 5:3
  grey area, collapse it, or is a missing image simply invalid?
- **Q8.** Two padded inline `.stat` spans can touch or overlap when they wrap onto two lines in a
  narrow container. Keep the original inline layout, or switch to a wrapping flex row with a gap?
- **Q9.** Model type text: should the capitalisation come from the chiclet CSS
  (`text-transform`), or should the messages be capitalised ("Classification")?
- **Q10.** Discrepancy to resolve: `specification/steps/step-one.md` describes the dataset card
  buttons as "info" and "select", and says the card shows "the tasks the dataset can be used for".
  The supplied HTML has _Datasheet_ and _Select Dataset_ and no tasks field, although
  the generated sample-dataset catalogue provides `taskTypes`. This spec follows the supplied
  HTML. Should the card gain a `taskTypes` display, or should the catalogue remain available only
  to filtering and selection logic?
- **Q11.** Confirm the `aria-describedby` approach in §6 for repeated button names, or choose another
  (for example an `aria-label` with an interpolated message, which adds strings).
- **Q12.** Confirm that importing the i18n message store is the accepted exception to "presentational
  components MUST NOT import stores" (§2 against §8). This spec assumes it is.
