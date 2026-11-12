---
name: lit-implementer
description: Write or change Lit components, reactive controllers, component styles and component tests in samata-ml, following the approved plan and COMPONENTS.md. Use together with the implementation skill for every task that touches Lit code.
---

# Lit implementer

Use this together with the `implementation` skill. This skill is a checklist only. The rules are in [`specification/COMPONENTS.md`](../../../specification/COMPONENTS.md) (cited here as §n), and the design is in the plan.

- The plan decides the design: tiers, tags, public API, events, state and tests. Don't add, rename or remove any of it (§3).
- If the plan and `COMPONENTS.md` disagree, or the plan leaves out something this checklist needs, stop and escalate as the `implementation` skill describes. Don't choose a side.

## Before coding

Read the plan's _Required reading_. For a Lit task it must include `COMPONENTS.md` §3–§9; if it doesn't, read those sections anyway and note the omission in the plan's log.

## Checklist

Check each item before running verification.

**Element (§4)**

- [ ] One element per file, named after the tag. Registered with `@customElement`, with `HTMLElementTagNameMap` augmented.
- [ ] Decorated fields use `accessor`; internal members use `private`; overridden Lit members use `override`.
- [ ] Only the public API the plan lists exists (§3).

**Rendering (§4)**

- [ ] `render()` is pure. Empty branches return `nothing`. Changeable lists use keyed `repeat()`.
- [ ] No `unsafeHTML` or `unsafeCSS`. No queries into another element's `shadowRoot`.

**State (§4, §5)**

- [ ] Only connected elements import stores, through `StoreController`. Changes go through store actions.
- [ ] Store-derived values are `computed`; property-derived values are computed in `willUpdate()`.
- [ ] Anything that must survive a reload is in a store, not `@state`.

**Lifecycle (§4)**

- [ ] Every setup has a matching teardown in `disconnectedCallback()` / `hostDisconnected()`, and still works after the element is removed and re-attached.

**Events (§4)**

- [ ] Native events where they exist. Custom event names, `detail` types and `bubbles`/`composed` exactly as the plan states.

**Styles (§6)**

- [ ] Styles only in `static override styles`, including `:host { display: … }` and `:host([hidden]) { display: none; }`.
- [ ] Tokens for colour, shared style modules where the plan names them, logical properties, motion inside `prefers-reduced-motion: no-preference`, and a `:focus-visible` outline.

**Accessibility and i18n (§7, §8)**

- [ ] Native elements first; every control has an accessible name; everything works by keyboard.
- [ ] No user-visible string literals, including `aria-label`, `title` and `alt`.

**Tests (§9)**

- [ ] Every acceptance criterion has a test whose name starts with its ID. Component behaviour is tested in Playwright; non-DOM logic in `bun:test`.
- [ ] Only the commands in the task's **Verification** and in `AGENTS.md` are used. Don't install tools (such as Storybook or a linter) unless the task says to.

## Skeleton

Shows the §4 mechanics only. Take tags, properties, events and strings from the plan, not from here.

```ts
import { css, html, LitElement, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

/** Detail of the `ui-example-select` event. */
export interface UiExampleSelectDetail {
	id: string;
}

/**
 * Presentational example.
 *
 * @fires ui-example-select - The user chose an item.
 */
@customElement('ui-example')
export class UiExample extends LitElement {
	static override styles = css`
		:host {
			display: block;
		}
		:host([hidden]) {
			display: none;
		}
	`;

	/** Consumer-supplied label. */
	@property() accessor label = '';

	@state() private accessor expanded = false;

	private trimmedLabel = '';

	override willUpdate(changed: PropertyValues<this>): void {
		if (changed.has('label')) this.trimmedLabel = this.label.trim();
	}

	override render() {
		return html`
			<button type="button" aria-expanded=${this.expanded} @click=${this.handleClick}>
				${this.trimmedLabel || nothing}
			</button>
		`;
	}

	private handleClick(): void {
		this.expanded = !this.expanded;
		this.dispatchEvent(
			new CustomEvent<UiExampleSelectDetail>('ui-example-select', {
				detail: { id: this.label }
			})
		);
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'ui-example': UiExample;
	}
}
```
