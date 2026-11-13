import { StoreController } from '@nanostores/lit';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { loadContentEntry } from '../../common/content/content-loader';
import { BASE_LOCALE, LOCALES } from '../../config/locales';
import { RESERVED_CONTENT } from '../../router/reserved-content';
import { $route, closeReserved, getIsSyncingFromHistory } from '../../router/router';
import { buttonStyles } from '../../styles/button.styles';
import { dialogStyles } from '../../styles/dialog.styles';
import type { PageEntry } from '../../types/content';
import type { ReservedPath } from '../../types/routes';

const FALLBACK_TITLES: Record<ReservedPath, string> = {
	'/about': 'About',
	'/privacy': 'Privacy',
	'/help': 'Help'
};

/**
 * Connected modal component for reserved static content routes (/about, /privacy, /help).
 * Follows specification/app-state-and-navigation.md §5.4.
 */
@customElement('app-content-modal')
export class AppContentModal extends LitElement {
	private readonly route = new StoreController(this, $route);

	@state() private accessor status: 'idle' | 'loading' | 'loaded' | 'error' = 'idle';
	@state() private accessor entry: PageEntry | undefined = undefined;
	@state() private accessor body: DocumentFragment | undefined = undefined;

	private activePath: ReservedPath | undefined = undefined;
	private abortController: AbortController | undefined = undefined;
	private requestSeq = 0;

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

			h1 {
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

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		this.abortController?.abort();
		this.abortController = undefined;
		this.activePath = undefined;
	}

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

		if (route.kind === 'reserved') {
			if (this.activePath !== route.path) {
				this.startLoad(route.path);
			}
		} else if (this.activePath !== undefined) {
			this.abortController?.abort();
			this.abortController = undefined;
			this.activePath = undefined;
			this.requestSeq++;
		}
	}

	private startLoad(path: ReservedPath): void {
		this.abortController?.abort();
		const controller = new AbortController();
		this.abortController = controller;
		this.activePath = path;
		const seq = ++this.requestSeq;

		this.status = 'loading';
		this.entry = undefined;
		this.body = undefined;

		void loadContentEntry('pages', RESERVED_CONTENT[path], {
			locale: BASE_LOCALE,
			signal: controller.signal
		})
			.then(({ entry, content }) => {
				if (controller.signal.aborted || seq !== this.requestSeq) {
					return;
				}
				this.entry = entry;
				this.body = content;
				this.status = 'loaded';
			})
			.catch(() => {
				if (controller.signal.aborted || seq !== this.requestSeq) {
					return;
				}
				this.entry = undefined;
				this.body = undefined;
				this.status = 'error';
			});
	}

	private handleDialogClose(): void {
		if (!getIsSyncingFromHistory()) {
			closeReserved();
		}
	}

	private handleCloseButtonClick(): void {
		closeReserved();
	}

	private renderBody() {
		if (this.status === 'loaded' && this.entry && this.body) {
			return html`
				<div class="modal-body" lang=${this.entry.lang} dir=${LOCALES[this.entry.lang].dir}>
					${this.body}
				</div>
			`;
		}

		if (this.status === 'error') {
			return html`
				<div class="modal-body">
					<p role="alert">
						This content could not be loaded. Check your connection, then close this
						dialog and try again.
					</p>
				</div>
			`;
		}

		return html`<div class="modal-body">${nothing}</div>`;
	}

	override render() {
		const route = this.route.value;
		const reservedPath: ReservedPath | undefined =
			route.kind === 'reserved' ? route.path : undefined;
		const isLoaded = this.status === 'loaded' && this.entry !== undefined;
		const title = isLoaded
			? this.entry!.title
			: reservedPath
				? FALLBACK_TITLES[reservedPath]
				: '';

		return html`
			<dialog aria-labelledby="content-modal-title" @close=${this.handleDialogClose}>
				<div class="modal-header">
					${isLoaded
						? html`<h1
								id="content-modal-title"
								lang=${this.entry!.lang}
								dir=${LOCALES[this.entry!.lang].dir}>
								${title}
							</h1>`
						: html`<h1 id="content-modal-title">${title}</h1>`}
					<button
						class="close-btn"
						type="button"
						aria-label="Close"
						@click=${this.handleCloseButtonClick}>
						✕
					</button>
				</div>
				${this.renderBody()}
			</dialog>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'app-content-modal': AppContentModal;
	}
}
