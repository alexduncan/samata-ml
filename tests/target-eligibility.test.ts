import { describe, expect, it } from 'bun:test';
import {
	buildTargetRows,
	formatTargetNote,
	type TargetNoteCode
} from '../src/features/target/target-eligibility';
import type {
	BooleanColumnStats,
	CategoricalColumnStats,
	DatasetMetadata,
	DatetimeColumnStats,
	NumericColumnStats,
	TextColumnStats
} from '../src/types/dataset';
import type { SampleDatasetDescriptor } from '../src/types/sample-dataset';
import type { DatasetSummary } from '../src/types/state';

function createNumericStats(
	name: string,
	overrides: Partial<NumericColumnStats> = {}
): NumericColumnStats {
	return {
		name,
		type: 'numeric',
		missingCount: 0,
		missingTokens: {},
		invalidCount: 0,
		invalidExamples: [],
		count: 10,
		min: 1,
		max: 10,
		mean: 5.5,
		median: 5.5,
		integer: true,
		identifierHint: false,
		format: { prefix: '', suffix: '', thousandsSeparator: false },
		histogram: { start: 1, width: 1, counts: [10] },
		...overrides
	};
}

function createCategoricalStats(
	name: string,
	overrides: Partial<CategoricalColumnStats> = {}
): CategoricalColumnStats {
	return {
		name,
		type: 'categorical',
		missingCount: 0,
		missingTokens: {},
		invalidCount: 0,
		invalidExamples: [],
		distinctCount: 3,
		categoryCounts: { a: 4, b: 3, c: 3 },
		...overrides
	};
}

function createBooleanStats(
	name: string,
	overrides: Partial<BooleanColumnStats> = {}
): BooleanColumnStats {
	return {
		name,
		type: 'boolean',
		missingCount: 0,
		missingTokens: {},
		invalidCount: 0,
		invalidExamples: [],
		trueCount: 5,
		falseCount: 5,
		lexicon: ['true', 'false'],
		...overrides
	};
}

function createTextStats(name: string, overrides: Partial<TextColumnStats> = {}): TextColumnStats {
	return {
		name,
		type: 'text',
		missingCount: 0,
		missingTokens: {},
		invalidCount: 0,
		invalidExamples: [],
		distinctCount: 10,
		identifierHint: false,
		...overrides
	};
}

function createDatetimeStats(
	name: string,
	overrides: Partial<DatetimeColumnStats> = {}
): DatetimeColumnStats {
	return {
		name,
		type: 'datetime',
		missingCount: 0,
		missingTokens: {},
		invalidCount: 0,
		invalidExamples: [],
		count: 10,
		min: 1000,
		max: 2000,
		format: { kind: 'date', order: 'ISO', orderAssumed: false, hasTime: false },
		...overrides
	};
}

function createDatasetSummary(
	id = 'ds-1',
	columns: DatasetSummary['columns'] = []
): DatasetSummary {
	return {
		id,
		name: 'Test dataset',
		source: 'sample',
		rowCount: 10,
		columns
	};
}

function createMetadata(id = 'ds-1', columns: DatasetMetadata['columns'] = []): DatasetMetadata {
	return {
		id,
		name: 'Test dataset',
		source: 'sample',
		sampleId: 'sample-1',
		rowCount: 10,
		byteLength: 100,
		createdAt: 1000,
		delimiter: ',',
		columns,
		paddedRowCount: 0,
		skippedRows: { count: 0, rowNumbers: [] }
	};
}

describe('Target Eligibility Unit Tests', () => {
	describe('TARG-UNIT-1: Eligibility and disqualification rules', () => {
		it('returns eligible for valid numeric, categorical and boolean columns', () => {
			const summary = createDatasetSummary('ds-1', [
				{ name: 'num_col', type: 'numeric', missingCount: 0 },
				{ name: 'cat_col', type: 'categorical', missingCount: 0 },
				{ name: 'bool_col', type: 'boolean', missingCount: 0 }
			]);
			const meta = createMetadata('ds-1', [
				createNumericStats('num_col'),
				createCategoricalStats('cat_col'),
				createBooleanStats('bool_col')
			]);

			const rows = buildTargetRows(summary, null, meta, null);
			expect(rows).toHaveLength(3);

			expect(rows[0]).toEqual({
				name: 'num_col',
				type: 'numeric',
				eligible: true,
				isCurrentTarget: false,
				reasonCodes: []
			});
			expect(rows[1]).toEqual({
				name: 'cat_col',
				type: 'categorical',
				eligible: true,
				isCurrentTarget: false,
				reasonCodes: []
			});
			expect(rows[2]).toEqual({
				name: 'bool_col',
				type: 'boolean',
				eligible: true,
				isCurrentTarget: false,
				reasonCodes: []
			});
		});

		it('disqualifies unsupported text and datetime columns', () => {
			const summary = createDatasetSummary('ds-1', [
				{ name: 'text_col', type: 'text', missingCount: 0 },
				{ name: 'date_col', type: 'datetime', missingCount: 0 }
			]);
			const meta = createMetadata('ds-1', [
				createTextStats('text_col'),
				createDatetimeStats('date_col')
			]);

			const rows = buildTargetRows(summary, null, meta, null);

			expect(rows[0]).toEqual({
				name: 'text_col',
				type: 'text',
				eligible: false,
				isCurrentTarget: false,
				reasonCodes: ['INELIGIBLE_TEXT']
			});
			expect(rows[1]).toEqual({
				name: 'date_col',
				type: 'datetime',
				eligible: false,
				isCurrentTarget: false,
				reasonCodes: ['INELIGIBLE_DATETIME']
			});
		});

		it('TEMP-AC-2: disqualifies date and time columns like datetime', () => {
			const summary = createDatasetSummary('ds-1', [
				{ name: 'd', type: 'date', missingCount: 0 },
				{ name: 't', type: 'time', missingCount: 0 }
			]);
			const meta = createMetadata('ds-1', [
				{
					name: 'd',
					type: 'date',
					missingCount: 0,
					missingTokens: {},
					invalidCount: 0,
					invalidExamples: [],
					count: 10,
					min: 0,
					max: 0,
					format: { kind: 'date', order: 'ISO', orderAssumed: false }
				},
				{
					name: 't',
					type: 'time',
					missingCount: 0,
					missingTokens: {},
					invalidCount: 0,
					invalidExamples: [],
					count: 10,
					min: 0,
					max: 0,
					precision: 'minute'
				}
			]);

			const rows = buildTargetRows(summary, null, meta, null);

			expect(rows.map((row) => [row.type, row.eligible, row.reasonCodes])).toEqual([
				['date', false, ['INELIGIBLE_DATETIME']],
				['time', false, ['INELIGIBLE_DATETIME']]
			]);
		});

		it('disqualifies all-missing numeric, categorical and boolean columns', () => {
			const summary = createDatasetSummary('ds-1', [
				{ name: 'num_empty', type: 'numeric', missingCount: 10 },
				{ name: 'cat_empty', type: 'categorical', missingCount: 10 },
				{ name: 'bool_empty', type: 'boolean', missingCount: 10 }
			]);
			const meta = createMetadata('ds-1', [
				createNumericStats('num_empty', { count: 0, missingCount: 10 }),
				createCategoricalStats('cat_empty', {
					distinctCount: 0,
					categoryCounts: {},
					missingCount: 10
				}),
				createBooleanStats('bool_empty', {
					trueCount: 0,
					falseCount: 0,
					missingCount: 10
				})
			]);

			const rows = buildTargetRows(summary, null, meta, null);

			expect(rows[0]?.eligible).toBe(false);
			expect(rows[0]?.reasonCodes).toEqual(['INELIGIBLE_ALL_MISSING']);

			expect(rows[1]?.eligible).toBe(false);
			expect(rows[1]?.reasonCodes).toEqual(['INELIGIBLE_ALL_MISSING']);

			expect(rows[2]?.eligible).toBe(false);
			expect(rows[2]?.reasonCodes).toEqual(['INELIGIBLE_ALL_MISSING']);
		});

		it('disqualifies constant columns (numeric min===max, categorical distinctCount<=1, boolean single positive)', () => {
			const summary = createDatasetSummary('ds-1', [
				{ name: 'num_const', type: 'numeric', missingCount: 0 },
				{ name: 'cat_const', type: 'categorical', missingCount: 0 },
				{ name: 'bool_const_true', type: 'boolean', missingCount: 0 },
				{ name: 'bool_const_false', type: 'boolean', missingCount: 0 }
			]);
			const meta = createMetadata('ds-1', [
				createNumericStats('num_const', { count: 10, min: 42, max: 42 }),
				createCategoricalStats('cat_const', {
					distinctCount: 1,
					categoryCounts: { only_val: 10 }
				}),
				createBooleanStats('bool_const_true', { trueCount: 10, falseCount: 0 }),
				createBooleanStats('bool_const_false', { trueCount: 0, falseCount: 10 })
			]);

			const rows = buildTargetRows(summary, null, meta, null);

			expect(rows[0]?.eligible).toBe(false);
			expect(rows[0]?.reasonCodes).toEqual(['INELIGIBLE_CONSTANT']);

			expect(rows[1]?.eligible).toBe(false);
			expect(rows[1]?.reasonCodes).toEqual(['INELIGIBLE_CONSTANT']);

			expect(rows[2]?.eligible).toBe(false);
			expect(rows[2]?.reasonCodes).toEqual(['INELIGIBLE_CONSTANT']);

			expect(rows[3]?.eligible).toBe(false);
			expect(rows[3]?.reasonCodes).toEqual(['INELIGIBLE_CONSTANT']);
		});

		it('disables columns with METADATA_UNAVAILABLE when metadata is absent or mismatched', () => {
			const summary = createDatasetSummary('ds-1', [
				{ name: 'col_a', type: 'numeric', missingCount: 0 }
			]);

			// 1. null metadata
			const rowsNull = buildTargetRows(summary, null, null, null);
			expect(rowsNull[0]?.eligible).toBe(false);
			expect(rowsNull[0]?.reasonCodes).toEqual(['METADATA_UNAVAILABLE']);

			// 2. mismatched dataset ID
			const metaOtherId = createMetadata('ds-different', [createNumericStats('col_a')]);
			const rowsDiffId = buildTargetRows(summary, null, metaOtherId, null);
			expect(rowsDiffId[0]?.eligible).toBe(false);
			expect(rowsDiffId[0]?.reasonCodes).toEqual(['METADATA_UNAVAILABLE']);

			// 3. missing column in metadata
			const metaMissing = createMetadata('ds-1', [createNumericStats('other_col')]);
			const rowsMissing = buildTargetRows(summary, null, metaMissing, null);
			expect(rowsMissing[0]?.eligible).toBe(false);
			expect(rowsMissing[0]?.reasonCodes).toEqual(['METADATA_UNAVAILABLE']);

			// 4. malformed name match (casing or whitespace)
			const metaMalformed = createMetadata('ds-1', [createNumericStats('COL_A')]);
			const rowsMalformed = buildTargetRows(summary, null, metaMalformed, null);
			expect(rowsMalformed[0]?.eligible).toBe(false);
			expect(rowsMalformed[0]?.reasonCodes).toEqual(['METADATA_UNAVAILABLE']);

			// 5. mismatched column type
			const metaTypeMismatch = createMetadata('ds-1', [createCategoricalStats('col_a')]);
			const rowsTypeMismatch = buildTargetRows(summary, null, metaTypeMismatch, null);
			expect(rowsTypeMismatch[0]?.eligible).toBe(false);
			expect(rowsTypeMismatch[0]?.reasonCodes).toEqual(['METADATA_UNAVAILABLE']);
		});

		it('enforces disqualification precedence: unsupported > all-missing > constant', () => {
			// Text column with 0 count: still INELIGIBLE_TEXT, not INELIGIBLE_ALL_MISSING
			const summary = createDatasetSummary('ds-1', [
				{ name: 'empty_text', type: 'text', missingCount: 10 }
			]);
			const meta = createMetadata('ds-1', [
				createTextStats('empty_text', { distinctCount: 0, missingCount: 10 })
			]);
			const rows = buildTargetRows(summary, null, meta, null);
			expect(rows[0]?.reasonCodes).toEqual(['INELIGIBLE_TEXT']);

			// Numeric column with 0 count: INELIGIBLE_ALL_MISSING, not INELIGIBLE_CONSTANT
			const summaryNum = createDatasetSummary('ds-1', [
				{ name: 'zero_num', type: 'numeric', missingCount: 10 }
			]);
			const metaNum = createMetadata('ds-1', [
				createNumericStats('zero_num', { count: 0, min: 0, max: 0, missingCount: 10 })
			]);
			const rowsNum = buildTargetRows(summaryNum, null, metaNum, null);
			expect(rowsNum[0]?.reasonCodes).toEqual(['INELIGIBLE_ALL_MISSING']);
		});
	});

	describe('TARG-UNIT-2: Advisory codes and active target state', () => {
		it('flags current target independently of eligibility or advisories', () => {
			const summary = createDatasetSummary('ds-1', [
				{ name: 'col_1', type: 'numeric', missingCount: 0 },
				{ name: 'col_2', type: 'text', missingCount: 0 }
			]);
			const meta = createMetadata('ds-1', [
				createNumericStats('col_1'),
				createTextStats('col_2')
			]);

			const rows1 = buildTargetRows(summary, 'col_1', meta, null);
			expect(rows1[0]?.isCurrentTarget).toBe(true);
			expect(rows1[1]?.isCurrentTarget).toBe(false);

			const rows2 = buildTargetRows(summary, 'col_2', meta, null);
			expect(rows2[0]?.isCurrentTarget).toBe(false);
			expect(rows2[1]?.isCurrentTarget).toBe(true);
		});

		it('treats identifier role or numeric identifierHint as advisory, not disqualifying', () => {
			const summary = createDatasetSummary('ds-1', [
				{ name: 'id_hint_num', type: 'numeric', missingCount: 0 },
				{ name: 'id_role_cat', type: 'categorical', missingCount: 0 }
			]);
			const meta = createMetadata('ds-1', [
				createNumericStats('id_hint_num', { identifierHint: true }),
				createCategoricalStats('id_role_cat')
			]);
			const descriptor: Partial<SampleDatasetDescriptor> = {
				columns: [
					{
						name: 'id_role_cat',
						displayName: 'ID Role',
						description: '',
						dataType: 'categorical',
						role: 'identifier',
						missingCount: 0
					}
				]
			};

			const rows = buildTargetRows(
				summary,
				null,
				meta,
				descriptor as SampleDatasetDescriptor
			);

			expect(rows[0]?.eligible).toBe(true);
			expect(rows[0]?.reasonCodes).toContain('ADVISORY_IDENTIFIER');

			expect(rows[1]?.eligible).toBe(true);
			expect(rows[1]?.reasonCodes).toContain('ADVISORY_IDENTIFIER');
		});

		it('triggers high cardinality advisory only for categorical columns with distinctCount > 50', () => {
			const summary = createDatasetSummary('ds-1', [
				{ name: 'cat_50', type: 'categorical', missingCount: 0 },
				{ name: 'cat_51', type: 'categorical', missingCount: 0 },
				{ name: 'num_100', type: 'numeric', missingCount: 0 }
			]);
			const meta = createMetadata('ds-1', [
				createCategoricalStats('cat_50', { distinctCount: 50 }),
				createCategoricalStats('cat_51', { distinctCount: 51 }),
				createNumericStats('num_100', { count: 100 })
			]);

			const rows = buildTargetRows(summary, null, meta, null);

			expect(rows[0]?.eligible).toBe(true);
			expect(rows[0]?.reasonCodes).not.toContain('ADVISORY_HIGH_CARDINALITY');

			expect(rows[1]?.eligible).toBe(true);
			expect(rows[1]?.reasonCodes).toContain('ADVISORY_HIGH_CARDINALITY');

			expect(rows[2]?.eligible).toBe(true);
			expect(rows[2]?.reasonCodes).not.toContain('ADVISORY_HIGH_CARDINALITY');
		});

		it('triggers missing values advisory when missingCount or invalidCount > 0', () => {
			const summary = createDatasetSummary('ds-1', [
				{ name: 'num_missing', type: 'numeric', missingCount: 2 },
				{ name: 'num_invalid', type: 'numeric', missingCount: 1 }
			]);
			const meta = createMetadata('ds-1', [
				createNumericStats('num_missing', { count: 8, missingCount: 2 }),
				createNumericStats('num_invalid', { count: 9, invalidCount: 1 })
			]);

			const rows = buildTargetRows(summary, null, meta, null);

			expect(rows[0]?.eligible).toBe(true);
			expect(rows[0]?.reasonCodes).toContain('ADVISORY_MISSING_VALUES');

			expect(rows[1]?.eligible).toBe(true);
			expect(rows[1]?.reasonCodes).toContain('ADVISORY_MISSING_VALUES');
		});

		it('triggers target candidate advisory when column is listed in modeling.targetCandidates', () => {
			const summary = createDatasetSummary('ds-1', [
				{ name: 'candidate_col', type: 'categorical', missingCount: 0 },
				{ name: 'regular_col', type: 'categorical', missingCount: 0 }
			]);
			const meta = createMetadata('ds-1', [
				createCategoricalStats('candidate_col'),
				createCategoricalStats('regular_col')
			]);
			const descriptor: Partial<SampleDatasetDescriptor> = {
				modeling: {
					defaultTarget: 'candidate_col',
					targetCandidates: [
						{
							column: 'candidate_col',
							taskType: 'multiclass-classification',
							description: 'Sample candidate'
						}
					]
				}
			};

			const rows = buildTargetRows(
				summary,
				null,
				meta,
				descriptor as SampleDatasetDescriptor
			);

			expect(rows[0]?.eligible).toBe(true);
			expect(rows[0]?.reasonCodes).toContain('ADVISORY_TARGET_CANDIDATE');

			// Non-candidates remain eligible and selectable
			expect(rows[1]?.eligible).toBe(true);
			expect(rows[1]?.reasonCodes).not.toContain('ADVISORY_TARGET_CANDIDATE');
		});

		it('preserves exact advisory ordering: identifier, missing, high-cardinality, candidate', () => {
			const summary = createDatasetSummary('ds-1', [
				{ name: 'all_advisories', type: 'categorical', missingCount: 2 }
			]);
			const meta = createMetadata('ds-1', [
				createCategoricalStats('all_advisories', {
					distinctCount: 60,
					missingCount: 2
				})
			]);
			const descriptor: Partial<SampleDatasetDescriptor> = {
				columns: [
					{
						name: 'all_advisories',
						displayName: 'All Advisories',
						description: '',
						dataType: 'categorical',
						role: 'identifier',
						missingCount: 2
					}
				],
				modeling: {
					defaultTarget: 'all_advisories',
					targetCandidates: [
						{
							column: 'all_advisories',
							taskType: 'multiclass-classification',
							description: ''
						}
					]
				}
			};

			const rows = buildTargetRows(
				summary,
				null,
				meta,
				descriptor as SampleDatasetDescriptor
			);

			expect(rows[0]?.reasonCodes).toEqual([
				'ADVISORY_IDENTIFIER',
				'ADVISORY_MISSING_VALUES',
				'ADVISORY_HIGH_CARDINALITY',
				'ADVISORY_TARGET_CANDIDATE'
			]);
		});

		it('formats target notes correctly with parameters', () => {
			expect(formatTargetNote('METADATA_UNAVAILABLE')).toBe(
				'Column information is unavailable.'
			);
			expect(formatTargetNote('INELIGIBLE_TEXT')).toBe('Text columns cannot be targets.');
			expect(formatTargetNote('INELIGIBLE_DATETIME')).toBe(
				'Date and time columns cannot be targets.'
			);
			expect(formatTargetNote('INELIGIBLE_ALL_MISSING')).toBe('No usable values.');
			expect(formatTargetNote('INELIGIBLE_CONSTANT')).toBe('Only one value is present.');
			expect(formatTargetNote('ADVISORY_IDENTIFIER')).toBe(
				'This column may identify individual records.'
			);
			expect(formatTargetNote('ADVISORY_MISSING_VALUES', { count: 4 })).toBe(
				'4 missing or invalid values.'
			);
			expect(formatTargetNote('ADVISORY_HIGH_CARDINALITY', { count: 85 })).toBe(
				'85 categories; check that this is a meaningful target.'
			);
			expect(formatTargetNote('ADVISORY_TARGET_CANDIDATE')).toBe('Suggested target');
		});
	});
});
