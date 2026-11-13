# Step 2: Set Target

**Status:** stub | **Updated:** 2026-11-12T15:03:46Z

## Summary

User-facing implementation of Step 2 (`/target`) as specified in [workflow-steps.md §2](../workflow-steps.md). This view allows users to review the columns of their ingested dataset and select which variable the models should predict.

## Scope & Key Requirements

- **Precondition & Empty-State Handling:**
    - If no dataset is loaded when navigating to `/target`, render a blocking notification alert instructing the user to load a dataset first.
- **Target Selection Table (`02-1_set-target.html`):**
    - Render a clean tabular overview of every column in the loaded dataset:
        - **Dataset Column Name**
        - **Column Type** (formatted with chiclet badges: `numeric`, `categorical`, `boolean`, `text`)
        - **Notes** (e.g. flagging text, high-cardinality, or constant columns that are ineligible as prediction targets)
        - **Action** ("Set as Target" primary button)
- **Target Selected State (`02-2_target-set.html`):**
    - Visually distinguish the currently active target column.
    - Reactively update `$appState.target`.
    - Reflect target selection in `<app-sidebar>` under Step 2 with the selected column name and type dot indicator.
- **Model Invalidation & Confirmation Guard:**
    - If models have already been trained when visiting `/target`, display the alert notification: "Changing the target variable after you train a model will reset your trained models."
    - When clicking "Set as Target" while models exist, trigger a confirmation dialog invoking `confirmDiscardModels()` in accordance with `NAV-AC-6` in `src/stores/persister.ts`.

## References & Required Reading for Full Draft

- `specification/workflow-steps.md §2`
- `specification/mockups/ui-scaffold/02-1_set-target.html`
- `specification/mockups/ui-scaffold/02-2_target-set.html`
- `specification/mockups/ui-scaffold/03-1_train-models-disabled.html`
- `src/stores/predicates.ts` (`canNavigateToRoute`, `isStepBlocked`, `confirmDiscardModels`)
- `specification/TODO.md` (TODO-11, TODO-16, TODO-17)
