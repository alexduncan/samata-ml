# Human tasks

**Updated:** 2026-11-14

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
4. Review the classification integration plan for later configuration, training and results. Draft styling is non-blocking.

## 1. Workflow and plan review

- [ ] **Review classification integration (web-ml-classification-integration):** Approve the saved contract for all eight classifiers, JSON-generated native controls/results, manual default plus advanced Random Search, stratified holdout with train-fitted preprocessing and explicit final refit, progress/cancellation, worker/WASM deployment and durable results. Blocks implementation. Recommended: adopt this initial scope; defer regression, nested CV, Hyperband, threshold tuning and interactive charts. The new classification-only request supersedes the earlier setup catalogue's regression scope at integration. → [plan](plans/web-ml-classification-integration.md#technical-decisions)

Seven active plans were reviewed on 2026-11-13. All retain valid `draft` metadata: the current validator does not support `ready-for-review`. The two formerly ready plans had substantive corrections, so their previous approvals remain history only. Product answers already given remain accepted.

- [ ] **Review renewed workflow bootstrap (agent-workflow-gates):** Approve the revised gate/closure/migration contract under the current workflow so its tooling can be implemented. Blocks workflow T1 and formal ready-for-review submission. Recommended: review the legacy Sync specification exclusion, escalation triage, dirty-tree preservation and stale-approval safeguards, then approve this revision. → [plan](plans/agent-workflow-gates.md#risks-and-open-questions)
- [ ] **Review table contract (virtual-table-component):** Review the settled presentational/text-cell API and segmented 10,000-row rail, reaching up to 10,000,000 preview rows without an enormous CSS spacer. Blocks implementation until approval; styling is non-blocking. Recommended: accept the contract; keep the useful component spec and replace its conflicting examples during sync. → [plan](plans/virtual-table-component.md#interfaces-and-behaviour)
- [ ] **Review Storybook and shell plan (storybook-component-library):** Approve the Storybook 10 stack, the Vite 7 pin for standard decorators, the naming, test-location and native-CSS standards, and the shell remediation it absorbs (Known gap 13). No blocking questions. Blocks all of its tasks; T1 also waits for conformance T8. Recommended: approve as written. → [plan](plans/storybook-component-library.md#technical-decisions)
- [ ] **Align draft UI plans with the new conventions (storybook-component-library):** Once that plan is approved, revise step-1, step-3 and virtual-table so that they:
    - add stories (Storybook is no longer deferred);
    - move `app-dataset-card` and `app-model-card` into their feature folders;
    - reuse `dialogStyles`, `.modal-header` and `.btn-icon`;
    - share one `src/i18n.ts`.

    Non-blocking until those plans start. Recommended: one planning pass over the three drafts after approval. → [risks](plans/storybook-component-library.md#risks-and-open-questions)

- [ ] **Review reference regression suite (reference-dataset-regression-tests):** Review the refreshed implemented pipeline/protocol seams and corrected startup-database assumption. No product blockers. Recommended: approve after independent review; all ingestion prerequisites are implemented. → [plan](plans/reference-dataset-regression-tests.md#risks-and-open-questions)

The earlier request to refresh Steps 1–3, add journey stages and run online web guidance is complete. Guidance retrieval worked with the existing command permission; no global sandbox/network configuration change is required. The baseline is now 144 tests/22 files, not 52 or 105; workflow-gates D19 replaces the stale hard-coded rule. Broad permission-grant changes are not needed for this review.

## 2. Step 1–3 decisions

No unanswered product decisions remain in these three plans. The user accepted the Step 1–2 defaults, supervised Step 3 scope and plain text entries for missing artwork, and chose review-complete drafts under current tooling. Those answers are recorded in each plan's contract, risks and change log. Specification wording is updated during the plans' final sync tasks; the source TODOs must not be re-asked.

- [ ] **Review load/preview plan (step-1-load-data-and-preview):** Review the complete contract with accepted upload/progress/cancel/errors, transient safe datasheets and stored-stat panel. No product blockers; awaits plan review/approval, not another defaults decision. Recommended: review-complete draft for independent verification after workflow migration. → [plan](plans/step-1-load-data-and-preview.md#risks-and-open-questions)
- [ ] **Review model setup plan (step-3-train-models-overview-and-setup):** Review accepted supervised scope, feature defaults, missing-description fallback and the exact Logistic Regression/native-text entry split. No product blockers; awaits plan review/approval. Recommended: review-complete draft for independent verification after migration. → [plan](plans/step-3-train-models-overview-and-setup.md#risks-and-open-questions)

Already answered and incorporated: dataset-id/model-id identity convention; app prefix; compact card counts; wrapping title/text/stats; required model image; CSS capitalisation; Load Dataset copy; deferred repeated-card aria-describedby; i18n-only presentational exception; Change Dataset with confirmation/removal; confirm-and-discard; reopen/cancel training; latest-per-step scroll. Do not ask these again. Their plan sync tasks update the still-stale source questions after implementation.

## 3. Remaining draft-spec questions

- [ ] **Navigation overlays/routes (TODO-18, TODO-20):** Reconcile stale questions with the existing transient-dialog policy and implemented help/terms pages; promote only agreed sections, keeping unresolved behaviour explicit. Non-blocking for the scoped UI plans, which retain transient dialogs. Recommended: retain no dialog restoration on reload and the existing reserved-route mapping. → [navigation questions](app-state-and-navigation.md#12-open-questions), [content rules](content-and-i18n.md#static-content)
- [ ] **Upload identity (TODO-22):** Decide whether identical uploaded bytes preserve downstream work. Non-blocking; current behaviour uses a new ID per upload. Recommended: keep current identity until a separate content-hash plan defines it. → [storage questions](state-and-storage.md#11-open-questions)
- [ ] **Button questions (TODO-26, TODO-27):** Settle remaining disabled/hover/wrapping/pressed/touch/primary-button policy and correct the stale contrast claim. Non-blocking for plans reusing existing buttonStyles. Recommended: keep the existing approved A11Y-01 text colour; Change Dataset needs no new danger variant. → [questions](components/button.md#12-open-questions-human-to-answer-agents-must-not-resolve)
- [ ] **Promote agreed draft specs:** After outstanding decisions are resolved, review statuses rather than treating all old draft questions as blockers. Non-blocking for explicitly settled plan contracts. → [status rules](README.md#status)

## 4. Missing later specifications and content

The classification subsets of TODO-01–05, TODO-21 and TODO-33 are now designed in the [classification integration draft](plans/web-ml-classification-integration.md#interfaces-and-behaviour), awaiting the review item above. Its final sync task replaces the orchestrator stub and updates the workflow/storage specs after implementation. This is a proposed contract, not completed product work. The existing production COOP/COEP and compiled-library answers (TODO-50/51) are incorporated; development delivery is owned by its T1.

- [ ] **Author remaining model articles (TODO-12):** Add locale content for models beyond Logistic Regression. Non-blocking: the Step 3 missing-description fallback is accepted. → [content layout](content-and-i18n.md#static-content)
- [ ] **Component documentation (TODO-34, TODO-35):** Remaining shell/notification/dropzone/table/stepper/status/progress component specs need reconciliation. Non-blocking where these reviewed plans provide closed contracts and explicit sync owners; later components still need a specification. → [template](COMPONENTS.md#12-component-spec-template)

The obsolete preview spec (TODO-48/Gap 16) is owned by Step 1 T7. The remaining sample-dataset note has been reviewed and claimed by that plan; no new commission is needed. Its sync task retains durable/deferred ideas, updates the inbox and deletes the note.

## 5. Follow-up plans

- [ ] **Further localisation (TODO-46):** Decide additional locales, switching/persistence and translation workflow. Non-blocking: Step 1's T1 covers only existing en configuration and UI instance. → [localisation](content-and-i18n.md#localisation-store)

## 6. Style or fix mockups

- [ ] **Style mockup review catalogue (serve-mockups-review-workflow):** Review and optionally style/promote the developer catalogue and preview controls. Non-blocking; native browser presentation is the implemented initial interface. Recommended: validate the file-review workflow first, then commission a visual port if useful. → [draft](mockups/ui-scaffold/drafts/00-3_mockup-review.html)
- [ ] **Verify mockup catalogue at 200% browser zoom (serve-mockups-review-workflow):** Check browser zoom manually; Playwright covered 320px reflow, keyboard focus and forced-colours, but native browser zoom was not verified. Non-blocking. Recommended: include it in the catalogue styling review. → [review guide](mockup-review.md#manual-checks)
- [ ] **Commission app integration after mockup promotion (serve-mockups-review-workflow):** Once a workflow draft is styled and promoted, ask the planning skill for a focused Lit port naming its selectors, states and destination. Non-blocking until promotion. Recommended: use the app-port checklist in the review guide. → [app port](mockup-review.md#commission-the-application-port)

- [ ] **Style generated model options (web-ml-classification-integration):** Style the proposed manual/tuning controls, structured inputs and loading/error/invalid states. Non-blocking. → [draft](mockups/ui-scaffold/drafts/03-4_train-models-3-configure-model.html)
- [ ] **Style holdout setup (web-ml-classification-integration):** Style split/preprocessing controls, summary and blocked/browser/other-tab states. Non-blocking. → [draft](mockups/ui-scaffold/drafts/03-5_train-models-4-configure-training.html)
- [ ] **Style training progress (web-ml-classification-integration):** Style phase-labelled native progress and queued/search/refit/evaluation/save/cancel/error/completion states. Non-blocking. → [draft](mockups/ui-scaffold/drafts/03-6_train-models-5-train.html)
- [ ] **Style classification results and comparison (web-ml-classification-integration):** Style common scores, confusion/diagnostic/history/trial tables, comparison and unavailable/empty/error states. Non-blocking. → [draft](mockups/ui-scaffold/drafts/03-7_train-models-5-results.html)

Only the human changes normative mockups. Drafts are structure only and use existing styles; promote them when styled. Each is non-blocking for its scoped behaviour.

- [ ] **Style virtual table (virtual-table-component):** Style segmented preview/controls and loading/empty/error states; then promote and commission parity. Non-blocking. → [draft](mockups/ui-scaffold/drafts/01-6_virtual-table.html)
- [ ] **Style data states (step-1-load-data-and-preview):** Style progress/errors/import notices/histogram information and confirmation. Non-blocking. → [draft](mockups/ui-scaffold/drafts/01-7_data-states.html)
- [ ] **Style target additions (step-2-set-target):** Style Notes/current target/blocked/error/confirmation states. Non-blocking. → [draft](mockups/ui-scaffold/drafts/02-3_target-states.html)
- [ ] **Style models overview (step-3-train-models-overview-and-setup):** Style empty/blocked/loading/error/populated overview. Non-blocking. → [draft](mockups/ui-scaffold/drafts/03-0_models-overview.html)
- [ ] **Style model descriptions (step-3-train-models-overview-and-setup):** Style description/loading/missing/error states. Non-blocking. → [draft](mockups/ui-scaffold/drafts/03-8_model-description.html)
- [ ] **Style model text entries (step-3-train-models-overview-and-setup):** Style the accepted native text-entry chooser and its selected/loading/error/empty states. Non-blocking; artwork is not required to implement this fallback. → [draft](mockups/ui-scaffold/drafts/03-9_choose-model-text-entries.html)
- [ ] **Optional model illustrations (step-3-train-models-overview-and-setup):** Commission model-appropriate SVGs and a follow-up plan when illustrated cards should replace text entries. Non-blocking; do not delay current implementation. → [accepted contract](plans/step-3-train-models-overview-and-setup.md#interfaces-and-behaviour)
- [ ] **Shell design calls (storybook-component-library):** These choices are not in the mockups:
    - below 50rem the sidebar stacks above the content, for 320px width and 200% zoom;
    - the welcome tagline becomes a paragraph (proposed SEM-12);
    - the `aria-label` that overrode "Get Started" is removed (proposed SEM-13);
    - the project-settings button and the sidebar's next-step dot are not built, because no behaviour spec defines them.

    Non-blocking. Recommended: accept, then restyle through the mockups if wanted. → [decisions](plans/storybook-component-library.md#technical-decisions)

- [ ] **Style content modal (static-content-pipeline):** Style compiled prose/error state and promote. Non-blocking. → [draft](mockups/ui-scaffold/drafts/00-2_content-modal.html)
      The normative later mockups remain empty/placeholders (TODO-36), but the four classification drafts above now supply structure for the proposed behaviour. Their promotion and styling remain human work.
- [ ] **Remove obsolete URL field (TODO-37):** Update 01-3; UI plans already exclude it. Non-blocking. → [mockup](mockups/ui-scaffold/01-3_upload-dataset.html)
- [ ] **Current-step links (TODO-38):** Replace mockup div with canonical link/aria-current pattern. Non-blocking; conformance owns application semantics. → [rule](app-state-and-navigation.md#44-sidebar-and-shortcuts)
- [ ] **Preview titles/panel (TODO-39):** Replace Pen titles in 01-4/01-5 and reconcile unsupported stddev with stored stats; 01-5 already supplies the panel. Non-blocking. → [panel mockup](mockups/ui-scaffold/01-5_preview-dataset-aside.html)

## 7. Other spec conflicts and process backlog

TODO-50/51 are answered and claimed by the classification integration plan: preserve production isolation, supply it in development, and consume precompiled `web-ml` assets. No native toolchain belongs here; no further decision is requested.

- [ ] **Remaining Known gaps 3, 6, 7, 10:** Commission reconciliation of CSS inlining, worker/service-worker and lint/CI rules, and the product name. Gap 4 is resolved; gap 18 is owned by conformance; gaps 1, 2, 5, 13 and 17 are owned by storybook-component-library. Non-blocking for scoped plans with explicit decisions. → [gaps](README.md#known-gaps)
- [ ] **Close stale scaffolding process item (TODO-52):** Scaffolding plans are implemented; reconcile its old ready/draft wording during workflow spec sync. Non-blocking. → [TODO](TODO.md#7-process)

## 8. Later vision work

- [ ] **Progressive disclosure (TODO-40):** Specify definitions/glossary/formulas. Non-blocking. → [vision](VISION.md#4-progressive-disclosure-and-plain-english-guidance)
- [ ] **Visualisations (TODO-41):** Specify decision-boundary/confusion-matrix tools and chart library. Non-blocking. → [vision](VISION.md#5-appropriate-visualisations)
- [ ] **Further ethical samples (TODO-42):** Scope future catalogue additions; COMPAS/German Credit already exist, COMPAS remains remote. Non-blocking. → [samples](sample-datasets.md)
- [ ] **Threshold/fairness tools (TODO-43):** Specify group metrics/calibration/prompts. Non-blocking. → [vision](VISION.md#8-probabilistic-threshold-calibration-and-fairness-auditing)
- [ ] **Neural network choice (TODO-44):** Specify educational presentation/comparison. Non-blocking. → [vision](VISION.md#9-explainable-classical-models-contrasted-with-an-opaque-neural-network)
- [ ] **Performance/caching (TODO-45):** Define broader memory/bundle limits and service-worker update policy. Non-blocking. → [vision](VISION.md#12-privacy-responsiveness-and-open-source-longevity)

Deferred product work remains in [FUTURE.md](FUTURE.md). No broader host permissions were changed.
