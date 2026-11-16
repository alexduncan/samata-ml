import { describe, expect, it } from 'bun:test';
import { CSSResult } from 'lit';
import { buttonStyles } from '../src/styles/button.styles';
import { cardStyles } from '../src/styles/card.styles';
import { chicletStyles } from '../src/styles/chiclet.styles';
import { dialogStyles } from '../src/styles/dialog.styles';
import { initGlobalStyles } from '../src/styles/global';

describe('shared style primitives', () => {
	it('exports valid Lit CSSResult instances', () => {
		expect(buttonStyles).toBeInstanceOf(CSSResult);
		expect(chicletStyles).toBeInstanceOf(CSSResult);
		expect(cardStyles).toBeInstanceOf(CSSResult);
		expect(dialogStyles).toBeInstanceOf(CSSResult);
	});

	it('contains required selectors and tokens in buttonStyles', () => {
		expect(buttonStyles.cssText).toContain('.btn');
		expect(buttonStyles.cssText).toContain('.btn-primary');
		expect(buttonStyles.cssText).toContain('--surface');
		expect(buttonStyles.cssText).toContain('--focus-ring');
		expect(buttonStyles.cssText).toContain('prefers-reduced-motion');
	});

	it('contains required selectors and tokens in cardStyles', () => {
		expect(cardStyles.cssText).toContain('.card');
		expect(cardStyles.cssText).toContain('--surface');
		expect(cardStyles.cssText).toContain('.card-title');
		expect(cardStyles.cssText).toContain('.card-actions');
		expect(cardStyles.cssText).toContain('::slotted(svg)');
	});

	it('contains required selectors and color variants in chicletStyles', () => {
		expect(chicletStyles.cssText).toContain('.chiclet');
		expect(chicletStyles.cssText).toContain('.chiclet-purple');
		expect(chicletStyles.cssText).toContain('.chiclet-teal');
		expect(chicletStyles.cssText).toContain('.chiclet-amber');
	});

	it('contains dialog and backdrop rules in dialogStyles', () => {
		expect(dialogStyles.cssText).toContain('dialog');
		expect(dialogStyles.cssText).toContain('dialog::backdrop');
		expect(dialogStyles.cssText).toContain('overscroll-behavior: contain');
	});

	it('adopts sheets into document via initGlobalStyles', () => {
		const initialCount = document.adoptedStyleSheets.length;
		initGlobalStyles();
		expect(document.adoptedStyleSheets.length).toBeGreaterThanOrEqual(initialCount + 1);
	});
});
