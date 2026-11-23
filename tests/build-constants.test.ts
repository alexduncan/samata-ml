import { describe, expect, test } from 'bun:test';
import { TEST_BUILD_CONSTANTS, toDefine } from '../scripts/build-constants';

describe('build constants', () => {
	test('REL-VER-4: toDefine JSON-stringifies every BuildConstants field', () => {
		const defined = toDefine(TEST_BUILD_CONSTANTS);
		expect(Object.keys(defined).sort()).toEqual(Object.keys(TEST_BUILD_CONSTANTS).sort());
		for (const [key, value] of Object.entries(TEST_BUILD_CONSTANTS)) {
			expect(defined[key]).toBe(JSON.stringify(value));
		}
	});

	test('REL-VER-4: preload exposes every constant as a bare identifier under bun test', () => {
		expect(DEBUG).toBe(TEST_BUILD_CONSTANTS.DEBUG);
		expect(APP_VERSION).toBe(TEST_BUILD_CONSTANTS.APP_VERSION);
		expect(BUILD_ID).toBe(TEST_BUILD_CONSTANTS.BUILD_ID);
		expect(BETA_TELEMETRY_ENABLED).toBe(TEST_BUILD_CONSTANTS.BETA_TELEMETRY_ENABLED);
		expect(STORAGE_WORKER_URL).toBe(TEST_BUILD_CONSTANTS.STORAGE_WORKER_URL);
		expect(TRAINING_WORKER_URL).toBe(TEST_BUILD_CONSTANTS.TRAINING_WORKER_URL);
		expect(ANALYSIS_WORKER_URL).toBe(TEST_BUILD_CONSTANTS.ANALYSIS_WORKER_URL);
		expect(CONTENT_INDEX_VERSION).toBe(TEST_BUILD_CONSTANTS.CONTENT_INDEX_VERSION);
		expect(DATASETS_INDEX_VERSION).toBe(TEST_BUILD_CONSTANTS.DATASETS_INDEX_VERSION);
		expect(typeof WEB_ML_RUNTIME_URL).toBe('string');
		expect(typeof WEB_ML_RUNTIME_REVISION).toBe('string');
	});
});
