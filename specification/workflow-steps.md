# Steps

**Status:** partial — Step 1 Load Data and Step 2 Set Target are implemented. Steps 3–4 remain target.

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

This step allows the user to train models on the dataset to predict the target variable. Multiple models can be trained and each model has six steps. The steps will appear as series of sections down the page.

If the user visits `/models` before they have selected a dataset or set the target variable. This step will show an alert notification telling the user they must first load a dataset and set the target variable before they can train a model.

Once the dataset and target variable have been configured `/models` will display a table of the trained models and columns for:

- Model Name
- Features (list of features used)
- Configuration (hyperparameters)
- Training Setup (validation and folding strategy etc.)
- Duration (time taken to train the model)
- View Results (button which opens the detailed results for that model)

If a model hasn't finished training the "View Results" button will display "Continue" and take the user to the model and display the current active step.

In the header of `/models` will be a button "Compare Results" which will navigate to `/results`. This button should be disabled until more than one model has been trained.

Each model will have a url `/models/{num}`.

### 1. Choose Model

Select the model from the list available in the web-ml library. This list will be limited to models which are suitable for training to predict the target variable:

- Classifiers for Boolean or Categorical columnns
- Regressors for numeric columns

The UI will show cards for each of the models available in the `web-ml` machine learning library. Each card will contain:

- `.badge` showing the type of model (Classification | Regression | Clustering)
- An `<svg>` graphic representation of how the model works.
- Name of the model (e.g. "Logistic Regression")
- Short description of the model.
- "Model Description" button which displays a modal containing detailed information about the model.
- "Select Model" button which allows the user to choose the model before they proceed to the next step.

After the user has clicked "Select Model" the "Continue" button in the `<header>` of the section will change from disabled to `.btn-primary`. The `<h2>` in the `<header>` of the section will change to display the name of the selected model. After the user clicks the "Continue" button, the button will be replaced with an `<svg><use href="#check" /></svg>` and the class `.train-step-complete` is added to the `.train-step` element.

### 2. Select Features

Displays a list of all columns in the dataset including the target variable. Each feature which is able to be selected will have a checkbox allowing the user to include that feature.

Depending on the model selected there will be additional options — for example "One-Hot Encoding" or "Regularization".

Once one feature has been selected the "Continue" button in the `<header>` of the section will change from disabled to `.btn-primary`. The `<h2>` in the `<header>` of the section will change to display the number of features selected. After the user clicks the "Continue" button, the button will be replaced with an `<svg><use href="#check" /></svg>` and the class `.train-step-complete` is added to the `.train-step` element.

### 3. Configure Model

This step allows the user to either directly choose each hyperparameter or to choose hyperparameter tuning and set values for each hyperparameter to tune.

If the target variable is Categorical containing more than two categories and depending on the options available in the `web-ml` library the user will have to select:

- Native multiclass
- One-vs-Rest
- One-vs-One

Later Error-Correcting Output Codes (ECOC) will be added as an option.

The configuration of each model's hyperparameters will be fetched from the file `./src/config/models/{model-name}-hyperparameters.ts`. The specification will be used to determine which ui controls need to be rendered.

Once all hyperparameters have been configured the "Continue" button in the `<header>` of the section will change from disabled to `.btn-primary`. The `<h2>` in the `<header>` of the section will change to display "Model Configured" or "Hyperparameter Tuning". After the user clicks the "Continue" button, the button will be replaced with an `<svg><use href="#check" /></svg>` and the class `.train-step-complete` is added to the `.train-step` element.

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
