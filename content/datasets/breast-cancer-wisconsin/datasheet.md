---
pretty_name: 'Breast Cancer Wisconsin (Diagnostic)'
task_categories:
    - tabular-classification
task_ids:
    - 'binary-classification'
license: 'cc-by-4.0'
size_categories:
    - 'n<1K'
source_datasets:
    - 'uci/breast-cancer-wisconsin-diagnostic (id=17)'
tags:
    - 'healthcare'
    - 'beginner'
    - 'binary'
    - 'feature-scaling'
    - 'multicollinearity'
    - 'pca'
    - 'medical-screening'
---

# Breast Cancer Wisconsin (Diagnostic)

**Domain:** Healthcare | **Difficulty:** Beginner | **Task:** Binary Classification | **Rows:** 569 | **Columns:** 32 | **CSV Size:** 125,031 bytes | **License:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

## 1. Dataset Summary & Motivation

Aligned with [Hugging Face Dataset Summary](https://huggingface.co/docs/hub/en/datasets-cards), [Datasheets for Datasets (Motivation)](https://cacm.acm.org/research/datasheets-for-datasets/), and [Google Data Cards Playbook (Purpose & Intentionality)](https://sites.research.google/datacardsplaybook/).

- **Overview:** The Breast Cancer Wisconsin (Diagnostic) dataset (WDBC) contains 569 clinical breast mass biopsy records—357 Benign (`B`, 62.7%) and 212 Malignant (`M`, 37.3%)—described by a clinical specimen `ID` and 30 continuous cytological features summarizing cell nucleus size, shape, and texture. It is a clean, missing-value-free binary classification benchmark in medical machine learning.
- **Original Purpose & Creators:** Developed at the University of Wisconsin Hospitals, Madison by surgeon Dr. William H. Wolberg and computer scientists W. Nick Street and Olvi L. Mangasarian ([Street et al., 1993](https://doi.org/10.1117/12.148698); [Mangasarian et al., 1995](https://pubsonline.informs.org/doi/10.1287/opre.43.4.570)) to support objective, computer-assisted cytological diagnosis of breast masses from minimally invasive fine-needle aspirates.
- **Benchmark & Pedagogical Significance:** WDBC is the premier beginner benchmark for four core ML workflows: (1) **excluding patient identifiers** (`ID` has 569 unique values); (2) **feature scaling sensitivity** (`fractal_dimension2` ~ `0.0009` vs. `area3` ~ `4,254.0`—a six-order-of-magnitude span that severely degrades unscaled k-NN, SVM, and regularized Logistic Regression); (3) **severe multicollinearity and dimensionality reduction** (`radius`, `perimeter`, and `area` across Mean/SE/Worst are non-linearly and linearly coupled, making L1/L2 penalties and PCA highly instructive); and (4) **clinical threshold tuning** (trading Precision against Recall/Sensitivity).

## 2. Dataset Structure & Composition

Aligned with [Hugging Face Dataset Structure](https://huggingface.co/docs/hub/en/datasets-cards), [Datasheets for Datasets (Composition)](https://cacm.acm.org/research/datasheets-for-datasets/), and [OTDI Quality Metrics](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Unit of Observation:** One digitized fine-needle aspirate (FNA) breast mass biopsy slide from an individual clinical patient.
- **File & Parsing Specification:** Packaged at `/public/datasets/breast-cancer-wisconsin/data.csv` (`125,031` bytes, `569` rows, `32` columns, delimiter `","`, `hasHeader: true`).
- **Classification Target(s) & Class Distribution:**
  - **Default Target:** `Diagnosis` (`binary-classification`). Positive class is encoded as `M`. Exact class distribution in `data.csv`: `B` (Benign): **357** (62.74%); `M` (Malignant): **212** (37.26%).
  - **Alternative Classification Target(s):**
  - None configured (all non-target attributes are continuous predictors or identifiers/leakage controls; continuous regression targets are excluded in Phase 1).
- **Excluded Columns (Identifiers, Redundancy & Leakage Controls):**
  - **`ID`** (`semanticRole: "identifier"`, `defaultSelected: false`): Unique specimen identifier with no biological predictive value; including IDs causes memorization.
- **Complete Feature Schema (`columns[]` synchronized with `metadata.json`):**

| #  | Column (`name`)      | Display Name              | Type          | Role         | Default | Unit   | Missing | Implicit Missing / Coded Labels                                                                                                                           |
| -- | -------------------- | ------------------------- | ------------- | ------------ | ------- | ------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1  | `ID`                 | Specimen ID               | `text`        | `identifier` | No      | —      | 0       | Unique clinical cytology case identifier assigned at University of Wisconsin Hospitals.                                                                   |
| 2  | `radius1`            | Radius (Mean)             | `numeric`     | `feature`    | Yes     | `um`   | 0       | Sample mean across nuclei in the FNA image: mean of distances from center to points on the nuclear perimeter.                                             |
| 3  | `texture1`           | Texture (Mean)            | `numeric`     | `feature`    | Yes     | —      | 0       | Sample mean across nuclei in the FNA image: standard deviation of gray-scale pixel intensity values inside the cell nucleus.                              |
| 4  | `perimeter1`         | Perimeter (Mean)          | `numeric`     | `feature`    | Yes     | `um`   | 0       | Sample mean across nuclei in the FNA image: total boundary length of the cell nucleus contour.                                                            |
| 5  | `area1`              | Area (Mean)               | `numeric`     | `feature`    | Yes     | `um^2` | 0       | Sample mean across nuclei in the FNA image: cross-sectional area of the digitized cell nucleus.                                                           |
| 6  | `smoothness1`        | Smoothness (Mean)         | `numeric`     | `feature`    | Yes     | —      | 0       | Sample mean across nuclei in the FNA image: local variation in radius lengths around the nuclear boundary.                                                |
| 7  | `compactness1`       | Compactness (Mean)        | `numeric`     | `feature`    | Yes     | —      | 0       | Sample mean across nuclei in the FNA image: shape compactness index computed as (perimeter^2 / area - 1.0).                                               |
| 8  | `concavity1`         | Concavity (Mean)          | `numeric`     | `feature`    | Yes     | —      | 0       | Sample mean across nuclei in the FNA image: severity of concave indentations along the nuclear contour.                                                   |
| 9  | `concave_points1`    | Concave Points (Mean)     | `numeric`     | `feature`    | Yes     | —      | 0       | Sample mean across nuclei in the FNA image: number of concave portions along the cell nucleus contour.                                                    |
| 10 | `symmetry1`          | Symmetry (Mean)           | `numeric`     | `feature`    | Yes     | —      | 0       | Sample mean across nuclei in the FNA image: bilateral symmetry score of the digitized cell nucleus.                                                       |
| 11 | `fractal_dimension1` | Fractal Dimension (Mean)  | `numeric`     | `feature`    | Yes     | —      | 0       | Sample mean across nuclei in the FNA image: boundary complexity ('coastline approximation' minus 1).                                                      |
| 12 | `radius2`            | Radius (SE)               | `numeric`     | `feature`    | Yes     | `um`   | 0       | Standard error across nuclei in the FNA image: mean of distances from center to points on the nuclear perimeter.                                          |
| 13 | `texture2`           | Texture (SE)              | `numeric`     | `feature`    | Yes     | —      | 0       | Standard error across nuclei in the FNA image: standard deviation of gray-scale pixel intensity values inside the cell nucleus.                           |
| 14 | `perimeter2`         | Perimeter (SE)            | `numeric`     | `feature`    | Yes     | `um`   | 0       | Standard error across nuclei in the FNA image: total boundary length of the cell nucleus contour.                                                         |
| 15 | `area2`              | Area (SE)                 | `numeric`     | `feature`    | Yes     | `um^2` | 0       | Standard error across nuclei in the FNA image: cross-sectional area of the digitized cell nucleus.                                                        |
| 16 | `smoothness2`        | Smoothness (SE)           | `numeric`     | `feature`    | Yes     | —      | 0       | Standard error across nuclei in the FNA image: local variation in radius lengths around the nuclear boundary.                                             |
| 17 | `compactness2`       | Compactness (SE)          | `numeric`     | `feature`    | Yes     | —      | 0       | Standard error across nuclei in the FNA image: shape compactness index computed as (perimeter^2 / area - 1.0).                                            |
| 18 | `concavity2`         | Concavity (SE)            | `numeric`     | `feature`    | Yes     | —      | 0       | Standard error across nuclei in the FNA image: severity of concave indentations along the nuclear contour.                                                |
| 19 | `concave_points2`    | Concave Points (SE)       | `numeric`     | `feature`    | Yes     | —      | 0       | Standard error across nuclei in the FNA image: number of concave portions along the cell nucleus contour.                                                 |
| 20 | `symmetry2`          | Symmetry (SE)             | `numeric`     | `feature`    | Yes     | —      | 0       | Standard error across nuclei in the FNA image: bilateral symmetry score of the digitized cell nucleus.                                                    |
| 21 | `fractal_dimension2` | Fractal Dimension (SE)    | `numeric`     | `feature`    | Yes     | —      | 0       | Standard error across nuclei in the FNA image: boundary complexity ('coastline approximation' minus 1).                                                   |
| 22 | `radius3`            | Radius (Worst)            | `numeric`     | `feature`    | Yes     | `um`   | 0       | Worst (mean of the three largest values) across nuclei in the FNA image: mean of distances from center to points on the nuclear perimeter.                |
| 23 | `texture3`           | Texture (Worst)           | `numeric`     | `feature`    | Yes     | —      | 0       | Worst (mean of the three largest values) across nuclei in the FNA image: standard deviation of gray-scale pixel intensity values inside the cell nucleus. |
| 24 | `perimeter3`         | Perimeter (Worst)         | `numeric`     | `feature`    | Yes     | `um`   | 0       | Worst (mean of the three largest values) across nuclei in the FNA image: total boundary length of the cell nucleus contour.                               |
| 25 | `area3`              | Area (Worst)              | `numeric`     | `feature`    | Yes     | `um^2` | 0       | Worst (mean of the three largest values) across nuclei in the FNA image: cross-sectional area of the digitized cell nucleus.                              |
| 26 | `smoothness3`        | Smoothness (Worst)        | `numeric`     | `feature`    | Yes     | —      | 0       | Worst (mean of the three largest values) across nuclei in the FNA image: local variation in radius lengths around the nuclear boundary.                   |
| 27 | `compactness3`       | Compactness (Worst)       | `numeric`     | `feature`    | Yes     | —      | 0       | Worst (mean of the three largest values) across nuclei in the FNA image: shape compactness index computed as (perimeter^2 / area - 1.0).                  |
| 28 | `concavity3`         | Concavity (Worst)         | `numeric`     | `feature`    | Yes     | —      | 0       | Worst (mean of the three largest values) across nuclei in the FNA image: severity of concave indentations along the nuclear contour.                      |
| 29 | `concave_points3`    | Concave Points (Worst)    | `numeric`     | `feature`    | Yes     | —      | 0       | Worst (mean of the three largest values) across nuclei in the FNA image: number of concave portions along the cell nucleus contour.                       |
| 30 | `symmetry3`          | Symmetry (Worst)          | `numeric`     | `feature`    | Yes     | —      | 0       | Worst (mean of the three largest values) across nuclei in the FNA image: bilateral symmetry score of the digitized cell nucleus.                          |
| 31 | `fractal_dimension3` | Fractal Dimension (Worst) | `numeric`     | `feature`    | Yes     | —      | 0       | Worst (mean of the three largest values) across nuclei in the FNA image: boundary complexity ('coastline approximation' minus 1).                         |
| 32 | `Diagnosis`          | Diagnosis                 | `categorical` | `target`     | No      | —      | 0       | Labels: `B`=Benign; `M`=Malignant                                                                                                                         |

## 3. Provenance, Collection Process & Sampling Frame

Aligned with [Datasheets for Datasets (Collection Process)](https://cacm.acm.org/research/datasheets-for-datasets/), [Google Data Cards Playbook (Provenance & Upstream Sources)](https://sites.research.google/datacardsplaybook/), and [OTDI Verifiable Lineage](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Upstream Lineage:** Originated in **1995** by William H. Wolberg, W. Nick Street, Olvi L. Mangasarian. Canonical dataset homepage: [Breast Cancer Wisconsin (Diagnostic) Canonical Homepage](https://archive.ics.uci.edu/dataset/17/breast+cancer+wisconsin+diagnostic); upstream raw data source: [Upstream Source Repository](https://archive.ics.uci.edu/static/public/17/data.csv).
- **Acquisition Method:** Fluid aspirated from solid breast masses via fine-needle biopsy was stained on glass slides, imaged under a microscope with a digital camera, and segmented via interactive active-contour ('snake') curve-fitting software (`Xcyt`) to compute ten nuclear geometry traits per cell nucleus ([Street et al., 1993](https://doi.org/10.1117/12.148698)). Ground-truth malignancy was confirmed by surgical biopsy for malignant cases and clinical/mammographic follow-up for benign cases.
- **Population & Sampling Frame:** 569 consecutive clinical FNA cases collected at the University of Wisconsin Hospitals, Madison between 1989 and November 1995. Demographic attributes (patient age, race, ethnicity, menopausal status) were not released in the public archive.

## 4. Preprocessing, Cleaning & Data Quality Audit

Aligned with [Datasheets for Datasets (Preprocessing/Cleaning/Labeling)](https://cacm.acm.org/research/datasheets-for-datasets/), [Google Data Cards Playbook (Transformations)](https://sites.research.google/datacardsplaybook/), and [OTDI Completeness Criteria](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Upstream Transformations & Standardization:** Mirrored verbatim (`125,031` bytes) from the official [UCI Machine Learning Repository CSV (`id=17`)](https://archive.ics.uci.edu/static/public/17/data.csv). For each slide, the raw cell-level nuclear distributions were aggregated upstream into three summary statistics per trait: sample mean (`*1`), standard error (`*2`), and 'worst' (`*3`, mean of the three largest values on the slide).
- **Missing Data Profile:**
  - **Explicit Missingness:** `stats.hasMissingValues` is **`false`** (`0` explicit missing cells across all 569 rows and 32 columns when parsed with tokens `""`, `"NA"`, `"NaN"`).
  - **Disguised / Implicit Missingness:** No disguised sentinel missing values (`implicitMissingValues`) are present in this dataset.
- **Known Formatting & Modeling Traps:** Leaving `ID` checked allows Decision Trees to split on arbitrary hospital case-number ranges; our `metadata.json` marks `ID` as `semanticRole: 'identifier'` with `defaultSelected: false`. Note that `0` values in `concavity*` and `concave_points*` (13 benign slides) are **genuine geometric zeros** (perfectly convex nuclei with zero concave indentations), NOT disguised missing values.

## 5. Recommended Uses & Fit-for-Purpose Guidance

Aligned with [Datasheets for Datasets (Uses)](https://cacm.acm.org/research/datasheets-for-datasets/), [Google Data Cards Playbook (Usage Guidance)](https://sites.research.google/datacardsplaybook/), and [Hugging Face Supported Tasks](https://huggingface.co/docs/hub/en/datasets-cards).

- **Recommended Pedagogical Classification Workflows:** Train **Logistic Regression (L1 vs. L2 penalty)**, **RBF/Linear SVM**, and **k-NN** with and without `StandardScaler`, and test **PCA** compression. Evaluate using **Recall (Sensitivity) for class `M`**, **False Negative Rate**, **ROC-AUC**, and interactive **Probability Decision Threshold sliders** (e.g., lowering threshold from `0.50` to `0.25` to minimize missed malignancies).
- **Out-of-Scope & Inappropriate Uses:** Strictly an educational benchmark from a single 1990s microscopy pipeline (`Xcyt`); must never be used for clinical self-diagnosis or modern digital pathology deployment.

## 6. Ethical Considerations, Privacy & Fairness Analysis

Aligned with [Hugging Face Considerations for Using the Data](https://huggingface.co/docs/hub/en/datasets-cards), [Google Data Cards Playbook (Human Attributes & Sensitive Data)](https://sites.research.google/datacardsplaybook/), and [OTDI Privacy/PII Requirements](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Sensitive & Protected Attributes:**
  - **None (`ethics.sensitiveColumns: []`)**: This dataset contains non-demographic measurements without human protected attributes.
- **Privacy & PII Assessment:** Direct names and SSNs were never included; `ID` is an internal de-identified specimen number marked excluded (`identifier`). Re-identification risk after three decades is negligible.
- **Documented Biases & Representational Harms:** Because WDBC omits patient `age`, `race`, and `sex`, it illustrates **demographic blindness / documentation debt** in legacy medical AI datasets ([Alluhaibi, 2026](https://doi.org/10.3390/healthcare14193293); [Haider et al., 2024](https://doi.org/10.1007/s40615-024-02237-0)): high aggregate AUC on a single-center 1990s Wisconsin cohort cannot guarantee equitable sensitivity across racially diverse populations or modern imaging hardware.
- **Recommended Fairness Audits:** While subgroup demographic parity cannot be computed (`sensitiveColumns: []`), learners should conduct **asymmetric error-cost auditing** via confusion matrices—quantifying how default `0.50` probability cutoffs treat missed cancers (False Negatives) identically to benign follow-up biopsies (False Positives).

## 7. Distribution, Licensing & Maintenance

Aligned with [Datasheets for Datasets (Distribution & Maintenance)](https://cacm.acm.org/research/datasheets-for-datasets/) and [OTDI Open Licensing Requirements](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **License & Redistribution Terms:** Distributed under **[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)** (SPDX identifier: `cc-by-4.0`). All open redistribution and attribution requirements have been verified for bundling inside client-side educational repositories (including Apache 2.0-licensed open-source releases).
- **Maintenance & Versioning:** Static archival release hosted on [UCI ML Repository (DOI `10.24432/C5DW2B`)](https://archive.ics.uci.edu/dataset/17/breast+cancer+wisconsin+diagnostic) under **CC BY 4.0**, permitting open redistribution in Apache 2.0 repositories with attribution.

## 8. Sources, Public Dataset Cards & Academic References

Full linked attribution to every public dataset card, upstream repository, transparency standard, and peer-reviewed study consulted during the creation of this Dataset Card.

- **Public Dataset Cards, Repositories & Standards Consulted:**
  - [UCI Machine Learning Repository: Breast Cancer Wisconsin (Diagnostic)](https://archive.ics.uci.edu/dataset/17/breast+cancer+wisconsin+diagnostic) — Verified 569 x 32 schema, CC BY 4.0 license, DOI 10.24432/C5DW2B, and Mean/SE/Worst suffix definitions.
  - [scikit-learn User Guide: Breast Cancer Wisconsin Dataset](https://scikit-learn.org/stable/datasets/toy_dataset.html#breast-cancer-dataset) — Verified benign/malignant class balance (357 B, 212 M) and feature value ranges.
  - [Hugging Face Dataset Cards Documentation](https://huggingface.co/docs/hub/en/datasets-cards) — Structural hierarchy and YAML frontmatter conventions.
  - [Datasheets for Datasets (Gebru et al., 2021)](https://cacm.acm.org/research/datasheets-for-datasets/) — Lifecycle motivation, composition, collection, preprocessing, uses, distribution, and maintenance dimensions.
  - [Google Research Data Cards Playbook (Pushkarna et al., 2022)](https://sites.research.google/datacardsplaybook/) — Purpose, provenance, human attributes, transformations, and fit-for-purpose guidance.
  - [AI Alliance Open Trusted Data Initiative (OTDI) Dataset Specification](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/) — Verifiable lineage, open licensing, PII risk assessment, and zero-drift metadata synchronization.
- **Seminal Papers & Fairness Audits:**
  - [Nuclear Feature Extraction for Breast Tumor Diagnosis](https://doi.org/10.1117/12.148698) — W. Nick Street, William H. Wolberg, Olvi L. Mangasarian (1993) [`seminal-paper`]. Street, W. N., Wolberg, W. H., & Mangasarian, O. L. (1993). Nuclear feature extraction for breast tumor diagnosis. Biomedical Image Processing and Biomedical Visualization, SPIE Vol. 1905, 861-870. https://doi.org/10.1117/12.148698
  - [Breast Cancer Diagnosis and Prognosis via Linear Programming](https://pubsonline.informs.org/doi/10.1287/opre.43.4.570) — Olvi L. Mangasarian, W. Nick Street, William H. Wolberg (1995) [`seminal-paper`]. Mangasarian, O. L., Street, W. N., & Wolberg, W. H. (1995). Breast cancer diagnosis and prognosis via linear programming. Operations Research, 43(4), 570-577. https://doi.org/10.1287/opre.43.4.570
  - [UCI Machine Learning Repository: Breast Cancer Wisconsin (Diagnostic)](https://archive.ics.uci.edu/dataset/17/breast+cancer+wisconsin+diagnostic) — William H. Wolberg, Olvi L. Mangasarian, W. Nick Street (1995) [`documentation`]. Wolberg, W., Mangasarian, O., & Street, N. (1995). Breast Cancer Wisconsin (Diagnostic) [Dataset]. UCI Machine Learning Repository. https://doi.org/10.24432/C5DW2B

The build obtains the pinned publisher source and verifies its digest before preparing and serving this sample. Attribution and licence terms above continue to apply.
