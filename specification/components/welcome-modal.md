# Spec: Welcome Modal (`app-welcome-modal`)

**Status:** implemented · Tier: **Connected component** · Criterion prefix: `WEL`

## 1. Summary

First-visit onboarding in a native dialog, shown on root/workflow routes until the user explicitly dismisses it.

## 2. Decision and rationale

The connected owner reads onboarding, route and beta deployment (`$betaDeployment`) stores. Non-beta welcome uses native Escape and backdrop dismissal and calls `dismissWelcome`. Beta welcome requires explicit **Get Started** acceptance before `acceptBetaTelemetry` runs. It stays open on Escape or a backdrop click. Visiting a reserved route may hide the dialog while preserving the onboarding state.

## 3. Public API (closed)

Tag `app-welcome-modal`, class `AppWelcomeModal`, `src/features/shell/app-welcome-modal.ts`. Tag only: no custom properties/attributes, reactive properties, slots, events, methods or parts. Store state uses `onboarding.welcomeDismissed` and `onboarding.betaTelemetryAccepted` alongside `$betaDeployment` (`src/common/telemetry/telemetry-client.ts`).

## 4. Usage

```html
<app-welcome-modal></app-welcome-modal>
```

Mount once in the shell. It opens with `showModal` while undismissed (`!welcomeDismissed`, or in beta mode `!betaTelemetryAccepted`) on root/workflow routes. Non-beta **Get Started** and native dismissal persist `welcomeDismissed` once; beta **Get Started** persists `acceptBetaTelemetry()` and records the `beta_get_started` milestone once, while navigating to the inline `/privacy` link keeps the notice undismissed and returns smoothly. Route hiding/disconnection suppresses queued closes without writing dismissal; returning from an untouched reserved route reopens onboarding. A later render never reopens an explicitly dismissed/accepted welcome.

## 5. Visual specification

`00_first-load.html` maps to the shared `dialog.modal`, sticky `.modal-header`, shared button and chiclet sheets, and owner-local typography inside `.modal-content`. The modal is 40rem wide subject to viewport bounds and has a minimum block size of 50dvh. The h2 reads “samatā.ml beta”. The lead preserves the reference 1.5rem size, 700 weight, normal line-height and 0.83em block margins. The body is 1rem at weight 400 with 2rem line-height and 1rem end margin. The full-width primary action takes initial focus.

Changes from mockup CSS: SEM-04 named h2, SEM-11 solid chiclet treatment, SEM-12 semantic paragraph lead, SEM-13 button name from visible Get Started text, A11Y-04 dark amber text. The shared solid badge retains a border, allowing the recorded one-pixel title-flow difference. Native action focus may display the authorised outline in screenshots; normal modal bounds/type remain mapped with no drift exemption.

Beta disclosure deviation: `specification/mockups/00-1_beta-welcome.html` is a `status="draft"` semantic wireframe for the beta analytics notice paragraph and `/privacy` link placed above **Get Started** when `$betaDeployment` is true; non-beta parity against `00_first-load.html` remains unchanged.

## 6. Accessibility

`aria-labelledby` references the visible h2. In beta mode `aria-describedby` references the beta notice paragraph (`#welcome-beta`). Native button text supplies the primary action name. The non-beta welcome allows Escape and backdrop dismissal. The beta consent lock uses `closedby="none"`, prevents the native `cancel` event and guards the fallback until **Get Started** records consent. Manual review covers dialog and action announcements, keyboard dismissal and return, native zoom, narrow and RTL layouts, and display settings.

## 7. Internationalisation

The connected dictionary owns brand “samatā.ml”, “beta”, “train machine learning models inside your browser.”, “The samatā.ml platform allows anyone to learn key Artificial Intelligence concepts through hands-on experimentation.”, the beta analytics disclosure notice with its `/privacy` link text, and “Get Started”. No consumer label/property API is introduced. RTL is a layout fixture; additional locales remain outside scope.

## 8. Acceptance criteria

| ID       | Criterion                                                                                  |
| -------- | ------------------------------------------------------------------------------------------ |
| WEL-AC-1 | Get Started closes and persists once, including queued native close.                       |
| WEL-AC-2 | Native Esc persists once (non-beta) and later state renders do not reopen.                 |
| WEL-AC-3 | Reference geometry, semantic names and strict scoped axe.                                  |
| WEL-AC-4 | Reload preserves explicit dismissal.                                                       |
| WEL-AC-5 | Reserved-route hiding/direct load leaves onboarding untouched and returning can reopen it. |

Beta disclosure, cancel/reopen gating, `/privacy` link routing, and CSP/telemetry acceptance run in `tests/telemetry-acceptance.e2e.ts`; non-beta criteria run in `tests/welcome-acceptance.e2e.ts` in three engines. Dialog/title/lead/body/action/badge parity mappings and paired reference/app captures complement these acceptance tests.

## 9. Stories

`src/features/shell/app-welcome-modal.stories.ts`, `Shell/Welcome`: `Open`, `BetaNotice`, `RTL`, and `LongNotice`, isolated in Docs with deterministic state and strict axe. There is no public long-label override; content comes from the connected dictionary.

## 10. Files

`src/features/shell/app-welcome-modal.ts`, its story, `tests/welcome-acceptance.e2e.ts`, `tests/app-shell.e2e.ts`, `tests/visual-parity/map.ts`.

## 11. Non-goals

No route, extra persisted state, content loader, custom dismissal policy, body-scroll lock or generic modal framework.

## 12. Open questions

None for this onboarding contract.
