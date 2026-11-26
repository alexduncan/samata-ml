# User Interface Principles

Status: Normative UI Specification
Scope: Model configuration, hyperparameter selection, hyperparameter tuning, categorical encoding, and regularisation guidance in the browser-based classification workflow.
Audience: Coding agents and human contributors modifying UI components, state machines, validation logic, or user-facing copy.

---

## Core Design Rule

Separate **validity and browser-safety boundaries** from **pedagogical modelling choices**:

- **Before training:** Block mathematically invalid inputs and cap settings that threaten browser memory or Web Worker responsiveness. Warn without blocking only when a hidden pipeline mismatch (such as unscaled features) would silently distort numerical optimisation or distance calculations.
- **After training:** Allow suboptimal but valid hyperparameter choices so learners can observe underfitting, overfitting, and instability directly, then explain the outcome on the results screen with actionable comparison links.

---

## Agent Implementation Rules

### General Principles

- Prefer plain text labels for buttons and links instead of icons.
- Only use icons when:
  1. The meaning of the icon is implicit and indisputable e.g. cross to close a modal.
  2. The result of clicking the link is ephemeral e.g. closing a modal, opening settings.
  3. The icon is supported by a `aria-label` or `aria-labelledBy` explaining in plain text the purpose of the element.
-

### UI-HP-01: Sensible Defaults and Explicit Reset

- Every hyperparameter **MUST** initialise to a valid default so users can train a baseline model immediately without configuring settings.
- Use **dataset-aware defaults** where data dimensions affect behaviour (for example, `gamma = "scale"` defined as `1 / (p * Var(X))`, or capping default `k` below the inner Cross-Validation (CV) training fold size).
- Whenever a user modifies a control away from its default, display a clear **Modified** indicator alongside a single-click **Reset to default** control.

### UI-HP-02: Two-Tier Progressive Explanations

- **MUST NOT** render multi-sentence technical explanations inline beside every form control by default.
- **Tier 1 (Always visible):** Render one short, plain-language helper line stating the default value and directional effect (for example, `Default: 1.0. Smaller values smooth the decision boundary; larger values fit training rows more closely.`).
- **Tier 2 (On-demand disclosure):** Provide a keyboard-accessible info popover or expandable details row explaining how the parameter trades off underfitting against overfitting, and badge whether tuning it typically has **High impact** or **Low impact** on predictive performance.

### UI-HP-03: Three-Tier Numeric Limits and No Silent Clamping

- Enforce three distinct boundary tiers on numeric hyperparameters:
  1. **Domain and split bounds (Hard block):** Reject mathematically invalid inputs (`C <= 0`, smoothing `alpha < 0`, non-integer `k`) and data-split violations (`k > innerTrainSize`, computed from the smallest inner-CV training fold). Mark invalid inputs with `aria-invalid="true"` and link inline error copy via `aria-errormessage`.
  2. **Browser compute caps (Hard ceiling):** Enforce explicit upper limits on resource-heavy parameters (`max_iter`, tree `max_depth`, Multi-Layer Perceptron (MLP) layer sizes) to prevent Web Worker hangs or tab crashes. State clearly in helper text that the ceiling protects browser responsiveness.
  3. **Extreme valid values (Allow):** Permit pedagogically extreme values within valid bounds (such as `k = 1`, `k = innerTrainSize`, or `C = 100000`). Pair a slider bounded to the **recommended range** with an adjacent numeric `spinbutton` (`<input type="number">`) supporting the wider **valid range** up to the browser ceiling.
- **MUST NOT** silently clamp, round, or overwrite a valid user-entered number on blur.

### UI-HP-04: Pre-Training Warnings vs. Post-Training Diagnostics

- **Pre-training (Non-blocking advisory banner):** Show pre-training warnings **only** for:
  - Silent numerical distortions (such as unscaled numeric features passed to K-Nearest Neighbors (KNN), Support Vector Classifier (SVC), MLP, or regularised Logistic Regression).
  - Heavy compute budgets (when nested-CV candidate counts exceed a fast interactive runtime threshold).
- **MUST NOT** block training or display modal confirmation dialogs for suboptimal hyperparameter values.
- **Post-training (Results diagnostic card):** When results exhibit a large train-versus-validation gap, majority-class collapse, or solver non-convergence, surface a plain-language diagnostic on the evaluation view linking the symptom to the responsible hyperparameter and offering a one-click **Compare with default** action.

### UI-HP-05: Enum Hyperparameter Tuning

- Provide an explicit mode switch per tunable parameter: **Fixed** (single value) vs. **Tune** (search across candidates).
- In **Fixed** mode, render a radio group (for 2–4 options) or `<select>` control.
- In **Tune** mode, render **checkboxes** (or accessible multi-select toggle chips) inside a `<fieldset>` so all permitted enum options remain visible simultaneously.
- Require at least **two** checked options when **Tune** mode is active. If an option is incompatible with another active setting, disable that checkbox inline with an accessible explanation rather than removing it silently.

### UI-HP-06: Numeric Hyperparameter Tuning

- **MUST NOT** rely on a dual-thumb range slider alone for numeric tuning bounds.
- In **Tune** mode, provide editable **Min** and **Max** numeric inputs (optionally synchronised with a dual-thumb slider) plus an explicit **Steps** count (default `4` or `5`, capped at `10`).
- Default scale spacing by parameter semantics:
  - **Logarithmic spacing** for multiplicative parameters spanning orders of magnitude (`C`, `gamma`, `alpha`, `learning_rate`).
  - **Linear integer spacing** for structural count parameters (`k`, `max_depth`, `min_samples_split`).
- Render the **exact generated candidate values** as read-only preview chips beneath the control (for example, `0.01, 0.1, 1, 10, 100`) and display a live total model-fit counter (`outerFolds * innerFolds * candidateCount`).
- When a user enables **Tune** on more than three hyperparameters simultaneously, recommend or switch to **Random Search** with an explicit trial budget `B` sampled across each `[Min, Max]` interval.

### UI-HP-07: Explicit Categorical Encoding and Numeric-Category Safeguards

- **MUST NOT** apply One-Hot Encoding silently. Any expansion of 1 feature into `K` binary indicator columns must appear explicitly in the pipeline summary and execute strictly inside each CV training fold to prevent data leakage.
- **Column semantics check (Dataset / Feature stage):** Detect numeric integer columns with low distinct cardinality (such as `1, 2, 3`) on uploaded datasets, or read column types from Dataset Card metadata on curated datasets. Prompt the user to confirm whether the column is **Nominal (unordered)**, **Ordinal (ordered)**, or **Continuous / Count**, stating clearly that linear and distance models treat raw integers as ordered distances (`3 > 2 > 1`).
- **Model-aware encoding rules (Pipeline stage):**
  - **Models requiring numeric indicators** (KNN, Logistic Regression, SVC, MLP on unordered categories): Pre-select **One-Hot Encoding** visibly as a model requirement, and warn when high category cardinality risks sparse overfitting or slow browser training.
  - **Models supporting native category partitions** (Decision Trees with categorical subset splits): Expose encoding as an explicit user choice (**Native Categorical Splits [Recommended]**, **One-Hot Encoding**, **Ordinal Encoding**).

### UI-HP-08: Dependent and Conditional Hyperparameters

- **Activation dependencies** (child parameter is unused unless parent has specific value, such as `degree` requiring `kernel === "poly"` or `l1_ratio` requiring `penalty === "elasticnet"`):
  - Nest child controls inside the parent `<fieldset>` and collapse or hide inactive child controls so users cannot configure or tune ignored parameters.
- **Constraint couplings** (parent restricts valid options or bounds of a partner parameter, such as `penalty` restricting `solver`, or `min_samples_split` bounding `min_samples_leaf`):
  - Automatically update an incompatible partner value **only** when accompanied by a visible, non-intrusive `aria-live="polite"` inline status message stating what changed and why (for example, `Solver updated from lbfgs to saga to support L1 regularisation.`).
- **State preservation:** Cache prior child and partner values in component state so reverting the parent control restores the user's previous selection.

### UI-HP-09: Stopping Tolerance and Optimiser Controls

- Place numerical solver parameters (`tol`, `max_iter`) inside a collapsed **Advanced / Optimiser** disclosure section separate from primary model-complexity hyperparameters.
- Explain `tol` in plain language as a **precision-versus-speed stopping rule**: `Stops iterative training once loss improvements fall below this threshold, or when Max Iterations is reached first.`
- Provide log-spaced presets (**Coarse / Faster `1e-2`**, **Standard `1e-4` [Default]**, **Strict / Slower `1e-5`**) alongside custom numeric entry, and cross-link solver non-convergence notices to `tol`, `max_iter`, and feature scaling.

### UI-HP-10: Model Regularisation vs. Column Scaling

- **Strict terminology separation:** Never refer to column scaling as "regularising a column". Keep **Standardisation / Min-Max Scaling** scoped to feature preprocessing and **Regularisation** (`L1`, `L2`, `Elastic Net`, `C`, `alpha`, `ccp_alpha`) scoped to model configuration.
- **Scaling prerequisite:** Whenever a regularised classifier is active and selected numeric features have differing units or variances, recommend or default to **Z-score Standardisation** (fitted per inner/outer training fold) and explain that unscaled units cause penalties to shrink features unevenly.
- **Reactive feature-to-model guidance:** Keep column selection in the Dataset/Features view, and reactively update a non-blocking regularisation guidance banner in Model Configuration whenever the selected feature set changes (including when users add or remove columns after picking a model):
  1. **Sample-to-parameter pressure:** Recommend regularisation when expanded parameter count `p_effective` (after One-Hot Encoding) is large relative to inner-fold sample size and minority-class count; require regularisation when `p_effective >= innerTrainSize`.
  2. **Multicollinearity:** Recommend `L2` or `Elastic Net` when selected columns have pairwise correlation `|r| > 0.8` or Variance Inflation Factor (`VIF > 5`).
  3. **Sparse expansion:** Recommend `L1` or `Elastic Net` when nominal columns expand into high-dimensional sparse indicator columns.

---

## Agent Pre-Merge Verification Checklist

Before marking any UI or pipeline change complete, verify:

1. **Accessibility:** Every `slider` and `spinbutton` exposes an accessible label (`<label>` or `aria-labelledby`), `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, and `aria-errormessage` when invalid; conditional updates announce politely via `aria-live="polite"`.
2. **No silent mutation:** Entering an extreme but mathematically and computationally valid number is preserved without silent clamping; reverting a parent enum restores cached child values.
3. **Fold-safe preprocessing:** Any encoding or scaling triggered by UI rules fits strictly on training partitions inside nested CV folds.
4. **Terminology consistency:** UI labels, tooltips, and TSDoc comments consistently distinguish **feature scaling** (column preprocessing) from **regularisation** (model weight penalty).
