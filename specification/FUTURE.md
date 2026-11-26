# Future development

**Updated:** 2026-11-26

Items the specifications mark as _future_, _later_ or _deferred_. They are **not** to be planned or built until a human moves them into a spec. Open questions about current scope are in [TODO.md](TODO.md). Deliberate exclusions are listed under **Non-goals** in each component spec (§11) and are not future work.

## Product

- **Column transformations on Load Data** ([workflow-steps §1, Future Development](workflow-steps.md)):
  - Convert numeric columns to `boolean` or `categorical` using rules.
  - Delete records based on specific column values.
  - Delete a column.
- **Richer column statistics & charts:** Interactive graphical distribution charts and standard deviation calculation/display for numeric columns (deferred in Step 1 T4; currently summary stats and discrete histogram bins are stored and displayed).
- **Editable dataset metadata and fairness audits:** In-browser editing of dataset descriptions/column notes; pedagogical algorithmic fairness exploration on sensitive attributes (e.g. sex/race in COMPAS or Adult Census).
- **Dataset card repeated-action a11y review:** Human evaluation of `aria-describedby` pointing to card descriptions for repeated action buttons vs clean native button accessible names.
- **Error-Correcting Output Codes (ECOC)** as a multiclass strategy, alongside native multiclass, One-vs-Rest and One-vs-One ([workflow-steps §3.3](workflow-steps.md)).
- **Learner-decided missing values.** Dataset authors declare which coded values count as missing (`implicitMissingValues`; see [sample-datasets.md](sample-datasets.md)). Learners cannot currently change that choice. An open pedagogical question is whether learners should decide per column on Load Data or Select Features. A middle option is to keep the author's default, show affected counts and let the learner override it with an explanation.
- **More Training Setup options.** Add custom holdout ratios, editable random seeds and missing-value controls for training once the relevant contracts are specified. [Training Setup](components/training-setup.md)
- **Temporal feature engineering.** `date`, `time` and `datetime` columns are inferred and stored (UTC epoch milliseconds, or milliseconds since midnight for times), but are not model inputs. Future work may add feature engineering for them and recognise further formats: `.` separators, weekday prefixes, non-English month names, 12-hour clocks for time-only columns and nanosecond (19-digit) epoch timestamps.
- **User control over temporal types.** Let the learner change a column's elected temporal type, for example to keep times in a mostly-date column.
- **User control over epoch detection.** Let the learner mark an integer column as a timestamp, or not, overriding the ungated epoch detection.
- **Richer type-specific dataset preview formatting:** Deferred in `virtual-table-component.md`; current display formats numbers with grouping separators while preserving decimals, and escapes cell values as text. Richer boolean indicators, fixed-precision floats, currency, and percentages are deferred.
- **Richer classification results** (deferred from [Phase 4](plans/archive/web-ml-phase-4-single-model-results.md)):
  - **Normalised expected cost (NEC)** with a cost-ratio slider.
  - **Subgroup fairness gap** for a chosen protected attribute (TODO-43).
  - **Selectable positive class** for the threshold explorer and binary metrics; Phase 4 fixes the second class as positive.
  - **Prediction latency** alongside fit time.
  - **Hand-built SVG charts** that replace Observable Plot where a bespoke chart is clearer, such as a Sankey-style confusion flow.
- **Richer model comparison:** Superimposed ROC and precision–recall curves, multi-model reliability plots, a Pareto scatter, a decision-boundary gallery and normalised expected cost with a cost-ratio slider remain future work.
- **Richer feature importance** (deferred from [compare-feature-importance](plans/compare-feature-importance.md); source [note](notes/feature-importance.md)):
  - A features × models importance heatmap with per-model normalisation, rank labels and a "highest disagreement" sort.
  - Permutation importance in each model's Section 6 results, with a top-N toggle, relative share and tooltips.
  - Decision Tree impurity importance (MDI) beside permutation importance, summed per source column.
  - Warnings on strongly correlated columns, which needs `web-ml` association diagnostics.
  - A configurable shuffle count (the note suggests 10; v1 uses 5).
  - Effect plots (ALE, or PDP with ICE), local explanations for single rows, counterfactuals, a 2D decision-boundary explorer and feature-sliced error analysis.

## Engineering

From [ARCHITECTURE § Future Improvements](ARCHITECTURE.md) unless noted. TODO-51 asks which of these apply to this repo rather than to `web-ml`.

- **`bun run doctor`** setup check: verify the required tools and dependencies, and print instructions for fixing problems.
- **Devcontainer or Codespaces** configuration for contributors.
- **Migrate CI to the shared `agent-workflow` template** once it exists.
- **Upstream partition feasibility.** Replace samatā’s class-count fold limit when web-ml publishes its feasibility check. Phase 3 treats an upstream rejection as authoritative and reopens Training Setup with the reason. [Decision D7](plans/archive/web-ml-phase-2-training-setup.md#technical-decisions)

## Project

- **Open-source release** of the app and the `web-ml` models ([VISION §12](VISION.md)).

## Revisit only if a spec needs it

- **`<app-button>` custom element:** only if a future spec needs behaviour CSS cannot provide, such as a loading state with an announced status ([button.md §2](components/button.md)).
