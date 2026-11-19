# Steps

**Status:** partial — Steps 1–2 and Step 3 setup (overview, Choose Model, Select Features) are implemented. Model configuration, training execution, and Step 4 Results remain target.

This web application has four sections.

When the script loads it will check localStorage for saved app state.

If no saved state is found in localStorage, the user will be shown a welcome modal as shown in [00_first-load.html](mockups/ui-scaffold/00_first-load.html).

## 1. Load Data

**url:** `/data`

This is the first page the user sees when the app loads. It supports two modes: selection mode (`mode: 'select'`) when no dataset is loaded, and preview mode (`mode: 'preview'`) once a dataset has been ingested into browser storage.

### Sample Datasets

The page shows a card for each sample dataset in the generated catalogue at `/datasets/index.json` ([sample-datasets.md](sample-datasets.md)). Each card shows `name`, `tagline`, `stats.rowCount` and `stats.columnCount`, with buttons for "Datasheet" and "Load Dataset". This is shown in [01-1_select-data.html](mockups/ui-scaffold/01-1_select-data.html).

For any dataset where `csvOrigin === 'remote'` (such as COMPAS Recidivism), the card's enclosing item prominently displays a remote source notice: _"Downloaded from GitHub when loaded; internet connection required"_.

Clicking the "Datasheet" button on a dataset card displays a modal containing sanitized markdown/HTML information about the sample dataset as shown in [01-2_dataset-card.html](mockups/ui-scaffold/01-2_dataset-card.html). Hostile markup (`<script>`, inline handlers, iframes) is stripped. Network failures display an alert with a "Retry" button, and closing the modal returns focus to the invoker button.

### Custom Dataset Upload

The `.page-header` contains a button "Upload Dataset". Clicking the button displays a modal as shown in [01-3_upload-dataset.html](mockups/ui-scaffold/01-3_upload-dataset.html).

The modal provides both a keyboard-reachable native file picker and a drag-and-drop zone. Upload criteria:

- Single `.csv` file (case-insensitive filename check).
- File size up to browser limits, max 256 columns.
- Progress reporting through dedicated phases: _Downloading dataset_, _Reading CSV_, _Detecting column types_, _Calculating statistics_.
- Plain-English error mappings without raw exceptions.
- Dismissing or cancelling the dialog aborts the running ingestion worker request and retains any existing dataset, target, and models intact.

### Preview Dataset

Dataset preview displays after successful loading of a dataset by:

1. Clicking the "Load Dataset" button on a Sample Dataset card.
2. Successful parsing and ingestion of a custom uploaded dataset.

The dataset preview view displays:

- A page header with the dataset name, row/column counts, and a "Change Dataset" button. Clicking "Change Dataset" opens a confirmation modal requiring explicit confirmation before discarding the active dataset.
- A virtual table (`ui-virtual-table`) rendering a 10,000-row active segment with segment navigation controls and "Go to row" input. Up to 10,000,000 rows can be browsed without unbounded DOM expansion.
- An inspector overlay panel (`app-column-details`) on the right when clicking a column header:
    - Column name, data type, and description.
    - Missing and invalid record counts and tokens.
    - If numeric: min, median, mean, max, and precomputed histogram bins.
    - If categorical: distinct value count, frequencies sorted descending, and percentages over non-missing values (with Show all / Show fewer toggle).
    - If boolean: true/false frequencies.
    - If datetime: earliest and latest UTC bounds.
    - Identifier candidate hint when distinct count equals row count.
    - Pressing Escape or the Close button dismisses the overlay and returns focus to the column header.

#### Future Development

- Add the ability to modify the values in a column including:
    - Convert numeric columns to `boolean` or `categorical` using rules.
    - Delete records based on specific column values.
- Ability to delete a column.

## 2. Set Target

**url:** `/target`

The user chooses the target variable to predict from their loaded dataset. Visual layout follows [02-1_set-target.html](mockups/ui-scaffold/02-1_set-target.html) and [02-2_target-set.html](mockups/ui-scaffold/02-2_target-set.html).

### Workflow States

- **Blocked view (`!hasDataset`):** When no dataset is loaded, a page header and notification alert (`.notification.notification-alert`) are displayed: _"Load a dataset before choosing a target."_ with a link to `/data`. Table actions are not rendered.
- **Loading view:** When column resources are being fetched, a loading status message displays: _"Loading column information…"_.
- **Failure view:** If column information fails to load, an alert message displays: _"Column information could not be loaded."_ along with a "Retry" button.
- **Ready view:** Displays a scrollable table (`table.table`) with a caption (`{Dataset Name} target candidates`) and four columns:
    - **Column Name:** The column name as a row header (`<th scope="row">`).
    - **Type:** The data type formatted as code (`<code>Numeric</code>`, `<code>Categorical</code>`, `<code>Boolean</code>`, `<code>Text</code>`, `<code>Datetime</code>`).
    - **Notes:** Explanatory reasons or advisory notices:
        - `INELIGIBLE_TEXT`: "Text columns cannot be targets."
        - `INELIGIBLE_DATETIME`: "Date and time columns cannot be targets."
        - `INELIGIBLE_ALL_MISSING`: "No usable values."
        - `INELIGIBLE_CONSTANT`: "Only one value is present."
        - `ADVISORY_IDENTIFIER`: "This column may identify individual records."
        - `ADVISORY_MISSING_VALUES`: "{count} missing or invalid values."
        - `ADVISORY_HIGH_CARDINALITY`: "{count} categories; check that this is a meaningful target."
        - `ADVISORY_TARGET_CANDIDATE`: "Suggested target"
        - `METADATA_UNAVAILABLE`: "Column information is unavailable."
          Disqualifying reasons disable the column; advisory notices provide informational guidance while keeping the column eligible.
    - **Action:**
        - For the currently selected target: A disabled button reading "Current Target".
        - For eligible columns: A button with `.btn-primary` reading "Set as Target" (accessible name: `Set as Target: {column}`).
        - For ineligible columns: A disabled button reading "Set as Target".

### Model Discard Warning and Confirmation

- If any models exist (`models.length > 0`), an alert notification displays above the table: _"Changing the target will reset all existing models."_
- Clicking "Set as Target" for a different column opens a native `<dialog class="confirm-dialog">` requiring explicit confirmation before discarding all existing models (`confirmDiscardModels()`) and setting the new target (`setTarget(column)`).
- Dismissing the modal (via Cancel or Escape) retains all existing models and restores focus to the invoking button.
- If the dataset is changed while the modal is open, the modal closes safely without applying pending mutations.
- Clicking the button for the column that is already the current target is a no-op that never displays confirmation or alters models.

### Continuation

- Setting a target updates state and keeps the user on `/target` to inspect the table.
- A "Train Models" link (`<a href="/models" class="btn btn-primary">`) in the page header enables proceeding to Step 3 once a target is selected.

## 3. Train Models

**url:** `/models`

This step allows the user to train models on the dataset to predict the target variable. Multiple models can be trained sequentially, each with six accordion steps.

If the user visits `/models` before selecting a dataset or setting a target variable, an alert notification displays informing the user they must complete earlier steps (`data-testid="models-blocked"`).

Once a dataset and target are configured:

- If no models exist, `/models` displays the empty notice _"No models yet. Train a new model to get started."_ (`data-testid="models-empty"`).
- A primary button "Train New Model" creates a new model record with monotonic numbering (Model 1, Model 2, etc.) and navigates to `/models/{num}`.
- If models exist, `/models` renders a table (`data-testid="models-list"`) with columns:
    - **Model Name:** Displays `Model {num} — {Library Name}` (e.g. "Model 1 — Logistic Regression") or `Model {num}` if no model is selected yet. Models cannot be renamed, deleted, or duplicated.
    - **Features:** A comma-separated list of selected features in dataset column order, or "Not selected".
    - **Configuration:** Hyperparameter settings or "Not configured".
    - **Training Setup:** Validation and splitting options or "Not configured".
    - **Duration:** Training duration formatted via i18n (e.g. "1.2s") or "Not trained".
    - **Action:** An action button linking to `/models/{num}`, labelled "View Results" if trained or "Continue" if draft.
- The header includes a "Compare Results" button (`<a href="/results">`). It is disabled with a visible hint until at least two models have completed training (`$canCompare`).

Each individual model builder view is routed at `/models/{num}`. Navigating to an invalid or unallocated model number safely redirects to `/models` with a `MODEL_NOT_FOUND` error notification.

### 1. Choose Model

The catalogue adapter (`model-catalogue.ts`) exposes supervised algorithms from `web-ml` suitable for predicting the active target:

- Categorical or Boolean target: the 8 classification algorithms, in library index order.
- Numeric, text and datetime targets: no model is offered. Section 1 shows the notice `No classification model available` with a link to `/target`. Regression, clustering and PCA algorithms are excluded.
- A model whose `modelId` is no longer available is reset to Section 1 at startup.

The UI renders candidate models:

- **Illustrated card:** `logistic-regression` renders as an `<app-model-card>` with an approved SVG illustration (`03-2_train-models-1-choose-model.html`) using semantic tokens.
- **Native text-entry fallback:** Remaining classifiers without custom artwork render as semantic list items (`03-9_choose-model-text-entries.html`) displaying the model name, description, an accessible "Model Description: {name}" button, and a "Select Model: {name}" button.
- Selecting a model updates `model.modelId` in app state and visually highlights the selection, but does **not** advance the workflow.
- A primary "Continue" button in `.section-actions` completes Section 1, initialises candidate features once via `initialiseFeatureSelection`, and activates Section 2.
- The "Model Description" button opens an `<app-model-description-dialog>` presenting authored Markdown content or falling back to library JSON metadata if unauthored.
- Once completed, the section header displays an "Edit" button (`reopen-btn`). Clicking "Edit" prompts a native modal confirmation; confirming clears downstream completions while preserving selections.

### 2. Select Features

Displays a tabular selection of all dataset columns in canonical dataset order:

- **Target column:** Rendered with a "Target" chiclet badge and no checkbox cell. The target variable is never selectable as a feature.
- **Ineligible columns:** Columns of type `text`, `datetime`, all-missing, or constant are disabled with visible note badges explaining why they cannot be included.
- **Advisory columns:** Identifier columns and target candidate leaky columns default unticked with an advisory note, but the user may deliberately override and check them.
- **Selection rules:** At least one feature must be selected to proceed. Initial features default to all eligible columns once on completing Section 1; intentional empty or subset selections persist across page reload.
- Clicking "Continue" completes Section 2 and records `completedSteps: ['choose-model', 'select-features']`.
- Once completed, an "Edit" button allows reopening Section 2 after native modal confirmation.

### 3. Configure Model

Section 3 activates after Section 2 and renders `<app-model-configuration>` ([spec](components/model-configuration.md)), a manual form generated from the selected classifier's catalogue document:

- **Fields:** every non-hidden option as a select, checkbox, range with exact number, number with Reset, compound mode select (`maxDepth`, `gamma`, `binarize`, `classWeight`) or layer editor (`hiddenLayerSizes`). Ranges show the recommended slider span; the number accepts any value in the valid domain.
- **Mode:** Manual is selected; Random Search (advanced) is disabled until tuning is specified.
- **Dependencies:** fields whose dependency is unmet are hidden with a dependency note; solver/penalty combinations follow the policy rule.
- **Multiclass:** when the target has more than two classes, a read-only note states the strategy used (no choice is offered).
- **Help:** the section heading links to `/help/configure-model` ("What do these settings mean?").
- **Completion:** `Save & Continue` stores sparse overrides, completes Section 3 as `3. Model Configured` and shows `Edit`. A failed submit focuses the first invalid control.
- **Edit:** confirmation is requested only when a later section is complete (Section 4 and later remain pending, so normally none).

### 4–6. Subsequent Sections (Pending)

Sections 4 (Configure Training), 5 (Training), and 6 (Results) display "Not available yet." and cannot be activated or completed in this version.

For targets with more than two categories the multiclass strategy is fixed by the model (native, One-vs-Rest or One-vs-One as the classifier supports) and shown read-only. Selecting a strategy and Error-Correcting Output Codes remain future work.

### 4. Configure Training

This step allows the user to choose the training, folding and validation proccedures.

**TODO: More work is required to design the specification for this step.**

Once this step has been configured the "Train Model" button in the `<header>` of the section will change from disabled to `.btn-primary`. The `<h2>` in the `<header>` of the section will change to display the chosen Training setup. After the user clicks the "Train Model" button, the button will be replaced with an `<svg><use href="#check" /></svg>` and the class `.train-step-complete` is added to the `.train-step` element.

### 5. Training

When the user clicks "Continue" on the **4. Configure Training** step, this step opens and displays a progress bar. Model training is handed to the `web-ml` library and event listener updates the progress bar and status text as model training progresses.

Once training is complete the section will display the time taken to train the model. In the case of "Nested Cross Validation" and "Hyperparameter Tuning" a table will display detailed results on the time for each step and a total row.

When training is complete the "View Results" button in the `<header>` of the section will change from disabled to `.btn-primary`. The `<h2>` in the `<header>` of the section will change to display "Training Complete". After the user clicks the "View Results" button, the button will be replaced with an `<svg><use href="#check" /></svg>` and the class `.train-step-complete` is added to the `.train-step` element.

### 6. Single Model Results

This step allows the user to view detailed results from the model training. Every model will display common metrics for the type of task (Classification | Regression).

A configuration file in `./src/config/models/{model-name}-results.ts` will be used to determine which specific charts are rendered for the trained model.

**TODO: More work is required to design the specification for this step.**

## 4. Compare Results

**url:** `/results`

Displays a comparison of metrics across different training rounds.

The top section will display common metrics for the type of task (Classification | Regression).

**TODO: More work is required to design the specification for this step.**
