---
pretty_name: 'Titanic Survival (1912 British Inquiry)'
task_categories:
    - tabular-classification
task_ids:
    - binary-classification
license: 'LicenseRef-Public-Domain'
size_categories:
    - '1K<n<10K'
source_datasets:
    - 'British Wreck Commissioner’s Inquiry'
tags:
    - social-science
    - beginner
---

# Titanic Survival (1912 British Inquiry)

**Domain:** Social science | **Difficulty:** Beginner | **Task:** Binary classification | **Rows:** 2,201 | **Columns:** 4 | **Licence:** Public-domain historical facts

## 1. Dataset Summary & Motivation

The [1912 inquiry report](https://www.titanicinquiry.org/BOTInq/BOTReport/botRepSaved.php) published counts of those aboard and those saved. This teaching sample reconstructs those counts as rows for descriptive modelling.

## 2. Dataset Structure & Composition

Each row represents a person within a published stratum. The target is survival: 711 survived and 1,490 did not. Passenger classes 1st, 2nd, 3rd and crew contain 325, 285, 706 and 885 people respectively; their survivor counts are 203, 118, 178 and 212. The predictors are class, sex and categorical age group (child or adult).

## 3. Provenance, Collection Process & Sampling Frame

The counts come from the British Wreck Commissioner’s Inquiry, as transported in the [R Titanic table](https://search.r-project.org/R/refmans/datasets/html/Titanic.html). They concern those aboard the Titanic in 1912.

## 4. Preprocessing, Cleaning & Data Quality Audit

The build expands the 32 contingency cells into repeated rows. No individual records are recovered. The published table contains no names, fare or family attributes.

## 5. Recommended Uses & Fit-for-Purpose Guidance

Use this as a descriptive teaching and classification example. Repeated rows share the same profiles and are not independent validation of novel feature profiles. Do not use it to infer causal effects or make operational decisions.

## 6. Ethical Considerations, Privacy & Fairness Analysis

Sex is marked sensitive. Historical class and sex differences reflect the conditions of a particular disaster and should not be generalised to other populations. The reconstructed table contains no direct identifiers.

## 7. Distribution, Licensing & Maintenance

The dated inquiry supplies numerical facts. [National Archives guidance](https://www.nationalarchives.gov.uk/terms-and-conditions/copyright/copyright-and-related-rights/) explains the expiry of relevant pre-1957 published Crown copyright. This does not relicense later editorial material, the mirror or R software. The build pins the transport and reconstructed output.

## 8. Sources, Public Dataset Cards & Academic References

- [British inquiry report](https://www.titanicinquiry.org/BOTInq/BOTReport/botRepSaved.php), numbers saved.
- [R Titanic documentation](https://search.r-project.org/R/refmans/datasets/html/Titanic.html), categorical table.
- [Dawson’s teaching dataset and discussion](https://jse.amstat.org/v3n3/datasets.dawson.html).
- [National Archives copyright guidance](https://www.nationalarchives.gov.uk/terms-and-conditions/copyright/copyright-and-related-rights/).
