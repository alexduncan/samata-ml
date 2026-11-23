declare const WEB_ML_RUNTIME_URL: string;

const scope = self as unknown as {
	onmessage:
		| ((
				event: MessageEvent<{
					command: 'train' | 'cancel' | 'one-shot';
					documentIsolated: boolean;
				}>
		  ) => void)
		| null;
	postMessage: (data: object) => void;
	crossOriginIsolated: boolean;
};

async function probe(
	command: 'train' | 'cancel' | 'one-shot',
	documentIsolated: boolean
): Promise<void> {
	if (!documentIsolated || !scope.crossOriginIsolated) {
		scope.postMessage({ kind: 'not-isolated' });
		return;
	}

	const runtime: typeof import('web-ml') = await import(WEB_ML_RUNTIME_URL);
	if (command === 'one-shot') {
		const rows = 40;
		const features = new Float64Array(rows);
		const labels = new Float64Array(rows);
		for (let row = 0; row < rows; row += 1) {
			features[row] = row < rows / 2 ? row - 25 : row - 14;
			labels[row] = row < rows / 2 ? 0 : 1;
		}
		const run = runtime.holdoutValidate({
			algorithm: 'support-vector-classifier',
			data: new runtime.ArrayDatasetProvider(rows, 1, 1, features, labels),
			classLabels: ['left', 'right'],
			options: { kernel: 'linear' },
			testRatio: 0.2,
			randomState: 42,
			returnFit: true,
			evaluation: {
				outputs: true,
				reports: true,
				trainingReports: true,
				baselines: ['most-frequent', 'stratified'],
				positiveLabel: 'right'
			}
		});
		const settlement = Promise.allSettled([run.result, run.trainingMetrics]);
		for await (const event of run.events) void event;
		const [outcome, metrics] = await settlement;
		if (outcome.status === 'rejected') throw outcome.reason;
		if (metrics.status === 'rejected') throw metrics.reason;
		const { evaluation, fit } = outcome.value;
		const summary = {
			kind: 'one-shot' as const,
			hasFit: fit !== undefined,
			partitions: evaluation?.reports?.partitions.length ?? 0,
			trainingReports: evaluation?.trainingReports?.length ?? 0,
			baselines: evaluation?.baselines?.map((baseline) => baseline.strategy) ?? [],
			rows: evaluation?.outputs?.sourceRowIndex.length ?? 0,
			positiveLabel: evaluation?.positiveLabel ?? null
		};
		fit?.model.dispose();
		scope.postMessage(summary);
		return;
	}
	const data = new runtime.ArrayDatasetProvider(
		8,
		1,
		1,
		Float64Array.of(-4, -3, -2, -1, 1, 2, 3, 4),
		Float64Array.of(0, 0, 0, 0, 1, 1, 1, 1)
	);
	const controller = new AbortController();
	const run = runtime.createTrainingClient().train<'support-vector-classifier'>(
		{
			algorithm: 'support-vector-classifier',
			data,
			classLabels: ['left', 'right'],
			options: { kernel: 'linear' }
		},
		{ signal: controller.signal }
	);
	const settlement = Promise.allSettled([run.result, run.trainingMetrics]);
	let cancelled = false;
	for await (const event of run.events) {
		if (command === 'cancel' && event.type === 'phase') controller.abort();
		if (event.type === 'cancelled') cancelled = true;
	}
	const [outcome, metrics] = await settlement;
	if (outcome.status === 'fulfilled') outcome.value.model.dispose();
	if (command === 'cancel' && cancelled && outcome.status === 'rejected') {
		scope.postMessage({ kind: 'cancelled' });
		return;
	}
	if (command === 'train' && outcome.status === 'fulfilled' && metrics.status === 'fulfilled') {
		scope.postMessage({ kind: 'trained', runtimeUrl: WEB_ML_RUNTIME_URL });
		return;
	}
	if (outcome.status === 'rejected') throw outcome.reason;
	if (metrics.status === 'rejected') throw metrics.reason;
	throw new Error(`Unexpected ${command} result`);
}

scope.onmessage = ({ data: { command, documentIsolated } }) => {
	void probe(command, documentIsolated).catch((reason: unknown) => {
		scope.postMessage({ kind: 'failed', detail: String(reason) });
	});
};
