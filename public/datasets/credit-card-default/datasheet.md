---
pretty_name: "Default of Credit Card Clients"
task_categories:
  - tabular-classification
task_ids:
  - "binary-classification"
license: "cc-by-4.0"
size_categories:
  - "10K<n<100K"
source_datasets:
  - "uci/default-of-credit-card-clients (id=350) / hf/scikit-learn/credit-card-clients"
tags:
  - "finance"
  - "advanced"
  - "binary"
  - "imbalanced"
  - "undocumented-codes"
  - "credit-fairness"
  - "temporal-features"
---

# Default of Credit Card Clients

**Domain:** Finance | **Difficulty:** Advanced | **Task:** Binary Classification | **Rows:** 30,000 | **Columns:** 25 | **CSV Size:** 2,862,995 bytes | **License:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

## 1. Dataset Summary & Motivation
Aligned with [Hugging Face Dataset Summary](https://huggingface.co/docs/hub/en/datasets-cards), [Datasheets for Datasets (Motivation)](https://cacm.acm.org/research/datasheets-for-datasets/), and [Google Data Cards Playbook (Purpose & Intentionality)](https://sites.research.google/datacardsplaybook/).

- **Overview:** The Default of Credit Card Clients dataset contains 30,000 Taiwanese cardholder profiles—23,364 non-defaulters (`0`, 77.88%) and 6,636 defaulters (`1`, 22.12%) in October 2005—across a sequential `ID`, credit limit (`LIMIT_BAL`), four demographic attributes (`SEX`, `EDUCATION`, `MARRIAGE`, `AGE`), and six monthly waves (April–September 2005) of repayment status (`PAY_0`..`PAY_6`), billed balances (`BILL_AMT1`..`BILL_AMT6`), and payment amounts (`PAY_AMT1`..`PAY_AMT6`).
- **Original Purpose & Creators:** Assembled by Prof. I-Cheng Yeh (Chung Hua University) and Che-hui Lien ([Yeh & Lien, 2009](https://doi.org/10.1016/j.eswa.2007.12.020)) to compare six data-mining classifiers and calibrate predicted default probabilities during Taiwan's 2005 consumer credit card crisis, and donated to the [UCI Machine Learning Repository (`id=350`)](https://archive.ics.uci.edu/dataset/350/default+of+credit+card+clients).
- **Benchmark & Pedagogical Significance:** Extensively benchmarked in fair-ML surveys ([Le Quy et al., 2022](https://wires.onlinelibrary.wiley.com/doi/10.1002/widm.1452); [Hirzel & Feffer, 2023](https://arxiv.org/abs/2308.00133); [Simson et al., 2025](https://arxiv.org/abs/2510.22363); [de Castro Vieira et al., 2025](https://doi.org/10.3390/jrfm18050228)), this 30,000-row dataset teaches: (1) **sequential row-ID exclusion** (`ID` 1..30,000); (2) **undocumented upstream category codes** (`EDUCATION` codes `0, 5, 6` and `MARRIAGE` code `0`, plus `PAY_1` missing from header sequence `PAY_0, PAY_2..PAY_6`); (3) **highly skewed, serially correlated monetary time series**; and (4) **fairness-accuracy trade-offs in consumer credit scoring**.

## 2. Dataset Structure & Composition
Aligned with [Hugging Face Dataset Structure](https://huggingface.co/docs/hub/en/datasets-cards), [Datasheets for Datasets (Composition)](https://cacm.acm.org/research/datasheets-for-datasets/), and [OTDI Quality Metrics](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Unit of Observation:** One individual consumer credit card account holder at a major Taiwanese commercial bank in 2005.
- **File & Parsing Specification:** Packaged at `/public/datasets/credit-card-default/data.csv` (`2,862,995` bytes, `30,000` rows, `25` columns, delimiter `","`, `hasHeader: true`).
- **Classification Target(s) & Class Distribution:**
  - **Default Target:** `default.payment.next.month` (`binary-classification`). Positive class is encoded as `1`. Exact class distribution in `data.csv`: `0` (No default): **23,364** (77.88%); `1` (Defaulted next month): **6,636** (22.12%).
  - **Alternative Classification Target(s):**
  - None configured (all non-target attributes are continuous predictors or identifiers/leakage controls; continuous regression targets are excluded in Phase 1).
- **Excluded Columns (Identifiers, Redundancy & Leakage Controls):**
  - **`ID`** (`semanticRole: "identifier"`, `defaultSelected: false`): Sequential row index (1-30,000); including IDs causes tree and distance models to overfit row ordering.
- **Complete Feature Schema (`columns[]` synchronized with `metadata.json`):**

| # | Column (`name`) | Display Name | Type | Role | Default | Unit | Missing | Implicit Missing / Coded Labels |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `ID` | Client ID | `text` | `identifier` | No | — | 0 | Sequential row identifier (1 to 30,000) with no predictive meaning. |
| 2 | `LIMIT_BAL` | Credit Limit | `numeric` | `feature` | Yes | `NTD` | 0 | Total credit line extended to the individual and supplementary family cards in New Taiwan Dollars (NTD). |
| 3 | `SEX` | Sex | `categorical` | `sensitive` | Yes | — | 0 | Labels: `1`=Male; `2`=Female |
| 4 | `EDUCATION` | Education Level | `categorical` | `sensitive` | Yes | — | 0 | Implicit missing: `0`, `5`, `6`; Labels: `0`=Undocumented code 0; `1`=Graduate school; `2`=University; `3`=High school; `4`=Others; `5`=Undocumented code 5; ... (+1 more) |
| 5 | `MARRIAGE` | Marital Status | `categorical` | `sensitive` | Yes | — | 0 | Implicit missing: `0`; Labels: `0`=Undocumented code 0; `1`=Married; `2`=Single; `3`=Others |
| 6 | `AGE` | Age | `numeric` | `sensitive` | Yes | `years` | 0 | Cardholder age in years (21 to 79). |
| 7 | `PAY_0` | Repayment Status (September 2005) | `categorical` | `feature` | Yes | — | 0 | Labels: `-2`=No consumption / inactive billing cycle; `-1`=Paid in full duly; `0`=Revolving credit used (minimum payment met); `1`=Payment delay for 1 month; `2`=Payment delay for 2 months; `3`=Payment delay for 3 months; ... (+5 more) |
| 8 | `PAY_2` | Repayment Status (August 2005) | `categorical` | `feature` | Yes | — | 0 | Labels: `-2`=No consumption / inactive billing cycle; `-1`=Paid in full duly; `0`=Revolving credit used (minimum payment met); `1`=Payment delay for 1 month; `2`=Payment delay for 2 months; `3`=Payment delay for 3 months; ... (+5 more) |
| 9 | `PAY_3` | Repayment Status (July 2005) | `categorical` | `feature` | Yes | — | 0 | Labels: `-2`=No consumption / inactive billing cycle; `-1`=Paid in full duly; `0`=Revolving credit used (minimum payment met); `1`=Payment delay for 1 month; `2`=Payment delay for 2 months; `3`=Payment delay for 3 months; ... (+5 more) |
| 10 | `PAY_4` | Repayment Status (June 2005) | `categorical` | `feature` | Yes | — | 0 | Labels: `-2`=No consumption / inactive billing cycle; `-1`=Paid in full duly; `0`=Revolving credit used (minimum payment met); `1`=Payment delay for 1 month; `2`=Payment delay for 2 months; `3`=Payment delay for 3 months; ... (+5 more) |
| 11 | `PAY_5` | Repayment Status (May 2005) | `categorical` | `feature` | Yes | — | 0 | Labels: `-2`=No consumption / inactive billing cycle; `-1`=Paid in full duly; `0`=Revolving credit used (minimum payment met); `1`=Payment delay for 1 month; `2`=Payment delay for 2 months; `3`=Payment delay for 3 months; ... (+5 more) |
| 12 | `PAY_6` | Repayment Status (April 2005) | `categorical` | `feature` | Yes | — | 0 | Labels: `-2`=No consumption / inactive billing cycle; `-1`=Paid in full duly; `0`=Revolving credit used (minimum payment met); `1`=Payment delay for 1 month; `2`=Payment delay for 2 months; `3`=Payment delay for 3 months; ... (+5 more) |
| 13 | `BILL_AMT1` | Bill Statement (September 2005) | `numeric` | `feature` | Yes | `NTD` | 0 | Billed statement balance in September 2005 in New Taiwan Dollars (negative values reflect credit overpayments). |
| 14 | `BILL_AMT2` | Bill Statement (August 2005) | `numeric` | `feature` | Yes | `NTD` | 0 | Billed statement balance in August 2005 in New Taiwan Dollars (negative values reflect credit overpayments). |
| 15 | `BILL_AMT3` | Bill Statement (July 2005) | `numeric` | `feature` | Yes | `NTD` | 0 | Billed statement balance in July 2005 in New Taiwan Dollars (negative values reflect credit overpayments). |
| 16 | `BILL_AMT4` | Bill Statement (June 2005) | `numeric` | `feature` | Yes | `NTD` | 0 | Billed statement balance in June 2005 in New Taiwan Dollars (negative values reflect credit overpayments). |
| 17 | `BILL_AMT5` | Bill Statement (May 2005) | `numeric` | `feature` | Yes | `NTD` | 0 | Billed statement balance in May 2005 in New Taiwan Dollars (negative values reflect credit overpayments). |
| 18 | `BILL_AMT6` | Bill Statement (April 2005) | `numeric` | `feature` | Yes | `NTD` | 0 | Billed statement balance in April 2005 in New Taiwan Dollars (negative values reflect credit overpayments). |
| 19 | `PAY_AMT1` | Previous Payment (September 2005) | `numeric` | `feature` | Yes | `NTD` | 0 | Amount actually paid by the cardholder in September 2005 in New Taiwan Dollars. |
| 20 | `PAY_AMT2` | Previous Payment (August 2005) | `numeric` | `feature` | Yes | `NTD` | 0 | Amount actually paid by the cardholder in August 2005 in New Taiwan Dollars. |
| 21 | `PAY_AMT3` | Previous Payment (July 2005) | `numeric` | `feature` | Yes | `NTD` | 0 | Amount actually paid by the cardholder in July 2005 in New Taiwan Dollars. |
| 22 | `PAY_AMT4` | Previous Payment (June 2005) | `numeric` | `feature` | Yes | `NTD` | 0 | Amount actually paid by the cardholder in June 2005 in New Taiwan Dollars. |
| 23 | `PAY_AMT5` | Previous Payment (May 2005) | `numeric` | `feature` | Yes | `NTD` | 0 | Amount actually paid by the cardholder in May 2005 in New Taiwan Dollars. |
| 24 | `PAY_AMT6` | Previous Payment (April 2005) | `numeric` | `feature` | Yes | `NTD` | 0 | Amount actually paid by the cardholder in April 2005 in New Taiwan Dollars. |
| 25 | `default.payment.next.month` | Default Next Month (Oct 2005) | `boolean` | `target` | No | — | 0 | Labels: `0`=No default; `1`=Defaulted next month |

## 3. Provenance, Collection Process & Sampling Frame
Aligned with [Datasheets for Datasets (Collection Process)](https://cacm.acm.org/research/datasheets-for-datasets/), [Google Data Cards Playbook (Provenance & Upstream Sources)](https://sites.research.google/datacardsplaybook/), and [OTDI Verifiable Lineage](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Upstream Lineage:** Originated in **2009** by I-Cheng Yeh, Che-hui Lien. Canonical dataset homepage: [Default of Credit Card Clients Canonical Homepage](https://archive.ics.uci.edu/dataset/350/default+of+credit+card+clients); upstream raw data source: [Upstream Source Repository](https://huggingface.co/datasets/scikit-learn/credit-card-clients/resolve/main/UCI_Credit_Card.csv).
- **Acquisition Method:** Extracted from internal monthly billing, repayment, and customer-onboarding databases of a major Taiwanese retail bank covering April 2005 through October 2005.
- **Population & Sampling Frame:** 30,000 active individual consumer credit cardholders in Taiwan aged 21 to 79 during Q2–Q4 2005, coinciding with Taiwan's 'Twin-Card' (credit and cash card) over-issuance crisis.

## 4. Preprocessing, Cleaning & Data Quality Audit
Aligned with [Datasheets for Datasets (Preprocessing/Cleaning/Labeling)](https://cacm.acm.org/research/datasheets-for-datasets/), [Google Data Cards Playbook (Transformations)](https://sites.research.google/datacardsplaybook/), and [OTDI Completeness Criteria](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Upstream Transformations & Standardization:** Mirrored verbatim (`2,862,995` bytes) from the canonical [`scikit-learn/credit-card-clients` (`UCI_Credit_Card.csv`)](https://huggingface.co/datasets/scikit-learn/credit-card-clients) export, which uses the descriptive Row-2 variable headers (`LIMIT_BAL`, `SEX`, ..., `default.payment.next.month`) from Yeh's original `.xls` workbook rather than the opaque `X1..X23` headers in UCI's raw `static/public/350/data.csv`.
- **Missing Data Profile:**
  - **Explicit Missingness:** `stats.hasMissingValues` is **`false`** (`0` explicit missing cells across all 30,000 rows and 25 columns when parsed with tokens `""`, `"NA"`, `"NaN"`).
  - **Disguised / Implicit Missingness:** Domain-invalid sentinel values or unrecorded category tokens are explicitly annotated in `columns[].implicitMissingValues` for: `EDUCATION` (`0`, `5`, `6`), `MARRIAGE` (`0`).
- **Known Formatting & Modeling Traps:** Four real-world data traps stand out: (1) `ID` (`1..30,000`) is auto-excluded (`semanticRole: 'identifier'`); (2) Header `PAY_0` corresponds to September 2005 while `PAY_2` jumps directly to August 2005 (`PAY_1` does not exist); (3) `EDUCATION` contains `345` undocumented codes (`0` [14], `5` [280], `6` [51]) and `MARRIAGE` contains `54` undocumented `0` codes, surfaced via `implicitMissingValues`; and (4) `PAY_0..PAY_6` contain `-2` (no consumption) and `0` (revolving minimum paid), which distort linear models if treated as continuous integers rather than categorical codes.

## 5. Recommended Uses & Fit-for-Purpose Guidance
Aligned with [Datasheets for Datasets (Uses)](https://cacm.acm.org/research/datasheets-for-datasets/), [Google Data Cards Playbook (Usage Guidance)](https://sites.research.google/datacardsplaybook/), and [Hugging Face Supported Tasks](https://huggingface.co/docs/hub/en/datasets-cards).

- **Recommended Pedagogical Classification Workflows:** Compare **Logistic Regression** (with scaled monetary features + one-hot encoded `PAY_*`), **Decision Trees**, and **Random Forests / Gradient Boosted Trees**. Because overall accuracy on predicting all `0`s is already **77.88%**, evaluate models with **ROC-AUC**, **Precision-Recall AUC**, **F1-score**, **Calibration plots**, and **Equalized Odds**.
- **Out-of-Scope & Inappropriate Uses:** Reflects 2005 Taiwanese crisis-era credit issuance and New Taiwan Dollar scales; inappropriate for production credit underwriting or individual creditworthiness decisions.

## 6. Ethical Considerations, Privacy & Fairness Analysis
Aligned with [Hugging Face Considerations for Using the Data](https://huggingface.co/docs/hub/en/datasets-cards), [Google Data Cards Playbook (Human Attributes & Sensitive Data)](https://sites.research.google/datacardsplaybook/), and [OTDI Privacy/PII Requirements](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Sensitive & Protected Attributes:**
  - **`SEX`** (`categorical`): Recorded binary gender of the cardholder (default rate is 24.2% for men [1] vs. 20.8% for women [2]). Coded as: `1` = Male, `2` = Female.
  - **`EDUCATION`** (`categorical`): Highest educational attainment; contains 345 undocumented codes (0, 5, 6) absent from Yeh & Lien's (2009) original codebook. Coded as: `0` = Undocumented code 0, `1` = Graduate school, `2` = University, `3` = High school, `4` = Others, `5` = Undocumented code 5, `6` = Undocumented code 6.
  - **`MARRIAGE`** (`categorical`): Marital status of the cardholder; contains 54 undocumented 0 codes. Coded as: `0` = Undocumented code 0, `1` = Married, `2` = Single, `3` = Others.
  - **`AGE`** (`numeric`): Cardholder age in years (21 to 79).
- **Privacy & PII Assessment:** Anonymized banking records with sequential `ID` numbers (`identifier`) and zero names, national IDs, or addresses.
- **Documented Biases & Representational Harms:** In `data.csv`, **Male** cardholders (`SEX = 1`, `n = 11,888`) default at **24.2%** (`2,873/11,888`) vs. **20.8%** (`3,763/18,112`) for **Female** cardholders (`SEX = 2`), while **Married** clients (`23.5%`) and **High-school educated** clients (`25.2%`) default more frequently than **Single** (`20.9%`) or **Graduate-educated** (`19.2%`) clients ([Le Quy et al., 2022](https://wires.onlinelibrary.wiley.com/doi/10.1002/widm.1452)). Moreover, `LIMIT_BAL` encodes the bank's own historical underwriting preferences across age, gender, and education.
- **Recommended Fairness Audits:** Evaluate **Statistical Parity Difference**, **Equal Opportunity (False Negative Rate on creditworthy clients)**, and **False Positive Rate (wrongful default flagging)** across `SEX`, `MARRIAGE`, `EDUCATION`, and `AGE` (`< 30` vs. `>= 30`), testing whether dropping `SEX` removes disparity when `LIMIT_BAL` and `MARRIAGE` remain.

## 7. Distribution, Licensing & Maintenance
Aligned with [Datasheets for Datasets (Distribution & Maintenance)](https://cacm.acm.org/research/datasheets-for-datasets/) and [OTDI Open Licensing Requirements](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **License & Redistribution Terms:** Distributed under **[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)** (SPDX identifier: `cc-by-4.0`). All open redistribution and attribution requirements have been verified for bundling inside client-side educational repositories (including Apache 2.0-licensed open-source releases).
- **Maintenance & Versioning:** Static archival dataset hosted on [UCI ID 350 (DOI `10.24432/C55S3H`)](https://archive.ics.uci.edu/dataset/350/default+of+credit+card+clients) under **CC BY 4.0** and mirrored on Hugging Face (`cc0-1.0` / `cc-by-4.0`), fully redistributable with attribution.

## 8. Sources, Public Dataset Cards & Academic References
Full linked attribution to every public dataset card, upstream repository, transparency standard, and peer-reviewed study consulted during the creation of this Dataset Card.

- **Public Dataset Cards, Repositories & Standards Consulted:**
  - [UCI Machine Learning Repository: Default of Credit Card Clients (ID 350)](https://archive.ics.uci.edu/dataset/350/default+of+credit+card+clients) — Verified NTD monetary units, April-September 2005 monthly wave mapping, and CC BY 4.0 license.
  - [Hugging Face Hub: scikit-learn/credit-card-clients](https://huggingface.co/datasets/scikit-learn/credit-card-clients) — Verified exact 30,000 x 25 descriptive CSV column headers and undocumented EDUCATION/MARRIAGE code frequencies.
  - [Hugging Face Dataset Cards Documentation](https://huggingface.co/docs/hub/en/datasets-cards) — Structural hierarchy and YAML frontmatter conventions.
  - [Datasheets for Datasets (Gebru et al., 2021)](https://cacm.acm.org/research/datasheets-for-datasets/) — Lifecycle motivation, composition, collection, preprocessing, uses, distribution, and maintenance dimensions.
  - [Google Research Data Cards Playbook (Pushkarna et al., 2022)](https://sites.research.google/datacardsplaybook/) — Purpose, provenance, human attributes, transformations, and fit-for-purpose guidance.
  - [AI Alliance Open Trusted Data Initiative (OTDI) Dataset Specification](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/) — Verifiable lineage, open licensing, PII risk assessment, and zero-drift metadata synchronization.
- **Seminal Papers & Fairness Audits:**
  - [The Comparisons of Data Mining Techniques for the Predictive Accuracy of Probability of Default of Credit Card Clients](https://doi.org/10.1016/j.eswa.2007.12.020) — I-Cheng Yeh, Che-hui Lien (2009) [`seminal-paper`]. Yeh, I.-C., & Lien, C.-H. (2009). The comparisons of data mining techniques for the predictive accuracy of probability of default of credit card clients. Expert Systems with Applications, 36(2), 2473-2480. https://doi.org/10.1016/j.eswa.2007.12.020
  - [A Survey on Datasets for Fairness-Aware Machine Learning](https://wires.onlinelibrary.wiley.com/doi/10.1002/widm.1452) — Tai Le Quy, Arjun Roy, Vasileios Iosifidis, Wenbin Zhang, Eirini Ntoutsi (2022) [`fairness-audit`]. Le Quy, T., Roy, A., Iosifidis, V., Zhang, W., & Ntoutsi, E. (2022). A survey on datasets for fairness-aware machine learning. WIREs Data Mining and Knowledge Discovery, 12(3), e1452. https://doi.org/10.1002/widm.1452
  - [Hugging Face Dataset Card: scikit-learn/credit-card-clients](https://huggingface.co/datasets/scikit-learn/credit-card-clients) — scikit-learn Contributors, I-Cheng Yeh (2022) [`documentation`]. Yeh, I.-C. (2016). Default of Credit Card Clients [Dataset]. UCI Machine Learning Repository. https://doi.org/10.24432/C55S3H
