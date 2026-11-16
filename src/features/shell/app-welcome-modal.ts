import { StoreController } from '@nanostores/lit';
import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { i18n } from '../../i18n';
import { $route } from '../../router/router';
import { $appState, dismissWelcome } from '../../stores/app.store';
import { buttonStyles } from '../../styles/button.styles';
import { chicletStyles } from '../../styles/chiclet.styles';
import { dialogStyles } from '../../styles/dialog.styles';

const messages = i18n('app-welcome-modal', {
	brand: 'samatā.ml',
	beta: 'beta',
	lead: 'train machine learning models inside your browser.',
	body: 'The samatā.ml platform allows anyone to learn key Artificial Intelligence concepts through hands-on experimentation.',
	getStarted: 'Get Started'
});

/** Connected first-visit onboarding, dismissed by an explicit action or native close. */
@customElement('app-welcome-modal')
export class AppWelcomeModal extends LitElement {
	private readonly appState = new StoreController(this, $appState);
	private readonly route = new StoreController(this, $route);
	private readonly translations = new StoreController(this, messages);
	private synchronisedCloses = 0;

	private get dialogElement(): HTMLDialogElement | null {
		return this.renderRoot.querySelector('dialog');
	}

	static override readonly styles = [
		dialogStyles,
		buttonStyles,
		chicletStyles,
		css`
			:host {
				display: block;
			}
			:host([hidden]) {
				display: none;
			}
			dialog {
				min-block-size: 50dvh;
			}
			.beta {
				vertical-align: middle;
			}
			.lead {
				margin-inline: 0;
				margin-block: 0.83em;
				color: var(--stone-800);
				font-weight: 700;
				font-size: 1.5rem;
				line-height: normal;
			}
			.body {
				margin-inline: 0;
				margin-block: 0 1rem;
				color: var(--stone-800);
				font-weight: 400;
				font-size: 1rem;
				line-height: 2rem;
			}
			.modal-actions {
				margin: 0;
			}
			.modal-actions button {
				box-sizing: border-box;
				inline-size: 100%;
			}
		`
	];

	override updated(): void {
		const route = this.route.value;
		const shouldOpen =
			!this.appState.value.onboarding.welcomeDismissed &&
			(route.kind === 'workflow' || route.kind === 'root');
		const dialog = this.dialogElement;
		if (!dialog) return;
		if (shouldOpen && !dialog.open) dialog.showModal();
		else if (!shouldOpen && dialog.open) {
			this.synchronisedCloses++;
			dialog.close();
		}
	}

	override disconnectedCallback(): void {
		if (this.dialogElement?.open) {
			this.synchronisedCloses++;
			this.dialogElement.close();
		}
		super.disconnectedCallback();
	}

	private handleGetStarted(): void {
		if (!this.appState.value.onboarding.welcomeDismissed) dismissWelcome();
		if (this.dialogElement?.open) {
			this.synchronisedCloses++;
			this.dialogElement.close();
		}
	}

	private handleClose(): void {
		if (this.synchronisedCloses > 0) {
			this.synchronisedCloses--;
			return;
		}
		if (this.isConnected && !this.appState.value.onboarding.welcomeDismissed) dismissWelcome();
	}

	override render() {
		const t = this.translations.value;
		return html`
			<dialog aria-labelledby="welcome-title" @close=${this.handleClose}>
				<header class="modal-header">
					<h2 id="welcome-title">
						${t.brand} <span class="chiclet chiclet-amber beta">${t.beta}</span>
					</h2>
				</header>
				<p class="lead">${t.lead}</p>
				<p class="body">${t.body}</p>
				<div class="modal-actions">
					<button
						class="btn btn-primary"
						type="button"
						autofocus
						@click=${this.handleGetStarted}>
						${t.getStarted}
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
