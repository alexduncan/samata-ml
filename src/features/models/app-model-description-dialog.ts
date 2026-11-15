import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { buttonStyles } from '../../styles/button.styles';
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
			dialog.modal {
				box-shadow: var(--shadow-deep);
				border: 1.5px solid var(--stone-200);
				border-radius: 1rem;
				background-color: var(--surface);
				padding: 1.5rem;
				inline-size: min(40rem, calc(100% - 2rem));
				max-inline-size: none;
				max-block-size: calc(100dvh - 2rem);
				overflow: auto;
				color: var(--stone-800);
			}

			.modal-header {
				display: flex;
				justify-content: space-between;
				align-items: center;
				margin-block-end: 1rem;
				border-block-end: 1px solid var(--stone-200);
				padding-block-end: 1rem;

				.header-titles {
					display: flex;
					flex-direction: column;
					gap: 0.25rem;
				}

				.header-subtitle {
					color: var(--stone-700);
					font-weight: 500;
					font-size: 0.875rem;
				}

				h2 {
					margin: 0;
					color: var(--stone-900);
					font-weight: 600;
					font-size: 1.5rem;
				}
			}

			.close-btn {
				cursor: pointer;
				border: none;
				border-radius: 0.375rem;
				background: none;
				padding: 0.5rem;
				color: var(--stone-600);
				font-size: 1.25rem;
				line-height: 1;

				&:hover {
					background-color: var(--stone-100);
					color: var(--stone-900);
				}

				&:focus-visible {
					outline: 2px solid var(--focus-ring);
					outline-offset: 2px;
				}
			}

			.modal-content {
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
					color: var(--stone-600);
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
			} else if (!this.open && this.dialogElement?.open) {
				this.dialogElement.returnValue = '';
				this.dialogElement.close();
				this.invokerElement?.focus?.();
			}
		}
	}

	private handleCancel(e: Event): void {
		e.preventDefault();
		this.handleClose();
	}

	private handleClose(): void {
		if (this.dialogElement) {
			this.dialogElement.returnValue = '';
			if (this.dialogElement.open) {
				this.dialogElement.close();
			}
		}
		if (this.open) {
			this.open = false;
			this.invokerElement?.focus?.();
			this.dispatchEvent(
				new CustomEvent('app-model-description-close', {
					detail: {},
					bubbles: false,
					composed: false
				})
			);
		}
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
					class="modal-content"
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
				aria-modal="true"
				aria-labelledby="model-dialog-title"
				@cancel=${this.handleCancel}>
				<header class="modal-header">
					<div class="header-titles">
						<span class="header-subtitle">Model Description</span>
						<h2 id="model-dialog-title">${this.heading}</h2>
					</div>
					<button
						type="button"
						class="close-btn"
						aria-label=${this.labels.close || 'Close modal'}
						@click=${this.handleClose}>
						✕
					</button>
				</header>
				${this.renderContent()}
			</dialog>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'app-model-description-dialog': AppModelDescriptionDialog;
	}
}
