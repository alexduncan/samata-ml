import { buttonStyles } from './button.styles';
import { chicletStyles } from './chiclet.styles';
import { dialogStyles } from './dialog.styles';

/**
 * Adopts document-level style sheets (buttons, chiclets, dialogs) into document.adoptedStyleSheets.
 * Follows specification/COMPONENTS.md §6.2.
 */
export function initGlobalStyles(): void {
	if (typeof document === 'undefined') return;

	const sheets = [buttonStyles, chicletStyles, dialogStyles]
		.map((s) => s.styleSheet)
		.filter((sheet): sheet is CSSStyleSheet => Boolean(sheet));

	document.adoptedStyleSheets = [...document.adoptedStyleSheets, ...sheets];
}
