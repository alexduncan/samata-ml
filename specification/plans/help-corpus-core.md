# Help corpus: workflow guides, results guides and concepts

**Status:** stub | **Updated:** 2026-11-26T18:45:17Z
**Authors:** Claude Code (claude-opus-5-5) | **Created:** 2026-11-26T18:45:17Z
**Verified by:** — | **Verified:** — | **Verification:** pending
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour** — After [comprehensive-help-documentation](comprehensive-help-documentation.md), Help has the hub, three migrated workflow guides, two section indexes, the Neural networks family page, the MLP `activation` article and the Sigmoid concept, all governed by `specification/help-documentation.md`.

**Target behaviour** — Workflow guides for every step (`inspect-data`, `set-target`, `training-progress`, plus the three existing guides brought up to the workflow archetype). Results guides `/help/metrics/understanding-results` and `/help/metrics/comparing-models`, which embed result terms from `RESULT_TERM_COPY` through a new `::terms[{surface}]` directive rather than copying them, and use **practical equivalence**. About 16 concept articles (sigmoid already exists): regularisation, solvers and gradient descent, stopping tolerance, overfitting and underfitting, class weights and imbalance, distance metrics, prior probability, smoothing, kernels, impurity, random seed, multiclass strategies, data leakage, stratified splitting and probability calibration.

## Scope

**In scope** (re-verify with `codebase-scout` when expanding)

- Articles and figures, written with `write-help` and reviewed with `review-help` in separate sessions, each accepted with `bun run docs:accept`.
- The `::terms` directive and its rule IDs. Any tightening of the workflow archetype's required sections.

**Out of scope**

- Model, family and option articles (`help-corpus-models.md`). One article per metric.

## Risks and open questions

- **Blocking:** None identified yet; run `/create-plan` to expand. This plan depends on the `write-help` and `review-help` skills existing in `agent-workflow`.
