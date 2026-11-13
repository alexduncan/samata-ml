# Sample Datasets

**Status:** implemented

Sample dataset source files live in `content/datasets/{id}/`; the build validates and profiles them and emits browser-ready files under `/datasets/`. The catalogue and descriptors are generated, never hand-authored.

## 1. Authoring layout and discovery

Each immediate directory under `content/datasets/` is a sample and must contain `descriptor.ts` and a non-empty `datasheet.md`. It must contain exactly one of `data.csv` or `remoteSource` in its descriptor. A `metadata.json` is not allowed. The directory name and descriptor `id` are the same lowercase kebab-case identifier. The build examines every directory; one invalid sample fails the build.

Bundled CSVs are curated UTF-8, comma-delimited files with clean headers. Any curation is described in `provenance.transformations`. The generator does not rewrite a CSV or accept header overrides. A remote sample uses a commit-pinned URL and is not copied into the build output.

## 2. Descriptor contract

The TypeScript contract is [`AuthoredDatasetDescriptor`](../src/types/sample-dataset.ts). It contains:

- Identity and catalogue copy: `id`, `name`, `tagline`, `description`, `domain`, `difficulty` and `tags`.
- Optional `missingValueTokens`, which replaces the default sentinels for that sample; empty cells remain missing.
- `modeling.defaultTarget` and `targetCandidates`. Each candidate has a `column`, `taskType`, optional string `positiveClass`, description and optional target-specific `leakyColumns` entries (`column` and reason).
- Ordered `columns`, each with exact CSV `name`, display name, description, a canonical `dataType`, and `role` (`feature` or `identifier`). A column may also be `sensitive`, have a unit, explicit `implicitMissingValues` or `valueLabels`.
- `provenance`, with homepage and source repository URLs, ISO `retrievedAt`, SPDX `license`, `licenseUrl`, attribution, publication year, creators and transformation descriptions; and `references` and optional `ethicsWarnings`.
- Optional `remoteSource` for the on-demand case in §6.

`ColumnType` is the canonical lower-case type from `state-and-storage.md`: `numeric`, `categorical`, `boolean`, `datetime` or `text`. The author records each column exactly once in CSV order. Target selection and leakage are target-specific, so neither is stored as a column role. Identifier columns and columns ineligible for modelling are not selected as features; leakage reasons come from the selected target candidate.

The build adds computed `missingCount` to each column, `stats`, and `files` to make a `SampleDatasetDescriptor`. It generates `rowCount`, `columnCount`, original file byte length, SHA-256, missing-value presence and the categorical default-target distribution. Authors do not write statistics or counts.

## 3. Generator validation

The generator uses the ingestion profiler and checks:

- The UTF-8 CSV parses without errors, has data rows, and has neither padded nor skipped rows. Its raw header already equals the normalised header and exactly matches descriptor column names in order.
- Each declared type matches the elected type, except that `text` is always a valid override and `categorical` may override elected `numeric` or `boolean` when every observed value is valid. An override with invalid values fails.
- `implicitMissingValues` is restricted to numeric and categorical columns. A value may be declared missing only when source documentation defines it as unknown, not recorded or not applicable, or when it is impossible for the quantity measured. Do not mark undocumented observed codes, top-codes, censored values or genuine values as missing; undocumented observed codes remain categories and may be labelled as such. A value cannot be both implicit-missing and labelled. Labels must refer to observed category values.
- The default target names a target candidate. Candidates must reference existing, eligible columns; leakage references must exist and cannot point to the target itself. Binary classification requires a categorical column with exactly two categories and an observed `positiveClass`; multiclass classification requires at least three categories; regression requires numeric data.
- An identifier or profiler `identifierHint` cannot be a target. High-cardinality text is not model-eligible.
- Bundled licences must be one of `CC0-1.0`, `CC-BY-4.0`, `PDDL-1.0` or `ODbL-1.0`. `NOASSERTION` is permitted only for an on-demand remote source that is not redistributed.

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

## 6. Remote samples and licensing

Use `remoteSource` only when the upstream source declares no licence and must not be redistributed. It contains a commit-pinned CSV `url`, the expected SHA-256 and byte length. The descriptor uses `license: 'NOASSERTION'`; no local `data.csv` is present and no CSV is emitted under `/datasets/`.

The build accepts remote URLs only when they start with a prefix in `REMOTE_CSV_PREFIXES`, fetches and verifies bytes before profiling, and caches verified bytes by SHA-256 under `node_modules/.cache/samata-ml/remote-datasets/`. A mismatch in hash or length fails the build and is not cached. The matching origin path prefix must be the only remote exception in `connect-src` in `public/_headers`; the list and CSP must agree. At runtime the worker fetches the descriptor's CSV URL and verifies its SHA-256 before parsing or writing rows.

## 7. Non-normative notes

The catalogue can support filtering cards by domain, difficulty and task type and showing row counts, file sizes and target-class distributions. Descriptor metadata can guide target and feature selection, show target-specific leakage reasons, surface sensitive columns and ethics warnings, and present provenance, citations and the compiled datasheet. These are interface intents, not extra generator behaviour.

A future column-details panel may let users add or edit display names, descriptions, types, missing-value rules and value labels, then export that metadata. Learners also may be allowed to override an author's implicit-missing choices with an explanation. Neither editing flow exists in the current descriptor contract or UI.
