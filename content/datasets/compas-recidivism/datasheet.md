---
pretty_name: 'ProPublica COMPAS Two-Year Recidivism'
task_categories:
    - tabular-classification
task_ids:
    - 'binary-classification'
    - 'multiclass-classification'
license: 'unknown'
size_categories:
    - '1K<n<10K'
source_datasets:
    - 'propublica/compas-analysis (compas-scores-two-years.csv)'
tags:
    - 'criminal-justice'
    - 'advanced'
    - 'binary'
    - 'fairness-impossibility'
    - 'pii-exclusion'
    - 'target-leakage'
    - 'recidivism'
---

# ProPublica COMPAS Two-Year Recidivism

**Domain:** Criminal Justice | **Difficulty:** Advanced | **Task:** Binary Classification | **Rows:** 7,214 | **Columns:** 53 | **CSV Size:** 2,546,489 bytes | **License:** No licence declared ([upstream](https://github.com/propublica/compas-analysis))

## 1. Dataset Summary & Motivation

Aligned with [Hugging Face Dataset Summary](https://huggingface.co/docs/hub/en/datasets-cards), [Datasheets for Datasets (Motivation)](https://cacm.acm.org/research/datasheets-for-datasets/), and [Google Data Cards Playbook (Purpose & Intentionality)](https://sites.research.google/datacardsplaybook/).

- **Overview:** The ProPublica COMPAS Two-Year Recidivism dataset contains `7,214` pretrial defendants screened in Broward County, Florida during 2013–2014 (`3,251` rearrested within two years [`1`, 45.07%] vs. `3,963` not rearrested [`0`, 54.93%]) across `53` columns linking Sheriff's Office COMPAS risk scores, Clerk of Courts criminal histories, and jail custody logs. It supports primary binary recidivism prediction (`two_year_recid`) and secondary multiclass black-box surrogate auditing (`score_text`: `Low`, `Medium`, `High`).
- **Original Purpose & Creators:** Compiled via Florida Sunshine Law public-records requests and entity-resolution linkage by ProPublica investigative data journalists Julia Angwin, Jeff Larson, Surya Mattu, and Lauren Kirchner ([Angwin et al., 2016](https://www.propublica.org/article/machine-bias-risk-assessments-in-criminal-sentencing); [Larson et al., 2016](https://www.propublica.org/article/how-we-analyzed-the-compas-recidivism-algorithm)) to audit racial disparities in Northpointe's (now Equivant's) Correctional Offender Management Profiling for Alternative Sanctions (COMPAS) software.
- **Benchmark & Pedagogical Significance:** COMPAS is arguably the most consequential dataset in AI ethics history: the clash between ProPublica (False Positive / False Negative error-rate disparity) and Northpointe (Predictive Parity / calibration) directly inspired the **Fairness Impossibility Theorems** of [Chouldechova (2017)](https://journals.sagepub.com/doi/full/10.1089/big.2016.0047) and [Kleinberg, Mullainathan, & Raghavan (2017)](https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.ITCS.2017.43), as well as critical sociotechnical scholarship on construct validity and arrest bias ([Bao et al., 2021](https://arxiv.org/abs/2106.05498)). Simultaneously, its raw 53-column schema is the ultimate stress test for client-side ML guardrails against **PII memorization**, **UI-freezing high-cardinality one-hot encoding**, and **post-outcome target leakage**.

## 2. Dataset Structure & Composition

Aligned with [Hugging Face Dataset Structure](https://huggingface.co/docs/hub/en/datasets-cards), [Datasheets for Datasets (Composition)](https://cacm.acm.org/research/datasheets-for-datasets/), and [OTDI Quality Metrics](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Unit of Observation:** One pretrial criminal defendant screened with the COMPAS risk assessment instrument in Broward County, Florida (2013-2014).
- **File & Parsing Specification:** Not bundled: downloaded on demand from ProPublica's repository (commit `bafff5d`, `2,546,489` bytes, CRLF line endings, `7,214` rows, `53` columns, delimiter `","`, `hasHeader: true`).
- **Classification Target(s) & Class Distribution:**
  - **Default Target:** `two_year_recid` (`binary-classification`). Positive class is encoded as `1`. Exact class distribution in `data.csv`: `0` (Not rearrested within 2 years): **3,963** (54.93%); `1` (Rearrested within 2 years): **3,251** (45.07%).
  - **Alternative Classification Target(s):**
  - `score_text` (`multiclass-classification`): Surrogate black-box audit: predict COMPAS's assigned risk tier ('Low', 'Medium', or 'High') from defendant demographics and prior counts to inspect how COMPAS weights race and age. (auto-disables leaky columns: `decile_score`, `decile_score_1`, `v_decile_score`, `v_score_text`, `is_recid`, `r_case_number`, `r_charge_degree`, `r_days_from_arrest`, `r_offense_date`, `r_charge_desc`, `r_jail_in`, `r_jail_out`, `violent_recid`, `is_violent_recid`, `vr_case_number`, `vr_charge_degree`, `vr_offense_date`, `vr_charge_desc`, `in_custody`, `out_custody`, `start`, `end`, `event`, `two_year_recid`)
- **Excluded Columns (Identifiers, Redundancy & Leakage Controls):**
  - **`id`** (`semanticRole: "identifier"`, `defaultSelected: false`): Unique row identifier; causes overfitting and freezes one-hot encoders.
  - **`name`** (`semanticRole: "identifier"`, `defaultSelected: false`): Direct personal identifier (PII) with 7,158 unique strings; must never be used in training.
  - **`first`** (`semanticRole: "identifier"`, `defaultSelected: false`): Direct personal identifier (PII) and demographic proxy with 2,800 unique strings.
  - **`last`** (`semanticRole: "identifier"`, `defaultSelected: false`): Direct personal identifier (PII) and ethnic proxy with 3,950 unique strings.
  - **`compas_screening_date`** (`semanticRole: "identifier"`, `defaultSelected: false`): Administrative timestamp string (690 unique dates); excluded to prevent UI-blocking high-cardinality encoding.
  - **`dob`** (`semanticRole: "identifier"`, `defaultSelected: false`): Direct personal identifier (5,452 unique dates); age is already captured quantitatively in 'age'.
  - **`decile_score`** (`semanticRole: "leaky"`, `defaultSelected: false`): Proprietary COMPAS model output score; must be excluded when training an independent recidivism classifier.
  - **`days_b_screening_arrest`** (`semanticRole: "feature"`, `defaultSelected: false`): Administrative record-linkage timing offset (307 missing values) rather than defendant risk attribute.
  - **`c_jail_in`** (`semanticRole: "identifier"`, `defaultSelected: false`): High-cardinality booking timestamp (6,907 unique values).
  - **`c_jail_out`** (`semanticRole: "identifier"`, `defaultSelected: false`): High-cardinality release timestamp (6,880 unique values).
  - **`c_case_number`** (`semanticRole: "identifier"`, `defaultSelected: false`): Unique court docket identifier (7,192 unique values).
  - **`c_offense_date`** (`semanticRole: "identifier"`, `defaultSelected: false`): Administrative date string with 1,159 missing values.
  - **`c_arrest_date`** (`semanticRole: "identifier"`, `defaultSelected: false`): Sparse administrative date string (84.2% missing).
  - **`c_days_from_compas`** (`semanticRole: "feature"`, `defaultSelected: false`): Administrative record-matching interval unchecked by default.
  - **`c_charge_desc`** (`semanticRole: "identifier"`, `defaultSelected: false`): High-cardinality statutory text (437 unique strings) that causes sparse one-hot bloat in browser models.
  - **`is_recid`** (`semanticRole: "leaky"`, `defaultSelected: false`): Post-outcome recidivism indicator recorded after screening; directly leaks 'two_year_recid'.
  - **`r_case_number`** (`semanticRole: "leaky"`, `defaultSelected: false`): Post-outcome rearrest docket number: non-null only when defendant reoffended.
  - **`r_charge_degree`** (`semanticRole: "leaky"`, `defaultSelected: false`): Post-outcome rearrest attribute known only after recidivism occurs.
  - **`r_days_from_arrest`** (`semanticRole: "leaky"`, `defaultSelected: false`): Post-outcome rearrest timing variable.
  - **`r_offense_date`** (`semanticRole: "leaky"`, `defaultSelected: false`): Post-outcome rearrest date.
  - **`r_charge_desc`** (`semanticRole: "leaky"`, `defaultSelected: false`): Post-outcome rearrest description.
  - **`r_jail_in`** (`semanticRole: "leaky"`, `defaultSelected: false`): Post-outcome rearrest booking date.
  - **`r_jail_out`** (`semanticRole: "leaky"`, `defaultSelected: false`): Post-outcome rearrest release date.
  - **`violent_recid`** (`semanticRole: "leaky"`, `defaultSelected: false`): 100% empty legacy column in ProPublica's SQLite export (all 7,214 values missing).
  - **`is_violent_recid`** (`semanticRole: "leaky"`, `defaultSelected: false`): Post-outcome violent rearrest indicator that directly implies general recidivism.
  - **`vr_case_number`** (`semanticRole: "leaky"`, `defaultSelected: false`): Post-outcome violent rearrest identifier.
  - **`vr_charge_degree`** (`semanticRole: "leaky"`, `defaultSelected: false`): Post-outcome violent rearrest charge degree.
  - **`vr_offense_date`** (`semanticRole: "leaky"`, `defaultSelected: false`): Post-outcome violent rearrest date.
  - **`vr_charge_desc`** (`semanticRole: "leaky"`, `defaultSelected: false`): Post-outcome violent rearrest text.
  - **`type_of_assessment`** (`semanticRole: "identifier"`, `defaultSelected: false`): Zero-variance constant metadata column ('Risk of Recidivism').
  - **`decile_score_1`** (`semanticRole: "leaky"`, `defaultSelected: false`): Duplicate proprietary COMPAS decile score.
  - **`score_text`** (`semanticRole: "leaky"`, `defaultSelected: false`): Proprietary COMPAS categorical risk output (excluded when predicting 'two_year_recid', or usable as a surrogate-audit target).
  - **`screening_date`** (`semanticRole: "identifier"`, `defaultSelected: false`): Duplicate administrative timestamp string.
  - **`v_type_of_assessment`** (`semanticRole: "identifier"`, `defaultSelected: false`): Zero-variance constant metadata column ('Risk of Violence').
  - **`v_decile_score`** (`semanticRole: "leaky"`, `defaultSelected: false`): Proprietary COMPAS violent risk score.
  - **`v_score_text`** (`semanticRole: "leaky"`, `defaultSelected: false`): Proprietary COMPAS violent risk tier.
  - **`v_screening_date`** (`semanticRole: "identifier"`, `defaultSelected: false`): Administrative timestamp string.
  - **`in_custody`** (`semanticRole: "leaky"`, `defaultSelected: false`): Post-screening custody tracking date.
  - **`out_custody`** (`semanticRole: "leaky"`, `defaultSelected: false`): Post-screening custody tracking date.
  - **`priors_count_1`** (`semanticRole: "identifier"`, `defaultSelected: false`): Exact SQLite-join duplicate of 'priors_count'.
  - **`start`** (`semanticRole: "leaky"`, `defaultSelected: false`): Post-screening survival-analysis interval boundary.
  - **`end`** (`semanticRole: "leaky"`, `defaultSelected: false`): Post-outcome follow-up duration until rearrest or censoring; leaks 'two_year_recid'.
  - **`event`** (`semanticRole: "leaky"`, `defaultSelected: false`): Post-outcome survival event indicator leaking 'two_year_recid'.
- **Complete Feature Schema (`columns[]` synchronized with `metadata.json`):**

| #  | Column (`name`)           | Display Name                             | Type          | Role         | Default | Unit    | Missing | Implicit Missing / Coded Labels                                                                                                                                  |
| -- | ------------------------- | ---------------------------------------- | ------------- | ------------ | ------- | ------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1  | `id`                      | Defendant Row ID                         | `text`        | `identifier` | No      | —       | 0       | Internal ProPublica SQLite defendant record identifier.                                                                                                          |
| 2  | `name`                    | Full Name                                | `text`        | `identifier` | No      | —       | 0       | Defendant full name from public Broward County court records.                                                                                                    |
| 3  | `first`                   | First Name                               | `text`        | `identifier` | No      | —       | 0       | Defendant given first name.                                                                                                                                      |
| 4  | `last`                    | Last Name                                | `text`        | `identifier` | No      | —       | 0       | Defendant surname.                                                                                                                                               |
| 5  | `compas_screening_date`   | COMPAS Screening Date                    | `date`        | `identifier` | No      | —       | 0       | Date on which the pretrial COMPAS risk assessment was administered.                                                                                              |
| 6  | `sex`                     | Sex                                      | `categorical` | `sensitive`  | Yes     | —       | 0       | Recorded binary sex of the defendant (80.6% Male, 19.4% Female).                                                                                                 |
| 7  | `dob`                     | Date of Birth                            | `date`        | `identifier` | No      | —       | 0       | Defendant date of birth (YYYY-MM-DD).                                                                                                                            |
| 8  | `age`                     | Age                                      | `numeric`     | `sensitive`  | Yes     | `years` | 0       | Defendant age in years at COMPAS screening.                                                                                                                      |
| 9  | `age_cat`                 | Age Category                             | `categorical` | `sensitive`  | Yes     | —       | 0       | Discretized age tier used in ProPublica's fairness regression ('Less than 25', '25 - 45', 'Greater than 45').                                                    |
| 10 | `race`                    | Race                                     | `categorical` | `sensitive`  | Yes     | —       | 0       | Sheriff's Office racial/ethnic classification ('African-American', 'Caucasian', 'Hispanic', 'Asian', 'Native American', 'Other').                                |
| 11 | `juv_fel_count`           | Juvenile Felony Count                    | `numeric`     | `feature`    | Yes     | —       | 0       | Number of prior juvenile felony offenses on record.                                                                                                              |
| 12 | `decile_score`            | COMPAS Recidivism Decile (1-10)          | `numeric`     | `leaky`      | No      | —       | 0       | Northpointe's proprietary 1-to-10 general recidivism risk decile output.                                                                                         |
| 13 | `juv_misd_count`          | Juvenile Misdemeanor Count               | `numeric`     | `feature`    | Yes     | —       | 0       | Number of prior juvenile misdemeanor offenses on record.                                                                                                         |
| 14 | `juv_other_count`         | Juvenile Other Count                     | `numeric`     | `feature`    | Yes     | —       | 0       | Number of prior non-felony/non-misdemeanor juvenile infractions.                                                                                                 |
| 15 | `priors_count`            | Prior Adult Offenses Count               | `numeric`     | `feature`    | Yes     | —       | 0       | Total count of prior adult criminal offenses prior to COMPAS screening.                                                                                          |
| 16 | `days_b_screening_arrest` | Days Between Screening & Arrest          | `numeric`     | `feature`    | No      | `days`  | 307     | Signed day offset between COMPAS screening and index arrest (ProPublica filtered to [-30, 30] in their 6,172-row subset).                                        |
| 17 | `c_jail_in`               | Index Custody Booking Time               | `datetime`    | `identifier` | No      | —       | 307     | Timestamp when defendant entered Broward County jail for the index offense.                                                                                      |
| 18 | `c_jail_out`              | Index Custody Release Time               | `datetime`    | `identifier` | No      | —       | 307     | Timestamp when defendant exited Broward County jail for the index offense.                                                                                       |
| 19 | `c_case_number`           | Index Case Number                        | `text`        | `identifier` | No      | —       | 22      | Broward County Clerk court docket number for the index charge.                                                                                                   |
| 20 | `c_offense_date`          | Index Offense Date                       | `date`        | `identifier` | No      | —       | 1,159   | Recorded date of the index alleged offense.                                                                                                                      |
| 21 | `c_arrest_date`           | Index Arrest Date                        | `date`        | `identifier` | No      | —       | 6,077   | Recorded arrest date when no offense date was filed (missing in 6,077 rows).                                                                                     |
| 22 | `c_days_from_compas`      | Days From Index Offense to COMPAS        | `numeric`     | `feature`    | No      | `days`  | 22      | Unsigned days elapsed between index offense/arrest and COMPAS screening.                                                                                         |
| 23 | `c_charge_degree`         | Index Charge Degree                      | `categorical` | `feature`    | Yes     | —       | 0       | Labels: `F`=Felony; `M`=Misdemeanor                                                                                                                              |
| 24 | `c_charge_desc`           | Index Charge Description                 | `text`        | `identifier` | No      | —       | 29      | Free-text statutory description of the index charge (437 distinct strings).                                                                                      |
| 25 | `is_recid`                | Any Recidivism Flag (Leaky)              | `boolean`     | `leaky`      | No      | —       | 0       | Labels: `0`=No rearrest recorded; `1`=Rearrested                                                                                                                 |
| 26 | `r_case_number`           | Recidivism Case Number                   | `text`        | `leaky`      | No      | —       | 3,743   | Court docket number of the post-screening recidivism arrest (null if none).                                                                                      |
| 27 | `r_charge_degree`         | Recidivism Charge Degree                 | `categorical` | `leaky`      | No      | —       | 3,743   | Statutory severity of the subsequent rearrest offense.                                                                                                           |
| 28 | `r_days_from_arrest`      | Recidivism Jail Lag Days                 | `numeric`     | `leaky`      | No      | `days`  | 4,898   | Days between recidivism arrest and booking.                                                                                                                      |
| 29 | `r_offense_date`          | Recidivism Offense Date                  | `date`        | `leaky`      | No      | —       | 3,743   | Date of subsequent rearrest offense.                                                                                                                             |
| 30 | `r_charge_desc`           | Recidivism Charge Description            | `text`        | `leaky`      | No      | —       | 3,801   | Statutory description of the subsequent rearrest charge.                                                                                                         |
| 31 | `r_jail_in`               | Recidivism Jail In Date                  | `date`        | `leaky`      | No      | —       | 4,898   | Jail booking date for the subsequent rearrest.                                                                                                                   |
| 32 | `r_jail_out`              | Recidivism Jail Out Date                 | `date`        | `leaky`      | No      | —       | 4,898   | Jail release date for the subsequent rearrest.                                                                                                                   |
| 33 | `violent_recid`           | Legacy Empty Violent Recidivism          | `numeric`     | `leaky`      | No      | —       | 7,214   | Deprecated column left completely empty (100% null across all 7,214 rows) in ProPublica's export.                                                                |
| 34 | `is_violent_recid`        | Violent Recidivism Flag (Leaky)          | `boolean`     | `leaky`      | No      | —       | 0       | Labels: `0`=No violent rearrest; `1`=Violent rearrest                                                                                                            |
| 35 | `vr_case_number`          | Violent Recidivism Case Number           | `text`        | `leaky`      | No      | —       | 6,395   | Court docket number for post-screening violent offense.                                                                                                          |
| 36 | `vr_charge_degree`        | Violent Recidivism Charge Degree         | `categorical` | `leaky`      | No      | —       | 6,395   | Severity tier of post-screening violent rearrest.                                                                                                                |
| 37 | `vr_offense_date`         | Violent Recidivism Offense Date          | `date`        | `leaky`      | No      | —       | 6,395   | Date of post-screening violent offense.                                                                                                                          |
| 38 | `vr_charge_desc`          | Violent Recidivism Charge Description    | `text`        | `leaky`      | No      | —       | 6,395   | Statutory description of post-screening violent offense.                                                                                                         |
| 39 | `type_of_assessment`      | COMPAS Assessment Type                   | `categorical` | `identifier` | No      | —       | 0       | Constant string ('Risk of Recidivism') across all 7,214 rows.                                                                                                    |
| 40 | `decile_score_1`          | COMPAS Recidivism Decile (Join Copy)     | `numeric`     | `leaky`      | No      | —       | 0       | Duplicate of 'decile_score' produced by ProPublica's SQLite table join (disambiguated from duplicate header).                                                    |
| 41 | `score_text`              | COMPAS Risk Tier ('Low'/'Medium'/'High') | `categorical` | `leaky`      | No      | —       | 0       | Coarsened COMPAS risk tier ('Low' = deciles 1-4, 'Medium' = 5-7, 'High' = 8-10); exhibits 44.8% FPR on Black non-recidivists vs. 23.5% on White non-recidivists. |
| 42 | `screening_date`          | Screening Date (Join Copy)               | `date`        | `identifier` | No      | —       | 0       | Duplicate screening date column from ProPublica's SQLite join.                                                                                                   |
| 43 | `v_type_of_assessment`    | Violent Assessment Type                  | `categorical` | `identifier` | No      | —       | 0       | Constant string ('Risk of Violence') across all 7,214 rows.                                                                                                      |
| 44 | `v_decile_score`          | COMPAS Violence Decile (1-10)            | `numeric`     | `leaky`      | No      | —       | 0       | Northpointe's proprietary 1-to-10 violent recidivism risk decile.                                                                                                |
| 45 | `v_score_text`            | COMPAS Violence Risk Tier                | `categorical` | `leaky`      | No      | —       | 0       | Coarsened COMPAS violent risk category ('Low', 'Medium', 'High').                                                                                                |
| 46 | `v_screening_date`        | Violence Screening Date                  | `date`        | `identifier` | No      | —       | 0       | Date of COMPAS violent risk screening.                                                                                                                           |
| 47 | `in_custody`              | Subsequent Custody Start                 | `date`        | `leaky`      | No      | —       | 236     | Custody start date used in ProPublica's Cox survival table.                                                                                                      |
| 48 | `out_custody`             | Subsequent Custody End                   | `date`        | `leaky`      | No      | —       | 236     | Custody release date used in ProPublica's Cox survival table.                                                                                                    |
| 49 | `priors_count_1`          | Prior Offenses Count (Join Copy)         | `numeric`     | `identifier` | No      | —       | 0       | Exact duplicate of 'priors_count' from ProPublica's SQLite join (disambiguated from duplicate header).                                                           |
| 50 | `start`                   | Survival Interval Start                  | `numeric`     | `leaky`      | No      | `days`  | 0       | Start day of Cox proportional-hazards follow-up interval.                                                                                                        |
| 51 | `end`                     | Survival Interval End                    | `numeric`     | `leaky`      | No      | `days`  | 0       | End day of follow-up (time until rearrest or 2016-04-01 censoring); directly reveals recidivism.                                                                 |
| 52 | `event`                   | Survival Rearrest Event (Leaky)          | `boolean`     | `leaky`      | No      | —       | 0       | Labels: `0`=Censored; `1`=Rearrest event                                                                                                                         |
| 53 | `two_year_recid`          | Two-Year Recidivism                      | `boolean`     | `target`     | No      | —       | 0       | Labels: `0`=Not rearrested within 2 years; `1`=Rearrested within 2 years                                                                                         |

## 3. Provenance, Collection Process & Sampling Frame

Aligned with [Datasheets for Datasets (Collection Process)](https://cacm.acm.org/research/datasheets-for-datasets/), [Google Data Cards Playbook (Provenance & Upstream Sources)](https://sites.research.google/datacardsplaybook/), and [OTDI Verifiable Lineage](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Upstream Lineage:** Originated in **2016** by Julia Angwin, Jeff Larson, Surya Mattu, Lauren Kirchner. Canonical dataset homepage: [ProPublica COMPAS Two-Year Recidivism Canonical Homepage](https://www.propublica.org/article/how-we-analyzed-the-compas-recidivism-algorithm); upstream raw data source: [Upstream Source Repository](https://github.com/propublica/compas-analysis/blob/master/compas-scores-two-years.csv).
- **Acquisition Method:** ProPublica obtained 18,610 COMPAS score records from the Broward County Sheriff's Office (January 2013–December 2014), matched them by name and date of birth against Broward County Clerk of Courts criminal dockets through April 1, 2016 and Broward County jail logs, and retained the `7,214` pretrial defendants with two years of follow-up observation outside continuous incarceration ([Larson et al., 2016](https://www.propublica.org/article/how-we-analyzed-the-compas-recidivism-algorithm)).
- **Population & Sampling Frame:** Pretrial defendants assessed in a single Florida jurisdiction (Broward County) in 2013–2014 who had at least two years of post-release follow-up window prior to April 2016 (note: in ProPublica's logistic regression notebook, an additional filter `days_b_screening_arrest` in `[-30, 30]` narrows `7,214` to `6,172` rows; packaging the complete `7,214`-row `compas-scores-two-years.csv` preserves full upstream transparency).

## 4. Preprocessing, Cleaning & Data Quality Audit

Aligned with [Datasheets for Datasets (Preprocessing/Cleaning/Labeling)](https://cacm.acm.org/research/datasheets-for-datasets/), [Google Data Cards Playbook (Transformations)](https://sites.research.google/datacardsplaybook/), and [OTDI Completeness Criteria](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Upstream Transformations & Standardization:** Derived directly (`2,539,282` bytes, LF line endings) from [`propublica/compas-analysis/compas-scores-two-years.csv`](https://github.com/propublica/compas-analysis/blob/master/compas-scores-two-years.csv) with **one essential header-integrity fix**: ProPublica's raw SQLite `JOIN` exported two duplicate column headers (`decile_score` at columns 11 and 39, and `priors_count` at columns 14 and 48), which silently overwrite keys in browser `Record<string, unknown>` parsers. Column 39 is standardized to `decile_score_1` and column 48 to `priors_count_1`.
- **Missing Data Profile:**
  - **Explicit Missingness:** `stats.hasMissingValues` is **`true`** with **71,220** explicit missing cells across 22 column(s): `days_b_screening_arrest` (307 missing, 4.26%), `c_jail_in` (307 missing, 4.26%), `c_jail_out` (307 missing, 4.26%), `c_case_number` (22 missing, 0.30%), `c_offense_date` (1,159 missing, 16.07%), `c_arrest_date` (6,077 missing, 84.24%), `c_days_from_compas` (22 missing, 0.30%), `c_charge_desc` (29 missing, 0.40%), `r_case_number` (3,743 missing, 51.89%), `r_charge_degree` (3,743 missing, 51.89%), `r_days_from_arrest` (4,898 missing, 67.90%), `r_offense_date` (3,743 missing, 51.89%), `r_charge_desc` (3,801 missing, 52.69%), `r_jail_in` (4,898 missing, 67.90%), `r_jail_out` (4,898 missing, 67.90%), `violent_recid` (7,214 missing, 100.00%), `vr_case_number` (6,395 missing, 88.65%), `vr_charge_degree` (6,395 missing, 88.65%), `vr_offense_date` (6,395 missing, 88.65%), `vr_charge_desc` (6,395 missing, 88.65%), `in_custody` (236 missing, 3.27%), `out_custody` (236 missing, 3.27%). Browser CSV parsing treats `""`, `"NA"`, `"NaN"`, `"None"` as missing (`null`/`NaN`).
  - **Disguised / Implicit Missingness:** No disguised sentinel missing values (`implicitMissingValues`) are present in this dataset.
- **Known Formatting & Modeling Traps:** Out of 53 columns, **only 9 pre-screening columns are selected by default** (`sex`, `age`, `age_cat`, `race`, `juv_fel_count`, `juv_misd_count`, `juv_other_count`, `priors_count`, `c_charge_degree`): `17` columns are marked `semanticRole: 'identifier'` (names, DOBs, case numbers, timestamps, constant strings, and `priors_count_1`), `24` columns are marked `semanticRole: 'leaky'` (proprietary COMPAS scores `decile_score`, `score_text`, `v_decile_score`, `v_score_text`, completely empty `violent_recid` [7,214 missing], and post-screening rearrest/survival outcomes `is_recid`, `r_*`, `vr_*`, `end`, `event`), and `2` administrative record-linkage lag columns (`days_b_screening_arrest`, `c_days_from_compas`) are unchecked by default.

## 5. Recommended Uses & Fit-for-Purpose Guidance

Aligned with [Datasheets for Datasets (Uses)](https://cacm.acm.org/research/datasheets-for-datasets/), [Google Data Cards Playbook (Usage Guidance)](https://sites.research.google/datacardsplaybook/), and [Hugging Face Supported Tasks](https://huggingface.co/docs/hub/en/datasets-cards).

- **Recommended Pedagogical Classification Workflows:** 1. **Independent Classifier vs. Black-Box Audit:** Train interpretable **Logistic Regression** and **Decision Trees** on the 9 pre-screening features to verify Dressel & Farid's (2018) famous finding that simple linear/tree models on `age` and `priors_count` match proprietary COMPAS accuracy (~65–67%)! 2. **Surrogate Black-Box Audit:** Switch target to `score_text` (`Low`/`Medium`/`High`) to inspect how strongly `race` and `age` predict COMPAS risk tiers. Evaluate **Accuracy**, **ROC-AUC**, **False Positive Rate**, **False Negative Rate**, **Positive Predictive Value (Calibration)**, and **Equalized Odds**.
- **Out-of-Scope & Inappropriate Uses:** Must NEVER be used to build or justify real-world pretrial detention, bail, sentencing, or parole tools; as [Bao et al. (2021)](https://arxiv.org/abs/2106.05498) demonstrate, rearrest is a racially biased proxy for crime.

## 6. Ethical Considerations, Privacy & Fairness Analysis

Aligned with [Hugging Face Considerations for Using the Data](https://huggingface.co/docs/hub/en/datasets-cards), [Google Data Cards Playbook (Human Attributes & Sensitive Data)](https://sites.research.google/datacardsplaybook/), and [OTDI Privacy/PII Requirements](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Sensitive & Protected Attributes:**
  - **`sex`** (`categorical`): Recorded binary sex of the defendant (80.6% Male, 19.4% Female).
  - **`age`** (`numeric`): Defendant age in years at COMPAS screening.
  - **`age_cat`** (`categorical`): Discretized age tier used in ProPublica's fairness regression ('Less than 25', '25 - 45', 'Greater than 45').
  - **`race`** (`categorical`): Sheriff's Office racial/ethnic classification ('African-American', 'Caucasian', 'Hispanic', 'Asian', 'Native American', 'Other').
- **Privacy & PII Assessment:** **High Sensitivity Warning:** Because Florida criminal docket records are public under state Sunshine laws, ProPublica's CSV retains real defendant names (`name`, `first`, `last`), dates of birth (`dob`), and court docket numbers (`c_case_number`). Our `metadata.json` strictly locks these columns as `semanticRole: 'identifier'` with `defaultSelected: false`, and educators must highlight the dignitary and privacy harms of public criminal-justice datasets ([Fabris et al., 2022](https://doi.org/10.1007/s10618-022-00854-z)).
- **Documented Biases & Representational Harms:** Direct verification on `data.csv` confirms the landmark disparity: **African-American** defendants (`n = 3,696`, 51.4% rearrest rate) who **did not reoffend** were labeled `Medium`/`High` risk by COMPAS **44.8%** of the time (`805/1,795` False Positive Rate), compared to **23.5%** (`349/1,488`) for **Caucasian** non-recidivists (`n = 2,454`, 39.4% rearrest rate)! Conversely, among defendants who **did** get rearrested, Caucasian defendants were labeled `Low` risk **47.7%** of the time (`461/966` False Negative Rate) vs. **28.0%** (`532/1,901`) for African-American defendants. Because base rearrest rates differ across groups (51.4% vs. 39.4%—driven partly by differential policing of Black neighborhoods; [Bao et al., 2021](https://arxiv.org/abs/2106.05498); [Almasoud & Idowu, 2025](https://doi.org/10.1007/s43681-024-00541-3)), [Chouldechova (2017)](https://journals.sagepub.com/doi/full/10.1089/big.2016.0047) proved that **calibration (Predictive Parity)** and **error-rate balance (Equalized Odds)** are mathematically impossible to satisfy simultaneously.
- **Recommended Fairness Audits:** Compare **False Positive Rate**, **False Negative Rate**, **Positive Predictive Value**, and **Selection Rate** across `race` (`African-American`, `Caucasian`, `Hispanic`), `sex`, `age_cat`, and their intersections (`Young African-American Men`), and move the classification probability threshold slider in the UI to experience the Chouldechova/Kleinberg trade-off interactively.

## 7. Distribution, Licensing & Maintenance

Aligned with [Datasheets for Datasets (Distribution & Maintenance)](https://cacm.acm.org/research/datasheets-for-datasets/) and [OTDI Open Licensing Requirements](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **License & Redistribution Terms:** ProPublica's `compas-analysis` repository declares no licence. Samata does not redistribute the file: the app downloads it from that repository, pinned to commit `bafff5d`, when you load it, and checks its SHA-256 before use.
- **Maintenance & Versioning:** Static archival snapshot published by ProPublica (`2016`, Florida public-domain court records / ProPublica open journalism release) and widely redistributed across academic fairness packages (`AIF360`, `Fairlearn`, `FairGround`).

## 8. Sources, Public Dataset Cards & Academic References

Full linked attribution to every public dataset card, upstream repository, transparency standard, and peer-reviewed study consulted during the creation of this Dataset Card.

- **Public Dataset Cards, Repositories & Standards Consulted:**
  - [ProPublica Methodology & Repository: How We Analyzed the COMPAS Recidivism Algorithm](https://www.propublica.org/article/how-we-analyzed-the-compas-recidivism-algorithm) — Verified record-linkage rules, two-year follow-up window, and Broward County public-record provenance.
  - [ProPublica GitHub: propublica/compas-analysis](https://github.com/propublica/compas-analysis) — Verified raw 7,214 x 53 CSV schema and identified the duplicate SQLite join headers (decile_score, priors_count).
  - [NeurIPS Datasets & Benchmarks Audit: It's COMPASlicated (Bao et al., 2021)](https://arxiv.org/abs/2106.05498) — Incorporated construct-validity, pretrial discretion, and measurement-bias warnings.
  - [Hugging Face Dataset Cards Documentation](https://huggingface.co/docs/hub/en/datasets-cards) — Structural hierarchy and YAML frontmatter conventions.
  - [Datasheets for Datasets (Gebru et al., 2021)](https://cacm.acm.org/research/datasheets-for-datasets/) — Lifecycle motivation, composition, collection, preprocessing, uses, distribution, and maintenance dimensions.
  - [Google Research Data Cards Playbook (Pushkarna et al., 2022)](https://sites.research.google/datacardsplaybook/) — Purpose, provenance, human attributes, transformations, and fit-for-purpose guidance.
  - [AI Alliance Open Trusted Data Initiative (OTDI) Dataset Specification](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/) — Verifiable lineage, open licensing, PII risk assessment, and zero-drift metadata synchronization.
- **Seminal Papers & Fairness Audits:**
  - [Machine Bias: There's Software Used Across the Country to Predict Future Criminals. And It's Biased Against Blacks.](https://www.propublica.org/article/machine-bias-risk-assessments-in-criminal-sentencing) — Julia Angwin, Jeff Larson, Surya Mattu, Lauren Kirchner (2016) [`fairness-audit`]. Angwin, J., Larson, J., Mattu, S., & Kirchner, L. (2016, May 23). Machine bias. ProPublica. https://www.propublica.org/article/machine-bias-risk-assessments-in-criminal-sentencing
  - [Fair Prediction with Disparate Impact: A Study of Bias in Recidivism Prediction Instruments](https://journals.sagepub.com/doi/full/10.1089/big.2016.0047) — Alexandra Chouldechova (2017) [`seminal-paper`]. Chouldechova, A. (2017). Fair prediction with disparate impact: A study of bias in recidivism prediction instruments. Big Data, 5(2), 153-163. https://doi.org/10.1089/big.2016.0047
  - [Inherent Trade-Offs in the Fair Determination of Risk Scores](https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.ITCS.2017.43) — Jon Kleinberg, Sendhil Mullainathan, Manish Raghavan (2017) [`seminal-paper`]. Kleinberg, J., Mullainathan, S., & Raghavan, M. (2017). Inherent trade-offs in the fair determination of risk scores. Proceedings of Innovations in Theoretical Computer Science (ITCS 2017), 43:1-43:23. https://doi.org/10.4230/LIPIcs.ITCS.2017.43
  - [It's COMPASlicated: The Messy Relationship between RAI Datasets and Algorithmic Fairness Benchmarks](https://arxiv.org/abs/2106.05498) — Michelle Bao, Angela Zhou, Samantha Zottola, Brian Brubach, Sarah Desmarais, Aaron Horowitz, Kristian Lum, Suresh Venkatasubramanian (2021) [`fairness-audit`]. Bao, M., Zhou, A., Zottola, S., Brubach, B., Desmarais, S., Horowitz, A., Lum, K., & Venkatasubramanian, S. (2021). It's COMPASlicated: The messy relationship between RAI datasets and algorithmic fairness benchmarks. NeurIPS 2021 Datasets and Benchmarks Track. https://arxiv.org/abs/2106.05498

The CSV is downloaded from ProPublica when selected; [ProPublica’s datastore terms](https://projects.propublica.org/datastore/terms/) govern its use.
