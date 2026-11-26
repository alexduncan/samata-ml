/**
 * Compile-time constants shared across production, dev, test and Storybook builds.
 */
export interface BuildConstants {
	/** Enables development-only diagnostics. */
	DEBUG: boolean;
	/** Semantic version string from `package.json`. */
	APP_VERSION: string;
	/** Deterministic build digest covering version, workers and manifest hashes. */
	BUILD_ID: string;
	/** Enables beta telemetry in production builds when true. */
	BETA_TELEMETRY_ENABLED: boolean;
	/** Root-absolute URL for the storage Web Worker. */
	STORAGE_WORKER_URL: string;
	/** Root-absolute URL for the training Web Worker. */
	TRAINING_WORKER_URL: string;
	/** Root-absolute URL for the analysis Web Worker. */
	ANALYSIS_WORKER_URL: string;
	/** Digest query version for content index manifests. */
	CONTENT_INDEX_VERSION: string;
	/** Digest query version for the sample datasets index manifest. */
	DATASETS_INDEX_VERSION: string;
}

/**
 * Default build constants supplied under `bun test` and Storybook.
 */
export const TEST_BUILD_CONSTANTS: BuildConstants = {
	DEBUG: false,
	APP_VERSION: '0.0.0-test',
	BUILD_ID: 'test',
	BETA_TELEMETRY_ENABLED: false,
	STORAGE_WORKER_URL: '/storage.worker.js',
	TRAINING_WORKER_URL: '/training.worker.js',
	ANALYSIS_WORKER_URL: '/analysis.worker.js',
	CONTENT_INDEX_VERSION: '',
	DATASETS_INDEX_VERSION: ''
};

/**
 * Converts a {@link BuildConstants} object into a JSON-stringified `define` map
 * suitable for `Bun.build` and Vite.
 *
 * @param constants - Build constant values to serialise.
 * @returns Mapping from bare identifier names to JSON-encoded literals.
 */
export function toDefine(constants: BuildConstants): Record<string, string> {
	return {
		DEBUG: JSON.stringify(constants.DEBUG),
		APP_VERSION: JSON.stringify(constants.APP_VERSION),
		BUILD_ID: JSON.stringify(constants.BUILD_ID),
		BETA_TELEMETRY_ENABLED: JSON.stringify(constants.BETA_TELEMETRY_ENABLED),
		STORAGE_WORKER_URL: JSON.stringify(constants.STORAGE_WORKER_URL),
		TRAINING_WORKER_URL: JSON.stringify(constants.TRAINING_WORKER_URL),
		ANALYSIS_WORKER_URL: JSON.stringify(constants.ANALYSIS_WORKER_URL),
		CONTENT_INDEX_VERSION: JSON.stringify(constants.CONTENT_INDEX_VERSION),
		DATASETS_INDEX_VERSION: JSON.stringify(constants.DATASETS_INDEX_VERSION)
	};
}
