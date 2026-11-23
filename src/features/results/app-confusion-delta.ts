import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { tableStyles } from '../../styles/table.styles';
import { resultsStyles } from '../../styles/results.styles';

/** Signed confusion counts and the shared class axis. */
export interface ConfusionDeltaView {
	labelA: string;
	labelB: string;
	labels: readonly string[];
	counts: readonly number[];
	shownClassIndices: readonly number[];
	largest: { trueIndex: number; predictedIndex: number; count: number } | null;
}
/** Localised text for the matrix and its filter. */
export interface ConfusionDeltaLabels {
	caption: string;
	filter: string;
	allClasses: string;
	trueClass: string;
	predictedClass: string;
	correct: string;
	takeaway: string;
}
/** Empty labels supplied until translations are provided. */
export const DEFAULT_CONFUSION_DELTA_LABELS: ConfusionDeltaLabels = {
	caption: '',
	filter: '',
	allClasses: '',
	trueClass: '',
	predictedClass: '',
	correct: '',
	takeaway: ''
};
/** Detail of a true-class filter change. */
export interface ConfusionDeltaFilterChangeDetail {
	classFilter: number | null;
}

/**
 * Signed difference between two confusion matrices on a common class axis.
 * @fires app-confusion-delta-filter-change - The selected true class changed.
 */
@customElement('app-confusion-delta')
export class AppConfusionDelta extends LitElement {
	static override styles = [tableStyles, resultsStyles];
	@property({ attribute: false }) accessor delta: ConfusionDeltaView | null = null;
	@property({ attribute: false }) accessor classFilter: number | null = null;
	@property({ attribute: false }) accessor formatSignedCount: ((count: number) => string) | null =
		null;
	@property({ attribute: false }) accessor labels: ConfusionDeltaLabels =
		DEFAULT_CONFUSION_DELTA_LABELS;

	private changeFilter(event: Event): void {
		const value = (event.currentTarget as HTMLSelectElement).value;
		this.dispatchEvent(
			new CustomEvent<ConfusionDeltaFilterChangeDetail>('app-confusion-delta-filter-change', {
				detail: { classFilter: value === '' ? null : Number(value) },
				bubbles: true,
				composed: true
			})
		);
	}

	override render() {
		const delta = this.delta,
			format = this.formatSignedCount;
		if (!delta || !format) return nothing;
		const size = delta.labels.length;
		return html`
			<p>${this.labels.takeaway}</p>
			${size > 20
				? html`<label for="filter">${this.labels.filter}</label>
						<select id="filter" @change=${this.changeFilter}>
							<option value="" ?selected=${this.classFilter === null}>
								${this.labels.allClasses}
							</option>
							${repeat(
								delta.labels,
								(_label, index) => index,
								(label, index) =>
									html`<option
										value=${index}
										?selected=${this.classFilter === index}>
										${label}
									</option>`
							)}
						</select>`
				: nothing}
			<div class="table-region" role="region" tabindex="0" aria-labelledby="caption">
				<table class="table table-compact">
					<caption id="caption">
						${this.labels.caption}
					</caption>
					<thead>
						<tr>
							<th scope="col">
								${this.labels.trueClass} / ${this.labels.predictedClass}
							</th>
							${repeat(
								delta.labels,
								(_label, index) => index,
								(label) => html`<th scope="col">${label}</th>`
							)}
						</tr>
					</thead>
					<tbody>
						${repeat(
							delta.shownClassIndices,
							(row) => row,
							(row) =>
								html` <tr>
									<th scope="row">${delta.labels[row]}</th>
									${delta.labels.map(
										(_label, column) =>
											html`<td class="number">
												${format(delta.counts[row * size + column]!)}
												${row === column
													? html` <span>(${this.labels.correct})</span>`
													: nothing}
											</td>`
									)}
								</tr>`
						)}
					</tbody>
				</table>
			</div>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'app-confusion-delta': AppConfusionDelta;
	}
}
