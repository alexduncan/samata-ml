# Classification Metrics and Visualisations Framework

This report extracts and organises the metrics and visualisations required for a machine learning educational web application, based on the provided research framework. All math is formatted using standard LaTeX notation.

---

## 1. Metrics and Visuals Applicable to Individual Models

Every model evaluation in the application should consist of a **Shared Base** (metrics and charts applicable to all algorithms) plus **Model-Specific** internals. 

### Shared Base (Applies to all 8 Models)

**Shared Metrics:**
*   **Balanced Accuracy:** (Essential) - Primary headline metric. Applicable to both binary and multi-class.
*   **Raw Accuracy + Zero-Rule Baseline Delta ($\Delta_{base}$):** (Essential) - Must be shown together to expose the accuracy paradox. Binary and multi-class.
*   **Per-Class Recall ($Rec_c$) & Precision ($Prec_c$):** (Essential) - Separates error directionality. Binary and multi-class.
*   **Macro-F1 Score:** (Essential) - Penalises extreme imbalance. Primary for multi-class; optional for binary.
*   **Outer-Fold Spread ($SD$ & $IQR$):** (Essential) - Quantifies sampling uncertainty across $K_{out}$ folds.
*   **Matthews Correlation Coefficient ($MCC$ / $nMCC$):** (Optional) - Tier 2 complete contingency-matrix correlation.
*   **ROC-AUC & PR-AUC:** (Optional) - Threshold-free ranking. Binary (standard) or Multi-class (One-vs-Rest macro-averaged).
*   **Brier Score, Log-Loss & Calibration Loss:** (Optional) - Evaluates probability honesty.
*   **Normalized Expected Cost ($NEC$) & Subgroup Fairness Gap ($\Delta_{EO}$):** (Optional) - Cost and fairness auditing.
*   **Inner-CV Tuning Stability & Fit/Predict Time:** (Optional) - Hardware and tuning variance context.

**Shared Visuals:**
*   **Contextualised Confusion Flowchart:** (Essential) - Binary classification only. Uses dataset nouns instead of $TP/FP/TN/FN$.
*   **Classee / Squares Strips:** (Essential) - Multi-class classification ($C \ge 3$). Parallel instance-linked strips.
*   **Outer-Fold Generalisation Dot-and-Interval Strip:** (Essential) - Shows $K_{out}$ fold scores as dots alongside Mean $\pm$ $SD$ and baseline anchors.
*   **Interactive Probability-Threshold Histogram:** (Optional) - Binary / Tier 2 OvR. Draggable threshold line $\tau \in (0,1)$.
*   **Reliability Diagram (Calibration Curve):** (Optional) - Paired with sharpness histogram.
*   **Inner-CV Hyperparameter Selection Matrix:** (Optional) - $K_{out} \times |\Theta|$ visual strip.
*   **Subgroup Disaggregated Error Bar Chart:** (Optional) - Side-by-side error bars for fairness.

---

### Model-Specific Internals

#### 1. Bernoulli Naive Bayes
*   **Metrics:**
    *   Class Priors $\hat{\pi}_c$ & Smoothed Conditional Presence Rates $\hat{p}_{jc}$ (Essential)
    *   Presence vs. Absence Weight of Evidence ($WoE$) (Essential)
    *   Inner-CV Selected Smoothing $\alpha$ & Binarization Threshold $\tau_j$ (Essential)
    *   Collinearity Redundancy Diagnostic (Optional)
*   **Visuals:**
    *   Presence-vs.-Absence Conditional Probability Butterfly Chart (Essential)
    *   Bayesian Log-Odds Nomogram / Additive Evidence Waterfall (Essential)
    *   Binarization Cutpoint Overlay & U-Shaped Confidence Histogram (Optional)

#### 2. Gaussian Naive Bayes
*   **Metrics:**
    *   Per-Class Feature Means $\hat{\mu}_{jc}$ & Standard Deviations $\hat{\sigma}_{jc}$ (Essential)
    *   Univariate Fisher Separability Ratio $S_j$ (Essential)
    *   Gaussian Fit (Skewness) & Independence Violation Diagnostics (Optional)
*   **Visuals:**
    *   Fitted Gaussian Curves Overlaid on Empirical Class Histograms (Essential)
    *   Instance Density-Lookup & Additive Log-Likelihood Waterfall (Essential)
    *   2D Axis-Aligned Elliptical Iso-Density Contour Plot (Optional)

#### 3. Multinomial Naive Bayes
*   **Metrics:**
    *   Class Priors $\hat{\pi}_c$ & Smoothed Simplex Feature Shares $\hat{\theta}_{jc}$ (Essential)
    *   Unit Log-Odds Weight $w_j$ vs. Instance Count-Multiplied Contribution $x_{ij} w_j$ (Essential)
    *   Inner-CV Selected Smoothing $\alpha$ & Zero-Cell Rescue Count (Optional)
*   **Visuals:**
    *   Ranked Diverging Feature Log-Odds Bar Chart (Essential)
    *   Count-Multiplied Instance Evidence Waterfall (Essential)
    *   Class-Proportional Simplex Profile & $\alpha$-Smoothing Shrinkage Explorer (Optional)

#### 4. K-Nearest Neighbors Classifier ($k$-NN)
*   **Metrics:**
    *   Inner-CV Selected Neighbor Count $k$, Distance Metric, & Weighting Mode (Essential)
    *   Local Vote Consensus & Mean Query-to-Neighbor Distance (Essential)
    *   Training vs. Prediction Latency Ratio & Distance Concentration Ratio (Optional)
*   **Visuals:**
    *   Interactive Local $k$-Neighborhood Spoke Diagram + Neighbor Comparison Table (Essential)
    *   Inner-CV $k$-Sweep Validation Curve (Bias-Variance Trade-Off) (Essential)
    *   2D Voronoi / Local Decision Map + Quantized $1/k$ Probability Histogram (Optional)

#### 5. Logistic Regression
*   **Metrics:**
    *   Standardized Coefficients $\hat{\beta}_j$ & Odds Ratios $OR_j = \exp(\hat{\beta}_j)$ (Essential)
    *   Inner-CV Selected Regularization $C$, Penalty Type ($L_1$/$L_2$), & Active Feature Count (Essential)
    *   Log-Loss, Brier Score, & Collinearity Variance Inflation Flag ($VIF$) (Optional)
*   **Visuals:**
    *   Standardized Coefficient / Odds-Ratio Forest Plot with Outer-Fold Whiskers (Essential)
    *   1D Linear Score $z$ to Sigmoid Probability S-Curve (Essential)
    *   Linear Log-Odds Instance Waterfall + Regularization Shrinkage Path Across $C$ (Optional)

#### 6. Multi-Layer Perceptron Classifier (MLP)
*   **Metrics:**
    *   Final Train vs. Val Loss Gap, Best Epoch, & Convergence Status (Essential)
    *   Architecture Capacity & Parameter-to-Sample Ratio $P_{params} / N_{train}$ (Essential)
    *   Out-of-Fold Permutation Feature Importance & Expected Calibration Error ($ECE$) (Optional)
*   **Visuals:**
    *   Epoch-Wise Training vs. Validation Loss Learning Curves (Essential)
    *   Global Permutation Importance + Local Signed Attribution Bar Chart (SHAP/LIME) (Essential)
    *   1D Partial Dependence (PDP/ICE) Curves & 2D Nonlinear Decision Map (Optional)

#### 7. Support Vector Classifier (SVC)
*   **Metrics:**
    *   Support Vector Count $N_{SV}$ & Support Vector Fraction $N_{SV} / N_{train}$ (Essential)
    *   Inner-CV Selected Kernel, Penalty $C$, & Kernel Width $\gamma$ (Essential)
    *   Geometric Margin Width $2/\|\mathbf{w}\|$, Margin Band Fraction, & Platt Calibration Status (Optional)
*   **Visuals:**
    *   2D Hyperplane, Margin Gutter ($f(\mathbf{x}) = \pm 1$), & Haloed Support-Vector Map (Essential)
    *   Signed Distance-to-Hyperplane Histogram ($f(\mathbf{x})$ Margin Distribution) (Essential)
    *   Inner-CV $(C, \gamma)$ Validation Heatmap + Permutation/SHAP Attribution (Optional)

#### 8. Decision Tree Classifier
*   **Metrics:**
    *   Tree Depth, Total Node Count, Leaf Count, & Mean Decision-Path Length (Essential)
    *   Train vs. Outer-Test Generalisation Gap & Inner-CV Selected Pruning (Essential)
    *   Root-Split Stability Across Outer Folds & Mean Decrease Impurity (MDI) (Optional)
*   **Visuals:**
    *   Proportional-Stream Decision Tree with Interactive Row Tracing (BaobabView) (Essential)
    *   Tree Depth / Complexity Pruning Curve (Train vs. Inner-CV Val) (Essential)
    *   2D Orthogonal Axis-Aligned Box Partition Plot + MDI vs. Permutation Chart (Optional)

---

## 2. Comparison Metrics and Visuals (View 2)

This view pits 2 to 8 algorithms against each other. It must eschew a simple "accuracy leaderboard" in favour of revealing tradeoffs.

**Comparative Metrics:**
*   **Balanced Hard-Decision Discrimination:** (Essential) - Mean $\pm$ $SD$ of Balanced Accuracy, Macro-F1, and $MCC$. Must include Majority-Class / Stratified Dummy Baselines. (Binary & Multi-class)
*   **Class-Specific & Cost-Weighted Error Profile:** (Essential) - FP vs FN counts, and Normalized Expected Cost ($NEC$) via cost-ratio slider. (Binary & Multi-class)
*   **Generalisation Stability & Equivalence:** (Essential) - Outer-Fold $SD$ & $IQR$, Mean Train-Outer-Test Delta, and **Bayesian ROPE Posterior Probabilities** $P(A \succ B)$, $P(ROPE)$, $P(B \succ A)$.
*   **Threshold-Independent Ranking Quality:** (Optional) - ROC-AUC and PR-AUC. (Binary & Macro OvR for Multi-class)
*   **Probabilistic Calibration:** (Optional) - Brier Score, Log-Loss, and $ECE$.
*   **Operational Efficiency & Fairness:** (Optional) - Nested-CV Fit/Test Time, Subgroup Fairness Disparity ($\Delta_{EO}$).

**Comparative Visuals:**
*   **Paired Outer-Fold Raincloud / Dot-and-Interval Plot:** (Essential) - Shows $K_{out}$ fold dots per model with dummy baselines. Prevents deceptive bar charts.
*   **Multi-Metric Sortable Table-Lens Matrix:** (Essential) - Aligned horizontal micro-bars across multiple metrics to prevent single-score tunnel vision.
*   **Side-by-Side Per-Class Error Bars & Relative Confusion Matrix:** (Essential) - Coordinated `Classee` bars exposing class-specific complementarity ($\Delta CM = CM_A - CM_B$).
*   **Superimposed ROC & Precision-Recall Curves:** (Optional) - Overlaid mean curves with $\pm 1$ $SD$ fold bands.
*   **Multi-Model Reliability Diagram + Confidence Histograms:** (Optional) - Calibration curves plotted against the $y = x$ ideal.
*   **Instance Agreement & Hard-Case Overlap Chart:** (Optional) - Stacked bar showing how many models classified a row correctly.
*   **2D Multi-Objective Pareto Trade-Off Scatter Plot:** (Optional) - e.g., Balanced Accuracy vs. Subgroup Fairness or Interpretability.
*   **Bayesian Practical-Equivalence (ROPE) Bar:** (Optional) - 3-segment stacked probability bar replacing $p$-values.
*   **Synchronised Small-Multiples 2D Decision-Boundary Gallery:** (Optional) - Side-by-side grid of 2D feature slices for comparing geometric boundaries.

---

## 3. Unique Master List for Components and Configuration

To architect the React components and backend configuration, here is the deduplicated master list of required visual and metric components to build, categorised by their functional pedagogical role.

### A. Foundational Evaluation Components
1.  **Metric Calculation Engine:** Supports Mean $\pm$ $SD$, Median, $IQR$ aggregation across $K_{out}$ folds.
2.  **Bayesian ROPE Test Calculator:** Computes $P(A \succ B)$, $P(ROPE)$, $P(B \succ A)$ avoiding standard $t$-tests.
3.  **Confusion Flowchart Component:** Left-to-right proportional flow for binary tasks mapping true class to predicted outcome.
4.  **Classee / Squares Error Strips Component:** Diverging parallel stacked bars for multi-class ($C \ge 3$) true vs. false predictions.
5.  **Multi-Metric Table-Lens Matrix Component:** Sortable grid with inline micro-bars for comparing multi-objective performance.
6.  **Dot-and-Interval / Raincloud Plot Component:** For displaying outer-fold score variance with dashed baseline reference lines.

### B. Probability and Threshold Components
7.  **Interactive Threshold Histogram:** Class-coloured stacked histograms with a draggable threshold slider $\tau$.
8.  **ROC & PR Curve Superimposer:** Capable of rendering single curves, and multiple superimposed curves with shaded $\pm 1$ $SD$ confidence bands.
9.  **Reliability Diagram (Calibration Curve):** Line chart mapped against a $y = x$ diagonal with an aligned probability histogram below it.

### C. Feature Importance and Local Explainability Components
10. **Additive Instance Waterfall (ExplainD):** Reusable vertical or horizontal waterfall chart for breaking down local predictions (Prior + $\sum$ feature contributions).
11. **Diverging Forest Plot / Feature Log-Odds Bars:** For global linear/additive models, displaying signed magnitude with error whiskers.
12. **Presence/Absence Butterfly Chart:** Specific to Bernoulli models to show $P(Feature | Class)$ vs $P(No Feature | Class)$.
13. **Permutation / SHAP Importance Component:** For black-box models (MLP, nonlinear SVC, Deep Trees), visualising global absolute importance and local signed attribution.

### D. Optimisation and Tuning Components
14. **Bias-Variance / Complexity Curve Plot:** Line chart plotting Training Score vs Inner-CV Validation Score over a complexity parameter (e.g., $k$ in $k$-NN, Tree Depth).
15. **Epoch Learning Curve Plot:** Dual line chart for MLP Train vs Val Loss tracking.
16. **Hyperparameter Selection Matrix/Heatmap:** Visualising cross-fold tuning stability.

### E. Geometric and Topological Components
17. **2D Decision-Boundary Canvas:** Reusable coordinate space for rendering axis-aligned boxes (Trees), Voronoi regions ($k$-NN), orthogonal hyperplanes (SVC/LogReg), and nonlinear curves (MLP), with overlaid data points.
18. **Small-Multiples Fitted Gaussian Distributions:** Plotting density curves $N(\hat{\mu}, \hat{\sigma}^2)$ over empirical histograms.
19. **Local $k$-Neighborhood Spoke Diagram:** Radial network graph pointing from a test instance to its nearest training neighbors.
20. **Proportional-Stream Decision Tree (BaobabView):** Interactive node-link tree where edge thickness represents sample volume.