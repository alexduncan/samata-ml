import { afterEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { compileMarkdownFragment } from '../scripts/markdown';

const tempDirs: string[] = [];

function makeOutDir(): string {
	const dir = mkdtempSync(path.join(tmpdir(), 'samata-markdown-test-'));
	tempDirs.push(dir);
	return dir;
}

afterEach(() => {
	while (tempDirs.length > 0) {
		const dir = tempDirs.pop()!;
		rmSync(dir, { recursive: true, force: true });
	}
});

describe('Markdown fragment compiler', () => {
	it('CNT-M-1: strips front matter and leading H1, rewrites external links, deduplicates heading ids', async () => {
		const outDir = makeOutDir();
		const source = [
			'---',
			'title: T',
			'---',
			'# T',
			'',
			'Hello [x](https://e.org)',
			'',
			'## A b',
			'',
			'## A b'
		].join('\n');

		const result = await compileMarkdownFragment(source, {
			sourcePath: 'content/en/pages/sample.md',
			outDir,
			locale: 'en'
		});

		expect(result.errors).toEqual([]);
		expect(result.data.title).toBe('T');
		expect(result.leadingTitle).toBe('T');
		expect(result.html).not.toContain('---');
		expect(result.html).not.toContain('<h1');
		expect(result.html).toContain(
			'<a href="https://e.org" target="_blank" rel="noopener noreferrer">'
		);
		expect(result.html).toContain('<h2 id="a-b">A b</h2>');
		expect(result.html).toContain('<h2 id="a-b-2">A b</h2>');
		expect(result.headings).toEqual([
			{ id: 'a-b', text: 'A b', level: 2 },
			{ id: 'a-b-2', text: 'A b', level: 2 }
		]);
	});

	it('CNT-M-2: reports errors naming the file and rule for every disallowed construct', async () => {
		const outDir = makeOutDir();
		mkdirSync(path.join(outDir, 'assets'), { recursive: true });
		writeFileSync(path.join(outDir, 'assets', 'linear-regression.svg'), '<svg></svg>');

		const cases: { name: string; md: string; expectedSubstring: RegExp }[] = [
			{ name: 'block raw HTML', md: '<div>x</div>', expectedSubstring: /raw HTML/i },
			{ name: 'inline raw HTML', md: 'Hello <span>x</span>', expectedSubstring: /raw HTML/i },
			{ name: 'task list', md: '- [ ] task', expectedSubstring: /task-list/i },
			{ name: 'second H1', md: '# First\n\n# Second', expectedSubstring: /depth-1 heading/i },
			{ name: 'relative link', md: '[a](./b.md)', expectedSubstring: /disallowed link/i },
			{ name: 'app-route link', md: '[a](/about)', expectedSubstring: /disallowed link/i },
			{
				name: 'broken anchor',
				md: '[a](#missing)',
				expectedSubstring: /broken same-fragment anchor/i
			},
			{
				name: 'empty alt image',
				md: '![](/assets/linear-regression.svg)',
				expectedSubstring: /alt/i
			},
			{
				name: 'external image',
				md: '![x](https://e.org/i.png)',
				expectedSubstring: /root-absolute/i
			},
			{ name: 'missing image', md: '![x](/nope.png)', expectedSubstring: /does not exist/i }
		];

		for (const testCase of cases) {
			const sourcePath = `content/en/pages/${testCase.name}.md`;
			const result = await compileMarkdownFragment(testCase.md, {
				sourcePath,
				outDir,
				locale: 'en'
			});
			expect(result.errors.length).toBeGreaterThan(0);
			expect(
				result.errors.some(
					(e) => e.startsWith(sourcePath) && testCase.expectedSubstring.test(e)
				)
			).toBe(true);
		}

		const multi = await compileMarkdownFragment('<div>x</div>\n\n- [ ] task', {
			sourcePath: 'content/en/pages/multi.md',
			outDir,
			locale: 'en'
		});
		expect(multi.errors.length).toBeGreaterThanOrEqual(2);
		expect(multi.errors.some((e) => /raw HTML/i.test(e))).toBe(true);
		expect(multi.errors.some((e) => /task-list/i.test(e))).toBe(true);
	});

	it('CNT-M-3: validates existing images, strips table align, and keeps language class on code blocks', async () => {
		const outDir = makeOutDir();
		mkdirSync(path.join(outDir, 'assets'), { recursive: true });
		writeFileSync(path.join(outDir, 'assets', 'x.svg'), '<svg></svg>');

		const source = [
			'![Chart](/assets/x.svg)',
			'',
			'| Left | Center | Right |',
			'| :--- | :---: | ---: |',
			'| 1 | 2 | 3 |',
			'',
			'```ts',
			'const x = 1;',
			'```'
		].join('\n');

		const result = await compileMarkdownFragment(source, {
			sourcePath: 'content/en/models/example.md',
			outDir,
			locale: 'en'
		});

		expect(result.errors).toEqual([]);
		expect(result.html).toContain('<img src="/assets/x.svg" alt="Chart">');
		expect(result.html).toContain('<table>');
		expect(result.html).not.toContain('align=');
		expect(result.html).toContain('<code class="language-ts">');
	});

	it('CNT-M-4: generates Unicode-safe heading slugs and accepts matching anchors', async () => {
		const outDir = makeOutDir();
		const source = [
			'[Jump](#café-déjà-vu)',
			'',
			'## Café déjà vu',
			'',
			'## データの準備',
			'',
			'## Step 1: Load data!',
			'',
			'## ???'
		].join('\n');

		const result = await compileMarkdownFragment(source, {
			sourcePath: 'content/en/pages/unicode.md',
			outDir,
			locale: 'en'
		});

		expect(result.errors).toEqual([]);
		expect(result.headings.map((h) => h.id)).toEqual([
			'café-déjà-vu',
			'データの準備',
			'step-1-load-data',
			'section'
		]);
		expect(result.html).toContain('<h2 id="café-déjà-vu">');
		expect(result.html).toContain('<h2 id="データの準備">');
		expect(result.html).toContain('<h2 id="step-1-load-data">');
		expect(result.html).toContain('<h2 id="section">');
	});

	it('CNT-M-5: truncates firstParagraph at <= 160 code points on a word boundary for en and ja', async () => {
		const outDir = makeOutDir();

		const shortResult = await compileMarkdownFragment('Short summary paragraph.', {
			sourcePath: 'content/en/pages/short.md',
			outDir,
			locale: 'en'
		});
		expect(shortResult.firstParagraph).toBe('Short summary paragraph.');

		const longEnglish = Array.from({ length: 40 }, (_, i) => `word${i + 1}`).join(' ');
		expect(longEnglish.length).toBeGreaterThan(200);
		const longResult = await compileMarkdownFragment(longEnglish, {
			sourcePath: 'content/en/pages/long.md',
			outDir,
			locale: 'en'
		});
		expect(longResult.firstParagraph).toBeDefined();
		expect(Array.from(longResult.firstParagraph!).length).toBeLessThanOrEqual(160);
		expect(longResult.firstParagraph!.endsWith('…')).toBe(true);
		const withoutEllipsis = longResult.firstParagraph!.slice(0, -1);
		expect(longEnglish.startsWith(withoutEllipsis)).toBe(true);
		// Ensure it did not cut mid-word
		const nextChar = longEnglish[withoutEllipsis.length];
		expect(nextChar).toBe(' ');

		const jaPhrase = '機械学習モデルの学習と評価を行うためのデータ準備手順を説明します。';
		const longJapanese = jaPhrase.repeat(10); // > 300 chars, no spaces
		const jaResult = await compileMarkdownFragment(longJapanese, {
			sourcePath: 'content/ja/pages/long.md',
			outDir,
			locale: 'ja'
		});
		expect(jaResult.firstParagraph).toBeDefined();
		expect(Array.from(jaResult.firstParagraph!).length).toBeLessThanOrEqual(160);
		expect(jaResult.firstParagraph!.endsWith('…')).toBe(true);
		const jaPrefix = jaResult.firstParagraph!.slice(0, -1);
		expect(longJapanese.startsWith(jaPrefix)).toBe(true);
		// Verify word boundary alignment via Intl.Segmenter('ja')
		const jaSegmentEnds = new Set<number>();
		let acc = '';
		for (const seg of new Intl.Segmenter('ja', { granularity: 'word' }).segment(longJapanese)) {
			acc += seg.segment;
			if (seg.isWordLike) {
				jaSegmentEnds.add(acc.length);
			}
		}
		expect(jaSegmentEnds.has(jaPrefix.length)).toBe(true);
	});
});
