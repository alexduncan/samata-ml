---
pretty_name: 'Bank Telemarketing Term Deposit'
task_categories:
    - tabular-classification
task_ids:
    - 'binary-classification'
license: 'cc-by-4.0'
size_categories:
    - '10K<n<100K'
source_datasets:
    - 'uci/bank-marketing (id=222, bank-full.csv)'
tags:
    - 'marketing'
    - 'advanced'
    - 'binary'
    - 'semicolon-csv'
    - 'target-leakage'
    - 'severe-imbalance'
    - 'age-fairness'
---

# Bank Telemarketing Term Deposit

**Domain:** Marketing | **Difficulty:** Advanced | **Task:** Binary Classification | **Rows:** 45,211 | **Columns:** 17 | **CSV Size:** 4,610,348 bytes | **License:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

## 1. Dataset Summary & Motivation

Aligned with [Hugging Face Dataset Summary](https://huggingface.co/docs/hub/en/datasets-cards), [Datasheets for Datasets (Motivation)](https://cacm.acm.org/research/datasheets-for-datasets/), and [Google Data Cards Playbook (Purpose & Intentionality)](https://sites.research.google/datacardsplaybook/).

- **Overview:** The Bank Telemarketing Term Deposit dataset (`bank-full.csv`: `45,211` contacts across `17` semicolon-delimited columns) models whether a retail bank client subscribes to a long-term deposit (`y = 'yes'`: `5,289` [11.70%] vs. `y = 'no'`: `39,922` [88.30%]). It combines client demographics, credit balances, and campaign contact telemetry from May 2008 to November 2010.
- **Original Purpose & Creators:** Compiled and analyzed by Sergio Moro, Paulo Cortez, and Paulo Rita ([Moro et al., 2014](https://doi.org/10.1016/j.dss.2014.03.001)) from an anonymous Portuguese retail bank's contact-center CRM records to improve telemarketing targeting efficiency during the post-2008 European financial crisis, and donated to the [UCI Machine Learning Repository (`id=222`)](https://archive.ics.uci.edu/dataset/222/bank+marketing).
- **Benchmark & Pedagogical Significance:** Bank Marketing delivers four essential lessons for client-side ML education: (1) **non-standard semicolon (`;`) CSV parsing**; (2) **textbook post-outcome target leakage** (`duration` of the phone call is only known after the call concludes—our schema marks it `semanticRole: 'leaky'` and auto-disables it); (3) **the Accuracy Paradox under severe 1:7.55 class imbalance** (predicting `'no'` for everyone scores **88.30% accuracy** with **0.0% recall**); and (4) **variant provenance & age fairness** ([Simson et al., 2025](https://arxiv.org/abs/2510.22363); [Raftopoulos et al., 2025](https://doi.org/10.3390/a18070435)).

## 2. Dataset Structure & Composition

Aligned with [Hugging Face Dataset Structure](https://huggingface.co/docs/hub/en/datasets-cards), [Datasheets for Datasets (Composition)](https://cacm.acm.org/research/datasheets-for-datasets/), and [OTDI Quality Metrics](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Unit of Observation:** One outbound telemarketing phone campaign contact episode with a retail banking client in Portugal.
- **File & Parsing Specification:** Packaged at `/public/datasets/bank-marketing/data.csv` (`4,610,348` bytes, `45,211` rows, `17` columns, delimiter `";"`, `hasHeader: true`).
- **Classification Target(s) & Class Distribution:**
  - **Default Target:** `y` (`binary-classification`). Positive class is encoded as `yes`. Exact class distribution in `data.csv`: `no` (Did not subscribe): **39,922** (88.30%); `yes` (Subscribed to term deposit): **5,289** (11.70%).
  - **Alternative Classification Target(s):**
  - None configured (all non-target attributes are continuous predictors or identifiers/leakage controls; continuous regression targets are excluded in Phase 1).
- **Excluded Columns (Identifiers, Redundancy & Leakage Controls):**
  - **`duration`** (`semanticRole: "leaky"`, `defaultSelected: false`): Post-outcome target leakage: call duration is unknown before placing a call and directly reflects enrollment completion (Moro et al., 2014).
- **Complete Feature Schema (`columns[]` synchronized with `metadata.json`):**

| #  | Column (`name`) | Display Name                 | Type          | Role        | Default | Unit      | Missing | Implicit Missing / Coded Labels                                                                                                                      |
| -- | --------------- | ---------------------------- | ------------- | ----------- | ------- | --------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1  | `age`           | Client Age                   | `numeric`     | `sensitive` | Yes     | `years`   | 0       | Client age in years (exhibits U-shaped conversion rates: higher among youth <25 and retirees >60 than working-age adults 25-60).                     |
| 2  | `job`           | Occupation                   | `categorical` | `feature`   | Yes     | —         | 0       | Implicit missing: `unknown`                                                                                                                          |
| 3  | `marital`       | Marital Status               | `categorical` | `sensitive` | Yes     | —         | 0       | Labels: `divorced`=Divorced or widowed; `married`=Married; `single`=Single                                                                           |
| 4  | `education`     | Education Level              | `categorical` | `feature`   | Yes     | —         | 0       | Implicit missing: `unknown`                                                                                                                          |
| 5  | `default`       | Credit in Default            | `boolean`     | `feature`   | Yes     | —         | 0       | Labels: `no`=No; `yes`=Yes                                                                                                                           |
| 6  | `balance`       | Average Yearly Balance       | `numeric`     | `feature`   | Yes     | `EUR`     | 0       | Average yearly bank account balance in euros (can be negative when overdrawn).                                                                       |
| 7  | `housing`       | Housing Loan                 | `boolean`     | `feature`   | Yes     | —         | 0       | Labels: `no`=No; `yes`=Yes                                                                                                                           |
| 8  | `loan`          | Personal Loan                | `boolean`     | `feature`   | Yes     | —         | 0       | Labels: `no`=No; `yes`=Yes                                                                                                                           |
| 9  | `contact`       | Contact Channel              | `categorical` | `feature`   | Yes     | —         | 0       | Implicit missing: `unknown`                                                                                                                          |
| 10 | `day`           | Last Contact Day of Month    | `numeric`     | `feature`   | Yes     | —         | 0       | Calendar day of the month (1 to 31) of the last campaign contact.                                                                                    |
| 11 | `month`         | Last Contact Month           | `categorical` | `feature`   | Yes     | —         | 0       | Calendar month abbreviation ('jan' through 'dec') of the last campaign contact.                                                                      |
| 12 | `duration`      | Last Call Duration (Leaky)   | `numeric`     | `leaky`     | No      | `seconds` | 0       | Duration of the last phone call in seconds; unknown prior to placing a call and strongly reveals whether the client stayed on the line to subscribe. |
| 13 | `campaign`      | Contacts in Current Campaign | `numeric`     | `feature`   | Yes     | —         | 0       | Number of phone contacts performed during this campaign for this client (includes last contact).                                                     |
| 14 | `pdays`         | Days Since Previous Campaign | `numeric`     | `feature`   | Yes     | `days`    | 0       | Implicit missing: `-1`                                                                                                                               |
| 15 | `previous`      | Prior Campaign Contacts      | `numeric`     | `feature`   | Yes     | —         | 0       | Number of contacts performed before the current marketing campaign for this client.                                                                  |
| 16 | `poutcome`      | Previous Campaign Outcome    | `categorical` | `feature`   | Yes     | —         | 0       | Implicit missing: `unknown`                                                                                                                          |
| 17 | `y`             | Subscribed Term Deposit      | `boolean`     | `target`    | No      | —         | 0       | Labels: `no`=Did not subscribe; `yes`=Subscribed to term deposit                                                                                     |

## 3. Provenance, Collection Process & Sampling Frame

Aligned with [Datasheets for Datasets (Collection Process)](https://cacm.acm.org/research/datasheets-for-datasets/), [Google Data Cards Playbook (Provenance & Upstream Sources)](https://sites.research.google/datacardsplaybook/), and [OTDI Verifiable Lineage](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Upstream Lineage:** Originated in **2012** by Sergio Moro, Paulo Cortez, Paulo Rita. Canonical dataset homepage: [Bank Telemarketing Term Deposit Canonical Homepage](https://archive.ics.uci.edu/dataset/222/bank+marketing); upstream raw data source: [Upstream Source Repository](https://archive.ics.uci.edu/static/public/222/bank+marketing.zip).
- **Acquisition Method:** Automatically logged by outbound call-center customer relationship management (CRM) software integrated with client retail-banking profiles across 17 campaign waves between May 2008 and November 2010.
- **Population & Sampling Frame:** 45,211 chronologically ordered phone contact outcomes of a Portuguese bank (note: some clients were contacted across multiple campaigns, captured via `previous`, `pdays`, and `poutcome`).

## 4. Preprocessing, Cleaning & Data Quality Audit

Aligned with [Datasheets for Datasets (Preprocessing/Cleaning/Labeling)](https://cacm.acm.org/research/datasheets-for-datasets/), [Google Data Cards Playbook (Transformations)](https://sites.research.google/datacardsplaybook/), and [OTDI Completeness Criteria](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Upstream Transformations & Standardization:** Mirrored verbatim (`4,610,348` bytes, `< 5 MB`) from `bank-full.csv` inside UCI's official [`bank+marketing.zip`](https://archive.ics.uci.edu/static/public/222/bank+marketing.zip), preserving its canonical semicolon (`;`) delimiter and double-quoted strings.
- **Missing Data Profile:**
  - **Explicit Missingness:** `stats.hasMissingValues` is **`false`** (`0` explicit missing cells across all 45,211 rows and 17 columns when parsed with tokens `""`, `"NA"`, `"NaN"`).
  - **Disguised / Implicit Missingness:** Domain-invalid sentinel values or unrecorded category tokens are explicitly annotated in `columns[].implicitMissingValues` for: `job` (`unknown`), `education` (`unknown`), `contact` (`unknown`), `pdays` (`-1`), `poutcome` (`unknown`).
- **Known Formatting & Modeling Traps:** Three major traps: (1) **Target Leakage (`duration`)**: [Moro et al. (2014)](https://doi.org/10.1016/j.dss.2014.03.001) explicitly warn that `duration = 0` deterministically implies `y = 'no'` and long calls reflect contract enrollment paperwork; leaving `duration` enabled inflates ROC-AUC by >15 points on an unusable post-hoc feature; (2) **Disguised Sentinels**: `pdays = -1` (`36,954` rows, 81.7%) means the client was **never previously contacted** (not `-1` days!), while `'unknown'` in `poutcome` (`36,959`), `contact` (`13,020`), `education` (`1,857`), and `job` (`288`) represents structural/unrecorded categories—so naive mode imputation on `poutcome` would falsely assign `'failure'` to 81.7% of clients; and (3) **Variant Confusion**: as [Simson et al. (2025)](https://arxiv.org/abs/2510.22363) emphasize, UCI hosts four files (`bank-full.csv` [45,211x17], `bank.csv` [4,521x17], `bank-additional-full.csv` [41,188x21], `bank-additional.csv` [4,119x21]).

## 5. Recommended Uses & Fit-for-Purpose Guidance

Aligned with [Datasheets for Datasets (Uses)](https://cacm.acm.org/research/datasheets-for-datasets/), [Google Data Cards Playbook (Usage Guidance)](https://sites.research.google/datacardsplaybook/), and [Hugging Face Supported Tasks](https://huggingface.co/docs/hub/en/datasets-cards).

- **Recommended Pedagogical Classification Workflows:** Train **Logistic Regression**, **Decision Trees**, and **Random Forests** with `duration` disabled (then optionally toggle `duration` in a supervised demonstration to witness target leakage firsthand!). Evaluate with **Precision-Recall curves**, **F1-score**, **Balanced Accuracy**, **ROC-AUC**, and **Decision Threshold tuning**.
- **Out-of-Scope & Inappropriate Uses:** Reflects 2008-2010 Eurozone sovereign-debt crisis interest rates and landline/early-cellular telemarketing in Portugal; unsuitable for modern omnichannel marketing or credit eligibility.

## 6. Ethical Considerations, Privacy & Fairness Analysis

Aligned with [Hugging Face Considerations for Using the Data](https://huggingface.co/docs/hub/en/datasets-cards), [Google Data Cards Playbook (Human Attributes & Sensitive Data)](https://sites.research.google/datacardsplaybook/), and [OTDI Privacy/PII Requirements](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Sensitive & Protected Attributes:**
  - **`age`** (`numeric`): Client age in years (exhibits U-shaped conversion rates: higher among youth <25 and retirees >60 than working-age adults 25-60).
  - **`marital`** (`categorical`): Client marital status ('married', 'single', or 'divorced' [which includes widowed]). Coded as: `divorced` = Divorced or widowed, `married` = Married, `single` = Single.
- **Privacy & PII Assessment:** Fully anonymized bank CRM extract with zero client names, account numbers, phone numbers, or geographic addresses.
- **Documented Biases & Representational Harms:** Empirical subscription (`y = 'yes'`) varies sharply by **`age`** in a U-shaped pattern: **25.6%** (`207/809`) for clients aged `< 25`, **10.6%** (`4,580/43,214`) for working-age adults `25–60`, and **42.3%** (`502/1,188`) for seniors `> 60`, alongside **`marital`** differences (**14.9%** `single` vs. **10.1%** `married`, **11.9%** `divorced`; [Le Quy et al., 2022](https://wires.onlinelibrary.wiley.com/doi/10.1002/widm.1452); [Duong & Conrad, 2024](https://arxiv.org/abs/2405.19300)). Models optimizing conversion concentrate calls on seniors and youth, illustrating both **exclusionary financial product access** (withholding high-yield savings offers from working families) and **potentially intrusive targeting of older adults**.
- **Recommended Fairness Audits:** Audit **Selection Rate (Demographic Parity)**, **True Positive Rate**, and **False Positive Rate** across age brackets (`< 25`, `25–60`, `> 60`) and `marital` status (`single`, `married`, `divorced`), comparing baseline classifiers against threshold-adjusted outputs ([Simson et al., 2025](https://arxiv.org/abs/2510.22363)).

## 7. Distribution, Licensing & Maintenance

Aligned with [Datasheets for Datasets (Distribution & Maintenance)](https://cacm.acm.org/research/datasheets-for-datasets/) and [OTDI Open Licensing Requirements](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **License & Redistribution Terms:** Distributed under **[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)** (SPDX identifier: `cc-by-4.0`). All open redistribution and attribution requirements have been verified for bundling inside client-side educational repositories (including Apache 2.0-licensed open-source releases).
- **Maintenance & Versioning:** Static benchmark archived at [UCI ID 222 (DOI `10.24432/C5K306`)](https://archive.ics.uci.edu/dataset/222/bank+marketing) under **CC BY 4.0**, permitting open Apache 2.0 redistribution with attribution.

## 8. Sources, Public Dataset Cards & Academic References

Full linked attribution to every public dataset card, upstream repository, transparency standard, and peer-reviewed study consulted during the creation of this Dataset Card.

- **Public Dataset Cards, Repositories & Standards Consulted:**
  - [UCI Machine Learning Repository: Bank Marketing (ID 222)](https://archive.ics.uci.edu/dataset/222/bank+marketing) — Verified four-variant inventory, Moro et al.'s explicit duration leakage note, EUR units, and CC BY 4.0 license.
  - [FairGround Corpus Annotation Analysis (Simson et al., 2025)](https://arxiv.org/abs/2510.22363) — Consulted Section C.4 variant disambiguation and Figure 3 age-fairness evaluation protocol.
  - [Hugging Face Dataset Cards Documentation](https://huggingface.co/docs/hub/en/datasets-cards) — Structural hierarchy and YAML frontmatter conventions.
  - [Datasheets for Datasets (Gebru et al., 2021)](https://cacm.acm.org/research/datasheets-for-datasets/) — Lifecycle motivation, composition, collection, preprocessing, uses, distribution, and maintenance dimensions.
  - [Google Research Data Cards Playbook (Pushkarna et al., 2022)](https://sites.research.google/datacardsplaybook/) — Purpose, provenance, human attributes, transformations, and fit-for-purpose guidance.
  - [AI Alliance Open Trusted Data Initiative (OTDI) Dataset Specification](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/) — Verifiable lineage, open licensing, PII risk assessment, and zero-drift metadata synchronization.
- **Seminal Papers & Fairness Audits:**
  - [A Data-Driven Approach to Predict the Success of Bank Telemarketing](https://doi.org/10.1016/j.dss.2014.03.001) — Sergio Moro, Paulo Cortez, Paulo Rita (2014) [`seminal-paper`]. Moro, S., Cortez, P., & Rita, P. (2014). A data-driven approach to predict the success of bank telemarketing. Decision Support Systems, 62, 22-31. https://doi.org/10.1016/j.dss.2014.03.001
  - [Bias Begins with Data: The FairGround Corpus for Robust and Reproducible Research on Algorithmic Fairness](https://arxiv.org/abs/2510.22363) — Jan Simson, Alessandro Fabris, Cosima Froehner, Frauke Kreuter, Christoph Kern (2025) [`fairness-audit`]. Simson, J., Fabris, A., Froehner, C., Kreuter, F., & Kern, C. (2025). Bias begins with data: The FairGround corpus for robust and reproducible research on algorithmic fairness. arXiv preprint arXiv:2510.22363.
  - [A Comprehensive Review and Benchmarking of Fairness-Aware Variants of Machine Learning Models](https://doi.org/10.3390/a18070435) — George Raftopoulos, Nikos Fazakis, Gregory Davrazos, Sotiris Kotsiantis (2025) [`fairness-audit`]. Raftopoulos, G., Fazakis, N., Davrazos, G., & Kotsiantis, S. (2025). A comprehensive review and benchmarking of fairness-aware variants of machine learning models. Algorithms, 18(7), 435. https://doi.org/10.3390/a18070435

The build obtains the pinned publisher source and verifies its digest before preparing and serving this sample. Attribution and licence terms above continue to apply.
