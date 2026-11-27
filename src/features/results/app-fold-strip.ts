import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { resultsStyles } from '../../styles/results.styles';
import { tableStyles } from '../../styles/table.styles';
import { modelSwatchStyles } from '../../styles/model-swatch.styles';
import { PlotController, type ChartLibrary, type ChartTokens } from './charts/plot-controller';
import {
	MODEL_COLOR_ENCODING,
	PLOT_SYMBOL_PATHS,
	computeAxisMargin,
	resolveModelMarkStyle,
	truncateLabel
} from './charts/chart-encoding';
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
	readonly xAxis: string;
	readonly intervalNote: string;
	readonly clampedNote: (mean: string, sd: string) => string;
	readonly description: (
		series: readonly FoldSeries[],
		baselines: readonly BaselineMark[]
	) => string;
	readonly legendLabel: string;
	readonly baselineColumn: string;
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
	standardDeviation: '',
	xAxis: '',
	intervalNote: '',
	clampedNote: () => '',
	description: () => '',
	legendLabel: '',
	baselineColumn: ''
};

/**
 * Dot-and-interval strip of held-out scores on a fixed 0 to 100% scale. Every dot, mean mark,
 * spread rule and baseline also appears in the native data table.
 */
@customElement('app-fold-strip')
export class AppFoldStrip extends LitElement {
	static override styles = [tableStyles, resultsStyles, modelSwatchStyles];

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
		(chart, tokens, width, fontSize, measureText) =>
			this.draw(chart, tokens, width, fontSize, measureText),
		() => 'description'
	);

	/** Resolves when the current chart has been drawn or abandoned. */
	whenSettled(): Promise<void> {
		return this.updateComplete.then(() => this.plot.whenSettled());
	}

	private seriesLabel(row: FoldSeries): string {
		return row.num === undefined ? row.label : `${row.num} ${row.label}`;
	}

	private draw(
		chart: ChartLibrary,
		tokens: ChartTokens,
		width: number,
		fontSize: number,
		measureText: (text: string) => number
	) {
		const rows = this.series;
		if (rows.length === 0 || !this.caption) return null;
		const count = rows.length;
		const indexed = rows.map((row, index) => ({
			row,
			index,
			colour: row.color ? resolveModelMarkStyle(row.color, tokens).fill : tokens['--chart-1']
		}));
		const spread = indexed.filter(({ row }) => row.sd !== null);
		const needsOutline = ({ row }: (typeof indexed)[number]) =>
			row.color !== undefined && MODEL_COLOR_ENCODING[row.color].outlineRequired;
		const outlinedSpread = spread.filter(needsOutline);
		const outlinedMeans = indexed.filter(needsOutline);
		const spreadRule = {
			y: ({ index }: (typeof indexed)[number]) => index,
			x1: ({ row }: (typeof indexed)[number]) => Math.max(0, row.mean - row.sd!),
			x2: ({ row }: (typeof indexed)[number]) => Math.min(1, row.mean + row.sd!)
		};
		const meanRule = {
			x: ({ row }: (typeof indexed)[number]) => row.mean,
			y1: ({ index }: (typeof indexed)[number]) => index - 0.25,
			y2: ({ index }: (typeof indexed)[number]) => index + 0.25
		};
		const spreadWidth = 3;
		const meanWidth = 4;
		const outlineWidth = 1.5;
		const sorted = [...this.baselines].sort((a, b) => a.value - b.value);
		const top = count - 0.4;
		const { margin, labelWidth } = computeAxisMargin(
			rows.map((row) => this.seriesLabel(row)),
			fontSize,
			width,
			measureText
		);
		const ticks = [0, 0.2, 0.4, 0.6, 0.8, 1];
		return chart.plot({
			width,
			height: 64 + count * 52,
			marginTop: sorted.length > 0 ? 34 : 14,
			marginBottom: 34,
			marginLeft: margin,
			marginRight: Math.ceil(fontSize * 1.5),
			x: {
				domain: [0, 1],
				label: null,
				tickFormat: this.formatPercent,
				ticks,
				grid: true
			},
			y: {
				domain: [-0.6, top],
				ticks: indexed.map(({ index }) => index),
				tickFormat: (index: number) =>
					truncateLabel(this.seriesLabel(rows[index]!), labelWidth, measureText),
				label: null
			},
			ariaLabel: this.caption.title,
			ariaDescription: this.caption.takeaway,
			style: {
				background: 'transparent',
				color: tokens['--chart-axis'],
				fontSize: '0.8125rem'
			},
			marks: [
				chart.ruleX(sorted, {
					x: 'value',
					stroke: tokens['--chart-neutral'],
					strokeDasharray: '5 4',
					strokeWidth: 1.5
				}),
				chart.ruleY(outlinedSpread, {
					...spreadRule,
					stroke: tokens['--stone-900'],
					strokeWidth: spreadWidth + 2 * outlineWidth,
					strokeLinecap: 'round'
				}),
				chart.ruleY(spread, {
					...spreadRule,
					stroke: ({ colour }: { colour: string }) => colour,
					strokeWidth: spreadWidth
				}),
				chart.ruleX(outlinedMeans, {
					...meanRule,
					stroke: tokens['--stone-900'],
					strokeWidth: meanWidth + 2 * outlineWidth,
					strokeLinecap: 'round'
				}),
				chart.ruleX(indexed, {
					...meanRule,
					stroke: ({ colour }: { colour: string }) => colour,
					strokeWidth: meanWidth
				}),
				...indexed.map(({ row, index }) => {
					const style = row.color ? resolveModelMarkStyle(row.color, tokens) : null;
					return chart.dot(row.values, {
						x: 'score',
						y: () => index,
						r: 5,
						symbol: style?.symbol ?? 'circle',
						fill: style?.dotFill ?? tokens['--chart-1'],
						stroke: style?.dotStroke ?? 'none',
						strokeWidth: style?.dotStrokeWidth ?? 1
					});
				}),
				chart.text(spread.length ? [this.labels.intervalNote] : [], {
					frameAnchor: 'top',
					text: (value: string) => value,
					fill: tokens['--chart-axis']
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
				<p class="visually-hidden" id="description">
					${labels.description(this.series, this.baselines)}
				</p>
				${this.series.some((row) => row.color)
					? html`<ul class="chart-legend" aria-label=${labels.legendLabel}>
							${repeat(
								this.series.filter((row) => row.color),
								(row) => row.id,
								(row) => {
									const encoding = MODEL_COLOR_ENCODING[row.color!];
									return html`<li>
										${row.num === undefined
											? nothing
											: html`<span
													class=${`swatch swatch-${row.color} ${encoding.outlineRequired ? 'amber' : ''}`}
													>${row.num}</span
												>`}
										<svg
											aria-hidden="true"
											viewBox="-8 -8 16 16"
											width="16"
											height="16">
											<path
												d=${PLOT_SYMBOL_PATHS[encoding.symbol]}
												fill=${encoding.stroked
													? 'none'
													: `var(${encoding.token})`}
												stroke=${encoding.stroked
													? `var(${encoding.token})`
													: encoding.outlineRequired
														? 'var(--stone-900)'
														: 'none'}
												stroke-width=${encoding.stroked
													? 2
													: encoding.outlineRequired
														? 1.5
														: 0}></path></svg
										>${row.label}
									</li>`;
								}
							)}
						</ul>`
					: nothing}
				${this.series
					.filter(
						(row) => row.sd !== null && (row.mean - row.sd < 0 || row.mean + row.sd > 1)
					)
					.map(
						(row) =>
							html`<p>
								${labels.clampedNote(
									formatPercent(row.mean),
									formatPercent(row.sd!)
								)}
							</p>`
					)}
				<div class="chart"></div>
				<p>${labels.xAxis}</p>
				${this.baselines.map(
					(mark) => html`<p>${mark.label}: ${formatPercent(mark.value)}</p>`
				)}
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
														${this.seriesLabel(row)}:
														${labels.partition(index + 1)}
													</th>
													<td class="number">
														${formatPercent(value.score)}
													</td>
													<td class="number">${value.timingLabel}</td>
												</tr>
											`
										)}
										<tr>
											<th scope="row">
												${this.seriesLabel(row)}: ${labels.mean}
											</th>
											<td class="number">${formatPercent(row.mean)}</td>
											<td></td>
										</tr>
										${row.sd === null
											? nothing
											: html`
													<tr>
														<th scope="row">
															${this.seriesLabel(row)}:
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
