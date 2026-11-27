import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { resultsStyles } from '../../styles/results.styles';
import { modelSwatchStyles } from '../../styles/model-swatch.styles';
import type { ModelColor } from '../../types/state';
import type { StoredEvaluation } from '../../types/model-evaluation';

/** One localised group option. */
export interface GroupOptionView {
	fingerprint: string;
	protocol: StoredEvaluation['protocol']['kind'];
	modelCount: number;
	disabled: boolean;
	reason: 'single-model' | 'inconsistent' | null;
	text: string;
}

/** A labelled model choice. */
export interface ModelOptionView {
	num: number;
	label: string;
	readonly color: ModelColor;
}

/** Text supplied by the connected comparison view. */
export interface ComparisonControlsLabels {
	group: string;
	models: string;
	limit: string;
}

/** Empty labels supplied until the connected view provides translations. */
export const DEFAULT_COMPARISON_CONTROLS_LABELS: ComparisonControlsLabels = {
	group: '',
	models: '',
	limit: ''
};

/** Detail of a comparison-group selection. */
export interface ComparisonGroupChangeDetail {
	fingerprint: string;
}
/** Detail of a model-selection change. */
export interface ComparisonSelectionChangeDetail {
	selected: number[];
}

/**
 * Selects an evaluation group and up to eight models.
 * @fires app-comparison-group-change - The selected group changed.
 * @fires app-comparison-selection-change - The selected models changed.
 */
@customElement('app-comparison-controls')
export class AppComparisonControls extends LitElement {
	static override styles = [resultsStyles, modelSwatchStyles];
	@property({ attribute: false }) accessor groups: readonly GroupOptionView[] = [];
	@property({ attribute: false }) accessor fingerprint: string | null = null;
	@property({ attribute: false }) accessor models: readonly ModelOptionView[] = [];
	@property({ attribute: false }) accessor selected: readonly number[] = [];
	@property({ attribute: false }) accessor labels: ComparisonControlsLabels =
		DEFAULT_COMPARISON_CONTROLS_LABELS;

	private changeGroup(event: Event): void {
		const fingerprint = (event.currentTarget as HTMLSelectElement).value;
		if (!this.groups.some((group) => group.fingerprint === fingerprint && !group.disabled))
			return;
		this.dispatchEvent(
			new CustomEvent<ComparisonGroupChangeDetail>('app-comparison-group-change', {
				detail: { fingerprint },
				bubbles: true,
				composed: true
			})
		);
	}

	private changeSelection(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		const num = Number(input.value);
		if (!this.models.some((model) => model.num === num)) return;
		const selected = input.checked
			? [...new Set([...this.selected, num])]
			: this.selected.filter((item) => item !== num);
		if (selected.length > 8) return;
		this.dispatchEvent(
			new CustomEvent<ComparisonSelectionChangeDetail>('app-comparison-selection-change', {
				detail: { selected: selected.toSorted((a, b) => a - b) },
				bubbles: true,
				composed: true
			})
		);
	}

	override render() {
		return html`
			${this.groups.length > 1
				? html`
						<label for="group">${this.labels.group}</label>
						<select
							id="group"
							.value=${this.fingerprint ?? ''}
							@change=${this.changeGroup}>
							${repeat(
								this.groups,
								(group) => group.fingerprint,
								(group) =>
									html`<option
										value=${group.fingerprint}
										?disabled=${group.disabled}
										?selected=${group.fingerprint === this.fingerprint}>
										${group.text}
									</option>`
							)}
						</select>
					`
				: nothing}
			<fieldset aria-describedby="limit">
				<legend>${this.labels.models}</legend>
				<p id="limit">${this.labels.limit}</p>
				${repeat(
					this.models,
					(model) => model.num,
					(model) =>
						html` <div>
							<input
								id=${`model-${model.num}`}
								type="checkbox"
								value=${model.num}
								.checked=${this.selected.includes(model.num)}
								?disabled=${this.selected.length >= 8 &&
								!this.selected.includes(model.num)}
								aria-describedby="limit"
								@change=${this.changeSelection} />
							<label for=${`model-${model.num}`}
								><span class=${`swatch swatch-${model.color}`}>${model.num}</span>
								${model.label}</label
							>
						</div>`
				)}
			</fieldset>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'app-comparison-controls': AppComparisonControls;
	}
}
