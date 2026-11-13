import {
	IDBCursor,
	IDBDatabase,
	IDBFactory,
	IDBIndex,
	IDBKeyRange,
	IDBObjectStore,
	IDBRequest,
	IDBTransaction
} from 'fake-indexeddb';

/** Installs an isolated IndexedDB implementation for a test and returns its cleanup function. */
export function installFakeIndexedDB(): () => void {
	const globals = {
		indexedDB: new IDBFactory(),
		IDBCursor,
		IDBDatabase,
		IDBKeyRange,
		IDBIndex,
		IDBObjectStore,
		IDBRequest,
		IDBTransaction
	};
	const originalDescriptors = new Map(
		Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)])
	);
	for (const [key, value] of Object.entries(globals)) {
		Object.defineProperty(globalThis, key, { configurable: true, value, writable: true });
	}

	return () => {
		for (const [key, descriptor] of originalDescriptors) {
			if (descriptor) {
				Object.defineProperty(globalThis, key, descriptor);
			} else {
				Reflect.deleteProperty(globalThis, key);
			}
		}
	};
}
