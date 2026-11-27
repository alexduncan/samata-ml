# Help corpus: model families, classifiers and hyperparameters

**Status:** stub | **Updated:** 2026-11-26T18:45:17Z
**Authors:** Claude Code (claude-opus-5-5) | **Created:** 2026-11-26T18:45:17Z
**Verified by:** — | **Verified:** — | **Verification:** pending
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour** — After [comprehensive-help-documentation](comprehensive-help-documentation.md), `content/help-docs.lock.json` lists 8 classifiers and 39 exposed options as pending. `bun run audit:docs` reports them per family.

**Target behaviour** — The pending list is empty. Each of the six families (`linear-models`, `neural-networks`, `decision-trees`, `nearest-neighbours`, `naive-bayes`, `support-vector-machines`) has a family page. Each classifier has a model article using `::model-settings`. Each exposed option has a hyperparameter article using `::option-facts`, placed at the family or model path according to `specification/help-documentation.md` §4.

## Scope

**In scope** (re-verify with `codebase-scout` when expanding)

- One task per family or pair of families, each ending with an independent review and `bun run docs:accept`.
- The path decision (family-level or model-level) for every option, recorded in the plan from the installed catalogue, including hidden regressors. The 2026-11-26 draft of `comprehensive-help-documentation.md` (git history) proposed 37 unique option paths for the 40 options as a starting point.

**Out of scope**

- Hidden models (regressors, `k-means`, `pca`) until they are exposed. Unreleased upstream options.

## Risks and open questions

- **Blocking:** None identified yet; run `/create-plan` to expand. This plan depends on the `write-help` and `review-help` skills existing in `agent-workflow`.
