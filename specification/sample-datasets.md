# Sample Datasets

**Status:** implemented

Sample dataset source files live in `content/datasets/{id}/`; the build validates and profiles them and emits browser-ready files under `/datasets/`. The catalogue and descriptors are generated, never hand-authored.

## 1. Authoring layout and discovery

Each immediate directory under `content/datasets/` is a sample and must contain `descriptor.ts` and a non-empty `datasheet.md`. It must contain exactly one of local `data.csv`, authored `buildSource` or authored `remoteSource`. A `metadata.json` is not allowed. The directory name and descriptor `id` are the same lowercase kebab-case identifier. The build examines every directory; one invalid sample fails the build.

Local CSVs remain supported for future licensed samples and synthetic tests. Build sources are pinned inputs transformed into same-origin CSVs; remote sources are profiled during the build and fetched directly by the browser. No full sample CSV is tracked in this checkout. Curation is described in provenance.

## 2. Descriptor contract

The TypeScript contract is [`AuthoredDatasetDescriptor`](../src/types/sample-dataset.ts). It contains:

- Identity and catalogue copy: `id`, `name`, `tagline`, `description`, `domain`, `difficulty` and `tags`.
- Optional `missingValueTokens`, which replaces the default sentinels for that sample; empty cells remain missing.
- `modeling.defaultTarget` and `targetCandidates`. Each candidate has a `column`, `taskType`, optional string `positiveClass`, description and optional target-specific `leakyColumns` entries (`column` and reason).
- Ordered `columns`, each with exact CSV `name`, display name, description, a canonical `dataType`, and `role` (`feature` or `identifier`). A column may also be `sensitive`, have a unit, explicit `implicitMissingValues` or `valueLabels`.
- `provenance`, with homepage and source repository URLs, ISO `retrievedAt`, SPDX `license`, `licenseUrl`, attribution, publication year, creators and transformation descriptions; and `references` and optional `ethicsWarnings`.
- Optional `buildSource` or `remoteSource` as described in §6. Build source fields pin both raw and prepared SHA-256 and byte length and select one fixed transform; runtime descriptors omit this authored-only field.

`ColumnType` is the canonical lower-case type from `state-and-storage.md`: `numeric`, `categorical`, `boolean`, `date`, `time`, `datetime` or `text`. The author records each column exactly once in CSV order. Target selection and leakage are target-specific, so neither is stored as a column role. Identifier columns and columns ineligible for modelling are not selected as features; leakage reasons come from the selected target candidate.

The build adds computed `missingCount` to each column, `stats`, and `files` to make a `SampleDatasetDescriptor`. It generates `rowCount`, `columnCount`, original file byte length, SHA-256, missing-value presence and the categorical default-target distribution. Authors do not write statistics or counts.

## 3. Generator validation

The generator uses the ingestion profiler and checks:

- The UTF-8 CSV parses without errors, has data rows, and has neither padded nor skipped rows. For local and build sources its raw header equals the normalised header; all normalised headers exactly match descriptor column names in order. Browser-direct sources retain existing header normalisation.
- Each declared type matches the elected type, except that `text` is always a valid override and `categorical` may override elected `numeric` or `boolean` when every observed value is valid. An override with invalid values fails.
- `implicitMissingValues` is restricted to numeric and categorical columns. A value may be declared missing only when source documentation defines it as unknown, not recorded or not applicable, or when it is impossible for the quantity measured. Do not mark undocumented observed codes, top-codes, censored values or genuine values as missing; undocumented observed codes remain categories and may be labelled as such. A value cannot be both implicit-missing and labelled. Labels must refer to observed category values.
- The default target names a target candidate. Candidates must reference existing, eligible columns; leakage references must exist and cannot point to the target itself. Binary classification requires a categorical column with exactly two categories and an observed `positiveClass`; multiclass classification requires at least three categories; regression requires numeric data.
- An identifier or profiler `identifierHint` cannot be a target. High-cardinality text is not model-eligible.
- Redistributable licences must be `CC0-1.0`, `CC-BY-4.0`, `PDDL-1.0` or `ODbL-1.0`; `LicenseRef-Public-Domain` is restricted to the 1912 inquiry facts. `NOASSERTION` is permitted only for a direct remote source that is not redistributed.

### Profile cache

Build profiles are cached under `node_modules/.cache/samata-ml/dataset-profiles/`. The key includes the CSV SHA-256, missing tokens, each column's name, declared type and implicit missing values, and a hash of the profiler, cell-detector and ingestion-limit source. A CSV, descriptor rule or relevant profiler change therefore triggers a fresh profile. A missing, corrupt or stale cache entry is rebuilt.

## 4. Datasheets

Each `datasheet.md` is first-party Markdown. The build compiles it with the shared Markdown fragment compiler and writes `datasheet.html`; compiler errors or an empty datasheet fail the build. The browser loads the compiled fragment as content. Datasheets are source documentation and do not override the typed descriptor or computed statistics.

## 5. Build output and catalogue

The build writes:

```text
/datasets/
├── index.json
└── {id}/
    ├── descriptor.json
    ├── datasheet.html
    └── data.csv       # bundled samples only
```

`index.json` has `version: 1` and a deterministic `entries` array of `SampleDatasetSummary` values: identity and card copy, domain, difficulty, tags, available task types, licence, CSV origin, generated statistics and a versioned descriptor URL. Entries are ordered by difficulty and then name. `descriptor.json` contains the validated authored metadata, generated column counts and statistics, and versioned file URLs. Bundled CSV and compiled datasheet URLs carry a content-hash query. A remote descriptor's CSV URL is its pinned upstream URL and has `csvOrigin: 'remote'`; bundled entries use `csvOrigin: 'bundled'`.

## 6. Sources, delivery and licensing

The source contract admits exactly one of a local CSV, a build source or a direct remote source. Network sources require positive byte lengths, lowercase SHA-256 digests and the exact approved HTTPS URLs. Build sources also pin the prepared digest and length and choose `identity`, `adult-training`, `bank-full-zip`, `german-credit-quotes`, `strip-utf8-bom` or `titanic-inquiry-counts`. Downloads are bounded by their declared lengths, verified before use and atomically cached under `node_modules/.cache/samata-ml/remote-datasets/`; a corrupt cache is an error, not an offline fallback. The ZIP transform extracts only the verified `bank-full.csv` member at its pinned size. A failed acquisition does not publish a new index.

Eight build-fetched entries are served from Samata's origin. Adult trims fields and writes comma CSV with CRLF; Bank preserves its semicolon-delimited ZIP member; German removes surrounding single quotes from data cells and writes CRLF; Student Dropout removes its leading UTF-8 BOM. Wisconsin, Heart and Iris are identity copies. Titanic expands 32 published contingency cells into 2,201 repeated, non-identifying rows with LF line endings. Input and prepared byte pins and source URLs are in each authored descriptor.

| Sample                                  | Delivery | Licence and source                                                                                                                                                                                        |
| --------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Adult Census                            | Build    | [UCI Adult](https://archive.ics.uci.edu/dataset/2/adult), CC BY 4.0                                                                                                                                       |
| Bank Marketing                          | Build    | [UCI Bank](https://archive.ics.uci.edu/dataset/222/bank+marketing), CC BY 4.0                                                                                                                             |
| Wisconsin Breast Cancer                 | Build    | [UCI WDBC](https://archive.ics.uci.edu/dataset/17/breast+cancer+wisconsin+diagnostic), CC BY 4.0                                                                                                          |
| German Credit                           | Build    | [UCI Statlog](https://archive.ics.uci.edu/dataset/144/statlog+german+credit+data), [OpenML 31 transport](https://www.openml.org/data/get_csv/31/credit-g.csv), CC BY 4.0                                  |
| Heart Disease                           | Build    | [UCI Heart](https://archive.ics.uci.edu/dataset/45/heart+disease), CC BY 4.0                                                                                                                              |
| Iris                                    | Build    | [UCI Iris](https://archive.ics.uci.edu/dataset/53/iris), CC BY 4.0                                                                                                                                        |
| Student Dropout                         | Build    | [UCI Student Dropout](https://archive.ics.uci.edu/dataset/697/predict+students+dropout+and+academic+success), CC BY 4.0                                                                                   |
| Titanic Survival (1912 British Inquiry) | Build    | [Inquiry counts](https://www.titanicinquiry.org/BOTInq/BOTReport/botRepSaved.php), public-domain historical facts, [R table transport](https://search.r-project.org/R/refmans/datasets/html/Titanic.html) |
| Credit Card Default                     | Direct   | [UCI](https://archive.ics.uci.edu/dataset/350/default+of+credit+card+clients), CC BY 4.0; pinned Hugging Face transport                                                                                   |
| Palmer Penguins                         | Direct   | [Curators](https://allisonhorst.github.io/palmerpenguins/#license), CC0 1.0; pinned GitHub transport                                                                                                      |
| COMPAS Recidivism                       | Direct   | [ProPublica datastore terms](https://projects.propublica.org/datastore/terms/), `NOASSERTION`; no redistribution                                                                                          |

The inquiry's `LicenseRef-Public-Domain` identifies the underlying dated facts, not the mirror or R software. Its 711 survivors and 1,490 deaths are reconstructed counts, not recovered individual records. Its four categorical columns are class, sex, age group and survival; fare and individual attributes are absent. Repeated strata are a descriptive teaching example, not independent validation of novel profiles.

Direct URLs are verified at build time and use `csvOrigin: 'remote'`; no CSV is emitted. The browser sends credential-free, referrer-free requests and checks the SHA-256 before parsing. The approved Hugging Face cache redirect is restricted to its pinned same-origin path. CSP permits the specific Palmer and Hugging Face paths alongside the existing COMPAS prefix; COOP, COEP and CORP remain enforced. Saved Pima Diabetes and old Seaborn Titanic projects retain local rows and static column/target guidance, including leakage rules. Neither retired ID accepts a new load; the new inquiry ID never substitutes for old Titanic metadata.

## 7. Non-normative notes

The catalogue can support filtering cards by domain, difficulty and task type and showing row counts, file sizes and target-class distributions. Descriptor metadata can guide target and feature selection, show target-specific leakage reasons, surface sensitive columns and ethics warnings, and present provenance, citations and the compiled datasheet. These are interface intents, not extra generator behaviour.

A future column-details panel may let users add or edit display names, descriptions, types, missing-value rules and value labels, then export that metadata. Learners also may be allowed to override an author's implicit-missing choices with an explanation. Neither editing flow exists in the current descriptor contract or UI.
