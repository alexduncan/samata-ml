# Steps

**Status:** target — wins over every other spec on user-facing behaviour

This web application has four sections.

When the script loads it will check localStorage for saved app state.

If no saved state is found in localStorage, the user will be shown a welcome modal as shown in [00_first-load.html](mockups/ui-scaffold/00_first-load.html).


## 1. Load Data

**url:** `/data`

This is the first page the user sees when the app loads.

### Sample Datasets

The page shows cards for each dataset in `./src/config/datasets.ts`. Each card contains the `title`, `description`, `num_records`, `num_columns` and buttons for "Datasheet" and "Load Dataset". This is shown in [01-1_select-data.html](mockups/ui-scaffold/01-1_select-data.html).

Clicking the "Datasheet" button on a model card will display a modal containing detailed information about the sample dataset as shown in [01-2_dataset-card.html](mockups/ui-scaffold/01-2_dataset-card.html).


### Custom Dataset Upload

The `.page-header` contains a button "Upload Dataset". Clicking the button displays a modal as shown in [01-3_upload-dataset.html](mockups/ui-scaffold/01-3_upload-dataset.html).

When the following events fire, the app will attempt to load and parse the CSV file using `Papa.parse`.


### Preview Dataset

Dataset preview displays after successful loading of a dataset by:
1. Clicking the "Load Dataset" button on a Sample Dataset card.
2. Successful parsing of a custom uploaded dataset.

The dataset preview shows a virtual table which loads rows from IndexedDB using the storage worker. Clicking on a column displays an `<aside>` on the right containing further details about the column:
- Column Name
- Column Type
- Count of empty records
- If numeric:
	- min
	- median
	- mean
	- max
	- histogram of values
- If categorical:
	- Value and frequency of each category

#### Future Development
- Add the ability to modify the values in a column including:
	- Convert numeric columns to `boolean` or `categorical` using rules.
	- Delete records based on specific column values.
- Ability to delete a column.


## 2. Set Target

**url:** `/target`

The user sees a table with a row for each column in the dataset as shown in [02-1_set-target.html](mockups/ui-scaffold/02-1_set-target.html). The table has columns for:
	- Dataset Column Name
	- Column Type (numeric|categorical|boolean)
	- Notes (e.g. if the column is text and cannot currently be used as a target or feature)
	- If able to be selected a "Set as Target" button to let the user select the specific column as the target variable.

If no dataset has been loaded a warning bar displays telling the user they need to load a dataset before they can set the target.


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
