import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { BASE_LOCALE, isLocale } from '../../config/locales';
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
			.progress {
				--progress-fill: var(--blue-600);
				--progress-track: var(--neutral-100);
				--progress-border: var(--blue-700);
				--progress-outline: var(--blue-200);
				--progress-stripes: none;
				display: flex;
				align-items: center;
				gap: 0.5rem;
				margin-block-end: 0.75rem;
			}
			.training-active {
				--progress-stripes: repeating-linear-gradient(
					-45deg,
					color-mix(in srgb, var(--surface) 15%, transparent) 0 0.75rem,
					color-mix(in srgb, var(--surface) 25%, transparent) 0.75rem 1.5rem
				);
			}
			.training-stopped {
				--progress-fill: var(--red-600);
				--progress-track: var(--red-100);
				--progress-border: var(--red-800);
				--progress-outline: var(--red-200);
			}
			.training-complete {
				--progress-fill: var(--green-700);
				--progress-track: var(--green-100);
				--progress-border: var(--green-800);
				--progress-outline: var(--green-200);
			}
			.progress-bar {
				flex: 1 1 auto;
				appearance: none;
				margin-block: 0.5rem;
				box-shadow: 0 0 0 3px var(--progress-outline);
				border: 1.5px solid var(--progress-border);
				border-radius: 0.5rem;
				background: var(--progress-track);
				inline-size: 100%;
				min-inline-size: 0;
				block-size: 1.25rem;
				overflow: clip;
			}
			.progress-bar::-webkit-progress-bar {
				background: transparent;
			}
			.progress-bar::-webkit-progress-value {
				background: var(--progress-stripes) var(--progress-fill);
			}
			.progress-bar::-moz-progress-bar {
				background: var(--progress-stripes) var(--progress-fill);
			}
			.progress-bar:indeterminate {
				background: var(--progress-stripes) var(--progress-fill);
			}
			.progress-percent {
				min-inline-size: 4ch;
				font-variant-numeric: tabular-nums;
				text-align: end;
			}
			.log {
				border: 1px solid var(--stone-300);
				border-radius: 0.5rem;
				background: var(--stone-50);
				padding: 0.75rem;
			}
			.log-status {
				color: var(--stone-800);
				font-weight: 700;
				overflow-wrap: anywhere;
			}
			.log-status-complete {
				color: var(--green-700);
			}
			.log-history {
				margin-block: 0.5rem 0;
				padding-inline-start: 1.5rem;
				font: 0.75rem/1.5 var(--font-mono);
				overflow-wrap: anywhere;
			}
			@media (forced-colors: active) {
				.progress {
					--progress-fill: Highlight;
					--progress-track: Canvas;
					--progress-border: CanvasText;
					--progress-stripes: none;
				}
				.progress-bar {
					box-shadow: none;
				}
				.progress-bar:indeterminate {
					background: Canvas;
				}
			}
			summary:focus {
				outline: 2px solid var(--focus-ring);
				outline-offset: 2px;
			}
		`
	];

	/** Latest labelled training progress; a null percent makes the bar indeterminate. */
	@property({ attribute: false }) accessor progress: TrainingProgress | null = null;
	/** Visual treatment of the acknowledged state presented by the owning builder. */
	@property({ attribute: false }) accessor variant: 'active' | 'stopped' | 'complete' = 'active';
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
	private percentText = '';

	override willUpdate(changed: PropertyValues<this>): void {
		if (changed.has('logOpen')) this.emittedOpen = this.logOpen;
		const percent = this.progress?.percent ?? null;
		const lang = this.ownerDocument.documentElement.lang;
		this.percentText =
			percent === null
				? ''
				: (percent / 100).toLocaleString(isLocale(lang) ? lang : BASE_LOCALE, {
						style: 'percent',
						maximumFractionDigits: 1
					});
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
		const percent = this.progress?.percent ?? null;
		return html`
			${this.variant === 'stopped' && percent === null
				? nothing
				: html` <div class="progress training-${this.variant}">
						<progress
							class="progress-bar"
							max="100"
							value=${percent ?? nothing}
							aria-label=${this.labels.progress}></progress>
						${percent === null
							? nothing
							: html`<span class="progress-percent" aria-hidden="true"
									>${this.percentText}</span
								>`}
					</div>`}
			<details class="log" ?open=${this.logOpen} @toggle=${this.handleLogToggle}>
				<summary
					class="log-status ${this.variant === 'complete' ? 'log-status-complete' : ''}">
					${this.progress?.statusMessage ?? this.labels.waiting}
				</summary>
				<ol class="log-history">
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
