import { describe, expect, it } from 'bun:test';
import {
	buildBinaryFlowView,
	buildCalibrationView,
	buildThresholdView,
	buildClasseeView,
	buildClassMetricsRows,
	buildConfusionMatrixView,
	buildFoldStripView,
	buildSummaryView,
	createResultsFormatters,
	shownClassIndices,
	trainTestGap
} from '../src/features/results/results-view-model';
import type { StoredEvaluation } from '../src/types/model-evaluation';
import {
	breastCancerOneShot,
	irisCrossValidation,
	manyClasses,
	svcBinaryNoProbabilities
} from './fixtures/results/evaluations';
import { withEmptyCalibrationBin, withPooledConfusion } from './fixtures/results/variants';

const format = createResultsFormatters({
	number: (value, options) => new Intl.NumberFormat('en-GB', options).format(value)
});
const names = { modelName: 'Model', datasetName: 'Data', target: 'Target' };

function withGap(evaluation: StoredEvaluation, gap: number): StoredEvaluation {
	return {
		...evaluation,
		partitions: evaluation.partitions.map((part) => ({
			...part,
			train: { ...part.train, balancedAccuracy: part.test.balancedAccuracy + gap }
		}))
	};
}

describe('Results summary view model', () => {
	it('WML-P4-UI-1: cross-validation headline is the fold mean with SD and IQR', () => {
		const evaluation = irisCrossValidation();
		const view = buildSummaryView(evaluation, names, format);
		const scores = evaluation.partitions.map((part) => part.test.balancedAccuracy);
		const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
		expect(view.protocol).toBe('cross_validation');
		expect(view.partitions).toBe(5);
		expect(view.balancedAccuracy).toBe(format.percent(mean));
		expect(view.spread).not.toBeNull();
		expect(view.spread!.sd).toMatch(/^\d/);
		expect(view.macroF1).not.toBeNull();
		expect(view.more.map((row) => row.id)).not.toContain('macroF1');
	});

	it('WML-P4-UI-1: One-Shot shows one value and no spread; macro-F1 moves to More metrics', () => {
		const view = buildSummaryView(breastCancerOneShot(), names, format);
		expect(view.protocol).toBe('one_shot');
		expect(view.partitions).toBe(1);
		expect(view.spread).toBeNull();
		expect(view.macroF1).toBeNull();
		expect(view.more[0]!.id).toBe('macroF1');
	});

	it('WML-P4-UI-1: accuracy reports the most-frequent baseline and a signed delta', () => {
		const view = buildSummaryView(breastCancerOneShot(), names, format);
		// 107 of 114 correct against 71 of 114 for always predicting Benign.
		expect(view.accuracy).toBe(format.percent(107 / 114));
		expect(view.baselineAccuracy).toBe(format.percent(71 / 114));
		expect(view.accuracyDelta).toBe(format.signedPoints(107 / 114 - 71 / 114));
		expect(view.accuracyDelta.startsWith('+')).toBe(true);
		expect(view.accuracyDirection).toBe('above');
	});

	it('WML-P4-UI-1: the gap card appears at a ten-point gap and not at 0.099', () => {
		const base = breastCancerOneShot();
		expect(buildSummaryView(withGap(base, 0.1), names, format).gap).not.toBeNull();
		expect(buildSummaryView(withGap(base, 0.099), names, format).gap).toBeNull();
		expect(buildSummaryView(withGap(base, 0.2), names, format).gap?.points).toBe(
			format.points(0.2)
		);
		expect(trainTestGap(withGap(base, 0.1)).gap).toBeCloseTo(0.1, 12);
	});

	it('WML-P4-UI-4: unavailable metrics carry a reason and no value', () => {
		const view = buildSummaryView(svcBinaryNoProbabilities(), names, format);
		const logLoss = view.more.find((row) => row.id === 'logLoss')!;
		expect(logLoss.value).toBeNull();
		expect(logLoss.reason).toBe('probabilities-unavailable');
		const ece = view.more.find((row) => row.id === 'ece')!;
		expect(ece.value).toBeNull();
		expect(ece.reason).toBe('probabilities-unavailable');
	});

	it('WML-P4-UI-4: no fixture produces NaN, undefined or empty text', () => {
		for (const evaluation of [
			irisCrossValidation(),
			breastCancerOneShot(),
			svcBinaryNoProbabilities(),
			manyClasses()
		]) {
			const text = JSON.stringify([
				buildSummaryView(evaluation, names, format),
				buildFoldStripView(
					evaluation,
					{ series: 'Model', mostFrequent: 'A', stratified: 'B' },
					format
				),
				buildClassMetricsRows(evaluation, format),
				buildConfusionMatrixView(evaluation, null, format)
			]);
			expect(text).not.toContain('NaN');
			expect(text).not.toContain('undefined');
			expect(text).not.toContain('""');
		}
	});

	it('summarises time per protocol', () => {
		// Fixture fold durations are 120, 130, 140, 150 and 160 ms.
		expect(buildSummaryView(irisCrossValidation(), names, format).time).toBe(
			format.seconds(700)
		);
		expect(buildSummaryView(breastCancerOneShot(), names, format).time).toBe(
			format.seconds(120)
		);
	});
});

describe('Fold strip view model', () => {
	it('WML-P4-UI-2: one value per partition, mean, SD and mean baseline anchors', () => {
		const evaluation = irisCrossValidation();
		const view = buildFoldStripView(
			evaluation,
			{ series: 'Model', mostFrequent: 'Most frequent', stratified: 'Stratified' },
			format
		);
		expect(view.series).toHaveLength(1);
		expect(view.series[0]!.values).toHaveLength(5);
		expect(view.series[0]!.sd).not.toBeNull();
		expect(view.baselines.map((mark) => mark.id)).toEqual(['most-frequent', 'stratified']);
		// Always predicting one class of three is one third balanced accuracy.
		expect(view.baselines[0]!.value).toBeCloseTo(1 / 3, 6);
	});

	it('WML-P4-UI-2: a single test split has no SD', () => {
		const view = buildFoldStripView(
			breastCancerOneShot(),
			{ series: 'Model', mostFrequent: 'A', stratified: 'B' },
			format
		);
		expect(view.series[0]!.values).toHaveLength(1);
		expect(view.series[0]!.sd).toBeNull();
	});
});

describe('Confusion matrix view model', () => {
	it('WML-P4-UI-3: at most twenty classes show every row without a filter', () => {
		const view = buildConfusionMatrixView(irisCrossValidation(), null, format);
		expect(view.filterable).toBe(false);
		expect(view.rows).toHaveLength(3);
		expect(view.scope).toBe('held-out');
		expect(buildConfusionMatrixView(breastCancerOneShot(), null, format).scope).toBe('test');
	});

	it('WML-P4-UI-3: with twenty-five classes the default is twenty rows in axis order', () => {
		const view = buildConfusionMatrixView(manyClasses(), null, format);
		expect(view.filterable).toBe(true);
		expect(view.rows).toHaveLength(20);
		expect(view.columns).toHaveLength(25);
		expect(view.options).toHaveLength(25);
		const indices = view.rows.map((row) => row.index);
		expect(indices).toEqual([...indices].sort((a, b) => a - b));
		expect(view.selected).toBeNull();
	});

	it('WML-P4-UI-3: the default keeps the largest supports, ties broken by class index', () => {
		const evaluation = manyClasses();
		const support = Uint32Array.from(evaluation.pooled.test.support);
		support[24] = 99;
		support[3] = 0;
		const adjusted: StoredEvaluation = {
			...evaluation,
			pooled: { ...evaluation.pooled, test: { ...evaluation.pooled.test, support } }
		};
		const shown = shownClassIndices(adjusted, null);
		expect(shown).toContain(24);
		expect(shown).not.toContain(3);
		// Four zero or low classes drop out: the twenty largest include the first tied indices.
		expect(shown).toHaveLength(20);
		expect(shown.slice(0, 3)).toEqual([0, 1, 2]);
	});

	it('WML-P4-UI-3: choosing a class shows that one row; an invalid choice falls back', () => {
		const view = buildConfusionMatrixView(manyClasses(), 7, format);
		expect(view.rows.map((row) => row.index)).toEqual([7]);
		expect(view.selected).toBe(7);
		expect(shownClassIndices(manyClasses(), 99)).toHaveLength(20);
		expect(shownClassIndices(irisCrossValidation(), 1)).toHaveLength(3);
	});

	it('flags the diagonal as correct', () => {
		const view = buildConfusionMatrixView(breastCancerOneShot(), null, format);
		expect(view.rows[0]!.cells.map((cell) => cell.correct)).toEqual([true, false]);
		expect(view.rows[1]!.cells.map((cell) => cell.correct)).toEqual([false, true]);
		expect(view.rows[0]!.cells[0]!.count).toBe(68);
	});
});

describe('Class metrics rows', () => {
	it('lists every class with pooled support and percentages', () => {
		const rows = buildClassMetricsRows(irisCrossValidation(), format);
		expect(rows.map((row) => row.label)).toEqual(['setosa', 'versicolor', 'virginica']);
		expect(rows[0]!.recall).toBe(format.percent(1));
	});
});

describe('Binary flow view model', () => {
	it('WML-P4-UI-5: two actual-class rows carry the pooled confusion counts and shares', () => {
		const flow = buildBinaryFlowView(breastCancerOneShot(), 'diagnosis', format)!;
		expect(flow.rows.map((row) => row.actual)).toEqual(['Benign', 'Malignant']);
		expect(flow.rows.map((row) => row.outcomes.map((outcome) => outcome.count))).toEqual([
			[68, 3],
			[4, 39]
		]);
		expect(flow.rows[0]!.outcomes[0]!.share).toBeCloseTo(68 / 71, 12);
		expect(flow.rows[1]!.outcomes.map((outcome) => outcome.correct)).toEqual([false, true]);
		expect(flow.rows[0]!.totalText).toBe('71');
	});

	it('WML-P4-UI-5: a perfect model has zero-count outcomes with zero share', () => {
		const flow = buildBinaryFlowView(
			withPooledConfusion(breastCancerOneShot(), [71, 0, 0, 43]),
			'diagnosis',
			format
		)!;
		expect(flow.rows[0]!.outcomes[1]!.count).toBe(0);
		expect(flow.rows[0]!.outcomes[1]!.share).toBe(0);
	});

	it('is null for more than two classes', () => {
		expect(buildBinaryFlowView(irisCrossValidation(), 'species', format)).toBeNull();
	});
});

describe('Classee view model', () => {
	it('WML-P4-UI-6: three rows with the correct run and stacked non-zero errors', () => {
		const view = buildClasseeView(irisCrossValidation(), null, format)!;
		expect(view.legendClasses.map((item) => item.classIndex)).toEqual([2, 1]);
		expect(view.rows.map((row) => row.label)).toEqual(['setosa', 'versicolor', 'virginica']);
		expect(view.rows.map((row) => row.correct.count)).toEqual([50, 46, 48]);
		expect(view.rows[0]!.errors).toEqual([]);
		expect(view.rows[1]!.errors.map((segment) => [segment.predicted, segment.count])).toEqual([
			['virginica', 4]
		]);
		expect(view.rows[2]!.errors.map((segment) => [segment.predicted, segment.count])).toEqual([
			['versicolor', 2]
		]);
		expect(view.maxErrors).toBe(4);
		expect(view.maxCorrect).toBe(50);
		expect(view.totalErrors).toBe(6);
	});

	it('WML-P4-UI-6: zero errors give a zero total', () => {
		const view = buildClasseeView(
			withPooledConfusion(irisCrossValidation(), [50, 0, 0, 0, 50, 0, 0, 0, 50]),
			null,
			format
		)!;
		expect(view.totalErrors).toBe(0);
		expect(view.maxErrors).toBe(0);
		expect(view.rows.every((row) => row.errors.length === 0)).toBe(true);
	});

	it('applies the many-class selection and is null for binary targets', () => {
		expect(buildClasseeView(manyClasses(), null, format)!.rows).toHaveLength(20);
		expect(
			buildClasseeView(manyClasses(), 9, format)!.rows.map((row) => row.classIndex)
		).toEqual([9]);
		expect(buildClasseeView(breastCancerOneShot(), null, format)).toBeNull();
	});
});

describe('Threshold view model', () => {
	it('WML-P4-UI-7: readouts and histogram bins are the stored sweep counts', () => {
		const evaluation = breastCancerOneShot();
		const sweep = evaluation.curves.thresholdSweep!;
		const view = buildThresholdView(evaluation, 'diagnosis')!;
		expect(view.positive).toBe('Malignant');
		expect(view.negative).toBe('Benign');
		expect(view.readouts).toHaveLength(101);
		expect(view.readouts[50]).toEqual({
			threshold: 0.5,
			tp: sweep.tp[50]!,
			fp: sweep.fp[50]!,
			tn: sweep.tn[50]!,
			fn: sweep.fn[50]!,
			tpr: sweep.tpr[50]!,
			fpr: sweep.fpr[50]!
		});
		expect(view.bins).toHaveLength(20);
		expect(view.bins[0]).toMatchObject({ lower: 0, upper: 0.05 });
		expect(view.bins[0]!.positive).toBe(sweep.tp[0]! - sweep.tp[5]!);
		expect(view.bins[0]!.negative).toBe(sweep.fp[0]! - sweep.fp[5]!);
		// The last bin includes probability 1, so it is the cumulative count at 0.95.
		expect(view.bins[19]).toMatchObject({ lower: 0.95, upper: 1 });
		expect(view.bins[19]!.positive).toBe(sweep.tp[95]!);
		expect(view.bins[19]!.negative).toBe(sweep.fp[95]!);
		// Every row lands in exactly one bin.
		expect(view.bins.reduce((total, bin) => total + bin.positive, 0)).toBe(sweep.tp[0]!);
		expect(view.bins.reduce((total, bin) => total + bin.negative, 0)).toBe(sweep.fp[0]!);
	});

	it('WML-P4-UI-8: no probabilities or a multiclass target give no explorer', () => {
		expect(buildThresholdView(svcBinaryNoProbabilities(), 'diagnosis')).toBeNull();
		expect(buildThresholdView(irisCrossValidation(), 'species')).toBeNull();
	});
});

describe('Calibration view model', () => {
	it('WML-P4-UI-8: keeps zero counts, maps empty bins to null and reports ECE', () => {
		const view = buildCalibrationView(
			withEmptyCalibrationBin(breastCancerOneShot(), 4),
			format
		)!;
		expect(view.mode).toBe('binary');
		expect(view.bins).toHaveLength(10);
		expect(view.bins[4]).toMatchObject({ count: 0, meanPredicted: null, observed: null });
		expect(view.bins[3]!.observed).not.toBeNull();
		expect(view.bins[5]!.observed).not.toBeNull();
		expect(view.eceText).toBe('4%');
	});

	it('CHT-MODEL-1: uses percentages for bounded scores and keeps stored calibration rates', () => {
		const evaluation = breastCancerOneShot();
		const summary = buildSummaryView(evaluation, names, format);
		for (const id of ['rocAuc', 'averagePrecision', 'ece']) {
			const row = summary.more.find((entry) => entry.id === id)!;
			if (row.value !== null) expect(row.value).toContain('%');
		}
		const calibration = evaluation.curves.calibration!;
		const observed = [...calibration.observed];
		observed[3] = 0.123456;
		const changed = {
			...evaluation,
			curves: { ...evaluation.curves, calibration: { ...calibration, observed } }
		};
		expect(buildCalibrationView(changed, format)!.bins[3]!.observed).toBe(0.123456);
	});

	it('WML-P4-UI-8: multiclass uses top-label bins; no probabilities gives null', () => {
		expect(buildCalibrationView(irisCrossValidation(), format)!.mode).toBe('top-label');
		expect(buildCalibrationView(svcBinaryNoProbabilities(), format)).toBeNull();
	});
});
