import type { SampleDatasetDescriptor, SampleDatasetIndex } from '../../types/sample-dataset';

let cataloguePromise: Promise<SampleDatasetIndex> | undefined;
const descriptorPromises = new Map<string, Promise<SampleDatasetDescriptor>>();

/** Loads and validates the same-origin sample dataset catalogue. */
export async function loadSampleCatalogue(signal?: AbortSignal): Promise<SampleDatasetIndex> {
	if (!cataloguePromise) {
		cataloguePromise = (async () => {
			const response = await fetch('/datasets/index.json', { signal });
			if (!response.ok)
				throw new Error(`Sample catalogue request failed: ${response.status}`);
			const value: unknown = await response.json();
			if (
				!value ||
				typeof value !== 'object' ||
				(value as { version?: unknown }).version !== 1 ||
				!Array.isArray((value as { entries?: unknown }).entries)
			) {
				throw new Error('Sample catalogue has an unsupported version or shape');
			}
			return value as SampleDatasetIndex;
		})().catch((error: unknown) => {
			cataloguePromise = undefined;
			throw error;
		});
	}
	return cataloguePromise;
}

/** Loads one sample descriptor using the versioned URL from the catalogue. */
export async function loadSampleDescriptor(
	id: string,
	signal?: AbortSignal
): Promise<SampleDatasetDescriptor> {
	const cached = descriptorPromises.get(id);
	if (cached) return cached;
	const pending = (async () => {
		const catalogue = await loadSampleCatalogue(signal);
		const entry = catalogue.entries.find((item) => item.id === id);
		if (!entry) throw new Error(`Sample dataset not found: ${id}`);
		if (
			!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) ||
			!new RegExp(`^/datasets/${id}/descriptor\\.json\\?v=[a-f0-9]{12}$`).test(
				entry.descriptorUrl
			)
		) {
			throw new Error(`Sample descriptor URL is invalid: ${id}`);
		}
		const response = await fetch(entry.descriptorUrl, { signal });
		if (!response.ok) throw new Error(`Sample descriptor request failed: ${response.status}`);
		const descriptor: unknown = await response.json();
		if (
			!descriptor ||
			typeof descriptor !== 'object' ||
			(descriptor as { id?: unknown }).id !== id
		) {
			throw new Error(`Sample descriptor is invalid: ${id}`);
		}
		return descriptor as SampleDatasetDescriptor;
	})();
	descriptorPromises.set(id, pending);
	try {
		return await pending;
	} catch (error) {
		descriptorPromises.delete(id);
		throw error;
	}
}

/** @internal Clears cached catalogue and descriptors for tests. */
export function resetSampleDatasetCache(): void {
	cataloguePromise = undefined;
	descriptorPromises.clear();
}
