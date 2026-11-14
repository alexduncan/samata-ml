import { createI18n, formatter } from '@nanostores/i18n';
import { atom } from 'nanostores';
import { BASE_LOCALE, LOCALES, type Locale } from './config/locales';

/**
 * Read-only store holding the current locale.
 * The only shipped base locale is currently 'en'.
 */
export const $locale = atom<Locale>(BASE_LOCALE);

/**
 * Formatter atom providing locale-aware number and date/time formatting.
 */
export const $format = formatter($locale);

/**
 * Nano Stores i18n instance for component-level translation dictionaries.
 * For the base 'en' locale, components supply their own base messages.
 */
export const i18n = createI18n($locale, {
	baseLocale: BASE_LOCALE,
	async get() {
		return {};
	}
});

if (typeof document !== 'undefined') {
	$locale.subscribe((loc) => {
		document.documentElement.lang = loc;
		document.documentElement.dir = LOCALES[loc]?.dir ?? 'ltr';
	});
}
