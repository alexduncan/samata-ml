# Steps

**Status:** partial — Steps 1–2, classification training, shared single-model results and comparison are implemented. Tuning and model-specific results remain target.

This web application has four sections.

Startup reconciles saved browser state with IndexedDB before opening a workflow view. If a committed change cannot be published, Restore saved work offers Retry saving and withholds workflow actions. The [welcome modal](mockups/00_first-load.html) opens for a fresh workspace once saved-state recovery is clear.

## 1. Load Data

**url:** `/data`

This is the first page the user sees when the app loads. It supports two modes: selection mode (`mode: 'select'`) when no dataset is loaded, and preview mode (`mode: 'preview'`) once a dataset has been ingested into browser storage.

### Sample Datasets

The page shows a card for each sample dataset in the generated catalogue at `/datasets/index.json` ([sample-datasets.md](sample-datasets.md)). Each card shows `name`, `tagline`, `stats.rowCount` and `stats.columnCount`, with buttons for "Datasheet" and "Load Dataset". This is shown in [01-1_select-data.html](mockups/01-1_select-data.html).

For any dataset where `csvOrigin === 'remote'` (such as COMPAS Recidivism), the card's enclosing item prominently displays a remote source notice: _"Downloaded from GitHub when loaded; internet connection required"_.

Clicking the "Datasheet" button on a dataset card displays a modal containing sanitized markdown/HTML information about the sample dataset as shown in [01-2_dataset-card.html](mockups/01-2_dataset-card.html). Hostile markup (`<script>`, inline handlers, iframes) is stripped. Network failures display an alert with a "Retry" button, and closing the modal returns focus to the invoker button.

### Custom Dataset Upload

The `.page-header` contains a button "Upload Dataset". Clicking the button displays a modal as shown in [01-3_upload-dataset.html](mockups/01-3_upload-dataset.html).

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

- A page header with the dataset name, row/column counts, and a "Change Dataset" button. Clicking "Change Dataset" opens a confirmation modal requiring explicit confirmation before discarding the active dataset. The confirmation cancels local training before the deletion and waits for its acknowledgement. If another tab is training, the confirmation stays open with an explanation. After a committed deletion that could not be published, Retry saving finishes the same change. New data enters preview after the staged dataset pointer is acknowledged.
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

The user chooses the target variable to predict from their loaded dataset. Visual layout follows [02-1_set-target.html](mockups/02-1_set-target.html) and [02-2_target-set.html](mockups/02-2_target-set.html).

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
- Clicking "Set as Target" for a different column opens a native `<dialog class="confirm-dialog">` requiring explicit confirmation before the protected target change discards existing models and results. The dialog stays usable when another tab is training. A committed change awaiting publication keeps the dialog open with Retry saving and disables duplicate deletion.
- Dismissing the modal (via Cancel or Escape) retains all existing models and restores focus to the invoking button.
- If the dataset is changed while the modal is open, the modal closes safely without applying pending mutations.
- Clicking the button for the column that is already the current target is a no-op that never displays confirmation or alters models.

### Continuation

- After the target change is acknowledged, the user stays on `/target` to inspect the table.
- A "Train Models" link (`<a href="/models" class="btn btn-primary">`) in the page header enables proceeding to Step 3 once a target is selected.

## 3. Train Models

**url:** `/models`

This step allows the user to train models on the dataset to predict the target variable. Multiple models can be trained sequentially, each with six accordion steps.

If the user visits `/models` before selecting a dataset or setting a target variable, an alert notification displays informing the user they must complete earlier steps (`data-testid="models-blocked"`).

Once a dataset and target are configured:

- If no models exist, `/models` displays the empty notice _"No models yet. Train a new model to get started."_ (`data-testid="models-empty"`).
- A primary button "Train New Model" creates a new model record with monotonic numbering (Model 1, Model 2, etc.). The app navigates to `/models/{num}` after creation is acknowledged. A failed save leaves the learner on Models with recovery feedback.
- If models exist, `/models` renders a table (`data-testid="models-list"`) with columns:
    - **Model Name:** Displays `Model {num} — {Library Name}` (e.g. "Model 1 — Logistic Regression") or `Model {num}` if no model is selected yet. Models cannot be renamed, deleted, or duplicated.
    - **Features:** A comma-separated list of selected features in dataset column order, or "Not selected".
    - **Configuration:** Hyperparameter settings or "Not configured".
    - **Training Setup:** The formatted strategy and split or fold count, or "Not configured".
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
- **Edit:** confirmation is requested when a later section, including Training Setup, is complete.

### 4. Training Setup

Choosing a strategy requires ready metadata for the current dataset and target. For classification, samatā requires at least two observed classes with two or more rows each. Categories with no observed rows are excluded from this check. This is an input rule in samatā. The training library web-ml determines whether it can execute the requested partition. If the target is ineligible or missing, the section explains why and links to Set Target. If metadata cannot be read, the section offers Retry.

**One-Shot** is selected initially. It requests an 80% training and 20% test split with stratification and a fixed seed of 42. **Cross-Validation** starts at five folds or the eligible maximum, whichever is smaller. The range and exact number field accept integers from 2 through the smallest observed class count, capped at 10. A scrollable matrix shows the training and validation roles for each run and the summary gives their approximate percentages. Both Help links open the Training Setup article over the builder.

**Train Model** is the form's submit button. A field error leaves it enabled and submission moves focus to the exact number field. The controls are disabled when the setup is blocked or read-only. Valid submission requests a single training attempt. The builder activates Section 5 while the accepted start is pending and shows the chosen setup when the start is acknowledged. A rejected start leaves Section 4 open with a reason. The **Training Setup** column on Models uses the same formatted summary. See [Training Setup](components/training-setup.md) for the controls and validation states.

For targets with more than two categories, the multiclass strategy is fixed by the model (native, One-vs-Rest or One-vs-One as the classifier supports) and shown read-only in Section 3. Selecting a strategy and Error-Correcting Output Codes remain future work.

### 5. Training

Training runs in a dedicated worker while the app remains navigable. One-Shot evaluates an independent stratified holdout. Fixed Cross-Validation evaluates the chosen folds and refits the classifier on all eligible rows. See [Machine Learning Orchestrator](machine-learning-orchestrator.md) for the worker and storage contract.

The [training panel](components/training-progress.md) displays one labelled native progress bar and a disclosure with the latest status and chronological log. The disclosure preference survives reload. The tab that owns the attempt can cancel before saving. Other tabs display the training status. Cancellation, fitting failure and interruption return to Training Setup with a reason and the saved settings.

Saving holds at 95%. If the result is committed and state publication fails, the panel offers Retry saving and keeps Cancel Training and View Results disabled. Acknowledged completion shows 100%, the elapsed time and View Results. View Results acknowledges Section 5, replaces the button with the completion check and focuses Section 6 on the same URL. The saved log remains inspectable. A trained model opened from Models displays Section 5 until this acknowledgement.

Detailed timing tables for nested evaluation and tuning belong to the later results and tuning phases. The [03-6 draft](mockups/03-6_train-models-5-train.html) awaits human styling.

### 6. Single Model Results

Section 6 opens after the learner acknowledges a trained result and shows the shared results that apply to every classifier. All numbers come from held-out rows (the test split, or the pooled folds of Cross-Validation) and are stored by the training library; the app only displays them. Training-set scores are never presented as results. See [Model Results](components/model-results.md) for the elements and their stories.

The blocks appear in this order, each with its own heading:

1. **Scores on held-out rows.** A run line (model, dataset, target, protocol, held-out rows scored) and the headline. **Balanced accuracy** is first because it treats every class equally; for Cross-Validation it is the mean of the fold scores with their standard deviation and interquartile range, and for One-Shot it is one value with the sentence that no spread is available. **Accuracy** follows with the most-frequent-class baseline and the signed difference in percentage points. Macro-F1 is in the headline for multiclass targets and in **More metrics** for binary targets. More metrics also lists MCC, ROC-AUC, average precision, log loss, Brier score and expected calibration error, each with its reason when unavailable. Fit time, or the total fit and scoring time across folds, closes the block. When the mean paired training minus held-out balanced accuracy reaches ten percentage points, a diagnostic card names both scores and the gap; the "compare with a default or tuned range" action waits for tuning.
2. **Score on the test split / Scores across folds.** A dot-and-interval strip on a fixed 0–100% scale: one dot per partition, a mean mark, a standard-deviation rule for Cross-Validation and two labelled dashed baselines (always the most frequent class; random guesses by class share).
3. **Where the model makes mistakes.** Binary targets show a flowchart of two proportional rows with a full sentence per outcome. Multiclass targets show Classee strips: correct predictions to the right of zero and errors to the left, stacked by the class they were mistaken for. A confusion matrix and a per-class precision, recall and F1 table follow. With more than twenty classes the matrix and strips default to the twenty largest classes and a labelled filter chooses one true class.
4. **Probability threshold** (binary only). A histogram of positive-class probabilities by true class, a labelled slider and the stored counts and rates at the chosen cutoff. A sentence beside the slider states that exploring does not change the stored scores. The threshold survives reload.
5. **Calibration.** Observed against predicted probability per bin with a dashed diagonal and an aligned count histogram; multiclass targets use top-label confidence against accuracy. The expected calibration error is in the caption and lines break at empty bins.

Every chart has a figure caption with a one-sentence takeaway and a "Show data table" disclosure with the same values in a native table. Colour is never the only carrier of meaning. A block that is unavailable renders one sentence with the reason, for example that log loss and the threshold explorer need probability estimates the model was trained without.

Other states: a loading indicator while the saved result is read; an empty message for a model that is not trained; a **legacy** message with a link to Models and its Train New Model action for results saved before detailed results existed; a **lost** message when a result that was acknowledged has gone missing; and an alert with Retry when the read fails. A result that is missing at startup returns the model to Training Setup with its configuration and a notice.

The threshold, class filter and More metrics preferences are saved per model. Model-specific sections (Phase 6) will use a per-model registry in `src/config/models/{model-name}-results.ts`; the shared blocks above are fixed in code. The [03-7 draft](mockups/03-7_train-models-5-results.html) shows the semantic structure and awaits human styling.

## 4. Compare Results

**url:** `/results`

The classification comparison groups trained models by the fingerprint of their held-out rows and partitions. Models in different groups cannot be mixed; singleton or inconsistent groups explain why they are unavailable. Once results have loaded, the largest eligible group is selected (ties use the earliest model), with at most eight models selected. Fewer than two trained models shows a notification and link to Models; loading, missing, legacy and read-error results are explained individually. A learner may choose a group and any two to eight models. A deliberate selection of fewer than two shows guidance instead of comparison charts.

The sections appear in order: a sortable table of held-out metrics and fixed baseline rows; balanced-accuracy dots for matching partitions with paired connecting lines; per-class error rates; an ordered A/B pair and signed confusion differences; practical-equivalence probabilities; and instance agreement. The table includes balanced accuracy, macro-F1, MCC, accuracy, available ROC-AUC, average precision, log loss, Brier and calibration error, train–test gap, spread, error counts and protocol-appropriate time. Binary groups also show false positives and negatives. Missing measures have an explanation; inconsistent baseline reports suppress the affected baseline. Higher and lower being better are labelled where applicable. Sorting does not imply a winner.

For two cross-validation models, the analysis worker asks `web-ml` for a Bayesian correlated t-test on matching held-out balanced-accuracy folds. The width defaults to 0.01 and accepts 0.001–0.1 in 0.001 steps. The three labelled probabilities show A higher, practically equivalent and B higher; the caption names both models, width and fold count. One-Shot or fewer than two folds explains why the analysis is unavailable. Swapping the pair reverses the confusion difference and requests the new ordered posterior. More than twenty classes offers a true-class filter. Charts provide captions and data tables; no automatic winner is selected. Group, selection, sort, pair, width and filter survive reload. The [04 draft](mockups/04_compare-results.html) awaits human styling.
