import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { resultsStyles } from '../../styles/results.styles';
import { tableStyles } from '../../styles/table.styles';
import { PlotController, type ChartLibrary, type ChartTokens } from './charts/plot-controller';
import { integerTicks, truncateLabel } from './charts/chart-encoding';
import type { ChartCaption, ThresholdView, ThresholdReadout } from './results-view-model';

/** Text supplied by the connected results view. */
export interface ThresholdExplorerLabels {
	/** Shown instead of the explorer when the model reports no probabilities. */
	readonly unavailable: string;
	/** Visible label of the slider. */
	readonly slider: string;
	/** Spoken value of the slider, built from the formatted threshold. */
	readonly valueText: (threshold: string, view: ThresholdView) => string;
	/** Always-visible sentence: exploring never changes the stored scores. */
	readonly notice: string;
	readonly threshold: string;
	/** Readout terms, named with the dataset's own class labels. */
	readonly truePositives: (view: ThresholdView) => string;
	readonly falsePositives: (view: ThresholdView) => string;
	readonly trueNegatives: (view: ThresholdView) => string;
	readonly falseNegatives: (view: ThresholdView) => string;
	readonly truePositiveRate: (view: ThresholdView) => string;
	readonly falsePositiveRate: (view: ThresholdView) => string;
	/** Name of a true-class facet and table column. */
	readonly trueClass: (label: string) => string;
	readonly cutoffLabel: (threshold: string) => string;
	readonly description: (view: ThresholdView, readout: ThresholdReadout) => string;
	readonly liveUpdate: (view: ThresholdView, readout: ThresholdReadout) => string;
	readonly rateWithCounts: (rate: string, hits: string, total: string) => string;
	readonly legendLabel: string;
	readonly xAxis: string;
	readonly yAxis: string;
	readonly showTable: string;
	readonly tableCaption: string;
	readonly rangeHeading: string;
	readonly range: (lower: string, upper: string) => string;
}

/** Empty labels: the parent supplies every string. */
export const DEFAULT_THRESHOLD_EXPLORER_LABELS: ThresholdExplorerLabels = {
	unavailable: '',
	slider: '',
	valueText: () => '',
	notice: '',
	threshold: '',
	truePositives: () => '',
	falsePositives: () => '',
	trueNegatives: () => '',
	falseNegatives: () => '',
	truePositiveRate: () => '',
	falsePositiveRate: () => '',
	trueClass: () => '',
	cutoffLabel: () => '',
	description: () => '',
	liveUpdate: () => '',
	rateWithCounts: () => '',
	legendLabel: '',
	xAxis: '',
	yAxis: '',
	showTable: '',
	tableCaption: '',
	rangeHeading: '',
	range: () => ''
};

/** Detail of `app-threshold-change`. */
export interface ThresholdChangeDetail {
	readonly index: number;
}

/**
 * Probability-threshold explorer for binary targets. A histogram of positive-class
 * probabilities, split by true class, shows where a cutoff falls; the readout lists the stored
 * counts and rates at that cutoff. Exploring never changes the model's stored scores.
 *
 * @fires app-threshold-change - The learner moved the slider; at most one event per frame.
 */
@customElement('app-threshold-explorer')
export class AppThresholdExplorer extends LitElement {
	static override styles = [
		tableStyles,
		resultsStyles,
		css`
			.control {
				display: grid;
				gap: 0.25rem;
				margin-block: 0.75rem;
			}

			input[type='range'] {
				inline-size: 100%;
				min-block-size: 1.5rem;
				accent-color: var(--chart-1);
			}

			.readout {
				display: grid;
				grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
				gap: 0.25rem 1.5rem;
				margin: 0 0 0.75rem;
			}

			.readout > div {
				display: flex;
				flex-wrap: wrap;
				justify-content: space-between;
				gap: 0.5rem;
			}

			.readout dt {
				color: var(--stone-700);
			}

			.readout dd {
				margin: 0;
				font-weight: 600;
			}
		`
	];

	/** Preformatted sweep, or null when the model reports no probabilities. */
	@property({ attribute: false }) accessor explorer: ThresholdView | null = null;
	/** Index into the stored cutoffs, 0 to 100; 50 is a cutoff of 0.50. */
	@property({ attribute: false }) accessor thresholdIndex = 50;
	/** Chart title and takeaway. */
	@property({ attribute: false }) accessor caption: ChartCaption | null = null;
	/** Formats a 0 to 1 value as a percentage. */
	@property({ attribute: false }) accessor formatPercent: (value: number) => string = String;
	/** Formats a whole count. */
	@property({ attribute: false }) accessor formatCount: (value: number) => string = String;
	/** Localised text. */
	@property({ attribute: false }) accessor labels: ThresholdExplorerLabels =
		DEFAULT_THRESHOLD_EXPLORER_LABELS;

	/** The slider position between the last input and the parent's confirmation. */
	@state() private accessor liveIndex: number | null = null;
	private pendingFrame = 0;
	private pendingIndex = 0;
	private announcementTimer: ReturnType<typeof setTimeout> | undefined;
	@state() private accessor announcement = '';

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

	override willUpdate(changed: PropertyValues<this>): void {
		// Keep the learner's newer slider position while an earlier value is still being confirmed.
		if (
			changed.has('thresholdIndex') &&
			(this.liveIndex === this.thresholdIndex || this.pendingFrame === 0)
		) {
			this.liveIndex = null;
		}
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		if (this.pendingFrame) cancelAnimationFrame(this.pendingFrame);
		this.pendingFrame = 0;
		clearTimeout(this.announcementTimer);
	}

	private get index(): number {
		const last = this.explorer?.lastIndex ?? 100;
		const raw = this.liveIndex ?? this.thresholdIndex;
		return Math.min(last, Math.max(0, Math.round(raw)));
	}

	private handleInput(event: Event): void {
		const value = Number((event.currentTarget as HTMLInputElement).value);
		this.liveIndex = value;
		this.pendingIndex = value;
		clearTimeout(this.announcementTimer);
		this.announcementTimer = setTimeout(() => {
			const view = this.explorer;
			const readout = view?.readouts[value];
			if (view && readout) this.announcement = this.labels.liveUpdate(view, readout);
		}, 250);
		if (this.pendingFrame) return;
		this.pendingFrame = requestAnimationFrame(() => {
			this.pendingFrame = 0;
			this.dispatchEvent(
				new CustomEvent<ThresholdChangeDetail>('app-threshold-change', {
					detail: { index: this.pendingIndex },
					bubbles: true,
					composed: true
				})
			);
		});
	}

	private draw(
		chart: ChartLibrary,
		tokens: ChartTokens,
		width: number,
		fontSize: number,
		measureText: (text: string) => number
	) {
		const view = this.explorer;
		if (!view || !this.caption) return null;
		const { labels } = this;
		const names = [view.negative, view.positive];
		const data = view.bins.flatMap((bin) => [
			{
				cls: view.negative,
				lower: bin.lower,
				upper: bin.upper,
				count: bin.negative,
				fill: tokens['--chart-neutral']
			},
			{
				cls: view.positive,
				lower: bin.lower,
				upper: bin.upper,
				count: bin.positive,
				fill: tokens['--chart-1']
			}
		]);
		const threshold = view.readouts[this.index]!.threshold;
		const marginLeft = Math.ceil(fontSize * 3);
		const marginRight = Math.ceil(
			Math.max(fontSize, measureText(this.formatPercent(1)) / 2 + 8)
		);
		const plotWidth = Math.max(1, width - marginLeft - marginRight);
		const cutoff = truncateLabel(
			labels.cutoffLabel(this.formatPercent(threshold)),
			Math.max(0, width - fontSize),
			measureText
		);
		const half = measureText(cutoff) / 2 + Math.ceil(fontSize / 2);
		const cutoffX = Math.max(
			(half - marginLeft) / plotWidth,
			Math.min((width - half - marginLeft) / plotWidth, threshold)
		);
		return chart.plot({
			width,
			height: 120 + 2 * 110,
			marginLeft,
			marginRight,
			marginTop: 32,
			marginBottom: 48,
			x: {
				domain: [0, 1],
				label: null,
				ticks: [0, 0.25, 0.5, 0.75, 1],
				tickFormat: this.formatPercent
			},
			y: {
				label: null,
				zero: true,
				nice: true,
				ticks: integerTicks(0, view.maxBinCount),
				grid: true,
				tickFormat: this.formatCount
			},
			fy: { domain: names, axis: null, padding: 0.35 },
			ariaLabel: this.caption.title,
			ariaDescription: this.caption.takeaway,
			style: {
				background: 'transparent',
				color: tokens['--chart-axis'],
				fontSize: '0.8125rem'
			},
			marks: [
				chart.rectY(data, {
					x1: 'lower',
					x2: 'upper',
					y: 'count',
					fy: 'cls',
					fill: 'fill',
					insetLeft: 0.5,
					insetRight: 0.5
				}),
				chart.ruleX([threshold], { stroke: tokens['--chart-axis'], strokeWidth: 2 }),
				chart.text([cutoff], {
					x: cutoffX,
					frameAnchor: 'top',
					text: (label: string) => label,
					fill: tokens['--chart-axis'],
					dy: -18
				}),
				chart.text(names, {
					fy: (name: string) => name,
					text: (name: string) => labels.trueClass(name),
					frameAnchor: 'top',
					textAnchor: 'middle',
					lineAnchor: 'bottom',
					lineWidth: Math.max(1, ((width - marginLeft - marginRight) / fontSize) * 0.7),
					dy: -4,
					fill: tokens['--chart-axis'],
					fontWeight: 600
				})
			]
		});
	}

	override render() {
		const view = this.explorer;
		const { labels } = this;
		if (!view) {
			return labels.unavailable ? html`<p>${labels.unavailable}</p>` : nothing;
		}
		if (!this.caption) return nothing;
		const index = this.index;
		const readout = view.readouts[index]!;
		const thresholdText = this.formatPercent(readout.threshold);
		return html`
			<figure>
				<figcaption>
					<span class="caption-title">${this.caption.title}</span>
					<span class="muted">${labels.description(view, readout)}</span>
				</figcaption>
				<p class="visually-hidden" id="description">${labels.description(view, readout)}</p>
				<p class="visually-hidden" aria-live="polite">${this.announcement}</p>
				<ul class="chart-legend" aria-label=${labels.legendLabel}>
					<li>
						<svg aria-hidden="true" width="16" height="16">
							<rect width="16" height="16" fill="var(--chart-neutral)"></rect></svg
						>${labels.trueClass(view.negative)}
					</li>
					<li>
						<svg aria-hidden="true" width="16" height="16">
							<rect width="16" height="16" fill="var(--chart-1)"></rect></svg
						>${labels.trueClass(view.positive)}
					</li>
				</ul>
				<p>${labels.yAxis}</p>
				<div class="chart"></div>
				<p>${labels.xAxis}</p>
				<div class="control">
					<label for="threshold">${labels.slider}</label>
					<input
						id="threshold"
						type="range"
						min="0"
						max=${view.lastIndex}
						step="1"
						.value=${String(index)}
						aria-valuetext=${labels.valueText(thresholdText, view)}
						@input=${this.handleInput} />
				</div>
				<p class="muted">${labels.notice}</p>
				<dl class="readout">
					<div>
						<dt>${labels.threshold}</dt>
						<dd>${thresholdText}</dd>
					</div>
					<div>
						<dt>${labels.truePositives(view)}</dt>
						<dd>${this.formatCount(readout.tp)}</dd>
					</div>
					<div>
						<dt>${labels.falsePositives(view)}</dt>
						<dd>${this.formatCount(readout.fp)}</dd>
					</div>
					<div>
						<dt>${labels.trueNegatives(view)}</dt>
						<dd>${this.formatCount(readout.tn)}</dd>
					</div>
					<div>
						<dt>${labels.falseNegatives(view)}</dt>
						<dd>${this.formatCount(readout.fn)}</dd>
					</div>
					<div>
						<dt>${labels.truePositiveRate(view)}</dt>
						<dd>
							${labels.rateWithCounts(
								this.formatPercent(readout.tpr),
								this.formatCount(readout.tp),
								this.formatCount(readout.tp + readout.fn)
							)}
						</dd>
					</div>
					<div>
						<dt>${labels.falsePositiveRate(view)}</dt>
						<dd>
							${labels.rateWithCounts(
								this.formatPercent(readout.fpr),
								this.formatCount(readout.fp),
								this.formatCount(readout.fp + readout.tn)
							)}
						</dd>
					</div>
				</dl>
				<details>
					<summary>${labels.showTable}</summary>
					<div class="table-region" role="region" tabindex="0" aria-labelledby="caption">
						<table class="table table-compact">
							<caption id="caption">
								${labels.tableCaption}
							</caption>
							<thead>
								<tr>
									<th scope="col">${labels.rangeHeading}</th>
									<th scope="col" class="number">
										${labels.trueClass(view.negative)}
									</th>
									<th scope="col" class="number">
										${labels.trueClass(view.positive)}
									</th>
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
											<td class="number">
												${this.formatCount(bin.negative)}
											</td>
											<td class="number">
												${this.formatCount(bin.positive)}
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
		'app-threshold-explorer': AppThresholdExplorer;
	}
}
