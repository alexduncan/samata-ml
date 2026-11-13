---
pretty_name: "Pima Indians Diabetes Diagnostic"
task_categories:
  - tabular-classification
task_ids:
  - "binary-classification"
license: "cc-by-4.0"
size_categories:
  - "n<1K"
source_datasets:
  - "openml/diabetes (id=37)"
tags:
  - "healthcare"
  - "intermediate"
  - "binary"
  - "implicit-missingness"
  - "sentinel-zeros"
  - "indigenous-data-ethics"
  - "endocrinology"
---

# Pima Indians Diabetes Diagnostic

**Domain:** Healthcare | **Difficulty:** Intermediate | **Task:** Binary Classification | **Rows:** 768 | **Columns:** 9 | **CSV Size:** 33,824 bytes | **License:** [Public Domain / CC BY 4.0 (OpenML Archive)](https://creativecommons.org/licenses/by/4.0/)

## 1. Dataset Summary & Motivation
Aligned with [Hugging Face Dataset Summary](https://huggingface.co/docs/hub/en/datasets-cards), [Datasheets for Datasets (Motivation)](https://cacm.acm.org/research/datasheets-for-datasets/), and [Google Data Cards Playbook (Purpose & Intentionality)](https://sites.research.google/datacardsplaybook/).

- **Overview:** The Pima Indians Diabetes dataset contains 768 diagnostic records—500 `tested_negative` (65.1%) and 268 `tested_positive` (34.9%) according to World Health Organization 2-hour oral glucose tolerance criteria—across eight clinical and demographic risk factors (`preg`, `plas`, `pres`, `skin`, `insu`, `mass`, `pedi`, `age`). It models binary clinical screening under pervasive disguised missingness.
- **Original Purpose & Creators:** Derived from a long-running longitudinal epidemiological study initiated in 1965 by the US National Institute of Diabetes and Digestive and Kidney Diseases (NIDDK) in the Gila River Indian Community, Arizona. Jack W. Smith and colleagues extracted this 768-instance subset to evaluate the ADAP neural learning algorithm ([Smith et al., 1988](https://pmc.ncbi.nlm.nih.gov/articles/PMC2245318/)), and Vincent Sigillito (Johns Hopkins Applied Physics Laboratory) donated it to UCI in 1990; it is canonically archived at [OpenML ID 37](https://www.openml.org/d/37).
- **Benchmark & Pedagogical Significance:** Pima Diabetes is the single best pedagogical dataset for teaching **disguised (sentinel) missing values**: a naive CSV parser reports `0` missing cells (`hasMissingValues: false`), yet `374` rows (48.7%) have `insu = 0`, `227` (29.6%) have `skin = 0`, `35` (4.6%) have `pres = 0`, `11` (1.4%) have `mass = 0`, and `5` (0.7%) have `plas = 0`—all physiologically impossible in living patients—whereas `preg = 0` (`111` rows) is a **valid count**! Simultaneously, it grounds critical discussion of **sampling-frame external validity** and **Indigenous Data Sovereignty** ([Radin, 2017](https://www.jstor.org/stable/26562765)).

## 2. Dataset Structure & Composition
Aligned with [Hugging Face Dataset Structure](https://huggingface.co/docs/hub/en/datasets-cards), [Datasheets for Datasets (Composition)](https://cacm.acm.org/research/datasheets-for-datasets/), and [OTDI Quality Metrics](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Unit of Observation:** One female patient aged 21 or older of Akimel O'odham (Pima) heritage examined in a longitudinal diabetes study.
- **File & Parsing Specification:** Packaged at `/public/datasets/pima-diabetes/data.csv` (`33,824` bytes, `768` rows, `9` columns, delimiter `","`, `hasHeader: true`).
- **Classification Target(s) & Class Distribution:**
  - **Default Target:** `class` (`binary-classification`). Positive class is encoded as `tested_positive`. Exact class distribution in `data.csv`: `tested_negative` (Negative (No WHO diabetes signs)): **500** (65.10%); `tested_positive` (Positive (WHO diabetes criteria met)): **268** (34.90%).
  - **Alternative Classification Target(s):**
  - None configured (all non-target attributes are continuous predictors or identifiers/leakage controls; continuous regression targets are excluded in Phase 1).
- **Excluded Columns (Identifiers, Redundancy & Leakage Controls):**
  - Only the classification target column (`class`) has `defaultSelected: false`; no identifier or post-outcome leaky predictor columns are present in `data.csv`.
- **Complete Feature Schema (`columns[]` synchronized with `metadata.json`):**

| # | Column (`name`) | Display Name | Type | Role | Default | Unit | Missing | Implicit Missing / Coded Labels |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `preg` | Pregnancies | `numeric` | `feature` | Yes | — | 0 | Number of times pregnant (note: 0 is a valid clinical count for nulliparous patients, NOT a missing value). |
| 2 | `plas` | Plasma Glucose (2-hr OGTT) | `numeric` | `feature` | Yes | `mg/dL` | 0 | Implicit missing: `0` |
| 3 | `pres` | Diastolic Blood Pressure | `numeric` | `feature` | Yes | `mm Hg` | 0 | Implicit missing: `0` |
| 4 | `skin` | Triceps Skinfold Thickness | `numeric` | `feature` | Yes | `mm` | 0 | Implicit missing: `0` |
| 5 | `insu` | 2-Hour Serum Insulin | `numeric` | `feature` | Yes | `mu U/mL` | 0 | Implicit missing: `0` |
| 6 | `mass` | Body Mass Index (BMI) | `numeric` | `feature` | Yes | `kg/m^2` | 0 | Implicit missing: `0` |
| 7 | `pedi` | Diabetes Pedigree Function | `numeric` | `feature` | Yes | — | 0 | Composite genetic-family history risk score synthesizing diabetes incidence and age of onset across relatives. |
| 8 | `age` | Age | `numeric` | `sensitive` | Yes | `years` | 0 | Patient age in years (sample restricted to women aged 21 and older; diabetes prevalence is 21.2% under age 30 vs. 49.5% aged 30+). |
| 9 | `class` | Diabetes Diagnosis | `categorical` | `target` | No | — | 0 | Labels: `tested_negative`=Negative (No WHO diabetes signs); `tested_positive`=Positive (WHO diabetes criteria met) |

## 3. Provenance, Collection Process & Sampling Frame
Aligned with [Datasheets for Datasets (Collection Process)](https://cacm.acm.org/research/datasheets-for-datasets/), [Google Data Cards Playbook (Provenance & Upstream Sources)](https://sites.research.google/datacardsplaybook/), and [OTDI Verifiable Lineage](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Upstream Lineage:** Originated in **1990** by National Institute of Diabetes and Digestive and Kidney Diseases (NIDDK), Vincent Sigillito, Jack W. Smith. Canonical dataset homepage: [Pima Indians Diabetes Diagnostic Canonical Homepage](https://www.openml.org/d/37); upstream raw data source: [Upstream Source Repository](https://www.openml.org/data/get_csv/37/dataset_37_diabetes.arff).
- **Acquisition Method:** Participants underwent biennial clinical examinations including medical/obstetric history (`preg`), 75g 2-hour oral glucose tolerance testing (`plas`) with concurrent radioimmunoassay serum insulin (`insu`), resting cuff diastolic blood pressure (`pres`), caliper triceps skinfold (`skin`), anthropometry (`mass`), and family pedigree calculation (`pedi`).
- **Population & Sampling Frame:** Restricted strictly to female community members aged 21 to 81 of Akimel O'odham heritage living near Phoenix, Arizona. Men, individuals under age 21, and non-Indigenous populations are completely absent from the sampling frame.

## 4. Preprocessing, Cleaning & Data Quality Audit
Aligned with [Datasheets for Datasets (Preprocessing/Cleaning/Labeling)](https://cacm.acm.org/research/datasheets-for-datasets/), [Google Data Cards Playbook (Transformations)](https://sites.research.google/datacardsplaybook/), and [OTDI Completeness Criteria](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Upstream Transformations & Standardization:** Mirrored verbatim (`33,824` bytes) from [OpenML Dataset 37 (`diabetes`)](https://www.openml.org/d/37). Upstream 1980s database export routines encoded unmeasured clinical assays as numeric `0` rather than `NA`/`?`.
- **Missing Data Profile:**
  - **Explicit Missingness:** `stats.hasMissingValues` is **`false`** (`0` explicit missing cells across all 768 rows and 9 columns when parsed with tokens `""`, `"NA"`, `"NaN"`).
  - **Disguised / Implicit Missingness:** Domain-invalid sentinel values or unrecorded category tokens are explicitly annotated in `columns[].implicitMissingValues` for: `plas` (`0`), `pres` (`0`), `skin` (`0`), `insu` (`0`), `mass` (`0`).
- **Known Formatting & Modeling Traps:** Training linear models, SVMs, or k-NN directly on raw numeric columns treats `0` BMI and `0` mm Hg blood pressure as extreme low physiological measurements, warping standardization means and decision hyperplanes. Conversely, dropping every row containing an implicit `0` discards **376 of 768 patients (49.0%)**! Learners must compare sentinel-aware median/k-NN imputation on `['plas', 'pres', 'skin', 'insu', 'mass']` while leaving `preg = 0` untouched.

## 5. Recommended Uses & Fit-for-Purpose Guidance
Aligned with [Datasheets for Datasets (Uses)](https://cacm.acm.org/research/datasheets-for-datasets/), [Google Data Cards Playbook (Usage Guidance)](https://sites.research.google/datacardsplaybook/), and [Hugging Face Supported Tasks](https://huggingface.co/docs/hub/en/datasets-cards).

- **Recommended Pedagogical Classification Workflows:** Contrast **Logistic Regression, k-NN, and Decision Trees** before vs. after converting `implicitMissingValues: [0]` to `NaN` and imputing. Evaluate with **ROC-AUC**, **F1-score**, **Precision-Recall curves**, and **Sensitivity/Specificity**.
- **Out-of-Scope & Inappropriate Uses:** Cannot generalize to male patients, pediatric populations, or broader multi-ethnic clinical screening; strictly limited to educational methodology and ethics instruction.

## 6. Ethical Considerations, Privacy & Fairness Analysis
Aligned with [Hugging Face Considerations for Using the Data](https://huggingface.co/docs/hub/en/datasets-cards), [Google Data Cards Playbook (Human Attributes & Sensitive Data)](https://sites.research.google/datacardsplaybook/), and [OTDI Privacy/PII Requirements](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Sensitive & Protected Attributes:**
  - **`age`** (`numeric`): Patient age in years (sample restricted to women aged 21 and older; diabetes prevalence is 21.2% under age 30 vs. 49.5% aged 30+).
- **Privacy & PII Assessment:** Contains no direct names or identifiers, though small-community biomedical cohorts carry collective group-level privacy sensitivities.
- **Documented Biases & Representational Harms:** Science historian Joanna Radin ([Radin, 2017, 'Digital Natives', Osiris](https://www.jstor.org/stable/26562765)) traces how biomedical measurements given by Gila River community members hoping for local diabetes care were converted into a decontextualized 'toy' ML benchmark used in thousands of papers disconnected from Indigenous health equity. Furthermore, within the sample, diabetes prevalence rises sharply with `age` (**21.2%** for `age < 30` vs. **49.5%** for `age >= 30`), creating strong age-group error rate differentials ([Simson et al., 2025](https://arxiv.org/abs/2510.22363)).
- **Recommended Fairness Audits:** Audit **False Negative Rate** and **False Positive Rate** across age brackets (`age < 30` vs. `age >= 30`), and reflect on the **CARE Principles for Indigenous Data Governance** (Collective Benefit, Authority to Control, Responsibility, Ethics)—asking when open benchmark reuse conflicts with community consent and benefit-sharing.

## 7. Distribution, Licensing & Maintenance
Aligned with [Datasheets for Datasets (Distribution & Maintenance)](https://cacm.acm.org/research/datasheets-for-datasets/) and [OTDI Open Licensing Requirements](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **License & Redistribution Terms:** Distributed under **[Public Domain / CC BY 4.0 (OpenML Archive)](https://creativecommons.org/licenses/by/4.0/)** (SPDX identifier: `cc-by-4.0`). All open redistribution and attribution requirements have been verified for bundling inside client-side educational repositories (including Apache 2.0-licensed open-source releases).
- **Maintenance & Versioning:** Static historical snapshot preserved on [OpenML (ID 37)](https://www.openml.org/d/37) (originating from US federal NIDDK research; OpenML metadata/distribution CC BY 4.0).

## 8. Sources, Public Dataset Cards & Academic References
Full linked attribution to every public dataset card, upstream repository, transparency standard, and peer-reviewed study consulted during the creation of this Dataset Card.

- **Public Dataset Cards, Repositories & Standards Consulted:**
  - [OpenML Dataset Card: diabetes (ID 37)](https://www.openml.org/d/37) — Verified original 1990 Sigillito/NIDDK documentation, attribute units, and WHO 200 mg/dL diagnostic criterion.
  - [FairGround Corpus Documentation Note (Simson et al., 2025)](https://arxiv.org/abs/2510.22363) — Consulted Section C.7 analysis of Pima Diabetes provenance and sensitive-attribute considerations.
  - [Hugging Face Dataset Cards Documentation](https://huggingface.co/docs/hub/en/datasets-cards) — Structural hierarchy and YAML frontmatter conventions.
  - [Datasheets for Datasets (Gebru et al., 2021)](https://cacm.acm.org/research/datasheets-for-datasets/) — Lifecycle motivation, composition, collection, preprocessing, uses, distribution, and maintenance dimensions.
  - [Google Research Data Cards Playbook (Pushkarna et al., 2022)](https://sites.research.google/datacardsplaybook/) — Purpose, provenance, human attributes, transformations, and fit-for-purpose guidance.
  - [AI Alliance Open Trusted Data Initiative (OTDI) Dataset Specification](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/) — Verifiable lineage, open licensing, PII risk assessment, and zero-drift metadata synchronization.
- **Seminal Papers & Fairness Audits:**
  - [Using the ADAP Learning Algorithm to Forecast the Onset of Diabetes Mellitus](https://pmc.ncbi.nlm.nih.gov/articles/PMC2245318/) — Jack W. Smith, J. E. Everhart, W. C. Dickson, W. C. Knowler, R. S. Johannes (1988) [`seminal-paper`]. Smith, J. W., Everhart, J. E., Dickson, W. C., Knowler, W. C., & Johannes, R. S. (1988). Using the ADAP learning algorithm to forecast the onset of diabetes mellitus. Proceedings of the Annual Symposium on Computer Application in Medical Care, 261-265.
  - ['Digital Natives': How Medical and Indigenous Histories Matter for Big Data](https://www.jstor.org/stable/26562765) — Joanna Radin (2017) [`fairness-audit`]. Radin, J. (2017). 'Digital natives': How medical and Indigenous histories matter for big data. Osiris, 32(1), 43-64. https://doi.org/10.1086/693853
  - [Bias Begins with Data: The FairGround Corpus for Robust and Reproducible Research on Algorithmic Fairness](https://arxiv.org/abs/2510.22363) — Jan Simson, Alessandro Fabris, Cosima Froehner, Frauke Kreuter, Christoph Kern (2025) [`fairness-audit`]. Simson, J., Fabris, A., Froehner, C., Kreuter, F., & Kern, C. (2025). Bias begins with data: The FairGround corpus for robust and reproducible research on algorithmic fairness. arXiv preprint arXiv:2510.22363.
  - [OpenML Dataset Card: diabetes (ID 37)](https://www.openml.org/d/37) — Vincent Sigillito, OpenML Contributors (2014) [`documentation`]. Sigillito, V. (1990). Pima Indians Diabetes Database (OpenML ID 37) [Dataset]. OpenML. https://www.openml.org/d/37
