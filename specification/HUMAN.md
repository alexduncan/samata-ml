# Human tasks

**Updated:** 2026-11-20

This is the human's work queue: decisions, plan review, missing content and mockup styling. Detail lives in the linked plan/spec. TODO IDs refer to [TODO.md](TODO.md); Known gaps refer to [the index](README.md#known-gaps).

## How this file is maintained

- Add one item whenever work leaves a human decision, review, escalation, unclaimed note or draft to style. Remove resolved/ticked items; never re-ask an answered question.
- Format: `- [ ] **Short title (TODO-nn or plan slug):** What to decide/do. Blocks plan/task, or Non-blocking. Recommended: proposed answer. → [detail](relative-path#heading-anchor)`.
- Use relative paths and existing heading anchors; refresh Updated on change. Under the current workflow the human approves ready plans. The proposed four-skill workflow changes ownership/approval only when implemented.
- Planning records accepted answers in the plan and its future specification-sync list. Do not promote product specs or claim implementation while only plans changed.

## Suggested order

1. Review the revised workflow bootstrap plan. The grouped Step 1–3 defaults and text-entry fallback are now accepted.
2. Bootstrap workflow-gates under renewed current-workflow approval, then submit review-complete drafts using its new tools. No agent may fabricate a reviewer/approval stamp.
3. Execute foundations before dependent UI tasks: state-navigation; virtual table/reference helpers; Step 1; Step 2; Step 3. Tasks name exact prerequisites.
4. Commission the upstream `web-ml` changes (WR ledger), then review the classification phase plans 1–7 in order. Draft styling is non-blocking.

## 1. Workflow and plan review

- [ ] **Commission remaining upstream `web-ml` work for Phases 4–7.** Phase 3 verified fixed-parameter CV, fold-fitted preprocessing (WR-7) and stratified holdout (WR-10) against the built upstream revision cited in the plan. Use the ledger for the remaining evaluation, diagnostics and tuning requirements. → [Phase 3 upstream evidence](plans/web-ml-phase-3-model-training.md#codebase-context) · [WR ledger](plans/web-ml-classification-integration.md#scope)
- [ ] **Hand off the public partition feasibility request to the `web-ml` planner.** Phase 3 retains the app’s fold limits and reopens Section 4 with the reason if web-ml rejects the partition. Adopt the public check when it ships. Non-blocking for Phase 3. → [Phase 2 decision](plans/archive/web-ml-phase-2-training-setup.md#technical-decisions) · [request](../../web-ml/specification/requests/2026-11-20-stratified-partition-feasibility.md)
- [ ] **Expand three stubs split from Phase 2 (router-help-history-and-dynamic-topics, scroll-region-restoration, model-metadata-guards):** Run `/create-plan` on each. The router stub asks whether Help topics should become dynamic. Non-blocking for Phase 2, which records a §8 exception for the fold-matrix offset until the scroll stub lands. Recommended: metadata guards first (crash on corrupt local data), then router history, then scroll. → [router](plans/router-help-history-and-dynamic-topics.md#risks-and-open-questions) · [scroll](plans/scroll-region-restoration.md) · [metadata](plans/model-metadata-guards.md)
- [ ] **V1 release checks (web-ml-phase-1-configure-model):** Before the V1 release, fix or re-baseline the 9 failing `tests/visual-parity.e2e.ts` tests (PARITY/SIDE-AC-11; they also fail on unmodified `main`). The corresponding shell assertion `PH-AC-2` has the same inherited main padding mismatch in Chromium, Firefox and WebKit. Also run the Configure Model screen-reader checks: VoiceOver with Safari reads each range pair's label, value and help and the three `Edit …` button names; NVDA or Orca equivalent. Non-blocking for Phase 1 closure (deferred by you on 2026-11-19). Recommended: fold into the existing final keyboard/VoiceOver evidence item below. → [plan](plans/archive/web-ml-phase-1-configure-model.md#verification-and-definition-of-done)
- [ ] **Restyle `.form-note` (web-ml-phase-1-configure-model D12, `MODELS-UI-04`):** Commit `e5e50b2` removed `.form-note` from `mockups/ui-scaffold/css/hyperparameters.css`, but the 03-4 draft's multiclass and fixed-option notes still need it. Phase 1 keeps the last committed rule (`color: var(--neutral-600); font-size: 0.875rem`) as a recorded deviation. Non-blocking. Recommended: add a `.form-note` rule (or name its replacement) when you style the 03-4 draft. → [decision](plans/archive/web-ml-phase-1-configure-model.md#technical-decisions)
- [ ] **Confirm display transforms stay in `samata-ml` (web-ml-phase-6-model-specific-results D3):** Odds ratios, weight of evidence, Fisher separability, neighbour consensus and parameter counts are closed-form re-expressions of public `web-ml` outputs, computed in `samata-ml`. Non-blocking. Recommended: keep them here; move any to WR-12 if other `web-ml` consumers need them. → [decision](plans/web-ml-phase-6-model-specific-results.md#technical-decisions)
- [ ] **Review chart tokens (web-ml-phase-4-single-model-results D7, web-ml-phase-7-hyperparameter-tuning D11):** Nine categorical/axis tokens and five sequential tokens alias existing palette colours; the human owns colour. Non-blocking. Recommended: accept the aliases, restyle when charts are promoted. → [decision](plans/web-ml-phase-4-single-model-results.md#technical-decisions)

Seven active plans were reviewed on 2026-11-13. All retain valid `draft` metadata: the current validator does not support `ready-for-review`. The two formerly ready plans had substantive corrections, so their previous approvals remain history only. Product answers already given remain accepted.

The Storybook and shell plan was archived manually on 2026-11-19 (it predates the current workflow). T1–T8 and the specification sync are built and automatically verified. Its unperformed manual checks, open audit findings and stale spec text now live in a stub. → [archived plan](plans/archive/storybook-component-library.md) · [follow-up stub](plans/shell-verification-follow-ups.md)

Firefox verification on this workstation now passes with the isolated scratch-home env file named in the plan log; no browser dependency, project coverage or OS privacy permission changed. The earlier launch blocker is resolved for those recorded commands.

- [ ] **Extend component stories after shell delivery (storybook-component-library):** Commission a focused follow-up for existing data/target/virtual-table states, and align model setup with the installed workbench and feature placement when it is next revised. Non-blocking for the approved shell port; do not reopen implemented feature plans. Recommended: use the real components and shared styles, with their existing acceptance contracts. → [scope and risks](plans/archive/storybook-component-library.md#risks-and-open-questions)

- [ ] **Repair data and model contrast (storybook-component-library follow-up):** The 24 remaining targets span five owners: the remote dataset notice, datasheet subtitle, upload picker and help text, models comparison hint, and builder hints and inactive feature table. Ratios range from 2.61:1 to 4.10:1 against the 4.5:1 requirement. Phase 2 resolved the Section 4 finding and measured the Section 5 notice at 10.35:1. Non-blocking for Phase 2. → [exact targets, owners and measurements](../tests/a11y-feature-findings.ts)

- [ ] **Complete literal-colour guard coverage (Known gap 13):** TOK-2's existing scanner covers TypeScript declarations and var fallbacks, but not every direct CSS colour declaration. Current document styles were reviewed; this does not block the verified shell scope. Recommended: commission a focused guard improvement with negative CSS fixtures; retain the token-only rule throughout. → [verification limits](visual-design.md#6-verification)

- [ ] **Expand the shell follow-up stub (shell-verification-follow-ups):** Run `/create-plan` on the stub and answer its three blocking questions: whether closure needs the manual evidence, how to handle the step-3 height and two-tone background, and which focus offset to keep. Non-blocking for other plans. Recommended: closure on automated evidence, with the manual checks tracked in the next item. → [open questions](plans/shell-verification-follow-ups.md#risks-and-open-questions)

- [ ] **Final keyboard, VoiceOver and zoom evidence (shell-verification-follow-ups):** On the finished shell, check keyboard journeys in Chromium/Firefox, Safari/VoiceOver current-link/dialog/disabled-button names, real 200% browser zoom, 320px, RTL/long text, forced-colours focus and reduced motion. Automated browser/emulation checks pass. Manual observations remain unverified. The accepted T1 heading/dialog focus evidence stands. Browser emulation is not real zoom or assistive-technology evidence. → [scope](plans/shell-verification-follow-ups.md#scope)

- [ ] **Review reference regression suite (reference-dataset-regression-tests):** Review the refreshed implemented pipeline/protocol seams and corrected startup-database assumption. No product blockers. Recommended: approve after independent review; all ingestion prerequisites are implemented. → [plan](plans/reference-dataset-regression-tests.md#risks-and-open-questions)

The earlier request to refresh Steps 1–3, add journey stages and run online web guidance is complete. Guidance retrieval worked with the existing command permission; no global sandbox/network configuration change is required. The baseline is now 144 tests/22 files, not 52 or 105; workflow-gates D19 replaces the stale hard-coded rule. Broad permission-grant changes are not needed for this review.

## 2. Step 1–3 decisions

No unanswered product decisions remain in these three plans. The user accepted the Step 1–2 defaults, supervised Step 3 scope and plain text entries for missing artwork, and chose review-complete drafts under current tooling. Those answers are recorded in each plan's contract, risks and change log. Specification wording is updated during the plans' final sync tasks; the source TODOs must not be re-asked.

- [ ] **Review load/preview plan (step-1-load-data-and-preview):** Review the complete contract with accepted upload/progress/cancel/errors, transient safe datasheets and stored-stat panel. No product blockers; awaits plan review/approval, not another defaults decision. Recommended: review-complete draft for independent verification after workflow migration. → [plan](plans/archive/step-1-load-data-and-preview.md#risks-and-open-questions)

Already answered and incorporated: dataset-id/model-id identity convention; app prefix; compact card counts; wrapping title/text/stats; required model image; CSS capitalisation; Load Dataset copy; deferred repeated-card aria-describedby; i18n-only presentational exception; Change Dataset with confirmation/removal; confirm-and-discard; reopen/cancel training; latest-per-step scroll. Do not ask these again. Their plan sync tasks update the still-stale source questions after implementation.

## 3. Remaining draft-spec questions

- [ ] **Navigation overlays/routes (TODO-18, TODO-20):** Reconcile stale questions with the existing transient-dialog policy and implemented help/terms pages; promote only agreed sections, keeping unresolved behaviour explicit. Non-blocking for the scoped UI plans, which retain transient dialogs. Recommended: retain no dialog restoration on reload and the existing reserved-route mapping. → [navigation questions](app-state-and-navigation.md#12-open-questions), [content rules](content-and-i18n.md#static-content)
- [ ] **Upload identity (TODO-22):** Decide whether identical uploaded bytes preserve downstream work. Non-blocking; current behaviour uses a new ID per upload. Recommended: keep current identity until a separate content-hash plan defines it. → [storage questions](state-and-storage.md#11-open-questions)
- [ ] **Button questions (TODO-26):** Settle remaining disabled/hover/wrapping/pressed/touch/primary-button policy. Default-text contrast is resolved by A11Y-01. Non-blocking for plans reusing existing buttonStyles. Recommended: keep the existing approved text colour; Change Dataset needs no new danger variant. → [questions](components/button.md#12-open-questions-human-to-answer-agents-must-not-resolve)
- [ ] **Promote agreed draft specs:** After outstanding decisions are resolved, review statuses rather than treating all old draft questions as blockers. Non-blocking for explicitly settled plan contracts. → [status rules](README.md#status)

## 4. Missing later specifications and content

Configure Model and Training Setup are implemented. The remaining classification training and results work is specified in the [classification integration draft](plans/web-ml-classification-integration.md#interfaces-and-behaviour) and its phase plans. TODO-50 and TODO-51 remain on the integration plan for development delivery and the final specification sync.

- [ ] **Author remaining model articles (TODO-12):** Add locale content for models beyond Logistic Regression. Non-blocking: the Step 3 missing-description fallback is accepted. → [content layout](content-and-i18n.md#static-content)
- [ ] **Component documentation (TODO-34, TODO-35):** Shell, chiclet, dialog and page-header specs are delivered. Remaining transient-feature/notification/dropzone/table/stepper/status/progress specs need reconciliation. Non-blocking where reviewed plans provide closed contracts and explicit sync owners. → [template](COMPONENTS.md#12-component-spec-template)

The obsolete preview spec (TODO-48/Gap 16) is owned by Step 1 T7. The remaining sample-dataset note has been reviewed and claimed by that plan; no new commission is needed. Its sync task retains durable/deferred ideas, updates the inbox and deletes the note.

## 5. Follow-up plans

- [ ] **Further localisation (TODO-46):** Decide additional locales, switching/persistence and translation workflow. Non-blocking: Step 1's T1 covers only existing en configuration and UI instance. → [localisation](content-and-i18n.md#localisation-store)

## 6. Style or fix mockups

- [ ] **Style mockup review catalogue (serve-mockups-review-workflow):** Review and optionally style/promote the developer catalogue and preview controls. Non-blocking; native browser presentation is the implemented initial interface. Recommended: validate the file-review workflow first, then commission a visual port if useful. → [draft](mockups/ui-scaffold/drafts/00-3_mockup-review.html)
- [ ] **Verify mockup catalogue at 200% browser zoom (serve-mockups-review-workflow):** Check browser zoom manually; Playwright covered 320px reflow, keyboard focus and forced-colours, but native browser zoom was not verified. Non-blocking. Recommended: include it in the catalogue styling review. → [review guide](mockup-review.md#manual-checks)
- [ ] **Commission app integration after mockup promotion (serve-mockups-review-workflow):** Once a workflow draft is styled and promoted, ask the planning skill for a focused Lit port naming its selectors, states and destination. Non-blocking until promotion. Recommended: use the app-port checklist in the review guide. → [app port](mockup-review.md#commission-the-application-port)

- [ ] **Style generated model options (web-ml-classification-integration):** Style the proposed manual/tuning controls, structured inputs and loading/error/invalid states. Non-blocking. → [draft](mockups/ui-scaffold/drafts/03-4_train-models-3-configure-model.html)
- [ ] **Style Training Setup (web-ml-phase-2-training-setup):** Style the 03-5 strategy controls, matrix, summary and blocked state, then promote the draft. Non-blocking for Phase 2. → [03-5 draft](mockups/ui-scaffold/drafts/03-5_train-models-4-configure-training.html)
- [ ] **Style Section 5 training progress.** Once Phase 3 updates the draft, style the single native progress bar and expandable log, with pending, running, cancelling, other-tab, saved-but-unpublished and completed states, plus storage-recovery and pending-confirmation notices. Promote the styled mockup for a visual port. Non-blocking. → [draft](mockups/ui-scaffold/drafts/03-6_train-models-5-train.html)
- [ ] **Style single-model results (web-ml-phase-4/6/7):** Style the shared results sections and charts (Phase 4), model-internals sections (Phase 6) and the Tuning section (Phase 7) once each phase updates the draft. Non-blocking. → [draft](mockups/ui-scaffold/drafts/03-7_train-models-5-results.html)
- [ ] **Style comparison (web-ml-phase-5-model-comparison):** Style the `/results` comparison draft that Phase 5 T6 creates (controls, table lens, charts, blocked/incomparable states). Non-blocking. → [plan](plans/web-ml-phase-5-model-comparison.md#t6--connected-results-view-shell-wiring-draft-and-journeys)

Only the human changes normative mockups. Drafts are structure only and use existing styles; promote them when styled. Each is non-blocking for its scoped behaviour.

- [ ] **Style virtual table (virtual-table-component):** Style segmented preview/controls and loading/empty/error states; then promote and commission parity. Non-blocking. → [draft](mockups/ui-scaffold/drafts/01-6_virtual-table.html)
- [ ] **Style data states (step-1-load-data-and-preview):** Style progress/errors/import notices/histogram information and confirmation. Non-blocking. → [draft](mockups/ui-scaffold/drafts/01-7_data-states.html)
- [ ] **Style target additions (step-2-set-target):** Style Notes/current target/blocked/error/confirmation states. Non-blocking. → [draft](mockups/ui-scaffold/drafts/02-3_target-states.html)
- [ ] **Style models overview (step-3-train-models-overview-and-setup):** Style empty/blocked/loading/error/populated overview. Non-blocking. → [draft](mockups/ui-scaffold/drafts/03-0_models-overview.html)
- [ ] **Style model descriptions (step-3-train-models-overview-and-setup):** Style description/loading/missing/error states. Non-blocking. → [draft](mockups/ui-scaffold/drafts/03-8_model-description.html)
- [ ] **Style model text entries (step-3-train-models-overview-and-setup):** Style the accepted native text-entry chooser and its selected/loading/error/empty states. Non-blocking; artwork is not required to implement this fallback. → [draft](mockups/ui-scaffold/drafts/03-9_choose-model-text-entries.html)
- [ ] **Optional model illustrations (step-3-train-models-overview-and-setup):** Commission model-appropriate SVGs and a follow-up plan when illustrated cards should replace text entries. Non-blocking; do not delay current implementation. → [accepted contract](plans/archive/step-3-train-models-overview-and-setup.md#interfaces-and-behaviour)
- [ ] **Style content modal (static-content-pipeline):** Style compiled prose/error state and promote. Non-blocking. → [draft](mockups/ui-scaffold/drafts/00-2_content-modal.html)
      The normative later mockups remain empty/placeholders (TODO-36), but the four classification drafts above now supply structure for the proposed behaviour. Their promotion and styling remain human work.
- [ ] **Remove obsolete URL field (TODO-37):** Update 01-3; UI plans already exclude it. Non-blocking. → [mockup](mockups/ui-scaffold/01-3_upload-dataset.html)
- [ ] **Current-step links (TODO-38):** Replace mockup div with canonical link/aria-current pattern. Non-blocking; conformance owns application semantics. → [rule](app-state-and-navigation.md#44-sidebar-and-shortcuts)
- [ ] **Preview titles/panel (TODO-39):** Replace Pen titles in 01-4/01-5 and reconcile unsupported stddev with stored stats; 01-5 already supplies the panel. Non-blocking. → [panel mockup](mockups/ui-scaffold/01-5_preview-dataset-aside.html)

## 7. Other spec conflicts and process backlog

TODO-50/51 are answered and claimed by Phase 3: send isolation headers in production and development and consume precompiled `web-ml` assets. The verified library revision requires isolation. No native toolchain belongs here; no further decision is requested. TODO.md still lists both as open until that plan's final sync task.

- [ ] **Report web-ml public documentation conflicts (web-ml-classification-integration):** (1) is resolved upstream: both JSON documents now apply `learningRate` only under SGD, and the prose says Adam rejects any rate other than 0.001. (2) NB prior order and (3) the threshold positive label, plus `classWeight` key rules, are filed as `../web-ml/specification/requests/2026-11-19-class-label-keyed-option-semantics.md`. Still to raise: (4) `durationMs` start point differs between `timing.md` and the declarations; (5) `CombinedDatasetProvider` row order is undocumented. Non-blocking: the plan avoids every affected path. Recommended: file one upstream issue; once it is answered, a follow-up plan can unlock per-class prior entry and threshold editing. → [plan context](plans/web-ml-classification-integration.md#codebase-context)

- [ ] **Remaining Known gaps 3, 6, 7, 10:** Commission reconciliation of CSS inlining, worker/service-worker and lint/CI rules, and the product name. Gaps 1, 2, 4, 5, 17 and 18 are resolved. Gap 13 now names remaining exact feature contrast findings and broader feature coverage. Non-blocking for scoped plans with explicit decisions. → [gaps](README.md#known-gaps)
- [ ] **Close stale scaffolding process item (TODO-52):** Scaffolding plans are implemented; reconcile its old ready/draft wording during workflow spec sync. Non-blocking. → [TODO](TODO.md#7-process)

## 8. Later vision work

- [ ] **Commission plans for unclaimed UX note sections (user-experience-decisions, user-interface-principles):** Phases 4 and 7 claim §3–§6 and §8 of `user-experience-decisions.md`; §1 (defaults and reset), §2 (explanations), §7 (categorical encoding), §9 (stopping tolerance) and §10 (regularisation diagnostics) are unclaimed, as is the whole of `notes/user-interface-principles.md` (not yet committed). On 2026-11-19 you kept Phase 1 on the 03-4 draft design rather than folding these in. Non-blocking. Recommended: commit `user-interface-principles.md`, say whether it supersedes `user-experience-decisions.md`, then commission one plan for UI-HP-01–03, 08 and 09 (Section 3 refinements after Phase 1) and separate plans for §7 and §10, which need `web-ml` preprocessing and diagnostics. → [note](notes/user-experience-decisions.md)

- [ ] **Progressive disclosure (TODO-40):** Specify definitions/glossary/formulas. Non-blocking. → [vision](VISION.md#4-progressive-disclosure-and-plain-english-guidance)
- [ ] **Visualisations (TODO-41):** Chart library chosen (Observable Plot, Phase 4) and confusion/model-specific visuals planned (Phases 4–6); decision-boundary galleries remain open. Non-blocking. → [vision](VISION.md#5-appropriate-visualisations)
- [ ] **Further ethical samples (TODO-42):** Scope future catalogue additions; COMPAS/German Credit already exist, COMPAS remains remote. Non-blocking. → [samples](sample-datasets.md)
- [ ] **Threshold/fairness tools (TODO-43):** Specify group metrics/calibration/prompts. Non-blocking. → [vision](VISION.md#8-probabilistic-threshold-calibration-and-fairness-auditing)
- [ ] **Neural network choice (TODO-44):** Specify educational presentation/comparison. Non-blocking. → [vision](VISION.md#9-explainable-classical-models-contrasted-with-an-opaque-neural-network)
- [ ] **Performance/caching (TODO-45):** Define broader memory/bundle limits and service-worker update policy. Non-blocking. → [vision](VISION.md#12-privacy-responsiveness-and-open-source-longevity)

Deferred product work remains in [FUTURE.md](FUTURE.md). No broader host permissions were changed.
