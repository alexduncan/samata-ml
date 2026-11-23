import { atom, type ReadableAtom } from 'nanostores';
import { onWorkerFailure } from './worker-failures';

const $staleAssetDetectedWritable = atom(false);

/**
 * Reactive flag indicating that `/release.json` reported a newer deployed `build` than the running bundle.
 *
 * Once `true`, it remains `true` for the lifetime of the document.
 */
export const $staleAssetDetected: ReadableAtom<boolean> = $staleAssetDetectedWritable;

let inflightCheck: Promise<void> | null = null;

/** Fetch signature used by {@link checkForNewerRelease}. */
export type ReleaseFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * Probes `/release.json` (`cache: 'no-store'`) and sets {@link $staleAssetDetected} if a newer `build` is deployed.
 *
 * At most one probe runs concurrently. Any network, HTTP status or JSON parse error is ignored silently.
 *
 * @param fetchImpl - Optional `fetch` implementation for testing.
 * @returns Promise that resolves once the probe completes.
 */
export function checkForNewerRelease(fetchImpl: ReleaseFetch = fetch): Promise<void> {
	if ($staleAssetDetectedWritable.get()) {
		return Promise.resolve();
	}
	if (inflightCheck) {
		return inflightCheck;
	}

	inflightCheck = (async () => {
		try {
			const response = await fetchImpl('/release.json', { cache: 'no-store' });
			if (response.status !== 200) {
				return;
			}
			const payload: unknown = await response.json();
			if (
				payload !== null &&
				typeof payload === 'object' &&
				'build' in payload &&
				typeof (payload as { build: unknown }).build === 'string' &&
				(payload as { build: string }).build !== BUILD_ID
			) {
				$staleAssetDetectedWritable.set(true);
			}
		} catch {
			// Network, status or parse errors leave the stale-release flag unchanged.
		} finally {
			inflightCheck = null;
		}
	})();

	return inflightCheck;
}

/**
 * Connects worker-failure reports to {@link checkForNewerRelease}.
 *
 * @returns Unsubscribe function removing the worker-failure listener.
 */
export function installStaleReleaseDetection(): () => void {
	return onWorkerFailure(() => {
		void checkForNewerRelease();
	});
}

/**
 * Resets stale-release detection state (unit tests only).
 */
export function resetStaleReleaseForTests(): void {
	$staleAssetDetectedWritable.set(false);
	inflightCheck = null;
}
