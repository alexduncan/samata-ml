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
      {MockupName: Simple Plain English Name of Mockup}

	  <!-- Add a status to each mockup (draft, ready, implemented) -->
      <span class="mockup-status mockup-status-{status}">
        {MockupStatus: draft|ready|implemented}
      </span>
    </h4>
	<!-- Add a simple description of the mockup to help reviewers understand its context -->
    <p class="mockup-description">
      {MockupDescription: Simple description of the situation in which a user will encounter this
      ui.}
    </p>
  </div>
  <nav id="mockup-controls" aria-label="Mockup review">
    <!-- Removed label for the select element. WCAG comliance isn't important for this mockup review tool -->
    <select id="preview-page">
      <option value="{file-name.html}">
        {Mockup Name} ({file-name.html})
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

Change the command `bun run serve:scaffold` to `bun run mockups`.

### 4) Create a Mockups Index

Flatten the structure of `./samata-ml/specification/mockups/`. All HTML files should live directly inside the folder.

When an agent creates a mockup it should add the metadata to the `<head>` of the HTML file using:
- `<meta name="name" content="{Name of The Mockup}"/>`
- `<meta name="description" content="{Description The Mockup}"/>`
- `<meta name="status" content="{draft|ready|implemented}"/>`

The bun script which serves mockups should use this meta data to generate `/index.json` which can be fetched by a script in each page to generate the `<select>` options for switching between mockups.

Javascript can render the table of mockups when the user loads `http://localhost:3000/` in a browser.

### 5) HTML Comments For Clearer Explainations

Whenever an agent combines multiple HTML fragments representing different possible UI states into a single file it should wrap each fragment in opening and closing HTML comments to make it clear for me. For example:
```html
<!-- Empty -->
<!-- This will display when... -->
<section>
	<h2>Empty</h2>
	<p>This model has not completed training.</p>
</section>
<!-- / Empty -->

<!-- Result Error -->
<!-- This will display when... -->
<section>
	<h2>Result error</h2>
	<p role="alert">
		The result layout could not be loaded or uses an unsupported version.
	</p>
	<button class="btn" type="button">Retry</button>
</section>
<!-- / Result Error -->
```

## Improve Virtualized Table
1. Remove the loading element and table navigation elements.
2. Move scroll to body. Unwrap `ui-virtual-table` so it sits directly inside `<main>`.
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
	1. Use a css animation to slide `.train-step-content` closed then move the class `.step-active` and `aria-current="step"` to the second step.
	2. Change the value of `#step-1-title` to `1. {ModelName}`.
	3. Add `.train-step-action` to Step 1 containing the completed label, SVG icon and Edit button.
	4. Render the contents of Step 1 and then animate open the `.train-step-content` element.
	5. This same process should be repeated each time the user completes a step. Except for the final step where the interface updates as shown in [03-7_train-models-5-results.html](/specification/mockups/03-7_train-models-5-results.html)
	6. Update all SVG check icons from `<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path></svg>` to the much clearer `<svg class="icon" aria-hidden="true"><use href="#check" /></svg>`.

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

| Step | Help Link Text | Help Document Contents |
| --- | --- | --- |
| 2. Select Features | What are Featues? | Plain english description of features. |
| 3. Configure Model | What do these settings mean? | Plain english description of hyperparameters. |
| 4. Training Setup | What is this? | Plain english break down of the different ways a model can be trained and a table with the pros and cons of each appoach. |

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