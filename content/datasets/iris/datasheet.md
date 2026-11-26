---
pretty_name: 'Iris Flower Species'
task_categories:
    - tabular-classification
task_ids:
    - 'multiclass-classification'
license: 'cc-by-4.0'
size_categories:
    - 'n<1K'
source_datasets:
    - 'uci/iris (id=53)'
tags:
    - 'biology'
    - 'beginner'
    - 'multiclass'
    - 'clean'
    - 'linear-separability'
    - 'decision-boundaries'
    - 'classic'
---

# Iris Flower Species

**Domain:** Biology | **Difficulty:** Beginner | **Task:** Multiclass Classification | **Rows:** 150 | **Columns:** 5 | **CSV Size:** 4,615 bytes | **License:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

## 1. Dataset Summary & Motivation

Aligned with [Hugging Face Dataset Summary](https://huggingface.co/docs/hub/en/datasets-cards), [Datasheets for Datasets (Motivation)](https://cacm.acm.org/research/datasheets-for-datasets/), and [Google Data Cards Playbook (Purpose & Intentionality)](https://sites.research.google/datacardsplaybook/).

- **Overview:** The Iris Flower Species dataset contains 150 botanical specimens equally divided across three species—Iris setosa (50), Iris versicolor (50), and Iris virginica (50)—characterized by four continuous floral measurements in centimeters (sepal length, sepal width, petal length, and petal width). It models a balanced three-class taxonomic classification problem with zero missing values.
- **Original Purpose & Creators:** Botanist Edgar Anderson collected 100 of the measurements (Iris setosa and Iris versicolor) from a single pasture on Quebec's Gaspe Peninsula and published them in the [Bulletin of the American Iris Society (Anderson, 1935)](https://www.biodiversitylibrary.org/part/251042), adding 50 Iris virginica specimens from an undisclosed North American colony ([Unwin & Kleinman, 2021](https://academic.oup.com/jrssig/article/18/6/26/7029547)). Statistician Ronald A. Fisher subsequently used Anderson's table to introduce Linear Discriminant Analysis in [The Use of Multiple Measurements in Taxonomic Problems (Fisher, 1936)](https://onlinelibrary.wiley.com/doi/10.1111/j.1469-1809.1936.tb02137.x), and Michael Marshall donated the digital table to the [UCI Machine Learning Repository](https://archive.ics.uci.edu/dataset/53/iris) in 1988.
- **Benchmark & Pedagogical Significance:** Iris is the canonical starting point for supervised classification geometry. Because Iris setosa is linearly separable from the other two species in petal-length/petal-width space while Iris versicolor and Iris virginica overlap along a narrow frontier, learners can directly visualize how hyperplane models (Logistic Regression, Linear SVM), axis-aligned partitions (Decision Trees), and local distance neighborhoods (k-NN) trade off decision-boundary complexity against overfitting.

## 2. Dataset Structure & Composition

Aligned with [Hugging Face Dataset Structure](https://huggingface.co/docs/hub/en/datasets-cards), [Datasheets for Datasets (Composition)](https://cacm.acm.org/research/datasheets-for-datasets/), and [OTDI Quality Metrics](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Unit of Observation:** One individual flowering iris plant specimen measured in the field.
- **File & Parsing Specification:** Packaged at `/public/datasets/iris/data.csv` (`4,615` bytes, `150` rows, `5` columns, delimiter `","`, `hasHeader: true`).
- **Classification Target(s) & Class Distribution:**
  - **Default Target:** `class` (`multiclass-classification`). Exact class distribution in `data.csv`: `Iris-setosa` (Iris setosa (Bristle-pointed Iris)): **50** (33.33%); `Iris-versicolor` (Iris versicolor (Blue Flag Iris)): **50** (33.33%); `Iris-virginica` (Iris virginica (Virginia Iris)): **50** (33.33%).
  - **Alternative Classification Target(s):**
  - None configured (all non-target attributes are continuous predictors or identifiers/leakage controls; continuous regression targets are excluded in Phase 1).
- **Excluded Columns (Identifiers, Redundancy & Leakage Controls):**
  - Only the classification target column (`class`) has `defaultSelected: false`; no identifier or post-outcome leaky predictor columns are present in `data.csv`.
- **Complete Feature Schema (`columns[]` synchronized with `metadata.json`):**

| # | Column (`name`) | Display Name | Type          | Role      | Default | Unit | Missing | Implicit Missing / Coded Labels                                                                                                                               |
| - | --------------- | ------------ | ------------- | --------- | ------- | ---- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 | `sepal length`  | Sepal Length | `numeric`     | `feature` | Yes     | `cm` | 0       | Length of the outer floral sepal leaf measured along its central axis.                                                                                        |
| 2 | `sepal width`   | Sepal Width  | `numeric`     | `feature` | Yes     | `cm` | 0       | Maximum width of the outer floral sepal leaf perpendicular to its length.                                                                                     |
| 3 | `petal length`  | Petal Length | `numeric`     | `feature` | Yes     | `cm` | 0       | Length of the inner floral petal leaf; highly discriminative for separating Iris setosa.                                                                      |
| 4 | `petal width`   | Petal Width  | `numeric`     | `feature` | Yes     | `cm` | 0       | Maximum width of the inner floral petal leaf; strongly correlated with petal length.                                                                          |
| 5 | `class`         | Iris Species | `categorical` | `target`  | No      | —    | 0       | Labels: `Iris-setosa`=Iris setosa (Bristle-pointed Iris); `Iris-versicolor`=Iris versicolor (Blue Flag Iris); `Iris-virginica`=Iris virginica (Virginia Iris) |

## 3. Provenance, Collection Process & Sampling Frame

Aligned with [Datasheets for Datasets (Collection Process)](https://cacm.acm.org/research/datasheets-for-datasets/), [Google Data Cards Playbook (Provenance & Upstream Sources)](https://sites.research.google/datacardsplaybook/), and [OTDI Verifiable Lineage](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Upstream Lineage:** Originated in **1936** by Ronald A. Fisher, Edgar Anderson. Canonical dataset homepage: [Iris Flower Species Canonical Homepage](https://archive.ics.uci.edu/dataset/53/iris); upstream raw data source: [Upstream Source Repository](https://archive.ics.uci.edu/static/public/53/data.csv).
- **Acquisition Method:** Edgar Anderson measured fresh iris blossoms in person using millimeter-graduated rulers, ensuring consistent measurement observer protocol across the Gaspe Peninsula colonies for Iris setosa and Iris versicolor.
- **Population & Sampling Frame:** 100 specimens originate from natural colonies on the Gaspe Peninsula, Quebec, Canada (1930s), while the 50 Iris virginica specimens were sampled from a separate colony of larger plants ([Unwin & Kleinman, 2021](https://academic.oup.com/jrssig/article/18/6/26/7029547)). Sample sizes were intentionally fixed at exactly 50 plants per species rather than reflecting natural ecological abundance.

## 4. Preprocessing, Cleaning & Data Quality Audit

Aligned with [Datasheets for Datasets (Preprocessing/Cleaning/Labeling)](https://cacm.acm.org/research/datasheets-for-datasets/), [Google Data Cards Playbook (Transformations)](https://sites.research.google/datacardsplaybook/), and [OTDI Completeness Criteria](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Upstream Transformations & Standardization:** Packaged verbatim from the official [UCI Machine Learning Repository CSV export](https://archive.ics.uci.edu/static/public/53/data.csv) (`4,615` bytes). As documented on the [UCI Iris Dataset Card](https://archive.ics.uci.edu/dataset/53/iris) and by Bezdek et al. (1999), the canonical UCI file contains two historical single-digit transcription differences on 1-based data rows 35 and 38 (both Iris setosa) compared to Fisher's printed 1936 table; retaining the official UCI CSV ensures reproducibility with [scikit-learn's iris mirror](https://huggingface.co/datasets/scikit-learn/iris) and published ML benchmarks.
- **Missing Data Profile:**
  - **Explicit Missingness:** `stats.hasMissingValues` is **`false`** (`0` explicit missing cells across all 150 rows and 5 columns when parsed with tokens `""`, `"NA"`, `"NaN"`).
  - **Disguised / Implicit Missingness:** No disguised sentinel missing values (`implicitMissingValues`) are present in this dataset.
- **Known Formatting & Modeling Traps:** All four predictors share identical physical units (`cm`), but `petal length` exhibits roughly six times the variance of `sepal width`. Comparing unscaled vs. standardized k-NN illustrates subtle distance-weighting shifts even when units match. No identifier or leaky columns exist.

## 5. Recommended Uses & Fit-for-Purpose Guidance

Aligned with [Datasheets for Datasets (Uses)](https://cacm.acm.org/research/datasheets-for-datasets/), [Google Data Cards Playbook (Usage Guidance)](https://sites.research.google/datacardsplaybook/), and [Hugging Face Supported Tasks](https://huggingface.co/docs/hub/en/datasets-cards).

- **Recommended Pedagogical Classification Workflows:** Ideal first experiment for comparing **k-Nearest Neighbors (k = 1, 5, 15)**, **Decision Trees (CART/C4.5)**, **Gaussian Naive Bayes**, **Multinomial Logistic Regression**, and **Support Vector Machines**. Evaluate with **Multiclass Confusion Matrices**, **Macro-F1**, and **2D Decision Boundary scatter plots** (`petal length` vs. `petal width`).
- **Out-of-Scope & Inappropriate Uses:** Not representative of global Iris genus biodiversity (which spans ~300 species and frequent natural hybrids), and unsuitable for benchmarking missing-value imputation, high-dimensional regularization, or demographic fairness metrics.

## 6. Ethical Considerations, Privacy & Fairness Analysis

Aligned with [Hugging Face Considerations for Using the Data](https://huggingface.co/docs/hub/en/datasets-cards), [Google Data Cards Playbook (Human Attributes & Sensitive Data)](https://sites.research.google/datacardsplaybook/), and [OTDI Privacy/PII Requirements](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Sensitive & Protected Attributes:**
  - **None (`ethics.sensitiveColumns: []`)**: This dataset contains non-demographic measurements without human protected attributes.
- **Privacy & PII Assessment:** Contains exclusively botanical plant morphology with zero human subjects, personal identifiers, or re-identification risk.
- **Documented Biases & Representational Harms:** While the measurements themselves carry no human demographic bias, [Fisher's 1936 paper](https://onlinelibrary.wiley.com/doi/10.1111/j.1469-1809.1936.tb02137.x) was published in the Annals of Eugenics, a journal Fisher edited. Modern statistical pedagogy ([Horst et al., 2022](https://journal.r-project.org/articles/RJ-2022-020/)) foregrounds this provenance so learners understand the historical entanglement of early biometry with eugenics alongside modern alternatives such as Palmer Penguins.
- **Recommended Fairness Audits:** No human protected attributes are present (`sensitiveColumns: []`). Educators can use Iris as a baseline control where errors arise purely from class boundary overlap between Iris versicolor and Iris virginica before introducing socially consequential datasets.

## 7. Distribution, Licensing & Maintenance

Aligned with [Datasheets for Datasets (Distribution & Maintenance)](https://cacm.acm.org/research/datasheets-for-datasets/) and [OTDI Open Licensing Requirements](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **License & Redistribution Terms:** Distributed under **[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)** (SPDX identifier: `cc-by-4.0`). All open redistribution and attribution requirements have been verified for bundling inside client-side educational repositories (including Apache 2.0-licensed open-source releases).
- **Maintenance & Versioning:** Static archival benchmark mirrored from UCI Machine Learning Repository (`last_updated: 2023-09-12`, DOI `10.24432/C56C76`). Licensed under **CC BY 4.0**, which permits unrestricted redistribution and adaptation in Apache 2.0 open-source repositories with attribution.

## 8. Sources, Public Dataset Cards & Academic References

Full linked attribution to every public dataset card, upstream repository, transparency standard, and peer-reviewed study consulted during the creation of this Dataset Card.

- **Public Dataset Cards, Repositories & Standards Consulted:**
  - [UCI Machine Learning Repository: Iris (ID 53)](https://archive.ics.uci.edu/dataset/53/iris) — Verified CC BY 4.0 license, DOI 10.24432/C56C76, cm units, and rows 35/38 historical transcription note.
  - [Hugging Face Hub: scikit-learn/iris](https://huggingface.co/datasets/scikit-learn/iris) — Cross-checked class balance (50:50:50) and value ranges across sepal and petal attributes.
  - [Hugging Face Dataset Cards Documentation](https://huggingface.co/docs/hub/en/datasets-cards) — Structural hierarchy and YAML frontmatter conventions.
  - [Datasheets for Datasets (Gebru et al., 2021)](https://cacm.acm.org/research/datasheets-for-datasets/) — Lifecycle motivation, composition, collection, preprocessing, uses, distribution, and maintenance dimensions.
  - [Google Research Data Cards Playbook (Pushkarna et al., 2022)](https://sites.research.google/datacardsplaybook/) — Purpose, provenance, human attributes, transformations, and fit-for-purpose guidance.
  - [AI Alliance Open Trusted Data Initiative (OTDI) Dataset Specification](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/) — Verifiable lineage, open licensing, PII risk assessment, and zero-drift metadata synchronization.
- **Seminal Papers & Fairness Audits:**
  - [The Use of Multiple Measurements in Taxonomic Problems](https://onlinelibrary.wiley.com/doi/10.1111/j.1469-1809.1936.tb02137.x) — Ronald A. Fisher (1936) [`seminal-paper`]. Fisher, R. A. (1936). The use of multiple measurements in taxonomic problems. Annals of Eugenics, 7(2), 179-188. https://doi.org/10.1111/j.1469-1809.1936.tb02137.x
  - [The Irises of the Gaspe Peninsula](https://www.biodiversitylibrary.org/part/251042) — Edgar Anderson (1935) [`seminal-paper`]. Anderson, E. (1935). The irises of the Gaspe Peninsula. Bulletin of the American Iris Society, 59, 2-5.
  - [The Iris Data Set: In Search of the Source of Virginica](https://academic.oup.com/jrssig/article/18/6/26/7029547) — Antony Unwin, Kim Kleinman (2021) [`article`]. Unwin, A., & Kleinman, K. (2021). The Iris data set: In search of the source of virginica. Significance, 18(6), 26-29. https://doi.org/10.1111/1740-9713.01589
  - [UCI Machine Learning Repository: Iris Dataset Card](https://archive.ics.uci.edu/dataset/53/iris) — Ronald A. Fisher (1988) [`documentation`]. Fisher, R. (1936). Iris [Dataset]. UCI Machine Learning Repository. https://doi.org/10.24432/C56C76

The build obtains the pinned publisher source and verifies its digest before preparing and serving this sample. Attribution and licence terms above continue to apply.
