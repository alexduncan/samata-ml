import { BASE_LOCALE, isLocale, type Locale } from '../../config/locales';
import type { ContentDomain, ContentEntryMap, ContentIndex } from '../../types/content';
import { sanitiseFragment } from './sanitise-fragment';

/** Error codes thrown by {@link loadContentIndex} and {@link loadContentEntry}. */
export type ContentLoadErrorCode = 'NETWORK' | 'NOT_FOUND' | 'INVALID_INDEX' | 'INVALID_FRAGMENT';

/** Typed error thrown when loading or validating static content fails. */
export class ContentLoadError extends Error {
	/** Machine-readable failure category. */
	readonly code: ContentLoadErrorCode;

	/**
	 * Creates a new {@link ContentLoadError}.
	 *
	 * @param code - Failure category.
	 * @param message - Human-readable diagnostic detail.
	 */
	constructor(code: ContentLoadErrorCode, message: string) {
		super(message);
		this.name = 'ContentLoadError';
		this.code = code;
	}
}

/** Optional parameters for {@link loadContentIndex} and {@link loadContentEntry}. */
export interface ContentLoadInit {
	/** Target locale; defaults to {@link BASE_LOCALE}. */
	locale?: Locale;
	/** Optional cancellation signal. */
	signal?: AbortSignal;
}

const indexCache = new Map<string, Promise<ContentIndex<ContentDomain>>>();
const fragmentCache = new Map<string, Promise<DocumentFragment>>();

function createAbortError(signal: AbortSignal): unknown {
	return signal.reason ?? new DOMException('The operation was aborted.', 'AbortError');
}

function throwIfAborted(signal?: AbortSignal): void {
	if (signal?.aborted) {
		throw createAbortError(signal);
	}
}

function raceWithAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
	if (!signal) {
		return promise;
	}
	if (signal.aborted) {
		return Promise.reject(createAbortError(signal));
	}
	return new Promise<T>((resolve, reject) => {
		const onAbort = () => {
			reject(createAbortError(signal));
		};
		signal.addEventListener('abort', onAbort, { once: true });
		promise.then(
			(value) => {
				signal.removeEventListener('abort', onAbort);
				resolve(value);
			},
			(error) => {
				signal.removeEventListener('abort', onAbort);
				reject(error);
			}
		);
	});
}

function isValidContentIndex<D extends ContentDomain>(
	data: unknown,
	expectedLocale: Locale,
	expectedDomain: D
): data is ContentIndex<D> {
	if (!data || typeof data !== 'object' || Array.isArray(data)) {
		return false;
	}
	const candidate = data as Record<string, unknown>;
	if (
		candidate.version !== 1 ||
		candidate.locale !== expectedLocale ||
		candidate.domain !== expectedDomain ||
		!Array.isArray(candidate.entries)
	) {
		return false;
	}
	return candidate.entries.every((entry) => {
		if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
			return false;
		}
		const record = entry as Record<string, unknown>;
		return (
			typeof record.id === 'string' &&
			typeof record.lang === 'string' &&
			isLocale(record.lang) &&
			typeof record.title === 'string' &&
			typeof record.url === 'string'
		);
	});
}

function isSameOriginPath(url: string): boolean {
	return url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\');
}

async function fetchAndValidateIndex<D extends ContentDomain>(
	locale: Locale,
	domain: D,
	signal?: AbortSignal
): Promise<ContentIndex<D>> {
	const suffix = CONTENT_INDEX_VERSION ? `?v=${encodeURIComponent(CONTENT_INDEX_VERSION)}` : '';
	const url = `/content/${locale}/${domain}/index.json${suffix}`;
	let response: Response;
	try {
		response = await fetch(url, { signal });
	} catch (error) {
		if (signal?.aborted) {
			throw createAbortError(signal);
		}
		throw new ContentLoadError(
			'NETWORK',
			`Failed to fetch content index ${url}: ${String(error)}`
		);
	}

	if (!response.ok) {
		throw new ContentLoadError('NOT_FOUND', `Content index ${url} returned ${response.status}`);
	}

	let parsed: unknown;
	try {
		parsed = await response.json();
	} catch (error) {
		if (signal?.aborted) {
			throw createAbortError(signal);
		}
		throw new ContentLoadError('INVALID_INDEX', `Invalid JSON in content index ${url}`);
	}

	if (!isValidContentIndex(parsed, locale, domain)) {
		throw new ContentLoadError('INVALID_INDEX', `Malformed content index payload for ${url}`);
	}

	return parsed;
}

async function fetchAndSanitiseFragment(
	url: string,
	signal?: AbortSignal
): Promise<DocumentFragment> {
	if (!isSameOriginPath(url)) {
		throw new ContentLoadError('INVALID_FRAGMENT', `Disallowed fragment URL: ${url}`);
	}

	let response: Response;
	try {
		response = await fetch(url, { signal });
	} catch (error) {
		if (signal?.aborted) {
			throw createAbortError(signal);
		}
		throw new ContentLoadError(
			'NETWORK',
			`Failed to fetch content fragment ${url}: ${String(error)}`
		);
	}

	if (!response.ok) {
		throw new ContentLoadError(
			'NOT_FOUND',
			`Content fragment ${url} returned ${response.status}`
		);
	}

	const contentType = response.headers.get('content-type') ?? '';
	const mediaType = contentType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
	if (mediaType !== 'text/html') {
		throw new ContentLoadError(
			'NOT_FOUND',
			`Unexpected content-type '${contentType}' for fragment ${url}`
		);
	}

	let html: string;
	try {
		html = await response.text();
	} catch (error) {
		if (signal?.aborted) {
			throw createAbortError(signal);
		}
		throw new ContentLoadError(
			'NETWORK',
			`Failed to read content fragment ${url}: ${String(error)}`
		);
	}

	const trimmedStart = html.trimStart().toLowerCase();
	if (trimmedStart.startsWith('<!doctype') || /<html[\s>]/i.test(html)) {
		throw new ContentLoadError(
			'NOT_FOUND',
			`Fragment URL ${url} returned an HTML document instead of a fragment`
		);
	}

	try {
		return sanitiseFragment(html);
	} catch (error) {
		throw new ContentLoadError(
			'INVALID_FRAGMENT',
			`Failed to sanitise fragment ${url}: ${String(error)}`
		);
	}
}

/**
 * Loads and validates the JSON index for a content domain and locale.
 * Caches the in-flight or resolved index promise per `(locale, domain)` for the session,
 * evicting failed or aborted fetches so subsequent attempts can retry.
 *
 * @param domain - Content domain (`pages`, `models`, or `glossary`).
 * @param init - Optional locale and abort signal.
 * @returns The validated {@link ContentIndex}.
 * @throws {@link ContentLoadError} when the request fails, is missing, or has an invalid schema.
 */
export async function loadContentIndex<D extends ContentDomain>(
	domain: D,
	init?: ContentLoadInit
): Promise<ContentIndex<D>> {
	throwIfAborted(init?.signal);
	const locale = init?.locale ?? BASE_LOCALE;
	const cacheKey = `${locale}:${domain}`;

	let pending = indexCache.get(cacheKey) as Promise<ContentIndex<D>> | undefined;
	if (!pending) {
		const created = fetchAndValidateIndex(locale, domain, init?.signal).catch((error) => {
			if (indexCache.get(cacheKey) === created) {
				indexCache.delete(cacheKey);
			}
			throw error;
		});
		pending = created;
		indexCache.set(cacheKey, created as Promise<ContentIndex<ContentDomain>>);
		if (init?.signal) {
			const onAbort = () => {
				if (indexCache.get(cacheKey) === created) {
					indexCache.delete(cacheKey);
				}
			};
			init.signal.addEventListener('abort', onAbort, { once: true });
			void created.then(
				() => init.signal?.removeEventListener('abort', onAbort),
				() => init.signal?.removeEventListener('abort', onAbort)
			);
		}
	}

	return raceWithAbort(pending, init?.signal);
}

/**
 * Loads one content entry's metadata and sanitised `DocumentFragment`.
 * Caches the fragment template by URL so fallback entries shared across locales only fetch once,
 * and returns a fresh `cloneNode(true)` on every call.
 *
 * @param domain - Content domain (`pages`, `models`, or `glossary`).
 * @param id - Entry identifier within the domain.
 * @param init - Optional locale and abort signal.
 * @returns The matching index entry and a cloned `DocumentFragment`.
 * @throws {@link ContentLoadError} when the index or fragment cannot be loaded or validated.
 */
export async function loadContentEntry<D extends ContentDomain>(
	domain: D,
	id: string,
	init?: ContentLoadInit
): Promise<{ entry: ContentEntryMap[D]; content: DocumentFragment }> {
	throwIfAborted(init?.signal);
	const index = await loadContentIndex(domain, init);
	throwIfAborted(init?.signal);

	const entry = index.entries.find((item) => item.id === id);
	if (!entry) {
		throw new ContentLoadError(
			'NOT_FOUND',
			`Content entry '${id}' not found in ${index.locale}/${domain}`
		);
	}

	let pendingFragment = fragmentCache.get(entry.url);
	if (!pendingFragment) {
		const created = fetchAndSanitiseFragment(entry.url, init?.signal).catch((error) => {
			if (fragmentCache.get(entry.url) === created) {
				fragmentCache.delete(entry.url);
			}
			throw error;
		});
		pendingFragment = created;
		fragmentCache.set(entry.url, created);
		if (init?.signal) {
			const onAbort = () => {
				if (fragmentCache.get(entry.url) === created) {
					fragmentCache.delete(entry.url);
				}
			};
			init.signal.addEventListener('abort', onAbort, { once: true });
			void created.then(
				() => init.signal?.removeEventListener('abort', onAbort),
				() => init.signal?.removeEventListener('abort', onAbort)
			);
		}
	}

	const template = await raceWithAbort(pendingFragment, init?.signal);
	throwIfAborted(init?.signal);

	return {
		entry,
		content: template.cloneNode(true) as DocumentFragment
	};
}

/**
 * @internal Clears cached index and fragment promises. For unit tests only.
 */
export function resetContentCache(): void {
	indexCache.clear();
	fragmentCache.clear();
}
