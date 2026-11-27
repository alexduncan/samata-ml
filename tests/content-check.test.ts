import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	symlinkSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ROOT_DIR } from '../scripts/config';

const PAGE = 'content/en/pages/about.md';
const ASSET = 'public/assets/diagram.svg';
const DATASHEET = 'content/datasets/sample/datasheet.md';
const VALID_PAGE = '# About\n\nUpdated copy.\n\n![Diagram](/assets/diagram.svg)\n';
const INVALID_PAGE = '# About\n\n[Missing section](#missing)\n';
const VALID_DATASHEET = '# Sample\n\nAn authored datasheet.\n';
const INVALID_DATASHEET = '# Sample\n\n![Missing image](/missing.svg)\n';

let root: string;
let scratch: string;

function write(file: string, content: string): void {
	const target = path.join(root, file);
	mkdirSync(path.dirname(target), { recursive: true });
	writeFileSync(target, content);
}

function run(...args: string[]) {
	const result = Bun.spawnSync(args, {
		cwd: root,
		env: { ...process.env, TMPDIR: scratch }
	});
	return {
		code: result.exitCode,
		out: result.stdout.toString(),
		err: result.stderr.toString()
	};
}

function git(...args: string[]): string {
	const result = run('git', ...args);
	if (result.code !== 0) throw new Error(result.err);
	return result.out;
}

function check() {
	return run(process.execPath, 'run', 'content:check');
}

function commit() {
	return run('git', 'commit', '-m', 'Check staged content');
}

function expectSnapshotRemoved(): void {
	const prefix = 'samata-content-index-';
	const snapshots = readdirSync(scratch).filter((file) => file.startsWith(prefix));
	expect(snapshots).toEqual([]);
}

beforeEach(() => {
	root = mkdtempSync(path.join(tmpdir(), 'samata-content-check-test-'));
	scratch = path.join(root, 'tmp');
	mkdirSync(scratch);
	write('.gitignore', 'node_modules\ntmp\n');
	write(
		'package.json',
		JSON.stringify({
			type: 'module',
			scripts: { 'content:check': 'bun run scripts/check-content.ts' }
		})
	);
	for (const file of [
		'.githooks/pre-commit',
		'scripts/build-content.ts',
		'scripts/check-content.ts',
		'scripts/config.ts',
		'scripts/dataset-datasheets.ts',
		'scripts/markdown.ts',
		'src/common/content/fragment-policy.ts',
		'src/config/locales.ts',
		'src/router/reserved-content.ts'
	]) {
		const target = path.join(root, file);
		mkdirSync(path.dirname(target), { recursive: true });
		cpSync(path.join(ROOT_DIR, file), target);
	}
	cpSync(path.join(ROOT_DIR, 'tests/fixtures/content/valid-en'), path.join(root, 'content'), {
		recursive: true
	});
	symlinkSync(path.join(ROOT_DIR, 'node_modules'), path.join(root, 'node_modules'), 'junction');
	write(ASSET, '<svg xmlns="http://www.w3.org/2000/svg"/>\n');
	write(PAGE, VALID_PAGE);
	write(DATASHEET, VALID_DATASHEET);

	git('init', '-q');
	git('config', 'user.name', 'Content Fixture');
	git('config', 'user.email', 'fixture@example.invalid');
	git('config', 'commit.gpgsign', 'false');
	git('config', 'core.hooksPath', '.githooks');
	const files = [
		'.githooks',
		'.gitignore',
		'content',
		'package.json',
		'public',
		'scripts',
		'src'
	];
	git('add', '--', ...files);
	const initial = commit();
	if (initial.code !== 0) throw new Error(initial.err);
});

afterEach(() => {
	if (root) rmSync(root, { recursive: true, force: true });
});

describe('content:check', () => {
	test('accepts a copy-only edit and uses public assets without emitting output', () => {
		write(PAGE, VALID_PAGE.replace('Updated copy.', 'Revised wording.'));
		const result = check();
		expect(result.code).toBe(0);
		expect(result.out).toContain('Authored Markdown passed validation.');
		expect(existsSync(path.join(root, 'content/en/pages/index.json'))).toBe(false);
		expect(existsSync(path.join(root, 'dev'))).toBe(false);
		expect(existsSync(path.join(root, 'dist'))).toBe(false);
	});

	test('reports all article and datasheet errors in path order', () => {
		write(PAGE, `---\ntitle: [malformed\n---\n\n${INVALID_PAGE}`);
		write(DATASHEET, INVALID_DATASHEET);
		rmSync(path.join(root, 'content/en/pages/privacy-policy.md'));
		const result = check();
		expect(result.code).toBe(1);
		const datasheet = result.err.indexOf('datasets/sample/datasheet.md: image');
		const anchor = result.err.indexOf('en/pages/about.md: broken same-fragment anchor');
		const yaml = result.err.indexOf('en/pages/about.md: invalid front matter');
		const required = result.err.indexOf('en/pages/privacy-policy.md: missing base-locale');
		expect(datasheet).toBeGreaterThanOrEqual(0);
		expect(anchor).toBeGreaterThan(datasheet);
		expect(yaml).toBeGreaterThan(anchor);
		expect(required).toBeGreaterThan(yaml);
	});

	test('checks for orphan translations with the configured locales', () => {
		const locales = 'src/config/locales.ts';
		const configured = readFileSync(path.join(root, locales), 'utf8');
		const english = "en: { dir: 'ltr' }";
		write(locales, configured.replace(english, `${english}, fr: { dir: 'ltr' }`));
		write('content/fr/pages/orphan.md', '# Orphan\n\nTranslation.\n');
		const result = check();
		expect(result.code).toBe(1);
		expect(result.err).toContain("fr/pages/orphan.md: translation 'orphan' has no matching");
	});
});

describe('pre-commit content validation', () => {
	test('rejects invalid staged content even after a fix in the working tree', () => {
		write(PAGE, INVALID_PAGE);
		git('add', '--', PAGE);
		write(PAGE, VALID_PAGE);

		const result = commit();
		expect(result.code).toBe(1);
		expect(result.err).toContain('en/pages/about.md: broken same-fragment anchor');
		expect(git('show', `:${PAGE}`)).toBe(INVALID_PAGE);
		expect(readFileSync(path.join(root, PAGE), 'utf8')).toBe(VALID_PAGE);
		expectSnapshotRemoved();
	});

	test('commits valid staged content even if the unstaged version is invalid', () => {
		const revised = VALID_PAGE.replace('Updated copy.', 'Revised wording.');
		write(PAGE, revised);
		git('add', '--', PAGE);
		write(PAGE, INVALID_PAGE);

		expect(commit().code).toBe(0);
		expect(git('show', `HEAD:${PAGE}`)).toBe(revised);
		expect(readFileSync(path.join(root, PAGE), 'utf8')).toBe(INVALID_PAGE);
		expectSnapshotRemoved();
	});

	test('rejects staged deletions and renames even without formatted files', () => {
		git('rm', '--', ASSET);
		write(ASSET, '<svg/>\n');
		const removal = commit();
		expect(removal.code).toBe(1);
		expect(removal.err).toContain('image "/assets/diagram.svg" does not exist');
		expectSnapshotRemoved();

		git('add', '--', ASSET);
		const required = 'content/en/pages/privacy-policy.md';
		git('mv', '--', required, 'content/en/pages/replacement.md');
		const rename = commit();
		expect(rename.code).toBe(1);
		expect(rename.err).toContain('en/pages/privacy-policy.md: missing base-locale');
		expectSnapshotRemoved();
	});

	test('skips compilation when only unrelated paths are staged', () => {
		write(PAGE, INVALID_PAGE);
		write('notes.txt', 'Unrelated notes.\n');
		git('add', '--', 'notes.txt');
		const result = commit();
		expect(result.code).toBe(0);
		expect(result.out).not.toContain('Authored Markdown passed validation.');
		expect(git('show', `HEAD:${PAGE}`)).toBe(VALID_PAGE);
		expectSnapshotRemoved();
	});
});
