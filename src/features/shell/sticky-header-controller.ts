import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { observeStickyHeader } from '../../common/sticky-header';

/** Options for {@link StickyHeaderController}. */
interface StickyHeaderControllerOptions {
	/** Called with the header's effective block size in CSS pixels (0 while the viewport is short). */
	readonly onBlockSize?: (px: number) => void;
}

/**
 * Keeps `--page-header-block-size` on the document root in step with a route view's sticky
 * `.page-header`, so scroll padding keeps focus clear of it.
 *
 * Authorised shared helper under specification/COMPONENTS.md §3 (virtual-table-improvements D23).
 * It observes the host's own render root only and writes no other element's styles.
 */
export class StickyHeaderController implements ReactiveController {
	private readonly host: ReactiveControllerHost & { readonly renderRoot: ParentNode };
	private readonly options: StickyHeaderControllerOptions;
	private observed: Element | null = null;
	private dispose: (() => void) | null = null;

	constructor(
		host: ReactiveControllerHost & { readonly renderRoot: ParentNode },
		options: StickyHeaderControllerOptions = {}
	) {
		this.host = host;
		this.options = options;
		host.addController(this);
	}

	hostConnected(): void {
		this.sync();
	}

	hostUpdated(): void {
		this.sync();
	}

	hostDisconnected(): void {
		this.release();
	}

	private sync(): void {
		const header = this.host.renderRoot?.querySelector('.page-header') ?? null;
		if (header === this.observed) return;
		this.release();
		if (!header) return;
		this.observed = header;
		this.dispose = observeStickyHeader(header, this.options);
	}

	private release(): void {
		this.dispose?.();
		this.dispose = null;
		this.observed = null;
	}
}
