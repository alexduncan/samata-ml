import { StoreController } from '@nanostores/lit';
import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { $route, closeReserved, getIsSyncingFromHistory } from '../../router/router';
import { buttonStyles } from '../../styles/button.styles';
import { dialogStyles } from '../../styles/dialog.styles';
import type { ReservedPath } from '../../types/routes';

/**
 * Connected modal component for reserved static content routes (/about, /privacy, /help).
 * Follows specification/app-state-and-navigation.md §5.4.
 */
@customElement('app-content-modal')
export class AppContentModal extends LitElement {
	private readonly route = new StoreController(this, $route);

	private get dialogElement(): HTMLDialogElement | null {
		return this.renderRoot?.querySelector('dialog') ?? null;
	}

	static override styles = [
		dialogStyles,
		buttonStyles,
		css`
			dialog {
				padding: var(--space-6, 1.5rem);
				width: 90vw;
				max-width: 600px;
			}

			.modal-header {
				display: flex;
				justify-content: space-between;
				align-items: center;
				margin-bottom: var(--space-4, 1rem);
				border-bottom: 1px solid var(--color-border, #e5e7eb);
				padding-bottom: var(--space-3, 0.75rem);
			}

			h2 {
				margin: 0;
				color: var(--color-primary, #0f172a);
				font-size: var(--text-xl, 1.25rem);
			}

			.close-btn {
				cursor: pointer;
				border: none;
				border-radius: var(--radius-sm, 4px);
				background: none;
				padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
				color: var(--color-text-muted, #64748b);
				font-size: 1.25rem;
				line-height: 1;
			}

			.close-btn:hover {
				background-color: var(--color-bg-hover, #f1f5f9);
				color: var(--color-text, #0f172a);
			}

			.modal-body {
				color: var(--color-text, #334155);
				line-height: 1.6;
			}

			.modal-body p {
				margin: var(--space-3, 0.75rem) 0;
			}
		`
	];

	override updated(): void {
		const route = this.route.value;
		const isReserved = route.kind === 'reserved';

		if (this.dialogElement) {
			if (isReserved && !this.dialogElement.open) {
				try {
					this.dialogElement.showModal();
				} catch {
					this.dialogElement.open = true;
				}
			} else if (!isReserved && this.dialogElement.open) {
				this.dialogElement.close();
			}
		}
	}

	private handleDialogClose(): void {
		if (!getIsSyncingFromHistory()) {
			closeReserved();
		}
	}

	private handleCloseButtonClick(): void {
		closeReserved();
	}

	private renderContent(path: ReservedPath) {
		switch (path) {
			case '/about':
				return html`
					<div class="modal-header">
						<h2 id="content-modal-title">About samatā.ml</h2>
						<button
							class="close-btn"
							type="button"
							aria-label="Close"
							@click=${this.handleCloseButtonClick}>
							✕
						</button>
					</div>
					<div class="modal-body">
						<p>
							<strong>samatā.ml</strong> is an educational browser application for
							training and evaluating machine learning models locally on your device.
						</p>
						<p>
							All computation is powered by the <code>web-ml</code> library, executing
							standard classification algorithms without external backend services or
							telemetry.
						</p>
					</div>
				`;
			case '/privacy':
				return html`
					<div class="modal-header">
						<h2 id="content-modal-title">Privacy Notice</h2>
						<button
							class="close-btn"
							type="button"
							aria-label="Close"
							@click=${this.handleCloseButtonClick}>
							✕
						</button>
					</div>
					<div class="modal-body">
						<p>
							Your privacy is completely protected by design: all datasets, training
							routines, and results remain strictly within your local browser sandbox.
						</p>
						<p>
							No cookies, tracking scripts, or analytics are used. Local storage is
							used solely to persist your session state across page reloads.
						</p>
					</div>
				`;
			case '/help':
				return html`
					<div class="modal-header">
						<h2 id="content-modal-title">Help & Guide</h2>
						<button
							class="close-btn"
							type="button"
							aria-label="Close"
							@click=${this.handleCloseButtonClick}>
							✕
						</button>
					</div>
					<div class="modal-body">
						<p>Follow the standard 4-step workflow:</p>
						<ol>
							<li>
								<strong>Load Data:</strong> Select a sample dataset or upload a CSV
								file.
							</li>
							<li>
								<strong>Set Target:</strong> Choose the column you want your models
								to predict.
							</li>
							<li>
								<strong>Train Models:</strong> Configure features, algorithms, and
								hyperparameters.
							</li>
							<li>
								<strong>Compare Results:</strong> Evaluate and compare accuracy,
								F1-score, and curves across models.
							</li>
						</ol>
					</div>
				`;
		}
	}

	override render() {
		const route = this.route.value;
		const reservedPath: ReservedPath = route.kind === 'reserved' ? route.path : '/about';

		return html`
			<dialog aria-labelledby="content-modal-title" @close=${this.handleDialogClose}>
				${this.renderContent(reservedPath)}
			</dialog>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'app-content-modal': AppContentModal;
	}
}
