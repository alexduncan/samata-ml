import { afterEach, describe, expect, it } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { generateSampleDatasets } from '../scripts/generate-datasets';

const tempDirs: string[] = [];
const DATASETS_DIR = path.resolve(import.meta.dir, '../content/datasets');

function tempDir(): string {
	const dir = mkdtempSync(path.join(tmpdir(), 'samata-sample-content-'));
	tempDirs.push(dir);
	return dir;
}

afterEach(() => {
	while (tempDirs.length) rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

describe('committed sample dataset descriptors', () => {
	it('builds every sample dataset catalogue entry from its authored descriptor', async () => {
		expect(existsSync(path.join(DATASETS_DIR, 'iris/metadata.json'))).toBe(false);
		expect(existsSync(path.join(DATASETS_DIR, 'palmer-penguins/metadata.json'))).toBe(false);
		expect(
			new Bun.CryptoHasher('sha256')
				.update(readFileSync(path.join(DATASETS_DIR, 'iris/data.csv')))
				.digest('hex')
		).toBe('daaeb5e3e889d07fbdd44544f5a39fe2372a07172e25899d577be0ad74df9e65');
		expect(
			new Bun.CryptoHasher('sha256')
				.update(readFileSync(path.join(DATASETS_DIR, 'palmer-penguins/data.csv')))
				.digest('hex')
		).toBe('f204db2c753b0937caac3cb35258562c14f073e4bbc76be24b4c51ce22767a93');
		const root = tempDir();
		const outDir = path.join(root, 'out');
		const report = await generateSampleDatasets(outDir, {
			contentDir: DATASETS_DIR,
			cacheDir: path.join(root, 'cache'),
			remoteCacheDir: path.join(root, 'remote-cache')
		});
		expect(report.built).toEqual([
			'adult-census',
			'bank-marketing',
			'breast-cancer-wisconsin',
			'compas-recidivism',
			'credit-card-default',
			'german-credit',
			'heart-disease',
			'iris',
			'palmer-penguins',
			'pima-diabetes',
			'student-dropout',
			'titanic'
		]);
		const index = JSON.parse(
			readFileSync(path.join(outDir, 'datasets/index.json'), 'utf8')
		) as {
			entries: {
				id: string;
				stats: { rowCount: number; columnCount: number; hasMissingValues: boolean };
			}[];
		};
		expect(index.entries.map(({ id }) => id).sort()).toEqual([
			'adult-census',
			'bank-marketing',
			'breast-cancer-wisconsin',
			'compas-recidivism',
			'credit-card-default',
			'german-credit',
			'heart-disease',
			'iris',
			'palmer-penguins',
			'pima-diabetes',
			'student-dropout',
			'titanic'
		]);
		const compas = JSON.parse(
			readFileSync(path.join(outDir, 'datasets/compas-recidivism/descriptor.json'), 'utf8')
		) as {
			columns: { name: string }[];
			files: { csv: string; csvOrigin: string };
		};
		expect(compas.files).toMatchObject({
			csv: 'https://raw.githubusercontent.com/propublica/compas-analysis/bafff5da3f2e45eca6c2d5055faad269defd135a/compas-scores-two-years.csv',
			csvOrigin: 'remote'
		});
		expect(compas.columns).toHaveLength(53);
		expect(compas.columns.map(({ name }) => name)).toContain('decile_score_1');
		expect(compas.columns.map(({ name }) => name)).toContain('priors_count_1');
		expect(existsSync(path.join(outDir, 'datasets/compas-recidivism/data.csv'))).toBe(false);
		expect(index.entries.find(({ id }) => id === 'iris')?.stats).toMatchObject({
			rowCount: 150,
			columnCount: 5,
			hasMissingValues: false
		});
		expect(index.entries.find(({ id }) => id === 'palmer-penguins')?.stats).toMatchObject({
			rowCount: 344,
			columnCount: 8,
			hasMissingValues: true
		});

		const penguins = JSON.parse(
			readFileSync(path.join(outDir, 'datasets/palmer-penguins/descriptor.json'), 'utf8')
		) as { columns: { name: string; dataType: string; missingCount: number }[] };
		for (const name of [
			'bill_length_mm',
			'bill_depth_mm',
			'flipper_length_mm',
			'body_mass_g'
		]) {
			expect(penguins.columns.find((column) => column.name === name)).toMatchObject({
				missingCount: 2
			});
		}
		expect(penguins.columns.find((column) => column.name === 'sex')).toMatchObject({
			missingCount: 11
		});
		expect(penguins.columns.find((column) => column.name === 'year')).toMatchObject({
			dataType: 'categorical'
		});

		const iris = JSON.parse(
			readFileSync(path.join(outDir, 'datasets/iris/descriptor.json'), 'utf8')
		) as {
			columns: { name: string; dataType: string }[];
			stats: { defaultTargetDistribution?: Record<string, number> };
		};
		expect(iris.columns.find((column) => column.name === 'class')?.dataType).toBe(
			'categorical'
		);
		expect(iris.stats.defaultTargetDistribution).toEqual({
			'Iris-setosa': 50,
			'Iris-versicolor': 50,
			'Iris-virginica': 50
		});
	});
});
