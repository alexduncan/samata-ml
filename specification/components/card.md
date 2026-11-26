# Spec: Card (`app-dataset-card`, `app-model-card`)

**Status:** implemented — card API and behaviour, including model-card stories in §9. Dataset-card stories remain follow-up work. · Tier: **Presentational component** ×2 (conventions §2) · Criterion prefix: `CARD`

Read [`COMPONENTS.md`](../COMPONENTS.md) first. This spec follows its §12 template. Where this spec
is silent, COMPONENTS.md applies. The only explicit override is in §2 (shared style module).

## 1. Summary

Two presentational Lit elements that render the same visual "card" for two kinds of content:

- **`<app-dataset-card>`** shows a dataset's name, description, column and row counts, and two
  actions: _Datasheet_ and _Select Dataset_.
- **`<app-model-card>`** shows a model's type label, an illustration, name, description, and two
  actions, _Model Description_ and _Select Model_. It marks the current choice.

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
strings. Each element has a small, typed, closed API. The model card accepts one named image slot. Neither is a "primitive UI" element, so both use the `app-` prefix (Q4).

**Why the model image is a slot.** The consumer supplies artwork as a native `<img>` or an inline
`<svg>`. The slot accepts the element directly and lets the chooser use the supplied public artwork
at stable URLs. The card owns its image frame and decorative treatment.

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

| Item                                  | Detail                                                                                                                                                                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tag                                   | `app-dataset-card`. Class `AppDatasetCard` in `src/features/data/app-dataset-card.ts`.                                                                                                                                          |
| `datasetId`                           | `string`, default `''`. Attribute `dataset-id`. Reflects dataset domain identity.                                                                                                                                               |
| `name`                                | `string`, default `''`. Attribute `name`. Dataset title.                                                                                                                                                                        |
| `description`                         | `string`, default `''`. Attribute `description`.                                                                                                                                                                                |
| `columns`                             | `number`, default `0`. Attribute `columns`. Column count.                                                                                                                                                                       |
| `rows`                                | `number`, default `0`. Attribute `rows`. Row count.                                                                                                                                                                             |
| `labels`                              | Object with `datasheet`, `loadDataset`, `columns`, `rows` string properties providing translated UI text with defaults.                                                                                                         |
| Slots                                 | None.                                                                                                                                                                                                                           |
| Events                                | `app-dataset-datasheet-open` and `app-dataset-select`, each `CustomEvent<{ datasetId: string; name: string }>`. `detail.datasetId` and `detail.name` carry card identity at dispatch time. `bubbles: false`, `composed: false`. |
| Parts, CSS custom properties, methods | None.                                                                                                                                                                                                                           |

### `<app-model-card>`

| Item                                  | Detail                                                                                                                                                                                                                     |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tag                                   | `app-model-card`. Class `AppModelCard` in `src/features/models/app-model-card.ts`.                                                                                                                                         |
| `modelId`                             | `string`, default `''`. Attribute `model-id`. Unique model identifier.                                                                                                                                                     |
| `type`                                | `'classification' \| 'regression' \| 'clustering'`. Attribute `type`. Required; default `'classification'`.                                                                                                                |
| `name`                                | `string`, default `''`. Attribute `name`. Model title.                                                                                                                                                                     |
| `description`                         | `string`, default `''`. Attribute `description`.                                                                                                                                                                           |
| `selected`                            | Boolean, default false. Attribute `selected`. The property does not reflect.                                                                                                                                               |
| Slots                                 | `image`. Supply one decorative `img` of ratio 5:3 with empty `alt`, or one inline `svg` with `viewBox="0 0 360 216"`. No default slot.                                                                                     |
| Events                                | `app-model-description-open` and `app-model-select`, each `CustomEvent<{ modelId: string; name: string }>`. `detail.modelId` and `detail.name` carry model identity at dispatch time. `bubbles: false`, `composed: false`. |
| Parts, CSS custom properties, methods | None.                                                                                                                                                                                                                      |

### Shared

| Item         | Detail                                                 |
| ------------ | ------------------------------------------------------ |
| `cardStyles` | `CSSResult` exported from `src/styles/card.styles.ts`. |

Notes:

- Properties are not reflected to attributes. CSS does not need them (§4).
- `columns` and `rows` use Lit's default `Number` attribute converter.
- `ModelCardType` is the union of the three supported `type` values and is exported from the model card module.
- `--card-padding` is an internal custom property declared on the inner `.card`. It is **not**
  public API and consumers MUST NOT set or rely on it.
- The public attributes, events and slots are listed above. Both classes are
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

<ul class="cards" role="list">
	<li>
		<app-model-card
			model-id="logistic-regression"
			name="Logistic Regression"
			description="…"
			selected>
			<img
				slot="image"
				src="/assets/logistic-regression.svg"
				alt=""
				width="360"
				height="216" />
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
- Give the model card exactly one element in the `image` slot. Use an `<img>` with empty `alt`
  and 5:3 dimensions, or an inline `<svg>` with `viewBox="0 0 360 216"`. The chooser declares
  `width="360"` and `height="216"` on its images.
- Bind `selected` to the current model ID. The consumer owns the workflow and updates the selection
  when the card emits `app-model-select`. Use `role="list"` on the chooser list for Safari when
  resetting list markers.
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
	<h3 class="card-title">Logistic Regression</h3>
	<p class="card-text">…</p>
	<div class="card-actions">
		<button type="button" class="btn" aria-label="Model Description: Logistic Regression">
			Model Description
		</button>
		<div class="card-selection">
			<button
				type="button"
				class="btn btn-primary"
				aria-label="Select Model: Logistic Regression"
				aria-current="true">
				Select Model
			</button>
			<span aria-hidden="true">Selected</span>
		</div>
	</div>
</article>
```

- The whitespace between the two `.stat` spans must be a real space in the rendered template.
- The `{colour}` comes from `type` (resolved Q3): `classification` → purple (`--purple-700`),
  `regression` → teal (`--teal-700`), `clustering` → amber (`--amber-500`). These are the chiclet's
  solid **background** colours. Class names are `chiclet-purple`, `chiclet-teal` and
  `chiclet-amber` (resolved Q13); the chiclet spec defines them. The original HTML's
  `chiclet-pink` is not used.
- The dataset card’s `id="title"` is unique inside its shadow root.

### 5.3 Static states

The two buttons carry their interaction states from [button.md](button.md). On a selected model
card, `Selected` appears beside `Select Model`. The selected button alone has `aria-current="true"`.
Unselected cards omit the marker and the attribute.

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
		flex: none;
		background-color: var(--stone-100);
		aspect-ratio: 5 / 3;
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

	.card-selection {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		color: var(--stone-900);
		overflow-wrap: anywhere;

		button {
			flex: 1 1 auto;
		}
	}
}

::slotted(svg),
::slotted(img) {
	display: block;
	inline-size: 100%;
	block-size: auto;
}

::slotted(img) {
	aspect-ratio: 5 / 3;
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
  `aria-hidden` and the background. The wrapper reserves the full inner width and 5:3 aspect
  ratio before load and if an image request fails. The slotted `svg` and `img` fit that area.
- The select button and visible marker share a flex row that can wrap at narrow widths.
- Physical properties became logical (`inset`, `margin`, `padding`, `border-block-end-width`,
  `inline-size`, `block-size`) per §6.3.
- `#fff` became the new `--surface` token (`#fff`). `font-family`, line-height, sizes and all other values are unchanged.
- `box-sizing: border-box` is added so `block-size: 100%` includes the border.
- No transitions or animations exist in the card, so no `prefers-reduced-motion` block is needed.

## 6. Accessibility

Beyond conventions §7:

- **Semantics.** `<article>` with one `<h3>`. The heading level is fixed. The consumer provides the
  list wrapper.
- **Dataset actions.** Dataset buttons reference their own card title with `aria-describedby`.
- **Model actions.** Each localised accessible name contains its full visible label and model name.
  The English forms are `Model Description: {name}` and `Select Model: {name}`. When `name` is
  empty the button gets its name from the visible label. The current select button exposes
  `aria-current="true"`, and its neighbouring `Selected` text has `aria-hidden="true"`.
- **Decorative image.** The `.card-image` wrapper has `aria-hidden="true"` and the slotted `<img>`
  has empty `alt`. The model name, type label and description convey the card’s content. A failed
  image request leaves the frame reserved and the buttons and text usable.
- **Type label.** The model type is visible text, so it is not conveyed by colour alone.
- **Contrast.** These pairs MUST meet 4.5:1, verified against the actual token values:
  `.card-title`, `.card-text` and the selected marker on the surface, `.stat` text on `--stone-200`,
  and chiclet text on its chiclet background (chiclet spec).
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
| `actionForModel`   | `{action}: {name}`  |
| `selected`         | `Selected`          |
| `classification`   | `Classification`    |
| `regression`       | `Regression`        |
| `clustering`       | `Clustering`        |

- Counts are shown in compact notation: `1600000` shows as `1.6M`, `344` as `344`. `60845` shows as
  `61K` with default compact rounding (Q5). The plural form is chosen from the exact number.
  Singular is used for `1` ("1 column", "1 row").
- The type labels use title case. The chiclet styles apply their visual casing.
- The card owns **no** string for `name` or `description`; both are consumer data.
- Layout must tolerate labels roughly 40% longer and right-to-left direction: no fixed widths on
  text, no clipping, logical properties only (see §5.4). The chiclet appears at the inline start
  (top-left in LTR, top-right in RTL).
- Unbroken long strings are Q6.

## 8. Acceptance criteria

All run in real browsers through Playwright (Chromium, Firefox, WebKit) unless noted. Each criterion
applies to both components unless it says otherwise.

| ID         | Criterion                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CARD-AC-1  | Every story of both components has zero axe violations, including colour contrast.                                                                                                                                                                                                                                                                                                                                            |
| CARD-AC-2  | The card root is an `<article>` containing exactly one heading, an `<h3>`, whose text equals `name`.                                                                                                                                                                                                                                                                                                                          |
| CARD-AC-3  | Computed card box: `border-radius` 16px; border widths 1.5px (inline and block-start) and 3px (block-end); `display: flex`; `flex-direction: column`; `row-gap` 8px; `overflow` hidden; background equals the `--surface` value.                                                                                                                                                                                              |
| CARD-AC-4  | `.card-title`, `.card-text`, `.card-stats` and `.card-actions` each have computed inline padding of 16px. `.card-image` and `.card-type` have 0.                                                                                                                                                                                                                                                                              |
| CARD-AC-5  | The title's computed block-start margin is 16px in `app-dataset-card` (first child) and 4px in `app-model-card`.                                                                                                                                                                                                                                                                                                              |
| CARD-AC-6  | In a grid with two cards of different description length, both host elements have the same height, and the bottom edge of `.card-actions` sits at the same offset from the bottom of each card.                                                                                                                                                                                                                               |
| CARD-AC-7  | The card contains two `<button type="button">` elements in order: `.btn`, then `.btn.btn-primary`. Their computed colour, background, border and padding equal those of a `.btn` in the document (`button.md`).                                                                                                                                                                                                               |
| CARD-AC-8  | Tab order inside the card is the secondary button, then the primary button. A keyboard-focused button's focus outline lies fully inside the card's border box (not clipped).                                                                                                                                                                                                                                                  |
| CARD-AC-9  | Each button's click, Enter and Space each fire exactly one event with the names in §3, and `detail.name` equals the `name` property (plus `detail.modelId` for `app-model-card` and `detail.datasetId` for `app-dataset-card`). A listener on the parent element is never called (no bubbling).                                                                                                                               |
| CARD-AC-10 | Dataset actions use the button label as their accessible name and the dataset title as their accessible description. Model actions include the full visible label followed by the model name through a localised message. An empty model name leaves the native label. The current select action has `aria-current="true"` and a visible `Selected` marker.                                                                   |
| CARD-AC-11 | Dataset stats under `en`: `columns=21 rows=1600000` shows "21 columns" and "1.6M rows"; `columns=1 rows=1` shows "1 column" and "1 row"; `rows=60845` shows "61K rows" (Q5).                                                                                                                                                                                                                                                  |
| CARD-AC-12 | `.stat` computed `font-family` equals the `--font-mono` value, `font-size` is 14px and `background-color` equals the `--stone-200` value. The two stats are separated by whitespace.                                                                                                                                                                                                                                          |
| CARD-AC-13 | With a second locale loaded, every card-owned string uses that locale, including button labels, model action accessible names, selected marker, stats and type labels.                                                                                                                                                                                                                                                        |
| CARD-AC-14 | `app-model-card` hides its decorative image wrapper from assistive technology and gives the wrapper the `--stone-100` background. Both slot forms fill the card’s inner width and have a height of 0.6 × width ±1px. The frame stays reserved before loading and after image failure. The accessibility tree exposes no artwork.                                                                                              |
| CARD-AC-15 | `app-model-card`: for each of the three `type` values the visible type label is the translated message, rendered in an element with classes `card-type chiclet` plus the colour class for the type (classification purple, regression teal, clustering amber), inside the card at 16px from the block-start and inline-start edges, overlapping the image. (The [chiclet spec](chiclet.md) defines classes and text colours.) |
| CARD-AC-16 | `app-dataset-card` renders no `.card-type` and no `.card-image`.                                                                                                                                                                                                                                                                                                                                                              |
| CARD-AC-17 | With `dir="rtl"`, the chiclet is at the inline-start (right) edge, all padding is mirrored, the title is right-aligned, and there is no horizontal overflow.                                                                                                                                                                                                                                                                  |
| CARD-AC-18 | With a title and description each about 3× the length of the typical fixtures (multi-word text), the card grows in height, nothing is clipped, and there is no horizontal overflow. (Unbroken strings: Q6.)                                                                                                                                                                                                                   |
| CARD-AC-19 | In a 320px-wide container the card has no horizontal overflow, and at 200% zoom its text and buttons remain fully visible.                                                                                                                                                                                                                                                                                                    |
| CARD-AC-20 | With `forced-colors: active` emulated, the card's border is still drawn (`border-style` not `none`) and a keyboard-focused button still has a visible outline.                                                                                                                                                                                                                                                                |
| CARD-AC-21 | No element inside the card has a non-zero computed `transition-duration` or `animation-duration`, with and without `prefers-reduced-motion: reduce` emulated. Buttons are exempt (`button.md`).                                                                                                                                                                                                                               |
| CARD-AC-22 | The `hidden` attribute on either host removes it from rendering (`display: none`).                                                                                                                                                                                                                                                                                                                                            |
| CARD-AC-23 | The public API is closed: `observedAttributes` is exactly `['name', 'description', 'columns', 'rows']` (dataset) and `['model-id', 'type', 'name', 'description', 'selected']` (model); the only slot in any shadow root is `image` in the model card; no element in either shadow root has a `part` attribute.                                                                                                               |
| CARD-AC-24 | `.card-title`, `.card-text` and the selected marker each meet 4.5:1 contrast on the card surface, computed from the actual token values.                                                                                                                                                                                                                                                                                      |
| CARD-AC-25 | A `bun:test` check confirms neither component file imports from `src/stores/`. The only store-like import is the i18n instance. (Not a browser test.)                                                                                                                                                                                                                                                                         |

CARD-AC-1, 2, 7, 8, 9, 10, 11, 12, 14, 16 and 22 SHOULD be `play` functions on stories.
Browser acceptance runs in `tests/data-selection.e2e.ts`, `tests/model-card.e2e.ts` and related feature journeys; viewport/emulation stays in `tests/**/*.e2e.ts`, separate from Bun units.

## 9. Stories

Dataset-card stories remain follow-up work. The planned file is
`src/features/data/app-dataset-card.stories.ts`, with title `Components/Dataset Card`.

- **Default**: "Penguins", 5 columns, 344 rows
- **Large dataset**: 21 columns, 1,600,000 rows
- **Singular**: 1 column, 1 row
- **Long label**: a multi-word title and description about 3× typical length
- **Narrow**: card in a 320px container
- **RTL**: `dir="rtl"` with Arabic or Hebrew text
- **Grid**: three cards of unequal description length in a 420px-wide grid (equal-height check)

`src/features/models/app-model-card.stories.ts` provides `Components/Model Card`.

- **Classification** uses the actual public Logistic Regression illustration in an `img`.
- **Regression** and **Clustering** exercise the inline SVG slot and their type labels.
- **Selected** verifies the accessible action name, visible marker and decoded image.
- **Long Label** and **Narrow** exercise wrapping, with a 320px container in the narrow story.
- **RTL** shows Arabic text and the current selection in right-to-left direction.
- **Grid** shows both slot forms together with a selected and an unselected model.

Storybook Docs use the Custom Elements Manifest for the component controls and describe both slot
forms. The `@slot image` TSDoc annotation supplies the manifest’s slot metadata.

## 10. Files

Implemented source and planned story locations:

- `src/styles/card.styles.ts` (exports `cardStyles`, TSDoc'd)
- `src/features/data/app-dataset-card.ts`
- `src/features/models/app-model-card.ts`
- `src/features/data/app-dataset-card.stories.ts`
- `src/features/models/app-model-card.stories.ts`
- `tests/data-selection.e2e.ts` and `tests/model-card.e2e.ts` (Playwright acceptance)

Modify:

- `css/root.css` only to add chiclet tokens the chiclet spec decides (visual-design §2 governs additions).

Do **not** modify `src/styles/global.ts` for this spec: `cardStyles` is used only inside shadow roots.

Dependencies (must exist or be specified first):

- `buttonStyles` from `button.md` (`src/styles/button.styles.ts`).
- [`chicletStyles`](chiclet.md), including solid backgrounds/text contrast (needed by app-model-card).
- The implemented `src/i18n.ts` instance and formatter (§7); the existing i18n-only presentational exception remains unchanged.

## 11. Non-goals

Do not build any of these:

- A grid or list wrapper for cards. The consumer owns the layout, the `<ul>`/`<li>`, and the heading above.
- A configurable heading level (`<h3>` is fixed).
- A `ui-card` base element, a base class or a mixin. Do not make one generic `<app-card>`.
- Card-level hover, loading, disabled, skeleton or error states.
- Making the whole card clickable or focusable.
- An overlay, datasheet or model description content. The consumer opens it on the events.
- Dataset `tasks` display (see the discrepancy under Q10).
- A named or informative image mode. A slotted `img` uses empty `alt` for decorative artwork.
- A fallback or empty state for a missing `image` slot (Q7).
- Validation or clamping of `columns` and `rows`, and per-locale number options beyond compact notation.
- A property for `id`, `variant` or any other state outside the public API in §3.
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

Answered and resolved during Step 1 planning & implementation:

- **Q4 (answered).** Confirmed `app-` prefix (`app-dataset-card`, `app-model-card`).
- **Q5 (answered).** Compact notation used (`notation: 'compact'`), e.g. "150 rows", "61K rows".
- **Q6 (answered).** Added `overflow-wrap: anywhere; word-break: normal;` on title and text to prevent overflow blowout.
- **Q7 (answered).** Model cards require an illustration; dataset cards omit task badges.
- **Q8 (answered).** Switched to flex wrapping layout with gap for `.stats`.
- **Q9 (answered).** Model type messages are capitalized directly in strings ("Classification").
- **Q10 (answered).** Dataset card buttons are "Datasheet" and "Load Dataset"; task badges omitted.
- **Q11 (answered).** Dataset buttons retain their title reference. Model buttons include the model name in their localised accessible names.
- **Q12 (answered).** Presentational components receive pre-translated strings via a typed `labels` property dictionary or render consumer content, avoiding store imports.
