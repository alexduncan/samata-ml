import { describe, expect, it } from 'bun:test';
import { count, params } from '@nanostores/i18n';
import { BASE_LOCALE, LOCALES } from '../src/config/locales';
import { $format, $locale, i18n } from '../src/i18n';

const messages = i18n('storybook-i18n-acceptance', {
	title: 'Dataset information',
	model: params<{ num: number }>('Model {num}'),
	rows: params<{ formatted: string }>(count({ one: '{formatted} row', many: '{formatted} rows' }))
});

describe('Existing i18n foundation', () => {
	it('I18N-AC-1: the existing instance supplies base English without narrowing the writable locale API', () => {
		expect(BASE_LOCALE).toBe('en');
		expect($locale.get()).toBe(BASE_LOCALE);
		$locale.set(BASE_LOCALE);
		expect(messages.get().title).toBe('Dataset information');
	});

	it('I18N-AC-2: params, numeric plural selection and locale-aware formatters compose', () => {
		const t = messages.get();
		const format = $format.get();
		expect(t.model({ num: 2 })).toBe('Model 2');
		expect(t.rows({ formatted: format.number(1) })(1)).toBe('1 row');
		expect(t.rows({ formatted: format.number(0) })(0)).toBe('0 rows');
		expect(t.rows({ formatted: format.number(12345) })(12345)).toBe('12,345 rows');
		expect(format.number(12345.67)).toBe('12,345.67');
		expect(
			format.time(new Date('2026-01-02T12:00:00Z'), {
				timeZone: 'UTC',
				year: 'numeric',
				month: '2-digit',
				day: '2-digit'
			})
		).toBe('01/02/2026');
	});

	it('I18N-AC-3: the existing document binding exposes the shipped language and direction', () => {
		expect(document.documentElement.lang).toBe(BASE_LOCALE);
		expect(document.documentElement.dir).toBe(LOCALES[BASE_LOCALE].dir);
		expect(document.documentElement.dir).toBe('ltr');
	});
});
