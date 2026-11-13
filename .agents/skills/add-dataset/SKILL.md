---
name: add-dataset
description: Onboard a new sample tabular classification dataset into content/datasets/{id}/. Inspects and validates the CSV, authors a typed descriptor.ts and source-attributed datasheet.md, and checks permissive licensing and classification-only scope. Use when the user invokes /add-dataset or asks to add, curate, or document a sample dataset.
argument-hint: '<csv-url-or-repo-id> [target=<col>] [positive=<val>] [id=<slug>] [domain=<domain>] [difficulty=<level>] [focus="..."]'
---

# Add Sample Classification Dataset (`/add-dataset`)

Onboard a single tabular classification dataset into `content/datasets/{id}/` by producing three artifacts:

1. `content/datasets/{id}/data.csv` — clean, standardised CSV ready for browser worker parsing.
2. `content/datasets/{id}/descriptor.ts` — typed authored schema conforming to `AuthoredDatasetDescriptor`.
3. `content/datasets/{id}/datasheet.md` — human-readable Dataset Card in Markdown, compiled to HTML during the build.

## 1. Invocation & Argument Contract

Parse `$ARGUMENTS` using the parameter specification below before fetching files or running scripts.

### Accepted Inputs

| Parameter                                 | Required    | Accepted Formats & Examples                                                                                                                                                                                                                                                                     | Default / Fallback Behavior                                                                             |
| :---------------------------------------- | :---------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------ |
| **Dataset Source** (positional or `url=`) | **Yes**     | - Direct raw CSV URL: `https://raw.githubusercontent.com/.../penguins.csv`<br>- Canonical repository ID/URL: `uci:17`, `openml:40945`, `hf:scikit-learn/iris`, or dataset landing URL<br>- Local staging CSV + upstream URL: `tmp/compas.csv url=https://github.com/propublica/compas-analysis` | If missing or ambiguous across multiple mirrors, **stop and ask** using the Missing-Input Prompt below. |
| `target=<col>`                            | Recommended | Exact target column name in the CSV (e.g., `target=diagnosis`, `target=y`)                                                                                                                                                                                                                      | Infer from canonical dataset documentation and confirm in the final summary.                            |
| `positive=<val>`                          | Optional    | Positive class label for binary classification (e.g., `positive=M`, `positive=yes`, `positive=1`)                                                                                                                                                                                               | Infer minority or clinically/socially positive class; omit for multiclass targets.                      |
| `id=<slug>`                               | Optional    | Kebab-case directory name under `content/datasets/` (e.g., `id=pima-diabetes`)                                                                                                                                                                                                                  | Derive kebab-case slug from the canonical dataset name.                                                 |
| `domain=<domain>`                         | Optional    | One of: `biology`, `healthcare`, `finance`, `criminal-justice`, `social-science`, `marketing`                                                                                                                                                                                                   | Infer from dataset subject matter.                                                                      |
| `difficulty=<level>`                      | Optional    | One of: `beginner`, `intermediate`, `advanced`                                                                                                                                                                                                                                                  | Infer from dimensionality, missingness, encoding complexity, and fairness/leakage traps.                |
| `focus="<text>"`                          | Optional    | Pedagogical emphasis or known pitfall to highlight in `ethics`, `tags`, and Section 5 of `datasheet.md`                                                                                                                                                                                         | Automatically document all traps discovered during the 6-point data quality audit.                      |

### Valid Invocation Patterns

```text
# 1. Minimal invocation (direct raw CSV + target)
/add-dataset [https://raw.githubusercontent.com/mwaskom/seaborn-data/master/penguins.csv](https://raw.githubusercontent.com/mwaskom/seaborn-data/master/penguins.csv) target=species

# 2. Canonical repository ID with positive-class label and catalogue badges
/add-dataset uci:17 target=Diagnosis positive=M domain=healthcare difficulty=beginner

# 3. Local cleaned CSV paired with its canonical upstream provenance URL
/add-dataset tmp/compas-clean.csv url=[https://github.com/propublica/compas-analysis](https://github.com/propublica/compas-analysis) id=compas-recidivism target=two_year_recid positive=1 domain=criminal-justice difficulty=advanced

# 4. Full specification with pedagogical focus
/add-dataset id=bank-marketing url=[https://archive.ics.uci.edu/dataset/222/bank+marketing](https://archive.ics.uci.edu/dataset/222/bank+marketing) target=y positive=yes domain=marketing difficulty=advanced focus="post-outcome target leakage on the 'duration' column and severe class imbalance"

```

### Handling Missing or Ambiguous Arguments

- **If `$ARGUMENTS` is empty or lacks a dataset source:** Do not guess a dataset. Ask the user for:

1. The **direct raw CSV URL** (preferred) or canonical dataset ID/URL (UCI, OpenML, Hugging Face, ProPublica).
2. Optionally, the **target column** (`target=`), **positive class** (`positive=`), and **catalog tags** (`id=`, `domain=`, `difficulty=`).

- **If a canonical repository URL contains multiple variants** (e.g., 20-column raw UCI `GermanCredit` vs. 62-column R `caret` dummy-encoded export): Prefer the cleanest un-dummified canonical CSV and explicitly state which variant was packaged.

## 2. Scope & Eligibility Gate

Before generating files, verify that the candidate dataset meets all application constraints:

1. **Classification Only (Phase 1 Constraint):** The primary target and all entries in `modeling.targetCandidates` MUST be `binary-classification` or `multiclass-classification`. **Regression is strictly excluded** - do not onboard regression datasets or include continuous numeric variables as secondary targets.
2. **Browser Feasibility:** Prefer tabular files between **100 and 50,000 rows** and **< 5 MB** uncompressed CSV so client-side parsing and Web Worker training remain responsive.
3. **Permissive Open Licence:** Verify an open licence (Public Domain, CC0, CC BY, MIT, or explicit academic redistribution rights) and record both the canonical `homepageUrl` and direct `sourceRepositoryUrl`.
4. **Single-Table Tabular Format:** Reject multi-table relational dumps requiring joins or unstructured raw media corpora.

## 3. Step-by-Step Execution Workflow

### Step 1: Acquire & Programmatically Profile `data.csv`

1. Download or copy the canonical raw data into `content/datasets/{id}/data.csv`.
2. Profile the exact CSV that will be committed and record its byte size, row count, column count, ordered headers, missing values and target class counts for the datasheet.
3. Verify every count directly against the CSV; do not copy row counts or missing counts from secondary sources.

### Step 2: Run the 6-Point Data Quality & Leakage Audit

Inspect `data.csv` against these six failure modes and resolve them in the CSV and descriptor:

| Audit Check                             | Common Failure Mode                                                                             | Required Resolution                                                                                                                                                    |
| :-------------------------------------- | :---------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Header Integrity**                 | Raw exports place descriptive metadata on the first row or use unsuitable column names.         | Curate `data.csv` so the first row contains clean headers that match descriptor column names exactly and in order. Record each change in `provenance.transformations`. |
| **2. Target Leakage & Duplicates**      | The dataset includes duplicates of the target, proprietary risk scores or post-outcome metrics. | Add each leaking column to the affected `targetCandidates[].leakyColumns` as `{ column, reason }`.                                                                     |
| **3. Disguised Missing Values**         | Measurements use values such as `0` as sentinels, or missing tokens contain whitespace.         | Add raw tokens to `missingValueTokens` and domain-invalid sentinels to the column's `implicitMissingValues`.                                                           |
| **4. High-Cardinality PII & Bloat**     | Raw files retain row IDs, names or fields that should not be model inputs.                      | Set identifiers to `role: 'identifier'`; set protected or sensitive attributes to `sensitive: true`. Do not add columns that are absent from the source.               |
| **5. R / Caret Pre-Encoding Artifacts** | Mirrors use inconsistent names or pre-dummified categorical columns.                            | Prefer clean, un-dummified canonical CSVs and verify every descriptor column name against the exact CSV header. Record curation in `provenance.transformations`.       |
| **6. Data-to-Descriptor Drift**         | Authored counts or missing values disagree with the CSV.                                        | The build computes statistics and missing counts from the final CSV; resolve any build validation error in the descriptor or curated data.                             |

### Step 3: Author `content/datasets/{id}/descriptor.ts`

Export the descriptor as `default { … } satisfies AuthoredDatasetDescriptor`, importing the type from `src/types/sample-dataset.ts` with a relative path. The TypeScript compiler checks authored descriptors and provides their field documentation.

The authored schema consists of:

- Dataset identity and copy: `id`, `name`, `tagline`, `description`, `domain`, `difficulty` and `tags`.
- Optional `missingValueTokens` (empty strings are always treated as missing).
- For an upstream with no declared licence, use `remoteSource` only: pin its commit URL and record the exact SHA-256 and byte length, set `license: 'NOASSERTION'`, and omit `data.csv`. Add its origin prefix to both `REMOTE_CSV_PREFIXES` and the CSP `connect-src` directive.
- `modeling.defaultTarget` and `targetCandidates`; candidates have a classification `taskType`, a string `positiveClass` when binary, a description and optional `leakyColumns` entries containing a column and reason.
- `columns` with exact `name`, `displayName`, `description`, `dataType`, `role` (`feature` or `identifier`), and applicable `sensitive`, `unit`, `implicitMissingValues` and `valueLabels` fields.
- `provenance` with `homepageUrl`, `sourceRepositoryUrl`, `retrievedAt`, `license`, `licenseUrl`, one-sentence `attribution`, `yearPublished`, `creators` and `transformations`.
- Verified `references` and optional `ethicsWarnings`.

Use only these task types: `binary-classification` and `multiclass-classification`. Regression is excluded in Phase 1. The licence must be one of `CC0-1.0`, `CC-BY-4.0`, `PDDL-1.0` or `ODbL-1.0`. Include its canonical `licenseUrl`, attribution and retrieval date. Integer-coded classes are categorical and need `valueLabels`. `dataType` must match the CSV profile or a generator-approved override. Do not add `rowid` or any other column that is not present in the source.

Declare `implicitMissingValues` only when the source documents a value as unknown, not recorded or not applicable, or when it is impossible for the measured quantity. Keep observed undocumented category codes as categories with labels; drop labels for codes absent from the CSV.

The build derives the catalogue, per-column missing counts, dataset statistics and versioned file URLs from the descriptor and CSV. Do not author generated values in the descriptor.

### Step 4: Research & Author `content/datasets/{id}/datasheet.md`

1. **Reuse Existing Public Dataset Cards First:** Search for existing public dataset cards or official documentation on the **Hugging Face Hub**, **UCI Machine Learning Repository**, **OpenML**, **Papers With Code**, and seminal papers. Adapt verified variable definitions, collection procedures, and documented caveats rather than inventing descriptions from scratch.
2. **Synthesize Four Transparency Standards:** Structure `datasheet.md` to satisfy:

- [Hugging Face Dataset Cards](https://huggingface.co/docs/hub/en/datasets-cards) (YAML frontmatter + structured sections)
- [Datasheets for Datasets](https://casrai.org/guides/datasheets-for-datasets) (Gebru et al., 2021 lifecycle coverage)
- [Google Research Data Cards Playbook](https://sites.research.google/datacardsplaybook/) (purpose, provenance, human attributes, fit-for-purpose guidance)
- [Open Trusted Data Initiative (OTDI) Dataset Requirements](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/) (verifiable lineage, open licensing, PII/privacy check, quality metrics)

3. **Require Linked Source Attribution:** Include clickable Markdown links (`[Source Title](URL)`) inline where facts or caveats are cited, and list every public dataset card, repository, and paper consulted in **Section 8**.
4. **Synchronize Numbers:** Ensure every count, class distribution, licence string and URL in `datasheet.md` matches the descriptor and `data.csv`.
5. Follow the shared Markdown compiler rules: use one leading `# Title`, no raw HTML, no relative links or images, and external links only.

#### Required `datasheet.md` Template

```markdown
---
pretty_name: '{Dataset Name}'
task_categories:
    - tabular-classification
task_ids:
    - '{binary-classification | multiclass-classification}'
license: '{SPDX or Canonical License Identifier}'
size_categories:
    - '{e.g., n<1K | 1K<n<10K | 10K<n<100K}'
source_datasets:
    - '{Canonical Upstream Dataset Identifier}'
tags:
    - '{domain}'
    - '{difficulty}'
---

# {Dataset Name}

**Domain:** {Domain} | **Difficulty:** {Difficulty} | **Task:** {Binary / Multiclass Classification} | **Rows:** {rowCount} | **Columns:** {columnCount} | **License:** [{License}]({License URL})

## 1. Dataset Summary & Motivation

- **Overview:** Concise 2-4 sentence summary of what the dataset contains and the classification problem it models.
- **Original Purpose & Creators:** Why the dataset was originally created, who created it, and any funding or institutional sponsors (with linked citations).
- **Benchmark & Pedagogical Significance:** Why this dataset is canonical in machine learning or algorithmic fairness literature and what specific modeling concepts it teaches.

## 2. Dataset Structure & Composition

- **Unit of Observation:** What each row represents (e.g., a flower specimen, an individual loan applicant, a marketing phone call).
- **Classification Target(s) & Class Distribution:**
    - **Default Target:** `{defaultTarget}` (`{binary-classification | multiclass-classification}`), positive class encoding (if binary), and exact class counts/percentages matching `descriptor.ts`.
    - **Alternative Classification Target(s):** Any valid secondary classification targets in `targetCandidates` (if applicable).
- **Feature Schema Summary:** Table or grouped summary of predictor variables, data types, measurement units, and coded categorical `valueLabels`.
- **Excluded Columns (Identifiers & Leakage Controls):** Explain identifiers and each target candidate’s leaky columns, including the reason for exclusion.

## 3. Provenance, Collection Process & Sampling Frame

- **Upstream Lineage:** Exact lineage from the original data collection to the specific CSV mirror packaged in `data.csv`, linking to both the [Canonical Homepage]({homepageUrl}) and [Source Repository]({sourceRepositoryUrl}).
- **Acquisition Method:** How, when, and by whom measurements or administrative records were collected.
- **Population & Sampling Frame:** Geographic, demographic, and temporal boundaries of the sample, plus known sampling gaps or selection filters.

## 4. Preprocessing, Cleaning & Data Quality Audit

- **Upstream Transformations:** Filtering, discretization, or encoding changes introduced by dataset creators or repository mirrors (e.g., UCI vs. OpenML vs. R package exports).
- **Missing Data Profile:**
    - **Explicit Missingness:** Total missing cells, affected columns, and raw missing tokens (`NA`, `?`, empty strings).
    - **Disguised / Implicit Missingness:** Domain-invalid sentinel values (e.g., `0` for physiological lab values) documented in `implicitMissingValues`.
- **Known Formatting & Modeling Traps:** Non-standard headers, whitespace padding, pre-encoded dummy variables, or extreme class imbalance.

## 5. Recommended Uses & Fit-for-Purpose Guidance

- **Recommended Pedagogical Classification Workflows:** Specific classification algorithms (e.g., Logistic Regression, Decision Trees, Random Forests, k-NN, SVM), preprocessing steps (imputation, scaling, one-hot encoding), and evaluation metrics (e.g., Accuracy, Precision/Recall, F1-score, ROC-AUC) suited to this dataset.
- **Out-of-Scope & Inappropriate Uses:** Concrete reasons why models trained on this dataset must not be deployed in production or used to draw causal conclusions (e.g., historical cohort drift, proxy labels, non-representative sampling).

## 6. Ethical Considerations, Privacy & Fairness Analysis

- **Sensitive & Protected Attributes:** Identification of demographic or proxy columns (`sex`, `race`, `age`, etc.) and how they are encoded.
- **Privacy & PII Assessment:** Confirmation that direct personal identifiers are either absent or marked excluded (`identifier`), and assessment of re-identification risk.
- **Documented Biases & Representational Harms:** Structural, historical, or measurement biases documented in peer-reviewed audits (with inline links to studies).
- **Recommended Fairness Audits:** Concrete subgroup disparity checks learners should inspect in the UI (e.g., comparing false positive rates or selection rates across demographic subgroups).

## 7. Distribution, Licensing & Maintenance

- **Licence & Redistribution Terms:** Exact licence name, link to licence text, and confirmation of open redistribution rights.
- **Maintenance & Versioning:** Static educational snapshot status, upstream version/date, and how known errata are documented.

## 8. Sources, Public Dataset Cards & Academic References

- **Public Dataset Cards & Repositories Consulted:**
    - [{Public Dataset Card or Repository Title}]({URL}) - Note what metadata, schema details, or caveats were adapted or verified from this source.
- **Seminal Papers & Fairness Audits:**
    - [{Paper Title}]({URL}) - {Authors} ({Year}). {Full citation matching the descriptor reference}.
```

### Step 5: Validate the Descriptor and Build Output

1. Run `bun run check` to type-check the descriptor and the project.
2. Run `bun run build`; after the sample catalogue generator is wired into the build, this validates the descriptor against `data.csv`, compiles the datasheet and creates the `/datasets/index.json` catalogue and versioned dataset files.
3. Fix any validation or compilation errors in the descriptor, CSV or datasheet, then rerun both commands.
4. If `selection-rationale.md` exists in the repository, append a row summarising the new dataset.

## 4. Definition of Done

Do not finish until all checks pass:

- [ ] `content/datasets/{id}/data.csv`, `descriptor.ts` and `datasheet.md` exist.
- [ ] `descriptor.ts` type-checks and declares only binary or multiclass classification targets.
- [ ] Descriptor column names match the curated CSV headers byte-for-byte and in order; build-computed missing counts and dataset statistics validate against the CSV.
- [ ] Leakage is recorded on affected target candidates, identifiers use the identifier role, and sensitive columns are marked.
- [ ] `datasheet.md` contains front matter and all eight sections, has verified linked sources, and follows the shared compiler rules: no raw HTML, no relative links or images, one leading `# Title`, and external links only.
- [ ] `bun run check` and `bun run build` pass.
- [ ] The build output contains the dataset descriptor, compiled datasheet, CSV and catalogue entry with versioned URLs.
