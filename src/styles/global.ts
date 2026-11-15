import { buttonStyles } from './button.styles';
import { chicletStyles } from './chiclet.styles';
import { dialogStyles } from './dialog.styles';
import { notificationStyles } from './notification.styles';
import { tableStyles } from './table.styles';
import { trainModelStyles } from './train-model.styles';

/**
 * Adopts document-level style sheets (buttons, chiclets, dialogs, tables, notifications, train-model) into document.adoptedStyleSheets.
 * Follows specification/COMPONENTS.md §6.2 and specification/plans/step-2-set-target.md §D4.
 */
export function initGlobalStyles(): void {
	if (typeof document === 'undefined') return;

	const sheets = [
		buttonStyles,
		chicletStyles,
		dialogStyles,
		tableStyles,
		notificationStyles,
		trainModelStyles
	]
		.map((s) => s.styleSheet)
		.filter((sheet): sheet is CSSStyleSheet => Boolean(sheet));

	document.adoptedStyleSheets = [...document.adoptedStyleSheets, ...sheets];
}
