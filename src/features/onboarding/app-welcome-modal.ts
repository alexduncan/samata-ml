import { StoreController } from '@nanostores/lit';
import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { $route } from '../../router/router';
import { $appState, dismissWelcome } from '../../stores/app.store';
import { buttonStyles } from '../../styles/button.styles';
import { dialogStyles } from '../../styles/dialog.styles';

/**
 * Connected welcome onboarding modal component.
 * Displays on first load for workflow routes until dismissed.
 * Follows specification/app-state-and-navigation.md §2 and §5.4.
 */
@customElement('app-welcome-modal')
export class AppWelcomeModal extends LitElement {
	private readonly appState = new StoreController(this, $appState);
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
				max-width: 480px;
			}

			h2 {
				margin-top: 0;
				color: var(--color-primary, #0f172a);
				font-size: var(--text-xl, 1.25rem);
			}

			p {
				margin: var(--space-3, 0.75rem) 0;
				color: var(--color-text, #334155);
				line-height: 1.5;
			}

			.actions {
				display: flex;
				justify-content: flex-end;
				margin-top: var(--space-6, 1.5rem);
			}
		`
	];

	override updated(): void {
		const state = this.appState.value;
		const route = this.route.value;

		const isWorkflowRoute = route.kind === 'workflow' || route.kind === 'root';
		const shouldBeOpen = !state.onboarding.welcomeDismissed && isWorkflowRoute;

		if (this.dialogElement) {
			if (shouldBeOpen && !this.dialogElement.open) {
				try {
					this.dialogElement.showModal();
				} catch {
					// Fall back if showModal throws in test environment
					this.dialogElement.open = true;
				}
			} else if (!shouldBeOpen && this.dialogElement.open) {
				this.dialogElement.close();
			}
		}
	}

	private handleGetStarted(): void {
		dismissWelcome();
		if (this.dialogElement?.open) {
			this.dialogElement.close();
		}
	}

	override render() {
		return html`
			<dialog aria-labelledby="welcome-title">
				<h2 id="welcome-title">Welcome to samatā.ml</h2>
				<p>
					Train machine learning models directly in your browser. All training runs
					locally on your device using client-side algorithms — your data never leaves
					your browser.
				</p>
				<p>
					Get started by loading a sample dataset or uploading your own CSV file to begin
					building models.
				</p>
				<div class="actions">
					<button class="btn btn-primary" type="button" @click=${this.handleGetStarted}>
						Get Started
					</button>
				</div>
			</dialog>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'app-welcome-modal': AppWelcomeModal;
	}
}
