import { StoreController } from '@nanostores/lit';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { loadContentEntry } from '../../common/content/content-loader';
import { BASE_LOCALE, LOCALES } from '../../config/locales';
import { i18n } from '../../i18n';
import { RESERVED_CONTENT } from '../../router/reserved-content';
import { $route, closeReserved } from '../../router/router';
import type { PageEntry } from '../../types/content';
import type { ReservedPath } from '../../types/routes';
import './app-content-dialog';

const messages = i18n('app-content-modal', {
	about: 'About',
	privacy: 'Privacy',
	help: 'Help',
	configureModelHelp: 'What do these settings mean?',
	trainingSetupHelp: 'Training Setup',
	close: 'Close',
	loadError:
		'This content could not be loaded. Check your connection, then close this dialog and try again.'
});

/** Connected reserved-route loader; native presentation and dismissal belong to its child. */
@customElement('app-content-modal')
export class AppContentModal extends LitElement {
	private readonly route = new StoreController(this, $route);
	private readonly translations = new StoreController(this, messages);
	@state() private accessor status: 'idle' | 'loading' | 'loaded' | 'error' = 'idle';
	@state() private accessor entry: PageEntry | undefined = undefined;
	@state() private accessor body: DocumentFragment | undefined = undefined;
	private activePath: ReservedPath | undefined = undefined;
	private abortController: AbortController | undefined = undefined;
	private requestSeq = 0;
	private renderedPath: ReservedPath | undefined = undefined;
	private dialogKey = 0;

	static override readonly styles = css`
		:host {
			display: contents;
		}
		:host([hidden]) {
			display: none;
		}
	`;

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		this.abortController?.abort();
		this.abortController = undefined;
		this.activePath = undefined;
		this.requestSeq++;
		this.renderedPath = undefined;
	}

	override willUpdate(): void {
		const route = this.route.value;
		const path = route.kind === 'reserved' ? route.path : undefined;
		// Opening or switching a reserved route creates a fresh dialog instance. Leaving
		// one keeps the current instance connected so it closes in place and the browser
		// returns focus to its invoker.
		if (path !== undefined && path !== this.renderedPath) this.dialogKey++;
		this.renderedPath = path;
		if (route.kind === 'reserved' && route.path !== this.activePath) {
			this.status = 'loading';
			this.entry = undefined;
			this.body = undefined;
		}
	}

	override updated(): void {
		if (!this.isConnected) return;
		const route = this.route.value;
		if (route.kind === 'reserved') {
			if (this.activePath !== route.path) this.startLoad(route.path);
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
		void loadContentEntry('pages', RESERVED_CONTENT[path], {
			locale: BASE_LOCALE,
			signal: controller.signal
		})
			.then(({ entry, content }) => {
				if (
					controller.signal.aborted ||
					seq !== this.requestSeq ||
					this.activePath !== path
				)
					return;
				this.entry = entry;
				this.body = content;
				this.status = 'loaded';
			})
			.catch(() => {
				if (
					controller.signal.aborted ||
					seq !== this.requestSeq ||
					this.activePath !== path
				)
					return;
				this.entry = undefined;
				this.body = undefined;
				this.status = 'error';
			});
	}

	private handleDialogClose(): void {
		const route = this.route.value;
		if (route.kind === 'reserved' && route.path === this.activePath) closeReserved();
	}

	override render() {
		const route = this.route.value;
		const path = route.kind === 'reserved' ? route.path : undefined;
		const t = this.translations.value;
		const samePath = path !== undefined && path === this.activePath;
		const ready =
			samePath &&
			this.status === 'loaded' &&
			this.entry !== undefined &&
			this.body !== undefined;
		const heading = ready
			? this.entry!.title
			: path === '/about'
				? t.about
				: path === '/privacy'
					? t.privacy
					: path === '/help'
						? t.help
						: path === '/help/configure-model'
							? t.configureModelHelp
							: path === '/help/training-setup'
								? t.trainingSetupHelp
								: '';
		// Each reserved-route opening owns its native dialog instance. A queued event from
		// an old route cannot dismiss a newer route after its instance is disconnected.
		return keyed(
			this.dialogKey,
			html`<app-content-dialog
				.open=${path !== undefined}
				.heading=${heading}
				.status=${ready
					? 'ready'
					: samePath && this.status === 'error'
						? 'error'
						: 'loading'}
				.content=${ready ? this.body! : null}
				.contentLang=${ready ? this.entry!.lang : ''}
				.contentDir=${ready ? LOCALES[this.entry!.lang].dir : ''}
				.labels=${{ close: t.close, loadError: t.loadError }}
				@app-content-dialog-close=${this.handleDialogClose}></app-content-dialog>`
		);
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'app-content-modal': AppContentModal;
	}
}
