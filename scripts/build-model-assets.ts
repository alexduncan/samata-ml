import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT_DIR } from './config';

const webMlVersion = '0.2.0';
const webMlTarball = `vendor/web-ml/web-ml-${webMlVersion}.tgz`;
/** SHA-256 release identifier recorded with newly trained models. */
export const WEB_ML_REVISION =
	'sha256:82fc9163764805dde88ea1ca13eb3bd1a8a8a3f62d0eeb4930689c47028e76b0';

// Pins the prebuilt module, its relative workers and WASM, and their notices to the
// verified release tarball.
const runtimeHashes = {
	'LICENSE.md': '0ba4fb5f08e788173f083c3c53ff7ba7ad8e6888a6931e8cfb63f85d04ca2d11',
	'THIRD-PARTY-NOTICES.md': '9edbb60a3d1c5f5c3bd24948b6be6eb1537ca7765cd29aa8b4a94a788facb0f7',
	'dist/index.js': '8b1356550549140a42f9f5e680779c9bc3bfb633e3ca0c34a01bb7fe27dde68c',
	'dist/training-orchestrator-dedicated.js':
		'8cd9b88d562d9451240b416ffeb4a105db795898f1cfd79a453643babd321357',
	'dist/training-orchestrator.js':
		'3e5e18fb13185a0b9c0e9fab43a02ee41ea11bd5e1d8706fc8f49510e63a6638',
	'dist/training-worker-clustering.js':
		'f52718b96cc63641c30941bc248123f71e8a5078f940fe08694e1e6aa44c504f',
	'dist/training-worker-linear.js':
		'4f7119c2522b709dcdbe4e355b352c263bf3ed5ca05d3e11053c32afce494b80',
	'dist/training-worker-logistic.js':
		'9748423ad560d6e7477b7498db38aba502910129bece11183bfb05f9844a32c2',
	'dist/training-worker-mlp.js':
		'7651a99839aa1ebe550806e6b39160b413435dccd42206d7bda173e67cbf4151',
	'dist/training-worker-naive-bayes.js':
		'17bdc5ced80b579ac4cea88ee023cd35677ad74fe8ed60282b1934c0a25ef6ea',
	'dist/training-worker-neighbors.js':
		'b76aae3470fa469bdec008ba1d1031ddab8cc8fe36067dae4348163ffc69e520',
	'dist/training-worker-pca.js':
		'4edd4007e9bde784d18a1c32470493dc0164c5a405507eabd4059914f7512217',
	'dist/training-worker-probe.js':
		'13c229ee830558d25ec077ea7e0cb2bb7a7281bad5b471c78cac414ca1930c72',
	'dist/training-worker-svm.js':
		'72ca5bde02f3dda943a4d0f200dd7a04299e4a73df430340e25df0a5bcdcc73d',
	'dist/training-worker-tree.js':
		'1e5aec15251ed53ef19bf688a5d2a9f48db8de8c446537aa89917d6bbdde598d',
	'dist/wasm/LIBSVM-COPYRIGHT':
		'958fd47be5e5b94dabeb68b077fbe2adbbd49c015fe2e453fe11afeb4a73c7e5',
	'dist/wasm/libsvm.js': '0212897cd67836047391f6f0633479bd4cd97b6e660d470f58b1032af7959461',
	'dist/wasm/libsvm.wasm': '37f7461c9465272de699af339506e34d85a4757dea04dea0dfcc7bdc4a7171f3',
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
const publicDigest = '13d544d94c3cbf3ed3b632b0c7f5a46d0e4bc5b76ce8a8b851162d9d8b3ef5aa';

function setupError(location: string, reason: string, cause?: unknown): Error {
	return new Error(
		`web-ml setup error at ${location}: ${reason}. Verify ${webMlTarball} ` +
			`(${WEB_ML_REVISION}), then run bun install --frozen-lockfile --ignore-scripts.`,
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
	const packageDirectory = path.join(appDir, 'node_modules', 'web-ml');
	const installed = await stat(packageDirectory).catch((cause: unknown) => {
		throw setupError(packageDirectory, 'installed package is unavailable', cause);
	});
	if (!installed.isDirectory()) {
		throw setupError(packageDirectory, 'expected a directory');
	}

	const manifest = await readInput(packageDirectory, 'package.json');
	if (manifest.hash !== '230b2c18d60dfbeb749d132eee974620f2d09994dcee18e394b1125a43dd97e1') {
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
