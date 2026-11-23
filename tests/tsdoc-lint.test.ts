import { afterEach, describe, expect, it } from 'bun:test';
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { lintTsdoc } from '../scripts/lint-tsdoc';

const FIXTURES_DIR = path.resolve('tests/fixtures/tsdoc');
const tempDirs: string[] = [];

afterEach(() => {
	while (tempDirs.length > 0) {
		const dir = tempDirs.pop();
		if (dir) rmSync(dir, { recursive: true, force: true });
	}
});

describe('scripts/lint-tsdoc', () => {
	it('passes cleanly across src and scripts', async () => {
		const messages = await lintTsdoc(['src', 'scripts']);
		expect(messages).toEqual([]);
	});

	it('accepts valid TSDoc including @fires and ignores declaration and non-TSDoc comments', async () => {
		const messages = await lintTsdoc([
			path.join(FIXTURES_DIR, 'valid.ts'),
			path.join(FIXTURES_DIR, 'ignored.d.ts')
		]);
		expect(messages).toEqual([]);
	});

	it('reports exact file, line, column and messageId for malformed TSDoc', async () => {
		const messages = await lintTsdoc([path.join(FIXTURES_DIR, 'malformed-tsdoc.ts')]);
		expect(messages.map((m) => [m.file, m.line, m.column, m.messageId])).toEqual([
			['tests/fixtures/tsdoc/malformed-tsdoc.ts', 4, 4, 'tsdoc-param-tag-missing-hyphen'],
			['tests/fixtures/tsdoc/malformed-tsdoc.ts', 5, 4, 'tsdoc-undefined-tag'],
			['tests/fixtures/tsdoc/malformed-tsdoc.ts', 12, 28, 'tsdoc-malformed-inline-tag'],
			['tests/fixtures/tsdoc/malformed-tsdoc.ts', 12, 38, 'tsdoc-escape-right-brace']
		]);
	});

	it('expands directories deterministically in sorted order and skips .d.ts files', async () => {
		const dir = mkdtempSync(path.join(tmpdir(), 'tsdoc-order-'));
		tempDirs.push(dir);
		writeFileSync(path.join(dir, 'ignored.d.ts'), '/** @bogusTag */\nexport {};\n');
		writeFileSync(path.join(dir, 'z-file.ts'), '/** @zBadTag */\nexport const z = 1;\n');
		writeFileSync(path.join(dir, 'a-file.ts'), '/** @aBadTag */\nexport const a = 1;\n');

		const messages = await lintTsdoc([dir]);
		expect(messages.map((m) => path.basename(m.file))).toEqual(['a-file.ts', 'z-file.ts']);
		expect(messages.every((m) => m.messageId === 'tsdoc-undefined-tag')).toBe(true);
	});

	it('reports syntax parse errors and exits non-zero from the CLI', async () => {
		const dir = mkdtempSync(path.join(tmpdir(), 'tsdoc-cli-'));
		tempDirs.push(dir);
		const brokenPath = path.join(dir, 'broken.ts');
		copyFileSync(path.join(FIXTURES_DIR, 'syntax-error.txt'), brokenPath);

		const messages = await lintTsdoc([brokenPath]);
		expect(messages).toHaveLength(1);
		expect(messages[0]?.messageId).toBe('parse-error');

		const malformedProc = Bun.spawnSync(
			['bun', 'run', 'scripts/lint-tsdoc.ts', path.join(FIXTURES_DIR, 'malformed-tsdoc.ts')],
			{ stdout: 'pipe', stderr: 'pipe' }
		);
		expect(malformedProc.exitCode).toBe(1);
		const stderrText = new TextDecoder().decode(malformedProc.stderr);
		expect(stderrText).toContain(
			'tests/fixtures/tsdoc/malformed-tsdoc.ts:4:4 tsdoc-param-tag-missing-hyphen'
		);

		const parseFailProc = Bun.spawnSync(['bun', 'run', 'scripts/lint-tsdoc.ts', brokenPath], {
			stdout: 'pipe',
			stderr: 'pipe'
		});
		expect(parseFailProc.exitCode).toBe(1);
		expect(new TextDecoder().decode(parseFailProc.stderr)).toContain('parse-error');
	});
});
