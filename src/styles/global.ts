import { buttonStyles } from './button.styles';
import { chicletStyles } from './chiclet.styles';
import { dialogStyles } from './dialog.styles';
import { notificationStyles } from './notification.styles';
import { tableStyles } from './table.styles';

/**
 * Adopts document-level style sheets (buttons, chiclets, dialogs, tables, notifications) into document.adoptedStyleSheets.
 * Follows specification/COMPONENTS.md §6.2 and specification/plans/step-2-set-target.md §D4.
 */
export function initGlobalStyles(): void {
	if (typeof document === 'undefined') return;

	const sheets = [buttonStyles, chicletStyles, dialogStyles, tableStyles, notificationStyles]
		.map((s) => s.styleSheet)
		.filter((sheet): sheet is CSSStyleSheet => Boolean(sheet));

	document.adoptedStyleSheets = [...document.adoptedStyleSheets, ...sheets];
}
