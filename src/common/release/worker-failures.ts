/**
 * Fixed worker-failure categories reported by storage, training and analysis clients.
 */
export type WorkerFailureCode =
	| 'storage-worker-error'
	| 'storage-worker-protocol-error'
	| 'training-worker-startup-failed'
	| 'training-worker-crashed'
	| 'training-worker-protocol-error'
	| 'analysis-worker-failed';

/** Listener callback invoked synchronously when a worker failure is reported. */
export type WorkerFailureListener = (code: WorkerFailureCode) => void;

const listeners = new Set<WorkerFailureListener>();

/**
 * Notifies registered listeners of a worker startup, crash or protocol failure.
 *
 * Each listener runs inside a `try`/`catch` block so observer errors cannot interrupt worker recovery.
 *
 * @param code - Fixed worker-failure category.
 */
export function reportWorkerFailure(code: WorkerFailureCode): void {
	for (const listener of [...listeners]) {
		try {
			listener(code);
		} catch {
			// Listener failures must never disrupt worker settlement or cleanup.
		}
	}
}

/**
 * Subscribes a listener to worker-failure notifications.
 *
 * @param listener - Callback receiving each reported {@link WorkerFailureCode}.
 * @returns Unsubscribe function removing `listener`.
 */
export function onWorkerFailure(listener: WorkerFailureListener): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

/**
 * Clears all registered worker-failure listeners (unit tests only).
 */
export function resetWorkerFailuresForTests(): void {
	listeners.clear();
}
