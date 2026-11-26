---
pretty_name: 'Palmer Archipelago Penguins'
task_categories:
    - tabular-classification
task_ids:
    - 'multiclass-classification'
    - 'binary-classification'
license: 'cc0-1.0'
size_categories:
    - 'n<1K'
source_datasets:
    - 'allisonhorst/palmerpenguins'
tags:
    - 'biology'
    - 'beginner'
    - 'multiclass'
    - 'mixed-types'
    - 'missing-values'
    - 'simpsons-paradox'
    - 'ecology'
---

# Palmer Archipelago Penguins

**Domain:** Biology | **Difficulty:** Beginner | **Task:** Multiclass Classification | **Rows:** 344 | **Columns:** 8 | **CSV Size:** 15,241 bytes | **License:** [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/)

## 1. Dataset Summary & Motivation

Aligned with [Hugging Face Dataset Summary](https://huggingface.co/docs/hub/en/datasets-cards), [Datasheets for Datasets (Motivation)](https://cacm.acm.org/research/datasheets-for-datasets/), and [Google Data Cards Playbook (Purpose & Intentionality)](https://sites.research.google/datacardsplaybook/).

- **Overview:** The Palmer Archipelago Penguins dataset records morphological measurements (bill length, bill depth, flipper length, body mass), biological sex, nesting island, and study year for 344 adult penguins across three Pygoscelis species: Adelie (152, 44.2%), Gentoo (124, 36.0%), and Chinstrap (68, 19.8%). Designed as a realistic drop-in successor to Iris, it supports primary three-class species classification as well as secondary binary (`sex`) and multiclass (`island`) tasks.
- **Original Purpose & Creators:** Field observations were collected from 2007 to 2009 by Dr. Kristen B. Gorman and the Palmer Station Antarctica Long Term Ecological Research (LTER) Program (supported by US National Science Foundation Polar Programs) to study foraging ecology and sexual dimorphism ([Gorman et al., 2014](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0090081)). Allison M. Horst, Alison P. Hill, and Kristen B. Gorman curated and released the teaching dataset in 2020 ([Horst et al., 2022](https://journal.r-project.org/articles/RJ-2022-020/)).
- **Benchmark & Pedagogical Significance:** Palmer Penguins introduces five threshold concepts absent from Iris: (1) **Simpson's Paradox** (marginal regression of `bill_depth_mm` on `bill_length_mm` has a negative slope across pooled data but a strong positive slope within every species); (2) **explicit missing data** (`NA` tokens across 11 incomplete rows); (3) **mixed categorical and numeric feature encoding**; (4) **scale disparity** (`body_mass_g` in thousands vs. `bill_depth_mm` in teens); and (5) **geographic confounding** (`island`).

## 2. Dataset Structure & Composition

Aligned with [Hugging Face Dataset Structure](https://huggingface.co/docs/hub/en/datasets-cards), [Datasheets for Datasets (Composition)](https://cacm.acm.org/research/datasheets-for-datasets/), and [OTDI Quality Metrics](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Unit of Observation:** One adult breeding penguin observed nesting in the Palmer Archipelago, Antarctica.
- **File & Parsing Specification:** Packaged at `/public/datasets/palmer-penguins/data.csv` (`15,241` bytes, `344` rows, `8` columns, delimiter `","`, `hasHeader: true`).
- **Classification Target(s) & Class Distribution:**
  - **Default Target:** `species` (`multiclass-classification`). Exact class distribution in `data.csv`: `Adelie` (Adelie Penguin (Pygoscelis adeliae)): **152** (44.19%); `Chinstrap` (Chinstrap Penguin (Pygoscelis antarcticus)): **68** (19.77%); `Gentoo` (Gentoo Penguin (Pygoscelis papua)): **124** (36.05%).
  - **Alternative Classification Target(s):**
  - `sex` (`binary-classification`): Predict biological sex ('female' vs. 'male') to explore ecological sexual dimorphism within penguin species.
  - `island` (`multiclass-classification`): Predict nesting island (Biscoe, Dream, or Torgersen) in the Palmer Archipelago.
- **Excluded Columns (Identifiers, Redundancy & Leakage Controls):**
  - Only the classification target column (`species`) has `defaultSelected: false`; no identifier or post-outcome leaky predictor columns are present in `data.csv`.
- **Complete Feature Schema (`columns[]` synchronized with `metadata.json`):**

| # | Column (`name`)     | Display Name         | Type          | Role      | Default | Unit | Missing | Implicit Missing / Coded Labels                                                                                                                          |
| - | ------------------- | -------------------- | ------------- | --------- | ------- | ---- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 | `species`           | Penguin Species      | `categorical` | `target`  | No      | —    | 0       | Labels: `Adelie`=Adelie Penguin (Pygoscelis adeliae); `Chinstrap`=Chinstrap Penguin (Pygoscelis antarcticus); `Gentoo`=Gentoo Penguin (Pygoscelis papua) |
| 2 | `island`            | Island               | `categorical` | `feature` | Yes     | —    | 0       | Island in the Palmer Archipelago, Antarctica where the penguin was measured (note: Gentoo was sampled only on Biscoe and Chinstrap only on Dream).       |
| 3 | `bill_length_mm`    | Bill (Culmen) Length | `numeric`     | `feature` | Yes     | `mm` | 2       | Length of the dorsal ridge of the penguin's upper bill (culmen).                                                                                         |
| 4 | `bill_depth_mm`     | Bill (Culmen) Depth  | `numeric`     | `feature` | Yes     | `mm` | 2       | Vertical thickness (depth) of the penguin's bill; exhibits Simpson's paradox when plotted against bill length without species conditioning.              |
| 5 | `flipper_length_mm` | Flipper Length       | `numeric`     | `feature` | Yes     | `mm` | 2       | Length of the penguin's flipper wing measured with a ruler.                                                                                              |
| 6 | `body_mass_g`       | Body Mass            | `numeric`     | `feature` | Yes     | `g`  | 2       | Total body mass in grams; differs in numeric scale by two orders of magnitude from bill dimensions, illustrating feature scaling effects.                |
| 7 | `sex`               | Sex                  | `categorical` | `feature` | Yes     | —    | 11      | Labels: `female`=Female; `male`=Male                                                                                                                     |
| 8 | `year`              | Study Year           | `categorical` | `feature` | Yes     | —    | 0       | Labels: `2007`=2007-2008 Austral Summer; `2008`=2008-2009 Austral Summer; `2009`=2009-2010 Austral Summer                                                |

## 3. Provenance, Collection Process & Sampling Frame

Aligned with [Datasheets for Datasets (Collection Process)](https://cacm.acm.org/research/datasheets-for-datasets/), [Google Data Cards Playbook (Provenance & Upstream Sources)](https://sites.research.google/datacardsplaybook/), and [OTDI Verifiable Lineage](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Upstream Lineage:** Originated in **2020** by Kristen B. Gorman, Allison M. Horst, Alison P. Hill, Palmer Station Antarctica LTER. Canonical dataset homepage: [Palmer Archipelago Penguins Canonical Homepage](https://allisonhorst.github.io/palmerpenguins/); upstream raw data source: [Upstream Source Repository](https://raw.githubusercontent.com/allisonhorst/palmerpenguins/main/inst/extdata/penguins.csv).
- **Acquisition Method:** Structural size measurements (culmen length/depth via dial calipers to 0.1 mm, flipper length via ruler to 1 mm, body mass via spring scale in g) and blood samples for molecular sexing were gathered at nesting colonies during the 2007-2008, 2008-2009, and 2009-2010 austral summers ([Gorman et al., 2014](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0090081)).
- **Population & Sampling Frame:** Adult breeding pairs sampled across three islands (Biscoe, Dream, and Torgersen) near Palmer Station, Western Antarctic Peninsula. Importantly, Adelie penguins were sampled on all three islands, whereas Gentoo penguins were sampled exclusively on Biscoe Island and Chinstrap penguins exclusively on Dream Island.

## 4. Preprocessing, Cleaning & Data Quality Audit

Aligned with [Datasheets for Datasets (Preprocessing/Cleaning/Labeling)](https://cacm.acm.org/research/datasheets-for-datasets/), [Google Data Cards Playbook (Transformations)](https://sites.research.google/datacardsplaybook/), and [OTDI Completeness Criteria](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Upstream Transformations & Standardization:** Mirrored verbatim (`15,241` bytes) from the curated `penguins.csv` table in the official [`allisonhorst/palmerpenguins` repository](https://github.com/allisonhorst/palmerpenguins), which simplifies the raw Environmental Data Initiative (`penguins_raw`) tables by removing blood-isotope (`delta15N`, `delta13C`), clutch-completion, and sample-ID columns.
- **Missing Data Profile:**
  - **Explicit Missingness:** `stats.hasMissingValues` is **`true`** with **19** explicit missing cells across 5 column(s): `bill_length_mm` (2 missing, 0.58%), `bill_depth_mm` (2 missing, 0.58%), `flipper_length_mm` (2 missing, 0.58%), `body_mass_g` (2 missing, 0.58%), `sex` (11 missing, 3.20%). Browser CSV parsing treats `""`, `"NA"`, `"NaN"` as missing (`null`/`NaN`).
  - **Disguised / Implicit Missingness:** No disguised sentinel missing values (`implicitMissingValues`) are present in this dataset.
- **Known Formatting & Modeling Traps:** Two penguins (1 Adelie on Torgersen, 1 Gentoo on Biscoe) are missing all four morphological measurements plus `sex`, and 9 additional penguins are missing `sex` (`19` total `NA` cells). Furthermore, `body_mass_g` (`2,700–6,300` g) dominates Euclidean distance in unscaled k-NN unless features are standardized (`StandardScaler` / `MinMaxScaler`).

## 5. Recommended Uses & Fit-for-Purpose Guidance

Aligned with [Datasheets for Datasets (Uses)](https://cacm.acm.org/research/datasheets-for-datasets/), [Google Data Cards Playbook (Usage Guidance)](https://sites.research.google/datacardsplaybook/), and [Hugging Face Supported Tasks](https://huggingface.co/docs/hub/en/datasets-cards).

- **Recommended Pedagogical Classification Workflows:** Compare **k-NN with and without feature scaling**, **Decision Trees** with vs. without `island` (testing geographic shortcut reliance), and **mean/median + mode imputation vs. row deletion** for the 11 rows with `NA`s. Inspect **Macro-F1** and **per-species Precision/Recall**.
- **Out-of-Scope & Inappropriate Uses:** Restricted to three islands near Palmer Station across three breeding seasons; ecological body-mass distributions shift across sub-Antarctic latitudes and multi-decadal sea-ice regimes.

## 6. Ethical Considerations, Privacy & Fairness Analysis

Aligned with [Hugging Face Considerations for Using the Data](https://huggingface.co/docs/hub/en/datasets-cards), [Google Data Cards Playbook (Human Attributes & Sensitive Data)](https://sites.research.google/datacardsplaybook/), and [OTDI Privacy/PII Requirements](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **Sensitive & Protected Attributes:**
  - **None (`ethics.sensitiveColumns: []`)**: This dataset contains non-demographic measurements without human protected attributes.
- **Privacy & PII Assessment:** Ecological wildlife observations with zero human personal data.
- **Documented Biases & Representational Harms:** No human representational harms apply, though **sampling confounding** is prominent: because `island` is deterministic for non-Adelie species in this sample, an uninspected classifier can achieve high training accuracy partly via island lookup rather than morphological generalization.
- **Recommended Fairness Audits:** While `sensitiveColumns` is empty (`[]`), switching the target or stratifying error rates by `sex` reveals strong biological sexual dimorphism (male penguins are systematically heavier and larger-billed within each species), helping learners distinguish legitimate biological signal from socially constructed bias before tackling human demographic data.

## 7. Distribution, Licensing & Maintenance

Aligned with [Datasheets for Datasets (Distribution & Maintenance)](https://cacm.acm.org/research/datasheets-for-datasets/) and [OTDI Open Licensing Requirements](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/).

- **License & Redistribution Terms:** Distributed under **[CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/)** (SPDX identifier: `cc0-1.0`). All open redistribution and attribution requirements have been verified for bundling inside client-side educational repositories (including Apache 2.0-licensed open-source releases).
- **Maintenance & Versioning:** Maintained by [Horst, Hill, & Gorman on GitHub](https://allisonhorst.github.io/palmerpenguins/) and archived on Zenodo and EDI under **CC0-1.0** public domain dedication (fully compatible with Apache 2.0 redistribution; LTER community norms encourage academic citation).

## 8. Sources, Public Dataset Cards & Academic References

Full linked attribution to every public dataset card, upstream repository, transparency standard, and peer-reviewed study consulted during the creation of this Dataset Card.

- **Public Dataset Cards, Repositories & Standards Consulted:**
  - [palmerpenguins Official Documentation](https://allisonhorst.github.io/palmerpenguins/articles/intro.html) — Verified EDI data package DOIs, field measurement definitions, and CC0-1.0 licensing.
  - [Hugging Face Hub: SIH/palmer-penguins](https://huggingface.co/datasets/SIH/palmer-penguins) — Verified row/column counts (344 x 8), missing value counts, and tabular schema conventions.
  - [Hugging Face Dataset Cards Documentation](https://huggingface.co/docs/hub/en/datasets-cards) — Structural hierarchy and YAML frontmatter conventions.
  - [Datasheets for Datasets (Gebru et al., 2021)](https://cacm.acm.org/research/datasheets-for-datasets/) — Lifecycle motivation, composition, collection, preprocessing, uses, distribution, and maintenance dimensions.
  - [Google Research Data Cards Playbook (Pushkarna et al., 2022)](https://sites.research.google/datacardsplaybook/) — Purpose, provenance, human attributes, transformations, and fit-for-purpose guidance.
  - [AI Alliance Open Trusted Data Initiative (OTDI) Dataset Specification](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/) — Verifiable lineage, open licensing, PII risk assessment, and zero-drift metadata synchronization.
- **Seminal Papers & Fairness Audits:**
  - [Palmer Archipelago Penguins Data in the palmerpenguins R Package - An Alternative to Anderson's Irises](https://journal.r-project.org/articles/RJ-2022-020/) — Allison M. Horst, Alison P. Hill, Kristen B. Gorman (2022) [`seminal-paper`]. Horst, A. M., Hill, A. P., & Gorman, K. B. (2022). Palmer Archipelago Penguins Data in the palmerpenguins R Package - An Alternative to Anderson's Irises. The R Journal, 14(1), 244-254. https://doi.org/10.32614/RJ-2022-020
  - [Ecological Sexual Dimorphism and Environmental Variability within a Community of Antarctic Penguins (Genus Pygoscelis)](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0090081) — Kristen B. Gorman, Tony D. Williams, William R. Fraser (2014) [`seminal-paper`]. Gorman, K. B., Williams, T. D., & Fraser, W. R. (2014). Ecological sexual dimorphism and environmental variability within a community of Antarctic penguins (genus Pygoscelis). PLoS ONE, 9(3), e90081. https://doi.org/10.1371/journal.pone.0090081
  - [Hugging Face Dataset Card: SIH/palmer-penguins](https://huggingface.co/datasets/SIH/palmer-penguins) — Sydney Informatics Hub (2023) [`documentation`]. Sydney Informatics Hub. (2023). palmer-penguins [Dataset Card]. Hugging Face Hub. https://huggingface.co/datasets/SIH/palmer-penguins

The browser downloads the pinned CSV from its source when this sample is loaded. The published attribution and licence terms above continue to apply.
