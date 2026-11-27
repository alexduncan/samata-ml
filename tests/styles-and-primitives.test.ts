import { describe, expect, it } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
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

	it('BTN-AC-15: .btn-red uses red-700 text and border on --surface, red-100 on hover, with AA contrast', () => {
		const css = buttonStyles.cssText.replace(/\s+/g, ' ');
		expect(css).toMatch(
			/\.btn-red \{[^}]*border-color: var\(--red-700\);[^}]*background-color: var\(--surface\);[^}]*color: var\(--red-700\);/
		);
		expect(css).toMatch(
			/\.btn-red \{[^}]*&:hover:not\(:disabled\) \{ border-color: var\(--red-700\); background-color: var\(--red-100\); color: var\(--red-700\);/
		);
		expect(css).not.toMatch(/\.btn-red[^}]*outline/);

		const root = fs.readFileSync(path.resolve('css/root.css'), 'utf8');
		const token = (name: string): string => {
			const hex = root.match(new RegExp(`--${name}:\\s*#([0-9a-fA-F]{3,6});`))![1]!;
			const full = hex.length === 3 ? [...hex].map((digit) => digit + digit).join('') : hex;
			return `#${full}`;
		};
		const luminance = (hex: string): number => {
			const channels = [1, 3, 5].map((index) => {
				const value = parseInt(hex.slice(index, index + 2), 16) / 255;
				return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
			});
			return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
		};
		const contrast = (first: string, second: string): number => {
			const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
			return (light! + 0.05) / (dark! + 0.05);
		};
		expect(contrast(token('red-700'), token('surface'))).toBeGreaterThanOrEqual(4.5);
		expect(contrast(token('red-700'), token('red-100'))).toBeGreaterThanOrEqual(4.5);
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
