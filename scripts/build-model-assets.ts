import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT_DIR } from './config';

const webMlVersion = '0.1.0';
/** Source revision of the verified executable graph and public declarations. */
export const WEB_ML_REVISION = '623dd30d7899d8e281773bc593e44be815592693';

// Pins the prebuilt module, its relative workers and WASM, and their notices to the
// matching public package verified for Phase 3.
const runtimeHashes = {
	'LICENSE.md': '0ba4fb5f08e788173f083c3c53ff7ba7ad8e6888a6931e8cfb63f85d04ca2d11',
	'dist/index.js': '5c76bca80e2cc6e9c1d990831b4b5581388f53494a83621c67ba1140448fb2c0',
	'dist/training-orchestrator-dedicated.js':
		'f59f68ee9b64d3cdfb62af61913b2b5ba16e45d4a5442b62976224145e065089',
	'dist/training-orchestrator.js':
		'ccc13251ddf925afb9c5b46c5939200348dd94f24edee786ca0b7ddc1a68bf58',
	'dist/training-worker-clustering.js':
		'2501f7dc9ee55dd774c0e0a7d47f9dd05946a81294f20ebb8dfd18ded936cc03',
	'dist/training-worker-linear.js':
		'51a34efaab107ff7d607f0538ae92aea91df711eff7a69ecad5dedcca5b7d057',
	'dist/training-worker-logistic.js':
		'bfb34a8062dcc988a7d1f4bbe943d3fadf416ab31d116fc506890a0c4bbaa61f',
	'dist/training-worker-mlp.js':
		'1234092415a6cb11b5723001c234dc2e613298b0c86cf370be73258436f0fde5',
	'dist/training-worker-naive-bayes.js':
		'7f48f0cfd4b53b620229f13e87ca43d556884d0e84d1c7d1026d7144e9fedee6',
	'dist/training-worker-neighbors.js':
		'1953465890d6a3d318a132a87cbc9c4f3003e418bf684c7ff95622a41dd21889',
	'dist/training-worker-pca.js':
		'100b0a3c6b1c484263eb144aabadf022dd619a4b17927f824e2d202bea6ec46c',
	'dist/training-worker-probe.js':
		'13c229ee830558d25ec077ea7e0cb2bb7a7281bad5b471c78cac414ca1930c72',
	'dist/training-worker-svm.js':
		'c61d07324dde2cf5f84148f81c7d2ab9c5d5a4d4635b661d1d7372d9d8831fea',
	'dist/training-worker-tree.js':
		'845decd87f74e956c9bb9e4919bf28f967ae97e553890d794ebdfad8fc0fff23',
	'dist/wasm/LIBSVM-COPYRIGHT':
		'958fd47be5e5b94dabeb68b077fbe2adbbd49c015fe2e453fe11afeb4a73c7e5',
	'dist/wasm/libsvm.js': 'd52b6abfd4d218c95053239eed3b9e77bf1458ac36ff7393024fc61c79592296',
	'dist/wasm/libsvm.wasm': '41346038de51a9e49742c201c3d3f35da2bab45c0f77be09bf130178113fb798',
	'dist/wasm/linear-regression.v2.wasm':
		'b304432374a030e31e466ada2871b9e37299d95a39a3f6e4682c308e7fb89a27',
	'dist/wasm/logistic-regression.v1.wasm':
		'4e3a4c42b7db2309530dfbd81cb41474db68b65102446435613e7989b04fa97d'
};

const catalogue = 'specification/public-api/model-specifications';
const publicFiles = [
	'dist/index.d.ts',
	'dist/src/training/DatasetProvider.d.ts',
	'dist/src/training/cross-validate.d.ts',
	'dist/src/training/errors.d.ts',
	'dist/src/training/index.d.ts',
	'dist/src/training/partitions.d.ts',
	'dist/src/training/tabular-preprocessing.d.ts',
	'dist/src/training/training-client.d.ts',
	'dist/src/training/types.d.ts',
	'dist/src/models/support-vector-machines/index.d.ts',
	'dist/src/models/support-vector-machines/support-vector-classifier.d.ts',
	'dist/src/models/support-vector-machines/types.d.ts',
	'specification/public-api/current-limitations.md',
	'specification/public-api/metrics.md',
	'specification/public-api/tabular-preprocessing.md',
	`${catalogue}/schema.json`,
	`${catalogue}/index.json`,
	`${catalogue}/models/bernoulli-nb.json`,
	`${catalogue}/models/decision-tree-classifier.json`,
	`${catalogue}/models/gaussian-nb.json`,
	`${catalogue}/models/k-neighbors-classifier.json`,
	`${catalogue}/models/logistic-regression.json`,
	`${catalogue}/models/mlp-classifier.json`,
	`${catalogue}/models/multinomial-nb.json`,
	`${catalogue}/models/support-vector-classifier.json`
];
const publicDigest = 'c08b566825459197da138c08fae62406289fc5fbb0d13e192ca59e1ac00f1165';

function setupError(location: string, reason: string, cause?: unknown): Error {
	return new Error(
		`web-ml setup error at ${location}: ${reason}. Place the samata-ml checkout beside a ` +
			`web-ml directory resolving to the verified prebuilt web-ml ${webMlVersion} package ` +
			`at ${WEB_ML_REVISION}, then run bun install --frozen-lockfile --ignore-scripts.`,
		{ cause }
	);
}

async function readInput(packageDirectory: string, name: string) {
	const location = path.join(packageDirectory, name);
	const bytes = await readFile(location).catch((cause: unknown) => {
		throw setupError(location, 'required package file is unreadable', cause);
	});
	return { name, bytes, hash: createHash('sha256').update(bytes).digest('hex') };
}

function digestGraph(files: readonly { name: string; hash: string }[]): string {
	const manifest = files
		.map(({ name, hash }) => `${name}\0${hash}\n`)
		.sort()
		.join('');
	return createHash('sha256').update(manifest).digest('hex');
}

/**
 * Publishes the pinned web-ml browser graph without rebundling its relative assets.
 * Returns the versioned, root-relative module URL to compile into the app worker.
 */
export async function buildModelAssets(outDir: string, appDir = ROOT_DIR): Promise<string> {
	const siblingDirectory = path.resolve(appDir, '../web-ml');
	const sibling = await stat(siblingDirectory).catch((cause: unknown) => {
		throw setupError(siblingDirectory, 'required prebuilt sibling is unavailable', cause);
	});
	if (!sibling.isDirectory()) {
		throw setupError(siblingDirectory, 'expected a directory');
	}

	const packageDirectory = path.join(appDir, 'node_modules', 'web-ml');
	const manifest = await readInput(packageDirectory, 'package.json');
	if (manifest.hash !== 'bc6dba9ed85cd4393d2916adc1b9b8b66ae9b9604dd85f2e25d9fdc5ae4c27c7') {
		throw setupError(
			path.join(packageDirectory, manifest.name),
			'package manifest does not match the verified build'
		);
	}
	const publicInputs = await Promise.all(
		publicFiles.map((name) => readInput(packageDirectory, name))
	);
	publicInputs.push(manifest);
	if (digestGraph(publicInputs) !== publicDigest) {
		throw setupError(
			packageDirectory,
			'public declarations or catalogue do not match the verified build'
		);
	}

	const runtime = await Promise.all(
		Object.entries(runtimeHashes).map(async ([name, expectedHash]) => {
			const input = await readInput(packageDirectory, name);
			if (input.hash !== expectedHash) {
				throw setupError(
					path.join(packageDirectory, name),
					'runtime file does not match the verified build'
				);
			}
			return { ...input, name: name.replace(/^dist\//, '') };
		})
	);

	const graphDigest = digestGraph(runtime);
	const relativeDirectory = `web-ml/${webMlVersion}-${graphDigest}`;
	const runtimeDirectory = path.join(outDir, relativeDirectory);
	await mkdir(path.join(runtimeDirectory, 'wasm'), { recursive: true });
	await Promise.all(
		runtime.map(({ name, bytes }) => writeFile(path.join(runtimeDirectory, name), bytes))
	);
	return `/${relativeDirectory}/index.js`;
}
