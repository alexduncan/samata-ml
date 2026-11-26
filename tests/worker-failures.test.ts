import { afterEach, describe, expect, test } from 'bun:test';
import {
	onWorkerFailure,
	reportWorkerFailure,
	resetWorkerFailuresForTests,
	type WorkerFailureCode
} from '../src/common/release/worker-failures';

describe('worker failure reporting', () => {
	afterEach(() => {
		resetWorkerFailuresForTests();
	});

	test('REL-STALE-1: notifies active listeners synchronously and respects unsubscribe', () => {
		const seen: WorkerFailureCode[] = [];
		const unsub = onWorkerFailure((code) => seen.push(code));

		reportWorkerFailure('storage-worker-error');
		reportWorkerFailure('training-worker-crashed');
		unsub();
		reportWorkerFailure('analysis-worker-failed');

		expect(seen).toEqual(['storage-worker-error', 'training-worker-crashed']);
	});

	test('REL-STALE-1: isolates throwing listeners so remaining observers and caller succeed', () => {
		const seen: WorkerFailureCode[] = [];
		onWorkerFailure(() => {
			throw new Error('listener boom');
		});
		onWorkerFailure((code) => {
			seen.push(code);
		});

		expect(() => reportWorkerFailure('training-worker-protocol-error')).not.toThrow();
		expect(seen).toEqual(['training-worker-protocol-error']);
	});
});
