import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { resultsStyles } from '../../styles/results.styles';
import { tableStyles } from '../../styles/table.styles';
import { PlotController, type ChartLibrary, type ChartTokens } from './charts/plot-controller';
import type { ChartCaption } from './results-view-model';
import type { RopeView } from './analysis-protocol';

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
	showData: ''
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
		(chart, tokens, width) => this.draw(chart, tokens, width)
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
		const labels = [this.labels.aHigher, this.labels.equivalent, this.labels.bHigher];
		let start = 0;
		return whole.map((value, index) => {
			const item = { id: index, label: labels[index]!, value, start, end: start + value };
			start += value;
			return item;
		});
	}

	private draw(chart: ChartLibrary, tokens: ChartTokens, width: number) {
		if (this.status !== 'ready' || !this.result || !this.caption) return null;
		const colours = [tokens['--chart-1'], tokens['--chart-2'], tokens['--chart-3']];
		const values = this.values().map((item) => ({ ...item, colour: colours[item.id] }));
		return chart.plot({
			width,
			height: 90,
			marginLeft: 10,
			marginRight: 10,
			x: { domain: [0, 100], axis: null },
			y: { axis: null },
			ariaLabel: this.caption.title,
			ariaDescription: this.caption.takeaway,
			style: { background: 'transparent', color: tokens['--chart-axis'] },
			marks: [
				chart.rectY(values, { x1: 'start', x2: 'end', y1: 0, y2: 1, fill: 'colour' }),
				chart.text(values, {
					x: (item: { start: number; end: number }) => (item.start + item.end) / 2,
					y: 0.5,
					text: (item: { label: string; value: number }) =>
						`${item.label}: ${this.formatPercent(item.value / 100)}`,
					fill: tokens['--chart-axis']
				})
			]
		});
	}

	private changeWidth(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		this.invalid = !input.validity.valid || !Number.isFinite(input.valueAsNumber);
		if (!this.invalid)
			this.dispatchEvent(
				new CustomEvent<RopeWidthChangeDetail>('app-rope-width-change', {
					detail: { ropeWidth: input.valueAsNumber },
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
				min="0.001"
				max="0.1"
				step="0.001"
				.value=${String(this.ropeWidth)}
				aria-invalid=${this.invalid ? 'true' : 'false'}
				aria-describedby="width-error"
				@input=${this.changeWidth} />
			<p id="width-error">${this.invalid ? this.labels.invalidWidth : nothing}</p>
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
										</tr>
									</thead>
									<tbody>
										${repeat(
											this.values(),
											(value) => value.id,
											(value) =>
												html`<tr>
													<th scope="row">${value.label}</th>
													<td>
														${this.formatPercent(value.value / 100)}
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
