# Steps

**Status:** partial — Steps 1–2, the provisional classification wizard, numbered single-model results and comparison are implemented. Tuning and model-specific results remain target.

This web application has four sections.

Startup reconciles saved browser state with IndexedDB before opening a workflow view. If a committed change cannot be published, Restore saved work offers Retry saving and withholds workflow actions. The [welcome modal](mockups/00_first-load.html) opens for a fresh workspace once saved-state recovery is clear.

### Next-step guidance

Learners navigate between steps by choosing a link. The Dot marks one suggested sidebar link at a time. The link retains its usual name and adds the description **Suggested next step** while the cue is present.

| When                                                                                                  | Suggested link                                                                                        |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| The learner is outside Load Data without a dataset                                                    | **Load Data** (`/data`)                                                                               |
| A dataset is acknowledged and the learner is outside Set Target                                       | **Set Target** (`/target`) while no target is selected                                                |
| The learner leaves Set Target without selecting a target                                              | **Set Target** (`/target`)                                                                            |
| Target selection is acknowledged, including an acknowledged replacement that leaves no trained models | **Train New Model** (`/models/new`)                                                                   |
| The learner leaves the first unfinished wizard                                                        | **Train New Model** (`/models/new`) while this dataset and target have never had a trained model      |
| The first training result is acknowledged                                                             | **Train Another Model** (`/models/new`) once the completed wizard is left or View Results replaces it |
| The second training result is acknowledged                                                            | **Compare Results** (`/results`). Comparison also takes precedence when both results arrive together. |

Entering the destination consumes its suggestion, including through browser history. Help above the same workflow page preserves its suggestion. Failed and cancelled actions leave acknowledged guidance unchanged. Reloading a saved project seeds the current trained count. Recovery of a result lost during the same sidebar session never replays its milestone. Leaving comparison or a later training attempt does not restore an already consumed suggestion.

A newly visible cue produces one two-second expanding fade. The small dot stays visible until the suggestion is consumed. Reduced motion shows the static dot throughout.

## 1. Load Data

**url:** `/data`

This is the first page the user sees when the app loads. It supports two modes: selection mode (`mode: 'select'`) when no dataset is loaded, and preview mode (`mode: 'preview'`) once a dataset has been ingested into browser storage.

### Sample Datasets

The page shows a card for each sample dataset in the generated catalogue at `/datasets/index.json` ([sample-datasets.md](sample-datasets.md)). Each card shows `name`, `tagline`, `stats.rowCount` and `stats.columnCount`, with buttons for "Datasheet" and "Load Dataset". This is shown in [01-1_select-data.html](mockups/01-1_select-data.html).

For each dataset where `csvOrigin === 'remote'`, the card’s enclosing item displays: _“Downloaded from the source when loaded. Internet connection required.”_ Bundled cards have no notice. Pima Diabetes and the former Seaborn Titanic ID are absent from new selection; Titanic Survival (1912 British Inquiry) is a separate sample. Existing saved projects retain their original guidance.

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

- A page header with the dataset name, row and column counts, and a "Change Dataset" button. The button opens the plain-text `dialog.confirm-dialog`, with Cancel first. Confirmation cancels local training before the deletion and waits for its acknowledgement. If another tab is training, the confirmation stays open with an explanation. After a committed deletion that could not be published, Retry saving finishes the same change. The selection view loads the catalogue when entered from a reloaded preview and offers Retry if the request fails. New data enters preview after acknowledgement of the staged dataset pointer.
- A virtual table (`ui-virtual-table`) rendering a 10,000-row active segment with segment navigation controls and "Go to row" input. Up to 10,000,000 rows can be browsed without unbounded DOM expansion.
- An inspector overlay panel (`app-column-details`) on the right when clicking a column header. The existing Help & Guide explains CSV, column types and the statistics shown here.
    - Column name, data type, and description.
    - Missing and invalid record counts and tokens.
    - If numeric: min, median, mean, max, and precomputed histogram bins.
    - If categorical: distinct value count, frequencies sorted descending, and percentages over non-missing values (with Show all / Show fewer toggle).
    - If boolean: true/false frequencies.
    - If date, time or datetime: earliest and latest values at the column's precision. UTC is stated only for datetime.
    - Identifier candidate hint when distinct count equals row count.
    - Pressing Escape or the Close button dismisses the overlay and returns focus to the column header.

#### Future Development

- Add the ability to modify the values in a column including:
    - Convert numeric columns to `boolean` or `categorical` using rules.
    - Delete records based on specific column values.
- Ability to delete a column.

## 2. Set Target

**url:** `/target`

The user chooses the target variable to predict from their loaded dataset. Help & Guide explains targets, features, class labels and target leakage. Visual layout follows [02-1_set-target.html](mockups/02-1_set-target.html) and [02-2_target-set.html](mockups/02-2_target-set.html).

### Workflow States

- **Blocked view (`!hasDataset`):** When no dataset is loaded, a page header and notification alert (`.notification.notification-alert`) are displayed: _"Load a dataset before choosing a target."_ with a link to `/data`. Table actions are not rendered.
- **Loading view:** When column resources are being fetched, a loading status message displays: _"Loading column information…"_.
- **Failure view:** If column information fails to load, an alert message displays: _"Column information could not be loaded."_ along with a "Retry" button.
- **Ready view:** Displays a scrollable table (`table.table`) with a caption (`{Dataset Name} target candidates`) and four columns:
    - **Column Name:** The column name as a row header (`<th scope="row">`).
    - **Type:** The data type formatted as code (`<code>Numeric</code>`, `<code>Categorical</code>`, `<code>Boolean</code>`, `<code>Text</code>`, `<code>Date</code>`, `<code>Time</code>`, `<code>Datetime</code>`).
    - **Notes:** Explanatory reasons or advisory notices:
        - `INELIGIBLE_TEXT`: "Text columns cannot be targets."
        - `INELIGIBLE_DATETIME`: "Date and time columns cannot be targets." It applies to `date`, `time` and `datetime` columns.
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
- Clicking "Set as Target" for a different column opens a plain-text native `dialog.confirm-dialog` with Cancel first. The protected target change discards existing models and results after explicit confirmation. The dialog stays usable when another tab is training. A committed change awaiting publication keeps the dialog open with Retry saving and disables duplicate deletion.
- Dismissing the modal (via Cancel or Escape) retains all existing models and restores focus to the invoking button.
- If the dataset is changed while the modal is open, the modal closes safely without applying pending mutations.
- Clicking the button for the column that is already the current target is a no-op that never displays confirmation or alters models.

### Continuation

- After the target change is acknowledged, the user stays on `/target` to inspect the table.
- A "Train Models" link (`<a href="/models" class="btn btn-primary">`) in the page header enables proceeding to Step 3 once a target is selected.

## 3. Train Models

**URLs** — `/models` for the overview, `/models/new` for a provisional wizard, and `/models/{num}` for a saved result or a historical draft.

Learners can train multiple models to predict the target variable. A new model has five wizard steps followed by an explicit handoff to its numbered results page.

If the learner visits `/models` or `/models/new` before selecting a dataset or target, a notification links to the missing prerequisite. A blocked visit creates no draft.

Once a dataset and target are configured:

- If no models exist, `/models` displays the empty notice _"No models yet. Train a new model to get started."_ (`data-testid="models-empty"`).
- The overview's **Train New Model** and the sidebar's **Train New Model** (no trained models) or **Train Another Model** link to `/models/new`. An explicit visit opens or resumes the single provisional model for the current dataset and target. The route shows a labelled loading state until a protected save binds that visit to a model. A failed or pending save offers recovery. Model numbers increase and are not reused when a draft is abandoned.
- If models exist, `/models` renders a table (`data-testid="models-list"`) with columns:
    - **Model Name:** Displays `Model {num} — {Library Name}` (e.g. "Model 1 — Logistic Regression") or `Model {num}` if no model is selected yet. Models cannot be renamed, deleted, or duplicated.
    - **Features:** A comma-separated list of selected features in dataset column order, or "Not selected".
    - **Configuration:** Hyperparameter settings or "Not configured".
    - **Training Setup:** The formatted strategy and split or fold count, or "Not configured".
    - **Duration:** Training duration formatted via i18n (e.g. "1.2s") or "Not trained".
    - **Action:** **View Results** opens the numbered result. **Continue** opens the current provisional draft at `/models/new` or a historical draft at its numbered URL.
- The header includes a "Compare Results" button (`<a href="/results">`). It is disabled with a visible hint until at least two models have completed training (`$canCompare`).

The sidebar groups acknowledged trained models under **All Trained Models**. Each result link has a numbered swatch, the saved label or catalogue name, a feature count and a trained check. The current wizard has a static **Training New Model…** row through Step 5 completion. A well-formed but missing model number stays on its URL and links back to Models.

Leaving an unfinished wizard through an app link or a reversible same-document Back/Forward action requires **Stay** or **Leave**. Leave removes only the matching unfinished provisional draft after any local attempt settles. If a save finishes first, the trained result stays available. Opening or closing Help over the wizard retains its identity, form edits and scroll. Reload and browser departures outside the app-owned history stack preserve the saved draft. See [Navigation Behaviour](app-state-and-navigation.md#5-navigation-behaviour).

The connected `app-model-builder-view` accepts `modelNum: number = 0` (`model-num`) and exposes `focusHeading(signal): Promise<void>` and `whenSettled(): Promise<void>`. It has no custom slots, events, parts or CSS properties. On `/models/new`, the shell supplies the acknowledged binding's model number. A numbered trained route has one focusable results h1. Only one wizard step has `aria-current="step"`. An acknowledged transition closes the old content with a measured block-size transition, making it inert and moving focus to a stable heading, then opens and focuses the next heading. Reduced motion settles and focuses without animation. See the `MW-ROUTE`, `MW-GUARD`, `MW-STEP`, `MW-PROGRESS` and `MW-HELP` criteria in the [workflow implementation record](plans/archive/model-training-workflow.md).

### 1. Choose Model

The catalogue adapter (`model-catalogue.ts`) exposes supervised algorithms from `web-ml` suitable for predicting the active target:

- Categorical or Boolean target. Eight classifiers are available in library index order.
- A numeric target reaches Section 1 and shows `No classification model available` with a link to `/target`. Text, date, time and datetime have empty catalogue lists. Target selection and saved-state hydration exclude all of them before the builder. Regression, clustering and PCA are excluded.
- A model whose `modelId` is no longer available is reset to Section 1 at startup.

The UI renders candidate models:

- Each classifier appears in a native list item containing an [illustrated model card](components/card.md). Bernoulli, Gaussian and Multinomial Naive Bayes use `bernoulli-naive-bayes.svg`, `gaussian-naive-bayes.svg` and `multinomial-naive-bayes.svg`. The other classifiers use `k-nearest-neighbours-classifier.svg`, `logistic-regression.svg`, `mlp-classifier.svg`, `support-vector-classifier.svg` and `decision-tree-classifier.svg`. All eight use `/assets/` URLs and the per-card geometry from [03-2](mockups/03-2_train-models-1-choose-model.html).
- The card shows `Model Description` and `Select Model`. Their accessible names include the model name. The current model shows `Selected` beside its select button, and that button exposes `aria-current="true"`.
- **Select Model** saves the chosen model, initial eligible features and Step 1 completion together. After acknowledgement, the heading shows the model name and Step 2 opens. Choosing the current ID preserves setup data. An unavailable save keeps the current step and offers **Retry saving** when publication is pending.
- The "Model Description" button opens an `<app-model-description-dialog>` presenting authored Markdown content or falling back to library JSON metadata if unauthored.
- Once completed, the section header displays an "Edit" button (`reopen-btn`). Reopening with downstream completions prompts a plain-text `dialog.confirm-dialog` with Cancel first. Confirming clears downstream completions while preserving selections.

### 2. Select Features

Displays a tabular selection of all dataset columns in canonical dataset order:

- **Target column:** Rendered with a "Target" chiclet badge and no checkbox cell. The target variable is never selectable as a feature.
- **Ineligible columns:** Columns of type `text`, `date`, `time`, `datetime`, all-missing, or constant are disabled with visible note badges explaining why they cannot be included.
- **Advisory columns:** Identifier columns and target candidate leaky columns default unticked with an advisory note, but the user may deliberately override and check them.
- **Selection rules:** At least one feature must be selected to proceed. Initial features default to all eligible columns once on completing Section 1; intentional empty or subset selections persist across page reload.
- **Continue** saves the eligible feature selection and Step 2 completion together before opening Step 3. The completed heading gives the localised feature count.
- **What are features?** links from the heading to `/help/select-features`, which explains features, target columns and leakage using Iris.
- Once completed, an "Edit" button allows reopening Section 2. If a later section is complete, it uses the same Reopen Section confirmation.

### 3. Configure Model

Section 3 activates after Section 2 and renders `<app-model-configuration>` ([spec](components/model-configuration.md)), a manual form generated from the selected classifier's catalogue document:

- **Fields:** every non-hidden option as a select, checkbox, range with exact number, number with Reset, compound mode select (`maxDepth`, `gamma`, `binarize`, `classWeight`) or layer editor (`hiddenLayerSizes`). Ranges show the recommended slider span; the number accepts any value in the valid domain.
- **Mode:** Manual is selected; Random Search (advanced) is disabled until tuning is specified.
- **Dependencies:** fields whose dependency is unmet are hidden with a dependency note; solver/penalty combinations follow the policy rule.
- **Multiclass:** when the target has more than two classes, a read-only note states the strategy used (no choice is offered).
- **Help:** the section heading links to `/help/configure-model` ("What do these settings mean?") for definitions and setting guidance. Each field shows a plain-text hint associated with its control.
- **Completion:** `Save & Continue` saves sparse overrides with Step 3 completion. On acknowledgement it shows `3. Model Configured` with `Edit` and opens Training Setup. A validation failure focuses the first invalid control, and storage recovery retains the eligible edits and current step.
- **Edit:** confirmation is requested when a later section, including Training Setup, is complete.

### 4. Training Setup

Choosing a strategy requires ready metadata for the current dataset and target. For classification, samatā requires at least two observed classes with two or more rows each. Categories with no observed rows are excluded from this check. This is an input rule in samatā. The training library web-ml determines whether it can execute the requested partition. If the target is ineligible or missing, the section explains why and links to Set Target. If metadata cannot be read, the section offers Retry.

**One-Shot** is selected initially. It requests an 80% training and 20% test split with stratification and a fixed seed of 42. **Cross-Validation** starts at five folds or the eligible maximum, whichever is smaller. The range and exact number field accept integers from 2 through the smallest observed class count, capped at 10. A scrollable matrix shows the training and validation roles for each run and the summary gives their approximate percentages. The strategy select describes the current choice beside the control and keeps the requested split note visible for One-Shot. Both Help links open the Training Setup article over the builder.

**Train Model** is the form's submit button. A field error leaves it enabled and submission moves focus to the exact number field. The controls are disabled when the setup is blocked or read-only. Valid submission requests one training attempt. The builder advances to Step 5 only after the matching start is durably acknowledged and shows the chosen strategy in the completed Step 4 heading. A rejected start leaves Step 4 open with a reason. The **Training Setup** column on Models uses the same formatted summary. See [Training Setup](components/training-setup.md) for the controls and validation states.

For targets with more than two categories, the multiclass strategy is fixed by the model (native, One-vs-Rest or One-vs-One as the classifier supports) and shown read-only in Section 3. Selecting a strategy and Error-Correcting Output Codes remain future work.

### 5. Training

Training runs in a dedicated worker while the app remains navigable. One-Shot evaluates an independent stratified holdout. Fixed Cross-Validation evaluates the chosen folds and refits the classifier on all eligible rows. See [Machine Learning Orchestrator](machine-learning-orchestrator.md) for the worker and storage contract.

The [training panel](components/training-progress.md) displays a labelled native progress bar, the latest status and a chronological log in a native disclosure. The saved disclosure preference survives reload. The bar has no value until the run reports a percentage. Measured progress stays visible during saving, and the owning tab can cancel before saving. Other tabs show their remote training state. Committed work awaiting publication offers **Retry saving** with unavailable actions disabled.

After a matching local cancellation or fitting failure, **Training Stopped** shows the acknowledged reason and the run's last measured percentage in red, when available. **Train Model** starts a new attempt with the saved setup. **Edit Training Setup** returns to the editable form. Help preserves the stopped state. A fresh reload without that in-memory attempt returns to the saved setup with any recovery reason.

Acknowledged completion shows 100%, elapsed time and **View Results** at the same `/models/new` visit. The saved log remains inspectable. **View Results** revalidates that visit's pinned first run, acknowledges the result and replaces the visit with `/models/{num}` without adding a Back stop. A trained numbered deep link opens the result directly.

Detailed timing tables for nested evaluation and tuning belong to the later results and tuning phases. The [03-6 draft](mockups/03-6_train-models-5-train.html) awaits human styling.

### 6. Single Model Results

The numbered page begins with a large numbered swatch and **{saved label or catalogue name} Results**. **Training Details** gives the model, saved target, selected feature names and count, evaluation strategy and saved training and held-out row counts. One-Shot uses the single partition. Cross-Validation shows the training count for each fold and the pooled held-out count. The training folds overlap. An omitted historical count is shown as unavailable.

The shared results apply to every classifier. Predictive scores use the held-out test split or Cross-Validation folds from the saved reports. The headline averages fold balanced accuracies. The diagnostic uses the training and held-out balanced accuracies from the same partition or fold. See [Model Results](components/model-results.md) for the elements and their stories.

The blocks appear in this order, each with its own heading:

1. **Scores on held-out rows.** A run line (model, dataset, target, protocol, held-out rows scored) and the headline. **Balanced accuracy** is first because it treats every class equally; for Cross-Validation it is the mean of the fold scores with their standard deviation and interquartile range, and for One-Shot it is one value with the sentence that no spread is available. **Accuracy** follows with the most-frequent-class baseline and the signed difference in percentage points. Macro-F1 is in the headline for multiclass targets and in **More metrics** for binary targets. More metrics also lists MCC, ROC-AUC, average precision, log loss, Brier score and expected calibration error, each with its reason when unavailable. Fit time, or the total fit and scoring time across folds, closes the block. When the mean paired training minus held-out balanced accuracy reaches ten percentage points, a diagnostic card names both scores and the gap; the "compare with a default or tuned range" action waits for tuning.
   The native **What do these results terms mean?** disclosure follows the summary and explains terms for the current protocol and target.
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

The sections appear in order: a sortable table of held-out metrics and fixed baseline rows, followed by **What do these results terms mean?**; balanced-accuracy dots for matching partitions with paired connecting lines; per-class error rates; an ordered A/B pair and signed confusion differences; practical-equivalence probabilities; and instance agreement. The table includes pooled held-out balanced accuracy, macro-F1, MCC, accuracy, available ROC-AUC, average precision, log loss, Brier and calibration error, train–test gap, spread, error counts and protocol-appropriate time. Binary groups also show false positives and negatives. Missing measures have an explanation; inconsistent baseline reports suppress the affected baseline. Higher and lower being better are labelled where applicable. Sorting does not imply a winner. The comparison disclosure defines pooling, the paired train–test gap and practical equivalence. It is available when a group has a populated comparison.

For two cross-validation models, the analysis worker asks `web-ml` for a Bayesian correlated t-test on matching held-out balanced-accuracy folds. The width defaults to 0.01 and accepts 0.001–0.1 in 0.001 steps. The three labelled probabilities show A higher, practically equivalent and B higher; the caption names both models, width and fold count. One-Shot or fewer than two folds explains why the analysis is unavailable. Swapping the pair reverses the confusion difference and requests the new ordered posterior. More than twenty classes offers a true-class filter. Charts provide captions and data tables; no automatic winner is selected. Group, selection, sort, pair, width and filter survive reload. The [04 draft](mockups/04_compare-results.html) awaits human styling.
