import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { buttonStyles } from '../../styles/button.styles';
import { dialogStyles } from '../../styles/dialog.styles';

/**
 * Presentational modal dialog displaying a dataset's safe datasheet fragment.
 * Follows specification/plans/step-1-load-data-and-preview.md D5.
 */
@customElement('app-datasheet-dialog')
export class AppDatasheetDialog extends LitElement {
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
					color: var(--stone-600);
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

				table {
					margin-block: 1rem;
					border-collapse: collapse;
					inline-size: 100%;
				}

				th,
				td {
					border: 1px solid var(--stone-200);
					padding: 0.5rem;
					text-align: start;
				}

				th {
					background-color: var(--stone-50);
					font-weight: 600;
				}
			}

			.status-box {
				display: flex;
				flex-direction: column;
				align-items: flex-start;
				gap: 1rem;
				padding-block: 1rem;
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

	/** Sanitised DocumentFragment containing the rendered datasheet. */
	@property({ attribute: false })
	accessor content: DocumentFragment | null = null;

	/** Loading and display status of the datasheet. */
	@property({ type: String })
	accessor status: 'loading' | 'ready' | 'error' = 'loading';

	/** Optional invoker element for explicit focus restoration. */
	@property({ attribute: false })
	accessor invoker: HTMLElement | null = null;

	/** Accessible label for the close action button. */
	@property({ type: String, attribute: 'close-label' })
	accessor closeLabel = '';

	/** Optional status description string. */
	@property({ type: String, attribute: 'status-label' })
	accessor statusLabel = '';

	override updated(changedProperties: PropertyValues): void {
		super.updated(changedProperties);

		if (changedProperties.has('open')) {
			if (this.open && !this.dialogElement?.open) {
				this.invokerElement =
					this.invoker ?? (document.activeElement as HTMLElement) ?? null;
				try {
					this.dialogElement?.showModal();
				} catch {
					if (this.dialogElement) this.dialogElement.open = true;
				}
			} else if (!this.open && this.dialogElement?.open) {
				this.dialogElement.close();
				this.dialogElement.returnValue = '';
				this.invokerElement?.focus?.();
			}
		}
	}

	private handleNativeClose(): void {
		if (this.dialogElement) {
			this.dialogElement.returnValue = '';
		}
		if (this.open) {
			this.open = false;
			this.invokerElement?.focus?.();
			this.dispatchEvent(
				new CustomEvent('app-datasheet-dialog-close', {
					bubbles: false,
					composed: false
				})
			);
		}
	}

	private handleCloseClick(): void {
		this.open = false;
		if (this.dialogElement?.open) {
			this.dialogElement.close();
			this.dialogElement.returnValue = '';
		}
		this.invokerElement?.focus?.();
		this.dispatchEvent(
			new CustomEvent('app-datasheet-dialog-close', {
				bubbles: false,
				composed: false
			})
		);
	}

	private handleRetry(): void {
		this.dispatchEvent(
			new CustomEvent('app-datasheet-dialog-retry', {
				bubbles: false,
				composed: false
			})
		);
	}

	private renderContent(): TemplateResult | typeof nothing {
		if (this.status === 'loading') {
			return html`
				<div class="status-box">
					<p role="status">${this.statusLabel || 'Loading datasheet...'}</p>
				</div>
			`;
		}

		if (this.status === 'error') {
			return html`
				<div class="status-box">
					<p role="alert">
						This datasheet could not be loaded. Check your connection and try again.
					</p>
					<button type="button" class="btn" @click=${this.handleRetry}>Retry</button>
				</div>
			`;
		}

		if (this.status === 'ready' && this.content) {
			return html`<section class="modal-content">${this.content}</section>`;
		}

		return html`<div class="status-box"><p>No datasheet available.</p></div>`;
	}

	override render(): TemplateResult {
		return html`
			<dialog
				class="modal"
				aria-modal="true"
				aria-labelledby="datasheet-title"
				@close=${this.handleNativeClose}
				@cancel=${this.handleNativeClose}>
				<header class="modal-header">
					<div class="header-titles">
						<span class="header-subtitle">Dataset Card</span>
						<h2 id="datasheet-title">${this.heading}</h2>
					</div>
					<button
						type="button"
						class="close-btn"
						aria-label=${this.closeLabel || 'Close modal'}
						@click=${this.handleCloseClick}>
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
		'app-datasheet-dialog': AppDatasheetDialog;
	}
}
