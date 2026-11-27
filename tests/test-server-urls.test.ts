import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT_DIR } from '../scripts/config';

const FORBIDDEN = /localhost:(3000|3001|3333)/;

/** Returns `label:line` for each line that hard-codes a primary-checkout server URL. */
function findHardCodedUrls(label: string, text: string): string[] {
	return text
		.split('\n')
		.flatMap((line, index) => (FORBIDDEN.test(line) ? [`${label}:${index + 1}`] : []));
}

function walk(dir: string, match: (file: string) => boolean): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) return walk(full, match);
		return match(full) ? [full] : [];
	});
}

describe('test server URLs', () => {
	test('scanner reports a hard-coded URL', () => {
		const sample = "const a = 1;\nconst url = 'http://localhost:3333/x';\n";
		expect(findHardCodedUrls('sample.ts', sample)).toEqual(['sample.ts:2']);
	});

	test('Playwright config and e2e tests take URLs from scripts/ports.ts', () => {
		const testsDir = path.join(ROOT_DIR, 'tests');
		const files = [
			path.join(ROOT_DIR, 'playwright.config.ts'),
			...walk(testsDir, (file) => file.endsWith('.e2e.ts')),
			...walk(path.join(testsDir, 'helpers'), (file) => file.endsWith('.ts')),
			...walk(path.join(testsDir, 'visual-parity'), (file) => file.endsWith('.ts'))
		];
		const hits = files.flatMap((file) =>
			findHardCodedUrls(path.relative(ROOT_DIR, file), readFileSync(file, 'utf8'))
		);
		expect(hits).toEqual([]);
	});
});
