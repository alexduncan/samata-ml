# Dynamic Help topics

**Status:** stub | **Updated:** 2026-11-25T21:39:55Z
**Authors:** Claude Code (claude-opus-5-5) | **Created:** 2026-11-20T07:59:44Z
**Verified by:** — | **Verified:** — | **Verification:** pending
**Verified hash:** —
**Implementation verified by:** — | **Implementation verified:** —

## Goal

**Current behaviour** — Help pages use a closed route registry and build-checked default content. The [model workflow](archive/model-training-workflow.md) delivered entry-local ownership and exact wizard underlays for those fixed routes.

**Target behaviour** — Decide whether a single lowercase kebab-case `/help/{slug}` should open a Help page from `content/{locale}/pages/{slug}.md`, with an unlisted-topic message distinct from delivery errors.

This decision remains from [Training Setup Phase 2](archive/web-ml-phase-2-training-setup.md).

## Scope

**In scope** (re-verify with `codebase-scout` when expanding)

- If dynamic topics are approved, validate slugs at the parser and at `openReserved` or `navigate`. Preserve the build-checked map for required pages.
- Distinguish an unlisted topic in the validated index from a delivery failure, with separate modal states and cache-isolated stories.

**Out of scope**

- Fixed-route history ownership, [scroll restoration](scroll-region-restoration.md) and Help article content.

## Risks and open questions

- **Blocking:** Is dynamic `/help/{slug}` routing wanted, or should Help pages stay a closed list? Recommended: stay closed until there are more than about six Help pages.
