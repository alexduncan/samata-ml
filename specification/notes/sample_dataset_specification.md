# Sample Dataset & Dataset Card Specification

A robust dataset specification serves two primary consumers in this application:
1. **User Interface Components:** Browse and filter catalog cards, inspect column schemas, render rich Dataset Cards (`datasheet.html`), surface fairness warnings, and cite academic sources.
2. **Client-Side ML Pipeline (Web Workers):** Parse non-standard CSV quirks, impute explicit and disguised missing values, configure classification targets, and prevent target leakage or UI-freezing high-cardinality encodings.

> **Phase 1 Scope Constraint (Classification Only):** Phase 1 of the application supports **tabular classification only** (`binary-classification` and `multiclass-classification`). Regression tasks and continuous numeric target variables are excluded from the build validator, catalog filters, target selector, and client-side model trainers.

---

### 1. Directory, Discovery & Build Pipeline Architecture

Because browsers cannot list directory contents at runtime, a build-time script (e.g., `scripts/build-datasets.ts`, run during `prebuild` / `build`) must validate all dataset artifacts, compile Markdown Dataset Cards to HTML, and emit a root `/public/datasets/manifest.json` index file:

```text
/public/datasets/
├── manifest.json                 # Auto-generated catalog index for fast UI rendering
├── iris/
│   ├── data.csv                  # Standardized raw dataset file (or mapped via metadata.files.csv)
│   ├── datasheet.md              # Source Dataset Card (YAML frontmatter + Markdown)
│   ├── datasheet.html            # Build-compiled HTML output (frontmatter stripped)
│   └── metadata.json             # Validated against src/types/dataset.ts
└── compas-recidivism/
    └── ...
```

#### Build Script Responsibilities
Coding agents implementing the dataset build script must enforce the following pipeline steps and fail the build on any violation:
1. **Schema & Scope Validation:** Validate every `metadata.json` against `DatasetMetadata` (`src/types/dataset.ts`). Reject any dataset or `targetCandidate` whose `taskType` is not `'binary-classification'` or `'multiclass-classification'`.
2. **CSV-to-Metadata Integrity Check:** Parse `data.csv` using `metadata.parsing` rules and verify that:
   - `columns[]` length matches `stats.columnCount`, and every `columns[].name` matches the CSV header string (or `parsing.overrideHeaders`) byte-for-byte in exact order.
   - `stats.rowCount`, `stats.fileSizeBytes`, `stats.hasMissingValues`, `stats.defaultTargetDistribution`, and per-column `missingCount` match the actual CSV file with zero drift.
3. **Dataset Card Compilation (`datasheet.md` → `datasheet.html`):**
   - Extract and validate the YAML frontmatter block from `datasheet.md` so raw YAML delimiters are **stripped** before HTML rendering.
   - Compile the Markdown body to clean, semantic HTML (`datasheet.html`) supporting GitHub Flavored Markdown tables, code blocks, and external links (`target="_blank" rel="noopener noreferrer"`).
4. **Manifest Generation (`/public/datasets/manifest.json`):** Emit a lightweight JSON array of `DatasetManifestEntry` objects so the catalog view renders immediately without fetching individual `metadata.json` or `data.csv` files.

---

### 2. TypeScript Specification (`src/types/dataset.ts`)

Drop these interfaces into `src/types/dataset.ts` and use them as the shared contract across the build validator, catalog UI, dataset detail view, and Web Worker ML pipeline:

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
  | 'identifier'   // Row IDs, names, keys (must be excluded from model training)
  | 'sensitive'    // Protected attributes (race, sex, age) for fairness/bias auditing
  | 'leaky';       // Post-outcome variables or duplicates of the target

export interface DatasetMetadata {
  /** Kebab-case directory name, e.g., "palmer-penguins" */
  id: string;
  /** Human-readable title, e.g., "Palmer Penguins" */
  name: string;
  /** One-line summary (max ~90 chars) for catalog cards */
  tagline: string;
  /** 1-3 paragraph overview displayed on the dataset detail header */
  description: string;

  /** High-level categorization for filtering and badges */
  domain: 'biology' | 'healthcare' | 'finance' | 'criminal-justice' | 'social-science' | 'marketing';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];

  /** Relative paths within /public/datasets/{id}/ */
  files: {
    csv: string;               // e.g., "data.csv"
    datasheetMarkdown: string; // e.g., "datasheet.md" (Dataset Card source)
    datasheetHtml: string;     // e.g., "datasheet.html" (Compiled Dataset Card)
  };

  /** Instructions for the browser CSV parser */
  parsing: {
    delimiter: ',' | ';' | '\t';
    hasHeader: boolean;
    /** Optional header override for non-standard CSVs (e.g., scikit-learn exports) */
    overrideHeaders?: string[];
    /** Strings to treat as null/NaN during parsing, e.g., ["", "NA", "?", " ?"] */
    missingValueTokens: string[];
  };

  /** Precomputed summary stats so catalog cards render without fetching the CSV */
  stats: {
    rowCount: number;
    columnCount: number;
    fileSizeBytes: number;
    hasMissingValues: boolean;
    /** Class distribution summary for the default target, e.g., { "0": 549, "1": 342 } */
    defaultTargetDistribution: Record<string, number>;
  };

  /** Guidance for configuring the ML model trainer UI */
  modeling: {
    defaultTarget: string;
    targetCandidates: TargetCandidate[];
  };

  /** Complete ordered schema matching the CSV columns */
  columns: ColumnMetadata[];

  /** Provenance, licensing, and external links */
  provenance: {
    /** Canonical homepage (UCI, Kaggle, OpenML, ProPublica, etc.) */
    homepageUrl: string;
    /** Direct link to the upstream raw repository/file */
    sourceRepositoryUrl: string;
    license: string;
    yearPublished: number;
    creators: string[];
  };

  /** Academic papers, seminal benchmarks, and educational articles */
  references: DatasetReference[];

  /** Fairness and ethical context surfaced in the UI */
  ethics?: {
    sensitiveColumns: string[];
    warnings: string[];
  };
}

export interface TargetCandidate {
  /** Exact column name in the CSV */
  column: string;
  taskType: TaskType;
  /** For binary classification, which label represents the positive class (1) */
  positiveClass?: string | number;
  /** Short explanation of what predicting this column means */
  description: string;
  /** Columns that MUST be auto-disabled if this target is chosen (prevents target leakage) */
  leakyColumns?: string[];
}

export interface ColumnMetadata {
  /** Exact column header string in the CSV */
  name: string;
  /** Clean label for charts and tables, e.g., "Culmen Length" */
  displayName: string;
  /** Detailed explanation of what the variable measures */
  description: string;
  dataType: ColumnDataType;
  semanticRole: ColumnSemanticRole;
  /** Measurement unit if applicable, e.g., "mm", "g", "years", "USD" */
  unit?: string;
  /** Whether the feature selector should check this column by default */
  defaultSelected: boolean;
  /** Shown in a UI tooltip when defaultSelected is false (e.g., "Duplicates target 'survived'") */
  exclusionReason?: string;
  /** Number of explicit missing values in the raw CSV */
  missingCount: number;
  /** Values that represent disguised missing data (e.g., [0] for glucose/BMI in Pima Diabetes) */
  implicitMissingValues?: (string | number)[];
  /** Human-readable labels for coded values, e.g., { "1": "1st Class", "2": "2nd Class" } */
  valueLabels?: Record<string, string>;
}

export interface DatasetReference {
  title: string;
  authors?: string[];
  year?: number;
  type: 'seminal-paper' | 'fairness-audit' | 'article' | 'documentation';
  url: string;
  /** Optional BibTeX or APA citation string for a "Copy Citation" button */
  citation?: string;
}

/** Summary object emitted into /public/datasets/manifest.json at build time */
export interface DatasetManifestEntry {
  id: string;
  name: string;
  tagline: string;
  domain: DatasetMetadata['domain'];
  difficulty: DatasetMetadata['difficulty'];
  tags: string[];
  defaultTaskType: TaskType;
  stats: DatasetMetadata['stats'];
  hasEthicsWarnings: boolean;
  license: string;
}
```

---

### 3. Dataset Card Specification (`datasheet.md` & `datasheet.html`)

Every dataset directory includes a structured Markdown **Dataset Card** (`datasheet.md`), which compiles to `datasheet.html` at build time and is displayed inside the dataset detail view's **Dataset Card** tab or drawer.

#### Standards Alignment
The Dataset Card schema synthesizes four established dataset documentation standards:
1. **[Hugging Face Dataset Cards](https://huggingface.co/docs/hub/en/datasets-cards):** Structured YAML frontmatter (`pretty_name`, `task_categories`, `task_ids`, `license`, `size_categories`, `source_datasets`, `tags`) and standardized card sections.
2. **[Datasheets for Datasets](https://casrai.org/guides/datasheets-for-datasets) (Gebru et al., 2021):** Full dataset lifecycle transparency across Motivation, Composition, Collection Process, Preprocessing/Cleaning, Uses, Distribution, and Maintenance.
3. **[Google Research Data Cards Playbook](https://sites.research.google/datacardsplaybook/):** Practitioner-focused modules covering Purpose & Intentionality, Provenance & Upstream Sources, Human Attributes & Sensitive Data, Transformations, and Fit-for-Purpose Guidance.
4. **[AI Alliance Open Trusted Data Initiative (OTDI) Dataset Requirements](https://the-ai-alliance.github.io/open-trusted-data-initiative/dataset-requirements/):** Verifiable lineage, explicit open licensing, PII/privacy assessment, completeness metrics, and synchronized machine- and human-readable metadata.

#### Authoring & Rendering Requirements
- **Public Card Reuse:** Dataset cards incorporate and adapt verified documentation from existing public dataset cards (Hugging Face Hub, UCI Machine Learning Repository, OpenML, Papers With Code) rather than inventing descriptions.
- **Linked Attribution:** Every `datasheet.md` contains clickable Markdown links (`[Source Name](URL)`) inline where facts or caveats are cited, plus a dedicated **Section 8** listing all consulted public dataset cards, upstream repositories, and academic papers.
- **Canonical Structure (`datasheet.md`):**

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
- **Overview:** Concise 2–4 sentence summary of the dataset and classification task.
- **Original Purpose & Creators:** Why the dataset was created, original authors, and sponsors.
- **Benchmark & Pedagogical Significance:** Role in ML or algorithmic fairness literature and learning objectives.

## 2. Dataset Structure & Composition
- **Unit of Observation:** What each row represents.
- **Classification Target(s) & Class Distribution:** Default target, positive class encoding (if binary), exact class counts/percentages, and any secondary classification targets.
- **Feature Schema Summary:** Overview of predictors, data types, measurement units, and coded categorical `valueLabels`.
- **Excluded Columns (Identifiers & Leakage Controls):** Explicit list of excluded `'identifier'` and `'leaky'` columns and why they are disabled by default.

## 3. Provenance, Collection Process & Sampling Frame
- **Upstream Lineage:** Lineage from original collection to `data.csv`, linking to both [Canonical Homepage]({homepageUrl}) and [Source Repository]({sourceRepositoryUrl}).
- **Acquisition Method:** How, when, and where measurements or administrative records were recorded.
- **Population & Sampling Frame:** Geographic, demographic, and temporal scope plus known sampling gaps.

## 4. Preprocessing, Cleaning & Data Quality Audit
- **Upstream Transformations:** Filtering, discretization, or mirror-specific changes (e.g., UCI vs. OpenML vs. R exports).
- **Missing Data Profile:** Explicit missing tokens (`NA`, `?`, `""`) and disguised numeric sentinels (`implicitMissingValues`).
- **Known Formatting & Modeling Traps:** Non-standard headers, whitespace padding, pre-encoded dummies, or severe class imbalance.

## 5. Recommended Uses & Fit-for-Purpose Guidance
- **Recommended Pedagogical Classification Workflows:** Suitable classifiers, preprocessing pipelines, and classification metrics (Accuracy, Precision/Recall, F1, ROC-AUC).
- **Out-of-Scope & Inappropriate Uses:** Why models trained on this dataset must not be used for production decisions or causal claims.

## 6. Ethical Considerations, Privacy & Fairness Analysis
- **Sensitive & Protected Attributes:** Demographic or proxy columns (`sex`, `race`, `age`, etc.).
- **Privacy & PII Assessment:** Confirmation that direct personal identifiers are absent or marked excluded (`identifier`).
- **Documented Biases & Representational Harms:** Structural, historical, or label biases identified in peer-reviewed audits.
- **Recommended Fairness Audits:** Concrete subgroup disparity checks (e.g., false positive rate or selection rate parity) to run in the UI.

## 7. Distribution, Licensing & Maintenance
- **License & Redistribution Terms:** Exact license name, link to license text, and open redistribution confirmation.
- **Maintenance & Versioning:** Static snapshot details, upstream version/date, and errata notes.

## 8. Sources, Public Dataset Cards & Academic References
- **Public Dataset Cards & Repositories Consulted:** Linked attribution to every upstream card or catalog consulted.
- **Seminal Papers & Fairness Audits:** Linked full citations matching `metadata.json` `references[]`.
```

---

### 4. How This Drives the User Interface & ML Pipeline

* **Instant Catalog Cards (`manifest.json`):** The catalog view fetches `/public/datasets/manifest.json` on load so users can filter by `domain`, `difficulty`, and `defaultTaskType` (`binary-classification` vs. `multiclass-classification`), and inspect row counts, file sizes, and visual class-balance bars (`stats.defaultTargetDistribution`) before downloading any CSV.
* **Smart Target & Feature Selector (`modeling.targetCandidates`, `columns`):**
  * When a user picks a classification target from `targetCandidates`, the UI automatically unchecks any column listed in `leakyColumns` and displays its `exclusionReason` in a tooltip.
  * Columns with `semanticRole` `'target'`, `'identifier'`, or `'leaky'` initialize with `defaultSelected: false` and cannot be silently included without explicit user override.
  * Integer-coded categories (like `pclass` in Titanic or `0/1/2` in Wine) use `dataType: "categorical"` and `valueLabels` so both UI charts and one-hot/ordinal encoders treat them as discrete classes rather than continuous numbers.
* **Interactive Dataset Card Viewer (`datasheet.html`):** When a user opens a dataset, the detail view fetches `/public/datasets/{id}/datasheet.html` and renders the structured Dataset Card in a dedicated **Dataset Card** tab/drawer with scoped typography and clickable source citations.
* **Data Quality & Fairness Banners (`implicitMissingValues`, `ethics`):**
  * The client-side preprocessor replaces both `parsing.missingValueTokens` and per-column `implicitMissingValues` with `NaN` prior to imputation so sentinel `0`s do not corrupt feature statistics.
  * When `ethics.sensitiveColumns` is populated, the UI surfaces ethical context banners and enables subgroup fairness metrics (e.g., false positive rate parity, true positive rate parity, and demographic parity) alongside overall classification metrics.
* **Provenance & Further Reading Drawer (`provenance`, `references`):** Separates the canonical data source from academic papers and fairness audits, providing one-click citation copying (`citation`).

---

### 5. Concrete Example (`titanic/metadata.json`)

This excerpt illustrates how the schema handles redundant columns, coded integers, class distribution, and missing values in Seaborn's `titanic.csv`:

```json
{
  "id": "titanic",
  "name": "Titanic Passenger Survival",
  "tagline": "Predict passenger survival on the RMS Titanic from demographic and ticket records.",
  "description": "Historical passenger manifest records from the 1912 sinking of the RMS Titanic. Widely used as an introductory binary classification dataset featuring mixed numeric and categorical variables, missing values, and strong socioeconomic survival patterns.",
  "domain": "social-science",
  "difficulty": "beginner",
  "tags": ["mixed-types", "missing-values", "classic"],
  "files": {
    "csv": "data.csv",
    "datasheetMarkdown": "datasheet.md",
    "datasheetHtml": "datasheet.html"
  },
  "parsing": {
    "delimiter": ",",
    "hasHeader": true,
    "missingValueTokens": ["", "NA", "NaN"]
  },
  "stats": {
    "rowCount": 891,
    "columnCount": 15,
    "fileSizeBytes": 57018,
    "hasMissingValues": true,
    "defaultTargetDistribution": { "0": 549, "1": 342 }
  },
  "modeling": {
    "defaultTarget": "survived",
    "targetCandidates": [
      {
        "column": "survived",
        "taskType": "binary-classification",
        "positiveClass": 1,
        "description": "Predict whether the passenger survived the sinking (1 = Survived, 0 = Died).",
        "leakyColumns": ["alive"]
      },
      {
        "column": "pclass",
        "taskType": "multiclass-classification",
        "description": "Predict passenger ticket class (1st, 2nd, or 3rd) from fare and demographics.",
        "leakyColumns": ["class"]
      }
    ]
  },
  "columns": [
    {
      "name": "survived",
      "displayName": "Survived",
      "description": "Survival outcome of the passenger.",
      "dataType": "boolean",
      "semanticRole": "target",
      "defaultSelected": false,
      "missingCount": 0,
      "valueLabels": { "0": "Did not survive", "1": "Survived" }
    },
    {
      "name": "pclass",
      "displayName": "Ticket Class",
      "description": "Proxy for socioeconomic status based on ticket tier.",
      "dataType": "categorical",
      "semanticRole": "feature",
      "defaultSelected": true,
      "missingCount": 0,
      "valueLabels": { "1": "1st Class (Upper)", "2": "2nd Class (Middle)", "3": "3rd Class (Lower)" }
    },
    {
      "name": "sex",
      "displayName": "Sex",
      "description": "Recorded biological sex of the passenger.",
      "dataType": "categorical",
      "semanticRole": "sensitive",
      "defaultSelected": true,
      "missingCount": 0
    },
    {
      "name": "age",
      "displayName": "Age",
      "description": "Passenger age in years (fractional if less than 1).",
      "dataType": "numeric",
      "semanticRole": "feature",
      "unit": "years",
      "defaultSelected": true,
      "missingCount": 177
    },
    {
      "name": "alive",
      "displayName": "Alive (String)",
      "description": "Text duplicate of the 'survived' column.",
      "dataType": "boolean",
      "semanticRole": "leaky",
      "defaultSelected": false,
      "exclusionReason": "Exact string duplicate of the 'survived' target column.",
      "missingCount": 0
    }
  ],
  "provenance": {
    "homepageUrl": "https://www.openml.org/d/40945",
    "sourceRepositoryUrl": "https://github.com/mwaskom/seaborn-data/blob/master/titanic.csv",
    "license": "Public Domain / CC0",
    "yearPublished": 1999,
    "creators": ["Thomas Cason", "Frank E. Harrell Jr."]
  },
  "references": [
    {
      "title": "The 'Unusual Episode' Data Revisited",
      "authors": ["Robert J. MacG. Dawson"],
      "year": 1995,
      "type": "seminal-paper",
      "url": "https://www.tandfonline.com/doi/abs/10.1080/10691898.1995.11910499"
    }
  ],
  "ethics": {
    "sensitiveColumns": ["sex", "age"],
    "warnings": [
      "Historical rescue protocols ('women and children first') create strong demographic correlations that illustrate how societal norms become encoded in historical data."
    ]
  }
}
```

---

### 6. Data Pipeline & Build Guardrails (Known Dataset Pitfalls)

Both the build script and the browser CSV/ML pipeline must defend against six documented dataset failure modes:

| Trap | Affected Datasets | Implementation Guardrail |
| --- | --- | --- |
| **Non-standard CSV header rows** | `wine_data.csv`, `breast_cancer.csv` (scikit-learn) | Scikit-learn's raw CSVs put dataset dimensions and class names on Row 0 (e.g., `178,13,class_0,class_1,class_2`) instead of feature names. Normalize CSV headers during dataset onboarding or honor `parsing.overrideHeaders` in both the build validator and browser parser. |
| **Target leakage & duplicate columns** | `titanic.csv`, `compas-scores-two-years.csv`, `bank-full.csv` | Seaborn's Titanic contains `survived` + `alive` and `pclass` + `class`. COMPAS contains `decile_score` and `score_text` (proprietary risk model outputs). Bank Marketing contains `duration` (call length, unknown *before* placing a call). Enforce `leakyColumns` and `semanticRole: "leaky"` auto-exclusion in the feature selector. |
| **Disguised missing values** | `PimaIndiansDiabetes.csv`, `adultTrain.csv`, `penguins.csv` | Pima Indians encodes missing lab results as `0` (e.g., `0` glucose or `0` BMI). Adult Census uses `"?"` or `" ?"` (with a leading space). Palmer Penguins uses `"NA"`. Apply `parsing.missingValueTokens` during CSV parsing and convert `columns[].implicitMissingValues` to `NaN` before imputation. |
| **High-cardinality PII & bloat** | `compas-scores-two-years.csv` (53 columns) | COMPAS includes `id`, `name`, `first`, `last`, and multiple date strings. Blindly one-hot encoding all string columns will generate thousands of sparse features and freeze the Web Worker/UI thread. Exclude `semanticRole: "identifier"` columns by default and cap/guard high-cardinality categorical encoding in the pipeline. |
| **Pre-encoded / R-artifact headers** | `GermanCredit.csv`, `adultTrain.csv` (`selva86` repo) | `selva86/datasets` exports R dataframes: `adultTrain.csv` uses dot-separated names (`marital.status`, `hours.per.week`), and `GermanCredit.csv` is the 62-column `caret` version where categorical variables are already dummy-encoded. Validate that `columns[].name` in `metadata.json` matches the exact CSV header string byte-for-byte. |
| **Metadata / CSV drift** | All datasets | Manual edits to `metadata.json` or `data.csv` can cause `rowCount`, `columnCount`, `defaultTargetDistribution`, or `missingCount` to go out of sync. Compute and cross-check these values directly from `data.csv` at build time and fail the build on any mismatch. |

---

### 7. Future Improvement

Allow users to manually edit or enrich column metadata by clicking on a column in the table header to display a right sidepanel overlay. Each field (`displayName`, `description`, `dataType`, `semanticRole`, `implicitMissingValues`, and `valueLabels`) will turn into an editable input when clicked, with an option to export the updated `metadata.json`.