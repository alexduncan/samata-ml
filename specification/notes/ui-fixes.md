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


## Dot Rules
A key pedagogical principle of this application is to let the user navigate instead of automatically advancing to the next step. However, the `<div class="dot"></div>` element is used to indicate to a user when there is a next logical step for them to move to.

It is currently used in the following siutations:
- On the `class="step-link"` for step 2 once a dataset has been selected in step 1.
- On `.step-model-link` immediately after the user sets the target variable by clicking `<button class="btn btn-primary">Set as Target</button>`.

## General Fixes

### Sidebar
- Resolve models nested link problem.
- Temporarily change the `<button class="btn-icon project-settings"` into a "delete" link that displays an "Are you sure?" modal with options for "cancel" and "delete." If the user clicks "delete" on the modal, the state should be reset, except for the parameter which records if the welcome modal was dismissed.

### Large Screens

- Don't allow `.page-body` to expand beyond `max-width: 60rem`.
- 
