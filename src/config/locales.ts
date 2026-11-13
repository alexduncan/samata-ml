/**
 * Supported locale configurations.
 * Keys are BCP 47 language tags; each value records the writing direction.
 */
export const LOCALES = {
	en: { dir: 'ltr' }
} as const satisfies Readonly<Record<string, { readonly dir: 'ltr' | 'rtl' }>>;

/** Supported locale identifier. */
export type Locale = keyof typeof LOCALES;

/** Default and complete base locale used as the build-time fallback source of truth. */
export const BASE_LOCALE: Locale = 'en';

/**
 * Type guard checking whether a string is a supported locale identifier.
 *
 * @param value - Candidate locale tag to check.
 * @returns True if `value` is an own key of {@link LOCALES}.
 */
export function isLocale(value: string): value is Locale {
	return Object.hasOwn(LOCALES, value);
}
