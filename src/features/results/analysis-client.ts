import { isRopeReply, ropeRequestId, type RopeRequest, type RopeView } from './analysis-protocol';

type Pending = {
	resolve: (value: RopeView) => void;
	reject: (reason: unknown) => void;
	cleanup: () => void;
};

/** Owns a lazy worker and settles each pending comparison exactly once. */
export class AnalysisClient {
	private worker: Worker | null = null;
	private nextId = 1;
	private readonly pending = new Map<number, Pending>();

	constructor(
		private readonly createWorker: () => Worker = () =>
			new Worker(ANALYSIS_WORKER_URL, { type: 'module' })
	) {}

	private fail(): void {
		if (this.worker) {
			this.worker.onmessage = null;
			this.worker.onerror = null;
			this.worker.onmessageerror = null;
			this.worker.terminate();
		}
		this.worker = null;
		for (const pending of this.pending.values()) {
			pending.cleanup();
			pending.reject(new Error('Analysis worker failed'));
		}
		this.pending.clear();
	}

	private getWorker(): Worker {
		if (this.worker) return this.worker;
		const worker = this.createWorker();
		worker.onmessage = (event: MessageEvent<unknown>) => {
			if (!isRopeReply(event.data)) {
				const id = ropeRequestId(event.data);
				const pending = id === null ? undefined : this.pending.get(id);
				if (pending && id !== null) {
					this.pending.delete(id);
					pending.cleanup();
					pending.reject(new Error('Invalid analysis reply'));
				}
				return;
			}
			const pending = this.pending.get(event.data.id);
			if (!pending) return;
			this.pending.delete(event.data.id);
			pending.cleanup();
			if (event.data.type === 'rope-result') pending.resolve(event.data.result);
			else pending.reject(new Error(event.data.reason));
		};
		worker.onerror = () => this.fail();
		worker.onmessageerror = () => this.fail();
		this.worker = worker;
		return worker;
	}

	/** Requests a posterior, detaching the caller when its signal aborts. */
	requestRope(input: Omit<RopeRequest, 'id' | 'type'>, signal: AbortSignal): Promise<RopeView> {
		return new Promise((resolve, reject) => {
			if (signal.aborted) {
				reject(signal.reason);
				return;
			}
			const id = this.nextId++;
			const abort = () => {
				this.pending.delete(id);
				signal.removeEventListener('abort', abort);
				reject(signal.reason);
			};
			try {
				const worker = this.getWorker();
				signal.addEventListener('abort', abort, { once: true });
				this.pending.set(id, {
					resolve,
					reject,
					cleanup: () => signal.removeEventListener('abort', abort)
				});
				worker.postMessage({ ...input, id, type: 'rope' } satisfies RopeRequest);
			} catch (error) {
				this.pending.delete(id);
				signal.removeEventListener('abort', abort);
				reject(error);
			}
		});
	}

	/** Terminates the worker and rejects all outstanding requests. */
	dispose(): void {
		this.fail();
	}
}
