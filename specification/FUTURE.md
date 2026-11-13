# Future development

**Updated:** 2026-11-13

Items the specifications mark as _future_, _later_ or _deferred_. They are **not** to be planned or built until a human moves them into a spec. Open questions about current scope are in [TODO.md](TODO.md). Deliberate exclusions are listed under **Non-goals** in each component spec (§11) and are not future work.

## Product

- **Column transformations on Load Data** ([workflow-steps §1, Future Development](workflow-steps.md)):
    - Convert numeric columns to `boolean` or `categorical` using rules.
    - Delete records based on specific column values.
    - Delete a column.
- **Error-Correcting Output Codes (ECOC)** as a multiclass strategy, alongside native multiclass, One-vs-Rest and One-vs-One ([workflow-steps §3.3](workflow-steps.md)).
- **Learner-decided missing values.** Dataset authors declare which coded values count as missing (`implicitMissingValues`; see [sample-datasets.md](sample-datasets.md)). Learners cannot currently change that choice. An open pedagogical question is whether learners should decide per column on Load Data or Select Features. A middle option is to keep the author's default, show affected counts and let the learner override it with an explanation.
- **Datetime feature engineering.** Datetime columns are inferred and stored as UTC epoch milliseconds, but are not model inputs. Future work may add datetime feature engineering and recognise further date formats: `.` separators, 12-hour clocks, weekday prefixes and non-English month names.

## Engineering

From [ARCHITECTURE § Future Improvements](ARCHITECTURE.md) unless noted. TODO-51 asks which of these apply to this repo rather than to `web-ml`.

- **CI workflow:** install pinned tool versions, run `bun install --frozen-lockfile`, and gate pull requests on the test suite. It should also run the TSDoc lint that [standards-and-documentation.md](standards-and-documentation.md) says CI enforces (Known gap 7).
- **`bun run doctor`** setup check: verify the required tools and dependencies, and print instructions for fixing problems.
- **Devcontainer or Codespaces** configuration for contributors.
- **`SECURITY.md`**, after researching the security requirements.

## Project

- **Open-source release** of the app and the `web-ml` models ([VISION §12](VISION.md)).

## Revisit only if a spec needs it

- **`<app-button>` custom element:** only if a future spec needs behaviour CSS cannot provide, such as a loading state with an announced status ([button.md §2](components/button.md)).
