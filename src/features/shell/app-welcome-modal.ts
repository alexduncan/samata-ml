import { StoreController } from '@nanostores/lit';
import { css, html, LitElement, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { observeDialogHeader } from '../../common/dom/dialog-header';
import { installBackdropDismiss } from '../../common/dom/dialog-backdrop';
import {
	$betaDeployment,
	initBetaTelemetry,
	trackBetaEvent
} from '../../common/telemetry/telemetry-client';
import { i18n } from '../../i18n';
import { $route } from '../../router/router';
import { $appState, acceptBetaTelemetry, dismissWelcome } from '../../stores/app.store';
import { buttonStyles } from '../../styles/button.styles';
import { chicletStyles } from '../../styles/chiclet.styles';
import { dialogStyles } from '../../styles/dialog.styles';

const messages = i18n('app-welcome-modal', {
	brand: 'samatā.ml',
	beta: 'beta',
	lead: 'Train machine learning models inside your browser.',
	body: 'The mission of samatā.ml is to enable anyone to learn key AI concepts through hands-on experimentation.',
	betaNotice:
		'By clicking Get Started, you accept cookieless analytics and error reporting for this beta.',
	privacyLink: 'Read the privacy policy',
	getStarted: 'Get Started'
});

/** Connected first-visit onboarding, dismissed by an explicit action or native close. */
@customElement('app-welcome-modal')
export class AppWelcomeModal extends LitElement {
	private readonly appState = new StoreController(this, $appState);
	private readonly betaDeployment = new StoreController(this, $betaDeployment);
	private readonly route = new StoreController(this, $route);
	private readonly translations = new StoreController(this, messages);
	private synchronisedCloses = 0;
	private stopHeaderObservation?: () => void;
	private stopBackdropDismiss?: () => void;

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
			.beta-notice {
				margin-inline: 0;
				margin-block: 0 1rem;
				color: var(--stone-800);
				font-weight: 400;
				font-size: 1rem;
				line-height: 1.5rem;
			}
			.beta-notice a {
				color: var(--blue-700);
			}
			.beta-notice a:focus-visible {
				outline: 2px solid var(--focus-ring);
				outline-offset: 2px;
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
		const isBeta = this.betaDeployment.value;
		const onboarding = this.appState.value.onboarding;
		const dismissedOrAccepted = isBeta
			? onboarding.betaTelemetryAccepted
			: onboarding.welcomeDismissed;
		const shouldOpen =
			!dismissedOrAccepted && (route.kind === 'workflow' || route.kind === 'root');
		const dialog = this.dialogElement;
		if (!dialog) return;
		if (shouldOpen && !dialog.open) {
			this.stopHeaderObservation?.();
			dialog.showModal();
			this.stopHeaderObservation = observeDialogHeader(dialog);
			this.stopBackdropDismiss?.();
			this.stopBackdropDismiss = installBackdropDismiss(
				dialog,
				() => !this.betaDeployment.value
			);
		} else if (!shouldOpen && dialog.open) {
			this.synchronisedCloses++;
			dialog.close();
		}
	}

	override disconnectedCallback(): void {
		this.stopHeaderObservation?.();
		this.stopBackdropDismiss?.();
		if (this.dialogElement?.open) {
			this.synchronisedCloses++;
			this.dialogElement.close();
		}
		super.disconnectedCallback();
	}

	private handleGetStarted(): void {
		if (this.betaDeployment.value) {
			if (!this.appState.value.onboarding.betaTelemetryAccepted) {
				acceptBetaTelemetry();
				initBetaTelemetry(() => $appState.get().onboarding.betaTelemetryAccepted);
				trackBetaEvent('beta_get_started');
			}
		} else if (!this.appState.value.onboarding.welcomeDismissed) {
			dismissWelcome();
		}
		if (this.dialogElement?.open) {
			this.synchronisedCloses++;
			this.dialogElement.close();
		}
	}

	private handleCancel(event: Event): void {
		if (this.betaDeployment.value) {
			event.preventDefault();
		}
	}

	private handleClose(): void {
		if (this.synchronisedCloses > 0) {
			this.synchronisedCloses--;
			return;
		}
		if (!this.isConnected) return;
		if (this.betaDeployment.value) {
			if (!this.appState.value.onboarding.betaTelemetryAccepted) {
				this.requestUpdate();
			}
			return;
		}
		if (!this.appState.value.onboarding.welcomeDismissed) dismissWelcome();
	}

	override render() {
		const t = this.translations.value;
		const isBeta = this.betaDeployment.value;
		return html`
			<dialog
				class="modal"
				closedby=${isBeta ? 'none' : 'any'}
				aria-labelledby="welcome-title"
				aria-describedby=${isBeta ? 'welcome-beta' : nothing}
				@cancel=${this.handleCancel}
				@close=${this.handleClose}>
				<header class="modal-header">
					<h2 id="welcome-title">
						${t.brand} <span class="chiclet chiclet-amber beta">${t.beta}</span>
					</h2>
				</header>
				<div class="modal-content">
					<p class="lead">${t.lead}</p>
					<p class="body">${t.body}</p>
					${isBeta
						? html`<p id="welcome-beta" class="beta-notice">
								${t.betaNotice}
								<a href="/privacy">${t.privacyLink}</a>
							</p>`
						: nothing}
					<div class="modal-actions">
						<button
							class="btn btn-primary"
							type="button"
							autofocus
							@click=${this.handleGetStarted}>
							${t.getStarted}
						</button>
					</div>
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
