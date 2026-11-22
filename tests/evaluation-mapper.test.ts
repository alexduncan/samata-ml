import { describe, expect, test } from 'bun:test';
import {
	binaryThresholdSweep,
	calibrationCurve,
	oneVsRestCurves,
	precisionRecallCurve,
	rocCurve,
	type ClassifierEvaluationResult
} from 'web-ml';
import { decodeStoredEvaluation } from '../src/features/results/evaluation-decoder';
import {
	snapshotCrossValidationResult,
	snapshotHoldoutResult
} from '../src/features/models/training/classifier-adapters';
import {
	evaluationTransferables,
	mapEvaluation,
	type EvaluationMappingInput
} from '../src/features/models/training/evaluation-mapper';

const runtime = {
	binaryThresholdSweep,
	calibrationCurve,
	oneVsRestCurves,
	precisionRecallCurve,
	rocCurve
};
const available = (value: number) => ({ available: true as const, value });
const unavailable = (reason: string) => ({ available: false as const, reason });

/** An upstream-shaped partition report written from a confusion matrix. */
function upstreamReport(classCount: number, cells: number[], overrides: object = {}) {
	const support = new Uint32Array(classCount);
	const predictedCount = new Uint32Array(classCount);
	let total = 0;
	let correct = 0;
	for (let row = 0; row < classCount; row += 1) {
		for (let column = 0; column < classCount; column += 1) {
			const cell = cells[row * classCount + column]!;
			support[row]! += cell;
			predictedCount[column]! += cell;
			total += cell;
			if (row === column) correct += cell;
		}
	}
	const recall = Float32Array.from(support, (s, c) => (s ? cells[c * classCount + c]! / s : 0));
	const precision = Float32Array.from(predictedCount, (p, c) =>
		p ? cells[c * classCount + c]! / p : 0
	);
	return {
		task: classCount === 2 ? 'binary' : 'multiclass',
		sampleCount: total,
		accuracy: correct / total,
		balancedAccuracy: recall.reduce((a, b) => a + b, 0) / classCount,
		macroF1: 0.5,
		matthewsCorrelation: available(0.25),
		rocAuc: available(0.75),
		averagePrecision: available(0.8),
		logLoss: available(0.5),
		brierScore: available(0.2),
		precisionPerClass: precision,
		recallPerClass: recall,
		f1PerClass: new Float32Array(classCount).fill(0.5),
		support,
		predictedCount,
		confusionMatrix: Uint32Array.from(cells),
		...overrides
	};
}

interface Scenario {
	labels: (string | number | boolean)[];
	positiveLabel: string | null;
	trueIndex: number[];
	predictedIndex: number[];
	probabilities: number[] | null;
	positiveScores: number[] | null;
	cells: number[];
}

function evaluationFor(scenario: Scenario): ClassifierEvaluationResult {
	const rows = scenario.trueIndex.length;
	const classCount = scenario.labels.length;
	const report = upstreamReport(classCount, scenario.cells);
	const baseline = (strategy: 'most-frequent' | 'stratified') => ({
		strategy,
		partitions: [report],
		pooled: report
	});
	return {
		classLabels: scenario.labels,
		positiveLabel: scenario.positiveLabel,
		outputs: {
			// Retained row indices; the mapper converts them to original dataset rows.
			sourceRowIndex: Uint32Array.from({ length: rows }, (_, row) => row + 1),
			partitionIndex: new Uint32Array(rows),
			trueIndex: Uint32Array.from(scenario.trueIndex),
			predictedIndex: Uint32Array.from(scenario.predictedIndex),
			probabilities: scenario.probabilities
				? Float64Array.from(scenario.probabilities)
				: null,
			probabilitySource: scenario.probabilities ? 'platt' : null,
			positiveScores: scenario.positiveScores
				? Float64Array.from(scenario.positiveScores)
				: null,
			rankingScoreSource: scenario.positiveScores
				? scenario.probabilities
					? 'probability'
					: 'decision-function'
				: null
		},
		reports: { partitions: [report], pooled: report },
		trainingReports: [report],
		baselines: [baseline('most-frequent'), baseline('stratified')]
	} as unknown as ClassifierEvaluationResult;
}

const binary: Scenario = {
	labels: ['Benign', 'Malignant'],
	positiveLabel: 'Malignant',
	trueIndex: [0, 0, 1, 1],
	predictedIndex: [0, 1, 1, 1],
	probabilities: [0.9, 0.1, 0.4, 0.6, 0.3, 0.7, 0.05, 0.95],
	positiveScores: [0.1, 0.6, 0.7, 0.95],
	cells: [1, 1, 0, 2]
};

function input(
	evaluation: ClassifierEvaluationResult,
	overrides: Partial<EvaluationMappingInput> = {}
): EvaluationMappingInput {
	return {
		datasetId: 'fixture',
		protocol: { kind: 'one_shot', testRatio: 0.2, randomState: 42 },
		// Original rows skip 1 and 4: a row dropped for a missing target never reappears.
		sourceRowIndices: [0, 2, 3, 5, 6, 9],
		evaluation,
		partitions: [
			{
				trainSampleCount: 4,
				testSampleCount: evaluation.outputs?.trueIndex.length ?? 4,
				durationMs: 12
			}
		],
		...overrides
	};
}

describe('mapEvaluation', () => {
	test('WML-P4-EVAL-4: preserves scores, tags, axes and original row indices', async () => {
		const stored = await mapEvaluation(runtime, input(evaluationFor(binary)));
		expect(decodeStoredEvaluation(stored)).not.toBeNull();
		expect(stored.classLabels).toEqual(['Benign', 'Malignant']);
		expect(stored.positiveClassIndex).toBe(1);
		expect(stored.partitionFingerprint).toMatch(/^[0-9a-f]{64}$/);
		const test = stored.partitions[0]!.test;
		expect(test.accuracy).toBe(0.75);
		expect(test.brier).toEqual(available(0.2));
		expect(test.mcc).toEqual(available(0.25));
		expect([...test.confusionMatrix]).toEqual([1, 1, 0, 2]);
		expect(stored.partitions[0]).toMatchObject({
			kind: 'holdout-test',
			timing: 'holdout-fit',
			trainSampleCount: 4,
			testSampleCount: 4,
			durationMs: 12
		});
		// Retained rows 1,2,3,4 are original rows 2,3,5,6.
		expect([...stored.outputs.sourceRowIndex]).toEqual([2, 3, 5, 6]);
		expect(stored.outputs.partitionIndex).toBeInstanceOf(Uint16Array);
		expect(stored.outputs.probabilitySource).toBe('platt');
		expect(stored.outputs.rankingScoreSource).toBe('probability');
		expect(stored.curves.thresholdSweep?.thresholds).toHaveLength(101);
		expect(stored.curves.calibration?.count.reduce((a, b) => a + b, 0)).toBe(4);
		expect(stored.curves.ranking).toHaveLength(1);
		expect(stored.curves.ranking![0]!.classIndex).toBe(1);
	});

	test('WML-P4-EVAL-4: keeps every upstream availability reason exactly', async () => {
		const reasons = [
			'not-requested',
			'probabilities-unavailable',
			'unseen-validation-labels',
			'undefined-for-validation-classes',
			'all-targets-zero',
			'negative-targets',
			'not-applicable',
			'insufficient-degrees-of-freedom'
		];
		for (const reason of reasons) {
			const evaluation = evaluationFor(binary);
			const report = upstreamReport(2, binary.cells, {
				logLoss: unavailable(reason),
				rocAuc: unavailable(reason),
				matthewsCorrelation: unavailable(reason)
			});
			(evaluation as unknown as { reports: { pooled: unknown } }).reports.pooled = report;
			const stored = await mapEvaluation(runtime, input(evaluation));
			expect<unknown>(stored.pooled.test.logLoss).toEqual(unavailable(reason));
			expect<unknown>(stored.pooled.test.mcc).toEqual(unavailable(reason));
		}
	});

	test('WML-P4-EVAL-4: empty calibration bins keep zero counts and null means', async () => {
		const stored = await mapEvaluation(runtime, input(evaluationFor(binary)));
		const calibration = stored.curves.calibration!;
		expect([...calibration.count]).toEqual([0, 1, 0, 0, 0, 0, 1, 1, 0, 1]);
		expect(calibration.meanPredicted[2]).toBeNull();
		expect(calibration.observed[0]).toBeNull();
		expect(calibration.meanPredicted[1]).not.toBeNull();
		expect(decodeStoredEvaluation(stored)).not.toBeNull();
	});

	test('WML-P4-EVAL-4: ranking works from a margin without probabilities', async () => {
		const stored = await mapEvaluation(
			runtime,
			input(evaluationFor({ ...binary, probabilities: null }))
		);
		expect(stored.outputs.probabilities).toBeNull();
		expect(stored.outputs.probabilitySource).toBeNull();
		expect(stored.outputs.rankingScoreSource).toBe('decision-function');
		expect(stored.curves.thresholdSweep).toBeNull();
		expect(stored.curves.calibration).toBeNull();
		expect(stored.curves.ranking?.[0]?.roc).not.toBeNull();
		expect(decodeStoredEvaluation(stored)).not.toBeNull();
	});

	test('WML-P4-EVAL-4: ranking is null when no output scores exist', async () => {
		const stored = await mapEvaluation(
			runtime,
			input(evaluationFor({ ...binary, probabilities: null, positiveScores: null }))
		);
		expect(stored.curves.ranking).toBeNull();
		expect(stored.curves.thresholdSweep).toBeNull();
	});

	test('WML-P4-EVAL-4: a single-class sample gives null curves, not a failure', async () => {
		const single = {
			...binary,
			trueIndex: [0, 0, 0, 0],
			cells: [3, 1, 0, 0]
		};
		const stored = await mapEvaluation(runtime, input(evaluationFor(single)));
		expect(stored.curves.thresholdSweep).toBeNull();
		expect(stored.curves.ranking?.[0]).toEqual({
			classIndex: 1,
			roc: null,
			precisionRecall: null
		});
	});

	test('WML-P4-EVAL-4: maps multiclass with top-label calibration and one-vs-rest ranking', async () => {
		const multiclass: Scenario = {
			labels: ['a', 'b', 'c'],
			positiveLabel: null,
			trueIndex: [0, 1, 2, 2],
			predictedIndex: [0, 1, 2, 1],
			probabilities: [0.8, 0.1, 0.1, 0.1, 0.8, 0.1, 0.1, 0.1, 0.8, 0.2, 0.5, 0.3],
			positiveScores: null,
			cells: [1, 0, 0, 0, 1, 0, 0, 1, 1]
		};
		const stored = await mapEvaluation(runtime, input(evaluationFor(multiclass)));
		expect(stored.positiveClassIndex).toBeNull();
		expect(stored.curves.thresholdSweep).toBeNull();
		expect(stored.curves.calibration?.count.reduce((a, b) => a + b, 0)).toBe(4);
		expect(stored.curves.ranking?.map((entry) => entry.classIndex)).toEqual([0, 1, 2]);
		expect(decodeStoredEvaluation(stored)).not.toBeNull();
	});

	test('WML-P4-EVAL-4: maps every cross-validation fold in order', async () => {
		const evaluation = evaluationFor(binary);
		const raw = evaluation as unknown as {
			outputs: { partitionIndex: Uint32Array; sourceRowIndex: Uint32Array };
			reports: { partitions: unknown[] };
			trainingReports: unknown[];
			baselines: { partitions: unknown[] }[];
		};
		const half = upstreamReport(2, [1, 0, 0, 1]);
		raw.outputs.partitionIndex = Uint32Array.of(0, 0, 1, 1);
		raw.reports.partitions = [half, half];
		raw.trainingReports = [half, half];
		for (const baseline of raw.baselines) baseline.partitions = [half, half];
		const stored = await mapEvaluation(
			runtime,
			input(evaluation, {
				protocol: { kind: 'cross_validation', folds: 2, randomState: 42 },
				partitions: [
					{ trainSampleCount: 2, testSampleCount: 2, durationMs: 3 },
					{ trainSampleCount: 2, testSampleCount: 2, durationMs: 4 }
				]
			})
		);
		expect(stored.partitions.map((partition) => [partition.kind, partition.timing])).toEqual([
			['outer-fold', 'fold-fit-and-score'],
			['outer-fold', 'fold-fit-and-score']
		]);
		expect(decodeStoredEvaluation(stored)).not.toBeNull();
	});

	test('WML-P4-EVAL-4: refuses an evaluation that omits requested outputs or baselines', async () => {
		const missingOutputs = evaluationFor(binary) as unknown as { outputs?: unknown };
		delete missingOutputs.outputs;
		await expect(
			mapEvaluation(
				runtime,
				input(missingOutputs as ClassifierEvaluationResult, {
					partitions: [{ trainSampleCount: 2, testSampleCount: 4, durationMs: 1 }]
				})
			)
		).rejects.toThrow('contract-error');
		const missingBaseline = { ...evaluationFor(binary), baselines: [] };
		await expect(mapEvaluation(runtime, input(missingBaseline))).rejects.toThrow(
			'contract-error'
		);
	});

	test('WML-P4-EVAL-4: transfers each owned buffer exactly once', async () => {
		const stored = await mapEvaluation(runtime, input(evaluationFor(binary)));
		const buffers = evaluationTransferables(stored);
		expect(new Set(buffers).size).toBe(buffers.length);
		expect(buffers.length).toBeGreaterThan(10);
		structuredClone(stored, { transfer: buffers });
		expect(stored.outputs.sourceRowIndex.byteLength).toBe(0);
	});
});

describe('snapshots', () => {
	function fit(disposals: { count: number }, failToJson = false) {
		return {
			model: {
				// Deliberately differs from the request axis: the library may sort fitted classes.
				classes_: ['Malignant', 'Benign'],
				toJSON: () => {
					if (failToJson) throw new Error('serialisation failed');
					return { type: 'fixture' };
				},
				dispose: () => {
					disposals.count += 1;
				}
			},
			preprocessor: {
				toJSON: () => ({ version: 1, standardize: false, columns: [] })
			},
			featureNamesOut: ['x'],
			durationMs: 7,
			sampleCount: 2
		};
	}
	const context = {
		datasetId: 'fixture',
		sourceRowIndices: [0, 2, 3, 5, 6, 9],
		classLabels: binary.labels,
		protocol: { kind: 'one_shot', testRatio: 0.2, randomState: 42 } as const
	};
	const holdout = (extra: object) =>
		({
			trainIndices: Uint32Array.of(0, 5),
			validationIndices: Uint32Array.of(1, 2, 3, 4),
			diagnostics: {},
			evaluation: evaluationFor(binary),
			...extra
		}) as never;

	test('WML-P4-EVAL-4: a holdout snapshot disposes the owned model once on success', async () => {
		const disposals = { count: 0 };
		const snapshot = await snapshotHoldoutResult(
			runtime,
			holdout({ fit: fit(disposals) }),
			context
		);
		expect(disposals.count).toBe(1);
		expect(snapshot.evaluation.partitions[0]!.trainSampleCount).toBe(2);
		expect([...snapshot.holdout.testIndices]).toEqual([1, 2, 3, 4]);
		expect(snapshot.modelJson).toEqual({ type: 'fixture' });
		expect(snapshot.classLabels).toEqual(['Benign', 'Malignant']);
	});

	test('WML-P4-EVAL-4: a holdout snapshot disposes once when copying, mapping or validation fails', async () => {
		for (const extra of [
			(d: { count: number }) => ({ fit: fit(d, true) }),
			(d: { count: number }) => ({ fit: fit(d), evaluation: undefined }),
			(d: { count: number }) => ({
				fit: fit(d),
				evaluation: { ...evaluationFor(binary), baselines: [] }
			})
		]) {
			const disposals = { count: 0 };
			await expect(
				snapshotHoldoutResult(runtime, holdout(extra(disposals)), context)
			).rejects.toBeDefined();
			expect(disposals.count).toBe(1);
		}
		await expect(
			snapshotHoldoutResult(runtime, holdout({ fit: undefined }), context)
		).rejects.toThrow('contract-error');
	});

	test('WML-P4-EVAL-4: a cross-validation snapshot requires and disposes the refit model', async () => {
		const disposals = { count: 0 };
		const evaluation = evaluationFor(binary) as unknown as {
			outputs: { partitionIndex: Uint32Array };
			reports: { partitions: unknown[] };
			trainingReports: unknown[];
			baselines: { partitions: unknown[] }[];
		};
		const half = upstreamReport(2, [1, 0, 0, 1]);
		evaluation.outputs.partitionIndex = Uint32Array.of(0, 0, 1, 1);
		evaluation.reports.partitions = [half, half];
		evaluation.trainingReports = [half, half];
		for (const baseline of evaluation.baselines) baseline.partitions = [half, half];
		const folds = [0, 1].map((foldIndex) => ({
			foldIndex,
			score: 1,
			durationMs: 2,
			validationSampleCount: 2,
			validationIndices: Uint32Array.of(1, 2)
		}));
		const result = {
			folds,
			diagnostics: {},
			meanScore: 1,
			standardDeviation: 0,
			evaluation,
			refit: fit(disposals)
		} as never;
		const cvContext = {
			...context,
			protocol: { kind: 'cross_validation', folds: 2, randomState: 42 } as const
		};
		const snapshot = await snapshotCrossValidationResult(runtime, result, cvContext);
		expect(disposals.count).toBe(1);
		expect(snapshot.evaluation.partitions).toHaveLength(2);
		await expect(
			snapshotCrossValidationResult(runtime, { refit: undefined } as never, cvContext)
		).rejects.toThrow('contract-error');
	});

	test('WML-P4-EVAL-4: rejects an upstream class axis that differs from the request axis', async () => {
		const axes = [
			[...binary.labels].reverse(),
			binary.labels.map((label) => String(label) + '!'),
			[binary.labels[0]!]
		];
		const cvEvaluation = evaluationFor(binary);
		for (const axis of axes) {
			const disposals = { count: 0 };
			await expect(
				snapshotHoldoutResult(
					runtime,
					holdout({
						fit: fit(disposals),
						evaluation: { ...evaluationFor(binary), classLabels: axis }
					}),
					context
				)
			).rejects.toThrow('contract-error');
			expect(disposals.count).toBe(1);

			const cvDisposals = { count: 0 };
			await expect(
				snapshotCrossValidationResult(
					runtime,
					{
						folds: [],
						refit: fit(cvDisposals),
						evaluation: { ...cvEvaluation, classLabels: axis }
					} as never,
					{
						...context,
						protocol: { kind: 'cross_validation', folds: 2, randomState: 42 } as const
					}
				)
			).rejects.toThrow('contract-error');
			expect(cvDisposals.count).toBe(1);
		}
		// A numeric axis against a string request axis (and the reverse) is a type change.
		const disposals = { count: 0 };
		await expect(
			snapshotHoldoutResult(
				runtime,
				holdout({
					fit: fit(disposals),
					evaluation: { ...evaluationFor(binary), classLabels: [0, 1] }
				}),
				{ ...context, classLabels: ['0', '1'] }
			)
		).rejects.toThrow('contract-error');
		expect(disposals.count).toBe(1);
	});
});
