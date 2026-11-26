import type { SampleDatasetDescriptor, SampleDatasetIndex } from '../../types/sample-dataset';
import { sanitiseFragment } from '../../common/content/sanitise-fragment';

let cataloguePromise: Promise<SampleDatasetIndex> | undefined;
const descriptorPromises = new Map<string, Promise<SampleDatasetDescriptor>>();
const datasheetPromises = new Map<string, Promise<string>>();

/** Loads and validates the same-origin sample dataset catalogue. */
export async function loadSampleCatalogue(signal?: AbortSignal): Promise<SampleDatasetIndex> {
	if (!cataloguePromise) {
		cataloguePromise = (async () => {
			const suffix = DATASETS_INDEX_VERSION
				? `?v=${encodeURIComponent(DATASETS_INDEX_VERSION)}`
				: '';
			const response = await fetch(`/datasets/index.json${suffix}`, { signal });
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

/**
 * Loads and sanitises the HTML datasheet fragment for a sample dataset.
 *
 * @param id - Sample dataset identifier.
 * @param signal - Optional abort signal.
 * @returns A fresh, sanitised DocumentFragment safe to mount into the DOM.
 */
export async function loadSampleDatasheet(
	id: string,
	signal?: AbortSignal
): Promise<DocumentFragment> {
	let pending = datasheetPromises.get(id);
	if (!pending) {
		pending = (async () => {
			const descriptor = await loadSampleDescriptor(id, signal);
			const url = descriptor.files?.datasheet;
			if (!url || typeof url !== 'string') {
				throw new Error(`Datasheet URL is missing for sample: ${id}`);
			}
			// Same-origin validation: must be a root-relative path without protocol or domain
			if (!url.startsWith('/') || url.startsWith('//')) {
				throw new Error(`Datasheet URL must be same-origin: ${url}`);
			}
			const response = await fetch(url, { signal });
			if (!response.ok) {
				throw new Error(`Datasheet request failed: ${response.status}`);
			}
			const contentType = response.headers.get('content-type') ?? '';
			if (!contentType.includes('text/html')) {
				throw new Error(`Datasheet has invalid content type: ${contentType}`);
			}
			const text = await response.text();
			if (/<(?:!doctype|html|head|body)\b/i.test(text)) {
				throw new Error('Datasheet must be an HTML fragment, not a full document');
			}
			return text;
		})();
		datasheetPromises.set(id, pending);
	}

	try {
		const html = await pending;
		return sanitiseFragment(html);
	} catch (error) {
		datasheetPromises.delete(id);
		throw error;
	}
}

/** @internal Clears cached catalogue and descriptors for tests. */
export function resetSampleDatasetCache(): void {
	cataloguePromise = undefined;
	descriptorPromises.clear();
	datasheetPromises.clear();
}
