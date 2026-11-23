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
		const root = tempDir();
		const outDir = path.join(root, 'out');
		const report = await generateSampleDatasets(outDir, {
			contentDir: DATASETS_DIR,
			cacheDir: path.join(root, 'cache')
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
			'student-dropout',
			'titanic-inquiry'
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
			'student-dropout',
			'titanic-inquiry'
		]);
		expect(index.entries.map((entry) => entry.id)).toEqual([
			'breast-cancer-wisconsin',
			'iris',
			'palmer-penguins',
			'titanic-inquiry',
			'heart-disease',
			'german-credit',
			'student-dropout',
			'adult-census',
			'bank-marketing',
			'credit-card-default',
			'compas-recidivism'
		]);
		const expectedTargets: Record<string, string> = {
			'adult-census': 'income',
			'bank-marketing': 'y',
			'breast-cancer-wisconsin': 'Diagnosis',
			'compas-recidivism': 'two_year_recid',
			'credit-card-default': 'default.payment.next.month',
			'german-credit': 'class',
			'heart-disease': 'num',
			iris: 'class',
			'palmer-penguins': 'species',
			'student-dropout': 'Target',
			'titanic-inquiry': 'survived'
		};
		const expectedHashes: Record<string, string> = {
			'adult-census': '3319b2fef796cbf96ef520c0daf10b9d90c96ab68a2db2589daefc4ed175d11a',
			'bank-marketing': 'd1513ec63b385506f7cfce9f2c5caa9fe99e7ba4e8c3fa264b3aaf0f849ed32d',
			'breast-cancer-wisconsin':
				'3487b754ff02c93cdc8a18afafe223961d9cfbfdb932e57483e52581042767d7',
			'compas-recidivism': 'c451db85908b2f7fef1d83203bedf6b71ecda0d5af468d82ae62178f91d0cc7d',
			'credit-card-default':
				'a0f0ab49d6326671d6cd83be5c88dcf18007025fe9a53ecd699119c871176ca1',
			'german-credit': '9888fb06e7bf42963f4db2c8fd57666d5426c0a3692d10b51571de49518a105a',
			'heart-disease': '868cd646a53ffbc55611192bae7496911a163937c185710f6b8aa11549b88df1',
			iris: 'daaeb5e3e889d07fbdd44544f5a39fe2372a07172e25899d577be0ad74df9e65',
			'palmer-penguins': 'f204db2c753b0937caac3cb35258562c14f073e4bbc76be24b4c51ce22767a93',
			'student-dropout': '542b53d93cdb250f0f39a470e15cb25d1c24fb559a98e333382afd9c5ae352eb',
			'titanic-inquiry': '10aac9f02b02eacfb809c17807fcdcda1e1fd09a72fc211e69a90c89ccc5b994'
		};
		for (const [id, hash] of Object.entries(expectedHashes)) {
			const descriptor = JSON.parse(
				readFileSync(path.join(outDir, 'datasets', id, 'descriptor.json'), 'utf8')
			);
			expect(descriptor.stats.sha256).toBe(hash);
			expect(descriptor.modeling.defaultTarget).toBe(expectedTargets[id]);
			const direct = ['compas-recidivism', 'credit-card-default', 'palmer-penguins'].includes(
				id
			);
			expect(descriptor.files.csvOrigin).toBe(direct ? 'remote' : 'bundled');
			expect(existsSync(path.join(outDir, 'datasets', id, 'data.csv'))).toBe(!direct);
			expect(existsSync(path.join(DATASETS_DIR, id, 'data.csv'))).toBe(false);
		}
		const inquiry = JSON.parse(
			readFileSync(path.join(outDir, 'datasets/titanic-inquiry/descriptor.json'), 'utf8')
		);
		expect(inquiry.columns.map((column: { name: string }) => column.name)).toEqual([
			'passenger_class',
			'sex',
			'age_group',
			'survived'
		]);
		expect(inquiry.stats.defaultTargetDistribution).toEqual({ '0': 1490, '1': 711 });
		expect(inquiry.modeling.defaultTarget).toBe('survived');
		expect(existsSync(path.join(outDir, 'datasets/titanic'))).toBe(false);
		expect(existsSync(path.join(outDir, 'datasets/pima-diabetes'))).toBe(false);
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
	}, 30000);
});
