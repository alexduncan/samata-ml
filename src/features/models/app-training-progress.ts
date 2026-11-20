import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { trainModelStyles } from '../../styles/train-model.styles';
import type { TrainingLogEntry } from '../../types/model-result';
import type { TrainingProgress } from '../../types/state';

/** Visible and accessible labels supplied by the connected training view. */
export interface TrainingProgressLabels {
	readonly progress: string;
	readonly waiting: string;
	readonly formatEntry: (entry: TrainingLogEntry) => string;
}

const defaultLabels: TrainingProgressLabels = {
	progress: 'Training progress',
	waiting: 'Waiting to train',
	formatEntry: ({ message }) => {
		switch (message.key) {
			case 'phase':
				return message.phase;
			case 'fold-start':
				return `Starting fold ${message.fold} of ${message.folds}`;
			case 'fold-complete':
				return `Fold ${message.fold} complete`;
			case 'warning':
				return message.code === 'worker-retried'
					? 'A worker was retried'
					: 'Training is using reduced-performance mode';
			case 'preparing':
				return 'Preparing data';
			case 'refit-start':
				return 'Refitting on all eligible rows';
			case 'refit-complete':
				return 'Refit complete';
			case 'saving':
				return 'Saving results';
			case 'completed':
				return 'Training complete';
			case 'cancelled':
				return 'Training cancelled';
			case 'failed':
				return 'Training failed';
		}
	}
};

/**
 * Displays one native progress indicator, its status and an inspectable chronological log.
 *
 * @fires app-training-log-toggle - The learner changed the native log disclosure.
 */
@customElement('app-training-progress')
export class AppTrainingProgress extends LitElement {
	static override styles = [
		trainModelStyles,
		css`
			:host {
				display: block;
			}
			:host([hidden]) {
				display: none;
			}
			progress {
				display: block;
				inline-size: 100%;
			}
			summary:focus {
				outline: 2px solid var(--focus-ring);
				outline-offset: 2px;
			}
		`
	];

	/** Latest labelled training progress; a null percent makes the bar indeterminate. */
	@property({ attribute: false }) accessor progress: TrainingProgress | null = null;
	/** Stable entries supplied in chronological order. */
	@property({ attribute: false }) accessor logEntries: readonly TrainingLogEntry[] = [];
	/** Persisted open state of the native disclosure. */
	@property({ attribute: false }) accessor logOpen = false;
	/** Localised, infrequent status message for assistive technology. */
	@property({ attribute: false }) accessor announcement = '';
	/** Localised elapsed time when the result is ready. */
	@property({ attribute: false }) accessor durationText = '';
	/** Localised labels and log formatter. */
	@property({ attribute: false }) accessor labels: TrainingProgressLabels = defaultLabels;

	private emittedOpen = false;
	private pendingAnnouncement: number | undefined;

	override willUpdate(changed: PropertyValues<this>): void {
		if (changed.has('logOpen')) this.emittedOpen = this.logOpen;
	}

	override updated(changed: PropertyValues<this>): void {
		if (!changed.has('announcement')) return;
		if (this.pendingAnnouncement !== undefined) cancelAnimationFrame(this.pendingAnnouncement);
		const region = this.renderRoot.querySelector('[role="status"]');
		if (!region || region.textContent === this.announcement) return;
		// Allow the live region to be mounted before changing its text.
		this.pendingAnnouncement = requestAnimationFrame(() => {
			this.pendingAnnouncement = requestAnimationFrame(() => {
				this.pendingAnnouncement = undefined;
				if (this.isConnected) region.textContent = this.announcement;
			});
		});
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		if (this.pendingAnnouncement !== undefined) cancelAnimationFrame(this.pendingAnnouncement);
		this.pendingAnnouncement = undefined;
	}

	private handleLogToggle(event: Event): void {
		const { open } = event.currentTarget as HTMLDetailsElement;
		if (open === this.logOpen || open === this.emittedOpen) return;
		this.emittedOpen = open;
		this.dispatchEvent(
			new CustomEvent<{ readonly open: boolean }>('app-training-log-toggle', {
				detail: { open },
				bubbles: false,
				composed: false
			})
		);
	}

	override render() {
		return html`
			<progress
				max="100"
				value=${this.progress?.percent ?? nothing}
				aria-label=${this.labels.progress}></progress>
			<details ?open=${this.logOpen} @toggle=${this.handleLogToggle}>
				<summary>${this.progress?.statusMessage ?? this.labels.waiting}</summary>
				<ol>
					${repeat(
						this.logEntries,
						(entry) => entry.id,
						(entry) => html`<li>${this.labels.formatEntry(entry)}</li>`
					)}
				</ol>
			</details>
			${this.durationText ? html`<p>${this.durationText}</p>` : nothing}
			<p class="visually-hidden" role="status" aria-live="polite"></p>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'app-training-progress': AppTrainingProgress;
	}
}
