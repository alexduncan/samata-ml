import { GlobalWindow } from 'happy-dom';
import { TEST_BUILD_CONSTANTS } from '../scripts/build-constants';

Object.assign(globalThis, TEST_BUILD_CONSTANTS);
const envGlobals = globalThis as unknown as Record<string, unknown>;
if (envGlobals.WEB_ML_RUNTIME_URL === undefined) {
	envGlobals.WEB_ML_RUNTIME_URL = '/web-ml/test/index.js';
}
if (envGlobals.WEB_ML_RUNTIME_REVISION === undefined) {
	envGlobals.WEB_ML_RUNTIME_REVISION = 'test';
}

const window = new GlobalWindow({ url: 'http://localhost:3000' });

// Register DOM properties and classes onto globalThis
for (const key of Object.getOwnPropertyNames(window)) {
	if (key in globalThis) continue;
	try {
		Object.defineProperty(globalThis, key, {
			value: (window as unknown as Record<string, unknown>)[key],
			configurable: true,
			writable: true
		});
	} catch {
		// Ignore non-configurable properties
	}
}

globalThis.window = window as unknown as Window & typeof globalThis;
globalThis.document = window.document as unknown as Document;
globalThis.customElements = window.customElements as unknown as CustomElementRegistry;

// Mock Web Locks API for terminal tests
class MockLockManager {
	private readonly heldLocks = new Set<string>();

	async request(
		name: string,
		optionsOrCallback:
			| { mode?: 'exclusive' | 'shared'; ifAvailable?: boolean }
			| ((lock: { name: string; mode: string } | null) => unknown),
		callback?: (lock: { name: string; mode: string } | null) => unknown
	): Promise<unknown> {
		let options: { mode?: 'exclusive' | 'shared'; ifAvailable?: boolean } = {};
		let cb: (lock: { name: string; mode: string } | null) => unknown;

		if (typeof optionsOrCallback === 'function') {
			cb = optionsOrCallback;
		} else {
			options = optionsOrCallback;
			cb = callback!;
		}

		if (this.heldLocks.has(name)) {
			if (options.ifAvailable) {
				return await cb(null);
			}
		}

		this.heldLocks.add(name);
		try {
			const lock = { name, mode: options.mode ?? 'exclusive' };
			return await cb(lock);
		} finally {
			this.heldLocks.delete(name);
		}
	}

	async query(): Promise<{ held: { name: string; mode: string }[]; pending: unknown[] }> {
		return {
			held: Array.from(this.heldLocks).map((name) => ({ name, mode: 'exclusive' })),
			pending: []
		};
	}

	_holdLock(name: string): () => void {
		this.heldLocks.add(name);
		return () => {
			this.heldLocks.delete(name);
		};
	}

	_clear(): void {
		this.heldLocks.clear();
	}
}

const mockLocks = new MockLockManager();
if (!globalThis.navigator) {
	Object.defineProperty(globalThis, 'navigator', {
		value: { locks: mockLocks },
		configurable: true,
		writable: true
	});
} else {
	Object.defineProperty(globalThis.navigator, 'locks', {
		value: mockLocks,
		configurable: true,
		writable: true
	});
}
