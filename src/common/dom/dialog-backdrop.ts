/**
 * Enables native modal backdrop dismissal on browsers without the closedBy property.
 *
 * @param dialog - The content dialog receiving native backdrop pointer events.
 * @param canClose - Whether the current dialog state permits user dismissal.
 * @returns A cleanup operation for owner teardown.
 */
export function installBackdropDismiss(
	dialog: HTMLDialogElement,
	canClose: () => boolean = () => true
): () => void {
	if ('closedBy' in HTMLDialogElement.prototype) return () => {};

	let pointerId: number | undefined;
	const clear = () => {
		pointerId = undefined;
	};
	const onBackdrop = (event: PointerEvent) => {
		if (event.target !== dialog || !dialog.open || !dialog.matches(':modal') || !canClose()) {
			return false;
		}
		const { left, top, right, bottom } = dialog.getBoundingClientRect();
		return (
			event.clientX < left ||
			event.clientX >= right ||
			event.clientY < top ||
			event.clientY >= bottom
		);
	};
	const down = (event: PointerEvent) => {
		clear();
		if (event.isPrimary && event.button === 0 && onBackdrop(event)) pointerId = event.pointerId;
	};
	const up = (event: PointerEvent) => {
		const canDismiss = event.isPrimary && event.button === 0 && pointerId === event.pointerId;
		clear();
		if (canDismiss && onBackdrop(event)) dialog.close();
	};
	dialog.addEventListener('pointerdown', down);
	dialog.addEventListener('pointerup', up);
	dialog.addEventListener('pointercancel', clear);
	dialog.addEventListener('close', clear);
	return () => {
		clear();
		dialog.removeEventListener('pointerdown', down);
		dialog.removeEventListener('pointerup', up);
		dialog.removeEventListener('pointercancel', clear);
		dialog.removeEventListener('close', clear);
	};
}
