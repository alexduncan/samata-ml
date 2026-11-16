import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { buttonStyles } from '../../src/styles/button.styles';

/** Story-only proof of standard decorator rendering and shadow-root styling. */
@customElement('storybook-button-host')
class StorybookButtonHost extends LitElement {
	static override styles = [
		buttonStyles,
		css`
			:host {
				display: block;
			}
			:host([hidden]) {
				display: none;
			}
		`
	];

	/** Label rendered by the test host's button. */
	@property() accessor label = 'Shadow button';

	override render() {
		return html`<button class="btn" type="button">${this.label}</button>
			<button class="btn btn-primary" type="button">${this.label} (primary)</button>`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'storybook-button-host': StorybookButtonHost;
	}
}
