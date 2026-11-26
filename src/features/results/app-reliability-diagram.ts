import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { resultsStyles } from '../../styles/results.styles';
import { tableStyles } from '../../styles/table.styles';
import { PlotController, type ChartLibrary, type ChartTokens } from './charts/plot-controller';
import { integerTicks } from './charts/chart-encoding';
import type { CalibrationView, ChartCaption } from './results-view-model';

/** Text supplied by the connected results view. */
export interface ReliabilityDiagramLabels {
	/** Shown instead of the diagram when the model reports no probabilities. */
	readonly unavailable: string;
	readonly description: (view: CalibrationView) => string;
	readonly countsDescription: (view: CalibrationView) => string;
	readonly observedHeading: string;
	readonly countHeading: string;
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
	description: () => '',
	countsDescription: () => '',
	observedHeading: '',
	countHeading: '',
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
		(chart, tokens, width, fontSize, measureText) =>
			this.drawReliability(chart, tokens, width, fontSize, measureText),
		() => 'description'
	);
	private readonly countsPlot = new PlotController(
		this,
		() => this.renderRoot.querySelector<HTMLElement>('.counts'),
		(chart, tokens, width, fontSize) => this.drawCounts(chart, tokens, width, fontSize),
		() => 'counts-description'
	);

	/** Resolves when both charts have been drawn or abandoned. */
	whenSettled(): Promise<void> {
		return this.updateComplete.then(() =>
			Promise.all([this.reliabilityPlot.whenSettled(), this.countsPlot.whenSettled()]).then(
				() => undefined
			)
		);
	}

	private drawReliability(
		chart: ChartLibrary,
		tokens: ChartTokens,
		width: number,
		fontSize: number,
		measureText: (text: string) => number
	) {
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
		const size = Math.min(width, 420);
		const marginLeft = Math.ceil(fontSize * 3.5);
		const marginRight = Math.ceil(fontSize * 1.5);
		const centre = (marginLeft + size - marginRight) / 2;
		const available = Math.max(fontSize, 2 * Math.min(centre, size - centre) - fontSize);
		const lines: string[] = [];
		for (const word of this.labels.diagonal.split(/\s+/)) {
			const last = lines.at(-1);
			if (last && measureText(`${last} ${word}`) <= available) {
				lines[lines.length - 1] = `${last} ${word}`;
			} else {
				lines.push(word);
			}
		}
		return chart.plot({
			width: size,
			height: size,
			marginLeft,
			marginRight,
			marginTop: 32,
			marginBottom: width < 400 ? Math.ceil(fontSize * 2.8) : 44,
			x: {
				domain: [0, 1],
				label: null,
				ticks: [0, 0.2, 0.4, 0.6, 0.8, 1],
				tickRotate: width < 400 ? -90 : 0,
				tickFormat: this.formatPercent,
				grid: true
			},
			y: {
				domain: [0, 1],
				label: null,
				ticks: [0, 0.2, 0.4, 0.6, 0.8, 1],
				tickFormat: this.formatPercent,
				grid: true
			},
			ariaLabel: this.caption.title,
			ariaDescription: this.caption.takeaway,
			style: {
				background: 'transparent',
				color: tokens['--chart-axis'],
				fontSize: '0.8125rem'
			},
			marks: [
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
				chart.text([{ x: 0.5, y: 0.5, label: lines.join('\n') }], {
					x: 'x',
					y: 'y',
					text: 'label',
					fill: tokens['--chart-axis'],
					dy: -fontSize
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

	private drawCounts(chart: ChartLibrary, tokens: ChartTokens, width: number, fontSize: number) {
		const view = this.calibration;
		if (!view || !this.caption) return null;
		const maxCount = Math.max(0, ...view.bins.map((bin) => bin.count));
		return chart.plot({
			width: Math.min(width, 420),
			height: 154,
			marginLeft: Math.ceil(fontSize * 3.5),
			marginRight: Math.ceil(fontSize * 1.5),
			marginTop: 32,
			marginBottom: width < 400 ? Math.ceil(fontSize * 2.8) : 32,
			x: {
				domain: [0, 1],
				label: null,
				ticks: [0, 0.2, 0.4, 0.6, 0.8, 1],
				tickRotate: width < 400 ? -90 : 0,
				tickFormat: this.formatPercent,
				grid: true
			},
			y: {
				label: null,
				zero: true,
				nice: true,
				ticks: integerTicks(0, maxCount),
				grid: true,
				tickFormat: this.formatCount
			},
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
					fill: tokens['--chart-neutral'],
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
				<p class="visually-hidden" id="description">${labels.description(view)}</p>
				<p class="visually-hidden" id="counts-description">
					${labels.countsDescription(view)}
				</p>
				<p>${labels.yAxis}</p>
				<div class="chart reliability"></div>
				<p>${labels.xAxis}</p>
				<p>${labels.countsAxis}</p>
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
									<th scope="col" class="number">${labels.countHeading}</th>
									<th scope="col" class="number">${labels.meanPredicted}</th>
									<th scope="col" class="number">${labels.observedHeading}</th>
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
