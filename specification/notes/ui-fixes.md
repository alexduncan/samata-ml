# UI Fixes

- Disable scroll on body while a `dialog.modal` is open.
- `header.page-header` inside `main` should stick to the top of the viewport when scrolling.

## Better Mockup Navigation
To help me navigate the mockups I propose the following changes:

### 1) Change the `#__mockup-review-helper-host` HTML
Move the `#__mockup-review-helper-host element` to before the closing `</body>` tag. CSS in `mockup.css` will position it at the top of the viewport.

Here is my proposed updated HTML:
```html
<div id="__mockup-review-helper-host">
	<!-- Wrap details about this mockup in a <div> -->
  <div id="mockup-details">
    <h4 class="mockup-name">
		<!-- Give each mockup a simple plain English name -->
      {Simple Plain English Name of Mockup}

	  <!-- Add a status to each mockup (draft, ready, implemented) -->
      <span class="mockup-status mockup-status-{status}">
        {draft|ready|implemented}
      </span>
    </h4>
	<!-- Add a simple description of the mockup to help reviewers understand its context -->
    <p class="mockup-description">
      {Simple description of the situation in which a user will encounter this
      ui.}
    </p>
  </div>
  <nav id="mockup-controls" aria-label="Mockup review">
    <!-- Removed label for the select element. WCAG comliance isn't important for this mockup review tool -->
    <select id="preview-page">
      <option value="/files/basic-html-structure.html">
        basic-html-structure.html
      </option>
      <!-- {remaining mockup options} -->
    </select>
	<!-- Removed the "Go" button, navigation will happen automatically on select change -->
	<!-- Move index link to the end of the mockup controls -->
    <a href="/" class="index-link">
		<!-- Added simple SVG icon for the index link -->
      <svg
        class="index-link-icon"
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M14 3v4a1 1 0 0 0 1 1h4" />
        <path
          d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2"
        />
        <path d="M9 9l1 0" />
        <path d="M9 13l6 0" />
        <path d="M9 17l6 0" />
      </svg>
      <span class="index-link-text">Index</span>
    </a>
  </nav>
</div>
```

### 2) Mockup Styling
Add `mockup.css` to the `<head>` containing styles for the `#__mockup-review-helper-host`.  
See example in `./samata-ml/specification/mockups/ui-scaffold/drafts/01-6_virtual-table.html`.

### 3) Change `scaffold` to `mockups`

I used the term `scaffold` when first creating ui for the app. Now that the basics are established change all references to `scaffold` to `mockups` for ongoing ui refinement.

### 4) Create a Mockups Index

Flatten the structure of `./samata-ml/specification/mockups/`. All HTML files should live directly inside the folder. Use `<meta 

Write a python script

## Improve Virtualized Table
1. Move scroll to body. Unwrap `ui-virtual-table` so it sits directly inside `<main>`.
2. Set the height on `div.table-body` by multiplying row height by the number of rows.
3. Each row `div.table-row` is positioned using `transform: translateY({scroll-distance});will-change: transform;`.
4. Maintain an **overscan buffer** of `visibleRows * 2` to avoid the user seeing empty space.
5. Synchronize DOM updates using `requestAnimationFrame`.
6. Decouple the scroll listener from DOM updates. The scroll event listener should update a variable e.g. `currentScrollTop` and flags that an update is pending. If an update is pending and no `requestAnimationFrame` is currently queued then call `requestAnimationFrame(updateVirtualTable)` the `updateVirtualTable` function reads `currentScrollTop`, performs the row math, executes the DOM mutations, and clears the pending flag.
7. The function `updateVirtualTable` calculates which rows need moving and which need mutating depending on `currentScrollTop`.
8. Add edit buttons to the header row.
9. Unsupported columns need an `<svg><use href="" /><svg>`

### Open Issues
- [ ] Multiple column widths.
- [ ] Style column types.
- [ ] Format Dates & times better.
- [ ] Style unsupported columns.
- [ ] Load dataset progress bar. Progress knowable?!?
- [ ] 


## Hyperparamter Configuration

### Hyperparameter Markup

Each hyperparameter will be wrapped in a `<div class="field">` and styled using `display: grid;`.

```html
<div class="field">
	<label for="{hyperparameterId}" class="field-name">{hyperparameterName}</label>

	<!-- if enum -->
    <select
		id="{hyperparameterId}"
		name="{hyperparameterId}"
		class="field-control"
		aria-describedby="{hyperparameterId}-help">
		<!-- Example values -->
		<option value="sgd">SGD</option>
		<option value="adam">Adam</option>
    </select>
    
    <!-- if numeric -->
    <input
		id="{hyperparameterId}"
		name="{hyperparameterId}"
		class="field-select"
		aria-describedby="{hyperparameterId}-help"
		type="number" min="1" step="1" value="1000">
      
    <div
      class="field-controls"
      role="group"
      aria-labelledby="learning-rate-label"
    >
	    <input
	      id="{hyperparameterId}-range"
	      type="range"
	      min="0"
	      max="1"
	      step="0.01"
	      value="0.3"
	      aria-describedby="{hyperparameterId}-help"
	    />
	
	    <label class="visually-hidden" for="{hyperparameterId}-number">
	      {hyperparameterName} (exact value)
	    </label>
	
	    <input
	      id="{hyperparameterId}-number"
	      name="{hyperparameterId}"
	      type="number"
	      min="0"
	      max="1"
	      step="0.01"
	      value="0.3"
	      aria-describedby="{hyperparameterId}-help"
	    />
    </div>

    <div id="{hyperparameterId}-help" class="field-description">
      <p>{fieldDesc: Plain English explaination for what this field controls.}</p>
      <p class="field-dependent">{fieldDependency: notes explaining if this field is dependent on another field}</p>
    </div>
  </div>
```

### `fieldDesc` Plain English Explaination

Each unique hyperparameter will need a plain English description explaining for a non-technical user how that parameter affects training the model. These descriptions should be stored in a way that allows for translation. Use of some technical terms is unavoidable, but when a technical term is used within the description it should be wrapped in an `<abbr>` tag and display a tooltip with an explaination.

### `fieldDependency` Field Dependency

When the value of one hyperparameter depends on another it should be 

### Synchronising Range and Numeric Inputs

When a form field contains both an `<input type="range">` and an `<input type="number">`, the two controls must remain synchronised and represent a single parameter value.

### Requirements

- Both inputs must share a single source of truth for their value.
- Updating the range slider must immediately update the numeric input.
- Entering a valid value in the numeric input must immediately update the slider.
- Use the `input` event rather than `change` to support continuous updates.
- Allow users to temporarily enter incomplete or invalid numeric values without immediately overwriting their input.
- Validate numeric values against the configured `min`, `max` and `step` constraints.
- Avoid circular updates or unnecessary re-renders.
- Only the numeric input should have a `name` attribute, ensuring the form submits a single value.
- Both inputs must have accessible labels and reference the field explanation using `aria-describedby`.

### Lit Implementation

Implement synchronisation using Lit's reactive properties and event handlers, rather than manually querying and manipulating DOM elements.

Maintain a canonical numeric value alongside a temporary numeric-input editing value where necessary. Invalid or incomplete text must not update the canonical value or slider. Define how invalid input is handled on blur, such as restoring the last valid value or displaying a validation error.

Ensure changes can also be propagated to parent components through an appropriate custom event.

### Hyperparameter Slider Scales

Support multiple slider scales to accommodate the different numerical characteristics of machine-learning hyperparameters.

#### Requirements

Implement three configurable scales:

| Scale | Description | Example Hyperparameters |
|---|---|---|
| `linear` | Slider position maps linearly to the parameter value. | Probability thresholds, subsampling ratios |
| `logarithmic` | Slider position maps logarithmically to the parameter value, allowing exploration across several orders of magnitude. | Learning rates, regularisation strengths, gamma |
| `integer` | Slider moves between discrete integer values. | Number of trees, maximum depth, number of neighbours |

#### Logarithmic Scale

For logarithmic sliders, the slider position should represent an exponent rather than the parameter value directly.

For example:

```typescript
// Convert slider position to parameter value
const value = 10 ** exponent;

// Convert parameter value to slider position
const exponent = Math.log10(value);
```

Requirements:

- Support positive `min` and `max` values spanning multiple orders of magnitude.
- Prevent zero or negative values from being configured for logarithmic scales.
- Display the actual parameter value in the numeric input, not the exponent.
- Convert numeric input values back into logarithmic slider positions.
- Use configurable precision to avoid floating-point artefacts.
- Ensure bidirectional conversion does not cause unexpected value changes or excessive rounding.
- Preserve valid manually entered values even when they fall between slider positions, unless the parameter explicitly requires discrete steps.
- Consider displaying scale labels or tick marks to help users understand logarithmic behaviour.

#### Component API

Implement these capabilities in a reusable Lit component, for example `<parameter-input>`.

Suggested configuration properties:

| Property | Description |
|---|---|
| `value` | Current parameter value |
| `min` | Minimum permitted value |
| `max` | Maximum permitted value |
| `step` | Increment used by the slider |
| `scale` | `linear`, `logarithmic`, or `integer` |
| `precision` | Display precision for numeric values |
| `disabled` | Whether the controls are disabled |

The component must treat the actual hyperparameter value as its canonical value, regardless of the slider scale.

#### Acceptance Criteria

- Adjusting either input updates the other appropriately.
- Linear, logarithmic and integer scales behave consistently.
- Logarithmic conversions are reversible within the configured precision.
- Invalid numeric entries do not corrupt the canonical parameter value.
- Manually entered values retain their precision where permitted.
- The component works with both keyboard and pointer interactions.
- Automated tests cover boundary values, invalid input, scale conversions, floating-point precision and synchronisation.

## Dot Rules
A key pedagogical principle of this application is to let the user navigate instead of automatically advancing to the next step. However, the `<div class="dot"></div>` element is used to indicate to a user when there is a next logical step for them to move to.

It is currently used in the following siutations:
- On the `class="step-link"` for step 2 once a dataset has been selected in step 1.
- On `.step-model-link` immediately after the user sets the target variable by clicking `<button class="btn btn-primary">Set as Target</button>`.

## General Fixes

### Sidebar
- Resolve models nested link problem.