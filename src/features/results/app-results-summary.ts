import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { notificationStyles } from '../../styles/notification.styles';
import { resultsStyles } from '../../styles/results.styles';
import type { MetricUnavailableReason } from '../../types/model-evaluation';
import type { MoreMetricId, ResultsSummaryView } from './results-view-model';

/** Text supplied by the connected results view. */
export interface ResultsSummaryLabels {
	/** Model, dataset, target, protocol and evaluated rows, as one sentence. */
	readonly runLine: (view: ResultsSummaryView) => string;
	/** One-Shot fit time or the cross-validation fit-and-scoring total. */
	readonly timeLine: (view: ResultsSummaryView) => string;
	readonly balancedAccuracy: string;
	/** The headline value; for cross-validation the mean and its SD. */
	readonly balancedAccuracyValue: (view: ResultsSummaryView) => string;
	/** SD and IQR for cross-validation, or the no-spread sentence for one test split. */
	readonly spreadLine: (view: ResultsSummaryView) => string;
	readonly accuracy: string;
	/** The most-frequent baseline and the signed difference. */
	readonly baselineLine: (view: ResultsSummaryView) => string;
	readonly macroF1: string;
	readonly moreMetrics: string;
	readonly metricNames: Readonly<Record<MoreMetricId, string>>;
	readonly reasons: Readonly<Record<MetricUnavailableReason, string>>;
	readonly gapTitle: string;
	readonly gapText: (gap: NonNullable<ResultsSummaryView['gap']>) => string;
}

const emptyMetricNames: Record<MoreMetricId, string> = {
	macroF1: '',
	mcc: '',
	rocAuc: '',
	averagePrecision: '',
	logLoss: '',
	brier: '',
	ece: ''
};

const emptyReasons: Record<MetricUnavailableReason, string> = {
	'not-requested': '',
	'probabilities-unavailable': '',
	'unseen-validation-labels': '',
	'undefined-for-validation-classes': '',
	'all-targets-zero': '',
	'negative-targets': '',
	'not-applicable': '',
	'insufficient-degrees-of-freedom': '',
	'single-class': ''
};

/** Empty labels: the parent supplies every string. */
export const DEFAULT_RESULTS_SUMMARY_LABELS: ResultsSummaryLabels = {
	runLine: () => '',
	timeLine: () => '',
	balancedAccuracy: '',
	balancedAccuracyValue: () => '',
	spreadLine: () => '',
	accuracy: '',
	baselineLine: () => '',
	macroF1: '',
	moreMetrics: '',
	metricNames: emptyMetricNames,
	reasons: emptyReasons,
	gapTitle: '',
	gapText: () => ''
};

/** Detail of `app-results-more-toggle`. */
export interface ResultsMoreToggleDetail {
	readonly open: boolean;
}

/**
 * Run line, headline scores, train-test gap card and the "More metrics" disclosure.
 *
 * @fires app-results-more-toggle - The learner opened or closed "More metrics".
 */
@customElement('app-results-summary')
export class AppResultsSummary extends LitElement {
	static override styles = [
		notificationStyles,
		resultsStyles,
		css`
			.run,
			.time {
				margin-block: 0 0.75rem;
			}

			.headline {
				display: grid;
				grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
				gap: 1rem;
				margin-block: 0 1rem;
			}

			.headline > div {
				border: 1px solid var(--stone-300);
				border-radius: 0.25rem;
				padding: 0.75rem;
			}

			.headline dt {
				color: var(--stone-700);
			}

			.headline dd {
				margin: 0;
			}

			.headline .value {
				font-weight: 600;
				font-size: 1.75rem;
				line-height: 1.2;
			}

			.headline .primary {
				border-width: 2px;
			}

			.more dl {
				display: grid;
				grid-template-columns: max-content 1fr;
				gap: 0.25rem 1rem;
				margin: 0.5rem 0 0;
			}

			.more dd {
				margin: 0;
			}

			.notification {
				display: block;
			}
		`
	];

	/** Preformatted summary, or null while there is nothing to show. */
	@property({ attribute: false }) accessor summary: ResultsSummaryView | null = null;
	/** Whether the "More metrics" disclosure is open. */
	@property({ attribute: false }) accessor moreOpen = false;
	/** Localised text. */
	@property({ attribute: false }) accessor labels: ResultsSummaryLabels =
		DEFAULT_RESULTS_SUMMARY_LABELS;

	private emittedOpen = false;

	override willUpdate(changed: PropertyValues<this>): void {
		if (changed.has('moreOpen')) this.emittedOpen = this.moreOpen;
	}

	private handleToggle(event: Event): void {
		const { open } = event.currentTarget as HTMLDetailsElement;
		if (open === this.moreOpen || open === this.emittedOpen) return;
		this.emittedOpen = open;
		this.dispatchEvent(
			new CustomEvent<ResultsMoreToggleDetail>('app-results-more-toggle', {
				detail: { open },
				bubbles: true,
				composed: true
			})
		);
	}

	override render() {
		const view = this.summary;
		if (!view) return nothing;
		const { labels } = this;
		return html`
			<p class="run">${labels.runLine(view)}</p>
			<dl class="headline">
				<div class="primary">
					<dt>${labels.balancedAccuracy}</dt>
					<dd class="value">${labels.balancedAccuracyValue(view)}</dd>
					<dd class="muted">${labels.spreadLine(view)}</dd>
				</div>
				<div>
					<dt>${labels.accuracy}</dt>
					<dd class="value">${view.accuracy}</dd>
					<dd class="muted">${labels.baselineLine(view)}</dd>
				</div>
				${view.macroF1 === null
					? nothing
					: html`
							<div>
								<dt>${labels.macroF1}</dt>
								<dd class="value">${view.macroF1}</dd>
							</div>
						`}
			</dl>
			<p class="time">${labels.timeLine(view)}</p>
			${view.gap
				? html`
						<div class="notification notification-alert">
							<p class="notification-text">
								<strong>${labels.gapTitle}</strong>
								${labels.gapText(view.gap)}
							</p>
						</div>
					`
				: nothing}
			<details class="more" ?open=${this.moreOpen} @toggle=${this.handleToggle}>
				<summary>${labels.moreMetrics}</summary>
				<dl>
					${repeat(
						view.more,
						(row) => row.id,
						(row) => html`
							<dt>${labels.metricNames[row.id]}</dt>
							<dd>
								${row.value ?? (row.reason ? labels.reasons[row.reason] : nothing)}
							</dd>
						`
					)}
				</dl>
			</details>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'app-results-summary': AppResultsSummary;
	}
}
