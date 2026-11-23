import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { resultsStyles } from '../../styles/results.styles';
import { tableStyles } from '../../styles/table.styles';
import { PlotController, type ChartLibrary, type ChartTokens } from './charts/plot-controller';
import type { CalibrationView, ChartCaption } from './results-view-model';

/** Text supplied by the connected results view. */
export interface ReliabilityDiagramLabels {
	/** Shown instead of the diagram when the model reports no probabilities. */
	readonly unavailable: string;
	readonly xAxis: string;
	readonly yAxis: string;
	/** Accessible name of the aligned count histogram. */
	readonly countsTitle: string;
	readonly countsAxis: string;
	/** Name of the dashed diagonal. */
	readonly diagonal: string;
	readonly showTable: string;
	readonly tableCaption: string;
	readonly binHeading: string;
	readonly meanPredicted: string;
	readonly observed: string;
	readonly count: string;
	readonly range: (lower: string, upper: string) => string;
	/** Shown in a table cell for a bin with no rows. */
	readonly emptyBin: string;
}

/** Empty labels: the parent supplies every string. */
export const DEFAULT_RELIABILITY_DIAGRAM_LABELS: ReliabilityDiagramLabels = {
	unavailable: '',
	xAxis: '',
	yAxis: '',
	countsTitle: '',
	countsAxis: '',
	diagonal: '',
	showTable: '',
	tableCaption: '',
	binHeading: '',
	meanPredicted: '',
	observed: '',
	count: '',
	range: () => '',
	emptyBin: ''
};

const MARGIN_LEFT = 56;
const MARGIN_RIGHT = 16;

/**
 * Reliability diagram: observed against mean predicted probability per bin, the dashed
 * diagonal of perfect calibration, and an aligned histogram of how many rows fall in each bin.
 * Lines break at empty bins.
 */
@customElement('app-reliability-diagram')
export class AppReliabilityDiagram extends LitElement {
	static override styles = [tableStyles, resultsStyles];

	/** Preformatted calibration bins, or null when the model reports no probabilities. */
	@property({ attribute: false }) accessor calibration: CalibrationView | null = null;
	/** Chart title and takeaway; the takeaway states the expected calibration error. */
	@property({ attribute: false }) accessor caption: ChartCaption | null = null;
	/** Formats a 0 to 1 value as a percentage. */
	@property({ attribute: false }) accessor formatPercent: (value: number) => string = String;
	/** Formats a whole count. */
	@property({ attribute: false }) accessor formatCount: (value: number) => string = String;
	/** Localised text. */
	@property({ attribute: false }) accessor labels: ReliabilityDiagramLabels =
		DEFAULT_RELIABILITY_DIAGRAM_LABELS;

	private readonly reliabilityPlot = new PlotController(
		this,
		() => this.renderRoot.querySelector<HTMLElement>('.reliability'),
		(chart, tokens, width) => this.drawReliability(chart, tokens, width)
	);
	private readonly countsPlot = new PlotController(
		this,
		() => this.renderRoot.querySelector<HTMLElement>('.counts'),
		(chart, tokens, width) => this.drawCounts(chart, tokens, width)
	);

	/** Resolves when both charts have been drawn or abandoned. */
	whenSettled(): Promise<void> {
		return this.updateComplete.then(() =>
			Promise.all([this.reliabilityPlot.whenSettled(), this.countsPlot.whenSettled()]).then(
				() => undefined
			)
		);
	}

	private drawReliability(chart: ChartLibrary, tokens: ChartTokens, width: number) {
		const view = this.calibration;
		if (!view || !this.caption) return null;
		let run = 0;
		let previousDefined = false;
		const points = view.bins.flatMap((bin) => {
			const defined = bin.meanPredicted !== null && bin.observed !== null;
			if (defined && !previousDefined) run += 1;
			previousDefined = defined;
			return defined ? [{ x: bin.meanPredicted!, y: bin.observed!, run }] : [];
		});
		return chart.plot({
			width,
			height: 296,
			marginLeft: MARGIN_LEFT,
			marginRight: MARGIN_RIGHT,
			marginTop: 32,
			marginBottom: 44,
			x: {
				domain: [0, 1],
				label: this.labels.xAxis,
				ticks: [0, 0.25, 0.5, 0.75, 1],
				tickFormat: this.formatPercent
			},
			y: {
				domain: [0, 1],
				label: this.labels.yAxis,
				ticks: [0, 0.25, 0.5, 0.75, 1],
				tickFormat: this.formatPercent
			},
			ariaLabel: this.caption.title,
			ariaDescription: this.caption.takeaway,
			style: {
				background: 'transparent',
				color: tokens['--chart-axis'],
				fontSize: '0.8125rem'
			},
			marks: [
				chart.ruleY([0, 0.25, 0.5, 0.75, 1], { stroke: tokens['--chart-grid'] }),
				chart.lineY(
					[
						{ x: 0, y: 0 },
						{ x: 1, y: 1 }
					],
					{
						x: 'x',
						y: 'y',
						stroke: tokens['--chart-neutral'],
						strokeDasharray: '6 4',
						strokeWidth: 1.5
					}
				),
				chart.text([this.labels.diagonal], {
					frameAnchor: 'bottom-right',
					text: (d: string) => d,
					fill: tokens['--chart-axis'],
					dy: -8,
					dx: -4
				}),
				chart.lineY(points, {
					x: 'x',
					y: 'y',
					z: 'run',
					stroke: tokens['--chart-1'],
					strokeWidth: 2
				}),
				chart.dot(points, { x: 'x', y: 'y', r: 4, fill: tokens['--chart-1'] })
			]
		});
	}

	private drawCounts(chart: ChartLibrary, tokens: ChartTokens, width: number) {
		const view = this.calibration;
		if (!view || !this.caption) return null;
		return chart.plot({
			width,
			height: 154,
			marginLeft: MARGIN_LEFT,
			marginRight: MARGIN_RIGHT,
			marginTop: 32,
			marginBottom: 32,
			x: {
				domain: [0, 1],
				label: null,
				ticks: [0, 0.25, 0.5, 0.75, 1],
				tickFormat: this.formatPercent
			},
			y: { label: this.labels.countsAxis, nice: true, tickFormat: this.formatCount },
			ariaLabel: this.labels.countsTitle,
			style: {
				background: 'transparent',
				color: tokens['--chart-axis'],
				fontSize: '0.8125rem'
			},
			marks: [
				chart.rectY(view.bins, {
					x1: 'lower',
					x2: 'upper',
					y: 'count',
					fill: tokens['--chart-1'],
					insetLeft: 0.5,
					insetRight: 0.5
				}),
				chart.ruleY([0], { stroke: tokens['--chart-axis'] })
			]
		});
	}

	override render() {
		const view = this.calibration;
		const { labels } = this;
		if (!view) return labels.unavailable ? html`<p>${labels.unavailable}</p>` : nothing;
		if (!this.caption) return nothing;
		return html`
			<figure>
				<figcaption>
					<span class="caption-title">${this.caption.title}</span>
					<span class="muted">${this.caption.takeaway}</span>
				</figcaption>
				<div class="chart reliability"></div>
				<div class="chart counts"></div>
				<details>
					<summary>${labels.showTable}</summary>
					<div class="table-region" role="region" tabindex="0" aria-labelledby="caption">
						<table class="table table-compact">
							<caption id="caption">
								${labels.tableCaption}
							</caption>
							<thead>
								<tr>
									<th scope="col">${labels.binHeading}</th>
									<th scope="col" class="number">${labels.count}</th>
									<th scope="col" class="number">${labels.meanPredicted}</th>
									<th scope="col" class="number">${labels.observed}</th>
								</tr>
							</thead>
							<tbody>
								${repeat(
									view.bins,
									(bin) => bin.lower,
									(bin) => html`
										<tr>
											<th scope="row">
												${labels.range(
													this.formatPercent(bin.lower),
													this.formatPercent(bin.upper)
												)}
											</th>
											<td class="number">${this.formatCount(bin.count)}</td>
											<td class="number">
												${bin.meanPredicted === null
													? labels.emptyBin
													: this.formatPercent(bin.meanPredicted)}
											</td>
											<td class="number">
												${bin.observed === null
													? labels.emptyBin
													: this.formatPercent(bin.observed)}
											</td>
										</tr>
									`
								)}
							</tbody>
						</table>
					</div>
				</details>
			</figure>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'app-reliability-diagram': AppReliabilityDiagram;
	}
}
