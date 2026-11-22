import { expect, test, type Page } from '@playwright/test';
import compas from '../content/datasets/compas-recidivism/descriptor';
import { APP_URL, DIST_URL } from '../scripts/ports';

type ProbeReply =
	| { kind: 'trained'; runtimeUrl: string }
	| { kind: 'not-isolated' | 'cancelled' }
	| {
			kind: 'one-shot';
			hasFit: boolean;
			partitions: number;
			trainingReports: number;
			baselines: string[];
			rows: number;
			positiveLabel: string | null;
	  }
	| { kind: 'failed'; detail: string };

async function runProbe(page: Page, command: 'train' | 'cancel' | 'one-shot'): Promise<ProbeReply> {
	return page.evaluate(
		(command) =>
			new Promise<ProbeReply>((resolve, reject) => {
				const worker = new Worker('/runtime.worker.js', { type: 'module' });
				worker.onmessage = ({ data }: MessageEvent<ProbeReply>) => {
					worker.terminate();
					resolve(data);
				};
				worker.onerror = (event) => {
					worker.terminate();
					reject(new Error(event.message || 'Runtime probe worker failed to load'));
				};
				worker.postMessage({ command, documentIsolated: window.crossOriginIsolated });
			}),
		command
	);
}

const origins = [
	{ name: 'development', url: APP_URL },
	{ name: 'production', url: DIST_URL }
];

for (const origin of origins) {
	test.describe(origin.name, () => {
		test('WML-P3-ASSET-1/2: isolates the document and trains with same-origin SVC assets', async ({
			page,
			request
		}) => {
			const document = await page.goto(`${origin.url}/models`);
			expect(document?.headers()).toMatchObject({
				'cross-origin-opener-policy': 'same-origin',
				'cross-origin-embedder-policy': 'require-corp',
				'cross-origin-resource-policy': 'same-origin'
			});
			expect(
				await page.evaluate(() => ({
					isolated: window.crossOriginIsolated,
					sharedMemory: typeof SharedArrayBuffer === 'function'
				}))
			).toEqual({ isolated: true, sharedMemory: true });

			const reply = await runProbe(page, 'train');
			expect(reply).toMatchObject({ kind: 'trained' });
			if (reply.kind !== 'trained') throw new Error(JSON.stringify(reply));
			expect(reply.runtimeUrl).toMatch(/^\/web-ml\/0\.2\.0-[0-9a-f]{64}\/index\.js$/);
			const entry = new URL(reply.runtimeUrl, origin.url);
			expect(entry.origin).toBe(origin.url);

			for (const script of [entry, new URL('training-worker-svm.js', entry)]) {
				const response = await request.get(script.href);
				expect(response.ok()).toBe(true);
				expect(response.headers()['content-type']).toMatch(/^application\/javascript/);
				expect(response.headers()['cross-origin-embedder-policy']).toBe('require-corp');
			}
			const wasm = await request.get(new URL('wasm/libsvm.wasm', entry).href);
			expect(wasm.ok()).toBe(true);
			expect(wasm.headers()['content-type']).toBe('application/wasm');
		});

		test('WML-P4-ASSET-2: completes a One-Shot fit requesting evaluation and fitted artefacts', async ({
			page
		}) => {
			await page.goto(`${origin.url}/models`);
			expect(await runProbe(page, 'one-shot')).toEqual({
				kind: 'one-shot',
				hasFit: true,
				partitions: 1,
				trainingReports: 1,
				baselines: ['most-frequent', 'stratified'],
				rows: 8,
				positiveLabel: 'right'
			});
		});

		test('WML-P3-ASSET-2: cancels a real run through the public API', async ({ page }) => {
			await page.goto(`${origin.url}/models`);
			expect(await runProbe(page, 'cancel')).toEqual({ kind: 'cancelled' });
		});

		test('WML-P3-ASSET-1: an isolated document can still fetch the remote sample CSV', async ({
			page
		}) => {
			await page.goto(`${origin.url}/models`);
			const received = await page.evaluate(async (url) => {
				const response = await fetch(url, { mode: 'cors' });
				return {
					status: response.status,
					bytes: (await response.arrayBuffer()).byteLength
				};
			}, compas.remoteSource.url);
			expect(received).toEqual({ status: 200, bytes: compas.remoteSource.byteLength });
		});
	});
}

test('WML-P3-ASSET-2: detects non-isolation before importing the library', async ({ page }) => {
	await page.route('**/models', async (route) => {
		const response = await route.fetch();
		const headers = response.headers();
		delete headers['cross-origin-opener-policy'];
		delete headers['cross-origin-embedder-policy'];
		await route.fulfill({ response, headers });
	});
	await page.route('**/web-ml/**', (route) => route.abort());
	await page.goto('/models');
	expect(await page.evaluate(() => window.crossOriginIsolated)).toBe(false);
	expect(await runProbe(page, 'train')).toEqual({ kind: 'not-isolated' });
});
