import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
	ContentLoadError,
	loadContentEntry,
	loadContentIndex,
	resetContentCache
} from '../src/common/content/content-loader';
import { sanitiseFragment } from '../src/common/content/sanitise-fragment';
import type { ContentIndex } from '../src/types/content';

const originalFetch = globalThis.fetch;

function stubFetch(
	handler: (input: string, init?: RequestInit) => Promise<Response> | Response
): void {
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url =
			typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
		return handler(url, init);
	}) as typeof fetch;
}

function makePageIndex(overrides: Partial<ContentIndex<'pages'>> = {}): ContentIndex<'pages'> {
	return {
		version: 1,
		locale: 'en',
		domain: 'pages',
		entries: [
			{
				id: 'about',
				lang: 'en',
				title: 'About samatā.ml',
				description: 'About description',
				url: '/content/en/pages/about.html?v=abc123def456',
				headings: []
			}
		],
		...overrides
	};
}

describe('Content loader and fragment sanitiser', () => {
	beforeEach(() => {
		resetContentCache();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		resetContentCache();
	});

	it('CNT-L-1: sanitiseFragment strips disallowed elements, attributes, unsafe links and external images', () => {
		const frag = sanitiseFragment(
			'<p onclick="x">a<script>b</script><img src="https://e.org/i.png" alt="i"><a href="javascript:x">c</a><a href="https://e.org">d</a></p>'
		);

		expect(frag.childNodes.length).toBe(1);
		const p = frag.firstElementChild!;
		expect(p.tagName.toLowerCase()).toBe('p');
		expect(p.attributes.length).toBe(0);
		expect(p.querySelector('script')).toBeNull();
		expect(p.querySelector('img')).toBeNull();

		const links = p.querySelectorAll('a');
		expect(links.length).toBe(1);
		const externalLink = links[0]!;
		expect(externalLink.getAttribute('href')).toBe('https://e.org');
		expect(externalLink.getAttribute('target')).toBe('_blank');
		expect(externalLink.getAttribute('rel')).toBe('noopener noreferrer');
		expect(externalLink.textContent).toBe('d');
		expect(p.textContent).toBe('ad');
	});

	it('sanitiseFragment keeps valid same-origin images, mailto links, anchors, and code language classes', () => {
		const frag = sanitiseFragment(
			'<h2 id="intro" onclick="bad()">Intro</h2><p><a href="#intro" target="_blank">Jump</a> <a href="mailto:hi@e.org">Mail</a></p><pre><code class="language-ts extra">x</code></pre><img src="/assets/x.svg" alt="Chart">'
		);

		const h2 = frag.querySelector('h2')!;
		expect(h2.getAttribute('id')).toBe('intro');
		expect(h2.hasAttribute('onclick')).toBe(false);

		const anchors = frag.querySelectorAll('a');
		expect(anchors.length).toBe(2);
		expect(anchors[0]!.hasAttribute('target')).toBe(false);
		expect(anchors[1]!.getAttribute('href')).toBe('mailto:hi@e.org');

		const code = frag.querySelector('code')!;
		expect(code.hasAttribute('class')).toBe(false);

		const img = frag.querySelector('img')!;
		expect(img.getAttribute('src')).toBe('/assets/x.svg');
		expect(img.getAttribute('alt')).toBe('Chart');
	});

	it('CNT-L-2: caches index and fragment per session and returns distinct DocumentFragments', async () => {
		let indexCalls = 0;
		let fragmentCalls = 0;

		stubFetch((url) => {
			if (url === '/content/en/pages/index.json') {
				indexCalls++;
				return new Response(JSON.stringify(makePageIndex()), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				});
			}
			if (url === '/content/en/pages/about.html?v=abc123def456') {
				fragmentCalls++;
				return new Response('<p>Hello <strong>world</strong></p>', {
					status: 200,
					headers: { 'Content-Type': 'text/html; charset=utf-8' }
				});
			}
			return new Response('Not found', { status: 404 });
		});

		const first = await loadContentEntry('pages', 'about');
		const second = await loadContentEntry('pages', 'about');

		expect(indexCalls).toBe(1);
		expect(fragmentCalls).toBe(1);
		expect(first.content).not.toBe(second.content);
		expect(first.content.firstElementChild?.outerHTML).toBe(
			second.content.firstElementChild?.outerHTML
		);

		// Mutating first fragment does not affect subsequent calls
		first.content.firstElementChild?.remove();
		const third = await loadContentEntry('pages', 'about');
		expect(third.content.firstElementChild?.textContent).toBe('Hello world');
	});

	it('CNT-L-3: maps HTTP, network, schema, SPA fallback, and abort failures to expected error codes without sticky failure caches', async () => {
		// 1. Index 404 -> NOT_FOUND
		stubFetch(() => new Response('Missing', { status: 404 }));
		await expect(loadContentIndex('pages')).rejects.toMatchObject({
			name: 'ContentLoadError',
			code: 'NOT_FOUND'
		} satisfies Partial<ContentLoadError>);

		// 2. Fetch rejection -> NETWORK, then retries cleanly
		let networkCalls = 0;
		stubFetch(() => {
			networkCalls++;
			if (networkCalls === 1) {
				return Promise.reject(new TypeError('offline'));
			}
			return new Response(JSON.stringify(makePageIndex()), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			});
		});
		await expect(loadContentIndex('pages')).rejects.toMatchObject({ code: 'NETWORK' });
		const recovered = await loadContentIndex('pages');
		expect(recovered.entries.length).toBe(1);
		expect(networkCalls).toBe(2);

		// 3. { version: 2 } -> INVALID_INDEX
		resetContentCache();
		stubFetch(
			() =>
				new Response(
					JSON.stringify({ version: 2, locale: 'en', domain: 'pages', entries: [] }),
					{
						status: 200
					}
				)
		);
		await expect(loadContentIndex('pages')).rejects.toMatchObject({ code: 'INVALID_INDEX' });

		// 4. Locale mismatch -> INVALID_INDEX
		resetContentCache();
		stubFetch(
			() =>
				new Response(
					JSON.stringify({ version: 1, locale: 'fr', domain: 'pages', entries: [] }),
					{ status: 200 }
				)
		);
		await expect(loadContentIndex('pages')).rejects.toMatchObject({ code: 'INVALID_INDEX' });

		// 5. Unknown id -> NOT_FOUND
		resetContentCache();
		stubFetch((url) => {
			if (url === '/content/en/pages/index.json') {
				return new Response(JSON.stringify(makePageIndex()), { status: 200 });
			}
			return new Response('<p>ok</p>', {
				status: 200,
				headers: { 'Content-Type': 'text/html' }
			});
		});
		await expect(loadContentEntry('pages', 'nonexistent')).rejects.toMatchObject({
			code: 'NOT_FOUND'
		});

		// 6. Fragment response of <!doctype html><html>... with status 200 -> NOT_FOUND
		resetContentCache();
		stubFetch((url) => {
			if (url === '/content/en/pages/index.json') {
				return new Response(JSON.stringify(makePageIndex()), { status: 200 });
			}
			return new Response('<!doctype html><html><body>SPA shell</body></html>', {
				status: 200,
				headers: { 'Content-Type': 'text/html; charset=utf-8' }
			});
		});
		await expect(loadContentEntry('pages', 'about')).rejects.toMatchObject({
			code: 'NOT_FOUND'
		});

		// 7. Non-text/html content-type with status 200 -> NOT_FOUND
		resetContentCache();
		stubFetch((url) => {
			if (url === '/content/en/pages/index.json') {
				return new Response(JSON.stringify(makePageIndex()), { status: 200 });
			}
			return new Response('<p>text</p>', {
				status: 200,
				headers: { 'Content-Type': 'text/plain' }
			});
		});
		await expect(loadContentEntry('pages', 'about')).rejects.toMatchObject({
			code: 'NOT_FOUND'
		});

		// 8. Aborted signal rejects and caches nothing
		resetContentCache();
		let fetchCount = 0;
		stubFetch(() => {
			fetchCount++;
			if (fetchCount === 1) {
				return new Promise<Response>(() => {
					// Never resolves; aborted by caller
				});
			}
			return new Response(JSON.stringify(makePageIndex()), { status: 200 });
		});
		const controller = new AbortController();
		const abortedPromise = loadContentIndex('pages', { signal: controller.signal });
		controller.abort(new DOMException('Cancelled', 'AbortError'));
		await expect(abortedPromise).rejects.toMatchObject({ name: 'AbortError' });

		// Subsequent call fetches fresh (nothing was cached)
		const afterAbort = await loadContentIndex('pages');
		expect(afterAbort.version).toBe(1);
		expect(fetchCount).toBe(2);
	});

	it('CNT-L-4: defaults locale to en and preserves entry.lang from index', async () => {
		const requestedUrls: string[] = [];
		stubFetch((url) => {
			requestedUrls.push(url);
			if (url === '/content/en/pages/index.json') {
				return new Response(JSON.stringify(makePageIndex()), { status: 200 });
			}
			return new Response('<p>Content</p>', {
				status: 200,
				headers: { 'Content-Type': 'text/html' }
			});
		});

		const result = await loadContentEntry('pages', 'about');
		expect(requestedUrls[0]).toBe('/content/en/pages/index.json');
		expect(result.entry.lang).toBe('en');
	});
});
