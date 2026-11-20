import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { buttonStyles } from '../../src/styles/button.styles';
import { hyperparametersStyles } from '../../src/styles/hyperparameters.styles';
import { trainModelStyles } from '../../src/styles/train-model.styles';

/** Story-only shadow-root host that adopts the hyperparameter field styles. */
@customElement('storybook-hyperparameter-field-host')
class StorybookHyperparameterFieldHost extends LitElement {
	@property({ attribute: false }) accessor folds = 0;
	@property({ attribute: false }) accessor matrixCaption = 'Cross-validation training iterations';

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
		if (this.folds > 0) return this.renderMatrix();

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

	private renderMatrix() {
		const folds = Array.from({ length: this.folds }, (_, index) => index + 1);
		const trainPercent = ((this.folds - 1) / this.folds) * 100;
		const validationPercent = 100 / this.folds;
		return html`
			<div class="field-visual">
				<div
					class="fold-matrix-scroll"
					tabindex="0"
					role="region"
					aria-labelledby="folds-matrix-caption">
					<table class="fold-matrix" aria-describedby="folds-visual-summary">
						<caption id="folds-matrix-caption">
							${this.matrixCaption}
						</caption>
						<thead>
							<tr>
								<th scope="col">Run</th>
								${repeat(
									folds,
									(fold) => fold,
									(fold) => html`<th scope="col">${fold}</th>`
								)}
							</tr>
						</thead>
						<tbody>
							${repeat(
								folds,
								(run) => run,
								(run) => html`
									<tr>
										<th scope="row">${run}</th>
										${repeat(
											folds,
											(fold) => fold,
											(fold) => html`
												<td
													class=${fold === run
														? 'fold-validation'
														: 'fold-training'}>
													<span aria-hidden="true"
														>${fold === run ? '✓' : '–'}</span
													>
													<span class="visually-hidden"
														>${fold === run
															? 'Validation'
															: 'Training'}</span
													>
												</td>
											`
										)}
									</tr>
								`
							)}
						</tbody>
					</table>
				</div>
				<p id="folds-visual-summary" class="fold-visual-summary">
					Each of the ${this.folds} runs trains on ${this.folds - 1} folds
					(${trainPercent}%) and validates on 1 fold (${validationPercent}%).
				</p>
				<ul class="fold-legend" aria-label="Fold partition legend">
					<li>
						<span class="fold-legend-swatch fold-legend-swatch-train" aria-hidden="true"
							>–</span
						>Training
					</li>
					<li>
						<span
							class="fold-legend-swatch fold-legend-swatch-validation"
							aria-hidden="true"
							>✓</span
						>Validation
					</li>
				</ul>
			</div>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'storybook-hyperparameter-field-host': StorybookHyperparameterFieldHost;
	}
}
