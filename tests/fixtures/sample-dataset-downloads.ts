import { expect, type BrowserContext } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const sources = {
	'palmer-penguins': {
		url: 'https://raw.githubusercontent.com/allisonhorst/palmerpenguins/156daa4301838d9fdcc5b018b29b9149bf975552/inst/extdata/penguins.csv',
		sha256: 'f204db2c753b0937caac3cb35258562c14f073e4bbc76be24b4c51ce22767a93'
	},
	'credit-card-default': {
		url: 'https://huggingface.co/datasets/scikit-learn/credit-card-clients/resolve/f809522649eaf948ad40a11ed575c4bb4d4460c1/UCI_Credit_Card.csv',
		sha256: 'a0f0ab49d6326671d6cd83be5c88dcf18007025fe9a53ecd699119c871176ca1'
	}
} as const;

/** Intercepts a pinned publisher URL with bytes verified from this checkout's build cache. */
export async function interceptSampleDownload(
	context: BrowserContext,
	id: keyof typeof sources
): Promise<() => void> {
	const source = sources[id];
	const bytes = await readFile(
		path.resolve('node_modules/.cache/samata-ml/remote-datasets', source.sha256 + '.csv')
	);
	expect(createHash('sha256').update(bytes).digest('hex')).toBe(source.sha256);
	let hits = 0;
	await context.route(source.url, async (route) => {
		const request = route.request();
		const headers = await request.allHeaders();
		expect(request.method()).toBe('GET');
		expect(headers.cookie).toBeUndefined();
		expect(headers.referer).toBeUndefined();
		hits++;
		await route.fulfill({
			status: 200,
			body: bytes,
			headers: { 'access-control-allow-origin': '*', 'content-type': 'text/csv' }
		});
	});
	return () => expect(hits, `intercepted ${id} download`).toBeGreaterThan(0);
}
