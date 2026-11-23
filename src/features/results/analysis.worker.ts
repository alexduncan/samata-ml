import { isRopeReply, isRopeRequest, ropeRequestId, type RopeReply } from './analysis-protocol';

declare const WEB_ML_RUNTIME_URL: string;

type ComparisonRuntime = Pick<typeof import('web-ml'), 'bayesianCorrelatedTTest'>;
let runtime: Promise<ComparisonRuntime> | undefined;

self.onmessage = async (event: MessageEvent<unknown>) => {
	const id = ropeRequestId(event.data);
	if (id === null) return;
	const post = (reply: RopeReply) => self.postMessage(reply);
	if (!isRopeRequest(event.data)) {
		post({ id, type: 'rope-error', reason: 'invalid-input' });
		return;
	}
	try {
		runtime ??= import(WEB_ML_RUNTIME_URL);
		const api = await runtime;
		const input = event.data;
		const result = api.bayesianCorrelatedTTest(input.scoresA, input.scoresB, {
			rope: input.rope,
			testFraction: input.testFraction
		});
		const reply: RopeReply = {
			id,
			type: 'rope-result',
			result: {
				probabilityLower: result.probabilityLower,
				probabilityEquivalent: result.probabilityEquivalent,
				probabilityHigher: result.probabilityHigher
			}
		};
		if (!isRopeReply(reply)) throw new Error('Invalid analysis result');
		post(reply);
	} catch {
		runtime = undefined;
		post({ id, type: 'rope-error', reason: 'analysis-failed' });
	}
};
