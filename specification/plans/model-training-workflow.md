# Give new model training its own workflow

**Status:** ready-for-review | **Updated:** 2026-11-25T13:54:50Z
**Authors:** Codex (GPT-6) | **Created:** 2026-11-25T13:48:28Z
**Verified by:** — | **Verified:** — | **Verification:** pending
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour:** Starting a model allocates a numbered draft and opens `/models/{num}`. Card selection waits for a second Continue action. The same route and generic Model {num} heading cover configuration, training and results. The sidebar lists numbered drafts and trained models. The training panel already has a native progress bar, run log and protected recovery. Configure Model and Training Setup have fixed Help routes.

**Target behaviour:** New training uses `/models/new`, with an explicit confirmation before leaving unfinished work and Help available over the current wizard. Committing each step collapses it, updates its summary and opens the next step. Progress and results follow the updated mockups. Trained models have a numbered swatch, label and feature count in the sidebar, plus a matching results identity. Steps 2–4 each have contextual Help.

**Why:** Give learners a clear distinction between configuring a model, watching it train and examining its results. Keep the learner in charge of ordinary workflow navigation.

## Scope

**In scope**

- The new route, app-owned provisional draft and result handoff, abandonment confirmation, all-models navigation and companion Dot integration hooks.
- Step 1–5 transition and completion UI, updated Section 5 visual states, saved-model result header and training details, training swatches, and contextual Help.
- App-owned presentation metadata and compatibility with saved projects, numbered bookmarks and open tabs.

**Out of scope**

- The Dot's rendering and burst, custom model naming/colour controls, tuning, comparison redesign, new metrics, Delete Model, dedicated Accuracy Help or changes to the installed training library.
- Dynamic Help routing, general scroll-restoration work and unrelated parts of General Fixes.

**Constraints and invariants**

- Keep app and reserved routes native links. Preserve existing training, evaluation and worker protocols, cross-origin isolation, CSP and local-only data handling.
- Preserve durable saves, cancellation, failure recovery, and the exact run identity. Reuse the model number assigned by protected allocation through the whole run.
- Preserve keyboard access, visible focus, localised names and progress, RTL and reduced motion. The model number and name identify the run across colour modes.
- Use existing shared styles and root tokens. The maintainer commissioned the scoped port of the updated 03-6 progress and 03-7 results drafts. Record the exact scoped visual departures in the design register and leave the mockup files to the maintainer.

## Required reading

- `AGENTS.md` § Repository boundary, Verification Commands and Rules.
- `specification/COMPONENTS.md` §§3–10, and `specification/components/{sidebar,training-progress,model-results,model-configuration,training-setup,content-modal}.md` for closed APIs, accessibility and stories.
- `specification/workflow-steps.md` §3, `specification/app-state-and-navigation.md` §§4–8, `specification/state-and-storage.md` model records and protected writes, `specification/machine-learning-orchestrator.md` the durable finish, and `specification/content-and-i18n.md` § Static Content.
- `specification/visual-design.md` §§1, 3 and 5, the specific 03-2 through 03-7 mockups and their style modules listed below.
- `specification/plans/workflow-next-step-dot.md` § Interfaces and behaviour, and `specification/plans/router-help-history-and-dynamic-topics.md` for the reserved-route overlap.

## Codebase context

- **Relevant specifications:** `workflow-steps.md` §3 sets learner behaviour. The acknowledged training state, modal rules and scroll ownership live in `app-state-and-navigation.md` §§5–8 and `machine-learning-orchestrator.md`. There is no upstream dependency because training requests, evaluation computation and metrics stay outside the change.
- **Relevant implementation:** `src/router/{route-parser,router,scroll-restorer,reserved-content}.ts`, `src/types/routes.ts:19–35` and `src/app.ts:91–128,208–244` own history, route mounting and focus. `src/features/models/training/training-service.ts:590–619,959–1137`, `src/stores/app.store.ts:309–334,734–769` and `src/stores/persister.ts:954–995` own protected model/run lifecycle. `src/common/storage/training-domain.ts:233–416,487–585` owns decoding and transactional writes.
- **Relevant implementation:** `src/features/models/app-model-builder-view.ts:279–319,678–758,1133–1148,1265–1376,1484–1519,1724–1979` owns active steps, route-key checks, existing saves, headings and training actions. The sidebar projects `$appState` and `$route` in `src/stores/sidebar.store.ts`. `src/features/models/app-training-progress.ts:75–86,115–145` owns the native progress and log.
- **Tests and commands:** `tests/router-and-navigation.test.ts`, `tests/app-shell.e2e.ts`, `tests/training-domain.test.ts`, `tests/training-service.test.ts`, `tests/models-setup.e2e.ts`, `tests/training-panels.e2e.ts`, `tests/model-results.e2e.ts`, `tests/sidebar-acceptance.e2e.ts`, `tests/build-content.test.ts` and the Iris classification journey cover the changed entry points. Start from the commands and fixtures named in each task. On main `6870d75`, `bun run check` passed typechecking and all 643 tests with local loopback permission.
- **Web guidance:** `animate-to-intrinsic-sizes` identifies limited support for keyword interpolation. Use measured start/end values, non-focusable outgoing content and a CSS transition that works in all three supported engines. `motion` requires an instant final state when motion is suppressed and discourages indefinite animation. `dialog` supplies a native modal with initial focus on the safe action. [HTML session history standard](https://html.spec.whatwg.org/multipage/nav-history-apis.html) describes traversal and `popstate` timing.
- **Visual reference:** 03-2 chooses a model, 03-3 shows the completed model row and next step, 03-4/03-5 show header Help. 03-6 maps `.train-step-header`, `.progress`, `.progress-bar`, `.log` and state templates. 03-7 maps `.model-results`, `.training-summary` and the sidebar trained row. Use `specification/mockups/css/{steps,progress,log,swatches}.css` for geometry and colours. Update SHELL-UI-03 and record model wizard/progress/result deviations under the visual design register.
- **Domain skills:** `lit-component-implementer` for the route confirmation, model views, sidebar, wizard, Help and progress UI. Reuse the existing custom elements and add co-located stories for changed blocks.
- **Assumptions requiring verification:** Browser tests verify same-shadow-root SVG `<use href="#check">` paint, history replay and the strict built CSP. Review the reserved Help history stub before changing owner metadata.

## Technical decisions

| Decision            | Chosen approach and rationale                                                                                                                                                                                                                                      | Rejected alternative / trade-off                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Draft identity      | Reserve one provisional model for the current dataset/target epoch using the existing protected allocator. Bind each new-wizard history entry to that model's immutable identity as soon as allocation is acknowledged. Preserve existing historic numeric drafts. | Guessing a model number from the list can bind to another tab's draft and break run/focus identity.                                                 |
| Routing and modal   | Extend the existing History API router, effective Help underlay and scroll/focus coordinator. Guard in-app departures from unfinished new work with the native confirmation.                                                                                       | A custom router or modal would duplicate history, focus and reserved Help behaviour.                                                                |
| Presentation fields | Add optional local saved-result `modelLabel`; mirror it to the sidebar model projection in the same protected publish. Persist the palette assignment on the model.                                                                                                | Reading every result to render the sidebar adds IndexedDB work per link. Sending presentation fields through the worker couples them to evaluation. |
| Help and motion     | Reuse closed reserved routing and one Help link CSSResult. Acknowledge each saved step before its visual transition and advance without motion where preferred.                                                                                                    | Animating an unacknowledged step or an unknown actual height can misrepresent the learner's saved progress.                                         |

### Interfaces and behaviour

The connected `app-model-builder-view` keeps its existing `modelNum: number = 0` / `model-num` input and `focusHeading(signal): Promise<void>` and `whenSettled(): Promise<void>` methods. It exposes no new slots, events, methods, parts or custom properties. `app-sidebar` remains a tag-only connected component. The `app-model-card` keeps its direct `app-model-select` event with `{modelId, name}`. The presentational `app-training-progress` only adds the unreflected variant in T6 and keeps its direct, non-bubbling and non-composed `app-training-log-toggle` with `{readonly open: boolean}`. The two style primitives export only their Lit CSSResults, `helpLinkStyles` and `modelSwatchStyles`. New strings belong to the connected owning view's existing i18n namespace.

**Model identity and persistence**

- Add optional `newModelNum: number | null` and `nextModelColorIndex: number` to the app-owned persisted state and protected snapshot. Normalise absence to null and zero before conditional legacy palette initialisation. Carry both through bootstrap, decoding, protected publish, retry and context reset. A missing or mismatched provisional model clears a stale pointer. Dataset/target identity includes `comparisonContextEpoch`. The existing model number sequence continues after an abandonment. All wire additions are optional, with deterministic absence defaults.
- Add optional `modelLabel: string | null` to the app-owned saved evaluation data in `ResultEnvelopeV2` and to `ModelRecord`, and `modelColor?: ModelColor` to `ModelRecord`. `ModelColor` is the finite token suffix union in palette order: amber, blue, teal, purple, red, green, pink, sky, olive, neutral. Treat an absent, invalid or blank label as the catalogue model name. Keep localisation of the feature count, protocol, headings and actions. The saved evaluation owns the label; the model record mirrors it. New writes initialise null. When reading old records, absent presentation fields preserve the existing valid result and fall back to the model name.
- Assign a colour at the first successful protected finish, in commit order within the current dataset/target epoch, then increment the independent cursor. Wrap modulo ten and retain the chosen colour on retries and reloads. For legacy records with no colour, render the deterministic initial palette positions in ascending model number order, starting at the decoded palette cursor. Under the first protected finish with such records, persist those same positions and advance the cursor before assigning the new result. Treat malformed colour values as missing. Resolve a saved palette cursor before any new finish in another tab. Reconciler demotion of a lost result does not rewind the cursor. Include presentation fields in the storage decoders and protected merge, never in the worker payload, training configuration key, result identity or partition hash. Keep IndexedDB and protected journal versions.
- Use the mockup fills with root tokens for pink, sky and olive added from the supplied palette. Use existing contrasting light/dark text tokens for the printed numbers, including dark on amber and sky. Use the number and name independently of the swatch hue; in forced colours allow system colours. Test regular and large versions and both directions.

**Router and new-wizard ownership**

- Add `/models/new` as an explicit `kind: "workflow"` route at Step 3. Extend `WorkflowPath` and distinguish it from a numeric route by its literal path. `/models` retains the overview, and `/models/{num}` accepts existing trained records and legacy numeric drafts. Keep `/results` unchanged. Every start-new action, including the overview and sidebar, links to `/models/new`. Apply existing dataset, target, metadata and recoverable save guards. A blocked entry shows the appropriate prerequisite link and does not allocate.
- Only entry to the new wizard requests allocation. Use a guarded `openNewModel` service action that validates the captured context and returns the currently bound provisional identity or creates one under the protected state lock. Pending/failure uses the existing publish/retry contract. Duplicate activations, fresh concurrent tabs and reload reuse the same acknowledged provisional record. A visited history entry carries the exact model identity and context, including while a reserved dialog is open. Stale entries whose bound record was abandoned or reset render a recovery link to the Models overview without allocating; a fresh activation can start a new draft. A cross-tab success cannot cause the mounted view or a restored history entry to allocate another model.
- Resolve the internal number independently of the URL. Use the resolved identity for builder property, scroll memory, durable submit/retry and reserved underlay. Once bound, `/models/new` and the reserved underlay keep the same numeric scroll key, and no provisional numeric bookmark is marketed as a public destination. Preserve legacy numeric bookmarks and restore logic. Existing trained links and numeric deep links load saved results. Restricted operations stay disabled while covered by Help.
- Protect same-document link clicks, router actions and Back/Forward departures when the current provisional model is unfinished. Help/About/Privacy opens, topic switches and closes preserve the underlying draft. Reuse the native `<dialog>` and shared `dialogStyles` confirmation patterns with safe focus, explicit Stay/Leave controls, and status or error feedback while a protected decision is pending. Defer focus, route store and scroll changes until the navigation is accepted. Router owns the pending intent and all History API operations. The existing connected builder owns the dialog and invokes protected abandonment. Use a source-entry ID and monotonically increasing intent token so stale async effects cannot approve a later request.
- Extend `HistoryEntryState` with optional stack identity, entry index and bound provisional identity fields. Continue reading v1 entries with absent fields. Guard reversible app-owned same-document traversals by the stack and source identity. Push increments the current position, replace retains it and any bound identity unless deliberately switching model. When a pre-confirmation `popstate` targets another workflow, restore the recorded source entry by delta without rendering or writing over the destination. Present confirmation once source is restored. Stay retains the original entry, scroll and focus. Leave replays the recorded destination once after the operation succeeds. Coalesce extra navigation while the dialog or a guarded mutation is in flight. Browser reload, cross-document navigation and tab close use browser behaviour and preserve committed work.
- When training is durably saved, keep the completed Step 5 at `/models/new` and enable **View Results**. Clear the workspace's provisional pointer in the successful finish checkpoint so a new explicit visit can start another model. Keep the original visit bound to that saved run, including on refresh or under Help. **View Results** revalidates and acknowledges that exact run through the existing protected action, then replaces the current history entry with `/models/{num}`. It does not add another Back stop. If saved completion occurs under Help, leave Help and its underlying provisional entry in place until the learner closes it and uses View Results. If the learner visits elsewhere after saving, preserve the result and skip abandonment. A trained numbered deep link displays the result directly through the existing saved-result resource without requiring a return to `/models/new`.
- Confirmed departure before success requests local cancellation and waits for it to settle. Under the existing lock order (ingestion shared, model exclusive, protected state write), revalidate the provisional binding and context. Remove only the matching unfinished draft and clear its pointer in one guarded checkpoint, without reusing its number. Clear its keyed scroll/UI data after acknowledgement. If a save wins the race, keep the result and release the intended departure. If another tab owns the attempt, or acknowledgement is unavailable, stay at the source and explain the conflict or offer the existing retry action. Pending and repeated confirmations must not delete twice or discard another model. Never remove a trained evaluation as part of abandonment.

**Model navigation and results**

- Step 3 keeps the existing four-item workflow list. Render a compact **All Trained Models** native anchor to `/models`, and a sibling keyed models list. Before any success expose **Train New Model** as `a.step-train-new`; after success render **Train Another Model** below the trained rows as `a.step-model-link`. Both target `/models/new` and appear once dataset and target prerequisites are present. When that route is current, show a static **Training New Model…** row with `aria-current="page"` for the actual current workflow page. Reserved overlays retain the row but own current-link semantics. Keep `aria-current="true"` for the Step 3 overview parent on descendant pages. Ordinary trained links use exact `aria-current="page"`. No nested links or artificial tab stops. Legacy drafts stay available through overview Continue.
- Each trained sidebar link uses `.step-trained-model`, a number swatch, the model label or catalogue name and a `.chiclet` with localised singular/plural feature count from saved feature configuration. Leave cue behaviour to the companion plan. Preserve the companion plan's stable train links and `/models/new` versus numbered route detection.
- The numbered results page removes the wizard around the existing results view and uses a single route-owned `h1.model-results`: a large numbered swatch followed by **{modelLabel or catalogue model name} Results**. Add the Training Details disclosure before the existing results. List the model, saved target, selected feature names/count, evaluation strategy and the training and held-out row counts the saved run supplies. Use saved metadata or existing results view models; render a historical omission as unavailable. For One-Shot use the saved partition counts. For Cross-Validation display the saved per-fold training counts and the pooled held-out sample count. The training folds overlap. Keep the established shared results, preferences, recovery messages and chart semantics. A legacy numbered draft keeps the wizard heading until its result is available.

**Wizard transitions, progress and Help**

- Card **Select Model** commits the selected model and existing default-feature setup in the same action used by the current Choose continuation. Remove the redundant second Continue for Step 1. Acknowledge each completion before advancing. Slide the old `.train-step-content` closed with a CSS transition on measured `block-size`. Then set exactly one `.step-active` and `aria-current="step"` on the next wizard step, render its content and slide it open. Step 1 heading becomes `1. {ModelName}`; subsequent completed summaries use feature count, Model Configured and training strategy from 03-6. Completed headers render the translated Completed text, check and Edit when the existing edit rules allow; completed step bodies reopen through Edit. Use one `<symbol id="check">` template in the builder's shadow root using the supplied circled path, and replace the five matching SVG call sites with `<svg class="icon" aria-hidden="true"><use href="#check" /></svg>`.
- Keep sequencing private to the connected builder. Close around the departing content before changing the displayed active step. The newly active heading receives focus after opening with existing scroll ownership. While closing, move focus to a stable heading outside content made inert, then hide the collapsed body. Coalesce duplicate transitions and settle to the actual acknowledged step if interrupted by a route change, disconnection or reduced-motion preference change. Keep the existing edit invalidation confirmation and preserve dirty/invalid state on a failed save. Under reduced motion update and focus without scheduling animation. No transition is required on hydration, route recovery or the final results handoff.
- Keep one labelled native `<progress>` per visible training state and one stable live milestone announcer, with the existing ordered `<details>` log and its saved preference. Templates in 03-6 are alternatives. Show no value while progress is unknown. Use actual percent through 99 while active and 100 only after durable acknowledgement. Show the percentage visually once and expose it through the native progress semantics. Use static active stripes and text-labelled progress state, and green for completed progress. Reserve header controls for cancellation and View Results states; keep the current disabled or recovery controls for saving, other-tab, cancelling and publication pending. Reuse `.progress`, `.progress-bar`, `.progress-percent`, `.log`, `.log-status` and `.log-history`. Preserve elapsed values from the existing clock, ordered log and recovery notices. After a matched failure or cancellation, remain in Step 5 and show **Training Stopped**, the applicable message and the last known partial percent in red when the session has one. Omit the bar when the run never reported a proportion. **Train Model** retries the same saved setup with a new attempt identity. **Edit Training Setup** returns to the existing editable Step 4 and its validation. A fresh reload without an in-memory terminal attempt restores the last saved editable setup and any existing interrupted-run recovery. It does not fabricate a stopped percentage. A blocked or failed retry stays in the recovery state with its error. Closing or reopening Help preserves a live stopped state.
- Step 2 **What are features?** opens `/help/select-features` and defines features, target distinction, useful signals and leakage in plain English with a simple dataset example. Step 3 **What do these settings mean?** retains `/help/configure-model` and its existing explanations. Step 4 **What is this?** links the header to `/help/training-setup`; retain the existing form link and ensure the article includes a plain-English One-Shot/Cross-Validation benefits and drawbacks table. Render each heading's `.help-link` anchor inside its labelled `h2`. Share the requested style via a Lit CSSResult, using `margin-inline-start: 0.5rem`, the other supplied dimensions and blue tokens, and a visible focus outline. Escape, Close and Back return to the originating trigger without losing unsaved form input.

## Specification changes

- [ ] `specification/workflow-steps.md` §3 and `specification/app-state-and-navigation.md` §§4–8 — establish new and numeric routes, learner intent, guard and reserved underlay, step transitions, training progress and results. Statuses stay partial and draft respectively.
- [ ] `specification/state-and-storage.md` protected state and `specification/machine-learning-orchestrator.md` finish/recovery — document optional presentation metadata, protected identity and discard, status/verification and historical compatibility.
- [ ] `specification/components/sidebar.md`, `training-progress.md`, `model-results.md`, `model-configuration.md`, `training-setup.md` and `content-modal.md` — reconcile API, labels, focus, docs stories and visual mappings with implementation. Document builder API and acceptance alongside its workflow section. Existing statuses stay implemented.
- [ ] `specification/content-and-i18n.md` § Static Content — add the closed Select Features Help route and default article. Status stays partial.
- [ ] `specification/visual-design.md` §§1–5 — scoped mockup port and register entries for the compact sidebar, progress states, numbered swatches, wizard state markup and heading/help changes. Status stays partial.
- [ ] `specification/HUMAN.md` — close this plan's claimed sections when verified. Preserve deferred styling and separately scoped improvements. Confirm status alignment in `specification/README.md`.

## Implementation tasks

### T1 — Persist provisional model identity and swatches

- **Depends on:** None
- **Risk:** needs care — concurrent finish and retry must keep the result, model and palette assignment consistent.
- **Likely files:** `src/types/state.ts`, `src/types/model-result.ts`, `src/stores/app.store.ts`, `src/stores/persister.ts`, `src/stores/reconciler.ts`, `src/common/storage/training-domain.ts`, `src/features/models/training/training-service.ts`, `src/features/models/training/result-validation.ts`, `src/features/results/evaluation-decoder.ts`, `tests/state-and-storage.test.ts`, `tests/training-domain.test.ts`, `tests/training-service.test.ts`, `tests/reconciler-indexeddb.test.ts`
- **Must not touch:** `src/features/models/training/*.worker.ts`, `src/types/model-evaluation.ts`, `vendor/`, `bun.lock`
- **Implementation:** Extend local wire decoding, guarded state, recovery and reset paths. Reuse protected number allocation for `openNewModel`, and add the saved-label and swatch contract to the existing atomic finish and retry path. Fill legacy swatches as specified. Keep evaluation, comparison and training identities intact.
- **Acceptance criteria:**
    - [ ] MW-STATE-1 — Concurrent open/retry returns a single provisional identity; blocked, failed and old-epoch requests cannot create or bind a draft.
    - [ ] MW-STATE-2 — Completions receive successive colours in commit order with wrap and no extra increment on replay. Historical states and results load, missing presentation is defaulted, and context reset starts a new sequence.
    - [ ] MW-STATE-3 — A committed result and model have matching label state. Legacy and invalid presentation fields leave a valid evaluation usable. Existing fingerprints and metrics are identical.
- **Verification:** `bun run typecheck`, `bun test tests/state-and-storage.test.ts`, `bun test tests/training-domain.test.ts`, `bun test tests/training-service.test.ts`, `bun test tests/reconciler-indexeddb.test.ts`.
- **Progress:** [ ] Not started

### T2 — Open new models at the provisional URL

- **Depends on:** T1
- **Risk:** needs care — the displayed route, mounted builder and stored run identity differ.
- **Likely files:** `src/types/state.ts`, `src/types/routes.ts`, `src/router/route-parser.ts`, `src/router/router.ts`, `src/router/scroll-restorer.ts`, `src/app.ts`, `src/stores/predicates.ts`, `src/stores/persister.ts`, `src/features/models/app-models-view.ts`, `src/features/models/app-models-view.stories.ts`, `src/features/models/app-model-builder-view.ts`, `src/features/models/app-model-builder-view.stories.ts`, `tests/router-and-navigation.test.ts`, `tests/models-overview.e2e.ts`, `tests/app-shell.e2e.ts`, `tests/fixtures/training/browser.ts`
- **Must not touch:** `specification/mockups/`, `vendor/`, `bun.lock`
- **Implementation:** Add the explicit route and effective underlay. Move New Model activation through the provisional route and connect the builder to the acknowledged identity. Preserve valid legacy numbered links, blocked state, resolution, recovery and Help. Plan the result handoff as specified above and keep route ownership in the router. Update affected stories and fixtures using existing public entry points.
- **Acceptance criteria:**
    - [ ] MW-ROUTE-1 — Supported direct visit, overview activation and reload at `/models/new` stay on that route and bind one model. No allocation if prerequisites or resume identity are invalid.
    - [ ] MW-ROUTE-2 — An acknowledged run reaches the exact numbered results page through the specified handoff. Pending, failure and another model's completion cannot cause promotion. The history length, heading focus, Help underlay and numeric deep links behave as specified.
- **Verification:** `bun test tests/router-and-navigation.test.ts`, `bun run test:e2e tests/models-overview.e2e.ts`, `bun run test:e2e tests/app-shell.e2e.ts`, `bun run test:stories`.
- **Progress:** [ ] Not started

### T3 — Confirm before leaving unfinished training

- **Depends on:** T2
- **Risk:** needs care — competing history instructions, local/remote attempts and a result saved mid-confirmation.
- **Likely files:** `src/types/routes.ts`, `src/router/router.ts`, `src/app.ts`, `src/features/models/app-model-builder-view.ts`, `src/features/models/app-model-builder-view.stories.ts`, `src/features/models/training/training-service.ts`, `src/stores/app.store.ts`, `src/stores/scroll.store.ts`, `tests/router-and-navigation.test.ts`, `tests/training-service.test.ts`, `tests/app-shell.e2e.ts`, `tests/training-panels.e2e.ts`
- **Must not touch:** `specification/mockups/`, `vendor/`
- **Implementation:** Implement the recorded in-app leave intent, indexed history restoration/replay and protected leave outcome. Use the existing shared native-dialog stylesheet and confirmation patterns. Guard async effects by the captured entry, model and context. Keep the focus/scroll owner and use translated dialog strings. Add the open, pending, error and viewing-from-Help states to the builder stories.
- **Acceptance criteria:**
    - [ ] MW-GUARD-1 — Anchor, router action and same-document Back/Forward each present one confirmation. Entering and leaving Help preserves the active model and input. Stay or Escape preserves route, draft, scroll and available focus.
    - [ ] MW-GUARD-2 — Confirming Leave performs the chosen protected operation exactly once, then replays the original navigation. Rejected, remote or pending operations leave a recoverable state at the source. Saving that wins the race keeps the successful trained result.
- **Verification:** `bun test tests/router-and-navigation.test.ts`, `bun test tests/training-service.test.ts`, `bun run test:e2e tests/app-shell.e2e.ts`, `bun run test:e2e tests/training-panels.e2e.ts`, `bun run test:stories`.
- **Progress:** [ ] Not started

### T4 — Show trained models and the result header

- **Depends on:** T2
- **Risk:** routine
- **Likely files:** `css/root.css`, `src/styles/model-swatch.styles.ts`, `src/styles/model-swatch.stories.ts`, `src/stores/sidebar.store.ts`, `src/features/shell/app-sidebar.ts`, `src/features/shell/app-sidebar.stories.ts`, `src/features/models/app-model-builder-view.ts`, `src/features/models/app-model-builder-view.stories.ts`, `src/features/results/app-model-results.ts`, `src/features/results/app-model-results.stories.ts`, `tests/sidebar-state.test.ts`, `tests/sidebar-acceptance.e2e.ts`, `tests/model-results.e2e.ts`, `tests/visual-parity/fixtures.ts`, `tests/visual-parity/map.ts`, `tests/visual-parity.e2e.ts`, `tests/visual-parity.e2e.ts-snapshots/sidebar-*.png`
- **Must not touch:** `specification/mockups/`, `src/features/results/charts/`, `src/features/results/comparison-model.ts`, `vendor/`
- **Implementation:** Use the compact sidebar markup, result identity and shared swatch style. Keep any new training details content tied to the exact saved run. Share one swatch CSSResult across the sidebar and results. Add co-located swatch stories for every fill, both sizes, long names and RTL. Preserve the existing results resource and graph structure. Add states to sidebar and results stories for no models, active provisional, trained, labels/fallbacks, long names and RTL. Update only affected parity fixtures/baselines and retain unaffected assertions.
- **Acceptance criteria:**
    - [ ] MW-MODEL-1 — The Step 3 list exposes the correct native actions, current marker and ordered trained rows. No invalid anchors or accidental keyboard stops. The same numbered colour appears in sidebar and results, and the displayed label/feature count match the saved model.
    - [ ] MW-MODEL-2 — The numbered results page has the approved heading and training details. Existing shared results work, including deep-linked and legacy states. Labels stay readable at 200% zoom and 320px and in forced colours.
- **Verification:** `bun test tests/sidebar-state.test.ts`, `bun test tests/style-tokens.test.ts`, `bun run test:e2e tests/sidebar-acceptance.e2e.ts`, `bun run test:e2e tests/model-results.e2e.ts`, `bun run test:e2e tests/visual-parity.e2e.ts`, `bun run test:stories`.
- **Progress:** [ ] Not started

### T5 — Sequence wizard steps after successful saves

- **Depends on:** T2
- **Risk:** needs care — the outgoing panel must remain rendered while focus and reactive state change.
- **Likely files:** `src/features/models/app-model-builder-view.ts`, `src/features/models/app-model-builder-view.stories.ts`, `src/styles/train-model.styles.ts`, `tests/models-setup.e2e.ts`, `tests/training-setup.e2e.ts`, `tests/model-configuration.e2e.ts`, `tests/a11y.e2e.ts`, `tests/fixtures/training/browser.ts`
- **Must not touch:** `specification/mockups/`, `src/stores/persister.ts`, `vendor/`
- **Implementation:** Make the existing card select event use the existing model/default feature completion path. Add the staged CSS transition and exact wizard heading/action contract. Preserve the card event API and form ownership. Use static CSS or attributes to hide the single SVG sprite, and the repository's CSP-compatible CSSOM pattern for measured dimensions. Add deterministic Wizard stories for initial, edited, complete, long label and RTL states.
- **Acceptance criteria:**
    - [ ] MW-STEP-1 — Select Model completes Step 1, updates its heading and shows Completed, the shared icon and Edit. Observe closing before switching active marker and opening the next content.
    - [ ] MW-STEP-2 — Each acknowledged commit through Step 4 uses the same sequence. Invalid and failed saves retain the editable panel. Editing and invalidation continue to work. Reduced motion, interrupted motion, keyboard and layout retain a settled current step and valid focus.
- **Verification:** `bun run test:e2e tests/models-setup.e2e.ts`, `bun run test:e2e tests/training-setup.e2e.ts`, `bun run test:e2e tests/model-configuration.e2e.ts`, `bun run test:e2e tests/a11y.e2e.ts`, `bun run test:stories`.
- **Progress:** [ ] Not started

### T6 — Port the progress panel states

- **Depends on:** T5
- **Risk:** needs care — the same bar and announcements must reflect the captured run throughout saving and recovery.
- **Likely files:** `src/features/models/app-training-progress.ts`, `src/features/models/app-training-progress.stories.ts`, `src/features/models/app-model-builder-view.ts`, `src/features/models/app-model-builder-view.stories.ts`, `src/styles/train-model.styles.ts`, `tests/training-panels.e2e.ts`, `tests/classification-training.e2e.ts`, `tests/a11y.e2e.ts`
- **Must not touch:** `specification/mockups/`, `src/features/models/training/*.worker.ts`, `vendor/`
- **Implementation:** Apply the 03-6 structure. Keep `app-training-progress` presentational with its existing properties and toggle event. Add an unreflected `variant: 'active' | 'stopped' | 'complete' = 'active'` input for status styling, supplied by the builder's acknowledged/matching run projection. Keep progress data, announcement and log separate. Preserve accessible native semantics and match each mockup state to precisely one UI state.
- **Acceptance criteria:**
    - [ ] MW-PROGRESS-1 — An indeterminate run lacks value, determinate work uses its real percentage and completion displays 100 only when acknowledged. Cancel, View Results and Retry Saving have the correct availability and the running/log content remains readable at narrow width and in forced colours.
    - [ ] MW-PROGRESS-2 — The stopped state follows the approved location and controls, retains actual partial progress when available and never invents it. Pending, remote and cancelled sessions cannot expose mismatched data. Log preference and status announcements work with keyboard and screen reader.
- **Verification:** `bun run test:e2e tests/training-panels.e2e.ts`, `bun run test:e2e tests/classification-training.e2e.ts`, `bun run test:e2e tests/a11y.e2e.ts`, `bun test tests/style-tokens.test.ts`, `bun run test:stories`. Manually verify announced milestones and log content with VoiceOver in Safari at actual zoom.
- **Progress:** [ ] Not started

### T7 — Add and unify model step Help

- **Depends on:** T5
- **Risk:** routine
- **Likely files:** `src/types/routes.ts`, `src/router/route-parser.ts`, `src/router/reserved-content.ts`, `src/router/router.ts`, `src/features/models/app-model-builder-view.ts`, `src/features/models/app-model-builder-view.stories.ts`, `src/styles/train-model.styles.ts`, `src/styles/help-link.styles.ts`, `src/styles/help-link.stories.ts`, `content/en/pages/select-features.md`, `content/en/pages/training-setup.md`, `tests/fixtures/content/valid-en/en/pages/`, `tests/fixtures/content/valid-multi/en/pages/`, `tests/build-content.test.ts`, `tests/router-and-navigation.test.ts`, `tests/training-setup.e2e.ts`, `tests/model-configuration.e2e.ts`, `tests/models-setup.e2e.ts`
- **Must not touch:** `specification/mockups/`, `vendor/`
- **Implementation:** Extend the closed route registry and required-content fixtures. Author Select Features and update the existing setup article if needed. Use the requested heading structure and shared style for all three inline header links. Retain article sanitisation, missing-content recovery and existing Configure Model text. Add Help views to wizard stories and co-located link stories covering standard, long-label and RTL text.
- **Acceptance criteria:**
    - [ ] MW-HELP-1 — Every link opens the correct built article, including the strategy trade-off table. The build catches a missing required article and unrecognised Help routes retain existing behaviour.
    - [ ] MW-HELP-2 — All three links can be activated via mouse, keyboard or touch. Help preserves wizard token, draft, form focus and underlying route on Close, Escape and Back.
- **Verification:** `bun test tests/build-content.test.ts`, `bun test tests/router-and-navigation.test.ts`, `bun run build`, `bun run test:e2e tests/training-setup.e2e.ts`, `bun run test:e2e tests/model-configuration.e2e.ts`, `bun run test:e2e tests/models-setup.e2e.ts`, `bun run test:stories`.
- **Progress:** [ ] Not started

### T8 — Verify the complete journey and synchronise specifications

- **Depends on:** T3, T4, T6, T7
- **Risk:** routine
- **Likely files:** `specification/workflow-steps.md`, `specification/app-state-and-navigation.md`, `specification/state-and-storage.md`, `specification/machine-learning-orchestrator.md`, `specification/content-and-i18n.md`, `specification/components/sidebar.md`, `specification/components/training-progress.md`, `specification/components/model-results.md`, `specification/components/model-configuration.md`, `specification/components/training-setup.md`, `specification/components/content-modal.md`, `specification/visual-design.md`, `specification/HUMAN.md`, `tests/journeys/iris-classification.e2e.ts`, `tests/fixtures/training/browser.ts`
- **Must not touch:** `specification/mockups/`, `vendor/`
- **Implementation:** Apply the Specification changes and synchronise the real two-run journey and fixtures through normal entry points. Update shared training journey helpers at the first task that changes the corresponding entry point if needed for that task's tests. Record command results, actual task commits, visual deviations and verification evidence.
- **Acceptance criteria:**
    - [ ] MW-JOURNEY-1 — The learner enters through Train New Model, selects and trains, reviews the numbered result, then uses Train Another Model and opens `/results` after a second success. The companion Dot plan's link targets and handoff remain available.
    - [ ] MW-SPEC-1 — The workflow, storage, Help and component specifications document the delivered behaviour and statuses.
- **Verification:** `bun run test:e2e tests/journeys/iris-classification.e2e.ts`, `bun run test:e2e tests/visual-parity.e2e.ts`, `bun run test:e2e tests/a11y.e2e.ts`, `bun run check`, `bun run lint`, `bun run build`, `bun run format:check`.
- **Progress:** [ ] Not started

## Verification and definition of done

- [ ] All task acceptance criteria met.
- [ ] Relevant verification commands from `AGENTS.md` pass with no new failures.
- [ ] Type-check, lint, formatting, and build checks pass.
- [ ] Accessibility (WCAG 2.2 AA), privacy/security, and contract-compatibility checks completed where applicable.
- [ ] Every item under _Specification changes_ is ticked, and specifications match the implemented code.
- [ ] No unintended changes outside the tasks' likely files.

## Risks and open questions

- **Blocking:** None
- **Non-blocking:** The companion Dot plan consumes these stable route and link contracts after implementation. The reserved Help history stub overlaps existing behaviour tests; the guard is scoped to model workflow navigation and fixed topics. Check for concurrent router changes before implementation. Retain the repository's separate styling/promotion queue for other portions of the progress and results mockups.

## Escalations

None.

## Review fixes

None.

## Implementation and verification log

| When (UTC) | Task | Agent (model) | Outcome / commands / evidence |
| ---------- | ---- | ------------- | ----------------------------- |
| —          | —    | —             | Not started                   |

## Plan review history

| Reviewed (UTC) | Agent (model) | Decision | Findings |
| -------------- | ------------- | -------- | -------- |

## Change log

| When (UTC)           | Change                     | Reason                                                                                                                                                         |
| -------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-25T13:48:28Z | Initial draft              | Maintainer's Model Workflow, Experiment Names, Model Training Progress and Model Step Help Links notes.                                                        |
| 2026-11-25T13:52:14Z | Resolve workflow decisions | Maintainer chose explicit View Results, discard unfinished work after confirmation, a numbered results heading and Training Details, and Step 5 stopped/retry. |
