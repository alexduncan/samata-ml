import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { buttonStyles } from '../../styles/button.styles';
import { observeDialogHeader } from '../../common/dom/dialog-header';
import { installBackdropDismiss } from '../../common/dom/dialog-backdrop';
import { dialogStyles } from '../../styles/dialog.styles';

/**
 * Labels configuration for {@link AppModelDescriptionDialog}.
 */
export interface ModelDescriptionDialogLabels {
	/** Label for the close action buttons. */
	close: string;
	/** Label for the retry button on load failure. */
	retry: string;
	/** Label for the loading status message. */
	status: string;
}

/** Loading and availability status for model description articles. */
export type ModelDescriptionStatus = 'loading' | 'ready' | 'missing' | 'error';

function getDeepActiveElement(): HTMLElement | null {
	let active: Element | null = document.activeElement;
	while (active?.shadowRoot?.activeElement) {
		active = active.shadowRoot.activeElement;
	}
	return active instanceof HTMLElement ? active : null;
}

/**
 * Presentational modal dialog displaying a model's description article, fallback or error state.
 * Follows specification/plans/step-3-train-models-overview-and-setup.md D1, D4.
 */
@customElement('app-model-description-dialog')
export class AppModelDescriptionDialog extends LitElement {
	static override readonly styles = [
		dialogStyles,
		buttonStyles,
		css`
			.description-article {
				color: var(--stone-900);
				line-height: 1.6;

				h1,
				h2,
				h3,
				h4 {
					margin-block: 1rem 0.5rem;
					color: var(--stone-900);
				}

				p {
					margin-block: 0.5rem;
				}

				ul,
				ol {
					margin-block: 0.5rem;
					padding-inline-start: 1.5rem;
				}

				a {
					color: var(--blue-700);
					text-decoration: underline;

					&:hover {
						color: var(--blue-800);
					}
				}
			}

			.status-box {
				display: flex;
				flex-direction: column;
				align-items: flex-start;
				gap: 1rem;
				padding-block: 1rem;

				.missing-notice {
					color: var(--stone-700);
					font-style: italic;
				}

				.fallback-text {
					color: var(--stone-800);
					line-height: 1.5;
				}
			}

			.modal-actions {
				display: flex;
				justify-content: flex-end;
				gap: 0.5rem;
				margin-block-start: 1.5rem;
			}
		`
	];

	private get dialogElement(): HTMLDialogElement | null {
		return this.renderRoot?.querySelector('dialog') ?? null;
	}

	private invokerElement: HTMLElement | null = null;
	private stopHeaderObservation?: () => void;
	private stopBackdropDismiss?: () => void;
	private synchronisedCloses = 0;

	override disconnectedCallback(): void {
		this.stopHeaderObservation?.();
		this.stopBackdropDismiss?.();
		if (this.dialogElement?.open) {
			this.synchronisedCloses++;
			this.dialogElement.close();
		}
		super.disconnectedCallback();
	}

	/** Whether the modal dialog is open. */
	@property({ type: Boolean })
	accessor open = false;

	/** Heading title for the dialog. */
	@property({ type: String })
	accessor heading = '';

	/** Sanitised DocumentFragment containing the rendered model description. */
	@property({ attribute: false })
	accessor content: DocumentFragment | null = null;

	/** Plain-text fallback description when authored markdown article is missing. */
	@property({ type: String })
	accessor fallback = '';

	/** Loading and display status of the model description. */
	@property({ type: String })
	accessor status: ModelDescriptionStatus = 'loading';

	/** Accessible labels for actions and status. */
	@property({ attribute: false })
	accessor labels: ModelDescriptionDialogLabels = {
		close: '',
		retry: '',
		status: ''
	};

	override updated(changedProperties: PropertyValues): void {
		super.updated(changedProperties);

		if (changedProperties.has('open')) {
			if (this.open && !this.dialogElement?.open) {
				this.invokerElement = getDeepActiveElement();
				try {
					this.dialogElement?.showModal();
				} catch {
					if (this.dialogElement) this.dialogElement.open = true;
				}
				if (this.dialogElement?.open) {
					this.stopHeaderObservation?.();
					this.stopHeaderObservation = observeDialogHeader(this.dialogElement);
					this.stopBackdropDismiss?.();
					this.stopBackdropDismiss = installBackdropDismiss(this.dialogElement);
				}
			} else if (!this.open && this.dialogElement?.open) {
				this.synchronisedCloses++;
				this.dialogElement.returnValue = '';
				this.dialogElement.close();
				this.invokerElement?.focus?.();
			}
		}
	}

	private handleNativeClose(): void {
		const dialog = this.dialogElement;
		if (!dialog) return;
		if (this.synchronisedCloses > 0) {
			this.synchronisedCloses--;
			return;
		}
		if (dialog.open || !this.open || !this.isConnected) return;
		dialog.returnValue = '';
		this.open = false;
		this.invokerElement?.focus({ preventScroll: true });
		this.dispatchEvent(
			new CustomEvent('app-model-description-close', {
				detail: {},
				bubbles: false,
				composed: false
			})
		);
	}

	private handleClose(): void {
		this.dialogElement?.close();
	}

	private handleRetry(): void {
		this.dispatchEvent(
			new CustomEvent('app-model-description-retry', {
				detail: {},
				bubbles: false,
				composed: false
			})
		);
	}

	private renderContent(): TemplateResult | typeof nothing {
		if (this.status === 'loading') {
			return html`
				<div class="status-box">
					<p role="status">${this.labels.status || 'Loading model description…'}</p>
				</div>
			`;
		}

		if (this.status === 'missing') {
			return html`
				<div class="status-box">
					<p class="missing-notice">
						A detailed description is not available for this model yet.
					</p>
					${this.fallback ? html`<p class="fallback-text">${this.fallback}</p>` : nothing}
				</div>
				<div class="modal-actions">
					<button type="button" class="btn" @click=${this.handleClose}>
						${this.labels.close || 'Close'}
					</button>
				</div>
			`;
		}

		if (this.status === 'error') {
			return html`
				<div class="status-box">
					<p role="alert">The model description could not be loaded.</p>
				</div>
				<div class="modal-actions">
					<button type="button" class="btn btn-primary" @click=${this.handleRetry}>
						${this.labels.retry || 'Retry'}
					</button>
					<button type="button" class="btn" @click=${this.handleClose}>
						${this.labels.close || 'Close'}
					</button>
				</div>
			`;
		}

		if (this.status === 'ready' && this.content) {
			return html`
				<section
					class="description-article"
					lang=${this.lang || nothing}
					dir=${this.dir || nothing}>
					${this.content}
				</section>
				<div class="modal-actions">
					<button type="button" class="btn" @click=${this.handleClose}>
						${this.labels.close || 'Close'}
					</button>
				</div>
			`;
		}

		return html`
			<div class="status-box"><p>No model description available.</p></div>
			<div class="modal-actions">
				<button type="button" class="btn" @click=${this.handleClose}>
					${this.labels.close || 'Close'}
				</button>
			</div>
		`;
	}

	override render(): TemplateResult {
		return html`
			<dialog
				class="modal"
				closedby="any"
				aria-labelledby="model-dialog-title"
				@close=${this.handleNativeClose}>
				<header class="modal-header">
					<div class="header-titles">
						<span class="header-subtitle">Model Description</span>
						<h2 id="model-dialog-title">${this.heading}</h2>
					</div>
					<button
						type="button"
						class="btn-icon"
						aria-label=${this.labels.close || 'Close modal'}
						@click=${this.handleClose}>
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="1.5"
							aria-hidden="true"
							focusable="false">
							<line x1="18" y1="6" x2="6" y2="18"></line>
							<line x1="6" y1="6" x2="18" y2="18"></line>
						</svg>
					</button>
				</header>
				<div class="modal-content">${this.renderContent()}</div>
			</dialog>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'app-model-description-dialog': AppModelDescriptionDialog;
	}
}
