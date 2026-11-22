import type {
	MetricUnavailableReason,
	StoredClassLabel,
	StoredCurves,
	StoredEvaluation,
	StoredMetric,
	StoredOutputs,
	StoredPartition,
	StoredReport
} from '../../types/model-evaluation';

const REASONS: ReadonlySet<string> = new Set<MetricUnavailableReason>([
	'not-requested',
	'probabilities-unavailable',
	'unseen-validation-labels',
	'undefined-for-validation-classes',
	'all-targets-zero',
	'negative-targets',
	'not-applicable',
	'insufficient-degrees-of-freedom',
	'single-class'
]);
const PROBABILITY_SOURCES: ReadonlySet<unknown> = new Set([
	'native',
	'leaf-frequency',
	'neighbor-vote',
	'network-output',
	'platt'
]);
const RANKING_SOURCES: ReadonlySet<unknown> = new Set(['probability', 'decision-function']);
const SWEEP_LENGTH = 101;
const CALIBRATION_BINS = 10;
const MAX_CLASSES = 65_535;
/** Rates and probabilities may exceed their bounds by floating-point representation error. */
const TOLERANCE = 1e-6;

/** Thrown internally to abandon decoding; never escapes `decodeStoredEvaluation`. */
class Invalid extends Error {}

function fail(message: string): never {
	throw new Invalid(message);
}

function record(value: unknown, what: string): Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		fail(`${what} must be an object`);
	}
	return value as Record<string, unknown>;
}

function count(value: unknown, what: string): number {
	if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
		fail(`${what} must be a non-negative integer`);
	}
	return value;
}

function finite(value: unknown, what: string, min = -Infinity, max = Infinity): number {
	if (
		typeof value !== 'number' ||
		!Number.isFinite(value) ||
		value < min - TOLERANCE ||
		value > max + TOLERANCE
	) {
		fail(`${what} must be a finite number in range`);
	}
	return value;
}

function typed<T extends Float32Array | Float64Array | Uint16Array | Uint32Array>(
	value: unknown,
	type: new (length: number) => T,
	length: number,
	what: string
): T {
	if (!(value instanceof type) || value.length !== length)
		fail(`${what} has the wrong type or length`);
	return value;
}

function unit(array: Float32Array | Float64Array, what: string): void {
	for (const entry of array)
		if (!Number.isFinite(entry) || entry < -TOLERANCE || entry > 1 + TOLERANCE) fail(what);
}

function metric(value: unknown, what: string, min: number, max: number): StoredMetric {
	const source = record(value, what);
	if (source.available === true) {
		return { available: true, value: finite(source.value, what, min, max) };
	}
	if (
		source.available === false &&
		typeof source.reason === 'string' &&
		REASONS.has(source.reason)
	) {
		return { available: false, reason: source.reason as MetricUnavailableReason };
	}
	return fail(`${what} is not a valid metric`);
}

function sum(array: ArrayLike<number>): number {
	let total = 0;
	for (let i = 0; i < array.length; i += 1) total += array[i]!;
	return total;
}

function report(value: unknown, classCount: number, what: string): StoredReport {
	const source = record(value, what);
	const sampleCount = count(source.sampleCount, `${what}.sampleCount`);
	const confusionMatrix = typed(
		source.confusionMatrix,
		Uint32Array,
		classCount * classCount,
		`${what}.confusionMatrix`
	);
	const support = typed(source.support, Uint32Array, classCount, `${what}.support`);
	const predictedCount = typed(
		source.predictedCount,
		Uint32Array,
		classCount,
		`${what}.predictedCount`
	);
	const precisionPerClass = typed(source.precisionPerClass, Float32Array, classCount, what);
	const recallPerClass = typed(source.recallPerClass, Float32Array, classCount, what);
	const f1PerClass = typed(source.f1PerClass, Float32Array, classCount, what);
	unit(precisionPerClass, `${what}.precisionPerClass`);
	unit(recallPerClass, `${what}.recallPerClass`);
	unit(f1PerClass, `${what}.f1PerClass`);
	if (sum(confusionMatrix) !== sampleCount)
		fail(`${what}.confusionMatrix does not sum to sampleCount`);
	for (let row = 0; row < classCount; row += 1) {
		let rowTotal = 0;
		let columnTotal = 0;
		for (let other = 0; other < classCount; other += 1) {
			rowTotal += confusionMatrix[row * classCount + other]!;
			columnTotal += confusionMatrix[other * classCount + row]!;
		}
		if (rowTotal !== support[row] || columnTotal !== predictedCount[row]) {
			fail(`${what} support or predictedCount disagrees with the confusion matrix`);
		}
	}
	return {
		sampleCount,
		accuracy: finite(source.accuracy, `${what}.accuracy`, 0, 1),
		balancedAccuracy: finite(source.balancedAccuracy, `${what}.balancedAccuracy`, 0, 1),
		macroF1: finite(source.macroF1, `${what}.macroF1`, 0, 1),
		mcc: metric(source.mcc, `${what}.mcc`, -1, 1),
		rocAuc: metric(source.rocAuc, `${what}.rocAuc`, 0, 1),
		averagePrecision: metric(source.averagePrecision, `${what}.averagePrecision`, 0, 1),
		logLoss: metric(source.logLoss, `${what}.logLoss`, 0, Infinity),
		brier: metric(source.brier, `${what}.brier`, 0, 2),
		precisionPerClass,
		recallPerClass,
		f1PerClass,
		support,
		predictedCount,
		confusionMatrix
	};
}

function baselines(value: unknown, classCount: number, samples: number, what: string) {
	const source = record(value, what);
	const mostFrequent = report(source.mostFrequent, classCount, `${what}.mostFrequent`);
	const stratified = report(source.stratified, classCount, `${what}.stratified`);
	if (mostFrequent.sampleCount !== samples || stratified.sampleCount !== samples) {
		fail(`${what} sample counts disagree with the partition`);
	}
	return { mostFrequent, stratified };
}

function labels(value: unknown): readonly StoredClassLabel[] {
	if (!Array.isArray(value) || value.length < 2 || value.length > MAX_CLASSES) {
		fail('classLabels must hold 2 to 65,535 labels');
	}
	const seen = new Set<string>();
	for (const label of value) {
		const valid =
			typeof label === 'string' ||
			typeof label === 'boolean' ||
			(typeof label === 'number' && Number.isFinite(label));
		if (!valid) fail('classLabels holds an invalid label');
		const key = `${typeof label}:${String(label)}`;
		if (seen.has(key)) fail('classLabels holds a duplicate label');
		seen.add(key);
	}
	return Object.freeze([...(value as StoredClassLabel[])]);
}

function protocol(value: unknown): StoredEvaluation['protocol'] {
	const source = record(value, 'protocol');
	const randomState = finite(source.randomState, 'protocol.randomState');
	if (!Number.isInteger(randomState)) fail('protocol.randomState must be an integer');
	if (source.kind === 'one_shot') {
		return {
			kind: 'one_shot',
			testRatio: finite(source.testRatio, 'testRatio', 0, 1),
			randomState
		};
	}
	if (source.kind === 'cross_validation') {
		const folds = count(source.folds, 'protocol.folds');
		if (folds < 2) fail('protocol.folds must be at least 2');
		return { kind: 'cross_validation', folds, randomState };
	}
	return fail('protocol.kind is not recognised');
}

function partitions(
	value: unknown,
	proto: StoredEvaluation['protocol'],
	classCount: number
): readonly StoredPartition[] {
	const expected = proto.kind === 'one_shot' ? 1 : proto.folds;
	if (!Array.isArray(value) || value.length !== expected) fail('partitions has the wrong length');
	return value.map((entry: unknown, index) => {
		const source = record(entry, `partitions[${index}]`);
		const kind = proto.kind === 'one_shot' ? 'holdout-test' : 'outer-fold';
		const timing = proto.kind === 'one_shot' ? 'holdout-fit' : 'fold-fit-and-score';
		if (source.index !== index || source.kind !== kind || source.timing !== timing) {
			fail(`partitions[${index}] is out of order or has the wrong tags`);
		}
		const trainSampleCount = count(source.trainSampleCount, 'trainSampleCount');
		const testSampleCount = count(source.testSampleCount, 'testSampleCount');
		const test = report(source.test, classCount, `partitions[${index}].test`);
		const train = report(source.train, classCount, `partitions[${index}].train`);
		if (test.sampleCount !== testSampleCount || train.sampleCount !== trainSampleCount) {
			fail(`partitions[${index}] report counts disagree with the partition`);
		}
		return {
			index,
			kind,
			trainSampleCount,
			testSampleCount,
			durationMs: finite(source.durationMs, 'durationMs', 0),
			timing,
			test,
			train,
			baselines: baselines(
				source.baselines,
				classCount,
				testSampleCount,
				`partitions[${index}].baselines`
			)
		};
	});
}

function outputs(
	value: unknown,
	classCount: number,
	rowCount: number,
	parts: readonly StoredPartition[]
): StoredOutputs {
	const source = record(value, 'outputs');
	const sourceRowIndex = typed(
		source.sourceRowIndex,
		Uint32Array,
		rowCount,
		'outputs.sourceRowIndex'
	);
	const partitionIndex = typed(
		source.partitionIndex,
		Uint16Array,
		rowCount,
		'outputs.partitionIndex'
	);
	const trueIndex = typed(source.trueIndex, Uint16Array, rowCount, 'outputs.trueIndex');
	const predictedIndex = typed(
		source.predictedIndex,
		Uint16Array,
		rowCount,
		'outputs.predictedIndex'
	);
	const perPartition = new Array<number>(parts.length).fill(0);
	for (let row = 0; row < rowCount; row += 1) {
		if (row > 0 && sourceRowIndex[row]! <= sourceRowIndex[row - 1]!) {
			fail('outputs.sourceRowIndex must be strictly ascending');
		}
		if (partitionIndex[row]! >= parts.length) fail('outputs.partitionIndex is out of range');
		if (trueIndex[row]! >= classCount || predictedIndex[row]! >= classCount) {
			fail('outputs class index is outside the class axis');
		}
		perPartition[partitionIndex[row]!]! += 1;
	}
	parts.forEach((part, index) => {
		if (perPartition[index] !== part.testSampleCount)
			fail('outputs disagree with partition counts');
	});

	const hasProbabilities = source.probabilities !== null;
	if (hasProbabilities !== (source.probabilitySource !== null)) {
		fail('probabilities and probabilitySource must be present together');
	}
	let probabilities: Float64Array | null = null;
	let probabilitySource: StoredOutputs['probabilitySource'] = null;
	if (hasProbabilities) {
		probabilities = typed(
			source.probabilities,
			Float64Array,
			rowCount * classCount,
			'probabilities'
		);
		unit(probabilities, 'outputs.probabilities must be finite values in [0, 1]');
		if (!PROBABILITY_SOURCES.has(source.probabilitySource))
			fail('probabilitySource is invalid');
		probabilitySource = source.probabilitySource as StoredOutputs['probabilitySource'];
	}
	const hasScores = source.positiveScores !== null;
	if (hasScores !== (source.rankingScoreSource !== null)) {
		fail('positiveScores and rankingScoreSource must be present together');
	}
	let positiveScores: Float64Array | null = null;
	let rankingScoreSource: StoredOutputs['rankingScoreSource'] = null;
	if (hasScores) {
		if (classCount !== 2) fail('positiveScores apply to binary evaluations only');
		positiveScores = typed(source.positiveScores, Float64Array, rowCount, 'positiveScores');
		for (const score of positiveScores)
			if (!Number.isFinite(score)) fail('positiveScores must be finite');
		if (!RANKING_SOURCES.has(source.rankingScoreSource)) fail('rankingScoreSource is invalid');
		rankingScoreSource = source.rankingScoreSource as StoredOutputs['rankingScoreSource'];
	}
	return {
		sourceRowIndex,
		partitionIndex,
		trueIndex,
		predictedIndex,
		probabilities,
		probabilitySource,
		positiveScores,
		rankingScoreSource
	};
}

function curves(
	value: unknown,
	classCount: number,
	rowCount: number,
	out: StoredOutputs
): StoredCurves {
	const source = record(value, 'curves');
	let thresholdSweep: StoredCurves['thresholdSweep'] = null;
	if (source.thresholdSweep !== null) {
		if (classCount !== 2 || out.probabilities === null) {
			fail('thresholdSweep requires a binary evaluation with probabilities');
		}
		const sweep = record(source.thresholdSweep, 'thresholdSweep');
		const thresholds = typed(sweep.thresholds, Float64Array, SWEEP_LENGTH, 'thresholds');
		const tp = typed(sweep.tp, Uint32Array, SWEEP_LENGTH, 'tp');
		const fp = typed(sweep.fp, Uint32Array, SWEEP_LENGTH, 'fp');
		const tn = typed(sweep.tn, Uint32Array, SWEEP_LENGTH, 'tn');
		const fn = typed(sweep.fn, Uint32Array, SWEEP_LENGTH, 'fn');
		const tpr = typed(sweep.tpr, Float64Array, SWEEP_LENGTH, 'tpr');
		const fpr = typed(sweep.fpr, Float64Array, SWEEP_LENGTH, 'fpr');
		unit(tpr, 'thresholdSweep.tpr');
		unit(fpr, 'thresholdSweep.fpr');
		for (let i = 0; i < SWEEP_LENGTH; i += 1) {
			if (Math.abs(thresholds[i]! - i / 100) > 1e-9)
				fail('thresholdSweep.thresholds must be 0..1 by 0.01');
			if (tp[i]! + fp[i]! + tn[i]! + fn[i]! !== rowCount)
				fail('thresholdSweep counts must sum to rowCount');
			if (tp[i]! + fn[i]! !== tp[0]! + fn[0]! || fp[i]! + tn[i]! !== fp[0]! + tn[0]!) {
				fail('thresholdSweep class totals must be constant');
			}
			if (i > 0 && (tp[i]! > tp[i - 1]! || fp[i]! > fp[i - 1]!)) {
				fail('thresholdSweep cumulative counts must not increase with the threshold');
			}
		}
		thresholdSweep = { thresholds, tp, fp, tn, fn, tpr, fpr };
	}

	let calibration: StoredCurves['calibration'] = null;
	if (source.calibration !== null) {
		if (out.probabilities === null) fail('calibration requires probabilities');
		const cal = record(source.calibration, 'calibration');
		const bins = typed(cal.count, Uint32Array, CALIBRATION_BINS, 'calibration.count');
		if (sum(bins) !== rowCount) fail('calibration.count must sum to rowCount');
		const series = (entry: unknown, what: string): (number | null)[] => {
			if (!Array.isArray(entry) || entry.length !== CALIBRATION_BINS)
				fail(`${what} must hold ten bins`);
			return entry.map((cell: unknown, bin) => {
				if (bins[bin] === 0) {
					if (cell !== null) fail(`${what} must be null for an empty bin`);
					return null;
				}
				return finite(cell, what, 0, 1);
			});
		};
		calibration = {
			meanPredicted: series(cal.meanPredicted, 'calibration.meanPredicted'),
			observed: series(cal.observed, 'calibration.observed'),
			count: bins,
			expectedCalibrationError: finite(
				cal.expectedCalibrationError,
				'expectedCalibrationError',
				0,
				1
			)
		};
	}

	let ranking: StoredCurves['ranking'] = null;
	if (source.ranking !== null) {
		if (!Array.isArray(source.ranking)) fail('ranking must be an array or null');
		const expected = classCount === 2 ? 1 : classCount;
		if (source.ranking.length !== expected) fail('ranking has the wrong number of entries');
		if (classCount === 2 ? out.positiveScores === null : out.probabilities === null) {
			fail('ranking requires output scores');
		}
		const pair = (entry: unknown, first: string, second: string, what: string) => {
			if (entry === null) return null;
			const curve = record(entry, what);
			const a = curve[first];
			const b = curve[second];
			if (
				!(a instanceof Float64Array) ||
				!(b instanceof Float64Array) ||
				a.length !== b.length
			) {
				fail(`${what} must hold equal-length Float64Array coordinates`);
			}
			unit(a, what);
			unit(b, what);
			return { [first]: a, [second]: b };
		};
		ranking = source.ranking.map((entry: unknown, position) => {
			const item = record(entry, `ranking[${position}]`);
			const classIndex = classCount === 2 ? 1 : position;
			if (item.classIndex !== classIndex) fail('ranking entries must follow the class axis');
			return {
				classIndex,
				roc: pair(item.roc, 'fpr', 'tpr', 'ranking.roc') as {
					fpr: Float64Array;
					tpr: Float64Array;
				} | null,
				precisionRecall: pair(
					item.precisionRecall,
					'recall',
					'precision',
					'ranking.precisionRecall'
				) as {
					recall: Float64Array;
					precision: Float64Array;
				} | null
			};
		});
	}
	return { thresholdSweep, calibration, ranking };
}

/**
 * Validates a stored evaluation read from IndexedDB. Returns null for any malformed, unknown
 * or internally inconsistent value so views never receive corrupt data.
 */
export function decodeStoredEvaluation(value: unknown): StoredEvaluation | null {
	try {
		const source = record(value, 'evaluation');
		if (source.schemaVersion !== 1) return null;
		const proto = protocol(source.protocol);
		const classLabels = labels(source.classLabels);
		const classCount = classLabels.length;
		const positiveClassIndex = classCount === 2 ? 1 : null;
		if (source.positiveClassIndex !== positiveClassIndex) fail('positiveClassIndex is invalid');
		if (
			typeof source.partitionFingerprint !== 'string' ||
			!/^[0-9a-f]{64}$/.test(source.partitionFingerprint)
		) {
			fail('partitionFingerprint must be 64 lowercase hex characters');
		}
		const parts = partitions(source.partitions, proto, classCount);
		const pooledSource = record(source.pooled, 'pooled');
		const rowCount = parts.reduce((total, part) => total + part.testSampleCount, 0);
		const pooledTest = report(pooledSource.test, classCount, 'pooled.test');
		if (pooledTest.sampleCount !== rowCount)
			fail('pooled.test.sampleCount disagrees with partitions');
		const pooledBaselines = baselines(
			pooledSource.baselines,
			classCount,
			rowCount,
			'pooled.baselines'
		);
		const out = outputs(source.outputs, classCount, rowCount, parts);
		return {
			schemaVersion: 1,
			protocol: proto,
			classLabels,
			positiveClassIndex,
			partitionFingerprint: source.partitionFingerprint,
			partitions: parts,
			pooled: { test: pooledTest, baselines: pooledBaselines },
			outputs: out,
			curves: curves(source.curves, classCount, rowCount, out)
		};
	} catch (error) {
		if (error instanceof Invalid) return null;
		throw error;
	}
}
