import type { ColumnStats, DatasetMetadata } from '../../types/dataset';
import type { SampleDatasetGuidance } from '../../types/sample-dataset';
import type { ColumnType, DatasetSummary } from '../../types/state';

/**
 * Standard note codes for column eligibility and advisory notices.
 */
export type TargetNoteCode =
	| 'METADATA_UNAVAILABLE'
	| 'INELIGIBLE_TEXT'
	| 'INELIGIBLE_DATETIME'
	| 'INELIGIBLE_ALL_MISSING'
	| 'INELIGIBLE_CONSTANT'
	| 'ADVISORY_IDENTIFIER'
	| 'ADVISORY_MISSING_VALUES'
	| 'ADVISORY_HIGH_CARDINALITY'
	| 'ADVISORY_TARGET_CANDIDATE';

/**
 * Presentation and eligibility row model for one dataset column.
 */
export interface TargetColumnRow {
	/** Column name as declared in the dataset summary. */
	name: string;
	/** Inferred or declared canonical column type. */
	type: ColumnType;
	/** Whether the column can be chosen as a model target. */
	eligible: boolean;
	/** Whether this column is the currently active target. */
	isCurrentTarget: boolean;
	/** Machine-readable reason and advisory codes. */
	reasonCodes: TargetNoteCode[];
}

/**
 * Formats human-readable copy for a target note code.
 *
 * @param code - Note code to format.
 * @param params - Optional parameters (e.g. missing cell count or distinct categories).
 * @returns Localised English copy matching specification/plans/step-2-set-target.md.
 */
export function formatTargetNote(code: TargetNoteCode, params?: { count?: number }): string {
	switch (code) {
		case 'METADATA_UNAVAILABLE':
			return 'Column information is unavailable.';
		case 'INELIGIBLE_TEXT':
			return 'Text columns cannot be targets.';
		case 'INELIGIBLE_DATETIME':
			return 'Date and time columns cannot be targets.';
		case 'INELIGIBLE_ALL_MISSING':
			return 'No usable values.';
		case 'INELIGIBLE_CONSTANT':
			return 'Only one value is present.';
		case 'ADVISORY_IDENTIFIER':
			return 'This column may identify individual records.';
		case 'ADVISORY_MISSING_VALUES':
			return `${params?.count ?? 0} missing or invalid values.`;
		case 'ADVISORY_HIGH_CARDINALITY':
			return `${params?.count ?? 0} categories; check that this is a meaningful target.`;
		case 'ADVISORY_TARGET_CANDIDATE':
			return 'Suggested target';
	}
}

/**
 * Derives presentation rows, eligibility and advisory codes for dataset columns.
 *
 * @param dataset - Application state dataset summary.
 * @param currentTarget - Currently active target column name, or null.
 * @param metadata - Complete ingestion metadata for the dataset, or null.
 * @param descriptor - Optional sample dataset descriptor containing domain hints.
 * @returns A row per dataset column in summary order.
 */
export function buildTargetRows(
	dataset: DatasetSummary,
	currentTarget: string | null,
	metadata: DatasetMetadata | null,
	descriptor: SampleDatasetGuidance | null
): TargetColumnRow[] {
	if (!dataset || !Array.isArray(dataset.columns)) {
		return [];
	}

	const metadataMatches = Boolean(metadata && metadata.id === dataset.id);

	return dataset.columns.map((summaryCol) => {
		const isCurrentTarget = currentTarget !== null && summaryCol.name === currentTarget;

		if (!metadata || !metadataMatches) {
			return {
				name: summaryCol.name,
				type: summaryCol.type,
				eligible: false,
				isCurrentTarget,
				reasonCodes: ['METADATA_UNAVAILABLE']
			};
		}

		const stats = metadata.columns.find((col) => col.name === summaryCol.name);
		if (!stats || stats.type !== summaryCol.type) {
			return {
				name: summaryCol.name,
				type: summaryCol.type,
				eligible: false,
				isCurrentTarget,
				reasonCodes: ['METADATA_UNAVAILABLE']
			};
		}

		// Disqualifying check 1: Unsupported types (text, datetime)
		if (stats.type === 'text') {
			return {
				name: summaryCol.name,
				type: summaryCol.type,
				eligible: false,
				isCurrentTarget,
				reasonCodes: ['INELIGIBLE_TEXT']
			};
		}

		if (stats.type === 'datetime') {
			return {
				name: summaryCol.name,
				type: summaryCol.type,
				eligible: false,
				isCurrentTarget,
				reasonCodes: ['INELIGIBLE_DATETIME']
			};
		}

		// Disqualifying check 2: All-missing (valid count zero)
		let validCount = 0;
		if (stats.type === 'numeric') {
			validCount = stats.count;
		} else if (stats.type === 'categorical') {
			validCount = Object.values(stats.categoryCounts).reduce((acc, count) => acc + count, 0);
		} else if (stats.type === 'boolean') {
			validCount = stats.trueCount + stats.falseCount;
		}

		if (validCount === 0) {
			return {
				name: summaryCol.name,
				type: summaryCol.type,
				eligible: false,
				isCurrentTarget,
				reasonCodes: ['INELIGIBLE_ALL_MISSING']
			};
		}

		// Disqualifying check 3: Constant columns
		let isConstant = false;
		if (stats.type === 'numeric') {
			isConstant = stats.count > 0 && stats.min === stats.max;
		} else if (stats.type === 'categorical') {
			isConstant = stats.distinctCount <= 1;
		} else if (stats.type === 'boolean') {
			isConstant =
				(stats.trueCount > 0 && stats.falseCount === 0) ||
				(stats.falseCount > 0 && stats.trueCount === 0);
		}

		if (isConstant) {
			return {
				name: summaryCol.name,
				type: summaryCol.type,
				eligible: false,
				isCurrentTarget,
				reasonCodes: ['INELIGIBLE_CONSTANT']
			};
		}

		// Column is eligible; collect advisory codes in fixed order
		const reasonCodes: TargetNoteCode[] = [];

		// Advisory 1: Identifier
		const isIdentifier =
			(stats.type === 'numeric' && stats.identifierHint) ||
			Boolean(
				descriptor?.columns?.some(
					(col) => col.name === summaryCol.name && col.role === 'identifier'
				)
			);
		if (isIdentifier) {
			reasonCodes.push('ADVISORY_IDENTIFIER');
		}

		// Advisory 2: Missing values
		const missingCount = stats.missingCount + stats.invalidCount;
		if (missingCount > 0) {
			reasonCodes.push('ADVISORY_MISSING_VALUES');
		}

		// Advisory 3: High cardinality (>50 for categorical)
		if (stats.type === 'categorical' && stats.distinctCount > 50) {
			reasonCodes.push('ADVISORY_HIGH_CARDINALITY');
		}

		// Advisory 4: Suggested target candidate
		const isCandidate = Boolean(
			descriptor?.modeling?.targetCandidates?.some(
				(candidate) => candidate.column === summaryCol.name
			)
		);
		if (isCandidate) {
			reasonCodes.push('ADVISORY_TARGET_CANDIDATE');
		}

		return {
			name: summaryCol.name,
			type: summaryCol.type,
			eligible: true,
			isCurrentTarget,
			reasonCodes
		};
	});
}
