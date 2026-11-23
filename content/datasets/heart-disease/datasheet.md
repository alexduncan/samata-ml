---
pretty_name: 'Cleveland Heart Disease Diagnosis'
task_categories:
    - tabular-classification
task_ids:
    - 'multiclass-classification'
    - 'binary-classification'
license: 'cc-by-4.0'
size_categories:
    - 'n<1K'
source_datasets:
    - 'uci/heart-disease (id=45)'
tags:
    - 'healthcare'
    - 'intermediate'
    - 'multiclass'
    - 'coded-categoricals'
    - 'missing-values'
    - 'clinical-fairness'
    - 'cardiology'
---

# Cleveland Heart Disease Diagnosis

**Domain:** Healthcare | **Difficulty:** Intermediate | **Task:** Multiclass Classification | **Rows:** 303 | **Columns:** 14 | **CSV Size:** 11,334 bytes | **License:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

## 1. Dataset Summary & Motivation

Aligned with [Hugging Face Dataset Summary](https://huggingface.co/docs/hub/en/datasets-cards), [Datasheets for Datasets (Motivation)](https://cacm.acm.org/research/datasheets-for-datasets/), and [Google Data Cards Playbook (Purpose & Intentionality)](https://sites.research.google/datacardsplaybook/).

- **Overview:** The Cleveland Heart Disease dataset comprises 303 patient cardiology workups with 13 clinical, exercise-ECG, fluoroscopy, and scintigraphy attributes paired with a five-level angiographic coronary artery stenosis grade (`num`: `0` = `<50%` vessel narrowing [164 patients, 54.1%]; grades `1` [55], `2` [36], `3` [35], and `4` [13] = increasing vessel stenosis severity). It supports multiclass severity staging (`num`) and secondary binary exercise-angina classification (`exang`).
- **Original Purpose & Creators:** Collected at the Cleveland Clinic Foundation by Dr. Robert Detrano and collaborators alongside partner cardiology centers in Budapest (Andras Janosi), Zurich (William Steinbrunn), and Basel (Matthias Pfisterer) to validate a probabilistic diagnostic algorithm for coronary artery disease ([Detrano et al., 1989](<https://doi.org/10.1016/0002-9149(89)90524-9>)) and donated to UCI in 1988.
- **Benchmark & Pedagogical Significance:** Featured in both ML pedagogy and tabular fairness suites ([Hirzel & Feffer, 2023](https://arxiv.org/abs/2308.00133); [Simson et al., 2025](https://arxiv.org/abs/2510.22363)), Heart Disease teaches: (1) **one-hot encoding of integer-coded medical categories** (`cp` 1-4, `restecg` 0-2, `slope` 1-3, `thal` 3/6/7); (2) **imputing explicit missing values** (`4` in `ca`, `2` in `thal`); (3) **multiclass vs. collapsed severity rarity** (`num = 4` has only 13 patients); and (4) **sex-skewed clinical cohort bias**.

## 2. Dataset Structure & Composition

Aligned with [Hugging Face Dataset Structure](https://huggingface.co/docs/hub/en/datasets-cards), [Datasheets for Datasets (Composition)](https://cacm.acm.org/research/datasheets-for-datasets/), and [OTDI Quality Metrics](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Unit of Observation:** One clinical patient undergoing non-invasive cardiac evaluation and invasive coronary angiography at the Cleveland Clinic Foundation.
- **File & Parsing Specification:** Packaged at `/public/datasets/heart-disease/data.csv` (`11,334` bytes, `303` rows, `14` columns, delimiter `","`, `hasHeader: true`).
- **Classification Target(s) & Class Distribution:**
    - **Default Target:** `num` (`multiclass-classification`). Exact class distribution in `data.csv`: `0` (Grade 0: No significant disease (<50% narrowing)): **164** (54.13%); `1` (Grade 1: Mild/single-vessel coronary stenosis): **55** (18.15%); `2` (Grade 2: Moderate coronary stenosis): **36** (11.88%); `3` (Grade 3: Multi-vessel coronary stenosis): **35** (11.55%); `4` (Grade 4: Severe multi-vessel coronary stenosis): **13** (4.29%).
    - **Alternative Classification Target(s):**
    - `exang` (`binary-classification`): Predict whether exercise stress testing induces angina pectoris (1 = Yes, 0 = No) from baseline patient indicators. (auto-disables leaky columns: `oldpeak`, `slope`, `thalach`, `num`)
- **Excluded Columns (Identifiers, Redundancy & Leakage Controls):**
    - Only the classification target column (`num`) has `defaultSelected: false`; no identifier or post-outcome leaky predictor columns are present in `data.csv`.
- **Complete Feature Schema (`columns[]` synchronized with `metadata.json`):**

| #   | Column (`name`) | Display Name                        | Type          | Role        | Default | Unit    | Missing | Implicit Missing / Coded Labels                                                                                                                                                                                                                           |
| --- | --------------- | ----------------------------------- | ------------- | ----------- | ------- | ------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `age`           | Age                                 | `numeric`     | `sensitive` | Yes     | `years` | 0       | Patient age in years at the time of cardiac catheterization.                                                                                                                                                                                              |
| 2   | `sex`           | Sex                                 | `categorical` | `sensitive` | Yes     | —       | 0       | Labels: `0`=Female; `1`=Male                                                                                                                                                                                                                              |
| 3   | `cp`            | Chest Pain Type                     | `categorical` | `feature`   | Yes     | —       | 0       | Labels: `1`=Typical angina; `2`=Atypical angina; `3`=Non-anginal pain; `4`=Asymptomatic                                                                                                                                                                   |
| 4   | `trestbps`      | Resting Blood Pressure              | `numeric`     | `feature`   | Yes     | `mm Hg` | 0       | Resting systolic arterial blood pressure measured upon hospital admission.                                                                                                                                                                                |
| 5   | `chol`          | Serum Cholesterol                   | `numeric`     | `feature`   | Yes     | `mg/dL` | 0       | Total serum cholesterol concentration.                                                                                                                                                                                                                    |
| 6   | `fbs`           | Fasting Blood Sugar > 120 mg/dL     | `boolean`     | `feature`   | Yes     | —       | 0       | Labels: `0`=False (<= 120 mg/dL); `1`=True (> 120 mg/dL)                                                                                                                                                                                                  |
| 7   | `restecg`       | Resting ECG Results                 | `categorical` | `feature`   | Yes     | —       | 0       | Labels: `0`=Normal; `1`=ST-T wave abnormality (>0.05 mV elevation/depression); `2`=Probable or definite left ventricular hypertrophy (Estes criteria)                                                                                                     |
| 8   | `thalach`       | Max Heart Rate Achieved             | `numeric`     | `feature`   | Yes     | `bpm`   | 0       | Peak heart rate achieved during graded exercise stress testing.                                                                                                                                                                                           |
| 9   | `exang`         | Exercise-Induced Angina             | `boolean`     | `feature`   | Yes     | —       | 0       | Labels: `0`=No; `1`=Yes                                                                                                                                                                                                                                   |
| 10  | `oldpeak`       | ST Depression (Oldpeak)             | `numeric`     | `feature`   | Yes     | `mV`    | 0       | Magnitude of exercise-induced ST-segment depression relative to rest.                                                                                                                                                                                     |
| 11  | `slope`         | Peak Exercise ST Slope              | `categorical` | `feature`   | Yes     | —       | 0       | Labels: `1`=Upsloping; `2`=Flat; `3`=Downsloping                                                                                                                                                                                                          |
| 12  | `ca`            | Major Vessels Colored (Fluoroscopy) | `categorical` | `feature`   | Yes     | —       | 4       | Labels: `0`=0 major vessels; `1`=1 major vessel; `2`=2 major vessels; `3`=3 major vessels                                                                                                                                                                 |
| 13  | `thal`          | Thallium Stress Scintigraphy        | `categorical` | `feature`   | Yes     | —       | 2       | Labels: `3`=Normal perfusion; `6`=Fixed perfusion defect; `7`=Reversible perfusion defect                                                                                                                                                                 |
| 14  | `num`           | Angiographic Disease Grade          | `categorical` | `target`    | No      | —       | 0       | Labels: `0`=Grade 0: No significant disease (<50% narrowing); `1`=Grade 1: Mild/single-vessel coronary stenosis; `2`=Grade 2: Moderate coronary stenosis; `3`=Grade 3: Multi-vessel coronary stenosis; `4`=Grade 4: Severe multi-vessel coronary stenosis |

## 3. Provenance, Collection Process & Sampling Frame

Aligned with [Datasheets for Datasets (Collection Process)](https://cacm.acm.org/research/datasheets-for-datasets/), [Google Data Cards Playbook (Provenance & Upstream Sources)](https://sites.research.google/datacardsplaybook/), and [OTDI Verifiable Lineage](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Upstream Lineage:** Originated in **1988** by Andras Janosi, William Steinbrunn, Matthias Pfisterer, Robert Detrano. Canonical dataset homepage: [Cleveland Heart Disease Diagnosis Canonical Homepage](https://archive.ics.uci.edu/dataset/45/heart+disease); upstream raw data source: [Upstream Source Repository](https://archive.ics.uci.edu/static/public/45/data.csv).
- **Acquisition Method:** Patients referred for suspected coronary artery disease underwent admission vitals, fasting blood panels, resting 12-lead ECG, Bruce-protocol treadmill stress ECG, thallium-201 myocardial scintigraphy, cardiac fluoroscopy, and gold-standard invasive coronary angiography between May 1981 and September 1984 ([Detrano et al., 1989](<https://doi.org/10.1016/0002-9149(89)90524-9>)).
- **Population & Sampling Frame:** 303 consecutive non-prior-infarction/non-valvular referrals at a single US tertiary referral hospital (Cleveland, Ohio). Because invasive angiography referrals in the early 1980s heavily favored middle-aged men presenting with classic angina, the cohort is **68.0% male** (`206` men vs. `97` women), aged 29 to 77.

## 4. Preprocessing, Cleaning & Data Quality Audit

Aligned with [Datasheets for Datasets (Preprocessing/Cleaning/Labeling)](https://cacm.acm.org/research/datasheets-for-datasets/), [Google Data Cards Playbook (Transformations)](https://sites.research.google/datacardsplaybook/), and [OTDI Completeness Criteria](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Upstream Transformations & Standardization:** Mirrored verbatim (`11,334` bytes) from the official [UCI Machine Learning Repository CSV (`id=45`)](https://archive.ics.uci.edu/static/public/45/data.csv), which extracts the canonical 14-attribute subset from the original 76-attribute database (after patient names and SSNs were stripped upstream) and encodes the 6 missing entries in `ca` and `thal` as `NaN`.
- **Missing Data Profile:**
    - **Explicit Missingness:** `stats.hasMissingValues` is **`true`** with **6** explicit missing cells across 2 column(s): `ca` (4 missing, 1.32%), `thal` (2 missing, 0.66%). Browser CSV parsing treats `""`, `"NA"`, `"NaN"`, `"?"` as missing (`null`/`NaN`).
    - **Disguised / Implicit Missingness:** No disguised sentinel missing values (`implicitMissingValues`) are present in this dataset.
- **Known Formatting & Modeling Traps:** Treating `cp` (`1, 2, 3, 4`) or `thal` (`3, 6, 7`) as continuous numbers imposes artificial linear ordering across nominal clinical syndromes—our `metadata.json` explicitly types them as `categorical` with clinical `valueLabels`. Learners should also note a pervasive ecosystem hazard: widely circulated Kaggle `heart.csv` files **invert the binary label** (`1 = healthy`, `0 = disease`) and shift `cp` to `0-3`; our UCI canonical file preserves authentic clinical coding (`0 = healthy`, `1-4 = stenosis severity`). Furthermore, if switching target to `exang`, stress-test outputs (`oldpeak`, `slope`, `thalach`, `num`) are auto-disabled via `leakyColumns`.

## 5. Recommended Uses & Fit-for-Purpose Guidance

Aligned with [Datasheets for Datasets (Uses)](https://cacm.acm.org/research/datasheets-for-datasets/), [Google Data Cards Playbook (Usage Guidance)](https://sites.research.google/datacardsplaybook/), and [Hugging Face Supported Tasks](https://huggingface.co/docs/hub/en/datasets-cards).

- **Recommended Pedagogical Classification Workflows:** Compare **Regularized Logistic Regression**, **Random Forests**, and **k-NN** after one-hot encoding `cp`, `restecg`, `slope`, `ca`, and `thal` and imputing the 6 `NaN` cells. Inspect **5x5 Multiclass Confusion Matrices** to observe how classifiers separate healthy (`0`) from diseased (`1-4`) much more reliably than adjacent stenosis stages (`1` vs. `2` vs. `3`).
- **Out-of-Scope & Inappropriate Uses:** 1980s referral-angiography cohort lacking high-sensitivity cardiac troponin assays, statin-era lipid profiles, and racial/ethnic diversity; never suitable for clinical diagnostic triage.

## 6. Ethical Considerations, Privacy & Fairness Analysis

Aligned with [Hugging Face Considerations for Using the Data](https://huggingface.co/docs/hub/en/datasets-cards), [Google Data Cards Playbook (Human Attributes & Sensitive Data)](https://sites.research.google/datacardsplaybook/), and [OTDI Privacy/PII Requirements](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Sensitive & Protected Attributes:**
    - **`age`** (`numeric`): Patient age in years at the time of cardiac catheterization.
    - **`sex`** (`categorical`): Recorded biological sex of the patient (cohort is 68.0% male, 32.0% female). Coded as: `0` = Female, `1` = Male.
- **Privacy & PII Assessment:** Patient names and Social Security numbers were permanently removed by UCI curators decades ago; no direct identifiers remain.
- **Documented Biases & Representational Harms:** In `data.csv`, **55.3%** of male patients (`114/206`) have angiographic disease (`num >= 1`) compared to **25.8%** of female patients (`25/97`). As documented in systematic reviews of diagnostic AI bias ([Alluhaibi, 2026](https://doi.org/10.3390/healthcare14193293)), male-dominated cardiology cohorts and referral bias cause standard classifiers to learn male-typical symptom patterns and exhibit higher **False Negative (underdiagnosis) rates** among women.
- **Recommended Fairness Audits:** Compare per-sex (`sex = 0` Female vs. `sex = 1` Male) and age-stratified (`age < 55` vs. `age >= 55`) **Recall / False Negative Rates** for detecting any coronary disease (`num > 0` vs. `num = 0`), verifying whether high overall accuracy masks missed diagnoses in female patients.

## 7. Distribution, Licensing & Maintenance

Aligned with [Datasheets for Datasets (Distribution & Maintenance)](https://cacm.acm.org/research/datasheets-for-datasets/) and [OTDI Open Licensing Requirements](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **License & Redistribution Terms:** Distributed under **[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)** (SPDX identifier: `cc-by-4.0`). All open redistribution and attribution requirements have been verified for bundling inside client-side educational repositories (including Apache 2.0-licensed open-source releases).
- **Maintenance & Versioning:** Canonical static UCI benchmark (DOI `10.24432/C52P4X`), distributed under **CC BY 4.0** with full redistribution rights.

## 8. Sources, Public Dataset Cards & Academic References

Full linked attribution to every public dataset card, upstream repository, transparency standard, and peer-reviewed study consulted during the creation of this Dataset Card.

- **Public Dataset Cards, Repositories & Standards Consulted:**
    - [UCI Machine Learning Repository: Heart Disease (ID 45)](https://archive.ics.uci.edu/dataset/45/heart+disease) — Verified 14-attribute codebook, clinical units, missing values in ca (4) and thal (2), and CC BY 4.0 license.
    - [Lale Fairness Datasets Suite (Hirzel & Feffer, 2023)](https://arxiv.org/abs/2308.00133) — Verified protected attribute conventions (age, sex) for fairness benchmarking on Cleveland Heart Disease.
    - [Hugging Face Dataset Cards Documentation](https://huggingface.co/docs/hub/en/datasets-cards) — Structural hierarchy and YAML frontmatter conventions.
    - [Datasheets for Datasets (Gebru et al., 2021)](https://cacm.acm.org/research/datasheets-for-datasets/) — Lifecycle motivation, composition, collection, preprocessing, uses, distribution, and maintenance dimensions.
    - [Google Research Data Cards Playbook (Pushkarna et al., 2022)](https://sites.research.google/datacardsplaybook/) — Purpose, provenance, human attributes, transformations, and fit-for-purpose guidance.
    - [AI Alliance Open Trusted Data Initiative (OTDI) Dataset Specification](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/) — Verifiable lineage, open licensing, PII risk assessment, and zero-drift metadata synchronization.
- **Seminal Papers & Fairness Audits:**
    - [International Application of a New Probability Algorithm for the Diagnosis of Coronary Artery Disease](<https://doi.org/10.1016/0002-9149(89)90524-9>) — Robert Detrano, Andras Janosi, William Steinbrunn, Matthias Pfisterer, Johann-Jakob Schmid, Sarbjit Sandhu, Kern H. Guppy, Stella Lee, Victor Froelicher (1989) [`seminal-paper`]. Detrano, R., Janosi, A., Steinbrunn, W., Pfisterer, M., Schmid, J.-J., Sandhu, S., Guppy, K. H., Lee, S., & Froelicher, V. (1989). International application of a new probability algorithm for the diagnosis of coronary artery disease. The American Journal of Cardiology, 64(5), 304-310. https://doi.org/10.1016/0002-9149(89)90524-9
    - [Algorithmic Bias in AI-Based Diagnostic Models: A Systematic Review and Lifecycle Framework for Fairness Auditing and Governance in Healthcare](https://doi.org/10.3390/healthcare14193293) — Reyadh Alluhaibi (2026) [`fairness-audit`]. Alluhaibi, R. (2026). Algorithmic bias in AI-based diagnostic models: A systematic review and lifecycle framework for fairness auditing and governance in healthcare. Healthcare, 14(19), 3293. https://doi.org/10.3390/healthcare14193293
    - [A Suite of Fairness Datasets for Tabular Classification](https://arxiv.org/abs/2308.00133) — Martin Hirzel, Michael Feffer (2023) [`fairness-audit`]. Hirzel, M., & Feffer, M. (2023). A suite of fairness datasets for tabular classification. arXiv preprint arXiv:2308.00133.
    - [UCI Machine Learning Repository: Heart Disease Dataset Card](https://archive.ics.uci.edu/dataset/45/heart+disease) — Andras Janosi, William Steinbrunn, Matthias Pfisterer, Robert Detrano (1988) [`documentation`]. Janosi, A., Steinbrunn, W., Pfisterer, M., & Detrano, R. (1988). Heart Disease [Dataset]. UCI Machine Learning Repository. https://doi.org/10.24432/C52P4X

The build obtains the pinned publisher source and verifies its digest before preparing and serving this sample. Attribution and licence terms above continue to apply.
