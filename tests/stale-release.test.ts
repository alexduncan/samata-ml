import { afterEach, describe, expect, test } from 'bun:test';
import {
	$staleAssetDetected,
	checkForNewerRelease,
	installStaleReleaseDetection,
	resetStaleReleaseForTests,
	type ReleaseFetch
} from '../src/common/release/stale-release';
import {
	reportWorkerFailure,
	resetWorkerFailuresForTests
} from '../src/common/release/worker-failures';

describe('stale release detection', () => {
	afterEach(() => {
		resetStaleReleaseForTests();
		resetWorkerFailuresForTests();
	});

	test('REL-STALE-1: leaves atom false when build matches BUILD_ID or on 404 / invalid JSON / network error', async () => {
		await checkForNewerRelease(async (input, init) => {
			expect(input).toBe('/release.json');
			expect(init?.cache).toBe('no-store');
			return new Response(JSON.stringify({ version: APP_VERSION, build: BUILD_ID }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			});
		});
		expect($staleAssetDetected.get()).toBe(false);

		await checkForNewerRelease(async () => new Response('Not Found', { status: 404 }));
		expect($staleAssetDetected.get()).toBe(false);

		await checkForNewerRelease(async () => new Response('{not-json', { status: 200 }));
		expect($staleAssetDetected.get()).toBe(false);

		await checkForNewerRelease(
			async () => new Response(JSON.stringify({ build: 123 }), { status: 200 })
		);
		expect($staleAssetDetected.get()).toBe(false);

		await checkForNewerRelease(async () => {
			throw new TypeError('Network offline');
		});
		expect($staleAssetDetected.get()).toBe(false);
	});

	test('REL-STALE-1: sets atom true once a different build string is returned and keeps it true', async () => {
		await checkForNewerRelease(
			async () =>
				new Response(JSON.stringify({ version: '0.1.0-beta.2', build: 'newer-build-99' }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				})
		);
		expect($staleAssetDetected.get()).toBe(true);

		let secondFetchCalled = false;
		await checkForNewerRelease(async () => {
			secondFetchCalled = true;
			return new Response(JSON.stringify({ build: BUILD_ID }), { status: 200 });
		});
		expect(secondFetchCalled).toBe(false);
		expect($staleAssetDetected.get()).toBe(true);
	});

	test('REL-STALE-1: deduplicates concurrent release.json checks into one fetch', async () => {
		let calls = 0;
		let releaseFetch!: (response: Response) => void;
		const fetchImpl: ReleaseFetch = async () => {
			calls++;
			return new Promise<Response>((resolve) => {
				releaseFetch = resolve;
			});
		};

		const first = checkForNewerRelease(fetchImpl);
		const second = checkForNewerRelease(fetchImpl);
		expect(calls).toBe(1);

		releaseFetch(
			new Response(JSON.stringify({ build: 'updated-build' }), {
				status: 200
			})
		);
		await Promise.all([first, second]);
		expect($staleAssetDetected.get()).toBe(true);
	});

	test('REL-STALE-1: installStaleReleaseDetection triggers probe on worker failure', async () => {
		const originalFetch = globalThis.fetch;
		let probed = 0;
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			if (String(input) === '/release.json') {
				probed++;
				return new Response(JSON.stringify({ build: 'next-build' }), { status: 200 });
			}
			return new Response('', { status: 404 });
		}) as typeof fetch;

		const uninstall = installStaleReleaseDetection();
		try {
			reportWorkerFailure('storage-worker-error');
			await new Promise((resolve) => setTimeout(resolve, 10));
			expect(probed).toBe(1);
			expect($staleAssetDetected.get()).toBe(true);
		} finally {
			uninstall();
			globalThis.fetch = originalFetch;
		}
	});
});
