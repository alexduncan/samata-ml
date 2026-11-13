---
pretty_name: "German Credit Risk"
task_categories:
  - tabular-classification
task_ids:
  - "binary-classification"
  - "multiclass-classification"
license: "cc-by-4.0"
size_categories:
  - "1K<n<10K"
source_datasets:
  - "uci/statlog-german-credit-data (id=144) / openml/credit-g (id=31)"
tags:
  - "finance"
  - "intermediate"
  - "binary"
  - "credit-scoring"
  - "cost-sensitive"
  - "documentation-debt"
  - "fairness-classic"
---

# German Credit Risk

**Domain:** Finance | **Difficulty:** Intermediate | **Task:** Binary Classification | **Rows:** 1,000 | **Columns:** 21 | **CSV Size:** 140,017 bytes | **License:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

## 1. Dataset Summary & Motivation
Aligned with [Hugging Face Dataset Summary](https://huggingface.co/docs/hub/en/datasets-cards), [Datasheets for Datasets (Motivation)](https://cacm.acm.org/research/datasheets-for-datasets/), and [Google Data Cards Playbook (Purpose & Intentionality)](https://sites.research.google/datacardsplaybook/).

- **Overview:** The German Credit Risk dataset contains 1,000 consumer loan records—700 `good` (compliant repayment, 70.0%) and 300 `bad` (defaulted or non-compliant, 30.0%)—described by 20 financial, employment, collateral, and demographic predictors. Together with Adult Census and COMPAS, it forms the canonical 'Big Three' benchmark suite in algorithmic fairness research ([Fabris et al., 2022](https://doi.org/10.1007/s10618-022-00854-z)).
- **Original Purpose & Creators:** Originally compiled from 1973-1975 Southern German regional bank credit files (`Kreditscoring`) and donated in English symbolic form by Prof. Hans Hofmann (Universitaet Hamburg) to the European ESPRIT StatLog project and the [UCI Machine Learning Repository (`id=144`)](https://archive.ics.uci.edu/dataset/144/statlog+german+credit+data) in 1994.
- **Benchmark & Pedagogical Significance:** German Credit teaches three foundational lessons: (1) **clean categorical encoding** (our 21-column OpenML `credit-g` table avoids the notorious 62-column pre-dummified R `caret` export); (2) **cost-sensitive classification** (Hofmann's original 5:1 asymmetric cost matrix penalizes lending to a defaulting borrower five times more heavily than turning away a creditworthy borrower); and (3) **critical dataset archaeology and documentation debt** via [Ulrike Groemping's (2019) audit](https://www1.beuth-hochschule.de/FB_II/reports/Report-2019-004.pdf).

## 2. Dataset Structure & Composition
Aligned with [Hugging Face Dataset Structure](https://huggingface.co/docs/hub/en/datasets-cards), [Datasheets for Datasets (Composition)](https://cacm.acm.org/research/datasheets-for-datasets/), and [OTDI Quality Metrics](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Unit of Observation:** One individual consumer or small-business bank loan application in West Germany (1973-1975).
- **File & Parsing Specification:** Packaged at `/public/datasets/german-credit/data.csv` (`140,017` bytes, `1,000` rows, `21` columns, delimiter `","`, `hasHeader: true`).
- **Classification Target(s) & Class Distribution:**
  - **Default Target:** `class` (`binary-classification`). Positive class is encoded as `good`. Exact class distribution in `data.csv`: `bad` (Bad credit risk (Default / non-compliant)): **300** (30.00%); `good` (Good credit risk (Creditworthy)): **700** (70.00%).
  - **Alternative Classification Target(s):**
  - `housing` (`multiclass-classification`): Predict applicant housing tenure ('own', 'rent', or 'for free') from financial and demographic attributes.
- **Excluded Columns (Identifiers, Redundancy & Leakage Controls):**
  - Only the classification target column (`class`) has `defaultSelected: false`; no identifier or post-outcome leaky predictor columns are present in `data.csv`.
- **Complete Feature Schema (`columns[]` synchronized with `metadata.json`):**

| # | Column (`name`) | Display Name | Type | Role | Default | Unit | Missing | Implicit Missing / Coded Labels |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `checking_status` | Checking Account Status | `categorical` | `feature` | Yes | — | 0 | Labels: `<0`=Negative balance (< 0 DM); `0<=X<200`=Modest balance (0 to < 200 DM); `>=200`=High balance (>= 200 DM or salary assignment); `no checking`=No checking account with bank |
| 2 | `duration` | Loan Duration | `numeric` | `feature` | Yes | `months` | 0 | Contractual repayment duration of the requested credit in months. |
| 3 | `credit_history` | Credit History | `categorical` | `feature` | Yes | — | 0 | Applicant's prior credit repayment compliance record. |
| 4 | `purpose` | Loan Purpose | `categorical` | `feature` | Yes | — | 0 | Stated consumer or business purpose for the credit application. |
| 5 | `credit_amount` | Credit Amount | `numeric` | `feature` | Yes | `DM` | 0 | Principal loan amount requested in 1973-1975 Deutsche Mark (DM). |
| 6 | `savings_status` | Savings Account / Bonds | `categorical` | `feature` | Yes | — | 0 | Balance tier in savings accounts or bonds in Deutsche Mark (DM). |
| 7 | `employment` | Employment Tenure | `categorical` | `feature` | Yes | — | 0 | Duration of current continuous employment in years. |
| 8 | `installment_commitment` | Installment Rate Tier | `categorical` | `feature` | Yes | — | 0 | Labels: `1`=Tier 1 (>= 35% of disposable income); `2`=Tier 2 (25% to < 35% of disposable income); `3`=Tier 3 (20% to < 25% of disposable income); `4`=Tier 4 (< 20% of disposable income) |
| 9 | `personal_status` | Personal Status & Sex (Legacy) | `categorical` | `sensitive` | Yes | — | 0 | Joint marital status and sex attribute; Groemping (2019) proved that legacy StatLog labels misassigned sex across codes (e.g., 'female div/dep/mar' actually mixed non-single women with single men). |
| 10 | `other_parties` | Other Debtors / Guarantors | `categorical` | `feature` | Yes | — | 0 | Presence of a co-applicant or loan guarantor. |
| 11 | `residence_since` | Residence Tenure | `categorical` | `feature` | Yes | — | 0 | Labels: `1`=< 1 year; `2`=1 to < 4 years; `3`=4 to < 7 years; `4`=>= 7 years |
| 12 | `property_magnitude` | Highest-Value Property | `categorical` | `feature` | Yes | — | 0 | Most valuable collateral asset owned by the applicant. |
| 13 | `age` | Age | `numeric` | `sensitive` | Yes | `years` | 0 | Applicant age in years (primary reliable protected attribute; good-credit rate is 57.9% for age <= 25 vs. 72.8% for age > 25). |
| 14 | `other_payment_plans` | Other Installment Plans | `categorical` | `feature` | Yes | — | 0 | Concurrent installment credit obligations with other banks or retail stores. |
| 15 | `housing` | Housing Tenure | `categorical` | `feature` | Yes | — | 0 | Current residential housing arrangement ('own', 'rent', or 'for free'). |
| 16 | `existing_credits` | Existing Credits at Bank | `numeric` | `feature` | Yes | — | 0 | Ordinal count tier (1 to 4) of existing loans held at this bank. |
| 17 | `job` | Employment Qualification | `categorical` | `feature` | Yes | — | 0 | Occupational skill and residency category. |
| 18 | `num_dependents` | Number of Dependents | `categorical` | `feature` | Yes | — | 0 | Labels: `1`=0 to 2 dependents; `2`=3 or more dependents |
| 19 | `own_telephone` | Registered Telephone | `boolean` | `feature` | Yes | — | 0 | Labels: `none`=No registered telephone; `yes`=Yes (registered under customer name) |
| 20 | `foreign_worker` | Foreign Worker Status | `boolean` | `sensitive` | Yes | — | 0 | Labels: `no`=No; `yes`=Yes |
| 21 | `class` | Credit Risk Classification | `categorical` | `target` | No | — | 0 | Labels: `bad`=Bad credit risk (Default / non-compliant); `good`=Good credit risk (Creditworthy) |

## 3. Provenance, Collection Process & Sampling Frame
Aligned with [Datasheets for Datasets (Collection Process)](https://cacm.acm.org/research/datasheets-for-datasets/), [Google Data Cards Playbook (Provenance & Upstream Sources)](https://sites.research.google/datacardsplaybook/), and [OTDI Verifiable Lineage](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Upstream Lineage:** Originated in **1994** by Hans Hofmann. Canonical dataset homepage: [German Credit Risk Canonical Homepage](https://archive.ics.uci.edu/dataset/144/statlog+german+credit+data); upstream raw data source: [Upstream Source Repository](https://www.openml.org/d/31).
- **Acquisition Method:** Extracted by bank credit officers from paper loan dossiers and repayment ledgers at a Southern German retail bank between 1973 and 1975 ([Groemping, 2019](https://www1.beuth-hochschule.de/FB_II/reports/Report-2019-004.pdf)).
- **Population & Sampling Frame:** Stratified case-control sample of 1,000 granted loans in 1973-1975 West Germany in which **bad loans were heavily oversampled** to 30.0% (compared to ~5% actual bank default prevalence) to aid discriminant analysis—and applicants denied credit upfront were never observed (reject-inference selection bias).

## 4. Preprocessing, Cleaning & Data Quality Audit
Aligned with [Datasheets for Datasets (Preprocessing/Cleaning/Labeling)](https://cacm.acm.org/research/datasheets-for-datasets/), [Google Data Cards Playbook (Transformations)](https://sites.research.google/datacardsplaybook/), and [OTDI Completeness Criteria](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Upstream Transformations & Standardization:** Standardized (`140,017` bytes) from [OpenML Dataset 31 (`credit-g`)](https://www.openml.org/d/31) into clean RFC 4180 CSV by stripping legacy Weka ARFF single-quote wrappers (`'<0'` -> `<0`) while preserving exact attribute names (`checking_status` through `class`) used in [Hirzel & Feffer (2023)](https://arxiv.org/abs/2308.00133) and [FairGround (Simson et al., 2025)](https://arxiv.org/abs/2510.22363).
- **Missing Data Profile:**
  - **Explicit Missingness:** `stats.hasMissingValues` is **`false`** (`0` explicit missing cells across all 1,000 rows and 21 columns when parsed with tokens `""`, `"NA"`, `"NaN"`).
  - **Disguised / Implicit Missingness:** No disguised sentinel missing values (`implicitMissingValues`) are present in this dataset.
- **Known Formatting & Modeling Traps:** **Critical Coding Trap ([Groemping, 2019](https://www1.beuth-hochschule.de/FB_II/reports/Report-2019-004.pdf); [Fabris et al., 2022](https://doi.org/10.1007/s10618-022-00854-z)):** Hundreds of fairness papers split `personal_status` (`female div/dep/mar` vs. `male *`) to evaluate gender fairness. By recovering the original 1970s German codebook (`South German Credit`, [UCI ID 522](https://archive.ics.uci.edu/dataset/522/south+german+credit)), Groemping proved that code `A92` (`female div/dep/mar`, `n = 310`) actually combined **non-single women AND single men**, while `A93` (`male single`, `n = 548`) denoted **married/widowed/divorced men**! Consequently, `sex` cannot be reliably recovered from StatLog German Credit, whereas `age` (`<= 25` vs. `> 25`) is completely intact and methodologically valid.

## 5. Recommended Uses & Fit-for-Purpose Guidance
Aligned with [Datasheets for Datasets (Uses)](https://cacm.acm.org/research/datasheets-for-datasets/), [Google Data Cards Playbook (Usage Guidance)](https://sites.research.google/datacardsplaybook/), and [Hugging Face Supported Tasks](https://huggingface.co/docs/hub/en/datasets-cards).

- **Recommended Pedagogical Classification Workflows:** Train **Regularized Logistic Regression**, **Decision Trees**, and **Random Forests** with one-hot encoding for nominal predictors. Compare standard `0.50` probability thresholds against cost-sensitive thresholds reflecting Hofmann's 5:1 cost matrix, evaluating **Balanced Accuracy**, **ROC-AUC**, **F1-score**, and **Age-Group Equal Opportunity / Demographic Parity** ([Raftopoulos et al., 2025](https://doi.org/10.3390/a18070435); [de Castro Vieira et al., 2025](https://doi.org/10.3390/jrfm18050228)).
- **Out-of-Scope & Inappropriate Uses:** Half-century-old Deutsche Mark credit records from an era before modern credit bureaus, online banking, or EU Equal Credit / AI Act regulations; completely unsuitable for contemporary credit scoring.

## 6. Ethical Considerations, Privacy & Fairness Analysis
Aligned with [Hugging Face Considerations for Using the Data](https://huggingface.co/docs/hub/en/datasets-cards), [Google Data Cards Playbook (Human Attributes & Sensitive Data)](https://sites.research.google/datacardsplaybook/), and [OTDI Privacy/PII Requirements](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Sensitive & Protected Attributes:**
  - **`personal_status`** (`categorical`): Joint marital status and sex attribute; Groemping (2019) proved that legacy StatLog labels misassigned sex across codes (e.g., 'female div/dep/mar' actually mixed non-single women with single men).
  - **`age`** (`numeric`): Applicant age in years (primary reliable protected attribute; good-credit rate is 57.9% for age <= 25 vs. 72.8% for age > 25).
  - **`foreign_worker`** (`boolean`): Whether the applicant was classified as a foreign guest worker ('Gastarbeiter') in 1970s West Germany (note: legacy StatLog documentation inverted the yes/no coding relative to original South German records; see Groemping, 2019). Coded as: `no` = No, `yes` = Yes.
- **Privacy & PII Assessment:** Fully anonymized 1973-1975 records with coarse categorical buckets and zero direct personal identifiers.
- **Documented Biases & Representational Harms:** Younger borrowers (`age <= 25`, `n = 190`) have an empirical `good` credit rate of **57.9%** (`110/190`) compared to **72.8%** (`590/810`) for applicants aged `> 25`, causing unconstrained classifiers to disproportionately reject young adults ([Kamiran & Calders, 2012; Le Quy et al., 2022](https://wires.onlinelibrary.wiley.com/doi/10.1002/widm.1452)). Moreover, in West Germany until 1977, civil marriage law restricted married women's independent financial contracting, embedding structural patriarchy directly into historical banking features.
- **Recommended Fairness Audits:** Conduct subgroup fairness audits primarily on **`age`** (`age <= 25` vs. `age > 25`) using **Demographic Parity Difference**, **Equal Opportunity Difference (TPR gap)**, and **False Negative Rate** (wrongful loan denial), and inspect `personal_status` specifically to demonstrate how upstream codebook errors corrupt downstream fairness claims.

## 7. Distribution, Licensing & Maintenance
Aligned with [Datasheets for Datasets (Distribution & Maintenance)](https://cacm.acm.org/research/datasheets-for-datasets/) and [OTDI Open Licensing Requirements](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **License & Redistribution Terms:** Distributed under **[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)** (SPDX identifier: `cc-by-4.0`). All open redistribution and attribution requirements have been verified for bundling inside client-side educational repositories (including Apache 2.0-licensed open-source releases).
- **Maintenance & Versioning:** Static benchmark archived at [UCI ID 144](https://archive.ics.uci.edu/dataset/144/statlog+german+credit+data) and [OpenML ID 31](https://www.openml.org/d/31) under **CC BY 4.0**, fully compatible with Apache 2.0 redistribution.

## 8. Sources, Public Dataset Cards & Academic References
Full linked attribution to every public dataset card, upstream repository, transparency standard, and peer-reviewed study consulted during the creation of this Dataset Card.

- **Public Dataset Cards, Repositories & Standards Consulted:**
  - [UCI Machine Learning Repository: Statlog (German Credit Data) (ID 144)](https://archive.ics.uci.edu/dataset/144/statlog+german+credit+data) — Verified 5:1 cost matrix, 20 predictor definitions, and CC BY 4.0 license.
  - [UCI Machine Learning Repository: South German Credit (ID 522)](https://archive.ics.uci.edu/dataset/522/south+german+credit) — Consulted Groemping's (2019) corrected German codebook to document the personal_status and foreign_worker coding errata.
  - [OpenML Dataset Card: credit-g (ID 31)](https://www.openml.org/d/31) — Verified human-readable attribute names and category strings.
  - [Hugging Face Dataset Cards Documentation](https://huggingface.co/docs/hub/en/datasets-cards) — Structural hierarchy and YAML frontmatter conventions.
  - [Datasheets for Datasets (Gebru et al., 2021)](https://cacm.acm.org/research/datasheets-for-datasets/) — Lifecycle motivation, composition, collection, preprocessing, uses, distribution, and maintenance dimensions.
  - [Google Research Data Cards Playbook (Pushkarna et al., 2022)](https://sites.research.google/datacardsplaybook/) — Purpose, provenance, human attributes, transformations, and fit-for-purpose guidance.
  - [AI Alliance Open Trusted Data Initiative (OTDI) Dataset Specification](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/) — Verifiable lineage, open licensing, PII risk assessment, and zero-drift metadata synchronization.
- **Seminal Papers & Fairness Audits:**
  - [South German Credit Data: Correcting a Widely Used Data Set](https://www1.beuth-hochschule.de/FB_II/reports/Report-2019-004.pdf) — Ulrike Groemping (2019) [`fairness-audit`]. Groemping, U. (2019). South German credit data: Correcting a widely used data set (Report 4/2019). Department II, Beuth University of Applied Sciences Berlin. https://doi.org/10.24432/C5X89F
  - [Algorithmic Fairness Datasets: The Story So Far](https://doi.org/10.1007/s10618-022-00854-z) — Alessandro Fabris, Stefano Messina, Gianmaria Silvello, Gian Antonio Susto (2022) [`fairness-audit`]. Fabris, A., Messina, S., Silvello, G., & Susto, G. A. (2022). Algorithmic fairness datasets: The story so far. Data Mining and Knowledge Discovery, 36(6), 2074-2152. https://doi.org/10.1007/s10618-022-00854-z
  - [Towards Fair AI: Mitigating Bias in Credit Decisions—A Systematic Literature Review](https://doi.org/10.3390/jrfm18050228) — Jose Romulo de Castro Vieira, Flavio Barboza, Daniel Cajueiro, Herbert Kimura (2025) [`fairness-audit`]. de Castro Vieira, J. R., Barboza, F., Cajueiro, D., & Kimura, H. (2025). Towards fair AI: Mitigating bias in credit decisions—A systematic literature review. Journal of Risk and Financial Management, 18(5), 228. https://doi.org/10.3390/jrfm18050228
  - [OpenML Dataset Card: credit-g (ID 31)](https://www.openml.org/d/31) — Hans Hofmann, OpenML Contributors (2014) [`documentation`]. Hofmann, H. (1994). Statlog (German Credit Data) [Dataset]. UCI Machine Learning Repository / OpenML ID 31. https://doi.org/10.24432/C5NC77
