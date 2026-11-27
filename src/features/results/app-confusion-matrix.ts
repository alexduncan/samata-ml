import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { resultsStyles } from '../../styles/results.styles';
import { tableStyles } from '../../styles/table.styles';
import type { ConfusionMatrixView } from './results-view-model';

/** Text supplied by the connected results view. */
export interface ConfusionMatrixLabels {
	/** Table caption naming the shown row count and the held-out scope. */
	readonly caption: (view: ConfusionMatrixView) => string;
	readonly trueClass: string;
	readonly predictedClass: string;
	readonly support: string;
	/** Label of the class filter shown for many classes. */
	readonly filter: string;
	/** Text of the option that restores the default row selection. */
	readonly defaultFilter: string;
	readonly filterStatus: (label: string | null) => string;
}

/** Empty labels: the parent supplies every string. */
export const DEFAULT_CONFUSION_MATRIX_LABELS: ConfusionMatrixLabels = {
	caption: () => '',
	trueClass: '',
	predictedClass: '',
	support: '',
	filter: '',
	defaultFilter: '',
	filterStatus: () => ''
};

/** Detail of `app-confusion-filter-change`. */
export interface ConfusionFilterChangeDetail {
	readonly classFilter: number | null;
}

/**
 * Pooled held-out confusion matrix in a native table. With more than twenty classes a labelled
 * filter chooses which true classes are shown.
 *
 * @fires app-confusion-filter-change - The learner chose a true class, or restored the default.
 */
@customElement('app-confusion-matrix')
export class AppConfusionMatrix extends LitElement {
	static override styles = [tableStyles, resultsStyles];

	/** Preformatted matrix, or null while there is nothing to show. */
	@property({ attribute: false }) accessor matrix: ConfusionMatrixView | null = null;
	/** Selected true-class index for many classes, or null for the default. */
	@property({ attribute: false }) accessor classFilter: number | null = null;
	/** Localised text. */
	@property({ attribute: false }) accessor labels: ConfusionMatrixLabels =
		DEFAULT_CONFUSION_MATRIX_LABELS;

	private handleFilter(event: Event): void {
		const value = (event.currentTarget as HTMLSelectElement).value;
		this.dispatchEvent(
			new CustomEvent<ConfusionFilterChangeDetail>('app-confusion-filter-change', {
				detail: { classFilter: value === '' ? null : Number(value) },
				bubbles: true,
				composed: true
			})
		);
	}

	override render() {
		const matrix = this.matrix;
		if (!matrix) return nothing;
		const selected = this.classFilter ?? matrix.selected;
		return html`
			${matrix.filterable
				? html`
						<p>
							<label for="filter">${this.labels.filter}</label>
							<select id="filter" @change=${this.handleFilter}>
								<option value="" ?selected=${selected === null}>
									${this.labels.defaultFilter}
								</option>
								${repeat(
									matrix.options,
									(option) => option.index,
									(option) => html`
										<option
											value=${option.index}
											?selected=${selected === option.index}>
											${option.label}
										</option>
									`
								)}
							</select>
						</p>
					`
				: nothing}
			${matrix.filterable
				? html`<p class="visually-hidden" aria-live="polite">
						${this.labels.filterStatus(
							matrix.options.find((option) => option.index === selected)?.label ??
								null
						)}
					</p>`
				: nothing}
			<div class="table-region" role="region" tabindex="0" aria-labelledby="caption">
				<table class="table table-compact">
					<caption id="caption">
						${this.labels.caption(matrix)}
					</caption>
					<thead>
						<tr>
							<td colspan="2"></td>
							<th scope="colgroup" colspan=${matrix.columns.length}>
								${this.labels.predictedClass}
							</th>
						</tr>
						<tr>
							<th scope="col">${this.labels.trueClass}</th>
							<th scope="col" class="number">${this.labels.support}</th>
							${repeat(
								matrix.columns,
								(column) => column.index,
								(column) =>
									html`<th scope="col" class="number">${column.label}</th>`
							)}
						</tr>
					</thead>
					<tbody>
						${repeat(
							matrix.rows,
							(row) => row.index,
							(row) => html`
								<tr>
									<th scope="row">${row.label}</th>
									<td class="number">${row.support}</td>
									${row.cells.map(
										(cell) => html`
											<td class="number">
												${cell.correct
													? html`<strong>${cell.text}</strong>`
													: cell.text}
											</td>
										`
									)}
								</tr>
							`
						)}
					</tbody>
				</table>
			</div>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'app-confusion-matrix': AppConfusionMatrix;
	}
}
