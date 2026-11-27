import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ref } from 'lit/directives/ref.js';
import { repeat } from 'lit/directives/repeat.js';
import { resultsStyles } from '../../styles/results.styles';
import type { BinaryFlowView, ChartCaption, FlowOutcome, FlowRow } from './results-view-model';

/** Text supplied by the connected results view. */
export interface ConfusionFlowchartLabels {
	/** Names an actual class and how many held-out rows it has. */
	readonly rowHeading: (row: FlowRow, flow: BinaryFlowView) => string;
	/** One full sentence per outcome, including whether it is correct. */
	readonly outcome: (outcome: FlowOutcome, row: FlowRow, flow: BinaryFlowView) => string;
}

/** Empty labels: the parent supplies every string. */
export const DEFAULT_CONFUSION_FLOWCHART_LABELS: ConfusionFlowchartLabels = {
	rowHeading: () => '',
	outcome: () => ''
};

/**
 * Binary confusion matrix as two proportional rows. Each actual class is split into predicted
 * outcomes sized by count; full sentences carry the same information as text, and correct
 * outcomes are distinguished from errors by a solid rather than dashed outline and an icon,
 * not by colour alone.
 */
@customElement('app-confusion-flowchart')
export class AppConfusionFlowchart extends LitElement {
	static override styles = [
		resultsStyles,
		css`
			ul {
				margin: 0;
				padding: 0;
				list-style: none;
			}

			.rows {
				display: grid;
				gap: 1.25rem;
			}

			.heading {
				margin-block: 0 0.25rem;
				font-weight: 600;
			}

			.bar {
				display: flex;
				margin-block-end: 0.5rem;
				border-radius: 0.25rem;
				inline-size: 100%;
				overflow: hidden;
			}

			.segment {
				flex: none;
				box-sizing: border-box;
				block-size: 1.5rem;
			}

			.segment.correct {
				border: 2px solid var(--chart-axis);
				background-color: var(--blue-700);
			}

			.segment.wrong {
				border: 2px dashed var(--chart-axis);
				background-image: repeating-linear-gradient(
					135deg,
					var(--amber-700) 0 0.25rem,
					var(--surface) 0.25rem 0.5rem
				);
			}

			.outcomes {
				display: grid;
				gap: 0.25rem;
			}

			.outcomes li {
				display: flex;
				gap: 0.5rem;
			}

			.icon {
				flex: none;
				inline-size: 1.25rem;
				font-weight: 700;
				text-align: center;
			}
		`
	];

	/** Preformatted flow, or null while there is nothing to show. */
	@property({ attribute: false }) accessor flow: BinaryFlowView | null = null;
	/** Caption identifying the flowchart. */
	@property({ attribute: false }) accessor caption: ChartCaption | null = null;
	/** Localised text. */
	@property({ attribute: false }) accessor labels: ConfusionFlowchartLabels =
		DEFAULT_CONFUSION_FLOWCHART_LABELS;

	override render() {
		const flow = this.flow;
		if (!flow) return nothing;
		return html`
			<figure>
				<figcaption>
					<span class="caption-title">${this.caption?.title ?? ''}</span
					><span class="muted">${this.caption?.takeaway ?? ''}</span>
				</figcaption>
				<ul class="rows">
					${repeat(
						flow.rows,
						(row) => row.actualIndex,
						(row) => html`
							<li>
								<p class="heading">${this.labels.rowHeading(row, flow)}</p>
								<div class="bar" aria-hidden="true">
									${row.outcomes
										.filter((outcome) => outcome.count > 0)
										.map(
											(outcome) => html`
												<span
													class="segment ${outcome.correct
														? 'correct'
														: 'wrong'}"
													${ref((element) => {
														if (element instanceof HTMLElement) {
															element.style.inlineSize = `${outcome.share * 100}%`;
														}
													})}></span>
											`
										)}
								</div>
								<ul class="outcomes">
									${row.outcomes.map(
										(outcome) => html`
											<li>
												<span class="icon" aria-hidden="true">
													${outcome.correct ? '✓' : '✗'}
												</span>
												<span
													>${this.labels.outcome(
														outcome,
														row,
														flow
													)}</span
												>
											</li>
										`
									)}
								</ul>
							</li>
						`
					)}
				</ul>
			</figure>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'app-confusion-flowchart': AppConfusionFlowchart;
	}
}
