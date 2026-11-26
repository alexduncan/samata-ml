# UI Fixes

- Disable scroll on body while a `dialog.modal` is open.
- `header.page-header` inside `main` should stick to the top of the viewport when scrolling.

## Improve Virtualized Table

### Navigation from "Select Data"
- Clicking "Load Dataset" should immediately navigate the user to the preview and display a `progress` bar directly inside main while dataset is being loaded into IndexdDB.
- Custom CSV uploads should first complete parsing with the "Upload Custom Dataset" modal still open. Once the dataset has been parsed to ensure it can be used the UI should then switch to the preview and show a `progress` bar directly inside main while the CSV is being loaded into IndexdDB.
- Change the `.page-header` on preview to include a button to open the "Datasheet" in a modal:
```
<div class="page-actions">
	<button class="btn">Datasheet</button>
	<button class="btn btn-red">Change Dataset</button>
</div>
```
- Add `{displayName}` inside `.overlay-title h4` in the slide-over column details panel:
```
<div class="overlay-title">
	<h4>{displayName}<br><span class="col-name">{name}</span></h4>
	{...}
</div>
```

### Virtualisation Changes
- Remove `.status-box` and `.controls-bar`.
- Scrolling the virtual table needs to be moved to `<body>`.
- Unwrap `ui-virtual-table` so it sits directly inside `<main>`.
- Set the height on `div.table-body` by multiplying row height by the number of rows.
- Each row `div.table-row` is positioned using `transform: translateY({scroll-distance});will-change: transform;`.
- Maintain an **overscan buffer** of `visibleRows * 2` to avoid the user seeing empty space.
- Synchronize DOM updates using `requestAnimationFrame`.
- Decouple the scroll listener from DOM updates. The scroll event listener should update a variable e.g. `currentScrollTop` and flags that an update is pending. If an update is pending and no `requestAnimationFrame` is currently queued then call `requestAnimationFrame(updateVirtualTable)` the `updateVirtualTable` function reads `currentScrollTop`, performs the row math, executes the DOM mutations, and clears the pending flag.
- The function `updateVirtualTable` calculates which rows need moving and which need mutating depending on `currentScrollTop`.
- Smarter calculation of column widths. Use the `max` value for numeric columns to set a more suitable width with a sensible `min` value to ensure `boolean` columns don't become too narrow.
- Use classes for each data-type e.g. `<div role="cell" class="table-cell table-cell-num" title="1">1</div>`. This will allow:
	- `numeric` columns to have `font-variant-numeric:tabular-nums;text-align:end;`.
	- `date` and `datetime` columns to have `font-variant-numeric:tabular-nums;text-align:start;`.
	- `boolean` and `categorical` columns to use `text-align:center;`.
	- The default on `div.table-cell` should be `text-align:start;`.
- Cells in columns which are currently unspported e.g. `text` should have the class `.unsupported` on `div.table-header-cell` every `div.table-cell`.

### Header Cell Format
Change the markup of header cells to contain the `displayName` for pre-configured datasets.
```
<div class="table-header-cell" role="columnheader">
	<button type="button" class="header-btn" data-col-key="id">
		<!-- Pre-configured Datasets -->
		<span class="col-display-name">{displayName}</span>
		<span class="col-name">{name}</span>
		<!-- Custom Uploded Datasets -->
		<span class="col-name">{name}</span>
	</button>
</div>
```
The cell header should use `overflow: hidden;white-space:nowrap;text-overflow: ellipsis;` with the text set on a `title` or `aria-` attribute depending on what WCAG best practice says.


### Open Issues

- Unsupported columns need an `<svg><use href="alert" /><svg>` on the right of the column header.
- [ ] Multiple column widths.
- [ ] Style column types.
- [ ] Format Dates & times better.
- [ ] Style unsupported columns.
- [ ] Load dataset progress bar. Progress knowable?!?

## Rules for The Dot

A key pedagogical principle of this application is to let the user navigate instead of automatically advancing to the next step. However, the app will use the animated `<span class="dot" aria-hidden="true"></span>` element known as **The Dot** to indicate to a user when there is a next logical step for them to move to.

As soon as the user navigates to the step containing **The Dot**, it should be removed from the DOM.

To draw attention to the dot arriving. As soon as the **The Dot** has been added to the DOM. On the next `requestAnimation` frame append a temporary fixed positioned element to the `body` that will have a one time animation applied from `opacity: 1;transform: scale(1);` to `opacity: 0;transform: scale(30);` over 2000ms. Once it's animation completes it should be removed from the DOM. This separate element is required to avoid issues with `overflow: hidden;` being set on parent elements of **The Dot**.

It is currently used in the following siutations:

- On the `class="step-link"` for step 1 until the user selects a dataset.
- On the `class="step-link"` for step 2 once a dataset has been selected in step 1.
- On the `class="step-link"` for step 2 if the user navigates away from step 2 without selecting a target variable.
- On the `.step-model-link` immediately after the user sets the target variable by clicking `<button class="btn btn-primary">Set as Target</button>`.
- On the `.step-model-link` if the user navigates away from `/models/new` without completing training of their first model.
- On the `.step-model-link` immediately after a user completes training of their first model.
- On the `<li class="step"><a href="/compare-results">` link immediately after the user has trained their second model and are now able to compare multiple models.

## General Fixes

### Model Workflow

- Clicking "Select Model" on a Model Card should use:
    1.  Use a css animation to slide `.train-step-content` closed then move the class `.step-active` and `aria-current="step"` to the second step.
    2.  Change the value of `#step-1-title` to `1. {ModelName}`.
    3.  Add `.train-step-action` to Step 1 containing the completed label, SVG icon and Edit button.
    4.  Render the contents of Step 1 and then animate open the `.train-step-content` element.
    5.  This same process should be repeated each time the user completes a step. Except for the final step where the interface updates as shown in [03-7_train-models-5-results.html](/specification/mockups/03-7_train-models-5-results.html)
    6.  Update all SVG check icons from `<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path></svg>` to the much clearer `<svg class="icon" aria-hidden="true"><use href="#check" /></svg>`.

### Experiment Names

Each time a user trains a model the sidebar adds a label in the format `{Model #}` inside the element `a.step-model-link`. This label is also used in `.page-header h1` on a single model results page.

I want to change this in the following ways:

#### Before First Model is Trained

- Before the first model has been trained the link in the sidebar should match **Example 2: Train New Model Link**
- Once the target variable has been selected the `<div class="dot"></div>` element should be added to this element to indicate to the user the next step for them to complete.

#### During model training:

- Change the url for training a new model to `/models/new`.
- A model will stay on this url until it finishes training and displays the results at `/model/{modelNum}`
- While the url is `/models/new` the the `.step-model-link` in the sidebar should match **Example 1: Model Training Link**.
- If the user tries to navigate away from `/model/new` show a modal asking them if they are sure they want to abandon training the model.
- While on `/models/new` the user should still be able to click links which display a `<dialog>` for example `/help/{help-doc}`.

#### Once a model is trained:

- Update the url to `/models/{modelNum}`.
- Update the `.step-model-link` in the side bar to match **Example 4: Trained Model Link**
- Update it's label to `{modelNum} - {modelName | modelLabel} ({numFeatures} features)`.
- `modelLabel` will be manually updateable in a future update so add it as an attribute on the model evaluation object.
- Display the **Example 3: Train Another Model** Link at the bottom of `.step-models`.
- Update the label used in `.page-header h1` to

#### Model Colours

- Automatically sequentially assign colour swatches to each model once it is trained.
- The styles for the colors are in [swatches.css](/specification/mockups/css/swatches.css).
- Add the `modelColor` as an attribute on the model so in a future update it can be made manually updateable along with `modelLabel`.
- Use the classes `swatch-{color}` to apply a different color to each model.
- I give permission to ignore the WCAG contrast requirements for these model swatches.

#### Example 1: Model Training Link

```html
<div class="step-model-link" aria-current="step">Training New Model...</div>
```

#### Example 2: Train New Model Link

```html
<li class="step-model">
	<a href="/models/new" class="step-train-new">Train New Model </a>
</li>
```

#### Example 3: Train Another Model

```
<li class="step-model">
	<a
		href="/models/new"
		class="step-model-link">
		Train Another Model
	</a>
</li>
```

#### Example 4: Trained Model Link

```html
<li class="step-model">
	<a href="/models/{modelNum}" class="step-model-link step-trained-model">
		<span class="swatch swatch-{modelColor}">{modelNum}</span>
		<span class="step-model-name">{modelName}</span>
		<span class="chiclet">{numFeatures} features</span>
	</a>
</li>
```

#### Link for `/models`

Change the HTML of the link to view all models. This is a visual change to stop the link taking up so much space.

```
<li class="step">
	<div class="step-link">
		<span class="step-num">3</span>
		<a href="/models" class="step-link-small">All Trained Models</a>
		<ol class="step-models">
		{...}
```

### Model Training Progress

Please review the updated HTML in [03-6_train-models-5-train.html](/specification/mockups/03-6_train-models-5-train.html) and make the changes necessary to update the app UI. If there are any problems with this design and layout please ask me to make a decision on how to resolve them.

### Model Step Help Links

The following steps need a dedicated help document and a link:

| Step               | Help Link Text               | Help Document Contents                                                                                                    |
| ------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 2. Select Features | What are Featues?            | Plain english description of features.                                                                                    |
| 3. Configure Model | What do these settings mean? | Plain english description of hyperparameters.                                                                             |
| 4. Training Setup  | What is this?                | Plain english break down of the different ways a model can be trained and a table with the pros and cons of each appoach. |

The HTML for the `.train-step-header` should be updated to:

```
<header class="train-step-header">
	<h2 id="step-3-title">
		3. Configure Model
		<a href="/help/configure-model" class="help-link">What do these settings mean?</a>
	</h2>
</header>
```

The CSS for `.help-link` is now used in multiple places and needs updating and moving out from inside `.train-step-header` to a more suitable location.

```
.help-link {
	display: inline-flex;
	align-items: center;
	gap: 0.25rem;
	margin-left: 0.5rem;
	border-radius: 0.375rem;
	padding: 0.5rem 0.75rem;
	color: var(--blue-700);
	font-weight: 400;
	font-size: 0.875rem;

	&:hover {
		background-color: var(--blue-100);
	}
}
```

### Use Same Features

### Helper Tips

What situations could the user-interface provide helpful tips?

Warn user if selecting Same Model and Same Features

### Update Model Training UI

- Implement new progress bar design.
- Add timings in mins and seconds for each training run or cross-validation fold.

### Feature Selection

Add 'filter' step during "Design Features" which will only permit features through to the next step which are capable of being used by a model for example `datetime`.

### Sidebar

- Resolve models nested link problem.
- Temporarily change the `<button class="btn-icon project-settings"` into a "delete" link that displays an "Are you sure?" modal with options for "cancel" and "delete." If the user clicks "delete" on the modal, the state should be reset, except for the parameter which records if the welcome modal was dismissed.

### Hover Menu

- Component to display a hover menu adjacent to the triggering element.
- Ideally use CSS anchor positioning.
- Ensure the menu stays on screen when the triggering element is close to the edge of the viewport.
- Attach an event that closes the menu whenever the user clicks elsewhere on the viewport outside of the menu.
- The menu should accept an array of buttons.

### Edit Project Menu

Use the hover menu component to display a hover menu when the user clicks on the project.
The menu should contain:

- Edit Project Name
- Download Project as Zip
- Delete Project

### Training Step Warning

Warn a user when trainibg a later model that it isn't good to compare a model trained by One-shot versus cross-validation.

### Edit Model Menu

- Add a hover menu with options to edit the "Name"
- Assign each model a color.
- Add an option in the hover menu to change the color assigned to a model.

### Large Screens

- Don't allow `.page-body` to expand beyond `max-width: 60rem`.

### CSS Principles

- Prefer logical CSS properties instead of physical properties to better support i18n.

### Move Remote Dataset Notices

Move all `<p class="remote-notice">Downloaded from the source when loaded. Internet connection required.</p>` to a `<div class="notification notification-info">When loaded, this dataset will be downloaded from {link}.</div>` inside the modal displaying dataset card.

### Sidebar Improvements

- Update `.step-value` to `text-overflow: ellipsis;overflow: hidden;white-space: nowrap;` to prevent it from wrapping.
- For pre-configured datasets in `/content/datasets/` the `displayName`.

- Why does "Cancel Training" take so long?

### Add Delete Button to Project

```
<section class="project">
	<h4>Project</h4>
	<span class="project-name">New Project</span>
	<button class="btn-icon project-settings" aria-label="Project settings">
		<svg class="icon" aria-hidden="true" focusable="false">
			<use href="#delete"></use>
		</svg>
	</button>
</section>
```
