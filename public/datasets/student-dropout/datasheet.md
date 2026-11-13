---
pretty_name: "Higher Education Student Dropout & Success"
task_categories:
  - tabular-classification
task_ids:
  - "multiclass-classification"
  - "binary-classification"
license: "cc-by-4.0"
size_categories:
  - "1K<n<10K"
source_datasets:
  - "uci/predict-students-dropout-and-academic-success (id=697)"
tags:
  - "social-science"
  - "intermediate"
  - "multiclass"
  - "education"
  - "coded-categoricals"
  - "socioeconomic-fairness"
  - "disability-inclusion"
---

# Higher Education Student Dropout & Success

**Domain:** Social Science | **Difficulty:** Intermediate | **Task:** Multiclass Classification | **Rows:** 4,424 | **Columns:** 37 | **CSV Size:** 495,639 bytes | **License:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

## 1. Dataset Summary & Motivation
Aligned with [Hugging Face Dataset Summary](https://huggingface.co/docs/hub/en/datasets-cards), [Datasheets for Datasets (Motivation)](https://cacm.acm.org/research/datasheets-for-datasets/), and [Google Data Cards Playbook (Purpose & Intentionality)](https://sites.research.google/datacardsplaybook/).

- **Overview:** The Higher Education Student Dropout & Success dataset tracks 4,424 undergraduate students across 36 demographic, socioeconomic, macroeconomic, and first-year curricular predictors to classify three outcomes at normal degree duration: `Graduate` (2,209, 49.9%), `Dropout` (1,421, 32.1%), and `Enrolled` (794, 17.9%). It also supports binary socio-financial classification via `Scholarship holder`.
- **Original Purpose & Creators:** Created at the Polytechnic Institute of Portalegre, Portugal by Valentim Realinho, Jorge Machado, Luis Baptista, and Monica V. Martins under the national SATDAP grant (`POCI-05-5762-FSE-000191`) to power an early-warning tutoring support platform ([Realinho et al., 2022](https://www.mdpi.com/2306-5729/7/11/146)), and donated to the [UCI Machine Learning Repository (`id=697`)](https://archive.ics.uci.edu/dataset/697/predict+students+dropout+and+academic+success).
- **Benchmark & Pedagogical Significance:** Systematic reviews highlight a glaring shortage of **multiclass** datasets in fair-ML research ([Pagano et al., 2023](https://doi.org/10.3390/bdcc7010015)). Student Dropout fills that gap while directly engaging higher-education equity across **gender**, **age**, **economic disadvantage** (`Debtor`, `Scholarship holder`, `Tuition fees up to date`), **geographic displacement** (`Displaced`), **nationality**, and **disability inclusion** (`Educational special needs`). It also teaches learners how integer-coded administrative categories (`Course` = `9500`, `Nacionality` = `41`) and stage-dependent features (enrollment-only vs. 1st/2nd-semester grades) shape model validity.

## 2. Dataset Structure & Composition
Aligned with [Hugging Face Dataset Structure](https://huggingface.co/docs/hub/en/datasets-cards), [Datasheets for Datasets (Composition)](https://cacm.acm.org/research/datasheets-for-datasets/), and [OTDI Quality Metrics](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Unit of Observation:** One undergraduate student enrolled in one of 17 degree programs at a Portuguese polytechnic higher-education institution.
- **File & Parsing Specification:** Packaged at `/public/datasets/student-dropout/data.csv` (`495,639` bytes, `4,424` rows, `37` columns, delimiter `","`, `hasHeader: true`).
- **Classification Target(s) & Class Distribution:**
  - **Default Target:** `Target` (`multiclass-classification`). Exact class distribution in `data.csv`: `Dropout` (Dropped out prior to completion): **1,421** (32.12%); `Enrolled` (Still enrolled beyond normal duration): **794** (17.95%); `Graduate` (Graduated within normal duration): **2,209** (49.93%).
  - **Alternative Classification Target(s):**
  - `Scholarship holder` (`binary-classification`): Predict whether a student holds a need/merit scholarship (1 = Yes, 0 = No) from demographic and academic profile.
- **Excluded Columns (Identifiers, Redundancy & Leakage Controls):**
  - Only the classification target column (`Target`) has `defaultSelected: false`; no identifier or post-outcome leaky predictor columns are present in `data.csv`.
- **Complete Feature Schema (`columns[]` synchronized with `metadata.json`):**

| # | Column (`name`) | Display Name | Type | Role | Default | Unit | Missing | Implicit Missing / Coded Labels |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `Marital Status` | Marital Status | `categorical` | `sensitive` | Yes | — | 0 | Labels: `1`=Single; `2`=Married; `3`=Widower; `4`=Divorced; `5`=De facto union; `6`=Legally separated |
| 2 | `Application mode` | Application Mode | `categorical` | `feature` | Yes | — | 0 | Labels: `1`=1st phase - general contingent; `2`=Ordinance No. 612/93; `5`=1st phase - special contingent (Azores); `7`=Holders of other higher courses; `10`=Ordinance No. 854-B/99; `15`=International student (bachelor); ... (+12 more) |
| 3 | `Application order` | Application Preference Order | `numeric` | `feature` | Yes | — | 0 | Student's ranked preference order for the degree program (0 = 1st choice through 9 = last choice). |
| 4 | `Course` | Degree Program | `categorical` | `feature` | Yes | — | 0 | Labels: `33`=Biofuel Production Technologies; `171`=Animation and Multimedia Design; `8014`=Social Service (Evening); `9003`=Agronomy; `9070`=Communication Design; `9085`=Veterinary Nursing; ... (+11 more) |
| 5 | `Daytime/evening attendance` | Attendance Schedule | `boolean` | `feature` | Yes | — | 0 | Labels: `0`=Evening attendance; `1`=Daytime attendance |
| 6 | `Previous qualification` | Previous Qualification | `categorical` | `feature` | Yes | — | 0 | Highest educational qualification completed prior to higher-education enrollment (coded per national education scale). |
| 7 | `Previous qualification (grade)` | Previous Qualification Grade | `numeric` | `feature` | Yes | `points (0-200)` | 0 | Prior secondary or post-secondary qualification grade on the Portuguese 0-200 admission scale. |
| 8 | `Nacionality` | Nationality | `categorical` | `sensitive` | Yes | — | 0 | Labels: `1`=Portuguese; `2`=German; `6`=Spanish; `11`=Italian; `13`=Dutch; `14`=English; ... (+15 more) |
| 9 | `Mother's qualification` | Mother's Qualification | `categorical` | `feature` | Yes | — | 0 | Implicit missing: `34` |
| 10 | `Father's qualification` | Father's Qualification | `categorical` | `feature` | Yes | — | 0 | Implicit missing: `34` |
| 11 | `Mother's occupation` | Mother's Occupation | `categorical` | `feature` | Yes | — | 0 | Implicit missing: `99` |
| 12 | `Father's occupation` | Father's Occupation | `categorical` | `feature` | Yes | — | 0 | Implicit missing: `99` |
| 13 | `Admission grade` | Admission Grade | `numeric` | `feature` | Yes | `points (0-200)` | 0 | Weighted entrance score combining secondary GPA and national exam scores (0 to 200 scale). |
| 14 | `Displaced` | Displaced Student | `boolean` | `sensitive` | Yes | — | 0 | Labels: `0`=No; `1`=Yes (Relocated from home region) |
| 15 | `Educational special needs` | Educational Special Needs | `boolean` | `sensitive` | Yes | — | 0 | Labels: `0`=No; `1`=Yes (Special educational needs) |
| 16 | `Debtor` | Tuition Debtor | `boolean` | `sensitive` | Yes | — | 0 | Labels: `0`=No; `1`=Yes |
| 17 | `Tuition fees up to date` | Tuition Fees Up to Date | `boolean` | `feature` | Yes | — | 0 | Labels: `0`=No (In arrears); `1`=Yes (Up to date) |
| 18 | `Gender` | Gender | `boolean` | `sensitive` | Yes | — | 0 | Labels: `0`=Female; `1`=Male |
| 19 | `Scholarship holder` | Scholarship Holder | `boolean` | `sensitive` | Yes | — | 0 | Labels: `0`=No; `1`=Yes |
| 20 | `Age at enrollment` | Age at Enrollment | `numeric` | `sensitive` | Yes | `years` | 0 | Student age in years upon initial program enrollment. |
| 21 | `International` | International Student | `boolean` | `sensitive` | Yes | — | 0 | Labels: `0`=Domestic; `1`=International |
| 22 | `Curricular units 1st sem (credited)` | 1st Sem Units Credited | `numeric` | `feature` | Yes | — | 0 | Number of course units credited via prior learning recognition in the 1st semester. |
| 23 | `Curricular units 1st sem (enrolled)` | 1st Sem Units Enrolled | `numeric` | `feature` | Yes | — | 0 | Number of course units enrolled in during the 1st semester. |
| 24 | `Curricular units 1st sem (evaluations)` | 1st Sem Evaluations | `numeric` | `feature` | Yes | — | 0 | Number of exam/assessment evaluations attempted in the 1st semester. |
| 25 | `Curricular units 1st sem (approved)` | 1st Sem Units Approved | `numeric` | `feature` | Yes | — | 0 | Number of course units passed in the 1st semester. |
| 26 | `Curricular units 1st sem (grade)` | 1st Sem Grade Average | `numeric` | `feature` | Yes | `points (0-20)` | 0 | Mean grade across passed 1st-semester units (0-20 scale; 0 when zero units were passed). |
| 27 | `Curricular units 1st sem (without evaluations)` | 1st Sem Units Without Evaluation | `numeric` | `feature` | Yes | — | 0 | Number of enrolled 1st-semester units where the student did not sit for assessment. |
| 28 | `Curricular units 2nd sem (credited)` | 2nd Sem Units Credited | `numeric` | `feature` | Yes | — | 0 | Number of course units credited in the 2nd semester. |
| 29 | `Curricular units 2nd sem (enrolled)` | 2nd Sem Units Enrolled | `numeric` | `feature` | Yes | — | 0 | Number of course units enrolled in during the 2nd semester. |
| 30 | `Curricular units 2nd sem (evaluations)` | 2nd Sem Evaluations | `numeric` | `feature` | Yes | — | 0 | Number of exam/assessment evaluations attempted in the 2nd semester. |
| 31 | `Curricular units 2nd sem (approved)` | 2nd Sem Units Approved | `numeric` | `feature` | Yes | — | 0 | Number of course units passed in the 2nd semester (strongest post-year-1 predictor of graduation). |
| 32 | `Curricular units 2nd sem (grade)` | 2nd Sem Grade Average | `numeric` | `feature` | Yes | `points (0-20)` | 0 | Mean grade across passed 2nd-semester units (0-20 scale). |
| 33 | `Curricular units 2nd sem (without evaluations)` | 2nd Sem Units Without Evaluation | `numeric` | `feature` | Yes | — | 0 | Number of enrolled 2nd-semester units where the student did not sit for assessment. |
| 34 | `Unemployment rate` | National Unemployment Rate | `numeric` | `feature` | Yes | `%` | 0 | Portuguese national unemployment rate during the enrollment academic year. |
| 35 | `Inflation rate` | Annual Inflation Rate | `numeric` | `feature` | Yes | `%` | 0 | Portuguese consumer price inflation rate during the enrollment academic year. |
| 36 | `GDP` | Real GDP Growth | `numeric` | `feature` | Yes | `%` | 0 | Real national gross domestic product growth indicator during the enrollment academic year. |
| 37 | `Target` | Academic Outcome | `categorical` | `target` | No | — | 0 | Labels: `Dropout`=Dropped out prior to completion; `Enrolled`=Still enrolled beyond normal duration; `Graduate`=Graduated within normal duration |

## 3. Provenance, Collection Process & Sampling Frame
Aligned with [Datasheets for Datasets (Collection Process)](https://cacm.acm.org/research/datasheets-for-datasets/), [Google Data Cards Playbook (Provenance & Upstream Sources)](https://sites.research.google/datacardsplaybook/), and [OTDI Verifiable Lineage](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Upstream Lineage:** Originated in **2021** by Valentim Realinho, Monica Vieira Martins, Jorge Machado, Luis M. T. Baptista. Canonical dataset homepage: [Higher Education Student Dropout & Success Canonical Homepage](https://archive.ics.uci.edu/dataset/697/predict+students+dropout+and+academic+success); upstream raw data source: [Upstream Source Repository](https://archive.ics.uci.edu/static/public/697/data.csv).
- **Acquisition Method:** Aggregated from disjoint institutional Academic Management System databases (admissions, financial aid, registrar grades) linked with national macroeconomic series from PORDATA (Portuguese unemployment, inflation, and GDP growth during each cohort's entry year).
- **Population & Sampling Frame:** 4,424 undergraduate students enrolled between the 2008/2009 and 2018/2019 academic years across 17 bachelor's programs (Agronomy, Nursing, Informatics Engineering, Design, Social Service, Management, Journalism, Basic Education, etc.) at the Polytechnic Institute of Portalegre.

## 4. Preprocessing, Cleaning & Data Quality Audit
Aligned with [Datasheets for Datasets (Preprocessing/Cleaning/Labeling)](https://cacm.acm.org/research/datasheets-for-datasets/), [Google Data Cards Playbook (Transformations)](https://sites.research.google/datacardsplaybook/), and [OTDI Completeness Criteria](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Upstream Transformations & Standardization:** Derived from the official [UCI CSV export (`id=697`)](https://archive.ics.uci.edu/static/public/697/data.csv) (`495,639` bytes) with only the invisible 3-byte UTF-8 Byte Order Mark (`\xef\xbb\xbf`) stripped from byte 0 so `Marital Status` matches ASCII headers cleanly. Note that UCI's upstream CSV already normalized the raw zip's semicolon delimiter and trailing tab in `Daytime/evening attendance`.
- **Missing Data Profile:**
  - **Explicit Missingness:** `stats.hasMissingValues` is **`false`** (`0` explicit missing cells across all 4,424 rows and 37 columns when parsed with tokens `""`, `"NA"`, `"NaN"`).
  - **Disguised / Implicit Missingness:** Domain-invalid sentinel values or unrecorded category tokens are explicitly annotated in `columns[].implicitMissingValues` for: `Mother's qualification` (`34`), `Father's qualification` (`34`), `Mother's occupation` (`99`), `Father's occupation` (`99`).
- **Known Formatting & Modeling Traps:** Three subtle traps make this dataset richly educational: (1) **Integer-coded nominal categories** (`Course` codes like `33` vs. `9991` and `Application mode` codes `1`–`57`) have zero numeric magnitude meaning and must be treated as `categorical`; (2) **Disguised administrative unknowns** (`34` = Unknown in `Mother's qualification` [130] and `Father's qualification` [112]; `99` = blank in `Mother's occupation` [17] and `Father's occupation` [19]) are documented in `implicitMissingValues`; and (3) **Temporal deployment horizon**: if a university wants to identify at-risk students **on Day 1 of enrollment**, learners must uncheck the 12 `Curricular units 1st/2nd sem (*)` columns!

## 5. Recommended Uses & Fit-for-Purpose Guidance
Aligned with [Datasheets for Datasets (Uses)](https://cacm.acm.org/research/datasheets-for-datasets/), [Google Data Cards Playbook (Usage Guidance)](https://sites.research.google/datacardsplaybook/), and [Hugging Face Supported Tasks](https://huggingface.co/docs/hub/en/datasets-cards).

- **Recommended Pedagogical Classification Workflows:** Compare **enrollment-only models** (unchecking 1st/2nd semester curricular columns) against **end-of-year-1 models** across **Multinomial Logistic Regression**, **Decision Trees**, and **Random Forests**. Evaluate with **3x3 Confusion Matrices**, **Macro-F1**, **Per-Class Recall (especially `Dropout` recall)**, and **Subgroup Error-Rate Audits**.
- **Out-of-Scope & Inappropriate Uses:** Must NEVER be used for admissions gatekeeping, scholarship revocation, or automated academic dismissal; designed solely for supportive pedagogical tutoring allocation.

## 6. Ethical Considerations, Privacy & Fairness Analysis
Aligned with [Hugging Face Considerations for Using the Data](https://huggingface.co/docs/hub/en/datasets-cards), [Google Data Cards Playbook (Human Attributes & Sensitive Data)](https://sites.research.google/datacardsplaybook/), and [OTDI Privacy/PII Requirements](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Sensitive & Protected Attributes:**
  - **`Marital Status`** (`categorical`): Legal civil marital status of the student at enrollment. Coded as: `1` = Single, `2` = Married, `3` = Widower, `4` = Divorced, `5` = De facto union, `6` = Legally separated.
  - **`Nacionality`** (`categorical`): Student citizenship code (spelled 'Nacionality' in upstream UCI schema; 1 = Portuguese [97.5%], other codes denote Lusophone, EU, and Latin American nationalities). Coded as: `1` = Portuguese, `2` = German, `6` = Spanish, `11` = Italian, `13` = Dutch, `14` = English, `17` = Lithuanian, `21` = Angolan, `22` = Cape Verdean, `24` = Guinean, `25` = Mozambican, `26` = Santomean, `32` = Turkish, `41` = Brazilian, `62` = Romanian, `100` = Moldovan, `101` = Mexican, `103` = Ukrainian, `105` = Russian, `108` = Cuban, `109` = Colombian.
  - **`Displaced`** (`boolean`): Whether the student had to relocate away from their permanent family residence to attend the institution. Coded as: `0` = No, `1` = Yes (Relocated from home region).
  - **`Educational special needs`** (`boolean`): Indicator of registered disability or special educational accommodation status (only 51 students [1.15%], illustrating small-subgroup fairness auditing challenges). Coded as: `0` = No, `1` = Yes (Special educational needs).
  - **`Debtor`** (`boolean`): Socioeconomic vulnerability indicator of unpaid institutional debt (dropout rate is 62.0% among debtors vs. 28.3% among non-debtors). Coded as: `0` = No, `1` = Yes.
  - **`Gender`** (`boolean`): Administrative binary gender record (graduation rate is 57.9% for women [0] vs. 35.2% for men [1]). Coded as: `0` = Female, `1` = Male.
  - **`Scholarship holder`** (`boolean`): Whether the student receives social-action financial aid (SAS scholarship; graduation rate is 76.0% for holders vs. 41.3% for non-holders). Coded as: `0` = No, `1` = Yes.
  - **`Age at enrollment`** (`numeric`): Student age in years upon initial program enrollment.
  - **`International`** (`boolean`): Whether the student enrolled under international student status. Coded as: `0` = Domestic, `1` = International.
- **Privacy & PII Assessment:** Fully de-identified institutional records stripped of student IDs, names, and exact birthdates; conforms to GDPR anonymization standards documented by [Realinho et al. (2022)](https://www.mdpi.com/2306-5729/7/11/146).
- **Documented Biases & Representational Harms:** Empirical outcome disparities in `data.csv` are profound: tuition **Debtors** (`n = 503`) experience a **62.0% dropout rate** (`312/503`) vs. **28.3%** (`1,109/3,921`) for non-debtors; **Scholarship holders** (`n = 1,099`) graduate at **76.0%** vs. **41.3%** for non-holders; **Male students** (`Gender = 1`, `n = 1,556`) drop out at **45.1%** (graduating at 35.2%) vs. **25.1%** dropout (57.9% graduation) among **Female students** (`Gender = 0`, `n = 2,868`). Meanwhile, students with **Educational special needs** (`n = 51`, 1.15%) and **International** students (`n = 110`, 2.5%) illustrate small-sample minority representation risk ([Simson et al., 2024](https://doi.org/10.1145/3630106.3658931)).
- **Recommended Fairness Audits:** Inspect **Dropout False Positive Rate** (stigma/mislabeling risk) and **Dropout False Negative Rate** (missed tutoring support) across `Gender`, `Debtor`, `Scholarship holder`, `Displaced`, `Age at enrollment` (`<= 20` vs. `> 20`), and `Educational special needs`.

## 7. Distribution, Licensing & Maintenance
Aligned with [Datasheets for Datasets (Distribution & Maintenance)](https://cacm.acm.org/research/datasheets-for-datasets/) and [OTDI Open Licensing Requirements](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **License & Redistribution Terms:** Distributed under **[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)** (SPDX identifier: `cc-by-4.0`). All open redistribution and attribution requirements have been verified for bundling inside client-side educational repositories (including Apache 2.0-licensed open-source releases).
- **Maintenance & Versioning:** Published open-access in MDPI Data and archived at [UCI ID 697 (DOI `10.24432/C5MC89`)](https://archive.ics.uci.edu/dataset/697/predict+students+dropout+and+academic+success) under **CC BY 4.0**, permitting unrestricted Apache 2.0 redistribution with attribution.

## 8. Sources, Public Dataset Cards & Academic References
Full linked attribution to every public dataset card, upstream repository, transparency standard, and peer-reviewed study consulted during the creation of this Dataset Card.

- **Public Dataset Cards, Repositories & Standards Consulted:**
  - [UCI Machine Learning Repository: Predict Students' Dropout and Academic Success (ID 697)](https://archive.ics.uci.edu/dataset/697/predict+students+dropout+and+academic+success) — Verified all 37 variable definitions, Portuguese contingent/course/nationality codebooks, funding grant, and CC BY 4.0 license.
  - [MDPI Data Descriptor: Realinho et al. (2022)](https://www.mdpi.com/2306-5729/7/11/146) — Verified cohort timeline (2008-2019), GDPR anonymization steps, and 80/20 benchmark protocol.
  - [Hugging Face Dataset Cards Documentation](https://huggingface.co/docs/hub/en/datasets-cards) — Structural hierarchy and YAML frontmatter conventions.
  - [Datasheets for Datasets (Gebru et al., 2021)](https://cacm.acm.org/research/datasheets-for-datasets/) — Lifecycle motivation, composition, collection, preprocessing, uses, distribution, and maintenance dimensions.
  - [Google Research Data Cards Playbook (Pushkarna et al., 2022)](https://sites.research.google/datacardsplaybook/) — Purpose, provenance, human attributes, transformations, and fit-for-purpose guidance.
  - [AI Alliance Open Trusted Data Initiative (OTDI) Dataset Specification](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/) — Verifiable lineage, open licensing, PII risk assessment, and zero-drift metadata synchronization.
- **Seminal Papers & Fairness Audits:**
  - [Predicting Student Dropout and Academic Success](https://www.mdpi.com/2306-5729/7/11/146) — Valentim Realinho, Jorge Machado, Luis Baptista, Monica V. Martins (2022) [`seminal-paper`]. Realinho, V., Machado, J., Baptista, L., & Martins, M. V. (2022). Predicting student dropout and academic success. Data, 7(11), 146. https://doi.org/10.3390/data7110146
  - [Bias and Unfairness in Machine Learning Models: A Systematic Review on Datasets, Tools, Fairness Metrics, and Identification and Mitigation Methods](https://doi.org/10.3390/bdcc7010015) — Tiago P. Pagano, Rafael B. Loureiro, Fernanda V. N. Lisboa, Erick G. S. Nascimento (2023) [`fairness-audit`]. Pagano, T. P., et al. (2023). Bias and unfairness in machine learning models: A systematic review on datasets, tools, fairness metrics, and identification and mitigation methods. Big Data and Cognitive Computing, 7(1), 15. https://doi.org/10.3390/bdcc7010015
  - [UCI Machine Learning Repository: Predict Students' Dropout and Academic Success](https://archive.ics.uci.edu/dataset/697/predict+students+dropout+and+academic+success) — Valentim Realinho, Monica Vieira Martins, Jorge Machado, Luis Baptista (2021) [`documentation`]. Realinho, V., Vieira Martins, M., Machado, J., & Baptista, L. (2021). Predict Students' Dropout and Academic Success [Dataset]. UCI Machine Learning Repository. https://doi.org/10.24432/C5MC89
