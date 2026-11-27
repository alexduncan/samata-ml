import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { PlotController } from '../../src/features/results/charts/plot-controller';

/** Story-only host proving the shared Plot controller inside a shadow root. */
@customElement('storybook-plot-host')
export class StorybookPlotHost extends LitElement {
	static override styles = css`
		:host {
			display: block;
		}
		:host([hidden]) {
			display: none;
		}
		.chart {
			inline-size: 100%;
		}
	`;

	/** Scores plotted as dots on a fixed 0 to 1 domain. */
	@property({ attribute: false }) accessor values: readonly number[] = [0.4, 0.6, 0.8];

	/** Number of renders performed, exposed for acceptance tests. */
	renderCount = 0;

	private readonly plot = new PlotController(
		this,
		() => this.renderRoot.querySelector<HTMLElement>('.chart'),
		(chart, tokens, width, fontSizePx, measureText) => {
			this.renderCount += 1;
			this.dataset.width = String(width);
			this.dataset.fontSize = String(fontSizePx);
			this.dataset.wideText = String(measureText('WWWW'));
			this.dataset.narrowText = String(measureText('iiii'));
			return chart.plot({
				width,
				height: 80,
				x: { domain: [0, 1], label: null },
				marginLeft: 8,
				marginRight: 8,
				ariaLabel: 'Example scores',
				ariaDescription: 'Three scores between 40% and 80%.',
				style: { background: 'transparent' },
				marks: [
					chart.ruleY([0], { stroke: tokens['--chart-grid'] }),
					chart.dot(this.values, { x: (d: number) => d, y: 0, fill: tokens['--chart-1'] })
				]
			});
		},
		() => 'chart-description'
	);

	/** Resolves when the first visible render has completed. */
	whenSettled(): Promise<void> {
		return this.updateComplete.then(() => this.plot.whenSettled());
	}

	override render() {
		return html`<p id="chart-description">Three scores between 40% and 80%.</p>
			<div class="chart"></div>`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'storybook-plot-host': StorybookPlotHost;
	}
}
