import type { DatasetMetadata } from '../../types/dataset';
import type { SampleDatasetGuidance } from '../../types/sample-dataset';
import type { ColumnType } from '../../types/state';

/**
 * Standard reason and advisory codes for feature eligibility.
 */
export type FeatureNoteCode =
	| 'TARGET'
	| 'UNSUPPORTED'
	| 'ALL_MISSING'
	| 'CONSTANT'
	| 'IDENTIFIER'
	| 'LEAKY'
	| 'MISSING_VALUES';

/**
 * Feature row representation for the Select Features section.
 */
export interface FeatureRow {
	/** Column name. */
	name: string;
	/** Inferred column type. */
	type: ColumnType;
	/** Whether the column can be selected as a feature. */
	eligible: boolean;
	/** Whether this column is the active target variable. */
	isTarget: boolean;
	/** Default selection state: true unless identifier or target candidate leaky column. */
	initiallySelected: boolean;
	/** Machine-readable reason and advisory codes. */
	reasonCodes: FeatureNoteCode[];
}

/**
 * Formats a human-readable label for a feature note code.
 *
 * @param code - Note code.
 * @returns Human-readable description.
 */
export function formatFeatureNote(code: FeatureNoteCode): string {
	switch (code) {
		case 'TARGET':
			return 'Target variable';
		case 'UNSUPPORTED':
			return 'Unsupported data type';
		case 'ALL_MISSING':
			return 'No usable values';
		case 'CONSTANT':
			return 'Only one value is present';
		case 'IDENTIFIER':
			return 'May identify individual records';
		case 'LEAKY':
			return 'May cause target leakage';
		case 'MISSING_VALUES':
			return 'Contains missing values';
	}
}

/**
 * Derives presentation rows, eligibility and advisory notes for candidate features.
 * Follows specification/plans/step-3-train-models-overview-and-setup.md.
 *
 * @param metadata - Ingested dataset metadata.
 * @param target - Name of the active target column.
 * @param descriptor - Optional sample dataset descriptor containing domain hints.
 * @returns Ordered array of feature rows matching metadata column order.
 */
export function buildFeatureRows(
	metadata: DatasetMetadata,
	target: string,
	descriptor: SampleDatasetGuidance | null
): FeatureRow[] {
	if (!metadata || !Array.isArray(metadata.columns)) {
		return [];
	}

	const matchingCandidate = descriptor?.modeling?.targetCandidates?.find(
		(candidate) => candidate.column === target
	);
	const leakyColumns = matchingCandidate?.leakyColumns ?? [];

	return metadata.columns.map((col) => {
		const isTarget = col.name === target;

		// 1. Target column
		if (isTarget) {
			return {
				name: col.name,
				type: col.type,
				eligible: false,
				isTarget: true,
				initiallySelected: false,
				reasonCodes: ['TARGET']
			};
		}

		// 2. Unsupported column types (text, datetime)
		if (col.type === 'text' || col.type === 'datetime') {
			return {
				name: col.name,
				type: col.type,
				eligible: false,
				isTarget: false,
				initiallySelected: false,
				reasonCodes: ['UNSUPPORTED']
			};
		}

		// 3. All-missing check (Step 2 discriminated algorithm)
		let validCount = 0;
		if (col.type === 'numeric') {
			validCount = col.count;
		} else if (col.type === 'categorical') {
			validCount = Object.values(col.categoryCounts).reduce((acc, c) => acc + c, 0);
		} else if (col.type === 'boolean') {
			validCount = col.trueCount + col.falseCount;
		}

		if (validCount === 0) {
			return {
				name: col.name,
				type: col.type,
				eligible: false,
				isTarget: false,
				initiallySelected: false,
				reasonCodes: ['ALL_MISSING']
			};
		}

		// 4. Constant check (Step 2 discriminated algorithm)
		let isConstant = false;
		if (col.type === 'numeric') {
			isConstant = col.count > 0 && col.min === col.max;
		} else if (col.type === 'categorical') {
			isConstant = col.distinctCount <= 1;
		} else if (col.type === 'boolean') {
			isConstant =
				(col.trueCount > 0 && col.falseCount === 0) ||
				(col.falseCount > 0 && col.trueCount === 0);
		}

		if (isConstant) {
			return {
				name: col.name,
				type: col.type,
				eligible: false,
				isTarget: false,
				initiallySelected: false,
				reasonCodes: ['CONSTANT']
			};
		}

		// Column is eligible
		const reasonCodes: FeatureNoteCode[] = [];

		const isIdentifier =
			(col.type === 'numeric' && col.identifierHint) ||
			Boolean(
				descriptor?.columns?.some((c) => c.name === col.name && c.role === 'identifier')
			);
		if (isIdentifier) {
			reasonCodes.push('IDENTIFIER');
		}

		const isLeaky = leakyColumns.some((item) =>
			typeof item === 'string' ? item === col.name : item.column === col.name
		);
		if (isLeaky) {
			reasonCodes.push('LEAKY');
		}

		const missingCount = col.missingCount + col.invalidCount;
		if (missingCount > 0) {
			reasonCodes.push('MISSING_VALUES');
		}

		const initiallySelected = !isIdentifier && !isLeaky;

		return {
			name: col.name,
			type: col.type,
			eligible: true,
			isTarget: false,
			initiallySelected,
			reasonCodes
		};
	});
}
