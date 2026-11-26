# Chart design

**Status:** implemented

These rules apply to charts that explain classification results. The app projects stored reports and formats them; training, statistics, preprocessing and diagnostics belong to the installed training library. See [visual design](visual-design.md), [component rules](COMPONENTS.md) and [testing](testing.md).

## 1. Choose a chart

Put quantities on a position scale, such as dots, bars or lines, rather than area, volume, bubble size or colour intensity. Use bars or dots for categories and lines only for ordered continuous x values, such as a threshold or training size. Never connect unordered models or classes. Do not use 3D, radar, bubble area or dual y-axes; use aligned panels for two scales. Avoid pie and doughnut charts; if needed use few directly labelled parts, and use sorted bars for comparisons.

Show each outer-fold observation and a summary with a named interval (mean and standard deviation or median and interquartile range). Never show a bare mean or error bars alone; pair an interval with dots, a distribution or a frequency display. Show probability-like values with counts or frequency framing when the source supports them. Do not manufacture counts from stored rates: calibration bins retain their observed rate and total, including unavailable empty bins. Label the majority-class baseline on performance charts and the random baseline where relevant, with dashed neutral lines.

Use aligned dot rows for model comparison, confusion flows or matrices with counts and domain nouns for mistakes, reliability and frequency displays for uncertainty, ordered lines for setting effects, and labelled scatter with a Pareto front for trade-offs. Avoid overlaying many models, rainbow matrices, p-value matrices and visual winner claims.

## 2. Axes and scales

Show quantitative axes with names, units and direction. Bars start at zero explicitly. Use dots or intervals on a labelled non-zero axis for small differences, and print the difference. Never invert an axis; label a logarithmic scale and use a symmetric log scale when data crosses zero. Compared charts share explicit domains, ticks, size and aspect ratio. Bounded scores use 0–100%; label lower-is-better metrics as such. Keep tick precision consistent and normally use four to seven round ticks. Integer counts use unique integer ticks, including zero. Put long categories on horizontal rows without rotating their tick labels; fit or truncate visually while preserving the full label in the table.

ROC, precision–recall and calibration plots are square, use 0–1 axes and show their no-skill reference. Use light value-axis gridlines and `nice: true` unless the domain is explicit. Reflow at a 320px viewport and 200% text size without clipping or overlapping text; re-render on container or font changes.

## 3. Words and annotations

Give each chart a neutral, factual takeaway derived from the data, and a note naming metric, row count, folds and interval when relevant. Use domain nouns, define abbreviations and name axis units and direction. Label marks directly when practical; otherwise use a legend ordered like the visible data. Annotate baselines and the main lesson without overstating results. Use sentence case and live SVG or HTML text at least 12px. Keep shadows, gradients and decorative icons outside the plotting area.

## 4. Colour and identity

A screen uses separate colour channels: `/results` model identity uses the assigned model colour, numbered swatch and marker; dataset classes use `--chart-1` through `--chart-6` with labels and surface separators; neutral count and negative-class distributions use `--chart-neutral`; binary correct and incorrect outcomes use blue solid/check and amber-dark striped/dashed/cross. Do not reuse model colours for dataset classes or use red and green as the sole good/bad cue. Quantities use a single-hue sequential ramp and differences a diverging ramp around zero; never use rainbow or turbo. Pair colour with shape, position or text.

The project-specific model-instance identity exception replaces a fixed per-classifier Okabe–Ito mapping on `/results`: learners may train two instances of the same classifier. The ten `ModelColor` slots use distinct symbols: amber circle, blue square, teal triangle, purple diamond, red cross, green star, pink wye and sky hexagon are filled; olive plus and neutral times are stroked at width 2. Amber marks, bars and legend swatches have a 1.5px `--stone-900` outline. Use `--model-swatch-ink` on amber, sky and `--chart-neutral`; use `--surface` on the other dark fills. Stacked class fills have `--surface` separator strokes; adjacent non-zero ROPE segments have 2px surface gaps. Single-model charts retain the non-model-specific chart palette. Human review of extending model colours to those charts remains in [HUMAN.md](HUMAN.md).

The general fixed per-classifier reference palette is: Bernoulli Naive Bayes orange `#E69F00` circle; Decision Tree bluish green `#009E73` square; Gaussian Naive Bayes sky blue `#56B4E9` triangle up; K-Nearest Neighbors reddish purple `#CC79A7` diamond; Logistic Regression blue `#0072B2` triangle down; Multi-layer Perceptron vermillion `#D55E00` cross; Multinomial Naive Bayes yellow `#F0E442` star with dark outline; and Support Vector Classifier black `#000000` plus. The `/results` model-instance exception above takes precedence for that route; it does not add these reference colours to the closed token vocabulary.

## 5. Accessible HTML and interaction

Wrap each chart in a `figure` with a `figcaption` and a heading at the page's correct level. Each chart SVG is one `role="img"` with a short `aria-label` and an `aria-describedby` reference to a nonempty visible or visually hidden description. The description covers chart type, axes and units, comparison, key numbers and lesson, derived from the displayed data. Hide data mark groups from assistive technology; the accompanying native table in a `details` element has a caption, scoped headers, plotted values, folds and baselines. Information is never tooltip-only.

Text contrast is at least 4.5:1 (3:1 for large text); marks, separators, controls and focus rings are at least 3:1 against adjacent colours. Do not refer to a series by colour alone. Controls use native semantics, accessible names and visible focus and are at least 24 × 24 CSS pixels. Charts remain usable at 200% text and 400% zoom without two-dimensional chart scrolling; data tables may scroll within a named region. Everything available by pointer is available by keyboard. Hover or focus content is dismissible, hoverable and persistent and is also available in the table or description. Announce committed interactive changes in a polite live region. Respect reduced motion and provide a static equivalent; animations over five seconds need pause or stop.

## 6. Observable Plot

Pin Observable Plot exactly at 0.6.18 and check its changelog before upgrading. The shared `PlotController` supplies width, at least 12px text, accessible naming and description, removes descendant Plot aria labels and hides data-mark groups, measures text, and rerenders on resize, font load and root text-size changes. Its measurement probe is cleaned up on disconnect. The type-only bridge in `src/types/observable-plot.d.ts` maps bundled declarations for TypeScript bundler resolution without changing runtime imports; reassess it on a future Plot upgrade.

Plot's pointer tips do not supply keyboard access. Use native controls and a static selected mark plus a polite announcement and table when interactive inspection is needed; test touch on a real device before relying on it. Top-level accessibility defaults are null; supply the SVG name and description, not mark-only labels. Constant Plot `ariaLabel`, `title` and `href` channels need functions rather than column-name strings. A truthy tip suppresses the SVG title channel, so it is not an accessible text substitute. Avoid Plot title/subtitle headings; compose the app's figure and caption.

Override default `turbo` and `observable10` schemes with explicit domains and token ranges. Use accessible subsets of sequential ramps. Set responsive margins and verify wide labels and tick formatting; Plot does not size them automatically. Declare scale types and domains explicitly rather than relying on first-non-null inference; annotate any clamping. Retain directional axis arrows where meaningful. Use UTC for time scales. Plot legends are static and limited to colour, opacity and symbol; use a native button or checkbox list for an interactive legend and keep its visual order. Compose special charts from marks, generate tables and descriptions in the app, restore focus after updates, and inspect repeated facet axes and shared domains. Plot has no built-in keyboard support, data tables, alt-text generation or animation.

## 7. Pre-merge checklist

- [ ] A neutral, data-derived takeaway, metric, rows, folds and interval are stated.
- [ ] The chart type matches the learner question; no 3D, radar, dual axes or area encoding is used.
- [ ] Axes have names, units and directions, comparable domains are shared, bars start at zero, and reference baselines are labelled.
- [ ] Fold observations and interval types are visible; supported counts or frequency framing accompany probabilities.
- [ ] Token colours and distinct symbols identify series; labels or shapes provide a second cue and text/graphics meet contrast targets.
- [ ] Figure, caption, SVG role/name/description, hidden mark groups and a captioned data table are present; axe reports no errors.
- [ ] Pointer information is keyboard-accessible and in the table or description; focus is visible and targets are large enough.
- [ ] Long labels, 320px reflow, 200% text size, 400% zoom, RTL, forced colours and reduced motion are checked.
- [ ] Interactive updates are announced; colour-vision simulation and Safari/VoiceOver checks are recorded in the human queue when still pending.
