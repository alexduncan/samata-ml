import { css, html, LitElement, nothing, type PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { observeDialogHeader } from '../../common/dom/dialog-header';
import { installBackdropDismiss } from '../../common/dom/dialog-backdrop';
import { buttonStyles } from '../../styles/button.styles';
import { dialogStyles } from '../../styles/dialog.styles';

/** Consumer-supplied translations for the close control and load failure. */
export interface ContentDialogLabels {
	close: string;
	loadError: string;
}

/** Empty user-dismissal detail; route decisions belong to the connected parent. */
export type ContentDialogCloseDetail = Record<string, never>;

/**
 * Presentational native dialog for a safe, already-sanitised content fragment.
 *
 * @fires app-content-dialog-close - The user dismissed the dialog.
 */
@customElement('app-content-dialog')
export class AppContentDialog extends LitElement {
	/** Controls native modal opening; property-driven closing emits no user intent. */
	@property({ type: Boolean }) accessor open = false;
	/** Visible h2 naming the native dialog. */
	@property({ type: String }) accessor heading = '';
	/** Content language, applied to the heading and body only while ready. */
	@property({ type: String, attribute: 'content-lang' }) accessor contentLang = '';
	/** Content direction, applied only while ready; empty inherits the document direction. */
	@property({ type: String, attribute: 'content-dir' }) accessor contentDir: 'ltr' | 'rtl' | '' =
		'';
	/** Safe loader output; cloned before rendering so the supplied fragment stays intact. */
	@property({ attribute: false }) accessor content: DocumentFragment | null = null;
	/** Loading, ready or error presentation, independent of native open state. */
	@property({ type: String }) accessor status: 'loading' | 'ready' | 'error' = 'loading';
	/** Translations with explicit English defaults for standalone consumers. */
	@property({ attribute: false }) accessor labels: ContentDialogLabels = {
		close: 'Close',
		loadError:
			'This content could not be loaded. Check your connection, then close this dialog and try again.'
	};

	/** @internal */
	private contentNodes: Node[] = [];
	/** @internal */
	private synchronisedCloses = 0;
	/** @internal */
	private hasSynchronisedOpen = false;
	/** @internal */
	private stopHeaderObservation?: () => void;
	/** @internal */
	private stopBackdropDismiss?: () => void;
	/** @internal */
	private get dialogElement(): HTMLDialogElement | null {
		return this.renderRoot?.querySelector('dialog') ?? null;
	}

	static override readonly styles = [
		dialogStyles,
		buttonStyles,
		css`
			:host {
				display: contents;
			}
			:host([hidden]) {
				display: none;
			}
		`
	];

	override connectedCallback(): void {
		super.connectedCallback();
		if (this.hasUpdated) this.synchroniseOpen();
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

	override willUpdate(changed: PropertyValues<this>): void {
		if (changed.has('content') || changed.has('status')) {
			this.contentNodes =
				this.status === 'ready' && this.content
					? Array.from(this.content.cloneNode(true).childNodes)
					: [];
		}
	}

	override updated(changed: PropertyValues<this>): void {
		if (!this.hasSynchronisedOpen || changed.has('open')) {
			this.hasSynchronisedOpen = true;
			this.synchroniseOpen();
		}
	}

	/** @internal */
	private synchroniseOpen(): void {
		const dialog = this.dialogElement;
		if (!this.isConnected || !dialog) return;
		if (this.open && !dialog.open) {
			this.stopHeaderObservation?.();
			dialog.showModal();
			this.stopHeaderObservation = observeDialogHeader(dialog);
			this.stopBackdropDismiss?.();
			this.stopBackdropDismiss = installBackdropDismiss(dialog);
		} else if (!this.open && dialog.open) {
			this.synchronisedCloses++;
			dialog.close();
		}
	}

	/** @internal */
	private handleCloseButton(): void {
		this.dialogElement?.close();
	}

	/** @internal */
	private handleNativeClose(): void {
		if (this.synchronisedCloses > 0) {
			this.synchronisedCloses--;
			return;
		}
		if (!this.isConnected) return;
		this.dispatchEvent(
			new CustomEvent<ContentDialogCloseDetail>('app-content-dialog-close', {
				detail: {},
				bubbles: false,
				composed: false
			})
		);
	}

	override render() {
		const lang = this.status === 'ready' ? this.contentLang || nothing : nothing;
		const dir = this.status === 'ready' ? this.contentDir || nothing : nothing;
		return html`
			<dialog
				class="modal"
				closedby="any"
				aria-labelledby="content-dialog-title"
				@close=${this.handleNativeClose}>
				<header class="modal-header">
					<h2 id="content-dialog-title" lang=${lang} dir=${dir}>${this.heading}</h2>
					<button
						type="button"
						class="btn-icon"
						aria-label=${this.labels.close}
						@click=${this.handleCloseButton}>
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
				<div
					class="modal-content"
					lang=${lang}
					dir=${dir}
					aria-busy=${this.status === 'loading' ? 'true' : 'false'}>
					${this.status === 'error'
						? html`<p role="alert">${this.labels.loadError}</p>`
						: this.status === 'ready'
							? this.contentNodes
							: nothing}
				</div>
			</dialog>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'app-content-dialog': AppContentDialog;
	}
}
