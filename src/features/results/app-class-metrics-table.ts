import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { resultsStyles } from '../../styles/results.styles';
import { tableStyles } from '../../styles/table.styles';
import type { ClassMetricsRow } from './results-view-model';

/** Text supplied by the connected results view. */
export interface ClassMetricsTableLabels {
	readonly caption: string;
	readonly class: string;
	readonly support: string;
	readonly precision: string;
	readonly recall: string;
	readonly f1: string;
}

/** Empty labels: the parent supplies every string. */
export const DEFAULT_CLASS_METRICS_TABLE_LABELS: ClassMetricsTableLabels = {
	caption: '',
	class: '',
	support: '',
	precision: '',
	recall: '',
	f1: ''
};

/** Pooled held-out precision, recall and F1 for each class, in a native table. */
@customElement('app-class-metrics-table')
export class AppClassMetricsTable extends LitElement {
	static override styles = [tableStyles, resultsStyles];

	/** One preformatted row per class, in class-axis order. */
	@property({ attribute: false }) accessor rows: readonly ClassMetricsRow[] = [];
	/** Localised headings. */
	@property({ attribute: false }) accessor labels: ClassMetricsTableLabels =
		DEFAULT_CLASS_METRICS_TABLE_LABELS;

	override render() {
		if (this.rows.length === 0) return nothing;
		return html`
			<div class="table-region" role="region" tabindex="0" aria-labelledby="caption">
				<table class="table table-compact">
					<caption id="caption">
						${this.labels.caption}
					</caption>
					<thead>
						<tr>
							<th scope="col">${this.labels.class}</th>
							<th scope="col" class="number">${this.labels.support}</th>
							<th scope="col" class="number">${this.labels.precision}</th>
							<th scope="col" class="number">${this.labels.recall}</th>
							<th scope="col" class="number">${this.labels.f1}</th>
						</tr>
					</thead>
					<tbody>
						${repeat(
							this.rows,
							(row) => row.index,
							(row) => html`
								<tr>
									<th scope="row">${row.label}</th>
									<td class="number">${row.support}</td>
									<td class="number">${row.precision}</td>
									<td class="number">${row.recall}</td>
									<td class="number">${row.f1}</td>
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
		'app-class-metrics-table': AppClassMetricsTable;
	}
}
