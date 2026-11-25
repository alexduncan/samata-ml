/**
 * Keeps keyboard focus below a sticky header while a content modal is open.
 * Releases observation and resets the temporary styles at native close or owner teardown.
 *
 * @param dialog - The opened native content modal containing its header.
 * @returns A cleanup operation for owner teardown.
 */
export function observeDialogHeader(dialog: HTMLDialogElement): () => void {
	const header = dialog.querySelector<HTMLElement>('.modal-header');
	if (!header) return () => {};

	let focusFrame = 0;
	const update = () => {
		if (!dialog.open) return;
		const blockSize = header.getBoundingClientRect().height;
		const unpin = blockSize > dialog.clientHeight / 2;
		dialog.toggleAttribute('data-header-unpinned', unpin);
		dialog.style.scrollPaddingBlockStart = unpin ? '' : `${blockSize}px`;
	};
	const keepFocusVisible = (event: FocusEvent) => {
		const target = event.target;
		cancelAnimationFrame(focusFrame);
		if (!(target instanceof Element) || target === dialog || header.contains(target)) return;
		focusFrame = requestAnimationFrame(() => {
			if (!dialog.open || dialog.hasAttribute('data-header-unpinned')) return;
			// Some browsers leave an already visible target beneath the sticky header on reverse Tab.
			const overlap =
				header.getBoundingClientRect().bottom - target.getBoundingClientRect().top;
			if (overlap > 0) dialog.scrollTop -= Math.ceil(overlap);
		});
	};
	const observer = new ResizeObserver(update);
	const close = () => {
		if (!dialog.open) cleanup();
	};
	const cleanup = () => {
		cancelAnimationFrame(focusFrame);
		observer.disconnect();
		dialog.removeEventListener('close', close);
		dialog.removeEventListener('focusin', keepFocusVisible);
		dialog.removeAttribute('data-header-unpinned');
		dialog.style.removeProperty('scroll-padding-block-start');
	};
	dialog.addEventListener('close', close);
	dialog.addEventListener('focusin', keepFocusVisible);
	observer.observe(header);
	observer.observe(dialog);
	update();
	return cleanup;
}
