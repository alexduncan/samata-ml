import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { resultsStyles } from '../../styles/results.styles';
import { tableStyles } from '../../styles/table.styles';
import { PlotController, type ChartLibrary, type ChartTokens } from './charts/plot-controller';
import type { ChartCaption } from './results-view-model';
import type { RopeView } from './analysis-protocol';
import type { ModelColor } from '../../types/state';
import { modelSwatchStyles } from '../../styles/model-swatch.styles';
import { resolveModelMarkStyle } from './charts/chart-encoding';

/** Model identity shown with a posterior outcome. */
export interface RopeModelIdentity {
	readonly num: number;
	readonly label: string;
	readonly modelColor: ModelColor;
}

/** Localised text for the posterior and width control. */
export interface RopeBarLabels {
	width: string;
	invalidWidth: string;
	aHigher: string;
	equivalent: string;
	bHigher: string;
	loading: string;
	unavailable: string;
	error: string;
	retry: string;
	outcome: string;
	probability: string;
	showData: string;
	xAxis: string;
	frequencyHeading: string;
	inHundred: (count: number) => string;
	description: (a: string, b: string, aPct: number, eqPct: number, bPct: number) => string;
	liveStatus: (status: string, summary: string) => string;
	modelHigher: (label: string) => string;
}
/** Empty labels supplied until translations are provided. */
export const DEFAULT_ROPE_BAR_LABELS: RopeBarLabels = {
	width: '',
	invalidWidth: '',
	aHigher: '',
	equivalent: '',
	bHigher: '',
	loading: '',
	unavailable: '',
	error: '',
	retry: '',
	outcome: '',
	probability: '',
	showData: '',
	xAxis: '',
	frequencyHeading: '',
	inHundred: () => '',
	description: () => '',
	liveStatus: () => '',
	modelHigher: () => ''
};
/** Committed practical-equivalence width. */
export interface RopeWidthChangeDetail {
	ropeWidth: number;
}
/** Retry event detail. */
export type RopeRetryDetail = Record<string, never>;

/**
 * Displays the three posterior probabilities and a practical-equivalence width control.
 * @fires app-rope-width-change - A valid width was entered.
 * @fires app-rope-retry - The learner requested another analysis.
 */
@customElement('app-rope-bar')
export class AppRopeBar extends LitElement {
	static override styles = [
		tableStyles,
		resultsStyles,
		modelSwatchStyles,
		css`
			input,
			button {
				font-family: inherit;
			}
			button:focus-visible {
				outline: 2px solid var(--focus-ring);
				outline-offset: 2px;
			}
		`
	];
	@property({ attribute: false }) accessor result: RopeView | null = null;
	@property({ attribute: false }) accessor ropeWidth = 0.01;
	@property({ attribute: false }) accessor modelA: RopeModelIdentity | null = null;
	@property({ attribute: false }) accessor modelB: RopeModelIdentity | null = null;
	@property({ attribute: false }) accessor status:
		| 'idle'
		| 'loading'
		| 'ready'
		| 'error'
		| 'unavailable' = 'idle';
	@property({ attribute: false }) accessor caption: ChartCaption | null = null;
	@property({ attribute: false }) accessor formatPercent: (value: number) => string = String;
	@property({ attribute: false }) accessor labels: RopeBarLabels = DEFAULT_ROPE_BAR_LABELS;
	@state() private accessor invalid = false;
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

	private values() {
		if (!this.result) return [];
		const values = [
			this.result.probabilityHigher,
			this.result.probabilityEquivalent,
			this.result.probabilityLower
		];
		const whole = values.map((value) => Math.floor(value * 100));
		const remaining = 100 - whole.reduce((sum, value) => sum + value, 0);
		const order = values
			.map((value, index) => ({ index, fraction: value * 100 - whole[index]! }))
			.toSorted((a, b) => b.fraction - a.fraction || a.index - b.index);
		for (let index = 0; index < remaining; index++) whole[order[index]!.index]!++;
		const labels = [
			this.modelA ? this.labels.modelHigher(this.modelA.label) : this.labels.aHigher,
			this.labels.equivalent,
			this.modelB ? this.labels.modelHigher(this.modelB.label) : this.labels.bHigher
		];
		let start = 0;
		return whole.map((value, index) => {
			const item = {
				id: index,
				label: labels[index]!,
				value,
				start: start / 100,
				end: (start + value) / 100
			};
			start += value;
			return item;
		});
	}

	private draw(chart: ChartLibrary, tokens: ChartTokens, width: number) {
		if (this.status !== 'ready' || !this.result || !this.caption) return null;
		const styles = [
			this.modelA ? resolveModelMarkStyle(this.modelA.modelColor, tokens) : null,
			null,
			this.modelB ? resolveModelMarkStyle(this.modelB.modelColor, tokens) : null
		];
		const values = this.values().map((item) => ({
			...item,
			colour: styles[item.id]?.fill ?? tokens['--chart-neutral'],
			ink: styles[item.id]?.ink ?? tokens['--model-swatch-ink'],
			stroke: styles[item.id]?.barStroke ?? tokens['--surface'],
			strokeWidth: styles[item.id]?.barStrokeWidth ?? 1
		}));
		return chart.plot({
			width,
			height: 120,
			marginLeft: 40,
			marginRight: 40,
			x: {
				domain: [0, 1],
				ticks: [0, 0.25, 0.5, 0.75, 1],
				label: this.labels.xAxis,
				tickFormat: this.formatPercent
			},
			y: { axis: null },
			ariaLabel: this.caption.title,
			ariaDescription: this.caption.takeaway,
			style: {
				background: 'transparent',
				color: tokens['--chart-axis'],
				fontSize: '0.8125rem'
			},
			marks: [
				chart.rectY(values, {
					x1: 'start',
					x2: 'end',
					y1: 0,
					y2: 1,
					fill: 'colour',
					stroke: 'stroke',
					strokeWidth: 'strokeWidth',
					insetLeft: 1,
					insetRight: 1
				}),
				chart.text(
					values.filter((item) => item.end - item.start >= 0.18),
					{
						x: (item: { start: number; end: number }) => (item.start + item.end) / 2,
						y: 0.5,
						text: (item: { value: number }) => this.formatPercent(item.value / 100),
						fill: 'ink'
					}
				)
			]
		});
	}

	private changeWidth(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		const points = input.valueAsNumber;
		this.invalid =
			!input.validity.valid ||
			!Number.isFinite(points) ||
			points < 0.1 ||
			points > 10 ||
			Math.abs(points * 10 - Math.round(points * 10)) >= 1e-9;
		if (!this.invalid)
			this.dispatchEvent(
				new CustomEvent<RopeWidthChangeDetail>('app-rope-width-change', {
					detail: { ropeWidth: Math.round(points * 10) / 1000 },
					bubbles: true,
					composed: true
				})
			);
	}
	private retry(): void {
		this.dispatchEvent(
			new CustomEvent<RopeRetryDetail>('app-rope-retry', {
				detail: {},
				bubbles: true,
				composed: true
			})
		);
	}

	override render() {
		return html`
			<label for="width">${this.labels.width}</label>
			<input
				id="width"
				type="number"
				required
				min="0.1"
				max="10"
				step="0.1"
				.value=${String(Math.round(this.ropeWidth * 1000) / 10)}
				aria-invalid=${this.invalid ? 'true' : 'false'}
				aria-describedby="width-error"
				@input=${this.changeWidth} />
			<p id="width-error">${this.invalid ? this.labels.invalidWidth : nothing}</p>
			<p class="visually-hidden" aria-live="polite">
				${this.labels.liveStatus(
					this.status === 'loading'
						? this.labels.loading
						: this.status === 'error'
							? this.labels.error
							: this.status === 'unavailable'
								? this.labels.unavailable
								: '',
					this.status === 'ready' ? (this.caption?.takeaway ?? '') : ''
				)}
			</p>
			${this.status === 'loading' ? html`<p>${this.labels.loading}</p>` : nothing}
			${this.status === 'unavailable' ? html`<p>${this.labels.unavailable}</p>` : nothing}
			${this.status === 'error'
				? html`<p>${this.labels.error}</p>
						<button type="button" @click=${this.retry}>${this.labels.retry}</button>`
				: nothing}
			${this.status === 'ready' && this.result && this.caption
				? html` <figure>
						<figcaption>
							<span class="caption-title">${this.caption.title}</span>
							<span class="muted">${this.caption.takeaway}</span>
						</figcaption>
						<p id="description" class="visually-hidden">
							${this.labels.description(
								this.modelA?.label ?? this.labels.aHigher,
								this.modelB?.label ?? this.labels.bHigher,
								this.result.probabilityHigher,
								this.result.probabilityEquivalent,
								this.result.probabilityLower
							)}
						</p>
						<ul class="chart-legend">
							${this.values().map((value) => {
								const model =
									value.id === 0
										? this.modelA
										: value.id === 2
											? this.modelB
											: null;
								return html`<li>
									${model
										? html`<span
												class=${`swatch swatch-${model.modelColor} ${model.modelColor === 'amber' ? 'amber' : ''}`}
												aria-hidden="true"
												>${model.num}</span
											>`
										: nothing}
									${value.label}: ${this.formatPercent(value.value / 100)}
									(${this.labels.inHundred(value.value)})
								</li>`;
							})}
						</ul>
						<div class="chart"></div>
						<details>
							<summary>${this.labels.showData}</summary>
							<div
								class="table-region"
								role="region"
								tabindex="0"
								aria-labelledby="caption">
								<table class="table table-compact">
									<caption id="caption">
										${this.caption.title}
									</caption>
									<thead>
										<tr>
											<th scope="col">${this.labels.outcome}</th>
											<th scope="col">${this.labels.probability}</th>
											<th scope="col">${this.labels.frequencyHeading}</th>
										</tr>
									</thead>
									<tbody>
										${repeat(
											this.values(),
											(value) => value.id,
											(value) =>
												html`<tr>
													<th scope="row">${value.label}</th>
													<td class="number">
														${this.formatPercent(value.value / 100)}
													</td>
													<td class="number">
														${this.labels.inHundred(value.value)}
													</td>
												</tr>`
										)}
									</tbody>
								</table>
							</div>
						</details>
					</figure>`
				: nothing}
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'app-rope-bar': AppRopeBar;
	}
}
