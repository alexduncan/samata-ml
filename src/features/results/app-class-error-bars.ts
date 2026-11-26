import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { tableStyles } from '../../styles/table.styles';
import { resultsStyles } from '../../styles/results.styles';
import { PlotController, type ChartLibrary, type ChartTokens } from './charts/plot-controller';
import type { ChartCaption } from './results-view-model';
import type { ModelColor } from '../../types/state';
import { modelSwatchStyles } from '../../styles/model-swatch.styles';
import {
	MODEL_COLOR_ENCODING,
	PLOT_SYMBOL_PATHS,
	computeAxisMargin,
	resolveModelMarkStyle,
	truncateLabel
} from './charts/chart-encoding';

/** Per-model error rates for one true class. */
export interface ClassErrorRowView {
	classIndex: number;
	label: string;
	models: readonly {
		num: number;
		label: string;
		modelColor: ModelColor;
		errorRate: number | null;
		errorCount: number | null;
		support: number | null;
	}[];
}
/** Text for the chart and its data table. */
export interface ClassErrorBarsLabels {
	class: string;
	model: string;
	errorRate: string;
	unavailable: string;
	showData: string;
	xAxis: string;
	yAxis: string;
	errorCountHeading: string;
	errorCountCell: (errors: string, total: string) => string;
	legendLabel: string;
	description: (rows: readonly ClassErrorRowView[]) => string;
}
/** Empty labels supplied until translations are provided. */
export const DEFAULT_CLASS_ERROR_BARS_LABELS: ClassErrorBarsLabels = {
	class: '',
	model: '',
	errorRate: '',
	unavailable: '',
	showData: '',
	xAxis: '',
	yAxis: '',
	errorCountHeading: '',
	errorCountCell: () => '',
	legendLabel: '',
	description: () => ''
};

/** Per-class error rates, with direct labels and a data table. */
@customElement('app-class-error-bars')
export class AppClassErrorBars extends LitElement {
	static override styles = [tableStyles, resultsStyles, modelSwatchStyles];
	@property({ attribute: false }) accessor rows: readonly ClassErrorRowView[] = [];
	@property({ attribute: false }) accessor caption: ChartCaption | null = null;
	@property({ attribute: false }) accessor formatPercent: (value: number) => string = String;
	@property({ attribute: false }) accessor formatCount: (value: number) => string = String;
	@property({ attribute: false }) accessor labels: ClassErrorBarsLabels =
		DEFAULT_CLASS_ERROR_BARS_LABELS;

	private readonly plot = new PlotController(
		this,
		() => this.renderRoot.querySelector<HTMLElement>('.chart'),
		(chart, tokens, width, fontSize, measureText) =>
			this.draw(chart, tokens, width, fontSize, measureText),
		() => 'description'
	);

	/** Resolves when the current chart is drawn or abandoned. */
	whenSettled(): Promise<void> {
		return this.updateComplete.then(() => this.plot.whenSettled());
	}

	private draw(
		chart: ChartLibrary,
		tokens: ChartTokens,
		width: number,
		fontSize: number,
		measureText: (text: string) => number
	) {
		if (!this.caption || this.rows.length === 0) return null;
		const values = this.rows.flatMap((row) =>
			row.models.map((model) => ({
				key: `${row.classIndex}:${model.num}`,
				label: `${row.label} · ${model.label}`,
				value: model.errorRate,
				style: resolveModelMarkStyle(model.modelColor, tokens)
			}))
		);
		const available = values.filter((value) => value.value !== null);
		const { margin, labelWidth } = computeAxisMargin(
			values.map((value) => value.label),
			fontSize,
			width,
			measureText
		);
		return chart.plot({
			width,
			height: Math.max(100, values.length * Math.ceil(fontSize * 2.5) + 50),
			marginLeft: margin,
			marginRight: Math.ceil(
				Math.max(fontSize * 2, measureText(this.formatPercent(1)) + fontSize)
			),
			x: {
				domain: [0, 1],
				zero: true,
				ticks: [0, 0.2, 0.4, 0.6, 0.8, 1],
				grid: true,
				label: null,
				tickFormat: this.formatPercent
			},
			y: {
				domain: values.map((value) => value.key),
				label: null,
				tickFormat: (key: string) =>
					truncateLabel(
						values.find((value) => value.key === key)?.label ?? '',
						labelWidth,
						measureText
					)
			},
			ariaLabel: this.caption.title,
			ariaDescription: this.caption.takeaway,
			style: {
				background: 'transparent',
				color: tokens['--chart-axis'],
				fontSize: '0.8125rem'
			},
			marks: [
				chart.barX(available, {
					x: 'value',
					y: 'key',
					fill: (value) => value.style.fill,
					stroke: (value) => value.style.barStroke,
					strokeWidth: (value) => value.style.barStrokeWidth
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
			<p id="description" class="visually-hidden">${this.labels.description(this.rows)}</p>
			<ul class="chart-legend" aria-label=${this.labels.legendLabel}>
				${(this.rows[0]?.models ?? []).map((model) => {
					const encoding = MODEL_COLOR_ENCODING[model.modelColor];
					return html`<li>
						<span
							class=${`swatch swatch-${model.modelColor} ${model.modelColor === 'amber' ? 'amber' : ''}`}
							aria-hidden="true"
							>${model.num}</span
						>
						<svg aria-hidden="true" viewBox="-8 -8 16 16" width="16" height="16">
							<path
								d=${PLOT_SYMBOL_PATHS[encoding.symbol]}
								fill=${encoding.stroked ? 'none' : `var(${encoding.token})`}
								stroke=${encoding.stroked
									? `var(${encoding.token})`
									: encoding.outlineRequired
										? 'var(--stone-900)'
										: 'var(--surface)'}
								stroke-width=${encoding.stroked ? 2 : 1.5}></path>
						</svg>
						${model.label}
					</li>`;
				})}
			</ul>
			<p>${this.labels.yAxis}</p>
			<div class="chart"></div>
			<p>${this.labels.xAxis}</p>
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
								<th scope="col">${this.labels.errorCountHeading}</th>
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
												<td class="number">
													${model.errorRate === null
														? this.labels.unavailable
														: this.formatPercent(model.errorRate)}
												</td>
												<td class="number">
													${model.errorCount === null ||
													model.support === null
														? this.labels.unavailable
														: this.labels.errorCountCell(
																this.formatCount(model.errorCount),
																this.formatCount(model.support)
															)}
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
