---
pretty_name: "Titanic Passenger Survival"
task_categories:
  - tabular-classification
task_ids:
  - "binary-classification"
  - "multiclass-classification"
license: "cc0-1.0"
size_categories:
  - "n<1K"
source_datasets:
  - "openml/Titanic (id=40945) / mwaskom/seaborn-data"
tags:
  - "social-science"
  - "beginner"
  - "mixed-types"
  - "missing-values"
  - "leakage-hygiene"
  - "historical-bias"
  - "classic"
---

# Titanic Passenger Survival

**Domain:** Social Science | **Difficulty:** Beginner | **Task:** Binary Classification | **Rows:** 891 | **Columns:** 15 | **CSV Size:** 57,018 bytes | **License:** [Public Domain / CC0](https://creativecommons.org/publicdomain/zero/1.0/)

## 1. Dataset Summary & Motivation
Aligned with [Hugging Face Dataset Summary](https://huggingface.co/docs/hub/en/datasets-cards), [Datasheets for Datasets (Motivation)](https://cacm.acm.org/research/datasheets-for-datasets/), and [Google Data Cards Playbook (Purpose & Intentionality)](https://sites.research.google/datacardsplaybook/).

- **Overview:** The Titanic Passenger Survival dataset contains historical manifest records for 891 passengers aboard the RMS Titanic, which sank on April 15, 1912. Of the 891 passengers in this canonical subset, 342 survived (`1`, 38.4%) and 549 perished (`0`, 61.6%). It supports primary binary survival classification (`survived`) and secondary multiclass socioeconomic tier prediction (`pclass`).
- **Original Purpose & Creators:** Compiled from official British Board of Trade inquiry lists and [Encyclopedia Titanica](https://www.encyclopedia-titanica.org/) archival research (Eaton & Haas, 1994), standardized for statistical pedagogy by [Robert J. MacG. Dawson (1995)](https://www.tandfonline.com/doi/abs/10.1080/10691898.1995.11910499), and expanded into the `titanic3` passenger frame by Thomas Cason and Frank E. Harrell Jr. ([OpenML ID 40945](https://www.openml.org/d/40945); [Harrell, 2015](https://link.springer.com/book/10.1007/978-3-319-19425-7)). This 891-row, 15-column CSV is distributed via [`mwaskom/seaborn-data`](https://github.com/mwaskom/seaborn-data/blob/master/titanic.csv).
- **Benchmark & Pedagogical Significance:** Titanic teaches mixed-type preprocessing, non-random missingness (`deck` missing in 77.2% and `age` in 19.9% of rows), **target leakage and redundant column hygiene** (`alive` duplicates `survived`; `class` duplicates `pclass`), and how historical social norms ('women and children first') and physical class barriers become encoded in predictive models ([Raftopoulos et al., 2025](https://doi.org/10.3390/a18070435)).

## 2. Dataset Structure & Composition
Aligned with [Hugging Face Dataset Structure](https://huggingface.co/docs/hub/en/datasets-cards), [Datasheets for Datasets (Composition)](https://cacm.acm.org/research/datasheets-for-datasets/), and [OTDI Quality Metrics](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Unit of Observation:** One individual ticketed passenger aboard the maiden voyage of the RMS Titanic (crew excluded).
- **File & Parsing Specification:** Packaged at `/public/datasets/titanic/data.csv` (`57,018` bytes, `891` rows, `15` columns, delimiter `","`, `hasHeader: true`).
- **Classification Target(s) & Class Distribution:**
  - **Default Target:** `survived` (`binary-classification`). Positive class is encoded as `1`. Exact class distribution in `data.csv`: `0` (Did not survive): **549** (61.62%); `1` (Survived): **342** (38.38%).
  - **Alternative Classification Target(s):**
  - `pclass` (`multiclass-classification`): Predict passenger ticket class (1st, 2nd, or 3rd) from fare, family size, and demographics. (auto-disables leaky columns: `class`, `survived`, `alive`)
- **Excluded Columns (Identifiers, Redundancy & Leakage Controls):**
  - **`class`** (`semanticRole: "feature"`, `defaultSelected: false`): Exact string duplicate of 'pclass' (unchecked by default and auto-disabled when predicting 'pclass').
  - **`who`** (`semanticRole: "feature"`, `defaultSelected: false`): Derived composite of 'sex' and 'age' (optional engineered feature unchecked by default to avoid redundancy).
  - **`adult_male`** (`semanticRole: "feature"`, `defaultSelected: false`): Derived indicator from 'sex' and 'age' unchecked by default to keep primary features unconfounded.
  - **`deck`** (`semanticRole: "feature"`, `defaultSelected: false`): Missing in 77.2% of records (primarily 3rd-class passengers without recorded cabin numbers).
  - **`embark_town`** (`semanticRole: "feature"`, `defaultSelected: false`): Exact string duplicate of the 'embarked' column.
  - **`alive`** (`semanticRole: "leaky"`, `defaultSelected: false`): Exact string duplicate of the 'survived' target column.
  - **`alone`** (`semanticRole: "feature"`, `defaultSelected: false`): Derived indicator from 'sibsp' and 'parch' unchecked by default to avoid feature redundancy.
- **Complete Feature Schema (`columns[]` synchronized with `metadata.json`):**

| # | Column (`name`) | Display Name | Type | Role | Default | Unit | Missing | Implicit Missing / Coded Labels |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `survived` | Survived | `boolean` | `target` | No | — | 0 | Labels: `0`=Did not survive; `1`=Survived |
| 2 | `pclass` | Ticket Class | `categorical` | `feature` | Yes | — | 0 | Labels: `1`=1st Class (Upper); `2`=2nd Class (Middle); `3`=3rd Class (Lower) |
| 3 | `sex` | Sex | `categorical` | `sensitive` | Yes | — | 0 | Labels: `female`=Female; `male`=Male |
| 4 | `age` | Age | `numeric` | `feature` | Yes | `years` | 177 | Passenger age in years (fractional if infant under 1 year; missing for 177 passengers). |
| 5 | `sibsp` | Siblings / Spouses Aboard | `numeric` | `feature` | Yes | — | 0 | Number of siblings or spouses traveling aboard the Titanic with the passenger. |
| 6 | `parch` | Parents / Children Aboard | `numeric` | `feature` | Yes | — | 0 | Number of parents or children traveling aboard the Titanic with the passenger. |
| 7 | `fare` | Passenger Fare | `numeric` | `feature` | Yes | `GBP` | 0 | Implicit missing: `0` |
| 8 | `embarked` | Port of Embarkation | `categorical` | `feature` | Yes | — | 2 | Labels: `C`=Cherbourg, France; `Q`=Queenstown (Cobh), Ireland; `S`=Southampton, England |
| 9 | `class` | Ticket Class (String) | `categorical` | `feature` | No | — | 0 | Text duplicate of the integer-coded 'pclass' column added in seaborn's export. |
| 10 | `who` | Demographic Category | `categorical` | `feature` | No | — | 0 | Derived grouping ('man', 'woman', 'child') constructed from 'sex' and 'age'. |
| 11 | `adult_male` | Adult Male | `boolean` | `feature` | No | — | 0 | Boolean indicator equal to True when passenger is male and age >= 16 (or age unknown). |
| 12 | `deck` | Cabin Deck | `categorical` | `feature` | No | — | 688 | Ship deck letter (A through G) extracted from cabin number; missing for 688 of 891 passengers. |
| 13 | `embark_town` | Embarkation Town (String) | `categorical` | `feature` | No | — | 2 | Full town name duplicate of the single-letter 'embarked' port column. |
| 14 | `alive` | Alive (String) | `boolean` | `leaky` | No | — | 0 | Labels: `no`=Did not survive; `yes`=Survived |
| 15 | `alone` | Traveling Alone | `boolean` | `feature` | No | — | 0 | Derived boolean indicator equal to True when both 'sibsp' and 'parch' equal 0. |

## 3. Provenance, Collection Process & Sampling Frame
Aligned with [Datasheets for Datasets (Collection Process)](https://cacm.acm.org/research/datasheets-for-datasets/), [Google Data Cards Playbook (Provenance & Upstream Sources)](https://sites.research.google/datacardsplaybook/), and [OTDI Verifiable Lineage](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Upstream Lineage:** Originated in **1999** by Thomas Cason, Frank E. Harrell Jr.. Canonical dataset homepage: [Titanic Passenger Survival Canonical Homepage](https://www.openml.org/d/40945); upstream raw data source: [Upstream Source Repository](https://raw.githubusercontent.com/mwaskom/seaborn-data/master/titanic.csv).
- **Acquisition Method:** Reconstructed retrospectively from White Star Line embarkation manifests at Southampton, Cherbourg, and Queenstown, rescue lists from RMS Carpathia, and genealogical cross-verification by Encyclopedia Titanica historians.
- **Population & Sampling Frame:** Represents a deterministic/random 891-passenger partition (~68%) of the 1,309 ticketed passengers in Harrell & Cason's `titanic3` frame; the ~900 ship crew members are excluded.

## 4. Preprocessing, Cleaning & Data Quality Audit
Aligned with [Datasheets for Datasets (Preprocessing/Cleaning/Labeling)](https://cacm.acm.org/research/datasheets-for-datasets/), [Google Data Cards Playbook (Transformations)](https://sites.research.google/datacardsplaybook/), and [OTDI Completeness Criteria](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Upstream Transformations & Standardization:** Mirrored verbatim (`57,018` bytes) from [`mwaskom/seaborn-data/titanic.csv`](https://raw.githubusercontent.com/mwaskom/seaborn-data/master/titanic.csv). Compared to Kaggle's 12-column file, seaborn omits high-cardinality strings (`Name`, `Ticket`, `PassengerId`), parses cabin first letters into `deck`, and appends seven convenience columns (`class`, `who`, `adult_male`, `deck`, `embark_town`, `alive`, `alone`).
- **Missing Data Profile:**
  - **Explicit Missingness:** `stats.hasMissingValues` is **`true`** with **869** explicit missing cells across 4 column(s): `age` (177 missing, 19.87%), `embarked` (2 missing, 0.22%), `deck` (688 missing, 77.22%), `embark_town` (2 missing, 0.22%). Browser CSV parsing treats `""`, `"NA"`, `"NaN"` as missing (`null`/`NaN`).
  - **Disguised / Implicit Missingness:** Domain-invalid sentinel values or unrecorded category tokens are explicitly annotated in `columns[].implicitMissingValues` for: `fare` (`0`).
- **Known Formatting & Modeling Traps:** Including `alive` (`yes`/`no`) yields trivial 100% accuracy via target leakage (`semanticRole: 'leaky'`, auto-disabled). Similarly, `class` and `embark_town` duplicate `pclass` and `embarked`, while `who`, `adult_male`, and `alone` are deterministic composites of `sex`/`age` and `sibsp`/`parch` (unchecked by default with explanatory tooltips). Additionally, 15 passengers have `fare = 0.0` (complimentary/White Star guarantee group tickets), documented in `implicitMissingValues: [0]`.

## 5. Recommended Uses & Fit-for-Purpose Guidance
Aligned with [Datasheets for Datasets (Uses)](https://cacm.acm.org/research/datasheets-for-datasets/), [Google Data Cards Playbook (Usage Guidance)](https://sites.research.google/datacardsplaybook/), and [Hugging Face Supported Tasks](https://huggingface.co/docs/hub/en/datasets-cards).

- **Recommended Pedagogical Classification Workflows:** Train **Decision Trees** (to inspect interpretable splits on `sex`, `pclass`, and `age`), **Logistic Regression**, and **Random Forests**. Compare mean/median `age` imputation against subgroup-aware imputation, and evaluate using **Accuracy**, **F1-score**, **ROC-AUC**, and **Subgroup Confusion Matrices**.
- **Out-of-Scope & Inappropriate Uses:** Captures a singular 1912 maritime disaster with severe lifeboat scarcity; predictions reflect early-20th-century maritime evacuation norms rather than generalizable human survival laws.

## 6. Ethical Considerations, Privacy & Fairness Analysis
Aligned with [Hugging Face Considerations for Using the Data](https://huggingface.co/docs/hub/en/datasets-cards), [Google Data Cards Playbook (Human Attributes & Sensitive Data)](https://sites.research.google/datacardsplaybook/), and [OTDI Privacy/PII Requirements](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Sensitive & Protected Attributes:**
  - **`sex`** (`categorical`): Recorded biological sex of the passenger. Coded as: `female` = Female, `male` = Male.
  - **`age`** (`numeric`): Passenger age in years (fractional if infant under 1 year; missing for 177 passengers).
- **Privacy & PII Assessment:** Personal names and ticket numbers are absent from this 15-column export, and all subjects lived over a century ago (1912), posing zero personal privacy risk.
- **Documented Biases & Representational Harms:** Empirical survival rates in `data.csv` exhibit massive demographic and class stratification: **74.2%** of female passengers (`233/314`) survived vs. **18.9%** of male passengers (`109/577`), and **63.0%** of 1st-class passengers (`136/216`) survived vs. **47.3%** in 2nd class (`87/184`) and **24.2%** in 3rd class (`119/491`). As [Raftopoulos et al. (2025)](https://doi.org/10.3390/a18070435) show in their fairness benchmark on Titanic, high-accuracy classifiers (~83%) exhibit extreme Statistical Parity Difference (~0.73) and TPR Difference (~0.67) across `sex`.
- **Recommended Fairness Audits:** Audit **Selection Rate (Demographic Parity)**, **True Positive Rate**, and **False Positive Rate** across `sex`, `pclass`, and their intersection (e.g., 3rd-class women vs. 1st-class women, and boys vs. adult men), illustrating why statistical disparity reflects historical norms and why 'debiasing' a historical descriptive model differs normatively from debiasing a prospective allocation system.

## 7. Distribution, Licensing & Maintenance
Aligned with [Datasheets for Datasets (Distribution & Maintenance)](https://cacm.acm.org/research/datasheets-for-datasets/) and [OTDI Open Licensing Requirements](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **License & Redistribution Terms:** Distributed under **[Public Domain / CC0](https://creativecommons.org/publicdomain/zero/1.0/)** (SPDX identifier: `cc0-1.0`). All open redistribution and attribution requirements have been verified for bundling inside client-side educational repositories (including Apache 2.0-licensed open-source releases).
- **Maintenance & Versioning:** Static public-domain historical dataset (`OpenML ID 40945` / `seaborn-data`, **Public Domain / CC0**), freely redistributable in Apache 2.0 open-source projects.

## 8. Sources, Public Dataset Cards & Academic References
Full linked attribution to every public dataset card, upstream repository, transparency standard, and peer-reviewed study consulted during the creation of this Dataset Card.

- **Public Dataset Cards, Repositories & Standards Consulted:**
  - [OpenML Dataset Card: Titanic (ID 40945)](https://www.openml.org/d/40945) — Verified provenance to Eaton & Haas (1994), Cason, and Harrell's Vanderbilt Biostatistics archive.
  - [seaborn-data GitHub Repository: titanic.csv](https://github.com/mwaskom/seaborn-data/blob/master/titanic.csv) — Verified exact 891 x 15 column layout, derived column definitions, and 57,018-byte file size.
  - [Hugging Face Dataset Cards Documentation](https://huggingface.co/docs/hub/en/datasets-cards) — Structural hierarchy and YAML frontmatter conventions.
  - [Datasheets for Datasets (Gebru et al., 2021)](https://cacm.acm.org/research/datasheets-for-datasets/) — Lifecycle motivation, composition, collection, preprocessing, uses, distribution, and maintenance dimensions.
  - [Google Research Data Cards Playbook (Pushkarna et al., 2022)](https://sites.research.google/datacardsplaybook/) — Purpose, provenance, human attributes, transformations, and fit-for-purpose guidance.
  - [AI Alliance Open Trusted Data Initiative (OTDI) Dataset Specification](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/) — Verifiable lineage, open licensing, PII risk assessment, and zero-drift metadata synchronization.
- **Seminal Papers & Fairness Audits:**
  - [The 'Unusual Episode' Data Revisited](https://www.tandfonline.com/doi/abs/10.1080/10691898.1995.11910499) — Robert J. MacG. Dawson (1995) [`seminal-paper`]. Dawson, R. J. M. (1995). The 'unusual episode' data revisited. Journal of Statistics Education, 3(3). https://doi.org/10.1080/10691898.1995.11910499
  - [Regression Modeling Strategies: With Applications to Linear Models, Logistic and Ordinal Regression, and Survival Analysis](https://link.springer.com/book/10.1007/978-3-319-19425-7) — Frank E. Harrell Jr. (2015) [`seminal-paper`]. Harrell, F. E., Jr. (2015). Regression modeling strategies (2nd ed.). Springer. https://doi.org/10.1007/978-3-319-19425-7
  - [A Comprehensive Review and Benchmarking of Fairness-Aware Variants of Machine Learning Models](https://doi.org/10.3390/a18070435) — George Raftopoulos, Nikos Fazakis, Gregory Davrazos, Sotiris Kotsiantis (2025) [`fairness-audit`]. Raftopoulos, G., Fazakis, N., Davrazos, G., & Kotsiantis, S. (2025). A comprehensive review and benchmarking of fairness-aware variants of machine learning models. Algorithms, 18(7), 435. https://doi.org/10.3390/a18070435
