import { describe, expect, it } from 'bun:test';
import {
	FRAGMENT_POLICY,
	isAllowedAttribute,
	isAllowedHref,
	isAllowedImageSrc,
	isExternalHref
} from '../src/common/content/fragment-policy';
import { BASE_LOCALE, LOCALES, isLocale } from '../src/config/locales';
import { RESERVED_CONTENT } from '../src/router/reserved-content';
import type { ReservedPath } from '../src/types/routes';

describe('Content policy, locales and reserved-route map', () => {
	it('CNT-P-1: validates allowed and rejected href schemes and anchors', () => {
		expect(isAllowedHref('https://x.org/a')).toBe(true);
		expect(isAllowedHref('http://x.org')).toBe(true);
		expect(isAllowedHref('mailto:a@b.c')).toBe(true);
		expect(isAllowedHref('#intro')).toBe(true);

		expect(isAllowedHref('/about')).toBe(false);
		expect(isAllowedHref('./a')).toBe(false);
		expect(isAllowedHref('//x.org')).toBe(false);
		expect(isAllowedHref('javascript:alert(1)')).toBe(false);
		expect(isAllowedHref('data:text/html,x')).toBe(false);
		expect(isAllowedHref('JAVASCRIPT:alert(1)')).toBe(false);
		expect(isAllowedHref('')).toBe(false);
		expect(isAllowedHref('#')).toBe(false);
		expect(isAllowedHref('mailto:')).toBe(false);

		expect(isExternalHref('https://x.org/a')).toBe(true);
		expect(isExternalHref('http://x.org')).toBe(true);
		expect(isExternalHref('mailto:a@b.c')).toBe(false);
		expect(isExternalHref('#intro')).toBe(false);
	});

	it('CNT-P-2: enforces element and attribute allow-list rules', () => {
		expect(isAllowedAttribute('code', 'class', 'language-ts')).toBe(true);
		expect(isAllowedAttribute('code', 'class', 'evil')).toBe(false);
		expect(isAllowedAttribute('p', 'class', 'x')).toBe(false);
		expect(isAllowedAttribute('a', 'onclick', 'x')).toBe(false);
		expect(isAllowedAttribute('img', 'srcset', 'x')).toBe(false);

		expect(isAllowedAttribute('h2', 'id', 'intro')).toBe(true);
		expect(isAllowedAttribute('h1', 'id', 'title')).toBe(false);
		expect(isAllowedAttribute('ol', 'start', '3')).toBe(true);
		expect(isAllowedAttribute('a', 'href', 'https://x.org')).toBe(true);
		expect(isAllowedAttribute('a', 'href', 'javascript:x')).toBe(false);
		expect(isAllowedAttribute('a', 'target', '_blank')).toBe(true);
		expect(isAllowedAttribute('a', 'target', '_self')).toBe(false);
		expect(isAllowedAttribute('a', 'rel', 'noopener noreferrer')).toBe(true);
		expect(isAllowedAttribute('img', 'src', '/assets/chart.svg')).toBe(true);
		expect(isAllowedAttribute('img', 'src', 'https://x.org/i.png')).toBe(false);

		expect(FRAGMENT_POLICY.elements.has('h1')).toBe(false);
		expect(FRAGMENT_POLICY.elements.has('script')).toBe(false);
		expect(FRAGMENT_POLICY.elements.has('h2')).toBe(true);
	});

	it('isAllowedImageSrc accepts root-absolute paths and rejects protocol-relative or external URLs', () => {
		expect(isAllowedImageSrc('/assets/linear-regression.svg')).toBe(true);
		expect(isAllowedImageSrc('//evil.org/x.png')).toBe(false);
		expect(isAllowedImageSrc('/\\evil.org/x.png')).toBe(false);
		expect(isAllowedImageSrc('https://e.org/i.png')).toBe(false);
		expect(isAllowedImageSrc('assets/x.png')).toBe(false);
		expect(isAllowedImageSrc('/')).toBe(false);
	});

	it('CNT-P-3: RESERVED_CONTENT maps every ReservedPath to its page id', () => {
		const expectedPaths: ReservedPath[] = [
			'/about',
			'/privacy',
			'/help',
			'/help/configure-model',
			'/help/select-features',
			'/help/training-setup'
		];
		expect(Object.keys(RESERVED_CONTENT).sort()).toEqual(expectedPaths.sort());
		expect(RESERVED_CONTENT['/about']).toBe('about');
		expect(RESERVED_CONTENT['/privacy']).toBe('privacy-policy');
		expect(RESERVED_CONTENT['/help']).toBe('help');
		expect(RESERVED_CONTENT['/help/configure-model']).toBe('configure-model');
		expect(RESERVED_CONTENT['/help/select-features']).toBe('select-features');
		expect(RESERVED_CONTENT['/help/training-setup']).toBe('training-setup');
	});

	it('CNT-P-4: BASE_LOCALE is en and isLocale checks supported locales strictly', () => {
		expect(BASE_LOCALE).toBe('en');
		expect(Object.hasOwn(LOCALES, BASE_LOCALE)).toBe(true);
		expect(LOCALES[BASE_LOCALE].dir).toBe('ltr');

		expect(isLocale('en')).toBe(true);
		expect(isLocale('fr')).toBe(false);
		expect(isLocale('EN')).toBe(false);
		expect(isLocale('datasets')).toBe(false);
		expect(isLocale('toString')).toBe(false);
	});
});
