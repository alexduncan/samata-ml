import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { resultsStyles } from '../../styles/results.styles';
import { tableStyles } from '../../styles/table.styles';
import { PlotController, type ChartLibrary, type ChartTokens } from './charts/plot-controller';
import {
	DATASET_CLASS_TOKENS,
	computeAxisMargin,
	integerTicks,
	truncateLabel
} from './charts/chart-encoding';
import type { ChartCaption, ClasseeView } from './results-view-model';

/** Text supplied by the connected results view. */
export interface ClasseeStripsLabels {
	readonly showTable: string;
	readonly tableCaption: string;
	readonly trueClass: string;
	readonly predictedClass: string;
	readonly count: string;
	readonly outcome: string;
	readonly correct: string;
	readonly error: string;
	/** Shown instead of an error side when no shown class has a wrong prediction. */
	readonly noErrors: string;
	/** Chart side labels. */
	readonly errorsSide: string;
	readonly correctSide: string;
	readonly xAxis: string;
	readonly yAxis: string;
	readonly legendLabel: string;
	readonly description: (view: ClasseeView) => string;
}

/** Empty labels: the parent supplies every string. */
export const DEFAULT_CLASSEE_STRIPS_LABELS: ClasseeStripsLabels = {
	showTable: '',
	tableCaption: '',
	trueClass: '',
	predictedClass: '',
	count: '',
	outcome: '',
	correct: '',
	error: '',
	noErrors: '',
	errorsSide: '',
	correctSide: '',
	xAxis: '',
	yAxis: '',
	legendLabel: '',
	description: () => ''
};

/**
 * Classee strips: one row per true class, correct predictions to the right of zero and errors
 * to the left, stacked by predicted class. The native table lists every non-zero cell.
 */
@customElement('app-classee-strips')
export class AppClasseeStrips extends LitElement {
	static override styles = [tableStyles, resultsStyles];

	/** Preformatted strips, or null while there is nothing to show. */
	@property({ attribute: false }) accessor strips: ClasseeView | null = null;
	/** Chart title and takeaway. */
	@property({ attribute: false }) accessor caption: ChartCaption | null = null;
	/** Formats a whole count. */
	@property({ attribute: false }) accessor formatCount: (value: number) => string = String;
	/** Localised text. */
	@property({ attribute: false }) accessor labels: ClasseeStripsLabels =
		DEFAULT_CLASSEE_STRIPS_LABELS;

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

	private draw(
		chart: ChartLibrary,
		tokens: ChartTokens,
		width: number,
		fontSize: number,
		measureText: (text: string) => number
	) {
		const view = this.strips;
		if (!view || !this.caption || view.rows.length === 0) return null;
		const surface = tokens['--surface'];
		const { margin: marginLeft, labelWidth } = computeAxisMargin(
			view.rows.map((row) => row.label),
			fontSize,
			width,
			measureText
		);
		const marginRight = 40;
		const min = -view.maxErrors;
		const max = Math.max(1, view.maxCorrect);
		const pixelsPerRow = (width - marginLeft - marginRight) / (max - min);
		const labels = view.rows.map((row) => row.label);
		const correct = view.rows.map((row) => ({
			label: row.label,
			x1: 0,
			x2: row.correct.count,
			text: row.correct.text
		}));
		const wrong = view.rows.flatMap((row) => {
			let cumulative = 0;
			return row.errors.map((segment) => {
				const x2 = -cumulative;
				cumulative += segment.count;
				return {
					label: row.label,
					x1: -cumulative,
					x2,
					fill: tokens[
						DATASET_CLASS_TOKENS[segment.predictedIndex % DATASET_CLASS_TOKENS.length]!
					],
					text: segment.predicted,
					wide: segment.count * pixelsPerRow >= measureText(segment.predicted) + fontSize
				};
			});
		});
		const mid = (d: { x1: number; x2: number }) => (d.x1 + d.x2) / 2;
		return chart.plot({
			width,
			height: 56 + view.rows.length * Math.max(30, fontSize * 2),
			marginTop: 24,
			marginBottom: 32,
			marginLeft,
			marginRight,
			x: {
				domain: [min, max],
				label: null,
				grid: true,
				ticks: integerTicks(min, max),
				tickFormat: (value: number) => this.formatCount(Math.abs(value))
			},
			y: {
				domain: labels,
				label: null,
				tickFormat: (label: string) => truncateLabel(label, labelWidth, measureText)
			},
			ariaLabel: this.caption.title,
			ariaDescription: this.caption.takeaway,
			style: {
				background: 'transparent',
				color: tokens['--chart-axis'],
				fontSize: '0.8125rem'
			},
			marks: [
				chart.barX(correct, {
					x1: 'x1',
					x2: 'x2',
					y: 'label',
					fill: tokens['--chart-neutral']
				}),
				chart.barX(wrong, {
					x1: 'x1',
					x2: 'x2',
					y: 'label',
					fill: 'fill',
					stroke: surface,
					strokeWidth: 1.5
				}),
				// Correct counts sit beyond the bar: white on the neutral grey would miss 4.5:1.
				chart.text(correct, {
					x: 'x2',
					y: 'label',
					text: 'text',
					textAnchor: 'start',
					dx: 4,
					fill: tokens['--chart-axis']
				}),
				chart.text(
					wrong.filter((d) => d.wide),
					{ x: mid, y: 'label', text: 'text', fill: surface }
				),
				chart.ruleX([0], { stroke: tokens['--chart-axis'], strokeWidth: 2 })
			]
		});
	}

	override render() {
		const view = this.strips;
		if (!view || !this.caption) return nothing;
		const { labels } = this;
		return html`
			<figure>
				<figcaption>
					<span class="caption-title">${this.caption.title}</span>
					<span class="muted">${this.caption.takeaway}</span>
				</figcaption>
				<p class="visually-hidden" id="description">${labels.description(view)}</p>
				<ul class="chart-legend" aria-label=${labels.legendLabel}>
					${view.legendClasses.map(
						({ classIndex, label }) =>
							html`<li>
								<svg aria-hidden="true" width="16" height="16">
									<rect
										width="16"
										height="16"
										fill=${`var(${DATASET_CLASS_TOKENS[classIndex % DATASET_CLASS_TOKENS.length]})`}></rect></svg
								>${label}
							</li>`
					)}
				</ul>
				${view.totalErrors === 0 ? html`<p>${labels.noErrors}</p>` : nothing}
				<p>${labels.yAxis}</p>
				<div class="chart-sides" dir="ltr">
					<span dir="auto">${view.totalErrors > 0 ? labels.errorsSide : nothing}</span>
					<span dir="auto">${labels.correctSide}</span>
				</div>
				<div class="chart"></div>
				<p>${labels.xAxis}</p>
				<details>
					<summary>${labels.showTable}</summary>
					<div class="table-region" role="region" tabindex="0" aria-labelledby="caption">
						<table class="table table-compact">
							<caption id="caption">
								${labels.tableCaption}
							</caption>
							<thead>
								<tr>
									<th scope="col">${labels.trueClass}</th>
									<th scope="col">${labels.predictedClass}</th>
									<th scope="col" class="number">${labels.count}</th>
									<th scope="col">${labels.outcome}</th>
								</tr>
							</thead>
							<tbody>
								${repeat(
									view.rows,
									(row) => row.classIndex,
									(row) => html`
										${[
											{ segment: row.correct, correct: true },
											...row.errors.map((segment) => ({
												segment,
												correct: false
											}))
										]
											.filter(({ segment }) => segment.count > 0)
											.map(
												({ segment, correct }) => html`
													<tr>
														<th scope="row">${row.label}</th>
														<td>${segment.predicted}</td>
														<td class="number">${segment.text}</td>
														<td>
															${correct
																? labels.correct
																: labels.error}
														</td>
													</tr>
												`
											)}
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
		'app-classee-strips': AppClasseeStrips;
	}
}
