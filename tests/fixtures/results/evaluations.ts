import type {
	StoredCurves,
	StoredEvaluation,
	StoredMetric,
	StoredOutputs,
	StoredPartition,
	StoredReport
} from '../../../src/types/model-evaluation';

/*
 * Hand-written evaluation fixtures. Each report is written as a confusion matrix; the per-class
 * columns are the plain row and column ratios of that matrix, so a reader can verify them by
 * eye. They are test data standing in for values reported by web-ml, not application code.
 */

const available = (value: number): StoredMetric => ({ available: true, value });
const unavailable = (reason: 'probabilities-unavailable' | 'not-applicable'): StoredMetric => ({
	available: false,
	reason
});

interface ReportExtras {
	mcc?: StoredMetric;
	rocAuc?: StoredMetric;
	averagePrecision?: StoredMetric;
	logLoss?: StoredMetric;
	brier?: StoredMetric;
}

/** Builds a report from a row-major confusion matrix (rows = true class). */
export function reportFromConfusion(
	classCount: number,
	cells: readonly number[],
	extras: ReportExtras = {}
): StoredReport {
	const support = new Uint32Array(classCount);
	const predictedCount = new Uint32Array(classCount);
	const confusionMatrix = Uint32Array.from(cells);
	for (let row = 0; row < classCount; row += 1) {
		for (let column = 0; column < classCount; column += 1) {
			support[row]! += cells[row * classCount + column]!;
			predictedCount[column]! += cells[row * classCount + column]!;
		}
	}
	const precisionPerClass = new Float32Array(classCount);
	const recallPerClass = new Float32Array(classCount);
	const f1PerClass = new Float32Array(classCount);
	let correct = 0;
	let total = 0;
	for (let c = 0; c < classCount; c += 1) {
		const hit = cells[c * classCount + c]!;
		correct += hit;
		total += support[c]!;
		precisionPerClass[c] = predictedCount[c] ? hit / predictedCount[c]! : 0;
		recallPerClass[c] = support[c] ? hit / support[c]! : 0;
		const denominator = precisionPerClass[c]! + recallPerClass[c]!;
		f1PerClass[c] = denominator
			? (2 * precisionPerClass[c]! * recallPerClass[c]!) / denominator
			: 0;
	}
	const mean = (values: Float32Array) => values.reduce((a, b) => a + b, 0) / classCount;
	return {
		sampleCount: total,
		accuracy: correct / total,
		balancedAccuracy: mean(recallPerClass),
		macroF1: mean(f1PerClass),
		mcc: extras.mcc ?? available(0.8),
		rocAuc: extras.rocAuc ?? available(0.97),
		averagePrecision: extras.averagePrecision ?? available(0.95),
		logLoss: extras.logLoss ?? available(0.2),
		brier: extras.brier ?? available(0.07),
		precisionPerClass,
		recallPerClass,
		f1PerClass,
		support,
		predictedCount,
		confusionMatrix
	};
}

function addCells(parts: readonly (readonly number[])[]): number[] {
	return parts[0]!.map((_, index) => parts.reduce((total, part) => total + part[index]!, 0));
}

function partition(
	index: number,
	kind: StoredPartition['kind'],
	classCount: number,
	testCells: readonly number[],
	trainCells: readonly number[],
	mostFrequentCells: readonly number[],
	stratifiedCells: readonly number[],
	extras: ReportExtras
): StoredPartition {
	const test = reportFromConfusion(classCount, testCells, extras);
	const train = reportFromConfusion(classCount, trainCells, extras);
	return {
		index,
		kind,
		trainSampleCount: train.sampleCount,
		testSampleCount: test.sampleCount,
		durationMs: 120 + index * 10,
		timing: kind === 'holdout-test' ? 'holdout-fit' : 'fold-fit-and-score',
		test,
		train,
		baselines: {
			mostFrequent: reportFromConfusion(classCount, mostFrequentCells, {
				mcc: available(0),
				rocAuc: available(0.5),
				averagePrecision: available(0.4),
				logLoss: available(0.7),
				brier: available(0.25)
			}),
			stratified: reportFromConfusion(classCount, stratifiedCells, {
				mcc: available(0),
				rocAuc: available(0.5),
				averagePrecision: available(0.4),
				logLoss: available(0.7),
				brier: available(0.25)
			})
		}
	};
}

const FINGERPRINT = 'a'.repeat(64);

function sequence<T = number>(length: number, map: (index: number) => T): T[] {
	return Array.from({ length }, (_, index) => map(index));
}

function outputsFor(
	rows: number,
	classCount: number,
	partitions: number,
	trueOf: (row: number) => number,
	mode: 'probabilities' | 'scores-only' | 'none'
): StoredOutputs {
	const trueIndex = Uint16Array.from(sequence(rows, trueOf));
	const probabilities =
		mode === 'probabilities'
			? Float64Array.from(
					sequence(rows * classCount, (cell) => {
						const row = Math.floor(cell / classCount);
						const column = cell % classCount;
						const rest = classCount === 1 ? 0 : 0.2 / (classCount - 1);
						return column === trueIndex[row]! ? 0.8 : rest;
					})
				)
			: null;
	const positiveScores =
		classCount === 2 && mode !== 'none'
			? Float64Array.from(sequence(rows, (row) => (trueIndex[row] === 1 ? 0.8 : 0.2)))
			: null;
	return {
		sourceRowIndex: Uint32Array.from(sequence(rows, (row) => row)),
		partitionIndex: Uint16Array.from(sequence(rows, (row) => row % partitions)),
		trueIndex,
		predictedIndex: Uint16Array.from(trueIndex),
		probabilities,
		probabilitySource: probabilities ? 'native' : null,
		positiveScores,
		rankingScoreSource: positiveScores
			? probabilities
				? 'probability'
				: 'decision-function'
			: null
	};
}

const ranking = (classIndex: number) => ({
	classIndex,
	roc: { fpr: Float64Array.of(0, 0.05, 1), tpr: Float64Array.of(0, 0.9, 1) },
	precisionRecall: {
		recall: Float64Array.of(0, 0.9, 1),
		precision: Float64Array.of(1, 0.95, 0.4)
	}
});

function sweepFor(
	positives: number,
	negatives: number
): NonNullable<StoredCurves['thresholdSweep']> {
	const indices = sequence(101, (index) => index);
	const tp = Uint32Array.from(indices.map((i) => positives - Math.floor((positives * i) / 100)));
	const fp = Uint32Array.from(indices.map((i) => negatives - Math.floor((negatives * i) / 100)));
	return {
		thresholds: Float64Array.from(indices.map((i) => i / 100)),
		tp,
		fp,
		fn: Uint32Array.from(indices.map((i) => positives - tp[i]!)),
		tn: Uint32Array.from(indices.map((i) => negatives - fp[i]!)),
		tpr: Float64Array.from(indices.map((i) => tp[i]! / positives)),
		fpr: Float64Array.from(indices.map((i) => fp[i]! / negatives))
	};
}

const mean = (value: number) => value;

/** Iris, five-fold cross-validation, K = 3, probabilities available. */
export function irisCrossValidation(): StoredEvaluation {
	const foldCells = [
		[10, 0, 0, 0, 9, 1, 0, 0, 10],
		[10, 0, 0, 0, 10, 0, 0, 1, 9],
		[10, 0, 0, 0, 10, 0, 0, 0, 10],
		[10, 0, 0, 0, 8, 2, 0, 1, 9],
		[10, 0, 0, 0, 9, 1, 0, 0, 10]
	];
	const train = [40, 0, 0, 0, 39, 1, 0, 0, 40];
	const mostFrequent = [10, 0, 0, 10, 0, 0, 10, 0, 0];
	const stratified = [4, 3, 3, 3, 4, 3, 3, 3, 4];
	const partitions = foldCells.map((cells, index) =>
		partition(index, 'outer-fold', 3, cells, train, mostFrequent, stratified, {})
	);
	const outputs = outputsFor(150, 3, 5, (row) => Math.floor(row / 50), 'probabilities');
	return {
		schemaVersion: 1,
		protocol: { kind: 'cross_validation', folds: 5, randomState: 42 },
		classLabels: ['setosa', 'versicolor', 'virginica'],
		positiveClassIndex: null,
		partitionFingerprint: FINGERPRINT,
		partitions,
		pooled: {
			test: reportFromConfusion(3, addCells(foldCells)),
			baselines: {
				mostFrequent: reportFromConfusion(3, addCells(partitions.map(() => mostFrequent))),
				stratified: reportFromConfusion(3, addCells(partitions.map(() => stratified)))
			}
		},
		outputs,
		curves: {
			thresholdSweep: null,
			calibration: {
				meanPredicted: [null, null, null, null, null, null, mean(0.65), 0.75, 0.85, 0.96],
				observed: [null, null, null, null, null, null, 0.6, 0.8, 0.9, 0.99],
				count: Uint32Array.of(0, 0, 0, 0, 0, 0, 10, 20, 40, 80),
				expectedCalibrationError: 0.03
			},
			ranking: [ranking(0), ranking(1), ranking(2)]
		}
	};
}

function binaryBase(withProbabilities: boolean): StoredEvaluation {
	const extras: ReportExtras = withProbabilities
		? {}
		: {
				logLoss: unavailable('probabilities-unavailable'),
				brier: unavailable('probabilities-unavailable')
			};
	const test = [68, 3, 4, 39];
	const part = partition(
		0,
		'holdout-test',
		2,
		test,
		[280, 5, 8, 162],
		[71, 0, 43, 0],
		[44, 27, 27, 16],
		extras
	);
	const outputs = outputsFor(
		114,
		2,
		1,
		(row) => (row < 71 ? 0 : 1),
		withProbabilities ? 'probabilities' : 'scores-only'
	);
	return {
		schemaVersion: 1,
		protocol: { kind: 'one_shot', testRatio: 0.2, randomState: 42 },
		classLabels: ['Benign', 'Malignant'],
		positiveClassIndex: 1,
		partitionFingerprint: FINGERPRINT,
		partitions: [part],
		pooled: { test: part.test, baselines: part.baselines },
		outputs,
		curves: {
			thresholdSweep: withProbabilities ? sweepFor(43, 71) : null,
			calibration: withProbabilities
				? {
						meanPredicted: [0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95],
						observed: [0.02, 0.1, 0.2, 0.33, 0.4, 0.6, 0.7, 0.8, 0.9, 0.97],
						count: Uint32Array.of(40, 10, 5, 3, 2, 2, 3, 5, 10, 34),
						expectedCalibrationError: 0.04
					}
				: null,
			ranking: [ranking(1)]
		}
	};
}

/** Breast-cancer Wisconsin One-Shot, binary, probabilities, sweep and calibration. */
export function breastCancerOneShot(): StoredEvaluation {
	return binaryBase(true);
}

/** Binary SVC without probability estimates: probability metrics unavailable, curves null. */
export function svcBinaryNoProbabilities(): StoredEvaluation {
	return binaryBase(false);
}

/** Twenty-five classes, One-Shot, no probabilities. */
export function manyClasses(): StoredEvaluation {
	const classCount = 25;
	const diagonal = (value: number) =>
		sequence(classCount * classCount, (cell) =>
			Math.floor(cell / classCount) === cell % classCount ? value : 0
		);
	const column = (target: (row: number) => number) =>
		sequence(classCount * classCount, (cell) =>
			cell % classCount === target(Math.floor(cell / classCount)) ? 10 : 0
		);
	const extras: ReportExtras = {
		rocAuc: unavailable('probabilities-unavailable'),
		averagePrecision: unavailable('probabilities-unavailable'),
		logLoss: unavailable('probabilities-unavailable'),
		brier: unavailable('probabilities-unavailable')
	};
	const part = partition(
		0,
		'holdout-test',
		classCount,
		diagonal(10),
		diagonal(40),
		column(() => 0),
		column((row) => (row + 1) % classCount),
		extras
	);
	return {
		schemaVersion: 1,
		protocol: { kind: 'one_shot', testRatio: 0.2, randomState: 42 },
		classLabels: sequence(classCount, (index) => `Class ${index + 1}`),
		positiveClassIndex: null,
		partitionFingerprint: FINGERPRINT,
		partitions: [part],
		pooled: { test: part.test, baselines: part.baselines },
		outputs: outputsFor(250, classCount, 1, (row) => Math.floor(row / 10), 'none'),
		curves: { thresholdSweep: null, calibration: null, ranking: null }
	};
}
