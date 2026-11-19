import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { buttonStyles } from '../../src/styles/button.styles';
import { hyperparametersStyles } from '../../src/styles/hyperparameters.styles';
import { trainModelStyles } from '../../src/styles/train-model.styles';

/** Story-only shadow-root host that adopts the hyperparameter field styles. */
@customElement('storybook-hyperparameter-field-host')
class StorybookHyperparameterFieldHost extends LitElement {
	static override styles = [
		buttonStyles,
		trainModelStyles,
		hyperparametersStyles,
		css`
			:host {
				display: block;
			}
			:host([hidden]) {
				display: none;
			}
		`
	];

	override render() {
		return html`
			<div class="field">
				<label class="field-name" for="kernel">Kernel</label>
				<select id="kernel" class="field-control" aria-describedby="kernel-help">
					<option>rbf</option>
					<option>linear</option>
				</select>
				<div class="field-description">
					<div id="kernel-help">
						<p>
							The <abbr title="The shape of boundary the model can draw">kernel</abbr>
							sets the boundary shape.
						</p>
						<p class="field-dependent">Degree applies only to the polynomial kernel.</p>
					</div>
				</div>
			</div>
			<div class="field">
				<label class="field-name" for="intercept">Fit intercept</label>
				<input id="intercept" class="field-control" type="checkbox" checked />
				<div class="field-description"><p>Adds a constant to every prediction.</p></div>
			</div>
			<div class="field">
				<span class="field-name" id="c-label">Regularisation strength</span>
				<div class="field-controls" role="group" aria-labelledby="c-label">
					<input
						type="range"
						min="-4"
						max="4"
						step="0.1"
						value="0"
						aria-labelledby="c-label" />
					<input
						type="number"
						name="C"
						value="1"
						step="any"
						aria-label="C (exact value)" />
				</div>
				<div class="field-description"><p>Smaller values regularise more.</p></div>
			</div>
			<div class="field">
				<label class="field-name" for="tol">Tolerance</label>
				<div class="field-controls field-controls--with-action">
					<input
						id="tol"
						type="number"
						name="tol"
						value="0.001"
						step="any"
						aria-invalid="true"
						aria-describedby="tol-error tol-help" />
					<button type="button" class="btn">Reset</button>
				</div>
				<div class="field-description">
					<p id="tol-error" class="field-error">Enter a number greater than 0.</p>
					<div id="tol-help">
						<p>Training stops when improvement falls below this value.</p>
					</div>
				</div>
			</div>
			<p class="form-note">Classes are handled with one-vs-rest.</p>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'storybook-hyperparameter-field-host': StorybookHyperparameterFieldHost;
	}
}
