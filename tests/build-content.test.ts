import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import {
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildContent } from '../scripts/build-content';
import { contentTypeFromPath, serveStaticFile } from '../scripts/static-server';
import type { ContentIndex } from '../src/types/content';

const FIXTURES_DIR = path.resolve(import.meta.dir, 'fixtures', 'content');
const tempDirs: string[] = [];

function makeTempDir(prefix = 'samata-build-content-'): string {
	const dir = mkdtempSync(path.join(tmpdir(), prefix));
	tempDirs.push(dir);
	return dir;
}

function sha256Prefix12(content: string): string {
	return new Bun.CryptoHasher('sha256').update(content).digest('hex').slice(0, 12);
}

afterEach(() => {
	while (tempDirs.length > 0) {
		const dir = tempDirs.pop()!;
		rmSync(dir, { recursive: true, force: true });
	}
});

describe('Content build pipeline', () => {
	it('CNT-B-1: builds fragments and deterministic versioned index.json for valid en fixture', async () => {
		const outDir1 = makeTempDir();
		const outDir2 = makeTempDir();
		const fixture = path.join(FIXTURES_DIR, 'valid-en');

		const report = await buildContent(outDir1, { contentDir: fixture, locales: ['en'] });
		expect(report.locales.en).toEqual({
			pages: { total: 4, fallbacks: 0 },
			models: { total: 2, fallbacks: 0 },
			glossary: { total: 0, fallbacks: 0 }
		});

		const pagesIndexRaw1 = readFileSync(
			path.join(outDir1, 'content', 'en', 'pages', 'index.json'),
			'utf8'
		);
		const modelsIndexRaw1 = readFileSync(
			path.join(outDir1, 'content', 'en', 'models', 'index.json'),
			'utf8'
		);
		const glossaryIndexRaw1 = readFileSync(
			path.join(outDir1, 'content', 'en', 'glossary', 'index.json'),
			'utf8'
		);

		const pagesIndex = JSON.parse(pagesIndexRaw1) as ContentIndex<'pages'>;
		const modelsIndex = JSON.parse(modelsIndexRaw1) as ContentIndex<'models'>;
		const glossaryIndex = JSON.parse(glossaryIndexRaw1) as ContentIndex<'glossary'>;

		expect(pagesIndex.version).toBe(1);
		expect(pagesIndex.locale).toBe('en');
		expect(pagesIndex.domain).toBe('pages');
		expect(pagesIndex.entries.map((e) => e.id)).toEqual([
			'about',
			'help',
			'privacy-policy',
			'configure-model'
		]);

		expect(modelsIndex.locale).toBe('en');
		expect(modelsIndex.entries.map((e) => e.id)).toEqual(['zebra', 'alpha']); // sorted by order (1, 5)

		expect(glossaryIndex).toEqual({
			version: 1,
			locale: 'en',
			domain: 'glossary',
			entries: []
		});

		for (const entry of [...pagesIndex.entries, ...modelsIndex.entries]) {
			expect(entry.lang).toBe('en');
			const [urlPath, query] = entry.url.split('?');
			expect(urlPath).toStartWith('/content/en/');
			expect(query).toMatch(/^v=[0-9a-f]{12}$/);
			const htmlPath = path.join(outDir1, urlPath!.slice(1));
			expect(existsSync(htmlPath)).toBe(true);
			const html = readFileSync(htmlPath, 'utf8');
			expect(query).toBe(`v=${sha256Prefix12(html)}`);
		}

		await buildContent(outDir2, { contentDir: fixture, locales: ['en'] });
		expect(
			readFileSync(path.join(outDir2, 'content', 'en', 'pages', 'index.json'), 'utf8')
		).toBe(pagesIndexRaw1);
		expect(
			readFileSync(path.join(outDir2, 'content', 'en', 'models', 'index.json'), 'utf8')
		).toBe(modelsIndexRaw1);
		expect(
			readFileSync(path.join(outDir2, 'content', 'en', 'glossary', 'index.json'), 'utf8')
		).toBe(glossaryIndexRaw1);
	});

	it('CNT-B-2: collects and prints all validation errors and writes no index.json', async () => {
		const outDir = makeTempDir();
		const fixture = path.join(FIXTURES_DIR, 'invalid-all');
		const loggedErrors: string[] = [];
		const errSpy = spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
			loggedErrors.push(args.map(String).join(' '));
		});

		try {
			await expect(
				buildContent(outDir, { contentDir: fixture, locales: ['en'] })
			).rejects.toThrow(/Content build failed: \d+ error\(s\)/);
		} finally {
			errSpy.mockRestore();
		}

		const combined = loggedErrors.join('\n');
		expect(combined).toContain("unknown front matter key 'foo'");
		expect(combined).toContain("front matter 'order' must be an integer");
		expect(combined).toContain("front matter 'updated' must be a valid ISO calendar date");
		expect(combined).toContain("glossary entries require front matter 'description'");
		expect(combined).toContain("glossary 'related' cannot reference itself ('bad-term')");
		expect(combined).toContain("glossary 'related' references unknown entry 'missing-id'");
		expect(combined).toContain('invalid content filename "UpperCase.md"');
		expect(combined).toContain('subdirectories are not allowed');
		expect(combined).toContain("missing base-locale (en) page 'privacy-policy'");
		expect(combined).toContain("missing base-locale (en) page 'configure-model'");
		expect(combined).toContain('unexpected entry under content root');

		expect(existsSync(path.join(outDir, 'content', 'en', 'pages', 'index.json'))).toBe(false);
		expect(existsSync(path.join(outDir, 'content', 'en', 'models', 'index.json'))).toBe(false);
		expect(existsSync(path.join(outDir, 'content', 'en', 'glossary', 'index.json'))).toBe(
			false
		);
	});

	it('CNT-B-5: supports multi-locale fallback, rejects orphan translations and locale-neutral overrides', async () => {
		const outDir = makeTempDir();
		const fixture = path.join(FIXTURES_DIR, 'valid-multi');

		const report = await buildContent(outDir, { contentDir: fixture, locales: ['en', 'fr'] });
		expect(report.locales.en?.pages).toEqual({ total: 4, fallbacks: 0 });
		expect(report.locales.fr?.pages).toEqual({ total: 4, fallbacks: 3 });

		const enPages = JSON.parse(
			readFileSync(path.join(outDir, 'content', 'en', 'pages', 'index.json'), 'utf8')
		) as ContentIndex<'pages'>;
		const frPages = JSON.parse(
			readFileSync(path.join(outDir, 'content', 'fr', 'pages', 'index.json'), 'utf8')
		) as ContentIndex<'pages'>;

		expect(frPages.locale as string).toBe('fr');
		expect(frPages.entries.map((e) => e.id).sort()).toEqual(
			enPages.entries.map((e) => e.id).sort()
		);

		const frAbout = frPages.entries.find((e) => e.id === 'about')!;
		expect(frAbout.lang as string).toBe('fr');
		expect(frAbout.url).toStartWith('/content/fr/pages/about.html?v=');

		const enHelp = enPages.entries.find((e) => e.id === 'help')!;
		const frHelp = frPages.entries.find((e) => e.id === 'help')!;
		expect(frHelp.lang).toBe('en');
		expect(frHelp.url).toBe(enHelp.url);

		// Missing fr/ directory completely succeeds with all entries falling back to en
		const noFrContentDir = makeTempDir('samata-no-fr-');
		cpSync(path.join(FIXTURES_DIR, 'valid-en'), noFrContentDir, { recursive: true });
		const noFrOut = makeTempDir();
		const noFrReport = await buildContent(noFrOut, {
			contentDir: noFrContentDir,
			locales: ['en', 'fr']
		});
		expect(noFrReport.locales.fr?.pages).toEqual({ total: 4, fallbacks: 4 });

		// fr/pages/extra.md with no en file, and order in fr/models/*.md both fail
		const invalidFrDir = makeTempDir('samata-bad-fr-');
		cpSync(fixture, invalidFrDir, { recursive: true });
		writeFileSync(path.join(invalidFrDir, 'fr', 'pages', 'extra.md'), '# Extra\n\nOrphan.');
		mkdirSync(path.join(invalidFrDir, 'fr', 'models'), { recursive: true });
		writeFileSync(
			path.join(invalidFrDir, 'fr', 'models', 'logistic-regression.md'),
			'---\ntitle: Régression logistique\norder: 1\n---\n\nTexte.\n'
		);

		const frErrors: string[] = [];
		const errSpy = spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
			frErrors.push(args.map(String).join(' '));
		});
		try {
			await expect(
				buildContent(makeTempDir(), { contentDir: invalidFrDir, locales: ['en', 'fr'] })
			).rejects.toThrow(/Content build failed:/);
		} finally {
			errSpy.mockRestore();
		}
		const frMsg = frErrors.join('\n');
		expect(frMsg).toContain("translation 'extra' has no matching base-locale (en) entry");
		expect(frMsg).toContain("front matter 'order' is locale-neutral");
	});

	it('WML-P1-ROUTE-1: fails when the configure-model reserved page is missing', async () => {
		const contentDir = makeTempDir('samata-no-configure-');
		cpSync(path.join(FIXTURES_DIR, 'valid-en'), contentDir, { recursive: true });
		rmSync(path.join(contentDir, 'en', 'pages', 'configure-model.md'));
		const errors: string[] = [];
		const errSpy = spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
			errors.push(args.map(String).join(' '));
		});
		try {
			await expect(
				buildContent(makeTempDir(), { contentDir, locales: ['en'] })
			).rejects.toThrow(/Content build failed:/);
		} finally {
			errSpy.mockRestore();
		}
		expect(errors.join('\n')).toContain("missing base-locale (en) page 'configure-model'");
	});

	it('static server serves .json and .csv with proper MIME types', async () => {
		expect(contentTypeFromPath('/content/en/pages/index.json')).toBe(
			'application/json; charset=utf-8'
		);
		expect(contentTypeFromPath('/datasets/iris/data.csv')).toBe('text/csv; charset=utf-8');

		const outDir = makeTempDir();
		await buildContent(outDir, {
			contentDir: path.join(FIXTURES_DIR, 'valid-en'),
			locales: ['en']
		});
		const response = await serveStaticFile({
			requestPath: '/content/en/pages/index.json',
			rootDir: outDir
		});
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
	});
});
