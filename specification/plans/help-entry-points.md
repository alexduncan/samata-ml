# Help entry points across the workflow

**Status:** stub | **Updated:** 2026-11-27T07:19:04Z
**Authors:** Claude Code (claude-opus-5-5) | **Created:** 2026-11-26T18:45:17Z
**Verified by:** — | **Verified:** — | **Verification:** pending
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour** — After [comprehensive-help-documentation](comprehensive-help-documentation.md), Help articles exist in a validated index, and `HELP_ROUTES` names the four fixed Help links. Configure Model shows one-sentence hints only. Model Description opens the separate `app-model-description-dialog` from the `models` content domain. Column Details, Training Progress and both results views have no Help links.

**Target behaviour** — Every exposed hyperparameter with a published article shows a **Learn more** link to it, found through the Help index by (model, option), so pending options show no link and no link can be dead. Fixed-option notes link to their concept. Steps 1, 2, 3.5, 3.6 and 4 link to their guides. Model Description opens `/help/models/{family}/{model-id}` in the Help modal.

## Scope

**In scope** (re-verify with `codebase-scout` when expanding)

- `app-model-configuration`: per-option help hrefs must arrive through a typed property, not through the `labels` dictionary, which `COMPONENTS.md` §8 reserves for translated strings. Links sit outside the `aria-describedby` target, with an accessible name that contains the visible text (WCAG 2.5.3). `multiclass` is a constant (`MULTICLASS_STRATEGY`), not a fixed option.
- Entry points in `app-column-details`, `app-training-progress`, `app-model-results` and `app-results-view`, and the builder lookup of the Help index.
- Model Description: migrate `content/en/models/logistic-regression.md` into Help and retire `app-model-description-dialog`, together with its consumers and tests (`src/app.ts:5`, `tests/model-card.e2e.ts:328-346,392`, `tests/app-shell.e2e.ts:185-188`, `tests/a11y.e2e.ts:452`).

**Out of scope**

- Article authoring (corpus plans).

## Risks and open questions

- **Blocking:** `app-column-details` follows the `implemented` mockup `01-5`, which is covered by visual parity. Adding a Help link needs either a human-approved mockup change or a recorded deviation. Which do you prefer? Recommended: ask the maintainer to add the link to the mockup through the mockup-review workflow.
- **Blocking:** Retire `app-model-description-dialog` entirely, or keep it as the fallback when a model article is still pending? Recommended: retire it, and have the model card open the family page when the model article is pending.
- `app-model-builder-view.ts:892` treats every `ContentLoadError` with code `NOT_FOUND` as a missing model description, including a fragment 503. When Model Description moves to Help, use `loadHelpEntry`'s `NOT_LISTED` to tell a pending article from a failed load, and keep the error alert for failures (comprehensive-help-documentation _§3_, _§5_).
