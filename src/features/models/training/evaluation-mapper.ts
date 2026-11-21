import type {
	ClassificationLabel,
	ClassificationPartitionReport,
	ClassifierEvaluationResult,
	MetricValue
} from 'web-ml';
import { partitionFingerprint } from '../../../common/evaluation/partition-fingerprint';
import type {
	StoredClassLabel,
	StoredCurves,
	StoredEvaluation,
	StoredMetric,
	StoredOutputs,
	StoredPartition,
	StoredReport
} from '../../../types/model-evaluation';
import { ClassificationError } from './types';

/** The `web-ml` curve functions that the mapper calls. */
export type CurveRuntime = Pick<
	typeof import('web-ml'),
	| 'rocCurve'
	| 'precisionRecallCurve'
	| 'oneVsRestCurves'
	| 'binaryThresholdSweep'
	| 'calibrationCurve'
>;

/** Per-partition sizes and timing known to the worker rather than to the evaluation record. */
export interface PartitionFacts {
	readonly trainSampleCount: number;
	readonly testSampleCount: number;
	readonly durationMs: number;
}

/** Everything needed to turn one library evaluation into a `StoredEvaluation`. */
export interface EvaluationMappingInput {
	readonly datasetId: string;
	readonly protocol: StoredEvaluation['protocol'];
	/** Original dataset row index of each retained row. */
	readonly sourceRowIndices: readonly number[];
	readonly evaluation: ClassifierEvaluationResult;
	readonly partitions: readonly PartitionFacts[];
}

const BIN_COUNT = 10;
const SWEEP_THRESHOLDS = Float64Array.from({ length: 101 }, (_, index) => index / 100);

function contract(condition: unknown): asserts condition {
	if (!condition) throw new ClassificationError('contract-error');
}

function metric(value: MetricValue<number>): StoredMetric {
	return value.available
		? { available: true, value: value.value }
		: { available: false, reason: value.reason };
}

function toReport(report: ClassificationPartitionReport): StoredReport {
	return {
		sampleCount: report.sampleCount,
		accuracy: report.accuracy,
		balancedAccuracy: report.balancedAccuracy,
		macroF1: report.macroF1,
		mcc: metric(report.matthewsCorrelation),
		rocAuc: metric(report.rocAuc),
		averagePrecision: metric(report.averagePrecision),
		logLoss: metric(report.logLoss),
		brier: metric(report.brierScore),
		precisionPerClass: report.precisionPerClass.slice(),
		recallPerClass: report.recallPerClass.slice(),
		f1PerClass: report.f1PerClass.slice(),
		support: report.support.slice(),
		predictedCount: report.predictedCount.slice(),
		confusionMatrix: report.confusionMatrix.slice()
	};
}

function storedLabel(label: ClassificationLabel): StoredClassLabel {
	contract(typeof label === 'string' || typeof label === 'number' || typeof label === 'boolean');
	return label;
}

function mapOutputs(
	input: EvaluationMappingInput,
	outputs: NonNullable<ClassifierEvaluationResult['outputs']>
): StoredOutputs {
	const rows = outputs.sourceRowIndex.length;
	const { sourceRowIndices } = input;
	const sourceRowIndex = new Uint32Array(rows);
	for (let row = 0; row < rows; row += 1) {
		const original = sourceRowIndices[outputs.sourceRowIndex[row]!];
		contract(original !== undefined);
		sourceRowIndex[row] = original;
	}
	return {
		sourceRowIndex,
		partitionIndex: Uint16Array.from(outputs.partitionIndex),
		trueIndex: Uint16Array.from(outputs.trueIndex),
		predictedIndex: Uint16Array.from(outputs.predictedIndex),
		probabilities: outputs.probabilities ? outputs.probabilities.slice() : null,
		probabilitySource: outputs.probabilities ? outputs.probabilitySource : null,
		positiveScores: outputs.positiveScores ? outputs.positiveScores.slice() : null,
		rankingScoreSource: outputs.positiveScores ? outputs.rankingScoreSource : null
	};
}

function binMeans(values: Float64Array, count: Uint32Array): (number | null)[] {
	return Array.from(values, (value, bin) =>
		count[bin] === 0 || !Number.isFinite(value) ? null : value
	);
}

/** Requests every curve from `web-ml` for the pooled held-out rows; computes nothing itself. */
function mapCurves(
	runtime: CurveRuntime,
	evaluation: ClassifierEvaluationResult,
	outputs: StoredOutputs
): StoredCurves {
	const classLabels = evaluation.classLabels;
	const binary = classLabels.length === 2;
	const positiveLabel = evaluation.positiveLabel ?? undefined;
	const labels = Array.from(outputs.trueIndex, (index) => classLabels[index]!);
	const { probabilities, positiveScores } = outputs;
	const binaryOptions = { classLabels, positiveLabel };

	let positiveColumn: Float64Array | null = null;
	if (binary && probabilities) {
		positiveColumn = new Float64Array(labels.length);
		for (let row = 0; row < labels.length; row += 1)
			positiveColumn[row] = probabilities[row * 2 + 1]!;
	}

	let thresholdSweep: StoredCurves['thresholdSweep'] = null;
	if (positiveColumn) {
		const sweep = runtime.binaryThresholdSweep(
			labels,
			positiveColumn,
			SWEEP_THRESHOLDS,
			binaryOptions
		);
		if (!('available' in sweep)) {
			thresholdSweep = {
				thresholds: sweep.thresholds.slice(),
				tp: sweep.tp.slice(),
				fp: sweep.fp.slice(),
				tn: sweep.tn.slice(),
				fn: sweep.fn.slice(),
				tpr: sweep.tpr.slice(),
				fpr: sweep.fpr.slice()
			};
		}
	}

	let calibration: StoredCurves['calibration'] = null;
	if (probabilities) {
		const result = binary
			? runtime.calibrationCurve(labels, positiveColumn!, {
					...binaryOptions,
					mode: 'binary',
					nBins: BIN_COUNT,
					strategy: 'uniform'
				})
			: runtime.calibrationCurve(labels, probabilities, {
					mode: 'top-label',
					classLabels,
					nBins: BIN_COUNT,
					strategy: 'uniform'
				});
		if (!('available' in result)) {
			calibration = {
				meanPredicted: binMeans(result.meanPredicted, result.count),
				observed: binMeans(result.observed, result.count),
				count: result.count.slice(),
				expectedCalibrationError: result.expectedCalibrationError
			};
		}
	}

	let ranking: StoredCurves['ranking'] = null;
	if (binary && positiveScores) {
		const roc = runtime.rocCurve(labels, positiveScores, binaryOptions);
		const precisionRecall = runtime.precisionRecallCurve(labels, positiveScores, binaryOptions);
		ranking = [
			{
				classIndex: 1,
				roc: 'available' in roc ? null : { fpr: roc.fpr.slice(), tpr: roc.tpr.slice() },
				precisionRecall:
					'available' in precisionRecall
						? null
						: {
								recall: precisionRecall.recall.slice(),
								precision: precisionRecall.precision.slice()
							}
			}
		];
	} else if (!binary && probabilities) {
		ranking = runtime
			.oneVsRestCurves(labels, probabilities, { classLabels })
			.map((entry, index) => ({
				classIndex: index,
				roc:
					'available' in entry.roc
						? null
						: { fpr: entry.roc.fpr.slice(), tpr: entry.roc.tpr.slice() },
				precisionRecall:
					'available' in entry.precisionRecall
						? null
						: {
								recall: entry.precisionRecall.recall.slice(),
								precision: entry.precisionRecall.precision.slice()
							}
			}));
	}
	return { thresholdSweep, calibration, ranking };
}

/**
 * Maps a `web-ml` evaluation into the versioned stored record. Scores, tags, curves and
 * availability reasons are copied verbatim; the mapper only converts index types, retains
 * original row indices and adds the comparability fingerprint.
 */
export async function mapEvaluation(
	runtime: CurveRuntime,
	input: EvaluationMappingInput
): Promise<StoredEvaluation> {
	const { evaluation, protocol, partitions: facts } = input;
	const { outputs, reports, trainingReports, baselines } = evaluation;
	contract(outputs && reports && trainingReports);
	const expected = protocol.kind === 'one_shot' ? 1 : protocol.folds;
	contract(
		facts.length === expected &&
			reports.partitions.length === expected &&
			trainingReports.length === expected
	);
	const mostFrequent = baselines?.find((entry) => entry.strategy === 'most-frequent');
	const stratified = baselines?.find((entry) => entry.strategy === 'stratified');
	contract(
		mostFrequent &&
			stratified &&
			mostFrequent.partitions.length === expected &&
			stratified.partitions.length === expected
	);
	const classLabels = evaluation.classLabels.map(storedLabel);
	contract(classLabels.length >= 2);
	const binary = classLabels.length === 2;
	if (binary) contract(evaluation.positiveLabel === evaluation.classLabels[1]);

	const kind = protocol.kind === 'one_shot' ? 'holdout-test' : 'outer-fold';
	const timing = protocol.kind === 'one_shot' ? 'holdout-fit' : 'fold-fit-and-score';
	const partitions: StoredPartition[] = facts.map((fact, index) => ({
		index,
		kind,
		trainSampleCount: fact.trainSampleCount,
		testSampleCount: fact.testSampleCount,
		durationMs: fact.durationMs,
		timing,
		test: toReport(reports.partitions[index]!),
		train: toReport(trainingReports[index]!),
		baselines: {
			mostFrequent: toReport(mostFrequent.partitions[index]!),
			stratified: toReport(stratified.partitions[index]!)
		}
	}));

	const stored = mapOutputs(input, outputs);
	const curves = mapCurves(runtime, evaluation, stored);
	const fingerprint = await partitionFingerprint({
		datasetId: input.datasetId,
		kind: protocol.kind,
		foldsOrTestRatio: protocol.kind === 'one_shot' ? protocol.testRatio : protocol.folds,
		randomState: protocol.randomState,
		classLabels,
		rows: Array.from(stored.sourceRowIndex, (row, position) => [
			row,
			stored.partitionIndex[position]!
		])
	});
	return {
		schemaVersion: 1,
		protocol,
		classLabels,
		positiveClassIndex: binary ? 1 : null,
		partitionFingerprint: fingerprint,
		partitions,
		pooled: {
			test: toReport(reports.pooled),
			baselines: {
				mostFrequent: toReport(mostFrequent.pooled),
				stratified: toReport(stratified.pooled)
			}
		},
		outputs: stored,
		curves
	};
}

/** Every distinct owned buffer in an evaluation, for a single transfer to the main thread. */
export function evaluationTransferables(evaluation: StoredEvaluation): ArrayBuffer[] {
	const buffers = new Set<ArrayBuffer>();
	const add = (value: unknown): void => {
		if (ArrayBuffer.isView(value) && value.buffer instanceof ArrayBuffer)
			buffers.add(value.buffer);
	};
	const report = (entry: StoredReport): void => {
		for (const array of [
			entry.precisionPerClass,
			entry.recallPerClass,
			entry.f1PerClass,
			entry.support,
			entry.predictedCount,
			entry.confusionMatrix
		])
			add(array);
	};
	for (const partition of evaluation.partitions) {
		report(partition.test);
		report(partition.train);
		report(partition.baselines.mostFrequent);
		report(partition.baselines.stratified);
	}
	report(evaluation.pooled.test);
	report(evaluation.pooled.baselines.mostFrequent);
	report(evaluation.pooled.baselines.stratified);
	const { outputs, curves } = evaluation;
	for (const array of [
		outputs.sourceRowIndex,
		outputs.partitionIndex,
		outputs.trueIndex,
		outputs.predictedIndex,
		outputs.probabilities,
		outputs.positiveScores
	])
		add(array);
	if (curves.thresholdSweep) for (const array of Object.values(curves.thresholdSweep)) add(array);
	add(curves.calibration?.count);
	for (const entry of curves.ranking ?? []) {
		add(entry.roc?.fpr);
		add(entry.roc?.tpr);
		add(entry.precisionRecall?.recall);
		add(entry.precisionRecall?.precision);
	}
	return [...buffers];
}
