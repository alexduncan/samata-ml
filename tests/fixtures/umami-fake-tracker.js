(function () {
	'use strict';

	/**
	 * Installs a fake `window.umami` tracker bound to `scriptElement` and a `send` transport.
	 *
	 * @param {HTMLScriptElement} scriptElement
	 * @param {(body: unknown, headers: Record<string, string>) => unknown} send
	 */
	function installFakeUmami(scriptElement, send) {
		const website = scriptElement?.getAttribute('data-website-id') ?? '';
		const beforeSendName = scriptElement?.getAttribute('data-before-send') ?? '';
		const excludeSearch = scriptElement?.getAttribute('data-exclude-search') === 'true';
		const excludeHash = scriptElement?.getAttribute('data-exclude-hash') === 'true';

		function defaultPayload() {
			const parsed = new URL(location.href);
			if (excludeSearch) parsed.search = '';
			if (excludeHash) parsed.hash = '';
			return {
				website,
				hostname: location.hostname,
				screen: `${screen.width}x${screen.height}`,
				language: navigator.language,
				title: document.title,
				referrer: document.referrer,
				url: parsed.href,
				salt: 'umami-fake-salt'
			};
		}

		const targetGlobal = typeof window !== 'undefined' ? window : globalThis;
		const tracker = {
			track(arg) {
				let payload;
				if (typeof arg === 'function') {
					payload = arg(defaultPayload());
				} else if (typeof arg === 'string') {
					payload = { ...defaultPayload(), name: arg };
				} else if (arg && typeof arg === 'object') {
					payload = arg;
				} else {
					return Promise.resolve();
				}

				const beforeSend =
					beforeSendName && typeof targetGlobal[beforeSendName] === 'function'
						? targetGlobal[beforeSendName]
						: beforeSendName && typeof globalThis[beforeSendName] === 'function'
							? globalThis[beforeSendName]
							: null;
				if (beforeSend) {
					const filtered = beforeSend('event', payload);
					if (!filtered) {
						return Promise.resolve();
					}
					payload = filtered;
				}

				return Promise.resolve(
					send(
						{ type: 'event', payload },
						{
							'x-umami-website-id': website,
							'x-umami-hostname': location.hostname
						}
					)
				);
			}
		};
		targetGlobal.umami = tracker;
		globalThis.umami = tracker;
	}

	globalThis.installFakeUmami = installFakeUmami;

	if (
		typeof document !== 'undefined' &&
		document.currentScript &&
		document.currentScript.getAttribute('src') === 'https://cloud.umami.is/script.js'
	) {
		const credentials = document.currentScript.getAttribute('data-fetch-credentials') || 'omit';
		installFakeUmami(document.currentScript, (body, headers) =>
			fetch('https://gateway.umami.is/api/send', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...headers
				},
				body: JSON.stringify(body),
				keepalive: true,
				credentials
			})
		);
	}
})();
