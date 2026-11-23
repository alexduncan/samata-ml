import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { generateSampleDatasets } from '../scripts/generate-datasets';
import { acquireSource, prepareSource, validateSource } from '../scripts/dataset-source';
import { zipSync, strToU8 } from 'fflate';
import type { AuthoredDatasetDescriptor, BuildCsvSource } from '../src/types/sample-dataset';
import {
	loadSampleCatalogue,
	loadSampleDescriptor,
	resetSampleDatasetCache
} from '../src/features/data/sample-datasets';

const tempDirs: string[] = [];

function tempDir(): string {
	const dir = mkdtempSync(path.join(tmpdir(), 'samata-datasets-'));
	tempDirs.push(dir);
	return dir;
}

function makeFixture(
	root: string,
	options: {
		id?: string;
		csv?: string;
		datasheet?: string | null;
		columns?: string;
		target?: string;
		taskType?: string;
		positiveClass?: string;
		leakyColumns?: string;
		license?: string;
		remoteSource?: { url: string; sha256: string; byteLength: number };
		buildSource?: BuildCsvSource;
		omitCsv?: boolean;
		extraMetadata?: boolean;
		metadataOnly?: boolean;
	} = {}
): string {
	const id = options.id ?? 'a';
	const dir = path.join(root, id);
	mkdirSync(dir, { recursive: true });
	if (!options.metadataOnly) {
		if (!options.omitCsv)
			writeFileSync(
				path.join(dir, 'data.csv'),
				options.csv ?? 'x,target\n1,yes\n2,no\n3,yes\n'
			);
		if (options.datasheet !== null)
			writeFileSync(
				path.join(dir, 'datasheet.md'),
				options.datasheet ??
					'# Sample\n\nA sample dataset.\n\n[Source](https://example.org)'
			);
		const columns =
			options.columns ??
			`
			{ name: 'x', displayName: 'X', description: 'Feature.', dataType: 'numeric', role: 'feature' },
			{ name: 'target', displayName: 'Target', description: 'Target.', dataType: 'categorical', role: 'feature' }`;
		const target = options.target ?? 'target';
		const taskType = options.taskType ?? 'binary-classification';
		const positiveClass = options.positiveClass ?? 'yes';
		const leakyColumns = options.leakyColumns ?? '[]';
		const license = options.license ?? 'CC0-1.0';
		const remoteSource = options.remoteSource
			? `remoteSource: ${JSON.stringify(options.remoteSource)},`
			: '';
		writeFileSync(
			path.join(dir, 'descriptor.ts'),
			`export default {
				id: '${id}', name: 'Sample', tagline: 'Short.', description: 'A sample.', domain: 'biology', difficulty: 'beginner', tags: [],
				${remoteSource}
				${options.buildSource ? `buildSource: ${JSON.stringify(options.buildSource)},` : ''}
				modeling: { defaultTarget: '${target}', targetCandidates: [{ column: '${target}', taskType: '${taskType}', positiveClass: '${positiveClass}', description: 'Target.', leakyColumns: ${leakyColumns} }] },
				columns: [${columns}],
				provenance: { homepageUrl: 'https://example.org', sourceRepositoryUrl: 'https://example.org', retrievedAt: '2026-11-13', license: '${license}', licenseUrl: 'https://example.org/license', attribution: 'Example source.', yearPublished: 2020, creators: ['Example'], transformations: [] },
				references: []
			};\n`
		);
		if (options.extraMetadata) writeFileSync(path.join(dir, 'metadata.json'), '{}');
	} else {
		writeFileSync(path.join(dir, 'metadata.json'), '{}');
	}
	return dir;
}

afterEach(() => {
	while (tempDirs.length) rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

describe('sample dataset generator', () => {
	it('prepares pinned synthetic source formats and rejects invalid archive members', () => {
		const encoder = new TextEncoder();
		const hash = (b: Uint8Array) => new Bun.CryptoHasher('sha256').update(b).digest('hex');
		const columns = [{ name: 'x' }, { name: 'target' }];
		const cases: [BuildCsvSource['transform'], Uint8Array, string][] = [
			['identity', encoder.encode('x,target\n1,yes\n'), 'x,target\n1,yes\n'],
			[
				'adult-training',
				encoder.encode(' 1 , yes \n 2 , no \n'),
				'x,target\r\n1,yes\r\n2,no\r\n'
			],
			[
				'german-credit-quotes',
				encoder.encode("x,target\n'1','yes'\n'2','no'\n"),
				'x,target\r\n1,yes\r\n2,no\r\n'
			],
			[
				'strip-utf8-bom',
				new Uint8Array([0xef, 0xbb, 0xbf, ...encoder.encode('x,target\n')]),
				'x,target\n'
			],
			[
				'bank-full-zip',
				zipSync({ 'bank-full.csv': strToU8('x;target\r\n1;yes\r\n') }),
				'x;target\r\n1;yes\r\n'
			]
		];
		for (const [transform, input, expected] of cases) {
			const output = encoder.encode(expected);
			const buildSource = {
				transform,
				outputByteLength: output.length,
				outputSha256: hash(output)
			} as BuildCsvSource;
			const descriptor = { buildSource, columns } as AuthoredDatasetDescriptor;
			expect(prepareSource('test', input, descriptor)).toEqual(output);
			expect(() =>
				prepareSource('test', input, {
					...descriptor,
					buildSource: { ...buildSource, outputSha256: '0'.repeat(64) }
				})
			).toThrow('SHA-256 mismatch');
		}
		const source = {
			transform: 'bank-full-zip',
			outputByteLength: 1,
			outputSha256: '0'.repeat(64)
		} as BuildCsvSource;
		expect(() =>
			prepareSource('test', zipSync({ 'wrong.csv': strToU8('x') }), {
				buildSource: source
			} as AuthoredDatasetDescriptor)
		).toThrow('missing or duplicate');
		expect(() =>
			prepareSource('test', zipSync({ 'bank-full.csv': strToU8('xx') }), {
				buildSource: source
			} as AuthoredDatasetDescriptor)
		).toThrow('member size');
	});

	it('reconstructs the 32 Titanic count cells with bounded totals', () => {
		const encoder = new TextEncoder();
		const rows = ['rownames,Class,Sex,Age,Survived,Freq'];
		const output = ['passenger_class,sex,age_group,survived'];
		let index = 0;
		for (const [n, cls] of ['1st', '2nd', '3rd', 'Crew'].entries())
			for (const sex of ['Male', 'Female'])
				for (const age of ['Child', 'Adult'])
					for (const survived of ['No', 'Yes']) {
						const count =
							sex === 'Male' && age === 'Child'
								? survived === 'Yes'
									? [203, 118, 178, 212][n]!
									: [122, 167, 528, 673][n]!
								: 0;
						rows.push([++index, cls, sex, age, survived, count].join(','));
						for (let j = 0; j < count; j++)
							output.push(
								[
									cls,
									sex.toLowerCase(),
									age.toLowerCase(),
									survived === 'Yes' ? '1' : '0'
								].join(',')
							);
					}
		const expected = encoder.encode(output.join('\n') + '\n');
		const source = {
			transform: 'titanic-inquiry-counts',
			outputSha256: new Bun.CryptoHasher('sha256').update(expected).digest('hex'),
			outputByteLength: expected.length
		} as BuildCsvSource;
		const descriptor = { buildSource: source } as AuthoredDatasetDescriptor;
		expect(
			prepareSource('titanic-inquiry', encoder.encode(rows.join('\n') + '\n'), descriptor)
		).toEqual(expected);
		rows[2] = rows[1]!;
		expect(() =>
			prepareSource('titanic-inquiry', encoder.encode(rows.join('\n') + '\n'), descriptor)
		).toThrow('invalid Titanic count cell');
	});

	it('validates and atomically caches concurrent build downloads', async () => {
		const root = tempDir();
		const bytes = new TextEncoder().encode('x,target\n1,yes\n2,no\n3,yes\n');
		const sha256 = new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
		const source: BuildCsvSource = {
			url: 'https://archive.ics.uci.edu/static/public/53/data.csv',
			sha256,
			byteLength: bytes.length,
			transform: 'identity',
			outputSha256: sha256,
			outputByteLength: bytes.length
		};
		validateSource('a', source, true);
		expect(() =>
			validateSource('a', { ...source, url: 'https://example.org/data.csv' }, true)
		).toThrow();
		expect(() => validateSource('a', { ...source, sha256: 'A'.repeat(64) }, true)).toThrow();
		const cache = path.join(root, 'cache');
		let calls = 0;
		const fetchImpl = async () => {
			calls++;
			return new Response(bytes);
		};
		const results = await Promise.all([
			acquireSource('a', source, cache, fetchImpl),
			acquireSource('a', source, cache, fetchImpl)
		]);
		expect(results).toEqual([bytes, bytes]);
		await acquireSource('a', source, cache, fetchImpl);
		expect(calls).toBe(2);
		writeFileSync(path.join(cache, sha256 + '.csv'), 'corrupt');
		await expect(acquireSource('a', source, cache, fetchImpl)).rejects.toThrow(sha256);
	});

	it('rejects failed, excessive, and redirected downloads without caching', async () => {
		const root = tempDir(),
			bytes = new TextEncoder().encode('ok');
		const source = {
			url: 'https://archive.ics.uci.edu/static/public/53/data.csv',
			sha256: new Bun.CryptoHasher('sha256').update(bytes).digest('hex'),
			byteLength: bytes.length
		};
		const failures: (() => Promise<Response>)[] = [
			async () => new Response('', { status: 503 }),
			async () => new Response('too long'),
			async () => new Response('x'),
			async () => new Response('no'),
			async () =>
				new Response(null, {
					status: 302,
					headers: { location: 'https://example.org/evil.csv' }
				}),
			async () => {
				throw new Error('offline');
			},
			async () =>
				new Response(
					new ReadableStream({
						start(controller) {
							controller.error(new Error('body error'));
						}
					})
				)
		];
		for (const [i, fetchImpl] of failures.entries()) {
			const cache = path.join(root, String(i));
			await expect(acquireSource('sample', source, cache, fetchImpl)).rejects.toThrow();
			expect(existsSync(cache)).toBe(false);
		}
	});

	it('rejects malformed build sources and incompatible licences before fetching', async () => {
		const root = tempDir(),
			contentDir = path.join(root, 'content');
		const hash = '0'.repeat(64);
		const source: BuildCsvSource = {
			url: 'https://archive.ics.uci.edu/static/public/53/data.csv',
			sha256: hash,
			byteLength: 1,
			transform: 'identity',
			outputSha256: hash,
			outputByteLength: 1
		};
		for (const bad of [
			{ ...source, byteLength: 0 },
			{ ...source, outputByteLength: -1 },
			{ ...source, outputSha256: 'x' },
			{ ...source, transform: 'other' }
		]) {
			expect(() => validateSource('a', bad as BuildCsvSource, true)).toThrow();
		}
		makeFixture(contentDir, {
			id: 'a',
			omitCsv: true,
			license: 'NOASSERTION',
			buildSource: source
		});
		let calls = 0;
		const log = spyOn(console, 'error').mockImplementation(() => {});
		try {
			await expect(
				generateSampleDatasets(path.join(root, 'out'), {
					contentDir,
					cacheDir: path.join(root, 'profile'),
					remoteCacheDir: path.join(root, 'source'),
					fetchImpl: async () => {
						calls++;
						return new Response('x');
					}
				})
			).rejects.toThrow();
			expect(calls).toBe(0);
			expect(existsSync(path.join(root, 'out/datasets/index.json'))).toBe(false);
		} finally {
			log.mockRestore();
		}
	});

	it('emits a bundled build source without leaking the authored contract', async () => {
		const root = tempDir(),
			contentDir = path.join(root, 'content'),
			outDir = path.join(root, 'out');
		const bytes = new TextEncoder().encode('x,target\n1,yes\n2,no\n3,yes\n');
		const sha256 = new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
		const buildSource: BuildCsvSource = {
			url: 'https://archive.ics.uci.edu/static/public/53/data.csv',
			sha256,
			byteLength: bytes.length,
			transform: 'identity',
			outputSha256: sha256,
			outputByteLength: bytes.length
		};
		makeFixture(contentDir, { omitCsv: true, buildSource });
		await generateSampleDatasets(outDir, {
			contentDir,
			cacheDir: path.join(root, 'profiles'),
			remoteCacheDir: path.join(root, 'sources'),
			fetchImpl: async () => new Response(bytes)
		});
		const result = JSON.parse(
			readFileSync(path.join(outDir, 'datasets/a/descriptor.json'), 'utf8')
		);
		expect(result.buildSource).toBeUndefined();
		expect(result.files.csvOrigin).toBe('bundled');
		expect(new Uint8Array(readFileSync(path.join(outDir, 'datasets/a/data.csv')))).toEqual(
			bytes
		);
	});

	it('builds deterministic descriptors and compiled datasheets, then caches profiles', async () => {
		const root = tempDir();
		const contentDir = path.join(root, 'content');
		const cacheDir = path.join(root, 'cache');
		const outDir = path.join(root, 'out');
		makeFixture(contentDir);
		const first = await generateSampleDatasets(outDir, { contentDir, cacheDir });
		expect(first).toEqual({ built: ['a'], profiled: ['a'], cached: [] });
		const indexPath = path.join(outDir, 'datasets/index.json');
		const descriptorPath = path.join(outDir, 'datasets/a/descriptor.json');
		const firstIndex = readFileSync(indexPath, 'utf8');
		const firstDescriptor = readFileSync(descriptorPath, 'utf8');
		const descriptor = JSON.parse(firstDescriptor) as {
			columns: { name: string; missingCount: number }[];
			stats: { rowCount: number; columnCount: number; sha256: string };
			files: { csv: string; datasheet: string };
		};
		expect(descriptor.stats).toMatchObject({ rowCount: 3, columnCount: 2 });
		expect(descriptor.columns.map((column) => column.missingCount)).toEqual([0, 0]);
		expect(descriptor.files.csv).toMatch(/\?v=[a-f0-9]{12}$/);
		expect(descriptor.files.datasheet).toMatch(/\?v=[a-f0-9]{12}$/);
		const html = readFileSync(path.join(outDir, 'datasets/a/datasheet.html'), 'utf8');
		expect(html).not.toContain('<h1');
		expect(html).not.toContain('---');
		expect(html).toContain('target="_blank" rel="noopener noreferrer"');
		const second = await generateSampleDatasets(outDir, { contentDir, cacheDir });
		expect(second).toEqual({ built: ['a'], profiled: [], cached: ['a'] });
		expect(readFileSync(indexPath, 'utf8')).toBe(firstIndex);
		expect(readFileSync(descriptorPath, 'utf8')).toBe(firstDescriptor);
		expect(readdirSync(root).sort()).toEqual(['cache', 'content', 'out']);
		writeFileSync(path.join(contentDir, 'a/data.csv'), 'x,target\n4,yes\n2,no\n3,yes\n');
		expect((await generateSampleDatasets(outDir, { contentDir, cacheDir })).profiled).toEqual([
			'a'
		]);
		writeFileSync(path.join(contentDir, 'a/data.csv'), 'x,target\n1,yes\n2,no\n3,yes\n');
		writeFileSync(
			path.join(contentDir, 'a/descriptor.ts'),
			readFileSync(path.join(contentDir, 'a/descriptor.ts'), 'utf8').replace(
				'tags: [],',
				"tags: [], missingValueTokens: ['NA'],"
			)
		);
		expect((await generateSampleDatasets(outDir, { contentDir, cacheDir })).profiled).toEqual([
			'a'
		]);
		writeFileSync(path.join(cacheDir, 'a.json'), '{broken');
		expect((await generateSampleDatasets(outDir, { contentDir, cacheDir })).profiled).toEqual([
			'a'
		]);
		expect(existsSync(path.join(root, 'node_modules'))).toBe(false);
	});

	it('builds only requested ids and ignores an invalid unselected directory', async () => {
		const root = tempDir();
		const contentDir = path.join(root, 'content');
		makeFixture(contentDir);
		makeFixture(contentDir, { id: 'b', metadataOnly: true });
		const report = await generateSampleDatasets(path.join(root, 'out'), {
			contentDir,
			cacheDir: path.join(root, 'cache'),
			ids: ['a']
		});
		expect(report.built).toEqual(['a']);
	});

	it('collects invalid descriptor and content errors without writing an index', async () => {
		const invalidCases: { label: string; fixture: Parameters<typeof makeFixture>[1] }[] = [
			{
				label: 'header does not match',
				fixture: {
					columns: `{ name: 'wrong', displayName: 'X', description: 'Feature.', dataType: 'numeric', role: 'feature' }, { name: 'target', displayName: 'Target', description: 'Target.', dataType: 'categorical', role: 'feature' }`
				}
			},
			{ label: 'needs normalisation', fixture: { csv: ' x,target\n1,yes\n2,no\n3,yes\n' } },
			{
				label: 'infeasible dataType',
				fixture: {
					columns: `{ name: 'x', displayName: 'X', description: 'Feature.', dataType: 'boolean', role: 'feature' }, { name: 'target', displayName: 'Target', description: 'Target.', dataType: 'categorical', role: 'feature' }`
				}
			},
			{ label: 'binary-classification', fixture: { csv: 'x,target\n1,a\n2,b\n3,c\n' } },
			{
				label: 'cannot be the target',
				fixture: { leakyColumns: `[{ column: 'target', reason: 'It is the target.' }]` }
			},
			{ label: 'unknown column', fixture: { target: 'missing' } },
			{ label: 'licence', fixture: { license: 'MIT' } },
			{ label: 'datasheet.md', fixture: { datasheet: null } },
			{
				label: 'raw HTML is not allowed',
				fixture: { datasheet: '# Sample\n\n<div>Unsafe</div>' }
			},
			{ label: 'metadata.json', fixture: { extraMetadata: true } },
			{ label: 'descriptor.ts is required', fixture: { metadataOnly: true } }
		];
		for (const testCase of invalidCases) {
			const root = tempDir();
			const contentDir = path.join(root, 'content');
			makeFixture(contentDir, testCase.fixture);
			const log = spyOn(console, 'error').mockImplementation(() => {});
			try {
				await expect(
					generateSampleDatasets(path.join(root, 'out'), {
						contentDir,
						cacheDir: path.join(root, 'cache')
					})
				).rejects.toThrow('Sample dataset build failed');
				const loggedErrors = log.mock.calls.flat().join(' ');
				expect(loggedErrors).toContain('a:');
				expect(loggedErrors).toContain(testCase.label);
				expect(existsSync(path.join(root, 'out/datasets/index.json'))).toBe(false);
			} finally {
				log.mockRestore();
			}
		}
	});

	it('reports more than one rule failure for a dataset', async () => {
		const root = tempDir();
		const contentDir = path.join(root, 'content');
		makeFixture(contentDir, { license: 'MIT', target: 'missing' });
		const log = spyOn(console, 'error').mockImplementation(() => {});
		try {
			await expect(
				generateSampleDatasets(path.join(root, 'out'), {
					contentDir,
					cacheDir: path.join(root, 'cache')
				})
			).rejects.toThrow('2 error(s)');
			expect(log.mock.calls.flat().join(' ')).toContain('licence is outside the allow-list');
			expect(log.mock.calls.flat().join(' ')).toContain('unknown column missing');
		} finally {
			log.mockRestore();
		}
	});

	it('downloads and caches a verified remote CSV without emitting a local copy', async () => {
		const root = tempDir();
		const contentDir = path.join(root, 'content');
		const remoteCacheDir = path.join(root, 'remote-cache');
		const outDir = path.join(root, 'out');
		const csv = 'x,target\n1,yes\n2,no\n3,yes\n';
		const bytes = new TextEncoder().encode(csv);
		const sha256 = new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
		const url =
			'https://raw.githubusercontent.com/propublica/compas-analysis/bafff5da3f2e45eca6c2d5055faad269defd135a/compas-scores-two-years.csv';
		makeFixture(contentDir, {
			id: 'remote',
			license: 'NOASSERTION',
			omitCsv: true,
			remoteSource: { url, sha256, byteLength: bytes.byteLength }
		});
		let fetchCalls = 0;
		const fetchImpl = async () => {
			fetchCalls++;
			return new Response(bytes);
		};
		const first = await generateSampleDatasets(outDir, {
			contentDir,
			cacheDir: path.join(root, 'profile-cache'),
			remoteCacheDir,
			fetchImpl
		});
		expect(first.profiled).toEqual(['remote']);
		const descriptor = JSON.parse(
			readFileSync(path.join(outDir, 'datasets/remote/descriptor.json'), 'utf8')
		) as {
			files: { csv: string; csvOrigin: string; datasheet: string };
			stats: { sha256: string };
		};
		expect(descriptor.files).toMatchObject({ csv: url, csvOrigin: 'remote' });
		expect(descriptor.files.datasheet).toMatch(/^\/datasets\/remote\/datasheet\.html\?v=/);
		expect(descriptor.stats.sha256).toBe(sha256);
		expect(existsSync(path.join(outDir, 'datasets/remote/data.csv'))).toBe(false);
		const summary = JSON.parse(
			readFileSync(path.join(outDir, 'datasets/index.json'), 'utf8')
		) as { entries: { csvOrigin: string }[] };
		expect(summary.entries[0]?.csvOrigin).toBe('remote');
		const second = await generateSampleDatasets(outDir, {
			contentDir,
			cacheDir: path.join(root, 'profile-cache'),
			remoteCacheDir,
			fetchImpl
		});
		expect(second.cached).toEqual(['remote']);
		expect(fetchCalls).toBe(1);
	});

	it('rejects remote byte size or hash mismatches without caching them', async () => {
		for (const mismatch of ['size', 'hash'] as const) {
			const root = tempDir();
			const contentDir = path.join(root, 'content');
			const remoteCacheDir = path.join(root, 'remote-cache');
			const bytes = new TextEncoder().encode('x,target\n1,yes\n2,no\n3,yes\n');
			const actualHash = new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
			const expectedHash = mismatch === 'hash' ? '0'.repeat(64) : actualHash;
			const expectedSize = mismatch === 'size' ? bytes.byteLength + 1 : bytes.byteLength;
			makeFixture(contentDir, {
				id: `remote-${mismatch}`,
				license: 'NOASSERTION',
				omitCsv: true,
				remoteSource: {
					url: 'https://raw.githubusercontent.com/propublica/compas-analysis/bafff5da3f2e45eca6c2d5055faad269defd135a/compas-scores-two-years.csv',
					sha256: expectedHash,
					byteLength: expectedSize
				}
			});
			const log = spyOn(console, 'error').mockImplementation(() => {});
			try {
				await expect(
					generateSampleDatasets(path.join(root, 'out'), {
						contentDir,
						cacheDir: path.join(root, 'profile-cache'),
						remoteCacheDir,
						fetchImpl: async () => new Response(bytes)
					})
				).rejects.toThrow('Sample dataset build failed');
				const message = log.mock.calls.flat().join(' ');
				expect(message).toContain('remote-' + mismatch);
				expect(message).toContain(
					'https://raw.githubusercontent.com/propublica/compas-analysis/'
				);
				if (mismatch === 'size') expect(message).toContain('byte length mismatch');
				else expect(message).toContain(`got ${actualHash}`);
				expect(existsSync(remoteCacheDir)).toBe(false);
			} finally {
				log.mockRestore();
			}
		}
	});

	it('names the dataset, URL and network requirement when a remote download fails', async () => {
		const root = tempDir();
		const contentDir = path.join(root, 'content');
		const url =
			'https://raw.githubusercontent.com/propublica/compas-analysis/bafff5da3f2e45eca6c2d5055faad269defd135a/compas-scores-two-years.csv';
		makeFixture(contentDir, {
			id: 'remote-failure',
			license: 'NOASSERTION',
			omitCsv: true,
			remoteSource: { url, sha256: '0'.repeat(64), byteLength: 1 }
		});
		const log = spyOn(console, 'error').mockImplementation(() => {});
		try {
			await expect(
				generateSampleDatasets(path.join(root, 'out'), {
					contentDir,
					cacheDir: path.join(root, 'profile-cache'),
					remoteCacheDir: path.join(root, 'remote-cache'),
					fetchImpl: async () => {
						throw new TypeError('offline');
					}
				})
			).rejects.toThrow('Sample dataset build failed');
			const message = log.mock.calls.flat().join(' ');
			expect(message).toContain('remote-failure');
			expect(message).toContain(url);
			expect(message).toContain('first build needs network access');
		} finally {
			log.mockRestore();
		}
	});

	it('rejects unsafe remote and licence combinations without downloading', async () => {
		const cases: Parameters<typeof makeFixture>[1][] = [
			{
				license: 'NOASSERTION',
				omitCsv: true,
				remoteSource: {
					url: 'https://example.org/data.csv',
					sha256: '0'.repeat(64),
					byteLength: 1
				}
			},
			{
				license: 'NOASSERTION',
				remoteSource: {
					url: 'https://raw.githubusercontent.com/propublica/compas-analysis/data.csv',
					sha256: '0'.repeat(64),
					byteLength: 1
				}
			},
			{ license: 'NOASSERTION' }
		];
		for (const [index, fixture] of cases.entries()) {
			const root = tempDir();
			const contentDir = path.join(root, 'content');
			makeFixture(contentDir, { ...fixture, id: `unsafe-${index}` });
			let fetchCalls = 0;
			const log = spyOn(console, 'error').mockImplementation(() => {});
			try {
				await expect(
					generateSampleDatasets(path.join(root, 'out'), {
						contentDir,
						cacheDir: path.join(root, 'profile-cache'),
						remoteCacheDir: path.join(root, 'remote-cache'),
						fetchImpl: async () => {
							fetchCalls++;
							return new Response('');
						}
					})
				).rejects.toThrow('Sample dataset build failed');
				const message = log.mock.calls.flat().join(' ');
				if (index === 0) expect(message).toContain('outside REMOTE_CSV_PREFIXES');
				if (index === 1)
					expect(message).toContain('exactly one of data.csv or remoteSource');
				if (index === 2) expect(message).toContain('licence is outside the allow-list');
				expect(fetchCalls).toBe(0);
			} finally {
				log.mockRestore();
			}
		}
	});

	it('rejects a category that is also marked implicitly missing', async () => {
		const root = tempDir();
		const contentDir = path.join(root, 'content');
		makeFixture(contentDir, {
			columns: `{ name: 'x', displayName: 'X', description: 'Feature.', dataType: 'numeric', role: 'feature' }, { name: 'target', displayName: 'Target', description: 'Target.', dataType: 'categorical', role: 'feature', implicitMissingValues: ['yes'], valueLabels: { yes: 'Yes', no: 'No' } }`
		});
		const log = spyOn(console, 'error').mockImplementation(() => {});
		try {
			await expect(
				generateSampleDatasets(path.join(root, 'out'), {
					contentDir,
					cacheDir: path.join(root, 'cache')
				})
			).rejects.toThrow('Sample dataset build failed');
			expect(log.mock.calls.flat().join(' ')).toContain(
				'column target value yes is both labelled and implicitly missing'
			);
		} finally {
			log.mockRestore();
		}
	});

	it('loads the versioned same-origin catalogue and descriptors', async () => {
		const originalFetch = globalThis.fetch;
		resetSampleDatasetCache();
		const descriptor = { id: 'a' };
		const index = {
			version: 1 as const,
			entries: [{ id: 'a', descriptorUrl: '/datasets/a/descriptor.json?v=123456789abc' }]
		};
		const implementation = Object.assign(
			async (input: RequestInfo | URL): Promise<Response> => {
				const url = String(input);
				return new Response(
					JSON.stringify(url === '/datasets/index.json' ? index : descriptor),
					{
						headers: { 'Content-Type': 'application/json' }
					}
				);
			},
			{ preconnect: async () => {} }
		);
		const fetchMock = spyOn(globalThis, 'fetch').mockImplementation(implementation);
		try {
			expect(await loadSampleCatalogue()).toMatchObject(index);
			expect(await loadSampleDescriptor('a')).toMatchObject(descriptor);
			expect(fetchMock).toHaveBeenCalledTimes(2);
			expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
				'/datasets/index.json',
				'/datasets/a/descriptor.json?v=123456789abc'
			]);
		} finally {
			fetchMock.mockRestore();
			globalThis.fetch = originalFetch;
			resetSampleDatasetCache();
		}
	});

	it('rejects unsupported catalogue versions and descriptor URLs outside the catalogue path', async () => {
		const originalFetch = globalThis.fetch;
		resetSampleDatasetCache();
		let body: unknown = { version: 2, entries: [] };
		const implementation = Object.assign(
			async (): Promise<Response> => new Response(JSON.stringify(body), { status: 200 }),
			{ preconnect: async () => {} }
		);
		const fetchMock = spyOn(globalThis, 'fetch').mockImplementation(implementation);
		try {
			await expect(loadSampleCatalogue()).rejects.toThrow('unsupported version');
			resetSampleDatasetCache();
			body = {
				version: 1,
				entries: [{ id: 'a', descriptorUrl: '/datasets/../evil.json?v=123456789abc' }]
			};
			await expect(loadSampleDescriptor('a')).rejects.toThrow('descriptor URL is invalid');
			expect(fetchMock).toHaveBeenCalledTimes(2);
		} finally {
			fetchMock.mockRestore();
			globalThis.fetch = originalFetch;
			resetSampleDatasetCache();
		}
	});
});
