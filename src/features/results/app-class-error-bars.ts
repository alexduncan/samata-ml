import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { tableStyles } from '../../styles/table.styles';
import { resultsStyles } from '../../styles/results.styles';
import { PlotController, type ChartLibrary, type ChartTokens } from './charts/plot-controller';
import type { ChartCaption } from './results-view-model';

/** Per-model error rates for one true class. */
export interface ClassErrorRowView {
	classIndex: number;
	label: string;
	models: readonly { num: number; label: string; errorRate: number | null }[];
}
/** Text for the chart and its data table. */
export interface ClassErrorBarsLabels {
	class: string;
	model: string;
	errorRate: string;
	unavailable: string;
	showData: string;
}
/** Empty labels supplied until translations are provided. */
export const DEFAULT_CLASS_ERROR_BARS_LABELS: ClassErrorBarsLabels = {
	class: '',
	model: '',
	errorRate: '',
	unavailable: '',
	showData: ''
};
const SERIES = [
	'--chart-1',
	'--chart-2',
	'--chart-3',
	'--chart-4',
	'--chart-5',
	'--chart-6'
] as const;

/** Per-class error rates, with direct labels and a data table. */
@customElement('app-class-error-bars')
export class AppClassErrorBars extends LitElement {
	static override styles = [tableStyles, resultsStyles];
	@property({ attribute: false }) accessor rows: readonly ClassErrorRowView[] = [];
	@property({ attribute: false }) accessor caption: ChartCaption | null = null;
	@property({ attribute: false }) accessor formatPercent: (value: number) => string = String;
	@property({ attribute: false }) accessor labels: ClassErrorBarsLabels =
		DEFAULT_CLASS_ERROR_BARS_LABELS;

	private readonly plot = new PlotController(
		this,
		() => this.renderRoot.querySelector<HTMLElement>('.chart'),
		(chart, tokens, width) => this.draw(chart, tokens, width)
	);

	/** Resolves when the current chart is drawn or abandoned. */
	whenSettled(): Promise<void> {
		return this.updateComplete.then(() => this.plot.whenSettled());
	}

	private draw(chart: ChartLibrary, tokens: ChartTokens, width: number) {
		if (!this.caption || this.rows.length === 0) return null;
		const values = this.rows.flatMap((row) =>
			row.models.map((model, index) => ({
				key: `${row.classIndex}:${model.num}`,
				label: `${row.label} · ${model.label}`,
				value: model.errorRate,
				colour: tokens[SERIES[index % SERIES.length]!]
			}))
		);
		const available = values.filter((value) => value.value !== null);
		return chart.plot({
			width,
			height: Math.max(100, values.length * 34 + 50),
			marginLeft: 160,
			marginRight: 55,
			x: { domain: [0, 1], label: null, tickFormat: this.formatPercent },
			y: { domain: values.map((value) => value.key), axis: null },
			ariaLabel: this.caption.title,
			ariaDescription: this.caption.takeaway,
			style: { background: 'transparent', color: tokens['--chart-axis'] },
			marks: [
				chart.barX(available, { x: 'value', y: 'key', fill: 'colour' }),
				chart.text(values, {
					x: 0,
					y: 'key',
					text: 'label',
					textAnchor: 'end',
					dx: -5,
					fill: tokens['--chart-axis']
				}),
				chart.text(available, {
					x: 'value',
					y: 'key',
					text: (value: { value: number | null }) => this.formatPercent(value.value!),
					textAnchor: 'start',
					dx: 4,
					fill: tokens['--chart-axis']
				})
			]
		});
	}

	override render() {
		if (!this.caption || this.rows.length === 0) return nothing;
		return html` <figure>
			<figcaption>
				<span class="caption-title">${this.caption.title}</span>
				<span class="muted">${this.caption.takeaway}</span>
			</figcaption>
			<div class="chart"></div>
			<details>
				<summary>${this.labels.showData}</summary>
				<div class="table-region" role="region" tabindex="0" aria-labelledby="caption">
					<table class="table table-compact">
						<caption id="caption">
							${this.caption.title}
						</caption>
						<thead>
							<tr>
								<th scope="col">${this.labels.class}</th>
								<th scope="col">${this.labels.model}</th>
								<th scope="col">${this.labels.errorRate}</th>
							</tr>
						</thead>
						<tbody>
							${repeat(
								this.rows,
								(row) => row.classIndex,
								(row) =>
									repeat(
										row.models,
										(model) => model.num,
										(model) =>
											html` <tr>
												<th scope="row">${row.label}</th>
												<td>${model.label}</td>
												<td>
													${model.errorRate === null
														? this.labels.unavailable
														: this.formatPercent(model.errorRate)}
												</td>
											</tr>`
									)
							)}
						</tbody>
					</table>
				</div>
			</details>
		</figure>`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'app-class-error-bars': AppClassErrorBars;
	}
}
