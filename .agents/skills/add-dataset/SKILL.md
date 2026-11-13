---
name: add-dataset
description: Onboard a new sample tabular classification dataset into /public/datasets/{id}/. Inspects the raw CSV, verifies permissive licensing and classification-only scope, generates a schema-validated metadata.json, and authors a source-attributed Dataset Card (datasheet.md) aligned with Hugging Face, Datasheets for Datasets, Google Data Cards Playbook, and Open Trusted Data Initiative standards. Use when the user invokes /add-dataset or asks to add, curate, or document a sample dataset.
argument-hint: "<csv-url-or-repo-id> [target=<col>] [positive=<val>] [id=<slug>] [domain=<domain>] [difficulty=<level>] [focus=\"...\"]"
---

# Add Sample Classification Dataset (`/add-dataset`)

Onboard a single tabular classification dataset into `/public/datasets/{id}/` by producing three synchronized artifacts:
1. `/public/datasets/{id}/data.csv` - Clean, standardized CSV file ready for browser Web Worker parsing.
2. `/public/datasets/{id}/metadata.json` - Machine-readable schema conforming to `src/types/dataset.ts`.
3. `/public/datasets/{id}/datasheet.md` - Human-readable Dataset Card in Markdown (compiled to `datasheet.html` at build time).

## 1. Invocation & Argument Contract

Parse `$ARGUMENTS` using the parameter specification below before fetching files or running scripts.

### Accepted Inputs

| Parameter | Required | Accepted Formats & Examples | Default / Fallback Behavior |
| :--- | :--- | :--- | :--- |
| **Dataset Source** (positional or `url=`) | **Yes** | - Direct raw CSV URL: `https://raw.githubusercontent.com/.../penguins.csv`<br>- Canonical repository ID/URL: `uci:17`, `openml:40945`, `hf:scikit-learn/iris`, or dataset landing URL<br>- Local staging CSV + upstream URL: `tmp/compas.csv url=https://github.com/propublica/compas-analysis` | If missing or ambiguous across multiple mirrors, **stop and ask** using the Missing-Input Prompt below. |
| `target=<col>` | Recommended | Exact target column name in the CSV (e.g., `target=diagnosis`, `target=y`) | Infer from canonical dataset documentation and confirm in the final summary. |
| `positive=<val>` | Optional | Positive class label for binary classification (e.g., `positive=M`, `positive=yes`, `positive=1`) | Infer minority or clinically/socially positive class; omit for multiclass targets. |
| `id=<slug>` | Optional | Kebab-case directory name under `/public/datasets/` (e.g., `id=pima-diabetes`) | Derive kebab-case slug from the canonical dataset name. |
| `domain=<domain>` | Optional | One of: `biology`, `healthcare`, `finance`, `criminal-justice`, `social-science`, `marketing` | Infer from dataset subject matter. |
| `difficulty=<level>` | Optional | One of: `beginner`, `intermediate`, `advanced` | Infer from dimensionality, missingness, encoding complexity, and fairness/leakage traps. |
| `focus="<text>"` | Optional | Pedagogical emphasis or known pitfall to highlight in `ethics`, `tags`, and Section 5 of `datasheet.md` | Automatically document all traps discovered during the 6-point data quality audit. |

### Valid Invocation Patterns

```text
# 1. Minimal invocation (direct raw CSV + target)
/add-dataset [https://raw.githubusercontent.com/mwaskom/seaborn-data/master/penguins.csv](https://raw.githubusercontent.com/mwaskom/seaborn-data/master/penguins.csv) target=species

# 2. Canonical repository ID with positive-class label and catalog badges
/add-dataset uci:17 target=Diagnosis positive=M domain=healthcare difficulty=beginner

# 3. Local cleaned CSV paired with its canonical upstream provenance URL
/add-dataset tmp/compas-clean.csv url=[https://github.com/propublica/compas-analysis](https://github.com/propublica/compas-analysis) id=compas-recidivism target=two_year_recid positive=1 domain=criminal-justice difficulty=advanced

# 4. Full specification with pedagogical focus
/add-dataset id=bank-marketing url=[https://archive.ics.uci.edu/dataset/222/bank+marketing](https://archive.ics.uci.edu/dataset/222/bank+marketing) target=y positive=yes domain=marketing difficulty=advanced focus="post-outcome target leakage on the 'duration' column and severe class imbalance"

```

### Handling Missing or Ambiguous Arguments

* **If `$ARGUMENTS` is empty or lacks a dataset source:** Do not guess a dataset. Ask the user for:
1. The **direct raw CSV URL** (preferred) or canonical dataset ID/URL (UCI, OpenML, Hugging Face, ProPublica).
2. Optionally, the **target column** (`target=`), **positive class** (`positive=`), and **catalog tags** (`id=`, `domain=`, `difficulty=`).


* **If a canonical repository URL contains multiple variants** (e.g., 20-column raw UCI `GermanCredit` vs. 62-column R `caret` dummy-encoded export): Prefer the cleanest un-dummified canonical CSV and explicitly state which variant was packaged.


## 2. Scope & Eligibility Gate

Before generating files, verify that the candidate dataset meets all application constraints:
1. **Classification Only (Phase 1 Constraint):** The primary target and all entries in `modeling.targetCandidates` MUST be `binary-classification` or `multiclass-classification`. **Regression is strictly excluded** - do not onboard regression datasets or include continuous numeric variables as secondary targets.
2. **Browser Feasibility:** Prefer tabular files between **100 and 50,000 rows** and **< 5 MB** uncompressed CSV so client-side parsing and Web Worker training remain responsive.
3. **Permissive Open License:** Verify an open license (Public Domain, CC0, CC BY, MIT, or explicit academic redistribution rights) and record both the canonical `homepageUrl` and direct `sourceRepositoryUrl`.
4. **Single-Table Tabular Format:** Reject multi-table relational dumps requiring joins or unstructured raw media corpora.

## 3. Step-by-Step Execution Workflow

### Step 1: Acquire & Programmatically Profile `data.csv`
1. Download or copy the canonical raw data into `/public/datasets/{id}/data.csv`.
2. Run a short script (e.g., via Python or Bun) against the exact `/public/datasets/{id}/data.csv` file to measure ground-truth metrics:
   - Exact byte size (`fileSizeBytes`), `rowCount`, and `columnCount`.
   - Exact byte-for-byte column header strings in column order.
   - Explicit missing value counts per column across all configured `missingValueTokens` (e.g., `""`, `"NA"`, `"NaN"`, `"?"`, `" ?"`).
   - Exact class counts for `defaultTargetDistribution` (e.g., `{ "0": 549, "1": 342 }`).
3. Never copy row counts or missing counts from secondary blog posts or mirrors without verifying them directly against `data.csv`.

### Step 2: Run the 6-Point Data Quality & Leakage Audit
Inspect `data.csv` against these six failure modes and resolve them in `data.csv` and `metadata.json`:

| Audit Check | Common Failure Mode | Required Resolution |
| :--- | :--- | :--- |
| **1. Header Integrity** | Raw exports (e.g., scikit-learn CSVs) place metadata on Row 0 (`178,13,class_0,...`) instead of column names. | Either normalize `data.csv` with standard headers or populate `parsing.overrideHeaders` in `metadata.json`. |
| **2. Target Leakage & Duplicates** | Dataset includes string duplicates of the target (`survived` + `alive`), proprietary risk scores (`decile_score` in COMPAS), or post-outcome metrics (`duration` in Bank Marketing). | Assign `semanticRole: "leaky"`, set `defaultSelected: false`, add an `exclusionReason`, and list the column in `targetCandidates[].leakyColumns`. |
| **3. Disguised Missing Values** | Physiological or financial measurements encode missingness as `0` (e.g., `0` BMI/glucose in Pima Diabetes), or strings have leading whitespace (`" ?"` in Adult Census). | Add raw tokens to `parsing.missingValueTokens` and domain-invalid numeric sentinels to `columns[].implicitMissingValues`. |
| **4. High-Cardinality PII & Bloat** | Raw files retain row IDs, full names, or unparsed date strings (`id`, `name`, `first`, `last` in COMPAS), causing browser one-hot encoding to freeze the UI thread. | Mark as `semanticRole: "identifier"`, set `defaultSelected: false`, and provide a clear `exclusionReason`. |
| **5. R / Caret Pre-Encoding Artifacts** | Mirrors exported from R packages contain dot-separated names (`marital.status`) or pre-dummified binary columns (e.g., 62-column `GermanCredit`). | Prefer clean, un-dummified canonical CSVs where possible; verify every `columns[].name` matches the exact CSV header string byte-for-byte. |
| **6. Metadata-to-CSV Drift** | Manually transcribed row counts, column counts, class distributions, or missing counts disagree with the actual `data.csv` file. | Compute `stats` and `missingCount` directly from the final `data.csv` artifact so build-time validation passes with zero discrepancies. |

### Step 3: Generate `/public/datasets/{id}/metadata.json`
Author `metadata.json` conforming strictly to `src/types/dataset.ts`:

```typescript
export type TaskType =
  | 'binary-classification'
  | 'multiclass-classification';

export type ColumnDataType =
  | 'numeric'      // Continuous or discrete numbers meant to be treated quantitatively
  | 'categorical'  // Discrete classes/labels (even if encoded as integers like 0, 1, 2)
  | 'boolean'      // Two-state values (true/false, 0/1, yes/no)
  | 'datetime'     // Dates or timestamps
  | 'text';        // Free-form strings or high-cardinality identifiers

export type ColumnSemanticRole =
  | 'feature'      // Standard input predictor
  | 'target'       // Default or alternative classification target
  | 'identifier'   // Row IDs, names, keys (should be excluded from model training)
  | 'sensitive'    // Protected attributes (race, sex, age) for fairness/bias auditing
  | 'leaky';       // Post-outcome variables or duplicates of the target

export interface DatasetMetadata {
  id: string;
  name: string;
  tagline: string;      // One-line summary (max ~90 chars) for catalog cards
  description: string;  // 1-3 paragraph overview displayed on the dataset detail header
  domain: 'biology' | 'healthcare' | 'finance' | 'criminal-justice' | 'social-science' | 'marketing';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  files: {
    csv: string;               // "data.csv"
    datasheetMarkdown: string; // "datasheet.md"
    datasheetHtml: string;     // "datasheet.html"
  };
  parsing: {
    delimiter: ',' | ';' | '\t';
    hasHeader: boolean;
    overrideHeaders?: string[];
    missingValueTokens: string[];
  };
  stats: {
    rowCount: number;
    columnCount: number;
    fileSizeBytes: number;
    hasMissingValues: boolean;
    defaultTargetDistribution?: Record<string, number>;
  };
  modeling: {
    defaultTarget: string;
    targetCandidates: TargetCandidate[];
  };
  columns: ColumnMetadata[];
  provenance: {
    homepageUrl: string;
    sourceRepositoryUrl: string;
    license: string;
    yearPublished: number;
    creators: string[];
  };
  references: DatasetReference[];
  ethics?: {
    sensitiveColumns: string[];
    warnings: string[];
  };
}

export interface TargetCandidate {
  column: string;
  taskType: TaskType;
  positiveClass?: string | number;
  description: string;
  leakyColumns?: string[];
}

export interface ColumnMetadata {
  name: string;
  displayName: string;
  description: string;
  dataType: ColumnDataType;
  semanticRole: ColumnSemanticRole;
  unit?: string;
  defaultSelected: boolean;
  exclusionReason?: string;
  missingCount: number;
  implicitMissingValues?: (string | number)[];
  valueLabels?: Record<string, string>;
}

export interface DatasetReference {
  title: string;
  authors?: string[];
  year?: number;
  type: 'seminal-paper' | 'fairness-audit' | 'article' | 'documentation';
  url: string;
  citation?: string;
}

```

**Mandatory `metadata.json` Rules:**

* Every column with `semanticRole` `'target'`, `'identifier'`, or `'leaky'` MUST have `defaultSelected: false`.
* Every `'identifier'` and `'leaky'` column MUST include a clear `exclusionReason`.
* Integer-coded categorical variables (e.g., `pclass` = `1, 2, 3`) MUST use `dataType: "categorical"` and populate `valueLabels`.
* Populate `references[]` with verified URLs/DOIs and APA or BibTeX strings in `citation`.

### Step 4: Research & Author `/public/datasets/{id}/datasheet.md`

1. **Reuse Existing Public Dataset Cards First:** Search for existing public dataset cards or official documentation on the **Hugging Face Hub**, **UCI Machine Learning Repository**, **OpenML**, **Papers With Code**, and seminal papers. Adapt verified variable definitions, collection procedures, and documented caveats rather than inventing descriptions from scratch.
2. **Synthesize Four Transparency Standards:** Structure `datasheet.md` to satisfy:
* [Hugging Face Dataset Cards](https://huggingface.co/docs/hub/en/datasets-cards) (YAML frontmatter + structured sections)
* [Datasheets for Datasets](https://casrai.org/guides/datasheets-for-datasets) (Gebru et al., 2021 lifecycle coverage)
* [Google Research Data Cards Playbook](https://sites.research.google/datacardsplaybook/) (purpose, provenance, human attributes, fit-for-purpose guidance)
* [Open Trusted Data Initiative (OTDI) Dataset Requirements](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/) (verifiable lineage, open licensing, PII/privacy check, quality metrics)


3. **Require Linked Source Attribution:** Include clickable Markdown links (`[Source Title](URL)`) inline where facts or caveats are cited, and list every public dataset card, repository, and paper consulted in **Section 8**.
4. **Synchronize Numbers:** Ensure every count, class distribution, license string, and URL in `datasheet.md` matches `metadata.json` and `data.csv` identically.

#### Required `datasheet.md` Template

```markdown
---
pretty_name: "{Dataset Name}"
task_categories:
  - tabular-classification
task_ids:
  - "{binary-classification | multiclass-classification}"
license: "{SPDX or Canonical License Identifier}"
size_categories:
  - "{e.g., n<1K | 1K<n<10K | 10K<n<100K}"
source_datasets:
  - "{Canonical Upstream Dataset Identifier}"
tags:
  - "{domain}"
  - "{difficulty}"
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
  - **Default Target:** `{defaultTarget}` (`{binary-classification | multiclass-classification}`), positive class encoding (if binary), and exact class counts/percentages matching `metadata.json`.
  - **Alternative Classification Target(s):** Any valid secondary classification targets in `targetCandidates` (if applicable).
- **Feature Schema Summary:** Table or grouped summary of predictor variables, data types, measurement units, and coded categorical `valueLabels`.
- **Excluded Columns (Identifiers & Leakage Controls):** Explicit list of columns excluded by default (`semanticRole: "identifier"` or `"leaky"`), explaining why using them causes overfitting or target leakage.

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
- **License & Redistribution Terms:** Exact license name, link to license text, and confirmation of open redistribution rights.
- **Maintenance & Versioning:** Static educational snapshot status, upstream version/date, and how known errata are documented.

## 8. Sources, Public Dataset Cards & Academic References
- **Public Dataset Cards & Repositories Consulted:**
  - [{Public Dataset Card or Repository Title}]({URL}) - Note what metadata, schema details, or caveats were adapted or verified from this source.
- **Seminal Papers & Fairness Audits:**
  - [{Paper Title}]({URL}) - {Authors} ({Year}). {Full citation matching `metadata.json` `references[]`}.

```

### Step 5: Validate & Update Catalog Index

1. Run the project's dataset build/validation script (if present in `package.json`) so `metadata.json` is validated against `DatasetMetadata`, `datasheet.md` compiles to `datasheet.html`, and `/public/datasets/manifest.json` updates cleanly.
2. If `selection-rationale.md` exists in the repository, append a row summarizing the newly added dataset.

## 4. Definition of Done

Do not finish until all checks pass:

* [ ] `/public/datasets/{id}/data.csv`, `metadata.json`, and `datasheet.md` exist.
* [ ] `metadata.json` passes TypeScript schema validation and includes only classification targets (`binary-classification` or `multiclass-classification`).
* [ ] `columns[]` matches `data.csv` headers (or `overrideHeaders`) byte-for-byte in exact order, and `stats` / `missingCount` match `data.csv` with zero drift.
* [ ] All `'target'`, `'identifier'`, and `'leaky'` columns have `defaultSelected: false`, and leakage columns are listed in `targetCandidates[].leakyColumns`.
* [ ] `datasheet.md` includes YAML frontmatter, all 8 sections, verified details from public dataset cards (where available), and clickable Markdown links to all consulted sources.