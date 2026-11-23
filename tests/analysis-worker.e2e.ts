import { expect, test } from '@playwright/test';
import { isRopeReply } from '../src/features/results/analysis-protocol';

test('WML-P5-ROPE-1: real worker matches the pinned runtime and rejects invalid requests', async ({
	page
}) => {
	await page.goto('/models');
	const result = await page.evaluate(async () => {
		const source = await (await fetch('/analysis.worker.js')).text();
		const runtimeUrl = source.match(/\/web-ml\/0\.2\.0-[0-9a-f]{64}\/index\.js/)?.[0];
		if (!runtimeUrl) throw new Error('Missing versioned runtime URL');
		const runtime = await import(/* @vite-ignore */ runtimeUrl);
		const worker = new Worker('/analysis.worker.js', { type: 'module' });
		const call = (message: unknown) =>
			new Promise<unknown>((resolve, reject) => {
				worker.onmessage = (event) => resolve(event.data);
				worker.onerror = () => reject(new Error('Worker failed'));
				worker.postMessage(message);
			});
		const scoresA = [0.73, 0.81, 0.78, 0.89, 0.84];
		const scoresB = [0.69, 0.8, 0.76, 0.82, 0.8];
		const input = { id: 1, type: 'rope', scoresA, scoresB, rope: 0.01, testFraction: 1 / 5 };
		const forward = await call(input);
		const reverse = await call({ ...input, id: 2, scoresA: scoresB, scoresB: scoresA });
		const invalid = await call({ ...input, id: 3, scoresB: [NaN] });
		worker.terminate();
		return {
			forward,
			reverse,
			invalid,
			expected: runtime.bayesianCorrelatedTTest(scoresA, scoresB, {
				rope: 0.01,
				testFraction: 1 / 5
			})
		};
	});
	if (!isRopeReply(result.forward) || result.forward.type !== 'rope-result')
		throw new Error('Expected a forward ROPE result');
	if (!isRopeReply(result.reverse) || result.reverse.type !== 'rope-result')
		throw new Error('Expected a reverse ROPE result');
	if (!isRopeReply(result.invalid)) throw new Error('Expected a ROPE reply');
	expect(result.forward.type).toBe('rope-result');
	for (const key of ['probabilityLower', 'probabilityEquivalent', 'probabilityHigher'] as const) {
		expect(result.forward.result[key]).toBeCloseTo(result.expected[key], 12);
	}
	expect(
		Object.values(result.forward.result).reduce((a: number, b) => a + Number(b), 0)
	).toBeCloseTo(1, 9);
	expect(result.reverse.result.probabilityLower).toBeCloseTo(
		result.forward.result.probabilityHigher,
		12
	);
	expect(result.reverse.result.probabilityHigher).toBeCloseTo(
		result.forward.result.probabilityLower,
		12
	);
	expect(result.invalid).toEqual({ id: 3, type: 'rope-error', reason: 'invalid-input' });
});
