/** Media query under which every page header is `position: static` (visual-design SHELL-UI-05). */
const SHORT_VIEWPORT_QUERY = '(max-height: 30rem)';

/** Root custom property that holds the active page header's effective block size. */
const BLOCK_SIZE_PROPERTY = '--page-header-block-size';

/** Options for {@link observeStickyHeader}. */
export interface StickyHeaderOptions {
	/** Called with the effective block size in CSS pixels (0 while the viewport is short). */
	readonly onBlockSize?: (px: number) => void;
}

/** The observation that most recently took ownership of the root custom property. */
let owner: symbol | null = null;

/**
 * Measures a sticky page header and publishes its effective block size.
 *
 * The block size is written to `--page-header-block-size` on the document root so
 * `scroll-padding-block-start` keeps focused elements clear of the header (WCAG 2.4.11).
 * It is 0 while `(max-height: 30rem)` matches because the header is then static. The observation
 * that started most recently owns the property, so an older observation that is disposed late
 * never clears a newer header's value.
 *
 * @param header - The page header element to observe.
 * @param options - Optional callback receiving the effective block size.
 * @returns A dispose function that stops observing and resets the property when still the owner.
 */
export function observeStickyHeader(
	header: Element,
	options: StickyHeaderOptions = {}
): () => void {
	const token = Symbol('sticky-header');
	owner = token;
	const root = document.documentElement;
	const query = window.matchMedia(SHORT_VIEWPORT_QUERY);
	let disposed = false;

	const publish = (blockSize: number): void => {
		const effective = query.matches ? 0 : blockSize;
		if (owner === token) root.style.setProperty(BLOCK_SIZE_PROPERTY, `${effective}px`);
		options.onBlockSize?.(effective);
	};
	const measure = (): void => {
		if (!disposed) publish(header.getBoundingClientRect().height);
	};

	const resizeObserver = new ResizeObserver((entries) => {
		if (disposed) return;
		const size = entries.at(-1)?.borderBoxSize?.[0];
		publish(size ? size.blockSize : header.getBoundingClientRect().height);
	});
	resizeObserver.observe(header, { box: 'border-box' });
	query.addEventListener('change', measure);
	measure();

	return () => {
		if (disposed) return;
		disposed = true;
		resizeObserver.disconnect();
		query.removeEventListener('change', measure);
		if (owner === token) {
			owner = null;
			root.style.setProperty(BLOCK_SIZE_PROPERTY, '0px');
		}
		options.onBlockSize?.(0);
	};
}
