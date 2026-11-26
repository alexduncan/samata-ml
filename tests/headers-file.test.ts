import { describe, expect, test } from 'bun:test';
import { parseHeadersFile, resolveHeaders } from '../scripts/headers-file';

describe('_headers parser and resolver', () => {
	test('REL-CACHE-3: parses rules, matches single splat across slashes, joins duplicates and detaches with !', () => {
		const raw = [
			'# Comment line',
			'/*',
			'  X-Test: base',
			'  Cache-Control: public, max-age=0, must-revalidate',
			'',
			'/bundles/*',
			'  ! Cache-Control',
			'  Cache-Control: public, max-age=31536000, immutable',
			'  X-Test: extra',
			'',
			'/exact.json',
			'  ! X-Unused',
			'  X-Exact: yes'
		].join('\n');

		const rules = parseHeadersFile(raw);
		expect(rules).toHaveLength(3);

		const root = resolveHeaders(rules, '/');
		expect(root.get('cache-control')).toBe('public, max-age=0, must-revalidate');
		expect(root.get('x-test')).toBe('base');

		const nestedBundle = resolveHeaders(rules, '/bundles/chunks/chunk-abc.js');
		expect(nestedBundle.get('cache-control')).toBe('public, max-age=31536000, immutable');
		expect(nestedBundle.get('x-test')).toBe('base, extra');

		const exact = resolveHeaders(rules, '/exact.json');
		expect(exact.get('x-exact')).toBe('yes');
		expect(exact.get('x-test')).toBe('base');
	});

	test('REL-CACHE-3: detach before broader rule has no effect on values added later', () => {
		const raw = [
			'/special/*',
			'  ! Cache-Control',
			'',
			'/*',
			'  Cache-Control: public, max-age=0, must-revalidate'
		].join('\n');

		const resolved = resolveHeaders(parseHeadersFile(raw), '/special/file.js');
		expect(resolved.get('cache-control')).toBe('public, max-age=0, must-revalidate');
	});

	test('REL-CACHE-3: rejects malformed syntax, multiple splats and :placeholder tokens', () => {
		expect(() => parseHeadersFile('no-leading-slash\n  X-A: 1\n')).toThrow();
		expect(() => parseHeadersFile('  X-Orphan: 1\n')).toThrow();
		expect(() => parseHeadersFile('/a/*/b/*\n  X-A: 1\n')).toThrow();
		expect(() => parseHeadersFile('/users/:id\n  X-A: 1\n')).toThrow();
		expect(() => parseHeadersFile('/*\n  MissingColon\n')).toThrow();
		expect(() => parseHeadersFile('/*\n  ! Bad:Name\n')).toThrow();
		expect(() => resolveHeaders([], 'relative/path')).toThrow();
	});
});
