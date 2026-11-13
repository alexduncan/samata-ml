---
pretty_name: 'Adult Census Income'
task_categories:
    - tabular-classification
task_ids:
    - 'binary-classification'
license: 'cc-by-4.0'
size_categories:
    - '10K<n<100K'
source_datasets:
    - 'uci/adult (id=2)'
tags:
    - 'social-science'
    - 'advanced'
    - 'binary'
    - 'missing-values'
    - 'intersectional-fairness'
    - 'census'
    - 'threshold-bias'
---

# Adult Census Income

**Domain:** Social Science | **Difficulty:** Advanced | **Task:** Binary Classification | **Rows:** 32,561 | **Columns:** 15 | **CSV Size:** 3,551,168 bytes | **License:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

## 1. Dataset Summary & Motivation

Aligned with [Hugging Face Dataset Summary](https://huggingface.co/docs/hub/en/datasets-cards), [Datasheets for Datasets (Motivation)](https://cacm.acm.org/research/datasheets-for-datasets/), and [Google Data Cards Playbook (Purpose & Intentionality)](https://sites.research.google/datacardsplaybook/).

- **Overview:** The Adult Census Income dataset (`32,561` canonical training records across `15` attributes) predicts whether an individual's annual gross income in 1994 exceeded `$50,000` USD (`>50K`: `7,841` [24.08%] vs. `<=50K`: `24,720` [75.92%]). Appearing in well over 300 fairness publications, it is the foundational benchmark of algorithmic fairness research ([Ding et al., 2021](https://arxiv.org/abs/2108.04884); [Fabris et al., 2022](https://doi.org/10.1007/s10618-022-00854-z)).
- **Original Purpose & Creators:** Extracted from the 1994 US Census Bureau Current Population Survey (CPS) Annual Social and Economic (March) Supplement by Barry Becker (Silicon Graphics) and donated to UCI in 1996 by Ronny Kohavi to benchmark scalable hybrid Naive-Bayes/Decision-Tree (`NBTree`) classifiers ([Kohavi, 1996](https://dl.acm.org/doi/10.5555/3001460.3001502)).
- **Benchmark & Pedagogical Significance:** Adult Census is indispensable both as a technical preprocessing exercise—teaching `?` / `' ?'` missing-value handling, survey-weight exclusion (`fnlwgt`), bijective feature redundancy (`education` vs. `education-num`), and zero-inflated/top-coded capital gains (`99999`)—and as a **critical data studies case study** through [Ding et al.'s (2021) 'Retiring Adult'](https://arxiv.org/abs/2108.04884) and [Simson et al.'s (2024) 'Lazy Data Practices'](https://doi.org/10.1145/3630106.3658931).

## 2. Dataset Structure & Composition

Aligned with [Hugging Face Dataset Structure](https://huggingface.co/docs/hub/en/datasets-cards), [Datasheets for Datasets (Composition)](https://cacm.acm.org/research/datasheets-for-datasets/), and [OTDI Quality Metrics](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Unit of Observation:** One civilian US resident aged 17 or older working positive hours in the 1994 Current Population Survey.
- **File & Parsing Specification:** Packaged at `/public/datasets/adult-census/data.csv` (`3,551,168` bytes, `32,561` rows, `15` columns, delimiter `","`, `hasHeader: true`).
- **Classification Target(s) & Class Distribution:**
    - **Default Target:** `income` (`binary-classification`). Positive class is encoded as `>50K`. Exact class distribution in `data.csv`: `<=50K` ($50,000 or less per year): **24,720** (75.92%); `>50K` (More than $50,000 per year): **7,841** (24.08%).
    - **Alternative Classification Target(s):**
    - None configured (all non-target attributes are continuous predictors or identifiers/leakage controls; continuous regression targets are excluded in Phase 1).
- **Excluded Columns (Identifiers, Redundancy & Leakage Controls):**
    - **`fnlwgt`** (`semanticRole: "identifier"`, `defaultSelected: false`): Census survey sampling weight rather than a personal predictor; standard fair-ML protocols exclude 'fnlwgt' (Le Quy et al., 2022).
    - **`education-num`** (`semanticRole: "feature"`, `defaultSelected: false`): Bijective numeric encoding of 'education'; select either 'education' or 'education-num' rather than both.
- **Complete Feature Schema (`columns[]` synchronized with `metadata.json`):**

| #   | Column (`name`)  | Display Name              | Type          | Role         | Default | Unit         | Missing | Implicit Missing / Coded Labels                                                                                                                            |
| --- | ---------------- | ------------------------- | ------------- | ------------ | ------- | ------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `age`            | Age                       | `numeric`     | `sensitive`  | Yes     | `years`      | 0       | Top-coded at `90`                                                                                                                                          |
| 2   | `workclass`      | Work Class                | `categorical` | `feature`    | Yes     | —            | 1,836   | Employment sector classification (Private, Self-employed, Federal/State/Local government; 1,836 missing '?' values).                                       |
| 3   | `fnlwgt`         | CPS Final Survey Weight   | `numeric`     | `identifier` | No      | —            | 0       | Census Bureau demographic stratum weight estimating how many US civilians the record represents; NOT a personal attribute.                                 |
| 4   | `education`      | Highest Education         | `categorical` | `feature`    | Yes     | —            | 0       | Highest completed educational level (16 categories from Preschool to Doctorate).                                                                           |
| 5   | `education-num`  | Education Years (Ordinal) | `numeric`     | `feature`    | No      | `years-tier` | 0       | Exact 1-to-16 integer mapping of 'education'; unchecked by default when 'education' is active to prevent redundant encoding.                               |
| 6   | `marital-status` | Marital Status            | `categorical` | `feature`    | Yes     | —            | 0       | Detailed civil and spousal marital status (strongly correlated with household role and gender).                                                            |
| 7   | `occupation`     | Occupation                | `categorical` | `feature`    | Yes     | —            | 1,843   | Broad US Census occupational category (1,843 missing '?' values).                                                                                          |
| 8   | `relationship`   | Household Relationship    | `categorical` | `feature`    | Yes     | —            | 0       | Respondent's relationship to the Census householder ('Husband' and 'Wife' act as strong proxies for 'sex').                                                |
| 9   | `race`           | Race                      | `categorical` | `sensitive`  | Yes     | —            | 0       | 1994 US Census racial classification (>50K rate is 25.6% for White and 26.6% for Asian-Pac-Islander vs. 12.4% for Black and 11.6% for Amer-Indian-Eskimo). |
| 10  | `sex`            | Sex                       | `categorical` | `sensitive`  | Yes     | —            | 0       | Recorded binary sex (>50K positive-label prevalence is 30.6% for Male vs. 10.9% for Female).                                                               |
| 11  | `capital-gain`   | Capital Gains             | `numeric`     | `feature`    | Yes     | `USD`        | 0       | Top-coded at `99999`                                                                                                                                       |
| 12  | `capital-loss`   | Capital Losses            | `numeric`     | `feature`    | Yes     | `USD`        | 0       | Annual realized investment capital losses in 1994 USD.                                                                                                     |
| 13  | `hours-per-week` | Hours Worked per Week     | `numeric`     | `feature`    | Yes     | `hours/week` | 0       | Reported usual weekly working hours (top-coded at 99).                                                                                                     |
| 14  | `native-country` | Native Country            | `categorical` | `sensitive`  | Yes     | —            | 583     | Country of birth across 41 countries/territories (89.6% United-States; 583 missing '?' values).                                                            |
| 15  | `income`         | Annual Income Tier        | `categorical` | `target`     | No      | —            | 0       | Labels: `<=50K`=$50,000 or less per year; `>50K`=More than $50,000 per year                                                                                |

## 3. Provenance, Collection Process & Sampling Frame

Aligned with [Datasheets for Datasets (Collection Process)](https://cacm.acm.org/research/datasheets-for-datasets/), [Google Data Cards Playbook (Provenance & Upstream Sources)](https://sites.research.google/datacardsplaybook/), and [OTDI Verifiable Lineage](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Upstream Lineage:** Originated in **1996** by Barry Becker, Ronny Kohavi. Canonical dataset homepage: [Adult Census Income Canonical Homepage](https://archive.ics.uci.edu/dataset/2/adult); upstream raw data source: [Upstream Source Repository](https://archive.ics.uci.edu/ml/machine-learning-databases/adult/adult.data).
- **Acquisition Method:** Collected by US Census Bureau field interviewers via household computer-assisted telephone and in-person interviews for the March 1994 CPS Annual Demographic File.
- **Population & Sampling Frame:** Filtered by Barry Becker from the 1994 US CPS using `((AAGE>16) && (AGI>100) && (AFNLWGT>1) && (HRSWK>0))`—restricting the universe to employed/earner civilians in the United States in 1994 and excluding unpaid caregivers, unemployed workers, and low/zero AGI respondents.

## 4. Preprocessing, Cleaning & Data Quality Audit

Aligned with [Datasheets for Datasets (Preprocessing/Cleaning/Labeling)](https://cacm.acm.org/research/datasheets-for-datasets/), [Google Data Cards Playbook (Transformations)](https://sites.research.google/datacardsplaybook/), and [OTDI Completeness Criteria](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Upstream Transformations & Standardization:** Standardized (`3,551,168` bytes, `< 5 MB`) from UCI's canonical `adult.data` (`32,561` rows) by prepending official hyphenated UCI column names (`marital-status`, `education-num`, etc.—avoiding R dot-separated artifacts like `marital.status`), trimming leading delimiter spaces so `' <=50K'` normalizes cleanly to `'<=50K'`, preserving `'?'` tokens (`missingValueTokens: ['', 'NA', '?', ' ?']`), and avoiding UCI's combined `adult.test` trailing-period bug (`'<=50K.'`).
- **Missing Data Profile:**
    - **Explicit Missingness:** `stats.hasMissingValues` is **`true`** with **4,262** explicit missing cells across 3 column(s): `workclass` (1,836 missing, 5.64%), `occupation` (1,843 missing, 5.66%), `native-country` (583 missing, 1.79%). Browser CSV parsing treats `""`, `"NA"`, `"?"`, `" ?"` as missing (`null`/`NaN`).
    - **Disguised / Implicit Missingness:** None. `age` (`90`) and `capital-gain` (`99999`) are top-codes, not missing values, so they stay in the data.
- **Known Formatting & Modeling Traps:** Four classic pitfalls: (1) `fnlwgt` is a **CPS geographic/demographic sampling weight**, NOT an individual attribute (`semanticRole: 'identifier'`, unchecked by default per [Le Quy et al., 2022](https://wires.onlinelibrary.wiley.com/doi/10.1002/widm.1452)); (2) `education-num` (`1..16`) is a 1-to-1 numeric bijection of `education` (unchecked by default to avoid collinearity); (3) `4,262` explicit `'?'` values occur across `workclass` (`1,836`), `occupation` (`1,843`), and `native-country` (`583`) across `2,399` incomplete rows; and (4) `capital-gain` right-censors high earners at sentinel `99999` (`159` rows) and `age` top-codes at `90` (`43` rows), kept as values.

## 5. Recommended Uses & Fit-for-Purpose Guidance

Aligned with [Datasheets for Datasets (Uses)](https://cacm.acm.org/research/datasheets-for-datasets/), [Google Data Cards Playbook (Usage Guidance)](https://sites.research.google/datacardsplaybook/), and [Hugging Face Supported Tasks](https://huggingface.co/docs/hub/en/datasets-cards).

- **Recommended Pedagogical Classification Workflows:** Train **Logistic Regression**, **Naive Bayes**, **Decision Trees**, and **Random Forests**. Compare **mode imputation vs. 'Missing' category encoding** on `workclass`/`occupation`, test **Fairness Through Unawareness** (unchecking `sex` and `race` while observing how `relationship` = `'Husband'`/`'Wife'` reconstructs gender!), and evaluate **Accuracy**, **F1-score**, **ROC-AUC**, **Statistical Parity Difference**, and **Equalized Odds** ([Raftopoulos et al., 2025](https://doi.org/10.3390/a18070435)).
- **Out-of-Scope & Inappropriate Uses:** Reflects 1994 US wage structures and a contrivance-prone `$50,000` binarization; never appropriate for modern compensation, lending, or socioeconomic eligibility modeling.

## 6. Ethical Considerations, Privacy & Fairness Analysis

Aligned with [Hugging Face Considerations for Using the Data](https://huggingface.co/docs/hub/en/datasets-cards), [Google Data Cards Playbook (Human Attributes & Sensitive Data)](https://sites.research.google/datacardsplaybook/), and [OTDI Privacy/PII Requirements](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Sensitive & Protected Attributes:**
    - **`age`** (`numeric`): Individual's age in years (filtered to age > 16; top-coded at 90 in the 1994 CPS).
    - **`race`** (`categorical`): 1994 US Census racial classification (>50K rate is 25.6% for White and 26.6% for Asian-Pac-Islander vs. 12.4% for Black and 11.6% for Amer-Indian-Eskimo).
    - **`sex`** (`categorical`): Recorded binary sex (>50K positive-label prevalence is 30.6% for Male vs. 10.9% for Female).
    - **`native-country`** (`categorical`): Country of birth across 41 countries/territories (89.6% United-States; 583 missing '?' values).
- **Privacy & PII Assessment:** Public-use Census microdata subjected to Census Bureau disclosure avoidance (top-coding `capital-gain` at `99999` and `age` at `90`, geographic suppression); zero direct PII.
- **Documented Biases & Representational Harms:** In `data.csv`, **30.6%** of Male respondents (`6,662/21,790`) earn `>50K` vs. **10.9%** of Female respondents (`1,179/10,771`), and `>50K` prevalence spans **26.6%** (`Asian-Pac-Islander`) and **25.6%** (`White`) down to **12.4%** (`Black`), **11.6%** (`Amer-Indian-Eskimo`), and **9.2%** (`Other`). Crucially, [Ding et al. (2021)](https://arxiv.org/abs/2108.04884) proved that `$50,000` in 1994 sat at the **76th income percentile overall**, the **88th percentile among Black workers**, and the **89th percentile among women**, artificially inflating measured fairness trade-offs. Meanwhile, [Simson et al. (2024)](https://doi.org/10.1145/3630106.3658931) warn against collapsing minority racial groups into a coarse `White vs. Non-White` binary (which masks `Asian-Pac-Islander` vs. `Black`/`Amer-Indian-Eskimo` divergence).
- **Recommended Fairness Audits:** Audit **Selection Rate**, **True Positive Rate**, and **False Positive Rate** across all five disaggregated `race` categories, `sex`, `age`, and **intersectional subgroups** (`Black Female` vs. `White Male`; [Duong & Conrad, 2024](https://arxiv.org/abs/2405.19300)).

## 7. Distribution, Licensing & Maintenance

Aligned with [Datasheets for Datasets (Distribution & Maintenance)](https://cacm.acm.org/research/datasheets-for-datasets/) and [OTDI Open Licensing Requirements](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **License & Redistribution Terms:** Distributed under **[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)** (SPDX identifier: `cc-by-4.0`). All open redistribution and attribution requirements have been verified for bundling inside client-side educational repositories (including Apache 2.0-licensed open-source releases).
- **Maintenance & Versioning:** Static archival UCI benchmark (`id=2`, DOI `10.24432/C5XW20`, **CC BY 4.0**, derived from public-domain US Census CPS microdata), fully compatible with Apache 2.0 redistribution.

## 8. Sources, Public Dataset Cards & Academic References

Full linked attribution to every public dataset card, upstream repository, transparency standard, and peer-reviewed study consulted during the creation of this Dataset Card.

- **Public Dataset Cards, Repositories & Standards Consulted:**
    - [UCI Machine Learning Repository: Adult (ID 2)](https://archive.ics.uci.edu/dataset/2/adult) — Verified Becker's 1994 CPS extraction filter, hyphenated attribute schema, and CC BY 4.0 license.
    - [Retiring Adult Documentation & Critique (Ding et al., 2021)](https://arxiv.org/abs/2108.04884) — Incorporated CPS quantile threshold analysis and external-validity limitations.
    - [Hugging Face Hub: scikit-learn/adult-census-income](https://huggingface.co/datasets/scikit-learn/adult-census-income) — Cross-checked 32,561 training row counts, missing '?' frequencies, and class distribution (24,720 <=50K, 7,841 >50K).
    - [Hugging Face Dataset Cards Documentation](https://huggingface.co/docs/hub/en/datasets-cards) — Structural hierarchy and YAML frontmatter conventions.
    - [Datasheets for Datasets (Gebru et al., 2021)](https://cacm.acm.org/research/datasheets-for-datasets/) — Lifecycle motivation, composition, collection, preprocessing, uses, distribution, and maintenance dimensions.
    - [Google Research Data Cards Playbook (Pushkarna et al., 2022)](https://sites.research.google/datacardsplaybook/) — Purpose, provenance, human attributes, transformations, and fit-for-purpose guidance.
    - [AI Alliance Open Trusted Data Initiative (OTDI) Dataset Specification](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/) — Verifiable lineage, open licensing, PII risk assessment, and zero-drift metadata synchronization.
- **Seminal Papers & Fairness Audits:**
    - [Scaling Up the Accuracy of Naive-Bayes Classifiers: A Decision-Tree Hybrid](https://dl.acm.org/doi/10.5555/3001460.3001502) — Ron Kohavi (1996) [`seminal-paper`]. Kohavi, R. (1996). Scaling up the accuracy of Naive-Bayes classifiers: A decision-tree hybrid. Proceedings of the Second International Conference on Knowledge Discovery and Data Mining (KDD-96), 202-207.
    - [Retiring Adult: New Datasets for Fair Machine Learning](https://arxiv.org/abs/2108.04884) — Frances Ding, Moritz Hardt, John Miller, Ludwig Schmidt (2021) [`fairness-audit`]. Ding, F., Hardt, M., Miller, J., & Schmidt, L. (2021). Retiring Adult: New datasets for fair machine learning. Advances in Neural Information Processing Systems (NeurIPS), 34, 6478-6490.
    - [Lazy Data Practices Harm Fairness Research](https://doi.org/10.1145/3630106.3658931) — Jan Simson, Alessandro Fabris, Christoph Kern (2024) [`fairness-audit`]. Simson, J., Fabris, A., & Kern, C. (2024). Lazy data practices harm fairness research. Proceedings of the 2024 ACM Conference on Fairness, Accountability, and Transparency (FAccT '24), 642-666. https://doi.org/10.1145/3630106.3658931
    - [Measuring and Mitigating Bias for Tabular Datasets with Multiple Protected Attributes](https://arxiv.org/abs/2405.19300) — Manh Khoi Duong, Stefan Conrad (2024) [`fairness-audit`]. Duong, M. K., & Conrad, S. (2024). Measuring and mitigating bias for tabular datasets with multiple protected attributes. Proceedings of the 2nd Workshop on Fairness and Bias in AI (AEQUITAS 2024, ECAI), CEUR Vol. 3808. https://arxiv.org/abs/2405.19300
