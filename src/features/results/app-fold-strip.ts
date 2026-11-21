import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { resultsStyles } from '../../styles/results.styles';
import { tableStyles } from '../../styles/table.styles';
import { PlotController, type ChartLibrary, type ChartTokens } from './charts/plot-controller';
import type { BaselineMark, ChartCaption, FoldSeries } from './results-view-model';

/** Text supplied by the connected results view. */
export interface FoldStripLabels {
	readonly showTable: string;
	readonly tableCaption: string;
	readonly series: string;
	readonly partition: (index: number) => string;
	readonly score: string;
	readonly time: string;
	readonly mean: string;
	readonly standardDeviation: string;
}

/** Empty labels: the parent supplies every string. */
export const DEFAULT_FOLD_STRIP_LABELS: FoldStripLabels = {
	showTable: '',
	tableCaption: '',
	series: '',
	partition: () => '',
	score: '',
	time: '',
	mean: '',
	standardDeviation: ''
};

const SERIES_TOKENS = [
	'--chart-1',
	'--chart-2',
	'--chart-3',
	'--chart-4',
	'--chart-5',
	'--chart-6'
] as const;

/**
 * Dot-and-interval strip of held-out scores on a fixed 0 to 100% scale. Every dot, mean mark,
 * spread rule and baseline also appears in the native data table.
 */
@customElement('app-fold-strip')
export class AppFoldStrip extends LitElement {
	static override styles = [tableStyles, resultsStyles];

	/** Rows of dots, one per model. */
	@property({ attribute: false }) accessor series: readonly FoldSeries[] = [];
	/** Dashed baseline rules. */
	@property({ attribute: false }) accessor baselines: readonly BaselineMark[] = [];
	/** Chart title and takeaway. */
	@property({ attribute: false }) accessor caption: ChartCaption | null = null;
	/** Formats a 0 to 1 score as a percentage. */
	@property({ attribute: false }) accessor formatPercent: (value: number) => string = String;
	/** Localised text. */
	@property({ attribute: false }) accessor labels: FoldStripLabels = DEFAULT_FOLD_STRIP_LABELS;

	private readonly plot = new PlotController(
		this,
		() => this.renderRoot.querySelector<HTMLElement>('.chart'),
		(chart, tokens, width) => this.draw(chart, tokens, width)
	);

	/** Resolves when the current chart has been drawn or abandoned. */
	whenSettled(): Promise<void> {
		return this.updateComplete.then(() => this.plot.whenSettled());
	}

	private draw(chart: ChartLibrary, tokens: ChartTokens, width: number) {
		const rows = this.series;
		if (rows.length === 0 || !this.caption) return null;
		const count = rows.length;
		const indexed = rows.map((row, index) => ({
			row,
			index,
			colour: tokens[SERIES_TOKENS[index % SERIES_TOKENS.length]!]
		}));
		const dots = indexed.flatMap(({ row, index, colour }) =>
			row.values.map((value) => ({ score: value.score, index, colour }))
		);
		const spread = indexed.filter(({ row }) => row.sd !== null);
		const sorted = [...this.baselines].sort((a, b) => a.value - b.value);
		const top = count - 0.4;
		return chart.plot({
			width,
			height: 64 + count * 52,
			marginTop: sorted.length > 0 ? 34 : 14,
			marginBottom: 34,
			marginLeft: 14,
			marginRight: 14,
			x: {
				domain: [0, 1],
				label: null,
				tickFormat: this.formatPercent,
				ticks: [0, 0.25, 0.5, 0.75, 1]
			},
			y: { domain: [-0.6, top], axis: null },
			ariaLabel: this.caption.title,
			ariaDescription: this.caption.takeaway,
			style: {
				background: 'transparent',
				color: tokens['--chart-axis'],
				fontSize: '0.8125rem'
			},
			marks: [
				chart.ruleX([0, 0.25, 0.5, 0.75, 1], { stroke: tokens['--chart-grid'] }),
				chart.ruleX(sorted, {
					x: 'value',
					stroke: tokens['--chart-neutral'],
					strokeDasharray: '5 4',
					strokeWidth: 1.5
				}),
				chart.text(sorted.slice(0, 1), {
					x: 'value',
					y: top,
					text: 'label',
					fill: tokens['--chart-axis'],
					textAnchor: 'end',
					dx: -4,
					dy: -8
				}),
				chart.text(sorted.slice(1), {
					x: 'value',
					y: top,
					text: 'label',
					fill: tokens['--chart-axis'],
					textAnchor: 'start',
					dx: 4,
					dy: -8
				}),
				chart.ruleY(spread, {
					y: ({ index }: { index: number }) => index,
					x1: ({ row }: { row: FoldSeries }) => Math.max(0, row.mean - row.sd!),
					x2: ({ row }: { row: FoldSeries }) => Math.min(1, row.mean + row.sd!),
					stroke: ({ colour }: { colour: string }) => colour,
					strokeWidth: 3
				}),
				chart.ruleX(indexed, {
					x: ({ row }: { row: FoldSeries }) => row.mean,
					y1: ({ index }: { index: number }) => index - 0.25,
					y2: ({ index }: { index: number }) => index + 0.25,
					stroke: ({ colour }: { colour: string }) => colour,
					strokeWidth: 4
				}),
				chart.dot(dots, {
					x: 'score',
					y: 'index',
					r: 5,
					fill: 'colour',
					stroke: 'none',
					fillOpacity: 0.85
				}),
				chart.text(count > 1 ? indexed : [], {
					x: 0,
					y: ({ index }: { index: number }) => index,
					text: ({ row }: { row: FoldSeries }) => row.label,
					fill: tokens['--chart-axis'],
					textAnchor: 'start',
					dy: -16
				})
			]
		});
	}

	override render() {
		if (this.series.length === 0 || !this.caption) return nothing;
		const { labels, formatPercent } = this;
		return html`
			<figure>
				<figcaption>
					<span class="caption-title">${this.caption.title}</span>
					<span class="muted">${this.caption.takeaway}</span>
				</figcaption>
				<div class="chart"></div>
				<details>
					<summary>${labels.showTable}</summary>
					<div class="table-region" role="region" tabindex="0" aria-labelledby="caption">
						<table class="table table-compact">
							<caption id="caption">
								${labels.tableCaption}
							</caption>
							<thead>
								<tr>
									<th scope="col">${labels.series}</th>
									<th scope="col" class="number">${labels.score}</th>
									<th scope="col" class="number">${labels.time}</th>
								</tr>
							</thead>
							<tbody>
								${repeat(
									this.series,
									(row) => row.id,
									(row) => html`
										${row.values.map(
											(value, index) => html`
												<tr>
													<th scope="row">
														${row.label}: ${labels.partition(index + 1)}
													</th>
													<td class="number">
														${formatPercent(value.score)}
													</td>
													<td class="number">${value.timingLabel}</td>
												</tr>
											`
										)}
										<tr>
											<th scope="row">${row.label}: ${labels.mean}</th>
											<td class="number">${formatPercent(row.mean)}</td>
											<td></td>
										</tr>
										${row.sd === null
											? nothing
											: html`
													<tr>
														<th scope="row">
															${row.label}:
															${labels.standardDeviation}
														</th>
														<td class="number">
															${formatPercent(row.sd)}
														</td>
														<td></td>
													</tr>
												`}
									`
								)}
								${repeat(
									this.baselines,
									(mark) => mark.id,
									(mark) => html`
										<tr>
											<th scope="row">${mark.label}</th>
											<td class="number">${formatPercent(mark.value)}</td>
											<td></td>
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
		'app-fold-strip': AppFoldStrip;
	}
}
