import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { tableStyles } from '../../styles/table.styles';
import { resultsStyles } from '../../styles/results.styles';
import { PlotController, type ChartLibrary, type ChartTokens } from './charts/plot-controller';
import type { ChartCaption } from './results-view-model';
import { integerTicks } from './charts/chart-encoding';

/** Counts of evaluated rows indexed by the number of correct models. */
export interface AgreementView {
	counts: readonly number[];
}
/** Text and plural-aware bucket labels supplied by the connected view. */
export interface InstanceAgreementLabels {
	correctModels: string;
	rowCount: string;
	showData: string;
	bucket: (correct: number) => string;
	xAxis: (totalModels: number) => string;
	yAxis: string;
	shareHeading: string;
	description: (counts: readonly number[]) => string;
}
/** Empty labels supplied until translations are provided. */
export const DEFAULT_INSTANCE_AGREEMENT_LABELS: InstanceAgreementLabels = {
	correctModels: '',
	rowCount: '',
	showData: '',
	bucket: () => '',
	xAxis: () => '',
	yAxis: '',
	shareHeading: '',
	description: () => ''
};

/** Chart and data table showing how many models predicted each row correctly. */
@customElement('app-instance-agreement')
export class AppInstanceAgreement extends LitElement {
	static override styles = [tableStyles, resultsStyles];
	@property({ attribute: false }) accessor counts: AgreementView | null = null;
	@property({ attribute: false }) accessor caption: ChartCaption | null = null;
	@property({ attribute: false }) accessor formatCount: (value: number) => string = String;
	@property({ attribute: false }) accessor formatPercent: (value: number) => string = String;
	@property({ attribute: false }) accessor labels: InstanceAgreementLabels =
		DEFAULT_INSTANCE_AGREEMENT_LABELS;
	private readonly plot = new PlotController(
		this,
		() => this.renderRoot.querySelector<HTMLElement>('.chart'),
		(chart, tokens, width) => this.draw(chart, tokens, width),
		() => 'description'
	);

	/** Resolves when the current chart is drawn or abandoned. */
	whenSettled(): Promise<void> {
		return this.updateComplete.then(() => this.plot.whenSettled());
	}

	private draw(chart: ChartLibrary, tokens: ChartTokens, width: number) {
		if (!this.counts || !this.caption) return null;
		const rows = this.counts.counts.map((count, index) => ({
			index,
			count,
			label: this.labels.bucket(index)
		}));
		return chart.plot({
			width,
			height: 220,
			x: { domain: rows.map((row) => row.index), label: this.labels.xAxis(rows.length - 1) },
			y: {
				label: this.labels.yAxis,
				zero: true,
				nice: true,
				ticks: integerTicks(0, Math.max(0, ...rows.map((row) => row.count))),
				grid: true,
				tickFormat: this.formatCount
			},
			ariaLabel: this.caption.title,
			ariaDescription: this.caption.takeaway,
			style: {
				background: 'transparent',
				color: tokens['--chart-axis'],
				fontSize: '0.8125rem'
			},
			marks: [
				chart.rectY(rows, {
					x: 'index',
					y1: 0,
					y2: 'count',
					fill: tokens['--chart-neutral'],
					inset: 2
				}),
				chart.text(rows, {
					x: 'index',
					y: 'count',
					text: (row: { count: number }) => this.formatCount(row.count),
					dy: -8,
					fill: tokens['--chart-axis']
				})
			]
		});
	}

	override render() {
		if (!this.counts || !this.caption) return nothing;
		return html` <figure>
			<figcaption>
				<span class="caption-title">${this.caption.title}</span>
				<span class="muted">${this.caption.takeaway}</span>
			</figcaption>
			<p id="description" class="visually-hidden">
				${this.labels.description(this.counts.counts)}
			</p>
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
								<th scope="col">${this.labels.correctModels}</th>
								<th scope="col">${this.labels.rowCount}</th>
								<th scope="col">${this.labels.shareHeading}</th>
							</tr>
						</thead>
						<tbody>
							${repeat(
								this.counts.counts,
								(_count, index) => index,
								(count, index) =>
									html` <tr>
										<th scope="row">${this.labels.bucket(index)}</th>
										<td class="number">${this.formatCount(count)}</td>
										<td class="number">
											${this.formatPercent(
												this.counts!.counts.reduce((a, b) => a + b, 0)
													? count /
															this.counts!.counts.reduce(
																(a, b) => a + b,
																0
															)
													: 0
											)}
										</td>
									</tr>`
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
		'app-instance-agreement': AppInstanceAgreement;
	}
}
