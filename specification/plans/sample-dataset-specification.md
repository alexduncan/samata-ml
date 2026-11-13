A robust metadata specification needs to serve two consumers: **your UI components** (for browsing, filtering, inspecting columns, and citing sources) and **your client-side ML pipeline** (for parsing quirks, identifying target variables, and preventing data leakage).

### 1. Directory & Discovery Architecture

Because browsers cannot list directory contents at runtime, your build script (which compiles the Markdown datasheets to HTML) should also validate every `metadata.json` and emit a root `/public/datasets/manifest.json` index file:

```text
/public/datasets/
├── manifest.json                 # Auto-generated array of dataset summaries for the catalog UI
├── iris/
│   ├── data.csv                  # Standardized filename (or mapped via metadata.files.csv)
│   ├── datasheet.md              # Source datasheet
│   ├── datasheet.html            # Compiled HTML output
│   └── metadata.json             # Validated against the TypeScript schema below
└── compas-recidivism/
    └── ...

```

---

### 2. TypeScript Specification (`DatasetMetadata`)

Drop this interface into your project (`src/types/dataset.ts`) and use it as the contract for both your coding agent and a build-time schema validator (e.g., via TypeScript compiler checks or JSON Schema):

```typescript
export type TaskType =
  | 'binary-classification'
  | 'multiclass-classification'
  | 'regression';

export type ColumnDataType =
  | 'numeric'      // Continuous or discrete numbers meant to be treated quantitatively
  | 'categorical'  // Discrete classes/labels (even if encoded as integers like 0, 1, 2)
  | 'boolean'      // Two-state values (true/false, 0/1, yes/no)
  | 'datetime'     // Dates or timestamps
  | 'text';        // Free-form strings or high-cardinality identifiers

export type ColumnSemanticRole =
  | 'feature'      // Standard input predictor
  | 'target'       // Default or alternative prediction target
  | 'identifier'   // Row IDs, names, keys (should be excluded from model training)
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
    datasheetMarkdown: string; // e.g., "datasheet.md"
    datasheetHtml: string;     // e.g., "datasheet.html"
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
    /** Optional class distribution summary for the default target, e.g., { "0": 549, "1": 342 } */
    defaultTargetDistribution?: Record<string, number>;
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

```

---

### 3. How This Drives the User Interface

* **Instant Catalog Cards (`stats`, `tagline`, `difficulty`, `tags`):** Users can filter by difficulty or task type and see row counts, file sizes, and class imbalance bars before downloading a single CSV.
* **Smart Target & Feature Selector (`modeling.targetCandidates`, `columns`):**
* When a user picks a target from `targetCandidates`, the UI automatically unchecks any column listed in `leakyColumns` and displays its `exclusionReason`.
* Integer-coded categories (like `pclass` in Titanic or `0/1/2` in Wine) use `dataType: "categorical"` and `valueLabels` so the UI treats them as discrete classes rather than continuous numbers.


* **Data Quality & Ethics Banners (`implicitMissingValues`, `ethics`):** If a user selects COMPAS or Adult Census, the UI can highlight `sensitiveColumns` and offer subgroup fairness metrics (e.g., false positive rate parity) alongside standard accuracy.
* **Further Reading Drawer (`provenance`, `references`):** Separates the upstream data source from academic papers and fairness audits, giving learners direct context on how the dataset is used in real research.

---

### 4. Concrete Example (`titanic/metadata.json`)

This excerpt illustrates how the schema handles redundant columns, coded integers, and missing values in Seaborn's `titanic.csv`:

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

### 5. Potential Problems & Dataset-Specific Pitfalls

Inspecting the 10 specific GitHub URLs you listed reveals several concrete issues your coding agent and data pipeline must handle:

| Trap | Affected Datasets | How to Prevent It |
| --- | --- | --- |
| **Non-standard CSV header rows** | `wine_data.csv`, `breast_cancer.csv` (scikit-learn) | Scikit-learn's raw CSVs put dataset dimensions and class names on Row 0 (e.g., `178,13,class_0,class_1,class_2`) instead of feature names. Either normalize the CSV headers during your build step or populate `parsing.overrideHeaders` in `metadata.json`. |
| **Target leakage & duplicate columns** | `titanic.csv`, `compas-scores-two-years.csv`, `bank-full.csv` | Seaborn's Titanic contains `survived` + `alive` and `pclass` + `class`. COMPAS contains `decile_score` and `score_text` (outputs of the proprietary risk model itself). Bank Marketing contains `duration` (call length, which is unknown *before* placing a marketing call). Use `leakyColumns` and `semanticRole: "leaky"` to auto-exclude these. |
| **Disguised missing values** | `PimaIndiansDiabetes.csv`, `adultTrain.csv`, `penguins.csv` | Pima Indians encodes missing lab results as `0` (e.g., `0` glucose or `0` BMI). Adult Census uses `"?"` or `" ?"` (with a leading space). Palmer Penguins uses `"NA"`. Explicitly configure `missingValueTokens` and `implicitMissingValues` so imputers don't treat `0` BMI as valid. |
| **High-cardinality PII & bloat** | `compas-scores-two-years.csv` (53 columns) | COMPAS includes `id`, `name`, `first`, `last`, and multiple date strings. If your browser app blindly one-hot encodes all string columns, `name` alone will generate thousands of sparse features and freeze the UI thread. Mark them `semanticRole: "identifier"` and `defaultSelected: false`. |
| **Pre-encoded / R-artifact headers** | `GermanCredit.csv`, `adultTrain.csv` (`selva86` repo) | `selva86/datasets` exports R dataframes: `adultTrain.csv` uses dot-separated names (`marital.status`, `hours.per.week`), and `GermanCredit.csv` is the 62-column `caret` version where categorical variables are already dummy-encoded. Make sure your build script validates that `columns[].name` in `metadata.json` matches the exact CSV header string byte-for-byte. |
| **Metadata / CSV drift** | All datasets | If someone updates a CSV or edits `metadata.json` manually, `rowCount`, `columnCount`, or `missingCount` can silently go out of sync. Have your build script compute `stats` and `missingCount` directly from the CSV and fail the build if any column name mismatches. |

### 6. Future Improvement

Allow users to manually add metadata by clicking on a column in the table header to display a right sidepanel overlay. Each field will turn into a text input when clicked allowing the user to add a `displayName`, `description` and `valueLabels`.