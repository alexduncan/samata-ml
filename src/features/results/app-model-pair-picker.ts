import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { resultsStyles } from '../../styles/results.styles';
import type { ModelOptionView } from './app-comparison-controls';

/** Text supplied by the connected comparison view. */
export interface ModelPairPickerLabels {
	modelA: string;
	modelB: string;
	swap: string;
	order: string;
}
/** Empty labels supplied until translations are provided. */
export const DEFAULT_MODEL_PAIR_PICKER_LABELS: ModelPairPickerLabels = {
	modelA: '',
	modelB: '',
	swap: '',
	order: ''
};
/** An atomic ordered-pair change. */
export interface ModelPairChangeDetail {
	pairA: number;
	pairB: number;
}

/**
 * Selects and swaps an ordered pair of models.
 * @fires app-model-pair-change - Both model numbers in their new order.
 */
@customElement('app-model-pair-picker')
export class AppModelPairPicker extends LitElement {
	static override styles = [
		resultsStyles,
		css`
			.visually-hidden {
				position: absolute;
				clip-path: inset(50%);
				inline-size: 1px;
				block-size: 1px;
				overflow: hidden;
				white-space: nowrap;
			}
			button:focus-visible {
				outline: 2px solid var(--focus-ring);
				outline-offset: 2px;
			}
			button {
				font-family: inherit;
			}
		`
	];
	@property({ attribute: false }) accessor models: readonly ModelOptionView[] = [];
	@property({ attribute: false }) accessor pairA: number | null = null;
	@property({ attribute: false }) accessor pairB: number | null = null;
	@property({ attribute: false }) accessor labels: ModelPairPickerLabels =
		DEFAULT_MODEL_PAIR_PICKER_LABELS;
	private announced = '';
	private initialised = false;
	private valid = false;

	override willUpdate(changed: PropertyValues<this>): void {
		this.valid =
			this.pairA !== null &&
			this.pairB !== null &&
			this.pairA !== this.pairB &&
			this.models.some((model) => model.num === this.pairA) &&
			this.models.some((model) => model.num === this.pairB);
		if (this.initialised && (changed.has('pairA') || changed.has('pairB')))
			this.announced = this.labels.order;
		this.initialised = true;
	}

	private emit(pairA: number | null, pairB: number | null): void {
		if (
			pairA === null ||
			pairB === null ||
			pairA === pairB ||
			!this.models.some((model) => model.num === pairA) ||
			!this.models.some((model) => model.num === pairB)
		)
			return;
		this.dispatchEvent(
			new CustomEvent<ModelPairChangeDetail>('app-model-pair-change', {
				detail: { pairA, pairB },
				bubbles: true,
				composed: true
			})
		);
	}
	private changeA(event: Event): void {
		this.emit(Number((event.currentTarget as HTMLSelectElement).value), this.pairB);
	}
	private changeB(event: Event): void {
		this.emit(this.pairA, Number((event.currentTarget as HTMLSelectElement).value));
	}
	private swap(): void {
		if (this.valid) this.emit(this.pairB, this.pairA);
	}

	override render() {
		return html`
			<label for="pair-a">${this.labels.modelA}</label>
			<select
				id="pair-a"
				.value=${this.pairA === null ? '' : String(this.pairA)}
				@change=${this.changeA}>
				${repeat(
					this.models,
					(model) => model.num,
					(model) =>
						html`<option
							value=${model.num}
							?disabled=${model.num === this.pairB}
							?selected=${model.num === this.pairA}>
							${model.label}
						</option>`
				)}
			</select>
			<label for="pair-b">${this.labels.modelB}</label>
			<select
				id="pair-b"
				.value=${this.pairB === null ? '' : String(this.pairB)}
				@change=${this.changeB}>
				${repeat(
					this.models,
					(model) => model.num,
					(model) =>
						html`<option
							value=${model.num}
							?disabled=${model.num === this.pairA}
							?selected=${model.num === this.pairB}>
							${model.label}
						</option>`
				)}
			</select>
			<button type="button" ?disabled=${!this.valid} @click=${this.swap}>
				${this.labels.swap}
			</button>
			<span role="status" class="visually-hidden">${this.announced || nothing}</span>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'app-model-pair-picker': AppModelPairPicker;
	}
}
