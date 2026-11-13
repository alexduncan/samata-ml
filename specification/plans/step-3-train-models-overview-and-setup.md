# Step 3: Train Models Overview & Setup

**Status:** stub | **Updated:** 2026-11-12T15:03:46Z

## Summary

User-facing implementation of the initial portions of Step 3 (`/models` and `/models/{num}`) as specified in [workflow-steps.md §3, §3.1, §3.2](../workflow-steps.md). This covers the models overview table on `/models` and the first two sections of the model builder wizard on `/models/{num}`: Step 1 ("Choose Model") and Step 2 ("Select Features").

## Scope & Key Requirements

- **Precondition & Disabled Guard:**
    - If visited before both a dataset is loaded and a target variable is selected, display a blocking alert notification: "You must set both the dataset and the target variable before training a model." ([03-1_train-models-disabled.html](../mockups/ui-scaffold/03-1_train-models-disabled.html)).
- **Models Overview Table (`/models`):**
    - Table showing existing configured/trained models:
        - **Model Name**
        - **Features** (summary of selected feature count and names)
        - **Configuration** (hyperparameter summary)
        - **Training Setup** (validation strategy)
        - **Duration** (training time)
        - **Action** ("View Results" for trained models, or "Continue" for in-progress models)
    - "Train New Model" button allocating the next sequential model number and navigating to `/models/{num}`.
    - "Compare Results" button in the page header (disabled until more than 1 model has been trained).
- **6-Step Model Stepper Container (`/models/{num}`):**
    - Sequential section list (`<ol class="train-model">`) rendered down the page.
    - Section headers with status checkmarks (`<use href="#check" />`), dynamic labels, and completed styling (`.train-step-complete`).
- **Section 1: Choose Model (`03-2_train-models-1-choose-model.html`):**
    - Implement Tier 2 `<app-model-card>` custom elements adhering to [specification/components/card.md](../components/card.md).
    - Filter offered models from `web-ml` based on the target variable type:
        - Classifiers for boolean or categorical targets.
        - Regressors for numeric targets.
    - Embed vector SVG illustration in the `image` slot.
    - "Model Description" modal dialog providing in-depth model documentation.
    - "Select Model" button setting `modelId` and enabling "Continue".
- **Section 2: Select Features (`03-3_train-models-2-select-features.html`):**
    - Checkbox list for all available dataset columns.
    - Target variable column is displayed but disabled (checked off/unselectable) to prevent target leakage.
    - Model-specific preprocessing controls (e.g. one-hot encoding for categorical variables).
    - "Continue" button saving `features` to `$appState.models` and marking Section 2 complete.
- **Scaffold Placeholders for Sections 3–6:**
    - Sections 3 (Configure Model), 4 (Configure Training), 5 (Training), and 6 (Results) are mounted with placeholder UI indicating pending specification for TODO-01 through TODO-05.

## References & Required Reading for Full Draft

- `specification/workflow-steps.md §3, §3.1, §3.2`
- `specification/mockups/ui-scaffold/03-1_train-models-disabled.html`
- `specification/mockups/ui-scaffold/03-2_train-models-1-choose-model.html`
- `specification/mockups/ui-scaffold/03-3_train-models-2-select-features.html`
- `specification/components/card.md`
- `specification/TODO.md` (TODO-01, TODO-02, TODO-04, TODO-05, TODO-06, TODO-07, TODO-08)
