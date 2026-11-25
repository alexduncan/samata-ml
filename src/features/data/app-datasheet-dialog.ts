import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { buttonStyles } from '../../styles/button.styles';
import { observeDialogHeader } from '../../common/dom/dialog-header';
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
			.datasheet-article {
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
	private stopHeaderObservation?: () => void;

	override disconnectedCallback(): void {
		this.stopHeaderObservation?.();
		super.disconnectedCallback();
	}

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
				if (this.dialogElement?.open) {
					this.stopHeaderObservation?.();
					this.stopHeaderObservation = observeDialogHeader(this.dialogElement);
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
			return html`<section class="datasheet-article">${this.content}</section>`;
		}

		return html`<div class="status-box"><p>No datasheet available.</p></div>`;
	}

	override render(): TemplateResult {
		return html`
			<dialog
				class="modal"
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
						class="btn-icon"
						aria-label=${this.closeLabel || 'Close modal'}
						@click=${this.handleCloseClick}>
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
		'app-datasheet-dialog': AppDatasheetDialog;
	}
}
