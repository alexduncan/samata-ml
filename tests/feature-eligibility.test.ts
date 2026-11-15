import { describe, expect, it } from 'bun:test';
import {
	buildFeatureRows,
	formatFeatureNote,
	type FeatureRow
} from '../src/features/models/feature-eligibility';
import type { DatasetMetadata } from '../src/types/dataset';
import type { SampleDatasetDescriptor } from '../src/types/sample-dataset';

describe('Feature Eligibility Logic (MOD-FEAT-1)', () => {
	const mockMetadata = {
		id: 'test-dataset',
		name: 'Test Dataset',
		rowCount: 100,
		columnCount: 9,
		columns: [
			{
				name: 'id_col',
				type: 'numeric',
				count: 100,
				missingCount: 0,
				invalidCount: 0,
				min: 1,
				max: 100,
				mean: 50.5,
				median: 50,
				identifierHint: true
			},
			{
				name: 'clean_feature',
				type: 'numeric',
				count: 100,
				missingCount: 0,
				invalidCount: 0,
				min: 10,
				max: 50,
				mean: 30,
				median: 30
			},
			{
				name: 'target_col',
				type: 'categorical',
				missingCount: 0,
				invalidCount: 0,
				distinctCount: 2,
				categoryCounts: { yes: 50, no: 50 }
			},
			{
				name: 'text_col',
				type: 'text',
				missingCount: 0,
				invalidCount: 0
			},
			{
				name: 'datetime_col',
				type: 'datetime',
				count: 100,
				missingCount: 0,
				invalidCount: 0,
				min: 1577836800000,
				max: 1609459200000
			},
			{
				name: 'all_missing_col',
				type: 'numeric',
				count: 0,
				missingCount: 100,
				invalidCount: 0,
				min: 0,
				max: 0,
				mean: 0,
				median: 0
			},
			{
				name: 'constant_col',
				type: 'numeric',
				count: 100,
				missingCount: 0,
				invalidCount: 0,
				min: 42,
				max: 42,
				mean: 42,
				median: 42
			},
			{
				name: 'leaky_feature',
				type: 'numeric',
				count: 100,
				missingCount: 0,
				invalidCount: 0,
				min: 0,
				max: 10,
				mean: 5,
				median: 5
			},
			{
				name: 'missing_feature',
				type: 'numeric',
				count: 90,
				missingCount: 10,
				invalidCount: 0,
				min: 1,
				max: 20,
				mean: 10,
				median: 10
			}
		]
	} as unknown as DatasetMetadata;

	const mockDescriptor = {
		id: 'test-dataset',
		name: 'Test Dataset',
		description: 'Sample descriptor',
		files: {
			csv: 'data.csv',
			datasheet: 'datasheet.md',
			csvOrigin: 'bundled'
		},
		columns: [
			{ name: 'id_col', role: 'identifier', dataType: 'numeric' },
			{ name: 'clean_feature', role: 'feature', dataType: 'numeric' },
			{ name: 'target_col', role: 'feature', dataType: 'categorical' },
			{ name: 'leaky_feature', role: 'feature', dataType: 'numeric' }
		],
		modeling: {
			defaultTarget: 'target_col',
			targetCandidates: [
				{
					column: 'target_col',
					taskType: 'binary-classification',
					description: 'Target candidate',
					leakyColumns: [{ column: 'leaky_feature', reason: 'High correlation' }]
				}
			]
		}
	} as unknown as SampleDatasetDescriptor;

	it('MOD-FEAT-1: accurately identifies target, unsupported, constant, all-missing, and advisory codes', () => {
		const rows = buildFeatureRows(mockMetadata, 'target_col', mockDescriptor);
		expect(rows).toHaveLength(9);

		// Target column
		const targetRow = rows.find((r) => r.name === 'target_col')!;
		expect(targetRow.isTarget).toBe(true);
		expect(targetRow.eligible).toBe(false);
		expect(targetRow.initiallySelected).toBe(false);
		expect(targetRow.reasonCodes).toEqual(['TARGET']);

		// Clean feature
		const cleanRow = rows.find((r) => r.name === 'clean_feature')!;
		expect(cleanRow.eligible).toBe(true);
		expect(cleanRow.isTarget).toBe(false);
		expect(cleanRow.initiallySelected).toBe(true);
		expect(cleanRow.reasonCodes).toEqual([]);

		// Unsupported text and datetime
		const textRow = rows.find((r) => r.name === 'text_col')!;
		expect(textRow.eligible).toBe(false);
		expect(textRow.reasonCodes).toEqual(['UNSUPPORTED']);

		const dtRow = rows.find((r) => r.name === 'datetime_col')!;
		expect(dtRow.eligible).toBe(false);
		expect(dtRow.reasonCodes).toEqual(['UNSUPPORTED']);

		// All-missing
		const allMissingRow = rows.find((r) => r.name === 'all_missing_col')!;
		expect(allMissingRow.eligible).toBe(false);
		expect(allMissingRow.reasonCodes).toEqual(['ALL_MISSING']);

		// Constant
		const constantRow = rows.find((r) => r.name === 'constant_col')!;
		expect(constantRow.eligible).toBe(false);
		expect(constantRow.reasonCodes).toEqual(['CONSTANT']);

		// Identifier default unticked but eligible
		const idRow = rows.find((r) => r.name === 'id_col')!;
		expect(idRow.eligible).toBe(true);
		expect(idRow.initiallySelected).toBe(false);
		expect(idRow.reasonCodes).toContain('IDENTIFIER');

		// Leaky column default unticked but eligible
		const leakyRow = rows.find((r) => r.name === 'leaky_feature')!;
		expect(leakyRow.eligible).toBe(true);
		expect(leakyRow.initiallySelected).toBe(false);
		expect(leakyRow.reasonCodes).toContain('LEAKY');

		// Missing values
		const missingRow = rows.find((r) => r.name === 'missing_feature')!;
		expect(missingRow.eligible).toBe(true);
		expect(missingRow.initiallySelected).toBe(true);
		expect(missingRow.reasonCodes).toContain('MISSING_VALUES');

		// Test note formatter
		expect(formatFeatureNote('TARGET')).toBe('Target variable');
		expect(formatFeatureNote('UNSUPPORTED')).toBe('Unsupported data type');
		expect(formatFeatureNote('ALL_MISSING')).toBe('No usable values');
		expect(formatFeatureNote('CONSTANT')).toBe('Only one value is present');
		expect(formatFeatureNote('IDENTIFIER')).toBe('May identify individual records');
		expect(formatFeatureNote('LEAKY')).toBe('May cause target leakage');
		expect(formatFeatureNote('MISSING_VALUES')).toBe('Contains missing values');
	});
});
