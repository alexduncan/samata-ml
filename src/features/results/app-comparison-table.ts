import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { tableStyles } from '../../styles/table.styles';
import { resultsStyles } from '../../styles/results.styles';
import { modelSwatchStyles } from '../../styles/model-swatch.styles';
import type { ModelColor } from '../../types/state';
import type { ComparisonColumn, ComparisonUi } from '../../types/state';
import type { ComparisonMetricCell } from './comparison-model';

/** A formatted metric with its sortable raw value. */
export type ComparisonCellView = ComparisonMetricCell & { text: string };
/** A model or baseline row ready for display. */
export interface ComparisonRowView {
	id: string;
	label: string;
	kind: 'model' | 'baseline';
	num?: number;
	modelColor?: ModelColor;
	metrics: Readonly<Partial<Record<ComparisonColumn, ComparisonCellView>>>;
}
/** A visible sortable measure. */
export interface ComparisonColumnView {
	id: ComparisonColumn;
	label: string;
	lowerIsBetter: boolean;
}
/** Text supplied by the connected comparison view. */
export interface ComparisonTableLabels {
	caption: string;
	model: string;
	baseline: string;
	unavailable: string;
}
/** Empty labels supplied until translations are provided. */
export const DEFAULT_COMPARISON_TABLE_LABELS: ComparisonTableLabels = {
	caption: '',
	model: '',
	baseline: '',
	unavailable: ''
};
/** The requested sort state. */
export interface ComparisonSortChangeDetail {
	sort: ComparisonUi['sort'];
}

/**
 * Displays comparison metrics with sortable model rows and fixed baselines.
 * @fires app-comparison-sort-change - A column sort was requested.
 */
@customElement('app-comparison-table')
export class AppComparisonTable extends LitElement {
	static override styles = [
		tableStyles,
		resultsStyles,
		modelSwatchStyles,
		css`
			button {
				font-family: inherit;
			}
			button:focus-visible {
				outline: 2px solid var(--focus-ring);
				outline-offset: 2px;
			}
			th[scope='row'] {
				max-inline-size: 16rem;
				overflow-wrap: anywhere;
			}
		`
	];
	@property({ attribute: false }) accessor rows: readonly ComparisonRowView[] = [];
	@property({ attribute: false }) accessor baselines: readonly ComparisonRowView[] = [];
	@property({ attribute: false }) accessor columns: readonly ComparisonColumnView[] = [];
	@property({ attribute: false }) accessor sort: ComparisonUi['sort'] = null;
	@property({ attribute: false }) accessor labels: ComparisonTableLabels =
		DEFAULT_COMPARISON_TABLE_LABELS;
	private changeSort(event: Event): void {
		const button = event.currentTarget as HTMLButtonElement;
		const column = button.value as ComparisonColumn;
		if (!this.columns.some((entry) => entry.id === column)) return;
		button.focus({ preventScroll: true });
		const sort =
			this.sort?.column !== column
				? { column, direction: 'ascending' as const }
				: this.sort.direction === 'ascending'
					? { column, direction: 'descending' as const }
					: null;
		this.dispatchEvent(
			new CustomEvent<ComparisonSortChangeDetail>('app-comparison-sort-change', {
				detail: { sort },
				bubbles: true,
				composed: true
			})
		);
	}

	private renderRow(row: ComparisonRowView) {
		return html`<tr>
			<th scope="row">
				${row.kind === 'model' && row.modelColor && row.num !== undefined
					? html`<span class=${`swatch swatch-${row.modelColor}`}>${row.num}</span>`
					: nothing}
				${row.label} ${row.kind === 'baseline' ? this.labels.baseline : nothing}
			</th>
			${repeat(
				this.columns,
				(column) => column.id,
				(column) =>
					html`<td class="number">
						${row.metrics[column.id]?.text || this.labels.unavailable}
					</td>`
			)}
		</tr>`;
	}

	override render() {
		return html`<div class="table-region" role="region" tabindex="0" aria-labelledby="caption">
			<table class="table table-compact">
				<caption id="caption">
					${this.labels.caption}
				</caption>
				<thead>
					<tr>
						<th scope="col">${this.labels.model}</th>
						${repeat(
							this.columns,
							(column) => column.id,
							(column) =>
								html` <th
									scope="col"
									aria-sort=${this.sort?.column === column.id
										? this.sort.direction
										: nothing}>
									<button
										type="button"
										value=${column.id}
										@click=${this.changeSort}>
										${column.label}
									</button>
								</th>`
						)}
					</tr>
				</thead>
				<tbody>
					${repeat(
						this.rows,
						(row) => row.id,
						(row) => this.renderRow(row)
					)}
				</tbody>
				<tbody>
					${repeat(
						this.baselines,
						(row) => row.id,
						(row) => this.renderRow(row)
					)}
				</tbody>
			</table>
		</div>`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'app-comparison-table': AppComparisonTable;
	}
}
